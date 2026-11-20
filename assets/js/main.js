// main.js — punto di ingresso: tiene lo stato e collega gli eventi ai moduli.
// Nell'HTML c'è un solo <script type="module" src="assets/js/main.js">.
import { cercaSquadre, caricaEventi } from "./api.js";
import { getPreferiti, isPreferita, aggiungiPreferita, rimuoviPreferita } from "./preferiti.js";
import { initTema } from "./tema.js";
import {
  mostra, nascondi, mostraErrore, filtra,
  renderRisultati, svuotaRisultati, renderPreferiti, aggiornaFiltri,
  mostraSezioneDettagli, renderDettagli, renderEventiPreferite,
  apriModaleSquadra, chiudiModaleSquadra, apriModaleEvento,
} from "./ui.js";


// === Stato ===

let risultati = []; // ultime squadre trovate (istanze di Squadra)
let filtro = "tutti"; // "tutti" oppure un valore di strSport
let squadraModale = null; // squadra aperta nella modale "info"
const eventiPerSquadra = new Map(); // idTeam → { prossimi, ultimi } delle preferite
const squadreFallite = new Set(); // idTeam delle preferite il cui caricamento è fallito
const eventiNoti = new Map(); // idEvent → Evento: al click su una card partita ritroviamo i dati

function registraEventi(eventi) {
  eventi.forEach((e) => eventiNoti.set(e.id, e));
}

// Messaggio leggibile per l'utente.
// fetch rifiuta con TypeError solo per errori di rete (offline, CORS, DNS).
// La risposta 429 di TheSportsDB non ha l'header CORS: nel browser
// il superamento del limite arriva qui come TypeError, non come status 429.
function messaggioErrore(err) {
  if (err instanceof TypeError) {
    return "Errore di rete o troppe richieste (limite 30 al minuto). Controlla la connessione e riprova tra un minuto.";
  }
  return err.message;
}

// Ridisegna tutto ciò che dipende da preferiti e filtro
function aggiornaTutto() {
  if (risultati.length > 0) renderRisultati(risultati, filtro, isPreferita);
  renderPreferiti(getPreferiti(), filtro);
  mostraEventiPreferite();
}


// === Caricamento con spinner, errore e AbortController ===
// Ricerca e dettagli seguono lo stesso schema: lo scriviamo una volta sola.
// Ogni caricatore ha il SUO AbortController (in una closure): una nuova
// richiesta annulla solo la precedente dello stesso tipo.

function creaCaricatore(idSpinner, idErrore, prefissoErrore) {
  let controller;

  return {
    async carica(richiesta, mostraRisultato, inCasoDiErrore) {
      controller?.abort(); // annulla la richiesta precedente, se ancora in corso
      controller = new AbortController();
      const { signal } = controller;

      mostra(idSpinner);
      nascondi(idErrore);

      try {
        mostraRisultato(await richiesta(signal));
      } catch (err) {
        if (err.name === "AbortError") return; // annullata da una richiesta più nuova: ignora
        inCasoDiErrore?.();
        mostraErrore(idErrore, `${prefissoErrore}: ${messaggioErrore(err)}`);
      } finally {
        // se è stata annullata, lo spinner serve alla richiesta nuova: non nasconderlo
        if (!signal.aborted) nascondi(idSpinner);
      }
    },

    annulla() {
      controller?.abort();
      nascondi(idSpinner);
      nascondi(idErrore);
    },
  };
}

const ricerca = creaCaricatore("spinner-ricerca", "errore-ricerca", "Errore nella ricerca");
const dettagli = creaCaricatore("spinner-dettagli", "errore-dettagli", "Errore nel caricamento delle partite");


// === Ricerca squadre (debounce) ===

let timeoutId; // timer del debounce

function cerca(query) {
  ricerca.carica(
    (signal) => cercaSquadre(query, signal),
    (squadre) => {
      risultati = squadre;
      renderRisultati(risultati, filtro, isPreferita);
    },
    () => {
      risultati = [];
      svuotaRisultati();
    },
  );
}

// Debounce: ogni tasto cancella il timer e ne parte uno nuovo;
// cerca() parte solo dopo 400ms senza digitazioni.
document.getElementById("cerca").addEventListener("input", (e) => {
  const query = e.target.value.trim();
  clearTimeout(timeoutId); // prima del controllo: cancella anche un timer partito con una query più lunga

  if (query.length < 3) {
    ricerca.annulla(); // una fetch già partita non deve ripopolare la lista
    risultati = [];
    svuotaRisultati();
    return;
  }
  timeoutId = setTimeout(() => cerca(query), 400);
});

// Bottone "Cerca" (o Invio): parte subito, senza aspettare il debounce
document.getElementById("form-ricerca").addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(timeoutId); // evita una seconda ricerca uguale dopo 400ms
  const query = document.getElementById("cerca").value.trim();
  if (query) cerca(query); // "required" accetta anche solo spazi: trim li toglie
});


// === Partite di una squadra (Promise.all dentro caricaEventi) ===

function apriDettagli(squadra) {
  mostraSezioneDettagli(squadra);
  dettagli.carica(
    (signal) => caricaEventi(squadra.id, signal),
    (eventi) => {
      registraEventi([...eventi.prossimi, ...eventi.ultimi]);
      renderDettagli(eventi);
    },
  );
}


// === Partite delle preferite (Promise.allSettled) ===

// allSettled aspetta TUTTE le promesse, anche quelle rifiutate:
// una squadra che fallisce non blocca le altre (con Promise.all perderemmo tutto).
async function caricaEventiPreferite(squadre) {
  if (squadre.length === 0) return;
  mostra("spinner-eventi-preferite");
  const esiti = await Promise.allSettled(squadre.map((s) => caricaEventi(s.id)));
  nascondi("spinner-eventi-preferite"); // allSettled non rifiuta mai: niente try/catch

  // esiti è nello stesso ordine di squadre: l'indice i collega esito e squadra
  esiti.forEach((esito, i) => {
    const id = squadre[i].id;
    if (esito.status === "fulfilled") {
      eventiPerSquadra.set(id, esito.value);
      registraEventi([...esito.value.prossimi, ...esito.value.ultimi]);
      squadreFallite.delete(id);
    } else {
      squadreFallite.add(id);
    }
  });
  mostraEventiPreferite();
}

// Map per idEvent: se due preferite giocano tra loro, la partita compare una volta sola
const senzaDoppioni = (eventi) => [...new Map(eventi.map((e) => [e.id, e])).values()];
const perData = (a, b) => a.chiaveOrdinamento().localeCompare(b.chiaveOrdinamento());

// Unisce gli eventi delle preferite attuali (filtrati per sport), toglie i doppioni e ordina
function mostraEventiPreferite() {
  const preferite = getPreferiti();
  const caricati = preferite.map((s) => eventiPerSquadra.get(s.id)).filter(Boolean);
  const prepara = (eventi) => filtra(senzaDoppioni(eventi), filtro);

  renderEventiPreferite({
    prossimi: prepara(caricati.flatMap((x) => x.prossimi)).sort(perData),
    // ultimi risultati: dal più recente al più vecchio (ordine inverso)
    ultimi: prepara(caricati.flatMap((x) => x.ultimi)).sort((a, b) => perData(b, a)),
    falliti: preferite.filter((s) => squadreFallite.has(s.id)).map((s) => s.nome),
    nessunaPreferita: preferite.length === 0,
  });
}


// === Click sulle card (event delegation) ===

// Stessa funzione per le due griglie: cambia solo l'elenco in cui cercare la squadra
function gestisciClickCard(e, elenco) {
  const bottone = e.target.closest("[data-azione]");
  if (!bottone) return;

  const id = bottone.closest("[data-id]").dataset.id;
  const squadra = elenco.find((s) => s.id === id);
  if (!squadra) return;

  switch (bottone.dataset.azione) {
    case "dettagli": // click sulla card → partite, anche dalle preferite (senza ricercarla)
      apriDettagli(squadra);
      break;
    case "info":
      squadraModale = squadra;
      apriModaleSquadra(squadra);
      break;
    case "preferito": // il cuore funziona da interruttore
      if (isPreferita(id)) {
        rimuoviPreferita(id);
      } else {
        aggiungiPreferita(squadra);
        caricaEventiPreferite([squadra]); // solo la nuova: le altre sono già in memoria
      }
      aggiornaTutto();
      break;
    case "rimuovi":
      rimuoviPreferita(id);
      aggiornaTutto();
      break;
  }
}

document.getElementById("risultati").addEventListener("click", (e) => gestisciClickCard(e, risultati));
document.getElementById("preferiti").addEventListener("click", (e) => gestisciClickCard(e, getPreferiti()));

// Modale info → "Vedi le partite": chiude la modale e carica le partite
document.getElementById("modale-vedi-partite").addEventListener("click", () => {
  chiudiModaleSquadra();
  if (squadraModale) apriDettagli(squadraModale);
});


// === Click su una card partita → modale (event delegation su tutto il main) ===
// Le card partita stanno in 4 griglie diverse: un solo listener le copre tutte.

document.getElementById("contenuto").addEventListener("click", (e) => {
  const card = e.target.closest("[data-evento]");
  if (!card) return;
  const evento = eventiNoti.get(card.dataset.evento);
  if (evento) apriModaleEvento(evento);
});


// === Filtro per sport ===

document.getElementById("filtri").addEventListener("click", (e) => {
  const bottone = e.target.closest("[data-sport]");
  if (!bottone) return;
  filtro = bottone.dataset.sport;
  aggiornaFiltri(filtro);
  aggiornaTutto();
});


// === Avvio ===
// Nessuna squadra predefinita nella ricerca: si vedono solo le preferite salvate,
// e per tutte si caricano in parallelo prossime partite e ultimi risultati.

initTema();
aggiornaFiltri(filtro);
aggiornaTutto();
caricaEventiPreferite(getPreferiti());

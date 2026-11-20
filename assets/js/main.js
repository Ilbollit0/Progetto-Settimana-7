// main.js — punto di ingresso: tiene lo stato e collega gli eventi ai moduli.
// Nell'HTML c'è un solo <script type="module" src="assets/js/main.js">.
import { cercaSquadre, caricaEventi, onCambioBlocco, riprendiBlocco } from "./api.js";
import {
  getPreferiti, isPreferita, aggiungiPreferita, rimuoviPreferita, onCambioPreferiti,
  getRecenti, aggiungiRecente, svuotaRecenti, onCambioRecenti,
} from "./storage.js";
import {
  mostra, nascondi, mostraErrore, filtra, initTema, aggiornaBottoneCerca, renderRecenti, renderFiltri,
  renderRisultati, svuotaRisultati, renderPreferiti, mostraSezioneDettagli, renderDettagli,
  renderEventiPreferite, apriModaleSquadra, chiudiModaleSquadra, apriModaleEvento,
} from "./ui.js";


// === Stato ===

let risultati = []; // ultime squadre trovate (istanze di Squadra)
let filtro = "tutti"; // "tutti" oppure un valore di strSport
let squadraModale = null; // squadra aperta nella modale "info"
let timeoutId; // timer del debounce
const eventiPerSquadra = new Map(); // idTeam → { prossimi, ultimi } delle preferite
const squadreFallite = new Set(); // idTeam delle preferite il cui caricamento è fallito
const eventiNoti = new Map(); // idEvent → Evento: al click su una card partita ritroviamo i dati

const registraEventi = ({ prossimi, ultimi }) => [...prossimi, ...ultimi].forEach((e) => eventiNoti.set(e.id, e));
const inputCerca = document.getElementById("cerca");

// fetch rifiuta con TypeError solo per errori di rete. Il 429 di TheSportsDB non ha
// l'header CORS: nel browser il limite superato arriva qui come TypeError.
const messaggioErrore = (err) =>
  err instanceof TypeError
    ? "Errore di rete o troppe richieste (limite 30 al minuto). Controlla la connessione e riprova tra un minuto."
    : err.message;

// Pillole del filtro: le fisse + gli sport presenti tra risultati e preferite.
// Se lo sport selezionato non c'è più (es. tolta l'ultima squadra di hockey) si torna a "Tutti".
function aggiornaFiltri() {
  const sportPresenti = [...risultati, ...getPreferiti()].map((s) => s.sport);
  if (!renderFiltri(sportPresenti, filtro).includes(filtro)) {
    filtro = "tutti";
    renderFiltri(sportPresenti, filtro);
  }
}

// Ridisegna tutto ciò che dipende da preferite e filtro
function aggiornaTutto() {
  aggiornaFiltri();
  if (risultati.length > 0) renderRisultati(risultati, filtro, isPreferita);
  renderPreferiti(getPreferiti(), filtro);
  mostraEventiPreferite();
}


// === Caricamento con spinner, errore e AbortController ===
// Ricerca e partite seguono lo stesso schema: lo scriviamo una volta sola.
// Ogni caricatore ha il SUO AbortController (closure): una nuova richiesta
// annulla solo la precedente dello stesso tipo.

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
        if (!signal.aborted) nascondi(idSpinner); // se annullata, lo spinner serve alla nuova
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


// === Ricerca squadre ===

function cerca(query) {
  clearTimeout(timeoutId); // niente seconda ricerca uguale dal debounce
  ricerca.carica(
    (signal) => cercaSquadre(query, signal),
    (squadre) => {
      risultati = squadre;
      aggiornaFiltri(); // la squadra trovata può essere di uno sport nuovo (es. hockey)
      renderRisultati(risultati, filtro, isPreferita);
      entraInVista();
      // Tra le recenti finisce il nome della squadra trovata (non il testo digitato)
      if (squadre.length > 0) {
        aggiungiRecente(squadre[0].nome);
        renderRecenti(getRecenti());
      }
    },
    () => {
      risultati = [];
      svuotaRisultati();
    },
  );
}

// Debounce: ogni tasto cancella il timer e ne parte uno nuovo; cerca() parte dopo 400ms di pausa
inputCerca.addEventListener("input", () => {
  const query = inputCerca.value.trim();
  clearTimeout(timeoutId);
  if (query.length >= 3) {
    timeoutId = setTimeout(() => cerca(query), 400);
    return;
  }
  ricerca.annulla(); // una fetch già partita non deve ripopolare la lista
  risultati = [];
  svuotaRisultati();
});

// Bottone "Cerca" (o Invio): parte subito. "required" accetta anche solo spazi: trim li toglie
document.getElementById("form-ricerca").addEventListener("submit", (e) => {
  e.preventDefault();
  if (inputCerca.value.trim()) cerca(inputCerca.value.trim());
});

// Ricerca recente: riempie la barra e cerca (con la cache, entro 10 minuti nessuna richiesta)
document.getElementById("recenti").addEventListener("click", (e) => {
  const pillola = e.target.closest("[data-ricerca]");
  if (!pillola) return;
  inputCerca.value = pillola.dataset.ricerca;
  cerca(pillola.dataset.ricerca);
});

document.getElementById("svuota-recenti").addEventListener("click", () => {
  svuotaRecenti();
  renderRecenti(getRecenti());
  inputCerca.focus(); // il bottone sparisce: il focus non deve perdersi
});


// === Torna indietro (bottone e tasto Indietro del browser) ===
// Quando compaiono risultati o partite aggiungiamo una voce alla cronologia (pushState):
// il tasto Indietro del browser, o il gesto sul telefono, lancia "popstate" invece di uscire.

function entraInVista() {
  if (!history.state?.vista) history.pushState({ vista: true }, ""); // una voce sola
}

// Pagina iniziale: barra vuota, niente risultati né partite. Le preferite restano come sono.
function tornaAllaHome() {
  ricerca.annulla();
  dettagli.annulla();
  risultati = [];
  svuotaRisultati();
  nascondi("dettagli-section");
  inputCerca.value = "";
  aggiornaTutto(); // spariscono le pillole degli sport presenti solo nei risultati
  window.scrollTo({ top: 0, behavior: "smooth" });
  inputCerca.focus({ preventScroll: true });
}

window.addEventListener("popstate", () => {
  if (!history.state?.vista) tornaAllaHome();
});


// === Partite ===

function apriDettagli(squadra) {
  mostraSezioneDettagli(squadra);
  entraInVista();
  dettagli.carica(
    (signal) => caricaEventi(squadra.id, signal),
    (eventi) => {
      registraEventi(eventi);
      renderDettagli(eventi);
    },
  );
}

// Partite delle preferite. allSettled aspetta TUTTE le promesse, anche quelle rifiutate:
// una squadra che fallisce non blocca le altre (con Promise.all perderemmo tutto).
async function caricaEventiPreferite(squadre) {
  if (squadre.length === 0) return;
  mostra("spinner-eventi-preferite");
  const esiti = await Promise.allSettled(squadre.map((s) => caricaEventi(s.id)));
  nascondi("spinner-eventi-preferite"); // allSettled non rifiuta mai: niente try/catch

  // esiti è nello stesso ordine di squadre: l'indice collega esito e squadra
  esiti.forEach(({ status, value }, i) => {
    const id = squadre[i].id;
    if (status === "fulfilled") {
      eventiPerSquadra.set(id, value);
      registraEventi(value);
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

// Unisce le partite delle preferite (filtrate per sport), toglie i doppioni e ordina
function mostraEventiPreferite() {
  const preferite = getPreferiti();
  const caricati = preferite.map((s) => eventiPerSquadra.get(s.id)).filter(Boolean);
  const prepara = (chiave) => filtra(senzaDoppioni(caricati.flatMap((x) => x[chiave])), filtro);

  renderEventiPreferite({
    prossimi: prepara("prossimi").sort(perData),
    ultimi: prepara("ultimi").sort((a, b) => perData(b, a)), // dal più recente
    falliti: preferite.filter((s) => squadreFallite.has(s.id)).map((s) => s.nome),
    nessunaPreferita: preferite.length === 0,
  });
}


// === Click (event delegation) ===

// Card squadra: stessa funzione per le due griglie, cambia l'elenco in cui cercare
function gestisciClickCard(e, elenco) {
  const bottone = e.target.closest("[data-azione]");
  const squadra = bottone && elenco.find((s) => s.id === bottone.closest("[data-id]").dataset.id);
  if (!squadra) return;

  const azione = bottone.dataset.azione;
  if (azione === "dettagli") apriDettagli(squadra); // anche dalle preferite, senza ricercarla
  if (azione === "info") apriModaleSquadra((squadraModale = squadra));
  if (azione === "preferito" || azione === "rimuovi") {
    // il cuore funziona da interruttore; Rimuovi toglie sempre
    if (isPreferita(squadra.id)) {
      rimuoviPreferita(squadra.id);
    } else {
      aggiungiPreferita(squadra);
      caricaEventiPreferite([squadra]); // solo la nuova: le altre sono già in memoria
    }
    aggiornaTutto();
  }
}

document.getElementById("risultati").addEventListener("click", (e) => gestisciClickCard(e, risultati));
document.getElementById("preferiti").addEventListener("click", (e) => gestisciClickCard(e, getPreferiti()));

// Un solo listener su <main> per card partita (4 griglie), "Torna indietro" (2 bottoni) e filtri
document.getElementById("contenuto").addEventListener("click", (e) => {
  const card = e.target.closest("[data-evento]");
  if (card && eventiNoti.has(card.dataset.evento)) apriModaleEvento(eventiNoti.get(card.dataset.evento));

  // history.back() lancia popstate → tornaAllaHome: bottone e tasto Indietro restano allineati
  if (e.target.closest(".torna-indietro")) {
    if (history.state?.vista) history.back();
    else tornaAllaHome();
  }

  const sport = e.target.closest("[data-sport]");
  if (sport) {
    filtro = sport.dataset.sport;
    aggiornaTutto();
  }
});

// Modale info → "Vedi le partite"
document.getElementById("modale-vedi-partite").addEventListener("click", () => {
  chiudiModaleSquadra();
  if (squadraModale) apriDettagli(squadraModale);
});


// === Blocco, sincronizzazione tra tab, avvio ===

// Ogni secondo del blocco aggiorna il bottone Cerca; a fine blocco (0) l'errore non vale più
// e le preferite fallite si riprovano da sole
onCambioBlocco((secondi) => {
  aggiornaBottoneCerca(secondi);
  if (secondi > 0) return;
  nascondi("errore-ricerca");
  caricaEventiPreferite(getPreferiti().filter((s) => squadreFallite.has(s.id)));
});

// Un'altra scheda ha cambiato le preferite: ridisegniamo e scarichiamo solo le nuove
onCambioPreferiti(() => {
  aggiornaTutto();
  caricaEventiPreferite(getPreferiti().filter((s) => !eventiPerSquadra.has(s.id)));
});
onCambioRecenti(() => renderRecenti(getRecenti()));

// Nessuna squadra predefinita nella ricerca: si vedono solo le preferite salvate,
// e per tutte si caricano in parallelo prossime partite e ultimi risultati.
initTema();
riprendiBlocco(); // se il refresh è avvenuto durante il blocco, riparte il conto alla rovescia
renderRecenti(getRecenti());
aggiornaTutto();
caricaEventiPreferite(getPreferiti());

// main.js — punto di ingresso: tiene lo stato e collega gli eventi ai moduli.
// Nell'HTML c'è un solo <script type="module" src="assets/js/main.js">.
import { cercaSquadre, caricaEventi, caricaProssimi } from "./api.js";
import { getPreferiti, isPreferita, aggiungiPreferita, rimuoviPreferita } from "./preferiti.js";
import {
  mostraSpinner, nascondiSpinner, mostraErrore, nascondiErrore,
  renderRisultati, svuotaRisultati, renderPreferiti, mostraSezioneDettagli, renderDettagli,
  renderAppuntamenti,
} from "./ui.js";


// === Stato ===

let risultati = []; // ultime squadre trovate (istanze di Squadra)
const prossimiPerSquadra = new Map(); // idTeam → Evento[] delle preferite già caricate
const squadreFallite = new Set(); // idTeam delle preferite il cui caricamento è fallito

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

// Ridisegna le due griglie: la stella sui risultati dipende dai preferiti
function aggiornaGriglie() {
  if (risultati.length > 0) renderRisultati(risultati, isPreferita);
  renderPreferiti(getPreferiti());
}


// === Ricerca squadre (debounce + AbortController) ===

let controllerRicerca; // AbortController della ricerca in corso
let timeoutId; // timer del debounce

async function cerca(query) {
  controllerRicerca?.abort(); // annulla la ricerca precedente, se ancora in corso
  controllerRicerca = new AbortController();
  const { signal } = controllerRicerca;

  mostraSpinner("spinner-ricerca");
  nascondiErrore("errore-ricerca");

  try {
    risultati = await cercaSquadre(query, signal);
    renderRisultati(risultati, isPreferita);
  } catch (err) {
    if (err.name === "AbortError") return; // annullata da una ricerca più nuova: ignora
    risultati = [];
    svuotaRisultati();
    mostraErrore("errore-ricerca", `Errore nella ricerca: ${messaggioErrore(err)}`);
  } finally {
    // se è stata annullata, lo spinner serve alla ricerca nuova: non nasconderlo
    if (!signal.aborted) nascondiSpinner("spinner-ricerca");
  }
}

// Debounce: ogni tasto cancella il timer e ne parte uno nuovo;
// cerca() parte solo dopo 400ms senza digitazioni.
document.getElementById("cerca").addEventListener("input", (e) => {
  const query = e.target.value.trim();
  clearTimeout(timeoutId); // prima del controllo: cancella anche un timer partito con una query più lunga

  if (query.length < 3) {
    controllerRicerca?.abort(); // una fetch già partita non deve ripopolare la lista
    nascondiSpinner("spinner-ricerca");
    nascondiErrore("errore-ricerca");
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


// === Dettagli squadra (Promise.all + AbortController) ===

let controllerDettagli; // click veloci su due card: vince l'ultima

async function apriDettagli(squadra) {
  controllerDettagli?.abort();
  controllerDettagli = new AbortController();
  const { signal } = controllerDettagli;

  mostraSezioneDettagli(squadra);
  mostraSpinner("spinner-dettagli");
  nascondiErrore("errore-dettagli");

  try {
    renderDettagli(await caricaEventi(squadra.id, signal));
  } catch (err) {
    if (err.name === "AbortError") return;
    mostraErrore("errore-dettagli", `Errore nel caricamento degli eventi: ${messaggioErrore(err)}`);
  } finally {
    if (!signal.aborted) nascondiSpinner("spinner-dettagli");
  }
}


// === Prossimi appuntamenti delle preferite (Promise.allSettled) ===

// allSettled aspetta TUTTE le promesse, anche quelle rifiutate:
// una squadra che fallisce non blocca le altre (con Promise.all perderemmo tutto).
async function caricaAppuntamenti(squadre) {
  const esiti = await Promise.allSettled(squadre.map((s) => caricaProssimi(s.id)));

  // esiti è nello stesso ordine di squadre: l'indice i collega esito e squadra
  esiti.forEach((esito, i) => {
    const id = squadre[i].id;
    if (esito.status === "fulfilled") {
      prossimiPerSquadra.set(id, esito.value);
      squadreFallite.delete(id);
    } else {
      squadreFallite.add(id);
    }
  });
  mostraAppuntamenti();
}

// Unisce gli eventi delle preferite attuali, toglie i doppioni e li ordina per data
function mostraAppuntamenti() {
  const ids = getPreferiti().map((s) => s.id);

  // Map per idEvent: se due preferite giocano tra loro, la partita compare una volta sola
  const unici = new Map();
  ids.flatMap((id) => prossimiPerSquadra.get(id) ?? [])
    .forEach((evento) => unici.set(evento.id, evento));

  const ordinati = [...unici.values()].sort((a, b) =>
    a.chiaveOrdinamento().localeCompare(b.chiaveOrdinamento()),
  );

  const falliti = ids.filter((id) => squadreFallite.has(id)).length;
  renderAppuntamenti(ordinati, falliti);
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
    case "dettagli": // click sulla card → dettagli, anche dalle preferite (senza ricercarla)
      apriDettagli(squadra);
      break;
    case "preferito": // ★ funziona da interruttore
      if (isPreferita(id)) {
        rimuoviPreferita(id);
        mostraAppuntamenti(); // nessuna richiesta: basta ridisegnare senza quella squadra
      } else {
        aggiungiPreferita(squadra);
        caricaAppuntamenti([squadra]); // solo la nuova: le altre sono già in memoria
      }
      aggiornaGriglie();
      break;
    case "rimuovi":
      rimuoviPreferita(id);
      aggiornaGriglie();
      mostraAppuntamenti();
      break;
  }
}

document.getElementById("risultati").addEventListener("click", (e) => gestisciClickCard(e, risultati));
document.getElementById("preferiti").addEventListener("click", (e) => gestisciClickCard(e, getPreferiti()));


// === Avvio ===
// Nessuna squadra predefinita nella ricerca: si vedono solo le preferite salvate,
// e per tutte si caricano in parallelo i prossimi appuntamenti.

renderPreferiti(getPreferiti());
if (getPreferiti().length > 0) caricaAppuntamenti(getPreferiti());

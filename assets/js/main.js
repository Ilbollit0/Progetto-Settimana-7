// main.js — punto di ingresso: tiene lo stato e collega gli eventi ai moduli.
// Nell'HTML c'è un solo <script type="module" src="assets/js/main.js">.
import { cercaSquadre, caricaEventi } from "./api.js";
import { getPreferiti, isPreferita, aggiungiPreferita, rimuoviPreferita } from "./preferiti.js";
import {
  mostraSpinner, nascondiSpinner, mostraErrore, nascondiErrore,
  renderRisultati, svuotaRisultati, renderPreferiti, mostraSezioneDettagli, renderDettagli,
} from "./ui.js";


// === Stato ===

let risultati = []; // ultime squadre trovate (istanze di Squadra)

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
      if (isPreferita(id)) rimuoviPreferita(id);
      else aggiungiPreferita(squadra);
      aggiornaGriglie();
      break;
    case "rimuovi":
      rimuoviPreferita(id);
      aggiornaGriglie();
      break;
  }
}

document.getElementById("risultati").addEventListener("click", (e) => gestisciClickCard(e, risultati));
document.getElementById("preferiti").addEventListener("click", (e) => gestisciClickCard(e, getPreferiti()));


// === Avvio ===
// Nessuna squadra predefinita nella ricerca: si vedono solo le preferite salvate.

renderPreferiti(getPreferiti());

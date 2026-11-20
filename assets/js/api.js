// api.js — tutte le chiamate a TheSportsDB (solo GET, sola lettura).
import { Squadra, Evento } from "./classi.js";

// La barra finale serve: new URL("searchteams.php", BASE_URL) la usa come cartella
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123/";

// Helper: costruisce l'URL, fa la fetch, controlla ok e restituisce il JSON.
// signal (da un AbortController) permette di annullare la richiesta.
async function getJSON(percorso, parametri, signal) {
  // URL + searchParams: spazi, & e accenti vengono codificati
  const url = new URL(percorso, BASE_URL);
  for (const [chiave, valore] of Object.entries(parametri)) {
    url.searchParams.set(chiave, valore);
  }

  const r = await fetch(url, { signal });
  // 404/429/500 NON rifiutano la Promise: controllo manuale
  if (r.status === 429) {
    throw new Error("Troppe richieste (chiave gratuita: 30 al minuto). Riprova tra un minuto.");
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  // eventsnext.php, se non ci sono partite in programma, risponde 200 con corpo VUOTO
  // (non "{}"): r.json() andrebbe in errore. Leggiamo il testo e usiamo {} se è vuoto.
  const testo = await r.text();
  return testo ? JSON.parse(testo) : {};
}

// Quando non c'è nulla l'API non è coerente: null (teams), corpo vuoto (events)
// oppure stringa vuota "" (results). ?? non basta, perché "" non è null:
// Array.isArray copre tutti i casi.
function comeArray(valore) {
  return Array.isArray(valore) ? valore : [];
}

// searchteams.php?t=... → { teams: [...] } oppure { teams: null } se non trova nulla
export async function cercaSquadre(nome, signal) {
  const dati = await getJSON("searchteams.php", { t: nome }, signal);
  return comeArray(dati.teams).map((d) => new Squadra(d));
}

// eventsnext.php?id=... → { events: [...] }
// Esportata: main.js la usa da sola per gli appuntamenti delle preferite
export async function caricaProssimi(idTeam, signal) {
  const dati = await getJSON("eventsnext.php", { id: idTeam }, signal);
  return comeArray(dati.events).map((d) => new Evento(d));
}

// eventslast.php?id=... → { results: [...] } (qui la chiave si chiama "results")
async function caricaUltimi(idTeam, signal) {
  const dati = await getJSON("eventslast.php", { id: idTeam }, signal);
  return comeArray(dati.results).map((d) => new Evento(d));
}

// Le due chiamate partono insieme: il tempo totale è quello della più lenta.
// Se una fallisce, Promise.all rifiuta subito e finiamo nel catch del chiamante.
// Lo stesso signal annulla entrambe.
export async function caricaEventi(idTeam, signal) {
  const [prossimi, ultimi] = await Promise.all([
    caricaProssimi(idTeam, signal),
    caricaUltimi(idTeam, signal),
  ]);
  return { prossimi, ultimi };
}

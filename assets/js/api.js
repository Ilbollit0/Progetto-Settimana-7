// api.js — tutte le chiamate a TheSportsDB (solo GET, sola lettura),
// con la cache delle risposte e il blocco di 60 secondi dopo il limite di richieste.
import { Squadra, Evento } from "./classi.js";
import { leggi, scrivi, rimuovi } from "./storage.js";

// La barra finale serve: new URL("searchteams.php", BASE_URL) la usa come cartella
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123/";


// === Cache (sessionStorage, 10 minuti) ===
// La chiave gratuita permette 30 richieste al minuto: ripetere la stessa ricerca o
// riaprire la stessa squadra non deve consumarne altre. sessionStorage vale solo per
// la scheda e si svuota alla chiusura, così i dati non restano vecchi per giorni.

const PREFISSO_CACHE = "sportshub.cache:";
const DURATA_CACHE_MS = 10 * 60 * 1000;

function leggiCache(chiave) {
  const salvato = leggi(PREFISSO_CACHE + chiave, {}, "sessionStorage");
  if (!salvato.quando) return null;
  if (Date.now() - salvato.quando > DURATA_CACHE_MS) {
    rimuovi(PREFISSO_CACHE + chiave, "sessionStorage"); // scaduta: la togliamo
    return null;
  }
  return salvato.dati;
}

// Insieme ai dati salviamo l'ora, per sapere quando scadono
const scriviCache = (chiave, dati) => scrivi(PREFISSO_CACHE + chiave, { quando: Date.now(), dati }, "sessionStorage");


// === Blocco di 60 secondi dopo il limite di richieste ===
// Oltre il limite l'API risponde 429 e bisogna aspettare un minuto: nel frattempo non
// parte nulla. Nel browser il 429 arriva senza header CORS e fetch lo vede come errore
// di rete (TypeError): non potendoli distinguere, il blocco scatta per entrambi.

const CHIAVE_BLOCCO = "sportshub.bloccoFino";
let fineBlocco = leggi(CHIAVE_BLOCCO, 0, "sessionStorage"); // in sessionStorage: sopravvive al refresh
const ascoltatoriBlocco = []; // funzioni avvisate a ogni secondo del conto alla rovescia

const secondiRimasti = () => Math.max(0, Math.ceil((fineBlocco - Date.now()) / 1000));
const inBlocco = () => secondiRimasti() > 0;

// Registra una funzione che riceve i secondi rimasti (0 = blocco finito)
export const onCambioBlocco = (callback) => ascoltatoriBlocco.push(callback);

// Avvisa subito e poi ogni secondo; il setInterval si ferma da solo a fine blocco
function contoAllaRovescia() {
  const avvisa = () => ascoltatoriBlocco.forEach((callback) => callback(secondiRimasti()));
  avvisa();
  const id = setInterval(() => {
    avvisa();
    if (!inBlocco()) clearInterval(id);
  }, 1000);
}

function avviaBlocco() {
  if (inBlocco()) return; // già bloccati: non ripartiamo da 60
  fineBlocco = Date.now() + 60 * 1000;
  scrivi(CHIAVE_BLOCCO, fineBlocco, "sessionStorage");
  contoAllaRovescia();
}

// All'avvio, dopo aver registrato gli ascoltatori: riprende un blocco iniziato prima del refresh
export function riprendiBlocco() {
  if (inBlocco()) contoAllaRovescia();
}


// === Richieste ===

// Costruisce l'URL, risponde dalla cache se può, altrimenti scarica (signal = AbortController)
async function getJSON(percorso, parametri, signal) {
  const url = new URL(percorso, BASE_URL);
  url.search = new URLSearchParams(parametri); // codifica spazi, & e accenti

  // L'URL identifica la richiesta. In minuscolo: la ricerca dell'API non distingue
  // maiuscole (verificato: "arsenal", "ARSENAL", "Arsenal" → stessa squadra)
  const chiave = url.href.toLowerCase();
  const inCache = leggiCache(chiave);
  if (inCache) return inCache;

  // Durante il blocco non parte nulla. Niente numero nel testo: resterebbe fermo,
  // il conto alla rovescia è sul bottone Cerca
  if (inBlocco()) throw new Error("Troppe richieste. Attendi la fine del conto alla rovescia e riprova.");

  const dati = await scarica(url, signal);
  scriviCache(chiave, dati); // solo le risposte riuscite: con un errore qui non si arriva
  return dati;
}

// La vera chiamata di rete
async function scarica(url, signal) {
  let r;
  try {
    r = await fetch(url, { signal });
  } catch (err) {
    // AbortError = annullata da noi. TypeError = rete o 429 senza CORS: blocco
    if (err.name !== "AbortError") avviaBlocco();
    throw err;
  }

  // 404/429/500 NON rifiutano la Promise: controllo manuale
  if (r.status === 429) {
    avviaBlocco();
    throw new Error("Troppe richieste (chiave gratuita: 30 al minuto). Riprova tra un minuto.");
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  // eventsnext.php senza partite risponde 200 con corpo VUOTO: r.json() andrebbe in errore
  const testo = await r.text();
  return testo ? JSON.parse(testo) : {};
}

// Quando non c'è nulla l'API non è coerente: null (teams), corpo vuoto (events) o ""
// (results). ?? non basta, perché "" non è null: Array.isArray copre tutti i casi.
const comeArray = (valore) => (Array.isArray(valore) ? valore : []);

// searchteams.php?t=... → { teams: [...] } oppure { teams: null }
export async function cercaSquadre(nome, signal) {
  const dati = await getJSON("searchteams.php", { t: nome }, signal);
  return comeArray(dati.teams).map((d) => new Squadra(d));
}

// Una lista di partite: "chiave" è il nome dell'array nella risposta
async function caricaPartite(percorso, chiave, idTeam, signal) {
  const dati = await getJSON(percorso, { id: idTeam }, signal);
  return comeArray(dati[chiave]).map((d) => new Evento(d));
}

// Prossime e ultime in parallelo (tempo totale = la più lenta). Se una fallisce,
// Promise.all rifiuta subito; lo stesso signal annulla entrambe.
export async function caricaEventi(idTeam, signal) {
  const [prossimi, ultimi] = await Promise.all([
    caricaPartite("eventsnext.php", "events", idTeam, signal),
    caricaPartite("eventslast.php", "results", idTeam, signal), // qui l'array si chiama "results"
  ]);
  return { prossimi, ultimi };
}

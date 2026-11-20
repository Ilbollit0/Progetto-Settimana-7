// storage.js — tutto ciò che l'app salva nel browser: preferite e ricerche recenti
// (localStorage), più gli helper usati anche da api.js (cache, blocco) e dal tema.
import { Squadra } from "./classi.js";


// === Helper: lettura e scrittura sicure ===
// Lo storage può lanciare errori (navigazione privata, spazio pieno, dati rovinati a mano
// dai DevTools): in quei casi si usa il valore predefinito e l'app continua.
// area: "localStorage" (resta per sempre) o "sessionStorage" (solo questa scheda);
// come stringa, così l'accesso a window[area] avviene dentro il try.

// Il valore salvato, o "predefinito" se manca o non è dello stesso tipo
// (es. ci si aspetta un array e c'è un oggetto: meglio ripartire da zero)
export function leggi(chiave, predefinito, area = "localStorage") {
  try {
    const valore = JSON.parse(window[area].getItem(chiave));
    const stessoTipo = typeof valore === typeof predefinito && Array.isArray(valore) === Array.isArray(predefinito);
    return valore !== null && stessoTipo ? valore : predefinito;
  } catch {
    return predefinito;
  }
}

export function scrivi(chiave, valore, area = "localStorage") {
  try {
    window[area].setItem(chiave, JSON.stringify(valore)); // JSON.stringify usa toJSON() se c'è
  } catch {
    // storage pieno o bloccato: il dato vale finché la pagina resta aperta
  }
}

export function rimuovi(chiave, area = "localStorage") {
  try {
    window[area].removeItem(chiave); // removeItem, non clear: tocchiamo solo la nostra chiave
  } catch {
    // storage bloccato: niente da togliere
  }
}

// Sincronizzazione tra tab: l'evento "storage" scatta nelle ALTRE schede quando una
// modifica localStorage (mai in quella che scrive). key === null dopo localStorage.clear().
export function onCambioEsterno(chiave, callback) {
  window.addEventListener("storage", (e) => {
    if (e.key === chiave || e.key === null) callback();
  });
}


// === Preferite ===
// In storage ci sono i nomi dell'API (Squadra.toJSON): JSON.parse dà oggetti puri,
// "new Squadra(d)" li ritrasforma in istanze con i metodi.

const CHIAVE_PREFERITI = "sportshub.preferiti";
const caricaPreferiti = () => leggi(CHIAVE_PREFERITI, []).map((d) => new Squadra(d));
let preferiti = caricaPreferiti();

export const getPreferiti = () => preferiti;
export const isPreferita = (id) => preferiti.some((s) => s.id === id);

export function aggiungiPreferita(squadra) {
  if (isPreferita(squadra.id)) return; // niente doppioni
  preferiti.push(squadra);
  scrivi(CHIAVE_PREFERITI, preferiti);
}

export function rimuoviPreferita(id) {
  preferiti = preferiti.filter((s) => s.id !== id);
  scrivi(CHIAVE_PREFERITI, preferiti);
}

export function onCambioPreferiti(callback) {
  onCambioEsterno(CHIAVE_PREFERITI, () => {
    preferiti = caricaPreferiti();
    callback();
  });
}


// === Ricerche recenti ===
// Si salva il NOME DELLA SQUADRA TROVATA, non il testo digitato: col debounce
// la ricerca parte anche a parola incompleta ("Arse") e non vogliamo mezze parole.

const CHIAVE_RECENTI = "sportshub.recenti";
const MASSIMO_RECENTI = 5;
const caricaRecenti = () => leggi(CHIAVE_RECENTI, []).filter((x) => typeof x === "string");
let recenti = caricaRecenti();

export const getRecenti = () => recenti;

// La più recente in testa; se c'era già (anche con maiuscole diverse) si sposta
// invece di duplicarsi; oltre il massimo l'ultima esce.
export function aggiungiRecente(nome) {
  const pulito = nome.trim();
  if (!pulito) return;
  recenti = [pulito, ...recenti.filter((r) => r.toLowerCase() !== pulito.toLowerCase())].slice(0, MASSIMO_RECENTI);
  scrivi(CHIAVE_RECENTI, recenti);
}

export function svuotaRecenti() {
  recenti = [];
  rimuovi(CHIAVE_RECENTI);
}

export function onCambioRecenti(callback) {
  onCambioEsterno(CHIAVE_RECENTI, () => {
    recenti = caricaRecenti();
    callback();
  });
}

// preferiti.js — squadre preferite salvate in localStorage.
// Lo stato è privato del modulo: si legge e si modifica solo con le funzioni esportate.
import { Squadra } from "./classi.js";

const STORAGE_KEY = "sportshub.preferiti";

// getItem restituisce null se la chiave non esiste: ?? "[]" parte da un array vuoto.
// JSON.parse dà oggetti puri, senza metodi: li ritrasformiamo in istanze di Squadra.
function carica() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]").map((d) => new Squadra(d));
  } catch {
    return []; // JSON rovinato (es. modificato a mano dai DevTools): ripartiamo da zero
  }
}

// localStorage salva solo stringhe: JSON.stringify usa Squadra.toJSON()
function salva() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferiti));
}

let preferiti = carica();

export function getPreferiti() {
  return preferiti;
}

export function isPreferita(id) {
  return preferiti.some((s) => s.id === id);
}

export function aggiungiPreferita(squadra) {
  if (isPreferita(squadra.id)) return; // niente doppioni
  preferiti.push(squadra);
  salva();
}

export function rimuoviPreferita(id) {
  preferiti = preferiti.filter((s) => s.id !== id);
  salva();
}

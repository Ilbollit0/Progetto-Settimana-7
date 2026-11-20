// tema.js — tema chiaro/scuro con Bootstrap 5.3 (attributo data-bs-theme su <html>).
// Il tema iniziale lo imposta già lo script nell'<head>, prima del primo disegno.
import { icona } from "./ui.js";

const TEMA_KEY = "sportshub.tema";

// Il bottone mostra il tema in cui si passerà: sole nel tema scuro, luna nel chiaro
function aggiornaBottone(bottone, tema) {
  const scuro = tema === "dark";
  const etichetta = scuro ? "Passa al tema chiaro" : "Passa al tema scuro";
  bottone.replaceChildren(icona(scuro ? "sun-fill" : "moon-stars-fill"));
  bottone.setAttribute("aria-label", etichetta);
  bottone.title = etichetta;
}

export function initTema() {
  const html = document.documentElement;
  const bottone = document.getElementById("bottone-tema");
  aggiornaBottone(bottone, html.dataset.bsTheme);

  bottone.addEventListener("click", () => {
    const nuovo = html.dataset.bsTheme === "dark" ? "light" : "dark";
    html.dataset.bsTheme = nuovo; // Bootstrap ricalcola da solo tutti i suoi colori
    aggiornaBottone(bottone, nuovo);
    try {
      localStorage.setItem(TEMA_KEY, nuovo);
    } catch {
      // storage bloccato (es. navigazione privata): il tema vale solo per questa visita
    }
  });
}

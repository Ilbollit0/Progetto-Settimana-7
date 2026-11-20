// ui.js — tutto ciò che crea o modifica il DOM, compreso il tema chiaro/scuro.
// Dati da un'API esterna: createElement + textContent, mai innerHTML (rischio XSS).
import { leggi, scrivi, onCambioEsterno } from "./storage.js";


// === Helper ===

// Crea un elemento con classe, testo e proprietà (src, alt, href, type, ariaLabel...).
// textContent: il testo non viene mai interpretato come HTML.
// dataset va a parte: è un oggetto speciale, si copia con Object.assign.
function crea(tag, classe, testo, { dataset, ...proprieta } = {}) {
  const el = Object.assign(document.createElement(tag), proprieta);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  Object.assign(el.dataset, dataset);
  return el;
}

// Icona di Bootstrap Icons, decorativa: il significato lo porta il testo accanto
const icona = (nome) => crea("i", `bi bi-${nome}`, undefined, { ariaHidden: "true" });

// Aggiunge a un elemento un'icona seguita dal testo
function conIcona(el, nomeIcona, testo) {
  el.append(icona(nomeIcona), ` ${testo}`);
  return el;
}

const creaBottone = (classe, testo, proprieta = {}) => crea("button", classe, testo, { type: "button", ...proprieta });

// Bottone piccolo nel piede delle card squadra. btn-sopra: resta sopra lo
// stretched-link della card, altrimenti il click aprirebbe le partite.
const bottoneCard = (classe, azione, nomeIcona, testo, extra = {}) =>
  conIcona(creaBottone(`btn btn-sm btn-sopra ${classe}`, undefined, { dataset: { azione }, ...extra }), nomeIcona, testo);

// Nomi italiani dei valori di strSport. I primi tre sono le pillole fisse del filtro;
// gli altri sono valori visti nelle risposte dell'API (es. "Ice Hockey" per i Toronto
// Maple Leafs). Uno sport non in elenco si mostra col nome inglese dell'API.
const NOMI_SPORT = {
  Soccer: "Calcio",
  Basketball: "Basket",
  "American Football": "Football",
  "Ice Hockey": "Hockey su ghiaccio",
  Baseball: "Baseball",
  Rugby: "Rugby",
  Motorsport: "Motori",
};
const SPORT_FISSI = ["Soccer", "Basketball", "American Football"];

const nomeSport = (sport) => NOMI_SPORT[sport] ?? sport ?? "Sport sconosciuto";

// Filtro per sport: "tutti" oppure un valore di strSport (vale per squadre ed eventi)
export const filtra = (lista, filtro) => (filtro === "tutti" ? lista : lista.filter((x) => x.sport === filtro));

// Riempie una griglia .row: una colonna per elemento, oppure un messaggio se è vuota
function renderGriglia(id, lista, creaElemento, testoVuoto) {
  const vuota = crea("div", "col-12");
  vuota.append(crea("p", "text-body-secondary fst-italic mb-0", testoVuoto));
  document.getElementById(id).replaceChildren(...(lista.length > 0 ? lista.map(creaElemento) : [vuota]));
}


// === Stati visivi ===

export const mostra = (id) => (document.getElementById(id).hidden = false);
export const nascondi = (id) => (document.getElementById(id).hidden = true);

export function mostraErrore(id, msg) {
  document.getElementById(id).textContent = msg;
  mostra(id);
}

// Bottone Cerca durante il blocco: disattivato con il conto alla rovescia (0 = normale)
export function aggiornaBottoneCerca(secondi) {
  const bottone = document.getElementById("bottone-cerca");
  bottone.disabled = secondi > 0;
  bottone.replaceChildren();
  conIcona(bottone, secondi > 0 ? "hourglass-split" : "search", secondi > 0 ? `Riprova tra ${secondi}s` : "Cerca");
}


// === Tema chiaro/scuro (Bootstrap 5.3: attributo data-bs-theme su <html>) ===
// Il tema iniziale lo imposta già lo script nell'<head>, prima del primo disegno.

const CHIAVE_TEMA = "sportshub.tema";

// Applica il tema; il bottone mostra il tema in cui si passerà (sole nello scuro, luna nel chiaro)
function applicaTema(tema) {
  const scuro = tema === "dark";
  const bottone = document.getElementById("bottone-tema");
  document.documentElement.dataset.bsTheme = tema; // Bootstrap ricalcola da solo i colori
  bottone.replaceChildren(icona(scuro ? "sun-fill" : "moon-stars-fill"));
  bottone.ariaLabel = bottone.title = scuro ? "Passa al tema chiaro" : "Passa al tema scuro";
}

export function initTema() {
  applicaTema(document.documentElement.dataset.bsTheme);

  document.getElementById("bottone-tema").addEventListener("click", () => {
    const nuovo = document.documentElement.dataset.bsTheme === "dark" ? "light" : "dark";
    applicaTema(nuovo);
    scrivi(CHIAVE_TEMA, nuovo);
  });

  // Tema cambiato in un'altra scheda. Solo i due valori validi: localStorage si modifica a mano
  onCambioEsterno(CHIAVE_TEMA, () => {
    const tema = leggi(CHIAVE_TEMA, "");
    if (tema === "light" || tema === "dark") applicaTema(tema);
  });
}


// === Loghi ===

// Logo di una squadra; se l'API non lo fornisce, un cerchio con l'iniziale.
// alt vuoto quando il nome è già scritto accanto (il logo è solo decorativo).
const creaLogo = (src, nome, classe, alt = "") =>
  src
    ? crea("img", classe, undefined, { src, alt, loading: "lazy" })
    : crea("div", `${classe} logo-segnaposto`, nome?.[0] ?? "?", { ariaHidden: "true" });


// === Card squadra ===

// modalita: "risultato" → bottone cuore (preferiti); "preferito" → bottone Rimuovi
function creaCardSquadra(squadra, modalita, preferita) {
  const col = crea("div", "col", undefined, { dataset: { id: squadra.id } }); // per l'event delegation
  const card = crea("article", "card h-100 card-squadra");

  // Il colore sociale (strColour1) diventa la striscia in alto, solo se è davvero un esadecimale
  if (/^#[0-9a-f]{3,8}$/i.test(squadra.colore ?? "")) card.style.setProperty("--colore-squadra", squadra.colore);

  // Il nome è un <button> con stretched-link: il suo ::after copre tutta la card,
  // quindi "click sulla card" funziona anche da tastiera (Tab + Invio)
  const titolo = crea("h3", "card-title titolo-squadra mb-2");
  titolo.append(creaBottone("btn btn-link stretched-link p-0 text-reset text-decoration-none", squadra.nome, { dataset: { azione: "dettagli" } }));

  const corpo = crea("div", "card-body text-center");
  corpo.append(
    creaLogo(squadra.logo, squadra.nome, "logo-squadra mb-3", `Logo ${squadra.nome}`),
    titolo,
    crea("span", "badge rounded-pill badge-sport mb-2", nomeSport(squadra.sport)),
    crea("p", "card-text small mb-0", squadra.lega ?? "Campionato non disponibile"),
    crea("p", "card-text small text-body-secondary mb-0", squadra.paese ?? ""),
  );

  const piede = crea("div", "card-footer bg-transparent border-0 pb-3 d-flex gap-2");
  piede.append(
    bottoneCard("btn-outline-secondary", "info", "info-circle", "Info", { ariaLabel: `Informazioni su ${squadra.nome}` }),
    modalita === "preferito"
      ? bottoneCard("btn-outline-danger flex-grow-1", "rimuovi", "trash3", "Rimuovi", { ariaLabel: `Rimuovi ${squadra.nome} dai preferiti` })
      : bottoneCard(
          `flex-grow-1 ${preferita ? "btn-primary" : "btn-outline-primary"}`,
          "preferito",
          preferita ? "heart-fill" : "heart",
          preferita ? "Nei preferiti" : "Aggiungi ai preferiti",
          { ariaPressed: String(preferita) }, // annunciato come interruttore
        ),
  );

  card.append(corpo, piede);
  col.append(card);
  return col;
}

// isPreferita: funzione passata da main.js per sapere quale cuore mostrare
export function renderRisultati(squadre, filtro, isPreferita) {
  mostra("risultati-section");
  const visibili = filtra(squadre, filtro);

  // La ricerca ha trovato qualcosa ma il filtro lo nasconde (es. filtro Basket, l'API
  // restituisce una squadra di football): invece di sembrare "non trovata", diciamo
  // cosa è arrivato. Il bottone ha data-sport="tutti": lo gestisce il listener dei filtri.
  if (squadre.length > 0 && visibili.length === 0) {
    const box = crea("div", "col-12");
    box.append(
      crea("p", "mb-2", `Trovata ${squadre.map((s) => `${s.nome} (${nomeSport(s.sport)})`).join(", ")}, nascosta dal filtro ${nomeSport(filtro)}.`),
      creaBottone("btn btn-sm btn-primary rounded-pill", "Mostra tutti gli sport", { dataset: { sport: "tutti" } }),
    );
    document.getElementById("risultati").replaceChildren(box);
    return;
  }
  renderGriglia("risultati", visibili, (s) => creaCardSquadra(s, "risultato", isPreferita(s.id)), "Nessuna squadra trovata.");
}

export function svuotaRisultati() {
  document.getElementById("risultati").replaceChildren();
  nascondi("risultati-section");
}

export function renderPreferiti(squadre, filtro) {
  // Contatore sia nel titolo della sezione sia nel bottone della navbar
  document.getElementById("contatore-preferiti").textContent = squadre.length;
  document.getElementById("contatore-nav").textContent = squadre.length;
  renderGriglia(
    "preferiti",
    filtra(squadre, filtro),
    (s) => creaCardSquadra(s, "preferito"),
    squadre.length === 0 ? "Nessuna squadra salvata: cerca una squadra e premi il cuore." : "Nessuna preferita di questo sport.",
  );
}

// Pillole delle ricerche recenti nell'hero; il box si nasconde se la lista è vuota
export function renderRecenti(nomi) {
  document.getElementById("recenti-box").hidden = nomi.length === 0;
  document.getElementById("recenti").replaceChildren(...nomi.map((nome) =>
    creaBottone("btn btn-sm btn-outline-light rounded-pill", nome, { dataset: { ricerca: nome }, ariaLabel: `Cerca di nuovo ${nome}` }),
  ));
}

// Pillole del filtro: "Tutti" + i 3 sport fissi + gli altri sport presenti tra
// risultati e preferite, senza doppioni. Restituisce i filtri disponibili a main.js.
export function renderFiltri(sportPresenti, filtro) {
  const altri = [...new Set(sportPresenti)]
    .filter((s) => s && !SPORT_FISSI.includes(s))
    .sort((a, b) => nomeSport(a).localeCompare(nomeSport(b), "it"));
  const disponibili = ["tutti", ...SPORT_FISSI, ...altri];

  document.getElementById("filtri").replaceChildren(...disponibili.map((sport) =>
    creaBottone(
      `btn btn-outline-primary rounded-pill pillola${sport === filtro ? " active" : ""}`,
      sport === "tutti" ? "Tutti" : nomeSport(sport),
      { dataset: { sport }, ariaPressed: String(sport === filtro) },
    ),
  ));
  return disponibili;
}


// === Partite ===

// Casa | punteggio (o "vs") | trasferta: usata dalla card e dalla modale
function creaSfida(evento, classe) {
  const lato = (nome, badge) => {
    const el = crea("div", "lato-squadra");
    el.append(creaLogo(badge, nome, "logo-partita"), crea("span", "nome-partita", nome ?? "?"));
    return el;
  };
  const punteggio = evento.punteggio();
  const sfida = crea("div", `sfida ${classe}`);
  sfida.append(
    lato(evento.casa, evento.badgeCasa),
    crea("div", punteggio ? "punteggio" : "punteggio da-giocare", punteggio ?? "vs"),
    lato(evento.trasferta, evento.badgeTrasferta),
  );
  return sfida;
}

function creaCardPartita(evento) {
  const col = crea("div", "col", undefined, { dataset: { evento: evento.id } }); // per aprire la modale
  const card = crea("article", "card h-100 card-partita");

  // Il click col mouse su tutta la card lo gestisce l'event delegation (data-evento).
  // Questo bottone serve a tastiera e screen reader: invisibile finché non riceve il focus.
  const testa = crea("div", "card-header bg-transparent border-0 text-center pb-0");
  testa.append(
    creaBottone("btn btn-sm btn-primary visually-hidden-focusable mb-2", `Dettagli partita ${evento.casa} vs ${evento.trasferta}`),
    crea("span", "lega-partita d-block", evento.lega ?? nomeSport(evento.sport)),
  );

  // "oggi", "domani", "tra 3 settimane", "2 settimane fa"...: verde se è oggi o domani
  const quando = evento.tempoRelativo();
  if (quando) {
    const vicina = [0, 1].includes(evento.giorniDaOggi());
    testa.append(crea("span", `badge rounded-pill mt-1 ${vicina ? "text-bg-primary" : "badge-quando"}`, quando));
  }

  const ora = evento.oraBreve();
  const luogo = [evento.stadio, evento.paese].filter(Boolean).join(", ");
  const piede = crea("div", "card-footer bg-transparent text-center small text-body-secondary");
  piede.append(conIcona(crea("div"), "calendar-event", ora ? `${evento.dataFormattata()}, ore ${ora}` : evento.dataFormattata()));
  if (luogo) piede.append(conIcona(crea("div"), "geo-alt", luogo));

  card.append(testa, creaSfida(evento, "card-body"), piede);
  col.append(card);
  return col;
}

// Mostra la sezione partite con logo e nome, svuota le liste della squadra precedente
export function mostraSezioneDettagli(squadra) {
  mostra("dettagli-section");
  document.getElementById("dettagli-titolo").replaceChildren(creaLogo(squadra.logo, squadra.nome, "logo-dettagli"), crea("span", "", squadra.nome));
  document.getElementById("prossimi").replaceChildren();
  document.getElementById("ultimi").replaceChildren();
  document.getElementById("dettagli-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderDettagli({ prossimi, ultimi }) {
  renderGriglia("prossimi", prossimi, creaCardPartita, "Nessun evento in programma.");
  renderGriglia("ultimi", ultimi, creaCardPartita, "Nessun risultato disponibile.");
}

// Partite delle preferite; falliti = nomi delle preferite che non si sono caricate
export function renderEventiPreferite({ prossimi, ultimi, falliti, nessunaPreferita }) {
  document.getElementById("eventi-preferite-section").hidden = nessunaPreferita;
  if (nessunaPreferita) return;

  renderGriglia("appuntamenti", prossimi, creaCardPartita, "Nessun appuntamento in programma.");
  renderGriglia("ultimi-preferite", ultimi, creaCardPartita, "Nessun risultato disponibile.");

  const nota = document.getElementById("eventi-preferite-nota");
  nota.hidden = falliti.length === 0;
  nota.textContent = `Non è stato possibile caricare le partite di: ${falliti.join(", ")}. Riprova tra un minuto.`;
}


// === Modali (Bootstrap) ===

// "bootstrap" è globale: arriva da bootstrap.bundle.min.js caricato nell'HTML.
// getOrCreateInstance crea l'istanza la prima volta e poi la riusa.
const modale = (id) => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));

// Titolo, contenuto e apertura: uguale per le due modali.
// filter(Boolean) toglie i pezzi assenti (es. nessuna immagine → null).
function apriModale(id, titolo, contenuto) {
  document.getElementById(`${id}-titolo`).textContent = titolo;
  document.getElementById(`${id}-corpo`).replaceChildren(...contenuto.filter(Boolean));
  modale(id).show();
}

export const chiudiModaleSquadra = () => modale("modale-squadra").hide();

// Immagine larga in cima alla modale (decorativa: alt vuoto)
const immagine = (src) => src && crea("img", "img-fluid rounded mb-3 sfondo-modale", undefined, { src, alt: "" });

// Lista <dl> di coppie [etichetta, valore]; un valore mancante diventa "—"
function listaInfo(righe) {
  const dl = crea("dl", "row mb-3");
  righe.forEach(([etichetta, valore]) => dl.append(crea("dt", "col-5 col-sm-4", etichetta), crea("dd", "col-7 col-sm-8", valore || "—")));
  return dl;
}

// I link dell'API arrivano senza protocollo ("www.sscnapoli.it"): togliamo un eventuale
// http(s):// e mettiamo sempre https://. Così un valore strano (es. "javascript:...")
// diventa solo un indirizzo web innocuo. noopener: la pagina aperta non controlla la nostra.
const creaLink = (testo, valore, nomeIcona) =>
  valore &&
  conIcona(
    crea("a", "btn btn-sm btn-outline-primary rounded-pill", undefined, {
      href: `https://${valore.replace(/^https?:\/\//i, "")}`,
      target: "_blank",
      rel: "noopener noreferrer",
    }),
    nomeIcona,
    testo,
  );

export function apriModaleSquadra(squadra) {
  const descrizione = squadra.descrizione();
  const link = [
    creaLink("Sito ufficiale", squadra.sito, "globe2"),
    creaLink("Facebook", squadra.facebook, "facebook"),
    creaLink("X", squadra.twitter, "twitter-x"),
    creaLink("Instagram", squadra.instagram, "instagram"),
  ].filter(Boolean);
  const boxLink = crea("div", "d-flex flex-wrap gap-2");
  boxLink.append(...link);

  apriModale("modale-squadra", squadra.nome, [
    immagine(squadra.sfondo),
    listaInfo([
      ["Sport", nomeSport(squadra.sport)],
      ["Campionato", squadra.lega],
      ["Paese", squadra.paese],
      ["Stadio", squadra.stadio],
      ["Fondazione", squadra.fondazione],
    ]),
    descrizione && crea("h3", "sottotitolo-sezione", descrizione.lingua === "it" ? "Storia" : "Storia (in inglese)"),
    // I paragrafi dell'API sono separati da righe vuote ("\r\n\r\n")
    ...(descrizione?.testo.split(/\r?\n\s*\r?\n/) ?? []).map((p) => p.trim() && crea("p", "", p.trim())),
    link.length > 0 && crea("h3", "sottotitolo-sezione mt-2", "Link ufficiali"),
    link.length > 0 && boxLink,
  ]);
}

export function apriModaleEvento(evento) {
  const ora = evento.oraBreve();
  apriModale("modale-evento", evento.titolo ?? `${evento.casa} vs ${evento.trasferta}`, [
    immagine(evento.immagine),
    creaSfida(evento, "mb-4"),
    listaInfo([
      ["Stato", evento.statoLeggibile()],
      ["Quando", evento.tempoRelativo()],
      ["Data", evento.dataFormattata()],
      ["Orario", ora && `${ora} (orario fornito dall'API)`],
      ["Sport", nomeSport(evento.sport)],
      ["Campionato", evento.lega],
      ["Stagione", evento.stagione],
      ["Giornata", evento.giornata],
      ["Stadio", evento.stadio],
      ["Paese", evento.paese],
    ]),
    // Highlights solo se il link dell'API è un indirizzo https
    evento.video?.startsWith("https://") && creaLink("Guarda gli highlights", evento.video, "play-circle-fill"),
  ]);
}

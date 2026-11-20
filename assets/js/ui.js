// ui.js — tutto ciò che crea o modifica il DOM.
// Dati da un'API esterna: createElement + textContent, mai innerHTML (rischio XSS).


// === Helper ===

// Crea un elemento con una classe e un testo (textContent: niente HTML interpretato)
export function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

// Icona di Bootstrap Icons: <i class="bi bi-nome">. aria-hidden perché è decorativa:
// il significato lo porta il testo accanto (o l'aria-label del bottone).
export function icona(nome) {
  const i = crea("i", `bi bi-${nome}`);
  i.setAttribute("aria-hidden", "true");
  return i;
}

// Bottone con icona opzionale e data-azione per l'event delegation
function creaBottone(classe, testo, azione, nomeIcona) {
  const b = crea("button", classe);
  b.type = "button";
  if (azione) b.dataset.azione = azione;
  if (nomeIcona) b.append(icona(nomeIcona), " ");
  b.append(testo);
  return b;
}

// Riga di testo con icona davanti (data, luogo...)
function rigaConIcona(nomeIcona, testo) {
  const riga = crea("div");
  riga.append(icona(nomeIcona), ` ${testo}`);
  return riga;
}

// Nomi italiani per i valori di strSport usati nel filtro
const NOMI_SPORT = {
  Soccer: "Calcio",
  Basketball: "Basket",
  "American Football": "Football",
};

function nomeSport(sport) {
  return NOMI_SPORT[sport] ?? sport ?? "Sport sconosciuto";
}

// Filtro per sport: "tutti" oppure un valore di strSport (vale per squadre ed eventi)
export function filtra(lista, filtro) {
  return filtro === "tutti" ? lista : lista.filter((x) => x.sport === filtro);
}

// strColour1 arriva dall'API: lo usiamo come colore CSS solo se è davvero un esadecimale
function coloreValido(colore) {
  return /^#[0-9a-f]{3,8}$/i.test(colore ?? "") ? colore : null;
}

// Riempie una griglia .row: una colonna per elemento, oppure un messaggio se è vuota
function renderGriglia(id, lista, creaElemento, testoVuoto) {
  const griglia = document.getElementById(id);
  if (lista.length === 0) {
    const col = crea("div", "col-12");
    col.append(crea("p", "text-body-secondary fst-italic mb-0", testoVuoto));
    griglia.replaceChildren(col);
    return;
  }
  griglia.replaceChildren(...lista.map(creaElemento));
}


// === Stati visivi: spinner ed errore ===

export function mostra(id) {
  document.getElementById(id).hidden = false;
}

export function nascondi(id) {
  document.getElementById(id).hidden = true;
}

export function mostraErrore(id, msg) {
  document.getElementById(id).textContent = msg;
  mostra(id);
}


// === Loghi ===

// Logo di una squadra; se l'API non lo fornisce, un cerchio con l'iniziale.
// alt vuoto quando il nome è già scritto accanto (il logo è solo decorativo).
function creaLogo(src, nome, classe, alt = "") {
  if (src) {
    const img = crea("img", classe);
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    return img;
  }
  const segnaposto = crea("div", `${classe} logo-segnaposto`, nome?.[0] ?? "?");
  segnaposto.setAttribute("aria-hidden", "true");
  return segnaposto;
}


// === Card squadra ===

// modalita: "risultato" → bottone cuore (preferiti); "preferito" → bottone Rimuovi
function creaCardSquadra(squadra, modalita, preferita) {
  const col = crea("div", "col");
  col.dataset.id = squadra.id; // serve all'event delegation per ritrovare la squadra

  const card = crea("article", "card h-100 card-squadra");
  // Il colore sociale della squadra (strColour1) diventa la striscia in alto della card
  const colore = coloreValido(squadra.colore);
  if (colore) card.style.setProperty("--colore-squadra", colore);

  const corpo = crea("div", "card-body text-center");

  // Il nome è un <button> con stretched-link: il suo ::after copre tutta la card,
  // quindi "click sulla card" funziona anche da tastiera (Tab + Invio)
  const titolo = crea("h3", "card-title titolo-squadra mb-2");
  titolo.append(creaBottone("btn btn-link stretched-link p-0 text-reset text-decoration-none", squadra.nome, "dettagli"));

  corpo.append(
    creaLogo(squadra.logo, squadra.nome, "logo-squadra mb-3", `Logo ${squadra.nome}`),
    titolo,
    crea("span", "badge rounded-pill badge-sport mb-2", nomeSport(squadra.sport)),
    crea("p", "card-text small mb-0", squadra.lega ?? "Campionato non disponibile"),
    crea("p", "card-text small text-body-secondary mb-0", squadra.paese ?? ""),
  );

  // btn-sopra: i bottoni restano sopra lo stretched-link, altrimenti aprirebbero le partite
  const piede = crea("div", "card-footer bg-transparent border-0 pb-3 d-flex gap-2");

  const info = creaBottone("btn btn-sm btn-outline-secondary btn-sopra", "Info", "info", "info-circle");
  info.setAttribute("aria-label", `Informazioni su ${squadra.nome}`);

  let bottone;
  if (modalita === "preferito") {
    bottone = creaBottone("btn btn-sm btn-outline-danger btn-sopra flex-grow-1", "Rimuovi", "rimuovi", "trash3");
    bottone.setAttribute("aria-label", `Rimuovi ${squadra.nome} dai preferiti`);
  } else {
    bottone = creaBottone(
      `btn btn-sm btn-sopra flex-grow-1 ${preferita ? "btn-primary" : "btn-outline-primary"}`,
      preferita ? "Nei preferiti" : "Aggiungi ai preferiti",
      "preferito",
      preferita ? "heart-fill" : "heart",
    );
    bottone.setAttribute("aria-pressed", String(preferita)); // annunciato come interruttore
  }
  piede.append(info, bottone);

  card.append(corpo, piede);
  col.append(card);
  return col;
}

// isPreferita: funzione passata da main.js per sapere quale cuore mostrare
export function renderRisultati(squadre, filtro, isPreferita) {
  mostra("risultati-section");
  renderGriglia(
    "risultati",
    filtra(squadre, filtro),
    (s) => creaCardSquadra(s, "risultato", isPreferita(s.id)),
    squadre.length === 0 ? "Nessuna squadra trovata." : "Nessuna squadra di questo sport nei risultati.",
  );
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

// Evidenzia il bottone del filtro attivo
export function aggiornaFiltri(filtro) {
  document.querySelectorAll("#filtri [data-sport]").forEach((b) => {
    const attivo = b.dataset.sport === filtro;
    b.classList.toggle("active", attivo);
    b.setAttribute("aria-pressed", String(attivo));
  });
}


// === Card partita (dettagli, appuntamenti, ultimi risultati) ===

function creaLatoSquadra(nome, badge) {
  const lato = crea("div", "lato-squadra");
  lato.append(creaLogo(badge, nome, "logo-partita"), crea("span", "nome-partita", nome ?? "?"));
  return lato;
}

function creaCardPartita(evento) {
  const col = crea("div", "col");
  col.dataset.evento = evento.id; // serve all'event delegation per aprire la modale
  const card = crea("article", "card h-100 card-partita");

  // Il click col mouse su tutta la card lo gestisce l'event delegation (data-evento).
  // Questo bottone serve a tastiera e screen reader: invisibile finché non riceve il focus.
  const apri = creaBottone("btn btn-sm btn-primary visually-hidden-focusable mb-2", `Dettagli partita ${evento.casa} vs ${evento.trasferta}`);

  const testa = crea("div", "card-header bg-transparent border-0 text-center pb-0");
  testa.append(apri, crea("span", "lega-partita", evento.lega ?? nomeSport(evento.sport)));

  // Tre colonne: casa | punteggio (o "vs") | trasferta
  const corpo = crea("div", "card-body sfida");
  const punteggio = evento.punteggio();
  corpo.append(
    creaLatoSquadra(evento.casa, evento.badgeCasa),
    crea("div", punteggio ? "punteggio" : "punteggio da-giocare", punteggio ?? "vs"),
    creaLatoSquadra(evento.trasferta, evento.badgeTrasferta),
  );

  const piede = crea("div", "card-footer bg-transparent text-center small text-body-secondary");
  const ora = evento.oraBreve();
  piede.append(rigaConIcona("calendar-event", ora ? `${evento.dataFormattata()}, ore ${ora}` : evento.dataFormattata()));
  const luogo = [evento.stadio, evento.paese].filter(Boolean).join(", ");
  if (luogo) piede.append(rigaConIcona("geo-alt", luogo));

  card.append(testa, corpo, piede);
  col.append(card);
  return col;
}


// === Dettagli squadra: prossimi eventi e ultimi risultati ===

// Mostra la sezione con logo e nome, svuota le liste della squadra precedente
export function mostraSezioneDettagli(squadra) {
  mostra("dettagli-section");

  document.getElementById("dettagli-titolo").replaceChildren(
    creaLogo(squadra.logo, squadra.nome, "logo-dettagli"),
    crea("span", "", squadra.nome),
  );

  document.getElementById("prossimi").replaceChildren();
  document.getElementById("ultimi").replaceChildren();
  document.getElementById("dettagli-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderDettagli({ prossimi, ultimi }) {
  renderGriglia("prossimi", prossimi, creaCardPartita, "Nessun evento in programma.");
  renderGriglia("ultimi", ultimi, creaCardPartita, "Nessun risultato disponibile.");
}


// === Eventi delle preferite: prossimi appuntamenti e ultimi risultati ===

// falliti: nomi delle preferite che non si sono caricate
export function renderEventiPreferite({ prossimi, ultimi, falliti, nessunaPreferita }) {
  document.getElementById("eventi-preferite-section").hidden = nessunaPreferita;
  if (nessunaPreferita) return;

  renderGriglia("appuntamenti", prossimi, creaCardPartita, "Nessun appuntamento in programma.");
  renderGriglia("ultimi-preferite", ultimi, creaCardPartita, "Nessun risultato disponibile.");

  if (falliti.length > 0) {
    mostraErrore("eventi-preferite-nota", `Non è stato possibile caricare le partite di: ${falliti.join(", ")}. Riprova tra un minuto.`);
  } else {
    nascondi("eventi-preferite-nota");
  }
}


// === Modale "info squadra" (Bootstrap) ===

// I link dell'API arrivano senza protocollo ("www.sscnapoli.it"):
// togliamo un eventuale http(s):// e mettiamo sempre https://.
// Così un valore strano (es. "javascript:...") diventa solo un indirizzo web innocuo.
function creaLink(testo, valore, nomeIcona) {
  if (!valore) return null;
  const a = crea("a", "btn btn-sm btn-outline-primary rounded-pill");
  a.append(icona(nomeIcona), ` ${testo}`);
  a.href = `https://${valore.replace(/^https?:\/\//i, "")}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer"; // la pagina aperta non può controllare la nostra
  return a;
}

function rigaInfo(etichetta, valore) {
  const frammento = document.createDocumentFragment();
  frammento.append(crea("dt", "col-5 col-sm-4", etichetta), crea("dd", "col-7 col-sm-8", valore || "—"));
  return frammento;
}

// Bootstrap crea l'istanza della modale la prima volta e poi la riusa.
// "bootstrap" è globale: arriva da bootstrap.bundle.min.js caricato nell'HTML.
function modale(id) {
  return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
}

// Lista <dl> di coppie etichetta/valore, usata da entrambe le modali
function listaInfo(righe) {
  const dl = crea("dl", "row mb-3");
  righe.forEach(([etichetta, valore]) => dl.append(rigaInfo(etichetta, valore)));
  return dl;
}

// Immagine larga in cima alla modale (decorativa: alt vuoto)
function immagineModale(src) {
  const img = crea("img", "img-fluid rounded mb-3 sfondo-modale");
  img.src = src;
  img.alt = "";
  return img;
}

export function apriModaleSquadra(squadra) {
  document.getElementById("modale-squadra-titolo").textContent = squadra.nome;

  const contenuto = [];
  if (squadra.sfondo) contenuto.push(immagineModale(squadra.sfondo));

  contenuto.push(listaInfo([
    ["Sport", nomeSport(squadra.sport)],
    ["Campionato", squadra.lega],
    ["Paese", squadra.paese],
    ["Stadio", squadra.stadio],
    ["Fondazione", squadra.fondazione],
  ]));

  const descrizione = squadra.descrizione();
  if (descrizione) {
    contenuto.push(crea("h3", "sottotitolo-sezione", descrizione.lingua === "it" ? "Storia" : "Storia (in inglese)"));
    // I paragrafi dell'API sono separati da righe vuote ("\r\n\r\n")
    descrizione.testo.split(/\r?\n\s*\r?\n/).forEach((paragrafo) => {
      if (paragrafo.trim()) contenuto.push(crea("p", "", paragrafo.trim()));
    });
  }

  const link = [
    creaLink("Sito ufficiale", squadra.sito, "globe2"),
    creaLink("Facebook", squadra.facebook, "facebook"),
    creaLink("X", squadra.twitter, "twitter-x"),
    creaLink("Instagram", squadra.instagram, "instagram"),
  ].filter(Boolean);
  if (link.length > 0) {
    const box = crea("div", "d-flex flex-wrap gap-2");
    box.append(...link);
    contenuto.push(crea("h3", "sottotitolo-sezione mt-2", "Link ufficiali"), box);
  }

  document.getElementById("modale-squadra-corpo").replaceChildren(...contenuto);
  modale("modale-squadra").show();
}

export function chiudiModaleSquadra() {
  modale("modale-squadra").hide();
}


// === Modale "dettagli partita" ===

export function apriModaleEvento(evento) {
  document.getElementById("modale-evento-titolo").textContent = evento.titolo ?? `${evento.casa} vs ${evento.trasferta}`;

  const contenuto = [];
  if (evento.immagine) contenuto.push(immagineModale(evento.immagine));

  // Stessa sfida della card, in grande: casa | punteggio | trasferta
  const sfida = crea("div", "sfida mb-4");
  const punteggio = evento.punteggio();
  sfida.append(
    creaLatoSquadra(evento.casa, evento.badgeCasa),
    crea("div", punteggio ? "punteggio" : "punteggio da-giocare", punteggio ?? "vs"),
    creaLatoSquadra(evento.trasferta, evento.badgeTrasferta),
  );
  contenuto.push(sfida);

  const ora = evento.oraBreve();
  contenuto.push(listaInfo([
    ["Stato", evento.statoLeggibile()],
    ["Data", evento.dataFormattata()],
    ["Orario", ora ? `${ora} (orario fornito dall'API)` : ""],
    ["Sport", nomeSport(evento.sport)],
    ["Campionato", evento.lega],
    ["Stagione", evento.stagione],
    ["Giornata", evento.giornata],
    ["Stadio", evento.stadio],
    ["Paese", evento.paese],
  ]));

  // Link agli highlights solo se è un indirizzo https (arriva dall'API)
  if (evento.video?.startsWith("https://")) {
    contenuto.push(creaLink("Guarda gli highlights", evento.video, "play-circle-fill"));
  }

  document.getElementById("modale-evento-corpo").replaceChildren(...contenuto);
  modale("modale-evento").show();
}

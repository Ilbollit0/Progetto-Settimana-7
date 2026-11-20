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

// Nomi italiani per i valori di strSport più comuni
const NOMI_SPORT = {
  Soccer: "Calcio",
  Basketball: "Basket",
  "American Football": "Football americano",
};

function nomeSport(sport) {
  return NOMI_SPORT[sport] ?? sport ?? "Sport sconosciuto";
}


// === Stati visivi: spinner ed errore ===

export function mostraSpinner(id) {
  document.getElementById(id).hidden = false;
}

export function nascondiSpinner(id) {
  document.getElementById(id).hidden = true;
}

export function mostraErrore(id, msg) {
  const box = document.getElementById(id);
  box.textContent = msg;
  box.hidden = false;
}

export function nascondiErrore(id) {
  document.getElementById(id).hidden = true;
}


// === Card squadra ===

// Logo della squadra; se l'API non lo fornisce, un cerchio con l'iniziale.
// alt vuoto quando il nome è già scritto accanto (il logo è solo decorativo).
function creaLogo(squadra, classe, alt) {
  if (squadra.logo) {
    const img = crea("img", classe);
    img.src = squadra.logo;
    img.alt = alt;
    img.loading = "lazy";
    return img;
  }
  const segnaposto = crea("div", `${classe} logo-segnaposto`, squadra.nome?.[0] ?? "?");
  segnaposto.setAttribute("aria-hidden", "true");
  return segnaposto;
}

function creaBottone(classe, testo, azione) {
  const b = crea("button", classe, testo);
  b.type = "button";
  b.dataset.azione = azione;
  return b;
}

// Messaggio a tutta larghezza dentro una griglia .row
function messaggioGriglia(testo) {
  const col = crea("div", "col-12");
  col.append(crea("p", "text-body-secondary fst-italic mb-0", testo));
  return col;
}

// modalita: "risultato" → bottone ☆/★ preferiti; "preferito" → bottone Rimuovi
function creaCardSquadra(squadra, modalita, preferita) {
  const col = crea("div", "col");
  col.dataset.id = squadra.id; // serve all'event delegation per ritrovare la squadra

  const card = crea("article", "card h-100 card-squadra shadow-sm");
  const corpo = crea("div", "card-body text-center");

  // Il nome è un <button> con stretched-link: il suo ::after copre tutta la card,
  // quindi "click sulla card" funziona anche da tastiera (Tab + Invio)
  const titolo = crea("h3", "h5 card-title mb-1");
  const apri = creaBottone("btn btn-link stretched-link p-0 text-reset text-decoration-none fw-bold", squadra.nome, "dettagli");
  titolo.append(apri);

  corpo.append(
    creaLogo(squadra, "logo-squadra mb-3", `Logo ${squadra.nome}`),
    titolo,
    crea("span", "badge text-bg-secondary mb-2", nomeSport(squadra.sport)),
    crea("p", "card-text small mb-0", squadra.lega ?? "Campionato non disponibile"),
    crea("p", "card-text small text-body-secondary", squadra.paese ?? ""),
  );

  // btn-sopra: resta sopra lo stretched-link, altrimenti il click aprirebbe i dettagli
  const piede = crea("div", "card-footer bg-transparent border-0 pb-3 text-center");
  let bottone;
  if (modalita === "preferito") {
    bottone = creaBottone("btn btn-sm btn-outline-danger btn-sopra", "Rimuovi", "rimuovi");
    bottone.setAttribute("aria-label", `Rimuovi ${squadra.nome} dai preferiti`);
  } else {
    bottone = creaBottone(
      `btn btn-sm btn-sopra ${preferita ? "btn-warning" : "btn-outline-warning"}`,
      preferita ? "★ Nei preferiti" : "☆ Aggiungi ai preferiti",
      "preferito",
    );
    bottone.setAttribute("aria-pressed", String(preferita)); // annunciato come interruttore
  }
  piede.append(bottone);

  card.append(corpo, piede);
  col.append(card);
  return col;
}

// isPreferita: funzione passata da main.js per sapere quale stella mostrare
export function renderRisultati(squadre, isPreferita) {
  const griglia = document.getElementById("risultati");

  if (squadre.length === 0) {
    griglia.replaceChildren(messaggioGriglia("Nessuna squadra trovata."));
    return;
  }

  griglia.replaceChildren(...squadre.map((s) => creaCardSquadra(s, "risultato", isPreferita(s.id))));
}

export function renderPreferiti(squadre) {
  const griglia = document.getElementById("preferiti");
  document.getElementById("contatore-preferiti").textContent = squadre.length;

  if (squadre.length === 0) {
    griglia.replaceChildren(messaggioGriglia("Nessuna squadra salvata: usa ☆ su una card."));
    return;
  }

  griglia.replaceChildren(...squadre.map((s) => creaCardSquadra(s, "preferito")));
}

export function svuotaRisultati() {
  document.getElementById("risultati").replaceChildren();
}


// === Dettagli squadra: prossimi eventi e ultimi risultati ===

// conLega: negli appuntamenti ci sono squadre diverse, utile sapere il campionato
function creaRigaEvento(evento, conLega = false) {
  const li = crea("li", "list-group-item");

  const testa = crea("div", "d-flex justify-content-between align-items-center gap-2");
  testa.append(crea("small", "text-body-secondary", evento.dataFormattata()));
  const punteggio = evento.punteggio();
  if (punteggio) testa.append(crea("span", "badge text-bg-dark fs-6", punteggio));

  li.append(testa, crea("div", "fw-semibold", `${evento.casa} vs ${evento.trasferta}`));
  if (conLega && evento.lega) li.append(crea("small", "text-body-secondary", evento.lega));
  return li;
}

function riempiLista(id, eventi, testoVuoto, conLega = false) {
  const lista = document.getElementById(id);
  if (eventi.length === 0) {
    lista.replaceChildren(crea("li", "list-group-item text-body-secondary fst-italic", testoVuoto));
    return;
  }
  lista.replaceChildren(...eventi.map((e) => creaRigaEvento(e, conLega)));
}

// Mostra la sezione con logo e nome, svuota le liste della squadra precedente
export function mostraSezioneDettagli(squadra) {
  const sezione = document.getElementById("dettagli-section");
  sezione.hidden = false;

  document.getElementById("dettagli-titolo").replaceChildren(
    creaLogo(squadra, "logo-dettagli", ""),
    crea("span", "", squadra.nome),
  );

  document.getElementById("prossimi").replaceChildren();
  document.getElementById("ultimi").replaceChildren();
  sezione.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderDettagli({ prossimi, ultimi }) {
  riempiLista("prossimi", prossimi, "Nessun evento in programma.");
  riempiLista("ultimi", ultimi, "Nessun risultato disponibile.");
}


// === Prossimi appuntamenti delle preferite ===

// eventi: già ordinati per data; falliti: quante preferite non si sono caricate
export function renderAppuntamenti(eventi, falliti) {
  const sezione = document.getElementById("appuntamenti-section");
  // nessuna preferita (o nessun dato): la sezione resta nascosta
  sezione.hidden = eventi.length === 0 && falliti === 0;
  riempiLista("appuntamenti", eventi, "Nessun appuntamento in programma.", true);

  const nota = document.getElementById("appuntamenti-nota");
  nota.hidden = falliti === 0;
  nota.textContent = falliti === 1
    ? "1 squadra non è stata caricata: riprova più tardi."
    : `${falliti} squadre non sono state caricate: riprova più tardi.`;
}

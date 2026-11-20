// classi.js — Squadra ed Evento: trasformano i dati grezzi dell'API in oggetti nostri.
// I nomi dei campi dell'API (idTeam, strTeam, ...) devono combaciare con quelli di TheSportsDB.

// Copia i campi dell'API nell'oggetto secondo una tabella { nostroNome: "nomeAPI" }
function copiaCampi(oggetto, d, campi) {
  for (const [nostro, api] of Object.entries(campi)) oggetto[nostro] = d[api];
}


// === Squadra ===

// Una sola tabella per le due direzioni: API → Squadra (costruttore) e Squadra → API (toJSON)
const CAMPI_SQUADRA = {
  id: "idTeam",
  nome: "strTeam",
  logo: "strBadge", // può essere null o "": la UI mostra un segnaposto
  lega: "strLeague",
  paese: "strCountry",
  sport: "strSport",
  colore: "strColour1", // es. "#12A0D7"
  stadio: "strStadium",
  fondazione: "intFormedYear",
  sfondo: "strFanart1",
  descrizioneIT: "strDescriptionIT",
  descrizioneEN: "strDescriptionEN",
  sito: "strWebsite", // senza protocollo: "www.sscnapoli.it"
  facebook: "strFacebook",
  twitter: "strTwitter",
  instagram: "strInstagram",
};

export class Squadra {
  // d = un elemento dell'array "teams" di searchteams.php (o un preferito salvato)
  constructor(d) {
    copiaCampi(this, d, CAMPI_SQUADRA);
  }

  // Descrizione in italiano se c'è, altrimenti in inglese (o null)
  descrizione() {
    if (this.descrizioneIT) return { testo: this.descrizioneIT, lingua: "it" };
    return this.descrizioneEN ? { testo: this.descrizioneEN, lingua: "en" } : null;
  }

  // JSON.stringify chiama toJSON in automatico: in localStorage salviamo i nomi
  // dell'API, così al reload basta "new Squadra(d)"
  toJSON() {
    return Object.fromEntries(Object.entries(CAMPI_SQUADRA).map(([nostro, api]) => [api, this[nostro]]));
  }
}


// === Evento ===

const CAMPI_EVENTO = {
  id: "idEvent",
  titolo: "strEvent", // "Arsenal vs Hull City"
  data: "dateEvent", // "2026-11-21"
  ora: "strTime", // "17:30:00", così come la fornisce l'API
  lega: "strLeague",
  sport: "strSport",
  casa: "strHomeTeam",
  trasferta: "strAwayTeam",
  badgeCasa: "strHomeTeamBadge",
  badgeTrasferta: "strAwayTeamBadge",
  punteggioCasa: "intHomeScore", // null se la partita non è ancora giocata
  punteggioTrasferta: "intAwayScore",
  stadio: "strVenue",
  paese: "strCountry",
  stagione: "strSeason",
  giornata: "intRound",
  stato: "strStatus", // "NS" = non iniziata, "FT" = finita (valori visti nelle risposte)
  immagine: "strThumb",
  video: "strVideo", // link YouTube agli highlights, se c'è
};

const STATI = { NS: "Da giocare", FT: "Terminata" };

// Formatter creati una volta sola e riusati (crearli costa).
// numeric: "auto" → "oggi", "domani", "ieri" invece di "tra 0 giorni", "tra 1 giorno"...
const formatoData = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const formatoRelativo = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
const GIORNO_MS = 24 * 60 * 60 * 1000;

export class Evento {
  // d = un elemento di "events" (eventsnext.php) o di "results" (eventslast.php)
  constructor(d) {
    copiaCampi(this, d, CAMPI_EVENTO);
    this.rinviata = d.strPostponed === "yes";
  }

  // Codice di strStatus tradotto; uno sconosciuto si mostra così com'è
  statoLeggibile() {
    if (this.rinviata) return "Rinviata";
    return STATI[this.stato] ?? this.stato ?? (this.punteggio() ? "Terminata" : "Da giocare");
  }

  // "2026-11-21" → "sab 21 nov 2026". Con T00:00:00 la data è nel fuso locale (senza, UTC)
  dataFormattata() {
    return this.data ? formatoData.format(new Date(`${this.data}T00:00:00`)) : "Data non disponibile";
  }

  // Giorni da oggi: 0 = oggi, 1 = domani, -1 = ieri, null se manca la data.
  // Confronta due mezzanotti locali (l'ora attuale non sposta il conto);
  // Math.round assorbe l'ora in più/in meno del cambio ora legale.
  giorniDaOggi(oggi = new Date()) {
    if (!this.data) return null;
    const mezzanotte = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    return Math.round((new Date(`${this.data}T00:00:00`) - mezzanotte) / GIORNO_MS);
  }

  // "oggi", "domani", "dopodomani", "tra 3 settimane", "2 settimane fa", "tra 3 mesi"...
  // Sotto la settimana si contano i giorni, sotto il mese le settimane, poi i mesi.
  tempoRelativo(oggi = new Date()) {
    const giorni = this.giorniDaOggi(oggi);
    if (giorni === null) return "";
    if (Math.abs(giorni) < 7) return formatoRelativo.format(giorni, "day");
    if (Math.abs(giorni) < 30) return formatoRelativo.format(Math.round(giorni / 7), "week");
    return formatoRelativo.format(Math.round(giorni / 30), "month");
  }

  // "17:30:00" → "17:30"
  oraBreve() {
    return this.ora?.slice(0, 5) ?? "";
  }

  // "1 - 0", oppure null se non c'è punteggio (== null copre null e undefined)
  punteggio() {
    if (this.punteggioCasa == null || this.punteggioTrasferta == null) return null;
    return `${this.punteggioCasa} - ${this.punteggioTrasferta}`;
  }

  // "2026-11-21 17:30:00": in formato ISO l'ordine alfabetico coincide con quello temporale
  chiaveOrdinamento() {
    return `${this.data ?? ""} ${this.ora ?? ""}`;
  }
}

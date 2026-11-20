// classi.js — Squadra ed Evento: trasformano i dati grezzi dell'API in oggetti nostri.
// I nomi dei campi letti (idTeam, strTeam, ...) devono combaciare con quelli di TheSportsDB.


// === Squadra ===

export class Squadra {
  // d = un elemento dell'array "teams" restituito da searchteams.php
  constructor(d) {
    this.id = d.idTeam;
    this.nome = d.strTeam;
    this.logo = d.strBadge; // può essere null o "": la UI mostra un segnaposto
    this.lega = d.strLeague;
    this.paese = d.strCountry;
    this.sport = d.strSport;

    // Dati in più per la modale "info squadra"
    this.colore = d.strColour1; // es. "#12A0D7"
    this.stadio = d.strStadium;
    this.fondazione = d.intFormedYear;
    this.sfondo = d.strFanart1;
    this.descrizioneIT = d.strDescriptionIT;
    this.descrizioneEN = d.strDescriptionEN;
    this.sito = d.strWebsite; // senza protocollo: "www.sscnapoli.it"
    this.facebook = d.strFacebook;
    this.twitter = d.strTwitter;
    this.instagram = d.strInstagram;
  }

  // Descrizione in italiano se c'è, altrimenti in inglese (o null)
  descrizione() {
    if (this.descrizioneIT) return { testo: this.descrizioneIT, lingua: "it" };
    if (this.descrizioneEN) return { testo: this.descrizioneEN, lingua: "en" };
    return null;
  }

  // JSON.stringify chiama toJSON in automatico: in localStorage salviamo
  // gli stessi nomi dell'API, così al reload basta "new Squadra(d)".
  toJSON() {
    return {
      idTeam: this.id,
      strTeam: this.nome,
      strBadge: this.logo,
      strLeague: this.lega,
      strCountry: this.paese,
      strSport: this.sport,
      strColour1: this.colore,
      strStadium: this.stadio,
      intFormedYear: this.fondazione,
      strFanart1: this.sfondo,
      strDescriptionIT: this.descrizioneIT,
      strDescriptionEN: this.descrizioneEN,
      strWebsite: this.sito,
      strFacebook: this.facebook,
      strTwitter: this.twitter,
      strInstagram: this.instagram,
    };
  }
}


// === Evento ===

// Un solo formatter riusato per tutti gli eventi (crearlo costa)
const formatoData = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export class Evento {
  // d = un elemento di "events" (eventsnext.php) o di "results" (eventslast.php)
  constructor(d) {
    this.id = d.idEvent;
    this.data = d.dateEvent; // "2026-11-21"
    this.ora = d.strTime; // "17:30:00" (come la fornisce l'API)
    this.lega = d.strLeague;
    this.sport = d.strSport;
    this.casa = d.strHomeTeam;
    this.trasferta = d.strAwayTeam;
    this.badgeCasa = d.strHomeTeamBadge;
    this.badgeTrasferta = d.strAwayTeamBadge;
    this.punteggioCasa = d.intHomeScore; // null se la partita non è ancora giocata
    this.punteggioTrasferta = d.intAwayScore;
    this.stadio = d.strVenue;
    this.paese = d.strCountry;

    // Dati in più per la modale "dettagli partita"
    this.titolo = d.strEvent; // "Arsenal vs Hull City"
    this.stagione = d.strSeason;
    this.giornata = d.intRound;
    this.stato = d.strStatus; // "NS" = non iniziata, "FT" = finita (valori visti nelle risposte)
    this.rinviata = d.strPostponed === "yes";
    this.immagine = d.strThumb;
    this.video = d.strVideo; // link YouTube agli highlights, se c'è
  }

  // Codici di strStatus tradotti; un codice che non conosciamo lo mostriamo così com'è
  statoLeggibile() {
    if (this.rinviata) return "Rinviata";
    const STATI = { NS: "Da giocare", FT: "Terminata" };
    return STATI[this.stato] ?? this.stato ?? (this.punteggio() ? "Terminata" : "Da giocare");
  }

  // "2026-11-21" → "sab 21 nov 2026".
  // Con T00:00:00 la data è letta nel fuso locale (senza, sarebbe UTC).
  dataFormattata() {
    if (!this.data) return "Data non disponibile";
    return formatoData.format(new Date(`${this.data}T00:00:00`));
  }

  // "17:30:00" → "17:30" (orario così come lo fornisce l'API)
  oraBreve() {
    return this.ora ? this.ora.slice(0, 5) : "";
  }

  // "1 - 0", oppure null se non c'è punteggio (partita futura).
  // == null copre sia null sia undefined.
  punteggio() {
    if (this.punteggioCasa == null || this.punteggioTrasferta == null) return null;
    return `${this.punteggioCasa} - ${this.punteggioTrasferta}`;
  }

  // Chiave per l'ordine cronologico: "2026-11-21 17:30:00".
  // Date e ore in formato ISO: l'ordine alfabetico coincide con quello temporale.
  chiaveOrdinamento() {
    return `${this.data ?? ""} ${this.ora ?? ""}`;
  }
}

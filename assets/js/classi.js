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
    };
  }
}


// === Evento ===

// Un solo formatter riusato per tutti gli eventi (crearlo costa)
const formatoData = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export class Evento {
  // d = un elemento di "events" (eventsnext.php) o di "results" (eventslast.php)
  constructor(d) {
    this.id = d.idEvent;
    this.data = d.dateEvent; // "2026-11-21"
    this.casa = d.strHomeTeam;
    this.trasferta = d.strAwayTeam;
    this.punteggioCasa = d.intHomeScore; // null se la partita non è ancora giocata
    this.punteggioTrasferta = d.intAwayScore;
  }

  // "2026-11-21" → "sab 21 novembre 2026".
  // Con T00:00:00 la data è letta nel fuso locale (senza, sarebbe UTC).
  dataFormattata() {
    if (!this.data) return "Data non disponibile";
    return formatoData.format(new Date(`${this.data}T00:00:00`));
  }

  // "1 - 0", oppure null se non c'è punteggio (partita futura).
  // == null copre sia null sia undefined.
  punteggio() {
    if (this.punteggioCasa == null || this.punteggioTrasferta == null) return null;
    return `${this.punteggioCasa} - ${this.punteggioTrasferta}`;
  }
}

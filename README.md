# SportsHub — Week Project Settimana VII

Mini web app responsive per cercare squadre sportive (calcio, basket, football americano),
vedere prossime partite e ultimi risultati e salvare le squadre preferite.
I dati arrivano dall'API pubblica di [TheSportsDB](https://www.thesportsdb.com/documentation),
usata in **sola lettura** (solo richieste GET).

Realizzata con **HTML, CSS, JavaScript (moduli ES)** e **Bootstrap 5.3**, senza `innerHTML`:
tutto il contenuto dinamico è creato con `createElement` e `textContent`.

---

## Come avviarlo

1. Clona o scarica la cartella.
2. Apri `index.html` con **Live Server** (VS Code) o un altro server locale.

> Il JavaScript è diviso in moduli ES (`<script type="module">`): aperti con doppio clic
> (`file://`) il browser li blocca, per questo serve un server.

## Struttura

```
.
├── index.html              # markup Bootstrap: navbar, hero con ricerca, sezioni, modali
├── assets/
│   ├── css/
│   │   └── style.css       # tema verde/panna, campo da calcio in CSS, card, icone
│   └── js/
│       ├── main.js         # punto di ingresso: stato, eventi, torna indietro
│       ├── api.js          # chiamate a TheSportsDB + cache (10 min) + blocco del limite (60 s)
│       ├── classi.js       # class Squadra e class Evento
│       ├── ui.js           # tutto il DOM: card, griglie, filtri, modali, tema
│       └── storage.js      # localStorage/sessionStorage: preferite, ricerche recenti, helper
└── README.md
```

Librerie da CDN: Bootstrap 5.3.3 (CSS + JS per modali e collapse), Bootstrap Icons 1.11.3,
Google Fonts (Oswald per i titoli, Barlow per il testo).

---

## API: endpoint e risposte (verificate il 20/11/2026)

Base: `https://www.thesportsdb.com/api/v1/json/123/` (chiave gratuita `123`)

| Endpoint | Risposta |
| --- | --- |
| `searchteams.php?t=Arsenal` | `{ "teams": [ {...} ] }` con **una sola squadra** |
| `searchteams.php?t=nomeinesistente` | `{ "teams": null }` |
| `eventsnext.php?id=133604` | `{ "events": [ {...} ] }` con **una sola partita** |
| `eventslast.php?id=133604` | `{ "results": [ {...} ] }`: la chiave è `results`, non `events` |
| `eventsnext.php` di una squadra senza partite | HTTP 200 con **corpo vuoto** (non è JSON) |
| `eventslast.php` di una squadra senza partite | `{ "results": "" }`: **stringa vuota**, non array |
| oltre il limite di richieste | HTTP **429** (`error code: 1015`), **senza header CORS** |

Limiti della chiave gratuita, dalla documentazione: **30 richieste al minuto**,
ricerca con un solo risultato, eventi con un solo risultato e "solo partite in casa".

### Come l'app gestisce le risposte strane

- **Corpo vuoto**: si legge con `r.text()` e si usa `{}` se è vuoto, perché `r.json()` andrebbe in errore.
- **`null` o `""` al posto dell'array**: `Array.isArray()` li trasforma in `[]` (`?? []` non basta per `""`).
- **429 senza CORS**: nel browser `fetch` lo vede come errore di rete (`TypeError`),
  quindi l'app non può distinguerli e avvia il blocco di 60 secondi in entrambi i casi.
- La ricerca **non distingue le maiuscole** ("arsenal", "ARSENAL" e "Arsenal" danno la stessa squadra):
  la chiave della cache è in minuscolo.
- **Altri sport**: la ricerca trova anche squadre di hockey su ghiaccio (Toronto Maple Leafs → NHL),
  baseball (New York Yankees → MLB) e rugby (Leinster). L'elenco ufficiale `all_sports.php`, con la
  chiave gratuita, restituisce solo 2 sport: per questo le pillole del filtro si creano dagli sport
  delle squadre trovate o salvate.

### Campi usati

- **Squadra**: `idTeam`, `strTeam`, `strBadge`, `strLeague`, `strCountry`, `strSport`
  e, per la modale, `strColour1`, `strStadium`, `intFormedYear`, `strFanart1`,
  `strDescriptionIT`/`EN`, `strWebsite`, `strFacebook`, `strTwitter`, `strInstagram`.
- **Evento**: `idEvent`, `dateEvent`, `strTime`, `strHomeTeam`, `strAwayTeam`,
  `intHomeScore`, `intAwayScore`, `strHomeTeamBadge`, `strAwayTeamBadge`, `strLeague`,
  `strSport`, `strVenue`, `strCountry` e, per la modale, `strEvent`, `strSeason`,
  `intRound`, `strStatus`, `strPostponed`, `strThumb`, `strVideo`.

---

## Funzionalità

### Versione base
- [x] Pagina responsive con Bootstrap: griglia da 1 colonna (mobile) a 2 (tablet) e 3–4 (desktop).
- [x] Ricerca squadre con `fetch` + `async/await` + `try/catch`, URL costruito con `new URL()` e `searchParams`.
- [x] Ricerca sia con il bottone **Cerca** sia digitando (debounce).
- [x] Spinner durante il caricamento, alert rosso in caso di errore.
- [x] Card con logo, nome, sport, campionato e paese; "Nessuna squadra trovata" se `teams` è `null`.
- [x] Click su una card: prossimi eventi e ultimi risultati caricati **in parallelo** con `Promise.all`.
- [x] All'avvio nessuna squadra predefinita.

### Versione intermedia
- [x] Preferite con il bottone a cuore, salvate in `localStorage` (con i nomi dei campi dell'API).
- [x] Sezione **Le tue squadre** con bottone Rimuovi; click su una preferita carica le partite senza ricercarla.
- [x] **Debounce** di 400 ms sulla digitazione.
- [x] **AbortController**: una nuova ricerca annulla quella in corso (anche per le partite).

### Versione avanzata
- [x] All'avvio partite di tutte le preferite con `Promise.allSettled`: una squadra che fallisce non blocca le altre.
- [x] **I tuoi prossimi appuntamenti** in ordine cronologico e **Ultimi risultati delle tue squadre** dal più recente, senza doppioni.
- [x] **Filtro per sport** (Tutti / Calcio / Basket / Football) sul campo `strSport`: vale per card e partite.
      Se tra risultati o preferite c'è un altro sport (es. Hockey su ghiaccio) compare la sua pillola;
      se lo sport filtrato sparisce, il filtro torna su "Tutti".
- [x] **Modale partita**: immagine, punteggio, stato, data, stagione, giornata, stadio, link agli highlights.
- [x] **JavaScript modulare**: 5 moduli ES con un solo `<script type="module">`.

### Extra
- [x] **Torna indietro**: bottone su risultati e partite, e anche il tasto Indietro del browser
      (o il gesto sul telefono) riporta alla pagina iniziale, con `history.pushState` e `popstate`.
      Le preferite aggiunte durante la ricerca restano.
- [x] **Modale squadra**: foto, stadio, anno di fondazione, storia in italiano, link ufficiali.
- [x] **Tema chiaro (panna) / scuro**, salvato e applicato prima del primo disegno, con cambio sfumato.
- [x] **Cache** delle risposte in `sessionStorage` per 10 minuti: la stessa richiesta non consuma il limite.
- [x] **Blocco di 60 secondi** dopo il limite di richieste, con conto alla rovescia sul bottone Cerca;
      a fine blocco le preferite non caricate si riprovano da sole.
- [x] **Ricerche recenti**: ultime 5 squadre trovate come pillole cliccabili.
- [x] **Sincronizzazione tra tab** (evento `storage`) di preferite, ricerche recenti e tema.
- [x] **"Tra 2 giorni"**: tempo relativo su ogni partita con `Intl.RelativeTimeFormat`.
- [x] Colore sociale della squadra (`strColour1`) come striscia in alto nella card.
- [x] Accessibilità: card usabili da tastiera, `aria-pressed` sui bottoni interruttore,
      `aria-live` sui risultati, link "Vai al contenuto", `prefers-reduced-motion`.

---

## Concetti JavaScript usati

| Concetto | Dove |
| --- | --- |
| `class`, `constructor`, metodi | `Squadra`, `Evento` |
| `toJSON()` chiamato da `JSON.stringify` | `Squadra` salvata con i nomi dell'API |
| `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` | `Evento.dataFormattata()`, `Evento.tempoRelativo()` |
| `fetch`, `async/await`, `try/catch/finally` | `api.js`, `main.js` |
| `new URL()` + `searchParams` | `getJSON()` in `api.js` |
| `Promise.all` / `Promise.allSettled` | partite di una squadra / partite delle preferite |
| `AbortController` + debounce con `setTimeout` | ricerca e partite |
| Closure | `creaCaricatore()`: ogni caricatore ha il suo `AbortController` |
| `setInterval` / `clearInterval` | conto alla rovescia del blocco in `api.js` |
| `history.pushState`, evento `popstate` | torna indietro con il tasto del browser |
| Tabella di mappatura + `Object.fromEntries` | `Squadra`: stessi campi per costruttore e `toJSON()` |
| `localStorage`, `sessionStorage`, evento `storage` | preferite e recenti / cache e blocco / sincronizzazione |
| Event delegation con `closest()` e `data-*` | card squadra, card partita, filtri, recenti |
| `Map`, `Set`, `flatMap`, `sort`, `localeCompare` | partite ordinate e senza doppioni |
| Moduli ES: `export` / `import` | tutti i file in `assets/js/` |
| DOM sicuro: `createElement`, `textContent`, `replaceChildren` | `ui.js` (nessun `innerHTML`) |

---

## Note

- L'**orario** delle partite è mostrato così come lo fornisce l'API (`strTime`).
- Con la chiave gratuita la ricerca restituisce **un solo risultato**, e con i nomi corti spesso
  è un'altra squadra: "Lakers" → Roosevelt (football NCAA), "Celtics" → Maine Celtics (NBA G League).
  Con il nome completo funziona: "Los Angeles Lakers", "Boston Celtics", "Chicago Bulls", "Olimpia Milano".
  L'app lo suggerisce sotto i risultati e, se il filtro nasconde la squadra trovata, dice quale è
  con un bottone "Mostra tutti gli sport". Gli elenchi per campionato (`search_all_teams.php`)
  con la chiave gratuita si fermano alle prime 10 squadre, quindi non aiutano.
- La documentazione dice "solo partite in casa", ma per Arsenal `eventsnext` ha restituito
  anche una trasferta (Newcastle United vs Arsenal): l'app mostra quello che arriva.

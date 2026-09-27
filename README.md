# 🍸 Barback

Gestionale web per bar e ristoranti: **magazzino bevande** + **turni del personale**, in un'unica app pensata per il telefono.

---

## Cosa fa

| Sezione | A cosa serve |
|---|---|
| **Conteggio vuoti** | Registra le bottiglie consumate (manuale, da scontrino o da giacenza), vista giorno/mese e griglia mensile prodotto × giorno. Scala la giacenza in tempo reale. |
| **Turni & Task** | Griglia turni giorno/settimana/mese e task giornaliere spuntabili. Export CSV ed Excel. |
| **Ferie e permessi** | Chi lavora chiede ferie, permessi o cambi turno indicando periodo e motivo. Chi gestisce approva o rifiuta, e **vede quali turni resterebbero scoperti** in quei giorni. |
| **Drink Cost** | Costo reale di ogni cocktail calcolato dalla ricetta in ml risalendo al costo/ml delle bottiglie, con **pour cost %** sul prezzo di vendita. |
| **Magazzino & Giacenze** | Carico/scarico rapido, report mensile entrato / uscito / netto / consumato / residua, alert sotto soglia, ricerca e export. |
| **Ordini ai fornitori** | Ogni prodotto ha una soglia e una **scorta ideale**: quando scende, l'app calcola quanto ordinare e raggruppa tutto per fornitore. L'ordine si copia come testo, si manda su **WhatsApp** con un tocco, o si esporta. |
| **Manuale dipendente** | Regole del locale (HACCP, divisa, alcolici ai maggiorenni…) e ricettario cocktail con ingredienti e preparazione. |

## Profili e permessi

L'accesso è a **PIN** e genera un token valido 12 ore. I permessi sono *capacità* assegnate al profilo, non ruoli rigidi: ogni rotta dell'API controlla la capacità che le serve.

| Profilo | PIN demo | Permessi |
|---|---|---|
| Proprietario | `1111` | `all` — tutto, approvazione ferie inclusa |
| Admin 1 · Responsabile | `2222` | gestione turni e task, visualizza ferie |
| Admin 2 · Barman | `3333` | vuoti, spunta task, richiede ferie, manuale |
| Admin 3 · Bar Manager | `4444` | vuoti, carico, magazzino, drink cost, manuale |

> ⚠️ **Questi sono i PIN della demo.** Cambiali dall’app stessa: bottone **⚙** in alto a destra → *Il tuo PIN*. Il proprietario può anche reimpostare i PIN degli altri e creare nuovi profili.

## Come si avvia in locale

Serve **Node 24 o superiore** (l'app usa il modulo SQLite nativo, ancora sperimentale).

```bash
npm install
npm start
```

Poi apri <http://localhost:3100>.

Dal telefono puoi **installarla come app**: apri il link nel browser e scegli "Aggiungi a schermata Home". Si apre a schermo pieno, con la sua icona, senza passare da App Store (serve un indirizzo **https**).

Su Windows il modo piu' rapido e' la scorciatoia **Barback** sul Desktop, creata da `BARBACK.cmd`: accende il server se e' spento e apre l'app in una finestra sua, senza barra del browser.

In alternativa, doppio click su **AVVIA.cmd**: usa il Node portatile in `.tools` e non richiede installazioni. Con **AVVIA-E-CONDIVIDI.cmd** genera anche un link temporaneo da mandare a qualcuno per una prova al volo. Istruzioni senza gergo in [ISTRUZIONI.txt](ISTRUZIONI.txt).

Al primo avvio il database si popola da solo con dati demo: 13 bottiglie, 4 cocktail con ricetta, 5 dipendenti, i turni della settimana corrente, task e richieste in attesa.

## Come si pubblica online

Istruzioni passo-passo, senza comandi, in **[COME-PUBBLICARE.txt](COME-PUBBLICARE.txt)**. In sintesi: colleghi questo repo a [Render](https://render.com), che legge `render.yaml` e configura tutto da solo.

Due cose da sapere sul piano gratuito di Render:

- **I dati si azzerano a ogni aggiornamento dell'app.** Va bene per una demo, non per l'uso reale nel locale. Per conservarli serve il piano a pagamento: rinomina `render-DATI-PERMANENTI.yaml` in `render.yaml` (dettagli nelle istruzioni).
- Dopo 15 minuti di inattività l'app si addormenta e la prima visita successiva impiega ~50 secondi.

La chiave di firma dei token (`JWT_SECRET`) non è nel codice: la genera Render. In locale ne viene generata una nuova a ogni riavvio, quindi dopo un restart l'app richiede di nuovo il PIN.

## Lavorare in due

Se siete più di uno sul progetto, leggete **[LAVORARE-IN-DUE.md](LAVORARE-IN-DUE.md)**: ciclo `pull` → modifica → `commit` → `push`, glossario dei termini, comandi di emergenza e cosa non va mai messo nel repo.

## Com'è fatto

Node 24 ed Express 4 per le API REST, SQLite tramite il modulo nativo `node:sqlite`, frontend in JavaScript, HTML e CSS senza framework. Tre sole dipendenze: `express`, `bcryptjs`, `jsonwebtoken`.

```
server.js      API REST, login a PIN, controllo permessi
db.js          schema SQLite e dati demo del primo avvio
public/        frontend (index.html, app.js, style.css, mascot.js)
AVVIA.cmd      avvio rapido su Windows (Node portatile)
render.yaml    configurazione di deploy — piano gratuito
```

## Variabili d'ambiente

| Variabile | A cosa serve |
|---|---|
| `PORT` | Porta del server (default `3100`). |
| `JWT_SECRET` | Chiave di firma dei token. Se manca, ne viene generata una nuova a ogni avvio. |
| `DB_PATH` | Percorso del file SQLite, per puntarlo a un disco persistente. |

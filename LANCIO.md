# Portare Barback al pubblico — i passi, in ordine

Ogni passo si fa da solo e lascia qualcosa che funziona. Non salire al passo
successivo prima che quello sotto risponda: se qualcosa si rompe, sai cosa è stato.

I passi **1, 2 e 3** li fai tu su Render (cinque minuti in tutto, sono click).
Il passo **4** è l'unico vero lavoro, e non è lavoro da computer.

---

## Passo 1 — La demo pubblica

È il pezzo che fa la differenza fra "ho un'app" e "ho un prodotto che si può
provare". Senza la demo ogni vendita richiede te, fisicamente, col telefono in mano.

La demo è aperta a chiunque, senza registrazione. Chi entra può fare **qualsiasi
danno**: svuotare il magazzino, chiudere inventari, cambiare i PIN. Ogni notte
alle 4 (UTC, le 6 in Italia) torna esattamente com'era.

### Su Render

1. **New +** → **Web Service**
2. Repository: **`barback`** → *Connect*
3. Compila così:

   | Campo | Valore |
   |---|---|
   | Name | **`barback-demo`** ← esatto, il sito punta a questo indirizzo |
   | Region | **Frankfurt (EU Central)** |
   | Branch | `main` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `node --experimental-sqlite server.js` |
   | Instance Type | **Free** |

4. **Advanced** → *Add Environment Variable*, quattro volte:

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `24.16.0` |
   | `JWT_SECRET` | premi **Generate** |
   | `SEED_DEMO` | `1` |
   | `DEMO_MODE` | `1` |

5. **Create Web Service**, aspetta 2-3 minuti.

⚠️ **Nessun disco.** Alla demo il disco persistente non serve e non va aggiunto:
i dati sono finti e devono poter sparire.

### Verifica
Apri `https://barback-demo.onrender.com`, entra col PIN **1111** e controlla che
il magazzino sia pieno di roba. Nel log del servizio deve comparire:

```
Modalita' vetrina: i dati si azzerano ogni notte alle 4 UTC
```

> Il piano Free si spegne dopo 15 minuti senza visite e si riaccende in ~40 secondi
> alla visita dopo. Per una demo va benissimo. Se ti dà fastidio quell'attesa,
> portala a Starter (7 $/mese) più avanti — non adesso.

---

## Passo 2 — Il sito di presentazione

La cartella `sito/` contiene tre pagine pronte: presentazione, privacy e condizioni.
Su Render costa **zero**.

1. **New +** → **Static Site**
2. Repository: **`barback`** → *Connect*
3. Compila così:

   | Campo | Valore |
   |---|---|
   | Name | `barback-sito` |
   | Branch | `main` |
   | Build Command | *(lascialo vuoto)* |
   | Publish Directory | **`sito`** |

4. **Create Static Site**

Sarà su `https://barback-sito.onrender.com`.

### ⛔ Prima di dare questo link a qualcuno

Nel sito ci sono **segnaposto da riempire**. Nelle pagine privacy e condizioni
sono **evidenziati in giallo**: se li vedi gialli, non sono ancora compilati.

In `sito/index.html` cerca e sostituisci:

| Cerca | Metti |
|---|---|
| `39XXXXXXXXXX` (4 volte) | il tuo numero WhatsApp, es. `393331234567` |
| `INDIRIZZO@ESEMPIO.IT` (2 volte) | l'email dedicata a Barback |

In `PRIVACY.md` e `CONDIZIONI.md` riempi i campi fra parentesi quadre, poi rigenera
le due pagine del sito con:

```
npm run pagine-legali
```

Ti servono:

- nome o ragione sociale, indirizzo, partita IVA
- l'email dedicata
- la città del foro competente
- la regione Render scelta (se resti su Frankfurt, il testo sulla privacy va già bene)

⚠️ **Le condizioni e la privacy vanno lette da un avvocato prima del primo cliente
che paga.** Costano poco e sono l'unica parte di questo lavoro dove un errore si
paga in soldi veri, non in tempo.

---

## Passo 3 — Il dominio

Senza dominio hai `barback-sito.onrender.com`, che funziona ma non si dà a un
ristoratore. Con 12 €/anno hai `barback.it`.

1. Compra il dominio (Namecheap, Cloudflare o un registrar italiano)
2. Su Render: servizio `barback-sito` → **Settings** → **Custom Domains** → *Add*
3. Render ti dà un record DNS da copiare dal registrar
4. Il certificato HTTPS arriva da solo in pochi minuti

**Prima di comprarlo**, controlla che il nome sia libero come marchio:
[uibm.gov.it](https://www.uibm.gov.it) — ricerca marchi. Se "Barback" è già
registrato da qualcuno nella classe 42 (servizi informatici), meglio saperlo ora
che dopo aver stampato i biglietti da visita.

---

## Passo 4 — I primi dieci clienti, a mano

Questo è l'unico passo che conta davvero, e non si fa dal computer.

**Non fare marketing.** Non fare post, non fare campagne, non comprare pubblicità.
Con zero clienti non sai ancora cosa stai vendendo, e pagheresti per dirlo male.

### Cosa fare, concretamente

Prendi **trenta bar** della tua città. Non i più grandi: quelli con un titolare
che sta dentro, che se decide qualcosa lo decide in tre minuti.

Vai di persona, **fra le 15 e le 17** — il buco fra pranzo e aperitivo, l'unico
momento in cui un titolare ha due minuti. Non telefonare, non mandare email.

Porta il telefono con la demo già aperta e fai **la prova dei cinque minuti**:
fagli contare cinque bottiglie, fagli mettere un numero sbagliato di proposito,
premi *Rivedi*. Quando vede il rosso, capisce. Prima no.

Su trenta visite: una decina ti ascolta, tre o quattro provano, **due o tre pagano**.

### La cosa da capire

Quei primi clienti **non ti servono per i soldi**. Tre clienti a 19 € sono 57 €
al mese: non cambiano niente.

Ti servono per scoprire le cinque cose che non hai previsto, e che nessuna
ricerca di mercato ti dirà mai. Sono l'investimento più redditizio che farai
in tutto questo progetto.

Dopo una settimana chiama ognuno e chiedi **tre cose sole**:
1. Cosa usi tutti i giorni?
2. Cosa non hai capito?
3. Cosa ti manca?

Scrivi le risposte. Quelle sono la tua lista di lavoro per i due mesi dopo.

---

## Passo 5 — Solo dopo i primi dieci

Da qui in poi hai il diritto di fare marketing, perché sai cosa dire e hai
qualcuno che lo conferma.

- **Gruppi Facebook di ristoratori** — ce ne sono di regionali con migliaia di
  titolari dentro. Non vendere: rispondi a chi si lamenta del magazzino.
- **I fornitori di bevande come canale.** Un distributore parla con duecento bar
  a settimana. Se gli conviene che i suoi clienti ordinino meglio, ti presenta lui.
  Questa è la strada più veloce che esiste, e nessuno la usa.
- **Le associazioni di categoria** (FIPE, Confcommercio) hanno newsletter ai soci.
- **Le recensioni dei primi clienti**, con nome e locale, valgono più di qualsiasi
  cosa scriva tu sul sito.

---

## Quando smettere di fare le cose a mano

Finché sei sotto i **venti locali**, un servizio Render per ciascuno va benissimo:
zero programmazione, dati separati per definizione, e se uno rompe qualcosa non
tocca gli altri.

Il momento di riscrivere l'app come **multi-locale** (una sola installazione per
tutti) è intorno ai **cinquanta clienti**: abbastanza per sapere cosa serve
davvero, abbastanza pochi per migrarli a mano in un pomeriggio.

Farlo prima significa indovinare, e le scelte fatte indovinando si pagano due volte.

---

## La lista, in breve

- [ ] Passo 1 — servizio `barback-demo` creato e raggiungibile col PIN 1111
- [ ] Passo 2 — sito `barback-sito` online
- [ ] Segnaposto riempiti: WhatsApp, email, privacy, condizioni
- [ ] Privacy e condizioni lette da un legale
- [ ] Partita IVA aperta, o un commercialista che ti dice come fatturare
- [ ] Nome verificato su [uibm.gov.it](https://www.uibm.gov.it)
- [ ] Passo 3 — dominio collegato
- [ ] Passo 4 — trenta bar visitati
- [ ] I PIN di fabbrica cambiati su ogni installazione vera (l'app lo ricorda da sola)

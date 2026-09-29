# Lavorare dal telefono

Due strade diverse. Non sono alternative: servono a cose diverse, e conviene
avere tutte e due pronte.

---

## 🅰️ Claude Code sul web — **quella di tutti i giorni**

Dal browser del telefono vai su **[claude.ai/code](https://claude.ai/code)**, colleghi
il repository `kevindchan7/barback`, e lavori come stai lavorando adesso.

| | |
|---|---|
| Il PC | **spento**, non serve |
| Cosa vede | tutto il codice del repository |
| Cosa fa | modifica, committa, carica su GitHub |
| Effetto | Render si aggiorna da solo a ogni caricamento |

**Perché è questa la strada normale:** tutto quello su cui lavoriamo — app, sito
nelle tre lingue, pagine di registrazione, documenti — **sta nel repository**.
Non dipendi dalla batteria del portatile, non dipendi da un collegamento che cade,
e non incappi nel DNS delle reti che bloccano certi indirizzi.

### ⚠️ La trappola da conoscere

Quello che fai dal telefono finisce **su GitHub**, non sul PC. Quando torni al
computer devi scaricare le modifiche, sennò lavori su una versione vecchia e poi
ti tocca risolvere i conflitti a mano.

`AVVIA.cmd` lo fa da solo all'avvio. Se apri il progetto in un altro modo, prima
di toccare qualsiasi cosa:

```
git pull
```

---

## 🅱️ Il PC vero dal telefono — **quando ti serve la macchina**

Ti dà **VS Code del tuo computer** dentro il browser del telefono: i file locali,
il terminale, i server che stanno girando.

### Come si accende

Doppio clic su **`REMOTO.cmd`**. Ti spiega cosa sta per fare e ti chiede conferma.

La prima volta ti stampa un **codice** e l'indirizzo `github.com/login/device`:
apri quell'indirizzo, inserisci il codice, e non te lo chiede più.

Poi dal telefono apri:

```
https://vscode.dev/tunnel/barback-pc
```

### Cosa devi sapere prima di usarlo

- Il PC deve restare **acceso, sbloccato e connesso**. Se si sospende, cade.
- **Chi entra col tuo account GitHub raggiunge quella macchina.** Non è pubblico,
  ma non è nemmeno niente: non lasciarlo acceso quando non ti serve.
- Si spegne chiudendo la finestra, o con `Ctrl+C`.
- **Terminale e file funzionano di sicuro.** Su Claude dentro quella sessione non
  garantisco niente: l'estensione andrebbe installata sul lato remoto. Per parlare
  con Claude dal telefono la strada affidabile resta la 🅰️.

---

## Quale usare, in pratica

| Cosa devi fare | Strada |
|---|---|
| Modificare il sito, i documenti, il codice | 🅰️ |
| Chiedere qualcosa a Claude | 🅰️ |
| Creare i servizi su Render | il browser, basta e avanza |
| Guardare l'app girare in locale | 🅱️ |
| Toccare file che non stanno in git (il database vero) | 🅱️ |
| Sei in giro e il PC è a casa spento | 🅰️ |

Nei prossimi giorni il lavoro è **creare i servizi su Render** (browser), **riempire
i segnaposto** (repository → 🅰️) e **andare nei bar** (nessun computer). Il PC acceso
non ti serve quasi mai: tenerlo acceso solo per il collegamento è un punto di rottura
in più senza guadagno.

---

## La pagina "tutto a portata di mano"

Separata da queste due: è una pagina sola con dentro l'app, il sito nelle tre lingue,
i documenti, Render e GitHub. Serve a **guardare**, non a modificare.

Si genera quando il PC è acceso e i collegamenti sono attivi. Chiedimela e te la
rifaccio con gli indirizzi del momento — cambiano a ogni riavvio.

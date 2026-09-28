# Vendere Barback — manuale operativo

Come si porta un locale da "mi interessa" a "sta pagando", senza scrivere codice.

---

## Il modello: un servizio per ogni locale

**Non serve il multi-locale.** Per i primi clienti ogni locale ha il suo servizio Render, col suo database e il suo indirizzo.

| | |
|---|---|
| Dati di un cliente visibili a un altro | **impossibile**, sono database separati |
| Un cliente che rompe qualcosa | non tocca gli altri |
| Lavoro di programmazione | **zero** |
| Costo per te | ~7,25 $/mese per locale |

Il multi-locale vero — un'unica installazione per tutti — si fa **dopo i venti clienti**, quando gestire venti servizi a mano comincia a pesare. Prima è lavoro sprecato su ipotesi.

## Quanto far pagare

Backbar sta a **79 $/mese per locale**, e fa solo il magazzino. Tu fai anche turni, ferie e manuale.

Una fascia che funziona per l'Italia:

| | Prezzo | Cosa ci sta dentro |
|---|---|---|
| **Base** | 29 €/mese | l'app completa, un locale |
| **Con assistenza** | 49 €/mese | + configurazione iniziale fatta da te, backup mensile, risposta entro 24h |
| **Primo anno** | 19 €/mese | sconto di lancio per i primi 5 clienti, in cambio di una recensione |

Ti restano ~22 € netti al mese per locale sul piano base. Dieci locali sono ~220 €/mese ricorrenti.

⚠️ **Non regalare l'app per sempre.** Un cliente che non paga non la usa sul serio, non ti dà feedback utili, e ti occupa tempo. Meglio uno sconto forte a tempo che il gratis.

---

## Aprire un locale nuovo — 10 minuti

### 1. Il servizio su Render
1. **New +** → **Blueprint** → repository `barback`
2. Cambia il **nome del servizio** in `barback-<nomelocale>` (così li distingui)
3. **Apply**, aspetta 2-3 minuti
4. Prendi nota del link: `https://barback-<nomelocale>.onrender.com`

### 2. La prima configurazione
Entra con `1111` e fai subito, in quest'ordine:

1. **⚙ → Nome del locale** → il nome vero. Compare in alto e negli ordini.
2. **⚙ → Il tuo PIN** → cambialo. L'app te lo ricorda da sola appena entri.
3. **⚙ → Profili** → crea i profili per le persone vere e cancella quelli di serie che non servono.
4. **📋 Inventario → Postazioni** → banco, frigo, cantina: i posti dove contano separatamente.
5. **🛒 Ordini → Fornitori** → nome e numero WhatsApp di chi li rifornisce.
6. **📦 Magazzino** → i prodotti, con giacenza e soglia di riordino.

### 3. La consegna
Manda al cliente:
- il **link**
- i **PIN** che hai creato (su un canale diverso dal link, non nello stesso messaggio)
- come **installarla sul telefono**: apri il link → menu → *Aggiungi a schermata Home*

### 4. Dopo una settimana
Chiama e chiedi **tre cose**: cosa usano tutti i giorni, cosa non hanno capito, cosa manca. Le risposte valgono più di qualsiasi funzione nuova che potresti immaginare.

---

## Ogni mese, per ogni cliente

**Scarica la copia di sicurezza** (⚙ → Copia di sicurezza) e tienila da parte. Cinque minuti in tutto.

Il disco di Render è affidabile, ma "affidabile" non è "garantito": se un cliente perde un mese di conteggi, perdi il cliente e il passaparola. La copia è l'unica cosa che ti salva.

---

## La dimostrazione che vende

Non mostrare le schermate. **Fai fare l'inventario a chi hai davanti.**

1. Apri l'app sul suo telefono
2. Fagli contare cinque bottiglie col cursore
3. Fai mettere **di proposito un numero sbagliato** su una
4. Premi **Rivedi**

Quando vede il rosso e la scritta *"atteso 8, contato 6"*, capisce in tre secondi a cosa serve. Quello è il momento in cui si vende — non quando elenchi le funzioni.

---

## Le obiezioni, e cosa rispondere

**"Uso già un quaderno."**
Il quaderno non ti dice cosa ordinare, non ti avvisa quando manca qualcosa e non ti fa vedere se sparisce del gin. Apri l'app e mostragli la revisione.

**"È complicato."**
Fai contare cinque bottiglie a lui. Trenta secondi. Poi taci.

**"Costa."**
Una bottiglia di gin costa 15 €. Se l'app te ne fa recuperare due al mese, si è già pagata. E lo scostamento serve esattamente a quello.

**"E se perdo i dati?"**
Esiste la copia di sicurezza, gliela scarichi davanti. E digli che la fai tu ogni mese, se ha preso il piano con assistenza.

---

## Cosa NON promettere

- **Collegamento al registratore di cassa** — non c'è, e non arriverà presto
- **App su App Store** — si installa dal browser, che è meglio, ma non è la stessa cosa e non va spacciata per tale
- **Più locali nello stesso account** — oggi è un servizio per locale
- **Funziona senza internet** — il guscio sì, i dati no

Promettere una di queste ti fa firmare un contratto e perdere un cliente due mesi dopo.

---

## Prima del primo cliente pagante

- [ ] Partita IVA aperta, o un commercialista che ti dice come fatturare
- [ ] `PRIVACY.md` compilato col tuo nome e pubblicato
- [ ] `CONDIZIONI.md` compilato e accettato dal cliente per iscritto
- [ ] `LICENSE` compilato col titolare del copyright
- [ ] Verificato che il nome "Barback" sia libero come marchio ([uibm.gov.it](https://www.uibm.gov.it))
- [ ] Un indirizzo email dedicato, non quello personale

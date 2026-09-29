# Farsi pagare — il modello, e cosa serve per attivarlo

> Stato: **la pagina c'è, il pagamento no.** `sito/prova.html` raccoglie i dati
> del locale e basta. Stripe non è ancora collegato, e il pulsante lo dice.

---

## 1. La regola che decide tutta l'architettura

**Il numero di carta non deve mai toccare i nostri server.**

Se raccogliamo noi il numero in un nostro campo, entriamo nel perimetro pieno
di PCI DSS: audit annuale, scansioni, responsabilità diretta in caso di furto.
Usando invece il checkout ospitato da Stripe — una pagina che sta su un dominio
loro — ricadiamo nel questionario più leggero, il **SAQ A**, perché i dati della
carta non passano mai da noi.

Per questo `prova.html` **non ha un campo carta** e non deve averlo mai.
Raccoglie nome, locale, email, telefono ed eventuale codice, e poi manda il
browser su Stripe.

⚠️ Anche col SAQ A due obblighi restano nostri: tenere l'elenco degli script che
girano sulla pagina di pagamento, e accorgerci se qualcuno la manomette
(requisiti 6.4.3 e 11.6.1). Sono leggeri, ma esistono. E bastano un Google Tag
Manager o un altro script di terze parti sulla pagina di checkout per uscire dal
SAQ A: teniamola pulita.

---

## 2. Il modello scelto, e perché

**Quattordici giorni gratis, carta richiesta subito.**

I numeri di mercato sono netti:

| Modello | Conversione a pagante |
|---|---|
| Prova **senza** carta | 8,9% |
| Prova **con** carta | **31,4%** |

E sul totale contano i clienti, non la percentuale:

| | Iscritti | Paganti |
|---|---|---|
| Senza carta | 45 | 3,6 |
| Con carta | 35 | **10,5** |

Meno iscritti, quasi il triplo di clienti veri. Chi non vuole lasciare la carta
per una prova gratuita quasi mai diventa cliente: fa risparmiare tempo saperlo
subito.

**Due cose non negoziabili**, perché sono quelle che trasformano un modello
onesto in una fregatura percepita:

1. **L'email di avviso due giorni prima del primo addebito.** Stripe la manda da
   solo, va solo attivata. Senza quella, il primo addebito è una sorpresa e la
   sorpresa diventa una richiesta di rimborso e una recensione cattiva.
2. **La disdetta deve essere facile quanto l'iscrizione.** Un bottone nell'app,
   non una email da scrivere.

### I codici promo

Servono per il prezzo di lancio ai primi cinque locali e per chi ti presenta
qualcuno. Li gestisce Stripe: si crea un *coupon* (anche del tipo "giorni di
prova in più") e poi un *promotion code* leggibile, tipo `LANCIO30`.

⚠️ Metti **sempre un limite di utilizzi e una scadenza** su ogni codice. Un
codice senza limiti finisce sui siti di sconti e te lo ritrovi usato da
chiunque.

Nella pagina `prova.html` i codici sono **finti**, servono solo a far vedere come
cambia il riepilogo. Quando Stripe sarà attivo vanno tolti: un controllo che
vive nel browser lo aggira chiunque apra la console. La validazione vera la fa
Stripe con `allow_promotion_codes: true`.

---

## 3. Per l'Italia: non solo carta

Molti locali preferiscono l'**addebito diretto in conto** alla carta aziendale.
Stripe supporta **SEPA Direct Debit**, schema *Core* (non il B2B), che funziona
sia con conti aziendali sia personali, con un tetto di **10.000 € a
transazione** — ampiamente sopra il nostro canone.

Serve raccogliere nome e IBAN e far accettare il mandato: lo fa la pagina di
Stripe, non noi.

Conviene attivarlo insieme alla carta: è un attrito in meno per un ristoratore
che non vuole mettere la carta aziendale su un sito.

---

## 4. Cosa serve per accenderlo davvero

### Prima di tutto, i requisiti di Stripe Italia
- **Codice fiscale e partita IVA**
- Documento d'identità fronte e retro
- Un **conto bancario italiano** intestato a te o alla società
- Scegli *Azienda individuale* se sei partita IVA individuale, *Azienda* se hai una società

Senza partita IVA aperta non si parte. È il primo collo di bottiglia vero.

### Poi, in ordine

1. **Crea l'account Stripe** e completa la verifica.
2. **Crea due prodotti ricorrenti**: 29 €/mese e 49 €/mese. Prezzi **IVA esclusa**;
   fatti dire dal commercialista come gestire l'IVA in fattura.
3. **Attiva i metodi di pagamento**: carta + SEPA Direct Debit.
4. **Attiva l'email di avviso fine prova** nelle impostazioni di fatturazione.
5. **Una rotta sul server** che crea la sessione di pagamento, con:
   - `trial_period_days: 14`
   - `allow_promotion_codes: true`
   - l'email del cliente già compilata
6. **Un webhook** che, a pagamento andato a buon fine, fa partire il servizio del
   locale. All'inizio questo passo **lo fai a mano**: arrivano tre clienti al
   mese, non trecento. Automatizzarlo adesso è lavoro sprecato.
7. **Togli i codici finti** da `prova.html`.

### Cosa NON fare adesso

- Non automatizzare la creazione del servizio Render. Con meno di venti clienti
  ci metti dieci minuti a mano, e ogni minuto speso ad automatizzare ora è
  speso su ipotesi che cambieranno.
- Non aggiungere il piano annuale finché qualcuno non te lo chiede.
- Non costruire un pannello di amministrazione. La dashboard di Stripe è già
  quel pannello.

---

## 5. La cosa da tenere a mente sul tempismo

Questa pagina serve quando le persone arrivano **da sole**, dal sito, senza
averti mai parlato.

I primi dieci clienti non arriveranno così: li conquisti di persona, nei bar,
col telefono in mano. Per quelli non serve nessuna pagina di registrazione —
apri il servizio, gli dai i PIN, e la fattura gliela mandi tu.

Quindi: la pagina c'è ed è pronta, ma **non è il passo che ti fa guadagnare
adesso**. Il passo che conta sono le trenta visite di [LANCIO.md](LANCIO.md).
Accendi Stripe quando il primo cliente ti chiede come pagarti.

---

## Fonti

- [Free Trial Conversion Statistics 2026 — shno.co](https://www.shno.co/marketing-statistics/free-trial-conversion-statistics)
- [The SaaS Conversion Report — ChartMogul](https://chartmogul.com/reports/saas-conversion-report/)
- [B2B SaaS Trial-to-Paid Conversion Benchmarks 2026](https://www.growthspreeofficial.com/blogs/b2b-saas-trial-to-paid-conversion-rate-benchmarks-2026-by-trial-type-acv-length-credit-card)
- [Configure trial offers on subscriptions — Stripe](https://docs.stripe.com/billing/subscriptions/trials)
- [Coupons and promotion codes — Stripe](https://docs.stripe.com/billing/subscriptions/coupons)
- [Promotion Codes — Stripe Support](https://support.stripe.com/questions/promotion-codes)
- [SEPA Direct Debit: an in-depth guide — Stripe](https://stripe.com/resources/more/sepa-direct-debit-an-in-depth-guide)
- [SEPA debit payments — Stripe Docs](https://docs.stripe.com/docs/payments/sepa-debit)
- [What is PCI DSS compliance? — Stripe](https://stripe.com/guides/pci-compliance)
- [Stripe PCI Compliance: what Stripe covers, what you own](https://cside.com/blog/can-you-use-stripe-for-pci-dss)
- [Stripe Italia: come accettare pagamenti online — Biz Academy](https://biz-academy.it/stripe/)

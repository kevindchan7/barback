# Informativa privacy — Barback

> ⚠️ **DA COMPILARE E DA FAR CONTROLLARE.**
> I campi fra parentesi quadre vanno riempiti. Questo è un punto di partenza scritto con criterio, **non un parere legale**: prima del primo cliente pagante fallo leggere a un avvocato o a un consulente privacy. Costa poco e ti evita guai seri.

---

**Titolare del trattamento:** [NOME O RAGIONE SOCIALE]
**Indirizzo:** [INDIRIZZO]
**Email:** [EMAIL]
**P. IVA:** [PARTITA IVA]

Ultimo aggiornamento: [DATA]

---

## 1. Cos'è Barback

Barback è un programma che un bar o un ristorante usa per gestire le scorte di bevande e i turni del personale. Ogni locale ha la propria installazione, con un database separato: **i dati di un locale non sono mai visibili a un altro**.

## 2. Chi fa cosa

**Il locale che usa Barback è il Titolare** del trattamento dei dati dei propri dipendenti: decide lui quali dati inserire e perché.

**[NOME O RAGIONE SOCIALE] è il Responsabile** del trattamento: fornisce e mantiene il programma, e tratta i dati solo su istruzione del locale. Il rapporto è regolato da un contratto di nomina a responsabile (art. 28 GDPR) che viene firmato insieme al contratto di servizio.

## 3. Quali dati vengono trattati

**Dei dipendenti del locale:**
- nome e ruolo
- turni di lavoro assegnati
- attività da svolgere e chi le ha completate
- richieste di ferie, permessi e cambi turno, **con il motivo indicato da chi le richiede**

**Di chi accede al programma:**
- nome del profilo e codice PIN, conservato solo in forma cifrata (bcrypt) e mai leggibile
- quali operazioni ha compiuto (registrazione movimenti, conteggi di inventario, approvazioni)

**Del locale:**
- prodotti, quantità, fornitori e relativi recapiti

**Non vengono trattati** dati di clienti finali del locale, dati di pagamento, né dati di geolocalizzazione.

## 4. ⚠️ Il campo "motivo" delle richieste

Quando un dipendente chiede un permesso può scrivere il motivo. Se vi indica una ragione di salute — una visita medica, una terapia — **quel dato rientra nelle categorie particolari dell'art. 9 GDPR** e gode di protezione rafforzata.

Il locale, come Titolare, deve:
- **informare i dipendenti** che quel campo è facoltativo e che non devono indicarvi motivi di salute;
- limitarne la visibilità a chi deve effettivamente decidere sulla richiesta;
- cancellare le richieste chiuse entro i termini indicati al punto 7.

Se non vi è bisogno di raccogliere il motivo, il consiglio è **non compilarlo**.

## 5. Perché vengono trattati

| Finalità | Base giuridica |
|---|---|
| Gestione dei turni e dell'organizzazione del lavoro | esecuzione del contratto di lavoro (art. 6.1.b) e obblighi di legge (art. 6.1.c) |
| Gestione delle scorte e degli ordini | interesse legittimo del locale (art. 6.1.f) |
| Sicurezza degli accessi al programma | interesse legittimo (art. 6.1.f) |

## 6. Dove stanno i dati

I dati sono conservati su server di **Render Services, Inc.**, nella regione [REGIONE, es. Frankfurt — Unione Europea]. Il collegamento è sempre cifrato (HTTPS).

[SE LA REGIONE È FUORI DALL'UE: I dati sono trasferiti negli Stati Uniti sulla base delle Clausole Contrattuali Standard approvate dalla Commissione Europea.]

Copie di sicurezza sono conservate da [NOME] su [DOVE], per un massimo di [QUANTI] mesi.

## 7. Per quanto tempo

| Dato | Conservazione |
|---|---|
| Turni e attività | [12] mesi |
| Richieste di ferie e permessi chiuse | [12] mesi dalla decisione |
| Movimenti di magazzino e inventari | [24] mesi |
| Profili di accesso | finché il rapporto di lavoro è attivo |

Alla cessazione del contratto di servizio i dati vengono **restituiti al locale in un file** e cancellati dai nostri sistemi entro [30] giorni.

## 8. Chi può vederli

Solo il personale del locale, secondo i permessi assegnati a ciascun profilo. Nessun dato viene ceduto o venduto a terzi. Il personale tecnico di [NOME] può accedervi **solo su richiesta del locale** e solo per risolvere un problema.

Fornitore tecnico: **Render Services, Inc.**, nominato sub-responsabile.

## 9. I diritti dei dipendenti

Ogni persona può chiedere di accedere ai propri dati, correggerli, cancellarli, limitarne il trattamento, riceverli in un formato leggibile, e opporsi al trattamento.

La richiesta va fatta **al proprio locale**, che è il Titolare. Se il locale ha bisogno di aiuto tecnico può scrivere a [EMAIL].

È sempre possibile presentare reclamo al **Garante per la protezione dei dati personali** ([garanteprivacy.it](https://www.garanteprivacy.it)).

## 10. Sicurezza

- Collegamento cifrato (HTTPS) su tutte le pagine
- PIN conservati cifrati con bcrypt, mai in chiaro e mai restituiti dal programma
- Accessi a tempo: la sessione scade dopo 12 ore
- Permessi separati per ruolo: ognuno vede e fa solo ciò che gli compete
- Database separato per ogni locale

**Al locale si raccomanda di:** cambiare i PIN di fabbrica alla prima accensione (il programma lo ricorda da solo), non condividere un profilo fra più persone, e togliere il profilo a chi lascia il lavoro.

## 11. Se cambia qualcosa

Le modifiche a questa informativa vengono comunicate a [EMAIL DEL LOCALE] con almeno [15] giorni di anticipo.

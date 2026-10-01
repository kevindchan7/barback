---
name: controlla
description: Controlla il sito prima di dare il link a un cliente. Cerca segnaposto rimasti, link a pagine che non esistono, e lingue che non si rimandano fra loro. Da usare quando l'utente dice "controlla il sito", "posso pubblicare?", "è pronto?", "posso dare il link a qualcuno?", oppure prima di qualsiasi pubblicazione su Render.
---

# Controllare il sito prima di mostrarlo

## Cosa fare

Lancia il controllo meccanico:

```
npm run controlla
```

Poi lancia anche la batteria dell'app, perché un sito a posto davanti a
un'app rotta non serve a niente:

```
npm test
```

## Come leggere il risultato

Lo strumento divide i problemi in tre livelli. **Non sono tutti uguali e
non vanno trattati allo stesso modo.**

| Livello | Cosa vuol dire | Cosa farne |
|---|---|---|
| `BLOCCANTE` | Un cliente vedrebbe qualcosa di sbagliato o rotto | Il link non si dà a nessuno finché non è risolto |
| `SERIO` | Funziona ma qualcuno resta bloccato | Si risolve prima di fare pubblicità |
| `MINORE` | Nessuno se ne accorge subito | Si può rimandare |

## Cosa puoi risolvere tu e cosa no

**Risolvi da solo:**
- pagine mancanti a cui qualcuno rimanda (scrivile)
- collegamenti fra le lingue che mancano
- `lang` o titoli mancanti

**NON inventare mai:**
- il nome della società, l'indirizzo, la partita IVA, l'email, il numero di telefono

Quelli sono segnaposto che **solo l'utente** può riempire. Se ne trovi,
elencali in modo compatto e chiedi i dati che mancano. Non metterci un
valore plausibile: un indirizzo sbagliato su un contratto è peggio di un
segnaposto, perché il segnaposto si vede e l'indirizzo sbagliato no.

## Come rispondere

Non incollare l'uscita grezza dello strumento. L'utente si perde negli
elenchi lunghi.

Di' in quest'ordine:
1. **Si può dare il link? sì o no.** Una riga.
2. Cosa hai sistemato tu, se hai sistemato qualcosa.
3. Cosa manca, raggruppato per **chi lo deve fare**, non per file.
4. Se mancano dati dell'utente: chiedili in un elenco corto, una riga ciascuno.

Se dopo aver sistemato qualcosa rilanci il controllo, di' il numero
prima e dopo: serve a far vedere che ti sei mosso.

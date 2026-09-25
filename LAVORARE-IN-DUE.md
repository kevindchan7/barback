# Lavorare in due su Barback

Questo progetto è condiviso. Qui c'è come lavorarci in due senza rompere niente.

---

## Setup iniziale (una volta sola, per chi si aggiunge)

Prima accetta l'invito che ti è arrivato via email, poi:

```bash
git clone https://github.com/kevindchan7/barback.git
cd barback
npm install
```

Per avviare l'app: `npm start`, poi apri <http://localhost:3100>.
Su Windows puoi anche fare doppio click su **AVVIA.cmd** (usa il Node portatile, non serve installare niente).

---

## Il ciclo di lavoro quotidiano

Sempre in quest'ordine:

```bash
git pull                          # 1. scarica le modifiche dell'altro PRIMA di iniziare
                                  # 2. modifichi i file normalmente
git status                        # 3. vedi cosa è cambiato
git add .                         # 4. prepari tutte le modifiche
git commit -m "cosa ho fatto"     # 5. salvi lo "scatto" con una descrizione
git push                          # 6. mandi tutto su GitHub
```

> **Regola d'oro:** `git pull` **prima** di iniziare a lavorare, `git push` **appena** hai finito qualcosa. Più aspetti, più è probabile un conflitto.

---

## Glossario minimo

| Termine | Cosa significa |
|---|---|
| **repository (repo)** | La cartella del progetto con tutta la sua storia |
| **commit** | Uno scatto fotografico del progetto + una descrizione |
| **push** | Invia i tuoi commit su GitHub |
| **pull** | Scarica su di te i commit dell'altro |
| **branch** | Una linea di lavoro parallela (quella principale si chiama `main`) |
| **conflitto** | Avete cambiato le stesse righe: Git chiede a voi quale versione tenere |

---

## Comandi di emergenza

```bash
git log --oneline -10       # ultimi 10 commit: chi ha fatto cosa
git diff                    # cosa ho cambiato e non ho ancora committato
git restore NOMEFILE        # annulla le modifiche non committate a un file
git restore --staged .      # annulla un "git add" fatto per sbaglio
```

⚠️ Non usare `git reset --hard` o `git push --force` senza chiedere all'altro: cancellano lavoro in modo difficilmente recuperabile.

---

## Il database non si condivide

`data.db` è **escluso** dal repo (sta nel `.gitignore`), e va bene così: ognuno ha il suo database locale con i suoi dati di prova. Al primo avvio si popola da solo con i dati demo.

Questo vuol dire che **i conteggi che vedi tu non sono quelli che vede l'altro**. È normale. I dati veri del locale vivranno sull'app pubblicata online, non nelle copie sui vostri PC.

---

## Cosa NON mettere qui dentro

Password, chiavi API, file `.env`, dati personali di clienti o dipendenti. Una volta pushati restano nella storia del repo **anche se li cancelli dopo**. Il `.gitignore` blocca già i più comuni (`node_modules`, il database, i log).

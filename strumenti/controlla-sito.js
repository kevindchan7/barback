/* =====================================================================
   controlla-sito.js — Il controllo da fare PRIMA di dare il link a
   qualcuno.

   Cerca le tre cose che fanno fare brutta figura e che si vedono solo
   quando e' tardi:
     1. segnaposto rimasti (il numero finto, l'email di esempio)
     2. link che puntano a pagine che non esistono
     3. le tre lingue che non si rimandano tutte fra loro

   Non e' intelligente e non deve esserlo: e' meccanico, quindi non si
   distrae e non si dimentica. L'intelligenza serve per decidere cosa
   fare dei problemi che trova, non per trovarli.

   si lancia con:  npm run controlla
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const SITO = path.join(__dirname, '..', 'sito');

/* I segnaposto che NON devono sopravvivere alla pubblicazione.
   Scritti spezzati dove serve, altrimenti questo file stesso
   risulterebbe pieno di segnaposto a chi lo cerca con grep. */
const SEGNAPOSTO = [
  { cerca: 'XXXXXXXXXX',           cosa: 'numero di telefono finto' },
  { cerca: 'ADDRESS@EXAMPLE.COM',  cosa: 'email di esempio (inglese)' },
  { cerca: 'INDIRIZZO@ESEMPIO.IT', cosa: 'email di esempio (italiano)' },
  { cerca: '[COMPANY NAME]',       cosa: 'nome della societa\'' },
  { cerca: '[NOME O RAGIONE SOCIALE]', cosa: 'nome della societa\' (italiano)' },
  { cerca: '[EMAIL]',              cosa: 'email nei documenti legali' },
  { cerca: '[INDIRIZZO]',          cosa: 'indirizzo' },
  { cerca: '[PARTITA IVA]',        cosa: 'partita IVA' },
  { cerca: '[DATA]',               cosa: 'data di entrata in vigore' },
  { cerca: '[CITTÀ]',              cosa: 'foro competente' },
];

/* Le tre presentazioni devono rimandarsi tutte fra loro: chi arriva
   sulla spagnola e parla inglese deve poter uscire. */
const LINGUE = {
  'index.html': { nome: 'inglese',  altre: ['it.html', 'es.html'],    iscrizione: 'signup.html' },
  'it.html':    { nome: 'italiano', altre: ['index.html', 'es.html'], iscrizione: 'prova.html' },
  'es.html':    { nome: 'spagnolo', altre: ['index.html', 'it.html'], iscrizione: 'registro.html' },
};

const problemi = [];
const nota = (gravita, file, testo) => problemi.push({ gravita, file, testo });

/* ---------------- raccolta ---------------- */
const pagine = fs.readdirSync(SITO).filter(f => f.endsWith('.html'));
const esiste = new Set(fs.readdirSync(SITO));
const testo = {};
for (const p of pagine) testo[p] = fs.readFileSync(path.join(SITO, p), 'utf8');

/* ---------------- 1. segnaposto ---------------- */
for (const p of pagine) {
  for (const s of SEGNAPOSTO) {
    const quanti = testo[p].split(s.cerca).length - 1;
    if (quanti > 0) {
      nota('bloccante', p, `${quanti} volte il segnaposto "${s.cerca}" — ${s.cosa}`);
    }
  }
  // i segnaposto evidenziati in giallo nelle pagine legali
  const gialli = (testo[p].match(/<mark>\[[^\]]*\]<\/mark>/g) || []).length;
  if (gialli) nota('bloccante', p, `${gialli} campi evidenziati in giallo ancora da riempire`);
}

/* ---------------- 2. link interni rotti ---------------- */
for (const p of pagine) {
  const visti = new Set();
  for (const m of testo[p].matchAll(/href="([^"#?:]+\.html)(?:#[^"]*)?"/g)) {
    const dest = m[1];
    if (visti.has(dest)) continue;
    visti.add(dest);
    if (!esiste.has(dest)) nota('bloccante', p, `rimanda a "${dest}", che non esiste`);
  }
  // anche le immagini e le icone
  for (const m of testo[p].matchAll(/(?:href|src)="([^"#?:]+\.(?:ico|png|jpg|svg|css|js))"/g)) {
    if (!esiste.has(m[1])) nota('serio', p, `rimanda al file "${m[1]}", che non esiste`);
  }
}

/* ---------------- 3. le tre lingue ---------------- */
for (const [p, info] of Object.entries(LINGUE)) {
  if (!esiste.has(p)) { nota('bloccante', p, `manca la presentazione in ${info.nome}`); continue; }
  for (const altra of info.altre) {
    if (!testo[p].includes(`href="${altra}"`))
      nota('serio', p, `dalla pagina ${info.nome} non si arriva a "${altra}": chi non capisce la lingua resta bloccato`);
  }
  if (!esiste.has(info.iscrizione)) {
    nota('bloccante', p, `manca la pagina di iscrizione "${info.iscrizione}"`);
  } else if (!testo[p].includes(`href="${info.iscrizione}"`)) {
    nota('serio', p, `la presentazione in ${info.nome} non porta a "${info.iscrizione}"`);
  }
}

/* ---------------- 4. ogni pagina si sa dichiarare ---------------- */
for (const p of pagine) {
  if (!/<html lang="(en|it|es)"/.test(testo[p]))
    nota('minore', p, 'manca lang="..." nel tag <html>: i lettori di schermo e Google non sanno che lingua e\'');
  if (!/<title>[^<]+<\/title>/.test(testo[p]))
    nota('minore', p, 'manca il titolo della pagina');
}

/* ---------------- resoconto ---------------- */
const ordine = { bloccante: 0, serio: 1, minore: 2 };
const etichetta = { bloccante: 'BLOCCANTE', serio: 'SERIO    ', minore: 'MINORE   ' };
problemi.sort((a, b) => ordine[a.gravita] - ordine[b.gravita] || a.file.localeCompare(b.file));

console.log(`\nControllo del sito — ${pagine.length} pagine\n`);

if (!problemi.length) {
  console.log('  Nessun problema. Il sito si puo\' dare a qualcuno.\n');
  process.exit(0);
}

let ultimo = null;
for (const pr of problemi) {
  if (pr.gravita !== ultimo) { console.log(''); ultimo = pr.gravita; }
  console.log(`  ${etichetta[pr.gravita]}  ${pr.file.padEnd(16)} ${pr.testo}`);
}

const conta = (g) => problemi.filter(p => p.gravita === g).length;
console.log(`\n  ${conta('bloccante')} bloccanti, ${conta('serio')} seri, ${conta('minore')} minori.`);
console.log(conta('bloccante')
  ? '  Con dei BLOCCANTI il link non va dato a nessuno.\n'
  : '  Niente di bloccante: il sito si puo\' mostrare.\n');

process.exit(conta('bloccante') ? 1 : 0);

/* =====================================================================
   prova-lingue.js — Controlla che le tre lingue siano complete e che il
   server risponda davvero tradotto.

   Due cose che si rompono facilmente:
   - una chiave tradotta in italiano e dimenticata in inglese o spagnolo;
   - un testo nell'HTML che nessuno ha marcato e resta in italiano.

   Uso:   node --experimental-sqlite test/prova-lingue.js
          npm run prova-lingue
   ===================================================================== */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = Number(process.env.PORT_TEST || 3196);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(os.tmpdir(), `barback-lingue-${Date.now()}.db`);

let passati = 0, falliti = 0;
const problemi = [];
function verifica(nome, cond, dettaglio) {
  if (cond) { passati++; console.log(`  ok   ${nome}`); }
  else { falliti++; problemi.push(nome); console.log(`  NO   ${nome}${dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : ''}`); }
}
const titolo = (t) => console.log(`\n${t}`);

async function chiama(p, { metodo = 'GET', corpo, token, lang } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method: metodo,
    headers: { 'Content-Type': 'application/json',
      ...(lang ? { 'X-Lang': lang } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dati = null; try { dati = await r.json(); } catch {}
  return { stato: r.status, dati };
}

(async function main() {
  console.log('Barback — prova delle tre lingue');

  /* ---------- 1. il dizionario del browser ---------- */
  titolo('1. DIZIONARIO COMPLETO IN TUTTE E TRE LE LINGUE');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8');
  const chiaviDi = (lingua) => {
    const m = src.match(new RegExp('\\n  ' + lingua + ': \\{([\\s\\S]*?)\\n  \\},'));
    if (!m) return null;
    // le chiavi stanno anche piu' d'una per riga: vanno prese tutte
    // chiavi normali (nome:) e chiavi fra apici ('Proprietario':)
    const a = [...m[1].matchAll(/(?:^|[,{])\s*([a-z_0-9]+):\s*['`]/gm)].map(x => x[1]);
    const b = [...m[1].matchAll(/(?:^|[,{])\s*'([^']+)':\s*'/gm)].map(x => x[1]);
    return [...a, ...b];
  };
  const it = chiaviDi('it'), en = chiaviDi('en'), es = chiaviDi('es');
  verifica('il dizionario italiano si legge', Array.isArray(it) && it.length > 100, it && it.length);
  const mancaIn = (a, b) => a.filter(k => !b.includes(k));
  verifica(`inglese completo (${en ? en.length : 0} voci su ${it.length})`, en && mancaIn(it, en).length === 0, en && mancaIn(it, en));
  verifica(`spagnolo completo (${es ? es.length : 0} voci su ${it.length})`, es && mancaIn(it, es).length === 0, es && mancaIn(it, es));
  verifica('niente voci in piu\' in inglese', en && mancaIn(en, it).length === 0, en && mancaIn(en, it));
  verifica('niente voci in piu\' in spagnolo', es && mancaIn(es, it).length === 0, es && mancaIn(es, it));

  /* ---------- 2. l'HTML e' tutto marcato ---------- */
  titolo('2. NESSUN TESTO DIMENTICATO NELL\'HTML');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const marcati = (html.match(/data-i18n=/g) || []).length;
  verifica(`elementi marcati nell'HTML (${marcati})`, marcati > 120, marcati);

  // testi fra tag senza data-i18n e senza variabili: sarebbero rimasti in italiano
  const dimenticati = [];
  html.replace(/<(h1|h2|h3|p|button|label|option|th)((?:\s[^>]*)?)>([^<>{}$]+)<\/\1>/g, (tutto, tag, attr, testo) => {
    const pulito = testo.trim();
    if (pulito && /[A-Za-zÀ-ù]{3}/.test(pulito) && !/data-i18n/.test(attr)) dimenticati.push(pulito);
    return tutto;
  });
  verifica('nessun testo visibile lasciato indietro', dimenticati.length === 0, dimenticati.slice(0, 8));

  const chiaviUsate = [...html.matchAll(/data-i18n(?:-ph|-title)?="([a-z_0-9]+)"/g)].map(m => m[1]);
  const orfane = [...new Set(chiaviUsate)].filter(k => !it.includes(k));
  verifica('ogni chiave usata nell\'HTML esiste nel dizionario', orfane.length === 0, orfane);

  /* ---------- 3. le chiavi usate nel codice ---------- */
  titolo('3. LE CHIAVI USATE NEL CODICE ESISTONO');
  const appjs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const usate = [...new Set([...appjs.matchAll(/\bt\('([a-z_0-9]+)'/g)].map(m => m[1]))];
  const inesistenti = usate.filter(k => !it.includes(k));
  verifica(`chiavi t() usate in app.js (${usate.length}), tutte esistenti`, inesistenti.length === 0, inesistenti);

  /* ---------- 4. il server risponde tradotto ---------- */
  titolo('4. IL SERVER RISPONDE NELLA LINGUA CHIESTA');
  const server = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT: String(PORT), DB_PATH: DB, JWT_SECRET: 'prova', SEED_DEMO: '1' }, stdio: 'ignore' });

  const chiudi = (c) => {
    server.kill();
    try { for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true }); } catch {}
    console.log(`\n${'='.repeat(52)}`);
    console.log(`Superati: ${passati}   Falliti: ${falliti}`);
    if (falliti) console.log('Non passano:\n  - ' + problemi.join('\n  - '));
    else console.log('Tutto a posto: le tre lingue sono complete.');
    process.exit(c);
  };

  let su = false;
  for (let i = 0; i < 60 && !su; i++) {
    try { const r = await fetch(BASE + '/api/profiles'); su = r.ok; } catch {}
    if (!su) await new Promise(s => setTimeout(s, 250));
  }
  if (!su) { console.log('Il server non risponde.'); return chiudi(1); }

  // PIN sbagliato, nelle tre lingue
  const sbagliato = (lang) => chiama('/auth/pin', { metodo: 'POST', lang, corpo: { profileId: 1, pin: '0000' } });
  verifica('errore in italiano', (await sbagliato('it')).dati.error === 'PIN errato');
  verifica('errore in inglese', (await sbagliato('en')).dati.error === 'Wrong PIN', (await sbagliato('en')).dati.error);
  verifica('errore in spagnolo', (await sbagliato('es')).dati.error === 'PIN incorrecto', (await sbagliato('es')).dati.error);
  verifica('lingua sconosciuta -> italiano', (await sbagliato('de')).dati.error === 'PIN errato');
  verifica('senza intestazione -> italiano', (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId: 1, pin: '0000' } })).dati.error === 'PIN errato');

  const { token: T } = (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId: 1, pin: '1111' } })).dati;

  // messaggio con una parte variabile: il nome del prodotto deve restare
  const troppo = (lang) => chiama('/movements', { metodo: 'POST', token: T, lang, corpo: { productId: 1, type: 'vuoto', qty: 9999 } });
  const itM = (await troppo('it')).dati.error, enM = (await troppo('en')).dati.error, esM = (await troppo('es')).dati.error;
  verifica('messaggio con nome: italiano', itM.startsWith('Giacenza insufficiente: '), itM);
  verifica('messaggio con nome: inglese', enM.startsWith('Not enough stock: '), enM);
  verifica('messaggio con nome: spagnolo', esM.startsWith('Existencias insuficientes: '), esM);
  verifica('il nome del prodotto non viene tradotto', enM.endsWith(itM.split(': ')[1]), [itM, enM]);

  // il manuale del dipendente
  const man = (lang) => chiama('/manuale', { token: T, lang });
  const mIt = (await man('it')).dati, mEn = (await man('en')).dati, mEs = (await man('es')).dati;
  verifica('regole del locale in italiano', mIt.regole[0].includes('Lavare le mani'));
  verifica('regole del locale in inglese', mEn.regole[0].includes('Wash your hands'), mEn.regole[0]);
  verifica('regole del locale in spagnolo', mEs.regole[0].includes('Lávate las manos'), mEs.regole[0]);
  verifica('stesso numero di regole nelle tre lingue', mIt.regole.length === mEn.regole.length && mEn.regole.length === mEs.regole.length);
  const negroni = (m) => (m.ricettario.find(r => r.name === 'Negroni') || {}).preparazione || '';
  verifica('preparazione cocktail in inglese', negroni(mEn).includes('Pour gin'), negroni(mEn));
  verifica('preparazione cocktail in spagnolo', negroni(mEs).includes('Vierte ginebra'), negroni(mEs));

  chiudi(falliti ? 1 : 0);
})().catch(e => { console.error('\nerrore inatteso:', e); process.exit(1); });

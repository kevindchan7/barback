/* =====================================================================
   db.js — PIU' LOCALI SU UN SOLO SERVER.
   - Un registro (locali.db) con l'elenco dei bar: codice, nome, email.
   - Ogni bar ha il suo file:  <DATA_DIR>/locali/<codice>.db
   - Il resto del programma continua a usare "db" come prima: dietro le
     quinte "db" punta sempre al database del locale di chi sta chiamando.
   ===================================================================== */
const { DatabaseSync } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const apriLocale = require('./db-locale');

// Su Render: DATA_DIR=/barback/data (il disco che resta). In locale: ./dati
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'dati');
const DIR_LOCALI = path.join(DATA_DIR, 'locali');
fs.mkdirSync(DIR_LOCALI, { recursive: true });

const registro = new DatabaseSync(path.join(DATA_DIR, 'locali.db'));
registro.exec('PRAGMA journal_mode = WAL;');
registro.exec(`
CREATE TABLE IF NOT EXISTS locali (
  codice TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  citta TEXT DEFAULT '',
  attivo INTEGER DEFAULT 1,          -- 0 = sospeso (es. non ha pagato)
  demo INTEGER DEFAULT 0,
  creato_il TEXT,
  ultimo_accesso TEXT
);`);
// dati di chi si iscrive dal sito (pagina "Prova 14 giorni"): servono a te per fatturare
for (const [col, decl] of [['referente', "TEXT DEFAULT ''"], ['piva', "TEXT DEFAULT ''"], ['piano', "TEXT DEFAULT ''"], ['promo', "TEXT DEFAULT ''"], ['note', "TEXT DEFAULT ''"]]) {
  if (!registro.prepare('PRAGMA table_info(locali)').all().some(c => c.name === col)) registro.exec(`ALTER TABLE locali ADD COLUMN ${col} ${decl}`);
}

const aperti = new Map();       // codice -> database gia' aperto
const contesto = new AsyncLocalStorage();

// il codice: solo lettere minuscole, numeri e trattini
const pulisciCodice = (c) => String(c || '').toLowerCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

function infoLocale(codice) {
  return registro.prepare('SELECT * FROM locali WHERE codice=?').get(pulisciCodice(codice));
}

function dbDel(codice) {
  const c = pulisciCodice(codice);
  if (aperti.has(c)) return aperti.get(c);
  const info = infoLocale(c);
  if (!info) return null;
  const d = apriLocale(path.join(DIR_LOCALI, c + '.db'), !!info.demo);
  aperti.set(c, d);
  return d;
}

function impostaNome(d, nome) {
  d.prepare(`INSERT INTO impostazioni (chiave,valore) VALUES ('locale_nome',?)
    ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`).run(nome);
}

/* Crea un locale nuovo, VUOTO, con il PIN del titolare scelto da lui.
   Gli altri profili nascono coi PIN di fabbrica: l'app chiede di cambiarli. */
function creaLocale({ codice, nome, email, telefono, citta, pin, demo, referente, piva, piano, promo }) {
  const c = pulisciCodice(codice || nome);
  if (c.length < 3) throw new Error('Codice del locale troppo corto (minimo 3 caratteri)');
  if (infoLocale(c)) throw new Error('Questo codice è già usato da un altro locale');
  registro.prepare(`INSERT INTO locali (codice,nome,email,telefono,citta,demo,creato_il,referente,piva,piano,promo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(c, nome, email || '', telefono || '', citta || '', demo ? 1 : 0, new Date().toISOString(),
    referente || '', piva || '', ['base', 'assistenza'].includes(piano) ? piano : '', promo || '');
  const d = dbDel(c);
  impostaNome(d, nome);
  if (pin) {
    d.prepare(`UPDATE profiles SET pin_hash=?, pin_default=0
      WHERE id=(SELECT id FROM profiles WHERE permissions LIKE '%"all"%' ORDER BY id LIMIT 1)`)
      .run(bcrypt.hashSync(String(pin), 10));
  }
  return c;
}

// il bar dimostrativo c'e' sempre: codice "demo", PIN 1111
if (!infoLocale('demo')) creaLocale({ codice: 'demo', nome: 'Bar Demo', demo: true });

/* Ogni notte la demo torna com'era: chiunque la tocca, il prossimo
   visitatore la trova intatta. */
function riseminaDemo() {
  const d = dbDel('demo');
  d.riseminaDemo();
  impostaNome(d, 'Bar Demo');
}

/* "db" come lo usa tutto il resto del programma: un rimando al database
   del locale della richiesta in corso. Fuori da una richiesta non c'e'
   nessun locale, e lo diciamo chiaramente invece di sbagliare bar.     */
const db = new Proxy({}, {
  get(t, prop) {
    if (prop in t) return t[prop];
    const d = contesto.getStore();
    if (!d) throw new Error('Nessun locale selezionato');
    const v = d[prop];
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

db.__multi = {
  registro, contesto, dbDel, infoLocale, creaLocale, pulisciCodice, riseminaDemo, DATA_DIR,
  elenco: () => registro.prepare('SELECT * FROM locali ORDER BY creato_il DESC').all(),
  segnaAccesso: (c) => registro.prepare('UPDATE locali SET ultimo_accesso=? WHERE codice=?').run(new Date().toISOString(), c),
  sospendi: (c, attivo) => registro.prepare('UPDATE locali SET attivo=? WHERE codice=?').run(attivo ? 1 : 0, pulisciCodice(c)),
};

module.exports = db;

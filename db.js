/* =====================================================================
   db.js — Database SQLite (modulo integrato node:sqlite).
   Crea lo schema e, alla prima esecuzione, inserisce i dati demo:
   3 profili con PIN, bevande con giacenza iniziale, movimenti,
   dipendenti, turni della settimana, task e richieste di cambio turno.
   ===================================================================== */
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

// DB_PATH permette di puntare il database a un disco persistente (es. su Render).
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  permissions TEXT DEFAULT 'all'
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Bottiglia',   -- Bottiglia | Cocktail
  format TEXT DEFAULT '',              -- es. "70cl"
  volume_ml REAL DEFAULT 0,            -- contenuto bottiglia (per drink cost)
  cost REAL DEFAULT 0,                 -- costo d'acquisto unitario
  price REAL DEFAULT 0,                -- prezzo singolo (valore)
  stock REAL DEFAULT 0,               -- giacenza attuale
  initial_stock REAL DEFAULT 0,       -- giacenza iniziale (primo avvio)
  threshold REAL DEFAULT 0,
  unit TEXT DEFAULT 'bott.',
  recipe TEXT DEFAULT '[]'            -- per i Cocktail: [{ing:productId, q:ml}]
);
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  type TEXT,                           -- carico | scarico | vuoto
  qty REAL,
  unit_price REAL,
  total REAL,
  source TEXT,                         -- manuale | scontrino | inventario | fornitore
  note TEXT,
  profile_id INTEGER,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'barista'
);
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  date TEXT,                           -- YYYY-MM-DD
  start TEXT, end TEXT,
  role TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  title TEXT,
  assignee_id INTEGER,
  done INTEGER DEFAULT 0,
  notify INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shift_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  type TEXT,                           -- cambio | ferie | permesso
  from_date TEXT, to_date TEXT,
  status TEXT DEFAULT 'in attesa',     -- in attesa | approvato | rifiutato
  note TEXT
);
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',              -- per mandare l'ordine su WhatsApp
  email TEXT DEFAULT '',
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                  -- es. Banco, Frigo birre, Cantina
  sort_index INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inv_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT,
  ended_at TEXT,                       -- NULL = sessione ancora aperta
  status TEXT DEFAULT 'aperta',        -- aperta | chiusa
  parziale INTEGER DEFAULT 0,          -- 1 = inventario solo di alcune postazioni
  profile_id INTEGER,
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS inv_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  location_id INTEGER,
  product_id INTEGER,
  qty REAL,                            -- puo' essere decimale: 2.4 = due bottiglie e 4/10
  atteso REAL,                         -- giacenza che il sistema si aspettava, fotografata al conteggio
  sort_index INTEGER,                  -- ordine in cui e' stato contato (per ripresentarlo uguale)
  counted_at TEXT,
  UNIQUE(session_id, location_id, product_id)
);
`);

/* ---------- migrazione: aggiunge le colonne nuove ai database già esistenti ----------
   Serve perché un data.db creato da una versione precedente non le ha ancora.
   Senza questo, aggiornare l'app romperebbe i database con i dati veri.        */
function addColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
addColumn('products', 'par_level', 'REAL DEFAULT 0');   // scorta ideale da tenere
addColumn('products', 'vendor_id', 'INTEGER');          // da chi si compra
addColumn('products', 'barcode', 'TEXT');              // codice a barre, letto con la fotocamera
// richieste di ferie e cambio turno: chi ha deciso, quando e perche'
addColumn('shift_changes', 'created_at', 'TEXT');
addColumn('shift_changes', 'decided_at', 'TEXT');
addColumn('shift_changes', 'decided_by', 'INTEGER');
addColumn('shift_changes', 'motivo', "TEXT DEFAULT ''");

/* ---------- helper date per il seed ---------- */
const iso = (d) => d.toISOString().slice(0, 10);
function mondayOfThisWeek() {
  const d = new Date(); const day = (d.getDay() + 6) % 7; // 0 = lunedì
  d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d;
}

/* I profili di accesso servono sempre: senza, nessuno potrebbe entrare.
   TUTTO IL RESTO (prodotti, dipendenti, turni, fornitori, postazioni) e'
   finto ed esiste solo per far vedere l'app. Un locale vero deve trovarla
   VUOTA e metterci la sua roba, quindi i dati demo arrivano solo se li
   chiedi con  SEED_DEMO=1  nell'ambiente.                                */
const DEMO = process.env.SEED_DEMO === '1';

function seedIfEmpty() {
  const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;

  if (count('profiles') === 0) {
    const p = db.prepare('INSERT INTO profiles (name,pin_hash,permissions) VALUES (?,?,?)');
    // permissions = lista di "capacità". 'all' = il proprietario può tutto.
    [
      ['Proprietario',           '1111', ['all']],
      ['Admin 1 · Responsabile', '2222', ['turni.manage','turni.view','task.manage','task.view','ferie.view']],
      ['Admin 2 · Barman',       '3333', ['turni.view','task.view','task.check','ferie.request','vuoti.view','vuoti.do','manuale.view']],
      ['Admin 3 · Bar Manager',  '4444', ['turni.view','task.view','vuoti.view','vuoti.do','carico.do','magazzino.view','drinkcost.view','manuale.view','ferie.view']],
    ].forEach(([n, pin, perms]) => p.run(n, bcrypt.hashSync(pin, 10), JSON.stringify(perms)));
  }

  if (DEMO && count('products') === 0) {
    const ins = db.prepare(`INSERT INTO products
      (name,category,format,volume_ml,cost,price,stock,initial_stock,threshold,unit,recipe)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    // bottiglie/ingredienti
    const bottles = [
      ['Gin',           '70cl', 700, 14.00, 14.00, 8,  4],
      ['Vodka',         '70cl', 700, 13.00, 13.00, 6,  4],
      ['Rum bianco',    '70cl', 700, 15.00, 15.00, 4,  4],
      ['Bitter Campari','1L',  1000, 12.00, 12.00, 6,  3],
      ['Vermouth rosso','1L',  1000,  8.00,  8.00, 5,  3],
      ['Aperol',        '1L',  1000, 11.00, 11.00, 6,  3],
      ['Prosecco',      '75cl', 750,  6.00,  6.00, 20, 8],
      ['Vino rosso',    '75cl', 750,  7.00,  7.00, 18, 8],
      ['Tonica',        '20cl', 200,  0.60,  0.60, 40, 18],
      ['Soda',          '20cl', 200,  0.30,  0.30, 30, 12],
      ['Birra',         '33cl', 330,  0.90,  5.00, 48, 24],
      ['Coca-Cola',     '33cl', 330,  0.50,  4.00, 36, 18],
      ['Acqua',         '50cl', 500,  0.25,  3.00, 60, 24],
    ];
    bottles.forEach(([name, fmt, vol, cost, price, stock, thr]) =>
      ins.run(name, 'Bottiglia', fmt, vol, cost, price, stock, stock, thr, 'bott.', '[]'));

    // cocktail (ricetta in ml che fa riferimento alle bottiglie per nome)
    const byName = {};
    db.prepare('SELECT id,name FROM products').all().forEach(r => byName[r.name] = r.id);
    const R = (pairs) => JSON.stringify(pairs.map(([n, q]) => ({ ing: byName[n], q })));
    const cocktails = [
      ['Negroni', 9.00, R([['Gin', 30], ['Bitter Campari', 30], ['Vermouth rosso', 30]])],
      ['Spritz', 7.00, R([['Aperol', 60], ['Prosecco', 90], ['Soda', 30]])],
      ['Gin Tonic', 8.00, R([['Gin', 50], ['Tonica', 150]])],
      ['Americano', 7.00, R([['Bitter Campari', 30], ['Vermouth rosso', 30], ['Soda', 60]])],
    ];
    cocktails.forEach(([name, price, recipe]) =>
      ins.run(name, 'Cocktail', '', 0, 0, price, 0, 0, 0, 'drink', recipe));
  }

  if (DEMO && count('employees') === 0) {
    const e = db.prepare('INSERT INTO employees (name,role) VALUES (?,?)');
    [['Marco', 'barista'], ['Luca', 'barback'], ['Giulia', 'cameriera'],
     ['Sara', 'cameriera'], ['Antonio', 'cuoco']].forEach(([n, r]) => e.run(n, r));
  }

  if (DEMO && count('shifts') === 0) {
    const emps = db.prepare('SELECT id,role FROM employees').all();
    const s = db.prepare('INSERT INTO shifts (employee_id,date,start,end,role,note) VALUES (?,?,?,?,?,?)');
    const mon = mondayOfThisWeek();
    const turni = [['10:00', '16:00'], ['16:00', '23:00']]; // mattina/sera
    for (let g = 0; g < 7; g++) {
      const d = new Date(mon); d.setDate(mon.getDate() + g);
      turni.forEach((t, idx) => {
        const emp = emps[(g + idx) % emps.length];
        s.run(emp.id, iso(d), t[0], t[1], emp.role, '');
      });
    }
  }

  if (DEMO && count('tasks') === 0) {
    const emps = db.prepare('SELECT id FROM employees').all();
    const t = db.prepare('INSERT INTO tasks (date,title,assignee_id,done,notify) VALUES (?,?,?,?,1)');
    const today = iso(new Date());
    [['Controllo scorte frigo bar', 0], ['Pulizia macchina caffè', 0],
     ['Riordino magazzino bottiglie', 0], ['Conteggio vuoti serata', 1]]
      .forEach(([title, done], i) => t.run(today, title, emps[i % emps.length].id, done));
  }

  if (DEMO && count('shift_changes') === 0) {
    const emps = db.prepare('SELECT id FROM employees').all();
    const c = db.prepare('INSERT INTO shift_changes (employee_id,type,from_date,to_date,status,note) VALUES (?,?,?,?,?,?)');
    const today = iso(new Date());
    c.run(emps[2].id, 'ferie', today, today, 'in attesa', 'Richiesta giorno di ferie');
    c.run(emps[1].id, 'cambio', today, today, 'in attesa', 'Scambio turno sera con Marco');
  }
}

/* ---------- fornitori e scorta ideale ----------
   Gira a ogni avvio ma non sovrascrive niente: riempie solo i campi vuoti,
   così su un database con dati veri aggiunge senza rovinare.                 */
/* ---------- postazioni e permessi per l'inventario ----------
   Le postazioni sono i posti del locale dove si conta separatamente.
   I permessi nuovi vanno aggiunti anche ai profili che esistono gia',
   altrimenti dopo l'aggiornamento nessuno vedrebbe l'inventario.      */
function seedInventario() {
  if (DEMO && db.prepare('SELECT COUNT(*) c FROM locations').get().c === 0) {
    const l = db.prepare('INSERT INTO locations (name,sort_index) VALUES (?,?)');
    ['Banco', 'Frigo birre e bibite', 'Magazzino', 'Cantina'].forEach((n, i) => l.run(n, i));
  }

  // aggiunge le capacita' nuove ai profili, senza toccare quelle che hanno gia'
  const nuovi = {
    'Proprietario':            [],   // ha 'all', non serve aggiungere niente
    'Admin 1 · Responsabile':  ['inventario.view', 'ferie.approve'],
    'Admin 2 · Barman':        ['inventario.view', 'inventario.do'],
    'Admin 3 · Bar Manager':   ['inventario.view', 'inventario.do', 'inventario.close'],
  };
  const upd = db.prepare('UPDATE profiles SET permissions=? WHERE id=?');
  db.prepare('SELECT id,name,permissions FROM profiles').all().forEach(p => {
    const da = nuovi[p.name]; if (!da || !da.length) return;
    const ora = JSON.parse(p.permissions || '[]');
    if (ora.includes('all')) return;
    const dopo = ora.slice();
    da.forEach(c => { if (!dopo.includes(c)) dopo.push(c); });
    if (dopo.length !== ora.length) upd.run(JSON.stringify(dopo), p.id);
  });
}

function seedVendorsAndPar() {
  if (DEMO && db.prepare('SELECT COUNT(*) c FROM vendors').get().c === 0) {
    const v = db.prepare('INSERT INTO vendors (name,phone,email,note) VALUES (?,?,?,?)');
    [
      ['Distribuzione Bevande Srl', '+39 000 0000001', 'ordini@distribuzionebevande.it', 'Liquori, amari, vermouth'],
      ['Enoteca Fornitori',         '+39 000 0000002', 'ordini@enotecafornitori.it',     'Vini e spumanti'],
      ['Beverage Point',            '+39 000 0000003', 'ordini@beveragepoint.it',        'Birre, bibite, acqua'],
    ].forEach(([n, p, e, nt]) => v.run(n, p, e, nt));
  }

  // scorta ideale: se non impostata, proponi il doppio della soglia di riordino
  db.exec('UPDATE products SET par_level = threshold * 2 WHERE par_level = 0 AND threshold > 0');

  // assegna un fornitore ai prodotti che non ce l'hanno, indovinando dal nome
  const byName = {};
  db.prepare('SELECT id,name FROM vendors').all().forEach(r => byName[r.name] = r.id);
  const gruppi = [
    [byName['Enoteca Fornitori'],         ['Prosecco', 'Vino']],
    [byName['Beverage Point'],            ['Birra', 'Coca', 'Acqua', 'Tonica', 'Soda']],
    [byName['Distribuzione Bevande Srl'], []],   // tutto il resto: liquori e amari
  ];
  const upd = db.prepare('UPDATE products SET vendor_id=? WHERE id=?');
  db.prepare("SELECT id,name FROM products WHERE category='Bottiglia' AND vendor_id IS NULL").all()
    .forEach(p => {
      const g = gruppi.find(([, chiavi]) => chiavi.some(k => p.name.includes(k))) || gruppi[2];
      if (g[0]) upd.run(g[0], p.id);
    });
}
seedIfEmpty();
seedVendorsAndPar();
seedInventario();

module.exports = db;

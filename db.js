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
`);

/* ---------- helper date per il seed ---------- */
const iso = (d) => d.toISOString().slice(0, 10);
function mondayOfThisWeek() {
  const d = new Date(); const day = (d.getDay() + 6) % 7; // 0 = lunedì
  d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d;
}

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

  if (count('products') === 0) {
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

  if (count('employees') === 0) {
    const e = db.prepare('INSERT INTO employees (name,role) VALUES (?,?)');
    [['Marco', 'barista'], ['Luca', 'barback'], ['Giulia', 'cameriera'],
     ['Sara', 'cameriera'], ['Antonio', 'cuoco']].forEach(([n, r]) => e.run(n, r));
  }

  if (count('shifts') === 0) {
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

  if (count('tasks') === 0) {
    const emps = db.prepare('SELECT id FROM employees').all();
    const t = db.prepare('INSERT INTO tasks (date,title,assignee_id,done,notify) VALUES (?,?,?,?,1)');
    const today = iso(new Date());
    [['Controllo scorte frigo bar', 0], ['Pulizia macchina caffè', 0],
     ['Riordino magazzino bottiglie', 0], ['Conteggio vuoti serata', 1]]
      .forEach(([title, done], i) => t.run(today, title, emps[i % emps.length].id, done));
  }

  if (count('shift_changes') === 0) {
    const emps = db.prepare('SELECT id FROM employees').all();
    const c = db.prepare('INSERT INTO shift_changes (employee_id,type,from_date,to_date,status,note) VALUES (?,?,?,?,?,?)');
    const today = iso(new Date());
    c.run(emps[2].id, 'ferie', today, today, 'in attesa', 'Richiesta giorno di ferie');
    c.run(emps[1].id, 'cambio', today, today, 'in attesa', 'Scambio turno sera con Marco');
  }
}
seedIfEmpty();

module.exports = db;

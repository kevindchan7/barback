/* =====================================================================
   server.js — Backend del gestionale "Barback".
   Espone le API REST e serve il frontend da /public.
   Login a PIN per i profili; token JWT; PERMESSI per ruolo (capacità).
   Avvio:  node --experimental-sqlite server.js   (o: npm start)
   ===================================================================== */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
// In locale usa 3100; in cloud (Render) usa la porta che assegna il servizio.
const PORT = process.env.PORT || 3100;
// Senza JWT_SECRET impostato, ne genera uno nuovo a ogni avvio: i token
// precedenti smettono di valere e l'app richiede di nuovo il PIN.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const now = () => new Date().toISOString();
const todayISO = () => now().slice(0, 10);
const ok = (res, d) => res.json(d);
const bad = (res, c, m) => res.status(c).json({ error: m });
const monthOf = (q) => q || now().slice(0, 7);

/* ---------------- MANUALE DIPENDENTE (regole locali + istruzioni) ---------------- */
const REGOLE_LOCALI = [
  'Lavare le mani a inizio turno e indossare la divisa pulita.',
  'HACCP: registrare le temperature dei frigoriferi due volte al giorno.',
  'Vietato fumare nelle aree interne del locale.',
  'Bicchieri/bottiglie rotti vanno segnalati subito al responsabile.',
  'A fine serata: conteggio vuoti, chiusura cassa e pulizia banco.',
  'Servire alcolici solo a maggiorenni; in caso di dubbio chiedere documento.',
];
// Passi di preparazione per il ricettario (oltre alla ricetta in ml dei prodotti)
const PREPARAZIONI = {
  'Negroni': 'Versare gin, bitter e vermouth nel bicchiere con ghiaccio. Mescolare e guarnire con scorza d\'arancia.',
  'Spritz': 'Ghiaccio nel calice, Aperol, prosecco, spruzzo di soda. Guarnire con fetta d\'arancia.',
  'Gin Tonic': 'Gin su ghiaccio abbondante, colmare con tonica fredda. Guarnire con lime.',
  'Americano': 'Bitter e vermouth su ghiaccio, allungare con soda. Guarnire con arancia.',
};

/* ---------------- AUTH ---------------- */
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return bad(res, 401, 'Token mancante');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return bad(res, 401, 'Token non valido'); }
}
// controllo permessi: 'all' (proprietario) supera tutto
function can(req, cap) { const p = req.user.permissions || []; return p.includes('all') || p.includes(cap); }
function need(cap) { return (req, res, next) => can(req, cap) ? next() : bad(res, 403, 'Permesso negato (' + cap + ')'); }

app.get('/api/profiles', (req, res) =>
  ok(res, db.prepare('SELECT id,name,permissions FROM profiles ORDER BY id').all()
    .map(p => ({ id: p.id, name: p.name, permissions: JSON.parse(p.permissions || '[]') }))));

app.post('/api/auth/pin', (req, res) => {
  const { profileId, pin } = req.body || {};
  const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
  if (!p || !bcrypt.compareSync(String(pin || ''), p.pin_hash)) return bad(res, 401, 'PIN errato');
  const permissions = JSON.parse(p.permissions || '[]');
  const token = jwt.sign({ id: p.id, name: p.name, permissions }, JWT_SECRET, { expiresIn: '12h' });
  ok(res, { token, profile: { id: p.id, name: p.name, permissions } });
});

const api = express.Router();
api.use(auth);
app.use('/api', api);

const product = (id) => db.prepare('SELECT * FROM products WHERE id=?').get(id);
function drinkCost(recipe) {
  return recipe.reduce((s, r) => {
    const ing = product(r.ing);
    if (!ing || !ing.volume_ml) return s;
    return s + (ing.cost / ing.volume_ml) * r.q;
  }, 0);
}

/* ---------------- OVERVIEW iniziale (giacenze/entrate/uscite) ---------------- */
api.get('/overview', (req, res) => {
  const m = monthOf(req.query.month);
  const bottles = db.prepare("SELECT * FROM products WHERE category='Bottiglia'").all();
  const giacenzaPezzi = bottles.reduce((s, p) => s + p.stock, 0);
  const giacenzaValore = bottles.reduce((s, p) => s + p.stock * p.cost, 0);
  const mv = db.prepare(`SELECT type, SUM(qty) q FROM movements WHERE substr(created_at,1,7)=? GROUP BY type`).all(m);
  const sum = (t) => (mv.find(x => x.type === t) || {}).q || 0;
  ok(res, {
    month: m,
    giacenzaPezzi, giacenzaValore,
    entrate: sum('carico'),
    uscite: sum('scarico') + sum('vuoto'),
    sottoSoglia: db.prepare("SELECT COUNT(*) c FROM products WHERE category='Bottiglia' AND stock<=threshold").get().c,
    primoAvvio: db.prepare('SELECT COUNT(*) c FROM movements').get().c === 0,
  });
});

/* ---------------- PRODOTTI / GIACENZE ---------------- */
api.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY category,name').all()
    .map(p => { p.recipe = JSON.parse(p.recipe || '[]'); return p; });
  ok(res, rows);
});
api.post('/products', need('magazzino.view'), (req, res) => {
  const { name, category, format, volume_ml, cost, price, stock, threshold, unit } = req.body;
  const r = db.prepare(`INSERT INTO products (name,category,format,volume_ml,cost,price,stock,initial_stock,threshold,unit,recipe)
    VALUES (?,?,?,?,?,?,?,?,?,?, '[]')`)
    .run(name, category || 'Bottiglia', format || '', +volume_ml || 0, +cost || 0, +price || 0,
      +stock || 0, +stock || 0, +threshold || 0, unit || 'bott.');
  ok(res, { id: r.lastInsertRowid });
});
api.put('/products/:id', need('magazzino.view'), (req, res) => {
  const { name, cost, price, threshold } = req.body;
  db.prepare('UPDATE products SET name=?,cost=?,price=?,threshold=? WHERE id=?')
    .run(name, +cost, +price, +threshold, req.params.id);
  ok(res, { ok: true });
});

/* ---------------- MOVIMENTI (permessi per tipo) ---------------- */
api.post('/movements', (req, res) => {
  const { productId, type, qty, source, note } = req.body;
  // permessi: carico -> carico.do ; vuoto/scarico -> vuoti.do
  const needed = type === 'carico' ? 'carico.do' : 'vuoti.do';
  if (!can(req, needed)) return bad(res, 403, 'Permesso negato (' + needed + ')');
  const p = product(productId);
  if (!p) return bad(res, 404, 'Prodotto non trovato');
  const n = Math.abs(+qty || 0);
  if (!n) return bad(res, 400, 'Quantità non valida');
  const sign = type === 'carico' ? 1 : -1;
  if (sign < 0 && p.stock < n) return bad(res, 409, 'Giacenza insufficiente: ' + p.name);
  db.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(sign * n, p.id);
  db.prepare(`INSERT INTO movements (product_id,type,qty,unit_price,total,source,note,profile_id,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(p.id, type, n, p.price, n * p.price, source || 'manuale',
    note || '', req.user.id, now());
  ok(res, { ok: true, stock: p.stock + sign * n });
});

/* ---------------- SEZ.1 — CONTEGGIO VUOTI (giorno/mese + residuo) ---------------- */
api.get('/empties', need('vuoti.view'), (req, res) => {
  const period = req.query.period === 'day' ? 'day' : 'month';
  const date = req.query.date || todayISO();
  const key = period === 'day' ? date : date.slice(0, 7);
  const len = period === 'day' ? 10 : 7;
  const rows = db.prepare(`SELECT p.id, p.name, p.unit, p.price, p.stock AS residuo,
      COALESCE(SUM(CASE WHEN mv.type IN ('vuoto','scarico') THEN mv.qty END),0) qty
    FROM products p
    LEFT JOIN movements mv ON mv.product_id=p.id AND substr(mv.created_at,1,?)=?
    WHERE p.category='Bottiglia'
    GROUP BY p.id ORDER BY qty DESC, p.name`).all(len, key);
  rows.forEach(r => r.total = r.qty * r.price);
  ok(res, { period, key, rows, totale: rows.reduce((s, r) => s + r.total, 0) });
});
// griglia del mese: per prodotto, vuoti giorno per giorno
api.get('/empties/grid', need('vuoti.view'), (req, res) => {
  const m = monthOf(req.query.month);
  const [y, mo] = m.split('-').map(Number);
  const giorni = new Date(y, mo, 0).getDate();
  const days = Array.from({ length: giorni }, (_, i) => String(i + 1).padStart(2, '0'));
  const raw = db.prepare(`SELECT p.name, substr(mv.created_at,9,2) gg, SUM(mv.qty) q
    FROM movements mv JOIN products p ON p.id=mv.product_id
    WHERE mv.type IN ('vuoto','scarico') AND substr(mv.created_at,1,7)=? AND p.category='Bottiglia'
    GROUP BY p.name, gg`).all(m);
  const map = {};
  raw.forEach(r => { (map[r.name] = map[r.name] || {})[r.gg] = r.q; });
  const rows = db.prepare("SELECT name FROM products WHERE category='Bottiglia' ORDER BY name").all()
    .map(p => ({ name: p.name, perDay: days.map(d => (map[p.name] && map[p.name][d]) || 0) }));
  ok(res, { month: m, days, rows });
});

/* ---------------- SEZ.4 — REPORT MENSILE / GIACENZE (entrato/uscito preciso) ---------------- */
api.get('/reports/monthly', need('magazzino.view'), (req, res) => {
  const m = monthOf(req.query.month);
  const rows = db.prepare(`SELECT p.id, p.name, p.unit, p.price, p.initial_stock, p.stock AS residua,
      COALESCE(SUM(CASE WHEN mv.type='carico' THEN mv.qty END),0) entrato,
      COALESCE(SUM(CASE WHEN mv.type IN ('scarico','vuoto') THEN mv.qty END),0) uscito
    FROM products p
    LEFT JOIN movements mv ON mv.product_id=p.id AND substr(mv.created_at,1,7)=?
    WHERE p.category='Bottiglia'
    GROUP BY p.id ORDER BY p.name`).all(m);
  rows.forEach(r => { r.consumato = r.uscito * r.price; r.netto = r.entrato - r.uscito; });
  ok(res, { month: m, rows,
    totaleConsumato: rows.reduce((s, r) => s + r.consumato, 0),
    sottoSoglia: db.prepare("SELECT COUNT(*) c FROM products WHERE category='Bottiglia' AND stock<=threshold").get().c });
});

/* ---------------- SEZ.3 — DRINK COST (solo bar manager/proprietario) ---------------- */
api.get('/drinkcost', need('drinkcost.view'), (req, res) => {
  const drinks = db.prepare("SELECT * FROM products WHERE category='Cocktail' ORDER BY name").all();
  ok(res, drinks.map(d => {
    const recipe = JSON.parse(d.recipe || '[]');
    const cost = drinkCost(recipe);
    return { id: d.id, name: d.name, price: d.price, cost,
      pourCost: d.price ? Math.round(cost / d.price * 100) : 0,
      recipe: recipe.map(r => ({ name: (product(r.ing) || {}).name, q: r.q })) };
  }));
});

/* ---------------- MANUALE DIPENDENTE (regole + ricettario) ---------------- */
api.get('/manuale', need('manuale.view'), (req, res) => {
  const recipes = db.prepare("SELECT * FROM products WHERE category='Cocktail' ORDER BY name").all().map(d => ({
    name: d.name, price: d.price,
    ingredienti: JSON.parse(d.recipe || '[]').map(r => ({ name: (product(r.ing) || {}).name, q: r.q })),
    preparazione: PREPARAZIONI[d.name] || '',
  }));
  ok(res, { regole: REGOLE_LOCALI, ricettario: recipes });
});

/* ---------------- SEZ.2 — TURNI / TASK (permessi) ---------------- */
api.get('/employees', (req, res) => ok(res, db.prepare('SELECT * FROM employees ORDER BY name').all()));

api.get('/shifts', need('turni.view'), (req, res) => {
  const { from, to } = req.query;
  ok(res, db.prepare(`SELECT s.*, e.name employee FROM shifts s JOIN employees e ON e.id=s.employee_id
    WHERE s.date BETWEEN ? AND ? ORDER BY s.date,s.start`).all(from || '0000', to || '9999'));
});
api.post('/shifts', need('turni.manage'), (req, res) => {
  const { employee_id, date, start, end, role, note } = req.body;
  const r = db.prepare('INSERT INTO shifts (employee_id,date,start,end,role,note) VALUES (?,?,?,?,?,?)')
    .run(employee_id, date, start, end, role || '', note || '');
  ok(res, { id: r.lastInsertRowid });
});
api.delete('/shifts/:id', need('turni.manage'), (req, res) => { db.prepare('DELETE FROM shifts WHERE id=?').run(req.params.id); ok(res, { ok: true }); });

api.get('/tasks', need('task.view'), (req, res) => {
  const date = req.query.date || todayISO();
  ok(res, db.prepare(`SELECT t.*, e.name assignee FROM tasks t LEFT JOIN employees e ON e.id=t.assignee_id
    WHERE t.date=? ORDER BY t.done, t.id`).all(date));
});
api.post('/tasks', need('task.manage'), (req, res) => {
  const { date, title, assignee_id } = req.body;
  const r = db.prepare('INSERT INTO tasks (date,title,assignee_id) VALUES (?,?,?)')
    .run(date || todayISO(), title, assignee_id || null);
  ok(res, { id: r.lastInsertRowid });
});
// spuntare una task richiede 'task.check' (oppure gestione completa)
api.put('/tasks/:id', (req, res) => {
  if (!can(req, 'task.check') && !can(req, 'task.manage')) return bad(res, 403, 'Permesso negato (task.check)');
  db.prepare('UPDATE tasks SET done=? WHERE id=?').run(req.body.done ? 1 : 0, req.params.id);
  ok(res, { ok: true });
});

api.get('/shift-changes', need('ferie.view'), (req, res) => ok(res, db.prepare(`SELECT c.*, e.name employee
  FROM shift_changes c JOIN employees e ON e.id=c.employee_id ORDER BY c.id DESC`).all()));
api.post('/shift-changes', need('ferie.request'), (req, res) => {
  const { employee_id, type, from_date, to_date, note } = req.body;
  const r = db.prepare(`INSERT INTO shift_changes (employee_id,type,from_date,to_date,note) VALUES (?,?,?,?,?)`)
    .run(employee_id, type, from_date, to_date || from_date, note || '');
  ok(res, { id: r.lastInsertRowid });
});
// approvare/rifiutare: solo chi ha 'ferie.approve' (proprietario)
api.put('/shift-changes/:id', need('ferie.approve'), (req, res) => {
  db.prepare('UPDATE shift_changes SET status=? WHERE id=?').run(req.body.status, req.params.id);
  ok(res, { ok: true });
});

app.listen(PORT, () => console.log(`Barback avviato su http://localhost:${PORT}`));

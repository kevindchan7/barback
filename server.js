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
const fs = require('fs');
const db = require('./db');
const { linguaDi, traduciErrore, REGOLE, PREPARAZIONI } = require('./messaggi');

const app = express();
// In locale usa 3100; in cloud (Render) usa la porta che assegna il servizio.
const PORT = process.env.PORT || 3100;
// Senza JWT_SECRET impostato, ne genera uno nuovo a ogni avvio: i token
// precedenti smettono di valere e l'app richiede di nuovo il PIN.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// la lingua scelta nel browser accompagna ogni richiesta: gli errori e il
// manuale escono gia' tradotti, senza che il frontend debba rimapparli
app.use((req, res, next) => { res.locals.lang = linguaDi(req); next(); });

const now = () => new Date().toISOString();
const todayISO = () => now().slice(0, 10);
const ok = (res, d) => res.json(d);
// l'errore esce nella lingua scelta nel browser (intestazione X-Lang)
const bad = (res, c, m) => res.status(c).json({ error: traduciErrore(m, res.locals.lang || 'it') });
const monthOf = (q) => q || now().slice(0, 7);


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
  ok(res, db.prepare('SELECT id,name,permissions,pin_default FROM profiles ORDER BY id').all()
    .map(p => ({ id: p.id, name: p.name, permissions: JSON.parse(p.permissions || '[]'), pin_default: !!p.pin_default }))));

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
  const rows = db.prepare(`SELECT p.*, v.name AS vendor FROM products p
    LEFT JOIN vendors v ON v.id=p.vendor_id ORDER BY p.category,p.name`).all()
    .map(p => { p.recipe = JSON.parse(p.recipe || '[]'); return p; });
  ok(res, rows);
});
api.post('/products', need('magazzino.view'), (req, res) => {
  const { category, format, volume_ml, stock, threshold, par_level, unit, vendor_id, barcode } = req.body;
  const name = String(req.body.name || '').trim();
  if (!name) return bad(res, 400, 'Serve il nome del prodotto');
  if (db.prepare('SELECT 1 FROM products WHERE lower(name)=lower(?)').get(name))
    return bad(res, 409, 'C\'e\' gia\' un prodotto con questo nome');
  const code = String(barcode || '').trim();
  if (code && db.prepare('SELECT name FROM products WHERE barcode=?').get(code))
    return bad(res, 409, 'Codice a barre già usato da un altro prodotto');
  // la scorta ideale, se non la dici, la propongo al doppio della soglia
  const soglia = +threshold || 0;
  const ideale = par_level === undefined || par_level === '' ? soglia * 2 : +par_level || 0;
  const r = db.prepare(`INSERT INTO products
    (name,category,format,volume_ml,cost,price,stock,initial_stock,threshold,par_level,unit,vendor_id,barcode,recipe)
    VALUES (?,?,?,?,0,0,?,?,?,?,?,?,?, '[]')`)
    .run(name, category || 'Bottiglia', String(format || '').trim(), +volume_ml || 0,
      +stock || 0, +stock || 0, soglia, ideale, String(unit || 'bott.').trim(),
      vendor_id ? +vendor_id : null, code || null);
  ok(res, { id: r.lastInsertRowid });
});
api.put('/products/:id', need('magazzino.view'), (req, res) => {
  const { name, cost, price, threshold, par_level, vendor_id } = req.body;
  db.prepare('UPDATE products SET name=?,cost=?,price=?,threshold=?,par_level=?,vendor_id=? WHERE id=?')
    .run(name, +cost, +price, +threshold, +par_level || 0, vendor_id ? +vendor_id : null, req.params.id);
  ok(res, { ok: true });
});


/* ---------------- ELIMINARE UN PRODOTTO ----------------
   Si rifiuta se il prodotto ha una storia: cancellarlo falserebbe
   inventari e report gia' chiusi. Meglio dire perche' non si puo'.   */
api.delete('/products/:id', need('magazzino.view'), (req, res) => {
  const p = product(req.params.id);
  if (!p) return bad(res, 404, 'Prodotto non trovato');
  const mv = db.prepare('SELECT COUNT(*) c FROM movements WHERE product_id=?').get(p.id).c;
  const co = db.prepare('SELECT COUNT(*) c FROM inv_counts WHERE product_id=?').get(p.id).c;
  if (mv || co) return bad(res, 409,
    `"${p.name}" ha ${mv} movimenti e ${co} conteggi: eliminarlo falserebbe lo storico. Puoi portare la giacenza a zero.`);
  // se e' ingrediente di un cocktail, va togliato prima dalla ricetta
  const usato = db.prepare("SELECT name FROM products WHERE category='Cocktail' AND recipe LIKE ?").all('%"ing":' + p.id + ',%');
  if (usato.length) return bad(res, 409, 'Usato nella ricetta di: ' + usato.map(x => x.name).join(', '));
  db.prepare('DELETE FROM products WHERE id=?').run(p.id);
  ok(res, { ok: true });
});

/* ---------------- PERSONALE ----------------
   Finora i dipendenti si potevano solo leggere: un locale nuovo non
   riusciva a inserire i propri. Ora si aggiungono e si modificano.   */
api.post('/employees', need('turni.manage'), (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return bad(res, 400, 'Serve il nome');
  if (db.prepare('SELECT 1 FROM employees WHERE lower(name)=lower(?)').get(name))
    return bad(res, 409, 'C\'e\' gia\' un dipendente con questo nome');
  const r = db.prepare('INSERT INTO employees (name,role) VALUES (?,?)')
    .run(name, String(req.body.role || 'barista').trim());
  ok(res, { id: r.lastInsertRowid });
});
api.put('/employees/:id', need('turni.manage'), (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return bad(res, 400, 'Serve il nome');
  db.prepare('UPDATE employees SET name=?, role=? WHERE id=?')
    .run(name, String(req.body.role || '').trim(), req.params.id);
  ok(res, { ok: true });
});
api.delete('/employees/:id', need('turni.manage'), (req, res) => {
  const e = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!e) return bad(res, 404, 'Dipendente non trovato');
  const t = db.prepare('SELECT COUNT(*) c FROM shifts WHERE employee_id=?').get(e.id).c;
  const r = db.prepare('SELECT COUNT(*) c FROM shift_changes WHERE employee_id=?').get(e.id).c;
  if (t || r) return bad(res, 409,
    `${e.name} ha ${t} turni e ${r} richieste. Elimina prima quelli, oppure lascialo: non fa danno.`);
  db.prepare('DELETE FROM tasks WHERE assignee_id=?').run(e.id);
  db.prepare('DELETE FROM employees WHERE id=?').run(e.id);
  ok(res, { ok: true });
});

/* ---------------- PROFILI DI ACCESSO E PIN ----------------
   Prima i PIN erano scritti nel codice e nessuno poteva cambiarli.
   Ora: ognuno cambia il proprio (dicendo quello attuale) e il
   proprietario puo' reimpostarli, crearne e rinominarli.            */
const RUOLI = {
  'proprietario': ['all'],
  'responsabile': ['turni.manage','turni.view','task.manage','task.view','ferie.view','ferie.approve','inventario.view'],
  'barman':       ['turni.view','task.view','task.check','ferie.request','vuoti.view','vuoti.do','manuale.view','inventario.view','inventario.do'],
  'bar manager':  ['turni.view','task.view','vuoti.view','vuoti.do','carico.do','magazzino.view','manuale.view','ferie.view','inventario.view','inventario.do','inventario.close'],
};
const pinValido = (p) => /^[0-9]{4}$/.test(String(p || ''));

api.get('/ruoli', (req, res) => ok(res, Object.keys(RUOLI)));

api.post('/profiles', need('all'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const ruolo = String(req.body.ruolo || '').toLowerCase();
  if (!name) return bad(res, 400, 'Serve il nome del profilo');
  if (!RUOLI[ruolo]) return bad(res, 400, 'Ruolo non valido');
  if (!pinValido(req.body.pin)) return bad(res, 400, 'Il PIN deve essere di 4 cifre');
  if (db.prepare('SELECT 1 FROM profiles WHERE lower(name)=lower(?)').get(name))
    return bad(res, 409, 'C\'e\' gia\' un profilo con questo nome');
  const r = db.prepare('INSERT INTO profiles (name,pin_hash,permissions) VALUES (?,?,?)')
    .run(name, bcrypt.hashSync(String(req.body.pin), 10), JSON.stringify(RUOLI[ruolo]));
  ok(res, { id: r.lastInsertRowid });
});

api.put('/profiles/:id', need('all'), (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return bad(res, 400, 'Serve il nome');
  const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(req.params.id);
  if (!p) return bad(res, 404, 'Profilo non trovato');
  if (req.body.ruolo) {
    const ruolo = String(req.body.ruolo).toLowerCase();
    if (!RUOLI[ruolo]) return bad(res, 400, 'Ruolo non valido');
    // non si toglie l'ultimo accesso completo, o nessuno potrebbe piu' amministrare
    const perms = JSON.parse(p.permissions || '[]');
    if (perms.includes('all') && !RUOLI[ruolo].includes('all')) {
      const altri = db.prepare("SELECT COUNT(*) c FROM profiles WHERE id<>? AND permissions LIKE '%\"all\"%'").get(p.id).c;
      if (!altri) return bad(res, 409, 'E\' l\'unico profilo con accesso completo: non puoi declassarlo');
    }
    db.prepare('UPDATE profiles SET name=?, permissions=? WHERE id=?').run(name, JSON.stringify(RUOLI[ruolo]), p.id);
  } else {
    db.prepare('UPDATE profiles SET name=? WHERE id=?').run(name, p.id);
  }
  ok(res, { ok: true });
});

// cambio PIN: il proprio richiede quello attuale, il proprietario reimposta
api.put('/profiles/:id/pin', (req, res) => {
  const id = +req.params.id;
  const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
  if (!p) return bad(res, 404, 'Profilo non trovato');
  const proprio = req.user.id === id;
  if (!proprio && !can(req, 'all')) return bad(res, 403, 'Puoi cambiare solo il tuo PIN');
  if (!pinValido(req.body.nuovo)) return bad(res, 400, 'Il nuovo PIN deve essere di 4 cifre');
  if (proprio && !bcrypt.compareSync(String(req.body.attuale || ''), p.pin_hash))
    return bad(res, 401, 'Il PIN attuale non e\' giusto');
  // cambiato il PIN, il profilo non e' piu' quello di fabbrica
  db.prepare('UPDATE profiles SET pin_hash=?, pin_default=0 WHERE id=?').run(bcrypt.hashSync(String(req.body.nuovo), 10), id);
  ok(res, { ok: true });
});

api.delete('/profiles/:id', need('all'), (req, res) => {
  const id = +req.params.id;
  if (req.user.id === id) return bad(res, 409, 'Non puoi eliminare il profilo con cui sei entrato');
  const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
  if (!p) return bad(res, 404, 'Profilo non trovato');
  if (db.prepare('SELECT COUNT(*) c FROM profiles').get().c <= 1) return bad(res, 409, 'Deve restare almeno un profilo');
  db.prepare('DELETE FROM profiles WHERE id=?').run(id);
  ok(res, { ok: true });
});
/* ---------------- FORNITORI ---------------- */
api.get('/vendors', (req, res) => ok(res, db.prepare('SELECT * FROM vendors ORDER BY name').all()));
api.post('/vendors', need('magazzino.view'), (req, res) => {
  const { name, phone, email, note } = req.body;
  if (!name) return bad(res, 400, 'Serve il nome del fornitore');
  const r = db.prepare('INSERT INTO vendors (name,phone,email,note) VALUES (?,?,?,?)')
    .run(name, phone || '', email || '', note || '');
  ok(res, { id: r.lastInsertRowid });
});
api.put('/vendors/:id', need('magazzino.view'), (req, res) => {
  const { name, phone, email, note } = req.body;
  db.prepare('UPDATE vendors SET name=?,phone=?,email=?,note=? WHERE id=?')
    .run(name, phone || '', email || '', note || '', req.params.id);
  ok(res, { ok: true });
});
api.delete('/vendors/:id', need('magazzino.view'), (req, res) => {
  // i prodotti restano, semplicemente senza fornitore
  db.prepare('UPDATE products SET vendor_id=NULL WHERE vendor_id=?').run(req.params.id);
  db.prepare('DELETE FROM vendors WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ---------------- ORDINE SUGGERITO (raggruppato per fornitore) ----------------
   Prende i prodotti arrivati alla soglia e calcola quanto ordinare per
   riportarli alla scorta ideale (par_level). Raggruppa per fornitore, così
   ogni gruppo diventa un ordine da mandare.                                  */
api.get('/orders/suggested', need('magazzino.view'), (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.name, p.format, p.unit, p.cost, p.stock,
      p.threshold, p.par_level, p.vendor_id,
      COALESCE(v.name,'Senza fornitore') vendor, COALESCE(v.phone,'') phone, COALESCE(v.email,'') email
    FROM products p LEFT JOIN vendors v ON v.id=p.vendor_id
    WHERE p.category='Bottiglia' AND p.stock <= p.threshold AND p.par_level > p.stock
    ORDER BY vendor, p.name`).all();
  const gruppi = [];
  rows.forEach(r => {
    const qty = Math.ceil(r.par_level - r.stock);
    let g = gruppi.find(x => x.vendor === r.vendor);
    if (!g) { g = { vendor: r.vendor, vendor_id: r.vendor_id, phone: r.phone, email: r.email, righe: [], totale: 0 }; gruppi.push(g); }
    g.righe.push({ id: r.id, name: r.name, format: r.format, unit: r.unit,
      stock: r.stock, threshold: r.threshold, par_level: r.par_level, qty, costo: qty * r.cost });
    g.totale += qty * r.cost;
  });
  ok(res, { gruppi, totale: gruppi.reduce((s, g) => s + g.totale, 0), prodotti: rows.length });
});

/* ---------------- MOVIMENTI (permessi per tipo) ---------------- */
api.post('/movements', (req, res) => {
  const { productId, type, qty, source, note } = req.body;
  // permessi: carico -> carico.do ; vuoto/scarico -> vuoti.do
  // solo questi tre tipi a mano: 'rettifica' la crea solo la chiusura dell'inventario
  if (!['carico', 'scarico', 'vuoto'].includes(type)) return bad(res, 400, 'Tipo di movimento non valido');
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
      p.threshold, p.par_level, COALESCE(v.name,'') vendor,
      COALESCE(SUM(CASE WHEN mv.type='carico' THEN mv.qty END),0) entrato,
      COALESCE(SUM(CASE WHEN mv.type IN ('scarico','vuoto') THEN mv.qty END),0) uscito
    FROM products p LEFT JOIN vendors v ON v.id=p.vendor_id
    LEFT JOIN movements mv ON mv.product_id=p.id AND substr(mv.created_at,1,7)=?
    WHERE p.category='Bottiglia'
    GROUP BY p.id ORDER BY p.name`).all(m);
  rows.forEach(r => { r.consumato = r.uscito * r.price; r.netto = r.entrato - r.uscito;
    // quanto ordinare per tornare alla scorta ideale (0 se non serve)
    r.daOrdinare = (r.residua <= r.threshold && r.par_level > r.residua) ? Math.ceil(r.par_level - r.residua) : 0; });
  ok(res, { month: m, rows,
    totaleConsumato: rows.reduce((s, r) => s + r.consumato, 0),
    sottoSoglia: db.prepare("SELECT COUNT(*) c FROM products WHERE category='Bottiglia' AND stock<=threshold").get().c });
});

/* ---------------- POSTAZIONI ----------------
   I posti del locale dove si conta separatamente: banco, frigo, cantina.  */
api.get('/locations', (req, res) =>
  ok(res, db.prepare('SELECT * FROM locations ORDER BY sort_index, name').all()));
api.post('/locations', need('magazzino.view'), (req, res) => {
  const { name } = req.body;
  if (!name) return bad(res, 400, 'Serve il nome della postazione');
  const max = db.prepare('SELECT COALESCE(MAX(sort_index),-1) m FROM locations').get().m;
  const r = db.prepare('INSERT INTO locations (name,sort_index) VALUES (?,?)').run(name, max + 1);
  ok(res, { id: r.lastInsertRowid });
});
api.delete('/locations/:id', need('magazzino.view'), (req, res) => {
  if (db.prepare('SELECT COUNT(*) c FROM inv_counts WHERE location_id=?').get(req.params.id).c)
    return bad(res, 409, 'Postazione usata in un inventario: non si puo\' eliminare');
  db.prepare('DELETE FROM locations WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ---------------- INVENTARIO: SESSIONE DI CONTEGGIO ----------------
   Un inventario e' una sessione: si apre, si gira postazione per postazione,
   si rivede e solo alla fine si chiude applicando le rettifiche.
   Finche' e' aperta si puo' interrompere e riprendere.                    */

// la sessione aperta, se c'e' (ce n'e' al massimo una alla volta)
function sessioneAperta() {
  return db.prepare("SELECT * FROM inv_sessions WHERE status='aperta' ORDER BY id DESC").get() || null;
}
api.get('/inventory/open', need('inventario.view'), (req, res) => {
  const s = sessioneAperta();
  if (!s) return ok(res, { sessione: null });
  const fatte = db.prepare(`SELECT location_id, COUNT(*) n FROM inv_counts
    WHERE session_id=? GROUP BY location_id`).all(s.id);
  ok(res, { sessione: s, perPostazione: fatte,
    contati: db.prepare('SELECT COUNT(DISTINCT product_id) c FROM inv_counts WHERE session_id=?').get(s.id).c });
});

api.post('/inventory/start', need('inventario.do'), (req, res) => {
  const aperta = sessioneAperta();
  if (aperta) return ok(res, { id: aperta.id, ripresa: true });   // non se ne aprono due
  const r = db.prepare(`INSERT INTO inv_sessions (started_at,status,profile_id,note)
    VALUES (?, 'aperta', ?, ?)`).run(now(), req.user.id, req.body.note || '');
  ok(res, { id: r.lastInsertRowid, ripresa: false });
});

/* lista prodotti da contare in una postazione.
   Ordine: 'ultimo' ripresenta la sequenza dell'ultimo inventario chiuso in
   quella postazione (si cammina lungo gli scaffali), altrimenti alfabetico. */
api.get('/inventory/:id/items', need('inventario.view'), (req, res) => {
  const sid = +req.params.id, lid = +req.query.location_id;
  if (!lid) return bad(res, 400, 'Serve la postazione');
  const ordine = req.query.sort === 'ultimo' ? 'ultimo' : 'nome';
  const prods = db.prepare(`SELECT p.id, p.name, p.format, p.unit, p.stock, p.barcode,
      p.volume_ml, COALESCE(v.name,'') vendor
    FROM products p LEFT JOIN vendors v ON v.id=p.vendor_id
    WHERE p.category='Bottiglia' ORDER BY p.name`).all();

  // conteggi gia' inseriti in questa sessione/postazione
  const gia = {};
  db.prepare('SELECT product_id, qty FROM inv_counts WHERE session_id=? AND location_id=?')
    .all(sid, lid).forEach(r => gia[r.product_id] = r.qty);

  // ordine dell'ultimo inventario chiuso nella stessa postazione
  const memoria = {};
  const ultima = db.prepare(`SELECT s.id FROM inv_sessions s JOIN inv_counts c ON c.session_id=s.id
    WHERE s.status='chiusa' AND c.location_id=? ORDER BY s.id DESC LIMIT 1`).get(lid);
  if (ultima) db.prepare('SELECT product_id, sort_index FROM inv_counts WHERE session_id=? AND location_id=?')
    .all(ultima.id, lid).forEach(r => memoria[r.product_id] = r.sort_index);

  prods.forEach(p => {
    p.contato = (p.id in gia) ? gia[p.id] : null;
    p.ordineMemoria = (p.id in memoria) ? memoria[p.id] : 9999;
  });
  if (ordine === 'ultimo') prods.sort((a, b) => a.ordineMemoria - b.ordineMemoria || a.name.localeCompare(b.name));
  ok(res, { sort: ordine, haMemoria: !!ultima, rows: prods });
});

// registra (o corregge) il conteggio di un prodotto in una postazione
api.post('/inventory/:id/count', need('inventario.do'), (req, res) => {
  const sid = +req.params.id;
  const s = db.prepare("SELECT * FROM inv_sessions WHERE id=? AND status='aperta'").get(sid);
  if (!s) return bad(res, 409, 'Sessione non aperta');
  const { location_id, product_id, qty } = req.body;
  const p = product(product_id);
  if (!p) return bad(res, 404, 'Prodotto non trovato');
  const n = Math.max(0, Number(qty) || 0);

  // "atteso" = giacenza che il sistema si aspettava, fotografata al primo
  // conteggio di questo prodotto nella sessione (le postazioni si sommano)
  const esistente = db.prepare('SELECT atteso FROM inv_counts WHERE session_id=? AND product_id=? LIMIT 1').get(sid, product_id);
  const atteso = esistente ? esistente.atteso : p.stock;
  const max = db.prepare('SELECT COALESCE(MAX(sort_index),-1) m FROM inv_counts WHERE session_id=? AND location_id=?').get(sid, location_id).m;
  const precedente = db.prepare('SELECT id, sort_index FROM inv_counts WHERE session_id=? AND location_id=? AND product_id=?').get(sid, location_id, product_id);

  if (precedente) {
    db.prepare('UPDATE inv_counts SET qty=?, counted_at=? WHERE id=?').run(n, now(), precedente.id);
  } else {
    db.prepare(`INSERT INTO inv_counts (session_id,location_id,product_id,qty,atteso,sort_index,counted_at)
      VALUES (?,?,?,?,?,?,?)`).run(sid, location_id, product_id, n, atteso, max + 1, now());
  }
  ok(res, { ok: true, atteso });
});

api.delete('/inventory/:id/count', need('inventario.do'), (req, res) => {
  db.prepare('DELETE FROM inv_counts WHERE session_id=? AND location_id=? AND product_id=?')
    .run(req.params.id, req.body.location_id, req.body.product_id);
  ok(res, { ok: true });
});

/* revisione: cosa hai contato, cosa si aspettava il sistema, e la differenza.
   Qui nasce il punto 3 (scostamento): la differenza fra atteso e contato e'
   consumo non registrato — spreco, bicchieri pesanti, ammanchi, errori.    */
api.get('/inventory/:id/review', need('inventario.view'), (req, res) => {
  const sid = +req.params.id;
  const s = db.prepare('SELECT * FROM inv_sessions WHERE id=?').get(sid);
  if (!s) return bad(res, 404, 'Sessione non trovata');

  const contati = db.prepare(`SELECT c.product_id, p.name, p.unit, p.format, p.cost, p.price,
      SUM(c.qty) contato, MAX(c.atteso) atteso,
      GROUP_CONCAT(l.name, ' + ') postazioni
    FROM inv_counts c JOIN products p ON p.id=c.product_id
    LEFT JOIN locations l ON l.id=c.location_id
    WHERE c.session_id=? GROUP BY c.product_id ORDER BY p.name`).all(sid);

  contati.forEach(r => {
    r.differenza = +(r.contato - r.atteso).toFixed(2);
    r.valore = +(r.differenza * r.cost).toFixed(2);     // quanto vale lo scostamento
    r.segnala = r.differenza !== 0;
  });

  // prodotti che non sono stati contati affatto: in revisione vanno in rosso
  const nonContati = db.prepare(`SELECT p.id, p.name, p.unit, p.stock FROM products p
    WHERE p.category='Bottiglia' AND p.id NOT IN (SELECT product_id FROM inv_counts WHERE session_id=?)
    ORDER BY p.name`).all(sid);

  const mancanti = contati.filter(r => r.differenza < 0);
  const eccedenze = contati.filter(r => r.differenza > 0);
  ok(res, { sessione: s, rows: contati, nonContati,
    riepilogo: {
      contati: contati.length,
      nonContati: nonContati.length,
      conScostamento: contati.filter(r => r.segnala).length,
      valoreMancante: +mancanti.reduce((t, r) => t + r.valore, 0).toFixed(2),
      valoreEccedenza: +eccedenze.reduce((t, r) => t + r.valore, 0).toFixed(2),
      valoreNetto: +contati.reduce((t, r) => t + r.valore, 0).toFixed(2),
    } });
});

/* chiusura: allinea le giacenze a quanto hai contato e registra le rettifiche.
   I prodotti non contati si possono lasciare come stanno ('tieni') o azzerare.
   Le rettifiche sono movimenti di tipo 'rettifica': NON entrano nei consumi
   del report mensile, altrimenti falserebbero il venduto.                  */
api.post('/inventory/:id/close', need('inventario.close'), (req, res) => {
  const sid = +req.params.id;
  const s = db.prepare("SELECT * FROM inv_sessions WHERE id=? AND status='aperta'").get(sid);
  if (!s) return bad(res, 409, 'Sessione non aperta');
  const nonContati = req.body.nonContati === 'azzera' ? 'azzera' : 'tieni';

  const righe = db.prepare(`SELECT c.product_id, SUM(c.qty) contato, MAX(c.atteso) atteso
    FROM inv_counts c WHERE c.session_id=? GROUP BY c.product_id`).all(sid);

  const mv = db.prepare(`INSERT INTO movements (product_id,type,qty,unit_price,total,source,note,profile_id,created_at)
    VALUES (?,'rettifica',?,?,?,'inventario',?,?,?)`);
  const setStock = db.prepare('UPDATE products SET stock=? WHERE id=?');
  let rettifiche = 0;

  righe.forEach(r => {
    const diff = +(r.contato - r.atteso).toFixed(2);
    setStock.run(r.contato, r.product_id);
    if (diff !== 0) {
      const p = product(r.product_id);
      mv.run(r.product_id, Math.abs(diff), p.cost, Math.abs(diff) * p.cost,
        `Inventario #${sid}: atteso ${r.atteso}, contato ${r.contato}`, req.user.id, now());
      rettifiche++;
    }
  });

  if (nonContati === 'azzera') {
    const zero = db.prepare(`SELECT id, stock FROM products WHERE category='Bottiglia'
      AND id NOT IN (SELECT product_id FROM inv_counts WHERE session_id=?)`).all(sid);
    zero.forEach(p => {
      if (p.stock !== 0) {
        const pr = product(p.id);
        mv.run(p.id, p.stock, pr.cost, p.stock * pr.cost, `Inventario #${sid}: non contato, azzerato`, req.user.id, now());
        rettifiche++;
      }
      setStock.run(0, p.id);
    });
  }

  db.prepare("UPDATE inv_sessions SET status='chiusa', ended_at=?, parziale=?, note=? WHERE id=?")
    .run(req.body.data || now(), nonContati === 'tieni' ? 1 : 0, req.body.note || s.note, sid);
  ok(res, { ok: true, prodotti: righe.length, rettifiche });
});

api.delete('/inventory/:id', need('inventario.close'), (req, res) => {
  const s = db.prepare("SELECT * FROM inv_sessions WHERE id=? AND status='aperta'").get(req.params.id);
  if (!s) return bad(res, 409, 'Si possono annullare solo le sessioni aperte');
  db.prepare('DELETE FROM inv_counts WHERE session_id=?').run(req.params.id);
  db.prepare('DELETE FROM inv_sessions WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});

/* ---------------- STORICO INVENTARI (punto 6) ----------------
   Ogni conteggio chiuso resta qui, con il suo scostamento in valore, per
   confrontare nel tempo. Nessun limite di mesi.                            */
api.get('/inventory/history', need('inventario.view'), (req, res) => {
  const rows = db.prepare(`SELECT s.*, pr.name AS operatore,
      (SELECT COUNT(DISTINCT product_id) FROM inv_counts WHERE session_id=s.id) prodotti
    FROM inv_sessions s LEFT JOIN profiles pr ON pr.id=s.profile_id
    WHERE s.status='chiusa' ORDER BY s.id DESC LIMIT 60`).all();
  rows.forEach(s => {
    // le postazioni si sommano PRIMA del confronto: un prodotto contato in due
    // posti ha un solo "atteso", altrimenti lo sottrarremmo due volte
    const v = db.prepare(`SELECT COALESCE(SUM(d.diff * d.cost),0) v,
        COALESCE(SUM(CASE WHEN d.diff <> 0 THEN 1 ELSE 0 END),0) n
      FROM (SELECT c.product_id, (SUM(c.qty) - MAX(c.atteso)) diff, MAX(p.cost) cost
            FROM inv_counts c JOIN products p ON p.id=c.product_id
            WHERE c.session_id=? GROUP BY c.product_id) d`).get(s.id);
    s.valoreScostamento = +v.v.toFixed(2);
    s.conScostamento = v.n;
  });
  ok(res, rows);
});

/* ---------------- CODICE A BARRE (punto 1) ----------------
   La prima volta si associa il codice al prodotto, poi viene riconosciuto. */
api.get('/products/barcode/:code', need('inventario.view'), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE barcode=? AND barcode<>''").get(req.params.code);
  if (!p) return bad(res, 404, 'Codice non associato a nessun prodotto');
  ok(res, p);
});
api.put('/products/:id/barcode', need('inventario.do'), (req, res) => {
  const code = String(req.body.barcode || '').trim();
  if (!code) return bad(res, 400, 'Codice vuoto');
  const altro = db.prepare('SELECT id,name FROM products WHERE barcode=? AND id<>?').get(code, req.params.id);
  if (altro) return bad(res, 409, 'Codice già associato a: ' + altro.name);
  db.prepare('UPDATE products SET barcode=? WHERE id=?').run(code, req.params.id);
  ok(res, { ok: true });
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

/* ---------------- FOOD COST (solo chi ha il permesso) ----------------
   L'app non mostra soldi a nessuno: li vede solo chi ha drinkcost.view,
   cioe' in pratica il proprietario. Qui stanno tutti insieme i numeri
   che servono a decidere un prezzo:
     - quanto costa versare un cocktail, ingrediente per ingrediente
     - il pour cost, cioe' quanta parte del prezzo se ne va in prodotto
     - quanto vale la merce ferma in magazzino
     - quanto e' costato l'ultimo scostamento d'inventario
   L'ultimo e' quello che fa male e che nessun foglio Excel ti dice.   */
api.get('/foodcost', need('drinkcost.view'), (req, res) => {
  const bottiglie = db.prepare("SELECT * FROM products WHERE category='Bottiglia' ORDER BY name").all();
  const drinks = db.prepare("SELECT * FROM products WHERE category='Cocktail' ORDER BY name").all();

  const cocktails = drinks.map(d => {
    const ricetta = JSON.parse(d.recipe || '[]').map(r => {
      const ing = product(r.ing);
      const costo = (ing && ing.volume_ml) ? (ing.cost / ing.volume_ml) * r.q : 0;
      return { id: r.ing, nome: ing ? ing.name : '?', q: r.q, costo: +costo.toFixed(4),
               senzaCosto: !!(ing && (!ing.cost || !ing.volume_ml)) };
    });
    const costo = ricetta.reduce((s, r) => s + r.costo, 0);
    return {
      id: d.id, nome: d.name, prezzo: d.price,
      costo: +costo.toFixed(4),
      margine: +(d.price - costo).toFixed(4),
      pourCost: d.price ? +(costo / d.price * 100).toFixed(1) : null,
      ricetta,
      // un prezzo calcolato non si impone: si propone. 22% e' il
      // riferimento comune per i distillati in un bar.
      prezzoSuggerito: costo ? +(costo / 0.22).toFixed(2) : null,
    };
  });

  const bott = bottiglie.map(p => ({
    id: p.id, nome: p.name, formato: p.format,
    costo: p.cost, volume_ml: p.volume_ml,
    costoMl: p.volume_ml ? +(p.cost / p.volume_ml).toFixed(4) : null,
    giacenza: p.stock,
    valore: +(p.stock * p.cost).toFixed(2),
    incompleto: !p.cost || !p.volume_ml,
  }));

  /* quanto e' costato l'ultimo inventario chiuso */
  let ultimoScostamento = null;
  const s = db.prepare("SELECT * FROM inv_sessions WHERE stato='chiusa' ORDER BY id DESC LIMIT 1").get();
  if (s) {
    const v = db.prepare(`SELECT COALESCE(SUM(d.diff * d.cost),0) valore,
        COALESCE(SUM(CASE WHEN d.diff <> 0 THEN 1 ELSE 0 END),0) righe
      FROM (SELECT c.product_id, (SUM(c.qty) - MAX(c.atteso)) diff, MAX(p.cost) cost
            FROM inv_counts c JOIN products p ON p.id=c.product_id
            WHERE c.session_id=? GROUP BY c.product_id) d`).get(s.id);
    ultimoScostamento = { data: s.chiusa_il || s.aperta_il, valore: +(v.valore || 0).toFixed(2), righe: v.righe };
  }

  ok(res, {
    cocktails, bottiglie: bott,
    totali: {
      valoreMagazzino: +bott.reduce((t, b) => t + b.valore, 0).toFixed(2),
      pourCostMedio: (() => {
        const con = cocktails.filter(c => c.pourCost !== null);
        return con.length ? +(con.reduce((t, c) => t + c.pourCost, 0) / con.length).toFixed(1) : null;
      })(),
      daCompletare: bott.filter(b => b.incompleto).length,
    },
    ultimoScostamento,
  });
});

/* ---------------- MANUALE DIPENDENTE (regole + ricettario) ---------------- */
api.get('/manuale', need('manuale.view'), (req, res) => {
  const recipes = db.prepare("SELECT * FROM products WHERE category='Cocktail' ORDER BY name").all().map(d => ({
    name: d.name, price: d.price,
    ingredienti: JSON.parse(d.recipe || '[]').map(r => ({ name: (product(r.ing) || {}).name, q: r.q })),
    preparazione: (PREPARAZIONI[res.locals.lang] || PREPARAZIONI.it)[d.name] || '',
  }));
  ok(res, { regole: REGOLE[res.locals.lang] || REGOLE.it, ricettario: recipes });
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

/* ---------------- RICHIESTE: FERIE, PERMESSI, CAMBI TURNO ----------------
   Due ruoli. Chi chiede compila tipo, periodo e motivo. Chi approva vede
   anche QUALI TURNI resterebbero scoperti in quel periodo: e' l'unica
   informazione che serve davvero per decidere, e prima non c'era.      */

// i turni del dipendente che cadono nel periodo richiesto
function turniNelPeriodo(employee_id, from_date, to_date) {
  return db.prepare(`SELECT date, start, end, role FROM shifts
    WHERE employee_id=? AND date BETWEEN ? AND ? ORDER BY date, start`)
    .all(employee_id, from_date, to_date || from_date);
}

// chi puo' chiedere deve poter vedere lo stato di cio' che ha chiesto:
// non basta 'ferie.view', altrimenti il barman invia e poi riceve 403
api.get('/shift-changes', (req, res) => {
  if (!can(req, 'ferie.view') && !can(req, 'ferie.request')) return bad(res, 403, 'Permesso negato (ferie.view)');
  const rows = db.prepare(`SELECT c.*, e.name employee, e.role employee_role,
      p.name AS deciso_da
    FROM shift_changes c
    JOIN employees e ON e.id=c.employee_id
    LEFT JOIN profiles p ON p.id=c.decided_by
    ORDER BY (c.status='in attesa') DESC, c.id DESC`).all();
  rows.forEach(r => {
    r.giorni = giorniTra(r.from_date, r.to_date);
    r.turniScoperti = r.status === 'rifiutato' ? [] : turniNelPeriodo(r.employee_id, r.from_date, r.to_date);
  });
  ok(res, { rows, inAttesa: rows.filter(r => r.status === 'in attesa').length });
});

// quanti giorni copre la richiesta, estremi inclusi
function giorniTra(a, b) {
  if (!a) return 0;
  const d1 = new Date(a + 'T00:00'), d2 = new Date((b || a) + 'T00:00');
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
}

api.post('/shift-changes', need('ferie.request'), (req, res) => {
  const { employee_id, type, from_date, to_date, note } = req.body;
  if (!employee_id) return bad(res, 400, 'Scegli il dipendente');
  if (!['cambio', 'ferie', 'permesso'].includes(type)) return bad(res, 400, 'Tipo non valido');
  if (!from_date) return bad(res, 400, 'Serve la data di inizio');
  const fine = to_date || from_date;
  if (fine < from_date) return bad(res, 400, 'La data di fine viene prima di quella di inizio');
  if (!db.prepare('SELECT 1 FROM employees WHERE id=?').get(employee_id)) return bad(res, 404, 'Dipendente non trovato');

  // due richieste sovrapposte in attesa per la stessa persona sono un errore
  const sovrapposta = db.prepare(`SELECT id FROM shift_changes
    WHERE employee_id=? AND status='in attesa' AND from_date<=? AND to_date>=?`).get(employee_id, fine, from_date);
  if (sovrapposta) return bad(res, 409, 'C\'e\' gia\' una richiesta in attesa che copre quei giorni');

  const r = db.prepare(`INSERT INTO shift_changes (employee_id,type,from_date,to_date,note,status,created_at)
    VALUES (?,?,?,?,?, 'in attesa', ?)`).run(employee_id, type, from_date, fine, note || '', now());
  ok(res, { id: r.lastInsertRowid, turniScoperti: turniNelPeriodo(employee_id, from_date, fine).length });
});

// approvare o rifiutare, con la possibilita' di spiegare perche'
api.put('/shift-changes/:id', need('ferie.approve'), (req, res) => {
  const { status, motivo } = req.body;
  if (!['approvato', 'rifiutato'].includes(status)) return bad(res, 400, 'Decisione non valida');
  const c = db.prepare('SELECT * FROM shift_changes WHERE id=?').get(req.params.id);
  if (!c) return bad(res, 404, 'Richiesta non trovata');
  if (c.status !== 'in attesa') return bad(res, 409, 'Richiesta gia\' decisa (' + c.status + ')');
  db.prepare('UPDATE shift_changes SET status=?, motivo=?, decided_at=?, decided_by=? WHERE id=?')
    .run(status, motivo || '', now(), req.user.id, req.params.id);
  ok(res, { ok: true });
});

// chi ha chiesto puo' ritirare la richiesta finche' nessuno ha deciso
api.delete('/shift-changes/:id', need('ferie.request'), (req, res) => {
  const c = db.prepare('SELECT * FROM shift_changes WHERE id=?').get(req.params.id);
  if (!c) return bad(res, 404, 'Richiesta non trovata');
  if (c.status !== 'in attesa') return bad(res, 409, 'Si possono ritirare solo le richieste in attesa');
  db.prepare('DELETE FROM shift_changes WHERE id=?').run(req.params.id);
  ok(res, { ok: true });
});


/* ---------------- RICOMINCIARE DA ZERO ----------------
   Toglie TUTTI i dati operativi e lascia solo i profili di accesso,
   altrimenti nessuno potrebbe piu' entrare. Serve a chi ha provato
   l'app coi dati finti e adesso vuole metterci quelli veri.
   Chiede una parola di conferma: non si fa per sbaglio.          */
api.delete('/dati', need('all'), (req, res) => {
  if (String(req.body && req.body.conferma) !== 'AZZERA')
    return bad(res, 400, 'Per svuotare serve la conferma');

  const tabelle = ['inv_counts', 'inv_sessions', 'movements', 'shift_changes',
    'tasks', 'shifts', 'employees', 'products', 'vendors', 'locations'];
  const prima = {};
  tabelle.forEach(t => { prima[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; });
  tabelle.forEach(t => db.exec(`DELETE FROM ${t}`));
  // i contatori degli id ripartono da 1, cosi' l'app sembra nuova
  try { db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tabelle.map(t => `'${t}'`).join(',')})`); } catch {}

  ok(res, { ok: true, cancellati: prima,
    totale: Object.values(prima).reduce((s, n) => s + n, 0),
    profiliRimasti: db.prepare('SELECT COUNT(*) c FROM profiles').get().c });
});

/* ---------------- IMPOSTAZIONI DEL LOCALE ----------------
   Il nome del locale compare nel banner e negli ordini: e' la prima
   cosa che fa sentire l'app "sua" a chi la compra.               */
const leggiImp = (k, def) => {
  const r = db.prepare('SELECT valore FROM impostazioni WHERE chiave=?').get(k);
  return r ? r.valore : def;
};
api.get('/impostazioni', (req, res) => ok(res, {
  locale_nome: leggiImp('locale_nome', ''),
}));
api.put('/impostazioni', need('all'), (req, res) => {
  const nome = String(req.body.locale_nome || '').trim().slice(0, 60);
  db.prepare(`INSERT INTO impostazioni (chiave,valore) VALUES ('locale_nome',?)
    ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`).run(nome);
  ok(res, { ok: true });
});

/* ---------------- COPIA DI SICUREZZA ----------------
   Scarica il database intero come file. E' la cosa piu' importante per
   chi vende: un locale che perde un mese di conteggi non torna piu'.
   Il file si rimette al suo posto e l'app riparte da li'.          */
api.get('/backup', need('all'), (req, res) => {
  const percorso = process.env.DB_PATH || path.join(__dirname, 'data.db');
  // WAL: prima riversiamo tutto nel file principale, sennon la copia
  // sarebbe incompleta e i dati piu' recenti mancherebbero
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  if (!fs.existsSync(percorso)) return bad(res, 404, 'Database non trovato');
  const oggi = now().slice(0, 10);
  const nome = 'barback-' + (leggiImp('locale_nome', '') || 'dati').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + oggi + '.db';
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.setHeader('Content-Length', fs.statSync(percorso).size);
  fs.createReadStream(percorso).pipe(res);
});

// quanto pesa e di quando e' l'ultimo salvataggio: si mostra nelle impostazioni
api.get('/backup/info', need('all'), (req, res) => {
  // come per il download: prima riversiamo il WAL, sennò la dimensione
  // e il numero di righe sarebbero quelli di prima degli ultimi cambiamenti
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  const percorso = process.env.DB_PATH || path.join(__dirname, 'data.db');
  if (!fs.existsSync(percorso)) return ok(res, { esiste: false });
  const s = fs.statSync(percorso);
  const conta = (t) => { try { return db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch { return 0; } };
  ok(res, { esiste: true, byte: s.size, modificato: s.mtime.toISOString(),
    righe: { prodotti: conta('products'), movimenti: conta('movements'),
      dipendenti: conta('employees'), turni: conta('shifts'),
      inventari: conta('inv_sessions'), conteggi: conta('inv_counts') } });
});
/* ---------------- LA VETRINA PUBBLICA ----------------
   Con DEMO_MODE=1 l'app diventa la demo aperta a tutti: chiunque puo'
   entrare e toccare qualsiasi cosa. Ogni notte torna com'era, cosi'
   chi la apre domani mattina la trova intatta come chi l'ha aperta ieri.
   Non serve a nessun locale vero: la' questa variabile non c'e'.     */
const VETRINA = process.env.DEMO_MODE === '1';
if (VETRINA) {
  const nomeDemo = () => db.prepare(`INSERT INTO impostazioni (chiave,valore)
    VALUES ('locale_nome','Bar Demo') ON CONFLICT(chiave)
    DO UPDATE SET valore=excluded.valore`).run();
  nomeDemo();

  // l'ora e' quella del server (UTC su Render): le 4 UTC sono le 6 in Italia,
  // comunque un orario in cui nessuno sta guardando la demo
  let ultimoGiorno = new Date().toISOString().slice(0, 10);
  setInterval(() => {
    const ora = new Date();
    const oggi = ora.toISOString().slice(0, 10);
    if (ora.getUTCHours() !== 4 || oggi === ultimoGiorno) return;
    ultimoGiorno = oggi;
    try {
      db.riseminaDemo();
      nomeDemo();
      console.log('Demo rimessa a nuovo (' + oggi + ')');
    } catch (e) { console.error('Demo: ripulitura fallita', e); }
  }, 10 * 60 * 1000);

  console.log("Modalita' vetrina: i dati si azzerano ogni notte alle 4 UTC");
}

app.listen(PORT, () => console.log(`Barback avviato su http://localhost:${PORT}`));

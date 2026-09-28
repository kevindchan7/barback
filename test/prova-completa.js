/* =====================================================================
   prova-completa.js — Prova tutta l'app dall'inizio alla fine.

   Avvia un server suo su una porta e un database usa-e-getta, quindi
   NON tocca i dati veri. Percorre ogni sezione con tutti e quattro i
   profili e controlla che i permessi valgano davvero.

   Uso:   node --experimental-sqlite test/prova-completa.js
          npm test
   ===================================================================== */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = Number(process.env.PORT_TEST || 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(os.tmpdir(), `barback-prova-${Date.now()}.db`);

let passati = 0, falliti = 0;
const problemi = [];

function verifica(nome, condizione, dettaglio) {
  if (condizione) { passati++; console.log(`  ok   ${nome}`); }
  else {
    falliti++; problemi.push(nome);
    console.log(`  NO   ${nome}${dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : ''}`);
  }
}
function titolo(t) { console.log(`\n${t}`); }

async function chiama(percorso, { metodo = 'GET', corpo, token } = {}) {
  const r = await fetch(BASE + '/api' + percorso, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dati = null;
  try { dati = await r.json(); } catch {}
  return { stato: r.status, dati };
}
const entra = async (profileId, pin) =>
  (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId, pin } })).dati;

async function aspettaServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/api/profiles'); if (r.ok) return true; } catch {}
    await new Promise(s => setTimeout(s, 250));
  }
  return false;
}

(async function main() {
  console.log('Barback — prova completa');
  console.log('database usa-e-getta:', DB);

  const server = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT: String(PORT), DB_PATH: DB, JWT_SECRET: 'prova-non-segreta', SEED_DEMO: '1' }, stdio: 'ignore' });

  const chiudi = (codice) => {
    server.kill();
    try { for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true }); } catch {}
    console.log(`\n${'='.repeat(52)}`);
    console.log(`Superati: ${passati}   Falliti: ${falliti}`);
    if (falliti) console.log('Non passano:\n  - ' + problemi.join('\n  - '));
    else console.log('Tutto a posto.');
    process.exit(codice);
  };

  if (!await aspettaServer()) { console.log('Il server non risponde.'); return chiudi(1); }

  /* ---------------- ACCESSO E PERMESSI ---------------- */
  titolo('ACCESSO');
  const profili = (await chiama('/profiles')).dati;
  verifica('i quattro profili ci sono', profili.length === 4, profili.map(p => p.name));
  verifica('i PIN non escono mai dalle API', !JSON.stringify(profili).includes('pin_hash'));

  const pin = { prop: 1111, resp: 2222, barman: 3333, manager: 4444 };
  const id = {};
  profili.forEach(p => {
    if (p.permissions.includes('all')) id.prop = p.id;
    else if (p.name.includes('Responsabile')) id.resp = p.id;
    else if (p.name.includes('Barman')) id.barman = p.id;
    else if (p.name.includes('Bar Manager')) id.manager = p.id;
  });

  const prop = await entra(id.prop, pin.prop);
  const resp = await entra(id.resp, pin.resp);
  const barman = await entra(id.barman, pin.barman);
  const manager = await entra(id.manager, pin.manager);
  verifica('il proprietario entra', !!prop.token);
  verifica('il responsabile entra', !!resp.token);
  verifica('il barman entra', !!barman.token);
  verifica('il bar manager entra', !!manager.token);
  verifica('il PIN sbagliato non entra', (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId: id.prop, pin: '0000' } })).stato === 401);
  verifica('senza token si viene respinti', (await chiama('/products')).stato === 401);
  verifica('con un token inventato si viene respinti', (await chiama('/products', { token: 'ciao' })).stato === 401);

  const P = prop.token, R = resp.token, B = barman.token, M = manager.token;

  /* ---------------- PRODOTTI ---------------- */
  titolo('PRODOTTI');
  const iniziali = (await chiama('/products', { token: P })).dati;
  verifica('i prodotti demo ci sono', iniziali.length >= 17, iniziali.length);

  const nuovo = await chiama('/products', { metodo: 'POST', token: P,
    corpo: { name: 'Mezcal prova', format: '70cl', stock: 4, threshold: 2 } });
  verifica('si aggiunge un prodotto col solo nome', nuovo.stato === 200 && nuovo.dati.id > 0, nuovo.dati);
  const idMezcal = nuovo.dati.id;

  const lista = (await chiama('/products', { token: P })).dati;
  const mezcal = lista.find(p => p.id === idMezcal);
  verifica('la scorta ideale e\' il doppio della soglia', mezcal && mezcal.par_level === 4, mezcal && mezcal.par_level);
  verifica('nome duplicato respinto', (await chiama('/products', { metodo: 'POST', token: P, corpo: { name: 'MEZCAL PROVA' } })).stato === 409);
  verifica('nome vuoto respinto', (await chiama('/products', { metodo: 'POST', token: P, corpo: { format: '1L' } })).stato === 400);
  verifica('il barman non puo\' aggiungere prodotti', (await chiama('/products', { metodo: 'POST', token: B, corpo: { name: 'Abusivo' } })).stato === 403);

  const gin = lista.find(p => p.name === 'Gin');
  verifica('non si elimina un prodotto usato in una ricetta',
    (await chiama('/products/' + gin.id, { metodo: 'DELETE', token: P })).stato === 409);
  verifica('si elimina un prodotto senza storia',
    (await chiama('/products/' + idMezcal, { metodo: 'DELETE', token: P })).stato === 200);

  /* ---------------- MOVIMENTI E VUOTI ---------------- */
  titolo('MOVIMENTI E VUOTI');
  const vodka = lista.find(p => p.name === 'Vodka');
  const scarico = await chiama('/movements', { metodo: 'POST', token: B, corpo: { productId: vodka.id, type: 'vuoto', qty: 2 } });
  verifica('il barman registra un vuoto', scarico.stato === 200 && scarico.dati.stock === vodka.stock - 2, scarico.dati);
  verifica('il barman non puo\' fare un carico', (await chiama('/movements', { metodo: 'POST', token: B, corpo: { productId: vodka.id, type: 'carico', qty: 1 } })).stato === 403);
  verifica('il bar manager puo\' fare un carico', (await chiama('/movements', { metodo: 'POST', token: M, corpo: { productId: vodka.id, type: 'carico', qty: 3 } })).stato === 200);
  verifica('un tipo di movimento inventato e\' respinto', (await chiama('/movements', { metodo: 'POST', token: P, corpo: { productId: vodka.id, type: 'rettifica', qty: 1 } })).stato === 400);
  verifica('non si scarica piu\' della giacenza', (await chiama('/movements', { metodo: 'POST', token: P, corpo: { productId: vodka.id, type: 'vuoto', qty: 9999 } })).stato === 409);

  const vuoti = (await chiama('/empties?period=month', { token: B })).dati;
  verifica('il conteggio vuoti mostra la Vodka', vuoti.rows.some(r => r.name === 'Vodka' && r.qty === 2));
  verifica('la griglia del mese risponde', (await chiama('/empties/grid', { token: B })).stato === 200);

  /* ---------------- ORDINI E FORNITORI ---------------- */
  titolo('ORDINI E FORNITORI');
  const forn = (await chiama('/vendors', { token: P })).dati;
  verifica('i tre fornitori demo ci sono', forn.length === 3, forn.length);
  const nf = await chiama('/vendors', { metodo: 'POST', token: P, corpo: { name: 'Fornitore prova', phone: '+39 333' } });
  verifica('si aggiunge un fornitore', nf.stato === 200);
  verifica('si elimina un fornitore', (await chiama('/vendors/' + nf.dati.id, { metodo: 'DELETE', token: P })).stato === 200);

  const rum = lista.find(p => p.name === 'Rum bianco');
  const ordini = (await chiama('/orders/suggested', { token: M })).dati;
  verifica('l\'ordine suggerito e\' raggruppato per fornitore', Array.isArray(ordini.gruppi));
  verifica('il Rum sotto soglia compare nell\'ordine',
    ordini.gruppi.some(g => g.righe.some(r => r.name === 'Rum bianco' && r.qty === rum.par_level - rum.stock)),
    JSON.stringify(ordini.gruppi.map(g => g.righe.map(r => r.name + ':' + r.qty))));
  verifica('il barman non vede gli ordini', (await chiama('/orders/suggested', { token: B })).stato === 403);

  /* ---------------- INVENTARIO ---------------- */
  titolo('INVENTARIO');
  const post = (await chiama('/locations', { token: B })).dati;
  verifica('le postazioni demo ci sono', post.length === 4, post.map(l => l.name));

  const sess = await chiama('/inventory/start', { metodo: 'POST', token: B, corpo: {} });
  verifica('il barman apre una sessione', sess.stato === 200 && !sess.dati.ripresa, sess.dati);
  const sid = sess.dati.id;
  verifica('non si aprono due sessioni insieme', (await chiama('/inventory/start', { metodo: 'POST', token: B, corpo: {} })).dati.ripresa === true);

  const dopoMov = (await chiama('/products', { token: P })).dati;
  const vodkaOra = dopoMov.find(p => p.id === vodka.id);
  const birra = dopoMov.find(p => p.name === 'Birra');

  // conto la Vodka in meno di quanto il sistema si aspetta: deve uscire uno scostamento
  await chiama(`/inventory/${sid}/count`, { metodo: 'POST', token: B, corpo: { location_id: post[0].id, product_id: vodka.id, qty: vodkaOra.stock - 1 } });
  // la Birra la conto in due postazioni: si devono sommare
  await chiama(`/inventory/${sid}/count`, { metodo: 'POST', token: B, corpo: { location_id: post[0].id, product_id: birra.id, qty: 10 } });
  await chiama(`/inventory/${sid}/count`, { metodo: 'POST', token: B, corpo: { location_id: post[1].id, product_id: birra.id, qty: birra.stock - 10 } });

  const items = (await chiama(`/inventory/${sid}/items?location_id=${post[0].id}`, { token: B })).dati;
  verifica('la lista di conteggio ricorda cosa e\' gia\' contato',
    items.rows.find(r => r.id === vodka.id).contato === vodkaOra.stock - 1);

  const rev = (await chiama(`/inventory/${sid}/review`, { token: B })).dati;
  const rVodka = rev.rows.find(r => r.product_id === vodka.id);
  const rBirra = rev.rows.find(r => r.product_id === birra.id);
  verifica('lo scostamento della Vodka e\' -1', rVodka && rVodka.differenza === -1, rVodka && rVodka.differenza);
  verifica('le postazioni della Birra si sommano senza scostamento', rBirra && rBirra.contato === birra.stock && rBirra.differenza === 0, rBirra && [rBirra.contato, rBirra.differenza]);
  verifica('i non contati sono elencati', rev.nonContati.length > 0, rev.nonContati.length);
  verifica('il riepilogo conta un solo scostamento', rev.riepilogo.conScostamento === 1, rev.riepilogo);

  verifica('il barman non puo\' chiudere l\'inventario', (await chiama(`/inventory/${sid}/close`, { metodo: 'POST', token: B, corpo: {} })).stato === 403);
  const chiusa = await chiama(`/inventory/${sid}/close`, { metodo: 'POST', token: M, corpo: { nonContati: 'tieni' } });
  verifica('il bar manager chiude l\'inventario', chiusa.stato === 200 && chiusa.dati.rettifiche === 1, chiusa.dati);

  const finale = (await chiama('/products', { token: P })).dati;
  verifica('la giacenza si e\' allineata al conteggio', finale.find(p => p.id === vodka.id).stock === vodkaOra.stock - 1);
  verifica('i non contati sono rimasti come stavano', finale.find(p => p.name === 'Acqua').stock === dopoMov.find(p => p.name === 'Acqua').stock);

  const report = (await chiama('/reports/monthly', { token: P })).dati;
  const rigaVodka = report.rows.find(r => r.name === 'Vodka');
  verifica('le rettifiche NON entrano nei consumi del report', rigaVodka.uscito === 2, rigaVodka.uscito);
  verifica('non resta nessuna sessione aperta', (await chiama('/inventory/open', { token: B })).dati.sessione === null);

  const storico = (await chiama('/inventory/history', { token: B })).dati;
  verifica('l\'inventario chiuso e\' nello storico', storico.length === 1 && storico[0].conScostamento === 1, storico[0]);

  /* ---------------- CODICE A BARRE ---------------- */
  titolo('CODICE A BARRE');
  verifica('si associa un codice a un prodotto',
    (await chiama(`/products/${vodka.id}/barcode`, { metodo: 'PUT', token: B, corpo: { barcode: '8001111111111' } })).stato === 200);
  const trovato = await chiama('/products/barcode/8001111111111', { token: B });
  verifica('il codice ritrova il prodotto', trovato.dati.name === 'Vodka', trovato.dati && trovato.dati.name);
  verifica('lo stesso codice su due prodotti e\' respinto',
    (await chiama(`/products/${gin.id}/barcode`, { metodo: 'PUT', token: B, corpo: { barcode: '8001111111111' } })).stato === 409);
  verifica('un codice sconosciuto da 404', (await chiama('/products/barcode/0000000000000', { token: B })).stato === 404);

  /* ---------------- TURNI, TASK, PERSONALE ---------------- */
  titolo('TURNI, TASK, PERSONALE');
  const dip = (await chiama('/employees', { token: P })).dati;
  verifica('i dipendenti demo ci sono', dip.length === 5, dip.length);
  const nd = await chiama('/employees', { metodo: 'POST', token: R, corpo: { name: 'Chiara prova', role: 'barista' } });
  verifica('il responsabile aggiunge un dipendente', nd.stato === 200);
  verifica('nome duplicato respinto', (await chiama('/employees', { metodo: 'POST', token: R, corpo: { name: 'chiara PROVA' } })).stato === 409);
  verifica('il barman non aggiunge dipendenti', (await chiama('/employees', { metodo: 'POST', token: B, corpo: { name: 'Abusivo' } })).stato === 403);
  verifica('non si elimina un dipendente con turni', (await chiama('/employees/' + dip[0].id, { metodo: 'DELETE', token: R })).stato === 409);
  verifica('si elimina un dipendente senza turni', (await chiama('/employees/' + nd.dati.id, { metodo: 'DELETE', token: R })).stato === 200);

  const oggi = new Date().toISOString().slice(0, 10);
  const turno = await chiama('/shifts', { metodo: 'POST', token: R, corpo: { employee_id: dip[0].id, date: oggi, start: '18:00', end: '23:00', role: 'barista' } });
  verifica('il responsabile crea un turno', turno.stato === 200);
  verifica('il barman non crea turni', (await chiama('/shifts', { metodo: 'POST', token: B, corpo: { employee_id: dip[0].id, date: oggi, start: '9:00', end: '12:00' } })).stato === 403);
  verifica('si elimina un turno', (await chiama('/shifts/' + turno.dati.id, { metodo: 'DELETE', token: R })).stato === 200);

  const task = await chiama('/tasks', { metodo: 'POST', token: R, corpo: { title: 'Prova task', date: oggi } });
  verifica('il responsabile crea una task', task.stato === 200);
  verifica('il barman puo\' spuntare una task', (await chiama('/tasks/' + task.dati.id, { metodo: 'PUT', token: B, corpo: { done: true } })).stato === 200);
  verifica('il barman non crea task', (await chiama('/tasks', { metodo: 'POST', token: B, corpo: { title: 'Abusiva' } })).stato === 403);

  /* ---------------- FERIE E PERMESSI ---------------- */
  titolo('FERIE E PERMESSI');
  verifica('chi puo\' chiedere puo\' anche leggere l\'elenco', (await chiama('/shift-changes', { token: B })).stato === 200);
  const rq = await chiama('/shift-changes', { metodo: 'POST', token: B,
    corpo: { employee_id: dip[0].id, type: 'ferie', from_date: '2027-03-01', to_date: '2027-03-05', note: 'prova' } });
  verifica('il barman invia una richiesta di 5 giorni', rq.stato === 200, rq.dati);
  const elenco = (await chiama('/shift-changes', { token: P })).dati;
  const mia = elenco.rows.find(r => r.id === rq.dati.id);
  verifica('i giorni sono calcolati bene', mia && mia.giorni === 5, mia && mia.giorni);
  verifica('la richiesta porta con se\' i turni scoperti', mia && Array.isArray(mia.turniScoperti));
  verifica('le pendenti stanno in cima', elenco.rows[0].status === 'in attesa');
  verifica('richiesta sovrapposta respinta', (await chiama('/shift-changes', { metodo: 'POST', token: B, corpo: { employee_id: dip[0].id, type: 'permesso', from_date: '2027-03-03' } })).stato === 409);
  verifica('date al contrario respinte', (await chiama('/shift-changes', { metodo: 'POST', token: B, corpo: { employee_id: dip[1].id, type: 'ferie', from_date: '2027-04-10', to_date: '2027-04-01' } })).stato === 400);
  verifica('tipo inventato respinto', (await chiama('/shift-changes', { metodo: 'POST', token: B, corpo: { employee_id: dip[1].id, type: 'vacanza', from_date: '2027-04-01' } })).stato === 400);
  verifica('il barman non approva', (await chiama('/shift-changes/' + rq.dati.id, { metodo: 'PUT', token: B, corpo: { status: 'approvato' } })).stato === 403);
  verifica('il responsabile approva', (await chiama('/shift-changes/' + rq.dati.id, { metodo: 'PUT', token: R, corpo: { status: 'approvato' } })).stato === 200);
  verifica('una richiesta decisa non si ridecide', (await chiama('/shift-changes/' + rq.dati.id, { metodo: 'PUT', token: R, corpo: { status: 'rifiutato' } })).stato === 409);
  verifica('non si ritira una richiesta gia\' decisa', (await chiama('/shift-changes/' + rq.dati.id, { metodo: 'DELETE', token: B })).stato === 409);

  const rq2 = await chiama('/shift-changes', { metodo: 'POST', token: B, corpo: { employee_id: dip[2].id, type: 'permesso', from_date: '2027-05-01' } });
  verifica('si ritira una richiesta in attesa', (await chiama('/shift-changes/' + rq2.dati.id, { metodo: 'DELETE', token: B })).stato === 200);

  /* ---------------- PROFILI E PIN ---------------- */
  titolo('PROFILI E PIN');
  verifica('PIN di 2 cifre respinto', (await chiama('/profiles', { metodo: 'POST', token: P, corpo: { name: 'X', ruolo: 'barman', pin: '99' } })).stato === 400);
  verifica('ruolo inventato respinto', (await chiama('/profiles', { metodo: 'POST', token: P, corpo: { name: 'X', ruolo: 'capo', pin: '9999' } })).stato === 400);
  const np = await chiama('/profiles', { metodo: 'POST', token: P, corpo: { name: 'Profilo prova', ruolo: 'barman', pin: '9999' } });
  verifica('il proprietario crea un profilo', np.stato === 200);
  verifica('il barman non crea profili', (await chiama('/profiles', { metodo: 'POST', token: B, corpo: { name: 'Y', ruolo: 'proprietario', pin: '0000' } })).stato === 403);

  const provaTok = (await entra(np.dati.id, '9999')).token;
  verifica('il profilo nuovo entra col suo PIN', !!provaTok);
  verifica('cambio PIN col vecchio sbagliato respinto',
    (await chiama(`/profiles/${np.dati.id}/pin`, { metodo: 'PUT', token: provaTok, corpo: { attuale: '0000', nuovo: '8888' } })).stato === 401);
  verifica('cambio PIN col vecchio giusto riesce',
    (await chiama(`/profiles/${np.dati.id}/pin`, { metodo: 'PUT', token: provaTok, corpo: { attuale: '9999', nuovo: '8888' } })).stato === 200);
  verifica('il PIN nuovo funziona', !!(await entra(np.dati.id, '8888')).token);
  verifica('il PIN vecchio non funziona piu\'', !(await entra(np.dati.id, '9999')).token);
  verifica('non si cambia il PIN di un altro',
    (await chiama(`/profiles/${id.prop}/pin`, { metodo: 'PUT', token: provaTok, corpo: { nuovo: '0000' } })).stato === 403);
  verifica('il proprietario reimposta il PIN di un altro',
    (await chiama(`/profiles/${np.dati.id}/pin`, { metodo: 'PUT', token: P, corpo: { nuovo: '7777' } })).stato === 200);
  verifica('non si elimina il profilo con cui si e\' entrati', (await chiama('/profiles/' + id.prop, { metodo: 'DELETE', token: P })).stato === 409);
  verifica('non si declassa l\'unico accesso completo',
    (await chiama('/profiles/' + id.prop, { metodo: 'PUT', token: P, corpo: { name: 'Proprietario', ruolo: 'barman' } })).stato === 409);
  verifica('si elimina un profilo', (await chiama('/profiles/' + np.dati.id, { metodo: 'DELETE', token: P })).stato === 200);
  verifica('il PIN del proprietario e\' intatto', !!(await entra(id.prop, pin.prop)).token);

  /* ---------------- MANUALE E PANORAMICA ---------------- */
  titolo('MANUALE E PANORAMICA');
  const man = (await chiama('/manuale', { token: B })).dati;
  verifica('il manuale ha le regole del locale', man.regole.length >= 6, man.regole.length);
  verifica('il manuale ha il ricettario', man.ricettario.length === 4, man.ricettario.length);
  verifica('il responsabile non vede il manuale', (await chiama('/manuale', { token: R })).stato === 403);
  verifica('la panoramica risponde', (await chiama('/overview', { token: P })).stato === 200);

  chiudi(falliti ? 1 : 0);
})().catch(e => { console.error('\nerrore inatteso:', e); process.exit(1); });

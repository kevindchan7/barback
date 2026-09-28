/* =====================================================================
   prova-vuota.js — Parte da un'app COMPLETAMENTE VUOTA e ci costruisce
   dentro un locale da zero, come farebbe un cliente il primo giorno.

   Serve a dimostrare due cose:
   1) niente si rompe quando non c'e' nessun dato;
   2) i conti li fa sui TUOI numeri, non su numeri inventati.

   Uso:   node --experimental-sqlite test/prova-vuota.js
          npm run prova-vuota
   ===================================================================== */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = Number(process.env.PORT_TEST || 3197);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(os.tmpdir(), `barback-vuota-${Date.now()}.db`);

let passati = 0, falliti = 0;
const problemi = [];
function verifica(nome, cond, dettaglio) {
  if (cond) { passati++; console.log(`  ok   ${nome}`); }
  else { falliti++; problemi.push(nome); console.log(`  NO   ${nome}${dettaglio !== undefined ? '  -> ' + JSON.stringify(dettaglio) : ''}`); }
}
const titolo = (t) => console.log(`\n${t}`);

async function chiama(p, { metodo = 'GET', corpo, token } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dati = null; try { dati = await r.json(); } catch {}
  return { stato: r.status, dati };
}

(async function main() {
  console.log('Barback — prova con l\'app VUOTA');
  console.log('database usa-e-getta:', DB);

  // niente SEED_DEMO: l'app deve nascere vuota
  const server = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT: String(PORT), DB_PATH: DB, JWT_SECRET: 'prova-non-segreta' }, stdio: 'ignore' });

  const chiudi = (c) => {
    server.kill();
    try { for (const s of ['', '-wal', '-shm']) fs.rmSync(DB + s, { force: true }); } catch {}
    console.log(`\n${'='.repeat(52)}`);
    console.log(`Superati: ${passati}   Falliti: ${falliti}`);
    if (falliti) console.log('Non passano:\n  - ' + problemi.join('\n  - '));
    else console.log('Tutto a posto: si parte da zero e i conti tornano.');
    process.exit(c);
  };

  let su = false;
  for (let i = 0; i < 60 && !su; i++) {
    try { const r = await fetch(BASE + '/api/profiles'); su = r.ok; } catch {}
    if (!su) await new Promise(s => setTimeout(s, 250));
  }
  if (!su) { console.log('Il server non risponde.'); return chiudi(1); }

  /* ---------------- 1. NASCE VUOTA ---------------- */
  titolo('1. L\'APP NASCE VUOTA');
  const profili = (await chiama('/profiles')).dati;
  verifica('i profili di accesso ci sono (senza, non si entrerebbe)', profili.length === 4, profili.length);

  const { token: T } = (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId: profili.find(p => p.permissions.includes('all')).id, pin: '1111' } })).dati;
  verifica('il proprietario entra', !!T);

  for (const [nome, rotta] of [['prodotti', '/products'], ['dipendenti', '/employees'],
      ['fornitori', '/vendors'], ['postazioni', '/locations'], ['inventari', '/inventory/history']]) {
    const r = await chiama(rotta, { token: T });
    verifica(`nessun ${nome} inventato`, r.stato === 200 && Array.isArray(r.dati) && r.dati.length === 0, r.dati && r.dati.length);
  }
  const ric = await chiama('/shift-changes', { token: T });
  verifica('nessuna richiesta inventata', ric.stato === 200 && ric.dati.rows.length === 0, ric.dati && ric.dati.rows.length);

  /* ---------------- 2. NIENTE SI ROMPE SENZA DATI ---------------- */
  titolo('2. NIENTE SI ROMPE QUANDO NON C\'E\' NIENTE');
  const ov = await chiama('/overview', { token: T });
  verifica('la panoramica risponde', ov.stato === 200 && ov.dati.giacenzaPezzi === 0, ov.dati);
  verifica('dice che e\' il primo avvio', ov.dati.primoAvvio === true);
  const rep = await chiama('/reports/monthly', { token: T });
  verifica('il report mensile risponde vuoto', rep.stato === 200 && rep.dati.rows.length === 0);
  const ord = await chiama('/orders/suggested', { token: T });
  verifica('l\'ordine suggerito risponde vuoto', ord.stato === 200 && ord.dati.gruppi.length === 0 && ord.dati.prodotti === 0);
  verifica('il conteggio vuoti risponde', (await chiama('/empties?period=month', { token: T })).stato === 200);
  verifica('la griglia dei vuoti risponde', (await chiama('/empties/grid', { token: T })).stato === 200);
  verifica('i turni rispondono', (await chiama('/shifts?from=2020-01-01&to=2030-12-31', { token: T })).stato === 200);
  verifica('le task rispondono', (await chiama('/tasks', { token: T })).stato === 200);
  verifica('il manuale risponde con il ricettario vuoto', (await chiama('/manuale', { token: T })).dati.ricettario.length === 0);

  /* ---------------- 3. COSTRUISCO IL LOCALE ---------------- */
  titolo('3. COSTRUISCO IL MIO LOCALE DA ZERO');
  const forn = await chiama('/vendors', { metodo: 'POST', token: T, corpo: { name: 'Il mio fornitore', phone: '+39 333 1234567' } });
  verifica('creo un fornitore', forn.stato === 200);
  const post = await chiama('/locations', { metodo: 'POST', token: T, corpo: { name: 'Il mio banco' } });
  verifica('creo una postazione', post.stato === 200);

  // due prodotti MIEI, con i MIEI numeri
  const p1 = await chiama('/products', { metodo: 'POST', token: T,
    corpo: { name: 'Il mio gin', format: '70cl', stock: 10, threshold: 4, par_level: 12, vendor_id: forn.dati.id } });
  const p2 = await chiama('/products', { metodo: 'POST', token: T,
    corpo: { name: 'La mia tonica', format: '20cl', stock: 30, threshold: 20, vendor_id: forn.dati.id } });
  verifica('creo due prodotti miei', p1.stato === 200 && p2.stato === 200);

  const dip = await chiama('/employees', { metodo: 'POST', token: T, corpo: { name: 'Il mio barista', role: 'barista' } });
  verifica('creo un dipendente', dip.stato === 200);

  /* ---------------- 4. I CONTI SUI MIEI NUMERI ---------------- */
  titolo('4. I CONTI LI FA SUI MIEI NUMERI');
  const prod = (await chiama('/products', { token: T })).dati;
  const tonica = prod.find(x => x.name === 'La mia tonica');
  verifica('scorta ideale calcolata: soglia 20 -> ideale 40', tonica.par_level === 40, tonica.par_level);

  // consumo 7 gin: 10 - 7 = 3, sotto la mia soglia di 4
  await chiama('/movements', { metodo: 'POST', token: T, corpo: { productId: p1.dati.id, type: 'vuoto', qty: 7 } });
  const dopo = (await chiama('/products', { token: T })).dati.find(x => x.id === p1.dati.id);
  verifica('la giacenza scende: 10 - 7 = 3', dopo.stock === 3, dopo.stock);

  const ord2 = (await chiama('/orders/suggested', { token: T })).dati;
  const riga = ord2.gruppi[0] && ord2.gruppi[0].righe[0];
  verifica('l\'ordine compare sotto la MIA soglia', ord2.prodotti === 1, ord2.prodotti);
  verifica('quantita\' da ordinare: ideale 12 - giacenza 3 = 9', riga && riga.qty === 9, riga && riga.qty);
  verifica('raggruppato sotto il MIO fornitore', ord2.gruppi[0].vendor === 'Il mio fornitore', ord2.gruppi[0].vendor);

  const rep2 = (await chiama('/reports/monthly', { token: T })).dati;
  const rg = rep2.rows.find(r => r.name === 'Il mio gin');
  verifica('il report conta 7 uscite, quelle vere', rg.uscito === 7, rg.uscito);
  verifica('e le segnala da ordinare: 9', rg.daOrdinare === 9, rg.daOrdinare);

  /* ---------------- 5. INVENTARIO DA ZERO ---------------- */
  titolo('5. INVENTARIO SUL MIO LOCALE');
  const s = await chiama('/inventory/start', { metodo: 'POST', token: T, corpo: {} });
  verifica('apro un inventario', s.stato === 200);
  // conto 2 gin invece dei 3 che il sistema si aspetta
  await chiama(`/inventory/${s.dati.id}/count`, { metodo: 'POST', token: T, corpo: { location_id: post.dati.id, product_id: p1.dati.id, qty: 2 } });
  const rev = (await chiama(`/inventory/${s.dati.id}/review`, { token: T })).dati;
  const rv = rev.rows[0];
  verifica('lo scostamento e\' -1 (atteso 3, contato 2)', rv.atteso === 3 && rv.contato === 2 && rv.differenza === -1, [rv.atteso, rv.contato, rv.differenza]);
  verifica('la tonica non contata e\' segnalata', rev.nonContati.some(x => x.name === 'La mia tonica'));

  const fine = await chiama(`/inventory/${s.dati.id}/close`, { metodo: 'POST', token: T, corpo: { nonContati: 'tieni' } });
  verifica('chiudo l\'inventario con 1 rettifica', fine.stato === 200 && fine.dati.rettifiche === 1, fine.dati);
  const gin2 = (await chiama('/products', { token: T })).dati.find(x => x.id === p1.dati.id);
  verifica('la giacenza si allinea a quello che ho contato: 2', gin2.stock === 2, gin2.stock);
  verifica('l\'inventario e\' nello storico', (await chiama('/inventory/history', { token: T })).dati.length === 1);

  /* ---------------- 6. SVUOTARE E RICOMINCIARE ---------------- */
  titolo('6. SVUOTARE E RICOMINCIARE');
  verifica('senza conferma non svuota', (await chiama('/dati', { metodo: 'DELETE', token: T, corpo: {} })).stato === 400);
  const vuota = await chiama('/dati', { metodo: 'DELETE', token: T, corpo: { conferma: 'AZZERA' } });
  verifica('con la conferma svuota', vuota.stato === 200 && vuota.dati.totale > 0, vuota.dati && vuota.dati.totale);
  verifica('i profili restano (sennò nessuno entrerebbe piu\')', vuota.dati.profiliRimasti === 4, vuota.dati && vuota.dati.profiliRimasti);
  verifica('i prodotti sono spariti', (await chiama('/products', { token: T })).dati.length === 0);
  verifica('i dipendenti sono spariti', (await chiama('/employees', { token: T })).dati.length === 0);
  verifica('gli inventari sono spariti', (await chiama('/inventory/history', { token: T })).dati.length === 0);
  verifica('si entra ancora col proprio PIN', !!(await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId: 1, pin: '1111' } })).dati.token);

  chiudi(falliti ? 1 : 0);
})().catch(e => { console.error('\nerrore inatteso:', e); process.exit(1); });

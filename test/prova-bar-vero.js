/* =====================================================================
   prova-bar-vero.js — TRE MESI DI UN BAR VERO, IN POCHI SECONDI.

   "Bar Sport Testaccio" si registra, il titolare lo prepara, e poi per
   92 serate (agosto-ottobre 2026) titolare, bar manager, responsabile,
   barman e barback lo usano come farebbero davvero: vuoti anche dopo
   mezzanotte, carichi dal fornitore, errori corretti, checklist,
   turni cambiati, ferie chieste e decise, un inventario a fine mese.

   Ogni intoppo fra i ruoli e' un controllo: se qualcosa non torna,
   la prova lo dice. Si lancia con:  npm run prova-bar
   ===================================================================== */
const { spawn } = require('node:child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = Number(process.env.PORT_TEST || 3196);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = path.join(os.tmpdir(), `barback-barvero-${Date.now()}`);
const LOCALE = 'bar-sport-testaccio';

let passati = 0, falliti = 0; const problemi = [];
const verifica = (nome, esito, dato) => {
  if (esito) { passati++; if (process.env.VERBOSO) console.log('  ok   ' + nome); }
  else { falliti++; problemi.push(nome); console.log(`  NO   ${nome}${dato !== undefined ? '  -> ' + JSON.stringify(dato).slice(0, 300) : ''}`); }
};
const titolo = (t) => console.log('\n' + t);

// numeri "a caso" ma sempre gli stessi: la prova deve dare lo stesso risultato ogni volta
let seme = 20261024;
const caso = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
const fra = (a, b) => a + Math.floor(caso() * (b - a + 1));

let ORA = null;   // l'ora finta mandata al server
async function chiama(p, { metodo = 'GET', corpo, token, locale = LOCALE, ora = ORA } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-Locale': locale,
      ...(ora ? { 'X-Ora-Prova': ora } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dati = null; try { dati = await r.json(); } catch {}
  return { stato: r.status, dati };
}
const entra = async (profileId, pin, locale = LOCALE) =>
  (await chiama('/auth/pin', { metodo: 'POST', corpo: { profileId, pin }, locale })).dati.token;

// ora italiana -> ISO UTC (in autunno/estate l'Italia e' UTC+2 fino al 25 ottobre)
function oraItalia(giorno, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(giorno + 'T00:00:00Z');
  const offset = giorno >= '2026-10-25' ? 1 : 2;
  d.setUTCHours(h - offset, m, 0, 0);
  return d.toISOString();
}
const piuGiorni = (g, n) => { const d = new Date(g + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const giornoSett = (g) => ((new Date(g + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;   // 1 = lunedi'

(async function main() {
  console.log('Barback — tre mesi di un bar vero');
  fs.mkdirSync(DIR, { recursive: true });
  const server = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server.js')],
    { env: { ...process.env, PORT: String(PORT), DATA_DIR: DIR, JWT_SECRET: 'prova', BARBACK_PROVA: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
  let erroriServer = '';
  server.stderr.on('data', d => { const t = String(d); if (!/ExperimentalWarning|trace-warnings/.test(t)) erroriServer += t; });
  const chiudi = (c) => {
    server.kill();
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
    console.log(`\n${'='.repeat(56)}\nSuperati: ${passati}   Falliti: ${falliti}`);
    if (falliti) console.log('Non passano:\n  - ' + problemi.join('\n  - '));
    else console.log('Tre mesi di bar senza intoppi.');
    process.exit(c);
  };
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/api/locale/demo')).ok) break; } catch {}
    await new Promise(s => setTimeout(s, 250));
  }

  /* ================= 1. IL BAR SI REGISTRA ================= */
  titolo('1. Registrazione e preparazione');
  ORA = oraItalia('2026-07-30', '11:00');
  const reg = await chiama('/registra', { metodo: 'POST', locale: '', corpo: {
    nome: 'Bar Sport Testaccio', email: 'titolare@barsport.it', telefono: '+39 06 0000000', citta: 'Roma', pin: '4826' } });
  verifica('il bar si registra e riceve il suo codice', reg.stato === 200 && reg.dati.codice === LOCALE, reg.dati);
  verifica('un secondo bar con lo stesso nome prende un altro codice',
    (await chiama('/registra', { metodo: 'POST', locale: '', corpo: { nome: 'Bar Sport Testaccio', email: 'altro@x.it', pin: '7391' } })).dati.codice === LOCALE + '-2');

  const profili0 = (await chiama('/profiles')).dati;
  const idTit = profili0.find(p => p.permissions.includes('all')).id;
  verifica('col PIN di fabbrica 1111 il titolare NON entra', !(await entra(idTit, '1111')));
  const T = await entra(idTit, '4826');
  verifica('il titolare entra col PIN scelto', !!T);
  const imp = (await chiama('/impostazioni', { token: T })).dati;
  verifica('il nome del locale e\' gia\' impostato', imp.locale_nome === 'Bar Sport Testaccio', imp);
  verifica('il locale nasce vuoto', (await chiama('/products', { token: T })).dati.length === 0);

  // fornitori
  const fornitori = {};
  for (const [n, tel] of [['Ingrosso Bevande Roma', '+39 333 1111111'], ['Cantina Castelli', '+39 333 2222222'], ['Birre & Bibite', '+39 333 3333333']]) {
    fornitori[n] = (await chiama('/vendors', { metodo: 'POST', token: T, corpo: { name: n, phone: tel } })).dati.id;
  }
  // postazioni
  for (const n of ['Banco', 'Retro banco', 'Frigo', 'Magazzino']) await chiama('/locations', { metodo: 'POST', token: T, corpo: { name: n } });
  const post = (await chiama('/locations', { token: T })).dati;
  verifica('4 postazioni', post.length === 4);
  verifica('rinominare una postazione', (await chiama('/locations/' + post[1].id, { metodo: 'PUT', token: T, corpo: { name: 'Bottigliera' } })).stato === 200);

  // 24 bottiglie: [nome, formato, ml, costo, prezzo a bottiglia/pezzo, giacenza, soglia, fornitore, popolarita']
  const ING = 'Ingrosso Bevande Roma', CAN = 'Cantina Castelli', BIR = 'Birre & Bibite';
  const BOTTIGLIE = [
    ['Gin Tanqueray', '70cl', 700, 16.5, 0, 6, 3, ING, 5], ['Gin Hendrick\'s', '70cl', 700, 27, 0, 3, 2, ING, 2],
    ['Vodka Absolut', '70cl', 700, 13, 0, 5, 2, ING, 3], ['Rum Havana 3', '70cl', 700, 14, 0, 4, 2, ING, 3],
    ['Tequila Olmeca', '70cl', 700, 15, 0, 3, 1, ING, 1], ['Campari', '1L', 1000, 13.5, 0, 6, 3, ING, 6],
    ['Aperol', '1L', 1000, 12, 0, 8, 4, ING, 8], ['Martini Rosso', '1L', 1000, 8.5, 0, 6, 3, ING, 5],
    ['Select', '1L', 1000, 12.5, 0, 3, 2, ING, 2], ['Jägermeister', '70cl', 700, 15, 0, 3, 2, ING, 2],
    ['Amaro Montenegro', '70cl', 700, 12, 0, 3, 2, ING, 2], ['Limoncello', '70cl', 700, 9, 0, 2, 1, ING, 1],
    ['Whisky Jameson', '70cl', 700, 19, 0, 3, 2, ING, 2], ['Prosecco Valdo', '75cl', 750, 5.2, 0, 24, 12, CAN, 9],
    ['Vino rosso della casa', '75cl', 750, 4, 0, 18, 8, CAN, 5], ['Vino bianco della casa', '75cl', 750, 4, 0, 18, 8, CAN, 5],
    ['Birra Peroni 33cl', '33cl', 330, 0.85, 4.5, 96, 48, BIR, 10], ['Birra Ichnusa 33cl', '33cl', 330, 1.1, 5, 48, 24, BIR, 6],
    ['Coca-Cola 33cl', '33cl', 330, 0.55, 3.5, 48, 24, BIR, 6], ['Tonica Schweppes', '20cl', 200, 0.45, 3, 48, 24, BIR, 7],
    ['Soda', '20cl', 200, 0.3, 2.5, 36, 18, BIR, 6], ['Acqua naturale 50cl', '50cl', 500, 0.2, 2, 72, 36, BIR, 8],
    ['Succo arancia', '1L', 1000, 1.8, 0, 6, 3, BIR, 3], ['Ghiaccio (sacco 5kg)', 'sacco', 0, 2.5, 0, 10, 5, BIR, 7],
  ];
  const prodotti = {};
  for (const [n, f, ml, c, pr, st, so, fo] of BOTTIGLIE) {
    const r = await chiama('/products', { metodo: 'POST', token: T, corpo: { name: n, format: f, volume_ml: ml, cost: c, price: pr,
      stock: st, threshold: so, vendor_id: fornitori[fo], unit: f === 'sacco' ? 'sacchi' : 'bott.' } });
    if (r.stato !== 200) verifica('prodotto creato: ' + n, false, r.dati);
    prodotti[n] = r.dati.id;
  }
  verifica('24 bottiglie in magazzino', Object.keys(prodotti).length === 24);
  verifica('un doppione col nome diverso solo nelle maiuscole e\' respinto',
    (await chiama('/products', { metodo: 'POST', token: T, corpo: { name: 'campari' } })).stato === 409);
  verifica('si corregge il formato di una bottiglia',
    (await chiama('/products/' + prodotti['Select'], { metodo: 'PUT', token: T, corpo: { format: '70cl', volume_ml: 700 } })).stato === 200);
  const select = (await chiama('/products', { token: T })).dati.find(p => p.id === prodotti['Select']);
  verifica('...e la soglia NON si azzera correggendo solo il formato', select.format === '70cl' && select.threshold === 2 && select.volume_ml === 700, select);

  // 8 cocktail con ricetta
  const R = (pairs) => pairs.map(([n, q]) => ({ ing: prodotti[n], q }));
  const COCKTAIL = [
    ['Spritz Aperol', 7, R([['Aperol', 60], ['Prosecco Valdo', 90], ['Soda', 30]]), 12],
    ['Spritz Campari', 7, R([['Campari', 60], ['Prosecco Valdo', 90], ['Soda', 30]]), 5],
    ['Negroni', 9, R([['Gin Tanqueray', 30], ['Campari', 30], ['Martini Rosso', 30]]), 6],
    ['Americano', 8, R([['Campari', 30], ['Martini Rosso', 30], ['Soda', 60]]), 3],
    ['Gin Tonic', 9, R([['Gin Tanqueray', 50], ['Tonica Schweppes', 150]]), 8],
    ['Gin Tonic Hendrick\'s', 12, R([['Gin Hendrick\'s', 50], ['Tonica Schweppes', 150]]), 2],
    ['Moscow Mule', 9, R([['Vodka Absolut', 50], ['Soda', 100]]), 2],
    ['Cuba Libre', 8, R([['Rum Havana 3', 50], ['Coca-Cola 33cl', 150]]), 3],
  ];
  const cocktail = {};
  for (const [n, pr, ric] of COCKTAIL) {
    const r = await chiama('/products', { metodo: 'POST', token: T, corpo: { name: n, category: 'Cocktail', price: pr, recipe: ric } });
    if (r.stato !== 200) verifica('cocktail creato: ' + n, false, r.dati);
    cocktail[n] = r.dati.id;
  }
  verifica('8 cocktail con ricetta', Object.keys(cocktail).length === 8);
  verifica('una ricetta con un ingrediente inesistente e\' respinta',
    (await chiama('/products', { metodo: 'POST', token: T, corpo: { name: 'Mojito', category: 'Cocktail', price: 9, recipe: [{ ing: 99999, q: 50 }] } })).stato === 400);
  verifica('una ricetta con 0 ml e\' respinta',
    (await chiama('/products', { metodo: 'POST', token: T, corpo: { name: 'Mojito', category: 'Cocktail', price: 9, recipe: [{ ing: prodotti['Rum Havana 3'], q: 0 }] } })).stato === 400);
  // il Moscow Mule era sbagliato: ci va la ginger beer, che non c'e'. Si corregge la ricetta.
  verifica('si modifica la ricetta di un cocktail', (await chiama('/products/' + cocktail['Moscow Mule'], { metodo: 'PUT', token: T,
    corpo: { recipe: R([['Vodka Absolut', 45], ['Soda', 90], ['Succo arancia', 15]]), price: 9.5 } })).stato === 200);
  const dc = (await chiama('/foodcost', { token: T })).dati;
  const negroni = dc.cocktails.find(c => c.nome === 'Negroni');
  const atteso = 16.5 / 700 * 30 + 13.5 / 1000 * 30 + 8.5 / 1000 * 30;
  verifica('il costo del Negroni e\' giusto al centesimo', Math.abs(negroni.costo - atteso) < 0.01, { costo: negroni.costo, atteso });
  verifica('il pour cost del Negroni e\' sotto il 25%', negroni.pourCost > 0 && negroni.pourCost < 25, negroni.pourCost);
  const mule = dc.cocktails.find(c => c.nome === 'Moscow Mule');
  verifica('la ricetta modificata e\' quella usata nel calcolo', mule.ricetta.length === 3 && mule.prezzo === 9.5, mule);
  verifica('un cocktail non si puo\' "caricare" come una bottiglia',
    (await chiama('/movements', { metodo: 'POST', token: T, corpo: { productId: cocktail['Negroni'], type: 'carico', qty: 5 } })).stato === 400);

  // personale e profili
  const EMP = [['Giulia', 'bar manager'], ['Paolo', 'responsabile'], ['Marco', 'barman'], ['Sara', 'barman'], ['Luca', 'barback'], ['Chiara', 'barman']];
  const emp = {};
  for (const [n, r] of EMP) emp[n] = (await chiama('/employees', { metodo: 'POST', token: T, corpo: { name: n, role: r } })).dati.id;
  const colori = (await chiama('/employees', { token: T })).dati.map(e => e.color);
  verifica('ogni dipendente ha un colore diverso', new Set(colori).size === colori.length, colori);
  // profili personali, legati alla persona
  const PRO = [['Giulia (bar manager)', 'bar manager', '5101', 'Giulia'], ['Paolo (responsabile)', 'responsabile', '5202', 'Paolo'],
    ['Marco', 'barman', '5303', 'Marco'], ['Sara', 'barman', '5404', 'Sara'], ['Luca', 'barback', '5505', 'Luca']];
  const prof = {};
  for (const [n, ruolo, pin, e] of PRO) {
    const r = await chiama('/profiles', { metodo: 'POST', token: T, corpo: { name: n, ruolo, pin, employee_id: emp[e] } });
    if (r.stato !== 200) verifica('profilo creato: ' + n, false, r.dati);
    prof[e] = r.dati.id;
  }
  // un profilo condiviso per gli extra del weekend, non legato a una persona
  prof['Extra'] = (await chiama('/profiles', { metodo: 'POST', token: T, corpo: { name: 'Extra weekend', ruolo: 'barman', pin: '5606' } })).dati.id;
  // i profili di fabbrica che il bar non usa li toglie
  for (const p of profili0.filter(p => p.id !== idTit)) await chiama('/profiles/' + p.id, { metodo: 'DELETE', token: T });
  const tok = {
    Giulia: await entra(prof.Giulia, '5101'), Paolo: await entra(prof.Paolo, '5202'), Marco: await entra(prof.Marco, '5303'),
    Sara: await entra(prof.Sara, '5404'), Luca: await entra(prof.Luca, '5505'), Extra: await entra(prof.Extra, '5606'),
  };
  verifica('tutti i profili entrano col loro PIN', Object.values(tok).every(Boolean));
  verifica('Marco cambia il suo PIN', (await chiama('/profiles/' + prof.Marco + '/pin', { metodo: 'PUT', token: tok.Marco, corpo: { attuale: '5303', nuovo: '8080' } })).stato === 200);
  verifica('Marco NON cambia il PIN di Sara', (await chiama('/profiles/' + prof.Sara + '/pin', { metodo: 'PUT', token: tok.Marco, corpo: { nuovo: '0000' } })).stato === 403);
  verifica('il titolare reimposta il PIN dimenticato di Luca', (await chiama('/profiles/' + prof.Luca + '/pin', { metodo: 'PUT', token: T, corpo: { nuovo: '5505' } })).stato === 200);

  /* ================= 2. CHI VEDE COSA ================= */
  titolo('2. I permessi fra i ruoli');
  const prodBarman = (await chiama('/products', { token: tok.Marco })).dati;
  verifica('il barman vede i prodotti...', prodBarman.length === 32);
  verifica('...ma NON i costi', prodBarman.every(p => p.cost === undefined && p.price === undefined), prodBarman[0]);
  verifica('il barman non apre il drink cost', (await chiama('/foodcost', { token: tok.Marco })).stato === 403);
  verifica('il barman non apre il report mensile', (await chiama('/reports/monthly', { token: tok.Marco })).stato === 403);
  verifica('il barman non vede il valore del magazzino', (await chiama('/overview', { token: tok.Marco })).dati.giacenzaValore === undefined);
  verifica('il bar manager vede il drink cost (come promette il sito)', (await chiama('/foodcost', { token: tok.Giulia })).stato === 200);
  verifica('il bar manager vede i costi dei prodotti', (await chiama('/products', { token: tok.Giulia })).dati[0].cost !== undefined);
  verifica('il responsabile non vede il magazzino', (await chiama('/reports/monthly', { token: tok.Paolo })).stato === 403);
  verifica('il barman non crea cocktail', (await chiama('/products', { metodo: 'POST', token: tok.Marco, corpo: { name: 'X', category: 'Cocktail', recipe: [] } })).stato === 403);
  verifica('il barman non fa carichi', (await chiama('/movements', { metodo: 'POST', token: tok.Marco, corpo: { productId: prodotti['Aperol'], type: 'carico', qty: 1 } })).stato === 403);
  verifica('il token di un altro bar non apre questo', (await chiama('/products', { token: await entra(1, '7391', LOCALE + '-2') })).dati.length === 0);

  /* ================= 3. CHECKLIST FISSE ================= */
  titolo('3. Checklist che si ripetono');
  const CHECK = [['Apertura: accendere macchina, ghiaccio, frutta tagliata', [1, 2, 3, 4, 5, 6, 7]],
    ['Chiusura: lavare banco, svuotare lavastoviglie, contare cassa', [1, 2, 3, 4, 5, 6, 7]],
    ['Temperature frigo (HACCP)', [1, 2, 3, 4, 5, 6, 7]], ['Pulizia frigo a fondo', [1]], ['Controllo scorte per ordine', [2, 5]]];
  const modelli = [];
  for (const [t, g] of CHECK) modelli.push((await chiama('/task-templates', { metodo: 'POST', token: tok.Paolo, corpo: { title: t, giorni: g } })).dati.id);
  verifica('il responsabile crea 5 checklist', modelli.every(Boolean));
  verifica('il barman non crea checklist', (await chiama('/task-templates', { metodo: 'POST', token: tok.Marco, corpo: { title: 'x' } })).stato === 403);
  verifica('una checklist senza giorni e\' respinta', (await chiama('/task-templates', { metodo: 'POST', token: tok.Paolo, corpo: { title: 'x', giorni: [] } })).stato === 400);

  /* ================= 4. TURNI DI TRE MESI ================= */
  titolo('4. Turni di agosto, settembre e ottobre');
  const giorniMese = (ym) => { const [y, m] = ym.split('-').map(Number); return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`); };
  const SCHEMA = { Marco: ['18:00', '02:00', [2, 3, 4, 5, 6]], Sara: ['18:00', '02:00', [4, 5, 6, 7, 1]],
    Luca: ['19:00', '01:00', [3, 4, 5, 6, 7]], Chiara: ['12:00', '18:00', [1, 2, 3, 4, 5]], Giulia: ['17:00', '01:00', [2, 3, 5, 6]] };
  let turniCreati = 0;
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    for (const [n, [a, b, gg]] of Object.entries(SCHEMA)) {
      const dates = giorniMese(ym).filter(d => gg.includes(giornoSett(d)));
      const r = await chiama('/shifts/bulk', { metodo: 'POST', token: tok.Paolo, corpo: { employee_id: emp[n], dates, start: a, end: b, role: EMP.find(e => e[0] === n)[1] } });
      if (r.stato !== 200) verifica('turni ' + n + ' ' + ym, false, r.dati);
      else turniCreati += r.dati.added;
    }
  }
  verifica('piu\' di 250 turni creati', turniCreati > 250, turniCreati);
  verifica('rifare gli stessi turni non li duplica', (await chiama('/shifts/bulk', { metodo: 'POST', token: tok.Paolo,
    corpo: { employee_id: emp.Marco, dates: ['2026-08-04'], start: '18:00', end: '02:00' } })).dati.added === 0);
  verifica('un turno con orario sbagliato e\' respinto', (await chiama('/shifts', { metodo: 'POST', token: tok.Paolo,
    corpo: { employee_id: emp.Marco, date: '2026-08-04', start: '25:00', end: '02:00' } })).stato === 400);
  // il 15 agosto Marco fa la mattina invece della sera: si modifica il turno
  const ferragosto = (await chiama('/shifts?from=2026-08-15&to=2026-08-15', { token: tok.Paolo })).dati.find(s => s.employee === 'Marco');
  verifica('si modifica un turno (orario)', (await chiama('/shifts/' + ferragosto.id, { metodo: 'PUT', token: tok.Paolo, corpo: { start: '11:00', end: '19:00' } })).stato === 200);
  verifica('si sposta un turno a un\'altra persona', (await chiama('/shifts/' + ferragosto.id, { metodo: 'PUT', token: tok.Paolo, corpo: { employee_id: emp.Chiara } })).stato === 200);
  const dopo = (await chiama('/shifts?from=2026-08-15&to=2026-08-15', { token: tok.Marco })).dati.find(s => s.id === ferragosto.id);
  verifica('...e il barman lo vede cambiato', dopo && dopo.employee === 'Chiara' && dopo.start === '11:00', dopo);
  verifica('il barman non modifica i turni', (await chiama('/shifts/' + ferragosto.id, { metodo: 'PUT', token: tok.Marco, corpo: { start: '12:00' } })).stato === 403);

  /* ================= 5. FERIE ================= */
  titolo('5. Ferie e permessi');
  const fm = await chiama('/shift-changes', { metodo: 'POST', token: tok.Marco, corpo: { type: 'ferie', from_date: '2026-08-17', to_date: '2026-08-23', note: 'mare' } });
  verifica('Marco chiede una settimana di ferie (senza scegliere il nome)', fm.stato === 200 && fm.dati.turniScoperti === 5, fm.dati);
  verifica('Marco NON chiede ferie a nome di Sara', (await chiama('/shift-changes', { metodo: 'POST', token: tok.Marco,
    corpo: { employee_id: emp.Sara, type: 'ferie', from_date: '2026-09-01' } })).stato === 403);
  verifica('una richiesta sovrapposta e\' respinta', (await chiama('/shift-changes', { metodo: 'POST', token: tok.Marco,
    corpo: { type: 'permesso', from_date: '2026-08-20' } })).stato === 409);
  const fs1 = (await chiama('/shift-changes', { metodo: 'POST', token: tok.Sara, corpo: { type: 'ferie', from_date: '2026-08-20', to_date: '2026-08-22' } })).dati.id;
  verifica('Marco non ritira la richiesta di Sara', (await chiama('/shift-changes/' + fs1, { metodo: 'DELETE', token: tok.Marco })).stato === 403);
  verifica('il bar manager vede le richieste ma non decide', (await chiama('/shift-changes/' + fm.dati.id, { metodo: 'PUT', token: tok.Giulia, corpo: { status: 'approvato' } })).stato === 403);
  const lista = (await chiama('/shift-changes', { token: tok.Paolo })).dati;
  verifica('chi decide vede i turni che restano scoperti', lista.rows.find(r => r.id === fm.dati.id).turniScoperti.length === 5);
  verifica('il responsabile approva Marco', (await chiama('/shift-changes/' + fm.dati.id, { metodo: 'PUT', token: tok.Paolo, corpo: { status: 'approvato' } })).stato === 200);
  verifica('il responsabile rifiuta Sara spiegando perche\'', (await chiama('/shift-changes/' + fs1, { metodo: 'PUT', token: tok.Paolo,
    corpo: { status: 'rifiutato', motivo: 'Marco e\' gia\' in ferie quella settimana' } })).stato === 200);
  const viste = (await chiama('/shift-changes', { token: tok.Sara })).dati.rows.find(r => r.id === fs1);
  verifica('Sara vede il rifiuto col motivo e chi ha deciso', viste.status === 'rifiutato' && viste.motivo && viste.deciso_da, viste);
  // i turni di Marco in ferie li prende l'extra
  const scoperti = (await chiama('/shifts?from=2026-08-17&to=2026-08-23', { token: tok.Paolo })).dati.filter(s => s.employee === 'Marco');
  for (const s of scoperti) await chiama('/shifts/' + s.id, { metodo: 'PUT', token: tok.Paolo, corpo: { employee_id: emp.Chiara } });
  const coperti = (await chiama('/shift-changes', { token: tok.Paolo })).dati.rows.find(r => r.id === fm.dati.id);
  verifica('passati i turni a Chiara, non risultano piu\' scoperti', coperti.turniScoperti.length === 0, coperti.turniScoperti);

  /* ================= 6. 92 SERATE ================= */
  titolo('6. Novantadue serate al banco');
  const POP = BOTTIGLIE.map(b => [b[0], b[8]]);
  const totPop = POP.reduce((s, p) => s + p[1], 0);
  const pesca = () => { let x = caso() * totPop; for (const [n, w] of POP) { if ((x -= w) < 0) return n; } return POP[0][0]; };
  const vuotiAttesi = {};   // giornata -> pezzi
  let erroriCorretti = 0, dopoMezzanotte = 0, negativi = 0, taskFatte = 0, carichi = 0, rifiutiGiusti = 0;
  let giorno = '2026-08-01';
  const fine = '2026-10-31';
  while (giorno <= fine) {
    const dow = giornoSett(giorno);
    const weekend = dow >= 5;
    const chiuso = dow === 1 && giorno.slice(5, 7) === '08';   // ad agosto il lunedi' e' chiuso
    if (!chiuso) {
      // chi e' di turno stasera
      const turni = (await chiama('/shifts?from=' + giorno + '&to=' + giorno, { token: tok.Marco, ora: oraItalia(giorno, '18:00') })).dati;
      const inServizio = turni.map(s => s.employee).filter(n => tok[n]);
      const chi = inServizio.length ? inServizio : ['Extra'];
      // la serata: piu' giri di vuoti, uno dopo mezzanotte
      const giri = weekend ? ['21:30', '23:45', '01:40'] : ['22:00', '00:50'];
      for (const h of giri) {
        const ora = oraItalia(h < '12:00' ? piuGiorni(giorno, 1) : giorno, h);
        const n = weekend ? fra(4, 9) : fra(2, 5);
        for (let i = 0; i < n; i++) {
          const nome = pesca();
          const qty = nome.includes('Birra') || nome.includes('Acqua') ? fra(2, 8) : fra(1, 2);
          const persona = chi[fra(0, chi.length - 1)];
          const r = await chiama('/movements', { metodo: 'POST', token: tok[persona], ora,
            corpo: { productId: prodotti[nome], type: 'vuoto', qty, source: 'banco' } });
          if (r.stato !== 200) { verifica(`vuoto del ${giorno} ${h} (${persona})`, false, r.dati); continue; }
          if (r.dati.giorno !== giorno) verifica(`il vuoto delle ${h} va nella serata del ${giorno}`, false, r.dati.giorno);
          if (h < '12:00') dopoMezzanotte++;
          if (r.dati.giacenzaNegativa) negativi++;
          vuotiAttesi[giorno] = (vuotiAttesi[giorno] || 0) + qty;
          // ogni tanto uno sbaglia (scrive 20 invece di 2) e si corregge subito
          if (caso() < 0.04) {
            const sb = await chiama('/movements', { metodo: 'POST', token: tok[persona], ora, corpo: { productId: prodotti[nome], type: 'vuoto', qty: 20 } });
            const an = await chiama('/movements/' + sb.dati.id, { metodo: 'DELETE', token: tok[persona], ora });
            if (an.stato === 200) erroriCorretti++; else verifica('il barman annulla il suo errore', false, an.dati);
            // e un collega non puo' annullare i movimenti degli altri
            const altro = chi.find(c => c !== persona && c !== 'Giulia');
            if (altro && (await chiama('/movements/' + r.dati.id, { metodo: 'DELETE', token: tok[altro], ora })).stato === 403) rifiutiGiusti++;
          }
        }
      }
      // le checklist del giorno: la mattina dopo si vede cosa e' stato fatto
      const task = (await chiama('/tasks', { token: tok.Marco, ora: oraItalia(giorno, '19:00') })).dati;
      const attese = CHECK.filter(([, g]) => g.includes(dow)).length;
      if (task.filter(t => t.date === giorno && t.template_id).length !== attese)
        verifica(`checklist del ${giorno}: ${attese}`, false, task.map(t => t.title + '@' + t.date));
      for (const t of task) {
        if (caso() < 0.85) {
          const firma = chi[0] === 'Extra' ? null : emp[chi[0]];
          const r = await chiama('/tasks/' + t.id, { metodo: 'PUT', token: tok[chi[0]] || tok.Marco, ora: oraItalia(giorno, '20:00'), corpo: { done: true, employee_id: firma } });
          if (r.stato === 200) taskFatte++;
        }
      }
    }
    // carichi: martedi' e venerdi' il bar manager ordina quello che serve
    if (dow === 2 || dow === 5) {
      const ora = oraItalia(giorno, '11:00');
      const ord = (await chiama('/orders/suggested', { token: tok.Giulia, ora })).dati;
      for (const g of ord.gruppi) for (const r of g.righe) {
        const c = await chiama('/movements', { metodo: 'POST', token: tok.Giulia, ora, corpo: { productId: r.id, type: 'carico', qty: r.qty, source: 'fornitore' } });
        if (c.stato === 200) carichi++; else verifica('carico ' + r.name, false, c.dati);
      }
      // anche i prodotti andati sotto zero (mancava un carico) vengono sistemati
      const neg = (await chiama('/products/negativi', { token: tok.Giulia, ora })).dati;
      for (const p of neg) await chiama('/movements', { metodo: 'POST', token: tok.Giulia, ora, corpo: { productId: p.id, type: 'carico', qty: Math.ceil(-p.stock) + 6, source: 'fornitore' } });
    }
    // fine mese: inventario
    if (piuGiorni(giorno, 1).slice(8) === '01') {
      const ora = oraItalia(piuGiorni(giorno, 1), '10:00');
      const ses = await chiama('/inventory/start', { metodo: 'POST', token: tok.Giulia, ora, corpo: {} });
      if (ses.stato !== 200) verifica('inventario di ' + giorno.slice(0, 7), false, ses.dati);
      else {
        const sid = ses.dati.id;
        const prods = (await chiama('/products', { token: tok.Giulia, ora })).dati.filter(p => p.category === 'Bottiglia');
        const loc = (await chiama('/locations', { token: tok.Giulia, ora })).dati;
        for (const p of prods) {
          // quasi sempre giusto; ogni tanto manca una bottiglia (ammanco) o ce n'e' una in piu'
          const delta = caso() < 0.15 ? (caso() < 0.7 ? -1 : 1) : 0;
          const contato = Math.max(0, Math.round(p.stock + delta));
          const r = await chiama(`/inventory/${sid}/count`, { metodo: 'POST', token: tok.Luca, ora, corpo: { product_id: p.id, location_id: loc[0].id, qty: contato } });
          if (r.stato !== 200) { verifica('conteggio ' + p.name, false, r.dati); break; }
        }
        const rev = await chiama(`/inventory/${sid}/review`, { token: tok.Giulia, ora });
        verifica('revisione inventario di ' + giorno.slice(0, 7), rev.stato === 200, rev.dati);
        verifica('il barback non chiude l\'inventario', (await chiama(`/inventory/${sid}/close`, { metodo: 'POST', token: tok.Luca, ora, corpo: {} })).stato === 403);
        const cl = await chiama(`/inventory/${sid}/close`, { metodo: 'POST', token: tok.Giulia, ora, corpo: { nonContati: 'tieni' } });
        verifica('il bar manager chiude l\'inventario di ' + giorno.slice(0, 7), cl.stato === 200, cl.dati);
      }
    }
    giorno = piuGiorni(giorno, 1);
  }
  console.log(`   ${Object.values(vuotiAttesi).reduce((s, n) => s + n, 0)} pezzi di vuoti, ${dopoMezzanotte} segnati dopo mezzanotte, ${carichi} carichi,`);
  console.log(`   ${erroriCorretti} errori corretti, ${taskFatte} task spuntate, ${negativi} volte sotto zero`);
  verifica('tutti gli errori di battitura si sono potuti annullare', erroriCorretti > 0);
  verifica('nessun collega ha annullato i movimenti di un altro', rifiutiGiusti > 0, rifiutiGiusti);

  /* ================= 7. I CONTI TORNANO ================= */
  titolo('7. I conti a fine trimestre');
  ORA = oraItalia('2026-11-01', '12:00');
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    const rep = (await chiama('/reports/monthly?month=' + ym, { token: T })).dati;
    const uscito = rep.rows.reduce((s, r) => s + r.uscito, 0);
    const atteso = Object.entries(vuotiAttesi).filter(([g]) => g.startsWith(ym)).reduce((s, [, n]) => s + n, 0);
    verifica(`report ${ym}: i vuoti sono esattamente quelli segnati (${atteso})`, uscito === atteso, { uscito, atteso });
    verifica(`report ${ym}: il consumato in euro c'e'`, rep.totaleConsumato > 0, rep.totaleConsumato);
  }
  const giornoFisso = '2026-09-12';   // un sabato
  const vg = (await chiama('/empties?period=day&date=' + giornoFisso, { token: tok.Marco })).dati;
  verifica('i vuoti di sabato 12/9 contano anche quelli delle 01:40', vg.rows.reduce((s, r) => s + r.qty, 0) === vuotiAttesi[giornoFisso],
    { app: vg.rows.reduce((s, r) => s + r.qty, 0), attesi: vuotiAttesi[giornoFisso] });
  verifica('il barman non riceve i soldi nel conteggio vuoti', vg.totale === undefined && vg.rows.every(r => r.total === undefined));
  const grid = (await chiama('/empties/grid?month=2026-09', { token: tok.Marco })).dati;
  verifica('la griglia di settembre ha 30 giorni', grid.days.length === 30);
  const somma12 = grid.rows.reduce((s, r) => s + r.perDay[11], 0);
  verifica('la griglia del 12 settembre torna col conteggio', somma12 === vuotiAttesi[giornoFisso], { somma12 });
  const storia = (await chiama('/inventory/history', { token: tok.Giulia })).dati;
  verifica('3 inventari chiusi nello storico', (storia.rows || storia).filter(s => s.status === 'chiusa').length === 3, storia);
  const fc = (await chiama('/foodcost', { token: T })).dati;
  verifica('il drink cost mostra lo scostamento dell\'ultimo inventario', fc.ultimoScostamento && typeof fc.ultimoScostamento.valore === 'number', fc.ultimoScostamento);
  verifica('il valore del magazzino e\' positivo', fc.totali.valoreMagazzino > 0, fc.totali);
  const ann = (await chiama('/movements/annullati', { token: T })).dati;
  verifica('il titolare vede ogni errore annullato e da chi', ann.length === erroriCorretti && ann.every(a => a.annullato_da && a.creato_da), ann.length);
  const storico = (await chiama('/movements?from=2026-10-01&to=2026-10-31', { token: T })).dati;
  verifica('lo storico movimenti dice chi ha segnato cosa', storico.length > 100 && storico.every(m => m.profilo), storico.length);
  const storicoMarco = (await chiama('/movements?from=2026-10-01&to=2026-10-31', { token: tok.Marco })).dati;
  verifica('il barman nello storico vede solo i suoi', storicoMarco.every(m => m.profile_id === prof.Marco) && storicoMarco.every(m => m.total === undefined));
  const vecchio = storicoMarco[storicoMarco.length - 1];
  verifica('il barman non annulla un suo movimento di settimane fa', vecchio && (await chiama('/movements/' + vecchio.id, { metodo: 'DELETE', token: tok.Marco })).stato === 403);
  const th = (await chiama('/tasks/history?from=2026-10-01&to=2026-10-31', { token: T })).dati;
  verifica('lo storico delle task ha la firma di chi le ha fatte', th.length > 50 && th.every(t => t.done_profile && t.done_at), th.length);
  verifica('le checklist non fatte non si accumulano giorno dopo giorno',
    (await chiama('/tasks', { token: tok.Marco })).dati.filter(t => t.template_id).every(t => t.date === '2026-10-31' || t.date === '2026-11-01'));

  /* ================= 8. CAMBIARE IDEA ================= */
  titolo('8. Modificare e togliere');
  verifica('il bar non vende piu\' il Limoncello: non si cancella (ha storia)', (await chiama('/products/' + prodotti['Limoncello'], { metodo: 'DELETE', token: T })).stato === 409);
  verifica('la Tonica non si cancella: e\' nel Gin Tonic', (await chiama('/products/' + prodotti['Tonica Schweppes'], { metodo: 'DELETE', token: T })).stato === 409);
  verifica('un cocktail si toglie dal menu', (await chiama('/products/' + cocktail['Americano'], { metodo: 'DELETE', token: T })).stato === 200);
  verifica('si cambia fornitore a un prodotto', (await chiama('/products/' + prodotti['Prosecco Valdo'], { metodo: 'PUT', token: T, corpo: { vendor_id: fornitori[ING] } })).stato === 200);
  verifica('si toglie un fornitore (i prodotti restano)', (await chiama('/vendors/' + fornitori[CAN], { metodo: 'DELETE', token: T })).stato === 200);
  verifica('...e i suoi vini restano in magazzino', (await chiama('/products', { token: T })).dati.some(p => p.id === prodotti['Vino rosso della casa']));
  verifica('la checklist del lunedi\' si sposta al martedi\'', (await chiama('/task-templates/' + modelli[3], { metodo: 'PUT', token: tok.Paolo, corpo: { giorni: [2] } })).stato === 200);
  verifica('si spegne una checklist', (await chiama('/task-templates/' + modelli[4], { metodo: 'DELETE', token: tok.Paolo })).stato === 200);
  verifica('restano 4 checklist', (await chiama('/task-templates', { token: tok.Paolo })).dati.length === 4);
  const tUna = (await chiama('/tasks', { metodo: 'POST', token: tok.Paolo, corpo: { title: 'Chiamare il tecnico della spina', assignee_id: emp.Giulia } })).dati.id;
  verifica('si corregge il testo di una task', (await chiama('/tasks/' + tUna, { metodo: 'PUT', token: tok.Paolo, corpo: { title: 'Chiamare il tecnico della spina birra' } })).stato === 200);
  verifica('il barman non modifica le task', (await chiama('/tasks/' + tUna, { metodo: 'PUT', token: tok.Marco, corpo: { title: 'x' } })).stato === 403);
  verifica('si cancella una task', (await chiama('/tasks/' + tUna, { metodo: 'DELETE', token: tok.Paolo })).stato === 200);
  // Luca se ne va
  verifica('chi ha turni non si cancella per sbaglio', (await chiama('/employees/' + emp.Luca, { metodo: 'DELETE', token: tok.Paolo })).stato === 409);
  verifica('il profilo di chi se ne va si toglie', (await chiama('/profiles/' + prof.Luca, { metodo: 'DELETE', token: T })).stato === 200);
  verifica('...e il suo vecchio accesso non vale piu\'', (await chiama('/products', { token: tok.Luca })).stato === 401);
  verifica('il titolare non si cancella da solo', (await chiama('/profiles/' + idTit, { metodo: 'DELETE', token: T })).stato === 409);
  verifica('la copia di sicurezza c\'e\'', (await chiama('/backup/info', { token: T })).dati.esiste === true);

  /* ================= 9. L'ALTRO BAR NON HA VISTO NIENTE ================= */
  titolo('9. Gli altri bar restano separati');
  const T2 = await entra(1, '7391', LOCALE + '-2');
  verifica('il secondo bar non ha prodotti', (await chiama('/products', { token: T2, locale: LOCALE + '-2' })).dati.length === 0);
  verifica('il secondo bar non ha movimenti', (await chiama('/movements?from=2026-01-01&to=2026-12-31', { token: T2, locale: LOCALE + '-2' })).dati.length === 0);
  const demo = (await chiama('/products', { token: await entra(1, '1111', 'demo'), locale: 'demo' })).dati;
  verifica('il bar demo ha ancora i suoi 17 prodotti', demo.length === 17, demo.length);

  verifica('il server non ha scritto errori', !erroriServer.trim(), erroriServer.slice(0, 500));
  chiudi(falliti ? 1 : 0);
})().catch(e => { console.error('errore inatteso:', e); process.exit(1); });

/* Chiede a Chrome stesso se l'app e' installabile, invece di dedurlo.
   Page.getAppManifest restituisce gli errori che Chrome trova nel
   manifest; se ce n'e' uno, il tasto "Installa" non compare e basta,
   senza dire niente all'utente.
   Controlla anche che il service worker si registri davvero: senza,
   Chrome su Android non offre l'installazione. */
const { spawn } = require('child_process');
const path = require('path'), http = require('http'), fs = require('fs');

const URL_ = process.argv[2];
if (!URL_) { console.error('serve un indirizzo'); process.exit(1); }
const PORTA = 9300 + Math.floor(Math.random() * 90);
const PROFILO = path.join(__dirname, 'inst-' + PORTA);
const att = (ms) => new Promise(r => setTimeout(r, ms));
const get = (p) => new Promise((ris, rif) => http.get({ host: '127.0.0.1', port: PORTA, path: p }, (res) => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => { try { ris(JSON.parse(d)); } catch (e) { rif(e); } });
}).on('error', rif));

(async () => {
  const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + PORTA, '--user-data-dir=' + PROFILO, 'about:blank',
  ], { stdio: 'ignore' });

  let v = null;
  for (let i = 0; i < 40 && !v; i++) { await att(250); try { v = await get('/json/version'); } catch {} }
  if (!v) { console.error('Chrome non parte'); process.exit(1); }

  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const a = new Map();
  ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && a.has(x.id)) { a.get(x.id)(x); a.delete(x.id); } };
  const cmd = (me, p = {}, s) => new Promise(r => { const n = ++id; a.set(n, r); ws.send(JSON.stringify({ id: n, method: me, params: p, sessionId: s })); });

  const { targetId } = (await cmd('Target.createTarget', { url: 'about:blank' })).result;
  const sid = (await cmd('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  const S = (m, p) => cmd(m, p, sid);
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await S('Page.navigate', { url: URL_ });
  await att(4000);

  const val = async (e) => (await S('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;

  let ok = 0, ko = 0;
  const V = (m, e, d) => { if (e) { ok++; console.log('  ok  ' + m); } else { ko++; console.log('  KO  ' + m + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };

  console.log('\nE INSTALLABILE?   ' + URL_ + '\n');

  V('la pagina e servita su HTTPS', URL_.startsWith('https://'), URL_.slice(0, 8));

  /* cosa dice Chrome del manifest */
  const man = (await S('Page.getAppManifest')).result;
  V('Chrome trova il manifest', !!man.url, man.url);
  if (man.errors && man.errors.length) {
    console.log('  ERRORI DEL MANIFEST secondo Chrome:');
    man.errors.forEach(e => console.log('    [' + (e.critical ? 'CRITICO' : 'avviso') + '] ' + e.message));
    ko += man.errors.filter(e => e.critical).length;
  } else {
    ok++; console.log('  ok  il manifest non ha errori');
  }

  /* i requisiti che Chrome pretende per offrire l'installazione */
  let m = {};
  try { m = JSON.parse(man.data || '{}'); } catch {}
  V('ha un nome', !!(m.name || m.short_name), m.name);
  V('ha start_url', !!m.start_url, m.start_url);
  V('display e standalone o fullscreen', ['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), m.display);
  const png = (m.icons || []).filter(i => (i.type || '').includes('png'));
  V('ha un PNG 192', png.some(i => (i.sizes || '').includes('192')), (m.icons || []).map(i => i.sizes + ' ' + i.type));
  V('ha un PNG 512', png.some(i => (i.sizes || '').includes('512')));

  /* le icone si scaricano davvero? un 404 qui basta a bloccare tutto */
  for (const ic of (m.icons || [])) {
    const stato = await val(`fetch(${JSON.stringify(ic.src)}).then(r=>r.status).catch(()=>0)`);
    V(`l'icona ${ic.src} si scarica`, stato === 200, stato);
  }

  /* il service worker */
  await att(2500);
  const sw = await val(`navigator.serviceWorker.getRegistration().then(r=>r?({stato:(r.active&&'attivo')||(r.installing&&'in installazione')||(r.waiting&&'in attesa')||'ignoto', url:r.scope}):null).catch(e=>({errore:String(e)}))`);
  V('il service worker e registrato e attivo', sw && sw.stato === 'attivo', sw);

  console.log(`\n  ${ok} requisiti a posto, ${ko} no`);
  console.log(ko
    ? '\n  Con questi KO Chrome NON offre "Installa app".\n'
    : '\n  Chrome ha tutto quello che gli serve per offrire l\'installazione.\n');

  ws.close(); ch.kill(); await att(300);
  try { fs.rmSync(PROFILO, { recursive: true, force: true }); } catch {}
  process.exit(ko ? 1 : 0);
})();

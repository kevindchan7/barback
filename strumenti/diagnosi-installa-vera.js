/* La domanda non e' "il manifest e' giusto" ma "Chrome offre
   l'installazione VERA?".
   Il segnale e' uno solo: se Chrome lancia l'evento beforeinstallprompt,
   considera il sito installabile come app. Se non lo lancia, dal menu
   compare solo "Aggiungi a schermata Home", che e' una scorciatoia.

   Lo si ascolta PRIMA di navigare, altrimenti l'evento e' gia' passato. */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const URL_ = process.argv[2];
const PORTA = 9800 + Math.floor(Math.random() * 90);
const PROFILO = path.join(__dirname, 'iv-' + PORTA);
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
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });

  /* l'ascoltatore va messo prima che la pagina si carichi */
  await S('Page.addScriptToEvaluateOnNewDocument', {
    source: "window.__invito=false; window.addEventListener('beforeinstallprompt',function(){window.__invito=true;});",
  });

  await S('Page.navigate', { url: URL_ });
  await att(6000);

  const val = async (e) => (await S('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;

  const invito = await val('window.__invito === true');
  const sw = await val("navigator.serviceWorker.getRegistration().then(r=>r&&r.active?'attivo':(r?'non attivo':'assente')).catch(()=>'errore')");
  const man = (await S('Page.getAppManifest')).result;
  let m = {}; try { m = JSON.parse(man.data || '{}'); } catch {}

  console.log('\nINSTALLAZIONE VERA?   ' + URL_ + '\n');
  console.log('  service worker:        ' + sw);
  console.log('  manifest start_url:    ' + (m.start_url || '-'));
  console.log('  manifest scope:        ' + (m.scope || '-'));
  console.log('  display:               ' + (m.display || '-'));
  console.log('  icone PNG:             ' + (m.icons || []).filter(i => (i.type || '').includes('png')).map(i => i.sizes).join(', '));
  if (man.errors && man.errors.length) {
    console.log('  errori manifest:');
    man.errors.forEach(e => console.log('     [' + (e.critical ? 'CRITICO' : 'avviso') + '] ' + e.message));
  }
  console.log('');
  console.log(invito
    ? '  >>> Chrome OFFRE L\'INSTALLAZIONE VERA (ha lanciato beforeinstallprompt)'
    : '  >>> Chrome NON la offre: dal menu esce solo "Aggiungi a schermata Home"');

  ws.close(); ch.kill(); await att(300);
  try { fs.rmSync(PROFILO, { recursive: true, force: true }); } catch {}
  process.exit(invito ? 0 : 2);
})();

/* Guida l'app come farebbe una persona: entra col PIN, poi preme i tre
   bottoni della barra in alto e, dopo ognuno, controlla
   - se il browser ha registrato un errore
   - se la pagina ha cominciato a sbordare in orizzontale
   - se il testo e' cambiato davvero
   Serve a capire cosa vuol dire "si bagga lo schermo". */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const URL_ = process.argv[2] || 'http://localhost:3000/';
const LARG = Number(process.argv[3]) || 390;
const PORTA = 9700 + Math.floor(Math.random() * 300);
const PROFILO = path.join(__dirname, 'barra-' + PORTA);
const att = (ms) => new Promise(r => setTimeout(r, ms));
const get = (p) => new Promise((ris, rif) => http.get({ host: '127.0.0.1', port: PORTA, path: p }, (res) => {
  let d = ''; res.on('data', c => d += c); res.on('end', () => { try { ris(JSON.parse(d)); } catch (e) { rif(e); } });
}).on('error', rif));

(async () => {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=' + PORTA, '--user-data-dir=' + PROFILO, 'about:blank',
  ], { stdio: 'ignore' });

  let v = null;
  for (let i = 0; i < 40 && !v; i++) { await att(250); try { v = await get('/json/version'); } catch {} }
  if (!v) { console.error('Chrome non parte'); process.exit(1); }

  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const attese = new Map();
  const errori = [];
  ws.onmessage = (m) => {
    const x = JSON.parse(m.data);
    if (x.id && attese.has(x.id)) { attese.get(x.id)(x); attese.delete(x.id); return; }
    if (x.method === 'Runtime.exceptionThrown') {
      const d = x.params.exceptionDetails;
      errori.push((d.exception && d.exception.description || d.text || '').split('\n')[0]);
    }
    if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') {
      errori.push('console.error: ' + x.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 120));
    }
  };
  const cmd = (me, p = {}, s) => new Promise(r => { const n = ++id; attese.set(n, r); ws.send(JSON.stringify({ id: n, method: me, params: p, sessionId: s })); });

  const { targetId } = (await cmd('Target.createTarget', { url: 'about:blank' })).result;
  const sid = (await cmd('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  const S = (m, p) => cmd(m, p, sid);
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: LARG, height: 844, deviceScaleFactor: 2, mobile: true });

  const val = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return '!! ' + (r.result.exceptionDetails.exception || {}).description;
    return r.result.result.value;
  };

  await S('Page.navigate', { url: URL_ });
  await att(2500);

  let ok = 0, ko = 0;
  const verifica = (m, e, d) => { if (e) { ok++; console.log('  ok  ' + m); } else { ko++; console.log('  KO  ' + m + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
  const sborda = async () => await val('Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth');

  console.log('\nLA BARRA IN ALTO  (' + LARG + 'px)\n');

  /* entra col PIN del proprietario */
  await val(`(async()=>{
    const p = await (await fetch('/api/profiles')).json();
    const pro = p.find(x=>/Propriet/.test(x.name)) || p[0];
    const r = await (await fetch('/api/auth/pin',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({profileId:pro.id,pin:'1111'})})).json();
    localStorage.setItem('bb_token', r.token);
    localStorage.setItem('bb_profile', JSON.stringify(r.profile||pro));
    return 'ok';
  })()`);
  await S('Page.navigate', { url: URL_ });
  await att(2500);

  const dentro = await val("!!document.getElementById('banner') && getComputedStyle(document.getElementById('banner')).display !== 'none'");
  verifica('si entra col PIN 1111 e la barra compare', dentro === true, dentro);

  verifica('appena entrati non sborda', (await sborda()) <= 1, await sborda());

  /* quanti bottoni ci sono davvero */
  const bottoni = await val("Array.from(document.querySelectorAll('#banner button')).map(b=>b.textContent.trim())");
  console.log('     bottoni nella barra: ' + JSON.stringify(bottoni));

  /* --- il bottone della lingua --- */
  const giro = [];
  for (let i = 0; i < 4; i++) {
    const prima = await val("document.querySelector('#banner .langbtn').textContent.trim()");
    giro.push(prima);
    await val("document.querySelector('#banner .langbtn').click()");
    await att(600);
    const dopo = await val("document.querySelector('#banner .langbtn').textContent.trim()");
    const s = await sborda();
    verifica(`lingua ${prima} -> ${dopo}: non sborda`, s <= 1, s);
  }
  console.log('     giro delle lingue: ' + giro.join(' -> '));
  verifica('il giro delle lingue torna al punto di partenza', giro[0] === giro[3], giro);

  /* --- il bottone del tema --- */
  for (let i = 0; i < 2; i++) {
    const prima = await val("document.documentElement.getAttribute('data-theme') || 'scuro'");
    await val("document.getElementById('btn-tema').click()");
    await att(500);
    const dopo = await val("document.documentElement.getAttribute('data-theme') || 'scuro'");
    const s = await sborda();
    verifica(`tema ${prima} -> ${dopo}: non sborda`, s <= 1 && prima !== dopo, { s, prima, dopo });
  }

  /* --- l'ingranaggio --- */
  await val("Array.from(document.querySelectorAll('#banner button')).find(b=>b.textContent.trim()==='⚙').click()");
  await att(700);
  await att(500);
  const modale = await val("!!document.querySelector('#modal-root .modal')");
  verifica("l'ingranaggio apre qualcosa", modale === true, modale);
  const s2 = await sborda();
  verifica('con le impostazioni aperte non sborda', s2 <= 1, s2);

  /* --- errori raccolti --- */
  console.log('');
  if (errori.length) {
    console.log('  ERRORI DEL BROWSER (' + errori.length + '):');
    [...new Set(errori)].slice(0, 10).forEach(e => console.log('    ' + e));
    ko += errori.length;
  } else {
    console.log('  nessun errore del browser');
  }

  const shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(__dirname, 'shot', 'barra-' + LARG + '.png');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log('  immagine: ' + file);

  console.log(`\n  ${ok} passati, ${ko} falliti\n`);
  ws.close(); chrome.kill(); await att(400);
  try { fs.rmSync(PROFILO, { recursive: true, force: true }); } catch {}
  process.exit(ko ? 1 : 0);
})();

/* =====================================================================
   app.js — Logica del frontend Barback.
   Mostra/nasconde funzioni in base ai PERMESSI del profilo (can()).
   ===================================================================== */
const $ = (s) => document.querySelector(s);
const todayISO = () => new Date().toISOString().slice(0, 10);
let TOKEN = localStorage.getItem('bb_token') || null;
let PROFILE = JSON.parse(localStorage.getItem('bb_profile') || 'null');
let currentView = 'home';
let pollTimer = null;

// can(cap): il profilo ha quella capacità? 'all' (proprietario) supera tutto.
function can(cap) { const p = (PROFILE && PROFILE.permissions) || []; return p.includes('all') || p.includes(cap); }

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Errore ' + res.status));
  return data;
}
const show = (sel, on) => { const e = $(sel); if (e) e.classList.toggle('hidden', !on); };

/* ===================== LOGIN A PIN ===================== */
let selProfile = null, pinBuf = '';
async function initLogin() {
  $('#login-head').innerHTML = mascotSays('Ciao! Sono Barback. Scegli un profilo per entrare.');
  const profiles = await api('/profiles');
  $('#profiles').innerHTML = profiles.map(p => `
    <div class="profile" onclick="selectProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
      ${mascot(40)}
      <div><div class="pn">${p.name}</div><div class="pr">${p.permissions.includes('all') ? 'accesso completo' : p.permissions.length + ' permessi'}</div></div>
    </div>`).join('');
}
function selectProfile(id, name) {
  selProfile = { id, name }; pinBuf = '';
  $('#profiles-wrap').classList.add('hidden'); $('#pin-wrap').classList.remove('hidden');
  $('#pin-for').textContent = 'PIN per ' + name;
  $('#pinpad').innerHTML = [1,2,3,4,5,6,7,8,9].map(d => `<button onclick="pinPress('${d}')">${d}</button>`).join('')
    + `<button onclick="pinDel()">⌫</button><button onclick="pinPress('0')">0</button><button onclick="submitPin()">✓</button>`;
  renderDots(); $('#login-msg').textContent = '';
}
function backToProfiles() { $('#pin-wrap').classList.add('hidden'); $('#profiles-wrap').classList.remove('hidden'); }
function renderDots() { $('#pin-dots').innerHTML = [0,1,2,3].map(i => `<span class="${i < pinBuf.length ? 'on' : ''}"></span>`).join(''); }
function pinPress(d) { if (pinBuf.length < 4) { pinBuf += d; renderDots(); if (pinBuf.length === 4) submitPin(); } }
function pinDel() { pinBuf = pinBuf.slice(0, -1); renderDots(); }
async function submitPin() {
  try {
    const r = await api('/auth/pin', 'POST', { profileId: selProfile.id, pin: pinBuf });
    TOKEN = r.token; PROFILE = r.profile;
    localStorage.setItem('bb_token', TOKEN); localStorage.setItem('bb_profile', JSON.stringify(PROFILE));
    enterApp();
  } catch (e) { $('#login-msg').textContent = '⚠ ' + e.message; pinBuf = ''; renderDots(); }
}

function enterApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#banner-mascot').innerHTML = mascot(42);
  $('#banner-sub').textContent = PROFILE.name;
  requestNotify(); buildBottomNav(); loadHome(); maybeOnboard();
}

/* Barra di navigazione in basso: solo le sezioni consentite dal profilo */
function buildBottomNav() {
  const items = [
    ['home', '🏠', 'Home', true],
    ['vuoti', '🍾', 'Vuoti', can('vuoti.view')],
    ['turni', '📅', 'Turni', can('turni.view') || can('task.view')],
    ['magazzino', '📦', 'Magazz.', can('magazzino.view')],
    ['inventario', '📋', 'Invent.', can('inventario.view')],
    ['ordini', '🛒', 'Ordini', can('magazzino.view')],
    ['manuale', '📖', 'Manuale', can('manuale.view')],
  ].filter(i => i[3]);
  $('#bottomnav').innerHTML = items.map(i =>
    `<button data-nav="${i[0]}" onclick="go('${i[0]}')"><span class="bi">${i[1]}</span><span class="bl">${i[2]}</span></button>`).join('');
  setActiveNav(currentView);
}
function setActiveNav(view) {
  document.querySelectorAll('#bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
}

/* Onboarding guidato dal barback (solo al primo accesso) */
function maybeOnboard() {
  if (localStorage.getItem('bb_onboarded')) return;
  const steps = [
    ['🍾', 'Conta i vuoti', 'Registra le bottiglie consumate: la giacenza si aggiorna da sola.'],
    ['📦', 'Magazzino sempre giusto', 'Carichi e scarichi sottratti in automatico, con residuo preciso.'],
    ['📅', 'Turni e task', 'Vedi i turni a griglia e spunta le cose da fare.'],
    ['🛒', 'Ordini automatici', 'Quando un prodotto scende sotto soglia ti dico quanto ordinare e a chi.'],
    ['👇', 'Spostati al volo', 'Usa la barra in basso per passare da una sezione all\'altra.'],
  ];
  let idx = 0;
  const render = () => { const s = steps[idx]; $('#onboarding').innerHTML = `
    <div class="onb-card">
      ${mascot(64)}
      <div class="ic">${s[0]}</div><h2>${s[1]}</h2><p>${s[2]}</p>
      <div class="onb-dots">${steps.map((_, i) => `<span class="${i === idx ? 'on' : ''}"></span>`).join('')}</div>
      <div class="onb-actions">
        <button class="ghost" onclick="endOnboard()">Salta</button>
        <button class="act" onclick="onbNext()">${idx < steps.length - 1 ? 'Avanti' : 'Inizia'}</button>
      </div>
    </div>`; };
  window.onbNext = () => { if (idx < steps.length - 1) { idx++; render(); } else endOnboard(); };
  window.endOnboard = () => { localStorage.setItem('bb_onboarded', '1'); $('#onboarding').classList.add('hidden'); $('#onboarding').innerHTML = ''; };
  $('#onboarding').classList.remove('hidden'); render();
}
function logout() { localStorage.removeItem('bb_token'); localStorage.removeItem('bb_profile'); location.reload(); }

/* ===================== HOMEPAGE (dinamica per permessi) ===================== */
async function loadHome() {
  go('home', true);
  $('#home-hello').innerHTML = mascotSays(`Bentornato, ${PROFILE.name}! Ecco cosa puoi gestire.`);

  // layout iniziale: giacenze / entrate / uscite
  let ov = null; try { ov = await api('/overview'); } catch {}
  if (ov && (can('magazzino.view') || can('vuoti.view'))) {
    $('#home-overview').innerHTML = `
      ${ov.primoAvvio ? mascotSays('Primo avvio: questo è lo stato iniziale del magazzino.', 48) : ''}
      <div class="kpis">
        <div class="kpi"><div class="v">${ov.giacenzaPezzi}</div><div class="l">Giacenza (bott.)</div></div>
        <div class="kpi"><div class="v">${ov.entrate}</div><div class="l">Entrate (mese)</div></div>
        <div class="kpi"><div class="v">${ov.uscite}</div><div class="l">Uscite (mese)</div></div>
      </div>`;
  } else $('#home-overview').innerHTML = '';

  // pulsanti visibili solo se permessi
  const btns = [
    ['vuoti', '🍾', 'Conteggio vuoti', 'Bottiglie consumate', can('vuoti.view')],
    ['turni', '📅', 'Turni & Task', 'Personale e obiettivi', can('turni.view') || can('task.view')],
    ['magazzino', '📦', 'Magazzino', 'Giacenze e consumi', can('magazzino.view')],
    ['inventario', '📋', 'Inventario', 'Conta e verifica le giacenze', can('inventario.view')],
    ['ordini', '🛒', 'Ordini', 'Cosa ordinare e da chi', can('magazzino.view')],
    ['manuale', '📖', 'Manuale dipendente', 'Regole e ricettario', can('manuale.view')],
  ];
  $('#home-grid').innerHTML = btns.filter(b => b[4]).map(b =>
    `<div class="home-btn" onclick="go('${b[0]}')"><div class="ico">${b[1]}</div><div class="t">${b[2]}</div><div class="d">${b[3]}</div></div>`).join('');
}

/* ===================== NAVIGAZIONE ===================== */
function go(view, silent) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === view));
  setActiveNav(view);
  window.scrollTo(0, 0);
  if (pollTimer) clearInterval(pollTimer);
  if (silent) return;
  const loaders = { home: loadHome, vuoti: loadVuoti, turni: loadTurni,
    magazzino: loadMagazzino, inventario: loadInventario, ordini: loadOrdini, manuale: loadManuale };
  if (loaders[view]) {
    loaders[view]();
    if (['vuoti', 'magazzino', 'turni'].includes(view)) pollTimer = setInterval(loaders[view], 20000);
  }
}

/* ===================== SEZ.1 — VUOTI ===================== */
async function loadVuoti() {
  show('#vuoti-form', can('vuoti.do'));          // solo chi può registrare vede il form
  if (can('vuoti.do')) {
    const prods = await api('/products');
    $('#vuoti-prod').innerHTML = prods.filter(p => p.category === 'Bottiglia')
      .map(p => `<option value="${p.id}">${p.name} (${p.format})</option>`).join('');
  }
  if (!$('#vuoti-date').value) $('#vuoti-date').value = todayISO();
  const period = $('#vuoti-period').value, date = $('#vuoti-date').value;
  const r = await api(`/empties?period=${period}&date=${date}`);
  $('#vuoti-key').textContent = '(' + r.key + ')';
  $('#vuoti-list').innerHTML = r.rows.map(x => `<tr><td>${x.name}</td><td>${x.qty}</td>
    <td class="right">${x.residuo} ${x.unit}</td></tr>`).join("");
  // griglia del mese
  const grid = await api('/empties/grid?month=' + date.slice(0, 7));
  let html = '<tr><th>Prodotto</th>' + grid.days.map(d => `<th>${d}</th>`).join('') + '</tr>';
  grid.rows.forEach(row => {
    html += `<tr><td style="text-align:left">${row.name}</td>` +
      row.perDay.map(q => `<td class="${q ? 'has' : ''}">${q || ''}</td>`).join('') + '</tr>';
  });
  $('#vuoti-grid').innerHTML = html;
}
async function addEmpty() {
  try {
    await api('/movements', 'POST', { productId: +$('#vuoti-prod').value, type: 'vuoto',
      qty: +$('#vuoti-qty').value, source: $('#vuoti-src').value });
    loadVuoti();
  } catch (e) { alert(e.message); }
}

/* ===================== SEZ.4 — MAGAZZINO ===================== */
async function loadMagazzino() {
  const [prods, vendors] = await Promise.all([api('/products'), api('/vendors')]);
  window._vendors = vendors;
  window._products = prods;
  $('#mv-prod').innerHTML = prods.filter(p => p.category === 'Bottiglia').map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  // tipi di movimento consentiti dai permessi
  const types = [];
  if (can('carico.do')) types.push(['carico', 'Carico (fornitore)']);
  if (can('vuoti.do')) types.push(['scarico', 'Scarico'], ['vuoto', 'Vuoto']);
  $('#mv-type').innerHTML = types.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('');
  show('#mz-mvform', types.length > 0);

  const r = await api('/reports/monthly');
  window._stockRows = r.rows;
  $('#mz-month').textContent = '(' + r.month + ')';
  $('#mz-low').textContent = r.sottoSoglia;
  renderMz();
}
function renderMz() {
  const q = (($('#mz-search') && $('#mz-search').value) || '').toLowerCase();
  const rows = (window._stockRows || []).filter(x => x.name.toLowerCase().includes(q));
  const editable = can('magazzino.view');
  $('#mz-list').innerHTML = rows.map(x => `<tr><td>${x.name}</td><td>${x.entrato}</td><td>${x.uscito}</td>
    <td style="color:${x.netto < 0 ? 'var(--red)' : 'var(--green)'}">${x.netto > 0 ? '+' : ''}${x.netto}</td>
    <td class="right">${x.residua} ${x.unit}</td>
    <td class="right">${x.daOrdinare ? `<b style="color:var(--gold)">${x.daOrdinare}</b>` : '<span class="muted">—</span>'}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="editProduct(${x.id})" title="Modifica">✏️</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Nessun prodotto trovato.</td></tr>';
}
function editProduct(id) {
  const p = (window._products || []).find(x => x.id === id); if (!p) return;
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>Modifica: ${p.name}</h3>
        <div class="row"><div><label>Nome</label><input id="ep-name" value="${p.name.replace(/"/g, '&quot;')}"></div></div>
        <div class="row c2">
          <div><label>Soglia riordino</label><input id="ep-thr" type="number" value="${p.threshold}"></div>
          <div><label>Scorta ideale</label><input id="ep-par" type="number" value="${p.par_level || 0}"></div>
        </div>
        <p class="muted" style="font-size:11px;margin:-4px 0 8px">Sotto la soglia l'app propone l'ordine per tornare alla scorta ideale.</p>
        <div class="row"><div><label>Fornitore</label><select id="ep-vendor">
          <option value="">— nessuno —</option>
          ${(window._vendors || []).map(v => `<option value="${v.id}" ${v.id === p.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select></div></div>
        <div class="onb-actions">
          <button class="ghost" onclick="closeModal()">Annulla</button>
          <button class="act" onclick="saveProduct(${id})">Salva</button>
        </div>
      </div>
    </div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; }
async function saveProduct(id) {
  try {
    // costo e prezzo non si modificano piu' da qui: li rimandiamo identici
    // cosi' il dato resta nel database senza comparire a schermo
    const p = (window._products || []).find(x => x.id === id) || {};
    await api('/products/' + id, 'PUT', { name: $('#ep-name').value, cost: p.cost || 0, price: p.price || 0,
      threshold: $('#ep-thr').value, par_level: $('#ep-par').value, vendor_id: $('#ep-vendor').value });
    closeModal(); loadMagazzino();
  } catch (e) { alert(e.message); }
}
async function addMovement() {
  try {
    const type = $('#mv-type').value;
    await api('/movements', 'POST', { productId: +$('#mv-prod').value, type, qty: +$('#mv-qty').value,
      source: type === 'carico' ? 'fornitore' : 'manuale' });
    loadMagazzino();
  } catch (e) { alert(e.message); }
}

/* ===================== INVENTARIO =====================
   Conteggio guidato: si apre una sessione, si gira postazione per
   postazione, si rivede e si chiude. Il cursore stima la bottiglia
   aperta ai decimi, cosi' non serve la bilancia.                     */
let invSess = null, invMode = 'cursore', invItems = [], invLocName = '';

async function loadInventario() {
  $('#inv-hello').innerHTML = mascotSays('Conta una postazione alla volta. Puoi fermarti e riprendere: non perdi niente.', 48);
  show('#inv-loc-card', can('magazzino.view'));
  await Promise.all([loadLocations(), loadInvHistory()]);
  const r = await api('/inventory/open');
  invSess = r.sessione;
  if (invSess) { await invEnterCount(); } else { invShow('start'); }
}

// mostra uno dei tre stati: start | run | review
function invShow(stato) {
  show('#inv-start', stato === 'start');
  show('#inv-run', stato === 'run');
  show('#inv-review', stato === 'review');
}

async function invStart() {
  try {
    const r = await api('/inventory/start', 'POST', {});
    invSess = { id: r.id };
    await invEnterCount();
  } catch (e) { alert(e.message); }
}

async function invEnterCount() {
  $('#inv-num').textContent = '#' + invSess.id;
  const locs = await api('/locations');
  if (!locs.length) { alert('Aggiungi almeno una postazione prima di contare.'); return invShow('start'); }
  const sel = $('#inv-loc');
  if (sel.options.length !== locs.length) sel.innerHTML = locs.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  invShow('run');
  await invLoadItems();
}

async function invLoadItems() {
  const lid = +$('#inv-loc').value, sort = $('#inv-sort').value;
  invLocName = $('#inv-loc').selectedOptions[0] ? $('#inv-loc').selectedOptions[0].textContent : '';
  const r = await api(`/inventory/${invSess.id}/items?location_id=${lid}&sort=${sort}`);
  if (sort === 'ultimo' && !r.haMemoria) $('#inv-sort').value = 'nome';
  invItems = r.rows.map(p => {
    const c = p.contato;
    return { ...p,
      whole: c === null ? null : Math.floor(c),
      partial: c === null ? 0 : Math.round((c - Math.floor(c)) * 10) / 10 };
  });
  invRenderItems();
}

function invRenderItems() {
  const q = (($('#inv-search') && $('#inv-search').value) || '').toLowerCase();
  const vis = invItems.filter(p => p.name.toLowerCase().includes(q) || (p.format || '').toLowerCase().includes(q));
  const fatti = invItems.filter(p => p.whole !== null).length;
  $('#inv-progress').textContent = `${fatti} / ${invItems.length} contati`;
  $('#inv-mode').textContent = invMode === 'cursore' ? '🎚 Cursore' : '⌨ Tastierino';

  $('#inv-items').innerHTML = vis.map(p => {
    const tot = p.whole === null ? null : +(p.whole + p.partial).toFixed(1);
    return `<div class="inv-row ${p.whole !== null ? 'done' : ''}" id="ir-${p.id}">
      <div class="top">
        <span class="nm">${p.name}</span><span class="fm">${p.format || ''}</span>
        <span class="att">in memoria: ${p.stock}</span>
      </div>
      <div class="qty-ctl">
        <button onclick="invStep(${p.id},-1)">−</button>
        <input type="number" inputmode="decimal" step="0.1" min="0" value="${tot === null ? '' : tot}"
               placeholder="—" onchange="invTyped(${p.id}, this.value)">
        <button onclick="invStep(${p.id},1)">+</button>
        <span class="u">${p.unit}</span>
        <span class="spacer" style="flex:1"></span>
        ${tot !== null ? `<span class="tot">${tot}</span>` : ''}
      </div>
      ${invMode === 'cursore' ? `<div class="partial">
        <span class="lab">bottiglia aperta</span>
        <input type="range" min="0" max="0.9" step="0.1" value="${p.partial}" oninput="invPartial(${p.id}, this.value)">
        <span class="val">${Math.round(p.partial * 10)}/10</span>
      </div>` : ''}
    </div>`;
  }).join('') || '<div class="card"><p class="muted">Nessun prodotto trovato.</p></div>';
}

function invToggleMode() { invMode = invMode === 'cursore' ? 'tastierino' : 'cursore'; invRenderItems(); }

// +1 / −1 bottiglia intera
function invStep(id, d) {
  const p = invItems.find(x => x.id === id); if (!p) return;
  p.whole = Math.max(0, (p.whole === null ? 0 : p.whole) + d);
  invSave(p); invRenderItems();
}
// cursore: decimi della bottiglia aperta
function invPartial(id, v) {
  const p = invItems.find(x => x.id === id); if (!p) return;
  p.partial = Number(v) || 0;
  if (p.whole === null) p.whole = 0;
  invSave(p); invRenderItems();
}
// numero digitato a mano
function invTyped(id, v) {
  const p = invItems.find(x => x.id === id); if (!p) return;
  if (v === '') { invClear(p); return; }
  const n = Math.max(0, Number(v) || 0);
  p.whole = Math.floor(n); p.partial = Math.round((n - p.whole) * 10) / 10;
  invSave(p); invRenderItems();
}

let invTimers = {};
function invSave(p) {
  clearTimeout(invTimers[p.id]);
  invTimers[p.id] = setTimeout(async () => {
    try { await api(`/inventory/${invSess.id}/count`, 'POST',
      { location_id: +$('#inv-loc').value, product_id: p.id, qty: +(p.whole + p.partial).toFixed(1) }); }
    catch (e) { alert(e.message); }
  }, 350);
}
async function invClear(p) {
  p.whole = null; p.partial = 0; invRenderItems();
  try { await api(`/inventory/${invSess.id}/count`, 'DELETE',
    { location_id: +$('#inv-loc').value, product_id: p.id }); } catch {}
}

async function invCancel() {
  if (!confirm('Annullare l\'inventario in corso?\nTutti i conteggi di questa sessione vanno persi.')) return;
  try { await api('/inventory/' + invSess.id, 'DELETE'); invSess = null; loadInventario(); }
  catch (e) { alert(e.message); }
}

/* --- revisione: cosa non torna, prima di applicare --- */
async function invReview() {
  const r = await api(`/inventory/${invSess.id}/review`);
  window._review = r;
  $('#rv-contati').textContent = r.riepilogo.contati;
  $('#rv-noncontati').textContent = r.riepilogo.nonContati;
  $('#rv-scost').textContent = r.riepilogo.conScostamento;

  $('#rv-list').innerHTML = r.rows.map(x => {
    const cls = x.differenza < 0 ? 'diff-neg' : x.differenza > 0 ? 'diff-pos' : 'diff-ok';
    const seg = x.differenza > 0 ? '+' : '';
    return `<tr><td>${x.name}<div class="muted" style="font-size:11px">${x.postazioni || ''}</div></td>
      <td class="right muted">${x.atteso}</td><td class="right">${x.contato}</td>
      <td class="right ${cls}">${seg}${x.differenza}</td></tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Non hai contato niente.</td></tr>';

  show('#rv-missing-card', r.nonContati.length > 0);
  $('#rv-missing').innerHTML = r.nonContati.map(p => `<span class="missing-chip">${p.name}</span>`).join('');
  show('#rv-close', can('inventario.close'));
  invShow('review');
  window.scrollTo(0, 0);
}
function invBackToCount() { invShow('run'); invLoadItems(); }

async function invClose() {
  const nc = $('#rv-uncounted') ? $('#rv-uncounted').value : 'tieni';
  const r = window._review;
  let msg = `Chiudere l'inventario?\n\nLe giacenze di ${r.riepilogo.contati} prodotti verranno allineate a quanto hai contato.`;
  if (r.riepilogo.conScostamento) msg += `\n${r.riepilogo.conScostamento} prodotti non tornano: verrà registrata una rettifica.`;
  if (r.nonContati.length) msg += `\n${r.nonContati.length} non contati: ${nc === 'azzera' ? 'verranno AZZERATI' : 'resteranno come sono'}.`;
  if (!confirm(msg)) return;
  try {
    const out = await api(`/inventory/${invSess.id}/close`, 'POST', { nonContati: nc });
    alert(`Inventario chiuso.\n${out.prodotti} prodotti allineati, ${out.rettifiche} rettifiche registrate.`);
    invSess = null; loadInventario();
  } catch (e) { alert(e.message); }
}

/* --- storico: ogni conteggio resta, senza limiti di mesi --- */
async function loadInvHistory() {
  const h = await api('/inventory/history');
  const fmt = (s) => s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  $('#inv-history').innerHTML = h.map(s => `<tr>
      <td>${fmt(s.ended_at)}${s.parziale ? '<div class="muted" style="font-size:11px">parziale</div>' : ''}</td>
      <td>${s.operatore || '—'}</td><td class="right">${s.prodotti}</td>
      <td class="right ${s.conScostamento ? 'diff-pos' : 'diff-ok'}">${s.conScostamento}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Nessun inventario ancora. Il primo che chiudi finisce qui.</td></tr>';
}

/* --- postazioni --- */
async function loadLocations() {
  const locs = await api('/locations');
  const editable = can('magazzino.view');
  $('#loc-list').innerHTML = locs.map(l => `<tr><td>${l.name}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="removeLocation(${l.id}, '${l.name.replace(/'/g, "\\'")}')" title="Elimina">🗑</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="2" class="muted">Nessuna postazione.</td></tr>';
}
async function addLocation() {
  const name = $('#loc-name').value.trim(); if (!name) return;
  try { await api('/locations', 'POST', { name }); $('#loc-name').value = ''; loadLocations(); }
  catch (e) { alert(e.message); }
}
async function removeLocation(id, name) {
  if (!confirm(`Eliminare la postazione "${name}"?`)) return;
  try { await api('/locations/' + id, 'DELETE'); loadLocations(); } catch (e) { alert(e.message); }
}

/* --- codice a barre: inquadri, e il prodotto salta su ---
   Usa il lettore integrato del browser (BarcodeDetector). Se il telefono
   non ce l'ha, si continua a mano: nessuna libreria esterna da caricare. */
let bcStream = null, bcLoop = null;
async function invScan() {
  if (!('BarcodeDetector' in window)) return alert('Questo browser non sa leggere i codici a barre.\nSu Android usa Chrome; su iPhone conta a mano.');
  let det;
  try { det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }); }
  catch { return alert('Lettore codici non disponibile su questo telefono.'); }

  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)bcStop()">
      <div class="modal">
        <h3>Inquadra il codice a barre</h3>
        <video id="bc-video" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:cover"></video>
        <p class="muted" id="bc-msg" style="font-size:12px;margin-top:8px">Avvicina la bottiglia…</p>
        <div class="onb-actions"><button class="ghost" onclick="bcStop()">Chiudi</button></div>
      </div>
    </div>`;
  try {
    bcStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch { $('#bc-msg').textContent = 'Fotocamera negata. Consenti l accesso e riprova.'; return; }
  const v = $('#bc-video'); v.srcObject = bcStream; await v.play();

  bcLoop = setInterval(async () => {
    let codici = [];
    try { codici = await det.detect(v); } catch { return; }
    if (!codici.length) return;
    const code = codici[0].rawValue;
    clearInterval(bcLoop); bcLoop = null;
    try {
      const p = await api('/products/barcode/' + encodeURIComponent(code));
      bcStop(); invStep(p.id, 1);
      const row = $('#ir-' + p.id); if (row) row.scrollIntoView({ block: 'center' });
      $('#inv-progress').textContent = '+1 ' + p.name;
    } catch {
      bcStop(); invAssociate(code);
    }
  }, 400);
}
function bcStop() {
  if (bcLoop) { clearInterval(bcLoop); bcLoop = null; }
  if (bcStream) { bcStream.getTracks().forEach(t => t.stop()); bcStream = null; }
  closeModal();
}
// codice sconosciuto: lo si lega a un prodotto, cosi' la volta dopo e' automatico
function invAssociate(code) {
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>Codice nuovo</h3>
        <p class="muted" style="font-size:12px">Il codice <b>${code}</b> non è ancora legato a nessun prodotto. Scegli quale è, e da domani lo riconosco da solo.</p>
        <div class="row" style="margin-top:10px"><div><label>Prodotto</label><select id="bc-prod">
          ${invItems.map(p => `<option value="${p.id}">${p.name} ${p.format || ''}</option>`).join('')}
        </select></div></div>
        <div class="onb-actions">
          <button class="ghost" onclick="closeModal()">Annulla</button>
          <button class="act" onclick="bcLink('${code}')">Collega</button>
        </div>
      </div>
    </div>`;
}
async function bcLink(code) {
  const id = +$('#bc-prod').value;
  try {
    await api(`/products/${id}/barcode`, 'PUT', { barcode: code });
    closeModal(); const p = invItems.find(x => x.id === id);
    if (p) { p.barcode = code; invStep(id, 1); }
  } catch (e) { alert(e.message); }
}
/* ===================== ORDINI AI FORNITORI =====================
   Mostra cosa e' arrivato alla soglia, quanto ordinare per tornare alla
   scorta ideale, raggruppato per fornitore. Ogni gruppo si puo' copiare
   come testo o mandare su WhatsApp: niente integrazioni, solo praticita'. */
async function loadOrdini() {
  $('#ordini-hello').innerHTML = mascotSays('Ti dico cosa sta finendo e quanto ordinare. Poi lo mandi al fornitore.', 48);
  const [o, vendors] = await Promise.all([api('/orders/suggested'), api('/vendors')]);
  window._vendors = vendors;
  window._ordini = o;
  $('#or-prodotti').textContent = o.prodotti;
  

  $('#ordini-list').innerHTML = o.gruppi.length ? o.gruppi.map((g, i) => `
    <div class="card">
      <h3>${g.vendor} <span class="muted">— ${g.righe.length} prodotti</span></h3>
      <table><thead><tr><th>Prodotto</th><th class="right">Giacenza</th><th class="right">Ideale</th>
        <th class="right">Da ordinare</th></tr></thead>
        <tbody>${g.righe.map(r => `<tr><td>${r.name} <span class="muted">${r.format || ''}</span></td>
          <td class="right" style="color:var(--red)">${r.stock}</td>
          <td class="right muted">${r.par_level}</td>
          <td class="right"><b style="color:var(--gold)">${r.qty}</b> ${r.unit}</td>
          </tr>`).join('')}</tbody></table>
      <div class="toolbar" style="margin-top:8px">
        <button class="ghost" onclick="copiaOrdine(${i})">📋 Copia testo</button>
        ${g.phone ? `<button class="act gold" onclick="whatsappOrdine(${i})">💬 WhatsApp</button>` : ''}
        <button class="ghost" onclick="exportOrdine(${i},'csv')">⬇ CSV</button>
        <button class="ghost" onclick="exportOrdine(${i},'xlsx')">⬇ Excel</button>
      </div>
    </div>`).join('')
    : `<div class="card">${mascotSays('Non c\'è niente da ordinare: nessun prodotto è arrivato alla soglia. 👍', 48)}</div>`;

  // elenco fornitori
  const editable = can('magazzino.view');
  $('#vendor-list').innerHTML = vendors.map(v => `<tr><td>${v.name}</td><td>${v.phone || '—'}</td><td>${v.email || '—'}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="removeVendor(${v.id}, '${v.name.replace(/'/g, "\'")}')" title="Elimina">🗑</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Nessun fornitore. Aggiungine uno qui sotto.</td></tr>';
}

// testo dell'ordine, leggibile e pronto da incollare
function testoOrdine(i) {
  const g = (window._ordini && window._ordini.gruppi[i]); if (!g) return '';
  const data = new Date().toLocaleDateString('it-IT');
  return `Ordine Barback — ${data}\nFornitore: ${g.vendor}\n\n`
    + g.righe.map(r => `• ${r.name}${r.format ? ' ' + r.format : ''} — ${r.qty} ${r.unit}`).join('\n');
}
async function copiaOrdine(i) {
  const t = testoOrdine(i);
  try { await navigator.clipboard.writeText(t); alert('Ordine copiato. Ora incollalo dove vuoi.'); }
  catch { prompt('Copia il testo qui sotto (Ctrl+C):', t); }
}
function whatsappOrdine(i) {
  const g = window._ordini.gruppi[i];
  const tel = (g.phone || '').replace(/[^0-9]/g, '');
  if (!tel) return alert('Questo fornitore non ha un numero di telefono.');
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(testoOrdine(i))}`, '_blank');
}
function exportOrdine(i, fmt) {
  const g = window._ordini.gruppi[i];
  const aoa = [['Prodotto', 'Formato', 'Giacenza', 'Scorta ideale', 'Da ordinare', 'Unità']];
  g.righe.forEach(r => aoa.push([r.name, r.format || '', r.stock, r.par_level, r.qty, r.unit]));
  const nome = 'ordine-' + g.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  fmt === 'csv' ? downloadCSV(nome + '.csv', aoa) : downloadXLSX(nome + '.xlsx', aoa, 'Ordine');
}
async function addVendor() {
  const name = $('#vd-name').value.trim(); if (!name) return alert('Serve il nome del fornitore');
  try {
    await api('/vendors', 'POST', { name, phone: $('#vd-phone').value.trim(), email: $('#vd-email').value.trim() });
    $('#vd-name').value = ''; $('#vd-phone').value = ''; $('#vd-email').value = '';
    loadOrdini();
  } catch (e) { alert(e.message); }
}
async function removeVendor(id, name) {
  if (!confirm(`Eliminare il fornitore "${name}"?\nI prodotti restano, ma senza fornitore assegnato.`)) return;
  try { await api('/vendors/' + id, 'DELETE'); loadOrdini(); } catch (e) { alert(e.message); }
}

/* ===================== SEZ.2 — TURNI & TASK ===================== */
function rangeDates() {
  const ref = $('#shift-date').value || todayISO();
  const d = new Date(ref + 'T00:00'); const range = $('#shift-range').value;
  let from, to;
  if (range === 'day') { from = to = new Date(d); }
  else if (range === 'week') { const wd = (d.getDay() + 6) % 7; from = new Date(d); from.setDate(d.getDate() - wd); to = new Date(from); to.setDate(from.getDate() + 6); }
  else { from = new Date(d.getFullYear(), d.getMonth(), 1); to = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  const days = []; for (let x = new Date(from); x <= to; x.setDate(x.getDate() + 1)) days.push(new Date(x));
  const iso = (z) => z.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), days };
}
async function loadTurni() {
  if (!$('#shift-date').value) $('#shift-date').value = todayISO();
  await loadShifts();
  // gestione turni: form solo per chi ha turni.manage
  show('#sh-form', can('turni.manage'));
  if (can('turni.manage')) {
    const emps = await api('/employees');
    $('#sh-emp').innerHTML = emps.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    if (!$('#sh-date').value) $('#sh-date').value = todayISO();
  }
  if (can('task.view')) await loadTasks();
  show('#task-add', can('task.manage'));          // aggiungere task: solo chi gestisce
  // sezione ferie/permessi
  show('#sc-form', can('ferie.request'));
  show('#sc-send', can('ferie.request'));
  if (can('ferie.view') || can('ferie.request')) await loadShiftChanges();
  if (can('ferie.request')) {
    const emps = await api('/employees');
    $('#sc-emp').innerHTML = emps.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    if (!$('#sc-date').value) $('#sc-date').value = todayISO();
  }
}
async function loadShifts() {
  const { from, to, days } = rangeDates();
  const [shifts, emps] = await Promise.all([api(`/shifts?from=${from}&to=${to}`), api('/employees')]);
  window._shiftRows = shifts;
  const fmtDay = (s) => new Date(s + 'T00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit' });
  const editable = can('turni.manage');
  let html = '<tr><th>Dipendente</th>' + days.map(d => `<th>${fmtDay(d.toISOString().slice(0,10))}</th>`).join('') + '</tr>';
  emps.forEach(e => {
    html += `<tr><td style="text-align:left">${e.name}</td>` + days.map(d => {
      const k = d.toISOString().slice(0, 10);
      const cell = shifts.filter(s => s.employee_id === e.id && s.date === k).map(s =>
        `<span class="chip" ${editable ? `onclick="deleteShift(${s.id})" title="Elimina turno" style="cursor:pointer"` : ''}>${s.start}–${s.end}${editable ? ' ✕' : ''}</span>`).join('');
      return `<td class="${cell ? 'has' : ''}">${cell || ''}</td>`;
    }).join('') + '</tr>';
  });
  $('#shift-grid').innerHTML = html;
}
async function addShift() {
  const body = { employee_id: +$('#sh-emp').value, date: $('#sh-date').value,
    start: $('#sh-start').value, end: $('#sh-end').value, role: $('#sh-role').value };
  if (!body.employee_id || !body.date) return alert('Servono dipendente e data');
  try { await api('/shifts', 'POST', body); loadShifts(); } catch (e) { alert(e.message); }
}
async function deleteShift(id) {
  if (!confirm('Eliminare questo turno?')) return;
  try { await api('/shifts/' + id, 'DELETE'); loadShifts(); } catch (e) { alert(e.message); }
}
async function loadTasks() {
  const tasks = await api('/tasks?date=' + todayISO());
  const editable = can('task.check') || can('task.manage');
  $('#tasks-list').innerHTML = tasks.length ? tasks.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" style="width:auto" ${t.done ? 'checked' : ''} ${editable ? '' : 'disabled'} onchange="toggleTask(${t.id}, this.checked)">
      <span style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${t.title}</span>
      <span style="flex:1"></span><span class="muted">${t.assignee || ''}</span>
    </label>`).join('') : '<p class="muted">Nessuna task per oggi.</p>';
}
async function addTask() {
  const title = $('#task-title').value.trim(); if (!title) return;
  await api('/tasks', 'POST', { title, date: todayISO() });
  $('#task-title').value = ''; notify('Nuova task', title); loadTasks();
}
async function toggleTask(id, done) { try { await api('/tasks/' + id, 'PUT', { done }); } catch (e) { alert(e.message); loadTasks(); } }
async function loadShiftChanges() {
  const list = await api('/shift-changes');
  const canApprove = can('ferie.approve');
  $('#sc-list').innerHTML = list.map(c => `<tr><td>${c.employee}</td><td>${c.type}</td><td>${c.from_date}</td>
    <td><span class="pill ${c.status === 'in attesa' ? 'wait' : 'ok'}">${c.status}</span></td>
    <td class="right">${canApprove && c.status === 'in attesa'
      ? `<button class="ghost" onclick="decide(${c.id},'approvato')">✓</button> <button class="ghost" onclick="decide(${c.id},'rifiutato')">✕</button>` : ''}</td></tr>`).join('');
}
async function decide(id, status) { await api('/shift-changes/' + id, 'PUT', { status }); loadShiftChanges(); }
async function addShiftChange() {
  await api('/shift-changes', 'POST', { employee_id: +$('#sc-emp').value, type: $('#sc-type').value, from_date: $('#sc-date').value });
  loadShiftChanges();
}

/* ===================== MANUALE DIPENDENTE ===================== */
async function loadManuale() {
  $('#manuale-hello').innerHTML = mascotSays('Tutto quello che ti serve per il turno: regole del locale e ricette.', 48);
  const m = await api('/manuale');
  $('#man-rules').innerHTML = m.regole.map(r => `<li>${r}</li>`).join('');
  $('#man-recipes').innerHTML = m.ricettario.map(c => `
    <div style="border-bottom:1px solid var(--line);padding:8px 0">
      <b>${c.name}</b>
      <div class="muted" style="margin:4px 0">${c.ingredienti.map(i => i.name + ' ' + i.q + 'ml').join(' · ')}</div>
      <div style="font-size:12px">${c.preparazione}</div>
    </div>`).join('');
}

/* ===================== NOTIFICHE / EXPORT ===================== */
function requestNotify() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
function notify(title, body) { if ('Notification' in window && Notification.permission === 'granted') new Notification('🍾 ' + title, { body }); }
function downloadCSV(filename, aoa) {
  const csv = aoa.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })); a.download = filename; a.click();
}
function downloadXLSX(filename, aoa, sheet = 'Dati') {
  const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet); XLSX.writeFile(wb, filename);
}
async function exportShifts(fmt) {
  const { from, to } = rangeDates();
  const shifts = window._shiftRows || await api(`/shifts?from=${from}&to=${to}`);
  const aoa = [['Data', 'Dipendente', 'Inizio', 'Fine', 'Ruolo']];
  shifts.forEach(s => aoa.push([s.date, s.employee, s.start, s.end, s.role]));
  fmt === 'csv' ? downloadCSV('turni.csv', aoa) : downloadXLSX('turni.xlsx', aoa, 'Turni');
}
async function exportStock(fmt) {
  const rows = window._stockRows || (await api('/reports/monthly')).rows;
  const aoa = [['Prodotto', 'Entrato', 'Uscito', 'Netto', 'Giacenza residua', 'Scorta ideale', 'Da ordinare', 'Fornitore']];
  rows.forEach(r => aoa.push([r.name, r.entrato, r.uscito, r.netto, r.residua, r.par_level, r.daOrdinare, r.vendor || '']));
  fmt === 'csv' ? downloadCSV('magazzino.csv', aoa) : downloadXLSX('magazzino.xlsx', aoa, 'Magazzino');
}

/* ===================== AVVIO ===================== */
(async function init() {
  await initLogin();
  if (TOKEN && PROFILE) {
    try { await api('/overview'); enterApp(); }
    catch { localStorage.removeItem('bb_token'); TOKEN = null; }
  }
})();

/* ===================== APP INSTALLABILE SUL TELEFONO =====================
   Registra il service worker: serve perche' Android/iOS propongano
   "Aggiungi a schermata Home" e l'app si apra a schermo pieno.
   Funziona solo su HTTPS (o su localhost): altrove non fa niente.        */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* niente: l'app funziona comunque */});
  });
}

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
    headers: { 'Content-Type': 'application/json', 'X-Lang': (typeof LANG !== 'undefined' ? LANG : 'it'),
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
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
  $('#login-head').innerHTML = mascotSays(t('ciao'));
  const profiles = await api('/profiles');
  $('#profiles').innerHTML = profiles.map(p => `
    <div class="profile" onclick="selectProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
      ${mascot(40)}
      <div><div class="pn">${nomeProfilo(p.name)}</div><div class="pr">${p.permissions.includes('all') ? t('accesso_completo') : t('permessi_n', { n: p.permissions.length })}</div></div>
    </div>`).join('');
}
function selectProfile(id, name) {
  selProfile = { id, name }; pinBuf = '';
  $('#profiles-wrap').classList.add('hidden'); $('#pin-wrap').classList.remove('hidden');
  $('#pin-for').textContent = t('pin_per') + ' ' + nomeProfilo(name);
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
  $('#banner-sub').textContent = nomeProfilo(PROFILE.name);
  applicaLingua();
  requestNotify(); buildBottomNav(); loadHome(); maybeOnboard();
}

/* Barra di navigazione in basso: solo le sezioni consentite dal profilo */
function buildBottomNav() {
  const items = [
    ['home', '🏠', t('nav_home'), true],
    ['vuoti', '🍾', t('nav_vuoti'), can('vuoti.view')],
    ['turni', '📅', t('nav_turni'), can('turni.view') || can('task.view')],
    ['richieste', '🏖', t('nav_ferie'), can('ferie.view') || can('ferie.request')],
    ['magazzino', '📦', t('nav_magazzino'), can('magazzino.view')],
    ['inventario', '📋', t('nav_inventario'), can('inventario.view')],
    ['ordini', '🛒', t('nav_ordini'), can('magazzino.view')],
    ['manuale', '📖', t('nav_manuale'), can('manuale.view')],
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
  $('#home-hello').innerHTML = mascotSays(t("bentornato", { nome: nomeProfilo(PROFILE.name) }));

  // layout iniziale: giacenze / entrate / uscite
  let ov = null; try { ov = await api('/overview'); } catch {}
  if (ov && (can('magazzino.view') || can('vuoti.view'))) {
    $('#home-overview').innerHTML = `
      ${ov.primoAvvio ? mascotSays(t('primo_avvio'), 48) : ''}
      <div class="kpis">
        <div class="kpi"><div class="v">${ov.giacenzaPezzi}</div><div class="l">${t('giacenza_pezzi')}</div></div>
        <div class="kpi"><div class="v">${ov.entrate}</div><div class="l">${t('entrate_mese')}</div></div>
        <div class="kpi"><div class="v">${ov.uscite}</div><div class="l">${t('uscite_mese')}</div></div>
      </div>`;
  } else $('#home-overview').innerHTML = '';

  // pulsanti visibili solo se permessi
  const btns = [
    ['vuoti', '🍾', t('sez_vuoti'), t('d_vuoti'), can('vuoti.view')],
    ['turni', '📅', t('sez_turni'), t('d_turni'), can('turni.view') || can('task.view')],
    ['richieste', '🏖', t('sez_ferie'), t('d_ferie'), can('ferie.view') || can('ferie.request')],
    ['magazzino', '📦', t('sez_magazzino'), t('d_magazzino'), can('magazzino.view')],
    ['inventario', '📋', t('sez_inventario'), t('d_inventario'), can('inventario.view')],
    ['ordini', '🛒', t('sez_ordini'), t('d_ordini'), can('magazzino.view')],
    ['manuale', '📖', t('sez_manuale'), t('d_manuale'), can('manuale.view')],
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
    magazzino: loadMagazzino, inventario: loadInventario, ordini: loadOrdini,
    richieste: loadRichieste, manuale: loadManuale };
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
  if (can('carico.do')) types.push(['carico', t('carico_forn')]);
  if (can('vuoti.do')) types.push(['scarico', t('scarico')], ['vuoto', t('vuoto')]);
  $('#mv-type').innerHTML = types.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('');
  show('#mz-mvform', types.length > 0);
  // form per aggiungere un prodotto nuovo
  show('#mz-newprod', can('magazzino.view'));
  $('#np-vendor').innerHTML = '<option value="">— nessuno —</option>'
    + vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

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
    <td class="right">${editable ? `<button class="iconbtn" onclick="editProduct(${x.id})" title="Modifica">✏️</button>
      <button class="iconbtn" onclick="removeProduct(${x.id})" title="Elimina">🗑</button>` : ""}</td></tr>`).join("")
    || `<tr><td colspan="7" class="muted">${t('nessun_prodotto')}</td></tr>`;
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
  $('#inv-hello').innerHTML = mascotSays(t('inv_hello'), 48);
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
  $('#inv-progress').textContent = t('contati_su', { fatti, tot: invItems.length });
  $('#inv-mode').textContent = invMode === 'cursore' ? t('cursore') : t('tastierino');

  $('#inv-items').innerHTML = vis.map(p => {
    const tot = p.whole === null ? null : +(p.whole + p.partial).toFixed(1);
    return `<div class="inv-row ${p.whole !== null ? 'done' : ''}" id="ir-${p.id}">
      <div class="top">
        <span class="nm">${p.name}</span><span class="fm">${p.format || ''}</span>
        <span class="att">${t('in_memoria', { n: p.stock })}</span>
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
        <span class="lab">${t('bottiglia_aperta')}</span>
        <input type="range" min="0" max="0.9" step="0.1" value="${p.partial}" oninput="invPartial(${p.id}, this.value)">
        <span class="val">${Math.round(p.partial * 10)}/10</span>
      </div>` : ''}
    </div>`;
  }).join('') || `<div class="card"><p class="muted">${t('nessun_prodotto')}</p></div>`;
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
  }).join('') || `<tr><td colspan="4" class="muted">${t('non_contato_niente')}</td></tr>`;

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
  const fmt = (s) => s ? new Date(s).toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  $('#inv-history').innerHTML = h.map(s => `<tr>
      <td>${fmt(s.ended_at)}${s.parziale ? '<div class="muted" style="font-size:11px">parziale</div>' : ''}</td>
      <td>${s.operatore || '—'}</td><td class="right">${s.prodotti}</td>
      <td class="right ${s.conScostamento ? 'diff-pos' : 'diff-ok'}">${s.conScostamento}</td></tr>`).join('')
    || `<tr><td colspan="4" class="muted">${t('nessun_inventario')}</td></tr>`;
}

/* --- postazioni --- */
async function loadLocations() {
  const locs = await api('/locations');
  const editable = can('magazzino.view');
  $('#loc-list').innerHTML = locs.map(l => `<tr><td>${l.name}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="removeLocation(${l.id}, '${l.name.replace(/'/g, "\\'")}')" title="Elimina">🗑</button>` : ''}</td></tr>`).join('')
    || `<tr><td colspan="2" class="muted">${t('nessuna_postazione')}</td></tr>`;
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
  $('#ordini-hello').innerHTML = mascotSays(t('ordini_hello'), 48);
  const [o, vendors] = await Promise.all([api('/orders/suggested'), api('/vendors')]);
  window._vendors = vendors;
  window._ordini = o;
  $('#or-prodotti').textContent = o.prodotti;
  

  $('#ordini-list').innerHTML = o.gruppi.length ? o.gruppi.map((g, i) => `
    <div class="card">
      <h3>${g.vendor} <span class="muted">— ${t('n_prodotti', { n: g.righe.length })}</span></h3>
      <div class="grid-scroll"><table><thead><tr><th>Prodotto</th><th class="right">Giacenza</th><th class="right">Ideale</th>
        <th class="right">Da ordinare</th></tr></thead>
        <tbody>${g.righe.map(r => `<tr><td>${r.name} <span class="muted">${r.format || ''}</span></td>
          <td class="right" style="color:var(--red)">${r.stock}</td>
          <td class="right muted">${r.par_level}</td>
          <td class="right"><b style="color:var(--gold)">${r.qty}</b> ${r.unit}</td>
          </tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:8px">
        <button class="ghost" onclick="copiaOrdine(${i})">${t('copia_testo')}</button>
        ${g.phone ? `<button class="act gold" onclick="whatsappOrdine(${i})">${t('manda_whatsapp')}</button>` : ''}
        <button class="ghost" onclick="exportOrdine(${i},'csv')">⬇ CSV</button>
        <button class="ghost" onclick="exportOrdine(${i},'xlsx')">⬇ Excel</button>
      </div>
    </div>`).join('')
    : `<div class="card">${mascotSays('Non c\'è niente da ordinare: nessun prodotto è arrivato alla soglia. 👍', 48)}</div>`;

  // elenco fornitori
  const editable = can('magazzino.view');
  $('#vendor-list').innerHTML = vendors.map(v => `<tr><td>${v.name}</td><td>${v.phone || '—'}</td><td>${v.email || '—'}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="removeVendor(${v.id})" title="Elimina">🗑</button>` : ""}</td></tr>`).join("")
    || `<tr><td colspan="4" class="muted">${t('nessun_fornitore')}</td></tr>`;
}

// testo dell'ordine, leggibile e pronto da incollare
function testoOrdine(i) {
  const g = (window._ordini && window._ordini.gruppi[i]); if (!g) return '';
  const data = new Date().toLocaleDateString(locale());
  return t('ordine_intestazione', { data }) + '\n' + t('ordine_fornitore', { nome: g.vendor }) + '\n\n'
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
async function removeVendor(id) {
  const v = (window._vendors || []).find(x => x.id === id) || {};
  const name = v.name || "questo fornitore";
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
  // anagrafica del personale: la gestisce chi fa i turni
  show('#personale-card', can('turni.manage'));
  if (can('turni.manage')) await loadEmployees();
}
async function loadShifts() {
  const { from, to, days } = rangeDates();
  const [shifts, emps] = await Promise.all([api(`/shifts?from=${from}&to=${to}`), api('/employees')]);
  window._shiftRows = shifts;
  const fmtDay = (s) => new Date(s + 'T00:00').toLocaleDateString(locale(), { weekday: 'short', day: '2-digit' });
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
    </label>`).join('') : `<p class="muted">${t('nessuna_task')}</p>`;
}
async function addTask() {
  const title = $('#task-title').value.trim(); if (!title) return;
  await api('/tasks', 'POST', { title, date: todayISO() });
  $('#task-title').value = ''; notify('Nuova task', title); loadTasks();
}
async function toggleTask(id, done) { try { await api('/tasks/' + id, 'PUT', { done }); } catch (e) { alert(e.message); loadTasks(); } }


/* ===================== FERIE, PERMESSI, CAMBI TURNO =====================
   Due ruoli nella stessa schermata, e ognuno vede solo la sua parte:
   chi chiede compila il periodo e il motivo; chi approva vede anche
   quali turni resterebbero scoperti in quei giorni.                    */
const rqEtichetta = (k) => ({ ferie: '🏖 ' + t('ferie'), permesso: '🕒 ' + t('permesso'), cambio: '↔ ' + t('cambio_turno') })[k] || k;
const rqData = (s) => s ? new Date(s + 'T00:00').toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

async function loadRichieste() {
  const puoChiedere = can('ferie.request'), puoApprovare = can('ferie.approve');
  $('#rq-hello').innerHTML = mascotSays(puoApprovare
    ? t('rq_hello_capo')
    : t('rq_hello_dip'), 48);

  show('#rq-form-card', puoChiedere);
  show('#rq-approve-card', puoApprovare);

  if (puoChiedere) {
    const emps = await api('/employees');
    if ($('#rq-emp').options.length !== emps.length)
      $('#rq-emp').innerHTML = emps.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    if (!$('#rq-from').value) $('#rq-from').value = todayISO();
    if (!$('#rq-to').value) $('#rq-to').value = todayISO();
  }

  const r = await api('/shift-changes');
  window._richieste = r;
  const attesa = r.rows.filter(x => x.status === 'in attesa');
  $('#rq-count').textContent = attesa.length;

  // le richieste da decidere, una scheda per ognuna
  if (puoApprovare) {
    $('#rq-pending').innerHTML = attesa.length ? attesa.map(c => {
      const scoperti = c.turniScoperti || [];
      return `<div class="card">
        <div class="rq-head">
          <span class="rq-who">${c.employee}</span>
          <span class="muted">${c.employee_role || ''}</span>
          <span class="spacer" style="flex:1"></span>
          <span class="pill wait">${rqEtichetta(c.type)}</span>
        </div>
        <p style="font-size:13px;margin:8px 0 4px"><b>${rqData(c.from_date)}</b>${c.to_date !== c.from_date ? ` → <b>${rqData(c.to_date)}</b>` : ''}
          <span class="muted">· ${c.giorni} ${c.giorni === 1 ? 'giorno' : 'giorni'}</span></p>
        ${c.note ? `<p class="muted" style="font-size:12px;margin-bottom:6px">“${c.note}”</p>` : ''}
        ${scoperti.length ? `<div class="rq-warn">
            <b>${scoperti.length} ${scoperti.length === 1 ? 'turno' : 'turni'} da coprire:</b>
            ${scoperti.map(t => `<span class="chip">${rqData(t.date)} ${t.start}–${t.end}</span>`).join(' ')}
          </div>` : `<p class="muted" style="font-size:12px">${t('nessun_turno_periodo')}</p>`}
        <div class="onb-actions" style="margin-top:12px">
          <button class="ghost" onclick="rqDecide(${c.id},'rifiutato')">${t('rifiuta')}</button>
          <button class="act" onclick="rqDecide(${c.id},'approvato')">${t('approva')}</button>
        </div>
      </div>`;
    }).join('') : `<div class="card"><p class="muted">${t('nessuna_attesa')}</p></div>`;
  }

  // lo storico completo
  const puoRitirare = can('ferie.request');
  $('#rq-list').innerHTML = r.rows.map(c => {
    const cls = c.status === 'in attesa' ? 'wait' : c.status === 'approvato' ? 'ok' : 'low';
    return `<tr>
      <td>${c.employee}</td>
      <td>${rqEtichetta(c.type)}</td>
      <td>${rqData(c.from_date)}${c.to_date !== c.from_date ? ' → ' + rqData(c.to_date) : ''}
        <div class="muted" style="font-size:11px">${c.giorni} ${c.giorni === 1 ? 'giorno' : 'giorni'}</div></td>
      <td><span class="pill ${cls}">${c.status}</span>
        ${c.motivo ? `<div class="muted" style="font-size:11px">“${c.motivo}”</div>` : ''}</td>
      <td class="muted">${c.deciso_da || '—'}</td>
      <td class="right">${c.status === 'in attesa' && puoRitirare
        ? `<button class="iconbtn" onclick="rqRitira(${c.id}, '${c.employee.replace(/'/g, "\\'")}')" title="Ritira la richiesta">🗑</button>` : ''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">${t('nessuna_richiesta')}</td></tr>`;
}

// mentre compili, ti dico subito quanti turni toccheresti
async function rqPreview() {
  const from = $('#rq-from').value, to = $('#rq-to').value || from;
  const el = $('#rq-preview');
  if (!from) { el.textContent = ''; return; }
  if (to < from) { el.innerHTML = '<span style="color:var(--red)">La data di fine viene prima di quella di inizio.</span>'; return; }
  const g = Math.round((new Date(to + 'T00:00') - new Date(from + 'T00:00')) / 86400000) + 1;
  // i turni li sappiamo gia' dalla griglia: li chiediamo al server
  try {
    const turni = await api(`/shifts?from=${from}&to=${to}`);
    const miei = turni.filter(t => t.employee_id === +$('#rq-emp').value);
    el.innerHTML = `${g} ${g === 1 ? 'giorno' : 'giorni'}` +
      (miei.length ? ` · <b>${miei.length} ${miei.length === 1 ? 'turno' : 'turni'} già assegnati</b> in quel periodo` : ' · nessun turno assegnato');
  } catch { el.textContent = `${g} ${g === 1 ? 'giorno' : 'giorni'}`; }
}

async function rqSend() {
  const body = { employee_id: +$('#rq-emp').value, type: $('#rq-type').value,
    from_date: $('#rq-from').value, to_date: $('#rq-to').value, note: $('#rq-note').value.trim() };
  try {
    const out = await api('/shift-changes', 'POST', body);
    $('#rq-note').value = '';
    notify(t('nuova_richiesta'), `${rqEtichetta(body.type)} · ${rqData(body.from_date)}`);
    alert('Richiesta inviata.' + (out.turniScoperti ? `\nAttenzione: ${out.turniScoperti} turni sono già assegnati in quei giorni.` : ''));
    loadRichieste();
  } catch (e) { alert(e.message); }
}

async function rqDecide(id, status) {
  const c = (window._richieste.rows || []).find(x => x.id === id);
  let motivo = '';
  if (status === 'rifiutato') {
    motivo = prompt('Perché la rifiuti? (facoltativo, lo vedrà chi ha chiesto)') || '';
  } else if (c && c.turniScoperti && c.turniScoperti.length) {
    if (!confirm(`Approvando, ${c.turniScoperti.length} turni di ${c.employee} restano da coprire.\nProcedo?`)) return;
  }
  try { await api('/shift-changes/' + id, 'PUT', { status, motivo }); loadRichieste(); }
  catch (e) { alert(e.message); }
}

async function rqRitira(id, chi) {
  if (!confirm(`Ritirare la richiesta di ${chi}?`)) return;
  try { await api('/shift-changes/' + id, 'DELETE'); loadRichieste(); }
  catch (e) { alert(e.message); }
}
/* ===================== MANUALE DIPENDENTE ===================== */
async function loadManuale() {
  $('#manuale-hello').innerHTML = mascotSays(t('man_hello'), 48);
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


/* ===================== CONFIGURARE IL PROPRIO LOCALE =====================
   Prodotti, personale e PIN si inseriscono dall'app. Prima si potevano
   solo leggere: un locale nuovo non riusciva a mettere la sua roba e
   serviva mettere le mani nel database.                               */

/* --- prodotti --- */
async function addProduct() {
  const name = $('#np-name').value.trim();
  if (!name) return alert('Serve almeno il nome del prodotto.');
  try {
    await api('/products', 'POST', {
      name, format: $('#np-format').value.trim(),
      stock: $('#np-stock').value, threshold: $('#np-thr').value,
      par_level: $('#np-par').value, unit: $('#np-unit').value.trim() || 'bott.',
      vendor_id: $('#np-vendor').value,
    });
    ['#np-name', '#np-format', '#np-par'].forEach(s => $(s).value = '');
    $('#np-stock').value = '0'; $('#np-thr').value = '0';
    loadMagazzino();
  } catch (e) { alert(e.message); }
}
async function removeProduct(id) {
  // il nome lo cerchiamo qui: passarlo nell onclick si rompe con gli apostrofi
  const p = (window._products || []).find(x => x.id === id) || {};
  const name = p.name || "questo prodotto";
  if (!confirm(`Eliminare "${name}"?\nSi puo' solo se non ha movimenti né conteggi.`)) return;
  try { await api('/products/' + id, 'DELETE'); loadMagazzino(); }
  catch (e) { alert(e.message); }
}

/* --- personale --- */
async function loadEmployees() {
  const emps = await api('/employees');
  window._employees = emps;
  $('#emp-list').innerHTML = emps.map(e => `<tr>
    <td>${e.name}</td><td class="muted">${e.role || ''}</td>
    <td class="right">
      <button class="iconbtn" onclick="editEmployee(${e.id})" title="Modifica">✏️</button>
      <button class="iconbtn" onclick="removeEmployee(${e.id})" title="Elimina">🗑</button>
    </td></tr>`).join('') || `<tr><td colspan="3" class="muted">${t('nessun_dipendente')}</td></tr>`;
}
async function addEmployee() {
  const name = $('#ne-name').value.trim();
  if (!name) return alert('Serve il nome.');
  try {
    await api('/employees', 'POST', { name, role: $('#ne-role').value.trim() || 'barista' });
    $('#ne-name').value = ''; $('#ne-role').value = '';
    loadTurni();
  } catch (e) { alert(e.message); }
}
function editEmployee(id) {
  const e = (window._employees || []).find(x => x.id === id); if (!e) return;
  const nome = prompt('Nome del dipendente:', e.name); if (nome === null) return;
  const ruolo = prompt('Ruolo:', e.role || ''); if (ruolo === null) return;
  api('/employees/' + id, 'PUT', { name: nome.trim(), role: ruolo.trim() })
    .then(loadTurni).catch(err => alert(err.message));
}
async function removeEmployee(id) {
  const e = (window._employees || []).find(x => x.id === id) || {};
  const name = e.name || "questo dipendente";
  if (!confirm(`Eliminare ${name}?`)) return;
  try { await api('/employees/' + id, 'DELETE'); loadTurni(); }
  catch (e) { alert(e.message); }
}

/* --- impostazioni: PIN e profili di accesso --- */
async function openSettings() {
  let profili = [], ruoli = [];
  try { [profili, ruoli] = await Promise.all([api('/profiles'), api('/ruoli')]); } catch {}
  const admin = can('all');

  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:440px">
        <h3>Impostazioni</h3>

        <h3 style="margin-top:14px">Il tuo PIN</h3>
        <p class="muted" style="font-size:12px;margin-bottom:8px">${t("sei_entrato", { nome: "<b>" + nomeProfilo(PROFILE.name) + "</b>" })}</p>
        <div class="row c2">
          <div><label>PIN attuale</label><input id="pin-old" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
          <div><label>Nuovo PIN</label><input id="pin-new" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
        </div>
        <button class="act" onclick="changeOwnPin()">Cambia il mio PIN</button>

        ${admin ? `
        <h3 style="margin-top:20px">Profili di accesso</h3>
        <table><thead><tr><th>Nome</th><th>Accesso</th><th></th></tr></thead><tbody>
          ${profili.map(p => `<tr>
            <td>${nomeProfilo(p.name)}</td>
            <td class="muted">${p.permissions.includes('all') ? 'completo' : p.permissions.length + ' permessi'}</td>
            <td class="right">
              <button class="iconbtn" onclick="resetPin(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Reimposta PIN">🔑</button>
              ${p.id !== PROFILE.id ? `<button class="iconbtn" onclick="deleteProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Elimina">🗑</button>` : ''}
            </td></tr>`).join('')}
        </tbody></table>

        <h3 style="margin-top:16px">Nuovo profilo</h3>
        <div class="row c2">
          <div><label>Nome</label><input id="npf-name" placeholder="es. Barman sera"></div>
          <div><label>Ruolo</label><select id="npf-role">
            ${ruoli.map(r => `<option value="${r}">${nomeRuolo(r)}</option>`).join('')}
          </select></div>
        </div>
        <div class="row"><div><label>PIN (4 cifre)</label><input id="npf-pin" inputmode="numeric" maxlength="4" placeholder="es. 5555"></div></div>
        <button class="act" onclick="addProfile()">+ Crea profilo</button>

        <h3 style="margin-top:22px;color:var(--red)">Ricominciare da zero</h3>
        <p class="muted" style="font-size:12px;margin-bottom:8px">Cancella prodotti, giacenze, movimenti, dipendenti, turni, richieste, fornitori, postazioni e inventari. I profili e i PIN restano. Serve quando hai finito di provare e vuoi mettere i dati veri del locale.</p>
        <button class="danger" onclick="svuotaTutto()">🗑 Svuota tutti i dati</button>
        ` : ''}

        <div class="onb-actions" style="margin-top:20px">
          <button class="ghost" onclick="closeModal()">Chiudi</button>
        </div>
      </div>
    </div>`;
}

async function svuotaTutto() {
  const c = prompt(
    'Questo cancella TUTTI i dati: prodotti, giacenze, movimenti, dipendenti,\n' +
    'turni, task, richieste, fornitori, postazioni e inventari.\n\n' +
    'I profili di accesso e i PIN restano.\n' +
    'NON si puo\' annullare.\n\n' +
    'Se sei sicuro scrivi:  AZZERA');
  if (c === null) return;
  if (c.trim().toUpperCase() !== 'AZZERA') return alert('Non ho fatto niente.');
  try {
    const r = await api('/dati', 'DELETE', { conferma: 'AZZERA' });
    alert(`Fatto: ${r.totale} righe cancellate.\nRestano ${r.profiliRimasti} profili di accesso.\n\nOra l'app è vuota: mettici la tua roba.`);
    closeModal(); loadHome();
  } catch (e) { alert(e.message); }
}
async function changeOwnPin() {
  const attuale = $('#pin-old').value, nuovo = $('#pin-new').value;
  if (!/^[0-9]{4}$/.test(nuovo)) return alert('Il nuovo PIN deve essere di 4 cifre.');
  try {
    await api(`/profiles/${PROFILE.id}/pin`, 'PUT', { attuale, nuovo });
    alert('PIN cambiato. La prossima volta entra con quello nuovo.');
    closeModal();
  } catch (e) { alert(e.message); }
}
async function resetPin(id, nome) {
  const nuovo = prompt(`Nuovo PIN per "${nome}" (4 cifre):`);
  if (nuovo === null) return;
  if (!/^[0-9]{4}$/.test(nuovo)) return alert('Il PIN deve essere di 4 cifre.');
  try { await api(`/profiles/${id}/pin`, 'PUT', { nuovo }); alert(`PIN di ${nome} reimpostato.`); }
  catch (e) { alert(e.message); }
}
async function addProfile() {
  const name = $('#npf-name').value.trim(), pin = $('#npf-pin').value;
  if (!name) return alert('Serve il nome del profilo.');
  if (!/^[0-9]{4}$/.test(pin)) return alert('Il PIN deve essere di 4 cifre.');
  try {
    await api('/profiles', 'POST', { name, ruolo: $('#npf-role').value, pin });
    alert(`Profilo "${name}" creato.`);
    openSettings();
  } catch (e) { alert(e.message); }
}
async function deleteProfile(id, nome) {
  if (!confirm(`Eliminare il profilo "${nome}"?\nChi lo usava non potrà più entrare.`)) return;
  try { await api('/profiles/' + id, 'DELETE'); openSettings(); }
  catch (e) { alert(e.message); }
}

/* ===================== LINGUA =====================
   applicaLingua() riscrive il testo statico; ricaricaVista() ridisegna
   la schermata aperta, cosi' cambiano anche i testi generati dal codice.
   La lingua viaggia anche verso il server, che traduce i suoi messaggi. */
function ricaricaVista() {
  buildBottomNav();
  const loaders = { home: loadHome, vuoti: loadVuoti, turni: loadTurni,
    magazzino: loadMagazzino, inventario: loadInventario, ordini: loadOrdini,
    richieste: loadRichieste, manuale: loadManuale };
  if (TOKEN && PROFILE && loaders[currentView]) loaders[currentView]();
  else if (!TOKEN) initLogin();
}
/* ===================== TEMA CHIARO / SCURO =====================
   Scuro (verde) e chiaro (bianco, nero, arancione). La scelta resta
   salvata sul dispositivo: chi usa l'app al banco puo' tenere il chiaro
   di giorno e lo scuro di sera, indipendentemente dagli altri.      */
function temaCorrente() {
  try { return localStorage.getItem('bb_theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  // la barra di sistema del telefono segue il tema
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#ffffff' : '#0f1512');
  document.querySelectorAll('.themebtn').forEach(b => {
    b.textContent = t === 'light' ? '☀' : '🌙';
    b.title = t === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro';
  });
}
function toggleTheme() {
  const nuovo = temaCorrente() === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('bb_theme', nuovo); } catch {}
  applyTheme(nuovo);
}
applyTheme(temaCorrente());
applicaLingua();

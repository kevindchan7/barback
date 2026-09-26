/* =====================================================================
   app.js — Logica del frontend Barback.
   Mostra/nasconde funzioni in base ai PERMESSI del profilo (can()).
   ===================================================================== */
const $ = (s) => document.querySelector(s);
const eur = (n) => '€' + (Number(n) || 0).toFixed(2);
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
    ['ordini', '🛒', 'Ordini', can('magazzino.view')],
    ['drink', '🍸', 'Drink', can('drinkcost.view')],
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
        <div class="kpi"><div class="v">${eur(ov.giacenzaValore)}</div><div class="l">Valore giacenza</div></div>
        <div class="kpi"><div class="v">${ov.entrate}</div><div class="l">Entrate (mese)</div></div>
        <div class="kpi"><div class="v">${ov.uscite}</div><div class="l">Uscite (mese)</div></div>
      </div>`;
  } else $('#home-overview').innerHTML = '';

  // pulsanti visibili solo se permessi
  const btns = [
    ['vuoti', '🍾', 'Conteggio vuoti', 'Bottiglie consumate', can('vuoti.view')],
    ['turni', '📅', 'Turni & Task', 'Personale e obiettivi', can('turni.view') || can('task.view')],
    ['drink', '🍸', 'Drink Cost', 'Costo in tempo reale', can('drinkcost.view')],
    ['magazzino', '📦', 'Magazzino', 'Giacenze e consumi', can('magazzino.view')],
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
  const loaders = { home: loadHome, vuoti: loadVuoti, turni: loadTurni, drink: loadDrink,
    magazzino: loadMagazzino, ordini: loadOrdini, manuale: loadManuale };
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
    <td class="right">${eur(x.price)}</td><td class="right">${eur(x.total)}</td><td class="right">${x.residuo} ${x.unit}</td></tr>`).join('');
  $('#vuoti-tot').textContent = eur(r.totale);
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
  $('#mz-consumato').textContent = eur(r.totaleConsumato);
  $('#mz-low').textContent = r.sottoSoglia;
  renderMz();
}
function renderMz() {
  const q = (($('#mz-search') && $('#mz-search').value) || '').toLowerCase();
  const rows = (window._stockRows || []).filter(x => x.name.toLowerCase().includes(q));
  const editable = can('magazzino.view');
  $('#mz-list').innerHTML = rows.map(x => `<tr><td>${x.name}</td><td>${x.entrato}</td><td>${x.uscito}</td>
    <td style="color:${x.netto < 0 ? 'var(--red)' : 'var(--green)'}">${x.netto > 0 ? '+' : ''}${x.netto}</td>
    <td class="right">${eur(x.consumato)}</td><td class="right">${x.residua} ${x.unit}</td>
    <td class="right">${x.daOrdinare ? `<b style="color:var(--gold)">${x.daOrdinare}</b>` : '<span class="muted">—</span>'}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="editProduct(${x.id})" title="Modifica">✏️</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nessun prodotto trovato.</td></tr>';
}
function editProduct(id) {
  const p = (window._products || []).find(x => x.id === id); if (!p) return;
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>Modifica: ${p.name}</h3>
        <div class="row"><div><label>Nome</label><input id="ep-name" value="${p.name.replace(/"/g, '&quot;')}"></div></div>
        <div class="row c2">
          <div><label>Costo (€)</label><input id="ep-cost" type="number" step="0.001" value="${p.cost}"></div>
          <div><label>Prezzo (€)</label><input id="ep-price" type="number" step="0.01" value="${p.price}"></div>
        </div>
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
    await api('/products/' + id, 'PUT', { name: $('#ep-name').value, cost: $('#ep-cost').value, price: $('#ep-price').value,
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
  $('#or-totale').textContent = eur(o.totale);

  $('#ordini-list').innerHTML = o.gruppi.length ? o.gruppi.map((g, i) => `
    <div class="card">
      <h3>${g.vendor} <span class="muted">— ${g.righe.length} prodotti</span></h3>
      <table><thead><tr><th>Prodotto</th><th class="right">Giacenza</th><th class="right">Ideale</th>
        <th class="right">Da ordinare</th><th class="right">Costo</th></tr></thead>
        <tbody>${g.righe.map(r => `<tr><td>${r.name} <span class="muted">${r.format || ''}</span></td>
          <td class="right" style="color:var(--red)">${r.stock}</td>
          <td class="right muted">${r.par_level}</td>
          <td class="right"><b style="color:var(--gold)">${r.qty}</b> ${r.unit}</td>
          <td class="right">${eur(r.costo)}</td></tr>`).join('')}</tbody></table>
      <p class="right" style="margin-top:8px;font-weight:700">Totale: ${eur(g.totale)}</p>
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
    + g.righe.map(r => `• ${r.name}${r.format ? ' ' + r.format : ''} — ${r.qty} ${r.unit}`).join('\n')
    + `\n\nTotale stimato: ${eur(g.totale)}`;
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
  const aoa = [['Prodotto', 'Formato', 'Giacenza', 'Scorta ideale', 'Da ordinare', 'Unità', 'Costo €']];
  g.righe.forEach(r => aoa.push([r.name, r.format || '', r.stock, r.par_level, r.qty, r.unit, r.costo.toFixed(2)]));
  aoa.push([], ['', '', '', '', '', 'Totale', g.totale.toFixed(2)]);
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

/* ===================== SEZ.3 — DRINK COST ===================== */
async function loadDrink() {
  $('#drink-hint').innerHTML = mascotSays('Il costo si aggiorna se cambi i costi delle bottiglie nel magazzino.', 48);
  const drinks = await api('/drinkcost');
  $('#drink-list').innerHTML = drinks.map(d => {
    const col = d.pourCost > 30 ? 'var(--red)' : d.pourCost > 22 ? 'var(--yellow)' : 'var(--green)';
    return `<tr><td>${d.name}<div class="muted">${d.recipe.map(r => r.name + ' ' + r.q + 'ml').join(' · ')}</div></td>
      <td class="right">${eur(d.cost)}</td><td class="right">${eur(d.price)}</td>
      <td class="right" style="color:${col};font-weight:700">${d.pourCost}%</td></tr>`;
  }).join('');
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
      <b>${c.name}</b> <span class="muted">— ${eur(c.price)}</span>
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
  const aoa = [['Prodotto', 'Entrato', 'Uscito', 'Netto', 'Consumato €', 'Giacenza residua', 'Prezzo €']];
  rows.forEach(r => aoa.push([r.name, r.entrato, r.uscito, r.netto, r.consumato.toFixed(2), r.residua, r.price.toFixed(2)]));
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

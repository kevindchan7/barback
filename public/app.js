/* =====================================================================
   app.js — Logica del frontend Barback.
   Mostra/nasconde funzioni in base ai PERMESSI del profilo (can()).
   ===================================================================== */
const $ = (s) => document.querySelector(s);
// la giornata di lavoro, ora locale del telefono: cambia alle 6 del mattino come sul server
const todayISO = () => { const x = new Date(Date.now() - 6 * 3600000);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
let TOKEN = localStorage.getItem('bb_token') || null;
let PROFILE = JSON.parse(localStorage.getItem('bb_profile') || 'null');
let currentView = 'home';
/* IL LOCALE: su questo server ci sono tanti bar, ognuno col suo codice.
   Il codice si scrive una volta e il telefono lo ricorda. Arriva anche dal
   link:  ...onrender.com/?l=codice  (es. il QR attaccato dietro al banco). */
let LOCALE = (() => { try { return localStorage.getItem('bb_locale') || ''; } catch { return ''; } })();
(() => {
  const dalLink = new URLSearchParams(location.search).get('l');
  if (dalLink && dalLink.toLowerCase() !== LOCALE) {
    LOCALE = dalLink.toLowerCase();
    try { localStorage.setItem('bb_locale', LOCALE); localStorage.removeItem('bb_token'); localStorage.removeItem('bb_profile'); } catch {}
    TOKEN = null; PROFILE = null;
  }
})();
// il manifest col codice del locale: l'icona installata si apre nel bar giusto
function aggiornaManifest() {
  const l = document.querySelector('link[rel="manifest"]');
  if (l) l.href = 'manifest.webmanifest' + (LOCALE ? '?l=' + encodeURIComponent(LOCALE) : '');
}
aggiornaManifest();
/* LA CHIAVE DEL LOCALE: la si riceve scrivendo nome e password del locale
   (li sceglie il titolare). Resta sul telefono: la password si scrive una volta. */
let CHIAVE = (() => { try { return localStorage.getItem('bb_chiave') || ''; } catch { return ''; } })();
function salvaChiave(k) { CHIAVE = k || ''; try { k ? localStorage.setItem('bb_chiave', k) : localStorage.removeItem('bb_chiave'); } catch {} }
let pollTimer = null;

// can(cap): il profilo ha quella capacità? 'all' (proprietario) supera tutto.
function can(cap) { const p = (PROFILE && PROFILE.permissions) || []; return p.includes('all') || p.includes(cap); }
// solo se il permesso e' scritto nel profilo, senza contare 'all' (es. chiedere ferie: non il proprietario)
function canProprio(cap) { return ((PROFILE && PROFILE.permissions) || []).includes(cap); }

async function api(path, method = 'GET', body) {
  const conToken = !!TOKEN;
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Lang': (typeof LANG !== 'undefined' ? LANG : 'it'), 'X-Locale': LOCALE, ...(CHIAVE ? { 'X-Locale-Token': CHIAVE } : {}),
      ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // la sessione non vale piu' (server riavviato, profilo tolto): si torna alla scelta del profilo, senza messaggi di errore
  if (res.status === 401 && conToken && path !== '/auth/pin') { sessioneScaduta(); return new Promise(() => {}); }
  if (!res.ok) throw new Error(data.error || ('Errore ' + res.status));
  return data;
}
let _scaduta = false;
function sessioneScaduta() {
  if (_scaduta) return; _scaduta = true;
  TOKEN = null; PROFILE = null;
  try { localStorage.removeItem('bb_token'); localStorage.removeItem('bb_profile'); } catch {}
  closeModal && closeModal();
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
  initLogin().then(() => { $('#login-msg').textContent = '⚠ ' + t('sessione_scaduta'); _scaduta = false; });
}
const show = (sel, on) => { const e = $(sel); if (e) e.classList.toggle('hidden', !on); };

/* ===================== LOGIN A PIN ===================== */
let selProfile = null, pinBuf = '';
async function initLogin() {
  $('#login-head').innerHTML = mascotSays(t('ciao'));
  const reset = new URLSearchParams(location.search).get('reset');
  if (reset && LOCALE) return mostraReset(reset);
  if (!LOCALE) return mostraCodiceLocale();
  let info;
  try { info = await api('/locale/' + encodeURIComponent(LOCALE)); }
  catch (e) { return mostraCodiceLocale(e.message); }
  // locale con password: prima nome e password, solo dopo si scelgono i profili
  if (info.protetto && !CHIAVE) return mostraCodiceLocale('', true);
  let profiles;
  try { profiles = await api('/profiles'); }
  catch (e) { salvaChiave(''); return mostraCodiceLocale(info.protetto ? t('pw_cambiata') : e.message, info.protetto); }
  $('#locale-wrap').classList.add('hidden'); $('#reset-wrap').classList.add('hidden'); $('#pin-wrap').classList.add('hidden'); pinBuf = ''; $('#profiles-wrap').classList.remove('hidden');
  $('#locale-nome').innerHTML = '📍 <b>' + info.nome.replace(/</g, '&lt;') + '</b>' + (info.demo ? ' · PIN 1111' : '')
    + ' · <a href="#" onclick="cambiaLocale();return false">' + t('locale_cambia') + '</a>';
  $('#profiles').innerHTML = profiles.map(p => `
    <div class="profile" onclick="selectProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
      ${mascot(40)}
      <div><div class="pn">${nomeProfilo(p.name)}</div><div class="pr">${p.permissions.includes('all') ? t('accesso_completo') : t('permessi_n', { n: p.permissions.length })}</div></div>
    </div>`).join('');
}
function mostraCodiceLocale(errore, allaPassword) {
  $('#profiles-wrap').classList.add('hidden'); $('#pin-wrap').classList.add('hidden'); $('#reset-wrap').classList.add('hidden');
  $('#locale-wrap').classList.remove('hidden');
  $('#login-msg').textContent = errore ? '⚠ ' + errore : '';
  const c = $('#locale-codice'); c.value = LOCALE || ''; $('#locale-password').value = '';
  setTimeout(() => (allaPassword ? $('#locale-password') : c).focus(), 50);
}
async function entraLocale(codice) {
  const c = String(codice || $('#locale-codice').value || '').trim().toLowerCase();
  if (!c) return;
  const password = codice ? '' : $('#locale-password').value;
  $('#login-msg').textContent = '';
  try {
    // si puo' scrivere il nome com'e' ("Bar Sport"): il server lo riconosce
    const info = await api('/locale/' + encodeURIComponent(c));
    if (info.codice !== LOCALE) salvaChiave('');
    LOCALE = info.codice;
    if (info.protetto) {
      if (!password) { $('#login-msg').textContent = '⚠ ' + t('pw_scrivi'); return $('#locale-password').focus(); }
      salvaChiave((await api('/locale/entra', 'POST', { codice: LOCALE, password })).chiave);
    }
  } catch (e) { $('#login-msg').textContent = '⚠ ' + e.message; return; }
  try { localStorage.setItem('bb_locale', LOCALE); } catch {}
  aggiornaManifest();
  await initLogin();
}
function cambiaLocale() {
  LOCALE = ''; TOKEN = null; PROFILE = null; salvaChiave('');
  try { localStorage.removeItem('bb_locale'); localStorage.removeItem('bb_token'); localStorage.removeItem('bb_profile'); } catch {}
  mostraCodiceLocale();
}

/* ---- PIN o password dimenticati: il link arriva all'email del titolare ---- */
async function chiediReset(cosa) {
  const msg = $('#login-msg');
  try {
    if (cosa === 'password') {
      const c = String($('#locale-codice').value || '').trim().toLowerCase();
      if (!c) { msg.textContent = '⚠ ' + t('pw_serve_nome'); return $('#locale-codice').focus(); }
      LOCALE = (await api('/locale/' + encodeURIComponent(c))).codice;
    }
    msg.textContent = t('invio');
    const r = await api('/reset/chiedi', 'POST', { cosa, profileId: selProfile && selProfile.id });
    msg.textContent = '✉️ ' + t('reset_inviato', { email: r.a });
  } catch (e) { msg.textContent = '⚠ ' + e.message; }
}
/* col codice di recupero del titolare: niente email */
let recMode = null;
function mostraRecupero(cosa) {
  if (cosa === 'password') {
    const c = String($('#locale-codice').value || '').trim().toLowerCase();
    if (!c) { $('#login-msg').textContent = '⚠ ' + t('pw_serve_nome'); return $('#locale-codice').focus(); }
    api('/locale/' + encodeURIComponent(c)).then(i => { LOCALE = i.codice; }).catch(e => { $('#login-msg').textContent = '⚠ ' + e.message; });
  }
  recMode = cosa; resetToken = null;
  ['#locale-wrap', '#profiles-wrap', '#pin-wrap'].forEach(x => $(x).classList.add('hidden'));
  $('#reset-wrap').classList.remove('hidden');
  $('#reset-titolo').textContent = t(cosa === 'pin' ? 'rec_titolo_pin' : 'rec_titolo_pw');
  show('#reset-codice', true);
  const i = $('#reset-nuovo');
  i.type = cosa === 'pin' ? 'tel' : 'password'; i.maxLength = cosa === 'pin' ? 4 : 72; i.inputMode = cosa === 'pin' ? 'numeric' : 'text';
  i.placeholder = cosa === 'pin' ? t('ph_pin') : t('locale_pw_nuova_ph'); i.value = ''; $('#reset-codice').value = '';
  setTimeout(() => $('#reset-codice').focus(), 50);
}
let resetToken = null, resetDati = {};
function mostraReset(token) {
  resetToken = token; recMode = null; show('#reset-codice', false);
  try { resetDati = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { resetDati = {}; }
  const pin = resetDati.cosa === 'pin';
  ['#locale-wrap', '#profiles-wrap', '#pin-wrap'].forEach(s => $(s).classList.add('hidden'));
  $('#reset-wrap').classList.remove('hidden');
  $('#reset-titolo').textContent = pin ? t('reset_pin_titolo', { nome: nomeProfilo(resetDati.nome || '') }) : t('reset_pw_titolo');
  const i = $('#reset-nuovo');
  i.type = pin ? 'tel' : 'password'; i.maxLength = pin ? 4 : 72; i.inputMode = pin ? 'numeric' : 'text';
  i.placeholder = pin ? t('ph_pin') : t('locale_pw_nuova_ph'); i.value = ''; setTimeout(() => i.focus(), 50);
}
async function faiReset() {
  try {
    const r = recMode
      ? await api('/reset/recupero', 'POST', { cosa: recMode, recupero: $('#reset-codice').value, nuovo: $('#reset-nuovo').value })
      : await api('/reset/fai', 'POST', { token: resetToken, nuovo: $('#reset-nuovo').value });
    if (r.chiave) salvaChiave(r.chiave);
    history.replaceState(null, '', location.pathname + '?l=' + encodeURIComponent(LOCALE));
    recMode = null;
    await initLogin();
    $('#login-msg').textContent = '✓ ' + t(r.cosa === 'pin' ? 'reset_pin_fatto' : 'reset_pw_fatto');
  } catch (e) { $('#login-msg').textContent = '⚠ ' + e.message; }
}
function selectProfile(id, name) {
  selProfile = { id, name }; pinBuf = '';
  $('#profiles-wrap').classList.add('hidden'); $('#pin-wrap').classList.remove('hidden');
  $('#pin-for').textContent = t('pin_per') + ' ' + nomeProfilo(name);
  $('#pinpad').innerHTML = [1,2,3,4,5,6,7,8,9].map(d => `<button onclick="pinPress('${d}')">${d}</button>`).join('')
    + `<button onclick="pinDel()">⌫</button><button onclick="pinPress('0')">0</button><button onclick="submitPin()">✓</button>`;
  renderDots(); $('#login-msg').textContent = ''; $('#pin-reset').classList.toggle('hidden', LOCALE === 'demo');
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
  } catch (e) {
    $('#login-msg').textContent = '⚠ ' + e.message; pinBuf = ''; renderDots();
  }
}

function enterApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#banner-sub').textContent = nomeProfilo(PROFILE.name);
  applicaLingua();
  caricaImpostazioni();
  setTimeout(controllaAccesso, 900);   // dopo che la home si e' disegnata
  requestNotify(); buildBottomNav(); loadHome(); maybeOnboard();
}

/* Barra di navigazione in basso: solo le sezioni consentite dal profilo */
function buildBottomNav() {
  const items = [
    ['vuoti', '🍾', t('nav_vuoti'), can('vuoti.view')],
    ['turni', '📅', t('nav_turni'), can('turni.view') || can('task.view')],
    ['richieste', '🏖', t('nav_ferie'), can('ferie.view') || can('ferie.request')],
    ['costi', '🍸', t('nav_costi'), can('drinkcost.view')],
    ['magazzino', '📦', t('nav_magazzino'), can('magazzino.view') || can('vuoti.view') || can('carico.do')],
    ['manuale', '📖', t('nav_manuale'), can('manuale.view')],
  ].filter(i => i[3]);
  $('#bottomnav').innerHTML = items.map(i =>
    `<button data-nav="${i[0]}" onclick="go('${i[0]}')"><span class="bi">${i[1]}</span><span class="bl">${i[2]}</span></button>`).join('');
  setActiveNav(currentView);
}
function setActiveNav(view) {
  document.querySelectorAll('#bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.nav === (view === 'inventario' || view === 'ordini' ? 'magazzino' : view)));
}

/* Onboarding guidato dal barback (solo al primo accesso) */
function maybeOnboard() {
  if (localStorage.getItem('bb_onboarded')) return;
  const steps = [
    ['🍾', t('onb1_t'), t('onb1_d')],
    ['📦', t('onb2_t'), t('onb2_d')],
    ['📅', t('onb3_t'), t('onb3_d')],
    ['🛒', t('onb4_t'), t('onb4_d')],
    ['👇', t('onb5_t'), t('onb5_d')],
  ];
  let idx = 0;
  const render = () => { const s = steps[idx]; $('#onboarding').innerHTML = `
    <div class="onb-card">
      ${mascot(64)}
      <div class="ic">${s[0]}</div><h2>${s[1]}</h2><p>${s[2]}</p>
      <div class="onb-dots">${steps.map((_, i) => `<span class="${i === idx ? 'on' : ''}"></span>`).join('')}</div>
      <div class="onb-actions">
        <button class="ghost" onclick="endOnboard()">${t('salta')}</button>
        <button class="act" onclick="onbNext()">${idx < steps.length - 1 ? t('avanti') : t('inizia')}</button>
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
  // saluto grande, una riga: niente testi che occupano spazio senza servire
  $('#home-hello').innerHTML = `<div class="home-ciao">${mascot(54)}<h2>${t('home_ciao', { nome: nomeProfilo(PROFILE.name) })}</h2></div>`;

  // layout iniziale: giacenze / entrate / uscite
  let ov = null; try { ov = await api('/overview'); } catch {}
  if (ov && (can('magazzino.view') || can('vuoti.view'))) {
    $('#home-overview').innerHTML = `
      <div class="kpis home-kpis">
        <div class="kpi"><div class="v">${ov.giacenzaPezzi}</div><div class="l">${t('giacenza_pezzi')}</div></div>
        <div class="kpi"><div class="v">${ov.entrate}</div><div class="l">${t('entrate_mese')}</div></div>
        <div class="kpi"><div class="v">${ov.uscite}</div><div class="l">${t('uscite_mese')}</div></div>
      </div>`;
    if (ov.primoAvvio) $('#home-hello').insertAdjacentHTML('beforeend', `<p class="home-nota">${t('primo_avvio')}</p>`);
  } else $('#home-overview').innerHTML = '';

  // inizio mese: va fatta la giacenza del magazzino a mano (finche' non e' fatta, resta qui)
  window._contaDaFare = !!(ov && can('inventario.do') && ov.giacenzaMeseFatta === false);
  if (ov && can('inventario.do') && LOCALE !== 'demo' && ov.giacenzaMeseFatta === false) {
    $('#home-overview').insertAdjacentHTML('afterbegin', `<button class="avviso-mese" onclick="go('inventario', false, true)"><b>${t('mz_mese_tit')}</b><span>${t('mz_mese_txt')}</span><u>${t('mz_mese_vai')} ›</u></button>`);
    try { const k = 'bb_giacenza_' + ov.month; if (!localStorage.getItem(k)) { localStorage.setItem(k, '1'); notify(t('mz_mese_tit'), t('mz_mese_txt')); } } catch {}
  }

  // pulsanti visibili solo se permessi
  const btns = [
    ['vuoti', '🍾', t('sez_vuoti'), t('d_vuoti'), can('vuoti.view')],
    ['turni', '📅', t('sez_turni'), t('d_turni'), can('turni.view') || can('task.view')],
    ['tasks', '✅', t('sez_task'), t('d_task'), can('task.view')],
    ['richieste', '🏖', t('sez_ferie'), t('d_ferie'), can('ferie.view') || can('ferie.request')],
    ['costi', '🍸', t('sez_costi_drink'), t('d_costi_drink'), can('drinkcost.view')],
    ['magazzino', '📦', t('sez_magazzino_t'), t('d_inventario_tutto'), can('magazzino.view') || can('vuoti.view') || can('carico.do')],
    ['manuale', '📖', t('sez_manuale'), t('d_manuale'), can('manuale.view')],
  ];
  // ogni riga e' un bottone grande: icona, nome, e il numero che conta (se c'e')
  const numeri = { magazzino: ov && can('magazzino.view') ? ov.giacenzaPezzi + ' ' + t('home_bott') : '' };
  $('#home-grid').innerHTML = btns.filter(b => b[4]).map(b =>
    `<button class="home-btn hb-${b[0]}" onclick="go('${b[0]}')"><span class="ico">${b[1]}</span><span class="t">${b[2]}</span>${numeri[b[0]] ? `<span class="n">${numeri[b[0]]}</span>` : ''}<span class="vai">›</span></button>`).join('');
}

/* ===================== NAVIGAZIONE ===================== */
/* INVENTARIO = giacenze (quello che prima era "Magazzino") + conteggio.
   Una voce sola nel menu, due schede in alto per chi le puo' vedere entrambe. */
function schedeInventario(attiva) {
  const tabs = [
    ['magazzino', t('tab_giacenze'), can('magazzino.view') || can('vuoti.view') || can('carico.do'), ''],
    ['ordini', t('tab_ordini'), can('magazzino.view'), window._sottoSoglia ? `<i class="tab-n">${window._sottoSoglia}</i>` : ''],
    ['inventario', t('tab_conta'), can('inventario.view'), window._contaDaFare ? '<i class="tab-n">!</i>' : ''],
  ].filter(x => x[2]);
  const html = tabs.length > 1 ? `<div class="schede">${tabs.map(x =>
    `<button class="${attiva === x[0] ? 'on' : ''}" onclick="go('${x[0]}')">${x[1]}${x[3]}</button>`).join('')}</div>` : '';
  document.querySelectorAll('.schede-inv').forEach(e => { e.innerHTML = html; });
}
/* Semplice: le schede meno usate stanno chiuse. Si tocca il titolo e si apre. */
window._aperte = window._aperte || {};
function piega(card, titolo, chiave) {
  if (!card || card.dataset.piega) return;
  card.dataset.piega = '1'; card.classList.add('piega');
  const k = chiave || titolo;
  if (window._aperte[k]) card.classList.add('aperta');
  const b = document.createElement('button');
  b.className = 'piega-testa'; b.innerHTML = `<span>${titolo}</span><b>${card.classList.contains('aperta') ? '−' : '+'}</b>`;
  b.onclick = () => { const a = card.classList.toggle('aperta'); window._aperte[k] = a; b.lastChild.textContent = a ? '−' : '+'; };
  card.prepend(b);
}
function rendiPieghevoli() {
  const card = (sel) => { const e = document.querySelector(sel); return e && e.closest('.card'); };
  piega(card('#personale-card'), t('personale'), 'personale');
  piega(card('#shift-range'), t('vista'), 'vista');
  piega(card('#mz-newprod'), t('agg_prodotto'), 'newprod');
  piega(card('#mz-mvform'), t('carico_scarico'), 'mvform');
  piega(document.querySelector('#vuoti-grid-card'), t('griglia_mese_corto'), 'grigliavuoti');
}
function go(view, silent, proprioQuesta) {
  if (view === 'tasks') { go('turni'); setTimeout(() => { const c = $('#tasks-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350); return; }
  // "Inventario" dal menu: chi vede le giacenze parte da li'
  if (['magazzino', 'inventario', 'ordini'].includes(view)) schedeInventario(view);
  currentView = view;
  rendiPieghevoli();
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === view));
  setActiveNav(view);
  window.scrollTo(0, 0);
  if (pollTimer) clearInterval(pollTimer);
  if (silent) return;
  const loaders = { home: loadHome, vuoti: loadVuoti, turni: loadTurni,
    magazzino: loadMagazzino, inventario: loadInventario, ordini: loadOrdini,
    richieste: loadRichieste, manuale: loadManuale, costi: loadCosti };
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
    vuotiProds = prods.filter(p => p.category === 'Bottiglia');
  }
  if (!$('#vuoti-date').value) $('#vuoti-date').value = todayISO();
  const period = $('#vuoti-period').value, date = $('#vuoti-date').value;
  const r = await api(`/empties?period=${period}&date=${date}`);
  $('#vuoti-key').textContent = '(' + r.key + ')';
  $('#vuoti-list').innerHTML = r.rows.map(x => `<tr><td>${x.name}</td><td>${x.qty}</td>
    <td class="right">${x.residuo} ${x.unit}</td></tr>`).join("");
  // griglia del mese
  const grid = await api('/empties/grid?month=' + date.slice(0, 7));
  let html = `<tr><th>${t('prodotto')}</th>` + grid.days.map(d => `<th>${d}</th>`).join('') + '</tr>';
  grid.rows.forEach(row => {
    html += `<tr><td style="text-align:left">${row.name}</td>` +
      row.perDay.map(q => `<td class="${q ? 'has' : ''}">${q || ''}</td>`).join('') + '</tr>';
  });
  $('#vuoti-grid').innerHTML = html;
  caricaMieiVuoti();
}
/* Ricerca prodotto: si scrive un pezzo del nome e si tocca il risultato.
   Accenti e maiuscole non contano. */
let vuotiProds = [];
const normTxt = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function vuotiMatches() {
  const q = normTxt($('#vuoti-search').value.trim());
  return vuotiProds.filter(p => normTxt(p.name + ' ' + p.format).includes(q));
}
function vuotiFilter() {
  const m = vuotiMatches();
  // mousedown con preventDefault: altrimenti il campo perde il fuoco e la lista sparisce prima del tocco
  $('#vuoti-sugg').innerHTML = m.length
    ? m.map(p => `<button type="button" onmousedown="event.preventDefault()" onclick="vuotiPick(${p.id})">${p.name} <span class="muted">(${p.format})</span></button>`).join('')
    : `<div class="muted" style="padding:10px">${t('nessun_risultato')}</div>`;
  show('#vuoti-sugg', true);
}
function vuotiPick(id) {
  const p = vuotiProds.find(x => x.id === id);
  $('#vuoti-prod').value = id;
  $('#vuoti-search').value = `${p.name} (${p.format})`;
  $('#vuoti-search').blur();
}
function vuotiKey(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const m = vuotiMatches();
  if (m.length) vuotiPick(m[0].id);
}
async function addEmpty() {
  if (!$('#vuoti-prod').value) { alert(t('scegli_prodotto')); $('#vuoti-search').focus(); return; }
  try {
    const nomeV = $('#vuoti-search').value;
    const rv = await api('/movements', 'POST', { productId: +$('#vuoti-prod').value, type: 'vuoto',
      qty: +$('#vuoti-qty').value, source: $('#vuoti-src').value,
      ...($('#vuoti-giorno') && $('#vuoti-giorno').value && $('#vuoti-giorno').value !== todayISO() ? { data: $('#vuoti-giorno').value } : {}) });
    avvisoGiacenza(rv, nomeV);
    // pronto per il prossimo prodotto
    $('#vuoti-prod').value = ''; $('#vuoti-search').value = ''; $('#vuoti-qty').value = 1;
    loadVuoti();
  } catch (e) { alert(e.message); }
}

/* ===================== SEZ.4 — MAGAZZINO ===================== */
async function loadMagazzino() {
  const [prods, vendors] = await Promise.all([api('/products'), api('/vendors')]);
  window._ordine = window._ordine || {};
  window._vendors = vendors;
  window._products = prods;
  // i campi di costo e prezzo esistono solo per chi li puo' vedere
  const zonaCosti = $('#np-costi');
  if (zonaCosti) zonaCosti.hidden = !can('drinkcost.view');
  $('#mv-prod').innerHTML = prods.filter(p => p.category === 'Bottiglia').map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  // tipi di movimento consentiti dai permessi
  const types = [];
  if (can('carico.do')) types.push(['carico', t('carico_forn')]);
  if (can('vuoti.do')) types.push(['scarico', t('scarico')], ['vuoto', t('vuoto')]);
  $('#mv-type').innerHTML = types.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('');
  show('#mz-mvform', types.length > 0);
  // form per aggiungere un prodotto nuovo
  show('#mz-newprod', can('magazzino.view') || can('etichette.new'));
  show('#mz-ordine-box', can('magazzino.view')); show('#mz-th-ord', can('magazzino.view'));
  show('#mz-exports', can('all'));
  $("#np-vendor").innerHTML = `<option value="">${t("nessuno")}</option>`
    + vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

  const r = await api('/reports/monthly');
  window._stockRows = r.rows;
  $('#mz-month').textContent = '(' + r.month + (r.sottoSoglia ? ' · ' + r.sottoSoglia + ' ' + t('sotto_soglia').toLowerCase() : '') + ')';
  if (window._sottoSoglia !== r.sottoSoglia) { window._sottoSoglia = r.sottoSoglia; schedeInventario('magazzino'); }
  renderMz();
  caricaStoricoMov();
}
function renderMz() {
  const q = (($('#mz-search') && $('#mz-search').value) || '').toLowerCase();
  const rows = (window._stockRows || []).filter(x => x.name.toLowerCase().includes(q));
  const gestisce = can('magazzino.view'), ord = window._ordine || {};
  const sotto = (x) => x.residua <= x.threshold;
  $('#mz-list').innerHTML = rows.map(x => `<tr><td>${gestisce ? `<a href="#" class="prod-nome" onclick="editProduct(${x.id});return false">${esc(x.name)}</a>` : esc(x.name)}${x.format ? `<br><span class="muted" style="font-size:11px">${esc(x.format)}</span>` : ''}</td>
    <td class="right">${x.inizio}</td><td class="right">${x.entrato ? '+' + x.entrato : '<span class="muted">0</span>'}</td>
    <td class="right">${x.vuoti ? '−' + x.vuoti : '<span class="muted">0</span>'}</td>
    <td class="right"><b${x.residua < 0 || sotto(x) ? ' class="basso"' : ''}>${x.residua}</b></td>
    ${gestisce ? `<td class="right"><input class="ord-q" type="number" inputmode="numeric" min="0" value="${ord[x.id] || ''}" placeholder="${x.daOrdinare || 0}" oninput="window._ordine[${x.id}]=this.value"></td>
` : ''}</tr>`).join("")
    || `<tr><td colspan="6" class="muted">${t('nessun_prodotto')}</td></tr>`;
}
// quantita' suggerite (da soglia e scorta ideale) scritte nelle caselle "Ordina"
function compilaSuggeriti() {
  window._ordine = window._ordine || {};
  (window._stockRows || []).forEach(x => { if (x.daOrdinare) window._ordine[x.id] = x.daOrdinare; });
  renderMz();
}
// il PDF del solo ordine: i prodotti con un numero scritto accanto
async function pdfOrdineMagazzino() {
  const ord = window._ordine || {};
  const righe = (window._stockRows || []).filter(x => +ord[x.id] > 0).map(x => ({ nome: x.name + (x.format ? ' ' + x.format : ''), qta: String(+ord[x.id]) }));
  if (!righe.length) return alert(t('mz_nessun_ordine'));
  try { await prendiPdf('/orders/pdf', { fornitore: $('#mz-forn').value, righe }, 'ordine.pdf'); } catch (e) { alert(e.message); }
}
function editProduct(id) {
  const p = (window._products || []).find(x => x.id === id); if (!p) return;
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>${t('modifica')}: ${p.name}</h3>
        <div class="row"><div><label>${t('nome')}</label><input id="ep-name" value="${p.name.replace(/"/g, '&quot;')}"></div></div>
        <div class="row c2">
          <div><label>${t('soglia_riordino')}</label><input id="ep-thr" type="number" value="${p.threshold}"></div>
          <div><label>${t('scorta_ideale')}</label><input id="ep-par" type="number" value="${p.par_level || 0}"></div>
        </div>
        <p class="muted" style="font-size:11px;margin:-4px 0 8px">${t("soglia_aiuto")}</p>
        <div class="row c2">
          <div><label>${t('formato')}</label><input id="ep-format" value="${(p.format || '').replace(/"/g, '&quot;')}"></div>
          <div><label>${t('unita')}</label><input id="ep-unit" value="${(p.unit || '').replace(/"/g, '&quot;')}"></div>
        </div>
        <div class="row"><div><label>${t('fornitore')}</label><select id="ep-vendor">
          <option value="">${t('nessuno')}</option>
          ${(window._vendors || []).map(v => `<option value="${v.id}" ${v.id === p.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select></div></div>
        ${can('drinkcost.view') ? `
        <h3 style="margin-top:14px;font-size:14px">${t('sez_costi')}</h3>
        <p class="muted" style="font-size:11.5px;margin:2px 0 8px">${t('sez_costi_aiuto')}</p>
        <div class="row c2">
          <div><label>${t('costo_acquisto')}</label><input id="ep-cost" type="number" min="0" step="0.01" value="${p.cost || 0}"></div>
          <div><label>${t('volume_bottiglia')}</label><input id="ep-vol" type="number" min="0" step="1" value="${p.volume_ml || 0}"></div>
        </div>
        <p class="muted" style="font-size:11.5px;margin:-4px 0 8px">${t('volume_aiuto')}</p>` : ''}
        <div class="onb-actions">
          <button class="danger" onclick="closeModal();removeProduct(${id})">🗑 ${t('elimina')}</button><span style="flex:1"></span>
          <button class="ghost" onclick="closeModal()">${t('annulla')}</button>
          <button class="act" onclick="saveProduct(${id})">${t('salva')}</button>
        </div>
      </div>
    </div>`;
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  /* se l'invito a installare era in attesa perche' c'era una finestra
     aperta, adesso lo spazio e' libero */
  if (typeof mostraStrisciaInstalla === 'function') mostraStrisciaInstalla();
}
async function saveProduct(id) {
  try {
    /* Chi vede i costi li manda; gli altri non mandano nulla e il
       server lascia quelli che c'erano, invece di azzerarli. */
    const corpo = { name: $('#ep-name').value, format: $('#ep-format').value, unit: $('#ep-unit').value,
      threshold: $('#ep-thr').value, par_level: $('#ep-par').value, vendor_id: $('#ep-vendor').value };
    if (can('drinkcost.view')) {
      corpo.cost = $('#ep-cost').value;
      corpo.volume_ml = $('#ep-vol').value;
    }
    await api('/products/' + id, 'PUT', corpo);
    closeModal(); loadMagazzino();
  } catch (e) { alert(e.message); }
}
async function addMovement() {
  try {
    const type = $('#mv-type').value;
    const sel = $('#mv-prod');
    const rm = await api('/movements', 'POST', { productId: +sel.value, type, qty: +$('#mv-qty').value,
      source: type === 'carico' ? 'fornitore' : 'manuale',
      ...($('#mv-giorno') && $('#mv-giorno').value && $('#mv-giorno').value !== todayISO() ? { data: $('#mv-giorno').value } : {}) });
    avvisoGiacenza(rm, sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '');
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
  let locs = await api('/locations');
  if (!locs.length) {   // primo conteggio: crea da solo la postazione "Banco"
    try { await api('/locations', 'POST', { name: t('postazione_banco') }); } catch {}
    locs = await api('/locations');
    if (!locs.length) { alert(t('postazione_serve')); return invShow('start'); }
  }
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
    <td class="right">${editable ? `<button class="iconbtn" onclick="rinominaPostazione(${l.id}, '${l.name.replace(/'/g, "\\'")}')" title="${t('modifica')}">✏️</button>
      <button class="iconbtn" onclick="removeLocation(${l.id}, '${l.name.replace(/'/g, "\\'")}')" title="${t('elimina')}">🗑</button>` : ''}</td></tr>`).join('')
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
  if (!('BarcodeDetector' in window)) return alert(t('bc_no_lettore'));
  let det;
  try { det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }); }
  catch { return alert('Lettore codici non disponibile su questo telefono.'); }

  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)bcStop()">
      <div class="modal">
        <h3>${t('bc_titolo')}</h3>
        <video id="bc-video" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:cover"></video>
        <p class="muted" id="bc-msg" style="font-size:12px;margin-top:8px">${t('bc_avvicina')}</p>
        <div class="onb-actions"><button class="ghost" onclick="bcStop()">${t('chiudi')}</button></div>
      </div>
    </div>`;
  try {
    bcStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch { $('#bc-msg').textContent = t('bc_no_cam'); return; }
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
        <h3>${t('bc_nuovo')}</h3>
        <p class="muted" style="font-size:12px">${t('bc_spiega', { code: '<b>' + code + '</b>' })}</p>
        <div class="row" style="margin-top:10px"><div><label>${t('prodotto')}</label><select id="bc-prod">
          ${invItems.map(p => `<option value="${p.id}">${p.name} ${p.format || ''}</option>`).join('')}
        </select></div></div>
        <div class="onb-actions">
          <button class="ghost" onclick="closeModal()">${t('annulla')}</button>
          <button class="act" onclick="bcLink('${code}')">${t('collega')}</button>
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
  window._sottoSoglia = o.prodotti; schedeInventario('ordini');
  

  $('#ordini-list').innerHTML = o.gruppi.length ? o.gruppi.map((g, i) => `
    <div class="card">
      <h3>${g.vendor} <span class="muted">— ${t('n_prodotti', { n: g.righe.length })}</span></h3>
      <div class="grid-scroll"><table><thead><tr><th>${t('prodotto')}</th><th class="right">${t('giacenza')}</th><th class="right">${t('ideale')}</th>
        <th class="right">${t('da_ordinare')}</th></tr></thead>
        <tbody>${g.righe.map(r => `<tr><td>${r.name} <span class="muted">${r.format || ''}</span></td>
          <td class="right" style="color:var(--red)">${r.stock}</td>
          <td class="right muted">${r.par_level}</td>
          <td class="right"><b style="color:var(--gold)">${r.qty}</b> ${r.unit}</td>
          </tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:8px">
        <button class="act" onclick="pdfOrdine(${i})">${t('pdf_fornitore')}</button>
        ${g.phone ? `<button class="act gold" onclick="whatsappOrdine(${i})">${t('manda_whatsapp')}</button>` : ''}
        <button class="ghost" onclick="copiaOrdine(${i})">${t('copia_testo')}</button>
      </div>
    </div>`).join('')
    : `<div class="card">${mascotSays('Non c\'è niente da ordinare: nessun prodotto è arrivato alla soglia. 👍', 48)}</div>`;

  // ordine scritto a mano: i fornitori nella tendina
  $('#om-fornitore').innerHTML = `<option value="">${t('om_altro')}</option>` + vendors.map(v => `<option>${v.name.replace(/</g, '&lt;')}</option>`).join('');
  // elenco fornitori
  const editable = can('magazzino.view');
  $('#vendor-list').innerHTML = vendors.map(v => `<tr><td>${v.name}</td><td>${v.phone || '—'}</td><td>${v.email || '—'}</td>
    <td class="right">${editable ? `<button class="iconbtn" onclick="removeVendor(${v.id})" title="${t('elimina')}">🗑</button>` : ""}</td></tr>`).join("")
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

/* ===================== SEZ.2 — TURNI & TASK =====================
   Un calendario del mese: in ogni giorno si vedono i nomi di chi lavora.
   Toccando un giorno si apre il giorno: turni e task di quel giorno,
   e da li' si aggiungono.                                              */
const pad2 = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function rangeDates() {
  const ref = $('#shift-date').value || todayISO();
  const d = new Date(ref + 'T00:00'); const range = $('#shift-range').value;
  let from, to;
  if (range === 'day') { from = to = new Date(d); }
  else if (range === 'week') { const wd = (d.getDay() + 6) % 7; from = new Date(d); from.setDate(d.getDate() - wd); to = new Date(from); to.setDate(from.getDate() + 6); }
  else { from = new Date(d.getFullYear(), d.getMonth(), 1); to = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  const days = []; for (let x = new Date(from); x <= to; x.setDate(x.getDate() + 1)) days.push(new Date(x));
  // data locale, non toISOString: in Italia la mezzanotte locale e' ancora "ieri" in UTC
  return { from: isoLocal(from), to: isoLocal(to), days };
}

async function loadTurni() {
  if (!$('#shift-date').value) $('#shift-date').value = todayISO();
  loadShifts();
  if (!calSel && calYM === isoLocal(new Date()).slice(0, 7)) calSel = todayISO();
  await loadCal();
  // turni su piu' giorni: form solo per chi ha turni.manage
  show('#sh-form', can('turni.manage'));
  if (can('turni.manage')) {
    const emps = await api('/employees');
    const cur = $('#sh-emp').value;   // l'aggiornamento automatico non deve cambiare il dipendente scelto
    $('#sh-emp').innerHTML = emps.map(e => `<option value="${e.id}">${esc(e.name)} (${esc(e.role)})</option>`).join('');
    if (cur && emps.some(e => String(e.id) === cur)) $('#sh-emp').value = cur;
    await loadPicker();
  }
  if (can('task.view')) await loadTasks();
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
  let html = `<tr><th>${t('dipendente')}</th>` + days.map(d => `<th>${fmtDay(isoLocal(d))}</th>`).join('') + '</tr>';
  emps.forEach(e => {
    html += `<tr><td style="text-align:left"><i class="dot" style="background:${e.color || '#888'}"></i>${e.name}</td>` + days.map(d => {
      const k = isoLocal(d);
      const cell = shifts.filter(s => s.employee_id === e.id && s.date === k).map(s =>
        `<span class="chip" ${editable ? `onclick="editShift(${s.id})" title="${t('modifica_turno')}" style="cursor:pointer"` : ''}>${s.start}–${s.end}${editable ? ' ✏️' : ''}</span>`).join('');
      return `<td class="${cell ? 'has' : ''}">${cell || ''}</td>`;
    }).join('') + '</tr>';
  });
  $('#shift-grid').innerHTML = html;
}
async function deleteShift(id) {
  if (!confirm(t('conferma_elimina_turno'))) return;
  try { await api('/shifts/' + id, 'DELETE'); refreshTurni(); } catch (e) { alert(e.message); }
}
function refreshTurni() { return Promise.all([loadShifts(), loadCal(), loadPicker()]); }

/* --- calendario del mese: lunedi' in prima colonna --- */
function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7, n = new Date(y, m, 0).getDate();
  return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${ym}-${pad2(i + 1)}`)];
}
function shiftYM(ym, delta) { const [y, m] = ym.split('-').map(Number); return isoLocal(new Date(y, m - 1 + delta, 1)).slice(0, 7); }
function monthTitle(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }); }
function calHtml(ym, cell) {
  // 1 gennaio 2024 era lunedi': da li' i nomi dei giorni nella lingua scelta
  const heads = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'narrow' }));
  return heads.map(h => `<div class="cal-h">${h}</div>`).join('')
    + monthDays(ym).map(d => d ? cell(d) : '<div></div>').join('');
}
const shiftDots = (list) => list.map(s => `<i style="background:${s.color || '#888'}"></i>`).join('');

let calYM = isoLocal(new Date()).slice(0, 7), calSel = null, calMulti = false;
const calSet = new Set();
function calMultiToggle() {
  calMulti = !calMulti; calSet.clear(); calSel = null;
  const b = $('#cal-multi-btn'); b.className = calMulti ? 'act' : 'ghost'; loadCal();
}
function calMove(d) { calYM = shiftYM(calYM, d); calSel = null; loadCal(); }  // la scelta di piu' giorni resta fra un mese e l'altro
async function loadCal() {
  const [shifts, emps, tasks] = await Promise.all([
    api(`/shifts?from=${calYM}-01&to=${calYM}-31`), api('/employees'),
    can('task.view') ? api(`/tasks/range?from=${calYM}-01&to=${calYM}-31`) : [] ]);
  window._calShifts = shifts; window._calEmps = emps; window._calTasks = tasks;
  const today = isoLocal(new Date());
  $('#cal-title').textContent = monthTitle(calYM);
  $('#cal-grid').innerHTML = calHtml(calYM, d => {
    const dei = shifts.filter(s => s.date === d), nt = tasks.filter(x => x.date === d && !x.template_id).length;
    const nomi = dei.slice(0, 3).map(s => `<i style="--c:${s.color || '#888'}">${esc(String(s.employee).split(' ')[0].slice(0, 5))}</i>`).join('')
      + (dei.length > 3 ? `<i class="piu">+${dei.length - 3}</i>` : '');
    return `<button class="cal-d${d === today ? ' today' : ''}${d === calSel ? ' sel' : ''}${calSet.has(d) ? ' picked' : ''}" onclick="calPick('${d}')">
      <span class="n">${+d.slice(8)}</span><div class="nomi">${nomi}</div>${nt ? `<b class="tk">${nt}✓</b>` : ''}</button>`;
  });
  $('#cal-legend').innerHTML = '';
  calDay();
}
function calPick(d) {
  if (calMulti) { calSet.has(d) ? calSet.delete(d) : calSet.add(d); return loadCal(); }
  calSel = d; loadCal().then(() => { const e = $('#cal-day'); if (e && e.scrollIntoView) e.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }); }
function calDay() {
  if (calMulti) return calDayMulti();
  if (!calSel) { $('#cal-day').innerHTML = `<p class="muted" style="margin-top:10px">${t('cal_tocca')}</p>`; return; }
  const editable = can('turni.manage'), emps = window._calEmps || [];
  const list = (window._calShifts || []).filter(s => s.date === calSel);
  const tasks = (window._calTasks || []).filter(x => x.date === calSel && !x.template_id);
  const titolo = new Date(calSel + 'T00:00').toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const opz = (v) => emps.map(e => `<option value="${e.id}" ${String(e.id) === String(v) ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  const ultimo = window._ultimoEmp || (emps[0] && emps[0].id);
  let h = `<h3 style="margin-top:14px;text-transform:capitalize">${titolo}</h3><h4 class="cal-sub">${t('turni_del_giorno')}</h4>`;
  h += list.length ? list.map(s => `
    <div class="cal-row"><i class="dot" style="background:${s.color || '#888'}"></i><b>${esc(s.employee)}</b>
      <span class="muted">${s.start}–${s.end}${s.role ? ' · ' + esc(s.role) : ''}</span><span style="flex:1"></span>
      ${editable ? `<button class="iconbtn" onclick="editShift(${s.id})" title="${t('modifica')}">✏️</button><button class="iconbtn" onclick="deleteShift(${s.id})" title="${t('elimina')}">✕</button>` : ''}</div>`).join('')
    : `<p class="muted">${t('nessun_turno')}</p>`;
  if (editable && emps.length) h += `
    <div class="cal-add"><select id="gd-emp">${opz(ultimo)}</select>
      <input id="gd-start" type="time" value="${window._ultimoInizio || '16:00'}"><input id="gd-end" type="time" value="${window._ultimoFine || '23:00'}">
      <button class="act" onclick="addTurnoGiorno()">+ ${t('turno')}</button></div>`;
  if (can('task.view')) {
    const oggi = todayISO();
    h += `<h4 class="cal-sub">${t('task_del_giorno')}</h4>`;
    h += tasks.length ? tasks.map(x => `
      <div class="cal-row"><span>${x.done ? '☑' : '☐'}</span><span style="${x.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(x.title)}</span>
        <span style="flex:1"></span><span class="muted">${esc(x.assignee || '')}</span>
        ${can('task.manage') ? `<button class="iconbtn" onclick="eliminaTask(${x.id}, '${String(x.title).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="${t('elimina')}">🗑</button>` : ''}</div>`).join('')
      : `<p class="muted">${t('nessuna_task')}</p>`;
    if (can('task.manage') || can('task.request')) h += `
      <div class="cal-add"><input id="gd-task" maxlength="120" placeholder="${t('ph_task')}">
        <select id="gd-who"><option value="">${t('chiunque')}</option>${opz('')}</select>
        <button class="act" onclick="addTaskGiorno()">+ ${t('task')}</button></div>`;
  }
  $('#cal-day').innerHTML = h;
}
function calDayMulti() {
  const emps = window._calEmps || [], n = calSet.size;
  const opz = (v) => emps.map(e => `<option value="${e.id}" ${String(e.id) === String(v) ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  if (!n) { $('#cal-day').innerHTML = `<p class="muted" style="margin-top:10px">${t('cal_multi_aiuto')}</p>`; return; }
  const ultimo = window._ultimoEmp || (emps[0] && emps[0].id);
  let h = `<h3 style="margin-top:14px">${t('n_giorni_scelti', { n })} <button class="iconbtn" onclick="calSet.clear();loadCal()" title="${t('svuota')}">✕</button></h3>`;
  if (can('turni.manage') && emps.length) h += `<h4 class="cal-sub">${t('turno')}</h4>
    <div class="cal-add"><select id="gd-emp">${opz(ultimo)}</select>
      <input id="gd-start" type="time" value="${window._ultimoInizio || '16:00'}"><input id="gd-end" type="time" value="${window._ultimoFine || '23:00'}">
      <button class="act" onclick="addTurnoMulti()">+ ${t('turno')} × ${n}</button></div>`;
  if (can('task.manage') || can('task.request')) h += `<h4 class="cal-sub">${t('task')}</h4>
    <div class="cal-add"><input id="gd-task" maxlength="120" placeholder="${t('ph_task')}">
      <select id="gd-who"><option value="">${t('chiunque')}</option>${opz('')}</select>
      <button class="act" onclick="addTaskMulti()">+ ${t('task')} × ${n}</button></div>`;
  $('#cal-day').innerHTML = h;
}
async function addTurnoMulti() {
  const emp = +$('#gd-emp').value; if (!emp) return;
  window._ultimoEmp = emp; window._ultimoInizio = $('#gd-start').value; window._ultimoFine = $('#gd-end').value;
  const e = (window._calEmps || []).find(x => x.id === emp) || {};
  try {
    for (const d of [...calSet].sort()) await api('/shifts', 'POST', { employee_id: emp, date: d, start: $('#gd-start').value, end: $('#gd-end').value, role: e.role || '' });
    calSet.clear(); await refreshTurni();
  } catch (er) { alert(er.message); await refreshTurni(); }
}
async function addTaskMulti() {
  const title = $('#gd-task').value.trim(); if (!title) return $('#gd-task').focus();
  try {
    for (const d of [...calSet].sort()) await api('/tasks', 'POST', { title, date: d, assignee_id: +$('#gd-who').value || null });
    calSet.clear(); await loadCal(); loadTasks();
  } catch (er) { alert(er.message); await loadCal(); }
}
async function addTurnoGiorno() {
  const emp = +$('#gd-emp').value; if (!emp) return;
  window._ultimoEmp = emp; window._ultimoInizio = $('#gd-start').value; window._ultimoFine = $('#gd-end').value;
  const e = (window._calEmps || []).find(x => x.id === emp) || {};
  try { await api('/shifts', 'POST', { employee_id: emp, date: calSel, start: $('#gd-start').value, end: $('#gd-end').value, role: e.role || '' }); refreshTurni(); }
  catch (er) { alert(er.message); }
}
async function nuovaTask() {
  const emps = await api('/employees').catch(() => []);
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">
      <h3>${t('nuova_task')}</h3>
      <label>${t('cosa_fare')}</label><input id="nt-title" maxlength="120" placeholder="${t('ph_task')}">
      <div class="row c2"><div><label>${t('assegnata_a')}</label><select id="nt-who"><option value="">${t('chiunque')}</option>${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
        <div><label>${t('giorno')}</label><input id="nt-date" type="date" value="${todayISO()}"></div></div>
      <div class="onb-actions" style="margin-top:14px"><button class="ghost" onclick="closeModal()">${t('annulla')}</button><button class="act" onclick="salvaNuovaTask()">${t('salva')}</button></div>
    </div></div>`;
  setTimeout(() => $('#nt-title') && $('#nt-title').focus(), 50);
}
async function salvaNuovaTask() {
  const title = $('#nt-title').value.trim(); if (!title) return $('#nt-title').focus();
  try {
    await api('/tasks', 'POST', { title, date: $('#nt-date').value || todayISO(), assignee_id: +$('#nt-who').value || null });
    closeModal(); notify(t('nuova_task'), title); await loadTasks();
  } catch (er) { alert(er.message); }
}
async function addTaskGiorno() {
  const title = $('#gd-task').value.trim(); if (!title) return $('#gd-task').focus();
  try {
    await api('/tasks', 'POST', { title, date: calSel, assignee_id: +$('#gd-who').value || null });
    notify('Nuova task', title); await loadCal(); loadTasks();
  } catch (er) { alert(er.message); }
}

/* --- inserimento: un dipendente, tanti giorni scelti toccandoli --- */
let pickYM = isoLocal(new Date()).slice(0, 7);
const pickSel = new Set();
function pickMove(d) { pickYM = shiftYM(pickYM, d); loadPicker(); }
function pickToggle(d) { pickSel.has(d) ? pickSel.delete(d) : pickSel.add(d); loadPicker(); }
function pickClear() { pickSel.clear(); loadPicker(); }
async function loadPicker() {
  if (!can('turni.manage')) return;
  const emp = +$('#sh-emp').value;
  // i turni che ha gia' quel mese, per non scegliere a vuoto
  const gia = emp ? (await api(`/shifts?from=${pickYM}-01&to=${pickYM}-31`)).filter(s => s.employee_id === emp) : [];
  $('#pick-title').textContent = monthTitle(pickYM);
  $('#pick-grid').innerHTML = calHtml(pickYM, d => `<button class="cal-d${pickSel.has(d) ? ' picked' : ''}" onclick="pickToggle('${d}')">
      <span>${+d.slice(8)}</span><div class="dots">${shiftDots(gia.filter(s => s.date === d))}</div></button>`);
  $('#pick-add').textContent = t('aggiungi_n_turni', { n: pickSel.size });
  $('#pick-add').disabled = !pickSel.size;
}
async function addShifts() {
  const body = { employee_id: +$('#sh-emp').value, dates: [...pickSel].sort(),
    start: $('#sh-start').value, end: $('#sh-end').value, role: $('#sh-role').value };
  if (!body.employee_id || !body.dates.length) return alert('Servono dipendente e almeno un giorno');
  try {
    const r = await api('/shifts/bulk', 'POST', body);
    if (r.skipped) alert(t('turni_saltati', { n: r.skipped }));
    pickSel.clear(); refreshTurni();
  } catch (e) { alert(e.message); }
}

/* --- task: spuntata = sparisce dalla lista e va nello storico, firmata --- */
async function loadTasks() {
  show('#task-new-btn', can('task.manage') || can('task.request'));
  const tasks = await api('/tasks?date=' + todayISO());
  const editable = can('task.check') || can('task.manage');
  const oggi = todayISO();
  $('#tasks-list').innerHTML = tasks.length ? tasks.map(x => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">
      <input type="checkbox" style="width:auto" ${editable ? '' : 'disabled'} onchange="this.checked=false; signTask(${x.id})">
      <span>${x.title}</span>${x.date < oggi ? `<span class="muted">(${new Date(x.date + 'T00:00').toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' })})</span>` : ''}
      <span style="flex:1"></span><span class="muted">${x.assignee || ''}</span>
      ${x.template_id ? '<span class="muted" title="checklist">🔁</span>' : ''}
      ${can('task.manage') ? `<button class="iconbtn" onclick="event.preventDefault();modificaTask(${x.id}, '${String(x.title).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="${t('modifica')}">✏️</button>
        <button class="iconbtn" onclick="event.preventDefault();eliminaTask(${x.id}, '${String(x.title).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="${t('elimina')}">🗑</button>` : ''}
    </label>`).join('') : `<p class="muted">${t('nessuna_task')}</p>`;
  caricaChecklist();
  if (currentView === 'turni') loadCal();
}
// i profili sono per ruolo (piu' persone usano lo stesso): la firma e' il nome di chi l'ha fatta
async function signTask(id) {
  const oggi = todayISO();
  const [emps, turni] = await Promise.all([api('/employees'), api(`/shifts?from=${oggi}&to=${oggi}`)]);
  if (!emps.length) return doneTask(id, null);
  const inTurno = new Set(turni.map(s => s.employee_id));
  const btn = (e) => `<button class="ghost who" onclick="doneTask(${id}, ${e.id})"><i class="dot" style="background:${e.color || '#888'}"></i>${e.name}</button>`;
  const primi = emps.filter(e => inTurno.has(e.id)), altri = emps.filter(e => !inTurno.has(e.id));
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>${t('chi_ha_fatto')}</h3>
        ${primi.length ? `<label>${t('in_turno_oggi')}</label><div class="who-grid">${primi.map(btn).join('')}</div>` : ''}
        ${altri.length ? `<label style="margin-top:10px">${primi.length ? t('altri_dip') : t('dipendente')}</label><div class="who-grid">${altri.map(btn).join('')}</div>` : ''}
        <div class="onb-actions" style="margin-top:14px"><button class="ghost" onclick="closeModal()">${t('annulla')}</button></div>
      </div>
    </div>`;
}
async function doneTask(id, empId) {
  try {
    await api('/tasks/' + id, 'PUT', { done: true, employee_id: empId });
    closeModal(); loadTasks();
    if (!$('#task-history').classList.contains('hidden')) loadTaskHistory();
  } catch (e) { alert(e.message); }
}
function toggleTaskHistory() {
  const box = $('#task-history');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) loadTaskHistory();
}
async function loadTaskHistory() {
  const d = new Date(); d.setDate(d.getDate() - 30);
  const rows = await api('/tasks/history?from=' + isoLocal(d));
  const undo = can('task.manage');
  $('#task-history').innerHTML = `<h3 style="margin-top:14px">${t('storico_task')}</h3>` + (rows.length ? `<table>` + rows.map(x => `
    <tr><td>${x.title}</td>
      <td><i class="dot" style="background:${x.color || '#888'}"></i>${x.done_by_name || '—'}
        <div class="muted" style="font-size:11px">${t('spuntata_da', { p: x.done_profile || '?' })}</div></td>
      <td class="muted">${new Date(x.done_at).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      ${undo ? `<td class="right"><button class="iconbtn" onclick="undoTask(${x.id})" title="${t('rimetti_da_fare')}">↩</button></td>` : ''}</tr>`).join('') + `</table>`
    : `<p class="muted">${t('nessuno_storico')}</p>`);
}
async function undoTask(id) {
  try { await api('/tasks/' + id, 'PUT', { done: false }); loadTasks(); loadTaskHistory(); } catch (e) { alert(e.message); }
}


/* ===================== FERIE, PERMESSI, CAMBI TURNO =====================
   Due ruoli nella stessa schermata, e ognuno vede solo la sua parte:
   chi chiede compila il periodo e il motivo; chi approva vede anche
   quali turni resterebbero scoperti in quei giorni.                    */
const rqEtichetta = (k) => ({ ferie: '🏖 ' + t('ferie'), permesso: '🕒 ' + t('permesso'), cambio: '↔ ' + t('cambio_turno') })[k] || k;
const rqData = (s) => s ? new Date(s + 'T00:00').toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

async function loadRichieste() {
  const puoChiedere = canProprio('ferie.request'), puoApprovare = can('ferie.approve');
  $('#rq-hello').innerHTML = mascotSays(puoApprovare
    ? t('rq_hello_capo')
    : t('rq_hello_dip'), 48);

  show('#rq-form-card', puoChiedere);
  show('#rq-approve-card', puoApprovare);

  if (puoChiedere) {
    const [emps, profili] = await Promise.all([api('/employees'), api('/profiles')]);
    const mio = (profili.find(p => p.id === PROFILE.id) || {}).employee_id;
    const scelta = mio ? emps.filter(e => e.id === mio) : emps;
    if ($('#rq-emp').options.length !== scelta.length || (mio && +$('#rq-emp').value !== mio))
      $('#rq-emp').innerHTML = scelta.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
    $('#rq-emp').disabled = !!mio;
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
  const puoRitirare = canProprio('ferie.request');
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
  window._manuale = m;
  const ed = !!m.puoModificare;
  $('#man-rules').innerHTML = m.regole.length ? m.regole.map(r => `<li style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span style="flex:1">${esc(r.testo)}</span>${ed ? `<span style="white-space:nowrap"><button class="iconbtn" onclick="modificaRegola(${r.id})" title="${t('modifica')}">✏️</button><button class="iconbtn" onclick="eliminaRegola(${r.id})" title="${t('elimina')}">🗑</button></span>` : ''}</li>`).join('')
    : `<li class="muted" style="list-style:none">${t('man_nessuna_regola')}</li>`;
  show('#man-rules-add', ed); show('#man-recipes-add', ed);
  $('#man-recipes').innerHTML = m.ricettario.length ? m.ricettario.map(c => `
    <div style="border-bottom:1px solid var(--line);padding:8px 0">
      <div class="cal-head"><b>${esc(c.nome)}</b>${ed ? `<span><button class="iconbtn" onclick="modificaRicetta(${c.id})" title="${t('modifica')}">✏️</button><button class="iconbtn" onclick="eliminaRicetta(${c.id})" title="${t('elimina')}">🗑</button></span>` : ''}</div>
      ${c.ingredienti ? `<div class="muted" style="margin:4px 0;white-space:pre-line">${esc(c.ingredienti)}</div>` : ''}
      ${c.preparazione ? `<div style="font-size:13px;white-space:pre-line">${esc(c.preparazione)}</div>` : ''}
    </div>`).join('') : `<p class="muted">${t('man_nessuna_ricetta')}</p>`;
}
function modaleManuale(titolo, campi, salva) {
  window._salvaManuale = salva;
  $('#modal-root').innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal"><h3>${titolo}</h3>${campi}
    <div class="onb-actions" style="margin-top:14px"><button class="ghost" onclick="closeModal()">${t('annulla')}</button><button class="act" onclick="_salvaManuale()">${t('salva')}</button></div></div></div>`;
  setTimeout(() => { const e = $('#mm-1'); e && e.focus(); }, 50);
}
const regolaPerId = (id) => (window._manuale.regole || []).find(r => r.id === id) || {};
const ricettaPerId = (id) => (window._manuale.ricettario || []).find(r => r.id === id) || {};
function campiRegola(v = '') { return `<label>${t('man_regola')}</label><textarea id="mm-1" rows="3" maxlength="300" style="width:100%">${esc(v)}</textarea>`; }
function nuovaRegola() { modaleManuale(t('man_nuova_regola'), campiRegola(), async () => { const v = $('#mm-1').value.trim(); if (!v) return $('#mm-1').focus();
  try { await api('/manuale/regole', 'POST', { testo: v }); closeModal(); loadManuale(); } catch (e) { alert(e.message); } }); }
function modificaRegola(id) { modaleManuale(t('modifica'), campiRegola(regolaPerId(id).testo), async () => { const v = $('#mm-1').value.trim(); if (!v) return $('#mm-1').focus();
  try { await api('/manuale/regole/' + id, 'PUT', { testo: v }); closeModal(); loadManuale(); } catch (e) { alert(e.message); } }); }
async function eliminaRegola(id) { if (!confirm(t('conferma_elimina', { n: regolaPerId(id).testo }))) return;
  try { await api('/manuale/regole/' + id, 'DELETE'); loadManuale(); } catch (e) { alert(e.message); } }
function campiRicetta(r = {}) { return `<label>${t('nome')}</label><input id="mm-1" maxlength="80" value="${esc(r.nome || '')}" placeholder="es. Negroni">
  <label style="margin-top:8px">${t('ingredienti_man')}</label><textarea id="mm-2" rows="4" maxlength="800" style="width:100%" placeholder="Gin 30ml&#10;Campari 30ml&#10;Vermouth rosso 30ml">${esc(r.ingredienti || '')}</textarea>
  <label style="margin-top:8px">${t('preparazione')}</label><textarea id="mm-3" rows="3" maxlength="1200" style="width:100%" placeholder="${t('ph_preparazione')}">${esc(r.preparazione || '')}</textarea>`; }
const leggiRicetta = () => ({ nome: $('#mm-1').value.trim(), ingredienti: $('#mm-2').value, preparazione: $('#mm-3').value });
function nuovaRicetta() { modaleManuale(t('man_nuova_ricetta'), campiRicetta(), async () => { const b = leggiRicetta(); if (!b.nome) return $('#mm-1').focus();
  try { await api('/manuale/ricette', 'POST', b); closeModal(); loadManuale(); } catch (e) { alert(e.message); } }); }
function modificaRicetta(id) { modaleManuale(t('modifica'), campiRicetta(ricettaPerId(id)), async () => { const b = leggiRicetta(); if (!b.nome) return $('#mm-1').focus();
  try { await api('/manuale/ricette/' + id, 'PUT', b); closeModal(); loadManuale(); } catch (e) { alert(e.message); } }); }
async function eliminaRicetta(id) { if (!confirm(t('conferma_elimina', { n: ricettaPerId(id).nome }))) return;
  try { await api('/manuale/ricette/' + id, 'DELETE'); loadManuale(); } catch (e) { alert(e.message); } }

/* ===================== NOTIFICHE / EXPORT ===================== */
function requestNotify() { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
function notify(title, body) { if ('Notification' in window && Notification.permission === 'granted') new Notification('🍾 ' + title, { body }); }
function downloadCSV(filename, aoa) {
  const csv = aoa.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })); a.download = filename; a.click();
}
function downloadXLSX(filename, aoa, sheet = 'Dati') {
  if (typeof XLSX === 'undefined') return downloadCSV(filename.replace(/\.xlsx$/, '.csv'), aoa);   // libreria Excel non caricata: scarica un CSV
  const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet); XLSX.writeFile(wb, filename);
}
// il calendario del mese che stai guardando, come tabella lunedi-domenica coi nomi
async function scaricaCalendario(tipo) {
  const url = `/shifts/calendar.${tipo}?month=${calYM}`;
  try {
    if (tipo === 'pdf') return await prendiPdf(url, null, `turni-${calYM}.pdf`);
    const r = await fetch('/api' + url, { headers: { Authorization: 'Bearer ' + TOKEN, 'X-Lang': LANG, 'X-Locale': LOCALE, 'X-Locale-Token': CHIAVE } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Errore ' + r.status);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = `turni-${calYM}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { alert(e.message); }
}
async function exportShifts(fmt) {
  const { from, to } = rangeDates();
  const shifts = window._shiftRows || await api(`/shifts?from=${from}&to=${to}`);
  const aoa = [['Data', 'Dipendente', 'Inizio', 'Fine', 'Ruolo']];
  shifts.forEach(s => aoa.push([s.date, s.employee, s.start, s.end, s.role]));
  fmt === 'csv' ? downloadCSV('turni.csv', aoa) : downloadXLSX('turni.xlsx', aoa, 'Turni');
}
/* Un PDF creato dal server: sul telefono si apre "Condividi" (WhatsApp, Mail...)
   cosi' lo si manda subito; dove non c'e', si scarica. */
async function prendiPdf(percorso, corpo, nomeRiserva) {
  const r = await fetch('/api' + percorso, {
    method: corpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + TOKEN, 'X-Lang': LANG, 'X-Locale': LOCALE, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Errore ' + r.status);
  const m = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const nome = m ? m[1] : nomeRiserva;
  const blob = await r.blob();
  const file = new File([blob], nome, { type: 'application/pdf' });
  const telefono = matchMedia('(pointer:coarse)').matches;
  if (telefono && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }   // ha chiuso "Condividi": niente da fare
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// il resoconto del mese in PDF (carico, vuoti, scarico, giacenza): solo il proprietario
async function scaricaResoconto() {
  try { await prendiPdf('/reports/monthly.pdf', null, 'resoconto.pdf'); } catch (e) { alert(e.message); }
}
// l'ordine suggerito di un fornitore, in PDF da mandargli
async function pdfOrdine(i) {
  const g = window._ordini && window._ordini.gruppi[i]; if (!g) return;
  try {
    await prendiPdf('/orders/pdf', { fornitore: g.vendor_id ? g.vendor : '',
      righe: g.righe.map(r => ({ nome: r.name + (r.format ? ' ' + r.format : ''), qta: r.qty + ' ' + (r.unit || '') })) }, 'ordine.pdf');
  } catch (e) { alert(e.message); }
}
/* L'ordine scritto a mano: una riga per prodotto, es. "Aperol 6" o "6 casse acqua".
   Il numero in fondo (o "x 6") diventa la quantita'; senza numero resta solo il nome. */
async function pdfOrdineAMano() {
  const righe = $('#om-righe').value.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^(.*?)[\s,;:x×-]+(\d+[.,]?\d*\s*[^\d\s]{0,12})$/i);
    return m && m[1].trim() ? { nome: m[1].trim(), qta: m[2].trim() } : { nome: x, qta: '' };
  });
  if (!righe.length) return alert(t('om_vuoto'));
  const sel = $('#om-fornitore');
  try {
    await prendiPdf('/orders/pdf', { fornitore: sel.value || $('#om-fornitore-altro').value, righe, note: $('#om-note').value }, 'ordine.pdf');
  } catch (e) { alert(e.message); }
}
async function exportStock(fmt) {
  if (!can('all')) return alert(t('permesso_negato'));
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
  if (!name) return alert(t('serve_nome_prodotto'));
  try {
    await api('/products', 'POST', {
      name, format: $('#np-format').value.trim(),
      stock: $('#np-stock').value, threshold: $('#np-thr').value,
      par_level: $('#np-par').value, unit: $('#np-unit').value.trim() || 'bott.',
      vendor_id: $('#np-vendor').value,
      // chi non ha il permesso non vede i campi e non manda niente:
      // il prodotto nasce a zero e li mette il proprietario dopo
      cost: can('drinkcost.view') ? $('#np-cost').value : 0,
      price: 0,
      volume_ml: can('drinkcost.view') ? $('#np-vol').value : 0,
    });
    ['#np-name', '#np-format', '#np-par', '#np-cost', '#np-vol'].forEach(s => { const e = $(s); if (e) e.value = ''; });
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
    <td><input type="color" class="swatch" value="${e.color || '#888888'}" title="${t('colore')}" onchange="setEmpColor(${e.id}, this.value)">${e.name}</td><td class="muted">${e.role || ''}</td>
    <td class="right">
      <button class="iconbtn" onclick="editEmployee(${e.id})" title="${t('modifica')}">✏️</button>
      <button class="iconbtn" onclick="removeEmployee(${e.id})" title="${t('elimina')}">🗑</button>
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
function setEmpColor(id, color) {
  const e = (window._employees || []).find(x => x.id === id); if (!e) return;
  api('/employees/' + id, 'PUT', { name: e.name, role: e.role || '', color })
    .then(loadTurni).catch(err => alert(err.message));
}
async function removeEmployee(id) {
  const e = (window._employees || []).find(x => x.id === id) || {};
  const name = e.name || "questo dipendente";
  if (!confirm(`Eliminare ${name}?`)) return;
  try { await api('/employees/' + id, 'DELETE'); loadTurni(); }
  catch (e) { alert(e.message); }
}

// il titolare sceglie (o cambia) la password del locale
async function salvaPasswordLocale() {
  try {
    const r = await api('/locale/password', 'POST', { password: $('#pw-locale').value });
    salvaChiave(r.chiave);
    alert(t('pw_locale_fatto')); openSettings();
  } catch (e) { alert(e.message); }
}

/* --- impostazioni: PIN e profili di accesso --- */
async function openSettings() {
  let profili = [], ruoli = [];
  let infoBackup = '';
  try { [profili, ruoli] = await Promise.all([api('/profiles'), api('/ruoli')]); } catch {}
  if (can('all')) infoBackup = await infoCopia();
  const admin = can('all');
  const utenti = can('profili.manage');           // aggiunge utenti e decide cosa possono fare
  if (!admin) ruoli = ruoli.filter(r => r !== 'proprietario');
  try { window._ruoliPermessi = (await api('/ruoli/permessi')).ruoli; } catch { window._ruoliPermessi = {}; }
  const intoccabile = (p) => p.permissions.includes('all') && !admin;   // il profilo del proprietario

  $('#modal-root').innerHTML = `
    <div class="overlay" data-modale="impostazioni" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:440px">
        <h3>${t('impostazioni')}</h3>

        <h3 style="margin-top:14px">${t('tuo_pin')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:8px">${t("sei_entrato", { nome: "<b>" + nomeProfilo(PROFILE.name) + "</b>" })}</p>
        <div class="row c2">
          <div><label>${t('pin_attuale')}</label><input id="pin-old" class="campo-pin" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" data-lpignore="true" data-1p-ignore placeholder="••••"></div>
          <div><label>${t('pin_nuovo')}</label><input id="pin-new" class="campo-pin" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" data-lpignore="true" data-1p-ignore placeholder="••••"></div>
        </div>
        <button class="act" onclick="changeOwnPin()">${t('cambia_mio_pin')}</button>

        ${utenti ? `
        <h3 style="margin-top:20px">${t('profili_accesso')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('utenti_aiuto')}</p>
        <table><thead><tr><th>${t('nome')}</th><th>${t('accesso')}</th><th></th></tr></thead><tbody>
          ${profili.map(p => `<tr>
            <td>${nomeProfilo(p.name)}</td>
            <td class="muted">${p.permissions.includes('all') ? t('completo') : t('permessi_n', { n: p.permissions.length })}</td>
            <td class="right">${intoccabile(p) ? '' : `
              <button class="iconbtn" onclick="modificaProfilo(${p.id})" title="${t('modifica')}">✏️</button>
              <button class="iconbtn" onclick="resetPin(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="${t('reimposta_pin')}">🔑</button>`}
              ${p.id !== PROFILE.id && !intoccabile(p) ? `<button class="iconbtn" onclick="deleteProfile(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="${t('elimina')}">🗑</button>` : ''}
            </td></tr>`).join('')}
        </tbody></table>

        <h3 style="margin-top:16px">${t('nuovo_profilo')}</h3>
        <div class="row c2">
          <div><label>${t('nome')}</label><input id="npf-name" placeholder="${t('ph_profilo')}"></div>
          <div><label>${t('ruolo')}</label><select id="npf-role" onchange="spuntaRuolo('npf', this.value)">
            ${ruoli.map(r => `<option value="${r}" ${r === 'bartender' ? 'selected' : ''}>${nomeRuolo(r)}</option>`).join('')}
          </select></div>
        </div>
        <div class="row"><div><label>${t('pin_4_cifre')}</label><input id="npf-pin" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" data-lpignore="true" placeholder="${t('ph_pin')}"></div></div>
        <label style="margin-top:10px">${t('cosa_puo_fare')}</label>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('cosa_puo_fare_aiuto')}</p>
        ${caselleCapacita('npf', (window._ruoliPermessi.bartender || []))}
        <button class="act" style="margin-top:10px" onclick="addProfile()">${t('crea_profilo')}</button>
        ` : ''}

        ${admin ? `

        <h3 style="margin-top:20px">${t('pw_locale')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('pw_locale_aiuto')}</p>
        ${LOCALE !== 'demo' && !CHIAVE ? `<p style="font-size:12px;margin-bottom:6px;color:var(--red)">⚠ ${t('pw_locale_manca')}</p>` : ''}
        <div class="row"><div><input id="pw-locale" type="text" autocomplete="off" autocapitalize="none" maxlength="72" placeholder="${t('locale_pw_nuova_ph')}"></div></div>
        <button class="act" onclick="salvaPasswordLocale()">${t('pw_locale_salva')}</button>

        <h3 style="margin-top:20px">${t('link_staff')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('link_staff_aiuto')}</p>
        <p style="font-size:13px;word-break:break-all"><b>${linkStaff()}</b><br><span class="muted">${t('codice_locale')}: <b>${LOCALE}</b></span></p>
        <button class="ghost" onclick="copiaLinkStaff()">📋 ${t('copia_link')}</button>

        <h3 style="margin-top:20px">${t('locale_nome')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('locale_nome_aiuto')}</p>
        <div class="row"><div><input id="imp-locale" value="${(LOCALE_NOME || '').replace(/"/g, '&quot;')}" placeholder="${t('ph_locale')}"></div></div>
        <button class="act" onclick="salvaNomeLocale()">${t('salva')}</button>

        <h3 style="margin-top:20px">${t('copia_sicurezza')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:6px">${t('copia_aiuto')}</p>
        <p class="muted" style="font-size:11px;margin-bottom:8px">${infoBackup}</p>
        <button class="act gold" onclick="scaricaCopia()">${t('scarica_copia')}</button>

        ` : ''}

        <h3 style="margin-top:22px">${t('inst_titolo')}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:8px">${t('inst_aiuto')}</p>
        <div id="inst-zona">${bloccoInstalla()}</div>

        ${admin ? `
        <!-- Lo svuotamento va per ULTIMO: e' l'unica cosa irreversibile
             qui dentro, e non deve stare sulla strada di chi scorre
             cercando altro. -->
        <h3 style="margin-top:22px;color:var(--red)">${t("ricomincia")}</h3>
        <p class="muted" style="font-size:12px;margin-bottom:8px">${t("ricomincia_aiuto")}</p>
        <button class="danger" onclick="svuotaTutto()">${t("svuota_tutto")}</button>
        ` : ''}

        <div class="onb-actions" style="margin-top:20px">
          <button class="ghost" onclick="closeModal()">${t('chiudi')}</button>
        </div>
      </div>
    </div>`;
}

/* ---------------- INSTALLARE L'APP ----------------
   Il tasto "Installa" dei browser e' sepolto nei menu e non lo trova
   nessuno, quindi ce lo mettiamo noi dove si vede.
   Tre casi, perche' si comportano in modo diverso:
   - Chrome/Edge: il browser ci passa l'invito e lo lanciamo noi;
   - iPhone/iPad: NON esiste nessun invito, si fa solo a mano da Safari,
     e in Chrome su iOS la voce non c'e' proprio: va detto;
   - gia' installata: non proponiamo niente.                        */
let invitoInstalla = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // sennò Chrome mostra il suo, quando vuole lui
  invitoInstalla = e;
  aggiornaZonaInstalla();
  mostraStrisciaInstalla();
});
window.addEventListener('appinstalled', () => {
  invitoInstalla = null;
  nascondiStrisciaInstalla();
  aggiornaZonaInstalla();
});

/* dichiarate come funzioni e non come const: cosi' sono gia' definite
   quando bloccoInstalla() viene chiamata, da qualunque punto arrivi */
function giaInstallata() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function suIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/* Su iPhone non basta sapere che sei su iPhone: solo Safari VERO puo'
   aggiungere alla schermata Home, e i casi in cui non puoi sono due,
   con rimedi diversi.
   Come si riconoscono: Chrome su iOS si firma CriOS (Firefox FxiOS,
   Edge EdgiOS); il browser interno di WhatsApp o Instagram e' una
   WKWebView e nella sua firma "Safari" non compare affatto.          */
function situazioneIOS() {
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS/.test(ua)) return 'altroBrowser';
  if (!/Safari/.test(ua)) return 'dentroUnApp';
  return 'safari';
}

function bloccoInstalla() {
  if (giaInstallata())
    return `<p style="font-size:13px;color:var(--green)">${t('inst_gia')}</p>`;

  if (invitoInstalla)
    return `<button class="act" onclick="chiediInstalla()">${t('inst_fai')}</button>`;

  if (suIOS()) {
    const caso = situazioneIOS();

    /* aperto dal browser dentro WhatsApp/Instagram: qui "Aggiungi a
       Home" non esiste, e il cliente pensa che sia rotta la nostra app */
    if (caso === 'dentroUnApp')
      return `<div style="font-size:13px;line-height:1.8">
        <b style="color:var(--yellow)">${t('inst_ios_dentro_t')}</b>
        <p class="muted" style="font-size:12.5px;margin:6px 0">${t('inst_ios_dentro')}</p>
        <ol style="padding-left:18px;margin:6px 0">
          <li>${t('inst_ios_dentro_1')}</li><li>${t('inst_ios_dentro_2')}</li><li>${t('inst_ios_dentro_3')}</li>
        </ol>
      </div>`;

    /* Chrome/Firefox/Edge su iPhone: la voce non esiste e basta */
    if (caso === 'altroBrowser')
      return `<div style="font-size:13px;line-height:1.8">
        <b style="color:var(--yellow)">${t('inst_ios_chrome_t')}</b>
        <p class="muted" style="font-size:12.5px;margin:6px 0">${t('inst_ios_chrome')}</p>
        <button class="act" onclick="copiaIndirizzo(this)">${t('inst_copia')}</button>
      </div>`;

    return `<div style="font-size:13px;line-height:1.9">
      <b>${t('inst_ios_t')}</b>
      <ol style="padding-left:18px;margin:6px 0">
        <li>${t('inst_ios_1')}</li><li>${t('inst_ios_2')}</li><li>${t('inst_ios_3')}</li>
      </ol>
    </div>`;
  }

  return `<p class="muted" style="font-size:12.5px">${t('inst_manuale')}</p>`;
}

/* Copiare a mano un indirizzo lungo su un telefono e' una tortura, e
   chi sbaglia una lettera pensa che l'app non esista. */
async function copiaIndirizzo(bottone) {
  const indirizzo = location.origin + location.pathname;
  try {
    await navigator.clipboard.writeText(indirizzo);
  } catch {
    // su iOS senza permessi il moderno fallisce: si torna al vecchio.
    // Attenzione a non chiamarla "t": quella e' la funzione delle traduzioni.
    const casella = document.createElement('textarea');
    casella.value = indirizzo;
    casella.style.position = 'fixed'; casella.style.opacity = '0';
    document.body.appendChild(casella); casella.select();
    try { document.execCommand('copy'); } catch {}
    casella.remove();
  }
  if (bottone) { bottone.textContent = t('inst_copiato'); bottone.disabled = true; }
}

function aggiornaZonaInstalla() {
  const z = document.getElementById('inst-zona');
  if (z) z.innerHTML = bloccoInstalla();
}

async function chiediInstalla() {
  if (!invitoInstalla) return;
  invitoInstalla.prompt();
  try { await invitoInstalla.userChoice; } catch {}
  invitoInstalla = null;      // l'invito si puo' usare una volta sola
  nascondiStrisciaInstalla();
  aggiornaZonaInstalla();
}

/* La striscia in basso: si vede una volta, e se la chiudi non torna. */
function mostraStrisciaInstalla() {
  if (giaInstallata() || !invitoInstalla) return;
  try { if (localStorage.getItem('bb_inst_no')) return; } catch {}
  if (document.getElementById('inst-striscia')) return;
  /* Mai sopra una finestra aperta: l'avviso dei PIN di fabbrica conta
     di piu' di questo invito, e due cose che chiedono attenzione
     insieme non le legge nessuna delle due. Riproviamo alla chiusura. */
  if (document.querySelector('#modal-root .overlay')) return;
  const d = document.createElement('div');
  d.id = 'inst-striscia';
  d.innerHTML = `<span>${t('inst_banner')}</span>
    <button class="act" onclick="chiediInstalla()">${t('inst_fai')}</button>
    <button class="ghost" onclick="rifiutaInstalla()">${t('salta')}</button>`;
  document.body.appendChild(d);
}
function nascondiStrisciaInstalla() {
  const d = document.getElementById('inst-striscia');
  if (d) d.remove();
}
function rifiutaInstalla() {
  try { localStorage.setItem('bb_inst_no', '1'); } catch {}
  nascondiStrisciaInstalla();
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
  const attuale = $('#pin-old').value.replace(/\D/g, ''), nuovo = $('#pin-new').value.replace(/\D/g, '');
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
    const permissions = capacitaSpuntate('npf');
    await api('/profiles', 'POST', { name, ruolo: $('#npf-role').value, pin, ...(permissions.includes('all') ? {} : { permissions }) });
    alert(`Profilo "${name}" creato.`);
    openSettings();
  } catch (e) { alert(e.message); }
}
/* ---- COSA PUO' FARE UN UTENTE: le caselle da spuntare ----
   Stesse voci per "nuovo profilo" e "modifica profilo". Il ruolo e' solo un
   punto di partenza: spunta le sue voci, poi si aggiunge o si toglie.     */
const GRUPPI_CAPACITA = [
  ['cg_turni', ['turni.view', 'turni.manage']],
  ['cg_task', ['task.view', 'task.check', 'task.request', 'task.manage']],
  ['cg_ferie', ['ferie.view', 'ferie.request', 'ferie.approve']],
  ['cg_vuoti', ['vuoti.view', 'vuoti.do']],
  ['cg_magazzino', ['magazzino.view', 'carico.do', 'etichette.new', 'drinkcost.view']],
  ['cg_inventario', ['inventario.view', 'inventario.do', 'inventario.close']],
  ['cg_altro', ['manuale.view', 'manuale.edit', 'profili.manage']],
];
const chiaveCapacita = (c) => 'cap_' + c.replace('.', '_');
function caselleCapacita(pre, attive) {
  if (attive.includes('all')) return `<p class="muted" style="font-size:12px">${t('completo')}</p><input type="hidden" id="${pre}-tutto" value="1">`;
  return `<div class="capacita">` + GRUPPI_CAPACITA.map(([g, voci]) => `
    <div class="cap-gruppo"><div class="cap-titolo">${t(g)}</div>
      ${voci.map(c => `<label class="cap"><input type="checkbox" data-cap="${pre}" value="${c}" ${attive.includes(c) ? 'checked' : ''}> <span>${t(chiaveCapacita(c))}</span></label>`).join('')}
    </div>`).join('') + `</div>`;
}
function capacitaSpuntate(pre) {
  if ($('#' + pre + '-tutto')) return ['all'];
  return [...document.querySelectorAll(`input[data-cap="${pre}"]:checked`)].map(i => i.value);
}
// scelto un ruolo, si spuntano le sue voci (poi si puo' cambiare a mano)
function spuntaRuolo(pre, ruolo) {
  const voci = (window._ruoliPermessi || {})[ruolo]; if (!voci) return;
  const tutto = voci.includes('all');
  document.querySelectorAll(`input[data-cap="${pre}"]`).forEach(i => { i.checked = tutto || voci.includes(i.value); i.disabled = tutto; });
}
async function deleteProfile(id, nome) {
  if (!confirm(`Eliminare il profilo "${nome}"?\nChi lo usava non potrà più entrare.`)) return;
  try { await api('/profiles/' + id, 'DELETE'); openSettings(); }
  catch (e) { alert(e.message); }
}


/* ===================== PRONTA PER LA VENDITA =====================
   Tre cose che servono a chi compra l'app, non a chi la sviluppa:
   il nome del proprio locale, una copia di sicurezza dei dati, e
   l'insistenza finche' i PIN di fabbrica non vengono cambiati.   */

let LOCALE_NOME = '';

async function caricaImpostazioni() {
  try {
    const i = await api('/impostazioni');
    LOCALE_NOME = i.locale_nome || '';
    mostraNomeLocale();
  } catch {}
}
function mostraNomeLocale() {
  const h = document.querySelector('.banner h1');
  if (h) h.textContent = LOCALE_NOME || t('app_nome');
  document.title = (LOCALE_NOME ? LOCALE_NOME + ' · ' : '') + 'Barback';
}
async function salvaNomeLocale() {
  const nome = $('#imp-locale').value.trim();
  try {
    await api('/impostazioni', 'PUT', { locale_nome: nome });
    LOCALE_NOME = nome; mostraNomeLocale();
    alert(t('salva') + ' ✓');
  } catch (e) { alert(e.message); }
}

/* --- copia di sicurezza: scarica il database intero --- */
async function scaricaCopia() {
  try {
    const r = await fetch('/api/backup', { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Errore ' + r.status);
    const blob = await r.blob();
    const nome = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome ? nome[1] : 'barback-dati.db';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { alert(e.message); }
}
async function infoCopia() {
  try {
    const i = await api('/backup/info');
    if (!i.esiste) return '';
    const righe = Object.values(i.righe).reduce((s, n) => s + n, 0);
    const peso = i.byte > 1048576 ? (i.byte / 1048576).toFixed(1) + ' MB' : Math.round(i.byte / 1024) + ' KB';
    const quando = new Date(i.modificato).toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return t('copia_info', { righe, peso, quando });
  } catch { return ''; }
}

/* --- i PIN di fabbrica: si insiste, perche' e' il buco piu' grosso --- */
/* Il locale non ha ancora la password (creato prima): il proprietario la
   sceglie adesso. Senza, chiunque conosca il nome del locale vede i profili. */
async function controllaAccesso() {
  if (can('all') && LOCALE !== 'demo' && !CHIAVE) {
    let info = null; try { info = await api('/locale/' + encodeURIComponent(LOCALE)); } catch {}
    if (info && !info.protetto) return chiediPasswordLocale();
  }
  if (can('all') && LOCALE !== 'demo') {
    let r = null; try { r = await api('/titolare/recupero'); } catch {}
    if (r && !r.ha) return chiediRecupero();
  }
  controllaPinFabbrica();
}
/* Il codice di recupero: lo vede una volta sola, deve scriverlo. Serve se scorda il PIN e l'email non arriva. */
function chiediRecupero(nuovo) {
  $('#modal-root').innerHTML = `
    <div class="overlay"><div class="modal">
      <h3>🔑 ${t('rec_tit')}</h3>
      <p class="muted" style="font-size:14px;line-height:1.6;margin:8px 0 12px">${t('rec_txt')}</p>
      <div id="rec-box"></div>
      <button class="act" id="rec-btn" style="width:100%;padding:14px;font-size:17px" onclick="creaRecupero()">${t('rec_crea')}</button>
    </div></div>`;
}
async function creaRecupero() {
  try {
    const r = await api('/titolare/recupero', 'POST');
    $('#rec-box').innerHTML = `<div style="font-size:30px;font-weight:800;letter-spacing:3px;text-align:center;padding:14px;border:2px dashed var(--line);border-radius:12px;margin-bottom:12px">${r.codice}</div>
      <p class="muted" style="font-size:13px;margin-bottom:12px">${t('rec_scrivi')}</p>`;
    const b = $('#rec-btn'); b.textContent = t('rec_salvato'); b.onclick = () => { closeModal(); controllaPinFabbrica(); };
  } catch (e) { alert(e.message); }
}
function chiediPasswordLocale() {
  $('#modal-root').innerHTML = `
    <div class="overlay"><div class="modal">
      <h3>🔒 ${t('pw_obbl_tit')}</h3>
      <p class="muted" style="font-size:14px;line-height:1.6;margin:8px 0 12px">${t('pw_obbl_txt', { nome: LOCALE })}</p>
      <input id="pw-obbl" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="72" placeholder="${t('locale_pw_nuova_ph')}" style="font-size:18px;width:100%">
      <button class="act" style="width:100%;margin-top:12px;padding:14px;font-size:17px" onclick="salvaPasswordObbl()">${t('pw_locale_salva')}</button>
    </div></div>`;
  setTimeout(() => $('#pw-obbl').focus(), 50);
}
async function salvaPasswordObbl() {
  try {
    const pw = $('#pw-obbl').value;
    const r = await api('/locale/password', 'POST', { password: pw });
    salvaChiave(r.chiave); closeModal();
    alert(t('pw_obbl_fatto', { nome: LOCALE, pw }));
    controllaPinFabbrica();
  } catch (e) { alert(e.message); }
}
async function controllaPinFabbrica() {
  let profili = [];
  try { profili = await api('/profiles'); } catch { return; }
  const quanti = profili.filter(p => p.pin_default).length;
  if (!quanti) return;
  const mio = profili.find(p => p.id === PROFILE.id);
  $('#modal-root').innerHTML = `
    <div class="overlay">
      <div class="modal">
        <h3 style="color:var(--red)">${t('pin_fabbrica_tit')}</h3>
        <p class="muted" style="font-size:13px;line-height:1.7;margin:8px 0 16px">${t('pin_fabbrica_txt', { quanti })}</p>
        <div class="onb-actions">
          <button class="ghost" onclick="closeModal()">${t('pin_fabbrica_dopo')}</button>
          <button class="act" onclick="closeModal(); openSettings();">${mio && mio.pin_default ? t('pin_fabbrica_ora') : t('impostazioni')}</button>
        </div>
      </div>
    </div>`;
}
/* ===================== LINGUA =====================
   applicaLingua() riscrive il testo statico; ricaricaVista() ridisegna
   la schermata aperta, cosi' cambiano anche i testi generati dal codice.
   La lingua viaggia anche verso il server, che traduce i suoi messaggi. */
function ricaricaVista() {
  buildBottomNav();
  const loaders = { home: loadHome, vuoti: loadVuoti, turni: loadTurni,
    magazzino: loadMagazzino, inventario: loadInventario, ordini: loadOrdini,
    richieste: loadRichieste, manuale: loadManuale, costi: loadCosti };
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
  /* SOLO il bottone del tema. Prima qui c'era querySelectorAll('.themebtn'),
     ma quella classe e' lo stile del bottone tondo e ce l'hanno anche la
     lingua e l'ingranaggio: il risultato era che dopo un cambio di tema
     comparivano due lune identiche e l'ingranaggio spariva. */
  const b = document.getElementById('btn-tema');
  if (b) {
    b.textContent = t === 'light' ? '☀' : '🌙';
    b.title = t === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro';
  }
}
function toggleTheme() {
  const nuovo = temaCorrente() === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('bb_theme', nuovo); } catch {}
  applyTheme(nuovo);
}
applyTheme(temaCorrente());
applicaLingua();

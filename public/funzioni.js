/* =====================================================================
   funzioni.js — Le funzioni aggiunte dopo la prova dei tre mesi:
   - Drink cost e ricette (la schermata che mancava)
   - I miei ultimi vuoti e il tasto Annulla
   - Storico movimenti e registro degli annullati (titolare)
   - Turni modificabili
   - Checklist che si ripetono ogni giorno
   - Profili legati alle persone, nome e ruolo modificabili
   Si carica dopo app.js e ne usa le funzioni (api, t, can, $...).
   ===================================================================== */

/* La giornata di lavoro: come sul server, cambia alle 6 del mattino.
   Alle 01:30 si e' ancora nella serata di ieri.                      */
function giornata(d = new Date()) {
  const x = new Date(d.getTime() - 6 * 3600000);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = (n) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString(locale(), { style: 'currency', currency: 'EUR' });
const dataBreve = (s) => s ? new Date(s.length === 10 ? s + 'T00:00' : s).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' }) : '';
const oraBreve = (s) => s ? new Date(s).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '';
const tipoMov = (k) => ({ carico: '📥 ' + t('mv_carico'), vuoto: '🍾 ' + t('mv_vuoto'), scarico: '📤 ' + t('mv_scarico'), rettifica: '📋 ' + t('mv_rettifica') })[k] || k;

/* ===================== DRINK COST E RICETTE ===================== */
async function loadCosti() {
  const box = $('#costi-box');
  if (!can('drinkcost.view')) { box.innerHTML = `<div class="card"><p class="muted">${t('permesso_negato')}</p></div>`; return; }
  let d;
  try { d = await api('/foodcost'); } catch (e) { box.innerHTML = `<div class="card"><p>⚠ ${esc(e.message)}</p></div>`; return; }
  window._foodcost = d;
  const pc = (v) => v == null ? '<span class="muted">—</span>'
    : `<b style="color:${v <= 22 ? 'var(--green)' : v <= 30 ? 'var(--gold)' : 'var(--red)'}">${v}%</b>`;
  const tot = d.totali;
  box.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="v">${euro(tot.valoreMagazzino)}</div><div class="l">${t('valore_magazzino')}</div></div>
      <div class="kpi"><div class="v">${tot.pourCostMedio == null ? '—' : tot.pourCostMedio + '%'}</div><div class="l">${t('pour_cost_medio')}</div></div>
      <div class="kpi"><div class="v" style="color:${d.ultimoScostamento && d.ultimoScostamento.valore < 0 ? 'var(--red)' : 'inherit'}">${d.ultimoScostamento ? euro(d.ultimoScostamento.valore) : '—'}</div><div class="l">${t('ultimo_scostamento')}</div></div>
    </div>
    ${tot.daCompletare ? `<div class="card rq-warn">⚠ ${t('bottiglie_senza_costo', { n: tot.daCompletare })}
      <div style="margin-top:6px">${d.bottiglie.filter(b => b.incompleto).map(b => `<span class="chip" style="cursor:pointer" onclick="go('magazzino');setTimeout(()=>editProduct(${b.id}),400)">${esc(b.nome)}</span>`).join(' ')}</div></div>` : ''}
    <div class="card">
      <div class="cal-head"><h3>${t('cocktail_ricette')}</h3><button class="act" onclick="editCocktail()">+ ${t('nuovo_cocktail')}</button></div>
      <p class="muted" style="font-size:12px;margin:4px 0 8px">${t('pour_cost_aiuto')}</p>
      <div class="grid-scroll"><table class="wide"><thead><tr>
        <th>${t('cocktail')}</th><th class="right">${t('prezzo')}</th><th class="right">${t('costo')}</th>
        <th class="right">${t('pour_cost')}</th><th class="right">${t('margine')}</th><th class="right">${t('prezzo_suggerito')}</th><th></th></tr></thead><tbody>
        ${d.cocktails.map(c => `<tr>
          <td><b>${esc(c.nome)}</b><div class="muted" style="font-size:11px">${c.ricetta.map(r => `${esc(r.nome)} ${r.q} ml`).join(' · ') || t('ricetta_vuota')}</div></td>
          <td class="right">${euro(c.prezzo)}</td><td class="right">${euro(c.costo)}</td><td class="right">${pc(c.pourCost)}</td>
          <td class="right">${euro(c.margine)}</td><td class="right muted">${c.prezzoSuggerito ? euro(c.prezzoSuggerito) : '—'}</td>
          <td class="right" style="white-space:nowrap"><button class="iconbtn" onclick="editCocktail(${c.id})" title="${t('modifica')}">✏️</button>
            <button class="iconbtn" onclick="removeCocktail(${c.id}, '${esc(c.nome).replace(/'/g, "\\'")}')" title="${t('elimina')}">🗑</button></td></tr>`).join('')
          || `<tr><td colspan="7" class="muted">${t('nessun_cocktail')}</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="card">
      <h3>${t('costo_al_ml')}</h3>
      <div class="grid-scroll"><table class="wide"><thead><tr><th>${t('prodotto')}</th><th class="right">${t('costo')}</th><th class="right">ml</th>
        <th class="right">${t('costo_ml')}</th><th class="right">${t('giacenza')}</th><th class="right">${t('valore')}</th></tr></thead><tbody>
        ${d.bottiglie.map(b => `<tr><td>${esc(b.nome)} <span class="muted">${esc(b.formato || '')}</span></td>
          <td class="right">${euro(b.costo)}</td><td class="right">${b.volume_ml || '—'}</td>
          <td class="right">${b.costoMl == null ? '—' : euro(b.costoMl * 10).replace(/\s/g, ' ') + '/cl'}</td>
          <td class="right">${b.giacenza}</td><td class="right">${euro(b.valore)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
}

let _ricetta = [];
async function editCocktail(id) {
  const prodotti = await api('/products');
  window._products = prodotti;
  const bottiglie = prodotti.filter(p => p.category === 'Bottiglia');
  const c = id ? prodotti.find(p => p.id === id) : null;
  _ricetta = c ? c.recipe.map(r => ({ ing: r.ing, q: r.q })) : [{ ing: bottiglie[0] ? bottiglie[0].id : 0, q: 40 }];
  window._bottiglie = bottiglie;
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:460px">
        <h3>${c ? t('modifica') + ': ' + esc(c.name) : t('nuovo_cocktail')}</h3>
        <div class="row c2">
          <div><label>${t('nome')}</label><input id="ck-name" value="${c ? esc(c.name) : ''}" placeholder="${t('ph_cocktail')}"></div>
          <div><label>${t('prezzo_vendita')}</label><input id="ck-price" type="number" min="0" step="0.5" value="${c ? c.price : ''}" placeholder="9.00"></div>
        </div>
        <label style="margin-top:8px">${t('ingredienti')}</label>
        <div id="ck-righe"></div>
        <button class="ghost" style="margin-top:6px" onclick="ckAggiungi()">+ ${t('ingrediente')}</button>
        <div id="ck-costo" class="muted" style="margin-top:10px;font-size:13px"></div>
        <div class="onb-actions">
          <button class="ghost" onclick="closeModal()">${t('annulla')}</button>
          <button class="act" onclick="saveCocktail(${id || 0})">${t('salva')}</button>
        </div>
      </div>
    </div>`;
  ckDisegna();
}
function ckDisegna() {
  const b = window._bottiglie || [];
  $('#ck-righe').innerHTML = _ricetta.map((r, i) => `
    <div class="row" style="display:grid;grid-template-columns:1fr 80px 36px;gap:6px;align-items:end;margin-bottom:6px">
      <select onchange="_ricetta[${i}].ing=+this.value;ckCosto()">${b.map(p => `<option value="${p.id}" ${p.id === r.ing ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <input type="number" min="1" step="5" value="${r.q}" oninput="_ricetta[${i}].q=+this.value;ckCosto()" title="ml">
      <button class="iconbtn" onclick="_ricetta.splice(${i},1);ckDisegna()" title="${t('elimina')}">✕</button>
    </div>`).join('') || `<p class="muted">${t('ricetta_vuota')}</p>`;
  ckCosto();
}
function ckAggiungi() { const b = window._bottiglie || []; _ricetta.push({ ing: b[0] ? b[0].id : 0, q: 30 }); ckDisegna(); }
function ckCosto() {
  const pr = window._products || [];
  const costo = _ricetta.reduce((s, r) => { const p = pr.find(x => x.id === r.ing); return s + (p && p.volume_ml ? p.cost / p.volume_ml * (r.q || 0) : 0); }, 0);
  const prezzo = +($('#ck-price') && $('#ck-price').value) || 0;
  $('#ck-costo').innerHTML = `${t('costo')}: <b>${euro(costo)}</b>` + (prezzo ? ` · ${t('pour_cost')}: <b>${Math.round(costo / prezzo * 100)}%</b> · ${t('margine')}: <b>${euro(prezzo - costo)}</b>` : '');
}
async function saveCocktail(id) {
  const name = $('#ck-name').value.trim();
  if (!name) return alert(t('serve_nome'));
  const corpo = { name, price: +$('#ck-price').value || 0, recipe: _ricetta.filter(r => r.ing && r.q > 0) };
  try {
    if (id) await api('/products/' + id, 'PUT', corpo);
    else await api('/products', 'POST', { ...corpo, category: 'Cocktail' });
    closeModal(); loadCosti();
  } catch (e) { alert(e.message); }
}
async function removeCocktail(id, nome) {
  if (!confirm(t('conferma_elimina', { n: nome }))) return;
  try { await api('/products/' + id, 'DELETE'); loadCosti(); } catch (e) { alert(e.message); }
}

/* ===================== I MIEI ULTIMI VUOTI + ANNULLA ===================== */
async function caricaMieiVuoti() {
  const box = $('#miei-vuoti'); if (!box) return;
  if (!can('vuoti.do')) { box.innerHTML = ''; return; }
  const oggi = giornata();
  let righe = [];
  try { righe = await api(`/movements?from=${oggi}&to=${oggi}`); } catch { }
  // il titolare vede tutti: qui pero' mostriamo solo i vuoti della serata
  righe = righe.filter(m => m.type === 'vuoto' || m.type === 'scarico').slice(0, 30);
  box.innerHTML = `<div class="card">
    <h3>${can('magazzino.view') ? t('ultimi_vuoti') : t('tuoi_vuoti')}</h3>
    <p class="muted" style="font-size:12px;margin:2px 0 8px">${t('ultimi_vuoti_aiuto')}</p>
    ${righe.length ? `<table>${righe.map(m => `<tr>
      <td>${esc(m.product)}</td><td>${m.qty}</td>
      <td class="muted" style="font-size:12px">${oraBreve(m.created_at)}${can('magazzino.view') ? ' · ' + esc(nomeProfilo(m.profilo || '')) : ''}</td>
      <td class="right">${m.annullabile ? `<button class="iconbtn" onclick="annullaMov(${m.id}, '${esc(m.product).replace(/'/g, "\\'")}', ${m.qty})" title="${t('annulla_mov')}">↩</button>` : ''}</td></tr>`).join('')}</table>`
      : `<p class="muted">${t('nessun_vuoto_oggi')}</p>`}
  </div>`;
}
async function annullaMov(id, nome, qty) {
  if (!confirm(t('conferma_annulla', { n: nome, q: qty }))) return;
  try { await api('/movements/' + id, 'DELETE'); ricaricaVista(); } catch (e) { alert(e.message); }
}
// dopo aver segnato un vuoto: se la giacenza e' andata sotto zero lo diciamo, senza bloccare
function avvisoGiacenza(r, nome) {
  if (r && r.giacenzaNegativa) alert(t('avviso_negativo', { n: nome }));
}

/* ===================== STORICO MOVIMENTI (magazzino) ===================== */
async function caricaStoricoMov() {
  const box = $('#storico-mov'); if (!box) return;
  if (!can('magazzino.view')) { box.innerHTML = ''; return; }
  const da = $('#sm-da') ? $('#sm-da').value : giornata(new Date(Date.now() - 6 * 86400000));
  const a = $('#sm-a') ? $('#sm-a').value : giornata();
  let righe = [], neg = [];
  try { [righe, neg] = await Promise.all([api(`/movements?from=${da}&to=${a}`), api('/products/negativi')]); } catch { }
  box.innerHTML = `
    ${neg.length ? `<div class="card rq-warn"><b>⚠ ${t('negativi_titolo')}</b>
      <p style="font-size:12px;margin:4px 0">${t('negativi_aiuto')}</p>
      ${neg.map(p => `<span class="chip">${esc(p.name)}: ${p.stock}</span>`).join(' ')}</div>` : ''}
    <div class="card">
      <div class="cal-head"><h3>${t('storico_mov')}</h3>
        ${can('all') ? `<button class="ghost" onclick="mostraAnnullati()">${t('vedi_annullati')}</button>` : ''}</div>
      <div class="row c2">
        <div><label>${t('dal')}</label><input id="sm-da" type="date" value="${da}" onchange="caricaStoricoMov()"></div>
        <div><label>${t('al')}</label><input id="sm-a" type="date" value="${a}" onchange="caricaStoricoMov()"></div>
      </div>
      <div class="grid-scroll"><table class="wide"><thead><tr><th>${t('giorno')}</th><th>${t('prodotto')}</th><th>${t('tipo')}</th>
        <th class="right">${t('quantita')}</th><th>${t('chi')}</th><th></th></tr></thead><tbody>
        ${righe.map(m => `<tr><td class="muted" style="white-space:nowrap">${dataBreve(m.work_date)} ${oraBreve(m.created_at)}</td>
          <td>${esc(m.product)}</td><td>${tipoMov(m.type)}</td><td class="right">${m.qty}</td>
          <td class="muted">${esc(nomeProfilo(m.profilo || ''))}</td>
          <td class="right">${m.annullabile ? `<button class="iconbtn" onclick="annullaMov(${m.id}, '${esc(m.product).replace(/'/g, "\\'")}', ${m.qty})" title="${t('annulla_mov')}">↩</button>` : ''}</td></tr>`).join('')
          || `<tr><td colspan="6" class="muted">${t('nessun_movimento')}</td></tr>`}
      </tbody></table></div>
      <div id="annullati-box"></div>
    </div>`;
}
async function mostraAnnullati() {
  const r = await api('/movements/annullati');
  $('#annullati-box').innerHTML = `<h3 style="margin-top:14px">${t('annullati_titolo')}</h3>` + (r.length ? `<table>${r.map(a => `<tr>
    <td class="muted" style="font-size:12px">${dataBreve(a.work_date)}</td><td>${esc(a.product_name)}</td><td>${tipoMov(a.type)} ${a.qty}</td>
    <td style="font-size:12px">${t('segnato_da')} <b>${esc(nomeProfilo(a.creato_da))}</b><br>${t('annullato_da')} <b>${esc(nomeProfilo(a.annullato_da))}</b> ${oraBreve(a.annullato_at)} ${dataBreve(a.annullato_at)}</td></tr>`).join('')}</table>`
    : `<p class="muted">${t('nessun_annullato')}</p>`);
}

/* ===================== TURNI MODIFICABILI ===================== */
async function editShift(id) {
  const s = (window._shiftRows || []).find(x => x.id === id); if (!s) return;
  const emps = await api('/employees');
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h3>${t('modifica_turno')}</h3>
        <div class="row c2">
          <div><label>${t('dipendente')}</label><select id="es-emp">${emps.map(e => `<option value="${e.id}" ${e.id === s.employee_id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
          <div><label>${t('data')}</label><input id="es-date" type="date" value="${s.date}"></div>
        </div>
        <div class="row c2">
          <div><label>${t('inizio')}</label><input id="es-start" type="time" value="${s.start}"></div>
          <div><label>${t('fine')}</label><input id="es-end" type="time" value="${s.end}"></div>
        </div>
        <div class="row"><div><label>${t('ruolo')}</label><input id="es-role" value="${esc(s.role || '')}"></div></div>
        <div class="onb-actions">
          <button class="danger" onclick="deleteShift(${id});closeModal()">🗑 ${t('elimina')}</button>
          <span style="flex:1"></span>
          <button class="ghost" onclick="closeModal()">${t('annulla')}</button>
          <button class="act" onclick="saveShift(${id})">${t('salva')}</button>
        </div>
      </div>
    </div>`;
}
async function saveShift(id) {
  try {
    await api('/shifts/' + id, 'PUT', { employee_id: +$('#es-emp').value, date: $('#es-date').value,
      start: $('#es-start').value, end: $('#es-end').value, role: $('#es-role').value });
    closeModal(); refreshTurni();
  } catch (e) { alert(e.message); }
}

/* ===================== CHECKLIST CHE SI RIPETONO ===================== */
const GIORNI_BREVI = () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' }));
let _clGiorni = [1, 2, 3, 4, 5, 6, 7];
async function caricaChecklist() {
  const box = $('#checklist-box'); if (!box) return;
  if (!can('task.manage')) { box.innerHTML = ''; return; }
  const [modelli, emps] = await Promise.all([api('/task-templates'), api('/employees')]);
  const nomi = GIORNI_BREVI();
  box.innerHTML = `<div class="card">
    <h3>${t('checklist_titolo')}</h3>
    <p class="muted" style="font-size:12px;margin:2px 0 8px">${t('checklist_aiuto')}</p>
    ${modelli.length ? `<table>${modelli.map(m => `<tr><td>${esc(m.title)}${m.assignee ? `<div class="muted" style="font-size:11px">${esc(m.assignee)}</div>` : ''}</td>
      <td class="muted" style="font-size:12px">${m.giorni.length === 7 ? t('ogni_giorno') : m.giorni.map(g => nomi[g - 1]).join(', ')}</td>
      <td class="right" style="white-space:nowrap"><button class="iconbtn" onclick="modificaChecklist(${m.id})" title="${t('modifica')}">✏️</button>
        <button class="iconbtn" onclick="togliChecklist(${m.id}, '${esc(m.title).replace(/'/g, "\\'")}')" title="${t('elimina')}">🗑</button></td></tr>`).join('')}</table>`
      : `<p class="muted">${t('nessuna_checklist')}</p>`}
    <div class="row c2" style="margin-top:10px">
      <div><label>${t('cosa_fare')}</label><input id="cl-title" placeholder="${t('ph_checklist')}"></div>
      <div><label>${t('assegnata_a')}</label><select id="cl-emp"><option value="">${t('chiunque')}</option>${emps.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div>
    </div>
    <label>${t('quali_giorni')}</label>
    <div id="cl-giorni" class="who-grid" style="grid-template-columns:repeat(7,1fr)"></div>
    <button class="act" style="margin-top:8px" onclick="aggiungiChecklist()">+ ${t('aggiungi_checklist')}</button>
  </div>`;
  disegnaGiorni();
}
function disegnaGiorni() {
  const nomi = GIORNI_BREVI();
  $('#cl-giorni').innerHTML = nomi.map((n, i) => `<button class="${_clGiorni.includes(i + 1) ? 'act' : 'ghost'}" style="padding:8px 0" onclick="_clGiorni=_clGiorni.includes(${i + 1})?_clGiorni.filter(x=>x!==${i + 1}):[..._clGiorni,${i + 1}];disegnaGiorni()">${n}</button>`).join('');
}
async function aggiungiChecklist() {
  const title = $('#cl-title').value.trim(); if (!title) return alert(t('scrivi_cosa'));
  try {
    await api('/task-templates', 'POST', { title, giorni: _clGiorni, assignee_id: +$('#cl-emp').value || null });
    _clGiorni = [1, 2, 3, 4, 5, 6, 7]; caricaChecklist(); loadTasks();
  } catch (e) { alert(e.message); }
}
async function modificaChecklist(id) {
  const m = (await api('/task-templates')).find(x => x.id === id); if (!m) return;
  const title = prompt(t('cosa_fare'), m.title); if (title === null) return;
  const nomi = GIORNI_BREVI();
  const gg = prompt(t('quali_giorni_numeri') + '\n' + nomi.map((n, i) => `${i + 1} = ${n}`).join(', '), m.giorni.join(','));
  if (gg === null) return;
  try {
    await api('/task-templates/' + id, 'PUT', { title, giorni: gg.split(/[^0-9]+/).filter(Boolean).map(Number) });
    caricaChecklist(); loadTasks();
  } catch (e) { alert(e.message); }
}
async function togliChecklist(id, nome) {
  if (!confirm(t('conferma_elimina', { n: nome }))) return;
  try { await api('/task-templates/' + id, 'DELETE'); caricaChecklist(); loadTasks(); } catch (e) { alert(e.message); }
}
async function modificaTask(id, titolo) {
  const nuovo = prompt(t('cosa_fare'), titolo); if (nuovo === null || !nuovo.trim()) return;
  try { await api('/tasks/' + id, 'PUT', { title: nuovo.trim() }); loadTasks(); } catch (e) { alert(e.message); }
}
async function eliminaTask(id, titolo) {
  if (!confirm(t('conferma_elimina', { n: titolo }))) return;
  try { await api('/tasks/' + id, 'DELETE'); loadTasks(); } catch (e) { alert(e.message); }
}

/* ===================== PROFILI: NOME, RUOLO, PERSONA ===================== */
async function modificaProfilo(id) {
  const [profili, ruoli, emps] = await Promise.all([api('/profiles'), api('/ruoli'), api('/employees')]);
  const p = profili.find(x => x.id === id); if (!p) return;
  const ruoloAttuale = p.permissions.includes('all') ? 'proprietario' : '';
  $('#modal-root').innerHTML = `
    <div class="overlay" onclick="if(event.target===this)openSettings()">
      <div class="modal">
        <h3>${t('modifica')}: ${esc(nomeProfilo(p.name))}</h3>
        <div class="row"><div><label>${t('nome')}</label><input id="mp-name" value="${esc(p.name)}"></div></div>
        <div class="row"><div><label>${t('ruolo')}</label><select id="mp-role"><option value="">${t('lascia_com_e')}</option>
          ${ruoli.map(r => `<option value="${r}" ${r === ruoloAttuale ? 'selected' : ''}>${nomeRuolo(r)}</option>`).join('')}</select></div></div>
        <div class="row"><div><label>${t('di_chi')}</label><select id="mp-emp"><option value="">${t('profilo_condiviso')}</option>
          ${emps.map(e => `<option value="${e.id}" ${e.id === p.employee_id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div></div>
        <p class="muted" style="font-size:11.5px">${t('di_chi_aiuto')}</p>
        <div class="onb-actions">
          <button class="ghost" onclick="openSettings()">${t('annulla')}</button>
          <button class="act" onclick="salvaProfilo(${id})">${t('salva')}</button>
        </div>
      </div>
    </div>`;
}
async function salvaProfilo(id) {
  const corpo = { name: $('#mp-name').value.trim(), employee_id: +$('#mp-emp').value || null };
  if ($('#mp-role').value) corpo.ruolo = $('#mp-role').value;
  try { await api('/profiles/' + id, 'PUT', corpo); openSettings(); } catch (e) { alert(e.message); }
}
async function rinominaPostazione(id, nome) {
  const nuovo = prompt(t('nome'), nome); if (nuovo === null || !nuovo.trim()) return;
  try { await api('/locations/' + id, 'PUT', { name: nuovo.trim() }); loadLocations(); } catch (e) { alert(e.message); }
}
// il link da dare allo staff: apre l'app gia' sul locale giusto
function linkStaff() { return location.origin + '/?l=' + encodeURIComponent(LOCALE); }
async function copiaLinkStaff() {
  try { await navigator.clipboard.writeText(linkStaff()); alert(t('link_copiato')); }
  catch { prompt(t('link_staff'), linkStaff()); }
}

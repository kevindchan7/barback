/* Converte i due documenti legali in pagine del sito, con lo stesso
   aspetto della pagina principale. Gestisce solo cio' che quei due
   file usano davvero: titoli, tabelle, elenchi, citazioni, grassetto. */
const fs = require('fs');

function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([A-Z0-9 ,.\u00C0-\u00FF\/]+)\]/g, '<mark>[$1]</mark>');
}

function converti(md) {
  const righe = md.split(/\r?\n/);
  const out = []; let i = 0;

  while (i < righe.length) {
    const r = righe[i];

    if (/^\s*$/.test(r)) { i++; continue; }

    // linea orizzontale
    if (/^---+\s*$/.test(r)) { out.push('<hr>'); i++; continue; }

    // titoli
    const h = r.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }

    // citazione (il cartello "da compilare")
    if (/^>\s?/.test(r)) {
      const b = [];
      while (i < righe.length && /^>\s?/.test(righe[i])) { b.push(inline(righe[i].replace(/^>\s?/, ''))); i++; }
      out.push(`<blockquote>${b.join('<br>')}</blockquote>`);
      continue;
    }

    // tabella
    if (/^\|/.test(r) && /^\|[\s:|-]+\|\s*$/.test(righe[i + 1] || '')) {
      const cella = (x) => x.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const testa = cella(r);
      i += 2;
      const corpo = [];
      while (i < righe.length && /^\|/.test(righe[i])) { corpo.push(cella(righe[i])); i++; }
      const vuota = testa.every(c => c === '');
      let t = '<div class="tw"><table>';
      if (!vuota) t += '<thead><tr>' + testa.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>';
      t += '<tbody>' + corpo.map(rr => '<tr>' + rr.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      out.push(t);
      continue;
    }

    // elenco
    if (/^\s*[-*]\s+/.test(r)) {
      const li = [];
      while (i < righe.length && /^\s*[-*]\s+/.test(righe[i])) { li.push(`<li>${inline(righe[i].replace(/^\s*[-*]\s+/, ''))}</li>`); i++; }
      out.push(`<ul>${li.join('')}</ul>`);
      continue;
    }

    // paragrafo: le righe attaccate stanno insieme, ma "Campo:** valore" va a capo
    const p = [];
    while (i < righe.length && !/^\s*$/.test(righe[i]) && !/^(#|>|\||---|\s*[-*]\s)/.test(righe[i])) { p.push(inline(righe[i])); i++; }
    out.push(`<p>${p.join('<br>')}</p>`);
  }
  return out.join('\n');
}

const STILE = `
:root{--bg:#0f1512;--panel:#16201b;--panel2:#1d2b23;--line:#2c3d33;--txt:#eaf4ee;--muted:#8fa89a;--accent:#3ecf8e;--yellow:#f5c451}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:780px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);background:var(--panel)}
header .wrap{display:flex;align-items:center;height:62px;gap:14px}
header a{color:var(--txt);text-decoration:none;font-weight:800;font-size:18px}
header .back{margin-left:auto;color:var(--muted);font-weight:500;font-size:15px}
header .back:hover{color:var(--accent)}
main{padding:44px 0 70px}
h1{font-size:clamp(26px,4vw,34px);letter-spacing:-.025em;line-height:1.2;margin:0 0 8px}
h2{font-size:21px;margin:38px 0 12px;letter-spacing:-.015em;padding-top:4px}
h3{font-size:17px;margin:26px 0 8px}
p{margin:0 0 15px}
a{color:var(--accent)}
hr{border:0;border-top:1px solid var(--line);margin:30px 0}
ul{margin:0 0 15px;padding-left:22px}
li{margin-bottom:7px}
blockquote{margin:0 0 26px;padding:16px 18px;border-radius:12px;border:1px solid rgba(245,196,81,.4);background:rgba(245,196,81,.08);color:#f7e2ac;font-size:14.8px;line-height:1.6}
mark{background:rgba(245,196,81,.2);color:var(--yellow);padding:1px 5px;border-radius:4px;font-weight:600}
code{background:var(--panel2);padding:2px 6px;border-radius:5px;font-size:14px}
.tw{overflow-x:auto;margin:0 0 20px}
table{border-collapse:collapse;width:100%;min-width:420px;font-size:15px}
th,td{text-align:left;padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.04em;font-weight:700}
footer{border-top:1px solid var(--line);padding:26px 0 40px;color:var(--muted);font-size:14px}
footer a{color:var(--muted)}footer a:hover{color:var(--accent)}
`;

function pagina(titolo, corpo) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="barback.ico">
<title>${titolo} — Barback</title>
<meta name="robots" content="noindex">
<style>${STILE}</style>
</head>
<body>
<header><div class="wrap"><a href="index.html">Barback</a><a class="back" href="index.html">&larr; torna al sito</a></div></header>
<main><div class="wrap">
${corpo}
</div></main>
<footer><div class="wrap"><a href="index.html">Barback</a> &middot; <a href="privacy.html">Privacy</a> &middot; <a href="condizioni.html">Condizioni</a></div></footer>
</body>
</html>
`;
}

for (const [src, dst, tit] of [['PRIVACY.md', 'sito/privacy.html', 'Informativa privacy'],
                               ['CONDIZIONI.md', 'sito/condizioni.html', 'Condizioni di servizio'],
                               ['TERMS.md', 'sito/terms.html', 'Terms of Service']]) {
  const md = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dst, pagina(tit, converti(md)));
  console.log(dst + '  ' + fs.statSync(dst).size + ' byte');
}

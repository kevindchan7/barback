/* =====================================================================
   mascot.js — La mascotte "Barback": una bottiglia antropomorfa con
   braccia e gambe. È disegnata in SVG (vettoriale), quindi nitida a
   ogni dimensione. La funzione mascot(size) restituisce il markup SVG,
   riusato in banner, schermate vuote e onboarding.

   I colori NON sono scritti qui: ogni pezzo ha una classe e il colore
   arriva dal CSS. Così la bottiglia è verde nel tema scuro e arancione
   in quello chiaro, senza toccare questo file. (Nelle SVG le variabili
   CSS non funzionano dentro fill="...", per questo servono le classi.)
   ===================================================================== */
function mascot(size = 72) {
  // ogni mascotte ha id propri per i gradienti (piu' omini nella stessa pagina)
  const u = 'mg' + Math.random().toString(36).slice(2, 7);
  return `
  <svg class="mascot" width="${size}" height="${size}" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Barback mascotte">
    <defs>
      <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="m-s1"/><stop offset="1" class="m-s2"/></linearGradient>
      <linearGradient id="${u}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-c1"/><stop offset="1" class="m-c2"/></linearGradient>
    </defs>
    <!-- ombra a terra -->
    <ellipse class="m-shadow" cx="50" cy="115" rx="22" ry="3.2"/>
    <!-- braccia: morbide, una saluta -->
    <path class="m-limb" d="M31 66 Q18 68 16 80" stroke-width="7" stroke-linecap="round"/>
    <path class="m-limb" d="M69 64 Q84 58 86 44" stroke-width="7" stroke-linecap="round"/>
    <circle class="m-hand" cx="16" cy="81" r="5"/><circle class="m-hand" cx="86" cy="42" r="5"/>
    <!-- piedini -->
    <rect class="m-foot" x="35" y="104" width="12" height="9" rx="4.5"/>
    <rect class="m-foot" x="53" y="104" width="12" height="9" rx="4.5"/>
    <!-- corpo: collo stretto, spalle morbide -->
    <path fill="url(#${u}b)" d="M43 14 H57 V30 C57 36 70 40 70 56 V97 C70 105 65 108 58 108 H42 C35 108 30 105 30 97 V56 C30 40 43 36 43 30 Z"/>
    <!-- riflesso -->
    <path class="m-shine-l" d="M36 58 C36 48 40 43 44 41" stroke-width="3.4" stroke-linecap="round"/>
    <!-- tappo -->
    <rect fill="url(#${u}c)" x="41" y="6" width="18" height="11" rx="4"/>
    <!-- etichetta con una stellina -->
    <rect class="m-label" x="34" y="74" width="32" height="22" rx="6"/>
    <path class="m-star" d="M50 78.5 L51.8 82.6 L56.2 83 L52.9 85.9 L53.9 90.2 L50 87.9 L46.1 90.2 L47.1 85.9 L43.8 83 L48.2 82.6 Z"/>
    <!-- faccia: occhi grandi e guance -->
    <ellipse class="m-ink" cx="44.5" cy="55" rx="3.6" ry="4.4"/>
    <ellipse class="m-ink" cx="55.5" cy="55" rx="3.6" ry="4.4"/>
    <circle class="m-shine" cx="45.7" cy="53.4" r="1.4"/><circle class="m-shine" cx="56.7" cy="53.4" r="1.4"/>
    <ellipse class="m-blush" cx="39.5" cy="62" rx="3.2" ry="2"/><ellipse class="m-blush" cx="60.5" cy="62" rx="3.2" ry="2"/>
    <path class="m-smile" d="M45.5 62 Q50 67 54.5 62" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;
}

// fumetto della mascotte (per onboarding / empty state)
// "text" puo' essere una lista: una sola bottiglia, un fumetto per messaggio
function mascotSays(text, size = 64) {
  const fumetti = [].concat(text).map(x => `<div class="bubble">${x}</div>`).join('');
  return `<div class="mascot-row">${mascot(size)}<div class="bubbles">${fumetti}</div></div>`;
}

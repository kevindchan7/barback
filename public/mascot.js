/* =====================================================================
   mascot.js — La mascotte "Barback": una bottiglia antropomorfa con
   braccia e gambe. È disegnata in SVG (vettoriale), quindi nitida a
   ogni dimensione. La funzione mascot(size) restituisce il markup SVG,
   riusato in banner, schermate vuote e onboarding.
   ===================================================================== */
function mascot(size = 72) {
  return `
  <svg class="mascot" width="${size}" height="${size}" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Barback mascotte">
    <!-- braccia -->
    <path d="M30 60 Q12 64 14 82" stroke="#2e7d5b" stroke-width="6" stroke-linecap="round"/>
    <path d="M70 60 Q88 64 86 82" stroke="#2e7d5b" stroke-width="6" stroke-linecap="round"/>
    <!-- gambe -->
    <path d="M42 104 L40 116" stroke="#2e7d5b" stroke-width="7" stroke-linecap="round"/>
    <path d="M58 104 L60 116" stroke="#2e7d5b" stroke-width="7" stroke-linecap="round"/>
    <!-- corpo bottiglia -->
    <path d="M40 18 L40 30 Q30 36 30 52 L30 96 Q30 106 40 106 L60 106 Q70 106 70 96 L70 52 Q70 36 60 30 L60 18 Z"
          fill="#3ecf8e" stroke="#1f3d2f" stroke-width="3"/>
    <!-- tappo -->
    <rect x="42" y="8" width="16" height="12" rx="2" fill="#c9a24b" stroke="#1f3d2f" stroke-width="2"/>
    <!-- etichetta -->
    <rect x="34" y="60" width="32" height="26" rx="3" fill="#fdf6e3" stroke="#1f3d2f" stroke-width="2"/>
    <!-- occhi -->
    <circle cx="44" cy="46" r="4" fill="#1f3d2f"/>
    <circle cx="56" cy="46" r="4" fill="#1f3d2f"/>
    <circle cx="45.5" cy="44.5" r="1.3" fill="#fff"/>
    <circle cx="57.5" cy="44.5" r="1.3" fill="#fff"/>
    <!-- sorriso -->
    <path d="M43 52 Q50 58 57 52" stroke="#1f3d2f" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <!-- manina che saluta -->
    <circle cx="14" cy="82" r="5" fill="#3ecf8e" stroke="#1f3d2f" stroke-width="2"/>
  </svg>`;
}

// fumetto della mascotte (per onboarding / empty state)
function mascotSays(text, size = 64) {
  return `<div class="mascot-row">${mascot(size)}<div class="bubble">${text}</div></div>`;
}

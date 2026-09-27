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
  return `
  <svg class="mascot" width="${size}" height="${size}" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Barback mascotte">
    <!-- braccia -->
    <path class="m-limb" d="M30 60 Q12 64 14 82" stroke-width="6" stroke-linecap="round"/>
    <path class="m-limb" d="M70 60 Q88 64 86 82" stroke-width="6" stroke-linecap="round"/>
    <!-- gambe -->
    <path class="m-limb" d="M42 104 L40 116" stroke-width="7" stroke-linecap="round"/>
    <path class="m-limb" d="M58 104 L60 116" stroke-width="7" stroke-linecap="round"/>
    <!-- corpo bottiglia -->
    <path class="m-body" d="M40 18 L40 30 Q30 36 30 52 L30 96 Q30 106 40 106 L60 106 Q70 106 70 96 L70 52 Q70 36 60 30 L60 18 Z"
          stroke-width="3"/>
    <!-- tappo -->
    <rect class="m-cap" x="42" y="8" width="16" height="12" rx="2" stroke-width="2"/>
    <!-- etichetta -->
    <rect class="m-label" x="34" y="60" width="32" height="26" rx="3" stroke-width="2"/>
    <!-- occhi -->
    <circle class="m-ink" cx="44" cy="46" r="4"/>
    <circle class="m-ink" cx="56" cy="46" r="4"/>
    <circle class="m-shine" cx="45.5" cy="44.5" r="1.3"/>
    <circle class="m-shine" cx="57.5" cy="44.5" r="1.3"/>
    <!-- sorriso -->
    <path class="m-smile" d="M43 52 Q50 58 57 52" stroke-width="2.5" stroke-linecap="round"/>
    <!-- manina che saluta -->
    <circle class="m-body" cx="14" cy="82" r="5" stroke-width="2"/>
  </svg>`;
}

// fumetto della mascotte (per onboarding / empty state)
function mascotSays(text, size = 64) {
  return `<div class="mascot-row">${mascot(size)}<div class="bubble">${text}</div></div>`;
}

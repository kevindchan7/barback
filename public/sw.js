/* =====================================================================
   sw.js — Service worker: serve solo a rendere Barback installabile
   sul telefono e ad aprire il guscio dell'app anche senza rete.
   I DATI non vengono mai messi in cache: le chiamate a /api passano
   sempre dalla rete, altrimenti si vedrebbero giacenze vecchie.
   ===================================================================== */
/* La versione va cambiata ogni volta che cambia questa lista, altrimenti
   chi ha gia' installato l'app resta con il guscio vecchio. */
const CACHE = 'barback-guscio-v2';
const GUSCIO = ['./', 'index.html', 'style.css', 'app.js', 'mascot.js', 'i18n.js',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // butta le cache delle versioni precedenti
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // i dati e tutto cio' che non e' nostro: sempre dalla rete, mai dalla cache
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== self.location.origin) return;
  // il guscio: prima la rete (per avere gli aggiornamenti), la cache se offline
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

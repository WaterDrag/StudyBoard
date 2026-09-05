// ── StudyBoard service worker ─────────────────────────────────
// Goal: the app shell (pages, CSS, JS, the Firebase SDK) keeps working with
// no connection. Actual DATA offline is handled by Firestore's own
// persistence — this file deliberately never touches Firestore traffic.
//
// The cache name carries the app version (the registration URL is
// sw.js?v=APP_VERSION), so publishing a new version installs a fresh worker
// and drops the old cache.
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE = 'studyboard-' + VERSION;

// Same-origin shell. Missing entries must not break install, so they're
// added individually rather than via addAll().
const SHELL = [
  'index.html', 'dashboard.html', 'room.html', 'flashcards.html', 'quiz.html',
  'css/style.css',
  'js/version.js', 'js/config.js', 'js/auth.js', 'js/dashboard.js',
  'js/flashcards.js', 'js/quiz.js',
  'js/room-core.js', 'js/room-list.js', 'js/room-notes.js', 'js/room-export.js',
  'js/room-board.js', 'js/room-whiteboard.js', 'js/room-ai.js',
  'js/room-social.js', 'js/room-init.js',
  'manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('studyboard-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Traffic we must never intercept: Firestore/RTDB/auth talk their own
// protocols (streaming, long-poll) and image uploads shouldn't be cached.
function isLiveData(url) {
  return /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|googleapis\.com\/identitytoolkit|securetoken|imgbb\.com|generativelanguage|api\.groq\.com/.test(url);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || isLiveData(req.url)) return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;

  // App shell → network first (so a fresh deploy wins immediately), cache as
  // the offline fallback.
  if (sameOrigin) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        // A navigation with nothing cached still deserves a real page.
        if (req.mode === 'navigate') {
          const fallback = await caches.match('dashboard.html', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        throw _;
      }
    })());
    return;
  }

  // CDN assets (Firebase SDK, fonts) are version-pinned URLs → cache first.
  if (/gstatic\.com|googleapis\.com/.test(req.url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    })());
  }
});

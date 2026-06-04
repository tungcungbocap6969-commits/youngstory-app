const CACHE_NAME = 'xuong-sx-v21';
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting(); // Tá»± Ä‘á»™ng kÃ­ch hoáº¡t ngay, khÃ´ng cáº§n user báº¥m
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  if (u.pathname === '/clear.html') return false; // khÃ´ng cache trang reset
  return /\.(html|css|js|png|jpg|svg|json|woff2?)$/.test(u.pathname);
}

// Network-first: cÃ³ máº¡ng â†’ luÃ´n láº¥y báº£n má»›i nháº¥t tá»« server vÃ  cáº­p nháº­t cache;
// máº¥t máº¡ng â†’ fallback vá» cache Ä‘Ã£ lÆ°u. Nhá» váº­y má»—i láº§n deploy lÃ  mÃ¡y nháº­n ngay,
// khÃ´ng phá»¥ thuá»™c vÃ o viá»‡c nhá»› bump cache name.
function networkFirst(request, cacheKey) {
  const key = cacheKey || request;
  return fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(key, clone));
      }
      return response;
    })
    .catch(() => caches.match(key));
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Navigate requests â†’ chá»‰ intercept '/' vÃ  '/index.html', cÃ²n láº¡i Ä‘á»ƒ browser tá»± fetch
  if (event.request.mode === 'navigate') {
    const path = new URL(event.request.url).pathname;
    if (path === '/' || path === '/index.html') {
      event.respondWith(networkFirst(event.request, '/'));
    }
    return;
  }

  // API calls (Supabase, v.v.) â€” khÃ´ng cache, luÃ´n láº¥y tá»« network
  if (!isStaticAsset(event.request.url)) return;

  // Static assets (html/css/js/áº£nh) â†’ network-first
  event.respondWith(networkFirst(event.request));
});

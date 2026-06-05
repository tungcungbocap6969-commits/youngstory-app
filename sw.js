const CACHE_NAME = 'xuong-sx-v22';
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
  self.skipWaiting(); // TÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng kÃƒÂ­ch hoÃ¡ÂºÂ¡t ngay, khÃƒÂ´ng cÃ¡ÂºÂ§n user bÃ¡ÂºÂ¥m
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
  if (u.pathname === '/clear.html') return false; // khÃƒÂ´ng cache trang reset
  return /\.(html|css|js|png|jpg|svg|json|woff2?)$/.test(u.pathname);
}

// Network-first: cÃƒÂ³ mÃ¡ÂºÂ¡ng Ã¢â€ â€™ luÃƒÂ´n lÃ¡ÂºÂ¥y bÃ¡ÂºÂ£n mÃ¡Â»â€ºi nhÃ¡ÂºÂ¥t tÃ¡Â»Â« server vÃƒÂ  cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t cache;
// mÃ¡ÂºÂ¥t mÃ¡ÂºÂ¡ng Ã¢â€ â€™ fallback vÃ¡Â»Â cache Ã„â€˜ÃƒÂ£ lÃ†Â°u. NhÃ¡Â»Â vÃ¡ÂºÂ­y mÃ¡Â»â€”i lÃ¡ÂºÂ§n deploy lÃƒÂ  mÃƒÂ¡y nhÃ¡ÂºÂ­n ngay,
// khÃƒÂ´ng phÃ¡Â»Â¥ thuÃ¡Â»â„¢c vÃƒÂ o viÃ¡Â»â€¡c nhÃ¡Â»â€º bump cache name.
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

  // Navigate requests Ã¢â€ â€™ chÃ¡Â»â€° intercept '/' vÃƒÂ  '/index.html', cÃƒÂ²n lÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ browser tÃ¡Â»Â± fetch
  if (event.request.mode === 'navigate') {
    const path = new URL(event.request.url).pathname;
    if (path === '/' || path === '/index.html') {
      event.respondWith(networkFirst(event.request, '/'));
    }
    return;
  }

  // API calls (Supabase, v.v.) Ã¢â‚¬â€ khÃƒÂ´ng cache, luÃƒÂ´n lÃ¡ÂºÂ¥y tÃ¡Â»Â« network
  if (!isStaticAsset(event.request.url)) return;

  // Static assets (html/css/js/Ã¡ÂºÂ£nh) Ã¢â€ â€™ network-first
  event.respondWith(networkFirst(event.request));
});

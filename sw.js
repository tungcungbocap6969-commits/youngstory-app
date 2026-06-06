const CACHE_NAME = 'xuong-sx-v26';

// Toàn bộ "vỏ" app — precache để mở tức thì VÀ đảm bảo nhận bản mới sau mỗi deploy.
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/splash.css',
  '/js/config.js',
  '/js/db.js',
  '/js/time.js',
  '/js/utils.js',
  '/js/supabase.js',
  '/js/dropdown.js',
  '/js/clock.js',
  '/js/cards.js',
  '/js/form.js',
  '/js/pin.js',
  '/js/modal.js',
  '/js/splash.js',
  '/js/app.js'
];

// INSTALL: tải toàn bộ vỏ app vào cache MỚI (best-effort), rồi kích hoạt ngay.
// Vì deploy.bat bump CACHE_NAME mỗi lần deploy → đây là cache mới hoàn toàn,
// nên addAll luôn lấy file MỚI NHẤT từ server.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting(); // không chờ — kích hoạt SW mới ngay
});

// ACTIVATE: xóa toàn bộ cache cũ, giành quyền điều khiển mọi tab đang mở ngay lập tức.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cho phép trang yêu cầu SW đang chờ kích hoạt ngay (nút "Cập nhật ngay").
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  if (u.pathname === '/clear.html') return false; // không cache trang reset
  return /\.(html|css|js|png|jpg|svg|json|woff2?)$/.test(u.pathname);
}

// CACHE-FIRST: phục vụ NGAY từ cache (mở app tức thì). Nếu cache chưa có thì
// lấy từ mạng rồi lưu lại cho lần sau. Sau mỗi deploy, install đã precache bản
// mới vào cache mới nên reload sẽ thấy ngay phiên bản mới nhất.
function cacheFirst(request, cacheKey) {
  const key = cacheKey || request;
  return caches.match(key).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(key, clone));
      }
      return response;
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Điều hướng (mở app) → chỉ xử lý '/' và '/index.html' → cache-first.
  if (event.request.mode === 'navigate') {
    const path = new URL(event.request.url).pathname;
    if (path === '/' || path === '/index.html') {
      event.respondWith(cacheFirst(event.request, '/'));
    }
    return;
  }

  // Lệnh gọi API (Supabase, v.v.) — KHÔNG cache, luôn đi thẳng ra mạng.
  if (!isStaticAsset(event.request.url)) return;

  // File tĩnh (html/css/js/ảnh) → cache-first.
  event.respondWith(cacheFirst(event.request));
});

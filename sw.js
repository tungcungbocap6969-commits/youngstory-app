const CACHE_NAME = 'xuong-sx-v28';

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

// ══════════════════ BACKGROUND SYNC (cứu máy Android) ══════════════════
// Gửi các báo cáo còn "đang chờ" lên server NGAY CẢ KHI app đã đóng.
// Trình duyệt (Android/Chrome) tự đánh thức SW khi có mạng; còn lỗi → tự thử lại.
const SB_URL  = 'https://api.youngstory.net';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjY2pzc2ltb3VycmFmd3VtbHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDg0NjcsImV4cCI6MjA5MzgyNDQ2N30.Wv5UMMxGynKoU-I8I2fREf6vJET366Jf6oWpUk60ONU';
const SB_DB_NAME = 'xuong-sx';
const SB_DB_VER  = 1;
const SB_STORE   = 'reports';

function _idb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(SB_DB_NAME, SB_DB_VER);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
function _idbGetAll() {
  return _idb().then(db => new Promise((res, rej) => {
    const q = db.transaction(SB_STORE, 'readonly').objectStore(SB_STORE).getAll();
    q.onsuccess = e => res(e.target.result || []);
    q.onerror   = e => rej(e.target.error);
  }));
}
function _idbGet(id) {
  return _idb().then(db => new Promise((res, rej) => {
    const q = db.transaction(SB_STORE, 'readonly').objectStore(SB_STORE).get(id);
    q.onsuccess = e => res(e.target.result);
    q.onerror   = e => rej(e.target.error);
  }));
}
function _idbPut(r) {
  return _idb().then(db => new Promise((res, rej) => {
    const q = db.transaction(SB_STORE, 'readwrite').objectStore(SB_STORE).put(r);
    q.onsuccess = () => res();
    q.onerror   = e => rej(e.target.error);
  }));
}
function _sbHeaders(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, extra || {});
}
function _sbFindRecent(name, process, qty) {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  return fetch(SB_URL + '/rest/v1/reports?worker_name=ilike.' + encodeURIComponent(name) +
    '&process=eq.' + encodeURIComponent(process) + '&quantity=eq.' + qty +
    '&timestamp=gte.' + encodeURIComponent(since) + '&order=timestamp.desc&limit=1',
    { headers: _sbHeaders() })
    .then(r => r.ok ? r.json() : []).then(rows => (rows && rows[0]) || null);
}
function _sbInsert(row) {
  return fetch(SB_URL + '/rest/v1/reports', {
    method: 'POST', headers: _sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(row),
  }).then(r => { if (!r.ok) throw new Error('insert failed'); return r.json(); }).then(rows => rows[0]);
}

function _idbDel(id) {
  return _idb().then(db => new Promise((res, rej) => {
    const q = db.transaction(SB_STORE, 'readwrite').objectStore(SB_STORE).delete(id);
    q.onsuccess = () => res();
    q.onerror   = e => rej(e.target.error);
  }));
}
function _sbDel(sbId) {
  return fetch(SB_URL + '/rest/v1/reports?id=eq.' + sbId, { method: 'DELETE', headers: _sbHeaders() })
    .then(r => { if (!r.ok) throw new Error('del failed'); });
}
function _sbUpdate(sbId, data) {
  return fetch(SB_URL + '/rest/v1/reports?id=eq.' + sbId, { method: 'PATCH', headers: _sbHeaders(), body: JSON.stringify(data) })
    .then(r => { if (!r.ok) throw new Error('update failed'); });
}

async function swSendPending() {
  const all = await _idbGetAll();
  const todo = all.filter(r => !r.sbId || r.pendingDelete || r.needsUpdate);
  if (!todo.length) return;
  let anyFailed = false;
  for (const rec of todo) {
    try {
      if (rec.pendingDelete) {
        if (rec.sbId) await _sbDel(rec.sbId);
        await _idbDel(rec.id);
      } else if (rec.sbId && rec.needsUpdate) {
        await _sbUpdate(rec.sbId, {
          worker_name: rec.workerName, team: rec.team, process: rec.process, quantity: rec.quantity,
        });
        const fresh = await _idbGet(rec.id);
        if (fresh && fresh.needsUpdate) { delete fresh.needsUpdate; await _idbPut(fresh); }
      } else if (!rec.sbId) {
        let landed = await _sbFindRecent(rec.workerName, rec.process, rec.quantity);
        let sbId;
        if (landed) {
          sbId = landed.id;
        } else {
          const sbRow = await _sbInsert({
            worker_name: String(rec.workerName).replace(/(?:^|\s)\S/g, c => c.toUpperCase()),
            team: rec.team, process: rec.process, quantity: rec.quantity,
            date: rec.date, timestamp: rec.timestamp,
          });
          sbId = sbRow.id;
        }
        const fresh = await _idbGet(rec.id);
        if (fresh && !fresh.sbId && !fresh.pendingDelete) await _idbPut({ ...fresh, sbId });
      }
    } catch (_) { anyFailed = true; }
  }
  try {
    const cs = await self.clients.matchAll();
    cs.forEach(c => c.postMessage({ type: 'REPORTS_SYNCED' }));
  } catch (_) {}
  if (anyFailed) throw new Error('still pending'); // ném lỗi → Background Sync tự thử lại sau
}

self.addEventListener('sync', event => {
  if (event.tag === 'send-reports') event.waitUntil(swSendPending());
});

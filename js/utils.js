'use strict';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Toast (animation I) ──
let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('show', 'hide');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
  }, 2800);
}

// ── Count-up animation (G, H) ──
function countUp(el, target, duration = 600, localize = true) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
    el.textContent = localize
      ? Math.round(ease * target).toLocaleString('vi-VN')
      : Math.round(ease * target);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Update banner ──
function initUpdateBanner() {
  if (!('serviceWorker' in navigator)) return;
  const banner = document.getElementById('update-banner');
  const btn    = document.getElementById('update-btn');
  if (!banner || !btn) return;

  let waitingSW = null;

  function showBanner(sw) {
    waitingSW = sw;
    banner.classList.add('show');
  }

  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) { showBanner(reg.waiting); }

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          showBanner(sw);
        }
      });
    });
  });

  // Khi SW mới được kích hoạt → tải lại trang để nhận bản mới NGAY trong lần mở này.
  // Chốt an toàn: nếu công nhân đang gõ dở (đã nhập sản lượng), KHÔNG reload đột ngột
  // mà hiện banner để họ tự bấm cập nhật khi xong → tránh mất dữ liệu đang nhập.
  let _reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_reloading) return;
    const qty = document.getElementById('f-qty');
    if (qty && qty.value.trim() !== '') {
      banner.classList.add('show'); // đang gõ dở → chỉ báo, không reload
      return;
    }
    _reloading = true;
    window.location.reload();
  });

  btn.addEventListener('click', () => {
    btn.textContent = 'Đang cập nhật...';
    btn.disabled = true;
    if (waitingSW) {
      waitingSW.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });
}

// ── Confetti (E) ──
function confetti() {
  const colors = ['#22c55e', '#86efac', '#ffffff', '#f0f0f0', '#4ade80'];
  const count  = 28;
  const origin = document.getElementById('btn-submit').getBoundingClientRect();
  const cx = origin.left + origin.width / 2;
  const cy = origin.top;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.background    = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left          = cx + 'px';
    piece.style.top           = cy + 'px';
    piece.style.borderRadius  = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(piece);

    const angle  = (Math.random() * 220 - 110) * (Math.PI / 180);
    const speed  = 120 + Math.random() * 200;
    const vx     = Math.sin(angle) * speed;
    const vy     = -Math.cos(angle) * speed * (0.6 + Math.random() * 0.8);
    const rotate = Math.random() * 720 - 360;
    const dur    = 900 + Math.random() * 600;
    const delay  = Math.random() * 80;

    piece.animate([
      { transform: `translate(0,0) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${vx}px,${vy + speed * 0.6}px) rotate(${rotate}deg)`, opacity: 0 },
    ], { duration: dur, delay, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards' })
    .onfinish = () => piece.remove();
  }
}

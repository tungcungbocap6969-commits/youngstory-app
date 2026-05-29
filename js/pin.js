'use strict';

const _WORKERS_CACHE = 'workers_cache';
function _cacheLoad() { try { return JSON.parse(localStorage.getItem(_WORKERS_CACHE)) || []; } catch (_) { return []; } }
function _cacheSave(list) { localStorage.setItem(_WORKERS_CACHE, JSON.stringify(list)); }
function _cacheAdd(worker) {
  const list = _cacheLoad();
  if (!list.find(w => w.id != null && w.id === worker.id)) {
    list.push(worker);
    _cacheSave(list);
  }
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Gradient pairs [from, to] cho avatar
const _GRADIENTS = [
  ['#22c55e','#15803d'], ['#3b82f6','#1d4ed8'], ['#a855f7','#7e22ce'],
  ['#ef4444','#b91c1c'], ['#f97316','#c2410c'], ['#06b6d4','#0e7490'],
  ['#ec4899','#be185d'], ['#84cc16','#4d7c0f'], ['#f59e0b','#b45309'], ['#14b8a6','#0f766e'],
];
function _gradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  const [c1, c2] = _GRADIENTS[h % _GRADIENTS.length];
  return `linear-gradient(135deg,${c1},${c2})`;
}
function _initial(name) { return String(name).trim()[0]?.toUpperCase() || '?'; }

// SVG helpers
const _CHEVRON = `<svg class="pac-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

function _iconSVG(type) {
  if (type === 'add')
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
  if (type === 'search')
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  if (type === 'back')
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
}

function _accountCard(worker) {
  return (
    `<div class="pac-item" data-id="${_esc(String(worker.id ?? ''))}">` +
      `<div class="pac-avatar" style="background:${_gradient(worker.name)}">${_esc(_initial(worker.name))}</div>` +
      `<div class="pac-info">` +
        `<div class="pac-name">${_esc(worker.name)}</div>` +
        (worker.team ? `<div class="pac-sub">${_esc(worker.team)}</div>` : '') +
      `</div>` +
      _CHEVRON +
    `</div>`
  );
}

function _iconCard(id, iconType, iconColor, title, sub, dashed) {
  return (
    `<div class="pac-item${dashed ? ' pac-add-item' : ''}" id="${id}">` +
      `<div class="pac-icon pac-icon-${iconColor}">${_iconSVG(iconType)}</div>` +
      `<div class="pac-info">` +
        `<div class="pac-name">${title}</div>` +
        (sub ? `<div class="pac-sub">${sub}</div>` : '') +
      `</div>` +
      _CHEVRON +
    `</div>`
  );
}

// ── Screen controller ──
(function () {
  const screen     = document.getElementById('pin-screen');
  if (!screen) return;

  const pickerEl   = document.getElementById('pin-picker');
  const entryEl    = document.getElementById('pin-entry');
  const regEl      = document.getElementById('pin-register');
  const subtitleEl = document.getElementById('pin-picker-subtitle');

  let mode         = 'picker';
  let digits       = '';
  let tempPin      = '';
  let localWorkers = _cacheLoad();
  let activeWorker = null;

  // ── Dots ──
  const ed = [0,1,2,3].map(i => document.getElementById('pd-'  + i));
  const rd = [0,1,2,3].map(i => document.getElementById('rpd-' + i));
  function activeDots() { return mode === 'entry' ? ed : rd; }
  function syncDots()   { activeDots().forEach((d, i) => d.classList.toggle('filled', i < digits.length)); }
  function reset()      { digits = ''; syncDots(); }

  function setErr(id, msg) { const e = document.getElementById(id); if (e) e.textContent = msg || ''; }
  function shake(id) {
    const e = document.getElementById(id);
    if (!e) return;
    e.classList.remove('pin-shake');
    void e.offsetWidth;
    e.classList.add('pin-shake');
    e.addEventListener('animationend', () => e.classList.remove('pin-shake'), { once: true });
  }

  function close() {
    screen.classList.add('pin-exit');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
  }

  function unlock(worker) {
    _cacheAdd(worker);
    localWorkers = _cacheLoad();
    window.currentWorker = worker;
    window.pinUpdateTeam = (team) => {
      worker.team = team;
      const list = _cacheLoad();
      const idx  = list.findIndex(w => w.id === worker.id);
      if (idx >= 0) { list[idx].team = team; _cacheSave(list); }
      if (worker.id) sb.updateWorker(worker.id, { team }).catch(() => {});
    };
    if (typeof unlockForm === 'function') unlockForm(worker.name, worker.team);
    close();
  }

  function setGrid(html) { document.getElementById('pin-picker-grid').innerHTML = html; }
  function setSub(txt)   { if (subtitleEl) subtitleEl.textContent = txt || ''; }

  function bindCards(container, workerList) {
    container.querySelectorAll('.pac-item[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const w = workerList.find(x => String(x.id) === card.dataset.id);
        if (w) showEntry(w);
      });
    });
  }

  // ── Màn hình chính ──
  function showLocalPicker() {
    pickerEl.classList.remove('hidden');
    entryEl.classList.add('hidden');
    regEl.classList.add('hidden');
    setSub('');

    const grid = document.getElementById('pin-picker-grid');

    if (localWorkers.length === 0) {
      grid.innerHTML =
        _iconCard('pin-opt-new',      'add',    'green', 'Tạo tài khoản mới',   'Đăng ký lần đầu sử dụng',          true) +
        _iconCard('pin-opt-existing', 'search', 'blue',  'Tôi đã có tài khoản', 'Tìm và đăng nhập tài khoản có sẵn', false);
      document.getElementById('pin-opt-new').addEventListener('click', showRegister);
      document.getElementById('pin-opt-existing').addEventListener('click', showSearch);
    } else {
      grid.innerHTML =
        localWorkers.map(_accountCard).join('') +
        _iconCard('pin-add-btn', 'add', 'green', 'Thêm tài khoản', 'Đăng nhập hoặc tạo mới', true);
      bindCards(grid, localWorkers);
      document.getElementById('pin-add-btn').addEventListener('click', showAddOptions);
    }
  }

  // ── Màn hình thêm tài khoản ──
  function showAddOptions() {
    setSub('Thêm tài khoản vào thiết bị này');
    setGrid(
      _iconCard('pin-opt-back',     'back',   'muted', 'Quay lại',            '',                                   false) +
      _iconCard('pin-opt-new',      'add',    'green', 'Tạo tài khoản mới',   'Đăng ký lần đầu sử dụng',            true) +
      _iconCard('pin-opt-existing', 'search', 'blue',  'Tôi đã có tài khoản', 'Tìm và đăng nhập tài khoản có sẵn',  false)
    );
    document.getElementById('pin-opt-back').addEventListener('click', showLocalPicker);
    document.getElementById('pin-opt-new').addEventListener('click', showRegister);
    document.getElementById('pin-opt-existing').addEventListener('click', showSearch);
  }

  // ── Màn hình tìm kiếm ──
  function showSearch() {
    setSub('Nhập tên để tìm tài khoản');
    setGrid(
      `<input type="text" id="pac-search-input" class="pac-search-input"` +
        ` placeholder="Nhập họ và tên..." autocomplete="off" autocorrect="off" spellcheck="false">` +
      `<div id="pac-search-results"></div>` +
      _iconCard('pac-search-back', 'back', 'muted', 'Quay lại', '', false)
    );

    const input = document.getElementById('pac-search-input');
    setTimeout(() => input.focus(), 80);

    document.getElementById('pac-search-back').addEventListener('click', () => {
      localWorkers.length > 0 ? showAddOptions() : showLocalPicker();
    });

    let _timer = null;
    input.addEventListener('input', () => {
      clearTimeout(_timer);
      const q = input.value.trim();
      const res = document.getElementById('pac-search-results');
      if (q.length < 2) { if (res) res.innerHTML = ''; return; }
      if (res) res.innerHTML = '<div class="pin-picker-loading">Đang tìm...</div>';
      _timer = setTimeout(() => doSearch(q), 350);
    });
  }

  async function doSearch(query) {
    const res = document.getElementById('pac-search-results');
    if (!res) return;
    try {
      const workers = await sb.searchWorkers(query);
      if (!workers.length) {
        res.innerHTML = '<div class="pin-picker-loading">Không tìm thấy tài khoản nào</div>';
        return;
      }
      res.innerHTML = workers.map(_accountCard).join('');
      bindCards(res, workers);
    } catch (_) {
      res.innerHTML = '<div class="pin-picker-loading">Lỗi kết nối — thử lại sau</div>';
    }
  }

  // ── PIN entry ──
  function showEntry(worker) {
    activeWorker = worker;
    mode = 'entry';
    reset();
    setErr('pin-error');

    const nameEl   = document.getElementById('pin-entry-name');
    const avatarEl = document.getElementById('pin-entry-avatar');
    if (nameEl)   nameEl.textContent       = worker.name;
    if (avatarEl) {
      avatarEl.textContent      = _initial(worker.name);
      avatarEl.style.background = _gradient(worker.name);
    }

    pickerEl.classList.add('hidden');
    entryEl.classList.remove('hidden');
  }

  // ── Đăng ký ──
  function showRegister() {
    mode = 'reg-set';
    reset();
    setErr('reg-error');
    document.getElementById('reg-pin-label').textContent = 'Đặt mã PIN (4 số)';
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-team-val').value = '';
    regEl.querySelectorAll('.team-chip-btn').forEach(b => b.classList.remove('selected'));
    pickerEl.classList.add('hidden');
    regEl.classList.remove('hidden');
  }

  // ── Entry handler ──
  function handleEntry() {
    if (digits === String(activeWorker.pin)) {
      setErr('pin-error');
      unlock(activeWorker);
    } else {
      shake('pin-dots-entry');
      setErr('pin-error', 'Mã PIN không đúng');
      setTimeout(() => { reset(); setErr('pin-error'); }, 1300);
    }
  }

  // ── Register handler ──
  function handleReg() {
    if (mode === 'reg-set') {
      const name = document.getElementById('reg-name').value.trim();
      const team = document.getElementById('reg-team-val').value;
      if (!name) { reset(); setErr('reg-error', 'Vui lòng nhập họ tên'); return; }
      if (!team) { reset(); setErr('reg-error', 'Vui lòng chọn tổ sản xuất'); return; }
      tempPin = digits;
      mode    = 'reg-confirm';
      reset();
      document.getElementById('reg-pin-label').textContent = 'Nhập lại PIN để xác nhận';
      setErr('reg-error');
    } else {
      if (digits === tempPin) {
        const name = document.getElementById('reg-name').value.trim();
        const team = document.getElementById('reg-team-val').value;
        doRegister(name, team, tempPin);
      } else {
        shake('pin-dots-reg');
        setErr('reg-error', 'PIN không khớp — nhập lại từ đầu');
        setTimeout(() => {
          mode = 'reg-set';
          reset();
          document.getElementById('reg-pin-label').textContent = 'Đặt mã PIN (4 số)';
          setErr('reg-error');
        }, 1300);
      }
    }
  }

  function capitalizeName(str) {
    return str.trim().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  }

  async function doRegister(name, team, pin) {
    const normalizedName = capitalizeName(name);
    try {
      const existing = await sb.searchWorkers(normalizedName);
      const dup = existing.find(w => w.name.toLowerCase() === normalizedName.toLowerCase());
      if (dup) {
        mode = 'reg-set';
        reset();
        document.getElementById('reg-pin-label').textContent = 'Đặt mã PIN (4 số)';
        setErr('reg-error', 'Tên này đã có tài khoản. Hãy chọn "Tôi đã có tài khoản" để đăng nhập.');
        return;
      }
    } catch (_) {}

    let saved;
    try {
      saved = await sb.addWorker({ name: normalizedName, team, pin });
    } catch (_) {
      saved = { id: null, name: normalizedName, team, pin };
    }
    unlock(saved);
  }

  // ── Key press ──
  function press(k) {
    if (k === 'del') { digits = digits.slice(0, -1); syncDots(); return; }
    if (digits.length >= 4) return;
    digits += k;
    syncDots();
    if (digits.length === 4) {
      setTimeout(() => mode === 'entry' ? handleEntry() : handleReg(), 80);
    }
  }

  function buildPad(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '1 2 3 4 5 6 7 8 9 _ 0 del'.split(' ').map(k =>
      k === '_'
        ? '<div></div>'
        : `<button class="pin-key${k === 'del' ? ' pin-key-del' : ''}" data-k="${k}">${k === 'del' ? '⌫' : k}</button>`
    ).join('');
  }
  buildPad('pin-numpad-entry');
  buildPad('pin-numpad-reg');

  screen.addEventListener('click', e => {
    const btn = e.target.closest('[data-k]');
    if (btn) press(btn.dataset.k);
  });

  document.getElementById('pin-back-entry')?.addEventListener('click', () => {
    mode = 'picker';
    reset();
    entryEl.classList.add('hidden');
    pickerEl.classList.remove('hidden');
    showLocalPicker();
    setErr('pin-error');
  });

  document.getElementById('pin-back-btn')?.addEventListener('click', () => {
    mode = 'picker';
    reset();
    regEl.classList.add('hidden');
    pickerEl.classList.remove('hidden');
    showLocalPicker();
    setErr('reg-error');
  });

  // ── Auto-capitalize tên ──
  document.getElementById('reg-name')?.addEventListener('blur', function () {
    this.value = this.value.trim().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  });

  // ── Team chips ──
  const rtwrap = document.getElementById('reg-teams');
  TEAMS.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'team-chip-btn'; btn.textContent = t;
    btn.addEventListener('click', () => {
      document.getElementById('reg-team-val').value = t;
      rtwrap.querySelectorAll('.team-chip-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      setErr('reg-error');
    });
    rtwrap.appendChild(btn);
  });

  // ── Clock ──
  const clkEl = document.getElementById('pin-clock');
  if (clkEl) {
    clkEl.textContent = mskTimeStr();
    setInterval(() => { clkEl.textContent = mskTimeStr(); }, 1000);
  }

  // ── Init ──
  showLocalPicker();
}());

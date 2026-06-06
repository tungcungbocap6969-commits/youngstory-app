'use strict';

// ── Team chip picker ──
let _selectedTeam = '';
const _teamChipsEl = document.getElementById('team-chips');

TEAMS.forEach(t => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'team-chip-btn';
  btn.textContent = t;
  btn.addEventListener('click', () => {
    _selectedTeam = t;
    _teamChipsEl.querySelectorAll('.team-chip-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    localStorage.setItem('selectedTeam', t);
    mainDD.updateList(getNumberedProcessList(t));
    mainDD.clear();
    _showCityField(t === 'Đóng gói');
    if (window.pinUpdateTeam) window.pinUpdateTeam(t);
    setTimeout(() => {
      const el = document.getElementById('f-process');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }, 150);
  });
  _teamChipsEl.appendChild(btn);
});

const teamDD = {
  get: () => _selectedTeam,
  set: (val) => {
    _selectedTeam = val;
    _teamChipsEl.querySelectorAll('.team-chip-btn').forEach(b => {
      b.classList.toggle('selected', b.textContent === val);
    });
  },
};

// ── Khởi tạo dropdown Công đoạn (main form) ──
const mainDD = makeDropdownFrom(
  PROCESSES_DEFAULT,
  document.getElementById('f-process'),
  document.getElementById('dd-main'),
  null,
  () => document.getElementById('f-qty').focus(),
  true // inlineMode
);

// ── Dropdown Tổ (edit modal) ──
const editTeamDD = makeDropdownFrom(
  TEAMS,
  document.getElementById('e-team'),
  document.getElementById('dd-edit-team'),
  null,
  (team) => editDD.updateList(getProcessList(team)),
  true // inlineMode
);

// ── Dropdown Công đoạn (edit modal) ──
const editDD = makeDropdownFrom(
  PROCESSES_DEFAULT,
  document.getElementById('e-process'),
  document.getElementById('dd-edit'),
  document.getElementById('e-chip-wrap'),
  null
);

// ── City chips (chỉ hiện cho Đóng gói) ──
let _selectedCity = '';
const _fieldCity = document.getElementById('field-city');
const _cityChips = document.querySelectorAll('#city-chips .team-chip-btn');

_cityChips.forEach(btn => {
  btn.addEventListener('click', () => {
    _selectedCity = btn.dataset.city;
    _cityChips.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

function _showCityField(show) {
  _fieldCity.classList.toggle('hidden', !show);
  if (!show) {
    _selectedCity = '';
    _cityChips.forEach(b => b.classList.remove('selected'));
  }
}

// ── Persistence: tên và tổ ──
const nameInput = document.getElementById('f-name');
nameInput.value = localStorage.getItem('workerName') || '';
nameInput.addEventListener('blur', () => {
  const v = nameInput.value.trim();
  if (v) localStorage.setItem('workerName', v);
});

const savedTeam = localStorage.getItem('selectedTeam');
if (savedTeam) {
  teamDD.set(savedTeam);
  mainDD.updateList(getNumberedProcessList(savedTeam));
}

// ── PIN: unlock form sau khi xác thực ──
window.unlockForm = function (name, team) {
  nameInput.value    = name;
  nameInput.readOnly = true;
  nameInput.classList.add('name-locked');
  localStorage.setItem('workerName', name);

  if (team) {
    teamDD.set(team);
    mainDD.updateList(getNumberedProcessList(team));
    localStorage.setItem('selectedTeam', team);
    _showCityField(team === 'Đóng gói');
  }

  const switchBtn = document.getElementById('pin-switch-user');
  if (switchBtn) switchBtn.style.display = 'block';
};

// ══ HÀNG ĐỢI GỬI LẠI (Hướng B) ══
// Báo cáo được lưu LOCAL ngay khi bấm (trạng thái "đang chờ" = chưa có sbId).
// Hàm dưới gửi lên server, CHỈ khi server xác nhận mới gắn sbId (= đã gửi thành công).
// Mạng chập chờn → giữ "đang chờ" và tự động thử lại → công nhân chỉ bấm 1 lần.

const _sending = new Set(); // chống gửi trùng cùng lúc cùng 1 record

async function sendRecord(localId, interactive = true) {
  if (_sending.has(localId)) return false;
  _sending.add(localId);
  try {
    const rec = await dbGetById(localId);
    if (!rec || rec.sbId) return true; // đã xác nhận hoặc đã xóa

    // Idempotent: nếu server ĐÃ có (lần trước lọt nhưng mất phản hồi) → lấy lại id, KHÔNG tạo trùng.
    let landed;
    try { landed = await sb.findRecent(rec.workerName, rec.process, rec.quantity); }
    catch (_) { return false; } // mạng lỗi → giữ "đang chờ", thử lại sau

    let sbId;
    if (landed) {
      sbId = landed.id;
    } else {
      let sbRow;
      try {
        sbRow = await sb.insert({
          worker_name: rec.workerName.replace(/(?:^|\s)\S/g, c => c.toUpperCase()),
          team:        rec.team,
          process:     rec.process,
          quantity:    rec.quantity,
          date:        rec.date,
          timestamp:   rec.timestamp,
        });
      } catch (_) { return false; } // mạng lỗi → thử lại sau
      sbId = sbRow.id;
    }

    const fresh = await dbGetById(localId);
    if (fresh && !fresh.sbId) {
      await dbPut({ ...fresh, sbId }); // gắn sbId = ĐÃ XÁC NHẬN trên server
      if (interactive) { confetti(); toast('✓ Đã gửi báo cáo thành công! 🎉'); }
      loadToday();
    }
    return true;
  } finally {
    _sending.delete(localId);
  }
}

// Thử gửi lại tất cả báo cáo còn "đang chờ" (định kỳ + khi có mạng lại + khi mở app)
async function retryPending() {
  try {
    const pending = (await dbGetAll()).filter(r => !r.sbId);
    if (!pending.length) return;
    let ok = 0;
    for (const r of pending) {
      if (await sendRecord(r.id, false)) {
        const after = await dbGetById(r.id);
        if (after && after.sbId) ok++;
      }
    }
    if (ok > 0) { toast(`✓ Đã gửi ${ok} báo cáo còn chờ.`); loadToday(); }
  } catch (_) {}
}

setInterval(retryPending, 20000);              // mỗi 20s thử lại các báo cáo còn chờ
window.addEventListener('online', retryPending); // khi có mạng trở lại
setTimeout(retryPending, 3000);                // khi mở app

// Background Sync: nhờ trình duyệt gửi báo cáo còn chờ NGAY CẢ KHI app đã đóng (Android/Chrome).
// iPhone/Safari không hỗ trợ → vẫn dựa vào retry khi mở app ở trên.
function requestBgSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(reg => reg.sync.register('send-reports'))
      .catch(() => {});
  }
}
requestBgSync();

// SW đồng bộ nền xong → làm mới danh sách nếu app đang mở
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'REPORTS_SYNCED') loadToday();
  });
}

// C: Quantity bounce
document.getElementById('f-qty').addEventListener('input', function () {
  this.classList.remove('qty-bounce');
  void this.offsetWidth;
  this.classList.add('qty-bounce');
});

// ── Submit (Hướng B): lưu local NGAY rồi gửi ngầm, ấn 1 lần là xong ──
let _submitting = false;
btnSubmit.addEventListener('click', async () => {
  if (_submitting) return;
  _submitting = true;
  try {
    const worker  = nameInput.value.trim();
    const team    = teamDD.get();
    const process = mainDD.get().replace(/^\d+\.\s*/, ''); // bỏ "1. " trước khi lưu
    const qty     = parseInt(document.getElementById('f-qty').value, 10);

    if (!worker)        { toast('Vui lòng nhập họ tên'); return; }
    if (!team)          { toast('Vui lòng chọn tổ sản xuất'); return; }
    if (!process)       { toast('Vui lòng chọn công đoạn'); return; }
    if (team === 'Đóng gói' && !_selectedCity) { toast('Vui lòng chọn thành phố'); return; }
    if (!qty || qty < 1) { toast('Vui lòng nhập sản lượng hợp lệ'); return; }

    const fullProcess = team === 'Đóng gói' ? `${process} · ${_selectedCity}` : process;
    localStorage.setItem('workerName', worker);

    // Chống trùng NGAY trên máy (cùng tên+công đoạn+sản lượng trong 2 giờ) — phản hồi tức thì, không cần mạng.
    const now = Date.now();
    const dup = (await dbGetByDate(mskDateStr())).find(r =>
      r.workerName === worker && r.process === fullProcess && r.quantity === qty &&
      (now - (r.createdAt || new Date(r.timestamp).getTime())) < 2 * 60 * 60 * 1000);
    if (dup) {
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      toast(dup.sbId ? '⚠ Bạn đã báo cáo công đoạn này rồi.' : '⏳ Báo cáo này đang chờ gửi, không cần bấm lại.');
      return;
    }

    // D: Ripple effect
    const ripple  = document.createElement('span');
    ripple.className = 'ripple';
    const btnRect = btnSubmit.getBoundingClientRect();
    const size    = Math.max(btnRect.width, btnRect.height);
    ripple.style.cssText =
      `width:${size}px;height:${size}px;` +
      `left:${btnRect.width / 2 - size / 2}px;` +
      `top:${btnRect.height / 2 - size / 2}px`;
    btnSubmit.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);

    // LƯU LOCAL NGAY (vào hàng đợi, chưa có sbId = "đang chờ gửi") → bấm 1 lần là xong, không chờ mạng.
    const localId = await dbAdd({
      workerName: worker,
      team,
      process:   fullProcess,
      quantity:  qty,
      date:      mskDateStr(),
      timestamp: new Date().toISOString(),
      createdAt: now,
    });

    if (navigator.vibrate) navigator.vibrate(30);
    toast('⏳ Đã ghi nhận, đang gửi lên hệ thống…');
    mainDD.clear();
    document.getElementById('f-qty').value = '';
    loadToday();          // hiện ngay card "đang chờ ⏳"

    sendRecord(localId);  // gửi ngầm: tự xác nhận ✓ hoặc tự thử lại nếu mạng chập chờn
    requestBgSync();      // nhờ trình duyệt gửi tiếp kể cả khi app bị đóng
  } finally {
    _submitting = false;
  }
});

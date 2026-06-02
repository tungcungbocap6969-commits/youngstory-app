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

// ── Retry sync các record chưa lên Supabase (chưa có sbId) ──
async function retrySyncUnsynced() {
  try {
    const all = await dbGetAll();
    const unsynced = all.filter(r => !r.sbId);
    if (!unsynced.length) return;

    let ok = 0;
    for (const r of unsynced) {
      try {
        const sbRow = await sb.insert({
          worker_name: r.workerName,
          team:        r.team,
          process:     r.process,
          quantity:    r.quantity,
          date:        r.date,
          timestamp:   r.timestamp,
        });
        await dbPut({ ...r, sbId: sbRow.id });
        ok++;
      } catch (_) { /* thử lại lần sau */ }
    }
    if (ok > 0) toast(`Đã đồng bộ ${ok} báo cáo còn tồn đọng lên server.`);
  } catch (_) {}
}

// Retry khi mở trang (sau 3 giây để tránh tranh chấp với load ban đầu)
setTimeout(retrySyncUnsynced, 3000);

// C: Quantity bounce
document.getElementById('f-qty').addEventListener('input', function () {
  this.classList.remove('qty-bounce');
  void this.offsetWidth;
  this.classList.add('qty-bounce');
});

// ── Submit ──
let _submitting = false;
btnSubmit.addEventListener('click', async () => {
  if (_submitting) return;
  _submitting = true;
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

  const record = {
    workerName: worker,
    team,
    process: fullProcess,
    quantity: qty,
    date:      mskDateStr(),
    timestamp: new Date().toISOString(),
  };

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

  const submitErrorEl = document.getElementById('submit-error');
  submitErrorEl.classList.add('hidden');
  btnSubmit.classList.remove('error');
  btnSubmit.disabled = true;

  try {
    // Kiểm tra trùng lặp trước khi gửi
    const isDup = await sb.checkDuplicate(worker, fullProcess, qty);
    if (isDup) {
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      btnSubmit.classList.add('error');
      void btnSubmit.offsetWidth;
      btnSubmit.classList.add('shake');
      btnSubmit.addEventListener('animationend', () => btnSubmit.classList.remove('shake'), { once: true });
      submitErrorEl.textContent = '⚠ Bạn đã báo cáo công đoạn này hôm nay rồi.';
      submitErrorEl.classList.remove('hidden');
      setTimeout(() => {
        btnSubmit.classList.remove('error');
        submitErrorEl.classList.add('hidden');
      }, 4000);
      return;
    }

    // Gửi Supabase trước — nếu mất mạng sẽ throw ở đây
    const sbRow = await sb.insert({
      worker_name: record.workerName.replace(/(?:^|\s)\S/g, c => c.toUpperCase()),
      team:        record.team,
      process:     record.process,
      quantity:    record.quantity,
      date:        record.date,
      timestamp:   record.timestamp,
    });

    // Supabase thành công → lưu local kèm sbId
    const localId = await dbAdd({ ...record, sbId: sbRow.id });

    confetti(); // E
    toast('Đã gửi báo cáo thành công! 🎉');
    mainDD.clear();
    document.getElementById('f-qty').value = '';
    loadToday();
  } catch (e) {
    console.error(e);
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    btnSubmit.classList.add('error');
    void btnSubmit.offsetWidth; // reset animation
    btnSubmit.classList.add('shake');
    btnSubmit.addEventListener('animationend', () => btnSubmit.classList.remove('shake'), { once: true });
    submitErrorEl.textContent = '⚠ Không có kết nối mạng. Vui lòng thử lại.';
    submitErrorEl.classList.remove('hidden');
    setTimeout(() => {
      btnSubmit.classList.remove('error');
      submitErrorEl.classList.add('hidden');
    }, 4000);
  } finally {
    btnSubmit.disabled = false;
    _submitting = false;
  }
});

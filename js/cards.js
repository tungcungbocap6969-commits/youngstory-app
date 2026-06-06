'use strict';

const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 phút

function isEditable(r) {
  return (Date.now() - new Date(r.timestamp).getTime()) < EDIT_WINDOW_MS;
}

function remainingMs(r) {
  return Math.max(0, EDIT_WINDOW_MS - (Date.now() - new Date(r.timestamp).getTime()));
}

function fmtRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad(m)}:${pad(s)}`;
}

function renderCard(r, container, delay = 0) {
  const div        = document.createElement('div');
  div.dataset.id   = r.id;
  div.style.animationDelay = delay + 'ms'; // F: staggered slide-in

  const pending  = !r.sbId;                 // chưa có sbId = chưa xác nhận trên server → "đang chờ gửi"
  div.className  = 'rcard' + (pending ? ' rcard-pending' : '');

  const editable = !pending && isEditable(r);
  const remMs    = pending ? 0 : remainingMs(r);
  const urgent   = remMs < 5 * 60 * 1000;
  const pct      = Math.round((remMs / EDIT_WINDOW_MS) * 100);
  const barColor = pct > 40 ? 'var(--green)' : pct > 15 ? 'var(--amber)' : 'var(--red)';

  const actionsHtml = pending
    ? `<div class="rc-pending"><span class="rc-pending-ico">⏳</span> Đang gửi lên hệ thống…</div>`
    : editable
    ? `<div class="rc-timer">
         <div class="rc-timer-btns">
           <button class="btn-sm" onclick="openEdit(${r.id})">Chỉnh sửa</button>
           <button class="btn-sm danger" onclick="delReport(${r.id})">Xóa</button>
         </div>
         <span class="rc-countdown${urgent ? ' urgent' : ''}" data-ts="${r.timestamp}">
           ${fmtRemaining(remMs)}
         </span>
       </div>
       <div class="rc-progress-bar">
         <div class="rc-progress-fill" data-ts="${r.timestamp}"
           style="width:${pct}%;background:${barColor}"></div>
       </div>`
    : `<div class="rc-locked">
         <span class="rc-locked-icon">🔒</span>
         <span>Đã chốt — không thể chỉnh sửa</span>
       </div>`;

  div.innerHTML = `
    <div class="rc-worker">${esc(r.workerName)}${r.team
      ? ' · <span style="color:var(--green);font-size:0.7rem">' + esc(r.team) + '</span>'
      : ''}</div>
    <div class="rc-qty" data-target="${r.quantity}">0</div>
    <div class="rc-process">${esc(r.process)}</div>
    <div class="rc-time">${tsToMSK(r.timestamp)}</div>
    ${actionsHtml}
  `;
  container.appendChild(div);

  // G: count-up quantity
  countUp(div.querySelector('.rc-qty'), r.quantity, 600 + delay);
}

// Cập nhật đồng hồ đếm ngược trên các card còn trong cửa sổ 30 phút
function tickCountdowns() {
  let needReload = false;

  document.querySelectorAll('.rc-countdown[data-ts]').forEach(el => {
    const rem = remainingMs({ timestamp: el.dataset.ts });
    if (rem <= 0) { needReload = true; return; }
    el.textContent = fmtRemaining(rem);
    el.className = 'rc-countdown' + (rem < 5 * 60 * 1000 ? ' urgent' : '');
  });

  // J: update progress bars
  document.querySelectorAll('.rc-progress-fill[data-ts]').forEach(el => {
    const rem = remainingMs({ timestamp: el.dataset.ts });
    const pct = Math.round((rem / EDIT_WINDOW_MS) * 100);
    el.style.width      = pct + '%';
    el.style.background = pct > 40 ? 'var(--green)' : pct > 15 ? 'var(--amber)' : 'var(--red)';
  });

  if (needReload) {
    loadToday();
    const histDate = document.getElementById('hist-date').value;
    if (histDate && currentTab === 'history') loadHistory(histDate);
  }
}

setInterval(tickCountdowns, 1000);

// ── Load báo cáo hôm nay ──
async function loadToday() {
  const recs = (await dbGetByDate(mskDateStr()))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const container = document.getElementById('today-cards');
  const badge     = document.getElementById('today-badge');
  const statsRow  = document.getElementById('stats-row');

  container.innerHTML = '';
  badge.textContent   = recs.length + ' bản ghi';

  if (recs.length === 0) {
    statsRow.classList.add('hidden');
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">Chưa có báo cáo nào hôm nay</div>
      </div>`;
    return;
  }

  statsRow.classList.remove('hidden');
  const total = recs.reduce((s, r) => s + r.quantity, 0);
  countUp(document.getElementById('stat-count'), recs.length, 400, false); // H
  countUp(document.getElementById('stat-total'), total, 600, true);        // H

  recs.forEach((r, i) => renderCard(r, container, i * 60)); // F: stagger
}

// ── Load lịch sử theo ngày ──
async function loadHistory(dateStr) {
  if (!dateStr) return;

  let recs;
  if (window.currentWorker) {
    try {
      const rows = await sb.getByWorkerDate(window.currentWorker.name, dateStr);
      // Supabase trả về worker_name (snake_case) → chuẩn hóa sang workerName
      recs = rows.map(r => ({ ...r, workerName: r.worker_name }));
    } catch (_) {
      recs = await dbGetByDate(dateStr);
    }
  } else {
    recs = await dbGetByDate(dateStr);
  }
  recs = recs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const container = document.getElementById('hist-cards');
  const badge     = document.getElementById('hist-badge');
  const statsEl   = document.getElementById('hist-stats');
  const titleEl   = document.getElementById('hist-sec-title');

  container.innerHTML = '';
  badge.textContent   = recs.length + ' bản ghi';

  const [y, m, d] = dateStr.split('-');
  titleEl.textContent = `Ngày ${d}/${m}/${y}`;

  if (recs.length === 0) {
    statsEl.classList.add('hidden');
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📅</div>
        <div class="empty-text">Không có báo cáo trong ngày này</div>
      </div>`;
    return;
  }

  statsEl.classList.remove('hidden');
  const htotal = recs.reduce((s, r) => s + r.quantity, 0);
  countUp(document.getElementById('hs-count'), recs.length, 400, false);
  countUp(document.getElementById('hs-total'), htotal, 600, true);

  recs.forEach((r, i) => renderCard(r, container, i * 60));
}

document.getElementById('hist-date').addEventListener('change', e => {
  loadHistory(e.target.value);
});

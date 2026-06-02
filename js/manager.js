'use strict';

// ── State ──
let currentTab  = 'today';
let _absentTeam = '';
let _todayRaw   = [];
let _histRaw    = [];
let _histRaw7   = [];
let _flowTeam   = '';
let _missTeam   = '';
let _chartFlow  = null;
let _chartTrend = null;
let _chartBar   = null;
let _cumulRaw   = [];
let _cumulTeam  = '';

// ── Clock (không dùng clock.js vì không có form-card) ──
(function () {
  const clockEl = document.getElementById('msk-clock');
  let _lastSec  = -1;
  function tick() {
    clockEl.textContent = mskTimeStr();
    const sec = mskNow().getUTCSeconds();
    if (sec !== _lastSec) {
      _lastSec = sec;
      clockEl.classList.remove('clock-glow');
      void clockEl.offsetWidth;
      clockEl.classList.add('clock-glow');
    }
  }
  setInterval(tick, 1000);
  tick();
}());

// ── Populate team selects từ config.js ──
['m-team-today', 'm-team-absent'].forEach(selId => {
  const sel = document.getElementById(selId);
  if (!sel) return;
  TEAMS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    sel.appendChild(opt);
  });
});

// ── Tab navigation ──
window.switchTab = function (tab) {
  currentTab = tab;

  ['today', 'absent', 'admin'].forEach(id => {
    document.getElementById('tab-' + id).classList.toggle('hidden', tab !== id);
    const nav = document.getElementById('nav-' + id);
    if (nav) nav.classList.toggle('active', tab === id);
  });

  const show = document.getElementById('tab-' + tab);
  show.classList.remove('tab-enter');
  void show.offsetWidth;
  show.classList.add('tab-enter');

  if (tab === 'today') {
    loadToday();
  } else if (tab === 'absent') {
    loadAbsent();
  } else if (tab === 'admin') {
    loadAdmin();
  }
};

// ── Helpers ──
function escH(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(iso) {
  const d  = new Date(new Date(iso).getTime() + MSK_OFFSET_MS);
  return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}

function applyFilter(records, teamSelId) {
  const team = document.getElementById(teamSelId).value;
  return team ? records.filter(r => r.team === team) : records;
}

// ── Load hôm nay (hoặc ngày được chọn) ──
async function loadToday() {
  const dateInput = document.getElementById('m-date-today');
  const date = dateInput.value || mskDateStr();
  if (!dateInput.value) dateInput.value = mskDateStr();

  const errEl  = document.getElementById('m-error-today');
  const loadEl = document.getElementById('m-loading-today');
  errEl.style.display  = 'none';
  loadEl.style.display = 'block';

  try {
    _todayRaw = await sb.getByDate(date);
    renderToday();
  } catch (e) {
    errEl.textContent   = 'Lỗi tải dữ liệu: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    loadEl.style.display = 'none';
  }
}
window.loadToday = loadToday;

const _ADMIN_TEAMS = new Set(['Tổ cắt', 'Đóng gói', 'Kiểm hàng']);

function renderToday() {
  const nonAdmin = _todayRaw.filter(r => !_ADMIN_TEAMS.has(r.team));
  const records  = applyFilter(nonAdmin, 'm-team-today');
  const statsEl  = document.getElementById('m-stats-today');

  if (nonAdmin.length) statsEl.classList.remove('hidden');
  else statsEl.classList.add('hidden');

  renderStats(records, 'm-count-today', 'm-total-today', 'm-workers-today');
  renderFlowChart(nonAdmin, _flowTeam);
  renderWorkerCards(records);
  renderProcessCards(records);
}

// ── Load lịch sử ──
async function loadHistory() {
  const date  = document.getElementById('m-date').value;
  if (!date) return;

  const errEl  = document.getElementById('m-error-hist');
  const loadEl = document.getElementById('m-loading-hist');
  errEl.style.display  = 'none';
  loadEl.style.display = 'block';

  // 7 ngày kết thúc tại date
  const end   = new Date(date + 'T00:00:00Z');
  const from  = new Date(end.getTime() - 6 * 86400000).toISOString().slice(0, 10);

  try {
    [_histRaw, _histRaw7] = await Promise.all([
      sb.getByDate(date),
      sb.getRange(from, date),
    ]);
    renderHistory(date);
  } catch (e) {
    errEl.textContent   = 'Lỗi tải dữ liệu: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    loadEl.style.display = 'none';
  }
}
window.loadHistory = loadHistory;

function renderHistory(date) {
  const statsEl  = document.getElementById('m-stats-hist');
  const noticeEl = document.getElementById('m-notice-hist');

  if (_histRaw.length) {
    statsEl.classList.remove('hidden');
    noticeEl.style.display = 'flex';
  } else {
    statsEl.classList.add('hidden');
    noticeEl.style.display = 'none';
  }

  renderStats(_histRaw, 'm-count-hist', 'm-total-hist', 'm-workers-hist');

  const [d, m, y] = [date.slice(8), date.slice(5,7), date.slice(0,4)];
  document.getElementById('m-lb-date').textContent = d + '/' + m + '/' + y;

  renderLeaderboard(_histRaw);
  renderMissingProcs(_histRaw7, _missTeam);

  const hasData   = _histRaw.length > 0;
  const trendCard = document.getElementById('m-trend-card');
  const barCard   = document.getElementById('m-bar-card');

  if (trendCard) trendCard.style.display = hasData ? '' : 'none';
  if (hasData) loadTrend(date);

  if (barCard) barCard.style.display = hasData ? '' : 'none';
  if (hasData) {
    if (_chartBar) { _chartBar.destroy(); _chartBar = null; }
    _chartBar = renderBarChart('chart-bar', _histRaw);
  }
}

// ── Render helpers ──
function renderStats(records, countId, totalId, workersId) {
  document.getElementById(countId).textContent   = records.length;
  document.getElementById(totalId).textContent   = records.reduce((s,r)=>s+r.quantity,0).toLocaleString('vi-VN');
  document.getElementById(workersId).textContent = new Set(records.map(r=>r.worker_name)).size;
}

function renderTable(records, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="m-empty-cell">Không có báo cáo nào</td></tr>';
    return;
  }
  tbody.innerHTML = records.map((r, i) =>
    '<tr>' +
    '<td class="td-num">' + (i+1) + '</td>' +
    '<td>' + escH(r.worker_name) + '</td>' +
    '<td><span class="m-team-chip">' + escH(r.team) + '</span></td>' +
    '<td>' + escH(r.process) + '</td>' +
    '<td class="td-qty">' + r.quantity.toLocaleString('vi-VN') + '</td>' +
    '<td class="td-time">' + fmtTime(r.timestamp) + ' MSK</td>' +
    '</tr>'
  ).join('');
}

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: '#1f1f1f' } },
    y: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { color: '#1f1f1f' }, beginAtZero: true },
  },
};

function renderBarChart(canvasId, records) {
  const byTeam = {};
  TEAMS.forEach(t => { byTeam[t] = 0; });
  records.forEach(r => { byTeam[r.team] = (byTeam[r.team] || 0) + r.quantity; });

  const labels = TEAMS.filter(t => byTeam[t] > 0);
  const data   = labels.map(t => byTeam[t]);
  if (!labels.length) return null;

  return new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: 'rgba(34,197,94,0.3)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 6 }] },
    options: CHART_OPTS,
  });
}

async function loadTrend(refDate) {
  const dates = [];
  const base  = new Date(refDate + 'T00:00:00Z');
  for (let i = 6; i >= 0; i--) {
    dates.push(new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  try {
    const rows   = await sb.getRange(dates[0], dates[6]);
    const byDate = {};
    dates.forEach(d => { byDate[d] = 0; });
    rows.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + r.quantity; });

    if (_chartTrend) { _chartTrend.destroy(); _chartTrend = null; }
    _chartTrend = new Chart(document.getElementById('chart-trend').getContext('2d'), {
      type: 'line',
      data: {
        labels: dates.map(d => { const p = d.split('-'); return +p[2] + '/' + +p[1]; }),
        datasets: [{
          data: dates.map(d => byDate[d] || 0),
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true, tension: 0.35,
          pointBackgroundColor: '#22c55e', pointRadius: 4, pointHoverRadius: 6,
        }],
      },
      options: CHART_OPTS,
    });
  } catch (e) {
    console.error('Trend:', e);
  }
}

// ── Biểu đồ công đoạn (flow chart) ──
function initFlowTeamChips() {
  const wrap = document.getElementById('m-flow-teams');
  const validTeams = TEAMS.filter(t => (PROCESSES_BY_TEAM[t] || []).length > 0);
  validTeams.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'm-flow-team-btn' + (i === 0 ? ' active' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.m-flow-team-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _flowTeam = t;
      renderFlowChart(_todayRaw, _flowTeam);
    });
    wrap.appendChild(btn);
  });
  _flowTeam = validTeams[0] || '';
}

function renderFlowChart(allRecords, teamVal) {
  const processes = PROCESSES_BY_TEAM[teamVal] || [];
  if (!processes.length) return;

  // Tính tổng sản lượng mỗi công đoạn
  const procMap = {};
  allRecords.forEach(r => {
    if (r.team === teamVal) {
      procMap[r.process] = (procMap[r.process] || 0) + (Number(r.quantity) || 0);
    }
  });

  const quantities = processes.map(p => procMap[p] || 0);
  const reported   = quantities.filter(v => v > 0);
  const avg        = reported.length
    ? Math.round(reported.reduce((a, b) => a + b, 0) / reported.length)
    : 0;
  const lowCut = avg * 0.5;

  const pointColors = quantities.map(v =>
    v === 0 ? '#ef4444' : v < lowCut ? '#f59e0b' : '#22c55e'
  );

  // 52px/công đoạn + 80px padding cho trục Y và lề phải của Chart.js
  const PX = 52;
  const W  = Math.max(processes.length * PX + 80, 360);
  const H  = 240;

  const canvas = document.getElementById('chart-flow');
  canvas.width        = W;
  canvas.height       = H;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  if (_chartFlow) { _chartFlow.destroy(); _chartFlow = null; }

  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    'rgba(34,197,94,0.32)');
  grad.addColorStop(0.55, 'rgba(245,158,11,0.10)');
  grad.addColorStop(1,    'rgba(239,68,68,0.02)');

  _chartFlow = new Chart(ctx, {
    type: 'line',
    data: {
      labels: processes.map((_, i) => i + 1),
      datasets: [
        {
          data: quantities,
          borderColor: '#22c55e',
          borderWidth: 1.6,
          backgroundColor: grad,
          fill: true,
          tension: 0.35,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointBorderWidth: 1,
        },
        {
          data: processes.map(() => avg),
          borderColor: 'rgba(255,255,255,0.18)',
          borderWidth: 1,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      layout: { padding: { right: 24, top: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          borderColor: '#2a2a2a',
          borderWidth: 1,
          titleColor: '#9ca3af',
          bodyColor: '#e5e7eb',
          padding: 10,
          callbacks: {
            title: items => '#' + (items[0].dataIndex + 1),
            label: item => {
              if (item.datasetIndex === 1) return 'TB: ' + avg.toLocaleString('vi-VN');
              const v    = item.raw;
              const name = processes[item.dataIndex];
              const flag = v === 0 ? ' 🔴 Chưa báo' : v < lowCut ? ' 🟡 Thấp' : ' 🟢 Đạt';
              return [name, 'Sản lượng: ' + v.toLocaleString('vi-VN') + flag];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#4b5563',
            font: { size: 9 },
            maxRotation: 0,
            autoSkip: false,
          },
          grid: { color: '#141414' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#4b5563', font: { size: 9 } },
          grid: { color: '#1a1a1a' },
        },
      },
    },
  });
}

// ── Worker cards (tab hôm nay) ──
function renderWorkerCards(records) {
  const container = document.getElementById('m-worker-cards');

  if (!records.length) {
    container.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Chưa có báo cáo nào hôm nay</div></div>';
    document.getElementById('m-badge-today').textContent = '0 công nhân';
    return;
  }

  // Gom theo tên công nhân
  const workerMap = {};
  records.forEach(r => {
    const key = r.worker_name || '(không rõ)';
    if (!workerMap[key]) workerMap[key] = { name: key, team: r.team, total: 0, items: [] };
    workerMap[key].total += Number(r.quantity) || 0;
    workerMap[key].items.push({ process: r.process, qty: Number(r.quantity) || 0 });
  });

  const workers = Object.values(workerMap).sort((a, b) => a.total - b.total);
  document.getElementById('m-badge-today').textContent = workers.length + ' công nhân';

  // Ngưỡng màu: 30% thấp nhất = amber, 30% cao nhất = green
  const lowCut  = workers[Math.floor(workers.length * 0.30)]?.total ?? Infinity;
  const highCut = workers[Math.floor(workers.length * 0.70)]?.total ?? 0;

  container.innerHTML = workers.map(w => {
    const colorClass = workers.length < 3 ? '' : w.total <= lowCut ? 'wcard-low' : w.total >= highCut ? 'wcard-high' : '';
    const itemsHtml = w.items.map(item =>
      `<div class="wcard-row">` +
        `<span class="wcard-proc">${escH(item.process)}</span>` +
        `<span class="wcard-row-qty">${item.qty.toLocaleString('vi-VN')}</span>` +
      `</div>`
    ).join('');
    return (
      `<div class="wcard ${colorClass}" onclick="toggleWorkerCard(this)">` +
        `<div class="wcard-head">` +
          `<div class="wcard-info">` +
            `<div class="wcard-name">${escH(w.name)}</div>` +
            `<span class="m-team-chip">${escH(w.team)}</span>` +
          `</div>` +
          `<div class="wcard-right">` +
            `<div>` +
              `<div class="wcard-total">${w.total.toLocaleString('vi-VN')}</div>` +
              `<div class="wcard-count">${w.items.length} công đoạn</div>` +
            `</div>` +
            `<div class="wcard-arrow">›</div>` +
          `</div>` +
        `</div>` +
        `<div class="wcard-body">${itemsHtml}</div>` +
      `</div>`
    );
  }).join('');
}

window.toggleWorkerCard = function (el) {
  el.classList.toggle('wcard-open');
};

function renderProcessCards(records) {
  const container = document.getElementById('m-proc-cards');
  const badgeEl   = document.getElementById('m-badge-proc');

  if (!records.length) {
    container.innerHTML = '';
    badgeEl.textContent = '0 công đoạn';
    return;
  }

  const procMap = {};
  records.forEach(r => {
    const key = r.process || '(không rõ)';
    if (!procMap[key]) procMap[key] = { name: key, team: r.team, total: 0, workers: [] };
    procMap[key].total += Number(r.quantity) || 0;
    procMap[key].workers.push({ name: r.worker_name || '(không rõ)', qty: Number(r.quantity) || 0 });
  });

  const procs = Object.values(procMap).sort((a, b) => b.total - a.total);
  badgeEl.textContent = procs.length + ' công đoạn';

  container.innerHTML = procs.map(p => {
    const workersHtml = p.workers
      .sort((a, b) => b.qty - a.qty)
      .map(w =>
        `<div class="wcard-row">` +
          `<span class="wcard-proc">${escH(w.name)}</span>` +
          `<span class="wcard-row-qty">${w.qty.toLocaleString('vi-VN')}</span>` +
        `</div>`
      ).join('');
    return (
      `<div class="pcard" onclick="toggleProcCard(this)">` +
        `<div class="wcard-head">` +
          `<div class="wcard-info">` +
            `<div class="wcard-name">${escH(p.name)}</div>` +
            `<span class="m-team-chip">${escH(p.team)}</span>` +
          `</div>` +
          `<div class="wcard-right">` +
            `<div>` +
              `<div class="wcard-total">${p.total.toLocaleString('vi-VN')}</div>` +
              `<div class="wcard-count">${p.workers.length} công nhân</div>` +
            `</div>` +
            `<div class="wcard-arrow">›</div>` +
          `</div>` +
        `</div>` +
        `<div class="wcard-body">${workersHtml}</div>` +
      `</div>`
    );
  }).join('');
}

window.toggleProcCard = function (el) {
  el.classList.toggle('wcard-open');
};

// ── Xếp hạng công nhân ──
function renderLeaderboard(records) {
  const el = document.getElementById('m-leaderboard');
  if (!records.length) {
    el.innerHTML = '<div class="m-miss-empty">Không có báo cáo nào trong ngày này</div>';
    return;
  }

  const map = {};
  records.forEach(r => {
    const k = r.worker_name || '(không rõ)';
    if (!map[k]) map[k] = { name: k, team: r.team, total: 0, count: 0 };
    map[k].total += Number(r.quantity) || 0;
    map[k].count++;
  });

  const sorted = Object.values(map).sort((a, b) => b.total - a.total);
  const medals = ['🥇', '🥈', '🥉'];

  el.innerHTML = sorted.map((w, i) => {
    const rankClass = i < 3 ? ' rank-' + (i + 1) : '';
    const rankEl    = i < 3 ? medals[i] : (i + 1);
    return (
      '<div class="m-lb-item' + rankClass + '">' +
        '<div class="m-lb-rank">' + rankEl + '</div>' +
        '<div class="m-lb-info">' +
          '<div class="m-lb-name">' + escH(w.name) + '</div>' +
          '<div class="m-lb-sub">' + escH(w.team) + ' · ' + w.count + ' công đoạn</div>' +
        '</div>' +
        '<div class="m-lb-qty">' + w.total.toLocaleString('vi-VN') + '</div>' +
      '</div>'
    );
  }).join('');
}

// ── Công đoạn thường xuyên hụt ──
function initMissTeamChips() {
  const wrap       = document.getElementById('m-miss-teams');
  const validTeams = TEAMS.filter(t => (PROCESSES_BY_TEAM[t] || []).length > 0);
  _missTeam        = validTeams[0] || '';

  validTeams.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className   = 'm-miss-team-btn' + (i === 0 ? ' active' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.m-miss-team-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _missTeam = t;
      renderMissingProcs(_histRaw7, _missTeam);
    });
    wrap.appendChild(btn);
  });
}

function renderMissingProcs(rows7, team) {
  const el        = document.getElementById('m-missing-procs');
  const processes = PROCESSES_BY_TEAM[team] || [];

  if (!processes.length) {
    el.innerHTML = '<div class="m-miss-empty">Chọn tổ để xem phân tích</div>';
    return;
  }

  // Đếm số ngày mỗi công đoạn được báo cáo (trong 7 ngày)
  const procDays = {};
  processes.forEach(p => { procDays[p] = new Set(); });
  rows7.forEach(r => {
    if (r.team === team && procDays[r.process] !== undefined) {
      procDays[r.process].add(r.date);
    }
  });

  // Lấy danh sách ngày thực tế có trong dữ liệu
  const allDates = new Set(rows7.map(r => r.date));
  const totalDays = Math.min(allDates.size, 7) || 1;

  // Lọc các công đoạn chưa đạt đủ ngày, sắp xếp từ ít ngày nhất
  const items = processes
    .map(p => ({ name: p, days: procDays[p].size }))
    .filter(x => x.days < totalDays)
    .sort((a, b) => a.days - b.days);

  if (!items.length) {
    el.innerHTML = '<div class="m-miss-empty">✅ Tất cả công đoạn đều báo cáo đủ trong ' + totalDays + ' ngày</div>';
    return;
  }

  el.innerHTML = '<div class="m-miss-list">' + items.map(x => {
    const ratio     = x.days / totalDays;
    const missClass = ratio === 0 ? 'miss-red' : ratio < 0.5 ? 'miss-amber' : 'miss-yellow';
    const label     = x.days + '/' + totalDays + ' ngày';
    return (
      '<div class="m-miss-item ' + missClass + '">' +
        '<span class="m-miss-name">' + escH(x.name) + '</span>' +
        '<span class="m-miss-badge">' + label + '</span>' +
      '</div>'
    );
  }).join('') + '</div>';
}

// ── Tab tích lũy ──
function initCumulTeamChips() {
  const wrap       = document.getElementById('m-cumul-teams');
  const validTeams = TEAMS.filter(t => (PROCESSES_BY_TEAM[t] || []).length > 0);
  _cumulTeam       = validTeams[0] || '';

  validTeams.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className   = 'm-flow-team-btn' + (i === 0 ? ' active' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.m-flow-team-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _cumulTeam = t;
      renderCumulative(_cumulTeam);
    });
    wrap.appendChild(btn);
  });
}

async function loadCumulative() {
  const from  = document.getElementById('m-from').value;
  const to    = document.getElementById('m-to').value;
  if (!from || !to) return;

  const errEl  = document.getElementById('m-error-cumul');
  const loadEl = document.getElementById('m-loading-cumul');
  errEl.style.display  = 'none';
  loadEl.style.display = 'block';

  try {
    _cumulRaw = await sb.getRange(from, to);
    renderCumulative(_cumulTeam);
  } catch (e) {
    errEl.textContent   = 'Lỗi tải dữ liệu: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    loadEl.style.display = 'none';
  }
}
window.loadCumulative = loadCumulative;

function renderCumulative(team) {
  const processes = PROCESSES_BY_TEAM[team] || [];
  if (!processes.length) return;

  const procMap = {};
  processes.forEach(p => { procMap[p] = 0; });
  _cumulRaw.forEach(r => {
    if (r.team === team && procMap[r.process] !== undefined) {
      procMap[r.process] += Number(r.quantity) || 0;
    }
  });

  const counts    = processes.map(p => procMap[p]);
  const maxCount  = Math.max(...counts, 1);
  const doneCount = counts.filter(v => v > 0).length;
  const missCount = counts.filter(v => v === 0).length;
  const totalQty  = counts.reduce((a, b) => a + b, 0);

  const statsEl = document.getElementById('m-stats-cumul');
  statsEl.classList.toggle('hidden', !_cumulRaw.length && !processes.length);
  statsEl.classList.remove('hidden');
  document.getElementById('m-cumul-done').textContent  = doneCount;
  document.getElementById('m-cumul-total').textContent = totalQty.toLocaleString('vi-VN');
  document.getElementById('m-cumul-miss').textContent  = missCount;

  const items = processes
    .map((p, i) => ({ name: p, qty: procMap[p], idx: i }))
    .sort((a, b) => a.qty - b.qty || a.idx - b.idx);

  const listEl = document.getElementById('m-cumul-list');
  listEl.innerHTML = items.map(item => {
    const pct  = item.qty / maxCount;
    const barW = Math.round(pct * 100);
    const cls  = item.qty === 0 ? 'cumul-zero' : 'cumul-has';
    const label = item.qty === 0
      ? 'Chưa báo cáo'
      : item.qty.toLocaleString('vi-VN') + ' SP';
    return (
      '<div class="cumul-item ' + cls + '">' +
        '<div class="cumul-head">' +
          '<span class="cumul-name">' + escH(item.name) + '</span>' +
          '<span class="cumul-count">' + label + '</span>' +
        '</div>' +
        (item.qty > 0
          ? '<div class="cumul-track"><div class="cumul-fill" style="width:' + barW + '%"></div></div>'
          : '') +
      '</div>'
    );
  }).join('');
}

// ── Tab Chưa báo cáo ──
async function loadAbsent() {
  const errEl  = document.getElementById('m-error-absent');
  const loadEl = document.getElementById('m-loading-absent');
  errEl.style.display  = 'none';
  loadEl.style.display = 'block';

  try {
    const [allWorkers, todayRecs] = await Promise.all([
      sb.getWorkers(),
      sb.getByDate(mskDateStr()),
    ]);
    renderAbsent(allWorkers, todayRecs);
  } catch (e) {
    errEl.textContent   = 'Lỗi tải dữ liệu: ' + e.message;
    errEl.style.display = 'block';
  } finally {
    loadEl.style.display = 'none';
  }
}
window.loadAbsent = loadAbsent;

function renderAbsent(allWorkers, todayRecs) {
  const teamSel = document.getElementById('m-team-absent').value;

  // So sánh không phân biệt hoa thường
  const reportedNames = new Set(todayRecs.map(r => r.worker_name?.toLowerCase().trim()));

  // Loại admin teams ra khỏi tab Vắng
  const nonAdminWorkers = allWorkers.filter(w => !_ADMIN_TEAMS.has(w.team));

  const absent = nonAdminWorkers.filter(w =>
    !reportedNames.has(w.name?.toLowerCase().trim()) &&
    (!teamSel || w.team === teamSel)
  );
  const total = teamSel
    ? nonAdminWorkers.filter(w => w.team === teamSel).length
    : nonAdminWorkers.length;
  const done   = total - absent.length;

  // Stats
  const statsEl = document.getElementById('m-stats-absent');
  statsEl.classList.remove('hidden');
  document.getElementById('m-absent-total').textContent = total;
  document.getElementById('m-absent-done').textContent  = done;
  document.getElementById('m-absent-miss').textContent  = absent.length;

  const badge = document.getElementById('m-absent-badge');
  badge.textContent = absent.length + ' người';

  const listEl = document.getElementById('m-absent-list');
  if (!absent.length) {
    listEl.innerHTML =
      '<div class="m-miss-empty">✅ Tất cả công nhân đã báo cáo hôm nay</div>';
    return;
  }

  // Nhóm theo tổ
  const byTeam = {};
  absent.forEach(w => {
    if (!byTeam[w.team]) byTeam[w.team] = [];
    byTeam[w.team].push(w.name);
  });

  listEl.innerHTML = Object.entries(byTeam).map(([team, names]) =>
    `<div class="absent-group">` +
      `<div class="absent-group-label">${escH(team)} <span class="absent-count">${names.length} người</span></div>` +
      names.map(n =>
        `<div class="absent-item">` +
          `<div class="absent-dot"></div>` +
          `<span class="absent-name">${escH(n)}</span>` +
        `</div>`
      ).join('') +
    `</div>`
  ).join('');
}

document.getElementById('m-team-absent')?.addEventListener('change', loadAbsent);

// ── Events ──
document.getElementById('m-team-today').addEventListener('change', renderToday);
document.getElementById('m-date-today').addEventListener('change', loadToday);

// ── Admin tab: Hành chính ──
let _adminTeam = 'cat';

document.getElementById('admin-team-chips').addEventListener('click', e => {
  const btn = e.target.closest('[data-admin-team]');
  if (!btn) return;
  _adminTeam = btn.dataset.adminTeam;
  document.querySelectorAll('[data-admin-team]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const ac = btn.querySelector('.admin-sel-icon')?.style.getPropertyValue('--ac');
  if (ac) btn.style.setProperty('--ac', ac);
  const groups = { cat: 'admin-group-cat', dong: 'admin-group-dong', kiem: 'admin-group-kiem' };
  Object.entries(groups).forEach(([key, id]) => {
    document.getElementById(id).style.display = (_adminTeam === key) ? '' : 'none';
  });
  loadAdmin();
});

// Set --ac trên từng card từ icon
document.querySelectorAll('[data-admin-team]').forEach(btn => {
  const ac = btn.querySelector('.admin-sel-icon')?.style.getPropertyValue('--ac');
  if (ac) btn.style.setProperty('--ac', ac);
});
function renderAdminBar(containerId, orders) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  wrap.innerHTML = orders.map(o => {
    const ratio = o.total > 0 ? o.done / o.total : 0;
    const over  = ratio > 1;
    const pct   = Math.min(100, Math.round(ratio * 100));
    const color = o.done === 0 ? 'zero'
                : over         ? 'red'
                : pct >= 75    ? 'green'
                : pct >= 50    ? 'amber'
                : pct >= 25    ? 'orange'
                :                'blue';
    const countText = over
      ? `⚠ ${o.done}/${o.total}`
      : `${o.done}/${o.total}`;
    return `
      <div class="admin-bar-wrap">
        <div class="admin-bar-label">${esc(o.label)}</div>
        <div class="admin-bar-track">
          <div class="admin-bar-fill ${color}" style="width:0%" data-target="${pct}"></div>
        </div>
        <div class="admin-bar-count ${color}">${countText}</div>
      </div>`;
  }).join('');

  // Tất cả bar chạy đồng loạt từ 0 → target
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.querySelectorAll('.admin-bar-fill[data-target]').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  }));
}

// Targets đơn hàng theo cỡ × thành phố
const _ORDER = {
  '46-2': [0,   20,  30],
  '46-3': [0,   80,  120],
  '46-4': [0,   40,  60],
  '48-2': [0,   20,  30],
  '48-3': [0,   120, 180],
  '48-4': [0,   400, 600],
  '48-5': [0,   60,  90],
  '50-3': [500, 160, 240],
  '50-4': [600, 520, 780],
  '50-5': [0,   120, 180],
  '50-6': [60,  0,   0],
  '52-3': [320, 80,  49],
  '52-4': [560, 260, 390],
  '52-5': [139, 39,  59],
  '52-6': [35,  0,   0],
  '54-3': [100, 20,  30],
  '54-4': [260, 40,  60],
  '54-5': [80,  20,  30],
  '54-6': [13,  0,   0],
};
const _SIZES = ['46-2','46-3','46-4','48-2','48-3','48-4','48-5',
                '50-3','50-4','50-5','50-6','52-3','52-4','52-5','52-6',
                '54-3','54-4','54-5','54-6'];

function _addDays(dateStr, n) {
  return new Date(new Date(dateStr + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
}

async function loadAdmin() {
  const date      = document.getElementById('m-date-today').value || mskDateStr();
  const yesterday = _addDays(date, -1);
  const weekAgo   = _addDays(date, -6);

  const [all, range7] = await Promise.all([
    sb.getByDate(date).catch(() => []),
    sb.getRange(weekAgo, date).catch(() => []),
  ]);

  const adminRecs   = all.filter(r => _ADMIN_TEAMS.has(r.team));
  const range7Admin = range7.filter(r => _ADMIN_TEAMS.has(r.team));

  // Tổng hợp theo process
  const sumBy = (team, procKey) => adminRecs
    .filter(r => r.team === team && r.process === procKey)
    .reduce((s, r) => s + (r.quantity || 0), 0);

  // Tổ cắt: 1 bar / cỡ, target = tổng 3 TP
  const CAT = _SIZES.map(sz => {
    const t = _ORDER[sz];
    const total = t[0] + t[1] + t[2];
    if (!total) return null;
    return { label: `Cỡ ${sz}`, done: sumBy('Tổ cắt', `Cỡ ${sz}`), total };
  }).filter(Boolean);

  // Kiểm hàng: giống Tổ cắt
  const KIEM = _SIZES.map(sz => {
    const t = _ORDER[sz];
    const total = t[0] + t[1] + t[2];
    if (!total) return null;
    return { label: `Cỡ ${sz}`, done: sumBy('Kiểm hàng', `Cỡ ${sz}`), total };
  }).filter(Boolean);

  // Đóng gói: bar theo cỡ × TP (chỉ khi target > 0)
  const TP = ['TP1','TP2','TP3'];
  const DONG = [];
  TP.forEach((tp, i) => {
    _SIZES.forEach(sz => {
      const total = _ORDER[sz][i];
      if (!total) return;
      DONG.push({ label: `Cỡ ${sz} · ${tp}`, done: sumBy('Đóng gói', `Cỡ ${sz} · ${tp}`), total });
    });
  });

  renderAdminBar('admin-bars-cat',  CAT);
  renderAdminBar('admin-bars-dong', DONG);
  renderAdminBar('admin-bars-kiem', KIEM);

  // Tính stats theo tổ đang chọn
  const teamMap = { cat: 'Tổ cắt', dong: 'Đóng gói', kiem: 'Kiểm hàng' };
  const teamKey  = _adminTeam === 'all' ? null : teamMap[_adminTeam];

  function calcStats(team) {
    const teamRecs7   = range7Admin.filter(r => r.team === team);
    const teamToday   = adminRecs.filter(r => r.team === team);
    const teamYest    = range7Admin.filter(r => r.team === team && r.date === yesterday);

    const todayTotal = teamToday.reduce((s, r) => s + (r.quantity || 0), 0);
    const yestTotal  = teamYest.reduce((s, r) => s + (r.quantity || 0), 0);

    // TB/ngày từ 7 ngày
    const byDate = {};
    teamRecs7.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + (r.quantity || 0); });
    const activeDays = Object.keys(byDate).length || 1;
    const avg = Math.round(Object.values(byDate).reduce((s, v) => s + v, 0) / activeDays);

    // Tổng target của team
    const totalTarget = _SIZES.reduce((s, sz) => {
      const t = _ORDER[sz];
      return s + (team === 'Đóng gói' ? t[0] + t[1] + t[2] : t[0] + t[1] + t[2]);
    }, 0);

    // Tổng đã làm (7 ngày, xấp xỉ)
    const totalDone7 = Object.values(byDate).reduce((s, v) => s + v, 0);
    const remaining  = Math.max(0, totalTarget - totalDone7);
    const daysLeft   = avg > 0 ? Math.ceil(remaining / avg) : null;
    const etaDate    = daysLeft !== null ? _addDays(date, daysLeft) : null;

    return { todayTotal, yestTotal, avg, daysLeft, etaDate };
  }

  function renderAdminStats(team) {
    const s = calcStats(team);
    const delta = s.todayTotal - s.yestTotal;
    const sign  = delta >= 0 ? '+' : '';

    document.getElementById('admin-avg').textContent = s.avg.toLocaleString();
    document.getElementById('admin-avg-sub').textContent = '7 ngày gần nhất';

    if (s.etaDate) {
      const [y, m, d] = s.etaDate.split('-');
      document.getElementById('admin-eta').textContent = `${d}/${m}/${y}`;
      document.getElementById('admin-eta-sub').textContent = `còn ~${s.daysLeft} ngày`;
    } else {
      document.getElementById('admin-eta').textContent = '—';
      document.getElementById('admin-eta-sub').textContent = 'chưa đủ dữ liệu';
    }

    const deltaEl = document.getElementById('admin-delta');
    deltaEl.textContent = delta === 0 ? '= 0' : `${sign}${delta.toLocaleString()}`;
    deltaEl.className   = 'admin-stat-value ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : '');
    document.getElementById('admin-delta-sub').textContent = `hôm qua: ${s.yestTotal.toLocaleString()}`;
  }

  if (teamKey) renderAdminStats(teamKey);

  // Áp dụng filter hiện tại
  const groups = { cat: 'admin-group-cat', dong: 'admin-group-dong', kiem: 'admin-group-kiem' };
  Object.entries(groups).forEach(([key, id]) => {
    document.getElementById(id).style.display = (_adminTeam === key) ? '' : 'none';
  });

  const now = new Date();
  document.getElementById('admin-updated').textContent =
    `Cập nhật ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ── Init ──
initFlowTeamChips();
initMissTeamChips();
document.getElementById('m-date-today').value = mskDateStr();
loadToday();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => initUpdateBanner())
    .catch(() => {});
}

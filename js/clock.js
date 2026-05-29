'use strict';

const clockEl    = document.getElementById('msk-clock');
const pinClockEl = document.getElementById('pin-clock');
const bannerEl  = document.getElementById('status-banner');
const sTitleEl  = document.getElementById('s-title');
const sDetailEl = document.getElementById('s-detail');
const formCard  = document.getElementById('form-card');
const btnSubmit = document.getElementById('btn-submit');

let _lastClockSec = -1;

function tick() {
  // Cập nhật đồng hồ MSK
  const timeStr = mskTimeStr();
  clockEl.textContent = timeStr;
  if (pinClockEl) pinClockEl.textContent = timeStr;

  // A: clock glow mỗi giây
  const sec = mskNow().getUTCSeconds();
  if (sec !== _lastClockSec) {
    _lastClockSec = sec;
    clockEl.classList.remove('clock-glow');
    void clockEl.offsetWidth;
    clockEl.classList.add('clock-glow');
    if (pinClockEl) {
      pinClockEl.classList.remove('clock-glow');
      void pinClockEl.offsetWidth;
      pinClockEl.classList.add('clock-glow');
    }
  }

  // Cập nhật banner trạng thái
  const ready = isReportTime();
  bannerEl.className = 'status-banner ' + (ready ? 'ready' : 'waiting');

  if (ready) {
    sTitleEl.textContent  = 'Đã đến giờ báo cáo ✓';
    sDetailEl.textContent = 'Bạn có thể nhập sản lượng ca hôm nay';
    formCard.classList.remove('hidden');
    btnSubmit.disabled = false;
  } else {
    sTitleEl.textContent  = 'Chưa đến giờ báo cáo';
    sDetailEl.textContent = `Quay lại sau 20:30 MSK — còn ${fmtCountdown(secsToReport())}`;
    formCard.classList.add('hidden');
  }
}

setInterval(tick, 1000);
tick();

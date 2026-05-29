'use strict';

function mskNow() {
  return new Date(Date.now() + MSK_OFFSET_MS);
}

function mskDateStr() {
  const d = mskNow();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function mskTimeStr() {
  const d = mskNow();
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function isReportTime() {
  return true; // TẠM THỜI: cho phép báo cáo 24/7 — bỏ dòng này khi chốt khung giờ
  // const d = mskNow();
  // const h = d.getUTCHours(), m = d.getUTCMinutes();
  // return h > REPORT_HOUR || (h === REPORT_HOUR && m >= REPORT_MINUTE);
}

function secsToReport() {
  const now = mskNow();
  const target = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    REPORT_HOUR, REPORT_MINUTE, 0
  ));
  const diff = target - now;
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

function fmtCountdown(s) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function tsToMSK(iso) {
  const msk = new Date(new Date(iso).getTime() + MSK_OFFSET_MS);
  return `${pad(msk.getUTCHours())}:${pad(msk.getUTCMinutes())} MSK`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

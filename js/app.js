'use strict';

// ── Tab navigation (K: fade-slide) ──
let currentTab = 'report';

window.switchTab = function (tab) {
  currentTab = tab;
  const isReport = tab === 'report';
  const showEl   = document.getElementById(isReport ? 'tab-report' : 'tab-history');
  const hideEl   = document.getElementById(isReport ? 'tab-history' : 'tab-report');

  hideEl.classList.add('hidden');
  showEl.classList.remove('hidden');
  showEl.classList.remove('tab-enter');
  void showEl.offsetWidth; // reflow để restart animation
  showEl.classList.add('tab-enter');

  document.getElementById('nav-report').classList.toggle('active', isReport);
  document.getElementById('nav-history').classList.toggle('active', !isReport);

  if (isReport) {
    loadToday();
  } else {
    const hd = document.getElementById('hist-date');
    if (!hd.value) hd.value = mskDateStr();
    loadHistory(hd.value);
  }
};

// ── PWA install prompt ──
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  document.getElementById('install-banner').classList.add('show');
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('install-banner').classList.remove('show');
  }
  _installPrompt = null;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner').classList.remove('show');
  _installPrompt = null;
});

// ── Service Worker + Update banner ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => initUpdateBanner())
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── Init ──
loadToday();

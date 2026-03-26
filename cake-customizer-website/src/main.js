/**
 * @fileoverview App entry point. Detects the current page and
 * initializes the appropriate modules.
 */

import { initCommonUI, initCustomizerUI, showToast } from './ui.js';
import { showStartChoiceModal } from './StartFlow.js';
import { registerSW } from 'virtual:pwa-register';

// ─── PWA: Service Worker registration ────────────────────────────────────────
registerSW({
  onNeedRefresh(updateSW) {
    showToast('✨ New version available — updating...', 'success');
    setTimeout(() => updateSW(true), 1500);
  },
  onOfflineReady() {
    showToast('✅ App ready for offline use', 'success');
  },
});

// ─── PWA: Offline banner ──────────────────────────────────────────────────────
(function initOfflineBanner() {
  const banner = document.createElement('div');
  banner.id = 'arcake-offline-banner';
  banner.className = 'arcake-offline-banner';
  banner.textContent = '📵  You\'re offline — all features still work from cache';
  document.body.appendChild(banner);

  function showBanner() { banner.classList.add('visible'); }
  function hideBanner() { banner.classList.remove('visible'); }

  if (!navigator.onLine) showBanner();
  window.addEventListener('offline', showBanner);
  window.addEventListener('online',  hideBanner);
}());

// ─── PWA: Install prompt banner ───────────────────────────────────────────────
(function initInstallBanner() {
  // Don't show if already running as standalone
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();

    // Respect user dismissal within the last 7 days
    const dismissed = localStorage.getItem('arcake_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'arcake-install-banner';
    banner.className = 'arcake-install-banner';

    const label = document.createElement('span');
    label.textContent = 'Install ARCake for the full experience';

    const installBtn = document.createElement('button');
    installBtn.textContent = 'Install';
    installBtn.className = 'arcake-install-banner__btn';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.className = 'arcake-install-banner__close';

    banner.appendChild(label);
    banner.appendChild(installBtn);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        banner.style.display = 'none';
        banner.remove();
      }
      deferredPrompt = null;
    });

    closeBtn.addEventListener('click', () => {
      localStorage.setItem('arcake_install_dismissed', String(Date.now()));
      banner.style.display = 'none';
      banner.remove();
    });
  }
}());

/**
 * Detect which page we're on and initialize accordingly
 */
async function init() {
  initCommonUI();

  const path = window.location.pathname;

  if (path.includes('customize')) {
    await initCustomizePage();
  } else {
    await initHomePage();
  }
}

/**
 * Initialize the home page with hero 3D preview
 */
async function initHomePage() {

  // Intercept "Start Customizing" — show scan choice modal first
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showStartChoiceModal((detectedShape) => {
        const shape = ['round', 'square', 'heart', 'layered'].includes(detectedShape)
          ? detectedShape
          : 'round';
        window.location.href = `./pages/customize.html?shape=${shape}`;
      });
    });
  }

  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;

  try {
    const { createHeroPreview } = await import('./cake.js');
    createHeroPreview(canvas);
  } catch (err) {
    console.error('[ARCake] Error loading hero preview:', err);
  }
}

/**
 * Initialize the customizer page
 */
async function initCustomizePage() {
  const canvas = document.getElementById('cakeCanvas');
  if (!canvas) return;

  try {
    const { CakeScene } = await import('./cake.js');
    const { CustomizationState } = await import('./customization.js');

    const custState = new CustomizationState();

    // Apply shape detected by the scanner on the home page (passed via URL)
    const urlShape = new URLSearchParams(window.location.search).get('shape');
    if (urlShape && ['round', 'square', 'heart', 'layered'].includes(urlShape)) {
      custState.set('shape', urlShape);
    }

    const cakeScene = new CakeScene(canvas);
    window.customizationState = custState;
    window.cakeScene = cakeScene;
    initCustomizerUI(custState, cakeScene);
  } catch (err) {
    console.error('[ARCake] Error initializing customizer:', err);
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

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
  Object.assign(banner.style, {
    display: 'none',
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '36px',
    lineHeight: '36px',
    background: '#E91E8C',
    color: '#ffffff',
    fontSize: '13px',
    textAlign: 'center',
    zIndex: '99999',
    boxSizing: 'border-box',
  });
  banner.textContent = '📵  You\'re offline — all features still work from cache';
  document.body.appendChild(banner);

  function showBanner() { banner.style.display = 'block'; }
  function hideBanner() { banner.style.display = 'none'; }

  if (!navigator.onLine) showBanner();
  window.addEventListener('offline', showBanner);
  window.addEventListener('online',  hideBanner);
}());

// ─── PWA: Install prompt banner ───────────────────────────────────────────────
(function initInstallBanner() {
  // Don't show if already running as standalone (already installed)
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (navigator.standalone === true) return; // iOS standalone check

  // Respect user dismissal within the last 7 days
  const dismissed = localStorage.getItem('arcake_install_dismissed');
  if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  function buildBanner(labelText, btnText, onBtnClick) {
    const banner = document.createElement('div');
    banner.id = 'arcake-install-banner';
    banner.className = 'arcake-install-banner';

    const label = document.createElement('span');
    label.textContent = labelText;

    const btn = document.createElement('button');
    btn.textContent = btnText;
    btn.className = 'arcake-install-banner__btn';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.className = 'arcake-install-banner__close';
    closeBtn.setAttribute('aria-label', 'Dismiss install prompt');

    banner.appendChild(label);
    banner.appendChild(btn);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);

    btn.addEventListener('click', onBtnClick);
    closeBtn.addEventListener('click', () => {
      localStorage.setItem('arcake_install_dismissed', String(Date.now()));
      banner.remove();
    });

    return banner;
  }

  if (isIOS) {
    // iOS Safari doesn't support beforeinstallprompt — show manual instructions
    buildBanner(
      'Install ARCake: tap Share then "Add to Home Screen"',
      'Got it',
      () => {
        localStorage.setItem('arcake_install_dismissed', String(Date.now()));
        document.getElementById('arcake-install-banner')?.remove();
      }
    );
    return;
  }

  // Android / Desktop Chrome: wait for the native install prompt
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = buildBanner(
      'Install ARCake for the full experience',
      'Install',
      async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') banner.remove();
        deferredPrompt = null;
      }
    );
  });
}());

/**
 * Detect which page we're on and initialize accordingly
 */
async function init() {
  console.log('[ARCake] Initializing...');

  // Common UI (navbar, scroll, spinner)
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
  console.log('[ARCake] Home page');

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
    console.log('[ARCake] Hero preview loaded');
  } catch (err) {
    console.error('[ARCake] Error loading hero preview:', err);
  }
}

/**
 * Initialize the customizer page
 */
async function initCustomizePage() {
  console.log('[ARCake] Customizer page');
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
    console.log('[ARCake] Customizer initialized');
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

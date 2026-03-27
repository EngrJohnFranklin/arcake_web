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

// ─── PWA: Install prompt (Android + iOS) ─────────────────────────────────────
(function initInstallSystem() {
  // Already installed — nothing to do
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone === true) return; // iOS standalone

  // ── Detect iOS Safari ──────────────────────────────────────────────────────
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|opios/i.test(ua);

  // ── iOS Safari: show guide modal on open (beforeinstallprompt never fires) ─
  if (isIOSSafari) {
    setTimeout(() => {
      const dismissed = localStorage.getItem('arcake_install_dismissed');
      if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
      showIOSGuide();
    }, 2500);
    return;
  }

  // ── Android / Desktop Chrome: auto-show banner when browser allows it ──────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const dismissed = localStorage.getItem('arcake_install_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    showAndroidBanner();
  });

  window.addEventListener('appinstalled', () => {
    removeBottomBanner();
    deferredPrompt = null;
  });

  function triggerAndroidInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(({ outcome }) => {
      if (outcome === 'accepted') removeBottomBanner();
      deferredPrompt = null;
    });
  }

  function showAndroidBanner() {
    if (document.getElementById('arcake-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'arcake-install-banner';
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      width: '100%',
      background: 'rgba(26, 26, 46, 0.96)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '12px 20px',
      zIndex: '9998',
      boxSizing: 'border-box',
      fontSize: '14px',
    });

    const label = document.createElement('span');
    label.textContent = '📲 Install ARCake for the full experience';

    const installBtn = document.createElement('button');
    installBtn.textContent = 'Install';
    Object.assign(installBtn.style, {
      background: '#E91E8C',
      color: '#ffffff',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 18px',
      fontSize: '14px',
      cursor: 'pointer',
      fontWeight: '600',
      flexShrink: '0',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent',
      color: '#ffffff',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '0 4px',
      flexShrink: '0',
    });

    banner.appendChild(label);
    banner.appendChild(installBtn);
    banner.appendChild(closeBtn);
    document.body.appendChild(banner);

    installBtn.addEventListener('click', triggerAndroidInstall);
    closeBtn.addEventListener('click', () => {
      localStorage.setItem('arcake_install_dismissed', String(Date.now()));
      removeBottomBanner();
    });
  }

  function removeBottomBanner() {
    const b = document.getElementById('arcake-install-banner');
    if (b) b.remove();
  }

  // ── iOS Guide Modal ────────────────────────────────────────────────────────
  function showIOSGuide() {
    if (document.getElementById('arcake-ios-guide')) return;

    const overlay = document.createElement('div');
    overlay.id = 'arcake-ios-guide';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.65)',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom, 0) 0',
    });

    const sheet = document.createElement('div');
    Object.assign(sheet.style, {
      background: '#1a1a2e',
      color: '#ffffff',
      borderRadius: '20px 20px 0 0',
      padding: '24px 24px 32px',
      width: '100%',
      maxWidth: '480px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    });

    sheet.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="width:40px;height:4px;background:#555;border-radius:2px;margin:0 auto 16px;"></div>
        <div style="font-size:32px;margin-bottom:8px;">🎂</div>
        <h3 style="margin:0 0 4px;font-size:18px;color:#E91E8C;">Install ARCake</h3>
        <p style="margin:0;font-size:13px;color:#aaa;">Add to your Home Screen for the best experience</p>
      </div>
      <ol style="padding-left:20px;margin:0 0 20px;line-height:2;font-size:14px;color:#ddd;">
        <li>Tap the <strong style="color:#fff;">Share</strong> button
          <span style="display:inline-block;margin-left:4px;vertical-align:middle;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E91E8C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </span>
          at the bottom of Safari
        </li>
        <li>Scroll down and tap <strong style="color:#fff;">"Add to Home Screen"</strong></li>
        <li>Tap <strong style="color:#fff;">"Add"</strong> in the top-right corner</li>
      </ol>
      <button id="arcake-ios-close" style="
        width:100%;background:#E91E8C;color:#fff;border:none;
        border-radius:10px;padding:14px;font-size:15px;font-weight:600;
        cursor:pointer;
      ">Got it</button>
      <button id="arcake-ios-dismiss" style="
        width:100%;background:transparent;color:#777;border:none;
        padding:10px;font-size:13px;cursor:pointer;margin-top:4px;
      ">Don't show again for 7 days</button>
    `;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('arcake-ios-close').addEventListener('click', () => overlay.remove());
    document.getElementById('arcake-ios-dismiss').addEventListener('click', () => {
      localStorage.setItem('arcake_install_dismissed', String(Date.now()));
      overlay.remove();
    });
  }
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

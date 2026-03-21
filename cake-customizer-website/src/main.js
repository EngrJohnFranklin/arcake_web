/**
 * @fileoverview App entry point. Detects the current page and
 * initializes the appropriate modules.
 */

import { initCommonUI, initCustomizerUI } from './ui.js';
import { showStartChoiceModal } from './StartFlow.js';

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
  } else if (path.includes('gallery')) {
    await initGalleryPage();
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

    // Check for loaded design from gallery
    const loadedDesign = sessionStorage.getItem('arcake_loadDesign');
    if (loadedDesign) {
      try {
        const parsed = JSON.parse(loadedDesign);
        custState.loadState(parsed);
        sessionStorage.removeItem('arcake_loadDesign');
      } catch (e) {
        console.warn('[ARCake] Could not load saved design:', e);
      }
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

/**
 * Initialize the gallery page
 */
async function initGalleryPage() {
  console.log('[ARCake] Gallery page');
  try {
    const { initGallery } = await import('./gallery.js');
    initGallery();
    console.log('[ARCake] Gallery initialized');
  } catch (err) {
    console.error('[ARCake] Error initializing gallery:', err);
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

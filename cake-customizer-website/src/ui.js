/**
 * @fileoverview UI interactions for the customizer page.
 * Binds DOM events to customization state changes.
 */

import { ARPreview } from './ARPreview.js';

/**
 * Initialize all UI bindings for the customizer page
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
export function initCustomizerUI(custState, cakeScene) {
  _bindOptionGroups(custState, cakeScene);
  _bindColorSwatches(custState, cakeScene);
  _bindToppings(custState, cakeScene);
  _bindTextInputs(custState, cakeScene);
  _bindActionButtons(custState, cakeScene);
  _bindARPreviewButton(custState, cakeScene);
  _setInitialActiveStates(custState);

  // Fallback debounced rebuild — catches any state change not handled by an
  // immediate rebuild above (e.g. programmatic loadState, sessionStorage load).
  // Always reads the freshest state so rapid changes coalesce correctly.
  let rebuildTimer = null;
  custState.onChange(() => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      try {
        cakeScene.buildCake(custState.getState());
      } catch (err) {
        console.error('[ARCake] Fallback rebuild error:', err);
      }
    }, 60);

    // Update topping count badge on every change
    _updateToppingCount(custState);
  });

  // Initial build
  cakeScene.buildCake(custState.getState());
}

/**
 * Bind single-select option groups (shape, size, flavor, frostingStyle)
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindOptionGroups(custState, cakeScene) {
  const groups = document.querySelectorAll('.option-group[data-option]');
  groups.forEach((group) => {
    const optionKey = group.dataset.option;
    if (optionKey === 'frostingColor' || optionKey === 'boardColor') return;

    const buttons = group.querySelectorAll('.option-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Frosting style is toggleable — clicking the active button removes frosting (naked)
        if (optionKey === 'frostingStyle' && btn.classList.contains('active')) {
          buttons.forEach((b) => b.classList.remove('active'));
          custState.set('frostingStyle', 'naked');
          try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
          return;
        }
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        custState.set(optionKey, btn.dataset.value);
        // Re-evaluate fruit quantity cap when shape changes
        if (optionKey === 'shape') _updateQuantityUI('fruits', custState);
        // Immediate rebuild — no visible lag on shape/size/flavor/style change
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      });
    });
  });
}

/**
 * Bind color swatch selections (frosting color, board color, custom color input)
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindColorSwatches(custState, cakeScene) {
  // Preset frosting colors
  const frostPresets = document.querySelector('.preset-colors[data-option="frostingColor"]');
  if (frostPresets) {
    const swatches = frostPresets.querySelectorAll('.color-swatch');
    swatches.forEach((sw) => {
      sw.addEventListener('click', () => {
        swatches.forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        custState.set('frostingColor', sw.dataset.value);
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      });
    });
  }

  // Custom frosting color picker — debounced because user drags the picker
  const customFrostInput = document.getElementById('customFrostingColor');
  if (customFrostInput) {
    let debounceTimer = null;
    customFrostInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (frostPresets) {
          frostPresets.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        }
        custState.set('frostingColor', customFrostInput.value);
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      }, 80);
    });
  }

  // Board color
  const boardPresets = document.querySelector('.preset-colors[data-option="boardColor"]');
  if (boardPresets) {
    const swatches = boardPresets.querySelectorAll('.color-swatch');
    swatches.forEach((sw) => {
      sw.addEventListener('click', () => {
        swatches.forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        custState.set('boardColor', sw.dataset.value);
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      });
    });
  }
}

/**
 * Bind topping option buttons, clear buttons, and quantity steppers.
 * One selection per category; clicking the active option deselects it.
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindToppings(custState, cakeScene) {
  // Categories that live inside the shared Decorations card — only one may be
  // active at a time across all three sub-groups.
  const DECORATION_GROUP = ['sprinkles', 'fruits', 'decorations'];

  // Topping option buttons (radio-style within category)
  document.querySelectorAll('.topping-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      custState.setTopping(cat, btn.dataset.value);

      // Mutual exclusion: selecting anything inside the Decorations card
      // clears the other two decoration sub-groups.
      if (DECORATION_GROUP.includes(cat)) {
        DECORATION_GROUP.forEach((other) => {
          if (other !== cat) {
            custState.clearTopping(other);
            _refreshCategoryUI(other, custState);
          }
        });
      }

      _refreshCategoryUI(cat, custState);
      // Instant visual feedback — no debounce needed for single clicks
      try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
    });
  });

  // Clear buttons — deselect that category
  document.querySelectorAll('.topping-clear-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      custState.clearTopping(btn.dataset.category);
      _refreshCategoryUI(btn.dataset.category, custState);
      try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
    });
  });

  // Quantity steppers (fruits + candles)
  document.querySelectorAll('.topping-qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { category, action } = btn.dataset;

      // Auto-select first option if the user presses +/- but no type is chosen yet
      if (!custState.getTopping(category)) {
        const firstBtn = document.querySelector(`.topping-option-btn[data-category="${category}"]`);
        if (firstBtn) {
          custState.setTopping(category, firstBtn.dataset.value);
          _refreshCategoryUI(category, custState);
        }
      }

      const current = custState.getToppingQuantity(category);
      const shapeMax = category === 'fruits' ? _fruitMax(custState) : null;
      let newQty = action === 'inc' ? current + 1 : current - 1;
      if (shapeMax !== null) newQty = Math.min(newQty, shapeMax);
      custState.setToppingQuantity(category, newQty);
      _updateQuantityUI(category, custState);

      // Immediate rebuild — do not wait for the 50 ms debounce
      try {
        cakeScene.buildCake(custState.getState());
      } catch (err) {
        console.error('[ARCake] Error rebuilding cake on qty change:', err);
      }
    });
  });

  // Direct quantity input — allow typing a number, clamp on commit
  document.querySelectorAll('.topping-qty-input').forEach((input) => {
    input.addEventListener('change', () => {
      const { category } = input.dataset;
      const val = parseInt(input.value, 10);
      if (!isNaN(val)) {
        custState.setToppingQuantity(category, val);
        _updateQuantityUI(category, custState);

        // Immediate rebuild
        try {
          cakeScene.buildCake(custState.getState());
        } catch (err) {
          console.error('[ARCake] Error rebuilding cake on qty input:', err);
        }
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
  });
}

/**
 * Return the per-shape max fruit quantity for the current state.
 * square=8, heart=3, round/layered=5
 */
function _fruitMax(custState) {
  const shape = custState.getState().shape;
  return shape === 'square' ? 8 : shape === 'heart' ? 3 : 5;
}

/**
 * Refresh the active state of all buttons in a single category,
 * and update the quantity stepper if applicable.
 * @param {string} category
 * @param {import('./customization.js').CustomizationState} custState
 */
function _refreshCategoryUI(category, custState) {
  document.querySelectorAll(`.topping-option-btn[data-category="${category}"]`).forEach((b) => {
    b.classList.toggle('active', custState.isToppingActive(category, b.dataset.value));
  });
  if (category === 'fruits' || category === 'candles') {
    _updateQuantityUI(category, custState);
  }
}

/**
 * Show/hide and update quantity stepper values for a category.
 * @param {string} category - 'fruits' | 'candles'
 * @param {import('./customization.js').CustomizationState} custState
 */
function _updateQuantityUI(category, custState) {
  const qtyRow = document.querySelector(`.topping-qty-row[data-category="${category}"]`);
  if (!qtyRow) return;
  const active = custState.getTopping(category);
  qtyRow.classList.toggle('visible', active !== null);
  const input = qtyRow.querySelector('.topping-qty-input');
  let qty = custState.getToppingQuantity(category);
  const min = parseInt(input?.getAttribute('min') || '1', 10);
  const max = category === 'fruits' ? _fruitMax(custState)
            : parseInt(input?.getAttribute('max') || '12', 10);

  // Clamp stored qty to the current per-shape max
  if (qty > max) {
    qty = max;
    custState.setToppingQuantity(category, qty);
  }

  if (input) {
    input.value = qty;
    input.max   = max;
  }
  const decBtn = qtyRow.querySelector('[data-action="dec"]');
  const incBtn = qtyRow.querySelector('[data-action="inc"]');
  if (decBtn) decBtn.disabled = qty <= min;
  if (incBtn) incBtn.disabled = qty >= max;
}

/**
 * Update the topping count badge in the summary header.
 * @param {import('./customization.js').CustomizationState} custState
 */
function _updateToppingCount(custState) {
  const countEl = document.querySelector('.topping-count');
  if (!countEl) return;
  const n = custState.getToppingCount();
  countEl.textContent = n > 0 ? `${n} active` : '';
}

/**
 * Bind text input, font selector, and text color picker
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindTextInputs(custState, cakeScene) {
  const textInput = document.getElementById('cakeText');
  if (textInput) {
    let debounceTimer = null;
    textInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      // Debounced — user may type quickly; rebuild once they pause
      debounceTimer = setTimeout(() => {
        custState.set('cakeText', textInput.value);
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      }, 250);
    });
  }

  const fontSelect = document.getElementById('textFont');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      custState.set('textFont', fontSelect.value);
      try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
    });
  }

  const textColor = document.getElementById('textColor');
  if (textColor) {
    let debounceTimer = null;
    textColor.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        custState.set('textColor', textColor.value);
        try { cakeScene.buildCake(custState.getState()); } catch (err) { console.error('[ARCake]', err); }
      }, 80);
    });
  }
}

/**
 * Bind the "Preview in my space" AR button.
 * Opens ARPreview with the current customization state.
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindARPreviewButton(custState, cakeScene) {
  const btn = document.getElementById('ar-preview-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const ar = new ARPreview(
      custState.getState(),
      // onBack: user returns to customizer
      () => { /* customizer is still in DOM — nothing to re-show */ },
      // onSaveScreenshot: optional toast feedback
      (_dataURL) => showToast('AR screenshot saved!', 'success'),
    );
    ar.open();
  });
}

/**
 * Bind Save, Screenshot, and Reset buttons
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
function _bindActionButtons(custState, cakeScene) {
  const btnSave = document.getElementById('btnSave');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      try {
        const state = custState.getState();
        const screenshot = cakeScene.takeScreenshot();
        const designs = JSON.parse(localStorage.getItem('arcake_designs') || '[]');
        designs.push({ id: Date.now(), date: new Date().toISOString(), state, screenshot });
        localStorage.setItem('arcake_designs', JSON.stringify(designs));
        showToast('Design Saved!', 'success');
      } catch (err) {
        console.error('[ARCake] Save error:', err);
        showToast('Error saving design', 'error');
      }
    });
  }

  const btnScreenshot = document.getElementById('btnScreenshot');
  if (btnScreenshot) {
    btnScreenshot.addEventListener('click', () => {
      try {
        const dataUrl = cakeScene.takeScreenshot();
        const link = document.createElement('a');
        link.download = `arcake-design-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        showToast('Screenshot taken!', 'success');
      } catch (err) {
        console.error('[ARCake] Screenshot error:', err);
        showToast('Error taking screenshot', 'error');
      }
    });
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      custState.reset();
      _setInitialActiveStates(custState);
      const textInput = document.getElementById('cakeText');
      if (textInput) textInput.value = '';
      showToast('Cake reset!', 'success');
    });
  }
}

/**
 * Set initial active states on all option buttons from state.
 * @param {import('./customization.js').CustomizationState} custState
 */
function _setInitialActiveStates(custState) {
  const state = custState.getState();

  // Single-select option groups (shape, size, flavor, frostingStyle)
  ['shape', 'size', 'flavor', 'frostingStyle'].forEach((key) => {
    const group = document.querySelector(`.option-group[data-option="${key}"]`);
    if (!group) return;
    group.querySelectorAll('.option-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === state[key]);
    });
  });

  // Frosting color
  const frostPresets = document.querySelector('.preset-colors[data-option="frostingColor"]');
  if (frostPresets) {
    frostPresets.querySelectorAll('.color-swatch').forEach((sw) => {
      sw.classList.toggle('active', sw.dataset.value === state.frostingColor);
    });
  }

  // Board color
  const boardPresets = document.querySelector('.preset-colors[data-option="boardColor"]');
  if (boardPresets) {
    boardPresets.querySelectorAll('.color-swatch').forEach((sw) => {
      sw.classList.toggle('active', sw.dataset.value === state.boardColor);
    });
  }

  // Toppings — one active per category
  const toppingBtns = document.querySelectorAll('.topping-option-btn');
  toppingBtns.forEach((btn) => {
    const { category, value } = btn.dataset;
    btn.classList.toggle('active', custState.isToppingActive(category, value));
  });

  // Quantity steppers — initialise visibility + values
  ['fruits', 'candles'].forEach((cat) => _updateQuantityUI(cat, custState));

  _updateToppingCount(custState);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {string} [type=''] - 'success' | 'error'
 */
export function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  if (type) toast.classList.add(type);
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

/**
 * Initialize common UI (navbar toggle, scroll animations, loading spinner).
 */
export function initCommonUI() {
  const toggle = document.getElementById('navToggle');
  const menu   = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => menu.classList.remove('open'));
    });
  }

  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    fadeEls.forEach((el) => observer.observe(el));
  }

  const spinner = document.getElementById('loading');
  if (spinner) setTimeout(() => spinner.classList.add('hidden'), 600);
}

/**
 * @fileoverview UI interactions for the customizer page.
 * Binds DOM events to customization state changes.
 */

/**
 * Initialize all UI bindings for the customizer page
 * @param {import('./customization.js').CustomizationState} custState
 * @param {import('./cake.js').CakeScene} cakeScene
 */
export function initCustomizerUI(custState, cakeScene) {
  _bindOptionGroups(custState);
  _bindColorSwatches(custState);
  _bindToppings(custState);
  _bindTextInputs(custState);
  _bindActionButtons(custState, cakeScene);
  _setInitialActiveStates(custState);

  // Listen for state changes and rebuild cake
  let rebuildTimer = null;
  custState.onChange((e) => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      try {
        cakeScene.buildCake(e.detail.state);
      } catch (err) {
        console.error('[ARCake] Error rebuilding cake:', err);
      }
    }, 50);

    // Update UI topping count
    const countEl = document.querySelector('.topping-count');
    if (countEl) {
      countEl.textContent = `(${custState.getToppingCount()}/5)`;
    }
  });

  // Initial build
  cakeScene.buildCake(custState.getState());
}

/**
 * Bind single-select option groups (shape, size, flavor, frostingStyle)
 * @param {import('./customization.js').CustomizationState} custState
 */
function _bindOptionGroups(custState) {
  const groups = document.querySelectorAll('.option-group[data-option]');
  groups.forEach((group) => {
    const optionKey = group.dataset.option;
    if (optionKey === 'toppings' || optionKey === 'frostingColor' || optionKey === 'boardColor') return;

    const buttons = group.querySelectorAll('.option-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Remove active from siblings
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        custState.set(optionKey, btn.dataset.value);
      });
    });
  });
}

/**
 * Bind color swatch selections (frosting color, board color, custom color input)
 * @param {import('./customization.js').CustomizationState} custState
 */
function _bindColorSwatches(custState) {
  // Preset frosting colors
  const frostPresets = document.querySelector('.preset-colors[data-option="frostingColor"]');
  if (frostPresets) {
    const swatches = frostPresets.querySelectorAll('.color-swatch');
    swatches.forEach((sw) => {
      sw.addEventListener('click', () => {
        swatches.forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        custState.set('frostingColor', sw.dataset.value);
      });
    });
  }

  // Custom frosting color picker
  const customFrostInput = document.getElementById('customFrostingColor');
  if (customFrostInput) {
    let debounceTimer = null;
    customFrostInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Deactivate preset swatches
        if (frostPresets) {
          frostPresets.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        }
        custState.set('frostingColor', customFrostInput.value);
      }, 100);
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
      });
    });
  }
}

/**
 * Bind topping toggle buttons
 * @param {import('./customization.js').CustomizationState} custState
 */
function _bindToppings(custState) {
  const toppingBtns = document.querySelectorAll('.topping-tile');
  toppingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const topping = btn.dataset.value;
      const isActive = custState.hasTopping(topping);

      if (isActive) {
        custState.toggleTopping(topping);
        btn.classList.remove('active');
      } else {
        const added = custState.toggleTopping(topping);
        if (added) {
          btn.classList.add('active');
        } else {
          showToast('Maximum 5 toppings allowed!', 'error');
        }
      }
    });
  });
}

/**
 * Bind text input, font selector, and text color picker
 * @param {import('./customization.js').CustomizationState} custState
 */
function _bindTextInputs(custState) {
  const textInput = document.getElementById('cakeText');
  if (textInput) {
    let debounceTimer = null;
    textInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        custState.set('cakeText', textInput.value);
      }, 300);
    });
  }

  const fontSelect = document.getElementById('textFont');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      custState.set('textFont', fontSelect.value);
    });
  }

  const textColor = document.getElementById('textColor');
  if (textColor) {
    let debounceTimer = null;
    textColor.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        custState.set('textColor', textColor.value);
      }, 100);
    });
  }
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
        designs.push({
          id: Date.now(),
          date: new Date().toISOString(),
          state,
          screenshot
        });
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
      // Clear text input
      const textInput = document.getElementById('cakeText');
      if (textInput) textInput.value = '';
      showToast('Cake reset!', 'success');
    });
  }
}

/**
 * Set initial active states on option buttons from state
 * @param {import('./customization.js').CustomizationState} custState
 */
function _setInitialActiveStates(custState) {
  const state = custState.getState();

  // Single-select groups
  const singleKeys = ['shape', 'size', 'flavor', 'frostingStyle'];
  singleKeys.forEach((key) => {
    const group = document.querySelector(`.option-group[data-option="${key}"]`);
    if (!group) return;
    const btns = group.querySelectorAll('.option-btn');
    btns.forEach((btn) => {
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

  // Toppings
  const toppingBtns = document.querySelectorAll('.topping-tile');
  toppingBtns.forEach((btn) => {
    btn.classList.toggle('active', state.toppings.includes(btn.dataset.value));
  });

  // Topping count
  const countEl = document.querySelector('.topping-count');
  if (countEl) {
    countEl.textContent = `(${state.toppings.length}/5)`;
  }
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {string} [type=''] - 'success' | 'error' | ''
 */
export function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  if (type) toast.classList.add(type);
  // Force reflow
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/**
 * Initialize common UI (navbar toggle, scroll animations)
 */
export function initCommonUI() {
  // Navbar toggle
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('open');
    });
    // Close on link click
    menu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => menu.classList.remove('open'));
    });
  }

  // Scroll fade-in animations
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

  // Hide loading spinner
  const spinner = document.getElementById('loading');
  if (spinner) {
    setTimeout(() => spinner.classList.add('hidden'), 600);
  }
}

/**
 * @fileoverview Customization state management.
 * Holds the current cake configuration and dispatches change events.
 * Toppings: one selection per category (sprinkles, fruits, candles, decorations).
 */

/**
 * Topping catalog — exported so UI can be data-driven.
 * Each category allows exactly ONE active option at a time.
 */
export const TOPPING_CATALOG = {
  sprinkles: {
    label: 'Sprinkles',
    options: [
      { value: 'rainbow',   label: 'Rainbow'   },
      { value: 'chocolate', label: 'Chocolate' },
      { value: 'star',      label: 'Star'      }
    ]
  },
  fruits: {
    label: 'Fruits',
    options: [
      { value: 'blueberries',  label: 'Blueberries'  },
      { value: 'strawberries', label: 'Strawberries'  },
      { value: 'cherries',     label: 'Cherries'      },
      { value: 'grapes',       label: 'Grapes'        }
    ]
  },
  candles: {
    label: 'Candles',
    options: [
      { value: 'standard', label: 'Standard' }
    ]
  },
  decorations: {
    label: 'Decorations',
    options: [
      { value: 'chocolate_pieces', label: 'Choc Shards'    },
      { value: 'edible_flowers',   label: 'Edible Flowers'  },
      { value: 'custom_toppers',   label: 'Star Toppers'    },
      { value: 'macarons',         label: 'Macarons'        },
      { value: 'choc_drizzle',     label: 'Choc Drizzle'    }
    ]
  }
};

/** Blank toppings object */
const EMPTY_TOPPINGS = {
  sprinkles:   null,
  fruits:      null,
  candles:     null,
  decorations: null
};

/**
 * Per-category quantity limits — exported so HTML/UI can read them.
 * fruits min=0 so the user can select a type without placing any.
 */
export const QTY_LIMITS = {
  fruits:  { min: 0, max: 5,  default: 3 },
  candles: { min: 1, max: 3,  default: 2 },
};

/** Default quantity per quantifiable category */
const DEFAULT_QTY = { fruits: QTY_LIMITS.fruits.default, candles: QTY_LIMITS.candles.default };
/** Fallback range for categories not in QTY_LIMITS */
const QTY_MIN = 1;
const QTY_MAX = 12;

/** Default customization state */
const DEFAULT_STATE = {
  shape:           'round',
  size:            'medium',
  flavor:          'vanilla',
  frostingStyle:   'naked',
  frostingColor:   '#FFFFFF',
  toppings:        { ...EMPTY_TOPPINGS },
  toppingQuantity: { ...DEFAULT_QTY },
  cakeText:        '',
  textFont:        'classic',
  textColor:       '#3D2B1F',
  boardColor:      '#8D6E63'
};

/**
 * CustomizationState manages the current cake configuration
 * and emits change events when values are updated.
 */
export class CustomizationState {
  constructor() {
    /** @type {EventTarget} */
    this._emitter = new EventTarget();
    this._state = { ...DEFAULT_STATE, toppings: { ...EMPTY_TOPPINGS }, toppingQuantity: { ...DEFAULT_QTY } };
  }

  /**
   * Get a snapshot of the current state.
   * @returns {object}
   */
  getState() {
    return {
      ...this._state,
      toppings:        { ...this._state.toppings },
      toppingQuantity: { ...this._state.toppingQuantity }
    };
  }

  /**
   * Update a non-topping property.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (this._state[key] === value) return;
    this._state[key] = value;
    this._emit(key);
  }

  /**
   * Set (or toggle off) a topping within a category.
   * Only one option per category is retained — selecting the active
   * value again deselects it (acts as a toggle).
   * @param {string} category - 'sprinkles' | 'fruits' | 'candles' | 'decorations'
   * @param {string} value    - Option value from TOPPING_CATALOG
   */
  setTopping(category, value) {
    if (!(category in EMPTY_TOPPINGS)) return;
    const current = this._state.toppings[category];
    this._state.toppings[category] = (current === value) ? null : value;
    this._emit('toppings');
  }

  /**
   * Clear a specific topping category.
   * @param {string} category
   */
  clearTopping(category) {
    if (this._state.toppings[category] !== null) {
      this._state.toppings[category] = null;
      this._emit('toppings');
    }
  }

  /**
   * Set the quantity for a quantifiable category ('fruits' or 'candles').
   * Clamped to [QTY_MIN, QTY_MAX].
   * @param {string} category
   * @param {number} qty
   */
  setToppingQuantity(category, qty) {
    if (!(category in this._state.toppingQuantity)) return;
    const limits  = QTY_LIMITS[category] || { min: QTY_MIN, max: QTY_MAX };
    const clamped = Math.max(limits.min, Math.min(limits.max, Math.round(qty)));
    if (this._state.toppingQuantity[category] === clamped) return;
    this._state.toppingQuantity[category] = clamped;
    this._emit('toppings');
  }

  /**
   * Get the current quantity for a quantifiable category.
   * @param {string} category
   * @returns {number}
   */
  getToppingQuantity(category) {
    return this._state.toppingQuantity[category] ?? DEFAULT_QTY[category] ?? 1;
  }

  /**
   * Get the active topping value for a category.
   * @param {string} category
   * @returns {string|null}
   */
  getTopping(category) {
    return this._state.toppings[category] || null;
  }

  /**
   * Check if a specific topping value is currently active.
   * @param {string} category
   * @param {string} value
   * @returns {boolean}
   */
  isToppingActive(category, value) {
    return this._state.toppings[category] === value;
  }

  /**
   * Count how many categories have an active selection.
   * @returns {number}
   */
  getToppingCount() {
    return Object.values(this._state.toppings).filter(v => v !== null).length;
  }

  /** Reset all state to defaults. */
  reset() {
    this._state = { ...DEFAULT_STATE, toppings: { ...EMPTY_TOPPINGS }, toppingQuantity: { ...DEFAULT_QTY } };
    this._emit('reset');
  }

  /**
   * Load state from a saved design (handles both new object and legacy array formats).
   * @param {object} savedState
   */
  loadState(savedState) {
    let toppings = { ...EMPTY_TOPPINGS };
    if (savedState.toppings && !Array.isArray(savedState.toppings)) {
      // New object format — merge known keys
      toppings = { ...EMPTY_TOPPINGS, ...savedState.toppings };
      if (toppings.candles === 'birthday' || toppings.candles === 'numeral') {
        toppings.candles = 'standard';
      }
    }
    // Legacy array format is intentionally dropped (no reliable migration)
    const rawQty = { ...DEFAULT_QTY, ...(savedState.toppingQuantity || {}) };
    // Clamp each loaded quantity to its per-category limit immediately
    const toppingQuantity = Object.fromEntries(
      Object.entries(rawQty).map(([cat, v]) => {
        const limits = QTY_LIMITS[cat] || { min: QTY_MIN, max: QTY_MAX };
        return [cat, Math.max(limits.min, Math.min(limits.max, Math.round(v || 0)))];
      })
    );
    this._state = { ...DEFAULT_STATE, ...savedState, toppings, toppingQuantity };
    this._emit('reset');
  }

  /**
   * Listen for state changes.
   * @param {function} callback - Receives CustomEvent { detail: { key, state } }
   */
  onChange(callback) {
    this._emitter.addEventListener('change', callback);
  }

  /**
   * Remove a change listener.
   * @param {function} callback
   */
  offChange(callback) {
    this._emitter.removeEventListener('change', callback);
  }

  _emit(key) {
    this._emitter.dispatchEvent(
      new CustomEvent('change', { detail: { key, state: this.getState() } })
    );
  }
}

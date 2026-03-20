/**
 * @fileoverview Customization state management.
 * Holds the current cake configuration and dispatches change events.
 */

/** Default customization state */
const DEFAULT_STATE = {
  shape: 'round',
  size: 'medium',
  flavor: 'vanilla',
  frostingStyle: 'smooth',
  frostingColor: '#FFFFFF',
  toppings: [],
  cakeText: '',
  textFont: 'classic',
  textColor: '#3D2B1F',
  boardColor: '#8D6E63'
};

/** Maximum number of toppings allowed */
const MAX_TOPPINGS = 5;

/**
 * CustomizationState manages the current cake configuration
 * and emits change events when values are updated.
 */
export class CustomizationState {
  constructor() {
    /** @type {EventTarget} */
    this._emitter = new EventTarget();
    /** @type {object} */
    this._state = { ...DEFAULT_STATE, toppings: [] };
  }

  /**
   * Get a snapshot of the current state
   * @returns {object}
   */
  getState() {
    return { ...this._state, toppings: [...this._state.toppings] };
  }

  /**
   * Update a single property
   * @param {string} key - Property name
   * @param {*} value - New value
   */
  set(key, value) {
    if (this._state[key] === value) return;
    this._state[key] = value;
    this._emit(key);
  }

  /**
   * Toggle a topping on/off
   * @param {string} topping - Topping name
   * @returns {boolean} Whether the topping is now active
   */
  toggleTopping(topping) {
    const idx = this._state.toppings.indexOf(topping);
    if (idx >= 0) {
      this._state.toppings.splice(idx, 1);
      this._emit('toppings');
      return false;
    }
    if (this._state.toppings.length >= MAX_TOPPINGS) {
      return false;
    }
    this._state.toppings.push(topping);
    this._emit('toppings');
    return true;
  }

  /**
   * Check if a topping is active
   * @param {string} topping
   * @returns {boolean}
   */
  hasTopping(topping) {
    return this._state.toppings.includes(topping);
  }

  /**
   * Get current topping count
   * @returns {number}
   */
  getToppingCount() {
    return this._state.toppings.length;
  }

  /**
   * Reset to defaults
   */
  reset() {
    this._state = { ...DEFAULT_STATE, toppings: [] };
    this._emit('reset');
  }

  /**
   * Load state from a saved design object
   * @param {object} savedState
   */
  loadState(savedState) {
    this._state = {
      ...DEFAULT_STATE,
      ...savedState,
      toppings: savedState.toppings ? [...savedState.toppings] : []
    };
    this._emit('reset');
  }

  /**
   * Listen for state changes
   * @param {function} callback - Called with { detail: { key, state } }
   */
  onChange(callback) {
    this._emitter.addEventListener('change', callback);
  }

  /**
   * Remove a change listener
   * @param {function} callback
   */
  offChange(callback) {
    this._emitter.removeEventListener('change', callback);
  }

  /** Emit a change event */
  _emit(key) {
    this._emitter.dispatchEvent(
      new CustomEvent('change', { detail: { key, state: this.getState() } })
    );
  }
}

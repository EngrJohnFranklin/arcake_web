/**
 * ShapeScanPrompt.js
 *
 * Intercepts a shape-selector click and presents a compact modal
 * asking whether the user wants to scan a real cake or continue
 * with their manual selection.
 *
 * Guarantees: onShapeReady is called exactly once in every code path.
 * Camera is always released before onShapeReady is called.
 *
 * Zero external dependencies — vanilla JS only.
 * Styles come from flow.css (shared) — no inline style blocks except
 * for the overlay/card layout which must be applied programmatically.
 */

import { CakeScanner } from './CakeScanner.js';

/* ─────────────────────────────────────────────────────────────
   Shape display names + per-shape SVG icons (36×36 and 64×64)
   ───────────────────────────────────────────────────────────── */

const _names = {
  round:   'Round',
  square:  'Square',
  heart:   'Heart',
  layered: 'Layered',
};

/** Stroke-only SVG inner paths keyed by shape, used at two sizes. */
const _shapeIconInner = {
  round: (size) => {
    const r = size * 0.36; const cx = size / 2;
    return `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${cx - 6},${cx} ${cx - 2},${cx + 4} ${cx + 6},${cx - 4}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  square: (size) => {
    const m = Math.round(size * 0.14); const w = size - m * 2;
    const cx = size / 2;
    return `<rect x="${m}" y="${m}" width="${w}" height="${w}" rx="4" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${cx - 6},${cx} ${cx - 2},${cx + 4} ${cx + 6},${cx - 4}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  heart: (size) => {
    const cx = size / 2;
    return `<path d="M${cx} ${size * 0.83}C${size * 0.11} ${size * 0.56} ${size * 0.08} ${size * 0.19} ${size * 0.28} ${size * 0.14}C${size * 0.39} ${size * 0.11} ${cx} ${size * 0.28} ${cx} ${size * 0.28}C${cx} ${size * 0.28} ${size * 0.61} ${size * 0.11} ${size * 0.72} ${size * 0.14}C${size * 0.92} ${size * 0.19} ${size * 0.89} ${size * 0.56} ${cx} ${size * 0.83}Z" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${cx - 6},${cx - 1} ${cx - 2},${cx + 3} ${cx + 7},${cx - 5}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
  layered: (size) => {
    const cx = size / 2;
    return `<ellipse cx="${cx}" cy="${size * 0.72}" rx="${size * 0.36}" ry="${size * 0.17}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="${cx}" cy="${size * 0.39}" rx="${size * 0.25}" ry="${size * 0.14}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${cx - 7},${cx - 1} ${cx - 3},${cx + 3} ${cx + 5},${cx - 5}" fill="none" stroke="#E91E8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  },
};

/** Camera (scan) icon SVG string — 36×36 */
const _cameraIcon = `<svg width="36" height="36" viewBox="0 0 36 36"
  fill="none" stroke="#E91E8C" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="8" width="32" height="22" rx="4"/>
  <circle cx="18" cy="19" r="6"/>
  <path d="M12 8l2-4h8l2 4"/>
</svg>`;

/** Builds a shape+checkmark SVG at the given pixel size. */
function _shapeIcon(shape, size) {
  const inner = (_shapeIconInner[shape] || _shapeIconInner.round)(size);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/* ─────────────────────────────────────────────────────────────
   PUBLIC API
   ───────────────────────────────────────────────────────────── */

/**
 * Show a compact modal when the user taps a shape option.
 * Either opens CakeScanner or immediately calls onShapeReady
 * with the clicked shape — caller then sets state and calls buildCake().
 *
 * @param {string}   clickedShape  - 'round'|'square'|'heart'|'layered'
 * @param {Function} onShapeReady  - Called with final shape string exactly once
 */
export function showShapeScanPrompt(clickedShape, onShapeReady) {
  _buildPromptModal(clickedShape, onShapeReady);
}

/* ─────────────────────────────────────────────────────────────
   MODAL
   ───────────────────────────────────────────────────────────── */

/**
 * Builds and appends the prompt modal overlay to document.body.
 *
 * @param {string}   clickedShape
 * @param {Function} onShapeReady
 */
function _buildPromptModal(clickedShape, onShapeReady) {
  const shapeName = _names[clickedShape] || clickedShape;

  // ── Overlay backdrop ─────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:8500;background:rgba(0,0,0,0.45);' +
    'display:flex;align-items:center;justify-content:center;';

  // ── Card ─────────────────────────────────────────────────
  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;border-radius:20px;padding:28px 24px 24px;' +
    'width:min(380px,90vw);text-align:center;' +
    'box-shadow:0 8px 40px rgba(0,0,0,0.18);';

  card.innerHTML = `
    <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a1a1a">
      Detect shape automatically?
    </h3>
    <p style="margin:0 0 24px;font-size:13px;color:#999;line-height:1.6">
      Scan a real cake with your camera to auto-fill the shape,
      or pick manually.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <button class="ssp-btn" id="ssp-scan">
        ${_cameraIcon}
        Scan my cake
        <small>auto-detect</small>
      </button>
      <button class="ssp-btn" id="ssp-manual">
        ${_shapeIcon(clickedShape, 36)}
        Use ${shapeName}
        <small>(manual)</small>
      </button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  /** Remove the overlay */
  const close = () => overlay.remove();

  // Scan button
  card.querySelector('#ssp-scan').onclick = () => {
    close();
    _startScanFromPrompt(clickedShape, onShapeReady);
  };

  // Manual button
  card.querySelector('#ssp-manual').onclick = () => {
    close();
    onShapeReady(clickedShape);
  };

  // Backdrop click → same as manual
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      close();
      onShapeReady(clickedShape);
    }
  };
}

/* ─────────────────────────────────────────────────────────────
   SCANNER HANDOFF
   ───────────────────────────────────────────────────────────── */

/**
 * Opens CakeScanner. On success shows a confirmation card;
 * on failure or manual-skip falls back to the originally clicked shape.
 *
 * @param {string}   fallbackShape  - The shape the user originally clicked
 * @param {Function} onShapeReady
 */
function _startScanFromPrompt(fallbackShape, onShapeReady) {
  const scanner = new CakeScanner({
    /**
     * CakeScanner calls stop() before invoking onDetected,
     * so the camera is already released at this point.
     * @param {string|null} detectedShape
     */
    onDetected: (detectedShape) => {
      if (!detectedShape) {
        // User hit "Select manually" inside the scanner
        onShapeReady(fallbackShape);
        return;
      }
      _showDetectedCard(detectedShape, fallbackShape, onShapeReady);
    },

    /** Camera permission denied or unavailable — fall back silently. */
    onError: (_msg) => {
      onShapeReady(fallbackShape);
    },
  });

  scanner.start();
}

/* ─────────────────────────────────────────────────────────────
   DETECTED SHAPE CARD
   ───────────────────────────────────────────────────────────── */

/**
 * Displays a bottom-sheet confirmation card after the scanner
 * successfully detects a shape.
 *
 * @param {string}   detected      - Shape returned by CakeScanner
 * @param {string}   fallback      - Shape originally clicked by the user
 * @param {Function} onShapeReady
 */
function _showDetectedCard(detected, fallback, onShapeReady) {
  const detectedName = _names[detected]  || detected;
  const fallbackName = _names[fallback]  || fallback;

  const card = document.createElement('div');
  card.className = 'sf-confirm-card'; // styled by flow.css

  card.innerHTML = `
    ${_shapeIcon(detected, 64)}
    <h3>We found a ${detectedName} cake</h3>
    <p>Shape auto-detected from your camera.</p>
    <button class="sf-btn-primary" id="ssp-use-detected">
      Use ${detectedName} shape
    </button>
    <button class="sf-btn-secondary" id="ssp-use-fallback">
      Use ${fallbackName} instead
    </button>
  `;

  document.body.appendChild(card);

  card.querySelector('#ssp-use-detected').onclick = () => {
    card.remove();
    onShapeReady(detected);
  };

  card.querySelector('#ssp-use-fallback').onclick = () => {
    card.remove();
    onShapeReady(fallback);
  };
}

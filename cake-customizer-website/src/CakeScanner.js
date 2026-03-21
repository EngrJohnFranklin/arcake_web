/**
 * CakeScanner.js
 *
 * Uses the browser MediaDevices API to open a camera feed,
 * runs a lightweight Sobel-edge + shape-classification algorithm
 * on each captured frame, and calls onDetected(shape) once a shape
 * is confirmed across 3 consecutive matching frames.
 *
 * Zero external dependencies — vanilla JS only.
 */

export class CakeScanner {
  /**
   * @param {object}   options
   * @param {Function} options.onDetected - Called with a shape string
   *   ('round'|'square'|'heart'|'layered') or null when the user
   *   chooses to select manually.
   * @param {Function} options.onError    - Called with an error message string.
   */
  constructor({ onDetected, onError }) {
    this.onDetected = onDetected;
    this.onError = onError;

    // Scanning state
    this._lastShape = null;
    this._consecutiveHits = 0;
    this._confirmed = false;
    this.REQUIRED_HITS = 3;

    // Timer handles
    this._intervalId = null;
    this._tipTimeoutId = null;

    // Media stream
    this.stream = null;

    // DOM references (populated in _buildUI)
    this._container = null;
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._finder = null;
    this._statusLabel = null;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /**
   * Opens the camera, builds the UI overlay, and starts scanning.
   * Must be called from a user-gesture context on some browsers.
   */
  async start() {
    this._buildUI();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
    } catch (_err) {
      this.onError(
        'Camera access denied. Please allow camera permissions and try again.'
      );
      this.stop();
      return;
    }

    this._video.srcObject = this.stream;
    await this._video.play();

    // Begin frame scanning at 600 ms intervals
    this._intervalId = setInterval(() => this._scanFrame(), 600);

    // After 30 seconds without a confirmed shape, give the user a tip
    this._tipTimeoutId = setTimeout(() => {
      if (!this._confirmed) {
        this._statusLabel.textContent =
          'Tip: hold camera directly above the cake for best results';
      }
    }, 30000);
  }

  /**
   * Stops the camera stream, clears timers, and removes the UI from the DOM.
   */
  stop() {
    clearInterval(this._intervalId);
    clearTimeout(this._tipTimeoutId);

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this._container && this._container.parentNode) {
      this._container.remove();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UI CONSTRUCTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Builds and appends the entire scanner UI to document.body.
   * All styles are inline — no external CSS required.
   */
  _buildUI() {
    // ── Fullscreen container ──────────────────────────────────
    const container = document.createElement('div');
    container.style.cssText =
      'position:fixed;inset:0;background:#000;z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;';
    this._container = container;

    // ── Live video element ────────────────────────────────────
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    this._video = video;
    container.appendChild(video);

    // ── Viewfinder (dashed border overlay) ───────────────────
    const finder = document.createElement('div');
    finder.style.cssText =
      'position:absolute;' +
      'width:260px;height:260px;' +
      'border:2.5px dashed rgba(255,255,255,0.75);' +
      'border-radius:16px;' +
      'transition:border-color 0.35s ease;' +
      'pointer-events:none;';
    this._finder = finder;
    container.appendChild(finder);

    // ── Status label ──────────────────────────────────────────
    const statusLabel = document.createElement('div');
    statusLabel.textContent = 'Point camera at your cake';
    statusLabel.style.cssText =
      'position:absolute;bottom:110px;' +
      'background:rgba(0,0,0,0.50);color:#fff;' +
      'font-size:15px;padding:8px 20px;border-radius:20px;' +
      'pointer-events:none;';
    this._statusLabel = statusLabel;
    container.appendChild(statusLabel);

    // ── Back button (top-left) ────────────────────────────────
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.style.cssText =
      'position:absolute;top:22px;left:18px;' +
      'background:rgba(255,255,255,0.15);color:#fff;' +
      'border:none;border-radius:20px;' +
      'padding:8px 18px;font-size:14px;cursor:pointer;';
    backBtn.addEventListener('click', () => {
      this.stop();
      // Do NOT call onDetected — user cancelled
    });
    container.appendChild(backBtn);

    // ── Title label (top-centre) ──────────────────────────────
    const title = document.createElement('div');
    title.textContent = 'Scan your cake';
    title.style.cssText =
      'position:absolute;top:30px;' +
      'color:#fff;font-size:16px;font-weight:600;' +
      'pointer-events:none;';
    container.appendChild(title);

    // ── Fallback button ───────────────────────────────────────
    const fallbackBtn = document.createElement('button');
    fallbackBtn.textContent = 'Select shape manually instead';
    fallbackBtn.style.cssText =
      'position:absolute;bottom:68px;' +
      'background:none;border:none;' +
      'color:rgba(255,255,255,0.55);font-size:13px;' +
      'text-decoration:underline;cursor:pointer;';
    fallbackBtn.addEventListener('click', () => {
      this.stop();
      this.onDetected(null); // null → caller shows manual picker
    });
    container.appendChild(fallbackBtn);

    // ── Hidden analysis canvas ────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.style.display = 'none';
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    document.body.appendChild(container);
  }

  // ─────────────────────────────────────────────────────────────
  // FRAME CAPTURE
  // ─────────────────────────────────────────────────────────────

  /**
   * Captures a single video frame into the hidden canvas and runs
   * shape detection on it.  Called by setInterval — must stay synchronous.
   */
  _scanFrame() {
    if (this._confirmed || this._video.readyState < 2) return;

    const W = 320;
    const H = 240;

    this._canvas.width = W;
    this._canvas.height = H;
    this._ctx.drawImage(this._video, 0, 0, W, H);

    const shape = this._detectShape(this._ctx, W, H);
    this._handleDetection(shape);
  }

  // ─────────────────────────────────────────────────────────────
  // SHAPE DETECTION ALGORITHM
  // ─────────────────────────────────────────────────────────────

  /**
   * Analyses a canvas 2D context and classifies the dominant cake shape.
   *
   * Pipeline:
   *   A) Grayscale conversion
   *   B) Sobel edge detection
   *   C) Bounding-box extraction
   *   D) Rule-based classification (layered → square → heart → round)
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - Canvas width in pixels
   * @param {number} h - Canvas height in pixels
   * @returns {'round'|'square'|'heart'|'layered'|null}
   */
  _detectShape(ctx, w, h) {
    // ── STEP A: Grayscale ──────────────────────────────────────
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const gray = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const base = i * 4;
      gray[i] =
        0.299 * data[base] + 0.587 * data[base + 1] + 0.114 * data[base + 2];
    }

    // ── STEP B: Sobel edge detection ───────────────────────────
    const edges = new Uint8Array(w * h);
    const EDGE_THRESHOLD = 30;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        // Fetch 3×3 neighbourhood
        const tl = gray[(y - 1) * w + (x - 1)];
        const tm = gray[(y - 1) * w + x];
        const tr = gray[(y - 1) * w + (x + 1)];
        const ml = gray[y * w + (x - 1)];
        const mr = gray[y * w + (x + 1)];
        const bl = gray[(y + 1) * w + (x - 1)];
        const bm = gray[(y + 1) * w + x];
        const br = gray[(y + 1) * w + (x + 1)];

        const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
        const gy = -tl - 2 * tm - tr + bl + 2 * bm + br;

        edges[y * w + x] =
          Math.sqrt(gx * gx + gy * gy) > EDGE_THRESHOLD ? 255 : 0;
      }
    }

    // ── STEP C: Bounding box ───────────────────────────────────
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let edgeCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (edges[y * w + x] === 255) {
          edgeCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Not enough edge signal → no detectable object
    if (edgeCount < 500) return null;

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    if (bboxW < 60 || bboxH < 60) return null;

    const aspectRatio = bboxW / bboxH;

    // ── STEP D: Classification rules ───────────────────────────

    // Rule 1 — LAYERED (taller than wide)
    if (bboxH > bboxW * 1.35) return 'layered';

    // Rule 2 — Corner density (shared by SQUARE and HEART rules)
    const cornerSize = Math.min(bboxW, bboxH) * 0.18;
    const corners = [
      { cx: minX, cy: minY },
      { cx: maxX, cy: minY },
      { cx: minX, cy: maxY },
      { cx: maxX, cy: maxY },
    ];

    let cornerEdges = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (edges[y * w + x] !== 255) continue;
        for (let c = 0; c < 4; c++) {
          const dx = x - corners[c].cx;
          const dy = y - corners[c].cy;
          if (Math.sqrt(dx * dx + dy * dy) <= cornerSize) {
            cornerEdges++;
            break; // Count pixel only once even if near multiple corners
          }
        }
      }
    }

    const cornerRatio = cornerEdges / edgeCount;

    // Rule 3 — SQUARE (roughly 1:1 aspect + dense corner edges)
    if (aspectRatio >= 0.82 && aspectRatio <= 1.22 && cornerRatio > 0.18) {
      return 'square';
    }

    // Rule 4 — HEART (near-square aspect + top-centre cleft dip)
    if (aspectRatio >= 0.75 && aspectRatio <= 1.35) {
      const topBand = Math.floor(bboxH * 0.22);
      const midLeft = Math.floor(minX + bboxW * 0.35);
      const midRight = Math.floor(minX + bboxW * 0.65);

      let cleftEdges = 0;
      for (let y = minY; y < minY + topBand; y++) {
        for (let x = midLeft; x <= midRight; x++) {
          if (edges[y * w + x] === 255) cleftEdges++;
        }
      }

      const topCentreRatio = cleftEdges / (topBand * (midRight - midLeft));
      if (topCentreRatio < 0.04) return 'heart';
    }

    // Rule 5 — ROUND (default fallback)
    return 'round';
  }

  // ─────────────────────────────────────────────────────────────
  // CONSECUTIVE CONFIRMATION LOGIC
  // ─────────────────────────────────────────────────────────────

  /**
   * Accumulates per-frame detections and confirms a shape only after
   * REQUIRED_HITS consecutive frames agree on the same shape.
   *
   * @param {'round'|'square'|'heart'|'layered'|null} shape
   */
  _handleDetection(shape) {
    const names = {
      round: 'Round',
      square: 'Square',
      heart: 'Heart',
      layered: 'Layered',
    };

    if (shape === null) {
      this._lastShape = null;
      this._consecutiveHits = 0;
      this._statusLabel.textContent = 'Point camera at your cake';
      this._finder.style.borderColor = 'rgba(255,255,255,0.75)';
      return;
    }

    if (shape === this._lastShape) {
      this._consecutiveHits++;
    } else {
      this._lastShape = shape;
      this._consecutiveHits = 1;
    }

    this._statusLabel.textContent = `Scanning… looks like a ${names[shape]} cake`;

    if (this._consecutiveHits >= this.REQUIRED_HITS) {
      this._confirmed = true;
      clearInterval(this._intervalId);
      this._finder.style.borderColor = '#4CAF50';
      this._statusLabel.textContent = `${names[shape]} cake detected!`;

      setTimeout(() => this._showConfirmCard(shape), 450);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CONFIRMATION CARD
  // ─────────────────────────────────────────────────────────────

  /**
   * Slides up a bottom-sheet confirmation card with shape SVG, copy,
   * and two action buttons (confirm / rescan).
   *
   * @param {'round'|'square'|'heart'|'layered'} shape
   */
  _showConfirmCard(shape) {
    const svgMap = {
      round: `<circle cx="36" cy="36" r="26"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,
      square: `<rect x="10" y="10" width="52" height="52" rx="6"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,
      heart: `<path d="M36 58C10 40 6 14 20 10C28 8 36 18 36 18
               C36 18 44 8 52 10C66 14 62 40 36 58Z"
        fill="none" stroke="#E91E8C" stroke-width="3"/>`,
      layered: `<ellipse cx="36" cy="50" rx="26" ry="11"
        fill="none" stroke="#E91E8C" stroke-width="2.5"/>
      <ellipse cx="36" cy="28" rx="18" ry="9"
        fill="none" stroke="#E91E8C" stroke-width="2.5"/>`,
    };

    const names = {
      round: 'Round',
      square: 'Square',
      heart: 'Heart',
      layered: 'Layered',
    };

    const shapeName = names[shape];
    const svgInner = svgMap[shape];

    const card = document.createElement('div');
    card.style.cssText =
      'position:absolute;bottom:0;left:0;right:0;' +
      'background:#fff;border-radius:20px 20px 0 0;' +
      'padding:28px 24px 40px;text-align:center;' +
      'box-shadow:0 -4px 24px rgba(0,0,0,0.15);';

    card.innerHTML = `
      <svg width="72" height="72" viewBox="0 0 72 72"
        xmlns="http://www.w3.org/2000/svg"
        style="display:block;margin:0 auto 16px;">
        ${svgInner}
      </svg>
      <p style="margin:0 0 6px;font-size:20px;font-weight:600;color:#1a1a1a">
        We found a ${shapeName} cake
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#888">
        This shape will be pre-selected in your customizer
      </p>
      <button id="cs-confirm" style="
        display:block;width:100%;padding:14px;
        background:#E91E8C;color:#fff;border:none;
        border-radius:12px;font-size:16px;font-weight:600;
        cursor:pointer;margin-bottom:10px">
        Looks right!
      </button>
      <button id="cs-rescan" style="
        display:block;width:100%;padding:12px;
        background:transparent;color:#888;
        border:1px solid #ddd;border-radius:12px;
        font-size:15px;cursor:pointer">
        Try again
      </button>
    `;

    card.querySelector('#cs-confirm').addEventListener('click', () => {
      this.stop();
      this.onDetected(shape);
    });

    card.querySelector('#cs-rescan').addEventListener('click', () => {
      card.remove();
      this._confirmed = false;
      this._lastShape = null;
      this._consecutiveHits = 0;
      this._finder.style.borderColor = 'rgba(255,255,255,0.75)';
      this._statusLabel.textContent = 'Point camera at your cake';
      this._intervalId = setInterval(() => this._scanFrame(), 600);
    });

    this._container.appendChild(card);
  }
}

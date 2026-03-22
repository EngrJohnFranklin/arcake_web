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
   *   B) Sobel edge detection (adaptive threshold)
   *   C) Bounding-box extraction
   *   D) Straight-line ratio via horizontal/vertical edge scan
   *   E) Rule-based classification (layered → square → heart → round)
   *
   * Key fix: square detection now uses the ratio of straight (axis-aligned)
   * edge pixels to total edge pixels instead of corner-proximity counts.
   * Straight edges dominate in square/rectangular cakes; curved edges
   * dominate in round ones. This is far more reliable with real camera input.
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

    // ── STEP B: Sobel edge detection with adaptive threshold ───
    // Compute gradient magnitudes first so we can pick a percentile threshold.
    const mag = new Float32Array(w * h);
    let maxMag = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
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
        const m = Math.sqrt(gx * gx + gy * gy);
        mag[y * w + x] = m;
        if (m > maxMag) maxMag = m;

        // Also store gradient direction (0=H, 1=V, 2=diagonal)
        // We'll use it in step D below — stash as a property on mag lazily.
      }
    }

    // Adaptive threshold: 20 % of peak magnitude (min 20, max 80).
    const EDGE_THRESHOLD = Math.min(80, Math.max(20, maxMag * 0.20));

    const edges = new Uint8Array(w * h);
    // gx/gy stored separately for the straight-line test
    const gxArr = new Int16Array(w * h);
    const gyArr = new Int16Array(w * h);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (mag[y * w + x] > EDGE_THRESHOLD) {
          edges[y * w + x] = 255;

          const tl = gray[(y - 1) * w + (x - 1)];
          const tr = gray[(y - 1) * w + (x + 1)];
          const ml = gray[y * w + (x - 1)];
          const mr = gray[y * w + (x + 1)];
          const bl = gray[(y + 1) * w + (x - 1)];
          const bm = gray[(y + 1) * w + x];
          const tm = gray[(y - 1) * w + x];
          const br = gray[(y + 1) * w + (x + 1)];
          gxArr[y * w + x] = -tl + tr - 2 * ml + 2 * mr - bl + br;
          gyArr[y * w + x] = -tl - 2 * tm - tr + bl + 2 * bm + br;
        }
      }
    }

    // ── STEP C: Bounding box & edge count ─────────────────────
    let minX = w, maxX = 0, minY = h, maxY = 0, edgeCount = 0;

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

    // Not enough edge signal → nothing detected
    if (edgeCount < 200) return null;

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    if (bboxW < 50 || bboxH < 50) return null;

    const aspectRatio = bboxW / bboxH;

    // ── STEP D: Straight-edge ratio ────────────────────────────
    // An edge pixel is "straight" (horizontal or vertical) when its gradient
    // direction is strongly axis-aligned: |gx| >> |gy|  (vertical boundary)
    // or |gy| >> |gx|  (horizontal boundary).
    // A round cake produces mostly diagonal/oblique gradients around the
    // circumference; a square cake produces long runs of purely H or V edges
    // along its flat sides.
    let straightEdges = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (edges[y * w + x] !== 255) continue;
        const ax = Math.abs(gxArr[y * w + x]);
        const ay = Math.abs(gyArr[y * w + x]);
        // "Straight" = one axis at least 2.5× stronger than the other
        if (ax > ay * 2.5 || ay > ax * 2.5) straightEdges++;
      }
    }

    const straightRatio = straightEdges / edgeCount;

    // ── STEP E: Classification ─────────────────────────────────

    // Rule 1 — LAYERED: significantly taller than wide (side-on view)
    if (bboxH > bboxW * 1.4) return 'layered';

    // Rule 2 — SQUARE: near-square aspect AND high straight-edge ratio.
    // Thresholds tuned for real-world overhead/angled cake photos.
    // straightRatio > 0.42 means most edges run H or V — typical of squares.
    if (aspectRatio >= 0.75 && aspectRatio <= 1.35 && straightRatio > 0.42) {
      return 'square';
    }

    // Rule 3 — HEART: near-square aspect + top-centre cleft depression
    if (aspectRatio >= 0.75 && aspectRatio <= 1.4) {
      const topBand = Math.max(4, Math.floor(bboxH * 0.20));
      const midLeft  = Math.floor(minX + bboxW * 0.33);
      const midRight = Math.floor(minX + bboxW * 0.67);

      let cleftEdges = 0;
      for (let y = minY; y < minY + topBand; y++) {
        for (let x = midLeft; x <= midRight; x++) {
          if (edges[y * w + x] === 255) cleftEdges++;
        }
      }

      const area = topBand * (midRight - midLeft + 1);
      if (area > 0 && cleftEdges / area < 0.035) return 'heart';
    }

    // Rule 4 — ROUND (default for anything not caught above)
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
  // AR PREVIEW SCREEN
  // ─────────────────────────────────────────────────────────────

  /**
   * After shape detection, keeps the live camera feed visible and
   * overlays a transparent Three.js canvas so the 3D cake floats
   * in the real-world environment (true AR preview).
   *
   * UI elements (badge, shape name, buttons) sit on top of the
   * cake canvas as a pointer-events overlay.
   *
   * @param {'round'|'square'|'heart'|'layered'} shape
   */
  async _showConfirmCard(shape) {
    const names = { round: 'Round', square: 'Square', heart: 'Heart', layered: 'Layered' };
    const shapeName = names[shape] ?? shape;

    // ── Hide scanner UI elements; camera feed stays ────────────
    this._finder.style.display = 'none';
    this._statusLabel.style.display = 'none';

    // ── Fullscreen transparent Three.js canvas ─────────────────
    const arCanvas = document.createElement('canvas');
    arCanvas.width  = window.innerWidth;
    arCanvas.height = window.innerHeight;
    arCanvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    this._container.appendChild(arCanvas);

    // ── UI overlay (on top of AR canvas) ──────────────────────
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:flex-end;padding-bottom:40px;' +
      'pointer-events:none;';

    // Shape label at top-centre
    const topLabel = document.createElement('div');
    topLabel.style.cssText =
      'position:absolute;top:22px;left:50%;transform:translateX(-50%);' +
      'display:flex;flex-direction:column;align-items:center;gap:6px;';

    const badge = document.createElement('div');
    badge.textContent = '✓  Shape Detected';
    badge.style.cssText =
      'background:rgba(76,175,80,0.22);color:#A5D6A7;' +
      'border:1px solid rgba(76,175,80,0.5);backdrop-filter:blur(8px);' +
      'font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;' +
      'padding:5px 14px;border-radius:50px;';
    topLabel.appendChild(badge);

    const nameTag = document.createElement('div');
    nameTag.textContent = `${shapeName} Cake`;
    nameTag.style.cssText =
      'color:#fff;font-size:20px;font-weight:700;' +
      'text-shadow:0 2px 12px rgba(0,0,0,0.6);letter-spacing:-0.2px;';
    topLabel.appendChild(nameTag);

    overlay.appendChild(topLabel);

    // Bottom action buttons
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText =
      'display:flex;flex-direction:column;gap:10px;' +
      'width:calc(100% - 40px);max-width:360px;pointer-events:auto;';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Customize This Cake  →';
    confirmBtn.style.cssText =
      'padding:16px;background:linear-gradient(135deg,#E91E8C,#C2185B);color:#fff;' +
      'border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;' +
      'box-shadow:0 6px 28px rgba(233,30,140,0.5);letter-spacing:0.2px;';

    const rescanBtn = document.createElement('button');
    rescanBtn.textContent = '↺  Scan Again';
    rescanBtn.style.cssText =
      'padding:13px;background:rgba(0,0,0,0.45);color:rgba(255,255,255,0.85);' +
      'border:1px solid rgba(255,255,255,0.25);border-radius:14px;backdrop-filter:blur(8px);' +
      'font-size:14px;font-weight:600;cursor:pointer;';

    btnWrap.appendChild(confirmBtn);
    btnWrap.appendChild(rescanBtn);
    overlay.appendChild(btnWrap);

    this._container.appendChild(overlay);

    // ── Spin up 3D cake (transparent bg → camera shows through) ─
    let previewScene = null;
    try {
      const { CakeScene } = await import('./cake.js');
      previewScene = new CakeScene(arCanvas, {
        autoRotate:  true,
        interactive: false,
        transparent: true,
        float:       true,
        rotateSpeed: 0.6,
      });
      previewScene.buildCake({
        shape,
        size:           'medium',
        flavor:         'vanilla',
        frostingStyle:  'smooth',
        frostingColor:  '#FFFFFF',
        toppings:       { sprinkles: null, fruits: null, candles: null, decorations: null },
        toppingQuantity:{ fruits: 3, candles: 2 },
        cakeText:       '',
        textFont:       'classic',
        textColor:      '#3D2B1F',
        boardColor:     '#8D6E63',
      });
    } catch (_) {
      // 3D init failed — buttons still work
    }

    // ── Resize: keep AR canvas synced to viewport ──────────────
    const onResize = () => {
      arCanvas.width  = window.innerWidth;
      arCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // ── Button handlers ────────────────────────────────────────
    const _cleanup = () => {
      window.removeEventListener('resize', onResize);
      if (previewScene) previewScene.dispose?.();
      arCanvas.remove();
      overlay.remove();
    };

    confirmBtn.addEventListener('click', () => {
      _cleanup();
      this.stop();
      this.onDetected(shape);
    });

    rescanBtn.addEventListener('click', () => {
      _cleanup();
      // Restore scanner UI
      this._finder.style.display = '';
      this._statusLabel.style.display = '';
      this._confirmed = false;
      this._lastShape = null;
      this._consecutiveHits = 0;
      this._finder.style.borderColor = 'rgba(255,255,255,0.75)';
      this._statusLabel.textContent = 'Point camera at your cake';
      this._intervalId = setInterval(() => this._scanFrame(), 600);
    });
  }
}

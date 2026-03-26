/**
 * shapeDetector.js
 *
 * A pure-JavaScript reimplementation of key OpenCV shape-detection
 * capabilities.  Uses only the HTML5 Canvas API and typed arrays —
 * zero external dependencies.
 *
 * Works as an ES Module inside the ARCake Vite + Three.js project.
 *
 * Public API
 * ──────────
 *   const detector = new ShapeDetector();
 *   const result   = detector.detect(canvasElement);
 *   detector.drawOverlay(canvasElement, result);
 *
 * @module shapeDetector
 */

// ═══════════════════════════════════════════════════════════════
// NAMED CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Maximum supported canvas dimension (width or height). */
const MAX_DIM = 1024;

/** Maximum pixel count for pre-allocated buffers. */
const MAX_PIXELS = MAX_DIM * MAX_DIM;

// ── Gaussian blur ──────────────────────────────────────────────
/** Separable 5-tap Gaussian kernel (σ ≈ 1.4, sums to 1.0). */
const GAUSS_KERNEL = new Float32Array([0.0625, 0.25, 0.375, 0.25, 0.0625]);
/** Half-width of the Gaussian kernel (2 pixels each side). */
const GAUSS_RADIUS = 2;

// ── Canny edge detection ───────────────────────────────────────
/** Low-threshold ratio relative to maximum gradient magnitude. */
const CANNY_LOW_RATIO = 0.10;
/** High-threshold ratio relative to maximum gradient magnitude. */
const CANNY_HIGH_RATIO = 0.30;

// ── Morphology ─────────────────────────────────────────────────
/** 3×3 structuring element radius. */
const MORPH_RADIUS = 1;

// ── Contour filtering ──────────────────────────────────────────
/** Minimum contour area in pixels to be considered valid. */
const MIN_CONTOUR_AREA = 800;

// ── Douglas-Peucker ────────────────────────────────────────────
/** Epsilon as a fraction of contour perimeter. */
const DP_EPSILON_RATIO = 0.02;

// ── Harris corner detection ────────────────────────────────────
/** Window half-size for the structure tensor accumulation. */
const HARRIS_WIN = 2;
/** Harris sensitivity parameter (k). */
const HARRIS_K = 0.05;
/** Non-maximum suppression radius for Harris responses. */
const HARRIS_NMS_RADIUS = 7;
/** Minimum distance to merge two Harris corners. */
const HARRIS_MERGE_DIST = 15;

// ── Classification weights ─────────────────────────────────────
/** Minimum total weighted score to accept a classification. */
const MIN_CONFIDENCE = 0.40;

// ── Heart heuristics ───────────────────────────────────────────
/** Minimum vertical symmetry to consider heart candidacy. */
const HEART_SYM_MIN = 0.60;
/** Valley depth as fraction of bbox height for hump detection. */
const HEART_VALLEY_FRAC = 0.05;
/** Maximum bottom width as fraction of bbox width. */
const HEART_BOTTOM_FRAC = 0.15;

// ── 8-connected Moore neighbourhood (CW from East) ────────────
const MOORE_DX = new Int32Array([1, 1, 0, -1, -1, -1, 0, 1]);
const MOORE_DY = new Int32Array([0, 1, 1, 1, 0, -1, -1, -1]);

// ═══════════════════════════════════════════════════════════════
// ShapeDetector CLASS
// ═══════════════════════════════════════════════════════════════

class ShapeDetector {
  /**
   * Creates a ShapeDetector instance and pre-allocates all typed-
   * array buffers for up to MAX_DIM × MAX_DIM pixels.  Buffers are
   * reused on every `detect()` call to avoid GC pressure.
   */
  constructor() {
    // ── Pre-allocated pixel buffers ────────────────────────────
    /** @type {Uint8Array} Grayscale image (Stage 1). */
    this._gray = new Uint8Array(MAX_PIXELS);
    /** @type {Uint8Array} Blurred grayscale (Stage 2). */
    this._blur = new Uint8Array(MAX_PIXELS);
    /** @type {Float32Array} Horizontal blur intermediate. */
    this._blurTmp = new Float32Array(MAX_PIXELS);
    /** @type {Uint8Array} Binary image after Otsu (Stage 3). */
    this._binary = new Uint8Array(MAX_PIXELS);
    /** @type {Float32Array} Sobel Gx. */
    this._gx = new Float32Array(MAX_PIXELS);
    /** @type {Float32Array} Sobel Gy. */
    this._gy = new Float32Array(MAX_PIXELS);
    /** @type {Float32Array} Gradient magnitude. */
    this._mag = new Float32Array(MAX_PIXELS);
    /** @type {Float32Array} Gradient direction in radians. */
    this._dir = new Float32Array(MAX_PIXELS);
    /** @type {Uint8Array} Edge map after NMS (temporary). */
    this._nms = new Uint8Array(MAX_PIXELS);
    /** @type {Uint8Array} Final edge map after hysteresis (Stage 4). */
    this._edge = new Uint8Array(MAX_PIXELS);
    /** @type {Uint8Array} Morphology scratch buffer A. */
    this._morphA = new Uint8Array(MAX_PIXELS);
    /** @type {Uint8Array} Morphology scratch buffer B. */
    this._morphB = new Uint8Array(MAX_PIXELS);
    /** @type {Uint8Array} Contour visited-flag map. */
    this._visited = new Uint8Array(MAX_PIXELS);
    /** @type {Float32Array} Harris response buffer. */
    this._harris = new Float32Array(MAX_PIXELS);
    /** @type {Int32Array} Flood-fill / BFS queue (max possible size). */
    this._queue = new Int32Array(MAX_PIXELS);

    // ── Cached per-detect state ────────────────────────────────
    /** @type {number} Current image width. */
    this._w = 0;
    /** @type {number} Current image height. */
    this._h = 0;
    /** @type {number} Current image pixel count. */
    this._n = 0;

    // ── Heart hump cache (populated during heart analysis) ─────
    /** @type {{x:number,y:number}|null} Left hump peak. */
    this._humpL = null;
    /** @type {{x:number,y:number}|null} Right hump peak. */
    this._humpR = null;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /**
   * Runs the full 12-stage shape-detection pipeline on a canvas.
   *
   * @param {HTMLCanvasElement} canvas - Source canvas with image data.
   * @returns {{
   *   shape: 'circle'|'square'|'rectangle'|'triangle'|'heart'|'unknown',
   *   confidence: number,
   *   boundingBox: {x:number, y:number, width:number, height:number},
   *   corners: Array<{x:number, y:number}>,
   *   symmetry: {horizontal:number, vertical:number},
   *   aspectRatio: number,
   *   debugInfo: {edgeCount:number, cornerCount:number, circularity:number, elongation:number}
   * }}
   */
  detect(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    this._w = w;
    this._h = h;
    this._n = w * h;
    this._humpL = null;
    this._humpR = null;

    const rgba = ctx.getImageData(0, 0, w, h).data;

    // Stage 1 — Grayscale
    this._grayscale(rgba, w, h);

    // Stage 2 — Gaussian blur
    this._gaussianBlur(w, h);

    // Stage 3 — Otsu threshold
    this._otsu(w, h);

    // Stage 3b — Ensure object is foreground (255), background is 0
    this._ensureForeground(w, h);

    // Stage 4 — Canny edge detection (used for Harris corners only)
    this._canny(w, h);

    // Stage 5 — Morphological close then open on BINARY mask
    //   (Operating on thin Canny edges would destroy them;
    //    the filled binary mask is the correct target.)
    this._close(this._binary, w, h);
    this._open(this._binary, w, h);

    // Stage 6 — Contour finding on binary mask
    const contours = this._findContours(w, h);
    if (contours.length === 0) {
      return this._unknownResult(w, h);
    }

    // Select the contour with the largest area
    let primary = contours[0];
    for (let i = 1; i < contours.length; i++) {
      if (contours[i].area > primary.area) primary = contours[i];
    }

    // Stage 7 — Douglas-Peucker polygon approximation
    const epsilon = DP_EPSILON_RATIO * primary.perimeter;
    const simplified = this._douglasPeucker(primary.points, epsilon);
    const dpCornerCount = simplified.length;

    // Stage 8 — Harris corners
    const harrisCorners = this._harrisCorners(w, h);

    // Stage 9 — Symmetry analysis
    const bb = primary.boundingBox;
    const symmetry = this._symmetry(bb, w, h);

    // Stage 10 — Circularity and convexity
    const circularity = this._circularity(primary.area, primary.perimeter);
    const hullPts = this._convexHull(primary.points);
    const hullArea = this._polygonArea(hullPts);
    const convexity = hullArea > 0 ? primary.area / hullArea : 0;

    // Aspect ratio & elongation
    const aspectRatio = bb.height > 0 ? bb.width / bb.height : 1;
    const elongation = Math.max(aspectRatio, 1 / (aspectRatio || 1));

    // Edge count (number of edge-on pixels)
    let edgeCount = 0;
    for (let i = 0; i < this._n; i++) {
      if (this._edge[i] === 255) edgeCount++;
    }

    // Stage 11 — Heart-specific analysis
    const heartInfo = this._heartAnalysis(primary, bb, symmetry.vertical, w, h);

    // Stage 12 — Weighted classification
    const classification = this._classify(
      circularity, dpCornerCount, harrisCorners.length,
      aspectRatio, elongation, symmetry, convexity, heartInfo
    );

    return {
      shape: classification.shape,
      confidence: classification.confidence,
      boundingBox: bb,
      corners: simplified,
      symmetry,
      aspectRatio,
      debugInfo: {
        edgeCount,
        cornerCount: dpCornerCount,
        circularity,
        elongation,
      },
      // Internal extras for overlay drawing
      _contour: primary.points,
      _harrisCorners: harrisCorners,
      _hull: hullPts,
      _centroid: primary.centroid,
      _humpL: this._humpL,
      _humpR: this._humpR,
    };
  }

  /**
   * Draws a rich debug overlay on top of the given canvas using
   * the result from a previous `detect()` call.
   *
   * @param {HTMLCanvasElement} canvas  - The canvas to draw on.
   * @param {object}           result  - Return value of `detect()`.
   * @returns {void}
   */
  drawOverlay(canvas, result) {
    const ctx = canvas.getContext('2d');
    const bb = result.boundingBox;

    // ── Convex hull (semi-transparent cyan fill) ───────────────
    const hull = result._hull;
    if (hull && hull.length > 2) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ── Contour polyline (green) ───────────────────────────────
    const contour = result._contour;
    if (contour && contour.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(contour[0].x, contour[0].y);
      for (let i = 1; i < contour.length; i++) ctx.lineTo(contour[i].x, contour[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // ── Bounding box (blue dashed) ─────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#3399FF';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bb.x, bb.y, bb.width, bb.height);
    ctx.setLineDash([]);
    ctx.restore();

    // ── Vertical symmetry axis ─────────────────────────────────
    if (result.symmetry.vertical > 0.72) {
      const cx = bb.x + bb.width / 2;
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, bb.y);
      ctx.lineTo(cx, bb.y + bb.height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Centroid crosshair (magenta) ───────────────────────────
    if (result._centroid) {
      const cx = result._centroid.x;
      const cy = result._centroid.y;
      ctx.save();
      ctx.strokeStyle = '#FF00FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
      ctx.stroke();
      ctx.restore();
    }

    // ── Douglas-Peucker vertices (red circles, white border) ───
    const corners = result.corners;
    if (corners) {
      ctx.save();
      for (const c of corners) {
        ctx.fillStyle = '#FF3333';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Harris corners (yellow X markers) ──────────────────────
    const hc = result._harrisCorners;
    if (hc) {
      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      for (const p of hc) {
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5);
        ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Heart hump peaks (orange circles) ──────────────────────
    if (result.shape === 'heart') {
      ctx.save();
      ctx.fillStyle = '#FF8C00';
      for (const hp of [result._humpL, result._humpR]) {
        if (hp) {
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 6, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ── Label badge (pill above bounding box) ──────────────────
    const label = `${result.shape}  ${(result.confidence * 100).toFixed(0)}%`;
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    const tm = ctx.measureText(label);
    const pw = tm.width + 20;
    const ph = 24;
    const px = bb.x + (bb.width - pw) / 2;
    const py = bb.y - ph - 6;

    // Pill background
    const radius = ph / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.moveTo(px + radius, py);
    ctx.lineTo(px + pw - radius, py);
    ctx.arc(px + pw - radius, py + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(px + radius, py + ph);
    ctx.arc(px + radius, py + radius, radius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + 10, py + ph / 2);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 1 — GRAYSCALE (ITU-R BT.601)
  // ─────────────────────────────────────────────────────────────

  /**
   * Converts RGBA pixel data to single-channel grayscale using the
   * BT.601 luminance formula: Y = 0.299R + 0.587G + 0.114B.
   * Equivalent to OpenCV cvtColor(src, dst, COLOR_RGBA2GRAY).
   *
   * @param {Uint8ClampedArray} rgba - RGBA pixel buffer from getImageData.
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Result stored in this._gray.
   */
  _grayscale(rgba, w, h) {
    const dst = this._gray;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const j = i << 2; // RGBA offset = i * 4
      // BT.601: fixed-point multiply then shift for speed
      dst[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2 — GAUSSIAN BLUR (separable 5-tap, σ ≈ 1.4)
  // ─────────────────────────────────────────────────────────────

  /**
   * Applies a 5×5 Gaussian blur via two separable 1-D passes
   * (horizontal then vertical).  O(n·k) instead of O(n·k²).
   * Equivalent to OpenCV GaussianBlur(src, dst, Size(5,5), 1.4).
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Result stored in this._blur.
   */
  _gaussianBlur(w, h) {
    const src = this._gray;
    const tmp = this._blurTmp;
    const dst = this._blur;
    const k = GAUSS_KERNEL;
    const r = GAUSS_RADIUS; // 2

    // Horizontal pass → tmp (Float32 for precision)
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) {
          // Clamp to image bounds (replicate border)
          const sx = x + d < 0 ? 0 : x + d >= w ? w - 1 : x + d;
          s += src[row + sx] * k[d + r];
        }
        tmp[row + x] = s;
      }
    }

    // Vertical pass → dst (truncated back to Uint8)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) {
          const sy = y + d < 0 ? 0 : y + d >= h ? h - 1 : y + d;
          s += tmp[sy * w + x] * k[d + r];
        }
        dst[y * w + x] = s + 0.5 | 0; // Round to nearest integer
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 3 — OTSU THRESHOLDING
  // ─────────────────────────────────────────────────────────────

  /**
   * Computes the Otsu optimal binary threshold on the blurred image
   * and produces a binary mask with values 0 or 255.
   * Equivalent to OpenCV threshold(src, dst, 0, 255, THRESH_BINARY | THRESH_OTSU).
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Result stored in this._binary.
   */
  _otsu(w, h) {
    const src = this._blur;
    const dst = this._binary;
    const n = w * h;

    // Build 256-bin histogram
    const hist = new Int32Array(256);
    for (let i = 0; i < n; i++) hist[src[i]]++;

    // Find threshold maximising inter-class variance
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    let wB = 0;       // weight background
    let sumB = 0;      // cumulative mean background
    let bestVar = 0;
    let bestT = 0;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = n - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const diff = mB - mF;

      // σ²_between = wB · wF · (mB − mF)²
      const variance = wB * wF * diff * diff;
      if (variance > bestVar) {
        bestVar = variance;
        bestT = t;
      }
    }

    // Apply threshold
    for (let i = 0; i < n; i++) {
      dst[i] = src[i] > bestT ? 255 : 0;
    }
  }

  /**
   * Ensures that the foreground object is 255 and the background is 0.
   * After Otsu, the polarity may be inverted (bright background → 255).
   * We check the image border: if most border pixels are 255, invert.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} May invert this._binary in-place.
   */
  _ensureForeground(w, h) {
    const bin = this._binary;
    let borderFG = 0, borderTotal = 0;

    // Top and bottom rows
    for (let x = 0; x < w; x++) {
      borderTotal += 2;
      if (bin[x] === 255) borderFG++;
      if (bin[(h - 1) * w + x] === 255) borderFG++;
    }
    // Left and right columns (excluding corners already counted)
    for (let y = 1; y < h - 1; y++) {
      borderTotal += 2;
      if (bin[y * w] === 255) borderFG++;
      if (bin[y * w + w - 1] === 255) borderFG++;
    }

    // If border is mostly foreground, the polarity is inverted — flip
    if (borderFG > borderTotal * 0.6) {
      const n = w * h;
      for (let i = 0; i < n; i++) {
        bin[i] = bin[i] === 255 ? 0 : 255;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 4 — CANNY EDGE DETECTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Full Canny edge detection: Sobel gradients → magnitude/direction →
   * non-maximum suppression → double-threshold → hysteresis.
   * Equivalent to OpenCV Canny(src, dst, lowT, highT).
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Result stored in this._edge (0 or 255).
   */
  _canny(w, h) {
    this._sobel(w, h);
    this._nonMaxSuppression(w, h);
    this._hysteresis(w, h);
  }

  /**
   * Applies 3×3 Sobel operators to compute Gx, Gy, magnitude, and
   * quantised gradient direction for every pixel.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void}
   */
  _sobel(w, h) {
    const src = this._blur;
    const gx = this._gx;
    const gy = this._gy;
    const mag = this._mag;
    const dir = this._dir;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;

        // 3×3 neighbourhood values
        const tl = src[idx - w - 1]; // top-left
        const tm = src[idx - w];     // top-mid
        const tr = src[idx - w + 1]; // top-right
        const ml = src[idx - 1];     // mid-left
        const mr = src[idx + 1];     // mid-right
        const bl = src[idx + w - 1]; // bot-left
        const bm = src[idx + w];     // bot-mid
        const br = src[idx + w + 1]; // bot-right

        // Sobel horizontal kernel: [[-1,0,1],[-2,0,2],[-1,0,1]]
        const gxVal = -tl + tr - 2 * ml + 2 * mr - bl + br;
        // Sobel vertical kernel: [[-1,-2,-1],[0,0,0],[1,2,1]]
        const gyVal = -tl - 2 * tm - tr + bl + 2 * bm + br;

        gx[idx] = gxVal;
        gy[idx] = gyVal;
        mag[idx] = Math.sqrt(gxVal * gxVal + gyVal * gyVal);
        dir[idx] = Math.atan2(gyVal, gxVal);
      }
    }
  }

  /**
   * Non-maximum suppression: keeps only local maxima along the
   * gradient direction, thinning edges to 1-pixel width.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Thin edges stored in this._nms.
   */
  _nonMaxSuppression(w, h) {
    const mag = this._mag;
    const dir = this._dir;
    const nms = this._nms;

    // Clear NMS buffer for current image region
    for (let i = 0; i < w * h; i++) nms[i] = 0;

    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const idx = y * w + x;
        const m = mag[idx];
        if (m < 1) continue;

        // Quantise direction to 4 bins: 0°, 45°, 90°, 135°
        let angle = dir[idx] * (180 / Math.PI);
        if (angle < 0) angle += 180;

        let n1, n2;
        if (angle < 22.5 || angle >= 157.5) {
          // 0° — compare east and west
          n1 = mag[idx - 1];
          n2 = mag[idx + 1];
        } else if (angle < 67.5) {
          // 45° — compare NE and SW
          n1 = mag[idx - w + 1];
          n2 = mag[idx + w - 1];
        } else if (angle < 112.5) {
          // 90° — compare north and south
          n1 = mag[idx - w];
          n2 = mag[idx + w];
        } else {
          // 135° — compare NW and SE
          n1 = mag[idx - w - 1];
          n2 = mag[idx + w + 1];
        }

        // Keep pixel only if it is the local maximum
        if (m >= n1 && m >= n2) nms[idx] = m > 255 ? 255 : m | 0;
      }
    }
  }

  /**
   * Double-threshold + hysteresis edge linking.  Strong pixels seed
   * a BFS that promotes connected weak pixels to strong.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void} Final edges in this._edge (0 or 255).
   */
  _hysteresis(w, h) {
    const nms = this._nms;
    const edge = this._edge;
    const queue = this._queue;
    const n = w * h;

    // Clear edge buffer
    for (let i = 0; i < n; i++) edge[i] = 0;

    // Find maximum gradient magnitude for threshold computation
    let maxMag = 0;
    for (let i = 0; i < n; i++) {
      if (nms[i] > maxMag) maxMag = nms[i];
    }

    const highT = maxMag * CANNY_HIGH_RATIO;
    const lowT = maxMag * CANNY_LOW_RATIO;

    // Tag strong (2) and weak (1) edge pixels
    let front = 0;
    let back = 0;
    for (let i = 0; i < n; i++) {
      if (nms[i] >= highT) {
        edge[i] = 255;
        queue[back++] = i; // Seed BFS from strong pixels
      } else if (nms[i] >= lowT) {
        edge[i] = 1; // Weak — may be promoted
      }
    }

    // BFS: promote weak pixels connected to strong ones
    while (front < back) {
      const idx = queue[front++];
      const iy = (idx / w) | 0;
      const ix = idx - iy * w;
      for (let d = 0; d < 8; d++) {
        const nx = ix + MOORE_DX[d];
        const ny = iy + MOORE_DY[d];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (edge[ni] === 1) {
          edge[ni] = 255;
          queue[back++] = ni;
        }
      }
    }

    // Remove any remaining weak pixels (not connected to strong)
    for (let i = 0; i < n; i++) {
      if (edge[i] !== 255) edge[i] = 0;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 5 — MORPHOLOGICAL OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Morphological erosion with a 3×3 structuring element.
   * A pixel remains 255 only if ALL 9 neighbours are 255.
   * Equivalent to OpenCV erode(src, dst, Mat::ones(3,3)).
   *
   * @param {Uint8Array} src - Input binary image.
   * @param {Uint8Array} dst - Output binary image.
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void}
   */
  _erode(src, dst, w, h) {
    for (let i = 0; i < w * h; i++) dst[i] = 0;

    for (let y = MORPH_RADIUS; y < h - MORPH_RADIUS; y++) {
      for (let x = MORPH_RADIUS; x < w - MORPH_RADIUS; x++) {
        let all = true;
        for (let ky = -MORPH_RADIUS; ky <= MORPH_RADIUS && all; ky++) {
          for (let kx = -MORPH_RADIUS; kx <= MORPH_RADIUS && all; kx++) {
            if (src[(y + ky) * w + (x + kx)] !== 255) all = false;
          }
        }
        dst[y * w + x] = all ? 255 : 0;
      }
    }
  }

  /**
   * Morphological dilation with a 3×3 structuring element.
   * A pixel becomes 255 if ANY neighbour is 255.
   * Equivalent to OpenCV dilate(src, dst, Mat::ones(3,3)).
   *
   * @param {Uint8Array} src - Input binary image.
   * @param {Uint8Array} dst - Output binary image.
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void}
   */
  _dilate(src, dst, w, h) {
    for (let i = 0; i < w * h; i++) dst[i] = 0;

    for (let y = MORPH_RADIUS; y < h - MORPH_RADIUS; y++) {
      for (let x = MORPH_RADIUS; x < w - MORPH_RADIUS; x++) {
        let any = false;
        for (let ky = -MORPH_RADIUS; ky <= MORPH_RADIUS && !any; ky++) {
          for (let kx = -MORPH_RADIUS; kx <= MORPH_RADIUS && !any; kx++) {
            if (src[(y + ky) * w + (x + kx)] === 255) any = true;
          }
        }
        dst[y * w + x] = any ? 255 : 0;
      }
    }
  }

  /**
   * Morphological close (dilate → erode).  Seals small gaps in
   * contour boundaries.
   *
   * @param {Uint8Array} buf - Binary image (modified in-place).
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void}
   */
  _close(buf, w, h) {
    this._dilate(buf, this._morphA, w, h);
    this._erode(this._morphA, this._morphB, w, h);
    // Copy result back into buf
    const n = w * h;
    const src = this._morphB;
    for (let i = 0; i < n; i++) buf[i] = src[i];
  }

  /**
   * Morphological open (erode → dilate).  Removes isolated noise
   * pixels outside the shape.
   *
   * @param {Uint8Array} buf - Binary image (modified in-place).
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {void}
   */
  _open(buf, w, h) {
    this._erode(buf, this._morphA, w, h);
    this._dilate(this._morphA, this._morphB, w, h);
    const n = w * h;
    const src = this._morphB;
    for (let i = 0; i < n; i++) buf[i] = src[i];
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 6 — CONTOUR FINDING (Moore neighbourhood tracing)
  // ─────────────────────────────────────────────────────────────

  /**
   * Extracts all external contours from the binary edge map using
   * Moore neighbourhood contour tracing.
   * Equivalent to OpenCV findContours(src, contours, RETR_EXTERNAL, CHAIN_APPROX_NONE).
   *
   * Each returned contour includes points, area, perimeter, bounding
   * box, and centroid.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {Array<{
   *   points: Array<{x:number,y:number}>,
   *   area: number,
   *   perimeter: number,
   *   boundingBox: {x:number,y:number,width:number,height:number},
   *   centroid: {x:number,y:number}
   * }>}
   */
  _findContours(w, h) {
    const img = this._binary;       // ◀ trace on filled binary, NOT thin edges
    const vis = this._visited;
    const n = w * h;

    // Clear visited buffer
    for (let i = 0; i < n; i++) vis[i] = 0;

    const contours = [];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (img[idx] !== 255 || vis[idx]) continue;

        // Check this is a border pixel (foreground with ≥1 background 4-neighbour)
        const hasBackground =
          img[idx - 1] === 0 || img[idx + 1] === 0 ||
          img[idx - w] === 0 || img[idx + w] === 0;
        if (!hasBackground) { vis[idx] = 1; continue; }

        // Trace contour using Moore neighbourhood algorithm
        const pts = [];
        let cx = x, cy = y;
        let dir = 0; // Start searching from East
        const startKey = cy * w + cx;
        let steps = 0;
        const maxSteps = n; // Safety limit

        do {
          pts.push({ x: cx, y: cy });
          vis[cy * w + cx] = 1;

          // Search for next boundary pixel CW from backtrack direction
          const searchStart = (dir + 5) & 7; // (dir + 5) % 8 — back-step
          let found = false;
          for (let i = 0; i < 8; i++) {
            const sd = (searchStart + i) & 7;
            const nx = cx + MOORE_DX[sd];
            const ny = cy + MOORE_DY[sd];
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (img[ny * w + nx] === 255) {
              dir = sd;
              cx = nx;
              cy = ny;
              found = true;
              break;
            }
          }
          if (!found) break;
          steps++;
        } while ((cy * w + cx) !== startKey && steps < maxSteps);

        if (pts.length < 8) continue; // Too small to be meaningful

        // Compute contour properties
        const area = this._polygonArea(pts);
        if (area < MIN_CONTOUR_AREA) continue;

        let perimeter = 0;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          const dx = pts[j].x - pts[i].x;
          const dy = pts[j].y - pts[i].y;
          perimeter += Math.sqrt(dx * dx + dy * dy);
        }

        // Bounding box
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
          sumX += p.x;
          sumY += p.y;
        }

        contours.push({
          points: pts,
          area,
          perimeter,
          boundingBox: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
          centroid: {
            x: sumX / pts.length,
            y: sumY / pts.length,
          },
        });
      }
    }

    return contours;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 7 — DOUGLAS-PEUCKER POLYGON APPROXIMATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Simplifies a polygon using the Douglas-Peucker algorithm.
   * Equivalent to OpenCV approxPolyDP(contour, result, epsilon, true).
   *
   * @param {Array<{x:number,y:number}>} pts - Ordered contour points.
   * @param {number} epsilon - Maximum perpendicular distance tolerance.
   * @returns {Array<{x:number,y:number}>} Simplified polygon vertices.
   */
  _douglasPeucker(pts, epsilon) {
    const n = pts.length;
    if (n < 3) return pts.slice();

    const keep = new Uint8Array(n);
    keep[0] = 1;
    keep[n - 1] = 1;

    // Iterative stack-based implementation (avoids recursion depth limits)
    const stack = [[0, n - 1]];
    while (stack.length > 0) {
      const [start, end] = stack.pop();
      const x0 = pts[start].x, y0 = pts[start].y;
      const x1 = pts[end].x, y1 = pts[end].y;
      const dx = x1 - x0, dy = y1 - y0;
      const len2 = dx * dx + dy * dy;

      let maxDist = 0, maxIdx = start;
      for (let i = start + 1; i < end; i++) {
        const px = pts[i].x - x0, py = pts[i].y - y0;
        let d;
        if (len2 === 0) {
          // Degenerate segment — use Euclidean distance to endpoint
          d = Math.sqrt(px * px + py * py);
        } else {
          // Perpendicular distance to the line segment
          const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
          const ex = px - t * dx, ey = py - t * dy;
          d = Math.sqrt(ex * ex + ey * ey);
        }
        if (d > maxDist) { maxDist = d; maxIdx = i; }
      }

      if (maxDist > epsilon) {
        keep[maxIdx] = 1;
        if (maxIdx - start > 1) stack.push([start, maxIdx]);
        if (end - maxIdx > 1) stack.push([maxIdx, end]);
      }
    }

    const result = [];
    for (let i = 0; i < n; i++) {
      if (keep[i]) result.push({ x: pts[i].x, y: pts[i].y });
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 8 — HARRIS CORNER DETECTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Detects corners using the Harris response function with NMS
   * and clustering.
   * Equivalent to OpenCV cornerHarris(src, dst, blockSize, ksize, k).
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {Array<{x:number,y:number}>} Detected corner positions.
   */
  _harrisCorners(w, h) {
    const gx = this._gx;
    const gy = this._gy;
    const edge = this._edge;
    const harris = this._harris;
    const n = w * h;
    const W = HARRIS_WIN; // 2

    // Clear response buffer
    for (let i = 0; i < n; i++) harris[i] = 0;

    // Compute Harris response only at edge pixels for speed
    for (let y = W + 1; y < h - W - 1; y++) {
      for (let x = W + 1; x < w - W - 1; x++) {
        const idx = y * w + x;
        if (edge[idx] !== 255) continue;

        // Accumulate structure tensor over (2W+1)×(2W+1) window
        let m11 = 0, m22 = 0, m12 = 0;
        for (let ky = -W; ky <= W; ky++) {
          for (let kx = -W; kx <= W; kx++) {
            const ki = (y + ky) * w + (x + kx);
            const gxv = gx[ki], gyv = gy[ki];
            m11 += gxv * gxv; // ΣGx²
            m22 += gyv * gyv; // ΣGy²
            m12 += gxv * gyv; // ΣGxGy
          }
        }

        // R = det(M) − k·trace(M)²
        const det = m11 * m22 - m12 * m12;
        const trace = m11 + m22;
        harris[idx] = det - HARRIS_K * trace * trace;
      }
    }

    // Threshold: keep only responses above 1% of the maximum
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      if (harris[i] > maxR) maxR = harris[i];
    }
    const threshR = maxR * 0.01;

    // Non-maximum suppression within HARRIS_NMS_RADIUS
    const NR = HARRIS_NMS_RADIUS;
    const raw = [];
    for (let y = NR; y < h - NR; y++) {
      for (let x = NR; x < w - NR; x++) {
        const idx = y * w + x;
        const r = harris[idx];
        if (r < threshR) continue;

        let isMax = true;
        outer: for (let ky = -NR; ky <= NR; ky++) {
          for (let kx = -NR; kx <= NR; kx++) {
            if (ky === 0 && kx === 0) continue;
            if (harris[(y + ky) * w + (x + kx)] > r) {
              isMax = false;
              break outer;
            }
          }
        }
        if (isMax) raw.push({ x, y, r });
      }
    }

    // Cluster corners within HARRIS_MERGE_DIST pixels
    const merged = [];
    const used = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      if (used[i]) continue;
      let sx = raw[i].x, sy = raw[i].y, cnt = 1;
      used[i] = 1;
      for (let j = i + 1; j < raw.length; j++) {
        if (used[j]) continue;
        const dx = raw[j].x - raw[i].x;
        const dy = raw[j].y - raw[i].y;
        if (dx * dx + dy * dy < HARRIS_MERGE_DIST * HARRIS_MERGE_DIST) {
          sx += raw[j].x;
          sy += raw[j].y;
          cnt++;
          used[j] = 1;
        }
      }
      merged.push({ x: (sx / cnt) | 0, y: (sy / cnt) | 0 });
    }

    return merged;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 9 — SYMMETRY ANALYSIS
  // ─────────────────────────────────────────────────────────────

  /**
   * Measures vertical and horizontal symmetry within the bounding
   * box of the detected shape using the Otsu binary image.
   *
   * @param {{x:number,y:number,width:number,height:number}} bb - Bounding box.
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {{horizontal:number, vertical:number}} Symmetry scores (0–1).
   */
  _symmetry(bb, w, h) {
    const bin = this._binary;
    const bx = bb.x, by = bb.y, bw = bb.width, bh = bb.height;
    if (bw < 4 || bh < 4) return { horizontal: 0, vertical: 0 };

    // ── Vertical symmetry (left vs mirrored-right) ─────────────
    const halfW = (bw / 2) | 0;
    let vMatch = 0, vTotal = 0;
    for (let y = 0; y < bh; y++) {
      const ry = by + y;
      if (ry < 0 || ry >= h) continue;
      for (let x = 0; x < halfW; x++) {
        const lx = bx + x;
        const rx = bx + bw - 1 - x; // Mirrored column
        if (lx < 0 || lx >= w || rx < 0 || rx >= w) continue;
        vTotal++;
        const lv = bin[ry * w + lx] > 0 ? 1 : 0;
        const rv = bin[ry * w + rx] > 0 ? 1 : 0;
        if (lv === rv) vMatch++;
      }
    }

    // ── Horizontal symmetry (top vs mirrored-bottom) ───────────
    const halfH = (bh / 2) | 0;
    let hMatch = 0, hTotal = 0;
    for (let y = 0; y < halfH; y++) {
      const ty = by + y;
      const bby = by + bh - 1 - y; // Mirrored row
      if (ty < 0 || ty >= h || bby < 0 || bby >= h) continue;
      for (let x = 0; x < bw; x++) {
        const cx = bx + x;
        if (cx < 0 || cx >= w) continue;
        hTotal++;
        const tv = bin[ty * w + cx] > 0 ? 1 : 0;
        const bv = bin[bby * w + cx] > 0 ? 1 : 0;
        if (tv === bv) hMatch++;
      }
    }

    return {
      horizontal: hTotal > 0 ? hMatch / hTotal : 0,
      vertical: vTotal > 0 ? vMatch / vTotal : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 10 — CIRCULARITY & CONVEXITY
  // ─────────────────────────────────────────────────────────────

  /**
   * Computes circularity = 4π·area / perimeter².
   * A perfect circle = 1.0; a square ≈ 0.785.
   *
   * @param {number} area - Contour area.
   * @param {number} perimeter - Contour perimeter.
   * @returns {number} Circularity (0–1).
   */
  _circularity(area, perimeter) {
    if (perimeter === 0) return 0;
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  /**
   * Computes the convex hull of a set of points using the Graham
   * scan algorithm.  Returns hull vertices in counter-clockwise order.
   *
   * @param {Array<{x:number,y:number}>} pts - Input points.
   * @returns {Array<{x:number,y:number}>} Convex hull vertices (CCW).
   */
  _convexHull(pts) {
    const n = pts.length;
    if (n < 3) return pts.slice();

    // Sort by x then y
    const sorted = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);

    // Andrew's monotone chain (equivalent to Graham scan, numerically stable)
    const hull = [];

    // Lower hull
    for (let i = 0; i < n; i++) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2];
        const b = hull[hull.length - 1];
        const cross = (b.x - a.x) * (sorted[i].y - a.y) -
                      (b.y - a.y) * (sorted[i].x - a.x);
        if (cross <= 0) hull.pop(); else break;
      }
      hull.push(sorted[i]);
    }

    // Upper hull
    const lower = hull.length + 1;
    for (let i = n - 2; i >= 0; i--) {
      while (hull.length >= lower) {
        const a = hull[hull.length - 2];
        const b = hull[hull.length - 1];
        const cross = (b.x - a.x) * (sorted[i].y - a.y) -
                      (b.y - a.y) * (sorted[i].x - a.x);
        if (cross <= 0) hull.pop(); else break;
      }
      hull.push(sorted[i]);
    }

    hull.pop(); // Remove duplicate of first point
    return hull;
  }

  /**
   * Computes the area of a polygon using the shoelace formula.
   * Area = ½ |Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|
   *
   * @param {Array<{x:number,y:number}>} pts - Ordered polygon vertices.
   * @returns {number} Unsigned area.
   */
  _polygonArea(pts) {
    const n = pts.length;
    if (n < 3) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(sum) / 2;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 11 — HEART SHAPE DETECTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Dedicated heart-shape analysis: checks for two top humps with
   * a valley between them, and a sharp bottom point.
   *
   * @param {object} contour - Primary contour object with points and boundingBox.
   * @param {{x:number,y:number,width:number,height:number}} bb - Bounding box.
   * @param {number} vSym - Vertical symmetry score (0–1).
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {{hasHumps:boolean, hasBottomPoint:boolean, score:number}}
   */
  _heartAnalysis(contour, bb, vSym, w, h) {
    const pts = contour.points;
    const result = { hasHumps: false, hasBottomPoint: false, score: 0 };

    if (vSym < HEART_SYM_MIN) return result;

    const bx = bb.x, by = bb.y, bw = bb.width, bh = bb.height;
    if (bw < 10 || bh < 10) return result;

    // ── Two-hump detection in top 1/3 ──────────────────────────
    // Split top third into left and right halves; find highest
    // contour point (lowest y) in each half.
    const topY = by + bh / 3;
    const midX = bx + bw / 2;

    let leftPeak = null;   // Highest point in left half
    let rightPeak = null;  // Highest point in right half
    let leftMinY = Infinity;
    let rightMinY = Infinity;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.y > topY) continue; // Only top third
      if (p.x < midX) {
        if (p.y < leftMinY) { leftMinY = p.y; leftPeak = p; }
      } else {
        if (p.y < rightMinY) { rightMinY = p.y; rightPeak = p; }
      }
    }

    // Check for valley between the two peaks
    if (leftPeak && rightPeak) {
      // Find maximum y (deepest point) on contour between the two peaks' x range
      let valleyY = -Infinity;
      const lx = Math.min(leftPeak.x, rightPeak.x);
      const rx = Math.max(leftPeak.x, rightPeak.x);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x >= lx && p.x <= rx && p.y <= topY && p.y > valleyY) {
          valleyY = p.y;
        }
      }

      const valleyDepth = valleyY - Math.max(leftMinY, rightMinY);
      const requiredDepth = bh * HEART_VALLEY_FRAC;

      if (valleyDepth >= requiredDepth) {
        result.hasHumps = true;
        this._humpL = leftPeak ? { x: leftPeak.x, y: leftPeak.y } : null;
        this._humpR = rightPeak ? { x: rightPeak.x, y: rightPeak.y } : null;
      }
    }

    // ── Sharp bottom point detection in bottom 1/3 ─────────────
    const botY = by + bh * 2 / 3;
    let minBotWidth = Infinity;

    // Scan horizontal rows in bottom third; find minimal width
    for (let row = (botY | 0); row < by + bh; row++) {
      if (row < 0 || row >= h) continue;
      let lx = Infinity, rx = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (Math.abs(p.y - row) < 2) {
          if (p.x < lx) lx = p.x;
          if (p.x > rx) rx = p.x;
        }
      }
      if (rx > lx) {
        const rowWidth = rx - lx;
        if (rowWidth < minBotWidth) minBotWidth = rowWidth;
      }
    }

    if (minBotWidth < bw * HEART_BOTTOM_FRAC) {
      result.hasBottomPoint = true;
    }

    // Composite heart score
    let score = 0;
    if (result.hasHumps) score += 0.50;
    if (result.hasBottomPoint) score += 0.30;
    if (vSym >= HEART_SYM_MIN) score += 0.20;
    result.score = score;

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 12 — WEIGHTED SHAPE CLASSIFICATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Weighted, criterion-based shape classification.  Each candidate
   * shape accumulates a total confidence from independently scored
   * criteria.  The highest score above MIN_CONFIDENCE wins.
   *
   * @param {number} circularity   - 4πA/P².
   * @param {number} dpCorners     - Douglas-Peucker vertex count.
   * @param {number} harrisCount   - Harris corner count.
   * @param {number} aspectRatio   - Bounding box width / height.
   * @param {number} elongation    - max(AR, 1/AR).
   * @param {{horizontal:number, vertical:number}} symmetry
   * @param {number} convexity     - contour area / hull area.
   * @param {{hasHumps:boolean, hasBottomPoint:boolean, score:number}} heartInfo
   * @returns {{shape:string, confidence:number}}
   */
  _classify(circularity, dpCorners, harrisCount, aspectRatio, elongation,
            symmetry, convexity, heartInfo) {

    // ── Circle ─────────────────────────────────────────────────
    //   A pixel-traced circle keeps many DP vertices (≥6) because
    //   the curve can't be simplified to a few straight segments.
    const circleScore =
      (circularity > 0.75 ? 1 : 0) * 0.35 +
      (dpCorners >= 6 ? 1 : (dpCorners >= 4 ? 0.4 : 0)) * 0.25 +
      (aspectRatio >= 0.85 && aspectRatio <= 1.15 ? 1 : 0) * 0.20 +
      (symmetry.vertical > 0.80 ? 1 : 0) * 0.20;

    // ── Square ─────────────────────────────────────────────────
    const squareScore =
      (dpCorners === 4 ? 1 : (dpCorners === 3 || dpCorners === 5 ? 0.4 : 0)) * 0.30 +
      (aspectRatio >= 0.88 && aspectRatio <= 1.12 ? 1 : 0) * 0.25 +
      (circularity >= 0.70 && circularity <= 0.88 ? 1 : 0) * 0.25 +
      (symmetry.vertical > 0.78 ? 1 : 0) * 0.20;

    // ── Rectangle ──────────────────────────────────────────────
    let rectScore =
      (dpCorners === 4 ? 1 : (dpCorners === 3 || dpCorners === 5 ? 0.4 : 0)) * 0.35 +
      (aspectRatio < 0.80 || aspectRatio > 1.25 ? 1 : 0) * 0.30 +
      (circularity >= 0.55 && circularity <= 0.80 ? 1 : 0) * 0.20 +
      (elongation > 1.3 ? 1 : 0) * 0.15;
    // Penalty when AR is too square-like
    if (aspectRatio >= 0.88 && aspectRatio <= 1.12) rectScore -= 0.20;

    // ── Triangle ───────────────────────────────────────────────
    const triangleScore =
      (dpCorners === 3 ? 1 : (dpCorners === 4 ? 0.3 : 0)) * 0.40 +
      (circularity >= 0.35 && circularity <= 0.72 ? 1 : 0) * 0.30 +
      (harrisCount >= 2 && harrisCount <= 4 ? 1 : 0) * 0.20 +
      (convexity > 0.80 ? 1 : 0) * 0.10;

    // ── Heart ──────────────────────────────────────────────────
    const heartScore =
      (symmetry.vertical > HEART_SYM_MIN ? 1 : 0) * 0.35 +
      (heartInfo.hasHumps ? 1 : 0) * 0.25 +
      (heartInfo.hasBottomPoint ? 1 : 0) * 0.20 +
      (aspectRatio >= 0.75 && aspectRatio <= 1.25 ? 1 : 0) * 0.10 +
      (dpCorners >= 2 && dpCorners <= 5 ? 1 : 0) * 0.10;

    // ── Select best ────────────────────────────────────────────
    const candidates = [
      { shape: 'circle',    confidence: circleScore },
      { shape: 'square',    confidence: squareScore },
      { shape: 'rectangle', confidence: rectScore },
      { shape: 'triangle',  confidence: triangleScore },
      { shape: 'heart',     confidence: heartScore },
    ];

    let best = { shape: 'unknown', confidence: 0 };
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].confidence > best.confidence) {
        best = candidates[i];
      }
    }

    // Clamp confidence to [0, 1]
    best.confidence = Math.max(0, Math.min(1, best.confidence));

    if (best.confidence < MIN_CONFIDENCE) {
      return { shape: 'unknown', confidence: best.confidence };
    }

    return best;
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns a default "unknown" result when no valid contour is found.
   *
   * @param {number} w - Image width.
   * @param {number} h - Image height.
   * @returns {object} Default result object.
   */
  _unknownResult(w, h) {
    return {
      shape: 'unknown',
      confidence: 0,
      boundingBox: { x: 0, y: 0, width: w, height: h },
      corners: [],
      symmetry: { horizontal: 0, vertical: 0 },
      aspectRatio: w / (h || 1),
      debugInfo: { edgeCount: 0, cornerCount: 0, circularity: 0, elongation: 1 },
      _contour: [],
      _harrisCorners: [],
      _hull: [],
      _centroid: { x: w / 2, y: h / 2 },
      _humpL: null,
      _humpR: null,
    };
  }
}

export default ShapeDetector;

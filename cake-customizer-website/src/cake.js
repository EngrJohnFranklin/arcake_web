/**
 * @fileoverview Three.js 3D Cake Model class
 * Builds and updates a 3D cake based on customization state.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Flavor color map */
const FLAVOR_COLORS = {
  chocolate: 0x5D4037,
  vanilla: 0xFFF8E1,
  strawberry: 0xF8BBD0,
  redvelvet: 0xC62828,
  matcha: 0x8BC34A
};

/** Size scale factors */
const SIZE_SCALES = {
  small: 0.75,
  medium: 1.0,
  large: 1.25
};

/**
 * CakeScene manages the Three.js scene, camera, renderer,
 * and builds the 3D cake model.
 */
export class CakeScene {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to render on
   * @param {object} [options] - Optional config
   * @param {boolean} [options.autoRotate=true] - Enable auto rotation
   * @param {boolean} [options.interactive=true] - Enable orbit controls
   * @param {boolean} [options.transparent=false] - Transparent canvas background
   * @param {boolean} [options.float=false] - Sine-wave float animation
   * @param {number} [options.rotateSpeed=2.0] - Auto-rotation speed
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.autoRotate = options.autoRotate !== false;
    this.interactive = options.interactive !== false;
    this.transparent = options.transparent === true;
    this.float = options.float === true;
    this.rotateSpeed = options.rotateSpeed ?? 2.0;
    this._clock = new THREE.Clock();

    /** @type {THREE.Group} */
    this.cakeGroup = new THREE.Group();
    /** @type {THREE.Group} */
    this.toppingsGroup = new THREE.Group();
    /** @type {THREE.Mesh|null} */
    this.textMesh = null;

    this._initScene();
    this._initLights();
    this._initControls();
    this._animate = this._animate.bind(this);
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._animate();
  }

  /** Initialize Three.js scene, camera, renderer */
  _initScene() {
    this.scene = new THREE.Scene();
    if (this.transparent) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(0xFFF5F7);
    }

    // Use the canvas's own CSS-determined dimensions
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth || 600;
    const h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight || 500;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 2.5, 4.5);
    this.camera.lookAt(0, 0.5, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: this.transparent
    });
    if (this.transparent) {
      this.renderer.setClearColor(0x000000, 0);
    }
    // Set drawing buffer only — let CSS control display size
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(this.cakeGroup);
    this.scene.add(this.toppingsGroup);
  }

  /** Set up lights */
  _initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 4);
    dir.castShadow = true;
    this.scene.add(dir);

    const point = new THREE.PointLight(0xffcccc, 0.4, 10);
    point.position.set(-2, 3, 2);
    this.scene.add(point);
  }

  /** Set up OrbitControls */
  _initControls() {
    if (!this.interactive) return;
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = this.rotateSpeed;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.3;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 8;
    this.controls.target.set(0, 0.5, 0);
  }

  /** Animation loop */
  _animate() {
    this._rafId = requestAnimationFrame(this._animate);
    if (this.controls) this.controls.update();

    const elapsed = this._clock.getElapsedTime();

    // Sine-wave float for hero preview
    if (this.float) {
      const floatY = Math.sin(elapsed * 1.2) * 0.12;
      this.cakeGroup.position.y = floatY;
      this.toppingsGroup.position.y = floatY;
    }

    // Manual rotation when no OrbitControls
    if (!this.interactive && this.autoRotate) {
      const angle = elapsed * this.rotateSpeed;
      this.cakeGroup.rotation.y = angle;
      this.toppingsGroup.rotation.y = angle;
    }

    this.renderer.render(this.scene, this.camera);
  }

  /** Handle window resize */
  _onResize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth || 600;
    const h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight || 500;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /**
   * Build the full cake from customization state
   * @param {object} state - The customization state object
   */
  buildCake(state) {
    this._clearGroup(this.cakeGroup);
    this._clearGroup(this.toppingsGroup);

    const scale = SIZE_SCALES[state.size] || 1.0;
    const flavorColor = FLAVOR_COLORS[state.flavor] || 0xFFF8E1;
    const frostingHex = state.frostingColor || '#FFFFFF';
    const frostingColor = new THREE.Color(frostingHex);
    const boardColorHex = state.boardColor || '#8D6E63';

    // Build cake shape
    switch (state.shape) {
      case 'square':
        this._buildSquareCake(scale, flavorColor, frostingColor, state.frostingStyle);
        break;
      case 'heart':
        this._buildHeartCake(scale, flavorColor, frostingColor, state.frostingStyle);
        break;
      case 'layered':
        this._buildLayeredCake(scale, flavorColor, frostingColor, state.frostingStyle);
        break;
      default:
        this._buildRoundCake(scale, flavorColor, frostingColor, state.frostingStyle);
    }

    // Build plate
    this._buildPlate(scale, boardColorHex);

    // Build toppings — pass hasText so they avoid the centre text zone
    const hasText = !!(state.cakeText && state.cakeText.trim());
    if (state.toppings && state.toppings.length > 0) {
      this._buildToppings(state.toppings, state.shape, scale, hasText);
    }

    // Build text (always on top)
    if (hasText) {
      this._buildText(state.cakeText, state.textColor, state.textFont, state.shape, scale);
    }
  }

  /**
   * Build a round cake
   * @param {number} s - Scale factor
   * @param {number} color - Sponge color hex
   * @param {THREE.Color} frost - Frosting color
   * @param {string} style - Frosting style
   */
  _buildRoundCake(s, color, frost, style) {
    const sponge = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 0.8 * s, 64),
      new THREE.MeshPhongMaterial({ color, flatShading: false })
    );
    sponge.position.y = 0.4 * s;
    this.cakeGroup.add(sponge);

    if (style !== 'naked') {
      const frostTop = new THREE.Mesh(
        new THREE.CylinderGeometry(1.21 * s, 1.21 * s, 0.1 * s, 64),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80 })
      );
      frostTop.position.y = 0.85 * s;
      this.cakeGroup.add(frostTop);

      // Side frosting
      const frostSide = new THREE.Mesh(
        new THREE.CylinderGeometry(1.22 * s, 1.22 * s, 0.78 * s, 64, 1, true),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80, side: THREE.FrontSide })
      );
      frostSide.position.y = 0.4 * s;
      this.cakeGroup.add(frostSide);
    }

    if (style === 'drip') {
      this._addDripEffect(1.21 * s, 0.85 * s, frost, 64);
    }

    this._cakeTopY = 0.9 * s;
    this._cakeRadius = 1.2 * s;
  }

  /**
   * Build a square cake
   * @param {number} s - Scale factor
   * @param {number} color - Sponge color
   * @param {THREE.Color} frost - Frosting color
   * @param {string} style - Frosting style
   */
  _buildSquareCake(s, color, frost, style) {
    const sponge = new THREE.Mesh(
      new THREE.BoxGeometry(2 * s, 0.8 * s, 2 * s),
      new THREE.MeshPhongMaterial({ color })
    );
    sponge.position.y = 0.4 * s;
    this.cakeGroup.add(sponge);

    if (style !== 'naked') {
      const frostTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.02 * s, 0.1 * s, 2.02 * s),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80 })
      );
      frostTop.position.y = 0.85 * s;
      this.cakeGroup.add(frostTop);
    }

    if (style === 'drip') {
      this._addSquareDrip(s, frost);
    }

    this._cakeTopY = 0.9 * s;
    this._cakeRadius = 1.0 * s;
  }

  /**
   * Build a heart-shaped cake using ExtrudeGeometry
   * @param {number} s - Scale factor
   * @param {number} color - Sponge color
   * @param {THREE.Color} frost - Frosting color
   * @param {string} style - Frosting style
   */
  _buildHeartCake(s, color, frost, style) {
    const heartShape = new THREE.Shape();
    const x = 0, y = 0;
    heartShape.moveTo(x, y + 0.5);
    heartShape.bezierCurveTo(x, y + 0.5, x - 0.5, y + 1.0, x - 1.0, y + 1.0);
    heartShape.bezierCurveTo(x - 1.6, y + 1.0, x - 1.6, y + 0.4, x - 1.6, y + 0.4);
    heartShape.bezierCurveTo(x - 1.6, y, x - 1.0, y - 0.5, x, y - 1.0);
    heartShape.bezierCurveTo(x + 1.0, y - 0.5, x + 1.6, y, x + 1.6, y + 0.4);
    heartShape.bezierCurveTo(x + 1.6, y + 0.4, x + 1.6, y + 1.0, x + 1.0, y + 1.0);
    heartShape.bezierCurveTo(x + 0.5, y + 1.0, x, y + 0.5, x, y + 0.5);

    const ext = { depth: 0.8 * s, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
    const geo = new THREE.ExtrudeGeometry(heartShape, ext);
    geo.center();
    geo.scale(s * 0.7, s * 0.7, 1);

    const sponge = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color }));
    sponge.rotation.x = -Math.PI / 2;
    sponge.position.y = 0.4 * s;
    this.cakeGroup.add(sponge);

    if (style !== 'naked') {
      const frostGeo = new THREE.ExtrudeGeometry(heartShape, { ...ext, depth: 0.1 * s });
      frostGeo.center();
      frostGeo.scale(s * 0.71, s * 0.71, 1);
      const frostMesh = new THREE.Mesh(frostGeo, new THREE.MeshPhongMaterial({ color: frost, shininess: 80 }));
      frostMesh.rotation.x = -Math.PI / 2;
      frostMesh.position.y = 0.85 * s;
      this.cakeGroup.add(frostMesh);
    }

    this._cakeTopY = 0.9 * s;
    this._cakeRadius = 0.9 * s;
  }

  /**
   * Build a layered (2-tier) round cake
   * @param {number} s - Scale factor
   * @param {number} color - Sponge color
   * @param {THREE.Color} frost - Frosting color
   * @param {string} style - Frosting style
   */
  _buildLayeredCake(s, color, frost, style) {
    // Bottom tier
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 0.5 * s, 64),
      new THREE.MeshPhongMaterial({ color })
    );
    bottom.position.y = 0.25 * s;
    this.cakeGroup.add(bottom);

    // Top tier
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85 * s, 0.85 * s, 0.5 * s, 64),
      new THREE.MeshPhongMaterial({ color })
    );
    top.position.y = 0.75 * s;
    this.cakeGroup.add(top);

    if (style !== 'naked') {
      // Frosting on bottom tier
      const fb = new THREE.Mesh(
        new THREE.CylinderGeometry(1.22 * s, 1.22 * s, 0.08 * s, 64),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80 })
      );
      fb.position.y = 0.52 * s;
      this.cakeGroup.add(fb);

      // Frosting on top tier
      const ft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.87 * s, 0.87 * s, 0.08 * s, 64),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80 })
      );
      ft.position.y = 1.02 * s;
      this.cakeGroup.add(ft);

      // Side frosting bottom
      const sfb = new THREE.Mesh(
        new THREE.CylinderGeometry(1.23 * s, 1.23 * s, 0.48 * s, 64, 1, true),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80, side: THREE.FrontSide })
      );
      sfb.position.y = 0.25 * s;
      this.cakeGroup.add(sfb);

      // Side frosting top
      const sft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88 * s, 0.88 * s, 0.48 * s, 64, 1, true),
        new THREE.MeshPhongMaterial({ color: frost, shininess: 80, side: THREE.FrontSide })
      );
      sft.position.y = 0.75 * s;
      this.cakeGroup.add(sft);
    }

    if (style === 'drip') {
      this._addDripEffect(0.87 * s, 1.02 * s, frost, 32);
    }

    this._cakeTopY = 1.05 * s;
    this._cakeRadius = 0.85 * s;
  }

  /**
   * Build cake plate
   * @param {number} s - Scale
   * @param {string} colorHex - Hex color string
   */
  _buildPlate(s, colorHex) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 * s, 1.5 * s, 0.05, 64),
      new THREE.MeshPhongMaterial({ color: new THREE.Color(colorHex), shininess: 60 })
    );
    plate.position.y = 0.025;
    plate.receiveShadow = true;
    this.cakeGroup.add(plate);
  }

  /**
   * Add drip frosting effect around cake edge
   * @param {number} radius - Cake radius
   * @param {number} topY - Top Y position
   * @param {THREE.Color} color - Drip color
   * @param {number} count - Number of drips
   */
  _addDripEffect(radius, topY, color, count) {
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dripLen = 0.1 + Math.random() * 0.25;
      const drip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, dripLen, 8),
        mat
      );
      drip.position.set(
        Math.cos(angle) * radius,
        topY - dripLen / 2,
        Math.sin(angle) * radius
      );
      this.cakeGroup.add(drip);
    }
  }

  /**
   * Add drip effect on square cake edges
   * @param {number} s - Scale
   * @param {THREE.Color} color - Drip color
   */
  _addSquareDrip(s, color) {
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    const half = 1.01 * s;
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * 4;
      let x, z;
      if (t < 1) { x = -half + t * 2 * half; z = -half; }
      else if (t < 2) { x = half; z = -half + (t - 1) * 2 * half; }
      else if (t < 3) { x = half - (t - 2) * 2 * half; z = half; }
      else { x = -half; z = half - (t - 3) * 2 * half; }
      const dripLen = 0.1 + Math.random() * 0.2;
      const drip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.02, dripLen, 8),
        mat
      );
      drip.position.set(x, 0.85 * s - dripLen / 2, z);
      this.cakeGroup.add(drip);
    }
  }

  /**
   * Build 3D toppings on top of cake
   * @param {string[]} toppings - List of topping names
   * @param {string} shape - Cake shape
   * @param {number} s - Scale
   */
  /**
   * Build 3D toppings on top of cake — shape and size aware.
   * Passes a rich context object to every topping builder so each can
   * select the correct position generator and scale geometry to match.
   */
  _buildToppings(toppings, shape, s, hasText = false) {
    const topY    = this._cakeTopY    || 0.9 * s;
    const usableR = (this._cakeRadius || 1.0 * s) * 0.82;
    // For square cakes the usable half-side is slightly smaller than usableR
    const halfW   = (shape === 'square') ? s * 0.88 : usableR;
    // Centre exclusion zone when text is present
    const minR    = hasText ? usableR * 0.46 : 0;
    const ctx     = { topY, usableR, halfW, minR, shape, s };

    toppings.forEach((topping) => {
      switch (topping) {
        case 'strawberries':    this._addStrawberries(ctx);   break;
        case 'blueberries':     this._addBlueberries(ctx);    break;
        case 'candles':         this._addCandles(ctx);         break;
        case 'sprinkles':       this._addSprinkles(ctx);       break;
        case 'chocolate_drip':  this._addChocDrizzle(ctx);    break;
        case 'flowers':         this._addFlowers(ctx);         break;
        case 'macarons':        this._addMacarons(ctx);        break;
        case 'gold_dust':       this._addGoldDust(ctx);        break;
        case 'sugar_pearls':    this._addSugarPearls(ctx);     break;
        case 'fresh_fruit':     this._addFreshFruits(ctx);     break;
        case 'ribbon':          this._addRibbon(s, shape);     break;
        case 'fondant_figures': this._addFondantFigures(ctx); break;
      }
    });
  }

  // ─── Boundary helpers ────────────────────────────────────────────────────────

  /**
   * Validate if a position (x, z) is strictly within the cake's surface bounds.
   * Includes margin to prevent edge overflow and clipping.
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {object} ctx - Cake context (shape, usableR, halfW, minR)
   * @param {number} margin - Safety margin from edges (default: 0.08)
   * @returns {boolean} - True if position is valid
   */
  _validatePositionInBounds(x, z, ctx, margin = 0.08) {
    const { shape, usableR, halfW, minR } = ctx;
    const dist = Math.sqrt(x * x + z * z);

    // Always respect text exclusion zone
    if (dist < minR) return false;

    if (shape === 'square') {
      // Square: enforce margin from all edges
      const safeW = halfW * (1 - margin);
      return Math.abs(x) <= safeW && Math.abs(z) <= safeW;
    }

    if (shape === 'heart') {
      // Heart: use mathematical curve boundary with margin
      return this._isWithinHeartCurve(x, z, usableR * (1 - margin));
    }

    // Circular (round/layered): radius boundary with margin
    return dist <= usableR * (1 - margin);
  }

  /**
   * Check if a position is within the heart curve boundary.
   * Uses the parameterized heart equation for strict containment.
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {number} maxR - Maximum allowed radius for the heart
   * @returns {boolean} - True if position is inside heart curve
   */
  _isWithinHeartCurve(x, z, maxR) {
    // Heart equation: convert (x,z) to polar angle relative to curve
    const dist = Math.sqrt(x * x + z * z);
    if (dist === 0) return true;

    let angle = Math.atan2(x, z); // angle in heart frame
    if (angle < 0) angle += Math.PI * 2;

    // Heart radial profile: widens at lobes (±90°), narrows at tip/cleft
    const heartFactor = 0.62 + 0.24 * Math.cos(angle * 2 + Math.PI)
                             - 0.08 * Math.abs(Math.sin(angle));
    const heartRadius = maxR * Math.max(0.30, heartFactor);

    // Position is inside if distance ≤ heart radius at that angle
    // Account for Z depth compression
    const depthAdjustedDist = Math.sqrt(x * x + (z / 0.70) * (z / 0.70));
    return depthAdjustedDist <= heartRadius;
  }

  /**
   * Calculate auto-scale factor based on topping density.
   * Reduces geometry size if toppings are crowded.
   * @param {number} count - Number of toppings
   * @param {number} availableArea - Available placement area
   * @returns {number} - Scale multiplier (0.6 to 1.0)
   */
  _calculateGeometryScale(count, availableArea = 1.0) {
    if (count <= 3) return 1.0;
    if (count <= 6) return 0.95;
    if (count <= 12) return 0.88;
    if (count <= 25) return 0.76;
    if (count <= 50) return 0.65;
    return 0.60;
  }

  // ─── Position helpers ────────────────────────────────────────────────────────

  /** Even ring of count positions at fixed radius. */
  _ringPositions(count, radius, startAngle = 0) {
    return Array.from({ length: count }, (_, i) => {
      const angle = startAngle + (i / count) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, angle };
    });
  }

  /** Uniform random distance within a donut (minR..maxR). */
  _donutDist(minR, maxR) {
    return Math.sqrt(Math.random() * (maxR * maxR - minR * minR) + minR * minR);
  }

  /**
   * Shape-aware position dispatcher — routes to the correct layout strategy.
   * All returned positions are validated to stay within strict boundaries.
   * @param {number}  count      - Number of positions needed
   * @param {object}  ctx        - Cake context from _buildToppings
   * @param {number}  outerFrac  - 0–1 radial fraction (ring-based shapes)
   * @param {number}  startAngle - Ring start angle
   */
  _getPositions(count, ctx, outerFrac = 0.80, startAngle = 0) {
    const { shape, usableR, halfW, minR } = ctx;
    let positions = [];

    if (shape === 'square') {
      positions = this._squareGridPositions(count, halfW, minR);
    } else if (shape === 'heart') {
      positions = this._heartSurfacePositions(count, usableR, minR, outerFrac);
    } else {
      // round / layered → polar ring
      const r = minR + (usableR - minR) * outerFrac;
      positions = this._ringPositions(count, Math.max(r, minR + 0.01), startAngle);
    }

    // STRICT VALIDATION: reject any position outside boundaries
    return positions.filter(({ x, z }) => this._validatePositionInBounds(x, z, ctx));
  }

  /**
   * Grid-based positions for square cakes.
   * Items fill a cols×rows grid within the safe inner square, skipping
   * any cell that falls inside the text exclusion circle (minR).
   * All returned positions are validated against boundaries.
   */
  _squareGridPositions(count, halfW, minR) {
    const safe = halfW * 0.78; // 22% margin from edges for strict containment
    if (count <= 1) return [{ x: 0, z: 0 }];

    const cols = Math.ceil(Math.sqrt(count * 1.2));
    const rows = Math.ceil(count / cols);
    const positions = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (positions.length >= count) break;
        const x = cols <= 1 ? 0 : -safe + (2 * safe / (cols - 1)) * c;
        const z = rows <= 1 ? 0 : -safe + (2 * safe / (rows - 1)) * r;
        // Validate against exclusion zone AND edge bounds
        if (Math.sqrt(x * x + z * z) >= minR && Math.abs(x) <= safe && Math.abs(z) <= safe) {
          positions.push({ x, z });
        }
      }
    }

    // Fallback: symmetric perimeter placements
    let perimeter = 0;
    while (positions.length < count && perimeter < 12) {
      const angle = (perimeter / 12) * Math.PI * 2;
      const r = safe * 0.65;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;
      if (Math.sqrt(px * px + pz * pz) >= minR) positions.push({ x: px, z: pz });
      perimeter++;
    }
    return positions.slice(0, count);
  }

  /**
   * Heart-contour following positions.
   * Uses a bilateral-symmetric polar parameterisation, with strict boundary
   * validation to ensure NO overflow from the heart shape.
   */
  _heartSurfacePositions(count, usableR, minR, frac = 0.80) {
    const hw = usableR * frac * 0.80; // Reduced from 0.86 for strict containment
    const positions = [];

    for (let i = 0; i < count; i++) {
      const t  = (i + 0.5) / count;
      const th = t * Math.PI * 2;

      // Heart adapts radial distance per angle:
      // wider at ±π/2 (left/right lobes), narrower at 0 (cleft) and π (tip)
      const heartFactor = 0.62 + 0.24 * Math.cos(th * 2 + Math.PI)
                               - 0.08 * Math.abs(Math.sin(th));
      const r = hw * Math.max(0.32, heartFactor); // Increased floor from 0.30 to 0.32

      const x = Math.sin(th) * r;
      const z = Math.cos(th) * r * 0.70; // heart depth < width in XZ plane

      // Validate: inside heart + outside exclusion zone
      const dist = Math.sqrt(x * x + z * z);
      if (dist >= minR && this._isWithinHeartCurve(x, z, hw * 0.95)) {
        positions.push({ x, z });
      }
    }

    // Fallback: symmetric inner positions
    let fallback = 0;
    while (positions.length < count && fallback < 8) {
      const angle = (fallback / 8) * Math.PI * 2;
      const r = hw * 0.45;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r * 0.70;
      if (Math.sqrt(px * px + pz * pz) >= minR && this._isWithinHeartCurve(px, pz, hw * 0.95)) {
        positions.push({ x: px, z: pz });
      }
      fallback++;
    }
    return positions.slice(0, count);
  }

  /**
   * Uniform random scatter across the cake's valid surface area.
   * Enforces strict boundary validation with rejection of overflow positions.
   * Square → uniform in safe square. Others → uniform donut/disc.
   */
  _scatterPositions(count, ctx) {
    const { shape, usableR, halfW, minR } = ctx;
    const safe = shape === 'square' ? halfW * 0.78 : usableR * 0.92;
    const positions = [];
    let attempts = 0;
    const maxAttempts = count * 50; // Allow more attempts for strict validation

    while (positions.length < count && attempts < maxAttempts) {
      attempts++;
      let x, z;
      let valid = false;

      if (shape === 'square') {
        x = (Math.random() * 2 - 1) * safe;
        z = (Math.random() * 2 - 1) * safe;
        // Strict bounds: must be inside safe square AND pass validation
        valid = Math.abs(x) <= safe && Math.abs(z) <= safe && Math.sqrt(x * x + z * z) >= minR;
      } else if (shape === 'heart') {
        // For heart, generate points and validate against heart curve
        let attempts2 = 0;
        while (attempts2 < 10) {
          attempts2++;
          const rand = Math.sqrt(Math.random());
          const angle = Math.random() * Math.PI * 2;
          x = Math.cos(angle) * rand * safe;
          z = Math.sin(angle) * rand * safe * 0.70;
          if (Math.sqrt(x * x + z * z) >= minR && this._isWithinHeartCurve(x, z, safe * 0.95)) {
            valid = true;
            break;
          }
        }
      } else {
        // Circular: donut or disc distribution
        const dist  = minR === 0
          ? Math.sqrt(Math.random()) * safe
          : this._donutDist(minR, safe);
        const angle = Math.random() * Math.PI * 2;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
        valid = true;
      }

      if (valid && Math.sqrt(x * x + z * z) >= minR) {
        positions.push({ x, z });
      }
    }

    // Ensure minimum count: add centre positions as final fallback
    while (positions.length < count) {
      positions.push({ x: 0, z: 0 });
    }
    return positions.slice(0, count);
  }

  // ─── Topping builders (all accept ctx, geometry scales with s) ───────────────

  /** 5 strawberries — ring/grid/heart depending on shape */
  _addStrawberries(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.9;
    const count = 5;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat     = new THREE.MeshPhongMaterial({ color: 0xE53935 });
    const leafMat = new THREE.MeshPhongMaterial({ color: 0x2E7D32 });
    this._getPositions(count, ctx, 0.82, Math.PI / 10).forEach(({ x, z }) => {
      const berry = new THREE.Mesh(new THREE.ConeGeometry(0.09 * scale, 0.17 * scale, 8), mat);
      berry.position.set(x, topY + 0.085 * scale, z);
      berry.rotation.x = Math.PI;
      const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.055 * scale, 0.05 * scale, 4), leafMat);
      leaf.position.set(x, topY + 0.175 * scale, z);
      this.toppingsGroup.add(berry, leaf);
    });
  }

  /** Blueberries — outer ring + inner ring (inner omitted when text present) */
  _addBlueberries(ctx) {
    const { topY, s, usableR, minR, shape } = ctx;
    const baseScale = s * 0.9;
    const count = 6;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat = new THREE.MeshPhongMaterial({ color: 0x3949AB, shininess: 60 });
    const geo = new THREE.SphereGeometry(0.052 * scale, 10, 10);
    const outer = this._getPositions(count, ctx, 0.84);
    // Inner ring: use ring for circular, skip for heart (no natural inner ring)
    const inner = (minR === 0 && shape !== 'heart')
      ? this._ringPositions(4, usableR * 0.35, Math.PI / 4).filter(({ x: px, z: pz }) => 
          this._validatePositionInBounds(px, pz, ctx))
      : [];
    [...outer, ...inner].forEach(({ x, z }) => {
      const b = new THREE.Mesh(geo, mat);
      b.position.set(x, topY + 0.052 * scale, z);
      this.toppingsGroup.add(b);
    });
  }

  /** 6 candles — adapts ring/grid/heart, colour-coded */
  _addCandles(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.9;
    const count = 6;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const candleColors = [0xF8BBD9, 0xB3E5FC, 0xF0F4C3, 0xFFCCBC, 0xE1BEE7, 0xC8E6C9];
    const flameMat = new THREE.MeshPhongMaterial({ color: 0xFFD54F, emissive: 0xFFAB00, emissiveIntensity: 0.9 });
    this._getPositions(count, ctx, 0.80, Math.PI / 12).forEach(({ x, z }, i) => {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026 * scale, 0.026 * scale, 0.30 * scale, 8),
        new THREE.MeshPhongMaterial({ color: candleColors[i % candleColors.length] })
      );
      stick.position.set(x, topY + 0.15 * scale, z);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scale, 8, 8), flameMat);
      flame.position.set(x, topY + 0.33 * scale, z);
      flame.scale.set(0.65, 1.3, 0.65);
      this.toppingsGroup.add(stick, flame);
    });
  }

  /** 50 sprinkles — shape-aware scatter, stays within boundaries */
  _addSprinkles(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.85;
    const count = 50;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const colors = [0xFF4081, 0x448AFF, 0xFFD740, 0x69F0AE, 0xE040FB, 0xFF6E40, 0xFF80AB, 0x40C4FF];
    this._scatterPositions(count, ctx).forEach(({ x, z }, i) => {
      const sprinkle = new THREE.Mesh(
        new THREE.BoxGeometry(0.016 * scale, 0.016 * scale, 0.068 * scale),
        new THREE.MeshPhongMaterial({ color: colors[i % colors.length] })
      );
      sprinkle.position.set(x, topY + 0.018 * scale, z);
      sprinkle.rotation.set(0, Math.random() * Math.PI, 0);
      this.toppingsGroup.add(sprinkle);
    });
  }

  /** Chocolate drizzle — cross-lines for full, outer cluster when text present */
  _addChocDrizzle(ctx) {
    const { topY, s, usableR, halfW, minR, shape } = ctx;
    const baseScale = s * 0.9;
    const geomScale = this._calculateGeometryScale(1, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat = new THREE.MeshPhongMaterial({ color: 0x3E2723, shininess: 40 });

    if (minR === 0) {
      // Full surface: radial lines from centre, length clamped to usable area
      const lineLen = shape === 'square' ? halfW * 1.6 : usableR * 1.4;
      for (let i = 0; i < 10; i++) {
        const drizzle = new THREE.Mesh(new THREE.BoxGeometry(0.024 * scale, 0.011 * scale, lineLen), mat);
        drizzle.position.set(0, topY + 0.011 * scale, 0);
        drizzle.rotation.y = (i / 10) * Math.PI;
        this.toppingsGroup.add(drizzle);
      }
    } else {
      // Outer ring of drizzle dots outside text zone
      this._getPositions(12, ctx, 0.86).forEach(({ x, z }) => {
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.024 * scale, 0.019 * scale, 0.038 * scale, 8), mat);
        dot.position.set(x, topY + 0.019 * scale, z);
        this.toppingsGroup.add(dot);
      });
    }
  }

  /** 5 flowers — ring/grid/heart, 5 petals each, colour-coded */
  _addFlowers(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.9;
    const count = 5;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const petalColors = [0xF48FB1, 0xCE93D8, 0xFFAB91, 0xAED581, 0x80DEEA];
    const centerMat   = new THREE.MeshPhongMaterial({ color: 0xFFD54F });
    this._getPositions(count, ctx, 0.78, Math.PI / 12).forEach(({ x, z }, fi) => {
      const pMat   = new THREE.MeshPhongMaterial({ color: petalColors[fi % petalColors.length] });
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.038 * scale, 8, 8), centerMat);
      center.position.set(x, topY + 0.058 * scale, z);
      this.toppingsGroup.add(center);
      for (let p = 0; p < 5; p++) {
        const pa    = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.042 * scale, 8, 6), pMat);
        petal.position.set(
          x + Math.cos(pa) * 0.062 * scale,
          topY + 0.048 * scale,
          z + Math.sin(pa) * 0.062 * scale
        );
        petal.scale.set(1, 0.44, 1);
        this.toppingsGroup.add(petal);
      }
    });
  }

  /** 5 macarons — ring/grid/heart, 3 layers each */
  _addMacarons(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.9;
    const count = 5;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const colors = [0xF48FB1, 0xCE93D8, 0xA5D6A7, 0xFFF59D, 0x80DEEA];
    this._getPositions(count, ctx, 0.78, Math.PI / 10).forEach(({ x, z }, i) => {
      const c       = colors[i % colors.length];
      const shell   = new THREE.MeshPhongMaterial({ color: c, shininess: 60 });
      const fillMat = new THREE.MeshPhongMaterial({ color: 0xFFF8E1 });
      const R = 0.072 * scale;
      const top  = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.036 * scale, 14), shell);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.017 * scale, 14), fillMat);
      const bot  = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.036 * scale, 14), shell);
      top.position.set(x,  topY + 0.096 * scale, z);
      fill.position.set(x, topY + 0.065 * scale, z);
      bot.position.set(x,  topY + 0.036 * scale, z);
      this.toppingsGroup.add(top, fill, bot);
    });
  }

  /** 35 gold dust particles — shape-aware scatter */
  _addGoldDust(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.85;
    const count = 35;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat = new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFA000, emissiveIntensity: 0.4 });
    const geo = new THREE.SphereGeometry(0.013 * scale, 6, 6);
    this._scatterPositions(count, ctx).forEach(({ x, z }) => {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, topY + 0.017 * scale, z);
      this.toppingsGroup.add(p);
    });
  }

  /** Sugar pearls — outer ring + inner ring (inner omitted when text present) */
  _addSugarPearls(ctx) {
    const { topY, s, usableR, minR, shape } = ctx;
    const baseScale = s * 0.9;
    const count = 9;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat = new THREE.MeshPhongMaterial({ color: 0xFFF9C4, shininess: 120 });
    const geo = new THREE.SphereGeometry(0.026 * scale, 10, 10);
    const outer = this._getPositions(count, ctx, 0.86);
    const inner = (minR === 0 && shape !== 'heart')
      ? this._ringPositions(5, usableR * 0.38, Math.PI / 5).filter(({ x: px, z: pz }) => 
          this._validatePositionInBounds(px, pz, ctx))
      : [];
    [...outer, ...inner].forEach(({ x, z }) => {
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x, topY + 0.026 * scale, z);
      this.toppingsGroup.add(p);
    });
  }

  /** Mixed fresh fruit — outer ring of slices + inner strawberries (when no text) */
  _addFreshFruits(ctx) {
    const { topY, s, usableR, minR, shape } = ctx;
    const baseScale = s * 0.9;
    const fruitCount = 4;
    const geomScale = this._calculateGeometryScale(fruitCount + 3, usableR * usableR);
    const scale = baseScale * geomScale;

    const orangeMat = new THREE.MeshPhongMaterial({ color: 0xFF9800 });
    const kiwiMat   = new THREE.MeshPhongMaterial({ color: 0x7CB342 });
    const strawMat  = new THREE.MeshPhongMaterial({ color: 0xE53935 });
    const geoSlice  = new THREE.CylinderGeometry(0.072 * scale, 0.072 * scale, 0.026 * scale, 12);
    const geoBerry  = new THREE.ConeGeometry(0.066 * scale, 0.13 * scale, 8);

    this._getPositions(fruitCount, ctx, 0.82).forEach(({ x, z }, i) => {
      const mat   = i % 2 === 0 ? orangeMat : kiwiMat;
      const slice = new THREE.Mesh(geoSlice, mat);
      slice.position.set(x, topY + 0.026 * scale, z);
      this.toppingsGroup.add(slice);
    });

    // Inner strawberries only when centre is free and shape has inner room
    if (minR === 0 && shape !== 'heart') {
      const leafMat = new THREE.MeshPhongMaterial({ color: 0x388E3C });
      this._ringPositions(3, usableR * 0.32, Math.PI / 6).filter(({ x: px, z: pz }) =>
        this._validatePositionInBounds(px, pz, ctx)).forEach(({ x, z }) => {
        const berry = new THREE.Mesh(geoBerry, strawMat);
        berry.rotation.x = Math.PI;
        berry.position.set(x, topY + 0.086 * scale, z);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.042 * scale, 0.038 * scale, 4), leafMat);
        leaf.position.set(x, topY + 0.154 * scale, z);
        this.toppingsGroup.add(berry, leaf);
      });
    }
  }

  /** Ribbon around cake middle — square uses a rounded-rectangle torus approximation */
  _addRibbon(s, shape) {
    if (shape === 'square') {
      // Four ribbon segments along the square cake sides
      const mat  = new THREE.MeshPhongMaterial({ color: 0xE91E8C, shininess: 60 });
      const half = 1.01 * s;
      const h    = 0.032 * s;
      const segW  = 2 * half;
      [[0, -half, 0], [0, half, Math.PI / 2], [0, 0, 0], [0, 0, Math.PI / 2]].forEach((_, i) => {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(segW, h, h), mat);
        const off = half;
        if (i === 0) seg.position.set(0, 0.4 * s, -off);
        else if (i === 1) seg.position.set(off, 0.4 * s, 0);
        else if (i === 2) seg.position.set(0, 0.4 * s, off);
        else seg.position.set(-off, 0.4 * s, 0);
        this.toppingsGroup.add(seg);
      });
    } else {
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(1.23 * s, 0.032 * s, 8, 64),
        new THREE.MeshPhongMaterial({ color: 0xE91E8C, shininess: 60 })
      );
      ribbon.position.y = 0.4 * s;
      ribbon.rotation.x = Math.PI / 2;
      this.toppingsGroup.add(ribbon);
    }
  }

  /** 3 fondant bear figures — ring/grid/heart */
  _addFondantFigures(ctx) {
    const { topY, s, usableR } = ctx;
    const baseScale = s * 0.9;
    const count = 3;
    const geomScale = this._calculateGeometryScale(count, usableR * usableR);
    const scale = baseScale * geomScale;

    const mat    = new THREE.MeshPhongMaterial({ color: 0xFFCC80 });
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x212121 });
    this._getPositions(count, ctx, 0.72, Math.PI / 6).forEach(({ x, z }) => {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.072 * scale, 8, 8), mat);
      body.position.set(x, topY + 0.072 * scale, z);
      body.scale.set(1, 1.2, 1);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.052 * scale, 8, 8), mat);
      head.position.set(x, topY + 0.200 * scale, z);
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.012 * scale, 6, 6), eyeMat);
      eyeL.position.set(x - 0.020 * scale, topY + 0.214 * scale, z + 0.046 * scale);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.012 * scale, 6, 6), eyeMat);
      eyeR.position.set(x + 0.020 * scale, topY + 0.214 * scale, z + 0.046 * scale);
      this.toppingsGroup.add(body, head, eyeL, eyeR);
    });
  }

  /**
   * Build 3D text on the cake front using CanvasTexture
   * @param {string} text - Message text
   * @param {string} color - Hex color
   * @param {string} font - Font style key
   * @param {string} shape - Cake shape
   * @param {number} s - Scale
   */
  _buildText(text, color, font, shape, s) {
    const CANVAS_W = 512;
    const CANVAS_H = 128;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');

    let fontFamily = 'Georgia';
    if (font === 'cursive') fontFamily = 'cursive';
    else if (font === 'modern') fontFamily = 'Arial';

    const label = text.substring(0, 30);

    // Auto-fit: start large, shrink until text fits 90% of canvas width
    let fontSize = 72;
    const maxTextW = CANVAS_W * 0.9;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    while (fontSize > 12 && ctx.measureText(label).width > maxTextW) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
    }

    // Thin white outline for readability over any topping color
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(label, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = color || '#3D2B1F';
    ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Plane sized to cake radius — always fills the top proportionally
    const radius = (this._cakeRadius || 1.2 * s);
    const planeW = radius * 1.55;
    const planeH = radius * 0.48;

    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);

    // renderOrder 999 guarantees text is always drawn last (above toppings)
    mesh.renderOrder = 999;

    // Elevate text well above toppings so nothing clips through it
    // Heart bevel adds ~0.08, toppings add ~0.04 clearance
    const surfaceOffset = (shape === 'heart') ? 0.12 : 0.06;
    const topY = (this._cakeTopY || 0.9 * s);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, topY + surfaceOffset, 0);
    this.toppingsGroup.add(mesh);
  }

  /** Clear all children from a group */
  _clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
      group.remove(child);
    }
  }

  /**
   * Take a screenshot of the current canvas
   * @returns {string} Data URL of the screenshot
   */
  takeScreenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  /** Dispose of everything */
  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    if (this.controls) this.controls.dispose();
    this._clearGroup(this.cakeGroup);
    this._clearGroup(this.toppingsGroup);
    this.renderer.dispose();
  }
}

/**
 * Create a small spinning preview cake for the home page hero
 * @param {HTMLCanvasElement} canvas
 * @returns {CakeScene}
 */
export function createHeroPreview(canvas) {
  const scene = new CakeScene(canvas, {
    autoRotate: true,
    interactive: false,
    transparent: true,
    float: true,
    rotateSpeed: 0.6
  });

  // Override lights for softer hero look
  scene.scene.children
    .filter((c) => c.isLight)
    .forEach((l) => scene.scene.remove(l));
  scene.scene.add(new THREE.AmbientLight(0xfff0f5, 0.75));
  const softDir = new THREE.DirectionalLight(0xffe4ec, 0.65);
  softDir.position.set(2, 4, 3);
  scene.scene.add(softDir);
  const warmPt = new THREE.PointLight(0xffcdd2, 0.45, 12);
  warmPt.position.set(-2, 3, 2);
  scene.scene.add(warmPt);
  const rimPt = new THREE.PointLight(0xf8bbd9, 0.3, 10);
  rimPt.position.set(0, 1, -3);
  scene.scene.add(rimPt);

  scene.buildCake({
    shape: 'layered',
    size: 'medium',
    flavor: 'strawberry',
    frostingStyle: 'drip',
    frostingColor: '#F8BBD9',
    boardColor: '#FFD700',
    toppings: ['strawberries', 'candles', 'flowers'],
    cakeText: '',
    textColor: '#3D2B1F',
    textFont: 'classic'
  });
  return scene;
}

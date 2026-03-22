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

/** Quantity limits mirrored from customization.js — avoids circular imports */
const QTY_LIMITS_3D = {
  fruits:  { min: 0, max: 5,  default: 3 },
  candles: { min: 1, max: 3,  default: 2 },
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
    /** @type {THREE.Mesh[]} Candle flame meshes for flicker animation */
    this._flameMeshes = [];

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

    // Secondary specular highlight for glossy frosting
    const specPt = new THREE.PointLight(0xffffff, 0.25, 8);
    specPt.position.set(1, 4, -2);
    this.scene.add(specPt);
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

    // Candle flame flicker — each flame gets an independent sine wave
    if (this._flameMeshes.length > 0) {
      this._flameMeshes.forEach((mesh, i) => {
        if (!mesh.material) return;
        const t = elapsed * 9 + i * 2.3;
        mesh.material.emissiveIntensity = 0.55 + 0.45 * Math.sin(t) * Math.cos(t * 0.7);
        mesh.scale.y = 1.25 + 0.18 * Math.sin(elapsed * 13 + i * 1.9);
      });
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

    // Build plate — heart cake is 30 % wider so give it a slightly larger plate
    this._buildPlate(scale, boardColorHex, state.shape === 'heart' ? 1.25 : 1.0);

    // Build toppings — pass hasText so they avoid the centre text zone
    const hasText = !!(state.cakeText && state.cakeText.trim());
    const hasToppings = Array.isArray(state.toppings)
      ? state.toppings.length > 0
      : state.toppings && Object.values(state.toppings).some(v => v !== null);
    if (hasToppings) {
      this._buildToppings(state.toppings, state.shape, scale, hasText, state.toppingQuantity || {});
    }

    // Build text (always on top)
    if (hasText) {
      this._buildText(state.cakeText, state.textColor, state.textFont, state.shape, scale);
    }
  }

  /** Create frosting material based on style */
  _frostMat(frost, style) {
    if (style === 'smooth') {
      return new THREE.MeshPhongMaterial({
        color: frost, shininess: 120,
        emissive: frost, emissiveIntensity: 0.08
      });
    }
    return new THREE.MeshPhongMaterial({ color: frost, shininess: 80 });
  }

  /** Add subtle horizontal layer lines for naked cakes */
  _addNakedLines(radius, height, baseY, spongeColor, s, isSquare = false) {
    const lineColor = new THREE.Color(spongeColor).multiplyScalar(0.72);
    const mat = new THREE.MeshPhongMaterial({
      color: lineColor, shininess: 10,
      transparent: true, opacity: 0.35
    });
    const layers = [0.33, 0.66];
    layers.forEach(frac => {
      const y = baseY + height * frac;
      if (isSquare) {
        const half = radius * 1.005;
        const h = 0.008 * s;
        const geo = new THREE.BoxGeometry(radius * 2.01, h, h);
        const geoZ = new THREE.BoxGeometry(h, h, radius * 2.01);
        [
          { g: geo, x: 0, z: -half },
          { g: geo, x: 0, z: half },
          { g: geoZ, x: half, z: 0 },
          { g: geoZ, x: -half, z: 0 }
        ].forEach(({ g, x: lx, z: lz }) => {
          const line = new THREE.Mesh(g, mat);
          line.position.set(lx, y, lz);
          this.cakeGroup.add(line);
        });
      } else {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 1.005, 0.008 * s, 4, 48),
          mat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        this.cakeGroup.add(ring);
      }
    });
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
      const frostMat = this._frostMat(frost, style);
      const frostTop = new THREE.Mesh(
        new THREE.CylinderGeometry(1.21 * s, 1.21 * s, 0.1 * s, 64),
        frostMat
      );
      frostTop.position.y = 0.85 * s;
      this.cakeGroup.add(frostTop);

      const sideMat = this._frostMat(frost, style);
      sideMat.side = THREE.FrontSide;
      const frostSide = new THREE.Mesh(
        new THREE.CylinderGeometry(1.22 * s, 1.22 * s, 0.80 * s, 64, 1, true),
        sideMat
      );
      frostSide.position.y = 0.40 * s;
      this.cakeGroup.add(frostSide);
    }

    if (style === 'drip') this._addDripEffect(1.21 * s, 0.85 * s, frost, 48, s);
    if (style === 'rosette') this._addRosettePiping(0.9 * s, 1.2 * s, frost, 12, s);

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
    // ── Sponge (inner) ───────────────────────────────────────
    const spongeMat = new THREE.MeshPhongMaterial({
      color,
      shininess: style === 'naked' ? 8 : 25,
      flatShading: style === 'naked'
    });
    const sponge = new THREE.Mesh(
      new THREE.BoxGeometry(2.00 * s, 0.80 * s, 2.00 * s),
      spongeMat
    );
    sponge.position.y = 0.40 * s;
    this.cakeGroup.add(sponge);

    if (style === 'naked') {
      this._cakeTopY   = 0.80 * s;
      this._cakeRadius = 1.00 * s;
      return;
    }

    const frostMat = this._frostMat(frost, style);

    // ── Frosting shell (outer) — ONE seamless box wrapping the sponge ──
    const frostShell = new THREE.Mesh(
      new THREE.BoxGeometry(2.14 * s, 0.82 * s, 2.14 * s),
      frostMat
    );
    frostShell.position.y = 0.41 * s;
    frostShell.renderOrder = 1;
    this.cakeGroup.add(frostShell);
    sponge.renderOrder = 0;

    // ── Top frosting cap — sits flush on top of shell ───────────
    // Shell bottom = 0.00, shell top = 0.82 * s
    // Cap centre   = 0.82 * s + 0.05 * s = 0.87 * s
    const frostTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.14 * s, 0.10 * s, 2.14 * s),
      frostMat
    );
    frostTop.position.y = 0.87 * s;
    frostTop.renderOrder = 1;
    this.cakeGroup.add(frostTop);

    // _cakeTopY = top of cap = 0.87 * s + 0.05 * s = 0.92 * s
    this._cakeTopY   = 0.92 * s;
    this._cakeRadius = 1.07 * s;

    if (style === 'drip')    this._addSquareDrip(s, frost);
    if (style === 'rosette') this._addSquareRosette(s, frost);
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

    // HS = sponge XY multiplier  FS = frosting XY (larger to coat all sponge sides)
    const HS  = 0.88;
    const FS  = 0.955; // wider gap avoids z-fighting at all scale values
    const H   = 0.8 * s;  // sponge height
    const CAP = 0.1 * s;  // frosting cap thickness

    // ── Sponge ────────────────────────────────────────────────────────────────
    // Small s-proportional bevel for a natural rounded edge.
    // center() shifts Z to [-H_total/2 .. +H_total/2]; position.y = H/2 → spans 0..H.
    const spongeGeo = new THREE.ExtrudeGeometry(heartShape, {
      depth: H, bevelEnabled: true,
      bevelThickness: 0.025 * s, bevelSize: 0.025 * s, bevelSegments: 2
    });
    spongeGeo.center();
    spongeGeo.scale(s * HS, s * HS, 1);
    const sponge = new THREE.Mesh(spongeGeo, new THREE.MeshPhongMaterial({ color }));
    sponge.rotation.x = -Math.PI / 2;
    sponge.position.y = H / 2;  // centres geometry → spans ≈ 0 .. H
    sponge.renderOrder = 0;
    this.cakeGroup.add(sponge);

    if (style !== 'naked') {
      const frostMat = this._frostMat(frost, style);

      // ── Side shell ─────────────────────────────────────────────────────────
      const shellGeo = new THREE.ExtrudeGeometry(heartShape, { depth: H, bevelEnabled: false });
      shellGeo.center();
      shellGeo.scale(s * FS, s * FS, 1);
      const shell = new THREE.Mesh(shellGeo, frostMat);
      shell.rotation.x = -Math.PI / 2;
      shell.position.y = H / 2;
      shell.renderOrder = 1;
      this.cakeGroup.add(shell);

      // ── Top cap ────────────────────────────────────────────────────────────
      const capGeo = new THREE.ExtrudeGeometry(heartShape, { depth: CAP, bevelEnabled: false });
      capGeo.center();
      capGeo.scale(s * FS, s * FS, 1);
      const cap = new THREE.Mesh(capGeo, frostMat);
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = H + CAP / 2;
      cap.renderOrder = 1;
      this.cakeGroup.add(cap);
    }

    // Drip: follow actual heart outline
    if (style === 'drip')    this._addHeartDripEffect(heartShape, s * FS, H, frost, 22, s);
    // Rosette: puffs along the heart outline edge only
    if (style === 'rosette') this._addHeartEdgeRosette(heartShape, s, frost, H + CAP);

    this._cakeTopY   = H + CAP;  // 0.9 * s — toppings sit on cap surface
    this._cakeRadius = 1.17 * s;
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
      const frostMat = this._frostMat(frost, style);

      // Frosting on bottom tier
      const fb = new THREE.Mesh(
        new THREE.CylinderGeometry(1.22 * s, 1.22 * s, 0.08 * s, 64),
        frostMat
      );
      fb.position.y = 0.52 * s;
      this.cakeGroup.add(fb);

      // Transition annulus ring — fills seam between bottom frost disc and top tier base
      const annulus = new THREE.Mesh(
        new THREE.RingGeometry(0.88 * s, 1.22 * s, 64),
        frostMat
      );
      annulus.rotation.x = -Math.PI / 2;
      annulus.position.y = 0.505 * s;
      this.cakeGroup.add(annulus);

      // Frosting on top tier
      const ft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.87 * s, 0.87 * s, 0.08 * s, 64),
        frostMat
      );
      ft.position.y = 1.02 * s;
      this.cakeGroup.add(ft);

      // Side frosting bottom
      const sideMat = this._frostMat(frost, style);
      sideMat.side = THREE.FrontSide;
      const sfb = new THREE.Mesh(
        new THREE.CylinderGeometry(1.23 * s, 1.23 * s, 0.50 * s, 64, 1, true),
        sideMat
      );
      sfb.position.y = 0.25 * s;
      this.cakeGroup.add(sfb);

      // Side frosting top
      const sideMatTop = this._frostMat(frost, style);
      sideMatTop.side = THREE.FrontSide;
      const sft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.88 * s, 0.88 * s, 0.50 * s, 64, 1, true),
        sideMatTop
      );
      sft.position.y = 0.75 * s;
      this.cakeGroup.add(sft);
    }

    if (style === 'drip') {
      // Drips on BOTH tiers
      this._addDripEffect(0.87 * s, 1.02 * s, frost, 28, s);        // top tier
      this._addDripEffect(1.22 * s, 0.52 * s, frost, 36, s);        // bottom tier
    }
    if (style === 'rosette') {
      // Rosette edge ring on BOTH tiers
      this._addRosettePiping(1.05 * s, 0.85 * s, frost, 10, s * 0.8);  // top tier
      this._addRosettePiping(0.52 * s, 1.20 * s, frost, 14, s);         // bottom tier
    }

    this._cakeTopY = 1.05 * s;
    this._cakeRadius = 0.85 * s;
  }

  /**
   * Build cake plate
   * @param {number} s - Scale
   * @param {string} colorHex - Hex color string
   * @param {number} [plateMult=1.0] - Extra multiplier for plate radius (e.g. 1.25 for heart)
   */
  _buildPlate(s, colorHex, plateMult = 1.0) {
    const pr = 1.52 * s * plateMult;
    const plateMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(colorHex), shininess: 70 });
    // Main plate disc
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(pr, pr, 0.05, 64),
      plateMat
    );
    plate.position.y = 0.025;
    plate.receiveShadow = true;
    this.cakeGroup.add(plate);
    // Raised rim ring
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(pr * 0.987, 0.04 * s, 6, 48),
      plateMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.048;
    this.cakeGroup.add(rim);
  }

  /**
   * Add drip frosting effect around cake edge
   * @param {number} radius - Cake radius
   * @param {number} topY - Top Y position
   * @param {THREE.Color} color - Drip color
   * @param {number} count - Number of drips
   */
  _addDripEffect(radius, topY, color, count, s = 1) {
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const thick = 0.8 + Math.random() * 0.4;
      const dripLen = (0.1 + Math.random() * 0.25) * s;
      const drip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03 * s * thick, 0.02 * s * thick, dripLen, 8),
        mat
      );
      drip.position.set(
        Math.cos(angle) * radius,
        topY - dripLen / 2,
        Math.sin(angle) * radius
      );
      this.cakeGroup.add(drip);
      // Teardrop sphere at drip bottom
      const tear = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 * s * thick, 6, 6), mat
      );
      tear.position.set(
        Math.cos(angle) * radius,
        topY - dripLen,
        Math.sin(angle) * radius
      );
      this.cakeGroup.add(tear);
    }
  }

  /**
   * Heart-contour drip effect.
   * Samples points from the actual heartShape outline so every drip hangs exactly
   * on the frosting shell edge — no drips floating outside the curved lobes or cleft.
   *
   * Coordinate mapping (after rotation.x = -PI/2):
   *   shape-X  →  world-X  (unchanged)
   *   shape-Y  →  world-Z  (negated: -shape-Y)
   *
   * @param {THREE.Shape}  heartShape  - The same shape used for the cake geometry
   * @param {number}       scaleXY     - XY scale applied to shape points (s * FS)
   * @param {number}       topY        - World Y where drips start (top of sponge/shell)
   * @param {THREE.Color}  color       - Drip colour
   * @param {number}       count       - Number of drips (evenly distributed along outline)
   * @param {number}       s           - Size scale (for geometry proportioning)
   */
  _addHeartDripEffect(heartShape, scaleXY, topY, color, count, s) {
    const pts  = heartShape.getPoints(count * 5);
    const step = Math.max(1, Math.floor(pts.length / count));
    const mat  = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    for (let i = 0; i < count; i++) {
      const pt  = pts[(i * step) % pts.length];
      const cx  = pt.x * scaleXY;
      const cz  = -pt.y * scaleXY;
      // Skip cleft points that would poke outside the heart silhouette
      if (Math.abs(cz) > 1.1 * s) continue;
      const thick = 0.8 + Math.random() * 0.4;
      const len = (0.06 + Math.random() * 0.16) * s;
      const drip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022 * s * thick, 0.014 * s * thick, len, 6),
        mat
      );
      drip.position.set(cx, topY - len / 2, cz);
      this.cakeGroup.add(drip);
      // Teardrop
      const tear = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 * s * thick, 6, 6), mat
      );
      tear.position.set(cx, topY - len, cz);
      this.cakeGroup.add(tear);
    }
  }

  _addHeartEdgeRosette(heartShape, s, frost, topY) {
    const mat     = new THREE.MeshPhongMaterial({ color: frost, shininess: 35 });
    const FS      = 0.955;                // must match FS in _buildHeartCake
    const scaleXY = s * FS * 0.93;       // slightly inset from the shell edge
    const count   = 22;

    const pts  = heartShape.getPoints(count * 6);
    const step = Math.max(1, Math.floor(pts.length / count));

    for (let i = 0; i < count; i++) {
      const pt = pts[(i * step) % pts.length];
      const wx =  pt.x * scaleXY;       // world X
      const wz = -pt.y * scaleXY;       // world Z (shape-Y flips on rotation.x=-PI/2)

      // Skip the cleft notch area
      if (wz < -s * 0.80) continue;

      const sv = 0.85 + Math.random() * 0.30;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.072 * s, 9, 8), mat
      );
      puff.scale.set(sv, 0.50 * sv, sv);
      puff.rotation.y = Math.random() * Math.PI;
      puff.position.set(wx, topY + 0.028 * s, wz);
      this.cakeGroup.add(puff);
    }
  }

  /**
   * Add drip effect on square cake edges
   * @param {number} s - Scale
   * @param {THREE.Color} color - Drip color
   */
  _addSquareDrip(s, frost) {
    const mat     = new THREE.MeshPhongMaterial({ color: frost, shininess: 90 });
    const topY    = this._cakeTopY;        // = 0.92 * s — top of the frosting cap
    const half    = 1.07 * s;             // outer edge of the frosting shell
    const perSide = 7;                    // drips per side (4 sides × 7 = 28 total)

    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < perSide; i++) {
        const t      = (i + 0.5) / perSide;
        const jitter = (Math.random() - 0.5) * 0.04 * s;
        const along  = (-half + 0.10 * s) + t * (2 * half - 0.20 * s) + jitter;

        let x, z;
        if      (side === 0) { x = along;  z = -half; }   // front  (−Z face)
        else if (side === 1) { x =  half;  z = along; }   // right  (+X face)
        else if (side === 2) { x = along;  z =  half; }   // back   (+Z face)
        else                 { x = -half;  z = along; }   // left   (−X face)

        const len  = (0.12 + Math.random() * 0.18) * s;
        const topR = (0.025 + Math.random() * 0.015) * s;
        const botR = topR * 0.45;

        // Drip cylinder starts at topY and hangs downward
        const drip = new THREE.Mesh(
          new THREE.CylinderGeometry(topR, botR, len, 8),
          mat
        );
        drip.position.set(x, topY - len / 2, z);
        this.cakeGroup.add(drip);

        // Teardrop sphere at the very bottom tip of the drip
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(botR * 1.8, 7, 7),
          mat
        );
        drop.position.set(x, topY - len - botR * 0.9, z);
        this.cakeGroup.add(drop);
      }
    }
  }

  _addSquareRosette(s, frost) {
    const mat    = new THREE.MeshPhongMaterial({ color: frost, shininess: 35 });
    const topY   = this._cakeTopY;        // = 0.92 * s
    const half   = 1.07 * s;
    const inset  = 0.05 * s;
    const edge   = half - inset;
    const perSide = 7;

    // 4 corner accent puffs (larger, at each corner)
    [
      { x:  edge, z:  edge },
      { x:  edge, z: -edge },
      { x: -edge, z:  edge },
      { x: -edge, z: -edge },
    ].forEach(({ x, z }) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.092 * s, 9, 8), mat);
      p.scale.set(1.0, 0.52, 1.0);
      p.position.set(x, topY + 0.040 * s, z);
      this.cakeGroup.add(p);
    });

    // Edge puffs along all 4 sides
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < perSide; i++) {
        const t     = (i + 0.5) / perSide;
        const along = -edge + t * 2 * edge;
        let x, z;
        if      (side === 0) { x = along;  z = -edge; }
        else if (side === 1) { x =  edge;  z = along; }
        else if (side === 2) { x = along;  z =  edge; }
        else                 { x = -edge;  z = along; }

        const sv = 0.85 + Math.random() * 0.28;
        const p  = new THREE.Mesh(new THREE.SphereGeometry(0.072 * s, 9, 8), mat);
        p.scale.set(sv, 0.50 * sv, sv);
        p.rotation.y = Math.random() * Math.PI;
        p.position.set(x, topY + 0.028 * s, z);
        this.cakeGroup.add(p);
      }
    }
  }

  /**
   * Add rosette piping puffs on the top face of any cake.
   * Two concentric rings of flattened spheres imitate piped frosting.
   * @param {number} topY      - Y position of cake top surface
   * @param {number} radius    - Cake top radius (used for ring placement)
   * @param {THREE.Color} frost - Frosting colour
   * @param {number} outerCount - Number of puffs in the outer ring
   * @param {number} s         - Scale factor
   */
  _addRosettePiping(topY, radius, frost, outerCount, s) {
    const mat = new THREE.MeshPhongMaterial({ color: frost, shininess: 35 });

    // Border ring — flat base puffs along outer edge
    const borderR = radius * 0.92;
    const borderCount = Math.max(8, Math.floor(outerCount * 1.2));
    for (let i = 0; i < borderCount; i++) {
      const angle = (i / borderCount) * Math.PI * 2;
      const sv = 0.85 + Math.random() * 0.3;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.065 * s, 8, 7), mat);
      puff.position.set(Math.cos(angle) * borderR, topY + 0.018 * s, Math.sin(angle) * borderR);
      puff.scale.set(sv, 0.4, sv);
      puff.rotation.y = Math.random() * Math.PI;
      this.cakeGroup.add(puff);
    }

    // Outer ring
    const outerR = radius * 0.70;
    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * Math.PI * 2;
      const sv = 0.9 + Math.random() * 0.2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s, 8, 7), mat);
      puff.position.set(Math.cos(angle) * outerR, topY + 0.044 * s, Math.sin(angle) * outerR);
      puff.scale.set(sv, 0.55 * sv, sv);
      puff.rotation.y = Math.random() * Math.PI;
      this.cakeGroup.add(puff);
    }

    // Inner ring (staggered by half a step)
    const innerCount = Math.max(4, Math.floor(outerCount * 0.55));
    const innerR     = radius * 0.36;
    const offset     = Math.PI / outerCount;
    for (let i = 0; i < innerCount; i++) {
      const angle = offset + (i / innerCount) * Math.PI * 2;
      const sv = 0.9 + Math.random() * 0.2;
      const puff  = new THREE.Mesh(new THREE.SphereGeometry(0.068 * s, 8, 7), mat);
      puff.position.set(Math.cos(angle) * innerR, topY + 0.030 * s, Math.sin(angle) * innerR);
      puff.scale.set(sv, 0.55 * sv, sv);
      puff.rotation.y = Math.random() * Math.PI;
      this.cakeGroup.add(puff);
    }

    // Centre puff
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.052 * s, 8, 7), mat);
    centre.position.set(0, topY + 0.022 * s, 0);
    centre.scale.set(1, 0.55, 1);
    this.cakeGroup.add(centre);
  }

  /**
   * Build 3D toppings on top of cake — shape and size aware.
   * Passes a rich context object to every topping builder so each can
   * select the correct position generator and scale geometry to match.
   */
  _buildToppings(toppings, shape, s, hasText = false, toppingQuantity = {}) {
    // Reset flame mesh refs so old flame materials don't flicker when candles are removed
    this._flameMeshes = [];
    const topY    = this._cakeTopY    || 0.9 * s;
    const usableR = (this._cakeRadius || 1.0 * s) * 0.82;
    // For square cakes the usable half-side is slightly smaller than usableR
    const halfW   = (shape === 'square') ? s * 0.88 : usableR;
    // Centre exclusion zone when text is present
    const minR    = hasText ? usableR * 0.46 : 0;
    const ctx     = { topY, usableR, halfW, minR, shape, s };

    // Shared collision registry — prevents cross-category overlap
    const occupied = [];
    const normalized = this._normalizeToppings(toppings, toppingQuantity);
    normalized.forEach(({ category, value, qty }) => {
      switch (category) {
        case 'sprinkles':   this._addSprinklesVariant(value, ctx, occupied);        break;
        case 'fruits':      this._addFruitsVariant(value, qty, ctx, occupied);      break;
        case 'candles':     this._addCandlesVariant(value, qty, ctx, occupied);     break;
        case 'decorations': this._addDecorationsVariant(value, ctx, occupied);     break;
        case 'legacy':      this._addLegacyTopping(value, ctx, occupied);           break;
      }
    });
  }

  /** Normalize toppings to unified [{category, value, qty}] format */
  _normalizeToppings(toppings, toppingQuantity = {}) {
    if (!toppings) return [];
    if (!Array.isArray(toppings)) {
      // New object format: { sprinkles: 'rainbow', fruits: 'strawberries', ... }
      return Object.entries(toppings)
        .filter(([, v]) => v !== null)
        .map(([category, value]) => ({
          category,
          value: category === 'candles' && (value === 'birthday' || value === 'numeral') ? 'standard' : value,
          qty: toppingQuantity[category] ?? null
        }));
    }
    // Legacy array format
    return toppings.map(v => ({ category: 'legacy', value: v, qty: null }));
  }

  // ─── Collision helpers ────────────────────────────────────────────────────────

  _registerOccupied(occupied, x, z, r) {
    occupied.push({ x, z, r });
  }

  _positionFree(x, z, r, occupied) {
    for (const o of occupied) {
      const minD = o.r + r;
      const dx = o.x - x, dz = o.z - z;
      if (dx * dx + dz * dz < minD * minD) return false;
    }
    return true;
  }

  _collisionFreePositions(candidates, occupied, r) {
    const placed = [];
    for (const pos of candidates) {
      if (this._positionFree(pos.x, pos.z, r, occupied)) {
        placed.push(pos);
        this._registerOccupied(occupied, pos.x, pos.z, r);
      }
    }
    // Guarantee at least one placement so toppings always appear.
    // Force-place the first candidate ignoring collisions when nothing fit.
    if (placed.length === 0 && candidates.length > 0) {
      const pos = candidates[0];
      placed.push(pos);
      this._registerOccupied(occupied, pos.x, pos.z, r);
    }
    return placed;
  }

  // ─── Category variant dispatchers ────────────────────────────────────────────

  _addSprinklesVariant(type, ctx, occupied) {
    switch (type) {
      case 'rainbow':   this._addRainbowSprinkles(ctx, occupied);   break;
      case 'chocolate': this._addChocolateSprinkles(ctx, occupied); break;
      case 'star':      this._addStarSprinkles(ctx, occupied);      break;
      default:          this._addRainbowSprinkles(ctx, occupied);   break;
    }
  }

  _addFruitsVariant(type, qty, ctx, occupied) {
    const count = (qty != null) ? Math.round(qty) : QTY_LIMITS_3D.fruits.default;
    if (count <= 0) return; // qty=0 means "selected but none placed" — no-op
    switch (type) {
      case 'blueberries':  this._addBlueberriesNew(ctx, occupied, count);  break;
      case 'strawberries': this._addStrawberriesNew(ctx, occupied, count); break;
      case 'cherries':     this._addCherries(ctx, occupied, count);         break;
      case 'grapes':       this._addGrapes(ctx, occupied, count);           break;
      default:             this._addStrawberriesNew(ctx, occupied, count); break;
    }
  }

  _addCandlesVariant(type, qty, ctx, occupied) {
    const count = (qty != null && qty > 0) ? Math.round(qty) : QTY_LIMITS_3D.candles.default;
    switch (type) {
      case 'standard': this._addStandardCandles(ctx, occupied, count); break;
      default:         this._addStandardCandles(ctx, occupied, count); break;
    }
  }

  _addDecorationsVariant(type, ctx, occupied) {
    switch (type) {
      case 'chocolate_pieces': this._addChocolatePieces(ctx, occupied); break;
      case 'edible_flowers':   this._addEdibleFlowers(ctx, occupied);   break;
      case 'custom_toppers':   this._addCustomToppers(ctx, occupied);   break;
      case 'macarons':         this._addMacarons(ctx);                  break;
      case 'choc_drizzle':     this._addChocDrizzle(ctx);               break;
      default:                 this._addEdibleFlowers(ctx, occupied);   break;
    }
  }

  /** Legacy array-format handler for backward compatibility with hero preview */
  _addLegacyTopping(value, ctx, occupied) {
    switch (value) {
      case 'sprinkles':       this._addRainbowSprinkles(ctx, occupied);  break;
      case 'gold_dust':       this._addStarSprinkles(ctx, occupied);     break;
      case 'strawberries':    this._addStrawberriesNew(ctx, occupied);   break;
      case 'blueberries':     this._addBlueberriesNew(ctx, occupied);    break;
      case 'fresh_fruit':     this._addCherries(ctx, occupied);          break;
      case 'candles':         this._addStandardCandles(ctx, occupied);   break;
      case 'fondant_figures': this._addCustomToppers(ctx, occupied);     break;
      case 'flowers':         this._addEdibleFlowers(ctx, occupied);     break;
      case 'macarons':        this._addCustomToppers(ctx, occupied);     break;
      case 'sugar_pearls':    this._addChocolatePieces(ctx, occupied);   break;
      case 'chocolate_drip':  this._addChocDrizzle(ctx);                break;
      case 'ribbon':          this._addRibbon(ctx.s, ctx.shape);         break;
    }
  }

  // ─── New variant builders ─────────────────────────────────────────────────────

  /** 50 rainbow sprinkles — multi-colour cylinder scatter */
  _addRainbowSprinkles(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.85;
    const r = 0.02 * scale;
    const colors = [0xFF4081, 0x448AFF, 0xFFD740, 0x69F0AE, 0xE040FB, 0xFF6E40, 0xFF80AB, 0x40C4FF];
    const candidates = this._scatterPositions(50, ctx);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }, i) => {
      const s2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.016 * scale, 0.016 * scale, 0.068 * scale),
        new THREE.MeshPhongMaterial({ color: colors[i % colors.length] })
      );
      s2.position.set(x, topY + 0.018 * scale, z);
      s2.rotation.set(0, Math.random() * Math.PI, 0);
      this.toppingsGroup.add(s2);
    });
  }

  /** 40 chocolate sprinkles — brown cylinder scatter */
  _addChocolateSprinkles(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.85;
    const r = 0.02 * scale;
    const mat = new THREE.MeshPhongMaterial({ color: 0x5D4037 });
    const candidates = this._scatterPositions(40, ctx);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      const s2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.016 * scale, 0.016 * scale, 0.068 * scale),
        mat
      );
      s2.position.set(x, topY + 0.018 * scale, z);
      s2.rotation.set(0, Math.random() * Math.PI, 0);
      this.toppingsGroup.add(s2);
    });
  }

  /** 30 star sprinkles — flat gold 6-sided pieces */
  _addStarSprinkles(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.85;
    const r = 0.022 * scale;
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFA000, emissiveIntensity: 0.4 });
    const geo = new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, 0.008 * scale, 6);
    const candidates = this._scatterPositions(30, ctx);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      const star = new THREE.Mesh(geo, mat);
      star.position.set(x, topY + 0.008 * scale, z);
      star.rotation.set(0, Math.random() * Math.PI, 0);
      this.toppingsGroup.add(star);
    });
  }

  /** Blueberries — ring, count driven by user quantity (default 8) */
  _addBlueberriesNew(ctx, occupied, count = 8) {
    const { topY, s } = ctx;
    const geoScale = this._calculateGeometryScale(count);
    const scale = s * 0.9;
    const r = 0.08 * scale * geoScale;
    const mat = new THREE.MeshPhongMaterial({ color: 0x3949AB, shininess: 60 });
    const candidates = this._getPositions(count, ctx, 0.84);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    const yOff = topY + 0.052 * scale * geoScale;
    const geoR  = 0.052 * scale * geoScale;
    positions.forEach(({ x, z }) => {
      // Separate geometry per mesh so disposal in _clearGroup doesn't affect siblings
      const b = new THREE.Mesh(new THREE.SphereGeometry(geoR, 10, 10), mat);
      b.position.set(x, yOff, z);
      this.toppingsGroup.add(b);
    });
  }

  /** Strawberries — ring, count driven by user quantity (default 5) */
  _addStrawberriesNew(ctx, occupied, count = 5) {
    const { topY, s } = ctx;
    const geoScale = this._calculateGeometryScale(count);
    const scale = s * 0.9;
    const r = 0.1 * scale * geoScale;
    const mat     = new THREE.MeshPhongMaterial({ color: 0xE53935 });
    const leafMat = new THREE.MeshPhongMaterial({ color: 0x2E7D32 });
    const candidates = this._getPositions(count, ctx, 0.82, Math.PI / 10);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      const berry = new THREE.Mesh(new THREE.ConeGeometry(0.09 * scale * geoScale, 0.17 * scale * geoScale, 8), mat);
      berry.position.set(x, topY + 0.085 * scale * geoScale, z);
      berry.rotation.x = Math.PI;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.055 * scale * geoScale, 0.05 * scale * geoScale, 4), leafMat);
      leaf.position.set(x, topY + 0.175 * scale * geoScale, z);
      this.toppingsGroup.add(berry, leaf);
    });
  }

  /** Cherry clusters — count driven by user quantity (default 4) */
  _addCherries(ctx, occupied, count = 4) {
    const { topY, s } = ctx;
    const geoScale = this._calculateGeometryScale(count);
    const scale = s * 0.9;
    const r = 0.1 * scale * geoScale;
    const cherryMat = new THREE.MeshPhongMaterial({ color: 0xC62828, shininess: 80 });
    const stemMat   = new THREE.MeshPhongMaterial({ color: 0x388E3C });
    const candidates = this._getPositions(count, ctx, 0.80, Math.PI / 8);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      [-0.045 * scale * geoScale, 0.045 * scale * geoScale].forEach((dx) => {
        const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.040 * scale * geoScale, 10, 10), cherryMat);
        cherry.position.set(x + dx, topY + 0.04 * scale * geoScale, z);
        this.toppingsGroup.add(cherry);
      });
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006 * scale * geoScale, 0.006 * scale * geoScale, 0.08 * scale * geoScale, 6),
        stemMat
      );
      stem.position.set(x, topY + 0.10 * scale * geoScale, z);
      this.toppingsGroup.add(stem);
    });
  }

  /** Standard candles — count driven by user quantity (default 6) */
  _addStandardCandles(ctx, occupied, count = 6) {
    const { topY, s } = ctx;
    const geoScale = this._calculateGeometryScale(count);
    const scale = s * 0.9;
    const r = 0.07 * scale * geoScale;
    const candleColors = [0xF8BBD9, 0xB3E5FC, 0xF0F4C3, 0xFFCCBC, 0xE1BEE7, 0xC8E6C9];
    const candidates = this._getPositions(count, ctx, 0.80, Math.PI / 12);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }, i) => {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026 * scale * geoScale, 0.026 * scale * geoScale, 0.30 * scale * geoScale, 8),
        new THREE.MeshPhongMaterial({ color: candleColors[i % candleColors.length] })
      );
      stick.position.set(x, topY + 0.15 * scale * geoScale, z);

      // Wick — thin dark cylinder on top of candle stick
      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004 * scale * geoScale, 0.004 * scale * geoScale, 0.05 * scale * geoScale, 5),
        new THREE.MeshPhongMaterial({ color: 0x212121 })
      );
      wick.position.set(x, topY + 0.325 * scale * geoScale, z);

      // Each flame gets its OWN cloned material so it can flicker independently
      const flameMat = new THREE.MeshPhongMaterial({
        color:             0xFFEE58,
        emissive:          0xFF8F00,
        emissiveIntensity: 0.9,
        transparent:       true,
        opacity:           0.92
      });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.036 * scale * geoScale, 8, 8), flameMat);
      flame.position.set(x, topY + 0.345 * scale * geoScale, z);
      flame.scale.set(0.62, 1.45, 0.62);

      this._flameMeshes.push(flame); // tracked for animation
      this.toppingsGroup.add(stick, wick, flame);
    });
  }

  /** 8 dark chocolate shards — angled box pieces, ring, registers collision */
  _addChocolatePieces(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.9;
    const r = 0.1 * scale;
    const mat = new THREE.MeshPhongMaterial({ color: 0x3E2723, shininess: 50 });
    const candidates = this._getPositions(8, ctx, 0.78, Math.PI / 8);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 * scale, 0.014 * scale, 0.05 * scale),
        mat
      );
      shard.position.set(x, topY + 0.014 * scale, z);
      shard.rotation.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.5
      );
      this.toppingsGroup.add(shard);
    });
  }

  /** 5 edible flowers — ring, 5 petals each, colour-coded, registers collision */
  _addEdibleFlowers(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.9;
    const r = 0.1 * scale;
    const petalColors = [0xF48FB1, 0xCE93D8, 0xFFAB91, 0xAED581, 0x80DEEA];
    const centerMat   = new THREE.MeshPhongMaterial({ color: 0xFFD54F });
    const candidates = this._getPositions(5, ctx, 0.78, Math.PI / 12);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }, fi) => {
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

  /** 4 metallic star-shaped toppers on sticks — ring, registers collision */
  _addCustomToppers(ctx, occupied) {
    const { topY, s } = ctx;
    const scale = s * 0.9;
    const r = 0.1 * scale;
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 120, emissive: 0xFFA000, emissiveIntensity: 0.3 });
    const stickMat = new THREE.MeshPhongMaterial({ color: 0xE0E0E0 });
    const geo = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.02 * scale, 5);
    const candidates = this._getPositions(4, ctx, 0.76, Math.PI / 8);
    const positions = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      const topper = new THREE.Mesh(geo, mat);
      topper.position.set(x, topY + 0.02 * scale, z);
      topper.rotation.set(0, Math.random() * Math.PI, 0);
      this.toppingsGroup.add(topper);
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 0.18 * scale, 6),
        stickMat
      );
      stick.position.set(x, topY + 0.13 * scale, z);
      this.toppingsGroup.add(stick);
    });
  }

  /** Grape bunches — cluster of purple spheres, count driven by user quantity */
  _addGrapes(ctx, occupied, count = 6) {
    const { topY, s } = ctx;
    const geoScale = this._calculateGeometryScale(count);
    const scale = s * 0.9;
    const r = 0.13 * scale * geoScale;
    const mat     = new THREE.MeshPhongMaterial({ color: 0x6A1B9A, shininess: 70 });
    const stemMat = new THREE.MeshPhongMaterial({ color: 0x558B2F });
    // Berry offsets within each bunch (local X/Z in scaled units)
    const offsets = [
      [ 0.00,  0.06], [-0.05, 0.01], [ 0.05, 0.01],
      [-0.03, -0.05], [ 0.03, -0.05],
    ];
    const candidates = this._getPositions(count, ctx, 0.83, Math.PI / 7);
    const positions  = this._collisionFreePositions(candidates, occupied, r);
    positions.forEach(({ x, z }) => {
      offsets.forEach(([dx, dz]) => {
        const grape = new THREE.Mesh(
          new THREE.SphereGeometry(0.040 * scale * geoScale, 8, 8),
          mat
        );
        grape.position.set(
          x + dx * scale * geoScale,
          topY + 0.040 * scale * geoScale,
          z + dz * scale * geoScale
        );
        this.toppingsGroup.add(grape);
      });
      // Short stem at top of bunch
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005 * scale, 0.005 * scale, 0.055 * scale, 5),
        stemMat
      );
      stem.position.set(x, topY + 0.10 * scale * geoScale, z + 0.06 * scale * geoScale);
      stem.rotation.z = 0.3;
      this.toppingsGroup.add(stem);
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
  _validatePositionInBounds(x, z, ctx, margin = 0.04) {
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
      // round / layered → adaptive concentric rings
      positions = this._concentricRingPositions(count, usableR, minR, outerFrac, startAngle);
    }

    // STRICT VALIDATION: reject any position outside boundaries
    return positions.filter(({ x, z }) => this._validatePositionInBounds(x, z, ctx));
  }

  /**
   * Adaptive concentric ring layout for round and layered cakes.
   * ≤ 8 items → single outer ring (clean and airy).
   * 9–12 items → two concentric rings: outer ~60 %, inner ~40 %,
   *   inner ring angularly offset by half a step so items interleave
   *   with outer-ring items for even visual distribution.
   */
  _concentricRingPositions(count, usableR, minR, outerFrac = 0.80, startAngle = 0) {
    if (count <= 0) return [];
    const outerR = Math.max(minR + 0.02, minR + (usableR - minR) * outerFrac);

    if (count <= 8) {
      return this._ringPositions(count, Math.max(outerR, minR + 0.01), startAngle);
    }

    // Dual-ring split: outer ~60 %, inner the remainder
    const outerCount = Math.ceil(count * 0.6);
    const innerCount = count - outerCount;

    // Inner ring sits at 52 % of the radius band so items aren't crowded
    const innerFrac = outerFrac * 0.52;
    const innerR    = Math.max(minR + 0.01, minR + (usableR - minR) * innerFrac);

    // Stagger inner ring by half an outer-step for visual interleaving
    const angleOffset = Math.PI / outerCount;
    const outer = this._ringPositions(outerCount, outerR, startAngle);
    const inner = innerR > minR
      ? this._ringPositions(innerCount, innerR, startAngle + angleOffset)
      : [];

    return [...outer, ...inner];
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

    // Fallback ring 1: perimeter at 65 % of safe zone
    let perimeter = 0;
    while (positions.length < count && perimeter < 16) {
      const angle = (perimeter / 16) * Math.PI * 2;
      const r = safe * 0.65;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;
      if (Math.sqrt(px * px + pz * pz) >= minR) positions.push({ x: px, z: pz });
      perimeter++;
    }
    // Fallback ring 2: inner at 35 % of safe zone
    let inner = 0;
    while (positions.length < count && inner < 8) {
      const angle = (inner / 8) * Math.PI * 2 + Math.PI / 16;
      const r = safe * 0.35;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;
      if (Math.sqrt(px * px + pz * pz) >= minR) positions.push({ x: px, z: pz });
      inner++;
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

    // Helper: generate N positions along a heart contour at a given scale
    const heartRing = (n, scale, startOffset = 0) => {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t  = (i + 0.5 + startOffset) / n;
        const th = t * Math.PI * 2;
        const heartFactor = 0.62 + 0.24 * Math.cos(th * 2 + Math.PI)
                                 - 0.08 * Math.abs(Math.sin(th));
        const r = hw * scale * Math.max(0.32, heartFactor);
        const x = Math.sin(th) * r;
        const z = Math.cos(th) * r * 0.70;
        const dist = Math.sqrt(x * x + z * z);
        if (dist >= minR && this._isWithinHeartCurve(x, z, hw * 0.95)) {
          pts.push({ x, z });
        }
      }
      return pts;
    };

    let positions;
    if (count <= 8) {
      // Single contour band
      positions = heartRing(count, 1.0);
    } else {
      // Dual-band: outer ~60 %, inner ~40 % with staggered offset
      const outerCount = Math.ceil(count * 0.6);
      const innerCount = count - outerCount;
      positions = [
        ...heartRing(outerCount, 1.0),
        ...heartRing(innerCount, 0.55, 0.25)
      ];
    }

    // Fallback: symmetric inner positions
    let fallback = 0;
    while (positions.length < count && fallback < 16) {
      const angle = (fallback / 16) * Math.PI * 2;
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
    let fontWeight = 'bold';
    if (font === 'cursive') {
      fontFamily = '"Dancing Script", cursive';
      fontWeight = '700';
    } else if (font === 'modern') {
      fontFamily = 'Arial';
    }

    const _draw = () => {
      const label = text.substring(0, 30);

      // Auto-fit: start large, shrink until text fits 90% of canvas width
      let fontSize = 72;
      const maxTextW = CANVAS_W * 0.9;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      while (fontSize > 12 && ctx.measureText(label).width > maxTextW) {
        fontSize -= 2;
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
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

      texture.needsUpdate = true;
    };

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
    const surfaceOffset = (shape === 'heart') ? 0.12 : 0.06;
    const topY = (this._cakeTopY || 0.9 * s);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, topY + surfaceOffset, 0);
    this.toppingsGroup.add(mesh);

    // Draw immediately with whatever font is available, then redraw once the
    // cursive font is confirmed loaded (handles first-time font cache miss).
    _draw();
    if (font === 'cursive') {
      // Ensure Dancing Script is loaded; inject link tag if needed
      if (!document.getElementById('arcake-dancing-script')) {
        const link = document.createElement('link');
        link.id = 'arcake-dancing-script';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap';
        document.head.appendChild(link);
      }
      document.fonts.load(`700 72px "Dancing Script"`).then(() => _draw());
    }
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

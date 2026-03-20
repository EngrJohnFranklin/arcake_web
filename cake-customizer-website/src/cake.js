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

    // Build toppings
    if (state.toppings && state.toppings.length > 0) {
      this._buildToppings(state.toppings, state.shape, scale);
    }

    // Build text
    if (state.cakeText && state.cakeText.trim()) {
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
  _buildToppings(toppings, shape, s) {
    const topY = this._cakeTopY || 0.9 * s;
    const r = (this._cakeRadius || 1.0 * s) * 0.7;

    toppings.forEach((topping, idx) => {
      const angle = (idx / toppings.length) * Math.PI * 2 + 0.3;
      const dist = r * (0.3 + Math.random() * 0.6);
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;

      switch (topping) {
        case 'strawberries':
          this._addStrawberry(px, topY, pz);
          break;
        case 'blueberries':
          this._addBlueberry(px, topY, pz);
          break;
        case 'candles':
          this._addCandle(px, topY, pz);
          break;
        case 'sprinkles':
          this._addSprinkles(topY, r);
          break;
        case 'chocolate_drip':
          // Already handled by frosting style drip; add extra drizzle
          this._addChocDrizzle(topY, r);
          break;
        case 'flowers':
          this._addFlower(px, topY, pz);
          break;
        case 'macarons':
          this._addMacaron(px, topY, pz);
          break;
        case 'gold_dust':
          this._addGoldDust(topY, r);
          break;
        case 'sugar_pearls':
          this._addSugarPearls(topY, r);
          break;
        case 'fresh_fruit':
          this._addFreshFruit(px, topY, pz);
          break;
        case 'ribbon':
          this._addRibbon(s);
          break;
        case 'fondant_figures':
          this._addFondantFigure(px, topY, pz);
          break;
      }
    });
  }

  /** Add a strawberry topping */
  _addStrawberry(x, y, z) {
    const berry = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.18, 8),
      new THREE.MeshPhongMaterial({ color: 0xE53935 })
    );
    berry.position.set(x, y + 0.09, z);
    berry.rotation.x = Math.PI;
    // small leaf
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.04, 4),
      new THREE.MeshPhongMaterial({ color: 0x2E7D32 })
    );
    leaf.position.set(x, y + 0.18, z);
    this.toppingsGroup.add(berry);
    this.toppingsGroup.add(leaf);
  }

  /** Add a blueberry */
  _addBlueberry(x, y, z) {
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshPhongMaterial({ color: 0x283593 })
    );
    b.position.set(x, y + 0.06, z);
    this.toppingsGroup.add(b);
  }

  /** Add a candle with flame */
  _addCandle(x, y, z) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8),
      new THREE.MeshPhongMaterial({ color: 0xF8BBD9 })
    );
    stick.position.set(x, y + 0.175, z);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0xFFD54F, emissive: 0xFFAB00, emissiveIntensity: 0.8 })
    );
    flame.position.set(x, y + 0.38, z);
    flame.scale.set(0.7, 1.2, 0.7);

    this.toppingsGroup.add(stick);
    this.toppingsGroup.add(flame);
  }

  /** Add scattered sprinkles */
  _addSprinkles(topY, r) {
    const colors = [0xFF4081, 0x448AFF, 0xFFD740, 0x69F0AE, 0xE040FB, 0xFF6E40];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      const sprinkle = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.02, 0.08),
        new THREE.MeshPhongMaterial({ color: colors[i % colors.length] })
      );
      sprinkle.position.set(Math.cos(angle) * dist, topY + 0.02, Math.sin(angle) * dist);
      sprinkle.rotation.set(Math.random(), Math.random(), Math.random());
      this.toppingsGroup.add(sprinkle);
    }
  }

  /** Add chocolate drizzle lines */
  _addChocDrizzle(topY, r) {
    const mat = new THREE.MeshPhongMaterial({ color: 0x3E2723 });
    for (let i = 0; i < 8; i++) {
      const drizzle = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.01, r * 1.2),
        mat
      );
      drizzle.position.set(0, topY + 0.01, 0);
      drizzle.rotation.y = (i / 8) * Math.PI;
      this.toppingsGroup.add(drizzle);
    }
  }

  /** Add a flower */
  _addFlower(x, y, z) {
    const petalColors = [0xF48FB1, 0xCE93D8, 0xFFAB91];
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshPhongMaterial({ color: 0xFFD54F })
    );
    center.position.set(x, y + 0.06, z);
    this.toppingsGroup.add(center);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshPhongMaterial({ color: petalColors[i % 3] })
      );
      petal.position.set(
        x + Math.cos(angle) * 0.07,
        y + 0.05,
        z + Math.sin(angle) * 0.07
      );
      petal.scale.set(1, 0.5, 1);
      this.toppingsGroup.add(petal);
    }
  }

  /** Add a macaron */
  _addMacaron(x, y, z) {
    const colors = [0xF48FB1, 0xCE93D8, 0xA5D6A7, 0xFFF59D];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16),
      new THREE.MeshPhongMaterial({ color: c })
    );
    const fill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16),
      new THREE.MeshPhongMaterial({ color: 0xFFF8E1 })
    );
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16),
      new THREE.MeshPhongMaterial({ color: c })
    );
    top.position.set(x, y + 0.1, z);
    fill.position.set(x, y + 0.07, z);
    bottom.position.set(x, y + 0.04, z);
    this.toppingsGroup.add(top, fill, bottom);
  }

  /** Add gold dust particles */
  _addGoldDust(topY, r) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 6, 6),
        new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFA000, emissiveIntensity: 0.3 })
      );
      particle.position.set(Math.cos(angle) * dist, topY + 0.02, Math.sin(angle) * dist);
      this.toppingsGroup.add(particle);
    }
  }

  /** Add sugar pearls */
  _addSugarPearls(topY, r) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = r * (0.5 + Math.random() * 0.5);
      const pearl = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0xFFFDE7, shininess: 100 })
      );
      pearl.position.set(Math.cos(angle) * dist, topY + 0.03, Math.sin(angle) * dist);
      this.toppingsGroup.add(pearl);
    }
  }

  /** Add mixed fresh fruit */
  _addFreshFruit(x, y, z) {
    // Orange slice
    const orange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12),
      new THREE.MeshPhongMaterial({ color: 0xFF9800 })
    );
    orange.position.set(x, y + 0.04, z);
    this.toppingsGroup.add(orange);

    // Kiwi slice next to it
    const kiwi = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12),
      new THREE.MeshPhongMaterial({ color: 0x8BC34A })
    );
    kiwi.position.set(x + 0.12, y + 0.04, z + 0.05);
    this.toppingsGroup.add(kiwi);
  }

  /** Add a ribbon around cake middle */
  _addRibbon(s) {
    const ribbon = new THREE.Mesh(
      new THREE.TorusGeometry(1.23 * s, 0.03, 8, 64),
      new THREE.MeshPhongMaterial({ color: 0xE91E8C })
    );
    ribbon.position.y = 0.4 * s;
    ribbon.rotation.x = Math.PI / 2;
    this.toppingsGroup.add(ribbon);
  }

  /** Add a small fondant bear figure */
  _addFondantFigure(x, y, z) {
    const mat = new THREE.MeshPhongMaterial({ color: 0xFFCC80 });
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
    body.position.set(x, y + 0.08, z);
    body.scale.set(1, 1.2, 1);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
    head.position.set(x, y + 0.22, z);
    // Eyes
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x212121 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), eyeMat);
    eyeL.position.set(x - 0.025, y + 0.24, z + 0.05);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), eyeMat);
    eyeR.position.set(x + 0.025, y + 0.24, z + 0.05);
    this.toppingsGroup.add(body, head, eyeL, eyeR);
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
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    let fontFamily = 'Georgia';
    if (font === 'cursive') fontFamily = 'cursive';
    else if (font === 'modern') fontFamily = 'Arial';

    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = color || '#3D2B1F';
    ctx.font = `bold 48px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.substring(0, 30), 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Size the text plane to fit within the cake top surface
    const r = (this._cakeRadius || 1.0 * s);
    const planeW = Math.min(r * 1.6, 1.6 * s);
    const planeH = Math.min(r * 0.55, 0.55 * s);

    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const mat = new THREE.MeshPhongMaterial({ map: texture, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);

    // Lay flat on top of the cake, raised just above the surface
    const topY = (this._cakeTopY || 0.9 * s);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, topY + 0.01, 0);
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

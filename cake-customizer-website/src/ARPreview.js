/**
 * ARPreview.js
 *
 * Overlays the user's customized 3D cake on a live rear-camera
 * feed using two stacked elements:
 *
 *   1. <video>  — live camera feed (CSS object-fit: cover)
 *   2. <canvas> — Three.js renders the cake with a transparent
 *                 background so the video shows through
 *
 * The cake floats at the centre of the view (no surface tracking).
 * The user can drag to reposition and pinch to resize.
 *
 * Zero external dependencies — uses Three.js already bundled by
 * the existing CakeScene, accessed via the CakeScene constructor.
 *
 * DO NOT modify cake3d.js — this file only instantiates CakeScene.
 */

export class ARPreview {
  /**
   * @param {object}   cakeState         - Full customization state object
   * @param {Function} onBack            - Called when user taps "← Edit" or "Done"
   * @param {Function} onSaveScreenshot  - Called with a PNG dataURL string
   */
  constructor(cakeState, onBack, onSaveScreenshot) {
    this._state            = cakeState
    this._onBack           = onBack
    this._onSaveScreenshot = onSaveScreenshot || null

    // Camera stream
    this._stream    = null
    this._cakeScene = null

    // DOM references (populated in _buildUI)
    this._container = null
    this._video     = null
    this._canvas    = null

    // Drag state
    this._drag   = { active: false, startX: 0, startY: 0 }
    this._offset = { x: 0, y: 0 }      // canvas translate offset in px

    // Pinch-zoom state
    this._pinch = { active: false, startDist: 0, startScale: 1 }
    this._scale = 1.0                   // current visual scale (0.4 – 3.5)

    // Resize listener reference (stored so it can be removed on close)
    this._onResize = null
  }

  /* ───────────────────────────────────────────────────────────
     PUBLIC API
     ─────────────────────────────────────────────────────────── */

  /**
   * Opens the AR overlay: builds UI, starts camera, mounts cake scene,
   * and begins the render loop.
   */
  async open() {
    this._buildUI()
    await this._startCamera()
    await this._buildCakeScene()
    this._startRenderSupport()
  }

  /* ───────────────────────────────────────────────────────────
     UI CONSTRUCTION
     ─────────────────────────────────────────────────────────── */

  /**
   * Builds and appends the full AR overlay to document.body.
   * Classes come from flow.css — no inline style blocks except
   * for the dynamically applied canvas transform.
   */
  _buildUI() {
    // ── Root container ──
    this._container = document.createElement('div')
    this._container.className = 'ar-container'

    // ── Camera video (background layer) ──
    this._video = document.createElement('video')
    this._video.className = 'ar-video'
    this._video.setAttribute('autoplay', '')
    this._video.setAttribute('muted', '')
    this._video.setAttribute('playsinline', '')

    // ── Three.js canvas (foreground, transparent bg) ──
    this._canvas = document.createElement('canvas')
    this._canvas.className = 'ar-canvas'

    // ── Top bar ──
    const topBar = document.createElement('div')
    topBar.className = 'ar-top-bar'
    topBar.innerHTML = `
      <button class="ar-top-btn" id="ar-edit-btn">← Edit</button>
      <span>AR Preview</span>
      <button class="ar-top-btn" id="ar-shot-btn">Screenshot</button>
    `

    // ── Floating hint ──
    const hint = document.createElement('div')
    hint.className = 'ar-hint'
    hint.textContent = 'Drag to reposition  ·  Pinch to resize'

    // ── Bottom bar with Done button ──
    const bottomBar = document.createElement('div')
    bottomBar.className = 'ar-bottom-bar'
    bottomBar.innerHTML = `
      <button class="sf-btn-primary" id="ar-done-btn"
        style="flex:1;margin:0">Done</button>
    `

    this._container.append(
      this._video,
      this._canvas,
      topBar,
      hint,
      bottomBar
    )
    document.body.appendChild(this._container)

    // ── Button handlers ──
    this._container.querySelector('#ar-edit-btn').onclick = () => this._close()
    this._container.querySelector('#ar-done-btn').onclick = () => this._close()
    this._container.querySelector('#ar-shot-btn').onclick = () => this._takeShot()

    // ── Touch / mouse interaction ──
    this._attachInteraction()
  }

  /* ───────────────────────────────────────────────────────────
     CAMERA
     ─────────────────────────────────────────────────────────── */

  /**
   * Requests the rear camera (environment-facing).
   * If unavailable, hides the video element and shows a dark bg —
   * the 3D cake is still displayed on its own.
   */
  async _startCamera() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
      })
      this._video.srcObject = this._stream
      await this._video.play()
    } catch {
      // Camera denied or unavailable — degrade gracefully
      this._video.style.display = 'none'
      this._container.style.background = '#1a1a2e'
    }
  }

  /* ───────────────────────────────────────────────────────────
     CAKE SCENE
     ─────────────────────────────────────────────────────────── */

  /**
   * Instantiates CakeScene on the transparent canvas and builds
   * the user's customized cake.
   * CakeScene manages its own requestAnimationFrame render loop.
   */
  async _buildCakeScene() {
    const W = window.innerWidth
    const H = window.innerHeight
    this._canvas.width  = W
    this._canvas.height = H

    // Dynamic import keeps cake.js in the same chunk that main.js already owns
    const { CakeScene } = await import('./cake.js')

    // transparent:true → WebGL alpha channel → video shows through
    this._cakeScene = new CakeScene(this._canvas, {
      autoRotate:  true,
      interactive: false,
      transparent: true,
      float:       true,
      rotateSpeed: 0.8,
    })

    this._cakeScene.buildCake(this._state)

    // Position cake at centre + any existing drag offset
    this._applyTransform()
  }

  /* ───────────────────────────────────────────────────────────
     RESIZE SUPPORT
     ─────────────────────────────────────────────────────────── */

  /**
   * Listens for window resize to keep the canvas dimensions in sync.
   * CakeScene handles its own renderer resize internally.
   */
  _startRenderSupport() {
    this._onResize = () => {
      this._canvas.width  = window.innerWidth
      this._canvas.height = window.innerHeight
    }
    window.addEventListener('resize', this._onResize)
  }

  /* ───────────────────────────────────────────────────────────
     TRANSFORM
     ─────────────────────────────────────────────────────────── */

  /**
   * Applies the current drag offset and pinch scale to the canvas
   * via CSS transform. Only the transform is applied inline — all
   * other styles live in flow.css.
   */
  _applyTransform() {
    this._canvas.style.transform =
      `translate(${this._offset.x}px, ${this._offset.y}px) scale(${this._scale})`
    this._canvas.style.transformOrigin = 'center center'
  }

  /* ───────────────────────────────────────────────────────────
     DRAG + PINCH INTERACTION
     ─────────────────────────────────────────────────────────── */

  /**
   * Attaches mouse drag (desktop) and touch drag + pinch-zoom (mobile)
   * event listeners to the Three.js canvas.
   */
  _attachInteraction() {
    const el = this._canvas

    // ── Mouse drag ──────────────────────────────────────────
    el.addEventListener('mousedown', (e) => {
      this._drag.active = true
      this._drag.startX = e.clientX - this._offset.x
      this._drag.startY = e.clientY - this._offset.y
    })

    window.addEventListener('mousemove', (e) => {
      if (!this._drag.active) return
      this._offset.x = e.clientX - this._drag.startX
      this._offset.y = e.clientY - this._drag.startY
      this._applyTransform()
    })

    window.addEventListener('mouseup', () => {
      this._drag.active = false
    })

    // ── Touch drag + pinch zoom ──────────────────────────────
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._drag.active = true
        this._drag.startX = e.touches[0].clientX - this._offset.x
        this._drag.startY = e.touches[0].clientY - this._offset.y
      }
      if (e.touches.length === 2) {
        this._drag.active      = false
        this._pinch.active     = true
        this._pinch.startDist  = _touchDist(e.touches)
        this._pinch.startScale = this._scale
      }
    }, { passive: true })

    el.addEventListener('touchmove', (e) => {
      if (this._drag.active && e.touches.length === 1) {
        this._offset.x = e.touches[0].clientX - this._drag.startX
        this._offset.y = e.touches[0].clientY - this._drag.startY
        this._applyTransform()
      }
      if (this._pinch.active && e.touches.length === 2) {
        const dist  = _touchDist(e.touches)
        const ratio = dist / this._pinch.startDist
        // Clamp scale to sensible range
        this._scale = Math.min(3.5, Math.max(0.4,
          this._pinch.startScale * ratio))
        this._applyTransform()
      }
    }, { passive: true })

    el.addEventListener('touchend', () => {
      this._drag.active  = false
      this._pinch.active = false
    })
  }

  /* ───────────────────────────────────────────────────────────
     SCREENSHOT
     ─────────────────────────────────────────────────────────── */

  /**
   * Composites the camera video frame and the Three.js canvas into
   * a single PNG using an off-screen canvas, then triggers a download.
   * Also calls onSaveScreenshot(dataURL) if a callback was provided.
   */
  _takeShot() {
    const W = window.innerWidth
    const H = window.innerHeight

    const tmp = document.createElement('canvas')
    tmp.width  = W
    tmp.height = H
    const ctx = tmp.getContext('2d')

    // 1. Draw camera video as background
    if (this._stream && this._video.readyState >= 2) {
      ctx.drawImage(this._video, 0, 0, W, H)
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, W, H)
    }

    // 2. Draw Three.js canvas on top, respecting current offset + scale
    ctx.save()
    ctx.translate(W / 2 + this._offset.x, H / 2 + this._offset.y)
    ctx.scale(this._scale, this._scale)
    ctx.drawImage(this._canvas, -W / 2, -H / 2, W, H)
    ctx.restore()

    const dataURL = tmp.toDataURL('image/png')

    // Trigger file download
    const a = document.createElement('a')
    a.href     = dataURL
    a.download = `my-cake-ar-${Date.now()}.png`
    a.click()

    if (this._onSaveScreenshot) this._onSaveScreenshot(dataURL)
  }

  /* ───────────────────────────────────────────────────────────
     CLEANUP
     ─────────────────────────────────────────────────────────── */

  /**
   * Releases camera tracks, disposes the Three.js scene,
   * removes the DOM overlay, and invokes the onBack callback.
   */
  _close() {
    // Stop listening for resize
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize)
    }

    // Release camera — clears the browser camera-active indicator
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop())
      this._stream = null
    }

    // Dispose Three.js resources
    if (this._cakeScene && typeof this._cakeScene.dispose === 'function') {
      this._cakeScene.dispose()
    }

    // Remove UI
    if (this._container) {
      this._container.remove()
    }

    // Navigate back
    if (this._onBack) this._onBack()
  }
}

/* ─────────────────────────────────────────────────────────────
   Utility
   ───────────────────────────────────────────────────────────── */

/**
 * Returns the Euclidean distance between two touch points.
 * @param {TouchList} touches
 * @returns {number}
 */
function _touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

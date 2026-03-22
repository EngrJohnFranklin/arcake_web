/**
 * StartFlow.js
 *
 * Self-contained choice modal for "Start Customizing" button.
 * All styles are inline — works regardless of whether flow.css is loaded.
 *
 * Zero external dependencies — vanilla JS only.
 */

import { CakeScanner } from './CakeScanner.js'

/**
 * Show the "How do you want to start?" choice modal.
 * @param {Function} onComplete - Receives final shape string
 */
export function showStartChoiceModal(onComplete) {
  _buildModal(onComplete)
}

/** Alias kept for backwards compatibility. */
export function startCustomizingFlow(onComplete) {
  _buildModal(onComplete)
}

/* ────────────────────────────────────────────────────────────
   Choice Modal
   ──────────────────────────────────────────────────────────── */

function _buildModal(onComplete) {
  const overlay = Object.assign(document.createElement('div'), {
    id: 'ssc-overlay'
  })
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9999',
    background: 'rgba(0,0,0,0.52)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center'
  })

  const card = document.createElement('div')
  Object.assign(card.style, {
    background: '#fff', borderRadius: '24px',
    padding: '36px 28px 28px',
    width: 'min(420px, 92vw)', textAlign: 'center',
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)'
  })

  card.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:22px;
               font-weight:700;color:#1a1a1a">
      How do you want to start?
    </h2>
    <p style="margin:0 0 28px;font-size:14px;
              color:#999;line-height:1.6">
      Scan a real cake to auto-detect its shape,
      or jump straight into the customizer.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">

      <button id="ssc-scan-btn" style="
        display:flex;flex-direction:column;align-items:center;
        gap:10px;padding:24px 14px 20px;border:2px solid #f0f0f0;
        border-radius:16px;background:#fafafa;cursor:pointer;
        font-size:15px;font-weight:600;color:#1a1a1a;
        transition:border-color 0.18s,background 0.18s;
        font-family:inherit">
        <svg width="44" height="44" viewBox="0 0 44 44"
             fill="none" stroke="#E91E8C" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="10" width="40" height="28" rx="5"/>
          <circle cx="22" cy="24" r="8"/>
          <path d="M14 10l3-5h10l3 5"/>
        </svg>
        Scan shape
        <small style="font-size:11px;font-weight:400;
                      color:#bbb;font-family:inherit">
          Point at a real cake
        </small>
      </button>

      <button id="ssc-direct-btn" style="
        display:flex;flex-direction:column;align-items:center;
        gap:10px;padding:24px 14px 20px;border:2px solid #f0f0f0;
        border-radius:16px;background:#fafafa;cursor:pointer;
        font-size:15px;font-weight:600;color:#1a1a1a;
        transition:border-color 0.18s,background 0.18s;
        font-family:inherit">
        <svg width="44" height="44" viewBox="0 0 44 44"
             fill="none" stroke="#E91E8C" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="6" width="32" height="32" rx="6"/>
          <line x1="14" y1="22" x2="30" y2="22"/>
          <line x1="14" y1="16" x2="30" y2="16"/>
          <line x1="14" y1="28" x2="22" y2="28"/>
        </svg>
        Customize directly
        <small style="font-size:11px;font-weight:400;
                      color:#bbb;font-family:inherit">
          Pick shape yourself
        </small>
      </button>
    </div>
  `

  overlay.appendChild(card)
  document.body.appendChild(overlay)

  const close = () => {
    const el = document.getElementById('ssc-overlay')
    if (el) el.remove()
  }

  // Hover effects
  ;['ssc-scan-btn', 'ssc-direct-btn'].forEach(id => {
    const btn = card.querySelector('#' + id)
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#E91E8C'
      btn.style.background = '#fff0f6'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#f0f0f0'
      btn.style.background = '#fafafa'
    })
  })

  // SCAN
  card.querySelector('#ssc-scan-btn').addEventListener('click', () => {
    close()
    _openScanner(onComplete)
  })

  // DIRECT
  card.querySelector('#ssc-direct-btn').addEventListener('click', () => {
    close()
    onComplete('round')
  })

  // Backdrop dismiss
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close()
      onComplete('round')
    }
  })
}

/* ────────────────────────────────────────────────────────────
   Scanner Handoff
   ──────────────────────────────────────────────────────────── */

function _openScanner(onComplete) {
  let scanner
  try {
    scanner = new CakeScanner({
      onDetected: (shape) => {
        onComplete(shape && ['round', 'square', 'heart', 'layered'].includes(shape) ? shape : 'round')
      },
      onError: () => { onComplete('round') }
    })
    scanner.start()
  } catch (err) {
    console.warn('[StartFlow] CakeScanner failed to start:', err)
    onComplete('round')
  }
}

/* ────────────────────────────────────────────────────────────
   Shape Confirmation Card
   ──────────────────────────────────────────────────────────── */

function _showConfirmCard(shape, onComplete) {
  const names = {
    round: 'Round', square: 'Square',
    heart: 'Heart', layered: 'Layered'
  }
  const icons = {
    round:   `<circle cx="32" cy="32" r="24" fill="none"
                stroke="#E91E8C" stroke-width="3"/>`,
    square:  `<rect x="8" y="8" width="48" height="48" rx="6"
                fill="none" stroke="#E91E8C" stroke-width="3"/>`,
    heart:   `<path d="M32 54C6 36 4 10 18 6C26 4 32 16 32 16
                       C32 16 38 4 46 6C60 10 58 36 32 54Z"
                fill="none" stroke="#E91E8C" stroke-width="3"/>`,
    layered: `<ellipse cx="32" cy="46" rx="24" ry="10"
                fill="none" stroke="#E91E8C" stroke-width="2.5"/>
              <ellipse cx="32" cy="24" rx="16" ry="8"
                fill="none" stroke="#E91E8C" stroke-width="2.5"/>`
  }

  const card = document.createElement('div')
  card.id = 'ssc-confirm-card'
  Object.assign(card.style, {
    position: 'fixed', bottom: '0', left: '0', right: '0',
    zIndex: '10000', background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '28px 24px 44px', textAlign: 'center',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.14)'
  })

  const shapeName = names[shape] || 'Round'

  card.innerHTML = `
    <svg width="72" height="72" viewBox="0 0 64 64"
         style="display:block;margin:0 auto;">
      ${icons[shape] || icons.round}
    </svg>
    <h3 style="margin:10px 0 6px;font-size:20px;
               font-weight:700;color:#1a1a1a">
      We found a ${shapeName} cake
    </h3>
    <p style="margin:0 0 24px;font-size:14px;color:#999">
      This shape will be pre-selected in your customizer.
    </p>
    <button id="ssc-use-shape" style="
      display:block;width:100%;padding:14px;
      background:#E91E8C;color:#fff;border:none;
      border-radius:12px;font-size:16px;font-weight:700;
      cursor:pointer;margin-bottom:10px;font-family:inherit">
      Use ${shapeName} shape
    </button>
    <button id="ssc-skip-shape" style="
      display:block;width:100%;padding:12px;
      background:transparent;color:#888;
      border:1.5px solid #e0e0e0;border-radius:12px;
      font-size:15px;cursor:pointer;font-family:inherit">
      Choose shape myself
    </button>
  `
  document.body.appendChild(card)

  const removeCard = () => {
    const el = document.getElementById('ssc-confirm-card')
    if (el) el.remove()
  }

  card.querySelector('#ssc-use-shape').addEventListener('click', () => {
    removeCard()
    onComplete(shape)
  })
  card.querySelector('#ssc-skip-shape').addEventListener('click', () => {
    removeCard()
    onComplete('round')
  })
}

/**
 * StartFlow.js
 * Choice modal for the "Start Customizing" button.
 * Styles come from flow.css — no inline style blocks.
 */

import { CakeScanner } from './CakeScanner.js';

/**
 * Show the "How do you want to start?" choice modal.
 * @param {Function} onComplete - Receives final shape string
 */
export function showStartChoiceModal(onComplete) {
  _buildModal(onComplete);
}

function _buildModal(onComplete) {
  const overlay = document.createElement('div');
  overlay.id = 'ssc-overlay';
  overlay.className = 'sf-overlay';

  const card = document.createElement('div');
  card.className = 'sf-card';
  card.innerHTML = `
    <h2>How do you want to start?</h2>
    <p>Scan a real cake to auto-detect its shape,<br>or jump straight into the customizer.</p>
    <div class="sf-choices">
      <button id="ssc-scan-btn" class="sf-choice-btn">
        <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="10" width="40" height="28" rx="5"/>
          <circle cx="22" cy="24" r="8"/>
          <path d="M14 10l3-5h10l3 5"/>
        </svg>
        Scan shape
        <span class="sf-sub">Point at a real cake</span>
      </button>
      <button id="ssc-direct-btn" class="sf-choice-btn">
        <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="6" width="32" height="32" rx="6"/>
          <line x1="14" y1="22" x2="30" y2="22"/>
          <line x1="14" y1="16" x2="30" y2="16"/>
          <line x1="14" y1="28" x2="22" y2="28"/>
        </svg>
        Customize directly
        <span class="sf-sub">Pick shape yourself</span>
      </button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => {
    const el = document.getElementById('ssc-overlay');
    if (el) el.remove();
  };

  card.querySelector('#ssc-scan-btn').addEventListener('click', () => {
    close();
    _openScanner(onComplete);
  });

  card.querySelector('#ssc-direct-btn').addEventListener('click', () => {
    close();
    onComplete('round');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      onComplete('round');
    }
  });
}

function _openScanner(onComplete) {
  try {
    const scanner = new CakeScanner({
      onDetected: (shape) => {
        onComplete(['round', 'square', 'heart', 'layered'].includes(shape) ? shape : 'round');
      },
      onError: () => { onComplete('round'); },
    });
    scanner.start();
  } catch (err) {
    console.warn('[StartFlow] CakeScanner failed to start:', err);
    onComplete('round');
  }
}


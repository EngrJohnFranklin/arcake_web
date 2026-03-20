/**
 * @fileoverview Gallery page logic.
 * Loads saved designs from localStorage and renders them.
 */

/**
 * Show a toast notification (local copy to avoid import conflict with ui.js)
 * @param {string} message
 * @param {string} [type='']
 */
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast';
  if (type) toast.classList.add(type);
  void toast.offsetWidth;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

/**
 * Initialize the gallery page
 */
export function initGallery() {
  renderGallery();
}

/**
 * Get all saved designs from localStorage
 * @returns {Array} designs
 */
function getDesigns() {
  try {
    return JSON.parse(localStorage.getItem('arcake_designs') || '[]');
  } catch {
    return [];
  }
}

/**
 * Save designs array back to localStorage
 * @param {Array} designs
 */
function saveDesigns(designs) {
  localStorage.setItem('arcake_designs', JSON.stringify(designs));
}

/**
 * Render gallery cards
 */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  const emptyMsg = document.getElementById('galleryEmpty');
  if (!grid || !emptyMsg) return;

  const designs = getDesigns();

  if (designs.length === 0) {
    grid.style.display = 'none';
    emptyMsg.style.display = 'block';
    return;
  }

  grid.style.display = '';
  emptyMsg.style.display = 'none';
  grid.innerHTML = '';

  // Show newest first
  designs.slice().reverse().forEach((design) => {
    const card = _createDesignCard(design);
    grid.appendChild(card);
  });
}

/**
 * Create a gallery card element
 * @param {object} design - { id, date, state, screenshot }
 * @returns {HTMLElement}
 */
function _createDesignCard(design) {
  const card = document.createElement('div');
  card.className = 'card gallery-card';

  const date = new Date(design.date);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  const st = design.state || {};
  const summary = [
    _capitalize(st.shape || 'round'),
    _capitalize(st.size || 'medium'),
    _capitalize(st.flavor || 'vanilla'),
    _capitalize(st.frostingStyle || 'smooth')
  ].join(' · ');

  const toppingsStr = (st.toppings || [])
    .map((t) => _capitalize(t.replace(/_/g, ' ')))
    .join(', ') || 'None';

  // Use textContent for user-generated content to prevent XSS
  const img = document.createElement('div');
  img.className = 'gallery-card-img';
  if (design.screenshot) {
    const imgEl = document.createElement('img');
    imgEl.src = design.screenshot;
    imgEl.alt = 'Cake design preview';
    img.appendChild(imgEl);
  }

  const info = document.createElement('div');
  info.className = 'gallery-card-info';

  const dateEl = document.createElement('span');
  dateEl.className = 'gallery-date';
  dateEl.textContent = dateStr;

  const summaryEl = document.createElement('p');
  summaryEl.className = 'gallery-summary';
  summaryEl.textContent = summary;

  const toppingEl = document.createElement('p');
  toppingEl.className = 'gallery-toppings';
  toppingEl.textContent = `Toppings: ${toppingsStr}`;

  if (st.cakeText) {
    const textEl = document.createElement('p');
    textEl.className = 'gallery-caketext';
    textEl.textContent = `"${st.cakeText}"`;
    info.appendChild(textEl);
  }

  info.appendChild(dateEl);
  info.appendChild(summaryEl);
  info.appendChild(toppingEl);

  const actions = document.createElement('div');
  actions.className = 'gallery-card-actions';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn btn-primary btn-small';
  loadBtn.textContent = 'Customize This';
  loadBtn.addEventListener('click', () => {
    sessionStorage.setItem('arcake_loadDesign', JSON.stringify(st));
    window.location.href = './customize.html';
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-secondary btn-small';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => {
    const designs = getDesigns().filter((d) => d.id !== design.id);
    saveDesigns(designs);
    renderGallery();
    showToast('Design deleted', 'success');
  });

  actions.appendChild(loadBtn);
  actions.appendChild(delBtn);

  card.appendChild(img);
  card.appendChild(info);
  card.appendChild(actions);

  return card;
}

/**
 * Capitalize first letter of string
 * @param {string} str
 * @returns {string}
 */
function _capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

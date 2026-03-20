/**
 * @fileoverview Simple router utility.
 * Provides helper functions for page navigation.
 * Uses standard page-based routing (no SPA hash routing needed
 * since Vite handles multi-page apps natively).
 */

/**
 * Navigate to a page
 * @param {string} page - Relative URL path
 */
export function navigateTo(page) {
  window.location.href = page;
}

/**
 * Get the current page name from the URL path
 * @returns {string} 'home' | 'customize' | 'gallery'
 */
export function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('customize')) return 'customize';
  if (path.includes('gallery')) return 'gallery';
  return 'home';
}

/**
 * Highlight the active nav link based on current page
 */
export function highlightActiveNav() {
  const current = getCurrentPage();
  const links = document.querySelectorAll('.navbar-nav a');
  links.forEach((link) => {
    const href = link.getAttribute('href').toLowerCase();
    const isActive =
      (current === 'home' && (href.includes('index') || href.endsWith('/'))) ||
      (current === 'customize' && href.includes('customize')) ||
      (current === 'gallery' && href.includes('gallery'));
    link.classList.toggle('active', isActive);
  });
}

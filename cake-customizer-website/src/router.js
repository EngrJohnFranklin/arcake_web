/**
 * @fileoverview Simple router utility.
 * Provides helper functions for page detection.
 */

/**
 * Get the current page name from the URL path.
 * @returns {string} 'home' | 'customize'
 */
export function getCurrentPage() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('customize')) return 'customize';
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
      (current === 'customize' && href.includes('customize'));
    link.classList.toggle('active', isActive);
  });
}

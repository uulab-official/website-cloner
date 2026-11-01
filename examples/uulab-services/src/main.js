/** Progressive enhancement only: all page content is rendered by Vite. */
const root = document.documentElement;
const themeButtons = [...document.querySelectorAll('[data-theme-toggle]')];

function setTheme(theme, persist = false) {
  const dark = theme === 'dark';
  root.classList.toggle('dark', dark);
  root.dataset.theme = dark ? 'dark' : 'light';
  themeButtons.forEach((button) => button.setAttribute('aria-pressed', String(dark)));
  if (persist) {
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); }
    catch { /* Theme controls still work when storage is unavailable. */ }
  }
}

setTheme(root.dataset.theme);
themeButtons.forEach((button) => {
  button.hidden = false;
  button.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
});
window.addEventListener('storage', (event) => {
  if (event.key === 'theme') setTheme(event.newValue);
});

const menuButton = document.querySelector('.navbar-toggler');
const mobileMenu = document.querySelector('#mobile-navigation');
const desktopViewport = window.matchMedia('(min-width: 1024px)');

function closeMenu({ restoreFocus = false } = {}) {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
  mobileMenu.hidden = true;
  mobileMenu.inert = true;
  mobileMenu.setAttribute('aria-hidden', 'true');
  if (restoreFocus && !desktopViewport.matches) menuButton.focus();
}

function openMenu() {
  if (desktopViewport.matches) return;
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', '메뉴 닫기');
  mobileMenu.hidden = false;
  mobileMenu.inert = false;
  mobileMenu.setAttribute('aria-hidden', 'false');
}

menuButton.hidden = false;
menuButton.addEventListener('click', () => {
  if (menuButton.getAttribute('aria-expanded') === 'true') closeMenu();
  else openMenu();
});
mobileMenu.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#navigation') && menuButton.getAttribute('aria-expanded') === 'true') closeMenu();
});
desktopViewport.addEventListener('change', () => {
  const focusWasInMobileMenu = mobileMenu.contains(document.activeElement);
  closeMenu();
  if (desktopViewport.matches && focusWasInMobileMenu) {
    document.querySelector('.desktop-navigation a[aria-current="page"]').focus();
  }
});

const backToTop = document.querySelector('#backToTopButton');
const navbar = document.querySelector('#navigation');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let scrollFrame = 0;

function updateScrollControls() {
  backToTop.hidden = window.scrollY <= 300;
  navbar.classList.toggle('is-scrolled', window.scrollY > 10);
  scrollFrame = 0;
}
window.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollControls);
}, { passive: true });
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  document.querySelector('#main-content').focus({ preventScroll: true });
});
window.addEventListener('pageshow', () => {
  closeMenu();
  updateScrollControls();
});
updateScrollControls();

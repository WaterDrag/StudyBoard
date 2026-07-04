const APP_VERSION = '6.7';

// Apply the saved theme immediately — this file is the very first script in
// every page's <head> (loaded with a Date.now() cache-buster), so setting
// data-theme here means the page never flashes in the wrong theme before
// JS "catches up". Theme values map to [data-theme=...] blocks in style.css.
try {
  const savedTheme = localStorage.getItem('sb_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
} catch (e) { /* localStorage blocked — default theme */ }

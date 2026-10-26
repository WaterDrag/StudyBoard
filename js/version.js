const APP_VERSION = '10.79';

// Apply the saved theme immediately — this file is the very first script in
// every page's <head> (loaded with a Date.now() cache-buster), so setting
// data-theme here means the page never flashes in the wrong theme before
// JS "catches up". Theme values map to [data-theme=...] blocks in style.css.
try {
  const savedTheme = localStorage.getItem('sb_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
} catch (e) { /* localStorage blocked — default theme */ }

// Stará stránka z mezipaměti po cestě (Safari s iCloud Private Relay dostával starou verzi i v anonymním
// okně a obnovení nepomohlo): zeptá se serveru, kdy byla stránka nahraná, a když je novější než ta
// načtená, načte ji znovu s adresou, kterou žádná mezipaměť nemá. Jednou za nasazení, bez smyčky.
(function () {
  try {
    if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
    const u = new URL(location.href);
    if (u.searchParams.has('_fresh')) { u.searchParams.delete('_fresh'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
    const mine = Date.parse(document.lastModified);
    if (!mine) return;
    fetch(u.pathname + u.search + (u.search ? '&' : '?') + '_lm=' + Date.now(), { method: 'HEAD', cache: 'no-store' }).then(r => {
      const srv = Date.parse(r.headers.get('last-modified') || '');
      if (!r.ok || !srv || srv - mine < 2000) return;
      const key = 'sb_fresh_' + u.pathname;
      if (sessionStorage.getItem(key) === String(srv)) return;   // už jsme to zkusili, dál nic
      sessionStorage.setItem(key, String(srv));
      u.searchParams.set('_fresh', Date.now());
      location.replace(u.href);
    }).catch(() => {});
  } catch (e) { /* bez sítě nebo bez sessionStorage — nic */ }
})();

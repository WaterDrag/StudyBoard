const APP_VERSION = '1.0.0';
// Český tvar podle počtu: czN(2, 'karta', 'karty', 'karet') → 'karty'. Je tady, protože version.js je na každé stránce první.
function czN(n, one, few, many) { n = Math.abs(n); return n === 1 ? one : n >= 2 && n <= 4 ? few : many; }
// Anglické hlášky Firebase a prohlížeče přeložené do češtiny. Volá ji každá funkce toast():
// český začátek hlášky („Chyba: …“, „Nepovedlo se: …“) zůstane, anglický zbytek se nahradí.
const SB_ERRS = [
  [/Missing or insufficient permissions|permission[-_ ]denied/i, 'Na tohle nemáš oprávnění.'],
  [/client is offline|Failed to fetch|NetworkError|network[- ]request|Could not reach|\bunavailable\b|ERR_INTERNET/i, 'Nejde se spojit se serverem. Zkontroluj připojení k internetu a zkus to znovu.'],
  [/quota|resource[-_ ]exhausted|Too many requests|\b429\b/i, 'Server je teď přetížený. Zkus to prosím za chvíli.'],
  [/deadline[-_ ]exceeded|timed? ?out/i, 'Server neodpověděl včas. Zkus to znovu.'],
  [/No document to update|not[-_ ]found/i, 'Tahle položka už neexistuje, někdo ji možná mezitím smazal.'],
  [/already[-_ ]exists/i, 'Tohle už existuje.'],
  [/unauthenticated|auth\/user-token-expired|requires-recent-login/i, 'Přihlášení vypršelo. Přihlas se prosím znovu.'],
  [/invalid-argument|Function .* called with invalid data|Unsupported field value/i, 'Tahle data se nedají uložit (něco v nich chybí nebo je moc velké).'],
];
// Posledních pár chyb ze všech stránek pro hlášení chyby (brouk na hlavní stránce přiloží až 8 posledních)
(function () {
  const keep = (m, src) => {
    try {
      const log = JSON.parse(localStorage.getItem('sb_errlog') || '[]') || [];
      const t = new Date().toISOString().slice(5, 16).replace('T', ' ');
      const p = location.pathname.replace(/^\/|\.html$/g, '') || 'index';
      const msg = String(m || '').slice(0, 300) + (src ? ` (${String(src).replace(/^.*\//, '').slice(0, 60)})` : '');
      if (log.length && log[log.length - 1].m === msg) return;   // stejná chyba pořád dokola
      log.push({ t, p, m: msg });
      localStorage.setItem('sb_errlog', JSON.stringify(log.slice(-15)));
    } catch (_) {}
  };
  addEventListener('error', e => { if (e.message) keep(e.message, e.filename ? `${e.filename}:${e.lineno}` : ''); });
  addEventListener('unhandledrejection', e => keep('Promise: ' + (e.reason?.message || e.reason)));
})();
function sbErr(msg) {
  msg = String(msg ?? '');
  for (const [re, cz] of SB_ERRS) {
    const m = msg.match(re);
    if (!m) continue;
    // Uřízne se od začátku anglické části (i s „FirebaseError: [code=…]“ před ní)
    const fe = msg.search(/FirebaseError|\[code=|Error:/);
    const cut = Math.min(m.index, fe >= 0 ? fe : Infinity);
    return (msg.slice(0, cut).trim() + ' ' + cz).trim();
  }
  return msg;
}

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

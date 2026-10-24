/* icons.js — kreslené ikony (SVG) místo emoji v celé aplikaci (emoji ve Windows/Edge vypadají špatně).
 * SBI.html(text) vrátí text s emoji nahrazenými <span class="tdi">…svg…</span>; SBI.set(el, text) to zapíše jen při změně.
 * Hlídač stránky (MutationObserver) převádí texty, které vloží ostatní kód; přeskakuje obsah od uživatelů
 * (editory, poznámky, pole, [data-noicons]). Kreslení emoji do plátna (fillText) se taky nahradí ikonou.
 * Neznámá emoji zůstávají. Styl: obrys #111, ploché barvy, světlo vlevo nahoře. (TDI = starší název pro Obranu.) */
(function () {
  'use strict';
  const O = 'stroke="#111" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
  const hi = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55"/>`;
  // název → vnitřek SVG (viewBox 0 0 20 20)
  const I = {
    heart: `<path d="M10 17.2C4 13 2.2 10 2.2 7.2 2.2 4.8 4 3 6.2 3c1.6 0 2.9.9 3.8 2.3C10.9 3.9 12.2 3 13.8 3 16 3 17.8 4.8 17.8 7.2c0 2.8-1.8 5.8-7.8 10z" fill="#ef4444" ${O}/>${hi(6.2, 6.4, 1.8, 1.1)}`,
    greenheart: `<path d="M10 17.2C4 13 2.2 10 2.2 7.2 2.2 4.8 4 3 6.2 3c1.6 0 2.9.9 3.8 2.3C10.9 3.9 12.2 3 13.8 3 16 3 17.8 4.8 17.8 7.2c0 2.8-1.8 5.8-7.8 10z" fill="#22c55e" ${O}/>${hi(6.2, 6.4, 1.8, 1.1)}`,
    coin: `<circle cx="10" cy="10" r="7.6" fill="#f5c518" ${O}/><circle cx="10" cy="10" r="5" fill="none" stroke="#b8860b" stroke-width="1.3"/>${hi(7.4, 7, 2, 1.2)}`,
    gem: `<path d="M5 3h10l3.4 4.4L10 17.6 1.6 7.4z" fill="#38bdf8" ${O}/><path d="M1.6 7.4h16.8M5 3l2.4 4.4L10 17.6l2.6-10.2L15 3" fill="none" stroke="#0c4a6e" stroke-width="1"/><path d="M5 3l2.4 4.4H1.6z" fill="#fff" opacity=".55"/>`,
    wave: `<path d="M1.5 13.5c2-3 4-3.6 5.6-2.4 1.2-4.6 5.4-7 9.2-5.2-2.8.2-4.6 2.2-4.2 4.8.4 2.2 2.6 3 4.4 2.6v3.2H1.5z" fill="#3b82f6" ${O}/><path d="M3 15.4c2-1 3.6-1 5 0s3.2 1 5 0 3.2-1 4.8 0" fill="none" stroke="#bfdbfe" stroke-width="1.2"/>`,
    bag: `<path d="M7 5.5 5.6 2.8h8.8L13 5.5" fill="#a16207" ${O}/><path d="M7 5.5c-3.6 2-5 5.4-4.2 8.4.8 2.6 3.4 3.6 7.2 3.6s6.4-1 7.2-3.6c.8-3-.6-6.4-4.2-8.4z" fill="#ca8a04" ${O}/><path d="M7 5.5h6" ${O}/><text x="10" y="14.6" font-size="7" font-weight="700" text-anchor="middle" fill="#fef3c7" font-family="sans-serif">$</text>${hi(6.4, 9, 1.6, 1)}`,
    scroll: `<rect x="4" y="4" width="12" height="12" rx="1" fill="#fef3c7" ${O}/><rect x="2.4" y="2.6" width="15.2" height="3.2" rx="1.6" fill="#d6a35c" ${O}/><rect x="2.4" y="14.2" width="15.2" height="3.2" rx="1.6" fill="#d6a35c" ${O}/><path d="M6.4 8.6h7.2M6.4 11.2h5.4" stroke="#a16207" stroke-width="1.1" stroke-linecap="round"/>`,
    swords: `<path d="M3 3l10.4 10.4M17 3 6.6 13.4" stroke="#111" stroke-width="3.6" stroke-linecap="round"/><path d="M3 3l10.4 10.4M17 3 6.6 13.4" stroke="#e5e7eb" stroke-width="1.8" stroke-linecap="round"/><path d="M11.4 15.4l4-4M8.6 15.4l-4-4" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M11.4 15.4l4-4M8.6 15.4l-4-4" stroke="#a16207" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="16" r="1.6" fill="#f5c518" ${O}/><circle cx="4" cy="16" r="1.6" fill="#f5c518" ${O}/>`,
    ghost: `<path d="M4 17V9a6 6 0 0 1 12 0v8l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6z" fill="#f8fafc" ${O}/><circle cx="7.8" cy="9" r="1.2" fill="#111"/><circle cx="12.2" cy="9" r="1.2" fill="#111"/>${hi(7, 6, 1.6, 1)}`,
    orb: `<path d="M5.4 17.4h9.2l-1.6-3H7z" fill="#a16207" ${O}/><circle cx="10" cy="9" r="6" fill="#a855f7" ${O}/><circle cx="10" cy="9" r="3" fill="#e9d5ff" opacity=".6"/>${hi(7.8, 6.6, 1.8, 1.1)}`,
    wind: `<path d="M2.5 7h9.5a2.6 2.6 0 1 0-2.6-2.6M2.5 10.5h13a2.6 2.6 0 1 1-2.6 2.6M2.5 14h6" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M2.5 7h9.5a2.6 2.6 0 1 0-2.6-2.6M2.5 10.5h13a2.6 2.6 0 1 1-2.6 2.6M2.5 14h6" fill="none" stroke="#e0f2fe" stroke-width="1.6" stroke-linecap="round"/>`,
    trophy: `<path d="M5 3h10v4.4a5 5 0 0 1-10 0z" fill="#f5c518" ${O}/><path d="M5 4.4H2.6c0 3 1.2 4.2 2.8 4.4M15 4.4h2.4c0 3-1.2 4.2-2.8 4.4" fill="none" ${O}/><path d="M8.4 12h3.2v2.6H8.4zM6 14.6h8v2.6H6z" fill="#b8860b" ${O}/>${hi(7.8, 5.4, 1.4, 1)}`,
    play: `<path d="M5.4 3.4 16 10 5.4 16.6z" fill="#22c55e" ${O}/>`,
    pause: `<rect x="4.6" y="3.6" width="3.8" height="12.8" rx="1" fill="#e5e7eb" ${O}/><rect x="11.6" y="3.6" width="3.8" height="12.8" rx="1" fill="#e5e7eb" ${O}/>`,
    skip: `<path d="M2.6 4 9.4 10l-6.8 6zM9.4 4l6.8 6-6.8 6z" fill="#22c55e" ${O}/><rect x="16" y="4" width="2" height="12" rx=".6" fill="#22c55e" ${O}/>`,
    boom: `<path d="M10 1.6l1.9 4.6 4.8-1.6-2 4.4 4 2.4-4.7 1 .7 4.9-3.7-3.2-3.8 3.4.6-5-4.7-.8 3.9-2.7L5 4.6l4.6 1.4z" fill="#f97316" ${O}/><path d="M10 6l1 2.6 2.6-.8-1.2 2.4 2 1.4-2.6.4.4 2.6-2.2-1.8-2 1.8.4-2.6-2.6-.4 2.2-1.6-1.2-2.4 2.6.8z" fill="#fde047"/>`,
    castle: `<path d="M2.6 17.4V8.6h3V6.4h2v2.2h1.6V6.4h1.6v2.2h1.6V6.4h2v2.2h3v8.8z" fill="#9ca3af" ${O}/><path d="M2.6 8.6 4.1 3.4l1.5 5.2M14.4 8.6l1.5-5.2 1.5 5.2" fill="#ef4444" ${O}/><path d="M8.2 17.4v-4a1.8 1.8 0 0 1 3.6 0v4z" fill="#6b4320" ${O}/>`,
    crown: `<path d="M2.6 15.6 2 5.4l4.4 4 3.6-6 3.6 6 4.4-4-.6 10.2z" fill="#f5c518" ${O}/><circle cx="10" cy="11.6" r="1.6" fill="#ef4444" ${O}/><path d="M2.6 15.6h14.8" ${O}/>${hi(6, 10.6, 1.4, .8)}`,
    bubble: `<circle cx="8" cy="11" r="5.4" fill="#a5f3fc" fill-opacity=".45" ${O}/><circle cx="14.6" cy="5.6" r="2.8" fill="#a5f3fc" fill-opacity=".45" ${O}/>${hi(6.4, 9, 1.6, 1)}`,
    torch: `<path d="M7.4 9.6h5.2l-1.4 8H8.8z" fill="#7a4a22" ${O}/><path d="M10 9.6C6.6 8 7.6 4.4 10 2c.4 2 2.6 2.6 2.6 5 0 1.4-1 2.4-2.6 2.6z" fill="#f97316" ${O}/><path d="M10 9c-1.2-.8-1-2.4 0-3.6.4 1 1.2 1.4 1.2 2.4 0 .6-.4 1-1.2 1.2z" fill="#fde047"/>`,
    rock: `<path d="M2.4 15.6 4 9.2 8 5l5.4 1.4 3.6 4.4.8 4.8z" fill="#9ca3af" ${O}/><path d="M4 9.2 8 5l1.2 4.2z" fill="#fff" opacity=".45"/><path d="M9.2 9.2l3.6 1.6" stroke="#52525b" stroke-width="1"/>`,
    no: `<circle cx="10" cy="10" r="7.4" fill="#fff" stroke="#111" stroke-width="1.4"/><circle cx="10" cy="10" r="6" fill="none" stroke="#ef4444" stroke-width="2.4"/><path d="M5.8 14.2l8.4-8.4" stroke="#ef4444" stroke-width="2.4"/>`,
    gear: `<path d="M8.6 1.8h2.8l.4 2.3 1.6.7 2-1.3 2 2-1.3 2 .7 1.6 2.3.4v2.8l-2.3.4-.7 1.6 1.3 2-2 2-2-1.3-1.6.7-.4 2.3H8.6l-.4-2.3-1.6-.7-2 1.3-2-2 1.3-2-.7-1.6-2.3-.4V8.6l2.3-.4.7-1.6-1.3-2 2-2 2 1.3 1.6-.7z" fill="#9ca3af" ${O}/><circle cx="10" cy="10" r="2.8" fill="#4b5563" ${O}/>`,
    book: `<path d="M10 5.4C7.6 3.8 4.8 3.6 2 4.4v11.4c2.8-.8 5.6-.6 8 1 2.4-1.6 5.2-1.8 8-1V4.4c-2.8-.8-5.6-.6-8 1z" fill="#fef3c7" ${O}/><path d="M10 5.4v11.4" ${O}/><path d="M4 7.6c1.4-.3 2.8-.2 4 .4M12 8c1.2-.6 2.6-.7 4-.4M4 10.6c1.4-.3 2.8-.2 4 .4M12 11c1.2-.6 2.6-.7 4-.4" stroke="#a16207" stroke-width=".9" fill="none"/>`,
    sprout: `<path d="M10 17.4V9" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M10 17.4V9" stroke="#16a34a" stroke-width="1.4" stroke-linecap="round"/><path d="M10 10C6.4 10 3.4 8 3 4.4 6.6 4.2 9.6 6.2 10 10z" fill="#4ade80" ${O}/><path d="M10 8.6c.4-3.4 3.2-5.6 7-5.4-.2 3.4-3 5.6-7 5.4z" fill="#22c55e" ${O}/>`,
    dotblue: `<circle cx="10" cy="10" r="6.4" fill="#3b82f6" ${O}/>${hi(7.8, 7.6, 1.8, 1.1)}`,
    dotgreen: `<circle cx="10" cy="10" r="6.4" fill="#22c55e" ${O}/>${hi(7.8, 7.6, 1.8, 1.1)}`,
    angry: `<circle cx="10" cy="10.4" r="7.4" fill="#ef4444" ${O}/><path d="M5 7.4l3.6 1.6M15 7.4l-3.6 1.6" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><circle cx="7.6" cy="10" r="1.1" fill="#111"/><circle cx="12.4" cy="10" r="1.1" fill="#111"/><path d="M7 14.6c2-1.4 4-1.4 6 0" fill="none" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>`,
    split: `<path d="M10 2.4v15.2M2.4 10h15.2M4.6 4.6l10.8 10.8M15.4 4.6 4.6 15.4" stroke="#111" stroke-width="3.6" stroke-linecap="round"/><path d="M10 2.4v15.2M2.4 10h15.2M4.6 4.6l10.8 10.8M15.4 4.6 4.6 15.4" stroke="#84cc16" stroke-width="1.8" stroke-linecap="round"/>`,
    shield: `<path d="M10 2 3.4 4.6v5c0 4 2.8 6.6 6.6 8.4 3.8-1.8 6.6-4.4 6.6-8.4v-5z" fill="#60a5fa" ${O}/><path d="M10 2v16M3.4 8.6h13.2" stroke="#e5e7eb" stroke-width="1.4"/><path d="M10 2 3.4 4.6v4H10z" fill="#fff" opacity=".35"/>`,
    pick: `<path d="M3.2 5.4C6.6 2.4 13.4 2.4 16.8 5.4 13.4 4.4 6.6 4.4 3.2 5.4z" fill="#9ca3af" ${O}/><path d="M10 4.4l-1 13" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M10 4.4l-1 13" stroke="#a16207" stroke-width="1.6" stroke-linecap="round"/>`,
    magnet: `<path d="M4 3.4h3.4v7a2.6 2.6 0 0 0 5.2 0v-7H16v7a6 6 0 0 1-12 0z" fill="#ef4444" ${O}/><path d="M4 3.4h3.4v2.6H4zM12.6 3.4H16v2.6h-3.4z" fill="#e5e7eb" ${O}/>`,
    ice: `<path d="M3.4 6.6 10 3l6.6 3.6v7L10 17.2l-6.6-3.6z" fill="#bae6fd" ${O}/><path d="M3.4 6.6 10 10.2l6.6-3.6M10 10.2v7" fill="none" stroke="#0369a1" stroke-width="1"/><path d="M3.4 6.6 10 3l6.6 3.6L10 10.2z" fill="#fff" opacity=".55"/>`,
    bee: `<ellipse cx="7" cy="7" rx="3.4" ry="2.4" fill="#e0f2fe" fill-opacity=".8" ${O} transform="rotate(-30 7 7)"/><ellipse cx="13" cy="7" rx="3.4" ry="2.4" fill="#e0f2fe" fill-opacity=".8" ${O} transform="rotate(30 13 7)"/><ellipse cx="10" cy="12" rx="5.4" ry="4.4" fill="#facc15" ${O}/><path d="M8 8.2v7.6M12 8.2v7.6" stroke="#111" stroke-width="1.6"/>`,
    helmet: `<path d="M2.4 14.6c0-6 3.4-9.6 7.6-9.6s7.6 3.6 7.6 9.6z" fill="#9ca3af" ${O}/><path d="M1.6 14.6h16.8" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M1.6 14.6h16.8" stroke="#6b7280" stroke-width="1.2" stroke-linecap="round"/><path d="M10 5v9.4" stroke="#6b7280" stroke-width="1.2"/>${hi(6.4, 8.6, 1.8, 1)}`,
    pin: `<path d="M10 18.4 5 10.4a5.6 5.6 0 1 1 10 0z" fill="#ef4444" ${O}/><circle cx="10" cy="7.6" r="2.2" fill="#fff" ${O}/>`,
    candle: `<rect x="6.6" y="8" width="6.8" height="9.6" rx="1" fill="#f5f5f4" ${O}/><path d="M10 7.4c-2-1-1.6-3.4 0-5.2.4 1.6 1.8 2 1.8 3.4 0 1-.8 1.6-1.8 1.8z" fill="#f97316" ${O}/><path d="M6.6 10.4c1.2.4 2 .4 2.4 1.6" stroke="#d6d3d1" stroke-width="1" fill="none"/>`,
    crane: `<path d="M4 17.6V4.4M4 4.4h12.4M4 8 8.6 4.4" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M4 17.6V4.4M4 4.4h12.4M4 8 8.6 4.4" fill="none" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/><path d="M14 4.4v5" stroke="#52525b" stroke-width="1"/><rect x="11.6" y="9.4" width="4.8" height="3.4" fill="#a16207" ${O}/><path d="M1.6 17.6h6" ${O}/>`,
    muscle: `<path d="M3 15.6c-.6-4 .6-7 3.4-8.6L8.6 3c1.4-.8 3 .4 2.6 1.8L10.6 7c3.8-.6 6.6 2.2 6.4 5.6-.2 2.8-2.8 4.2-6.4 4H5z" fill="#f1c08f" ${O}/><path d="M10.6 7c-1 2.4-.6 4.4 1.2 5.6" fill="none" stroke="#c48a52" stroke-width="1.1"/>`,
    flag: `<path d="M4 18V2.6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M4 18V2.6" stroke="#6b4320" stroke-width="1.2" stroke-linecap="round"/><path d="M4.6 3h11.4v7.6H4.6z" fill="#fff" ${O}/><path d="M4.6 3h2.8v2.5H4.6zM10.3 3h2.9v2.5h-2.9zM7.4 5.5h2.9V8H7.4zM13.2 5.5H16V8h-2.8zM4.6 8h2.8v2.6H4.6zM10.3 8h2.9v2.6h-2.9z" fill="#111"/>`,
    trash: `<path d="M5 6.2h10l-1 11H6z" fill="#9ca3af" ${O}/><path d="M3.4 5.4h13.2M8 5.4V3.2h4v2.2" fill="none" ${O}/><path d="M8.2 8.6v6M11.8 8.6v6" stroke="#4b5563" stroke-width="1.2"/>`,
    palette: `<path d="M10 2.4c4.6 0 7.8 3 7.8 6.6 0 2.4-1.8 3.4-3.6 3.2-1.6-.2-2.6 1-2 2.4.6 1.6-.4 3-2.6 3C5.6 17.6 2.2 14.2 2.2 10S5.6 2.4 10 2.4z" fill="#f5deb3" ${O}/><circle cx="6.4" cy="8" r="1.4" fill="#ef4444"/><circle cx="9.6" cy="5.6" r="1.4" fill="#3b82f6"/><circle cx="13.4" cy="6.6" r="1.4" fill="#22c55e"/><circle cx="6.4" cy="12" r="1.4" fill="#facc15"/>`,
    person: `<circle cx="10" cy="6.4" r="3.6" fill="#f1c08f" ${O}/><path d="M3.4 17.6c0-4 2.8-6.4 6.6-6.4s6.6 2.4 6.6 6.4z" fill="#3b82f6" ${O}/>`,
    pencil: `<path d="M3 17l1-4.2 9.4-9.4 3.2 3.2L7.2 16z" fill="#facc15" ${O}/><path d="M13.4 3.4l1.6-1.6 3.2 3.2-1.6 1.6z" fill="#f472b6" ${O}/><path d="M3 17l1-4.2 3.2 3.2z" fill="#f1c08f" ${O}/>`,
    snow: `<path d="M10 2v16M3 6l14 8M17 6 3 14" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M10 2v16M3 6l14 8M17 6 3 14" stroke="#bae6fd" stroke-width="1.4" stroke-linecap="round"/>`,
    warn: `<path d="M10 2.4 18.4 17H1.6z" fill="#facc15" ${O}/><path d="M10 7.4v4.6" stroke="#111" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.4" r="1.1" fill="#111"/>`,
    target: `<circle cx="10" cy="10" r="7.6" fill="#fff" ${O}/><circle cx="10" cy="10" r="5.2" fill="#ef4444"/><circle cx="10" cy="10" r="3" fill="#fff"/><circle cx="10" cy="10" r="1.4" fill="#ef4444"/>`,
    eye: `<path d="M1.6 10C4 5.8 7 4.4 10 4.4s6 1.4 8.4 5.6C16 14.2 13 15.6 10 15.6S4 14.2 1.6 10z" fill="#fff" ${O}/><circle cx="10" cy="10" r="3.4" fill="#3b82f6" ${O}/><circle cx="10" cy="10" r="1.5" fill="#111"/><circle cx="8.8" cy="8.8" r=".8" fill="#fff"/>`,
    infinity: `<path d="M10 10c-2-3-6.6-3.4-6.6 0s4.6 3 6.6 0 6.6-3.4 6.6 0-4.6 3-6.6 0z" fill="none" stroke="#111" stroke-width="3.4"/><path d="M10 10c-2-3-6.6-3.4-6.6 0s4.6 3 6.6 0 6.6-3.4 6.6 0-4.6 3-6.6 0z" fill="none" stroke="#a855f7" stroke-width="1.6"/>`,
    mouse: `<rect x="5" y="2.4" width="10" height="15.2" rx="5" fill="#e5e7eb" ${O}/><path d="M10 2.4v5.6M5 8h10" stroke="#111" stroke-width="1.2"/><rect x="9.2" y="4" width="1.6" height="2.4" rx=".8" fill="#6b7280"/>`,
    boat: `<path d="M2 12.6h16l-2.6 4.4H4.6z" fill="#8b5a2b" ${O}/><path d="M9.4 2.4v10.2" stroke="#111" stroke-width="1.4"/><path d="M10.4 3.2l5.6 8H10.4z" fill="#f5f5f4" ${O}/><path d="M8.4 4.4 4 11.2h4.4z" fill="#e5e7eb" ${O}/>`,
    tower: `<path d="M5.4 17.6 6.6 7h6.8l1.2 10.6z" fill="#9ca3af" ${O}/><path d="M5 7V4h1.8v1.4h1.6V4h3.2v1.4h1.6V4H15v3z" fill="#b4b9be" ${O}/><path d="M8.6 17.6v-3.4a1.4 1.4 0 0 1 2.8 0v3.4z" fill="#6b4320" ${O}/><path d="M10 4V1.4l3 1.2-3 1.2" fill="#3b82f6" ${O}/>`,
    bank: `<path d="M2 7.4 10 2.6l8 4.8z" fill="#f5c518" ${O}/><path d="M3.4 7.4h13.2v1.8H3.4zM2.6 15.8h14.8v1.8H2.6z" fill="#e5e7eb" ${O}/><path d="M5 9.2v6.6M8.4 9.2v6.6M11.6 9.2v6.6M15 9.2v6.6" stroke="#111" stroke-width="2.6"/><path d="M5 9.2v6.6M8.4 9.2v6.6M11.6 9.2v6.6M15 9.2v6.6" stroke="#e5e7eb" stroke-width="1.2"/>`,
    sparkle: `<path d="M8 2l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4z" fill="#fde047" ${O}/><path d="M15 11l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="#fde047" ${O}/>`,
    lock: `<path d="M6.4 9V6.4a3.6 3.6 0 0 1 7.2 0V9" fill="none" stroke="#111" stroke-width="3.2"/><path d="M6.4 9V6.4a3.6 3.6 0 0 1 7.2 0V9" fill="none" stroke="#9ca3af" stroke-width="1.6"/><rect x="4" y="8.6" width="12" height="9" rx="1.6" fill="#f5c518" ${O}/><circle cx="10" cy="12.4" r="1.4" fill="#111"/><path d="M10 12.4v2.6" stroke="#111" stroke-width="1.2"/>`,
    gift: `<rect x="3" y="7.6" width="14" height="10" rx="1" fill="#ef4444" ${O}/><rect x="2" y="5.4" width="16" height="3.4" rx="1" fill="#f87171" ${O}/><path d="M10 5.4v12.2" stroke="#fde047" stroke-width="2.4"/><path d="M10 5.4C8 2 5 2.4 5.6 4.4 6 5.4 8 5.4 10 5.4zm0 0c2-3.4 5-3 4.4-1-.4 1-2.4 1-4.4 1z" fill="#fde047" ${O}/>`,
    hands: `<path d="M1.6 9.4 5.6 6l3 1.4 3-1.4 6.8 3.4-3.4 4.6-3.4 2.2-4.2-2.4-2.4-1.4z" fill="#f1c08f" ${O}/><path d="M8.6 7.4 6.4 10a1.4 1.4 0 0 0 2 1.6l2.2-1.4 3 2.2" fill="none" ${O}/>`,
    plug: `<path d="M7 2v4.4M13 2v4.4" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M4.6 6.4h10.8v3a5.4 5.4 0 0 1-10.8 0z" fill="#9ca3af" ${O}/><path d="M10 14.8V18" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`,
    bulb: `<path d="M10 2.4a5.6 5.6 0 0 0-3.4 10c.8.6 1 1.4 1 2.2h4.8c0-.8.2-1.6 1-2.2a5.6 5.6 0 0 0-3.4-10z" fill="#fde047" ${O}/><path d="M7.6 15.6h4.8v2.2H7.6z" fill="#9ca3af" ${O}/>${hi(8, 6, 1.6, 1)}`,
    skull: `<path d="M10 2.4c-4.2 0-7 2.8-7 6.4 0 2.2 1.2 3.6 2.6 4.4v3.2h8.8v-3.2c1.4-.8 2.6-2.2 2.6-4.4 0-3.6-2.8-6.4-7-6.4z" fill="#f5f5f4" ${O}/><circle cx="7.2" cy="9.4" r="1.8" fill="#111"/><circle cx="12.8" cy="9.4" r="1.8" fill="#111"/><path d="M8.6 16.4v-1.8M11.4 16.4v-1.8M10 12l-.8 1.4h1.6z" stroke="#111" stroke-width="1"/>`,
    cycle: `<path d="M15.6 7.4A6 6 0 0 0 4.6 6.2M4.4 12.6a6 6 0 0 0 11 1.2" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M15.6 7.4A6 6 0 0 0 4.6 6.2M4.4 12.6a6 6 0 0 0 11 1.2" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/><path d="M16.6 3.4v4.4h-4.4zM3.4 16.6v-4.4h4.4z" fill="#3b82f6" ${O}/>`,
    link: `<rect x="1.8" y="7.4" width="9.4" height="5.2" rx="2.6" fill="none" stroke="#111" stroke-width="3" transform="rotate(-35 6.5 10)"/><rect x="1.8" y="7.4" width="9.4" height="5.2" rx="2.6" fill="none" stroke="#9ca3af" stroke-width="1.4" transform="rotate(-35 6.5 10)"/><rect x="8.8" y="7.4" width="9.4" height="5.2" rx="2.6" fill="none" stroke="#111" stroke-width="3" transform="rotate(-35 13.5 10)"/><rect x="8.8" y="7.4" width="9.4" height="5.2" rx="2.6" fill="none" stroke="#9ca3af" stroke-width="1.4" transform="rotate(-35 13.5 10)"/>`,
    bolt: `<path d="M11.4 1.6 3.6 11.4h5.2L7.6 18.4l8.8-10.6h-5.4z" fill="#facc15" ${O}/>`,
  };
  const medal = (col, n) => `<path d="M6 1.6h3l1.4 5.4H7.4zM14 1.6h-3l-1.4 5.4h3z" fill="#3b82f6" ${O}/><circle cx="10" cy="12" r="6" fill="${col}" ${O}/><text x="10" y="15" font-size="8" font-weight="700" text-anchor="middle" fill="#111" font-family="sans-serif">${n}</text>`;
  I.gold1 = medal('#f5c518', 1); I.gold2 = medal('#d1d5db', 2); I.gold3 = medal('#d97706', 3);
  // emoji → ikona
  const MAP = {
    '❤': 'heart', '💚': 'greenheart', '🪙': 'coin', '💎': 'gem', '🌊': 'wave', '💰': 'bag', '📜': 'scroll', '⚔': 'swords', '👻': 'ghost', '🔮': 'orb',
    '💨': 'wind', '🏆': 'trophy', '▶': 'play', '⏸': 'pause', '⏭': 'skip', '💥': 'boom', '🏰': 'castle', '👑': 'crown', '🫧': 'bubble', '🔦': 'torch',
    '🪨': 'rock', '🚫': 'no', '⚙': 'gear', '📖': 'book', '🌱': 'sprout', '🔵': 'dotblue', '🟢': 'dotgreen', '😡': 'angry', '✳': 'split', '🛡': 'shield',
    '⛏': 'pick', '🧲': 'magnet', '🧊': 'ice', '🐝': 'bee', '🪖': 'helmet', '📍': 'pin', '🕯': 'candle', '🏗': 'crane', '💪': 'muscle', '🏁': 'flag',
    '🗑': 'trash', '🎨': 'palette', '🧑': 'person', '✏': 'pencil', '❄': 'snow', '⚠': 'warn', '🎯': 'target', '👁': 'eye', '♾': 'infinity', '🖱': 'mouse',
    '⛵': 'boat', '🗼': 'tower', '🏦': 'bank', '✨': 'sparkle', '🔒': 'lock', '🎁': 'gift', '🤝': 'hands', '🔌': 'plug', '💡': 'bulb', '☠': 'skull',
    '🔄': 'cycle', '🥇': 'gold1', '🥈': 'gold2', '🥉': 'gold3', '🔗': 'link', '⚡': 'bolt',
  };
  /* ---------- další ikony pro celou aplikaci (učení, místnosti, hry) ---------- */
  const HEART = 'M10 17.2C4 13 2.2 10 2.2 7.2 2.2 4.8 4 3 6.2 3c1.6 0 2.9.9 3.8 2.3C10.9 3.9 12.2 3 13.8 3 16 3 17.8 4.8 17.8 7.2c0 2.8-1.8 5.8-7.8 10z';
  const DROP = 'M10 2.2C7 6.6 4.6 9.4 4.6 12.4a5.4 5.4 0 0 0 10.8 0c0-3-2.4-5.8-5.4-10.2z';
  const face = (col, inner) => `<circle cx="10" cy="10" r="7.6" fill="${col}" ${O}/>${hi(7.2, 6.6, 2, 1.2)}${inner}`;
  const eyes = (y = 9) => `<circle cx="7.4" cy="${y}" r="1.1" fill="#111"/><circle cx="12.6" cy="${y}" r="1.1" fill="#111"/>`;
  const bookC = col => `<rect x="4" y="2.6" width="12" height="14.8" rx="1.4" fill="${col}" ${O}/><path d="M6.4 2.6v14.8" stroke="#111" stroke-width="1.1"/><rect x="8.4" y="5.4" width="5.6" height="2.6" rx=".6" fill="#fff" opacity=".7"/>`;
  const fileC = (col, mark) => `<path d="M4.4 2h7.6l3.6 3.6V18H4.4z" fill="#f8fafc" ${O}/><path d="M12 2v3.6h3.6" fill="none" ${O}/><rect x="6.4" y="9.6" width="7.2" height="5.4" rx="1" fill="${col}" ${O}/>${mark || ''}`;
  const square = col => `<rect x="3" y="3" width="14" height="14" rx="2.4" fill="${col}" ${O}/>${hi(6.6, 6.4, 2.2, 1.2)}`;
  Object.assign(I, {
    party: `<path d="M2.6 17.4 6.4 6.6l7 7z" fill="#f59e0b" ${O}/><path d="M4.4 12.4l3.2 3.2M5.6 9l5.4 5.4" stroke="#ef4444" stroke-width="1.2"/><path d="M10.4 6.4c.8-1.6.4-3-.8-3.8M13.6 9.6c1.6-.8 3-.4 3.8.8" fill="none" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round"/><circle cx="14.6" cy="4" r="1.2" fill="#ec4899"/><circle cx="16.8" cy="7" r="1" fill="#22c55e"/><circle cx="12" cy="2.4" r="1" fill="#facc15"/>`,
    droplet: `<path d="${DROP}" fill="#38bdf8" ${O}/>${hi(8.2, 10.4, 1.4, 2)}`,
    droplets: `<path d="M7 3.4C5 6.4 3.4 8.2 3.4 10.2a3.6 3.6 0 0 0 7.2 0C10.6 8.2 9 6.4 7 3.4z" fill="#38bdf8" ${O}/><path d="M13.8 7.6c-1.6 2.4-3 3.8-3 5.4a3 3 0 0 0 6 0c0-1.6-1.4-3-3-5.4z" fill="#7dd3fc" ${O}/>`,
    blood: `<path d="${DROP}" fill="#dc2626" ${O}/>${hi(8.2, 10.4, 1.4, 2)}`,
    dagger: `<path d="M10 1.6 12 11H8z" fill="#e5e7eb" ${O}/><path d="M5.6 11h8.8" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M5.6 11h8.8" stroke="#a16207" stroke-width="1.4" stroke-linecap="round"/><path d="M10 12v5.4" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M10 12v5.4" stroke="#6b4320" stroke-width="1.4" stroke-linecap="round"/>`,
    hourglass: `<path d="M5 2.4h10M5 17.6h10" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M6 2.6c0 4 3 5.2 3 7.4S6 13.4 6 17.4h8c0-4-3-5.2-3-7.4s3-3.4 3-7.4z" fill="#e0f2fe" ${O}/><path d="M7.6 16.6c.6-2 2.4-2.2 2.4-3.4 0 1.2 1.8 1.4 2.4 3.4zM7.8 5.4h4.4c-.6 1.4-2.2 2.2-2.2 3.4 0-1.2-1.6-2-2.2-3.4z" fill="#f59e0b"/>`,
    people: `<circle cx="13.2" cy="6.4" r="2.8" fill="#f1c08f" ${O}/><path d="M8.6 16.6c0-3.2 2-5 4.6-5s4.6 1.8 4.6 5z" fill="#8b5cf6" ${O}/><circle cx="7" cy="7.2" r="3" fill="#f1c08f" ${O}/><path d="M2 17.6c0-3.4 2.2-5.4 5-5.4s5 2 5 5.4z" fill="#3b82f6" ${O}/>`,
    fire: `<path d="M10 18c-3.6 0-6-2.4-6-5.6 0-3.4 2.8-5 3.4-8.6 1.4 1.2 2 2.6 2 4 .8-1.2 1.2-3.4.8-5.6 3.6 2 5.8 5.4 5.8 9.6 0 3.6-2.4 6.2-6 6.2z" fill="#f97316" ${O}/><path d="M10 17c-1.8 0-3-1.2-3-2.8 0-1.8 1.6-2.6 2-4.6 1.6 1.2 4 2.8 4 4.8 0 1.6-1.2 2.6-3 2.6z" fill="#fde047"/>`,
    folder: `<path d="M2 5.4c0-.8.6-1.4 1.4-1.4h4.2l1.6 2h7.4c.8 0 1.4.6 1.4 1.4v8.2c0 .8-.6 1.4-1.4 1.4H3.4c-.8 0-1.4-.6-1.4-1.4z" fill="#f59e0b" ${O}/><path d="M2 8h16" stroke="#b45309" stroke-width="1"/>`,
    folderopen: `<path d="M2 5.4c0-.8.6-1.4 1.4-1.4h4.2l1.6 2H15c.8 0 1.4.6 1.4 1.4V8H2z" fill="#d97706" ${O}/><path d="M2 16.6 4 8h14.4l-2.2 8.6z" fill="#fbbf24" ${O}/>`,
    tomato: `<circle cx="10" cy="11.4" r="6.6" fill="#ef4444" ${O}/><path d="M10 5.2 8 3.2l1 2.6-3 .2 2.8 1.4L7.6 9l2.4-1.6L12.4 9l-1.2-1.6L14 6l-3-.2 1-2.6z" fill="#22c55e" ${O}/>${hi(7.2, 10, 1.6, 1)}`,
    robot: `<rect x="3.4" y="6" width="13.2" height="10.4" rx="2.4" fill="#cbd5e1" ${O}/><path d="M10 6V3" stroke="#111" stroke-width="1.4"/><circle cx="10" cy="2.6" r="1.4" fill="#ef4444" ${O}/><circle cx="7.4" cy="10.4" r="1.6" fill="#38bdf8" ${O}/><circle cx="12.6" cy="10.4" r="1.6" fill="#38bdf8" ${O}/><path d="M7 13.8h6" stroke="#111" stroke-width="1.2" stroke-linecap="round"/><path d="M3.4 10H2M16.6 10H18" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>`,
    brain: `<path d="M10 4.2C9 2.6 6.4 2.6 5.4 4.2 3.4 4 2.2 6 3 7.6c-1.6 1-1.4 3.6.2 4.4-.4 2 1.4 3.6 3.2 3 .8 1.6 2.8 1.8 3.6.4.8 1.4 2.8 1.2 3.6-.4 1.8.6 3.6-1 3.2-3 1.6-.8 1.8-3.4.2-4.4.8-1.6-.4-3.6-2.4-3.4-1-1.6-3.6-1.6-4.6 0z" fill="#f9a8d4" ${O}/><path d="M10 4.2v11.4M6.4 7.4c1 .4 1.6 1.2 1.6 2.4M13.6 7.4c-1 .4-1.6 1.2-1.6 2.4M6 12c1 0 1.8-.6 2.2-1.4M14 12c-1 0-1.8-.6-2.2-1.4" fill="none" stroke="#be185d" stroke-width="1"/>`,
    checkbox: `<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="3" fill="#22c55e" ${O}/><path d="M6 10.4l2.8 2.8L14.4 7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    cross: `<path d="M4.4 4.4l11.2 11.2M15.6 4.4 4.4 15.6" stroke="#111" stroke-width="5" stroke-linecap="round"/><path d="M4.4 4.4l11.2 11.2M15.6 4.4 4.4 15.6" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round"/>`,
    map: `<path d="M2 4.6 7 2.6l6 2 5-2v12.8l-5 2-6-2-5 2z" fill="#fef3c7" ${O}/><path d="M7 2.6v12.8M13 4.6v12.8" stroke="#111" stroke-width="1"/><path d="M3.4 11c1.6-1 2.6.6 4.6-.4s3 1 5 .2 2.4-1 3.6-.6" fill="none" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="1.6 1.4"/><path d="M14.6 6.4l1.6 1.6M16.2 6.4l-1.6 1.6" stroke="#ef4444" stroke-width="1.2"/>`,
    star: `<path d="M10 1.8l2.5 5.2 5.6.8-4.1 3.9 1 5.6L10 14.6l-5 2.7 1-5.6-4.1-3.9 5.6-.8z" fill="#facc15" ${O}/><path d="M10 1.8 7.5 7l-5.6.8L10 10z" fill="#fff" opacity=".35"/>`,
    glowstar: `<circle cx="10" cy="10" r="8.6" fill="#fde047" opacity=".3"/><path d="M10 2.6l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#facc15" ${O}/>`,
    card: `<rect x="3.4" y="2" width="11" height="15" rx="1.6" fill="#f8fafc" ${O} transform="rotate(-8 9 9.5)"/><rect x="6" y="3" width="11" height="15" rx="1.6" fill="#fff" ${O} transform="rotate(8 11.5 10.5)"/><path d="M11.6 7.4c-1 1.8-2.6 3-2.6 4.4a2.6 2.6 0 0 0 5.2 0c0-1.4-1.6-2.6-2.6-4.4z" fill="#ef4444" transform="rotate(8 11.5 10.5)"/>`,
    stopwatch: `<circle cx="10" cy="11.4" r="6.6" fill="#f8fafc" ${O}/><path d="M8 2.4h4M10 2.4v2.4M15.4 5.4l1.4-1.4" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M10 11.4V7.8" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="11.4" r="1" fill="#111"/>`,
    alarm: `<circle cx="10" cy="11" r="6.4" fill="#f8fafc" ${O}/><path d="M3 5.2 5.6 2.6M17 5.2l-2.6-2.6M6 17.4l-1 1.2M14 17.4l1 1.2" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><path d="M10 11V7.4M10 11l2.6 1.6" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>`,
    clock: `<circle cx="10" cy="10" r="7.6" fill="#f8fafc" ${O}/><path d="M10 10V4.8" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="10" r="1" fill="#111"/>`,
    picture: `<rect x="2.4" y="3.4" width="15.2" height="13.2" rx="1.6" fill="#bae6fd" ${O}/><path d="M2.4 14.4l4.4-4.8 3.4 3.4 2.4-2.4 5 4.4v1.6H2.4z" fill="#22c55e" ${O}/><circle cx="13.6" cy="7.2" r="1.6" fill="#facc15" ${O}/>`,
    bookblue: bookC('#3b82f6'), bookred: bookC('#ef4444'), bookgreen: bookC('#22c55e'), bookorange: bookC('#f97316'),
    books: `<rect x="2.4" y="4" width="4" height="13.6" rx=".8" fill="#ef4444" ${O}/><rect x="6.4" y="2.6" width="4" height="15" rx=".8" fill="#3b82f6" ${O}/><rect x="11.4" y="4.4" width="4" height="13.4" rx=".8" fill="#22c55e" ${O} transform="rotate(-12 13.4 11)"/><path d="M2.4 7h4M6.4 5.6h4" stroke="#fff" stroke-width="1"/>`,
    wrench: `<path d="M13.6 2.4a4 4 0 0 0-4.2 5.4L3 14.2a2 2 0 0 0 2.8 2.8l6.4-6.4a4 4 0 0 0 5.4-4.2l-2.6 2.6-2.4-.6-.6-2.4z" fill="#9ca3af" ${O}/><circle cx="4.6" cy="15.4" r=".9" fill="#111"/>`,
    puzzle: `<path d="M3 6h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H3v-4a2 2 0 1 0 0-4z" fill="#22c55e" ${O}/>${hi(6, 8.4, 1.6, 1)}`,
    clipboard: `<rect x="3.6" y="3.4" width="12.8" height="14.6" rx="1.6" fill="#d6a35c" ${O}/><rect x="5.4" y="5.4" width="9.2" height="10.8" rx=".8" fill="#fff" ${O}/><rect x="7" y="2" width="6" height="3.4" rx="1" fill="#9ca3af" ${O}/><path d="M7 9h6M7 11.6h6M7 14.2h4" stroke="#6b7280" stroke-width="1.1" stroke-linecap="round"/>`,
    speech: `<path d="M3.4 3h13.2c.8 0 1.4.6 1.4 1.4v8.2c0 .8-.6 1.4-1.4 1.4H9l-4.4 3.4V14H3.4c-.8 0-1.4-.6-1.4-1.4V4.4C2 3.6 2.6 3 3.4 3z" fill="#f8fafc" ${O}/><circle cx="6.6" cy="8.6" r="1.1" fill="#6b7280"/><circle cx="10" cy="8.6" r="1.1" fill="#6b7280"/><circle cx="13.4" cy="8.6" r="1.1" fill="#6b7280"/>`,
    house: `<path d="M2.4 9.4 10 2.8l7.6 6.6" fill="#ef4444" ${O}/><path d="M4.4 8.4v9h11.2v-9L10 3.6z" fill="#fde68a" ${O}/><path d="M2.4 9.4 10 2.8l7.6 6.6" fill="none" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/><rect x="8.4" y="12" width="3.2" height="5.4" fill="#92400e" ${O}/><rect x="12.2" y="10" width="2.4" height="2.4" fill="#bae6fd" ${O}/>`,
    houses: `<path d="M1.6 10.4 6 6.4l4.4 4v6.6H1.6z" fill="#fde68a" ${O}/><path d="M9 10.4 13.6 6l4.8 4.4v6.6H9z" fill="#fca5a5" ${O}/><rect x="4.6" y="13" width="2.4" height="4" fill="#92400e" ${O}/><rect x="12.6" y="13" width="2.4" height="4" fill="#92400e" ${O}/>`,
    floppy: `<path d="M3 3h11.4L17 5.6V17H3z" fill="#3b82f6" ${O}/><rect x="6" y="3" width="7" height="4.6" fill="#e5e7eb" ${O}/><rect x="5.4" y="10.4" width="9.2" height="6.6" fill="#f8fafc" ${O}/><rect x="10.4" y="3.8" width="1.6" height="3" fill="#111"/>`,
    paperclip: `<path d="M13.4 6.4 7.6 12.2a1.6 1.6 0 0 0 2.2 2.2l6-6a3.2 3.2 0 0 0-4.6-4.6L5 10a4.8 4.8 0 0 0 6.8 6.8l5-5" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M13.4 6.4 7.6 12.2a1.6 1.6 0 0 0 2.2 2.2l6-6a3.2 3.2 0 0 0-4.6-4.6L5 10a4.8 4.8 0 0 0 6.8 6.8l5-5" fill="none" stroke="#9ca3af" stroke-width="1.4" stroke-linecap="round"/>`,
    page: `<path d="M4.4 2h7.6l3.6 3.6V18H4.4z" fill="#f8fafc" ${O}/><path d="M12 2v3.6h3.6" fill="none" ${O}/><path d="M6.6 9h6.8M6.6 11.6h6.8M6.6 14.2h4.6" stroke="#9ca3af" stroke-width="1.1" stroke-linecap="round"/>`,
    memo: `<path d="M4.4 2h7.6l3.6 3.6V18H4.4z" fill="#f8fafc" ${O}/><path d="M6.6 8h6M6.6 10.6h4" stroke="#9ca3af" stroke-width="1.1" stroke-linecap="round"/><path d="M9 16.4l.6-2.6 6.4-6.4 2 2-6.4 6.4z" fill="#facc15" ${O}/>`,
    rocket: `<path d="M10 1.6c3 2 4.4 5.4 4 9.4l-1.6 2.4H7.6L6 11c-.4-4 1-7.4 4-9.4z" fill="#e5e7eb" ${O}/><circle cx="10" cy="7.6" r="1.8" fill="#38bdf8" ${O}/><path d="M6 11l-2.4 3.4 3.4-.4M14 11l2.4 3.4-3.4-.4" fill="#ef4444" ${O}/><path d="M8.4 13.4 10 18.4l1.6-5z" fill="#f97316" ${O}/>`,
    bell: `<path d="M10 2.6c-3 0-5 2.4-5 5.6v3.6L3.4 14.4h13.2L15 11.8V8.2c0-3.2-2-5.6-5-5.6z" fill="#facc15" ${O}/><path d="M8 16.2a2 2 0 0 0 4 0z" fill="#a16207" ${O}/>${hi(7.4, 6.6, 1.4, 1)}`,
    belloff: `<path d="M10 2.6c-3 0-5 2.4-5 5.6v3.6L3.4 14.4h13.2L15 11.8V8.2c0-3.2-2-5.6-5-5.6z" fill="#d1d5db" ${O}/><path d="M3 3l14 14" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M3 3l14 14" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>`,
    calendar: `<rect x="2.6" y="3.6" width="14.8" height="13.8" rx="1.6" fill="#f8fafc" ${O}/><path d="M2.6 4.8c0-.6.6-1.2 1.2-1.2h12.4c.6 0 1.2.6 1.2 1.2V8H2.6z" fill="#ef4444" ${O}/><path d="M6.4 2v3M13.6 2v3" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><text x="10" y="15.4" font-size="6.4" font-weight="700" text-anchor="middle" fill="#111" font-family="sans-serif">24</text>`,
    abcup: `${square('#3b82f6')}<text x="10" y="13.4" font-size="7.2" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">ABC</text>`,
    abc: `${square('#60a5fa')}<text x="10" y="13.2" font-size="7.4" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">abc</text>`,
    question: `<circle cx="10" cy="10" r="7.6" fill="#ef4444" ${O}/><text x="10" y="14.2" font-size="11" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">?</text>`,
    gamepad: `<path d="M5.6 5.6h8.8c2.4 0 3.8 2.6 4 6 .2 3-1.8 4.6-3.6 2.6L13 12.4H7l-1.8 1.8C3.4 16.2 1.4 14.6 1.6 11.6c.2-3.4 1.6-6 4-6z" fill="#6b7280" ${O}/><path d="M5.8 7.8v3M4.3 9.3h3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="13.4" cy="8.4" r="1" fill="#ef4444"/><circle cx="15" cy="10.2" r="1" fill="#22c55e"/>`,
    pushpin: `<path d="M12.4 2.4l5.2 5.2-1.6.8-2.6 3.6.4 3-1.2 1.2-3.2-3.2-4.6 4.6-1-1 4.6-4.6L5.2 8.8 6.4 7.6l3 .4 3.6-2.6z" fill="#ef4444" ${O}/>`,
    key: `<circle cx="6.4" cy="10" r="4" fill="#f5c518" ${O}/><circle cx="5.6" cy="10" r="1.3" fill="#fff" ${O}/><path d="M10.2 10h7.4M15.4 10v3M13 10v2.2" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M10.2 10h7.4M15.4 10v3M13 10v2.2" stroke="#f5c518" stroke-width="1.4" stroke-linecap="round"/>`,
    die: `<rect x="3" y="3" width="14" height="14" rx="3" fill="#f8fafc" ${O}/><circle cx="6.8" cy="6.8" r="1.3" fill="#111"/><circle cx="10" cy="10" r="1.3" fill="#ef4444"/><circle cx="13.2" cy="13.2" r="1.3" fill="#111"/><circle cx="13.2" cy="6.8" r="1.3" fill="#111"/><circle cx="6.8" cy="13.2" r="1.3" fill="#111"/>`,
    gradcap: `<path d="M10 3.4 18.4 7.6 10 11.8 1.6 7.6z" fill="#1f2937" ${O}/><path d="M5 9.4v4c1.6 1.6 8.4 1.6 10 0v-4L10 11.8z" fill="#374151" ${O}/><path d="M16.8 8.4v5" stroke="#facc15" stroke-width="1.4"/><circle cx="16.8" cy="13.8" r="1.1" fill="#facc15"/>`,
    speaker: `<path d="M2.6 7.4h3.4L10.4 3.6v12.8L6 12.6H2.6z" fill="#6b7280" ${O}/><path d="M13 7a4 4 0 0 1 0 6M15.2 4.8a7 7 0 0 1 0 10.4" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>`,
    coffee: `<path d="M3.4 7.4h10.8v5.4a4.4 4.4 0 0 1-4.4 4.4H7.8a4.4 4.4 0 0 1-4.4-4.4z" fill="#f8fafc" ${O}/><path d="M14.2 8.6h1.4a2 2 0 0 1 0 4h-1.6" fill="none" ${O}/><path d="M4.4 8.6h8.8" stroke="#92400e" stroke-width="1.8"/><path d="M7 5.6c-.6-1 .6-1.6 0-2.8M10.4 5.6c-.6-1 .6-1.6 0-2.8" fill="none" stroke="#9ca3af" stroke-width="1.2" stroke-linecap="round"/>`,
    compass: `<circle cx="10" cy="10" r="7.6" fill="#f8fafc" ${O}/><path d="M10 3.6 12 10h-4z" fill="#ef4444" ${O}/><path d="M10 16.4 8 10h4z" fill="#3b82f6" ${O}/><circle cx="10" cy="10" r="1" fill="#111"/>`,
    door: `<rect x="4.4" y="2" width="11.2" height="16" rx="1" fill="#92400e" ${O}/><rect x="6" y="3.6" width="8" height="5.6" rx=".6" fill="#b45309"/><rect x="6" y="10.6" width="8" height="5.6" rx=".6" fill="#b45309"/><circle cx="13.2" cy="10" r="1" fill="#facc15" ${O}/>`,
    plus: `<path d="M10 3.4v13.2M3.4 10h13.2" stroke="#111" stroke-width="5" stroke-linecap="round"/><path d="M10 3.4v13.2M3.4 10h13.2" stroke="#22c55e" stroke-width="2.8" stroke-linecap="round"/>`,
    phone: `<path d="M5.4 2.4l2.6 3.4-1.6 2c.8 2.2 2.6 4 4.8 4.8l2-1.6 3.4 2.6-1.6 3c-6.6 0-11.4-4.8-11.4-11.4z" fill="#22c55e" ${O}/>`,
    magnifier: `<circle cx="8.4" cy="8.4" r="5.4" fill="#bae6fd" fill-opacity=".6" ${O}/><path d="M12.4 12.4l5 5" stroke="#111" stroke-width="3.6" stroke-linecap="round"/><path d="M12.4 12.4l5 5" stroke="#a16207" stroke-width="2" stroke-linecap="round"/>${hi(6.6, 6.6, 1.6, 1)}`,
    cabinet: `<rect x="3.6" y="2.4" width="12.8" height="15.2" rx="1.2" fill="#9ca3af" ${O}/><path d="M3.6 7.4h12.8M3.6 12.4h12.8" stroke="#111" stroke-width="1.2"/><path d="M8.4 5h3.2M8.4 10h3.2M8.4 15h3.2" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>`,
    archive: fileC('#a855f7', `<path d="M10 9.6v5.4M9 10.6h2M9 12.4h2" stroke="#fff" stroke-width=".9"/>`),
    music: `<path d="M7.4 14.6V4.4l9-2v10" fill="none" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="5.4" cy="14.8" rx="2.6" ry="2" fill="#a855f7" ${O}/><ellipse cx="14.4" cy="12.6" rx="2.6" ry="2" fill="#a855f7" ${O}/>`,
    clapper: `<rect x="2.6" y="7.4" width="14.8" height="9.8" rx="1" fill="#374151" ${O}/><path d="M2.6 7.4 3.4 3.6l14 2.4-.6 1.4z" fill="#f8fafc" ${O}/><path d="M6 4.2 5.2 7M10 4.8 9.2 7.4M14 5.6l-.8 1.8" stroke="#111" stroke-width="1.6"/>`,
    bust: `<circle cx="10" cy="6.6" r="3.8" fill="#9ca3af" ${O}/><path d="M3 17.6c0-4.2 3-6.6 7-6.6s7 2.4 7 6.6z" fill="#9ca3af" ${O}/>`,
    whitecircle: `<circle cx="10" cy="10" r="6.6" fill="#f8fafc" ${O}/>`,
    globe: `<circle cx="10" cy="10" r="7.6" fill="#38bdf8" ${O}/><path d="M5 5.4c1.6.4 2.4 1.6 2 3-.4 1.6 1.4 2 1.2 3.6-.2 1.4-1.6 1.6-1.6 3.4M13 3.6c-.6 1.4.2 2.6 1.6 2.8 1.4.2 1.8 1.6 1 2.6M12.6 11.6c1.4-.4 2.8.6 2.4 2.4" fill="none" stroke="#16a34a" stroke-width="2.4" stroke-linecap="round"/>`,
    scales: `<path d="M10 3v13.4M5 16.6h10M4 5.4h12" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><path d="M4 5.4 1.8 10.6h4.4zM16 5.4l-2.2 5.2h4.4z" fill="none" ${O}/><path d="M1.8 10.6a2.2 2.2 0 0 0 4.4 0zM13.8 10.6a2.2 2.2 0 0 0 4.4 0z" fill="#f5c518" ${O}/>`,
    chart: `<rect x="2.6" y="2.6" width="14.8" height="14.8" rx="1.6" fill="#f8fafc" ${O}/><rect x="5" y="10.4" width="2.4" height="4.6" fill="#3b82f6" ${O}/><rect x="8.8" y="6.6" width="2.4" height="8.4" fill="#22c55e" ${O}/><rect x="12.6" y="8.6" width="2.4" height="6.4" fill="#ef4444" ${O}/>`,
    thumbsup: `<path d="M3 9h3.2v8.4H3z" fill="#3b82f6" ${O}/><path d="M6.2 9l3-5.4c1.4-.2 2.2.8 1.8 2.4L10.4 8.6H16c1 0 1.8 1 1.4 2L15.6 16c-.2.8-1 1.4-1.8 1.4H6.2z" fill="#f1c08f" ${O}/>`,
    telescope: `<path d="M2.6 9.8 13.6 4l1.6 3.4-11 5.8z" fill="#3b82f6" ${O}/><path d="M13.6 4l3-1.4 1.6 3.4-3 1.4z" fill="#9ca3af" ${O}/><path d="M8.6 10.6 6 17.4M8.6 10.6l3 6.8" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>`,
    pen: `<path d="M3 17l1.2-4.4L13 3.8a2 2 0 0 1 3.2 3.2L7.4 15.8z" fill="#3b82f6" ${O}/><path d="M3 17l1.2-4.4 3.2 3.2z" fill="#e5e7eb" ${O}/>`,
    moon: `<path d="M14.6 13.8A7 7 0 0 1 8.2 2.6a7.4 7.4 0 1 0 9 9 7 7 0 0 1-2.6 2.2z" fill="#fde047" ${O}/>`,
    newmoon: `<circle cx="10" cy="10" r="7.4" fill="#374151" ${O}/><circle cx="7.4" cy="8" r="1.4" fill="#4b5563"/><circle cx="12.4" cy="12" r="2" fill="#4b5563"/>`,
    sleepy: face('#fde047', `<path d="M6 9.4c.6.8 1.8.8 2.4 0M11.6 9.4c.6.8 1.8.8 2.4 0" fill="none" stroke="#111" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="10" cy="13.6" rx="1.4" ry="1.1" fill="#111"/><text x="15.6" y="5.4" font-size="5" font-weight="800" fill="#3b82f6" font-family="sans-serif">z</text>`),
    noface: face('#fde047', eyes()),
    anxious: face('#fde047', `${eyes()}<path d="M7.4 14.4c1.4-1 3.8-1 5.2 0" fill="none" stroke="#111" stroke-width="1.3" stroke-linecap="round"/><path d="M14.8 5.4c.8 1.2 1 2.4.4 3.2" fill="#38bdf8" stroke="#111" stroke-width=".9"/>`),
    huff: face('#fb923c', `<path d="M5.6 7.6l2.8 1M14.4 7.6l-2.8 1" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>${eyes(10)}<path d="M7.6 14h4.8" stroke="#111" stroke-width="1.4" stroke-linecap="round"/><path d="M3 15c.8-.6 1.6-.6 2.4 0M14.6 15c.8-.6 1.6-.6 2.4 0" fill="none" stroke="#e5e7eb" stroke-width="1.2"/>`),
    sick: face('#86efac', `${eyes()}<path d="M7 13.6c1-.8 2-.8 3 0s2 .8 3 0" fill="none" stroke="#111" stroke-width="1.3" stroke-linecap="round"/>`),
    lion: `<circle cx="10" cy="10" r="8.4" fill="#d97706" ${O}/><circle cx="10" cy="10.6" r="5.4" fill="#fbbf24" ${O}/>${eyes(9.6)}<path d="M8.8 12h2.4L10 13.4z" fill="#111"/>`,
    statue: `<path d="M7 18V9.4h6V18z" fill="#5eead4" ${O}/><circle cx="10" cy="6.6" r="2.8" fill="#5eead4" ${O}/><path d="M7.4 4.4 8 2.4l1 1.6.6-2 .8 2 1-1.6.6 2" fill="none" stroke="#111" stroke-width="1"/><path d="M13 9.4l2.4-6.4" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M13 9.4l2.4-6.4" stroke="#5eead4" stroke-width="1" stroke-linecap="round"/><path d="M15.4 3 14.6 1.4 16.6 2z" fill="#f97316" ${O}/>`,
    writing: `<path d="M3 17l1-3.6 8-8 2.6 2.6-8 8z" fill="#facc15" ${O}/><path d="M11 8.4c1.4-1.4 3.4-1 4.6.4l2 2.8c.4.8-.2 1.6-1 1.4l-3.4-1.4-2.4 2.4z" fill="#f1c08f" ${O}/>`,
    briefcase: `<rect x="2.4" y="6" width="15.2" height="11" rx="1.6" fill="#92400e" ${O}/><path d="M7.4 6V4.2c0-.6.4-1 1-1h3.2c.6 0 1 .4 1 1V6" fill="none" ${O}/><path d="M2.4 10.6h15.2" stroke="#111" stroke-width="1.2"/><rect x="8.6" y="9.4" width="2.8" height="2.4" fill="#facc15" ${O}/>`,
    moneywings: `<rect x="5.6" y="6.4" width="8.8" height="6" rx=".8" fill="#86efac" ${O}/><circle cx="10" cy="9.4" r="1.6" fill="#16a34a"/><path d="M5.6 8C3.4 6 1.8 6.4 1.4 8.4c1 .2 2 .8 2.4 1.8M14.4 8c2.2-2 3.8-1.6 4.2.4-1 .2-2 .8-2.4 1.8" fill="#f8fafc" ${O}/>`,
    pointing: `<path d="M2.6 8.6h9.4a1.4 1.4 0 0 1 0 2.8H9.6" fill="#f1c08f" ${O}/><path d="M6 6.4l3.4-1c1-.2 1.6.8 1 1.6L9.6 8.6M5 8v7.4h6.4c1 0 1.6-.6 1.6-1.4 0-.6-.4-1-1-1.2.8-.2 1.2-.8 1-1.6-.2-.6-.8-.8-1.4-.8" fill="#f1c08f" ${O}/>`,
    inbox: `<path d="M2.4 11.4 4.4 4h11.2l2 7.4V17H2.4z" fill="#e5e7eb" ${O}/><path d="M2.4 11.4h4.2l1 2h4.8l1-2h4.2" fill="none" ${O}/><path d="M10 4.6v5.4M7.8 7.8 10 10l2.2-2.2" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    blackheart: `<path d="${HEART}" fill="#27272a" ${O}/>${hi(6.2, 6.4, 1.8, 1.1)}`,
    pinkheart: `<path d="${HEART}" fill="#f472b6" ${O}/>${hi(6.2, 6.4, 1.8, 1.1)}<path d="M15.6 2.4l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff"/>`,
    ninja: `<circle cx="10" cy="10" r="7.4" fill="#27272a" ${O}/><rect x="4.4" y="7.8" width="11.2" height="3.6" rx="1.6" fill="#f1c08f" ${O}/><circle cx="7.6" cy="9.6" r=".9" fill="#111"/><circle cx="12.4" cy="9.6" r=".9" fill="#111"/><path d="M17 6.4l2 -1.6M17 7.6l2.4.4" stroke="#dc2626" stroke-width="1.6" stroke-linecap="round"/>`,
    feather: `<path d="M16.6 2.4C10 3 5 8 4.4 15.6L3.4 17.6M16.6 2.4c-.4 6.4-4.6 11-11 12" fill="#e5e7eb" ${O}/><path d="M4.6 15.4 13 7" stroke="#9ca3af" stroke-width="1"/>`,
    ring: `<circle cx="10" cy="10" r="6.6" fill="none" stroke="#111" stroke-width="4.4"/><circle cx="10" cy="10" r="6.6" fill="none" stroke="#ef4444" stroke-width="2.6"/>`,
    eagle: `<path d="M1.6 7.4c3 .4 5.4 1.6 7 3.6l1.4-3 1.4 3c1.6-2 4-3.2 7-3.6-2 2.6-4.2 4.4-6.8 5.4L10 16.4l-1.6-3.6C5.8 11.8 3.6 10 1.6 7.4z" fill="#92400e" ${O}/><circle cx="10" cy="6.6" r="2.2" fill="#f8fafc" ${O}/><path d="M11.8 6.8l1.4.4-1.4.6z" fill="#f59e0b" ${O}/>`,
    // zombie hra, zahrádka, dobyvatel
    gun: `<path d="M2.4 6.6h13.2v3.6H8.4l-1 6H3.6l1-6H2.4z" fill="#4b5563" ${O}/><path d="M15.6 7.4h2.2" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><path d="M8.4 10.2c.2 1.4 1.2 2 2.4 2" fill="none" ${O}/>`,
    bricks: `<rect x="2" y="3.4" width="16" height="13.2" fill="#dc6b4c" ${O}/><path d="M2 7.8h16M2 12.2h16M7 3.4v4.4M13 3.4v4.4M4.6 7.8v4.4M10 7.8v4.4M15.4 7.8v4.4M7 12.2v4.4M13 12.2v4.4" stroke="#f5deb3" stroke-width="1.2"/>`,
    log: `<rect x="2.6" y="6" width="13.4" height="8" rx="1" fill="#92400e" ${O}/><ellipse cx="16" cy="10" rx="2.4" ry="4" fill="#d6a35c" ${O}/><ellipse cx="16" cy="10" rx="1.2" ry="2" fill="none" stroke="#92400e" stroke-width=".9"/><path d="M4.4 8.4h6M6 11.6h7" stroke="#6b4320" stroke-width="1" stroke-linecap="round"/>`,
    brownsq: square('#92400e'), blacksq: square('#27272a'),
    meat: `<path d="M8.4 11.6C5 12.4 2.6 10 3.4 7S7.6 2.6 10.4 3.6c3 1 3.8 4.4 2.2 6.6z" fill="#dc2626" ${O}/><path d="M12 9.4l3.4 3.4" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M12 9.4l3.4 3.4" stroke="#f5f5f4" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.2" cy="12.6" r="1.6" fill="#f5f5f4" ${O}/><circle cx="15.2" cy="14.4" r="1.6" fill="#f5f5f4" ${O}/>${hi(6.4, 6.4, 1.6, 1)}`,
    steak: `<path d="M3 9c0-3.6 3.4-6 7.4-5.6 4.4.4 7.2 3.2 6.6 6.6-.6 3.4-3.6 5.6-7.6 5.2C5.4 14.8 3 12.4 3 9z" fill="#b91c1c" ${O}/><path d="M6.4 8.4c1-2 3.6-2.8 5.4-1.6" fill="none" stroke="#fecaca" stroke-width="1.6" stroke-linecap="round"/><circle cx="12.4" cy="10.4" r="1.8" fill="#fecaca" ${O}/>`,
    zombie: face('#86a86b', `<circle cx="7.4" cy="9" r="1.6" fill="#fef9c3" ${O}/><circle cx="12.6" cy="9" r="1.1" fill="#111"/><path d="M6.6 13.6h6.8" stroke="#111" stroke-width="1.4"/><path d="M8 13.6v1.2M10 13.6v1.2M12 13.6v1.2" stroke="#111" stroke-width="1"/><path d="M5 4.4l1.4 1.6" stroke="#4d6b3c" stroke-width="1.2"/>`),
    wheat: `<path d="M10 18V6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M10 18V6" stroke="#ca8a04" stroke-width="1.2" stroke-linecap="round"/>${[4, 7, 10, 13].map(y => `<ellipse cx="7.8" cy="${y}" rx="1.4" ry="2.4" fill="#facc15" ${O} transform="rotate(-30 7.8 ${y})"/><ellipse cx="12.2" cy="${y}" rx="1.4" ry="2.4" fill="#facc15" ${O} transform="rotate(30 12.2 ${y})"/>`).join('')}`,
    plane: `<path d="M18 3.4 2 9.4l5.4 2.2L18 3.4zM18 3.4l-6.4 13.2-2.2-5.4z" fill="#e5e7eb" ${O}/><path d="M7.4 11.6v4.4l2.4-3" fill="#9ca3af" ${O}/>`,
    package: `<path d="M10 2.4 17.4 6v8L10 17.6 2.6 14V6z" fill="#d6a35c" ${O}/><path d="M2.6 6 10 9.6 17.4 6M10 9.6v8" fill="none" ${O}/><path d="M6.2 4.2l7.4 3.6v2.6" fill="none" stroke="#92400e" stroke-width="1.4"/>`,
    bucket: `<path d="M3.4 6h13.2l-1.6 11.4H5z" fill="#9ca3af" ${O}/><ellipse cx="10" cy="6" rx="6.6" ry="1.8" fill="#38bdf8" ${O}/><path d="M3.4 6C3.4 2 16.6 2 16.6 6" fill="none" stroke="#111" stroke-width="1.2"/>`,
    shower: `<path d="M4 18V5.4a3 3 0 0 1 6 0" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M6.6 6.4h6.8L10 3.6z" fill="#9ca3af" ${O}/>${[7.6, 10, 12.4].map(x => `<path d="M${x} 9v2M${x - 1} 13v2M${x + 1} 13v2" stroke="#38bdf8" stroke-width="1.4" stroke-linecap="round"/>`).join('')}`,
    tree: `<path d="M8.4 12.4h3.2v5.6H8.4z" fill="#92400e" ${O}/><circle cx="10" cy="8" r="6" fill="#22c55e" ${O}/><circle cx="7" cy="9.6" r="2.4" fill="#16a34a"/><circle cx="12.6" cy="6.6" r="2" fill="#4ade80"/>`,
    bomb: `<circle cx="9" cy="11.4" r="6.4" fill="#27272a" ${O}/><path d="M12.4 6 15 3.4" stroke="#111" stroke-width="2.6"/><path d="M15.4 3l1.6-1.4M16 4.4l2 .2M14.4 1.6l-.2-1" stroke="#f97316" stroke-width="1.4" stroke-linecap="round"/>${hi(6.6, 9, 1.8, 1.1)}`,
    megaphone: `<path d="M2.6 8h3.4l9.4-4.6v13.2L6 12H2.6z" fill="#ef4444" ${O}/><path d="M6 12l1.4 5.4h2.4L8.6 12.8" fill="#9ca3af" ${O}/><path d="M17 8.4v3.2" stroke="#111" stroke-width="2" stroke-linecap="round"/>`,
    redflag: `<path d="M4.4 18V2.4" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M5 3h11l-2.4 3.6L16 10.2H5z" fill="#ef4444" ${O}/>`,
    cyclone: `<path d="M10 10c0-1.4 1.6-2 2.6-1.2 1.8 1.4.8 4.4-1.6 4.8-3.4.6-5.6-2.8-4.2-6C8.6 3.8 13.6 3.4 16 6.4M10 10c-1.4 0-2-1.6-1.2-2.6" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M10 10c0-1.4 1.6-2 2.6-1.2 1.8 1.4.8 4.4-1.6 4.8-3.4.6-5.6-2.8-4.2-6C8.6 3.8 13.6 3.4 16 6.4" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/>`,
    trap: `<rect x="2.4" y="12.4" width="15.2" height="4.4" rx="1" fill="#92400e" ${O}/><path d="M4 12.4c0-5 2.6-8 6-8s6 3 6 8" fill="none" stroke="#111" stroke-width="3"/><path d="M4 12.4c0-5 2.6-8 6-8s6 3 6 8" fill="none" stroke="#9ca3af" stroke-width="1.4"/><circle cx="10" cy="14.6" r="1.4" fill="#facc15" ${O}/>`,
    dynamite: `<rect x="3" y="7" width="4" height="10.4" rx="1" fill="#dc2626" ${O}/><rect x="8" y="7" width="4" height="10.4" rx="1" fill="#dc2626" ${O}/><rect x="13" y="7" width="4" height="10.4" rx="1" fill="#dc2626" ${O}/><path d="M2.6 11.6h14.8" stroke="#111" stroke-width="1.8"/><path d="M10 7c0-2 1.4-3.2 3-3.6" fill="none" stroke="#111" stroke-width="1.2"/><circle cx="13.6" cy="3.2" r="1.4" fill="#f97316"/>`,
    syringe: `<path d="M14.4 2.6l3 3M12.6 4.4l3 3" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M13.8 6.2 6 14l-2-2 7.8-7.8z" fill="#bae6fd" ${O}/><path d="M7.2 12.8l-1.4-1.4L9 8.2l1.4 1.4z" fill="#ef4444"/><path d="M4.4 13.6 2 18" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>`,
    moai: `<path d="M6 18V7.4C6 4 7.6 2 10.4 2S14.6 4 14.6 7.4V18z" fill="#9ca3af" ${O}/><path d="M6.6 6.4h7.4" stroke="#111" stroke-width="1.6"/><path d="M11.6 6.6v5.4l-1.6 1" fill="none" stroke="#111" stroke-width="1.2"/><path d="M8 15h5" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>`,
    paws: `${[[6, 6], [14, 6], [4, 10.6], [16, 10.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.8" ry="2.2" fill="#92400e" ${O}/>`).join('')}<path d="M10 9.6c-2.6 0-4.6 2.6-4.6 4.8 0 1.6 1.4 2.4 2.6 2l2-.6 2 .6c1.2.4 2.6-.4 2.6-2 0-2.2-2-4.8-4.6-4.8z" fill="#92400e" ${O}/>`,
    comet: `<path d="M3 3c3.6 1.4 7.4 3.6 10 6.4L10.6 12C7.8 9.4 5 6.4 3 3z" fill="#fb923c" opacity=".7"/><circle cx="13.4" cy="13.4" r="4.4" fill="#78716c" ${O}/><path d="M9.6 10.6c1.4-.8 3-1 4.2-.4" fill="none" stroke="#fde047" stroke-width="1.4" stroke-linecap="round"/>`,
    fog: `<path d="M2.4 6.4h10M5 10h12.6M2.4 13.6h9M7 17h9" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M2.4 6.4h10M5 10h12.6M2.4 13.6h9M7 17h9" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round"/>`,
    slot: `<rect x="2.4" y="4" width="13.2" height="13.4" rx="1.6" fill="#ef4444" ${O}/><rect x="4" y="7" width="10" height="5.4" rx=".8" fill="#f8fafc" ${O}/><text x="9" y="11.4" font-size="5" font-weight="800" text-anchor="middle" fill="#111" font-family="sans-serif">777</text><path d="M15.6 6.4l1.8-1v6" fill="none" stroke="#111" stroke-width="1.4"/><circle cx="17.4" cy="4.6" r="1.4" fill="#facc15" ${O}/>`,
    mailbox: `<path d="M3 7.4a4 4 0 0 1 8 0v8H3z" fill="#3b82f6" ${O}/><path d="M7 3.4h7.4a3.6 3.6 0 0 1 3.6 3.6v8.4H11V7.4a4 4 0 0 0-4-4z" fill="#60a5fa" ${O}/><path d="M7 15.4V18" stroke="#111" stroke-width="2"/><path d="M14 7V3.4l3 1" fill="#ef4444" ${O}/>`,
    testtube: `<path d="M8 2.4v11.4a2.6 2.6 0 0 0 5.2 0V2.4" fill="#f8fafc" ${O}/><path d="M8 9.4h5.2v4.4a2.6 2.6 0 0 1-5.2 0z" fill="#a3e635" ${O}/><path d="M6.6 2.4h8" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>`,
    alembic: `<circle cx="7.6" cy="12.4" r="5" fill="#a855f7" ${O}/><path d="M9.4 8.2 15.6 3.4l1 1.4-6 5.6" fill="#f8fafc" ${O}/><path d="M16.6 5.4v3" stroke="#111" stroke-width="1.4"/>${hi(5.8, 10.6, 1.6, 1)}`,
    radioactive: `<circle cx="10" cy="10" r="7.6" fill="#facc15" ${O}/><path d="M10 10 7 4.8a6 6 0 0 1 6 0zM10 10l6 0a6 6 0 0 1-3 5.2zM10 10l-3 5.2A6 6 0 0 1 4 10z" fill="#111"/><circle cx="10" cy="10" r="1.6" fill="#facc15" stroke="#111"/>`,
    rainbow: `<path d="M1.6 15.6a8.4 8.4 0 0 1 16.8 0" fill="none" stroke="#ef4444" stroke-width="2"/><path d="M3.6 15.6a6.4 6.4 0 0 1 12.8 0" fill="none" stroke="#facc15" stroke-width="2"/><path d="M5.6 15.6a4.4 4.4 0 0 1 8.8 0" fill="none" stroke="#22c55e" stroke-width="2"/><path d="M7.6 15.6a2.4 2.4 0 0 1 4.8 0" fill="none" stroke="#3b82f6" stroke-width="2"/>`,
    wilted: `<path d="M10 18c0-4-.4-7 1.6-9.4" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M10 18c0-4-.4-7 1.6-9.4" fill="none" stroke="#65a30d" stroke-width="1" stroke-linecap="round"/><path d="M11.6 8.6c-3-.4-5-2.4-4.6-4.8 2.4-.6 4.6 1 5 3.4 1.2-1.6 3.2-1.8 4.6-.6-.8 1.8-2.8 2.6-5 2z" fill="#9f1239" ${O}/>`,
    walking: `<circle cx="11" cy="3.6" r="2" fill="#f1c08f" ${O}/><path d="M10.6 6.4 8.6 11l2.4 2.4-1 4.6M8.6 11l-2.6 6.4M10.4 7.4l3.4 2.4M10 8 6.6 9.6" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    running: `<circle cx="13" cy="3.4" r="2" fill="#f1c08f" ${O}/><path d="M11.8 6 8.6 10.4l3.4 1.6-1.2 5.6M8.6 10.4 4.4 13.6M11.8 6l3.6 3.4 2.2-.6M11 7 6.6 7.4 5 9.4" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    broom: `<path d="M15.8 2.4 9.4 10.6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M15.8 2.4 9.4 10.6" stroke="#a16207" stroke-width="1.2" stroke-linecap="round"/><path d="M8.6 9.6l3 2.4-2.4 5.6c-2.4 0-5-2-6.2-4.4z" fill="#facc15" ${O}/>`,
    herb: `<path d="M10 18V7" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M10 18V7" stroke="#16a34a" stroke-width="1" stroke-linecap="round"/><path d="M10 9C7 9 4.6 7 4.4 3.6 7.6 3.8 9.8 5.8 10 9zM10 12.6c2.8.2 5.4-1.6 5.8-5-3.2 0-5.6 2-5.8 5zM10 15c-2.4 0-4.6-1.2-5.2-4 2.8-.2 4.8 1.4 5.2 4z" fill="#4ade80" ${O}/>`,
    hammer: `<path d="M3.4 4.4 8.6 2.6l3 3-1.6 1.6-1.4-.6-1.4 1.4-1.6-1.6-1.4.4z" fill="#6b7280" ${O}/><path d="M8.6 7.4l8.4 8.4" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M8.6 7.4l8.4 8.4" stroke="#a16207" stroke-width="1.8" stroke-linecap="round"/>`,
    ogre: face('#dc2626', `<path d="M5 4.4 3.4 1.6l3.4 1.6M15 4.4l1.6-2.8-3.4 1.6" fill="#f8fafc" ${O}/><path d="M5.6 8l2.6 1M14.4 8l-2.6 1" stroke="#111" stroke-width="1.4" stroke-linecap="round"/>${eyes(10)}<path d="M6.6 13.4h6.8l-1 2.2H7.6z" fill="#111"/><path d="M7.6 13.4v1.2M12.4 13.4v1.2" stroke="#f8fafc" stroke-width="1.2"/>`),
    wolf: `<path d="M3 3.4l3 4h8l3-4 .4 7.4L10 17.6 2.6 10.8z" fill="#6b7280" ${O}/><path d="M7.4 13.4 10 17.6l2.6-4.2z" fill="#d1d5db" ${O}/>${eyes(9.4)}<path d="M9 13h2l-1 1.2z" fill="#111"/>`,
    anger: `<path d="M3 7.6C5 7.6 7.6 5 7.6 3M12.4 3c0 2 2.6 4.6 4.6 4.6M17 12.4c-2 0-4.6 2.6-4.6 4.6M7.6 17C7.6 15 5 12.4 3 12.4" fill="none" stroke="#111" stroke-width="3.6" stroke-linecap="round"/><path d="M3 7.6C5 7.6 7.6 5 7.6 3M12.4 3c0 2 2.6 4.6 4.6 4.6M17 12.4c-2 0-4.6 2.6-4.6 4.6M7.6 17C7.6 15 5 12.4 3 12.4" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>`,
    snake: `<path d="M4 17c-2-3 1-5.4 4-4.4s6 .4 5-2.4-6-2-6-4.8 4-3.6 7-2.4" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/><path d="M4 17c-2-3 1-5.4 4-4.4s6 .4 5-2.4-6-2-6-4.8 4-3.6 7-2.4" fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linecap="round"/><circle cx="14.6" cy="2.6" r="1.8" fill="#22c55e" ${O}/><path d="M16.2 3l1.6.4" stroke="#ef4444" stroke-width="1"/>`,
    cart: `<path d="M1.6 3.4h2.6l2 9.4h9.4l1.8-6.6H5" fill="#f8fafc" ${O}/><circle cx="7.6" cy="16" r="1.6" fill="#374151" ${O}/><circle cx="14.4" cy="16" r="1.6" fill="#374151" ${O}/>`,
    dizzy: `<path d="M3.4 12C2.6 7 7 3.4 11 4.4s5 6 1.6 7.6c-2.6 1.2-4.6-1.4-3-3.2" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M3.4 12C2.6 7 7 3.4 11 4.4s5 6 1.6 7.6c-2.6 1.2-4.6-1.4-3-3.2" fill="none" stroke="#facc15" stroke-width="1.4" stroke-linecap="round"/><path d="M15.4 13.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#facc15" ${O}/>`,
    store: `<path d="M2.6 8.4V17h14.8V8.4" fill="#f8fafc" ${O}/><path d="M1.6 8.4 3.4 3h13.2l1.8 5.4z" fill="#ef4444" ${O}/><path d="M5.6 3v5.4M10 3v5.4M14.4 3v5.4" stroke="#f8fafc" stroke-width="1.4"/><rect x="8" y="11.4" width="4" height="5.6" fill="#92400e" ${O}/>`,
    tap: `<path d="M2.4 6.4h8.4v3.2H2.4z" fill="#9ca3af" ${O}/><path d="M10.8 7.4h3.4a2 2 0 0 1 2 2v2h-3.2v-.8h-2.2" fill="#9ca3af" ${O}/><path d="M6.6 6.4V3.4M4.4 3.4h4.4" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><path d="M14.6 13.4c-1 1.6-1.6 2.4-1.6 3.2a1.6 1.6 0 0 0 3.2 0c0-.8-.6-1.6-1.6-3.2z" fill="#38bdf8" ${O}/>`,
    factory: `<path d="M2 17.4V9l4.4-3v3l4.4-3v3l4.4-3V3h2.4v14.4z" fill="#9ca3af" ${O}/><rect x="4.4" y="12" width="2.4" height="2.4" fill="#facc15" ${O}/><rect x="9" y="12" width="2.4" height="2.4" fill="#facc15" ${O}/><rect x="13.4" y="12" width="2.4" height="2.4" fill="#facc15" ${O}/>`,
    church: `<path d="M5 17.6V9.4L10 6l5 3.4v8.2z" fill="#f8fafc" ${O}/><path d="M10 6V1.6M8.4 3h3.2" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M8.6 17.6v-4a1.4 1.4 0 0 1 2.8 0v4z" fill="#92400e" ${O}/><path d="M2.4 17.6h15.2" ${O}/>`,
    mage: `<path d="M4.4 9.4 10 1.6l5.6 7.8z" fill="#7c3aed" ${O}/><path d="M3 9.4h14" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M3 9.4h14" stroke="#7c3aed" stroke-width="1.2" stroke-linecap="round"/><circle cx="10" cy="12" r="3" fill="#f1c08f" ${O}/><path d="M7 13.6c0 3.4 1.4 4.4 3 4.4s3-1 3-4.4c-1 .8-5 .8-6 0z" fill="#e5e7eb" ${O}/><path d="M11 5l.4.8.8.4-.8.4-.4.8-.4-.8-.8-.4.8-.4z" fill="#fde047"/>`,
    wand: `<path d="M3 17 12.6 7.4" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M3 17 12.6 7.4" stroke="#374151" stroke-width="1.8" stroke-linecap="round"/><path d="M10.6 9.4l2 2" stroke="#f8fafc" stroke-width="1.8"/><path d="M14.6 2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#fde047" ${O}/>`,
    bat: `<path d="M3.4 16.6l1.4 1.4 9.8-9.8c1.8-1.8 2.2-4.4.8-5.8s-4-1-5.8.8L3.6 9.4" fill="#d6a35c" ${O}/><path d="M2.6 15.8l1.6 1.6" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><circle cx="15.6" cy="15.6" r="2" fill="#f8fafc" ${O}/>`,
    dog: `<path d="M5 6.4C3 5 2 7.4 2.4 10l2.8.6zM15 6.4c2-1.4 3 1 2.6 3.6l-2.8.6z" fill="#92400e" ${O}/><circle cx="10" cy="10.4" r="6" fill="#d6a35c" ${O}/>${eyes(9.4)}<ellipse cx="10" cy="12.6" rx="1.6" ry="1.2" fill="#111"/>`,
    gorilla: face('#4b5563', `<ellipse cx="10" cy="11.6" rx="4.4" ry="3.6" fill="#9ca3af" ${O}/>${eyes(8.4)}<path d="M8.6 11.4h.8M10.6 11.4h.8M8 13.6h4" stroke="#111" stroke-width="1.1" stroke-linecap="round"/>`),
    carrot: `<path d="M13.6 6.4 3 17c-.4.4-.8 0-.6-.4L8.4 6.2c1.6-2 4-2 5.2.2z" fill="#f97316" ${O}/><path d="M13 5.8c-.4-2 .4-3.4 2-4 0 1.6.4 2.4 1.6 2.4-1 1.6-2.2 2-3.6 1.6zM14 7c1.6-.6 3-.2 3.8 1-1.4.6-2.6.4-3.8-1z" fill="#22c55e" ${O}/><path d="M7.4 9.6l1.6 1M5.6 12.8l1.4.8" stroke="#c2410c" stroke-width="1"/>`,
    pumpkin: `<ellipse cx="10" cy="11.6" rx="7.6" ry="6" fill="#f97316" ${O}/><path d="M10 5.6c-2 2-2 10 0 12M10 5.6c2 2 2 10 0 12M5.6 6.6c-2.4 2.6-2.4 8.4 0 10M14.4 6.6c2.4 2.6 2.4 8.4 0 10" fill="none" stroke="#c2410c" stroke-width="1"/><path d="M10 5.6V3l2-.6" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>`,
    melon: `<circle cx="10" cy="10.4" r="7.2" fill="#a3e635" ${O}/><path d="M6 4.4c-1.6 3.4-1.6 8.6 0 12M10 3.2v14.4M14 4.4c1.6 3.4 1.6 8.6 0 12" fill="none" stroke="#4d7c0f" stroke-width="1"/>${hi(7, 7, 2, 1.2)}`,
    sandwich: `<path d="M2 12.4 10 4l8 8.4z" fill="#fde68a" ${O}/><path d="M2.4 12.4h15.2l-1 1.6H3.4z" fill="#22c55e" ${O}/><path d="M3.4 14h13.2l-1 1.8H4.4z" fill="#ef4444" ${O}/><path d="M4.4 15.8h11.2l-.8 1.6H5.2z" fill="#d6a35c" ${O}/>`,
    lotion: `<rect x="5.4" y="7" width="9.2" height="11" rx="2" fill="#f9a8d4" ${O}/><rect x="7.6" y="3.4" width="4.8" height="3.6" fill="#f8fafc" ${O}/><path d="M12.4 4.4h3" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><rect x="7" y="10.4" width="6" height="3.6" rx=".8" fill="#fff" opacity=".8"/>`,
    pill: `<rect x="2.6" y="7" width="14.8" height="6" rx="3" fill="#f8fafc" ${O} transform="rotate(-35 10 10)"/><path d="M10 10 6.6 15a3 3 0 0 1-4-4.2L6.6 5.2z" fill="#ef4444" transform="rotate(0)"/><rect x="2.6" y="7" width="14.8" height="6" rx="3" fill="none" ${O} transform="rotate(-35 10 10)"/>`,
    tornado: `<path d="M2.4 3.4h15.2M4 6.4h12M6 9.4h8.8M7.6 12.4h5.6M9 15.4h3M10 18v-.4" stroke="#111" stroke-width="3" stroke-linecap="round"/><path d="M2.4 3.4h15.2M4 6.4h12M6 9.4h8.8M7.6 12.4h5.6M9 15.4h3" stroke="#cbd5e1" stroke-width="1.4" stroke-linecap="round"/>`,
    thermometer: `<path d="M8 3.4a2 2 0 0 1 4 0v8.4a4 4 0 1 1-4 0z" fill="#f8fafc" ${O}/><path d="M10 6v7.4" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="15" r="2.4" fill="#ef4444"/>`,
    volcano: `<path d="M1.6 17.6 7 7.4h6l5.4 10.2z" fill="#78716c" ${O}/><path d="M7 7.4h6l-1.4 3.4-1.6-1.4-1.6 1.4z" fill="#f97316" ${O}/><path d="M8.4 5c-.4-1.6.6-2.6 1.6-3 1 .4 2 1.4 1.6 3" fill="none" stroke="#9ca3af" stroke-width="1.4" stroke-linecap="round"/>`,
    cactus: `<path d="M8 18V4a2 2 0 0 1 4 0v14z" fill="#22c55e" ${O}/><path d="M8 11H5.4a1.6 1.6 0 0 1-1.6-1.6V7M12 9.4h2.6a1.6 1.6 0 0 0 1.6-1.6V5.6" fill="none" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M8 11H5.4a1.6 1.6 0 0 1-1.6-1.6V7M12 9.4h2.6a1.6 1.6 0 0 0 1.6-1.6V5.6" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round"/><path d="M4.4 18h11.2" stroke="#111" stroke-width="1.6"/>`,
    dancer: `<circle cx="10.4" cy="3.4" r="2" fill="#f1c08f" ${O}/><path d="M10 5.6 8 11.4h6.4z" fill="#ef4444" ${O}/><path d="M4 11.4l12.4 0-2 6c-1.6.4-6.8.4-8.4 0z" fill="#ef4444" ${O}/><path d="M10 6.4 5 4.4M10.6 6.4l4 2.6" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>`,
    downbtn: `${square('#3b82f6')}<path d="M6 8l4 4.4L14 8z" fill="#fff"/>`,
    nutbolt: `<path d="M5 2.4h4v10H5z" fill="#9ca3af" ${O}/><path d="M5 5h4M5 7.4h4M5 9.8h4" stroke="#6b7280" stroke-width="1"/><path d="M13 10.6l3.2 1.8v3.6L13 17.8 9.8 16v-3.6z" fill="#9ca3af" ${O}/><circle cx="13" cy="14.2" r="1.4" fill="#f8fafc" ${O}/>`,
    pray: `<path d="M9.6 3c-1 1.4-2.6 5-2.6 8.4l-2.4 3 2 1.6 3-2.6zM10.4 3c1 1.4 2.6 5 2.6 8.4l2.4 3-2 1.6-3-2.6z" fill="#f1c08f" ${O}/>`,
    dove: `<path d="M2 10.6c3.4-.4 5 1.4 7 1.4 2.4 0 4-2.2 5.4-4.2l3 .6-2 1.4c-.6 4.4-3.6 7-8 7-2.6 0-4.6-1.6-5.4-6.2z" fill="#f8fafc" ${O}/><path d="M9 11c-1-3.4 0-6.6 2.6-8.4 1 2.8.6 5.6-1 8" fill="#e5e7eb" ${O}/><circle cx="15" cy="8.6" r=".7" fill="#111"/>`,
    repeat: `<path d="M3.6 9.4V8a3 3 0 0 1 3-3h9M16.4 10.6V12a3 3 0 0 1-3 3h-9" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/><path d="M3.6 9.4V8a3 3 0 0 1 3-3h9M16.4 10.6V12a3 3 0 0 1-3 3h-9" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/><path d="M14 2.6l3 2.4-3 2.4zM6 12.6 3 15l3 2.4z" fill="#3b82f6" ${O}/>`,
    battery: `<rect x="2" y="5.4" width="14" height="9.2" rx="1.6" fill="#f8fafc" ${O}/><rect x="16" y="8" width="2.2" height="4" rx=".6" fill="#111"/><rect x="3.6" y="7" width="8" height="6" rx=".6" fill="#22c55e"/>`,
    chestnut: `<path d="M10 3.4C5 3.4 2.6 8 3.4 12c.8 3.6 3.6 5 6.6 5s5.8-1.4 6.6-5c.8-4-1.6-8.6-6.6-8.6z" fill="#92400e" ${O}/><path d="M3.6 10.4c3.6 1.4 9.2 1.4 12.8 0" fill="none" stroke="#fde68a" stroke-width="1.4"/>${hi(7, 6.6, 1.8, 1)}`,
    potted: `<path d="M5 11.4h10l-1.4 6.2H6.4z" fill="#c2410c" ${O}/><path d="M4.4 11.4h11.2" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><path d="M10 11V6M10 8C7.4 8 5.6 6.4 5.4 3.6 8 3.6 9.8 5.4 10 8zM10 7c.4-2.4 2.4-3.8 4.6-3.6 0 2.4-2 3.8-4.6 3.6z" fill="#22c55e" ${O}/>`,
    blossom: `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="10" cy="5.6" rx="3" ry="3.8" fill="#f9a8d4" ${O} transform="rotate(${a} 10 10)"/>`).join('')}<circle cx="10" cy="10" r="2" fill="#facc15" ${O}/>`,
    apple: `<path d="M10 6.4C7.6 4.6 3 5.4 3 10.4c0 4 3 7.6 5.4 7.2 1-.2 1.6-.6 1.6-.6s.6.4 1.6.6c2.4.4 5.4-3.2 5.4-7.2 0-5-4.6-5.8-7-4z" fill="#ef4444" ${O}/><path d="M10 6.4c0-2 .6-3.4 1.8-4.2" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M11 4.4c1.6-1.4 3.6-1.4 4.8-.4-1.4 1.4-3.2 1.6-4.8.4z" fill="#22c55e" ${O}/>${hi(6.4, 9, 1.6, 1.1)}`,
  });
  Object.assign(MAP, {
    '🎉': 'party', '💧': 'droplet', '💦': 'droplets', '🩸': 'blood', '🗡': 'dagger', '⏳': 'hourglass', '⌛': 'hourglass', '👥': 'people', '🔥': 'fire', '📁': 'folder', '📂': 'folderopen',
    '🍅': 'tomato', '🤖': 'robot', '🧠': 'brain', '✅': 'checkbox', '❌': 'cross', '🗺': 'map', '⭐': 'star', '🌟': 'glowstar', '🃏': 'card', '💀': 'skull',
    '⏱': 'stopwatch', '⏰': 'alarm', '🕛': 'clock', '🖼': 'picture', '📘': 'bookblue', '📕': 'bookred', '📗': 'bookgreen', '📙': 'bookorange', '📚': 'books', '🔧': 'wrench',
    '🧩': 'puzzle', '📋': 'clipboard', '💬': 'speech', '🏠': 'house', '🏘': 'houses', '💾': 'floppy', '📎': 'paperclip', '📄': 'page', '📝': 'memo', '🚀': 'rocket',
    '🔔': 'bell', '🔕': 'belloff', '📅': 'calendar', '🔠': 'abcup', '🔤': 'abc', '❓': 'question', '🎮': 'gamepad', '📌': 'pushpin', '🔑': 'key', '🎲': 'die',
    '🎓': 'gradcap', '🔊': 'speaker', '☕': 'coffee', '🧭': 'compass', '🚪': 'door', '➕': 'plus', '📞': 'phone', '🔎': 'magnifier', '🔍': 'magnifier', '🗄': 'cabinet',
    '🗜': 'archive', '🎵': 'music', '🎬': 'clapper', '👤': 'bust', '⚪': 'whitecircle', '🌍': 'globe', '⚖': 'scales', '📊': 'chart', '👍': 'thumbsup', '🔭': 'telescope',
    '🖊': 'pen', '🌙': 'moon', '🌑': 'newmoon', '😴': 'sleepy', '😶': 'noface', '😰': 'anxious', '😤': 'huff', '🤢': 'sick', '🦁': 'lion', '🗽': 'statue',
    '✍': 'writing', '💼': 'briefcase', '💸': 'moneywings', '👉': 'pointing', '📥': 'inbox', '🖤': 'blackheart', '💗': 'pinkheart', '🥷': 'ninja', '🪶': 'feather', '⭕': 'ring',
    '🦅': 'eagle', '🏹': 'bow', '🔫': 'gun', '🧱': 'bricks', '🪵': 'log', '🟫': 'brownsq', '⬛': 'blacksq', '🍖': 'meat', '🥩': 'steak', '🧟': 'zombie',
    '🌾': 'wheat', '✈': 'plane', '📦': 'package', '🪣': 'bucket', '🚿': 'shower', '🌳': 'tree', '💣': 'bomb', '📣': 'megaphone', '🚩': 'redflag', '🌀': 'cyclone',
    '🪤': 'trap', '🧨': 'dynamite', '💉': 'syringe', '🗿': 'moai', '🐾': 'paws', '☄': 'comet', '🌫': 'fog', '🎰': 'slot', '📫': 'mailbox', '🧪': 'testtube',
    '⚗': 'alembic', '☢': 'radioactive', '🌈': 'rainbow', '🥀': 'wilted', '🚶': 'walking', '🏃': 'running', '🧹': 'broom', '🌿': 'herb', '🔨': 'hammer', '👹': 'ogre',
    '🐺': 'wolf', '💢': 'anger', '🐍': 'snake', '🛒': 'cart', '💫': 'dizzy', '🏪': 'store', '🚰': 'tap', '🏭': 'factory', '⛪': 'church', '🧙': 'mage',
    '🪄': 'wand', '🏏': 'bat', '🐕': 'dog', '🦍': 'gorilla', '🥕': 'carrot', '🎃': 'pumpkin', '🍈': 'melon', '🥪': 'sandwich', '🧴': 'lotion', '💊': 'pill',
    '🌪': 'tornado', '🌡': 'thermometer', '🌋': 'volcano', '🌵': 'cactus', '💃': 'dancer', '🔽': 'downbtn', '🔩': 'nutbolt', '🙏': 'pray', '🕊': 'dove', '🔁': 'repeat',
    '🔄': 'cycle', '🔋': 'battery', '🌰': 'chestnut', '🪴': 'potted', '🌸': 'blossom', '🍎': 'apple',
  });
  // luk pro 🏹 (lučištník v textech)
  I.bow = `<path d="M5 2.4c6.4 2.4 10 6 12.6 12.6" fill="none" stroke="#111" stroke-width="3.6" stroke-linecap="round"/><path d="M5 2.4c6.4 2.4 10 6 12.6 12.6" fill="none" stroke="#a16207" stroke-width="2" stroke-linecap="round"/><path d="M5 2.4 17.6 15" stroke="#f8fafc" stroke-width=".9"/><path d="M2.4 17.6 13.4 6.6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/><path d="M2.4 17.6 13.4 6.6" stroke="#d6b98c" stroke-width="1.2" stroke-linecap="round"/><path d="M14.6 5.4 11 6.2l2.8 2.8z" fill="#9ca3af" ${O}/><path d="M2.4 17.6l-.4-2.6M2.4 17.6l2.6.4" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>`;

  // textové znaky (šipky, ✔, ☀…) jen s doplňkem U+FE0F, který z nich dělá emoji; bez něj zůstávají textem
  const arrowI = d => `<circle cx="10" cy="10" r="7.6" fill="#3b82f6" ${O}/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  Object.assign(I, {
    up: arrowI('M10 14.6V5.6M6.4 9 10 5.4 13.6 9'), down: arrowI('M10 5.4v9M6.4 11 10 14.6 13.6 11'), right: arrowI('M5.4 10h9M11 6.4l3.6 3.6-3.6 3.6'),
    back: arrowI('M13.8 13.6v-2.4a3 3 0 0 0-3-3H6M8.6 5.4 5.6 8.2l3 2.8'),
    heavycheck: `<path d="M3.4 10.4l4.4 4.4 8.8-9.2" fill="none" stroke="#111" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.4 10.4l4.4 4.4 8.8-9.2" fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    sun: `<circle cx="10" cy="10" r="4.2" fill="#facc15" ${O}/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M10 2.2v2.4" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" transform="rotate(${a} 10 10)"/>`).join('')}`,
    latin: `<path d="M8.4 2h3.2v4.4H16v3.2h-4.4V18H8.4V9.6H4V6.4h4.4z" fill="#facc15" ${O}/>`,
    male: `<circle cx="8.4" cy="11.6" r="4.8" fill="none" stroke="#111" stroke-width="3.4"/><circle cx="8.4" cy="11.6" r="4.8" fill="none" stroke="#3b82f6" stroke-width="1.8"/><path d="M12 8l4.6-4.6M12.4 3.4h4.2v4.2" fill="none" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M12 8l4.6-4.6M12.4 3.4h4.2v4.2" fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round"/>`,
  });
  const VS = { '☑': 'checkbox', '⬆': 'up', '⬇': 'down', '➡': 'right', '↩': 'back', '✔': 'heavycheck', '☀': 'sun', '✝': 'latin', '♂': 'male' };
  Object.keys(VS).forEach(k => { MAP[k] = VS[k]; });
  const reEsc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE = new RegExp('(' + Object.keys(MAP).filter(k => !VS[k]).map(reEsc).join('|') + ')\uFE0F?|(' + Object.keys(VS).map(reEsc).join('|') + ')\uFE0F', 'gu');
  const svg = name => `<span class="tdi" aria-hidden="true"><svg viewBox="0 0 20 20">${I[name]}</svg></span>`;
  const TDI = window.SBI = window.TDI = {
    svg, has: s => { RE.lastIndex = 0; return RE.test(s); },
    // text (už escapovaný HTML) → HTML s ikonami
    html: s => String(s).replace(RE, (m, e, v) => svg(MAP[e || v])),
    set: (el, text) => { if (!el || el._tdi === text) return; el._tdi = text; el.innerHTML = TDI.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')); },
  };
  // Hlídač: textové uzly s emoji v rámci stránky převede na ikony
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SVG: 1, svg: 1, TITLE: 1 };
  // obsah psaný uživatelem nechat beze změny (ukládá se z DOM nebo se s ním porovnává)
  const USER = 'svg, [contenteditable], .rich-editor, .note-content, [data-noicons]';
  function convertText(node) {
    const t = node.nodeValue;
    RE.lastIndex = 0;
    if (!t || !RE.test(t)) return;
    const p = node.parentNode; if (!p || SKIP[p.nodeName] || p.closest?.(USER)) return;
    const span = document.createElement('span');
    RE.lastIndex = 0;
    span.innerHTML = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(RE, (m, e, v) => svg(MAP[e || v]));
    const frag = document.createDocumentFragment();
    while (span.firstChild) frag.appendChild(span.firstChild);
    p.replaceChild(frag, node);
  }
  function walk(root) {
    if (root.nodeType === 3) { convertText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    while (tw.nextNode()) list.push(tw.currentNode);
    list.forEach(convertText);
  }
  /* ---------- plátno: emoji ve fillText nakreslit jako ikonu ---------- */
  const imgs = {};
  const iconImg = name => {
    let im = imgs[name];
    if (!im) { im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="64" height="64">' + I[name] + '</svg>'); imgs[name] = im; }
    return im;
  };
  Object.keys(I).forEach(iconImg);   // předem, ať jsou při prvním snímku hry hotové
  const HAS = new RegExp(RE.source, 'u');
  if (window.CanvasRenderingContext2D) {
    const P = CanvasRenderingContext2D.prototype, oFill = P.fillText, oMeasure = P.measureText;
    P.fillText = function (text, x, y, maxW) {
      if (typeof text !== 'string' || !HAS.test(text)) return maxW === undefined ? oFill.call(this, text, x, y) : oFill.call(this, text, x, y, maxW);
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font), size = m ? +m[1] : 10, parts = [];
      let last = 0; RE.lastIndex = 0;
      for (let r; (r = RE.exec(text));) { if (r.index > last) parts.push(text.slice(last, r.index)); parts.push({ ic: MAP[r[1] || r[2]] }); last = RE.lastIndex; }
      if (last < text.length) parts.push(text.slice(last));
      const w = parts.map(p => typeof p === 'string' ? oMeasure.call(this, p).width : size * 1.1), W = w.reduce((a, b) => a + b, 0);
      const al = this.textAlign, bl = this.textBaseline;
      let cx = al === 'center' ? x - W / 2 : (al === 'right' || al === 'end') ? x - W : x;
      const top = bl === 'middle' ? y - size / 2 : (bl === 'top' || bl === 'hanging') ? y : (bl === 'bottom' || bl === 'ideographic') ? y - size : y - size * 0.82;
      this.textAlign = 'left';
      parts.forEach((p, i) => {
        if (typeof p === 'string') oFill.call(this, p, cx, y);
        else { const im = iconImg(p.ic); if (im.complete && im.naturalWidth) this.drawImage(im, cx + size * 0.05, top, size, size); }
        cx += w[i];
      });
      this.textAlign = al;
    };
  }
  function start() {
    if (!document.getElementById('sbi-css')) {   // styl ikon (funguje i na stránkách bez style.css)
      const st = document.createElement('style'); st.id = 'sbi-css';
      st.textContent = '.tdi{display:inline-block;width:1.2em;height:1.2em;vertical-align:-.24em;line-height:0;flex-shrink:0}.tdi svg{width:100%;height:100%;display:block;overflow:visible}';
      document.head.appendChild(st);
    }
    walk(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') convertText(m.target); else m.addedNodes.forEach(walk); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

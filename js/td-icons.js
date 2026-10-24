/* td-icons.js — kreslené ikony (SVG) místo emoji v ovládání Obrany království.
 * TDI.html(text) vrátí text s emoji nahrazenými <span class="tdi">…svg…</span>; TDI.set(el, text) to zapíše jen při změně
 * (lišta se mění každý snímek). Hlídač stránky (MutationObserver) převádí i texty, které vloží ostatní kód
 * (panel, oznámení, tipy, versus). Neznámá emoji zůstávají. Styl: obrys #111, ploché barvy, světlo vlevo nahoře. */
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
  const RE = new RegExp('(' + Object.keys(MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'gu');
  const svg = name => `<span class="tdi" aria-hidden="true"><svg viewBox="0 0 20 20">${I[name]}</svg></span>`;
  const TDI = window.TDI = {
    svg, has: s => { RE.lastIndex = 0; return RE.test(s); },
    // text (už escapovaný HTML) → HTML s ikonami
    html: s => String(s).replace(RE, (m, e) => svg(MAP[e])),
    set: (el, text) => { if (!el || el._tdi === text) return; el._tdi = text; el.innerHTML = TDI.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')); },
  };
  // Hlídač: textové uzly s emoji v rámci stránky převede na ikony
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SVG: 1, svg: 1 };
  function convertText(node) {
    const t = node.nodeValue;
    RE.lastIndex = 0;
    if (!t || !RE.test(t)) return;
    const p = node.parentNode; if (!p || SKIP[p.nodeName] || p.closest?.('svg')) return;
    const span = document.createElement('span');
    RE.lastIndex = 0;
    span.innerHTML = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(RE, (m, e) => svg(MAP[e]));
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
  function start() {
    walk(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') convertText(m.target); else m.addedNodes.forEach(walk); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

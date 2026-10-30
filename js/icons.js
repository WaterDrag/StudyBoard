/* icons.js — emoji v rozhraní jako čárové ikony (tabulka LINE), ostatní jako Google emoji (Noto), aby vypadaly všude stejně.
 * SBI.html(text) vrátí text s emoji nahrazenými <img class="tdi"> s obrázkem Noto; SBI.set(el, text) to zapíše jen při změně.
 * Hlídač stránky (MutationObserver) převádí texty, které vloží ostatní kód; přeskakuje obsah od uživatelů
 * (editory, poznámky, pole, [data-noicons]) — tam se emoji jen vykreslí písmem Noto Color Emoji (DOM zůstane beze změny).
 * Kreslení emoji do plátna (fillText) se taky nahradí obrázkem Noto. */
(function () {
  'use strict';
  const NOTO = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';
  // Znaky, které mají výchozí podobu textovou, ale aplikace je píše jako emoji i bez U+FE0F
  const TEXT_AS_EMOJI = '❤⚔▶⏸⏭⚙✳🛡⛏🕯🏗🗑✏❄⚠👁♾🖱☠🗡🗺⏱🖼🏘🗄🗜⚖🖊✍✈☄🌫⚗☢🌪🌡🕊';
  const PART = '(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}(?=\\uFE0F)|[' + TEXT_AS_EMOJI + '])(?:\\p{Emoji_Modifier}|\\uFE0F)?';
  const RE = new RegExp('\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|' + PART + '(?:\\u200D(?:\\p{Extended_Pictographic})(?:\\p{Emoji_Modifier}|\\uFE0F)?)*', 'gu');
  // „👨‍💻" → 1f468_200d_1f4bb (Noto bez U+FE0F; jen klávesy chtějí 0031_fe0f_20e3)
  const code = e => {
    const cps = [...e].map(c => c.codePointAt(0)).filter(c => c !== 0xFE0F);
    if (cps[cps.length - 1] === 0x20E3) return cps[0].toString(16).padStart(4, '0') + '_fe0f_20e3';
    return cps.map(c => c.toString(16)).join('_');
  };
  const url = e => NOTO + code(e) + '/emoji.svg';
  const escA = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  /* ---------- rozhraní: čárové ikony místo emoji ----------
     Emoji z tabulky se v rozhraní kreslí stejným stylem jako ostatní ikony (obrys barvou textu). Co v tabulce není
     (herní postavy, rostliny v zahradě…), zůstává jako Noto. Hry (Zombie, Obrana, Dobyvatel) a plátna si nechávají své. */
  const GAME_PAGE = /\/(_?game|_?obrana|_?dobyvatel)(\.html)?$/.test(location.pathname);
  const P = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    book1: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    tomato: '<circle cx="12" cy="14" r="8"/><path d="M12 6V3M12 6c-2-1-4-1-5 0M12 6c2-1 4-1 5 0"/>',
    sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    party: '<path d="M4 21l5-14 9 9z"/><path d="M14 4l1 1M19 3v2M21 9h-2M17 8l2-2M13 8c0-1 .5-2 1-2.5"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 14h.01M15 14h.01M2 13v3M22 13v3"/><circle cx="12" cy="3" r="1"/>',
    brain: '<path d="M9.5 3A3.5 3.5 0 0 0 6 6.5 3.5 3.5 0 0 0 4 13a3.5 3.5 0 0 0 2 6 3 3 0 0 0 6 0V4.5A2.5 2.5 0 0 0 9.5 3z"/><path d="M14.5 3A3.5 3.5 0 0 1 18 6.5 3.5 3.5 0 0 1 20 13a3.5 3.5 0 0 1-2 6 3 3 0 0 1-6 0V4.5A2.5 2.5 0 0 1 14.5 3z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5"/>',
    flame: '<path d="M12 1.5c1.2 4.3 6.8 6.5 6.8 13a6.8 6.800 0 0 1-13.600 0c0-2.300 1.100-3.900 2.300-5 0 2.200 1 3.300 2.200 3.300 1.100-3.300-1.100-6.700 2.300-11.300z" fill="#f97316" stroke="#9a3412" stroke-width="1"/><path d="M12.200 9.500c.5 2.500 3.500 3.700 3.500 7a3.700 3.700 0 0 1-7.400 0c0-1.300.6-2.200 1.300-2.800.1 1.100.6 1.700 1.200 1.700.7-1.800-.4-3.600 1.400-5.900z" fill="#fbbf24" stroke="none"/><path d="M12 15c.2 1 1.500 1.500 1.500 3a1.500 1.500 0 0 1-3 0c0-1.200.9-1.700 1.500-3z" fill="#fef9c3" stroke="none"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/>',
    note: '<path d="M15 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/><path d="M15 21v-6h6"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    puzzle: '<path d="M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4v-4a2 2 0 1 0 0-4z"/>',
    clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkbox: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5A1.5 1.5 0 0 1 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><path d="M7.5 11h.01M10 7.5h.01M15 7.5h.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0"/>',
    belloff: '<path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 5 1.2 6.5M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M10.3 21a2 2 0 0 0 3.4 0M2 2l20 20"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    cap: '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    gamepad: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    scroll: '<path d="M8 21h11a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2h4M6 3h11a2 2 0 0 1 2 2v13"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    clapper: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 9l17-5 1 4M8 7.5 10 4M13.5 6l2-3.5"/>',
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
    ring: '<circle cx="12" cy="12" r="6"/>',
    dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
    chart: '<path d="M3 3v18h18M8 17v-5M13 17V8M18 17v-8"/>',
    coffee: '<path d="M4 8h14v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM18 9h1a3 3 0 0 1 0 6h-1M8 2v3M12 2v3"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    tree: '<path d="M12 22v-6M12 2a6 6 0 0 0-5.7 7.9A5 5 0 0 0 8 19h8a5 5 0 0 0 1.7-9.1A6 6 0 0 0 12 2z"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    home: '<path d="M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m5 5 14 14"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    pin: '<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V17h14v-1.8a2 2 0 0 0-1.1-1.7l-1.8-.9A2 2 0 0 1 15 10.8V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 18 3h3v3l-3.5 8.5"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8 10 5 3h4l3 6 3-6h4l-3 7"/>',
    skip: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
    drop: '<path d="M12 2.7s7 7 7 12.3a7 7 0 0 1-14 0c0-5.300 7-12.300 7-12.300z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.200 3 7 7 0 0 0 21 12.800z"/>',
    castle: '<path d="M4 21V8h3V5h3v3h4V5h3v3h3v13h-6v-5a2 2 0 0 0-4 0v5z"/>',
    thumb: '<path d="M7 11v10H3V11zM7 11l4-9a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.300l-1.300 8A2 2 0 0 1 18.700 21H7"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    key: '<circle cx="7.500" cy="15.500" r="5.500"/><path d="m21 2-9.600 9.600M15.500 7.500l3 3L22 7l-3-3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    crown: '<path d="m2 7 4 11h12l4-11-6 4-4-7-4 7zM6 21h12"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.700L3 13"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    timer: '<circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2M9 2h6M12 2v4"/>',
    phone: '<path d="M22 16.900v3a2 2 0 0 1-2.200 2 19.800 19.800 0 0 1-8.600-3.100 19.500 19.500 0 0 1-6-6A19.800 19.800 0 0 1 2.100 4.200 2 2 0 0 1 4.100 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.900.7 2.800a2 2 0 0 1-.5 2.100L8.100 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.5c.9.300 1.800.6 2.800.7a2 2 0 0 1 1.700 2.100z"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    flag: '<path d="M4 22V4c4-2 6 2 10 0s4 0 6 0v10c-2 0-2-2-6 0s-6-2-10 0"/>',
    coins: '<circle cx="9" cy="9" r="6"/><path d="M15.500 9.300A6 6 0 1 1 9.300 15.500"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.500"/><path d="M6 12h.01M18 12h.01"/>',
    heart: '<path d="M20.800 4.600a5.500 5.500 0 0 0-7.800 0L12 5.700l-1-1.100a5.500 5.500 0 0 0-7.800 7.800L12 21.200l8.800-8.800a5.500 5.500 0 0 0 0-7.800z"/>',
    right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    infinity: '<path d="M12 12c-2-2.700-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.300 6-4s4-4 6-4a4 4 0 0 1 0 8c-2 0-4-1.300-6-4z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };
  const LINE = {
    '🧑': 'user', '👤': 'user', '👥': 'users', '🤝': 'users', '🎯': 'target', '📁': 'folder', '📂': 'folder', '🗂': 'folder', '✏': 'pencil', '🖊': 'pencil', '✍': 'pencil',
    '⏳': 'hourglass', '🗑': 'trash', '📖': 'book', '📘': 'book1', '📕': 'book1', '📗': 'book1', '📙': 'book1', '📚': 'book', '🍅': 'tomato', '✨': 'sparkles', '🎉': 'party',
    '📋': 'clipboard', '🤖': 'bot', '🧠': 'brain', '🏆': 'trophy', '🔥': 'flame', '🔗': 'link', '🖼': 'image', '💬': 'message', '⭐': 'star', '💾': 'save', '⚠': 'warn', '🃏': 'cards',
    '📝': 'note', '▶': 'play', '🧩': 'puzzle', '📎': 'clip', '✅': 'check', '✔': 'check', '☑': 'checkbox', '📄': 'file', '🎨': 'palette', '🔔': 'bell', '🔕': 'belloff', '⚙': 'gear',
    '🎓': 'cap', '🗺': 'map', '💡': 'bulb', '🎮': 'gamepad', '❌': 'x', '🎲': 'dice', '⬆': 'up', '📜': 'scroll', '🗄': 'archive', '🗜': 'archive', '🔍': 'search', '🔎': 'search', '🔭': 'search',
    '🎵': 'music', '🎬': 'clapper', '🟢': 'dot', '⚪': 'ring', '💪': 'dumbbell', '📊': 'chart', '☕': 'coffee', '⏸': 'pause', '🌳': 'tree', '🔁': 'repeat', '🔊': 'volume', '❓': 'help',
    '🧭': 'compass', '🏠': 'home', '🚪': 'door', '🚫': 'ban', '👁': 'eye', '📌': 'pin', '➕': 'plus', '📨': 'mail', 'ℹ': 'info', '⚔': 'swords', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal',
    '⏭': 'skip', '💧': 'drop', '📅': 'calendar', '😴': 'moon', '🏰': 'castle', '👍': 'thumb', '📥': 'download', '🔑': 'key', '🛡': 'shield', '👑': 'crown', '↩': 'undo', '🕛': 'clock',
    '⏱': 'timer', '📞': 'phone', '🔤': 'type', '🔠': 'type', '🏁': 'flag', '💰': 'coins', '⏰': 'alarm', '💼': 'briefcase', '💸': 'cash', '❤': 'heart', '🖤': 'heart', '👉': 'right', '♾': 'infinity', '🔒': 'lock',
  };
  const TINT = { '🥇': '#eab308', '🥈': '#94a3b8', '🥉': '#c2703d', '❤': '#ef4444', '⭐': '#eab308', '🔥': '#f97316', '🟢': '#22c55e', '✅': '#22c55e', '✔': '#22c55e', '❌': '#ef4444', '🍅': '#ef4444', '🏆': '#eab308', '⚠': '#f59e0b', '👑': '#eab308', '💰': '#eab308', '💧': '#38bdf8' };
  const lineIcon = e => {
    if (GAME_PAGE) return null;
    const k = e.replace(/\uFE0F/g, ''), p = P[LINE[k]];
    if (!p) return null;
    return `<svg class="tdl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${escA(k)}"${TINT[k] ? ` style="color:${TINT[k]}"` : ''}>${p}</svg>`;
  };
  // alt = samotné emoji: kopírování textu i čtečky dostanou původní znak; když obrázek nejde načíst, ukáže se znak
  const img = e => lineIcon(e) || `<img class="tdi" src="${url(e)}" alt="${escA(e)}" draggable="false" loading="lazy" onerror="this.replaceWith(this.alt)">`;
  const TDI = window.SBI = window.TDI = {
    url, has: s => { RE.lastIndex = 0; return RE.test(s); },
    // text (už escapovaný HTML) → HTML s obrázky emoji
    html: s => String(s).replace(RE, img),
    set: (el, text) => { if (!el || el._tdi === text) return; el._tdi = text; el.innerHTML = TDI.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')); },
  };
  // Hlídač: textové uzly s emoji v rámci stránky převede na obrázky
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
    span.innerHTML = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(RE, img);
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
  /* ---------- plátno: emoji ve fillText nakreslit obrázkem Noto ---------- */
  const imgs = {};
  const canvasImg = e => {
    const k = code(e);
    let im = imgs[k];
    // crossOrigin: obrázek z jiné domény by jinak „zašpinil" plátno a toDataURL (ikony v obchodě Obrany) by spadlo
    if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'; im.src = url(e); imgs[k] = im; }
    return im;
  };
  // Emoji, které hry kreslí do plátna, načíst předem (jinak by se první snímek, který se ukládá do mezipaměti, nakreslil bez nich)
  const PRELOAD = '❤💚🪙💎🌊💰📜⚔👻🔮💨🏆▶⏸⏭💥🏰👑🫧🔦🪨🚫⚙📖🌱🔵🟢😡✳🛡⛏🧲🧊🐝🪖📍🕯🏗💪🏁🗑🎨🧑✏❄⚠🎯👁♾🖱⛵🗼🏦✨🔒🎁🤝🔌💡☠🔄🥇🥈🥉🔗⚡🧟🧠🔥💀⭐🌟🍀🎲🃏🧩🏹🗡🪓🌲🌳🍄🐉🦅🐺🧙🧪💣🌀☄🌪';
  const preload = () => { RE.lastIndex = 0; (PRELOAD.match(RE) || []).forEach(canvasImg); };
  (window.requestIdleCallback || (f => setTimeout(f, 300)))(preload);
  const HAS = new RegExp(RE.source, 'u');
  if (window.CanvasRenderingContext2D) {
    const P = CanvasRenderingContext2D.prototype, oFill = P.fillText, oMeasure = P.measureText;
    P.fillText = function (text, x, y, maxW) {
      if (typeof text !== 'string' || !HAS.test(text)) return maxW === undefined ? oFill.call(this, text, x, y) : oFill.call(this, text, x, y, maxW);
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font), size = m ? +m[1] : 10, parts = [];
      let last = 0; RE.lastIndex = 0;
      for (let r; (r = RE.exec(text));) { if (r.index > last) parts.push(text.slice(last, r.index)); parts.push({ e: r[0] }); last = RE.lastIndex; }
      if (last < text.length) parts.push(text.slice(last));
      const w = parts.map(p => typeof p === 'string' ? oMeasure.call(this, p).width : size * 1.1), W = w.reduce((a, b) => a + b, 0);
      const al = this.textAlign, bl = this.textBaseline;
      let cx = al === 'center' ? x - W / 2 : (al === 'right' || al === 'end') ? x - W : x;
      const top = bl === 'middle' ? y - size / 2 : (bl === 'top' || bl === 'hanging') ? y : (bl === 'bottom' || bl === 'ideographic') ? y - size : y - size * 0.82;
      this.textAlign = 'left';
      parts.forEach((p, i) => {
        if (typeof p === 'string') oFill.call(this, p, cx, y);
        else {
          const im = canvasImg(p.e);
          if (im.complete && im.naturalWidth) this.drawImage(im, cx + size * 0.05, top, size, size);
          else oFill.call(this, p.e, cx, y);   // ještě se načítá → zatím systémové emoji
        }
        cx += w[i];
      });
      this.textAlign = al;
    };
  }
  function start() {
    if (!document.getElementById('sbi-css')) {   // styl emoji (funguje i na stránkách bez style.css)
      const st = document.createElement('style'); st.id = 'sbi-css';
      st.textContent = 'img.tdi{display:inline-block;width:1.2em;height:1.2em;vertical-align:-.24em;margin:0 .03em;flex-shrink:0;object-fit:contain}svg.tdl{display:inline-block;width:1.1em;height:1.1em;vertical-align:-.18em;margin:0 .04em;flex-shrink:0}';
      document.head.appendChild(st);
    }
    // Obsah od uživatelů (poznámky, editor, pole) se nepřepisuje — emoji v něm vykreslí písmo Noto Color Emoji.
    // Na Applu ne: Safari barevné písmo Noto neumí a jeho vlastní emoji vypadají dobře.
    if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform || '') && !document.getElementById('sbi-font')) {
      const l = document.createElement('link'); l.id = 'sbi-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap';
      document.head.appendChild(l);
    }
    walk(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') convertText(m.target); else m.addedNodes.forEach(walk); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

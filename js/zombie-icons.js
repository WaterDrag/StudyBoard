/**
 * ZOMBIE SURVIVAL - Sada herních SVG ikon (window.ZSI)
 * Jednotný styl: viewBox 0 0 24 24, obrys #111 (1.5 px), světlo shora zleva, bez ID a bez textu.
 */
(function (global) {
  'use strict';

  const O = 'stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const N = 'stroke="none"';
  const HI = 'fill="#fff" fill-opacity="0.28" stroke="none"';
  const SH = 'fill="#000" fill-opacity="0.22" stroke="none"';

  const ICONS = {
    // ========================================================================
    // 1. PANEL HRÁČE (9)
    // ========================================================================
    hp: `
      <path d="M12 21s-8-5.2-8-11.2A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8 3.5C20 15.8 12 21 12 21z" fill="#ef4444" ${O}/>
      <path d="M12 19.5s6.5-4.3 6.5-9.7c0-1.5-.7-2.8-1.8-3.5 1.8.5 3.3 2.2 3.3 4.5 0 5.5-8 10.2-8 10.2z" ${SH}/>
      <ellipse cx="8" cy="9.2" rx="2.2" ry="1.3" transform="rotate(-30 8 9.2)" ${HI}/>
    `,
    xp: `
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3" fill="#facc15" ${O}/>
      <polygon points="12 4.2 14.3 8.8 19.5 9.6 12 12 8.9 8.8" ${HI}/>
      <polygon points="12 12 17 14.1 18.2 21 12 17.8 5.8 21 12 12" ${SH}/>
    `,
    hunger: `
      <path d="M15.5 14.5l3.8 3.8a2 2 0 0 1 2.2 2.2 2 2 0 0 1-2.2 2.2l-3.8-3.8z" fill="#f8fafc" ${O}/>
      <path d="M6 5c3.5-3 9.5-2 11.5 2s.5 8.5-2.5 10.5-6.5.5-9.5-2.5S2.5 8 6 5z" fill="#c2410c" ${O}/>
      <ellipse cx="9.5" cy="8.5" rx="3.2" ry="1.8" transform="rotate(-25 9.5 8.5)" ${HI}/>
      <circle cx="8" cy="11" r="1.8" fill="#fed7aa" ${O}/>
    `,
    thirst: `
      <path d="M12 2.5C12 2.5 5 10.2 5 15a7 7 0 0 0 14 0c0-4.8-7-12.5-7-12.5z" fill="#38bdf8" ${O}/>
      <path d="M18 14a6 6 0 0 1-8 5.6A6.5 6.5 0 0 0 17 13c0-2.5-2.5-6.5-5-9.5 3 3.5 6 7.8 6 10.5z" ${SH}/>
      <path d="M8.5 12.5c0-2 2-5 3-6.5-1.8 2-3.8 5.2-3.8 7.5 0 1.5.8 2.8 2 3.5-.7-.8-1.2-2.2-1.2-4.5z" ${HI}/>
    `,
    base: `
      <polygon points="4 10 12 4 20 10 20 20 4 20" fill="#475569" ${O}/>
      <polygon points="4 10 12 4 20 10 12 8" ${HI}/>
      <rect x="6" y="13" width="12" height="7" rx="1" fill="#334155" ${O}/>
      <circle cx="12" cy="16.5" r="2.5" fill="#38bdf8" ${O}/>
      <path d="M12 4V1.5M12 1.5L16 3l-4 1.5" fill="#ef4444" ${O}/>
    `,
    coins: `
      <circle cx="9.5" cy="10.5" r="6.5" fill="#eab308" ${O}/>
      <circle cx="14.5" cy="13.5" r="6.5" fill="#facc15" ${O}/>
      <circle cx="14.5" cy="13.5" r="4.2" fill="#eab308" stroke="#ca8a04" stroke-width="1"/>
      <rect x="13.7" y="11" width="1.6" height="5" rx="0.8" fill="#fef08a" ${N}/>
      <ellipse cx="12.5" cy="10" rx="2" ry="1" transform="rotate(-30 12.5 10)" ${HI}/>
    `,
    level: `
      <path d="M4 4h16v9c0 5-8 8.5-8 8.5S4 18 4 13V4z" fill="#8b5cf6" ${O}/>
      <path d="M4 4h16v3H4z" ${HI}/>
      <polyline points="8 12.5 12 8.5 16 12.5" fill="none" stroke="#facc15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="8 16.5 12 12.5 16 16.5" fill="none" stroke="#fef08a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    wave: `
      <path d="M5 12a7 7 0 1 1 14 0c0 2.5-1.2 4.3-2.5 5.2V20H7.5v-2.8C6.2 16.3 5 14.5 5 12z" fill="#e2e8f0" ${O}/>
      <ellipse cx="9.5" cy="7.5" rx="3" ry="1.5" transform="rotate(-20 9.5 7.5)" ${HI}/>
      <circle cx="9" cy="12" r="2" fill="#ef4444" ${O}/>
      <circle cx="15" cy="12" r="2" fill="#ef4444" ${O}/>
      <polygon points="12 14 11 16 13 16" fill="#111" ${N}/>
      <line x1="10" y1="17.5" x2="10" y2="20" ${O}/>
      <line x1="14" y1="17.5" x2="14" y2="20" ${O}/>
    `,
    time: `
      <path d="M6 3h12M6 21h12" stroke="#b45309" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M7 3.5h10L13.5 11v2L17 20.5H7L10.5 13v-2L7 3.5z" fill="#e0f2fe" ${O}/>
      <polygon points="8.8 7 15.2 7 12 11" fill="#f59e0b" ${N}/>
      <polygon points="8.5 19.5 15.5 19.5 12 15" fill="#f59e0b" ${N}/>
      <line x1="6" y1="3" x2="18" y2="3" ${O}/>
      <line x1="6" y1="21" x2="18" y2="21" ${O}/>
    `,

    // ========================================================================
    // 2. LIŠTA STAVEB (13)
    // ========================================================================
    wall: `
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#94a3b8" ${O}/>
      <rect x="3.2" y="5.2" width="17.6" height="3.5" ${HI}/>
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" ${O}/>
      <line x1="2.5" y1="14.5" x2="21.5" y2="14.5" ${O}/>
      <line x1="9" y1="4.5" x2="9" y2="9.5" ${O}/>
      <line x1="16" y1="4.5" x2="16" y2="9.5" ${O}/>
      <line x1="12.5" y1="9.5" x2="12.5" y2="14.5" ${O}/>
      <line x1="8" y1="14.5" x2="8" y2="19.5" ${O}/>
      <line x1="15.5" y1="14.5" x2="15.5" y2="19.5" ${O}/>
    `,
    barricade: `
      <rect x="5" y="3" width="3.5" height="18" rx="1" fill="#92400e" ${O}/>
      <rect x="15.5" y="3" width="3.5" height="18" rx="1" fill="#92400e" ${O}/>
      <polygon points="2.5 7 21.5 9.5 21 13.5 2 11" fill="#d97706" ${O}/>
      <polygon points="2 14 21 11.5 21.5 15.5 2.5 18" fill="#b45309" ${O}/>
      <circle cx="6.7" cy="9.5" r="1" fill="#e2e8f0" ${N}/>
      <circle cx="17.2" cy="11" r="1" fill="#e2e8f0" ${N}/>
      <circle cx="6.7" cy="15.5" r="1" fill="#e2e8f0" ${N}/>
      <circle cx="17.2" cy="14" r="1" fill="#e2e8f0" ${N}/>
    `,
    spikes: `
      <rect x="2.5" y="16" width="19" height="4.5" rx="1.5" fill="#475569" ${O}/>
      <polygon points="4 16 7 5 10 16" fill="#cbd5e1" ${O}/>
      <polygon points="9 16 12 4 15 16" fill="#e2e8f0" ${O}/>
      <polygon points="14 16 17 5 20 16" fill="#cbd5e1" ${O}/>
      <polygon points="11.2 7 12 4 12.8 7" fill="#ef4444" ${N}/>
      <polygon points="16.3 8 17 5 17.7 8" fill="#ef4444" ${N}/>
    `,
    turret: `
      <path d="M5 19l2.5-5h9L19 19z" fill="#475569" ${O}/>
      <rect x="13" y="7" width="8.5" height="3.5" rx="1" fill="#64748b" ${O}/>
      <rect x="13" y="11" width="7.5" height="3" rx="1" fill="#475569" ${O}/>
      <circle cx="10.5" cy="11" r="5" fill="#334155" ${O}/>
      <circle cx="10.5" cy="11" r="2.2" fill="#ef4444" ${O}/>
      <ellipse cx="9" cy="8.5" rx="2" ry="1" ${HI}/>
    `,
    platform: `
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#b45309" ${O}/>
      <line x1="3" y1="7.5" x2="21" y2="7.5" ${O}/>
      <line x1="3" y1="12" x2="21" y2="12" ${O}/>
      <line x1="3" y1="16.5" x2="21" y2="16.5" ${O}/>
      <rect x="3" y="3" width="4" height="4" rx="1" fill="#64748b" ${O}/>
      <rect x="17" y="3" width="4" height="4" rx="1" fill="#64748b" ${O}/>
      <rect x="3" y="17" width="4" height="4" rx="1" fill="#64748b" ${O}/>
      <rect x="17" y="17" width="4" height="4" rx="1" fill="#64748b" ${O}/>
    `,
    channel: `
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#64748b" ${O}/>
      <rect x="6.5" y="3" width="11" height="18" fill="#0284c7" ${O}/>
      <path d="M9.5 7c1-1 2 1 3 0M9.5 12c1-1 2 1 3 0M9.5 17c1-1 2 1 3 0" stroke="#bae6fd" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    `,
    well: `
      <circle cx="12" cy="12.5" r="8.5" fill="#64748b" ${O}/>
      <circle cx="12" cy="12.5" r="5.2" fill="#0284c7" ${O}/>
      <ellipse cx="10.5" cy="11" rx="2" ry="1.2" ${HI}/>
      <rect x="3" y="10.5" width="3" height="4" rx="1" fill="#78350f" ${O}/>
      <rect x="18" y="10.5" width="3" height="4" rx="1" fill="#78350f" ${O}/>
      <line x1="5" y1="12.5" x2="19" y2="12.5" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="10.5" y="10.5" width="3" height="4" rx="0.8" fill="#d97706" ${O}/>
    `,
    purifier: `
      <rect x="2" y="10" width="20" height="4" rx="1" fill="#475569" ${O}/>
      <rect x="5" y="4" width="14" height="16" rx="3" fill="#64748b" ${O}/>
      <circle cx="12" cy="12" r="4.5" fill="#38bdf8" ${O}/>
      <circle cx="10.8" cy="10.5" r="1.2" fill="#e0f2fe" ${N}/>
      <circle cx="13.2" cy="13.2" r="0.9" fill="#e0f2fe" ${N}/>
      <circle cx="8" cy="6.8" r="1.3" fill="#22c55e" ${O}/>
    `,
    plot: `
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#92400e" ${O}/>
      <rect x="5.5" y="5.5" width="13" height="13" rx="1" fill="#451a03" ${O}/>
      <line x1="7.5" y1="8.5" x2="16.5" y2="8.5" stroke="#271202" stroke-width="2" stroke-linecap="round"/>
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="#271202" stroke-width="2" stroke-linecap="round"/>
      <line x1="7.5" y1="15.5" x2="16.5" y2="15.5" stroke="#271202" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 12c0-2 1.8-3 3-2.5.2 1.5-1 2.8-3 2.5z" fill="#22c55e" ${N}/>
    `,
    wheel: `
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="#111" stroke-width="4.5"/>
      <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="5.3" y1="5.3" x2="18.7" y2="18.7" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="18.7" y1="5.3" x2="5.3" y2="18.7" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="#d97706" stroke-width="2.5"/>
      <circle cx="12" cy="12" r="3" fill="#64748b" ${O}/>
    `,
    wire: `
      <path d="M3 18h6a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h6" fill="none" stroke="#111" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M3 18h6a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h6" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="3.5" fill="#facc15" ${O}/>
      <circle cx="5" cy="18" r="2" fill="#38bdf8" ${O}/>
      <circle cx="19" cy="6" r="2" fill="#38bdf8" ${O}/>
    `,
    sprinkler: `
      <path d="M7 20h10l-1.5-5h-7z" fill="#475569" ${O}/>
      <rect x="10.5" y="10" width="3" height="5" fill="#94a3b8" ${O}/>
      <rect x="5" y="8.5" width="14" height="3" rx="1.5" fill="#e2e8f0" ${O}/>
      <path d="M5 6c-1.5-1.5-2-3 0-3.5M19 6c1.5-1.5 2-3 0-3.5M12 5V2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    `,
    fence: `
      <line x1="2" y1="9" x2="22" y2="9" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <line x1="2" y1="15" x2="22" y2="15" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <rect x="5" y="4" width="3.5" height="16" rx="1" fill="#64748b" ${O}/>
      <rect x="15.5" y="4" width="3.5" height="16" rx="1" fill="#64748b" ${O}/>
      <polygon points="13 6 10 12 12.5 12 11 18 15 11 12.5 11" fill="#facc15" ${O}/>
    `,

    // ========================================================================
    // 3. POVOLÁNÍ / KITS (8)
    // ========================================================================
    kit_warrior: `
      <line x1="4" y1="20" x2="19" y2="5" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
      <line x1="4" y1="20" x2="19" y2="5" ${O}/>
      <path d="M6 5h11v7c0 5-5.5 8.5-5.5 8.5S6 17 6 12V5z" fill="#ef4444" ${O}/>
      <path d="M8.5 7.5h6v4c0 2.8-3 5-3 5s-3-2.2-3-5v-4z" fill="#facc15" ${O}/>
    `,
    kit_archer: `
      <path d="M6 3c9 3.5 9 14.5 0 18" fill="none" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
      <line x1="6" y1="3.5" x2="6" y2="20.5" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="3" y1="12" x2="20" y2="12" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
      <polygon points="21.5 12 17.5 9.5 17.5 14.5" fill="#22c55e" ${O}/>
    `,
    kit_mage: `
      <line x1="5" y1="19" x2="15" y2="9" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 11c-2-3 .5-7.5 4.5-7.5S21 7 18.5 10" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="16.5 3.5 19.5 7 16.5 10.5 13.5 7" fill="#38bdf8" ${O}/>
      <circle cx="16" cy="6.2" r="1" fill="#fff" ${N}/>
    `,
    kit_militant: `
      <path d="M3.5 14C3.5 8 7 4.5 12 4.5S20.5 8 20.5 14l1.5 2.5H2L3.5 14z" fill="#4d7c0f" ${O}/>
      <ellipse cx="9.5" cy="8.5" rx="3.5" ry="1.8" transform="rotate(-20 9.5 8.5)" ${HI}/>
      <rect x="4" y="11.5" width="16" height="2.8" rx="1" fill="#365314" ${O}/>
      <polygon points="12 6.5 12.8 8.2 14.5 8.4 13.2 9.6 13.5 11.2 12 10.4 10.5 11.2 10.8 9.6 9.5 8.4 11.2 8.2" fill="#facc15" ${N}/>
    `,
    kit_tank: `
      <polygon points="6 3 18 3 20 8 18 17 12 21.5 6 17 4 8" fill="#64748b" ${O}/>
      <polygon points="8 6 16 6 17 9.5 15.5 15.5 12 18.5 8.5 15.5 7 9.5" fill="#94a3b8" ${O}/>
      <rect x="11" y="7" width="2" height="9" fill="#38bdf8" ${N}/>
      <rect x="8.5" y="10" width="7" height="2" fill="#38bdf8" ${N}/>
    `,
    kit_rogue: `
      <path d="M12 2.5C7 2.5 4 7 4 13l3 5.5h10l3-5.5c0-6-3-10.5-8-10.5z" fill="#374151" ${O}/>
      <path d="M7.5 11.5c0-3 2-5.5 4.5-5.5s4.5 2.5 4.5 5.5l-1.5 5h-6z" fill="#111827" ${O}/>
      <circle cx="10" cy="12" r="1.2" fill="#ec4899" ${N}/>
      <circle cx="14" cy="12" r="1.2" fill="#ec4899" ${N}/>
      <polygon points="4 20 19 16 20 18.5 4 21.5" fill="#e2e8f0" ${O}/>
    `,
    kit_engineer: `
      <circle cx="11" cy="12" r="6.5" fill="#f59e0b" ${O}/>
      <circle cx="11" cy="12" r="2.8" fill="#1e293b" ${O}/>
      <path d="M16 4a3.5 3.5 0 0 0-3 5.2L5 17.2a1.8 1.8 0 0 0 2.5 2.5l8-8A3.5 3.5 0 0 0 20 7.5l-2.2 1.2-1.5-1.5L17.5 5z" fill="#cbd5e1" ${O}/>
    `,
    kit_priest: `
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#facc15" stroke-width="2.5"/>
      <polygon points="10 3 14 3 13.5 9.5 20 9 20 15 13.5 14.5 14 21 10 21 10.5 14.5 4 15 4 9 10.5 9.5" fill="#fef08a" ${O}/>
      <circle cx="12" cy="12" r="2.2" fill="#38bdf8" ${O}/>
    `,

    // ========================================================================
    // 4. ZBRANĚ (10)
    // ========================================================================
    w_pistol: `
      <path d="M3 7h15a1.5 1.5 0 0 1 1.5 1.5v3.5H11l-2 7H4.5l1.5-7H3z" fill="#64748b" ${O}/>
      <rect x="4" y="8" width="12" height="1.5" ${HI}/>
      <path d="M5 13.5h3.5l-1.2 5H4z" fill="#78350f" ${O}/>
    `,
    w_shotgun: `
      <path d="M2.5 15l4-3.5 1.5 2-3.5 4.5z" fill="#92400e" ${O}/>
      <line x1="7" y1="12" x2="21" y2="5" stroke="#475569" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="7" y1="12" x2="21" y2="5" ${O}/>
      <rect x="11" y="9" width="6" height="2.8" rx="1" transform="rotate(-26.5 14 10.4)" fill="#b45309" ${O}/>
    `,
    w_rifle: `
      <polygon points="2 15 7 11.5 8 14 3.5 18" fill="#334155" ${O}/>
      <rect x="7" y="9.5" width="9" height="3.8" rx="1" transform="rotate(-22 11.5 11.4)" fill="#475569" ${O}/>
      <line x1="14" y1="9" x2="21.5" y2="6" stroke="#1e293b" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M11 12.5l1.5 5 2.5-.8-1.5-5z" fill="#f59e0b" ${O}/>
    `,
    w_bow: `
      <path d="M6 3c9.5 3.5 9.5 14.5 0 18" fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
      <line x1="6" y1="3.5" x2="6" y2="20.5" stroke="#e2e8f0" stroke-width="1.5"/>
      <line x1="4" y1="12" x2="19.5" y2="12" stroke="#d97706" stroke-width="2"/>
      <polygon points="21.5 12 17.5 9.5 17.5 14.5" fill="#94a3b8" ${O}/>
    `,
    w_sword: `
      <polygon points="19.5 3.5 20.5 4.5 18.5 9 9.5 18 6 14.5 15 5.5" fill="#e2e8f0" ${O}/>
      <line x1="19" y1="5" x2="9" y2="15" stroke="#94a3b8" stroke-width="1.5"/>
      <polygon points="4.5 12.5 11.5 19.5 9.8 21 3 14.2" fill="#f59e0b" ${O}/>
      <line x1="6" y1="18" x2="3.5" y2="20.5" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
    `,
    w_dagger: `
      <polygon points="18.5 5.5 16 11.5 10.5 17 7 13.5 12.5 8" fill="#cbd5e1" ${O}/>
      <rect x="5.5" y="13.5" width="7" height="2.2" rx="1" transform="rotate(45 9 14.6)" fill="#eab308" ${O}/>
      <line x1="6.8" y1="17.2" x2="4" y2="20" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
    `,
    w_hammer: `
      <line x1="4" y1="20" x2="15" y2="9" stroke="#92400e" stroke-width="3.2" stroke-linecap="round"/>
      <rect x="10.5" y="3.5" width="10" height="6.5" rx="1.5" transform="rotate(45 15.5 6.7)" fill="#64748b" ${O}/>
      <rect x="12" y="4.5" width="7" height="2" rx="0.5" transform="rotate(45 15.5 5.5)" ${HI}/>
    `,
    w_staff: `
      <line x1="4" y1="20" x2="15.5" y2="8.5" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
      <circle cx="17" cy="7" r="4" fill="#38bdf8" ${O}/>
      <circle cx="15.8" cy="5.8" r="1.5" fill="#e0f2fe" ${N}/>
      <path d="M13 8.5c-1-3 1-6.5 4.5-6.5s5 3.5 2 6.5" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round"/>
    `,
    w_wrench: `
      <path d="M15.5 3.5a4.5 4.5 0 0 0-3.8 6.8L4.2 17.8a2.2 2.2 0 0 0 3.1 3.1l7.5-7.5a4.5 4.5 0 0 0 6.7-4.2l-2.8 1.5-2-2 1.5-2.8a4.4 4.4 0 0 0-2.7-2.4z" fill="#94a3b8" ${O}/>
    `,
    w_mace: `
      <line x1="4" y1="20" x2="14" y2="10" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
      <circle cx="16" cy="8" r="4.5" fill="#facc15" ${O}/>
      <polygon points="16 1.5 14.8 4 17.2 4" fill="#eab308" ${O}/>
      <polygon points="22.5 8 20 6.8 20 9.2" fill="#eab308" ${O}/>
      <polygon points="19.5 3.5 17.5 4.8 18.8 6" fill="#eab308" ${O}/>
      <circle cx="14.8" cy="6.8" r="1.5" ${HI}/>
    `,

    // ========================================================================
    // 5. SCHOPNOSTI Q/E (17)
    // ========================================================================
    slash: `
      <path d="M3 19C6 9 12 4 21 3c-3 6-8 12-18 16z" fill="#38bdf8" ${O}/>
      <path d="M6 16.5C8.5 10 13 6.5 19.5 5c-2.5 4.5-6.5 9-13.5 11.5z" fill="#e0f2fe" ${N}/>
    `,
    rage: `
      <path d="M12 2.5c2 3.5 5 5.5 5 10 0 4.5-3.2 8.5-7.5 8.5S2.5 17.5 4 12.5c1 1.5 2.5 2 3 0 .5-2.5 2.5-6.5 5-10z" fill="#ef4444" ${O}/>
      <polygon points="5.5 11 10.5 13.5 6.5 15" fill="#fef08a" ${O}/>
      <polygon points="18.5 11 13.5 13.5 17.5 15" fill="#fef08a" ${O}/>
    `,
    multishot: `
      <line x1="4" y1="18" x2="18" y2="5" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="20 3.5 15.5 5 18 7.5" fill="#facc15" ${O}/>
      <line x1="4" y1="18" x2="20" y2="12" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="22 11.2 17.5 10.5 18.5 14" fill="#facc15" ${O}/>
      <line x1="4" y1="18" x2="18" y2="19" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="20.5 19.2 16.5 17 16.5 21" fill="#facc15" ${O}/>
    `,
    dodge: `
      <line x1="2.5" y1="9" x2="9" y2="9" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="1.5" y1="13.5" x2="8" y2="13.5" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 5l2.5 4 5.5 6.5-2.5 3.5-8.5-3.5L12 5z" fill="#38bdf8" ${O}/>
      <path d="M8.5 14.5l1.5-3.5 3.5 1.5" fill="none" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round"/>
    `,
    fireball: `
      <path d="M3 4l8 3-4 4L3 4zM2.5 10l6 1-2 4-4-5z" fill="#f97316" ${N}/>
      <path d="M6 6c4.5-3 12-1.5 14.5 3.5a6.5 6.5 0 0 1-9 9C6.5 16 4 10 6 6z" fill="#ea580c" ${O}/>
      <circle cx="14.5" cy="13.5" r="4.2" fill="#facc15" ${O}/>
      <circle cx="14.8" cy="13.8" r="2" fill="#fef08a" ${N}/>
    `,
    blink: `
      <ellipse cx="12" cy="12" rx="6.5" ry="9" fill="#a855f7" ${O}/>
      <ellipse cx="12" cy="12" rx="3.5" ry="5.5" fill="#3b0764" ${O}/>
      <polygon points="12 6 13.5 10.5 18 12 13.5 13.5 12 18 10.5 13.5 6 12 10.5 10.5" fill="#e9d5ff" ${N}/>
    `,
    nova: `
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 2"/>
      <polygon points="12 2.5 14.5 9.5 21.5 12 14.5 14.5 12 21.5 9.5 14.5 2.5 12 9.5 9.5" fill="#38bdf8" ${O}/>
      <circle cx="12" cy="12" r="3" fill="#e0f2fe" ${N}/>
    `,
    grenade: `
      <rect x="9.5" y="3" width="5" height="3.5" rx="1" fill="#64748b" ${O}/>
      <path d="M14.5 4.5h3.5l1 4.5" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="8" cy="5" r="2" fill="none" stroke="#facc15" stroke-width="1.8"/>
      <ellipse cx="12" cy="13.5" rx="6.5" ry="7.5" fill="#4d7c0f" ${O}/>
      <line x1="6" y1="11.5" x2="18" y2="11.5" ${O}/>
      <line x1="6" y1="15.5" x2="18" y2="15.5" ${O}/>
      <line x1="12" y1="6.5" x2="12" y2="20.5" ${O}/>
    `,
    suppression: `
      <circle cx="12" cy="12" r="8" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444" stroke-width="2"/>
      <circle cx="12" cy="12" r="8" fill="none" ${O}/>
      <circle cx="12" cy="12" r="2.5" fill="#ef4444" ${O}/>
      <line x1="12" y1="1.5" x2="12" y2="6.5" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="12" y1="17.5" x2="12" y2="22.5" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="1.5" y1="12" x2="6.5" y2="12" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="17.5" y1="12" x2="22.5" y2="12" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/>
    `,
    taunt: `
      <path d="M4 9.5l9-5v15l-9-5z" fill="#ef4444" ${O}/>
      <rect x="2.5" y="9" width="3" height="6" rx="1" fill="#facc15" ${O}/>
      <path d="M16 8.5c2 1.8 2 5.2 0 7M19 6c3 3.2 3 8.8 0 12" fill="none" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
    `,
    fortify: `
      <path d="M4.5 4.5h15v8c0 5.5-7.5 9-7.5 9s-7.5-3.5-7.5-9v-8z" fill="#3b82f6" ${O}/>
      <path d="M7 7h10v5c0 3.5-5 6-5 6s-5-2.5-5-6V7z" fill="#60a5fa" ${O}/>
      <polyline points="9 12.5 12 9.5 15 12.5" fill="none" stroke="#fef08a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    stealth: `
      <path d="M2.5 12S6.5 6 12 6s9.5 6 9.5 6-4 6-9.5 6-9.5-6-9.5-6z" fill="#475569" ${O}/>
      <circle cx="12" cy="12" r="3.5" fill="#a855f7" ${O}/>
      <line x1="4" y1="20" x2="20" y2="4" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round"/>
    `,
    backstab: `
      <polygon points="12 15 9 4 15 4" fill="#e2e8f0" ${O}/>
      <rect x="8.5" y="2.5" width="7" height="2" rx="1" fill="#f59e0b" ${O}/>
      <path d="M12 21c-2.5 0-4.5-2-4.5-4.5 0-2 2.5-4.5 4.5-6.5 2 2 4.5 4.5 4.5 6.5 0 2.5-2 4.5-4.5 4.5z" fill="#dc2626" ${O}/>
    `,
    deploy: `
      <path d="M6 20l2-4.5h8l2 4.5z" fill="#64748b" ${O}/>
      <circle cx="12" cy="13" r="4" fill="#f59e0b" ${O}/>
      <rect x="14" y="11.5" width="6.5" height="3" rx="1" fill="#475569" ${O}/>
      <path d="M7 3v5M4.5 5.5h5" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"/>
    `,
    repair: `
      <path d="M15.5 4a4 4 0 0 0-3.5 6L5 17a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0 5.7-4.5l-2.2 1.2-1.6-1.6 1.2-2.2A4 4 0 0 0 15.5 4z" fill="#94a3b8" ${O}/>
      <path d="M4.5 4.5l3 3M7.5 4.5l-3 3" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="18 15 19 17.5 21.5 18.5 19 19.5 18 22 17 19.5 14.5 18.5 17 17.5" fill="#22c55e" ${N}/>
    `,
    heal: `
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#22c55e" ${O}/>
      <path d="M10 6.5h4v3.5h3.5v4H14v3.5h-4V14H6.5v-4H10z" fill="#ffffff" ${O}/>
    `,
    bless: `
      <polygon points="12 2 14.8 8.5 21.5 9.2 16.5 13.8 18 20.5 12 17 6 20.5 7.5 13.8 2.5 9.2 9.2 8.5" fill="#facc15" ${O}/>
      <circle cx="12" cy="12" r="4" fill="#fef08a" ${O}/>
    `,

    // ========================================================================
    // 6. ULTIMÁTKY R (16)
    // ========================================================================
    ult_war_a: `
      <path d="M12 1.5C7 5 3.5 9 4 14.5 4.5 19.5 8 22 12 22s7.5-2.5 8-7.5C20.5 9 17 5 12 1.5z" fill="#ea580c" ${O}/>
      <path d="M7 13a5 5 0 1 1 10 0c0 2-1 3.2-2 4v2.5H9V17c-1-.8-2-2-2-4z" fill="#fef08a" ${O}/>
      <circle cx="10" cy="13" r="1.5" fill="#dc2626" ${N}/>
      <circle cx="14" cy="13" r="1.5" fill="#dc2626" ${N}/>
    `,
    ult_war_b: `
      <polygon points="8 3 16 3 18 8 15.5 13 20.5 16 19 21 5 21 3.5 16 8.5 13 6 8" fill="#94a3b8" ${O}/>
      <polygon points="9 5 15 5 16 8 12 11 8 8" ${HI}/>
      <rect x="8.5" y="7" width="7" height="2" rx="1" fill="#38bdf8" ${N}/>
    `,
    ult_arc_a: `
      <line x1="6" y1="3" x2="6" y2="17" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="6 20.5 3.5 16 8.5 16" fill="#22c55e" ${O}/>
      <line x1="12" y1="2" x2="12" y2="18" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="12 21.5 9.5 17 14.5 17" fill="#4ade80" ${O}/>
      <line x1="18" y1="3" x2="18" y2="17" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="18 20.5 15.5 16 20.5 16" fill="#22c55e" ${O}/>
    `,
    ult_arc_b: `
      <path d="M4 17c2-7 10-9 16-4-4-8-14-7-17 2z" fill="#a855f7" ${O}/>
      <polygon points="11 6 15 11 19.5 9.5 17 16 9 14.5" fill="#22c55e" ${O}/>
    `,
    ult_mag_a: `
      <polygon points="14 2 22 2 18 11 22 9 15 17 6 12 13 5" fill="#f97316" ${O}/>
      <circle cx="9.5" cy="14.5" r="6" fill="#991b1b" ${O}/>
      <circle cx="8" cy="13" r="2" fill="#facc15" ${N}/>
      <circle cx="11.5" cy="16" r="1.5" fill="#facc15" ${N}/>
    `,
    ult_mag_b: `
      <circle cx="12" cy="12" r="8.5" fill="#0ea5e9" ${O}/>
      <circle cx="12" cy="12" r="6" fill="#e0f2fe" ${O}/>
      <polyline points="12 8.5 12 12 14.5 13.5" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="12 1 13.5 4 10.5 4" fill="#38bdf8" ${O}/>
      <polygon points="12 23 13.5 20 10.5 20" fill="#38bdf8" ${O}/>
    `,
    ult_mil_a: `
      <path d="M5 19L19 5" stroke="#4d7c0f" stroke-width="5" stroke-linecap="round"/>
      <polygon points="21.5 2.5 15.5 4.5 19.5 8.5" fill="#ef4444" ${O}/>
      <polygon points="3 21 5 15.5 8.5 19" fill="#facc15" ${O}/>
    `,
    ult_mil_b: `
      <polygon points="12 2 14.5 8 21.5 12 14.5 14 14 19 17 21.5 7 21.5 10 19 9.5 14 2.5 12 9.5 8" fill="#64748b" ${O}/>
      <ellipse cx="12" cy="8.5" rx="1.2" ry="2.5" fill="#38bdf8" ${N}/>
    `,
    ult_tan_a: `
      <path d="M4 4h16v8.5C20 18 12 22 12 22S4 18 4 12.5V4z" fill="#facc15" ${O}/>
      <polygon points="12 6.5 16.5 12 12 17.5 7.5 12" fill="#38bdf8" ${O}/>
      <polygon points="12 6.5 14.5 12 12 12" ${HI}/>
    `,
    ult_tan_b: `
      <ellipse cx="12" cy="17.5" rx="8.5" ry="3.5" fill="#38bdf8" fill-opacity="0.35" stroke="#38bdf8" stroke-width="1.8"/>
      <polygon points="13.5 2 6.5 12 12 12 9.5 20.5 18 10 12.5 10" fill="#facc15" ${O}/>
    `,
    ult_rog_a: `
      <path d="M2 18c0-4 2.5-6.5 5.5-6.5S13 14 13 18z" fill="#4b5563" ${O}/>
      <circle cx="7.5" cy="8.5" r="3" fill="#4b5563" ${O}/>
      <path d="M11 18c0-4 2.5-6.5 5.5-6.5S22 14 22 18z" fill="#4b5563" ${O}/>
      <circle cx="16.5" cy="8.5" r="3" fill="#4b5563" ${O}/>
      <path d="M6 20c0-4.5 2.5-7.5 6-7.5s6 3 6 7.5z" fill="#1f2937" ${O}/>
      <circle cx="12" cy="9" r="3.5" fill="#1f2937" ${O}/>
      <circle cx="10.8" cy="9" r="0.9" fill="#ec4899" ${N}/>
      <circle cx="13.2" cy="9" r="0.9" fill="#ec4899" ${N}/>
    `,
    ult_rog_b: `
      <path d="M5 18h14a4 4 0 0 0 .5-7.9A5.5 5.5 0 0 0 9 7.5a4.5 4.5 0 0 0-4 10.5z" fill="#84cc16" ${O}/>
      <circle cx="12" cy="13" r="3.5" fill="#1a2e05" ${N}/>
      <circle cx="10.8" cy="12.5" r="1" fill="#bef264" ${N}/>
      <circle cx="13.2" cy="12.5" r="1" fill="#bef264" ${N}/>
    `,
    ult_eng_a: `
      <line x1="12" y1="2" x2="12" y2="5.5" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="2" r="1.5" fill="#ef4444" ${N}/>
      <rect x="4.5" y="5.5" width="15" height="14" rx="3" fill="#64748b" ${O}/>
      <rect x="7" y="9" width="10" height="4" rx="1.5" fill="#0ea5e9" ${O}/>
      <line x1="9" y1="16.5" x2="15" y2="16.5" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
    `,
    ult_eng_b: `
      <path d="M4 10c0-4.5 3.6-7.5 8-7.5s8 3 8 7.5H4z" fill="#38bdf8" ${O}/>
      <line x1="5.5" y1="10" x2="9" y2="14.5" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="18.5" y1="10" x2="15" y2="14.5" stroke="#cbd5e1" stroke-width="1.5"/>
      <rect x="7.5" y="14" width="9" height="7.5" rx="1.5" fill="#d97706" ${O}/>
      <line x1="7.5" y1="17.8" x2="16.5" y2="17.8" ${O}/>
    `,
    ult_pri_a: `
      <polygon points="5 2.5 19 2.5 22 21.5 2 21.5" fill="#fef08a" fill-opacity="0.35" stroke="none"/>
      <polygon points="10.5 3 13.5 3 13.5 8 18 8 18 11 13.5 11 13.5 20.5 10.5 20.5 10.5 11 6 11 6 8 10.5 8" fill="#facc15" ${O}/>
    `,
    ult_pri_b: `
      <circle cx="12" cy="12" r="9" fill="#fef08a" fill-opacity="0.25" stroke="#facc15" stroke-width="1.8"/>
      <path d="M12 18s-5.5-3.5-5.5-7.5A3.3 3.3 0 0 1 12 8a3.3 3.3 0 0 1 5.5 2.5C17.5 14.5 12 18 12 18z" fill="#facc15" ${O}/>
    `,

    // ========================================================================
    // 7. OBCHOD A STATY (9)
    // ========================================================================
    snack: `
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" fill="#92400e" ${O}/>
      <line x1="9.5" y1="3.5" x2="9.5" y2="11" ${O}/>
      <line x1="14.5" y1="3.5" x2="14.5" y2="11" ${O}/>
      <line x1="4.5" y1="8" x2="19.5" y2="8" ${O}/>
      <path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" fill="#ef4444" ${O}/>
      <rect x="6.5" y="13.5" width="11" height="3" rx="1" fill="#fef08a" ${N}/>
    `,
    bottle: `
      <rect x="9.5" y="2.5" width="5" height="3" rx="1" fill="#2563eb" ${O}/>
      <path d="M9 5.5h6l2.5 4v10a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-10z" fill="#38bdf8" ${O}/>
      <rect x="6.5" y="12" width="11" height="4" fill="#e0f2fe" ${O}/>
      <line x1="8.5" y1="9" x2="8.5" y2="19" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.5"/>
    `,
    maxhp: `
      <path d="M12 21s-8-5.2-8-11.2A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8 3.5C20 15.8 12 21 12 21z" fill="#ef4444" ${O}/>
      <path d="M10.5 9.5h3v2.5H16v3h-2.5v2.5h-3V15H8v-3h2.5z" fill="#4ade80" ${O}/>
    `,
    str: `
      <path d="M6 14c-1-3 1-7 4-7 1.5 0 2.5 1.5 2 3l1.5 1.5c2-1.5 5-.5 5.5 2.5.5 3.5-2.5 6.5-7 6.5S4.5 18 6 14z" fill="#f97316" ${O}/>
      <path d="M8 7c1.5-2 4-2 4.5 0" fill="none" ${O}/>
      <ellipse cx="14" cy="14.5" rx="2.5" ry="1.5" ${HI}/>
    `,
    vit: `
      <path d="M12 1.5c2.5 3 5.5 5.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.5 1.5-5 5.5-9.5z" fill="#facc15" ${O}/>
      <path d="M12 21.5s-6.5-4.2-6.5-9A3.8 3.8 0 0 1 12 9.8a3.8 3.8 0 0 1 6.5 2.7c0 4.8-6.5 9-6.5 9z" fill="#ef4444" ${O}/>
    `,
    agi: `
      <path d="M7 13h7c2.5 0 5-2 6-5-2.5 0-4.5 1-6 2.5V6L9 6 6.5 14H4l1.5 5.5h13a2 2 0 0 0 2-2v-1.5H9.5z" fill="#38bdf8" ${O}/>
      <polygon points="13 9.5 19.5 5.5 16.5 11.5" fill="#fef08a" ${O}/>
    `,
    int: `
      <path d="M12 5a4.5 4.5 0 0 0-7.5 3.5A4 4 0 0 0 5 16a4 4 0 0 0 7 2.5V5z" fill="#f472b6" ${O}/>
      <path d="M12 5a4.5 4.5 0 0 1 7.5 3.5A4 4 0 0 1 19 16a4 4 0 0 1-7 2.5V5z" fill="#ec4899" ${O}/>
      <path d="M8.5 9.5c1 0 1.5 1 1.5 2M15.5 9.5c-1 0-1.5 1-1.5 2M8.5 14.5c1.2 0 2-.8 2-1.8M15.5 14.5c-1.2 0-2-.8-2-1.8" fill="none" stroke="#111" stroke-width="1.3" stroke-linecap="round"/>
    `,
    int2: `
      <path d="M6.5 18.5h11l1.5 2.5H5z" fill="#eab308" ${O}/>
      <circle cx="12" cy="11" r="7.5" fill="#a855f7" ${O}/>
      <ellipse cx="9.2" cy="7.8" rx="3" ry="1.6" transform="rotate(-30 9.2 7.8)" ${HI}/>
      <polygon points="12 6.5 13.2 9.8 16.5 11 13.2 12.2 12 15.5 10.8 12.2 7.5 11 10.8 9.8" fill="#e9d5ff" ${N}/>
    `,
    per: `
      <path d="M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12z" fill="#f8fafc" ${O}/>
      <circle cx="12" cy="12" r="4.5" fill="#0ea5e9" ${O}/>
      <circle cx="12" cy="12" r="2" fill="#111" ${N}/>
      <circle cx="10.5" cy="10.5" r="1.2" fill="#fff" ${N}/>
    `,

    // ========================================================================
    // 8. ÚRODA (6)
    // ========================================================================
    crop_carrot: `
      <path d="M15 9c1-3.5 3.5-5.5 5.5-5-1 2.5-2 4.5-4 6.5M14 8c0-3 1.5-5.5 3-6M16 10c3 0 5-1.5 5.5-3" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12.5 6.5c2.5 0 5 2.5 5 5C17.5 15 7.5 21 5 20s5-13.5 7.5-13.5z" fill="#f97316" ${O}/>
      <line x1="10.5" y1="10.5" x2="13" y2="12" ${O}/>
      <line x1="8" y1="14" x2="10.5" y2="15.5" ${O}/>
    `,
    crop_wheat: `
      <line x1="5" y1="20" x2="18" y2="7" stroke="#eab308" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="11" cy="11" rx="2" ry="3.5" transform="rotate(-15 11 11)" fill="#facc15" ${O}/>
      <ellipse cx="14" cy="14" rx="3.5" ry="2" transform="rotate(15 14 14)" fill="#facc15" ${O}/>
      <ellipse cx="14.5" cy="7.5" rx="2" ry="3.5" transform="rotate(-15 14.5 7.5)" fill="#facc15" ${O}/>
      <ellipse cx="17.5" cy="10.5" rx="3.5" ry="2" transform="rotate(15 17.5 10.5)" fill="#facc15" ${O}/>
      <ellipse cx="18.5" cy="5.5" rx="2.2" ry="3.2" transform="rotate(45 18.5 5.5)" fill="#fef08a" ${O}/>
    `,
    crop_tomato: `
      <circle cx="12" cy="13" r="7.5" fill="#ef4444" ${O}/>
      <ellipse cx="9" cy="10.5" rx="2.5" ry="1.3" transform="rotate(-30 9 10.5)" ${HI}/>
      <polygon points="12 3.5 13.5 6.8 17 6 14 8.5 15.5 11 12 9 8.5 11 10 8.5 7 6 10.5 6.8" fill="#22c55e" ${O}/>
    `,
    crop_pumpkin: `
      <path d="M11 6c0-2.5 1.5-3.5 3-3.5" fill="none" stroke="#15803d" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="7.5" cy="13.5" rx="4.5" ry="6.5" fill="#ea580c" ${O}/>
      <ellipse cx="16.5" cy="13.5" rx="4.5" ry="6.5" fill="#ea580c" ${O}/>
      <ellipse cx="12" cy="13.5" rx="5" ry="7" fill="#f97316" ${O}/>
      <ellipse cx="10.5" cy="10" rx="1.8" ry="2.8" ${HI}/>
    `,
    crop_melon: `
      <ellipse cx="12" cy="12.5" rx="8.5" ry="7" transform="rotate(-20 12 12.5)" fill="#22c55e" ${O}/>
      <path d="M6 10c3-1.5 7-1.5 11 0M5 13.5c4-1.5 9-1.5 14 0M7 17c3.5-1 7-1 10.5 0" fill="none" stroke="#14532d" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="9" cy="9.5" rx="2.8" ry="1.2" transform="rotate(-25 9 9.5)" ${HI}/>
    `,
    seed: `
      <path d="M6 7l1.5-3.5h9L18 7v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z" fill="#d97706" ${O}/>
      <line x1="6" y1="7" x2="18" y2="7" ${O}/>
      <circle cx="12" cy="13.5" r="4" fill="#fef08a" ${O}/>
      <path d="M12 15.5v-3c0-1.5 1.5-2 2.5-1.5 0 1.2-.8 2.2-2.5 2" fill="#22c55e" stroke="#15803d" stroke-width="1.2" stroke-linecap="round"/>
    `,

    // ========================================================================
    // 9. OSTATNÍ (4)
    // ========================================================================
    lock: `
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" fill="none" ${O}/>
      <rect x="5" y="10.5" width="14" height="10.5" rx="2.5" fill="#facc15" ${O}/>
      <circle cx="12" cy="15" r="1.6" fill="#111" ${N}/>
      <line x1="12" y1="16" x2="12" y2="18.5" stroke="#111" stroke-width="2" stroke-linecap="round"/>
    `,
    cooldown: `
      <circle cx="12" cy="12" r="9" fill="#1e293b" ${O}/>
      <path d="M12 12V3a9 9 0 0 1 8.5 12L12 12z" fill="#38bdf8" ${O}/>
      <circle cx="12" cy="12" r="2" fill="#f8fafc" ${O}/>
    `,
    power: `
      <polygon points="13.5 2 5 13.5 11.5 13.5 9.5 22 19 10.5 12.5 10.5" fill="#facc15" ${O}/>
      <polygon points="13 4.5 7.5 12 11.5 12" ${HI}/>
    `,
    warning: `
      <polygon points="12 2.5 22 20.5 2 20.5" fill="#facc15" ${O}/>
      <line x1="12" y1="8.5" x2="12" y2="14" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="12" cy="17.5" r="1.4" fill="#111" ${N}/>
    `
  };

  // Odstraní přebytečné mezery pro kompaktní výstup
  Object.keys(ICONS).forEach((k) => {
    ICONS[k] = ICONS[k].replace(/\s+/g, ' ').trim();
  });

  const ALL_NAMES = Object.keys(ICONS);

  // Aktivní dovednosti stromu a ultimátka větve C nemají vlastní kresbu: vyvolané věci (past, vlk, prapor…)
  // se nakreslí herním spritem ZS.summon, ostatní si půjčí příbuznou ikonu.
  const SUMI = { arc_c1: 'trap', arc_c3: 'lure', arc_c2: 'wolf', ult_arc_c: 'wolf', war_c3: 'banner', mil_c2: 'c4', eng_c1: 'acid_pool', ult_eng_c: 'toxic_zone', ult_mag_c: 'ghost_boss' };
  const ALIAS = { war_c1: 'taunt', ult_war_c: 'fortify', mag_c3: 'ult_rog_b', mil_c1: 'grenade', rog_c3: 'coins', eng_c3: 'rage', ult_mil_c: 'ult_mil_b', ult_tan_c: 'ult_tan_a', ult_rog_c: 'coins', ult_pri_c: 'ult_pri_a' };
  const sumUrls = new Map();
  function summonImg(name, s) {
    const ZS = global.ZS; if (!ZS || !ZS.summon) return '';
    const res = s > 24 ? 96 : 48, key = name + '_' + res + '_' + (ZS.texOn ? ZS.texOn() : '');
    if (!sumUrls.has(key)) {
      let u = null;
      try { const cv = document.createElement('canvas'); cv.width = cv.height = res; const c = cv.getContext('2d');
        c.scale(res / 24, res / 24); c.translate(12, 12.5); c.scale(0.62, 0.62); ZS.summon(c, SUMI[name], 0, 0, 16, -0.6, 0); u = cv.toDataURL('image/png'); } catch (e) { u = null; }
      sumUrls.set(key, u);
    }
    const u = sumUrls.get(key);
    return u ? `<img src="${u}" width="${s}" height="${s}" alt="" draggable="false">` : '';
  }

  global.ZSI = {
    svg: function (name, size) {
      if (!ICONS[name] && SUMI[name]) return summonImg(name, size === undefined ? 24 : size);
      const body = ICONS[name] || ICONS[ALIAS[name]];
      if (!body) return '';
      const s = size === undefined ? 24 : size;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${body}</svg>`;
    },
    names: function () {
      return ALL_NAMES.slice();
    }
  };
})(window);

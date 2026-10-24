/* banners.js — ilustrované bannery her (SVG scény 400×120) místo velkých emoji, realističtější styl:
 * materiály (papír, dřevo, kov, sklo, plsť, pergamen), zrno, mlha v dálce, rozostřené pozadí, měkké stíny a odlesky.
 * Prvek s data-banner="denni|spojovacka|pravdalez|pexeso|osmismerka|krizovka|sibenice|milionar|dobyvatel|obrana|zombie"
 * se vyplní scénou (karty her na nástěnce, úvod každé hry). SBB.svg(id) vrátí SVG. */
(function () {
  'use strict';
  let uid = 0;
  const nid = p => p + (++uid);
  const stops = s => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const lin = (n, x1, y1, x2, y2, s) => `<linearGradient id="${n}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
  const rad = (n, cx, cy, r, s, fx, fy) => `<radialGradient id="${n}" cx="${cx}" cy="${cy}" r="${r}"${fx != null ? ` fx="${fx}" fy="${fy}"` : ''}>${stops(s)}</radialGradient>`;
  // společné filtry: stín, záře, rozostření, zrno, papír a dřevo
  const defs = (k, extra) => `<defs>
    <filter id="sh${k}" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="3" dy="6"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="shs${k}" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.6"/><feOffset dx="1" dy="2.4"/><feComponentTransfer><feFuncA type="linear" slope=".5"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="gl${k}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="bl${k}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="bl2${k}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="grain${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer></filter>
    <filter id="paper${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" seed="8" result="n"/><feDiffuseLighting in="n" surfaceScale=".45" lighting-color="#fff" result="l"><feDistantLight azimuth="225" elevation="60"/></feDiffuseLighting><feComposite in="l" in2="SourceGraphic" operator="in" result="lt"/><feBlend in="SourceGraphic" in2="lt" mode="multiply"/></filter>
    <filter id="wood${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .32" numOctaves="4" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .42  0 0 0 0 .22  0 0 0 0 .1  0 0 0 1.4 -.2" result="w"/><feComposite in="w" in2="SourceGraphic" operator="in" result="ww"/><feBlend in="ww" in2="SourceGraphic" mode="multiply"/></filter>
    ${extra || ''}</defs>`;
  const grain = k => `<rect width="400" height="120" filter="url(#grain${k})" style="mix-blend-mode:overlay"/>`;
  const vignette = (k, a) => `<radialGradient id="vg${k}" cx=".5" cy=".5" r=".75">${stops([[0.55, '#000', 0], [1, '#000', a || 0.5]])}</radialGradient><rect width="400" height="120" fill="url(#vg${k})"/>`;
  const rnd = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const stars = (n, seed, w, h) => { const R = rnd(seed); let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${(R() * w).toFixed(1)}" cy="${(R() * h).toFixed(1)}" r="${(0.3 + R() * 0.9).toFixed(2)}" fill="#fff" opacity="${(0.2 + R() * 0.7).toFixed(2)}"/>`; return o; };
  const bokeh = (k, n, seed, cols) => { const R = rnd(seed); let o = ''; for (let i = 0; i < n; i++) o += `<circle cx="${(R() * 400).toFixed(0)}" cy="${(R() * 120).toFixed(0)}" r="${(6 + R() * 16).toFixed(0)}" fill="${cols[i % cols.length]}" opacity="${(0.08 + R() * 0.18).toFixed(2)}" filter="url(#bl2${k})"/>`; return o; };
  // pohoří: hřeben se světlou a stinnou stranou
  const ridge = (pts, base, light, dark) => { let d = `M0 ${base}`; pts.forEach(([x, y]) => { d += `L${x} ${y}`; }); d += `L400 ${base}V120H0z`; let sh = ''; for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; if (y2 > y1) sh += `<path d="M${x1} ${y1}L${x2} ${y2}L${x2} 120L${x1 + (x2 - x1) * 0.35} 120z" fill="${dark}" opacity=".55"/>`; } return `<path d="${d}" fill="${light}"/>${sh}`; };

  const B = {
    // Denní výzva: svítání nad horami s mlhou, papírový stolní kalendář s kovovými kroužky
    denni: () => { const k = nid('d');
      return `<svg-content>${defs(k, lin('sky' + k, 0, 0, 0, 1, [[0, '#0f0c29'], [0.35, '#4c1d95'], [0.7, '#db2777'], [0.9, '#fb923c'], [1, '#fed7aa']]) + rad('sun' + k, 0.5, 0.5, 0.5, [[0, '#fffbeb'], [0.18, '#fde68a', 0.95], [0.45, '#fb923c', 0.35], [1, '#f97316', 0]]) + lin('mist' + k, 0, 0, 0, 1, [[0, '#fdba74', 0], [0.5, '#fbcfe8', 0.55], [1, '#fdba74', 0]]) + lin('pg' + k, 0, 0, 0, 1, [[0, '#fffdf7'], [1, '#ece5d8']]) + lin('hd' + k, 0, 0, 0, 1, [[0, '#ef4444'], [1, '#b91c1c']]) + lin('ring' + k, 0, 0, 1, 0, [[0, '#6b7280'], [0.45, '#f3f4f6'], [1, '#4b5563']]))}
        <rect width="400" height="120" fill="url(#sky${k})"/>${stars(60, 7, 400, 50)}
        <circle cx="300" cy="72" r="110" fill="url(#sun${k})"/><circle cx="300" cy="72" r="11" fill="#fffbeb" filter="url(#gl${k})"/>
        ${ridge([[40, 70], [86, 52], [120, 66], [168, 44], [214, 62], [256, 50], [300, 68], [344, 54], [400, 66]], 74, '#7e2b6b', '#4a1442')}
        <rect y="58" width="400" height="34" fill="url(#mist${k})" filter="url(#bl${k})"/>
        ${ridge([[30, 90], [80, 74], [130, 86], [190, 70], [240, 88], [290, 80], [340, 92], [400, 82]], 96, '#3b1450', '#1e0a2e')}
        ${ridge([[60, 104], [120, 96], [180, 106], [250, 98], [320, 108], [400, 100]], 110, '#140a22', '#0a0512')}
        <path d="M300 72L${300 - 240} -20M300 72L${300 - 130} -30M300 72L${300 + 40} -30M300 72L${300 + 120} -10" stroke="#fde68a" stroke-width="22" opacity=".06"/>
        <g filter="url(#sh${k})" transform="translate(146 18) rotate(-4)">
          <path d="M4 82h80l-6 8H10z" fill="#1f2937" opacity=".6"/>
          <rect width="88" height="84" rx="5" fill="url(#pg${k})" filter="url(#paper${k})"/>
          <rect width="88" height="24" rx="5" fill="url(#hd${k})"/><rect y="19" width="88" height="5" fill="url(#hd${k})"/>
          <text x="44" y="17" font-size="9" font-weight="600" text-anchor="middle" fill="#fee2e2" letter-spacing="2" font-family="Geist, system-ui, sans-serif">ŘÍJEN</text>
          ${[22, 44, 66].map(x => `<rect x="${x - 2.5}" y="-6" width="5" height="12" rx="2.5" fill="url(#ring${k})"/>`).join('')}
          <text x="44" y="68" font-size="38" font-weight="700" text-anchor="middle" fill="#1f2937" font-family="Georgia, 'Times New Roman', serif">24</text>
          <path d="M88 66v18h-18z" fill="#d6cfc0"/><path d="M70 84l18-18" stroke="#bfb6a5" stroke-width=".8"/>
        </g>
        ${vignette(k, 0.45)}${grain(k)}</svg-content>`; },

    // Spojovačka: rozostřená světla v pozadí, matné sklo, zářící spojnice, chromové stopky
    spojovacka: () => { const k = nid('s');
      return `<svg-content>${defs(k, lin('bg' + k, 0, 0, 1, 1, [[0, '#04111f'], [0.6, '#0b1324'], [1, '#1a0b2e']]) + lin('gls' + k, 0, 0, 0, 1, [[0, '#ffffff', 0.22], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0.04]]) + lin('l1' + k, 0, 0, 1, 0, [[0, '#22d3ee'], [1, '#818cf8']]) + lin('l2' + k, 0, 0, 1, 0, [[0, '#f0abfc'], [1, '#22d3ee']]) + lin('l3' + k, 0, 0, 1, 0, [[0, '#bef264'], [1, '#f0abfc']]) + lin('chrome' + k, 0, 0, 1, 1, [[0, '#f9fafb'], [0.3, '#9ca3af'], [0.55, '#f3f4f6'], [1, '#4b5563']]) + rad('face' + k, 0.4, 0.35, 0.8, [[0, '#ffffff'], [1, '#d1d5db']]))}
        <rect width="400" height="120" fill="url(#bg${k})"/>
        ${bokeh(k, 16, 13, ['#22d3ee', '#a78bfa', '#f0abfc', '#38bdf8'])}
        ${[[0, 1, 'l1'], [1, 2, 'l2'], [2, 0, 'l3']].map(([a, b, g]) => { const y1 = 30 + a * 30, y2 = 30 + b * 30; return `<path d="M124 ${y1}C174 ${y1} 186 ${y2} 236 ${y2}" fill="none" stroke="url(#${g}${k})" stroke-width="12" opacity=".3" filter="url(#bl${k})"/><path d="M124 ${y1}C174 ${y1} 186 ${y2} 236 ${y2}" fill="none" stroke="url(#${g}${k})" stroke-width="2" stroke-linecap="round"/>`; }).join('')}
        ${[0, 1, 2].map(i => [34, 236].map((x, s) => `<g filter="url(#sh${k})"><rect x="${x}" y="${17 + i * 30}" width="90" height="26" rx="7" fill="url(#gls${k})" stroke="#ffffff" stroke-opacity=".3" stroke-width=".8"/><path d="M${x + 7} ${18 + i * 30}h76" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/><rect x="${x + 10}" y="${27 + i * 30}" width="${s ? 56 - i * 9 : 40 + i * 11}" height="4" rx="2" fill="#e2e8f0" opacity=".55"/><rect x="${x + 10}" y="${34 + i * 30}" width="${s ? 30 : 24}" height="3" rx="1.5" fill="#e2e8f0" opacity=".25"/></g>`).join('')).join('')}
        ${[[124, 30, '#22d3ee'], [236, 60, '#818cf8'], [124, 60, '#f0abfc'], [236, 90, '#22d3ee'], [124, 90, '#bef264'], [236, 30, '#f0abfc']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="8" fill="${c}" opacity=".35" filter="url(#bl2${k})"/><circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`).join('')}
        <g transform="translate(360 64)" filter="url(#sh${k})">
          <rect x="-5" y="-38" width="10" height="9" rx="2" fill="url(#chrome${k})"/><rect x="-9" y="-42" width="18" height="5" rx="2.5" fill="url(#chrome${k})"/>
          <circle r="30" fill="url(#chrome${k})"/><circle r="25" fill="url(#face${k})"/>
          ${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${Math.sin(a) * 21} ${-Math.cos(a) * 21}L${Math.sin(a) * (i % 3 ? 23 : 19)} ${-Math.cos(a) * (i % 3 ? 23 : 19)}" stroke="#374151" stroke-width="${i % 3 ? 0.8 : 1.6}"/>`; }).join('')}
          <path d="M0 0L0 -18" stroke="#111827" stroke-width="1.6" stroke-linecap="round"/><path d="M0 0L11 8" stroke="#dc2626" stroke-width="1.2" stroke-linecap="round"/><circle r="2" fill="#111827"/>
          <path d="M-18 -14A24 24 0 0 1 6 -24" fill="none" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>
        </g>
        ${vignette(k, 0.55)}${grain(k)}</svg-content>`; },

    // Pravda, nebo lež: dvě osvětlené poloviny, vyražené lesklé symboly s hranou a odrazem, světelný šev
    pravdalez: () => { const k = nid('p');
      return `<svg-content>${defs(k, rad('g' + k, 0.25, 0.5, 0.75, [[0, '#22c55e'], [1, '#052e16']]) + rad('r' + k, 0.75, 0.5, 0.75, [[0, '#ef4444'], [1, '#450a0a']]) + lin('chk' + k, 0, 0, 0, 1, [[0, '#f0fdf4'], [0.5, '#bbf7d0'], [1, '#4ade80']]) + lin('crs' + k, 0, 0, 0, 1, [[0, '#fff1f2'], [0.5, '#fecaca'], [1, '#f87171']]) + lin('seam' + k, 0, 0, 0, 1, [[0, '#fff', 0], [0.5, '#fff', 1], [1, '#fff', 0]]) + lin('floor' + k, 0, 0, 0, 1, [[0, '#000', 0], [1, '#000', 0.45]]))}
        <rect width="400" height="120" fill="url(#g${k})"/><path d="M216 0H400V120H184z" fill="url(#r${k})"/>
        ${bokeh(k, 10, 41, ['#bbf7d0', '#fecaca'])}
        <rect y="86" width="400" height="34" fill="url(#floor${k})"/>
        <path d="M216 0 184 120" stroke="url(#seam${k})" stroke-width="14" opacity=".35" filter="url(#bl${k})"/><path d="M216 0 184 120" stroke="url(#seam${k})" stroke-width="1.4"/>
        <g filter="url(#sh${k})">
          <path d="M74 58l18 18 34-38" fill="none" stroke="#14532d" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" transform="translate(1.5 3)"/>
          <path d="M74 58l18 18 34-38" fill="none" stroke="url(#chk${k})" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M77 57l15 15 31-34" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
        </g>
        <g filter="url(#sh${k})">
          <path d="M283 41l34 34M317 41l-34 34" stroke="#7f1d1d" stroke-width="15" stroke-linecap="round" transform="translate(1.5 3)"/>
          <path d="M283 41l34 34M317 41l-34 34" stroke="url(#crs${k})" stroke-width="13" stroke-linecap="round"/>
          <path d="M285 41l30 30M315 41l-30 30" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
        </g>
        <g opacity=".18" transform="translate(0 190) scale(1 -1)"><path d="M74 58l18 18 34-38" fill="none" stroke="#bbf7d0" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" filter="url(#bl2${k})"/><path d="M283 41l34 34M317 41l-34 34" stroke="#fecaca" stroke-width="13" stroke-linecap="round" filter="url(#bl2${k})"/></g>
        ${vignette(k, 0.5)}${grain(k)}</svg-content>`; },

    // Pexeso: dřevěný stůl pod lampou, karty s texturou papíru v perspektivě, otočená dvojice
    pexeso: () => { const k = nid('x');
      let cards = '';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
        const x = 56 + c * 52 + r * 12, y = 34 + r * 42, up = (r === 0 && c === 1) || (r === 1 && c === 4), rot = ((c * 7 + r * 3) % 5 - 2) * 1.4;
        cards += `<g transform="translate(${x} ${y}) rotate(${rot}) skewX(-10)" filter="url(#sh${k})">${up
          ? `<rect x="-19" y="-16" width="38" height="33" rx="4" fill="url(#face${k})" filter="url(#paper${k})"/><circle cy="1" r="15" fill="#fde68a" opacity=".45" filter="url(#bl2${k})"/><path d="M0 -9l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L0 5.6l-5.7 2.9 1.1-6.3-4.6-4.5 6.4-.9z" fill="url(#gold${k})" stroke="#92400e" stroke-width=".6"/>`
          : `<rect x="-19" y="-16" width="38" height="33" rx="4" fill="url(#back${k})"/><rect x="-15" y="-12" width="30" height="25" rx="2.5" fill="none" stroke="#e0e7ff" stroke-opacity=".5" stroke-width=".8"/><path d="M-15 -12l30 25M15 -12l-30 25" stroke="#e0e7ff" stroke-opacity=".18" stroke-width=".8"/><circle r="5" fill="none" stroke="#e0e7ff" stroke-opacity=".5" stroke-width=".8"/><path d="M-19 -16h38" stroke="#fff" stroke-opacity=".35"/>`}</g>`;
      }
      return `<svg-content>${defs(k, lin('wd' + k, 0, 0, 0, 1, [[0, '#6b3a1e'], [1, '#2a140a']]) + rad('lamp' + k, 0.5, 0.3, 0.6, [[0, '#ffd9a0', 0.55], [0.6, '#ffb347', 0.12], [1, '#000', 0]]) + lin('back' + k, 0, 0, 1, 1, [[0, '#4f46e5'], [0.5, '#4338ca'], [1, '#312e81']]) + lin('face' + k, 0, 0, 0, 1, [[0, '#fffbf0'], [1, '#efe6d2']]) + lin('gold' + k, 0, 0, 0, 1, [[0, '#fde68a'], [1, '#d97706']]))}
        <rect width="400" height="120" fill="url(#wd${k})" filter="url(#wood${k})"/>
        <rect width="400" height="120" fill="url(#lamp${k})"/>
        ${cards}
        ${vignette(k, 0.65)}${grain(k)}</svg-content>`; },

    // Osmisměrka: kostičky z kosti na plsti, slovo zvýrazněné fixou, lupa zvětšuje písmena
    osmismerka: () => { const k = nid('o'), L = 'KRVYPOČASÍMENTOLKÓDZÁPISHRAD';
      const tiles = (dx, dy, sc) => { let g = ''; for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) { const x = 40 + c * 30, y = 12 + r * 25, ch = L[(r * 9 + c * 5) % L.length]; g += `<g transform="translate(${x} ${y})"><rect width="26" height="22" rx="3.5" fill="url(#tile${k})" filter="url(#shs${k})"/><path d="M2 1.4h22" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/><text x="13" y="16" font-size="13" font-weight="700" text-anchor="middle" fill="#3f3a33" font-family="Georgia, 'Times New Roman', serif">${ch}</text></g>`; } return `<g transform="translate(${dx} ${dy}) scale(${sc})">${g}</g>`; };
      return `<svg-content>${defs(k, lin('felt' + k, 0, 0, 1, 1, [[0, '#2f8a55'], [1, '#14532d']]) + lin('tile' + k, 0, 0, 0, 1, [[0, '#fbf7ee'], [1, '#e7dcc6']]) + lin('rim' + k, 0, 0, 1, 1, [[0, '#4b5563'], [0.4, '#e5e7eb'], [1, '#1f2937']]) + rad('lens' + k, 0.35, 0.3, 0.8, [[0, '#ffffff', 0.25], [1, '#bae6fd', 0.05]]) + `<clipPath id="lc${k}"><circle cx="336" cy="52" r="25"/></clipPath>` + `<filter id="felt${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .18"/></feComponentTransfer></filter>`)}
        <rect width="400" height="120" fill="url(#felt${k})"/><rect width="400" height="120" filter="url(#felt${k})" opacity=".6" style="mix-blend-mode:overlay"/>
        ${tiles(0, 0, 1)}
        <path d="M70 38H184" stroke="#facc15" stroke-width="20" stroke-linecap="round" opacity=".38" style="mix-blend-mode:multiply"/>
        <path d="M160 16 248 92" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" opacity=".3" style="mix-blend-mode:multiply"/>
        <g filter="url(#sh${k})"><path d="M352 70l26 30" stroke="#3f2a14" stroke-width="10" stroke-linecap="round"/><path d="M352 70l26 30" stroke="#7a4a22" stroke-width="6" stroke-linecap="round"/><circle cx="336" cy="52" r="28" fill="url(#rim${k})"/></g>
        <g clip-path="url(#lc${k})"><rect x="300" y="20" width="80" height="70" fill="url(#felt${k})"/>${tiles(-336 * 0.45, -52 * 0.45, 1.45)}<circle cx="336" cy="52" r="25" fill="url(#lens${k})"/></g>
        <path d="M318 40a24 24 0 0 1 22-12" fill="none" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>
        ${vignette(k, 0.5)}${grain(k)}</svg-content>`; },

    // Křížovka: novinový papír s vytištěnou mřížkou, tužka se šestihranem a gumou, kroužek od kávy
    krizovka: () => { const k = nid('k'), grid = ['..S...._.', '#OTÁZKA#.', '..O..Ó...', '..P..D_..', '._A..Y...']; let g = '';
      grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '.') return; const x = 86 + c * 25, y = 10 + r * 20; g += ch === '#' ? `<rect x="${x}" y="${y}" width="25" height="20" fill="#1f1f1f"/>` : `<rect x="${x}" y="${y}" width="25" height="20" fill="none" stroke="#2b2b2b" stroke-width=".9"/>${ch !== '_' ? `<text x="${x + 12.5}" y="${y + 15}" font-size="13" text-anchor="middle" fill="#1e3a8a" font-family="'Segoe Print', 'Comic Sans MS', cursive" transform="rotate(${((r * 3 + c) % 5 - 2) * 2} ${x + 12} ${y + 10})">${ch}</text>` : ''}`; }));
      return `<svg-content>${defs(k, lin('np' + k, 0, 0, 1, 1, [[0, '#f4efe2'], [1, '#e2d9c3']]) + lin('pen' + k, 0, 0, 0, 1, [[0, '#fde68a'], [0.5, '#f59e0b'], [1, '#b45309']]) + lin('tip' + k, 0, 0, 1, 0, [[0, '#e8c9a0'], [1, '#c9a074']]) + lin('ferr' + k, 0, 0, 0, 1, [[0, '#f3f4f6'], [0.5, '#9ca3af'], [1, '#e5e7eb']]) + lin('desk' + k, 0, 0, 0, 1, [[0, '#3f3f46'], [1, '#18181b']]))}
        <rect width="400" height="120" fill="url(#desk${k})"/>
        <g filter="url(#sh${k})" transform="rotate(-2 200 60)"><rect x="40" y="-6" width="320" height="132" fill="url(#np${k})" filter="url(#paper${k})"/></g>
        ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${54} ${10 + i * 8}h22" stroke="#6b6b6b" stroke-width="2" opacity=".35"/><path d="M${54} ${64 + i * 8}h26" stroke="#6b6b6b" stroke-width="2" opacity=".35"/>`).join('')}
        <g transform="rotate(-2 200 60)">${g}</g>
        <circle cx="306" cy="34" r="22" fill="none" stroke="#7c4a1e" stroke-width="3" opacity=".22"/><circle cx="306" cy="34" r="19" fill="none" stroke="#7c4a1e" stroke-width="1" opacity=".18"/>
        <g transform="translate(266 98) rotate(-28)" filter="url(#sh${k})">
          <rect x="0" y="-5" width="104" height="10" fill="url(#pen${k})"/><path d="M0 -1.6h104M0 1.6h104" stroke="#92400e" stroke-opacity=".35" stroke-width=".7"/>
          <path d="M0 -5 -16 0 0 5z" fill="url(#tip${k})"/><path d="M-11 -1.6-16 0-11 1.6z" fill="#27272a"/>
          <rect x="104" y="-5.4" width="9" height="10.8" fill="url(#ferr${k})"/><rect x="113" y="-5" width="10" height="10" rx="3" fill="#f472b6"/>
        </g>
        ${vignette(k, 0.45)}${grain(k)}</svg-content>`; },

    // Šibenice: soumrak, mlha na kopci, silueta dřevěné šibenice a slovo z kostiček
    sibenice: () => { const k = nid('h');
      return `<svg-content>${defs(k, lin('sky' + k, 0, 0, 0, 1, [[0, '#0f172a'], [0.55, '#475569'], [0.85, '#c2410c'], [1, '#7c2d12']]) + rad('moon' + k, 0.5, 0.5, 0.5, [[0, '#fef9c3'], [0.25, '#fde68a', 0.6], [1, '#fde68a', 0]]) + lin('hill' + k, 0, 0, 0, 1, [[0, '#1e293b'], [1, '#020617']]) + lin('gwd' + k, 0, 0, 1, 0, [[0, '#7a5230'], [0.45, '#a87445'], [1, '#4a3019']]) + lin('tile' + k, 0, 0, 0, 1, [[0, '#fbf7ee'], [1, '#d9cdb3']]) + lin('fog' + k, 0, 0, 0, 1, [[0, '#cbd5e1', 0], [0.5, '#cbd5e1', 0.35], [1, '#cbd5e1', 0]]))}
        <rect width="400" height="120" fill="url(#sky${k})"/>${stars(40, 21, 400, 40)}
        <circle cx="74" cy="34" r="40" fill="url(#moon${k})"/><circle cx="74" cy="34" r="12" fill="#fef9c3"/><circle cx="70" cy="31" r="2.4" fill="#e5d9a0"/><circle cx="78" cy="38" r="1.6" fill="#e5d9a0"/>
        <path d="M0 100C80 84 150 80 230 92S360 98 400 90V120H0z" fill="url(#hill${k})"/>
        <rect y="78" width="400" height="30" fill="url(#fog${k})" filter="url(#bl${k})"/>
        <g filter="url(#shs${k})"><rect x="146" y="18" width="8" height="76" fill="url(#gwd${k})"/><rect x="146" y="16" width="70" height="8" fill="url(#gwd${k})"/><path d="M151 44l24-22" stroke="#7a5230" stroke-width="6"/><rect x="126" y="90" width="48" height="7" fill="url(#gwd${k})"/></g><path d="M146 18v76M146 16h70" stroke="#fde68a" stroke-opacity=".35" stroke-width="1"/>
        <path d="M208 25v16" stroke="#c4a574" stroke-width="2"/><circle cx="208" cy="47" r="6.5" fill="none" stroke="#c4a574" stroke-width="2"/>
        ${['P', '', 'Á', '', 'K', ''].map((ch, i) => `<g transform="translate(${250 + i * 24} 62)" filter="url(#shs${k})"><rect width="20" height="24" rx="3" fill="url(#tile${k})"/>${ch ? `<text x="10" y="18" font-size="15" font-weight="700" text-anchor="middle" fill="#292524" font-family="Georgia, serif">${ch}</text>` : '<path d="M5 18h10" stroke="#57534e" stroke-width="2"/>'}</g>`).join('')}
        ${vignette(k, 0.55)}${grain(k)}</svg-content>`; },

    // Milionář: televizní studio s kuželi světla, lesklá podlaha s odrazy, zlatý panel otázky a mince
    milionar: () => { const k = nid('m');
      return `<svg-content>${defs(k, lin('bg' + k, 0, 0, 0, 1, [[0, '#020617'], [1, '#1e1b4b']]) + lin('beam' + k, 0, 0, 0, 1, [[0, '#93c5fd', 0.5], [1, '#93c5fd', 0]]) + lin('floor' + k, 0, 0, 0, 1, [[0, '#1e3a8a'], [1, '#0b1026']]) + lin('panel' + k, 0, 0, 0, 1, [[0, '#1e3a8a'], [1, '#0f1d4a']]) + lin('bez' + k, 0, 0, 1, 0, [[0, '#a16207'], [0.3, '#fde68a'], [0.6, '#ca8a04'], [1, '#fef3c7']]) + lin('coin' + k, 0, 0, 1, 0, [[0, '#a16207'], [0.35, '#fde68a'], [0.7, '#d97706'], [1, '#fef3c7']]) + lin('bill' + k, 0, 0, 1, 1, [[0, '#86b46c'], [0.5, '#5f8f49'], [1, '#3e6a30']]))}
        <rect width="400" height="120" fill="url(#bg${k})"/>
        ${[40, 140, 260, 360].map(x => `<path d="M${x} -4L${x - 46} 92H${x + 46}z" fill="url(#beam${k})" opacity=".55" filter="url(#bl2${k})"/>`).join('')}
        <ellipse cx="200" cy="108" rx="230" ry="26" fill="url(#floor${k})"/>
        <ellipse cx="200" cy="100" rx="150" ry="10" fill="#60a5fa" opacity=".18" filter="url(#bl${k})"/>
        <g filter="url(#gl${k})"><path d="M104 32h192l18 20-18 20H104L86 52z" fill="url(#bez${k})"/></g>
        <path d="M108 36h184l14 16-14 16H108L94 52z" fill="url(#panel${k})"/>
        <rect x="128" y="46" width="128" height="5" rx="2.5" fill="#bfdbfe" opacity=".85"/><rect x="128" y="55" width="84" height="4" rx="2" fill="#bfdbfe" opacity=".5"/>
        <path d="M108 36h184l6 7H102z" fill="#fff" opacity=".1"/>
        <g opacity=".2" transform="translate(0 196) scale(1 -1)"><path d="M104 96h192l18 20-18 20H104L86 116z" fill="url(#bez${k})" filter="url(#bl2${k})"/></g>
        ${[0, 1, 2, 3, 4].map(i => `<g filter="url(#shs${k})"><ellipse cx="346" cy="${102 - i * 6}" rx="20" ry="6" fill="url(#coin${k})"/><ellipse cx="346" cy="${101 - i * 6}" rx="16" ry="4" fill="none" stroke="#92400e" stroke-opacity=".35"/></g>`).join('')}
        ${[0, 1, 2].map(i => `<g filter="url(#shs${k})"><ellipse cx="${44 + i * 10}" cy="${104 - i * 6}" rx="16" ry="5" fill="url(#coin${k})"/></g>`).join('')}
        ${(() => {   // zelené bankovky: balíčky s páskou a pár letících
          const bill = (x, y, rot, sc, blur) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})"${blur ? ` filter="url(#bl2${k})"` : ' filter="url(#shs${k})"'.replace('${k}', k)}>
            <rect x="-24" y="-11" width="48" height="22" rx="1.5" fill="url(#bill${k})"/>
            <rect x="-21.5" y="-8.5" width="43" height="17" rx="1" fill="none" stroke="#d9f2c4" stroke-opacity=".6" stroke-width=".8"/>
            <ellipse cx="0" cy="0" rx="7.4" ry="6.6" fill="#456b34" stroke="#d9f2c4" stroke-opacity=".55" stroke-width=".7"/>
            <text x="0" y="3.2" font-size="9" font-weight="700" text-anchor="middle" fill="#e7f6dc" font-family="Georgia, serif">$</text>
            <text x="-16" y="-3" font-size="5.4" font-weight="700" text-anchor="middle" fill="#e7f6dc" font-family="Georgia, serif">100</text><text x="16" y="7" font-size="5.4" font-weight="700" text-anchor="middle" fill="#e7f6dc" font-family="Georgia, serif">100</text>
          </g>`;
          const stack = (x, y, n) => Array.from({ length: n }, (_, i) => `<g transform="translate(${x} ${y - i * 2.4})"><rect x="-25" y="-1" width="50" height="3" fill="#3f6b2f"/><rect x="-25" y="-1" width="50" height="1" fill="#cfe8b8" opacity=".6"/></g>`).join('') + bill(x, y - n * 2.4 - 9, 0, 1, false) + `<rect x="${x - 6}" y="${y - n * 2.4 - 20}" width="12" height="${n * 2.4 + 22}" fill="#f1e5c2" opacity=".92"/><rect x="${x - 6}" y="${y - n * 2.4 - 20}" width="12" height="${n * 2.4 + 22}" fill="none" stroke="#b9a36a" stroke-width=".6"/>`;
          return stack(96, 108, 6) + stack(300, 108, 8) + stack(272, 112, 4) + bill(54, 30, -18, 0.85, true) + bill(352, 22, 24, 0.8, false) + bill(150, 98, 10, 0.9, false) + bill(236, 16, -30, 0.7, true);
        })()}
        ${vignette(k, 0.5)}${grain(k)}</svg-content>`; },

    // Dobyvatel: stará pergamenová mapa s ručně kolorovanými územími, inkoustem, hrady a růžicí
    dobyvatel: () => { const k = nid('v');
      const ink = '#3b2a1a';
      return `<svg-content>${defs(k, rad('parch' + k, 0.5, 0.5, 0.75, [[0, '#f3e6c4'], [0.75, '#e3cf9f'], [1, '#b89660']]) + lin('sea' + k, 0, 0, 0, 1, [[0, '#9ec5c9'], [1, '#7fb0b6']]))}
        <rect width="400" height="120" fill="url(#parch${k})" filter="url(#paper${k})"/>
        <path d="M0 0H400V120H0z" fill="url(#sea${k})" opacity=".55"/>
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${10 + i * 58} ${16 + (i % 3) * 38}c6-4 12-4 18 0s12 4 18 0" fill="none" stroke="${ink}" stroke-width=".9" opacity=".4"/>`).join('')}
        <path d="M30 30 92 14l54 16 30-8 50 18 46-12 60 20 30 34-24 30-70 6-40-10-56 8-48-8-50 6-30-22z" fill="url(#parch${k})" stroke="${ink}" stroke-width="1.6"/>
        <path d="M30 30 92 14l54 16-8 40-46 14-30-22z" fill="#c2410c" opacity=".28"/><path d="M146 30l30-8 50 18-6 46-56 8-26-24z" fill="#1d4ed8" opacity=".22"/><path d="M226 40l46-12 60 20 30 34-24 30-70 6-40-10z" fill="#15803d" opacity=".25"/><path d="M84 84l54-14 26 24-48 8z" fill="#a16207" opacity=".28"/>
        <path d="M138 70l26 24M146 30l-8 40M226 40l-6 46M164 94l56-8" fill="none" stroke="${ink}" stroke-width="1" stroke-dasharray="3 2" opacity=".7"/>
        ${[[70, 46, '#991b1b'], [186, 52, '#1e3a8a'], [300, 66, '#14532d']].map(([x, y, c]) => `<g stroke="${ink}" stroke-width="1"><path d="M${x - 9} ${y + 8}V${y - 2}h3v-3h3v3h6v-3h3v3h3V${y + 8}z" fill="#e7d3a8"/><path d="M${x - 2} ${y + 8}v-4a2 2 0 0 1 4 0v4" fill="${ink}"/><path d="M${x} ${y - 5}V${y - 16}" /><path d="M${x} ${y - 16}h9l-3 3 3 3H${x}" fill="${c}"/></g>`).join('')}
        <path d="M200 66C234 82 254 84 282 72" fill="none" stroke="#991b1b" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/><path d="M277 66l8 6-9 4" fill="none" stroke="#991b1b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g transform="translate(372 26)" stroke="${ink}" stroke-width=".9"><circle r="13" fill="none"/><path d="M0-17 3-3 0 0-3-3zM0 17 3 3 0 0-3 3z" fill="${ink}"/><path d="M-17 0-3 3 0 0-3-3zM17 0 3 3 0 0 3-3z" fill="#e7d3a8"/><text y="-19" font-size="7" text-anchor="middle" fill="${ink}" stroke="none" font-family="Georgia, serif">S</text></g>
        ${vignette(k, 0.6)}${grain(k)}</svg-content>`; },

    // Obrana království: zlatá hodinka, hrad na kopci v oparu, cesta zužující se k bráně, věže, šípy a průsvitní slizáci
    obrana: () => { const k = nid('t');
      const slime = (x, y, r, c) => `<ellipse cx="${x + r * 0.2}" cy="${y + r * 0.62}" rx="${r * 1.05}" ry="${r * 0.32}" fill="#1a2e10" opacity=".45" filter="url(#bl2${k})"/>
        <path d="M${x - r} ${y + r * 0.5}C${x - r * 1.15} ${y - r * 0.4} ${x - r * 0.55} ${y - r} ${x} ${y - r}S${x + r * 1.15} ${y - r * 0.4} ${x + r} ${y + r * 0.5}Q${x} ${y + r * 0.78} ${x - r} ${y + r * 0.5}z" fill="url(#${c}${k})" opacity=".93"/>
        <path d="M${x - r * 0.75} ${y + r * 0.3}C${x - r * 0.85} ${y - r * 0.3} ${x - r * 0.4} ${y - r * 0.72} ${x} ${y - r * 0.72}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${r * 0.12}"/>
        <ellipse cx="${x - r * 0.38}" cy="${y - r * 0.5}" rx="${r * 0.3}" ry="${r * 0.17}" fill="#fff" opacity=".85" transform="rotate(-25 ${x - r * 0.38} ${y - r * 0.5})"/>
        <circle cx="${x + r * 0.3}" cy="${y + r * 0.1}" r="${r * 0.12}" fill="#fff" opacity=".35"/><circle cx="${x - r * 0.1}" cy="${y + r * 0.28}" r="${r * 0.08}" fill="#fff" opacity=".3"/>
        <ellipse cx="${x - r * 0.28}" cy="${y - r * 0.08}" rx="${r * 0.17}" ry="${r * 0.22}" fill="#0f172a"/><ellipse cx="${x + r * 0.3}" cy="${y - r * 0.08}" rx="${r * 0.17}" ry="${r * 0.22}" fill="#0f172a"/>
        <circle cx="${x - r * 0.24}" cy="${y - r * 0.16}" r="${r * 0.06}" fill="#fff"/><circle cx="${x + r * 0.34}" cy="${y - r * 0.16}" r="${r * 0.06}" fill="#fff"/>`;
      // věž: válec ze zdiva s kuželovou střechou, okénka a praporek
      const tower = (x, y, w, h, roof, flag, glow) => `<g filter="url(#sh${k})">
        <rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="url(#stone${k})"/>
        ${Array.from({ length: Math.floor(h / 7) }, (_, i) => `<path d="M${x - w / 2} ${y - h + 7 + i * 7}h${w}" stroke="#57534e" stroke-opacity=".45" stroke-width=".7"/>${Array.from({ length: 3 }, (_, q) => `<path d="M${x - w / 2 + (q + (i % 2) * 0.5) * w / 3} ${y - h + i * 7}v7" stroke="#57534e" stroke-opacity=".35" stroke-width=".6"/>`).join('')}`).join('')}
        <rect x="${x - w / 2 - 2}" y="${y - h - 4}" width="${w + 4}" height="5" fill="url(#stone${k})"/>
        <path d="M${x - w / 2 - 4} ${y - h - 4}L${x} ${y - h - w * 1.1}L${x + w / 2 + 4} ${y - h - 4}z" fill="url(#${roof}${k})"/>
        <path d="M${x} ${y - h - w * 1.1}L${x + w / 2 + 4} ${y - h - 4}H${x + 2}z" fill="#000" opacity=".22"/>
        <rect x="${x - 2}" y="${y - h * 0.62}" width="4" height="8" rx="2" fill="${glow ? '#fde68a' : '#1c1917'}"/>${glow ? `<circle cx="${x}" cy="${y - h * 0.62 + 4}" r="7" fill="#fde68a" opacity=".35" filter="url(#bl2${k})"/>` : ''}
        <path d="M${x} ${y - h - w * 1.1}v-11" stroke="#3f2a14" stroke-width="1.2"/><path d="M${x} ${y - h - w * 1.1 - 11}c4 -1.4 7 1.4 11 0v6c-4 1.4-7-1.4-11 0z" fill="${flag}"/>
      </g>`;
      return `<svg-content>${defs(k, lin('sky' + k, 0, 0, 0, 1, [[0, '#7aa7d8'], [0.55, '#f6d6a8'], [1, '#f9b97a']]) + rad('sun' + k, 0.5, 0.5, 0.5, [[0, '#fff7dd'], [0.3, '#ffd89a', 0.7], [1, '#ffb066', 0]]) + lin('mtn' + k, 0, 0, 0, 1, [[0, '#9fb3c8'], [1, '#c7cfd8']]) + lin('far' + k, 0, 0, 0, 1, [[0, '#6f9a55'], [1, '#5b8443']]) + lin('grass' + k, 0, 0, 0, 1, [[0, '#5e9a3a'], [1, '#2f5a1d']]) + lin('dirt' + k, 0, 0, 0, 1, [[0, '#d3a86e'], [1, '#8f6238']]) + lin('stone' + k, 0, 0, 1, 0, [[0, '#8f8a84'], [0.45, '#e4dfd8'], [1, '#6f6a64']]) + lin('rb' + k, 0, 0, 1, 0, [[0, '#1e40af'], [0.5, '#3b82f6'], [1, '#1e3a8a']]) + lin('rr' + k, 0, 0, 1, 0, [[0, '#7f1d1d'], [0.5, '#dc2626'], [1, '#7f1d1d']]) + lin('rp' + k, 0, 0, 1, 0, [[0, '#4c1d95'], [0.5, '#8b5cf6'], [1, '#3b0764']]) + lin('haze' + k, 0, 0, 0, 1, [[0, '#fde7c6', 0], [1, '#fde7c6', 0.65]]) + rad('g1' + k, 0.4, 0.3, 0.8, [[0, '#bbf7d0'], [0.5, '#4ade80'], [1, '#15803d']]) + rad('g2' + k, 0.4, 0.3, 0.8, [[0, '#fed7aa'], [0.5, '#fb923c'], [1, '#c2410c']]) + rad('g3' + k, 0.4, 0.3, 0.8, [[0, '#bfdbfe'], [0.5, '#60a5fa'], [1, '#1d4ed8']]) + rad('g4' + k, 0.4, 0.3, 0.8, [[0, '#fecaca'], [0.5, '#f87171'], [1, '#b91c1c']]) + rad('mag' + k, 0.5, 0.5, 0.5, [[0, '#fff'], [0.35, '#e9d5ff'], [1, '#a855f7', 0]]) + `<filter id="gr${k}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .25" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 .1  0 0 0 0 .25  0 0 0 0 .05  0 0 0 .9 -.25"/></filter>`)}
        <rect width="400" height="120" fill="url(#sky${k})"/>
        <circle cx="318" cy="58" r="80" fill="url(#sun${k})"/>
        ${[[70, 18, 30], [190, 12, 38], [300, 22, 26]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.28}" fill="#fff" opacity=".6" filter="url(#bl2${k})"/>`).join('')}
        <path d="M0 58 40 40 78 52 120 34 160 48 210 30 250 46 296 32 340 44 400 34V70H0z" fill="url(#mtn${k})" filter="url(#bl2${k})" opacity=".8"/>
        <path d="M0 64C60 56 120 60 190 54S330 50 400 52V80H0z" fill="url(#far${k})" filter="url(#bl2${k})"/>
        ${Array.from({ length: 22 }, (_, i) => `<circle cx="${i * 19 + (i % 3) * 4}" cy="${60 - (i % 4) * 2}" r="${6 + (i % 3) * 2}" fill="#3f6b2c" opacity=".85" filter="url(#bl2${k})"/>`).join('')}
        <!-- hrad na kopci -->
        <path d="M250 70C280 56 330 52 372 58S400 64 400 64V80H250z" fill="#4f7a37"/>
        <g opacity=".93">
          <rect x="290" y="38" width="66" height="26" fill="url(#stone${k})"/>
          ${Array.from({ length: 9 }, (_, i) => `<rect x="${290 + i * 7.6}" y="34" width="4.6" height="5" fill="url(#stone${k})"/>`).join('')}
          <rect x="318" y="50" width="10" height="14" rx="5" fill="#2a1a0c"/>
          ${tower(290, 64, 14, 36, 'rb', '#dc2626', true)}${tower(356, 64, 14, 40, 'rb', '#facc15', true)}${tower(323, 40, 12, 18, 'rr', '#3b82f6', false)}
        </g>
        <rect x="240" y="40" width="160" height="40" fill="url(#haze${k})"/>
        <!-- louka a cesta v perspektivě -->
        <path d="M0 76C90 68 190 70 270 66S380 66 400 68V120H0z" fill="url(#grass${k})"/>
        <rect y="70" width="400" height="50" filter="url(#gr${k})" opacity=".55"/>
        <path d="M-20 120C40 104 70 98 120 96S210 88 250 80 300 70 318 66L326 66C312 72 270 84 234 92S150 106 120 112 60 120 40 124z" fill="url(#dirt${k})"/>
        <path d="M-20 120C40 104 70 98 120 96S210 88 250 80 300 70 318 66" fill="none" stroke="#5c3d1e" stroke-width="1.4" opacity=".5"/>
        ${[[30, 108], [64, 100], [150, 98], [204, 90], [268, 80]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${3 - x / 200}" ry="1" fill="#6b4a2a" opacity=".5"/>`).join('')}
        ${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 53) % 400}" cy="${84 + (i * 37) % 32}" r="1.3" fill="${['#fde047', '#f9a8d4', '#fff'][i % 3]}" opacity=".85"/>`).join('')}
        <!-- věže obránců -->
        ${tower(96, 92, 24, 46, 'rr', '#16a34a', true)}
        ${tower(196, 80, 18, 34, 'rp', '#a855f7', false)}
        <circle cx="196" cy="${80 - 34 - 18 * 1.1 - 2}" r="10" fill="url(#mag${k})"/>
        <!-- šípy a magická střela -->
        ${[[118, 52, 150, 74], [126, 60, 160, 80]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#fff" stroke-opacity=".35" stroke-width="3" filter="url(#bl2${k})"/><path d="M${x2 - 10} ${y2 - 7}L${x2} ${y2}" stroke="#5c3d1e" stroke-width="1.4"/><path d="M${x2} ${y2}l-4.6 -.2 2.6 -3.4z" fill="#d1d5db"/>`).join('')}
        <path d="M206 38C230 46 244 58 252 70" fill="none" stroke="#c084fc" stroke-width="5" opacity=".35" filter="url(#bl2${k})"/><circle cx="252" cy="71" r="6" fill="url(#mag${k})"/>
        <!-- slizáci (vzadu menší) -->
        ${slime(286, 72, 4.5, 'g3')}${slime(254, 79, 6.5, 'g4')}${slime(160, 96, 9, 'g2')}${slime(46, 108, 13, 'g1')}${slime(110, 104, 11, 'g3')}
        ${vignette(k, 0.4)}${grain(k)}</svg-content>`; },

    // Zombie Survival: měsíční noc s mlhou, kužel baterky, barikáda z prken, siluety zombíků
    zombie: () => { const k = nid('z');
      const zomb = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#0b1a10"><circle cx="0" cy="-30" r="7"/><path d="M-7 -22h14l3 22h-20z"/><path d="M-6 0l-4 22M6 0l3 22" stroke="#0b1a10" stroke-width="5" stroke-linecap="round"/><path d="M-6 -18l-16 2M6 -18l-12 4" stroke="#0b1a10" stroke-width="4" stroke-linecap="round"/><circle cx="-2.6" cy="-31" r="1.2" fill="#d9f99d"/><circle cx="2.6" cy="-31" r="1.2" fill="#d9f99d"/></g>`;
      return `<svg-content>${defs(k, lin('sky' + k, 0, 0, 0, 1, [[0, '#020617'], [0.7, '#1e1b4b'], [1, '#312e81']]) + rad('moon' + k, 0.5, 0.5, 0.5, [[0, '#f8fafc'], [0.2, '#e0e7ff', 0.6], [1, '#c7d2fe', 0]]) + lin('cone' + k, 0, 0, 1, 0, [[0, '#fef9c3', 0.55], [1, '#fef9c3', 0]]) + lin('fog' + k, 0, 0, 0, 1, [[0, '#94a3b8', 0], [0.5, '#94a3b8', 0.4], [1, '#94a3b8', 0]]) + lin('plank' + k, 0, 0, 0, 1, [[0, '#7c5a3a'], [1, '#4a3320']]) + lin('ground' + k, 0, 0, 0, 1, [[0, '#1f2937'], [1, '#030712']]))}
        <rect width="400" height="120" fill="url(#sky${k})"/>${stars(50, 31, 400, 60)}
        <circle cx="330" cy="30" r="46" fill="url(#moon${k})"/><circle cx="330" cy="30" r="14" fill="#f1f5f9"/><circle cx="325" cy="26" r="3" fill="#cbd5e1"/><circle cx="335" cy="35" r="2" fill="#cbd5e1"/>
        <path d="M0 74h30v-14h12v-10h14v24h20v-30h16v30h40v-8h20v8H400V120H0z" fill="#0b1120" opacity=".85"/>
        <rect y="84" width="400" height="36" fill="url(#ground${k})"/>
        <path d="M118 66 330 34v80z" fill="url(#cone${k})" opacity=".7" filter="url(#bl2${k})"/>
        ${zomb(226, 92, 1)}${zomb(272, 96, 1.08)}${zomb(318, 90, 0.9)}
        <rect y="70" width="400" height="34" fill="url(#fog${k})" filter="url(#bl${k})"/>
        ${[0, 1, 2].map(i => `<g filter="url(#shs${k})" transform="rotate(${i % 2 ? 9 : -9} 178 ${60 + i * 12})"><rect x="152" y="${55 + i * 12}" width="54" height="10" rx="1.5" fill="url(#plank${k})"/><circle cx="158" cy="${60 + i * 12}" r="1" fill="#1f2937"/><circle cx="200" cy="${60 + i * 12}" r="1" fill="#1f2937"/></g>`).join('')}
        <g fill="#0b1120"><circle cx="104" cy="58" r="8"/><path d="M96 92V68c0-6 16-6 16 0v24z"/><path d="M110 68l10-4" stroke="#0b1120" stroke-width="5" stroke-linecap="round"/></g>
        <rect x="116" y="61" width="9" height="5" rx="1.5" fill="#9ca3af" transform="rotate(-16 120 63)"/><circle cx="124" cy="62" r="3" fill="#fef9c3" filter="url(#gl${k})"/>
        ${vignette(k, 0.6)}${grain(k)}</svg-content>`; },
  };
  const wrap = s => `<svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">${s.replace(/<\/?svg-content>/g, '')}</svg>`;
  const cache = {};
  const SBB = window.SBB = {
    list: Object.keys(B), has: k => !!B[k],
    svg: k => (cache[k] = cache[k] || (B[k] ? wrap(B[k]()) : '')),
    fill: root => (root || document).querySelectorAll('[data-banner]').forEach(el => { if (!el.dataset.bannerDone && B[el.dataset.banner]) { el.innerHTML = SBB.svg(el.dataset.banner); el.dataset.bannerDone = '1'; } }),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => SBB.fill()); else SBB.fill();
})();

/* td-super-slimes.js — Super grafika (td_gfx '2'): všichni slizáci a bossové. Registruje do window.TDSS:
 *   slime(ctx, id, x, y, r, ang, ts, s) — pohled shora, předek = směr pohybu (ang),
 *   slimeIcon(id, size), clearCacheSlimes().
 * Tělo se světlem shora zleva se NEotáčí (světlo zůstává na místě), natáčí se jen oči a ozdoby.
 * Stavy (zmrazení, hoření, kyselina, omráčení, dorůstání, lišta životů, pečeť) kreslí td-render.js.
 * s: camo, revealed, fort, hit, frozen, stunned, seed, burrowed, flying, enraged, healing, spawning,
 *    shellActive, magnetActive, chilling, shield. Styl jako td-super-a.js (obrys #111, bez rozmazání). */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const OUT = '#111', PI = Math.PI, TAU = PI * 2, SC = 2;   // sprity se kreslí ve 2× rozlišení (ostré na hustých displejích)

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const shadeMemo = new Map();
  function shade(hex, amt) {
    const key = hex + '|' + amt;
    let out = shadeMemo.get(key);
    if (out) return out;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    out = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    shadeMemo.set(key, out);
    return out;
  }
  function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function ellipsePath(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function paint(ctx, fill, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function fillA(ctx, col, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
  function strokeOutlined(ctx, w, col) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 2.4; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i % 2 ? r2 : r1; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  function gem(ctx, x, y, r, col) {
    polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y + r], [x - r * 0.85, y]]); paint(ctx, col, Math.max(0.8, r * 0.35));
    polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y]]); fillA(ctx, '#fff', 0.4);
  }

  /* ---------- Vzhled slizáků ---------- */
  // col tělo, dark tmavší okraj (spočítá se), lw síla obrysu ×r; eyes: 'normal' | 'angry' | 'boss' | 'ghost' | 'squint' | 'sleepy'
  const LOOK = {
    kapicka_slizu: { col: '#60a5fa', shape: 'drop', eyes: 'normal', big: 1.15 },
    lucni_slizak: { col: '#4ade80', eyes: 'normal' },
    lesni_slizak: { col: '#f59e0b', eyes: 'normal' },
    bleskovy_sliz: { col: '#f472b6', eyes: 'angry', shape: 'sleek' },
    cerny_sliz: { col: '#2e2e35', eyes: 'angry', rim: '#6b6b78' },
    snezny_sliz: { col: '#eef6ff', eyes: 'normal', dark: '#a9c9ec', blush: true },
    runovy_sliz: { col: '#a855f7', eyes: 'normal' },
    prilbosliz: { col: '#94a3b8', eyes: 'normal' },
    duhovy_sliz: { col: '#f472b6', eyes: 'normal', rainbow: true },
    zlaty_sliz: { col: '#eab308', eyes: 'normal', shiny: true },
    slizovy_obr: { col: '#14b8a6', eyes: 'boss', boss: true },
    rudy_arcisliz: { col: '#dc2626', eyes: 'boss', boss: true },
    stinosliz_prizrak: { col: '#2a2563', eyes: 'ghost', boss: true, rim: '#6d5dd3', shape: 'ghost' },
    prastary_kral_slizu: { col: '#7e22ce', eyes: 'boss', boss: true },
    bublinkovy_sliz: { col: '#5eead4', eyes: 'normal', blush: true },
    zuivy_sliz: { col: '#dc2626', eyes: 'angry' },
    delivy_sliz: { col: '#84cc16', eyes: 'normal', shape: 'twin' },
    stitonos_sliz: { col: '#64748b', eyes: 'normal' },
    samansky_sliz: { col: '#059669', eyes: 'sleepy' },
    krtci_sliz: { col: '#92400e', eyes: 'squint' },
    magneticky_sliz: { col: '#cbd5e1', eyes: 'normal', dark: '#8a96a6' },
    mrazivy_plazivec: { col: '#7dd3fc', eyes: 'angry', shape: 'sleek' },
    kralovna_roje: { col: '#f59e0b', eyes: 'boss', boss: true },
    krystalovy_behemot: { col: '#4338ca', eyes: 'boss', boss: true },
  };
  const DEF = { col: '#4ade80', eyes: 'normal' };

  // Obrys těla: hladká uzavřená křivka kolem poloměru r(a); a = 0 je předek (+x)
  function bodyPath(ctx, r, shape) {
    const N = 20, pts = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, c = Math.cos(a);
      let q = r * (1 + 0.05 * c);
      if (shape === 'drop') q = r * (0.95 + 0.6 * Math.pow(Math.max(0, -c), 3));
      else if (shape === 'sleek') q = r * (1 + 0.1 * c) * (1 - 0.12 * Math.abs(Math.sin(a)));
      else if (shape === 'twin') q = r * (1 - 0.13 * Math.pow(Math.abs(Math.sin(a)), 8) * (c < 0.3 && c > -0.3 ? 1 : 0)) * (1 + 0.04 * c);
      else if (shape === 'ghost') q = r * (1 + 0.32 * Math.pow(Math.max(0, -c), 2) * (0.8 + 0.2 * Math.cos(a * 5)));
      pts.push([Math.cos(a) * q, Math.sin(a) * q]);
    }
    ctx.beginPath();
    const m0 = [(pts[N - 1][0] + pts[0][0]) / 2, (pts[N - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < N; i++) { const p = pts[i], n = pts[(i + 1) % N]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2); }
    ctx.closePath();
  }
  const lineW = function (r) { return Math.max(1.6, r * 0.15); };

  // Tělo (nenatočené, světlo shora zleva): výplň, tmavý půlměsíc vpravo dole, světlo vlevo nahoře, odlesk, bublinky
  // rot = natočení tvaru (u nesouměrných těl); cesta se sestaví natočená, světlo a stín zůstanou vlevo nahoře
  function drawBody(ctx, id, r, L, fort, rot) {
    const col = L.col, dark = L.dark || shade(col, -0.32), R = makeRng(hash(id));
    const shapeAt = function (q) { ctx.save(); ctx.rotate(rot || 0); bodyPath(ctx, q, L.shape); ctx.restore(); };
    shapeAt(r); paint(ctx, col, 0);
    ctx.save(); shapeAt(r); ctx.clip();
    circlePath(ctx, r * 0.3, r * 0.34, r * 1.02); fillA(ctx, dark, 0.95);   // stín vpravo dole
    circlePath(ctx, -r * 0.1, -r * 0.12, r * 0.92); fillA(ctx, L.rainbow ? '#fff' : col, L.rainbow ? 0.0 : 1);
    if (L.rainbow) {   // duha přes celé tělo (pruhy šikmo), stín přes ni
      const C = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
      ctx.save(); ctx.rotate(-0.7);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = C[i]; ctx.fillRect(-r * 1.6 + i * r * 0.53, -r * 1.6, r * 0.54, r * 3.2); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.34, r * 1.02, 0, TAU); ctx.arc(-r * 0.1, -r * 0.12, r * 0.92, 0, TAU, true); fillA(ctx, '#000', 0.25);
    }
    if (L.rim) { shapeAt(r * 0.94); ctx.lineWidth = r * 0.12; ctx.strokeStyle = L.rim; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1; }
    if (L.shiny) {   // zlatý: plošky jako nuget
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; polyPath(ctx, [[0, 0], [Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2], [Math.cos(a + 0.7) * r * 1.2, Math.sin(a + 0.7) * r * 1.2]]); fillA(ctx, i % 2 ? '#fff6b0' : '#a16207', 0.22); }
    }
    ellipsePath(ctx, -r * 0.32, -r * 0.36, r * 0.52, r * 0.32, -0.6); fillA(ctx, '#fff', 0.32);   // světlo
    for (let i = 0; i < 3; i++) { circlePath(ctx, (R() - 0.3) * r * 0.9, (R() - 0.2) * r * 0.9, r * (0.07 + R() * 0.07)); fillA(ctx, '#fff', 0.28); }   // bublinky v rosolu
    if (fort) {   // kamenný: pancíř z kamenů
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, d = i ? r * 0.62 : 0; polyStone(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.36, R); }
    }
    ctx.restore();
    shapeAt(r); paint(ctx, null, lineW(r) * (L.boss ? 1.25 : 1));
    ellipsePath(ctx, -r * 0.45, -r * 0.5, r * 0.17, r * 0.1, -0.6); fillA(ctx, '#fff', 0.95);   // odlesk
    circlePath(ctx, -r * 0.22, -r * 0.6, r * 0.06); fillA(ctx, '#fff', 0.9);
  }
  function polyStone(ctx, x, y, s, R) {
    const n = 6, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * 0.5, q = s * (0.75 + R() * 0.3); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); }
    polyPath(ctx, pts); paint(ctx, R() < 0.5 ? '#8e949a' : '#a3a8ad', Math.max(1, s * 0.14));
    ellipsePath(ctx, x - s * 0.25, y - s * 0.25, s * 0.35, s * 0.2, -0.5); fillA(ctx, '#fff', 0.35);
  }

  // Koruna shora: zlatý prstenec s hroty ven a drahokamy
  function crown(ctx, x, y, s, gemCol, n) {
    n = n || 6;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, a1 = a - PI / n * 0.55, a2 = a + PI / n * 0.55;
      polyPath(ctx, [[x + Math.cos(a1) * s, y + Math.sin(a1) * s], [x + Math.cos(a) * s * 1.55, y + Math.sin(a) * s * 1.55], [x + Math.cos(a2) * s, y + Math.sin(a2) * s]]);
      paint(ctx, '#f5c518', Math.max(1, s * 0.16));
      circlePath(ctx, x + Math.cos(a) * s * 1.5, y + Math.sin(a) * s * 1.5, s * 0.16); paint(ctx, i % 2 ? gemCol : '#fff', Math.max(0.7, s * 0.08));
    }
    circlePath(ctx, x, y, s); ctx.lineWidth = s * 0.42; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = s * 0.3; ctx.strokeStyle = '#f5c518'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, s, PI * 1.05, PI * 1.6); ctx.lineWidth = s * 0.1; ctx.strokeStyle = '#fff6b0'; ctx.stroke();
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; gem(ctx, x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.2, gemCol); }
  }
  function leaf(ctx, x, y, len, w, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -w, len, 0); ctx.quadraticCurveTo(len * 0.5, w, 0, 0); ctx.closePath(); paint(ctx, col, Math.max(0.9, w * 0.3));
    ctx.beginPath(); ctx.moveTo(len * 0.1, 0); ctx.lineTo(len * 0.85, 0); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(0.6, w * 0.15); ctx.stroke();
    ctx.restore();
  }
  function rune(ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.55, 0); ctx.lineTo(s * 0.55, 0); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.4, -s * 0.15); ctx.moveTo(0, s * 0.5); ctx.lineTo(-s * 0.4, s * 0.15); ctx.moveTo(-s * 0.3, -s * 0.45); ctx.lineTo(-s * 0.05, -s * 0.1);
    ctx.strokeStyle = col; ctx.globalAlpha = 0.4; ctx.lineWidth = s * 0.45; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#f5e8ff'; ctx.stroke();
    ctx.restore();
  }

  // Ozdoby v souřadnicích těla (+x = předek). layer 'under' (pod tělem) nebo 'over' (na těle)
  function decor(ctx, id, r, layer, R) {
    const lw = lineW(r) * 0.8;
    switch (id) {
      case 'lucni_slizak':
        if (layer === 'over') { leaf(ctx, -r * 0.25, 0, r * 0.75, r * 0.26, -2.4, '#3fa34d'); leaf(ctx, -r * 0.25, 0, r * 0.65, r * 0.24, 2.5, '#58c060'); circlePath(ctx, -r * 0.25, 0, r * 0.1); paint(ctx, '#3fa34d', lw * 0.7); }
        break;
      case 'lesni_slizak':   // čepička žaludu
        if (layer === 'over') {
          circlePath(ctx, -r * 0.28, 0, r * 0.5); paint(ctx, '#8b5a2b', lw);
          ctx.save(); circlePath(ctx, -r * 0.28, 0, r * 0.5); ctx.clip(); ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.lineWidth = Math.max(0.7, r * 0.05);
          for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.8 + i * r * 0.2, -r * 0.6); ctx.lineTo(-r * 0.2 + i * r * 0.2, r * 0.6); ctx.moveTo(-r * 0.2 + i * r * 0.2, -r * 0.6); ctx.lineTo(-r * 0.8 + i * r * 0.2, r * 0.6); ctx.stroke(); }
          ctx.restore();
          ctx.beginPath(); ctx.moveTo(-r * 0.3, 0); ctx.lineTo(-r * 0.62, -r * 0.18); strokeOutlined(ctx, r * 0.1, '#6b4320');
          leaf(ctx, -r * 0.55, -r * 0.15, r * 0.45, r * 0.16, -2.2, '#5fae3b');
        }
        break;
      case 'bleskovy_sliz':   // blesk na zádech a ostré „vlasy“ dozadu
        if (layer === 'under') { for (const sd of [-1, 0, 1]) { polyPath(ctx, [[-r * 0.6, sd * r * 0.35 - r * 0.15], [-r * 1.35, sd * r * 0.55], [-r * 0.6, sd * r * 0.35 + r * 0.15]]); paint(ctx, '#f9a8d4', lw); } }
        if (layer === 'over') { polyPath(ctx, [[r * 0.05, -r * 0.55], [-r * 0.25, -r * 0.02], [-r * 0.02, -r * 0.02], [-r * 0.3, r * 0.55], [r * 0.18, -r * 0.1], [-r * 0.05, -r * 0.1]]); paint(ctx, '#fde047', lw * 0.9); }
        break;
      case 'cerny_sliz':   // kovové kroužky: odolný proti výbuchům
        if (layer === 'over') { for (const [x, y] of [[-r * 0.3, -r * 0.45], [-r * 0.45, r * 0.3], [-r * 0.05, r * 0.55]]) { circlePath(ctx, x, y, r * 0.13); paint(ctx, '#71717a', lw * 0.6); circlePath(ctx, x - r * 0.03, y - r * 0.03, r * 0.05); fillA(ctx, '#fff', 0.7); } }
        break;
      case 'snezny_sliz':
        if (layer === 'over') {
          ctx.save(); ctx.translate(-r * 0.3, 0); ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) { ctx.rotate(PI / 3); ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.moveTo(r * 0.25, 0); ctx.lineTo(r * 0.35, -r * 0.1); ctx.moveTo(r * 0.25, 0); ctx.lineTo(r * 0.35, r * 0.1); ctx.moveTo(-r * 0.25, 0); ctx.lineTo(-r * 0.35, -r * 0.1); ctx.moveTo(-r * 0.25, 0); ctx.lineTo(-r * 0.35, r * 0.1); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.stroke(); }
          ctx.restore();
        }
        break;
      case 'runovy_sliz':
        if (layer === 'over') { rune(ctx, -r * 0.25, 0, r * 0.75, '#e9d5ff'); }
        break;
      case 'prilbosliz':   // železná přilba s hřebenem; oči koukají zpod kšiltu
        if (layer === 'over') {
          ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * 0.86, PI * 0.38, PI * 1.62); ctx.lineTo(r * 0.28, -r * 0.62); ctx.quadraticCurveTo(r * 0.12, 0, r * 0.28, r * 0.62); ctx.closePath(); paint(ctx, '#9ca3af', lw);
          ctx.save(); ctx.clip(); ellipsePath(ctx, -r * 0.4, -r * 0.35, r * 0.4, r * 0.25, -0.5); fillA(ctx, '#fff', 0.4); ellipsePath(ctx, 0, r * 0.4, r * 0.7, r * 0.35); fillA(ctx, '#000', 0.2); ctx.restore();
          roundRectP(ctx, -r * 0.8, -r * 0.09, r * 0.95, r * 0.18, r * 0.08); paint(ctx, '#c0392b', lw * 0.8);   // hřeben
          for (const [x, y] of [[-r * 0.3, -r * 0.6], [-r * 0.3, r * 0.6], [r * 0.15, -r * 0.5], [r * 0.15, r * 0.5]]) { circlePath(ctx, x, y, r * 0.07); paint(ctx, '#d1d5db', lw * 0.4); }
        }
        break;
      case 'zlaty_sliz':
        if (layer === 'over') { ctx.fillStyle = '#fffbe0'; starPath(ctx, -r * 0.25, -r * 0.2, r * 0.22, r * 0.07, 4, 0); ctx.fill(); starPath(ctx, -r * 0.5, r * 0.35, r * 0.14, r * 0.05, 4, 0.4); ctx.fill(); }
        break;
      case 'duhovy_sliz':
        if (layer === 'over') { ctx.fillStyle = '#fff'; starPath(ctx, -r * 0.35, r * 0.3, r * 0.16, r * 0.05, 4, 0); ctx.fill(); }
        break;
      case 'slizovy_obr':   // obr: ruce po stranách, kosti v rosolu, malá koruna
        if (layer === 'under') { for (const sd of [-1, 1]) { circlePath(ctx, r * 0.35, sd * r * 0.95, r * 0.32); paint(ctx, '#0f9488', lw); circlePath(ctx, r * 0.5, sd * r * 1.05, r * 0.12); fillA(ctx, '#fff', 0.3); } }
        if (layer === 'over') {
          for (const [x, y, a] of [[-r * 0.45, r * 0.35, 0.6], [-r * 0.1, -r * 0.5, -0.4]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-r * 0.16, 0); ctx.lineTo(r * 0.16, 0); strokeOutlined(ctx, r * 0.06, '#f5f5f4'); for (const e of [-1, 1]) { circlePath(ctx, e * r * 0.17, -r * 0.04, r * 0.05); paint(ctx, '#f5f5f4', 0.8); circlePath(ctx, e * r * 0.17, r * 0.04, r * 0.05); paint(ctx, '#f5f5f4', 0.8); } ctx.restore(); }
          crown(ctx, -r * 0.35, 0, r * 0.2, '#22d3ee', 5);
        }
        break;
      case 'rudy_arcisliz':   // plamenné ostny dozadu, rohy, koruna s rubíny
        if (layer === 'under') { for (let i = -2; i <= 2; i++) { const a = PI + i * 0.38; ctx.save(); ctx.rotate(a); polyPath(ctx, [[r * 0.8, -r * 0.2], [r * 1.35, 0], [r * 0.8, r * 0.2]]); paint(ctx, i % 2 ? '#f97316' : '#fb923c', lw); polyPath(ctx, [[r * 0.85, -r * 0.08], [r * 1.15, 0], [r * 0.85, r * 0.08]]); fillA(ctx, '#fde047', 0.9); ctx.restore(); } }
        if (layer === 'over') {
          for (const sd of [-1, 1]) {   // zahnuté kostěné rohy
            ctx.beginPath(); ctx.moveTo(r * 0.02, sd * r * 0.5); ctx.quadraticCurveTo(r * 0.05, sd * r * 0.98, -r * 0.42, sd * r * 1.08); ctx.quadraticCurveTo(-r * 0.12, sd * r * 0.82, -r * 0.22, sd * r * 0.5); ctx.closePath(); paint(ctx, '#f5e6c8', lw);
            ctx.beginPath(); ctx.moveTo(-r * 0.05, sd * r * 0.62); ctx.lineTo(-r * 0.18, sd * r * 0.64); ctx.moveTo(-r * 0.12, sd * r * 0.8); ctx.lineTo(-r * 0.25, sd * r * 0.8); ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = Math.max(0.8, r * 0.04); ctx.stroke();
          }
          crown(ctx, -r * 0.35, 0, r * 0.24, '#ef4444', 6);
        }
        break;
      case 'stinosliz_prizrak':   // přízrak: kápě, zbroj na ramenou, mlžné cáry
        if (layer === 'under') { for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.8, i * r * 0.45); ctx.quadraticCurveTo(-r * 1.3, i * r * 0.7 + r * 0.2, -r * 1.6, i * r * 0.5); ctx.strokeStyle = 'rgba(109,93,211,0.45)'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.stroke(); } }
        if (layer === 'over') {
          for (const sd of [-1, 1]) {   // kovové nárameníky s hroty
            ellipsePath(ctx, -r * 0.2, sd * r * 0.66, r * 0.3, r * 0.2, 0); paint(ctx, '#6b7280', lw);
            ellipsePath(ctx, -r * 0.28, sd * r * 0.6, r * 0.14, r * 0.07, 0); fillA(ctx, '#fff', 0.45);
            polyPath(ctx, [[-r * 0.1, sd * r * 0.78], [-r * 0.2, sd * r * 1.08], [-r * 0.32, sd * r * 0.8]]); paint(ctx, '#d1d5db', lw * 0.7);
          }
          for (let i = 0; i < 3; i++) { const a = PI * 0.75 + i * PI * 0.25; circlePath(ctx, -r * 0.2 + Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.08); fillA(ctx, '#a78bfa', 0.8); }   // duchovní světélka
        }
        break;
      case 'prastary_kral_slizu':   // král: plášť s hermelínem vzadu, velká koruna, žezlo
        if (layer === 'under') {
          ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.95); ctx.quadraticCurveTo(-r * 1.25, -r * 1.05, -r * 1.42, 0); ctx.quadraticCurveTo(-r * 1.25, r * 1.05, -r * 0.2, r * 0.95); ctx.closePath(); paint(ctx, '#b91c1c', lw);
          ctx.beginPath(); ctx.moveTo(-r * 1.0, -r * 0.82); ctx.quadraticCurveTo(-r * 1.5, 0, -r * 1.0, r * 0.82); ctx.lineWidth = r * 0.16; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#f8fafc'; ctx.stroke();
          for (let i = -3; i <= 3; i++) { const t = i / 3.5, x = -r * 1.0 - (1 - t * t) * r * 0.37, y = t * r * 0.8; circlePath(ctx, x, y, r * 0.025); ctx.fillStyle = OUT; ctx.fill(); }
          ctx.save(); ctx.translate(r * 0.55, r * 0.95); ctx.rotate(0.5); ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.35, 0); strokeOutlined(ctx, r * 0.07, '#a16207'); circlePath(ctx, r * 0.4, 0, r * 0.12); paint(ctx, '#f5c518', lw * 0.6); gem(ctx, r * 0.4, 0, r * 0.07, '#a855f7'); ctx.restore();
        }
        if (layer === 'over') crown(ctx, -r * 0.3, 0, r * 0.26, '#a855f7', 8);
        break;
      case 'bublinkovy_sliz':
        if (layer === 'over') { for (const [x, y, q] of [[-r * 0.4, r * 0.4, 0.13], [-r * 0.55, -r * 0.2, 0.09]]) { circlePath(ctx, x, y, r * q); ctx.lineWidth = Math.max(0.8, r * 0.05); ctx.strokeStyle = '#ecfeff'; ctx.stroke(); } }
        break;
      case 'zuivy_sliz':   // rohy a značka vzteku
        if (layer === 'over') {
          for (const sd of [-1, 1]) { polyPath(ctx, [[-r * 0.05, sd * r * 0.38], [-r * 0.55, sd * r * 0.95], [-r * 0.35, sd * r * 0.3]]); paint(ctx, '#3f0d0d', lw); }
          ctx.save(); ctx.translate(-r * 0.4, -r * 0.05); ctx.strokeStyle = '#fecaca'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.lineCap = 'round';
          const k = r * 0.15; for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(a * k * 0.4, b * k * 1.3); ctx.quadraticCurveTo(a * k * 0.4, b * k * 0.4, a * k * 1.3, b * k * 0.4); ctx.stroke(); }
          ctx.restore();
        }
        break;
      case 'delivy_sliz':   // šev napříč a pupen vzadu
        if (layer === 'under') { circlePath(ctx, -r * 0.95, r * 0.25, r * 0.38); paint(ctx, '#65a30d', lw); circlePath(ctx, -r * 0.88, r * 0.15, r * 0.07); ctx.fillStyle = OUT; ctx.fill(); }
        if (layer === 'over') { ctx.save(); ctx.setLineDash([r * 0.16, r * 0.12]); ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.95); ctx.quadraticCurveTo(-r * 0.2, 0, -r * 0.05, r * 0.95); ctx.strokeStyle = 'rgba(30,50,10,0.75)'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.stroke(); ctx.restore(); }
        break;
      case 'stitonos_sliz':   // štít vpředu vlevo, přilba
        if (layer === 'over') {
          circlePath(ctx, -r * 0.25, 0, r * 0.55); paint(ctx, '#94a3b8', lw);
          ctx.save(); circlePath(ctx, -r * 0.25, 0, r * 0.55); ctx.clip(); ellipsePath(ctx, -r * 0.45, -r * 0.25, r * 0.3, r * 0.18, -0.5); fillA(ctx, '#fff', 0.45); ctx.restore();
          roundRectP(ctx, -r * 0.65, -r * 0.07, r * 0.75, r * 0.14, r * 0.06); paint(ctx, '#e2e8f0', lw * 0.6);
          ctx.save(); ctx.translate(r * 0.45, -r * 0.72); ctx.rotate(-0.35);
          ellipsePath(ctx, 0, 0, r * 0.28, r * 0.58, 0); paint(ctx, '#92400e', lw);
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.28, r * 0.58, 0, 0, TAU); ctx.lineWidth = r * 0.1; ctx.strokeStyle = '#cbd5e1'; ctx.stroke();
          circlePath(ctx, 0, 0, r * 0.11); paint(ctx, '#e2e8f0', lw * 0.6);
          ctx.restore();
        }
        break;
      case 'samansky_sliz':   // čelenka s pery, válečné barvy, hůl s koulí
        if (layer === 'under') { ctx.save(); ctx.translate(r * 0.2, r * 0.85); ctx.rotate(-0.2); ctx.beginPath(); ctx.moveTo(-r * 0.7, 0); ctx.lineTo(r * 0.55, 0); strokeOutlined(ctx, r * 0.1, '#7c4a1e'); ctx.restore(); }
        if (layer === 'over') {
          for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(r * 0.05 - i * r * 0.18, sd * r * 0.45); ctx.lineTo(-r * 0.05 - i * r * 0.18, sd * r * 0.68); ctx.strokeStyle = '#fde68a'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.lineCap = 'round'; ctx.stroke(); }
          ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.52, PI * 0.5, PI * 1.5); ctx.lineWidth = r * 0.2; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = r * 0.13; ctx.strokeStyle = '#b45309'; ctx.stroke();
          const F = ['#ef4444', '#facc15', '#3b82f6', '#22c55e', '#f97316'];
          for (let i = 0; i < 5; i++) { const a = PI * 0.62 + i * PI * 0.19; leaf(ctx, -r * 0.2 + Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.6, r * 0.14, a, F[i]); }
        }
        break;
      case 'krtci_sliz':   // hrabáky vpředu, růžový čumák, hlína na zádech
        if (layer === 'under') { for (const sd of [-1, 1]) { ellipsePath(ctx, r * 0.65, sd * r * 0.7, r * 0.3, r * 0.2, sd * 0.5); paint(ctx, '#fbcfe8', lw); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(r * 0.85, sd * r * 0.7 + k * r * 0.1); ctx.lineTo(r * 1.05, sd * r * 0.75 + k * r * 0.12); ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round'; ctx.stroke(); } } }
        if (layer === 'over') {
          for (const [x, y, q] of [[-r * 0.45, -r * 0.3, 0.2], [-r * 0.2, r * 0.42, 0.15], [-r * 0.6, r * 0.2, 0.12]]) { circlePath(ctx, x, y, r * q); fillA(ctx, '#451a03', 0.55); }
          ellipsePath(ctx, r * 0.88, 0, r * 0.2, r * 0.17, 0); paint(ctx, '#f472b6', lw * 0.8); circlePath(ctx, r * 0.84, -r * 0.05, r * 0.05); fillA(ctx, '#fff', 0.8);
        }
        break;
      case 'magneticky_sliz':   // podkovový magnet na zádech a nýty
        if (layer === 'over') {
          for (const [x, y] of [[r * 0.1, -r * 0.62], [r * 0.1, r * 0.62], [-r * 0.6, -r * 0.45], [-r * 0.6, r * 0.45]]) { circlePath(ctx, x, y, r * 0.07); paint(ctx, '#64748b', lw * 0.4); }
          ctx.beginPath(); ctx.arc(-r * 0.25, 0, r * 0.38, PI * 0.5, PI * 1.5); ctx.lineWidth = r * 0.34; ctx.strokeStyle = OUT; ctx.lineCap = 'butt'; ctx.stroke(); ctx.lineWidth = r * 0.24; ctx.strokeStyle = '#dc2626'; ctx.stroke();
          for (const sd of [-1, 1]) { roundRectP(ctx, -r * 0.27, sd * r * 0.38 - r * 0.12, r * 0.3, r * 0.24, r * 0.04); paint(ctx, '#e5e7eb', lw * 0.7); }
          ctx.beginPath(); ctx.arc(-r * 0.25, 0, r * 0.4, PI * 0.8, PI * 1.2); ctx.lineWidth = r * 0.06; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
        }
        break;
      case 'mrazivy_plazivec':   // rampouchy po hřbetě
        if (layer === 'over') {
          for (let i = 0; i < 5; i++) { const x = -r * 0.75 + i * r * 0.28, h = r * (0.32 + (i % 2) * 0.14); polyPath(ctx, [[x - r * 0.12, -h * 0.2], [x, -h], [x + r * 0.12, -h * 0.2], [x + r * 0.12, h * 0.2], [x, h], [x - r * 0.12, h * 0.2]]); paint(ctx, '#e0f2fe', lw * 0.7); }
        }
        break;
      case 'kralovna_roje':   // průsvitná křídla (živě), pruhy, tykadla, koruna
        if (layer === 'over') {
          ctx.save(); bodyPath(ctx, r * 0.98); ctx.clip();
          for (const x of [-r * 0.15, -r * 0.5, -r * 0.85]) { ctx.beginPath(); ctx.rect(x - r * 0.09, -r, r * 0.18, r * 2); fillA(ctx, '#3b2506', 0.75); }
          ctx.restore();
          for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.7, sd * r * 0.25); ctx.quadraticCurveTo(r * 1.15, sd * r * 0.35, r * 1.3, sd * r * 0.65); strokeOutlined(ctx, r * 0.05, '#3b2506'); circlePath(ctx, r * 1.3, sd * r * 0.65, r * 0.08); paint(ctx, '#3b2506', 0.8); }
          crown(ctx, -r * 0.05, 0, r * 0.2, '#ef4444', 5);
        }
        break;
      case 'krystalovy_behemot':   // krystaly prorůstající hřbetem
        if (layer === 'over') {
          for (const [x, y, h, a] of [[-r * 0.5, -r * 0.35, 0.45, -0.7], [-r * 0.3, r * 0.4, 0.5, 0.6], [-r * 0.7, r * 0.05, 0.55, 0.05], [-r * 0.05, -r * 0.55, 0.35, -1.3], [-r * 0.05, r * 0.6, 0.35, 1.3]]) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(a + PI);
            const w = r * 0.14;
            polyPath(ctx, [[0, -w], [r * h * 0.75, -w * 0.8], [r * h, 0], [r * h * 0.75, w * 0.8], [0, w]]); paint(ctx, '#a5b4fc', lw * 0.8);
            polyPath(ctx, [[0, -w], [r * h * 0.75, -w * 0.8], [r * h, 0], [0, 0]]); fillA(ctx, '#fff', 0.45);
            ctx.restore();
          }
          crown(ctx, r * 0.1, 0, r * 0.16, '#a5b4fc', 5);
        }
        break;
    }
  }
  function roundRectP(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- Oči (živě: mrkání, pohled dopředu) ---------- */
  function eyes(ctx, id, r, L, ts, seed, s) {
    const kind = (s.enraged && L.eyes === 'normal') ? 'angry' : L.eyes, big = L.big || 1;
    const ex = r * (id === 'krtci_sliz' ? 0.45 : 0.38), ey = r * 0.33 * (L.boss ? 0.9 : 1), er = r * 0.24 * big * (L.boss ? 0.8 : 1);
    const blink = ((ts / 1000 + (seed % 97) * 0.37) % 4.2) < 0.12;
    for (const sd of [-1, 1]) {
      const x = ex, y = sd * ey;
      if (kind === 'ghost') {   // svítící oči bez bělma, šikmé
        ellipsePath(ctx, x, y, er * 1.25, er * 0.85, sd * 0.4); fillA(ctx, '#a78bfa', 0.45);
        ellipsePath(ctx, x, y, er * 0.85, er * 0.5, sd * 0.4); paint(ctx, '#c4b5fd', Math.max(1, r * 0.06));
        ellipsePath(ctx, x + er * 0.15, y, er * 0.4, er * 0.24, sd * 0.4); ctx.fillStyle = '#fff'; ctx.fill();
        continue;
      }
      if (kind === 'squint' || blink || s.stunned) {   // zavřené oko = oblouček
        ctx.beginPath(); ctx.arc(x - er * 0.2, y, er * 0.7, -PI / 2.4, PI / 2.4); ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
        continue;
      }
      ellipsePath(ctx, x, y, er * 0.95, er, 0); paint(ctx, '#fff', Math.max(1, r * 0.08));
      const pr = er * (kind === 'sleepy' ? 0.5 : 0.56);
      circlePath(ctx, x + er * 0.32, y + sd * er * 0.05, pr); ctx.fillStyle = kind === 'boss' ? '#b91c1c' : '#111'; ctx.fill();
      if (kind === 'boss') { circlePath(ctx, x + er * 0.32, y, pr * 0.45); ctx.fillStyle = '#111'; ctx.fill(); }
      circlePath(ctx, x + er * 0.15, y - er * 0.25, pr * 0.38); ctx.fillStyle = '#fff'; ctx.fill();
      if (kind === 'sleepy') {   // přivřená víčka (zadní polovina oka)
        ctx.beginPath(); ctx.ellipse(x, y, er * 0.95, er, 0, PI * 0.5, PI * 1.5); ctx.closePath(); ctx.fillStyle = shade(L.col, -0.15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y - er); ctx.lineTo(x, y + er); ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = OUT; ctx.stroke();
      }
      if (kind === 'angry' || kind === 'boss') {   // obočí (šikmo dovnitř)
        ctx.beginPath(); ctx.moveTo(x - er * 0.9, y + sd * er * 1.05); ctx.lineTo(x + er * 0.7, y + sd * er * 0.25);
        ctx.lineWidth = Math.max(1.4, r * (L.boss ? 0.12 : 0.13)); ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
      }
    }
    if (L.blush) for (const sd of [-1, 1]) { ellipsePath(ctx, ex - r * 0.05, sd * (ey + er * 1.15), er * 0.45, er * 0.25, 0); fillA(ctx, '#fb7185', 0.5); }
  }

  /* ---------- Mezipaměť spritů ---------- */
  const cache = new Map();
  TDS.clearCacheSlimes = function () { cache.clear(); };
  function sprite(key, r, draw) {
    let c = cache.get(key);
    if (!c) {
      const S = Math.ceil(r * 3.6 * SC); c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.scale(SC, SC);
      try { draw(g); } catch (_) { /* nic */ }
      cache.set(key, c);
    }
    return c;
  }
  function put(ctx, c) { const h = c.width / SC / 2; ctx.drawImage(c, -h, -h, h * 2, h * 2); }

  /* ---------- Vykreslení slizáka ---------- */
  TDS.slime = function (ctx, id, x, y, r, ang, ts, s) {
    s = s || {};
    const L = LOOK[id] || DEF, seed = s.seed || 0, still = !!(s.frozen || s.stunned);
    const asym = L.shape === 'drop' || L.shape === 'sleek' || L.shape === 'ghost' || L.shape === 'twin';
    if (s.burrowed) { burrowed(ctx, x, y, r, ang, ts); return; }
    const ph = still ? 0 : ts * 0.011 + seed * 1.7, st = still ? 0 : Math.sin(ph) * 0.09;   // houpání: natažení ve směru pohybu
    const lift = s.flying ? r * 0.55 + Math.sin(ts * 0.004 + seed) * 2 : 0;
    ctx.save();
    // stín
    ctx.fillStyle = '#000'; ctx.globalAlpha = s.flying ? 0.16 : 0.22;
    ellipsePath(ctx, x + r * 0.22 + 2, y + r * 0.28 + 3 + lift * 0.4, r * (1 + st) * (s.flying ? 0.8 : 1), r * (1 - st) * (s.flying ? 0.7 : 0.92), ang); ctx.fill();
    ctx.globalAlpha = (s.camo && !s.revealed) ? 0.42 : 1;
    ctx.translate(x, y - lift);
    ctx.save(); ctx.rotate(ang); ctx.scale(1 + st, 1 - st);
    if (id === 'kralovna_roje') wings(ctx, r, ts, seed);
    put(ctx, sprite(id + '|u|' + r, r, function (g) { decor(g, id, r, 'under', makeRng(hash(id))); }));
    ctx.restore();
    // tělo se natahuje ve směru pohybu, ale světlo zůstává vlevo nahoře; nesouměrná těla mají 8 předkreslených směrů
    ctx.save(); ctx.rotate(ang); ctx.scale(1 + st, 1 - st); ctx.rotate(-ang);
    const qi = asym ? ((Math.round(ang / (PI / 4)) % 8) + 8) % 8 : 0, q = qi * PI / 4;
    if (asym) ctx.rotate(ang - q - (ang - q > PI ? TAU : ang - q < -PI ? -TAU : 0));
    put(ctx, sprite(id + '|b|' + r + '|' + (s.fort ? 1 : 0) + '|' + qi, r, function (g) { drawBody(g, id, r, L, s.fort, q); }));
    ctx.restore();
    ctx.save(); ctx.rotate(ang); ctx.scale(1 + st, 1 - st);
    put(ctx, sprite(id + '|o|' + r, r, function (g) { decor(g, id, r, 'over', makeRng(hash(id) + 7)); }));
    eyes(ctx, id, r, L, ts, seed, s);
    live(ctx, id, r, ts, s);
    ctx.restore();
    if (s.hit) { circlePath(ctx, 0, 0, r * 0.95); fillA(ctx, '#fff', 0.45); }
    if (id === 'bublinkovy_sliz') bubble(ctx, r, ts);
    ctx.restore();
  };

  // Živé části: plamínky šamanovy koule, krystaly behemota, mrazivý dech, jiskry blesku, magnet
  function live(ctx, id, r, ts, s) {
    const t = ts / 1000;
    if (id === 'samansky_sliz') {
      const glow = s.healing ? 1 : 0.35 + Math.sin(t * 3) * 0.15;
      ctx.save(); ctx.translate(r * 0.75, r * 0.72);
      circlePath(ctx, 0, 0, r * (0.32 + glow * 0.18)); fillA(ctx, '#86efac', 0.35 * glow + 0.1);
      circlePath(ctx, 0, 0, r * 0.2); paint(ctx, '#4ade80', Math.max(0.8, r * 0.06)); circlePath(ctx, -r * 0.06, -r * 0.06, r * 0.07); fillA(ctx, '#fff', 0.9);
      ctx.restore();
    }
    if (id === 'bleskovy_sliz' && !s.frozen && !s.stunned) {
      for (let i = 0; i < 3; i++) { const k = (t * 6 + i / 3) % 1; ctx.save(); ctx.globalAlpha *= 1 - k; ctx.fillStyle = '#fde047'; starPath(ctx, -r * (1.1 + k * 1.2), Math.sin(i * 2.1 + t * 9) * r * 0.5, r * 0.2, r * 0.07, 4, t * 4); ctx.fill(); ctx.restore(); }
    }
    if (id === 'mrazivy_plazivec' && s.chilling) {
      ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1, px = Math.cos(a) * r * 1.35, py = Math.sin(a) * r * 1.35; for (let k = 0; k < 3; k++) { const b = k * PI / 3; ctx.beginPath(); ctx.moveTo(px - Math.cos(b) * r * 0.14, py - Math.sin(b) * r * 0.14); ctx.lineTo(px + Math.cos(b) * r * 0.14, py + Math.sin(b) * r * 0.14); ctx.stroke(); } }
      ctx.restore();
    }
    if (id === 'magneticky_sliz' && s.magnetActive) {
      ctx.save(); ctx.globalAlpha *= 0.5 + Math.sin(t * 8) * 0.3; ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = Math.max(1, r * 0.07);
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(-r * 0.25, sd * r * 0.38, r * 0.3, sd > 0 ? 0 : PI, sd > 0 ? PI : TAU); ctx.stroke(); }
      ctx.restore();
    }
    if (id === 'krystalovy_behemot' && (s.shellActive || s.prism)) {
      ctx.save(); ctx.globalAlpha *= 0.45 + Math.sin(t * 10) * 0.2; circlePath(ctx, -r * 0.3, 0, r * 0.9); ctx.fillStyle = '#c7d2fe'; ctx.fill(); ctx.restore();
    }
    if (id === 'kralovna_roje' && s.spawning) {
      ctx.save(); ctx.globalAlpha *= 0.6; circlePath(ctx, -r * 0.8, 0, r * 0.35); ctx.fillStyle = '#bef264'; ctx.fill(); ctx.restore();
    }
  }
  function wings(ctx, r, ts, seed) {   // královna: dva páry průsvitných křídel, mávají
    const f = Math.sin(ts * 0.03 + seed) * 0.25;
    for (const sd of [-1, 1]) for (const [x, rx, ry, a] of [[-r * 0.15, r * 0.75, r * 0.38, 0.5], [-r * 0.55, r * 0.6, r * 0.3, 0.95]]) {
      ctx.save(); ctx.translate(x, sd * r * 0.55); ctx.rotate(sd * (a + f));
      ellipsePath(ctx, r * 0.1, sd * rx * 0.55, ry, rx, 0); ctx.fillStyle = 'rgba(224,242,254,0.62)'; ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.04); ctx.strokeStyle = 'rgba(17,17,17,0.75)'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.1, 0); ctx.lineTo(r * 0.1, sd * rx * 1.05); ctx.strokeStyle = 'rgba(71,85,105,0.5)'; ctx.stroke();
      ctx.restore();
    }
  }
  function bubble(ctx, r, ts) {   // Bublinkový: celý se vznáší v bublině
    const w = 1 + Math.sin(ts * 0.005) * 0.04;
    ctx.save();
    ellipsePath(ctx, 0, 0, r * 1.42 * w, r * 1.42 / w, 0); ctx.fillStyle = 'rgba(165,243,252,0.16)'; ctx.fill();
    ctx.lineWidth = Math.max(1.4, r * 0.1); ctx.strokeStyle = 'rgba(207,250,254,0.95)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2 * w, r * 1.2 / w, 0, PI * 1.05, PI * 1.45); ctx.lineWidth = Math.max(1.2, r * 0.1); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.stroke();
    circlePath(ctx, r * 0.8, -r * 0.85, r * 0.1); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
  }
  function burrowed(ctx, x, y, r, ang, ts) {   // Krtčí pod zemí: kupka hlíny, odletující hroudy, čumák
    const t = ts / 1000;
    ctx.save(); ctx.translate(x, y);
    ellipsePath(ctx, 2, 3, r * 1.05, r * 0.7, ang); fillA(ctx, '#000', 0.2);
    ellipsePath(ctx, 0, 0, r * 1.0, r * 0.68, ang); paint(ctx, '#7c4a21', lineW(r) * 0.8);
    ellipsePath(ctx, -r * 0.25, -r * 0.2, r * 0.5, r * 0.28, ang); fillA(ctx, '#a16a35', 0.8);
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + t * 7, k = (t * 3 + i * 0.25) % 1; circlePath(ctx, Math.cos(a) * r * (0.8 + k * 0.6), Math.sin(a) * r * (0.5 + k * 0.5) - k * r * 0.4, r * 0.12 * (1 - k * 0.5)); paint(ctx, '#8b5a2b', 0.8); }
    ctx.rotate(ang); ellipsePath(ctx, r * 0.75, 0, r * 0.18, r * 0.15, 0); paint(ctx, '#f472b6', 1);
    ctx.restore();
  }

  // Lišta životů (boss / Zlatý sliz) a runová pečeť bosse; hp 0–1, seal = { n, left }
  TDS.slimeBars = function (ctx, x, y, r, hp, boss, seal, ts) {
    ctx.save();
    if (seal && seal.left > 0) {
      const R = r + 9, rot = ts * 0.0007;
      ctx.translate(x, y); ctx.rotate(rot); ctx.lineCap = 'round';
      for (let i = 0; i < seal.n; i++) {
        const a1 = i / seal.n * TAU + 0.14, a2 = (i + 1) / seal.n * TAU - 0.14, on = i < seal.left;
        ctx.beginPath(); ctx.arc(0, 0, R, a1, a2); ctx.strokeStyle = OUT; ctx.lineWidth = on ? 7 : 4; ctx.stroke();
        ctx.strokeStyle = on ? '#c4b5fd' : '#475569'; ctx.lineWidth = on ? 4 : 2; ctx.stroke();
        if (on) { const m = (a1 + a2) / 2; ctx.fillStyle = '#fff'; starPath(ctx, Math.cos(m) * R, Math.sin(m) * R, 4.5, 1.8, 4, -rot); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke(); }
      }
      ctx.restore(); ctx.save();   // lišta životů už nenatočená
    }
    if (hp != null) {
      const w = boss ? r * 2.1 : r * 1.9, h = boss ? 7 : 5, bx = x - w / 2, by = y - r * (boss ? 1.75 : 1.5) - h;
      roundRectP(ctx, bx - 1.5, by - 1.5, w + 3, h + 3, 3); ctx.fillStyle = OUT; ctx.fill();
      roundRectP(ctx, bx, by, w, h, 2); ctx.fillStyle = '#3f3f46'; ctx.fill();
      const f = Math.max(0, Math.min(1, hp));
      if (f > 0) { roundRectP(ctx, bx, by, Math.max(h, w * f), h, 2); ctx.fillStyle = boss ? (f > 0.5 ? '#ef4444' : f > 0.25 ? '#f97316' : '#facc15') : '#facc15'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx + 1, by + 1, Math.max(0, w * f - 2), h * 0.35); }
      if (boss) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(bx + w * i / 4, by); ctx.lineTo(bx + w * i / 4, by + h); ctx.stroke(); } }
    }
    ctx.restore();
  };
  TDS.slimeIcon = function (id, size) {
    const key = 'icon|' + id + '|' + size;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), def = (window.TD && TD.enemies && TD.enemies[id]) || {}, r = def.r || 11, k = size / 2 / (r * 1.5);
    g.translate(size / 2, size / 2); g.scale(k, k);
    try { TDS.slime(g, id, 0, 0, r, 0, 0, { seed: 1 }); } catch (_) { /* nic */ }
    cache.set(key, c);
    return c;
  };
})();

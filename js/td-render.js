// ═══ td-render.js — vykreslení hry Obrana království na canvas
// Pozadí mapy se předkreslí jednou, slizáci a věže se kreslí z jednoduchých tvarů
// (procedurální grafika; časem ji nahradí sprity). Kreslí se ve světových
// souřadnicích 1040×720, škálování řeší td.js.

const TR = (() => {
  const TAU = Math.PI * 2;
  const bgCache = new Map();
  const spriteCache = new Map();
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function off(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // Nová grafika od Gemini (js/td-sprites-*.js) — jde vypnout v okně 🔊 (localStorage td_gfx = '0')
  const useTDS = () => { try { return !!window.TDS?.background && localStorage.getItem('td_gfx') !== '0'; } catch (_) { return !!window.TDS?.background; } };

  /* ── Pozadí mapy ───────────────────────────────────────────── */
  function background(map, paths) {
    if (useTDS()) return TDS.background({ id: map.id, paths: map.paths, track_width_px: TRACK_HALF * 2, water_zones: map.water_zones || [], obstacles: map.obstacles || [] });
    if (bgCache.has(map.id)) return bgCache.get(map.id);
    const c = off(TW, TH), g = c.getContext('2d'), r = rng(map.id.length * 977 + 13);
    // tráva
    const grd = g.createLinearGradient(0, 0, TW, TH);
    grd.addColorStop(0, '#4d8a3f'); grd.addColorStop(1, '#3f7a35');
    g.fillStyle = grd; g.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 2600; i++) {
      const x = r() * TW, y = r() * TH;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
      g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
    }
    for (let i = 0; i < 380; i++) {   // trsy trávy
      const x = r() * TW, y = r() * TH;
      g.strokeStyle = r() < 0.5 ? '#5fa34c' : '#356b2c'; g.lineWidth = 1.4;
      for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3 + (r() - 0.5) * 2, y - 5 - r() * 4); g.stroke(); }
    }
    for (let i = 0; i < 90; i++) {   // kvítka
      const x = r() * TW, y = r() * TH;
      g.fillStyle = ['#fde68a', '#fca5a5', '#f9a8d4', '#ffffff', '#c4b5fd'][Math.floor(r() * 5)];
      g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
    }
    // stromy na okrajích (nezasahují do cesty)
    for (let i = 0; i < 46; i++) {
      const edge = r() < 0.5, x = edge ? (r() < 0.5 ? r() * 40 : TW - r() * 40) : r() * TW, y = edge ? r() * TH : (r() < 0.5 ? r() * 34 : TH - r() * 34);
      if (distToTrackOn(paths, x, y) < 60) continue;
      tree(g, x, y, 14 + r() * 10, r);
    }
    // voda
    (map.water_zones || []).forEach(z => {
      g.save();
      rrect(g, z.x - 6, z.y - 6, z.width + 12, z.height + 12, 26); g.fillStyle = '#8b6b3e'; g.fill();
      rrect(g, z.x, z.y, z.width, z.height, 22);
      const wg = g.createLinearGradient(z.x, z.y, z.x, z.y + z.height); wg.addColorStop(0, '#3b82c4'); wg.addColorStop(1, '#1e5a96');
      g.fillStyle = wg; g.fill();
      g.strokeStyle = 'rgba(191,219,254,.6)'; g.lineWidth = 2; g.stroke();
      g.restore();
    });
    // cesta
    paths.forEach(p => {
      g.lineJoin = 'round'; g.lineCap = 'round';
      const line = () => { g.beginPath(); p.pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); };
      line(); g.strokeStyle = '#6b4a24'; g.lineWidth = TRACK_HALF * 2 + 10; g.stroke();
      line(); g.strokeStyle = '#b98b52'; g.lineWidth = TRACK_HALF * 2; g.stroke();
      line(); g.strokeStyle = 'rgba(255,240,200,.18)'; g.lineWidth = TRACK_HALF; g.stroke();
    });
    // kamínky na cestě
    paths.forEach(p => {
      for (let d = 0; d < p.len; d += 9) {
        const q = posAtOn(p, d), o = (r() - 0.5) * TRACK_HALF * 1.6;
        g.fillStyle = r() < 0.5 ? 'rgba(90,60,30,.35)' : 'rgba(255,235,200,.25)';
        g.beginPath(); g.arc(q.x + Math.cos(q.ang + 1.57) * o, q.y + Math.sin(q.ang + 1.57) * o, 1 + r() * 2, 0, TAU); g.fill();
      }
    });
    // překážky
    (map.obstacles || []).forEach(o => obstacle(g, o, r));
    // jeskyně na začátku, hrad na konci
    const starts = new Map(), ends = new Map();
    paths.forEach(p => { const a = p.pts[0], b = p.pts[p.pts.length - 1]; starts.set(a.x + ',' + a.y, a); ends.set(b.x + ',' + b.y, b); });
    starts.forEach(a => cave(g, a));
    ends.forEach(b => castle(g, b));
    bgCache.set(map.id, c);
    return c;
  }
  function posAtOn(p, d) {
    for (const s of p.segs) if (d <= s.from + s.l) { const k = (d - s.from) / s.l; return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, ang: s.ang }; }
    const s = p.segs[p.segs.length - 1]; return { x: s.b.x, y: s.b.y, ang: s.ang };
  }
  function distToTrackOn(paths, x, y) { let m = Infinity; for (const p of paths) for (const s of p.segs) m = Math.min(m, distToSeg(x, y, s.a, s.b)); return m; }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tree(g, x, y, s, r) {
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x + 4, y + 5, s, s * 0.7, 0, 0, TAU); g.fill();
    const cols = ['#2f6b2a', '#3a7d32', '#255a22'];
    for (let i = 0; i < 4; i++) { g.fillStyle = cols[i % 3]; g.beginPath(); g.arc(x + (r() - 0.5) * s * 0.7, y + (r() - 0.5) * s * 0.7, s * (0.55 + r() * 0.3), 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(x - s * 0.25, y - s * 0.3, s * 0.35, 0, TAU); g.fill();
  }
  function obstacle(g, o, r) {
    const cx = o.x + o.width / 2, cy = o.y + o.height / 2, n = o.name.toLowerCase();
    g.save();
    if (n.includes('věž')) {   // rozbořená strážní věž
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx + 6, cy + 8, o.width * 0.48, o.height * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = '#78716c'; g.beginPath(); g.arc(cx, cy, Math.min(o.width, o.height) * 0.42, 0, TAU); g.fill();
      g.fillStyle = '#a8a29e';
      for (let a = 0; a < TAU; a += TAU / 12) { if (r() < 0.25) continue; g.save(); g.translate(cx + Math.cos(a) * o.width * 0.36, cy + Math.sin(a) * o.height * 0.36); g.rotate(a); rrect(g, -9, -6, 18, 12, 3); g.fill(); g.restore(); }
      g.fillStyle = '#57534e'; g.beginPath(); g.arc(cx, cy, o.width * 0.22, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { g.fillStyle = '#a8a29e'; g.beginPath(); g.arc(cx + (r() - 0.5) * o.width, cy + (r() - 0.5) * o.height, 3 + r() * 5, 0, TAU); g.fill(); }
    } else {   // balvan / skalní útes
      const k = n.includes('útes') ? 6 : 3;
      for (let i = 0; i < k; i++) {
        const rx = cx + (r() - 0.5) * o.width * 0.5, ry = cy + (r() - 0.5) * o.height * 0.5, rr = Math.min(o.width, o.height) * (0.25 + r() * 0.2);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(rx + 5, ry + 6, rr, rr * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = '#6b7280'; g.beginPath();
        for (let a = 0; a < TAU; a += TAU / 9) { const q = rr * (0.8 + r() * 0.3); a ? g.lineTo(rx + Math.cos(a) * q, ry + Math.sin(a) * q) : g.moveTo(rx + q, ry); }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(rx - rr * 0.3, ry - rr * 0.3, rr * 0.4, 0, TAU); g.fill();
        if (n.includes('mech') || r() < 0.4) { g.fillStyle = '#4d7c0f'; g.beginPath(); g.arc(rx + rr * 0.2, ry - rr * 0.45, rr * 0.35, 0, TAU); g.fill(); }
      }
    }
    g.restore();
  }
  function cave(g, a) {
    const x = Math.max(18, Math.min(TW - 18, a.x)), y = a.y;
    g.save(); g.translate(x, y);
    g.fillStyle = '#57534e'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill();
    g.fillStyle = '#44403c'; g.beginPath(); g.arc(4, 0, 30, 0, TAU); g.fill();
    g.fillStyle = '#0c0a09'; g.beginPath(); g.ellipse(6, 0, 18, 24, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(132,204,22,.35)'; g.beginPath(); g.ellipse(8, 10, 12, 6, 0, 0, TAU); g.fill();
    g.restore();
  }
  function castle(g, b) {
    const x = Math.max(30, Math.min(TW - 30, b.x)), y = b.y;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-26, -54, 60, 112);
    g.fillStyle = '#9ca3af'; g.fillRect(-30, -58, 60, 116);
    g.fillStyle = '#6b7280';
    for (let i = -58; i < 58; i += 14) { g.fillRect(-30, i, 60, 2); }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#9ca3af'; g.fillRect(-34, -64 + i * 28, 10, 12); }
    g.fillStyle = '#4b2e14'; rrect(g, -20, -18, 26, 36, 10); g.fill();
    g.strokeStyle = '#1f1308'; g.lineWidth = 2; for (let i = -14; i < 6; i += 6) { g.beginPath(); g.moveTo(i, -16); g.lineTo(i, 16); g.stroke(); }
    g.fillStyle = '#2563eb'; g.beginPath(); g.moveTo(0, -58); g.lineTo(0, -84); g.lineTo(18, -77); g.lineTo(0, -70); g.fill();
    g.strokeStyle = '#3f3f46'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -58); g.lineTo(0, -86); g.stroke();
    g.restore();
  }

  /* ── Slizáci ───────────────────────────────────────────────── */
  function slimeSprite(e) {
    const key = e.t + (e.fort ? 'F' : '') + (e.armored ? 'A' : '');
    if (spriteCache.has(key)) return spriteCache.get(key);
    const r = e.def.r, S = Math.ceil(r * (e.def.isNew ? 3.4 : 2.8)), c = off(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2 + r * 0.1);
    const col = e.def.col === 'rainbow' ? '#f472b6' : e.def.col;
    newDeco(g, e.t, r, 'back');
    // tělo (kapka u Kapičky, jinak rosol)
    const body = () => {
      g.beginPath();
      if (e.t === 'kapicka_slizu') { g.moveTo(0, -r * 1.25); g.bezierCurveTo(r * 0.9, -r * 0.2, r, r * 0.9, 0, r * 0.9); g.bezierCurveTo(-r, r * 0.9, -r * 0.9, -r * 0.2, 0, -r * 1.25); }
      else { g.moveTo(-r, r * 0.75); g.bezierCurveTo(-r * 1.15, -r * 0.3, -r * 0.55, -r * 1.05, 0, -r * 1.05); g.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.15, -r * 0.3, r, r * 0.75); g.quadraticCurveTo(0, r * 1.05, -r, r * 0.75); }
      g.closePath();
    };
    body();
    if (e.def.col === 'rainbow') {
      const lg = g.createLinearGradient(-r, -r, r, r);
      ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].forEach((cc, i) => lg.addColorStop(i / 5, cc));
      g.fillStyle = lg;
    } else {
      const rg = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
      rg.addColorStop(0, lighten(col, 0.35)); rg.addColorStop(1, col);
      g.fillStyle = rg;
    }
    g.fill();
    g.lineWidth = Math.max(1.5, r * 0.12); g.strokeStyle = darken(col === '#f1f5f9' ? '#93c5fd' : col, 0.45); g.stroke();
    if (e.fort) { g.save(); g.clip(); g.fillStyle = 'rgba(120,113,108,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i % 3 - 1) * r * 0.7, (i > 2 ? 0.4 : -0.3) * r, r * 0.35, 0, TAU); g.fill(); } g.restore(); g.strokeStyle = '#57534e'; g.lineWidth = r * 0.18; g.stroke(); }
    // odlesk
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-r * 0.38, -r * 0.5, r * 0.22, r * 0.14, -0.6, 0, TAU); g.fill();
    // zvláštnosti
    if (e.t === 'zlaty_sliz') { g.strokeStyle = 'rgba(120,80,0,.6)'; g.lineWidth = 1.5; [[-0.5, -0.2, -0.1, 0.3], [0.2, -0.6, 0.5, 0], [0.1, 0.2, 0.5, 0.5]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a * r, b * r); g.lineTo((a + c2) / 2 * r + 3, (b + d) / 2 * r); g.lineTo(c2 * r, d * r); g.stroke(); }); }
    if (e.t === 'runovy_sliz') { g.strokeStyle = '#f5d0fe'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.3, 0); g.lineTo(0, r * 0.45); g.lineTo(-r * 0.3, 0); g.closePath(); g.stroke(); }
    if (e.t === 'cerny_sliz') { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(r * 0.3, -r * 0.2, r * 0.18, 0, TAU); g.fill(); }
    if (e.t === 'snezny_sliz') { g.strokeStyle = '#bae6fd'; g.lineWidth = 1.2; for (let a = 0; a < 3; a++) { g.save(); g.rotate(a * Math.PI / 3); g.beginPath(); g.moveTo(-r * 0.3, r * 0.25); g.lineTo(r * 0.3, r * 0.25); g.stroke(); g.restore(); } }
    if (e.t === 'stinosliz_prizrak') { g.fillStyle = 'rgba(167,139,250,.35)'; g.beginPath(); g.arc(0, 0, r * 0.6, 0, TAU); g.fill(); }
    if (e.def.isNew) { g.save(); body(); g.clip(); newDeco(g, e.t, r, 'body'); g.restore(); }
    // oči
    const eo = r * 0.32, ey = -r * 0.15, es = Math.max(2.2, r * 0.22);
    [-1, 1].forEach(s => {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s * eo, ey, es, es * 1.15, 0, 0, TAU); g.fill();
      g.fillStyle = e.def.boss ? '#dc2626' : '#111'; g.beginPath(); g.arc(s * eo + es * 0.3, ey + es * 0.15, es * 0.55, 0, TAU); g.fill();
    });
    if (e.def.boss) {   // zamračené obočí a koruna
      g.strokeStyle = '#111'; g.lineWidth = Math.max(2, r * 0.07);
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * eo * 1.7, ey - es * 1.6); g.lineTo(s * eo * 0.4, ey - es * 1.0); g.stroke(); });
      g.fillStyle = '#facc15'; g.strokeStyle = '#a16207'; g.lineWidth = 2;
      const cw = r * 0.9, ch = r * 0.45, cy = -r * 1.02;
      g.beginPath(); g.moveTo(-cw / 2, cy); g.lineTo(-cw / 2, cy - ch); g.lineTo(-cw / 4, cy - ch * 0.55); g.lineTo(0, cy - ch * 1.1); g.lineTo(cw / 4, cy - ch * 0.55); g.lineTo(cw / 2, cy - ch); g.lineTo(cw / 2, cy); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ef4444'; g.beginPath(); g.arc(0, cy - ch * 0.4, r * 0.08, 0, TAU); g.fill();
    }
    if (e.armored) {   // železná helma
      g.fillStyle = '#9ca3af'; g.strokeStyle = '#374151'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, -r * 0.35, r * 0.82, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(r * 0.82, -r * 0.2); g.lineTo(-r * 0.82, -r * 0.2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#4b5563'; g.fillRect(-r * 0.55, -r * 0.3, r * 1.1, r * 0.16);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(-r * 0.35, -r * 0.75, r * 0.12, 0, TAU); g.fill();
    }
    newDeco(g, e.t, r, 'front');
    spriteCache.set(key, c);
    return c;
  }
  // Kreslené znaky nových slizáků: 'back' za tělem, 'body' na těle (ořezané tvarem), 'front' přes oči
  function newDeco(g, id, r, layer) {
    const L = (w) => { g.lineWidth = Math.max(1.2, r * w); };
    const poly = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * r, y * r) : g.moveTo(x * r, y * r)); g.closePath(); };
    switch (id) {
      case 'bublinkovy_sliz':   // vznáší se v bublině
        if (layer === 'front') {
          g.fillStyle = 'rgba(165,243,252,.16)'; g.strokeStyle = 'rgba(207,250,254,.9)'; L(0.09);
          g.beginPath(); g.arc(0, -r * 0.1, r * 1.3, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.85)'; L(0.1); g.beginPath(); g.arc(0, -r * 0.1, r * 1.08, -2.6, -1.9); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(r * 0.75, -r * 0.85, r * 0.12, 0, TAU); g.fill();
          g.fillStyle = 'rgba(207,250,254,.8)'; g.beginPath(); g.arc(-r * 1.05, r * 0.65, r * 0.1, 0, TAU); g.arc(r * 1.1, r * 0.45, r * 0.07, 0, TAU); g.fill();
        }
        break;
      case 'zuivy_sliz':   // zamračené obočí, růžky a vztekající se pára
        if (layer === 'back') { g.fillStyle = '#7f1d1d'; poly([[-0.55, -0.8], [-0.75, -1.3], [-0.25, -0.95]]); g.fill(); poly([[0.55, -0.8], [0.75, -1.3], [0.25, -0.95]]); g.fill(); }
        if (layer === 'front') {
          g.strokeStyle = '#111'; L(0.13); g.lineCap = 'round';
          for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.62, -r * 0.6); g.lineTo(s * r * 0.12, -r * 0.36); g.stroke(); }
          g.beginPath(); g.moveTo(-r * 0.3, r * 0.42); g.quadraticCurveTo(0, r * 0.22, r * 0.3, r * 0.42); g.stroke();
          g.strokeStyle = '#fecaca'; L(0.1);   // značka vzteku
          const vx = r * 0.62, vy = -r * 0.95, k = r * 0.16;
          for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.beginPath(); g.moveTo(vx + a * k * 0.4, vy + b * k * 1.3); g.quadraticCurveTo(vx + a * k * 0.4, vy + b * k * 0.4, vx + a * k * 1.3, vy + b * k * 0.4); g.stroke(); }
          g.lineCap = 'butt';
        }
        break;
      case 'delivy_sliz':   // šev uprostřed a pupen, ze kterého se oddělí dvojčata
        if (layer === 'back') { g.fillStyle = '#65a30d'; g.strokeStyle = '#365314'; L(0.1); g.beginPath(); g.arc(-r * 0.95, r * 0.35, r * 0.38, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(-r * 0.98, r * 0.28, r * 0.07, 0, TAU); g.fill(); }
        if (layer === 'body') { g.strokeStyle = 'rgba(54,83,20,.75)'; L(0.09); g.setLineDash([r * 0.16, r * 0.12]); g.beginPath(); g.moveTo(0, -r * 1.1); g.quadraticCurveTo(r * 0.12, 0, 0, r * 1); g.stroke(); g.setLineDash([]); }
        break;
      case 'stitonos_sliz':   // přilba a kulatý štít vpředu
        if (layer === 'front') {
          g.fillStyle = '#94a3b8'; g.strokeStyle = '#1e293b'; L(0.08);
          g.beginPath(); g.arc(0, -r * 0.5, r * 0.62, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = '#e2e8f0'; g.beginPath(); g.moveTo(-r * 0.08, -r * 1.12); g.lineTo(r * 0.08, -r * 1.12); g.lineTo(r * 0.05, -r * 1.42); g.lineTo(-r * 0.05, -r * 1.42); g.closePath(); g.fill();
          const sx = r * 0.78, sy = r * 0.3, sr = r * 0.58;
          g.fillStyle = '#92400e'; g.strokeStyle = '#cbd5e1'; L(0.13); g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill(); g.stroke();
          g.strokeStyle = 'rgba(69,26,3,.6)'; L(0.06); g.beginPath(); g.moveTo(sx - sr * 0.85, sy); g.lineTo(sx + sr * 0.85, sy); g.moveTo(sx, sy - sr * 0.85); g.lineTo(sx, sy + sr * 0.85); g.stroke();
          g.fillStyle = '#e2e8f0'; g.beginPath(); g.arc(sx, sy, sr * 0.28, 0, TAU); g.fill();
        }
        break;
      case 'samansky_sliz':   // čelenka s pery, válečné barvy a hůl se zelenou koulí
        if (layer === 'back') {
          g.strokeStyle = '#78350f'; L(0.14); g.beginPath(); g.moveTo(-r * 0.95, r * 0.95); g.lineTo(-r * 0.75, -r * 1.05); g.stroke();
          g.fillStyle = '#4ade80'; g.strokeStyle = '#14532d'; L(0.07); g.beginPath(); g.arc(-r * 0.74, -r * 1.12, r * 0.24, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-r * 0.8, -r * 1.18, r * 0.07, 0, TAU); g.fill();
        }
        if (layer === 'body') { g.fillStyle = 'rgba(254,240,138,.85)'; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) g.fillRect(s * r * 0.32 - r * 0.2, r * (0.18 + i * 0.16), r * 0.4, r * 0.07); }
        if (layer === 'front') {
          g.fillStyle = '#b45309'; g.fillRect(-r * 0.72, -r * 0.78, r * 1.44, r * 0.18);
          [['#ef4444', -0.38, -0.25], ['#facc15', 0, 0], ['#3b82f6', 0.38, 0.25]].forEach(([c, x, a]) => {
            g.save(); g.translate(x * r, -r * 0.8); g.rotate(a); g.fillStyle = c; g.beginPath(); g.ellipse(0, -r * 0.3, r * 0.11, r * 0.32, 0, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 0.55); g.stroke(); g.restore();
          });
        }
        break;
      case 'krtci_sliz':   // hrabáky, růžový čumáček a hlína na zádech
        if (layer === 'back') { g.fillStyle = '#fbcfe8'; g.strokeStyle = '#831843'; L(0.06); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.85, r * 0.72, r * 0.3, r * 0.2, s * 0.4, 0, TAU); g.fill(); g.stroke(); } }
        if (layer === 'body') { g.fillStyle = 'rgba(69,26,3,.5)'; for (const [x, y, q] of [[-0.5, -0.75, 0.16], [0.1, -0.95, 0.12], [0.55, -0.7, 0.1], [-0.15, -0.6, 0.08]]) { g.beginPath(); g.arc(x * r, y * r, q * r, 0, TAU); g.fill(); } }
        if (layer === 'front') {
          g.fillStyle = '#f9a8d4'; g.strokeStyle = '#9d174d'; L(0.05); g.beginPath(); g.ellipse(0, r * 0.2, r * 0.22, r * 0.16, 0, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.95, r * 0.6); g.lineTo(s * r * 1.15, r * 0.82); g.lineTo(s * r * 0.98, r * 0.85); g.closePath(); g.fill(); }
        }
        break;
      case 'magneticky_sliz':   // podkovový magnet na hlavě a nýty
        if (layer === 'body') { g.fillStyle = '#64748b'; for (const [x, y] of [[-0.6, 0.35], [0.6, 0.35], [-0.2, 0.62], [0.2, 0.62]]) { g.beginPath(); g.arc(x * r, y * r, r * 0.07, 0, TAU); g.fill(); } }
        if (layer === 'front') {
          g.lineCap = 'butt'; g.strokeStyle = '#dc2626'; L(0.26); g.beginPath(); g.arc(0, -r * 1.0, r * 0.36, Math.PI, TAU); g.stroke();
          g.beginPath(); g.moveTo(-r * 0.36, -r * 1.0); g.lineTo(-r * 0.36, -r * 0.84); g.moveTo(r * 0.36, -r * 1.0); g.lineTo(r * 0.36, -r * 0.84); g.stroke();
          g.strokeStyle = '#f1f5f9'; g.beginPath(); g.moveTo(-r * 0.36, -r * 0.84); g.lineTo(-r * 0.36, -r * 0.68); g.moveTo(r * 0.36, -r * 0.84); g.lineTo(r * 0.36, -r * 0.68); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.5)'; L(0.06); g.beginPath(); g.arc(0, -r * 1.0, r * 0.4, 3.6, 4.4); g.stroke();
        }
        break;
      case 'mrazivy_plazivec':   // rampouchy na zádech a mrazivé vločky na těle
        if (layer === 'back') { g.fillStyle = '#e0f2fe'; g.strokeStyle = '#0369a1'; L(0.06); for (const [x, h] of [[-0.6, 0.45], [-0.2, 0.65], [0.2, 0.55], [0.55, 0.4]]) { poly([[x - 0.15, -0.8], [x, -0.8 - h], [x + 0.15, -0.8]]); g.fill(); g.stroke(); } }
        if (layer === 'body') {
          g.strokeStyle = 'rgba(255,255,255,.75)'; L(0.06);
          for (const [x, y] of [[-0.45, 0.4], [0.5, 0.45]]) for (let a = 0; a < 3; a++) { g.beginPath(); g.moveTo(x * r + Math.cos(a * 1.05) * r * 0.16, y * r + Math.sin(a * 1.05) * r * 0.16); g.lineTo(x * r - Math.cos(a * 1.05) * r * 0.16, y * r - Math.sin(a * 1.05) * r * 0.16); g.stroke(); }
        }
        if (layer === 'front') { g.fillStyle = '#f0f9ff'; poly([[-0.2, 0.32], [-0.12, 0.55], [-0.04, 0.32]]); g.fill(); poly([[0.04, 0.32], [0.12, 0.5], [0.2, 0.32]]); g.fill(); }
        break;
      case 'kralovna_roje':   // průsvitná křídla, pruhy a tykadla
        if (layer === 'back') {
          g.fillStyle = 'rgba(224,242,254,.7)'; g.strokeStyle = 'rgba(71,85,105,.7)'; L(0.03);
          for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.75, -r * 0.6, r * 0.5, r * 0.26, s * -0.7, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.ellipse(s * r * 0.95, -r * 0.2, r * 0.4, r * 0.2, s * -0.3, 0, TAU); g.fill(); g.stroke(); }
        }
        if (layer === 'body') { g.fillStyle = 'rgba(41,24,0,.55)'; for (const y of [0.25, 0.55, 0.85]) g.fillRect(-r * 1.2, y * r, r * 2.4, r * 0.13); }
        if (layer === 'front') {
          g.strokeStyle = '#292524'; L(0.04);
          for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.3, -r * 0.95); g.quadraticCurveTo(s * r * 0.55, -r * 1.35, s * r * 0.78, -r * 1.28); g.stroke(); g.fillStyle = '#292524'; g.beginPath(); g.arc(s * r * 0.78, -r * 1.28, r * 0.05, 0, TAU); g.fill(); }
        }
        break;
      case 'krystalovy_behemot':   // krystaly prorůstající hřbetem, plošky na těle
        if (layer === 'back') {
          for (const [x, h, w, a] of [[-0.6, 0.45, 0.16, -0.35], [-0.2, 0.6, 0.2, -0.1], [0.25, 0.5, 0.18, 0.15], [0.65, 0.35, 0.14, 0.45]]) {
            g.save(); g.translate(x * r, -r * 0.82); g.rotate(a);
            g.fillStyle = '#a5b4fc'; g.strokeStyle = '#312e81'; L(0.035); poly([[-w, 0], [-w * 0.6, -h], [0, -h - 0.12], [w * 0.6, -h], [w, 0]]); g.fill(); g.stroke();
            g.fillStyle = 'rgba(255,255,255,.45)'; poly([[-w * 0.5, -0.02], [-w * 0.3, -h], [0, -h - 0.1], [0, -0.02]]); g.fill();
            g.restore();
          }
        }
        if (layer === 'body') {
          g.strokeStyle = 'rgba(199,210,254,.45)'; L(0.03);
          g.beginPath(); g.moveTo(-r, r * 0.1); g.lineTo(-r * 0.4, r * 0.35); g.lineTo(r * 0.2, r * 0.15); g.lineTo(r, r * 0.4); g.moveTo(-r * 0.4, r * 0.35); g.lineTo(-r * 0.3, r); g.moveTo(r * 0.2, r * 0.15); g.lineTo(r * 0.35, r); g.stroke();
        }
        break;
    }
  }
  function lighten(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function darken(hex, k) { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * (1 - k) | 0},${(n >> 8 & 255) * (1 - k) | 0},${(n & 255) * (1 - k) | 0})`; }

  function drawEnemy(g, e, t) {
    const tex = useTDS() && window.TDS?.slimeDrawers?.[e.t];
    if (e.burrowUntil > t && !tex) { burrowMark(g, e, t); return; }   // pod zemí je vidět jen hromádka hlíny (textura si zahrabání kreslí sama)
    if (e.flying) { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(e.x + 6, e.y + e.def.r + 8, e.def.r * 0.85, e.def.r * 0.3, 0, 0, TAU); g.fill(); }
    // noví slizáci (part5): vlastní textura přes TDS.slimeDrawers, jinak náhradní grafika s jejich barvou
    if (useTDS() && TDS.slime && (!e.def.isNew || window.TDS?.slimeDrawers?.[e.t])) {
      const s = { camo: e.camo, revealed: e.revealed || G.revealUntil > t, regrow: e.regrow, fort: e.fort, armored: e.armored,
        frozen: e.frozenUntil > t, stunned: e.stunUntil > t, burn: !!(e.burn && e.burn.until > t), acid: !!(e.acid && e.acid.until > t),
        gold: e.goldMul > 1, hit: t - e.lastHit < 0.06 && e.lastHit > 0 };
      if (e.def.boss) { s.hpPct = Math.max(0, e.hp / e.maxHp); s.sealsTotal = e.seal ? e.seal.n : 0; s.sealsLeft = e.seal ? Math.ceil(e.seal.s * e.seal.n - 1e-6) : 0; }
      if (e.def.isNew) { newSlime(g, e, t, s); stateMarks(g, e, t); } else TDS.slime(g, e.t, e.x, e.y, e.def.r, e.ang || 0, performance.now(), s);
      if (e.regrow) regrowMark(g, e, t);
      traitMarks(g, e, t);
      if (!e.def.boss && e.def.hp > 1) {   // životy Zlatého slizu
        const w = e.def.r * 1.8, y = e.y - e.def.r * 1.5;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6);
        g.fillStyle = '#facc15'; g.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (e.immuneFlash && t - e.immuneFlash < 0.25) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, e.def.r + 5, -0.6, 0.6); g.stroke(); }
      return;
    }
    const r = e.def.r, spr = slimeSprite(e);
    const moving = !(e.frozenUntil > t || e.stunUntil > t);
    const sq = moving ? Math.sin(t * (e.def.speed / 9) + e.wob) * 0.08 : 0;
    // stín
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(e.x + 2, e.y + r * 0.8, r * 0.9, r * 0.32, 0, 0, TAU); g.fill();
    g.save();
    g.translate(e.x, e.y);
    if (e.camo && !e.revealed && !(G.revealUntil > t)) g.globalAlpha = 0.42;
    if (e.t === 'bleskovy_sliz' && moving) { g.fillStyle = 'rgba(253,224,71,.7)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(-Math.cos(e.ang || 0) * i * 7, -Math.sin(e.ang || 0) * i * 7 + Math.sin(t * 20 + i) * 3, 2, 0, TAU); g.fill(); } }
    g.scale(1 + sq, 1 - sq);
    if ((e.ang || 0) > Math.PI / 2 || (e.ang || 0) < -Math.PI / 2) g.scale(-1, 1);
    g.drawImage(spr, -spr.width / 2, -spr.height / 2 - r * 0.1);
    g.restore();
    // stavy
    if (e.regrow) { g.fillStyle = '#22c55e'; g.beginPath(); g.ellipse(e.x + 2, e.y - r * 1.1, 3, 5.5, 0.6, 0, TAU); g.fill(); g.strokeStyle = '#166534'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(e.x, e.y - r * 0.85); g.lineTo(e.x + 2, e.y - r * 1.3); g.stroke(); }
    if (e.camo && !e.revealed) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([3, 4]); g.lineWidth = 1.2; g.beginPath(); g.arc(e.x, e.y, r + 3, 0, TAU); g.stroke(); g.setLineDash([]); }
    if (e.frozenUntil > t) { g.fillStyle = 'rgba(186,230,253,.55)'; g.beginPath(); g.arc(e.x, e.y, r * 1.08, 0, TAU); g.fill(); g.strokeStyle = '#e0f2fe'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const a = i * 2.1; g.beginPath(); g.moveTo(e.x + Math.cos(a) * r * 0.3, e.y + Math.sin(a) * r * 0.3); g.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); g.stroke(); } }
    if (e.stunUntil > t) { for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fde047'; star(g, e.x + Math.cos(a) * r * 0.9, e.y - r * 1.1 + Math.sin(a) * 3, 3.5); } }
    if (e.burn && e.burn.until > t) { g.fillStyle = `rgba(249,115,22,${0.6 + Math.sin(t * 20) * 0.2})`; g.beginPath(); g.ellipse(e.x + Math.sin(t * 9) * 2, e.y - r * 0.6, 3.5, 6, 0, 0, TAU); g.fill(); }
    if (e.acid && e.acid.until > t) { g.fillStyle = 'rgba(163,230,53,.75)'; g.beginPath(); g.arc(e.x + Math.sin(t * 7 + e.id) * r * 0.5, e.y - r * 0.3 - ((t * 20 + e.id) % 10), 2, 0, TAU); g.fill(); }
    if (e.goldMul > 1) { g.strokeStyle = 'rgba(250,204,21,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, r + 2, 0, TAU); g.stroke(); }
    if (e.immuneFlash && t - e.immuneFlash < 0.25) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, r + 5, -0.6, 0.6); g.stroke(); }
    if (e.regrow) regrowMark(g, e, t);
    traitMarks(g, e, t);
    // bossové: životy a pečeť
    if (e.def.boss || e.def.hp > 1) {
      const w = e.def.boss ? r * 2 : r * 1.8, y = e.y - r * (e.def.boss ? 1.75 : 1.4);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle = e.def.boss ? '#ef4444' : '#facc15'; g.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
    if (e.seal && e.seal.s > 0) {
      const n = e.seal.n, left = Math.ceil(e.seal.s * n - 1e-6);
      g.save(); g.translate(e.x, e.y); g.rotate(t * 0.8);
      g.strokeStyle = 'rgba(196,181,253,.85)'; g.lineWidth = 3;
      for (let i = 0; i < n; i++) {
        if (i >= left) continue;
        const a0 = i * TAU / n + 0.12, a1 = (i + 1) * TAU / n - 0.12;
        g.beginPath(); g.arc(0, 0, r + 8, a0, a1); g.stroke();
        g.fillStyle = '#ede9fe'; star(g, Math.cos((a0 + a1) / 2) * (r + 8), Math.sin((a0 + a1) / 2) * (r + 8), 4);
      }
      g.restore();
    }
  }
  // Textura nového slizáka od Gemini (TDS.slimeDrawers[id](ctx, r, ts, s)): natočená po směru pohybu
  function newSlime(g, e, t, s) {
    g.save(); g.translate(e.x, e.y);
    if (e.camo && !s.revealed) g.globalAlpha = 0.42;
    if (!e.def.boss) g.rotate(e.ang || 0);   // bossové se netočí (lišta životů a pečeť zůstanou vodorovně)
    const tp = e.def.tp || {};
    const st = { ...s, shield: e.shieldUntil > t, enraged: e.rageUntil > t, bubble: e.bubble > 0, flying: !!e.flying,
      shieldAura: !!tp.ally_damage_reduction_pct, healing: tp.pulse_interval_s ? (e.healAt || 0) - tp.pulse_interval_s > t - 0.6 : false,
      burrowed: e.burrowUntil > t, magnetActive: !!tp.magnet_radius_px, chilling: !!tp.tower_attack_speed_slow_pct,
      spawning: tp.spawn_interval_s ? (e.broodAt || 0) - tp.spawn_interval_s > t - 0.7 : false, shellActive: e.prismUntil > t, prism: e.prismUntil > t };
    try { TDS.slimeDrawers[e.t](g, e.def.r, performance.now(), st); } catch (_) { /* nic */ }
    g.restore();
  }
  // Stavy pro textury nových slizáků (ty kreslí jen tělo)
  function stateMarks(g, e, t) {
    const r = e.def.r;
    if (e.frozenUntil > t) { g.fillStyle = 'rgba(186,230,253,.55)'; g.beginPath(); g.arc(e.x, e.y, r * 1.08, 0, TAU); g.fill(); g.strokeStyle = '#e0f2fe'; g.lineWidth = 1.5; g.stroke(); }
    if (e.stunUntil > t) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; g.fillStyle = '#fde047'; star(g, e.x + Math.cos(a) * r * 0.9, e.y - r * 1.1 + Math.sin(a) * 3, 3.5); }
    if (e.burn && e.burn.until > t) { g.fillStyle = `rgba(249,115,22,${0.6 + Math.sin(t * 20) * 0.2})`; g.beginPath(); g.ellipse(e.x + Math.sin(t * 9) * 2, e.y - r * 0.6, 3.5, 6, 0, 0, TAU); g.fill(); }
    if (e.acid && e.acid.until > t) { g.fillStyle = 'rgba(163,230,53,.75)'; g.beginPath(); g.arc(e.x + Math.sin(t * 7 + e.id) * r * 0.5, e.y - r * 0.3 - ((t * 20 + e.id) % 10), 2, 0, TAU); g.fill(); }
    if (e.goldMul > 1) { g.strokeStyle = 'rgba(250,204,21,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, r + 2, 0, TAU); g.stroke(); }
    if (e.camo && !e.revealed && !(G.revealUntil > t)) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([3, 4]); g.lineWidth = 1.2; g.beginPath(); g.arc(e.x, e.y, r + 3, 0, TAU); g.stroke(); g.setLineDash([]); }
  }
  // Značky schopností nových slizáků (aby šly poznat i bez textur)
  function traitMarks(g, e, t) {
    const r = e.def.r, tp = e.def.tp;
    if (e.shieldUntil > t) { g.strokeStyle = 'rgba(96,165,250,.75)'; g.lineWidth = 1.6; g.beginPath(); g.arc(e.x, e.y, r + 2.5, -2.4, -0.7); g.stroke(); }
    if (tp?.ally_damage_reduction_pct) { g.fillStyle = 'rgba(96,165,250,.08)'; g.strokeStyle = 'rgba(96,165,250,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(e.x, e.y, tp.aura_radius_px || 75, 0, TAU); g.fill(); g.stroke(); }
    if (e.rageUntil > t) { g.strokeStyle = `rgba(239,68,68,${0.5 + Math.sin(t * 14) * 0.3})`; g.lineWidth = 2.5; g.beginPath(); g.arc(e.x, e.y, r + 3, 0, TAU); g.stroke(); }
    if (e.bubble > 0) { g.strokeStyle = 'rgba(165,243,252,.9)'; g.fillStyle = 'rgba(165,243,252,.15)'; g.lineWidth = 1.5; g.beginPath(); g.arc(e.x, e.y, r + 5, 0, TAU); g.fill(); g.stroke(); }
    if (e.haste) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4; const a = (e.ang || 0) + Math.PI; for (let i = -1; i <= 1; i++) { const ox = e.x + Math.cos(a) * (r + 3) + Math.cos(a + 1.57) * i * r * 0.45, oy = e.y + Math.sin(a) * (r + 3) + Math.sin(a + 1.57) * i * r * 0.45; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * 7, oy + Math.sin(a) * 7); g.stroke(); } }
    if (e.prismUntil > t) { g.strokeStyle = 'rgba(196,181,253,.95)'; g.fillStyle = 'rgba(167,139,250,.22)'; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t; i ? g.lineTo(e.x + Math.cos(a) * (r + 8), e.y + Math.sin(a) * (r + 8)) : g.moveTo(e.x + Math.cos(a) * (r + 8), e.y + Math.sin(a) * (r + 8)); } g.closePath(); g.fill(); g.stroke(); }
    if (tp?.magnet_radius_px) { g.strokeStyle = 'rgba(59,130,246,.45)'; g.lineWidth = 1.2; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(e.x, e.y, r + 6 + i * 6, t * 3 + i, t * 3 + i + 2.2); g.stroke(); } }
    if (e.flying && e.t !== 'bublinkovy_sliz' && (!useTDS() || !window.TDS?.slimeDrawers?.[e.t])) { g.fillStyle = 'rgba(255,255,255,.85)'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(e.x + sd * r * 0.95, e.y - r * 0.2, r * 0.45, r * 0.22, sd * (0.5 + Math.sin(t * 18) * 0.3), 0, TAU); g.fill(); } }
  }
  function burrowMark(g, e, t) {
    const r = e.def.r;
    g.fillStyle = '#78350f'; g.beginPath(); g.ellipse(e.x, e.y + 2, r * 0.95, r * 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#a16207'; for (let i = 0; i < 4; i++) { const a = i * 1.6 + t * 6; g.beginPath(); g.arc(e.x + Math.cos(a) * r * 0.7, e.y + Math.sin(a) * r * 0.35, 2, 0, TAU); g.fill(); }
  }
  // Dorůstající slizák: pulzující zelený kruh a odznak se šipkou dokola (lísteček na hlavě byl moc nenápadný)
  function regrowMark(g, e, t) {
    const r = e.def.r, a = 0.45 + Math.sin(t * 5 + e.wob) * 0.25;
    g.strokeStyle = `rgba(74,222,128,${a})`; g.lineWidth = 2;
    g.beginPath(); g.arc(e.x, e.y, r + 3.5, 0, TAU); g.stroke();
    const br = Math.max(4.5, Math.min(8, r * 0.45)), bx = e.x + r * 0.8, by = e.y - r * 0.8;
    g.fillStyle = '#16a34a'; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
    g.strokeStyle = '#052e16'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.2, br * 0.28);
    g.beginPath(); g.arc(bx, by, br * 0.52, -0.2, 4.6); g.stroke();
    const ex = bx + Math.cos(-0.2) * br * 0.52, ey = by + Math.sin(-0.2) * br * 0.52;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(ex + br * 0.32, ey - br * 0.05); g.lineTo(ex - br * 0.28, ey - br * 0.1); g.lineTo(ex + br * 0.02, ey + br * 0.42); g.closePath(); g.fill();
  }
  function star(g, x, y, s) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? s * 0.45 : s; i ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : g.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); }

  /* ── Věže ──────────────────────────────────────────────────── */
  const PATH_COL = ['#f97316', '#38bdf8', '#a3e635'];
  function drawTower(g, t, time, sel) {
    const def = TDEF[t.type], r = t.r, tier = Math.max(...t.up);
    if (useTDS() && window.TDS?.drawers?.[t.type]) {   // nová grafika (js/td-sprites-b/c.js)
      const fired = t.firedAt != null ? Math.max(0, 1 - (G.time - t.firedAt) / 0.1) : 0;
      const cock = Math.max(0, Math.min(1, 1 - Math.max(0, t.cd || 0) / (t.st?.interval || 1)));
      const still = t.type === 'strazni_hlaska' || t.type === 'zlaty_dul';   // budovy se neotáčí za cílem
      TDS.tower(g, t.type, t.x, t.y, t.r, still ? 0 : (t.ang || 0), performance.now(), t.up, { cock, mode: t.mode, beast: t.beastUntil > G.time, buffed: !!(t.buff && t.buff.until > G.time), firing: fired });
      if (tier >= 5) { g.strokeStyle = `rgba(250,204,21,${0.4 + Math.sin(time * 3) * 0.25})`; g.lineWidth = 3; g.beginPath(); g.arc(t.x, t.y, r + 6, 0, TAU); g.stroke(); }
    } else {
    g.save(); g.translate(t.x, t.y);
    // stín a podstavec
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(3, r * 0.55, r * 1.05, r * 0.5, 0, 0, TAU); g.fill();
    if (t.type !== 'ricni_galera') {
      g.fillStyle = tier >= 5 ? '#fde68a' : tier >= 4 ? '#d6d3d1' : '#a8a29e';
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.strokeStyle = tier >= 5 ? '#ca8a04' : '#57534e'; g.lineWidth = tier >= 4 ? 3 : 2; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.12)'; for (let a = 0; a < TAU; a += TAU / 8) { g.beginPath(); g.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 1.4, 0, TAU); g.fill(); }
    }
    if (tier >= 5) { g.strokeStyle = `rgba(250,204,21,${0.4 + Math.sin(time * 3) * 0.25})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r + 5, 0, TAU); g.stroke(); }
    const col = def.col, ang = t.ang || 0;
    switch (t.type) {
      case 'kralovsky_lucistnik': figure(g, r, col, ang, '#14532d', () => bow(g, r, ang, t.up[2] >= 3)); break;
      case 'cepova_vez': {
        const spin = t.fx?.strip_regrow ? time * 4 : 0;
        g.save(); g.rotate(spin);
        const n = Math.max(8, Math.round(t.st?.projectiles || 8));
        g.fillStyle = t.fx?.burn_dps || t.fx?.continuous_aura ? '#f97316' : '#d6d3d1';
        for (let i = 0; i < n; i++) { const a = i / n * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); g.lineTo(Math.cos(a + 0.12) * r * 0.95, Math.sin(a + 0.12) * r * 0.95); g.lineTo(Math.cos(a - 0.12) * r * 0.95, Math.sin(a - 0.12) * r * 0.95); g.fill(); }
        g.restore();
        g.fillStyle = '#78350f'; g.beginPath(); g.arc(0, 0, r * 0.6, 0, TAU); g.fill();
        g.strokeStyle = '#a16207'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.stroke();
        if (t.fx?.continuous_aura) { g.fillStyle = `rgba(253,186,116,${0.5 + Math.sin(time * 9) * 0.3})`; g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.fill(); }
        break;
      }
      case 'mrazivy_mag': figure(g, r, '#0ea5e9', ang, '#e0f2fe', () => { g.fillStyle = '#bae6fd'; star(g, Math.cos(ang) * r * 0.85, Math.sin(ang) * r * 0.85, 6); }); break;
      case 'orli_ostrostrelec': {
        g.fillStyle = '#92400e'; g.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
        g.strokeStyle = '#451a03'; g.lineWidth = 2; g.strokeRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
        g.rotate(ang); g.fillStyle = '#1f2937'; g.fillRect(0, -2.5, r * 1.35, 5); g.fillStyle = '#a16207'; g.fillRect(-r * 0.3, -4, r * 0.6, 8);
        g.rotate(-ang); g.fillStyle = '#fde68a'; g.beginPath(); g.arc(0, 0, r * 0.32, 0, TAU); g.fill();
        break;
      }
      case 'oblehaci_katapult': {
        g.rotate(ang);
        g.fillStyle = '#92400e'; g.fillRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.1);
        g.strokeStyle = '#451a03'; g.lineWidth = 2; g.strokeRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.1);
        g.fillStyle = '#57534e'; [-1, 1].forEach(s => { g.beginPath(); g.arc(-r * 0.5, s * r * 0.62, r * 0.2, 0, TAU); g.fill(); g.beginPath(); g.arc(r * 0.5, s * r * 0.62, r * 0.2, 0, TAU); g.fill(); });
        const cock = Math.max(0, Math.min(1, 1 - Math.max(0, t.cd || 0) / (t.st?.interval || 1)));
        g.strokeStyle = '#78350f'; g.lineWidth = 4; g.beginPath(); g.moveTo(-r * 0.2, 0); g.lineTo(r * (0.2 + 0.6 * cock), 0); g.stroke();
        g.fillStyle = '#3f3f46'; g.beginPath(); g.arc(r * (0.2 + 0.6 * cock), 0, r * 0.25, 0, TAU); g.fill();
        break;
      }
      case 'ricni_galera': {
        g.rotate(ang);
        g.fillStyle = '#7c2d12'; g.beginPath(); g.moveTo(r * 1.2, 0); g.quadraticCurveTo(r * 0.4, r * 0.75, -r, r * 0.55); g.lineTo(-r, -r * 0.55); g.quadraticCurveTo(r * 0.4, -r * 0.75, r * 1.2, 0); g.fill();
        g.strokeStyle = '#431407'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#a16207'; g.fillRect(-r * 0.7, -r * 0.3, r * 1.3, r * 0.6);
        g.fillStyle = t.mode === 'lighthouse' ? '#fde047' : '#f5f5f4'; g.beginPath(); g.moveTo(-r * 0.1, -r * 0.9); g.lineTo(r * 0.5, 0); g.lineTo(-r * 0.1, r * 0.9); g.closePath(); g.fill();
        g.fillStyle = '#44403c'; g.beginPath(); g.arc(-r * 0.1, 0, 2.5, 0, TAU); g.fill();
        if (t.mode === 'lighthouse') { g.rotate(-ang); g.fillStyle = `rgba(253,224,71,${0.25 + Math.sin(time * 4) * 0.15})`; g.beginPath(); g.arc(0, 0, r * 1.5, 0, TAU); g.fill(); }
        break;
      }
      case 'arkanni_carodej': figure(g, r, '#6d28d9', ang, '#4c1d95', () => {
        g.strokeStyle = '#a16207'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(Math.cos(ang) * r * 0.2, Math.sin(ang) * r * 0.2); g.lineTo(Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95); g.stroke();
        g.fillStyle = t.st?.type === 'true' ? '#f5d0fe' : '#c084fc'; g.beginPath(); g.arc(Math.cos(ang) * r, Math.sin(ang) * r, 4.5 + Math.sin(time * 6) * 0.8, 0, TAU); g.fill();
      }, true); break;
      case 'kralovsky_alchymista': figure(g, r, '#4d7c0f', ang, '#d9f99d', () => {
        g.fillStyle = '#a3e635'; g.beginPath(); g.arc(Math.cos(ang) * r * 0.8, Math.sin(ang) * r * 0.8, 5, 0, TAU); g.fill();
        g.fillStyle = '#e7e5e4'; g.fillRect(Math.cos(ang) * r * 0.8 - 1.5, Math.sin(ang) * r * 0.8 - 9, 3, 5);
      }); if (t.beastUntil > G.time) { g.fillStyle = `rgba(232,121,249,${0.3 + Math.sin(time * 12) * 0.2})`; g.beginPath(); g.arc(0, 0, r * 1.3, 0, TAU); g.fill(); } break;
      case 'strazni_hlaska': {
        g.fillStyle = '#6b7280'; g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        g.fillStyle = '#9ca3af'; for (let i = 0; i < 4; i++) { g.fillRect(-r * 0.7 + i * r * 0.42, -r * 0.88, r * 0.26, r * 0.22); }
        g.strokeStyle = '#374151'; g.lineWidth = 2; g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        g.strokeStyle = '#3f3f46'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 0.2); g.lineTo(0, -r * 1.35); g.stroke();
        g.fillStyle = '#2563eb'; g.beginPath(); g.moveTo(0, -r * 1.35); g.quadraticCurveTo(r * 0.5, -r * 1.25 + Math.sin(time * 5) * 2, r * 0.8, -r * 1.15); g.lineTo(0, -r * 0.85); g.fill();
        break;
      }
      case 'zlaty_dul': {
        g.fillStyle = '#78716c'; g.beginPath(); g.arc(0, 0, r * 0.95, Math.PI, 0); g.lineTo(r * 0.95, r * 0.5); g.lineTo(-r * 0.95, r * 0.5); g.closePath(); g.fill();
        g.fillStyle = '#1c1917'; g.beginPath(); g.arc(0, r * 0.2, r * 0.5, Math.PI, 0); g.lineTo(r * 0.5, r * 0.5); g.lineTo(-r * 0.5, r * 0.5); g.closePath(); g.fill();
        g.strokeStyle = '#92400e'; g.lineWidth = 3; g.beginPath(); g.arc(0, r * 0.2, r * 0.55, Math.PI, 0); g.stroke();
        g.fillStyle = '#facc15'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-r * 0.35 + i * r * 0.22, r * 0.72, r * 0.12, 0, TAU); g.fill(); }
        if (t.bank) { g.fillStyle = '#fde68a'; g.font = 'bold 10px Geist, sans-serif'; g.textAlign = 'center'; g.fillText(Math.round(t.bank), 0, -r * 1.05); }
        break;
      }
      // ── nové věže v kresleném stylu (podle úrovní cest) ──
      case 'kladec_pasti': {   // dřevěná dílna s házecím ramenem a bednou ježků
        const u = t.up, crystal = u[2] >= 3, mine = u[0] >= 4;
        g.fillStyle = crystal ? '#64748b' : '#8b5a2b'; g.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
        g.strokeStyle = '#3f2a14'; g.lineWidth = 2; g.strokeRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-r * 0.62, -r * 0.62 + i * r * 0.31); g.lineTo(r * 0.62, -r * 0.62 + i * r * 0.31); g.stroke(); }
        g.fillStyle = crystal ? '#38bdf8' : u[0] >= 2 ? '#f97316' : '#a8a29e';   // bedna s hroty (rozžhavené / krystalové)
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; g.beginPath(); g.moveTo(-r * 0.32 + Math.cos(a) * 5, r * 0.3 + Math.sin(a) * 5); g.lineTo(-r * 0.32 + Math.cos(a + 1.2) * 1.5, r * 0.3 + Math.sin(a + 1.2) * 1.5); g.lineTo(-r * 0.32 + Math.cos(a - 1.2) * 1.5, r * 0.3 + Math.sin(a - 1.2) * 1.5); g.fill(); }
        if (u[0] >= 3) { g.strokeStyle = '#d6d3d1'; g.lineWidth = 2; g.beginPath(); g.arc(r * 0.32, r * 0.32, r * 0.2, Math.PI, 0); g.stroke(); }   // ocelové čelisti
        if (mine) { g.fillStyle = '#b91c1c'; [[-0.45, -0.45], [0.45, -0.45]].forEach(([x, y]) => { g.beginPath(); g.arc(x * r, y * r, r * 0.14, 0, TAU); g.fill(); }); }   // výbušné soudky
        g.save(); g.rotate(ang); g.strokeStyle = '#5b3a1e'; g.lineWidth = 3.5; g.lineCap = 'round';   // házecí rameno
        g.beginPath(); g.moveTo(-r * 0.1, 0); g.lineTo(r * 0.75, 0); g.stroke(); g.fillStyle = '#44403c'; g.beginPath(); g.arc(r * 0.75, 0, r * 0.16, 0, TAU); g.fill();
        if (u[1] >= 1) { g.lineWidth = 2.5; g.beginPath(); g.moveTo(-r * 0.1, r * 0.25); g.lineTo(r * 0.55, r * 0.25); g.stroke(); }
        g.restore(); g.lineCap = 'butt';
        break;
      }
      case 'lesni_druid': {
        const u = t.up, bear = u[2] >= 3;
        if (u[1] >= 3) { g.strokeStyle = '#15803d'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, r * 0.86, i * 2.1 + time * 0.4, i * 2.1 + 1.2 + time * 0.4); g.stroke(); } g.fillStyle = '#f43f5e'; for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.6 + time * 0.4; g.beginPath(); g.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 2.2, 0, TAU); g.fill(); } }
        if (u[0] >= 3) { g.strokeStyle = 'rgba(226,232,240,.6)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, r * 0.95, time * 3, time * 3 + 4); g.stroke(); }
        figure(g, r, bear ? '#78350f' : u[0] >= 3 ? '#e2e8f0' : '#166534', ang, bear ? '#451a03' : '#4d7c0f', () => {
          g.save(); g.rotate(ang); g.strokeStyle = '#78350f'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, r * 0.35); g.lineTo(r * 0.95, r * 0.35); g.stroke();   // hůl
          g.lineWidth = 1.6; g.beginPath(); g.moveTo(r * 0.95, r * 0.35); g.lineTo(r * 1.12, r * 0.18); g.moveTo(r * 0.95, r * 0.35); g.lineTo(r * 1.12, r * 0.52); g.stroke();   // paroží
          if (u[0] >= 2) { g.fillStyle = `rgba(96,165,250,${0.7 + Math.sin(time * 9) * 0.3})`; g.beginPath(); g.arc(r * 0.95, r * 0.35, 3, 0, TAU); g.fill(); }
          g.restore();
        });
        if (bear) { g.fillStyle = '#78350f'; [-1, 1].forEach(s => { g.beginPath(); g.arc(Math.cos(ang + s * 0.9) * r * 0.32, Math.sin(ang + s * 0.9) * r * 0.32, r * 0.12, 0, TAU); g.fill(); }); }   // medvědí uši
        break;
      }
      case 'stinovy_zved': {
        const u = t.up;
        if (u[1] >= 2) { g.fillStyle = `rgba(147,51,234,${0.18 + Math.sin(time * 3) * 0.06})`; g.beginPath(); g.arc(0, 0, r * 1.05, 0, TAU); g.fill(); }
        figure(g, r, '#1e293b', ang, u[0] >= 4 ? '#e2e8f0' : '#b91c1c', () => {
          const n = u[0] >= 4 ? 3 : u[0] >= 3 ? 2 : 1;
          for (let i = 0; i < n; i++) { const a = ang + (i - (n - 1) / 2) * 0.7; g.fillStyle = u[0] >= 5 ? '#facc15' : '#cbd5e1'; star(g, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 4.5); }
          if (u[2] >= 3) { g.fillStyle = '#111'; g.beginPath(); g.arc(Math.cos(ang - 1.6) * r * 0.6, Math.sin(ang - 1.6) * r * 0.6, 3.6, 0, TAU); g.fill(); g.fillStyle = '#f97316'; g.beginPath(); g.arc(Math.cos(ang - 1.6) * r * 0.6 + 2.5, Math.sin(ang - 1.6) * r * 0.6 - 2.5, 1.5, 0, TAU); g.fill(); }
        });
        g.fillStyle = '#0f172a'; g.beginPath(); g.arc(Math.cos(ang) * 1, Math.sin(ang) * 1, r * 0.34, ang - 2.4, ang + 2.4, true); g.fill();   // kukla
        break;
      }
      case 'gryfi_jezdec': {   // proutěné hnízdo, gryf sám létá nad mapou
        g.fillStyle = '#a16207'; g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill();
        g.strokeStyle = '#713f12'; g.lineWidth = 1.5; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.32, a + 1, a + 2.4); g.stroke(); }
        g.fillStyle = '#fef3c7'; [[-0.2, 0.05], [0.18, -0.1], [0.05, 0.25]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x * r, y * r, r * 0.13, r * 0.17, 0.4, 0, TAU); g.fill(); });
        g.strokeStyle = '#44403c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(r * 0.55, -r * 0.2); g.lineTo(r * 0.55, -r * 1.05); g.stroke();
        g.fillStyle = t.up[1] >= 3 ? '#b91c1c' : '#2563eb'; g.beginPath(); g.moveTo(r * 0.55, -r * 1.05); g.lineTo(r * 1.05, -r * 0.92 + Math.sin(time * 5) * 2); g.lineTo(r * 0.55, -r * 0.78); g.fill();
        break;
      }
      case 'oblehaci_mozdir': {
        const u = t.up, two = u[1] >= 3, rich = u[2] >= 4 || u[0] >= 5;
        g.fillStyle = '#78716c'; g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.fill();
        g.fillStyle = '#57534e'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillRect(Math.cos(a) * r * 0.7 - 2.5, Math.sin(a) * r * 0.7 - 2.5, 5, 5); }
        g.save(); g.rotate(ang);
        const tube = (dy, w) => { g.fillStyle = rich ? '#7f1d1d' : '#292524'; g.beginPath(); g.ellipse(r * 0.2, dy, r * 0.55, w, 0, 0, TAU); g.fill();
          g.fillStyle = rich ? '#facc15' : '#a8a29e'; g.beginPath(); g.arc(r * 0.62, dy, w * 0.95, 0, TAU); g.fill(); g.fillStyle = '#0c0a09'; g.beginPath(); g.arc(r * 0.62, dy, w * 0.62, 0, TAU); g.fill(); };
        const w = r * (u[0] >= 1 ? 0.32 : 0.27);
        if (two) { tube(-w * 0.9, w * 0.8); tube(w * 0.9, w * 0.8); } else tube(0, w);
        if (u[2] >= 2) { g.fillStyle = `rgba(249,115,22,${0.5 + Math.sin(time * 10) * 0.3})`; g.beginPath(); g.arc(r * 0.62, 0, w * 0.4, 0, TAU); g.fill(); }
        g.restore();
        break;
      }
      case 'trpaslici_inzenyr': {
        const u = t.up;
        if (u[0] >= 2) { g.fillStyle = '#b45309'; g.beginPath(); g.arc(Math.cos(ang + Math.PI) * r * 0.55, Math.sin(ang + Math.PI) * r * 0.55, r * 0.3, 0, TAU); g.fill(); g.strokeStyle = '#78350f'; g.lineWidth = 1.5; g.stroke(); }   // parní kotel na zádech
        figure(g, r, '#c2410c', ang, '#7c2d12', () => {
          const gun = off => { g.save(); g.rotate(ang + off); g.fillStyle = '#57534e'; g.fillRect(r * 0.2, -2.5, r * 0.75, 5); g.fillStyle = '#d97706'; g.fillRect(r * 0.15, -3.5, r * 0.3, 7); g.restore(); };
          gun(u[2] >= 3 ? -0.35 : 0); if (u[2] >= 3) gun(0.35);
          if (u[1] >= 3) { g.strokeStyle = '#e5e7eb'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(Math.cos(ang - 1.4) * r * 0.5, Math.sin(ang - 1.4) * r * 0.5); g.quadraticCurveTo(Math.cos(ang - 0.8) * r, Math.sin(ang - 0.8) * r, Math.cos(ang - 0.3) * r * 0.95, Math.sin(ang - 0.3) * r * 0.95); g.stroke(); }   // hadice s pěnou
        });
        g.fillStyle = '#facc15'; g.beginPath(); g.arc(Math.cos(ang) * 1, Math.sin(ang) * 1, r * 0.36, 0, TAU); g.fill();   // hornická přilba
        g.fillStyle = '#fef9c3'; g.beginPath(); g.arc(Math.cos(ang) * r * 0.3, Math.sin(ang) * r * 0.3, 2.4, 0, TAU); g.fill();
        break;
      }
      default: {   // nové věže, dokud nemají textury: barevný kruh se znakem, který se natáčí za cílem
        g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke();
        if (t.type !== 'kladec_pasti' && t.type !== 'gryfi_jezdec') { g.save(); g.rotate(ang); g.fillStyle = '#292524'; g.fillRect(r * 0.35, -2.5, r * 0.6, 5); g.restore(); }
        if (typeof XR !== 'undefined') XR.emoji(g, def.ico, 0, 1, r * 1.05);
      }
    }
    g.restore();
    }
    if (t.stunUntil > G.time) { g.fillStyle = 'rgba(186,230,253,.45)'; g.strokeStyle = '#e0f2fe'; g.lineWidth = 2; g.beginPath(); g.arc(t.x, t.y, r + 4, 0, TAU); g.fill(); g.stroke(); }
    else if (t.chillUntil > G.time) { g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath(); g.arc(t.x, t.y, r + 4, 0, TAU); g.stroke(); g.setLineDash([]); }
    // vyznačení úrovní cest (tečky pod věží)
    let py = t.y + r + 5;
    t.up.forEach((n, i) => {
      if (!n) return;
      for (let k = 0; k < n; k++) { g.fillStyle = PATH_COL[i]; g.beginPath(); g.arc(t.x - (n - 1) * 3.5 + k * 7, py, 2.6, 0, TAU); g.fill(); }
      py += 6;
    });
    if (t.buff && t.buff.until > G.time) { g.fillStyle = '#f472b6'; g.beginPath(); g.arc(t.x + r * 0.8, t.y - r * 0.8, 4, 0, TAU); g.fill(); }
    if (t.hornUntil > G.time || G.hornAll > G.time) { g.strokeStyle = 'rgba(250,204,21,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(t.x, t.y, r + 3, 0, TAU); g.stroke(); }
    if (t.phoenix && t.phoenix.x) drawPhoenix(g, t.phoenix, time);
  }
  // Ikony do obchodu v kreslené grafice: stejná kresba jako na mapě (bez vylepšení), vystředěná na plátně
  function iconCanvas(size, r, draw) {
    const c = off(size, size), g = c.getContext('2d'), k = size / 2 / (r + 6);
    g.translate(size / 2 - 1.5 * k, size / 2 - 2 * k); g.scale(k, k);
    try { draw(g); } catch (_) { /* nic */ }
    return c;
  }
  function towerIcon(type, size) {
    const r = TDEF[type]?.base.radius_px || 20;
    return iconCanvas(size, r, g => drawTower(g, { type, x: 0, y: 0, r, up: [0, 0, 0], ang: -0.6, fx: {}, st: {} }, 0, false));
  }
  function heroIcon(id, size) {
    const r = HDEF[id]?.base.radius_px || 20;
    return iconCanvas(size, r, g => drawHero(g, { hero: true, icon: true, id, type: id, x: 0, y: 0, r, level: 1, ang: -0.6, fx: {}, st: {} }, 0));
  }
  // postavička shora: plášť, hlava s kápí, ruka se zbraní
  function figure(g, r, col, ang, trim, weapon, hat) {
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.72, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = trim; g.beginPath(); g.arc(0, 0, r * 0.72, ang + 2.2, ang + 4.1); g.lineTo(0, 0); g.fill();
    weapon && weapon();
    g.fillStyle = '#f3d2b3'; g.beginPath(); g.arc(Math.cos(ang) * 2, Math.sin(ang) * 2, r * 0.32, 0, TAU); g.fill();
    if (hat) { g.fillStyle = col; g.beginPath(); g.arc(Math.cos(ang) * 1, Math.sin(ang) * 1, r * 0.36, 0, TAU); g.fill(); g.fillStyle = '#facc15'; star(g, Math.cos(ang) * 1, Math.sin(ang) * 1, 3); }
  }
  function bow(g, r, ang, xbow) {
    g.save(); g.rotate(ang);
    g.strokeStyle = '#78350f'; g.lineWidth = xbow ? 4 : 2.5;
    g.beginPath(); g.arc(r * 0.35, 0, r * 0.62, -1.1, 1.1); g.stroke();
    g.strokeStyle = '#e7e5e4'; g.lineWidth = 1; g.beginPath(); g.moveTo(r * 0.35 + Math.cos(-1.1) * r * 0.62, Math.sin(-1.1) * r * 0.62); g.lineTo(r * 0.35 + Math.cos(1.1) * r * 0.62, Math.sin(1.1) * r * 0.62); g.stroke();
    if (xbow) { g.fillStyle = '#57534e'; g.fillRect(0, -2, r * 1.05, 4); }
    g.restore();
  }
  function drawPhoenix(g, ph, time) {
    if (useTDS() && window.TDS?.phoenix) {   // směr letu = derivace kroužení z td-engine.js
      const a = ph.ang || 0;
      TDS.phoenix(g, ph.x, ph.y, performance.now(), Math.atan2(1.3 * Math.cos(a * 1.3) * 220, -Math.sin(a) * 320));
      return;
    }
    g.save(); g.translate(ph.x, ph.y);
    const glow = g.createRadialGradient(0, 0, 2, 0, 0, 34); glow.addColorStop(0, 'rgba(254,215,170,.9)'); glow.addColorStop(1, 'rgba(249,115,22,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
    const f = Math.sin(time * 14) * 0.5;
    g.fillStyle = '#f97316';
    [-1, 1].forEach(s => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 22, -14 - f * 8, s * 30, 4); g.quadraticCurveTo(s * 14, 0, 0, 6); g.fill(); });
    g.fillStyle = '#fde047'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill();
    g.restore();
  }
  function drawHero(g, h, time) {
    const r = h.r;
    if (useTDS() && window.TDS?.heroDrawers?.[h.id]) {
      g.fillStyle = 'rgba(250,204,21,.18)'; g.beginPath(); g.arc(h.x, h.y, r + 6 + Math.sin(time * 2.5) * 1.5, 0, TAU); g.fill();
      TDS.hero(g, h.id, h.x, h.y, r, h.ang || 0, performance.now(), h.level, { crit: h.critShots > 0, casting: G.time - (h.castAt ?? -9) < 0.6 });
      g.fillStyle = '#1e1b4b'; g.beginPath(); g.arc(h.x + r * 0.85, h.y - r * 0.85, 8, 0, TAU); g.fill();
      g.fillStyle = '#fde68a'; g.font = 'bold 10px Geist, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.level, h.x + r * 0.85, h.y - r * 0.85 + 0.5);
      g.textBaseline = 'alphabetic';
      return;
    }
    g.save(); g.translate(h.x, h.y);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(3, r * 0.55, r * 1.05, r * 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(250,204,21,.18)'; g.beginPath(); g.arc(0, 0, r + 6 + Math.sin(time * 2.5) * 1.5, 0, TAU); g.fill();
    g.strokeStyle = '#facc15'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, r + 1, 0, TAU); g.stroke();
    const def = HDEF[h.id], ang = h.ang || 0;
    if (h.id === 'lovec_bedrich') figure(g, r, def.col, ang, '#7f1d1d', () => bow(g, r, ang, true));
    else if (h.id === 'carodejka_radka') figure(g, r, def.col, ang, '#a78bfa', () => {
      g.strokeStyle = '#fde68a'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(ang) * r * 0.2, Math.sin(ang) * r * 0.2); g.lineTo(Math.cos(ang) * r * 1.0, Math.sin(ang) * r * 1.0); g.stroke();
      g.fillStyle = '#e9d5ff'; star(g, Math.cos(ang) * r * 1.05, Math.sin(ang) * r * 1.05, 5 + Math.sin(time * 8));
    }, true);
    else figure(g, r, def.col, ang, '#99f6e4', () => { g.save(); g.rotate(ang); g.fillStyle = '#fef3c7'; g.fillRect(r * 0.4, -r * 0.35, r * 0.4, r * 0.7); g.fillStyle = '#92400e'; g.fillRect(r * 0.38, -r * 0.4, r * 0.08, r * 0.8); g.fillRect(r * 0.78, -r * 0.4, r * 0.08, r * 0.8); g.restore(); });
    g.restore();
    if (h.icon) return;   // ikona do obchodu bez odznaku úrovně
    g.fillStyle = '#1e1b4b'; g.beginPath(); g.arc(h.x + r * 0.85, h.y - r * 0.85, 8, 0, TAU); g.fill();
    g.fillStyle = '#fde68a'; g.font = 'bold 10px Geist, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.level, h.x + r * 0.85, h.y - r * 0.85 + 0.5);
    g.textBaseline = 'alphabetic';
  }

  /* ── Střely ────────────────────────────────────────────────── */
  // Střely nových věží, dokud nemají vlastní texturu, vypadají jako podobné stávající
  const PROJ_ALIAS = { thorn: 'spike', shuriken: 'blade', dagger: 'boltTrue', nail: 'spike', plasma: 'bolt', gryfDart: 'dart', rocket: 'harpoonBolt', shell: 'cannon', mortarShell: 'cannon', flashBomb: 'cannon' };
  function drawProj(g, p, time) {
    if (useTDS() && window.TDS?.projectileDrawers?.[p.kind]) { TDS.projectile(g, p.kind, p.x, p.y, p.ang, performance.now()); return; }
    const kind = PROJ_ALIAS[p.kind];
    if (kind && useTDS() && window.TDS?.projectileDrawers?.[kind]) { TDS.projectile(g, kind, p.x, p.y, p.ang, performance.now()); return; }
    g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
    switch (kind || p.kind) {
      case 'arrow': case 'arrowCrit': case 'ballista':
        g.strokeStyle = p.kind === 'arrowCrit' ? '#f472b6' : '#78350f'; g.lineWidth = p.kind === 'ballista' ? 3.5 : 2;
        g.beginPath(); g.moveTo(-10, 0); g.lineTo(6, 0); g.stroke();
        g.fillStyle = '#d6d3d1'; g.beginPath(); g.moveTo(9, 0); g.lineTo(4, -3); g.lineTo(4, 3); g.fill();
        g.fillStyle = '#fef3c7'; g.fillRect(-11, -2, 3, 4); break;
      case 'spike': case 'shard': case 'icicle':
        g.fillStyle = p.kind === 'icicle' ? '#bae6fd' : '#e7e5e4'; g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -2.5); g.lineTo(-4, 2.5); g.fill(); break;
      case 'blade': g.rotate(time * 18); g.fillStyle = '#e5e7eb'; star(g, 0, 0, 7); break;
      case 'flame': g.fillStyle = 'rgba(249,115,22,.9)'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.fillStyle = '#fde047'; g.beginPath(); g.arc(1, 0, 2.5, 0, TAU); g.fill(); break;
      case 'iceball': g.fillStyle = '#e0f2fe'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.strokeStyle = '#38bdf8'; g.lineWidth = 2; g.stroke(); break;
      case 'barrel': g.rotate(time * 6); g.fillStyle = '#92400e'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.strokeStyle = '#451a03'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fde047'; g.beginPath(); g.arc(5, -5, 2.5, 0, TAU); g.fill(); break;
      case 'harpoonBolt': g.fillStyle = '#374151'; g.fillRect(-12, -2, 22, 4); g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(14, 0); g.lineTo(8, -5); g.lineTo(8, 5); g.fill(); break;
      case 'cannon': g.fillStyle = '#18181b'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); break;
      case 'dart': case 'dartSmall': g.fillStyle = '#e5e7eb'; g.fillRect(-7, -1.5, 12, 3); g.fillStyle = '#0e7490'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-11, -4); g.lineTo(-11, 4); g.fill(); break;
      case 'bolt': case 'boltTrue': case 'phoenixFire': {
        const c = p.kind === 'phoenixFire' ? '249,115,22' : p.kind === 'boltTrue' ? '245,208,254' : '192,132,252';
        g.fillStyle = `rgba(${c},.35)`; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
        g.fillStyle = `rgb(${c})`; g.beginPath(); g.ellipse(0, 0, 6, 3.5, 0, 0, TAU); g.fill(); break;
      }
      case 'fireball': g.fillStyle = 'rgba(249,115,22,.4)'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.fillStyle = '#fb923c'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.fillStyle = '#fef08a'; g.beginPath(); g.arc(1, 0, 3.5, 0, TAU); g.fill(); break;
      case 'flask': g.rotate(time * 8); g.fillStyle = '#a3e635'; g.beginPath(); g.arc(0, 2, 5, 0, TAU); g.fill(); g.fillStyle = '#e7e5e4'; g.fillRect(-1.5, -6, 3, 5); break;
      case 'scroll': g.fillStyle = '#fef3c7'; g.fillRect(-6, -4, 12, 8); g.fillStyle = '#92400e'; g.fillRect(-7, -5, 2, 10); g.fillRect(5, -5, 2, 10); break;
      default: g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
    }
    g.restore();
  }

  /* ── Efekty ────────────────────────────────────────────────── */
  // Efekty z části D (leak a missile zůstávají vlastní, celoplošné kreslí overlay)
  const TDS_FX = new Set(['boom', 'boomFire', 'boomGold', 'boomSmall', 'frost', 'frostRing', 'acid', 'ring', 'reveal', 'horn', 'rune', 'tracer', 'zap', 'beam', 'meteor',
    'splat', 'bossdie', 'sealbreak', 'upgrade', 'levelup', 'place', 'sell', 'gold', 'goldSplash', 'trap', 'shrink', 'potion', 'regrow', 'flame', 'blade']);
  function drawFx(g, f, time) {
    const k = Math.min(1, (time - f.t0) / f.dur), a = 1 - k;
    if (useTDS() && window.TDS?.fx && TDS_FX.has(f.kind)) {
      const now = performance.now(), col = f.col === 'rainbow' ? '#f472b6' : f.col;
      if (f.kind === 'meteor') TDS.fx(g, 'meteor', f.x + 60, f.y, 9, k, now, { tx: f.x, ty: f.y });
      else TDS.fx(g, f.kind, f.x, f.y, f.r || (f.kind === 'tracer' ? 2 : f.kind === 'beam' ? 5 : 26), k, now, { tx: f.tx, ty: f.ty, ang: f.ang, col });
      return;
    }
    switch (f.kind) {
      case 'boom': case 'boomFire': case 'boomGold': case 'boomSmall': {
        const c = f.kind === 'boomGold' ? '250,204,21' : f.kind === 'boomFire' ? '239,68,68' : '249,115,22';
        g.fillStyle = `rgba(${c},${a * 0.55})`; g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + k * 0.7), 0, TAU); g.fill();
        g.fillStyle = `rgba(254,240,138,${a * 0.8})`; g.beginPath(); g.arc(f.x, f.y, f.r * 0.35 * (1 - k), 0, TAU); g.fill();
        g.strokeStyle = `rgba(120,113,108,${a * 0.5})`; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r * (0.6 + k * 0.6), 0, TAU); g.stroke();
        break;
      }
      case 'frost': case 'frostRing':
        g.strokeStyle = `rgba(186,230,253,${a * 0.9})`; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r * (f.kind === 'frostRing' ? 0.3 + k * 0.7 : 0.5 + k * 0.5), 0, TAU); g.stroke();
        g.fillStyle = `rgba(224,242,254,${a * 0.18})`; g.fill(); break;
      case 'acid': g.fillStyle = `rgba(163,230,53,${a * 0.5})`; g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + k * 0.5), 0, TAU); g.fill(); break;
      case 'ring': case 'reveal': case 'horn': case 'rune': {
        const c = f.kind === 'reveal' ? '255,255,255' : f.kind === 'horn' ? '250,204,21' : f.kind === 'rune' ? '196,181,253' : '249,115,22';
        g.strokeStyle = `rgba(${c},${a * 0.6})`; g.lineWidth = f.kind === 'ring' ? 4 : 2.5;
        if (f.kind === 'reveal') g.setLineDash([6, 6]);
        g.beginPath(); g.arc(f.x, f.y, f.r * (f.kind === 'ring' ? 1 : 0.3 + k * 0.7), 0, TAU); g.stroke(); g.setLineDash([]); break;
      }
      case 'tracer': g.strokeStyle = f.col || `rgba(254,240,138,${a})`; g.globalAlpha = a; g.lineWidth = 2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.tx, f.ty); g.stroke(); g.globalAlpha = 1; break;
      case 'beam': g.strokeStyle = f.col; g.globalAlpha = 0.85; g.lineWidth = 5; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.tx, f.ty); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; break;
      case 'zap': {
        g.strokeStyle = f.col || '#c4b5fd'; g.globalAlpha = a; g.lineWidth = 2.2; g.beginPath(); g.moveTo(f.x, f.y);
        const n = 5; for (let i = 1; i < n; i++) { const q = i / n; g.lineTo(f.x + (f.tx - f.x) * q + (Math.random() - 0.5) * 10, f.y + (f.ty - f.y) * q + (Math.random() - 0.5) * 10); }
        g.lineTo(f.tx, f.ty); g.stroke(); g.globalAlpha = 1; break;
      }
      case 'missile': {
        const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k;
        g.strokeStyle = `rgba(255,255,255,${a * 0.6})`; g.lineWidth = 3; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(x, y); g.stroke();
        g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); break;
      }
      case 'meteor': { const y = f.y - 200 * (1 - k); g.fillStyle = `rgba(249,115,22,${0.8})`; g.beginPath(); g.arc(f.x + (1 - k) * 60, y, 9, 0, TAU); g.fill(); g.strokeStyle = 'rgba(254,215,170,.6)'; g.lineWidth = 4; g.beginPath(); g.moveTo(f.x + (1 - k) * 60, y); g.lineTo(f.x + (1 - k) * 60 + 30, y - 60); g.stroke(); break; }
      case 'splat': case 'bossdie': {
        const n = f.kind === 'bossdie' ? 14 : 6;
        g.fillStyle = f.col === 'rainbow' ? `hsla(${(f.x * 7) % 360},80%,60%,${a})` : hexA(f.col, a);
        for (let i = 0; i < n; i++) { const an = i / n * TAU + f.x, d = f.r * (0.5 + k * 1.6); g.beginPath(); g.arc(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, (f.kind === 'bossdie' ? 5 : 2.5) * a + 1, 0, TAU); g.fill(); }
        break;
      }
      case 'sealbreak': g.fillStyle = `rgba(237,233,254,${a})`; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, d = (f.r + 8) * (1 + k); star(g, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 4); } break;
      case 'upgrade': case 'levelup': g.fillStyle = `rgba(250,204,21,${a})`; for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + k * 2, d = 10 + k * 26; star(g, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d - k * 10, 4); } break;
      case 'place': g.strokeStyle = `rgba(214,211,209,${a})`; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r * (1 + k), 0, TAU); g.stroke(); break;
      case 'sell': case 'gold': g.fillStyle = `rgba(250,204,21,${a})`; for (let i = 0; i < 7; i++) { const an = i / 7 * TAU, d = k * 30; g.beginPath(); g.arc(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d - k * 14, 3.5, 0, TAU); g.fill(); } break;
      case 'goldSplash': g.fillStyle = `rgba(250,204,21,${a * 0.4})`; g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); break;
      case 'blade': g.save(); g.translate(f.x, f.y); g.rotate(k * 12); g.fillStyle = `rgba(229,231,235,${a})`; star(g, 0, 0, 9); g.restore(); break;
      case 'trap': g.strokeStyle = `rgba(55,65,81,${a})`; g.lineWidth = 4; g.beginPath(); g.arc(f.x, f.y, f.r + 4, 0, TAU); g.stroke(); break;
      case 'shrink': g.fillStyle = `rgba(244,114,182,${a})`; for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, d = f.r * (1 - k); star(g, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 4); } break;
      case 'potion': { const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 30; g.fillStyle = '#f472b6'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); break; }
      case 'drop': g.fillStyle = '#1c1917'; g.beginPath(); g.arc(f.x, f.y - 40 * (1 - k), 3 + 3 * (1 - k), 0, TAU); g.fill(); break;   // puma padající z gryfa
      case 'regrow': g.strokeStyle = `rgba(34,197,94,${a})`; g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r + 8 * k, 0, TAU); g.stroke(); break;
      case 'flame': { g.save(); g.translate(f.x, f.y); g.rotate(f.ang); const lg = g.createLinearGradient(0, 0, f.r, 0); lg.addColorStop(0, 'rgba(254,240,138,.8)'); lg.addColorStop(1, 'rgba(249,115,22,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, f.r, -0.35, 0.35); g.closePath(); g.fill(); g.restore(); break; }
      case 'leak': g.fillStyle = `rgba(239,68,68,${a * 0.6})`; g.beginPath(); g.arc(f.x, f.y, 30 * (1 + k), 0, TAU); g.fill(); break;
      case 'bossin': case 'carpet': case 'blizzard': break;   // celoplošné efekty kreslí overlay()
    }
  }
  function hexA(hex, a) { if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }

  function drawZone(g, z, time) {
    const left = Math.min(1, (z.until - G.time) / 1);
    if (useTDS() && window.TDS?.zone) { TDS.zone(g, z.kind, z.x, z.y, z.r, performance.now(), Math.max(0.2, left)); return; }
    g.save(); g.globalAlpha = Math.max(0.2, left);
    if (z.kind === 'fire') { for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + time, d = z.r * 0.55; g.fillStyle = i % 2 ? 'rgba(249,115,22,.75)' : 'rgba(253,224,71,.75)'; g.beginPath(); g.ellipse(z.x + Math.cos(an) * d, z.y + Math.sin(an) * d * 0.6, 6, 10 + Math.sin(time * 12 + i) * 3, 0, 0, TAU); g.fill(); } }
    else if (z.kind === 'acid') { g.fillStyle = 'rgba(132,204,22,.45)'; g.beginPath(); g.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(217,249,157,.7)'; g.beginPath(); g.arc(z.x + Math.sin(time * 3) * 8, z.y, 3, 0, TAU); g.fill(); }
    else if (z.kind === 'storm') { g.strokeStyle = 'rgba(167,139,250,.5)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(z.x, z.y, z.r * (0.4 + i * 0.25), time * (1 + i) , time * (1 + i) + 2); g.stroke(); } g.fillStyle = 'rgba(139,92,246,.12)'; g.beginPath(); g.arc(z.x, z.y, z.r, 0, TAU); g.fill(); }
    g.restore();
  }
  function drawAlly(g, a) {
    if (useTDS() && window.TDS?.ally) { TDS.ally(g, a.big, a.x, a.y, a.ang || 0, performance.now()); return; }
    g.save(); g.translate(a.x, a.y);
    g.fillStyle = a.big ? '#e7e5e4' : '#f5f5f4';
    if (a.big) { g.beginPath(); g.moveTo(-14, 0); g.lineTo(0, -8); g.lineTo(14, 0); g.lineTo(0, 8); g.closePath(); g.fill(); g.fillStyle = '#16a34a'; g.beginPath(); g.arc(0, -2, 3, 0, TAU); g.fill(); }
    else { g.beginPath(); g.arc(0, -4, 4, 0, TAU); g.fill(); g.fillRect(-1.5, 0, 3, 7); g.fillStyle = '#16a34a'; g.fillRect(-2, -5, 1.5, 1.5); g.fillRect(0.5, -5, 1.5, 1.5); }
    g.restore();
  }

  // Celoplošné efekty (vánice, nálet, příchod bosse)
  function overlay(g, time) {
    for (const f of G.fx) {
      const k = Math.min(1, (time - f.t0) / f.dur), a = 1 - k;
      if (f.kind === 'blizzard') { g.fillStyle = `rgba(224,242,254,${a * 0.35})`; g.fillRect(0, 0, TW, TH); }
      if (f.kind === 'carpet') { g.fillStyle = `rgba(249,115,22,${a * 0.18})`; g.fillRect(0, 0, TW, TH); }
      if (f.kind === 'bossin') { g.strokeStyle = `rgba(167,139,250,${a * 0.85})`; g.lineWidth = 4; g.beginPath(); g.arc(f.x, f.y, 30 + k * 110, 0, TAU); g.stroke(); }   // příchod krále: jen kruh na místě, ne celá obrazovka
    }
    if (G.revealUntil > time) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 0, TW, TH); }
    if (G.slowmo) { g.fillStyle = 'rgba(30,27,75,.18)'; g.fillRect(0, 0, TW, TH); }
  }

  /* ── Hlavní vykreslení ─────────────────────────────────────── */
  function render(g, view) {
    const time = G.time;
    g.drawImage(background(G.map, G.paths), 0, 0);
    // odstraněné překážky
    const nova = useTDS();
    (G.map.obstacles || []).forEach(o => { if (o.removed) { g.fillStyle = nova ? '#5ec447' : '#4a8a3d'; rrect(g, o.x, o.y, o.width, o.height, 20); g.fill(); } });
    if (nova) (G.map.water_zones || []).forEach(z => waterFrozenAt(z.x + z.width / 2, z.y + z.height / 2) ? TDS.frozenWater(g, z) : TDS.water(g, z, performance.now()));
    else
    // voda se třpytí
    (G.map.water_zones || []).forEach(z => {
      g.strokeStyle = 'rgba(219,234,254,.35)'; g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const yy = z.y + 20 + i * (z.height - 40) / 4, xx = z.x + 20 + ((time * 14 + i * 37) % (z.width - 50)); g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 8, yy - 3, xx + 16, yy); g.stroke(); }
      if (waterFrozenAt(z.x + z.width / 2, z.y + z.height / 2)) { g.fillStyle = 'rgba(224,242,254,.35)'; rrect(g, z.x, z.y, z.width, z.height, 22); g.fill(); }
    });
    G.zones.forEach(z => drawZone(g, z, time));
    if (typeof XR !== 'undefined') XR.ground(g, performance.now(), view);   // pasti, terč moždíře, tornáda (td-xtowers.js)
    // dosah vybrané věže (výběr může být i boss nebo překážka — ty nemají dosah)
    const pick = view.sel, sel = pick && (pick.hero || pick.st) ? pick : null;
    if (pick?.obst) { const o = pick.obst; g.strokeStyle = '#facc15'; g.lineWidth = 2.5; g.setLineDash([6, 4]); rrect(g, o.x - 4, o.y - 4, o.width + 8, o.height + 8, 18); g.stroke(); g.setLineDash([]); }
    if (sel) {
      const r = sel.hero ? sel.st.range : effRange(sel);
      if (r < 1900) { g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(sel.x, sel.y, r, 0, TAU); g.fill(); g.stroke(); }
    }
    G.allies.forEach(a => drawAlly(g, a));
    // slizáci (bossové navrch)
    const list = G.enemies.slice().sort((a, b) => (a.def.boss - b.def.boss) || (a.y - b.y));
    for (const e of list) drawEnemy(g, e, time);
    if (pick?.boss && !pick.boss.dead) { const e = pick.boss; g.strokeStyle = '#facc15'; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.beginPath(); g.arc(e.x, e.y, e.def.r + 8, 0, TAU); g.stroke(); g.setLineDash([]); }
    // věže a hrdina (podle y, ať se překrývají přirozeně)
    const tw = [...G.towers, G.hero].filter(Boolean).sort((a, b) => a.y - b.y);
    for (const t of tw) t.hero ? drawHero(g, t, time) : drawTower(g, t, time, t === sel);
    if (sel) { g.strokeStyle = '#facc15'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(sel.x, sel.y, sel.r + 4, 0, TAU); g.stroke(); g.setLineDash([]); }
    if (typeof XR !== 'undefined') XR.air(g, performance.now());   // střílny inženýra, gryf
    for (const p of G.projs) drawProj(g, p, time);
    for (const f of G.fx) drawFx(g, f, time);
    // plovoucí čísla (zlato)
    g.textAlign = 'center'; g.font = 'bold 13px Geist, sans-serif';
    for (const f of G.floats) { const k = (time - f.t0) / 1.2; g.globalAlpha = 1 - k; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(f.txt, f.x + 1, f.y - k * 24 + 1); g.fillStyle = f.col; g.fillText(f.txt, f.x, f.y - k * 24); }
    g.globalAlpha = 1;
    // náhled stavby
    const gh = view.ghost;
    if (gh) {
      const def = TDEF[gh.type] || HDEF[gh.type];
      const range = TDEF[gh.type] ? def.base.range_px : def.base.range_px;
      g.fillStyle = gh.bad ? 'rgba(239,68,68,.16)' : 'rgba(255,255,255,.14)'; g.strokeStyle = gh.bad ? 'rgba(239,68,68,.7)' : 'rgba(255,255,255,.6)';
      if (range < 1900) { g.beginPath(); g.arc(gh.x, gh.y, range, 0, TAU); g.fill(); g.stroke(); }
      g.globalAlpha = 0.75;
      const fake = TDEF[gh.type] ? { type: gh.type, x: gh.x, y: gh.y, r: def.base.radius_px, up: [0, 0, 0], ang: -Math.PI / 2, st: {}, fx: {} } : { hero: true, id: gh.type, x: gh.x, y: gh.y, r: def.base.radius_px, level: 1, ang: -Math.PI / 2 };
      fake.hero ? drawHero(g, fake, time) : drawTower(g, fake, time);
      g.globalAlpha = 1;
      if (gh.bad) { g.fillStyle = '#fecaca'; g.font = 'bold 12px Geist, sans-serif'; g.fillText(gh.bad, gh.x, gh.y - def.base.radius_px - 10); }
    }
    overlay(g, time);
  }

  // Malý náhled mapy pro výběr na úvodní obrazovce
  function mapPreview(map, w, h) {
    const paths = map.paths.map(p => { const segs = []; let len = 0; for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], l = Math.hypot(b.x - a.x, b.y - a.y); segs.push({ a, b, l, from: len, ang: Math.atan2(b.y - a.y, b.x - a.x) }); len += l; } return { pts: p, segs, len }; });
    const bg = background(map, paths), c = off(w, h);
    c.getContext('2d').drawImage(bg, 0, 0, w, h);
    return c;
  }

  // Prohlížeč může při nedostatku grafické paměti zahodit obsah canvasů (i předkreslených).
  // Pak se všechny předkreslené obrázky smažou a vykreslí znovu.
  function clearCaches() {
    bgCache.clear(); spriteCache.clear();
    if (window.TDS) { TDS.clearCacheA?.(); TDS.clearCacheD?.(); TDS.cache = {}; TDS._iconCache = {}; }
  }
  function cachesLost() {
    const bg = useTDS() ? TDS.background({ id: G.map.id, paths: G.map.paths, track_width_px: TRACK_HALF * 2, water_zones: G.map.water_zones || [], obstacles: G.map.obstacles || [] }) : bgCache.get(G.map.id);
    try { return !!bg?.getContext('2d').isContextLost?.(); } catch (_) { return false; }
  }
  return { render, mapPreview, slimeSprite, clearCaches, cachesLost, towerIcon, heroIcon };
})();

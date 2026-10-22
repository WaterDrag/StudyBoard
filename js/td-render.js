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
    const r = e.def.r, S = Math.ceil(r * 2.8), c = off(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2 + r * 0.1);
    const col = e.def.col === 'rainbow' ? '#f472b6' : e.def.col;
    // tělo (kapka u Kapičky, jinak rosol)
    g.beginPath();
    if (e.t === 'kapicka_slizu') { g.moveTo(0, -r * 1.25); g.bezierCurveTo(r * 0.9, -r * 0.2, r, r * 0.9, 0, r * 0.9); g.bezierCurveTo(-r, r * 0.9, -r * 0.9, -r * 0.2, 0, -r * 1.25); }
    else { g.moveTo(-r, r * 0.75); g.bezierCurveTo(-r * 1.15, -r * 0.3, -r * 0.55, -r * 1.05, 0, -r * 1.05); g.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.15, -r * 0.3, r, r * 0.75); g.quadraticCurveTo(0, r * 1.05, -r, r * 0.75); }
    g.closePath();
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
    spriteCache.set(key, c);
    return c;
  }
  function lighten(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function darken(hex, k) { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * (1 - k) | 0},${(n >> 8 & 255) * (1 - k) | 0},${(n & 255) * (1 - k) | 0})`; }

  function drawEnemy(g, e, t) {
    if (useTDS() && TDS.slime) {
      const s = { camo: e.camo, revealed: e.revealed || G.revealUntil > t, regrow: e.regrow, fort: e.fort, armored: e.armored,
        frozen: e.frozenUntil > t, stunned: e.stunUntil > t, burn: !!(e.burn && e.burn.until > t), acid: !!(e.acid && e.acid.until > t),
        gold: e.goldMul > 1, hit: t - e.lastHit < 0.06 && e.lastHit > 0 };
      if (e.def.boss) { s.hpPct = Math.max(0, e.hp / e.maxHp); s.sealsTotal = e.seal ? e.seal.n : 0; s.sealsLeft = e.seal ? Math.ceil(e.seal.s * e.seal.n - 1e-6) : 0; }
      TDS.slime(g, e.t, e.x, e.y, e.def.r, e.ang || 0, performance.now(), s);
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
    }
    g.restore();
    }
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
    g.fillStyle = '#1e1b4b'; g.beginPath(); g.arc(h.x + r * 0.85, h.y - r * 0.85, 8, 0, TAU); g.fill();
    g.fillStyle = '#fde68a'; g.font = 'bold 10px Geist, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.level, h.x + r * 0.85, h.y - r * 0.85 + 0.5);
    g.textBaseline = 'alphabetic';
  }

  /* ── Střely ────────────────────────────────────────────────── */
  function drawProj(g, p, time) {
    if (useTDS() && window.TDS?.projectileDrawers?.[p.kind]) { TDS.projectile(g, p.kind, p.x, p.y, p.ang, performance.now()); return; }
    g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
    switch (p.kind) {
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
      if (f.kind === 'bossin') { g.fillStyle = `rgba(124,58,237,${a * 0.18})`; g.fillRect(0, 0, TW, TH); }
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
  return { render, mapPreview, slimeSprite, clearCaches, cachesLost };
})();

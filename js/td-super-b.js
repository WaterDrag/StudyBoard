/* td-super-b.js — Super grafika (td_gfx '2'): věže Královský lučištník, Čepová věž, Mrazivý mág,
 * Orlí ostrostřelec, Obléhací katapult a Říční galéra. Registruje do window.TDSS.drawers[id] = { base, turret }
 * (stejné API jako td-super-a.js: base(ctx, up) se nenatáčí, turret(ctx, up, s) míří k +x;
 * s.firing 0–1, s.buffed, s.cock 0–1 = natažení katapultu). Pomocné kreslicí funkce sdílí přes TDSS._h
 * (používají je i td-super-c.js a td-super-d.js). Styl: obrys #111, světlo shora zleva, bez rozmazání. */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  TDS.drawers = TDS.drawers || {};
  const OUT = '#111', PI = Math.PI, TAU = PI * 2;

  /* =========================== SDÍLENÉ POMŮCKY =========================== */
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
  function lv(up, i) { return up && up[i] ? (up[i] | 0) : 0; }
  function mainPath(up) { let p = 0, t = lv(up, 0); for (let i = 1; i < 3; i++) { const v = lv(up, i); if (v > t) { t = v; p = i; } } return { p: p, t: t }; }
  function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function ellipsePath(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function regPoly(ctx, x, y, r, n, rot) { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  function starPath(ctx, x, y, r1, r2, n, rot) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i % 2 ? r2 : r1; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); }
  function roundRect(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  function paint(ctx, fill, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); } }
  function fillA(ctx, col, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
  function strokeA(ctx, col, lw, a) { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  function strokeOutlined(ctx, w, col) { ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.restore(); }
  function softShadow(ctx, x, y, rx, ry) { ctx.save(); ctx.fillStyle = '#000'; ctx.globalAlpha = 0.09; ellipsePath(ctx, x + 4.5, y + 5, rx + 2.5, ry + 2.5); ctx.fill(); ctx.globalAlpha = 0.12; ellipsePath(ctx, x + 3, y + 3.5, rx + 0.5, ry + 0.5); ctx.fill(); ctx.globalAlpha = 0.1; ellipsePath(ctx, x + 2, y + 2, Math.max(1, rx - 1), Math.max(1, ry - 1)); ctx.fill(); ctx.restore(); }
  function gloss(ctx, x, y, rx, ry, rot, a) { ellipsePath(ctx, x, y, rx, ry, rot); fillA(ctx, '#fff', a); }
  function glow(ctx, x, y, r, col, a) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * 0.22; circlePath(ctx, x, y, r * (1 - i * 0.2)); ctx.fill(); } ctx.restore(); }
  function rivet(ctx, x, y, r, col) { circlePath(ctx, x, y, r); paint(ctx, col || '#8d949c', 0.9); circlePath(ctx, x - r * 0.35, y - r * 0.35, r * 0.42); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); }
  function gem(ctx, x, y, r, col) { glow(ctx, x, y, r * 2, col, 0.8); polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y + r], [x - r * 0.85, y]]); paint(ctx, col, 1.2); polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y]]); fillA(ctx, '#fff', 0.35); circlePath(ctx, x - r * 0.3, y - r * 0.35, r * 0.22); fillA(ctx, '#fff', 0.95); }
  function teardrop(ctx, len, w) { const r = w * 0.55; ctx.beginPath(); ctx.moveTo(len, 0); ctx.quadraticCurveTo(len * 0.4, -w, 0, -r); ctx.arc(0, 0, r, -PI / 2, PI / 2, true); ctx.quadraticCurveTo(len * 0.4, w, len, 0); ctx.closePath(); }
  function flame3(ctx, len, w) { teardrop(ctx, len, w); paint(ctx, '#e8401c', 1.3); teardrop(ctx, len * 0.72, w * 0.68); ctx.fillStyle = '#ff9a1f'; ctx.fill(); teardrop(ctx, len * 0.45, w * 0.4); ctx.fillStyle = '#ffe36a'; ctx.fill(); }
  function puff(ctx, x, y, r, a) { circlePath(ctx, x, y, r); fillA(ctx, '#8d8f96', a); circlePath(ctx, x - r * 0.3, y - r * 0.3, r * 0.55); fillA(ctx, '#e1e3e8', a * 0.8); }
  function lightning(ctx, x0, y0, x1, y1, seed, col, w) {
    const R = makeRng(seed), dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.beginPath(); ctx.moveTo(x0, y0); for (let i = 1; i < 5; i++) { const t = i / 5, o = (R() - 0.5) * len * 0.35; ctx.lineTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o); } ctx.lineTo(x1, y1);
    strokeA(ctx, col, w * 3.2, 0.35); strokeA(ctx, shade(col, 0.7), w, 1);
  }
  function rune(ctx, x, y, sz, col, seed) {
    const R = makeRng(seed), h = sz * 0.5, w = sz * 0.34;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h);
    const s1 = R() < 0.5 ? -1 : 1, y1 = -h + R() * h * 0.8; ctx.moveTo(0, y1); ctx.lineTo(w * s1, y1 - h * 0.45);
    const y2 = R() * h * 0.7; ctx.moveTo(0, y2); ctx.lineTo(-w * s1, y2 + (R() < 0.5 ? -1 : 1) * h * 0.45);
    strokeA(ctx, col, sz * 0.42, 0.35); strokeA(ctx, shade(col, 0.6), sz * 0.15, 1); ctx.restore();
  }
  function pennant(ctx, x, y, ang, len, col, col2, wave) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(len * 0.5, -3 + wave, len, wave * 0.4); ctx.quadraticCurveTo(len * 0.5, 3 + wave, 0, 3); ctx.closePath(); paint(ctx, col, 1.5);
    ctx.beginPath(); ctx.moveTo(0, -0.9); ctx.quadraticCurveTo(len * 0.45, -0.9 + wave, len * 0.8, wave * 0.4); ctx.quadraticCurveTo(len * 0.45, 0.9 + wave, 0, 0.9); ctx.closePath(); ctx.fillStyle = col2; ctx.fill();
    circlePath(ctx, 0, 0, 2.1); paint(ctx, '#7a4a22', 1.3); circlePath(ctx, -0.4, -0.4, 1); ctx.fillStyle = '#ffd34a'; ctx.fill();
    ctx.restore();
  }
  function buffAura(ctx, r) {
    circlePath(ctx, 0, 0, r); strokeA(ctx, '#ffd54a', 6, 0.16); circlePath(ctx, 0, 0, r); strokeA(ctx, '#fff3a8', 1.6, 0.75);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, cx = Math.cos(a) * r, cy = Math.sin(a) * r; polyPath(ctx, [[cx, cy - 3], [cx + 2.2, cy], [cx, cy + 3], [cx - 2.2, cy]]); paint(ctx, '#ffd54a', 1); }
  }
  // Kamenná kruhová plošina z kvádrů (r = vnější poloměr)
  function stoneRing(ctx, r, col, inner, seed) {
    const R = makeRng(seed || 7), n = Math.max(8, Math.round(r * 0.55));
    circlePath(ctx, 0, 0, r); paint(ctx, col, 2.2);
    ctx.save(); circlePath(ctx, 0, 0, r); ctx.clip();
    for (let i = 0; i < n; i++) { const a = i / n * TAU; line(ctx, Math.cos(a) * (inner || r * 0.7), Math.sin(a) * (inner || r * 0.7), Math.cos(a) * r, Math.sin(a) * r); strokeA(ctx, shade(col, -0.45), 1, 0.7); }
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU, d = (inner || r * 0.7) + (r - (inner || r * 0.7)) * 0.5; circlePath(ctx, Math.cos(a) * d - 0.6, Math.sin(a) * d - 0.6, 1.1 + R() * 0.8); fillA(ctx, '#fff', 0.18); }
    ellipsePath(ctx, r * 0.35, r * 0.4, r * 0.95, r * 0.8); fillA(ctx, '#000', 0.12);
    ctx.restore();
    circlePath(ctx, 0, 0, inner || r * 0.7); strokeA(ctx, OUT, 1.6, 1);
  }
  // Dřevěná kruhová podlaha z prken
  function woodDisc(ctx, r, col) {
    circlePath(ctx, 0, 0, r); paint(ctx, col, 1.6);
    ctx.save(); circlePath(ctx, 0, 0, r); ctx.clip();
    for (let x = -r; x <= r; x += 3.6) { line(ctx, x, -r, x, r); strokeA(ctx, shade(col, -0.4), 0.9, 0.85); }
    for (let x = -r + 1.8, k = 0; x <= r; x += 3.6, k++) { const y = (k % 3 - 1) * r * 0.45; line(ctx, x, y - 2, x + 3.6, y - 2); strokeA(ctx, shade(col, -0.4), 0.7, 0.6); }
    gloss(ctx, -r * 0.35, -r * 0.45, r * 0.45, r * 0.18, -0.6, 0.18);
    ctx.restore();
  }
  // Postavička shora: plášť/trup, ramena a hlava (bez rukou — ty kreslí věž)
  function figure(ctx, body, head, opt) {
    opt = opt || {};
    ellipsePath(ctx, -1, 0, opt.rx || 5.8, opt.ry || 7.6); paint(ctx, body, 1.7);
    ctx.save(); ellipsePath(ctx, -1, 0, opt.rx || 5.8, opt.ry || 7.6); ctx.clip(); ellipsePath(ctx, 1.5, 3, 6, 6); fillA(ctx, '#000', 0.16); ctx.restore();
    if (opt.trim) { ctx.beginPath(); ctx.ellipse(-1, 0, (opt.rx || 5.8) - 0.8, (opt.ry || 7.6) - 0.8, 0, -PI * 0.35, PI * 0.35); strokeA(ctx, opt.trim, 1.2, 1); }
    circlePath(ctx, 0.6, 0, opt.hr || 4.2); paint(ctx, head, 1.5);
    gloss(ctx, -0.8, -1.6, (opt.hr || 4.2) * 0.45, (opt.hr || 4.2) * 0.25, -0.5, 0.4);
  }
  function arm(ctx, x0, y0, x1, y1, sleeve, w) { line(ctx, x0, y0, x1, y1); strokeOutlined(ctx, w || 2.6, sleeve); circlePath(ctx, x1, y1, 1.8); paint(ctx, '#f1c08f', 1); }
  function crate(ctx, x, y, s, col) {
    roundRect(ctx, x - s, y - s, s * 2, s * 2, 1); paint(ctx, col || '#9c6636', 1.3);
    line(ctx, x - s + 0.8, y - s + 0.8, x + s - 0.8, y + s - 0.8); strokeA(ctx, shade(col || '#9c6636', -0.4), 1, 1);
    line(ctx, x + s - 0.8, y - s + 0.8, x - s + 0.8, y + s - 0.8); strokeA(ctx, shade(col || '#9c6636', -0.4), 1, 1);
  }
  const H = TDS._h = { OUT, PI, TAU, makeRng, shade, lv, mainPath, circlePath, ellipsePath, polyPath, regPoly, starPath, roundRect, line, paint, fillA, strokeA, strokeOutlined, softShadow, gloss, glow, rivet, gem, teardrop, flame3, puff, lightning, rune, pennant, buffAura, stoneRing, woodDisc, figure, arm, crate };
  void H;

  /* =========================== KRÁLOVSKÝ LUČIŠTNÍK =========================== */
  // P1 hroty (silnější šípy), P2 rychlost (sokol, blesk), P3 dostřel (sova, kuše, arbalest)
  TDS.drawers.kralovsky_lucistnik = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 19, 19);
      if (m.p === 0 && m.t >= 5) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 23, i * 2.1, i * 2.1 + 1.3); strokeA(ctx, '#a7f3d0', 2.4, 0.7); }   // vítr kolem
      stoneRing(ctx, 19, m.p === 1 && m.t >= 5 ? '#c9b26a' : '#9a9a92', 13.5, 11);
      woodDisc(ctx, 13.5, m.p === 2 && m.t >= 4 ? '#6b4a2b' : '#a06a3a');
      if (a >= 1) for (const [x, y] of [[-11, 9], [-13, 4]]) { circlePath(ctx, x, y, 3); paint(ctx, '#7a4a26', 1.1); for (let k = 0; k < 3; k++) { circlePath(ctx, x - 1 + k, y - 1 + (k % 2), 0.7); ctx.fillStyle = a >= 2 ? '#e5e7eb' : '#d6b98c'; ctx.fill(); } }   // sudy se šípy
      if (m.p === 0 && m.t >= 4) pennant(ctx, 12, -12, -0.6, 12, '#16a34a', '#fde047', 1.5);   // velitelský prapor
      if (m.p === 1 && m.t >= 3) {   // sokol na bidýlku
        line(ctx, 9, 12, 15, 9); strokeOutlined(ctx, 1.4, '#7a4a26');
        ellipsePath(ctx, 12, 9.5, 3.2, 2.2, -0.4); paint(ctx, '#8b5a2b', 1.1); circlePath(ctx, 14.2, 8.4, 1.6); paint(ctx, '#f5f5f4', 0.9); polyPath(ctx, [[15.6, 8.2], [17, 8.6], [15.6, 9]]); paint(ctx, '#f59e0b', 0.6);
      }
      if (c >= 2) {   // sova
        ellipsePath(ctx, -12, -10, 3.4, 3.8); paint(ctx, '#a16207', 1.2);
        for (const sd of [-1, 1]) { circlePath(ctx, -12 + sd * 1.3, -10.8, 1.2); paint(ctx, '#fde047', 0.6); circlePath(ctx, -12 + sd * 1.3, -10.8, 0.5); ctx.fillStyle = OUT; ctx.fill(); }
      }
      if (m.p === 2 && m.t >= 5) { for (let i = 0; i < 4; i++) { const an = i * PI / 2 + PI / 4; rivet(ctx, Math.cos(an) * 16.3, Math.sin(an) * 16.3, 1.5, '#f5c518'); } }
      if (m.p === 1 && m.t >= 5) for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; rivet(ctx, Math.cos(an) * 16.3, Math.sin(an) * 16.3, 1.1, '#fde047'); }
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);   // postava vyplní podstavec
      const cloak = m.p === 0 && m.t >= 5 ? '#0f766e' : m.p === 1 && m.t >= 5 ? '#b45309' : m.p === 2 && m.t >= 5 ? '#7f1d1d' : '#15803d';
      // toulec na zádech
      ctx.save(); ctx.translate(-5, -3.5); ctx.rotate(-0.5); roundRect(ctx, -6, -2.3, 8, 4.6, 1.8); paint(ctx, '#7a4a26', 1.2);
      for (let i = -1; i <= (b >= 5 ? 2 : 1); i++) { line(ctx, -6, i * 1.4, -9, i * 1.7); strokeA(ctx, '#e5e7eb', 1, 1); polyPath(ctx, [[-9, i * 1.7 - 1.1], [-10.8, i * 1.7], [-9, i * 1.7 + 1.1]]); paint(ctx, '#ef4444', 0.6); }
      ctx.restore();
      const xbow = c >= 3;
      if (xbow) {   // kuše / arbalest / obří kuše lovce králů
        const big = m.p === 2 && m.t >= 4, gold = m.p === 2 && m.t >= 5, L = big ? 17 : 13;
        arm(ctx, -0.5, -5, 6, -2.2, cloak); arm(ctx, -0.5, 5, 6, 2.2, cloak);
        roundRect(ctx, 1, -1.8, L, 3.6, 1); paint(ctx, gold ? '#b8860b' : '#6b4320', 1.3);
        ctx.beginPath(); ctx.moveTo(L - 2, -(big ? 11 : 9)); ctx.quadraticCurveTo(L + 2.5, 0, L - 2, big ? 11 : 9); strokeOutlined(ctx, big ? 2.4 : 1.8, gold ? '#f5c518' : '#9ca3af');
        line(ctx, L - 2, -(big ? 11 : 9), 4 - f * 2, 0); line(ctx, 4 - f * 2, 0, L - 2, big ? 11 : 9); strokeA(ctx, '#f8fafc', 0.8, 0.9);
        if (f < 0.5) { line(ctx, 4, 0, L + 4, 0); strokeOutlined(ctx, 1.1, '#d6b98c'); polyPath(ctx, [[L + 7, 0], [L + 3, -2], [L + 3, 2]]); paint(ctx, '#cbd5e1', 0.9); }
        if (big) for (const sd of [-1, 1]) { circlePath(ctx, L - 2, sd * 11, 1.6); paint(ctx, gold ? '#fde047' : '#e5e7eb', 0.8); }
      } else {   // luk (dlouhý luk od P3.1)
        const span = c >= 1 ? 12 : 10, bx = 8, wood = m.p === 1 && m.t >= 4 ? '#60a5fa' : a >= 3 ? '#4b2e14' : '#8b5a2b';
        arm(ctx, -0.5, -5, bx - 0.5, -1, cloak); arm(ctx, -0.5, 5, 2 - f * 2, 1.5, cloak);
        ctx.beginPath(); ctx.moveTo(bx - 3, -span); ctx.quadraticCurveTo(bx + 4.5, 0, bx - 3, span); strokeOutlined(ctx, 2.1, wood);
        line(ctx, bx - 3, -span, 2 - f * 2, 0); line(ctx, 2 - f * 2, 0, bx - 3, span); strokeA(ctx, m.p === 1 && m.t >= 4 ? '#bfdbfe' : '#f8fafc', 0.8, 0.9);
        const n = a >= 3 ? 3 : 1;
        if (f < 0.5) for (let i = 0; i < n; i++) { const yy = (i - (n - 1) / 2) * 2.4; line(ctx, 2, yy, bx + 6, yy * 0.4); strokeOutlined(ctx, 0.9, '#d6b98c'); polyPath(ctx, [[bx + 9, yy * 0.4], [bx + 5.5, yy * 0.4 - 1.8], [bx + 5.5, yy * 0.4 + 1.8]]); paint(ctx, a >= 1 ? '#e5e7eb' : '#cbd5e1', 0.8); }
        if (m.p === 1 && m.t >= 4) glow(ctx, bx, 0, 7, '#93c5fd', 0.8);
      }
      // lučištník s kápí
      figure(ctx, cloak, shade(cloak, 0.12), { rx: 5.4, ry: 7.2, hr: 4, trim: m.t >= 5 ? '#fde047' : null });
      ctx.beginPath(); ctx.moveTo(-3.6, -2.2); ctx.quadraticCurveTo(-1, -4.6, 3.6, -1.6); ctx.lineTo(3.6, 1.6); ctx.quadraticCurveTo(-1, 4.6, -3.6, 2.2); ctx.closePath(); paint(ctx, shade(cloak, -0.15), 1.1);   // kápě
      circlePath(ctx, 3.2, 0, 1.6); paint(ctx, '#f1c08f', 0.8);   // obličej vykukuje
      if (m.p === 0 && m.t >= 5) { ctx.beginPath(); ctx.arc(0, 0, 6.5, -PI * 0.7, PI * 0.7); strokeA(ctx, '#a7f3d0', 1.4, 0.9); }
      if (m.p === 2 && m.t >= 5) { regPoly(ctx, -2.5, 0, 2.6, 5, 0); paint(ctx, '#f5c518', 0.9); }   // trofej: zlatá koruna
    }
  };

  /* =========================== ČEPOVÁ VĚŽ =========================== */
  // P1 oheň (žhavé hřeby, plamenomet, ohnivý prstenec, sopka), P2 čepele, P3 víc střílen (ježek, drtič, hodinový stroj)
  TDS.drawers.cepova_vez = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 21, 21);
      if (m.p === 0 && m.t >= 5) { circlePath(ctx, 0, 0, 25); fillA(ctx, '#7c2d12', 0.5); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + 0.3; lightning(ctx, Math.cos(an) * 17, Math.sin(an) * 17, Math.cos(an + 0.2) * 26, Math.sin(an + 0.2) * 26, 300 + i, '#ff6a1a', 1.2); } }
      if (m.p === 2 && m.t >= 2) for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; ctx.save(); ctx.rotate(an); polyPath(ctx, [[18, -2.2], [m.t >= 5 ? 27 : 24, 0], [18, 2.2]]); paint(ctx, m.t >= 5 ? '#e5e7eb' : '#9ca3af', 1.2); ctx.restore(); }   // ježčí hradba
      const stone = m.p === 0 && m.t >= 4 ? '#5b4636' : m.p === 1 && m.t >= 5 ? '#c9b26a' : '#8f8a82';
      regPoly(ctx, 0, 0, 20, 8, PI / 8); paint(ctx, stone, 2.2);
      regPoly(ctx, 0, 0, 15.5, 8, PI / 8); paint(ctx, shade(stone, -0.15), 1.4);
      for (let i = 0; i < 8; i++) { const an = PI / 8 + i * TAU / 8; rivet(ctx, Math.cos(an) * 17.8, Math.sin(an) * 17.8, 1.2, m.p === 1 && m.t >= 5 ? '#fde047' : '#9aa2ab'); }
      if (a >= 1) { circlePath(ctx, -13, 11, 3.2); paint(ctx, '#6b7280', 1.1); circlePath(ctx, -14, 10, 1); fillA(ctx, '#fff', 0.6); }   // olejnička
      if (m.p === 2 && m.t >= 4) for (const [x, y, r] of [[13, 12, 4.5], [-13, -12, 3.6]]) { H.circlePath(ctx, x, y, r); paint(ctx, '#b8860b', 1.2); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; line(ctx, x + Math.cos(an) * r, y + Math.sin(an) * r, x + Math.cos(an) * (r + 1.6), y + Math.sin(an) * (r + 1.6)); strokeA(ctx, OUT, 2, 1); } }   // ozubená kola hodinového stroje
      gloss(ctx, -7, -10, 6, 2.2, -0.6, 0.18);
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      if (s.buffed) buffAura(ctx, 18);
      const n = 8 + (c >= 1 ? 2 : 0) + (c >= 3 ? 2 : 0) + (c >= 5 ? 4 : 0), fire = a >= 2, blade = b >= 3;
      for (let i = 0; i < n; i++) {   // trysky po obvodu
        const an = i / n * TAU;
        ctx.save(); ctx.rotate(an);
        if (blade) { ctx.beginPath(); ctx.moveTo(8, -2.5); ctx.quadraticCurveTo(15, -3.5, 18, 0); ctx.quadraticCurveTo(14, 1, 8, 2.5); ctx.closePath(); paint(ctx, m.p === 1 && m.t >= 5 ? '#f5c518' : '#e5e7eb', 1.2); }
        else { roundRect(ctx, 7, -2.2, 9, 4.4, 1.2); paint(ctx, fire ? '#7c2d12' : '#57534e', 1.2); circlePath(ctx, 16, 0, 1.7); paint(ctx, fire ? '#fb923c' : '#d6d3d1', 0.9); if (fire) glow(ctx, 17, 0, 3.5, '#fb923c', 0.8); }
        ctx.restore();
      }
      if (m.p === 0 && m.t >= 3) for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * PI / 2 + PI / 4); ctx.translate(15, 0); flame3(ctx, 7, 3.2); ctx.restore(); }   // chrliče plamenů
      // ozubený náboj uprostřed
      ctx.beginPath(); const T = 10; for (let i = 0; i < T * 2; i++) ctx.arc(0, 0, i % 2 ? 7.2 : 9, i / (T * 2) * TAU, (i + 1) / (T * 2) * TAU); ctx.closePath();
      paint(ctx, m.p === 1 && m.t >= 5 ? '#e2b23a' : '#78716c', 1.6);
      circlePath(ctx, 0, 0, 5.6); paint(ctx, m.p === 0 && m.t >= 5 ? '#b91c1c' : m.p === 0 && m.t >= 4 ? '#ea580c' : '#a8a29e', 1.4);
      if (m.p === 0 && m.t >= 4) { glow(ctx, 0, 0, 9, '#fb923c', 0.9); circlePath(ctx, 0, 0, 3); ctx.fillStyle = '#fde047'; ctx.fill(); }
      else { circlePath(ctx, 0, 0, 2.2); paint(ctx, '#57534e', 1); }
      gloss(ctx, -2.5, -2.8, 2.2, 1.2, -0.5, 0.45);
    }
  };

  /* =========================== MRAZIVÝ MÁG =========================== */
  // P1 křehký led (runa, koruna jinovatky, král zimy), P2 aura (vánice), P3 střely (rampouchy, kopí, titán)
  TDS.drawers.mrazivy_mag = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 20, 20);
      if (b >= 3) { circlePath(ctx, 0, 0, 26); fillA(ctx, '#e0f2fe', 0.35); circlePath(ctx, 0, 0, 26); strokeA(ctx, '#bae6fd', 1.4, 0.8); }   // polární aura
      stoneRing(ctx, 19.5, '#a5b4c4', 14, 21);
      circlePath(ctx, 0, 0, 14); paint(ctx, '#e0f2fe', 1.4);   // sněhová plocha
      for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + 0.3; ellipsePath(ctx, Math.cos(an) * 9, Math.sin(an) * 9, 3, 1.6, an); fillA(ctx, '#fff', 0.8); }
      const R = makeRng(5);
      const nc = m.p === 1 && m.t >= 5 ? 6 : 3;
      for (let i = 0; i < nc; i++) {   // shluky ledových krystalů na okraji plošiny
        const an = i / nc * TAU + 0.6;
        for (let k = -1; k <= 1; k++) {
          const h = (k ? 3 : 4.5) + R() * 1.5 + (m.p === 1 && m.t >= 5 ? 1.5 : 0), a2 = an + k * 0.16;
          ctx.save(); ctx.translate(Math.cos(a2) * 16.5, Math.sin(a2) * 16.5); ctx.rotate(a2 + PI / 2 + k * 0.35);
          polyPath(ctx, [[-1.4, 1.2], [-1.1, -h], [0, -h - 1.6], [1.1, -h], [1.4, 1.2]]); paint(ctx, '#bae6fd', 1); polyPath(ctx, [[-1.1, 1.2], [-0.8, -h], [0, -h - 1.6], [0, 1.2]]); fillA(ctx, '#fff', 0.6);
          ctx.restore();
        }
      }
      if (a >= 3) rune(ctx, -9, 8, 6, '#93c5fd', 77);
      if (m.p === 1 && m.t >= 4) for (let i = 0; i < 3; i++) { const an = i * 2.1; ellipsePath(ctx, Math.cos(an) * 20, Math.sin(an) * 20, 6, 3.4, an); paint(ctx, '#cbd5e1', 1.1); }   // mraky vánice
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);   // postava vyplní podstavec
      const titan = m.p === 2 && m.t >= 5, king = m.p === 0 && m.t >= 5;
      const robe = king ? '#e0f2fe' : m.p === 0 && m.t >= 4 ? '#1e3a8a' : titan ? '#7dd3fc' : '#0ea5e9';
      if (titan) {   // ledový titán: mohutná postava z ledových bloků
        for (const sd of [-1, 1]) { ellipsePath(ctx, 3, sd * 9, 5, 3.6, 0); paint(ctx, '#bae6fd', 1.5); polyPath(ctx, [[6, sd * 10.5], [11, sd * 9], [7, sd * 7]]); paint(ctx, '#e0f2fe', 1); }
        regPoly(ctx, -1, 0, 9.5, 6, PI / 6); paint(ctx, '#7dd3fc', 2); regPoly(ctx, -1, 0, 6, 6, PI / 6); fillA(ctx, '#e0f2fe', 0.7);
        circlePath(ctx, 3, 0, 4.6); paint(ctx, '#bae6fd', 1.4); for (const sd of [-1, 1]) { circlePath(ctx, 5.5, sd * 1.6, 0.9); ctx.fillStyle = '#1d4ed8'; ctx.fill(); }
        glow(ctx, -1, 0, 8, '#e0f2fe', 0.5);
        return;
      }
      // plášť a postava s holí
      ctx.beginPath(); ctx.moveTo(-1, -6.5); ctx.quadraticCurveTo(-11, -8, -12.5, 0); ctx.quadraticCurveTo(-11, 8, -1, 6.5); ctx.closePath(); paint(ctx, shade(robe, -0.2), 1.5);
      arm(ctx, -0.5, -5.5, 6, -4.5, robe);
      const spear = m.p === 2 && m.t >= 4;
      line(ctx, -6, 6.5, spear ? 17 : 12, 5); strokeOutlined(ctx, 1.6, spear ? '#bae6fd' : '#7c4a1e');   // hůl / kopí severu
      if (spear) { polyPath(ctx, [[22, 4.6], [16.5, 2.6], [17, 5], [16.5, 7.2]]); paint(ctx, '#e0f2fe', 1.2); glow(ctx, 19, 4.8, 6, '#bae6fd', 0.8); }
      else { glow(ctx, 13, 5, 5 + f * 4, '#bae6fd', 0.8); regPoly(ctx, 13, 5, 3.2, 6, 0); paint(ctx, a >= 1 ? '#e0f2fe' : '#bae6fd', 1.1); circlePath(ctx, 12.3, 4.3, 0.9); ctx.fillStyle = '#fff'; ctx.fill(); }
      arm(ctx, -0.5, 5.5, 6, 6, robe);
      figure(ctx, robe, '#f1c08f', { rx: 5.6, ry: 7.2, hr: 3.6, trim: '#e0f2fe' });
      // špičatý klobouk / koruna
      if (m.p === 0 && m.t >= 4) { regPoly(ctx, 0.5, 0, 5.2, 8, 0); paint(ctx, king ? '#e0f2fe' : '#bae6fd', 1.3); starPath(ctx, 0.5, 0, 6.5, 3.6, 8, 0); paint(ctx, king ? '#bae6fd' : '#93c5fd', 1); circlePath(ctx, 0.5, 0, 2); paint(ctx, '#60a5fa', 0.9); if (king) { ellipsePath(ctx, 4.5, 0, 2.6, 3.2); paint(ctx, '#f8fafc', 1); } }   // ledová koruna (a vous krále)
      else { ellipsePath(ctx, -0.2, 0, 6.6, 6.2); paint(ctx, robe, 1.5); circlePath(ctx, -1, 0, 3.6); paint(ctx, shade(robe, 0.15), 1.1); circlePath(ctx, -2.2, 0, 1.6); paint(ctx, shade(robe, 0.3), 0.9); starPath(ctx, 3, -3.6, 1.4, 0.6, 6, 0); ctx.fillStyle = '#fff'; ctx.fill(); }
      if (c >= 3 && !spear) for (let i = 0; i < 3; i++) { const an = -0.6 + i * 0.6; ctx.save(); ctx.translate(Math.cos(an) * 12 + 2, Math.sin(an) * 12); ctx.rotate(an); polyPath(ctx, [[5, 0], [-2, -1.6], [-3, 0], [-2, 1.6]]); paint(ctx, '#e0f2fe', 0.9); ctx.restore(); }   // rampouchy připravené k hodu
    }
  };

  /* =========================== ORLÍ OSTROSTŘELEC =========================== */
  // P1 síla (arkebuza, popravčí), P2 podpora (kukátko, zásilky, garda), P3 rychlost (dvojhlavň, buben, varhany)
  TDS.drawers.orli_ostrostrelec = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 18, 18);
      const wood = m.p === 1 && m.t >= 5 ? '#7f1d1d' : '#8b5a2b';
      roundRect(ctx, -17, -17, 34, 34, 4); paint(ctx, '#9a9a92', 2.2);   // kamenná věžička
      ctx.save(); roundRect(ctx, -17, -17, 34, 34, 4); ctx.clip(); for (let i = -17; i < 17; i += 6) { line(ctx, i, -17, i, -13); line(ctx, i + 3, 13, i + 3, 17); line(ctx, -17, i, -13, i); line(ctx, 13, i + 3, 17, i + 3); } strokeA(ctx, '#4b4b48', 1, 0.7); ctx.restore();
      roundRect(ctx, -13, -13, 26, 26, 2); paint(ctx, wood, 1.6);
      ctx.save(); roundRect(ctx, -13, -13, 26, 26, 2); ctx.clip(); for (let x = -13; x < 13; x += 3.7) { line(ctx, x, -13, x, 13); strokeA(ctx, shade(wood, -0.4), 0.9, 0.8); } ctx.restore();
      for (const [x, y] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) { roundRect(ctx, x - 3, y - 3, 6, 6, 1); paint(ctx, '#b4b4ac', 1.4); }   // cimbuří v rozích
      if (a >= 2) { for (let i = 0; i < 3; i++) { circlePath(ctx, -9 + i * 2.2, 9.5, 1.1); paint(ctx, a >= 2 ? '#e5e7eb' : '#71717a', 0.7); } }   // stříbrné kule
      if (m.p === 1 && m.t >= 4) { H.crate(ctx, 9, 9, 3.6, '#b45309'); regPoly(ctx, 9, 9, 1.6, 5, 0); paint(ctx, '#fde047', 0.7); }   // královská zásilka
      if (b >= 1) { ellipsePath(ctx, -9, -9, 2.6, 1.6, 0.7); paint(ctx, '#3f3f46', 1); circlePath(ctx, -8, -8, 0.9); fillA(ctx, '#93c5fd', 0.9); }   // kukátko
      if (m.p === 2 && m.t >= 4) for (let i = 0; i < 4; i++) { roundRect(ctx, 6, -12 + i * 2.4, 6, 1.6, 0.6); paint(ctx, '#57534e', 0.7); }   // náboje pro varhany
      gloss(ctx, -8, -11, 7, 2, -0.5, 0.15);
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);   // postava vyplní podstavec
      const coat = m.p === 1 && m.t >= 5 ? '#b91c1c' : m.p === 0 && m.t >= 5 ? '#1f2937' : '#a16207';
      const gold = m.t >= 5, L = 16 + (a >= 3 ? 4 : 0) + (m.p === 0 && m.t >= 5 ? 3 : 0), rec = f * 2.5;
      arm(ctx, -0.5, -5.5, 7 - rec, -1.5, coat); arm(ctx, -0.5, 5.5, 2 - rec, 2.2, coat);
      ctx.save(); ctx.translate(-rec, 0);
      if (m.p === 2 && m.t >= 4) {   // hradní varhany: řada hlavní
        roundRect(ctx, 0, -6, 7, 12, 1.5); paint(ctx, '#6b4320', 1.3);
        for (let i = 0; i < (m.t >= 5 ? 5 : 4); i++) { const y = -4.5 + i * (m.t >= 5 ? 2.25 : 3); roundRect(ctx, 6, y - 1, L - 3, 2, 0.8); paint(ctx, gold ? '#e2b23a' : '#4b5563', 1); }
      } else {
        roundRect(ctx, -2, -2.2, 10, 4.4, 1.5); paint(ctx, '#6b4320', 1.3);   // pažba
        const barrels = c >= 2 ? 2 : 1;
        for (let i = 0; i < barrels; i++) { const y = barrels === 2 ? (i ? 1.3 : -1.3) : 0; roundRect(ctx, 6, y - 1.1, L - 4, 2.2, 0.9); paint(ctx, gold ? '#e2b23a' : a >= 3 ? '#374151' : '#4b5563', 1.1); }
        if (c >= 3) { circlePath(ctx, 7, 0, 3.4); paint(ctx, '#57534e', 1.2); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; circlePath(ctx, 7 + Math.cos(an) * 2, Math.sin(an) * 2, 0.6); ctx.fillStyle = OUT; ctx.fill(); } }   // opakovací buben
        if (b >= 1) { roundRect(ctx, 8, -4.2, 6, 2, 0.8); paint(ctx, '#1f2937', 1); circlePath(ctx, 14, -3.2, 1.1); fillA(ctx, '#93c5fd', 0.9); }   // noční kukátko
      }
      if (f > 0) { glow(ctx, L + 4, 0, 6 + f * 4, '#fde047', f); starPath(ctx, L + 4, 0, 4 + f * 3, 1.6, 6, 0); fillA(ctx, '#fff7c2', f); }
      ctx.restore();
      figure(ctx, coat, '#f1c08f', { rx: 5.6, ry: 7.4, hr: 3.8, trim: gold ? '#fde047' : null });
      // třírohý klobouk s orlím perem
      polyPath(ctx, [[4.2, 0], [-3, -5.4], [-1.2, 0], [-3, 5.4]]); paint(ctx, m.p === 1 && m.t >= 5 ? '#111827' : '#3f2a14', 1.4);
      circlePath(ctx, -0.6, 0, 3); paint(ctx, m.p === 1 && m.t >= 5 ? '#1f2937' : '#57381c', 1.1);
      if (gold) { line(ctx, -3, -5.4, 4.2, 0); line(ctx, 4.2, 0, -3, 5.4); strokeA(ctx, '#fde047', 1, 1); }
      ctx.save(); ctx.translate(-1.5, -2.5); ctx.rotate(-2.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4, -1.8, 8, 0); ctx.quadraticCurveTo(4, 1.8, 0, 0); ctx.closePath(); paint(ctx, '#f5f5f4', 0.9); ctx.restore();
    }
  };

  /* =========================== OBLÉHACÍ KATAPULT =========================== */
  // s.cock 0–1: rameno natažené (1) / právě vystřelilo (0). P1 větší soudky (titán), P2 rumpál + harpuny, P3 delší rameno + koberec
  TDS.drawers.oblehaci_katapult = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 23, 21);
      const wood = m.p === 0 && m.t >= 5 ? '#4a2c17' : m.p === 1 && m.t >= 5 ? '#3f1d1d' : '#8b5a2b';
      circlePath(ctx, 0, 0, 22); paint(ctx, '#7c6a52', 2);   // udusaná hlína
      ctx.save(); circlePath(ctx, 0, 0, 22); ctx.clip(); for (let i = 0; i < 9; i++) { const an = i * 0.7; circlePath(ctx, Math.cos(an) * 15, Math.sin(an * 1.3) * 15, 1.4); fillA(ctx, '#5b4a36', 0.8); } ctx.restore();
      // kola
      for (const [x, y] of [[-12, -15], [12, -15], [-12, 15], [12, 15]]) {
        roundRect(ctx, x - 5, y - 2.4, 10, 4.8, 1.8); paint(ctx, '#3f2a14', 1.4);
        for (let k = -1; k <= 1; k++) { line(ctx, x + k * 3, y - 2.2, x + k * 3, y + 2.2); strokeA(ctx, '#9ca3af', 1, 0.9); }
      }
      roundRect(ctx, -16, -12, 32, 24, 2.5); paint(ctx, wood, 1.8);   // rám
      ctx.save(); roundRect(ctx, -16, -12, 32, 24, 2.5); ctx.clip(); for (let y = -12; y < 12; y += 4) { line(ctx, -16, y, 16, y); strokeA(ctx, shade(wood, -0.4), 0.9, 0.8); } ctx.restore();
      for (const [x, y] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) rivet(ctx, x, y, 1.2, m.t >= 5 ? '#f5c518' : '#9aa2ab');
      if (b >= 1) { circlePath(ctx, -12, 0, 4); paint(ctx, '#6b4320', 1.3); for (let i = 0; i < 4; i++) { const an = i * PI / 4; line(ctx, -12 + Math.cos(an) * 5.5, Math.sin(an) * 5.5, -12 - Math.cos(an) * 5.5, -Math.sin(an) * 5.5); strokeOutlined(ctx, 0.9, '#a06a3a'); } }   // rumpál
      // munice na rámu
      if (m.p === 2 && m.t >= 2) for (let i = 0; i < 4; i++) H.circlePath(ctx, 11 - (i % 2) * 3, -6 + i * 3.4, 1.8), paint(ctx, '#78716c', 0.9);
      if (a >= 1) for (let i = 0; i < (a >= 3 ? 3 : 2); i++) { ellipsePath(ctx, 10, 3 + i * 4, 3.2, 2.4); paint(ctx, '#92400e', 1); line(ctx, 8.2, 3 + i * 4, 11.8, 3 + i * 4); strokeA(ctx, '#9ca3af', 0.8, 1); }
      if (m.p === 1 && m.t >= 3) for (let i = 0; i < 2; i++) { line(ctx, -6, 8 + i * 2, 6, 8 + i * 2); strokeOutlined(ctx, 1.1, '#4b5563'); polyPath(ctx, [[8.5, 8 + i * 2], [6, 6.6 + i * 2], [6, 9.4 + i * 2]]); paint(ctx, '#e5e7eb', 0.7); }   // harpuny
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), cock = s.cock == null ? 1 : s.cock;
      if (s.buffed) buffAura(ctx, 19);
      const L = 17 + (c >= 1 ? 3 : 0) + (m.p === 2 && m.t >= 5 ? 2 : 0), gold = m.t >= 5;
      // vzpěry
      for (const sd of [-1, 1]) { line(ctx, -4, sd * 7, 3, sd * 4); strokeOutlined(ctx, 2.2, '#6b4320'); }
      roundRect(ctx, -2, -7.5, 4, 15, 1.2); paint(ctx, '#4b2e14', 1.3); rivet(ctx, 0, -6, 1, '#9aa2ab'); rivet(ctx, 0, 6, 1, '#9aa2ab');
      // rameno: natažené leží dozadu, po výstřelu se zvedne dopředu (zkrácení = pohled shora)
      let tip = L * (1 - 2 * cock);   // natažené (cock 1) leží dozadu, po výstřelu (0) je vymrštěné dopředu, mezi tím se zvedá
      if (Math.abs(tip) < 5) tip = tip < 0 ? -5 : 5;
      line(ctx, 0, 0, tip, 0); strokeOutlined(ctx, 2.8, m.p === 0 && m.t >= 3 ? '#57534e' : '#8b5a2b');
      if (m.p === 0 && m.t >= 3) for (let i = 1; i < 4; i++) { const x = tip * i / 4; circlePath(ctx, x, 0, 1); ctx.fillStyle = '#d1d5db'; ctx.fill(); }   // železné kování
      const nb = m.p === 2 && m.t >= 5 ? 3 : 1;
      for (let i = 0; i < nb; i++) {   // lžíce s nábojem
        const y = (i - (nb - 1) / 2) * 6.5;
        ctx.save(); ctx.translate(tip, y);
        circlePath(ctx, 0, 0, 4.6 + (a >= 1 ? 0.8 : 0)); paint(ctx, '#6b4320', 1.3);
        if (cock > 0.5) {
          if (m.p === 1 && m.t >= 3) { line(ctx, -3, 0, 4, 0); strokeOutlined(ctx, 1.3, '#4b5563'); polyPath(ctx, [[6.5, 0], [3.5, -2], [3.5, 2]]); paint(ctx, '#e5e7eb', 0.8); }
          else if (m.p === 0 && m.t >= 5) { circlePath(ctx, 0, 0, 4.4); paint(ctx, '#57534e', 1.3); circlePath(ctx, -1.3, -1.3, 1.3); fillA(ctx, '#fff', 0.35); }   // balvan titánů
          else { ellipsePath(ctx, 0, 0, 3.6 + a * 0.3, 3); paint(ctx, '#92400e', 1.1); line(ctx, -2.6, 0, 2.6, 0); strokeA(ctx, '#9ca3af', 0.8, 1); if (m.p === 1 && m.t >= 2) glow(ctx, 0, 0, 5, '#fb923c', 0.8); }
        }
        ctx.restore();
      }
      if (gold) { circlePath(ctx, 0, 0, 2.4); paint(ctx, '#f5c518', 1); }
    }
  };

  /* =========================== ŘÍČNÍ GALÉRA =========================== */
  // P1 hlídka (koš, holub, maják, svatyně, archa), P2 zbraně (harpuny, oheň, děla), P3 vesla a paluby (admirál)
  TDS.drawers.ricni_galera = {
    base: function (ctx, up) {   // vlnky a brázda kolem lodi
      softShadow(ctx, 0, 0, 16, 10);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 22 + i * 3, 13 + i * 2.5, 0, PI * 0.15, PI * 0.85); strokeA(ctx, '#e0f2fe', 1.5, 0.55 - i * 0.15); ctx.beginPath(); ctx.ellipse(0, 0, 22 + i * 3, 13 + i * 2.5, 0, PI * 1.15, PI * 1.85); strokeA(ctx, '#e0f2fe', 1.5, 0.55 - i * 0.15); }
      void up;
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 20);
      const hull = m.p === 1 && m.t >= 5 ? '#7f1d1d' : m.p === 2 && m.t >= 5 ? '#1e3a8a' : '#8b5a2b', gold = m.t >= 5;
      // vesla
      const no = c >= 1 ? 4 : 3;
      for (const sd of [-1, 1]) for (let i = 0; i < no; i++) { const x = -9 + i * (16 / (no - 1)); line(ctx, x, sd * 6, x - 3, sd * 13); strokeOutlined(ctx, 1.2, '#a06a3a'); ellipsePath(ctx, x - 3.2, sd * 13.5, 1.6, 2.6, 0.3); paint(ctx, '#a06a3a', 0.8); }
      // trup: špičatá příď k +x
      ctx.beginPath(); ctx.moveTo(19, 0); ctx.quadraticCurveTo(12, -8, -2, -8); ctx.lineTo(-14, -6.5); ctx.quadraticCurveTo(-17, 0, -14, 6.5); ctx.lineTo(-2, 8); ctx.quadraticCurveTo(12, 8, 19, 0); ctx.closePath(); paint(ctx, hull, 2);
      ctx.beginPath(); ctx.moveTo(15.5, 0); ctx.quadraticCurveTo(10, -5.6, -2, -5.6); ctx.lineTo(-12, -4.6); ctx.quadraticCurveTo(-14, 0, -12, 4.6); ctx.lineTo(-2, 5.6); ctx.quadraticCurveTo(10, 5.6, 15.5, 0); ctx.closePath(); paint(ctx, '#c08a52', 1.2);   // paluba
      ctx.save(); ctx.clip(); for (let x = -14; x < 16; x += 3) { line(ctx, x, -6, x, 6); strokeA(ctx, '#7a4a22', 0.7, 0.7); } ctx.restore();
      if (gold) { ctx.beginPath(); ctx.moveTo(19, 0); ctx.quadraticCurveTo(12, -8, -2, -8); ctx.lineTo(-14, -6.5); strokeA(ctx, '#f5c518', 1.2, 1); ctx.beginPath(); ctx.moveTo(19, 0); ctx.quadraticCurveTo(12, 8, -2, 8); ctx.lineTo(-14, 6.5); strokeA(ctx, '#f5c518', 1.2, 1); }
      if (c >= 3) { roundRect(ctx, -11, -3.6, 9, 7.2, 1.5); paint(ctx, shade(hull, 0.15), 1.3); roundRect(ctx, -9.5, -2.2, 6, 4.4, 1); paint(ctx, shade(hull, 0.3), 1); }   // vyšší paluby
      // zbraně na přídi
      if (b >= 1) { ctx.save(); ctx.translate(12 - f * 1.5, 0); roundRect(ctx, -3, -1.6, 8, 3.2, 1); paint(ctx, '#4b5563', 1.1); if (f < 0.5) { line(ctx, 3, 0, 9, 0); strokeOutlined(ctx, 0.9, '#9ca3af'); polyPath(ctx, [[11, 0], [8, -1.8], [8, 1.8]]); paint(ctx, '#e5e7eb', 0.7); } ctx.restore(); }
      if (b >= 2) for (const sd of [-1, 1]) { circlePath(ctx, 6, sd * 4, 1.8); paint(ctx, '#b45309', 0.9); glow(ctx, 6, sd * 4, 3, '#fb923c', 0.7); }   // hrnce řeckého ohně
      if (b >= 3) for (const sd of [-1, 1]) for (let i = 0; i < (b >= 4 ? 3 : 2); i++) { const x = -6 + i * 5; ctx.save(); ctx.translate(x, sd * 6.5); ctx.rotate(sd * PI / 2); roundRect(ctx, -1.4, -1.6, 5, 3.2, 1); paint(ctx, '#27272a', 1); ctx.restore(); }   // děla na bocích
      // stěžeň s plachtou (shora: vypouklá plachta napříč)
      const sail = m.p === 1 && m.t >= 5 ? '#b91c1c' : m.p === 2 && m.t >= 5 ? '#1d4ed8' : '#f5f5f4';
      ctx.beginPath(); ctx.moveTo(-1, -10); ctx.quadraticCurveTo(4.5, 0, -1, 10); ctx.lineTo(-3, 10); ctx.quadraticCurveTo(1.5, 0, -3, -10); ctx.closePath(); paint(ctx, sail, 1.4);
      if (m.p === 1 && m.t >= 5 || m.p === 2 && m.t >= 5) { circlePath(ctx, 0.2, 0, 2.2); paint(ctx, '#f5c518', 0.9); }
      line(ctx, -2, -10.5, -2, 10.5); strokeOutlined(ctx, 1, '#6b4320');
      circlePath(ctx, -2, 0, a >= 1 ? 2.6 : 1.6); paint(ctx, '#6b4320', 1.1);   // stěžeň / strážní koš
      if (a >= 2) { ellipsePath(ctx, -6, -3, 1.6, 1.1, 0.5); paint(ctx, '#f8fafc', 0.8); }   // holub
      if (a >= 3) { glow(ctx, 9, 0, 6, '#fde68a', 0.9); circlePath(ctx, 9, 0, 2.4); paint(ctx, '#fde047', 1); }   // maják pravdy
      if (a >= 4) { circlePath(ctx, -8, 0, 3.4); paint(ctx, '#f5c518', 1.2); starPath(ctx, -8, 0, 5, 3.4, 8, 0); strokeA(ctx, '#fde68a', 1, 1); }   // sluneční svatyně
      if (a >= 5) { roundRect(ctx, -12, -4.5, 8, 9, 2); paint(ctx, '#e2b23a', 1.3); for (let i = 0; i < 2; i++) { line(ctx, -11, -2 + i * 4, -5, -2 + i * 4); strokeA(ctx, '#92400e', 0.8, 1); } }   // archa vědění
      if (m.p === 2 && m.t >= 5) pennant(ctx, -2, -10, -2.6, 9, '#1d4ed8', '#fde047', 1);   // admirálská vlajka
    }
  };
})();

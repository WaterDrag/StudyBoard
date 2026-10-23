/* td-super-fx.js — Super grafika (td_gfx '2'): efekty. Registruje do window.TDSS:
 *   fx(ctx, f, k, ts) → true, když efekt nakreslil. f = { kind, x, y, r, tx, ty, ang, col, t0 }, k = průběh 0–1.
 * Druhy: boom, boomFire, boomGold, boomSmall, frost, frostRing, acid, ring, reveal, horn, rune, tracer, beam, zap,
 *   missile, meteor, splat, bossdie, sealbreak, upgrade, levelup, place, sell, gold, goldSplash, blade, trap, shrink,
 *   potion, drop, regrow, flame, leak. Celoplošné (bossin, carpet, blizzard) kreslí td-render.js.
 * Styl jako td-super-a.js: tmavé obrysy #111, vrstvené průhledné kruhy místo rozmazání, žádné gradienty. */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const OUT = '#111', PI = Math.PI, TAU = PI * 2;

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
  function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function ellipsePath(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function paint(ctx, fill, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function fillA(ctx, col, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
  function strokeA(ctx, col, lw, a) { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  function glow(ctx, x, y, r, col, a) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * 0.2; circlePath(ctx, x, y, r * (1 - i * 0.2)); ctx.fill(); } ctx.restore(); }
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i % 2 ? r2 : r1; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  function spiky(ctx, x, y, r, n, R, jag) {   // nepravidelný výbuchový tvar
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = i * PI / n, q = i % 2 ? r * (0.62 + R() * 0.1) : r * (1 + (R() - 0.5) * (jag || 0.25)); if (i) ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath();
  }
  function puff(ctx, x, y, r, a, col) {
    ctx.save(); ctx.globalAlpha *= a;
    circlePath(ctx, x, y, r); paint(ctx, col || '#9ca3af', Math.max(1, r * 0.14));
    circlePath(ctx, x - r * 0.3, y - r * 0.3, r * 0.5); ctx.fillStyle = '#e5e7eb'; ctx.fill();
    ctx.restore();
  }
  function coin(ctx, x, y, s, spin) {
    const w = Math.max(0.25, Math.abs(Math.cos(spin)));
    ellipsePath(ctx, x, y, s * w, s); paint(ctx, '#f5c518', Math.max(1, s * 0.28));
    ellipsePath(ctx, x, y, s * w * 0.6, s * 0.6); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = Math.max(0.6, s * 0.15); ctx.stroke();
    ellipsePath(ctx, x - s * 0.3 * w, y - s * 0.35, s * 0.25 * w, s * 0.18); fillA(ctx, '#fff', 0.8);
  }
  function zig(ctx, x0, y0, x1, y1, R, amp) {   // klikatá čára blesku
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / 16));
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) { const t = i / n, o = (R() - 0.5) * (amp || 14); ctx.lineTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o); }
    ctx.lineTo(x1, y1);
  }
  const hexToRgb = function (hex) { const n = parseInt((hex || '#ffffff').slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const darker = function (hex, k) { const c = hexToRgb(hex); return 'rgb(' + (c[0] * k | 0) + ',' + (c[1] * k | 0) + ',' + (c[2] * k | 0) + ')'; };
  const seedOf = function (f) { return ((f.x * 73856093) ^ (f.y * 19349663) ^ ((f.t0 || 0) * 1000 | 0)) >>> 0; };

  /* ---------- Výbuchy ---------- */
  function boom(ctx, f, k) {
    const R = makeRng(seedOf(f)), r = f.r || 30, small = f.kind === 'boomSmall';
    const C = f.kind === 'boomFire' ? ['#b91c1c', '#ef4444', '#fb923c', '#fde68a'] : f.kind === 'boomGold' ? ['#a16207', '#f5c518', '#fde047', '#fffbe0'] : ['#c2410c', '#f97316', '#fbbf24', '#fef9c3'];
    const a = 1 - k;
    if (k < 0.18) { circlePath(ctx, f.x, f.y, r * (0.5 + k * 3)); fillA(ctx, '#fff', 0.8 * (1 - k / 0.18)); }   // záblesk
    // kouř: šedé obláčky rostou a blednou
    const nP = small ? 4 : 7;
    for (let i = 0; i < nP; i++) { const an = i / nP * TAU + R() * 0.6, d = r * (0.35 + k * 0.75) * (0.8 + R() * 0.4); puff(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d - k * r * 0.25, r * (0.22 + k * 0.18) * (0.8 + R() * 0.4), a * 0.85, '#8b8f96'); }
    // ohnivý výbuch
    if (k < 0.7) {
      const q = k / 0.7, s = r * (0.45 + q * 0.6), fa = 1 - q * q;
      ctx.save(); ctx.globalAlpha *= fa;
      spiky(ctx, f.x, f.y, s, small ? 7 : 10, R, 0.35); paint(ctx, C[1], Math.max(1.5, r * 0.07));
      spiky(ctx, f.x, f.y, s * 0.72, small ? 6 : 9, R, 0.3); ctx.fillStyle = C[2]; ctx.fill();
      circlePath(ctx, f.x, f.y, s * 0.4); ctx.fillStyle = C[3]; ctx.fill();
      ctx.restore();
    }
    // úlomky a jiskry letí ven
    const nD = small ? 5 : 9;
    for (let i = 0; i < nD; i++) { const an = R() * TAU, d = r * (0.3 + k * (1 + R() * 0.6)); const x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d + k * k * 10; ctx.save(); ctx.globalAlpha *= a; circlePath(ctx, x, y, 1.6 + R() * 1.6); paint(ctx, i % 3 ? C[2] : '#57534e', 0.9); ctx.restore(); }
    if (f.kind === 'boomGold' && k > 0.1) for (let i = 0; i < 4; i++) { const an = i / 4 * TAU + 0.4, d = r * (0.2 + k * 0.9); ctx.save(); ctx.globalAlpha *= a; coin(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d - Math.sin(k * PI) * 14, 3.6, k * 12 + i); ctx.restore(); }
  }

  /* ---------- Mráz, kyselina, kruhy ---------- */
  function frost(ctx, f, k) {
    const R = makeRng(seedOf(f)), r = f.r || 40, a = 1 - k, ring = f.kind === 'frostRing', rr = r * (ring ? 0.3 + k * 0.7 : 0.55 + k * 0.45);
    circlePath(ctx, f.x, f.y, rr); fillA(ctx, '#e0f2fe', a * 0.25);
    ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); strokeA(ctx, OUT, 4.5, a * 0.6); ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); strokeA(ctx, '#bae6fd', 2.6, a);
    const n = ring ? 12 : 8;
    for (let i = 0; i < n; i++) {   // ledové střepy po obvodu
      const an = i / n * TAU + R() * 0.3, x = f.x + Math.cos(an) * rr, y = f.y + Math.sin(an) * rr, s = 3.5 + R() * 3;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(an);
      polyPath(ctx, [[-s * 0.4, -s * 0.5], [s, 0], [-s * 0.4, s * 0.5], [-s * 0.8, 0]]); paint(ctx, '#e0f2fe', 1);
      polyPath(ctx, [[-s * 0.4, -s * 0.5], [s, 0], [-s * 0.6, 0]]); fillA(ctx, '#fff', 0.7);
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {   // vločky
      const an = R() * TAU, d = rr * R(), x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d - k * 8;
      ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (let j = 0; j < 3; j++) { const b = j * PI / 3 + k * 2; ctx.beginPath(); ctx.moveTo(x - Math.cos(b) * 3, y - Math.sin(b) * 3); ctx.lineTo(x + Math.cos(b) * 3, y + Math.sin(b) * 3); ctx.stroke(); }
      ctx.restore();
    }
  }
  function acid(ctx, f, k) {
    const R = makeRng(seedOf(f)), r = f.r || 30, a = 1 - k;
    ctx.save(); ctx.globalAlpha *= a;
    const pr = r * (0.45 + k * 0.45);
    ctx.beginPath(); for (let i = 0; i < 14; i++) { const an = i / 14 * TAU, q = pr * (0.85 + R() * 0.25); if (i) ctx.lineTo(f.x + Math.cos(an) * q, f.y + Math.sin(an) * q * 0.85); else ctx.moveTo(f.x + Math.cos(an) * q, f.y + Math.sin(an) * q * 0.85); } ctx.closePath();
    paint(ctx, '#84cc16', 1.6); ctx.globalAlpha *= 0.6;
    ellipsePath(ctx, f.x - pr * 0.25, f.y - pr * 0.2, pr * 0.45, pr * 0.25, -0.4); ctx.fillStyle = '#d9f99d'; ctx.fill();
    ctx.globalAlpha /= 0.6;
    for (let i = 0; i < 5; i++) { const x = f.x + (R() - 0.5) * pr * 1.4, y = f.y + (R() - 0.5) * pr - k * 10 * R(), s = 1.5 + R() * 2.5 * (1 - k); circlePath(ctx, x, y, s); paint(ctx, '#bef264', 0.8); circlePath(ctx, x - s * 0.3, y - s * 0.3, s * 0.35); ctx.fillStyle = '#fff'; ctx.fill(); }
    ctx.restore();
  }
  function rings(ctx, f, k) {
    const r = f.r || 40, a = 1 - k, kind = f.kind;
    if (kind === 'ring') { ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); strokeA(ctx, OUT, 6, a * 0.5); ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); strokeA(ctx, f.col || '#fb923c', 3.5, a * 0.85); return; }
    const rr = r * (0.3 + k * 0.7);
    if (kind === 'reveal') {   // odhalení: tečkovaný kruh a oko uprostřed
      ctx.save(); ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(f.x, f.y, rr, k * 2, k * 2 + TAU); strokeA(ctx, '#fff', 2.6, a * 0.8); ctx.restore();
      if (k < 0.6) { const ea = 1 - k / 0.6; ctx.save(); ctx.globalAlpha *= ea; ellipsePath(ctx, f.x, f.y, 9, 5.5); paint(ctx, '#fff', 1.4); circlePath(ctx, f.x, f.y, 3); paint(ctx, '#3b82f6', 1); circlePath(ctx, f.x - 1, f.y - 1, 1); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
      return;
    }
    if (kind === 'horn') {   // roh: zvukové vlny a noty
      for (let i = 0; i < 3; i++) { const q = (k + i / 3) % 1; ctx.beginPath(); ctx.arc(f.x, f.y, r * (0.25 + q * 0.75), 0, TAU); strokeA(ctx, '#facc15', 3 * (1 - q), (1 - q) * a); }
      for (let i = 0; i < 3; i++) { const an = i * 2.1 + 0.5, x = f.x + Math.cos(an) * rr * 0.6, y = f.y + Math.sin(an) * rr * 0.6 - k * 14; ctx.save(); ctx.globalAlpha *= a; ellipsePath(ctx, x, y, 2.6, 2, -0.4); paint(ctx, '#fde047', 1); ctx.beginPath(); ctx.moveTo(x + 2.2, y - 0.5); ctx.lineTo(x + 2.2, y - 8); ctx.lineTo(x + 5, y - 6.5); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
      return;
    }
    // runa: fialový kruh se symboly, točí se
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(k * 2.5); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); strokeA(ctx, '#7c3aed', 4, 0.7); ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); strokeA(ctx, '#ddd6fe', 1.6, 1);
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.8, 0, TAU); strokeA(ctx, '#c4b5fd', 1, 0.8);
    for (let i = 0; i < 6; i++) { const an = i / 6 * TAU, x = Math.cos(an) * rr * 0.9, y = Math.sin(an) * rr * 0.9; starPath(ctx, x, y, 3.4, 1.3, 4, an); paint(ctx, '#f5f3ff', 0.8); }
    ctx.restore();
  }

  /* ---------- Čáry: stopa střely, paprsek, blesk ---------- */
  function tracer(ctx, f, k) {
    const a = 1 - k; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty);
    strokeA(ctx, OUT, 3.4, a * 0.5); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); strokeA(ctx, f.col || '#fde68a', 2, a);
    circlePath(ctx, f.tx, f.ty, 3.5 * a + 1); fillA(ctx, '#fff', a);
  }
  function beam(ctx, f, k, ts) {
    const col = f.col || '#f97316', w = (f.r || 5) * (1 + Math.sin(ts * 0.05) * 0.12);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); strokeA(ctx, col, w * 2.6, 0.25);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); strokeA(ctx, OUT, w + 2.5, 0.6);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); strokeA(ctx, col, w, 0.95);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); strokeA(ctx, '#fff', w * 0.4, 1);
    glow(ctx, f.tx, f.ty, w * 2.6, col, 1); circlePath(ctx, f.tx, f.ty, w * 0.8); ctx.fillStyle = '#fff'; ctx.fill();
  }
  function zap(ctx, f, k, ts) {
    const R = makeRng(seedOf(f) + ((ts / 50) | 0)), a = 1 - k * 0.7, col = f.col || '#c4b5fd';
    zig(ctx, f.x, f.y, f.tx, f.ty, R, 16); strokeA(ctx, col, 6, a * 0.35);
    const R2 = makeRng(seedOf(f) + ((ts / 50) | 0));
    zig(ctx, f.x, f.y, f.tx, f.ty, R2, 16); strokeA(ctx, OUT, 3.6, a * 0.7);
    const R3 = makeRng(seedOf(f) + ((ts / 50) | 0));
    zig(ctx, f.x, f.y, f.tx, f.ty, R3, 16); strokeA(ctx, '#fff', 1.6, a);
    glow(ctx, f.tx, f.ty, 8, col, a); starPath(ctx, f.tx, f.ty, 5, 2, 4, ts * 0.01); fillA(ctx, '#fff', a);
  }

  /* ---------- Létající: raketa, meteor, lahvička, puma ---------- */
  function missile(ctx, f, k) {
    const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k, ang = Math.atan2(f.ty - f.y, f.tx - f.x);
    for (let i = 1; i <= 5; i++) { const q = Math.max(0, k - i * 0.05); puff(ctx, f.x + (f.tx - f.x) * q, f.y + (f.ty - f.y) * q, 2.5 + i * 0.8, 0.6 * (1 - i / 6)); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    polyPath(ctx, [[-6, -2.4], [-11 - Math.random() * 3, 0], [-6, 2.4]]); paint(ctx, '#fb923c', 0); polyPath(ctx, [[-6, -1.2], [-9, 0], [-6, 1.2]]); ctx.fillStyle = '#fde047'; ctx.fill();
    polyPath(ctx, [[-6, -4.5], [-3, -2.5], [-3, 2.5], [-6, 4.5]]); paint(ctx, '#991b1b', 1);
    ctx.beginPath(); ctx.moveTo(-6, -2.6); ctx.lineTo(4, -2.6); ctx.quadraticCurveTo(9, 0, 4, 2.6); ctx.lineTo(-6, 2.6); ctx.closePath(); paint(ctx, '#e5e7eb', 1.2);
    ctx.fillStyle = '#dc2626'; ctx.fillRect(-1, -2.6, 2, 5.2);
    ctx.restore();
  }
  function meteor(ctx, f, k, ts) {
    const sx = f.x + 70, sy = f.y - 230, x = sx + (f.x - sx) * k, y = sy + (f.y - sy) * k, ang = Math.atan2(f.y - sy, f.x - sx);
    ellipsePath(ctx, f.x + 3, f.y + 4, 10 + k * 8, 5 + k * 3); fillA(ctx, '#000', 0.12 + k * 0.18);   // stín na zemi roste
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4, -8 + i * 8 - 1); ctx.quadraticCurveTo(-30, -6 + i * 6, -55 - i * 6, (i - 1) * 4); ctx.quadraticCurveTo(-30, -2 + i * 6, -4, -8 + i * 8 + 5); ctx.closePath(); ctx.fillStyle = ['#ef4444', '#fb923c', '#fde047'][i]; ctx.globalAlpha = 0.8; ctx.fill(); }
    ctx.globalAlpha = 1;
    const R = makeRng(seedOf(f)); ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, q = 9 * (0.8 + R() * 0.35); if (i) ctx.lineTo(Math.cos(an) * q, Math.sin(an) * q); else ctx.moveTo(Math.cos(an) * q, Math.sin(an) * q); } ctx.closePath();
    paint(ctx, '#57534e', 1.8);
    for (let i = 0; i < 3; i++) { circlePath(ctx, (R() - 0.5) * 9, (R() - 0.5) * 9, 1.4 + R()); ctx.fillStyle = '#f97316'; ctx.fill(); }
    ctx.restore();
  }
  function potion(ctx, f, k) {
    const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * PI) * 34;
    ellipsePath(ctx, f.x + (f.tx - f.x) * k + 2, f.y + (f.ty - f.y) * k + 3, 4, 2); fillA(ctx, '#000', 0.2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(k * 9);
    circlePath(ctx, 0, 1.5, 4.2); paint(ctx, f.col && f.col[0] === '#' ? f.col : '#f472b6', 1.3);
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-1.5, -5.5, 3, 3.5); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.strokeRect(-1.5, -5.5, 3, 3.5);
    ctx.fillStyle = '#92400e'; ctx.fillRect(-1.8, -7, 3.6, 1.8);
    circlePath(ctx, -1.4, 0, 1.2); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    ctx.restore();
  }
  function drop(ctx, f, k, ts) {   // puma padá z gryfa: zmenšující se stín, jiskra zápalnice
    const h = 40 * (1 - k);
    ellipsePath(ctx, f.x + 2, f.y + 3, 4 + k * 3, 2 + k * 1.5); fillA(ctx, '#000', 0.15 + k * 0.2);
    const s = 4 + 3 * (1 - k);
    circlePath(ctx, f.x, f.y - h, s); paint(ctx, '#1f2937', 1.4);
    circlePath(ctx, f.x - s * 0.35, f.y - h - s * 0.35, s * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    ctx.fillStyle = Math.sin(ts * 0.05) > 0 ? '#fde047' : '#f97316'; starPath(ctx, f.x, f.y - h - s - 2, 2.6, 1, 4, ts * 0.02); ctx.fill();
  }

  /* ---------- Slizové cákance ---------- */
  function splat(ctx, f, k) {
    const R = makeRng(seedOf(f)), boss = f.kind === 'bossdie', r = (f.r || 10) * (boss ? 1 : 1), a = 1 - k;
    const rainbow = f.col === 'rainbow', col = rainbow ? '#f472b6' : (f.col && f.col[0] === '#' ? f.col : '#4ade80');
    const C = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
    ctx.save(); ctx.globalAlpha *= a;
    if (k < 0.5) {   // louže uprostřed
      const q = k / 0.5, pr = r * (0.6 + q * 0.6);
      ctx.beginPath(); for (let i = 0; i < 12; i++) { const an = i / 12 * TAU, d = pr * (0.7 + R() * 0.5); if (i) ctx.lineTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d); else ctx.moveTo(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d); } ctx.closePath();
      ctx.save(); ctx.globalAlpha *= 1 - q; paint(ctx, col, 1.4); ctx.restore();
    }
    const n = boss ? 16 : 7;
    for (let i = 0; i < n; i++) {   // kapky letí ven
      const an = i / n * TAU + R() * 0.5, d = r * (0.5 + k * (1.4 + R())), s = (boss ? 4.5 : 2.6) * (1 - k * 0.6) * (0.7 + R() * 0.6);
      const x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d;
      ellipsePath(ctx, x, y, s * 1.3, s, an); paint(ctx, rainbow ? C[i % 6] : col, 1);
      ellipsePath(ctx, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.25, an); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    }
    if (boss && k < 0.6) for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + k * 3, d = r * (0.8 + k * 1.2); starPath(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 6, 2.4, 4, an); paint(ctx, '#fde047', 1); }
    ctx.restore();
  }
  function sealbreak(ctx, f, k) {
    const R = makeRng(seedOf(f)), r = (f.r || 30) + 8, a = 1 - k;
    if (k < 0.3) { starPath(ctx, f.x, f.y, r * (0.6 + k * 2), r * 0.25, 8, 0); fillA(ctx, '#ede9fe', 0.6 * (1 - k / 0.3)); }
    for (let i = 0; i < 10; i++) {   // střepy pečeti
      const an = i / 10 * TAU + R() * 0.3, d = r * (1 + k * 0.9), x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d, s = 4 + R() * 3;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(an + k * 6 * (R() - 0.5));
      polyPath(ctx, [[-s, -s * 0.4], [s * 0.8, -s * 0.6], [s * 0.4, s * 0.7]]); paint(ctx, '#c4b5fd', 1.1);
      polyPath(ctx, [[-s, -s * 0.4], [s * 0.8, -s * 0.6], [0, 0]]); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- Vylepšení, stavba, zlato ---------- */
  function upgrade(ctx, f, k) {
    const a = 1 - k, lvl = f.kind === 'levelup';
    ctx.beginPath(); ctx.arc(f.x, f.y, 14 + k * 20, 0, TAU); strokeA(ctx, '#facc15', 3 * a, a * 0.8);
    for (let i = 0; i < 7; i++) { const an = i / 7 * TAU + k * 2, d = 10 + k * 26; ctx.save(); ctx.globalAlpha *= a; starPath(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d - k * 12, 4.5, 1.8, 4, an); paint(ctx, '#fde047', 1); ctx.restore(); }
    const y = f.y - 18 - k * 22;   // šipka nahoru
    ctx.save(); ctx.globalAlpha *= Math.min(1, a * 1.6);
    polyPath(ctx, [[f.x, y - 9], [f.x + 8, y], [f.x + 3.5, y], [f.x + 3.5, y + 8], [f.x - 3.5, y + 8], [f.x - 3.5, y], [f.x - 8, y]]); paint(ctx, lvl ? '#a855f7' : '#22c55e', 1.8);
    polyPath(ctx, [[f.x, y - 9], [f.x - 8, y], [f.x - 3.5, y], [f.x - 3.5, y + 8], [f.x, y + 8]]); fillA(ctx, '#fff', 0.3);
    ctx.restore();
  }
  function place(ctx, f, k) {
    const R = makeRng(seedOf(f)), r = f.r || 20, a = 1 - k;
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + R() * 0.4, d = r * (0.9 + k * 0.8); puff(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d * 0.8 + 3, 3.5 + k * 3, a * 0.8, '#d6c29a'); }
    ctx.beginPath(); ctx.arc(f.x, f.y, r * (1 + k * 0.5), 0, TAU); strokeA(ctx, '#fff', 2.5, a * 0.6);
  }
  function gold(ctx, f, k) {
    const R = makeRng(seedOf(f)), a = Math.min(1, (1 - k) * 2), n = f.kind === 'sell' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const an = -PI / 2 + (R() - 0.5) * 2.2, v = 26 + R() * 18, x = f.x + Math.cos(an) * v * k, y = f.y + Math.sin(an) * v * k + 60 * k * k;   // vyletí a spadnou
      ctx.save(); ctx.globalAlpha *= a; coin(ctx, x, y, 3.6, k * 14 + i); ctx.restore();
    }
    if (k < 0.4) { ctx.save(); ctx.globalAlpha *= 1 - k / 0.4; starPath(ctx, f.x, f.y - 4, 8, 3, 4, 0); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.restore(); }
  }
  function goldSplash(ctx, f, k, ts) {
    const r = f.r || 40, a = 1 - k;
    circlePath(ctx, f.x, f.y, r); fillA(ctx, '#fde047', 0.18 * a);
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); strokeA(ctx, '#f5c518', 2.5, a * 0.8);
    for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + ts * 0.002, d = r * (0.5 + 0.4 * Math.sin(ts * 0.004 + i)); starPath(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 3.4, 1.2, 4, 0); fillA(ctx, '#fffbe0', a); }
  }

  /* ---------- Ostatní ---------- */
  function blade(ctx, f, k) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(k * 14); ctx.globalAlpha *= 1 - k;
    for (let i = 0; i < 4; i++) { ctx.rotate(PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -3, 11, 0); ctx.quadraticCurveTo(6, 1, 2, 2.5); ctx.closePath(); paint(ctx, '#e5e7eb', 1.2); }
    circlePath(ctx, 0, 0, 2.6); paint(ctx, '#6b7280', 1);
    ctx.restore();
  }
  function trap(ctx, f, k) {   // past sklapla: čelisti se zavřou
    const r = (f.r || 12) + 4, a = 1 - k, close = Math.min(1, k * 4);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(f.x, f.y);
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.rotate(sd * (1 - close) * 0.8);
      ctx.beginPath(); ctx.arc(0, 0, r, sd > 0 ? 0.2 : PI + 0.2, sd > 0 ? PI - 0.2 : TAU - 0.2); strokeA(ctx, OUT, 6, 1); ctx.beginPath(); ctx.arc(0, 0, r, sd > 0 ? 0.2 : PI + 0.2, sd > 0 ? PI - 0.2 : TAU - 0.2); strokeA(ctx, '#78716c', 3.5, 1);
      for (let i = 1; i < 6; i++) { const an = (sd > 0 ? 0 : PI) + i * PI / 6; polyPath(ctx, [[Math.cos(an) * r, Math.sin(an) * r], [Math.cos(an) * (r - 5), Math.sin(an) * (r - 5)], [Math.cos(an + 0.15) * r, Math.sin(an + 0.15) * r]]); paint(ctx, '#e7e5e4', 0.8); }
      ctx.restore();
    }
    ctx.restore();
  }
  function shrink(ctx, f, k) {
    const r = f.r || 14, a = 1 - k;
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + k * 3, d = r * 1.6 * (1 - k); ctx.save(); ctx.globalAlpha *= a; starPath(ctx, f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 4, 1.6, 4, an); paint(ctx, '#f9a8d4', 0.9); ctx.restore(); }
    circlePath(ctx, f.x, f.y, r * (1 - k * 0.6)); fillA(ctx, '#fbcfe8', 0.3 * a);
  }
  function regrow(ctx, f, k) {
    const r = (f.r || 12) + 6, a = 1 - k;
    for (let i = 0; i < 5; i++) {
      const an = i / 5 * TAU + k * 4, d = r + k * 6, x = f.x + Math.cos(an) * d, y = f.y + Math.sin(an) * d;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(an + PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3.5, 0, 0, 4); ctx.quadraticCurveTo(-3.5, 0, 0, -4); ctx.closePath(); paint(ctx, '#4ade80', 1);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); strokeA(ctx, '#22c55e', 2, a * 0.7);
  }
  function flame(ctx, f, k, ts) {   // plamenomet: kužel z vrstvených plamínků
    const r = f.r || 60, a = 1 - k * 0.5;
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang || 0); ctx.globalAlpha *= a;
    for (let i = 0; i < 9; i++) {
      const q = ((ts * 0.004 + i / 9) % 1), d = r * q, s = 4 + q * r * 0.22, wob = Math.sin(ts * 0.02 + i * 1.7) * q * r * 0.12;
      const C = q < 0.35 ? ['#fde047', '#fef9c3'] : q < 0.7 ? ['#fb923c', '#fde047'] : ['#ef4444', '#fb923c'];
      ctx.save(); ctx.globalAlpha *= 1 - q * 0.7;
      circlePath(ctx, d, wob, s); paint(ctx, C[0], 1); circlePath(ctx, d - s * 0.2, wob - s * 0.2, s * 0.55); ctx.fillStyle = C[1]; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function leak(ctx, f, k) {   // slizák prošel do hradu: červený záblesk a puklé srdce
    const a = 1 - k;
    ctx.beginPath(); ctx.arc(f.x, f.y, 26 + k * 30, 0, TAU); strokeA(ctx, '#ef4444', 5 * a, a);
    circlePath(ctx, f.x, f.y, 22 + k * 20); fillA(ctx, '#ef4444', 0.25 * a);
    const y = f.y - 8 - k * 20; ctx.save(); ctx.globalAlpha *= a; ctx.translate(f.x, y);
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-10, 0, -8, -9, 0, -4); ctx.bezierCurveTo(8, -9, 10, 0, 0, 7); ctx.closePath(); paint(ctx, '#ef4444', 1.6);
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-1.5, 0); ctx.lineTo(1.5, 2); ctx.lineTo(0, 6); ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }

  const KIND = { boom: boom, boomFire: boom, boomGold: boom, boomSmall: boom, frost: frost, frostRing: frost, acid: acid, ring: rings, reveal: rings, horn: rings, rune: rings,
    tracer: tracer, beam: beam, zap: zap, missile: missile, meteor: meteor, splat: splat, bossdie: splat, sealbreak: sealbreak, upgrade: upgrade, levelup: upgrade,
    place: place, sell: gold, gold: gold, goldSplash: goldSplash, blade: blade, trap: trap, shrink: shrink, potion: potion, drop: drop, regrow: regrow, flame: flame, leak: leak };
  TDS.fx = function (ctx, f, k, ts) {
    const d = KIND[f.kind];
    if (!d) return false;
    ctx.save();
    try { d(ctx, f, Math.max(0, Math.min(1, k)), ts); } catch (_) { /* nic */ }
    ctx.restore();
    return true;
  };
})();

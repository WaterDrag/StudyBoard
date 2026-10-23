/* td-super-heroes.js — Super grafika (td_gfx '2'): hrdinové Bedřich, Radka a Oskar.
 * Registruje do window.TDSS: heroDrawers[id](ctx, lvl, s), hero(ctx, id, x, y, r, ang, ts, lvl, s),
 * heroIcon(id, size), clearCacheHeroes(). Pohled shora, předek = +x (natáčí se za cílem).
 * Vzhled roste po úrovních 1 / 5 / 10 / 15 / 20. s: crit (Bedřich má nabité kritické šípy), casting (právě sesílá).
 * Styl jako td-super-a.js (obrys #111, světlo shora zleva, vrstvené stíny bez rozmazání). */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  TDS.heroDrawers = TDS.heroDrawers || {};
  const OUT = '#111', PI = Math.PI, TAU = PI * 2, SC = 2, SKIN = '#f1c08f';

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
  function strokeA(ctx, col, lw, a) { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  function strokeOutlined(ctx, w, col) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }
  function gloss(ctx, x, y, rx, ry, rot, a) { ellipsePath(ctx, x, y, rx, ry, rot); fillA(ctx, '#fff', a); }
  function glow(ctx, x, y, r, col, a) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * 0.22; circlePath(ctx, x, y, r * (1 - i * 0.2)); ctx.fill(); } ctx.restore(); }
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i % 2 ? r2 : r1; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  function gem(ctx, x, y, r, col) {
    polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y + r], [x - r * 0.85, y]]); paint(ctx, col, 1);
    polyPath(ctx, [[x, y - r], [x + r * 0.85, y], [x, y]]); fillA(ctx, '#fff', 0.4);
  }
  function softShadow(ctx, x, y, rx, ry) {
    ctx.save(); ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.1; ellipsePath(ctx, x + 4, y + 5, rx + 2.5, ry + 2.5); ctx.fill();
    ctx.globalAlpha = 0.13; ellipsePath(ctx, x + 2.5, y + 3, rx + 0.5, ry + 0.5); ctx.fill();
    ctx.restore();
  }
  const tierOf = function (lvl) { return lvl >= 20 ? 4 : lvl >= 15 ? 3 : lvl >= 10 ? 2 : lvl >= 5 ? 1 : 0; };
  // ruka: rukáv od ramene k dlani + dlaň
  function arm(ctx, x0, y0, x1, y1, sleeve, w) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); strokeOutlined(ctx, w || 3, sleeve);
    circlePath(ctx, x1, y1, 2); paint(ctx, SKIN, 1.1);
  }
  // plášť za zády (pod postavou)
  function cape(ctx, col, trim, len, wide, emblem) {
    ctx.beginPath(); ctx.moveTo(-1, -wide * 0.85); ctx.quadraticCurveTo(-len * 0.75, -wide * 1.1, -len, -wide * 0.55); ctx.quadraticCurveTo(-len * 1.08, 0, -len, wide * 0.55); ctx.quadraticCurveTo(-len * 0.75, wide * 1.1, -1, wide * 0.85); ctx.closePath();
    paint(ctx, col, 1.8);
    ctx.save(); ctx.clip(); ellipsePath(ctx, -len * 0.4, wide * 0.5, len * 0.6, wide * 0.5); fillA(ctx, '#000', 0.18); ctx.restore();
    if (trim) { ctx.beginPath(); ctx.moveTo(-len, -wide * 0.55); ctx.quadraticCurveTo(-len * 1.08, 0, -len, wide * 0.55); strokeOutlined(ctx, 1.6, trim); }
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-len * 0.35, i * wide * 0.35); ctx.lineTo(-len * 0.9, i * wide * 0.45); strokeA(ctx, '#000', 0.9, 0.2); }
    if (emblem) { circlePath(ctx, -len * 0.62, 0, wide * 0.28); paint(ctx, emblem, 1.1); starPath(ctx, -len * 0.62, 0, wide * 0.18, wide * 0.08, 5, 0); ctx.fillStyle = '#fff6b0'; ctx.fill(); }
  }
  function torso(ctx, col, trim, rx, ry) {
    ellipsePath(ctx, -1, 0, rx, ry); paint(ctx, col, 1.8);
    ctx.save(); ellipsePath(ctx, -1, 0, rx, ry); ctx.clip(); ellipsePath(ctx, 1.5, 3, rx, ry * 0.8); fillA(ctx, '#000', 0.16); ctx.restore();
    gloss(ctx, -2.8, -ry * 0.45, rx * 0.45, ry * 0.25, -0.3, 0.22);
    if (trim) { ctx.beginPath(); ctx.moveTo(-1 + rx * 0.15, -ry * 0.95); ctx.lineTo(-1 + rx * 0.15, ry * 0.95); strokeA(ctx, trim, 1.4, 0.9); }
  }

  /* ---------- Královský lovec Bedřich: luk, toulec, klobouk s perem ---------- */
  function bedrich(ctx, lvl, s) {
    const t = tierOf(lvl), crit = !!s.crit;
    const tunic = t >= 4 ? '#8c1d1d' : '#2f6b3a', capeCol = t >= 2 ? '#b91c1c' : '#7a4a26', bowCol = t >= 3 ? '#e8b923' : '#8b5a2b';
    softShadow(ctx, 0, 0, 10, 11);
    if (t >= 1) cape(ctx, capeCol, t >= 3 ? '#f5c518' : null, 15 + t * 1.5, 9.5, t >= 4 ? '#f5c518' : null);
    // toulec se šípy na zádech
    ctx.save(); ctx.translate(-5, -4); ctx.rotate(-0.5);
    roundRect(ctx, -7, -2.6, 9, 5.2, 2); paint(ctx, '#7a4a26', 1.4);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-7, i * 1.5); ctx.lineTo(-10.5, i * 1.9); strokeA(ctx, '#e5e7eb', 1.1, 1); polyPath(ctx, [[-10.5, i * 1.9 - 1.3], [-12.5, i * 1.9], [-10.5, i * 1.9 + 1.3]]); paint(ctx, i ? '#ef4444' : '#fff', 0.7); }
    ctx.restore();
    // levá ruka drží luk vpředu, pravá natahuje tětivu
    const bx = 9;
    arm(ctx, -0.5, -6, bx - 0.5, -1.2, tunic, 3);
    arm(ctx, -0.5, 6, 2.5, 2, tunic, 3);
    // luk: oblouk napříč předkem
    ctx.beginPath(); ctx.moveTo(bx - 3, -12); ctx.quadraticCurveTo(bx + 5, 0, bx - 3, 12); strokeOutlined(ctx, 2.4, bowCol);
    if (t >= 1) for (const sd of [-1, 1]) { circlePath(ctx, bx - 3, sd * 12, 1.4); paint(ctx, '#f5c518', 0.9); }
    ctx.beginPath(); ctx.moveTo(bx - 3, -12); ctx.lineTo(2.5, 0); ctx.lineTo(bx - 3, 12); strokeA(ctx, '#f8fafc', 0.8, 0.9);   // tětiva
    // šíp na tětivě
    if (crit) glow(ctx, bx + 8, 0, 7, '#f472b6', 0.9);
    ctx.beginPath(); ctx.moveTo(2.5, 0); ctx.lineTo(bx + 7, 0); strokeOutlined(ctx, 1.1, '#d6b98c');
    polyPath(ctx, [[bx + 10.5, 0], [bx + 6.5, -2.2], [bx + 6.5, 2.2]]); paint(ctx, crit ? '#f472b6' : '#cbd5e1', 1);
    polyPath(ctx, [[2.5, 0], [0.5, -2], [4, 0], [0.5, 2]]); paint(ctx, '#ef4444', 0.8);
    torso(ctx, tunic, '#7a4a26', 6.5, 8.5);
    if (t >= 2) for (const sd of [-1, 1]) { ellipsePath(ctx, -1, sd * 6.8, 3.4, 2.6); paint(ctx, t >= 4 ? '#f5c518' : '#9ca3af', 1.3); gloss(ctx, -1.8, sd * 6.8 - 0.8, 1.4, 0.8, 0, 0.5); }
    // hlava: klobouk s krempou a pérem
    circlePath(ctx, 0.5, 0, 4.6); paint(ctx, SKIN, 1.4);
    ellipsePath(ctx, -0.5, 0, 7.4, 6.6); paint(ctx, t >= 4 ? '#7f1d1d' : '#3f6b2f', 1.7);   // krempa
    circlePath(ctx, -0.8, 0, 4.5); paint(ctx, t >= 4 ? '#991b1b' : '#4d7c3a', 1.4);
    ctx.beginPath(); ctx.arc(-0.8, 0, 4.5, PI * 0.15, PI * 0.85); strokeA(ctx, t >= 3 ? '#f5c518' : '#7a4a26', 1.4, 1);   // stužka
    gloss(ctx, -2.5, -2, 1.8, 1, -0.5, 0.5);
    ctx.save(); ctx.translate(-1, -3); ctx.rotate(-2.6);   // pero
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(5, -2.2, 10, 0); ctx.quadraticCurveTo(5, 2.2, 0, 0); ctx.closePath(); paint(ctx, t >= 4 ? '#f5c518' : '#ef4444', 1);
    ctx.beginPath(); ctx.moveTo(0.5, 0); ctx.lineTo(9, 0); strokeA(ctx, '#000', 0.6, 0.35);
    ctx.restore();
  }

  /* ---------- Runová čarodějka Radka: špičatý klobouk, hůl s krystalem, runy ---------- */
  function radka(ctx, lvl, s) {
    const t = tierOf(lvl), cast = !!s.casting;
    const robe = t >= 4 ? '#3b1d7a' : '#6d28d9', trim = t >= 2 ? '#f5c518' : '#c4b5fd', orb = t >= 3 ? '#67e8f9' : '#c084fc';
    softShadow(ctx, 0, 0, 10, 10.5);
    if (t >= 2) {   // runový kruh pod nohama
      circlePath(ctx, 0, 0, 15); strokeA(ctx, '#a78bfa', 1.4, 0.55);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; starPath(ctx, Math.cos(a) * 15, Math.sin(a) * 15, 1.8, 0.7, 4, a); fillA(ctx, '#ddd6fe', 0.85); }
    }
    cape(ctx, robe, trim, 13 + t, 9, null);
    // vlasy splývající dozadu
    ctx.beginPath(); ctx.moveTo(-2, -5); ctx.quadraticCurveTo(-11, -7, -13, -1); ctx.quadraticCurveTo(-12, 5, -2, 5); ctx.closePath(); paint(ctx, '#e0a33a', 1.4);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-3, i * 2.4); ctx.quadraticCurveTo(-8, i * 3.4, -12, i * 2); strokeA(ctx, '#a16207', 0.7, 0.6); }
    // pravá ruka s holí vpředu vpravo, levá sesílá jiskry
    arm(ctx, -0.5, 6, 6, 6.5, robe, 3);
    ctx.beginPath(); ctx.moveTo(-6, 7.5); ctx.lineTo(13, 5.5); strokeOutlined(ctx, 1.8, '#7c4a1e');
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(12 - i * 1.6, 3.6); ctx.lineTo(12.6 - i * 1.6, 7.4); strokeA(ctx, trim, 1, 0.9); }
    if (cast) glow(ctx, 15, 5.3, 10, orb, 1);
    circlePath(ctx, 15, 5.3, 3.2); paint(ctx, orb, 1.3); gloss(ctx, 14, 4.3, 1.2, 0.8, -0.5, 0.9);
    arm(ctx, -0.5, -6, 6.5, -5, robe, 3);
    if (cast || t >= 1) { glow(ctx, 8.5, -5, cast ? 6 : 3.5, '#a78bfa', cast ? 1 : 0.6); starPath(ctx, 8.5, -5, 2.4, 0.9, 4, 0.4); ctx.fillStyle = '#f5f3ff'; ctx.fill(); }
    torso(ctx, robe, trim, 6.2, 8);
    // špičatý klobouk shora: široká krempa, kužel se špičkou trochu dozadu, hvězdy
    ellipsePath(ctx, -0.5, 0, 8.6, 8); paint(ctx, robe, 1.8);
    ctx.save(); ellipsePath(ctx, -0.5, 0, 8.6, 8); ctx.clip(); ellipsePath(ctx, 2, 2.5, 8, 7); fillA(ctx, '#000', 0.2); ctx.restore();
    circlePath(ctx, -1, 0, 5); paint(ctx, shade(robe, 0.12), 1.4);
    ctx.beginPath(); ctx.arc(-1, 0, 5, 0, TAU); strokeA(ctx, trim, 1.2, 1);
    circlePath(ctx, -2.5, 0, 3.1); paint(ctx, shade(robe, 0.22), 1.2);
    circlePath(ctx, -3.6, 0, 1.4); paint(ctx, shade(robe, 0.32), 1);
    for (const [x, y] of [[3.5, -4.5], [2.5, 5], [-5.5, 4]]) { starPath(ctx, x, y, 1.5, 0.6, 5, 0.3); ctx.fillStyle = t >= 2 ? '#fde047' : '#e9d5ff'; ctx.fill(); }
    if (t >= 4) for (let i = 0; i < 5; i++) { const a = PI * 0.6 + i * PI * 0.2; ctx.beginPath(); ctx.moveTo(-1 + Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(-1 + Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(-1 + Math.cos(a + 0.12) * 6.5, Math.sin(a + 0.12) * 6.5); ctx.lineTo(-1 + Math.cos(a + 0.2) * 9.5, Math.sin(a + 0.2) * 9.5); strokeA(ctx, '#fde047', 1.1, 1); }   // koruna z blesků
    gloss(ctx, -3, -4, 2.4, 1.2, -0.5, 0.35);
  }

  /* ---------- Královský kronikář Oskar: baret, brýle, otevřená kniha, svitky ---------- */
  function oskar(ctx, lvl, s) {
    const t = tierOf(lvl), cast = !!s.casting;
    const robe = t >= 4 ? '#134e4a' : '#0f766e', trim = t >= 2 ? '#f5c518' : '#99f6e4', cover = t >= 3 ? '#b8860b' : '#7c2d12';
    softShadow(ctx, 0, 0, 10, 11);
    cape(ctx, robe, trim, 12 + t, 9.5, null);
    // brašna se svitky na zádech
    ctx.save(); ctx.translate(-6, 5); ctx.rotate(0.4);
    roundRect(ctx, -5, -3.5, 9, 7, 2); paint(ctx, '#8b5a2b', 1.4);
    for (let i = -1; i <= 1; i++) { roundRect(ctx, -7.5, i * 2 - 0.9, 4, 1.8, 0.8); paint(ctx, '#fef3c7', 0.8); }
    ctx.restore();
    // ruce drží otevřenou knihu vpředu
    arm(ctx, -0.5, -6, 6, -4.2, robe, 3);
    arm(ctx, -0.5, 6, 6, 4.2, robe, 3);
    if (cast) glow(ctx, 10, 0, 10, '#fde68a', 1);
    ctx.save(); ctx.translate(9.5, 0);
    roundRect(ctx, -3.5, -7.5, 7, 15, 1.5); paint(ctx, cover, 1.6);
    roundRect(ctx, -2.8, -6.6, 5.6, 6.2, 0.8); paint(ctx, '#fffbeb', 0.9); roundRect(ctx, -2.8, 0.4, 5.6, 6.2, 0.8); paint(ctx, '#fffbeb', 0.9);
    for (const sy of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-1.8 + i * 1.4, sy * 1.4); ctx.lineTo(-1.8 + i * 1.4, sy * 5.6); strokeA(ctx, '#78716c', 0.5, 0.7); }
    ctx.beginPath(); ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0); strokeA(ctx, OUT, 1, 1);
    if (t >= 1) { circlePath(ctx, 3.5, 0, 1.3); paint(ctx, '#f5c518', 0.8); }
    ctx.restore();
    torso(ctx, robe, trim, 6.5, 8.5);
    if (t >= 4) { ctx.beginPath(); ctx.arc(1, 0, 6.2, -1.2, 1.2); strokeOutlined(ctx, 1, '#f5c518'); circlePath(ctx, 7, 0, 2); paint(ctx, '#f5c518', 1); gem(ctx, 7, 0, 1.1, '#ef4444'); }   // řetěz s medailonem
    // hlava: baret, brýle a brk za uchem
    circlePath(ctx, 0.8, 0, 4.6); paint(ctx, SKIN, 1.4);
    for (const sd of [-1, 1]) { circlePath(ctx, 4.2, sd * 1.8, 1.4); strokeA(ctx, OUT, 0.9, 1); circlePath(ctx, 4.2, sd * 1.8, 1.4); fillA(ctx, '#e0f2fe', 0.6); }
    ellipsePath(ctx, -1.2, 0, 5.6, 5.4); paint(ctx, t >= 2 ? '#7c2d12' : '#1f2937', 1.6);   // baret
    circlePath(ctx, -1.6, 0, 1.2); paint(ctx, t >= 2 ? '#f5c518' : '#4b5563', 0.8);
    gloss(ctx, -3, -2.2, 2, 1.1, -0.5, 0.4);
    ctx.save(); ctx.translate(0.5, 4); ctx.rotate(2.5);   // brk
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4.5, -1.8, 9, 0); ctx.quadraticCurveTo(4.5, 1.8, 0, 0); ctx.closePath(); paint(ctx, t >= 3 ? '#fde047' : '#f8fafc', 0.9);
    ctx.restore();
    if (t >= 4) for (let i = 0; i < 5; i++) { const a = PI * 0.7 + i * PI * 0.15; ellipsePath(ctx, -1.2 + Math.cos(a) * 5.4, Math.sin(a) * 5.4, 1.8, 0.9, a + PI / 2); paint(ctx, '#65a30d', 0.7); }   // vavřín
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  TDS.heroDrawers.lovec_bedrich = bedrich;
  TDS.heroDrawers.carodejka_radka = radka;
  TDS.heroDrawers.kronikar_oskar = oskar;

  /* ---------- Živé doplňky (každý snímek): runy kolem Radky, svitky kolem Oskara ---------- */
  function live(ctx, id, lvl, ts, s) {
    const t = tierOf(lvl), sec = ts / 1000;
    if (id === 'carodejka_radka' && t >= 3) {
      for (let i = 0; i < 3; i++) {
        const a = sec * 1.4 + i * TAU / 3, x = Math.cos(a) * 17, y = Math.sin(a) * 17;
        glow(ctx, x, y, 5, '#a78bfa', 0.7);
        polyPath(ctx, [[x, y - 3.4], [x + 2.2, y], [x, y + 3.4], [x - 2.2, y]]); paint(ctx, '#c4b5fd', 1);
      }
    }
    if (id === 'kronikar_oskar' && t >= 2) {
      for (let i = 0; i < 2; i++) {
        const a = -sec * 0.9 + i * PI, x = Math.cos(a) * 16, y = Math.sin(a) * 16 + Math.sin(sec * 3 + i) * 1.5;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + PI / 2);
        roundRect(ctx, -3.5, -2.2, 7, 4.4, 0.8); paint(ctx, '#fef3c7', 1);
        for (const e of [-3.6, 3.6]) { roundRect(ctx, e - 0.9, -2.8, 1.8, 5.6, 0.8); paint(ctx, '#b45309', 0.8); }
        ctx.restore();
      }
    }
    if (id === 'lovec_bedrich' && s.crit) {
      const k = (sec * 2) % 1;
      circlePath(ctx, 0, 0, 13 + k * 6); strokeA(ctx, '#f472b6', 1.6, 0.6 * (1 - k));
    }
  }

  /* ---------- Vykreslení s mezipamětí (2× rozlišení) ---------- */
  const cache = new Map();
  TDS.clearCacheHeroes = function () { cache.clear(); };
  function sprite(id, lvl, s) {
    const key = id + '|' + tierOf(lvl) + '|' + (s.crit ? 1 : 0) + '|' + (s.casting ? 1 : 0);
    let c = cache.get(key);
    if (!c) {
      const S = 80 * SC; c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.scale(SC, SC);
      try { TDS.heroDrawers[id](g, lvl, s); } catch (_) { /* nic */ }
      cache.set(key, c);
    }
    return c;
  }
  TDS.hero = function (ctx, id, x, y, r, ang, ts, lvl, s) {
    if (!TDS.heroDrawers[id]) return;
    s = s || {};
    const k = (r || 20) / 20;   // kresby jsou pro poloměr 20
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    // zlatá záře hrdiny na zemi
    const pulse = Math.sin(ts * 0.0025) * 1.5;
    circlePath(ctx, 0, 0, 24 + pulse); strokeA(ctx, '#facc15', 2, 0.45);
    circlePath(ctx, 0, 0, 24 + pulse); fillA(ctx, '#fde68a', 0.1);
    ctx.save(); ctx.rotate(ang || 0); ctx.scale(1.22, 1.22); ctx.drawImage(sprite(id, lvl, s), -40, -40, 80, 80); live(ctx, id, lvl, ts, s); ctx.restore();   // postava vyplní kruh
    // odznak úrovně
    if (!s.icon) {
      const bx = 15, by = -15;
      circlePath(ctx, bx, by, 7.5); paint(ctx, '#1e1b4b', 1.6);
      ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, TAU); strokeA(ctx, '#f5c518', 1.2, 1);
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 9px Geist, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lvl, bx, by + 0.5); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  };
  TDS.heroIcon = function (id, size) {
    const key = 'icon|' + id + '|' + size;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.scale(size / 60, size / 60); g.translate(30, 30);
    try { TDS.hero(g, id, 0, 0, 20, -0.5, 0, 1, { icon: true }); } catch (_) { /* nic */ }
    cache.set(key, c);
    return c;
  };
})();

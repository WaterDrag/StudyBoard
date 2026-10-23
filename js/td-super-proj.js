/* td-super-proj.js — Super grafika (td_gfx '2'): střely věží a hrdinů (kromě těch z td-super-a.js).
 * Registruje do window.TDSS.projectileDrawers[kind](ctx): střela míří k +x, vejde se do 48×48 kolem počátku.
 * Točící se střely (blade, shuriken, barrel, flask, scroll) roztáčí td-render.js podle TDSS.projectileSpin.
 * Styl jako td-super-a.js (obrys #111, světlo shora zleva, bez rozmazání). */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const OUT = '#111', PI = Math.PI, TAU = PI * 2;

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
  function glow(ctx, x, y, r, col, a) { ctx.save(); ctx.fillStyle = col; for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * 0.22; circlePath(ctx, x, y, r * (1 - i * 0.2)); ctx.fill(); } ctx.restore(); }
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + i * PI / n, r = i % 2 ? r2 : r1; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  function teardrop(ctx, len, w) {   // kapka: kulatý konec v počátku, špička v (len, 0)
    const r = w * 0.55;
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.quadraticCurveTo(len * 0.4, -w, 0, -r); ctx.arc(0, 0, r, -PI / 2, PI / 2, true); ctx.quadraticCurveTo(len * 0.4, w, len, 0); ctx.closePath();
  }
  function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }

  // Šíp: dřík, hrot a letky; crit = růžově žhnoucí
  function arrow(ctx, crit, big) {
    const L = big ? 15 : 11, w = big ? 2.2 : 1.4;
    if (crit) { glow(ctx, 3, 0, 10, '#f472b6', 0.9); }
    line(ctx, -L, 0, L - 4, 0); strokeOutlined(ctx, w, big ? '#6b4320' : '#d6b98c');
    polyPath(ctx, [[L + 2, 0], [L - 5, -3.2 * (big ? 1.4 : 1)], [L - 3.5, 0], [L - 5, 3.2 * (big ? 1.4 : 1)]]); paint(ctx, crit ? '#f472b6' : '#cbd5e1', 1.1);
    polyPath(ctx, [[L + 2, 0], [L - 5, -3.2 * (big ? 1.4 : 1)], [L - 3.5, 0]]); fillA(ctx, '#fff', 0.5);
    for (const sd of [-1, 1]) { polyPath(ctx, [[-L + 5, 0], [-L - 1, sd * 3.6], [-L - 2.5, sd * 3.2], [-L + 1, 0]]); paint(ctx, crit ? '#fde047' : '#ef4444', 0.9); }
  }
  const P = TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {
    arrow: function (ctx) { arrow(ctx, false, false); },
    arrowCrit: function (ctx) { arrow(ctx, true, false); },
    ballista: function (ctx) { arrow(ctx, false, true); },
    spike: function (ctx) {   // ocelový hrot z čepové věže
      polyPath(ctx, [[9, 0], [-4, -3], [-6, 0], [-4, 3]]); paint(ctx, '#d1d5db', 1.2);
      polyPath(ctx, [[9, 0], [-4, -3], [-6, 0]]); fillA(ctx, '#fff', 0.55);
    },
    shard: function (ctx) {   // krystalový střep
      polyPath(ctx, [[9, 0], [1, -3.6], [-6, -1.5], [-5, 2], [1, 3.4]]); paint(ctx, '#a5f3fc', 1.2);
      polyPath(ctx, [[9, 0], [1, -3.6], [-6, -1.5], [1, 0]]); fillA(ctx, '#fff', 0.6);
    },
    icicle: function (ctx) {   // rampouch mrazivého mága
      glow(ctx, 0, 0, 9, '#bae6fd', 0.6);
      polyPath(ctx, [[11, 0], [-3, -3.8], [-7, -1.4], [-6, 1.6], [-3, 3.8]]); paint(ctx, '#e0f2fe', 1.3);
      polyPath(ctx, [[11, 0], [-3, -3.8], [-7, -1.4], [0, 0]]); fillA(ctx, '#7dd3fc', 0.5);
      line(ctx, -4, 0, 8, 0); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.stroke();
    },
    blade: function (ctx) {   // točivá čepel (roztáčí se živě)
      for (let i = 0; i < 4; i++) { ctx.rotate(PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -3.5, 11, 0); ctx.quadraticCurveTo(6, 1, 2, 3); ctx.closePath(); paint(ctx, '#e5e7eb', 1.2); }
      circlePath(ctx, 0, 0, 2.8); paint(ctx, '#6b7280', 1.1); circlePath(ctx, -0.8, -0.8, 0.9); ctx.fillStyle = '#fff'; ctx.fill();
    },
    flame: function (ctx) {   // plamínek
      teardrop(ctx, -12, 7); paint(ctx, '#ef4444', 1.2);
      teardrop(ctx, -8.5, 4.8); ctx.fillStyle = '#fb923c'; ctx.fill();
      teardrop(ctx, -5, 2.8); ctx.fillStyle = '#fde047'; ctx.fill();
    },
    iceball: function (ctx) {
      glow(ctx, 0, 0, 12, '#bae6fd', 0.8);
      circlePath(ctx, 0, 0, 7); paint(ctx, '#e0f2fe', 1.5);
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(i * PI / 3); line(ctx, -4.5, 0, 4.5, 0); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore(); }
      circlePath(ctx, -2.5, -2.5, 1.8); ctx.fillStyle = '#fff'; ctx.fill();
    },
    barrel: function (ctx) {   // sud z katapultu (točí se)
      ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 7, 0, 0, TAU); paint(ctx, '#92400e', 1.6);
      for (const x of [-4.5, 4.5]) { line(ctx, x, -6.6, x, 6.6); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1.5; ctx.stroke(); }
      for (const y of [-3, 0, 3]) { line(ctx, -7.5, y, 7.5, y); ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 0.8; ctx.stroke(); }
      polyPath(ctx, [[-1.5, -2], [1.5, -2], [0, 2.5]]); paint(ctx, '#fde047', 0.8);   // výbušnina
      ellipsePath(ctx, -3, -3.5, 3, 1.4, -0.3); fillA(ctx, '#fff', 0.25);
    },
    harpoonBolt: function (ctx) {   // harpuna galéry
      line(ctx, -14, 0, 8, 0); strokeOutlined(ctx, 2.6, '#4b5563');
      polyPath(ctx, [[15, 0], [7, -5], [9, 0], [7, 5]]); paint(ctx, '#e5e7eb', 1.3);
      for (const sd of [-1, 1]) { polyPath(ctx, [[6, sd * 1.5], [2, sd * 4.5], [3.5, sd * 1.5]]); paint(ctx, '#9ca3af', 0.9); }
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-18, 4, -22, 1); ctx.strokeStyle = '#d6b98c'; ctx.lineWidth = 1.2; ctx.stroke();   // lano
    },
    cannon: function (ctx) {   // dělová koule
      circlePath(ctx, 0, 0, 6.5); paint(ctx, '#27272a', 1.6);
      circlePath(ctx, -2.2, -2.2, 2.2); fillA(ctx, '#fff', 0.45); circlePath(ctx, 2, 2.2, 3); fillA(ctx, '#000', 0.3);
    },
    dart: function (ctx) {   // šipka ostrostřelce
      line(ctx, -9, 0, 6, 0); strokeOutlined(ctx, 1.5, '#e5e7eb');
      polyPath(ctx, [[10, 0], [5, -2.2], [5, 2.2]]); paint(ctx, '#9ca3af', 1);
      for (const sd of [-1, 1]) { polyPath(ctx, [[-6, 0], [-11, sd * 4], [-12, sd * 3.4], [-9, 0]]); paint(ctx, '#0e7490', 0.9); }
    },
    dartSmall: function (ctx) {
      line(ctx, -6, 0, 4, 0); strokeOutlined(ctx, 1.1, '#e5e7eb');
      polyPath(ctx, [[7, 0], [3, -1.8], [3, 1.8]]); paint(ctx, '#9ca3af', 0.9);
      polyPath(ctx, [[-4, 0], [-8, -3], [-8, 3]]); paint(ctx, '#0e7490', 0.8);
    },
    bolt: function (ctx) {   // magická střela čaroděje
      glow(ctx, 0, 0, 11, '#c084fc', 0.9);
      teardrop(ctx, -13, 6); paint(ctx, '#a855f7', 1.2);
      circlePath(ctx, 0, 0, 3.2); ctx.fillStyle = '#f5f3ff'; ctx.fill();
      starPath(ctx, 0, 0, 5, 1.6, 4, PI / 4); fillA(ctx, '#fff', 0.8);
    },
    boltTrue: function (ctx) {   // pravá (nezastavitelná) střela: zlatobílá
      glow(ctx, 0, 0, 12, '#fde68a', 0.9);
      teardrop(ctx, -14, 6.5); paint(ctx, '#f5d0fe', 1.2);
      circlePath(ctx, 0, 0, 3.4); ctx.fillStyle = '#fff'; ctx.fill();
      starPath(ctx, 0, 0, 6, 1.8, 4, 0); fillA(ctx, '#fde047', 0.9);
    },
    phoenixFire: function (ctx) {   // ohnivé pírko fénixe
      glow(ctx, 0, 0, 11, '#fb923c', 0.9);
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.quadraticCurveTo(0, -6, -11, -2); ctx.lineTo(-8, 0); ctx.lineTo(-11, 2); ctx.quadraticCurveTo(0, 6, 9, 0); ctx.closePath(); paint(ctx, '#f97316', 1.2);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(0, -3, -7, -0.8); ctx.lineTo(-7, 0.8); ctx.quadraticCurveTo(0, 3, 7, 0); ctx.closePath(); ctx.fillStyle = '#fde047'; ctx.fill();
    },
    fireball: function (ctx) {
      glow(ctx, 0, 0, 15, '#fb923c', 0.9);
      teardrop(ctx, -17, 10); paint(ctx, '#ef4444', 1.4);
      teardrop(ctx, -12, 7); ctx.fillStyle = '#fb923c'; ctx.fill();
      circlePath(ctx, 0.5, 0, 4.5); ctx.fillStyle = '#fde047'; ctx.fill();
      circlePath(ctx, 1.5, -1.2, 1.8); ctx.fillStyle = '#fff'; ctx.fill();
    },
    flask: function (ctx) {   // lahvička alchymisty (točí se)
      circlePath(ctx, 0, 2, 5.5); paint(ctx, '#a3e635', 1.4);
      ctx.save(); circlePath(ctx, 0, 2, 5.5); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-6, -4, 12, 3.8); ctx.restore();
      ctx.beginPath(); ctx.rect(-2, -7, 4, 5); paint(ctx, '#e5e7eb', 1.1);
      ctx.beginPath(); ctx.rect(-2.6, -9, 5.2, 2.4); paint(ctx, '#92400e', 1);
      circlePath(ctx, -2, 0.5, 1.4); ctx.fillStyle = '#fff'; ctx.fill();
      circlePath(ctx, 1.8, 3.5, 1); ctx.fillStyle = '#ecfccb'; ctx.fill();
    },
    scroll: function (ctx) {   // svitek kronikáře (točí se)
      ctx.beginPath(); ctx.rect(-6, -4.5, 12, 9); paint(ctx, '#fef3c7', 1.2);
      for (const y of [-1.8, 0, 1.8]) { line(ctx, -4, y, 4, y); ctx.strokeStyle = 'rgba(120,80,30,0.5)'; ctx.lineWidth = 0.7; ctx.stroke(); }
      for (const x of [-6.5, 6.5]) { ctx.beginPath(); ctx.ellipse(x, 0, 1.8, 5.5, 0, 0, TAU); paint(ctx, '#b45309', 1); }
      circlePath(ctx, 0, 4.5, 1.6); paint(ctx, '#dc2626', 0.8);   // pečeť
    },
    thorn: function (ctx) {   // trn druida
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(0, -1.5, -6, -4); ctx.lineTo(-5, 3.6); ctx.quadraticCurveTo(1, 1.8, 10, 0); ctx.closePath(); paint(ctx, '#166534', 1.2);
      ctx.beginPath(); ctx.moveTo(8, -0.3); ctx.lineTo(-3.5, -2.4); ctx.lineTo(-3, -0.8); ctx.closePath(); fillA(ctx, '#86efac', 0.8);
      ctx.save(); ctx.translate(-4, 2); ctx.rotate(0.9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(2.5, -2, 5, 0); ctx.quadraticCurveTo(2.5, 2, 0, 0); ctx.closePath(); paint(ctx, '#4ade80', 0.8); ctx.restore();
    },
    shuriken: function (ctx) {   // hvězdice zvěda (točí se)
      starPath(ctx, 0, 0, 9, 2.8, 4, 0); paint(ctx, '#475569', 1.3);
      starPath(ctx, 0, 0, 9, 2.8, 4, 0); ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(-10, -10, 10, 10); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); ctx.restore();
      for (let i = 0; i < 4; i++) { const a = i * PI / 2; line(ctx, Math.cos(a) * 2.6, Math.sin(a) * 2.6, Math.cos(a) * 7.5, Math.sin(a) * 7.5); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.9; ctx.stroke(); }
      circlePath(ctx, 0, 0, 1.6); ctx.fillStyle = OUT; ctx.fill();
    },
    dagger: function (ctx) {   // stínová dýka
      ellipsePath(ctx, -3, 0, 12, 5); fillA(ctx, '#7c3aed', 0.3);
      polyPath(ctx, [[11, 0], [0, -2.6], [0, 2.6]]); paint(ctx, '#e2e8f0', 1.1);
      line(ctx, 1, 0, 9, 0); ctx.strokeStyle = 'rgba(100,116,139,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.rect(-1.4, -4.5, 2.4, 9); paint(ctx, '#a16207', 1);
      ctx.beginPath(); ctx.rect(-7.5, -1.5, 6, 3); paint(ctx, '#3f2a14', 1);
      circlePath(ctx, -8.5, 0, 2); paint(ctx, '#7c3aed', 0.9);
    },
    flashBomb: function (ctx) {   // záblesková bomba
      glow(ctx, 0, 0, 11, '#fde047', 0.7);
      circlePath(ctx, 0, 0, 6); paint(ctx, '#f8fafc', 1.5);
      starPath(ctx, 0, 0, 4, 1.6, 4, PI / 4); ctx.fillStyle = '#facc15'; ctx.fill();
      ctx.beginPath(); ctx.rect(-1, -9, 2, 3.5); paint(ctx, '#78716c', 0.8);
      starPath(ctx, 0, -10, 2.6, 1, 5, 0); paint(ctx, '#fb923c', 0.7);
      circlePath(ctx, -2.2, -2.2, 1.6); ctx.fillStyle = '#fff'; ctx.fill();
    },
  });
  // otáčky za sekundu u točících se střel
  TDS.projectileSpin = Object.assign(TDS.projectileSpin || {}, { blade: 18, shuriken: 20, barrel: 6, flask: 8, scroll: 7 });
  void P;
})();

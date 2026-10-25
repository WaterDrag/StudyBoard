/* zombie-tex-2.js — dokončení .io stylu (zombie-tex.js): původní zombie, postavy podle kitů, zbraně s animací,
 * střely, švihy, efekty, věž, základna, infrastruktura (voda, proud, farma), úroda a pomocníci.
 * Stejný rukopis: ploché barvy se stínem po stupních (světlo zleva shora), tlustý tmavý obrys, nic realistického.
 * Všechno se peče jednou do offscreen plátna (klíč = druh + velikost + barva) a pak se jen kopíruje — kvůli
 * slabším Android telefonům. Kresleno čelem doprava (+x). Když je zapnutá grafika od Gemini (zs_tex = '0'),
 * volá se původní kresba. */
(function () {
  'use strict';
  const ZS = window.ZS;
  if (!ZS || !ZS.texOn) return;
  const on = ZS.texOn;
  const TAU = Math.PI * 2, OUT = '#141814', SKIN = '#f0c08a';

  // ── pomůcky ────────────────────────────────────────────────────────────
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const cache = new Map();
  function baked(key, w, h, fn) {   // střed plátna = 0,0
    let c = cache.get(key);
    if (!c) { c = cnv(w, h); const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.lineJoin = 'round'; x.lineCap = 'round'; fn(x, w, h); cache.set(key, c); }
    return c;
  }
  const put = (ctx, c) => ctx.drawImage(c, -c.width / 2, -c.height / 2);
  function rgb(col) {
    if (typeof col !== 'string') return [128, 128, 128];
    if (col[0] === '#') { let h = col.slice(1); if (h.length === 3) h = h.split('').map(ch => ch + ch).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    const m = col.match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
  }
  function tint(col, k) {   // k < 0 tmavší, k > 0 světlejší
    const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    const [r, g, b] = rgb(col); return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  // koule s posterizovaným stínem: tmavý srpek vpravo dole + světlý odlesk vlevo nahoře
  function orb(c, x, y, r, col, o, hi = true) {
    c.fillStyle = tint(col, -0.3); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.fillStyle = col; c.beginPath(); c.arc(x - r * 0.2, y - r * 0.2, r * 0.92, 0, TAU); c.fill(); c.restore();
    if (hi) { c.fillStyle = tint(col, 0.4); c.beginPath(); c.arc(x - r * 0.42, y - r * 0.42, r * 0.2, 0, TAU); c.fill(); }
    if (o) { c.strokeStyle = OUT; c.lineWidth = o; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  }
  function blob(c, x, y, rx, ry, col, o, rot = 0) {   // elipsa se stejným stínováním
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = tint(col, -0.3); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.clip();
    c.fillStyle = col; c.beginPath(); c.ellipse(-rx * 0.16, -ry * 0.2, rx * 0.92, ry * 0.9, 0, 0, TAU); c.fill(); c.restore();
    if (o) { c.strokeStyle = OUT; c.lineWidth = o; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.stroke(); }
    c.restore();
  }
  function box(c, x, y, w, h, r, col, o, shade = true) {
    c.fillStyle = shade ? tint(col, -0.3) : col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
    if (shade) { c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip(); c.fillStyle = col; c.fillRect(x, y, w * 0.86, h * 0.8); c.restore(); }
    if (o) { c.strokeStyle = OUT; c.lineWidth = o; c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke(); }
  }
  function poly(c, pts, col, o) {
    c.fillStyle = col; c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath(); c.fill();
    if (o) { c.strokeStyle = OUT; c.lineWidth = o; c.stroke(); }
  }
  function line(c, pts, col, w, o) {   // čára s obrysem
    const path = () => { c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); };
    if (o) { c.strokeStyle = OUT; c.lineWidth = w + o * 2; path(); c.stroke(); }
    c.strokeStyle = col; c.lineWidth = w; path(); c.stroke();
  }
  const ow = R => Math.max(1.8, R * 0.13);
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3), easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  function withFlash(body) {   // bílá silueta pro bliknutí po zásahu
    const f = cnv(body.width, body.height), x = f.getContext('2d');
    x.drawImage(body, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, f.width, f.height);
    return f;
  }

  // ═══ ZOMBIE (původní druhy) ═══════════════════════════════════════════
  const arm = (c, R, sy, len, col, o, reach = 0) => {   // natažená ruka dopředu
    box(c, -R * 0.05, sy * (R * 0.58 + reach) - R * 0.15, R * len, R * 0.3, R * 0.14, col, o);
    orb(c, R * (len - 0.02), sy * (R * 0.58 + reach), R * 0.18, tint(col, 0.1), o * 0.8, false);
  };
  const zEyes = (c, R, cx, col = '#ef4444', sz = 0.12, sp = 0.24) => { c.fillStyle = col; for (const sy of [-1, 1]) { c.beginPath(); c.arc(cx, sy * R * sp, R * sz, 0, TAU); c.fill(); } c.fillStyle = 'rgba(255,255,255,.7)'; for (const sy of [-1, 1]) { c.beginPath(); c.arc(cx - R * sz * 0.3, sy * R * sp - R * sz * 0.3, R * sz * 0.35, 0, TAU); c.fill(); } };
  const ZB = {
    normal(c, R, o) {   // klasický zombík: roztrhané tričko, ruce dopředu
      arm(c, R, -1, 0.95, '#5f8f4e', o); arm(c, R, 1, 0.85, '#5f8f4e', o, 0.05);
      blob(c, -R * 0.12, 0, R * 0.62, R * 0.82, '#3f6f7a', o);                      // tričko
      c.fillStyle = '#2b4f58'; poly(c, [[-R * 0.55, -R * 0.3], [-R * 0.3, -R * 0.1], [-R * 0.5, R * 0.1]], '#2b4f58', 0);   // díra
      orb(c, R * 0.22, 0, R * 0.48, '#79a964', o);                                      // hlava
      c.fillStyle = '#4b6e3c'; c.beginPath(); c.arc(R * 0.05, -R * 0.18, R * 0.1, 0, TAU); c.fill();   // jizva
      zEyes(c, R, R * 0.48);
    },
    speeder(c, R, o) {   // běžec: hubený, oranžová mikina, ruce dozadu
      for (const sy of [-1, 1]) { box(c, -R * 0.85, sy * R * 0.5 - R * 0.12, R * 0.75, R * 0.24, R * 0.12, '#7aa35a', o); }
      blob(c, -R * 0.05, 0, R * 0.62, R * 0.62, '#ea7a2b', o);
      c.strokeStyle = '#a24f14'; c.lineWidth = o * 0.8; c.beginPath(); c.moveTo(-R * 0.55, 0); c.lineTo(R * 0.2, 0); c.stroke();   // zip
      orb(c, R * 0.38, 0, R * 0.42, '#8fbe6a', o);
      zEyes(c, R, R * 0.6, '#facc15', 0.1, 0.2);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = R * 0.08;   // čáry rychlosti
      for (const yy of [-0.45, 0, 0.45]) { c.beginPath(); c.moveTo(-R * 1.4, R * yy); c.lineTo(-R * 1.0, R * yy); c.stroke(); }
    },
    tank(c, R, o) {   // obr: široká ramena s plechem, malá hlava
      arm(c, R, -1, 0.9, '#5d7a4f', o, 0.25); arm(c, R, 1, 0.9, '#5d7a4f', o, 0.25);
      blob(c, -R * 0.15, 0, R * 0.72, R * 0.98, '#4b5563', o);
      for (const sy of [-1, 1]) { box(c, -R * 0.55, sy * R * 0.62 - R * 0.28, R * 0.7, R * 0.56, R * 0.12, '#6b7280', o);   // plechy na ramenou
        c.fillStyle = '#374151'; for (const xx of [-0.4, -0.05]) { c.beginPath(); c.arc(R * xx, sy * R * 0.62, R * 0.06, 0, TAU); c.fill(); } }
      orb(c, R * 0.3, 0, R * 0.38, '#6f9a58', o);
      zEyes(c, R, R * 0.5, '#ef4444', 0.09, 0.16);
    },
    dog(c, R, o) {   // pes shora: protáhlé tělo, žebra, čenich, uši, ocas
      line(c, [[-R * 0.9, 0], [-R * 1.35, R * 0.25]], '#6b5a48', R * 0.18, o * 0.6);                       // ocas
      for (const [xx, sy] of [[0.45, -1], [0.45, 1], [-0.55, -1], [-0.55, 1]]) orb(c, R * xx, sy * R * 0.45, R * 0.16, '#5b4a3a', o * 0.8, false);   // tlapy
      blob(c, -R * 0.15, 0, R * 0.85, R * 0.42, '#7d6a55', o);
      c.strokeStyle = '#4a3b2c'; c.lineWidth = o * 0.7; for (let i = 0; i < 4; i++) { const xx = -R * 0.55 + i * R * 0.2; c.beginPath(); c.moveTo(xx, -R * 0.28); c.lineTo(xx + R * 0.05, R * 0.28); c.stroke(); }   // žebra
      blob(c, R * 0.72, 0, R * 0.38, R * 0.3, '#8a7660', o);                                                      // hlava
      poly(c, [[R * 0.55, -R * 0.25], [R * 0.4, -R * 0.52], [R * 0.72, -R * 0.3]], '#5b4a3a', o * 0.7);       // uši
      poly(c, [[R * 0.55, R * 0.25], [R * 0.4, R * 0.52], [R * 0.72, R * 0.3]], '#5b4a3a', o * 0.7);
      orb(c, R * 1.08, 0, R * 0.12, '#1f1a17', 0, false);                                                     // čenich
      zEyes(c, R, R * 0.86, '#ef4444', 0.07, 0.14);
    },
    brute(c, R, o) {   // gorila: obří pěsti vpředu, shrbený
      for (const sy of [-1, 1]) { box(c, R * 0.05, sy * R * 0.6 - R * 0.2, R * 0.65, R * 0.4, R * 0.18, '#6d5f86', o); orb(c, R * 0.85, sy * R * 0.6, R * 0.34, '#857aa0', o); }   // pěsti
      blob(c, -R * 0.2, 0, R * 0.78, R * 0.92, '#5b4f73', o);
      c.fillStyle = '#4a405e'; c.beginPath(); c.ellipse(-R * 0.35, 0, R * 0.35, R * 0.5, 0, 0, TAU); c.fill();      // hřbet
      orb(c, R * 0.25, 0, R * 0.36, '#9c8fb5', o);
      c.fillStyle = '#3b3350'; c.fillRect(R * 0.25, -R * 0.26, R * 0.12, R * 0.52);                                   // nadočnicový val
      zEyes(c, R, R * 0.42, '#fb923c', 0.08, 0.15);
    },
    exploder(c, R, o) {   // nafouklý, žhnoucí vředy (pulz se kreslí zvlášť)
      for (const sy of [-1, 1]) box(c, R * 0.1, sy * R * 0.62 - R * 0.12, R * 0.55, R * 0.24, R * 0.12, '#8a6b3a', o);
      orb(c, -R * 0.08, 0, R * 0.86, '#b7662f', o);
      for (const [xx, yy, rr] of [[-0.45, -0.35, 0.2], [-0.5, 0.35, 0.17], [-0.05, 0.5, 0.15], [0.05, -0.55, 0.13]]) { orb(c, R * xx, R * yy, R * rr, '#fbbf24', o * 0.7, false); c.fillStyle = '#fff7c2'; c.beginPath(); c.arc(R * xx - R * rr * 0.3, R * yy - R * rr * 0.3, R * rr * 0.35, 0, TAU); c.fill(); }
      orb(c, R * 0.5, 0, R * 0.32, '#c98a4a', o);
      zEyes(c, R, R * 0.66, '#7f1d1d', 0.08, 0.14);
    },
    boss(c, R, o) {   // démon: rohy, hroty na ramenou, žhnoucí oči, tmavá zbroj
      for (const sy of [-1, 1]) { box(c, R * 0.0, sy * R * 0.62 - R * 0.17, R * 0.85, R * 0.34, R * 0.15, '#7f1d1d', o); poly(c, [[R * 0.8, sy * R * 0.48], [R * 1.12, sy * R * 0.62], [R * 0.8, sy * R * 0.76]], '#e5e7eb', o * 0.7); }   // ruce s drápy
      blob(c, -R * 0.15, 0, R * 0.72, R * 0.9, '#3f1515', o);
      for (const sy of [-1, 1]) for (const xx of [-0.55, -0.15]) poly(c, [[R * (xx - 0.12), sy * R * 0.62], [R * xx, sy * R * 1.0], [R * (xx + 0.12), sy * R * 0.62]], '#9ca3af', o * 0.7);   // hroty
      orb(c, R * 0.28, 0, R * 0.42, '#b91c1c', o);
      for (const sy of [-1, 1]) poly(c, [[R * 0.2, sy * R * 0.22], [R * -0.15, sy * R * 0.62], [R * 0.36, sy * R * 0.34]], '#f5f0e1', o * 0.7);   // rohy
      zEyes(c, R, R * 0.5, '#fde047', 0.1, 0.18);
    },
  };
  const zSpr = new Map();
  const prevZombie = ZS.zombie;
  ZS.zombie = function (ctx, type, x, y, r, angle, ts, hitFlash) {
    if (!on() || !ZB[type]) return prevZombie.call(this, ctx, type, x, y, r, angle, ts, hitFlash);
    const R = Math.max(8, Math.round(r)), key = type + R;
    let s = zSpr.get(key);
    if (!s) { const body = baked('z_' + key, R * 3.2, R * 3.2, (c) => ZB[type](c, R, ow(R))); s = { body, flash: withFlash(body) }; zSpr.set(key, s); }
    const t = ts || 0, ph = (x + y) * 0.05 + t * (type === 'speeder' || type === 'dog' ? 0.018 : 0.008);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(2, 4, R * 0.95, R * 0.8, 0, 0, TAU); ctx.fill();
    if (type === 'boss') { ctx.fillStyle = `rgba(239,68,68,${0.16 + Math.sin(t * 0.005) * 0.06})`; ctx.beginPath(); ctx.arc(0, 0, R * 1.35, 0, TAU); ctx.fill(); }
    ctx.rotate(angle + Math.sin(ph) * 0.08);
    put(ctx, s.body);
    if (type === 'exploder') {   // žhnoucí pulz — čím rychlejší, tím blíž výbuchu (jen vzhled)
      const a = 0.25 + (Math.sin(t * 0.012 + x) * 0.5 + 0.5) * 0.35;
      ctx.fillStyle = `rgba(251,191,36,${a})`; ctx.beginPath(); ctx.arc(-R * 0.08, 0, R * 0.55, 0, TAU); ctx.fill();
    }
    if (hitFlash > 0.01) { ctx.globalAlpha = Math.min(1, hitFlash); put(ctx, s.flash); }
    ctx.restore();
  };

  // ═══ POSTAVY HRÁČŮ (podle kitu, barva kitu = oblečení) ═════════════════
  const KITB = {
    warrior(c, R, col, o) {   // přilba s chocholem, ramenní pláty
      for (const sy of [-1, 1]) blob(c, -R * 0.05, sy * R * 0.55, R * 0.36, R * 0.28, '#9ca3af', o);
      blob(c, -R * 0.1, 0, R * 0.55, R * 0.8, col, o);
      orb(c, R * 0.12, 0, R * 0.46, '#c7ccd4', o);
      line(c, [[-R * 0.38, 0], [R * 0.45, 0]], tint(col, -0.1), R * 0.18, o * 0.6);   // chochol
      c.fillStyle = OUT; c.fillRect(R * 0.38, -R * 0.2, R * 0.08, R * 0.4);           // průzor
    },
    archer(c, R, col, o) {   // kápě, toulec se šípy na zádech
      box(c, -R * 0.95, -R * 0.42, R * 0.5, R * 0.3, R * 0.1, '#7c4a1e', o);
      for (const yy of [-0.36, -0.26, -0.16]) line(c, [[-R * 0.95, R * yy], [-R * 1.25, R * yy - R * 0.05]], '#e5e7eb', R * 0.05, 0);
      blob(c, -R * 0.1, 0, R * 0.55, R * 0.8, col, o);
      orb(c, R * 0.12, 0, R * 0.46, tint(col, -0.25), o);
      c.fillStyle = SKIN; c.beginPath(); c.ellipse(R * 0.36, 0, R * 0.16, R * 0.24, 0, 0, TAU); c.fill();   // obličej v kápi
    },
    mage(c, R, col, o) {   // široký klobouk s hvězdou, plášť
      blob(c, -R * 0.15, 0, R * 0.6, R * 0.82, col, o);
      orb(c, R * 0.08, 0, R * 0.62, tint(col, -0.2), o);                                // krempa
      orb(c, R * 0.08, 0, R * 0.34, col, o * 0.8);                                     // špička
      c.fillStyle = '#fde047'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? R * 0.07 : R * 0.16; c.lineTo(R * 0.08 + Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
    },
    militant(c, R, col, o) {   // maskáčová přilba, batoh
      box(c, -R * 0.95, -R * 0.38, R * 0.42, R * 0.76, R * 0.12, '#4d5b33', o);
      blob(c, -R * 0.1, 0, R * 0.56, R * 0.8, '#5f6f3c', o);
      c.fillStyle = col; c.beginPath(); c.ellipse(-R * 0.15, R * 0.3, R * 0.2, R * 0.12, 0, 0, TAU); c.fill();   // vesta s barvou kitu
      orb(c, R * 0.12, 0, R * 0.46, '#6b7a44', o);
      c.fillStyle = '#4d5b33'; for (const [xx, yy] of [[-0.05, -0.2], [0.25, 0.15], [0.05, 0.25]]) { c.beginPath(); c.arc(R * xx, R * yy, R * 0.1, 0, TAU); c.fill(); }
    },
    tank(c, R, col, o) {   // těžká zbroj, velké pláty, hledí
      for (const sy of [-1, 1]) box(c, -R * 0.5, sy * R * 0.58 - R * 0.26, R * 0.75, R * 0.52, R * 0.14, '#6b7280', o);
      blob(c, -R * 0.1, 0, R * 0.62, R * 0.86, col, o);
      orb(c, R * 0.12, 0, R * 0.48, '#4b5563', o);
      box(c, R * 0.32, -R * 0.26, R * 0.16, R * 0.52, R * 0.06, '#93c5fd', o * 0.6, false);   // hledí
    },
    rogue(c, R, col, o) {   // tmavá kápě a šála
      blob(c, -R * 0.1, 0, R * 0.52, R * 0.76, '#2e2a3a', o);
      line(c, [[R * 0.0, -R * 0.4], [-R * 0.7, -R * 0.55]], col, R * 0.16, o * 0.6);   // šála vlaje dozadu
      orb(c, R * 0.12, 0, R * 0.46, tint(col, -0.35), o);
      c.fillStyle = '#111'; c.beginPath(); c.ellipse(R * 0.36, 0, R * 0.16, R * 0.24, 0, 0, TAU); c.fill();
      c.fillStyle = '#e9d5ff'; for (const sy of [-1, 1]) { c.beginPath(); c.arc(R * 0.42, sy * R * 0.09, R * 0.05, 0, TAU); c.fill(); }
    },
    engineer(c, R, col, o) {   // žlutá helma s lampou, brýle, batoh s nářadím
      box(c, -R * 0.95, -R * 0.4, R * 0.45, R * 0.8, R * 0.12, col, o);
      line(c, [[-R * 0.75, -R * 0.42], [-R * 1.05, -R * 0.7]], '#9ca3af', R * 0.08, o * 0.5);   // anténa
      blob(c, -R * 0.1, 0, R * 0.55, R * 0.8, tint(col, -0.15), o);
      orb(c, R * 0.12, 0, R * 0.46, '#facc15', o);
      orb(c, R * 0.5, 0, R * 0.12, '#fef9c3', o * 0.6, false);                            // lampa
      line(c, [[R * 0.0, -R * 0.42], [R * 0.0, R * 0.42]], '#a16207', R * 0.08, 0);          // hrana helmy
    },
    priest(c, R, col, o) {   // kápě se zlatým křížem na zádech
      blob(c, -R * 0.12, 0, R * 0.58, R * 0.8, '#f8fafc', o);
      c.fillStyle = col; c.fillRect(-R * 0.62, -R * 0.08, R * 0.5, R * 0.16); c.fillRect(-R * 0.45, -R * 0.3, R * 0.16, R * 0.6);   // kříž
      orb(c, R * 0.12, 0, R * 0.44, '#e2e8f0', o);
      c.fillStyle = SKIN; c.beginPath(); c.ellipse(R * 0.36, 0, R * 0.15, R * 0.22, 0, 0, TAU); c.fill();
      c.strokeStyle = '#fde047'; c.lineWidth = R * 0.07; c.beginPath(); c.arc(R * 0.12, 0, R * 0.56, -1.2, 1.2); c.stroke();   // svatozář
    },
  };
  const prevBody = ZS.playerBody;
  ZS.playerBody = function (ctx, kit, x, y, r, angle, ts, color, isLocal) {
    if (!on() || !prevBody) return prevBody && prevBody.call(this, ctx, kit, x, y, r, angle, ts, color, isLocal);
    const R = Math.max(10, Math.round(r || 16)), k = KITB[kit] ? kit : 'warrior', col = color || '#ef4444';
    const spr = baked(`pb_${k}_${R}_${col}`, R * 3, R * 3, c => KITB[k](c, R, col, ow(R)));
    ctx.save(); ctx.translate(x, y);
    if (isLocal) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 1.25, 0, TAU); ctx.stroke(); }
    else ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(2, 4, R * 0.95, R * 0.8, 0, 0, TAU); ctx.fill();
    const br = Math.sin((ts || 0) * 0.008 + x * 0.1) * 0.035;
    ctx.rotate(angle || 0); ctx.scale(1 + br, 1 - br);
    put(ctx, spr);
    ctx.restore();
  };

  // ═══ ZBRANĚ (v ruce, s animací) ═════════════════════════════════════════
  // sprite zbraně: rukojeť v 0,0, míří doprava
  const WPN = {
    pistol(c, col, o) { box(c, -2, -3.5, 18, 7, 2, '#30333a', o); box(c, 2, -2.4, 11, 4.8, 1.5, col, o * 0.6, false); box(c, -1, 1, 5, 7, 1.5, '#30333a', o); },
    shotgun(c, col, o) { box(c, -12, -3.5, 14, 7, 2.5, '#8a4b1c', o); box(c, 0, -4, 16, 8, 2, '#3f434b', o); box(c, 14, -3.2, 18, 6.4, 1.5, '#5a606b', o); box(c, 17, -4.6, 9, 9.2, 2, col, o * 0.8, false); },
    rifle(c, col, o) { box(c, -14, -3, 14, 6, 2, '#2a3342', o); box(c, 0, -3.6, 20, 7.2, 1.5, '#3f4a5c', o); box(c, 20, -1.6, 16, 3.2, 1, '#5a6578', o); box(c, 4, -7, 11, 3.6, 1.5, col, o * 0.7, false); box(c, 6, 3, 5, 7, 1.5, '#2a3342', o); },
    sword(c, col, o) { poly(c, [[4, -2.6], [36, -2.2], [42, 0], [36, 2.2], [4, 2.6]], '#dfe3ea', o); line(c, [[6, 0], [34, 0]], '#aab1bd', 1, 0); box(c, 0, -7, 4, 14, 1.5, col, o); box(c, -9, -2, 9, 4, 1.5, '#5b3a1e', o); orb(c, -10, 0, 2.6, col, o * 0.6, false); },
    dagger(c, col, o) { poly(c, [[3, -2.4], [20, -1.6], [25, 0], [20, 1.6], [3, 2.4]], '#e5e7eb', o); box(c, 0, -5, 3, 10, 1, col, o); box(c, -7, -1.8, 7, 3.6, 1.5, '#3b2a1a', o); },
    hammer(c, col, o) { box(c, -8, -2.2, 34, 4.4, 1.5, '#7c4a1e', o); box(c, 22, -10, 13, 20, 2.5, '#6b7280', o); box(c, 24, -10, 3, 20, 1, col, 0, false); },
    staff(c, col, o) { box(c, -10, -2, 40, 4, 2, '#6b4423', o); orb(c, 33, 0, 6, col, o); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(31, -2, 1.8, 0, TAU); c.fill(); },
    wrench(c, col, o) { box(c, -6, -2.4, 26, 4.8, 2, '#9ca3af', o); c.fillStyle = '#9ca3af'; c.strokeStyle = OUT; c.lineWidth = o; c.beginPath(); c.arc(24, 0, 6.5, 0.7, TAU - 0.7); c.lineTo(24, 0); c.closePath(); c.fill(); c.stroke(); box(c, -6, -2.6, 9, 5.2, 2, col, o * 0.7, false); },
    mace(c, col, o) { box(c, -8, -2, 28, 4, 1.5, '#7c4a1e', o); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; poly(c, [[24 + Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6], [24 + Math.cos(a) * 10, Math.sin(a) * 10], [24 + Math.cos(a + 0.3) * 6, Math.sin(a + 0.3) * 6]], '#9ca3af', o * 0.6); } orb(c, 24, 0, 6.5, col, o); },
  };
  const wSpr = (wid, col) => baked(`w_${wid}_${col}`, 100, 40, c => (WPN[wid] || WPN.sword)(c, col || '#fbbf24', 1.8));
  const hand = (c, x, y, R) => orb(c, x, y, R * 0.2, SKIN, Math.max(1.4, R * 0.1), false);
  // stejná kinematika švihu jako v původní grafice (sedí na herní časování útoku)
  function swing(wid, p, arc) {
    const A = arc || 1.15;
    if (wid === 'dagger') { const first = p < 0.48, u = clamp(first ? p / 0.42 : (p - 0.48) / 0.42, 0, 1), e = easeOut(u); const s = first ? -A * 0.55 : A * 0.55;
      return { start: s, cur: lerp(s, -s, e), prog: u, lunge: Math.sin(u * Math.PI) * 5 }; }
    const wEnd = wid === 'hammer' ? 0.24 : 0.15, sEnd = wid === 'hammer' ? 0.74 : 0.68, sA = -A * 0.5 - 0.22, eA = A * 0.5 + 0.15;
    if (p < wEnd) { const u = p / wEnd; return { start: sA, cur: lerp(-A * 0.2, sA, easeOut(u)), prog: 0, lunge: -u * 3 }; }
    if (p < sEnd) { const u = (p - wEnd) / (sEnd - wEnd), e = wid === 'hammer' ? u * u * (3 - 2 * u) : easeOut(u); return { start: sA, cur: lerp(sA, eA, e), prog: u, lunge: Math.sin(u * Math.PI) * (wid === 'hammer' ? 8 : 5) }; }
    const u = (p - sEnd) / (1 - sEnd); return { start: sA, cur: lerp(eA, A * 0.25, easeIO(u)), prog: 1, lunge: (1 - u) * 3 };
  }
  const RANGED = new Set(['pistol', 'shotgun', 'rifle', 'bow']);
  const prevWeapon = ZS.weapon;
  ZS.weapon = function (ctx, wid, x, y, r, angle, ts, atk, color) {
    if (!on() || !prevWeapon) return prevWeapon && prevWeapon.call(this, ctx, wid, x, y, r, angle, ts, atk, color);
    const R = Math.max(10, Math.round(r || 16)), p = atk && typeof atk.p === 'number' ? clamp(atk.p, 0, 1) : null;
    ctx.save(); ctx.translate(x, y); ctx.rotate((angle || 0) + Math.sin((ts || 0) * 0.006 + x * 0.05) * 0.03);
    if (wid === 'bow') {   // luk: natahování tětivy, šíp zmizí po výstřelu
      let pull = 4, arrow = true;
      if (p !== null) { if (p < 0.35) pull = lerp(4, 13, p / 0.35); else if (p < 0.72) { pull = 2; arrow = false; } else pull = lerp(2, 4, (p - 0.72) / 0.28); }
      const bx = R * 0.8;
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - 3, -R * 0.85); ctx.lineTo(bx - pull, 0); ctx.lineTo(bx - 3, R * 0.85); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.arc(bx - 10, 0, R * 0.9, -1.45, 1.45); ctx.stroke();
      ctx.strokeStyle = '#8a5524'; ctx.lineWidth = 3.6; ctx.stroke();
      ctx.strokeStyle = color || '#84cc16'; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.arc(bx - 10, 0, R * 0.9, -0.2, 0.2); ctx.stroke();
      if (arrow) { line(ctx, [[bx - pull, 0], [bx + 16, 0]], '#d6b38a', 2, 1); poly(ctx, [[bx + 14, -3], [bx + 21, 0], [bx + 14, 3]], '#cbd5e1', 1.2); }
      hand(ctx, bx - 4, 0, R); hand(ctx, bx - pull - 1, 0, R);
    } else if (RANGED.has(wid)) {   // pistole / brokovnice / puška: zpětný ráz
      let rec = 0; if (p !== null) { rec = p < 0.15 ? p / 0.15 * 7 : Math.max(0, (1 - (p - 0.15) / 0.55) * 7); if (wid === 'shotgun') rec *= 1.35; }
      const gx = R * 0.45 - rec, spr = wSpr(wid, color);
      ctx.drawImage(spr, gx - 50, -20);
      hand(ctx, gx + 1, R * 0.12, R); hand(ctx, gx + (wid === 'pistol' ? 7 : 16), wid === 'pistol' ? -R * 0.05 : R * 0.02, R);
      if (p !== null && p < 0.12) {   // záblesk z hlavně
        const mx = gx + (wid === 'rifle' ? 36 : wid === 'shotgun' ? 32 : 20);
        poly(ctx, [[mx, -5], [mx + 12, 0], [mx, 5], [mx + 4, 0]], '#fde047', 1.2);
      }
    } else {   // na blízko: zbraň trčí z ruky ven a mávne obloukem
      const s = p !== null ? swing(wid, p, atk.arc) : { cur: 0.7, lunge: 0 };
      const hr = R * 0.82 + (s.lunge || 0), hx = Math.cos(s.cur) * hr, hy = Math.sin(s.cur) * hr;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(s.cur); ctx.scale(0.74, 0.74); ctx.drawImage(wSpr(wid, color), -50, -20); ctx.restore();   // na blízko o čtvrtinu menší, ať nepřerůstá postavu
      hand(ctx, hx, hy, R);
      hand(ctx, Math.cos(-0.85) * R * 0.78, Math.sin(-0.85) * R * 0.78, R);
    }
    ctx.restore();
  };
  // stopa švihu: plochý srpek barvy zbraně s bílou hranou
  const prevSwing = ZS.swingFx;
  ZS.swingFx = function (ctx, wid, x, y, ang, range, arc, p, col, seed) {
    if (!on() || !prevSwing) return prevSwing && prevSwing.call(this, ctx, wid, x, y, ang, range, arc, p, col, seed);
    const s = swing(wid, p, arc); if (!s.prog) return;
    const a0 = Math.min(s.start, s.cur), a1 = Math.max(s.start, s.cur), Rr = (range || 90) * 0.82, th = Math.max(8, Rr * 0.22);
    const alpha = p > 0.75 ? (1 - p) / 0.25 : 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.globalAlpha = 0.75 * alpha; ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = th + 4; ctx.beginPath(); ctx.arc(0, 0, Rr, a0, a1); ctx.stroke();
    ctx.strokeStyle = col || '#e5e7eb'; ctx.lineWidth = th; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, th * 0.25); ctx.beginPath(); ctx.arc(0, 0, Rr + th * 0.3, a0, a1); ctx.stroke();
    ctx.restore();
  };

  // ═══ STŘELY ════════════════════════════════════════════════════════════
  const prevProj = ZS.projectile;
  ZS.projectile = function (ctx, kind, x, y, ang, ts, col, prog, seed) {
    if (!on() || !prevProj) return prevProj && prevProj.call(this, ctx, kind, x, y, ang, ts, col, prog, seed);
    const t = ts || 0, c = col || '#fbbf24';
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    switch (kind) {
      case 'arrow':
        line(ctx, [[-16, 0], [6, 0]], '#d6b38a', 2.2, 1.1); poly(ctx, [[4, -3.5], [11, 0], [4, 3.5]], '#cbd5e1', 1.1);
        poly(ctx, [[-16, 0], [-20, -4], [-12, 0], [-20, 4]], c, 1); break;
      case 'fireball': {
        const fl = Math.sin(t * 0.03 + (seed || 0)) * 2;
        poly(ctx, [[-22 - fl, 0], [-6, -7], [0, 0], [-6, 7]], '#f97316', 1.4); poly(ctx, [[-14 - fl, 0], [-4, -4], [0, 0], [-4, 4]], '#fde047', 0);
        orb(ctx, 0, 0, 7, '#fb923c', 1.6); break;
      }
      case 'rocket':
        poly(ctx, [[-16, 0], [-22 - Math.sin(t * 0.05) * 3, -3], [-22 - Math.sin(t * 0.05 + 1) * 3, 3]], '#fde047', 1);
        box(ctx, -14, -3.5, 22, 7, 3, '#9ca3af', 1.5); poly(ctx, [[8, -3.5], [14, 0], [8, 3.5]], '#ef4444', 1.2);
        poly(ctx, [[-14, -3.5], [-18, -7], [-9, -3.5]], '#4b5563', 1); poly(ctx, [[-14, 3.5], [-18, 7], [-9, 3.5]], '#4b5563', 1); break;
      case 'grenade':
        ctx.rotate(t * 0.012 + (seed || 0)); orb(ctx, 0, 0, 5.5, '#4d5b33', 1.5); box(ctx, -1.5, -8, 3, 3.5, 1, '#9ca3af', 1, false); break;
      case 'magic':
        ctx.globalAlpha = 0.45; orb(ctx, 0, 0, 10, c, 0, false); ctx.globalAlpha = 1; orb(ctx, 0, 0, 5.5, c, 1.5); break;
      case 'rifle':
        line(ctx, [[-22, 0], [4, 0]], c, 2.4, 1); line(ctx, [[-8, 0], [4, 0]], '#ffffff', 1.4, 0); break;
      case 'pellet':
        orb(ctx, 0, 0, 2.6, c, 1.1, false); break;
      default:   // bullet
        line(ctx, [[-10, 0], [3, 0]], c, 3.4, 1.1); orb(ctx, 3, 0, 1.9, '#fff7c2', 0, false);
    }
    ctx.restore();
  };

  // ═══ EFEKTY (výbuchy, léčení, proud, voda, …) ══════════════════════════
  const BK = { explosion: 'boom', hit: 'hit', heal: 'plus', holy: 'plus', bless: 'plus', repair: 'plus', fortify: 'ring', taunt: 'ring', suppress: 'ring',
    nova: 'ring', timestop: 'ring', blink_in: 'ring', blink_out: 'ring', stealth: 'ring', dodge: 'ring', water: 'drops', farm: 'drops',
    shock: 'zap', wire: 'zap', gen: 'zap', poison: 'bubbles', dev: 'ring', s: 'ring', i: 'ring' };
  const prevBurst = ZS.burst;
  ZS.burst = function (ctx, kind, x, y, rEnd, p, ts, col, seed) {
    if (!on() || !prevBurst) return prevBurst && prevBurst.call(this, ctx, kind, x, y, rEnd, p, ts, col, seed);
    const style = BK[kind] || 'ring', R = Math.max(10, rEnd || 40), e = easeOut(clamp(p, 0, 1)), a = 1 - clamp(p, 0, 1), c = col || '#fbbf24';
    const r = rng((seed || 1) * 97 + 13);
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (style === 'boom') {   // plochý výbuch: oranžová koule, žlutý střed, úlomky, obrys
      const rr = R * (0.35 + e * 0.65);
      ctx.globalAlpha = a; orb(ctx, 0, 0, rr, '#f97316', 3, false); orb(ctx, 0, 0, rr * 0.6, '#fde047', 0, false);
      for (let i = 0; i < 8; i++) { const ang = r() * TAU, d = rr * (0.9 + e * 0.6); orb(ctx, Math.cos(ang) * d, Math.sin(ang) * d, 3 + r() * 3, '#57534e', 1.5, false); }
    } else if (style === 'hit') {
      ctx.globalAlpha = a; poly(ctx, Array.from({ length: 8 }, (_, i) => { const ang = i / 8 * TAU, d = (i % 2 ? 0.4 : 1) * R * 0.5 * (0.6 + e * 0.4); return [Math.cos(ang) * d, Math.sin(ang) * d]; }), '#fff7c2', 1.5);
    } else if (style === 'plus') {   // léčení / požehnání: kruh + stoupající křížky
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, R * e, 0, TAU); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = a;
      for (let i = 0; i < 5; i++) { const ang = r() * TAU, d = R * (0.2 + r() * 0.6), px = Math.cos(ang) * d, py = Math.sin(ang) * d - e * 18, s = 4 + r() * 3;
        box(ctx, px - s, py - s * 0.35, s * 2, s * 0.7, 1, c, 1.2, false); box(ctx, px - s * 0.35, py - s, s * 0.7, s * 2, 1, c, 1.2, false); }
    } else if (style === 'drops') {
      ctx.globalAlpha = a;
      for (let i = 0; i < 7; i++) { const ang = r() * TAU, d = R * e * (0.5 + r() * 0.5), px = Math.cos(ang) * d, py = Math.sin(ang) * d;
        poly(ctx, [[px, py - 6], [px + 3.5, py + 1], [px, py + 4], [px - 3.5, py + 1]], '#38bdf8', 1.2); }
    } else if (style === 'zap') {
      ctx.globalAlpha = a; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      for (let i = 0; i < 5; i++) { const ang = r() * TAU; let px = 0, py = 0; const pts = [[0, 0]]; for (let k = 1; k <= 4; k++) { const d = R * e * k / 4; px = Math.cos(ang + (r() - 0.5) * 0.6) * d; py = Math.sin(ang + (r() - 0.5) * 0.6) * d; pts.push([px, py]); }
        line(ctx, pts, '#fde047', 2.4, 1.3); }
    } else if (style === 'bubbles') {
      ctx.globalAlpha = a;
      for (let i = 0; i < 8; i++) { const ang = r() * TAU, d = R * (0.2 + r() * 0.7) * e; orb(ctx, Math.cos(ang) * d, Math.sin(ang) * d - e * 10, 3 + r() * 4, '#84cc16', 1.3, true); }
    } else {   // ring
      ctx.globalAlpha = a; ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R * e, 0, TAU); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
      ctx.globalAlpha = a * 0.18; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, R * e, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  // ═══ VĚŽ (stavba 'turret') ═════════════════════════════════════════════
  const prevStruct = ZS.structure;
  ZS.structure = function (ctx, type, x, y, w, h, hpPct, ts, angle) {
    if (!on() || type !== 'turret') return prevStruct.call(this, ctx, type, x, y, w, h, hpPct, ts, angle);
    const W = Math.round(w), H = Math.round(h), hp = hpPct === undefined ? 1 : hpPct, dmg = hp > 0.6 ? 0 : hp > 0.3 ? 1 : 2;
    const plate = baked(`tur_${W}_${H}_${dmg}`, W + 6, H + 6, c => {
      box(c, -W / 2, -H / 2, W, H, 6, '#4b5563', 2.2);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) orb(c, sx * (W / 2 - 6), sy * (H / 2 - 6), 2.6, '#9ca3af', 1.2, false);   // šrouby
      if (dmg) { c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-W * 0.3, -H * 0.4); c.lineTo(-W * 0.1, -H * 0.1); c.lineTo(-W * 0.25, H * 0.15); if (dmg > 1) { c.moveTo(W * 0.35, H * 0.4); c.lineTo(W * 0.12, H * 0.12); } c.stroke(); }
    });
    const R = Math.min(W, H) * 0.36;
    const head = baked(`turh_${Math.round(R)}`, R * 4.4, R * 4.4, c => {
      for (const sy of [-1, 1]) box(c, R * 0.3, sy * R * 0.32 - R * 0.16, R * 1.55, R * 0.32, R * 0.1, '#30333a', 1.6);   // dvojitá hlaveň
      orb(c, 0, 0, R, '#6b7280', 2);
      box(c, -R * 0.45, -R * 0.45, R * 0.9, R * 0.9, R * 0.2, '#9ca3af', 1.4);
      orb(c, R * 0.1, 0, R * 0.22, '#ef4444', 1.2, false);   // čidlo
    });
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 3, y + 4, W, H);
    ctx.translate(x + W / 2, y + H / 2); put(ctx, plate);
    ctx.rotate(angle || 0); put(ctx, head);
    ctx.restore();
  };

  // ═══ ZÁKLADNA ══════════════════════════════════════════════════════════
  const prevBase = ZS.base;
  ZS.base = function (ctx, x, y, r, hpPct, ts) {
    if (!on() || !prevBase) return prevBase && prevBase.call(this, ctx, x, y, r, hpPct, ts);
    const R = Math.round(r || 52), hp = hpPct === undefined ? 1 : hpPct, dmg = hp > 0.66 ? 0 : hp > 0.33 ? 1 : 2, t = ts || 0;
    const img = baked(`base_${R}_${dmg}`, R * 2.5, R * 2.5, c => {
      const o = 2.6;
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; blob(c, Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, R * 0.22, R * 0.15, '#b9a074', 1.8, a + Math.PI / 2); }   // pytle s pískem
      poly(c, Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + Math.PI / 8; return [Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82]; }), '#7c838f', o);   // betonový osmiúhelník
      poly(c, Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + Math.PI / 8; return [Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62]; }), '#9aa1ac', o * 0.7);
      orb(c, 0, 0, R * 0.28, '#4b5563', o);   // poklop
      c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(-R * 0.18, 0); c.lineTo(R * 0.18, 0); c.moveTo(0, -R * 0.18); c.lineTo(0, R * 0.18); c.stroke();
      for (const a of [0.4, 2.5, 4.3]) box(c, Math.cos(a) * R * 0.48 - 4, Math.sin(a) * R * 0.48 - 3, 8, 6, 1.5, '#1f2937', 1.2, false);   // střílny
      if (dmg) { c.strokeStyle = OUT; c.lineWidth = 2; const rr = rng(R * 7 + dmg); for (let i = 0; i < dmg * 3; i++) { const a = rr() * TAU, d = R * (0.35 + rr() * 0.35); c.beginPath(); c.moveTo(Math.cos(a) * d, Math.sin(a) * d); c.lineTo(Math.cos(a + 0.2) * (d + R * 0.15), Math.sin(a + 0.2) * (d + R * 0.15)); c.stroke(); } }
    });
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(4, 6, R, 0, TAU); ctx.fill();
    put(ctx, img);
    // stožár s vlajkou (vlaje)
    const fx = R * 0.42, fy = -R * 0.42, wv = Math.sin(t * 0.006) * 3;
    line(ctx, [[fx, fy], [fx, fy - R * 0.55]], '#d1d5db', 2.5, 1.2);
    poly(ctx, [[fx, fy - R * 0.55], [fx + 18, fy - R * 0.5 + wv], [fx + 16, fy - R * 0.36 + wv], [fx, fy - R * 0.38]], hp > 0.33 ? '#22c55e' : '#ef4444', 1.4);
    if (dmg > 1) { ctx.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { const k = ((t * 0.0006 + i / 3) % 1); orb(ctx, -R * 0.2 + i * 6, -R * 0.1 - k * 40, 6 + k * 8, '#6b7280', 0, false); } }   // kouř
    ctx.restore();
  };

  // ═══ INFRASTRUKTURA (voda, proud, farma) ══════════════════════════════
  const DIRS = [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]];
  const linkKey = l => DIRS.map(d => (l && l[d[0]]) ? 1 : 0).join('');
  function plotImg(S, soil) {
    return baked(`plot_${S}_${soil}`, S + 4, S + 4, c => {
      const h = S / 2 - 3, col = soil === 'withered' ? '#7c5a36' : soil === 'empty' ? '#8b5e34' : '#6b4423';
      box(c, -h, -h, h * 2, h * 2, 5, col, 2.2);
      c.strokeStyle = tint(col, -0.35); c.lineWidth = 2.4;
      for (let i = -2; i <= 2; i++) { const yy = i * h * 0.36; c.beginPath(); c.moveTo(-h * 0.8, yy); c.lineTo(h * 0.8, yy); c.stroke(); }   // brázdy
      box(c, -h, -h, h * 2, 4, 2, '#a16207', 0, false);
    });
  }
  const prevInfra = ZS.infra;
  ZS.infra = function (ctx, type, cx, cy, size, state, ts) {
    if (!on() || type === 'fence') return prevInfra.call(this, ctx, type, cx, cy, size, state, ts);   // plot má .io kresbu v zombie-tex.js
    const S = size || 50, h = S / 2, st = state || {}, l = st.links || {}, t = ts || 0;
    ctx.save(); ctx.translate(cx, cy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (type) {
      case 'channel': {   // betonový žlab k sousedům, voda (čerstvá modrá / surová zelená), proud vody
        const fed = !!st.fed, fresh = st.fresh !== false, k = linkKey(l);
        const img = baked(`ch_${S}_${k}_${fed}_${fresh}`, S + 4, S + 4, c => {
          const arms = DIRS.filter(d => l[d[0]]), list = arms.length ? arms : [['e', 1, 0], ['w', -1, 0]];
          for (const [, dx, dy] of list) line(c, [[0, 0], [dx * h, dy * h]], '#9ca3af', S * 0.46, 2);
          orb(c, 0, 0, S * 0.23, '#9ca3af', 2, false);
          const wcol = !fed ? '#5b4a3a' : fresh ? '#38bdf8' : '#65a30d';
          for (const [, dx, dy] of list) line(c, [[0, 0], [dx * h, dy * h]], wcol, S * 0.26, 0);
          orb(c, 0, 0, S * 0.13, wcol, 0, false);
        });
        put(ctx, img);
        if (fed) {   // tekoucí odlesky
          const off = (t * 0.03) % 1; ctx.fillStyle = fresh ? 'rgba(224,242,254,.8)' : 'rgba(217,249,157,.7)';
          for (const [d, dx, dy] of DIRS) if (l[d]) { const q = (off + (dx + dy > 0 ? 0 : 0.5)) % 1; ctx.beginPath(); ctx.arc(dx * h * q, dy * h * q, 2, 0, TAU); ctx.fill(); }
        }
        break;
      }
      case 'wire': {   // kabel ke sousedům, sloupek, svítí když vede proud
        const pw = !!st.powered;
        for (const [d, dx, dy] of DIRS) if (l[d]) line(ctx, [[0, 0], [dx * h, dy * h]], pw ? '#facc15' : '#6b7280', 3, 1.4);
        box(ctx, -5, -5, 10, 10, 2, '#4b5563', 2);
        orb(ctx, 0, 0, 2.6, pw ? '#fde047' : '#1f2937', 1, false);
        if (pw && Math.floor(t / 140) % 3 === 0) { ctx.fillStyle = 'rgba(253,224,71,.35)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); }
        break;
      }
      case 'well': {   // kamenná studna, hladina podle zásoby, zkažená voda je zelená
        const lvl = clamp(st.level ?? 0.5, 0, 1), sp = !!st.spoiled;
        put(ctx, baked(`well_${S}`, S + 6, S + 6, c => {
          for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; blob(c, Math.cos(a) * h * 0.72, Math.sin(a) * h * 0.72, h * 0.25, h * 0.19, '#a8a29e', 1.6, a + Math.PI / 2); }
          orb(c, 0, 0, h * 0.56, '#292524', 2, false);
        }));
        if (lvl > 0.02) { ctx.fillStyle = sp ? '#65a30d' : '#38bdf8'; ctx.beginPath(); ctx.arc(0, 0, h * 0.52 * (0.35 + lvl * 0.65), 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-h * 0.15, -h * 0.15, h * 0.08, 0, TAU); ctx.fill(); }
        line(ctx, [[-h * 0.75, -h * 0.75], [h * 0.75, -h * 0.75]], '#7c4a1e', 3.5, 1.4);   // trám s kladkou
        orb(ctx, 0, -h * 0.75, 4, '#9ca3af', 1.4, false);
        break;
      }
      case 'purifier': {   // čistička: skříň s nádrží, bublinky když teče voda
        put(ctx, baked(`pur_${S}`, S + 4, S + 4, c => {
          box(c, -h * 0.8, -h * 0.8, h * 1.6, h * 1.6, 6, '#e5e7eb', 2.2);
          box(c, -h * 0.5, -h * 0.55, h * 1.0, h * 1.1, 8, '#7dd3fc', 1.8);
          poly(c, [[0, -h * 0.35], [h * 0.2, 0], [0, h * 0.22], [-h * 0.2, 0]], '#0284c7', 1.4);   // kapka
          orb(c, h * 0.62, -h * 0.62, 3, '#22c55e', 1, false);
        }));
        if (st.fed) { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 3; i++) { const q = (t * 0.0012 + i / 3) % 1; ctx.beginPath(); ctx.arc(-h * 0.25 + i * h * 0.25, h * 0.45 - q * h, 2, 0, TAU); ctx.fill(); } }
        break;
      }
      case 'wheel': {   // vodní kolo / generátor: otáčí se, když je aktivní
        box(ctx, -h * 0.85, -h * 0.25, h * 1.7, h * 0.5, 4, '#6b7280', 2);
        ctx.save(); if (st.active) ctx.rotate(t * 0.003);
        put(ctx, baked(`whl_${S}`, S + 4, S + 4, c => {
          orb(c, 0, 0, h * 0.72, '#8a5524', 2.2, false); orb(c, 0, 0, h * 0.5, '#a16207', 1.6, false);
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; line(c, [[Math.cos(a) * h * 0.2, Math.sin(a) * h * 0.2], [Math.cos(a) * h * 0.78, Math.sin(a) * h * 0.78]], '#6b4423', 3.2, 1.2); }
          orb(c, 0, 0, h * 0.18, '#4b5563', 1.6, false);
        }));
        ctx.restore();
        break;
      }
      case 'sprinkler': {   // postřikovač: hlavice, když jde proud, točí se vodní oblouky
        box(ctx, -5, -5, 10, 10, 3, '#4b5563', 1.8);
        orb(ctx, 0, 0, 5, '#9ca3af', 1.6, false);
        if (st.powered) { const a0 = t * 0.004; ctx.strokeStyle = 'rgba(56,189,248,.75)'; ctx.lineWidth = 2.4;
          for (let i = 0; i < 3; i++) { const a = a0 + i * TAU / 3; ctx.beginPath(); ctx.arc(0, 0, h * 0.75, a, a + 0.6); ctx.stroke(); } }
        break;
      }
      case 'plot': put(ctx, plotImg(S, st.soil || 'empty')); break;
      default: ctx.restore(); return prevInfra.call(this, ctx, type, cx, cy, size, state, ts);
    }
    ctx.restore();
  };

  // ═══ ÚRODA NA ZÁHONU ═══════════════════════════════════════════════════
  const CROPC = { carrot: ['#16a34a', '#f97316'], wheat: ['#65a30d', '#facc15'], tomato: ['#15803d', '#ef4444'], pumpkin: ['#15803d', '#f59e0b'], melon: ['#166534', '#84cc16'] };
  const prevCrop = ZS.crop;
  ZS.crop = function (ctx, crop, cx, cy, growth, ts) {
    if (!on() || !prevCrop) return prevCrop && prevCrop.call(this, ctx, crop, cx, cy, growth, ts);
    const g = clamp(growth ?? 1, 0, 1), stage = crop === 'withered' ? 'w' : g >= 0.99 ? 3 : g > 0.55 ? 2 : g > 0.2 ? 1 : 0;
    const [leaf, fruit] = CROPC[crop] || ['#65a30d', '#facc15'];
    const img = baked(`crop_${crop}_${stage}`, 52, 52, c => {
      const spots = [[-12, -10], [10, -11], [-11, 11], [11, 10], [0, 0]];
      for (const [x, y] of spots) {
        if (stage === 'w') { line(c, [[x - 5, y + 3], [x, y - 4], [x + 5, y + 3]], '#a16207', 2.2, 1); continue; }
        if (stage === 0) { line(c, [[x, y + 2], [x, y - 2]], leaf, 2.2, 1); continue; }
        const s = stage === 1 ? 4 : 6;
        blob(c, x - s * 0.6, y, s * 0.7, s * 0.4, leaf, 1.3, -0.6); blob(c, x + s * 0.6, y, s * 0.7, s * 0.4, leaf, 1.3, 0.6);
        if (stage === 3) {
          if (crop === 'wheat') { for (const dx of [-3, 0, 3]) blob(c, x + dx, y - 4, 1.8, 4, fruit, 1, 0); }
          else if (crop === 'carrot') poly(c, [[x - 3, y - 1], [x + 3, y - 1], [x, y + 7]], fruit, 1.2);
          else orb(c, x, y, crop === 'pumpkin' || crop === 'melon' ? 6 : 4, fruit, 1.4);
        }
      }
    });
    ctx.save(); ctx.translate(cx, cy);
    if (stage !== 'w') ctx.rotate(Math.sin((ts || 0) * 0.002 + cx) * 0.03);   // jemně se kývá ve větru
    put(ctx, img); ctx.restore();
  };

  // ═══ POMOCNÍCI A PASTI ═════════════════════════════════════════════════
  const SUM = {
    wolf(c, R, o) { line(c, [[-R * 0.9, 0], [-R * 1.3, R * 0.2]], '#6b7280', R * 0.22, o * 0.6);
      for (const [xx, sy] of [[0.45, -1], [0.45, 1], [-0.5, -1], [-0.5, 1]]) orb(c, R * xx, sy * R * 0.45, R * 0.17, '#4b5563', o * 0.8, false);
      blob(c, -R * 0.1, 0, R * 0.85, R * 0.45, '#9ca3af', o); blob(c, R * 0.72, 0, R * 0.38, R * 0.32, '#cbd5e1', o);
      for (const sy of [-1, 1]) poly(c, [[R * 0.55, sy * R * 0.22], [R * 0.45, sy * R * 0.52], [R * 0.72, sy * R * 0.3]], '#6b7280', o * 0.7);
      orb(c, R * 1.08, 0, R * 0.11, '#111', 0, false); zEyes(c, R, R * 0.85, '#38bdf8', 0.07, 0.13); },
    ghost_boss(c, R, o) {   // vyvolaný kostlivec / přízrak (fialový)
      blob(c, -R * 0.1, 0, R * 0.6, R * 0.8, '#7c3aed', o);
      for (let i = 0; i < 4; i++) line(c, [[-R * 0.45 + i * R * 0.2, -R * 0.5], [-R * 0.45 + i * R * 0.2, R * 0.5]], '#ede9fe', R * 0.08, 0);   // žebra
      for (const sy of [-1, 1]) line(c, [[R * 0.05, sy * R * 0.55], [R * 0.75, sy * R * 0.62]], '#ede9fe', R * 0.12, o * 0.6);
      orb(c, R * 0.25, 0, R * 0.42, '#f5f3ff', o); zEyes(c, R, R * 0.42, '#a855f7', 0.1, 0.18); },
  };
  const prevSummon = ZS.summon;
  ZS.summon = function (ctx, type, x, y, r, angle, ts) {
    if (!on() || !prevSummon) return prevSummon && prevSummon.call(this, ctx, type, x, y, r, angle, ts);
    const t = ts || 0, R = Math.max(8, Math.round(r || 16));
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (SUM[type]) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(2, 4, R * 0.95, R * 0.7, 0, 0, TAU); ctx.fill();
      if (type === 'ghost_boss') ctx.globalAlpha = 0.85 + Math.sin(t * 0.006) * 0.1;
      ctx.rotate(angle || 0); put(ctx, baked(`sum_${type}_${R}`, R * 3, R * 3, c => SUM[type](c, R, ow(R))));
    } else if (type === 'acid_pool' || type === 'toxic_zone') {   // plochá louže s bublinkami
      const col = type === 'acid_pool' ? '#65a30d' : '#16a34a';
      ctx.globalAlpha = 0.55; put(ctx, baked(`pool_${type}_${R}`, R * 2.3, R * 2.3, c => { blob(c, 0, 0, R, R * 0.82, col, 3); blob(c, -R * 0.2, -R * 0.15, R * 0.45, R * 0.3, tint(col, 0.35), 0); }));
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#d9f99d';
      for (let i = 0; i < 4; i++) { const q = (t * 0.001 + i * 0.27) % 1, a = i * 1.9; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.4, 2 + q * 3, 0, TAU); ctx.fill(); }
    } else if (type === 'banner') {   // válečný prapor na tyči
      line(ctx, [[0, 10], [0, -R * 1.6]], '#78350f', 3, 1.4);
      const wv = Math.sin(t * 0.006) * 3;
      poly(ctx, [[0, -R * 1.6], [R * 1.3, -R * 1.45 + wv], [R * 1.15, -R * 0.85 + wv], [0, -R * 0.95]], '#ef4444', 1.6);
      orb(ctx, 0, -R * 1.65, 3, '#fde047', 1.2, false);
    } else if (type === 'lure') {   // návnada: panák s terčem
      put(ctx, baked(`lure_${R}`, R * 3, R * 3, c => { box(c, -R * 0.5, -R * 0.75, R, R * 1.5, R * 0.3, '#d6b38a', 2); orb(c, 0, 0, R * 0.5, '#f8fafc', 1.6, false); orb(c, 0, 0, R * 0.32, '#ef4444', 1.2, false); orb(c, 0, 0, R * 0.13, '#f8fafc', 0, false); }));
    } else if (type === 'trap') {   // past na medvědy
      put(ctx, baked(`trap_${R}`, R * 3, R * 3, c => { orb(c, 0, 0, R * 0.9, '#57534e', 2, false); orb(c, 0, 0, R * 0.55, '#78716c', 1.4, false);
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; poly(c, [[Math.cos(a - 0.15) * R * 0.85, Math.sin(a - 0.15) * R * 0.85], [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55], [Math.cos(a + 0.15) * R * 0.85, Math.sin(a + 0.15) * R * 0.85]], '#d6d3d1', 1); }
        orb(c, 0, 0, R * 0.2, '#a8a29e', 1.2, false); }));
    } else if (type === 'c4') {   // nálož s blikající diodou
      put(ctx, baked(`c4_${R}`, R * 3, R * 3, c => { box(c, -R * 0.75, -R * 0.5, R * 1.5, R, 3, '#a3a375', 2); for (const xx of [-0.4, 0, 0.4]) box(c, R * xx - 2, -R * 0.5, 4, R, 1, '#6b6b48', 0, false); box(c, -R * 0.3, -R * 0.25, R * 0.6, R * 0.5, 2, '#1f2937', 1.2); }));
      if (Math.floor(t / 300) % 2) orb(ctx, R * 0.15, 0, 2.6, '#ef4444', 1, false);
    } else { ctx.restore(); return prevSummon.call(this, ctx, type, x, y, r, angle, ts); }
    ctx.restore();
  };

  // pomůcky pro ikony rozhraní v .io stylu (js/zombie-icons-2.js)
  window.ZSIO = { orb, blob, box, poly, line, tint, OUT, SKIN, TAU, wSpr, on };
})();

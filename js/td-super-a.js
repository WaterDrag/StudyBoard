/* td-super-a.js — Super grafika (td_gfx '2'): Gryfí jezdec, Obléhací moždíř, Trpasličí inženýr
 * (+ gryf, terč, pěna, klec, střílny a střely). Registruje se do window.TDSS (ne TDS), aby se nepletla s Detailní grafikou. */
/* =========================================================================
   OBRANA KRÁLOVSTVÍ – textury nových věží
   Gryfí jezdec · Obléhací moždíř · Trpasličí inženýr
   Vše kreslené kódem (Canvas 2D), pohled shora, světlo shora zleva.
   ========================================================================= */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});   // vlastní registr Super grafiky
  TDS.drawers = TDS.drawers || {};

  /* =====================================================================
     SPOLEČNÉ POMŮCKY (lokální v obalu – nejsou součástí TDS)
     ===================================================================== */

  const OUT = '#111';            // barva obrysů
  const PI = Math.PI;
  const TAU = PI * 2;
  const DASH_TARGET = [7, 5];    // čárkování terče (pole se nevytváří každý snímek)
  const DASH_NONE = [];
  const NO_OPT = {};

  // Seedovaný generátor náhody (mulberry32) – stejný seed = vždy stejný tvar
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

  // Zesvětlení (amt > 0) / ztmavení (amt < 0) barvy #rrggbb – výsledky se pamatují
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

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Úroveň cesty i (0–5), bezpečně i pro chybějící pole
  function lv(up, i) { return up && up[i] ? (up[i] | 0) : 0; }

  // Nejvyšší cesta → { p: index cesty, t: úroveň }; při shodě vyhrává dřívější cesta
  function mainPath(up) {
    let p = 0, t = lv(up, 0);
    for (let i = 1; i < 3; i++) {
      const v = lv(up, i);
      if (v > t) { t = v; p = i; }
    }
    return { p: p, t: t };
  }

  /* ---------- Stavba cest (mění jen aktuální cestu, stav kontextu nemění,
                proto nepotřebují save/restore) ---------- */

  function drawPath(ctx, pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (close !== false) ctx.closePath();
  }

  // Vlastní zaoblený obdélník (ctx.roundRect se nepoužívá kvůli starším Androidům)
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circlePath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function ellipsePath(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }

  // Pravidelný mnohoúhelník
  function polyPath(ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i * TAU) / n;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // Hvězda (záblesky, jiskry)
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * PI) / n;
      const r = i % 2 ? r2 : r1;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // Kapka / plamen: kulatý konec v počátku, špička v (len, 0)
  function teardrop(ctx, len, w) {
    const r = w * 0.55;
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.quadraticCurveTo(len * 0.4, -w, 0, -r);
    ctx.arc(0, 0, r, -PI / 2, PI / 2, true);
    ctx.quadraticCurveTo(len * 0.4, w, len, 0);
    ctx.closePath();
  }

  // Ozubené kolo
  function gearPath(ctx, x, y, r, teeth, depth) {
    ctx.beginPath();
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      ctx.arc(x, y, i % 2 ? r - depth : r, a0, a1);
    }
    ctx.closePath();
  }

  /* ---------- Vyplnění a obrysy aktuální cesty ---------- */

  // Výplň + tmavý obrys
  function paint(ctx, fill, lw) {
    ctx.save();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }

  // Výplň s průhledností
  function fillA(ctx, col, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }

  // Tah s průhledností
  function strokeA(ctx, col, lw, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // Čára s tmavým obrysem (ocas, tyče, lana, ramena)
  function strokeOutlined(ctx, w, col) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }

  /* ---------- Malé kreslicí prvky ---------- */

  // Měkký stín vpravo dole (vrstvené průhledné elipsy, bez shadowBlur)
  function softShadow(ctx, x, y, rx, ry) {
    ctx.save();
    const ga = ctx.globalAlpha;
    ctx.fillStyle = '#000';
    ctx.globalAlpha = ga * 0.09;
    ellipsePath(ctx, x + 4.5, y + 5, rx + 2.5, ry + 2.5); ctx.fill();
    ctx.globalAlpha = ga * 0.12;
    ellipsePath(ctx, x + 3, y + 3.5, rx + 0.5, ry + 0.5); ctx.fill();
    ctx.globalAlpha = ga * 0.1;
    ellipsePath(ctx, x + 2, y + 2, Math.max(1, rx - 1), Math.max(1, ry - 1)); ctx.fill();
    ctx.restore();
  }

  // Odlesk (bílá průhledná elipsa)
  function gloss(ctx, x, y, rx, ry, rot, a) {
    ctx.save();
    ellipsePath(ctx, x, y, rx, ry, rot);
    ctx.globalAlpha *= a;
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  // Záře – soustředné průhledné kruhy (žádný gradient)
  function glow(ctx, x, y, r, col, a) {
    ctx.save();
    ctx.fillStyle = col;
    const ga = ctx.globalAlpha;
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = ga * a * 0.22;
      circlePath(ctx, x, y, r * (1 - i * 0.2));
      ctx.fill();
    }
    ctx.restore();
  }

  // Nýt
  function rivet(ctx, x, y, r, col) {
    ctx.save();
    circlePath(ctx, x, y, r);
    ctx.fillStyle = col || '#8d949c'; ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = OUT; ctx.stroke();
    circlePath(ctx, x - r * 0.35, y - r * 0.35, r * 0.42);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.restore();
  }

  // Broušený drahokam se září
  function gem(ctx, x, y, r, col) {
    ctx.save();
    glow(ctx, x, y, r * 2, col, 0.9);
    drawPath(ctx, [x, y - r, x + r * 0.85, y, x, y + r, x - r * 0.85, y]);
    paint(ctx, col, 1.3);
    drawPath(ctx, [x, y - r, x + r * 0.85, y, x, y]);
    fillA(ctx, '#fff', 0.35);
    drawPath(ctx, [x, y + r, x - r * 0.85, y, x, y]);
    fillA(ctx, '#000', 0.22);
    circlePath(ctx, x - r * 0.3, y - r * 0.35, r * 0.22);
    fillA(ctx, '#fff', 0.95);
    ctx.restore();
  }

  // Zářící runa (tvar daný seedem)
  function rune(ctx, x, y, sz, col, seed) {
    const R = makeRng(seed);
    const h = sz * 0.5, w = sz * 0.34;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -h); ctx.lineTo(0, h);
    const s1 = R() < 0.5 ? -1 : 1;
    const y1 = -h + R() * h * 0.8;
    ctx.moveTo(0, y1); ctx.lineTo(w * s1, y1 - h * 0.45);
    const y2 = R() * h * 0.7;
    ctx.moveTo(0, y2); ctx.lineTo(-w * s1, y2 + (R() < 0.5 ? -1 : 1) * h * 0.45);
    if (R() < 0.6) { ctx.moveTo(-w * 0.8, -h * 0.05); ctx.lineTo(w * 0.8, h * 0.3); }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const ga = ctx.globalAlpha;
    ctx.strokeStyle = col;
    ctx.globalAlpha = ga * 0.35; ctx.lineWidth = sz * 0.42; ctx.stroke();
    ctx.globalAlpha = ga; ctx.lineWidth = sz * 0.15; ctx.strokeStyle = shade(col, 0.6); ctx.stroke();
    ctx.restore();
  }

  // Blesk (klikatá čára se září)
  function lightning(ctx, x0, y0, x1, y1, seed, col, w) {
    const R = makeRng(seed);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const off = (R() - 0.5) * len * 0.35;
      ctx.lineTo(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
    }
    ctx.lineTo(x1, y1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const ga = ctx.globalAlpha;
    ctx.strokeStyle = col;
    ctx.globalAlpha = ga * 0.35; ctx.lineWidth = w * 3.2; ctx.stroke();
    ctx.globalAlpha = ga; ctx.lineWidth = w; ctx.strokeStyle = shade(col, 0.7); ctx.stroke();
    ctx.restore();
  }

  // Trojvrstvý plamen směřující k +x z počátku
  function flame3(ctx, len, w, c1, c2, c3) {
    ctx.save();
    teardrop(ctx, len, w); paint(ctx, c1 || '#e8401c', 1.4);
    teardrop(ctx, len * 0.72, w * 0.68); ctx.fillStyle = c2 || '#ff9a1f'; ctx.fill();
    teardrop(ctx, len * 0.45, w * 0.4); ctx.fillStyle = c3 || '#ffe36a'; ctx.fill();
    ctx.restore();
  }

  // Obláček kouře / páry
  function puff(ctx, x, y, r, a) {
    ctx.save();
    circlePath(ctx, x, y, r); fillA(ctx, '#8d8f96', a);
    circlePath(ctx, x - r * 0.3, y - r * 0.3, r * 0.55); fillA(ctx, '#e1e3e8', a * 0.8);
    ctx.restore();
  }

  // Jiskra (zápalná šňůra)
  function spark(ctx, x, y, r) {
    ctx.save();
    starPath(ctx, x, y, r, r * 0.42, 6, 0); paint(ctx, '#ff9a1f', 1);
    starPath(ctx, x, y, r * 0.6, r * 0.25, 6, 0.5); ctx.fillStyle = '#fff3a0'; ctx.fill();
    ctx.restore();
  }

  // Praporek shora: kolečko tyče a vlající látka ve směru ang
  function pennant(ctx, x, y, ang, len, col, col2, wave) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(len * 0.5, -3 + wave, len, wave * 0.4);
    ctx.quadraticCurveTo(len * 0.5, 3 + wave, 0, 3);
    ctx.closePath();
    paint(ctx, col, 1.5);
    ctx.beginPath();
    ctx.moveTo(0, -0.9);
    ctx.quadraticCurveTo(len * 0.45, -0.9 + wave, len * 0.8, wave * 0.4);
    ctx.quadraticCurveTo(len * 0.45, 0.9 + wave, 0, 0.9);
    ctx.closePath();
    ctx.fillStyle = col2; ctx.fill();
    circlePath(ctx, 0, 0, 2.1); paint(ctx, '#7a4a22', 1.3);
    circlePath(ctx, -0.4, -0.4, 1.0); ctx.fillStyle = '#ffd34a'; ctx.fill();
    ctx.restore();
  }

  // Aura posílení (s.buffed)
  function buffAura(ctx, r) {
    ctx.save();
    circlePath(ctx, 0, 0, r); strokeA(ctx, '#ffd54a', 6, 0.16);
    circlePath(ctx, 0, 0, r); strokeA(ctx, '#fff3a8', 1.6, 0.75);
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      drawPath(ctx, [cx, cy - 3, cx + 2.2, cy, cx, cy + 3, cx - 2.2, cy]);
      paint(ctx, '#ffd54a', 1);
    }
    ctx.restore();
  }

  // Záblesk výstřelu (f = 0–1)
  function muzzleBlast(ctx, x, y, r, f) {
    ctx.save();
    if (f > 0) {
      const ga = ctx.globalAlpha;
      ctx.fillStyle = '#9a9ca3';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.4;
        const d = r * (1.1 + (1 - f) * 0.8);
        circlePath(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + (1 - f) * 0.3));
        ctx.globalAlpha = ga * 0.45 * f;
        ctx.fill();
      }
      ctx.globalAlpha = ga * f;
      starPath(ctx, x, y, r * (1.1 + f * 0.5), r * 0.55, 8, f * 2);
      ctx.fillStyle = '#ff8a1f'; ctx.fill();
      circlePath(ctx, x, y, r * (0.55 + f * 0.25)); ctx.fillStyle = '#ffd84a'; ctx.fill();
      circlePath(ctx, x, y, r * 0.3); ctx.fillStyle = '#fffbe0'; ctx.fill();
    }
    ctx.restore();
  }

  // Dřevěný obdélník s prkny
  function woodRect(ctx, x, y, w, h, r, col, n, vertical) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); paint(ctx, col, 1.7);
    if (n > 1) {
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        if (vertical) { const xx = x + (w * i) / n; ctx.moveTo(xx, y + 1); ctx.lineTo(xx, y + h - 1); }
        else { const yy = y + (h * i) / n; ctx.moveTo(x + 1, yy); ctx.lineTo(x + w - 1, yy); }
      }
      ctx.strokeStyle = shade(col, -0.38); ctx.lineWidth = 1; ctx.stroke();
    }
    roundRect(ctx, x + 1.4, y + 1.1, w - 2.8, Math.min(2.2, h * 0.3), 1);
    fillA(ctx, '#fff', 0.25);
    ctx.restore();
  }

  // Kamenný prstenec z bloků (kruhový)
  function stoneRing(ctx, r1, r2, n, col, seed) {
    const R = makeRng(seed);
    ctx.save();
    circlePath(ctx, 0, 0, r2); paint(ctx, shade(col, -0.35), 2.2);
    const gap = 0.045;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + gap, a1 = ((i + 1) / n) * TAU - gap;
      ctx.beginPath();
      ctx.arc(0, 0, r2 - 1.2, a0, a1);
      ctx.arc(0, 0, r1 + 0.8, a1, a0, true);
      ctx.closePath();
      paint(ctx, shade(col, Math.round((R() - 0.5) * 22) / 100), 1.1);
      const mid = (a0 + a1) / 2;
      const lit = Math.max(0, -(Math.cos(mid) + Math.sin(mid)) * 0.7071);
      ctx.beginPath(); ctx.arc(0, 0, r2 - 2.6, a0 + 0.07, a1 - 0.07);
      strokeA(ctx, '#ffffff', 1.2, 0.1 + lit * 0.45);
    }
    ctx.restore();
  }

  // Osmiúhelníková kamenná plošina (moždíř)
  function octaPlatform(ctx, rOut, rIn, col, seed) {
    const R = makeRng(seed);
    ctx.save();
    polyPath(ctx, 0, 0, rOut, 8, PI / 8); paint(ctx, shade(col, -0.35), 2.2);
    for (let i = 0; i < 8; i++) {
      const a0 = PI / 8 + i * TAU / 8, a1 = a0 + TAU / 8;
      const o = rOut - 1, n = rIn + 0.5;
      const p = [Math.cos(a0) * o, Math.sin(a0) * o, Math.cos(a1) * o, Math.sin(a1) * o,
                 Math.cos(a1) * n, Math.sin(a1) * n, Math.cos(a0) * n, Math.sin(a0) * n];
      const cx = (p[0] + p[2] + p[4] + p[6]) / 4, cy = (p[1] + p[3] + p[5] + p[7]) / 4;
      for (let j = 0; j < 8; j += 2) { p[j] = cx + (p[j] - cx) * 0.93; p[j + 1] = cy + (p[j + 1] - cy) * 0.9; }
      drawPath(ctx, p);
      paint(ctx, shade(col, Math.round((R() - 0.5) * 24) / 100), 1.1);
      const mid = (a0 + a1) / 2;
      const lit = Math.max(0, -(Math.cos(mid) + Math.sin(mid)) * 0.7071);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]);
      strokeA(ctx, '#fff', 1.3, 0.1 + lit * 0.45);
    }
    ctx.restore();
  }

  // Roztomilý sliz (do klece)
  function slime(ctx, x, y, r, col, ts, ph) {
    ctx.save();
    const w = 1 + 0.08 * Math.sin(ts * 0.008 + ph);
    ctx.translate(x, y);
    ctx.scale(w, 2 - w);
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.5);
    ctx.quadraticCurveTo(-r, -r, 0, -r);
    ctx.quadraticCurveTo(r, -r, r, r * 0.5);
    ctx.quadraticCurveTo(0, r * 0.9, -r, r * 0.5);
    ctx.closePath();
    paint(ctx, col, 1.3);
    gloss(ctx, -r * 0.35, -r * 0.45, r * 0.35, r * 0.2, -0.5, 0.6);
    circlePath(ctx, -r * 0.33, -r * 0.05, r * 0.17); ctx.fillStyle = OUT; ctx.fill();
    circlePath(ctx, r * 0.33, -r * 0.05, r * 0.17); ctx.fill();
    ctx.restore();
  }

  /* =====================================================================
     GRYFÍ JEZDEC  (poloměr 24 px)
     ===================================================================== */

  // Vzhled gryfa podle úrovní – vypočte se jednou pro každou kombinaci
  const gLookMemo = new Map();
  function griffinLook(up) {
    const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2);
    const key = a * 100 + b * 10 + c;
    let L = gLookMemo.get(key);
    if (L) return L;
    const m = mainPath(up);
    L = {
      scale: 1,
      fur: '#d79b45', furDark: '#a8702c',
      wing: '#93602f', cov: '#c58a45', feather: '#6f4421',
      head: '#f6f1e4', beak: '#f4b52c',
      armor: null, trim: '#f2c230', caparison: null, capTrim: '#f2c230',
      rider: '#aeb7c2', cape: a >= 1 ? '#2f6fe0' : '#c43a2f', plume: '#e23b3b',
      longFeathers: a >= 1, quivers: a >= 2, helmet: a >= 3, rockets: a >= 3,
      trail: a >= 4, fourWings: a >= 5, halo: a >= 5,
      basket: b >= 1, eyesGlow: b >= 2, visor: b >= 2, rig: b >= 3, barrel: b >= 4, phoenix: b >= 5,
      claws: c >= 1, reins: c >= 2, arbalest: c === 3, cannon: c === 4, citadel: c >= 5
    };
    if (m.t >= 3) {
      if (m.p === 0) {
        if (m.t === 3) {           // Lovec monster – lovecká zelená čabraka
          L.caparison = '#2f6b45'; L.capTrim = '#c9d1d9';
        } else if (m.t === 4) {    // Nebeská eskadra – zlatomodrá královská zbroj
          L.armor = '#2f5fc4'; L.trim = '#f2c230'; L.rider = '#e8b83a'; L.cape = '#1f4fb8'; L.plume = '#ffffff';
        } else {                   // Pán nebeské pevnosti – zlatý arcigryf
          L.scale = 1.2; L.fur = '#f1d48c'; L.furDark = '#c9a55a'; L.wing = '#efe6cf'; L.cov = '#fffaf0';
          L.feather = '#ffffff'; L.head = '#ffffff'; L.armor = '#e9b934'; L.trim = '#fff1a8';
          L.rider = '#e9b934'; L.cape = '#2f6fe0'; L.plume = '#ffffff';
        }
      } else if (m.p === 1) {
        if (m.t === 3) {           // Kobercový nálet – kožená čabraka, ocelový jezdec
          L.caparison = '#6b4426'; L.capTrim = '#b0b6bd'; L.rider = '#8d949c';
        } else if (m.t === 4) {    // Soudný den – černo-červený válečný gryf
          L.fur = '#8f5d31'; L.furDark = '#5e3a1c'; L.wing = '#3e3330'; L.cov = '#5d4b44'; L.feather = '#2a2322';
          L.armor = '#2b2b33'; L.trim = '#d8322a'; L.rider = '#2b2b33'; L.cape = '#a3191b'; L.plume = '#d8322a';
          L.head = '#e9e2d6';
        } else {                   // Posel apokalypsy – ohnivý fénix-gryf v dračím pancíři
          L.scale = 1.15; L.fur = '#e8641f'; L.furDark = '#b8380f'; L.wing = '#d23a14'; L.cov = '#f2892a';
          L.feather = '#ffd23a'; L.head = '#ffdf7a'; L.beak = '#ffb020'; L.armor = '#6e1414'; L.trim = '#f2c230';
          L.rider = '#5a1010'; L.cape = '#ff7a1a'; L.plume = '#ffd23a';
        }
      } else {
        if (m.t === 3) {           // Naváděné šipky – fialová čabraka
          L.caparison = '#6d2f86'; L.capTrim = '#f2c230';
        } else if (m.t === 4) {    // Přízrak oblohy – velký šedozlatý gryf
          L.scale = 1.12; L.fur = '#9b968e'; L.furDark = '#6f6b65'; L.wing = '#7d7a76'; L.cov = '#a9a59e';
          L.feather = '#56534f'; L.armor = '#5b6068'; L.trim = '#e3b53a'; L.rider = '#8d949c';
        } else {                   // Létající citadela – gigantický královský gryf
          L.scale = 1.25; L.fur = '#d9a441'; L.furDark = '#a8762a'; L.wing = '#a8743a'; L.cov = '#d9a855';
          L.feather = '#f4f1ea'; L.caparison = '#b3202a'; L.capTrim = '#f2c230'; L.trim = '#f2c230';
        }
      }
    }
    // drobné doplňky z vedlejších cest
    if (L.longFeathers && !L.phoenix && !(m.p === 1 && m.t === 4)) L.feather = m.p === 0 && m.t >= 5 ? '#ffffff' : '#f4f1ea';
    if (a >= 1 && a < 3 && m.p !== 0) L.cape = '#2f6fe0';
    gLookMemo.set(key, L);
    return L;
  }

  // Jedno křídlo: počátek v rameni, rozpětí podél +x, odtoková hrana na +y
  function griffinWing(ctx, L, len, ts) {
    ctx.save();
    const nF = 6;
    const fLen = L.longFeathers ? 13 : 9;
    // letky
    for (let i = 0; i < nF; i++) {
      const t = i / (nF - 1);
      const fx = len * (0.3 + t * 0.66);
      const a = PI / 2 - t * 1.05;
      const fl = fLen * (0.8 + t * 0.35);
      const ca = Math.cos(a), sa = Math.sin(a);
      ellipsePath(ctx, fx + ca * fl * 0.5, 2 + sa * fl * 0.5, fl * 0.5, 2.7, a);
      paint(ctx, L.feather, 1.3);
      ctx.beginPath(); ctx.moveTo(fx, 2); ctx.lineTo(fx + ca * fl * 0.85, 2 + sa * fl * 0.85);
      strokeA(ctx, '#000', 0.8, 0.22);
      if (L.phoenix && i >= nF - 3) {
        ctx.save();
        ctx.translate(fx + ca * fl * 0.95, 2 + sa * fl * 0.95);
        ctx.rotate(a);
        flame3(ctx, 6 + (ts ? Math.sin(ts * 0.02 + i) * 1.5 : 0), 2.6);
        ctx.restore();
      }
    }
    // plocha křídla
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.quadraticCurveTo(len * 0.55, -8.5, len, -1.5);
    ctx.quadraticCurveTo(len * 0.8, 5.5, len * 0.45, 6.5);
    ctx.quadraticCurveTo(len * 0.2, 8, 0, 6);
    ctx.closePath();
    paint(ctx, L.wing, 2);
    // krovky (světlejší peří u náběžné hrany)
    ctx.beginPath();
    ctx.moveTo(1, -3.5);
    ctx.quadraticCurveTo(len * 0.5, -7, len * 0.88, -1.6);
    ctx.quadraticCurveTo(len * 0.5, -0.5, 1, 2);
    ctx.closePath();
    ctx.fillStyle = L.cov; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let x = 4; x < len * 0.8; x += 4) {
      ctx.beginPath(); ctx.arc(x, -1.2, 2.2, 0.15, PI - 0.15); ctx.stroke();
    }
    // odlesk náběžné hrany
    ctx.beginPath(); ctx.moveTo(2, -4.2); ctx.quadraticCurveTo(len * 0.5, -7.6, len * 0.85, -2.6);
    strokeA(ctx, '#fff', 1.4, 0.55);
    // plát zbroje na křídle
    if (L.armor) {
      roundRect(ctx, 1, -4.5, len * 0.38, 7.5, 3); paint(ctx, L.phoenix ? L.armor : L.armor, 1.6);
      roundRect(ctx, 2.2, -3.3, len * 0.38 - 2.4, 5.1, 2); strokeA(ctx, L.trim, 1.2, 1);
      rivet(ctx, len * 0.3, -0.8, 1.1, L.trim);
    }
    ctx.restore();
  }

  // Ocas: lví se střapcem, u fénixe ohnivá pera
  function griffinTail(ctx, L, ts) {
    ctx.save();
    if (L.phoenix) {
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(-13, i * 3);
        ctx.rotate(PI + i * 0.35);
        flame3(ctx, 14 + (ts ? Math.sin(ts * 0.02 + i) * 1.6 : 0) - Math.abs(i) * 2, 4.2);
        ctx.restore();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.bezierCurveTo(-19, -1, -20, 6, -25, 5);
      strokeOutlined(ctx, 3, L.fur);
      ellipsePath(ctx, -26, 5, 3.6, 2.6, 0.3); paint(ctx, L.furDark, 1.6);
      gloss(ctx, -27, 4, 1.4, 0.8, 0.3, 0.4);
    }
    ctx.restore();
  }

  // Tlapy a pařáty
  function griffinLegs(ctx, L) {
    ctx.save();
    const clawCol = L.claws ? '#e3e8ed' : '#2b2b2b';
    for (let k = -1; k <= 1; k += 2) {
      ellipsePath(ctx, -12, 8 * k, 3.6, 2.6, 0.3 * k); paint(ctx, L.furDark, 1.6);
      ctx.beginPath(); ctx.moveTo(6, 6 * k); ctx.lineTo(10, 7 * k);
      strokeOutlined(ctx, 2.2, '#e9b23a');
      for (let j = -1; j <= 1; j++) {
        ctx.beginPath(); ctx.moveTo(10, 7 * k); ctx.lineTo(12.8, 7 * k + j * 1.6);
        ctx.lineCap = 'round';
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.strokeStyle = clawCol; ctx.lineWidth = 1.1; ctx.stroke();
      }
      if (L.claws) rivet(ctx, 9.6, 7 * k, 1.1, '#c0c7cf');
    }
    ctx.restore();
  }

  // Hlava, krk, zobák, oči, přilbice, svatozář
  function griffinHead(ctx, L, ts) {
    ctx.save();
    ellipsePath(ctx, 5.5, 0, 6.5, 7); paint(ctx, L.head, 1.8);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.arc(3.5, k * 3.2, 2.2, -1.2, 1.2);
      strokeA(ctx, '#000', 1, 0.18);
    }
    for (let k = -1; k <= 1; k += 2) {
      ellipsePath(ctx, 6.5, 2.8 * k, 3.4, 1.5, -0.5 * k); paint(ctx, shade(L.head, -0.12), 1.2);
    }
    circlePath(ctx, 11, 0, 5.8); paint(ctx, L.head, 2);
    gloss(ctx, 9.8, -2, 3, 1.8, -0.4, 0.5);
    if (L.helmet) {
      const hc = L.armor ? L.trim : '#a2abb5';
      ctx.beginPath();
      ctx.arc(11, 0, 6.4, PI * 0.6, PI * 1.4);
      ctx.quadraticCurveTo(14.5, -4, 16, 0);
      ctx.quadraticCurveTo(14.5, 4, 11 + 6.4 * Math.cos(PI * 0.6), 6.4 * Math.sin(PI * 0.6));
      ctx.closePath();
      paint(ctx, hc, 1.8);
      ctx.beginPath(); ctx.moveTo(5.5, 0); ctx.lineTo(15, 0);
      strokeOutlined(ctx, 1.4, shade(hc, 0.25));
      gloss(ctx, 8.5, -3, 2.4, 1.2, -0.5, 0.55);
      rivet(ctx, 8, 3.6, 0.9, shade(hc, 0.2));
      rivet(ctx, 8, -3.6, 0.9, shade(hc, 0.2));
    }
    // zobák
    ctx.beginPath();
    ctx.moveTo(15.2, -3);
    ctx.quadraticCurveTo(20.5, -2.6, 22.2, 0.8);
    ctx.quadraticCurveTo(19.5, 2.4, 15.2, 3);
    ctx.closePath();
    paint(ctx, L.beak, 1.6);
    ctx.beginPath(); ctx.moveTo(16, -1.6); ctx.quadraticCurveTo(19.5, -1.4, 21, 0.2);
    strokeA(ctx, '#fff', 1, 0.6);
    // oči
    for (let k = -1; k <= 1; k += 2) {
      const ey = 3.9 * k;
      if (L.eyesGlow) {
        glow(ctx, 12.3, ey, 3.6, '#ffd23a', 0.9);
        circlePath(ctx, 12.3, ey, 1.55); paint(ctx, '#ffe85a', 1);
        circlePath(ctx, 12.6, ey, 0.6); ctx.fillStyle = OUT; ctx.fill();
      } else {
        circlePath(ctx, 12.3, ey, 1.3); ctx.fillStyle = OUT; ctx.fill();
        circlePath(ctx, 12, ey - 0.4, 0.45); ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
    // svatozář
    if (L.halo) {
      const p = ts ? 0.75 + 0.25 * Math.sin(ts * 0.004) : 1;
      circlePath(ctx, 10, 0, 9); strokeA(ctx, '#ffe066', 6, 0.22 * p);
      circlePath(ctx, 10, 0, 9); strokeA(ctx, OUT, 3, 0.6);
      circlePath(ctx, 10, 0, 9); strokeA(ctx, '#ffe78a', 1.7, 1);
    }
    ctx.restore();
  }

  // Plátová zbroj na hřbetě
  function griffinArmor(ctx, L) {
    ctx.save();
    ellipsePath(ctx, -4, 0, 10.5, 7); paint(ctx, L.armor, 1.8);
    ellipsePath(ctx, -4, 0, 8.6, 5.3); strokeA(ctx, L.trim, 1.3, 1);
    gloss(ctx, -7, -3, 5, 1.8, 0, 0.3);
    rivet(ctx, -12, 3, 1, L.trim); rivet(ctx, -12, -3, 1, L.trim);
    rivet(ctx, 4, 3, 1, L.trim); rivet(ctx, 4, -3, 1, L.trim);
    ctx.restore();
  }

  // Dračí šupinový pancíř (fénix)
  function griffinDragonScales(ctx, L) {
    ctx.save();
    ellipsePath(ctx, -4, 0, 10.5, 7); paint(ctx, L.armor, 1.8);
    ctx.strokeStyle = L.trim; ctx.lineWidth = 0.8;
    for (let x = -12; x <= 2; x += 3.6) {
      for (let y = -4; y <= 4; y += 4) {
        ctx.beginPath(); ctx.arc(x, y, 2.3, -PI / 2, PI / 2);
        ctx.fillStyle = shade(L.armor, 0.18); ctx.fill(); ctx.stroke();
      }
    }
    for (let x = -12; x <= 2; x += 3.5) {
      drawPath(ctx, [x - 1.6, -1.2, x + 1.8, 0, x - 1.6, 1.2]);
      paint(ctx, L.trim, 0.9);
    }
    gloss(ctx, -7, -3.6, 4.5, 1.5, 0, 0.25);
    ctx.restore();
  }

  // Čabraka (látková pokrývka)
  function griffinCaparison(ctx, L) {
    ctx.save();
    roundRect(ctx, -12, -8.2, 15, 16.4, 4); paint(ctx, L.caparison, 1.8);
    roundRect(ctx, -10.8, -7, 12.6, 14, 3); strokeA(ctx, L.capTrim, 1.2, 1);
    gloss(ctx, -6, -5, 4.5, 1.3, 0, 0.25);
    for (let k = -1; k <= 1; k += 2) {
      circlePath(ctx, -12, 7.5 * k, 1.3); paint(ctx, L.capTrim, 0.8);
      circlePath(ctx, 3, 7.5 * k, 1.3); paint(ctx, L.capTrim, 0.8);
    }
    ctx.restore();
  }

  // Koš s pumami pod břichem
  function griffinBasket(ctx) {
    ctx.save();
    ellipsePath(ctx, -9, 0, 7.5, 10.5); paint(ctx, '#8a5a2e', 1.8);
    ctx.beginPath();
    for (let y = -8; y <= 8; y += 3) { ctx.moveTo(-15, y); ctx.lineTo(-3, y); }
    strokeA(ctx, '#4e3018', 0.9, 0.55);
    const pos = [-6, 9.6, -11.5, 9.2, -6, -9.6, -11.5, -9.2];
    for (let i = 0; i < pos.length; i += 2) {
      circlePath(ctx, pos[i], pos[i + 1], 2.5); paint(ctx, '#26262c', 1.2);
      gloss(ctx, pos[i] - 0.8, pos[i + 1] - 0.8, 0.9, 0.6, 0, 0.6);
    }
    ctx.restore();
  }

  // Pumy bombardovacího závěsu (pod gryfem)
  function griffinRigBombs(ctx) {
    ctx.save();
    for (let k = -1; k <= 1; k += 2) {
      circlePath(ctx, -11.5, 15 * k, 3.8); paint(ctx, '#26262c', 1.6);
      gloss(ctx, -12.6, 15 * k - 1.2, 1.4, 0.9, 0, 0.6);
      ctx.beginPath(); ctx.moveTo(-11.5, 15 * k - 3.8 * k); ctx.lineTo(-11.5, 12 * k);
      strokeA(ctx, '#5a3418', 1, 1);
    }
    ctx.restore();
  }

  // Dřevo-ocelový bombardovací trám (na hřbetě)
  function griffinRigBeam(ctx) {
    ctx.save();
    woodRect(ctx, -15, -14, 5, 28, 1.5, '#8b5a2b', 1, false);
    for (let y = -10; y <= 10; y += 10) {
      roundRect(ctx, -15.6, y - 1.2, 6.2, 2.4, 0.8); paint(ctx, '#8d949c', 1);
      rivet(ctx, -12.5, y, 0.8, '#c9d0d6');
    }
    ctx.restore();
  }

  // Obří zlatě okovaný sud v pařátech
  function griffinBarrel(ctx) {
    ctx.save();
    roundRect(ctx, 4.5, -12.5, 9, 25, 4); paint(ctx, '#8b5a2b', 2);
    ctx.beginPath();
    ctx.moveTo(7.5, -12); ctx.lineTo(7.5, 12); ctx.moveTo(10.5, -12); ctx.lineTo(10.5, 12);
    strokeA(ctx, '#5a3418', 0.9, 0.7);
    for (let y = -8; y <= 8; y += 8) {
      roundRect(ctx, 4, y - 1.3, 10, 2.6, 1); paint(ctx, '#e3b53a', 1.1);
    }
    gloss(ctx, 6.5, -6, 1.2, 4, 0, 0.35);
    ctx.restore();
  }

  // Mosazné odpalovače raket pod křídly
  function griffinRockets(ctx) {
    ctx.save();
    for (let k = -1; k <= 1; k += 2) {
      const y = 12.5 * k;
      roundRect(ctx, -4, y - 2.4, 14, 4.8, 2); paint(ctx, '#c9953a', 1.6);
      roundRect(ctx, 0, y - 2.6, 1.6, 5.2, 0.6); paint(ctx, '#8a5f1e', 0.9);
      drawPath(ctx, [10, y - 2.1, 13.5, y, 10, y + 2.1]); paint(ctx, '#d8322a', 1.2);
      ctx.beginPath(); ctx.moveTo(-3, y - 1.3); ctx.lineTo(9, y - 1.3);
      strokeA(ctx, '#fff', 0.9, 0.5);
    }
    ctx.restore();
  }

  // Bubnové toulce po stranách sedla
  function griffinQuivers(ctx) {
    ctx.save();
    for (let k = -1; k <= 1; k += 2) {
      const qy = 10.5 * k;
      circlePath(ctx, -4, qy, 3.9); paint(ctx, '#7b4426', 1.6);
      circlePath(ctx, -4, qy, 2.9); strokeA(ctx, '#e7b93b', 1, 1);
      for (let j = 0; j < 5; j++) {
        const a = j * TAU / 5;
        circlePath(ctx, -4 + Math.cos(a) * 1.6, qy + Math.sin(a) * 1.6, 0.75);
        ctx.fillStyle = '#f2c230'; ctx.fill();
      }
      circlePath(ctx, -4, qy, 0.75); ctx.fillStyle = '#dfe6ec'; ctx.fill();
      gloss(ctx, -5.4, qy - 1.6, 1.4, 0.7, -0.5, 0.45);
    }
    ctx.restore();
  }

  // Dvojhlavňové mechanické dělo na hřbetě
  function griffinCannon(ctx, L) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-8, 7); ctx.moveTo(-11, 0); ctx.lineTo(-8, -7);
    strokeOutlined(ctx, 1.6, '#9aa2ab');
    for (let k = -1; k <= 1; k += 2) {
      const y = 7 * k;
      roundRect(ctx, -13, y - 1.9, 20, 3.8, 1.6); paint(ctx, '#4c5159', 1.6);
      ctx.beginPath(); ctx.moveTo(-11, y - 1); ctx.lineTo(5, y - 1); strokeA(ctx, '#fff', 0.9, 0.35);
      roundRect(ctx, -6, y - 2.2, 2, 4.4, 0.8); paint(ctx, L.trim, 1);
      roundRect(ctx, 4.5, y - 2.4, 3, 4.8, 1); paint(ctx, L.trim, 1.2);
      circlePath(ctx, 7.2, y, 1); ctx.fillStyle = OUT; ctx.fill();
    }
    gearPath(ctx, -11, 0, 4.6, 8, 1.2); paint(ctx, '#7c8088', 1.5);
    circlePath(ctx, -11, 0, 2); paint(ctx, L.trim, 1.2);
    ctx.restore();
  }

  // Pancéřovaná věž se třemi zlatými kanóny a prapory
  function griffinCitadel(ctx, L, ts) {
    ctx.save();
    ctx.translate(-8, 0);
    const w = ts ? Math.sin(ts * 0.01) * 2 : 1.2;
    pennant(ctx, -7, -6, PI + 0.3, 14, '#c8202b', '#f2c230', w);
    pennant(ctx, -7, 6, PI - 0.3, 14, '#2f6fe0', '#f2c230', -w);
    const angs = [0.9, -0.9, PI];
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(angs[i]);
      roundRect(ctx, 5, -2.2, 10, 4.4, 1.5); paint(ctx, '#e3b53a', 1.6);
      ctx.beginPath(); ctx.moveTo(6, -1.2); ctx.lineTo(13, -1.2); strokeA(ctx, '#fff', 0.9, 0.55);
      roundRect(ctx, 13.5, -2.7, 2.5, 5.4, 1); paint(ctx, '#b8862a', 1.2);
      circlePath(ctx, 16, 0, 1.2); ctx.fillStyle = OUT; ctx.fill();
      ctx.restore();
    }
    circlePath(ctx, 0, 0, 9.5); paint(ctx, '#c9c0b0', 2);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(i * TAU / 8 + PI / 8);
      roundRect(ctx, 6.3, -2.3, 4, 4.6, 1); paint(ctx, '#ddd5c6', 1.1);
      ctx.restore();
    }
    circlePath(ctx, 0, 0, 6.2); paint(ctx, '#8e8677', 1.4);
    circlePath(ctx, 0, 0, 6.2); strokeA(ctx, L.trim, 1, 0.9);
    circlePath(ctx, 0, 0, 3.4); paint(ctx, '#e9b934', 1.4);
    gloss(ctx, -1, -1.2, 1.5, 0.9, -0.5, 0.7);
    gloss(ctx, -4, -5.5, 3, 1.2, -0.6, 0.3);
    ctx.restore();
  }

  // Jezdec (rytíř) – plášť, ramena, přilba s chocholem, případně krystalové hledí
  function griffinRider(ctx, L, x, sc) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(sc, sc);
    ctx.beginPath();
    ctx.moveTo(-1, -5);
    ctx.quadraticCurveTo(-8, -8.5, -13, -6);
    ctx.quadraticCurveTo(-15, 0, -13, 6);
    ctx.quadraticCurveTo(-8, 8.5, -1, 5);
    ctx.closePath();
    paint(ctx, L.cape, 1.8);
    ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(-12, -4); ctx.moveTo(-4, 3); ctx.lineTo(-12, 4);
    strokeA(ctx, '#000', 1, 0.2);
    gloss(ctx, -7, -4.5, 4, 1.1, 0, 0.22);
    ctx.beginPath(); ctx.moveTo(-1, -4.5); ctx.lineTo(4, -2.8); ctx.moveTo(-1, 4.5); ctx.lineTo(4, 2.8);
    strokeOutlined(ctx, 2.2, L.rider);
    ellipsePath(ctx, -1.5, 0, 3.6, 5.6); paint(ctx, L.rider, 1.8);
    for (let k = -1; k <= 1; k += 2) {
      circlePath(ctx, -1.5, 4.6 * k, 2.4); paint(ctx, shade(L.rider, 0.15), 1.4);
    }
    ellipsePath(ctx, -4.6, 0, 3.2, 1.3); paint(ctx, L.plume, 1.2);
    circlePath(ctx, -1, 0, 3.4); paint(ctx, shade(L.rider, 0.1), 1.8);
    gloss(ctx, -2, -1.3, 1.5, 0.9, -0.5, 0.6);
    if (L.visor) {
      glow(ctx, 2, 0, 3, '#7ff0ff', 0.8);
      ctx.beginPath(); ctx.arc(-1, 0, 3.4, -0.9, 0.9);
      strokeA(ctx, '#bff8ff', 1.7, 1);
    } else {
      ctx.beginPath(); ctx.moveTo(1.6, -1.4); ctx.lineTo(1.6, 1.4);
      strokeA(ctx, OUT, 1, 0.7);
    }
    ctx.restore();
  }

  // Otěže (zdobené zlaté od 2. úrovně 3. cesty)
  function griffinReins(ctx, L, hx, sc) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hx, -2.8 * sc); ctx.quadraticCurveTo(10, -4.5, 14.5, -2.6);
    ctx.moveTo(hx, 2.8 * sc); ctx.quadraticCurveTo(10, 4.5, 14.5, 2.6);
    if (L.reins) {
      strokeOutlined(ctx, 1.2, '#f2c230');
      circlePath(ctx, 10, -3.9, 0.9); ctx.fillStyle = '#fff6c0'; ctx.fill();
      circlePath(ctx, 10, 3.9, 0.9); ctx.fill();
    } else {
      strokeA(ctx, '#5a3418', 1, 1);
    }
    ctx.restore();
  }

  // Opakovací trpasličí arbalest na otočném kloubu u sedla
  function griffinArbalest(ctx) {
    ctx.save();
    ctx.translate(0, 6.2);
    circlePath(ctx, -1, 0, 2.2); paint(ctx, '#6c727a', 1.4);
    roundRect(ctx, -1, -1.3, 13, 2.6, 1); paint(ctx, '#8b5a2b', 1.4);
    ctx.beginPath(); ctx.moveTo(8.5, -6); ctx.quadraticCurveTo(12.5, 0, 8.5, 6);
    strokeOutlined(ctx, 1.5, '#aab3bd');
    ctx.beginPath(); ctx.moveTo(8.5, -6); ctx.lineTo(5, 0); ctx.lineTo(8.5, 6);
    strokeA(ctx, '#f0e6d0', 0.8, 1);
    roundRect(ctx, 2, -2.6, 5, 5.2, 1); paint(ctx, '#d9a441', 1.3);
    roundRect(ctx, 3, -1.8, 3, 3.6, 0.6); ctx.fillStyle = '#3a2a1a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(3.6, -1.2); ctx.lineTo(3.6, 1.2); ctx.moveTo(5.4, -1.2); ctx.lineTo(5.4, 1.2);
    strokeA(ctx, '#dfe6ec', 0.8, 1);
    ctx.restore();
  }

  // Oba páry křídel (zadní pár jen u arcigryfa)
  function griffinWings(ctx, L, wingAng, wingLen, flapK, ts) {
    ctx.save();
    if (L.fourWings) {
      for (let k = -1; k <= 1; k += 2) {
        ctx.save();
        ctx.translate(-5, 5 * k);
        ctx.scale(1, k);
        ctx.rotate(wingAng + 0.55);
        ctx.scale(flapK, 1);
        griffinWing(ctx, L, wingLen * 0.8, ts);
        ctx.restore();
      }
    }
    for (let k = -1; k <= 1; k += 2) {
      ctx.save();
      ctx.translate(2, 6 * k);
      ctx.scale(1, k);
      ctx.rotate(wingAng);
      ctx.scale(flapK, 1);
      griffinWing(ctx, L, wingLen, ts);
      ctx.restore();
    }
    ctx.restore();
  }

  // Celý gryf s jezdcem shora, hlava míří k +x.
  // spread: 0 složená křídla … 1 roztažená, flap: 0–1 fáze mávnutí, ts: čas (0 = statické)
  function drawGriffin(ctx, up, spread, flap, ts) {
    const L = griffinLook(up);
    ctx.save();
    ctx.scale(L.scale, L.scale);
    // složená křídla leží podél boků přes hřbet, roztažená míří do stran
    const wingAng = PI - 0.15 - spread * (PI / 2 - 0.37) + flap * 0.12;
    const wingLen = 15 + spread * 10;
    const flapK = 1 - flap * 0.38;
    const folded = spread < 0.5;

    // věci pod gryfem
    if (L.barrel) griffinBarrel(ctx);
    if (L.basket) griffinBasket(ctx);
    if (L.rig) griffinRigBombs(ctx);
    if (L.rockets) griffinRockets(ctx);
    griffinTail(ctx, L, ts);

    if (!folded) griffinWings(ctx, L, wingAng, wingLen, flapK, ts);
    griffinLegs(ctx, L);

    // tělo
    ellipsePath(ctx, -3, 0, 13, 8.5); paint(ctx, L.fur, 2);
    ellipsePath(ctx, -3, 3.6, 11, 4.2); fillA(ctx, '#000', 0.1);
    ellipsePath(ctx, -6, -3.4, 7, 2.6); fillA(ctx, '#fff', 0.28);
    if (L.phoenix) griffinDragonScales(ctx, L);
    else if (L.armor) griffinArmor(ctx, L);
    if (folded) griffinWings(ctx, L, wingAng, wingLen, flapK, ts);
    if (L.caparison) griffinCaparison(ctx, L);
    if (L.rig) griffinRigBeam(ctx);
    griffinHead(ctx, L, ts);
    if (L.quivers) griffinQuivers(ctx);

    if (L.citadel) {
      griffinRider(ctx, L, 4.5, 0.8);
      griffinReins(ctx, L, 4.5 + 3.2, 0.8);
      griffinCitadel(ctx, L, ts);
    } else {
      if (L.cannon) griffinCannon(ctx, L);
      griffinRider(ctx, L, -2, 1);
      griffinReins(ctx, L, 2, 1);
    }
    if (L.arbalest) griffinArbalest(ctx);
    ctx.restore();
  }

  // Hnízdo z větví
  const NEST_TWIGS = (function () {
    const R = makeRng(4242);
    const arr = [];
    for (let i = 0; i < 46; i++) arr.push(R() * TAU, 10 + R() * 6, 6 + R() * 6, (R() - 0.5) * 0.9, R());
    return arr;
  })();

  function drawNest(ctx, col, straw) {
    ctx.save();
    circlePath(ctx, 0, 0, 16.5); paint(ctx, shade(col, -0.25), 2);
    circlePath(ctx, 0, 0, 10.5); paint(ctx, straw, 1.5);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
      ctx.lineTo(Math.cos(a + 0.5) * 8, Math.sin(a + 0.5) * 8);
    }
    strokeA(ctx, shade(straw, -0.35), 1, 0.7);
    ctx.lineCap = 'round';
    const c1 = shade(col, 0.25), c2 = col, c3 = shade(col, -0.12);
    for (let i = 0; i < NEST_TWIGS.length; i += 5) {
      const ang = NEST_TWIGS[i], rr = NEST_TWIGS[i + 1], len = NEST_TWIGS[i + 2], tilt = NEST_TWIGS[i + 3], v = NEST_TWIGS[i + 4];
      const cx = Math.cos(ang) * rr, cy = Math.sin(ang) * rr;
      const ta = ang + PI / 2 + tilt;
      const dx = Math.cos(ta) * len * 0.5, dy = Math.sin(ta) * len * 0.5;
      ctx.beginPath(); ctx.moveTo(cx - dx, cy - dy); ctx.lineTo(cx + dx, cy + dy);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = v < 0.33 ? c1 : v < 0.66 ? c2 : c3; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 14.5, PI * 1.05, PI * 1.45);
    strokeA(ctx, '#fff', 1.5, 0.3);
    ctx.restore();
  }

  // Muniční jeřáb u hnízda
  function nestCrane(ctx) {
    ctx.save();
    ctx.translate(15, 13);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-13, 10);
    strokeOutlined(ctx, 3, '#8b5a2b');
    ctx.beginPath();
    for (let i = 1; i < 4; i++) { const x = -13 * i / 4, y = 10 * i / 4; ctx.moveTo(x - 1.2, y - 1.6); ctx.lineTo(x + 1.2, y + 1.6); }
    strokeA(ctx, '#4e3018', 1, 0.8);
    circlePath(ctx, -13, 12.5, 3.4); paint(ctx, '#26262c', 1.5);
    gloss(ctx, -14, 11.4, 1.2, 0.8, 0, 0.6);
    ctx.beginPath(); ctx.moveTo(-13, 10); ctx.lineTo(-13, 9.2); strokeA(ctx, '#d9c9a8', 1, 1);
    roundRect(ctx, -4, -4, 8, 8, 2); paint(ctx, '#9c6636', 1.6);
    gearPath(ctx, 0, 0, 3.2, 8, 1); paint(ctx, '#8d949c', 1.1);
    circlePath(ctx, 0, 0, 1); ctx.fillStyle = OUT; ctx.fill();
    ctx.restore();
  }

  // Obří runová puma
  function runeBomb(ctx, x, y, seed) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, 0, 6.5, 6.5);
    circlePath(ctx, 0, 0, 6.8); paint(ctx, '#2a2530', 2);
    ellipsePath(ctx, 0, 0, 6.8, 2.6, 0.7); strokeA(ctx, '#e3b53a', 1.4, 1);
    gloss(ctx, -2.4, -2.6, 2.4, 1.4, -0.6, 0.4);
    rune(ctx, 0.8, 0.8, 6, '#ff8a2a', seed);
    roundRect(ctx, -6, -7, 3.4, 3.4, 0.8); paint(ctx, '#e3b53a', 1);
    spark(ctx, -6.5, -7.6, 1.8);
    ctx.restore();
  }

  // Malá královská věžička s praporem (citadela)
  function miniTower(ctx, x, y, out) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, 0, 5.5, 5.5);
    circlePath(ctx, 0, 0, 5.6); paint(ctx, '#ddd4c4', 1.6);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      roundRect(ctx, Math.cos(a) * 4.4 - 1.3, Math.sin(a) * 4.4 - 1.3, 2.6, 2.6, 0.6);
      paint(ctx, '#efe8da', 0.9);
    }
    circlePath(ctx, 0, 0, 3.3); paint(ctx, '#8e8677', 1.1);
    pennant(ctx, 0, 0, out, 10, '#c8202b', '#f2c230', 1);
    ctx.restore();
  }

  TDS.drawers.gryfi_jezdec = {
    // Podstavec: kamenný kruh s hnízdem (neotáčí se)
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      ctx.save();
      // spálená zem kolem hnízda (Posel apokalypsy)
      if (b >= 5) {
        circlePath(ctx, 0, 0, 31); fillA(ctx, '#2a1308', 0.35);
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + 0.2;
          lightning(ctx, Math.cos(an) * 21, Math.sin(an) * 21, Math.cos(an + 0.15) * 31, Math.sin(an + 0.15) * 31, 300 + i, '#ff6a1a', 1.2);
        }
      }
      // nebeská záře na zemi (Pán nebeské pevnosti)
      if (m.p === 0 && m.t >= 5) {
        circlePath(ctx, 0, 0, 27); fillA(ctx, '#fff4b8', 0.12);
        circlePath(ctx, 0, 0, 27); strokeA(ctx, '#ffe780', 4, 0.3);
        circlePath(ctx, 0, 0, 27); strokeA(ctx, '#fff6c8', 1.4, 0.85);
      }
      softShadow(ctx, 0, 0, 22, 21);
      let stone = '#9c9a93';
      if (m.p === 0 && m.t >= 3) stone = m.t >= 5 ? '#efe9da' : '#b8c4d2';
      else if (m.p === 1 && m.t >= 4) stone = '#5a4e50';
      else if (m.p === 2 && m.t >= 4) stone = '#c7b48e';
      // železné hroty (válečný gryf)
      if (m.p === 1 && m.t >= 4) {
        for (let i = 0; i < 10; i++) {
          ctx.save();
          ctx.rotate(i * TAU / 10 + 0.31);
          drawPath(ctx, [20, -2.4, 27.5, 0, 20, 2.4]); paint(ctx, '#3b3b42', 1.3);
          ctx.beginPath(); ctx.moveTo(21, -1); ctx.lineTo(26, 0); strokeA(ctx, '#d8322a', 0.9, 0.9);
          ctx.restore();
        }
      }
      stoneRing(ctx, 15, 22, 10, stone, 101);
      if ((m.p === 0 && m.t >= 4) || (m.p === 2 && m.t >= 4)) {
        for (let i = 0; i < 10; i++) {
          const an = i * TAU / 10;
          rivet(ctx, Math.cos(an) * 18.6, Math.sin(an) * 18.6, 1.2, '#f2c230');
        }
      }
      let nestCol = '#7a4b24', straw = '#d9b25a';
      if (m.p === 0 && m.t >= 5) { nestCol = '#b98b4a'; straw = '#f6e3a0'; }
      if (m.p === 1 && m.t >= 4) { nestCol = '#4a3426'; straw = '#9a7a4a'; }
      if (m.p === 1 && m.t >= 5) { nestCol = '#5a2a14'; straw = '#e0883a'; }
      drawNest(ctx, nestCol, straw);

      // modrozlaté prapory (Lovec monster, Nebeská eskadra)
      if (m.p === 0 && m.t >= 3 && m.t < 5) {
        pennant(ctx, -17, -12, -2.4, 12, '#2f6fe0', '#f2c230', 1.2);
        pennant(ctx, 17, -12, -0.75, 12, '#2f6fe0', '#f2c230', -1.2);
      }
      // zlaté sloupy (Pán nebeské pevnosti)
      if (m.p === 0 && m.t >= 5) {
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2 + PI / 4;
          const px = Math.cos(an) * 20, py = Math.sin(an) * 20;
          circlePath(ctx, px, py, 3.9); paint(ctx, '#f4efe2', 1.6);
          circlePath(ctx, px, py, 2.4); paint(ctx, '#e9b934', 1.1);
          gloss(ctx, px - 1.3, py - 1.3, 1.2, 0.7, -0.6, 0.7);
        }
      }
      // barevný praporek (Cvičený let)
      if (c >= 2 && c < 5) pennant(ctx, 14, -16, -0.85, 11, '#e2453a', '#ffd34a', 1);
      // muniční jeřáb
      if (b >= 3) nestCrane(ctx);
      // čtyři runové pumy
      if (b >= 5) {
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2 + PI / 4;
          runeBomb(ctx, Math.cos(an) * 22, Math.sin(an) * 22, 500 + i);
        }
      }
      // stojan na šipky (Naváděné šipky)
      if (c >= 3 && c < 5) {
        ctx.save();
        ctx.translate(-15, 13);
        ctx.rotate(0.7);
        woodRect(ctx, -6, -2.5, 12, 5, 1.5, '#8b5a2b', 1, false);
        for (let x = -4.5; x <= 4.5; x += 3) {
          circlePath(ctx, x, -0.6, 1); paint(ctx, '#dfe6ec', 0.8);
          ctx.beginPath(); ctx.moveTo(x, 0.6); ctx.lineTo(x, 2); strokeA(ctx, '#f2c230', 1.1, 1);
        }
        ctx.restore();
      }
      // bedna koulí a ozubené kolo (Přízrak oblohy)
      if (c === 4) {
        ctx.save();
        ctx.translate(15, 13);
        woodRect(ctx, -5, -5, 10, 10, 1.5, '#9c6636', 2, true);
        for (let i = 0; i < 4; i++) {
          const px = i % 2 ? 2 : -2, py = i < 2 ? -2 : 2;
          circlePath(ctx, px, py, 1.8); paint(ctx, '#3b3b42', 0.9);
        }
        gearPath(ctx, 6.5, -6.5, 3.6, 8, 1.1); paint(ctx, '#e3b53a', 1.2);
        circlePath(ctx, 6.5, -6.5, 1); ctx.fillStyle = OUT; ctx.fill();
        ctx.restore();
      }
      // čtyři královské věžičky (Létající citadela)
      if (c >= 5) {
        circlePath(ctx, 0, 0, 22); strokeA(ctx, '#f2c230', 1.4, 0.9);
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2 + PI / 4;
          miniTower(ctx, Math.cos(an) * 21, Math.sin(an) * 21, an);
        }
      }
      ctx.restore();
    },

    // Věž: gryf s jezdcem odpočívající v hnízdě (složená křídla), hlava míří k +x
    turret: function (ctx, up, s) {
      s = s || NO_OPT;
      const f = s.firing || 0;
      ctx.save();
      if (s.buffed) buffAura(ctx, 22);
      ellipsePath(ctx, 1.5, 2, 17, 11); fillA(ctx, '#000', 0.16);
      drawGriffin(ctx, up, 0.12, 0, 0);
      // radiální salva – zlatý prstenec šipek
      if (f > 0) {
        const r = 14 + (1 - f) * 14;
        circlePath(ctx, 0, 0, r); strokeA(ctx, '#ffe27a', 2.2, f);
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8;
          ctx.save();
          ctx.rotate(an);
          ctx.globalAlpha *= f;
          drawPath(ctx, [r + 1, -1.6, r + 6, 0, r + 1, 1.6]);
          paint(ctx, '#dfe6ec', 1);
          ctx.restore();
        }
      }
      ctx.restore();
    }
  };

  // Stín letícího gryfa na zemi (daleko pod ním)
  function griffinGroundShadow(ctx, L, ang, flapK) {
    ctx.save();
    ctx.translate(15, 22);
    ctx.rotate(ang);
    ctx.scale(L.scale, L.scale);
    ctx.fillStyle = '#000';
    ctx.globalAlpha *= 0.15;
    ellipsePath(ctx, -2, 0, 16, 7); ctx.fill();
    ellipsePath(ctx, -3, 0, 7, 30 * flapK); ctx.fill();
    ctx.restore();
  }

  // Světle modrá vzdušná stopa za křídly (Nebeská eskadra a výš)
  function skyTrail(ctx, L, ts, flapK) {
    ctx.save();
    ctx.scale(L.scale, L.scale);
    ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k += 2) {
      const ty = (6 + 24 * flapK) * k;
      const wob = Math.sin(ts * 0.006 + k) * 2;
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.moveTo(-3 - j * 9, ty + wob * j / 5);
        ctx.lineTo(-3 - (j + 1) * 9, ty + wob * (j + 1) / 5);
        strokeA(ctx, '#a8dcff', (5 - j) * 1.15, 0.5 * (1 - j / 5));
        if (j < 2) strokeA(ctx, '#ffffff', 1, 0.6 * (1 - j / 2));
      }
    }
    ctx.restore();
  }

  // Žhavé jiskry za fénixem
  function phoenixEmbers(ctx, L, ts) {
    ctx.save();
    ctx.scale(L.scale, L.scale);
    for (let i = 0; i < 7; i++) {
      const ph = (ts * 0.002 + i / 7) % 1;
      const x = -18 - ph * 26;
      const y = Math.sin(i * 2.3 + ts * 0.004) * (4 + ph * 8);
      circlePath(ctx, x, y, 1.8 * (1 - ph) + 0.4);
      fillA(ctx, i % 2 ? '#ffd23a' : '#ff7a1a', 1 - ph);
    }
    ctx.restore();
  }

  /*
   * TDS.gryfi_jezdecExtra(ctx, kind, x, y, ang, ts, s)
   *  kind = 'gryf'     – letící gryf s jezdcem shora; ang = směr letu, ts = čas v ms,
   *                       s.up = úrovně cest [a, b, c] (vzhled podle úrovní),
   *                       s.firing = 0–1 (volitelně záblesk salvy), s.buffed (volitelně)
   *  kind = 'gryfDart' | 'rocket' | 'shell' – střely (stejné jako v TDS.projectileDrawers), ang = směr
   */
  TDS.gryfi_jezdecExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || NO_OPT;
    ts = ts || 0;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'gryf') {
      const up = s.up || [0, 0, 0];
      const L = griffinLook(up);
      const flap = 0.5 + 0.5 * Math.sin(ts * 0.011 + x * 0.01);
      const flapK = 1 - flap * 0.38;
      griffinGroundShadow(ctx, L, ang || 0, flapK);
      ctx.rotate(ang || 0);
      if (L.trail) skyTrail(ctx, L, ts, flapK);
      if (L.phoenix) phoenixEmbers(ctx, L, ts);
      if (s.buffed) buffAura(ctx, 30);
      drawGriffin(ctx, up, 1, flap, ts);
      const f = s.firing || 0;
      if (f > 0) {
        circlePath(ctx, 0, 0, 20 + (1 - f) * 16); strokeA(ctx, '#ffe27a', 2.4, f);
      }
    } else if (TDS.projectileDrawers && TDS.projectileDrawers[kind]) {
      ctx.rotate(ang || 0);
      TDS.projectileDrawers[kind](ctx);
    }
    ctx.restore();
  };

  /* ---------- Střely gryfa ---------- */

  // Opeřená ocelová šipka se zlatými letkami
  function drawGryfDart(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-13, 0);
    strokeA(ctx, '#ffffff', 2.2, 0.35);
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(10, 0);
    strokeOutlined(ctx, 2, '#b9c2cc');
    drawPath(ctx, [9, -3, 18, 0, 9, 3, 11, 0]); paint(ctx, '#dfe6ec', 1.5);
    drawPath(ctx, [9.6, -2.3, 17, 0, 11, 0]); fillA(ctx, '#fff', 0.7);
    drawPath(ctx, [-14, -0.8, -8, -1, -5.5, -5.6, -11.5, -5.4]); paint(ctx, '#f2c230', 1.3);
    drawPath(ctx, [-14, 0.8, -8, 1, -5.5, 5.6, -11.5, 5.4]); paint(ctx, '#e0a92a', 1.3);
    ctx.beginPath(); ctx.moveTo(-12, -3.6); ctx.lineTo(-7.5, -2.6); strokeA(ctx, '#fff6c0', 0.8, 0.8);
    roundRect(ctx, 6.5, -1.6, 2, 3.2, 0.6); paint(ctx, '#f2c230', 0.9);
    ctx.restore();
  }

  // Mosazná raketa s plamenem
  function drawRocket(ctx) {
    ctx.save();
    puff(ctx, -21, 1.5, 3, 0.35);
    puff(ctx, -17, -1.5, 2.4, 0.4);
    ctx.save(); ctx.translate(-9, 0); ctx.rotate(PI); flame3(ctx, 12, 4); ctx.restore();
    drawPath(ctx, [-9, -3.4, -13, -7.2, -5.5, -3.4]); paint(ctx, '#8d949c', 1.3);
    drawPath(ctx, [-9, 3.4, -13, 7.2, -5.5, 3.4]); paint(ctx, '#8d949c', 1.3);
    roundRect(ctx, -10, -3.4, 17, 6.8, 2.5); paint(ctx, '#d9a441', 1.8);
    roundRect(ctx, -4, -3.6, 2, 7.2, 0.6); paint(ctx, '#a2731a', 1);
    ctx.beginPath(); ctx.moveTo(-8, -1.8); ctx.lineTo(5, -1.8); strokeA(ctx, '#fff', 1, 0.55);
    drawPath(ctx, [7, -3.4, 15.5, 0, 7, 3.4]); paint(ctx, '#d8322a', 1.6);
    gloss(ctx, 9, -1.3, 2, 0.8, 0.2, 0.55);
    ctx.restore();
  }

  // Výbušný granát s doutnákem
  function drawShell(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-18, -3); ctx.lineTo(-9, -3);
    ctx.moveTo(-20, 1); ctx.lineTo(-10, 1);
    ctx.moveTo(-16, 4.5); ctx.lineTo(-9, 4.5);
    strokeA(ctx, '#ffffff', 1.4, 0.35);
    circlePath(ctx, 2, 0, 6.8); paint(ctx, '#2b2b33', 2);
    ellipsePath(ctx, 2, 0, 2.2, 6.6); strokeA(ctx, '#d8322a', 2.2, 1);
    gloss(ctx, -0.4, -2.8, 2.6, 1.5, -0.5, 0.45);
    roundRect(ctx, -6.2, -1.6, 2.4, 3.2, 0.6); paint(ctx, '#d9a441', 1);
    ctx.beginPath(); ctx.moveTo(-6.2, 0); ctx.quadraticCurveTo(-9, -1, -9.5, -3.5);
    strokeA(ctx, '#5a3418', 1.2, 1);
    spark(ctx, -9.8, -4, 2.6);
    ctx.restore();
  }

  TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {
    gryfDart: function (ctx) { drawGryfDart(ctx); },
    rocket: function (ctx) { drawRocket(ctx); },
    shell: function (ctx) { drawShell(ctx); }
  });

  /* =====================================================================
     OBLÉHACÍ MOŽDÍŘ  (poloměr 24 px)
     ===================================================================== */

  // Palety kovů: m = základ, d = stín, l = odlesk
  const MET = {
    bronze: { m: '#b9803a', d: '#7a4c1c', l: '#f0c27a' },
    steel: { m: '#8e98a3', d: '#58616b', l: '#e1e7ec' },
    black: { m: '#3b3b42', d: '#1f1f24', l: '#8a8a98' },
    gold: { m: '#e2b23a', d: '#a2731a', l: '#fff0a8' },
    plat: { m: '#cfd6de', d: '#8f99a5', l: '#ffffff' },
    rune: { m: '#6e40aa', d: '#3f1f6c', l: '#c59cff' }
  };

  // Lebka (ozdoba Otřesné vlny)
  function skull(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    roundRect(ctx, r * 0.2, -r * 0.55, r * 0.9, r * 1.1, r * 0.3); paint(ctx, '#e6dfcf', 1.1);
    circlePath(ctx, 0, 0, r); paint(ctx, '#efe8d8', 1.3);
    circlePath(ctx, r * 0.2, -r * 0.4, r * 0.26); ctx.fillStyle = '#222'; ctx.fill();
    circlePath(ctx, r * 0.2, r * 0.4, r * 0.26); ctx.fill();
    gloss(ctx, -r * 0.35, -r * 0.35, r * 0.35, r * 0.2, -0.5, 0.6);
    ctx.restore();
  }

  // Zlaté slunce (ozdoba Světlice odhalení)
  function sunEmblem(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    starPath(ctx, 0, 0, r * 1.5, r * 0.85, 8, 0); paint(ctx, '#f2c230', 1.1);
    circlePath(ctx, 0, 0, r * 0.85); paint(ctx, '#ffd84a', 1.1);
    gloss(ctx, -r * 0.25, -r * 0.3, r * 0.35, r * 0.2, -0.5, 0.7);
    ctx.restore();
  }

  // Jedna hlaveň shora: ústí míří šikmo vzhůru, proto je kruhové hrdlo posunuté dopředu (+x).
  // o: { band, mouth, glow, stripes, sun, skull, runes, short }
  function mortarBarrel(ctx, x, y, R, M, o) {
    o = o || NO_OPT;
    ctx.save();
    ctx.translate(x, y);
    if (!o.short) {
      ellipsePath(ctx, -R * 0.75, 0, R * 0.85, R * 0.8); paint(ctx, M.d, 2);
      gloss(ctx, -R, -R * 0.4, R * 0.35, R * 0.18, -0.4, 0.3);
    }
    ctx.beginPath();
    ctx.moveTo(o.short ? -R * 0.5 : -R * 0.8, -R * 0.78);
    ctx.lineTo(R * 0.15, -R * 0.96);
    ctx.lineTo(R * 0.15, R * 0.96);
    ctx.lineTo(o.short ? -R * 0.5 : -R * 0.8, R * 0.78);
    ctx.closePath();
    paint(ctx, M.m, 2);
    ctx.beginPath(); ctx.moveTo(o.short ? -R * 0.45 : -R * 0.75, -R * 0.55); ctx.lineTo(R * 0.1, -R * 0.7);
    strokeA(ctx, M.l, R * 0.16, 0.6);
    if (o.stripes) {
      const h = R * 0.32;
      for (let i = 0; i < 6; i++) {
        const yy = -R * 0.95 + i * h;
        ctx.beginPath(); ctx.rect(-R * 0.45, yy, R * 0.32, h);
        ctx.fillStyle = i % 2 ? '#1f1f24' : '#f2c230'; ctx.fill();
      }
      ctx.beginPath(); ctx.rect(-R * 0.45, -R * 0.95, R * 0.32, R * 1.9);
      ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.stroke();
    }
    if (o.skull) skull(ctx, -R * 0.85, 0, R * 0.42);
    if (o.sun) sunEmblem(ctx, -R * 0.8, 0, R * 0.32);
    // ústí
    circlePath(ctx, R * 0.25, 0, R); paint(ctx, o.mouth || M.m, 2.2);
    circlePath(ctx, R * 0.25, 0, R * 0.84); strokeA(ctx, o.band || M.d, R * 0.16, 1);
    ctx.beginPath(); ctx.arc(R * 0.25, 0, R * 0.92, PI * 1.02, PI * 1.62);
    strokeA(ctx, M.l, R * 0.12, 0.85);
    // runy kolem ústí
    if (o.runes) {
      for (let i = 0; i < 4; i++) {
        const a = i * PI / 2 + PI / 4;
        rune(ctx, R * 0.25 + Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84, R * 0.32, o.runes, 70 + i);
      }
    }
    // vývrt
    circlePath(ctx, R * 0.33, 0, R * 0.6); paint(ctx, '#1a1a1e', 1.6);
    circlePath(ctx, R * 0.42, 0, R * 0.38); ctx.fillStyle = '#060608'; ctx.fill();
    if (o.glow) {
      glow(ctx, R * 0.42, 0, R * 0.55, o.glow, 1);
      circlePath(ctx, R * 0.45, 0, R * 0.16); ctx.fillStyle = shade(o.glow, 0.6); ctx.fill();
    }
    ctx.restore();
  }

  // Dřevěná lafeta se dvěma lícnicemi a čepy
  function mortarCarriage(ctx, R, wood, metal) {
    ctx.save();
    woodRect(ctx, -R * 1.5, -R - 1.5, 4, 2 * (R + 1.5), 1.5, wood, 1, false);
    for (let k = -1; k <= 1; k += 2) {
      const y = k * (R + 1.5);
      woodRect(ctx, -R * 1.5, y - 3, R * 2.4, 6, 2, wood, 2, false);
      roundRect(ctx, -R * 0.55, y - 3.6, 3, 7.2, 1); paint(ctx, metal, 1.2);
      roundRect(ctx, R * 0.5, y - 3.6, 2.4, 7.2, 1); paint(ctx, metal, 1.2);
      rivet(ctx, -R * 1.2, y, 1, '#aab3bd');
      circlePath(ctx, -R * 0.15, y, 2.4); paint(ctx, metal, 1.3);
      gloss(ctx, -R * 0.15 - 0.7, y - 0.7, 0.9, 0.6, 0, 0.6);
    }
    ctx.restore();
  }

  // Odpružené písty po stranách (Otřesná vlna)
  function mortarPistons(ctx, R) {
    ctx.save();
    for (let k = -1; k <= 1; k += 2) {
      const y = k * (R + 6.5);
      ctx.beginPath(); ctx.moveTo(R * 0.4, y); ctx.lineTo(R * 0.2, k * (R - 1));
      strokeOutlined(ctx, 1.8, '#8e98a3');
      roundRect(ctx, -R * 1.3, y - 2.6, R * 1.1, 5.2, 2); paint(ctx, '#5d656e', 1.6);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const xx = -R * 1.2 + i * R * 0.27;
        ctx.moveTo(xx, y - 2.4); ctx.lineTo(xx + R * 0.13, y + 2.4);
      }
      strokeA(ctx, '#aab3bd', 0.9, 0.8);
      roundRect(ctx, -R * 0.25, y - 1.4, R * 0.75, 2.8, 1); paint(ctx, '#d3dae1', 1.3);
      rivet(ctx, R * 0.5, y, 1.3, '#8e98a3');
    }
    ctx.restore();
  }

  // Mosazný kvadrant s olovnicí (Přesná muška)
  function mortarQuadrant(ctx, R) {
    ctx.save();
    ctx.translate(-R * 0.6, -(R + 1.5));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 5.5, PI, PI * 1.5); ctx.closePath();
    paint(ctx, '#d9a441', 1.3);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const a = PI + i * PI / 8;
      ctx.moveTo(Math.cos(a) * 3.8, Math.sin(a) * 3.8); ctx.lineTo(Math.cos(a) * 5.2, Math.sin(a) * 5.2);
    }
    strokeA(ctx, '#5a3a10', 0.8, 1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2.6, -2.2); strokeA(ctx, '#f0e6d0', 0.8, 1);
    circlePath(ctx, -2.8, -2.4, 1.1); paint(ctx, '#5d656e', 0.8);
    ctx.restore();
  }

  // Modrofialové očistné plameny z ústí (Rozbíječ pečetí)
  function runeFlames(ctx, x, R, f) {
    ctx.save();
    ctx.translate(x, 0);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = -0.9 + (i / (n - 1)) * 1.8;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(R * 0.35, 0);
      flame3(ctx, R * (0.55 + f * 0.6) + (i % 2) * 2, R * 0.28, '#5b3cff', '#9b7bff', '#d6f0ff');
      ctx.restore();
    }
    glow(ctx, 0, 0, R * 0.8, '#8a7bff', 0.5 + f * 0.5);
    ctx.restore();
  }

  // Víceúrovňové hlavně (cesta 2: Dvojhlavňový, Baterie, Pán hromové palby)
  function mortarMulti(ctx, t, f, rc, c) {
    ctx.save();
    const oo = c >= 2 ? { short: true, mouth: '#b8322a' } : { short: true };
    if (t === 3) {
      gearPath(ctx, 0, 0, 16, 20, 2); paint(ctx, '#6f767f', 1.8);
      circlePath(ctx, 0, 0, 13); paint(ctx, '#4b5058', 1.4);
      gloss(ctx, -5, -7, 5, 2, -0.6, 0.2);
      ctx.translate(rc, 0);
      roundRect(ctx, -12, -3, 12, 6, 2); paint(ctx, '#3b3f46', 1.5);
      rivet(ctx, -9, 0, 1.2, '#aab3bd');
      mortarBarrel(ctx, 0, -7.2, 7, MET.steel, oo);
      mortarBarrel(ctx, 0, 7.2, 7, MET.steel, oo);
      muzzleBlast(ctx, 7 * 0.42, -7.2, 4.5, f);
      muzzleBlast(ctx, 7 * 0.42, 7.2, 4.5, f);
    } else if (t === 4) {
      // automatický pásový podavač: bedna vzadu + pás nábojů
      roundRect(ctx, -23, -6.5, 9, 13, 1.5); paint(ctx, '#4b5058', 1.7);
      ctx.beginPath(); ctx.rect(-22, -2, 7, 4); ctx.fillStyle = '#f2c230'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-21, -2); ctx.lineTo(-19, 2); ctx.moveTo(-18, -2); ctx.lineTo(-16, 2);
      strokeA(ctx, '#1f1f24', 1.2, 1);
      gearPath(ctx, 0, 0, 16, 20, 2); paint(ctx, '#6f767f', 1.8);
      circlePath(ctx, 0, 0, 13); paint(ctx, '#4b5058', 1.4);
      ctx.translate(rc, 0);
      for (let i = 0; i < 6; i++) {
        const tt = i / 5;
        const px = -14 + tt * 9, py = 4 + Math.sin(tt * PI) * 4 + tt * 3;
        circlePath(ctx, px, py, 1.7); paint(ctx, '#d9a441', 0.9);
      }
      mortarBarrel(ctx, -5, -7.5, 6.2, MET.steel, oo);
      mortarBarrel(ctx, -5, 7.5, 6.2, MET.steel, oo);
      mortarBarrel(ctx, 7, 0, 6.2, MET.steel, oo);
      muzzleBlast(ctx, -5 + 2.6, -7.5, 4, f);
      muzzleBlast(ctx, -5 + 2.6, 7.5, 4, f);
      muzzleBlast(ctx, 7 + 2.6, 0, 4, f);
    } else {
      // zlato-platinová čtyřhlavňová pevnost
      roundRect(ctx, -16, -16, 32, 32, 6); paint(ctx, '#cfd6de', 2);
      roundRect(ctx, -13.5, -13.5, 27, 27, 4.5); strokeA(ctx, '#e2b23a', 1.6, 1);
      gloss(ctx, -8, -12, 7, 1.6, 0, 0.35);
      for (let i = 0; i < 4; i++) {
        const px = i % 2 ? 15 : -15, py = i < 2 ? -15 : 15;
        circlePath(ctx, px, py, 3.6); paint(ctx, '#e2b23a', 1.4);
        circlePath(ctx, px, py, 1.6); paint(ctx, '#8f99a5', 1);
        puff(ctx, px + (px > 0 ? 3 : -3), py + (py > 0 ? 3 : -3), 2 + f * 2, 0.35 + f * 0.3);
      }
      ctx.translate(rc, 0);
      const P = [-4.5, -6.5, -4.5, 6.5, 5, -6.5, 5, 6.5];
      for (let i = 0; i < 8; i += 2) {
        mortarBarrel(ctx, P[i], P[i + 1], 5.8, i < 4 ? MET.plat : MET.gold, { short: true, band: '#e2b23a', glow: '#6fd8ff' });
      }
      // modré blesky kolem ústí
      ctx.save();
      ctx.globalAlpha *= 0.55 + f * 0.45;
      const mx = [-4.5 + 2.4, -4.5 + 2.4, 5 + 2.4, 5 + 2.4], my = [-6.5, 6.5, -6.5, 6.5];
      lightning(ctx, mx[0], my[0] - 5, mx[2], my[2] - 5, 801, '#5fc8ff', 1.1);
      lightning(ctx, mx[1], my[1] + 5, mx[3], my[3] + 5, 802, '#5fc8ff', 1.1);
      lightning(ctx, mx[2] + 5, my[2], mx[3] + 5, my[3], 803, '#5fc8ff', 1.1);
      lightning(ctx, mx[2] + 4, my[2] - 4, mx[2] + 11, my[2] - 9, 804, '#5fc8ff', 1);
      lightning(ctx, mx[3] + 4, my[3] + 4, mx[3] + 11, my[3] + 9, 805, '#5fc8ff', 1);
      ctx.restore();
      for (let i = 0; i < 8; i += 2) muzzleBlast(ctx, P[i] + 2.4, P[i + 1], 3.6, f);
    }
    ctx.restore();
  }

  // Démonická sopečná baterie ve tvaru dračí tlamy (Popelavý soud)
  function dragonMortar(ctx, f, rc) {
    ctx.save();
    ctx.translate(rc, 0);
    // skalnaté tělo baterie
    const rocks = [-12, -9, 6, -14, 8, 6.5, -17, 0, 7];
    for (let i = 0; i < rocks.length; i += 3) {
      circlePath(ctx, rocks[i], rocks[i + 1], rocks[i + 2]); paint(ctx, '#3b2b27', 1.8);
      gloss(ctx, rocks[i] - 2, rocks[i + 1] - 2, 2.4, 1.2, -0.6, 0.18);
    }
    lightning(ctx, -20, -2, -11, -10, 901, '#ff6a1a', 1);
    lightning(ctx, -19, 3, -12, 11, 902, '#ff6a1a', 1);
    // rohy
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(-6, 6 * k);
      ctx.quadraticCurveTo(-14, 13 * k, -23, 15 * k);
      ctx.quadraticCurveTo(-13, 9 * k, -3, 3.5 * k);
      ctx.closePath();
      paint(ctx, '#e6dcc4', 1.6);
    }
    // hlava
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(0, -13, 9, -9.5);
    ctx.quadraticCurveTo(18.5, -8, 18.5, 0);
    ctx.quadraticCurveTo(18.5, 8, 9, 9.5);
    ctx.quadraticCurveTo(0, 13, -9, 8);
    ctx.quadraticCurveTo(-13, 0, -9, -8);
    ctx.closePath();
    paint(ctx, '#4a2a24', 2.2);
    gloss(ctx, -1, -7, 6, 2, -0.2, 0.18);
    // hřbetní trny
    for (let x = -9; x <= 1; x += 3.4) {
      drawPath(ctx, [x - 1.8, -1.6, x + 2.2, 0, x - 1.8, 1.6]); paint(ctx, '#2a1612', 1);
    }
    lightning(ctx, -6, -5, 3, -8, 903, '#ff7a1a', 0.9);
    lightning(ctx, -6, 5, 3, 8, 904, '#ff7a1a', 0.9);
    // oči
    for (let k = -1; k <= 1; k += 2) {
      glow(ctx, 3, 6.8 * k, 3.4, '#ffb02a', 0.7);
      ellipsePath(ctx, 3, 6.8 * k, 2.4, 1.2, 0.4 * k); paint(ctx, '#ffcf3a', 1);
      ctx.beginPath(); ctx.moveTo(3, 6.8 * k - 1); ctx.lineTo(3, 6.8 * k + 1); strokeA(ctx, OUT, 0.8, 1);
    }
    // otevřená žhnoucí tlama (ústí)
    ellipsePath(ctx, 11, 0, 6.5, 7.5); paint(ctx, '#5a1010', 2);
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10;
      const cx = 11 + Math.cos(a) * 6.2, cy = Math.sin(a) * 7.2;
      const ix = 11 + Math.cos(a) * 4.4, iy = Math.sin(a) * 5.2;
      const px = -Math.sin(a) * 1.1, py = Math.cos(a) * 1.1;
      drawPath(ctx, [cx + px, cy + py, ix, iy, cx - px, cy - py]);
      paint(ctx, '#f4eedc', 0.7);
    }
    ellipsePath(ctx, 11.5, 0, 4.2, 5); ctx.fillStyle = '#ff6a1a'; ctx.fill();
    ellipsePath(ctx, 12, 0, 2.8, 3.4); ctx.fillStyle = '#ffd23a'; ctx.fill();
    circlePath(ctx, 12.3, 0, 1.4); ctx.fillStyle = '#fff4c0'; ctx.fill();
    glow(ctx, 12, 0, 9 + 4 * f, '#ff7a1a', 0.35 + 0.5 * f);
    // lávové meteory při výstřelu
    if (f > 0) {
      for (let i = 0; i < 4; i++) {
        const a = -0.7 + i * 0.47;
        const d = 8 + (1 - f) * 12;
        const mx = 12 + Math.cos(a) * d, my = Math.sin(a) * d;
        circlePath(ctx, mx, my, 2.4 * f + 0.8); paint(ctx, '#ff8a1a', 1);
        circlePath(ctx, mx - 0.5, my - 0.5, 1 * f + 0.3); ctx.fillStyle = '#ffe36a'; ctx.fill();
      }
    }
    ctx.restore();
  }

  // Hromádka dělových koulí (větší ráže / špičaté granáty / smola)
  function ballPile(ctx, x, y, a, b, c) {
    ctx.save();
    ctx.translate(x, y);
    const r = a >= 1 ? 3.7 : 3.1;
    const pos = [-2.8, 2, 3, 2.6, 0, -2.2];
    for (let i = 0; i < pos.length; i += 2) {
      const px = pos[i], py = pos[i + 1];
      if (b >= 2) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.6 + i * 0.3);
        drawPath(ctx, [r * 0.3, -r * 0.8, r * 1.5, 0, r * 0.3, r * 0.8]); paint(ctx, '#2b2b31', 1.3);
        roundRect(ctx, -r, -r * 0.8, r * 1.5, r * 1.6, r * 0.7); paint(ctx, '#2b2b31', 1.4);
        roundRect(ctx, -r * 0.2, -r * 0.85, 1.3, r * 1.7, 0.4); paint(ctx, '#d9a441', 0.8);
        gloss(ctx, -r * 0.3, -r * 0.4, r * 0.5, r * 0.22, 0, 0.45);
        ctx.restore();
      } else {
        circlePath(ctx, px, py, r); paint(ctx, c >= 2 ? '#1c1410' : '#2b2b31', 1.5);
        gloss(ctx, px - r * 0.35, py - r * 0.35, r * 0.4, r * 0.25, -0.6, 0.5);
      }
      if (c >= 2) {
        // napuštěné smolou – oranžové žhavé skvrny a kapky
        circlePath(ctx, px + r * 0.35, py + r * 0.3, r * 0.28); fillA(ctx, '#ff8a1a', 0.9);
        ellipsePath(ctx, px + r * 0.1, py + r * 1.05, r * 0.25, r * 0.4); paint(ctx, '#1c1410', 0.7);
      }
    }
    ctx.restore();
  }

  TDS.drawers.oblehaci_mozdir = {
    // Podstavec: osmiúhelníková kamenná plošina s dřevěnou palubou a municí
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      ctx.save();
      // sopečná půda (Popelavý soud)
      if (m.p === 2 && m.t >= 5) {
        circlePath(ctx, 0, 0, 31); fillA(ctx, '#2a1410', 0.45);
        for (let i = 0; i < 7; i++) {
          const an = i * TAU / 7 + 0.4;
          lightning(ctx, Math.cos(an) * 18, Math.sin(an) * 18, Math.cos(an + 0.2) * 33, Math.sin(an + 0.2) * 33, 600 + i, '#ff5a1a', 1.4);
        }
      }
      // praskající země (Kladivo nebes)
      if (m.p === 0 && m.t >= 5) {
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + 0.15;
          lightning(ctx, Math.cos(an) * 20, Math.sin(an) * 20, Math.cos(an - 0.15) * 34, Math.sin(an - 0.15) * 34, 650 + i, '#ffb02a', 1.4);
        }
      }
      softShadow(ctx, 0, 0, 22, 21);
      let stone = '#8f8a82', deck = '#9c6636', woodDeck = true;
      if (m.p === 0 && m.t === 3) { stone = '#7d858e'; deck = '#6b737c'; woodDeck = false; }
      if (m.p === 0 && m.t === 4) { stone = '#36363c'; deck = '#55555e'; woodDeck = false; }
      if (m.p === 0 && m.t >= 5) { stone = '#26262b'; deck = '#3a3a42'; woodDeck = false; }
      if (m.p === 1 && m.t >= 5) { stone = '#c3cad3'; deck = '#a9b2bd'; woodDeck = false; }
      if (m.p === 2 && m.t === 4) { stone = '#4c3a6e'; deck = '#5e4785'; woodDeck = false; }
      if (m.p === 2 && m.t >= 5) { stone = '#3b2b27'; deck = '#2b1d19'; woodDeck = false; }
      // železné skoby zaražené do země (Drtivý dopad)
      if (a >= 2) {
        for (let i = 0; i < 6; i++) {
          const an = i * TAU / 6 + 0.25;
          ctx.save();
          ctx.rotate(an);
          drawPath(ctx, [19, -2.4, 27, 0, 19, 2.4]); paint(ctx, '#4b5058', 1.4);
          circlePath(ctx, 19.5, 0, 2.2); paint(ctx, '#7c838c', 1.2);
          ctx.restore();
        }
      }
      octaPlatform(ctx, 21.5, 15.5, stone, 202);
      polyPath(ctx, 0, 0, 15.5, 8, PI / 8); paint(ctx, deck, 1.6);
      if (woodDeck) {
        ctx.beginPath();
        for (let x = -10.5; x <= 10.5; x += 3.5) {
          const h = Math.sqrt(14.3 * 14.3 - x * x) * 0.92;
          ctx.moveTo(x, -h); ctx.lineTo(x, h);
        }
        strokeA(ctx, shade(deck, -0.4), 1, 0.9);
      } else {
        polyPath(ctx, 0, 0, 12.5, 8, PI / 8); strokeA(ctx, shade(deck, -0.35), 1.2, 1);
      }
      gloss(ctx, -6, -9, 6, 2, -0.6, 0.18);
      for (let i = 0; i < 8; i++) {
        const an = PI / 8 + i * TAU / 8;
        rivet(ctx, Math.cos(an) * 18.5, Math.sin(an) * 18.5, 1.3, m.p === 0 && m.t >= 5 ? '#e2b23a' : '#9aa2ab');
      }
      // černo-žluté výstražné pruhy (Drsňák)
      if (m.p === 0 && m.t === 4) {
        for (let i = 0; i < 16; i++) {
          const a0 = i * TAU / 16;
          ctx.beginPath(); ctx.arc(0, 0, 17.4, a0 + 0.04, a0 + TAU / 16 - 0.04);
          strokeA(ctx, i % 2 ? '#1f1f24' : '#f2c230', 2.6, 1);
        }
      }
      // zlaté lemování (Kladivo nebes, Pán hromové palby)
      if ((m.p === 0 && m.t >= 5) || (m.p === 1 && m.t >= 5)) {
        polyPath(ctx, 0, 0, 20.4, 8, PI / 8); strokeA(ctx, '#e2b23a', 1.6, 1);
      }
      // runové kameny (Rozbíječ pečetí)
      if (m.p === 2 && m.t === 4) {
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2 + PI / 4 + PI / 8;
          rune(ctx, Math.cos(an) * 18.4, Math.sin(an) * 18.4, 4.6, '#b58cff', 40 + i);
        }
      }
      // lávové praskliny v palubě (Popelavý soud)
      if (m.p === 2 && m.t >= 5) {
        lightning(ctx, -12, -6, 12, -9, 911, '#ff6a1a', 1.1);
        lightning(ctx, -10, 9, 11, 6, 912, '#ff6a1a', 1.1);
      }
      // otočný ozubený věnec (cesta 2)
      if (m.p === 1 && m.t >= 3) {
        circlePath(ctx, 0, 0, 17.2); paint(ctx, '#3b3f46', 1.6);
      }
      // munice
      ballPile(ctx, -14, 12, a, b, c);
      // dřevěný skluz a nabiják (Rychlé nabíjení)
      if (b >= 1) {
        ctx.save();
        ctx.translate(13.5, -13.5);
        ctx.rotate(-PI / 4);
        woodRect(ctx, -9, -3, 18, 6, 2, '#a0693a', 1, false);
        roundRect(ctx, -8, -1.5, 16, 3, 1); ctx.fillStyle = '#5a3a1e'; ctx.fill();
        circlePath(ctx, -3.5, 0, 1.9); paint(ctx, '#2b2b31', 0.9);
        circlePath(ctx, 2.5, 0, 1.9); paint(ctx, '#2b2b31', 0.9);
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(-19, -7); ctx.lineTo(-7, -19.5);
        strokeOutlined(ctx, 1.6, '#b9824a');
        circlePath(ctx, -6.5, -20, 2.6); paint(ctx, '#5a3418', 1.3);
      }
      // naviják na granáty (Drsňák a výš)
      if (m.p === 0 && m.t >= 4) {
        ctx.save();
        ctx.translate(14, 13);
        ctx.rotate(-0.6);
        roundRect(ctx, -6, -3.5, 12, 7, 2); paint(ctx, m.t >= 5 ? '#e2b23a' : '#f2c230', 1.6);
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.rect(i * 3.6 - 0.8, -3.4, 1.6, 6.8); ctx.fillStyle = '#1f1f24'; ctx.fill(); }
        roundRect(ctx, -7.5, -4.5, 2, 9, 0.8); paint(ctx, '#3b3b42', 1.2);
        roundRect(ctx, 5.5, -4.5, 2, 9, 0.8); paint(ctx, '#3b3b42', 1.2);
        ctx.beginPath(); ctx.moveTo(7.5, 0); ctx.lineTo(10, 3); strokeOutlined(ctx, 1.2, '#9aa2ab');
        circlePath(ctx, 0, 8, 3); paint(ctx, '#26262c', 1.4);
        ctx.beginPath(); ctx.moveTo(0, 3.5); ctx.lineTo(0, 5); strokeA(ctx, '#d9c9a8', 1, 1);
        ctx.restore();
      }
      // bedna s magickými světlicemi (Světlice odhalení, Rozbíječ pečetí)
      if (c >= 3 && c < 5) {
        ctx.save();
        ctx.translate(14, 13);
        ctx.rotate(0.2);
        woodRect(ctx, -6, -5, 12, 10, 1.5, '#9c6636', 3, true);
        const fx = [-3, 0, 3], fy = [-1, 1.2, -1];
        for (let i = 0; i < 3; i++) {
          glow(ctx, fx[i], fy[i], 4.2, '#fff3a0', 0.9);
          circlePath(ctx, fx[i], fy[i], 1.6); paint(ctx, '#d8322a', 0.9);
          circlePath(ctx, fx[i], fy[i], 0.8); ctx.fillStyle = '#fffbe0'; ctx.fill();
        }
        ctx.restore();
      }
      // parní ventily (Pán hromové palby)
      if (m.p === 1 && m.t >= 5) {
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2;
          const px = Math.cos(an) * 18.5, py = Math.sin(an) * 18.5;
          circlePath(ctx, px, py, 2.2); paint(ctx, '#e2b23a', 1.2);
          puff(ctx, px + 2, py - 2, 2.6, 0.4);
        }
      }
      ctx.restore();
    },

    // Věž: moždíř na lafetě, ústí míří k +x; s.firing = zákluz a záblesk
    turret: function (ctx, up, s) {
      s = s || NO_OPT;
      const f = s.firing || 0;
      const a = lv(up, 0), c = lv(up, 2), m = mainPath(up);
      const rc = -f * 2.5;   // zákluz
      ctx.save();
      if (s.buffed) buffAura(ctx, 21);
      ellipsePath(ctx, 1.5, 2, 15, 14); fillA(ctx, '#000', 0.14);
      if (m.p === 1 && m.t >= 3) {
        mortarMulti(ctx, m.t, f, rc, c);
      } else if (m.p === 2 && m.t >= 5) {
        dragonMortar(ctx, f, rc);
      } else {
        let R = 8.5, M = MET.bronze, wood = '#9c6636', metal = '#5d6066', pistons = false;
        const o = {};
        if (a >= 1) { R = 9.5; o.band = '#e2a64a'; }
        if (c >= 2) o.mouth = '#b8322a';
        if (m.p === 0 && m.t === 3) { R = 10; M = MET.steel; o.skull = true; pistons = true; wood = '#6f767f'; metal = '#3b3f46'; }
        if (m.p === 0 && m.t === 4) { R = 11; M = MET.black; o.stripes = true; o.band = '#f2c230'; wood = '#2e2e33'; metal = '#f2c230'; }
        if (m.p === 0 && m.t >= 5) { R = 12; M = MET.black; o.band = '#e2b23a'; o.glow = '#ff7a1a'; o.runes = '#ffb02a'; wood = '#26262b'; metal = '#e2b23a'; }
        if (m.p === 2 && m.t === 3) { R = 10; o.sun = true; o.band = '#e2b23a'; }
        if (m.p === 2 && m.t === 4) { R = 10.5; M = MET.rune; o.band = '#e2b23a'; o.glow = '#8a7bff'; o.runes = '#c59cff'; wood = '#3f2a5e'; metal = '#e2b23a'; o.mouth = null; }
        ctx.save();
        ctx.translate(rc, 0);
        if (pistons) mortarPistons(ctx, R);
        mortarCarriage(ctx, R, wood, metal);
        mortarBarrel(ctx, 0, 0, R, M, o);
        if (c >= 1 && !(m.p === 2 && m.t >= 4)) mortarQuadrant(ctx, R);
        if (m.p === 0 && m.t >= 5) {
          // žhnoucí runy na lícnicích
          rune(ctx, -R * 0.9, -(R + 1.5), 4, '#ffb02a', 31);
          rune(ctx, -R * 0.9, R + 1.5, 4, '#ffb02a', 32);
        }
        ctx.restore();
        if (m.p === 2 && m.t === 4) runeFlames(ctx, R * 0.42 + rc, R, f);
        muzzleBlast(ctx, R * 0.42 + rc, 0, R * 0.7, f);
      }
      ctx.restore();
    }
  };

  // Terč dopadu na zemi
  function drawTarget(ctx, r, sel, ts) {
    ctx.save();
    const p = 0.5 + 0.5 * Math.sin(ts * 0.006);
    const col = '#e8392b';
    const ga = ctx.globalAlpha;
    circlePath(ctx, 0, 0, r); fillA(ctx, col, sel ? 0.16 : 0.08);
    if (sel) { circlePath(ctx, 0, 0, r + 3); strokeA(ctx, '#ff8a6a', 6, 0.15 + p * 0.2); }
    // vnější čárkovaný kruh
    ctx.setLineDash(DASH_TARGET);
    ctx.lineDashOffset = -ts * 0.02;
    circlePath(ctx, 0, 0, r);
    ctx.lineWidth = 4.2; ctx.strokeStyle = OUT; ctx.globalAlpha = ga * 0.45; ctx.stroke();
    ctx.lineWidth = 2.2; ctx.strokeStyle = col; ctx.globalAlpha = ga; ctx.stroke();
    ctx.setLineDash(DASH_NONE);
    // vnitřní kruh
    circlePath(ctx, 0, 0, r * 0.5);
    strokeA(ctx, OUT, 3.4, 0.4);
    strokeA(ctx, col, 1.6, 0.85);
    // klínky mířící do středu
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * PI / 2 + PI / 4);
      const d = r * (0.62 + 0.12 * p);
      drawPath(ctx, [d + 7, -4, d, 0, d + 7, 4]);
      paint(ctx, col, 1.5);
      ctx.restore();
    }
    // kříž
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, 0); ctx.lineTo(r * 0.3, 0);
    ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.3);
    strokeA(ctx, OUT, 3.2, 0.6);
    strokeA(ctx, '#fff', 1.3, 0.9);
    circlePath(ctx, 0, 0, 3); paint(ctx, col, 1.5);
    ctx.restore();
  }

  // Velká litinová puma s kouřovou stopou
  function drawMortarShell(ctx) {
    ctx.save();
    for (let i = 4; i >= 0; i--) puff(ctx, -3 - i * 3.6, i % 2 ? 1.3 : -1.3, 3 + i * 0.7, 0.55 - i * 0.09);
    circlePath(ctx, 8, 0, 8.5); paint(ctx, '#2a2a30', 2.2);
    ellipsePath(ctx, 8, 0, 2.6, 8.3); strokeA(ctx, '#55555f', 1.6, 1);
    gloss(ctx, 5, -3.4, 3.4, 2, -0.5, 0.45);
    circlePath(ctx, 4, -4.6, 0.9); fillA(ctx, '#fff', 0.9);
    roundRect(ctx, -1.6, -1.6, 2.6, 3.2, 0.6); paint(ctx, '#d9a441', 1);
    spark(ctx, -2.5, -2.4, 2.6);
    ctx.restore();
  }

  /*
   * TDS.oblehaci_mozdirExtra(ctx, kind, x, y, ang, ts, s)
   *  kind = 'target'      – terč dopadu na zemi; s.r = poloměr výbuchu (px), s.sel = věž je vybraná (výraznější)
   *  kind = 'shadow'      – stín letícího granátu na zemi; s.h = výška oblouku 0–1 (výš = menší a slabší)
   *  kind = 'mortarShell' – granát natočený podle ang; s.h = 0–1 zvětší granát ve vrcholu oblouku
   */
  TDS.oblehaci_mozdirExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || NO_OPT;
    ts = ts || 0;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'target') {
      drawTarget(ctx, s.r || 36, !!s.sel, ts);
    } else if (kind === 'shadow') {
      const h = s.h || 0;
      ellipsePath(ctx, 0, 0, 8 * (1 - h * 0.45), 5 * (1 - h * 0.45));
      fillA(ctx, '#000', 0.3 - h * 0.15);
    } else if (kind === 'mortarShell') {
      ctx.rotate(ang || 0);
      const k = 1 + (s.h || 0) * 0.6;
      ctx.scale(k, k);
      drawMortarShell(ctx);
    }
    ctx.restore();
  };

  TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {
    mortarShell: function (ctx) { drawMortarShell(ctx); }
  });

  /* =====================================================================
     TRPASLIČÍ INŽENÝR  (poloměr 19 px)
     ===================================================================== */

  // Hřebíkomet v ruce (y = výška ruky). Styl: basic | heavy | brass | gold
  function nailGun(ctx, y, st, goldNails, f) {
    ctx.save();
    ctx.translate(3.5, y);
    const sg = y < 0 ? -1 : 1;
    const big = st === 'brass' || st === 'gold';
    const heavy = st === 'heavy';
    const body = st === 'brass' ? '#d29a3c' : st === 'gold' ? '#ecc048' : heavy ? '#6c757f' : '#87919b';
    const len = big ? 11 : heavy ? 10 : 8.5;
    const h = big ? 5.4 : heavy ? 4.4 : 3.6;
    const bl = heavy ? 7 : big ? 6 : 5;
    // hlaveň
    roundRect(ctx, len - 1.5, -h * 0.28, bl, h * 0.56, 0.8); paint(ctx, '#5c636b', 1.3);
    if (heavy) {
      for (let i = 0; i < 2; i++) { roundRect(ctx, len + 0.8 + i * 2.6, -h * 0.38, 1.3, h * 0.76, 0.4); paint(ctx, '#aab3bd', 0.9); }
    }
    if (big) { roundRect(ctx, len + bl - 3.2, -h * 0.4, 2.2, h * 0.8, 0.6); paint(ctx, body, 1); }
    // tělo
    roundRect(ctx, -1, -h / 2, len, h, h * 0.4); paint(ctx, body, 1.6);
    ctx.beginPath(); ctx.moveTo(0.5, -h / 2 + 0.9); ctx.lineTo(len - 2.5, -h / 2 + 0.9);
    strokeA(ctx, '#fff', 0.9, 0.5);
    // tlaková nádobka
    circlePath(ctx, len * 0.35, 0, h * 0.42); paint(ctx, '#c8763a', 1.1);
    gloss(ctx, len * 0.35 - h * 0.12, -h * 0.14, h * 0.15, h * 0.1, 0, 0.7);
    if (big) {
      circlePath(ctx, len * 0.75, 0, 1.4); paint(ctx, '#f4f1ea', 0.8);
      ctx.beginPath(); ctx.moveTo(len * 0.75, 0); ctx.lineTo(len * 0.75 + 0.9, -0.8); strokeA(ctx, '#d8322a', 0.7, 1);
    }
    // pásový zásobník s hřeby
    if (heavy || st === 'gold') {
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const px = len * 0.45 - t * 9, py = (h / 2 + 1.2 + t * t * 5) * sg;
        circlePath(ctx, px, py, 1.05);
        paint(ctx, goldNails ? '#f2c230' : '#c9d0d6', 0.8);
      }
    }
    // záblesk a pára
    if (f > 0) {
      const mx = len - 1.5 + bl + 1.5;
      muzzleBlast(ctx, mx, 0, 2.6, f);
      puff(ctx, mx - 3, -3 * f * sg, 1 + 2 * f, 0.4 * f);
    }
    ctx.restore();
  }

  // Francouzský klíč
  function wrench(ctx, x, y, ang, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    roundRect(ctx, 0, -0.9, 8, 1.8, 0.8); paint(ctx, col || '#aab3bd', 1.1);
    circlePath(ctx, 8.5, 0, 2.3); paint(ctx, col || '#aab3bd', 1.2);
    roundRect(ctx, 8.5, -0.8, 2.6, 1.6, 0.3); ctx.fillStyle = OUT; ctx.fill();
    ctx.restore();
  }

  // Parní kotlík s tlakoměrem a měděnými trubkami na zádech
  function engBoiler(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-7, 3.5); ctx.quadraticCurveTo(-3, 10, 3, 7.5);
    strokeOutlined(ctx, 1.4, '#c8763a');
    ctx.beginPath(); ctx.moveTo(-7, -3.5); ctx.quadraticCurveTo(-4, -8, 0, -8);
    strokeOutlined(ctx, 1.4, '#c8763a');
    roundRect(ctx, -14, -5, 8, 10, 3.2); paint(ctx, '#c8763a', 1.8);
    roundRect(ctx, -14, -1, 8, 2, 0.6); paint(ctx, '#8a4a20', 0.9);
    rivet(ctx, -12.5, -3.5, 0.8, '#e0a070'); rivet(ctx, -12.5, 3.5, 0.8, '#e0a070');
    gloss(ctx, -11, -3.2, 2.4, 1, -0.3, 0.45);
    circlePath(ctx, -10, 0, 2.4); paint(ctx, '#f4f1ea', 1);
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-8.6, -1.4); strokeA(ctx, '#d8322a', 0.8, 1);
    puff(ctx, -15, -5, 2, 0.35);
    ctx.restore();
  }

  // Elektrická cívka sršící modré blesky (Přetaktování)
  function engCoil(ctx) {
    ctx.save();
    circlePath(ctx, -10, 0, 5); paint(ctx, '#3b3f46', 1.8);
    for (let r = 4.2; r > 1.5; r -= 1.1) { circlePath(ctx, -10, 0, r); strokeA(ctx, '#d0843f', 0.9, 1); }
    lightning(ctx, -10, 0, -18, -6, 951, '#5fc8ff', 1);
    lightning(ctx, -10, 0, -19, 4, 952, '#5fc8ff', 1);
    lightning(ctx, -10, 0, -11, 9.5, 953, '#5fc8ff', 0.9);
    glow(ctx, -10, 0, 3.6, '#5fc8ff', 1);
    circlePath(ctx, -10, 0, 1.8); paint(ctx, '#d6f4ff', 1);
    ctx.restore();
  }

  // Levitující jádro čisté energie (Ultrataktování)
  function engCore(ctx, x, y) {
    ctx.save();
    glow(ctx, x, y, 8, '#5fe8ff', 1);
    drawPath(ctx, [x, y - 4.5, x + 3.4, y, x, y + 4.5, x - 3.4, y]);
    paint(ctx, '#bdf6ff', 1.3);
    drawPath(ctx, [x, y - 4.5, x + 3.4, y, x, y]); fillA(ctx, '#fff', 0.5);
    ellipsePath(ctx, x, y, 6, 2.2, 0.5); strokeA(ctx, '#ecc048', 1.1, 1);
    ctx.restore();
  }

  // Plášť (mistr konstruktér / technomág)
  function engCloak(ctx, col, trim) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-1, -7);
    ctx.quadraticCurveTo(-10, -10.5, -14, -6.5);
    ctx.quadraticCurveTo(-16, 0, -14, 6.5);
    ctx.quadraticCurveTo(-10, 10.5, -1, 7);
    ctx.closePath();
    paint(ctx, col, 1.8);
    ctx.beginPath();
    ctx.moveTo(-13, -6); ctx.quadraticCurveTo(-15, 0, -13, 6);
    strokeA(ctx, trim, 1.4, 1);
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-12, -4.5); ctx.moveTo(-4, 4); ctx.lineTo(-12, 4.5);
    strokeA(ctx, '#000', 1, 0.2);
    gloss(ctx, -8, -5.5, 4, 1.1, 0, 0.22);
    ctx.restore();
  }

  // Mosazná výsuvná anténa s čočkou
  function engAntenna(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-1.5, -3); ctx.lineTo(-9, -10.5);
    strokeOutlined(ctx, 1.1, '#d9a441');
    rivet(ctx, -4, -5.5, 0.8, '#e8c070');
    rivet(ctx, -6.6, -8, 0.7, '#e8c070');
    circlePath(ctx, -9.6, -11, 2.3); paint(ctx, '#d9a441', 1.2);
    circlePath(ctx, -9.6, -11, 1.5); ctx.fillStyle = '#9fe8ff'; ctx.fill();
    gloss(ctx, -10.1, -11.5, 0.6, 0.4, 0, 0.9);
    ctx.restore();
  }

  // Těžké štípací kleště u pasu
  function engPliers(ctx) {
    ctx.save();
    ctx.translate(-5.5, -7.5);
    ctx.rotate(-0.5);
    ctx.beginPath(); ctx.moveTo(-4, -1.2); ctx.lineTo(3, 0.6); ctx.moveTo(-4, 1.2); ctx.lineTo(3, -0.6);
    strokeOutlined(ctx, 1.3, '#d8322a');
    drawPath(ctx, [3, -1.6, 6.5, -0.4, 6.5, 0.4, 3, 1.6]); paint(ctx, '#8d949c', 1.1);
    rivet(ctx, 2.6, 0, 0.8, '#c9d0d6');
    ctx.restore();
  }

  // Křížový nábojový pás přes hruď
  function engBandolier(ctx, gold) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-5, -6.5); ctx.lineTo(2.5, 6.5); ctx.moveTo(-5, 6.5); ctx.lineTo(2.5, -6.5);
    strokeOutlined(ctx, 1.7, '#6b3e1e');
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.23;
      circlePath(ctx, -5 + 7.5 * t, -6.5 + 13 * t, 0.85); paint(ctx, gold ? '#f2c230' : '#c9d0d6', 0.6);
      circlePath(ctx, -5 + 7.5 * t, 6.5 - 13 * t, 0.85); paint(ctx, gold ? '#f2c230' : '#c9d0d6', 0.6);
    }
    ctx.restore();
  }

  // Trpaslík shora, hledí k +x
  function drawDwarf(ctx, up, f) {
    const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
    const master = m.p === 0 && m.t >= 4;
    const arch = m.p === 0 && m.t >= 5;
    const mage = m.p === 1 && m.t >= 5;
    const forge = m.p === 2 && m.t >= 5;
    let tunic = '#b5452f';
    if (master) tunic = arch ? '#5b2d8e' : '#2c56b8';
    if (mage) tunic = '#2a2f6e';
    if (forge) tunic = '#7a4a1e';
    const skin = '#f1c08f';
    ctx.save();
    ellipsePath(ctx, 1.5, 2, 10, 10.5); fillA(ctx, '#000', 0.16);
    // výbava na zádech
    if (mage) engCore(ctx, -12, 0);
    else if (b >= 4) engCoil(ctx);
    else if (a >= 2) engBoiler(ctx);
    // plášť
    if (master || mage) engCloak(ctx, tunic, '#ecc048');

    // levá ruka (−y)
    if (c >= 3) {
      ctx.beginPath(); ctx.moveTo(-0.5, -6); ctx.lineTo(5.8, -5.2); strokeOutlined(ctx, 2.8, tunic);
      nailGun(ctx, -5.2, 'heavy', c >= 2, f);
      circlePath(ctx, 5.8, -5.2, 1.9); paint(ctx, skin, 1.1);
    } else if (master) {
      // mechanická ruka s klíčem
      ctx.beginPath(); ctx.moveTo(-0.5, -6.5); ctx.lineTo(3, -10); ctx.lineTo(7.5, -7);
      strokeOutlined(ctx, 2.2, '#d29a3c');
      rivet(ctx, 3, -10, 1.4, '#e8c070');
      wrench(ctx, 7.5, -7, 0.2, '#ecc048');
      drawPath(ctx, [7, -8.5, 9.5, -8.2, 9.8, -7.2], false); strokeOutlined(ctx, 0.8, '#aab3bd');
      drawPath(ctx, [7, -5.5, 9.5, -5.8, 9.8, -6.8], false); strokeOutlined(ctx, 0.8, '#aab3bd');
    } else if (b >= 4) {
      ctx.beginPath(); ctx.moveTo(-0.5, -6); ctx.lineTo(5.8, -5.2); strokeOutlined(ctx, 2.8, tunic);
      roundRect(ctx, 5, -7.2, 5.5, 4, 1); paint(ctx, '#ecc048', 1.3);
      circlePath(ctx, 6.8, -5.2, 0.8); ctx.fillStyle = '#d8322a'; ctx.fill();
      circlePath(ctx, 8.8, -5.2, 0.8); ctx.fillStyle = '#2f6fe0'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -6.5); ctx.lineTo(12, -8.5); strokeA(ctx, '#aab3bd', 0.8, 1);
      circlePath(ctx, 5.4, -5.2, 1.7); paint(ctx, skin, 1);
    } else if (b >= 3) {
      // mosazná hadice k sudu s pěnou
      ctx.beginPath(); ctx.moveTo(6.5, -5.2); ctx.quadraticCurveTo(-3, -13, -13, -10);
      strokeOutlined(ctx, 1.8, '#c99a3a');
      ctx.beginPath();
      for (let i = 1; i < 5; i++) { const t = i / 5; ctx.moveTo(6.5 - 19.5 * t - 0.8, -5.2 - 6 * t); ctx.lineTo(6.5 - 19.5 * t + 0.8, -5.2 - 6 * t - 1.4); }
      strokeA(ctx, '#7a5a1a', 0.8, 0.8);
      ctx.beginPath(); ctx.moveTo(-0.5, -6); ctx.lineTo(5.8, -5.2); strokeOutlined(ctx, 2.8, tunic);
      roundRect(ctx, 6, -6.3, 6.5, 2.2, 0.8); paint(ctx, '#d9a441', 1.1);
      circlePath(ctx, 13.5, -5.2, 1.3); paint(ctx, '#f7fbff', 0.9);
      circlePath(ctx, 14.8, -6.4, 0.9); paint(ctx, '#f7fbff', 0.8);
      circlePath(ctx, 5.8, -5.2, 1.9); paint(ctx, skin, 1.1);
    } else if (a >= 1) {
      ctx.beginPath(); ctx.moveTo(-0.5, -6); ctx.lineTo(5.8, -5.2); strokeOutlined(ctx, 2.8, tunic);
      wrench(ctx, 5.5, -5.4, 0.15);
      circlePath(ctx, 5.8, -5.2, 1.9); paint(ctx, skin, 1.1);
    } else {
      ctx.beginPath(); ctx.moveTo(-0.5, -6); ctx.lineTo(4.8, -5.8); strokeOutlined(ctx, 2.8, tunic);
      circlePath(ctx, 5, -5.8, 1.9); paint(ctx, skin, 1.1);
    }

    // pravá ruka (+y) s hřebíkometem
    let gs = 'basic';
    if (c >= 1) gs = 'heavy';
    if (a >= 3) gs = 'brass';
    if (arch || forge) gs = 'gold';
    ctx.beginPath(); ctx.moveTo(-0.5, 6); ctx.lineTo(5.8, 5.2); strokeOutlined(ctx, 2.8, tunic);
    nailGun(ctx, 5.2, gs, c >= 2, f);
    circlePath(ctx, 5.8, 5.2, 1.9); paint(ctx, skin, 1.1);

    // trup
    ellipsePath(ctx, -1, 0, 6, 8.2); paint(ctx, tunic, 1.9);
    gloss(ctx, -2.5, -3.5, 3.6, 2.2, -0.3, 0.25);
    for (let k = -1; k <= 1; k += 2) {
      circlePath(ctx, -1, 6.4 * k, 2.7);
      paint(ctx, master || forge ? '#ecc048' : mage ? '#5fc8ff' : '#7a4a26', 1.4);
    }
    if (c >= 3) engBandolier(ctx, c >= 2);
    if (b >= 2) engPliers(ctx);

    // vousy
    const beard = arch ? '#eee6d6' : mage ? '#c9c9d6' : forge ? '#a8451a' : '#d9772b';
    ctx.beginPath();
    ctx.moveTo(1.5, -4.2);
    ctx.quadraticCurveTo(7, -5, 9.5, -1.8);
    ctx.lineTo(10.5, 0);
    ctx.lineTo(9.5, 1.8);
    ctx.quadraticCurveTo(7, 5, 1.5, 4.2);
    ctx.closePath();
    paint(ctx, beard, 1.6);
    ctx.beginPath(); ctx.moveTo(4, -2.4); ctx.lineTo(8.5, -1); ctx.moveTo(4, 2.4); ctx.lineTo(8.5, 1);
    strokeA(ctx, shade(beard, -0.3), 0.8, 0.8);
    circlePath(ctx, 9.8, -1.3, 0.9); paint(ctx, '#ecc048', 0.7);
    circlePath(ctx, 9.8, 1.3, 0.9); paint(ctx, '#ecc048', 0.7);

    // přilba
    let helm = '#8d97a1', helmTrim = '#5d656e';
    if (a >= 1) { helm = '#f2c230'; helmTrim = '#b98a12'; }
    if (master) { helm = '#2c56b8'; helmTrim = '#ecc048'; }
    if (arch) { helm = '#ecc048'; helmTrim = '#fff1a8'; }
    if (mage) { helm = '#2a2f6e'; helmTrim = '#5fe8ff'; }
    if (forge) { helm = '#ecc048'; helmTrim = '#a2731a'; }
    circlePath(ctx, 0, 0, 4.9); paint(ctx, helm, 1.8);
    circlePath(ctx, 0, 0, 4.1); strokeA(ctx, helmTrim, 1.1, 1);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(3.6, 0); strokeA(ctx, shade(helm, 0.3), 1.2, 0.9);
    gloss(ctx, -1.6, -1.8, 1.8, 1, -0.5, 0.55);
    if (arch) {
      for (let i = 0; i < 6; i++) {
        const an = i * TAU / 6;
        drawPath(ctx, [Math.cos(an - 0.25) * 4.2, Math.sin(an - 0.25) * 4.2, Math.cos(an) * 6.2, Math.sin(an) * 6.2, Math.cos(an + 0.25) * 4.2, Math.sin(an + 0.25) * 4.2]);
        paint(ctx, '#ecc048', 0.9);
      }
      gem(ctx, 0, 0, 1.8, '#a35cff');
    } else if (a >= 1 && !master && !mage && !forge) {
      // hornická lampa
      glow(ctx, 5.5, 0, 4, '#fff3a0', 0.8);
      circlePath(ctx, 4, 0, 1.7); paint(ctx, '#fffbe0', 1);
    } else {
      // brýle
      const gc = mage ? '#5fe8ff' : '#9fe8ff';
      if (mage) glow(ctx, 3.6, 0, 3.6, '#5fe8ff', 0.8);
      circlePath(ctx, 3.3, -1.9, 1.2); paint(ctx, gc, 0.9);
      circlePath(ctx, 3.3, 1.9, 1.2); paint(ctx, gc, 0.9);
    }
    // nos
    circlePath(ctx, 5.4, 0, 1.5); paint(ctx, skin, 1);
    gloss(ctx, 5, -0.5, 0.6, 0.4, 0, 0.6);
    if (b >= 1) engAntenna(ctx);

    // tři rotující zlaté elektrické prstence (Ultrataktování)
    if (mage) {
      for (let i = 0; i < 3; i++) {
        ellipsePath(ctx, 0, 0, 15, 5.5, i * PI / 3);
        strokeA(ctx, OUT, 3.2, 0.9);
        strokeA(ctx, '#ecc048', 1.7, 1);
        const an = i * PI / 3;
        const px = Math.cos(an) * 15, py = Math.sin(an) * 15;
        glow(ctx, px, py, 3, '#5fe8ff', 1);
        circlePath(ctx, px, py, 1.1); ctx.fillStyle = '#e8fbff'; ctx.fill();
      }
    }
    ctx.restore();
  }

  // Brašna s nářadím
  function toolBag(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.4);
    roundRect(ctx, -1, -9, 2, 7, 0.8); paint(ctx, '#a0693a', 1);
    roundRect(ctx, -3.2, -10.5, 6.4, 2.6, 0.8); paint(ctx, '#8d949c', 1.1);
    wrench(ctx, 2, -3, -1.2);
    roundRect(ctx, -5.5, -3.5, 11, 7, 2.5); paint(ctx, '#8a4f28', 1.7);
    roundRect(ctx, -5.5, -3.5, 11, 3, 1.5); paint(ctx, '#6e3c1c', 1.1);
    roundRect(ctx, -1, -1.6, 2, 2, 0.5); paint(ctx, '#ecc048', 0.8);
    gloss(ctx, -3, -2.6, 2, 0.6, 0, 0.3);
    ctx.restore();
  }

  // Sud s bublající pěnou
  function foamBarrel(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, 0, 6, 6);
    circlePath(ctx, 0, 0, 6.2); paint(ctx, '#8b5a2b', 1.8);
    circlePath(ctx, 0, 0, 5.2); strokeA(ctx, '#6f767f', 1.4, 1);
    const B = [-1.5, -1, 2.6, 1.8, 0.5, 2.2, -0.5, 2.2, 1.8, 2, -2, 1.6];
    ctx.beginPath();
    for (let i = 0; i < B.length; i += 3) { ctx.moveTo(B[i] + B[i + 2], B[i + 1]); ctx.arc(B[i], B[i + 1], B[i + 2], 0, TAU); }
    ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#eef5fb'; ctx.fill();
    for (let i = 0; i < B.length; i += 3) gloss(ctx, B[i] - B[i + 2] * 0.35, B[i + 1] - B[i + 2] * 0.35, B[i + 2] * 0.25, B[i + 2] * 0.18, 0, 0.9);
    roundRect(ctx, 4.6, 1.2, 3, 2.4, 0.6); paint(ctx, '#d9a441', 1);
    ctx.restore();
  }

  // Otevřená železno-zlatá mechanická truhla s ozubenými čelistmi
  function mechChest(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.3);
    softShadow(ctx, 0, 0, 7, 6);
    roundRect(ctx, -6.5, -10, 13, 5, 1.5); paint(ctx, '#4b5058', 1.5);
    roundRect(ctx, -5.5, -9.2, 11, 3.4, 1); strokeA(ctx, '#ecc048', 1, 1);
    roundRect(ctx, -6.5, -5, 13, 9.5, 1.5); paint(ctx, '#3b3f46', 1.8);
    roundRect(ctx, -5, -4, 10, 6.5, 1); ctx.fillStyle = '#16161a'; ctx.fill();
    gearPath(ctx, 0, -0.8, 2.4, 6, 0.8); paint(ctx, '#ecc048', 0.9);
    const teeth = [];
    for (let i = 0; i <= 8; i++) teeth.push(-5 + i * 1.25, i % 2 ? -2.4 : -4);
    teeth.push(5, -4);
    drawPath(ctx, teeth); paint(ctx, '#e8edf2', 0.7);
    const teeth2 = [];
    for (let i = 0; i <= 8; i++) teeth2.push(-5 + i * 1.25, i % 2 ? 0.8 : 2.5);
    teeth2.push(5, 2.5);
    drawPath(ctx, teeth2); paint(ctx, '#e8edf2', 0.7);
    rivet(ctx, -5.6, 3.6, 1, '#ecc048'); rivet(ctx, 5.6, 3.6, 1, '#ecc048');
    rivet(ctx, -5.6, -4.2, 1, '#ecc048'); rivet(ctx, 5.6, -4.2, 1, '#ecc048');
    ctx.restore();
  }

  // Bedna s velkými hřeby (Dvojitý hřebíkomet)
  function nailCrate(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.25);
    woodRect(ctx, -5.5, -4.5, 11, 9, 1.5, '#9c6636', 2, true);
    for (let i = 0; i < 6; i++) {
      const px = -3 + (i % 3) * 3, py = i < 3 ? -1.6 : 1.6;
      circlePath(ctx, px, py, 1.1); paint(ctx, '#f2c230', 0.7);
    }
    ctx.restore();
  }

  // Malá krystalová střílna (Mistr konstruktér)
  function crystalTurret(ctx, x, y, col, ang) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, 0, 4, 4);
    circlePath(ctx, 0, 0, 4.2); paint(ctx, '#6f767f', 1.4);
    ctx.rotate(ang);
    roundRect(ctx, 1.5, -0.9, 4.5, 1.8, 0.6); paint(ctx, '#d9a441', 1);
    gem(ctx, 0, 0, 2.6, col);
    ctx.restore();
  }

  // Fialově zářící runová věžička (Pán parních automatů)
  function runeTurret(ctx, x, y, seed) {
    ctx.save();
    ctx.translate(x, y);
    glow(ctx, 0, 0, 7.5, '#a35cff', 0.7);
    roundRect(ctx, -4, -4, 8, 8, 1.5); paint(ctx, '#3a2f55', 1.5);
    drawPath(ctx, [0, -6, 4, 0, 0, 6, -4, 0]); paint(ctx, '#6e40aa', 1.5);
    drawPath(ctx, [0, -6, 4, 0, 0, 0]); fillA(ctx, '#fff', 0.2);
    rune(ctx, 0, 0, 5, '#d9b8ff', seed);
    ctx.restore();
  }

  // Diamantová klec na laně
  function diamondCage(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(ctx, 0, 0, r, r);
    glow(ctx, 0, 0, r * 1.5, '#9ff0ff', 0.6);
    polyPath(ctx, 0, 0, r, 8, PI / 8); paint(ctx, '#7fe7ff', 1.8);
    polyPath(ctx, 0, 0, r * 0.55, 8, PI / 8); fillA(ctx, '#e6fcff', 0.8);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = PI / 8 + i * TAU / 8;
      ctx.moveTo(Math.cos(an) * r * 0.55, Math.sin(an) * r * 0.55);
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
    }
    strokeA(ctx, '#2a8fb0', 0.9, 0.9);
    polyPath(ctx, 0, 0, r, 8, PI / 8); strokeA(ctx, '#ecc048', 1.4, 1);
    circlePath(ctx, 0, 0, 1.6); paint(ctx, '#ecc048', 1);
    gloss(ctx, -r * 0.35, -r * 0.4, r * 0.3, r * 0.15, -0.6, 0.8);
    ctx.restore();
  }

  // Monumentální zlatá trpasličí slévárna s jeřábem (Požírač králů)
  function engFoundry(ctx) {
    ctx.save();
    softShadow(ctx, 0, 0, 23, 22);
    roundRect(ctx, -21, -21, 42, 42, 6); paint(ctx, '#7d6a52', 2.4);
    ctx.beginPath();
    for (let y = -14; y <= 14; y += 7) { ctx.moveTo(-20, y); ctx.lineTo(20, y); }
    strokeA(ctx, '#4e4232', 1, 0.6);
    roundRect(ctx, -19, -19, 38, 38, 5); strokeA(ctx, '#ecc048', 2, 1);
    gloss(ctx, -10, -17, 9, 1.6, 0, 0.25);
    circlePath(ctx, 0, 0, 13.5); paint(ctx, '#d9aa3a', 1.8);
    circlePath(ctx, 0, 0, 11); strokeA(ctx, '#a2731a', 1.2, 1);
    for (let i = 0; i < 4; i++) {
      const an = i * PI / 2 + PI / 4;
      rivet(ctx, Math.cos(an) * 19, Math.sin(an) * 19, 1.6, '#ecc048');
    }
    // pec
    circlePath(ctx, -14, -14, 6.5); paint(ctx, '#4a3a32', 2);
    glow(ctx, -14, -14, 6, '#ff7a1a', 1);
    circlePath(ctx, -14, -14, 3.8); ctx.fillStyle = '#ff8a1a'; ctx.fill();
    circlePath(ctx, -14, -14, 2); ctx.fillStyle = '#ffe36a'; ctx.fill();
    puff(ctx, -18, -18, 3, 0.35);
    // žlab s roztaveným zlatem
    roundRect(ctx, -20, 9, 10, 4, 1.5); paint(ctx, '#3a2a22', 1.4);
    roundRect(ctx, -19, 10, 8, 2, 1); ctx.fillStyle = '#ffb52a'; ctx.fill();
    // jeřáb
    ctx.beginPath(); ctx.moveTo(14, -14); ctx.lineTo(26, 8);
    strokeOutlined(ctx, 3.2, '#ecc048');
    ctx.beginPath();
    for (let i = 1; i < 5; i++) { const t = i / 5; const px = 14 + 12 * t, py = -14 + 22 * t; ctx.moveTo(px - 1.5, py + 0.8); ctx.lineTo(px + 1.5, py - 0.8); }
    strokeA(ctx, '#8a6a1a', 1, 1);
    circlePath(ctx, 14, -14, 4.5); paint(ctx, '#ecc048', 1.6);
    gearPath(ctx, 14, -14, 3, 8, 0.9); paint(ctx, '#a2731a', 1);
    diamondCage(ctx, 26, 8, 7);
    ctx.restore();
  }

  TDS.drawers.trpaslici_inzenyr = {
    // Podstavec: dílenská plošina s nářadím a doplňky podle úrovní
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      ctx.save();
      if (m.p === 2 && m.t >= 5) {
        engFoundry(ctx);
      } else if (m.p === 0 && m.t >= 5) {
        // levitující zlatá plošina (stín je dál = vznáší se)
        softShadow(ctx, 5, 7, 15, 14);
        polyPath(ctx, 0, 0, 18, 6, 0); paint(ctx, '#e2b23a', 2.2);
        polyPath(ctx, 0, 0, 14.5, 6, 0); paint(ctx, '#f4e8c8', 1.4);
        circlePath(ctx, 0, 0, 11.5); strokeA(ctx, '#a35cff', 4, 0.3);
        circlePath(ctx, 0, 0, 11.5); strokeA(ctx, '#d9b8ff', 1.2, 0.9);
        for (let i = 0; i < 6; i++) {
          const an = i * TAU / 6;
          rune(ctx, Math.cos(an + 0.5) * 11.5, Math.sin(an + 0.5) * 11.5, 3.2, '#b58cff', 60 + i);
          gem(ctx, Math.cos(an) * 16.2, Math.sin(an) * 16.2, 1.4, '#a35cff');
        }
        gloss(ctx, -6, -9, 6, 1.6, -0.5, 0.35);
      } else {
        softShadow(ctx, 0, 0, 17, 16);
        let deck = '#9b6434', rim = '#6f767f', wood = true;
        if (m.p === 0 && m.t === 4) { deck = '#4a68b0'; rim = '#e3b53a'; wood = false; }
        if (m.p === 1 && m.t >= 4) { deck = m.t >= 5 ? '#2f3566' : '#56606e'; rim = '#c8763a'; wood = false; }
        if (m.p === 2 && m.t >= 3) { deck = '#6b6f78'; rim = '#3e4249'; wood = false; }
        circlePath(ctx, 0, 0, 17); paint(ctx, rim, 2.2);
        circlePath(ctx, 0, 0, 14); paint(ctx, deck, 1.6);
        if (wood) {
          ctx.beginPath();
          for (let x = -10.5; x <= 10.5; x += 3.5) {
            const h = Math.sqrt(196 - x * x) - 0.8;
            ctx.moveTo(x, -h); ctx.lineTo(x, h);
          }
          strokeA(ctx, shade(deck, -0.35), 1, 0.9);
        } else {
          gearPath(ctx, 0, 0, 10, 12, 1.4); strokeA(ctx, shade(deck, 0.25), 1, 0.6);
        }
        gloss(ctx, -5, -8, 6, 1.8, -0.5, 0.22);
        for (let i = 0; i < 8; i++) {
          const an = i * TAU / 8 + PI / 8;
          rivet(ctx, Math.cos(an) * 15.5, Math.sin(an) * 15.5, 1, shade(rim, 0.3));
        }
        // měděné vodiče (Přetaktování)
        if (m.p === 1 && m.t === 4) {
          ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-4, -6); ctx.lineTo(0, -10);
          ctx.moveTo(12, 6); ctx.lineTo(4, 6); ctx.lineTo(0, 10);
          strokeOutlined(ctx, 1.2, '#d0843f');
          gem(ctx, 0, -10, 1.3, '#5fc8ff'); gem(ctx, 0, 10, 1.3, '#5fc8ff');
        }
        // runový kruh technomága
        if (m.p === 1 && m.t >= 5) {
          circlePath(ctx, 0, 0, 12.5); strokeA(ctx, '#5fe8ff', 4, 0.25);
          circlePath(ctx, 0, 0, 12.5); strokeA(ctx, '#bff8ff', 1.2, 0.9);
          for (let i = 0; i < 6; i++) {
            const an = i * TAU / 6;
            rune(ctx, Math.cos(an) * 12.5, Math.sin(an) * 12.5, 3, '#5fe8ff', 80 + i);
          }
        }
      }
      // doplňky
      if (a >= 1 && !(m.p === 2 && m.t >= 5)) toolBag(ctx, -11, 11);
      if (b >= 3) foamBarrel(ctx, -12, -11);
      if (c === 3) nailCrate(ctx, 12, -11);
      if (c === 4) mechChest(ctx, 11, 11);
      if (a === 4) {
        crystalTurret(ctx, 18, -5, '#ff4d6d', -0.3);
        crystalTurret(ctx, -4, -18, '#4dd2ff', -1.8);
        crystalTurret(ctx, 6, 18, '#6dff8a', 1.3);
      }
      if (a >= 5) {
        for (let i = 0; i < 4; i++) {
          const an = i * PI / 2 + PI / 4;
          runeTurret(ctx, Math.cos(an) * 21, Math.sin(an) * 21, 90 + i);
        }
      }
      ctx.restore();
    },

    // Věž: trpaslík s hřebíkometem, míří k +x
    turret: function (ctx, up, s) {
      s = s || NO_OPT;
      ctx.save();
      if (s.buffed) buffAura(ctx, 17);
      ctx.scale(1.18, 1.18);
      drawDwarf(ctx, up, s.firing || 0);
      ctx.restore();
    }
  };

  /* ---------- Střílny inženýra ---------- */

  // Trojnožka s kulatým nábojem
  function sentryLegs(ctx, col) {
    ctx.save();
    softShadow(ctx, 0, 0, 8, 7.5);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 - PI / 2;
      const ex = Math.cos(a) * 9.5, ey = Math.sin(a) * 9.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey);
      strokeOutlined(ctx, 1.8, '#7a5230');
      circlePath(ctx, ex, ey, 1.7); paint(ctx, '#5d656e', 1.1);
    }
    circlePath(ctx, 0, 0, 5.8); paint(ctx, col, 1.8);
    gloss(ctx, -1.8, -1.8, 2.4, 1.4, -0.6, 0.45);
    ctx.restore();
  }

  // Ocelový štít před střílnou (Těžké hřeby)
  function sentryShield(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 8.5, -1.05, -0.3);
    strokeOutlined(ctx, 2.6, '#9aa3ad');
    ctx.beginPath(); ctx.arc(0, 0, 8.5, 0.3, 1.05);
    strokeOutlined(ctx, 2.6, '#9aa3ad');
    rivet(ctx, Math.cos(-0.7) * 8.5, Math.sin(-0.7) * 8.5, 0.9, '#d3dae1');
    rivet(ctx, Math.cos(0.7) * 8.5, Math.sin(0.7) * 8.5, 0.9, '#d3dae1');
    ctx.restore();
  }

  const SENTRY_GEM = {
    sentry_basic: '#ff4d6d', sentry_crushing_mace: '#ffb02a', sentry_explosion_bomb: '#ff7a1a',
    sentry_laser_beam: '#ff3b3b', sentry_frost_pulse: '#7fe7ff', sentry_plasma: '#b45cff'
  };

  function drawSentry(ctx, kind, ang, ts, s) {
    const f = s.firing || 0;
    const a = lv(s.up, 0);
    ctx.save();
    if (a >= 5) { circlePath(ctx, 0, 0, 10); strokeA(ctx, '#a35cff', 4, 0.3); circlePath(ctx, 0, 0, 10); strokeA(ctx, '#d9b8ff', 1, 0.8); }
    if (s.buffed) buffAura(ctx, 12);
    sentryLegs(ctx, a >= 5 ? '#ecc048' : '#9aa2ab');
    ctx.rotate(ang);
    if (a >= 3) sentryShield(ctx);
    if (kind === 'sentry_crushing_mace') {
      const ext = f * 8;
      roundRect(ctx, -5, -4.5, 8, 9, 2); paint(ctx, '#8d5a2b', 1.7);
      rivet(ctx, -3, -2.5, 0.9); rivet(ctx, -3, 2.5, 0.9);
      roundRect(ctx, 2, -1.6, 6 + ext, 3.2, 1); paint(ctx, '#aab3bd', 1.3);
      const mx = 10 + ext;
      for (let i = 0; i < 8; i++) {
        const aa = i * TAU / 8;
        drawPath(ctx, [mx + Math.cos(aa - 0.3) * 3.4, Math.sin(aa - 0.3) * 3.4, mx + Math.cos(aa) * 6, Math.sin(aa) * 6, mx + Math.cos(aa + 0.3) * 3.4, Math.sin(aa + 0.3) * 3.4]);
        paint(ctx, '#d6dce2', 1);
      }
      circlePath(ctx, mx, 0, 4); paint(ctx, '#5d656e', 1.6);
      gloss(ctx, mx - 1.3, -1.3, 1.4, 0.8, -0.6, 0.55);
    } else if (kind === 'sentry_explosion_bomb') {
      roundRect(ctx, -6.5, -4.5, 7, 9, 2); paint(ctx, '#3b3f46', 1.6);
      circlePath(ctx, 2.5, 0, 5.5); paint(ctx, '#4b5058', 1.8);
      circlePath(ctx, 2.5, 0, 5.5); strokeA(ctx, '#d9a441', 1, 1);
      circlePath(ctx, 3.2, 0, 3.6); ctx.fillStyle = '#151518'; ctx.fill();
      if (f < 0.5) {
        circlePath(ctx, 3.2, 0, 2.8); paint(ctx, '#26262c', 1);
        gloss(ctx, 2.4, -0.9, 0.9, 0.6, 0, 0.6);
        spark(ctx, 3.6, -2.8, 1.6);
      }
      muzzleBlast(ctx, 3.2, 0, 4, f);
    } else if (kind === 'sentry_laser_beam') {
      if (f > 0) {
        ctx.beginPath(); ctx.rect(7, -2.5 * f, 20, 5 * f); fillA(ctx, '#ff3b3b', 0.35 * f);
        ctx.beginPath(); ctx.rect(7, -0.6 - f * 0.6, 20, 1.2 + f * 1.2); fillA(ctx, '#ffe0e0', f);
      }
      polyPath(ctx, 0, 0, 5.2, 6, 0); paint(ctx, '#d0d6dc', 1.7);
      gloss(ctx, -1.5, -2, 2, 1, -0.5, 0.5);
      roundRect(ctx, 3.5, -2.4, 4, 4.8, 1.2); paint(ctx, '#d9a441', 1.2);
      gem(ctx, 7, 0, 2.4, '#ff3b3b');
    } else if (kind === 'sentry_frost_pulse') {
      if (f > 0) {
        circlePath(ctx, 0, 0, 7 + (1 - f) * 12); strokeA(ctx, '#bff4ff', 3 * f + 0.5, f);
      }
      for (let i = 0; i < 6; i++) {
        const aa = i * TAU / 6 + 0.5;
        drawPath(ctx, [Math.cos(aa - 0.25) * 4.6, Math.sin(aa - 0.25) * 4.6, Math.cos(aa) * 7.6, Math.sin(aa) * 7.6, Math.cos(aa + 0.25) * 4.6, Math.sin(aa + 0.25) * 4.6]);
        paint(ctx, '#dff8ff', 1);
      }
      circlePath(ctx, 0, 0, 5.2); paint(ctx, '#8fdcff', 1.8);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const aa = i * PI / 3; ctx.moveTo(Math.cos(aa) * 4, Math.sin(aa) * 4); ctx.lineTo(-Math.cos(aa) * 4, -Math.sin(aa) * 4); }
      strokeA(ctx, '#ffffff', 0.9, 0.8);
      drawPath(ctx, [4, -2, 10, 0, 4, 2]); paint(ctx, '#bdf0ff', 1.3);
      gloss(ctx, -1.6, -1.8, 1.6, 0.9, -0.5, 0.7);
    } else if (kind === 'sentry_plasma') {
      const pul = 0.5 + 0.5 * Math.sin(ts * 0.01);
      roundRect(ctx, -5, -3.5, 6, 7, 2); paint(ctx, '#4b5058', 1.6);
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.quadraticCurveTo(8, -7, 9, -2.5);
      ctx.moveTo(-2, 4); ctx.quadraticCurveTo(8, 7, 9, 2.5);
      strokeOutlined(ctx, 1.6, '#c8763a');
      glow(ctx, 5, 0, 5 + 2 * pul + 3 * f, '#b45cff', 0.6 + 0.4 * f);
      circlePath(ctx, 5, 0, 2.6); paint(ctx, '#f0dcff', 1);
      if (f > 0) {
        ctx.save();
        ctx.globalAlpha *= f;
        lightning(ctx, 5, 0, 13, -3, 961, '#c99bff', 0.9);
        lightning(ctx, 5, 0, 13, 3, 962, '#c99bff', 0.9);
        ctx.restore();
      }
    } else {
      // sentry_basic – malý hřebíkomet
      roundRect(ctx, 3, -1.3, 9, 2.6, 0.8); paint(ctx, '#5f666e', 1.4);
      roundRect(ctx, -4.5, -4, 9, 8, 2.5); paint(ctx, a >= 5 ? '#6e40aa' : '#c8923a', 1.7);
      gloss(ctx, -2, -2.2, 2, 0.9, 0, 0.5);
      rivet(ctx, -2.4, 2.2, 0.9);
      muzzleBlast(ctx, 13, 0, 2.6, f);
      if (f > 0) puff(ctx, 10, -3 * f, 1 + f * 2, 0.4 * f);
    }
    // krystal na vršku (Mistr konstruktér)
    if (a === 4) gem(ctx, -1.5, 0, 2.1, SENTRY_GEM[kind] || '#ff4d6d');
    if (a >= 5) rune(ctx, -1.5, 0, 3.4, '#d9b8ff', 99);
    ctx.restore();
  }

  // Bubliny pěny (rozložení dané seedem, spočítané jednou)
  const FOAM = (function () {
    const R = makeRng(777);
    const arr = [];
    for (let i = 0; i < 20; i++) {
      const an = R() * TAU, d = Math.sqrt(R()) * 12;
      arr.push(Math.cos(an) * d * 1.25, Math.sin(an) * d * 0.85, 3.2 + R() * 3.8, R() * TAU);
    }
    return arr;
  })();

  // Pěna na cestě (s.r = poloměr, s.alpha = průhlednost při mizení)
  function drawFoam(ctx, ts, s) {
    const k = (s.r || 18) / 18;
    ctx.save();
    ctx.scale(k, k);
    if (s.alpha != null) ctx.globalAlpha *= s.alpha;
    ellipsePath(ctx, 2.5, 3.5, 20, 14); fillA(ctx, '#000', 0.13);
    ctx.beginPath();
    for (let i = 0; i < FOAM.length; i += 4) {
      const r = FOAM[i + 2] * (1 + 0.07 * Math.sin(ts * 0.004 + FOAM[i + 3]));
      ctx.moveTo(FOAM[i] + r, FOAM[i + 1]);
      ctx.arc(FOAM[i], FOAM[i + 1], r, 0, TAU);
    }
    ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = '#cfe0ee'; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < FOAM.length; i += 4) {
      const r = FOAM[i + 2] * (1 + 0.07 * Math.sin(ts * 0.004 + FOAM[i + 3]));
      const cx = FOAM[i] - r * 0.15, cy = FOAM[i + 1] - r * 0.18;
      ctx.moveTo(cx + r * 0.8, cy);
      ctx.arc(cx, cy, r * 0.8, 0, TAU);
    }
    ctx.fillStyle = '#f7fbff'; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < FOAM.length; i += 4) {
      const r = FOAM[i + 2];
      const cx = FOAM[i] - r * 0.38, cy = FOAM[i + 1] - r * 0.38;
      ctx.moveTo(cx + r * 0.2, cy);
      ctx.arc(cx, cy, r * 0.2, 0, TAU);
    }
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }

  // Klec na cestě (fill = 0–1 naplnění chycenými slizy)
  function drawCage(ctx, ts, fill) {
    fill = clamp(fill, 0, 1);
    ctx.save();
    softShadow(ctx, 0, 0, 14, 14);
    roundRect(ctx, -13, -13, 26, 26, 4); paint(ctx, '#3b3d44', 2.2);
    const n = Math.ceil(fill * 4);
    const SP = [-6, -6, 6, -5, -5, 6, 6, 6];
    const SC = ['#6fd36a', '#5fb8ff', '#ff8ad0', '#ffd23a'];
    for (let i = 0; i < n; i++) slime(ctx, SP[i * 2], SP[i * 2 + 1], 4.4, SC[i], ts, i * 1.7);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 5.2, -12); ctx.lineTo(i * 5.2, 12);
      ctx.moveTo(-12, i * 5.2); ctx.lineTo(12, i * 5.2);
    }
    strokeA(ctx, OUT, 3, 1);
    strokeA(ctx, '#a3abb4', 1.4, 1);
    roundRect(ctx, -13, -13, 26, 26, 4);
    strokeA(ctx, OUT, 4.4, 1);
    strokeA(ctx, '#e3b53a', 2.4, 1);
    ctx.beginPath(); ctx.moveTo(-11, -12.5); ctx.lineTo(4, -12.5); strokeA(ctx, '#fff6c0', 1, 0.7);
    rivet(ctx, -13, -13, 2.4, '#ecc048'); rivet(ctx, 13, -13, 2.4, '#ecc048');
    rivet(ctx, -13, 13, 2.4, '#ecc048'); rivet(ctx, 13, 13, 2.4, '#ecc048');
    roundRect(ctx, -3, -16, 6, 5, 1.5); paint(ctx, '#ecc048', 1.4);
    circlePath(ctx, 0, -13.8, 0.9); ctx.fillStyle = OUT; ctx.fill();
    if (fill > 0) {
      ctx.beginPath(); ctx.arc(0, 0, 19, -PI / 2, -PI / 2 + TAU * fill);
      strokeA(ctx, OUT, 4, 0.8);
      strokeA(ctx, fill >= 1 ? '#ffd23a' : '#6fd36a', 2.2, 1);
    }
    if (fill >= 1) {
      const p = 0.5 + 0.5 * Math.sin(ts * 0.01);
      circlePath(ctx, 0, 0, 19); strokeA(ctx, '#ffd23a', 6, 0.15 + p * 0.25);
    }
    ctx.restore();
  }

  /*
   * TDS.trpaslici_inzenyrExtra(ctx, kind, x, y, ang, ts, s)
   *  kind = 'foam'   – pěna na cestě; s.r = poloměr (výchozí 18), s.alpha = 0–1 (mizení)
   *  kind = 'cage'   – klec na cestě; s.fill = 0–1 naplnění (slizy uvnitř + ukazatel)
   *  kind = 'sentry_basic' | 'sentry_crushing_mace' | 'sentry_explosion_bomb' |
   *         'sentry_laser_beam' | 'sentry_frost_pulse' | 'sentry_plasma'
   *                  – střílny; ang = míření, s.firing = 0–1, volitelně s.up (štít od úrovně 3 cesty 1,
   *                    krystal na úrovni 4, runy na úrovni 5) a s.buffed
   *  kind = 'nail' | 'plasma' – střely (stejné jako v TDS.projectileDrawers), ang = směr
   */
  TDS.trpaslici_inzenyrExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || NO_OPT;
    ts = ts || 0;
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'foam') {
      drawFoam(ctx, ts, s);
    } else if (kind === 'cage') {
      ctx.rotate(ang || 0);
      drawCage(ctx, ts, s.fill || 0);
    } else if (kind.indexOf('sentry_') === 0) {
      drawSentry(ctx, kind, ang || 0, ts, s);
    } else if (TDS.projectileDrawers && TDS.projectileDrawers[kind]) {
      ctx.rotate(ang || 0);
      TDS.projectileDrawers[kind](ctx);
    }
    ctx.restore();
  };

  /* ---------- Střely inženýra ---------- */

  // Dlouhý kovový hřebík s plochou hlavičkou, za ním pára
  function drawNail(ctx) {
    ctx.save();
    puff(ctx, -21, -1.5, 2.6, 0.25);
    puff(ctx, -17.5, 0.5, 3.4, 0.35);
    roundRect(ctx, -12, -1.4, 22.5, 2.8, 1); paint(ctx, '#aab3bd', 1.4);
    drawPath(ctx, [10, -1.4, 16.5, 0, 10, 1.4]); paint(ctx, '#cfd6dd', 1.2);
    ctx.beginPath(); ctx.moveTo(-11, -0.5); ctx.lineTo(14, -0.3); strokeA(ctx, '#fff', 0.8, 0.7);
    roundRect(ctx, -14.2, -4.2, 2.8, 8.4, 0.8); paint(ctx, '#8d949c', 1.4);
    gloss(ctx, -13.4, -2.4, 0.6, 1.2, 0, 0.6);
    ctx.restore();
  }

  // Plazmová koule se září a jiskrami
  const PLASMA_SPARKS = (function () {
    const R = makeRng(1313);
    const arr = [];
    for (let i = 0; i < 6; i++) arr.push(-6 - R() * 14, (R() - 0.5) * 9, 0.6 + R() * 1.1);
    return arr;
  })();

  function drawPlasma(ctx) {
    ctx.save();
    ctx.save();
    ctx.translate(4, 0);
    ctx.rotate(PI);
    teardrop(ctx, 20, 6.5); fillA(ctx, '#8a4dff', 0.35);
    teardrop(ctx, 14, 4); fillA(ctx, '#c49bff', 0.55);
    ctx.restore();
    for (let i = 0; i < PLASMA_SPARKS.length; i += 3) {
      circlePath(ctx, PLASMA_SPARKS[i], PLASMA_SPARKS[i + 1], PLASMA_SPARKS[i + 2]);
      fillA(ctx, '#e6d4ff', 0.9);
    }
    glow(ctx, 4, 0, 10, '#9b5cff', 0.9);
    circlePath(ctx, 4, 0, 5.5); paint(ctx, '#c9a3ff', 1.6);
    circlePath(ctx, 4, 0, 3.2); ctx.fillStyle = '#f4eaff'; ctx.fill();
    gloss(ctx, 2.6, -1.8, 1.4, 0.8, -0.5, 0.9);
    ctx.beginPath(); ctx.arc(4, 0, 7.5, -1.2, -0.2); ctx.moveTo(4 + Math.cos(1.6) * 7.5, Math.sin(1.6) * 7.5); ctx.arc(4, 0, 7.5, 1.6, 2.5);
    strokeA(ctx, '#e0ccff', 1.1, 0.9);
    ctx.restore();
  }

  TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {
    nail: function (ctx) { drawNail(ctx); },
    plasma: function (ctx) { drawPlasma(ctx); }
  });
})();

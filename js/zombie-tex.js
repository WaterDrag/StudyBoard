/* zombie-tex.js — textury ve stylu .io pro Zombie Survival: ploché barvy po stupních, tlusté tmavé obrysy,
 * ostré tvary a víc detailů (velká navazující dlaždice podlahy místo malé opakující se, praskliny, trsy trávy,
 * kytičky, cihly, prkna, tekoucí řeka). Přepisuje ZS.floor, ZS.river, ZS.mapWall (budovy, kontejnery, domy, ploty, hroby),
 * ZS.structure (zeď, barikáda, plošina, hroty; věž kreslí dál původní kód) a el. plot v ZS.infra. Styl se volí v Nastavení na hlavní stránce (js/gfxpref.js); Gemini = localStorage zs_tex = '0'.
 * Všechno se spočítá jen jednou (při prvním vykreslení) a pak se kopírují hotové obrázky. */
(function () {
  'use strict';
  const ZS = window.ZS;
  if (!ZS) return;
  const on = () => { try { return localStorage.getItem('zs_tex') !== '0'; } catch (_) { return true; } };
  ZS.texOn = on;   // hra podle toho volí mezi mou kresbou a doplňkem od Gemini (zombie-sprites-4.js)

  // ── šum: periodický hodnotový šum + fBm (dlaždice navazuje do všech stran) ──
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeNoise(period, seed) {
    const r = rng(seed), g = new Float32Array(period * period); for (let i = 0; i < g.length; i++) g[i] = r();
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
      const X0 = ((x0 % period) + period) % period, Y0 = ((y0 % period) + period) % period, X1 = (X0 + 1) % period, Y1 = (Y0 + 1) % period;
      const a = g[Y0 * period + X0], b = g[Y0 * period + X1], c = g[Y1 * period + X0], d = g[Y1 * period + X1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  function makeFbm(size, seed, octaves = 3, basePeriod = 4) {
    const ns = []; for (let o = 0; o < octaves; o++) ns.push({ n: makeNoise(basePeriod << o, seed + o * 101), p: basePeriod << o });
    return (x, y) => { let v = 0, amp = 1, sum = 0; for (const { n, p } of ns) { v += n(x / size * p, y / size * p) * amp; sum += amp; amp *= 0.5; } return v / sum; };
  }
  const step = (v, levels) => Math.floor(Math.max(0, Math.min(0.999, v)) * levels) / levels;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function shade(ctx, w, h, fn) {
    const im = ctx.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y), i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
    ctx.putImageData(im, 0, 0);
  }
  // kreslí i „přes okraj", aby dlaždice navazovala
  const wrap = (S, fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  const OUT = '#16181d';

  // ── podlahy ────────────────────────────────────────────────────────────
  const S = 256;
  // beton: větší dlaždice (500 px), aby vpusti a značky netvořily viditelnou mřížku
  function floorConcrete(ctx) {
    const Z = 500, big = makeFbm(Z, 11, 3, 2), mid = makeFbm(Z, 23, 3, 4);
    const T = [[40, 45, 54], [45, 50, 60], [51, 57, 67]];
    shade(ctx, Z, Z, (x, y) => T[step(mid(x, y) * 0.7 + big(x, y) * 0.3, 3) * 3 | 0]);
    ctx.strokeStyle = '#22262e'; ctx.lineWidth = 3;
    for (let q = 0; q < Z; q += 100) {   // spáry po 100 px = přesně na mřížce stavění (50 px)
      ctx.beginPath(); ctx.moveTo(q, 0); ctx.lineTo(q, Z); ctx.moveTo(0, q); ctx.lineTo(Z, q); ctx.stroke(); }
    const r = rng(5);
    ctx.strokeStyle = '#262a33'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      let x = r() * Z, y = r() * Z, a = r() * 6.28; const pts = [[x, y]];
      for (let k = 0; k < 5; k++) { a += (r() - 0.5) * 1.4; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push([x, y]); }
      wrap(Z, (dx, dy) => { ctx.beginPath(); pts.forEach(([px, py], j) => j ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)); ctx.stroke(); });
    }
    for (const [mx, my] of [[190, 62], [402, 330]]) {   // kanálové vpusti
      ctx.fillStyle = '#2c3039'; ctx.strokeStyle = '#1a1d23'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3a404b'; ctx.lineWidth = 2;
      for (const d of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(mx - 10, my + d); ctx.lineTo(mx + 10, my + d); ctx.stroke(); }
    }
    for (const [ox, oy, rot] of [[70, 190, 0.4], [330, 90, -0.8], [460, 440, 1.2], [230, 400, 0.1]]) {   // olejové skvrny
      ctx.fillStyle = '#30343d'; ctx.beginPath(); ctx.ellipse(ox, oy, 22, 14, rot, 0, 7); ctx.fill();
      ctx.fillStyle = '#363b45'; ctx.beginPath(); ctx.ellipse(ox - 6, oy - 4, 8, 5, rot, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#b8902a'; ctx.strokeStyle = '#1a1d23'; ctx.lineWidth = 2.5;   // jedna řada výstražných značek
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(150 + i * 24, 456, 16, 8, 2); ctx.fill(); ctx.stroke(); }
  }
  // tráva / hřbitovní hlína: dva typy povrchu s obrysem na hraně
  function floorPatches(ctx, o) {
    const big = makeFbm(S, o.seed, 3, 2), mid = makeFbm(S, o.seed + 2, 3, 4);
    const isB = (x, y) => big(((x % S) + S) % S, ((y % S) + S) % S) < o.cut;
    shade(ctx, S, S, (x, y) => {
      const b = big(x, y);
      if (b < o.cut) return b < o.cut - 0.05 ? o.b[0] : o.b[1];
      return o.a[step(mid(x, y), 3) * 3 | 0];
    });
    const im = ctx.getImageData(0, 0, S, S), d = im.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (isB(x, y) && (!isB(x + 1, y) || !isB(x, y + 1) || !isB(x - 1, y) || !isB(x, y - 1))) { const i = (y * S + x) * 4; d[i] = o.edge[0]; d[i + 1] = o.edge[1]; d[i + 2] = o.edge[2]; }
    }
    ctx.putImageData(im, 0, 0);
    return big;
  }
  function tuft(ctx, x, y, sc, fill, line) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-4, -7); ctx.lineTo(-1, 1); ctx.lineTo(0, -10); ctx.lineTo(2, 1); ctx.lineTo(5, -6); ctx.lineTo(6, 2); ctx.closePath();
    ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function stone(ctx, x, y, rr, rot, fill, hi, line) {
    ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, rot, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hi; ctx.beginPath(); ctx.ellipse(x - rr * 0.3, y - rr * 0.25, rr * 0.4, rr * 0.25, 0, 0, 7); ctx.fill();
  }
  function floorGrass(ctx) {
    const big = floorPatches(ctx, { seed: 41, cut: 0.36, a: [[56, 92, 52], [63, 104, 58], [72, 116, 64]], b: [[92, 74, 50], [104, 86, 58]], edge: [58, 48, 34] });
    const r = rng(9);
    for (let t = 0; t < 55; t++) {
      const x = r() * S, y = r() * S; if (big(x, y) < 0.4) continue; const sc = 0.8 + r() * 0.6, f = r() < 0.5 ? '#5f9c4e' : '#6dab57';
      wrap(S, (dx, dy) => tuft(ctx, x + dx, y + dy, sc, f, '#2c4a27'));
    }
    for (let i = 0; i < 5; i++) {
      const x = 12 + r() * (S - 24), y = 12 + r() * (S - 24); ctx.fillStyle = ['#f0e6a0', '#e9a8c8', '#ffffff'][i % 3]; ctx.strokeStyle = '#2c4a27'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 4; i++) stone(ctx, 10 + r() * (S - 20), 10 + r() * (S - 20), 3 + r() * 4, r(), '#8c8f94', '#a9acb1', '#3b3e44');
  }
  function floorGraveyard(ctx) {
    const big = floorPatches(ctx, { seed: 61, cut: 0.38, a: [[34, 32, 50], [39, 37, 57], [45, 42, 64]], b: [[44, 60, 50], [52, 70, 58]], edge: [22, 30, 26] });
    const r = rng(19);
    for (let t = 0; t < 30; t++) {
      const x = r() * S, y = r() * S; const mossy = big(x, y) < 0.38, sc = 0.7 + r() * 0.5;
      wrap(S, (dx, dy) => tuft(ctx, x + dx, y + dy, sc, mossy ? '#5f7d63' : '#6b6578', '#211f2d'));
    }
    // louže
    for (let i = 0; i < 1; i++) {
      const x = 30 + r() * 196, y = 30 + r() * 196, rr = 10 + r() * 10;
      ctx.fillStyle = '#2d3550'; ctx.strokeStyle = '#161523'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.6, r(), 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3e4868'; ctx.beginPath(); ctx.ellipse(x - rr * 0.3, y - rr * 0.18, rr * 0.35, rr * 0.14, 0, 0, 7); ctx.fill();
    }
    // spadané listí
    for (let i = 0; i < 9; i++) {
      const x = 8 + r() * (S - 16), y = 8 + r() * (S - 16), a = r() * 6.28;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = ['#8a5a2b', '#a0642c', '#6e4a2a'][i % 3]; ctx.strokeStyle = '#1d1a26'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.2, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    for (let i = 0; i < 5; i++) stone(ctx, 10 + r() * (S - 20), 10 + r() * (S - 20), 2.5 + r() * 3.5, r(), '#5c5a6e', '#77758a', '#1d1b28');
  }
  const FLOORS = [floorConcrete, floorGrass, floorGraveyard], floorPat = new Map();
  const oldFloor = ZS.floor;
  ZS.floor = function (ctx, mapId, x, y, w, h) {
    if (!on()) return mapId === 3 && ZS.floorQuarry ? ZS.floorQuarry(ctx, x, y, w, h) : oldFloor.call(this, ctx, mapId, x, y, w, h);
    const id = FLOORS[mapId] ? mapId : 0;
    let pat = floorPat.get(id);
    if (!pat) { const z = id === 0 ? 500 : S, c = canvas(z, z); FLOORS[id](c.getContext('2d')); pat = ctx.createPattern(c, 'repeat'); floorPat.set(id, pat); }
    ctx.save(); ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); ctx.restore();
  };

  // ── řeka ───────────────────────────────────────────────────────────────
  let CAUSTIC = null;
  function caustic() {
    const C = 128, c = canvas(C, C), ctx = c.getContext('2d'), f = makeFbm(C, 77, 3, 4), im = ctx.createImageData(C, C), d = im.data;
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const i = (y * C + x) * 4; d[i] = 200; d[i + 1] = 240; d[i + 2] = 255; d[i + 3] = Math.abs(f(x, y) - 0.5) < 0.035 ? 150 : 0; }
    ctx.putImageData(im, 0, 0); return c;
  }
  const oldRiver = ZS.river;
  ZS.river = function (ctx, x, y, w, h, ts) {
    if (!on()) return oldRiver.call(this, ctx, x, y, w, h, ts);
    CAUSTIC = CAUSTIC || caustic();
    ctx.save();
    ctx.fillStyle = '#5b4a33'; ctx.fillRect(x - 8, y, w + 16, h);              // břeh
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#2f7fb5'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#276da0'; ctx.fillRect(x + w * 0.22, y, w * 0.56, h);   // hloubka
    const p = ctx.createPattern(CAUSTIC, 'repeat'), t = ts || 0;
    const ox = (t * 0.006) % 128, oy = (t * 0.045) % 128;   // světelné žilky tečou s proudem
    ctx.save(); ctx.globalAlpha = 0.8; ctx.translate(x + ox, y + oy);
    ctx.fillStyle = p; ctx.fillRect(-ox - 128, -oy - 128, w + 256, h + 256);
    ctx.restore();
    // pěna u břehů: ploché bublinky, tečou s vodou (jen ve viditelném úseku)
    ctx.fillStyle = '#d6f1ff';
    const off = (t * 0.045) % 41;
    for (let yy = y - 41 + off; yy < y + h; yy += 41) for (let k = 0; k < 2; k++) {
      const sy = yy + k * 19, rr = 3 + ((Math.abs(Math.round(sy)) >> 3) % 3);
      ctx.beginPath(); ctx.arc(x + 3, sy, rr, 0, 7); ctx.arc(x + w - 3, sy + 9, rr, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#173a52'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y, w - 3, h);
  };

  // ── stavby ─────────────────────────────────────────────────────────────
  // poškození: praskliny podle životů (4 stupně → 4 obrázky v mezipaměti)
  function cracks(ctx, W, H, hp, seed) {
    if (hp > 0.75) return;
    const r = rng(seed), n = hp > 0.5 ? 1 : hp > 0.25 ? 3 : 5;
    ctx.strokeStyle = '#1b100c'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      let x = 4 + r() * (W - 8), y = r() < 0.5 ? 1 : H - 1; const dir = y < 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 3; s++) { x += (r() - 0.5) * 8; y += dir * H / 3.2; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  function brick(W, H, hpB, seed) {    // vodorovná zeď W×H
    const c = canvas(W + 4, H + 4), ctx = c.getContext('2d'), r = rng(seed);
    ctx.translate(2, 2);
    ctx.fillStyle = '#5c3a2e'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill();
    const rows = Math.max(1, Math.round(H / 10)), bh = H / rows, bw = 16;
    for (let ry = 0; ry < rows; ry++) for (let bx = -(ry % 2) * bw / 2; bx < W; bx += bw) {
      const x0 = Math.max(1.5, bx + 1.5), x1 = Math.min(W - 1.5, bx + bw - 1.5), y0 = ry * bh + 1.5, y1 = (ry + 1) * bh - 1.5; if (x1 - x0 < 2) continue;
      ctx.fillStyle = ['#c0563a', '#b34d33', '#c96443'][r() * 3 | 0]; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = 'rgba(255,220,190,.35)'; ctx.fillRect(x0, y0, x1 - x0, 1.6);
      ctx.fillStyle = 'rgba(60,20,10,.35)'; ctx.fillRect(x0, y1 - 1.6, x1 - x0, 1.6);
    }
    cracks(ctx, W, H, hpB, seed + 7);
    ctx.strokeStyle = '#1d1210'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.stroke();
    return c;
  }
  function plankRow(ctx, W, y, h, col, tilt, r) {
    ctx.save(); ctx.translate(W / 2, y + h / 2); ctx.rotate(tilt);
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-W / 2, -h / 2, W, h, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(70,35,10,.55)'; ctx.lineWidth = 1.2;
    for (const yy of [-h * 0.2, h * 0.18]) { ctx.beginPath(); ctx.moveTo(-W / 2 + 4, yy); ctx.bezierCurveTo(-W / 6, yy - 1.5, W / 6, yy + 1.5, W / 2 - 10, yy); ctx.stroke(); }
    ctx.fillStyle = 'rgba(70,35,10,.6)'; ctx.beginPath(); ctx.ellipse(W * 0.12 * (r() < 0.5 ? -1 : 1), 0, 2.4, 1.4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.roundRect(-W / 2, -h / 2, W, h, 2); ctx.stroke();
    for (const nx of [-W / 2 + 5, W / 2 - 5]) { ctx.fillStyle = '#c9ced6'; ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(nx, 0, 1.8, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function barricade(W, H, hpB, seed) {
    const c = canvas(W + 4, H + 4), ctx = c.getContext('2d'), r = rng(seed);
    ctx.translate(2, 2);
    plankRow(ctx, W, 1, H / 2 - 1, '#c98a4b', 0.04, r); plankRow(ctx, W, H / 2, H / 2 - 1, '#b8783e', -0.05, r);
    cracks(ctx, W, H, hpB, seed + 3);
    return c;
  }
  function platform(W, H, hpB, seed) {
    const c = canvas(W + 4, H + 4), ctx = c.getContext('2d'), r = rng(seed);
    ctx.translate(2, 2);
    ctx.fillStyle = '#6b4424'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill();
    const n = 5, ph = (H - 6) / n;
    for (let i = 0; i < n; i++) {
      const y = 3 + i * ph;
      ctx.fillStyle = ['#b8783e', '#c4864a', '#ad6f38'][i % 3]; ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(3, y + 0.5, W - 6, ph - 1, 1.5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,35,10,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, y + ph * 0.45); ctx.bezierCurveTo(W * 0.35, y + ph * 0.3, W * 0.6, y + ph * 0.65, W - 14, y + ph * 0.45); ctx.stroke();
      ctx.fillStyle = 'rgba(70,35,10,.55)'; ctx.beginPath(); ctx.ellipse(10 + r() * (W - 20), y + ph / 2, 2.2, 1.2, 0, 0, 7); ctx.fill();
    }
    for (const [cx, cy] of [[2, 2], [W - 12, 2], [2, H - 12], [W - 12, H - 12]]) {   // kovové rohy s nýtem
      ctx.fillStyle = '#7b8494'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(cx, cy, 10, 10, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.arc(cx + 5, cy + 5, 1.6, 0, 7); ctx.fill();
    }
    cracks(ctx, W, H, hpB, seed + 5);
    ctx.strokeStyle = '#2a1708'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.stroke();
    return c;
  }
  function spikes(W, H, hpB, seed) {
    const c = canvas(W + 4, H + 4), ctx = c.getContext('2d'), r = rng(seed);
    ctx.translate(2, 2);
    ctx.fillStyle = '#4b5260'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(1, 1, W - 2, H - 2, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a404b'; ctx.lineWidth = 1.5;                                           // mřížka desky
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(W * i / 3, 4); ctx.lineTo(W * i / 3, H - 4); ctx.moveTo(4, H * i / 3); ctx.lineTo(W - 4, H * i / 3); ctx.stroke(); }
    for (let ry = 0; ry < 3; ry++) for (let cx = 0; cx < 3; cx++) {
      const sx = W * (cx + 0.5) / 3, sy = H * (ry + 0.5) / 3, s = W / 8;
      ctx.fillStyle = '#9aa3b2'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * 0.85, sy + s * 0.6); ctx.lineTo(sx - s * 0.85, sy + s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d5dbe4'; ctx.beginPath(); ctx.moveTo(sx, sy - s * 0.75); ctx.lineTo(sx + s * 0.2, sy + s * 0.3); ctx.lineTo(sx - s * 0.35, sy + s * 0.3); ctx.closePath(); ctx.fill();
      if ((ry + cx + seed) % 3 === 0) { ctx.fillStyle = '#9b1c1c'; ctx.beginPath(); ctx.arc(sx + s * 0.1, sy - s * 0.55, 1.8, 0, 7); ctx.fill(); }
    }
    cracks(ctx, W, H, hpB, seed + 9);
    return c;
  }
  const MAKERS = { wall: brick, barricade, platform, spikes }, structCache = new Map();
  const oldStruct = ZS.structure;
  ZS.structure = function (ctx, type, x, y, w, h, hpPct, ts, angle) {
    const make = MAKERS[type];
    if (!on() || !make) return oldStruct.call(this, ctx, type, x, y, w, h, hpPct, ts, angle);
    const W = Math.round(w), H = Math.round(h), hp = hpPct === undefined ? 1 : hpPct;
    const hpB = hp > 0.75 ? 1 : hp > 0.5 ? 0.7 : hp > 0.25 ? 0.45 : 0.2;
    const vertical = (type === 'wall' || type === 'barricade') && H > W;   // otočená o 90° → kreslit naležato a otočit
    const seed = (Math.abs(Math.round(x * 7 + y * 13)) % 997) + 1;
    const key = `${type}_${vertical ? H : W}_${vertical ? W : H}_${hpB}_${seed % 4}`;
    let spr = structCache.get(key);
    if (!spr) { spr = vertical ? make(H, W, hpB, seed % 4 + 1) : make(W, H, hpB, seed % 4 + 1); structCache.set(key, spr); }
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 3, y + 4, W, H);   // plochý stín
    if (vertical) { ctx.translate(x + W / 2, y + H / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(spr, -spr.width / 2, -spr.height / 2); }
    else ctx.drawImage(spr, x - 2, y - 2);
    ctx.restore();
  };
  // ── zdi a budovy mapy (ZS.mapWall) ─────────────────────────────────────
  const shadowRect = (ctx, W, H, r) => { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.roundRect(4, 5, W, H, r); ctx.fill(); };
  const box = (ctx, x, y, w, h, r, fill, line = OUT, lw = 2) => { ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); if (lw) ctx.stroke(); };
  // kontejner (Průmysl): vlnitý plech ve dvou tónech, dveře na konci, rohové odlitky
  function container(ctx, W, H, v) {
    const C = [['#b5332e', '#9c2a26', '#d0493f'], ['#2d5fa6', '#244f8c', '#3b74c2'], ['#c76a22', '#ad5a1b', '#e07f30'], ['#3f7a4a', '#33663d', '#4d9159']][v % 4];
    const horiz = W >= H, L = horiz ? W : H, T = horiz ? H : W;
    ctx.save(); if (!horiz) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }   // kreslí se naležato
    box(ctx, 0, 0, L, T, 3, C[0], OUT, 0);
    for (let i = 6; i < L - 14; i += 7) { ctx.fillStyle = C[(i / 7 | 0) % 2 ? 1 : 2]; ctx.fillRect(i, 3, 3.5, T - 6); }   // žebra plechu
    const dx = v % 2 ? 2 : L - 16;                                                               // dveře na jednom konci
    ctx.fillStyle = C[1]; ctx.fillRect(dx, 2, 14, T - 4);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5;
    for (const bx of [dx + 4, dx + 10]) { ctx.beginPath(); ctx.moveTo(bx, 4); ctx.lineTo(bx, T - 4); ctx.stroke(); }
    ctx.fillStyle = '#d6d9de'; ctx.fillRect(dx + 3, T / 2 - 2, 3, 4); ctx.fillRect(dx + 9, T / 2 - 2, 3, 4);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(3, 2, L - 6, 2);                         // odlesk nahoře
    if (L > 120) { box(ctx, L * 0.4, T / 2 - 5, 26, 10, 2, 'rgba(255,255,255,.85)', OUT, 1.5); ctx.fillStyle = C[1]; ctx.fillRect(L * 0.4 + 4, T / 2 - 1.5, 18, 3); }   // nálepka
    ctx.fillStyle = '#2a2d33'; for (const [qx, qy] of [[0, 0], [L - 5, 0], [0, T - 5], [L - 5, T - 5]]) ctx.fillRect(qx, qy, 5, 5);   // rohové odlitky
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(0, 0, L, T, 3); ctx.stroke();
    ctx.restore();
  }
  // střecha haly (Průmysl): atika, dehtové plochy, klimatizace, ventilace, světlík, poklop
  function rooftop(ctx, W, H, v, r) {
    box(ctx, 0, 0, W, H, 4, '#4a5262', OUT, 3);
    box(ctx, 7, 7, W - 14, H - 14, 2, '#363d49', '#2a303a', 2);
    ctx.fillStyle = '#323844'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(12 + r() * (W - 24), 12 + r() * (H - 24), 10 + r() * 14, 6 + r() * 8, r(), 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(3, 3, W - 6, 2);
    const items = [];
    const place = (w, h) => { for (let k = 0; k < 20; k++) { const x = 12 + r() * (W - 24 - w), y = 12 + r() * (H - 24 - h); if (!items.some(q => x < q[0] + q[2] + 6 && x + w + 6 > q[0] && y < q[1] + q[3] + 6 && y + h + 6 > q[1])) { items.push([x, y, w, h]); return [x, y]; } } return null; };
    let p = place(30, 22); if (p) { box(ctx, p[0], p[1], 30, 22, 3, '#8a929e'); ctx.fillStyle = '#5b636f'; ctx.beginPath(); ctx.arc(p[0] + 11, p[1] + 11, 7.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#c3c8cf'; ctx.lineWidth = 1.6; for (let a = 0; a < 3; a++) { const t = a * 2.09 + v; ctx.beginPath(); ctx.moveTo(p[0] + 11, p[1] + 11); ctx.lineTo(p[0] + 11 + Math.cos(t) * 6, p[1] + 11 + Math.sin(t) * 6); ctx.stroke(); }
      ctx.fillStyle = '#2a2f36'; for (let k = 0; k < 4; k++) ctx.fillRect(p[0] + 21, p[1] + 4 + k * 4, 6, 2); }
    if (W > 90 || H > 90) { p = place(34, 20); if (p) { box(ctx, p[0], p[1], 34, 20, 2, '#3aa5d8'); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(p[0] + 4, p[1] + 16); ctx.lineTo(p[0] + 14, p[1] + 4); ctx.lineTo(p[0] + 19, p[1] + 4); ctx.lineTo(p[0] + 9, p[1] + 16); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0] + 17, p[1]); ctx.lineTo(p[0] + 17, p[1] + 20); ctx.stroke(); } }
    for (let k = 0; k < 2; k++) { p = place(12, 12); if (p) { ctx.fillStyle = '#9aa1ab'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0] + 6, p[1] + 6, 6, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4b525c'; ctx.beginPath(); ctx.arc(p[0] + 6, p[1] + 6, 3, 0, 7); ctx.fill(); } }
    p = place(16, 16); if (p) { box(ctx, p[0], p[1], 16, 16, 2, '#5f6774'); ctx.strokeStyle = '#3a404a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p[0] + 3, p[1] + 3); ctx.lineTo(p[0] + 13, p[1] + 13); ctx.moveTo(p[0] + 13, p[1] + 3); ctx.lineTo(p[0] + 3, p[1] + 13); ctx.stroke(); }
  }
  // domek (Předměstí): sedlová střecha, řady tašek, hřeben, komín
  function house(ctx, W, H, v, r) {
    const C = [['#a8473a', '#8d3a2f', '#c25a4b'], ['#7a4b2e', '#663e25', '#93603c'], ['#4b5a6e', '#3e4b5c', '#5c6d84'], ['#3d6b4a', '#33593e', '#4b8059']][v % 4];
    const horiz = W >= H;
    box(ctx, 0, 0, W, H, 4, C[0], OUT, 0);
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.clip();
    if (horiz) { ctx.fillStyle = C[2]; ctx.fillRect(0, 0, W, H / 2); ctx.fillStyle = C[1]; ctx.fillRect(0, H / 2, W, H / 2); }
    else { ctx.fillStyle = C[2]; ctx.fillRect(0, 0, W / 2, H); ctx.fillStyle = C[1]; ctx.fillRect(W / 2, 0, W / 2, H); }
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.2;                                         // řady tašek
    const L = horiz ? H : W, M = horiz ? W : H;
    for (let a = 7; a < L; a += 7) { ctx.beginPath(); if (horiz) { ctx.moveTo(0, a); ctx.lineTo(W, a); } else { ctx.moveTo(a, 0); ctx.lineTo(a, H); } ctx.stroke();
      for (let b = (a / 7 % 2) * 5; b < M; b += 10) { ctx.beginPath(); if (horiz) { ctx.moveTo(b, a - 7); ctx.lineTo(b, a); } else { ctx.moveTo(a - 7, b); ctx.lineTo(a, b); } ctx.stroke(); } }
    ctx.restore();
    ctx.fillStyle = '#2b2b30'; if (horiz) ctx.fillRect(2, H / 2 - 2, W - 4, 4); else ctx.fillRect(W / 2 - 2, 2, 4, H - 4);   // hřeben
    if (W >= 60 && H >= 60) { const cx = horiz ? W * (0.2 + r() * 0.5) : W * 0.68, cy = horiz ? H * 0.68 : H * (0.2 + r() * 0.5);
      box(ctx, cx, cy, 15, 15, 2, '#8b5a43'); ctx.fillStyle = '#2b1a12'; ctx.fillRect(cx + 4, cy + 4, 7, 7);
      ctx.strokeStyle = 'rgba(120,85,65,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy + 7.5); ctx.lineTo(cx + 15, cy + 7.5); ctx.stroke(); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.stroke();
  }
  // plot nebo živý plot (Předměstí, úzké zdi)
  function picket(ctx, W, H, v) {
    const horiz = W >= H, L = horiz ? W : H, T = horiz ? H : W;
    ctx.save(); if (!horiz) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
    if (v % 2) {   // živý plot: oblé keře
      box(ctx, 0, 2, L, T - 4, T / 2, '#3c7a40', OUT, 0);
      for (let x = T / 2; x < L - T / 2 + 1; x += T * 0.7) { ctx.fillStyle = (x / T | 0) % 2 ? '#4a9150' : '#438847'; ctx.strokeStyle = '#1f3d21'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, T / 2, T * 0.48, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let x = T / 2; x < L - T / 2 + 1; x += T * 0.7) { ctx.beginPath(); ctx.arc(x - T * 0.15, T * 0.35, T * 0.14, 0, 7); ctx.fill(); }
    } else {      // laťkový plot: dvě příčky a laťky
      box(ctx, 0, T * 0.3, L, T * 0.14, 1, '#8a5a32', OUT, 1.5); box(ctx, 0, T * 0.58, L, T * 0.14, 1, '#8a5a32', OUT, 1.5);
      for (let x = 2; x < L - 5; x += 9) { ctx.fillStyle = '#d6b47e'; ctx.strokeStyle = '#3b2612'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, T - 2); ctx.lineTo(x, 4); ctx.lineTo(x + 3, 1); ctx.lineTo(x + 6, 4); ctx.lineTo(x + 6, T - 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }
  // hrob (Hřbitov): kamenná deska, náhrobek s křížem, mech a kytka
  function grave(ctx, W, H, v, r) {
    const vert = H >= W;
    box(ctx, 0, 0, W, H, 3, '#706f80', OUT, 3);
    box(ctx, 4, 4, W - 8, H - 8, 2, '#5d5c6d', '#46455a', 1.5);
    const hs = vert ? [2, 2, W - 4, Math.min(16, H * 0.3)] : [2, 2, Math.min(16, W * 0.3), H - 4];   // náhrobek
    box(ctx, ...hs, 3, '#8a899b', OUT, 2.5);
    ctx.fillStyle = '#4a495c'; const cx = hs[0] + hs[2] / 2, cy = hs[1] + hs[3] / 2, s = Math.min(hs[2], hs[3]) * 0.32;
    ctx.fillRect(cx - s * 0.22, cy - s, s * 0.44, s * 2); ctx.fillRect(cx - s * 0.7, cy - s * 0.45, s * 1.4, s * 0.42);
    ctx.fillStyle = '#5e8a5e'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(4 + r() * (W - 8), 4 + r() * (H - 8), 2.5 + r() * 3, 0, 7); ctx.fill(); }   // mech
    if (v % 2) { const fx = W / 2 + (r() - 0.5) * 6, fy = vert ? H * 0.65 : H / 2; ctx.fillStyle = ['#e9a8c8', '#f0e6a0', '#ffffff'][v % 3]; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 1.8, 0, 7); ctx.fill(); ctx.stroke(); } ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, 7); ctx.fill(); }
  }
  // kamenná zídka (kaple) – nepravidelné kvádry
  function stoneWall(ctx, W, H, v, r) {
    const horiz = W >= H, L = horiz ? W : H, T = horiz ? H : W;
    ctx.save(); if (!horiz) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
    box(ctx, 0, 0, L, T, 2, '#3b3a49', OUT, 0);
    let x = 1.5; while (x < L - 2) { const w = Math.min(L - 1.5 - x, 9 + r() * 12); ctx.fillStyle = ['#77768a', '#6a697d', '#828196'][r() * 3 | 0]; ctx.beginPath(); ctx.roundRect(x, 1.5, w - 1.5, T - 3, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1, 2, w - 3.5, 1.5); x += w; }
    ctx.fillStyle = '#5e8a5e'; for (let k = 0; k < Math.max(2, L / 40); k++) { ctx.beginPath(); ctx.arc(r() * L, r() < 0.5 ? 2 : T - 2, 2 + r() * 2.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(0, 0, L, T, 2); ctx.stroke();
    ctx.restore();
  }
  // kovaný plot (hřbitov, nízké zdi)
  function ironFence(ctx, W, H) {
    const horiz = W >= H, L = horiz ? W : H, T = horiz ? H : W;
    ctx.save(); if (!horiz) { ctx.translate(W, 0); ctx.rotate(Math.PI / 2); }
    ctx.strokeStyle = '#121218'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(1, T / 2); ctx.lineTo(L - 1, T / 2); ctx.stroke();
    ctx.strokeStyle = '#4a4a5c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(1, T / 2); ctx.lineTo(L - 1, T / 2); ctx.stroke();
    for (let x = 4; x < L - 2; x += 10) { const post = (x / 10 | 0) % 4 === 0;
      ctx.fillStyle = post ? '#5a5a70' : '#46465a'; ctx.strokeStyle = '#121218'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, T / 2, post ? 4 : 2.6, 0, 7); ctx.fill(); ctx.stroke();
      if (post) { ctx.fillStyle = '#8a8aa0'; ctx.beginPath(); ctx.arc(x - 1, T / 2 - 1, 1.3, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  const wallCache = new Map(), oldWall = ZS.mapWall;
  ZS.mapWall = function (ctx, mapId, x, y, w, h) {
    if (!on()) return mapId === 3 && ZS.wallQuarry ? ZS.wallQuarry(ctx, x, y, w, h) : oldWall.call(this, ctx, mapId, x, y, w, h);
    const W = Math.max(8, Math.round(w)), H = Math.max(8, Math.round(h));
    const seed = (Math.abs(Math.round(x * 31 + y * 17 + mapId * 7)) % 9973) + 1, v = seed % 4;
    const key = `${mapId}_${W}_${H}_${v}`;
    let spr = wallCache.get(key);
    if (!spr) {
      spr = canvas(W + 10, H + 10); const c = spr.getContext('2d'), r = rng(seed);
      const thin = Math.min(W, H);
      if (mapId !== 3) shadowRect(c, W, H, 4);
      else { c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.roundRect(4, 5, W, H, Math.min(W, H) * 0.3); c.fill(); }
      if (mapId === 0) { if ((W > H * 1.6 && H <= 80) || (H > W * 1.6 && W <= 80)) container(c, W, H, v); else rooftop(c, W, H, v, r); }
      else if (mapId === 1) { if (thin <= 40) picket(c, W, H, v); else house(c, W, H, v, r); }   // 40px zídky jsou ploty / živé ploty
      else if (mapId === 3) boulders(c, W, H, v, r);
      else { if (thin <= 16) ironFence(c, W, H); else if (thin <= 22) stoneWall(c, W, H, v, r); else grave(c, W, H, v, r); }
      wallCache.set(key, spr);
    }
    ctx.drawImage(spr, x, y);
  };

  // ── el. plot: sloupek + dráty k sousedním plotům, jiskry pod proudem ──
  const oldInfra = ZS.infra;
  ZS.infra = function (ctx, type, cx, cy, size, state, ts) {
    if (!on() && type === 'fence' && ZS.fenceLinked) return ZS.fenceLinked(ctx, cx, cy, size || 50, !!(state && state.powered), (state && state.links) || {}, ts);   // grafika od Gemini
    if (!on() || type !== 'fence') return oldInfra.call(this, ctx, type, cx, cy, size, state, ts);
    const S2 = size || 50, h = S2 / 2, st = state || {}, l = st.links || {}, pw = !!st.powered;
    ctx.save(); ctx.translate(cx, cy);
    const dirs = [['e', 1, 0], ['w', -1, 0], ['s', 0, 1], ['n', 0, -1]].filter(d => l[d[0]]);
    for (const [, dx, dy] of dirs.length ? dirs : [['', 1, 0], ['', -1, 0]]) {   // dráty (osamělý plot = krátký kus vodorovně)
      const ex = dx * (dirs.length ? h : h * 0.6), ey = dy * (dirs.length ? h : h * 0.6);
      for (const off of [-4, 4]) { const ox = dy ? off : 0, oy = dx ? off : 0;
        ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex + ox, ey + oy); ctx.stroke();
        ctx.strokeStyle = pw ? '#fde047' : '#8b93a1'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex + ox, ey + oy); ctx.stroke(); }
    }
    box(ctx, -6, -6, 12, 12, 2.5, '#5b6472', OUT, 2.5);                       // sloupek
    ctx.fillStyle = pw ? '#facc15' : '#3a414c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.fill(); ctx.stroke();
    if (pw) {   // jiskry
      const k = Math.floor((ts || 0) / 80), rr = rng(Math.round(cx * 3 + cy * 7) + k);
      ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      for (let i = 0; i < 2; i++) { const a = rr() * 6.28, r1 = 7, r2 = 13 + rr() * 6, m = a + (rr() - 0.5) * 0.8;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(m) * (r1 + r2) / 2, Math.sin(m) * (r1 + r2) / 2); ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); ctx.stroke(); }
    }
    ctx.restore();
  };
  // ── mapa Lom: písek se štěrkem, suché keříky, kameny; balvany jako zdi ──
  function floorQuarry(ctx) {
    const big = floorPatches(ctx, { seed: 83, cut: 0.33, a: [[122, 100, 70], [129, 106, 74], [136, 112, 79]], b: [[108, 94, 72], [114, 99, 76]], edge: [84, 72, 54] });
    const r = rng(29);
    ctx.strokeStyle = 'rgba(70,55,38,.7)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';   // vyschlé praskliny
    for (let i = 0; i < 5; i++) {
      let x = 20 + r() * 216, y = 20 + r() * 216; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 22; y += (r() - 0.5) * 22; ctx.lineTo(x, y); } ctx.stroke();
    }
    for (let t = 0; t < 22; t++) {   // suché keříky
      const x = r() * S, y = r() * S; if (big(x, y) < 0.42) continue; const sc = 0.6 + r() * 0.5;
      wrap(S, (dx, dy) => tuft(ctx, x + dx, y + dy, sc, r() < 0.5 ? '#9a8a4e' : '#8a7a42', '#3d331c'));
    }
    for (let i = 0; i < 8; i++) stone(ctx, 10 + r() * (S - 20), 10 + r() * (S - 20), 2 + r() * 4, r(), '#8f857a', '#aea398', '#3d362e');
  }
  FLOORS[3] = floorQuarry;
  // balvany: obdélník zdi se rozdělí na 1–4 kameny, každý ho vyplní skoro celý (jen seříznuté rohy),
  // aby tvar odpovídal tomu, do čeho hráč i zombie narazí; plošky ve dvou tónech, obrys, prasklina
  function boulders(ctx, W, H, v, r) {
    const horiz = W >= H, T = Math.min(W, H), n = Math.max(1, Math.min(4, Math.round(Math.max(W, H) / T))), L = Math.max(W, H) / n;
    const pal = [['#8a8178', '#a1978c', '#6f675f'], ['#7f776e', '#978d82', '#655e56']][v % 2];
    for (let i = 0; i < n; i++) {
      const x0 = horiz ? L * i : 0, y0 = horiz ? 0 : L * i, w = horiz ? L : W, h = horiz ? H : L, c = Math.min(w, h) * (0.18 + r() * 0.12);
      const j = () => (r() - 0.5) * Math.min(w, h) * 0.08;
      const pts = [[x0 + c + j(), y0 + 1], [x0 + w * 0.5 + j(), y0 + 1 + Math.abs(j())], [x0 + w - c + j(), y0 + 1], [x0 + w - 1, y0 + c + j()], [x0 + w - 1 - Math.abs(j()), y0 + h * 0.5 + j()],
        [x0 + w - 1, y0 + h - c + j()], [x0 + w - c + j(), y0 + h - 1], [x0 + w * 0.5 + j(), y0 + h - 1 - Math.abs(j())], [x0 + c + j(), y0 + h - 1], [x0 + 1, y0 + h - c + j()], [x0 + 1 + Math.abs(j()), y0 + h * 0.5 + j()], [x0 + 1, y0 + c + j()]];
      const cx = x0 + w / 2, cy = y0 + h / 2, path = () => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
      ctx.fillStyle = pal[0]; path(); ctx.fill();
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.moveTo(pts[10][0], pts[10][1]); for (const k of [11, 0, 1]) ctx.lineTo(pts[k][0], pts[k][1]); ctx.lineTo(cx - w * 0.08, cy - h * 0.06); ctx.closePath(); ctx.fill();   // světlá ploška
      ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.moveTo(pts[4][0], pts[4][1]); for (const k of [5, 6, 7]) ctx.lineTo(pts[k][0], pts[k][1]); ctx.lineTo(cx + w * 0.1, cy + h * 0.08); ctx.closePath(); ctx.fill();   // stinná ploška
      ctx.strokeStyle = 'rgba(30,26,22,.65)'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.22, cy - h * 0.05); ctx.lineTo(cx - w * 0.02, cy + h * 0.12); ctx.lineTo(cx + w * 0.16, cy + h * 0.02); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; path(); ctx.stroke();
    }
  }

  // ── Plivač: nafouklé zelené tělo s vaky, velká tlama dopředu, kapky slin ──
  const zCache = new Map(), oldZombie = ZS.zombie;
  function bakeSpitter(R) {
    const s2 = Math.ceil(R * 3), c = canvas(s2, s2), ctx = c.getContext('2d');
    ctx.translate(s2 / 2, s2 / 2);
    const o = Math.max(1.8, R * 0.13), line = '#141814';
    ctx.fillStyle = '#4d7c32'; ctx.strokeStyle = line; ctx.lineWidth = o;                 // ruce
    for (const sy of [-1, 1]) { ctx.beginPath(); ctx.roundRect(-R * 0.1, sy * R * 0.55 - R * 0.17, R * 0.9, R * 0.34, R * 0.15); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#6b9a3a'; ctx.beginPath(); ctx.ellipse(-R * 0.15, 0, R * 0.95, R * 0.85, 0, 0, 7); ctx.fill(); ctx.stroke();   // nafouklé tělo
    ctx.fillStyle = '#c4d64a'; for (const [x, y, rr] of [[-R * 0.55, -R * 0.42, 0.26], [-R * 0.62, R * 0.35, 0.22], [-R * 0.2, R * 0.55, 0.18]]) {   // jedové vaky
      ctx.beginPath(); ctx.arc(x, y, R * rr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - R * rr * 0.35, y - R * rr * 0.35, R * rr * 0.35, 0, 7); ctx.fill(); ctx.fillStyle = '#c4d64a'; }
    ctx.fillStyle = '#7fae45'; ctx.beginPath(); ctx.arc(R * 0.35, 0, R * 0.55, 0, 7); ctx.fill(); ctx.stroke();                 // hlava
    ctx.fillStyle = '#1a2e05'; ctx.beginPath(); ctx.ellipse(R * 0.68, 0, R * 0.22, R * 0.3, 0, 0, 7); ctx.fill();               // tlama
    ctx.fillStyle = '#a3e635'; ctx.beginPath(); ctx.arc(R * 0.78, R * 0.12, R * 0.1, 0, 7); ctx.fill();                            // slina
    ctx.fillStyle = '#facc15'; for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(R * 0.42, sy * R * 0.3, R * 0.11, 0, 7); ctx.fill(); }   // oči
    return c;
  }

  // ── další zombie (vše kreslené čelem doprava = +x, obrys #141814) ──
  const ZL = '#141814';
  const zc = R => { const s2 = Math.ceil(R * 3), c = canvas(s2, s2), x = c.getContext('2d'); x.translate(s2 / 2, s2 / 2); return [c, x, Math.max(1.8, R * 0.13)]; };
  const ball = (x, cx, cy, r, fill, o) => { x.fillStyle = fill; x.strokeStyle = ZL; x.lineWidth = o; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); if (o) x.stroke(); };
  const rr = (x, a, b, w, h, r, fill, o) => { x.fillStyle = fill; x.strokeStyle = ZL; x.lineWidth = o; x.beginPath(); x.roundRect(a, b, w, h, r); x.fill(); if (o) x.stroke(); };
  const eyes = (x, R, cx, col = '#ef4444', sz = 0.13, sp = 0.25) => { x.fillStyle = col; for (const sy of [-1, 1]) { x.beginPath(); x.arc(cx, sy * R * sp, R * sz, 0, 7); x.fill(); } };
  function bakeShield(R) {   // Štítonoš: zombie za velkým policejním štítem
    const [c, x, o] = zc(R);
    rr(x, -R * 0.75, -R * 0.85, R * 1.1, R * 1.7, R * 0.45, '#3b4252', o);          // tělo
    ball(x, R * 0.05, 0, R * 0.58, '#65a368', o);                                    // hlava
    eyes(x, R, R * 0.38);
    rr(x, R * 0.45, -R * 0.7, R * 0.3, R * 0.25, R * 0.1, '#4d7c4f', o);             // ruka drží štít
    rr(x, R * 0.62, -R * 1.12, R * 0.34, R * 2.24, R * 0.14, '#6b7a8f', o);          // štít
    x.fillStyle = '#a5b8cc'; x.fillRect(R * 0.68, -R * 0.75, R * 0.2, R * 0.55);    // průzor
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(R * 0.66, -R * 1.05, R * 0.06, R * 2.1);
    x.fillStyle = '#2a3140'; for (const yy of [-0.95, 0, 0.95]) { x.beginPath(); x.arc(R * 0.79, R * yy, R * 0.05, 0, 7); x.fill(); }
    return c;
  }
  function bakeLeaper(R) {   // Skokan: přikrčený, dlouhé zadní nohy, ostny na zádech
    const [c, x, o] = zc(R);
    x.strokeStyle = ZL; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const sy of [-1, 1]) {   // nohy (zalomené dozadu)
      x.lineWidth = R * 0.34 + o; x.beginPath(); x.moveTo(-R * 0.2, sy * R * 0.35); x.lineTo(-R * 0.95, sy * R * 0.75); x.lineTo(-R * 0.55, sy * R * 1.05); x.stroke();
      x.strokeStyle = '#6f8f3a'; x.lineWidth = R * 0.34; x.beginPath(); x.moveTo(-R * 0.2, sy * R * 0.35); x.lineTo(-R * 0.95, sy * R * 0.75); x.lineTo(-R * 0.55, sy * R * 1.05); x.stroke(); x.strokeStyle = ZL;
    }
    x.fillStyle = '#8aa64a'; x.strokeStyle = ZL; x.lineWidth = o; x.beginPath(); x.ellipse(-R * 0.05, 0, R * 0.85, R * 0.55, 0, 0, 7); x.fill(); x.stroke();   // tělo
    x.fillStyle = '#4f6a24'; for (let i = 0; i < 4; i++) { const px = -R * 0.6 + i * R * 0.32; x.beginPath(); x.moveTo(px - R * 0.1, -R * 0.1); x.lineTo(px, -R * 0.42); x.lineTo(px + R * 0.1, -R * 0.1); x.closePath(); x.fill(); x.stroke(); }   // ostny
    for (const sy of [-1, 1]) rr(x, R * 0.45, sy * R * 0.42 - R * 0.1, R * 0.5, R * 0.2, R * 0.08, '#6f8f3a', o);   // pařáty
    ball(x, R * 0.55, 0, R * 0.4, '#a3bd5c', o); eyes(x, R, R * 0.75, '#facc15', 0.1, 0.18);
    return c;
  }
  function bakeSplitter(R) {   // Dělič: nafouklé fialové tělo se třemi zárodky
    const [c, x, o] = zc(R);
    for (const sy of [-1, 1]) rr(x, R * 0.2, sy * R * 0.6 - R * 0.14, R * 0.6, R * 0.28, R * 0.12, '#7a4e7c', o);
    ball(x, -R * 0.1, 0, R * 0.92, '#8b5a8c', o);
    x.strokeStyle = 'rgba(60,20,60,.55)'; x.lineWidth = 1.4;   // žilky
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; x.beginPath(); x.moveTo(-R * 0.1, 0); x.quadraticCurveTo(Math.cos(a + 0.4) * R * 0.5 - R * 0.1, Math.sin(a + 0.4) * R * 0.5, Math.cos(a) * R * 0.85 - R * 0.1, Math.sin(a) * R * 0.85); x.stroke(); }
    for (const [px, py] of [[-R * 0.5, -R * 0.35], [-R * 0.55, R * 0.38], [-R * 0.05, R * 0.55]]) { ball(x, px, py, R * 0.27, '#d8a2e8', o); x.fillStyle = '#5b2a5e'; x.beginPath(); x.arc(px + R * 0.06, py, R * 0.08, 0, 7); x.fill(); }   // zárodky
    ball(x, R * 0.48, 0, R * 0.38, '#a273a3', o); eyes(x, R, R * 0.66, '#f472b6', 0.1, 0.16);
    return c;
  }
  function bakeMini(R) {   // Drobek: malý fialový zárodek s očima a zoubky
    const [c, x, o] = zc(R);
    ball(x, 0, 0, R * 0.95, '#d8a2e8', o);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(-R * 0.3, -R * 0.3, R * 0.25, 0, 7); x.fill();
    eyes(x, R, R * 0.35, '#3b0a3e', 0.18, 0.32);
    x.fillStyle = '#fff'; for (const sy of [-0.15, 0.15]) { x.beginPath(); x.moveTo(R * 0.7, R * sy - R * 0.1); x.lineTo(R * 0.92, R * sy); x.lineTo(R * 0.7, R * sy + R * 0.1); x.fill(); }
    return c;
  }
  function bakeScreamer(R) {   // Křikloun: bledý, obří otevřená tlama, zvukové vlny
    const [c, x, o] = zc(R);
    for (const sy of [-1, 1]) rr(x, -R * 0.2, sy * R * 0.62 - R * 0.13, R * 0.75, R * 0.26, R * 0.12, '#8d978f', o);
    rr(x, -R * 0.7, -R * 0.7, R * 1, R * 1.4, R * 0.4, '#4b4f5a', o);
    ball(x, R * 0.2, 0, R * 0.62, '#b9c2bd', o);
    x.fillStyle = '#2a0a0a'; x.strokeStyle = ZL; x.lineWidth = o * 0.8; x.beginPath(); x.ellipse(R * 0.52, 0, R * 0.3, R * 0.38, 0, 0, 7); x.fill(); x.stroke();   // tlama
    x.fillStyle = '#f5f0e1'; for (const sy of [-1, 1]) for (let i = 0; i < 3; i++) { const yy = sy * R * 0.28, xx = R * (0.38 + i * 0.12); x.beginPath(); x.moveTo(xx - R * 0.05, yy); x.lineTo(xx, yy - sy * R * 0.1); x.lineTo(xx + R * 0.05, yy); x.fill(); }
    eyes(x, R, R * 0.12, '#111', 0.09, 0.32);
    x.strokeStyle = '#fde047'; x.lineWidth = R * 0.09; x.lineCap = 'round';   // vlny křiku
    for (const k of [1, 2]) { x.beginPath(); x.arc(R * 0.6, 0, R * (0.45 + k * 0.28), -0.6, 0.6); x.stroke(); }
    return c;
  }
  function bakeHealer(R) {   // Uzdravovač: zombie v plášti s batohem lahviček a zeleným křížem
    const [c, x, o] = zc(R);
    rr(x, -R * 1.05, -R * 0.55, R * 0.5, R * 1.1, R * 0.15, '#6b4f36', o);            // batoh
    for (const yy of [-0.32, 0, 0.32]) { ball(x, -R * 0.82, R * yy, R * 0.15, '#4ade80', o * 0.7); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(-R * 0.86, R * yy - R * 0.05, R * 0.05, 0, 7); x.fill(); }
    for (const sy of [-1, 1]) rr(x, 0, sy * R * 0.55 - R * 0.14, R * 0.95, R * 0.28, R * 0.12, '#4d7c4f', o);
    rr(x, -R * 0.65, -R * 0.82, R * 1.1, R * 1.64, R * 0.42, '#d9dde3', o);           // plášť
    x.fillStyle = '#22c55e'; x.fillRect(-R * 0.3, -R * 0.08, R * 0.4, R * 0.16); x.fillRect(-R * 0.18, -R * 0.2, R * 0.16, R * 0.4);   // zelený kříž
    ball(x, R * 0.25, 0, R * 0.52, '#65a368', o); eyes(x, R, R * 0.52);
    return c;
  }
  const ZBAKE = { spitter: bakeSpitter, shield: bakeShield, leaper: bakeLeaper, splitter: bakeSplitter, mini: bakeMini, screamer: bakeScreamer, healer: bakeHealer };
  ZS.zombie = function (ctx, type, x, y, r, angle, ts, hitFlash) {
    if (!ZBAKE[type]) return oldZombie.call(this, ctx, type, x, y, r, angle, ts, hitFlash);
    if (!on() && ZS.zombieExtra && ZS.zombieExtra(ctx, type, x, y, r, angle, ts, hitFlash)) return;   // grafika od Gemini
    const R = Math.max(8, Math.round(r)), key = type + R; let spr = zCache.get(key);
    if (!spr) {
      const body = ZBAKE[type](R), flash = canvas(body.width, body.height), f = flash.getContext('2d');
      f.drawImage(body, 0, 0); f.globalCompositeOperation = 'source-in'; f.fillStyle = '#fff'; f.fillRect(0, 0, flash.width, flash.height);
      spr = { body, flash }; zCache.set(key, spr);
    }
    const ph = (x + y) * 0.05 + (ts || 0) * (type === 'mini' ? 0.02 : 0.008), puff = type === 'spitter' || type === 'splitter' ? 1 + Math.sin((ts || 0) * 0.006 + x) * 0.05 : 1;   // nafukuje se jen Plivač a Dělič
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(2, 4, R * 0.95, R * 0.8, 0, 0, 7); ctx.fill();
    ctx.rotate(angle + Math.sin(ph) * 0.08); ctx.scale(puff, puff);
    ctx.drawImage(spr.body, -spr.body.width / 2, -spr.body.height / 2);
    if (hitFlash > 0.01) { ctx.globalAlpha = Math.min(1, hitFlash); ctx.drawImage(spr.flash, -spr.body.width / 2, -spr.body.height / 2); }
    ctx.restore();
  };
})();

/* td-super-map.js — Super grafika (td_gfx '2'): mapa. Tráva, cesta, voda, překážky, jeskyně, hrad,
 * stromy na okrajích a živé prostředí (stíny mraků, motýli, vlnky). Registruje do window.TDSS:
 *   background(map) → plátno 1040×720 (předkreslí se jednou), water(ctx, zone, ts), frozenWater(ctx, zone),
 *   clearedObstacle(ctx, o), ambient(ctx, ts), clearCacheMap().
 * Styl jako td-super-a.js: tmavé obrysy #111, světlo shora zleva, vrstvené stíny bez rozmazání. */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const OUT = '#111', PI = Math.PI, TAU = PI * 2, W = 1040, H = 720;
  const GRASS = '#62b53d';

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
  function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function ellipsePath(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  function paint(ctx, fill, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function fillA(ctx, col, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.fill(); ctx.restore(); }
  function softShadow(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.09; ellipsePath(ctx, x + 5, y + 6, rx + 3, ry + 3); ctx.fill();
    ctx.globalAlpha = 0.12; ellipsePath(ctx, x + 3.5, y + 4, rx + 1, ry + 1); ctx.fill();
    ctx.globalAlpha = 0.1; ellipsePath(ctx, x + 2, y + 2, Math.max(1, rx - 1), Math.max(1, ry - 1)); ctx.fill();
    ctx.restore();
  }
  // Kámen: nepravidelný mnohoúhelník s obrysem, světlou ploškou vlevo nahoře a tmavou vpravo dole
  function stone(ctx, x, y, r, col, R, lw) {
    const n = 6 + ((R() * 3) | 0), pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * 0.4, q = r * (0.78 + R() * 0.3); pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q * 0.86]); }
    polyPath(ctx, pts); paint(ctx, col, lw || 1.4);
    ctx.save(); polyPath(ctx, pts); ctx.clip();
    ellipsePath(ctx, x + r * 0.35, y + r * 0.4, r * 0.9, r * 0.6); fillA(ctx, '#000', 0.2);
    ellipsePath(ctx, x - r * 0.35, y - r * 0.35, r * 0.45, r * 0.3, -0.5); fillA(ctx, '#fff', 0.35);
    ctx.restore();
  }
  function dist2Seg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py; return qx * qx + qy * qy;
  }
  function distToPaths(paths, x, y) {
    let best = 1e12;
    for (const p of paths) for (let i = 1; i < p.length; i++) best = Math.min(best, dist2Seg(x, y, p[i - 1].x, p[i - 1].y, p[i].x, p[i].y));
    return Math.sqrt(best);
  }
  function inZones(zones, x, y, m) { return zones.some(function (z) { return x > z.x - m && x < z.x + z.width + m && y > z.y - m && y < z.y + z.height + m; }); }
  // Posunutá lomená čára (koleje na cestě): průměr normál sousedních úseků
  function offsetLine(pts, d) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(pts.length - 1, i + 1)];
      let n1x = -(b.y - a.y), n1y = b.x - a.x, n2x = -(c.y - b.y), n2y = c.x - b.x;
      const l1 = Math.hypot(n1x, n1y) || 1, l2 = Math.hypot(n2x, n2y) || 1;
      n1x /= l1; n1y /= l1; n2x /= l2; n2y /= l2;
      if (i === 0) { n1x = n2x; n1y = n2y; } if (i === pts.length - 1) { n2x = n1x; n2y = n1y; }
      let mx = n1x + n2x, my = n1y + n2y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const k = d / Math.max(0.5, mx * n1x + my * n1y);
      out.push({ x: b.x + mx * k, y: b.y + my * k });
    }
    return out;
  }
  function linePath(ctx, pts) { ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); }
  function along(pts, step, fn) {   // body po cestě každých `step` px: fn(x, y, úhel)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      for (let d = 0; d < l; d += step) fn(a.x + (b.x - a.x) * d / l, a.y + (b.y - a.y) * d / l, ang);
    }
  }

  /* ---------- Tráva ---------- */
  function grass(ctx, R) {
    ctx.fillStyle = GRASS; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {   // velké plochy světlejší a tmavší trávy
      const c = R();
      ctx.fillStyle = c < 0.4 ? '#59a937' : c < 0.8 ? '#6cc046' : '#77c94e';
      ellipsePath(ctx, R() * W, R() * H, 40 + R() * 80, 26 + R() * 50, R() * PI); ctx.fill();
    }
    const sun = ctx.createLinearGradient(0, 0, W, H);   // světlo shora zleva (jen jednou do mezipaměti)
    sun.addColorStop(0, 'rgba(255,250,200,0.14)'); sun.addColorStop(0.55, 'rgba(0,0,0,0)'); sun.addColorStop(1, 'rgba(10,40,10,0.16)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {   // stébla
      const x = R() * W, y = R() * H, h = 3 + R() * 4, lean = (R() - 0.5) * 3;
      ctx.strokeStyle = R() < 0.55 ? 'rgba(52,110,30,0.55)' : 'rgba(150,220,100,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lean, y - h); ctx.stroke();
    }
  }
  function tuft(ctx, x, y, s, R) {   // trs trávy s obrysem
    ctx.beginPath();
    const n = 4 + ((R() * 3) | 0);
    ctx.moveTo(x - s, y);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, bx = x - s + t * 2 * s; ctx.lineTo(bx + (R() - 0.5) * s * 0.5, y - s * (1.1 + R() * 0.9)); ctx.lineTo(x - s + (i + 1) / n * 2 * s, y); }
    ctx.closePath(); ctx.fillStyle = R() < 0.5 ? '#4f9e2e' : '#5aae35'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#2c6219'; ctx.lineJoin = 'round'; ctx.stroke();   // tráva má tmavě zelený obrys, černý by působil jako špína
  }
  function flowers(ctx, x, y, R) {
    const cols = ['#fff7e0', '#ffd84a', '#ff8fb8', '#b9a4ff', '#ff6b5e'], col = cols[(R() * cols.length) | 0], n = 2 + ((R() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const fx = x + (R() - 0.5) * 18, fy = y + (R() - 0.5) * 12;
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; circlePath(ctx, fx + Math.cos(a) * 2.3, fy + Math.sin(a) * 2.3, 1.9); paint(ctx, col, 0.7); }
      circlePath(ctx, fx, fy, 1.3); paint(ctx, '#f0a020', 0.6);
    }
  }
  function mushroom(ctx, x, y, R) {
    softShadow(ctx, x, y, 5, 3);
    circlePath(ctx, x, y, 5 + R() * 2); paint(ctx, '#e0362c', 1.3);
    for (let i = 0; i < 4; i++) { circlePath(ctx, x + (R() - 0.5) * 6, y + (R() - 0.5) * 6, 1 + R()); ctx.fillStyle = '#fff'; ctx.fill(); }
  }

  /* ---------- Stromy a keře ---------- */
  function canopy(ctx, x, y, s, base, R, fruit) {
    const blobs = [];
    const n = 5 + ((R() * 3) | 0);
    blobs.push([x, y, s * 0.62]);
    for (let i = 0; i < n; i++) { const a = i / n * TAU + R() * 0.5, d = s * (0.38 + R() * 0.15); blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.38 + R() * 0.16)]); }
    softShadow(ctx, x + s * 0.15, y + s * 0.2, s * 1.05, s * 0.95);
    ctx.save(); ctx.lineWidth = 3.2; ctx.strokeStyle = OUT;
    for (const b of blobs) { circlePath(ctx, b[0], b[1], b[2]); ctx.stroke(); }
    ctx.fillStyle = base; for (const b of blobs) { circlePath(ctx, b[0], b[1], b[2]); ctx.fill(); }
    ctx.restore();
    for (const b of blobs) { circlePath(ctx, b[0] + b[2] * 0.25, b[1] + b[2] * 0.3, b[2] * 0.75); fillA(ctx, shade(base, -0.35), 0.45); }   // stín vpravo dole
    for (const b of blobs) { circlePath(ctx, b[0] - b[2] * 0.25, b[1] - b[2] * 0.3, b[2] * 0.5); fillA(ctx, shade(base, 0.25), 0.7); }   // světlo vlevo nahoře
    for (let i = 0; i < 6; i++) { const b = blobs[(R() * blobs.length) | 0]; circlePath(ctx, b[0] - b[2] * 0.3 + (R() - 0.5) * 4, b[1] - b[2] * 0.35 + (R() - 0.5) * 4, 1.6); fillA(ctx, '#fff', 0.45); }
    if (fruit) for (let i = 0; i < 5; i++) { const b = blobs[(R() * blobs.length) | 0]; circlePath(ctx, b[0] + (R() - 0.5) * b[2], b[1] + (R() - 0.5) * b[2], 2.4); paint(ctx, fruit, 0.9); }
  }
  function pine(ctx, x, y, s, R) {
    softShadow(ctx, x + s * 0.2, y + s * 0.25, s * 0.95, s * 0.9);
    for (let l = 0; l < 3; l++) {
      const r = s * (1 - l * 0.3), n = 8, pts = [];
      for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + l * 0.4, q = i % 2 ? r * 0.74 : r; pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); }
      polyPath(ctx, pts); paint(ctx, l === 0 ? '#3d8f45' : l === 1 ? '#4fa656' : '#66bd69', l === 0 ? 2.2 : 1.4);
    }
    circlePath(ctx, x - s * 0.12, y - s * 0.12, s * 0.14); fillA(ctx, '#fff', 0.35);
  }
  function bush(ctx, x, y, s, R) { canopy(ctx, x, y, s, R() < 0.5 ? '#4f9e33' : '#5fae3b', R, R() < 0.4 ? '#e8463a' : null); }

  /* ---------- Cesta ---------- */
  function road(ctx, paths, half, R) {
    const pass = function (w, col, a, dx, dy) {
      ctx.save(); ctx.translate(dx || 0, dy || 0); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const p of paths) { linePath(ctx, p); ctx.stroke(); }
      ctx.restore();
    };
    pass(half * 2 + 14, '#000', 0.16, 4, 5);   // stín cesty
    pass(half * 2 + 7, OUT, 1);                 // obrys
    pass(half * 2 + 2, '#8a5a2b', 1);           // tmavý okraj
    pass(half * 2 - 3, '#c99a5b', 1);           // hlína
    pass(half * 1.15, '#d8ae6e', 0.85);         // vyšlapaný střed
    ctx.save(); ctx.strokeStyle = 'rgba(110,70,30,0.35)'; ctx.lineWidth = 3.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const p of paths) for (const d of [-half * 0.42, half * 0.42]) { linePath(ctx, offsetLine(p, d)); ctx.stroke(); }   // koleje od vozíků
    ctx.restore();
    for (const p of paths) along(p, 7, function (x, y, ang) {   // drobné kamínky a hrudky
      if (R() < 0.45) return;
      const o = (R() - 0.5) * half * 1.6, px = x + Math.cos(ang + PI / 2) * o, py = y + Math.sin(ang + PI / 2) * o;
      if (R() < 0.18) stone(ctx, px, py, 2.2 + R() * 2, R() < 0.5 ? '#a58d6c' : '#9a9a92', R, 0.9);
      else { circlePath(ctx, px, py, 0.8 + R() * 1.4); fillA(ctx, R() < 0.5 ? '#6e4520' : '#f2d7a0', 0.45); }
    });
    for (const p of paths) along(p, 26, function (x, y, ang) {   // trsy trávy přerůstající přes okraj cesty
      if (R() < 0.35) return;
      const sd = R() < 0.5 ? -1 : 1, o = sd * (half + 3), px = x + Math.cos(ang + PI / 2) * o, py = y + Math.sin(ang + PI / 2) * o;
      tuft(ctx, px, py + 2, 3.5 + R() * 2.5, R);
    });
  }

  /* ---------- Voda ---------- */
  function perimeter(z, step, fn) {   // body po obvodu obdélníku se zaoblením (pro kameny břehu)
    const P = [[z.x, z.y], [z.x + z.width, z.y], [z.x + z.width, z.y + z.height], [z.x, z.y + z.height]];
    for (let i = 0; i < 4; i++) {
      const a = P[i], b = P[(i + 1) % 4], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d < l; d += step) fn(a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l);
    }
  }
  function pond(ctx, z, R) {
    const r = 26;
    roundRect(ctx, z.x - 9, z.y - 8, z.width + 22, z.height + 20, r + 8); fillA(ctx, '#000', 0.16);
    roundRect(ctx, z.x - 12, z.y - 12, z.width + 24, z.height + 24, r + 10); paint(ctx, '#d9c48c', 3);   // písčitý břeh
    roundRect(ctx, z.x - 4, z.y - 4, z.width + 8, z.height + 8, r + 3); paint(ctx, '#2f8fcf', 2.5);
    roundRect(ctx, z.x + 14, z.y + 14, z.width - 28, z.height - 28, r - 6); ctx.fillStyle = '#2479b8'; ctx.fill();   // hloubka
    roundRect(ctx, z.x + 32, z.y + 32, z.width - 64, z.height - 64, r - 12); fillA(ctx, '#1b6aa6', 0.7);
    roundRect(ctx, z.x, z.y, z.width, z.height, r); ctx.strokeStyle = 'rgba(160,225,255,0.65)'; ctx.lineWidth = 3; ctx.stroke();   // světlý okraj u břehu
    // kameny po obvodu
    perimeter({ x: z.x - 8, y: z.y - 8, width: z.width + 16, height: z.height + 16 }, 17, function (x, y) {
      const cx = z.x + z.width / 2, cy = z.y + z.height / 2;
      if (Math.abs(x - cx) > z.width / 2 + 2 && Math.abs(y - cy) > z.height / 2 + 2) return;   // rohy (jsou zaoblené)
      if (R() < 0.3) return;
      stone(ctx, x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, 5 + R() * 3.5, ['#9aa1a8', '#b3b9be', '#878e95'][(R() * 3) | 0], R, 1.3);
    });
    // lekníny a květ
    const nPads = 2 + ((R() * 3) | 0);
    for (let i = 0; i < nPads; i++) {
      const px = z.x + 26 + R() * (z.width - 52), py = z.y + 26 + R() * (z.height - 52), pr = 7 + R() * 5, rot = R() * TAU;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, pr, rot + 0.5, rot + TAU - 0.1); ctx.closePath(); paint(ctx, '#4cae3c', 1.4);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, pr * 0.55, rot + 0.9, rot + 2.6); ctx.closePath(); fillA(ctx, '#8edb68', 0.6);
      if (i === 0) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ellipsePath(ctx, px + Math.cos(a) * 3, py + Math.sin(a) * 3, 3.2, 1.8, a); paint(ctx, '#ffb3d1', 0.8); } circlePath(ctx, px, py, 1.8); paint(ctx, '#ffd84a', 0.6); }
    }
    // rákosí v rozích
    for (const [cx, cy] of [[z.x + 6, z.y + 8], [z.x + z.width - 8, z.y + z.height - 6]]) {
      for (let i = 0; i < 5; i++) {
        const rx = cx + (R() - 0.5) * 16, ry = cy + (R() - 0.5) * 14, len = 9 + R() * 6, a = -PI / 2 + (R() - 0.5) * 0.7;
        ctx.save(); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a) * len, ry + Math.sin(a) * len);
        ctx.strokeStyle = OUT; ctx.lineWidth = 3.6; ctx.stroke(); ctx.strokeStyle = '#5a9a35'; ctx.lineWidth = 1.8; ctx.stroke();
        ellipsePath(ctx, rx + Math.cos(a) * len, ry + Math.sin(a) * len, 1.9, 3.6, a + PI / 2); paint(ctx, '#7a4a22', 1);
        ctx.restore();
      }
    }
  }
  // Živá vrstva vody: posouvající se vlnky a třpyt (každý snímek, levné)
  TDS.water = function (ctx, z, ts) {
    ctx.save();
    roundRect(ctx, z.x + 4, z.y + 4, z.width - 8, z.height - 8, 22); ctx.clip();
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(210,240,255,0.55)'; ctx.lineWidth = 2;
    const t = ts / 1000;
    for (let i = 0; i < 6; i++) {
      const yy = z.y + 22 + i * (z.height - 44) / 5, xx = z.x + 10 + ((t * 16 + i * 53) % (z.width + 20)) - 10, w = 10 + (i % 3) * 4;
      ctx.beginPath(); ctx.moveTo(xx - w, yy); ctx.quadraticCurveTo(xx, yy - 4, xx + w, yy); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.9 + i * 0.37) % 1, a = Math.sin(ph * PI);
      const sx = z.x + 20 + ((i * 97 + Math.floor(t * 0.9 + i * 0.37) * 61) % Math.max(1, z.width - 40)), sy = z.y + 20 + ((i * 53 + Math.floor(t * 0.9 + i * 0.37) * 37) % Math.max(1, z.height - 40));
      ctx.globalAlpha = a; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1, sy - 1); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx + 1, sy + 1); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1, sy + 1); ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1, sy - 1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  TDS.frozenWater = function (ctx, z) {
    ctx.save();
    roundRect(ctx, z.x - 2, z.y - 2, z.width + 4, z.height + 4, 26); ctx.fillStyle = 'rgba(214,240,255,0.88)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#7cc3ea'; ctx.stroke();
    ctx.clip();
    const R = makeRng(hash('ice' + z.x + ',' + z.y));
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {   // praskliny
      let x = z.x + R() * z.width, y = z.y + R() * z.height;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.strokeStyle = 'rgba(120,180,215,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    for (let i = 0; i < 4; i++) { ellipsePath(ctx, z.x + 20 + R() * (z.width - 40), z.y + 15 + R() * (z.height - 30), 14 + R() * 10, 4 + R() * 3, -0.5); fillA(ctx, '#fff', 0.55); }
    ctx.restore();
  };

  /* ---------- Překážky ---------- */
  function boulder(ctx, o, R) {
    const cx = o.x + o.width / 2, cy = o.y + o.height / 2, s = Math.min(o.width, o.height) / 2;
    softShadow(ctx, cx + 4, cy + 6, o.width * 0.5, o.height * 0.45);
    const rocks = [[cx - s * 0.3, cy + s * 0.15, s * 0.62], [cx + s * 0.35, cy + s * 0.2, s * 0.5], [cx, cy - s * 0.25, s * 0.7]];
    for (const r of rocks) stone(ctx, r[0], r[1], r[2], ['#8e959c', '#9ea5ab', '#858b92'][(R() * 3) | 0], R, 2.6);
    for (let i = 0; i < 4; i++) { ellipsePath(ctx, cx - s * 0.2 + (R() - 0.5) * s, cy - s * 0.45 + (R() - 0.5) * s * 0.4, 6 + R() * 6, 3 + R() * 3, R() * PI); paint(ctx, '#5f9e3a', 1.2); }   // mech
    for (let i = 0; i < 4; i++) tuft(ctx, cx + (R() - 0.5) * o.width * 0.9, cy + o.height * 0.38, 4 + R() * 2, R);
  }
  function cliff(ctx, o, R) {
    const cx = o.x + o.width / 2, cy = o.y + o.height / 2;
    softShadow(ctx, cx + 6, cy + 8, o.width * 0.55, o.height * 0.5);
    const slabs = [];
    for (let i = 0; i < 7; i++) slabs.push([o.x + o.width * (0.18 + R() * 0.64), o.y + o.height * (0.2 + R() * 0.6), Math.min(o.width, o.height) * (0.22 + R() * 0.14)]);
    slabs.sort(function (a, b) { return a[1] - b[1]; });
    for (const s of slabs) { stone(ctx, s[0] + 3, s[1] + 5, s[2], '#6b7178', R, 2.4); stone(ctx, s[0], s[1], s[2] * 0.92, ['#9aa0a6', '#a9aeb3', '#8f959b'][(R() * 3) | 0], R, 2.4); }   // spodní stěna a horní ploška
    for (let i = 0; i < 5; i++) { const s = slabs[(R() * slabs.length) | 0]; ellipsePath(ctx, s[0] - s[2] * 0.2, s[1] - s[2] * 0.3, s[2] * 0.45, s[2] * 0.25, R() * PI); paint(ctx, '#5aa137', 1.2); }
    ctx.save(); ctx.strokeStyle = 'rgba(40,40,40,0.55)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const s = slabs[(R() * slabs.length) | 0]; ctx.beginPath(); ctx.moveTo(s[0] - s[2] * 0.3, s[1]); ctx.lineTo(s[0], s[1] + s[2] * 0.2); ctx.lineTo(s[0] + s[2] * 0.15, s[1] + s[2] * 0.45); ctx.stroke(); }
    ctx.restore();
  }
  function ruinedTower(ctx, o, R) {
    const cx = o.x + o.width / 2, cy = o.y + o.height / 2, r = Math.min(o.width, o.height) * 0.42;
    softShadow(ctx, cx + 3, cy + 5, r * 1.1, r * 1.05);
    circlePath(ctx, cx, cy, r); paint(ctx, '#8a8f96', 2.6);   // podlaha
    circlePath(ctx, cx, cy, r * 0.72); ctx.fillStyle = '#767b82'; ctx.fill();
    ctx.save(); circlePath(ctx, cx, cy, r * 0.72); ctx.clip(); ctx.strokeStyle = 'rgba(40,40,40,0.35)'; ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.24, cy - r); ctx.lineTo(cx + i * r * 0.24, cy + r); ctx.moveTo(cx - r, cy + i * r * 0.24); ctx.lineTo(cx + r, cy + i * r * 0.24); ctx.stroke(); }
    ctx.restore();
    // zbytky hradeb: části prstence
    for (const [a0, a1] of [[-2.9, -1.2], [-0.6, 0.9], [1.6, 2.6]]) {
      ctx.save(); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, a0, a1); ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.3 + 4; ctx.stroke();
      ctx.strokeStyle = '#a7acb2'; ctx.lineWidth = r * 0.3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, a0 + 0.05, a1 - 0.05); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,30,30,0.45)'; ctx.lineWidth = 1.2;
      for (let a = a0 + 0.25; a < a1; a += 0.3) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) { const a = R() * TAU, d = r * (0.3 + R() * 0.9); stone(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3 + R() * 4, ['#a7acb2', '#8e949a'][(R() * 2) | 0], R, 1.2); }   // sutiny
    ctx.save(); ctx.translate(cx + r * 0.1, cy + r * 0.05); ctx.rotate(0.6);   // spadlý trám
    roundRect(ctx, -r * 0.55, -3.5, r * 1.1, 7, 2); paint(ctx, '#8a5a2b', 1.8);
    ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(r * 0.45, 0); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 5; i++) { const a = R() * TAU; ellipsePath(ctx, cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85, 5 + R() * 4, 3, a); paint(ctx, '#5f9e3a', 1); }   // mech
  }
  function obstacle(ctx, o, R) {
    const n = (o.name || '').toLowerCase();
    if (n.includes('věž') || n.includes('vez')) ruinedTower(ctx, o, R);
    else if (n.includes('útes') || n.includes('utes') || o.width * o.height > 18000) cliff(ctx, o, R);
    else boulder(ctx, o, R);
  }
  // Místo po odstraněné překážce: tráva, vyšlapaná hlína a pár kamínků
  const cleanGrass = new Map();   // tráva pod překážkami (uložená před jejich nakreslením), ať odstranění nenechá čtverec
  const obstKey = function (o) { return o.x + ',' + o.y + ',' + o.width + ',' + o.height; };
  TDS.clearedObstacle = function (ctx, o) {
    const R = makeRng(hash('clr' + o.x + ',' + o.y)), clean = cleanGrass.get(obstKey(o));
    ctx.save(); roundRect(ctx, o.x - 6, o.y - 6, o.width + 12, o.height + 12, 24); ctx.clip();
    if (clean) ctx.drawImage(clean, o.x - 6, o.y - 6, o.width + 12, o.height + 12, o.x - 6, o.y - 6, o.width + 12, o.height + 12);
    else { ctx.fillStyle = GRASS; ctx.fill(); }
    ctx.restore();
    ellipsePath(ctx, o.x + o.width / 2, o.y + o.height / 2, o.width * 0.36, o.height * 0.3, 0); fillA(ctx, '#9b6b38', 0.45);
    for (let i = 0; i < 5; i++) stone(ctx, o.x + o.width * (0.25 + R() * 0.5), o.y + o.height * (0.25 + R() * 0.5), 2.5 + R() * 2, '#9aa0a6', R, 1);
    for (let i = 0; i < 4; i++) tuft(ctx, o.x + o.width * (0.15 + R() * 0.7), o.y + o.height * (0.2 + R() * 0.7), 3.5, R);
  };

  /* ---------- Jeskyně a hrad ---------- */
  function cave(ctx, x, y, ang, R) {   // cesta začíná na okraji mapy → jeskyni posunout dovnitř, ať je vidět
    ctx.save(); ctx.translate(x + Math.cos(ang) * 30, y + Math.sin(ang) * 30); ctx.rotate(ang);
    softShadow(ctx, -14, 2, 50, 56);
    for (let i = 0; i < 9; i++) { const a = PI / 2 + i / 8 * PI; stone(ctx, -10 + Math.cos(a) * 40, Math.sin(a) * 44, 15 + R() * 6, ['#80868d', '#8f959b', '#757b82'][(R() * 3) | 0], R, 2.4); }   // skalní oblouk
    ellipsePath(ctx, -6, 0, 26, 32, 0); paint(ctx, '#2a2320', 2.6);   // ústí
    ellipsePath(ctx, -10, 0, 19, 25, 0); ctx.fillStyle = '#16110f'; ctx.fill();
    ellipsePath(ctx, -14, 0, 11, 15, 0); ctx.fillStyle = '#0a0706'; ctx.fill();
    for (const sy of [-7, 7]) { ellipsePath(ctx, -12, sy, 3, 2.2, 0); ctx.fillStyle = '#d6f53b'; ctx.fill(); circlePath(ctx, -11.4, sy, 1); ctx.fillStyle = '#111'; ctx.fill(); }   // oči ve tmě
    ellipsePath(ctx, 14, 0, 16, 20, 0); paint(ctx, '#4fc93a', 2);   // slizová louže
    ellipsePath(ctx, 16, -3, 10, 12, 0); fillA(ctx, '#86ec5e', 0.8);
    ellipsePath(ctx, 19, -7, 4, 2.6, -0.4); fillA(ctx, '#e2ffc8', 0.9);
    for (const [dx, dy, r] of [[2, -27, 5], [4, 26, 4.5], [-2, -16, 3]]) { ctx.beginPath(); ctx.moveTo(dx - r, dy); ctx.quadraticCurveTo(dx, dy - r * 1.6, dx + r, dy); ctx.arc(dx, dy, r, 0, PI); ctx.closePath(); paint(ctx, '#4fc93a', 1.4); }   // kapky slizu
    for (let i = 0; i < 4; i++) { ellipsePath(ctx, -10 + (R() - 0.5) * 50, (R() < 0.5 ? -1 : 1) * (36 + R() * 10), 6 + R() * 4, 3, R() * PI); paint(ctx, '#5f9e3a', 1.1); }
    ctx.restore();
  }
  function castle(ctx, x, y, ang, R) {   // brána kousek před koncem cesty, hradba přesahuje přes okraj
    ctx.save(); ctx.translate(x - Math.cos(ang) * 44, y - Math.sin(ang) * 44); ctx.rotate(ang);
    softShadow(ctx, 40, 0, 46, 92);
    roundRect(ctx, -6, -78, 80, 156, 6); paint(ctx, '#9da3aa', 3);   // hradba
    ctx.save(); roundRect(ctx, -6, -78, 80, 156, 6); ctx.clip();
    ctx.strokeStyle = 'rgba(40,40,40,0.35)'; ctx.lineWidth = 1.2;
    for (let yy = -78, row = 0; yy < 78; yy += 12, row++) { ctx.beginPath(); ctx.moveTo(-6, yy); ctx.lineTo(74, yy); ctx.stroke(); for (let xx = -6 + (row % 2) * 10; xx < 74; xx += 20) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 12); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-6, -78, 80, 10);
    ctx.restore();
    for (let i = -3; i <= 3; i++) { if (Math.abs(i) <= 1) continue; roundRect(ctx, -12, i * 20 - 6, 12, 12, 2); paint(ctx, '#b4b9bf', 2); }   // cimbuří
    // brána: dřevo s kováním a mříž
    roundRect(ctx, -10, -26, 20, 52, 4); paint(ctx, '#6e4320', 2.6);
    ctx.strokeStyle = 'rgba(30,15,5,0.6)'; ctx.lineWidth = 1.2; for (let yy = -20; yy < 26; yy += 8) { ctx.beginPath(); ctx.moveTo(-8, yy); ctx.lineTo(8, yy); ctx.stroke(); }
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2.4; for (const yy of [-14, 12]) { ctx.beginPath(); ctx.moveTo(-9, yy); ctx.lineTo(9, yy); ctx.stroke(); }
    ctx.fillStyle = '#c9a227'; for (const yy of [-14, 12]) for (const xx of [-6, 6]) { circlePath(ctx, xx, yy, 1.5); ctx.fill(); }
    // dvě kulaté věže s kuželovou střechou (shora) a praporky
    for (const sy of [-1, 1]) {
      const ty = sy * 52;
      softShadow(ctx, 6, ty, 26, 26);
      circlePath(ctx, 4, ty, 26); paint(ctx, '#a9aeb4', 3);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; roundRect(ctx, 4 + Math.cos(a) * 24 - 4, ty + Math.sin(a) * 24 - 4, 8, 8, 2); paint(ctx, '#bcc1c6', 1.6); }
      circlePath(ctx, 4, ty, 19); paint(ctx, '#c0392b', 2.4);   // střecha
      ctx.save(); circlePath(ctx, 4, ty, 19); ctx.clip();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(4, ty); ctx.lineTo(4 + Math.cos(a) * 20, ty + Math.sin(a) * 20); ctx.strokeStyle = 'rgba(80,10,5,0.5)'; ctx.lineWidth = 1.4; ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(4, ty); ctx.arc(4, ty, 19, PI, PI * 1.6); ctx.closePath(); fillA(ctx, '#fff', 0.22);
      ctx.restore();
      circlePath(ctx, 4, ty, 3); paint(ctx, '#ffd34a', 1.2);
      ctx.save(); ctx.translate(4, ty); ctx.rotate(-ang - 0.4);   // praporek vlaje vždy stejným směrem
      ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.quadraticCurveTo(12, -5, 22, -1); ctx.quadraticCurveTo(12, 4, 0, 2.5); ctx.closePath(); paint(ctx, sy < 0 ? '#2f6fe0' : '#e23b3b', 1.4);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- Celé pozadí ---------- */
  const cache = new Map();
  TDS.clearCacheMap = function () { cache.clear(); cleanGrass.clear(); };
  TDS.background = function (map) {
    const paths = map.paths || [], half = (map.track_width_px || 44) / 2, waters = map.water_zones || [], obst = map.obstacles || [];
    const key = (map.id || 'mapa') + '|' + paths.length;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), R = makeRng(hash(key));
    const free = function (x, y, m) { return distToPaths(paths, x, y) > half + m && !inZones(waters, x, y, m) && !inZones(obst, x, y, m); };
    grass(ctx, R);
    for (let i = 0; i < 110; i++) { const x = R() * W, y = R() * H; if (free(x, y, 10)) tuft(ctx, x, y, 3 + R() * 3, R); }
    for (let i = 0; i < 46; i++) { const x = R() * W, y = R() * H; if (free(x, y, 14)) flowers(ctx, x, y, R); }
    for (let i = 0; i < 9; i++) { const x = R() * W, y = R() * H; if (free(x, y, 20)) mushroom(ctx, x, y, R); }
    for (let i = 0; i < 14; i++) { const x = R() * W, y = R() * H; if (free(x, y, 16)) stone(ctx, x, y, 3 + R() * 3, '#a3a8ad', R, 1.2); }
    if (obst.length) {   // kopie trávy před překážkami
      const clean = document.createElement('canvas'); clean.width = W; clean.height = H; clean.getContext('2d').drawImage(c, 0, 0);
      obst.forEach(function (o) { cleanGrass.set(obstKey(o), clean); });
    }
    waters.forEach(function (z) { pond(ctx, z, R); });
    road(ctx, paths, half, R);
    obst.forEach(function (o) { obstacle(ctx, o, R); });
    // stromy a keře jen při okrajích (nepletou se s místem na stavění)
    const trees = [];
    for (let i = 0; i < 90; i++) {
      const edge = R(), x = edge < 0.5 ? (R() < 0.5 ? R() * 46 : W - R() * 46) : R() * W, y = edge < 0.5 ? R() * H : (R() < 0.5 ? R() * 40 : H - R() * 40);
      if (!free(x, y, 34)) continue;
      trees.push([x, y, R()]);
    }
    trees.sort(function (a, b) { return a[1] - b[1]; });
    for (const [x, y, k] of trees) {
      if (k < 0.22) pine(ctx, x, y, 17 + R() * 8, R);
      else if (k < 0.45) bush(ctx, x, y, 11 + R() * 5, R);
      else canopy(ctx, x, y, 20 + R() * 10, ['#3f9a3a', '#4aa83f', '#56b546'][(R() * 3) | 0], R, k > 0.9 ? '#e8463a' : null);
    }
    // jeskyně na začátku cest, hrad na konci
    const starts = new Map(), ends = new Map();
    paths.forEach(function (p) {
      if (p.length < 2) return;
      const a = p[0], a2 = p[1], b = p[p.length - 1], b2 = p[p.length - 2];
      starts.set(a.x + ',' + a.y, [a.x, a.y, Math.atan2(a2.y - a.y, a2.x - a.x)]);
      ends.set(b.x + ',' + b.y, [b.x, b.y, Math.atan2(b.y - b2.y, b.x - b2.x)]);
    });
    starts.forEach(function (s) { cave(ctx, s[0], s[1], s[2], R); });
    ends.forEach(function (e) { castle(ctx, e[0], e[1], e[2], R); });
    cache.set(key, c);
    return c;
  };

  /* ---------- Živé prostředí (každý snímek) ---------- */
  const CLOUDS = [[0, 140, 1.0], [430, 470, 0.8], [820, 300, 1.2]];
  TDS.ambient = function (ctx, ts) {
    const t = ts / 1000;
    ctx.save();
    ctx.fillStyle = '#0a2a10';
    for (const [x0, y0, s] of CLOUDS) {   // stíny mraků pomalu plují přes mapu
      const x = ((x0 + t * 9 * s) % (W + 420)) - 210, y = y0 + Math.sin(t * 0.05 + x0) * 20;
      ctx.globalAlpha = 0.06;
      for (const [dx, dy, rx, ry] of [[0, 0, 90, 46], [-70, 12, 60, 34], [72, 10, 66, 36], [20, -24, 58, 30], [-30, 26, 54, 26]]) { ellipsePath(ctx, x + dx * s, y + dy * s, rx * s, ry * s, 0); ctx.fill(); }
    }
    ctx.restore();
    // motýli kolem okrajů mapy
    for (let i = 0; i < 3; i++) {
      const ph = t * (0.07 + i * 0.02) + i * 2.1, bx = W / 2 + Math.cos(ph) * (W * 0.46), by = H / 2 + Math.sin(ph * 1.3) * (H * 0.44);
      const flap = Math.abs(Math.sin(t * 14 + i)), dir = Math.atan2(Math.cos(ph * 1.3) * 1.3 * H * 0.44, -Math.sin(ph) * W * 0.46);
      ctx.save(); ctx.translate(bx, by + Math.sin(t * 3 + i) * 4); ctx.rotate(dir);
      const col = ['#ffd84a', '#ff8fb8', '#8fd3ff'][i];
      for (const sd of [-1, 1]) { ellipsePath(ctx, -1, sd * (2 + flap * 2.5), 3.4, 1.2 + flap * 2.6, sd * 0.4); paint(ctx, col, 0.8); }
      ellipsePath(ctx, 0, 0, 2.6, 0.9, 0); ctx.fillStyle = OUT; ctx.fill();
      ctx.restore();
    }
  };
})();

/**
 * Obrana království - Kreslící knihovna (Část A: Mapa, voda a slizáci)
 * Čistý HTML5 Canvas 2D, optimalizováno pro mobilní zařízení (60 FPS) pomocí Offscreen Canvas Cache.
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});

  // Globální konstanty stylu
  const OUTLINE = '#111111';
  const SHADOW_COL = 'rgba(15, 20, 10, 0.28)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // Interní cache pro předkreslené offscreen canvasy
  const cache = new Map();
  TDS.clearCacheA = () => cache.clear();   // po ztrátě grafického kontextu prohlížeče

  // ============================================================================
  // POMOCNÉ FUNKCE (Matematika, PRNG, Tvary, Cache)
  // ============================================================================

  /**
   * Deterministický pseudonáhodný generátor (Mulberry32)
   * @param {number} seed - Číselný seed
   */
  function createRNG(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Převede řetězec na číselný hash pro PRNG
   */
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    const s = String(str || 'default');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * Získá z cache nebo vytvoří nový předkreslený offscreen canvas
   */
  function getCached(key, w, h, drawFn) {
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      const ctx = c.getContext('2d');
      drawFn(ctx, c.width, c.height);
      cache.set(key, c);
    }
    return c;
  }

  /**
   * Vlastní náhrada za ctx.roundRect (definice cesty zaobleného obdélníku)
   */
  function rr(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const maxR = Math.min(w, h) * 0.5;
    const rad = Math.max(0, Math.min(r, maxR));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  /**
   * Vykreslí cestu s výplní a obrysem
   */
  function fillAndStroke(ctx, fillStyle, strokeStyle, lineWidth) {
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle && lineWidth > 0) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  /**
   * Vzdálenost bodu [px, py] od úsečky [ax, ay] - [bx, by]
   */
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * Zjistí minimální vzdálenost bodu od všech cest v mapě
   */
  function distToPaths(px, py, paths) {
    let minD = Infinity;
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      for (let j = 0; j < p.length - 1; j++) {
        const d = distToSegment(px, py, p[j].x, p[j].y, p[j + 1].x, p[j + 1].y);
        if (d < minD) minD = d;
      }
    }
    return minD;
  }

  /**
   * Zjistí, zda bod leží uvnitř obdélníkové zóny s daným okrajem (margin)
   */
  function inRectZone(px, py, zones, margin) {
    if (!zones) return false;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (
        px >= z.x - margin &&
        px <= z.x + z.width + margin &&
        py >= z.y - margin &&
        py <= z.y + z.height + margin
      ) {
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // POMOCNÉ KRESLÍCÍ FUNKCE PRO MAPU (Překážky, stromy, brány, jeskyně)
  // ============================================================================

  /**
   * Nakreslí kreslený strom nebo keř (pohled shora, světlo shora zleva)
   */
  function drawTreeOrBush(ctx, x, y, scale, isBush, rng) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Měkký stín vpravo dole
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(4, 5, isBush ? 14 : 20, isBush ? 12 : 18, 0, 0, TAU);
    ctx.fill();

    if (isBush) {
      // Keř
      const baseCol = rng() > 0.5 ? '#3a9d38' : '#2e8b34';
      const hiCol = '#58bc48';
      const puffs = [
        { dx: -5, dy: 2, r: 9 },
        { dx: 6, dy: 2, r: 8.5 },
        { dx: 0, dy: -4, r: 10 }
      ];
      // Obrys keře
      ctx.fillStyle = OUTLINE;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx, p.dy, p.r + 2, 0, TAU);
        ctx.fill();
      }
      // Základní zeleň
      ctx.fillStyle = baseCol;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx, p.dy, p.r, 0, TAU);
        ctx.fill();
      }
      // Světlo shora zleva
      ctx.fillStyle = hiCol;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx - 2, p.dy - 2, p.r * 0.55, 0, TAU);
        ctx.fill();
      }
      // Bobulky občas
      if (rng() > 0.45) {
        ctx.fillStyle = '#e83b3b';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.2;
        const berries = [[-4, -2], [3, -5], [5, 2], [-2, 4]];
        for (const b of berries) {
          ctx.beginPath();
          ctx.arc(b[0], b[1], 2.2, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
    } else {
      // Koruna stromu z překrývajících se bochánků
      const variant = rng();
      const darkCol = variant > 0.3 ? '#25792c' : '#338828';
      const midCol = variant > 0.3 ? '#39a338' : '#4cae32';
      const lightCol = variant > 0.3 ? '#62ca4b' : '#78d64b';

      const lobes = [
        { x: -8, y: 6, r: 12 },
        { x: 8, y: 6, r: 12 },
        { x: -10, y: -4, r: 12 },
        { x: 9, y: -4, r: 11.5 },
        { x: 0, y: 9, r: 11 },
        { x: 0, y: -9, r: 12.5 },
        { x: -1, y: 0, r: 14 }
      ];

      // Tmavý obrys celé koruny
      ctx.fillStyle = OUTLINE;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r + 2.2, 0, TAU);
        ctx.fill();
      }
      // Stínová vrstva
      ctx.fillStyle = darkCol;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, TAU);
        ctx.fill();
      }
      // Střední vrstva posunutá mírně vlevo nahoru
      ctx.fillStyle = midCol;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x - 1.5, l.y - 1.5, l.r * 0.82, 0, TAU);
        ctx.fill();
      }
      // Vrchní nasvícená vrstva
      ctx.fillStyle = lightCol;
      ctx.beginPath();
      ctx.arc(-4, -5, 9, 0, TAU);
      ctx.arc(3, -6, 6.5, 0, TAU);
      ctx.arc(-6, 2, 6.5, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Nakreslí překážku podle jejího názvu a rozměrů
   */
  function drawObstacle(ctx, obs, rng) {
    ctx.save();
    const cx = obs.x + obs.width * 0.5;
    const cy = obs.y + obs.height * 0.5;
    const rx = obs.width * 0.5;
    const ry = obs.height * 0.5;
    const name = (obs.name || '').toLowerCase();

    // Společný měkký stín vpravo dole
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy + 6, rx * 0.95, ry * 0.9, 0, 0, TAU);
    ctx.fill();

    if (name.includes('věž') || name.includes('vez')) {
      // === ROZBOŘENÁ STRÁŽNÍ VĚŽ (Ruina) ===
      const r = Math.min(rx, ry) * 0.85;
      // Popadané kameny kolem
      const rubble = [
        { dx: rx * 0.65, dy: ry * 0.45, s: 7 },
        { dx: rx * 0.4, dy: ry * 0.7, s: 5.5 },
        { dx: -rx * 0.7, dy: ry * 0.35, s: 6 },
        { dx: rx * 0.55, dy: -ry * 0.45, s: 6.5 }
      ];
      for (const rb of rubble) {
        rr(ctx, cx + rb.dx - rb.s, cy + rb.dy - rb.s, rb.s * 2, rb.s * 1.6, 3);
        fillAndStroke(ctx, '#7d848d', OUTLINE, 2);
      }

      // Základna věže
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      fillAndStroke(ctx, '#686f7a', OUTLINE, 2.5);

      // Vnitřní tmavší podlaha ruiny
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 1, r * 0.72, 0, TAU);
      fillAndStroke(ctx, '#424750', OUTLINE, 2);

      // Spáry v podlaze a praskliny
      ctx.strokeStyle = '#2a2e34';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy);
      ctx.lineTo(cx + r * 0.4, cy);
      ctx.moveTo(cx, cy - r * 0.5);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.stroke();

      // Zbořené cimbuří (obloukové kamenné bloky, vpravo dole chybí)
      const blocks = 7;
      for (let i = 0; i < blocks; i++) {
        if (i === 1 || i === 2) continue; // Probořená část
        const a1 = (i / blocks) * TAU - PI * 0.8;
        const a2 = ((i + 0.75) / blocks) * TAU - PI * 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.04, a1, a2);
        ctx.arc(cx, cy, r * 0.68, a2, a1, true);
        ctx.closePath();
        fillAndStroke(ctx, i >= 4 ? '#9aa2ad' : '#7f8792', OUTLINE, 2);
      }

      // Mech na ruině
      ctx.fillStyle = '#4ea83b';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx - r * 0.55, cy - r * 0.45, r * 0.25, 0, TAU);
      ctx.arc(cx - r * 0.35, cy - r * 0.65, r * 0.18, 0, TAU);
      ctx.fill();
      ctx.stroke();

    } else if (name.includes('útes') || name.includes('utes')) {
      // === SKALNÍ ÚTES (Shluk ostrých skal) ===
      const peaks = [
        { dx: -rx * 0.35, dy: ry * 0.2, rad: Math.min(rx, ry) * 0.55 },
        { dx: rx * 0.35, dy: ry * 0.15, rad: Math.min(rx, ry) * 0.52 },
        { dx: 0, dy: -ry * 0.25, rad: Math.min(rx, ry) * 0.62 },
        { dx: -rx * 0.1, dy: ry * 0.05, rad: Math.min(rx, ry) * 0.7 }
      ];

      for (let p = 0; p < peaks.length; p++) {
        const pk = peaks[p];
        const px = cx + pk.dx;
        const py = cy + pk.dy;
        const pr = pk.rad;
        const pts = [];
        const sides = 7;
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * TAU;
          const mod = 0.8 + (rng() * 0.3);
          pts.push({
            x: px + Math.cos(a) * pr * mod,
            y: py + Math.sin(a) * pr * mod
          });
        }
        // Základ skály
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < sides; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        fillAndStroke(ctx, '#737a84', OUTLINE, 2.2);

        // Světlá plocha shora zleva
        ctx.beginPath();
        ctx.moveTo(px - pr * 0.15, py - pr * 0.15);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.lineTo(pts[5].x, pts[5].y);
        ctx.closePath();
        ctx.fillStyle = '#9aa2ad';
        ctx.fill();

        // Tmavá plocha vpravo dole
        ctx.beginPath();
        ctx.moveTo(px - pr * 0.15, py - pr * 0.15);
        ctx.lineTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fillStyle = '#565c65';
        ctx.fill();

        // Hrany
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(pts[4].x, pts[4].y);
        ctx.lineTo(px - pr * 0.15, py - pr * 0.15);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();
      }
    } else {
      // === MECHOVÝ BALVAN (Výchozí kulatější kámen s mechem) ===
      ctx.beginPath();
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * TAU;
        const radX = rx * (0.82 + Math.sin(i * 2.1) * 0.1);
        const radY = ry * (0.82 + Math.cos(i * 1.7) * 0.1);
        const x = cx + Math.cos(a) * radX;
        const y = cy + Math.sin(a) * radY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      fillAndStroke(ctx, '#7c848e', OUTLINE, 2.4);

      // Odlesk kamene vlevo nahoře
      ctx.fillStyle = '#9fa7b2';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.22, cy - ry * 0.22, rx * 0.45, ry * 0.35, -0.4, 0, TAU);
      ctx.fill();

      // Bohatý mechový porost
      ctx.fillStyle = '#47a836';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx - rx * 0.25, cy - ry * 0.15, Math.min(rx, ry) * 0.42, 0, TAU);
      ctx.arc(cx + rx * 0.1, cy - ry * 0.3, Math.min(rx, ry) * 0.35, 0, TAU);
      ctx.arc(cx - rx * 0.05, cy + ry * 0.1, Math.min(rx, ry) * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();

      // Světlejší tečky mechu
      ctx.fillStyle = '#6ed152';
      ctx.beginPath();
      ctx.arc(cx - rx * 0.3, cy - ry * 0.22, Math.min(rx, ry) * 0.2, 0, TAU);
      ctx.arc(cx + rx * 0.05, cy - ry * 0.35, Math.min(rx, ry) * 0.15, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Nakreslí slizovou jeskyni / díru na začátku cesty
   */
  function drawCaveEntrance(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // Stín
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(3, 5, 32, 28, 0, 0, TAU);
    ctx.fill();

    // Skály kolem vchodu (oblouk za dírou)
    const rocks = [
      { x: -18, y: -16, r: 13 },
      { x: -24, y: 0, r: 15 },
      { x: -18, y: 16, r: 13 },
      { x: -6, y: -22, r: 12 },
      { x: -6, y: 22, r: 12 },
      { x: 6, y: -19, r: 10 },
      { x: 6, y: 19, r: 10 }
    ];
    for (const rk of rocks) {
      ctx.beginPath();
      ctx.arc(rk.x, rk.y, rk.r, 0, TAU);
      fillAndStroke(ctx, '#6c737d', OUTLINE, 2.2);
      ctx.fillStyle = '#8d95a0';
      ctx.beginPath();
      ctx.arc(rk.x - 3, rk.y - 3, rk.r * 0.55, 0, TAU);
      ctx.fill();
    }

    // Temná slizová díra
    ctx.beginPath();
    ctx.ellipse(-4, 0, 16, 20, 0, 0, TAU);
    fillAndStroke(ctx, '#182218', OUTLINE, 2.5);

    // Zelená slizová louže vytékající z díry
    ctx.beginPath();
    ctx.ellipse(6, 0, 14, 15, 0, 0, TAU);
    ctx.fillStyle = '#4ad638';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -3, 8, 9, 0, 0, TAU);
    ctx.fillStyle = '#7bf25a';
    ctx.fill();

    // Zářící oči ve tmě jeskyně
    ctx.fillStyle = '#ffea47';
    ctx.beginPath();
    ctx.arc(-10, -6, 2.2, 0, TAU);
    ctx.arc(-10, -1, 2.2, 0, TAU);
    ctx.arc(-14, 6, 1.8, 0, TAU);
    ctx.arc(-14, 10, 1.8, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Nakreslí hradní bránu se zdí a praporem na konci cesty
   */
  function drawCastleGate(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // Stín brány
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(5, 6, 30, 38, 0, 0, TAU);
    ctx.fill();

    // Kamenná hradba kolmo na cestu
    rr(ctx, -12, -34, 24, 68, 5);
    fillAndStroke(ctx, '#8b939c', OUTLINE, 2.5);

    // Dřevěná padací brána / most uprostřed
    rr(ctx, -14, -15, 28, 30, 3);
    fillAndStroke(ctx, '#784c28', OUTLINE, 2.2);

    // Kovové mříže a prkna na bráně
    ctx.strokeStyle = '#332010';
    ctx.lineWidth = 1.5;
    for (let py = -10; py <= 10; py += 5) {
      ctx.beginPath();
      ctx.moveTo(-12, py);
      ctx.lineTo(12, py);
      ctx.stroke();
    }

    // Dvě boční obranné věže
    const towerY = [-28, 28];
    for (const ty of towerY) {
      // Tělo věže
      ctx.beginPath();
      ctx.arc(0, ty, 16, 0, TAU);
      fillAndStroke(ctx, '#7a828c', OUTLINE, 2.5);

      // Světlejší vršek věže
      ctx.beginPath();
      ctx.arc(-2, ty - 2, 11, 0, TAU);
      fillAndStroke(ctx, '#9fa7b2', OUTLINE, 1.8);

      // Modrá rytířská stříška / cimbuří
      ctx.beginPath();
      ctx.arc(0, ty, 7, 0, TAU);
      fillAndStroke(ctx, '#2b68c4', OUTLINE, 1.8);
    }

    // Královský prapor na severní/levé věži
    ctx.save();
    ctx.translate(0, -28);
    // Žerď
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, -14);
    ctx.stroke();
    // Vlajka
    ctx.beginPath();
    ctx.moveTo(6, -5);
    ctx.lineTo(24, -10);
    ctx.lineTo(19, -1);
    ctx.lineTo(24, 5);
    ctx.lineTo(6, 2);
    ctx.closePath();
    fillAndStroke(ctx, '#e63232', OUTLINE, 1.8);
    // Zlatý znak na praporu
    ctx.fillStyle = '#ffd633';
    ctx.beginPath();
    ctx.arc(14, -3, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ============================================================================
  // API: POZADÍ MAPY A VODA
  // ============================================================================

  /**
   * Předkreslí kompletní pozadí mapy 1040×720 do offscreen canvasu (s cache podle map.id)
   */
  TDS.background = function (map) {
    const mapCfg = map || {};
    const paths = mapCfg.paths || [];
    const trackW = mapCfg.track_width_px || 44;
    const waterZones = mapCfg.water_zones || [];
    const obstacles = mapCfg.obstacles || [];

    // Unikátní klíč pro cache
    const cacheKey =
      'bg_' +
      (mapCfg.id || 'default') +
      '_' +
      paths.length +
      '_' +
      waterZones.length +
      '_' +
      obstacles.length;

    return getCached(cacheKey, 1040, 720, function (ctx, W, H) {
      ctx.save();
      const rng = createRNG(hashStr(cacheKey));

      // 1. Základní sytá tráva
      ctx.fillStyle = '#5ec447';
      ctx.fillRect(0, 0, W, H);

      // Barevné variace trávníku (velké měkké skvrny pro živější povrch)
      for (let i = 0; i < 65; i++) {
        const gx = rng() * W;
        const gy = rng() * H;
        const gr = 35 + rng() * 65;
        ctx.fillStyle = rng() > 0.5 ? '#55b93f' : '#68cc4f';
        ctx.beginPath();
        ctx.ellipse(gx, gy, gr * 1.2, gr * 0.85, rng() * PI, 0, TAU);
        ctx.fill();
      }

      // Jemné stínítko vpravo dole a nasvícení vlevo nahoře (bez per-frame gradientů, jen jednou v cache)
      const sunGrad = ctx.createLinearGradient(0, 0, W, H);
      sunGrad.addColorStop(0, 'rgba(255, 255, 210, 0.14)');
      sunGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      sunGrad.addColorStop(1, 'rgba(10, 35, 15, 0.14)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Vodní zóny - písečný/hlinitý břeh a podklad vody
      for (let i = 0; i < waterZones.length; i++) {
        const wz = waterZones[i];
        // Vnější tmavý obrys břehu
        rr(ctx, wz.x - 5, wz.y - 5, wz.width + 10, wz.height + 10, 18);
        fillAndStroke(ctx, '#d8be82', OUTLINE, 2.5);
        // Vnitřní základ vody
        rr(ctx, wz.x, wz.y, wz.width, wz.height, 14);
        fillAndStroke(ctx, '#2892d7', OUTLINE, 2);
      }

      // 3. Cesty (44 px široké, zaoblené zatáčky, tmavé obrysy, hlína a dlažba/kamínky)
      const drawAllPaths = function (width, strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          if (!p || p.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          for (let j = 1; j < p.length; j++) {
            ctx.lineTo(p[j].x, p[j].y);
          }
          ctx.stroke();
        }
      };

      // Vrstvy cesty od vnějšího obrysu po vnitřní vyšlapaný střed
      drawAllPaths(trackW + 8, OUTLINE);      // Tmavý vnější obrys (#111)
      drawAllPaths(trackW + 3, '#9c784c');    // Tmavší okraj cesty
      drawAllPaths(trackW - 2, '#cfa872');    // Hlavní pískovo-hlinitá cesta
      drawAllPaths(trackW - 16, '#dfc08e');   // Světlejší střed cesty

      // Kamínky a dlažba podél cest
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        for (let j = 0; j < p.length - 1; j++) {
          const ax = p[j].x, ay = p[j].y;
          const bx = p[j + 1].x, by = p[j + 1].y;
          const segLen = Math.hypot(bx - ax, by - ay);
          const steps = Math.floor(segLen / 18);
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0.5 : s / steps;
            const px = ax + (bx - ax) * t + (rng() - 0.5) * (trackW * 0.65);
            const py = ay + (by - ay) * t + (rng() - 0.5) * (trackW * 0.65);
            const pr = 2.5 + rng() * 3.5;
            ctx.beginPath();
            ctx.ellipse(px, py, pr * 1.2, pr * 0.85, rng() * PI, 0, TAU);
            fillAndStroke(
              ctx,
              rng() > 0.4 ? '#b59263' : '#9e8a78',
              'rgba(17,17,17,0.55)',
              1.2
            );
          }
        }
      }

      // 4. Textura trávy (drny a drobné květinky mimo cestu, vodu a překážky)
      const safePathDist = trackW * 0.5 + 14;
      for (let i = 0; i < 420; i++) {
        const tx = 12 + rng() * (W - 24);
        const ty = 12 + rng() * (H - 24);
        if (distToPaths(tx, ty, paths) < safePathDist) continue;
        if (inRectZone(tx, ty, waterZones, 14)) continue;
        if (inRectZone(tx, ty, obstacles, 10)) continue;

        if (rng() < 0.72) {
          // Trs trávy
          ctx.strokeStyle = rng() > 0.5 ? '#358826' : '#439c30';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 3, ty - 5);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + 1, ty - 6);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + 4, ty - 4);
          ctx.stroke();
        } else {
          // Roztomilá kytička
          const cols = ['#fff65b', '#ff7eb6', '#ffffff', '#7ce0ff'];
          const fCol = cols[Math.floor(rng() * cols.length)];
          const r = 2.8 + rng() * 1.2;
          ctx.fillStyle = OUTLINE;
          ctx.beginPath();
          ctx.arc(tx, ty, r + 1.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = fCol;
          ctx.beginPath();
          ctx.arc(tx, ty, r, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#ffae00';
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.45, 0, TAU);
          ctx.fill();
        }
      }

      // 5. Překážky z definice mapy
      for (let i = 0; i < obstacles.length; i++) {
        drawObstacle(ctx, obstacles[i], rng);
      }

      // 6. Keře a stromy (rozmístěné na volných místech, více u okrajů mapy)
      const foliage = [];
      for (let i = 0; i < 110; i++) {
        const fx = 16 + rng() * (W - 32);
        const fy = 16 + rng() * (H - 32);
        // Upřednostnit okraje mapy nebo volná prostranství, aby nepřekážely věžím u cesty
        const edgeBias =
          fx < 65 || fx > W - 65 || fy < 55 || fy > H - 55 || rng() < 0.22;
        if (!edgeBias) continue;

        const isBush = rng() < 0.48;
        const clearRadius = isBush ? 26 : 36;
        if (distToPaths(fx, fy, paths) < trackW * 0.5 + clearRadius) continue;
        if (inRectZone(fx, fy, waterZones, clearRadius)) continue;
        if (inRectZone(fx, fy, obstacles, clearRadius * 0.8)) continue;

        // Kontrola kolize s ostatními stromy
        let tooClose = false;
        for (let j = 0; j < foliage.length; j++) {
          if (Math.hypot(fx - foliage[j].x, fy - foliage[j].y) < 28) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        foliage.push({
          x: fx,
          y: fy,
          scale: 0.78 + rng() * 0.36,
          isBush: isBush
        });
      }

      // Seřadit podle Y pro přirozené překrývání shora dolů
      foliage.sort((a, b) => a.y - b.y);
      for (let i = 0; i < foliage.length; i++) {
        const f = foliage[i];
        drawTreeOrBush(ctx, f.x, f.y, f.scale, f.isBush, rng);
      }

      // 7. Začátky cest (slizové jeskyně) a konce cest (hradní brány)
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        if (!p || p.length < 2) continue;

        const p0 = p[0];
        const p1 = p[1];
        const startAng = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        drawCaveEntrance(ctx, p0.x, p0.y, startAng);

        const pLast = p[p.length - 1];
        const pPrev = p[p.length - 2];
        const endAng = Math.atan2(pLast.y - pPrev.y, pLast.x - pPrev.x);
        drawCastleGate(ctx, pLast.x, pLast.y, endAng);
      }

      ctx.restore();
    });
  };

  /**
   * Levná animace vodní hladiny kreslená každý snímek (vlnky a odlesky)
   */
  TDS.water = function (ctx, zone, ts) {
    if (!zone) return;
    ctx.save();

    const x = zone.x, y = zone.y, w = zone.width, h = zone.height;
    const t = (ts || 0) * 0.0025;

    // Ořez na oblast vodní plochy
    rr(ctx, x, y, w, h, 14);
    ctx.clip();

    //Základní sytá vodní modř
    ctx.fillStyle = '#2892d7';
    ctx.fillRect(x, y, w, h);

    // Světlejší mělký okraj uvnitř břehu
    ctx.strokeStyle = '#4cb3f0';
    ctx.lineWidth = 6;
    rr(ctx, x + 2, y + 2, w - 4, h - 4, 12);
    ctx.stroke();

    // Animované vlnky a sluneční odlesky
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    const cols = Math.max(2, Math.floor(w / 45));
    const rows = Math.max(2, Math.floor(h / 32));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const phase = r * 1.7 + c * 2.3;
        const wx = x + (c + 0.5) * (w / cols) + Math.sin(t + phase) * 6;
        const wy = y + (r + 0.5) * (h / rows) + Math.cos(t * 0.8 + phase) * 3;
        const len = 8 + Math.sin(t * 1.2 + phase) * 3;

        ctx.beginPath();
        ctx.moveTo(wx - len, wy);
        ctx.quadraticCurveTo(wx, wy - 3, wx + len, wy);
        ctx.stroke();
      }
    }

    // Vnitřní tmavý obrys vodní plochy
    rr(ctx, x, y, w, h, 14);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  };

  /**
   * Zamrzlá hladina vody (předkreslená do offscreen cache pro okamžité vykreslení)
   */
  TDS.frozenWater = function (ctx, zone) {
    if (!zone) return;
    ctx.save();

    const key = `frozen_${zone.name || 'z'}_${zone.width}_${zone.height}`;
    const pad = 4;
    const sprite = getCached(key, zone.width + pad * 2, zone.height + pad * 2, function (c, cw, ch) {
      const w = zone.width;
      const h = zone.height;
      c.translate(pad, pad);

      // Ledový podklad
      rr(c, 0, 0, w, h, 14);
      fillAndStroke(c, '#9be4ff', OUTLINE, 2.2);

      c.save();
      rr(c, 0, 0, w, h, 14);
      c.clip();

      // Šikmé ledové odlesky
      c.fillStyle = 'rgba(255, 255, 255, 0.55)';
      c.beginPath();
      c.moveTo(w * 0.1, 0);
      c.lineTo(w * 0.35, 0);
      c.lineTo(w * 0.15, h);
      c.lineTo(-w * 0.05, h);
      c.closePath();
      c.fill();

      c.beginPath();
      c.moveTo(w * 0.55, 0);
      c.lineTo(w * 0.68, 0);
      c.lineTo(w * 0.48, h);
      c.lineTo(w * 0.35, h);
      c.closePath();
      c.fill();

      // Praskliny v ledu
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(w * 0.25, h * 0.3);
      c.lineTo(w * 0.45, h * 0.5);
      c.lineTo(w * 0.7, h * 0.35);
      c.moveTo(w * 0.45, h * 0.5);
      c.lineTo(w * 0.55, h * 0.75);
      c.stroke();

      c.restore();

      // Obrys ledu znovu navrch
      rr(c, 0, 0, w, h, 14);
      c.strokeStyle = OUTLINE;
      c.lineWidth = 2.2;
      c.stroke();
    });

    ctx.drawImage(sprite, zone.x - pad, zone.y - pad);
    ctx.restore();
  };

  // ============================================================================
  // DEFINICE DRUHŮ SLIZÁKŮ A PŘEDKRESLENÝCH ČÁSTÍ (Offscreen Cache)
  // ============================================================================

  const SLIME_DEFS = {
    kapicka_slizu: {
      base: '#44b8ff', dark: '#2389d6', hi: '#a8e4ff',
      alpha: 0.85, shape: 'drop'
    },
    lucni_slizak: {
      base: '#46d136', dark: '#28981e', hi: '#9ef57a',
      inner: 'leaves'
    },
    lesni_slizak: {
      base: '#ff961f', dark: '#cf6208', hi: '#ffe066',
      inner: 'core'
    },
    bleskovy_sliz: {
      base: '#ff4fa3', dark: '#c72270', hi: '#ffee55',
      shape: ' elongated', inner: 'lightning'
    },
    cerny_sliz: {
      base: '#2b2d34', dark: '#15161a', hi: '#686e7a',
      inner: 'tar'
    },
    snezny_sliz: {
      base: '#eef9ff', dark: '#b3d7eb', hi: '#ffffff',
      inner: 'frost'
    },
    runovy_sliz: {
      base: '#8c42f5', dark: '#591eb8', hi: '#d19eff',
      inner: 'rune'
    },
    prilbosliz: {
      base: '#8d96a3', dark: '#5e6670', hi: '#c5cdd6',
      inherentHelmet: true
    },
    duhovy_sliz: {
      base: '#ff5e6c', dark: '#398dfa', hi: '#fff176',
      inner: 'rainbow'
    },
    zlaty_sliz: {
      base: '#f5be18', dark: '#b87d04', hi: '#fff380',
      inner: 'gold_crust'
    },
    slizovy_obr: {
      base: '#1eb597', dark: '#107a65', hi: '#7bf2d8',
      boss: true, crown: 'iron', inner: 'club'
    },
    rudy_arcisliz: {
      base: '#d91e2b', dark: '#850a14', hi: '#ff7354',
      boss: true, crown: 'gold', inner: 'fire_core'
    },
    stinosliz_prizrak: {
      base: '#252336', dark: '#110f1c', hi: '#665f8a',
      boss: true, crown: 'dark_helmet', alpha: 0.78, inner: 'shadow_armor'
    },
    prastary_kral_slizu: {
      base: '#6f22d4', dark: '#3f0c85', hi: '#f7c844',
      boss: true, crown: 'grand_gold', inner: 'throne'
    }
  };

  /**
   * Vrátí předkreslené tělo slizáka z cache podle druhu a kvantizovaného poloměru
   */
  function getSlimeBodySprite(id, r) {
    const qR = Math.max(6, Math.round(r));
    const key = `slime_body_${id}_${qR}`;
    const pad = Math.ceil(qR * 0.65) + 6;
    const size = (qR + pad) * 2;

    return getCached(key, size, size, function (ctx, w, h) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const def = SLIME_DEFS[id] || SLIME_DEFS.lucni_slizak;
      const rng = createRNG(hashStr(id));

      ctx.save();
      ctx.translate(cx, cy);

      // 1. Sněžný opar pod tělem (pokud jde o sněžného slizáka)
      if (def.inner === 'frost') {
        ctx.fillStyle = 'rgba(195, 240, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, qR * 1.28, 0, TAU);
        ctx.fill();
      }

      // 2. Definice tvaru těla (směr 0 = doprava)
      const traceBodyShape = function (rad) {
        ctx.beginPath();
        if (def.shape === 'drop') {
          // Kapička slizu (špička vzadu vlevo, kulatá hlava vepředu vpravo)
          ctx.moveTo(-rad * 1.25, 0);
          ctx.quadraticCurveTo(-rad * 0.4, -rad * 1.05, rad * 0.2, -rad * 0.95);
          ctx.arc(rad * 0.15, 0, rad * 0.95, -PI * 0.5, PI * 0.5);
          ctx.quadraticCurveTo(-rad * 0.4, rad * 1.05, -rad * 1.25, 0);
        } else if (def.shape === ' elongated') {
          // Bleskový protáhlý sliz
          ctx.ellipse(0, 0, rad * 1.25, rad * 0.82, 0, 0, TAU);
        } else {
          // Klasický baculatý slizák
          ctx.ellipse(0, 0, rad * 1.04, rad * 0.96, 0, 0, TAU);
        }
        ctx.closePath();
      };

      // Základní barva těla
      traceBodyShape(qR);
      ctx.fillStyle = def.base;
      ctx.fill();

      // Ořez na vnitřek těla pro vnitřní detaily a stínování
      ctx.save();
      traceBodyShape(qR);
      ctx.clip();

      // Spodní/pravý stín uvnitř slizu (světlo jde shora zleva)
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      ctx.arc(qR * 0.25, qR * 0.25, qR * 1.05, 0, TAU);
      ctx.fill();

      // Vnitřní střední barva
      ctx.fillStyle = def.base;
      ctx.beginPath();
      ctx.arc(-qR * 0.12, -qR * 0.12, qR * 0.92, 0, TAU);
      ctx.fill();

      // Specifické vnitřní prvky podle druhu slizáka
      if (def.inner === 'leaves') {
        // Drobné lístky uvnitř rosolu
        ctx.fillStyle = '#1f7a1c';
        for (let i = 0; i < 3; i++) {
          const lx = (rng() - 0.5) * qR * 0.9;
          const ly = (rng() - 0.5) * qR * 0.9;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(rng() * PI);
          ctx.beginPath();
          ctx.ellipse(0, 0, qR * 0.28, qR * 0.14, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      } else if (def.inner === 'core') {
        // Větší pružné jádro lesního slizáka
        ctx.fillStyle = '#d9381e';
        ctx.beginPath();
        ctx.arc(-qR * 0.05, 0, qR * 0.45, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff7b29';
        ctx.beginPath();
        ctx.arc(-qR * 0.12, -qR * 0.08, qR * 0.28, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'lightning') {
        // Žlutý bleskový pruh
        ctx.fillStyle = '#ffea2e';
        ctx.beginPath();
        ctx.moveTo(qR * 0.6, -qR * 0.1);
        ctx.lineTo(-qR * 0.1, -qR * 0.45);
        ctx.lineTo(0, -qR * 0.05);
        ctx.lineTo(-qR * 0.75, qR * 0.25);
        ctx.lineTo(qR * 0.05, qR * 0.4);
        ctx.lineTo(-qR * 0.05, qR * 0.05);
        ctx.closePath();
        ctx.fill();
      } else if (def.inner === 'tar') {
        // Husté dehtové kroužky
        ctx.strokeStyle = '#484d59';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-qR * 0.2, qR * 0.2, qR * 0.3, 0, TAU);
        ctx.stroke();
      } else if (def.inner === 'rune') {
        // Zářící antimagický runový znak
        ctx.strokeStyle = '#ff94ff';
        ctx.lineWidth = Math.max(1.8, qR * 0.15);
        ctx.beginPath();
        ctx.moveTo(-qR * 0.35, -qR * 0.4);
        ctx.lineTo(qR * 0.25, 0);
        ctx.lineTo(-qR * 0.35, qR * 0.4);
        ctx.moveTo(-qR * 0.05, -qR * 0.5);
        ctx.lineTo(-qR * 0.05, qR * 0.5);
        ctx.stroke();
      } else if (def.inner === 'rainbow') {
        // Duhové propojení ohně (vlevo/nahoře) a ledu (vpravo/dole)
        ctx.fillStyle = '#ff9e22';
        ctx.beginPath();
        ctx.arc(-qR * 0.3, -qR * 0.2, qR * 0.65, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#4ae7ff';
        ctx.beginPath();
        ctx.arc(qR * 0.3, qR * 0.25, qR * 0.65, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#80ff72';
        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.45, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'gold_crust') {
        // Popraskaná zlatá krusta
        ctx.strokeStyle = '#6e4400';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-qR * 0.7, -qR * 0.2);
        ctx.lineTo(-qR * 0.1, 0);
        ctx.lineTo(qR * 0.4, -qR * 0.55);
        ctx.moveTo(-qR * 0.1, 0);
        ctx.lineTo(-qR * 0.3, qR * 0.65);
        ctx.moveTo(-qR * 0.1, 0);
        ctx.lineTo(qR * 0.6, qR * 0.3);
        ctx.stroke();
      } else if (def.inner === 'club') {
        // Dřevěný kyj uvnitř těla Slizového obra
        ctx.save();
        ctx.rotate(-0.5);
        rr(ctx, -qR * 0.65, -qR * 0.18, qR * 1.2, qR * 0.36, 6);
        fillAndStroke(ctx, '#8c5327', OUTLINE, 2);
        ctx.fillStyle = '#b87642';
        ctx.fillRect(-qR * 0.4, -qR * 0.08, qR * 0.7, qR * 0.1);
        ctx.restore();
      } else if (def.inner === 'fire_core') {
        // Planoucí jádro Rudého arcislizu
        ctx.fillStyle = '#ff7b00';
        ctx.beginPath();
        ctx.arc(-qR * 0.1, 0, qR * 0.58, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff04d';
        ctx.beginPath();
        ctx.arc(-qR * 0.1, 0, qR * 0.34, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'shadow_armor') {
        // Temné plátování Stínoslizu
        ctx.strokeStyle = '#6c5ce7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, qR * 0.68, PI * 0.6, PI * 1.4);
        ctx.stroke();
      } else if (def.inner === 'throne') {
        // Krystalový trůn uvnitř Prastarého krále slizů
        ctx.fillStyle = '#38e4ff';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-qR * 0.55, -qR * 0.45);
        ctx.lineTo(0, -qR * 0.6);
        ctx.lineTo(qR * 0.15, 0);
        ctx.lineTo(0, qR * 0.6);
        ctx.lineTo(-qR * 0.55, qR * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#b5f7ff';
        ctx.beginPath();
        ctx.moveTo(-qR * 0.45, -qR * 0.3);
        ctx.lineTo(-qR * 0.05, -qR * 0.4);
        ctx.lineTo(-qR * 0.05, qR * 0.2);
        ctx.closePath();
        ctx.fill();
      }

      // Lesklý odlesk rosolu shora zleva
      ctx.fillStyle = def.hi;
      ctx.beginPath();
      ctx.ellipse(-qR * 0.32, -qR * 0.35, qR * 0.32, qR * 0.18, -0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(-qR * 0.36, -qR * 0.38, qR * 0.16, qR * 0.09, -0.5, 0, TAU);
      ctx.fill();

      ctx.restore(); // Konec clipu těla

      // 3. Tmavý obrys těla (#111, 2 px)
      traceBodyShape(qR);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = qR > 20 ? 2.5 : 2;
      ctx.stroke();

      // 4. Koruna nebo zbroj bosse (předkreslená přímo na tělo pro maximální výkon)
      if (def.crown) {
        ctx.save();
        // Posunuto mírně dozadu od očí (oči jsou vpravo na +X)
        ctx.translate(-qR * 0.18, 0);
        if (def.crown === 'iron' || def.crown === 'gold' || def.crown === 'grand_gold') {
          const isGold = def.crown !== 'iron';
          const cFill = isGold ? '#ffcc29' : '#8c96a6';
          const cHi = isGold ? '#fff280' : '#c4cddb';
          const cw = qR * 0.55;
          const ch = qR * 0.65;

          ctx.beginPath();
          ctx.moveTo(-cw * 0.6, -ch * 0.7);
          ctx.lineTo(cw * 0.6, -ch);
          ctx.lineTo(cw * 0.25, -ch * 0.3);
          ctx.lineTo(cw * 0.75, 0);
          ctx.lineTo(cw * 0.25, ch * 0.3);
          ctx.lineTo(cw * 0.6, ch);
          ctx.lineTo(-cw * 0.6, ch * 0.7);
          ctx.closePath();
          fillAndStroke(ctx, cFill, OUTLINE, 2.2);

          // Odlesk koruny
          ctx.fillStyle = cHi;
          ctx.beginPath();
          ctx.arc(-cw * 0.15, -ch * 0.25, cw * 0.22, 0, TAU);
          ctx.fill();

          // Drahokamy na královské koruně
          if (def.crown === 'grand_gold') {
            ctx.fillStyle = '#ff2a55';
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, cw * 0.24, 0, TAU);
            ctx.fill();
            ctx.stroke();
          }
        } else if (def.crown === 'dark_helmet') {
          // Černá přilba Stínoslizu
          ctx.beginPath();
          ctx.arc(0, 0, qR * 0.72, PI * 0.45, PI * 1.55);
          ctx.lineTo(qR * 0.35, -qR * 0.35);
          ctx.lineTo(qR * 0.1, 0);
          ctx.lineTo(qR * 0.35, qR * 0.35);
          ctx.closePath();
          fillAndStroke(ctx, '#2d3142', OUTLINE, 2.2);
        }
        ctx.restore();
      }

      ctx.restore();
    });
  }

  /**
   * Předkreslená železná rytířská helma (pro stav s.armored nebo prilbosliz)
   */
  function getHelmetSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_helmet_${qR}`;
    const size = qR * 2 + 12;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      // Kovový zvon helmy kryjící zadní a boční část slizáka (vpředu vpravo vykukují oči)
      ctx.beginPath();
      ctx.arc(-qR * 0.08, 0, qR * 0.92, PI * 0.32, PI * 1.68);
      ctx.lineTo(qR * 0.35, -qR * 0.4);
      ctx.lineTo(qR * 0.18, 0);
      ctx.lineTo(qR * 0.35, qR * 0.4);
      ctx.closePath();
      fillAndStroke(ctx, '#929ca8', OUTLINE, 2);

      // Středový hřeben helmy a nýty
      ctx.fillStyle = '#c4cdd9';
      rr(ctx, -qR * 0.85, -qR * 0.16, qR * 0.95, qR * 0.32, 3);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });
  }

  /**
   * Předkreslený kamenný krunýř (pro stav s.fort)
   */
  function getFortSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_fort_${qR}`;
    const size = qR * 2 + 14;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      ctx.strokeStyle = '#7c858e';
      ctx.lineWidth = Math.max(3, qR * 0.28);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, qR * 0.96, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, qR * 1.08, 0, TAU);
      ctx.arc(0, 0, qR * 0.82, 0, TAU);
      ctx.stroke();
    });
  }

  /**
   * Předkreslený regenerační lísteček na hlavě (pro stav s.regrow)
   */
  function getRegrowSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_regrow_${qR}`;
    const size = qR * 2 + 12;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      const s = Math.max(5, qR * 0.48);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 1.2, -s * 1.1, -s * 0.2, -s * 1.4);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.8, 0, 0);
      fillAndStroke(ctx, '#4ce63e', OUTLINE, 1.6);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 1.1, -s * 0.9, s * 1.2, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.6, s * 0.5, 0, 0);
      fillAndStroke(ctx, '#38b82c', OUTLINE, 1.6);
    });
  }

  /**
   * Předkreslená ledová kostka (pro stav s.frozen)
   */
  function getFrozenCubeSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_ice_${qR}`;
    const size = qR * 2 + 16;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      const ir = qR * 1.12;
      rr(ctx, -ir, -ir, ir * 2, ir * 2, qR * 0.35);
      fillAndStroke(ctx, 'rgba(135, 228, 255, 0.58)', '#1a6b8f', 2);

      // Bílý odlesk ledu
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.moveTo(-ir * 0.75, -ir * 0.85);
      ctx.lineTo(-ir * 0.2, -ir * 0.85);
      ctx.lineTo(-ir * 0.85, -ir * 0.2);
      ctx.closePath();
      ctx.fill();
    });
  }

  // ============================================================================
  // API: VYKRESLENÍ SLIZÁKA A IKONY
  // ============================================================================

  /**
   * Vykreslí slizáka se všemi stavy, animací pohybu a případnými prvky bosse
   */
  TDS.slime = function (ctx, id, x, y, r, ang, ts, s) {
    ctx.save();

    const state = s || {};
    const def = SLIME_DEFS[id] || SLIME_DEFS.lucni_slizak;
    const rad = r || (def.boss ? 32 : 10);
    const time = ts || 0;
    const angle = ang || 0;
    const isImmobile = Boolean(state.frozen || state.stunned);

    // 1. Runová pečeť bosse na zemi pod slizákem (pokud má sealsTotal > 0)
    if (def.boss && state.sealsTotal > 0) {
      const total = state.sealsTotal;
      const left = state.sealsLeft || 0;
      const sealRad = rad * 1.42;
      const rot = time * 0.0008;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // Vnější magický kruh
      ctx.strokeStyle = 'rgba(255, 215, 70, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, sealRad, 0, TAU);
      ctx.stroke();

      // Dílky pečeti
      const gap = 0.14;
      const segAng = TAU / total;
      for (let i = 0; i < total; i++) {
        const a1 = i * segAng + gap * 0.5;
        const a2 = (i + 1) * segAng - gap * 0.5;
        const active = i < left;

        ctx.beginPath();
        ctx.arc(0, 0, sealRad, a1, a2);
        ctx.strokeStyle = active ? '#ffea47' : 'rgba(60, 65, 75, 0.55)';
        ctx.lineWidth = active ? 5 : 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Malý runový bod uprostřed aktivního dílku
        if (active) {
          const midA = (a1 + a2) * 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(Math.cos(midA) * sealRad, Math.sin(midA) * sealRad, 2.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 2. Zlatá záře pod/kolem slizáka (stav s.gold)
    if (state.gold) {
      const pulse = 1 + Math.sin(time * 0.008) * 0.08;
      ctx.fillStyle = 'rgba(255, 215, 40, 0.38)';
      ctx.beginPath();
      ctx.arc(x, y, rad * 1.38 * pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffea55';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // 3. Měkký stín vpravo dole
    const wobblePhase = isImmobile ? 0 : time * 0.012 + (x + y) * 0.03;
    const stretch = isImmobile ? 1 : 1 + Math.sin(wobblePhase) * 0.11;
    const squash = isImmobile ? 1 : 1 - Math.sin(wobblePhase) * 0.09;

    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(
      x + rad * 0.18 + 2,
      y + rad * 0.22 + 3,
      rad * 0.98 * stretch,
      rad * 0.88 * squash,
      angle,
      0,
      TAU
    );
    ctx.fill();

    // 4. Jiskry za bleskovým slizem
    if (id === 'bleskovy_sliz' && !isImmobile) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = '#fff04d';
      ctx.lineWidth = 2;
      const sparkOff = ((time * 0.03) % 1) * rad * 0.8;
      ctx.beginPath();
      ctx.moveTo(-rad - sparkOff, -3);
      ctx.lineTo(-rad - sparkOff - 5, 2);
      ctx.lineTo(-rad - sparkOff - 9, -2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Transformace těla (pozice, natočení ve směru ang, houpání squash & stretch)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(stretch, squash);

    // Průhlednost pro camo ("duchsliz") nebo přirozeně průsvitné druhy
    let alpha = def.alpha || 1;
    if (state.camo && !state.revealed) {
      alpha = 0.38;
    } else if (state.camo && state.revealed) {
      alpha = 0.82;
    }
    ctx.globalAlpha = alpha;

    // Vykreslení předkresleného těla z offscreen cache
    const bodySprite = getSlimeBodySprite(id, rad);
    ctx.drawImage(bodySprite, -bodySprite.width * 0.5, -bodySprite.height * 0.5);

    // Odhalený camo slizák má jemný magický obrys
    if (state.camo && state.revealed) {
      ctx.strokeStyle = '#70f8ff';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, rad * 1.06, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Kamenný krunýř (s.fort)
    if (state.fort) {
      const fortSprite = getFortSprite(rad);
      ctx.drawImage(fortSprite, -fortSprite.width * 0.5, -fortSprite.height * 0.5);
    }

    // Železná rytířská helma (s.armored nebo prilbosliz)
    if (state.armored || def.inherentHelmet) {
      const helmSprite = getHelmetSprite(rad);
      ctx.drawImage(helmSprite, -helmSprite.width * 0.5, -helmSprite.height * 0.5);
    }

    // 6. Oči koukající ve směru ang (v lokálních souřadnicích směrem +X)
    const eyeX = rad * 0.38;
    const eyeSpread = rad * 0.32;
    const eyeR = Math.max(2.2, rad * 0.21);

    // Bělmo očí
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(eyeX, -eyeSpread, eyeR, 0, TAU);
    ctx.arc(eyeX, eyeSpread, eyeR, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Zorničky (koukají dopředu)
    const pupilR = eyeR * 0.55;
    ctx.fillStyle = def.boss ? '#d91424' : '#111111';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.28, -eyeSpread, pupilR, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.28, eyeSpread, pupilR, 0, TAU);
    ctx.fill();

    // Jiskřička v oku
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.1, -eyeSpread - eyeR * 0.25, pupilR * 0.4, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.1, eyeSpread - eyeR * 0.25, pupilR * 0.4, 0, TAU);
    ctx.fill();

    // Zamračené obočí pro bosse
    if (def.boss) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(2.5, rad * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Levé obočí (nahoře)
      ctx.moveTo(eyeX - eyeR * 0.8, -eyeSpread - eyeR * 1.15);
      ctx.lineTo(eyeX + eyeR * 0.9, -eyeSpread - eyeR * 0.35);
      // Pravé obočí (dole)
      ctx.moveTo(eyeX - eyeR * 0.8, eyeSpread + eyeR * 1.15);
      ctx.lineTo(eyeX + eyeR * 0.9, eyeSpread + eyeR * 0.35);
      ctx.stroke();
    }

    // Regenerační lísteček na hlavě (s.regrow)
    if (state.regrow) {
      const leafSprite = getRegrowSprite(rad);
      ctx.drawImage(leafSprite, -leafSprite.width * 0.5, -leafSprite.height * 0.5);
    }

    // Krátké bílé bliknutí při zásahu (s.hit)
    if (state.hit) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.arc(0, 0, rad * 1.02, 0, TAU);
      ctx.fill();
    }

    ctx.restore(); // Konec rotovaného a škálovaného kontextu slizáka

    // 7. Efekty nezávislé na rotaci směru (led, oheň, kyselina, omráčení)
    if (state.frozen) {
      const iceSprite = getFrozenCubeSprite(rad);
      ctx.drawImage(iceSprite, x - iceSprite.width * 0.5, y - iceSprite.height * 0.5);
    }

    if (state.burn) {
      // Plamínky ohně
      const fTime = time * 0.015;
      for (let i = 0; i < 3; i++) {
        const fx = x + Math.sin(fTime + i * 2.1) * (rad * 0.55);
        const fy = y - rad * 0.2 - ((fTime * 4 + i * 7) % (rad * 0.9));
        const fr = Math.max(3, rad * 0.28);

        ctx.beginPath();
        ctx.moveTo(fx - fr, fy);
        ctx.quadraticCurveTo(fx, fy - fr * 2.2, fx + fr, fy);
        ctx.arc(fx, fy, fr, 0, PI);
        ctx.closePath();
        fillAndStroke(ctx, i % 2 === 0 ? '#ff6a00' : '#ffdd1a', OUTLINE, 1.4);
      }
    }

    if (state.acid) {
      // Zelené kyselinové bublinky
      const aTime = time * 0.01;
      for (let i = 0; i < 3; i++) {
        const bx = x + Math.cos(aTime + i * 2.2) * (rad * 0.65);
        const by = y - ((aTime * 6 + i * 5) % (rad * 1.1)) + rad * 0.3;
        const br = Math.max(2.2, rad * 0.18);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, TAU);
        fillAndStroke(ctx, '#7fff3b', OUTLINE, 1.3);
      }
    }

    if (state.stunned) {
      // Rotující hvězdičky omráčení
      const sTime = time * 0.006;
      const orbitR = rad * 0.85;
      for (let i = 0; i < 3; i++) {
        const sa = sTime + (i * TAU) / 3;
        const sx = x + Math.cos(sa) * orbitR;
        const sy = y - rad * 0.45 + Math.sin(sa) * (orbitR * 0.45);
        const sr = Math.max(3.5, rad * 0.22);

        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
          const pa = (p * PI) / 4;
          const pr = p % 2 === 0 ? sr : sr * 0.45;
          const px = sx + Math.cos(pa) * pr;
          const py = sy + Math.sin(pa) * pr;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        fillAndStroke(ctx, '#ffee38', OUTLINE, 1.4);
      }
    }

    // 8. Lišta životů bosse (hpPct, žádný text)
    if (def.boss && typeof state.hpPct === 'number') {
      const hp = Math.max(0, Math.min(1, state.hpPct));
      const barW = Math.max(54, rad * 1.6);
      const barH = 8;
      const bx = x - barW * 0.5;
      const by = y - rad - 18;

      // Podklad lišty
      rr(ctx, bx, by, barW, barH, 4);
      fillAndStroke(ctx, '#22252a', OUTLINE, 2);

      // Výplň životů
      if (hp > 0) {
        const fillCol = hp > 0.5 ? '#3fe048' : hp > 0.25 ? '#ffae19' : '#f02828';
        rr(ctx, bx + 1.5, by + 1.5, Math.max(4, (barW - 3) * hp), barH - 3, 2.5);
        ctx.fillStyle = fillCol;
        ctx.fill();

        // Lesklý proužek nahoře
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(bx + 3, by + 2, Math.max(0, (barW - 6) * hp), 2);
      }
    }

    ctx.restore();
  };

  /**
   * Vrátí malý canvas s ikonou slizáka pro náhled vlny v UI (s cache)
   */
  TDS.slimeIcon = function (id, size) {
    const s = Math.max(16, size || 36);
    const key = `slime_icon_${id}_${s}`;
    return getCached(key, s, s, function (ctx, w, h) {
      ctx.save();
      const def = SLIME_DEFS[id] || SLIME_DEFS.lucni_slizak;
      const r = def.boss ? s * 0.36 : s * 0.32;
      TDS.slime(ctx, id, w * 0.5, h * 0.5, r, -0.35, 0, {});
      ctx.restore();
    });
  };
})();

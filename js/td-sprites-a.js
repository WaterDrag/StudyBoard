/**
 * Obrana království - Kreslící knihovna (Část A: mapa, voda a slizáci) — vylepšené textury
 * Od Gemini; vlastní rozsah, vlastní pomocné funkce a cache (TDS.clearCacheA).
 */
/**
 * Obrana království - Kreslící knihovna (Část A: Mapa, voda a slizáci)
 * Čistý HTML5 Canvas 2D, optimalizováno pro mobilní zařízení (60 FPS) pomocí Offscreen Canvas Cache.
 * Vylepšené detailní textury materiálů (kámen, dřevo, kov, rosol, krystaly, runy).
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});

  // Globální konstanty stylu (lokální v uzávěru, nepřepisují jiné části)
  const OUTLINE = '#111111';
  const SHADOW_COL = 'rgba(12, 18, 8, 0.30)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // Interní cache pro předkreslené offscreen canvasy
  const cache = new Map();
  TDS.clearCacheA = () => cache.clear(); // po ztrátě grafického kontextu prohlížeče

  // ============================================================================
  // POMOCNÉ FUNKCE (Matematika, PRNG, Tvary, Kreslení, Cache)
  // ============================================================================

  /**
   * Deterministický pseudonáhodný generátor (Mulberry32)
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
   * Vykreslí aktuální cestu s výplní a obrysem
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
   * Pokročilé vykreslení tvaru s volitelným měkkým stínem a tmavým obrysem
   */
  function drawShape(ctx, pathFn, fillStyle, strokeStyle = OUTLINE, lineWidth = 2, hasShadow = false, shOffX = 2.5, shOffY = 3) {
    if (hasShadow) {
      ctx.save();
      ctx.translate(shOffX, shOffY);
      ctx.beginPath();
      pathFn(ctx);
      ctx.fillStyle = SHADOW_COL;
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    pathFn(ctx);
    fillAndStroke(ctx, fillStyle, strokeStyle, lineWidth);
    ctx.restore();
  }

  /**
   * Vykreslí světelný odlesk nebo barevnou vrstvu bez obrysu
   */
  function drawHighlight(ctx, pathFn, fillStyle) {
    ctx.save();
    ctx.beginPath();
    pathFn(ctx);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
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
  // POMOCNÉ KRESLÍCÍ FUNKCE PRO MAPU (Stromy, keře, překážky, jeskyně, brána)
  // ============================================================================

  /**
   * Nakreslí bohatě vrstvený strom nebo keř (pohled shora, světlo shora zleva)
   */
  function drawTreeOrBush(ctx, x, y, scale, isBush, rng) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Měkký vržený stín vpravo dole
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(5, 6, isBush ? 15 : 22, isBush ? 12 : 19, 0, 0, TAU);
    ctx.fill();

    if (isBush) {
      // === BOHATÝ KEŘ S LÍSTKY A BOBULKAMI ===
      const isWarm = rng() > 0.5;
      const darkCol = isWarm ? '#236e27' : '#1b632a';
      const baseCol = isWarm ? '#389c35' : '#2e8b34';
      const hiCol = isWarm ? '#62cc49' : '#52bf48';
      const topHi = '#99eb73';

      const puffs = [
        { dx: -6, dy: 3, r: 9.5 },
        { dx: 6.5, dy: 3, r: 9 },
        { dx: -4, dy: -4, r: 9.5 },
        { dx: 5, dy: -3.5, r: 8.5 },
        { dx: 0, dy: 0, r: 10.5 }
      ];

      // 1. Tmavý obrys celého keře
      ctx.fillStyle = OUTLINE;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx, p.dy, p.r + 2.2, 0, TAU);
        ctx.fill();
      }
      // 2. Spodní tmavá zeleň
      ctx.fillStyle = darkCol;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx, p.dy, p.r, 0, TAU);
        ctx.fill();
      }
      // 3. Střední sytá zeleň posunutá mírně k источníku světla (vlevo nahoru)
      ctx.fillStyle = baseCol;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx - 1, p.dy - 1, p.r * 0.86, 0, TAU);
        ctx.fill();
      }
      // 4. Nasvícené vrcholky shora zleva
      ctx.fillStyle = hiCol;
      for (const p of puffs) {
        ctx.beginPath();
        ctx.arc(p.dx - 2.2, p.dy - 2.4, p.r * 0.56, 0, TAU);
        ctx.fill();
      }
      // 5. Nejjasnější odlesk lístků
      ctx.fillStyle = topHi;
      ctx.beginPath();
      ctx.arc(-5, -5.5, 3.2, 0, TAU);
      ctx.arc(1, -2.5, 2.8, 0, TAU);
      ctx.arc(-7.5, 1.5, 2.5, 0, TAU);
      ctx.fill();

      // 6. Lesklé bobulky nebo drobné kvítky
      if (rng() > 0.35) {
        const berryCol = rng() > 0.3 ? '#e53935' : '#ff8f00';
        const berries = [[-5, -1], [4, -4], [6, 2.5], [-2, 4.5], [1, 1]];
        for (const b of berries) {
          ctx.beginPath();
          ctx.arc(b[0], b[1], 2.4, 0, TAU);
          fillAndStroke(ctx, berryCol, OUTLINE, 1.3);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b[0] - 0.7, b[1] - 0.7, 0.8, 0, TAU);
          ctx.fill();
        }
      }
    } else {
      // === DETAILNÍ KORUNA STROMU S KOŘENY A VRSTVENÝM LISTÍM ===
      // Vykukující kořeny u paty stromu
      ctx.fillStyle = '#5d4037';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, 12);
      ctx.lineTo(-9, 19);
      ctx.lineTo(-2, 16);
      ctx.moveTo(4, 12);
      ctx.lineTo(10, 18);
      ctx.lineTo(2, 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const variant = rng();
      const shadowLeaf = variant > 0.35 ? '#1b5e20' : '#26691e';
      const darkCol    = variant > 0.35 ? '#287d2c' : '#358826';
      const midCol     = variant > 0.35 ? '#3ca638' : '#4eb032';
      const lightCol   = variant > 0.35 ? '#66cf4c' : '#7bdb4d';
      const rimCol     = '#a9f578';

      const lobes = [
        { x: -9, y: 7, r: 12 },
        { x: 9, y: 7, r: 11.5 },
        { x: -11, y: -3, r: 12.5 },
        { x: 10, y: -3.5, r: 11.5 },
        { x: 0, y: 10, r: 11 },
        { x: -2, y: -10, r: 13 },
        { x: 5, y: -9, r: 10.5 },
        { x: -1, y: 0, r: 14.5 }
      ];

      // 1. Tmavý obrys celé koruny
      ctx.fillStyle = OUTLINE;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r + 2.3, 0, TAU);
        ctx.fill();
      }
      // 2. Hluboký stín listoví (vpravo dole)
      ctx.fillStyle = shadowLeaf;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, TAU);
        ctx.fill();
      }
      // 3. Tmavší střední vrstva
      ctx.fillStyle = darkCol;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x - 1, l.y - 1, l.r * 0.88, 0, TAU);
        ctx.fill();
      }
      // 4. Vnitřní zářezy mezi patry větví (kreslené linky pro komiksovou hloubku)
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(3, 3, 9, 0.2, 2.2);
      ctx.stroke();

      // 5. Hlavní nasvícená vrstva
      ctx.fillStyle = midCol;
      for (const l of lobes) {
        ctx.beginPath();
        ctx.arc(l.x - 2.2, l.y - 2.2, l.r * 0.72, 0, TAU);
        ctx.fill();
      }
      // 6. Horní sluncem zalitá koruna (vlevo nahoře)
      ctx.fillStyle = lightCol;
      ctx.beginPath();
      ctx.arc(-5, -5.5, 9.5, 0, TAU);
      ctx.arc(2.5, -6.5, 7, 0, TAU);
      ctx.arc(-7.5, 1.5, 7, 0, TAU);
      ctx.arc(-1, -1, 7.5, 0, TAU);
      ctx.fill();

      // 7. Jasné lístky na samotném vrcholku
      ctx.fillStyle = rimCol;
      ctx.beginPath();
      ctx.ellipse(-6.5, -7.5, 4.5, 2.8, -0.4, 0, TAU);
      ctx.ellipse(-1.5, -9, 3.5, 2.2, -0.2, 0, TAU);
      ctx.ellipse(-9.5, -1, 3.2, 2.2, -0.6, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Nakreslí detailní překážku podle jejího názvu a rozměrů (ruina věže, skalní útes, mechový balvan)
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
    ctx.ellipse(cx + 5, cy + 6, rx * 0.96, ry * 0.92, 0, 0, TAU);
    ctx.fill();

    if (name.includes('věž') || name.includes('vez')) {
      // === ROZBOŘENÁ STRÁŽNÍ VĚŽ (Detailní kamenná ruina s dlažbou a břečťanem) ===
      const r = Math.min(rx, ry) * 0.85;

      // Popadané opracované kvádry v okolí
      const rubble = [
        { dx: rx * 0.65, dy: ry * 0.45, w: 14, h: 10, ang: 0.3 },
        { dx: rx * 0.38, dy: ry * 0.72, w: 11, h: 9, ang: -0.4 },
        { dx: -rx * 0.72, dy: ry * 0.35, w: 12, h: 10, ang: 0.2 },
        { dx: rx * 0.55, dy: -ry * 0.48, w: 13, h: 9, ang: 0.6 }
      ];
      for (const rb of rubble) {
        ctx.save();
        ctx.translate(cx + rb.dx, cy + rb.dy);
        ctx.rotate(rb.ang);
        rr(ctx, -rb.w * 0.5, -rb.h * 0.5, rb.w, rb.h, 2.5);
        fillAndStroke(ctx, '#7d8691', OUTLINE, 1.8);
        ctx.fillStyle = '#a3acb8';
        ctx.fillRect(-rb.w * 0.35, -rb.h * 0.35, rb.w * 0.6, rb.h * 0.35);
        ctx.restore();
      }

      // Kamenný základ věže
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      fillAndStroke(ctx, '#636b75', OUTLINE, 2.5);

      // Vnitřní dlážděná podlaha ruiny
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 1, r * 0.74, 0, TAU);
      fillAndStroke(ctx, '#3e434c', OUTLINE, 2);

      // Kamenné dlaždice a praskliny v podlaze
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 1, r * 0.72, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = '#25282e';
      ctx.lineWidth = 1.6;
      const step = r * 0.42;
      for (let gx = cx - r; gx <= cx + r; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, cy - r);
        ctx.lineTo(gx, cy + r);
        ctx.stroke();
      }
      for (let gy = cy - r; gy <= cy + r; gy += step) {
        ctx.beginPath();
        ctx.moveTo(cx - r, gy);
        ctx.lineTo(cx + r, gy);
        ctx.stroke();
      }
      // Zřícené dřevěné trámy uvnitř ruiny
      ctx.save();
      ctx.translate(cx + r * 0.1, cy + r * 0.15);
      ctx.rotate(0.45);
      rr(ctx, -r * 0.45, -3.5, r * 0.9, 7, 1.5);
      fillAndStroke(ctx, '#6d4c41', OUTLINE, 1.6);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(-r * 0.38, -2, r * 0.75, 2);
      ctx.restore();
      ctx.restore();

      // Zbořené cimbuří (obloukové kamenné kvádry s odlesky, vpravo dole prolomené)
      const blocks = 8;
      for (let i = 0; i < blocks; i++) {
        if (i === 1 || i === 2) continue; // Probořená část zdi
        const a1 = (i / blocks) * TAU - PI * 0.85;
        const a2 = ((i + 0.78) / blocks) * TAU - PI * 0.85;
        const isLit = i >= 4 && i <= 7;

        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.05, a1, a2);
        ctx.arc(cx, cy, r * 0.68, a2, a1, true);
        ctx.closePath();
        fillAndStroke(ctx, isLit ? '#9aa3b0' : '#767f8a', OUTLINE, 2);

        // Odlesk hrany kvádru
        if (isLit) {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.98, a1 + 0.05, a2 - 0.05);
          ctx.strokeStyle = '#c5ced9';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      }

      // Bohatý mech a břečťan na severozápadní stěně
      const mossBalls = [
        { x: cx - r * 0.58, y: cy - r * 0.45, mr: r * 0.26 },
        { x: cx - r * 0.35, y: cy - r * 0.68, mr: r * 0.2 },
        { x: cx - r * 0.68, y: cy - r * 0.18, mr: r * 0.19 }
      ];
      ctx.fillStyle = OUTLINE;
      for (const m of mossBalls) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.mr + 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#43a032';
      for (const m of mossBalls) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.mr, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#76d95b';
      for (const m of mossBalls) {
        ctx.beginPath();
        ctx.arc(m.x - 1.5, m.y - 1.5, m.mr * 0.55, 0, TAU);
        ctx.fill();
      }

    } else if (name.includes('útes') || name.includes('utes')) {
      // === SKALNÍ ÚTES (Ostré krystalické fazety, praskliny a horská tráva) ===
      const peaks = [
        { dx: -rx * 0.35, dy: ry * 0.22, rad: Math.min(rx, ry) * 0.56 },
        { dx: rx * 0.36, dy: ry * 0.16, rad: Math.min(rx, ry) * 0.54 },
        { dx: 0.05 * rx, dy: -ry * 0.26, rad: Math.min(rx, ry) * 0.64 },
        { dx: -rx * 0.08, dy: ry * 0.04, rad: Math.min(rx, ry) * 0.72 }
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
          const mod = 0.82 + rng() * 0.28;
          pts.push({
            x: px + Math.cos(a) * pr * mod,
            y: py + Math.sin(a) * pr * mod
          });
        }
        const topX = px - pr * 0.16;
        const topY = py - pr * 0.16;

        // Základní skalní silueta
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < sides; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        fillAndStroke(ctx, '#737b87', OUTLINE, 2.2);

        // Ozářené severozápadní fazety
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.lineTo(pts[5].x, pts[5].y);
        ctx.closePath();
        ctx.fillStyle = '#a5aebd';
        ctx.fill();

        // Nejjasnější horní hrana
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(pts[4].x, pts[4].y);
        ctx.lineTo(pts[5].x, pts[5].y);
        ctx.closePath();
        ctx.fillStyle = '#c2cbd9';
        ctx.fill();

        // Zastíněné jihovýchodní fazety
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.lineTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fillStyle = '#505661';
        ctx.fill();

        // Vnitřní ostré hřebeny a pukliny
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(pts[4].x, pts[4].y);
        ctx.lineTo(topX, topY);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.moveTo(topX, topY);
        ctx.lineTo(pts[6].x, pts[6].y);
        ctx.stroke();

        // Světlý odlesk podél hřebene
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pts[4].x, pts[4].y);
        ctx.lineTo(topX, topY);
        ctx.stroke();
      }
    } else {
      // === MECHOVÝ BALVAN (Vrstvený kámen s puklinami, mechem a kapradím) ===
      ctx.beginPath();
      const steps = 12;
      const poly = [];
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * TAU;
        const radX = rx * (0.84 + Math.sin(i * 2.1) * 0.09);
        const radY = ry * (0.84 + Math.cos(i * 1.7) * 0.09);
        const x = cx + Math.cos(a) * radX;
        const y = cy + Math.sin(a) * radY;
        poly.push({ x, y });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      fillAndStroke(ctx, '#7a828c', OUTLINE, 2.4);

      // Ořez na balvan pro vnitřní stínování a pukliny
      ctx.save();
      ctx.clip();

      // Tmavý stín na jihovýchodní straně balvanu
      ctx.fillStyle = '#585f69';
      ctx.beginPath();
      ctx.arc(cx + rx * 0.28, cy + ry * 0.28, Math.max(rx, ry) * 0.95, 0, TAU);
      ctx.fill();

      // Střední barva balvanu
      ctx.fillStyle = '#7d8691';
      ctx.beginPath();
      ctx.arc(cx - rx * 0.1, cy - ry * 0.1, Math.max(rx, ry) * 0.85, 0, TAU);
      ctx.fill();

      // Jasná ploška kamene shora zleva
      ctx.fillStyle = '#a3acb8';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.25, cy - ry * 0.25, rx * 0.48, ry * 0.36, -0.45, 0, TAU);
      ctx.fill();

      // Skalní puklina s odleskem hrany
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + rx * 0.15, cy + ry * 0.05);
      ctx.lineTo(cx + rx * 0.35, cy + ry * 0.25);
      ctx.lineTo(cx + rx * 0.22, cy + ry * 0.48);
      ctx.stroke();

      ctx.restore();

      // Znovu obrys balvanu
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        if (i === 0) ctx.moveTo(poly[i].x, poly[i].y);
        else ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Bohatý sametový mechový porost
      const mR = Math.min(rx, ry);
      const mossPuffs = [
        { x: cx - rx * 0.26, y: cy - ry * 0.16, r: mR * 0.40 },
        { x: cx + rx * 0.08, y: cy - ry * 0.32, r: mR * 0.33 },
        { x: cx - rx * 0.04, y: cy + ry * 0.10, r: mR * 0.29 },
        { x: cx - rx * 0.42, y: cy + ry * 0.06, r: mR * 0.25 }
      ];
      ctx.fillStyle = OUTLINE;
      for (const mp of mossPuffs) {
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, mp.r + 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3f9e30';
      for (const mp of mossPuffs) {
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, mp.r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#6ed455';
      for (const mp of mossPuffs) {
        ctx.beginPath();
        ctx.arc(mp.x - mp.r * 0.25, mp.y - mp.r * 0.25, mp.r * 0.55, 0, TAU);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Nakreslí detailní slizovou jeskyni s krystaly, zuby skály a vytékajícím slizem na začátku cesty
   */
  function drawCaveEntrance(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // Měkký stín jeskyně
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(4, 6, 34, 30, 0, 0, TAU);
    ctx.fill();

    // Vytékající zelená slizová louže před vchodem
    drawShape(ctx, c => {
      c.ellipse(7, 0, 16, 17, 0, 0, TAU);
    }, '#3ec72e', OUTLINE, 2, false);
    drawHighlight(ctx, c => {
      c.ellipse(9, -2, 11, 12, 0, 0, TAU);
    }, '#6cf056');
    drawHighlight(ctx, c => {
      c.ellipse(12, -5, 4.5, 3, -0.3, 0, TAU);
    }, '#c8ffab');

    // Temný jícen jeskyně
    drawShape(ctx, c => {
      c.ellipse(-5, 0, 17, 21, 0, 0, TAU);
    }, '#111a12', OUTLINE, 2.5, false);

    // Zářící oči slizáků číhajících ve tmě
    const eyes = [
      { x: -10, y: -7, r: 2.3, col: '#ffea00' },
      { x: -10, y: -2, r: 2.3, col: '#ffea00' },
      { x: -15, y: 5, r: 1.9, col: '#ff5252' },
      { x: -15, y: 9.5, r: 1.9, col: '#ff5252' }
    ];
    for (const e of eyes) {
      ctx.fillStyle = e.col;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x - 0.5, e.y - 0.5, e.r * 0.4, 0, TAU);
      ctx.fill();
    }

    // Skalní tesáky / krápníky přečnívající přes vchod
    const fangs = [[-2, -16, 4, -10], [-4, 15, 3, 10], [-14, -12, -8, -7]];
    for (const f of fangs) {
      drawShape(ctx, c => {
        c.moveTo(f[0], f[1] - 4);
        c.lineTo(f[2], f[3]);
        c.lineTo(f[0], f[1] + 4);
        c.closePath();
      }, '#545c66', OUTLINE, 1.6, false);
    }

    // Skalní masiv tvořící klenbu kolem jeskyně
    const rocks = [
      { x: -19, y: -16, r: 13.5 },
      { x: -25, y: 0, r: 15.5 },
      { x: -19, y: 16, r: 13.5 },
      { x: -6, y: -22, r: 12.5 },
      { x: -6, y: 22, r: 12.5 },
      { x: 6, y: -19, r: 10.5 },
      { x: 6, y: 19, r: 10.5 }
    ];
    for (const rk of rocks) {
      // Základ skály
      ctx.beginPath();
      ctx.arc(rk.x, rk.y, rk.r, 0, TAU);
      fillAndStroke(ctx, '#636b75', OUTLINE, 2.2);
      // Střední vrstva skály
      ctx.fillStyle = '#7c8591';
      ctx.beginPath();
      ctx.arc(rk.x - 1.5, rk.y - 1.5, rk.r * 0.8, 0, TAU);
      ctx.fill();
      // Odlesk shora zleva
      ctx.fillStyle = '#a3adb8';
      ctx.beginPath();
      ctx.arc(rk.x - 3.5, rk.y - 3.5, rk.r * 0.45, 0, TAU);
      ctx.fill();
    }

    // Zářící fialovo-zelené krystaly vyrůstající ze skály u jeskyně
    const crystals = [
      { x: -16, y: -22, ang: -0.6, s: 1 },
      { x: -22, y: 18, ang: 0.5, s: 0.85 },
      { x: 4, y: -23, ang: -0.2, s: 0.75 }
    ];
    for (const cr of crystals) {
      ctx.save();
      ctx.translate(cr.x, cr.y);
      ctx.rotate(cr.ang);
      ctx.scale(cr.s, cr.s);
      drawShape(ctx, c => {
        c.moveTo(-4, 0);
        c.lineTo(-2, -11);
        c.lineTo(2, -13);
        c.lineTo(4, 0);
        c.closePath();
      }, '#ab47bc', OUTLINE, 1.6, false);
      drawHighlight(ctx, c => {
        c.moveTo(-2, -1);
        c.lineTo(-1, -10);
        c.lineTo(1.5, -11);
        c.lineTo(0, -1);
        c.closePath();
      }, '#ea80fc');
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Nakreslí detailní hradní bránu s kamenným zdivem, okovaným mostem, věžemi a královským praporem
   */
  function drawCastleGate(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    // Měkký stín celé brány
    ctx.fillStyle = SHADOW_COL;
    ctx.beginPath();
    ctx.ellipse(6, 7, 32, 40, 0, 0, TAU);
    ctx.fill();

    // 1. Kamenná hradba kolmo na cestu
    rr(ctx, -13, -35, 26, 70, 5);
    fillAndStroke(ctx, '#7f8792', OUTLINE, 2.5);

    // Vykreslení kamenných kvádrů na hradbě
    ctx.fillStyle = '#9aa3b0';
    for (let by = -30; by <= 24; by += 11) {
      rr(ctx, -10, by, 10, 8, 1.5);
      ctx.fill();
    }
    ctx.strokeStyle = '#4e545c';
    ctx.lineWidth = 1.4;
    for (let by = -24; by <= 24; by += 11) {
      ctx.beginPath();
      ctx.moveTo(-12, by);
      ctx.lineTo(12, by);
      ctx.stroke();
    }

    // 2. Dřevěná okovaná brána / padací most uprostřed
    rr(ctx, -15, -16, 30, 32, 3);
    fillAndStroke(ctx, '#6d4423', OUTLINE, 2.2);

    // Světlejší prkna s letokruhy
    ctx.fillStyle = '#87562e';
    ctx.fillRect(-13, -14, 14, 28);

    // Spáry mezi prkny
    ctx.strokeStyle = '#38200e';
    ctx.lineWidth = 1.5;
    for (let py = -10; py <= 10; py += 5) {
      ctx.beginPath();
      ctx.moveTo(-13, py);
      ctx.lineTo(13, py);
      ctx.stroke();
    }

    // Železné pásy a nýty na bráně
    ctx.fillStyle = '#78909c';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    for (const bx of [-11, 7]) {
      rr(ctx, bx, -15, 4, 30, 1);
      ctx.fill();
      ctx.stroke();
      // Nýty
      ctx.fillStyle = '#cfd8dc';
      for (let ny = -12; ny <= 12; ny += 6) {
        ctx.beginPath();
        ctx.arc(bx + 2, ny, 1.1, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#78909c';
    }

    // Zlatý královský štít nad průjezdem
    drawShape(ctx, c => {
      c.moveTo(-4, -6);
      c.lineTo(4, -6);
      c.lineTo(4, 0);
      c.lineTo(0, 6);
      c.lineTo(-4, 0);
      c.closePath();
    }, '#ffb300', OUTLINE, 1.6, false);
    drawHighlight(ctx, c => {
      c.moveTo(-2.5, -4.5);
      c.lineTo(1, -4.5);
      c.lineTo(-2.5, 1);
      c.closePath();
    }, '#fff176');

    // 3. Dvě boční obranné věže s cimbuřím a modrou kuželovou střechou
    const towerY = [-29, 29];
    for (const ty of towerY) {
      // Stín věže
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(3, ty + 3, 17, 0, TAU);
      ctx.fill();

      // Kamenné tělo věže
      ctx.beginPath();
      ctx.arc(0, ty, 16.5, 0, TAU);
      fillAndStroke(ctx, '#737b86', OUTLINE, 2.5);

      // Světlejší nasvícený ochoz
      ctx.beginPath();
      ctx.arc(-1.5, ty - 1.5, 13, 0, TAU);
      fillAndStroke(ctx, '#9aa3b0', OUTLINE, 1.8);

      // Kamenné zuby cimbuří po obvodu věže
      const merlons = 8;
      for (let m = 0; m < merlons; m++) {
        const ma = (m / merlons) * TAU;
        ctx.save();
        ctx.translate(Math.cos(ma) * 14, ty + Math.sin(ma) * 14);
        ctx.rotate(ma);
        rr(ctx, -2.5, -3.5, 5, 7, 1);
        fillAndStroke(ctx, m >= 3 && m <= 6 ? '#b4bcc8' : '#7c8490', OUTLINE, 1.5);
        ctx.restore();
      }

      // Královská modrá střecha s šindeli a odleskem
      ctx.beginPath();
      ctx.arc(0, ty, 8.5, 0, TAU);
      fillAndStroke(ctx, '#1e5bb8', OUTLINE, 2);
      drawHighlight(ctx, c => {
        c.arc(-2.2, ty - 2.2, 4.5, 0, TAU);
      }, '#4dabf5');

      // Zlatá makovice na vrcholu střechy
      ctx.beginPath();
      ctx.arc(0, ty, 2.5, 0, TAU);
      fillAndStroke(ctx, '#ffd740', OUTLINE, 1.4);
    }

    // 4. Královský prapor se zlatým lemováním na severní věži
    ctx.save();
    ctx.translate(0, -29);
    // Dřevěná žerď
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(20, -15);
    ctx.stroke();

    // Vlající látka praporu se záhybem
    drawShape(ctx, c => {
      c.moveTo(6, -5);
      c.quadraticCurveTo(15, -11, 26, -11);
      c.lineTo(21, -2);
      c.lineTo(26, 6);
      c.quadraticCurveTo(15, 2, 6, 3);
      c.closePath();
    }, '#d32f2f', OUTLINE, 1.8, true, 2, 2);

    // Světlejší záhyb látky
    drawHighlight(ctx, c => {
      c.moveTo(7, -4);
      c.quadraticCurveTo(15, -9, 23, -9);
      c.lineTo(18, -3);
      c.closePath();
    }, '#ff6659');

    // Zlatá korunka na praporu
    drawShape(ctx, c => {
      c.arc(14, -2.5, 2.8, 0, TAU);
    }, '#ffd740', OUTLINE, 1.2, false);
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

    const cacheKey =
      'bg_v2_' +
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

      // 1. Základní sytá tráva s bohatou vrstevnicovou texturou
      ctx.fillStyle = '#5bb843';
      ctx.fillRect(0, 0, W, H);

      // Velké organické plochy světlejší a tmavší trávy (svahování a louky)
      for (let i = 0; i < 85; i++) {
        const gx = rng() * W;
        const gy = rng() * H;
        const gr = 30 + rng() * 70;
        const rChoice = rng();
        ctx.fillStyle = rChoice < 0.35 ? '#4fa839' : rChoice < 0.75 ? '#65c44b' : '#72cf55';
        ctx.beginPath();
        ctx.ellipse(gx, gy, gr * 1.3, gr * 0.85, rng() * PI, 0, TAU);
        ctx.fill();
      }

      // Jemné globální nasvícení shora zleva a ztmavení vpravo dole (jednou při generování cache)
      const sunGrad = ctx.createLinearGradient(0, 0, W, H);
      sunGrad.addColorStop(0, 'rgba(255, 255, 200, 0.16)');
      sunGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      sunGrad.addColorStop(1, 'rgba(10, 30, 12, 0.16)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Vodní zóny - kamenně-písečný břeh, rákosí a podklad vody
      for (let i = 0; i < waterZones.length; i++) {
        const wz = waterZones[i];
        // Vnější stín břehu
        rr(ctx, wz.x - 7, wz.y - 6, wz.width + 15, wz.height + 14, 20);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fill();

        // Písečný a oblázkový břeh
        rr(ctx, wz.x - 6, wz.y - 6, wz.width + 12, wz.height + 12, 18);
        fillAndStroke(ctx, '#d9bf82', OUTLINE, 2.5);

        // Světlejší písek na návětrné straně břehu
        rr(ctx, wz.x - 4, wz.y - 4, wz.width + 6, wz.height + 6, 16);
        ctx.fillStyle = '#ebd49b';
        ctx.fill();

        // Drobné pobřežní oblázky na břehu
        for (let p = 0; p < 12; p++) {
          const side = p % 4;
          let px, py;
          if (side === 0) { px = wz.x + rng() * wz.width; py = wz.y - 3; }
          else if (side === 1) { px = wz.x + rng() * wz.width; py = wz.y + wz.height + 3; }
          else if (side === 2) { px = wz.x - 3; py = wz.y + rng() * wz.height; }
          else { px = wz.x + wz.width + 3; py = wz.y + rng() * wz.height; }
          ctx.beginPath();
          ctx.ellipse(px, py, 3.5, 2.5, rng() * PI, 0, TAU);
          fillAndStroke(ctx, rng() > 0.5 ? '#8d96a0' : '#a69b8d', OUTLINE, 1.3);
        }

        // Vnitřní základ vody
        rr(ctx, wz.x, wz.y, wz.width, wz.height, 14);
        fillAndStroke(ctx, '#2288cc', OUTLINE, 2);
      }

      // 3. Cesty (44 px široké, vrstvený trávníkový lem, udusaná hlína, vyjeté koleje a kamenná dlažba)
      const drawAllPaths = function (width, strokeStyle, lineDash = []) {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (lineDash.length) ctx.setLineDash(lineDash);
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
        ctx.restore();
      };

      // Vrstvy cesty od vnějšího tmavého trávníkového lemu po světlý střed
      drawAllPaths(trackW + 12, '#3d8c29');     // Tmavší trávníkový lem kolem cesty
      drawAllPaths(trackW + 8, OUTLINE);        // Tmavý vnější obrys (#111)
      drawAllPaths(trackW + 3, '#8c673e');      // Zkosený hliněný břeh cesty
      drawAllPaths(trackW - 2, '#cca46e');      // Hlavní pískovo-hlinité těleso cesty
      drawAllPaths(trackW - 14, '#deb985');     // Světlejší vyšlapaný střed
      drawAllPaths(trackW - 26, '#cfa670', [12, 10]); // Jemná textura uprostřed

      // Dlážděné kameny, spáry a oblázky podél všech cest
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        for (let j = 0; j < p.length - 1; j++) {
          const ax = p[j].x, ay = p[j].y;
          const bx = p[j + 1].x, by = p[j + 1].y;
          const segLen = Math.hypot(bx - ax, by - ay);
          const steps = Math.floor(segLen / 14);
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0.5 : s / steps;
            const spread = (rng() - 0.5) * (trackW * 0.68);
            const px = ax + (bx - ax) * t + spread;
            const py = ay + (by - ay) * t + (rng() - 0.5) * (trackW * 0.68);

            if (rng() < 0.35) {
              // Větší plochý dlažební kámen s odleskem
              const cw = 6 + rng() * 5;
              const ch = 4.5 + rng() * 3.5;
              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(rng() * PI);
              rr(ctx, -cw * 0.5, -ch * 0.5, cw, ch, 2);
              fillAndStroke(ctx, rng() > 0.5 ? '#b3956f' : '#9e8f80', 'rgba(17,17,17,0.6)', 1.3);
              ctx.fillStyle = 'rgba(255,255,255,0.28)';
              ctx.fillRect(-cw * 0.3, -ch * 0.3, cw * 0.5, ch * 0.35);
              ctx.restore();
            } else {
              // Drobný oblázek
              const pr = 2 + rng() * 3;
              ctx.beginPath();
              ctx.ellipse(px, py, pr * 1.2, pr * 0.85, rng() * PI, 0, TAU);
              fillAndStroke(
                ctx,
                rng() > 0.4 ? '#b08d5e' : '#968473',
                'rgba(17,17,17,0.5)',
                1.1
              );
            }
          }
        }
      }

      // 4. Bohaté detaily trávníku (drny, jetelíček, květiny s okvětními lístky a houbičky)
      const safePathDist = trackW * 0.5 + 14;
      for (let i = 0; i < 460; i++) {
        const tx = 12 + rng() * (W - 24);
        const ty = 12 + rng() * (H - 24);
        if (distToPaths(tx, ty, paths) < safePathDist) continue;
        if (inRectZone(tx, ty, waterZones, 15)) continue;
        if (inRectZone(tx, ty, obstacles, 10)) continue;

        const roll = rng();
        if (roll < 0.68) {
          // Trs trávy se stínem a světlou špičkou
          ctx.strokeStyle = rng() > 0.5 ? '#2f7d22' : '#3d942b';
          ctx.lineWidth = 1.9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 3.5, ty - 5.5);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + 0.5, ty - 6.5);
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + 4, ty - 4.5);
          ctx.stroke();
        } else if (roll < 0.94) {
          // Detailní kytička s okvětními lístky
          const cols = ['#fff176', '#ff80ab', '#ffffff', '#80d8ff'];
          const fCol = cols[Math.floor(rng() * cols.length)];
          const r = 2.6 + rng() * 1.1;

          // Stín kytičky
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.arc(tx + 1, ty + 1.5, r + 1.5, 0, TAU);
          ctx.fill();

          // Okvětní lístky s obrysem
          ctx.fillStyle = OUTLINE;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            ctx.beginPath();
            ctx.arc(tx + Math.cos(a) * (r * 0.65), ty + Math.sin(a) * (r * 0.65), r * 0.65 + 1.1, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = fCol;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            ctx.beginPath();
            ctx.arc(tx + Math.cos(a) * (r * 0.65), ty + Math.sin(a) * (r * 0.65), r * 0.65, 0, TAU);
            ctx.fill();
          }
          // Zlatý střed
          ctx.beginPath();
          ctx.arc(tx, ty, r * 0.48, 0, TAU);
          fillAndStroke(ctx, '#ffab00', OUTLINE, 1);
        } else {
          // Roztomilá červená muchomůrka s bílými tečkami
          ctx.fillStyle = '#fff8e1';
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 1.4;
          rr(ctx, tx - 2, ty - 1, 4, 5, 1.5);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(tx, ty - 1.5, 4.8, 3.2, 0, PI, TAU);
          ctx.closePath();
          fillAndStroke(ctx, '#e53935', OUTLINE, 1.5);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(tx - 1.8, ty - 2.8, 0.9, 0, TAU);
          ctx.arc(tx + 1.5, ty - 2.5, 0.8, 0, TAU);
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
        const edgeBias =
          fx < 65 || fx > W - 65 || fy < 55 || fy > H - 55 || rng() < 0.22;
        if (!edgeBias) continue;

        const isBush = rng() < 0.48;
        const clearRadius = isBush ? 26 : 36;
        if (distToPaths(fx, fy, paths) < trackW * 0.5 + clearRadius) continue;
        if (inRectZone(fx, fy, waterZones, clearRadius)) continue;
        if (inRectZone(fx, fy, obstacles, clearRadius * 0.8)) continue;

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
   * Levná animace vodní hladiny kreslená každý snímek (hloubka, pěna, lekníny a jiskřivé vlnky)
   */
  TDS.water = function (ctx, zone, ts) {
    if (!zone) return;
    ctx.save();

    const x = zone.x, y = zone.y, w = zone.width, h = zone.height;
    const t = (ts || 0) * 0.0025;

    // Ořez na oblast vodní plochy
    rr(ctx, x, y, w, h, 14);
    ctx.clip();

    // 1. Středová hluboká voda
    ctx.fillStyle = '#1b76b8';
    ctx.fillRect(x, y, w, h);

    // 2. Střední tyrkysově modrá vrstva
    rr(ctx, x + 4, y + 4, w - 8, h - 8, 11);
    ctx.fillStyle = '#2892d7';
    ctx.fill();

    // 3. Mělký prosvětlený okraj a jemná pobřežní pěna
    ctx.strokeStyle = '#56c2ff';
    ctx.lineWidth = 7;
    rr(ctx, x + 2, y + 2, w - 4, h - 4, 12);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.lineWidth = 2;
    rr(ctx, x + 3.5, y + 3.5, w - 7, h - 7, 11);
    ctx.stroke();

    // 4. Animované vlnky a sluneční jiskry
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    const cols = Math.max(2, Math.floor(w / 45));
    const rows = Math.max(2, Math.floor(h / 32));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const phase = r * 1.7 + c * 2.3;
        const wx = x + (c + 0.5) * (w / cols) + Math.sin(t + phase) * 6;
        const wy = y + (r + 0.5) * (h / rows) + Math.cos(t * 0.8 + phase) * 3;
        const len = 7 + Math.sin(t * 1.2 + phase) * 3.5;

        ctx.beginPath();
        ctx.moveTo(wx - len, wy);
        ctx.quadraticCurveTo(wx, wy - 3.2, wx + len, wy);
        ctx.stroke();
      }
    }

    // 5. Pohupující se leknín u okraje tůně
    if (w >= 70 && h >= 60) {
      const lx = x + w * 0.82 + Math.sin(t * 0.9) * 1.5;
      const ly = y + h * 0.24 + Math.cos(t * 0.9) * 1.5;
      const padR = 7.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, padR, 0.3, TAU - 0.3);
      ctx.closePath();
      fillAndStroke(ctx, '#43a047', OUTLINE, 1.5);
      // Světlo na leknínu
      ctx.fillStyle = '#76d275';
      ctx.beginPath();
      ctx.arc(lx - 2, ly - 2, padR * 0.45, 0, TAU);
      ctx.fill();
    }

    // 6. Vnitřní tmavý obrys vodní plochy
    rr(ctx, x, y, w, h, 14);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.restore();
  };

  /**
   * Zamrzlá hladina vody (předkreslená do offscreen cache s krystalickými prasklinami a závějí)
   */
  TDS.frozenWater = function (ctx, zone) {
    if (!zone) return;
    ctx.save();

    const key = `frozen_v2_${zone.name || 'z'}_${zone.width}_${zone.height}`;
    const pad = 4;
    const sprite = getCached(key, zone.width + pad * 2, zone.height + pad * 2, function (c, cw, ch) {
      const w = zone.width;
      const h = zone.height;
      c.translate(pad, pad);

      // Ledový podklad
      rr(c, 0, 0, w, h, 14);
      fillAndStroke(c, '#8ce0ff', OUTLINE, 2.2);

      c.save();
      rr(c, 0, 0, w, h, 14);
      c.clip();

      // Vnitřní tmavší ledová hloubka
      rr(c, 6, 6, w - 12, h - 12, 10);
      c.fillStyle = '#6fd2fa';
      c.fill();

      // Šikmé zrcadlové odlesky na ledu
      c.fillStyle = 'rgba(255, 255, 255, 0.58)';
      c.beginPath();
      c.moveTo(w * 0.08, 0);
      c.lineTo(w * 0.34, 0);
      c.lineTo(w * 0.14, h);
      c.lineTo(-w * 0.06, h);
      c.closePath();
      c.fill();

      c.beginPath();
      c.moveTo(w * 0.52, 0);
      c.lineTo(w * 0.66, 0);
      c.lineTo(w * 0.46, h);
      c.lineTo(w * 0.32, h);
      c.closePath();
      c.fill();

      // Krystalické mrazivé praskliny s tmavší hranou a bílým odleskem
      c.strokeStyle = '#2980b9';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(w * 0.22, h * 0.28);
      c.lineTo(w * 0.45, h * 0.50);
      c.lineTo(w * 0.74, h * 0.34);
      c.moveTo(w * 0.45, h * 0.50);
      c.lineTo(w * 0.56, h * 0.78);
      c.moveTo(w * 0.45, h * 0.50);
      c.lineTo(w * 0.28, h * 0.72);
      c.stroke();

      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(w * 0.22 - 1, h * 0.28 - 1);
      c.lineTo(w * 0.45 - 1, h * 0.50 - 1);
      c.lineTo(w * 0.74 - 1, h * 0.34 - 1);
      c.moveTo(w * 0.45 - 1, h * 0.50 - 1);
      c.lineTo(w * 0.56 - 1, h * 0.78 - 1);
      c.stroke();

      // Sněhové návěje v rozích zamrzlé plochy
      c.fillStyle = '#f2fbff';
      c.strokeStyle = '#5bb8e6';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(8, 8, 16, 0, TAU);
      c.arc(22, 5, 11, 0, TAU);
      c.arc(6, 22, 11, 0, TAU);
      c.fill();
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
      base: '#29b6f6', dark: '#0277bd', mid: '#4fc3f7', hi: '#b3e5fc',
      alpha: 0.88, shape: 'drop', inner: 'bubbles'
    },
    lucni_slizak: {
      base: '#43d132', dark: '#1f8716', mid: '#64e34f', hi: '#b8ff9e',
      inner: 'leaves'
    },
    lesni_slizak: {
      base: '#ff8f00', dark: '#c45100', mid: '#ffa726', hi: '#ffe57f',
      inner: 'core'
    },
    bleskovy_sliz: {
      base: '#f50057', dark: '#ab003c', mid: '#ff4081', hi: '#fff176',
      shape: ' elongated', inner: 'lightning'
    },
    cerny_sliz: {
      base: '#262930', dark: '#101216', mid: '#373c47', hi: '#788296',
      inner: 'tar'
    },
    snezny_sliz: {
      base: '#e1f5fe', dark: '#90caf9', mid: '#f5fdff', hi: '#ffffff',
      inner: 'frost'
    },
    runovy_sliz: {
      base: '#7c4dff', dark: '#4527a0', mid: '#9e75ff', hi: '#e1bee7',
      inner: 'rune'
    },
    prilbosliz: {
      base: '#8d96a3', dark: '#545d69', mid: '#a6b0bd', hi: '#dfe5ed',
      inherentHelmet: true
    },
    duhovy_sliz: {
      base: '#ff5252', dark: '#1976d2', mid: '#40c4ff', hi: '#ffff8d',
      inner: 'rainbow'
    },
    zlaty_sliz: {
      base: '#ffb300', dark: '#b26a00', mid: '#ffd54f', hi: '#fff9c4',
      inner: 'gold_crust'
    },
    slizovy_obr: {
      base: '#00bfa5', dark: '#00695c', mid: '#26e6c9', hi: '#a7ffeb',
      boss: true, crown: 'iron', inner: 'club'
    },
    rudy_arcisliz: {
      base: '#d50000', dark: '#7f0000', mid: '#ff1744', hi: '#ff8a80',
      boss: true, crown: 'gold', inner: 'fire_core'
    },
    stinosliz_prizrak: {
      base: '#221e38', dark: '#0d0b18', mid: '#38325c', hi: '#7c73b8',
      boss: true, crown: 'dark_helmet', alpha: 0.82, inner: 'shadow_armor'
    },
    prastary_kral_slizu: {
      base: '#6200ea', dark: '#311b92', mid: '#7c4dff', hi: '#ffe57f',
      boss: true, crown: 'grand_gold', inner: 'throne'
    }
  };

  /**
   * Vrátí předkreslené tělo slizáka z cache podle druhu a kvantizovaného poloměru
   */
  function getSlimeBodySprite(id, r) {
    const qR = Math.max(6, Math.round(r));
    const key = `slime_body_v2_${id}_${qR}`;
    const pad = Math.ceil(qR * 0.72) + 8;
    const size = (qR + pad) * 2;

    return getCached(key, size, size, function (ctx, w, h) {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const def = SLIME_DEFS[id] || SLIME_DEFS.lucni_slizak;
      const rng = createRNG(hashStr(id));

      ctx.save();
      ctx.translate(cx, cy);

      // 1. Speciální aura / opar pod tělem
      if (def.inner === 'frost') {
        // Mrazivá aura s ledovými krystalky po obvodu
        ctx.fillStyle = 'rgba(179, 229, 252, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, qR * 1.32, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e1f5fe';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * qR * 1.12, Math.sin(a) * qR * 1.12, qR * 0.16, 0, TAU);
          ctx.fill();
        }
      } else if (def.boss) {
        // Jemná hrozivá aura pod bossem
        ctx.fillStyle = id === 'rudy_arcisliz'
          ? 'rgba(255, 61, 0, 0.22)'
          : id === 'prastary_kral_slizu'
          ? 'rgba(255, 215, 64, 0.24)'
          : 'rgba(0, 229, 255, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, qR * 1.18, 0, TAU);
        ctx.fill();
      }

      // 2. Definice tvaru těla (směr 0 = doprava)
      const traceBodyShape = function (rad) {
        ctx.beginPath();
        if (def.shape === 'drop') {
          // Kapička slizu (špička vzadu vlevo, baculatá hlava vepředu vpravo)
          ctx.moveTo(-rad * 1.3, 0);
          ctx.quadraticCurveTo(-rad * 0.45, -rad * 1.06, rad * 0.2, -rad * 0.96);
          ctx.arc(rad * 0.15, 0, rad * 0.96, -PI * 0.5, PI * 0.5);
          ctx.quadraticCurveTo(-rad * 0.45, rad * 1.06, -rad * 1.3, 0);
        } else if (def.shape === ' elongated') {
          // Bleskový aerodynamický sliz
          ctx.ellipse(0, 0, rad * 1.28, rad * 0.82, 0, 0, TAU);
        } else {
          // Klasický baculatý slizák
          ctx.ellipse(0, 0, rad * 1.04, rad * 0.96, 0, 0, TAU);
        }
        ctx.closePath();
      };

      // Základní tmavší barva těla (tvoří zastíněný okraj vpravo dole)
      traceBodyShape(qR);
      ctx.fillStyle = def.dark;
      ctx.fill();

      // Ořez na vnitřek těla pro bohaté vrstvení rosolu a vnitřních předmětů
      ctx.save();
      traceBodyShape(qR);
      ctx.clip();

      // Hlavní sytá barva rosolu posunutá mírně vlevo nahoru
      ctx.fillStyle = def.base;
      ctx.beginPath();
      ctx.ellipse(-qR * 0.08, -qR * 0.08, qR * 0.98, qR * 0.92, 0, 0, TAU);
      ctx.fill();

      // Prosvětlené vnitřní jádro rosolu (subsurface scattering efekt)
      ctx.fillStyle = def.mid || def.base;
      ctx.beginPath();
      ctx.ellipse(-qR * 0.16, -qR * 0.16, qR * 0.72, qR * 0.65, 0, 0, TAU);
      ctx.fill();

      // === SPECIFICKÉ VNITŘNÍ TEXTURY PODLE DRUHU SLIZÁKA ===
      if (def.inner === 'bubbles') {
        // Průsvitné bublinky v kapičce slizu
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(-qR * 0.45, qR * 0.15, qR * 0.18, 0, TAU);
        ctx.arc(-qR * 0.15, -qR * 0.25, qR * 0.12, 0, TAU);
        ctx.arc(-qR * 0.65, -qR * 0.08, qR * 0.10, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'leaves') {
        // Detailní lístky s žilnatinou uvnitř lučního slizáka
        for (let i = 0; i < 3; i++) {
          const lx = (rng() - 0.55) * qR * 0.85;
          const ly = (rng() - 0.5) * qR * 0.85;
          const rot = rng() * PI;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, qR * 0.30, qR * 0.15, 0, 0, TAU);
          fillAndStroke(ctx, '#1b6e19', '#0f420e', 1.1);
          ctx.strokeStyle = '#76e35c';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-qR * 0.22, 0);
          ctx.lineTo(qR * 0.22, 0);
          ctx.stroke();
          ctx.restore();
        }
      } else if (def.inner === 'core') {
        // Žhnoucí jantarové jádro lesního slizáka s prstencem
        ctx.fillStyle = '#bf360c';
        ctx.beginPath();
        ctx.arc(-qR * 0.08, 0, qR * 0.52, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(-qR * 0.12, -qR * 0.05, qR * 0.36, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff59d';
        ctx.beginPath();
        ctx.arc(-qR * 0.18, -qR * 0.12, qR * 0.18, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'lightning') {
        // Ostrý elektrický blesk uvnitř bleskového slizu
        drawShape(ctx, c => {
          c.moveTo(qR * 0.65, -qR * 0.12);
          c.lineTo(-qR * 0.08, -qR * 0.48);
          c.lineTo(qR * 0.04, -qR * 0.06);
          c.lineTo(-qR * 0.82, qR * 0.28);
          c.lineTo(qR * 0.08, qR * 0.44);
          c.lineTo(-qR * 0.04, qR * 0.06);
          c.closePath();
        }, '#ffea00', '#ff6f00', 1.2, false);
        drawHighlight(ctx, c => {
          c.moveTo(qR * 0.4, -qR * 0.1);
          c.lineTo(-qR * 0.05, -qR * 0.32);
          c.lineTo(0, 0);
          c.closePath();
        }, '#ffffff');
      } else if (def.inner === 'tar') {
        // Husté dehtové bubliny s olejovým leskem
        const blobs = [[-0.25, 0.22, 0.28], [-0.42, -0.22, 0.20], [0.05, 0.35, 0.18]];
        for (const b of blobs) {
          ctx.beginPath();
          ctx.arc(qR * b[0], qR * b[1], qR * b[2], 0, TAU);
          fillAndStroke(ctx, '#181a20', '#4f5666', 1.5);
          ctx.fillStyle = '#90a4ae';
          ctx.beginPath();
          ctx.arc(qR * b[0] - qR * b[2] * 0.3, qR * b[1] - qR * b[2] * 0.3, qR * b[2] * 0.28, 0, TAU);
          ctx.fill();
        }
      } else if (def.inner === 'frost') {
        // Šesticípá sněhová vločka uvnitř sněžného slizu
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          const a = (i * PI) / 3;
          const dx = Math.cos(a) * qR * 0.48;
          const dy = Math.sin(a) * qR * 0.48;
          ctx.beginPath();
          ctx.moveTo(-dx, -dy);
          ctx.lineTo(dx, dy);
          ctx.stroke();
        }
      } else if (def.inner === 'rune') {
        // Zářící magický runový kruh a znak
        ctx.strokeStyle = 'rgba(234, 128, 252, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(-qR * 0.1, 0, qR * 0.56, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, qR * 0.15);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-qR * 0.36, -qR * 0.42);
        ctx.lineTo(qR * 0.22, 0);
        ctx.lineTo(-qR * 0.36, qR * 0.42);
        ctx.moveTo(-qR * 0.08, -qR * 0.52);
        ctx.lineTo(-qR * 0.08, qR * 0.52);
        ctx.stroke();
      } else if (def.inner === 'rainbow') {
        // Měňavé prolínání ohně, ledu a smaragdové magie
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(-qR * 0.32, -qR * 0.25, qR * 0.68, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(qR * 0.28, qR * 0.28, qR * 0.68, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#76ff03';
        ctx.beginPath();
        ctx.arc(-qR * 0.05, qR * 0.05, qR * 0.48, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ea80fc';
        ctx.beginPath();
        ctx.arc(-qR * 0.35, qR * 0.25, qR * 0.38, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'gold_crust') {
        // Fazety ryzího zlata a praskliny krusty
        ctx.fillStyle = '#ffe082';
        ctx.beginPath();
        ctx.moveTo(-qR * 0.7, -qR * 0.2);
        ctx.lineTo(-qR * 0.1, -qR * 0.75);
        ctx.lineTo(qR * 0.35, -qR * 0.45);
        ctx.lineTo(-qR * 0.08, 0);
        ctx.closePath();
        ctx.fill();

        // Tmavé praskliny se zlatým odleskem na hraně
        ctx.strokeStyle = '#5d3a00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-qR * 0.75, -qR * 0.22);
        ctx.lineTo(-qR * 0.08, 0);
        ctx.lineTo(qR * 0.42, -qR * 0.58);
        ctx.moveTo(-qR * 0.08, 0);
        ctx.lineTo(-qR * 0.32, qR * 0.72);
        ctx.moveTo(-qR * 0.08, 0);
        ctx.lineTo(qR * 0.62, qR * 0.32);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-qR * 0.7, -qR * 0.17);
        ctx.lineTo(-qR * 0.08, 0.05 * qR);
        ctx.lineTo(qR * 0.38, -qR * 0.52);
        ctx.stroke();
      } else if (def.inner === 'club') {
        // Masivní dubový kyj pobitý železnými hřeby a obručí uvnitř Slizového obra
        ctx.save();
        ctx.translate(-qR * 0.08, qR * 0.06);
        ctx.rotate(-0.48);
        // Tělo kyje (rozšiřující se)
        drawShape(ctx, c => {
          c.moveTo(-qR * 0.68, -qR * 0.11);
          c.lineTo(qR * 0.48, -qR * 0.24);
          c.quadraticCurveTo(qR * 0.65, 0, qR * 0.48, qR * 0.24);
          c.lineTo(-qR * 0.68, qR * 0.11);
          c.closePath();
        }, '#795548', OUTLINE, 2, true, 2, 2);
        // Dřevěná léta / nasvícení
        drawHighlight(ctx, c => {
          c.moveTo(-qR * 0.6, -qR * 0.06);
          c.lineTo(qR * 0.42, -qR * 0.15);
          c.lineTo(qR * 0.42, -qR * 0.03);
          c.lineTo(-qR * 0.6, 0);
          c.closePath();
        }, '#a1887f');
        // Železná obruč a ostny
        rr(ctx, qR * 0.12, -qR * 0.22, qR * 0.16, qR * 0.44, 2);
        fillAndStroke(ctx, '#90a4ae', OUTLINE, 1.5);
        const spikes = [[0.2, -0.32], [0.2, 0.32], [0.42, -0.26], [0.42, 0.26]];
        for (const sp of spikes) {
          drawShape(ctx, c => {
            c.arc(qR * sp[0], qR * sp[1], qR * 0.08, 0, TAU);
          }, '#cfd8dc', OUTLINE, 1.4, false);
        }
        ctx.restore();
      } else if (def.inner === 'fire_core') {
        // Vířící magmatické jádro Rudého arcislizu s lávovými žilami
        ctx.strokeStyle = '#ff9100';
        ctx.lineWidth = 2.8;
        for (let v = 0; v < 5; v++) {
          const va = (v / 5) * TAU;
          ctx.beginPath();
          ctx.moveTo(-qR * 0.1, 0);
          ctx.quadraticCurveTo(
            Math.cos(va + 0.4) * qR * 0.45,
            Math.sin(va + 0.4) * qR * 0.45,
            Math.cos(va) * qR * 0.82,
            Math.sin(va) * qR * 0.82
          );
          ctx.stroke();
        }
        ctx.fillStyle = '#ff6d00';
        ctx.beginPath();
        ctx.arc(-qR * 0.1, 0, qR * 0.56, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffca28';
        ctx.beginPath();
        ctx.arc(-qR * 0.12, -qR * 0.04, qR * 0.38, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-qR * 0.15, -qR * 0.08, qR * 0.18, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'shadow_armor') {
        // Přízračné runové pláty a duše uvnitř Stínoslizu
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-qR * 0.08, 0, qR * 0.68, PI * 0.55, PI * 1.45);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(-qR * 0.25, -qR * 0.15, qR * 0.22, 0, TAU);
        ctx.fill();
      } else if (def.inner === 'throne') {
        // Majestátny krystalový trůn se zlatým opěradlem uvnitř Prastarého krále slizů
        ctx.save();
        ctx.translate(-qR * 0.12, 0);
        // Zlatý rám trůnu
        rr(ctx, -qR * 0.48, -qR * 0.56, qR * 0.65, qR * 1.12, 6);
        fillAndStroke(ctx, '#ffb300', OUTLINE, 2.2);

        // Krystalické věže trůnu
        const shards = [
          { y: -qR * 0.42, len: qR * 0.68, w: qR * 0.24 },
          { y: 0, len: qR * 0.78, w: qR * 0.30 },
          { y: qR * 0.42, len: qR * 0.68, w: qR * 0.24 }
        ];
        for (const sh of shards) {
          drawShape(ctx, c => {
            c.moveTo(qR * 0.15, sh.y - sh.w);
            c.lineTo(-sh.len, sh.y);
            c.lineTo(qR * 0.15, sh.y + sh.w);
            c.closePath();
          }, '#00e5ff', OUTLINE, 2, false);
          drawHighlight(ctx, c => {
            c.moveTo(qR * 0.10, sh.y - sh.w * 0.7);
            c.lineTo(-sh.len * 0.85, sh.y);
            c.lineTo(qR * 0.10, sh.y);
            c.closePath();
          }, '#e0f7fa');
        }
        ctx.restore();
      }

      // 3. Dvoustupňový lesklý odlesk rosolu shora zleva + spodní rim-light
      ctx.fillStyle = def.hi;
      ctx.beginPath();
      ctx.ellipse(-qR * 0.32, -qR * 0.36, qR * 0.34, qR * 0.19, -0.48, 0, TAU);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.ellipse(-qR * 0.38, -qR * 0.40, qR * 0.17, qR * 0.09, -0.48, 0, TAU);
      ctx.arc(-qR * 0.12, -qR * 0.52, qR * 0.06, 0, TAU);
      ctx.fill();

      // Jemný odražený lesk na spodním okraji rosolu
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = Math.max(1.5, qR * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, qR * 0.86, PI * 0.15, PI * 0.42);
      ctx.stroke();

      ctx.restore(); // Konec clipu těla

      // 4. Tmavý obrys těla (#111, 2–2.5 px)
      traceBodyShape(qR);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = qR > 20 ? 2.5 : 2;
      ctx.stroke();

      // 5. Koruna nebo přilba bosse (bohatě zdobená kovem, nýty a drahokamy)
      if (def.crown) {
        ctx.save();
        ctx.translate(-qR * 0.18, 0);
        if (def.crown === 'iron' || def.crown === 'gold' || def.crown === 'grand_gold') {
          const isGold = def.crown !== 'iron';
          const cFill = isGold ? '#ffc107' : '#78909c';
          const cDark = isGold ? '#ff8f00' : '#455a64';
          const cHi = isGold ? '#fff59d' : '#cfd8dc';
          const cw = qR * 0.56;
          const ch = qR * 0.66;

          // Stín koruny na rosolu
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.ellipse(2, 3, cw * 0.7, ch * 0.85, 0, 0, TAU);
          ctx.fill();

          // Tělo koruny s hroty
          ctx.beginPath();
          ctx.moveTo(-cw * 0.62, -ch * 0.72);
          ctx.lineTo(cw * 0.58, -ch);
          ctx.lineTo(cw * 0.22, -ch * 0.34);
          ctx.lineTo(cw * 0.78, 0);
          ctx.lineTo(cw * 0.22, ch * 0.34);
          ctx.lineTo(cw * 0.58, ch);
          ctx.lineTo(-cw * 0.62, ch * 0.72);
          ctx.closePath();
          fillAndStroke(ctx, cFill, OUTLINE, 2.2);

          // Spodní obruč koruny
          rr(ctx, -cw * 0.68, -ch * 0.74, cw * 0.32, ch * 1.48, 3);
          fillAndStroke(ctx, cDark, OUTLINE, 1.8);

          // Kovový odlesk na horní části koruny
          drawHighlight(ctx, c => {
            c.moveTo(-cw * 0.3, -ch * 0.62);
            c.lineTo(cw * 0.42, -ch * 0.82);
            c.lineTo(cw * 0.15, -ch * 0.35);
            c.closePath();
          }, cHi);

          // Kuličky na špičkách koruny
          const tips = [[cw * 0.58, -ch], [cw * 0.78, 0], [cw * 0.58, ch]];
          for (const tp of tips) {
            ctx.beginPath();
            ctx.arc(tp[0], tp[1], qR * 0.07, 0, TAU);
            fillAndStroke(ctx, cHi, OUTLINE, 1.5);
          }

          // Broušené drahokamy na zlatých korunách
          if (isGold) {
            const gemCol = def.crown === 'grand_gold' ? '#d50000' : '#00e5ff';
            const gemHi = def.crown === 'grand_gold' ? '#ff8a80' : '#e0f7fa';
            ctx.beginPath();
            ctx.arc(-cw * 0.1, 0, cw * 0.24, 0, TAU);
            fillAndStroke(ctx, gemCol, OUTLINE, 1.6);
            ctx.fillStyle = gemHi;
            ctx.beginPath();
            ctx.arc(-cw * 0.16, -cw * 0.06, cw * 0.09, 0, TAU);
            ctx.fill();

            if (def.crown === 'grand_gold') {
              for (const gy of [-ch * 0.45, ch * 0.45]) {
                ctx.beginPath();
                ctx.arc(-cw * 0.25, gy, cw * 0.14, 0, TAU);
                fillAndStroke(ctx, '#00e676', OUTLINE, 1.4);
              }
            }
          }
        } else if (def.crown === 'dark_helmet') {
          // Temná rytířská přilba Stínoslizu s rohy a tyrkysovými runami
          // Rohy přilby
          drawShape(ctx, c => {
            c.moveTo(-qR * 0.1, -qR * 0.55);
            c.quadraticCurveTo(-qR * 0.65, -qR * 0.95, -qR * 0.95, -qR * 0.65);
            c.quadraticCurveTo(-qR * 0.55, -qR * 0.55, -qR * 0.25, -qR * 0.35);
            c.moveTo(-qR * 0.1, qR * 0.55);
            c.quadraticCurveTo(-qR * 0.65, qR * 0.95, -qR * 0.95, qR * 0.65);
            c.quadraticCurveTo(-qR * 0.55, qR * 0.55, -qR * 0.25, qR * 0.35);
          }, '#455a64', OUTLINE, 2, false);

          // Zvon přilby
          ctx.beginPath();
          ctx.arc(0, 0, qR * 0.74, PI * 0.42, PI * 1.58);
          ctx.lineTo(qR * 0.38, -qR * 0.36);
          ctx.lineTo(qR * 0.12, 0);
          ctx.lineTo(qR * 0.38, qR * 0.36);
          ctx.closePath();
          fillAndStroke(ctx, '#263238', OUTLINE, 2.2);

          // Hřeben a odlesk
          rr(ctx, -qR * 0.72, -qR * 0.12, qR * 0.82, qR * 0.24, 3);
          fillAndStroke(ctx, '#37474f', OUTLINE, 1.6);
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-qR * 0.55, 0);
          ctx.lineTo(-qR * 0.05, 0);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    });
  }

  /**
   * Předkreslená železná rytířská helma s nýty a odleskem (pro stav s.armored nebo prilbosliz)
   */
  function getHelmetSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_helmet_v2_${qR}`;
    const size = qR * 2 + 14;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);

      // Kovový zvon helmy kryjící zadní a boční část slizáka (vpředu vpravo vykukují oči)
      ctx.beginPath();
      ctx.arc(-qR * 0.08, 0, qR * 0.94, PI * 0.30, PI * 1.70);
      ctx.lineTo(qR * 0.36, -qR * 0.42);
      ctx.lineTo(qR * 0.16, 0);
      ctx.lineTo(qR * 0.36, qR * 0.42);
      ctx.closePath();
      fillAndStroke(ctx, '#78909c', OUTLINE, 2);

      // Světlejší nasvícená horní polovina helmy
      drawHighlight(ctx, c => {
        c.arc(-qR * 0.12, -qR * 0.12, qR * 0.78, PI * 0.85, PI * 1.62);
      }, '#b0bec5');

      // Kovový lem s nýty po obvodu
      ctx.fillStyle = '#eceff1';
      const rivets = [-0.65, -0.35, 0.35, 0.65];
      for (const rv of rivets) {
        ctx.beginPath();
        ctx.arc(-qR * 0.45, qR * rv, Math.max(1.2, qR * 0.09), 0, TAU);
        ctx.fill();
      }

      // Středový vyvýšený hřeben helmy
      rr(ctx, -qR * 0.88, -qR * 0.16, qR * 0.98, qR * 0.32, 3);
      fillAndStroke(ctx, '#cfd8dc', OUTLINE, 1.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-qR * 0.75, -qR * 0.10, qR * 0.70, qR * 0.08);
    });
  }

  /**
   * Předkreslený kamenný krunýř z jednotlivých kvádrů (pro stav s.fort)
   */
  function getFortSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_fort_v2_${qR}`;
    const size = qR * 2 + 16;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      const segs = 8;
      const rOut = qR * 1.08;
      const rIn = qR * 0.80;

      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * TAU + 0.04;
        const a2 = ((i + 1) / segs) * TAU - 0.04;
        const isLit = i >= 3 && i <= 6;
        ctx.beginPath();
        ctx.arc(0, 0, rOut, a1, a2);
        ctx.arc(0, 0, rIn, a2, a1, true);
        ctx.closePath();
        fillAndStroke(ctx, isLit ? '#9ea7b3' : '#707882', OUTLINE, 1.6);
      }
    });
  }

  /**
   * Předkreslený regenerační lísteček s žilnatinou na hlavě (pro stav s.regrow)
   */
  function getRegrowSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_regrow_v2_${qR}`;
    const size = qR * 2 + 14;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      const s = Math.max(5.5, qR * 0.50);

      // Levý lístek
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 1.25, -s * 1.15, -s * 0.2, -s * 1.45);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.85, 0, 0);
      fillAndStroke(ctx, '#4ce63e', OUTLINE, 1.6);
      // Odlesk na lístku
      ctx.fillStyle = '#b2ff59';
      ctx.beginPath();
      ctx.arc(-s * 0.35, -s * 0.85, s * 0.22, 0, TAU);
      ctx.fill();

      // Pravý lístek
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 1.15, -s * 0.95, s * 1.25, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.65, s * 0.55, 0, 0);
      fillAndStroke(ctx, '#32b825', OUTLINE, 1.6);
    });
  }

  /**
   * Předkreslený krystalický ledový blok (pro stav s.frozen)
   */
  function getFrozenCubeSprite(r) {
    const qR = Math.max(6, Math.round(r));
    const key = `overlay_ice_v2_${qR}`;
    const size = qR * 2 + 18;
    return getCached(key, size, size, function (ctx, w, h) {
      ctx.translate(w * 0.5, h * 0.5);
      const ir = qR * 1.14;

      // Tělo ledové kostky
      rr(ctx, -ir, -ir, ir * 2, ir * 2, qR * 0.35);
      fillAndStroke(ctx, 'rgba(128, 222, 234, 0.58)', '#006064', 2);

      // Vnitřní krystalické fazety ledu
      ctx.fillStyle = 'rgba(224, 247, 250, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-ir, -ir * 0.3);
      ctx.lineTo(-ir * 0.3, -ir);
      ctx.lineTo(ir * 0.4, -ir);
      ctx.lineTo(-ir, ir * 0.4);
      ctx.closePath();
      ctx.fill();

      // Jasný bílý odlesk v levém horním rohu
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.moveTo(-ir * 0.78, -ir * 0.86);
      ctx.lineTo(-ir * 0.15, -ir * 0.86);
      ctx.lineTo(-ir * 0.86, -ir * 0.15);
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
      const sealRad = rad * 1.44;
      const rot = time * 0.0008;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      // Dvojitý magický prstenec
      ctx.strokeStyle = 'rgba(255, 215, 64, 0.38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, sealRad, 0, TAU);
      ctx.arc(0, 0, sealRad * 0.88, 0, TAU);
      ctx.stroke();

      // Dílky pečeti
      const gap = 0.14;
      const segAng = TAU / total;
      for (let i = 0; i < total; i++) {
        const a1 = i * segAng + gap * 0.5;
        const a2 = (i + 1) * segAng - gap * 0.5;
        const active = i < left;

        // Obrys dílku
        ctx.beginPath();
        ctx.arc(0, 0, sealRad, a1, a2);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = active ? 8 : 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Výplň dílku
        ctx.beginPath();
        ctx.arc(0, 0, sealRad, a1, a2);
        ctx.strokeStyle = active ? '#ffd740' : '#455a64';
        ctx.lineWidth = active ? 5 : 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Zářící runový drahokam uprostřed aktivního dílku
        if (active) {
          const midA = (a1 + a2) * 0.5;
          const rx = Math.cos(midA) * sealRad;
          const ry = Math.sin(midA) * sealRad;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(rx, ry, 2.5, 0, TAU);
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
      ctx.lineWidth = 2;
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
      const sparkOff = ((time * 0.03) % 1) * rad * 0.85;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-rad - sparkOff, -3);
      ctx.lineTo(-rad - sparkOff - 5, 2.5);
      ctx.lineTo(-rad - sparkOff - 10, -2);
      ctx.stroke();

      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2;
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
      alpha = 0.84;
    }
    ctx.globalAlpha = alpha;

    // Vykreslení předkresleného těla z offscreen cache
    const bodySprite = getSlimeBodySprite(id, rad);
    ctx.drawImage(bodySprite, -bodySprite.width * 0.5, -bodySprite.height * 0.5);

    // Odhalený camo slizák má jasný tyrkysový magický obrys
    if (state.camo && state.revealed) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.8;
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

    // 6. Výrazné roztomilé / hrozivé oči koukající ve směru ang (směrem +X)
    const eyeX = rad * 0.38;
    const eyeSpread = rad * 0.32;
    const eyeR = Math.max(2.3, rad * 0.22);

    // Bělmo očí (u bossů nažloutlé)
    ctx.fillStyle = def.boss ? '#fff9c4' : '#ffffff';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(eyeX, -eyeSpread, eyeR, 0, TAU);
    ctx.arc(eyeX, eyeSpread, eyeR, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Duhovka a zornička (koukají dopředu)
    const pupilR = eyeR * 0.58;
    ctx.fillStyle = def.boss ? '#d50000' : '#111111';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.26, -eyeSpread, pupilR, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.26, eyeSpread, pupilR, 0, TAU);
    ctx.fill();

    // Dvoustupňová jiskřička v oku pro živý výraz
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.08, -eyeSpread - eyeR * 0.26, pupilR * 0.44, 0, TAU);
    ctx.arc(eyeX + eyeR * 0.08, eyeSpread - eyeR * 0.26, pupilR * 0.44, 0, TAU);
    ctx.fill();

    // Roztomilé tvářičky u menších slizáků
    if (!def.boss && rad >= 8) {
      ctx.fillStyle = 'rgba(255, 105, 135, 0.35)';
      ctx.beginPath();
      ctx.ellipse(eyeX - eyeR * 0.3, -eyeSpread - eyeR * 1.15, eyeR * 0.55, eyeR * 0.35, 0, 0, TAU);
      ctx.ellipse(eyeX - eyeR * 0.3, eyeSpread + eyeR * 1.15, eyeR * 0.55, eyeR * 0.35, 0, 0, TAU);
      ctx.fill();
    }

    // Zamračené obočí pro bosse
    if (def.boss) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(2.6, rad * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR * 0.85, -eyeSpread - eyeR * 1.15);
      ctx.lineTo(eyeX + eyeR * 0.95, -eyeSpread - eyeR * 0.32);
      ctx.moveTo(eyeX - eyeR * 0.85, eyeSpread + eyeR * 1.15);
      ctx.lineTo(eyeX + eyeR * 0.95, eyeSpread + eyeR * 0.32);
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
      // Dvoubarevné plamínky ohně
      const fTime = time * 0.015;
      for (let i = 0; i < 3; i++) {
        const fx = x + Math.sin(fTime + i * 2.1) * (rad * 0.55);
        const fy = y - rad * 0.2 - ((fTime * 4 + i * 7) % (rad * 0.9));
        const fr = Math.max(3.2, rad * 0.28);

        ctx.beginPath();
        ctx.moveTo(fx - fr, fy);
        ctx.quadraticCurveTo(fx, fy - fr * 2.3, fx + fr, fy);
        ctx.arc(fx, fy, fr, 0, PI);
        ctx.closePath();
        fillAndStroke(ctx, '#ff5722', OUTLINE, 1.4);

        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(fx, fy - fr * 0.2, fr * 0.5, 0, TAU);
        ctx.fill();
      }
    }

    if (state.acid) {
      // Zelené kyselinové bublinky s leskem
      const aTime = time * 0.01;
      for (let i = 0; i < 3; i++) {
        const bx = x + Math.cos(aTime + i * 2.2) * (rad * 0.65);
        const by = y - ((aTime * 6 + i * 5) % (rad * 1.1)) + rad * 0.3;
        const br = Math.max(2.4, rad * 0.19);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, TAU);
        fillAndStroke(ctx, '#76ff03', OUTLINE, 1.3);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.35, 0, TAU);
        ctx.fill();
      }
    }

    if (state.stunned) {
      // Rotující zlaté hvězdičky omráčení
      const sTime = time * 0.006;
      const orbitR = rad * 0.85;
      for (let i = 0; i < 3; i++) {
        const sa = sTime + (i * TAU) / 3;
        const sx = x + Math.cos(sa) * orbitR;
        const sy = y - rad * 0.45 + Math.sin(sa) * (orbitR * 0.45);
        const sr = Math.max(3.6, rad * 0.22);

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

    // 8. Lišta životů bosse s kovovým rámečkem a dílky (hpPct, žádný text)
    if (def.boss && typeof state.hpPct === 'number') {
      const hp = Math.max(0, Math.min(1, state.hpPct));
      const barW = Math.max(58, rad * 1.65);
      const barH = 9;
      const bx = x - barW * 0.5;
      const by = y - rad - 19;

      // Vnější kovový podklad lišty
      rr(ctx, bx - 1.5, by - 1.5, barW + 3, barH + 3, 5);
      fillAndStroke(ctx, '#546e7a', OUTLINE, 2);

      // Tmavý vnitřek lišty
      rr(ctx, bx, by, barW, barH, 3.5);
      ctx.fillStyle = '#1c2026';
      ctx.fill();

      // Výplň životů
      if (hp > 0) {
        const fillCol = hp > 0.5 ? '#43e048' : hp > 0.25 ? '#ffab00' : '#ff1744';
        const curW = Math.max(4, (barW - 2) * hp);
        rr(ctx, bx + 1, by + 1, curW, barH - 2, 2.5);
        ctx.fillStyle = fillCol;
        ctx.fill();

        // Lesklý proužek nahoře
        ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.fillRect(bx + 2.5, by + 1.8, Math.max(0, curW - 3), 2.2);

        // Dílky na liště pro přehlednost
        ctx.strokeStyle = 'rgba(17, 17, 17, 0.35)';
        ctx.lineWidth = 1.2;
        for (let d = 1; d < 4; d++) {
          const dx = bx + (barW * d) / 4;
          if (dx < bx + curW) {
            ctx.beginPath();
            ctx.moveTo(dx, by + 1);
            ctx.lineTo(dx, by + barH - 1);
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  };

  /**
   * Vrátí malý canvas s ikonou slizáka pro náhled vlny v UI (s cache)
   */
  TDS.slimeIcon = function (id, size) {
    const s = Math.max(16, size || 36);
    const key = `slime_icon_v2_${id}_${s}`;
    return getCached(key, s, s, function (ctx, w, h) {
      ctx.save();
      const def = SLIME_DEFS[id] || SLIME_DEFS.lucni_slizak;
      const r = def.boss ? s * 0.36 : s * 0.32;
      TDS.slime(ctx, id, w * 0.5, h * 0.5, r, -0.35, 0, {});
      ctx.restore();
    });
  };
})();

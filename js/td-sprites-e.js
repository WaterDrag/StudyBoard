/**
 * Obrana království - Kreslící knihovna (Část E: nové věže) — od Gemini
 * Kladeč pastí, Lesní druid, Stínový zvěd (+ pasti, tornáda, nálože a střely),
 * Gryfí jezdec, Obléhací moždíř, Trpasličí inženýr (+ gryf, terč, střílny, pěna, klec).
 * Načítá se až po části D (přidává do TDS.projectileDrawers).
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});

  // Lokální konstanty kresleného stylu
  const OUTLINE = '#111111';
  const SHADOW_COL = 'rgba(10, 15, 8, 0.28)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // Lokální offscreen cache pro statické části extra objektů (pasti na cestě)
  const localCache = new Map();

  // ============================================================================
  // LOKÁLNÍ POMOCNÉ FUNKCE (Seedovaná náhoda, Tvary, Stíny, Odlesky, Materiály)
  // ============================================================================

  let m_w = 123456789;
  let m_z = 987654321;
  const mask = 0xffffffff;

  function seed(i) {
    m_w = (123456789 + i) & mask;
    m_z = (987654321 - i) & mask;
  }

  function rand() {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    const result = ((m_z << 16) + (m_w & 65535)) >>> 0;
    return result / 4294967296;
  }

  function getCachedCanvas(key, w, h, drawFn) {
    let c = localCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      const cctx = c.getContext('2d');
      cctx.translate(c.width * 0.5, c.height * 0.5);
      drawFn(cctx);
      localCache.set(key, c);
    }
    return c;
  }

  /**
   * Vlastní zaoblený obdélník (náhrada za zakázaný ctx.roundRect)
   */
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const maxR = Math.min(w, h) * 0.5;
    const rad = Math.max(0, Math.min(r || 0, maxR));
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

  function fillAndStroke(ctx, fillStyle, strokeStyle = OUTLINE, lineWidth = 2) {
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

  function drawShape(ctx, pathFn, fillStyle, strokeStyle = OUTLINE, lineWidth = 2, hasShadow = true, shX = 2.5, shY = 3) {
    if (hasShadow) {
      ctx.save();
      ctx.translate(shX, shY);
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

  function drawHighlight(ctx, pathFn, fillStyle) {
    ctx.save();
    ctx.beginPath();
    pathFn(ctx);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  function drawDisk(ctx, x, y, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => c.arc(x, y, r, 0, TAU), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => c.arc(x - r * 0.22, y - r * 0.22, r * 0.58, 0, TAU), hiFill);
    }
  }

  function drawBox(ctx, x, y, w, h, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => roundRect(c, x, y, w, h, r), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => roundRect(c, x + 1.5, y + 1.5, Math.max(1, w - 3), Math.max(1, h * 0.38), r * 0.6), hiFill);
    }
  }

  function polyPath(ctx, x, y, r, sides, rotOffset = 0) {
    for (let i = 0; i < sides; i++) {
      const a = rotOffset + (i * TAU) / sides;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawGem(ctx, x, y, r, baseCol, hiCol, sides = 6, rot = 0) {
    drawShape(ctx, c => polyPath(c, x, y, r, sides, rot), baseCol, OUTLINE, 1.5, false);
    drawHighlight(ctx, c => c.arc(x - r * 0.24, y - r * 0.24, r * 0.42, 0, TAU), hiCol);
  }

  function drawStar(ctx, x, y, rOuter, rInner, points, fill, stroke = OUTLINE, lw = 1.5, rot = 0) {
    drawShape(ctx, c => {
      for (let i = 0; i < points * 2; i++) {
        const a = rot + (i * PI) / points;
        const rad = i % 2 === 0 ? rOuter : rInner;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    }, fill, stroke, lw, false);
  }

  /**
   * Nakreslí kamenný kruhový podstavec s dlaždicemi, odleskem shora zleva a prasklinou
   */
  function drawStoneCircleBase(ctx, r, baseCol, blockCol, hiCol, crackSeed = 1) {
    drawDisk(ctx, 0, 0, r, baseCol, OUTLINE, 2.2, true);
    drawHighlight(ctx, c => c.arc(-r * 0.14, -r * 0.14, r * 0.76, 0, TAU), hiCol);

    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * TAU + 0.05;
      const a2 = ((i + 1) / segs) * TAU - 0.05;
      const isLit = i >= 3 && i <= 6;
      drawShape(ctx, c => {
        c.arc(0, 0, r, a1, a2);
        c.arc(0, 0, r * 0.74, a2, a1, true);
        c.closePath();
      }, isLit ? hiCol : blockCol, OUTLINE, 1.5, false);
    }

    seed(crackSeed);
    ctx.save();
    ctx.strokeStyle = 'rgba(17, 17, 17, 0.4)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.12);
    ctx.lineTo(0, r * 0.08);
    ctx.lineTo(r * 0.25, -r * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Nakreslí dřevěnou podlahu z prken s hřebíky a kresbou dřeva
   */
  function drawWoodDeckBase(ctx, r, woodCol, woodHi, rimCol) {
    drawDisk(ctx, 0, 0, r, rimCol, OUTLINE, 2.2, true);
    drawDisk(ctx, 0, 0, r - 2.5, woodCol, OUTLINE, 1.6, false, woodHi);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2.5, 0, TAU);
    ctx.clip();

    ctx.strokeStyle = 'rgba(17, 17, 17, 0.38)';
    ctx.lineWidth = 1.3;
    for (let py = -r + 6; py <= r - 6; py += 6.5) {
      ctx.beginPath();
      ctx.moveTo(-r, py);
      ctx.lineTo(r, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Nakreslí jednotlivého železného čtyřhrotého ježka (caltrop)
   */
  function drawSingleCaltrop(ctx, x, y, r, metalCol = '#90a4ae', hiCol = '#eceff1', isHot = false) {
    ctx.save();
    ctx.translate(x, y);
    const col = isHot ? '#ff5722' : metalCol;
    const tipCol = isHot ? '#ffea00' : hiCol;

    // 3 spodní hroty
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3 + 0.35;
      drawShape(ctx, c => {
        c.moveTo(Math.cos(a + 1.4) * (r * 0.28), Math.sin(a + 1.4) * (r * 0.28));
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        c.lineTo(Math.cos(a - 1.4) * (r * 0.28), Math.sin(a - 1.4) * (r * 0.28));
        c.closePath();
      }, col, OUTLINE, 1.5, false);

      // Odlesk nebo žhnoucí špička
      drawHighlight(ctx, c => {
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * (r * 0.85), Math.sin(a) * (r * 0.85));
        c.lineTo(Math.cos(a - 0.5) * (r * 0.3), Math.sin(a - 0.5) * (r * 0.3));
        c.closePath();
      }, tipCol);
    }

    // 4. středový hrot mířící vzhůru ke kameře
    drawDisk(ctx, -0.5, -0.5, r * 0.34, tipCol, OUTLINE, 1.3, false);
    ctx.restore();
  }

  /**
   * Zjistí hlavní cestu vylepšení (cesta s úrovní >= 3, jinak nejvyšší)
   */
  function getMainPath(up) {
    const u0 = (up && up[0]) || 0;
    const u1 = (up && up[1]) || 0;
    const u2 = (up && up[2]) || 0;
    if (u0 >= 3) return { path: 1, level: u0, u0, u1, u2 };
    if (u1 >= 3) return { path: 2, level: u1, u0, u1, u2 };
    if (u2 >= 3) return { path: 3, level: u2, u0, u1, u2 };
    const maxL = Math.max(u0, u1, u2);
    const p = maxL === 0 ? 0 : (u0 === maxL ? 1 : (u1 === maxL ? 2 : 3));
    return { path: p, level: maxL, u0, u1, u2 };
  }

  // ============================================================================
  // 1. NOVÉ STŘELY (TDS.projectileDrawers)
  // Střela míří doprava (+X) kolem bodu 0,0 a vejde se do 48 × 48 px.
  // ============================================================================

  TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {

    /**
     * 'thorn' — Zelenohnědý dřevěný trn se světle zelenou špičkou a drobným lístečkem na konci (Lesní druid)
     */
    thorn: function (ctx) {
      ctx.save();
      // Měkký stín
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(1.5, 3, 10, 3.2, 0, 0, TAU);
      ctx.fill();

      // Drobné zelené křidélko / lísteček na konci trnu (-X)
      drawShape(ctx, c => {
        c.moveTo(-6, 0);
        c.quadraticCurveTo(-11, -5.5, -14, -2.5);
        c.quadraticCurveTo(-11, 1, -6, 0);
        c.closePath();
      }, '#43a047', OUTLINE, 1.4, false);

      drawShape(ctx, c => {
        c.moveTo(-6, 0);
        c.quadraticCurveTo(-10, 5, -13, 2.5);
        c.quadraticCurveTo(-10, -0.5, -6, 0);
        c.closePath();
      }, '#66bb6a', OUTLINE, 1.4, false);

      // Tělo dřevěného trnu
      drawShape(ctx, c => {
        c.moveTo(-9, -2.8);
        c.quadraticCurveTo(0, -3.5, 12, 0);
        c.quadraticCurveTo(0, 3.5, -9, 2.8);
        c.quadraticCurveTo(-7, 0, -9, -2.8);
        c.closePath();
      }, '#6d4c41', OUTLINE, 1.8, false);

      // Světle zelená jedovatá/živá špička trnu (+X)
      drawHighlight(ctx, c => {
        c.moveTo(1, -2.2);
        c.lineTo(11.5, 0);
        c.lineTo(1, 2.2);
        c.quadraticCurveTo(3, 0, 1, -2.2);
        c.closePath();
      }, '#76ff03');

      // Odlesk shora zleva
      drawHighlight(ctx, c => {
        c.moveTo(-7, -1.8);
        c.lineTo(8, -0.4);
        c.lineTo(-7, -0.3);
        c.closePath();
      }, '#ccff90');

      ctx.restore();
    },

    /**
     * 'shuriken' — Rotující čtyřcípá ocelová hvězdice s modrostříbrným odleskem a otvorem uprostřed (Stínový zvěd)
     */
    shuriken: function (ctx) {
      ctx.save();
      // Stín
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.arc(2, 2.5, 10, 0, TAU);
      ctx.fill();

      // 4 zahnuté ocelové čepele
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * PI) / 2);
        drawShape(ctx, c => {
          c.moveTo(2, -2);
          c.quadraticCurveTo(7, -4.5, 12, 0);
          c.quadraticCurveTo(7, 2.5, 2, 2);
          c.closePath();
        }, '#546e7a', OUTLINE, 1.7, false);

        // Modrostříbrné broušené ostří
        drawHighlight(ctx, c => {
          c.moveTo(3, -1.5);
          c.lineTo(11, 0);
          c.lineTo(3, 0.2);
          c.closePath();
        }, '#e1f5fe');
        ctx.restore();
      }

      // Středový prstenec a kruhový otvor uprostřed
      drawDisk(ctx, 0, 0, 4.2, '#37474f', OUTLINE, 1.5, false, '#90a4ae');
      drawDisk(ctx, 0, 0, 1.8, '#161d24', OUTLINE, 1.2, false);

      ctx.restore();
    },

    /**
     * 'dagger' — Naváděná stínová dýka s temně fialovo-zlatou čepelí (Stínový zvěd Lvl 5)
     */
    dagger: function (ctx) {
      ctx.save();
      // Stínová aura kolem dýky
      drawHighlight(ctx, c => c.ellipse(0, 0, 15, 5.5, 0, 0, TAU), 'rgba(170, 0, 255, 0.28)');

      // Rukojeť a zlatá hlavice (-X)
      drawBox(ctx, -13, -1.8, 6, 3.6, 1, '#311b92', OUTLINE, 1.5, false);
      drawDisk(ctx, -13.5, 0, 2.4, '#ffd740', OUTLINE, 1.3, false, '#ffff8d');

      // Záštita
      drawShape(ctx, c => {
        c.moveTo(-7, -5.5);
        c.lineTo(-4.5, 0);
        c.lineTo(-7, 5.5);
        c.lineTo(-8.5, 0);
        c.closePath();
      }, '#ffb300', OUTLINE, 1.5, false);

      // Čepel stínové dýky (+X)
      drawShape(ctx, c => {
        c.moveTo(-5.5, -3.5);
        c.lineTo(13, 0);
        c.lineTo(-5.5, 3.5);
        c.closePath();
      }, '#4a148c', OUTLINE, 1.8, true, 1.5, 2);

      // Zářící fialovo-bílý břit
      drawHighlight(ctx, c => {
        c.moveTo(-4.5, -2.2);
        c.lineTo(11.5, 0);
        c.lineTo(-4.5, 0);
        c.closePath();
      }, '#ea80fc');

      ctx.restore();
    },

    /**
     * 'flashBomb' — Kulatá černá oslepující bomba s jiskřícím doutnákem (Stínový zvěd Cesta 3)
     */
    flashBomb: function (ctx) {
      ctx.save();
      // Tělo černé pumy s fialovo-stříbrným pruhem
      drawDisk(ctx, -1, 1, 8.5, '#263238', OUTLINE, 2, true, '#546e7a');

      // Kovový pásek s nýty
      drawBox(ctx, -9, -0.5, 16, 3, 1, '#78909c', OUTLINE, 1.3, false, '#cfd8dc');

      // Hrdlo a doutnák nahoře
      drawBox(ctx, 3, -7, 4, 3.5, 1, '#455a64', OUTLINE, 1.4, false);
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(5, -7);
      ctx.quadraticCurveTo(9, -11, 12, -9);
      ctx.stroke();

      // Jiskra na konci doutnáku
      drawStar(ctx, 12, -9, 5, 2, 5, '#ffff00', '#ff3d00', 1.2);
      ctx.restore();
    }
  });

  // ============================================================================
  // 2. EXTRA OBJEKTY NA CESTĚ A EFEKTY VĚŽÍ (<id>Extra)
  // ============================================================================

  /**
   * TDS.kladec_pastiExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'spike'   : Hromádka pěti šedých železných čtyřhrotých ježků (caltrops) s kovovým odleskem (případně žhnoucích při s.hot).
   * - 'jaw'     : Těžké ocelové medvědí čelisti s pružinou (Cesta 1 Lvl 3+).
   * - 'mine'    : Trpasličí výbušná či zlatá runová mina s blikajícím rubínem (Cesta 1 Lvl 4–5).
   * - 'crystal' : Nezničitelné azurové diamantové hroty / runová barikáda (Cesta 3 Lvl 3–5).
   */
  TDS.kladec_pastiExtra = function (ctx, kind, x, y, ang, ts, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    const state = s || {};
    const time = ts || 0;

    if (kind === 'jaw') {
      // Statická ocelová čelist z offscreen cache
      const jawCvs = getCachedCanvas('extra_kp_jaw', 36, 36, c => {
        // Stín pod pastí
        c.fillStyle = SHADOW_COL;
        c.beginPath();
        c.ellipse(1.5, 2, 13, 11, 0, 0, TAU);
        c.fill();

        // Řetízek a napružená péra po stranách
        drawBox(c, -13, -2.5, 26, 5, 1.5, '#455a64', OUTLINE, 1.5, false, '#90a4ae');

        // Horní a dolní půlkruhový oblouk čelistí se zuby
        for (const side of [-1, 1]) {
          drawShape(c, ctx2 => {
            ctx2.arc(0, side * 1.5, 10.5, side > 0 ? 0.15 : PI + 0.15, side > 0 ? PI - 0.15 : TAU - 0.15);
            ctx2.lineTo(0, side * 3);
            ctx2.closePath();
          }, '#78909c', OUTLINE, 1.8, false);

          // Ostré ocelové zuby mířící ke středu
          for (let zx = -6; zx <= 6; zx += 4) {
            drawShape(c, ctx2 => {
              ctx2.moveTo(zx - 1.8, side * 7.5);
              ctx2.lineTo(zx, side * 2.2);
              ctx2.lineTo(zx + 1.8, side * 7.5);
              ctx2.closePath();
            }, '#eceff1', OUTLINE, 1.2, false);
          }
        }

        // Středová nášlapná spoušť (měděný talířek)
        drawDisk(c, 0, 0, 4.2, '#d84315', OUTLINE, 1.5, false, '#ff8a65');
      });
      ctx.drawImage(jawCvs, -18, -18);

    } else if (kind === 'mine') {
      // Statický základ miny z cache + živě pulzující rubínový střed
      const isTier5 = Boolean(state.tier5);
      const mineKey = isTier5 ? 'extra_kp_mine5' : 'extra_kp_mine4';
      const mineCvs = getCachedCanvas(mineKey, 36, 36, c => {
        const bodyCol = isTier5 ? '#ffb300' : '#37474f';
        const bodyHi = isTier5 ? '#fff59d' : '#78909c';
        const lugCol = isTier5 ? '#263238' : '#b71c1c';

        // 6 přítlačných patek po obvodu
        for (let i = 0; i < 6; i++) {
          c.save();
          c.rotate((i * TAU) / 6);
          drawBox(c, 8, -2.2, 5.5, 4.4, 1, lugCol, OUTLINE, 1.4, false);
          c.restore();
        }

        drawDisk(c, 0, 0, 11, bodyCol, OUTLINE, 2, true, bodyHi);
        drawDisk(c, 0, 0, 7, '#212121', OUTLINE, 1.5, false);
      });
      ctx.drawImage(mineCvs, -18, -18);

      // Blikající rubínová rozbuška uprostřed
      const blink = 0.5 + 0.5 * Math.sin(time * 0.012);
      drawDisk(ctx, 0, 0, 4.2, blink > 0.5 ? '#ff1744' : '#b71c1c', OUTLINE, 1.3, false, '#ff8a80');
      if (blink > 0.65) {
        drawHighlight(ctx, c => c.arc(0, 0, 7.5, 0, TAU), 'rgba(255, 23, 68, 0.32)');
      }

    } else if (kind === 'crystal') {
      // Azurově-diamantová krystalová barikáda (Cesta 3 Lvl 3–5)
      const crysCvs = getCachedCanvas('extra_kp_crystal', 38, 38, c => {
        c.fillStyle = SHADOW_COL;
        c.beginPath();
        c.ellipse(2, 2.5, 13, 11, 0, 0, TAU);
        c.fill();

        // Zlatoorámovaný runový podstavec pod krystaly
        drawDisk(c, 0, 0, 11, '#37474f', OUTLINE, 1.8, false, '#ffd54f');

        // 5 trčících broušených diamantových hrotů
        const spikes = [
          { ang: -0.4, len: 13, w: 4.2, col: '#00e5ff' },
          { ang: 0.8, len: 12.5, w: 4, col: '#40c4ff' },
          { ang: 2.1, len: 13, w: 4.2, col: '#00b0ff' },
          { ang: 3.3, len: 12, w: 3.8, col: '#00e5ff' },
          { ang: 4.7, len: 12.5, w: 4, col: '#80d8ff' }
        ];
        for (const sp of spikes) {
          c.save();
          c.rotate(sp.ang);
          drawShape(c, ctx2 => {
            ctx2.moveTo(0, -sp.w);
            ctx2.lineTo(sp.len, 0);
            ctx2.lineTo(0, sp.w);
            ctx2.closePath();
          }, sp.col, OUTLINE, 1.5, false);
          drawHighlight(c, ctx2 => {
            ctx2.moveTo(1, -sp.w * 0.65);
            ctx2.lineTo(sp.len * 0.85, 0);
            ctx2.lineTo(1, 0);
            ctx2.closePath();
          }, '#e0f7fa');
          c.restore();
        }
        drawGem(c, 0, 0, 5.2, '#ffffff', '#e0f7fa', 6);
      });
      ctx.drawImage(crysCvs, -19, -19);

    } else {
      // Výchozí 'spike': Svazek pěti šedých železných čtyřhrotých ježků (caltrops)
      const isHot = Boolean(state.hot);
      const spkKey = isHot ? 'extra_kp_spike_hot' : 'extra_kp_spike';
      const spkCvs = getCachedCanvas(spkKey, 36, 36, c => {
        c.fillStyle = SHADOW_COL;
        c.beginPath();
        c.ellipse(1.5, 2, 12, 10, 0, 0, TAU);
        c.fill();

        const offsets = [[-5.5, -4.5], [5.5, -4], [-5, 5], [5.5, 4.5], [0, 0]];
        for (const [ox, oy] of offsets) {
          drawSingleCaltrop(c, ox, oy, 5.8, '#78909c', '#eceff1', isHot);
        }
      });
      ctx.drawImage(spkCvs, -18, -18);
    }

    ctx.restore();
  };

  /**
   * TDS.lesni_druidExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'tornado' : Větrný vír jedoucí po cestě s poletujícím listím (Cesta 1 Lvl 3–5).
   * - 'ball'    : Kulový blesk s elektrickými výboji, s.r = poloměr účinku (Cesta 1 Lvl 4–5).
   * - 'vine'    : Živý trnitý šlahoun s červenými květy omotaný kolem slizáka či na cestě (Cesta 2 Lvl 3–5).
   */
  TDS.lesni_druidExtra = function (ctx, kind, x, y, ang, ts, s) {
    ctx.save();
    ctx.translate(x, y);
    const state = s || {};
    const time = ts || 0;

    if (kind === 'tornado') {
      const spin = time * 0.008;
      // Stín pod tornádem
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 5, 18, 12, 0, 0, TAU);
      ctx.fill();

      // 3 vrstvy rotujícího větrného trychtýře
      const rings = [
        { r: 19, col: 'rgba(179, 229, 252, 0.55)', stroke: '#81d4fa', off: -2 },
        { r: 13.5, col: 'rgba(225, 245, 254, 0.72)', stroke: '#29b6f6', off: -4 },
        { r: 7.5, col: '#ffffff', stroke: '#0288d1', off: -6 }
      ];
      for (let i = 0; i < rings.length; i++) {
        const rg = rings[i];
        const wobbleX = Math.cos(spin * (i + 1)) * 2.2;
        const wobbleY = Math.sin(spin * (i + 1)) * 2.2 + rg.off * 0.4;
        drawDisk(ctx, wobbleX, wobbleY, rg.r, rg.col, OUTLINE, 1.6, false);

        // Vnitřní větrné spirály
        ctx.save();
        ctx.translate(wobbleX, wobbleY);
        ctx.rotate(spin * (1.2 + i * 0.4));
        ctx.strokeStyle = rg.stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, rg.r * 0.75, 0, PI * 1.1);
        ctx.stroke();
        ctx.restore();
      }

      // Poletující zelené lístky ve větru
      for (let i = 0; i < 4; i++) {
        const la = spin * 1.3 + (i * TAU) / 4;
        const lx = Math.cos(la) * 15;
        const ly = Math.sin(la) * 15;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(la + PI * 0.5);
        drawShape(ctx, c => c.ellipse(0, 0, 3.8, 2, 0, 0, TAU), '#66bb6a', OUTLINE, 1.2, false);
        ctx.restore();
      }

    } else if (kind === 'ball') {
      const effectR = state.r || 32;
      const pulse = 1 + 0.08 * Math.sin(time * 0.015);

      // Elektrické pole dosahu (s.r)
      drawHighlight(ctx, c => c.arc(0, 0, effectR * 0.55 * pulse, 0, TAU), 'rgba(0, 229, 255, 0.22)');
      ctx.strokeStyle = 'rgba(128, 216, 255, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, effectR * 0.55, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // Klikaté blesky šlehající ze středu k okraji
      ctx.strokeStyle = '#80d8ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ba = time * 0.005 + (i * TAU) / 5;
        const rMid = effectR * 0.28;
        const rEnd = effectR * 0.52;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ba + 0.25) * rMid, Math.sin(ba + 0.25) * rMid);
        ctx.lineTo(Math.cos(ba - 0.15) * rEnd, Math.sin(ba - 0.15) * rEnd);
        ctx.stroke();
      }

      // Jádro kulového blesku
      drawDisk(ctx, 0, 0, 10 * pulse, '#00e5ff', OUTLINE, 1.8, false, '#ffffff');
      drawStar(ctx, 0, 0, 12, 4.5, 4, '#ffffff', '#00b0ff', 1.2, time * 0.006);

    } else if (kind === 'vine') {
      // Živý trnitý šlahoun s červenými květy
      const sway = Math.sin(time * 0.006) * 0.12;
      ctx.rotate((ang || 0) + sway);

      // 2 propletené zelené kořeny
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0.2, PI * 1.75);
      ctx.stroke();

      ctx.strokeStyle = '#2e7d32';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      ctx.strokeStyle = '#66bb6a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(-1, -1, 12, 0.4, PI * 1.4);
      ctx.stroke();

      // Ostré trny a 2 červené pralesní květy
      for (let i = 0; i < 4; i++) {
        const va = (i * TAU) / 4 + 0.4;
        const vx = Math.cos(va) * 12;
        const vy = Math.sin(va) * 12;
        if (i % 2 === 0) {
          drawDisk(ctx, vx, vy, 3.8, '#e53935', OUTLINE, 1.3, false, '#ff8a80');
          drawDisk(ctx, vx, vy, 1.5, '#ffea00', null, 0, false);
        } else {
          drawShape(ctx, c => {
            c.moveTo(vx, vy);
            c.lineTo(vx * 1.35, vy * 1.35);
            c.lineTo(vx * 0.85, vy * 1.15);
            c.closePath();
          }, '#dce775', OUTLINE, 1.2, false);
        }
      }
    }

    ctx.restore();
  };

  /**
   * TDS.stinovy_zvedExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'caltrop' : Železný ježek hozený zvědem na nejbližší cestu (Cesta 3 Lvl 2+).
   * - 'sticky'  : Přísavná runová nálož přilepená na slizovém králi, s.left = sekundy do výbuchu (Cesta 3 Lvl 4–5).
   */
  TDS.stinovy_zvedExtra = function (ctx, kind, x, y, ang, ts, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    const state = s || {};
    const time = ts || 0;

    if (kind === 'sticky') {
      const left = typeof state.left === 'number' ? state.left : 1.5;
      const freq = left < 0.7 ? 0.035 : 0.014;
      const blink = Math.sin(time * freq) > 0;

      // Fialovo-žlutá lepkavá pryskyřice pod náloží
      drawShape(ctx, c => {
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8;
          const r = i % 2 === 0 ? 11.5 : 8;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
      }, '#ab47bc', OUTLINE, 1.5, false);

      // Tělo runové patrony
      drawBox(ctx, -6.5, -5, 13, 10, 2.5, '#263238', OUTLINE, 1.8, true, '#546e7a');
      drawBox(ctx, -2.5, -5.5, 5, 11, 1, '#ffb300', OUTLINE, 1.3, false);

      // Blikající výstražná runa uprostřed
      drawDisk(ctx, 0, 0, 3.5, blink ? '#ff1744' : '#ffea00', OUTLINE, 1.2, false, '#ffffff');
      if (blink) {
        drawHighlight(ctx, c => c.arc(0, 0, 9, 0, TAU), 'rgba(255, 23, 68, 0.35)');
      }

    } else {
      // 'caltrop' — Jednotlivý kovový ježek zvěda na cestě
      const calCvs = getCachedCanvas('extra_sz_caltrop', 24, 24, c => {
        c.fillStyle = SHADOW_COL;
        c.beginPath();
        c.ellipse(1.5, 2, 7.5, 6, 0, 0, TAU);
        c.fill();
        drawSingleCaltrop(c, 0, 0, 7.2, '#607d8b', '#cfd8dc', false);
      });
      ctx.drawImage(calCvs, -12, -12);
    }

    ctx.restore();
  };

  // ============================================================================
  // 3. KRESLÍŘI VĚŽÍ (TDS.drawers.<id> = { base(ctx, up), turret(ctx, up, s) })
  // ============================================================================

  TDS.drawers = TDS.drawers || {};

  // ============================================================================
  // VĚŽ 1: KLADEČ PASTÍ (kladec_pasti, poloměr 20 px)
  // ============================================================================
  TDS.drawers.kladec_pasti = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Podklad dílny / pevnosti podle hlavní cesty
      if (mp.path === 1 && mp.level >= 5) {
        // C1 Lvl 5: Pevnost věčných min — Černo-zlatá trpasličí osmiboká pevnost s dýmajícím komínem
        drawShape(ctx, c => polyPath(c, 0, 0, 21.5, 8, PI / 8), '#212121', OUTLINE, 2.4, true);
        drawShape(ctx, c => polyPath(c, 0, 0, 17.5, 8, PI / 8), '#37474f', OUTLINE, 1.6, false);
        // Zlaté rohové pláty
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 2 + PI / 4);
          drawBox(ctx, 13, -3.5, 6, 7, 1.2, '#ffb300', OUTLINE, 1.5, false, '#fff59d');
          ctx.restore();
        }
        // Dýmající trpasličí komín vlevo nahoře
        drawDisk(ctx, -13, -12, 5.5, '#263238', OUTLINE, 1.8, true, '#546e7a');
        drawDisk(ctx, -13, -12, 3, '#ff3d00', null, 0, false, '#ffea00');
      } else if (mp.path === 1 && mp.level === 4) {
        // C1 Lvl 4: Trpasličí minové pole — Kamenná zbrojnice s červenými výbušnými soudky
        drawStoneCircleBase(ctx, 19.5, '#607d8b', '#455a64', '#b0bec5', 14);
        for (const [bx, by] of [[-14, -12], [-15, 11]]) {
          drawDisk(ctx, bx, by, 5, '#d32f2f', OUTLINE, 1.6, true, '#ff8a80');
          drawDisk(ctx, bx, by, 2, '#ffb300', OUTLINE, 1, false);
        }
      } else if (mp.path === 2 && mp.level >= 3) {
        // C2 Lvl 3–5: Tmavé železo / Ocelová baterie / Monumentální parní baterie
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 19.8,
          isLvl5 ? '#ffb300' : '#263238',
          isLvl5 ? '#ff8f00' : '#37474f',
          isLvl5 ? '#fff59d' : '#78909c',
          23
        );
        if (mp.level === 3) {
          // Těžké kotvy a rudý prapor lovců obrů
          drawShape(ctx, c => {
            c.moveTo(-16, -6); c.lineTo(-24, -11); c.lineTo(-21, 0); c.lineTo(-24, 11); c.lineTo(-16, 6); c.closePath();
          }, '#c62828', OUTLINE, 1.6, true);
        }
      } else if (mp.path === 3 && mp.level >= 3) {
        // C3 Lvl 3–5: Kamenná pevnost s azurovou střechou / 4 levitující runové pilíře / Platinovo-zlatá citadela
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 19.8,
          isLvl5 ? '#eceff1' : '#546e7a',
          isLvl5 ? '#ffd54f' : '#0288d1',
          isLvl5 ? '#ffffff' : '#81d4fa',
          33
        );
        if (mp.level >= 4) {
          // 4 levitující kamenné pilíře se zářícími modrými runami v rozích
          for (let i = 0; i < 4; i++) {
            const pa = (i * PI) / 2 + PI / 4;
            const px = Math.cos(pa) * 18.5;
            const py = Math.sin(pa) * 18.5;
            drawBox(ctx, px - 3.5, py - 3.5, 7, 7, 1.5, isLvl5 ? '#ffd740' : '#37474f', OUTLINE, 1.6, true);
            drawDisk(ctx, px, py, 2.2, '#00e5ff', null, 0, false, '#ffffff');
          }
        }
      } else {
        // Základní dřevěno-kamenná obranná dílna (nebo Lvl 1–2)
        drawStoneCircleBase(ctx, 19, '#78909c', '#546e7a', '#b0bec5', 11);
        const roofCol = u2 >= 1 ? '#5c6bc0' : '#795548';
        const roofHi = u2 >= 1 ? '#9fa8da' : '#a1887f';
        drawWoodDeckBase(ctx, 14.5, roofCol, roofHi, '#4e342e');
      }

      // 2. Doplňky úrovní 1–2 (sčítají se i jako vedlejší cesta)
      // Cesta 1 Lvl 1+: Dřevěná bedna plná čerstvě vykovaných železných hrotů u paty dílny
      if (u0 >= 1 && !(mp.path === 1 && mp.level >= 5)) {
        drawBox(ctx, -18, 9, 10, 8, 1.5, '#6d4c41', OUTLINE, 1.5, true, '#8d6e63');
        const spikeCol = u0 >= 2 ? '#ff6d00' : '#cfd8dc';
        drawDisk(ctx, -14.5, 13, 2, spikeCol, OUTLINE, 1, false);
        drawDisk(ctx, -11.5, 13, 2, spikeCol, OUTLINE, 1, false);
      }

      // Cesta 1 Lvl 2+: Kovářská výheň s měchem uvnitř dílny
      if (u0 >= 2 && mp.level < 4) {
        drawDisk(ctx, -12, -10, 5.2, '#37474f', OUTLINE, 1.6, true);
        drawDisk(ctx, -12, -10, 3.2, '#ff3d00', null, 0, false, '#ffea00');
      }

      // Cesta 1 Lvl 3: Medvědí čelisti visící na řetězech kolem dílny
      if (mp.path === 1 && mp.level === 3) {
        for (const cy of [-15, 15]) {
          drawDisk(ctx, 2, cy, 4.8, '#90a4ae', OUTLINE, 1.5, true, '#eceff1');
          drawDisk(ctx, 2, cy, 2, '#d84315', null, 0, false);
        }
      }

      // Cesta 3 Lvl 1+: Sud s modravým kalicím olejem vedle dílny
      if (u2 >= 1 && mp.level < 4) {
        drawDisk(ctx, 11, -13, 4.8, '#5d4037', OUTLINE, 1.6, true);
        drawDisk(ctx, 11, -13, 3.2, '#29b6f6', null, 0, false, '#b3e5fc');
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // CESTA 1 (Lvl 3–5): Těžký vrhač čelistí -> Minomet -> Jeřáb s kolosální rubínovou minou
      if (mp.path === 1 && mp.level >= 3) {
        if (mp.level >= 5) {
          // Lvl 5: Pevnost věčných min — Zlatý otočný jeřáb nesoucí žhnoucí magickou minu s rubínem
          drawDisk(ctx, -3, 0, 9.5, '#263238', OUTLINE, 2, true, '#546e7a');
          drawBox(ctx, -6, -3.5, 20, 7, 2, '#ffb300', OUTLINE, 1.8, true, '#fff59d');
          // Kolosální zlatá runová mina v čelistech jeřábu vpředu (+X)
          drawDisk(ctx, 12, 0, 7.5, '#ffd740', OUTLINE, 1.8, true, '#ffff8d');
          drawGem(ctx, 12, 0, 4.2, '#ff1744', '#ff8a80', 6);
        } else if (mp.level === 4) {
          // Lvl 4: Trpasličí minové pole — Těžký minový katapult s červenou minou a mosaznou rozbuškou
          drawDisk(ctx, -2, 0, 8.5, '#455a64', OUTLINE, 1.8, true, '#90a4ae');
          drawBox(ctx, -4, -4, 18, 8, 2, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
          drawDisk(ctx, 11, 0, 6, '#b71c1c', OUTLINE, 1.6, false, '#ff8a80');
          drawDisk(ctx, 11, 0, 2.8, '#ffd740', OUTLINE, 1.2, false);
        } else {
          // Lvl 3: Medvědí čelisti — Katapult s napruženou zubatou ocelovou čelistí
          drawBox(ctx, -6, -3.5, 18, 7, 1.8, '#4e342e', OUTLINE, 1.8, true, '#795548');
          drawDisk(ctx, 10, 0, 6.5, '#78909c', OUTLINE, 1.8, true, '#eceff1');
          drawDisk(ctx, 10, 0, 2.5, '#d84315', OUTLINE, 1.1, false);
        }
        ctx.restore();
        return;
      }

      // CESTA 2 (Lvl 3–5): Trhač králů -> Kobercový výsev -> Bouře oceli
      if (mp.path === 2 && mp.level >= 3) {
        if (mp.level >= 5) {
          // Lvl 5: Bouře oceli — Monumentální parní baterie se 4 zlatými hlavněmi sršícími jiskry
          drawDisk(ctx, 0, 0, 12.5, '#263238', OUTLINE, 2.2, true, '#546e7a');
          for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((i * PI) / 2);
            drawBox(ctx, 4, -3.2, 13, 6.4, 1.5, '#ffb300', OUTLINE, 1.7, true, '#fff59d');
            drawBox(ctx, 15, -4, 3, 8, 1, '#ff6d00', OUTLINE, 1.4, false);
            ctx.restore();
          }
          drawDisk(ctx, 0, 0, 6.5, '#ffd740', OUTLINE, 1.8, false, '#ffffff');
          drawStar(ctx, 0, 0, 5, 2, 4, '#ff3d00', null, 0);
        } else if (mp.level === 4) {
          // Lvl 4: Kobercový výsev — 4 ocelové výmetnice a mosazný hodinový stroj uprostřed
          drawDisk(ctx, 0, 0, 11, '#37474f', OUTLINE, 2, true, '#78909c');
          for (const [bx, by] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
            drawDisk(ctx, bx, by, 4.2, '#212121', OUTLINE, 1.5, false, '#607d8b');
          }
          // Ozubené kolo hodinového stroje
          drawStar(ctx, 0, 0, 6.5, 4.5, 8, '#ffb300', OUTLINE, 1.3);
          drawDisk(ctx, 0, 0, 2.5, '#eceff1', OUTLINE, 1, false);
        } else {
          // Lvl 3: Trhač králů — Těžký harpunový vrhač s kotvami a řetězy
          drawDisk(ctx, -1, 0, 9, '#263238', OUTLINE, 2, true, '#546e7a');
          drawBox(ctx, -3, -4.5, 17, 9, 2, '#37474f', OUTLINE, 1.8, true, '#90a4ae');
          // Zpětné harpunové háky na ústí
          drawShape(ctx, c => {
            c.moveTo(14, -7); c.lineTo(20, 0); c.lineTo(14, 7); c.lineTo(16, 0); c.closePath();
          }, '#cfd8dc', OUTLINE, 1.6, true);
        }
        ctx.restore();
        return;
      }

      // CESTA 3 (Lvl 3–5): Diamantové hroty -> Runová barikáda -> Neprostupná brána království
      if (mp.path === 3 && mp.level >= 3) {
        const isLvl5 = mp.level >= 5;
        // Krystalový brus / Runový oltář uprostřed
        drawDisk(ctx, 0, 0, 10.5, isLvl5 ? '#ffd740' : '#0277bd', OUTLINE, 2, true, isLvl5 ? '#ffff8d' : '#4fc3f7');
        drawStar(ctx, 0, 0, 13, 6.5, 6, '#00e5ff', OUTLINE, 1.6, 0.2);
        drawGem(ctx, 0, 0, 6, '#ffffff', '#e0f7fa', 6);

        // Rameno pokládající diamantový hrot doprava (+X)
        drawBox(ctx, 5, -2.5, 11, 5, 1.2, isLvl5 ? '#ffb300' : '#78909c', OUTLINE, 1.5, false);
        drawGem(ctx, 16, 0, 4.5, '#00e5ff', '#ffffff', 4);
        ctx.restore();
        return;
      }

      // ZÁKLADNÍ VĚŽIČKA (a úrovně 1–2 všech cest)
      // Cesta 2 Lvl 2: Otočná mosazná hlaveň s dvojitým bubnem
      if (u1 >= 2) {
        drawDisk(ctx, -3, -5.5, 4.5, '#5d4037', OUTLINE, 1.5, true, '#8d6e63');
        drawDisk(ctx, -3, 5.5, 4.5, '#5d4037', OUTLINE, 1.5, true, '#8d6e63');
        drawBox(ctx, -4, -3.5, 17, 7, 2, '#ffb300', OUTLINE, 1.8, true, '#ffe082');
        drawBox(ctx, 11, -4.2, 3.5, 8.4, 1, '#ff8f00', OUTLINE, 1.4, false);
      } else if (u1 === 1) {
        // Cesta 2 Lvl 1: Dvojitý katapult (dvě dřevěná házecí ramena s pružinou)
        drawDisk(ctx, -3, 0, 7, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
        for (const ry of [-4.2, 4.2]) {
          drawBox(ctx, -4, ry - 1.8, 15, 3.6, 1, '#8d6e63', OUTLINE, 1.5, true, '#bcaaa4');
          drawDisk(ctx, 11, ry, 3.8, '#455a64', OUTLINE, 1.4, false);
          drawSingleCaltrop(ctx, 11, ry, 3, '#cfd8dc', '#ffffff', u0 >= 2);
        }
      } else {
        // Jedno vrhací rameno s košem plným ježků
        drawDisk(ctx, -3, 0, 7, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
        drawBox(ctx, -4, -2.2, 16, 4.4, 1.2, '#8d6e63', OUTLINE, 1.6, true, '#bcaaa4');
        drawDisk(ctx, 12, 0, 5, '#455a64', OUTLINE, 1.6, true, '#90a4ae');
        drawSingleCaltrop(ctx, 12, 0, 4, '#cfd8dc', '#ffffff', u0 >= 2);
      }

      // Cesta 3 Lvl 2: Trpasličí pozorovatel s mosazným kukátkem na střeše
      if (u2 >= 2) {
        drawDisk(ctx, -5, -1, 4.5, '#ffccbc', OUTLINE, 1.5, false);
        drawDisk(ctx, -6, -1, 4.2, '#37474f', OUTLINE, 1.4, false, '#78909c');
        drawBox(ctx, -2, -2.5, 7, 2.6, 0.8, '#ffb300', OUTLINE, 1.2, false, '#fff59d');
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // VĚŽ 2: LESNÍ DRUID (lesni_druid, poloměr 20 px)
  // ============================================================================
  TDS.drawers.lesni_druid = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Podstavec podle hlavní cesty a křížových vylepšení
      if (mp.path === 1 && mp.level >= 4) {
        // C1 Lvl 4–5: Kamenný kruh bouře se zlatomodrými bleskovými runami
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 19.5,
          isLvl5 ? '#fff8e1' : '#546e7a',
          isLvl5 ? '#ffd54f' : '#37474f',
          '#ffffff',
          41
        );
        // Vzdušný vír / hurikán kolem podstavce
        ctx.strokeStyle = isLvl5 ? '#ffd740' : '#80d8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15.5, 0.2, PI * 0.85);
        ctx.moveTo(-15.5, -2);
        ctx.arc(0, 0, 15.5, PI + 0.2, PI * 1.85);
        ctx.stroke();
      } else if (mp.path === 2 && mp.level >= 4) {
        // C2 Lvl 4–5: Dar úrody / Duch prastarého hvozdu (kvetoucí oltář se zlatými jabloněmi)
        drawStoneCircleBase(ctx, 19.5, '#33691e', '#1b5e20', '#7cb342', 42);
        for (let i = 0; i < 4; i++) {
          const a = (i * PI) / 2 + PI / 4;
          const bx = Math.cos(a) * 16.5;
          const by = Math.sin(a) * 16.5;
          drawDisk(ctx, bx, by, 5, '#43a047', OUTLINE, 1.5, true, '#81c784');
          drawDisk(ctx, bx + 1, by - 1, 2, '#ffd740', OUTLINE, 1, false, '#ffff00');
        }
      } else if (u2 >= 1 || mp.path === 3) {
        // C3 Lvl 1+: Vyvýšený dubový pařez s letokruhy a kořeny
        for (let i = 0; i < 5; i++) {
          const ra = (i * TAU) / 5 + 0.2;
          drawShape(ctx, c => {
            c.moveTo(Math.cos(ra - 0.25) * 14, Math.sin(ra - 0.25) * 14);
            c.lineTo(Math.cos(ra) * 20.5, Math.sin(ra) * 20.5);
            c.lineTo(Math.cos(ra + 0.25) * 14, Math.sin(ra + 0.25) * 14);
            c.closePath();
          }, '#5d4037', OUTLINE, 1.6, true);
        }
        drawDisk(ctx, 0, 0, 16.5, '#6d4c41', OUTLINE, 2, false);
        drawDisk(ctx, 0, 0, 13.5, '#d7ccc8', OUTLINE, 1.4, false, '#efebe9');
        // Letokruhy na pařezu
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, TAU);
        ctx.stroke();

        // C3 Lvl 4+: Vlčí totem a duchovní vlk u nohou druida
        if (mp.path === 3 && mp.level >= 4) {
          drawBox(ctx, -17, -14, 6, 10, 1.5, '#4e342e', OUTLINE, 1.5, true);
          drawDisk(ctx, -14, -11, 1.8, '#00e5ff', null, 0, false);
          // Duchovní vlk dole
          drawDisk(ctx, -11, 13, 4.8, 'rgba(128, 216, 255, 0.78)', OUTLINE, 1.4, false, '#ffffff');
        }
      } else {
        // Základní mechový kamenný podstavec
        drawStoneCircleBase(ctx, 18.5, '#689f38', '#33691e', '#9ccc65', 40);
      }

      // 2. Doplňky Cesty 2 (Lvl 1–3): Kapradiny a živé kořeny s červenými květy
      if (u1 >= 1) {
        const fernCount = (mp.path === 2 && mp.level >= 3) ? 6 : 4;
        for (let i = 0; i < fernCount; i++) {
          const fa = (i * TAU) / fernCount + 0.4;
          const fx = Math.cos(fa) * 17;
          const fy = Math.sin(fa) * 17;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(fa);
          drawShape(ctx, c => c.ellipse(0, 0, 5, 2.6, 0, 0, TAU), '#2e7d32', OUTLINE, 1.4, false);
          if (mp.path === 2 && mp.level >= 3 && i % 2 === 0) {
            drawDisk(ctx, 2, 0, 2.6, '#e53935', OUTLINE, 1.1, false, '#ff8a80');
          }
          ctx.restore();
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // CESTA 2 LVL 5: Duch prastarého hvozdu — Obří živoucí stromový titán (Ent) se smaragdovou korunou
      if (mp.path === 2 && mp.level >= 5) {
        // Masivní dřevěná ramena s větvemi a zlatými runami
        drawShape(ctx, c => {
          c.moveTo(4, -14);
          c.lineTo(-12, -16);
          c.lineTo(-15, 0);
          c.lineTo(-12, 16);
          c.lineTo(4, 14);
          c.closePath();
        }, '#4e342e', OUTLINE, 2.2, true, '#795548');

        // Zlaté runy v kůře
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -8); ctx.lineTo(-3, -4);
        ctx.moveTo(-8, 8); ctx.lineTo(-3, 4);
        ctx.stroke();

        // Pravá pracka Enta svírající prastarou kvetoucí hůl (+X)
        drawBox(ctx, 2, -12, 18, 4.5, 1.8, '#5d4037', OUTLINE, 1.8, true);
        drawGem(ctx, 20, -9.8, 5.5, '#00e676', '#b9f6ca', 6);

        // Hlava Enta se smaragdovou korunou a žhnoucíma očima
        drawDisk(ctx, 0, 0, 9.5, '#2e7d32', OUTLINE, 2, true, '#66bb6a');
        drawGem(ctx, 3, 0, 5, '#00e676', '#ffffff', 6);
        ctx.restore();
        return;
      }

      // CESTA 3 LVL 5: Vtělení prastaré šelmy — Obří černo-rudý medvědodlak ve zlaté runové zbroji
      if (mp.path === 3 && mp.level >= 5) {
        // Rudá aura zuřivosti
        drawHighlight(ctx, c => c.arc(0, 0, 17, 0, TAU), 'rgba(255, 23, 68, 0.28)');

        // Tělo v černo-rudé srsti a zlatých náramenících
        drawDisk(ctx, -1, 0, 11.5, '#212121', OUTLINE, 2.2, true, '#424242');
        drawDisk(ctx, 1, -9.5, 5, '#ffb300', OUTLINE, 1.6, false, '#fff59d');
        drawDisk(ctx, 1, 9.5, 5, '#ffb300', OUTLINE, 1.6, false, '#fff59d');

        // Drápy na obou prackách mířící dopředu (+X)
        for (const side of [-1, 1]) {
          drawBox(ctx, 5, side * 7 - 2.5, 8, 5, 1.5, '#b71c1c', OUTLINE, 1.5, false);
          ctx.strokeStyle = '#ffd740';
          ctx.lineWidth = 1.8;
          for (let d = -1.5; d <= 1.5; d += 1.5) {
            ctx.beginPath();
            ctx.moveTo(13, side * 7 + d);
            ctx.lineTo(19, side * 7 + d * 1.2);
            ctx.stroke();
          }
        }

        // Medvědí hlava s tesáky a rudě planoucíma očima
        drawDisk(ctx, 2, 0, 7.5, '#3e2723', OUTLINE, 2, true, '#5d4037');
        drawDisk(ctx, -1, -6, 2.8, '#3e2723', OUTLINE, 1.4, false);
        drawDisk(ctx, -1, 6, 2.8, '#3e2723', OUTLINE, 1.4, false);
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(5.5, -2.5, 1.6, 0, TAU);
        ctx.arc(5.5, 2.5, 1.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }

      // STANDARDNÍ POSTAVA DRUIDA (Základ a Cesty 1, 2, 3 do Lvl 4 + Cesta 1 Lvl 5)
      let cloakCol = '#2e7d32';
      let cloakHi = '#66bb6a';
      let trimCol = u2 >= 2 ? '#d50000' : '#81c784';

      if (mp.path === 1 && mp.level === 3) { cloakCol = '#0288d1'; cloakHi = '#4fc3f7'; trimCol = '#ffffff'; }
      if (mp.path === 1 && mp.level === 4) { cloakCol = '#e1f5fe'; cloakHi = '#ffffff'; trimCol = '#00b0ff'; }
      if (mp.path === 1 && mp.level >= 5) { cloakCol = '#fff8e1'; cloakHi = '#ffffff'; trimCol = '#ffd740'; }
      if (mp.path === 2 && mp.level === 4) { cloakCol = '#388e3c'; cloakHi = '#81c784'; trimCol = '#ffd740'; }
      if (mp.path === 3 && mp.level === 3) { cloakCol = '#5d4037'; cloakHi = '#8d6e63'; }
      if (mp.path === 3 && mp.level === 4) { cloakCol = '#37474f'; cloakHi = '#90a4ae'; trimCol = '#cfd8dc'; }

      // Plášť druida
      drawShape(ctx, c => {
        c.moveTo(3, -9.5);
        c.quadraticCurveTo(-7, -12.5, -13.5, -8.5);
        c.lineTo(-10.5, 0);
        c.lineTo(-13.5, 8.5);
        c.quadraticCurveTo(-7, 12.5, 3, 9.5);
        c.closePath();
      }, cloakCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(2, -7.5);
        c.quadraticCurveTo(-6, -9.5, -11, -6.5);
        c.lineTo(-8.5, 0);
        c.lineTo(1, -2);
        c.closePath();
      }, cloakHi);

      // Lem pláště (u2 >= 2 krvavě rudé lemování)
      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-12.5, -8);
      ctx.lineTo(-9.8, 0);
      ctx.lineTo(-12.5, 8);
      ctx.stroke();

      // Cesta 1 Lvl 1+: Dubová kůra na ramenou
      if (u0 >= 1) {
        drawDisk(ctx, 1, -8.2, 3.6, '#5d4037', OUTLINE, 1.4, false, '#8d6e63');
        drawDisk(ctx, 1, 8.2, 3.6, '#5d4037', OUTLINE, 1.4, false, '#8d6e63');
      }

      // Cesta 2 Lvl 2+: Zelený smaragd na hrudi
      if (u1 >= 2) {
        drawGem(ctx, 5.5, 0, 2.8, '#00e676', '#ffffff', 4);
      }

      // Levá ruka s připravenými trny (dole +Y)
      drawDisk(ctx, 7, 7.5, 3.2, '#ffccbc', OUTLINE, 1.4, false);
      ctx.strokeStyle = u1 >= 2 ? '#ffd740' : '#76ff03';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(8, 6); ctx.lineTo(14, 4);
      ctx.moveTo(8, 7.5); ctx.lineTo(15, 7.5);
      ctx.moveTo(8, 9); ctx.lineTo(14, 11);
      ctx.stroke();

      // Pravá ruka a druidská hůl (nahoře -Y)
      const staffLen = u2 >= 1 ? 19 : 15;
      if (u2 >= 2) {
        drawHighlight(ctx, c => c.ellipse(10, -8.5, 10, 4.5, 0, 0, TAU), 'rgba(255, 23, 68, 0.3)');
      }
      drawBox(ctx, 1, -10, staffLen, 3, 1.2, '#5d4037', OUTLINE, 1.6, true);

      // Hlavice hole (parohová koruna u0 >= 1, jiskřící drahokam u0 >= 2)
      const tipX = 1 + staffLen;
      if (u0 >= 1) {
        ctx.strokeStyle = '#d7ccc8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(tipX - 2, -8.5);
        ctx.quadraticCurveTo(tipX + 3, -14, tipX + 6, -11);
        ctx.moveTo(tipX - 2, -8.5);
        ctx.quadraticCurveTo(tipX + 3, -3, tipX + 6, -6);
        ctx.stroke();
      }
      const gemCol = u0 >= 2 ? (mp.level >= 5 ? '#ffd740' : '#00e5ff') : '#76ff03';
      drawGem(ctx, tipX + 2, -8.5, u0 >= 2 ? 4.2 : 3.2, gemCol, '#ffffff', 6);

      // Hlava / Kápě / Kožešina / Bouřkový mrak
      drawDisk(ctx, 1, 0, 5.5, '#ffccbc', OUTLINE, 1.6, false);
      drawShape(ctx, c => {
        c.moveTo(3, -5.8);
        c.quadraticCurveTo(-6, -8, -10, 0);
        c.quadraticCurveTo(-6, 8, 3, 5.8);
        c.closePath();
      }, cloakCol, OUTLINE, 1.8, true);

      // Cesta 2 Lvl 4: Koruna ze zlatého obilí a květů
      if (mp.path === 2 && mp.level === 4) {
        drawShape(ctx, c => c.arc(1, 0, 6.2, -PI * 0.5, PI * 0.5), null, '#ffd740', 2.4, false);
      }

      // Cesta 1 Lvl 4–5: Bouřkový mrak s blesky vznášející se nad hlavou
      if (mp.path === 1 && mp.level >= 4) {
        const cloudCol = mp.level >= 5 ? '#fff8e1' : '#cfd8dc';
        drawDisk(ctx, -3, -3, 4.5, cloudCol, OUTLINE, 1.3, false);
        drawDisk(ctx, -1, 2, 5, cloudCol, OUTLINE, 1.3, false, '#ffffff');
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // VĚŽ 3: STÍNOVÝ ZVĚD (stinovy_zved, poloměr 18 px)
  // ============================================================================
  TDS.drawers.stinovy_zved = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      if (mp.path === 2 && mp.level >= 5) {
        // C2 Lvl 5: Pán noční sabotáže — Černo-červený pagodový podstavec, fialová mlha a 4 lucerny
        drawHighlight(ctx, c => c.arc(0, 0, 21, 0, TAU), 'rgba(170, 0, 255, 0.28)');
        drawBox(ctx, -15.5, -15.5, 31, 31, 4, '#212121', OUTLINE, 2.2, true, '#424242');
        drawBox(ctx, -12, -12, 24, 24, 2.5, '#b71c1c', OUTLINE, 1.6, false, '#e53935');
        // 4 vznášející se noční lucerny v rozích
        for (const lx of [-15, 15]) {
          for (const ly of [-15, 15]) {
            drawDisk(ctx, lx, ly, 3.8, '#ffd740', OUTLINE, 1.4, true, '#ffff8d');
            drawDisk(ctx, lx, ly, 1.8, '#ea80fc', null, 0, false);
          }
        }
      } else {
        // Tmavá břidlicová / dřevěná podložka špeha
        drawStoneCircleBase(
          ctx, 17,
          (mp.path === 1 && mp.level >= 4) ? '#37474f' : '#455a64',
          '#263238',
          '#78909c',
          55
        );
      }

      // Cesta 2 Lvl 2+: Jemný šedofialový dýmový opar kolem nohou
      if (u1 >= 2) {
        drawHighlight(ctx, c => c.arc(-2, 2, 14.5, 0, TAU), 'rgba(176, 190, 197, 0.32)');
      }

      // Cesta 2 Lvl 3–4: Škola stínů — Stojan s katanou a černým praporem cechu špehů za zády
      if (mp.path === 2 && mp.level >= 3 && mp.level < 5) {
        drawBox(ctx, -16, -9, 5, 18, 1.2, '#4e342e', OUTLINE, 1.5, true);
        // Černý prapor
        drawShape(ctx, c => {
          c.moveTo(-14, -11); c.lineTo(-22, -15); c.lineTo(-19, -6); c.lineTo(-14, -6); c.closePath();
        }, '#212121', OUTLINE, 1.4, true);
        // Katana ve stojanu
        drawBox(ctx, -14.5, -7, 2.2, 14, 0.8, '#cfd8dc', OUTLINE, 1.2, false);
      }

      // Cesta 3 Lvl 2+: Kožený váček s vysypanými kovovými ježky vedle zvěda
      if (u2 >= 2) {
        drawDisk(ctx, -11, 11, 4.2, '#6d4c41', OUTLINE, 1.5, true, '#8d6e63');
        drawSingleCaltrop(ctx, -6, 13, 3, '#cfd8dc', '#ffffff', false);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // Cesta 1 Lvl 5: Velmistr stínů — Dva poloprůhlední stínoví kloni po boku hlavní postavy
      if (mp.path === 1 && mp.level >= 5) {
        ctx.save();
        ctx.globalAlpha = 0.52;
        for (const cy of [-12.5, 12.5]) {
          drawDisk(ctx, -3, cy, 6.5, '#1a237e', OUTLINE, 1.5, false, '#534bae');
          drawStar(ctx, 6, cy, 5, 2, 4, '#ffd740', OUTLINE, 1.1);
        }
        ctx.restore();
      }

      // Barva šatu a kukly podle cesty
      let suitCol = '#263238';
      let suitHi = '#455a64';
      let maskCol = '#37474f';

      if (u0 >= 1) { suitCol = '#1a237e'; suitHi = '#3949ab'; }
      if (mp.path === 1 && mp.level === 4) { suitCol = '#eceff1'; suitHi = '#ffffff'; maskCol = '#ffd740'; }
      if (mp.path === 1 && mp.level >= 5) { suitCol = '#212121'; suitHi = '#ffb300'; maskCol = '#ffd740'; }
      if (mp.path === 2 && mp.level >= 4) { suitCol = '#880e4f'; suitHi = '#c2185b'; maskCol = '#212121'; }
      if (mp.path === 3 && mp.level >= 5) { suitCol = '#4a148c'; suitHi = '#7b1fa2'; maskCol = '#ffd740'; }

      // Tělo a plášť zvěda
      drawShape(ctx, c => {
        c.moveTo(2, -8.5);
        c.quadraticCurveTo(-7, -10.5, -11.5, -7);
        c.lineTo(-9, 0);
        c.lineTo(-11.5, 7);
        c.quadraticCurveTo(-7, 10.5, 2, 8.5);
        c.closePath();
      }, suitCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(1, -6.5);
        c.lineTo(-9, -5);
        c.lineTo(-7, 0);
        c.closePath();
      }, suitHi);

      // Doplňky na zádech a u pasu
      // Cesta 1 Lvl 3+: Stříbrný nárameník
      if (mp.path === 1 && mp.level >= 3) {
        drawDisk(ctx, 0, -8, 3.8, '#cfd8dc', OUTLINE, 1.4, false, '#ffffff');
      }

      // Cesta 2 Lvl 1+: Fialové váčky s omamným prachem u pasu
      if (u1 >= 1) {
        drawDisk(ctx, -4, 7.5, 2.8, '#ab47bc', OUTLINE, 1.2, false, '#ea80fc');
        drawDisk(ctx, -1, 8.2, 2.5, '#8e24aa', OUTLINE, 1.2, false);
      }

      // Cesta 2 Lvl 4+: Svitek tajných rozkazů na zádech
      if (mp.path === 2 && mp.level >= 4) {
        drawBox(ctx, -10.5, -6, 4, 12, 1.5, '#fff9c4', OUTLINE, 1.4, true);
        drawBox(ctx, -10.5, -2, 4, 4, 0.5, '#d50000', OUTLINE, 1.1, false);
      }

      // Cesta 3 Lvl 4–5: Bedna s přísavnými náložemi / Obří zlatá runová bomba na zádech
      if (mp.path === 3 && mp.level >= 4) {
        if (mp.level >= 5) {
          drawDisk(ctx, -9, 0, 6.8, '#ffb300', OUTLINE, 1.8, true, '#ffff8d');
          drawGem(ctx, -9, 0, 3.5, '#d500f9', '#ffffff', 6);
        } else {
          drawBox(ctx, -11.5, -5.5, 6, 11, 1.5, '#6d4c41', OUTLINE, 1.5, true, '#8d6e63');
          drawDisk(ctx, -8.5, -2.5, 2, '#ab47bc', OUTLINE, 1, false);
          drawDisk(ctx, -8.5, 2.5, 2, '#ab47bc', OUTLINE, 1, false);
        }
      }

      // Zbraně v rukou zvěda
      const starCol = (mp.path === 1 && mp.level >= 4) ? '#ffd740' : (u2 >= 1 ? '#69f0ae' : '#cfd8dc');
      const centerCol = u0 >= 2 ? '#ff1744' : '#263238';

      // Levá ruka (-Y): Druhá hvězdice (C1 Lvl 3+), kouřová bomba (C2 Lvl 4+) nebo oslepující puma (C3 Lvl 3+)
      if (mp.path === 3 && mp.level >= 3) {
        // Černá oslepující bomba s jiskřícím doutnákem
        drawDisk(ctx, 7, -7.5, 4.5, '#212121', OUTLINE, 1.6, true, '#546e7a');
        drawStar(ctx, 10, -10, 3.5, 1.5, 4, '#ffff00', '#ff3d00', 1);
      } else if (mp.path === 1 && mp.level >= 3) {
        drawStar(ctx, 9, -7.5, 5.5, 2.2, 4, starCol, OUTLINE, 1.4);
        drawDisk(ctx, 9, -7.5, 1.5, centerCol, null, 0, false);
      }

      // Pravá ruka (+Y): Hlavní hvězdice nebo vějíř 5 čepelí (C1 Lvl 4+)
      if (mp.path === 1 && mp.level >= 4) {
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.22;
          const sx = 10 + Math.cos(a) * 4;
          const sy = Math.sin(a) * 9;
          drawStar(ctx, sx, sy, 4.8, 1.8, 4, '#ffd740', OUTLINE, 1.2, a);
        }
      } else {
        drawStar(ctx, 10.5, 6.5, 6, 2.4, 4, starCol, OUTLINE, 1.5);
        drawDisk(ctx, 10.5, 6.5, 1.6, centerCol, null, 0, false);
      }

      // Hlava, kukla a maska
      drawDisk(ctx, 1, 0, 5.8, suitCol, OUTLINE, 1.8, true, suitHi);
      // Výřez pro oči a maska přes ústa
      drawBox(ctx, 2.5, -4, 4, 8, 1.5, '#ffccbc', OUTLINE, 1.3, false);
      drawBox(ctx, 3.5, -4.2, 3.5, 8.4, 1.5, maskCol, OUTLINE, 1.3, false);

      // Ochranné stínítko (C3 Lvl 3+) nebo planoucí oči (C3 Lvl 5)
      if (mp.path === 3 && mp.level >= 3) {
        drawBox(ctx, 3, -4.5, 3, 9, 1, mp.level >= 5 ? '#ea80fc' : '#80d8ff', OUTLINE, 1.3, false, '#ffffff');
      } else {
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(4.2, -2, 1.1, 0, TAU);
        ctx.arc(4.2, 2, 1.1, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  };
})();

// ── 2. část: Gryfí jezdec, Obléhací moždíř, Trpasličí inženýr ──
(function () {
  const TDS = window.TDS || (window.TDS = {});

  // Lokální konstanty kresleného stylu
  const OUTLINE = '#111111';
  const SHADOW_COL = 'rgba(10, 15, 8, 0.28)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // Lokální offscreen cache pro statické části extra objektů (pěna, podstavce střílen)
  const localCache = new Map();

  // ============================================================================
  // LOKÁLNÍ POMOCNÉ FUNKCE (Seedovaná náhoda, Tvary, Stíny, Odlesky, Materiály)
  // ============================================================================

  let m_w = 123456789;
  let m_z = 987654321;
  const mask = 0xffffffff;

  function seed(i) {
    m_w = (123456789 + i) & mask;
    m_z = (987654321 - i) & mask;
  }

  function rand() {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    const result = ((m_z << 16) + (m_w & 65535)) >>> 0;
    return result / 4294967296;
  }

  function getCachedCanvas(key, w, h, drawFn) {
    let c = localCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      const cctx = c.getContext('2d');
      cctx.translate(c.width * 0.5, c.height * 0.5);
      drawFn(cctx);
      localCache.set(key, c);
    }
    return c;
  }

  /**
   * Vlastní zaoblený obdélník (náhrada za zakázaný ctx.roundRect)
   */
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const maxR = Math.min(w, h) * 0.5;
    const rad = Math.max(0, Math.min(r || 0, maxR));
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

  function fillAndStroke(ctx, fillStyle, strokeStyle = OUTLINE, lineWidth = 2) {
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

  function drawShape(ctx, pathFn, fillStyle, strokeStyle = OUTLINE, lineWidth = 2, hasShadow = true, shX = 2.5, shY = 3) {
    if (hasShadow) {
      ctx.save();
      ctx.translate(shX, shY);
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

  function drawHighlight(ctx, pathFn, fillStyle) {
    ctx.save();
    ctx.beginPath();
    pathFn(ctx);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  function drawDisk(ctx, x, y, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => c.arc(x, y, r, 0, TAU), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => c.arc(x - r * 0.22, y - r * 0.22, r * 0.58, 0, TAU), hiFill);
    }
  }

  function drawBox(ctx, x, y, w, h, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => roundRect(c, x, y, w, h, r), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => roundRect(c, x + 1.5, y + 1.5, Math.max(1, w - 3), Math.max(1, h * 0.38), r * 0.6), hiFill);
    }
  }

  function polyPath(ctx, x, y, r, sides, rotOffset = 0) {
    for (let i = 0; i < sides; i++) {
      const a = rotOffset + (i * TAU) / sides;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawGem(ctx, x, y, r, baseCol, hiCol, sides = 6, rot = 0) {
    drawShape(ctx, c => polyPath(c, x, y, r, sides, rot), baseCol, OUTLINE, 1.5, false);
    drawHighlight(ctx, c => c.arc(x - r * 0.24, y - r * 0.24, r * 0.42, 0, TAU), hiCol);
  }

  function drawStar(ctx, x, y, rOuter, rInner, points, fill, stroke = OUTLINE, lw = 1.5, rot = 0) {
    drawShape(ctx, c => {
      for (let i = 0; i < points * 2; i++) {
        const a = rot + (i * PI) / points;
        const rad = i % 2 === 0 ? rOuter : rInner;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    }, fill, stroke, lw, false);
  }

  function drawStoneCircleBase(ctx, r, baseCol, blockCol, hiCol, crackSeed = 1) {
    drawDisk(ctx, 0, 0, r, baseCol, OUTLINE, 2.2, true);
    drawHighlight(ctx, c => c.arc(-r * 0.14, -r * 0.14, r * 0.76, 0, TAU), hiCol);

    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * TAU + 0.05;
      const a2 = ((i + 1) / segs) * TAU - 0.05;
      const isLit = i >= 3 && i <= 6;
      drawShape(ctx, c => {
        c.arc(0, 0, r, a1, a2);
        c.arc(0, 0, r * 0.74, a2, a1, true);
        c.closePath();
      }, isLit ? hiCol : blockCol, OUTLINE, 1.5, false);
    }

    seed(crackSeed);
    ctx.save();
    ctx.strokeStyle = 'rgba(17, 17, 17, 0.4)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.12);
    ctx.lineTo(0, r * 0.08);
    ctx.lineTo(r * 0.25, -r * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWoodDeckBase(ctx, r, woodCol, woodHi, rimCol) {
    drawDisk(ctx, 0, 0, r, rimCol, OUTLINE, 2.2, true);
    drawDisk(ctx, 0, 0, r - 2.5, woodCol, OUTLINE, 1.6, false, woodHi);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 2.5, 0, TAU);
    ctx.clip();

    ctx.strokeStyle = 'rgba(17, 17, 17, 0.38)';
    ctx.lineWidth = 1.3;
    for (let py = -r + 6; py <= r - 6; py += 6.5) {
      ctx.beginPath();
      ctx.moveTo(-r, py);
      ctx.lineTo(r, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  function getMainPath(up) {
    const u0 = (up && up[0]) || 0;
    const u1 = (up && up[1]) || 0;
    const u2 = (up && up[2]) || 0;
    if (u0 >= 3) return { path: 1, level: u0, u0, u1, u2 };
    if (u1 >= 3) return { path: 2, level: u1, u0, u1, u2 };
    if (u2 >= 3) return { path: 3, level: u2, u0, u1, u2 };
    const maxL = Math.max(u0, u1, u2);
    const p = maxL === 0 ? 0 : (u0 === maxL ? 1 : (u1 === maxL ? 2 : 3));
    return { path: p, level: maxL, u0, u1, u2 };
  }

  // ============================================================================
  // 1. NOVÉ STŘELY (TDS.projectileDrawers)
  // Střela míří doprava (+X) kolem bodu 0,0 a vejde se do 48 × 48 px.
  // ============================================================================

  TDS.projectileDrawers = Object.assign(TDS.projectileDrawers || {}, {

    /**
     * 'gryfDart' — Opeřená ocelová šipka se zlatými letkami vystřelená ze vzduchu (Gryfí jezdec)
     */
    gryfDart: function (ctx) {
      ctx.save();
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(1.5, 3, 12, 3, 0, 0, TAU);
      ctx.fill();

      // Zlaté opeření vzadu (-X)
      for (const side of [-1, 1]) {
        drawShape(ctx, c => {
          c.moveTo(-5, 0);
          c.lineTo(-13, side * 5);
          c.lineTo(-10, 0);
          c.closePath();
        }, '#ffd740', OUTLINE, 1.4, false);
      }

      // Dřík šipky
      drawBox(ctx, -10, -1.5, 14, 3, 1, '#8d6e63', OUTLINE, 1.4, false, '#bcaaa4');

      // Ocelový hrot (+X)
      drawShape(ctx, c => {
        c.moveTo(2, -4);
        c.lineTo(13, 0);
        c.lineTo(2, 4);
        c.lineTo(4, 0);
        c.closePath();
      }, '#cfd8dc', OUTLINE, 1.6, false);

      drawHighlight(ctx, c => {
        c.moveTo(3.5, -2.5);
        c.lineTo(11.5, 0);
        c.lineTo(3.5, 0);
        c.closePath();
      }, '#ffffff');
      ctx.restore();
    },

    /**
     * 'rocket' — Naváděná dračí raketa s mosazným tělem a plamennou tryskou (Gryfí jezdec Cesta 1)
     */
    rocket: function (ctx) {
      ctx.save();
      // Plamen z trysky (-X)
      drawShape(ctx, c => {
        c.moveTo(-9, -3.5);
        c.lineTo(-19, 0);
        c.lineTo(-9, 3.5);
        c.closePath();
      }, '#ff6d00', OUTLINE, 1.3, false);
      drawHighlight(ctx, c => {
        c.moveTo(-9, -1.8);
        c.lineTo(-15, 0);
        c.lineTo(-9, 1.8);
        c.closePath();
      }, '#ffff00');

      // Křidélka stabilizátoru
      for (const side of [-1, 1]) {
        drawShape(ctx, c => {
          c.moveTo(-4, side * 3);
          c.lineTo(-11, side * 7.5);
          c.lineTo(-10, side * 3);
          c.closePath();
        }, '#b71c1c', OUTLINE, 1.4, false);
      }

      // Mosazné tělo rakety
      drawBox(ctx, -10, -4, 16, 8, 2, '#ffb300', OUTLINE, 1.8, true, '#fff59d');

      // Rudá dračí hlavice (+X)
      drawShape(ctx, c => {
        c.moveTo(5, -4.2);
        c.quadraticCurveTo(11, -3, 15, 0);
        c.quadraticCurveTo(11, 3, 5, 4.2);
        c.closePath();
      }, '#d50000', OUTLINE, 1.7, false);
      drawHighlight(ctx, c => {
        c.moveTo(6, -2.6);
        c.lineTo(13, 0);
        c.lineTo(6, 0);
        c.closePath();
      }, '#ff8a80');
      ctx.restore();
    },

    /**
     * 'shell' — Výbušný dělostřelecký granát s mosaznou špičkou (Gryfí jezdec Cesta 3)
     */
    shell: function (ctx) {
      ctx.save();
      drawBox(ctx, -11, -4.5, 13, 9, 2, '#455a64', OUTLINE, 1.8, true, '#90a4ae');
      // Mosazný vodicí kroužek
      drawBox(ctx, -2, -5, 3.5, 10, 1, '#ffd740', OUTLINE, 1.3, false, '#ffff8d');
      // Špičatá výbušná hlavice (+X)
      drawShape(ctx, c => {
        c.moveTo(1.5, -4.5);
        c.quadraticCurveTo(9, -3.5, 14, 0);
        c.quadraticCurveTo(9, 3.5, 1.5, 4.5);
        c.closePath();
      }, '#ff3d00', OUTLINE, 1.7, false);
      drawHighlight(ctx, c => {
        c.moveTo(2.5, -2.8);
        c.lineTo(12, 0);
        c.lineTo(2.5, 0);
        c.closePath();
      }, '#ffcc80');
      ctx.restore();
    },

    /**
     * 'mortarShell' — Velká černá litinová puma s kouřovou stopou a jiskřícím doutnákem (Obléhací moždíř)
     */
    mortarShell: function (ctx) {
      ctx.save();
      // Kouřová stopa vzadu (-X)
      drawDisk(ctx, -14, 1, 4.5, 'rgba(176, 190, 197, 0.55)', null, 0, false);
      drawDisk(ctx, -9, -1, 6, 'rgba(207, 216, 220, 0.7)', null, 0, false);

      // Litinová koule pumy
      drawDisk(ctx, 2, 0, 10.5, '#263238', OUTLINE, 2.2, true, '#607d8b');
      drawHighlight(ctx, c => c.arc(-1.5, -3.5, 3.5, 0, TAU), '#b0bec5');

      // Mosazné hrdlo a hořící doutnák
      drawBox(ctx, -9, -2.5, 4, 5, 1, '#ffb300', OUTLINE, 1.4, false);
      drawStar(ctx, -11, 0, 5.5, 2.2, 5, '#ffff00', '#ff3d00', 1.2);
      ctx.restore();
    },

    /**
     * 'nail' — Dlouhý kovový hřebík s plochou hlavičkou vystřelený stlačenou párou (Trpasličí inženýr)
     */
    nail: function (ctx) {
      ctx.save();
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(1, 2.5, 11, 2.5, 0, 0, TAU);
      ctx.fill();

      // Plochá hlavička hřebu (-X)
      drawBox(ctx, -12, -4.5, 3.5, 9, 1.2, '#78909c', OUTLINE, 1.6, false, '#eceff1');

      // Dřík a ostrá špička hřebu (+X)
      drawShape(ctx, c => {
        c.moveTo(-8.5, -2.2);
        c.lineTo(6, -2.2);
        c.lineTo(13, 0);
        c.lineTo(6, 2.2);
        c.lineTo(-8.5, 2.2);
        c.closePath();
      }, '#b0bec5', OUTLINE, 1.6, false);

      // Kovový odlesk a závit
      drawHighlight(ctx, c => {
        c.moveTo(-7.5, -1.3);
        c.lineTo(10, 0);
        c.lineTo(-7.5, 0);
        c.closePath();
      }, '#ffffff');
      ctx.restore();
    },

    /**
     * 'plasma' — Zářící fialovo-modrý plazmový výboj z automatů (Trpasličí inženýr Lvl 5)
     */
    plasma: function (ctx) {
      ctx.save();
      // Vnější energetická záře
      drawHighlight(ctx, c => c.ellipse(-1, 0, 14, 7.5, 0, 0, TAU), 'rgba(213, 0, 249, 0.35)');

      // Plazmový ohon
      drawShape(ctx, c => {
        c.moveTo(-14, 0);
        c.quadraticCurveTo(-2, -6.5, 7, -4.5);
        c.arc(5, 0, 5.5, -PI * 0.4, PI * 0.4);
        c.quadraticCurveTo(-2, 6.5, -14, 0);
        c.closePath();
      }, '#aa00ff', OUTLINE, 1.6, false);

      // Bílo-azurové jádro
      drawDisk(ctx, 4, 0, 4.5, '#00e5ff', null, 0, false, '#ffffff');
      ctx.restore();
    }
  });

  // ============================================================================
  // 2. EXTRA OBJEKTY NA CESTĚ A VE VZDUCHU (<id>Extra)
  // ============================================================================

  /**
   * TDS.gryfi_jezdecExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'gryf' : Letící gryf s rytířem v sedle kreslený shora (ang = směr letu, s.up = [a,b,c] úrovně vylepšení věže).
   *            Mění vzhled podle úrovní všech tří cest (rozpětí a počet křídel, zbroj, raketomety, pumy, arbalest či 3 věžičky).
   */
  TDS.gryfi_jezdecExtra = function (ctx, kind, x, y, ang, ts, s) {
    if (kind !== 'gryf') return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);

    const state = s || {};
    const up = state.up || [0, 0, 0];
    const mp = getMainPath(up);
    const { u0, u1, u2 } = mp;
    const time = ts || 0;

    // Plynulý mávavý pohyb křídel za letu
    const flapSpeed = u0 >= 1 ? 0.014 : 0.01;
    const flap = Math.sin(time * flapSpeed) * 0.22;

    // 1. Stín letícího gryfa hluboko pod ním na zemi
    ctx.save();
    ctx.translate(10, 14);
    ctx.fillStyle = 'rgba(10, 15, 8, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 24, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 2. Vzdušná či ohnivá stopa za křídly (C1 Lvl 4+ nebo C2 Lvl 5)
    if (mp.path === 1 && mp.level >= 4) {
      drawHighlight(ctx, c => c.ellipse(-18, 0, 14, 9, 0, 0, TAU), 'rgba(128, 216, 255, 0.35)');
      if (mp.level >= 5) {
        // Zářící svatozář Pána nebeské pevnosti
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, TAU);
        ctx.stroke();
      }
    } else if (mp.path === 2 && mp.level >= 5) {
      drawHighlight(ctx, c => c.ellipse(-18, 0, 16, 11, 0, 0, TAU), 'rgba(255, 109, 0, 0.38)');
    }

    // Určení barev peří a zbroje podle hlavní cesty
    let bodyCol = '#8d6e63';
    let wingCol = '#a1887f';
    let tipCol = u0 >= 1 ? '#ffffff' : '#d7ccc8';
    let armorCol = null;

    if (mp.path === 1 && mp.level >= 4) {
      bodyCol = '#e1f5fe'; wingCol = '#ffffff'; tipCol = '#ffd740'; armorCol = '#ffd740';
    } else if (mp.path === 2 && mp.level === 4) {
      bodyCol = '#37474f'; wingCol = '#263238'; tipCol = '#d50000'; armorCol = '#b71c1c';
    } else if (mp.path === 2 && mp.level >= 5) {
      bodyCol = '#ff6d00'; wingCol = '#ff3d00'; tipCol = '#ffff00'; armorCol = '#ffd740';
    } else if (mp.path === 3 && mp.level >= 4) {
      bodyCol = '#607d8b'; wingCol = '#78909c'; tipCol = '#ffd740'; armorCol = '#ffb300';
    }

    // 3. Křídla gryfa (u C1 Lvl 5 čtyři křídla arcigryfa, jinak dvě mohutná křídla)
    const wingSpan = u0 >= 1 ? 26 : 22;
    const drawWingPair = (xOff, scaleW, flapAdd) => {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(xOff, side * 5);
        ctx.rotate(side * (flap + flapAdd));

        // Hlavní peruť
        drawShape(ctx, c => {
          c.moveTo(5, 0);
          c.quadraticCurveTo(2, side * wingSpan * scaleW * 0.6, -7, side * wingSpan * scaleW);
          c.lineTo(-13, side * wingSpan * scaleW * 0.75);
          c.lineTo(-9, side * wingSpan * scaleW * 0.45);
          c.lineTo(-12, side * wingSpan * scaleW * 0.25);
          c.lineTo(-6, 0);
          c.closePath();
        }, wingCol, OUTLINE, 2, false);

        // Světlé letky na koncích křídel
        drawHighlight(ctx, c => {
          c.moveTo(2, side * 3);
          c.quadraticCurveTo(0, side * wingSpan * scaleW * 0.55, -7, side * wingSpan * scaleW * 0.92);
          c.lineTo(-11, side * wingSpan * scaleW * 0.68);
          c.closePath();
        }, tipCol);

        // C1 Lvl 3+: Mosazné odpalovače raket pod křídly
        if (mp.path === 1 && mp.level >= 3) {
          drawBox(ctx, -3, side * 9 - 2, 11, 4, 1, '#ffb300', OUTLINE, 1.4, false);
          drawDisk(ctx, 8, side * 9, 1.8, '#d50000', OUTLINE, 1, false);
        }
        ctx.restore();
      }
    };

    if (mp.path === 1 && mp.level >= 5) {
      drawWingPair(-7, 0.82, -0.18);
      drawWingPair(3, 1.08, 0.1);
    } else {
      drawWingPair(0, 1.0, 0);
    }

    // 4. Ocas a lví zadní část těla (-X)
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-18, Math.sin(time * 0.008) * 4, -22, 0);
    ctx.stroke();
    drawDisk(ctx, -22, 0, 3.2, tipCol, OUTLINE, 1.4, false);

    // Trup gryfa
    drawShape(ctx, c => c.ellipse(0, 0, 14, 8.5, 0, 0, TAU), bodyCol, OUTLINE, 2.2, false);
    if (armorCol) {
      drawShape(ctx, c => c.ellipse(1, 0, 11, 6.5, 0, 0, TAU), armorCol, OUTLINE, 1.6, false);
    }

    // Přední pařáty (u2 >= 1 okované ocelovými drápy)
    const clawCol = u2 >= 1 ? '#cfd8dc' : '#ffb300';
    for (const side of [-1, 1]) {
      drawBox(ctx, 9, side * 6 - 1.8, 6, 3.6, 1, clawCol, OUTLINE, 1.4, false);
    }

    // Cesta 2 Lvl 1–4: Náklad pum nebo obří sud pod břichem / v pařátech
    if (u1 >= 1) {
      if (mp.path === 2 && mp.level >= 4) {
        drawBox(ctx, 6, -9, 8, 5, 1.5, '#ffb300', OUTLINE, 1.5, false);
        drawBox(ctx, 6, 4, 8, 5, 1.5, '#ffb300', OUTLINE, 1.5, false);
      } else {
        drawDisk(ctx, -4, -7.5, 3.2, '#212121', OUTLINE, 1.3, false);
        drawDisk(ctx, -4, 7.5, 3.2, '#212121', OUTLINE, 1.3, false);
      }
    }

    // 5. Hlava gryfa (+X) s orlím zobákem
    drawDisk(ctx, 12, 0, 6.2, tipCol, OUTLINE, 2, false, '#ffffff');
    if ((mp.path === 1 && mp.level >= 3) || armorCol) {
      // Přilbice gryfa
      drawShape(ctx, c => {
        c.moveTo(8, -5.5); c.lineTo(16, 0); c.lineTo(8, 5.5); c.closePath();
      }, armorCol || '#90a4ae', OUTLINE, 1.5, false);
    }
    // Zahnutý zlatý zobák
    drawShape(ctx, c => {
      c.moveTo(16, -3); c.lineTo(22, 0); c.lineTo(16, 3); c.closePath();
    }, '#ffb300', OUTLINE, 1.6, false);

    // Oči gryfa (u1 >= 2 jasně zlatě svítí)
    ctx.fillStyle = u1 >= 2 ? '#ffff00' : '#111111';
    ctx.beginPath();
    ctx.arc(14.5, -2.6, 1.4, 0, TAU);
    ctx.arc(14.5, 2.6, 1.4, 0, TAU);
    ctx.fill();

    // 6. Sedlo, jezdec nebo střelecká nástavba na hřbetě
    // C1 Lvl 2+: Bubnové toulce po stranách sedla
    if (u0 >= 2) {
      drawDisk(ctx, -3, -7, 3.2, '#5d4037', OUTLINE, 1.3, false, '#ffd740');
      drawDisk(ctx, -3, 7, 3.2, '#5d4037', OUTLINE, 1.3, false, '#ffd740');
    }

    if (mp.path === 3 && mp.level >= 5) {
      // C3 Lvl 5: Létající citadela — Pancéřovaná věž se třemi zlatými kanóny na zádech gryfa
      drawBox(ctx, -8, -7.5, 14, 15, 3, '#37474f', OUTLINE, 2, false, '#78909c');
      for (const cy of [-4.5, 0, 4.5]) {
        drawBox(ctx, 2, cy - 1.6, 10, 3.2, 1, '#ffd740', OUTLINE, 1.4, false);
      }
      drawDisk(ctx, -1, 0, 5, '#ffb300', OUTLINE, 1.6, false, '#ffff8d');
    } else if (mp.path === 3 && mp.level === 4) {
      // C3 Lvl 4: Přízrak oblohy — Dvojhlavňové mechanické dělo na hřbetě
      drawDisk(ctx, -1, 0, 6.5, '#455a64', OUTLINE, 1.8, false, '#90a4ae');
      drawBox(ctx, 2, -4, 11, 3, 1, '#ffd740', OUTLINE, 1.4, false);
      drawBox(ctx, 2, 1, 11, 3, 1, '#ffd740', OUTLINE, 1.4, false);
    } else {
      // Královský jezdec v sedle
      const cloakCol = u0 >= 1 ? '#1976d2' : '#c62828';
      drawShape(ctx, c => {
        c.moveTo(0, -5); c.lineTo(-9, -6.5); c.lineTo(-7, 0); c.lineTo(-9, 6.5); c.lineTo(0, 5); c.closePath();
      }, cloakCol, OUTLINE, 1.5, false);

      // Přilba jezdce
      drawDisk(ctx, 0, 0, 4.8, armorCol || '#cfd8dc', OUTLINE, 1.6, false, '#ffffff');

      // C3 Lvl 3: Opakovací trpasličí arbalest na otočném kloubu
      if (mp.path === 3 && mp.level === 3) {
        drawBox(ctx, 3, -1.5, 9, 3, 1, '#5d4037', OUTLINE, 1.3, false);
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, -6.5); ctx.quadraticCurveTo(12, 0, 8, 6.5);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  /**
   * TDS.oblehaci_mozdirExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'target' : Zaměřovací terč dopadu na zemi (s.r = poloměr výbuchu v px, s.sel = boolean zda je věž vybraná).
   */
  TDS.oblehaci_mozdirExtra = function (ctx, kind, x, y, ang, ts, s) {
    if (kind !== 'target') return;
    ctx.save();
    ctx.translate(x, y);

    const state = s || {};
    const rad = state.r || 52;
    const isSel = Boolean(state.sel);
    const time = ts || 0;
    const spin = time * 0.0018;

    // Pokud je věž vybraná (s.sel) nebo jako jemná indikace poloměru výbuchu (s.r)
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = isSel ? '#ff5252' : 'rgba(255, 82, 82, 0.42)';
    ctx.lineWidth = isSel ? 2.5 : 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (isSel) {
      drawHighlight(ctx, c => c.arc(0, 0, rad, 0, TAU), 'rgba(255, 23, 68, 0.10)');
    }

    // Vnitřní kreslený zaměřovací kříž s tmavým obrysem
    const pulse = 1 + Math.sin(time * 0.008) * 0.08;
    ctx.scale(pulse, pulse);

    // Vnější červeno-žlutý prstenec terče
    drawShape(ctx, c => {
      c.arc(0, 0, 14, 0, TAU);
      c.arc(0, 0, 9.5, TAU, 0, true);
      c.closePath();
    }, '#ff1744', OUTLINE, 1.6, false);

    // 4 střelecké rysky po obvodu
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * PI) / 2);
      drawBox(ctx, 11, -1.8, 6, 3.6, 1, '#ffd740', OUTLINE, 1.3, false);
      ctx.restore();
    }

    // Středová tečka terče
    drawDisk(ctx, 0, 0, 3.5, '#ffea00', OUTLINE, 1.4, false, '#ffffff');
    ctx.restore();
  };

  /**
   * TDS.trpaslici_inzenyrExtra(ctx, kind, x, y, ang, ts, s)
   * Podporované hodnoty kind:
   * - 'foam'                 : Alchymistická bělostná čisticí pěna na cestě s bublinkami (Cesta 2 Lvl 3+).
   * - 'cage'                 : Mechanická trpasličí klec na cestě (s.fill = 0–1 naplnění, s.tier5 = diamantová klec).
   * - 'sentry_basic'         : Základní automatická hřebíková střílna (Cesta 1 Lvl 1–3, ang = míření, s.firing = 0–1).
   * - 'sentry_crushing_mace' : Střílna Drtící palcát proti Zlatým slizům (Cesta 1 Lvl 4).
   * - 'sentry_explosion_bomb': Střílna Pumomet pro plošné výbuchy (Cesta 1 Lvl 4).
   * - 'sentry_laser_beam'    : Střílna Ohnivý paprsek s rubínovou čočkou (Cesta 1 Lvl 4).
   * - 'sentry_frost_pulse'   : Střílna Mrazicí věžička s ledovým krystalem (Cesta 1 Lvl 4).
   * - 'sentry_plasma'        : Runová plazmová střílna s trojitou hlavní (Cesta 1 Lvl 5).
   */
  TDS.trpaslici_inzenyrExtra = function (ctx, kind, x, y, ang, ts, s) {
    ctx.save();
    ctx.translate(x, y);

    const state = s || {};
    const time = ts || 0;
    const firing = state.firing || 0;

    if (kind === 'foam') {
      // Statický podklad pěny z offscreen cache + živé bublinky
      const foamCvs = getCachedCanvas('extra_eng_foam', 44, 44, c => {
        const blobs = [
          [0, 0, 14], [-9, -5, 10], [9, -4, 10.5], [-7, 6, 10], [8, 6, 9.5], [0, -8, 9]
        ];
        c.fillStyle = OUTLINE;
        for (const [bx, by, br] of blobs) {
          c.beginPath(); c.arc(bx, by, br + 2, 0, TAU); c.fill();
        }
        c.fillStyle = '#e1f5fe';
        for (const [bx, by, br] of blobs) {
          c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
        }
        c.fillStyle = '#ffffff';
        for (const [bx, by, br] of blobs) {
          c.beginPath(); c.arc(bx - 1.5, by - 1.5, br * 0.72, 0, TAU); c.fill();
        }
      });
      ctx.rotate(ang || 0);
      ctx.drawImage(foamCvs, -22, -22);

      // Animované praskající bublinky na pěně
      for (let i = 0; i < 3; i++) {
        const bPhase = (time * 0.004 + i * 0.33) % 1;
        const bx = Math.cos(i * 2.1) * 8;
        const by = Math.sin(i * 2.1) * 6;
        const br = 1.5 + bPhase * 2.8;
        drawDisk(ctx, bx, by, br, '#80d8ff', OUTLINE, 1.1, false, '#ffffff');
      }
      ctx.restore();
      return;
    }

    if (kind === 'cage') {
      // Mechanická klecová past na cestě (s.fill = 0..1)
      ctx.rotate(ang || 0);
      const fill = Math.max(0, Math.min(1, state.fill || 0));
      const isTier5 = Boolean(state.tier5);

      // Třesení klece, když je téměř plná
      if (fill > 0.7) {
        ctx.translate(Math.sin(time * 0.05) * 1.5, Math.cos(time * 0.04) * 1.5);
      }

      const frameCol = isTier5 ? '#00e5ff' : '#ffb300';
      const innerCol = '#263238';

      // Podstavec klece
      drawBox(ctx, -14, -14, 28, 28, 4, frameCol, OUTLINE, 2.2, true, isTier5 ? '#e0f7fa' : '#fff59d');
      drawBox(ctx, -10.5, -10.5, 21, 21, 2, innerCol, OUTLINE, 1.6, false);

      // Uvězněný slizovo-zlatý obsah uvnitř klece podle s.fill
      if (fill > 0.02) {
        const slR = 3 + fill * 7.2;
        drawDisk(ctx, 0, 0, slR, fill >= 0.95 ? '#ffd740' : '#00e676', OUTLINE, 1.5, false, '#ffffff');
      }

      // Ozubené čelisti / mříže klece, které se svírají s rostoucím s.fill
      const jawClose = fill * 5.5;
      for (const side of [-1, 1]) {
        const jy = side * (9.5 - jawClose);
        drawBox(ctx, -10, jy - 2.2, 20, 4.4, 1, '#90a4ae', OUTLINE, 1.5, false, '#eceff1');
      }
      ctx.restore();
      return;
    }

    // Automatické střílny inženýra (kind = 'sentry_*')
    const isPlasma = kind === 'sentry_plasma';
    const baseKey = isPlasma ? 'sentry_base_plasma' : 'sentry_base_std';
    const baseCvs = getCachedCanvas(baseKey, 34, 34, c => {
      // 3 kovové nožky trojnožky
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate((i * TAU) / 3 + PI / 6);
        drawBox(c, 4, -2.2, 10, 4.4, 1.2, isPlasma ? '#ffb300' : '#455a64', OUTLINE, 1.5, true);
        c.restore();
      }
      drawDisk(c, 0, 0, 9.5, isPlasma ? '#ffd740' : '#607d8b', OUTLINE, 1.8, false, isPlasma ? '#ffff8d' : '#b0bec5');
    });
    ctx.drawImage(baseCvs, -17, -17);

    // Otočná hlava střílny podle úhlu ang
    ctx.rotate(ang || 0);
    const recoil = firing * -2.5;
    ctx.translate(recoil, 0);

    if (kind === 'sentry_crushing_mace') {
      // Drtící palcát (žlutooranžová střílna s ostnatou koulí)
      drawBox(ctx, -4, -3, 14, 6, 1.5, '#ffb300', OUTLINE, 1.6, false);
      drawStar(ctx, 12, 0, 7.5, 4.5, 8, '#37474f', OUTLINE, 1.4);
      drawDisk(ctx, 0, 0, 6.5, '#ff8f00', OUTLINE, 1.8, false, '#ffe082');

    } else if (kind === 'sentry_explosion_bomb') {
      // Pumomet (červeno-černý moždířek na trojnožce)
      drawBox(ctx, -2, -5, 13, 10, 2, '#263238', OUTLINE, 1.8, false, '#546e7a');
      drawBox(ctx, 9, -6, 3.5, 12, 1, '#d50000', OUTLINE, 1.5, false);
      drawDisk(ctx, -1, 0, 6.5, '#b71c1c', OUTLINE, 1.8, false, '#ff8a80');

    } else if (kind === 'sentry_laser_beam') {
      // Ohnivý paprsek (červeno-zlatá věžička s rubínovou čočkou)
      drawBox(ctx, -2, -3.2, 14, 6.4, 1.5, '#cfd8dc', OUTLINE, 1.6, false);
      drawGem(ctx, 12, 0, 4.2, '#ff1744', '#ff8a80', 6);
      drawDisk(ctx, 0, 0, 6.5, '#d50000', OUTLINE, 1.8, false, '#ff8a80');

    } else if (kind === 'sentry_frost_pulse') {
      // Mrazicí věžička (azurová s ledovým krystalem)
      drawBox(ctx, -2, -3.5, 13, 7, 1.5, '#4fc3f7', OUTLINE, 1.6, false);
      drawStar(ctx, 11, 0, 6.5, 3, 6, '#e1f5fe', OUTLINE, 1.3);
      drawDisk(ctx, 0, 0, 6.5, '#0288d1', OUTLINE, 1.8, false, '#81d4fa');

    } else if (kind === 'sentry_plasma') {
      // Lvl 5: Runová plazmová střílna
      for (const py of [-3.5, 0, 3.5]) {
        drawBox(ctx, 2, py - 1.3, 12, 2.6, 1, '#aa00ff', OUTLINE, 1.3, false);
      }
      drawDisk(ctx, 0, 0, 7.5, '#4a148c', OUTLINE, 1.8, false, '#ea80fc');
      drawGem(ctx, 0, 0, 4, '#00e5ff', '#ffffff', 6);

    } else {
      // 'sentry_basic' — Automatická hřebíková střílna
      drawBox(ctx, 0, -2.5, 13, 5, 1.2, '#37474f', OUTLINE, 1.6, false, '#90a4ae');
      drawDisk(ctx, -1, 0, 6.5, '#fdd835', OUTLINE, 1.8, false, '#fff59d');
    }

    // Záblesk výstřelu střílny (s.firing 0–1)
    if (firing > 0) {
      ctx.globalAlpha = firing;
      drawDisk(ctx, 16, 0, 4 + firing * 3, isPlasma ? '#00e5ff' : '#ffff00', null, 0, false, '#ffffff');
    }

    ctx.restore();
  };

  // ============================================================================
  // 3. KRESLÍŘI VĚŽÍ (TDS.drawers.<id> = { base(ctx, up), turret(ctx, up, s) })
  // ============================================================================

  TDS.drawers = TDS.drawers || {};

  // ============================================================================
  // VĚŽ 4: GRYFÍ JEZDEC (gryfi_jezdec, poloměr 24 px — Hnízdo a základna na zemi)
  // ============================================================================
  TDS.drawers.gryfi_jezdec = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Skalní či pevnostní podklad pod hnízdem
      if (mp.path === 1 && mp.level >= 4) {
        // C1 Lvl 4–5: Zlatomodrá královská přistávací svatyně / Nebeská pevnost
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 23,
          isLvl5 ? '#ffd740' : '#0288d1',
          isLvl5 ? '#ffb300' : '#01579b',
          '#ffffff',
          61
        );
      } else if (mp.path === 2 && mp.level >= 4) {
        // C2 Lvl 4–5: Černo-červená bombardovací základna se 4 runovými pumami v rozích
        drawStoneCircleBase(ctx, 23, '#263238', '#b71c1c', '#78909c', 62);
        if (mp.level >= 5) {
          for (let i = 0; i < 4; i++) {
            const a = (i * PI) / 2 + PI / 4;
            const bx = Math.cos(a) * 20;
            const by = Math.sin(a) * 20;
            drawDisk(ctx, bx, by, 5, '#212121', OUTLINE, 1.6, true, '#ff6d00');
            drawDisk(ctx, bx, by, 2, '#ffff00', null, 0, false);
          }
        }
      } else if (mp.path === 3 && mp.level >= 4) {
        // C3 Lvl 4–5: Pancéřovaná bašta Létající citadely
        drawShape(ctx, c => polyPath(c, 0, 0, 23, 8, PI / 8), '#455a64', OUTLINE, 2.2, true);
        drawDisk(ctx, 0, 0, 18.5, '#37474f', OUTLINE, 1.6, false, '#90a4ae');
      } else {
        // Přírodní skalní plošina pod hnízdem gryfa
        drawStoneCircleBase(ctx, 22.5, '#78909c', '#546e7a', '#cfd8dc', 60);
      }

      // 2. Propletené hnízdo gryfa uprostřed
      const nestCol = (mp.path === 1 && mp.level >= 5) ? '#ffe082' : '#795548';
      const nestHi = (mp.path === 1 && mp.level >= 5) ? '#ffffff' : '#a1887f';
      drawDisk(ctx, 0, 0, 16.5, nestCol, OUTLINE, 2, true, nestHi);

      // Větvičky po obvodu hnízda
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 10; i++) {
        const a = (i * TAU) / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.35) * 16, Math.sin(a + 0.35) * 16);
        ctx.stroke();
      }

      // Vnitřní měkká výstelka hnízda s pírky a vejcem/erbem
      drawDisk(ctx, 0, 0, 11, '#5d4037', OUTLINE, 1.5, false);
      drawShape(ctx, c => c.ellipse(-2, -1, 4.5, 3.5, 0.3, 0, TAU), '#fff8e1', OUTLINE, 1.4, false);

      // 3. Doplňky na hnízdě podle vylepšení
      // Cesta 1 Lvl 2+: Zásobní toulce se šipkami u hnízda
      if (u0 >= 2) {
        drawDisk(ctx, -15, -12, 4.5, '#5d4037', OUTLINE, 1.5, true, '#ffd740');
      }

      // Cesta 2 Lvl 1+: Koš s černými pumami u hnízda
      if (u1 >= 1 && mp.level < 5) {
        drawDisk(ctx, -14, 13, 5.5, '#6d4c41', OUTLINE, 1.6, true);
        drawDisk(ctx, -15, 12, 2.5, '#212121', OUTLINE, 1, false);
        drawDisk(ctx, -12, 14, 2.5, '#212121', OUTLINE, 1, false);
      }

      // Cesta 3 Lvl 2+: Barevný směrový praporek na hnízdě
      if (u2 >= 2) {
        drawBox(ctx, 13, -16, 2.5, 10, 1, '#5d4037', OUTLINE, 1.3, false);
        drawShape(ctx, c => {
          c.moveTo(15, -16); c.lineTo(24, -13); c.lineTo(15, -10); c.closePath();
        }, '#29b6f6', OUTLINE, 1.4, true);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);

      // Na hnízdě se otáčí směrový maják / muniční jeřáb / naváděcí arbalest
      if (mp.path === 2 && mp.level >= 3) {
        // C2 Lvl 3–5: Otočný muniční jeřáb nakládající pumy a obří sud se střelným prachem
        drawBox(ctx, -5, -2.8, 18, 5.6, 1.5, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
        drawDisk(ctx, -3, 0, 5.5, '#37474f', OUTLINE, 1.6, false, '#90a4ae');
        const bombCol = mp.level >= 4 ? '#ffb300' : '#212121';
        drawDisk(ctx, 12, 0, 5.2, bombCol, OUTLINE, 1.6, true, mp.level >= 4 ? '#ffff8d' : '#607d8b');
      } else if (mp.path === 1 && mp.level >= 3) {
        // C1 Lvl 3–5: Otočný raketový / nebeský krystalový maják uprostřed hnízda
        drawDisk(ctx, 0, 0, 6.5, '#ffb300', OUTLINE, 1.8, true, '#fff59d');
        drawGem(ctx, 2, 0, 4.2, '#00e5ff', '#ffffff', 6);
      } else if (mp.path === 3 && mp.level >= 3) {
        // C3 Lvl 3–5: Otočný naváděcí dalekohled a korouhev
        drawDisk(ctx, 0, 0, 6, '#455a64', OUTLINE, 1.7, true, '#90a4ae');
        drawBox(ctx, -2, -2, 13, 4, 1.2, '#ffd740', OUTLINE, 1.5, false, '#ffff8d');
      } else {
        // Základní směrová korouhev rytíře v hnízdě
        drawDisk(ctx, 0, 0, 4.5, '#ffb300', OUTLINE, 1.5, false, '#fff59d');
        drawShape(ctx, c => {
          c.moveTo(-4, -2); c.lineTo(10, 0); c.lineTo(-4, 2); c.closePath();
        }, '#cfd8dc', OUTLINE, 1.4, false);
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // VĚŽ 5: OBLÉHACÍ MOŽDÍŘ (oblehaci_mozdir, poloměr 24 px)
  // ============================================================================
  TDS.drawers.oblehaci_mozdir = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Pevnostní základna moždíře podle hlavní cesty
      if (mp.path === 1 && mp.level >= 4) {
        // C1 Lvl 4–5: Černo-žlutě pruhovaná baterie (Drsňák) / Černo-zlatý kolos s praskající zemí (Kladivo nebes)
        const isLvl5 = mp.level >= 5;
        drawShape(ctx, c => polyPath(c, 0, 0, 23.5, 8, PI / 8), '#212121', OUTLINE, 2.4, true);
        drawDisk(ctx, 0, 0, 18.5, isLvl5 ? '#ffb300' : '#37474f', OUTLINE, 1.8, false);
        // Výstražné žluté / zlaté patky po obvodu
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 2 + PI / 4);
          drawBox(ctx, 15, -4.5, 6.5, 9, 1.5, '#ffd740', OUTLINE, 1.5, false, '#ffff8d');
          ctx.restore();
        }
      } else if (mp.path === 2 && mp.level >= 4) {
        // C2 Lvl 4–5: Dělostřelecká baterie / Pán hromové palby (platinovo-zlatá pevnost)
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 23,
          isLvl5 ? '#eceff1' : '#546e7a',
          isLvl5 ? '#ffb300' : '#37474f',
          '#ffffff',
          72
        );
      } else if (mp.path === 3 && mp.level >= 4) {
        // C3 Lvl 4–5: Fialovo-zlatý runový kruh / Sopečná dračí baterie s lávovými puklinami
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 23,
          isLvl5 ? '#212121' : '#4a148c',
          isLvl5 ? '#d50000' : '#ffb300',
          isLvl5 ? '#ff6d00' : '#ea80fc',
          73
        );
      } else {
        // Standardní kamenně-dřevěné okopové postavení s pytli s pískem
        drawStoneCircleBase(ctx, 22.5, '#78909c', '#546e7a', '#b0bec5', 70);
        drawWoodDeckBase(ctx, 17, '#6d4c41', '#8d6e63', '#3e2723');
      }

      // 2. Doplňky úrovní 1–2 na základně
      // Cesta 1 Lvl 2+: Železné skoby zaražené po obvodu do země
      if (u0 >= 2 && mp.level < 4) {
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 2 + PI / 4);
          drawBox(ctx, 16, -2.5, 6, 5, 1, '#37474f', OUTLINE, 1.5, true, '#90a4ae');
          ctx.restore();
        }
      }

      // Cesta 1 Lvl 1+: Pyramida dělových koulí vedle moždíře
      if (u0 >= 1 || u1 >= 2 || u2 >= 2) {
        const ballR = u0 >= 1 ? 3.8 : 3.0;
        const ballCol = u2 >= 2 ? '#d84315' : '#263238';
        for (const [bx, by] of [[-14, 13], [-9, 15], [-12, 10]]) {
          drawDisk(ctx, bx, by, ballR, ballCol, OUTLINE, 1.4, true, u1 >= 2 ? '#ffd740' : '#78909c');
        }
      }

      // Cesta 2 Lvl 1+: Dřevěný skluz na koule a nabiják na tyči
      if (u1 >= 1 && mp.level < 4) {
        drawBox(ctx, -16, -15, 10, 5, 1, '#8d6e63', OUTLINE, 1.4, true);
      }

      // Cesta 3 Lvl 3: Bedna s jasně svítícími magickými světlicemi
      if (mp.path === 3 && mp.level === 3) {
        drawBox(ctx, -16, -15, 9, 7, 1.5, '#6d4c41', OUTLINE, 1.5, true);
        drawDisk(ctx, -13, -11.5, 2, '#ffff00', null, 0, false);
        drawDisk(ctx, -10, -11.5, 2, '#00e5ff', null, 0, false);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // CESTA 2 (Lvl 3–5): Vícehlavňové moždířové baterie
      if (mp.path === 2 && mp.level >= 3) {
        const isLvl5 = mp.level >= 5;
        const isLvl4 = mp.level === 4;
        const count = isLvl5 ? 4 : (isLvl4 ? 3 : 2);

        // Otočný ozubený věnec a pásový podavač
        drawDisk(ctx, -2, 0, 13, isLvl5 ? '#ffb300' : '#37474f', OUTLINE, 2, true, isLvl5 ? '#fff59d' : '#78909c');

        const offsets = count === 4 ? [-7.5, -2.5, 2.5, 7.5] : (count === 3 ? [-6, 0, 6] : [-4.5, 4.5]);
        for (const oy of offsets) {
          drawBox(ctx, -6, oy - 2.4, 19, 4.8, 1.5, isLvl5 ? '#eceff1' : '#455a64', OUTLINE, 1.6, true, '#ffffff');
          drawBox(ctx, 10, oy - 2.8, 3.5, 5.6, 1, isLvl5 ? '#00e5ff' : '#ffb300', OUTLINE, 1.3, false);
        }
        ctx.restore();
        return;
      }

      // CESTA 3 (Lvl 3–5): Světlice odhalení -> Rozbíječ pečetí -> Popelavý soud (Dračí sopečná tlama)
      if (mp.path === 3 && mp.level >= 3) {
        const isLvl5 = mp.level >= 5;
        const isLvl4 = mp.level === 4;
        const bodyCol = isLvl5 ? '#b71c1c' : (isLvl4 ? '#6a1b9a' : '#ffb300');
        const hiCol = isLvl5 ? '#ff8a80' : (isLvl4 ? '#ea80fc' : '#fff59d');
        const coreCol = isLvl5 ? '#ffea00' : (isLvl4 ? '#00e5ff' : '#ffffff');

        // Lafeta
        drawBox(ctx, -11, -10, 16, 20, 3, '#263238', OUTLINE, 2, true, '#546e7a');
        // Masivní runová/dračí hlaveň
        drawBox(ctx, -8, -8, 21, 16, 4, bodyCol, OUTLINE, 2.2, true, hiCol);

        if (isLvl5) {
          // Zlaté dračí rohy po stranách tlamy
          for (const side of [-1, 1]) {
            drawShape(ctx, c => {
              c.moveTo(2, side * 8); c.lineTo(-6, side * 14); c.lineTo(-2, side * 8); c.closePath();
            }, '#ffd740', OUTLINE, 1.5, false);
          }
        }

        // Široké žhnoucí ústí hlavně (+X)
        drawDisk(ctx, 9, 0, 6.8, '#212121', OUTLINE, 1.8, false);
        drawDisk(ctx, 9, 0, 4.5, coreCol, null, 0, false, '#ffffff');
        ctx.restore();
        return;
      }

      // ZÁKLADNÍ MOŽDÍŘ A CESTA 1 (Lvl 1–5: Větší ráže -> Otřesná vlna -> Drsňák -> Kladivo nebes)
      const isC1L5 = mp.path === 1 && mp.level >= 5;
      const isC1L4 = mp.path === 1 && mp.level === 4;
      const isC1L3 = mp.path === 1 && mp.level === 3;

      const barrelW = isC1L5 ? 19 : (isC1L4 ? 17 : (u0 >= 1 ? 14.5 : 12));
      const barrelCol = isC1L5 ? '#212121' : (isC1L3 || isC1L4 ? '#455a64' : '#37474f');
      const rimCol = isC1L5 ? '#ffd740' : (u2 >= 2 ? '#e53935' : (u0 >= 1 ? '#ffb300' : '#78909c'));

      // Boční lafeta a odpružené písty (C1 Lvl 3+)
      drawBox(ctx, -11, -barrelW * 0.65, 16, barrelW * 1.3, 2.5, '#5d4037', OUTLINE, 2, true, '#8d6e63');
      if (mp.path === 1 && mp.level >= 3) {
        drawBox(ctx, -6, -barrelW * 0.8, 12, 3.5, 1, '#ffd740', OUTLINE, 1.4, false);
        drawBox(ctx, -6, barrelW * 0.8 - 3.5, 12, 3.5, 1, '#ffd740', OUTLINE, 1.4, false);
      }

      // Cesta 3 Lvl 1+: Mosazný kvadrant na boku moždíře
      if (u2 >= 1) {
        drawBox(ctx, -3, -barrelW * 0.72, 6, 2.5, 0.8, '#ffd740', OUTLINE, 1.2, false);
      }

      // Hlavní válcový tubus moždíře mířící šikmo vzhůru doprava (+X)
      drawBox(ctx, -9, -barrelW * 0.5, 21, barrelW, 4, barrelCol, OUTLINE, 2.2, true, '#90a4ae');

      // Zesílená obruč ústí hlavně
      drawBox(ctx, 8, -barrelW * 0.56, 5.5, barrelW * 1.12, 2, rimCol, OUTLINE, 1.8, false, '#fff59d');

      // Tmavý vnitřek hlavně (nebo žhnoucí runové jádro u Kladiva nebes)
      drawDisk(ctx, 9.5, 0, barrelW * 0.34, '#111111', OUTLINE, 1.4, false);
      if (isC1L5) {
        drawDisk(ctx, 9.5, 0, barrelW * 0.2, '#ff6d00', null, 0, false, '#ffff00');
      }

      // C1 Lvl 3+: Symbol lebky / runy na hřbetu hlavně
      if (mp.path === 1 && mp.level >= 3) {
        drawDisk(ctx, -1, 0, 3.5, isC1L5 ? '#ffd740' : '#eceff1', OUTLINE, 1.2, false);
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // VĚŽ 6: TRPASLIČÍ INŽENÝR (trpaslici_inzenyr, poloměr 19 px)
  // ============================================================================
  TDS.drawers.trpaslici_inzenyr = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Podstavec podle hlavní cesty
      if (mp.path === 1 && mp.level >= 5) {
        // C1 Lvl 5: Pán parních automatů — Levitující zlatá plošina s fialovým energetickým prstencem
        drawDisk(ctx, 0, 0, 19, '#ffb300', OUTLINE, 2.2, true, '#fff59d');
        drawDisk(ctx, 0, 0, 14.5, '#311b92', OUTLINE, 1.6, false);
        ctx.strokeStyle = '#ea80fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11.5, 0, TAU);
        ctx.stroke();
      } else if (mp.path === 2 && mp.level >= 5) {
        // C2 Lvl 5: Ultrataktování — Technomág obklopený třemi zlatými elektrickými prstenci
        drawStoneCircleBase(ctx, 18.5, '#263238', '#37474f', '#78909c', 82);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15.5, 0, TAU);
        ctx.stroke();
      } else if (mp.path === 3 && mp.level >= 5) {
        // C3 Lvl 5: Požírač králů — Monumentální zlatá trpasličí slévárna
        drawShape(ctx, c => polyPath(c, 0, 0, 19.5, 8, PI / 8), '#ffb300', OUTLINE, 2.2, true);
        drawDisk(ctx, 0, 0, 15, '#263238', OUTLINE, 1.6, false, '#546e7a');
      } else {
        // Dílenská podlaha z kovových plátů a dřeva
        drawStoneCircleBase(ctx, 18, '#607d8b', '#455a64', '#b0bec5', 80);
      }

      // 2. Doplňky u nohou inženýra
      // Cesta 1 Lvl 1+: Červená brašna s nářadím u nohou
      if (u0 >= 1 && !(mp.path === 1 && mp.level >= 5)) {
        drawBox(ctx, -14, 10, 9, 6, 1.5, '#d32f2f', OUTLINE, 1.5, true, '#ff8a80');
        drawBox(ctx, -11, 10, 3, 6, 0.5, '#ffd740', OUTLINE, 1, false);
      }

      // Cesta 2 Lvl 3+: Sud s bublající bílou pěnou
      if (mp.path === 2 && mp.level >= 3) {
        drawDisk(ctx, -12, -11, 5.2, '#0288d1', OUTLINE, 1.6, true);
        drawDisk(ctx, -12, -11, 3.2, '#ffffff', null, 0, false);
      }

      // Cesta 3 Lvl 4+: Otevřená železno-zlatá mechanická truhla / jeřáb
      if (mp.path === 3 && mp.level >= 4) {
        drawBox(ctx, -15, -14, 9, 8, 1.5, '#ffb300', OUTLINE, 1.6, true, '#ffff8d');
        drawBox(ctx, -13.5, -12.5, 6, 5, 1, '#212121', OUTLINE, 1.2, false);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Batoh na zádech inženýra (-X): Parní kotlík (u0 >= 2) nebo Elektrická cívka (C2 Lvl 4+)
      if (mp.path === 2 && mp.level >= 4) {
        // Teslova cívka sršící modré blesky
        drawDisk(ctx, -9.5, 0, 5.5, '#37474f', OUTLINE, 1.8, true, '#90a4ae');
        drawDisk(ctx, -9.5, 0, 3, '#00e5ff', OUTLINE, 1.2, false, '#ffffff');
      } else if (u0 >= 2) {
        // Měděný parní kotlík s tlakoměrem
        drawBox(ctx, -12, -5.5, 6, 11, 2, '#d84315', OUTLINE, 1.6, true, '#ff8a65');
        drawDisk(ctx, -9, 0, 2.5, '#fff8e1', OUTLINE, 1.1, false);
      }

      // 2. Tělo a plášť trpasličího inženýra
      let coatCol = '#1565c0';
      let coatHi = '#42a5f5';
      if (mp.path === 1 && mp.level >= 4) { coatCol = '#283593'; coatHi = '#ffd740'; }
      if (mp.path === 2 && mp.level >= 5) { coatCol = '#00838f'; coatHi = '#84ffff'; }
      if (mp.path === 3 && mp.level >= 3) { coatCol = '#4e342e'; coatHi = '#8d6e63'; }

      drawShape(ctx, c => {
        c.moveTo(2, -8.5);
        c.quadraticCurveTo(-7, -10, -10, -6.5);
        c.lineTo(-8, 0);
        c.lineTo(-10, 6.5);
        c.quadraticCurveTo(-7, 10, 2, 8.5);
        c.closePath();
      }, coatCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(1, -6.5); c.lineTo(-7, -5); c.lineTo(-6, 0); c.closePath();
      }, coatHi);

      // Křížový nábojový pás přes hruď (C3 Lvl 3+)
      if (mp.path === 3 && mp.level >= 3) {
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-5, -6); ctx.lineTo(4, 6);
        ctx.moveTo(-5, 6); ctx.lineTo(4, -6);
        ctx.stroke();
      }

      // 3. Levá ruka (-Y): Francouzský klíč (u0 >= 1), Pěnová hadice (C2 Lvl 3), Ovladač (C2 Lvl 4+) nebo 2. hřebíkomet (C3 Lvl 3+)
      if (mp.path === 3 && mp.level >= 3) {
        // Druhý těžký hřebíkomet v levé ruce
        drawBox(ctx, 2, -10.5, 13, 4.5, 1.2, '#455a64', OUTLINE, 1.6, true, '#90a4ae');
        drawBox(ctx, 13, -11, 3, 5.5, 1, '#ffd740', OUTLINE, 1.3, false);
      } else if (mp.path === 2 && mp.level >= 4) {
        // Zlatý přetaktovávací ovladač s anténkou
        drawBox(ctx, 4, -10, 7, 5, 1.2, '#ffb300', OUTLINE, 1.5, true, '#ffff8d');
        drawDisk(ctx, 12, -7.5, 2.2, '#00e5ff', null, 0, false);
      } else if (mp.path === 2 && mp.level === 3) {
        // Mosazná hadice stříkající pěnu
        drawBox(ctx, 3, -10, 12, 3.8, 1.2, '#ffb300', OUTLINE, 1.5, true);
        drawDisk(ctx, 15, -8.1, 2.8, '#e1f5fe', OUTLINE, 1.2, false);
      } else if (u0 >= 1) {
        // Ocelový francouzský klíč
        drawBox(ctx, 3, -10, 9, 2.8, 1, '#b0bec5', OUTLINE, 1.4, true);
        drawShape(ctx, c => {
          c.arc(13, -8.6, 3.2, 0.5, TAU - 0.5);
        }, '#cfd8dc', OUTLINE, 1.4, false);
      }

      // 4. Pravá ruka (+Y): Hlavní parní hřebíkomet
      const gunCol = (mp.path === 1 && mp.level >= 3) ? '#ffb300' : (u2 >= 1 ? '#37474f' : '#607d8b');
      const gunLen = u2 >= 1 ? 15 : 13;
      drawBox(ctx, 2, 5.5, gunLen, 5, 1.5, gunCol, OUTLINE, 1.8, true, '#cfd8dc');
      // Hlavička připraveného hřebu v ústí
      drawBox(ctx, 2 + gunLen, 6.2, 2.8, 3.6, 0.8, u2 >= 2 ? '#ffd740' : '#eceff1', OUTLINE, 1.2, false);

      // 5. Hlava trpaslíka, plnovous a hornická přilba
      // Zrzavý / zlatý trpasličí plnovous vpředu (+X)
      drawShape(ctx, c => {
        c.moveTo(2, -5.5);
        c.quadraticCurveTo(9, -6, 10, 0);
        c.quadraticCurveTo(9, 6, 2, 5.5);
        c.closePath();
      }, (mp.path === 1 && mp.level >= 5) ? '#fff59d' : '#d84315', OUTLINE, 1.5, false);

      // Žlutá/zlatá inženýrská přilba s ochrannými brýlemi
      const helmCol = (mp.path === 1 && mp.level >= 4) ? '#ffd740' : '#fdd835';
      drawDisk(ctx, 0, 0, 6.2, helmCol, OUTLINE, 1.8, true, '#ffff8d');

      // Ochranné brýle na čele přilby
      drawBox(ctx, 3.2, -4.5, 2.8, 3.8, 1, '#29b6f6', OUTLINE, 1.2, false, '#e1f5fe');
      drawBox(ctx, 3.2, 0.7, 2.8, 3.8, 1, '#29b6f6', OUTLINE, 1.2, false, '#e1f5fe');

      // Cesta 2 Lvl 1+: Výsuvná mosazná anténa s čočkou na přilbě
      if (u1 >= 1) {
        drawBox(ctx, -2, -8.5, 5, 2.2, 0.8, '#ffb300', OUTLINE, 1.2, false);
        drawDisk(ctx, 3.5, -7.4, 2, '#00e676', OUTLINE, 1.1, false, '#ffffff');
      }

      ctx.restore();
    }
  };
})();

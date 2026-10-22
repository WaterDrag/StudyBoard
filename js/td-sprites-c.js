/**
 * Obrana království - Kreslící knihovna (Část C: věže 6–10 a hrdinové) — vylepšené textury
 * Od Gemini; kreslíře věží a hrdinů + na konci společné API (TDS.tower, TDS.hero, ikony).
 */
/**
 * Obrana království - Kreslící knihovna (Část C: věže 6–10 a hrdinové)
 * Všechny věže 6–10 (ricni_galera, arkanni_carodej, kralovsky_alchymista, strazni_hlaska, zlaty_dul)
 * a všichni 3 hrdinové (lovec_bedrich, carodejka_radka, kronikar_oskar) mají kompletně vylepšené textury.
 * Všechny pomocné funkce jsou lokální v uzávěru, do TDS se přidává pouze TDS.drawers a TDS.heroDrawers.
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});

  // Lokální konstanty stylu
  const OUTLINE = '#111111';
  const LINE_WIDTH = 2;
  const SHADOW_COL = 'rgba(10, 15, 8, 0.28)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // ============================================================================
  // LOKÁLNÍ POMOCNÉ FUNKCE (Náhoda, Tvary, Stíny, Odlesky, Materiály)
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
    let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
    return result / 4294967296;
  }

  /**
   * Vlastní zaoblený obdélník (náhrada za ctx.roundRect)
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
      drawHighlight(ctx, c => c.arc(x - r * 0.22, y - r * 0.22, r * 0.62, 0, TAU), hiFill);
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

  function drawStarShape(ctx, x, y, rOuter, rInner, points, fill, stroke = OUTLINE, lw = 1.5) {
    drawShape(ctx, c => {
      for (let i = 0; i < points * 2; i++) {
        const a = (i * PI) / points;
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
    drawHighlight(ctx, c => c.arc(-r * 0.12, -r * 0.12, r * 0.78, 0, TAU), hiCol);

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
    ctx.strokeStyle = 'rgba(17,17,17,0.42)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, -r * 0.1);
    ctx.lineTo(0, r * 0.06);
    ctx.lineTo(r * 0.24, -r * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Nakreslí skleněnou alchymistickou baňku s barevnou tekutinou, bublinkami a odleskem
   */
  function drawPotionFlask(ctx, x, y, r, liqCol, liqHi, hasClaw = false, hasMiniSlime = false) {
    drawBox(ctx, x - r * 0.38, y - r * 1.32, r * 0.76, r * 0.5, 1, '#a1887f', OUTLINE, 1.3, false);
    drawDisk(ctx, x, y, r, 'rgba(225, 245, 254, 0.88)', OUTLINE, 1.6, true);
    drawHighlight(ctx, c => {
      c.arc(x, y, r * 0.78, -0.15, PI + 0.15);
      c.closePath();
    }, liqCol);
    drawHighlight(ctx, c => {
      c.ellipse(x, y - r * 0.08, r * 0.72, r * 0.26, 0, 0, TAU);
    }, liqHi);

    if (hasClaw) {
      ctx.save();
      ctx.strokeStyle = '#ff1744';
      ctx.lineWidth = 1.3;
      for (let d = -1; d <= 1; d++) {
        ctx.beginPath();
        ctx.moveTo(x + d * 1.8 - 1, y - 2);
        ctx.lineTo(x + d * 1.8 + 1, y + 2.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (hasMiniSlime) {
      drawDisk(ctx, x, y + 0.8, r * 0.52, '#00e676', OUTLINE, 1.2, false, '#b9f6ca');
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(x + 0.8, y - 0.2, 0.9, 0, TAU);
      ctx.arc(x + 0.8, y + 1.6, 0.9, 0, TAU);
      ctx.fill();
    }

    drawHighlight(ctx, c => c.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU), '#ffffff');
  }

  /**
   * Nakreslí dřevěnou nebo okovanou truhlu se zlatem
   */
  function drawTreasureChest(ctx, x, y, w, h, isOpen = false) {
    drawBox(ctx, x - w * 0.5, y - h * 0.5, w, h, 1.5, '#6d4c41', OUTLINE, 1.5, true, '#8d6e63');
    // Zlaté kování po stranách
    drawBox(ctx, x - w * 0.35, y - h * 0.5, w * 0.18, h, 0.5, '#ffb300', OUTLINE, 1.1, false);
    drawBox(ctx, x + w * 0.17, y - h * 0.5, w * 0.18, h, 0.5, '#ffb300', OUTLINE, 1.1, false);
    if (isOpen) {
      drawHighlight(ctx, c => c.ellipse(x, y, w * 0.35, h * 0.28, 0, 0, TAU), '#ffd740');
    } else {
      drawDisk(ctx, x, y, 1.5, '#ffd740', OUTLINE, 1, false);
    }
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
  // VYKRESLOVÁNÍ VĚŽÍ 6 - 10
  // ============================================================================
  TDS.drawers = TDS.drawers || {};

  // ============================================================================
  // 6. ŘÍČNÍ GALÉRA (ricni_galera, poloměr 19 px, loď na vodě)
  // ============================================================================
  TDS.drawers.ricni_galera = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      const isSunWater = mp.path === 1 && mp.level >= 4;
      const isTempleShip = mp.path === 1 && mp.level >= 5;
      ctx.save();
      ctx.strokeStyle = isSunWater ? 'rgba(255, 215, 64, 0.85)' : 'rgba(225, 245, 254, 0.65)';
      ctx.lineWidth = isSunWater ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.ellipse(-1, 0, 26, 16.5, 0, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-2, 0, 25, 16, PI, -0.6, 0.6);
      ctx.stroke();
      if (isSunWater) {
        drawHighlight(ctx, c => c.ellipse(0, 0, 26, 17, 0, 0, TAU), 'rgba(255, 235, 59, 0.25)');
      }
      ctx.restore();

      // Cesta 3 Lvl 1+: Dvojitá vesla po obou bocích lodi
      if (u2 >= 1) {
        const oarCount = (mp.path === 3 && mp.level >= 4) ? 5 : 4;
        const oarBladeCol = (mp.path === 3 && mp.level >= 4) ? '#ffd54f' : '#d7ccc8';
        for (let i = 0; i < oarCount; i++) {
          const ox = -13 + i * (22 / (oarCount - 1));
          for (const side of [-1, 1]) {
            ctx.save();
            ctx.strokeStyle = OUTLINE;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(ox, side * 9);
            ctx.lineTo(ox - 5, side * 18.5);
            ctx.stroke();

            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            drawShape(ctx, c => {
              c.ellipse(ox - 5.5, side * 19, 2.8, 1.5, side * -0.4, 0, TAU);
            }, oarBladeCol, OUTLINE, 1.3, false);
            ctx.restore();
          }
        }
      }

      // Cesta 1 Lvl 3+: Spuštěná železná/zlatá kotva na řetězu u přídě
      if (mp.path === 1 && mp.level >= 3) {
        ctx.save();
        ctx.translate(14, 14);
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(0, 0);
        ctx.stroke();
        const ancCol = mp.level >= 4 ? '#ffd54f' : '#78909c';
        drawShape(ctx, c => {
          c.moveTo(-4, 2);
          c.quadraticCurveTo(0, 6, 4, 2);
          c.lineTo(5, 0);
          c.lineTo(0, 3.5);
          c.lineTo(-5, 0);
          c.closePath();
        }, ancCol, OUTLINE, 1.5, true);
        drawBox(ctx, -1, -3, 2, 7, 0.5, ancCol, OUTLINE, 1.3, false);
        ctx.restore();
      }

      let hullCol = '#795548';
      let hullHi = '#a1887f';
      let deckCol = '#8d6e63';
      let deckHi = '#bcaaa4';
      let railCol = '#4e342e';

      if (isTempleShip) {
        hullCol = '#fff8e1'; hullHi = '#ffffff';
        deckCol = '#ffe082'; deckHi = '#fff59d';
        railCol = '#ffb300';
      } else if (mp.path === 1 && mp.level === 4) {
        hullCol = '#8d6e63'; hullHi = '#d7ccc8';
        deckCol = '#a1887f'; railCol = '#ffb300';
      } else if (mp.path === 2 && mp.level >= 4) {
        hullCol = '#263238'; hullHi = '#455a64';
        deckCol = '#b71c1c'; deckHi = '#e53935';
        railCol = mp.level >= 5 ? '#ffb300' : '#d32f2f';
      } else if (u1 >= 2) {
        hullCol = '#c62828'; hullHi = '#ef5350';
        deckCol = '#6d4c41'; deckHi = '#8d6e63';
        railCol = '#ffb300';
      } else if (mp.path === 3 && mp.level >= 4) {
        hullCol = mp.level >= 5 ? '#1565c0' : '#4e342e';
        hullHi = mp.level >= 5 ? '#42a5f5' : '#795548';
        deckCol = '#8d6e63'; deckHi = '#bcaaa4';
        railCol = '#ffb300';
      }

      const hullPath = c => {
        c.moveTo(-22, -10.5);
        c.quadraticCurveTo(2, -15.5, 25, 0);
        c.quadraticCurveTo(2, 15.5, -22, 10.5);
        c.lineTo(-25, 0);
        c.closePath();
      };
      drawShape(ctx, hullPath, railCol, OUTLINE, 2.3, true, 3, 3.5);

      drawShape(ctx, c => {
        c.moveTo(-19.5, -8.5);
        c.quadraticCurveTo(1, -12.5, 20.5, 0);
        c.quadraticCurveTo(1, 12.5, -19.5, 8.5);
        c.lineTo(-21.5, 0);
        c.closePath();
      }, hullCol, OUTLINE, 1.6, false);

      drawShape(ctx, c => {
        c.moveTo(-16.5, -6.5);
        c.quadraticCurveTo(0, -9.5, 15, 0);
        c.quadraticCurveTo(0, 9.5, -16.5, 6.5);
        c.closePath();
      }, deckCol, OUTLINE, 1.5, false);

      drawHighlight(ctx, c => {
        c.moveTo(-15, -5.5);
        c.quadraticCurveTo(-1, -8, 12, -1);
        c.lineTo(-15, -1);
        c.closePath();
      }, deckHi);

      ctx.strokeStyle = 'rgba(17,17,17,0.35)';
      ctx.lineWidth = 1.2;
      for (let py = -4; py <= 4; py += 4) {
        ctx.beginPath();
        ctx.moveTo(-15, py);
        ctx.lineTo(10, py * 0.6);
        ctx.stroke();
      }

      drawBox(ctx, -23, -8.5, 6.5, 17, 2, hullCol, OUTLINE, 1.8, false, hullHi);

      if (u0 >= 2) {
        ctx.save();
        ctx.translate(16, -4);
        ctx.rotate(-0.2);
        drawBox(ctx, -3, -1.5, 7, 3, 1, '#ffb300', OUTLINE, 1.3, false, '#fff176');
        drawDisk(ctx, 4, 0, 1.4, '#80d8ff', OUTLINE, 1, false);
        ctx.restore();
      }

      if (mp.path === 2 && mp.level >= 5) {
        for (const cx of [-7, 4]) {
          for (const side of [-1, 1]) {
            drawBox(ctx, cx - 2, side * 11 - 2, 4, 4, 1, '#ffb300', OUTLINE, 1.4, false, '#fff176');
          }
        }
        drawShape(ctx, c => {
          c.moveTo(21, -4.5);
          c.lineTo(29, -2.5);
          c.lineTo(31, 0);
          c.lineTo(29, 2.5);
          c.lineTo(21, 4.5);
          c.closePath();
        }, '#ffb300', OUTLINE, 1.7, true);
        drawHighlight(ctx, c => c.rect(22, -2.5, 6, 2), '#fff59d');
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(25, -2.2, 1.6, 1.4);
        ctx.fillRect(25, 0.8, 1.6, 1.4);
      } else {
        drawShape(ctx, c => {
          c.moveTo(22, -2.5);
          c.lineTo(27.5, 0);
          c.lineTo(22, 2.5);
          c.closePath();
        }, (mp.path === 3 && mp.level >= 4) || isTempleShip ? '#ffb300' : '#90a4ae', OUTLINE, 1.5, false);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;
      const state = s || {};

      if (mp.path === 1) {
        const isLighthouse = state.mode === 'lighthouse' || mp.level >= 3;

        if (isLighthouse) {
          ctx.save();
          ctx.fillStyle = mp.level >= 4 ? 'rgba(255, 215, 64, 0.42)' : 'rgba(255, 241, 118, 0.35)';
          ctx.beginPath();
          ctx.moveTo(2, -4);
          ctx.lineTo(35, -18);
          ctx.arc(0, 0, 39, -0.48, 0.48);
          ctx.lineTo(2, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        if (mp.level >= 5) {
          drawDisk(ctx, 0, 0, 15.5, 'rgba(255, 248, 225, 0.82)', '#ffb300', 2, true, '#ffffff');
          ctx.strokeStyle = '#ffca28';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 4; i++) {
            const a = (i * PI) / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * -14, Math.sin(a) * -14);
            ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
            ctx.stroke();
          }
          drawGem(ctx, 0, 0, 6, '#00e5ff', '#ffffff', 8);
        } else {
          drawDisk(ctx, 0, 0, 10.5, '#8d6e63', OUTLINE, 2, true, '#bcaaa4');
          drawDisk(ctx, 0, 0, 7.5, '#5d4037', OUTLINE, 1.5, false);
          drawDisk(ctx, 0, 0, 4.5, '#4e342e', OUTLINE, 1.6, false, '#795548');

          if (mp.level >= 3) {
            drawShape(ctx, c => polyPath(c, 0, 0, 7.5, 6, 0), '#ffb300', OUTLINE, 1.8, false);
            drawDisk(ctx, 0, 0, 4.8, mp.level >= 4 ? '#ffff00' : '#fff59d', OUTLINE, 1.2, false, '#ffffff');
            if (mp.level >= 4) {
              ctx.strokeStyle = '#ffab00';
              ctx.lineWidth = 2;
              for (let i = 0; i < 8; i++) {
                const a = (i * PI) / 4;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
                ctx.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5);
                ctx.stroke();
              }
            }
          }
        }

        if (mp.level >= 2) {
          for (const dPos of [[-9, -11, -0.5], [10, 10, 2.4]]) {
            ctx.save();
            ctx.translate(dPos[0], dPos[1]);
            ctx.rotate(dPos[2]);
            drawShape(ctx, c => {
              c.moveTo(0, -4.5);
              c.quadraticCurveTo(-3, 0, 0, 4.5);
              c.quadraticCurveTo(3.5, 0, 0, -4.5);
              c.closePath();
            }, '#ffffff', OUTLINE, 1.3, true);
            ctx.restore();
          }
        }

        ctx.restore();
        return;
      }

      if (mp.path === 2) {
        if (mp.level >= 3) {
          const isLvl4 = mp.level >= 4;
          const isLvl5 = mp.level >= 5;

          drawDisk(ctx, -1, 0, 10.5, isLvl5 ? '#263238' : '#5d4037', OUTLINE, 2, true, isLvl5 ? '#546e7a' : '#8d6e63');

          const barrelCol = isLvl5 ? '#ffb300' : (isLvl4 ? '#212121' : '#455a64');
          const barrelHi = isLvl5 ? '#fff176' : (isLvl4 ? '#616161' : '#90a4ae');
          const trimCol = isLvl5 ? '#fff59d' : (isLvl4 ? '#d32f2f' : '#ffca28');

          const bLen = isLvl4 ? 21 : 16;
          const bW = isLvl4 ? 11 : 12.5;
          drawBox(ctx, -7, -bW * 0.5, bLen, bW, 2.5, barrelCol, OUTLINE, 2.2, true, barrelHi);

          drawBox(ctx, -2, -bW * 0.5 - 0.8, 3.5, bW + 1.6, 1, trimCol, OUTLINE, 1.5, false);
          drawBox(ctx, bLen - 9, -bW * 0.5 - 1.2, 4.5, bW + 2.4, 1.2, trimCol, OUTLINE, 1.6, false);

          drawDisk(ctx, bLen - 5.5, 0, bW * 0.35, '#111111', OUTLINE, 1.4, false);

          if (isLvl5) {
            drawGem(ctx, -3, 0, 3.2, '#d50000', '#ff8a80', 6);
          }
        } else {
          drawDisk(ctx, 0, 0, 7.5, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
          drawShape(ctx, c => {
            c.moveTo(6, -11);
            c.quadraticCurveTo(13, 0, 6, 11);
            c.lineTo(3.5, 9.5);
            c.quadraticCurveTo(9, 0, 3.5, -9.5);
            c.closePath();
          }, '#78909c', OUTLINE, 1.8, true);

          drawBox(ctx, -5, -2.5, 16, 5, 1.2, '#455a64', OUTLINE, 1.6, false, '#90a4ae');
          const isFire = mp.level >= 2;
          drawShape(ctx, c => {
            c.moveTo(11, -4.5);
            c.lineTo(22, 0);
            c.lineTo(11, 4.5);
            c.lineTo(13.5, 0);
            c.closePath();
          }, isFire ? '#ff3d00' : '#cfd8dc', OUTLINE, 1.5, false);
          if (isFire) {
            drawHighlight(ctx, c => c.arc(15, 0, 2.5, 0, TAU), '#ffea00');
          }
        }

        ctx.restore();
        return;
      }

      if (mp.path === 3 && mp.level >= 3) {
        const isLvl4 = mp.level >= 4;
        const isLvl5 = mp.level >= 5;

        const towerCol = isLvl5 ? '#1565c0' : (isLvl4 ? '#5d4037' : '#6d4c41');
        const trimCol = isLvl4 ? '#ffb300' : '#8d6e63';
        drawBox(ctx, -9, -10, 17, 20, 3, towerCol, OUTLINE, 2, true, trimCol);

        for (const sy of [-6, 0, 6]) {
          drawBox(ctx, 5, sy - 1.6, 11, 3.2, 0.8, isLvl4 ? '#ffb300' : '#455a64', OUTLINE, 1.4, false);
          drawShape(ctx, c => {
            c.moveTo(15, sy - 2.6);
            c.lineTo(23, sy);
            c.lineTo(15, sy + 2.6);
            c.closePath();
          }, isLvl4 ? '#ffffff' : '#cfd8dc', OUTLINE, 1.3, false);
        }

        if (isLvl5) {
          drawShape(ctx, c => {
            c.moveTo(-2, -16);
            c.quadraticCurveTo(10, 0, -2, 16);
            c.quadraticCurveTo(3, 0, -2, -16);
            c.closePath();
          }, '#1e88e5', OUTLINE, 2, true);
          ctx.strokeStyle = '#ffd54f';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          drawShape(ctx, c => {
            c.moveTo(0, -4);
            c.lineTo(5, -5.5);
            c.lineTo(3, 0);
            c.lineTo(5, 5.5);
            c.lineTo(0, 4);
            c.closePath();
          }, '#ffd740', OUTLINE, 1.3, false);
        }

        ctx.restore();
        return;
      }

      drawDisk(ctx, -2, 0, 7, u0 >= 1 ? '#8d6e63' : '#5d4037', OUTLINE, 1.8, true, '#a1887f');

      if (u2 >= 2) {
        for (const by of [-5.5, 5.5]) {
          drawBox(ctx, -1, by - 1.8, 13, 3.6, 1, '#6d4c41', OUTLINE, 1.4, false);
          drawShape(ctx, c => {
            c.moveTo(9, by - 5);
            c.quadraticCurveTo(14, by, 9, by + 5);
          }, null, '#8d6e63', 2.2, false);
          drawShape(ctx, c => {
            c.moveTo(11, by - 2);
            c.lineTo(18, by);
            c.lineTo(11, by + 2);
            c.closePath();
          }, '#cfd8dc', OUTLINE, 1.2, false);
        }
      } else if (u1 >= 1) {
        drawBox(ctx, -1, -2.5, 15, 5, 1, '#546e7a', OUTLINE, 1.6, false, '#90a4ae');
        drawShape(ctx, c => {
          c.moveTo(13, -4);
          c.lineTo(21, 0);
          c.lineTo(13, 4);
          c.closePath();
        }, u1 >= 2 ? '#ff3d00' : '#cfd8dc', OUTLINE, 1.4, false);
      } else {
        drawBox(ctx, -1, -2.5, 13, 5, 1.2, '#795548', OUTLINE, 1.6, false, '#a1887f');
        drawShape(ctx, c => {
          c.moveTo(8, -7.5);
          c.quadraticCurveTo(14, 0, 8, 7.5);
        }, null, '#90a4ae', 2.4, false);
        drawShape(ctx, c => {
          c.moveTo(11, -2.5);
          c.lineTo(18, 0);
          c.lineTo(11, 2.5);
          c.closePath();
        }, '#eceff1', OUTLINE, 1.3, false);
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 7. ARKÁNNÍ ČARODĚJ (arkanni_carodej, poloměr 20 px)
  // ============================================================================
  TDS.drawers.arkanni_carodej = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      if (mp.path === 3 && mp.level >= 4) {
        const isKing = mp.level >= 5;
        drawStoneCircleBase(ctx, 19.5, '#212121', '#111111', '#424242', 75);

        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15.5, 0, TAU);
        ctx.stroke();

        if (isKing) {
          drawBox(ctx, -14, -13, 12, 26, 2.5, '#263238', OUTLINE, 2, true, '#455a64');
          drawBox(ctx, -15, -14, 5, 6, 1, '#00e676', OUTLINE, 1.4, false);
          drawBox(ctx, -15, 8, 5, 6, 1, '#00e676', OUTLINE, 1.4, false);

          for (let i = 0; i < 3; i++) {
            const ga = (i * TAU) / 3 + 0.5;
            const gx = Math.cos(ga) * 17;
            const gy = Math.sin(ga) * 17;
            drawDisk(ctx, gx, gy, 3.8, 'rgba(0, 230, 118, 0.78)', OUTLINE, 1.3, false, '#b9f6ca');
          }
        }
      } else if (mp.path === 2 && mp.level >= 5) {
        drawStoneCircleBase(ctx, 20, '#5d4037', '#ffb300', '#ffe082', 72);
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 4);
          drawShape(ctx, c => {
            c.moveTo(11, -3);
            c.lineTo(19, 0);
            c.lineTo(11, 3);
            c.closePath();
          }, '#ff6d00', OUTLINE, 1.4, false);
          ctx.restore();
        }
        drawDisk(ctx, 0, 0, 11.5, '#ffb300', OUTLINE, 1.8, false, '#fff59d');
      } else {
        const isArcaneMaster = mp.path === 1 && mp.level >= 4;
        drawStoneCircleBase(
          ctx, 18.5,
          isArcaneMaster ? '#4a148c' : '#78909c',
          isArcaneMaster ? '#ffb300' : '#546e7a',
          isArcaneMaster ? '#ba68c8' : '#b0bec5',
          71
        );

        if (u2 >= 1) {
          ctx.strokeStyle = '#69f0ae';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(0, 0, 14.5, 0, TAU);
          ctx.stroke();
        }

        if (u1 >= 2 && mp.path !== 3) {
          ctx.strokeStyle = '#ff6d00';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(0, 0, 13.5, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (u0 >= 2) {
          const isGoldRings = mp.path === 1 && mp.level >= 4;
          ctx.strokeStyle = isGoldRings ? '#ffd740' : '#e040fb';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(0, 0, 20.5, 15, 0.35, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, 0, 20.5, 15, -0.35, 0, TAU);
          ctx.stroke();
          if (isGoldRings) {
            ctx.strokeStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(0, 0, 21.5, 0, TAU);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      if (mp.path === 2 && mp.level >= 5) {
        drawShape(ctx, c => {
          c.moveTo(4, 0);
          c.quadraticCurveTo(-4, -20, -14, -22);
          c.quadraticCurveTo(-8, -9, -12, -3);
          c.lineTo(-22, 0);
          c.lineTo(-12, 3);
          c.quadraticCurveTo(-8, 9, -14, 22);
          c.quadraticCurveTo(-4, 20, 4, 0);
          c.closePath();
        }, '#ff3d00', OUTLINE, 2, true);

        drawHighlight(ctx, c => {
          c.moveTo(3, 0);
          c.quadraticCurveTo(-2, -13, -9, -15);
          c.lineTo(-7, 0);
          c.lineTo(-9, 15);
          c.quadraticCurveTo(-2, 13, 3, 0);
          c.closePath();
        }, '#ffea00');

        drawDisk(ctx, 5, 0, 5.5, '#ff9100', OUTLINE, 1.8, false, '#ffff00');
        drawShape(ctx, c => {
          c.moveTo(9.5, -2.2);
          c.lineTo(15, 0);
          c.lineTo(9.5, 2.2);
          c.closePath();
        }, '#ffd740', OUTLINE, 1.4, false);

        ctx.restore();
        return;
      }

      if (mp.path === 2 && mp.level === 4) {
        for (const side of [-1, 1]) {
          drawShape(ctx, c => {
            c.moveTo(0, side * 5);
            c.quadraticCurveTo(-8, side * 19, -16, side * 16);
            c.quadraticCurveTo(-10, side * 8, -4, side * 4);
            c.closePath();
          }, '#ff6d00', OUTLINE, 1.7, true);
          drawHighlight(ctx, c => {
            c.moveTo(-1, side * 6);
            c.quadraticCurveTo(-7, side * 14, -12, side * 12);
            c.closePath();
          }, '#ffea00');
        }
      }

      if (mp.path === 1 && mp.level >= 5) {
        for (const bPos of [[-12, -12, -0.4], [-12, 12, 0.4]]) {
          ctx.save();
          ctx.translate(bPos[0], bPos[1]);
          ctx.rotate(bPos[2]);
          drawBox(ctx, -4.5, -5.5, 9, 11, 1.2, '#6a1b9a', OUTLINE, 1.5, true);
          drawBox(ctx, -3, -4.2, 6, 8.4, 0.5, '#fff9c4', OUTLINE, 1, false);
          ctx.restore();
        }
      }

      let robeCol = '#6a1b9a';
      let robeHi = '#9c27b0';
      let trimCol = u1 >= 2 ? '#ff3d00' : '#ffd54f';

      if (mp.path === 1 && mp.level === 4) { robeCol = '#ffb300'; robeHi = '#ffe082'; trimCol = '#aa00ff'; }
      if (mp.path === 1 && mp.level >= 5) { robeCol = '#4a148c'; robeHi = '#7b1fa2'; trimCol = '#ffd740'; }
      if (mp.path === 2 && mp.level >= 3) { robeCol = '#b71c1c'; robeHi = '#e53935'; trimCol = '#ffb300'; }
      if (mp.path === 3 && mp.level >= 4) { robeCol = '#1b5e20'; robeHi = '#2e7d32'; trimCol = '#00e676'; }
      if (mp.path === 3 && mp.level >= 5) { robeCol = '#111111'; robeHi = '#37474f'; trimCol = '#00e676'; }

      drawShape(ctx, c => {
        c.moveTo(3, -9.5);
        c.quadraticCurveTo(-7, -12, -13, -8.5);
        c.lineTo(-10.5, 0);
        c.lineTo(-13, 8.5);
        c.quadraticCurveTo(-7, 12, 3, 9.5);
        c.closePath();
      }, robeCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(2, -7.5);
        c.quadraticCurveTo(-6, -9.5, -11, -6.5);
        c.lineTo(-9, 0);
        c.lineTo(1, -2);
        c.closePath();
      }, robeHi);

      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-12.5, -8);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-12.5, 8);
      ctx.stroke();

      if (mp.path === 3 && mp.level >= 3) {
        drawHighlight(ctx, c => c.arc(9, 9.5, 8, 0, TAU), 'rgba(224, 64, 251, 0.32)');
        drawBox(ctx, 6, 6.5, 6, 6, 1.2, '#ffb300', OUTLINE, 1.5, true, '#fff59d');
        drawDisk(ctx, 9, 9.5, 2.2, '#ea80fc', null, 0, false);
      } else if (u1 >= 1) {
        drawDisk(ctx, 8, 9.5, 4.8, '#ff3d00', OUTLINE, 1.5, true);
        drawDisk(ctx, 7.5, 9, 2.8, '#ffea00', null, 0, false);
      }

      const staffCol = (mp.path === 3 && mp.level >= 4) ? '#263238' : '#5d4037';
      drawBox(ctx, 2, -10, 17, 3.2, 1.2, staffCol, OUTLINE, 1.6, true);

      if (mp.path === 3 && mp.level >= 4) {
        drawDisk(ctx, 20.5, -8.4, 4.5, '#eceff1', OUTLINE, 1.6, true, '#ffffff');
        drawBox(ctx, 22, -10.4, 3, 4, 0.8, '#cfd8dc', OUTLINE, 1.3, false);
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(21.5, -10, 1.5, 0, TAU);
        ctx.arc(21.5, -6.8, 1.5, 0, TAU);
        ctx.fill();
      } else if (mp.path === 1 && mp.level >= 3) {
        drawGem(ctx, 21, -8.4, 5.5, '#d500f9', '#f3e5f5', 6);
        ctx.strokeStyle = '#80d8ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(21, -14); ctx.lineTo(25, -17); ctx.lineTo(23, -11);
        ctx.moveTo(25, -8); ctx.lineTo(29, -5);
        ctx.stroke();
      } else {
        const orbR = u0 >= 1 ? 4.8 : 3.8;
        drawDisk(ctx, 20, -8.4, orbR, '#ab47bc', OUTLINE, 1.6, true, '#f3e5f5');
      }

      if (mp.path === 2 && mp.level >= 3) {
        drawShape(ctx, c => {
          c.moveTo(-5, -7);
          c.lineTo(9, -4);
          c.lineTo(12, 0);
          c.lineTo(9, 4);
          c.lineTo(-5, 7);
          c.lineTo(-3, 0);
          c.closePath();
        }, '#ffb300', OUTLINE, 1.8, true);
        drawHighlight(ctx, c => c.rect(-2, -4, 8, 3), '#fff59d');
        drawDisk(ctx, 13.5, 0, 3, '#ff3d00', OUTLINE, 1.2, false, '#ffea00');
      } else if (mp.path === 3 && mp.level >= 5) {
        drawDisk(ctx, 0, 0, 7, '#263238', OUTLINE, 1.8, true);
        drawShape(ctx, c => {
          c.moveTo(-2, -6);
          c.lineTo(6, -7.5);
          c.lineTo(3, 0);
          c.lineTo(6, 7.5);
          c.lineTo(-2, 6);
          c.closePath();
        }, '#00e676', OUTLINE, 1.5, false);
      } else {
        const hatCol = (mp.path === 1 && mp.level >= 5) ? '#ffd54f' : robeCol;
        const hatHi = (mp.path === 1 && mp.level >= 5) ? '#ffffff' : robeHi;
        drawDisk(ctx, 0, 0, 8.5, hatCol, OUTLINE, 1.8, true, hatHi);
        drawShape(ctx, c => {
          c.moveTo(3, -5.5);
          c.lineTo(-13, 0);
          c.lineTo(3, 5.5);
          c.closePath();
        }, hatCol, OUTLINE, 1.8, false);

        if (u2 >= 2) {
          drawGem(ctx, 5, 0, 3, '#00e676', '#b9f6ca', 6);
        }
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 8. KRÁLOVSKÝ ALCHYMISTA (kralovsky_alchymista, poloměr 19 px)
  // ============================================================================
  TDS.drawers.kralovsky_alchymista = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      const isCrystalShrine = mp.path === 1 && mp.level >= 5;
      const isGoldTower = mp.path === 3 && mp.level >= 4;
      const isMirrorLab = mp.path === 2 && mp.level >= 5;

      drawStoneCircleBase(
        ctx, 18.5,
        isCrystalShrine ? '#e0f7fa' : (isGoldTower ? '#ffd54f' : (isMirrorLab ? '#311b92' : '#78909c')),
        isCrystalShrine ? '#80deea' : (isGoldTower ? '#ffb300' : (isMirrorLab ? '#4a148c' : '#546e7a')),
        isCrystalShrine ? '#ffffff' : (isGoldTower ? '#fff9c4' : '#b0bec5'),
        81
      );

      if (u2 >= 2) {
        for (const pPos of [[14, -10, 4.5], [12, 12, 4], [-13, 12, 3.5]]) {
          drawDisk(ctx, pPos[0], pPos[1], pPos[2], '#76ff03', OUTLINE, 1.3, false, '#ccff90');
        }
      }

      if (isCrystalShrine) {
        drawShape(ctx, c => polyPath(c, -9, 0, 8.5, 6, 0), '#80deea', OUTLINE, 1.8, true);
        drawDisk(ctx, -9, 0, 6, '#ffd740', OUTLINE, 1.4, false, '#ffff00');
        drawGem(ctx, -9, 0, 4, '#ff1744', '#ff8a80', 6);
      } else if (isMirrorLab) {
        for (let i = 0; i < 5; i++) {
          const a = PI * 0.55 + (i * PI * 0.9) / 4;
          ctx.save();
          ctx.translate(Math.cos(a) * 14.5, Math.sin(a) * 14.5);
          ctx.rotate(a);
          drawBox(ctx, -2, -4.5, 4, 9, 1.2, '#ffb300', OUTLINE, 1.5, true);
          drawBox(ctx, -1, -3.5, 2.2, 7, 0.8, '#e040fb', null, 0, false, '#f3e5f5');
          ctx.restore();
        }
      } else {
        const tableCol = isGoldTower ? '#ffb300' : '#6d4c41';
        const tableHi = isGoldTower ? '#ffe082' : '#8d6e63';
        drawBox(ctx, -16, -11, 11, 22, 2.5, tableCol, OUTLINE, 2, true, tableHi);

        if (mp.path === 1 && mp.level === 4) {
          drawDisk(ctx, -10.5, -4.5, 5, '#ffb300', OUTLINE, 1.6, true, '#fff176');
          drawDisk(ctx, -10.5, -4.5, 3.2, '#ff4081', null, 0, false, '#ff80ab');
          ctx.strokeStyle = '#ffd740';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-10.5, -1);
          ctx.lineTo(-10.5, 5);
          ctx.stroke();
          drawDisk(ctx, -10.5, 6.5, 4, '#ff4081', OUTLINE, 1.5, false, '#ff80ab');
        } else if (mp.path === 1 && mp.level === 3) {
          drawDisk(ctx, -10.5, 3, 6, '#37474f', OUTLINE, 1.8, true);
          drawDisk(ctx, -10.5, 3, 4.2, '#aa00ff', null, 0, false, '#ea80fc');
          drawDisk(ctx, -12, -5, 3.5, 'rgba(234, 128, 252, 0.75)', OUTLINE, 1.2, false);
        } else if (mp.path === 2 && mp.level >= 3) {
          for (const sy of [-5.5, 4.5]) {
            drawBox(ctx, -14.5, sy - 3.5, 8, 7, 1.5, '#d32f2f', OUTLINE, 1.5, false, '#ff8a80');
            ctx.strokeStyle = '#212121';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(-12, sy - 3.5); ctx.lineTo(-12, sy + 3.5);
            ctx.moveTo(-9, sy - 3.5); ctx.lineTo(-9, sy + 3.5);
            ctx.stroke();
          }
        } else {
          const tblLiq = u1 >= 1 ? '#ffea00' : '#76ff03';
          drawDisk(ctx, -10.5, -5, 3.8, 'rgba(225,245,254,0.85)', OUTLINE, 1.4, false);
          drawDisk(ctx, -10.5, -5, 2.4, tblLiq, null, 0, false);
          drawBox(ctx, -13.5, 2, 6, 7, 1, '#fff9c4', OUTLINE, 1.3, false);
        }

        if (isGoldTower) {
          drawBox(ctx, -6, 10.5, 11, 7, 1.5, '#5d4037', OUTLINE, 1.6, true);
          drawHighlight(ctx, c => c.ellipse(-0.5, 14, 4, 2.2, 0, 0, TAU), '#ffd740');
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      let coatCol = '#6d4c41';
      let coatHi = '#8d6e63';
      const hasApron = u1 >= 2;
      const isGoldRobe = mp.path === 3 && mp.level >= 3;
      const isDiamondArmor = mp.path === 3 && mp.level >= 5;

      if (mp.path === 1 && mp.level >= 4) { coatCol = '#880e4f'; coatHi = '#ad1457'; }
      if (mp.path === 1 && mp.level >= 5) { coatCol = '#ffffff'; coatHi = '#e0f7fa'; }
      if (isGoldRobe) { coatCol = '#ffb300'; coatHi = '#fff176'; }
      if (isDiamondArmor) { coatCol = '#80deea'; coatHi = '#ffffff'; }

      drawDisk(ctx, 2, 0, 8.5, coatCol, OUTLINE, 2, true, coatHi);

      if (hasApron && !isDiamondArmor) {
        drawShape(ctx, c => {
          c.arc(2, 0, 8.6, -PI * 0.42, PI * 0.42);
          c.closePath();
        }, '#3e2723', OUTLINE, 1.6, false);
      }

      if (isDiamondArmor) {
        drawGem(ctx, 2, -8, 4.2, '#00e5ff', '#ffffff', 6);
        drawGem(ctx, 2, 8, 4.2, '#00e5ff', '#ffffff', 6);
      }

      if (u0 >= 2) {
        for (const vy of [-6.5, -4, 4, 6.5]) {
          drawDisk(ctx, 5, vy, 2, '#ff1744', OUTLINE, 1.1, false, '#ff8a80');
        }
      }

      if (u2 >= 1) {
        ctx.save();
        ctx.translate(2, -9.5);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-2, 0); ctx.lineTo(4, -3.5);
        ctx.moveTo(-2, 0); ctx.lineTo(4, 2.5);
        ctx.stroke();
        ctx.restore();
      }

      drawBox(ctx, 5, 5, 9, 4.2, 2, coatCol, OUTLINE, 1.6, true);

      const flaskR = u0 >= 1 ? 5.6 : 4.2;
      let liqCol = '#76ff03';
      let liqHi = '#ccff90';

      if (u1 >= 1) { liqCol = '#ffea00'; liqHi = '#ffff8d'; }
      if (mp.path === 1 && mp.level >= 3) { liqCol = '#aa00ff'; liqHi = '#ea80fc'; }
      if (mp.path === 1 && mp.level >= 4) { liqCol = '#ff4081'; liqHi = '#ff80ab'; }
      if (mp.path === 1 && mp.level >= 5) { liqCol = '#ffd740'; liqHi = '#ffff00'; }
      if (mp.path === 2 && mp.level === 3) { liqCol = '#ff3d00'; liqHi = '#ff9e80'; }
      if (mp.path === 2 && mp.level >= 4) { liqCol = '#aa00ff'; liqHi = '#ea80fc'; }
      if (isGoldRobe) { liqCol = '#ffb300'; liqHi = '#fff59d'; }
      if (isDiamondArmor) { liqCol = '#80deea'; liqHi = '#e0f7fa'; }

      const hasClaw = mp.path === 2 && mp.level >= 4;
      const hasMiniSlime = isDiamondArmor;
      drawPotionFlask(ctx, 15.5, 7.5, flaskR, liqCol, liqHi, hasClaw, hasMiniSlime);

      if (mp.path === 2 && mp.level === 3) {
        drawDisk(ctx, 15.5, 7.5 - flaskR - 2.5, 2.2, '#ff1744', '#ffea00', 1.2, false);
      }

      drawDisk(ctx, 2, 0, 5.8, '#ffccbc', OUTLINE, 1.8, false);
      drawShape(ctx, c => {
        c.arc(2, 0, 6, PI * 0.45, PI * 1.55);
        c.closePath();
      }, isGoldRobe ? '#fff59d' : '#cfd8dc', OUTLINE, 1.5, false);

      if (u1 >= 2 || mp.level >= 3) {
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(4, -5.5);
        ctx.lineTo(4, 5.5);
        ctx.stroke();

        const lensCol = (mp.path === 2 && mp.level >= 4) ? '#ea80fc' : '#40c4ff';
        drawDisk(ctx, 5.5, -2.4, 2.3, lensCol, OUTLINE, 1.3, false, '#ffffff');
        drawDisk(ctx, 5.5, 2.4, 2.3, lensCol, OUTLINE, 1.3, false, '#ffffff');
      } else {
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(5.5, -2, 1.1, 0, TAU);
        ctx.arc(5.5, 2, 1.1, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 9. STRÁŽNÍ HLÁSKA (strazni_hlaska, poloměr 26 px) — KOMPLETNĚ VYLEPŠENO
  // ============================================================================
  TDS.drawers.strazni_hlaska = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Vnější prvky kolem paty věže podle cest vylepšení
      // Cesta 1 Lvl 3+: Cvičiště základních vojsk (terč vlevo nahoře a stojan se zbraněmi vlevo dole)
      if (mp.path === 1 && mp.level >= 3) {
        // Cvičný lukostřelecký terč
        drawDisk(ctx, -23, -15, 6.5, '#d7ccc8', OUTLINE, 1.6, true);
        drawDisk(ctx, -23, -15, 4.6, '#e53935', null, 0, false);
        drawDisk(ctx, -23, -15, 2.6, '#ffffff', null, 0, false);
        drawDisk(ctx, -23, -15, 1.2, '#e53935', null, 0, false);

        // Stojan s cvičnými meči a kopími
        drawBox(ctx, -26, 9, 7, 13, 1.5, '#5d4037', OUTLINE, 1.6, true, '#8d6e63');
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, 11); ctx.lineTo(-18, 11);
        ctx.moveTo(-24, 15.5); ctx.lineTo(-17, 15.5);
        ctx.moveTo(-24, 19.5); ctx.lineTo(-18, 19.5);
        ctx.stroke();
      }

      // Cesta 2 Lvl 3+: Královská zbrojnice (kovářská dílna se zářící kovadlinou a výhní u paty věže)
      if (mp.path === 2 && mp.level >= 3) {
        // Kamenná podlážka kovárny dole
        drawBox(ctx, -14, 17, 28, 10, 2.5, '#455a64', OUTLINE, 1.8, true, '#78909c');
        // Rozžhavená výheň vlevo dole
        drawDisk(ctx, -8, 22, 4.2, '#ff3d00', OUTLINE, 1.4, false, '#ffea00');
        // Zářící ocelová kovadlina vpravo dole
        drawShape(ctx, c => {
          c.moveTo(1, 20);
          c.lineTo(11, 20);
          c.lineTo(14, 22);
          c.lineTo(10, 24.5);
          c.lineTo(2, 24.5);
          c.closePath();
        }, '#cfd8dc', OUTLINE, 1.5, true);
        drawHighlight(ctx, c => c.rect(3, 20.5, 6, 1.8), '#ffffff');
      }

      // Cesta 3 Lvl 1+: Smlouvání s cechy (kupecký stánek s pruhovanou stříškou a zlatými váhami u vchodu vpravo)
      if (u2 >= 1) {
        drawBox(ctx, 18, -13, 9, 13, 1.5, '#8d6e63', OUTLINE, 1.6, true);
        // Červeno-bílá markýza stánku
        for (let i = 0; i < 3; i++) {
          drawBox(ctx, 18.5, -12.5 + i * 4, 8, 4, 0.5, i % 2 === 0 ? '#e53935' : '#ffffff', OUTLINE, 1.1, false);
        }
        // Zlaté kupecké váhy na pultu
        drawDisk(ctx, 24.5, -6.5, 2.2, '#ffd740', OUTLINE, 1.1, false, '#ffff00');
      }

      // Cesta 3 Lvl 3+: Městská pokladnice (okované truhlice vyskládané kolem zdí)
      if (mp.path === 3 && mp.level >= 3) {
        drawTreasureChest(ctx, -23, -11, 7, 9, false);
        drawTreasureChest(ctx, -23, 1, 7, 9, true);
        drawTreasureChest(ctx, -23, 13, 7, 9, false);
      }

      // 2. Hlavní kamenná/mramorová základna věže
      let wallCol = '#78909c';
      let wallHi = '#b0bec5';
      let cornerCol = '#546e7a';
      let roofCol = '#6d4c41';
      let roofHi = '#8d6e63';

      if (mp.path === 1 && mp.level >= 4) {
        // C1 Lvl 4-5: Pevnost mistrů / Citadela království (zlatá střecha, světlé kvádry)
        wallCol = '#90a4ae'; wallHi = '#cfd8dc';
        cornerCol = mp.level >= 5 ? '#ffb300' : '#607d8b';
        roofCol = '#ffb300'; roofHi = '#fff176';
      } else if (mp.path === 2 && mp.level >= 5) {
        // C2 Lvl 5: Domobrana celé říše (monumentální bílo-zlatá válečná katedrála)
        wallCol = '#eceff1'; wallHi = '#ffffff';
        cornerCol = '#ffb300';
        roofCol = '#1565c0'; roofHi = '#64b5f6';
      } else if (mp.path === 3 && mp.level === 3) {
        // C3 Lvl 3: Městská pokladnice (měděná střecha)
        roofCol = '#d84315'; roofHi = '#ff8a65';
      } else if (mp.path === 3 && mp.level === 4) {
        // C3 Lvl 4: Knihovna moudrosti (modrofialová břidlice s vitrážemi)
        wallCol = '#5c6bc0'; wallHi = '#9fa8da';
        cornerCol = '#3949ab';
        roofCol = '#4a148c'; roofHi = '#ab47bc';
      } else if (mp.path === 3 && mp.level >= 5) {
        // C3 Lvl 5: Velká akademie (zářící mramor se zlatou kopulí)
        wallCol = '#fff8e1'; wallHi = '#ffffff';
        cornerCol = '#ffd54f';
        roofCol = '#ffb300'; roofHi = '#ffff8d';
      }

      // Čtvercový půdorys hradby
      drawBox(ctx, -20, -20, 40, 40, 4.5, wallCol, OUTLINE, 2.4, true, wallHi);

      // Spáry kamenného zdiva
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.28)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-19, -8); ctx.lineTo(19, -8);
      ctx.moveTo(-19, 8); ctx.lineTo(19, 8);
      ctx.moveTo(-6, -19); ctx.lineTo(-6, 19);
      ctx.moveTo(6, -19); ctx.lineTo(6, 19);
      ctx.stroke();

      // 4 rohové bašty / pilíře
      const bastionR = (mp.path === 1 && mp.level >= 5) ? 7.5 : 6;
      for (const bx of [-18.5, 18.5]) {
        for (const by of [-18.5, 18.5]) {
          drawDisk(ctx, bx, by, bastionR, cornerCol, OUTLINE, 1.8, false, wallHi);
        }
      }

      // Cesta 1 Lvl 4+: Sochy rytířů se štíty v předních rozích Pevnosti mistrů
      if (mp.path === 1 && mp.level >= 4) {
        for (const sy of [-15, 15]) {
          drawDisk(ctx, 16, sy, 4.2, '#cfd8dc', OUTLINE, 1.5, false, '#ffffff');
          // Zlatý štít a kopí sochy
          drawBox(ctx, 18.5, sy - 2.5, 2.5, 5, 1, '#ffd740', OUTLINE, 1.2, false);
        }
      }

      // Cesta 3 Lvl 2+: Královské výsady — Zlatá pečeť s korunou nad vchodem vpravo
      if (u2 >= 2) {
        drawDisk(ctx, 19.5, 4, 4.5, '#ffd740', OUTLINE, 1.5, true, '#ffff00');
        drawDisk(ctx, 19.5, 4, 2.2, '#d50000', null, 0, false);
      }

      // Cesta 3 Lvl 4+: Vitrážová barevná okna Knihovny moudrosti / Akademie po stranách
      if (mp.path === 3 && mp.level >= 4) {
        for (const wy of [-18.5, 18.5]) {
          drawBox(ctx, -7, wy - 2, 14, 4, 1.5, '#00e5ff', OUTLINE, 1.4, false);
          drawBox(ctx, -2, wy - 2, 4, 4, 0.5, '#ea80fc', OUTLINE, 1.1, false);
        }
      }

      // 3. Vnitřní vyvýšená střecha / ochoz hlásky
      if (mp.path === 3 && mp.level >= 5) {
        // Zlatá kruhová kopule Velké akademie s nebeskými poledníky
        drawDisk(ctx, 0, 0, 15, roofCol, OUTLINE, 2.2, true, roofHi);
        ctx.strokeStyle = '#fffde7';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, 0, TAU);
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.stroke();
      } else {
        drawBox(ctx, -13.5, -13.5, 27, 27, 3.5, roofCol, OUTLINE, 2, true, roofHi);
        // Prkna nebo tašky střechy
        ctx.strokeStyle = 'rgba(17, 17, 17, 0.32)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-13, -13); ctx.lineTo(13, 13);
        ctx.moveTo(13, -13); ctx.lineTo(-13, 13);
        ctx.stroke();
        drawBox(ctx, -7.5, -7.5, 15, 15, 2, wallCol, OUTLINE, 1.6, false, wallHi);
      }

      // Cesta 1 Lvl 2+: Dva válečné okované bubny s bubeníky na ochozu
      if (u0 >= 2) {
        for (const dy of [-13.5, 13.5]) {
          // Okovaný válečný buben
          drawDisk(ctx, -11, dy, 5.2, '#d32f2f', OUTLINE, 1.6, true);
          drawDisk(ctx, -11, dy, 3.8, '#fff8e1', OUTLINE, 1.2, false, '#ffffff');
          // Bubeník s paličkami vedle bubnu
          drawDisk(ctx, -17.5, dy, 3.6, '#1976d2', OUTLINE, 1.4, false, '#64b5f6');
          ctx.strokeStyle = '#ffca28';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-15, dy - 1.5); ctx.lineTo(-11, dy - 1);
          ctx.moveTo(-15, dy + 1.5); ctx.lineTo(-11, dy + 1);
          ctx.stroke();
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // CESTA 1: Vysoký prapor -> Bubny -> Cvičiště -> Pevnost mistrů -> Citadela království (Obří zlatá balista)
      if (mp.path === 1 && mp.level >= 5) {
        // Lvl 5: Obří zlatá balista na vrcholu hlavní věže Citadely
        drawDisk(ctx, 0, 0, 9.5, '#455a64', OUTLINE, 2, true, '#90a4ae');

        // Masivní zlatá ramena balisty
        drawShape(ctx, c => {
          c.moveTo(6, -18);
          c.quadraticCurveTo(16, 0, 6, 18);
          c.lineTo(2, 15);
          c.quadraticCurveTo(10, 0, 2, -15);
          c.closePath();
        }, '#ffb300', OUTLINE, 2, true);
        drawHighlight(ctx, c => c.rect(5, -14, 3, 10), '#ffff8d');

        // Tětiva balisty
        ctx.strokeStyle = '#eceff1';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(4, -16.5);
        ctx.lineTo(-7, 0);
        ctx.lineTo(4, 16.5);
        ctx.stroke();

        // Tělo balisty a obří zlatobílé kopí
        drawBox(ctx, -9, -3.5, 22, 7, 1.8, '#ff8f00', OUTLINE, 1.8, false, '#ffd54f');
        drawBox(ctx, -5, -1.5, 23, 3, 1, '#ffffff', OUTLINE, 1.3, false);
        drawShape(ctx, c => {
          c.moveTo(16, -5);
          c.lineTo(26, 0);
          c.lineTo(16, 5);
          c.lineTo(18.5, 0);
          c.closePath();
        }, '#00e5ff', OUTLINE, 1.6, true);

        ctx.restore();
        return;
      }

      // CESTA 2: Ostražitá hlídka -> Světlomet -> Zbrojnice -> Volání do zbraně -> Domobrana celé říše
      if (mp.path === 2) {
        if (mp.level >= 5) {
          // Lvl 5: Dva monumentální zlaté zvony katedrály a prapory
          drawBox(ctx, -6, -13, 12, 26, 2.5, '#ffb300', OUTLINE, 2, true, '#fff59d');
          for (const by of [-7.5, 7.5]) {
            drawShape(ctx, c => {
              c.moveTo(-4, by - 4);
              c.lineTo(6, by - 6);
              c.lineTo(6, by + 6);
              c.lineTo(-4, by + 4);
              c.closePath();
            }, '#ffd740', OUTLINE, 1.8, true);
            // Srdce zvonu
            drawDisk(ctx, 6.5, by, 2.4, '#ff6d00', OUTLINE, 1.2, false);
          }
          // Královský prapor uprostřed
          drawShape(ctx, c => {
            c.moveTo(2, -4);
            c.lineTo(22, -7);
            c.lineTo(17, 0);
            c.lineTo(22, 7);
            c.lineTo(2, 4);
            c.closePath();
          }, '#d32f2f', OUTLINE, 1.6, true);
          drawDisk(ctx, 9, 0, 2.5, '#ffd740', null, 0, false);

          ctx.restore();
          return;
        }

        if (mp.level === 4) {
          // Lvl 4: Volání do zbraně — Dva obří zlaté válečné rohy vyčnívající z ochozu
          drawDisk(ctx, -2, 0, 7, '#546e7a', OUTLINE, 1.8, true, '#90a4ae');
          for (const side of [-1, 1]) {
            drawShape(ctx, c => {
              c.moveTo(-1, side * 3);
              c.quadraticCurveTo(9, side * 4, 19, side * 12);
              c.lineTo(21, side * 6);
              c.quadraticCurveTo(10, side * 1.5, -1, side * 1);
              c.closePath();
            }, '#ffb300', OUTLINE, 1.8, true);
            // Ústí válečného rohu
            drawDisk(ctx, 20, side * 9, 3.5, '#ff6d00', OUTLINE, 1.4, false, '#fff176');
          }
          ctx.restore();
          return;
        }

        if (mp.level >= 2) {
          // Lvl 2-3: Světlomet — Otočné parabolické zrcadlo se zářícím krystalem
          ctx.save();
          ctx.fillStyle = 'rgba(128, 216, 255, 0.32)';
          ctx.beginPath();
          ctx.moveTo(2, -5);
          ctx.lineTo(26, -14);
          ctx.lineTo(26, 14);
          ctx.lineTo(2, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          drawDisk(ctx, 0, 0, 8, '#ffb300', OUTLINE, 1.8, true, '#ffe082');
          // Parabolické zrcadlo
          drawShape(ctx, c => {
            c.arc(0, 0, 9.5, PI * 0.45, PI * 1.55);
            c.closePath();
          }, '#cfd8dc', OUTLINE, 1.8, false);
          // Zářící azurový krystal uprostřed
          drawGem(ctx, 2.5, 0, 5.2, '#00e5ff', '#ffffff', 6);
          ctx.restore();
          return;
        }
      }

      // CESTA 3: Smlouvání -> Výsady -> Pokladnice -> Knihovna moudrosti -> Velká akademie
      if (mp.path === 3 && mp.level >= 4) {
        if (mp.level >= 5) {
          // Lvl 5: Velká akademie — Obří levitující Krystal moudrosti se zlatými prstenci
          ctx.strokeStyle = '#ffd740';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 0, 14, 7, 0.45, 0, TAU);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, 0, 14, 7, -0.45, 0, TAU);
          ctx.stroke();

          drawGem(ctx, 0, 0, 9.5, '#00e5ff', '#e0f7fa', 8);
          drawGem(ctx, 0, 0, 5.5, '#ffffff', '#ffffff', 4);
        } else {
          // Lvl 4: Knihovna moudrosti — Otočný pult s otevřenou velkou kronikou a svitky
          drawDisk(ctx, 0, 0, 8.5, '#5d4037', OUTLINE, 1.8, true, '#8d6e63');
          drawBox(ctx, -6, -7.5, 12, 15, 1.5, '#ffb300', OUTLINE, 1.6, true);
          drawBox(ctx, -4.5, -6, 9, 12, 0.8, '#fff9c4', OUTLINE, 1.2, false);
          // Runové písmo na stránkách
          ctx.strokeStyle = '#6a1b9a';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(-2, -3.5); ctx.lineTo(2, -3.5);
          ctx.moveTo(-2, 0); ctx.lineTo(2, 0);
          ctx.moveTo(-2, 3.5); ctx.lineTo(2, 3.5);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      // ZÁKLADNÍ VĚŽIČKA (nebo Cesta 1 Lvl 1-4 / Cesta 2 Lvl 1 / Cesta 3 Lvl 1-3)
      // Strážný na věži
      drawDisk(ctx, -2, 0, 6.5, u0 >= 4 ? '#ffb300' : '#546e7a', OUTLINE, 1.8, true, '#cfd8dc');
      drawDisk(ctx, -1, 0, 4.2, '#ffccbc', OUTLINE, 1.5, false);

      // Cesta 2 Lvl 1+: Ostražitá hlídka — Louč se zeleným magickým plamenem v levé ruce
      if (u1 >= 1) {
        drawBox(ctx, 0, 5, 8, 2.8, 1, '#5d4037', OUTLINE, 1.4, false);
        drawDisk(ctx, 9.5, 6.4, 4.2, '#00e676', OUTLINE, 1.5, true, '#b9f6ca');
      }

      // Cesta 1 Lvl 1+ (nebo základní praporečník): Dlouhý modrozlatý královský prapor vlající doprava
      const bannerLen = u0 >= 1 ? 22 : 14;
      const bannerCol = u0 >= 4 ? '#d32f2f' : '#1565c0';
      // Žerď praporu
      drawBox(ctx, -2, -7.5, bannerLen + 4, 2.4, 1, '#8d6e63', OUTLINE, 1.4, true);
      // Vlající látka praporu se zlatým lemem
      drawShape(ctx, c => {
        c.moveTo(2, -6);
        c.quadraticCurveTo(bannerLen * 0.5, -10, bannerLen, -5);
        c.lineTo(bannerLen - 4, 0);
        c.lineTo(bannerLen, 5);
        c.quadraticCurveTo(bannerLen * 0.5, 2, 2, 3);
        c.closePath();
      }, bannerCol, OUTLINE, 1.7, true);

      // Zlatý erb na praporu
      if (u0 >= 1) {
        drawDisk(ctx, 9, -1.5, 2.6, '#ffd740', OUTLINE, 1.1, false, '#ffff00');
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 10. ZLATÝ DŮL (zlaty_dul, poloměr 32 px) — KOMPLETNĚ VYLEPŠENO
  // ============================================================================
  TDS.drawers.zlaty_dul = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. CESTA 2 LVL 3–5: Mramorová Královská banka / Půjčka koruny / Císařská klenotnice
      if (mp.path === 2 && mp.level >= 3) {
        const isLvl4 = mp.level >= 4;
        const isLvl5 = mp.level >= 5;

        const bldgCol = isLvl5 ? '#ffb300' : '#eceff1';
        const bldgHi = isLvl5 ? '#fff59d' : '#ffffff';
        const roofCol = isLvl5 ? '#ffd740' : (isLvl4 ? '#1565c0' : '#78909c');

        // Široké mramorové / zlaté schodiště vpravo u vchodu
        drawBox(ctx, 14, -15, 13, 30, 2, '#cfd8dc', OUTLINE, 1.8, true, '#ffffff');
        // Hlavní budova banky / pevnosti
        drawBox(ctx, -24, -23, 42, 46, 4.5, bldgCol, OUTLINE, 2.4, true, bldgHi);

        // Vnitřní střecha
        drawBox(ctx, -18, -17, 30, 34, 3, roofCol, OUTLINE, 1.8, false, isLvl5 ? '#ffffff' : '#b0bec5');

        // Pozlacené nebo mramorové sloupy u průčelí vpravo
        for (const py of [-16, -6, 6, 16]) {
          drawDisk(ctx, 17, py, 3.6, isLvl4 ? '#ffd740' : '#b0bec5', OUTLINE, 1.5, true, '#ffffff');
        }

        // Lvl 4: Královský znak koruny na střeše
        if (isLvl4 && !isLvl5) {
          drawDisk(ctx, -3, 0, 7.5, '#ffd740', OUTLINE, 1.6, false, '#ffff00');
        }

        // Lvl 5: Obří broušené rubíny v rozích Císařské klenotnice
        if (isLvl5) {
          for (const rx of [-19, 13]) {
            for (const ry of [-18, 18]) {
              drawGem(ctx, rx, ry, 4.8, '#d50000', '#ff8a80', 6);
            }
          }
        }

        ctx.restore();
        return;
      }

      // 2. CESTA 3 LVL 4–5: Velký bazar / Srdce obchodních cest (Zlatý kupecký palác)
      if (mp.path === 3 && mp.level >= 4) {
        const isLvl5 = mp.level >= 5;

        // Zlatavě písková dlažba paláce
        drawDisk(ctx, 0, 0, 27.5, isLvl5 ? '#ffd54f' : '#fff8e1', OUTLINE, 2.4, true, '#ffffff');
        drawDisk(ctx, 0, 0, 21, isLvl5 ? '#ffb300' : '#ffe082', OUTLINE, 1.6, false);

        // Hedvábné barevné baldachýny a stany po obvodu
        const canopies = [
          { x: -16, y: -17, col: '#d32f2f', hi: '#ff8a80' },
          { x: -16, y: 5, col: '#1976d2', hi: '#82b1ff' },
          { x: 4, y: -22, col: '#7b1fa2', hi: '#ea80fc' },
          { x: 4, y: 11, col: '#00897b', hi: '#a7ffeb' }
        ];
        for (const cn of canopies) {
          drawBox(ctx, cn.x, cn.y, 13, 11, 2.5, cn.col, OUTLINE, 1.7, true, cn.hi);
        }

        // Koleje pro kupecký vůz / karavanu vpravo
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -4.5); ctx.lineTo(30, -4.5);
        ctx.moveTo(10, 4.5); ctx.lineTo(30, 4.5);
        ctx.stroke();

        ctx.restore();
        return;
      }

      // 3. SKALNÍ HORA DOLU (Základ, Cesta 1 Lvl 1-5, Cesta 2 Lvl 1-2, Cesta 3 Lvl 1-3)
      const isDragonMt = mp.path === 1 && mp.level >= 5;
      const isMint = mp.path === 1 && mp.level === 4;
      const isQuarry = mp.path === 1 && mp.level >= 3;

      // Dvanáctiúhelníkový skalní masiv hory
      const rockCol = isDragonMt ? '#4e342e' : '#607d8b';
      const rockHi = isDragonMt ? '#ffb300' : '#90a4ae';
      const rockDark = isDragonMt ? '#3e2723' : '#455a64';

      drawShape(ctx, c => polyPath(c, -2, 0, 26.5, 10, 0.15), rockDark, OUTLINE, 2.5, true, 3.5, 4);
      drawShape(ctx, c => polyPath(c, -3.5, -1.5, 22, 9, 0.3), rockCol, OUTLINE, 1.6, false);
      drawHighlight(ctx, c => polyPath(c, -6, -4, 14, 7, 0.2), rockHi);

      // Cesta 1 Lvl 3: Trpasličí kamenolom — Dřevěné vodní kolo nahoře a parní kladivo dole
      if (isQuarry && !isMint && !isDragonMt) {
        // Vodní koryto a lopatkové kolo nahoře (-Y)
        drawBox(ctx, -14, -27, 22, 6, 1.5, '#29b6f6', OUTLINE, 1.5, false);
        drawDisk(ctx, -3, -24, 6.5, '#6d4c41', OUTLINE, 1.8, true, '#a1887f');
        // Parní beranidlo / kladivo drtící rudu dole (+Y)
        drawBox(ctx, -10, 17, 16, 8, 2, '#37474f', OUTLINE, 1.8, true, '#78909c');
      }

      // Cesta 1 Lvl 4: Královská mincovna — Budova se zlatou střechou vestavěná do hory
      if (isMint) {
        drawBox(ctx, -19, -16, 26, 32, 3.5, '#ffb300', OUTLINE, 2.2, true, '#fff59d');
        ctx.strokeStyle = '#e65100';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-18, -8); ctx.lineTo(6, -8);
        ctx.moveTo(-18, 0); ctx.lineTo(6, 0);
        ctx.moveTo(-18, 8); ctx.lineTo(6, 8);
        ctx.stroke();
      }

      // Cesta 1 Lvl 5: Pokladnice dračí hory — Zlaté žíly, hromady zlata a drahokamy po svazích hory
      if (isDragonMt) {
        for (const gPos of [[-14, -12, '#ff1744'], [-16, 9, '#00e676'], [2, -16, '#00e5ff'], [0, 15, '#d500f9']]) {
          drawGem(ctx, gPos[0], gPos[1], 4.5, gPos[2], '#ffffff', 6);
        }
        drawDisk(ctx, -6, 2, 11, '#ffd740', OUTLINE, 1.8, false, '#ffff00');
      }

      // Cesta 2 Lvl 1–2: Dřevěná / ocelovými pásy pobitá pokladnice se zámkem a strážným vedle dolu
      if (u1 >= 1) {
        const isSteel = u1 >= 2;
        drawBox(ctx, -16, 15, 16, 11, 2, isSteel ? '#546e7a' : '#6d4c41', OUTLINE, 1.8, true, isSteel ? '#90a4ae' : '#8d6e63');
        // Visací zlatý zámek
        drawDisk(ctx, -8, 20.5, 2.5, '#ffd740', OUTLINE, 1.2, false);
        if (isSteel) {
          // Strážný s kopím vedle úschovny
          drawDisk(ctx, 4, 22, 4.2, '#cfd8dc', OUTLINE, 1.5, true, '#ffffff');
          drawBox(ctx, 7, 17, 2, 9, 0.5, '#8d6e63', OUTLINE, 1.1, false);
        }
      }

      // Cesta 3 Lvl 3: Kupecké tržiště — Barevné stany a dřevěné sudy kolem dolu
      if (mp.path === 3 && mp.level === 3) {
        drawBox(ctx, -23, -24, 15, 11, 2, '#d32f2f', OUTLINE, 1.7, true, '#ff8a80');
        drawBox(ctx, -23, 13, 15, 11, 2, '#1976d2', OUTLINE, 1.7, true, '#82b1ff');
        drawDisk(ctx, -6, -21, 3.8, '#8d6e63', OUTLINE, 1.4, true, '#bcaaa4');
      }

      // 4. Železné koleje a vchod do šachty vpravo (+X)
      if (u0 >= 1 || u2 >= 1 || mp.path === 0) {
        // Dřevěné pražce
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 2.2;
        for (let tx = 13; tx <= 29; tx += 4) {
          ctx.beginPath();
          ctx.moveTo(tx, -6.5);
          ctx.lineTo(tx, 6.5);
          ctx.stroke();
        }
        // Ocelové kolejnice
        ctx.strokeStyle = '#b0bec5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, -4.5); ctx.lineTo(31, -4.5);
        ctx.moveTo(10, 4.5); ctx.lineTo(31, 4.5);
        ctx.stroke();
      }

      // Temné ústí šachty s dubovým portálem (C1 Lvl 1+: vyztužené dubové trámy)
      const portalCol = isDragonMt ? '#ffb300' : (u0 >= 1 ? '#6d4c41' : '#4e342e');
      drawBox(ctx, 6, -11, 11, 22, 2.5, portalCol, OUTLINE, 2, true, isDragonMt ? '#fff59d' : '#8d6e63');
      drawBox(ctx, 9, -8, 8, 16, 2, '#161b1e', OUTLINE, 1.6, false);

      // Cesta 1 Lvl 2+: Velké třpytivé hroudy ryzího zlata u vchodu do dolu
      if (u0 >= 2) {
        drawDisk(ctx, 21, 11, 4.5, '#ffd740', OUTLINE, 1.5, true, '#ffff00');
        drawDisk(ctx, 26, 13, 3.4, '#ffb300', OUTLINE, 1.4, true, '#fff59d');
        drawDisk(ctx, 22, -11, 3.8, '#ffd740', OUTLINE, 1.4, true, '#ffff00');
      }

      // Cesta 3 Lvl 2+: Modré safíry a zelené smaragdy třpytící se u kolejí
      if (u2 >= 2) {
        drawGem(ctx, 18, -12, 3.6, '#00e5ff', '#ffffff', 6);
        drawGem(ctx, 17, 13, 3.6, '#00e676', '#b9f6ca', 6);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // CESTA 1: Hlubší šachty -> Bohatá žíla -> Kamenolom -> Královská mincovna -> Pokladnice dračí hory
      if (mp.path === 1 && mp.level >= 3) {
        if (mp.level >= 5) {
          // Lvl 5: Monumentální zlatá trpasličí koruna s drahokamy na vrcholu Dračí hory
          drawShape(ctx, c => {
            c.moveTo(-11, 6);
            c.lineTo(-13, -8);
            c.lineTo(-6, -2);
            c.lineTo(0, -12);
            c.lineTo(6, -2);
            c.lineTo(13, -8);
            c.lineTo(11, 6);
            c.closePath();
          }, '#ffd740', OUTLINE, 2.2, true);
          drawHighlight(ctx, c => c.rect(-8, 1, 16, 3.5), '#ffff8d');
          drawGem(ctx, 0, 1, 3.2, '#ff1744', '#ffffff', 6);
          drawGem(ctx, -6, 2, 2.2, '#00e5ff', '#ffffff', 6);
          drawGem(ctx, 6, 2, 2.2, '#00e676', '#ffffff', 6);
        } else {
          // Lvl 3-4: Parní komín kamenolomu / Komín mincovny chrlící zlaté jiskry
          const isMint = mp.level >= 4;
          drawDisk(ctx, -3, 0, 8.5, isMint ? '#b71c1c' : '#37474f', OUTLINE, 2, true, isMint ? '#ef5350' : '#78909c');
          drawDisk(ctx, -3, 0, 5, '#212121', OUTLINE, 1.5, false);
          drawDisk(ctx, -3, 0, 3, '#ff6d00', null, 0, false, '#ffea00');

          if (isMint) {
            // Zlaté jiskry a mince stoupající z komína mincovny
            for (const sp of [[-11, -8], [5, -9], [4, 9], [-10, 8]]) {
              drawStarShape(ctx, sp[0], sp[1], 4.2, 1.8, 4, '#ffd740', OUTLINE, 1.1);
            }
          }
        }
      }

      // CESTA 2: Úrok -> Úschovna -> Královská banka -> Půjčka koruny -> Císařská klenotnice
      if (mp.path === 2 && mp.level >= 3) {
        if (mp.level >= 5) {
          // Lvl 5: Vznášející se zlaté královské žezlo s rubínem nad Císařskou klenotnicí
          drawHighlight(ctx, c => c.arc(-2, 0, 12, 0, TAU), 'rgba(255, 235, 59, 0.35)');
          drawBox(ctx, -14, -2.5, 24, 5, 2, '#ffd740', OUTLINE, 1.8, true, '#ffff8d');
          drawGem(ctx, 11, 0, 6.5, '#ff1744', '#ff8a80', 8);
          drawGem(ctx, -14, 0, 4, '#00e5ff', '#ffffff', 6);
        } else {
          // Lvl 3-4: Masivní kruhové železné/zlaté dveře trezoru s otočným kolem
          const isGoldVault = mp.level >= 4;
          drawDisk(ctx, -3, 0, 11, isGoldVault ? '#ffb300' : '#546e7a', OUTLINE, 2.2, true, isGoldVault ? '#fff59d' : '#90a4ae');
          drawDisk(ctx, -3, 0, 7.5, '#263238', OUTLINE, 1.6, false);
          // Paprsky kola trezoru
          ctx.strokeStyle = isGoldVault ? '#ffd740' : '#cfd8dc';
          ctx.lineWidth = 2.2;
          for (let i = 0; i < 4; i++) {
            const a = (i * PI) / 4;
            ctx.beginPath();
            ctx.moveTo(-3 + Math.cos(a) * -6.5, Math.sin(a) * -6.5);
            ctx.lineTo(-3 + Math.cos(a) * 6.5, Math.sin(a) * 6.5);
            ctx.stroke();
          }
          drawDisk(ctx, -3, 0, 3, isGoldVault ? '#ffd740' : '#cfd8dc', OUTLINE, 1.4, false);
        }
        ctx.restore();
        return;
      }

      // CESTA 3 LVL 5: Srdce obchodních cest — Fontána života a zlatá socha bohyně hojnosti uprostřed
      if (mp.path === 3 && mp.level >= 5) {
        drawDisk(ctx, -2, 0, 12, '#00e5ff', OUTLINE, 2, true, '#b2ebf2');
        drawDisk(ctx, -2, 0, 8, '#40c4ff', null, 0, false, '#e0f7fa');
        // Zlatá socha bohyně hojnosti s rohem hojnosti
        drawDisk(ctx, -2, 0, 5.2, '#ffd740', OUTLINE, 1.6, true, '#ffff00');
        drawStarShape(ctx, -2, 0, 8, 3, 4, '#fffde7', OUTLINE, 1.2);
      }

      // DŮLNÍ VOZÍK NA KOLEJÍCH VPRAVO (pro Základ, Cestu 1 a Cestu 3)
      if (mp.path !== 2) {
        const cartX = 22.5;
        // Kola vozíku
        drawBox(ctx, cartX - 5, -6.5, 3.5, 2, 0.5, '#263238', OUTLINE, 1.2, false);
        drawBox(ctx, cartX + 1.5, -6.5, 3.5, 2, 0.5, '#263238', OUTLINE, 1.2, false);
        drawBox(ctx, cartX - 5, 4.5, 3.5, 2, 0.5, '#263238', OUTLINE, 1.2, false);
        drawBox(ctx, cartX + 1.5, 4.5, 3.5, 2, 0.5, '#263238', OUTLINE, 1.2, false);

        // Korba vozíku
        drawBox(ctx, cartX - 6, -5, 12, 10, 2, '#455a64', OUTLINE, 1.8, true, '#78909c');

        // Náklad zlata ve vozíku
        if (u0 >= 2 || u2 >= 1 || mp.level >= 1) {
          drawDisk(ctx, cartX - 1.5, -1, 3.5, '#ffd740', OUTLINE, 1.2, false, '#ffff00');
          drawDisk(ctx, cartX + 2, 1.5, 3, '#ffb300', OUTLINE, 1.2, false, '#fff59d');
        }

        // Cesta 3 Lvl 2+: Drahokamy (safír a smaragd) ve vozíku
        if (u2 >= 2) {
          drawGem(ctx, cartX + 1.5, -1.5, 3, '#00e5ff', '#ffffff', 6);
          drawGem(ctx, cartX - 2, 2, 2.8, '#00e676', '#ffffff', 6);
        }

        // Cesta 3 Lvl 1+: Bílá větrná plachta na samojízdném vozíku
        if (u2 >= 1) {
          drawShape(ctx, c => {
            c.moveTo(cartX, -7.5);
            c.quadraticCurveTo(cartX + 6, 0, cartX, 7.5);
            c.quadraticCurveTo(cartX + 2.5, 0, cartX, -7.5);
            c.closePath();
          }, '#ffffff', OUTLINE, 1.5, true);
        }
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // HRDINOVÉ (TDS.heroDrawers) — KOMPLETNĚ VYLEPŠENO (Úrovně 1, 3, 10, 20 + stavy)
  // ============================================================================
  TDS.heroDrawers = Object.assign(TDS.heroDrawers || {}, {

    // -------------------------------------------------------------------------
    // 1. KRÁLOVSKÝ LOVEC BEDŘICH (lovec_bedrich, poloměr 20 px)
    // -------------------------------------------------------------------------
    lovec_bedrich: function (ctx, lvl, s) {
      ctx.save();
      const state = s || {};
      const isLvl3 = lvl >= 3;
      const isLvl10 = lvl >= 10;
      const isLvl20 = lvl >= 20;

      // 1. Zlatá šampiónská aura na úrovni 20
      if (isLvl20) {
        drawDisk(ctx, 0, 0, 24, 'rgba(255, 215, 64, 0.28)', '#ffd740', 1.6, false);
        for (let i = 0; i < 8; i++) {
          const a = (i * PI) / 4;
          drawShape(ctx, c => {
            c.moveTo(Math.cos(a - 0.12) * 19, Math.sin(a - 0.12) * 19);
            c.lineTo(Math.cos(a) * 25.5, Math.sin(a) * 25.5);
            c.lineTo(Math.cos(a + 0.12) * 19, Math.sin(a + 0.12) * 19);
            c.closePath();
          }, 'rgba(255, 235, 59, 0.55)', null, 0, false);
        }
      }

      // 2. Hraničářský plášť se záhyby (vlaje dozadu na -X)
      const cloakCol = isLvl20 ? '#b71c1c' : (isLvl10 ? '#1b5e20' : '#2e7d32');
      const cloakHi = isLvl20 ? '#ef5350' : (isLvl10 ? '#43a047' : '#66bb6a');
      drawShape(ctx, c => {
        c.moveTo(2, -10.5);
        c.quadraticCurveTo(-9, -14, -17, -10.5);
        c.lineTo(-13.5, 0);
        c.lineTo(-17, 10.5);
        c.quadraticCurveTo(-9, 14, 2, 10.5);
        c.closePath();
      }, cloakCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(1, -8.5);
        c.quadraticCurveTo(-7, -11, -14, -8);
        c.lineTo(-11, -1);
        c.lineTo(0, -2);
        c.closePath();
      }, cloakHi);

      if (isLvl10) {
        // Zlaté lemování pláště od Lvl 10
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-16, -9.5);
        ctx.lineTo(-12.5, 0);
        ctx.lineTo(-16, 9.5);
        ctx.stroke();
      }

      // 3. Toulec se šípy / šipkami na zádech
      drawBox(ctx, -9, -11.5, 6.5, 4.5, 1.2, '#4e342e', OUTLINE, 1.5, false);
      ctx.fillStyle = isLvl20 ? '#00e5ff' : (isLvl10 ? '#ffd740' : '#ffffff');
      ctx.fillRect(-11.5, -11, 2.8, 1.4);
      ctx.fillRect(-11.5, -9, 2.8, 1.4);

      // 4. Tělo a nárameníky (Lvl 1: kůže, Lvl 3: vybíjená kůže, Lvl 10: smaragdově-zlatá zbroj, Lvl 20: zlatá dračí zbroj)
      const armorCol = isLvl20 ? '#ffb300' : (isLvl10 ? '#388e3c' : (isLvl3 ? '#6d4c41' : '#8d6e63'));
      const armorHi = isLvl20 ? '#fff59d' : (isLvl10 ? '#81c784' : '#a1887f');
      drawDisk(ctx, -1, 0, 9.2, armorCol, OUTLINE, 2, true, armorHi);

      if (isLvl3) {
        const padCol = isLvl20 ? '#ffd740' : (isLvl10 ? '#ffb300' : '#78909c');
        const padHi = isLvl20 ? '#ffffff' : '#ffe082';
        drawDisk(ctx, 0, -8.5, 4.2, padCol, OUTLINE, 1.6, false, padHi);
        drawDisk(ctx, 0, 8.5, 4.2, padCol, OUTLINE, 1.6, false, padHi);
      }

      // 5. Zbraň: Lvl 1–9 Lovecký luk, Lvl 10–19 Těžká kuše, Lvl 20 Mistrovský zlatý arbalest
      if (isLvl10) {
        const stockCol = isLvl20 ? '#37474f' : '#5d4037';
        const prodCol = isLvl20 ? '#ffd740' : '#cfd8dc';

        // Socha kuše
        drawBox(ctx, 4, -2.8, 19, 5.6, 1.5, stockCol, OUTLINE, 1.8, true);

        // Mohutné ocelové / zlaté lučiště
        drawShape(ctx, c => {
          c.moveTo(18, -16);
          c.quadraticCurveTo(25, 0, 18, 16);
          c.lineTo(14.5, 13.5);
          c.quadraticCurveTo(20.5, 0, 14.5, -13.5);
          c.closePath();
        }, prodCol, OUTLINE, 2, true);

        // Druhé předsazené lučiště na Lvl 20
        if (isLvl20) {
          drawShape(ctx, c => {
            c.moveTo(22, -11);
            c.quadraticCurveTo(27, 0, 22, 11);
            c.lineTo(19.5, 9);
            c.quadraticCurveTo(23.5, 0, 19.5, -9);
            c.closePath();
          }, '#ffffff', OUTLINE, 1.6, false);
        }

        // Tětiva kuše
        ctx.strokeStyle = '#eceff1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(16, -14.5);
        ctx.lineTo(7, 0);
        ctx.lineTo(16, 14.5);
        ctx.stroke();
      } else {
        // Lovecký luk (Lvl 3+ zesílený reflexní luk)
        const bowCol = isLvl3 ? '#5d4037' : '#8d6e63';
        drawShape(ctx, c => {
          c.moveTo(9, -14);
          c.quadraticCurveTo(20, 0, 9, 14);
          c.lineTo(6.5, 12);
          c.quadraticCurveTo(15.5, 0, 6.5, -12);
          c.closePath();
        }, bowCol, OUTLINE, 1.8, true);

        if (isLvl3) {
          drawBox(ctx, 12.5, -3.5, 3, 7, 1, '#ffb300', OUTLINE, 1.3, false);
        }

        ctx.strokeStyle = '#eceff1';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(7.5, -13);
        ctx.lineTo(3, 0);
        ctx.lineTo(7.5, 13);
        ctx.stroke();
      }

      // 6. Šíp / Průrazná střela (při s.crit obří rudozlatý průrazný výstřel s jiskrami)
      if (state.crit) {
        drawHighlight(ctx, c => c.ellipse(17, 0, 13, 5, 0, 0, TAU), 'rgba(255, 23, 68, 0.38)');
        drawBox(ctx, 4, -1.8, 22, 3.6, 1, '#ffea00', OUTLINE, 1.4, false);
        drawShape(ctx, c => {
          c.moveTo(22, -5.5);
          c.lineTo(32, 0);
          c.lineTo(22, 5.5);
          c.lineTo(24.5, 0);
          c.closePath();
        }, '#ff1744', OUTLINE, 1.6, true);
      } else {
        drawBox(ctx, 5, -1, 17, 2, 0.5, '#d7ccc8', OUTLINE, 1.2, false);
        drawShape(ctx, c => {
          c.moveTo(20, -3);
          c.lineTo(26, 0);
          c.lineTo(20, 3);
          c.closePath();
        }, isLvl10 ? '#ffd740' : '#cfd8dc', OUTLINE, 1.3, false);
      }

      // 7. Hlava, hraničářský klobouk s perem / zlatá koruna lovce králů
      drawDisk(ctx, 1.5, 0, 5.6, '#ffccbc', OUTLINE, 1.7, false);

      const hatCol = isLvl20 ? '#263238' : (isLvl10 ? '#1b5e20' : '#33691e');
      drawShape(ctx, c => {
        c.moveTo(5.5, -5.5);
        c.quadraticCurveTo(-5, -8, -10.5, 0);
        c.quadraticCurveTo(-5, 8, 5.5, 5.5);
        c.closePath();
      }, hatCol, OUTLINE, 1.8, true);

      if (isLvl3) {
        // Červené nebo zlaté sokolí pero za kloboukem
        drawShape(ctx, c => {
          c.moveTo(-2, -4.5);
          c.quadraticCurveTo(-9, -11, -14, -7);
          c.quadraticCurveTo(-8, -4, -2, -4.5);
          c.closePath();
        }, isLvl20 ? '#ffd740' : '#ff1744', OUTLINE, 1.3, false);
      }

      if (isLvl20) {
        // Zlatá čelenka lovce králů
        drawShape(ctx, c => {
          c.moveTo(2, -5);
          c.lineTo(6.5, -6);
          c.lineTo(4.5, 0);
          c.lineTo(6.5, 6);
          c.lineTo(2, 5);
          c.closePath();
        }, '#ffd740', OUTLINE, 1.4, false);
      }

      ctx.restore();
    },

    // -------------------------------------------------------------------------
    // 2. RUNOVÁ ČARODĚJKA RADKA (carodejka_radka, poloměr 18 px)
    // -------------------------------------------------------------------------
    carodejka_radka: function (ctx, lvl, s) {
      ctx.save();
      const state = s || {};
      const isLvl3 = lvl >= 3;
      const isLvl10 = lvl >= 10;
      const isLvl20 = lvl >= 20;

      // 1. Zlatofialová runová aura na úrovni 20
      if (isLvl20) {
        drawDisk(ctx, 0, 0, 22.5, 'rgba(224, 64, 251, 0.26)', '#ffd740', 1.8, false);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 19.5, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2. Magický plášť a suknice
      const robeCol = isLvl20 ? '#212121' : (isLvl10 ? '#7b1fa2' : '#1565c0');
      const robeHi = isLvl20 ? '#455a64' : (isLvl10 ? '#ab47bc' : '#42a5f5');
      const trimCol = isLvl20 ? '#ffd740' : (isLvl10 ? '#ea80fc' : '#80d8ff');

      drawShape(ctx, c => {
        c.moveTo(2, -9.5);
        c.quadraticCurveTo(-8, -13, -14.5, -9);
        c.lineTo(-11.5, 0);
        c.lineTo(-14.5, 9);
        c.quadraticCurveTo(-8, 13, 2, 9.5);
        c.closePath();
      }, robeCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(1, -7.5);
        c.quadraticCurveTo(-6, -10, -12, -6.5);
        c.lineTo(-9, 0);
        c.lineTo(0, -2);
        c.closePath();
      }, robeHi);

      // Runový lem pláště (od Lvl 3)
      if (isLvl3) {
        ctx.strokeStyle = trimCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-13.5, -8);
        ctx.lineTo(-10.5, 0);
        ctx.lineTo(-13.5, 8);
        ctx.stroke();
      }

      // Lvl 10+: Dva levitující runové kameny za rameny
      if (isLvl10) {
        const gemCol = isLvl20 ? '#ffd740' : '#ea80fc';
        drawGem(ctx, -10, -11.5, 3.2, gemCol, '#ffffff', 6);
        drawGem(ctx, -10, 11.5, 3.2, gemCol, '#ffffff', 6);
      }

      // 3. Levá ruka (dole na +Y): Runové zaklínadlo při s.casting nebo připravená jiskra
      if (state.casting) {
        drawDisk(ctx, 8, 9, 5.5, 'rgba(0, 229, 255, 0.45)', '#00e5ff', 1.4, false);
        drawGem(ctx, 8, 9, 3.2, '#ffff00', '#ffffff', 4);
      } else if (isLvl3) {
        drawDisk(ctx, 6.5, 8.5, 2.8, '#00e5ff', OUTLINE, 1.2, false, '#ffffff');
      }

      // 4. Pravá ruka (nahoře na -Y): Runová hůl
      const staffCol = isLvl20 ? '#ffd740' : (isLvl10 ? '#cfd8dc' : '#6d4c41');
      drawBox(ctx, 2, -10.5, 16, 3, 1.2, staffCol, OUTLINE, 1.6, true);

      // Hlavice hole a krystal
      if (isLvl10) {
        // Půlměsícová hlavice kolem krystalu
        drawShape(ctx, c => {
          c.arc(18, -9, 6, PI * 0.4, PI * 1.6);
        }, null, isLvl20 ? '#ffd740' : '#e0e0e0', 2.2, false);
      }

      const crysR = state.casting ? 6.8 : (isLvl10 ? 5.2 : 4.2);
      const crysCol = isLvl20 ? '#ffea00' : (isLvl10 ? '#e040fb' : '#00e5ff');
      drawGem(ctx, 19.5, -9, crysR, crysCol, '#ffffff', 6);

      // 5. Efekty sesílání řetězových blesků (s.casting)
      if (state.casting) {
        ctx.save();
        ctx.strokeStyle = isLvl20 ? '#ffff00' : '#80d8ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        // Horní větev blesku
        ctx.moveTo(22, -9);
        ctx.lineTo(27, -15);
        ctx.lineTo(25, -18);
        ctx.lineTo(31, -21);
        // Střední a dolní větev blesku
        ctx.moveTo(23, -9);
        ctx.lineTo(29, -4);
        ctx.lineTo(26, 1);
        ctx.lineTo(32, 6);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Hlava, dlouhé ohnivě zrzavé vlasy a čelenka/diadém
      drawDisk(ctx, 2, 0, 5.5, '#ffccbc', OUTLINE, 1.7, false);

      // Bohaté zrzavé vlasy splývající dozadu
      drawShape(ctx, c => {
        c.moveTo(3, -5.5);
        c.quadraticCurveTo(-6, -9, -12, -5.5);
        c.lineTo(-9, 0);
        c.lineTo(-12, 5.5);
        c.quadraticCurveTo(-6, 9, 3, 5.5);
        c.arc(2, 0, 5.5, PI * 0.4, -PI * 0.4, true);
        c.closePath();
      }, '#ff6d00', OUTLINE, 1.7, true);

      drawHighlight(ctx, c => {
        c.ellipse(-3, -3.2, 4.5, 2, -0.2, 0, TAU);
      }, '#ffab40');

      // Čelenka / korunka s runovým drahokamem (od Lvl 3)
      if (isLvl3) {
        drawShape(ctx, c => {
          c.moveTo(3, -4.8);
          c.lineTo(7, 0);
          c.lineTo(3, 4.8);
        }, null, isLvl20 ? '#ffd740' : '#cfd8dc', 2.2, false);
        drawGem(ctx, 5.8, 0, 2.4, crysCol, '#ffffff', 4);
      }

      ctx.restore();
    },

    // -------------------------------------------------------------------------
    // 3. KRÁLOVSKÝ KRONIKÁŘ OSKAR (kronikar_oskar, poloměr 20 px)
    // -------------------------------------------------------------------------
    kronikar_oskar: function (ctx, lvl, s) {
      ctx.save();
      const state = s || {};
      const isLvl3 = lvl >= 3;
      const isLvl10 = lvl >= 10;
      const isLvl20 = lvl >= 20;

      // 1. Zlatobílá aura moudrosti na úrovni 20
      if (isLvl20) {
        drawDisk(ctx, 0, 0, 24, 'rgba(255, 249, 196, 0.35)', '#ffd740', 1.8, false);
        ctx.strokeStyle = '#ffca28';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 20.5, 0, TAU);
        ctx.stroke();
      }

      // 2. Učenecký plášť a štóla
      const robeCol = isLvl20 ? '#fff8e1' : (isLvl10 ? '#1b5e20' : '#bf360c');
      const robeHi = isLvl20 ? '#ffffff' : (isLvl10 ? '#43a047' : '#e64a19');
      const stoleCol = isLvl20 ? '#ffd740' : (isLvl10 ? '#ffca28' : '#d7ccc8');

      drawDisk(ctx, -1, 0, 10.5, robeCol, OUTLINE, 2, true, robeHi);

      // Učenecká štóla přes ramena
      drawShape(ctx, c => {
        c.arc(-1, 0, 10.5, -PI * 0.38, PI * 0.38);
        c.lineTo(-4, 6);
        c.lineTo(-4, -6);
        c.closePath();
      }, stoleCol, OUTLINE, 1.6, false);

      // Lvl 3+: Pouzdro se svitky a pečetěmi na zádech
      if (isLvl3) {
        drawBox(ctx, -13, -7, 5, 14, 2, '#5d4037', OUTLINE, 1.6, true, '#8d6e63');
        drawDisk(ctx, -10.5, -4, 2.2, '#fff9c4', OUTLINE, 1.1, false);
        drawDisk(ctx, -10.5, 4, 2.2, '#fff9c4', OUTLINE, 1.1, false);
        if (isLvl10) {
          // Červená královská pečeť na stuze
          drawDisk(ctx, -13, 0, 2.6, '#d50000', OUTLINE, 1.2, false, '#ff8a80');
        }
      }

      // 3. Velká otevřená Královská kronika v rukou před Oskarem (+X)
      const bookCov = isLvl20 ? '#ffb300' : (isLvl10 ? '#1565c0' : '#4e342e');
      drawBox(ctx, 6.5, -9.5, 11.5, 19, 2, bookCov, OUTLINE, 2, true, isLvl20 ? '#fff59d' : null);
      // Dvojstrana pergamenu
      drawBox(ctx, 8, -8, 8.8, 16, 1, '#fff9c4', OUTLINE, 1.3, false, '#ffffff');
      // Hřbet knihy uprostřed
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(16.8, 0);
      ctx.stroke();

      // Zlaté iluminace a runy na stránkách kroniky
      ctx.strokeStyle = isLvl10 ? '#d50000' : '#5d4037';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(10, -5); ctx.lineTo(15, -5);
      ctx.moveTo(10, -2.5); ctx.lineTo(14, -2.5);
      ctx.moveTo(10, 2.5); ctx.lineTo(15, 2.5);
      ctx.moveTo(10, 5); ctx.lineTo(14, 5);
      ctx.stroke();

      // 4. Brk v pravé ruce (nahoře na -Y): Lvl 1 bílý husí brk, Lvl 10+ zlaté fénixovo pero
      const quillCol = isLvl10 ? '#ffd740' : '#ffffff';
      drawShape(ctx, c => {
        c.moveTo(6, -10);
        c.quadraticCurveTo(13, -16, 19, -12);
        c.quadraticCurveTo(14, -9, 6, -10);
        c.closePath();
      }, quillCol, OUTLINE, 1.5, true);

      // 5. Efekty čtení ze svitků / kouzlení (s.casting nebo s.crit)
      if (state.casting || state.crit) {
        drawHighlight(ctx, c => c.arc(14, 0, 12, -PI * 0.45, PI * 0.45), 'rgba(255, 215, 64, 0.35)');
        // Tři vznášející se zlaté mince / magické pečetě před knihou
        for (const mPos of [[21, -6.5], [24, 0], [21, 6.5]]) {
          drawDisk(ctx, mPos[0], mPos[1], 3.2, '#ffd740', OUTLINE, 1.3, true, '#ffff00');
        }
        drawStarShape(ctx, 19, -11, 3.8, 1.5, 4, '#ffffff', OUTLINE, 1);
        drawStarShape(ctx, 19, 11, 3.8, 1.5, 4, '#ffffff', OUTLINE, 1);
      }

      // 6. Hlava, bílý plnovous mudrce, kulaté brýle a čapka/korunka
      drawDisk(ctx, 0.5, 0, 5.8, '#ffccbc', OUTLINE, 1.7, false);

      // Bílý vous vpředu kolem tváře
      drawShape(ctx, c => {
        c.arc(1, 0, 6.2, -PI * 0.4, PI * 0.4);
        c.lineTo(3, 0);
        c.closePath();
      }, '#eceff1', OUTLINE, 1.4, false);

      // Učenecký baret / čapka (na Lvl 20 se zlatým vavřínovým věncem)
      const capCol = isLvl20 ? '#ffb300' : (isLvl10 ? '#1b5e20' : '#b71c1c');
      drawDisk(ctx, -1.5, 0, 5.5, capCol, OUTLINE, 1.7, true, isLvl20 ? '#ffff8d' : null);

      // Kulaté učenecké brýle se zlatými obroučkami
      drawDisk(ctx, 4.2, -2.3, 2.2, '#e1f5fe', '#ffb300', 1.4, false, '#ffffff');
      drawDisk(ctx, 4.2, 2.3, 2.2, '#e1f5fe', '#ffb300', 1.4, false, '#ffffff');

      ctx.restore();
    }
  });
})();

// ─── Společné API věží a hrdinů (volá ho td-render.js) ─────────────────────
// Kreslíře dodávají části B a C (TDS.drawers, TDS.heroDrawers). Podstavec a
// věžička se předkreslí do cache podle úrovní; katapult (nabíjení), čepová věž
// (otáčení) a mrazivý mág se kreslí živě. TDS.cache a TDS._iconCache maže hra
// po ztrátě grafického kontextu.
(function () {
const TDS = window.TDS || (window.TDS = {});
TDS.cache = TDS.cache || {};
TDS._iconCache = TDS._iconCache || {};
function cached(key, size, draw) {
    let cvs = TDS.cache[key];
    if (!cvs) {
        cvs = document.createElement('canvas'); cvs.width = size; cvs.height = size;
        const ctx = cvs.getContext('2d'); ctx.translate(size / 2, size / 2); draw(ctx);
        TDS.cache[key] = cvs;
    }
    return cvs;
}
const LIVE = { oblehaci_katapult: 1, cepova_vez: 1, mrazivy_mag: 1 };
TDS.tower = function (ctx, id, x, y, r, ang, ts, up, s) {
    const drawer = TDS.drawers && TDS.drawers[id];
    if (!drawer) return;
    s = s || {};
    const size = Math.ceil(r * 4);
    const base = cached([id, 'base', up.join(), size].join('|'), size, c => drawer.base(c, up));
    ctx.save();
    if (s.buffed) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 64, 129, 0.3)'; ctx.fill(); }
    ctx.drawImage(base, x - size / 2, y - size / 2);
    ctx.translate(x, y);
    if (id === 'cepova_vez') ctx.rotate(ang + ts * ((up[1] >= 4 || up[2] >= 4) ? 0.005 : 0.002));
    else ctx.rotate(ang);
    if (LIVE[id]) drawer.turret(ctx, up, s);
    else ctx.drawImage(cached([id, 'turret', up.join(), s.mode || '', size].join('|'), size, c => drawer.turret(c, up, s)), -size / 2, -size / 2);
    if (s.beast) {   // proměna v běsa: pulzující růžová záře
        ctx.globalAlpha = 0.35 + Math.sin(ts * 0.012) * 0.15;
        ctx.fillStyle = '#e879f9';
        ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    if (s.firing > 0) {   // záblesk výstřelu před hlavní
        const d = id === 'orli_ostrostrelec' ? r + 15 : id === 'oblehaci_katapult' ? r + 5 : r;
        ctx.globalAlpha = s.firing;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath(); ctx.arc(d, 0, 8 + s.firing * 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    ctx.restore();
};
function icon(key, size, draw) {
    if (TDS._iconCache[key]) return TDS._iconCache[key];
    const cvs = document.createElement('canvas'); cvs.width = size; cvs.height = size;
    const ctx = cvs.getContext('2d');
    ctx.scale(size / 60, size / 60); ctx.translate(30, 30);   // věž/hrdina má poloměr kolem 20 → plocha 60×60
    draw(ctx);
    return (TDS._iconCache[key] = cvs);
}
TDS.towerIcon = function (id, size) {
    return icon(id + size, size, ctx => { const d = TDS.drawers && TDS.drawers[id]; if (d) { d.base(ctx, [0, 0, 0]); d.turret(ctx, [0, 0, 0], {}); } });
};
TDS.hero = function (ctx, id, x, y, r, ang, ts, lvl, s) {
    const draw = TDS.heroDrawers && TDS.heroDrawers[id];
    if (!draw) return;
    s = s || {};
    const size = Math.ceil(r * 4);
    const cvs = cached([id, 'hero', lvl, s.crit ? 1 : 0, s.casting ? 1 : 0, size].join('|'), size, c => draw(c, lvl, s));
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(cvs, -size / 2, -size / 2); ctx.restore();
};
TDS.heroIcon = function (id, size) {
    return icon('h' + id + size, size, ctx => { const d = TDS.heroDrawers && TDS.heroDrawers[id]; if (d) d(ctx, 1, {}); });
};
})();

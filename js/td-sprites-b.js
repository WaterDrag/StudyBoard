/**
 * Obrana království - Kreslící knihovna (Část B: věže 1–5) — vylepšené textury
 * Od Gemini; jen kreslíře věží (TDS.drawers), pomocné funkce lokální. Společné API je na konci části C.
 */
/**
 * Obrana království - Kreslící knihovna (Část B: Věže 1–5)
 * Čistý HTML5 Canvas 2D, detailní kreslené fantasy textury (dřevo, kámen, kov, látka, runy, krystaly).
 * Všechny pomocné funkce jsou lokální v uzávěru, do TDS se přidává pouze TDS.drawers.<id>.
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});
  TDS.drawers = TDS.drawers || {};

  // Lokální konstanty stylu
  const OUTLINE = '#111111';
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
  function rr(ctx, x, y, w, h, r) {
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

  /**
   * Vykreslí aktuální cestu s výplní a tmavým obrysem
   */
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

  /**
   * Vykreslí tvar s volitelným měkkým stínem vpravo dole a tmavým obrysem #111
   */
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

  /**
   * Vykreslí odlesk nebo barevný detail bez obrysu
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
   * Vykreslí kruh se stínem, obrysem a volitelným horním levým odleskem
   */
  function drawDisk(ctx, x, y, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => c.arc(x, y, r, 0, TAU), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => c.arc(x - r * 0.22, y - r * 0.22, r * 0.65, 0, TAU), hiFill);
    }
  }

  /**
   * Vykreslí obdélník se zaoblením, stínem a volitelným proužkem odlesku
   */
  function drawBox(ctx, x, y, w, h, r, fill, stroke = OUTLINE, lw = 2, hasShadow = true, hiFill = null) {
    drawShape(ctx, c => rr(c, x, y, w, h, r), fill, stroke, lw, hasShadow);
    if (hiFill) {
      drawHighlight(ctx, c => rr(c, x + 1.5, y + 1.5, Math.max(1, w - 3), Math.max(1, h * 0.38), r * 0.6), hiFill);
    }
  }

  /**
   * Vykreslí pravidelný mnohoúhelník
   */
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

  /**
   * Vykreslí kamenný kruhový podstavec s kvádry po obvodu a spárami
   */
  function drawStoneCircleBase(ctx, r, baseCol, blockCol, hiCol, crackSeed = 1) {
    // Základní stín a kamenný kruh
    drawDisk(ctx, 0, 0, r, baseCol, OUTLINE, 2.2, true);

    // Vnitřní prosvětlení shora zleva
    drawHighlight(ctx, c => c.arc(-r * 0.12, -r * 0.12, r * 0.78, 0, TAU), hiCol);

    // Kamenné obrubníky po obvodu
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const a1 = (i / segs) * TAU + 0.05;
      const a2 = ((i + 1) / segs) * TAU - 0.05;
      const isLit = i >= 3 && i <= 6;
      drawShape(ctx, c => {
        c.arc(0, 0, r, a1, a2);
        c.arc(0, 0, r * 0.72, a2, a1, true);
        c.closePath();
      }, isLit ? hiCol : blockCol, OUTLINE, 1.6, false);
    }

    // Drobné praskliny ve středu
    seed(crackSeed);
    ctx.save();
    ctx.strokeStyle = 'rgba(17,17,17,0.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.1);
    ctx.lineTo(0, r * 0.05);
    ctx.lineTo(r * 0.25, -r * 0.2);
    ctx.moveTo(0, r * 0.05);
    ctx.lineTo(-r * 0.1, r * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Vykreslí broušený drahokam nebo krystal s fazetou a odleskem
   */
  function drawGem(ctx, x, y, r, baseCol, hiCol) {
    drawShape(ctx, c => polyPath(c, x, y, r, 6, 0), baseCol, OUTLINE, 1.5, false);
    drawHighlight(ctx, c => {
      c.arc(x - r * 0.25, y - r * 0.25, r * 0.42, 0, TAU);
    }, hiCol);
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
  // 1. KRÁLOVSKÝ LUČIŠTNÍK (kralovsky_lucistnik, poloměr 18 px)
  // ============================================================================
  TDS.drawers.kralovsky_lucistnik = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      if (mp.path === 1 && mp.level >= 4) {
        // Cesta 1 Lvl 4-5: Královská mramorovo-zlatá bašta s větrnými runami
        const isLvl5 = mp.level >= 5;
        drawStoneCircleBase(
          ctx, 18,
          isLvl5 ? '#fff8e1' : '#cfd8dc',
          isLvl5 ? '#ffd54f' : '#90a4ae',
          '#ffffff',
          14
        );
        // Zlaté obrubníky a drahokamy
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 2 + PI / 4);
          drawBox(ctx, 13, -3.5, 6, 7, 1.5, '#ffb300', OUTLINE, 1.6, false, '#fff176');
          if (isLvl5) drawGem(ctx, 16, 0, 2.2, '#00e5ff', '#e0f7fa');
          ctx.restore();
        }
        // Větrný vír na podlaze u Lvl 5
        if (isLvl5) {
          ctx.strokeStyle = '#40c4ff';
          ctx.lineWidth = 1.6;
          for (let i = 0; i < 3; i++) {
            const a = (i * TAU) / 3;
            ctx.beginPath();
            ctx.arc(0, 0, 10, a, a + 1.3);
            ctx.stroke();
          }
        }
      } else if (mp.path === 2 && mp.level >= 4) {
        // Cesta 2 Lvl 4-5: Bouřná a větrná aréna s vírem listí/blesků
        drawStoneCircleBase(ctx, 18, '#607d8b', '#455a64', '#90a4ae', 24);
        const ringCol = mp.level >= 5 ? '#00e5ff' : '#ffab00';
        ctx.strokeStyle = ringCol;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = (i * PI) / 2;
          ctx.beginPath();
          ctx.arc(0, 0, 14, a, a + 0.9);
          ctx.stroke();
        }
      } else if (u2 >= 1) {
        // Cesta 3 Lvl 1+: Dřevěný stupínek (Lvl 1-3) nebo temná arbalestová pevnost (Lvl 4-5)
        if (mp.path === 3 && mp.level >= 4) {
          const isLvl5 = mp.level >= 5;
          drawStoneCircleBase(
            ctx, 18,
            isLvl5 ? '#311b92' : '#37474f',
            isLvl5 ? '#4a148c' : '#263238',
            isLvl5 ? '#7c4dff' : '#546e7a',
            34
          );
          // Krystalové pilíře po obvodu na Lvl 5
          for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate((i * PI) / 2);
            if (isLvl5) {
              drawGem(ctx, 16, 0, 3.5, '#e040fb', '#f3e5f5');
            } else {
              drawBox(ctx, 13, -3, 5, 6, 1, '#90a4ae', OUTLINE, 1.5, false);
            }
            ctx.restore();
          }
        } else {
          // Dřevěný vyvýšený stupínek s prkny a nýty
          drawDisk(ctx, 0, 0, 18, '#6d4c41', OUTLINE, 2.2, true);
          drawDisk(ctx, 0, 0, 15, '#8d6e63', OUTLINE, 1.8, false, '#a1887f');
          ctx.strokeStyle = '#3e2723';
          ctx.lineWidth = 1.4;
          for (let py = -10; py <= 10; py += 5) {
            ctx.beginPath();
            ctx.moveTo(-13, py);
            ctx.lineTo(13, py);
            ctx.stroke();
          }
          // Kovové hřeby v prknech
          ctx.fillStyle = '#cfd8dc';
          for (const nx of [-9, 9]) {
            for (const ny of [-7, 7]) {
              ctx.beginPath();
              ctx.arc(nx, ny, 1.2, 0, TAU);
              ctx.fill();
            }
          }
        }
      } else {
        // Základní kamenný podstavec s trávou u okraje
        drawStoneCircleBase(ctx, 17.5, '#78909c', '#546e7a', '#b0bec5', 1);
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // Určení barev pláště, zbroje a kapuce
      let cloakCol = '#2e7d32';
      let cloakHi = '#4caf50';
      let hoodCol = '#388e3c';
      let armorCol = null;

      if (u2 >= 2) { cloakCol = '#1b5e20'; cloakHi = '#388e3c'; hoodCol = '#1b5e20'; }
      if (mp.path === 1 && mp.level >= 3) { cloakCol = '#1565c0'; cloakHi = '#42a5f5'; hoodCol = '#1976d2'; }
      if (mp.path === 1 && mp.level >= 4) { armorCol = '#b0bec5'; cloakCol = '#0d47a1'; cloakHi = '#1e88e5'; }
      if (mp.path === 1 && mp.level >= 5) { armorCol = '#ffd54f'; cloakCol = '#fff8e1'; cloakHi = '#ffffff'; hoodCol = '#ffca28'; }

      if (mp.path === 2 && mp.level >= 3) { cloakCol = '#c62828'; cloakHi = '#ef5350'; hoodCol = '#d32f2f'; }
      if (mp.path === 2 && mp.level >= 5) { cloakCol = '#00838f'; cloakHi = '#26c6da'; hoodCol = '#00acc1'; }

      if (mp.path === 3 && mp.level >= 3) { armorCol = '#78909c'; cloakCol = '#4e342e'; cloakHi = '#795548'; }
      if (mp.path === 3 && mp.level >= 4) { armorCol = '#546e7a'; cloakCol = '#263238'; cloakHi = '#455a64'; }
      if (mp.path === 3 && mp.level >= 5) { armorCol = '#7b1fa2'; cloakCol = '#311b92'; cloakHi = '#6200ea'; hoodCol = '#4a148c'; }

      // Cesta 2 Lvl 5: Větrný vír kolem mistra tisíce šípů
      if (mp.path === 2 && mp.level >= 5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(128, 222, 234, 0.85)';
        ctx.lineWidth = 2.5;
        for (let w = 0; w < 3; w++) {
          const wa = (w * TAU) / 3;
          ctx.beginPath();
          ctx.arc(0, 0, 16, wa, wa + 1.5);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 1. Vlající plášť se záhyby vzadu (vlevo na -X)
      const capeLen = (mp.path === 1 && mp.level >= 5) ? -16 : -11;
      drawShape(ctx, c => {
        c.moveTo(2, -9);
        c.quadraticCurveTo(-6, -11, capeLen, -8);
        c.lineTo(capeLen + 2, 0);
        c.lineTo(capeLen, 8);
        c.quadraticCurveTo(-6, 11, 2, 9);
        c.closePath();
      }, cloakCol, OUTLINE, 2, true);

      // Světlejší záhyb látky shora zleva
      drawHighlight(ctx, c => {
        c.moveTo(1, -7.5);
        c.quadraticCurveTo(-5, -9, capeLen + 1.5, -6);
        c.lineTo(capeLen + 3, -1);
        c.lineTo(0, -2);
        c.closePath();
      }, cloakHi);

      // Zlatý lem pláště pro Cestu 1 Lvl 4+
      if (mp.path === 1 && mp.level >= 4) {
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(capeLen, -7.5);
        ctx.lineTo(capeLen + 2, 0);
        ctx.lineTo(capeLen, 7.5);
        ctx.stroke();
      }

      // 2. Toulec se šípy na zádech (a druhý u pasu pro Cestu 2 Lvl 2+)
      const drawQuiver = (qx, qy, rot) => {
        ctx.save();
        ctx.translate(qx, qy);
        ctx.rotate(rot);
        drawBox(ctx, -4, -2.5, 8, 5, 2, '#5d4037', OUTLINE, 1.5, false, '#8d6e63');
        // Letky šípů vykukující z toulce
        const fletchCol = u1 >= 4 ? '#ffd740' : (u0 >= 1 ? '#b0bec5' : '#ffffff');
        ctx.fillStyle = fletchCol;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1;
        for (let a = -1.5; a <= 1.5; a += 1.5) {
          ctx.beginPath();
          ctx.arc(-4.5, a, 1.6, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      };
      drawQuiver(-5, -6, -0.5);
      if (u1 >= 2) drawQuiver(-3, 7.5, 0.5); // Druhý otevřený toulec u pasu

      // 3. Tělo a nárameníky (zbroj)
      if (armorCol) {
        drawDisk(ctx, 0, 0, 8.5, armorCol, OUTLINE, 2, false, '#ffffff');
        // Nárameníky
        drawDisk(ctx, 1, -7.5, 4, armorCol, OUTLINE, 1.6, false);
        drawDisk(ctx, 1, 7.5, 4, armorCol, OUTLINE, 1.6, false);
      } else {
        drawDisk(ctx, 0, 0, 7.5, cloakCol, OUTLINE, 1.8, false, cloakHi);
      }

      // 4. Zbraň: Kuše / Arbalest (Cesta 3 Lvl 3+) NEBO Luk (ostatní)
      const isCrossbow = (mp.path === 3 && mp.level >= 3);
      if (isCrossbow) {
        const isLvl4 = mp.level >= 4;
        const isLvl5 = mp.level >= 5;
        const stockCol = isLvl5 ? '#311b92' : (isLvl4 ? '#37474f' : '#6d4c41');
        const bowCol = isLvl5 ? '#e040fb' : (isLvl4 ? '#90a4ae' : '#78909c');

        // Napínací rumpál vzadu na pažbě
        drawBox(ctx, 2, -4, 4, 8, 1, '#b0bec5', OUTLINE, 1.5, false);

        // Masivní pažba kuše
        drawBox(ctx, 4, -3, 18, 6, 2, stockCol, OUTLINE, 2, true);

        // Ocelové/krystalové lučiště
        drawShape(ctx, c => {
          c.moveTo(18, -15);
          c.quadraticCurveTo(25, 0, 18, 15);
          c.lineTo(15, 13);
          c.quadraticCurveTo(21, 0, 15, -13);
          c.closePath();
        }, bowCol, OUTLINE, 2, true);

        // Zářící runy na lučišti (Lvl 4+) a krystaly (Lvl 5)
        if (isLvl4) {
          ctx.strokeStyle = isLvl5 ? '#ea80fc' : '#00e5ff';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(18, -11);
          ctx.lineTo(20, -4);
          ctx.moveTo(18, 11);
          ctx.lineTo(20, 4);
          ctx.stroke();
        }
        if (isLvl5) {
          drawGem(ctx, 13, 0, 3.5, '#aa00ff', '#ea80fc');
          drawGem(ctx, 18, -13, 2.5, '#00e5ff', '#e0f7fa');
          drawGem(ctx, 18, 13, 2.5, '#00e5ff', '#e0f7fa');
        }

        // Tětiva a založená střela
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(17, -13);
        ctx.lineTo(8, 0);
        ctx.lineTo(17, 13);
        ctx.stroke();

        // Průrazná šipka v kuši
        drawShape(ctx, c => {
          c.moveTo(8, -1);
          c.lineTo(24, -1);
          c.lineTo(27, 0);
          c.lineTo(24, 1);
          c.lineTo(8, 1);
          c.closePath();
        }, isLvl5 ? '#ea80fc' : '#eceff1', OUTLINE, 1.4, false);

      } else {
        // LUK (Krátký, Dlouhý, Reflexní, Větrný)
        const bowHalfH = (u2 >= 1 || (mp.path === 1 && mp.level >= 4)) ? 15.5 : 12;
        let bowWood = '#8d6e63';
        let bowHi = '#bcaaa4';
        if (mp.path === 1 && mp.level >= 4) { bowWood = '#ffb300'; bowHi = '#fff176'; }
        if (mp.path === 1 && mp.level >= 5) { bowWood = '#e0f7fa'; bowHi = '#ffffff'; }
        if (mp.path === 2 && mp.level >= 4) { bowWood = '#ff6f00'; bowHi = '#ffd740'; }

        // Ruce lučištníka (kožený nátepník Cesta 1 Lvl 1+, zelené rukavice Cesta 2 Lvl 1+)
        const handCol = u1 >= 1 ? '#43a047' : (u0 >= 1 ? '#5d4037' : '#ffccbc');
        drawDisk(ctx, 11, -3, 2.8, handCol, OUTLINE, 1.4, false);
        drawDisk(ctx, 5, 3, 2.8, handCol, OUTLINE, 1.4, false);

        // Tětiva (zelené hedvábí pro Cestu 2 Lvl 1+)
        ctx.strokeStyle = u1 >= 1 ? '#69f0ae' : '#eceff1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(9, -bowHalfH + 1);
        ctx.lineTo(4, 0);
        ctx.lineTo(9, bowHalfH - 1);
        ctx.stroke();

        // Tělo luku (reflexní tvar)
        drawShape(ctx, c => {
          c.moveTo(9, -bowHalfH);
          c.quadraticCurveTo(19, -bowHalfH * 0.4, 15, 0);
          c.quadraticCurveTo(19, bowHalfH * 0.4, 9, bowHalfH);
          c.quadraticCurveTo(15, bowHalfH * 0.4, 12, 0);
          c.quadraticCurveTo(15, -bowHalfH * 0.4, 9, -bowHalfH);
          c.closePath();
        }, bowWood, OUTLINE, 2, true);

        // Odlesk dřeva luku
        drawHighlight(ctx, c => {
          c.moveTo(10, -bowHalfH * 0.8);
          c.quadraticCurveTo(16, -bowHalfH * 0.3, 14, 0);
          c.lineTo(12.5, 0);
          c.closePath();
        }, bowHi);

        // Kovové pláty na luku (Cesta 1 Lvl 2+)
        if (u0 >= 2) {
          drawBox(ctx, 11.5, -3.5, 4, 7, 1, '#b0bec5', OUTLINE, 1.4, false, '#ffffff');
        }

        // Oranžové jiskry kolem luku (Cesta 2 Lvl 4+)
        if (mp.path === 2 && mp.level >= 4) {
          ctx.strokeStyle = '#ffea00';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(14, -9); ctx.lineTo(18, -7); ctx.lineTo(15, -4);
          ctx.moveTo(14, 9); ctx.lineTo(18, 7); ctx.lineTo(15, 4);
          ctx.stroke();
        }

        // Šípy založené na tětivě (1, 3 pro Trojitou salvu, 5 pro Mistra tisíce šípů)
        let arrowCount = 1;
        if (mp.path === 1 && mp.level >= 3) arrowCount = 3;
        if (mp.path === 2 && mp.level >= 5) arrowCount = 5;

        for (let i = 0; i < arrowCount; i++) {
          const spread = (i - (arrowCount - 1) * 0.5) * 0.16;
          ctx.save();
          ctx.translate(4, 0);
          ctx.rotate(spread);

          // Dřík šípu
          ctx.strokeStyle = OUTLINE;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(16, 0);
          ctx.stroke();

          ctx.strokeStyle = (mp.path === 1 && mp.level >= 5) ? '#80d8ff' : '#d7ccc8';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(16, 0);
          ctx.stroke();

          // Hrot šípu (kovaný / zubatý se zpětnými háčky)
          const tipCol = (mp.path === 1 && mp.level >= 5) ? '#00e5ff' : (u0 >= 1 ? '#cfd8dc' : '#90a4ae');
          const barb = u0 >= 2 ? 4 : 2.5;
          drawShape(ctx, c => {
            c.moveTo(15, -barb);
            c.lineTo(21, 0);
            c.lineTo(15, barb);
            if (u0 >= 2) c.lineTo(16.8, 0);
            c.closePath();
          }, tipCol, OUTLINE, 1.3, false);

          ctx.restore();
        }
      }

      // 5. Hlava, kapuce, přilba nebo čelenka se sokolím perem
      drawDisk(ctx, 0, 0, 6.5, '#ffccbc', OUTLINE, 1.8, true);

      // Kapuce / Přilba kryjící zadní část hlavy
      drawShape(ctx, c => {
        c.arc(0, 0, 7, PI * 0.35, PI * 1.65);
        c.quadraticCurveTo(4, 0, 2, 6);
        c.closePath();
      }, hoodCol, OUTLINE, 1.8, false);

      // Odlesk na kapuci shora zleva
      drawHighlight(ctx, c => {
        c.arc(-1.5, -2, 3.8, 0, TAU);
      }, cloakHi);

      // Cesta 1 Lvl 4+: Zlatá korunka / čelenka velitele
      if (mp.path === 1 && mp.level >= 4) {
        drawShape(ctx, c => {
          c.moveTo(2, -5.5);
          c.lineTo(6, -3);
          c.lineTo(4, 0);
          c.lineTo(6, 3);
          c.lineTo(2, 5.5);
        }, '#ffd740', OUTLINE, 1.4, false);
      }

      // Cesta 2 Lvl 3+: Červená čelenka se sokolím perem
      if (mp.path === 2 && mp.level >= 3) {
        drawBox(ctx, 1, -6.5, 3, 13, 1, '#d32f2f', OUTLINE, 1.3, false);
        // Sokolí pero vzadu
        drawShape(ctx, c => {
          c.moveTo(-2, -5);
          c.quadraticCurveTo(-10, -13, -15, -9);
          c.quadraticCurveTo(-9, -5, -2, -3);
          c.closePath();
        }, '#ffca28', OUTLINE, 1.4, false);
      }

      // Oči (Sovy v očích na Cestě 3 Lvl 2+ svítí jantarově/fialově)
      const glowEyes = u2 >= 2;
      ctx.fillStyle = glowEyes ? (mp.level >= 5 ? '#ea80fc' : '#ffab00') : '#111111';
      ctx.beginPath();
      ctx.arc(4.2, -2.2, glowEyes ? 1.6 : 1.1, 0, TAU);
      ctx.arc(4.2, 2.2, glowEyes ? 1.6 : 1.1, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  };

  // ============================================================================
  // 2. ČEPOVÁ VĚŽ (cepova_vez, poloměr 20 px)
  // ============================================================================
  TDS.drawers.cepova_vez = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      if (mp.path === 1 && mp.level >= 4) {
        // Cesta 1 Lvl 4-5: Ohnivý prstenec / Sopečná čedičová výheň s lávou
        const isLava = mp.level >= 5;
        // Žhnoucí prstenec ohně/lávy kolem věže
        drawDisk(ctx, 0, 0, 23, isLava ? '#d50000' : '#ff6d00', OUTLINE, 2, true);
        drawHighlight(ctx, c => c.arc(0, 0, 20.5, 0, TAU), '#ffab00');
        drawHighlight(ctx, c => c.arc(0, 0, 18.5, 0, TAU), '#ffee58');

        // Čedičový osmiúhelník podstavce
        drawShape(ctx, c => polyPath(c, 0, 0, 18.5, 8, PI / 8), isLava ? '#212121' : '#37474f', OUTLINE, 2.2, false);
        // Lávové praskliny v podstavci
        if (isLava) {
          ctx.strokeStyle = '#ff3d00';
          ctx.lineWidth = 1.8;
          for (let i = 0; i < 4; i++) {
            const a = (i * PI) / 2 + 0.3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
            ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
            ctx.stroke();
          }
        }
      } else if (mp.path === 3 && mp.level >= 3) {
        // Cesta 3 Lvl 3-5: Černo-zlatá trpasličí bašta (Drtič obrů / Pevnost tisíce hrotů)
        drawStoneCircleBase(ctx, 20.5, '#263238', '#ffb300', '#ffe082', 33);
        // Zlaté výstražné šrafování / zuby po obvodu
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 4);
          drawBox(ctx, 16, -3.5, 5, 7, 1.2, i % 2 === 0 ? '#ffb300' : '#212121', OUTLINE, 1.5, false);
          ctx.restore();
        }
      } else {
        // Standardní nebo ocelový podstavec s ozubenými patkami
        const bCol = u1 >= 2 ? '#455a64' : '#607d8b';
        const hiCol = u1 >= 2 ? '#90a4ae' : '#b0bec5';
        drawStoneCircleBase(ctx, 20, bCol, '#37474f', hiCol, 20);

        // Mosazná ozubená kola (Cesta 1 Lvl 1+) nebo ocelové patky po obvodu
        const gearCol = u0 >= 1 ? '#ffca28' : '#90a4ae';
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 4);
          drawBox(ctx, 16, -3, 5.5, 6, 1.5, gearCol, OUTLINE, 1.6, false);
          ctx.restore();
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // 1. Výběžky po obvodu: Dračí hlavy (C1), Pilové kotouče/Kosy (C2) nebo Hlavně a Hroty (C3/Základ)
      if (mp.path === 1 && mp.level >= 3) {
        // Cesta 1 Lvl 3-5: 8 měděných/zlatých dračích hlav chrlících plameny
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 4);

          // Plamínek šlehající z tlamy draka
          drawShape(ctx, c => {
            c.moveTo(18, -3.5);
            c.quadraticCurveTo(25, -5, 29, 0);
            c.quadraticCurveTo(25, 5, 18, 3.5);
            c.closePath();
          }, '#ff3d00', OUTLINE, 1.3, false);
          drawHighlight(ctx, c => {
            c.moveTo(18, -1.8);
            c.lineTo(25, 0);
            c.lineTo(18, 1.8);
            c.closePath();
          }, '#ffea00');

          // Měděná dračí hlava s rohy
          const headCol = mp.level >= 5 ? '#ffb300' : '#d84315';
          const headHi = mp.level >= 5 ? '#fff176' : '#ff8a65';
          drawShape(ctx, c => {
            c.moveTo(11, -5);
            c.lineTo(19, -3.5);
            c.lineTo(20, 0);
            c.lineTo(19, 3.5);
            c.lineTo(11, 5);
            c.closePath();
          }, headCol, OUTLINE, 1.6, false);
          drawHighlight(ctx, c => c.rect(12, -3, 5, 2.5), headHi);

          // Žhnoucí oči draka
          ctx.fillStyle = '#ffff00';
          ctx.fillRect(14, -2.8, 1.6, 1.4);
          ctx.fillRect(14, 1.4, 1.6, 1.4);

          ctx.restore();
        }
      } else if (mp.path === 2 && mp.level >= 3) {
        // Cesta 2 Lvl 3-5: Vrhač čepelí / Smršť čepelí / Královský mlýnek s kosami
        const isScythe = mp.level >= 5;
        const sawCount = mp.level >= 4 ? 8 : 6;
        for (let i = 0; i < sawCount; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / sawCount);
          if (isScythe) {
            // Obří zlatocerná zahnutá kosa Královského mlýnku
            drawShape(ctx, c => {
              c.moveTo(10, -3);
              c.quadraticCurveTo(22, -12, 28, 4);
              c.quadraticCurveTo(20, 0, 10, 3);
              c.closePath();
            }, '#eceff1', OUTLINE, 1.8, true);
            drawHighlight(ctx, c => {
              c.moveTo(12, -2);
              c.quadraticCurveTo(21, -8, 25, 1);
              c.closePath();
            }, '#ffffff');
            // Zlaté uchycení kosy
            drawBox(ctx, 10, -3.5, 5, 7, 1.5, '#ffb300', OUTLINE, 1.5, false);
          } else {
            // Ozubený pilový kotouč
            const sx = 17;
            drawDisk(ctx, sx, 0, 7, '#cfd8dc', OUTLINE, 1.6, true, '#ffffff');
            // Zuby pily
            for (let z = 0; z < 6; z++) {
              const za = (z * TAU) / 6;
              ctx.beginPath();
              ctx.arc(sx + Math.cos(za) * 7, Math.sin(za) * 7, 1.5, 0, TAU);
              ctx.fillStyle = '#90a4ae';
              ctx.fill();
            }
            drawDisk(ctx, sx, 0, 2.5, '#455a64', OUTLINE, 1.3, false);
          }
          ctx.restore();
        }
        // Druhé menší patro pilových kotoučů pro Lvl 4 (Smršť čepelí)
        if (mp.level === 4) {
          for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.rotate((i * TAU) / 6 + 0.5);
            drawDisk(ctx, 12, 0, 5, '#eceff1', OUTLINE, 1.4, false);
            ctx.restore();
          }
        }
      } else {
        // Hlavně a čepy (Základ + Cesta 3: 4, 8, 12, 16 nebo 24/32 zlatých hlavní)
        let spikeCount = 4;
        if (u2 >= 1) spikeCount = 8;
        if (u2 >= 2) spikeCount = 12;
        if (mp.path === 3 && mp.level >= 4) spikeCount = 16;
        if (mp.path === 3 && mp.level >= 5) spikeCount = 24;

        const spikeLen = (u1 >= 1 ? 12 : 8) + (mp.path === 3 && mp.level >= 3 ? 4 : 0);
        const isGoldSpike = mp.path === 3 && mp.level >= 5;
        const isHotSpike = u0 >= 2;

        for (let i = 0; i < spikeCount; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / spikeCount);

          // Kovová hlaveň (střílna)
          const barrelCol = isGoldSpike ? '#ffb300' : '#546e7a';
          drawBox(ctx, 10, -2.6, 5.5, 5.2, 1, barrelCol, OUTLINE, 1.4, false);

          // Samotný ostrý hrot / kopí
          const tipCol = isHotSpike ? '#ff6d00' : (isGoldSpike ? '#ffe082' : '#cfd8dc');
          const tipHi = isHotSpike ? '#ffea00' : '#ffffff';
          drawShape(ctx, c => {
            c.moveTo(14, -2.5);
            c.lineTo(14 + spikeLen, 0);
            c.lineTo(14, 2.5);
            c.closePath();
          }, tipCol, OUTLINE, 1.4, false);

          drawHighlight(ctx, c => {
            c.moveTo(14, -2);
            c.lineTo(14 + spikeLen * 0.85, 0);
            c.lineTo(14, 0);
            c.closePath();
          }, tipHi);

          ctx.restore();
        }
      }

      // 2. Hlavní tělo věže (Dřevěný sud, Ocelový válcový plášť, Čedičový kráter nebo Trpasličí pevnost)
      let bodyCol = '#795548';
      let bodyHi = '#a1887f';
      let ringCol = '#455a64';

      if (u0 >= 1) ringCol = '#ffca28'; // Mosazné obruče
      if (u1 >= 2) { bodyCol = '#607d8b'; bodyHi = '#90a4ae'; ringCol = '#cfd8dc'; } // Ocelové pláty
      if (mp.path === 1 && mp.level >= 3) { bodyCol = '#bf360c'; bodyHi = '#e64a19'; ringCol = '#ffb300'; }
      if (mp.path === 1 && mp.level >= 5) { bodyCol = '#212121'; bodyHi = '#424242'; ringCol = '#ff3d00'; }
      if (mp.path === 2 && mp.level >= 5) { bodyCol = '#212121'; bodyHi = '#37474f'; ringCol = '#ffd740'; }
      if (mp.path === 3 && mp.level >= 3) { bodyCol = '#263238'; bodyHi = '#455a64'; ringCol = '#ffb300'; }

      // Hlavní buben věže
      drawDisk(ctx, 0, 0, 14.5, bodyCol, OUTLINE, 2.2, true, bodyHi);

      // Dřevěné spáry prken nebo ocelové nýty na plášti
      ctx.strokeStyle = 'rgba(17,17,17,0.45)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 6; i++) {
        const a = (i * PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
        ctx.stroke();
      }

      // Kovová obruč s nýty
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 11.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Nýty na obruči
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const a = (i * PI) / 4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 11.5, Math.sin(a) * 11.5, 1.1, 0, TAU);
        ctx.fill();
      }

      // 3. Vrcholový střed věže (Kovářská výheň, Lávový kráter, Parní stroj nebo Královská koruna)
      if (mp.path === 3 && mp.level >= 5) {
        // Zlatá královská koruna s drahokamem
        drawDisk(ctx, 0, 0, 8, '#ffb300', OUTLINE, 2, false, '#fff176');
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6;
          drawDisk(ctx, Math.cos(a) * 6.5, Math.sin(a) * 6.5, 2, '#ffd740', OUTLINE, 1.3, false);
        }
        drawGem(ctx, 0, 0, 3.5, '#d50000', '#ff8a80');
      } else if (mp.path === 3 && mp.level === 4) {
        // Parní stroj s mosaznými písty a manometrem
        drawDisk(ctx, 0, 0, 7.5, '#b0bec5', OUTLINE, 1.8, false, '#eceff1');
        drawBox(ctx, -6, -2, 12, 4, 1, '#ffca28', OUTLINE, 1.4, false);
        drawDisk(ctx, 0, 0, 3.2, '#263238', OUTLINE, 1.4, false);
      } else if (u0 >= 2) {
        // Planoucí výheň nebo sopečný jícen
        drawDisk(ctx, 0, 0, 7.5, '#bf360c', OUTLINE, 2, false);
        drawDisk(ctx, 0, 0, 5.5, '#ff6d00', null, 0, false);
        drawDisk(ctx, -1, -1, 3, '#ffff00', null, 0, false);
      } else {
        // Středový čep s ozubeným kolem
        drawDisk(ctx, 0, 0, 6, '#37474f', OUTLINE, 1.8, false, '#78909c');
        drawDisk(ctx, 0, 0, 2.5, u0 >= 1 ? '#ffca28' : '#cfd8dc', OUTLINE, 1.4, false);
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 3. MRAZIVÝ MÁG (mrazivy_mag, poloměr 20 px)
  // ============================================================================
  TDS.drawers.mrazivy_mag = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // Cesta 2 Lvl 2+: Sněhová pokrývka / polární aura pod podstavcem
      if (u1 >= 2) {
        drawDisk(ctx, 0, 0, 22, '#e1f5fe', OUTLINE, 1.8, true, '#ffffff');
      }

      // Cesta 1 Lvl 5: Mrazem rozpukaná země kolem Krále věčné zimy
      if (mp.path === 1 && mp.level >= 5) {
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 4 + 0.2);
          drawShape(ctx, c => {
            c.moveTo(14, -4);
            c.lineTo(25, 0);
            c.lineTo(14, 4);
            c.closePath();
          }, '#40c4ff', OUTLINE, 1.6, false);
          ctx.restore();
        }
      }

      // Ledový šestiúhelníkový podstavec s krystalickými fazetami
      const hexR = 19.5;
      drawShape(ctx, c => polyPath(c, 0, 0, hexR, 6, 0), '#4fc3f7', OUTLINE, 2.2, true);

      // Světlejší horní levé fazety ledu
      drawHighlight(ctx, c => {
        c.moveTo(0, 0);
        c.lineTo(Math.cos(PI) * hexR, Math.sin(PI) * hexR);
        c.lineTo(Math.cos((4 * PI) / 3) * hexR, Math.sin((4 * PI) / 3) * hexR);
        c.lineTo(Math.cos((5 * PI) / 3) * hexR, Math.sin((5 * PI) / 3) * hexR);
        c.closePath();
      }, '#b3e5fc');

      // Vnitřní ledová plocha
      drawShape(ctx, c => polyPath(c, 0, 0, hexR * 0.72, 6, 0), '#81d4fa', OUTLINE, 1.5, false);

      // Cesta 1 Lvl 3+: Zářící vytesané modré runy křehkosti
      if (mp.path === 1 && mp.level >= 3) {
        ctx.strokeStyle = '#e0f7fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i * PI) / 3;
          ctx.moveTo(Math.cos(a) * -11, Math.sin(a) * -11);
          ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        }
        ctx.stroke();
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // SPECIÁLNÍ PŘÍPAD 1: Cesta 2 Lvl 5 — Posel doby ledové (Majestátní ledová svatyně s obřím krystalem)
      if (mp.path === 2 && mp.level >= 5) {
        // 6 ledových pilířů svatyně po obvodu
        for (let i = 0; i < 6; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / 6);
          drawShape(ctx, c => {
            c.moveTo(11, -4);
            c.lineTo(21, 0);
            c.lineTo(11, 4);
            c.closePath();
          }, '#80d8ff', OUTLINE, 1.8, false);
          drawHighlight(ctx, c => {
            c.moveTo(11, -3);
            c.lineTo(19, 0);
            c.lineTo(11, 0);
            c.closePath();
          }, '#ffffff');
          ctx.restore();
        }
        // Obří centrální azurový krystal
        drawShape(ctx, c => polyPath(c, 0, 0, 12, 8, 0), '#00b0ff', OUTLINE, 2.2, true);
        drawShape(ctx, c => polyPath(c, 0, 0, 7.5, 8, PI / 8), '#80d8ff', OUTLINE, 1.5, false);
        drawHighlight(ctx, c => c.arc(-2.5, -2.5, 4, 0, TAU), '#ffffff');
        ctx.restore();
        return;
      }

      // SPECIÁLNÍ PŘÍPAD 2: Cesta 3 Lvl 5 — Titán ledovce (Obří ledový golem s runovým dělem na rameni)
      if (mp.path === 3 && mp.level >= 5) {
        // Masivní ledová ramena golema
        drawShape(ctx, c => polyPath(c, -2, -12, 8.5, 6, 0.2), '#4fc3f7', OUTLINE, 2, true);
        drawHighlight(ctx, c => c.arc(-4, -14, 4, 0, TAU), '#e1f5fe');
        drawShape(ctx, c => polyPath(c, -2, 12, 8.5, 6, -0.2), '#4fc3f7', OUTLINE, 2, true);

        // Trup golema z čistého ledu
        drawShape(ctx, c => polyPath(c, 0, 0, 11.5, 6, 0), '#0288d1', OUTLINE, 2.2, true);
        drawHighlight(ctx, c => polyPath(c, -1.5, -1.5, 7.5, 6, 0), '#81d4fa');

        // Runové ledové dělo na pravém rameni
        drawBox(ctx, 0, 6, 22, 8, 2, '#263238', OUTLINE, 2, true, '#546e7a');
        drawBox(ctx, 19, 5, 5, 10, 1.5, '#00e5ff', OUTLINE, 1.6, false, '#ffffff');
        // Zářící runy na hlavni děla
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(5, 10); ctx.lineTo(15, 10);
        ctx.stroke();

        // Hranatá krystalická hlava golema se žhnoucíma očima
        drawShape(ctx, c => polyPath(c, 3, 0, 6.5, 6, 0), '#e1f5fe', OUTLINE, 2, false);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(5.5, -3.5, 2.5, 2);
        ctx.fillRect(5.5, 1.5, 2.5, 2);

        ctx.restore();
        return;
      }

      // STANDARDNÍ MÁG A OSTATNÍ VYLEPŠENÍ
      // Polární záře / hermelínový plášť (Cesta 1 Lvl 4+)
      const isHermelin = mp.path === 1 && mp.level === 4;
      const isIceKing = mp.path === 1 && mp.level >= 5;
      let robeCol = u0 >= 1 ? '#29b6f6' : '#0288d1';
      let robeHi = '#81d4fa';
      if (isHermelin) { robeCol = '#f5f5f5'; robeHi = '#ffffff'; }
      if (isIceKing) { robeCol = '#00e5ff'; robeHi = '#e0f7fa'; }
      if (mp.path === 3 && mp.level >= 3) { robeCol = '#01579b'; robeHi = '#0288d1'; }
      if (mp.path === 3 && mp.level === 4) { robeCol = '#90a4ae'; robeHi = '#cfd8dc'; } // Těžká ledová zbroj

      // 1. Plášť mága
      drawShape(ctx, c => {
        c.moveTo(3, -9);
        c.quadraticCurveTo(-7, -12, -13, -8);
        c.lineTo(-11, 0);
        c.lineTo(-13, 8);
        c.quadraticCurveTo(-7, 12, 3, 9);
        c.closePath();
      }, robeCol, OUTLINE, 2, true);

      drawHighlight(ctx, c => {
        c.moveTo(2, -7.5);
        c.quadraticCurveTo(-6, -9, -11, -6);
        c.lineTo(-9, 0);
        c.lineTo(1, -2);
        c.closePath();
      }, robeHi);

      // Černé tečky královského hermelínu (Cesta 1 Lvl 4)
      if (isHermelin) {
        ctx.fillStyle = '#111111';
        for (const pt of [[-9, -5], [-7, 0], [-9, 5], [-4, -6], [-4, 6]]) {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 1.1, 0, TAU);
          ctx.fill();
        }
      }

      // Cesta 3 Lvl 3+: Ostré ledové ostny na rukávech
      if (mp.path === 3 && mp.level >= 3) {
        for (const side of [-1, 1]) {
          drawShape(ctx, c => {
            c.moveTo(-1, side * 8);
            c.lineTo(6, side * 15);
            c.lineTo(5, side * 8);
            c.closePath();
          }, '#e1f5fe', OUTLINE, 1.5, false);
        }
      }

      // 2. Levá ruka: Modrý magický vějíř (Cesta 2 Lvl 1+)
      if (u1 >= 1) {
        ctx.save();
        ctx.translate(6, -8);
        ctx.rotate(-0.4);
        drawShape(ctx, c => {
          c.moveTo(0, 0);
          c.arc(0, 0, 8.5, -1.1, 1.1);
          c.closePath();
        }, '#00b0ff', OUTLINE, 1.6, true);
        drawHighlight(ctx, c => {
          c.moveTo(0, 0);
          c.arc(0, 0, 6, -0.9, 0.2);
          c.closePath();
        }, '#b3e5fc');
        ctx.restore();
      }

      // 3. Pravá ruka: Hůl / Žezlo / Zkřížené čepele / Ledové kopí
      if (mp.path === 3 && mp.level === 4) {
        // Obří oštěp z čistého ledu (Kopí severu)
        drawShape(ctx, c => {
          c.moveTo(-4, 6);
          c.lineTo(14, 6);
          c.lineTo(14, 3);
          c.lineTo(26, 7.5);
          c.lineTo(14, 12);
          c.lineTo(14, 9);
          c.lineTo(-4, 9);
          c.closePath();
        }, '#80d8ff', OUTLINE, 1.8, true);
        drawHighlight(ctx, c => {
          c.moveTo(14, 4.5);
          c.lineTo(23, 7.5);
          c.lineTo(14, 7.5);
          c.closePath();
        }, '#ffffff');
      } else {
        // Žezlo nebo hůl
        const staffCol = u2 >= 1 ? '#4fc3f7' : '#6d4c41';
        drawBox(ctx, 2, 5.5, 16, 3, 1.2, staffCol, OUTLINE, 1.6, true);

        // Zkřížené ledové čepele na žezle (Cesta 3 Lvl 2+)
        if (u2 >= 2) {
          drawShape(ctx, c => {
            c.moveTo(15, 1);
            c.lineTo(21, 7);
            c.lineTo(15, 13);
            c.lineTo(13, 7);
            c.closePath();
          }, '#b3e5fc', OUTLINE, 1.5, false);
        }

        // Krystal na vrcholu hole
        const crSize = u0 >= 1 ? 5.5 : 3.8;
        drawGem(ctx, 19, 7, crSize, '#00e5ff', '#ffffff');
      }

      // 4. Hlava, kapuce a ledová koruna
      drawDisk(ctx, 0, 0, 6.8, isIceKing ? '#80d8ff' : robeCol, OUTLINE, 1.8, true, robeHi);
      if (!isIceKing) {
        drawDisk(ctx, 2.2, 0, 4.5, '#ffccbc', OUTLINE, 1.4, false);
      }

      // Modře zářící oči (Cesta 1 Lvl 2+ nebo Král věčné zimy)
      if (u0 >= 2 || isIceKing) {
        ctx.fillStyle = '#e0f7fa';
        ctx.beginPath();
        ctx.arc(4.2, -2, 1.6, 0, TAU);
        ctx.arc(4.2, 2, 1.6, 0, TAU);
        ctx.fill();
      }

      // Ledová koruna (Král věčné zimy C1 Lvl 5)
      if (isIceKing) {
        drawShape(ctx, c => {
          c.moveTo(-2, -6);
          c.lineTo(5, -8);
          c.lineTo(2, -3);
          c.lineTo(7, 0);
          c.lineTo(2, 3);
          c.lineTo(5, 8);
          c.lineTo(-2, 6);
          c.closePath();
        }, '#e0f7fa', OUTLINE, 1.6, false);
      }

      // Cesta 2 Lvl 4: Vznášející se sněhový mrak nad mágem
      if (mp.path === 2 && mp.level === 4) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-2, -4, 6, 0, TAU);
        ctx.arc(4, -3, 5, 0, TAU);
        ctx.arc(1, 3, 5.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  };

  // ============================================================================
  // 4. ORLÍ OSTROSTŘELEC (orli_ostrostrelec, poloměr 18 px)
  // ============================================================================
  TDS.drawers.orli_ostrostrelec = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      const isStone = (mp.path === 1 && mp.level >= 3) || (mp.path === 2 && mp.level >= 5) || (mp.path === 3 && mp.level >= 4);
      const isGoldTower = mp.path === 2 && mp.level >= 5;
      const isDarkDragon = mp.path === 1 && mp.level >= 5;

      // 1. Hlavní čtvercový půdorys hlásky s rohy
      const wallCol = isGoldTower ? '#ffd54f' : (isDarkDragon ? '#263238' : (isStone ? '#607d8b' : '#6d4c41'));
      const floorCol = isGoldTower ? '#eceff1' : (isDarkDragon ? '#37474f' : (isStone ? '#78909c' : '#8d6e63'));
      const cornerCol = isGoldTower ? '#ffb300' : (isDarkDragon ? '#b71c1c' : (isStone ? '#455a64' : '#4e342e'));

      drawBox(ctx, -16.5, -16.5, 33, 33, 4, wallCol, OUTLINE, 2.2, true);
      drawBox(ctx, -13.5, -13.5, 27, 27, 2.5, floorCol, OUTLINE, 1.6, false);

      // Textura prken a křížového trámoví na podlaze
      ctx.strokeStyle = 'rgba(17,17,17,0.35)';
      ctx.lineWidth = 1.4;
      for (let i = -9; i <= 9; i += 6) {
        ctx.beginPath();
        ctx.moveTo(-13, i);
        ctx.lineTo(13, i);
        ctx.stroke();
      }

      // 4 rohové pilíře hlásky
      for (const cx of [-14.5, 10.5]) {
        for (const cy of [-14.5, 10.5]) {
          drawBox(ctx, cx, cy, 4, 4, 1, cornerCol, OUTLINE, 1.5, false);
        }
      }

      // Cesta 2 Lvl 4+: Prapor královské pokladnice na rohu hlásky
      if (mp.path === 2 && mp.level >= 4) {
        drawShape(ctx, c => {
          c.moveTo(-14, 14);
          c.lineTo(-24, 19);
          c.lineTo(-20, 13);
          c.lineTo(-24, 8);
          c.lineTo(-14, 10);
          c.closePath();
        }, '#d32f2f', OUTLINE, 1.6, true);
        drawDisk(ctx, -18, 13.5, 2, '#ffd740', OUTLINE, 1, false);
      }

      // Cesta 2 Lvl 3+: Bidýlko s cvičeným zlatým orlem nebo královským gryfem (Lvl 5)
      if (mp.path === 2 && mp.level >= 3) {
        const isGriffin = mp.level >= 5;
        ctx.save();
        ctx.translate(-15, -12);
        // Dřevěné/zlaté bidýlko
        drawBox(ctx, -3, -4, 6, 8, 1.5, isGriffin ? '#ffb300' : '#5d4037', OUTLINE, 1.5, false);
        // Rozpětí křídel orla / gryfa
        const wingSpan = isGriffin ? 10 : 7;
        drawShape(ctx, c => {
          c.moveTo(0, -wingSpan);
          c.quadraticCurveTo(-6, 0, 0, wingSpan);
          c.quadraticCurveTo(5, 0, 0, -wingSpan);
          c.closePath();
        }, isGriffin ? '#ffd54f' : '#ffb300', OUTLINE, 1.6, true);
        // Bílá hlava orla/gryfa se zlatým zobákem
        drawDisk(ctx, 2, 0, 3.2, '#ffffff', OUTLINE, 1.4, false);
        drawShape(ctx, c => {
          c.moveTo(4.5, -1.5);
          c.lineTo(8, 0);
          c.lineTo(4.5, 1.5);
          c.closePath();
        }, '#ff8f00', OUTLINE, 1.2, false);
        ctx.restore();
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      // Cesta 3 Lvl 1+: Otevřený měšec se střelným prachem u ruky
      if (u2 >= 1) {
        drawDisk(ctx, -3, 8.5, 3.8, '#8d6e63', OUTLINE, 1.5, true);
        drawDisk(ctx, -3, 8.5, 2, '#212121', null, 0, false);
      }

      // 1. Zbraň: Puška / Arkebuza / Opakovací buben / Varhany / Parní rotační dělo
      const gunLen = (u0 >= 1 ? 23 : 19) + (mp.path === 1 && mp.level >= 4 ? 4 : 0);
      let gunMetal = u0 >= 1 ? '#ffca28' : '#90a4ae';
      let gunHi = u0 >= 1 ? '#fff59d' : '#eceff1';
      let stockCol = '#5d4037';

      if (mp.path === 1 && mp.level >= 3) { gunMetal = '#455a64'; gunHi = '#90a4ae'; stockCol = '#37474f'; }
      if (mp.path === 1 && mp.level >= 5) { gunMetal = '#212121'; gunHi = '#d50000'; stockCol = '#b71c1c'; }
      if (mp.path === 3 && mp.level >= 5) { gunMetal = '#cfd8dc'; gunHi = '#ffffff'; stockCol = '#607d8b'; }

      // Pažba pušky
      drawBox(ctx, 3, -2.5, 8, 5, 1.5, stockCol, OUTLINE, 1.8, true);

      if (mp.path === 3 && mp.level >= 4) {
        // Cesta 3 Lvl 4-5: Hradní varhany / Parní rotační dělo v platinovém krytu
        const isSteam = mp.level >= 5;
        // Parní kotel nebo klikový mechanismus
        drawBox(ctx, 8, -6, 8, 12, 2, isSteam ? '#ffb300' : '#546e7a', OUTLINE, 1.8, true, isSteam ? '#fff176' : '#90a4ae');
        // Svazek hlavní
        for (let b = -4; b <= 4; b += 2.6) {
          drawBox(ctx, 15, b - 1.1, 14, 2.2, 0.5, gunMetal, OUTLINE, 1.3, false, gunHi);
        }
        // Přední stahovací prstenec hlavní
        drawBox(ctx, 25, -5.5, 3, 11, 1, isSteam ? '#ffb300' : '#37474f', OUTLINE, 1.5, false);
      } else {
        // Ocelová opěrná vidlice pod arkebuzou (Cesta 1 Lvl 3+)
        if (mp.path === 1 && mp.level >= 3) {
          ctx.strokeStyle = '#cfd8dc';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(18, -6);
          ctx.lineTo(20, 0);
          ctx.lineTo(18, 6);
          ctx.stroke();
        }

        // Otočný buben na náboje (Cesta 3 Lvl 3)
        if (mp.path === 3 && mp.level === 3) {
          drawDisk(ctx, 11, 0, 4.5, '#78909c', OUTLINE, 1.6, false, '#cfd8dc');
        }

        // Hlaveň (nebo dvojhlaveň pro Cestu 3 Lvl 2+)
        const barrelW = (mp.path === 1 && mp.level >= 3) ? 4.8 : 3.4;
        if (u2 >= 2 && mp.path !== 1) {
          drawBox(ctx, 10, -3.2, gunLen, 2.8, 0.8, gunMetal, OUTLINE, 1.5, true, gunHi);
          drawBox(ctx, 10, 0.4, gunLen, 2.8, 0.8, gunMetal, OUTLINE, 1.5, true, gunHi);
        } else {
          drawBox(ctx, 10, -barrelW * 0.5, gunLen, barrelW, 1, gunMetal, OUTLINE, 1.8, true, gunHi);
        }

        // Zlaté/rudé runy na hlavni (Cesta 1 Lvl 4+)
        if (mp.path === 1 && mp.level >= 4) {
          ctx.strokeStyle = mp.level >= 5 ? '#ff1744' : '#ffd740';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([2.5, 2]);
          ctx.beginPath();
          ctx.moveTo(13, 0);
          ctx.lineTo(10 + gunLen - 3, 0);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Rozšířené zubaté ústí hlavně (Cesta 2 Lvl 2+)
        if (u1 >= 2) {
          const mx = 10 + gunLen;
          drawShape(ctx, c => {
            c.moveTo(mx - 2, -2.5);
            c.lineTo(mx + 3, -4.5);
            c.lineTo(mx + 2, 0);
            c.lineTo(mx + 3, 4.5);
            c.lineTo(mx - 2, 2.5);
            c.closePath();
          }, gunMetal, OUTLINE, 1.5, false);
        }

        // Dalekohled se zelenou alchymistickou čočkou (Cesta 2 Lvl 1+)
        if (u1 >= 1) {
          drawBox(ctx, 12, -5.5, 9, 3, 1, '#ffb300', OUTLINE, 1.4, false, '#fff176');
          drawDisk(ctx, 21, -4, 1.6, '#00e676', OUTLINE, 1, false);
        }
      }

      // 2. Postava střelce, klobouk a bandalír
      let coatCol = '#33691e';
      let hatCol = '#2e7d32';
      let hatHi = '#66bb6a';

      if (mp.path === 1 && mp.level >= 5) { coatCol = '#b71c1c'; hatCol = '#212121'; hatHi = '#d32f2f'; }
      if (mp.path === 2 && mp.level >= 5) { coatCol = '#1565c0'; hatCol = '#ffb300'; hatHi = '#fff176'; }
      if (mp.path === 3 && mp.level >= 5) { coatCol = '#455a64'; hatCol = '#90a4ae'; hatHi = '#eceff1'; }

      // Ramena střelce
      drawDisk(ctx, -1, 0, 8, coatCol, OUTLINE, 1.8, true);

      // Cesta 1 Lvl 2+: Pás přes hruď s velkými stříbrnými patronami
      if (u0 >= 2) {
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-5, -6);
        ctx.lineTo(4, 6);
        ctx.stroke();
        ctx.fillStyle = '#eceff1';
        for (let p = -3; p <= 3; p += 3) {
          ctx.beginPath();
          ctx.arc(p * 0.7, p * 0.9, 1.3, 0, TAU);
          ctx.fill();
        }
      }

      // Široký hraničářský klobouk s perem (nebo dračí přilba)
      drawDisk(ctx, -1, 0, 6.8, hatCol, OUTLINE, 1.8, false, hatHi);
      // Pírko za kloboukem
      drawShape(ctx, c => {
        c.moveTo(-3, -5);
        c.quadraticCurveTo(-10, -9, -12, -4);
        c.quadraticCurveTo(-8, -2, -3, -3);
        c.closePath();
      }, mp.path === 1 && mp.level >= 5 ? '#ff1744' : '#ffca28', OUTLINE, 1.3, false);

      ctx.restore();
    }
  };

  // ============================================================================
  // 5. OBLÉHACÍ KATAPULT (oblehaci_katapult, poloměr 22 px)
  // ============================================================================
  TDS.drawers.oblehaci_katapult = {
    base: function (ctx, up) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;

      let frameCol = '#6d4c41';
      let frameHi = '#8d6e63';
      let metalCol = '#78909c';

      if (mp.path === 1 && mp.level >= 3) { frameCol = '#455a64'; frameHi = '#78909c'; metalCol = '#ff9800'; }
      if (mp.path === 1 && mp.level >= 5) { frameCol = '#212121'; frameHi = '#424242'; metalCol = '#ffb300'; }
      if (mp.path === 2 && mp.level >= 4) { frameCol = '#37474f'; frameHi = '#546e7a'; metalCol = '#cfd8dc'; }
      if (mp.path === 2 && mp.level >= 5) { frameCol = '#212121'; frameHi = '#b71c1c'; metalCol = '#ff1744'; }
      if (mp.path === 3 && mp.level >= 4) { frameCol = '#4e342e'; frameHi = '#6d4c41'; metalCol = '#ffb300'; }

      // Cesta 1 Lvl 4+: Těžké kovové vzpěry praskající do země kolem moždíře
      if (mp.path === 1 && mp.level >= 4) {
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * PI) / 2 + PI / 4);
          // Prasklina v zemi pod vzpěrou
          ctx.strokeStyle = '#111111';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(18, 0); ctx.lineTo(25, -4);
          ctx.moveTo(18, 0); ctx.lineTo(26, 3);
          ctx.stroke();
          // Kovová vzpěra
          drawBox(ctx, 12, -3.5, 10, 7, 1.5, metalCol, OUTLINE, 1.8, true);
          ctx.restore();
        }
      }

      // 4 masivní okovaná kola podvozku
      const wheelCol = (mp.path === 1 && mp.level >= 5) ? '#ffb300' : '#4e342e';
      for (const wx of [-12, 12]) {
        for (const wy of [-16.5, 13.5]) {
          drawBox(ctx, wx - 4, wy, 8, 3.5, 1.2, wheelCol, OUTLINE, 1.6, true);
        }
      }

      // Hlavní nosný H-rám stroje s kovovým kováním a nýty
      drawBox(ctx, -16, -14, 32, 6, 2, frameCol, OUTLINE, 2, true, frameHi);
      drawBox(ctx, -16, 8, 32, 6, 2, frameCol, OUTLINE, 2, true, frameHi);
      drawBox(ctx, -9, -10, 18, 20, 2, frameCol, OUTLINE, 2, false, frameHi);

      // Rohové kovové pláty s nýty
      for (const rx of [-15, 10]) {
        for (const ry of [-13, 9]) {
          drawBox(ctx, rx, ry, 5, 4, 1, metalCol, OUTLINE, 1.3, false);
        }
      }

      // Cesta 2 Lvl 1+: Dvě velká ozubená kola pro rychlý rumpál na boku
      if (u1 >= 1) {
        for (const gy of [-15, 15]) {
          drawDisk(ctx, -2, gy, 5, '#b0bec5', OUTLINE, 1.6, false, '#ffffff');
          drawDisk(ctx, -2, gy, 2, '#37474f', OUTLINE, 1.2, false);
        }
      }

      // Cesta 3 Lvl 5: Hromady zlatých soudků s prachem kolem baterie
      if (mp.path === 3 && mp.level >= 5) {
        for (const bPos of [[-17, -16], [17, -16], [-17, 16]]) {
          drawDisk(ctx, bPos[0], bPos[1], 4.8, '#ffb300', OUTLINE, 1.6, true, '#fff176');
          ctx.strokeStyle = '#b71c1c';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(bPos[0], bPos[1], 3, 0, TAU);
          ctx.stroke();
        }
      }

      ctx.restore();
    },

    turret: function (ctx, up, s) {
      ctx.save();
      const mp = getMainPath(up);
      const { u0, u1, u2 } = mp;
      const cock = (s && typeof s.cock === 'number') ? s.cock : 0.65;

      // Cesta 2 Lvl 2: Boční rampa s rudými ohňostrojovými raketami
      if (u1 >= 2 && !(mp.path === 2 && mp.level >= 3)) {
        drawBox(ctx, -6, -16, 12, 5, 1, '#5d4037', OUTLINE, 1.5, false);
        for (let r = -15; r <= -12; r += 2.5) {
          drawBox(ctx, -4, r, 9, 2, 0.5, '#d50000', OUTLINE, 1, false);
        }
      }

      // VARIANTA A: Cesta 1 Lvl 3+ — Hromový moždíř / Otřes země / Hněv titánů (Lví dělo)
      if (mp.path === 1 && mp.level >= 3) {
        const isTitan = mp.level >= 5;
        const recoil = (1 - cock) * -4;
        ctx.translate(recoil, 0);

        const bodyCol = isTitan ? '#212121' : '#e65100';
        const bodyHi = isTitan ? '#424242' : '#ff9800';
        const rimCol = isTitan ? '#ffd740' : '#ffb300';

        // Masivní kónická hlaveň moždíře
        drawShape(ctx, c => {
          c.moveTo(-13, -11);
          c.lineTo(15, -8.5);
          c.lineTo(15, 8.5);
          c.lineTo(-13, 11);
          c.closePath();
        }, bodyCol, OUTLINE, 2.2, true);

        drawHighlight(ctx, c => {
          c.moveTo(-11, -9);
          c.lineTo(14, -7);
          c.lineTo(14, -1);
          c.lineTo(-11, -1);
          c.closePath();
        }, bodyHi);

        // Zlaté obruče na moždíři
        drawBox(ctx, -6, -10.5, 4, 21, 1, rimCol, OUTLINE, 1.6, false);
        drawBox(ctx, 13, -10, 6, 20, 2, rimCol, OUTLINE, 2, false, '#fff59d');

        // Široké černé hrdlo moždíře s bombou uvnitř
        drawDisk(ctx, 16, 0, 5.5, '#111111', OUTLINE, 1.5, false);
        if (cock > 0.2) {
          drawDisk(ctx, 15, 0, 4, '#d84315', OUTLINE, 1.2, false, '#ff8a65');
        }

        // Zlatá hříva a reliéf lví hlavy pro Hněv titánů (Lvl 5)
        if (isTitan) {
          for (let m = -8; m <= 8; m += 4) {
            drawShape(ctx, c => {
              c.moveTo(2, m - 2.5);
              c.lineTo(-5, m);
              c.lineTo(2, m + 2.5);
              c.closePath();
            }, '#ffb300', OUTLINE, 1.3, false);
          }
          drawDisk(ctx, 3, 0, 5.5, '#ffd740', OUTLINE, 1.6, false, '#fff9c4');
          // Oči lva
          ctx.fillStyle = '#d50000';
          ctx.fillRect(4.5, -2.5, 1.8, 1.5);
          ctx.fillRect(4.5, 1, 1.8, 1.5);
        }

        ctx.restore();
        return;
      }

      // VARIANTA B: Cesta 2 Lvl 3+ — Drtič králů / Lovec obrů / Zhouba slizových králů (Těžká balista)
      if (mp.path === 2 && mp.level >= 3) {
        const isLvl4 = mp.level >= 4;
        const isLvl5 = mp.level >= 5;
        const pull = -cock * 9;

        // Tělo / pancíř balisty
        const bodyCol = isLvl5 ? '#212121' : (isLvl4 ? '#546e7a' : '#5d4037');
        if (isLvl5) {
          // Monumentální černo-rudý pancíř obléhací věže
          drawShape(ctx, c => {
            c.moveTo(-14, -12);
            c.lineTo(12, -9);
            c.lineTo(16, 0);
            c.lineTo(12, 9);
            c.lineTo(-14, 12);
            c.closePath();
          }, '#212121', OUTLINE, 2.2, true);
          drawShape(ctx, c => {
            c.moveTo(-10, -8);
            c.lineTo(10, -6);
            c.lineTo(10, 6);
            c.lineTo(-10, 8);
            c.closePath();
          }, '#b71c1c', OUTLINE, 1.6, false);
        } else {
          drawBox(ctx, -14, -4.5, 28, 9, 2, bodyCol, OUTLINE, 2, true);
        }

        // Lučiště balisty (dvojité ocelové pro Lvl 4+)
        const bowCol = isLvl5 ? '#ff1744' : (isLvl4 ? '#cfd8dc' : '#8d6e63');
        const drawBallistaArms = (ox) => {
          drawShape(ctx, c => {
            c.moveTo(ox, -4);
            c.quadraticCurveTo(ox - 2, -16, ox - 8 + pull * 0.3, -20);
            c.lineTo(ox - 11 + pull * 0.3, -18);
            c.quadraticCurveTo(ox - 5, -12, ox - 4, -4);
            c.closePath();
          }, bowCol, OUTLINE, 1.8, true);
          drawShape(ctx, c => {
            c.moveTo(ox, 4);
            c.quadraticCurveTo(ox - 2, 16, ox - 8 + pull * 0.3, 20);
            c.lineTo(ox - 11 + pull * 0.3, 18);
            c.quadraticCurveTo(ox - 5, 12, ox - 4, 4);
            c.closePath();
          }, bowCol, OUTLINE, 1.8, true);
        };
        drawBallistaArms(11);
        if (isLvl4) drawBallistaArms(5);

        // Namalovaná dračí tlama na přídi (Lvl 3+)
        drawBox(ctx, 10, -4, 6, 8, 1.5, '#d32f2f', OUTLINE, 1.5, false);

        // Tětiva
        ctx.strokeStyle = '#eceff1';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(2 + pull * 0.3, -19);
        ctx.lineTo(-2 + pull, 0);
        ctx.lineTo(2 + pull * 0.3, 19);
        ctx.stroke();

        // Založené výbušné kopí / zlatá harpuna / planoucí oštěp
        if (cock > 0.08) {
          const spearCol = isLvl5 ? '#ff6d00' : (isLvl4 ? '#ffd740' : '#cfd8dc');
          drawBox(ctx, -2 + pull, -1.8, 22, 3.6, 1, '#5d4037', OUTLINE, 1.5, false);
          drawShape(ctx, c => {
            c.moveTo(18 + pull, -5);
            c.lineTo(28 + pull, 0);
            c.lineTo(18 + pull, 5);
            c.lineTo(20 + pull, 0);
            c.closePath();
          }, spearCol, OUTLINE, 1.6, false);
          if (isLvl5) {
            drawHighlight(ctx, c => c.arc(21 + pull, 0, 3, 0, TAU), '#ffff00');
          }
        }

        ctx.restore();
        return;
      }

      // VARIANTA C: Cesta 3 Lvl 4+ — Řetězový výbuch / Kobercové bombardování (Trojhlavňové trpasličí dělo)
      if (mp.path === 3 && mp.level >= 4) {
        const isLvl5 = mp.level >= 5;
        const recoil = (1 - cock) * -3.5;
        ctx.translate(recoil, 0);

        // Pancéřová věž baterie
        drawBox(ctx, -12, -12, 18, 24, 3, isLvl5 ? '#ffb300' : '#37474f', OUTLINE, 2.2, true, isLvl5 ? '#ffe082' : '#607d8b');

        // Tři hlavně vedle sebe se zlatými runami hoření
        for (const by of [-7.5, 0, 7.5]) {
          drawBox(ctx, 2, by - 3, 18, 6, 1.5, '#263238', OUTLINE, 1.8, true, '#546e7a');
          drawBox(ctx, 17, by - 3.5, 4, 7, 1, '#ffb300', OUTLINE, 1.5, false);
          // Runy na hlavních
          ctx.strokeStyle = '#ffab00';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(6, by); ctx.lineTo(14, by);
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      // VARIANTA D: Klasický katapult s ramenem, lžící a soudkem (Základ + Cesta 3 Lvl 1-3)
      // 1. Těžké protizávaží vzadu (vpředu při natažení)
      const armLen = u2 >= 1 ? 21 : 16;
      const slide = (0.5 - cock) * 6; // Při cock=1 je lžíce vzadu (-X), při cock=0 švihne dopředu (+X)

      ctx.save();
      ctx.translate(slide, 0);

      // Kamenně-železné protizávaží na předním konci páky
      drawBox(ctx, 4, -6.5, 8, 13, 2, '#546e7a', OUTLINE, 1.8, true, '#90a4ae');

      // Dubové rameno katapultu (zpevněné železnými pláty pro Cestu 1 Lvl 2+)
      const armW = (mp.path === 3 && mp.level === 3) ? 7 : 4.5;
      drawBox(ctx, -armLen, -armW * 0.5, armLen + 6, armW, 1.5, '#795548', OUTLINE, 2, true, '#a1887f');
      if (u0 >= 2) {
        drawBox(ctx, -armLen * 0.6, -armW * 0.5 - 0.5, 8, armW + 1, 1, '#90a4ae', OUTLINE, 1.4, false);
      }

      // Velká okovaná lžíce katapultu vzadu na -armLen
      const spoonR = (mp.path === 3 && mp.level === 3) ? 9.5 : (u0 >= 1 ? 8 : 6.5);
      drawDisk(ctx, -armLen, 0, spoonR, '#4e342e', OUTLINE, 2, true);
      drawDisk(ctx, -armLen, 0, spoonR * 0.78, '#3e2723', null, 0, false);

      // Náboj ve lžíci (pokud je katapult aspoň trochu natažený)
      if (cock > 0.12) {
        if (mp.path === 3 && mp.level === 3) {
          // Hroznová střela: svazek 6 spojených soudků
          for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6;
            drawDisk(ctx, -armLen + Math.cos(a) * 4.2, Math.sin(a) * 4.2, 3, '#d84315', OUTLINE, 1.3, false, '#ff8a65');
          }
          drawDisk(ctx, -armLen, 0, 3.2, '#ffb300', OUTLINE, 1.3, false);
        } else {
          // Jeden soudek (větší pro C1 Lvl 1+, obalený hřeby pro C3 Lvl 2+)
          const bRad = u0 >= 1 ? 6 : 4.5;
          const bCol = u2 >= 2 ? '#607d8b' : '#d84315';
          const bHi = u2 >= 2 ? '#b0bec5' : '#ff8a65';

          // Železné hřeby na soudku (Cesta 3 Lvl 2+)
          if (u2 >= 2) {
            for (let k = 0; k < 6; k++) {
              const ka = (k * TAU) / 6;
              drawDisk(ctx, -armLen + Math.cos(ka) * (bRad + 1), Math.sin(ka) * (bRad + 1), 1.6, '#cfd8dc', OUTLINE, 1.1, false);
            }
          }

          drawDisk(ctx, -armLen, 0, bRad, bCol, OUTLINE, 1.6, false, bHi);
          // Obruče soudku a hořící doutnák
          ctx.strokeStyle = '#212121';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(-armLen, 0, bRad * 0.65, 0, TAU);
          ctx.stroke();

          // Jiskřící doutnák
          drawDisk(ctx, -armLen - bRad * 0.5, -bRad * 0.5, 2, '#ffea00', '#ff3d00', 1.2, false);
        }
      }

      ctx.restore();
      ctx.restore();
    }
  };
})();

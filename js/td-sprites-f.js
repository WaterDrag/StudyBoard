/**
 * Obrana království - Kreslící knihovna (Část F: noví slizáci a bossové) — od Gemini
 * TDS.slimeDrawers[id](ctx, r, ts, s): tělo slizáka; stavy (mráz, hoření…) a značky schopností kreslí td-render.js.
 */
(function () {
  const TDS = window.TDS || (window.TDS = {});

  const OUTLINE = '#111111';
  const SHADOW_COL = 'rgba(10, 16, 10, 0.28)';
  const PI = Math.PI;
  const TAU = PI * 2;

  // Lokální offscreen cache pro předkreslená těla slizáků podle druhu a poloměru
  const localCache = new Map();

  // Seedovaný deterministický generátor náhodných čísel
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

  function getCachedBody(key, w, h, drawFn) {
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
   * Vlastní zaoblený obdélník (náhrada za nepovolený ctx.roundRect)
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

  function polyPath(ctx, x, y, r, sides, rotOffset = 0) {
    ctx.beginPath();
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
   * Vykreslí rosolovité bochníkové tělo slizáka se světlem shora zleva a vnitřním stínem vpravo dole
   */
  function drawJellyBlob(ctx, rx, ry, baseCol, darkCol, hiCol, innerFn, outlineW = 2) {
    // 1. Základní výplň
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fillStyle = baseCol;
    ctx.fill();

    // 2. Ořez pro vnitřní vrstvy rosolu
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.clip();

    // Spodní pravý stín uvnitř rosolu
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.ellipse(rx * 0.28, ry * 0.28, rx * 0.95, ry * 0.95, 0, 0, TAU);
    ctx.fill();

    // Střední nasvícená hmota posunutá mírně vlevo nahoru
    ctx.fillStyle = baseCol;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.1, -ry * 0.1, rx * 0.88, ry * 0.88, 0, 0, TAU);
    ctx.fill();

    // Vnitřní detaily (jádra, plástve, krystaly, žilky)
    if (innerFn) innerFn(ctx, rx, ry);

    // Dvouvrstvý lesklý odlesk shora zleva
    ctx.fillStyle = hiCol;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.34, -ry * 0.36, rx * 0.34, ry * 0.2, -0.45, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.4, rx * 0.16, ry * 0.09, -0.45, 0, TAU);
    ctx.fill();

    ctx.restore();

    // 3. Tmavý vnější obrys (#111)
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = outlineW;
    ctx.stroke();
  }

  /**
   * Vykreslí oči slizáka koukající doprava (+X)
   */
  function drawEyes(ctx, ex, spreadY, eyeR, pupilCol = '#111111', angry = false) {
    // Bělmo
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1.4, eyeR * 0.42);
    ctx.beginPath();
    ctx.arc(ex, -spreadY, eyeR, 0, TAU);
    ctx.arc(ex, spreadY, eyeR, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Zorničky koukající směrem +X
    const pr = eyeR * 0.56;
    ctx.fillStyle = pupilCol;
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.28, -spreadY, pr, 0, TAU);
    ctx.arc(ex + eyeR * 0.28, spreadY, pr, 0, TAU);
    ctx.fill();

    // Odlesk v očích
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + eyeR * 0.08, -spreadY - eyeR * 0.26, pr * 0.42, 0, TAU);
    ctx.arc(ex + eyeR * 0.08, spreadY - eyeR * 0.26, pr * 0.42, 0, TAU);
    ctx.fill();

    // Zamračené obočí (pro zuřivého slizáka a bosse)
    if (angry) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = Math.max(2.0, eyeR * 0.55);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - eyeR * 0.85, -spreadY - eyeR * 1.15);
      ctx.lineTo(ex + eyeR * 0.85, -spreadY - eyeR * 0.35);
      ctx.moveTo(ex - eyeR * 0.85, spreadY + eyeR * 1.15);
      ctx.lineTo(ex + eyeR * 0.85, spreadY + eyeR * 0.35);
      ctx.stroke();
    }
  }

  /**
   * Vykreslí osobní Runovou bublinu (modifikátor `runovy_stit`, pokud s.shield === true)
   */
  function drawRunicBubble(ctx, r, ts) {
    const pulse = 1 + Math.sin((ts || 0) * 0.008) * 0.04;
    const br = (r + 5) * pulse;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Odlesk na magické bublině
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-br * 0.38, -br * 0.38, br * 0.28, br * 0.12, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Vykreslí krátké bílé bliknutí při zásahu (s.hit)
   */
  function drawHitFlash(ctx, rx, ry) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 1.03, ry * 1.03, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Vykreslí rotující runovou pečeť bosse na zemi pod ním (sealsLeft z sealsTotal)
   */
  function drawBossRunicSeal(ctx, r, ts, s) {
    const total = s.sealsTotal || 0;
    if (total <= 0) return;
    const left = typeof s.sealsLeft === 'number' ? s.sealsLeft : total;
    const sealRad = r * 1.38;
    const rot = (ts || 0) * 0.0009;

    ctx.save();
    ctx.rotate(rot);

    // Vnější magický kruh
    ctx.strokeStyle = 'rgba(255, 215, 64, 0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, sealRad, 0, TAU);
    ctx.stroke();

    const gap = 0.16;
    const segAng = TAU / total;
    for (let i = 0; i < total; i++) {
      const a1 = i * segAng + gap * 0.5;
      const a2 = (i + 1) * segAng - gap * 0.5;
      const active = i < left;

      ctx.beginPath();
      ctx.arc(0, 0, sealRad, a1, a2);
      ctx.strokeStyle = active ? '#ffea00' : 'rgba(65, 75, 85, 0.55)';
      ctx.lineWidth = active ? 5.5 : 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (active) {
        const midA = (a1 + a2) * 0.5;
        const rx = Math.cos(midA) * sealRad;
        const ry = Math.sin(midA) * sealRad;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Vykreslí lištu životů bosse nad tělem (s.hpPct 0–1)
   */
  function drawBossHpBar(ctx, r, s) {
    if (typeof s.hpPct !== 'number') return;
    const hp = Math.max(0, Math.min(1, s.hpPct));
    const barW = Math.max(56, r * 1.65);
    const barH = 8.5;
    const bx = -barW * 0.5;
    const by = -r - 19;

    ctx.save();
    roundRect(ctx, bx, by, barW, barH, 4);
    fillAndStroke(ctx, '#212529', OUTLINE, 2);

    if (hp > 0) {
      const col = hp > 0.5 ? '#00e676' : (hp > 0.25 ? '#ffab00' : '#ff1744');
      roundRect(ctx, bx + 1.5, by + 1.5, Math.max(4, (barW - 3) * hp), barH - 3, 2.5);
      ctx.fillStyle = col;
      ctx.fill();

      // Vrchní lesklý proužek
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.fillRect(bx + 3, by + 2, Math.max(0, (barW - 6) * hp), 2);
    }
    ctx.restore();
  }

  /**
   * Pomocný výpočet houpání (squash & stretch) při pohybu
   */
  function getWobble(ts, s, speedMult = 1) {
    if (s && (s.frozen || s.stunned)) {
      return { stretch: 1, squash: 1, phase: 0 };
    }
    const phase = (ts || 0) * 0.011 * speedMult;
    return {
      stretch: 1 + Math.sin(phase) * 0.09,
      squash: 1 - Math.sin(phase) * 0.08,
      phase
    };
  }

  // ============================================================================
  // HLAVNÍ OBJEKT KRESLÍŘŮ: TDS.slimeDrawers
  // ============================================================================

  TDS.slimeDrawers = Object.assign(TDS.slimeDrawers || {}, {

    // ==========================================================================
    // 1. BUBLINKOVÝ SLIZ (bublinkovy_sliz) — Létající v mýdlové bublině s křidélky
    // ==========================================================================
    bublinkovy_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(6, Math.round(r || 10));
      const wb = getWobble(ts, state, 1.2);
      const hoverY = (state.frozen || state.stunned) ? 0 : Math.sin((ts || 0) * 0.007) * 2.2;

      // Výrazný stín hluboko pod vznášející se bublinou (elevation_shadow_offset_px: 10)
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(5, 10, rad * 0.92, rad * 0.68, 0, 0, TAU);
      ctx.fill();

      ctx.translate(0, hoverY);
      ctx.scale(wb.stretch, wb.squash);

      // Křidélka po stranách (nahoře -Y a dole +Y)
      const flap = (state.frozen || state.stunned) ? 0 : Math.sin((ts || 0) * 0.022) * 0.28;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(-rad * 0.1, side * rad * 0.72);
        ctx.rotate(side * flap);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-rad * 0.55, side * rad * 0.85, rad * 0.15, side * rad * 0.75);
        ctx.quadraticCurveTo(rad * 0.45, side * rad * 0.35, 0, 0);
        fillAndStroke(ctx, '#ffffff', OUTLINE, 1.6);
        ctx.restore();
      }

      // Předkreslené tyrkysové tělo a duhová mýdlová bublina z offscreen cache
      const sprite = getCachedBody(`bublinkovy_${rad}`, rad * 2.8, rad * 2.8, c => {
        // Vnitřní světle tyrkysový slizák
        drawJellyBlob(c, rad * 0.78, rad * 0.74, '#26c6da', '#00838f', '#b2ebf2', null, 1.8);
        drawEyes(c, rad * 0.26, rad * 0.24, Math.max(2.0, rad * 0.19));

        // Vnější duhová mýdlová bublina
        const br = rad * 1.08;
        c.fillStyle = 'rgba(224, 247, 250, 0.24)';
        c.strokeStyle = OUTLINE;
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, br, 0, TAU);
        c.fill();
        c.stroke();

        // Duhové odlesky (růžový a žlutozelený oblouk po obvodu bubliny)
        c.strokeStyle = 'rgba(255, 128, 171, 0.75)';
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(0, 0, br - 2, -PI * 0.85, -PI * 0.25);
        c.stroke();

        c.strokeStyle = 'rgba(255, 241, 118, 0.75)';
        c.beginPath();
        c.arc(0, 0, br - 2, PI * 0.15, PI * 0.65);
        c.stroke();

        c.fillStyle = 'rgba(255, 255, 255, 0.75)';
        c.beginPath();
        c.ellipse(-br * 0.38, -br * 0.38, br * 0.26, br * 0.13, -0.6, 0, TAU);
        c.fill();
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad * 1.08, rad * 1.08);
      if (state.shield) drawRunicBubble(ctx, rad * 1.1, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 2. ZUŘIVÝ SLIZ (zuivy_sliz) — Karmínový s tesáky, žilkami a párou při zásahu
    // ==========================================================================
    zuivy_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(6, Math.round(r || 11));
      const isEnraged = Boolean(state.enraged);
      const wb = getWobble(ts, state, isEnraged ? 1.8 : 1.0);

      // Měkký stín
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 3.5, rad * 1.02 * wb.stretch, rad * 0.9 * wb.squash, 0, 0, TAU);
      ctx.fill();

      // Rudá aura zuřivosti pod slizákem, pokud je rozzuřený (s.enraged)
      if (isEnraged) {
        const pulse = 1 + Math.sin((ts || 0) * 0.02) * 0.1;
        ctx.fillStyle = 'rgba(255, 23, 68, 0.32)';
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.32 * pulse, 0, TAU);
        ctx.fill();
      }

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`zuivy_${rad}_${isEnraged ? 1 : 0}`, rad * 2.6, rad * 2.6, c => {
        drawJellyBlob(
          c, rad * 1.04, rad * 0.96,
          isEnraged ? '#ff1744' : '#d50000',
          '#7f0000',
          '#ff8a80',
          (ic, rx, ry) => {
            // Pulzující žluté žilky vzteku na zádech
            ic.strokeStyle = isEnraged ? '#ffff00' : '#ffb300';
            ic.lineWidth = Math.max(1.5, rad * 0.14);
            ic.lineCap = 'round';
            ic.beginPath();
            ic.moveTo(-rx * 0.55, -ry * 0.35);
            ic.lineTo(-rx * 0.2, -ry * 0.15);
            ic.lineTo(-rx * 0.4, ry * 0.1);
            ic.moveTo(-rx * 0.2, -ry * 0.15);
            ic.lineTo(-rx * 0.05, -ry * 0.48);
            ic.stroke();
          },
          2.0
        );

        // Vyceněné bílé tesáky vpředu (+X)
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(rad * 0.62, side * rad * 0.14);
          c.lineTo(rad * 0.95, side * rad * 0.24);
          c.lineTo(rad * 0.58, side * rad * 0.36);
          c.closePath();
          fillAndStroke(c, '#ffffff', OUTLINE, 1.5);
        }

        drawEyes(c, rad * 0.36, rad * 0.32, Math.max(2.2, rad * 0.21), '#ffea00', true);
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      // Stoupající obláčky páry při rozzuření (s.enraged)
      if (isEnraged && !state.frozen && !state.stunned) {
        const steamT = ((ts || 0) * 0.005) % 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.3;
        for (const side of [-1, 1]) {
          const sx = -rad * 0.25 - steamT * rad * 0.6;
          const sy = side * (rad * 0.45 + steamT * rad * 0.35);
          const sr = Math.max(2, rad * 0.22 * (1 - steamT * 0.4));
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }

      if (state.hit) drawHitFlash(ctx, rad * 1.04, rad * 0.96);
      if (state.shield) drawRunicBubble(ctx, rad, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 3. DĚLIVÝ SLIZ (delivy_sliz) — Dvoulaločná buňka se 2 jádry a 4 očima
    // ==========================================================================
    delivy_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(6, Math.round(r || 11));
      const wb = getWobble(ts, state, 1.15);
      // Při s.splitting se laloky rozestupují od sebe
      const splitOffset = state.splitting ? Math.sin((ts || 0) * 0.018) * rad * 0.16 + rad * 0.12 : 0;

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 3.5, rad * 0.98 * wb.stretch, (rad * 1.12 + splitOffset) * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`delivy_${rad}`, rad * 2.8, rad * 2.8, c => {
        const lobeR = rad * 0.68;
        const lobeY = rad * 0.38;

        // Tmavý obrys obou laloků dohromady
        c.fillStyle = OUTLINE;
        c.beginPath();
        c.arc(0, -lobeY, lobeR + 2, 0, TAU);
        c.arc(0, lobeY, lobeR + 2, 0, TAU);
        c.fill();

        // Základní limetková vrstva
        c.fillStyle = '#76ff03';
        c.beginPath();
        c.arc(0, -lobeY, lobeR, 0, TAU);
        c.arc(0, lobeY, lobeR, 0, TAU);
        c.fill();

        // Stínová vrstva vpravo dole
        c.fillStyle = '#33691e';
        c.beginPath();
        c.arc(lobeR * 0.2, -lobeY + lobeR * 0.2, lobeR * 0.78, 0, TAU);
        c.arc(lobeR * 0.2, lobeY + lobeR * 0.2, lobeR * 0.78, 0, TAU);
        c.fill();

        // Vnitřní jasná limetková
        c.fillStyle = '#64dd17';
        c.beginPath();
        c.arc(-lobeR * 0.08, -lobeY - lobeR * 0.08, lobeR * 0.78, 0, TAU);
        c.arc(-lobeR * 0.08, lobeY - lobeR * 0.08, lobeR * 0.78, 0, TAU);
        c.fill();

        // Dvě pulzující oranžová buněčná jádra uvnitř laloků
        for (const ly of [-lobeY, lobeY]) {
          c.beginPath();
          c.arc(-rad * 0.12, ly, rad * 0.28, 0, TAU);
          fillAndStroke(c, '#ff6d00', OUTLINE, 1.4);
          c.fillStyle = '#ffd740';
          c.beginPath();
          c.arc(-rad * 0.18, ly - rad * 0.06, rad * 0.12, 0, TAU);
          c.fill();

          // Lesk laloku
          c.fillStyle = '#ccff90';
          c.beginPath();
          c.ellipse(-rad * 0.25, ly - rad * 0.26, rad * 0.22, rad * 0.11, -0.4, 0, TAU);
          c.fill();
        }

        // Buněčná membrána uprostřed
        c.strokeStyle = '#33691e';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(-rad * 0.45, 0);
        c.lineTo(rad * 0.45, 0);
        c.stroke();

        // Čtyři malá očka (dvě na každém laloku)
        const er = Math.max(1.7, rad * 0.14);
        drawEyes(c, rad * 0.34, lobeY - rad * 0.18, er);
        drawEyes(c, rad * 0.34, lobeY + rad * 0.18, er);
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad, rad * 1.15);
      if (state.shield) drawRunicBubble(ctx, rad * 1.1, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 4. ŠTÍTONOŠ (stitonos_sliz) — Obrněný slizák s dubovou pavézou a modrou aurou
    // ==========================================================================
    stitonos_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(8, Math.round(r || 14));
      const wb = getWobble(ts, state, 0.85);
      const auraOn = state.shieldAura !== false;

      // Modrý ochranný kruh (shield_aura) na zemi kolem Štítonoše
      if (auraOn) {
        const pulse = 1 + Math.sin((ts || 0) * 0.006) * 0.05;
        const ar = rad * 1.65 * pulse;
        ctx.fillStyle = 'rgba(41, 182, 246, 0.15)';
        ctx.strokeStyle = 'rgba(41, 182, 246, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, ar, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3.5, 4, rad * 1.08 * wb.stretch, rad * 0.96 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`stitonos_${rad}`, rad * 2.8, rad * 2.8, c => {
        // Mohutné modrošedé tělo
        drawJellyBlob(c, rad * 1.0, rad * 0.95, '#607d8b', '#37474f', '#b0bec5', null, 2.2);

        // Kovový nánosník / rytířský lem na hlavě
        c.beginPath();
        c.arc(-rad * 0.1, 0, rad * 0.78, PI * 0.4, PI * 1.6);
        fillAndStroke(c, '#90a4ae', OUTLINE, 1.8);

        drawEyes(c, rad * 0.3, rad * 0.32, Math.max(2.2, rad * 0.2));

        // Široký dubový pavézový štít vpředu (+X) pobitý zlatými nýty
        const sx = rad * 0.62;
        const sh = rad * 1.05;
        const sw = rad * 0.42;

        roundRect(c, sx - sw * 0.5, -sh, sw, sh * 2, 4);
        fillAndStroke(c, '#6d4c41', OUTLINE, 2.2);

        // Prkna na pavéze
        c.strokeStyle = '#3e2723';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(sx - sw * 0.4, -sh * 0.35); c.lineTo(sx + sw * 0.4, -sh * 0.35);
        c.moveTo(sx - sw * 0.4, sh * 0.35); c.lineTo(sx + sw * 0.4, sh * 0.35);
        c.stroke();

        // Ocelové obruče a zlaté nýty
        roundRect(c, sx - sw * 0.55, -sh, sw * 0.3, sh * 2, 2);
        fillAndStroke(c, '#90a4ae', OUTLINE, 1.5);

        // Zlatá středová puklice a nýty
        c.fillStyle = '#ffd740';
        c.strokeStyle = OUTLINE;
        c.lineWidth = 1.4;
        for (const ny of [-sh * 0.72, 0, sh * 0.72]) {
          c.beginPath();
          c.arc(sx + sw * 0.1, ny, ny === 0 ? rad * 0.24 : rad * 0.13, 0, TAU);
          c.fill();
          c.stroke();
        }
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad * 1.05, rad);
      if (state.shield) drawRunicBubble(ctx, rad * 1.15, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 5. ŠAMANSKÝ SLIZ (samansky_sliz) — Kmenová maska s pírky a léčivá hůl
    // ==========================================================================
    samansky_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(7, Math.round(r || 13));
      const wb = getWobble(ts, state, 1.0);

      // Léčivý pulz (healer_pulse): buď řízený přes s.healing, nebo periodický každé 3 s
      const pulseCycle = typeof state.healing === 'number'
        ? state.healing
        : (state.healing ? (((ts || 0) % 2400) / 2400) : 0);

      if (pulseCycle > 0 && pulseCycle < 0.65) {
        const p = pulseCycle / 0.65;
        const pr = rad * (1.0 + p * 1.35);
        ctx.strokeStyle = `rgba(0, 230, 118, ${(1 - p) * 0.85})`;
        ctx.fillStyle = `rgba(105, 240, 174, ${(1 - p) * 0.22})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, pr, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 3.5, rad * 1.02 * wb.stretch, rad * 0.94 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`samansky_${rad}`, rad * 2.8, rad * 2.8, c => {
        // Smaragdově zelené tělo s vyřezávanou holí uvnitř
        drawJellyBlob(
          c, rad * 1.0, rad * 0.95,
          '#00c853', '#1b5e20', '#b9f6ca',
          (ic, rx, ry) => {
            // Vyřezávaná dřevěná hůl se zeleným drahokamem uvnitř rosolu
            ic.save();
            ic.rotate(0.35);
            roundRect(ic, -rx * 0.55, ry * 0.15, rx * 1.1, ry * 0.22, 3);
            fillAndStroke(ic, '#6d4c41', OUTLINE, 1.5);
            polyPath(ic, rx * 0.55, ry * 0.26, rad * 0.24, 6, 0);
            fillAndStroke(ic, '#00e676', OUTLINE, 1.4);
            ic.restore();
          },
          2.0
        );

        // Barevná pírka čelenky vzadu (-X) za maskou
        const feathers = [
          { a: -0.45, col: '#ff1744' },
          { a: 0, col: '#ffd600' },
          { a: 0.45, col: '#00e5ff' }
        ];
        for (const f of feathers) {
          c.save();
          c.translate(-rad * 0.2, 0);
          c.rotate(f.a);
          c.beginPath();
          c.ellipse(-rad * 0.65, 0, rad * 0.42, rad * 0.16, 0, 0, TAU);
          fillAndStroke(c, f.col, OUTLINE, 1.5);
          c.restore();
        }

        // Dřevěná kmenová maska na přední části těla
        roundRect(c, -rad * 0.25, -rad * 0.72, rad * 0.92, rad * 1.44, 5);
        fillAndStroke(c, '#795548', OUTLINE, 2.0);

        // Kmenové malování na masce
        c.strokeStyle = '#ffea00';
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(-rad * 0.05, -rad * 0.55); c.lineTo(-rad * 0.05, rad * 0.55);
        c.stroke();

        // Svítící oči v otvorech masky
        drawEyes(c, rad * 0.34, rad * 0.32, Math.max(2.1, rad * 0.19), '#00e676');
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad, rad);
      if (state.shield) drawRunicBubble(ctx, rad * 1.08, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 6. KRTČÍ SLIZ (krtci_sliz) — Hornická přilba se svítilnou, vrtáky a zahrabání
    // ==========================================================================
    krtci_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(7, Math.round(r || 12));
      const isBurrowed = Boolean(state.burrowed);

      if (isBurrowed) {
        // ZAHRABANÝ STAV (s.burrowed === true): podzemní brázda, drny hlíny a špičky vrtáků
        const shake = (state.frozen || state.stunned) ? 0 : Math.sin((ts || 0) * 0.04) * 1.5;
        ctx.translate(0, shake);

        // Vyrytá hliněná brázda
        ctx.fillStyle = '#4e342e';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(-rad * 0.2, 0, rad * 1.15, rad * 0.72, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();

        // Hroudy hlíny po obvodu krtince
        const mounds = [
          [-rad * 0.7, -rad * 0.45, rad * 0.32],
          [-rad * 0.65, rad * 0.45, rad * 0.32],
          [rad * 0.1, -rad * 0.52, rad * 0.35],
          [rad * 0.1, rad * 0.52, rad * 0.35],
          [-rad * 0.2, 0, rad * 0.42]
        ];
        for (const [mx, my, mr] of mounds) {
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, TAU);
          fillAndStroke(ctx, '#6d4c41', OUTLINE, 1.5);
          ctx.fillStyle = '#8d6e63';
          ctx.beginPath();
          ctx.arc(mx - mr * 0.25, my - mr * 0.25, mr * 0.45, 0, TAU);
          ctx.fill();
        }

        // Špička vrtáku koukající z hlíny vpředu (+X)
        ctx.beginPath();
        ctx.moveTo(rad * 0.4, -rad * 0.3);
        ctx.lineTo(rad * 1.05, 0);
        ctx.lineTo(rad * 0.4, rad * 0.3);
        ctx.closePath();
        fillAndStroke(ctx, '#b0bec5', OUTLINE, 1.6);

        if (state.hit) drawHitFlash(ctx, rad * 1.1, rad * 0.72);
        ctx.restore();
        return;
      }

      // NADZEMNÍ STAV: zemitě hnědý slizák s hornickou přilbou a postranními vrtáky
      const wb = getWobble(ts, state, 1.1);

      // Brázda hlíny za krtčím slizákem (-X)
      ctx.fillStyle = 'rgba(78, 52, 46, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-rad * 0.85, 0, rad * 0.55, rad * 0.38, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 3.5, rad * 1.04 * wb.stretch, rad * 0.94 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`krtci_${rad}`, rad * 2.8, rad * 2.8, c => {
        // Dva kovové kuželové vrtáky po stranách těla
        for (const side of [-1, 1]) {
          const dy = side * rad * 0.85;
          c.beginPath();
          c.moveTo(-rad * 0.25, dy - side * rad * 0.22);
          c.lineTo(rad * 0.75, dy);
          c.lineTo(-rad * 0.25, dy + side * rad * 0.22);
          c.closePath();
          fillAndStroke(c, '#90a4ae', OUTLINE, 1.8);

          // Závity vrtáku
          c.strokeStyle = OUTLINE;
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(rad * 0.05, dy - rad * 0.16); c.lineTo(rad * 0.2, dy + rad * 0.16);
          c.moveTo(rad * 0.35, dy - rad * 0.1); c.lineTo(rad * 0.45, dy + rad * 0.1);
          c.stroke();
        }

        // Zemitě hnědé tělo
        drawJellyBlob(c, rad * 1.0, rad * 0.9, '#795548', '#3e2723', '#bcaaa4', null, 2.0);
        drawEyes(c, rad * 0.42, rad * 0.28, Math.max(2.0, rad * 0.19));

        // Žlutá hornická přilba na hlavě se svítilnou na čele
        c.beginPath();
        c.arc(-rad * 0.08, 0, rad * 0.68, 0, TAU);
        fillAndStroke(c, '#ffd600', OUTLINE, 1.9);

        c.fillStyle = '#ffff8d';
        c.beginPath();
        c.arc(-rad * 0.24, -rad * 0.22, rad * 0.28, 0, TAU);
        c.fill();

        // Čelová svítilna mířící dopředu (+X)
        roundRect(c, rad * 0.35, -rad * 0.22, rad * 0.36, rad * 0.44, 2);
        fillAndStroke(c, '#37474f', OUTLINE, 1.5);
        c.fillStyle = '#00e5ff';
        c.beginPath();
        c.arc(rad * 0.65, 0, rad * 0.16, 0, TAU);
        c.fill();
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad, rad);
      if (state.shield) drawRunicBubble(ctx, rad * 1.1, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 7. MAGNETICKÝ SLIZ (magneticky_sliz) — Kovový s podkovovitým magnetem a siločárami
    // ==========================================================================
    magneticky_sliz: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(8, Math.round(r || 15));
      const wb = getWobble(ts, state, 0.9);
      const magOn = state.magnetActive !== false;

      // Rotující modré magnetické siločáry kolem slizáka
      if (magOn) {
        ctx.save();
        ctx.rotate((ts || 0) * 0.0025);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.48, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3.5, 4, rad * 1.05 * wb.stretch, rad * 0.96 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`magneticky_${rad}`, rad * 2.8, rad * 2.8, c => {
        // Kovově stříbrné obrněné tělo
        drawJellyBlob(c, rad * 1.02, rad * 0.96, '#90a4ae', '#455a64', '#eceff1', null, 2.2);

        drawEyes(c, rad * 0.4, rad * 0.32, Math.max(2.2, rad * 0.2), '#00b0ff');

        // Velký podkovovitý magnet na zádech/hlavě (červený severní pól nahoře, modrý jižní dole, stříbrné špičky)
        const mx = -rad * 0.15;
        const mr = rad * 0.58;
        const armLen = rad * 0.52;
        const thick = rad * 0.28;

        // Zadní oblouk podkovy
        c.beginPath();
        c.arc(mx, 0, mr, PI * 0.5, PI * 1.5);
        c.strokeStyle = OUTLINE;
        c.lineWidth = thick + 3.5;
        c.stroke();

        c.beginPath();
        c.arc(mx, 0, mr, PI * 0.5, PI * 1.5);
        c.strokeStyle = '#546e7a';
        c.lineWidth = thick;
        c.stroke();

        // Horní červené rameno (-Y) a dolní modré rameno (+Y)
        roundRect(c, mx, -mr - thick * 0.5, armLen, thick, 2);
        fillAndStroke(c, '#ff1744', OUTLINE, 1.8);

        roundRect(c, mx, mr - thick * 0.5, armLen, thick, 2);
        fillAndStroke(c, '#2979ff', OUTLINE, 1.8);

        // Stříbrné póly na koncích magnetu
        roundRect(c, mx + armLen * 0.65, -mr - thick * 0.5, armLen * 0.38, thick, 1.5);
        fillAndStroke(c, '#cfd8dc', OUTLINE, 1.6);

        roundRect(c, mx + armLen * 0.65, mr - thick * 0.5, armLen * 0.38, thick, 1.5);
        fillAndStroke(c, '#cfd8dc', OUTLINE, 1.6);
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad * 1.02, rad * 0.96);
      if (state.shield) drawRunicBubble(ctx, rad * 1.12, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 8. MRAZIVÝ PLAZIVEC (mrazivy_plazivec) — Koruna z rampouchů a mrazivá aura
    // ==========================================================================
    mrazivy_plazivec: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(8, Math.round(r || 14));
      const wb = getWobble(ts, state, 0.95);
      const chillOn = state.chilling !== false;

      // Mrazivá aura zpomalující věže (chilling_presence) a namrzlá bílá stopa vzadu (-X)
      if (chillOn) {
        ctx.fillStyle = 'rgba(128, 216, 255, 0.22)';
        ctx.beginPath();
        ctx.ellipse(-rad * 0.55, 0, rad * 0.85, rad * 0.55, 0, 0, TAU);
        ctx.fill();

        const rot = (ts || 0) * 0.0015;
        ctx.save();
        ctx.rotate(rot);
        ctx.strokeStyle = 'rgba(128, 216, 255, 0.6)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.55, 0, TAU);
        ctx.stroke();
        // 4 drobné sněhové vločky na oběžné dráze
        for (let i = 0; i < 4; i++) {
          const a = (i * PI) / 2;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rad * 1.55, Math.sin(a) * rad * 1.55, 2.5, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(3, 3.5, rad * 1.05 * wb.stretch, rad * 0.95 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.scale(wb.stretch, wb.squash);

      const sprite = getCachedBody(`mrazivy_${rad}`, rad * 3.0, rad * 3.0, c => {
        // Ostré špičaté rampouchy trčící po obvodu zadní části těla
        const spikes = [-2.5, -1.9, -1.3, 1.3, 1.9, 2.5, PI];
        for (const a of spikes) {
          c.save();
          c.rotate(a);
          c.beginPath();
          c.moveTo(rad * 0.65, -rad * 0.22);
          c.lineTo(rad * 1.32, 0);
          c.lineTo(rad * 0.65, rad * 0.22);
          c.closePath();
          fillAndStroke(c, '#e1f5fe', OUTLINE, 1.7);
          c.restore();
        }

        // Ledově azurové průsvitné tělo
        drawJellyBlob(
          c, rad * 1.0, rad * 0.94,
          '#29b6f6', '#0277bd', '#e1f5fe',
          (ic, rx, ry) => {
            // Ledový krystal uvnitř
            polyPath(ic, -rx * 0.15, 0, rad * 0.45, 6, 0);
            fillAndStroke(ic, '#b3e5fc', '#01579b', 1.4);
          },
          2.0
        );

        drawEyes(c, rad * 0.38, rad * 0.3, Math.max(2.2, rad * 0.2), '#01579b');
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad * 1.05, rad);
      if (state.shield) drawRunicBubble(ctx, rad * 1.15, ts);
      ctx.restore();
    },

    // ==========================================================================
    // 9. BOSS: KRÁLOVNA ROJE (kralovna_roje) — Jantarovo-smaragdová s plástvemi a křídly
    // ==========================================================================
    kralovna_roje: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(20, Math.round(r || 34));
      const isSpawning = Boolean(state.spawning);
      const wb = getWobble(ts, state, isSpawning ? 1.5 : 0.85);

      // 1. Rotující runová pečeť pod bossem
      drawBossRunicSeal(ctx, rad, ts, state);

      // Aura zrychlení roje / kladení Dělivých slizů
      if (isSpawning) {
        const p = 1 + Math.sin((ts || 0) * 0.015) * 0.08;
        ctx.fillStyle = 'rgba(118, 255, 3, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.32 * p, 0, TAU);
        ctx.fill();
      }

      // 2. Měkký stín bosse
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(5, 6, rad * 1.12 * wb.stretch, rad * 0.98 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.scale(wb.stretch, wb.squash);

      // 3. Průsvitná hmyzí křídla po stranách (kmitají podle ts)
      const wingBuzz = (state.frozen || state.stunned)
        ? 0
        : Math.sin((ts || 0) * (isSpawning ? 0.035 : 0.018)) * 0.22;

      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(-rad * 0.1, side * rad * 0.55);
        ctx.rotate(side * (0.25 + wingBuzz));

        // Zadní menší křídlo
        ctx.beginPath();
        ctx.ellipse(-rad * 0.35, side * rad * 0.48, rad * 0.32, rad * 0.52, side * 0.35, 0, TAU);
        fillAndStroke(ctx, 'rgba(224, 247, 250, 0.62)', OUTLINE, 1.8);

        // Hlavní velké blanité křídlo s žilkováním
        ctx.beginPath();
        ctx.ellipse(0, side * rad * 0.62, rad * 0.42, rad * 0.72, -side * 0.2, 0, TAU);
        fillAndStroke(ctx, 'rgba(178, 235, 242, 0.72)', OUTLINE, 2.0);

        ctx.strokeStyle = 'rgba(0, 131, 143, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, side * rad * 1.15);
        ctx.moveTo(0, side * rad * 0.5);
        ctx.lineTo(rad * 0.25, side * rad * 0.85);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Předkreslené tělo Královny roje z offscreen cache
      const sprite = getCachedBody(`kralovna_roje_${rad}`, rad * 2.8, rad * 2.8, c => {
        drawJellyBlob(
          c, rad * 1.08, rad * 0.96,
          '#ffb300', '#e65100', '#fff59d',
          (ic, rx, ry) => {
            // Smaragdové jádro a šestiúhelníkové medové plástve uvnitř rosolu
            ic.fillStyle = 'rgba(0, 200, 83, 0.45)';
            ic.beginPath();
            ic.arc(-rx * 0.15, 0, rad * 0.68, 0, TAU);
            ic.fill();

            const hexR = rad * 0.22;
            const hexCenters = [
              [-rad * 0.32, -rad * 0.22],
              [-rad * 0.32, rad * 0.22],
              [0, -rad * 0.38],
              [0, 0],
              [0, rad * 0.38],
              [-rad * 0.62, 0]
            ];
            for (const [hx, hy] of hexCenters) {
              polyPath(ic, hx, hy, hexR, 6, 0);
              fillAndStroke(ic, '#ffd54f', '#bf360c', 1.5);
            }
          },
          2.5
        );

        // Královská čelenka s tykadly
        c.strokeStyle = OUTLINE;
        c.lineWidth = 2.2;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(rad * 0.45, side * rad * 0.22);
          c.quadraticCurveTo(rad * 0.85, side * rad * 0.55, rad * 1.05, side * rad * 0.42);
          c.stroke();
          c.beginPath();
          c.arc(rad * 1.05, side * rad * 0.42, rad * 0.12, 0, TAU);
          fillAndStroke(c, '#00e676', OUTLINE, 1.6);
        }

        // Zlatá královská koruna se smaragdem
        c.beginPath();
        c.moveTo(-rad * 0.35, -rad * 0.45);
        c.lineTo(rad * 0.25, -rad * 0.62);
        c.lineTo(rad * 0.05, -rad * 0.2);
        c.lineTo(rad * 0.35, 0);
        c.lineTo(rad * 0.05, rad * 0.2);
        c.lineTo(rad * 0.25, rad * 0.62);
        c.lineTo(-rad * 0.35, rad * 0.45);
        c.closePath();
        fillAndStroke(c, '#ffd740', OUTLINE, 2.2);

        polyPath(c, -rad * 0.05, 0, rad * 0.18, 6, 0);
        fillAndStroke(c, '#00e676', OUTLINE, 1.5);

        drawEyes(c, rad * 0.46, rad * 0.34, Math.max(3.5, rad * 0.19), '#1b5e20', true);
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      if (state.hit) drawHitFlash(ctx, rad * 1.08, rad * 0.96);
      if (state.shield) drawRunicBubble(ctx, rad * 1.15, ts);
      ctx.restore();

      // 5. Lišta životů bosse (nerotuje s tělem)
      drawBossHpBar(ctx, rad, state);
      ctx.restore();
    },

    // ==========================================================================
    // 10. BOSS: KRYSTALOVÝ BEHEMOT (krystalovy_behemot) — Indigový kolos s krystaly a geodou
    // ==========================================================================
    krystalovy_behemot: function (ctx, r, ts, s) {
      ctx.save();
      const state = s || {};
      const rad = Math.max(24, Math.round(r || 42));
      const wb = getWobble(ts, state, 0.7);
      const shellOn = Boolean(state.shellActive);

      // 1. Rotující runová pečeť pod bossem
      drawBossRunicSeal(ctx, rad, ts, state);

      // 2. Měkký stín bosse
      ctx.fillStyle = SHADOW_COL;
      ctx.beginPath();
      ctx.ellipse(6, 7, rad * 1.1 * wb.stretch, rad * 1.02 * wb.squash, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.scale(wb.stretch, wb.squash);

      // 3. Předkreslené tělo Krystalového behemota z offscreen cache
      const sprite = getCachedBody(`krystalovy_behemot_${rad}`, rad * 3.0, rad * 3.0, c => {
        // Obří fialové a tyrkysové krystaly trčící po obvodu kolosu
        const crystals = [
          { a: -2.4, len: 1.32, w: 0.28, col: '#e040fb', hi: '#ea80fc' },
          { a: -1.65, len: 1.26, w: 0.25, col: '#00e5ff', hi: '#84ffff' },
          { a: -0.95, len: 1.22, w: 0.24, col: '#aa00ff', hi: '#ea80fc' },
          { a: 0.95, len: 1.22, w: 0.24, col: '#aa00ff', hi: '#ea80fc' },
          { a: 1.65, len: 1.26, w: 0.25, col: '#00e5ff', hi: '#84ffff' },
          { a: 2.4, len: 1.32, w: 0.28, col: '#e040fb', hi: '#ea80fc' },
          { a: PI, len: 1.36, w: 0.32, col: '#00e5ff', hi: '#ffffff' }
        ];
        for (const cr of crystals) {
          c.save();
          c.rotate(cr.a);
          c.beginPath();
          c.moveTo(rad * 0.65, -rad * cr.w);
          c.lineTo(rad * cr.len, 0);
          c.lineTo(rad * 0.65, rad * cr.w);
          c.closePath();
          fillAndStroke(c, cr.col, OUTLINE, 2.2);

          // Světlá fazeta krystalu
          c.fillStyle = cr.hi;
          c.beginPath();
          c.moveTo(rad * 0.7, -rad * cr.w * 0.7);
          c.lineTo(rad * (cr.len - 0.06), 0);
          c.lineTo(rad * 0.7, 0);
          c.closePath();
          c.fill();
          c.restore();
        }

        // Indigově modré tělo s krystalovou geodou v hrudi
        drawJellyBlob(
          c, rad * 1.02, rad * 0.98,
          '#283593', '#1a237e', '#7986cb',
          (ic, rx, ry) => {
            // Zářící geoda uprostřed těla
            polyPath(ic, -rx * 0.12, 0, rad * 0.56, 8, PI / 8);
            fillAndStroke(ic, '#4a148c', OUTLINE, 2.0);
            polyPath(ic, -rx * 0.12, 0, rad * 0.38, 8, 0);
            fillAndStroke(ic, '#e040fb', '#ffffff', 1.5);
            ic.fillStyle = '#84ffff';
            ic.beginPath();
            ic.arc(-rx * 0.18, -ry * 0.08, rad * 0.16, 0, TAU);
            ic.fill();
          },
          2.6
        );

        // Platinová koruna na hlavě
        c.beginPath();
        c.moveTo(-rad * 0.25, -rad * 0.52);
        c.lineTo(rad * 0.32, -rad * 0.68);
        c.lineTo(rad * 0.12, -rad * 0.24);
        c.lineTo(rad * 0.42, 0);
        c.lineTo(rad * 0.12, rad * 0.24);
        c.lineTo(rad * 0.32, rad * 0.68);
        c.lineTo(-rad * 0.25, rad * 0.52);
        c.closePath();
        fillAndStroke(c, '#eceff1', OUTLINE, 2.2);

        polyPath(c, 0, 0, rad * 0.2, 6, 0);
        fillAndStroke(c, '#00e5ff', OUTLINE, 1.5);

        drawEyes(c, rad * 0.46, rad * 0.36, Math.max(4.0, rad * 0.19), '#00e5ff', true);
      });

      ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);

      // 4. Aktivní krystalový štít (prismatic_shell, s.shellActive === true)
      if (shellOn) {
        const rot = (ts || 0) * 0.002;
        ctx.save();
        ctx.rotate(rot);
        polyPath(ctx, 0, 0, rad * 1.25, 8, 0);
        fillAndStroke(ctx, 'rgba(224, 64, 251, 0.24)', '#00e5ff', 2.8);

        polyPath(ctx, 0, 0, rad * 1.12, 8, PI / 8);
        ctx.strokeStyle = '#ea80fc';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      }

      if (state.hit) drawHitFlash(ctx, rad * 1.05, rad * 1.02);
      if (state.shield) drawRunicBubble(ctx, rad * 1.22, ts);
      ctx.restore();

      // 5. Lišta životů bosse
      drawBossHpBar(ctx, rad, state);
      ctx.restore();
    }
  });
})();

/**
 * ZOMBIE SURVIVAL - Procedurální 2D Sprite & Texture Engine (Část 2: Infrastruktura, Úroda, Summony)
 * Rozšiřuje existující window.ZS bez přepsání původních funkcí.
 * Optimalizováno pro 60 FPS na mobilních zařízeních (offscreen caching, žádné shadowBlur ani roundRect).
 */
(function (global) {
  'use strict';

  const ZS = global.ZS || (global.ZS = {});
  const cache2 = new Map();

  // --- POMOCNÉ FUNKCE & MATEMATIKA ---

  // Seedovaný generátor náhodných čísel (Mulberry32) - deterministický výstup bez blikání
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hash ze souřadnic pro deterministické detaily
  function coordSeed(x, y, extra = 0) {
    return ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (extra * 83492791)) >>> 0;
  }

  // Vytvoří offscreen canvas
  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Získá z cache nebo předkreslí offscreen canvas
  function getCached(key, w, h, drawFn) {
    let item = cache2.get(key);
    if (!item) {
      const c = createCanvas(w, h);
      const ctx = c.getContext('2d');
      drawFn(ctx, c.width, c.height);
      item = c;
      cache2.set(key, item);
    }
    return item;
  }

  // Vlastní zaoblený obdélník (kompatibilní se všemi webviews bez ctx.roundRect)
  function drawRRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
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
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Kruh s obrysem a horním levým odleskem
  function drawSphere(ctx, x, y, r, fill, stroke = '#111115', lineWidth = 2, highlight = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (highlight && r > 3.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (stroke && lineWidth > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Bitová maska sousedů (N=1, E=2, S=4, W=8)
  function getLinkMask(links) {
    if (!links) return 0;
    return (links.n ? 1 : 0) | (links.e ? 2 : 0) | (links.s ? 4 : 0) | (links.w ? 8 : 0);
  }

  // ============================================================================
  // 1) INFRASTRUKTURA NA MŘÍŽCE – ZS.infra(ctx, type, cx, cy, size, state, ts)
  // ============================================================================

  function bakeChannel(S, mask, fed, fresh) {
    const key = `inf_chan_${S}_${mask}_${fed ? 1 : 0}_${fresh ? 1 : 0}`;
    return getCached(key, S, S, (ctx) => {
      const hs = S / 2;
      const cw = S * 0.54; // Šířka kamenného koryta
      const iw = S * 0.36; // Šířka vnitřního žlabu
      const n = !!(mask & 1), e = !!(mask & 2), s = !!(mask & 4), w = !!(mask & 8);

      ctx.translate(hs, hs);

      // 1. Vnější tmavý obrys a kamenný okraj koryta
      ctx.fillStyle = '#111115';
      const pad = 2;
      drawRRect(ctx, -cw / 2 - pad, -cw / 2 - pad, cw + pad * 2, cw + pad * 2, 4, '#111115');
      if (n) ctx.fillRect(-cw / 2 - pad, -hs, cw + pad * 2, hs);
      if (s) ctx.fillRect(-cw / 2 - pad, 0, cw + pad * 2, hs);
      if (w) ctx.fillRect(-hs, -cw / 2 - pad, hs, cw + pad * 2);
      if (e) ctx.fillRect(0, -cw / 2 - pad, hs, cw + pad * 2);

      // Kamenné zdivo obruby
      ctx.fillStyle = '#475569';
      drawRRect(ctx, -cw / 2, -cw / 2, cw, cw, 3, '#475569');
      if (n) ctx.fillRect(-cw / 2, -hs, cw, hs);
      if (s) ctx.fillRect(-cw / 2, 0, cw, hs);
      if (w) ctx.fillRect(-hs, -cw / 2, hs, cw);
      if (e) ctx.fillRect(0, -cw / 2, hs, cw);

      // Spáry v kamenné obrubě
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, -hs + 6); ctx.lineTo(cw / 2, -hs + 6);
      ctx.moveTo(-cw / 2, hs - 6); ctx.lineTo(cw / 2, hs - 6);
      ctx.moveTo(-hs + 6, -cw / 2); ctx.lineTo(-hs + 6, cw / 2);
      ctx.moveTo(hs - 6, -cw / 2); ctx.lineTo(hs - 6, cw / 2);
      ctx.stroke();

      // 2. Vnitřní prohlubeň (dno kanálu nebo voda)
      const waterCol = !fed ? '#18181b' : fresh ? '#0284c7' : '#3f6212';
      const innerShadow = !fed ? '#09090b' : fresh ? '#0369a1' : '#365314';

      ctx.fillStyle = innerShadow;
      drawRRect(ctx, -iw / 2 - 1, -iw / 2 - 1, iw + 2, iw + 2, 2, innerShadow);
      if (n) ctx.fillRect(-iw / 2 - 1, -hs, iw + 2, hs);
      if (s) ctx.fillRect(-iw / 2 - 1, 0, iw + 2, hs);
      if (w) ctx.fillRect(-hs, -iw / 2 - 1, hs, iw + 2);
      if (e) ctx.fillRect(0, -iw / 2 - 1, hs, iw + 2);

      ctx.fillStyle = waterCol;
      drawRRect(ctx, -iw / 2, -iw / 2, iw, iw, 2, waterCol);
      if (n) ctx.fillRect(-iw / 2, -hs, iw, hs);
      if (s) ctx.fillRect(-iw / 2, 0, iw, hs);
      if (w) ctx.fillRect(-hs, -iw / 2, hs, iw);
      if (e) ctx.fillRect(0, -iw / 2, hs, iw);

      // Pokud je kanál suchý, vykresli praskliny a kamínky na dně
      if (!fed) {
        ctx.fillStyle = '#27272a';
        ctx.fillRect(-3, -4, 3, 3);
        ctx.fillRect(2, 3, 2, 2);
      }
    });
  }

  function bakeWire(S, mask, powered) {
    const key = `inf_wire_${S}_${mask}_${powered ? 1 : 0}`;
    return getCached(key, S, S, (ctx) => {
      const hs = S / 2;
      const n = !!(mask & 1), e = !!(mask & 2), s = !!(mask & 4), w = !!(mask & 8);
      ctx.translate(hs, hs);

      const drawSeg = (x1, y1, x2, y2, width, col) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      const dirs = [];
      if (n) dirs.push([0, -hs]);
      if (s) dirs.push([0, hs]);
      if (w) dirs.push([-hs, 0]);
      if (e) dirs.push([hs, 0]);

      // Černý obrys kabelu
      for (const [dx, dy] of dirs) drawSeg(0, 0, dx, dy, 9, '#111115');
      // Gumová izolace
      for (const [dx, dy] of dirs) drawSeg(0, 0, dx, dy, 5.5, '#27272a');
      // Vnitřní měděná/aktivní žíla
      const coreCol = powered ? '#facc15' : '#78350f';
      for (const [dx, dy] of dirs) drawSeg(0, 0, dx, dy, 2.2, coreCol);

      // Kovové svorky na ramenou
      ctx.fillStyle = '#52525b';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.2;
      if (n) { drawRRect(ctx, -4, -hs * 0.65, 8, 4, 1, '#52525b', '#111', 1.2); }
      if (s) { drawRRect(ctx, -4, hs * 0.65 - 4, 8, 4, 1, '#52525b', '#111', 1.2); }
      if (w) { drawRRect(ctx, -hs * 0.65, -4, 4, 8, 1, '#52525b', '#111', 1.2); }
      if (e) { drawRRect(ctx, hs * 0.65 - 4, -4, 4, 8, 1, '#52525b', '#111', 1.2); }

      // Středová rozvodná krabice
      drawSphere(ctx, 0, 0, 6.5, '#3f3f46', '#111115', 2, true);
      drawSphere(ctx, 0, 0, 3, powered ? '#fef08a' : '#52525b', '#111', 1, false);
    });
  }

  function bakeWell(S, levelBucket, spoiled, fed) {
    const key = `inf_well_${S}_${levelBucket}_${spoiled ? 1 : 0}_${fed ? 1 : 0}`;
    return getCached(key, S + 8, S + 8, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const R = S * 0.44;

      // Stín
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.arc(3, 4, R, 0, Math.PI * 2);
      ctx.fill();

      // Pokud je napojena (fed), krátké přívodní hrdlo na okraji
      if (fed) {
        drawRRect(ctx, -6, -R - 3, 12, 8, 2, '#475569', '#111', 2);
      }

      // Kamenné obložení studny
      drawSphere(ctx, 0, 0, R, '#64748b', '#111115', 2.5, true);

      // Spáry kamenů po obvodu
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
        ctx.lineTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
        ctx.stroke();
      }

      // Tmavá šachta studny
      const innerR = R * 0.65;
      drawSphere(ctx, 0, 0, innerR, '#09090b', '#111115', 2, false);

      // Hladina vody podle level (0..4)
      if (levelBucket > 0) {
        const wR = innerR * (0.35 + (levelBucket / 4) * 0.62);
        const wCol = spoiled ? '#4d5e28' : '#0284c7';
        const wHi = spoiled ? '#84cc16' : '#38bdf8';
        drawSphere(ctx, 0, 0, wR, wCol, null, 0, false);
        ctx.fillStyle = wHi;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(-wR * 0.2, -wR * 0.2, wR * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Dřevěný rumpál / kladka přes střed a vědro
      drawRRect(ctx, -R * 0.85, -R * 0.22, R * 0.3, R * 0.44, 2, '#78350f', '#111', 1.8);
      drawRRect(ctx, R * 0.55, -R * 0.22, R * 0.3, R * 0.44, 2, '#78350f', '#111', 1.8);
      // Hřídel rumpálu
      drawRRect(ctx, -R * 0.7, -3, R * 1.4, 6, 2, '#92400e', '#111', 1.5);
      // Provaz namotaný uprostřed
      drawRRect(ctx, -4, -4.5, 8, 9, 2, '#d6d3d1', '#111', 1.2);
      // Dřevěné vědro na okraji
      drawSphere(ctx, R * 0.28, R * 0.32, 5.5, '#78350f', '#111', 1.5, false);
      drawSphere(ctx, R * 0.28, R * 0.32, 3, spoiled ? '#4d5e28' : '#38bdf8', null, 0, false);
    });
  }

  function bakePurifier(S, fed) {
    const key = `inf_pur_${S}_${fed ? 1 : 0}`;
    return getCached(key, S + 8, S + 8, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const hs = S * 0.44;

      // Stín
      drawRRect(ctx, -hs + 3, -hs + 4, hs * 2, hs * 2, 6, 'rgba(0,0,0,0.42)');

      // Kovová základna s trubkami po stranách
      drawRRect(ctx, -hs - 2, -6, hs * 2 + 4, 12, 3, '#334155', '#111', 2);
      drawRRect(ctx, -6, -hs - 2, 12, hs * 2 + 4, 3, '#334155', '#111', 2);
      drawRRect(ctx, -hs, -hs, hs * 2, hs * 2, 6, '#475569', '#111115', 2.2);

      // Menší filtrační komora vlevo nahoře
      drawSphere(ctx, -hs * 0.45, -hs * 0.45, S * 0.16, '#64748b', '#111', 1.8, true);

      // Hlavní nádrž s průhledem na vodu vpravo dole
      const tankR = S * 0.27;
      drawSphere(ctx, hs * 0.18, hs * 0.15, tankR, '#1e293b', '#111', 2, false);
      drawSphere(ctx, hs * 0.18, hs * 0.15, tankR * 0.78, fed ? '#0ea5e9' : '#0f172a', '#111', 1.2, fed);

      // Stavová kontrolka v levém dolním rohu
      drawSphere(ctx, -hs * 0.52, hs * 0.52, 4.2, fed ? '#22c55e' : '#ef4444', '#111', 1.5, false);
    });
  }

  function bakeWheelBase(S) {
    const key = `inf_wheel_base_${S}`;
    return getCached(key, S + 8, S + 8, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const hs = S * 0.44;
      // Kamenné podpěry ložisek po stranách
      drawRRect(ctx, -hs + 2, -hs + 2, 10, hs * 2 - 4, 3, 'rgba(0,0,0,0.4)');
      drawRRect(ctx, hs - 8, -hs + 2, 10, hs * 2 - 4, 3, 'rgba(0,0,0,0.4)');
      drawRRect(ctx, -hs, -hs, 10, hs * 2, 3, '#475569', '#111', 2);
      drawRRect(ctx, hs - 10, -hs, 10, hs * 2, 3, '#475569', '#111', 2);
    });
  }

  function bakeWheelRotor(S) {
    const key = `inf_wheel_rotor_${S}`;
    return getCached(key, S + 8, S + 8, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const R = S * 0.42;

      // Lopatky vodního kola (8 kusů)
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 4);
        drawRRect(ctx, -3.5, -R, 7, R * 2, 2, '#78350f', '#111', 1.5);
        // Koncové dřevěné lopatky
        drawRRect(ctx, -6, -R - 1, 12, 6, 1.5, '#b45309', '#111', 1.5);
        drawRRect(ctx, -6, R - 5, 12, 6, 1.5, '#b45309', '#111', 1.5);
        ctx.restore();
      }

      // Dřevěný obvodový věnec kola
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = '#111115';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Kovový střed (osa)
      drawSphere(ctx, 0, 0, 6.5, '#64748b', '#111', 2, true);
    });
  }

  function bakeSprinkler(S, powered) {
    const key = `inf_sprink_${S}_${powered ? 1 : 0}`;
    return getCached(key, S, S, (ctx) => {
      ctx.translate(S / 2, S / 2);
      // Stín
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(2, 3, S * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Kovový podstavec v zemi
      drawSphere(ctx, 0, 0, S * 0.28, '#334155', '#111115', 2, true);
      drawSphere(ctx, 0, 0, S * 0.17, powered ? '#0284c7' : '#475569', '#111', 1.5, false);
    });
  }

  function bakeFence(S, powered) {
    const key = `inf_fence_${S}_${powered ? 1 : 0}`;
    return getCached(key, S + 8, S + 8, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const hs = S / 2;

      // Stín
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.arc(3, 4, 11, 0, Math.PI * 2);
      ctx.fill();

      // Elektrické vodivé dráty do stran
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-hs, 0); ctx.lineTo(hs, 0);
      ctx.moveTo(0, -hs); ctx.lineTo(0, hs);
      ctx.stroke();

      ctx.strokeStyle = powered ? '#38bdf8' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-hs, 0); ctx.lineTo(hs, 0);
      ctx.moveTo(0, -hs); ctx.lineTo(0, hs);
      ctx.stroke();

      // Keramické izolátory (4 strany)
      const isoCol = powered ? '#7dd3fc' : '#cbd5e1';
      drawSphere(ctx, 0, -13, 4, isoCol, '#111', 1.5, false);
      drawSphere(ctx, 0, 13, 4, isoCol, '#111', 1.5, false);
      drawSphere(ctx, -13, 0, 4, isoCol, '#111', 1.5, false);
      drawSphere(ctx, 13, 0, 4, isoCol, '#111', 1.5, false);

      // Hlavní kovový sloupek s výstražným středem
      drawSphere(ctx, 0, 0, 10, '#3f3f46', '#111115', 2.2, true);
      drawSphere(ctx, 0, 0, 4.5, powered ? '#facc15' : '#71717a', '#111', 1.2, false);
    });
  }

  function bakePlot(S, soil) {
    const key = `inf_plot_${S}_${soil}`;
    return getCached(key, S + 6, S + 6, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const hs = S / 2;

      // Stín
      drawRRect(ctx, -hs + 2, -hs + 3, S, S, 4, 'rgba(0,0,0,0.38)');

      // Prkenný dřevěný rámeček
      drawRRect(ctx, -hs, -hs, S, S, 4, '#78350f', '#111115', 2);

      // Barva hlíny podle stavu
      let soilCol = '#3e2723'; // empty
      let furrowCol = '#271714';
      if (soil === 'growing') {
        soilCol = '#2d1a12';
        furrowCol = '#1b0f0a';
      } else if (soil === 'ready') {
        soilCol = '#231709';
        furrowCol = '#140c04';
      } else if (soil === 'withered') {
        soilCol = '#57534e';
        furrowCol = '#292524';
      }

      const pad = 5;
      drawRRect(ctx, -hs + pad, -hs + pad, S - pad * 2, S - pad * 2, 2, soilCol, '#1c1917', 1.5);

      // Brázdy v hlíně
      for (let y = -hs + pad + 6; y <= hs - pad - 5; y += 8) {
        drawRRect(ctx, -hs + pad + 4, y - 2, S - pad * 2 - 8, 4, 2, furrowCol);
      }

      // Specifické detaily stavu půdy
      if (soil === 'ready') {
        // Jemný zlatozelený lem úrodné půdy
        ctx.strokeStyle = 'rgba(132, 204, 22, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-hs + pad + 1, -hs + pad + 1, S - pad * 2 - 2, S - pad * 2 - 2);
      } else if (soil === 'withered') {
        // Praskliny vyschlé země
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, -8); ctx.lineTo(-2, 0); ctx.lineTo(-8, 9);
        ctx.moveTo(8, -10); ctx.lineTo(3, 4); ctx.lineTo(11, 10);
        ctx.stroke();
      }

      // Hřebíky v rozích rámu
      ctx.fillStyle = '#a8a29e';
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          ctx.fillRect(sx * (hs - 3.5) - 1, sy * (hs - 3.5) - 1, 2, 2);
        }
      }
    });
  }

  ZS.infra = function (ctx, type, cx, cy, size, state, ts) {
    const S = Math.round(size || 50);
    const st = state || {};
    const time = ts || 0;

    ctx.save();
    ctx.translate(cx, cy);

    if (type === 'channel') {
      const mask = getLinkMask(st.links);
      const fed = !!st.fed;
      const fresh = st.fresh !== false;
      const img = bakeChannel(S, mask, fed, fresh);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Animace tekoucí vody
      if (fed) {
        const hs = S / 2;
        const offset = (time * 0.03) % 14;
        ctx.fillStyle = fresh ? 'rgba(186, 230, 253, 0.45)' : 'rgba(163, 230, 53, 0.35)';

        // Středové vlnky
        ctx.beginPath();
        ctx.arc(-3 + (offset % 6), -2, 2.2, 0, Math.PI * 2);
        ctx.fill();

        const l = st.links || {};
        if (l.n) ctx.fillRect(-3, -hs + offset, 2, 5);
        if (l.s) ctx.fillRect(2, offset, 2, 5);
        if (l.w) ctx.fillRect(-hs + offset, 2, 5, 2);
        if (l.e) ctx.fillRect(offset, -3, 5, 2);
      }
    } 
    else if (type === 'wire') {
      const mask = getLinkMask(st.links);
      const powered = !!st.powered;
      const img = bakeWire(S, mask, powered);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Animované jiskry cestující po kabelu
      if (powered) {
        const hs = S / 2;
        const p = ((time * 0.0025) % 1);
        const dist = p * hs;
        const l = st.links || {};
        ctx.fillStyle = '#fef08a';

        const drawSpark = (sx, sy) => {
          ctx.beginPath();
          ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
          ctx.fill();
        };

        if (l.n) drawSpark(0, -dist);
        if (l.s) drawSpark(0, dist);
        if (l.w) drawSpark(-dist, 0);
        if (l.e) drawSpark(dist, 0);
        if (!l.n && !l.s && !l.w && !l.e) {
          drawSpark(Math.cos(time * 0.01) * 3, Math.sin(time * 0.01) * 3);
        }
      }
    } 
    else if (type === 'well') {
      const lvl = Math.max(0, Math.min(1, st.level !== undefined ? st.level : 0.8));
      const bucket = Math.round(lvl * 4); // 5 diskrétních kroků pro malou cache
      const img = bakeWell(S, bucket, !!st.spoiled, !!st.fed);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Jemné vlnění hladiny
      if (bucket > 0) {
        const rPulse = 3 + Math.sin(time * 0.005) * 2;
        ctx.strokeStyle = st.spoiled ? 'rgba(163, 230, 53, 0.35)' : 'rgba(186, 230, 253, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(-2, -1, rPulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    } 
    else if (type === 'purifier') {
      const fed = !!st.fed;
      const img = bakePurifier(S, fed);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      if (fed) {
        // Bublinky v nádrži a pulzující kontrolka
        const hs = S * 0.44;
        const tx = hs * 0.18;
        const ty = hs * 0.15;
        const b1 = (time * 0.02) % 8;
        const b2 = ((time * 0.02) + 4) % 8;
        ctx.fillStyle = 'rgba(224, 242, 254, 0.75)';
        ctx.beginPath();
        ctx.arc(tx - 3, ty + 4 - b1, 2, 0, Math.PI * 2);
        ctx.arc(tx + 3, ty + 4 - b2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Záře zelené kontrolky
        ctx.fillStyle = `rgba(74, 222, 128, ${0.25 + 0.2 * Math.sin(time * 0.01)})`;
        ctx.beginPath();
        ctx.arc(-hs * 0.52, hs * 0.52, 7.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } 
    else if (type === 'wheel') {
      const base = bakeWheelBase(S);
      const rotor = bakeWheelRotor(S);
      ctx.drawImage(base, -base.width / 2, -base.height / 2);

      ctx.save();
      if (st.active) {
        ctx.rotate(time * 0.003);
      }
      ctx.drawImage(rotor, -rotor.width / 2, -rotor.height / 2);
      ctx.restore();

      // Vodní tříšť při otáčení
      if (st.active) {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
        for (let i = 0; i < 4; i++) {
          const a = time * 0.008 + i * 1.57;
          const dist = S * 0.36 + ((time * 0.04 + i * 5) % 8);
          ctx.beginPath();
          ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } 
    else if (type === 'sprinkler') {
      const powered = !!st.powered;
      const base = bakeSprinkler(S, powered);
      ctx.drawImage(base, -base.width / 2, -base.height / 2);

      // Otočná tryska
      ctx.save();
      const rot = powered ? time * 0.006 : 0.4;
      ctx.rotate(rot);
      drawRRect(ctx, -9, -2.5, 18, 5, 2, '#cbd5e1', '#111', 1.5);
      drawSphere(ctx, 0, 0, 4, '#38bdf8', '#111', 1.2, false);
      ctx.restore();

      // Rozstřik kapek v kruhu ~45 px
      if (powered) {
        const maxR = 45;
        // Jemný vlhký kruh dosahu
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, maxR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(125, 211, 252, 0.75)';
        for (let i = 0; i < 12; i++) {
          const prog = ((time * 0.002 + i * 0.17) % 1);
          const angle = i * (Math.PI / 6) + time * 0.002;
          const r = 8 + prog * (maxR - 8);
          ctx.globalAlpha = 1 - prog * 0.8;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, 2.2 * (1 - prog * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    } 
    else if (type === 'fence') {
      const powered = !!st.powered;
      const img = bakeFence(S, powered);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Elektrické jiskření kolem sloupku
      if (powered) {
        const step = Math.floor(time / 70);
        const rand = mulberry32(coordSeed(cx, cy, step));
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 2; i++) {
          const a = rand() * Math.PI * 2;
          const r1 = 6;
          const r2 = 16 + rand() * 6;
          const midA = a + (rand() - 0.5) * 0.7;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(midA) * ((r1 + r2) * 0.5), Math.sin(midA) * ((r1 + r2) * 0.5));
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
        }
      }
    } 
    else if (type === 'plot') {
      const soil = st.soil || 'empty';
      const img = bakePlot(S, soil);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }

    ctx.restore();
  };

  // ============================================================================
  // 2) ÚRODA NA ZÁHONU – ZS.crop(ctx, crop, cx, cy, growth, ts)
  // ============================================================================

  function bakeCropStage(crop, stage) {
    const type = stage === 3 ? 'withered' : crop;
    const key = `crop_${type}_s${stage}`;
    const size = 48;

    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);

      if (type === 'withered') {
        // Uschlá hnědošedá zkroucená rostlina
        const spots = [[-9, -8], [9, -7], [-8, 9], [8, 8], [0, 0]];
        for (const [sx, sy] of spots) {
          ctx.strokeStyle = '#111115';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(sx - 5, sy + 4); ctx.lineTo(sx, sy - 5); ctx.lineTo(sx + 5, sy + 2);
          ctx.stroke();

          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 2;
          ctx.stroke();
          drawSphere(ctx, sx, sy, 3, '#57534e', '#111', 1.2, false);
        }
        return;
      }

      // Fáze 0: Malé klíčky (společné pro rostliny, lehce odlišený odstín)
      if (stage === 0) {
        const spots = [[-9, -8], [9, -8], [-9, 8], [9, 8]];
        const col = crop === 'wheat' ? '#a3e635' : '#4ade80';
        for (const [sx, sy] of spots) {
          drawSphere(ctx, sx - 2.5, sy, 3.2, col, '#111', 1.4, false);
          drawSphere(ctx, sx + 2.5, sy + 1, 2.8, '#22c55e', '#111', 1.4, false);
        }
        return;
      }

      // Fáze 1 (střední zelená rostlina) a Fáze 2 (zralá s plodem)
      if (crop === 'carrot') {
        const spots = [[-10, -9], [10, -9], [-10, 9], [10, 9]];
        for (const [sx, sy] of spots) {
          // Zelená nať do hvězdice
          for (let i = 0; i < 5; i++) {
            const a = (i * Math.PI * 2) / 5;
            drawSphere(ctx, sx + Math.cos(a) * 4.5, sy + Math.sin(a) * 4.5, 3.5, '#16a34a', '#111', 1.4, false);
          }
          if (stage === 2) {
            // Jasně oranžová mrkev vykukující ze země
            drawSphere(ctx, sx, sy, 4.8, '#f97316', '#111', 1.6, true);
          } else {
            drawSphere(ctx, sx, sy, 3.2, '#4ade80', '#111', 1.3, false);
          }
        }
      } 
      else if (crop === 'wheat') {
        const sheaves = [[-11, -10], [0, -11], [11, -10], [-11, 1], [0, 0], [11, 1], [-10, 11], [0, 11], [10, 11]];
        const mainCol = stage === 2 ? '#facc15' : '#65a30d';
        const subCol = stage === 2 ? '#eab308' : '#84cc16';
        for (const [sx, sy] of sheaves) {
          if (stage === 2) {
            // Zlatý klas pšenice
            drawRRect(ctx, sx - 3.5, sy - 5.5, 7, 11, 3, mainCol, '#111', 1.5);
            drawSphere(ctx, sx, sy - 2, 2.5, '#fef08a', null, 0, false);
          } else {
            drawSphere(ctx, sx, sy, 4.2, mainCol, '#111', 1.4, false);
            drawSphere(ctx, sx - 1, sy - 1, 2, subCol, null, 0, false);
          }
        }
      } 
      else if (crop === 'tomato') {
        // Hustý keřík rajčete
        const leaves = [[-10, -10], [10, -10], [-10, 10], [10, 10], [0, -12], [0, 12], [-12, 0], [12, 0]];
        for (const [lx, ly] of leaves) {
          drawSphere(ctx, lx, ly, 6, '#15803d', '#111', 1.6, false);
        }
        drawSphere(ctx, 0, 0, 9.5, '#16a34a', '#111', 1.6, true);
        // Dřevěná opěrná tyčka uprostřed
        drawSphere(ctx, 0, 0, 3, '#78350f', '#111', 1.2, false);

        if (stage === 2) {
          // Zralá červená rajčata
          const fruits = [[-8, -7], [9, -6], [-7, 8], [8, 7], [0, -10]];
          for (const [fx, fy] of fruits) {
            drawSphere(ctx, fx, fy, 4.5, '#ef4444', '#111', 1.5, true);
          }
        } else {
          // Malé zelené plody / květy
          drawSphere(ctx, -6, -6, 2.8, '#bef264', '#111', 1, false);
          drawSphere(ctx, 6, 5, 2.8, '#bef264', '#111', 1, false);
        }
      } 
      else if (crop === 'pumpkin') {
        // Široké plazivé listy
        const leaves = [[-12, -10], [12, -10], [-12, 10], [12, 10], [-14, 0], [14, 0]];
        for (const [lx, ly] of leaves) {
          drawSphere(ctx, lx, ly, 6.5, '#14532d', '#111', 1.6, false);
        }
        if (stage === 2) {
          // Velká oranžová žebrovaná dýně uprostřed
          const pR = 12;
          drawSphere(ctx, 0, 1, pR, '#ea580c', '#111115', 2.2, true);
          // Žebra dýně
          ctx.strokeStyle = '#9a3412';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 1, pR * 0.65, 0, Math.PI * 2);
          ctx.moveTo(-pR, 1); ctx.lineTo(pR, 1);
          ctx.moveTo(0, 1 - pR); ctx.lineTo(0, 1 + pR);
          ctx.stroke();
          // Stopka
          drawSphere(ctx, 0, 1, 3.2, '#65a30d', '#111', 1.4, false);
        } else {
          drawSphere(ctx, 0, 0, 7.5, '#22c55e', '#111', 1.8, true);
          drawSphere(ctx, 0, 0, 3, '#facc15', '#111', 1, false);
        }
      } 
      else if (crop === 'melon') {
        // Listy melounu
        const leaves = [[-11, -11], [11, -11], [-11, 11], [11, 11], [0, -13], [0, 13]];
        for (const [lx, ly] of leaves) {
          drawSphere(ctx, lx, ly, 6, '#15803d', '#111', 1.6, false);
        }
        if (stage === 2) {
          // Oválný pruhovaný vodní meloun
          ctx.save();
          ctx.rotate(-0.25);
          drawRRect(ctx, -13, -10, 26, 20, 10, '#16a34a', '#111115', 2.2);
          // Tmavě zelené pruhy
          ctx.fillStyle = '#052e16';
          ctx.fillRect(-9, -8, 18, 3);
          ctx.fillRect(-11, -1.5, 22, 3);
          ctx.fillRect(-9, 5, 18, 3);
          // Odlesk
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(-4, -3, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          drawSphere(ctx, 0, 0, 7.5, '#4ade80', '#111', 1.8, true);
        }
      }
    });
  }

  ZS.crop = function (ctx, crop, cx, cy, growth, ts) {
    const g = Math.max(0, Math.min(1, growth || 0));
    const time = ts || 0;

    let stage = 0;
    if (crop === 'withered') {
      stage = 3;
    } else if (g >= 0.85) {
      stage = 2;
    } else if (g >= 0.35) {
      stage = 1;
    }

    const sprite = bakeCropStage(crop || 'carrot', stage);

    // Plynulá změna měřítka v rámci růstu + mírné kývání ve větru
    const baseScale = crop === 'withered' ? 1 : (stage === 0 ? 0.75 + g * 0.7 : stage === 1 ? 0.85 + (g - 0.35) * 0.3 : 1);
    const phase = time * 0.003 + (cx * 0.07 + cy * 0.05);
    const swayAngle = Math.sin(phase) * (stage === 2 ? 0.08 : 0.05);
    const pulse = stage === 2 ? 1 + Math.sin(time * 0.006 + cx) * 0.035 : 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(swayAngle);
    ctx.scale(baseScale * pulse, baseScale / pulse);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  };

  // ============================================================================
  // 3) VYVOLANÉ VĚCI A PASTI – ZS.summon(ctx, type, x, y, r, angle, ts)
  // ============================================================================

  function bakeWolf(R) {
    const key = `sum_wolf_${R}`;
    const size = Math.ceil(R * 3.0);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const out = Math.max(1.6, R * 0.12);

      // Huňatý ocas vzadu
      drawRRect(ctx, -R * 1.3, -R * 0.22, R * 0.65, R * 0.44, R * 0.2, '#475569', '#111', out * 0.9);
      // Tlapky
      drawRRect(ctx, -R * 0.7, -R * 0.82, R * 0.45, R * 1.64, R * 0.18, '#64748b', '#111', out);
      drawRRect(ctx, R * 0.2, -R * 0.85, R * 0.48, R * 1.7, R * 0.18, '#64748b', '#111', out);

      // Trup vlka (zdravá šedomodrá srst)
      drawRRect(ctx, -R * 0.95, -R * 0.58, R * 1.85, R * 1.16, R * 0.55, '#475569', '#111115', out);
      // Světlejší hřbetní srst a hříva kolem krku
      drawSphere(ctx, R * 0.15, 0, R * 0.58, '#64748b', null, 0, true);

      // Modrý spojenecký obojek
      drawRRect(ctx, R * 0.32, -R * 0.52, R * 0.22, R * 1.04, 2, '#0284c7', '#111', 1.2);

      // Hlava a čenich
      drawRRect(ctx, R * 0.35, -R * 0.42, R * 0.92, R * 0.84, R * 0.35, '#64748b', '#111115', out);
      // Čumák
      drawSphere(ctx, R * 1.18, 0, R * 0.16, '#09090b', null, 0, false);

      // Špičaté uši
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = out * 0.8;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(R * 0.55, s * R * 0.25);
        ctx.lineTo(R * 0.22, s * R * 0.62);
        ctx.lineTo(R * 0.35, s * R * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Jasně modré přátelské oči
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(R * 0.78, -R * 0.26, R * 0.18, R * 0.14);
      ctx.fillRect(R * 0.78, R * 0.12, R * 0.18, R * 0.14);
    });
  }

  function bakeTrap(R) {
    const key = `sum_trap_${R}`;
    const size = Math.ceil(R * 2.5);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      // Stín
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(2, 3, R * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // Pružiny po stranách
      drawRRect(ctx, -R * 1.05, -R * 0.22, R * 2.1, R * 0.44, 3, '#3f3f46', '#111', 1.8);

      // Ocelové rozevřené čelisti
      drawSphere(ctx, 0, 0, R * 0.88, '#52525b', '#111115', 2.2, false);
      drawSphere(ctx, 0, 0, R * 0.64, '#18181b', '#111', 1.5, false);

      // Zuby čelistí směřující dovnitř
      ctx.fillStyle = '#e2e8f0';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const tx = Math.cos(a) * R * 0.62;
        const ty = Math.sin(a) * R * 0.62;
        ctx.beginPath();
        ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nášlapný talířek uprostřed
      drawSphere(ctx, 0, 0, R * 0.36, '#71717a', '#111', 1.6, true);
      drawSphere(ctx, 0, 0, R * 0.14, '#ef4444', null, 0, false);
    });
  }

  function bakeBannerBase(R) {
    const key = `sum_banner_${R}`;
    const size = Math.ceil(R * 2.4);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      // Stín podstavce
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.arc(2, 3, R * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Kovový křížový stojan a zlatý podstavec
      drawRRect(ctx, -R * 0.65, -3, R * 1.3, 6, 2, '#78350f', '#111', 1.6);
      drawRRect(ctx, -3, -R * 0.65, 6, R * 1.3, 2, '#78350f', '#111', 1.6);
      drawSphere(ctx, 0, 0, R * 0.45, '#eab308', '#111115', 2, true);
    });
  }

  function bakeLure(R) {
    const key = `sum_lure_${R}`;
    const size = Math.ceil(R * 2.5);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      // Krvavá loužička pod masem
      ctx.fillStyle = 'rgba(153, 27, 27, 0.65)';
      ctx.beginPath();
      ctx.arc(1, 2, R * 0.92, 0, Math.PI * 2);
      ctx.fill();

      // Bílá kost vyčuhující na obou koncích
      ctx.save();
      ctx.rotate(-0.35);
      drawRRect(ctx, -R * 0.95, -R * 0.2, R * 1.9, R * 0.4, 3, '#f8fafc', '#111', 1.8);
      drawSphere(ctx, -R * 0.9, -R * 0.18, R * 0.22, '#f8fafc', '#111', 1.5, false);
      drawSphere(ctx, -R * 0.9, R * 0.18, R * 0.22, '#f8fafc', '#111', 1.5, false);
      drawSphere(ctx, R * 0.9, -R * 0.18, R * 0.22, '#f8fafc', '#111', 1.5, false);
      drawSphere(ctx, R * 0.9, R * 0.18, R * 0.22, '#f8fafc', '#111', 1.5, false);

      // Syrová flákota masa uprostřed
      drawRRect(ctx, -R * 0.65, -R * 0.55, R * 1.3, R * 1.1, R * 0.45, '#dc2626', '#111115', 2);
      // Mramorování tuku
      ctx.strokeStyle = '#fecaca';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-R * 0.1, 0, R * 0.3, 0.2, 2.5);
      ctx.stroke();
      ctx.restore();
    });
  }

  function bakeC4(R) {
    const key = `sum_c4_${R}`;
    const size = Math.ceil(R * 2.4);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const wBox = R * 1.5;
      const hBox = R * 1.15;

      // Stín
      drawRRect(ctx, -wBox / 2 + 2, -hBox / 2 + 3, wBox, hBox, 3, 'rgba(0,0,0,0.45)');

      // Dva bloky trhaviny C4 spojené páskou
      drawRRect(ctx, -wBox / 2, -hBox / 2, wBox, hBox * 0.48, 2, '#4d7c0f', '#111', 1.8);
      drawRRect(ctx, -wBox / 2, 0, wBox, hBox * 0.48, 2, '#4d7c0f', '#111', 1.8);

      // Černé stahovací pásky
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-wBox * 0.32, -hBox / 2, 4, hBox);
      ctx.fillRect(wBox * 0.28, -hBox / 2, 4, hBox);

      // Digitální rozbuška uprostřed
      drawRRect(ctx, -R * 0.42, -R * 0.35, R * 0.84, R * 0.7, 2, '#27272a', '#111', 1.6);
      // Zelený displej
      ctx.fillStyle = '#14532d';
      ctx.fillRect(-R * 0.3, -R * 0.2, R * 0.38, R * 0.4);
    });
  }

  function bakeGhostBoss(R) {
    const key = `sum_ghost_${R}`;
    const size = Math.ceil(R * 2.8);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const out = 2.2;

      // Vnější éterická aura
      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Vlající cáry pláště vzadu (-X)
      ctx.fillStyle = '#4c1d95';
      ctx.strokeStyle = '#111115';
      ctx.lineWidth = out;
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.85);
      ctx.lineTo(-R * 1.25, -R * 0.65);
      ctx.lineTo(-R * 0.85, -R * 0.25);
      ctx.lineTo(-R * 1.32, 0);
      ctx.lineTo(-R * 0.85, R * 0.25);
      ctx.lineTo(-R * 1.25, R * 0.65);
      ctx.lineTo(0, R * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Přízračné paže s drápy vpředu (+X)
      drawRRect(ctx, -R * 0.1, -R * 1.05, R * 1.05, R * 0.4, R * 0.2, '#6b21a8', '#111', out);
      drawRRect(ctx, -R * 0.1, R * 0.65, R * 1.05, R * 0.4, R * 0.2, '#6b21a8', '#111', out);

      // Hlavní tělo a kápě přízraku
      drawSphere(ctx, 0, 0, R * 0.88, '#581c87', '#111115', out * 1.1, true);
      drawSphere(ctx, R * 0.22, 0, R * 0.56, '#3b0764', '#111115', out, false);

      // Svítící azurovo-bílé oči v temnotě kápě
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(R * 0.48, -R * 0.22, R * 0.15, 0, Math.PI * 2);
      ctx.arc(R * 0.48, R * 0.22, R * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function bakeAcidPool(R) {
    const key = `sum_acid_${R}`;
    const size = Math.ceil(R * 2.3);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const rand = mulberry32(R * 1337);

      // Nepravidelný okraj louže ze složených laloků
      ctx.fillStyle = '#1a2e05';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.9, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const d = R * (0.45 + rand() * 0.25);
        const lr = R * (0.35 + rand() * 0.18);
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, lr + 2, 0, Math.PI * 2);
      }
      ctx.fill();

      // Hlavní jedovatě zelená kyselina
      const rand2 = mulberry32(R * 1337);
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.84, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const d = R * (0.45 + rand2() * 0.25);
        const lr = R * (0.35 + rand2() * 0.18);
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, lr, 0, Math.PI * 2);
      }
      ctx.fill();

      // Světlejší žlutozelené jádro
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.arc(-R * 0.1, -R * 0.08, R * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function bakeToxicZone(R) {
    const key = `sum_toxic_${R}`;
    const size = Math.ceil(R * 2.3);
    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const rand = mulberry32(R * 7919);

      // Vrstvené poloprůhledné oblaky (fialovo-zelený opar bez drahých gradientů v loopu)
      ctx.fillStyle = 'rgba(88, 28, 135, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.96, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const dist = R * (0.28 + rand() * 0.35);
        const rad = R * (0.35 + rand() * 0.22);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(132, 204, 22, 0.18)' : 'rgba(147, 51, 234, 0.20)';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Jemné částečky spór v oblaku
      ctx.fillStyle = 'rgba(190, 242, 100, 0.45)';
      for (let i = 0; i < 10; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * R * 0.78;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  ZS.summon = function (ctx, type, x, y, r, angle, ts) {
    const time = ts || 0;
    const ang = angle || 0;

    ctx.save();
    ctx.translate(x, y);

    if (type === 'wolf') {
      const R = Math.max(8, Math.round(r || 14));
      const img = bakeWolf(R);

      // Stín
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(2, 4, R * 0.95, R * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Běhová animace
      const phase = time * 0.015 + (x + y) * 0.05;
      const wobble = Math.sin(phase) * 0.07;
      const stretch = 1 + Math.sin(phase * 2) * 0.05;
      ctx.rotate(ang + wobble);
      ctx.scale(stretch, 1 / stretch);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } 
    else if (type === 'trap') {
      const R = Math.max(10, Math.round(r || 16));
      const img = bakeTrap(R);
      ctx.rotate(ang);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } 
    else if (type === 'banner') {
      const R = Math.max(12, Math.round(r || 18));
      const base = bakeBannerBase(R);

      // Jemná zlatá pulzující aura kolem praporu
      const pulse = 0.85 + 0.15 * Math.sin(time * 0.006);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.9 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.drawImage(base, -base.width / 2, -base.height / 2);

      // Vlající prapor ve větru
      const w1 = Math.sin(time * 0.008) * 5;
      const w2 = Math.cos(time * 0.008) * 4;
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#111115';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(R * 0.7, -8 + w1, R * 1.45, -2 + w2);
      ctx.lineTo(R * 1.15, 3 + w2 * 0.6);
      ctx.lineTo(R * 1.45, 8 + w2);
      ctx.quadraticCurveTo(R * 0.7, 8 + w1, 0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Zlatá hlavice žerdi
      drawSphere(ctx, 0, 0, 4.5, '#fef08a', '#111', 1.6, false);
    } 
    else if (type === 'lure') {
      const R = Math.max(8, Math.round(r || 14));
      const img = bakeLure(R);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Kroužící mouchy / pachové tečky nad masem
      ctx.fillStyle = '#111115';
      for (let i = 0; i < 2; i++) {
        const fa = time * 0.007 + i * 3.14;
        const fx = Math.cos(fa) * (R * 0.55) + Math.sin(time * 0.015) * 3;
        const fy = Math.sin(fa) * (R * 0.4) - 2;
        ctx.fillRect(fx, fy, 2.2, 2.2);
      }
    } 
    else if (type === 'c4') {
      const R = Math.max(8, Math.round(r || 13));
      const img = bakeC4(R);
      ctx.rotate(ang);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Blikající červená LED kontrolka
      const blink = Math.sin(time * 0.018) > 0;
      if (blink) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
        ctx.beginPath();
        ctx.arc(R * 0.18, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        drawSphere(ctx, R * 0.18, 0, 3.2, '#ef4444', '#111', 1, false);
      } else {
        drawSphere(ctx, R * 0.18, 0, 2.8, '#7f1d1d', '#111', 1, false);
      }
    } 
    else if (type === 'ghost_boss') {
      const R = Math.max(16, Math.round(r || 28));
      const img = bakeGhostBoss(R);

      // Vznášení a poloprůhledné pulzování
      const hoverY = Math.sin(time * 0.004) * 4;
      const scale = 1 + Math.sin(time * 0.006) * 0.05;
      ctx.translate(0, hoverY);
      ctx.globalAlpha = 0.76 + Math.sin(time * 0.005) * 0.12;
      ctx.rotate(ang + Math.sin(time * 0.003) * 0.08);
      ctx.scale(scale, 2 - scale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } 
    else if (type === 'acid_pool') {
      const R = Math.max(12, Math.round(r || 36));
      const img = bakeAcidPool(R);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      // Animované praskající bubliny v kyselině
      const rand = mulberry32(coordSeed(x, y, 77));
      ctx.fillStyle = '#ecfccb';
      ctx.strokeStyle = '#365314';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const prog = ((time * 0.0012 + i * 0.21) % 1);
        const a = rand() * Math.PI * 2 + i;
        const dist = rand() * R * 0.65;
        const bx = Math.cos(a) * dist;
        const by = Math.sin(a) * dist;
        const br = 1.5 + prog * 4;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } 
    else if (type === 'toxic_zone') {
      const R = Math.max(16, Math.round(r || 48));
      const img = bakeToxicZone(R);

      // Pomalá rotace a dýchání toxického mraku
      const s = 0.96 + Math.sin(time * 0.003) * 0.06;
      ctx.globalAlpha = 0.78 + Math.sin(time * 0.004) * 0.12;
      ctx.rotate(time * 0.0005);
      ctx.scale(s, s);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }

    ctx.restore();
  };

  // --- DIAGNOSTIKA CACHE (sloučí statistiku s případnou 1. částí) ---
  const prevGetStats = ZS.getCacheStats;
  ZS.getCacheStats2 = function () {
    let totalPixels = 0;
    cache2.forEach((c) => {
      totalPixels += c.width * c.height;
    });
    const memKB = Math.round((totalPixels * 4) / 1024);
    const prev = prevGetStats ? prevGetStats() : { entries: 0, memoryKB: 0 };
    return {
      entries2: cache2.size,
      memoryKB2: memKB,
      totalEntries: prev.entries + cache2.size,
      totalMemoryKB: prev.memoryKB + memKB,
    };
  };
})(window);

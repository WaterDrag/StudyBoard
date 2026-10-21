/**
 * ZOMBIE SURVIVAL - Procedurální 2D Sprite & Texture Engine
 * Optimalizováno pro 60 FPS na mobilních zařízeních (offscreen caching, žádné shadowBlur v loopu).
 */
(function (global) {
  'use strict';

  // Starší prohlížeče (Safari < 16, Firefox < 112) nemají ctx.roundRect — doplníme jednoduchou verzi,
  // jinak by hra na takovém telefonu spadla. (Doplněno při napojení do StudyBoardu.)
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.max(0, Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2));
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  const ZS = {};
  const cache = new Map();
  const patterns = new Map();

  // --- POMOCNÉ FUNKCE & MATEMATIKA ---

  // Seedovaný generátor náhodných čísel (Mulberry32) - zaručuje, že praskliny a skvrny nebudou blikat
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Rychlý hash ze souřadnic pro deterministický seed
  function coordSeed(x, y, extra = 0) {
    return ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (extra * 83492791)) >>> 0;
  }

  // Vytvoří offscreen canvas
  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }

  // Získá z cache nebo vygeneruje offscreen canvas
  function getCached(key, w, h, drawFn) {
    let item = cache.get(key);
    if (!item) {
      const c = createCanvas(w, h);
      const ctx = c.getContext('2d');
      drawFn(ctx, c.width, c.height);
      item = c;
      cache.set(key, item);
    }
    return item;
  }

  // Získá čistě bílou siluetu pro ultra-rychlý hitFlash bez použití drahých filtrů
  function getFlashSprite(key, baseCanvas) {
    const flashKey = key + '_flash';
    let item = cache.get(flashKey);
    if (!item) {
      const c = createCanvas(baseCanvas.width, baseCanvas.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(baseCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      item = c;
      cache.set(flashKey, item);
    }
    return item;
  }

  // Pomocná funkce pro kreslení zaobleného obdélníku s obrysem
  function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
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

  // Pomocná funkce pro kruh s obrysem a horním odleskem (světlo shora zleva)
  function drawSphere(ctx, x, y, r, fill, stroke = '#111115', lineWidth = 2, highlight = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (highlight && r > 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (stroke) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // --- 1. ZOMBÍCI (ZS.zombie) ---

  // Předkreslí konkrétní typ zombíka (směr doprava = 0 rad)
  function BakeZombie(type, R) {
    const size = Math.ceil(R * 2.8);
    const key = `z_${type}_${R}`;

    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const out = Math.max(1.5, R * 0.12); // Tloušťka obrysu

      if (type === 'normal') {
        // Ruce natažené dopředu
        roundRect(ctx, 0, -R * 0.75, R * 1.15, R * 0.36, R * 0.15, '#4d7c4f', '#141814', out);
        roundRect(ctx, 0, R * 0.39, R * 1.15, R * 0.36, R * 0.15, '#4d7c4f', '#141814', out);
        // Krvavé konečky prstů
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(R * 0.85, -R * 0.7, R * 0.25, R * 0.26);
        ctx.fillRect(R * 0.85, R * 0.44, R * 0.25, R * 0.26);
        // Ramena (potrhané triko)
        roundRect(ctx, -R * 0.65, -R * 0.9, R * 1.1, R * 1.8, R * 0.45, '#3b4252', '#141814', out);
        // Hlava
        drawSphere(ctx, R * 0.1, 0, R * 0.62, '#65a368', '#141814', out);
        // Jizva / mozek
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(-R * 0.1, -R * 0.2, R * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Červené oči
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(R * 0.48, -R * 0.28, R * 0.18, R * 0.16);
        ctx.fillRect(R * 0.48, R * 0.12, R * 0.18, R * 0.16);
      } 
      else if (type === 'speeder') {
        // Hubený, šlachovitý, ruce dozadu/do stran jako běžec
        ctx.save();
        ctx.rotate(0.25);
        roundRect(ctx, -R * 0.2, R * 0.4, R * 1.1, R * 0.28, R * 0.12, '#84a98c', '#141814', out);
        ctx.restore();
        ctx.save();
        ctx.rotate(-0.25);
        roundRect(ctx, -R * 0.2, -R * 0.68, R * 1.1, R * 0.28, R * 0.12, '#84a98c', '#141814', out);
        ctx.restore();
        // Úzká ramena s ostny/páteří
        roundRect(ctx, -R * 0.7, -R * 0.65, R * 1.1, R * 1.3, R * 0.35, '#2f3e46', '#141814', out);
        // Protáhlá hlava
        ctx.beginPath();
        ctx.ellipse(R * 0.2, 0, R * 0.68, R * 0.48, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#a3b18a';
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#141814';
        ctx.stroke();
        // Jasně žluté/oranžové šílené oči
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(R * 0.62, -R * 0.18, R * 0.14, 0, Math.PI * 2);
        ctx.arc(R * 0.62, R * 0.18, R * 0.14, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (type === 'tank') {
        // Obrovské pěsti vpředu
        drawSphere(ctx, R * 0.65, -R * 0.75, R * 0.42, '#4a5d4e', '#111', out);
        drawSphere(ctx, R * 0.65, R * 0.75, R * 0.42, '#4a5d4e', '#111', out);
        // Masivní břicho a záda
        drawSphere(ctx, -R * 0.1, 0, R * 0.98, '#3a4e40', '#111', out * 1.2);
        // Poničená vesta / řetězy přes ramena
        roundRect(ctx, -R * 0.6, -R * 0.85, R * 0.9, R * 1.7, R * 0.3, '#27272a', '#111', out);
        // Krvavé břicho vpředu
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(R * 0.35, 0, R * 0.45, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        // Malá zapuštěná hlava
        drawSphere(ctx, R * 0.35, 0, R * 0.44, '#5c7460', '#111', out);
        // Svítící oči
        ctx.fillStyle = '#ff2a2a';
        ctx.fillRect(R * 0.62, -R * 0.2, R * 0.15, R * 0.12);
        ctx.fillRect(R * 0.62, R * 0.08, R * 0.15, R * 0.12);
      } 
      else if (type === 'dog') {
        // Ocas
        roundRect(ctx, -R * 1.2, -R * 0.12, R * 0.5, R * 0.24, R * 0.1, '#451a1c', '#111', out * 0.8);
        // 4 nohy (vykukují do stran)
        roundRect(ctx, -R * 0.75, -R * 0.75, R * 0.45, R * 1.5, R * 0.15, '#5c2427', '#111', out);
        roundRect(ctx, R * 0.25, -R * 0.8, R * 0.45, R * 1.6, R * 0.15, '#5c2427', '#111', out);
        // Protáhlé psí tělo
        ctx.beginPath();
        ctx.ellipse(-R * 0.1, 0, R * 0.95, R * 0.52, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6e2b2e';
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#111';
        ctx.stroke();
        // Odhalená žebra na zádech
        ctx.fillStyle = '#fca5a5';
        for (let i = -2; i <= 1; i++) {
          ctx.fillRect(i * R * 0.22 - R * 0.1, -R * 0.32, R * 0.1, R * 0.64);
        }
        // Hlava a čenich
        ctx.beginPath();
        ctx.ellipse(R * 0.75, 0, R * 0.52, R * 0.38, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5c2427';
        ctx.fill();
        ctx.stroke();
        // Uši dozadu
        ctx.fillStyle = '#3b1517';
        ctx.beginPath();
        ctx.moveTo(R * 0.5, -R * 0.25);
        ctx.lineTo(R * 0.15, -R * 0.55);
        ctx.lineTo(R * 0.3, -R * 0.15);
        ctx.moveTo(R * 0.5, R * 0.25);
        ctx.lineTo(R * 0.15, R * 0.55);
        ctx.lineTo(R * 0.3, R * 0.15);
        ctx.fill();
        // Oči
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(R * 0.88, -R * 0.22, R * 0.16, R * 0.12);
        ctx.fillRect(R * 0.88, R * 0.1, R * 0.16, R * 0.12);
      } 
      else if (type === 'brute') {
        // Gorilí mutant (fialovo-šedý, obří klouby a kovové nárameníky)
        drawSphere(ctx, R * 0.55, -R * 0.85, R * 0.48, '#581c87', '#111', out);
        drawSphere(ctx, R * 0.55, R * 0.85, R * 0.48, '#581c87', '#111', out);
        // Tělo do V
        roundRect(ctx, -R * 0.75, -R * 0.95, R * 1.35, R * 1.9, R * 0.45, '#4c1d95', '#111', out * 1.1);
        // Kovové pláty na ramenou (ničí stavby)
        roundRect(ctx, -R * 0.3, -R * 1.05, R * 0.7, R * 0.55, R * 0.12, '#52525b', '#111', out);
        roundRect(ctx, -R * 0.3, R * 0.5, R * 0.7, R * 0.55, R * 0.12, '#52525b', '#111', out);
        // Hlava s čelistí
        roundRect(ctx, R * 0.25, -R * 0.45, R * 0.75, R * 0.9, R * 0.2, '#6b21a8', '#111', out);
        // Kly
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(R * 0.92, -R * 0.35, R * 0.22, R * 0.16);
        ctx.fillRect(R * 0.92, R * 0.19, R * 0.22, R * 0.16);
        // Žhnoucí oči
        ctx.fillStyle = '#f97316';
        ctx.fillRect(R * 0.65, -R * 0.28, R * 0.18, R * 0.18);
        ctx.fillRect(R * 0.65, R * 0.1, R * 0.18, R * 0.18);
      } 
      else if (type === 'exploder') {
        // Základní nafouklé tělo
        drawSphere(ctx, 0, 0, R * 0.95, '#365314', '#111', out);
        // Svítící toxické vředy / puchýře po těle
        const boils = [
          [-0.35, -0.45, 0.38, '#84cc16'],
          [-0.45, 0.35, 0.34, '#a3e635'],
          [0.15, -0.55, 0.3, '#f97316'],
          [0.2, 0.5, 0.35, '#84cc16'],
          [-0.1, 0, 0.45, '#bef264'],
        ];
        for (const [bx, by, br, col] of boils) {
          drawSphere(ctx, R * bx, R * by, R * br, col, '#1a2e05', out * 0.7);
        }
        // Malá hlava vpředu
        drawSphere(ctx, R * 0.55, 0, R * 0.42, '#4d7c0f', '#111', out);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(R * 0.8, -R * 0.15, R * 0.12, 0, Math.PI * 2);
        ctx.arc(R * 0.8, R * 0.15, R * 0.12, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (type === 'boss') {
        // Obří démon s rohy a ostny
        // Paže s drápy
        roundRect(ctx, -R * 0.1, -R * 1.1, R * 1.15, R * 0.48, R * 0.2, '#7f1d1d', '#09090b', out * 1.2);
        roundRect(ctx, -R * 0.1, R * 0.62, R * 1.15, R * 0.48, R * 0.2, '#7f1d1d', '#09090b', out * 1.2);
        // Drápy
        ctx.fillStyle = '#fbbf24';
        for (let s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(R * 1.0, s * R * 0.85 - R * 0.1);
          ctx.lineTo(R * 1.28, s * R * 0.85);
          ctx.lineTo(R * 1.0, s * R * 0.85 + R * 0.1);
          ctx.fill();
        }
        // Tělo s temným pancířem
        drawSphere(ctx, -R * 0.1, 0, R * 0.96, '#450a0a', '#09090b', out * 1.4);
        // Žhnoucí magmatické jádro na zádech/hrudi
        drawSphere(ctx, -R * 0.15, 0, R * 0.55, '#dc2626', '#111', out * 0.8);
        drawSphere(ctx, -R * 0.15, 0, R * 0.3, '#facc15', null, 0, false);
        // Hlava démona
        drawSphere(ctx, R * 0.42, 0, R * 0.52, '#991b1b', '#09090b', out * 1.2);
        // Zahnuté rohy dopředu
        for (let s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(R * 0.35, s * R * 0.4);
          ctx.quadraticCurveTo(R * 0.55, s * R * 1.15, R * 1.18, s * R * 0.65);
          ctx.quadraticCurveTo(R * 0.75, s * R * 0.75, R * 0.55, s * R * 0.3);
          ctx.closePath();
          ctx.fillStyle = '#18181b';
          ctx.fill();
          ctx.lineWidth = out;
          ctx.strokeStyle = '#000';
          ctx.stroke();
        }
        // 4 žhnoucí oči
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(R * 0.72, -R * 0.3, R * 0.18, R * 0.12);
        ctx.fillRect(R * 0.72, R * 0.18, R * 0.18, R * 0.12);
        ctx.fillRect(R * 0.55, -R * 0.42, R * 0.14, R * 0.1);
        ctx.fillRect(R * 0.55, R * 0.32, R * 0.14, R * 0.1);
      }
    });
  }

  ZS.zombie = function (ctx, type, x, y, r, angle, ts, hitFlash) {
    const R = Math.max(8, Math.round(r));
    const sprite = BakeZombie(type, R);

    ctx.save();
    ctx.translate(x, y);

    // Levný stín pod zombíkem (posunutý doprava dolů kvůli světlu shora zleva)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(2, 4, R * 0.92, R * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    // Speciální záře pod exploderem a bossem
    if (type === 'exploder') {
      const pulse = 0.85 + 0.25 * Math.sin(ts * 0.012);
      ctx.fillStyle = 'rgba(132, 204, 22, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.35 * pulse, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'boss') {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Animace chůze (kývání a natahování bez překreslování spritu)
    const speed = type === 'speeder' || type === 'dog' ? 0.016 : type === 'tank' || type === 'boss' ? 0.006 : 0.01;
    const phase = (x * 0.05 + y * 0.05) + ts * speed;
    const wobble = Math.sin(phase) * (type === 'dog' ? 0.06 : 0.11);
    let sx = 1 + Math.sin(phase * 2) * 0.04;
    let sy = 1 - Math.sin(phase * 2) * 0.04;

    if (type === 'exploder') {
      const p = 1 + Math.sin(ts * 0.015) * 0.09;
      sx *= p;
      sy *= p;
    }

    ctx.rotate(angle + wobble);
    ctx.scale(sx, sy);

    const hw = sprite.width / 2;
    const hh = sprite.height / 2;
    ctx.drawImage(sprite, -hw, -hh);

    // HitFlash (vykreslí předpřipravenou bílou siluetu s danou průhledností)
    if (hitFlash > 0.01) {
      const flashSprite = getFlashSprite(`z_${type}_${R}`, sprite);
      ctx.globalAlpha = Math.min(1, hitFlash);
      ctx.drawImage(flashSprite, -hw, -hh);
    }

    ctx.restore();
  };

  // --- 2. HRÁČI (ZS.player) ---

  function BakePlayer(kit, R, color) {
    const size = Math.ceil(R * 3.4); // Větší plátno kvůli zbraním (meč, hůl, puška)
    const key = `p_${kit}_${R}_${color}`;

    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const out = Math.max(1.8, R * 0.12);
      const skin = '#f3d2b3';

      // 1. Vrstva pod tělem (pláště, kápě, toulce)
      if (kit === 'mage' || kit === 'rogue' || kit === 'priest') {
        ctx.fillStyle = kit === 'rogue' ? '#1f2937' : kit === 'priest' ? '#f8fafc' : color;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = out;
        ctx.beginPath();
        ctx.arc(-R * 0.15, 0, R * 0.95, Math.PI * 0.45, Math.PI * 1.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (kit === 'archer') {
        // Toulec se šípy na zádech
        roundRect(ctx, -R * 0.85, -R * 0.55, R * 0.45, R * 0.7, R * 0.1, '#78350f', '#111', out * 0.8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-R * 0.78, -R * 0.68, R * 0.3, R * 0.15);
      }

      // 2. Ramena / Trup
      const bodyCol = kit === 'tank' ? '#64748b' : kit === 'rogue' ? '#374151' : color;
      roundRect(ctx, -R * 0.55, -R * 0.88, R * 1.05, R * 1.76, R * 0.45, bodyCol, '#111', out);

      // Detaily brnění / oblečení na ramenou
      if (kit === 'tank' || kit === 'warrior') {
        // Kovové nárameníky
        roundRect(ctx, -R * 0.45, -R * 0.96, R * 0.65, R * 0.52, R * 0.15, '#94a3b8', '#111', out * 0.9);
        roundRect(ctx, -R * 0.45, R * 0.44, R * 0.65, R * 0.52, R * 0.15, '#94a3b8', '#111', out * 0.9);
      } else if (kit === 'priest') {
        // Zlatá štóla přes ramena
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-R * 0.2, -R * 0.82, R * 0.32, R * 1.64);
      } else if (kit === 'engineer') {
        // Popruhy montérek
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-R * 0.3, -R * 0.78, R * 0.45, R * 0.25);
        ctx.fillRect(-R * 0.3, R * 0.53, R * 0.45, R * 0.25);
      }

      // 3. Zbraně a ruce (míří doprava = +X)
      if (kit === 'warrior') {
        // Pravá ruka + Meč
        drawSphere(ctx, R * 0.45, R * 0.72, R * 0.26, skin, '#111', out * 0.8);
        // Čepel meče
        ctx.beginPath();
        ctx.moveTo(R * 0.55, R * 0.62);
        ctx.lineTo(R * 1.55, R * 0.72);
        ctx.lineTo(R * 0.55, R * 0.82);
        ctx.closePath();
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.lineWidth = out * 0.8;
        ctx.strokeStyle = '#111';
        ctx.stroke();
        // Záštita
        roundRect(ctx, R * 0.42, R * 0.45, R * 0.18, R * 0.54, 2, '#f59e0b', '#111', out * 0.7);
        // Levá ruka + Štít vpředu vlevo
        ctx.save();
        ctx.translate(R * 0.55, -R * 0.55);
        ctx.rotate(-0.35);
        roundRect(ctx, -R * 0.18, -R * 0.55, R * 0.36, R * 1.1, R * 0.12, color, '#111', out);
        roundRect(ctx, -R * 0.08, -R * 0.35, R * 0.16, R * 0.7, R * 0.05, '#cbd5e1', null, 0);
        ctx.restore();
      } 
      else if (kit === 'archer') {
        // Ruce
        drawSphere(ctx, R * 0.65, -R * 0.3, R * 0.24, skin, '#111', out * 0.8);
        drawSphere(ctx, R * 0.25, R * 0.35, R * 0.24, skin, '#111', out * 0.8);
        // Tětiva
        ctx.beginPath();
        ctx.moveTo(R * 0.65, -R * 0.85);
        ctx.lineTo(R * 0.2, 0);
        ctx.lineTo(R * 0.65, R * 0.85);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Lučiště
        ctx.beginPath();
        ctx.arc(R * 0.45, 0, R * 0.88, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = R * 0.22;
        ctx.stroke();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = out * 0.6;
        ctx.stroke();
        // Šíp
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(R * 0.2, -R * 0.05, R * 1.25, R * 0.1);
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(R * 1.55, 0);
        ctx.lineTo(R * 1.3, -R * 0.16);
        ctx.lineTo(R * 1.3, R * 0.16);
        ctx.fill();
      } 
      else if (kit === 'mage') {
        drawSphere(ctx, R * 0.45, -R * 0.65, R * 0.24, skin, '#111', out * 0.8);
        drawSphere(ctx, R * 0.55, R * 0.6, R * 0.24, skin, '#111', out * 0.8);
        // Magická hůl
        ctx.save();
        ctx.translate(R * 0.55, R * 0.6);
        roundRect(ctx, -R * 0.7, -R * 0.1, R * 1.85, R * 0.2, R * 0.08, '#78350f', '#111', out * 0.8);
        // Zářící krystal na špičce
        drawSphere(ctx, R * 1.2, 0, R * 0.34, '#38bdf8', '#111', out * 0.8);
        drawSphere(ctx, R * 1.2, 0, R * 0.18, '#e0f2fe', null, 0, false);
        ctx.restore();
      } 
      else if (kit === 'militant') {
        // Útočná puška
        roundRect(ctx, R * 0.1, -R * 0.12, R * 1.45, R * 0.28, R * 0.06, '#27272a', '#111', out * 0.8);
        // Hlaveň a tlumič/úsťová brzda
        ctx.fillStyle = '#52525b';
        ctx.fillRect(R * 1.35, -R * 0.06, R * 0.3, R * 0.16);
        // Ruce držící zbraň
        drawSphere(ctx, R * 0.85, -R * 0.15, R * 0.23, skin, '#111', out * 0.8);
        drawSphere(ctx, R * 0.35, R * 0.28, R * 0.23, skin, '#111', out * 0.8);
      } 
      else if (kit === 'tank') {
        drawSphere(ctx, R * 0.45, -R * 0.68, R * 0.28, '#94a3b8', '#111', out * 0.8);
        drawSphere(ctx, R * 0.55, R * 0.65, R * 0.28, '#94a3b8', '#111', out * 0.8);
        // Obří válečné kladivo
        roundRect(ctx, R * 0.1, R * 0.55, R * 1.1, R * 0.2, 2, '#78350f', '#111', out * 0.8);
        roundRect(ctx, R * 0.95, R * 0.15, R * 0.52, R * 1.0, R * 0.1, '#475569', '#111', out);
      } 
      else if (kit === 'rogue') {
        // Dvě dýky mířící šikmo dopředu
        for (let s of [-1, 1]) {
          drawSphere(ctx, R * 0.5, s * R * 0.65, R * 0.22, skin, '#111', out * 0.8);
          ctx.beginPath();
          ctx.moveTo(R * 0.6, s * R * 0.55);
          ctx.lineTo(R * 1.35, s * R * 0.35);
          ctx.lineTo(R * 0.6, s * R * 0.78);
          ctx.closePath();
          ctx.fillStyle = '#cbd5e1';
          ctx.fill();
          ctx.lineWidth = out * 0.7;
          ctx.strokeStyle = '#111';
          ctx.stroke();
        }
      } 
      else if (kit === 'engineer') {
        drawSphere(ctx, R * 0.4, -R * 0.68, R * 0.24, '#f59e0b', '#111', out * 0.8); // Rukavice
        drawSphere(ctx, R * 0.55, R * 0.62, R * 0.24, '#f59e0b', '#111', out * 0.8);
        // Velký francouzský klíč
        roundRect(ctx, R * 0.2, R * 0.52, R * 1.05, R * 0.22, 2, '#94a3b8', '#111', out * 0.8);
        ctx.beginPath();
        ctx.arc(R * 1.25, R * 0.63, R * 0.32, 0.5, Math.PI * 2 - 0.5);
        ctx.lineTo(R * 1.15, R * 0.63);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.stroke();
      } 
      else if (kit === 'priest') {
        // Levá ruka se svatou knihou
        roundRect(ctx, R * 0.35, -R * 0.85, R * 0.45, R * 0.55, 3, '#b91c1c', '#111', out * 0.8);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(R * 0.52, -R * 0.75, R * 0.1, R * 0.35);
        // Pravá ruka s palcátem
        drawSphere(ctx, R * 0.5, R * 0.65, R * 0.24, skin, '#111', out * 0.8);
        roundRect(ctx, R * 0.2, R * 0.56, R * 0.95, R * 0.18, 2, '#ca8a04', '#111', out * 0.8);
        drawSphere(ctx, R * 1.2, R * 0.65, R * 0.34, '#facc15', '#111', out * 0.9);
      }

      // 4. Hlava a pokrývka hlavy
      drawSphere(ctx, 0, 0, R * 0.62, skin, '#111', out);

      if (kit === 'warrior') {
        // Rytířská přilba s chocholem
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.64, Math.PI * 0.35, Math.PI * 1.65);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, -R * 0.55, -R * 0.16, R * 0.85, R * 0.32, R * 0.15, color, '#111', out * 0.7);
      } else if (kit === 'archer') {
        // Myslivecká kapuce / čapka s pírkem
        ctx.beginPath();
        ctx.arc(-R * 0.08, 0, R * 0.64, Math.PI * 0.3, Math.PI * 1.7);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      } else if (kit === 'mage') {
        // Špičatý čarodějnický klobouk (pohled shora = široká krempa + špička dozadu)
        drawSphere(ctx, -R * 0.05, 0, R * 0.78, color, '#111', out);
        ctx.beginPath();
        ctx.moveTo(R * 0.25, -R * 0.35);
        ctx.lineTo(-R * 0.85, 0);
        ctx.lineTo(R * 0.25, R * 0.35);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      } else if (kit === 'militant') {
        // Vojenská helma a taktické brýle
        drawSphere(ctx, -R * 0.06, 0, R * 0.65, '#3f6212', '#111', out);
        roundRect(ctx, R * 0.32, -R * 0.42, R * 0.25, R * 0.84, 3, '#0ea5e9', '#111', out * 0.7);
      } else if (kit === 'tank') {
        // Těžká uzavřená helma s průzorem
        drawSphere(ctx, 0, 0, R * 0.66, '#475569', '#111', out);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(R * 0.42, -R * 0.32, R * 0.16, R * 0.64);
      } else if (kit === 'rogue') {
        // Tmavá kápě a maska přes obličej
        drawSphere(ctx, -R * 0.08, 0, R * 0.65, '#1f2937', '#111', out);
        ctx.fillStyle = color;
        ctx.fillRect(R * 0.15, -R * 0.45, R * 0.2, R * 0.9);
      } else if (kit === 'engineer') {
        // Žlutá pracovní přilba + ochranné brýle
        drawSphere(ctx, 0, 0, R * 0.65, '#facc15', '#111', out);
        roundRect(ctx, R * 0.42, -R * 0.3, R * 0.22, R * 0.6, 2, '#f59e0b', '#111', out * 0.6);
      } else if (kit === 'priest') {
        // Svatozář / čelenka
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Oči (pokud nemá brýle nebo uzavřenou helmu)
      if (kit !== 'militant' && kit !== 'tank') {
        ctx.fillStyle = '#111827';
        ctx.fillRect(R * 0.42, -R * 0.26, R * 0.15, R * 0.15);
        ctx.fillRect(R * 0.42, R * 0.11, R * 0.15, R * 0.15);
      }
    });
  }

  ZS.player = function (ctx, kit, x, y, r, angle, ts, color, isLocal) {
    const R = Math.max(10, Math.round(r || 16));
    const col = color || '#ef4444';
    const sprite = BakePlayer(kit || 'warrior', R, col);

    ctx.save();
    ctx.translate(x, y);

    // Indikátor lokálního hráče (jemný kroužek pod nohama)
    if (isLocal) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.88;
    }

    // Stín
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(2, 4, R * 0.95, R * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jemné dýchání / pohupování při pohybu
    const breath = Math.sin(ts * 0.008 + x * 0.1) * 0.04;
    ctx.rotate(angle);
    ctx.scale(1 + breath, 1 - breath);

    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  };

  // --- 3. PODLAHA MAPY (ZS.floor) ---

  function getFloorPattern(ctx, mapId) {
    const key = `floor_${mapId}`;
    if (patterns.has(key)) return patterns.get(key);

    const tile = getCached(key, 64, 64, (tctx) => {
      const rand = mulberry32(1000 + mapId * 777);

      if (mapId === 0) {
        // 0 = Průmysl (tmavý beton, spáry, olejové skvrny, mřížka)
        tctx.fillStyle = '#1e2229';
        tctx.fillRect(0, 0, 64, 64);

        // Jemný šum betonu
        for (let i = 0; i < 60; i++) {
          tctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
          tctx.fillRect(rand() * 64, rand() * 64, 2, 2);
        }

        // Spáry betonových panelů
        tctx.strokeStyle = '#14171c';
        tctx.lineWidth = 1.5;
        tctx.strokeRect(0.5, 0.5, 63, 63);

        // Olejová skvrna
        tctx.fillStyle = 'rgba(10, 12, 16, 0.45)';
        tctx.beginPath();
        tctx.ellipse(22, 42, 10, 7, 0.4, 0, Math.PI * 2);
        tctx.fill();

        // Kanálová mřížka v rohu dlaždice
        tctx.fillStyle = '#121418';
        tctx.fillRect(44, 10, 14, 14);
        tctx.strokeStyle = '#2d333f';
        tctx.lineWidth = 1;
        tctx.strokeRect(44, 10, 14, 14);
        for (let y = 13; y < 24; y += 3) {
          tctx.beginPath();
          tctx.moveTo(45, y);
          tctx.lineTo(57, y);
          tctx.stroke();
        }

        // Prasklina
        tctx.strokeStyle = '#12151a';
        tctx.beginPath();
        tctx.moveTo(8, 12);
        tctx.lineTo(18, 20);
        tctx.lineTo(15, 28);
        tctx.stroke();
      } 
      else if (mapId === 1) {
        // 1 = Předměstí (tmavá tráva, hlína, kamínky)
        tctx.fillStyle = '#1b2e1e';
        tctx.fillRect(0, 0, 64, 64);

        // Variace trávy a hlíny
        tctx.fillStyle = '#223824';
        tctx.beginPath();
        tctx.arc(18, 20, 16, 0, Math.PI * 2);
        tctx.arc(48, 46, 18, 0, Math.PI * 2);
        tctx.fill();

        tctx.fillStyle = '#27231e'; // Kousek vyšlapané hlíny
        tctx.beginPath();
        tctx.ellipse(45, 16, 9, 6, -0.3, 0, Math.PI * 2);
        tctx.fill();

        // Trsy trávy
        tctx.strokeStyle = '#2d4c2f';
        tctx.lineWidth = 1.5;
        for (let i = 0; i < 14; i++) {
          const gx = 4 + rand() * 56;
          const gy = 4 + rand() * 56;
          tctx.beginPath();
          tctx.moveTo(gx, gy);
          tctx.lineTo(gx - 2, gy - 4);
          tctx.moveTo(gx, gy);
          tctx.lineTo(gx + 2, gy - 5);
          tctx.stroke();
        }
      } 
      else {
        // 2 = Hřbitov (tmavá fialovo-modrá hlína, mech, kamínky)
        tctx.fillStyle = '#191724';
        tctx.fillRect(0, 0, 64, 64);

        // Fialovo-šedé fleky vlhké půdy
        tctx.fillStyle = '#211f30';
        tctx.beginPath();
        tctx.arc(32, 32, 22, 0, Math.PI * 2);
        tctx.fill();

        // Mech
        tctx.fillStyle = 'rgba(45, 90, 60, 0.35)';
        tctx.beginPath();
        tctx.arc(14, 48, 10, 0, Math.PI * 2);
        tctx.arc(50, 14, 8, 0, Math.PI * 2);
        tctx.fill();

        // Kamínky
        for (let i = 0; i < 12; i++) {
          tctx.fillStyle = rand() > 0.5 ? '#2e2b3f' : '#12101b';
          tctx.beginPath();
          tctx.arc(rand() * 60 + 2, rand() * 60 + 2, 1.5 + rand() * 2, 0, Math.PI * 2);
          tctx.fill();
        }
      }
    });

    const pat = ctx.createPattern(tile, 'repeat');
    patterns.set(key, pat);
    return pat;
  }

  ZS.floor = function (ctx, mapId, x, y, w, h) {
    ctx.save();
    const pat = getFloorPattern(ctx, mapId || 0);
    ctx.fillStyle = pat;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };

  // --- 4. PEVNÉ PŘEKÁŽKY MAPY (ZS.mapWall) ---

  ZS.mapWall = function (ctx, mapId, x, y, w, h) {
    const W = Math.max(16, Math.round(w));
    const H = Math.max(16, Math.round(h));
    const seed = coordSeed(x, y, mapId);
    const variant = seed % 4;
    const key = `mw_${mapId}_${W}_${H}_${variant}`;

    const sprite = getCached(key, W + 12, H + 12, (bctx) => {
      const rand = mulberry32(seed);
      const out = 2.5;

      // Vnější stín budovy/zdi (vpravo dole)
      bctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      bctx.beginPath();
      bctx.roundRect(6, 6, W, H, 4);
      bctx.fill();

      if (mapId === 0) {
        // PRŮMYSL: Kontejnery (pokud jsou úzké) nebo tovární haly s ventilací
        const isContainer = (W > H * 1.6 && H <= 80) || (H > W * 1.6 && W <= 80);
        if (isContainer) {
          const cols = ['#991b1b', '#1e40af', '#b45309', '#374151'];
          const cCol = cols[variant % cols.length];
          roundRect(bctx, 0, 0, W, H, 3, cCol, '#09090b', out);
          // Vlnitý plech
          bctx.fillStyle = 'rgba(0,0,0,0.22)';
          if (W >= H) {
            for (let ix = 6; ix < W - 4; ix += 8) bctx.fillRect(ix, 3, 4, H - 6);
          } else {
            for (let iy = 6; iy < H - 4; iy += 8) bctx.fillRect(3, iy, W - 6, 4);
          }
        } else {
          // Betonová/cihlová budova se střechou
          roundRect(bctx, 0, 0, W, H, 4, '#334155', '#09090b', out);
          // Vnitřní snížená střecha
          const pad = Math.min(10, Math.min(W, H) * 0.18);
          roundRect(bctx, pad, pad, W - pad * 2, H - pad * 2, 2, '#1e293b', '#0f172a', 1.5);
          // Střešní ventilátory / světlíky
          if (W >= 60 && H >= 60) {
            drawSphere(bctx, W * 0.35, H * 0.35, 10, '#475569', '#0f172a', 1.5);
            bctx.strokeStyle = '#1e293b';
            bctx.beginPath();
            bctx.moveTo(W * 0.35 - 8, H * 0.35);
            bctx.lineTo(W * 0.35 + 8, H * 0.35);
            bctx.moveTo(W * 0.35, H * 0.35 - 8);
            bctx.lineTo(W * 0.35, H * 0.35 + 8);
            bctx.stroke();

            roundRect(bctx, W * 0.55, H * 0.55, W * 0.25, H * 0.22, 2, '#0ea5e9', '#0f172a', 1.5);
          }
        }
      } 
      else if (mapId === 1) {
        // PŘEDMĚSTÍ: Dřevěné plůtky (malé rozměry) nebo domky se sedlovou střechou
        if (Math.min(W, H) <= 28) {
          // Dřevěný plot / živý plot
          roundRect(bctx, 0, 0, W, H, 3, '#78350f', '#111', out);
          bctx.fillStyle = '#92400e';
          const step = 12;
          if (W >= H) {
            for (let ix = 4; ix < W - 4; ix += step) bctx.fillRect(ix, 2, 4, H - 4);
          } else {
            for (let iy = 4; iy < H - 4; iy += step) bctx.fillRect(2, iy, W - 4, 4);
          }
        } else {
          // Rodinný domek se šikmou taškovou střechou
          const roofCols = ['#7f1d1d', '#7c2d12', '#334155', '#14532d'];
          const baseCol = roofCols[variant % roofCols.length];
          roundRect(bctx, 0, 0, W, H, 4, baseCol, '#09090b', out);

          // Světlo na levé/horní straně střechy, stín na pravé/dolní
          bctx.fillStyle = 'rgba(255,255,255,0.08)';
          if (W >= H) {
            bctx.fillRect(2, 2, W - 4, H / 2 - 2);
            bctx.beginPath();
            bctx.moveTo(0, H / 2);
            bctx.lineTo(W, H / 2);
          } else {
            bctx.fillRect(2, 2, W / 2 - 2, H - 4);
            bctx.beginPath();
            bctx.moveTo(W / 2, 0);
            bctx.lineTo(W / 2, H);
          }
          bctx.strokeStyle = '#09090b';
          bctx.lineWidth = 2;
          bctx.stroke();

          // Komín
          if (W >= 48 && H >= 48) {
            roundRect(bctx, W * 0.65, H * 0.22, 14, 14, 2, '#451a03', '#000', 1.5);
            bctx.fillStyle = '#000';
            bctx.fillRect(W * 0.65 + 4, H * 0.22 + 4, 6, 6);
          }
        }
      } 
      else {
        // HŘBITOV: Kamenné zídky, náhrobky a hrobky
        roundRect(bctx, 0, 0, W, H, 4, '#3f3f46', '#09090b', out);
        // Kamenné kvádry a mech
        const pad = Math.min(8, Math.min(W, H) * 0.2);
        roundRect(bctx, pad, pad, W - pad * 2, H - pad * 2, 2, '#27272a', '#18181b', 1.5);

        // Mech v rozích
        bctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
        bctx.beginPath();
        bctx.arc(pad + 4, pad + 4, Math.min(14, W * 0.25), 0, Math.PI * 2);
        bctx.fill();

        // Kříž na hrobce nebo náhrobku
        if (W >= 32 && H >= 32) {
          bctx.fillStyle = '#52525b';
          const cx = W / 2;
          const cy = H / 2;
          const s = Math.min(W, H) * 0.28;
          bctx.fillRect(cx - s * 0.2, cy - s * 0.8, s * 0.4, s * 1.6);
          bctx.fillRect(cx - s * 0.6, cy - s * 0.35, s * 1.2, s * 0.4);
        }
      }

      // Horní levý odlesk pro 3D hloubku
      bctx.strokeStyle = 'rgba(255,255,255,0.15)';
      bctx.lineWidth = 2;
      bctx.beginPath();
      bctx.moveTo(2, H - 2);
      bctx.lineTo(2, 2);
      bctx.lineTo(W - 2, 2);
      bctx.stroke();
    });

    ctx.save();
    ctx.drawImage(sprite, x, y);
    ctx.restore();
  };

  // --- 5. STAVBY HRÁČŮ (ZS.structure) ---

  function drawDamageOverlay(ctx, x, y, w, h, hpPct, seed) {
    if (hpPct >= 0.98) return;
    const rand = mulberry32(seed);
    const dmg = 1 - Math.max(0, hpPct);
    const cracks = Math.ceil(dmg * 6);

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#09090b';
    ctx.fillStyle = '#09090b';
    ctx.lineWidth = 1.8;

    for (let i = 0; i < cracks; i++) {
      const cx = w * (0.15 + rand() * 0.7);
      const cy = h * (0.15 + rand() * 0.7);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (rand() - 0.5) * 18, cy + (rand() - 0.5) * 14);
      ctx.lineTo(cx + (rand() - 0.5) * 26, cy + (rand() - 0.5) * 20);
      ctx.stroke();

      if (hpPct < 0.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5 + dmg * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  ZS.structure = function (ctx, type, x, y, w, h, hpPct, ts, angle) {
    const W = Math.round(w);
    const H = Math.round(h);
    const hp = hpPct === undefined ? 1 : hpPct;
    const key = `str_${type}_${W}_${H}`;

    const baseSprite = getCached(key, W + 6, H + 6, (bctx) => {
      const out = 2;
      // Stín
      bctx.fillStyle = 'rgba(0,0,0,0.35)';
      bctx.fillRect(3, 3, W, H);

      if (type === 'wall') {
        // Cihlová / betonová zeď (64x20)
        roundRect(bctx, 0, 0, W, H, 3, '#64748b', '#09090b', out);
        bctx.fillStyle = '#475569';
        for (let ix = 4; ix < W - 8; ix += 14) {
          bctx.fillRect(ix, 3, 10, H / 2 - 4);
          bctx.fillRect(ix + 6, H / 2 + 1, 10, H / 2 - 4);
        }
      } 
      else if (type === 'barricade') {
        // Dřevěná prkna s hřebíky (64x18)
        roundRect(bctx, 2, 2, W - 4, H - 4, 2, '#78350f', '#09090b', out);
        // Překřížená prkna
        bctx.save();
        bctx.translate(W / 2, H / 2);
        bctx.rotate(0.06);
        roundRect(bctx, -W * 0.48, -H * 0.35, W * 0.96, H * 0.35, 2, '#92400e', '#111', 1.5);
        bctx.rotate(-0.12);
        roundRect(bctx, -W * 0.48, 0, W * 0.96, H * 0.35, 2, '#b45309', '#111', 1.5);
        bctx.restore();
        // Stříbrné hřebíky
        bctx.fillStyle = '#cbd5e1';
        for (let ix = 8; ix < W - 6; ix += 14) {
          bctx.fillRect(ix, 5, 2.5, 2.5);
          bctx.fillRect(ix + 4, H - 8, 2.5, 2.5);
        }
      } 
      else if (type === 'spikes') {
        // Kovová mříž v zemi s ostrými hroty (48x48)
        roundRect(bctx, 2, 2, W - 4, H - 4, 4, '#27272a', '#09090b', out);
        const cols = 3;
        const rows = 3;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const sx = (W / (cols + 1)) * (c + 1);
            const sy = (H / (rows + 1)) * (r + 1);
            drawSphere(bctx, sx, sy, 5.5, '#52525b', '#111', 1.5, false);
            drawSphere(bctx, sx - 1, sy - 1, 2.5, '#e2e8f0', null, 0, false);
            // Krev na některých hrotech
            if ((r + c) % 2 === 0) {
              bctx.fillStyle = 'rgba(185, 28, 28, 0.7)';
              bctx.beginPath();
              bctx.arc(sx + 1, sy + 1, 2.5, 0, Math.PI * 2);
              bctx.fill();
            }
          }
        }
      } 
      else if (type === 'turret') {
        // Jen podstavec věže (hlaveň se točí zvlášť)
        roundRect(bctx, 2, 2, W - 4, H - 4, 6, '#334155', '#09090b', out);
        // Výstražné pruhy v rozích
        bctx.fillStyle = '#facc15';
        bctx.fillRect(5, 5, 6, 6);
        bctx.fillRect(W - 11, 5, 6, 6);
        bctx.fillRect(5, H - 11, 6, 6);
        bctx.fillRect(W - 11, H - 11, 6, 6);
        drawSphere(bctx, W / 2, H / 2, W * 0.34, '#1e293b', '#09090b', 1.5);
      } 
      else if (type === 'platform') {
        // Dřevěná plošina (72x72)
        roundRect(bctx, 0, 0, W, H, 4, '#78350f', '#09090b', out);
        const plankH = H / 5;
        for (let i = 0; i < 5; i++) {
          roundRect(bctx, 3, i * plankH + 2, W - 6, plankH - 3, 1, i % 2 ? '#92400e' : '#854d0e', '#1c1917', 1);
        }
        // Rohové kování
        bctx.fillStyle = '#52525b';
        bctx.fillRect(2, 2, 8, 8);
        bctx.fillRect(W - 10, 2, 8, 8);
        bctx.fillRect(2, H - 10, 8, 8);
        bctx.fillRect(W - 10, H - 10, 8, 8);
      }
    });

    ctx.save();
    ctx.drawImage(baseSprite, x, y);

    // Vykreslení prasklin podle HP
    drawDamageOverlay(ctx, x, y, W, H, hp, coordSeed(x, y, 99));

    // Otočná hlava turretu
    if (type === 'turret') {
      const headSprite = getCached(`turret_head_${W}`, W * 1.6, W * 1.6, (tctx, tw, th) => {
        tctx.translate(tw / 2, th / 2);
        // Dvojitá hlaveň
        roundRect(tctx, 0, -6, W * 0.58, 5, 1.5, '#475569', '#09090b', 1.8);
        roundRect(tctx, 0, 1, W * 0.58, 5, 1.5, '#475569', '#09090b', 1.8);
        // Otočná věžička + zásobník
        roundRect(tctx, -W * 0.28, -W * 0.25, W * 0.52, W * 0.5, 5, '#64748b', '#09090b', 2);
        // Senzor (oko)
        drawSphere(tctx, W * 0.08, 0, 4, '#ef4444', '#000', 1, false);
      });

      ctx.translate(x + W / 2, y + H / 2);
      ctx.rotate(angle || 0);
      ctx.drawImage(headSprite, -headSprite.width / 2, -headSprite.height / 2);
    }

    ctx.restore();
  };

  // --- 6. ZÁKLADNA (ZS.base) ---

  ZS.base = function (ctx, x, y, r, hpPct, ts) {
    const R = Math.round(r || 52);
    const hp = hpPct === undefined ? 1 : hpPct;

    const baseImg = getCached(`base_${R}`, R * 2.4, R * 2.4, (bctx, w, h) => {
      bctx.translate(w / 2, h / 2);
      const out = 2.5;

      // Stín
      bctx.fillStyle = 'rgba(0,0,0,0.45)';
      bctx.beginPath();
      bctx.arc(4, 6, R * 1.02, 0, Math.PI * 2);
      bctx.fill();

      // Pytle s pískem po obvodu (12 kusů)
      for (let i = 0; i < 12; i++) {
        bctx.save();
        bctx.rotate((i * Math.PI * 2) / 12);
        roundRect(bctx, R * 0.78, -R * 0.22, R * 0.26, R * 0.44, 6, '#a16207', '#111', 1.8);
        bctx.restore();
      }

      // Osmiúhelníkový betonový bunkr
      bctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
        const px = Math.cos(a) * R * 0.85;
        const py = Math.sin(a) * R * 0.85;
        if (i === 0) bctx.moveTo(px, py);
        else bctx.lineTo(px, py);
      }
      bctx.closePath();
      bctx.fillStyle = '#334155';
      bctx.fill();
      bctx.lineWidth = out;
      bctx.strokeStyle = '#09090b';
      bctx.stroke();

      // Vnitřní kovový prstenec
      drawSphere(bctx, 0, 0, R * 0.58, '#1e293b', '#09090b', out);

      // Modré energetické jádro / maják uprostřed
      drawSphere(bctx, 0, 0, R * 0.32, '#0284c7', '#09090b', 2);
      drawSphere(bctx, 0, 0, R * 0.18, '#38bdf8', null, 0, false);
    });

    ctx.save();
    ctx.translate(x, y);
    ctx.drawImage(baseImg, -baseImg.width / 2, -baseImg.height / 2);

    // Pulzující modré světlo jádra
    const pulse = 0.7 + 0.3 * Math.sin(ts * 0.006);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.25 * pulse * Math.max(0.2, hp)})`;
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.55 + 0.15 * pulse), 0, Math.PI * 2);
    ctx.fill();

    // Poškození základny (praskliny a kouřové skvrny)
    if (hp < 0.95) {
      drawDamageOverlay(ctx, -R * 0.6, -R * 0.6, R * 1.2, R * 1.2, hp, 12345);
    }

    // Vlajka vlající ve větru
    const wave1 = Math.sin(ts * 0.008) * 5;
    const wave2 = Math.cos(ts * 0.008) * 4;
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.15);
    ctx.quadraticCurveTo(R * 0.35, -R * 0.25 + wave1, R * 0.68, -R * 0.1 + wave2);
    ctx.lineTo(0, R * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tyč vlajky
    drawSphere(ctx, 0, -R * 0.12, 4, '#e2e8f0', '#000', 1.5);

    ctx.restore();
  };

  // --- 7. ŘEKA (ZS.river) ---

  function getRiverPattern(ctx) {
    const key = 'river_tile';
    if (patterns.has(key)) return patterns.get(key);

    const tile = getCached(key, 64, 128, (rctx) => {
      rctx.fillStyle = '#0c4a6e';
      rctx.fillRect(0, 0, 64, 128);

      // Tmavší hloubka uprostřed
      rctx.fillStyle = '#082f49';
      rctx.fillRect(14, 0, 36, 128);

      // Světlejší vlnky a proudy
      rctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      rctx.lineWidth = 2.5;
      rctx.lineCap = 'round';
      const waves = [
        [12, 10, 28],
        [34, 45, 34],
        [20, 85, 24],
        [48, 15, 22],
        [44, 95, 26],
      ];
      for (const [wx, wy, wl] of waves) {
        rctx.beginPath();
        rctx.moveTo(wx, wy);
        rctx.quadraticCurveTo(wx + 4, wy + wl / 2, wx, wy + wl);
        rctx.stroke();
      }
    });

    const pat = ctx.createPattern(tile, 'repeat');
    patterns.set(key, pat);
    return pat;
  }

  ZS.river = function (ctx, x, y, w, h, ts) {
    ctx.save();

    // Břehy (bahno a písek na okrajích)
    ctx.fillStyle = '#27231c';
    ctx.fillRect(x - 8, y, w + 16, h);
    ctx.fillStyle = '#44403c';
    ctx.fillRect(x - 3, y, w + 6, h);

    // Tekoucí voda (posun patternu v čase)
    const pat = getRiverPattern(ctx);
    const flowY = (ts * 0.045) % 128;

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.translate(x, y + flowY);
    ctx.fillStyle = pat;
    ctx.fillRect(0, -flowY - 128, w, h + 256);

    // Pěna u břehů
    ctx.fillStyle = 'rgba(186, 230, 253, 0.28)';
    ctx.fillRect(0, -flowY - 128, 5, h + 256);
    ctx.fillRect(w - 5, -flowY - 128, 5, h + 256);

    ctx.restore();
  };

  // --- 8. PROJEKTILY (ZS.bullet) ---

  function BakeBullet(kind, color) {
    const col = color || '#facc15';
    const key = `bul_${kind}_${col}`;

    return getCached(key, 36, 20, (bctx, w, h) => {
      bctx.translate(w / 2, h / 2);

      if (kind === 'bullet') {
        // Světelná stopa (tracer)
        bctx.fillStyle = col;
        bctx.globalAlpha = 0.35;
        bctx.beginPath();
        bctx.moveTo(-16, 0);
        bctx.lineTo(4, -3.5);
        bctx.lineTo(4, 3.5);
        bctx.closePath();
        bctx.fill();
        bctx.globalAlpha = 1;
        // Projektil
        roundRect(bctx, 0, -2.5, 9, 5, 2, '#fef08a', '#111', 1.2);
      } 
      else if (kind === 'arrow') {
        // Dřík šípu
        bctx.fillStyle = '#92400e';
        bctx.fillRect(-12, -1.2, 22, 2.4);
        // Letky
        bctx.fillStyle = col;
        bctx.beginPath();
        bctx.moveTo(-8, 0);
        bctx.lineTo(-14, -4.5);
        bctx.lineTo(-11, 0);
        bctx.lineTo(-14, 4.5);
        bctx.closePath();
        bctx.fill();
        // Ocelový hrot
        bctx.fillStyle = '#e2e8f0';
        bctx.strokeStyle = '#111';
        bctx.lineWidth = 1;
        bctx.beginPath();
        bctx.moveTo(14, 0);
        bctx.lineTo(7, -4);
        bctx.lineTo(7, 4);
        bctx.closePath();
        bctx.fill();
        bctx.stroke();
      } 
      else if (kind === 'magic') {
        // Zářivá magická koule s ocasem
        bctx.fillStyle = col;
        bctx.globalAlpha = 0.35;
        bctx.beginPath();
        bctx.arc(-2, 0, 8.5, 0, Math.PI * 2);
        bctx.fill();
        bctx.globalAlpha = 1;
        drawSphere(bctx, 2, 0, 5.5, col, '#111', 1.2, false);
        drawSphere(bctx, 2, 0, 2.8, '#ffffff', null, 0, false);
      } 
      else if (kind === 'pellet') {
        // Brok s krátkou stopou
        bctx.fillStyle = 'rgba(255,255,255,0.3)';
        bctx.fillRect(-7, -1.5, 8, 3);
        drawSphere(bctx, 2, 0, 3, col || '#fcd34d', '#111', 1.2, false);
      }
    });
  }

  ZS.bullet = function (ctx, kind, x, y, angle, color) {
    const sprite = BakeBullet(kind || 'bullet', color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  };

  // --- 9. VOLITELNÉ SKVRNY NA ZEMI (ZS.decal) ---

  ZS.decal = function (ctx, type, x, y, size, seed) {
    const S = Math.max(12, Math.round(size || 28));
    const variant = Math.abs(Math.round(seed || 0)) % 8;
    const key = `dec_${type}_${S}_${variant}`;

    const sprite = getCached(key, S * 2.2, S * 2.2, (dctx, w, h) => {
      dctx.translate(w / 2, h / 2);
      const rand = mulberry32(variant * 9999 + 42);

      if (type === 'blood') {
        dctx.fillStyle = 'rgba(127, 29, 29, 0.78)';
        for (let i = 0; i < 7; i++) {
          const a = rand() * Math.PI * 2;
          const dist = rand() * S * 0.45;
          const rad = S * (0.15 + rand() * 0.32);
          dctx.beginPath();
          dctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, rad, 0, Math.PI * 2);
          dctx.fill();
        }
        // Tmavší střed
        dctx.fillStyle = 'rgba(69, 10, 10, 0.65)';
        dctx.beginPath();
        dctx.arc(0, 0, S * 0.32, 0, Math.PI * 2);
        dctx.fill();
      } 
      else if (type === 'scorch') {
        // Kráter po výbuchu
        dctx.fillStyle = 'rgba(9, 9, 11, 0.72)';
        dctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const rad = S * (0.55 + rand() * 0.38);
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) dctx.moveTo(px, py);
          else dctx.lineTo(px, py);
        }
        dctx.closePath();
        dctx.fill();

        dctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
        dctx.beginPath();
        dctx.arc(0, 0, S * 0.38, 0, Math.PI * 2);
        dctx.fill();
      }
    });

    ctx.save();
    ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
    ctx.restore();
  };

  // Diagnostika cache pro ladění výkonu
  ZS.getCacheStats = function () {
    let totalPixels = 0;
    cache.forEach((c) => {
      totalPixels += c.width * c.height;
    });
    return {
      entries: cache.size,
      patterns: patterns.size,
      memoryKB: Math.round((totalPixels * 4) / 1024),
    };
  };

  global.ZS = ZS;
})(window);

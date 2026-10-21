/**
 * ZOMBIE SURVIVAL - Procedurální 2D Sprite & VFX Engine (Část 3: Těla, Zbraně, Švihy, Projektily, Schopnosti)
 * Nezávislé rozšíření window.ZS. Optimalizováno pro mobilní 60 FPS (< 0.05 ms na volání).
 * Žádné shadowBlur, žádné ctx.roundRect, žádné gradienty v herní smyčce, deterministický PRNG.
 */
(function (global) {
  'use strict';

  const ZS = global.ZS || (global.ZS = {});
  const cache3 = new Map();

  // ============================================================================
  // POMOCNÉ FUNKCE, MATEMATIKA & CACHE
  // ============================================================================

  const TAU = Math.PI * 2;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    const u = 1 - clamp(t, 0, 1);
    return 1 - u * u * u;
  }

  function easeInOutQuad(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Deterministický PRNG (Mulberry32)
  function mulberry32(seed) {
    let a = (seed >>> 0) + 0x6d2b79f5;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function getCached(key, w, h, drawFn) {
    let item = cache3.get(key);
    if (!item) {
      const c = createCanvas(w, h);
      const ctx = c.getContext('2d');
      drawFn(ctx, c.width, c.height);
      item = c;
      cache3.set(key, item);
    }
    return item;
  }

  // Vlastní zaoblený obdélník (kompatibilní se všemi mobilními WebView)
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
    if (stroke && lineWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Koule s obrysem a horním levým odleskem
  function drawSphere(ctx, x, y, r, fill, stroke = '#111115', lineWidth = 2, highlight = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (highlight && r > 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(x - r * 0.26, y - r * 0.26, r * 0.48, 0, TAU);
      ctx.fill();
    }
    if (stroke && lineWidth > 0) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Předpečená měkká kruhová záře (náhrada za drahé radiální gradienty v loopu)
  function getGlowSprite(color) {
    const col = color || '#ffffff';
    return getCached(`glow_${col}`, 64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // Předpečená 4-cípá jiskra / hvězdička
  function getSparkSprite(color) {
    const col = color || '#fef08a';
    return getCached(`spark_${col}`, 28, 28, (ctx) => {
      ctx.translate(14, 14);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.quadraticCurveTo(2.5, -2.5, 13, 0);
      ctx.quadraticCurveTo(2.5, 2.5, 0, 13);
      ctx.quadraticCurveTo(-2.5, 2.5, -13, 0);
      ctx.quadraticCurveTo(-2.5, -2.5, 0, -13);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, TAU);
      ctx.fill();
    });
  }

  // Předpečený obláček kouře
  function getSmokeSprite(color) {
    const col = color || '#52525b';
    return getCached(`smoke_${col}`, 48, 48, (ctx) => {
      const g = ctx.createRadialGradient(24, 24, 4, 24, 24, 22);
      g.addColorStop(0, col);
      g.addColorStop(0.6, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(24, 24, 22, 0, TAU);
      ctx.fill();
    });
  }

  // ============================================================================
  // 1) TĚLO HRÁČE BEZ ZBRANĚ – ZS.playerBody(ctx, kit, x, y, r, angle, ts, color, isLocal)
  // ============================================================================

  function bakePlayerBody(kit, R, color) {
    const size = Math.ceil(R * 2.8);
    const key = `pbody_${kit}_${R}_${color}`;

    return getCached(key, size, size, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      const out = Math.max(1.8, R * 0.12);
      const skin = '#f3d2b3';

      // 1. Vrstva pod tělem (pláště, kápě, toulce)
      if (kit === 'mage' || kit === 'rogue' || kit === 'priest') {
        ctx.fillStyle = kit === 'rogue' ? '#1f2937' : kit === 'priest' ? '#f8fafc' : color;
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = out;
        ctx.beginPath();
        ctx.arc(-R * 0.15, 0, R * 0.96, Math.PI * 0.45, Math.PI * 1.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (kit === 'archer') {
        // Toulec se šípy na zádech
        drawRRect(ctx, -R * 0.86, -R * 0.55, R * 0.45, R * 0.72, R * 0.1, '#78350f', '#111115', out * 0.8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-R * 0.78, -R * 0.68, R * 0.3, R * 0.16);
      }

      // 2. Ramena / Trup
      const bodyCol = kit === 'tank' ? '#64748b' : kit === 'rogue' ? '#374151' : color;
      drawRRect(ctx, -R * 0.55, -R * 0.88, R * 1.05, R * 1.76, R * 0.45, bodyCol, '#111115', out);

      // Detaily brnění / oblečení na ramenou
      if (kit === 'tank' || kit === 'warrior') {
        drawRRect(ctx, -R * 0.45, -R * 0.96, R * 0.66, R * 0.52, R * 0.15, '#94a3b8', '#111115', out * 0.9);
        drawRRect(ctx, -R * 0.45, R * 0.44, R * 0.66, R * 0.52, R * 0.15, '#94a3b8', '#111115', out * 0.9);
        // Nýty na náramenících
        drawSphere(ctx, -R * 0.15, -R * 0.72, 1.8, '#e2e8f0', null, 0, false);
        drawSphere(ctx, -R * 0.15, R * 0.72, 1.8, '#e2e8f0', null, 0, false);
      } else if (kit === 'priest') {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-R * 0.2, -R * 0.82, R * 0.32, R * 1.64);
      } else if (kit === 'engineer') {
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-R * 0.3, -R * 0.78, R * 0.45, R * 0.26);
        ctx.fillRect(-R * 0.3, R * 0.52, R * 0.45, R * 0.26);
      } else if (kit === 'militant') {
        // Taktická vesta a sumky
        drawRRect(ctx, -R * 0.35, -R * 0.7, R * 0.7, R * 1.4, R * 0.2, '#3f6212', '#111115', out * 0.7);
      }

      // 3. Hlava a pokrývka hlavy (bez rukou a zbraní)
      drawSphere(ctx, 0, 0, R * 0.62, skin, '#111115', out);

      if (kit === 'warrior') {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.64, Math.PI * 0.35, Math.PI * 1.65);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
        drawRRect(ctx, -R * 0.58, -R * 0.16, R * 0.88, R * 0.32, R * 0.15, color, '#111115', out * 0.75);
      } else if (kit === 'archer') {
        ctx.beginPath();
        ctx.arc(-R * 0.08, 0, R * 0.64, Math.PI * 0.3, Math.PI * 1.7);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
        // Pírko za čapkou
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(-R * 0.4, -R * 0.45);
        ctx.lineTo(-R * 0.85, -R * 0.65);
        ctx.lineTo(-R * 0.2, -R * 0.3);
        ctx.closePath();
        ctx.fill();
      } else if (kit === 'mage') {
        drawSphere(ctx, -R * 0.05, 0, R * 0.78, color, '#111115', out);
        ctx.beginPath();
        ctx.moveTo(R * 0.25, -R * 0.35);
        ctx.lineTo(-R * 0.88, 0);
        ctx.lineTo(R * 0.25, R * 0.35);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
      } else if (kit === 'militant') {
        drawSphere(ctx, -R * 0.06, 0, R * 0.65, '#3f6212', '#111115', out);
        drawRRect(ctx, R * 0.32, -R * 0.42, R * 0.25, R * 0.84, 3, '#0ea5e9', '#111115', out * 0.7);
      } else if (kit === 'tank') {
        drawSphere(ctx, 0, 0, R * 0.66, '#475569', '#111115', out);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(R * 0.42, -R * 0.32, R * 0.16, R * 0.64);
      } else if (kit === 'rogue') {
        drawSphere(ctx, -R * 0.08, 0, R * 0.65, '#1f2937', '#111115', out);
        ctx.fillStyle = color;
        ctx.fillRect(R * 0.15, -R * 0.45, R * 0.2, R * 0.9);
      } else if (kit === 'engineer') {
        drawSphere(ctx, 0, 0, R * 0.65, '#facc15', '#111115', out);
        drawRRect(ctx, R * 0.42, -R * 0.3, R * 0.22, R * 0.6, 2, '#f59e0b', '#111115', out * 0.6);
      } else if (kit === 'priest') {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.74, 0, TAU);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Oči
      if (kit !== 'militant' && kit !== 'tank') {
        ctx.fillStyle = '#111827';
        ctx.fillRect(R * 0.42, -R * 0.26, R * 0.15, R * 0.15);
        ctx.fillRect(R * 0.42, R * 0.11, R * 0.15, R * 0.15);
      }
    });
  }

  ZS.playerBody = function (ctx, kit, x, y, r, angle, ts, color, isLocal) {
    const R = Math.max(10, Math.round(r || 16));
    const col = color || '#ef4444';
    const sprite = bakePlayerBody(kit || 'warrior', R, col);
    const time = ts || 0;

    ctx.save();
    ctx.translate(x, y);

    if (isLocal) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.25, 0, TAU);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.88;
    }

    // Stín pod postavou
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(2, 4, R * 0.95, R * 0.8, 0, 0, TAU);
    ctx.fill();

    // Jemné dýchání
    const breath = Math.sin(time * 0.008 + x * 0.1) * 0.038;
    ctx.rotate(angle || 0);
    ctx.scale(1 + breath, 1 - breath);

    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  };

  // ============================================================================
  // 2) ZBRAŇ V RUCE S ANIMACÍ ÚTOKU – ZS.weapon(ctx, weaponId, x, y, r, angle, ts, atk, color)
  // ============================================================================

  // Sdílená kinematika máchnutí na blízko (používá ji jak ZS.weapon, tak ZS.swingFx)
  function getMeleeSwingState(weaponId, p, arc) {
    const A = arc || 1.15;
    if (weaponId === 'dagger') {
      // Dva bleskové seky tam a zpět během jednoho p (0..1)
      if (p < 0.48) {
        const u = clamp(p / 0.42, 0, 1);
        const e = easeOutCubic(u);
        return {
          startAngle: -A * 0.55,
          curAngle: lerp(-A * 0.55, A * 0.55, e),
          slashProgress: u,
          pass: 1,
          lunge: Math.sin(u * Math.PI) * 5
        };
      } else {
        const u = clamp((p - 0.48) / 0.42, 0, 1);
        const e = easeOutCubic(u);
        return {
          startAngle: A * 0.55,
          curAngle: lerp(A * 0.55, -A * 0.55, e),
          slashProgress: u,
          pass: 2,
          lunge: Math.sin(u * Math.PI) * 5
        };
      }
    }

    // Těžké kladivo má delší nápřah a prudký dopad kolem p = 0.72
    const windupEnd = weaponId === 'hammer' ? 0.24 : 0.15;
    const strikeEnd = weaponId === 'hammer' ? 0.74 : 0.68;
    const startA = -A * 0.5 - 0.22;
    const endA = A * 0.5 + 0.15;

    if (p < windupEnd) {
      const u = p / windupEnd;
      return {
        startAngle: startA,
        curAngle: lerp(-A * 0.2, startA, easeOutCubic(u)),
        slashProgress: 0,
        pass: 0,
        lunge: -u * 3
      };
    } else if (p < strikeEnd) {
      const u = (p - windupEnd) / (strikeEnd - windupEnd);
      const e = weaponId === 'hammer' ? u * u * (3 - 2 * u) : easeOutCubic(u);
      return {
        startAngle: startA,
        curAngle: lerp(startA, endA, e),
        slashProgress: u,
        pass: 1,
        lunge: Math.sin(u * Math.PI) * (weaponId === 'hammer' ? 8 : 5)
      };
    } else {
      // Dojezd (follow-through) a návrat
      const u = (p - strikeEnd) / (1 - strikeEnd);
      return {
        startAngle: startA,
        curAngle: lerp(endA, A * 0.25, easeInOutQuad(u)),
        slashProgress: 1,
        pass: 1,
        lunge: (1 - u) * 3
      };
    }
  }

  // Předpečení samotných zbraní (bez rukou, orientace doprava +X, střed v rukojeti 0,0)
  function bakeWeaponSprite(weaponId, col) {
    const key = `weap_${weaponId}_${col}`;
    return getCached(key, 96, 64, (ctx, w, h) => {
      ctx.translate(24, h / 2);
      const out = 1.8;

      if (weaponId === 'pistol') {
        // Rukojeť a závěr pistole
        drawRRect(ctx, -3, -3.5, 19, 7, 2, '#27272a', '#111115', out);
        drawRRect(ctx, 1, -2.5, 13, 5, 1, col || '#fbbf24', '#111115', 1.2);
        // Ústí hlavně
        ctx.fillStyle = '#52525b';
        ctx.fillRect(16, -2, 4, 4);
      }
      else if (weaponId === 'shotgun') {
        // Dřevěná pažba
        drawRRect(ctx, -12, -3.5, 14, 7, 2, '#78350f', '#111115', out);
        // Tělo brokovnice
        drawRRect(ctx, 0, -4, 16, 8, 2, '#3f3f46', '#111115', out);
        // Dvojitá široká hlaveň
        drawRRect(ctx, 14, -3.5, 18, 7, 1.5, '#52525b', '#111115', out);
        // Oranžové předpažbí (pumpa)
        drawRRect(ctx, 16, -4.5, 10, 9, 2, col || '#f97316', '#111115', 1.5);
      }
      else if (weaponId === 'rifle') {
        // Taktická pažba
        drawRRect(ctx, -14, -3, 14, 6, 1.5, '#1e293b', '#111115', out);
        // Tělo pušky
        drawRRect(ctx, -2, -3.8, 22, 7.6, 2, '#334155', '#111115', out);
        // Dlouhá hlaveň s úsťovou brzdou
        drawRRect(ctx, 18, -2, 22, 4, 1, '#475569', '#111115', 1.5);
        drawRRect(ctx, 37, -3, 5, 6, 1, '#1e293b', '#111115', 1.4);
        // Optika s tyrkysovou čočkou
        drawRRect(ctx, 2, -6, 14, 4.5, 1.5, '#0f172a', '#111115', 1.4);
        ctx.fillStyle = col || '#06b6d4';
        ctx.fillRect(14, -5.2, 2.5, 3);
        ctx.fillRect(-1, -1.5, 16, 3);
      }
      else if (weaponId === 'sword') {
        // Hlavice a rukojeť
        drawSphere(ctx, -9, 0, 3.8, '#facc15', '#111115', 1.5, false);
        drawRRect(ctx, -6, -2.5, 9, 5, 1.5, col || '#ef4444', '#111115', 1.5);
        // Široká rytířská čepel s ostřím a krevní rýhou
        ctx.beginPath();
        ctx.moveTo(4, -5.5);
        ctx.lineTo(38, -3.5);
        ctx.lineTo(48, 0);
        ctx.lineTo(38, 3.5);
        ctx.lineTo(4, 5.5);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        // Světlá horní hrana čepele
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(4, -5.5);
        ctx.lineTo(38, -3.5);
        ctx.lineTo(48, 0);
        ctx.lineTo(4, 0);
        ctx.closePath();
        ctx.fill();
        // Obrys čepele
        ctx.beginPath();
        ctx.moveTo(4, -5.5);
        ctx.lineTo(38, -3.5);
        ctx.lineTo(48, 0);
        ctx.lineTo(38, 3.5);
        ctx.lineTo(4, 5.5);
        ctx.closePath();
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = out;
        ctx.stroke();
        // Středová runová drážka
        ctx.strokeStyle = col || '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(34, 0);
        ctx.stroke();
        // Zlatá záštita s drahokamem
        drawRRect(ctx, 1.5, -10, 4.5, 20, 2, '#f59e0b', '#111115', 1.6);
        drawSphere(ctx, 3.8, 0, 2.6, col || '#ef4444', '#111', 1, false);
      }
      else if (weaponId === 'dagger') {
        // Rukojeť a příčka
        drawRRect(ctx, -6, -2, 7, 4, 1.5, '#1f2937', '#111115', 1.4);
        drawRRect(ctx, 0, -6, 3.5, 12, 1.5, '#4b5563', '#111115', 1.4);
        // Krátká zahnutá čepel s fialovým jedovatým/magickým ostřím
        ctx.beginPath();
        ctx.moveTo(3, -3.8);
        ctx.quadraticCurveTo(15, -5, 25, -1);
        ctx.quadraticCurveTo(16, 4.5, 3, 3.8);
        ctx.closePath();
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // Fialový odlesk
        ctx.strokeStyle = col || '#a855f7';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(20, -0.5);
        ctx.stroke();
      }
      else if (weaponId === 'hammer') {
        // Dlouhá dřevěná násada s kováním
        drawRRect(ctx, -12, -3, 44, 6, 2, '#78350f', '#111115', out);
        ctx.fillStyle = col || '#64748b';
        ctx.fillRect(-4, -3, 6, 6);
        ctx.fillRect(10, -3, 6, 6);
        // Masivní kovová hlava kladiva
        drawRRect(ctx, 24, -15, 16, 30, 3, '#475569', '#111115', out * 1.1);
        // Úderné plochy a hrot
        drawRRect(ctx, 22, -16, 4, 32, 1, '#94a3b8', '#111115', 1.4);
        drawRRect(ctx, 38, -16, 4, 32, 1, '#94a3b8', '#111115', 1.4);
        // Akcent uprostřed hlavy
        drawSphere(ctx, 32, 0, 4.5, col || '#64748b', '#111115', 1.4, true);
      }
      else if (weaponId === 'staff') {
        // Dřevěná magická hůl
        drawRRect(ctx, -14, -2.5, 46, 5, 2, '#78350f', '#111115', out);
        // Zlaté lůžko krystalu
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(33, 0, 7.5, Math.PI * 0.4, Math.PI * 1.6);
        ctx.stroke();
        // Zářící krystal na špičce
        const glow = getGlowSprite(col || '#818cf8');
        ctx.drawImage(glow, 35 - 18, -18, 36, 36);
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(35, -6.5);
        ctx.lineTo(44, 0);
        ctx.lineTo(35, 6.5);
        ctx.closePath();
        ctx.fillStyle = col || '#818cf8';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
        drawSphere(ctx, 35, 0, 2.5, '#ffffff', null, 0, false);
      }
      else if (weaponId === 'wrench') {
        // Rukojeť francouzského klíče s modrým gripem
        drawRRect(ctx, -8, -3.2, 34, 6.4, 2, '#94a3b8', '#111115', out);
        drawRRect(ctx, -4, -3.2, 14, 6.4, 1, col || '#0ea5e9', '#111115', 1.2);
        // Čelisti klíče (tvar C)
        ctx.beginPath();
        ctx.arc(28, 0, 10.5, 0.55, TAU - 0.55);
        ctx.lineTo(25, -4.5);
        ctx.lineTo(25, 4.5);
        ctx.closePath();
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.lineWidth = out;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
      }
      else if (weaponId === 'mace') {
        // Rukojeť palcátu
        drawRRect(ctx, -10, -2.8, 34, 5.6, 2, '#78350f', '#111115', out);
        drawRRect(ctx, 14, -3.8, 8, 7.6, 1.5, '#ca8a04', '#111115', 1.4);
        // Ostny kolem hlavice
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8;
          ctx.beginPath();
          ctx.moveTo(29 + Math.cos(a - 0.25) * 7, Math.sin(a - 0.25) * 7);
          ctx.lineTo(29 + Math.cos(a) * 14.5, Math.sin(a) * 14.5);
          ctx.lineTo(29 + Math.cos(a + 0.25) * 7, Math.sin(a + 0.25) * 7);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Zlatá koule palcátu se svatým jádrem
        drawSphere(ctx, 29, 0, 9, '#eab308', '#111115', out, true);
        drawSphere(ctx, 29, 0, 4, col || '#fde68a', '#111', 1, false);
      }
    });
  }

  // Předpečený záblesk z hlavně (hvězdicový muzzle flash)
  function bakeMuzzleFlash(color) {
    const col = color || '#fbbf24';
    return getCached(`muz_${col}`, 64, 64, (ctx) => {
      ctx.translate(14, 32);
      const glow = getGlowSprite(col);
      ctx.drawImage(glow, -14, -28, 56, 56);

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(18, -16);
      ctx.lineTo(14, -5);
      ctx.lineTo(38, 0);
      ctx.lineTo(14, 5);
      ctx.lineTo(18, 16);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(22, 0);
      ctx.lineTo(0, 2.5);
      ctx.closePath();
      ctx.fill();
    });
  }

  ZS.weapon = function (ctx, weaponId, x, y, r, angle, ts, atk, color) {
    const R = Math.max(10, Math.round(r || 16));
    const time = ts || 0;
    const wId = weaponId || 'sword';
    const skin = '#f3d2b3';
    const out = Math.max(1.6, R * 0.11);

    const idleBob = Math.sin(time * 0.006 + x * 0.05) * 0.04;
    const isRanged = wId === 'pistol' || wId === 'shotgun' || wId === 'rifle' || wId === 'bow';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle || 0) + idleBob);

    if (isRanged) {
      const p = atk && typeof atk.p === 'number' ? clamp(atk.p, 0, 1) : null;
      // Zpětný ráz: prudké cuknutí dozadu na začátku výstřelu a plynulý návrat
      let recoil = 0;
      if (p !== null && wId !== 'bow') {
        recoil = p < 0.15 ? (p / 0.15) * 7 : Math.max(0, (1 - (p - 0.15) / 0.55) * 7);
        if (wId === 'shotgun') recoil *= 1.35;
      }

      if (wId === 'bow') {
        // Luk je dynamický (natahování tětivy a mizení šípu)
        let drawDist = 4; // Klidové napnutí
        let hasArrow = true;
        if (p !== null) {
          if (p < 0.35) {
            drawDist = lerp(4, 13, p / 0.35);
          } else if (p < 0.72) {
            drawDist = 2;
            hasArrow = false; // Šíp vystřelen
          } else {
            drawDist = lerp(2, 4, (p - 0.72) / 0.28);
            hasArrow = true;
          }
        }

        const bowX = R * 0.75;
        // Tětiva
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bowX - 2, -R * 0.88);
        ctx.lineTo(bowX - drawDist, 0);
        ctx.lineTo(bowX - 2, R * 0.88);
        ctx.stroke();

        // Lučiště s barevnými konci
        ctx.beginPath();
        ctx.arc(bowX - 10, 0, R * 0.92, -Math.PI * 0.46, Math.PI * 0.46);
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 6.5;
        ctx.stroke();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Zelené/barevné bandáže na luku
        drawSphere(ctx, bowX + 3, -R * 0.45, 2.8, color || '#84cc16', '#111', 1, false);
        drawSphere(ctx, bowX + 3, R * 0.45, 2.8, color || '#84cc16', '#111', 1, false);

        // Šíp založený v luku
        if (hasArrow) {
          const ax = bowX - drawDist;
          drawRRect(ctx, ax, -1.2, 24, 2.4, 1, '#d6d3d1', '#111', 1);
          ctx.fillStyle = color || '#84cc16';
          ctx.fillRect(ax, -3, 5, 6);
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(ax + 28, 0);
          ctx.lineTo(ax + 21, -3.8);
          ctx.lineTo(ax + 21, 3.8);
          ctx.closePath();
          ctx.fill();
        }

        // Levá ruka drží lučiště, pravá tahá tětivu
        drawSphere(ctx, bowX + 2, -2, R * 0.24, skin, '#111115', out);
        drawSphere(ctx, bowX - drawDist, 3, R * 0.24, skin, '#111115', out);
      } else {
        // Palné zbraně (pistol, shotgun, rifle)
        const wSprite = bakeWeaponSprite(wId, color);
        const wx = R * 0.55 - recoil;
        const wy = wId === 'pistol' ? R * 0.25 : R * 0.22;

        // Levá podpůrná ruka (pro dvouruční pušku a brokovnici)
        if (wId === 'shotgun' || wId === 'rifle') {
          drawSphere(ctx, wx + 13, wy - 3.5, R * 0.23, skin, '#111115', out);
        }

        // Vykreslení zbraně
        ctx.drawImage(wSprite, wx - 24, wy - wSprite.height / 2);

        // Pravá ruka na spoušti
        drawSphere(ctx, wx - 2, wy + 2.5, R * 0.24, skin, '#111115', out);

        // Hvězdicový záblesk z hlavně při výstřelu (p < 0.25)
        if (p !== null && p < 0.25) {
          const flash = bakeMuzzleFlash(color || '#fbbf24');
          const fade = 1 - p / 0.25;
          const scale = (wId === 'shotgun' ? 1.35 : wId === 'rifle' ? 1.15 : 0.9) * (0.8 + fade * 0.4);
          const muzX = wx + (wId === 'rifle' ? 42 : wId === 'shotgun' ? 32 : 20);
          ctx.save();
          ctx.translate(muzX, wy);
          ctx.scale(scale, scale);
          ctx.globalAlpha = fade;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(flash, -14, -32);
          ctx.restore();
        }
      }
    } else {
      // ZBRANĚ NA BLÍZKO (sword, dagger, hammer, staff, wrench, mace)
      const p = atk && typeof atk.p === 'number' ? clamp(atk.p, 0, 1) : null;
      let weapAngle = 0.55; // Klidový úhel držení po pravém boku
      let handOffsetX = R * 0.42;
      let handOffsetY = R * 0.62;

      if (p !== null) {
        const st = getMeleeSwingState(wId, p, atk.arc || 1.15);
        weapAngle = st.curAngle;
        const holdR = R * 0.72 + st.lunge;
        handOffsetX = Math.cos(weapAngle) * holdR;
        handOffsetY = Math.sin(weapAngle) * holdR;
      }

      // Levá volná ruka (vyvažuje pohyb na druhé straně těla)
      const leftAngle = p !== null ? -weapAngle * 0.35 - 0.9 : -0.85;
      drawSphere(
        ctx,
        Math.cos(leftAngle) * R * 0.68,
        Math.sin(leftAngle) * R * 0.68,
        R * 0.24,
        skin,
        '#111115',
        out
      );

      // Zbraň a pravá ruka
      const wSprite = bakeWeaponSprite(wId, color);
      ctx.save();
      ctx.translate(handOffsetX, handOffsetY);
      ctx.rotate(weapAngle + (p === null ? 0.25 : 0.15));
      ctx.drawImage(wSprite, -24, -wSprite.height / 2);
      drawSphere(ctx, 0, 0, R * 0.25, skin, '#111115', out);
      ctx.restore();
    }

    ctx.restore();
  };

  // ============================================================================
  // 3) STOPA MÁCHNUTÍ – ZS.swingFx(ctx, weaponId, x, y, angle, range, arc, p, color, seed)
  // ============================================================================

  // Pomocná funkce pro vykreslení zužujícího se půlměsíce švihu
  function drawTaperedCrescent(ctx, aStart, aEnd, rOuter, maxThick, fillStyle, alpha) {
    const steps = 14;
    const diff = aEnd - aStart;
    if (Math.abs(diff) < 0.02) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();

    // Vnější hrana (od začátku ke špičce čepele)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = aStart + diff * t;
      const ro = rOuter - (1 - t) * 4;
      const px = Math.cos(a) * ro;
      const py = Math.sin(a) * ro;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Vnitřní hrana (od špičky zpět k začátku, tloušťka klesá k nule)
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const a = aStart + diff * t;
      const thick = maxThick * Math.sin(t * Math.PI * 0.85) * t;
      const ri = Math.max(8, rOuter - thick);
      ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ZS.swingFx = function (ctx, weaponId, x, y, angle, range, arc, p, color, seed) {
    const prog = clamp(p || 0, 0, 1);
    if (prog <= 0.01 || prog >= 0.99) return;

    const wId = weaponId || 'sword';
    const R = clamp(range || 90, 40, 160);
    const A = arc || 1.15;
    const rand = mulberry32((seed || 1) + 777);

    const defCols = {
      sword: '#ef4444',
      dagger: '#a855f7',
      hammer: '#94a3b8',
      staff: '#818cf8',
      wrench: '#0ea5e9',
      mace: '#fde68a'
    };
    const col = color || defCols[wId] || '#ef4444';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);

    // Speciální případ: Dýka dělá dva rychlé seky do X
    if (wId === 'dagger') {
      const fade1 = prog < 0.65 ? clamp(prog / 0.2, 0, 1) * (1 - Math.max(0, (prog - 0.35) / 0.3)) : 0;
      if (fade1 > 0.02) {
        const u1 = clamp(prog / 0.45, 0, 1);
        const cur1 = lerp(-A * 0.55, A * 0.55, easeOutCubic(u1));
        const tail1 = lerp(-A * 0.55, cur1, clamp((prog - 0.15) / 0.4, 0, 0.75));
        drawTaperedCrescent(ctx, tail1, cur1, R * 0.85, 16, col, fade1 * 0.75);
        ctx.globalCompositeOperation = 'lighter';
        drawTaperedCrescent(ctx, tail1, cur1, R * 0.83, 7, '#ffffff', fade1 * 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }

      if (prog > 0.42) {
        const u2 = clamp((prog - 0.42) / 0.42, 0, 1);
        const fade2 = 1 - Math.max(0, (prog - 0.72) / 0.28);
        const cur2 = lerp(A * 0.55, -A * 0.55, easeOutCubic(u2));
        const tail2 = lerp(A * 0.55, cur2, clamp((u2 - 0.25) / 0.75, 0, 0.75));
        drawTaperedCrescent(ctx, tail2, cur2, R * 0.92, 16, col, fade2 * 0.8);
        ctx.globalCompositeOperation = 'lighter';
        drawTaperedCrescent(ctx, tail2, cur2, R * 0.9, 7, '#ffffff', fade2 * 0.95);
      }
      ctx.restore();
      return;
    }

    const st = getMeleeSwingState(wId, prog, A);
    if (st.pass === 0) {
      ctx.restore();
      return;
    }

    const fade = 1 - Math.pow(clamp((prog - 0.62) / 0.38, 0, 1), 1.5);
    const tailLag = clamp((st.slashProgress - 0.25) * 0.75, 0, 0.82);
    const aTail = lerp(st.startAngle, st.curAngle, tailLag);
    const aHead = st.curAngle;

    const maxThick = wId === 'hammer' ? 34 : wId === 'sword' ? 24 : 20;

    // 1. Vnější barevná stopa
    drawTaperedCrescent(ctx, aTail, aHead, R, maxThick, col, fade * 0.65);

    // 2. Zářivé vnitřní bílé jádro
    ctx.globalCompositeOperation = 'lighter';
    drawTaperedCrescent(ctx, lerp(aTail, aHead, 0.2), aHead, R - 2, maxThick * 0.42, '#ffffff', fade * 0.85);
    ctx.globalCompositeOperation = 'source-over';

    // 3. Unikátní detaily podle zbraně
    if (wId === 'sword') {
      // Odletující jiskry ze špičky čepele
      const spark = getSparkSprite('#fef08a');
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const spA = lerp(aTail, aHead, rand());
        const spR = R * (0.85 + rand() * 0.12) + prog * 14 * rand();
        const sz = (8 + rand() * 8) * fade;
        ctx.globalAlpha = fade;
        ctx.drawImage(spark, Math.cos(spA) * spR - sz / 2, Math.sin(spA) * spR - sz / 2, sz, sz);
      }
    }
    else if (wId === 'hammer' && prog > 0.65) {
      // Drtivý dopad na konci švihu: prasklina v zemi, rázová vlna a prach
      const impU = clamp((prog - 0.65) / 0.35, 0, 1);
      const impFade = 1 - impU;
      const ix = Math.cos(aHead) * (R * 0.82);
      const iy = Math.sin(aHead) * (R * 0.82);

      ctx.save();
      ctx.translate(ix, iy);

      // Praskliny v zemi
      ctx.strokeStyle = `rgba(17, 17, 21, ${impFade * 0.9})`;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const ca = (i * TAU) / 6 + rand() * 0.4;
        const len = (14 + rand() * 18) * easeOutCubic(impU);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ca + 0.15) * len * 0.5, Math.sin(ca + 0.15) * len * 0.5);
        ctx.lineTo(Math.cos(ca) * len, Math.sin(ca) * len);
        ctx.stroke();
      }

      // Rázová vlna a prachové obláčky
      ctx.strokeStyle = `rgba(226, 232, 240, ${impFade * 0.8})`;
      ctx.lineWidth = 3 * impFade;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + impU * 34, 0, TAU);
      ctx.stroke();

      const smoke = getSmokeSprite('#94a3b8');
      for (let i = 0; i < 5; i++) {
        const da = (i * TAU) / 5 + rand() * 0.3;
        const dist = impU * (18 + rand() * 16);
        const dSize = 18 * impFade;
        ctx.globalAlpha = impFade * 0.65;
        ctx.drawImage(smoke, Math.cos(da) * dist - dSize / 2, Math.sin(da) * dist - dSize / 2, dSize, dSize);
      }
      ctx.restore();
    }
    else if (wId === 'staff') {
      // Magické runy a hvězdičky podél oblouku
      const spark = getSparkSprite(col);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const ra = lerp(aTail, aHead, i / 5);
        const rr = R * (0.78 + (i % 2) * 0.14);
        const rx = Math.cos(ra) * rr;
        const ry = Math.sin(ra) * rr;
        ctx.globalAlpha = fade * 0.9;
        ctx.drawImage(spark, rx - 9, ry - 9, 18, 18);
        ctx.strokeStyle = '#e0e7ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(rx, ry, 5 * fade, 0, TAU);
        ctx.stroke();
      }
    }
    else if (wId === 'wrench') {
      // Kovový odlesk a oranžové jiskry
      ctx.strokeStyle = `rgba(251, 146, 60, ${fade})`;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 7; i++) {
        const sa = lerp(aTail, aHead, rand());
        const sr = R * (0.75 + rand() * 0.2);
        const sx = Math.cos(sa) * sr;
        const sy = Math.sin(sa) * sr;
        const tang = sa + Math.PI / 2 + (rand() - 0.5) * 0.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(tang) * 12, sy + Math.sin(tang) * 12);
        ctx.stroke();
      }
    }
    else if (wId === 'mace') {
      // Zlaté svaté paprsky vystřelující ven z oblouku
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5 * fade;
      for (let i = 0; i < 6; i++) {
        const ra = lerp(aTail, aHead, (i + 0.5) / 6);
        ctx.beginPath();
        ctx.moveTo(Math.cos(ra) * (R * 0.65), Math.sin(ra) * (R * 0.65));
        ctx.lineTo(Math.cos(ra) * (R * 1.12), Math.sin(ra) * (R * 1.12));
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // ============================================================================
  // 4) PROJEKTILY – ZS.projectile(ctx, kind, x, y, angle, ts, color, age, seed)
  // ============================================================================

  function bakeProjectileCore(kind, color) {
    const key = `proj_${kind}_${color}`;
    return getCached(key, 48, 32, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);

      if (kind === 'bullet' || kind === 'pellet' || kind === 'rifle') {
        const isPel = kind === 'pellet';
        const isRif = kind === 'rifle';
        const len = isRif ? 14 : isPel ? 6 : 10;
        const rad = isRif ? 2.2 : isPel ? 2.8 : 3;
        drawRRect(ctx, -len / 2, -rad, len, rad * 2, rad, '#fef08a', '#111115', 1.4);
      }
      else if (kind === 'arrow') {
        // Dřevěný dřík
        drawRRect(ctx, -14, -1.5, 24, 3, 1, '#78350f', '#111115', 1.2);
        // Barevné letky
        ctx.fillStyle = color || '#84cc16';
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-17, -5);
        ctx.lineTo(-13, 0);
        ctx.lineTo(-17, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Ocelový hrot
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(8, -4.5);
        ctx.lineTo(8, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      else if (kind === 'fireball') {
        const glow = getGlowSprite('#f97316');
        ctx.drawImage(glow, -20, -16, 40, 32);
        drawSphere(ctx, 2, 0, 8.5, '#ea580c', '#7c2d12', 1.5, false);
        drawSphere(ctx, 3, 0, 6, '#facc15', null, 0, false);
        drawSphere(ctx, 4, 0, 3.2, '#ffffff', null, 0, false);
      }
      else if (kind === 'magic') {
        const glow = getGlowSprite(color || '#a855f7');
        ctx.drawImage(glow, -18, -16, 36, 32);
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(2, -6);
        ctx.lineTo(-10, 0);
        ctx.lineTo(2, 6);
        ctx.closePath();
        ctx.fillStyle = color || '#a855f7';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#111115';
        ctx.stroke();
        drawSphere(ctx, 3, 0, 3, '#ffffff', null, 0, false);
      }
      else if (kind === 'grenade') {
        // Vojenský granát s vroubkováním a pojistkou
        drawRRect(ctx, -7, -6, 14, 12, 5, '#3f6212', '#111115', 1.8);
        ctx.strokeStyle = '#1a2e05';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2, -5); ctx.lineTo(-2, 5);
        ctx.moveTo(3, -5); ctx.lineTo(3, 5);
        ctx.stroke();
        // Roznětka
        drawRRect(ctx, 6, -2.5, 4, 5, 1, '#94a3b8', '#111115', 1.2);
      }
      else if (kind === 'rocket') {
        // Křidélka vzadu
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-14, -7);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-14, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Tělo rakety a bojová hlavice
        drawRRect(ctx, -10, -3.5, 18, 7, 2, '#475569', '#111115', 1.6);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(7, -4);
        ctx.lineTo(7, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  ZS.projectile = function (ctx, kind, x, y, angle, ts, color, age, seed) {
    const k = kind || 'bullet';
    const time = ts || 0;
    const ag = age !== undefined ? Math.max(0, age) : 0.2;
    const ramp = clamp(ag / 0.09, 0.08, 1); // Zkrácení stopy těsně po výstřelu
    const rand = mulberry32((seed || 1) + 999);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle || 0);

    if (k === 'bullet' || k === 'pellet' || k === 'rifle') {
      const col = color || (k === 'rifle' ? '#06b6d4' : k === 'pellet' ? '#fb923c' : '#fbbf24');
      const maxTrail = k === 'rifle' ? 68 : k === 'bullet' ? 36 : 16;
      const tLen = maxTrail * ramp;
      const tW = k === 'rifle' ? 2.5 : k === 'pellet' ? 2.2 : 3.6;

      // Světelná stopa (tracer)
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-tLen, 0);
      ctx.lineTo(2, -tW);
      ctx.lineTo(2, tW);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-tLen * 0.55, 0);
      ctx.lineTo(2, -tW * 0.45);
      ctx.lineTo(2, tW * 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      const core = bakeProjectileCore(k, col);
      ctx.drawImage(core, -core.width / 2, -core.height / 2);
    }
    else if (k === 'arrow') {
      const col = color || '#84cc16';
      const tLen = 28 * ramp;
      // Rychlostní šmouhy vzduchu
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-12 - tLen, -3.5); ctx.lineTo(4, -3.5);
      ctx.moveTo(-12 - tLen * 0.8, 3.5); ctx.lineTo(4, 3.5);
      ctx.stroke();

      const core = bakeProjectileCore('arrow', col);
      ctx.drawImage(core, -core.width / 2, -core.height / 2);
    }
    else if (k === 'fireball') {
      const tailLen = 46 * ramp;
      const smoke = getSmokeSprite('#3f3f46');

      // Kouřové obláčky a uhlíky za ohnivou koulí (počítané z ts a seed)
      for (let i = 0; i < 5; i++) {
        const u = ((time * 0.008 + i * 0.2 + rand() * 0.2) % 1);
        const px = -6 - u * tailLen;
        const py = Math.sin(time * 0.02 + i * 2) * (2 + u * 7);
        const sz = (10 + u * 14);
        ctx.globalAlpha = (1 - u) * 0.55;
        ctx.drawImage(smoke, px - sz / 2, py - sz / 2, sz, sz);
      }

      // Vlnící se plamenný ohon
      ctx.globalAlpha = 0.9;
      const w1 = Math.sin(time * 0.025) * 4;
      const w2 = Math.cos(time * 0.025) * 4;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.quadraticCurveTo(-tailLen * 0.45, -10 + w1, -tailLen, w2 * 0.5);
      ctx.quadraticCurveTo(-tailLen * 0.45, 10 + w2, 6, 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(6, -5.5);
      ctx.quadraticCurveTo(-tailLen * 0.3, -6 - w1 * 0.6, -tailLen * 0.68, 0);
      ctx.quadraticCurveTo(-tailLen * 0.3, 6 - w2 * 0.6, 6, 5.5);
      ctx.closePath();
      ctx.fill();

      // Jiskry
      ctx.fillStyle = '#fef08a';
      for (let i = 0; i < 4; i++) {
        const u = ((time * 0.012 + i * 0.25) % 1);
        const jx = -4 - u * tailLen * 0.9;
        const jy = (rand() - 0.5) * 14 * u;
        ctx.globalAlpha = 1 - u;
        ctx.fillRect(jx, jy, 2.5, 2.5);
      }

      ctx.globalAlpha = 1;
      const core = bakeProjectileCore('fireball', '#f97316');
      ctx.drawImage(core, -core.width / 2, -core.height / 2);
    }
    else if (k === 'magic') {
      const col = color || '#a855f7';
      const tailLen = 36 * ramp;

      // Spirálová energetická stopa
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const px = -u * tailLen;
        const py = Math.sin(u * 6 - time * 0.025) * (4.5 * (1 - u * 0.5));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const core = bakeProjectileCore('magic', col);
      ctx.drawImage(core, -core.width / 2, -core.height / 2);
    }
    else if (k === 'grenade') {
      const spin = ag * 11;
      ctx.rotate(spin);
      const core = bakeProjectileCore('grenade', color);
      ctx.drawImage(core, -core.width / 2, -core.height / 2);

      // Jiskřící roznětka
      const spark = getSparkSprite('#fef08a');
      const sSz = 10 + Math.sin(time * 0.04) * 4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(spark, 9 - sSz / 2, -sSz / 2, sSz, sSz);
    }
    else if (k === 'rocket') {
      const tailLen = 44 * ramp;
      const smoke = getSmokeSprite('#64748b');

      // Kouřová stopa za raketou
      for (let i = 0; i < 5; i++) {
        const u = ((time * 0.01 + i * 0.2) % 1);
        const sx = -12 - u * tailLen;
        const sy = Math.sin(time * 0.02 + i) * 3 * u;
        const sz = 8 + u * 14;
        ctx.globalAlpha = (1 - u) * 0.6;
        ctx.drawImage(smoke, sx - sz / 2, sy - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      // Tryskající plamen z motoru
      const jet = 12 + Math.sin(time * 0.05) * 4;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-10, -3);
      ctx.lineTo(-10 - jet, 0);
      ctx.lineTo(-10, 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-10, -1.5);
      ctx.lineTo(-10 - jet * 0.6, 0);
      ctx.lineTo(-10, 1.5);
      ctx.closePath();
      ctx.fill();

      const core = bakeProjectileCore('rocket', color);
      ctx.drawImage(core, -core.width / 2, -core.height / 2);
    }

    ctx.restore();
  };

  // ============================================================================
  // 5) VÝBUCHY, ZÁSAHY A SCHOPNOSTI – ZS.burst(ctx, kind, x, y, radius, p, ts, color, seed)
  // ============================================================================

  // Předpečené komplexní geometrické vzory pro schopnosti (runový kruh, ciferník, šestiúhelník, ozubené kolo)
  function getRuneRingSprite(color) {
    const col = color || '#818cf8';
    return getCached(`burst_rune_${col}`, 128, 128, (ctx) => {
      ctx.translate(64, 64);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, TAU);
      ctx.arc(0, 0, 44, 0, TAU);
      ctx.stroke();

      // Vnitřní hvězdice a runové značky
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44);
        ctx.lineTo(Math.cos(a + TAU / 8) * 24, Math.sin(a + TAU / 8) * 24);
        ctx.lineTo(Math.cos(a + TAU / 4) * 44, Math.sin(a + TAU / 4) * 44);
        ctx.stroke();

        ctx.fillStyle = '#e0e7ff';
        ctx.fillRect(Math.cos(a) * 50 - 2, Math.sin(a) * 50 - 2, 4, 4);
      }
    });
  }

  function getClockFaceSprite() {
    return getCached('burst_clock_face', 140, 140, (ctx) => {
      ctx.translate(70, 70);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, TAU);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, TAU);
      ctx.stroke();

      // Hodinové rysky (12 pozic)
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        const rIn = i % 3 === 0 ? 42 : 47;
        ctx.lineWidth = i % 3 === 0 ? 3 : 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58);
        ctx.stroke();
      }
    });
  }

  function getHexCellSprite(color) {
    const col = color || '#38bdf8';
    return getCached(`burst_hex_${col}`, 36, 36, (ctx) => {
      ctx.translate(18, 18);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        const px = Math.cos(a) * 14;
        const py = Math.sin(a) * 14;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.32;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  function getGearSprite(color) {
    const col = color || '#06b6d4';
    return getCached(`burst_gear_${col}`, 32, 32, (ctx) => {
      ctx.translate(16, 16);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#111115';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / 8);
        drawRRect(ctx, -3, -13, 6, 26, 1, col, '#111115', 1.2);
        ctx.restore();
      }
      drawSphere(ctx, 0, 0, 9.5, col, '#111115', 1.5, false);
      drawSphere(ctx, 0, 0, 4, '#0f172a', '#111115', 1.2, false);
    });
  }

  ZS.burst = function (ctx, kind, x, y, radius, p, ts, color, seed) {
    const prog = clamp(p || 0, 0, 1);
    if (prog <= 0.001 || prog >= 0.999) return;

    const k = kind || 'explosion';
    const R = Math.max(8, radius || 60);
    const time = ts || 0;
    const rand = mulberry32((seed || 1) + 4242);
    const fade = 1 - prog;
    const eOut = easeOutCubic(prog);

    ctx.save();
    ctx.translate(x, y);

    // 1. ULTRA-LEVNÝ ZÁSAH (hit) A ZÁBLESK Z HLAVNĚ (muzzle)
    if (k === 'hit') {
      const col = color || '#fef08a';
      const spark = getSparkSprite(col);
      const sz = R * 1.8 * (1 - prog * 0.7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.drawImage(spark, -sz / 2, -sz / 2, sz, sz);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * fade;
      for (let i = 0; i < 4; i++) {
        const a = rand() * TAU;
        const d1 = R * 0.2 * eOut;
        const d2 = R * (0.6 + rand() * 0.5) * eOut;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * d1, Math.sin(a) * d1);
        ctx.lineTo(Math.cos(a) * d2, Math.sin(a) * d2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (k === 'muzzle') {
      const flash = bakeMuzzleFlash(color || '#fbbf24');
      const sc = (R / 24) * (1 - prog * 0.5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.scale(sc, sc);
      ctx.drawImage(flash, -14, -32);
      ctx.restore();
      return;
    }

    // 2. EXPLOZE (explosion)
    if (k === 'explosion') {
      // Ohořelý kráter na zemi (zůstává až do konce)
      ctx.fillStyle = `rgba(9, 9, 11, ${fade * 0.65})`;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.68 * Math.min(1, prog * 2.5), 0, TAU);
      ctx.fill();

      // Rázová tlaková vlna
      ctx.strokeStyle = `rgba(254, 240, 138, ${fade * 0.8})`;
      ctx.lineWidth = Math.max(1.5, 6 * fade);
      ctx.beginPath();
      ctx.arc(0, 0, R * eOut, 0, TAU);
      ctx.stroke();

      // Kouřový prstenec po obvodu
      const smoke = getSmokeSprite('#27272a');
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + rand() * 0.3;
        const dist = R * (0.35 + 0.55 * eOut);
        const sSz = R * (0.35 + 0.25 * prog);
        ctx.globalAlpha = fade * 0.75;
        ctx.drawImage(smoke, Math.cos(a) * dist - sSz / 2, Math.sin(a) * dist - sSz / 2, sSz, sSz);
      }

      // Ohnivé laloky uprostřed (prvních 65 % času)
      if (prog < 0.68) {
        const fFade = 1 - prog / 0.68;
        const glow = getGlowSprite(color || '#f97316');
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = fFade;
        const gSz = R * 1.6 * easeOutCubic(prog / 0.68);
        ctx.drawImage(glow, -gSz / 2, -gSz / 2, gSz, gSz);

        for (let i = 0; i < 5; i++) {
          const a = (i * TAU) / 5 + rand();
          const d = R * 0.35 * (prog / 0.68);
          const rLobe = R * (0.32 - 0.15 * prog);
          ctx.fillStyle = i % 2 === 0 ? '#ea580c' : '#facc15';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(2, rLobe), 0, TAU);
          ctx.fill();
        }
      }

      // Odletující žhavé uhlíky
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fef08a';
      ctx.globalAlpha = fade;
      for (let i = 0; i < 10; i++) {
        const a = rand() * TAU;
        const dist = R * (0.3 + rand() * 0.85) * eOut;
        ctx.fillRect(Math.cos(a) * dist - 2, Math.sin(a) * dist - 2, 4, 4);
      }

      // Počáteční bílý záblesk
      if (prog < 0.18) {
        ctx.fillStyle = `rgba(255,255,255,${1 - prog / 0.18})`;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.75, 0, TAU);
        ctx.fill();
      }
    }
    // 3. KOUZELNÍKOVA NOVA (nova)
    else if (k === 'nova') {
      const col = color || '#818cf8';
      const rune = getRuneRingSprite(col);
      const rSz = R * 2 * eOut;

      ctx.globalCompositeOperation = 'lighter';
      ctx.save();
      ctx.globalAlpha = fade * 0.9;
      ctx.rotate(prog * 1.2);
      ctx.drawImage(rune, -rSz / 2, -rSz / 2, rSz, rSz);
      ctx.restore();

      // Vystřelující energetické paprsky
      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 2.5 * fade;
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12 + prog * 0.3;
        const r1 = R * 0.3 * eOut;
        const r2 = R * 1.05 * eOut;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();
      }
    }
    // 4. TELEPORT (blink_out / blink_in)
    else if (k === 'blink_out' || k === 'blink_in') {
      const isOut = k === 'blink_out';
      const u = isOut ? 1 - eOut : eOut; // Imploze vs Exploze
      const col = color || '#c084fc';
      const glow = getGlowSprite(col);
      const spark = getSparkSprite('#f3e8ff');

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;

      // Vertikální portálová trhlina
      const pw = Math.max(4, R * 1.4 * u);
      const ph = Math.max(8, R * 0.65 * (isOut ? 1 + prog * 0.5 : 1.5 - prog * 0.5));
      ctx.drawImage(glow, -pw / 2, -ph / 2, pw, ph);

      // Spirálově vtahované / vystřelované třpytky
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + prog * 4 * (isOut ? -1 : 1);
        const dist = R * 0.9 * u;
        const sz = 14 * fade;
        ctx.drawImage(spark, Math.cos(a) * dist - sz / 2, Math.sin(a) * dist - sz / 2, sz, sz);
      }
    }
    // 5. LÉČENÍ (heal)
    else if (k === 'heal') {
      const col = color || '#22c55e';
      ctx.strokeStyle = col;
      ctx.globalAlpha = fade * 0.85;
      ctx.lineWidth = 3.5 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, R * eOut, 0, TAU);
      ctx.stroke();

      // Stoupající zelené křížky a lístky
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#111115';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7 + rand();
        const dist = R * (0.2 + rand() * 0.65);
        const cx = Math.cos(a) * dist;
        const cy = Math.sin(a) * dist - prog * 26;
        const s = (5 + (i % 2) * 2) * fade;
        ctx.beginPath();
        ctx.rect(cx - s * 0.35, cy - s, s * 0.7, s * 2);
        ctx.rect(cx - s, cy - s * 0.35, s * 2, s * 0.7);
        ctx.fill();
      }
    }
    // 6. POŽEHNÁNÍ (bless)
    else if (k === 'bless') {
      const col = color || '#facc15';
      const glow = getGlowSprite(col);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.75;
      ctx.drawImage(glow, -R, -R, R * 2, R * 2);

      // Kužel nebeského světla shora
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.beginPath();
      ctx.moveTo(-R * 0.45, -R * 1.4);
      ctx.lineTo(R * 0.45, -R * 1.4);
      ctx.lineTo(R * 0.85, R * 0.3);
      ctx.lineTo(-R * 0.85, R * 0.3);
      ctx.closePath();
      ctx.fill();

      // Kroužící zlaté světlušky
      const spark = getSparkSprite('#fef08a');
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + time * 0.005;
        const d = R * 0.65;
        ctx.drawImage(spark, Math.cos(a) * d - 8, Math.sin(a) * d - 8, 16, 16);
      }
    }
    // 7. PROVOKACE / ŘEV (taunt)
    else if (k === 'taunt') {
      const col = color || '#ef4444';
      // 3 vlnité ozvěny řevu
      for (let ring = 0; ring < 3; ring++) {
        const rProg = clamp((prog - ring * 0.12) / 0.75, 0, 1);
        if (rProg <= 0) continue;
        const baseR = R * easeOutCubic(rProg);
        ctx.strokeStyle = ring % 2 === 0 ? col : '#a855f7';
        ctx.globalAlpha = (1 - rProg) * 0.85;
        ctx.lineWidth = 3 * (1 - rProg);
        ctx.beginPath();
        const pts = 36;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * TAU;
          const wave = Math.sin(a * 12 + time * 0.02) * (4 * (1 - rProg));
          const px = Math.cos(a) * (baseR + wave);
          const py = Math.sin(a) * (baseR + wave);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    // 8. OPEVNĚNÍ / ŠTÍT (fortify)
    else if (k === 'fortify') {
      const hex = getHexCellSprite(color || '#38bdf8');
      const assemble = prog < 0.25 ? easeOutCubic(prog / 0.25) : 1;
      ctx.globalAlpha = fade;

      // Středový a 6 okolních šestiúhelníků, které se poskládají k sobě
      const step = R * 0.52 * (1.4 - 0.4 * assemble);
      ctx.drawImage(hex, -18, -18, 36, 36);
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + prog * 0.2;
        ctx.drawImage(hex, Math.cos(a) * step - 18, Math.sin(a) * step - 18, 36, 36);
      }

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.88 * assemble, 0, TAU);
      ctx.stroke();
    }
    // 9. MIZNUTÍ VE STÍNU (stealth)
    else if (k === 'stealth') {
      const smoke = getSmokeSprite(color || '#581c87');
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + prog * 1.6;
        const d = R * 0.65 * eOut;
        const sz = R * (0.48 + 0.2 * Math.sin(i));
        ctx.globalAlpha = fade * 0.8;
        ctx.drawImage(smoke, Math.cos(a) * d - sz / 2, Math.sin(a) * d - sz / 2, sz, sz);
      }
    }
    // 10. ÚSKOK / VÍTR (dodge)
    else if (k === 'dodge') {
      const col = color || '#4ade80';
      ctx.strokeStyle = col;
      ctx.lineWidth = 3 * fade;
      ctx.lineCap = 'round';
      ctx.globalAlpha = fade;

      // Větrné víry a šmouhy pohybu
      for (let i = 0; i < 5; i++) {
        const aStart = (i * TAU) / 5 + prog * 3.5;
        const rArc = R * (0.35 + (i % 3) * 0.22) * eOut;
        ctx.beginPath();
        ctx.arc(0, 0, rArc, aStart, aStart + 1.3);
        ctx.stroke();
      }
    }
    // 11. OPRAVA (repair)
    else if (k === 'repair') {
      const gear = getGearSprite(color || '#06b6d4');
      const spark = getSparkSprite('#fef08a');
      ctx.globalAlpha = fade;

      for (let i = 0; i < 3; i++) {
        const a = (i * TAU) / 3 + prog * 1.2;
        const d = R * 0.55 * eOut;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate((i % 2 === 0 ? 1 : -1) * time * 0.005);
        ctx.drawImage(gear, -14, -14, 28, 28);
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = rand() * TAU;
        const d = R * 0.85 * eOut * rand();
        ctx.drawImage(spark, Math.cos(a) * d - 7, Math.sin(a) * d - 7, 14, 14);
      }
    }
    // 12. POTLAČOVACÍ PALBA / ZAMĚŘENÍ (suppress)
    else if (k === 'suppress') {
      const col = color || '#f97316';
      ctx.strokeStyle = col;
      ctx.globalAlpha = fade;

      // Zaměřovací prstence a kříž
      const rOuter = R * (1.15 - 0.25 * eOut);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, 0, TAU);
      ctx.stroke();

      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, rOuter * 0.65, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      // Značky zaměřovače
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4 + prog * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (rOuter * 0.4), Math.sin(a) * (rOuter * 0.4));
        ctx.lineTo(Math.cos(a) * (rOuter * 1.12), Math.sin(a) * (rOuter * 1.12));
        ctx.stroke();
      }
    }
    // 13. JEDOVATÝ MRAK (poison)
    else if (k === 'poison') {
      const smoke = getSmokeSprite(color || '#65a30d');
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7 + rand() * 0.5;
        const d = R * (0.2 + 0.55 * eOut) * rand();
        const sz = R * (0.55 + 0.2 * (i % 2));
        ctx.globalAlpha = fade * 0.65;
        ctx.drawImage(smoke, Math.cos(a) * d - sz / 2, Math.sin(a) * d - sz / 2, sz, sz);
      }

      // Praskající jedovaté bubliny
      ctx.fillStyle = '#bef264';
      ctx.strokeStyle = '#1a2e05';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = fade;
      for (let i = 0; i < 8; i++) {
        const a = rand() * TAU;
        const d = R * 0.78 * rand() * eOut;
        const br = 2.5 + ((prog * 3 + i * 0.3) % 1) * 4.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, br, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    // 14. ZASTAVENÍ ČASU (timestop - i pro obří poloměry 400..760 px)
    else if (k === 'timestop') {
      const clock = getClockFaceSprite();
      const curR = R * eOut;

      // Inverzní modro-azurová časová vlna
      ctx.fillStyle = `rgba(14, 165, 233, ${fade * 0.14})`;
      ctx.beginPath();
      ctx.arc(0, 0, curR, 0, TAU);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.85;
      ctx.drawImage(clock, -curR, -curR, curR * 2, curR * 2);

      // Otáčející se hodinové ručičky, které prudce zpomalují
      const handAngle1 = easeOutCubic(prog) * 2.8;
      const handAngle2 = easeOutCubic(prog) * 0.7 - 1.2;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineCap = 'round';

      ctx.lineWidth = Math.max(2, curR * 0.035);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(handAngle1) * curR * 0.72, Math.sin(handAngle1) * curR * 0.72);
      ctx.stroke();

      ctx.lineWidth = Math.max(3, curR * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(handAngle2) * curR * 0.48, Math.sin(handAngle2) * curR * 0.48);
      ctx.stroke();
    }
    // 15. BOŽÍ HNĚV (holy - velkoplošné sloupy světla a zlaté blesky)
    else if (k === 'holy') {
      const glow = getGlowSprite('#facc15');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.85;

      // Obvodový zlatý kruh
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, R * eOut, 0, TAU);
      ctx.stroke();

      // Sloupy nebeského světla a blesky rozmístěné po ploše
      const pillars = R > 180 ? 7 : 4;
      for (let i = 0; i < pillars; i++) {
        const a = (i * TAU) / pillars + rand() * 0.4;
        const d = i === 0 ? 0 : R * (0.35 + 0.45 * rand()) * eOut;
        const px = Math.cos(a) * d;
        const py = Math.sin(a) * d;
        const pW = Math.min(48, R * 0.25) * fade;
        const pH = Math.min(140, R * 0.75);

        // Sloup světla
        ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
        ctx.fillRect(px - pW / 2, py - pH, pW, pH);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - pW * 0.2, py - pH, pW * 0.4, pH);

        // Dopadová záře na zemi
        ctx.drawImage(glow, px - pW * 1.4, py - pW * 0.8, pW * 2.8, pW * 1.6);
      }
    }
    // 16. ELEKTRICKÝ VÝBOJ (shock)
    else if (k === 'shock') {
      const col = color || '#38bdf8';
      const glow = getGlowSprite(col);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.drawImage(glow, -R * 0.5, -R * 0.5, R, R);

      // Rozvětvené blesky do všech stran
      const stepSeed = Math.floor(prog * 10);
      const bRand = mulberry32((seed || 1) + stepSeed * 131);
      const branches = 7;

      for (let b = 0; b < branches; b++) {
        const baseA = (b * TAU) / branches + (bRand() - 0.5) * 0.4;
        const maxLen = R * (0.65 + 0.35 * bRand()) * eOut;

        ctx.strokeStyle = col;
        ctx.lineWidth = 3.2 * fade;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        let lx = 0, ly = 0;
        for (let s = 1; s <= 4; s++) {
          const t = s / 4;
          const jitter = (s < 4 ? (bRand() - 0.5) * 0.45 : 0);
          lx = Math.cos(baseA + jitter) * (maxLen * t);
          ly = Math.sin(baseA + jitter) * (maxLen * t);
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();

        // Bílé jádro blesku
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * fade;
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // ============================================================================
  // STATISTIKA CACHE (Část 3)
  // ============================================================================

  ZS.getCacheStats3 = function () {
    let totalPixels = 0;
    cache3.forEach((c) => {
      totalPixels += c.width * c.height;
    });
    const bytes = totalPixels * 4;
    return {
      entries: cache3.size,
      bytes: bytes,
      memoryKB: Math.round(bytes / 1024)
    };
  };
})(window);

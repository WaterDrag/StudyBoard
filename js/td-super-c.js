/* td-super-c.js — Super grafika (td_gfx '2'): věže Arkánní čaroděj, Královský alchymista, Strážní hláska a Zlatý důl.
 * Registruje do window.TDSS.drawers[id] = { base, turret }; pomůcky z TDSS._h (td-super-b.js).
 * Hláska a důl se nenatáčí (budovy). Styl: obrys #111, světlo shora zleva, bez rozmazání. */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const H = TDS._h; if (!H) return;
  const { OUT, PI, TAU, makeRng, shade, lv, mainPath, circlePath, ellipsePath, polyPath, regPoly, starPath, roundRect, line, paint, fillA, strokeA, strokeOutlined, softShadow, gloss, glow, rivet, gem, flame3, puff, lightning, rune, pennant, buffAura, stoneRing, woodDisc, figure, arm, crate } = H;

  function bottle(ctx, x, y, s, col) {
    circlePath(ctx, x, y + s * 0.3, s); paint(ctx, col, 1.1);
    ctx.beginPath(); ctx.rect(x - s * 0.35, y - s * 1.2, s * 0.7, s * 0.9); paint(ctx, '#e5e7eb', 0.9);
    circlePath(ctx, x - s * 0.35, y, s * 0.3); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  }
  function skull(ctx, x, y, s) {
    circlePath(ctx, x, y, s); paint(ctx, '#f5f5f4', 1);
    for (const sd of [-1, 1]) { circlePath(ctx, x + s * 0.2, y + sd * s * 0.38, s * 0.26); ctx.fillStyle = OUT; ctx.fill(); }
  }
  function book(ctx, x, y, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    roundRect(ctx, -4, -3, 8, 6, 1); paint(ctx, col, 1.1); roundRect(ctx, -3.3, -2.4, 6.6, 4.8, 0.6); ctx.fillStyle = '#fffbeb'; ctx.fill(); line(ctx, 0, -2.4, 0, 2.4); strokeA(ctx, OUT, 0.8, 1);
    ctx.restore();
  }
  function coinPile(ctx, x, y, n, R) {
    for (let i = 0; i < n; i++) { const a = R() * TAU, d = R() * 4; ellipsePath(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 2.2, 1.6); paint(ctx, '#f5c518', 0.8); }
    starPath(ctx, x - 1, y - 2, 2, 0.8, 4, 0); ctx.fillStyle = '#fffbe0'; ctx.fill();
  }

  /* =========================== ARKÁNNÍ ČARODĚJ =========================== */
  // P1 arkána (hrot, knihy, arcimág), P2 oheň (fénix), P3 jasnozřivost → nekromant, král nemrtvých
  TDS.drawers.arkanni_carodej = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), necro = m.p === 2 && m.t >= 4;
      softShadow(ctx, 0, 0, 20, 20);
      if (m.p === 0 && m.t >= 5) { circlePath(ctx, 0, 0, 25); fillA(ctx, '#a78bfa', 0.25); circlePath(ctx, 0, 0, 25); strokeA(ctx, '#ddd6fe', 1.4, 0.8); }
      if (m.p === 1 && m.t >= 2) for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i / 6 * TAU + 0.3); ctx.translate(21, 0); ctx.rotate(PI); flame3(ctx, 7, 3); ctx.restore(); }   // ohnivá stěna
      stoneRing(ctx, 19.5, necro ? '#4b5563' : '#8b8fa3', 14, 31);
      circlePath(ctx, 0, 0, 14); paint(ctx, necro ? '#1f2a24' : '#3b2a6b', 1.4);
      ctx.save(); ctx.rotate(0.3); circlePath(ctx, 0, 0, 11); strokeA(ctx, necro ? '#4ade80' : '#c4b5fd', 1, 0.7);
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; rune(ctx, Math.cos(an) * 11, Math.sin(an) * 11, 3.6, necro ? '#86efac' : '#c4b5fd', 50 + i); }
      ctx.restore();
      if (b >= 1) { circlePath(ctx, 12, 12, 3.6); paint(ctx, '#57534e', 1.1); ctx.save(); ctx.translate(12, 11); ctx.rotate(-PI / 2); flame3(ctx, 6, 2.6); ctx.restore(); }   // ohnivá mísa
      if (c >= 1 && !necro) { circlePath(ctx, -12, 12, 3.4); paint(ctx, '#bfdbfe', 1.1); circlePath(ctx, -13, 11, 1.2); fillA(ctx, '#fff', 0.8); glow(ctx, -12, 12, 5, '#93c5fd', 0.6); }   // křišťálová koule
      if (necro) { for (const [x, y] of [[-13, 11], [13, -11], [-13, -11]]) skull(ctx, x, y, 2.6); if (m.t >= 5) for (let i = 0; i < 4; i++) { const an = i * PI / 2 + PI / 4; glow(ctx, Math.cos(an) * 17, Math.sin(an) * 17, 4, '#4ade80', 0.9); } }
      if (m.p === 0 && m.t >= 4) { book(ctx, -12, -12, 0.4, '#5b21b6'); book(ctx, 12, -12, -0.4, '#1e3a8a'); }
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);
      const necro = m.p === 2 && m.t >= 4, phoenix = m.p === 1 && m.t >= 4, arch = m.p === 0 && m.t >= 5;
      const robe = necro ? '#14532d' : phoenix ? '#c2410c' : arch ? '#4c1d95' : '#6d28d9', trim = arch || m.t >= 5 ? '#f5c518' : '#c4b5fd';
      if (phoenix) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-2, sd * 4); ctx.quadraticCurveTo(-9, sd * 15, -14, sd * 9); ctx.quadraticCurveTo(-9, sd * 7, -6, sd * 3); ctx.closePath(); paint(ctx, '#f97316', 1.2); ctx.beginPath(); ctx.moveTo(-3, sd * 4.5); ctx.quadraticCurveTo(-8, sd * 11, -11, sd * 8.5); strokeA(ctx, '#fde047', 1.2, 1); }   // ohnivá křídla
      ctx.beginPath(); ctx.moveTo(-1, -6.5); ctx.quadraticCurveTo(-11, -8, -12.5, 0); ctx.quadraticCurveTo(-11, 8, -1, 6.5); ctx.closePath(); paint(ctx, shade(robe, -0.2), 1.5);
      arm(ctx, -0.5, -5.5, 6.5, -4.6, robe);
      // hůl s koulí: barva podle cesty
      const orb = necro ? '#4ade80' : m.p === 1 && m.t >= 1 ? '#fb923c' : m.p === 2 && m.t >= 1 ? '#93c5fd' : '#c084fc';
      line(ctx, -6, 6.5, 12, 5); strokeOutlined(ctx, 1.6, necro ? '#3f3f46' : '#7c4a1e');
      if (m.p === 1 && m.t >= 3) { polyPath(ctx, [[12, 3], [16, 4], [17.5, 5], [16, 6], [12, 7]]); paint(ctx, '#b91c1c', 1); }   // dračí hlava na holi
      glow(ctx, 13, 5, 5 + f * 4, orb, 0.9); circlePath(ctx, 13, 5, 2.8); paint(ctx, orb, 1.1); circlePath(ctx, 12.3, 4.3, 0.9); ctx.fillStyle = '#fff'; ctx.fill();
      if (necro && m.t >= 5) skull(ctx, 13, 5, 2.2);
      arm(ctx, -0.5, 5.5, 6, 6, robe);
      if (a >= 3 && m.p === 0) { glow(ctx, 9, -5, 4, '#c4b5fd', 0.8); polyPath(ctx, [[12, -5], [8, -6.6], [7, -5], [8, -3.4]]); paint(ctx, '#ddd6fe', 0.9); }   // arkánní hrot v dlani
      figure(ctx, robe, '#f1c08f', { rx: 5.6, ry: 7.2, hr: 3.6, trim });
      ellipsePath(ctx, 4.2, 0, 2.4, 2.8); paint(ctx, necro ? '#a3a3a3' : '#e5e7eb', 0.9);   // vous
      // klobouk: arcimág s hvězdnou korunou, nekromant s kápí a kostěnou korunou
      if (necro) {
        ellipsePath(ctx, -0.3, 0, 5.8, 5.4); paint(ctx, '#052e16', 1.4);
        if (m.t >= 5) for (let i = 0; i < 5; i++) { const an = PI * 0.6 + i * PI * 0.2; polyPath(ctx, [[-0.3 + Math.cos(an) * 4.5, Math.sin(an) * 4.5], [-0.3 + Math.cos(an) * 7.5, Math.sin(an) * 7.5], [-0.3 + Math.cos(an + 0.2) * 4.5, Math.sin(an + 0.2) * 4.5]]); paint(ctx, '#f5f5f4', 0.8); }
      } else {
        ellipsePath(ctx, -0.2, 0, 6.6, 6.2); paint(ctx, robe, 1.5);
        circlePath(ctx, -1, 0, 3.6); paint(ctx, shade(robe, 0.15), 1.1); circlePath(ctx, -2.2, 0, 1.6); paint(ctx, shade(robe, 0.3), 0.9);
        for (const [x, y] of [[3, -3.6], [2, 4], [-4.5, 3.5]]) { starPath(ctx, x, y, 1.3, 0.5, 5, 0.3); ctx.fillStyle = trim; ctx.fill(); }
        if (arch) for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; starPath(ctx, -0.2 + Math.cos(an) * 8.5, Math.sin(an) * 8.5, 1.6, 0.6, 4, an); paint(ctx, '#fde047', 0.6); }
      }
    }
  };

  /* =========================== KRÁLOVSKÝ ALCHYMISTA =========================== */
  // P1 elixíry (kámen mudrců), P2 kyseliny a výbušniny (smečka), P3 transmutace zlata (zmenšování)
  TDS.drawers.kralovsky_alchymista = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), R = makeRng(41);
      softShadow(ctx, 0, 0, 19, 19);
      stoneRing(ctx, 19, '#9a9a92', 14, 41);
      woodDisc(ctx, 14, '#8b5a2b');
      // kotel
      const kot = m.p === 2 && m.t >= 4 ? '#f5c518' : '#3f3f46', brew = m.p === 1 ? '#84cc16' : m.p === 2 && m.t >= 3 ? '#fde047' : m.p === 0 && m.t >= 3 ? '#ef4444' : '#a3e635';
      circlePath(ctx, -9, 9, 6); paint(ctx, kot, 1.6); circlePath(ctx, -9, 9, 4.4); paint(ctx, brew, 1);
      for (let i = 0; i < 3; i++) { circlePath(ctx, -10 + i * 1.6, 8.4 + (i % 2), 0.9 + R() * 0.5); fillA(ctx, '#fff', 0.6); }
      // police s lahvičkami
      roundRect(ctx, 4, -15, 11, 4, 1); paint(ctx, '#6b4320', 1.1);
      const cols = m.p === 0 && m.t >= 3 ? ['#ef4444', '#f97316', '#ef4444'] : ['#a3e635', '#38bdf8', '#f472b6'];
      for (let i = 0; i < (a >= 1 ? 3 : 2); i++) bottle(ctx, 6 + i * 3.5, -13, 1.4 + (a >= 1 ? 0.3 : 0), cols[i]);
      if (b >= 2) for (const [x, y] of [[12, 10], [9, 13]]) { ellipsePath(ctx, x, y, 3, 2.4); paint(ctx, '#4d7c0f', 1.1); line(ctx, x - 2.4, y, x + 2.4, y); strokeA(ctx, '#d9f99d', 0.8, 1); }   // sudy s kyselinou
      if (b >= 3) { circlePath(ctx, 13, 3, 2.6); paint(ctx, '#1f2937', 1); starPath(ctx, 13, 0, 1.4, 0.6, 4, 0); ctx.fillStyle = '#fb923c'; ctx.fill(); }   // výbušná směs
      if (c >= 3) coinPile(ctx, -12, -8, 6, R);
      if (m.p === 0 && m.t >= 5) { regPoly(ctx, 0, -2, 4, 6, 0); paint(ctx, '#78716c', 1.2); gem(ctx, 0, -2, 2.6, '#dc2626'); }   // kámen mudrců
      if (m.p === 1 && m.t >= 5) for (const [x, y, a2] of [[16, -4, 0.3], [-16, -2, 2.8]]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a2); ellipsePath(ctx, 0, 0, 4.5, 2.6); paint(ctx, '#57534e', 1.1); circlePath(ctx, 4, 0, 2); paint(ctx, '#57534e', 1); polyPath(ctx, [[3.5, -1.8], [4.5, -3.4], [5.2, -1.4]]); paint(ctx, '#57534e', 0.7); ctx.restore(); }   // probuzená smečka
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);
      const coat = m.p === 2 && m.t >= 5 ? '#be185d' : m.p === 0 && m.t >= 5 ? '#7f1d1d' : '#65a30d', gold = m.t >= 5;
      arm(ctx, -0.5, -5.5, 5.5, -4.5, coat);
      // vrhaná baňka v pravé ruce
      const fl = m.p === 1 ? '#84cc16' : m.p === 2 && m.t >= 3 ? '#fde047' : m.p === 0 && m.t >= 3 ? '#ef4444' : '#a3e635';
      if (f < 0.5) bottle(ctx, 9.5, 6, 2.2 + (a >= 1 ? 0.5 : 0), fl);
      arm(ctx, -0.5, 5.5, 7, 6.5, coat);
      if (m.p === 2 && m.t >= 5) { line(ctx, 6, -4.5, 12, -6); strokeOutlined(ctx, 1.2, '#a16207'); circlePath(ctx, 13, -6.5, 2.4); paint(ctx, '#fbcfe8', 1); glow(ctx, 13, -6.5, 4, '#f472b6', 0.8); }   // zmenšovací lupa
      figure(ctx, coat, '#f1c08f', { rx: 5.6, ry: 7.4, hr: 3.8, trim: gold ? '#fde047' : '#ecfccb' });
      roundRect(ctx, -2, -4.4, 6.2, 8.8, 1.5); paint(ctx, '#f5f5f4', 1.1);   // zástěra
      circlePath(ctx, 0.6, 0, 3.6); paint(ctx, '#78350f', 1.2);   // vlasy
      for (const sd of [-1, 1]) { circlePath(ctx, 3.2, sd * 1.4, 1.4); paint(ctx, gold ? '#f5c518' : '#a3e635', 0.8); circlePath(ctx, 3, sd * 1.4 - 0.4, 0.5); ctx.fillStyle = '#fff'; ctx.fill(); }   // brýle
      line(ctx, 3.2, -2.8, 3.2, 2.8); strokeA(ctx, OUT, 0.8, 1);
    }
  };

  /* =========================== STRÁŽNÍ HLÁSKA (nenatáčí se) =========================== */
  // P1 vojsko (bubny, cvičiště, pevnost, citadela), P2 hlídka (světlomet, zbrojnice, domobrana), P3 správa (pokladnice, knihovna, akademie)
  TDS.drawers.strazni_hlaska = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), cit = m.p === 0 && m.t >= 4;
      softShadow(ctx, 0, 0, 25, 25);
      const stone = cit ? (m.t >= 5 ? '#d6d3d1' : '#a8b3c4') : '#9a9a92', S = 24;
      roundRect(ctx, -S, -S, S * 2, S * 2, 4); paint(ctx, stone, 2.4);
      ctx.save(); roundRect(ctx, -S, -S, S * 2, S * 2, 4); ctx.clip();
      for (let y = -S; y < S; y += 6) { line(ctx, -S, y, S, y); for (let x = -S + ((y / 6) & 1) * 4; x < S; x += 8) line(ctx, x, y, x, y + 6); }
      ctx.strokeStyle = shade(stone, -0.45); ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.restore();
      for (let i = -2; i <= 2; i++) for (const [x, y] of [[i * 9, -S], [i * 9, S], [-S, i * 9], [S, i * 9]]) { roundRect(ctx, x - 3, y - 3, 6, 6, 1); paint(ctx, shade(stone, 0.12), 1.3); }   // cimbuří
      roundRect(ctx, -17, -17, 34, 34, 2); paint(ctx, '#a06a3a', 1.6);   // dřevěná podlaha
      ctx.save(); roundRect(ctx, -17, -17, 34, 34, 2); ctx.clip(); for (let x = -17; x < 17; x += 3.8) { line(ctx, x, -17, x, 17); strokeA(ctx, '#6b4320', 0.8, 0.8); } ctx.restore();
      if (cit) for (const [x, y] of [[-S, -S], [S, -S], [-S, S], [S, S]]) { circlePath(ctx, x, y, 6.5); paint(ctx, stone, 1.8); circlePath(ctx, x, y, 4.6); paint(ctx, m.t >= 5 ? '#f5c518' : '#1d4ed8', 1.4); if (m.t >= 5) gem(ctx, x, y, 1.6, '#3b82f6'); }   // věžičky citadely
      if (a >= 2) for (const [x, y] of [[-11, 11], [-6, 13]]) { circlePath(ctx, x, y, 2.8); paint(ctx, '#b91c1c', 1.1); circlePath(ctx, x, y, 2); paint(ctx, '#fef3c7', 0.7); }   // válečné bubny
      if (a >= 3 && !cit) for (const [x, y] of [[12, 12], [12, 5]]) { circlePath(ctx, x, y, 2); paint(ctx, '#d6b98c', 1); line(ctx, x - 3, y, x + 3, y); strokeOutlined(ctx, 0.9, '#8b5a2b'); }   // cvičné figuríny
      if (b >= 2) { circlePath(ctx, 12, -12, 3.6); paint(ctx, '#57534e', 1.2); circlePath(ctx, 12, -12, 2.2); paint(ctx, '#fef9c3', 0.8); glow(ctx, 12, -12, 6, '#fde68a', 0.7); }   // světlomet
      if (b >= 3) { roundRect(ctx, -15, -14, 9, 3, 1); paint(ctx, '#6b4320', 1); for (let i = 0; i < 3; i++) { line(ctx, -14 + i * 3, -16, -14 + i * 3, -10); strokeOutlined(ctx, 0.8, '#d1d5db'); } }   // stojan se zbraněmi
      if (c >= 3) { roundRect(ctx, 6, 6, 9, 6, 1.5); paint(ctx, '#92400e', 1.2); line(ctx, 6, 8.5, 15, 8.5); strokeA(ctx, '#f5c518', 1.2, 1); rivet(ctx, 10.5, 9, 1, '#f5c518'); }   // truhla pokladnice
      if (c >= 4) for (let i = 0; i < 3; i++) book(ctx, -13 + i * 4.5, -4, 0, ['#1d4ed8', '#b91c1c', '#15803d'][i]);
      if (m.p === 2 && m.t >= 5) { circlePath(ctx, 0, 0, 9); paint(ctx, '#e2e8f0', 1.6); ctx.beginPath(); ctx.arc(0, 0, 9, PI, TAU); strokeA(ctx, '#f5c518', 1.4, 1); for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; line(ctx, 0, 0, Math.cos(an) * 9, Math.sin(an) * 9); strokeA(ctx, '#94a3b8', 0.7, 0.8); } }   // kupole akademie
    },
    turret: function (ctx, up, s) {   // stožár s praporem a strážný
      const a = lv(up, 0), b = lv(up, 1), m = mainPath(up), gold = m.t >= 5;
      if (s.buffed) buffAura(ctx, 22);
      const flag = gold ? '#f5c518' : '#1d4ed8', len = 14 + a * 1.6;
      if (!(m.p === 2 && m.t >= 5)) {
        figure(ctx, b >= 4 ? '#7f1d1d' : '#1e3a8a', '#9ca3af', { rx: 4.6, ry: 6, hr: 3.4 });   // strážný v helmě
        line(ctx, 4, 4.5, 11, 2); strokeOutlined(ctx, 1, '#8b5a2b'); polyPath(ctx, [[13, 1.6], [10.5, 0.6], [10.8, 3]]); paint(ctx, '#e5e7eb', 0.7);   // kopí
      }
      circlePath(ctx, -8, -8, 2.4); paint(ctx, '#6b4320', 1.2);   // stožár
      pennant(ctx, -8, -8, -0.4, len, flag, gold ? '#1d4ed8' : '#f5c518', 2);
      if (b >= 4) { ctx.save(); ctx.translate(8, -8); ctx.rotate(-0.6); ctx.beginPath(); ctx.moveTo(-3, -1); ctx.quadraticCurveTo(3, -2.6, 5, -3.5); ctx.lineTo(5, 3.5); ctx.quadraticCurveTo(3, 2.6, -3, 1); ctx.closePath(); paint(ctx, '#f5c518', 1.1); ctx.restore(); }   // roh: volání do zbraně
    }
  };

  /* =========================== ZLATÝ DŮL (nenatáčí se) =========================== */
  // P1 těžba (žíla, trpaslík, mincovna, dračí poklad), P2 banka (trezor, sloupy, klenotnice), P3 obchod (vozík, drahokamy, tržiště, karavana)
  TDS.drawers.zlaty_dul = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), R = makeRng(61);
      softShadow(ctx, 0, 2, 31, 28);
      // skalní pahorek
      const pts = []; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU, q = 29 * (0.86 + R() * 0.16); pts.push([Math.cos(an) * q, Math.sin(an) * q * 0.92]); }
      polyPath(ctx, pts); paint(ctx, '#8a8178', 2.4);
      ctx.save(); polyPath(ctx, pts); ctx.clip();
      for (let i = 0; i < 9; i++) { const an = R() * TAU, d = 12 + R() * 14; regPoly(ctx, Math.cos(an) * d, Math.sin(an) * d, 4 + R() * 3, 5, R()); paint(ctx, R() < 0.5 ? '#9d958b' : '#7a7168', 1); }
      ellipsePath(ctx, 10, 12, 28, 22); fillA(ctx, '#000', 0.14);
      ctx.restore();
      if (a >= 2 || m.p === 0) for (let i = 0; i < 3 + a * 2; i++) { const an = R() * TAU, d = 14 + R() * 12; starPath(ctx, Math.cos(an) * d, Math.sin(an) * d, 2, 0.8, 4, 0); paint(ctx, '#f5c518', 0.6); }   // zlatá žíla
      // vchod do štoly s dřevěným rámem (k +x)
      roundRect(ctx, 6, -9, 16, 18, 3); paint(ctx, '#1c1410', 2);
      for (const y of [-9, 7]) { roundRect(ctx, 5, y, 18, 2.6, 0.8); paint(ctx, '#8b5a2b', 1.2); }
      for (const x of [6, 19]) { roundRect(ctx, x, -9, 2.8, 18, 0.8); paint(ctx, '#7a4a22', 1.2); }
      if (m.p === 0 && m.t >= 5) { glow(ctx, 14, 0, 9, '#fde047', 0.8); coinPile(ctx, 14, 2, 8, R); }   // dračí poklad v štole
      // koleje ven ze štoly
      for (const y of [-3.4, 3.4]) { line(ctx, 22, y, 31, y); strokeA(ctx, '#4b5563', 1.6, 1); }
      for (let x = 23; x < 31; x += 3) { line(ctx, x, -4.5, x, 4.5); strokeA(ctx, '#6b4320', 1.4, 1); }
      if (a >= 3) { circlePath(ctx, -6, 8, 3.2); paint(ctx, '#b91c1c', 1.1); ellipsePath(ctx, -4.2, 8, 2.2, 2.6); paint(ctx, '#d9772b', 0.9); line(ctx, -8, 5, -3, 3); strokeOutlined(ctx, 0.9, '#8b5a2b'); polyPath(ctx, [[-4.5, 1.5], [-1.5, 3.5], [-3, 4.5]]); paint(ctx, '#9ca3af', 0.7); }   // trpaslík s krumpáčem
      if (m.p === 0 && m.t >= 4) { roundRect(ctx, -18, -14, 9, 9, 1.5); paint(ctx, '#57534e', 1.3); circlePath(ctx, -13.5, -9.5, 2.6); paint(ctx, '#f5c518', 0.9); }   // mincovna
      if (b >= 2) { circlePath(ctx, -14, 10, 5); paint(ctx, '#6b7280', 1.6); circlePath(ctx, -14, 10, 3.4); strokeA(ctx, '#d1d5db', 1, 1); for (let i = 0; i < 4; i++) { const an = i * PI / 2; line(ctx, -14, 10, -14 + Math.cos(an) * 3, 10 + Math.sin(an) * 3); strokeA(ctx, '#d1d5db', 1, 1); } }   // dveře trezoru
      if (b >= 3) { roundRect(ctx, -22, -6, 9, 12, 1); paint(ctx, m.p === 1 && m.t >= 5 ? '#f5c518' : '#e5e7eb', 1.3); for (let i = 0; i < 3; i++) { line(ctx, -20.5 + i * 3, -5, -20.5 + i * 3, 5); strokeA(ctx, '#94a3b8', 1, 1); } }   // banka se sloupy
      if (c >= 2) for (const [x, y, col] of [[-10, -18, '#ef4444'], [-5, -20, '#3b82f6'], [0, -18, '#22c55e']]) gem(ctx, x, y, 2.4, col);   // drahokamy
      if (c >= 3) { ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(-12, -24); ctx.lineTo(-4, -18); ctx.closePath(); paint(ctx, '#dc2626', 1.4); line(ctx, -16, -21, -16, -18); line(ctx, -8, -21, -8, -18); strokeA(ctx, '#fef3c7', 1.2, 1); }   // stánek tržiště
      if (c >= 4) { ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(10, -28); ctx.lineTo(16, -24); ctx.closePath(); paint(ctx, '#2563eb', 1.3); }
    },
    turret: function (ctx, up, s) {   // důlní vozík se zlatem na kolejích a jeřábek
      const a = lv(up, 0), c = lv(up, 2), m = mainPath(up), R = makeRng(62);
      if (s.buffed) buffAura(ctx, 26);
      ctx.save(); ctx.translate(26, 0);
      roundRect(ctx, -5, -5, 10, 10, 1.5); paint(ctx, c >= 1 ? '#b45309' : '#57534e', 1.4);
      for (let i = 0; i < 5; i++) { ellipsePath(ctx, -2.5 + (i % 3) * 2.5, -2 + Math.floor(i / 3) * 3, 2, 1.5); paint(ctx, '#f5c518', 0.7); }
      starPath(ctx, -1, -2, 1.8, 0.7, 4, 0); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
      if (m.p === 2 && m.t >= 5) for (let i = 0; i < 2; i++) { ctx.save(); ctx.translate(-4 - i * 9, 20); roundRect(ctx, -4, -3, 8, 6, 1.5); paint(ctx, '#92400e', 1.1); ellipsePath(ctx, 0, -3, 4, 2.4); paint(ctx, '#f5f5f4', 1); ctx.restore(); }   // karavana
      // jeřábek nad štolou
      line(ctx, 2, -12, 18, -6); strokeOutlined(ctx, 1.6, '#7a4a22'); circlePath(ctx, 2, -12, 2.4); paint(ctx, '#57534e', 1.1);
      line(ctx, 18, -6, 18, -1); strokeA(ctx, '#d6b98c', 0.8, 1);
      if (a >= 1) { ellipsePath(ctx, 18, 0.5, 2.4, 1.8); paint(ctx, '#f5c518', 0.8); }
      void R;
    }
  };
})();

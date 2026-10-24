/* td-super-d.js — Super grafika (td_gfx '2'): věže Kladeč pastí, Lesní druid a Stínový zvěd a jejich doplňky.
 * Registruje do window.TDSS: drawers[id] = { base, turret } a <id>Extra(ctx, kind, x, y, ang, ts, s):
 *   kladec_pastiExtra: spike, jaw, mine, crystal (s.hp, s.fill) · lesni_druidExtra: tornado, ball (s.r), vine
 *   stinovy_zvedExtra: caltrop, sticky (s.left = zbývá do výbuchu). Pomůcky z TDSS._h (td-super-b.js). */
(function () {
  'use strict';
  const TDS = window.TDSS || (window.TDSS = {});
  const H = TDS._h; if (!H) return;
  const { OUT, PI, TAU, makeRng, shade, lv, mainPath, circlePath, ellipsePath, polyPath, regPoly, starPath, roundRect, line, paint, fillA, strokeA, strokeOutlined, softShadow, gloss, glow, rivet, gem, flame3, puff, lightning, rune, pennant, buffAura, stoneRing, woodDisc, figure, arm, crate } = H;

  function spike(ctx, x, y, s, col) {
    polyPath(ctx, [[x, y - s], [x + s * 0.7, y + s * 0.5], [x - s * 0.7, y + s * 0.5]]); paint(ctx, col, 0.9);
    polyPath(ctx, [[x, y - s * 0.8], [x - s * 0.35, y + s * 0.3], [x - s * 0.05, y + s * 0.3]]); fillA(ctx, '#fff', 0.5);
  }
  function leaf(ctx, x, y, len, w, a, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -w, len, 0); ctx.quadraticCurveTo(len * 0.5, w, 0, 0); ctx.closePath(); paint(ctx, col, 0.9);
    line(ctx, len * 0.1, 0, len * 0.85, 0); strokeA(ctx, '#000', 0.6, 0.3);
    ctx.restore();
  }

  /* =========================== KLADEČ PASTÍ =========================== */
  // P1 síla pastí (žhavé, čelisti, minové pole), P2 vrhač (dvojitý, koberec, ocelová bouře), P3 odolnost (diamant, runy, brána)
  TDS.drawers.kladec_pasti = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), R = makeRng(71);
      softShadow(ctx, 0, 0, 20, 20);
      if (m.p === 0 && m.t >= 4) for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + 0.2; circlePath(ctx, Math.cos(an) * 22, Math.sin(an) * 22, 3); paint(ctx, '#3f3f46', 1.1); circlePath(ctx, Math.cos(an) * 22, Math.sin(an) * 22, 1.1); ctx.fillStyle = '#ef4444'; ctx.fill(); }   // minové pole
      if (m.p === 2 && m.t >= 4) for (let i = 0; i < 8; i++) { const an = i / 8 * TAU; ctx.save(); ctx.rotate(an); roundRect(ctx, 17, -3, 7, 6, 1.2); paint(ctx, m.t >= 5 ? '#c9b26a' : '#78716c', 1.2); ctx.restore(); }   // barikáda
      regPoly(ctx, 0, 0, 19.5, 8, PI / 8); paint(ctx, '#8f8a82', 2.2);
      regPoly(ctx, 0, 0, 15, 8, PI / 8); paint(ctx, '#9c6636', 1.4);
      ctx.save(); regPoly(ctx, 0, 0, 15, 8, PI / 8); ctx.clip(); for (let x = -15; x < 15; x += 3.6) { line(ctx, x, -15, x, 15); strokeA(ctx, '#5a3a1e', 0.9, 0.85); } ctx.restore();
      for (let i = 0; i < 8; i++) { const an = PI / 8 + i * TAU / 8; rivet(ctx, Math.cos(an) * 17.3, Math.sin(an) * 17.3, 1.2, c >= 3 ? '#bae6fd' : '#9aa2ab'); }
      // bedny s pastmi
      crate(ctx, -10, 10, 3.6, '#9c6636'); crate(ctx, -13, 3, 3, '#8b5a2b');
      for (let i = 0; i < (a >= 1 ? 3 : 2); i++) spike(ctx, -11 + i * 2.6, 9.2, 1.6, a >= 2 ? '#fb923c' : '#d1d5db');
      if (a >= 3) { circlePath(ctx, 11, 11, 4); strokeA(ctx, OUT, 2.6, 1); circlePath(ctx, 11, 11, 4); strokeA(ctx, '#78716c', 1.6, 1); }   // medvědí čelisti
      if (c >= 3) { gem(ctx, 12, -11, 2.2, '#bae6fd'); }   // diamantové hroty
      if (m.p === 2 && m.t >= 4) rune(ctx, -12, -11, 5, '#a78bfa', 81);
      if (m.p === 1 && m.t >= 5) for (let i = 0; i < 5; i++) spike(ctx, 4 + i * 2.5, 14, 1.4, '#e5e7eb');
      void R;
    },
    turret: function (ctx, up, s) {   // vrhací rameno se sítí na pasti a obsluha
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 17);
      ctx.scale(1.25, 1.25);
      const twin = b >= 1, gold = m.t >= 5;
      for (const sd of (twin ? [-1, 1] : [0])) {
        ctx.save(); ctx.translate(0, sd * 6);
        roundRect(ctx, -4, -2.4, 8, 4.8, 1.2); paint(ctx, '#4b2e14', 1.2);
        const L = 13 + (b >= 2 ? 2 : 0), k = f > 0 ? 1 : 0.35;
        line(ctx, 0, 0, L * k + 3, 0); strokeOutlined(ctx, 2.2, gold ? '#b8860b' : '#8b5a2b');
        circlePath(ctx, L * k + 4, 0, 3.4); paint(ctx, '#6b4320', 1.1);
        if (f < 0.5) for (let i = 0; i < 3; i++) spike(ctx, L * k + 3 + (i - 1) * 1.8, 0.4, 1.3, a >= 2 ? '#fb923c' : c >= 3 ? '#bae6fd' : '#d1d5db');
        ctx.restore();
      }
      // obsluha v kožené zástěře s helmou
      figure(ctx, '#57534e', '#9ca3af', { rx: 4.6, ry: 6, hr: 3.4, trim: gold ? '#fde047' : null });
      ctx.beginPath(); ctx.arc(0.6, 0, 3.4, -PI / 2, PI / 2); strokeA(ctx, '#6b7280', 1.2, 1);
      if (m.p === 1 && m.t >= 3) { circlePath(ctx, -6, 0, 2.6); paint(ctx, '#dc2626', 1); starPath(ctx, -6, 0, 1.6, 0.6, 4, 0); ctx.fillStyle = '#fff'; ctx.fill(); }   // trhač králů: znak
    }
  };
  // Pasti na cestě (z kladeče)
  TDS.kladec_pastiExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || {};
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (kind === 'spike') {
      softShadow(ctx, 0, 0, 11, 7);
      roundRect(ctx, -11, -7, 22, 14, 2); paint(ctx, '#8b5a2b', 1.6);
      line(ctx, -11, 0, 11, 0); strokeA(ctx, '#5a3a1e', 0.9, 0.8);
      ctx.strokeStyle = OUT; ctx.lineWidth = 0.9;
      for (const [px, py] of [[-6, -2], [0, -2], [6, -2], [-3, 4], [3, 4]]) { spike(ctx, px, py, 3.6, '#d1d5db'); ctx.stroke(); }
    } else if (kind === 'jaw') {
      line(ctx, 8, 6, 15, 3); ctx.save(); ctx.setLineDash([2, 2]); strokeA(ctx, '#44403c', 1.6, 1); ctx.restore();
      circlePath(ctx, 0, 0, 5); paint(ctx, '#57534e', 1.4); circlePath(ctx, 0, 0, 2); paint(ctx, '#a8a29e', 0.8);
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.arc(0, sd * 2, 10.5, sd > 0 ? 0.15 : PI + 0.15, sd > 0 ? PI - 0.15 : TAU - 0.15); strokeOutlined(ctx, 2.2, '#78716c');
        for (let i = 1; i < 6; i++) { const an = (sd > 0 ? 0 : PI) + i * PI / 6, cx = Math.cos(an), cy = Math.sin(an); polyPath(ctx, [[cx * 9.5, sd * 2 + cy * 9.5], [cx * 6.4 - cy * 1.5, sd * 2 + cy * 6.4 + cx * 1.5], [cx * 6.4 + cy * 1.5, sd * 2 + cy * 6.4 - cx * 1.5]]); paint(ctx, '#f5f5f4', 0.7); }
      }
    } else if (kind === 'mine') {
      ellipsePath(ctx, 0, 1, 11, 8); paint(ctx, '#7c4a21', 0);
      for (const [px, py] of [[-8, -3], [7, -5], [9, 4], [-6, 6]]) { circlePath(ctx, px, py, 1.6); ctx.fillStyle = '#a16207'; ctx.fill(); }
      circlePath(ctx, 0, 0, 7); paint(ctx, '#3f3f46', 1.5); circlePath(ctx, 0, 0, 4.6); strokeA(ctx, '#71717a', 1, 1);
      for (let i = 0; i < 4; i++) { const an = i * PI / 2 + PI / 4; rivet(ctx, Math.cos(an) * 5.6, Math.sin(an) * 5.6, 0.8, '#a1a1aa'); }
      const blink = Math.floor(ts / 300) % 2; if (blink) glow(ctx, 0, 0, 5, '#ef4444', 0.8);
      circlePath(ctx, 0, 0, 2.2); paint(ctx, blink ? '#ef4444' : '#7f1d1d', 0.8);
    } else if (kind === 'crystal') {
      glow(ctx, 0, 0, 14, '#38bdf8', 0.5 + Math.sin(ts / 200) * 0.15);
      for (const [px, py, h, a2] of [[-5, 2, 9, -0.35], [0, 0, 12, 0], [5, 2, 8, 0.4]]) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(a2);
        polyPath(ctx, [[-2.8, 3], [-2.8, -h + 3], [0, -h], [2.8, -h + 3], [2.8, 3]]); paint(ctx, '#7dd3fc', 1.1);
        polyPath(ctx, [[-2.8, 3], [-2.8, -h + 3], [0, -h], [0, 3]]); fillA(ctx, '#fff', 0.45);
        ctx.restore();
      }
    }
    // opotřebení pasti: tenký ukazatel zbývající výdrže
    if (s.hp != null && kind !== 'crystal' && s.fill > 0) { roundRect(ctx, -8, 10, 16, 3, 1); paint(ctx, '#3f3f46', 0.8); roundRect(ctx, -8, 10, 16 * Math.max(0, 1 - s.fill), 3, 1); ctx.fillStyle = '#facc15'; ctx.fill(); }
    ctx.restore();
  };

  /* =========================== LESNÍ DRUID =========================== */
  // P1 bouře (hrom, vichřice, posel bouře), P2 houští (dubové srdce, šlahouny, duch hvozdu), P3 šelma (medvědí zuřivost → vtělení)
  TDS.drawers.lesni_druid = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), R = makeRng(91);
      softShadow(ctx, 0, 0, 20, 20);
      if (m.p === 0 && m.t >= 4) for (let i = 0; i < 3; i++) {   // bouřkové obláčky s bleskem
        const an = i * 2.1 + 0.5, cx = Math.cos(an) * 21, cy = Math.sin(an) * 21;
        lightning(ctx, cx, cy + 2, cx + 3, cy + 9, 911 + i, '#fde047', 0.9);
        for (const [dx, dy, r] of [[-3.5, 0.5, 3.2], [0, -1.2, 4], [3.6, 0.6, 3]]) { circlePath(ctx, cx + dx, cy + dy, r); paint(ctx, '#94a3b8', 1.1); }
        for (const [dx, dy, r] of [[-3.5, 0.5, 3.2], [0, -1.2, 4], [3.6, 0.6, 3]]) { circlePath(ctx, cx + dx, cy + dy, r - 0.7); ctx.fillStyle = '#cbd5e1'; ctx.fill(); }
        circlePath(ctx, cx - 1, cy - 2.4, 1.6); fillA(ctx, '#fff', 0.6);
      }
      if (b >= 1) for (let i = 0; i < 10; i++) { const an = i / 10 * TAU; ctx.beginPath(); ctx.arc(Math.cos(an) * 19, Math.sin(an) * 19, 3.6, an + PI * 0.5, an + PI * 1.5); strokeOutlined(ctx, 1.2, '#166534'); spike(ctx, Math.cos(an) * 22, Math.sin(an) * 22, 1.4, '#86efac'); }   // trnité houští
      // kamenný kruh s mechem a pařezem uprostřed
      stoneRing(ctx, 18, '#8a9a7a', 13, 93);
      circlePath(ctx, 0, 0, 13); paint(ctx, m.p === 1 && m.t >= 5 ? '#3f6212' : '#4d7c2f', 1.4);
      for (let i = 0; i < 6; i++) { const an = R() * TAU, d = 5 + R() * 6; ellipsePath(ctx, Math.cos(an) * d, Math.sin(an) * d, 2.4, 1.4, an); fillA(ctx, '#86efac', 0.5); }
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; ellipsePath(ctx, Math.cos(an) * 15.5, Math.sin(an) * 15.5, 3, 2, an); paint(ctx, '#5f9e3a', 0.9); }   // mech na kamenech
      if (b >= 2) { circlePath(ctx, 10, 10, 3.4); paint(ctx, '#8b5a2b', 1.1); circlePath(ctx, 10, 10, 1.8); strokeA(ctx, '#d6b98c', 0.8, 1); }   // dubové srdce (pařez)
      if (m.p === 1 && m.t >= 4) for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + 0.5; circlePath(ctx, Math.cos(an) * 10, Math.sin(an) * 10, 1.8); paint(ctx, ['#ef4444', '#f97316', '#facc15', '#a855f7', '#ef4444'][i], 0.8); }   // dar úrody
      if (c >= 4) for (const [x, y] of [[-13, 12], [13, -12]]) { ellipsePath(ctx, x, y, 3.4, 2.6); paint(ctx, '#57534e', 1); polyPath(ctx, [[x + 2.4, y - 2.2], [x + 3.4, y - 3.6], [x + 3.8, y - 1.8]]); paint(ctx, '#57534e', 0.7); }   // vlci smečky
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 15);
      ctx.scale(1.3, 1.3);
      const bear = m.p === 2 && m.t >= 3, ancient = m.p === 2 && m.t >= 5, spirit = m.p === 1 && m.t >= 5, storm = m.p === 0 && m.t >= 3;
      if (bear) {   // medvědí podoba (vtělení prastaré šelmy je větší a zářící)
        const k = ancient ? 1.25 : 1, fur = ancient ? '#3f2a14' : '#6b4320';
        if (ancient) glow(ctx, 0, 0, 13, '#86efac', 0.6);
        for (const sd of [-1, 1]) { ellipsePath(ctx, 5 * k, sd * 6 * k, 3.2 * k, 2.6 * k); paint(ctx, fur, 1.3); for (let i = -1; i <= 1; i++) { line(ctx, 7.5 * k, sd * 6 * k + i * 1.2, 9.5 * k, sd * 6.3 * k + i * 1.4); strokeA(ctx, '#f5f5f4', 0.9, 1); } }
        ellipsePath(ctx, -2 * k, 0, 8 * k, 7 * k); paint(ctx, fur, 1.8);
        ctx.save(); ellipsePath(ctx, -2 * k, 0, 8 * k, 7 * k); ctx.clip(); ellipsePath(ctx, 1, 3, 8 * k, 6 * k); fillA(ctx, '#000', 0.2); ctx.restore();
        circlePath(ctx, 4 * k, 0, 4.4 * k); paint(ctx, shade(fur, 0.12), 1.5);
        for (const sd of [-1, 1]) { circlePath(ctx, 2.6 * k, sd * 3.6 * k, 1.4 * k); paint(ctx, fur, 1); }   // uši
        ellipsePath(ctx, 7.2 * k, 0, 1.8 * k, 1.6 * k); paint(ctx, '#d6b98c', 0.8); circlePath(ctx, 8.2 * k, 0, 0.7 * k); ctx.fillStyle = OUT; ctx.fill();
        for (const sd of [-1, 1]) { circlePath(ctx, 5.4 * k, sd * 1.6 * k, 0.7 * k); ctx.fillStyle = ancient ? '#86efac' : OUT; ctx.fill(); }
        if (ancient) for (let i = 0; i < 3; i++) leaf(ctx, -4 - i * 2.5, (i - 1) * 3, 4, 1.6, PI, '#4ade80');
        return;
      }
      const robe = spirit ? '#14532d' : storm ? '#334155' : '#15803d';
      ctx.beginPath(); ctx.moveTo(-1, -6.5); ctx.quadraticCurveTo(-11, -8, -12.5, 0); ctx.quadraticCurveTo(-11, 8, -1, 6.5); ctx.closePath(); paint(ctx, shade(robe, -0.15), 1.5);
      for (let i = 0; i < 4; i++) leaf(ctx, -5 - i * 2, (i % 2 ? -1 : 1) * 4, 4, 1.6, PI + (i % 2 ? 0.4 : -0.4), '#4ade80');   // listy na plášti
      arm(ctx, -0.5, -5.5, 6.5, -4.6, robe);
      // hůl s parožím
      line(ctx, -6, 6.5, 12, 5); strokeOutlined(ctx, 1.6, '#6b4320');
      for (const sd of [-1, 1]) { line(ctx, 12, 5, 15, 5 + sd * 3); strokeOutlined(ctx, 0.9, '#d6b98c'); line(ctx, 13.5, 5 + sd * 1.5, 14, 5 + sd * 4.2); strokeOutlined(ctx, 0.7, '#d6b98c'); }
      if (a >= 2 || storm) { glow(ctx, 13, 5, 5 + f * 3, '#fde047', 0.8); lightning(ctx, 11, 3, 15, 7, 31, '#fde047', 0.8); }
      else { circlePath(ctx, 13, 5, 2); paint(ctx, '#86efac', 0.9); }
      arm(ctx, -0.5, 5.5, 6, 6, robe);
      if (m.p === 0 && m.t >= 3) { ctx.beginPath(); ctx.arc(7, -5, 3.6, 0, PI * 1.5); strokeA(ctx, '#e2e8f0', 1.4, 0.9); }   // vír v dlani
      figure(ctx, robe, '#f1c08f', { rx: 5.6, ry: 7.2, hr: 3.8, trim: spirit ? '#bef264' : '#86efac' });
      // kápě s parožím
      ellipsePath(ctx, -0.3, 0, 5, 4.8); paint(ctx, shade(robe, 0.1), 1.3);
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-1, sd * 3); ctx.quadraticCurveTo(-3, sd * 7, -6.5, sd * 8); strokeOutlined(ctx, 1, '#e7d7b5'); line(ctx, -3.2, sd * 6.2, -1.5, sd * 8.5); strokeOutlined(ctx, 0.8, '#e7d7b5'); }
      if (spirit) glow(ctx, 0, 0, 10, '#bef264', 0.5);
    }
  };
  // Tornádo, kulový blesk a úponky druida
  TDS.lesni_druidExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || {};
    const t = ts / 1000;
    ctx.save(); ctx.translate(x, y);
    if (kind === 'tornado') {
      ellipsePath(ctx, 2, 7, 15, 5); fillA(ctx, '#000', 0.18);
      for (let i = 0; i < 5; i++) {
        const yy = 5 - i * 6, w = 6 + i * 3.4, sw = Math.sin(t * 11 + i) * 2.6;
        ellipsePath(ctx, sw, yy, w, w * 0.34); paint(ctx, i % 2 ? '#e2e8f0' : '#cbd5e1', 1.3);
        ctx.beginPath(); ctx.ellipse(sw, yy, w * 0.7, w * 0.22, 0, t * 6 + i, t * 6 + i + 2.4); strokeA(ctx, '#fff', 1.2, 0.9);
      }
      for (let i = 0; i < 4; i++) { const a2 = t * 9 + i * 1.6; leaf(ctx, Math.cos(a2) * 14, -10 + Math.sin(a2) * 4, 4, 1.6, a2, i % 2 ? '#4ade80' : '#a3e635'); }
    } else if (kind === 'ball') {
      const r = s.r || 60;
      ctx.save(); ctx.setLineDash([6, 7]); ctx.beginPath(); ctx.arc(0, 0, r, t * 0.6, t * 0.6 + TAU); strokeA(ctx, '#93c5fd', 1.6, 0.6); ctx.restore();
      circlePath(ctx, 0, 0, r); fillA(ctx, '#bfdbfe', 0.1);
      const R = 9 + Math.sin(t * 16) * 1.5;
      glow(ctx, 0, 0, R * 2.2, '#60a5fa', 0.9);
      circlePath(ctx, 0, 0, R); paint(ctx, '#3b82f6', 1.6);
      circlePath(ctx, -2.5, -2.5, R * 0.45); ctx.fillStyle = '#eff6ff'; ctx.fill();
      const Rn = makeRng(((t * 20) | 0) + 3);
      for (let i = 0; i < 4; i++) { const a2 = Rn() * TAU, l = R + 6 + Rn() * 10; lightning(ctx, Math.cos(a2) * R, Math.sin(a2) * R, Math.cos(a2) * l, Math.sin(a2) * l, ((t * 20) | 0) + i, '#fde047', 0.9); }
    } else if (kind === 'vine') {
      for (let i = 0; i < 3; i++) { const a2 = i * 2.1 + Math.sin(t * 2) * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a2) * 16, Math.sin(a2) * 16 + 6); ctx.bezierCurveTo(Math.cos(a2 + 1) * 17, Math.sin(a2 + 1) * 13, Math.cos(a2 + 2) * 10, Math.sin(a2 + 2) * 10, Math.cos(a2 + 2.6) * 12, Math.sin(a2 + 2.6) * 12); strokeOutlined(ctx, 2.4, '#15803d'); }
      for (let i = 0; i < 5; i++) { const a2 = i * 1.26 + 0.5; leaf(ctx, Math.cos(a2) * 12, Math.sin(a2) * 12, 5, 2, a2 + 0.8, '#4ade80'); }
      for (let i = 0; i < 4; i++) { const a2 = i * 1.57 + 0.2; spike(ctx, Math.cos(a2) * 15, Math.sin(a2) * 15, 1.4, '#86efac'); }
      circlePath(ctx, -10, -9, 2.2); paint(ctx, '#f472b6', 0.8); circlePath(ctx, -10, -9, 0.8); ctx.fillStyle = '#fde047'; ctx.fill();
    }
    ctx.restore();
  };

  /* =========================== STÍNOVÝ ZVĚD =========================== */
  // P1 čepele (dvojitý hod, pět čepelí, velmistr), P2 sabotáž (prach, kouř, škola stínů), P3 demolice (ježky, bomby, nálože)
  TDS.drawers.stinovy_zved = {
    base: function (ctx, up) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up);
      softShadow(ctx, 0, 0, 18, 18);
      if (b >= 2) for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + 0.4; circlePath(ctx, Math.cos(an) * 18, Math.sin(an) * 18, 5); fillA(ctx, '#64748b', 0.45); }   // kouřová clona
      regPoly(ctx, 0, 0, 18.5, 6, 0); paint(ctx, m.p === 1 && m.t >= 5 ? '#1e1b4b' : '#3f3f46', 2.2);   // tmavá šestiúhelníková plošina
      regPoly(ctx, 0, 0, 14, 6, 0); paint(ctx, '#27272a', 1.4);
      ctx.save(); regPoly(ctx, 0, 0, 14, 6, 0); ctx.clip(); for (let i = -14; i < 14; i += 4) { line(ctx, i, -14, i + 8, 14); strokeA(ctx, '#3f3f46', 1, 1); } ctx.restore();
      for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; rivet(ctx, Math.cos(an) * 16.3, Math.sin(an) * 16.3, 1.1, m.t >= 5 ? '#a78bfa' : '#71717a'); }
      if (c >= 2) for (let i = 0; i < 3; i++) { const x = 10 + (i % 2) * 2.5, y = 9 + i * 2.2; regPoly(ctx, x, y, 1.6, 4, i); paint(ctx, '#52525b', 0.7); }   // železné ježky
      if (c >= 3) { circlePath(ctx, -10, 10, 3); paint(ctx, '#f8fafc', 1.1); starPath(ctx, -10, 10, 1.8, 0.7, 4, 0); ctx.fillStyle = '#facc15'; ctx.fill(); }   // oslepující bomba
      if (c >= 4) { roundRect(ctx, -13, -13, 7, 5, 1); paint(ctx, '#b91c1c', 1); line(ctx, -9.5, -13, -9.5, -15.5); strokeA(ctx, '#d6b98c', 0.8, 1); }   // nálož
      if (m.p === 1 && m.t >= 3) { rune(ctx, 10, -10, 5, '#a78bfa', 99); }   // znak školy stínů
    },
    turret: function (ctx, up, s) {
      const a = lv(up, 0), b = lv(up, 1), c = lv(up, 2), m = mainPath(up), f = s.firing || 0;
      if (s.buffed) buffAura(ctx, 14);
      ctx.scale(1.3, 1.3);
      const grand = m.p === 0 && m.t >= 5, lord = m.p === 1 && m.t >= 5, demo = m.p === 2 && m.t >= 5;
      const suit = lord ? '#1e1b4b' : grand ? '#18181b' : '#27272a', scarf = grand ? '#7c3aed' : lord ? '#4c1d95' : demo ? '#b91c1c' : '#dc2626';
      if (grand) glow(ctx, 0, 0, 11, '#7c3aed', 0.45);
      // šála vlaje dozadu
      ctx.beginPath(); ctx.moveTo(-1, -1.5); ctx.quadraticCurveTo(-8, -3, -12, 1); ctx.lineTo(-11, 3); ctx.quadraticCurveTo(-7, 0, -1, 1.5); ctx.closePath(); paint(ctx, scarf, 1.1);
      arm(ctx, -0.5, -5, 6.5, -4.5, suit);
      arm(ctx, -0.5, 5, 6.5, 4.5, suit);
      const n = m.p === 0 ? (a >= 4 ? 5 : a >= 3 ? 2 : 1) : 1;
      if (f < 0.5) for (let i = 0; i < Math.min(n, 3); i++) for (const sd of (n >= 2 ? [-1, 1] : [1])) { ctx.save(); ctx.translate(8.5 + i * 1.2, sd * 4.5); ctx.rotate(i * 0.4); starPath(ctx, 0, 0, 3, 1, 4, 0); paint(ctx, grand ? '#a78bfa' : '#94a3b8', 0.8); ctx.restore(); }   // shurikeny v rukou
      if (demo) { circlePath(ctx, 7.5, 0, 2.6); paint(ctx, '#1f2937', 1); starPath(ctx, 7.5, -3, 1.4, 0.6, 4, 0); ctx.fillStyle = '#fb923c'; ctx.fill(); }
      figure(ctx, suit, '#1f1f23', { rx: 5.4, ry: 7, hr: 3.8 });
      ctx.beginPath(); ctx.ellipse(0.6, 0, 3.8, 3.8, 0, -PI * 0.35, PI * 0.35); strokeA(ctx, scarf, 1.6, 1);   // čelenka
      roundRect(ctx, 2.2, -2.2, 1.6, 4.4, 0.7); ctx.fillStyle = '#f1c08f'; ctx.fill();   // průzor pro oči
      for (const sd of [-1, 1]) { circlePath(ctx, 3, sd * 1.1, 0.55); ctx.fillStyle = grand || lord ? '#c4b5fd' : OUT; ctx.fill(); }
      if (b >= 1 && !lord) { circlePath(ctx, -4, 5, 1.8); paint(ctx, '#a78bfa', 0.8); }   // váček s omamným prachem
      if (lord) for (let i = 0; i < 3; i++) { circlePath(ctx, -6 - i * 2.5, (i - 1) * 3, 2.6); fillA(ctx, '#6d28d9', 0.4); }
    }
  };
  // Železné ježky a přísavná nálož zvěda
  TDS.stinovy_zvedExtra = function (ctx, kind, x, y, ang, ts, s) {
    s = s || {};
    ctx.save(); ctx.translate(x, y);
    if (kind === 'caltrop') {
      for (const [px, py, a2] of [[-7, -3, 0.3], [5, -5, 1.1], [1, 5, 2.2], [9, 4, 0.7], [-4, 6, 1.8]]) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(a2);
        for (let i = 0; i < 4; i++) { ctx.rotate(PI / 2); polyPath(ctx, [[0, -4.6], [1.5, 0], [-1.5, 0]]); paint(ctx, '#52525b', 0.8); }
        circlePath(ctx, 0, 0, 1.3); paint(ctx, '#a1a1aa', 0.6);
        ctx.restore();
      }
    } else if (kind === 'sticky') {
      const left = s.left == null ? 1 : Math.max(0, s.left), fast = left < 0.7;
      ctx.translate(8, -8);
      ctx.beginPath(); ctx.arc(0, 0, 9, -PI / 2, -PI / 2 + TAU * Math.min(1, left / 2)); strokeOutlined(ctx, 1.6, '#ef4444');
      circlePath(ctx, 0, 0, 5.8); paint(ctx, '#1f2937', 1.4);
      roundRect(ctx, -6, -1.3, 12, 2.6, 0.8); paint(ctx, '#a3e635', 0.8);   // lepicí páska
      const on = Math.floor(ts / (fast ? 60 : 150)) % 2;
      if (on) glow(ctx, 0, -3, 4, '#ef4444', 0.9);
      circlePath(ctx, 0, -3, 1.6); paint(ctx, on ? '#ef4444' : '#7f1d1d', 0.7);
      gloss(ctx, -2, -2, 1.6, 0.9, -0.5, 0.4);
    }
    ctx.restore();
  };
  /* =========================== ZÓNY, SPOJENCI, FÉNIX =========================== */
  // Plošné zóny na cestě: fire (ohnivá stěna / louže ohně), acid (louže kyseliny / šlahouny), storm (bouře Radky); a = 0–1 doznívání
  TDS.zone = function (ctx, kind, x, y, r, ts, a) {
    const t = ts / 1000;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y);
    if (kind === 'fire') {
      ellipsePath(ctx, 0, 0, r, r * 0.7); fillA(ctx, '#7c2d12', 0.35);
      for (let i = 0; i < 7; i++) {
        const an = i / 7 * TAU + 0.3, d = r * 0.55, px = Math.cos(an) * d, py = Math.sin(an) * d * 0.65, h = 9 + Math.sin(t * 9 + i * 1.7) * 3;
        ctx.save(); ctx.translate(px, py); ctx.rotate(-PI / 2); flame3(ctx, h, 4.2); ctx.restore();
      }
      ctx.save(); ctx.rotate(-PI / 2); flame3(ctx, 13 + Math.sin(t * 8) * 3, 6); ctx.restore();
    } else if (kind === 'acid') {
      const R = makeRng(((x * 7) ^ (y * 13)) >>> 0);
      ctx.beginPath(); for (let i = 0; i < 14; i++) { const an = i / 14 * TAU, q = r * (0.85 + R() * 0.2); if (i) ctx.lineTo(Math.cos(an) * q, Math.sin(an) * q * 0.7); else ctx.moveTo(Math.cos(an) * q, Math.sin(an) * q * 0.7); } ctx.closePath();
      paint(ctx, '#65a30d', 1.6); ctx.save(); ctx.clip(); ellipsePath(ctx, -r * 0.25, -r * 0.2, r * 0.5, r * 0.22, -0.3); fillA(ctx, '#d9f99d', 0.55); ctx.restore();
      for (let i = 0; i < 4; i++) { const ph = (t * 0.8 + i * 0.27) % 1, bx = (R() - 0.5) * r * 1.2, by = (R() - 0.5) * r * 0.7; circlePath(ctx, bx, by, 1.5 + ph * 2.6); ctx.save(); ctx.globalAlpha *= 1 - ph; paint(ctx, '#bef264', 0.8); ctx.restore(); }
    } else if (kind === 'storm') {
      circlePath(ctx, 0, 0, r); fillA(ctx, '#7c3aed', 0.12);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.4 + i * 0.25), t * (1 + i), t * (1 + i) + 2); strokeA(ctx, '#a78bfa', 3, 0.6); }
      for (let i = 0; i < 3; i++) { const an = t * 2.5 + i * 2.1, d = r * 0.6; lightning(ctx, Math.cos(an) * d * 0.3, Math.sin(an) * d * 0.3, Math.cos(an) * d, Math.sin(an) * d, ((t * 12) | 0) + i, '#c4b5fd', 1); }
      for (const [dx, dy, cr] of [[-6, -2, 6], [0, -5, 7.5], [6, -2, 6]]) { circlePath(ctx, dx, dy, cr); paint(ctx, '#64748b', 1.2); }
      for (const [dx, dy, cr] of [[-6, -2, 6], [0, -5, 7.5], [6, -2, 6]]) { circlePath(ctx, dx, dy, cr - 0.8); ctx.fillStyle = '#94a3b8'; ctx.fill(); }
    }
    ctx.restore();
  };
  // Zombie nekromanta (big = obr na bosse), jdou proti slizákům
  TDS.ally = function (ctx, big, x, y, ang, ts) {
    const t = ts / 1000, k = big ? 1.6 : 1, step = Math.sin(t * 9 + x * 0.1) * 0.35;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    softShadow(ctx, 0, 0, 5, 4.5);
    for (const sd of [-1, 1]) { line(ctx, -1, sd * 3.6, 5 + step * sd * 2, sd * 4.2); strokeOutlined(ctx, 1.8, '#5f7f4a'); circlePath(ctx, 5.5 + step * sd * 2, sd * 4.2, 1.4); paint(ctx, '#86a86b', 0.8); }   // natažené ruce
    ellipsePath(ctx, -1, 0, 4, 5); paint(ctx, big ? '#3f3f46' : '#57534e', 1.4);   // roztrhaný kabát
    polyPath(ctx, [[-4.5, -2], [-6, -1], [-4.6, 0], [-6.2, 1.4], [-4.4, 2.4]]); paint(ctx, big ? '#3f3f46' : '#57534e', 0.8);
    circlePath(ctx, 1.2, 0, 3.2); paint(ctx, '#86a86b', 1.2);   // hlava
    for (const sd of [-1, 1]) { circlePath(ctx, 2.8, sd * 1.2, 0.7); ctx.fillStyle = '#d9f99d'; ctx.fill(); }
    if (big) { circlePath(ctx, 0.6, 0, 2.2); strokeA(ctx, '#f5f5f4', 0.8, 0.7); }
    ctx.restore();
  };
  // Fénix krouží nad čarodějem (dir = směr letu)
  TDS.phoenix = function (ctx, x, y, ts, dir) {
    const t = ts / 1000, flap = Math.sin(t * 12) * 0.35;
    ctx.save(); ctx.translate(x, y);
    glow(ctx, 0, 0, 30, '#fb923c', 0.7);
    ctx.rotate(dir || 0);
    for (const sd of [-1, 1]) {   // ohnivá křídla
      ctx.save(); ctx.rotate(sd * (0.2 + flap));
      ctx.beginPath(); ctx.moveTo(2, sd * 3); ctx.quadraticCurveTo(4, sd * 18, -10, sd * 28); ctx.quadraticCurveTo(-8, sd * 16, -12, sd * 8); ctx.quadraticCurveTo(-6, sd * 5, -4, sd * 3); ctx.closePath(); paint(ctx, '#ea580c', 1.5);
      ctx.beginPath(); ctx.moveTo(1, sd * 4); ctx.quadraticCurveTo(1, sd * 14, -7, sd * 21); ctx.quadraticCurveTo(-5, sd * 12, -8, sd * 7); ctx.closePath(); ctx.fillStyle = '#fb923c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, sd * 5); ctx.quadraticCurveTo(-1, sd * 11, -4, sd * 14); strokeA(ctx, '#fde047', 1.6, 1);
      ctx.restore();
    }
    for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(-8, i * 2.5); ctx.rotate(PI + i * 0.3); flame3(ctx, 12 + Math.sin(t * 10 + i) * 2, 3.4); ctx.restore(); }   // ohnivý ocas
    ellipsePath(ctx, -1, 0, 7, 4.6); paint(ctx, '#f97316', 1.5);
    circlePath(ctx, 6, 0, 3.6); paint(ctx, '#fb923c', 1.3);
    polyPath(ctx, [[9, -1.3], [12.5, 0], [9, 1.3]]); paint(ctx, '#fde047', 0.9);
    for (const sd of [-1, 1]) { circlePath(ctx, 7, sd * 1.5, 0.8); ctx.fillStyle = '#111'; ctx.fill(); }
    ctx.save(); ctx.translate(4, 0); ctx.rotate(PI); for (let i = -1; i <= 1; i++) { ctx.save(); ctx.rotate(i * 0.35); ctx.translate(3, 0); ctx.rotate(PI); flame3(ctx, -6, 2); ctx.restore(); } ctx.restore();   // chocholka
    ctx.restore();
  };
})();

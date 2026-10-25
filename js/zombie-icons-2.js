/* zombie-icons-2.js — ikony rozhraní Zombie Survival v .io stylu (lišta staveb, obchod, výběr postavy, HUD, schopnosti).
 * Věci ze hry (postavy, zbraně, stavby, voda/proud/farma, základna) se kreslí přímo herními kresbami .io stylu
 * (zombie-tex.js + zombie-tex-2.js), takže ikona vypadá stejně jako na mapě. Ostatní (statistiky, schopnosti,
 * mince, hlad…) jsou nakreslené tady ve stejném rukopisu: ploché barvy, stín po stupních, tlustý tmavý obrys.
 * Kreslí se do plátna a vrací jako <img> (data: URL, jednou na název a velikost). Při grafice od Gemini
 * (zs_tex = '0') zůstávají původní SVG ikony. */
(function () {
  'use strict';
  const ZSI = window.ZSI, IO = window.ZSIO, ZS = window.ZS;
  if (!ZSI || !IO || !ZS) return;
  const { orb, blob, box, poly, line, tint, OUT, SKIN, TAU, wSpr, on } = IO;
  const o = 1.5;   // obrys v jednotkách 24×24

  // tvar s posterizovaným stínem (tmavší celek, světlejší posunutý dovnitř) + obrys
  function shape(c, path, col, lw = o) {
    c.fillStyle = tint(col, -0.3); path(); c.fill();
    c.save(); path(); c.clip(); c.translate(-0.9, -1.1); c.fillStyle = col; path(); c.fill(); c.restore();
    if (lw) { c.strokeStyle = OUT; c.lineWidth = lw; path(); c.stroke(); }
  }
  const heartPath = (c, x, y, s) => () => { c.beginPath(); c.moveTo(x, y + s * 0.85); c.bezierCurveTo(x - s * 1.35, y, x - s * 0.7, y - s * 1.0, x, y - s * 0.32); c.bezierCurveTo(x + s * 0.7, y - s * 1.0, x + s * 1.35, y, x, y + s * 0.85); c.closePath(); };
  const starPts = (x, y, r1, r2, n = 5, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
  const plus = (c, x, y, s, col) => { box(c, x - s, y - s * 0.34, s * 2, s * 0.68, s * 0.2, col, o, false); box(c, x - s * 0.34, y - s, s * 0.68, s * 2, s * 0.2, col, o, false); };
  const bolt = (c, x, y, s, col) => poly(c, [[x + s * 0.15, y - s], [x - s * 0.55, y + s * 0.1], [x - s * 0.05, y + s * 0.1], [x - s * 0.2, y + s], [x + s * 0.55, y - s * 0.15], [x + s * 0.05, y - s * 0.15]], col, o);
  const arrow = (c, x1, y1, x2, y2, col = '#d6b38a', head = '#cbd5e1') => { line(c, [[x1, y1], [x2, y2]], col, 1.6, 0.9); const a = Math.atan2(y2 - y1, x2 - x1); poly(c, [[x2 + Math.cos(a) * 3, y2 + Math.sin(a) * 3], [x2 + Math.cos(a + 2.4) * 3, y2 + Math.sin(a + 2.4) * 3], [x2 + Math.cos(a - 2.4) * 3, y2 + Math.sin(a - 2.4) * 3]], head, 1); };
  const swirl = (c, col) => { c.lineCap = 'round'; for (const [r, w] of [[8.5, 3.4], [5, 2.6]]) { c.strokeStyle = OUT; c.lineWidth = w + 2; c.beginPath(); c.arc(12, 12, r, 0.3, 4.6); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); } orb(c, 12, 12, 2, '#f5f3ff', 1, false); };
  const flame = (c, x, y, s, col = '#f97316', in2 = '#fde047') => { const p = () => { c.beginPath(); c.moveTo(x, y - s); c.bezierCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.8, y + s * 0.9, x, y + s * 0.9); c.bezierCurveTo(x - s * 0.8, y + s * 0.9, x - s * 0.9, y - s * 0.1, x - s * 0.15, y - s * 0.45); c.closePath(); }; shape(c, p, col); c.fillStyle = in2; c.beginPath(); c.ellipse(x, y + s * 0.35, s * 0.32, s * 0.45, 0, 0, TAU); c.fill(); };
  const shield = (c, col, inner) => { const p = () => { c.beginPath(); c.moveTo(12, 2.5); c.lineTo(20, 5.5); c.quadraticCurveTo(20, 16, 12, 21.5); c.quadraticCurveTo(4, 16, 4, 5.5); c.closePath(); }; shape(c, p, col); if (inner) inner(); };
  const skull = (c, col = '#f5f0e1', eye = '#141814') => { orb(c, 12, 10.5, 7.5, col, o); box(c, 8.5, 14.5, 7, 5, 1.5, col, o); c.fillStyle = eye; for (const x of [9, 15]) { c.beginPath(); c.arc(x, 10.5, 2.1, 0, TAU); c.fill(); } c.fillRect(11.4, 13, 1.2, 2.2); for (const x of [10, 12, 14]) c.fillRect(x - 0.4, 16.5, 0.8, 2.5); };

  // ── ikony kreslené tady ──
  const I = {
    hp(c) { shape(c, heartPath(c, 12, 12.5, 8.5), '#ef4444'); },
    maxhp(c) { shape(c, heartPath(c, 11, 13, 7.5), '#ef4444'); plus(c, 18, 6.5, 3.6, '#4ade80'); },
    xp(c) { poly(c, starPts(12, 12.5, 9.5, 4.3), '#facc15', o); poly(c, starPts(12, 12.5, 4.2, 2), '#fef08a', 0); },
    level(c) { shield(c, '#8b5cf6', () => { poly(c, [[12, 6.5], [17, 11.5], [14, 11.5], [14, 16.5], [10, 16.5], [10, 11.5], [7, 11.5]], '#f5f3ff', 1.2); }); },
    coins(c) { for (const [x, y] of [[9, 15], [15, 12], [10.5, 8.5]]) { orb(c, x, y, 5.5, '#f59e0b', o); c.strokeStyle = tint('#f59e0b', -0.35); c.lineWidth = 1; c.beginPath(); c.arc(x, y, 3.4, 0, TAU); c.stroke(); } },
    wave(c) { orb(c, 12, 12, 9, '#79a964', o); c.fillStyle = '#ef4444'; for (const x of [8.5, 15.5]) { c.beginPath(); c.arc(x, 10.5, 1.9, 0, TAU); c.fill(); } c.fillStyle = OUT; c.fillRect(8, 15.5, 8, 1.6); },
    time(c) { orb(c, 12, 12, 9.5, '#f8fafc', o, false); c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.moveTo(12, 12); c.lineTo(12, 6.5); c.moveTo(12, 12); c.lineTo(16, 13.5); c.stroke(); orb(c, 12, 12, 1.3, '#ef4444', 0, false); },
    cooldown(c) { poly(c, [[6, 3], [18, 3], [13.5, 12], [18, 21], [6, 21], [10.5, 12]], '#93c5fd', o); poly(c, [[8.5, 18.5], [15.5, 18.5], [12, 14]], '#f59e0b', 0); box(c, 5, 2, 14, 2.4, 1, '#8a5524', 1.2); box(c, 5, 19.6, 14, 2.4, 1, '#8a5524', 1.2); },
    hunger(c) { blob(c, 10, 10, 7, 5.5, '#c2410c', o, -0.7); line(c, [[14, 14], [19.5, 19.5]], '#f8fafc', 3, 1.2); orb(c, 20, 18.5, 1.8, '#f8fafc', 1.1, false); orb(c, 18.5, 20, 1.8, '#f8fafc', 1.1, false); },
    thirst(c) { shape(c, () => { c.beginPath(); c.moveTo(12, 2.5); c.bezierCurveTo(16, 8, 19, 11.5, 19, 15); c.arc(12, 15, 7, 0, Math.PI); c.bezierCurveTo(5, 11.5, 8, 8, 12, 2.5); c.closePath(); }, '#38bdf8'); },
    snack(c) { shape(c, () => { c.beginPath(); c.arc(9.5, 14, 6.5, 0, TAU); c.moveTo(21, 14); c.arc(14.5, 14, 6.5, 0, TAU); }, '#ef4444'); line(c, [[12, 8], [13, 4]], '#7c4a1e', 1.6, 0.8); blob(c, 15.5, 5.5, 2.6, 1.4, '#22c55e', 1, -0.5); },
    bottle(c) { box(c, 9.5, 2.5, 5, 3.5, 1, '#e5e7eb', 1.2); box(c, 7, 6, 10, 15.5, 3, '#7dd3fc', o); box(c, 7, 11, 10, 5, 0, '#0ea5e9', 1, false); },
    seed(c) { box(c, 6, 5, 12, 16, 3, '#d6b38a', o); line(c, [[6.5, 8], [17.5, 8]], '#8a5524', 1.6, 0); for (const [x, y] of [[10, 13], [14, 12], [12, 16.5]]) blob(c, x, y, 1.6, 2.4, '#65a30d', 1, 0.4); },
    lock(c) { c.strokeStyle = OUT; c.lineWidth = 4.6; c.beginPath(); c.arc(12, 9.5, 4.5, Math.PI, 0); c.stroke(); c.strokeStyle = '#9ca3af'; c.lineWidth = 2.4; c.stroke(); box(c, 5.5, 9.5, 13, 11, 2.5, '#f59e0b', o); orb(c, 12, 14, 1.6, OUT, 0, false); c.fillStyle = OUT; c.fillRect(11.4, 14, 1.2, 3.5); },
    power(c) { bolt(c, 12, 12, 9.5, '#facc15'); },
    warning(c) { poly(c, [[12, 2.5], [22, 20.5], [2, 20.5]], '#facc15', o); c.fillStyle = OUT; c.fillRect(11, 8.5, 2, 6.5); c.beginPath(); c.arc(12, 17.6, 1.3, 0, TAU); c.fill(); },
    // statistiky
    str(c) { box(c, 6, 9, 12, 9, 3.5, SKIN, o); for (let i = 0; i < 3; i++) line(c, [[9 + i * 3, 9.5], [9 + i * 3, 13]], tint(SKIN, -0.3), 1, 0); box(c, 3.5, 11.5, 4.5, 5.5, 2, SKIN, o); box(c, 7, 17, 10, 4, 1.5, '#ef4444', 1.2); },
    vit(c) { shape(c, heartPath(c, 12, 12.5, 8.5), '#22c55e'); line(c, [[5, 12], [9, 12], [10.5, 9], [13, 15.5], [14.5, 11.5], [19, 11.5]], '#f0fdf4', 1.4, 0.8); },
    agi(c) { box(c, 5, 10, 9, 10, 2.5, '#38bdf8', o); box(c, 5, 17, 14, 4, 2, '#0284c7', o); for (const [x, y, w] of [[14, 8, 7], [15, 11.5, 6], [16, 15, 4]]) line(c, [[x, y], [x + w, y - 2]], '#e0f2fe', 2, 0.8); },
    int(c) { box(c, 4, 5, 16, 15, 2, '#3b82f6', o); box(c, 6, 7, 12, 11, 1, '#eff6ff', 1, false); line(c, [[12, 7], [12, 18]], '#93c5fd', 1, 0); },
    int2(c) { box(c, 4, 6, 16, 15, 2, '#7c3aed', o); box(c, 6, 8, 12, 11, 1, '#f5f3ff', 1, false); poly(c, starPts(12, 13.5, 4, 1.8), '#facc15', 1); poly(c, starPts(19, 5, 3, 1.3), '#fde047', 1); },
    per(c) { shape(c, () => { c.beginPath(); c.moveTo(2.5, 12); c.quadraticCurveTo(12, 3, 21.5, 12); c.quadraticCurveTo(12, 21, 2.5, 12); c.closePath(); }, '#f8fafc'); orb(c, 12, 12, 4.3, '#0ea5e9', 1.2); orb(c, 12, 12, 1.8, OUT, 0, false); },
    // schopnosti
    slash(c) { c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.arc(4, 20, 15, -1.45, -0.2); c.stroke(); c.strokeStyle = '#e5e7eb'; c.lineWidth = 3.6; c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.beginPath(); c.arc(4, 20, 16.6, -1.35, -0.3); c.stroke(); },
    rage(c) { flame(c, 12, 12.5, 9.5, '#dc2626', '#fb923c'); c.fillStyle = OUT; c.fillRect(8.5, 13, 2.5, 1.4); c.fillRect(13, 13, 2.5, 1.4); },
    multishot(c) { arrow(c, 4, 20, 19, 5); arrow(c, 4, 20, 20, 12); arrow(c, 4, 20, 12, 3.5); },
    dodge(c) { c.lineCap = 'round'; for (const [y, w] of [[8, 13], [12.5, 16], [17, 11]]) line(c, [[20 - w, y], [20, y]], '#bae6fd', 2.4, 1); orb(c, 6, 12, 3.2, '#38bdf8', 1.2); },
    fireball(c) { poly(c, [[3, 21], [9, 11], [13, 15]], '#f97316', 1.2); poly(c, [[4.5, 19.5], [9.5, 13], [11.5, 15]], '#fde047', 0); orb(c, 14, 10, 6.5, '#fb923c', o); orb(c, 13, 9, 3, '#fde047', 0, false); },
    blink(c) { swirl(c, '#8b5cf6'); },
    nova(c) { poly(c, starPts(12, 12, 10.5, 4.5, 8), '#60a5fa', o); orb(c, 12, 12, 3.6, '#eff6ff', 1, false); },
    grenade(c) { orb(c, 12, 13.5, 7.5, '#4d5b33', o); box(c, 10, 3.5, 4, 3.5, 1, '#9ca3af', 1.2); c.strokeStyle = OUT; c.lineWidth = 1.4; c.beginPath(); c.arc(16.5, 5, 2.5, 0, TAU); c.stroke(); line(c, [[8, 12], [16, 12]], '#3f4a28', 1, 0); },
    suppression(c) { c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.arc(12, 12, 8, 0, TAU); c.stroke(); c.strokeStyle = '#ef4444'; c.lineWidth = 2.2; c.stroke(); line(c, [[12, 1.5], [12, 7]], '#ef4444', 2, 1); line(c, [[12, 17], [12, 22.5]], '#ef4444', 2, 1); line(c, [[1.5, 12], [7, 12]], '#ef4444', 2, 1); line(c, [[17, 12], [22.5, 12]], '#ef4444', 2, 1); orb(c, 12, 12, 1.8, '#fbbf24', 1, false); },
    taunt(c) { shape(c, () => { c.beginPath(); c.roundRect(3, 3.5, 18, 13, 4); c.moveTo(8, 16.5); c.lineTo(6, 21.5); c.lineTo(12, 16.5); }, '#f97316'); c.fillStyle = OUT; c.fillRect(11, 6, 2, 6); c.beginPath(); c.arc(12, 14, 1.2, 0, TAU); c.fill(); },
    fortify(c) { shield(c, '#3b82f6', () => line(c, [[12, 6], [12, 17]], '#bfdbfe', 2.4, 0)); },
    stealth(c) { shape(c, () => { c.beginPath(); c.moveTo(2.5, 12); c.quadraticCurveTo(12, 3, 21.5, 12); c.quadraticCurveTo(12, 21, 2.5, 12); c.closePath(); }, '#6d28d9'); orb(c, 12, 12, 3.4, '#ddd6fe', 1, false); line(c, [[4, 20], [20, 4]], '#f5f3ff', 2.2, 1.2); },
    backstab(c) { c.save(); c.translate(12, 12); c.rotate(-0.8); poly(c, [[-2, -2], [11, -1.2], [14, 0], [11, 1.2], [-2, 2]], '#e5e7eb', o); box(c, -4.5, -4.2, 2.6, 8.4, 1, '#a855f7', 1.2); box(c, -10, -1.6, 6, 3.2, 1.2, '#3b2a1a', 1.2); c.restore(); shape(c, () => { c.beginPath(); c.moveTo(18, 14); c.quadraticCurveTo(21.5, 19, 18, 21.5); c.quadraticCurveTo(14.5, 19, 18, 14); }, '#dc2626', 1.1); },
    deploy(c) { box(c, 4, 9, 16, 12, 2, '#a16207', o); line(c, [[4.5, 15], [19.5, 15]], '#713f12', 1.4, 0); poly(c, [[12, 1.5], [17, 6.5], [14, 6.5], [14, 10], [10, 10], [10, 6.5], [7, 6.5]], '#4ade80', 1.2); },
    repair(c) { c.save(); c.translate(11, 13); c.rotate(-0.75); c.scale(0.42, 0.42); c.drawImage(wSpr('wrench', '#0ea5e9'), -50 - 8, -20); c.restore(); plus(c, 18.5, 6, 3.4, '#4ade80'); },
    heal(c) { plus(c, 12, 12, 9, '#22c55e'); },
    bless(c) { c.strokeStyle = OUT; c.lineWidth = 4.4; c.beginPath(); c.ellipse(12, 7, 7.5, 2.8, 0, 0, TAU); c.stroke(); c.strokeStyle = '#facc15'; c.lineWidth = 2.4; c.stroke(); for (const [x, y, r] of [[7, 16, 3.4], [16.5, 14, 2.6], [12, 20, 2]]) poly(c, starPts(x, y, r, r * 0.4, 4, 0), '#fde047', 1); },
    // ultimátky
    ult_war_a(c) { skull(c, '#fecaca', '#7f1d1d'); flame(c, 4.5, 6, 3.5, '#dc2626', '#fb923c'); flame(c, 19.5, 6, 3.5, '#dc2626', '#fb923c'); },
    ult_war_b(c) { shield(c, '#9ca3af', () => poly(c, starPts(12, 11.5, 5, 2.2), '#fde047', 1.1)); },
    ult_arc_a(c) { for (const [x, y] of [[20, 4], [21, 9], [18, 2.5], [21.5, 14], [14.5, 2]]) arrow(c, 3, 21, x, y, '#d6b38a', '#facc15'); },
    ult_arc_b(c) { swirl(c, '#6d28d9'); arrow(c, 9, 15, 21, 3, '#d6b38a', '#e9d5ff'); },
    ult_mag_a(c) { for (const [x, y] of [[3, 13], [9, 4.5]]) poly(c, [[x, y], [x + 7, y + 3], [x + 3, y + 7]], '#f97316', 1.1); orb(c, 15, 15, 6.5, '#7c2d12', o); for (const [x, y] of [[13, 13.5], [17, 16.5], [15, 18.5]]) orb(c, x, y, 1.4, '#fb923c', 0, false); },
    ult_mag_b(c) { I.cooldown(c); poly(c, starPts(18.5, 5.5, 4, 1.5, 6), '#bae6fd', 1); },
    ult_mil_a(c) { c.save(); c.translate(12, 12); c.rotate(-0.8); poly(c, [[-11, 0], [-15, -3], [-15, 3]], '#fde047', 1); box(c, -10, -3.5, 16, 7, 3, '#9ca3af', o); poly(c, [[6, -3.5], [11, 0], [6, 3.5]], '#ef4444', 1.2); poly(c, [[-10, -3.5], [-13, -7], [-6, -3.5]], '#4b5563', 1); poly(c, [[-10, 3.5], [-13, 7], [-6, 3.5]], '#4b5563', 1); c.restore(); },
    ult_mil_b(c) { poly(c, [[2, 8], [22, 8], [20, 10.5], [4, 10.5]], '#64748b', 1.2); poly(c, [[10, 8], [7, 3], [9.5, 3], [14, 8]], '#94a3b8', 1.1); for (const x of [7, 12, 17]) { orb(c, x, 16, 2.3, '#30333a', 1.1, false); line(c, [[x, 12.5], [x, 13.5]], '#30333a', 1, 0); } poly(c, starPts(12, 21, 3, 1.3, 6), '#f97316', 1); },
    ult_tan_a(c) { shield(c, '#f59e0b', () => { line(c, [[8, 8], [16, 16]], '#fef3c7', 2, 0.8); line(c, [[16, 8], [8, 16]], '#fef3c7', 2, 0.8); }); },
    ult_tan_b(c) { c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.arc(12, 12, 9, 0, TAU); c.stroke(); c.strokeStyle = '#facc15'; c.lineWidth = 2; c.stroke(); bolt(c, 12, 12, 7, '#fde047'); },
    ult_rog_a(c) { shape(c, () => { c.beginPath(); c.arc(12, 12, 9, 0.6, TAU - 0.6); c.arc(16, 12, 6.5, TAU - 0.95, 0.95, true); c.closePath(); }, '#4c1d95'); for (const [x, y] of [[17, 7], [19, 15]]) poly(c, starPts(x, y, 2.2, 0.9, 4, 0), '#e9d5ff', 0.9); },
    ult_rog_b(c) { for (const [x, y, r] of [[8, 13, 5], [14, 11, 6], [17.5, 15, 4.5], [11, 16.5, 4.5]]) orb(c, x, y, r, '#84cc16', 1.3, false); orb(c, 13, 13.5, 1.5, '#ecfccb', 0, false); },
    ult_eng_a(c) { box(c, 5, 6, 14, 12, 3, '#9ca3af', o); for (const x of [9, 15]) orb(c, x, 11.5, 2.2, '#38bdf8', 1.1, false); box(c, 9, 15, 6, 1.6, 0.6, OUT, 0, false); line(c, [[12, 6], [12, 2.5]], '#6b7280', 1.4, 0.8); orb(c, 12, 2.3, 1.4, '#ef4444', 0.9, false); },
    ult_eng_b(c) { c.strokeStyle = OUT; c.lineWidth = 1; for (const x of [6, 18]) { c.beginPath(); c.moveTo(12, 9.5); c.lineTo(x, 5); c.stroke(); } shape(c, () => { c.beginPath(); c.arc(12, 6, 7, Math.PI, 0); c.closePath(); }, '#ef4444', 1.2); box(c, 6.5, 10, 11, 10, 1.5, '#a16207', o); line(c, [[7, 15], [17, 15]], '#713f12', 1.2, 0); },
    ult_pri_a(c) { orb(c, 12, 6, 5, '#e5e7eb', 1.2, false); orb(c, 7.5, 7.5, 3.5, '#e5e7eb', 1.2, false); orb(c, 16.5, 7.5, 3.5, '#e5e7eb', 1.2, false); bolt(c, 12, 15, 7, '#facc15'); },
    ult_pri_b(c) { for (const [r, col] of [[9.5, '#ef4444'], [7.5, '#facc15'], [5.5, '#22c55e'], [3.5, '#3b82f6']]) { c.strokeStyle = OUT; c.lineWidth = 3.6; c.beginPath(); c.arc(12, 17, r, Math.PI, 0); c.stroke(); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); } },
    // infrastruktura, která je ve hře moc drobná na ikonu
    wire(c) { line(c, [[1.5, 15], [9, 12.5]], '#facc15', 2, 1); line(c, [[15, 12.5], [22.5, 15]], '#facc15', 2, 1); box(c, 8, 7, 8, 11, 2, '#4b5563', o); orb(c, 12, 12.5, 2.2, '#fde047', 1, false); line(c, [[12, 7], [12, 3]], '#9ca3af', 1.6, 0.8); },
    sprinkler(c) { c.lineCap = 'round'; for (const [r, a] of [[9, -2.4], [9, -0.75], [6, -1.6]]) { c.strokeStyle = OUT; c.lineWidth = 3.4; c.beginPath(); c.arc(12, 15, r, a - 0.45, a + 0.45); c.stroke(); c.strokeStyle = '#38bdf8'; c.lineWidth = 1.8; c.stroke(); }
      box(c, 10.5, 15, 3, 6, 1, '#6b7280', 1.2); orb(c, 12, 15, 3.2, '#9ca3af', 1.2, false); box(c, 6, 20, 12, 2.5, 1, '#4b5563', 1.1); },
    // úroda (plod)
    crop_carrot(c) { poly(c, [[7, 7], [17, 7], [12, 22]], '#f97316', o); for (const a of [-0.5, 0, 0.5]) line(c, [[12, 7], [12 + Math.sin(a) * 5, 1.5]], '#22c55e', 2, 0.8); },
    crop_wheat(c) { line(c, [[12, 22], [12, 6]], '#a16207', 1.4, 0.8); for (let i = 0; i < 4; i++) { blob(c, 9.5, 7 + i * 3, 1.8, 2.8, '#facc15', 1, -0.6); blob(c, 14.5, 7 + i * 3, 1.8, 2.8, '#facc15', 1, 0.6); } blob(c, 12, 4.5, 1.6, 2.6, '#facc15', 1, 0); },
    crop_tomato(c) { orb(c, 12, 13.5, 8, '#ef4444', o); poly(c, starPts(12, 6.5, 4, 1.6, 5), '#16a34a', 1); },
    crop_pumpkin(c) { for (const [x, rx] of [[7.5, 4.5], [16.5, 4.5], [12, 5.5]]) blob(c, x, 14, rx, 7, '#f59e0b', o); box(c, 11, 3.5, 2.4, 4, 1, '#65a30d', 1); },
    crop_melon(c) { blob(c, 12, 13, 9, 7.5, '#4d7c0f', o); c.strokeStyle = '#bef264'; c.lineWidth = 1.2; for (const x of [-4, 0, 4]) { c.beginPath(); c.ellipse(12 + x * 0.6, 13, 1.5 + Math.abs(x) * 0.6, 6.5, 0, 0, TAU); c.stroke(); } },
  };

  // ── ikony z herních kreseb ──
  const KITC = { warrior: ['#ef4444', 'sword', '#ef4444'], archer: ['#84cc16', 'bow', '#84cc16'], mage: ['#818cf8', 'staff', '#818cf8'], militant: ['#f59e0b', 'pistol', '#fbbf24'],
    tank: ['#64748b', 'hammer', '#64748b'], rogue: ['#a855f7', 'dagger', '#a855f7'], engineer: ['#0ea5e9', 'wrench', '#0ea5e9'], priest: ['#fde68a', 'mace', '#fde68a'] };
  const WCOL = { pistol: '#fbbf24', shotgun: '#f97316', rifle: '#06b6d4', bow: '#84cc16', sword: '#ef4444', dagger: '#a855f7', hammer: '#64748b', staff: '#818cf8', wrench: '#0ea5e9', mace: '#fde68a' };
  const STR = { wall: [64, 20], barricade: [64, 18], spikes: [48, 48], turret: [40, 40], platform: [72, 72] };
  const INF = { channel: { fed: true, fresh: true, links: { e: 1, w: 1 } }, well: { level: 0.75 }, purifier: { fed: true }, plot: { soil: 'growing' },
    wheel: { active: false }, fence: { powered: true, links: { e: 1, w: 1 } } };
  function game(name, c) {
    if (name.startsWith('kit_')) { const k = name.slice(4), [col, wid, wc] = KITC[k] || KITC.warrior;
      c.translate(10.5, 12.5); c.scale(0.72, 0.72);   // kreslit v herní velikosti a zmenšit (stín a čáry mají pevnou šířku)
      ZS.playerBody(c, k, 0, 0, 16, -0.75, 0, col, false); c.globalAlpha = 1; ZS.weapon(c, wid, 0, 0, 16, -0.75, 0, null, wc); return true; }
    if (name.startsWith('w_')) { const w = name.slice(2); if (!WCOL[w]) return false;
      c.translate(12, 12); c.rotate(w === 'bow' ? -0.75 : -0.78);
      if (w === 'bow') { ZS.weapon(c, 'bow', -9, 0, 10, 0, 0, null, WCOL.bow); return true; }
      const len = { pistol: 30, shotgun: 44, rifle: 50, sword: 52, dagger: 33, hammer: 43, staff: 49, wrench: 32, mace: 38 }[w] || 40, mid = { pistol: 7, shotgun: 10, rifle: 11, sword: 16, dagger: 9, hammer: 13, staff: 14, wrench: 10, mace: 11 }[w] || 12;
      const sc = 21 / len; c.scale(sc, sc); c.drawImage(wSpr(w, WCOL[w]), -50 - mid, -20); return true; }
    if (STR[name]) { const [w, h] = STR[name], sc = 20 / Math.max(w, h); c.translate(12, 12); c.scale(sc, sc); ZS.structure(c, name, -w / 2, -h / 2, w, h, 1, 0, -0.6); return true; }
    if (INF[name]) { c.translate(12, 12); const sc = 20 / 50; c.scale(sc, sc); ZS.infra(c, name, 0, 0, 50, INF[name], 0); return true; }
    if (name === 'base') { c.translate(11.5, 12.5); c.scale(0.17, 0.17); ZS.base(c, 0, 0, 52, 1, 0); return true; }
    return false;
  }

  const urls = new Map();
  function url(name, size) {
    const res = size > 48 ? 128 : size > 24 ? 96 : 48, key = name + '_' + res;
    if (urls.has(key)) return urls.get(key);
    const cv = document.createElement('canvas'); cv.width = cv.height = res;
    const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round'; c.scale(res / 24, res / 24);
    let ok = false;
    try { c.save(); ok = game(name, c); c.restore(); if (!ok && I[name]) { I[name](c); ok = true; } } catch (e) { console.warn('[ikona]', name, e); ok = false; }
    const u = ok ? cv.toDataURL('image/png') : null;
    urls.set(key, u);
    return u;
  }
  const oldSvg = ZSI.svg;
  ZSI.svg = function (name, size) {
    if (!on()) return oldSvg.call(this, name, size);
    const s = size === undefined ? 24 : size, u = url(name, s);
    return u ? `<img class="zsi-io" src="${u}" width="${s}" height="${s}" alt="" draggable="false">` : oldSvg.call(this, name, size);
  };
})();

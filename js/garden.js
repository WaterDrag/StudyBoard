// ═══ garden.js — Zahrada: strom, který roste s každým dnem učení
// Den se počítá, když splníš aspoň jedno: 20 odpovědí na kartičky (kvíz,
// Studovat, Psaní…), 25 minut pomodora, nebo Denní výzvu. Každý takový den
// = 1 zkušenost a strom roste. Vynechaný den ubere strom trochu „zdraví“
// (povadne a zežloutne), ale NIKDY neuschne — po návratu se zase zazelená.
// Stav: users/{uid}.garden = { xp, health 1–5, lastDay 'YYYY-MM-DD', since }
const GARDEN_GOAL = { answers: 20, focusSec: 25 * 60 };
const GARDEN_STAGES = [
  { xp: 0,  name: 'Semínko',          emoji: '🌰' },
  { xp: 1,  name: 'Klíček',           emoji: '🌱' },
  { xp: 3,  name: 'Výhonek',          emoji: '🌿' },
  { xp: 6,  name: 'Keřík',            emoji: '🪴' },
  { xp: 10, name: 'Stromek',          emoji: '🌳' },
  { xp: 18, name: 'Kvetoucí strom',   emoji: '🌸' },
  { xp: 30, name: 'Strom s ovocem',   emoji: '🍎' },
  { xp: 50, name: 'Kouzelný strom',   emoji: '✨' },
];
const gardenStage = xp => GARDEN_STAGES.reduce((s, st, i) => xp >= st.xp ? i : s, 0);
const gardenEmoji = g => g ? gardenIcon(gardenStage(g.xp || 0)) : '';
const gDayUTC = t => new Date(t).toISOString().slice(0, 10);

// Co jsem v daný den udělal(a) — z dat, která už ukládají ostatní části.
function gardenDay(profile, day) {
  let answers = 0;
  Object.values(profile.learn || {}).forEach(l => { answers += l?.stats?.days?.[day]?.a || 0; });
  const focus = (profile.focus || {})[day] || 0;
  const daily = !!(profile.daily || {})[day]?.done;   // Denní výzva má místní datum; o půlnoci se to může o den minout
  return { answers, focus, daily, met: answers >= GARDEN_GOAL.answers || focus >= GARDEN_GOAL.focusSec || daily };
}

// Dopočítá dny od posledního zápisu. Dnešek se připíše, až je cíl splněný;
// nesplněný dnešek nic neubírá (den ještě neskončil).
function gardenAdvance(profile) {
  const today = gDayUTC(Date.now());
  const g = { xp: 0, health: 4, lastDay: null, ...(profile.garden || {}) };
  // Nová zahrada: započítá se posledních 14 dní, ať aktivní lidi nezačínají od nuly.
  let from = g.lastDay ? Date.parse(g.lastDay) + 864e5 : Date.now() - 14 * 864e5;
  from = Math.max(from, Date.now() - 60 * 864e5);
  let changed = !profile.garden;
  for (let t = from; gDayUTC(t) <= today; t += 864e5) {
    const day = gDayUTC(t), r = gardenDay(profile, day);
    if (day === today) {
      if (!r.met) break;
    }
    if (r.met) { g.xp++; g.health = Math.min(5, g.health + 1); }
    else if (g.xp > 0) g.health = Math.max(1, g.health - 1);   // semínko, co ještě nevyklíčilo, nevadne
    g.lastDay = day;
    changed = true;
  }
  if (!g.since) { g.since = today; changed = true; }
  return { g, changed, todayInfo: gardenDay(profile, today) };
}

// ── Skiny podle ročního období (nebo ručně vybraný, pamatuje si ho prohlížeč) ──
const GARDEN_SEASONS = { spring: 'Jaro', summer: 'Léto', autumn: 'Podzim', winter: 'Zima' };
function gardenSeasonNow() { const m = new Date().getMonth(); return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'; }
function gardenSeasonPref() { try { const v = localStorage.getItem('sb_garden_season'); return GARDEN_SEASONS[v] ? v : ''; } catch (_) { return ''; } }
// obloha (2 barvy), tráva zdravá / povadlá, posun odstínu listí
const GARDEN_SKIN = {
  spring: { sky: ['#bae6fd', '#ecfccb'], grass: '#84cc16', dry: '#8a7a2e', hue: -35, sat: 12, lum: 22 },
  summer: { sky: ['#7dd3fc', '#e0f2fe'], grass: '#3f7d0b', dry: '#7c6f2a', hue: 8, sat: -2, lum: -9 },
  autumn: { sky: ['#fed7aa', '#fef3c7'], grass: '#7c7a1e', dry: '#7c5a1e', hue: -95, sat: 22, lum: 6 },
  winter: { sky: ['#cbd5e1', '#f1f5f9'], grass: '#f1f5f9', dry: '#e2e8f0', hue: 0, sat: 0, lum: 0 },
};

// Malá barevná ikona fáze (štítek na hlavní stránce, „Do fáze…“, žebříček): listí má barvu aktuálního období
function gardenIcon(st, season = gardenSeasonPref() || gardenSeasonNow()) {
  const L = { spring: ['#a3e635', '#d9f99d'], summer: ['#15803d', '#22c55e'], autumn: ['#ea580c', '#fbbf24'], winter: ['#cbd5e1', '#f8fafc'] }[season];
  const O = '#14241a', tr = season === 'winter' ? '#78716c' : '#8b5a33';
  const b = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${O}" stroke-width=".7"/>`;
  const dots = (c, r = 1.1) => [[8, 8], [14.5, 6.5], [17, 11], [11, 11.5], [6.5, 12.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  const crown = () => b(7.5, 11, 4.6, L[0]) + b(16.5, 11, 4.6, L[0]) + b(9, 6.5, 4.8, L[1]) + b(15, 6.8, 4.4, L[0]) + `<circle cx="10" cy="9" r="4.6" fill="${L[1]}"/>`;
  const trunk = `<path d="M10.6 22 11 13h2l.4 9z" fill="${tr}" stroke="${O}" stroke-width=".6"/>`;
  const leaf = (x, y, dx, dy, c) => `<path d="M${x} ${y}q${dx * .3} ${dy} ${dx} ${dy * .6}q${-dx * .2} ${-dy * .9} ${-dx} ${-dy * .6}z" fill="${c}" stroke="${O}" stroke-width=".5"/>`;
  const stem = t => `<path d="M12 22V${t}" stroke="#3f6212" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
  const art = [
    `<ellipse cx="12" cy="20" rx="8" ry="2.4" fill="#5b3a24"/><ellipse cx="12" cy="15" rx="5" ry="6" fill="#92400e" stroke="${O}" stroke-width=".7"/><path d="M12 9.2c-2 2-2.5 6-1 10" stroke="#fbbf24" stroke-width=".9" fill="none" opacity=".7"/><path d="M12 9c.5-1.5 1.5-2.5 3-3" stroke="#65a30d" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
    stem(11) + leaf(12, 12, -8, -4, L[0]) + leaf(12, 11, 8, -5, L[1]),
    stem(5) + leaf(12, 16, -7, -3, L[1]) + leaf(12, 13, 7, -4, L[0]) + leaf(12, 9, -7, -4, L[0]) + leaf(12, 6, 6, -4, L[1]),
    `<path d="M11 22l.3-6h1.4l.3 6z" fill="${tr}"/>` + b(7, 15, 4.6, L[0]) + b(17, 15, 4.6, L[0]) + b(12, 12, 6, L[1]),
    trunk + crown() + (season === 'spring' ? dots('#fbcfe8') + dots('#ec4899', .45) : ''),
    trunk + crown() + (season === 'winter' ? '' : dots('#fbcfe8') + dots('#ec4899', .45)),
    trunk + crown() + (season === 'winter' ? '' : season === 'spring' ? dots('#fbcfe8') + dots('#65a30d', .6) : dots('#dc2626', 1.4)),
    `<circle cx="12" cy="10" r="11" fill="#fde68a" opacity=".3"/>` + trunk + crown() + [[3.5, 4], [20.5, 5], [4, 18], [20, 17], [12, 1.8]].map(([x, y]) => `<path d="M${x} ${y - 2}l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" fill="#facc15" stroke="#854d0e" stroke-width=".3"/>`).join(''),
  ][st];
  return `<svg class="garden-ico" viewBox="0 0 24 24" aria-hidden="true">${art}</svg>`;
}

// Květiny v trávě podle období (x, y = pata stonku)
function gardenFlower(season, i, x, y) {
  const stem = h => `<path d="M${x} ${y}v-${h}" stroke="#3f6212" stroke-width="1.7" stroke-linecap="round"/>`;
  const petals = (cy, n, d, rx, ry, c, mid, mr) => { let p = ''; for (let k = 0; k < n; k++) p += `<ellipse cx="${x}" cy="${cy - d}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${k * 360 / n} ${x} ${cy})"/>`; return p + `<circle cx="${x}" cy="${cy}" r="${mr}" fill="${mid}"/>`; };
  const v = i % 3;
  if (season === 'spring') {
    if (v === 0) { const c = ['#ef4444', '#f472b6', '#fbbf24'][(i / 3 | 0) % 3]; return stem(13) + `<path d="M${x} ${y - 2}q-4 -2 -5 -7q4 1 5 5z" fill="#4ade80"/><path d="M${x - 5} ${y - 19}l2.5 3 2.5-4 2.5 4 2.5-3v6a5 4 0 0 1-10 0z" fill="${c}" stroke="#7f1d1d" stroke-width=".4"/>`; }   // tulipán
    if (v === 1) return stem(13) + petals(y - 15, 6, 3.6, 2.2, 3, '#fde047', '#f97316', 2.1);   // narcis
    return stem(9) + petals(y - 11, 5, 2.5, 1.7, 2.3, '#c4b5fd', '#fde047', 1.1);   // fialka
  }
  if (season === 'summer') {
    if (v === 0) return stem(19) + `<path d="M${x} ${y - 7}q5 -1 7 -5q-5 0 -7 5z" fill="#4ade80"/>` + petals(y - 22, 12, 5, 1.8, 3.2, '#facc15', '#78350f', 3.4);   // slunečnice
    if (v === 1) return stem(12) + petals(y - 14, 10, 3.6, 1.3, 2.6, '#fff', '#eab308', 1.9);   // kopretina
    return stem(13) + petals(y - 15, 5, 3, 2.8, 2.8, '#ef4444', '#1c1917', 1.5);   // vlčí mák
  }
  if (season === 'autumn') {
    if (v === 0) return `<path d="M${x - 2} ${y}l.6-6h2.8l.6 6z" fill="#fef3c7" stroke="#78350f" stroke-width=".4"/><path d="M${x - 7} ${y - 6}a7 6 0 0 1 14 0z" fill="#dc2626" stroke="#7f1d1d" stroke-width=".5"/><circle cx="${x - 3}" cy="${y - 8}" r="1.1" fill="#fff"/><circle cx="${x + 2}" cy="${y - 9.5}" r="1" fill="#fff"/><circle cx="${x + 3.5}" cy="${y - 7}" r=".8" fill="#fff"/>`;   // muchomůrka
    if (v === 1) return stem(12) + petals(y - 14, 14, 3.4, 1, 2.4, '#ea580c', '#7c2d12', 1.9);   // chryzantéma
    return `<path d="M${x - 2} ${y}l.6-5h2.8l.6 5z" fill="#e7e5e4"/><path d="M${x - 6} ${y - 5}a6 5 0 0 1 12 0z" fill="#92400e" stroke="#451a03" stroke-width=".5"/>`;   // hřib
  }
  if (v === 0) return `<path d="M${x} ${y}v-11q0 -3 3.5 -3" stroke="#4d7c0f" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M${x + 3.5} ${y - 14}q-3 3 -1 6.5q1 1 2 1q1 0 2 -1q1 -3.5 -3 -6.5z" fill="#fff" stroke="#94a3b8" stroke-width=".5"/>`;   // sněženka
  if (v === 1) return `<path d="M${x} ${y - 18}l5.5 8h-2.5l4 7h-14l4-7h-2.5z" fill="#166534" stroke="#052e16" stroke-width=".5"/><path d="M${x} ${y - 18}l3 4.4h-6z" fill="#f1f5f9"/><path d="M${x - 1} ${y}v-3h2v3z" fill="#57534e"/>`;   // zasněžený smrček
  return `<circle cx="${x}" cy="${y - 4}" r="4.5" fill="#f8fafc" stroke="#94a3b8" stroke-width=".5"/><circle cx="${x}" cy="${y - 10.5}" r="3.2" fill="#f8fafc" stroke="#94a3b8" stroke-width=".5"/><path d="M${x} ${y - 10.8}l3 .8l-3 .8z" fill="#f97316"/><circle cx="${x - 1}" cy="${y - 11.5}" r=".5" fill="#1c1917"/><circle cx="${x + 1}" cy="${y - 11.5}" r=".5" fill="#1c1917"/>`;   // sněhulák
}

// ── Kreslení stromu (SVG) ───────────────────────────────────────
function gardenSvg(g, streakDays = 0, season = gardenSeasonPref() || gardenSeasonNow()) {
  const st = gardenStage(g.xp || 0), h = g.health || 4;
  // zdraví 5 = sytě zelená, 1 = vybledlá žlutohnědá
  const hue = 70 + (h - 1) * 15, sat = 30 + (h - 1) * 8, lum = 38 + (5 - h) * 2;
  const skin = GARDEN_SKIN[season], winter = season === 'winter';
  const lh = hue + skin.hue, ls = sat + skin.sat, ll = lum + skin.lum;
  const leaf = winter ? '#e2e8f0' : `hsl(${lh} ${ls}% ${ll}%)`, leaf2 = winter ? '#f8fafc' : `hsl(${lh + 8 + (season === 'autumn' ? 14 : 0)} ${ls + 5}% ${ll + 9}%)`;
  const trunk = winter ? '#57534e' : '#7c4a2d';
  let rnd = 7;
  const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  let s = `<svg viewBox="-70 0 340 200" class="garden-svg" role="img" aria-label="${GARDEN_STAGES[st].name}">`;
  s += `<defs><linearGradient id="gSky-${season}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skin.sky[0]}"/><stop offset="1" stop-color="${skin.sky[1]}"/></linearGradient></defs><rect x="-70" width="340" height="200" fill="url(#gSky-${season})"/>`;
  if (season === 'summer') s += `<circle cx="214" cy="34" r="15" fill="#fde047"/><circle cx="214" cy="34" r="21" fill="#fde047" opacity=".25"/>`;
  if (season === 'spring') s += `<g fill="#fff" opacity=".85"><ellipse cx="-22" cy="34" rx="18" ry="7"/><ellipse cx="-8" cy="29" rx="12" ry="7"/><ellipse cx="192" cy="50" rx="15" ry="6"/><ellipse cx="60" cy="18" rx="12" ry="5"/></g>`;
  if (season === 'autumn') s += `<g fill="#94a3b8" opacity=".45"><ellipse cx="-10" cy="32" rx="24" ry="8"/><ellipse cx="205" cy="24" rx="20" ry="7"/><ellipse cx="90" cy="16" rx="16" ry="5"/></g>`;
  if (st === 7) s += `<defs><radialGradient id="gGlow"><stop offset="0" stop-color="#fde68a" stop-opacity=".55"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="90" r="90" fill="url(#gGlow)"/>`;
  // země přes celou šířku
  s += `<path d="M-70 174Q100 164 270 174V200H-70z" fill="${h >= 3 ? skin.grass : skin.dry}"/><path d="M-70 192Q100 186 270 192V200H-70z" fill="${winter ? '#cbd5e1' : '#5b3a24'}"/>`;
  // květinky v trávě = dny v řadě (max 7)
  const spots = [-48, 62, 148, -14, 182, 34, 226];
  for (let i = 0; i < Math.min(7, streakDays); i++) s += gardenFlower(season, i, spots[i], 178 + (i % 2) * 5);
  if (st === 0) {
    s += `<ellipse cx="100" cy="168" rx="16" ry="7" fill="#6b4226"/><ellipse cx="100" cy="164" rx="7" ry="5" fill="#a16207"/>`;
  } else if (st <= 2) {
    const hgt = st === 1 ? 26 : 48;
    s += `<path d="M100 172 C 100 ${172 - hgt * 0.5}, ${h < 3 ? 104 : 98} ${172 - hgt * 0.8}, ${h < 3 ? 106 : 100} ${172 - hgt}" stroke="#4d7c0f" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    const tip = 172 - hgt, droop = h < 3 ? 8 : 0;
    s += `<path d="M100 ${tip + 6} q -16 ${-10 + droop} -24 ${2 + droop} q 14 6 24 -2" fill="${leaf}"/><path d="M101 ${tip + 4} q 16 ${-12 + droop} 25 ${0 + droop} q -14 8 -25 0" fill="${leaf2}"/>`;
    if (st === 2) s += `<path d="M100 ${tip + 24} q -14 -6 -20 4 q 12 4 20 -4" fill="${leaf2}"/><path d="M100 ${tip + 20} q 14 -8 20 2 q -12 6 -20 -2" fill="${leaf}"/>`;
  } else {
    // keřík / strom: kmen + koruna z kruhů, s každou fází větší
    const k = Math.min(st - 3, 4);
    const tH = [18, 52, 60, 64, 68][k], crownY = 172 - tH - [14, 30, 36, 40, 44][k], cr = [26, 38, 46, 52, 56][k];
    s += `<path d="M94 172 L96 ${172 - tH} L104 ${172 - tH} L106 172 Z" fill="${trunk}"/>`;
    if (k >= 1) s += `<path d="M100 ${172 - tH + 14} l -16 -14 M100 ${172 - tH + 8} l 15 -12" stroke="${trunk}" stroke-width="4" stroke-linecap="round"/>`;
    const blobs = [[0, 0, 1], [-0.62, 0.25, 0.7], [0.62, 0.25, 0.7], [-0.35, -0.45, 0.68], [0.38, -0.42, 0.66], [0, 0.42, 0.6]];
    blobs.forEach(([dx, dy, sc], i) => { s += `<circle cx="${100 + dx * cr}" cy="${crownY + dy * cr}" r="${cr * sc * 0.72}" fill="${i % 2 ? leaf2 : leaf}"/>`; });
    const blooms = season === 'spring' ? (st >= 4 ? 28 : 8) : season === 'summer' && st === 5 ? 9 : 0;
    for (let i = 0; i < blooms; i++) { const a = i * 2.4, d = Math.sqrt((i + 0.5) / blooms) * cr * 0.95; s += `<circle cx="${100 + Math.cos(a) * d}" cy="${crownY + Math.sin(a) * d * 0.8}" r="${season === 'spring' ? 4.2 : 3.2}" fill="#fbcfe8"/><circle cx="${100 + Math.cos(a) * d}" cy="${crownY + Math.sin(a) * d * 0.8}" r="1.2" fill="#f472b6"/>`; }
    if (st >= 6 && !winter) for (let i = 0; i < (season === 'autumn' ? 9 : 6); i++) { const a = r() * Math.PI * 2, d = r() * cr * 0.75; s += `<circle cx="${100 + Math.cos(a) * d}" cy="${crownY + 6 + Math.sin(a) * d * 0.7}" r="${season === 'spring' ? 2.8 : 4.6}" fill="${season === 'spring' ? '#a3e635' : '#dc2626'}"/><circle cx="${101 + Math.cos(a) * d}" cy="${crownY + 4 + Math.sin(a) * d * 0.7}" r="1.4" fill="#fff6"/>`; }
    if (st === 7) for (let i = 0; i < 10; i++) { const x = 30 + r() * 140, y = 20 + r() * 120; s += `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#fde047" opacity=".9"/>`; }
    if (h <= 2) for (let i = 0; i < 4; i++) s += `<ellipse cx="${60 + r() * 80}" cy="${174 + r() * 3}" rx="4" ry="2" fill="#a16207" transform="rotate(${r() * 60 - 30} 100 175)"/>`;
  }
  // počasí přes všechno: sníh v zimě, padající listí na podzim, okvětní lístky na jaře
  const n = winter ? 40 : season === 'summer' ? 0 : 18;
  for (let i = 0; i < n; i++) {
    const x = -66 + r() * 332, y = 8 + r() * 160;
    if (winter) s += `<circle cx="${x}" cy="${y}" r="${1 + r() * 1.6}" fill="#fff" opacity=".95"/>`;
    else if (season === 'autumn') s += `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="1.8" fill="${['#ea580c', '#ca8a04', '#b91c1c'][i % 3]}" transform="rotate(${r() * 180} ${x} ${y})"/>`;
    else s += `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.3" fill="#fbcfe8" transform="rotate(${r() * 180} ${x} ${y})"/>`;
  }
  return s + '</svg>';
}

const HEALTH_TXT = ['', 'hodně povadlý — potřebuje tě', 'povadlý', 'trochu žíznivý', 'zdravý', 'svěží a zelený'];
function gardenStreak(profile) {
  let n = 0;
  const today = gDayUTC(Date.now());
  for (let i = gardenDay(profile, today).met ? 0 : 1; i < 60; i++) { if (!gardenDay(profile, gDayUTC(Date.now() - i * 864e5)).met) break; n++; }
  return n;
}

// ── Hlavní stránka: štítek pod pozdravem + okno se zahradou ─────
let GARDEN = null;
async function initGarden(user) {
  const chip = document.getElementById('gardenChip');
  if (!chip || user.isAnonymous) return;
  try {
    const ref = db.collection('users').doc(user.uid);
    const profile = (await ref.get()).data() || {};
    const { g, changed, todayInfo } = gardenAdvance(profile);
    if (changed) ref.set({ garden: g }, { merge: true }).catch(() => {});
    GARDEN = { g, todayInfo, streak: gardenStreak(profile) };
    const st = GARDEN_STAGES[gardenStage(g.xp)];
    chip.hidden = false;
    chip.innerHTML = `<span class="garden-chip-ico">${gardenIcon(gardenStage(g.xp))}</span><span><b>${st.name}</b><small>${todayInfo.met ? '✅ dnešní cíl splněn' : gardenTodayLeft(todayInfo)}</small></span>`;
    chip.classList.toggle('done', todayInfo.met);
    chip.onclick = openGarden;
  } catch (_) { /* zahrada je jen bonus */ }
}
function gardenTodayLeft(t) {
  const left = Math.max(0, GARDEN_GOAL.answers - t.answers);
  return `💧 dnes ještě ${left} ${left === 1 ? 'odpověď' : left < 5 ? 'odpovědi' : 'odpovědí'} nebo 🍅 25 min`;
}
function openGarden() {
  const { g, todayInfo, streak } = GARDEN;
  const st = gardenStage(g.xp), next = GARDEN_STAGES[st + 1];
  const pct = next ? Math.round((g.xp - GARDEN_STAGES[st].xp) / (next.xp - GARDEN_STAGES[st].xp) * 100) : 100;
  document.getElementById('gardenModal')?.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay open';
  ov.id = 'gardenModal';
  ov.innerHTML = `<div class="modal garden-modal">
    <div class="modal-header"><h3 class="garden-title">${gardenIcon(st)} Tvoje zahrada</h3><button class="modal-close" data-gclose>✕</button></div>
    <div class="garden-view" id="gardenView">${gardenSvg(g, streak)}</div>
    <div class="garden-skins" id="gardenSkins">${[['', 'Podle data'], ...Object.entries(GARDEN_SEASONS)].map(([k, t]) => `<button type="button" class="garden-skin${gardenSeasonPref() === k ? ' on' : ''}" data-season="${k}">${t}</button>`).join('')}</div>
    <div class="garden-name"><b>${GARDEN_STAGES[st].name}</b><span>${HEALTH_TXT[g.health || 4]} · ${g.xp} ${g.xp === 1 ? 'den' : g.xp < 5 ? 'dny' : 'dní'} učení${streak ? ` · 🔥 ${streak} v řadě` : ''}</span></div>
    <div class="garden-next">${next ? `Do fáze <b>${gardenIcon(st + 1)} ${next.name}</b> zbývá ${next.xp - g.xp} ${next.xp - g.xp === 1 ? 'den' : next.xp - g.xp < 5 ? 'dny' : 'dní'}` : 'Tvůj strom je v plné kráse ✨'}<div class="garden-prog"><i style="width:${pct}%"></i></div></div>
    <div class="garden-goal">
      <div><b>Dnešní zalévání</b> — stačí jedno z toho:</div>
      <div class="garden-goal-row${todayInfo.answers >= GARDEN_GOAL.answers ? ' ok' : ''}">🃏 ${Math.min(todayInfo.answers, GARDEN_GOAL.answers)} / ${GARDEN_GOAL.answers} odpovědí na kartičky</div>
      <div class="garden-goal-row${todayInfo.focus >= GARDEN_GOAL.focusSec ? ' ok' : ''}">🍅 ${Math.min(25, Math.floor(todayInfo.focus / 60))} / 25 min pomodora</div>
      <div class="garden-goal-row${todayInfo.daily ? ' ok' : ''}">📅 Denní výzva ${todayInfo.daily ? 'splněna' : 'čeká'}</div>
    </div>
    <p class="garden-note">Každý den se splněným cílem strom poroste. Když pár dní vynecháš, povadne — ale neuschne, stačí se vrátit. Květiny v trávě ukazují dny v řadě a mění se s ročním obdobím.</p>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-gclose]')) { ov.remove(); return; }
    const b = e.target.closest('[data-season]'); if (!b) return;
    try { if (b.dataset.season) localStorage.setItem('sb_garden_season', b.dataset.season); else localStorage.removeItem('sb_garden_season'); } catch (_) {}
    document.getElementById('gardenView').innerHTML = gardenSvg(g, streak);
    ov.querySelectorAll('.garden-title .garden-ico, .garden-next .garden-ico').forEach((x, i) => { x.outerHTML = gardenIcon(i ? st + 1 : st); });
    const ci = document.querySelector('#gardenChip .garden-chip-ico'); if (ci) ci.innerHTML = gardenIcon(st);
    ov.querySelectorAll('[data-season]').forEach(x => x.classList.toggle('on', x === b));
  });
}

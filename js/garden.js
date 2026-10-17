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
const gardenEmoji = g => g ? GARDEN_STAGES[gardenStage(g.xp || 0)].emoji : '';
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

// ── Kreslení stromu (SVG) ───────────────────────────────────────
function gardenSvg(g, streakDays = 0) {
  const st = gardenStage(g.xp || 0), h = g.health || 4;
  // zdraví 5 = sytě zelená, 1 = vybledlá žlutohnědá
  const hue = 70 + (h - 1) * 15, sat = 30 + (h - 1) * 8, lum = 38 + (5 - h) * 2;
  const leaf = `hsl(${hue} ${sat}% ${lum}%)`, leaf2 = `hsl(${hue + 8} ${sat + 5}% ${lum + 9}%)`;
  const trunk = '#7c4a2d';
  let rnd = 7;
  const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  let s = `<svg viewBox="0 0 200 200" class="garden-svg" role="img" aria-label="${GARDEN_STAGES[st].name}">`;
  if (st === 7) s += `<defs><radialGradient id="gGlow"><stop offset="0" stop-color="#fde68a" stop-opacity=".55"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="90" r="90" fill="url(#gGlow)"/>`;
  s += `<ellipse cx="100" cy="178" rx="78" ry="12" fill="#5b3a24"/><ellipse cx="100" cy="174" rx="74" ry="9" fill="${h >= 3 ? '#4d7c0f' : '#7c6f2a'}"/>`;
  // květinky v trávě = dny v řadě (max 7)
  for (let i = 0; i < Math.min(7, streakDays); i++) {
    const x = 36 + i * 21 + (i % 2 ? 4 : 0), y = 172 - (i % 2) * 3;
    s += `<path d="M${x} ${y}v-9" stroke="#3f6212" stroke-width="1.6"/><circle cx="${x}" cy="${y - 10}" r="3.4" fill="${['#f472b6', '#facc15', '#a78bfa', '#fb7185'][i % 4]}"/><circle cx="${x}" cy="${y - 10}" r="1.2" fill="#fff7"/>`;
  }
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
    if (st >= 5) for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = r() * cr * 0.85; s += `<circle cx="${100 + Math.cos(a) * d}" cy="${crownY + Math.sin(a) * d * 0.8}" r="3.2" fill="#fbcfe8"/><circle cx="${100 + Math.cos(a) * d}" cy="${crownY + Math.sin(a) * d * 0.8}" r="1.2" fill="#f472b6"/>`; }
    if (st >= 6) for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = r() * cr * 0.75; s += `<circle cx="${100 + Math.cos(a) * d}" cy="${crownY + 6 + Math.sin(a) * d * 0.7}" r="4.6" fill="#dc2626"/><circle cx="${101 + Math.cos(a) * d}" cy="${crownY + 4 + Math.sin(a) * d * 0.7}" r="1.4" fill="#fff6"/>`; }
    if (st === 7) for (let i = 0; i < 10; i++) { const x = 30 + r() * 140, y = 20 + r() * 120; s += `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#fde047" opacity=".9"/>`; }
    if (h <= 2) for (let i = 0; i < 4; i++) s += `<ellipse cx="${60 + r() * 80}" cy="${174 + r() * 3}" rx="4" ry="2" fill="#a16207" transform="rotate(${r() * 60 - 30} 100 175)"/>`;
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
    chip.innerHTML = `<span class="garden-chip-ico">${st.emoji}</span><span><b>${st.name}</b><small>${todayInfo.met ? '✅ dnešní cíl splněn' : gardenTodayLeft(todayInfo)}</small></span>`;
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
    <div class="modal-header"><h3>🌳 Tvoje zahrada</h3><button class="modal-close" data-gclose>✕</button></div>
    <div class="garden-view">${gardenSvg(g, streak)}</div>
    <div class="garden-name"><b>${GARDEN_STAGES[st].name}</b><span>${HEALTH_TXT[g.health || 4]} · ${g.xp} ${g.xp === 1 ? 'den' : g.xp < 5 ? 'dny' : 'dní'} učení${streak ? ` · 🔥 ${streak} v řadě` : ''}</span></div>
    <div class="garden-next">${next ? `Do fáze <b>${next.emoji} ${next.name}</b> zbývá ${next.xp - g.xp} ${next.xp - g.xp === 1 ? 'den' : next.xp - g.xp < 5 ? 'dny' : 'dní'}` : 'Tvůj strom je v plné kráse ✨'}<div class="garden-prog"><i style="width:${pct}%"></i></div></div>
    <div class="garden-goal">
      <div><b>Dnešní zalévání</b> — stačí jedno z toho:</div>
      <div class="garden-goal-row${todayInfo.answers >= GARDEN_GOAL.answers ? ' ok' : ''}">🃏 ${Math.min(todayInfo.answers, GARDEN_GOAL.answers)} / ${GARDEN_GOAL.answers} odpovědí na kartičky</div>
      <div class="garden-goal-row${todayInfo.focus >= GARDEN_GOAL.focusSec ? ' ok' : ''}">🍅 ${Math.min(25, Math.floor(todayInfo.focus / 60))} / 25 min pomodora</div>
      <div class="garden-goal-row${todayInfo.daily ? ' ok' : ''}">📅 Denní výzva ${todayInfo.daily ? 'splněna' : 'čeká'}</div>
    </div>
    <p class="garden-note">Každý den se splněným cílem strom poroste. Když pár dní vynecháš, povadne — ale neuschne, stačí se vrátit. Květinky v trávě ukazují dny v řadě.</p>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-gclose]')) ov.remove(); });
}

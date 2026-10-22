// ═══ td-engine.js — simulace hry Obrana království (bez vykreslování a DOMu)
// Cesty, slizáci s vrstvami, věže a jejich upgrady, střely, poškození a imunity,
// vlny, ekonomika, hrdinové a schopnosti. Stav hry je v globálním objektu G.
// Data (věže, slizáci, vlny…) jsou v js/td-data.js (window.TD).

const TW = 1040, TH = 720, TRACK_HALF = 22, STEP = 1 / 60;
const TDEF = Object.fromEntries(TD.towers.map(t => [t.id, t]));
const HDEF = Object.fromEntries(TD.heroes.map(h => [h.id, h]));
const EDEF = TD.enemies;
const ECON = TD.econ;
let G = null;
let _uid = 0;

/* ── Cesty ─────────────────────────────────────────────────────── */
function buildPath(pts) {
  const segs = []; let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, l, from: len, ang: Math.atan2(b.y - a.y, b.x - a.x) });
    len += l;
  }
  return { pts, segs, len };
}
function posAt(path, d) {
  if (d <= 0) { const s = path.segs[0]; return { x: s.a.x + Math.cos(s.ang) * d, y: s.a.y + Math.sin(s.ang) * d, ang: s.ang }; }
  for (const s of path.segs) if (d <= s.from + s.l) { const k = (d - s.from) / s.l; return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, ang: s.ang }; }
  const s = path.segs[path.segs.length - 1]; return { x: s.b.x, y: s.b.y, ang: s.ang };
}
function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let k = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0; k = Math.max(0, Math.min(1, k));
  return Math.hypot(px - (a.x + dx * k), py - (a.y + dy * k));
}
function distToTrack(x, y) {
  let m = Infinity;
  for (const p of G.paths) for (const s of p.segs) m = Math.min(m, distToSeg(x, y, s.a, s.b));
  return m;
}
// Nejbližší bod cesty k danému místu (ohnivá stěna, kyselinové louže…)
function nearestTrackPoint(x, y, maxR) {
  let best = null, bd = maxR;
  for (const p of G.paths) for (let d = 0; d < p.len; d += 12) {
    const q = posAt(p, d), k = Math.hypot(q.x - x, q.y - y);
    if (k < bd) { bd = k; best = q; }
  }
  return best;
}

/* ── Slizáci ───────────────────────────────────────────────────── */
const _rbe = {};
function rbeOf(id) {   // kolik životů slizák i se všemi potomky ubere, když projde
  if (_rbe[id] != null) return _rbe[id];
  const e = EDEF[id];
  return (_rbe[id] = e.hp + e.kids.reduce((s, k) => s + k.n * rbeOf(k.id), 0));
}
function leakOf(e) { return Math.max(1, Math.round(rbeOf(e.t) + (e.fort ? e.def.hp : 0) - (e.maxHp - e.hp))); }

function spawnEnemy(t, pathIdx, d, mods = [], opt = {}) {
  const def = EDEF[t]; if (!def) return null;
  const fort = mods.includes('kamenny');
  const hpMul = (opt.hpMul || 1) * (def.boss ? G.bossHpMul || 1 : 1);
  const e = {
    id: ++_uid, t, def, path: pathIdx, d,
    hp: def.hp * (fort ? 2 : 1) * hpMul, maxHp: def.hp * (fort ? 2 : 1) * hpMul,
    camo: mods.includes('duchsliz') || def.traits.includes('duchsliz'),
    regrow: mods.includes('dorustajici'), fort,
    hist: opt.hist || [], origin: opt.origin || t,
    armored: def.traits.includes('armored'),
    x: 0, y: 0, lastHit: G.time, frozenUntil: 0, brittle: false, stunUntil: 0, slowPct: 0, slowUntil: 0,
    vuln: 0, vulnUntil: 0, vulnMul: 1, vulnMulUntil: 0, burn: null, acid: null, revealed: false,
    goldMul: 1, coated: false, spdMul: opt.spdMul || 1, hpMulKids: opt.hpMul || 1, dead: false, wob: Math.random() * 6.28,
  };
  if (opt.bounty) e.bounty = opt.bounty;
  if (def.seal && !opt.noSeal) e.seal = { s: 1, n: def.seal.n };
  if (def.boss && G.sabotage?.bossCut && G.sabotage.until > G.time) { e.hp *= 1 - G.sabotage.bossCut; e.maxHp *= 1 - G.sabotage.bossCut; }
  const q = posAt(G.paths[pathIdx], d); e.x = q.x; e.y = q.y;
  G.enemies.push(e);
  if (def.boss && !opt.noSeal) onBossSpawn(e);
  return e;
}
const isBoss = e => e.def.boss;
const slowImmune = e => e.def.traits.includes('unstoppable_slow_immune');
function frozen(e) { return e.frozenUntil > G.time; }
function stunned(e) { return e.stunUntil > G.time; }
function slow(e, pct, until) {
  if (slowImmune(e)) return;
  if (pct >= e.slowPct || e.slowUntil < G.time) { e.slowPct = pct; e.slowUntil = Math.max(until, e.slowUntil < G.time ? 0 : e.slowUntil); }
}
function freeze(e, dur, src) {
  if (e.def.traits.includes('freeze_immune') || slowImmune(e)) return false;
  e.frozenUntil = Math.max(e.frozenUntil, G.time + dur);
  if (src?.fx?.allow_sharp_on_frozen) e.brittle = true;
  return true;
}
function stun(e, dur) { if (slowImmune(e)) return; e.stunUntil = Math.max(e.stunUntil, G.time + dur); }
function visibleTo(e, t) {
  if (!e.camo || e.revealed || G.revealUntil > G.time) return true;
  return !!(t && (t.st?.camo || t.aura?.camo));
}

// Může daný druh poškození slizáka vůbec zranit?
function canDamage(e, type, o) {
  if (type === 'true' || type === 'normal') return true;
  const tr = e.def.traits, arm = e.armored && !o.lead;
  if (type === 'sharp') return !arm && !(frozen(e) && !e.brittle);
  if (type === 'explosion') return !tr.includes('explosion_immune');
  if (type === 'freeze') return !tr.includes('freeze_immune');
  if (type === 'energy') return !tr.includes('energy_immune') || o.ignoreRune;
  if (type === 'magic') return (!tr.includes('magic_immune') || o.ignoreRune) && !arm;
  return true;
}

// Zásah. dmg = základ, o = { boss, camoB, heavy, fortB, lead, ignoreRune, src, cash }
function hitEnemy(e, dmg, type, o = {}) {
  if (e.dead || dmg <= 0) return false;
  const src = o.src;
  if (src?.aura?.trueD) type = 'true';   // Královská zbrojnice: vše v dosahu zraní cokoliv
  else if (src?.buff && src.buff.until > G.time && src.buff.lead) o = { ...o, lead: true };
  if (!canDamage(e, type, o)) { e.immuneFlash = G.time; return false; }
  let d = dmg;
  if (isBoss(e)) d += o.boss || 0;
  if (e.camo && o.camoB) d += o.camoB;
  if (e.def.hp > 1 && o.heavy) d += o.heavy;
  if (e.fort && o.fortB) d += o.fortB;
  if (e.vulnUntil > G.time && (!isBoss(e) || e.vulnBoss)) d += e.vuln;
  if (e.vulnMulUntil > G.time) d *= e.vulnMul;
  if (e.seal && e.seal.s > 0) d *= 1 - e.def.seal.red;
  e.hp -= d; e.lastHit = G.time;
  if (o.src) o.src.dmgDone = (o.src.dmgDone || 0) + Math.min(d, d + e.hp);
  if (e.hp <= 0) killEnemy(e, -e.hp, type, o);
  return true;
}

function cashScale() {
  const w = Math.max(1, G.wave);
  const r = ECON.singleplayer.pop_reward_scaling_by_wave.find(s => w >= s.from_wave && w <= s.to_wave);
  return r ? r.multiplier : 0.2;
}
function killEnemy(e, overflow, type, o) {
  e.dead = true;
  G.stats.pops++;
  // zlaťáky za vrstvu
  let g = e.def.gold * (e.goldMul > 1 ? e.goldMul : cashScale());
  if (o.src?.aura?.cash) g *= 1 + o.src.aura.cash;
  if (G.blessUntil > G.time) g += 1;
  addGold(g, true);
  if (e.bounty) { addGold(e.bounty); G.stats.bounty = (G.stats.bounty || 0) + e.bounty; floatText(e.x, e.y - 14, '+' + Math.round(e.bounty), '#fde047'); }
  for (const t of G.necros) if (Math.hypot(t.x - e.x, t.y - e.y) < t.st.range) { t.souls = Math.min(t.fx.graveyard_max_souls || 50, (t.souls || 0) + 1); break; }
  if (e.coated && isBoss(e)) explode(e.x, e.y, e.coatR, e.maxHp * e.coatPct, 'true', 999, null, { kind: 'boom' });
  if (isBoss(e)) addFx({ kind: 'bossdie', x: e.x, y: e.y, r: e.def.r, col: e.def.col, dur: 0.6 });
  else if (Math.random() < 0.35 || e.def.hp > 1) addFx({ kind: 'splat', x: e.x, y: e.y, r: e.def.r, col: e.def.col, dur: 0.35 });
  // potomci (vrstvy)
  if (e.shrunk) return;
  const kids = [];
  e.def.kids.forEach(k => {
    for (let i = 0; i < k.n; i++) {
      const mods = k.mods ? [...k.mods] : [];
      if (e.camo && !mods.includes('duchsliz')) mods.push('duchsliz');
      if (e.regrow && !mods.includes('dorustajici')) mods.push('dorustajici');
      const kid = spawnEnemy(k.id, e.path, Math.max(-20, e.d - kids.length * 7), mods,
        { hist: e.regrow || mods.includes('dorustajici') ? [...e.hist, e.t] : [], origin: e.origin, noSeal: true, spdMul: e.spdMul, hpMul: e.hpMulKids || 1 });
      if (!kid) continue;
      kid.revealed = e.revealed; kid.armored = kid.armored && !e.stripLeadKids;
      kid.lastHit = G.time; kid.goldMul = e.goldMul > 1 ? e.goldMul : 1;
      kids.push(kid);
    }
  });
  if (overflow > 0.0001) kids.forEach(k => hitEnemy(k, overflow, type, { ...o, src: o.src }));
}

function onBossSpawn(e) {
  addFx({ kind: 'bossin', x: e.x, y: e.y, dur: 1.2 });
  window.sfx?.('tower');
  for (const t of G.towers) if (t.fx.passive_auto_missile_on_moab_spawn_damage) {
    G.later.push({ at: G.time + 0.6, fn: () => { if (!e.dead) { addFx({ kind: 'missile', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.4 }); hitEnemy(e, t.fx.passive_auto_missile_on_moab_spawn_damage, 'true', { src: t }); } } });
  }
}
function breakSeals(n, only) {
  for (const e of G.enemies) if (e.seal && e.seal.s > 0 && (!only || only === e)) {
    e.seal.s = Math.max(0, e.seal.s - n / e.seal.n);
    addFx({ kind: 'sealbreak', x: e.x, y: e.y, r: e.def.r, dur: 0.6 });
  }
}

/* ── Prostorová mřížka pro rychlé hledání slizáků ─────────────── */
const CELL = 80;
let _grid = new Map();
function rebuildGrid() {
  _grid = new Map();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const k = (Math.floor(e.x / CELL) + 50) * 1000 + Math.floor(e.y / CELL) + 50;
    let a = _grid.get(k); if (!a) _grid.set(k, a = []); a.push(e);
  }
}
function enemiesNear(x, y, r) {
  const out = [], r2 = r + 52;
  const x0 = Math.floor((x - r2) / CELL), x1 = Math.floor((x + r2) / CELL), y0 = Math.floor((y - r2) / CELL), y1 = Math.floor((y + r2) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = _grid.get((cx + 50) * 1000 + cy + 50); if (!a) continue;
    for (const e of a) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.def.r) out.push(e);
  }
  return out;
}
const progressOf = e => e.d / G.paths[e.path].len;
function pickTarget(t, range, opts = {}) {
  let cands = range >= 1900 ? G.enemies.filter(e => !e.dead) : enemiesNear(t.x, t.y, range);
  if (opts.shared) {   // Holubí pošta: cokoliv v dosahu libovolné věže
    const seen = new Set(cands);
    for (const o of G.towers) if (o !== t && o.st.range && o.st.range < 1900) enemiesNear(o.x, o.y, o.st.range).forEach(e => seen.add(e));
    cands = [...seen];
  }
  cands = cands.filter(e => visibleTo(e, t) && e.d > -10 && (!opts.skip || !opts.skip.has(e)));
  if (!cands.length) return null;
  const mode = t.target || 'first';
  let best = null, bv = -Infinity;
  for (const e of cands) {
    let v;
    if (mode === 'first') v = progressOf(e);
    else if (mode === 'last') v = -progressOf(e);
    else if (mode === 'strong') v = (isBoss(e) ? 1e6 : 0) + rbeOf(e.t) * 10 + progressOf(e);
    else v = -Math.hypot(e.x - t.x, e.y - t.y);
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}
function strongestEnemy(bossOnly) {
  let best = null, bv = -1;
  for (const e of G.enemies) if (!e.dead && (!bossOnly || isBoss(e))) { const v = (isBoss(e) ? 1e6 : 0) + e.hp + rbeOf(e.t); if (v > bv) { bv = v; best = e; } }
  return best;
}
function randomEnemies(n) {
  const a = G.enemies.filter(e => !e.dead && e.d > 0);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/* ── Efekty (jen pro vykreslení) ───────────────────────────────── */
function addFx(f) { f.t0 = G.time; if (G.fx.length < 500) G.fx.push(f); }
function floatText(x, y, txt, col) { if (G.floats.length < 60) G.floats.push({ x, y, txt, col, t0: G.time }); }

/* ── Ekonomika ─────────────────────────────────────────────────── */
function addGold(n, fromPop) {
  if (!(n > 0)) return;
  G.gold += n; G.stats.earned += n; if (fromPop) G.stats.popGold += n;
}
function spend(n) { if (G.gold + 1e-6 < n) return false; G.gold -= n; return true; }

/* ── Věže ──────────────────────────────────────────────────────── */
const GEN = /^(.*?)_(add|mult|set)(?:_px|_s)?$/;
const STAT_KEY = { range: 'range', damage: 'damage', pierce: 'pierce', attack_interval: 'interval', projectiles: 'projectiles',
  explosion_radius: 'expl', splash_radius: 'expl', freeze_duration: 'freeze', acid_dot_dps: 'acid', acid_duration: 'acidDur',
  projectile_speed: 'pspeed', damage_type: 'type', income_per_wave: 'income', flame_damage: 'flameAdd', cluster_damage: 'clusterAdd',
  carts: 'carts', cart_value: 'cartVal', cart_value_pct: 'cartPct', cart_mult: 'cartMul' };
const SET_KEYS = { explosion_radius_px: 'expl', can_see_camo: 'camo', payouts_per_wave: 'payouts', attack_mode_set: 'mode' };

function recalcTower(t) {
  const def = TDEF[t.type], b = def.base;
  const st = { range: b.range_px || 0, damage: b.damage || 0, pierce: b.pierce || 1, interval: b.attack_interval_s || 1, projectiles: b.projectiles || 1,
    expl: b.explosion_radius_px || b.splash_radius_px || 0, freeze: b.freeze_duration_s || 0, acid: b.acid_dot_dps || 0, acidDur: b.acid_duration_s || 0,
    pspeed: 1, type: b.damage_type, camo: !!b.can_see_camo, income: b.income_per_wave || 0, payouts: b.payouts_per_wave || 4, flameAdd: 0, clusterAdd: 0, mode: null,
    carts: 4, cartVal: Math.round((b.income_per_wave || 0) / 4), cartPct: 0, cartMul: 1 };
  const fx = {}, mults = {};
  let ability = null;
  // Nové věže: parametry útoku jsou výchozí efekty; klíče bez jednotky (trap_lifetime_s → trap_lifetime)
  const stripU = k => k.replace(/(_px_s|_px|_s)$/, '');
  if (def.isNew) for (const [k, v] of Object.entries(def.attack || {})) { fx[k] = v; fx[stripU(k)] = v; }
  for (let tier = 1; tier <= 5; tier++) for (let p = 0; p < 3; p++) {
    if (t.up[p] < tier) continue;
    const u = def.paths[p][tier - 1];
    for (const [k, v] of Object.entries(u.fx)) {
      if (k === 'ability' || k === 'ability_upgrade') { ability = { ...v, key: t.type + ':' + (p + 1) + ':' + tier, tier }; continue; }
      if (SET_KEYS[k]) { st[SET_KEYS[k]] = v; continue; }
      const m = GEN.exec(k);
      if (m && STAT_KEY[m[1]] && !k.startsWith('buff_')) {
        const s = STAT_KEY[m[1]];
        if (m[2] === 'set') st[s] = v;
        else if (m[2] === 'add') st[s] = (st[s] || 0) + v;
        else mults[s] = (mults[s] || 1) * v;
        continue;
      }
      // vlastní klíč nové věže: _add/_mult/_set se přičítá k základu (násobek bez základu je samostatná hodnota, např. trap_cash_bonus_mult)
      if (def.isNew && m && typeof v === 'number' && !(m[2] === 'mult' && fx[m[1]] === undefined)) {
        const b = m[1];
        fx[b] = m[2] === 'set' ? v : m[2] === 'add' ? (fx[b] || 0) + v : (fx[b] ?? 1) * v;
        continue;
      }
      fx[k] = v;
      if (def.isNew) fx[stripU(k)] = v;
    }
  }
  for (const [s, m] of Object.entries(mults)) st[s] *= m;
  if (ability && fx.ability_cooldown) ability.cooldown_s = fx.ability_cooldown;
  t.st = st; t.fx = fx; t.ability = ability;
  if (ability && t.abilityKey !== ability.key) { t.abilityKey = ability.key; t.cdUntil = G.time + 2; }
  if (!ability) t.abilityKey = null;
  G.necros = G.towers.filter(x => x.fx.graveyard_max_souls);
  G.auraDirty = true;
}
function maxTier(t) { return Math.max(...t.up); }

// Pravidlo 5-2-0: jedna cesta až na 5, druhá nejvýš na 2, třetí nic.
function canUpgradePath(t, p) {
  const n = t.up[p] + 1; if (n > 5) return { ok: false, why: 'Hotovo' };
  const up = t.up.slice(); up[p] = n;
  const s = up.slice().sort((a, b) => b - a);
  if (s[2] > 0) return { ok: false, why: 'Zamčeno (max 2 cesty)' };
  if (s[1] > 2) return { ok: false, why: 'Zamčeno (druhá cesta max 2)' };
  if (n === 5 && G.towers.some(o => o !== t && o.type === t.type && o.up[p] === 5)) return { ok: false, why: 'Úroveň 5 už na mapě stojí' };
  return { ok: true };
}
function discountAt(x, y, tier) {
  if (tier > 3) return 0;
  let d = 0;
  for (const h of G.towers) if (h.type === 'strazni_hlaska' && h.fx.discount_upgrades_t1_to_t3_pct && Math.hypot(h.x - x, h.y - y) <= h.st.range) d += h.fx.discount_upgrades_t1_to_t3_pct;
  return Math.min(0.25, d);
}
function freeUpgrade(t, tier) {
  if (TDEF[t.type].cat !== 'basic' || tier > 2) return false;
  for (const h of G.towers) if (h.type === 'strazni_hlaska' && Math.hypot(h.x - t.x, h.y - t.y) <= h.st.range) {
    if (tier === 1 && (h.fx.free_tier1_upgrades_for_basic_towers || h.fx.free_tier2_upgrades_for_basic_towers)) return true;
    if (tier === 2 && h.fx.free_tier2_upgrades_for_basic_towers) return true;
  }
  return false;
}
function upgradeCost(t, p) {
  const u = TDEF[t.type].paths[p][t.up[p]]; if (!u) return null;
  if (freeUpgrade(t, u.tier)) return { gold: 0, km: u.km, u };
  let g = u.cost * G.costMul * (1 - discountAt(t.x, t.y, u.tier));
  if (G.nextUpgradeDiscount && G.nextUpgradeDiscount.until > G.time && Math.hypot(G.nextUpgradeDiscount.x - t.x, G.nextUpgradeDiscount.y - t.y) <= G.nextUpgradeDiscount.r) g *= 1 - G.nextUpgradeDiscount.pct;
  return { gold: Math.round(g), km: u.km, u };
}
function buyUpgrade(t, p) {
  const ok = canUpgradePath(t, p); if (!ok.ok) return ok.why;
  const c = upgradeCost(t, p); if (!c) return 'Hotovo';
  if (G.km < c.km) return `Potřebuješ ${c.km} 💎`;
  if (G.gold + 1e-6 < c.gold) return 'Málo zlaťáků';
  G.gold -= c.gold; G.km -= c.km; t.spent += c.gold; t.kmSpent += c.km;
  if (G.nextUpgradeDiscount && G.nextUpgradeDiscount.until > G.time && Math.hypot(G.nextUpgradeDiscount.x - t.x, G.nextUpgradeDiscount.y - t.y) <= G.nextUpgradeDiscount.r) G.nextUpgradeDiscount = null;
  t.up[p]++;
  recalcTower(t);
  addFx({ kind: 'upgrade', x: t.x, y: t.y, dur: 0.6 });
  window.sfx?.('ok');
  return null;
}
function towerCost(type, x, y) { return Math.round(TDEF[type].base.cost * G.costMul * (1 - discountAt(x, y, 1))); }
function heroCost(id) { return Math.round(HDEF[id].base.cost * G.costMul); }

function inRect(x, y, r, z, pad = 0) { return x + r > z.x - pad && x - r < z.x + z.width + pad && y + r > z.y - pad && y - r < z.y + z.height + pad; }
function inWater(x, y, r) { return (G.map.water_zones || []).some(z => inRect(x, y, -r * 0.4, z)); }
function touchesWater(x, y, r) { return (G.map.water_zones || []).some(z => inRect(x, y, r * 0.7, z)); }
function waterFrozenAt(x, y) {
  return G.towers.some(t => t.fx.freeze_on_water_allow_land_towers && Math.hypot(t.x - x, t.y - y) <= t.st.range);
}
// Dá se tady postavit? Vrací null, nebo důvod.
function placeProblem(type, x, y, ignore) {
  const def = TDEF[type] || HDEF[type] || { base: { radius_px: 20, placement: 'land' } };
  const r = def.base.radius_px || 20, water = def.base.placement === 'water';
  if (x < r || y < r || x > TW - r || y > TH - r) return 'Mimo mapu';
  const vsMax = G.vs && def.base.max_instances_in_versus;
  if (vsMax && !ignore && G.towers.filter(t => t.type === type).length >= vsMax) return `Ve versus nejvýš ${vsMax}×`;
  if (distToTrack(x, y) < TRACK_HALF + r * 0.75) return 'Na cestě';
  for (const o of G.map.obstacles || []) if (!o.removed && inRect(x, y, r * 0.8, o)) return o.name;
  if (water && !inWater(x, y, r)) return 'Loď jen do vody';
  if (!water && touchesWater(x, y, r) && !waterFrozenAt(x, y)) return 'Do vody jen loď';
  for (const o of [...G.towers, G.hero].filter(Boolean)) if (o !== ignore && Math.hypot(o.x - x, o.y - y) < (o.r + r) * 0.92) return 'Moc blízko jiné věži';
  return null;
}
function placeTower(type, x, y) {
  const why = placeProblem(type, x, y); if (why) return why;
  const cost = towerCost(type, x, y);
  if (!spend(cost)) return 'Málo zlaťáků';
  const def = TDEF[type];
  const t = { id: ++_uid, type, x, y, r: def.base.radius_px || 20, up: [0, 0, 0], spent: cost, kmSpent: 0, cd: 0, cdUntil: 0, target: 'first',
    shots: 0, dmgDone: 0, ang: -Math.PI / 2, timers: {}, placedWave: G.wave };
  G.towers.push(t);
  recalcTower(t);
  window.sfx?.('place');
  addFx({ kind: 'place', x, y, r: t.r, dur: 0.4 });
  return null;
}
function sellValue(t) {
  const pct = (G.waveActive ? ECON.singleplayer.sell_refund_during_wave_pct : ECON.singleplayer.sell_refund_between_waves_pct) + (t.fx.sell_value_bonus_pct || 0);
  return Math.round(t.spent * Math.min(0.95, pct));
}
function sellTower(t) {
  G.gold += sellValue(t); G.km += t.kmSpent;
  G.towers = G.towers.filter(x => x !== t);
  G.necros = G.towers.filter(x => x.fx.graveyard_max_souls);
  G.auraDirty = true;
  addFx({ kind: 'sell', x: t.x, y: t.y, dur: 0.4 });
  window.sfx?.('coin');
}

/* ── Aury podpory (hláska, alchymista, hrdinové, globální bonusy) ─ */
function refreshAuras() {
  G.auraDirty = false;
  const glob = { snipers: 0, galleyMul: 1, galleyPrc: 0, magicDmg: 0, cdRed: 0, heroXp: 1, markets: 0 };
  for (const t of G.towers) {
    if (t.fx.buff_all_snipers_speed_pct) glob.snipers = Math.max(glob.snipers, t.fx.buff_all_snipers_speed_pct);
    if (t.fx.buff_all_subs_damage_mult) { glob.galleyMul = Math.max(glob.galleyMul, t.fx.buff_all_subs_damage_mult); glob.galleyPrc = Math.max(glob.galleyPrc, t.fx.buff_all_subs_pierce_add || 0); }
    if (t.fx.buff_all_magic_towers_damage_add) glob.magicDmg = Math.max(glob.magicDmg, t.fx.buff_all_magic_towers_damage_add);
    if (t.fx.global_cooldown_reduction_pct) glob.cdRed = Math.max(glob.cdRed, t.fx.global_cooldown_reduction_pct);
    if (t.fx.hero_xp_gain_mult) glob.heroXp = Math.max(glob.heroXp, t.fx.hero_xp_gain_mult);
    if (t.type === 'zlaty_dul' && t.up[2] >= 3) glob.markets++;
    if (t.fx.global_tower_attack_speed_per_market_pct) glob.marketPct = t.fx.global_tower_attack_speed_per_market_pct;
  }
  G.glob = glob;
  const all = [...G.towers, G.hero].filter(Boolean);
  for (const t of all) {
    const a = { spd: 0, rng: 0, prc: 0, dmg: 0, camo: false, trueD: false, cash: 0, cdRed: 0, mine: 0, pspd: 0 };
    const cat = t.hero ? 'hero' : TDEF[t.type].cat;
    for (const h of G.towers) {
      if (h.type !== 'strazni_hlaska' || h === t) continue;
      if (Math.hypot(h.x - t.x, h.y - t.y) > h.st.range) continue;
      a.rng = Math.max(a.rng, TDEF.strazni_hlaska.base.aura_range_bonus_pct);
      if (h.fx.aura_attack_speed_bonus_pct) a.spd = Math.max(a.spd, h.fx.aura_attack_speed_bonus_pct);
      if (cat === 'basic' && h.fx.basic_towers_pierce_add) { a.prc += h.fx.basic_towers_pierce_add; a.rng += h.fx.basic_towers_range_pct || 0; a.pspd = h.fx.basic_towers_projectile_speed_pct || 0; }
      if (cat === 'basic' && h.fx.basic_towers_damage_add) a.dmg += h.fx.basic_towers_damage_add;
      if (h.fx.aura_cooldown_reduction_pct) a.cdRed = Math.max(a.cdRed, h.fx.aura_cooldown_reduction_pct);
      if (h.fx.grant_camo_vision_to_all_in_radius) a.camo = true;
      if (h.fx.grant_true_damage_type_to_all_in_radius) a.trueD = true;
      if (h.fx.bonus_cash_per_pop_in_radius_pct) a.cash = Math.max(a.cash, h.fx.bonus_cash_per_pop_in_radius_pct);
      if (t.type === 'zlaty_dul') a.mine += h.up[2] >= 5 ? 0.5 : (h.fx.bonus_cash_from_farms_in_radius_pct || 0);
    }
    // Oskar: věže v jeho dosahu
    const hero = G.hero;
    if (hero && hero !== t && hero.id === 'kronikar_oskar' && Math.hypot(hero.x - t.x, hero.y - t.y) <= hero.st.range) {
      const L = hero.level;
      if (L >= 4) a.rng += 0.1;
      if (L >= 11) a.dmg += L >= 19 ? 2 : 1;
      if (L >= 16) a.spd += 0.15;
      if (L >= 19) a.boss = 5;
    }
    if (hero && hero !== t && hero.id === 'lovec_bedrich' && hero.level >= 18 && (t.type === 'orli_ostrostrelec' || t.type === 'kralovsky_lucistnik') && Math.hypot(hero.x - t.x, hero.y - t.y) <= hero.st.range) a.spd += 0.15;
    if (hero && hero !== t && hero.id === 'carodejka_radka' && hero.level >= 8 && cat === 'magic' && Math.hypot(hero.x - t.x, hero.y - t.y) <= hero.st.range) a.prc += 3;
    if (t.type === 'orli_ostrostrelec') a.spd += glob.snipers;
    if (cat === 'magic') a.dmg += glob.magicDmg;
    if (t.type === 'ricni_galera') a.prc += glob.galleyPrc;
    if (glob.marketPct) a.spd += glob.marketPct * glob.markets;
    t.aura = a;
  }
  if (typeof xAuras === 'function') xAuras();   // nové věže (td-xtowers.js)
}
// Okamžité násobiče (buffy se časem mění, proto se počítají za běhu)
function speedMul(t) {
  let m = 1 + (t.aura?.spd || 0) + (t.hero ? heroSpeedBonus(t) : 0);
  if (G.streakUntil > G.time) m += ECON.flashcards.streak_buff_attack_speed_pct;
  if (G.hornAll > G.time) m += 1;
  if (t.hornUntil > G.time) m += 0.5;
  if (G.blessUntil > G.time) m += G.blessSpd;
  if (t.buff && t.buff.until > G.time) m += t.buff.spd || 0;
  if (t.rainUntil > G.time) m *= 3;
  if (t.type === 'kralovsky_lucistnik' && G.archerRush > G.time) m += 1.5;
  if (typeof xSpeed === 'function') m += xSpeed(t);
  if (G.vs) {
    if (G.vs.focusUntil > G.time) m += VS.ffa_3_to_4_players.stage_1_mild_focus.defender_attack_speed_buff_pct;
    if (G.vs.curse && G.vs.curse.id === t.id && G.vs.curse.until > G.time) m *= 0.5;
  }
  return m;
}
function effRange(t) { return t.st.range * (1 + (t.aura?.rng || 0) + (t.buff && t.buff.until > G.time ? t.buff.rng || 0 : 0)); }
function effPierce(t) {
  let p = t.st.pierce + (t.aura?.prc || 0) + (t.buff && t.buff.until > G.time ? t.buff.prc || 0 : 0) + (G.blessUntil > G.time ? 3 : 0);
  if (G.hornAll > G.time) p *= 2; else if (t.hornUntil > G.time) p *= 1.5;
  return Math.max(1, Math.round(p));
}
function effDamage(t) {
  let d = t.st.damage + (t.aura?.dmg || 0) + (t.buff && t.buff.until > G.time ? t.buff.dmg || 0 : 0);
  if (t.type === 'ricni_galera') d *= G.glob?.galleyMul || 1;
  if (t.fx.bonus_damage_per_10_souls) d += Math.floor((t.souls || 0) / 10) * t.fx.bonus_damage_per_10_souls;
  return d;
}
function hitOpts(t, extra) {
  return { src: t, boss: (t.fx.bonus_boss_damage || t.fx.bonus_moab_damage || t.fx.moab_damage_bonus || 0) + (t.aura?.boss || 0) + (t.buff && t.buff.until > G.time ? t.buff.boss || 0 : 0),
    camoB: t.fx.camo_damage_bonus || 0, heavy: t.fx.bonus_ceramic_damage || 0, fortB: t.fx.bonus_fortified_damage || 0,
    lead: (t.buff && t.buff.until > G.time && t.buff.lead) || (t.type === 'kralovsky_lucistnik' && G.archerRush > G.time), ...extra };
}

/* ── Střely ────────────────────────────────────────────────────── */
// p: { x,y, ang, spd, dist(max), dmg, type, pierce, src, r, kind, expl?, homing?, tx,ty (cíl výbuchu), onHit? }
function shoot(p) {
  p.vx = Math.cos(p.ang) * p.spd; p.vy = Math.sin(p.ang) * p.spd; p.trav = 0; p.hits = p.hits || new Set(); p.r = p.r || 6;
  if (G.projs.length < 1400) G.projs.push(p);
  return p;
}
function explode(x, y, r, dmg, type, pierce, src, o = {}) {
  addFx({ kind: o.kind || 'boom', x, y, r, dur: 0.35, col: o.col });
  let n = 0;
  const list = enemiesNear(x, y, r).sort((a, b) => progressOf(b) - progressOf(a));
  for (const e of list) {
    if (n >= pierce) break;
    n++;
    const ok = hitEnemy(e, dmg, type, src ? hitOpts(src, o.hit) : (o.hit || {}));
    if (!e.dead && ok !== false) o.each?.(e);
  }
  return n;
}
function updateProjs(dt) {
  for (const p of G.projs) {
    if (p.dead) continue;
    if (p.homing) {
      if (!p.tgt || p.tgt.dead) p.tgt = pickTarget({ x: p.x, y: p.y, target: 'close', st: p.src?.st, aura: p.src?.aura }, 260);
      if (p.tgt) {
        const want = Math.atan2(p.tgt.y - p.y, p.tgt.x - p.x);
        let da = want - p.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        p.ang += Math.max(-8 * dt, Math.min(8 * dt, da));
        p.vx = Math.cos(p.ang) * p.spd; p.vy = Math.sin(p.ang) * p.spd;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.trav += p.spd * dt;
    if (p.lob) {   // výbušné střely letí na místo a tam vybuchnou
      if (p.trav >= p.dist || (!p.arc && enemiesNear(p.x, p.y, p.r).length)) { p.dead = true; p.onBurst?.(p); }
      continue;
    }
    if (p.trav > p.dist || p.x < -60 || p.y < -60 || p.x > TW + 60 || p.y > TH + 60) { p.dead = true; continue; }
    for (const e of enemiesNear(p.x, p.y, p.r)) {
      if (p.hits.has(e)) continue;
      p.hits.add(e);
      const dmg = typeof p.dmg === 'function' ? p.dmg(e) : p.dmg;
      hitEnemy(e, dmg, p.type, p.src ? hitOpts(p.src, p.hit) : (p.hit || {}));
      p.onHit?.(p, e);
      if (--p.pierce <= 0) { p.dead = true; break; }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

// Zóny na cestě (ohnivá stěna, kyselinová louže, bouře živlů…)
function updateZones(dt) {
  for (const z of G.zones) {
    if (G.time > z.until) { z.dead = true; continue; }
    z.acc = (z.acc || 0) + dt;
    if (z.acc < 0.2) continue;
    const k = z.acc; z.acc = 0;
    let n = 0;
    for (const e of enemiesNear(z.x, z.y, z.r)) {
      if (n++ >= (z.pierce || 999)) break;
      hitEnemy(e, z.dps * k, z.type || 'normal', z.src ? hitOpts(z.src) : {});
      if (z.slow) slow(e, z.slow, G.time + 0.4);
    }
  }
  G.zones = G.zones.filter(z => !z.dead);
}

/* ── Útoky jednotlivých věží ───────────────────────────────────── */
function aimAt(t, e) { t.ang = Math.atan2(e.y - t.y, e.x - t.x); }
function projSpeed(t, base) { return base * (t.st.pspeed || 1) * (1 + (t.aura?.pspd || 0)); }

function bounceFrom(t, x, y, from, left, dmg, type, hitSet, radius = 130) {
  if (left <= 0) return;
  const cand = enemiesNear(x, y, radius).filter(e => !hitSet.has(e) && e !== from && visibleTo(e, t));
  if (!cand.length) return;
  const e = cand.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  hitSet.add(e);
  addFx({ kind: 'zap', x, y, tx: e.x, ty: e.y, dur: 0.15, col: '#fde68a' });
  hitEnemy(e, dmg, type, hitOpts(t));
  if (t.fx.shrapnel_count) shrapnel(t, e);
  bounceFrom(t, e.x, e.y, e, left - 1, dmg, type, hitSet, radius);
}
function shrapnel(t, e) {
  const base = Math.atan2(e.y - t.y, e.x - t.x);
  for (let i = 0; i < t.fx.shrapnel_count; i++) {
    shoot({ x: e.x, y: e.y, ang: base + (i - (t.fx.shrapnel_count - 1) / 2) * 0.22, spd: 560, dist: 140, dmg: t.fx.shrapnel_damage || 1, type: 'sharp', pierce: t.fx.shrapnel_pierce || 3, src: t, kind: 'shard', r: 5, hits: new Set([e]) });
  }
}

const ATTACK = {
  kralovsky_lucistnik(t, e) {
    aimAt(t, e);
    const n = Math.max(1, Math.round(t.st.projectiles)), spread = (t.fx.spread_deg || 18) * Math.PI / 180;
    t.shots++;
    const big = t.fx.guaranteed_crit_every_n_shots && t.shots % t.fx.guaranteed_crit_every_n_shots === 0;
    for (let i = 0; i < n; i++) {
      const ang = t.ang + (n > 1 ? (i - (n - 1) / 2) * spread / Math.max(1, (n - 1) / 2) * 0.5 : 0);
      let crit = 1;
      const cc = (t.fx.crit_chance || 0) + (t.rainUntil > G.time ? 0.5 : 0);
      if (cc && Math.random() < cc) crit = t.fx.crit_multiplier || 4;
      shoot({ x: t.x, y: t.y, ang, spd: projSpeed(t, 640), dist: effRange(t) * 1.25, dmg: effDamage(t) * crit, type: t.st.type, pierce: effPierce(t), src: t, kind: crit > 1 ? 'arrowCrit' : 'arrow', r: 7,
        onHit: (p, hit) => {
          if (t.fx.bounce_targets && !p.bounced) { p.bounced = true; bounceFrom(t, hit.x, hit.y, hit, t.fx.bounce_targets, p.dmg, p.type, new Set([hit])); }
          if (big && !p.boomed) { p.boomed = true; explode(hit.x, hit.y, 55, 120, 'true', 30, t, { kind: 'boomGold' }); }
        } });
    }
  },
  cepova_vez(t) {
    if (t.fx.continuous_aura) {   // Ohnivý prstenec / Sopečná výheň
      addFx({ kind: 'ring', x: t.x, y: t.y, r: effRange(t), dur: 0.25, col: '#f97316' });
      let n = 0, prc = effPierce(t);
      for (const e of enemiesNear(t.x, t.y, effRange(t))) {
        if (n++ >= prc) break;
        hitEnemy(e, effDamage(t), t.st.type, hitOpts(t));
        if (t.fx.burn_dps) e.burn = { dps: t.fx.burn_dps, until: G.time + (t.fx.burn_duration_s || 3), src: t };
      }
      return;
    }
    const n = Math.max(1, Math.round(t.st.projectiles));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (t.shots % 2) * (Math.PI / n);
      shoot({ x: t.x, y: t.y, ang, spd: projSpeed(t, 470), dist: effRange(t), dmg: effDamage(t), type: t.st.type, pierce: effPierce(t), src: t, kind: t.fx.strip_regrow ? 'blade' : t.fx.burn_dps ? 'flame' : 'spike', r: 7,
        onHit: (p, e) => {
          if (t.fx.burn_dps) e.burn = { dps: t.fx.burn_dps, until: G.time + (t.fx.burn_duration_s || 3), src: t };
          if (t.fx.strip_regrow) e.regrow = false;
        } });
    }
    t.shots++;
  },
  mrazivy_mag(t, e) {
    const dur = t.st.freeze || 1.2;
    const onFreezeHit = x => {
      if (isBoss(x)) {
        if (t.fx.can_freeze_moab) freeze(x, 0.8, t);
        if (t.fx.slow_moab_pct) slow(x, t.fx.slow_moab_pct, G.time + 2);
      } else freeze(x, dur, t);
      if (t.fx.strip_camo_on_hit) x.revealed = true;
      if (t.fx.strip_lead && !isBoss(x)) { x.armored = false; x.stripLeadKids = true; }
      if (t.fx.debuff_incoming_damage_add && (!isBoss(x) || t.fx.affect_moab)) { x.vuln = Math.max(x.vuln, t.fx.debuff_incoming_damage_add); x.vulnUntil = G.time + 4; x.vulnBoss = !!t.fx.affect_moab; }
      if (t.fx.slow_after_thaw_pct) slow(x, t.fx.slow_after_thaw_pct, G.time + dur + (t.fx.slow_duration_s || 3));
    };
    if (t.st.mode === 'projectile') {
      aimAt(t, e);
      const d = Math.min(effRange(t), Math.hypot(e.x - t.x, e.y - t.y));
      shoot({ x: t.x, y: t.y, ang: t.ang, spd: projSpeed(t, 420), dist: d, lob: true, r: 8, kind: 'iceball', src: t,
        onBurst: p => {
          explode(p.x, p.y, t.st.expl || 45, effDamage(t), t.st.type === 'freeze' ? 'freeze' : t.st.type, effPierce(t), t, { kind: 'frost', hit: {}, each: x => onFreezeHit(x) });
          if (t.fx.shatter_spikes_on_hit) for (let i = 0; i < t.fx.shatter_spikes_on_hit; i++) shoot({ x: p.x, y: p.y, ang: i / t.fx.shatter_spikes_on_hit * 6.283, spd: 420, dist: 110, dmg: t.fx.spike_damage || 2, type: 'sharp', pierce: 2, src: t, kind: 'icicle', r: 5 });
        } });
      return;
    }
    // kruhový mrazivý pulz kolem mága
    addFx({ kind: 'frostRing', x: t.x, y: t.y, r: effRange(t), dur: 0.45 });
    let n = 0; const prc = effPierce(t);
    for (const x of enemiesNear(t.x, t.y, effRange(t))) {
      if (n >= prc) break;
      if (frozen(x) && !t.fx.can_refreeze) continue;
      n++;
      hitEnemy(x, effDamage(t), 'freeze', hitOpts(t));
      if (!x.dead) onFreezeHit(x);
    }
  },
  orli_ostrostrelec(t, e) {
    aimAt(t, e);
    let dmg = effDamage(t);
    if (t.fx.speed_boost_per_leak_pct) dmg *= 1 + progressOf(e) * t.fx.speed_boost_per_leak_pct;
    addFx({ kind: 'tracer', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.12 });
    hitEnemy(e, dmg, t.st.type, hitOpts(t));
    if (isBoss(e) && t.fx.stun_moab_duration_s) stun(e, t.fx.stun_moab_duration_s);
    if (isBoss(e) && t.fx.target_takes_extra_damage_from_all) { e.vuln = Math.max(e.vuln, t.fx.target_takes_extra_damage_from_all); e.vulnUntil = G.time + 3; e.vulnBoss = true; }
    if (t.fx.shrapnel_count) shrapnel(t, e);
    if (t.fx.bounce_targets) bounceFrom(t, e.x, e.y, e, t.fx.bounce_targets, dmg, t.st.type, new Set([e]), 120);
  },
  oblehaci_katapult(t, e) {
    aimAt(t, e);
    t.shots++;
    const d = Math.min(effRange(t), Math.hypot(e.x - t.x, e.y - t.y) + 6);
    const second = t.fx.recursive_every_shot || (t.fx.recursive_every_2nd_shot && t.shots % 2 === 0);
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: projSpeed(t, t.st.pspeed > 1 ? 380 : 330), dist: d, lob: true, r: 9, kind: t.fx.bonus_moab_damage >= 15 ? 'harpoonBolt' : 'barrel', src: t,
      onBurst: p => {
        const stunE = x => { if (t.fx.stun_duration_s && (!isBoss(x) || t.fx.can_stun_moab)) stun(x, t.fx.stun_duration_s); if (t.fx.knockback_px && !isBoss(x)) x.d = Math.max(0, x.d - t.fx.knockback_px); };
        explode(p.x, p.y, t.st.expl || 45, effDamage(t), t.st.type, effPierce(t), t, { kind: 'boom', each: stunE });
        if (t.fx.sub_fragments) for (let i = 0; i < t.fx.sub_fragments; i++) shoot({ x: p.x, y: p.y, ang: i / t.fx.sub_fragments * 6.283, spd: 420, dist: 90, dmg: t.fx.fragment_damage || 1, type: t.fx.fragment_damage_type || 'sharp', pierce: 2, src: t, kind: 'shard', r: 5 });
        if (t.fx.cluster_bombs) {
          const wave = (cx, cy, depth) => {
            for (let i = 0; i < t.fx.cluster_bombs; i++) {
              const a = i / t.fx.cluster_bombs * 6.283 + depth, bx = cx + Math.cos(a) * 34, by = cy + Math.sin(a) * 34;
              G.later.push({ at: G.time + 0.08 + depth * 0.15, fn: () => explode(bx, by, 30, (t.fx.cluster_damage || 1) + t.st.clusterAdd, 'normal', 12, t, { kind: 'boomSmall' }) });
            }
          };
          wave(p.x, p.y, 0);
          if (second) wave(p.x, p.y, 1);
        }
      } });
  },
  ricni_galera(t, e) {
    if (t.mode === 'lighthouse') return;
    aimAt(t, e);
    t.shots++;
    const shell = t.up[1] >= 3 && t.shots % 2 === 0;
    if (shell) {
      shoot({ x: t.x, y: t.y, ang: t.ang, spd: 360, dist: Math.min(effRange(t), Math.hypot(e.x - t.x, e.y - t.y) + 4), lob: true, r: 8, kind: 'cannon', src: t,
        onBurst: p => explode(p.x, p.y, 50, effDamage(t), 'normal', 25, t, { kind: 'boom' }) });
      return;
    }
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: projSpeed(t, 560), dist: effRange(t) * 1.6, dmg: effDamage(t), type: t.st.type, pierce: effPierce(t), src: t, kind: 'dart', r: 7, homing: true, tgt: e,
      onHit: (p, hit) => {
        if (t.fx.split_on_hit_projectiles && !p.split) {
          p.split = true;
          for (let i = 0; i < t.fx.split_on_hit_projectiles; i++) shoot({ x: hit.x, y: hit.y, ang: p.ang + (i - (t.fx.split_on_hit_projectiles - 1) / 2) * 0.5, spd: 520, dist: 150, dmg: effDamage(t), type: t.st.type, pierce: t.fx.split_pierce || 2, src: t, kind: 'dartSmall', r: 5, split: true, hits: new Set([hit]) });
        }
      } });
  },
  arkanni_carodej(t, e) {
    aimAt(t, e);
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: projSpeed(t, 520), dist: effRange(t) * 1.8, dmg: effDamage(t), type: t.st.type, pierce: effPierce(t), src: t, kind: t.st.type === 'true' ? 'boltTrue' : 'bolt', r: 7, homing: !!t.fx.homing_projectiles, tgt: e });
  },
  kralovsky_alchymista(t, e) {
    aimAt(t, e);
    if (t.fx.instant_kill_lead && e.armored && !isBoss(e)) {
      addFx({ kind: 'gold', x: e.x, y: e.y, dur: 0.5 });
      addGold(t.fx.cash_per_lead || 50); floatText(e.x, e.y - 10, '+' + (t.fx.cash_per_lead || 50), '#facc15');
      e.armored = false; hitEnemy(e, e.hp + 0.01, 'true', hitOpts(t));
      return;
    }
    const d = Math.min(effRange(t), Math.hypot(e.x - t.x, e.y - t.y) + 4);
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: projSpeed(t, 380), dist: d, lob: true, r: 8, kind: 'flask', src: t,
      onBurst: p => explode(p.x, p.y, t.st.expl || 40, effDamage(t), t.st.type, effPierce(t), t, { kind: 'acid', each: x => {
        if (t.st.acid) x.acid = { dps: t.st.acid, until: G.time + (t.st.acidDur || 3), src: t };
        if (t.fx.strip_fortified_from_non_moab && x.fort && !isBoss(x)) x.fort = false;
        if (t.fx.coat_moab_in_explosive && isBoss(x)) { x.coated = true; x.coatPct = t.fx.moab_explosion_pct_of_max_hp || 0.1; x.coatR = t.fx.moab_explosion_radius_px || 90; }
      } }) });
  },
};
// Věže bez vlastního útoku (hláska, důl) mají útok jen výjimečně (Citadela)
function towerHasAttack(t) {
  if (t.type === 'zlaty_dul') return false;
  if (t.type === 'strazni_hlaska') return !!t.fx.turret_ballista_damage;
  return true;
}

function updateTower(t, dt) {
  // DoT a buffy od alchymisty se řeší jinde; tady útoky a pasivní schopnosti
  const fx = t.fx;
  // pasivní pomocné časovače
  const every = (key, sec, fn) => { t.timers[key] = (t.timers[key] || 0) + dt; if (t.timers[key] >= sec) { t.timers[key] = 0; fn(); } };
  if (fx.meteor_interval_s) every('meteor', fx.meteor_interval_s, () => { const e = strongestEnemy(); if (e) { addFx({ kind: 'meteor', x: e.x, y: e.y, dur: 0.45 }); explode(e.x, e.y, 40, fx.meteor_damage || 150, 'true', 12, t, { kind: 'boomFire' }); } });
  if (fx.passive_global_bombardment_interval_s) every('carpet', fx.passive_global_bombardment_interval_s, () => {
    addFx({ kind: 'carpet', dur: 0.6 });
    for (const e of G.enemies) if (!e.dead && e.d > 0) hitEnemy(e, fx.global_bomb_damage || 50, 'normal', hitOpts(t));
  });
  if (fx.passive_aura_slow_pct) for (const e of enemiesNear(t.x, t.y, effRange(t))) if (!isBoss(e)) slow(e, fx.passive_aura_slow_pct, G.time + 0.25);
  if (fx.decamo_pulse_interval_s && (t.type !== 'ricni_galera' || t.mode === 'lighthouse')) every('decamo', fx.decamo_pulse_interval_s, () => {
    const r = fx.decamo_radius_px || 200;
    addFx({ kind: 'reveal', x: t.x, y: t.y, r, dur: 0.6 });
    for (const e of enemiesNear(t.x, t.y, r)) e.revealed = true;
  });
  if (fx.gains_dragon_breath_and_decamo) every('decamo2', 1.8, () => { for (const e of enemiesNear(t.x, t.y, 220)) e.revealed = true; addFx({ kind: 'reveal', x: t.x, y: t.y, r: 220, dur: 0.6 }); });
  if (t.type === 'ricni_galera' && t.mode === 'lighthouse' && fx.submerge_damage_aura_dps) every('glow', 0.25, () => {
    let n = 0; for (const e of enemiesNear(t.x, t.y, effRange(t))) { if (n++ >= (fx.submerge_pierce || 60)) break; hitEnemy(e, fx.submerge_damage_aura_dps * 0.25, 'normal', hitOpts(t)); }
  });
  if (fx.secondary_attack_fireball_interval_s) every('fireball', fx.secondary_attack_fireball_interval_s / speedMul(t), () => {
    const e = pickTarget(t, effRange(t)); if (!e) return;
    const ang = Math.atan2(e.y - t.y, e.x - t.x);
    shoot({ x: t.x, y: t.y, ang, spd: 360, dist: Math.min(effRange(t), Math.hypot(e.x - t.x, e.y - t.y) + 4), lob: true, r: 9, kind: 'fireball', src: t,
      onBurst: p => explode(p.x, p.y, fx.fireball_radius_px || 45, fx.fireball_damage || 3, fx.fireball_damage_type || 'explosion', 20, t, { kind: 'boomFire' }) });
  });
  if (fx.spawn_fire_wall_on_track_interval_s) every('wall', fx.spawn_fire_wall_on_track_interval_s, () => {
    const e = pickTarget(t, effRange(t)); const q = e ? { x: e.x, y: e.y } : nearestTrackPoint(t.x, t.y, effRange(t));
    if (q) G.zones.push({ kind: 'fire', x: q.x, y: q.y, r: 30, dps: fx.fire_wall_dps || 8, pierce: fx.fire_wall_pierce || 20, until: G.time + (fx.fire_wall_duration_s || 4), type: 'energy', src: t });
  });
  if (fx.continuous_flame_stream || fx.gains_dragon_breath_and_decamo) every('flame', (fx.flame_interval_s || 0.12) / speedMul(t), () => {
    const e = pickTarget(t, Math.min(effRange(t), 140)); if (!e) return;
    const ang = Math.atan2(e.y - t.y, e.x - t.x);
    addFx({ kind: 'flame', x: t.x, y: t.y, ang, r: Math.min(effRange(t), 140), dur: 0.14 });
    let n = 0;
    for (const x of enemiesNear(t.x, t.y, Math.min(effRange(t), 140))) {
      let da = Math.atan2(x.y - t.y, x.x - t.x) - ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      if (Math.abs(da) > 0.35) continue;
      if (n++ >= (fx.flame_pierce || 6)) break;
      hitEnemy(x, (fx.flame_damage || 1) + t.st.flameAdd, 'energy', hitOpts(t));
      if (fx.burn_dps) x.burn = { dps: fx.burn_dps, until: G.time + 3, src: t };
    }
  });
  if (fx.permanent_phoenix && !t.phoenix) t.phoenix = { until: Infinity, ang: 0 };
  if (t.phoenix) updatePhoenix(t, dt);
  if (fx.spawn_zombie_packets) every('skel', 0.7, () => {
    if ((t.souls || 0) < 1) return;
    const big = fx.spawn_zombie_moabs && t.souls >= 10;
    t.souls -= big ? 10 : 1;
    const pi = Math.floor(Math.random() * G.paths.length);
    G.allies.push({ path: pi, d: G.paths[pi].len, spd: big ? 45 : 70, dmg: big ? fx.zombie_moab_damage : fx.zombie_damage, pierce: big ? fx.zombie_moab_pierce : fx.zombie_pierce, big, src: t, hits: new Set() });
  });
  if (fx.buff_nearest_tower_interval_s || fx.buff_damage_add) every('potion', fx.buff_nearest_tower_interval_s || 4, () => alchemyBuff(t));
  if (fx.leave_acid_pool_on_track) every('pool', 2.5 / speedMul(t), () => {
    if (pickTarget(t, effRange(t))) return;
    const q = nearestTrackPoint(t.x + (Math.random() - 0.5) * effRange(t), t.y + (Math.random() - 0.5) * effRange(t), effRange(t));
    if (q) G.zones.push({ kind: 'acid', x: q.x, y: q.y, r: 26, dps: Math.max(2, t.st.acid * 2), pierce: fx.pool_pierce || 10, until: G.time + (fx.pool_duration_s || 4), type: 'normal', src: t });
  });
  if (fx.gold_potion_interval_s) every('goldp', fx.gold_potion_interval_s, () => {
    const e = pickTarget(t, effRange(t)); if (!e) return;
    addFx({ kind: 'goldSplash', x: e.x, y: e.y, r: 45, dur: 0.5 });
    for (const x of enemiesNear(e.x, e.y, 45)) x.goldMul = Math.max(x.goldMul, fx.gold_coated_cash_multiplier || 2.5);
  });
  if (fx.shrink_potion_interval_s) every('shrink', fx.shrink_potion_interval_s, () => {
    const e = G.enemies.find(x => !x.dead && x.t === 'slizovy_obr' && Math.hypot(x.x - t.x, x.y - t.y) <= effRange(t) + 200);
    if (!e) return;
    addFx({ kind: 'shrink', x: e.x, y: e.y, r: e.def.r, dur: 0.6 });
    e.dead = true;
    spawnEnemy('kapicka_slizu', e.path, e.d, [], { noSeal: true });
  });
  if (t.beastUntil > G.time) {   // Proměna v běsa: paprsek s obrovským poškozením
    every('beast', 0.08, () => { const e = pickTarget(t, effRange(t) + 40); if (e) { aimAt(t, e); addFx({ kind: 'beam', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.09, col: '#e879f9' }); hitEnemy(e, t.beastDmg || 8, 'true', hitOpts(t)); } });
  }
  if (typeof XT !== 'undefined' && XT[t.type]) { XT[t.type](t, dt, every); return; }   // nové věže (td-xtowers.js)
  if (!towerHasAttack(t)) return;
  if (t.type === 'strazni_hlaska') {   // Citadela: střešní balista
    t.cd -= dt * speedMul(t);
    if (t.cd > 0) return;
    const e = pickTarget(t, effRange(t)); if (!e) return;
    t.cd = fx.turret_ballista_interval_s || 0.8; aimAt(t, e);
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: 700, dist: effRange(t) * 1.3, dmg: fx.turret_ballista_damage || 80, type: 'normal', pierce: fx.turret_pierce || 30, src: t, kind: 'ballista', r: 8 });
    return;
  }
  t.cd -= dt * speedMul(t);
  if (t.cd > 0) return;
  const range = effRange(t);
  let e = null;
  if (t.type === 'cepova_vez' || (t.type === 'mrazivy_mag' && t.st.mode !== 'projectile')) {
    // kruhové věže střílí, jakmile je v dosahu cokoliv (i neviditelné zasáhnou)
    const near = enemiesNear(t.x, t.y, range).filter(x => x.d > -5);
    if (!near.length) return;
    e = near[0];
  } else {
    e = pickTarget(t, range, { shared: !!t.fx.global_shared_vision });
    if (!e) return;
  }
  t.cd = t.st.interval;
  t.firedAt = G.time;   // záblesk výstřelu v grafice
  ATTACK[t.type]?.(t, e);
}

function updatePhoenix(t, dt) {
  const ph = t.phoenix;
  if (G.time > ph.until) { t.phoenix = null; return; }
  ph.ang += dt * 1.4;
  ph.x = TW / 2 + Math.cos(ph.ang) * 320; ph.y = TH / 2 + Math.sin(ph.ang * 1.3) * 220;
  ph.acc = (ph.acc || 0) + dt;
  if (ph.acc < 0.15) return;
  ph.acc = 0;
  const e = pickTarget({ x: ph.x, y: ph.y, target: 'strong', st: { camo: true } }, 2000);
  if (!e) return;
  shoot({ x: ph.x, y: ph.y, ang: Math.atan2(e.y - ph.y, e.x - ph.x), spd: 620, dist: 900, dmg: 4, type: 'energy', pierce: 3, src: t, kind: 'phoenixFire', r: 7, homing: true, tgt: e });
}
// Alchymista: posilující lektvar na nejbližší útočnou věž
function alchemyBuff(t) {
  const fx = t.fx;
  const slots = fx.can_keep_2_towers_buffed || fx.buff_is_permanent ? 3 : 1;
  const buffed = G.towers.filter(o => o.buff && o.buff.from === t && o.buff.until > G.time).length;
  if (buffed >= slots && !fx.buff_is_permanent) return;
  const cand = G.towers.filter(o => o !== t && towerHasAttack(o) && o.type !== 'kralovsky_alchymista' && Math.hypot(o.x - t.x, o.y - t.y) <= effRange(t) + 40 && !(o.buff && o.buff.until > G.time && o.buff.from === t))
    .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
  const o = cand[0]; if (!o) return;
  const dur = fx.buff_is_permanent ? Infinity : fx.buff_duration_s || (fx.buff_shots ? fx.buff_shots * 0.5 : 6);
  o.buff = { from: t, until: G.time + dur, lead: !!fx.buff_grants_lead_popping || t.up[0] >= 2, boss: fx.buff_bonus_moab_and_ceramic_damage || 0,
    dmg: fx.buff_damage_add || 0, prc: fx.buff_pierce_add || 0, spd: fx.buff_attack_speed_pct || 0, rng: fx.buff_range_pct || 0 };
  addFx({ kind: 'potion', x: t.x, y: t.y, tx: o.x, ty: o.y, dur: 0.4 });
}

/* ── Spojenci (kostlivci z nekromanta) ─────────────────────────── */
function updateAllies(dt) {
  for (const a of G.allies) {
    a.d -= a.spd * dt;
    if (a.d < 0) { a.dead = true; continue; }
    const q = posAt(G.paths[a.path], a.d); a.x = q.x; a.y = q.y; a.ang = q.ang + Math.PI;   // jdou proti slizákům
    for (const e of enemiesNear(a.x, a.y, a.big ? 22 : 12)) {
      if (a.hits.has(e) || e.path !== a.path) continue;
      a.hits.add(e);
      hitEnemy(e, a.dmg, 'normal', hitOpts(a.src));
      if (--a.pierce <= 0) { a.dead = true; addFx({ kind: 'splat', x: a.x, y: a.y, r: 8, col: '#a3e635', dur: 0.3 }); break; }
    }
  }
  G.allies = G.allies.filter(a => !a.dead);
}

/* ── Hrdinové ──────────────────────────────────────────────────── */
function heroLevelFor(xp) { const L = HDEF[G.hero.id].levels; let lv = 1; for (const l of L) if (xp >= l.xp) lv = l.level; return lv; }
function addHeroXp(n) {
  const h = G.hero; if (!h) return;
  h.xp += n * (G.glob?.heroXp || 1);
  const lv = heroLevelFor(h.xp);
  if (lv > h.level) { h.level = lv; recalcHero(h); floatText(h.x, h.y - 26, 'Úroveň ' + lv + '!', '#fde68a'); addFx({ kind: 'levelup', x: h.x, y: h.y, dur: 0.9 }); window.sfx?.('combo', { n: 3 }); }
}
// Statistiky hrdiny podle úrovně (texty úrovní jsou v td-data.js)
function recalcHero(h) {
  const L = h.level, b = HDEF[h.id].base, st = { range: b.range_px, damage: b.damage, interval: b.attack_interval_s, pierce: b.pierce, type: b.damage_type, camo: false };
  const ab = [];
  if (h.id === 'lovec_bedrich') {
    if (L >= 2) { st.damage = 5; st.range += 15; }
    if (L >= 4) st.interval = 1.0;
    if (L >= 5) st.camo = true;
    if (L >= 6) st.damage = 8;
    if (L >= 8) { st.interval = 0.8; st.pierce = 2; }
    if (L >= 11) st.damage = 12;
    if (L >= 12) st.range = 300;
    if (L >= 16) st.interval = 0.6;
    if (L >= 19) st.damage = 20;
    st.boss = L >= 19 ? 20 : L >= 14 ? 14 : L >= 11 ? 6 : L >= 6 ? 4 : 0;
    st.camoB = L >= 5 ? 3 : 0;
    if (L >= 3) ab.push({ key: 'bedrich1', name: 'Železná past', cd: L >= 15 ? 25 : 35 });
    if (L >= 10) ab.push({ key: 'bedrich2', name: 'Střela drakobijce', cd: 60 });
  } else if (h.id === 'carodejka_radka') {
    st.pierce = L >= 12 ? 10 : L >= 2 ? 7 : 5;
    if (L >= 4) st.range = 175;
    if (L >= 5) st.camo = true;
    st.damage = L >= 18 ? 5 : L >= 12 ? 3 : L >= 6 ? 2 : 1;
    st.interval = L >= 16 ? 0.5 : L >= 7 ? 0.7 : 0.9;
    st.chains = L >= 19 ? 3 : L >= 11 ? 2 : 1;
    st.boss = L >= 14 ? 5 : 0; st.fortB = L >= 14 ? 5 : 0;
    if (L >= 3) ab.push({ key: 'radka1', name: 'Očistná runa', cd: L >= 15 ? 20 : 30 });
    if (L >= 10) ab.push({ key: 'radka2', name: 'Bouře živlů', cd: 55 });
  } else {
    if (L >= 3) ab.push({ key: 'oskar1', name: 'Studium kronik', cd: 45 });
    if (L >= 10) ab.push({ key: 'oskar2', name: 'Královské požehnání', cd: 65 });
  }
  h.st = st; h.abilities = ab.map(a => ({ ...a, until: (h.abilities || []).find(x => x.key === a.key)?.until ?? G.time + 3 }));
  G.auraDirty = true;
}
function placeHero(id, x, y) {
  const why = placeProblem(id, x, y); if (why) return why;
  const def = HDEF[id];
  if (!spend(heroCost(id))) return 'Málo zlaťáků';
  G.hero = { hero: true, id, type: id, x, y, r: def.base.radius_px || 20, xp: 0, level: 1, cd: 0, target: 'first', ang: -Math.PI / 2, fx: {}, timers: {}, shots: 0, critShots: 0, dmgDone: 0, spent: def.base.cost };
  recalcHero(G.hero);
  window.sfx?.('place');
  addFx({ kind: 'levelup', x, y, dur: 0.9 });
  return null;
}
function moveHero(x, y) {
  const why = placeProblem(G.hero.id, x, y, G.hero); if (why) return why;
  if (!spend(250)) return 'Přesun stojí 250 zl';
  G.hero.x = x; G.hero.y = y; G.auraDirty = true; return null;
}
function heroCritOpts(h) {
  if (h.critShots > 0) { h.critShots--; return { mul: 3, type: 'true' }; }
  return { mul: 1 };
}
function updateHero(dt) {
  const h = G.hero; if (!h) return;
  h.cd -= dt * speedMul(h);
  if (h.id === 'kronikar_oskar') {
    if (h.cd > 0) return;
    const e = pickTarget(h, h.st.range); if (!e) return;
    h.cd = h.st.interval; aimAt(h, e);
    shoot({ x: h.x, y: h.y, ang: h.ang, spd: 520, dist: h.st.range * 1.3, dmg: h.st.damage, type: 'normal', pierce: h.st.pierce, src: h, kind: 'scroll', r: 7 });
    return;
  }
  if (h.cd > 0) return;
  const e = pickTarget(h, h.st.range); if (!e) return;
  h.cd = h.st.interval; aimAt(h, e);
  const o = { src: h, boss: h.st.boss || 0, camoB: h.st.camoB || 0, fortB: h.st.fortB || 0, ignoreRune: h.id === 'carodejka_radka' && h.level >= 5 };
  if (h.id === 'lovec_bedrich') {
    const c = heroCritOpts(h);
    h.shots++;
    addFx({ kind: 'tracer', x: h.x, y: h.y, tx: e.x, ty: e.y, dur: 0.12, col: c.mul > 1 ? '#f472b6' : '#fca5a5' });
    hitEnemy(e, h.st.damage * c.mul, c.type || h.st.type, o);
    if (h.level >= 13 && h.shots % 4 === 0) stun(e, 0.5);
    return;
  }
  // Radka: řetězový blesk
  const kmBonus = Math.min(10, G.km);
  const prc = h.st.pierce + kmBonus;
  const used = new Set();
  for (let c = 0; c < h.st.chains; c++) {
    let cur = c === 0 ? e : pickTarget(h, h.st.range, { skip: used }); if (!cur) break;
    let px = h.x, py = h.y;
    for (let i = 0; i < prc && cur; i++) {
      used.add(cur);
      addFx({ kind: 'zap', x: px, y: py, tx: cur.x, ty: cur.y, dur: 0.16, col: '#c4b5fd' });
      hitEnemy(cur, h.st.damage, h.st.type, o);
      if (h.level >= 4 && !cur.dead) cur.burn = { dps: 1, until: G.time + 2, src: h };
      px = cur.x; py = cur.y;
      const nx = enemiesNear(px, py, 90 * (1 + kmBonus * 0.05)).filter(x => !used.has(x) && visibleTo(x, h));
      cur = nx.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    }
  }
}
function heroSpeedBonus(h) { return h.id === 'carodejka_radka' && h.level >= 13 ? Math.min(10, G.km) * 0.02 : 0; }

/* ── Schopnosti věží a hrdinů ──────────────────────────────────── */
function abilityCdMul(t) { return (1 - (t.aura?.cdRed || 0)) * (1 - (G.glob?.cdRed || 0)) * (t.type === 'ricni_galera' && G.towers.some(o => o.fx.buff_water_towers_cooldown_pct) ? 0.85 : 1); }
function useTowerAbility(t) {
  const a = t.ability; if (!a || t.cdUntil > G.time) return false;
  const [type, path, tier] = a.key.split(':'); const P = +path, T = +tier;
  const ok = ABILITY[type + ':' + P]?.(t, T, a);
  if (ok === false) return false;
  t.cdUntil = G.time + (a.cooldown_s || 30) * abilityCdMul(t);
  window.sfx?.('start');
  return true;
}
const ABILITY = {
  'kralovsky_lucistnik:2'(t, T) { if (T >= 5) G.archerRush = G.time + 10; t.rainUntil = G.time + 8; addFx({ kind: 'levelup', x: t.x, y: t.y, dur: 0.8 }); },
  'cepova_vez:2'(t, T) {
    if (T >= 5) { G.bladeStorm = { until: G.time + 6, src: t, acc: 0 }; return; }
    randomEnemies(60).forEach(e => { addFx({ kind: 'blade', x: e.x, y: e.y, dur: 0.3 }); hitEnemy(e, 15, 'normal', hitOpts(t)); });
    G.revealUntil = Math.max(G.revealUntil, G.time + 10);
  },
  'mrazivy_mag:2'(t, T) {
    addFx({ kind: 'blizzard', dur: 1.2 });
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (T >= 5) { e.frozenUntil = Math.max(e.frozenUntil, G.time + 7); hitEnemy(e, 200, 'true', hitOpts(t)); }
      else if (isBoss(e)) slow(e, 0.5, G.time + 5); else freeze(e, 5, t);
    }
    if (T >= 5) G.towers.forEach(o => { if (o !== t && o.cdUntil) o.cdUntil -= 5; });
  },
  'orli_ostrostrelec:2'(t, T, a) {
    const g = a.gold || (T >= 5 ? 2500 : 1100);
    addGold(g); floatText(t.x, t.y - 30, '+' + g + ' zl', '#facc15'); addFx({ kind: 'gold', x: t.x, y: t.y, dur: 0.8 });
    if (a.lives) G.lives = Math.min(livesCap(), G.lives + a.lives);
  },
  'oblehaci_katapult:2'(t, T) {
    const e = strongestEnemy(true) || strongestEnemy(); if (!e) return false;
    addFx({ kind: 'missile', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.35 });
    hitEnemy(e, T >= 5 ? 3500 : 750, 'true', hitOpts(t));
    breakSeals(T >= 5 ? 99 : 1, e);
  },
  'ricni_galera:2'(t, T) {
    const e = strongestEnemy(); if (!e) return false;
    addFx({ kind: 'missile', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.35 });
    hitEnemy(e, T >= 5 ? 4500 : 1500, 'true', hitOpts(t));
    if (T < 5) explode(e.x, e.y, 80, 300, 'true', 40, t, { kind: 'boomFire' });
    breakSeals(T >= 5 ? 99 : 2, e);
  },
  'arkanni_carodej:2'(t, T) {
    if (T >= 5) { G.meteorRain = { until: G.time + 15, src: t, acc: 0 }; return; }
    t.phoenix = { until: G.time + 18, ang: 0 };
  },
  'kralovsky_alchymista:2'(t, T) {
    t.beastUntil = G.time + (T >= 5 ? 18 : 15); t.beastDmg = 8;
    if (T >= 5) G.towers.filter(o => o !== t && towerHasAttack(o) && maxTier(o) <= 3).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y)).slice(0, 4)
      .forEach(o => { o.beastUntil = G.time + 18; o.beastDmg = 9.6; });
  },
  'strazni_hlaska:2'(t, T) {
    if (T >= 5) { G.hornAll = G.time + 15; addFx({ kind: 'horn', x: t.x, y: t.y, r: 900, dur: 1 }); return; }
    G.towers.forEach(o => { if (Math.hypot(o.x - t.x, o.y - t.y) <= t.st.range) o.hornUntil = G.time + 12; });
    addFx({ kind: 'horn', x: t.x, y: t.y, r: t.st.range, dur: 1 });
  },
  'zlaty_dul:2'(t, T, a) {
    if (T >= 5) { addGold(a.gold || 3000); floatText(t.x, t.y - 30, '+' + (a.gold || 3000) + ' zl', '#facc15'); return; }
    addGold(4000); G.debt = (G.debt || 0) + 2000; floatText(t.x, t.y - 30, '+4000 zl (půjčka)', '#facc15');
  },
};
const HERO_ABILITY = {
  bedrich1(h) {
    const e = strongestEnemy(); if (!e) return false;
    const dur = h.level >= 20 ? 7 : h.level >= 9 ? 5.5 : 4;
    e.stunUntil = Math.max(e.stunUntil, G.time + dur);
    e.vulnMul = h.level >= 20 ? 1.8 : 1.5; e.vulnMulUntil = G.time + dur;
    if (h.level >= 9) slow(e, 0.3, G.time + dur + 3);
    addFx({ kind: 'trap', x: e.x, y: e.y, r: e.def.r, dur: 0.8 });
  },
  bedrich2(h) {
    const e = strongestEnemy(); if (!e) return false;
    addFx({ kind: 'missile', x: h.x, y: h.y, tx: e.x, ty: e.y, dur: 0.3 });
    hitEnemy(e, h.level >= 20 ? 2500 : h.level >= 17 ? 1200 : 500, 'true', { src: h });
    breakSeals(h.level >= 20 ? 3 : 2, e);
  },
  radka1(h) {
    const map = h.level >= 20, dmg = h.level >= 20 ? 60 : h.level >= 9 ? 30 : 15;
    const list = map ? G.enemies.filter(e => !e.dead) : enemiesNear(h.x, h.y, 200).slice(0, 30);
    addFx({ kind: 'rune', x: h.x, y: h.y, r: map ? 900 : 200, dur: 0.8 });
    list.forEach(e => { e.camo = false; e.regrow = false; if (!isBoss(e)) e.armored = false; hitEnemy(e, dmg, 'true', { src: h }); if (h.level >= 9) slow(e, 0.5, G.time + 4); });
  },
  radka2(h) {
    const dur = h.level >= 20 ? 12 : h.level >= 17 ? 10 : 8, dps = h.level >= 20 ? 100 : h.level >= 17 ? 55 : 30;
    G.zones.push({ kind: 'storm', x: h.x, y: h.y, r: h.st.range, dps, slow: 0.4, until: G.time + dur, type: 'true', src: h });
    if (h.level >= 20) breakSeals(2);
  },
  oskar1(h) {
    G.cardCdUntil = 0; G.cardQuotaBonus++;
    G.nextUpgradeDiscount = { pct: h.level >= 17 ? 0.25 : h.level >= 9 ? 0.2 : 0.15, x: h.x, y: h.y, r: h.st.range, until: G.time + 120 };
    if (h.level >= 17) G.nextCardKmBonus = 1;
    addFx({ kind: 'levelup', x: h.x, y: h.y, dur: 0.8 });
  },
  oskar2(h) {
    const dur = h.level >= 20 ? 16 : 12; G.blessUntil = G.time + dur; G.blessSpd = h.level >= 20 ? 0.6 : 0.35;
    addFx({ kind: 'horn', x: h.x, y: h.y, r: 900, dur: 1, col: '#fde68a' });
  },
};
function useHeroAbility(i) {
  const h = G.hero; const a = h?.abilities[i]; if (!a || a.until > G.time) return false;
  if (HERO_ABILITY[a.key]?.(h) === false) return false;
  a.until = G.time + a.cd * (1 - (G.glob?.cdRed || 0));
  h.castAt = G.time;   // animace kouzlení v grafice
  window.sfx?.('start');
  return true;
}

/* ── Vlny ──────────────────────────────────────────────────────── */
function waveDef(n) {
  if (n <= TD.waves.length) return { def: TD.waves[n - 1], hpMul: 1, cnt: 1, spd: 1 };
  const k = n - TD.waves.length;   // volná hra: opakuje vlny 31–40 a zesiluje
  return { def: TD.waves[30 + ((k - 1) % 10)], hpMul: 1 + 0.3 * k, cnt: 1 + 0.08 * k, spd: Math.min(1.6, 1 + 0.02 * k) };
}
function startWave() {
  if (G.waveActive || G.over) return;
  if (G.wave > 0 && G.pauseUntil > G.time) {   // dřívější start = bonus
    const left = Math.min(15, G.pauseUntil - G.time), bonus = Math.min(30, Math.floor(left * ECON.singleplayer.early_wave_start_bonus_gold_per_s));
    if (bonus > 0) { addGold(bonus); floatText(TW / 2, 40, '+' + bonus + ' zl za rychlý start', '#facc15'); }
  }
  G.wave++;
  const w = waveDef(G.wave);
  G.waveActive = true; G.waveT = 0; G.schedule = []; G.schedIdx = 0;
  w.def.groups.forEach((g, gi) => {
    const n = Math.round(g.n * w.cnt);
    for (let i = 0; i < n; i++) G.schedule.push({ at: g.at + i * g.every / Math.min(2, w.cnt), id: g.id, mods: g.mods, path: (i + gi) % G.paths.length, hpMul: w.hpMul, spd: w.spd });
  });
  G.schedule.sort((a, b) => a.at - b.at);
  G.waveLen = Math.max(8, (G.schedule[G.schedule.length - 1]?.at || 0) + 6);
  G.mineTick = 0;
  G.towers.forEach(t => { t.paid = 0; });
  window.sfx?.('start');
}
function livesCap() { return (DIFF[G.diff]?.lives || 150) + 200; }
// Důl: vozíky × hodnota vozíku (× bonus hodnoty × násobek tržiště/banky)
function mineIncome(t) {
  const st = t.st;
  let inc = st.carts * st.cartVal * (1 + st.cartPct) * st.cartMul;
  if (t.ocUntil > G.time) inc *= t.ocMul || 1.65;
  inc *= 1 + (t.aura?.mine || 0);
  if (G.towers.some(o => o !== t && o.type === 'zlaty_dul' && o.fx.buff_all_other_farms_income_pct)) inc *= 1.25;
  const h = G.hero; if (h?.id === 'kronikar_oskar') inc *= 1 + (h.level >= 14 ? 0.15 : h.level >= 5 ? 0.08 : 0);
  return inc;
}
function payMines(frac) {   // výplata dolů během vlny po částech
  for (const t of G.towers) {
    if (t.type !== 'zlaty_dul' || t.fx.bank_mode) continue;   // banka si výnos ukládá na konci vlny
    const total = mineIncome(t), due = total * frac - (t.paid || 0);
    if (due >= 1) {
      let g = due;
      if (G.debt > 0) { const r = Math.min(G.debt, g * 0.5); G.debt -= r; g -= r; }
      t.paid = (t.paid || 0) + due; addGold(g);
      floatText(t.x, t.y - 22, '+' + Math.round(g), '#facc15');
    }
  }
}
function endWave() {
  G.waveActive = false;
  payMines(1);
  const w = G.wave;
  const reward = w <= TD.waves.length ? TD.waves[w - 1].gold : ECON.singleplayer.end_of_wave_base_gold + ECON.singleplayer.end_of_wave_per_wave_gold * w;
  addGold(reward);
  waveRewards(w);
  G.pauseUntil = G.time + ECON.singleplayer.inter_wave_pause_s;
  G.onWaveEnd?.(w);
  if (w === TD.waves.length && !G.wonShown) { G.wonShown = true; G.onWin?.(); }
}
function waveRewards(w) {
  if (typeof xWaveEnd === 'function') xWaveEnd();
  // banky, životy z tržišť, příjmy z hlásky a galér, Oskar
  for (const t of G.towers) {
    if (t.type === 'zlaty_dul' && t.fx.bank_mode) {
      t.bank = Math.min(t.fx.bank_capacity || 7500, ((t.bank || 0) + mineIncome(t)) * (1 + (t.fx.compound_interest_per_wave_pct || 0.15)));
    }
    if (t.fx.lives_generated_per_wave) G.lives = Math.min(livesCap(), G.lives + t.fx.lives_generated_per_wave);
    if (t.fx.base_income_per_wave) { addGold(t.fx.base_income_per_wave); floatText(t.x, t.y - 22, '+' + t.fx.base_income_per_wave, '#facc15'); }
    if (t.fx.buff_water_towers_income) { const n = G.towers.filter(o => o.type === 'ricni_galera').length; if (n) addGold(n * t.fx.buff_water_towers_income); }
  }
  const h = G.hero;
  if (h) {
    addHeroXp(40 + 15 * w);
    if (h.id === 'kronikar_oskar') {
      const L = h.level, g = L >= 18 ? 300 : L >= 12 ? 150 : L >= 6 ? 80 : L >= 2 ? 40 : 0;
      if (g) addGold(g);
      if (L >= 6) G.lives = Math.min(livesCap(), G.lives + (L >= 18 ? 5 : 2));
    }
  }
  G.cardsThisWave = 0; G.cardQuotaBonus = 0;
  G.stats.wavesDone = w;
}

/* ── Versus: každý brání svou mapu, vlny běží všem podle společných hodin,
   místo odměn za vlnu je příjem (eco) a za poslané slizáky se eco zvedá ── */
const VS = TD.versus;
function vsWaveLen(n) {
  const w = waveDef(n);
  let end = 0;
  w.def.groups.forEach(g => { end = Math.max(end, g.at + (Math.round(g.n * w.cnt) - 1) * g.every / Math.min(2, w.cnt)); });
  return Math.max(16, end + 6);
}
function vsStartWave() {
  if (G.wave > 0) { payMines(1); waveRewards(G.wave); G.onWaveEnd?.(G.wave); }
  G.wave++;
  const w = waveDef(G.wave), sd = VS.sudden_death_wave;
  const hpMul = w.hpMul * (G.wave > sd ? 1 + VS.sudden_death_enemy_stat_increase_per_wave_pct * (G.wave - sd) : 1);
  const rest = G.schedule.slice(G.schedIdx);
  w.def.groups.forEach((g, gi) => {
    const n = Math.round(g.n * w.cnt);
    for (let i = 0; i < n; i++) rest.push({ at: G.time + g.at + i * g.every / Math.min(2, w.cnt), id: g.id, mods: g.mods, path: (i + gi) % G.paths.length, hpMul, spd: w.spd });
  });
  rest.sort((a, b) => a.at - b.at);
  G.schedule = rest; G.schedIdx = 0;
  G.waveActive = true; G.waveT = 0; G.waveLen = vsWaveLen(G.wave); G.mineTick = 0;
  G.towers.forEach(t => { t.paid = 0; });
  G.vs.nextWaveAt = G.time + G.waveLen;
  if (G.wave === sd + 1) G.onSuddenDeath?.();
  window.sfx?.('start');
}
// Změna příjmu: nad měkkým stropem roste pomaleji, tvrdý strop nepřekročí.
function vsEco(x) {
  if (x > 0 && G.vs.eco >= VS.eco_soft_cap_threshold) x *= VS.eco_soft_cap_multiplier;
  G.vs.eco = Math.max(50, Math.min(VS.eco_hard_cap, G.vs.eco + x));
}
// Slizáci od soupeře: vypustí se postupně, za každého ubráněného je část ceny zpět.
function vsIncoming(sendId, count, mods, bountyPct = VS.defense_bounty_cashback_pct) {
  const sd = VS.sends.find(x => x.id === sendId); if (!sd) return;
  const bounty = sd.cost_gold * bountyPct / Math.max(1, count + (sd.escort?.count || 0));
  const at = Math.max(G.time, G.vs.inAt || 0);
  for (let i = 0; i < count; i++) G.schedule.push({ at: at + i * sd.spacing_s, id: sd.enemy_id, mods, path: (G.vs.inPath++) % G.paths.length, hpMul: 1, spd: 1, bounty });
  if (sd.escort) for (let i = 0; i < sd.escort.count; i++) G.schedule.push({ at: at + 0.6 + i * 0.35, id: sd.escort.enemy_id, mods: [], path: (G.vs.inPath++) % G.paths.length, hpMul: 1, spd: 1, bounty });
  G.vs.inAt = at + count * sd.spacing_s;
  const rest = G.schedule.slice(G.schedIdx).sort((a, b) => a.at - b.at);
  G.schedule = rest; G.schedIdx = 0;
}

/* ── Hlavní krok simulace ──────────────────────────────────────── */
function step(dt) {
  if (G.over) return;
  G.time += dt;
  if (G.auraDirty || Math.floor(G.time * 4) !== Math.floor((G.time - dt) * 4)) refreshAuras();
  // odložené akce
  if (G.later.length) { const now = G.later.filter(l => l.at <= G.time); G.later = G.later.filter(l => l.at > G.time); now.forEach(l => l.fn()); }
  // vlna: vypouštění slizáků
  if (G.vs) {
    if (G.time >= G.vs.nextWaveAt) vsStartWave();
    if (G.time >= G.vs.ecoAt) { G.vs.ecoAt += VS.eco_payout_interval_s; addGold(G.vs.eco); G.stats.eco = (G.stats.eco || 0) + G.vs.eco; G.onEco?.(G.vs.eco); }
  }
  if (G.waveActive) {
    G.waveT += dt;
    const clock = G.vs ? G.time : G.waveT;
    while (G.schedIdx < G.schedule.length && G.schedule[G.schedIdx].at <= clock) {
      const s = G.schedule[G.schedIdx++];
      spawnEnemy(s.id, s.path, 0, s.mods || [], { hpMul: s.hpMul, spdMul: s.spd, bounty: s.bounty });
    }
    const frac = Math.min(1, G.waveT / G.waveLen);
    const ticks = Math.floor(frac * 10);
    if (ticks > G.mineTick) { G.mineTick = ticks; payMines(ticks / 10); }
  } else if (G.wave > 0 && G.autoNext && G.pauseUntil <= G.time && !G.over) {
    startWave();
  }
  rebuildGrid();
  // pohyb slizáků
  for (const e of G.enemies) {
    if (e.dead) continue;
    const path = G.paths[e.path];
    // DoT
    if (e.burn && e.burn.until > G.time) { e.burnAcc = (e.burnAcc || 0) + dt; if (e.burnAcc >= 0.5) { hitEnemy(e, e.burn.dps * e.burnAcc, 'energy', { src: e.burn.src }); e.burnAcc = 0; } }
    if (e.acid && e.acid.until > G.time && !e.dead) { e.acidAcc = (e.acidAcc || 0) + dt; if (e.acidAcc >= 0.5) { hitEnemy(e, e.acid.dps * e.acidAcc, 'normal', { src: e.acid.src }); e.acidAcc = 0; } }
    if (e.dead) continue;
    // štít bosse slábne sám od sebe
    if (e.seal && e.seal.s > 0) e.seal.s = Math.max(0, e.seal.s - e.def.seal.decay * dt);
    // dorůstání
    if (e.regrow && e.hist.length && G.time - e.lastHit > 3 && !G.towers.some(h => h.fx.block_regrow_in_radius && Math.hypot(h.x - e.x, h.y - e.y) <= h.st.range)) {
      const up = e.hist.pop(), def = EDEF[up];
      e.t = up; e.def = def; e.hp = e.maxHp = def.hp; e.lastHit = G.time; e.armored = def.traits.includes('armored');
      addFx({ kind: 'regrow', x: e.x, y: e.y, r: def.r, dur: 0.4 });
    }
    let v = e.def.speed * e.spdMul;
    if (frozen(e) || stunned(e)) v = 0;
    else if (e.slowUntil > G.time) v *= 1 - e.slowPct;
    if (G.sabotage && G.sabotage.until > G.time && !slowImmune(e)) v *= 1 - G.sabotage.pct;
    e.d += v * dt;
    if (e.d >= path.len) {
      e.dead = true;
      const leak = leakOf(e);
      G.lives -= leak; G.stats.leaks += leak;
      addFx({ kind: 'leak', x: e.x, y: e.y, dur: 0.5 });
      window.sfx?.('bad');
      if (G.lives <= 0) { G.lives = 0; G.over = true; G.onLose?.(); return; }
      continue;
    }
    const q = posAt(path, e.d); e.x = q.x; e.y = q.y; e.ang = q.ang;
  }
  // věže, hrdina, střely, zóny, spojenci
  for (const t of G.towers) updateTower(t, dt);
  if (G.hero) updateHero(dt);
  updateProjs(dt);
  updateZones(dt);
  updateAllies(dt);
  if (typeof updateExtras === 'function') updateExtras(dt);
  // globální schopnosti
  if (G.bladeStorm && G.bladeStorm.until > G.time) {
    G.bladeStorm.acc += dt;
    if (G.bladeStorm.acc >= 0.1) { G.bladeStorm.acc = 0; randomEnemies(10).forEach(e => { addFx({ kind: 'blade', x: e.x, y: e.y, dur: 0.25 }); hitEnemy(e, 35, 'true', hitOpts(G.bladeStorm.src)); }); }
  }
  if (G.meteorRain && G.meteorRain.until > G.time) {
    G.meteorRain.acc += dt;
    if (G.meteorRain.acc >= 0.125) { G.meteorRain.acc = 0; const e = randomEnemies(1)[0]; if (e) { addFx({ kind: 'meteor', x: e.x, y: e.y, dur: 0.4 }); explode(e.x, e.y, 35, 50, 'true', 10, G.meteorRain.src, { kind: 'boomFire' }); } }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  G.fx = G.fx.filter(f => G.time - f.t0 < f.dur);
  G.floats = G.floats.filter(f => G.time - f.t0 < 1.2);
  if (G.waveActive && !G.vs && G.schedIdx >= G.schedule.length && !G.enemies.length) endWave();
}

/* ── Nová hra ──────────────────────────────────────────────────── */
// Obtížnost jako v BTD: ceny a počet životů
const DIFF = { easy: { name: 'Lehká', cost: 0.85, lives: 200 }, medium: { name: 'Střední', cost: 1, lives: 150 }, hard: { name: 'Těžká', cost: 1.08, lives: 100 } };
function newGame(mapId, heroId, diff = 'medium', vs = null) {
  if (vs) diff = 'medium';
  const D = DIFF[diff] || DIFF.medium;
  const map = JSON.parse(JSON.stringify(TD.maps.find(m => m.id === mapId) || TD.maps[0]));
  G = {
    map, paths: map.paths.map(buildPath), time: 0, gold: ECON.singleplayer.starting_gold, lives: D.lives, diff, costMul: D.cost, km: ECON.singleplayer.starting_knowledge_points,
    wave: 0, waveActive: false, schedule: [], schedIdx: 0, waveT: 0, waveLen: 1, pauseUntil: 0, autoNext: true,
    enemies: [], towers: [], projs: [], zones: [], allies: [], fx: [], floats: [], later: [], necros: [],
    traps: [], sentries: [], movers: [], sabotage: null,
    hero: null, heroId, revealUntil: 0, streakUntil: 0, blessUntil: 0, hornAll: 0, archerRush: 0,
    cardsThisWave: 0, cardQuotaBonus: 0, cardCdUntil: 0, streak: 0, cardsOk: 0, cardsBad: 0, debt: 0,
    stats: { pops: 0, leaks: 0, popGold: 0, wavesDone: 0, earned: 0 }, glob: {}, auraDirty: true, over: false,
  };
  if (vs) {
    G.gold = VS.starting_gold; G.lives = vs.lives || VS.starting_lives; G.autoNext = false;
    G.vs = { eco: VS.base_eco_income_gold, ecoAt: VS.eco_payout_interval_s, nextWaveAt: 3, inAt: 0, inPath: 0, curse: null, focusUntil: 0 };
  }
  return G;
}

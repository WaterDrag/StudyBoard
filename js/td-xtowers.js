// ═══ td-xtowers.js — nové věže Obrany království (návrh od Gemini, _dev/td/part4-new-towers.json):
// Kladeč pastí, Lesní druid, Stínový zvěd, Gryfí jezdec, Obléhací moždíř, Trpasličí inženýr.
// Engine (td-engine.js) volá XT[typ](t, dt, every) místo běžného útoku, updateExtras(dt) každý krok
// (pasti, střílny, tornáda, nálože…), xSpeed(t) k rychlosti útoku, xAuras() po přepočtu aur
// a xWaveEnd() na konci vlny. Kreslení bez textur je dole (XR); textury pak přes TDS.<id>Extra.

const pctv = v => (v > 1 ? v / 100 : v || 0);   // Gemini píše procenta někdy jako 25, jindy 0.25
function cool(t, dt, iv) { t.cd -= dt * speedMul(t); if (t.cd > 0) return false; t.cd = iv; return true; }

// Body cesty v dosahu věže (kešované podle polohy a dosahu)
const _trackPts = new Map();
function trackPts(x, y, r) {
  const k = `${G.map.id}|${x | 0}|${y | 0}|${r | 0}`;
  let a = _trackPts.get(k);
  if (!a) {
    a = [];
    G.paths.forEach((p, pi) => { for (let d = 0; d < p.len; d += 8) { const q = posAt(p, d); if (Math.hypot(q.x - x, q.y - y) <= r) a.push({ x: q.x, y: q.y, pi, d, prog: d / p.len }); } });
    if (_trackPts.size > 300) _trackPts.clear();
    _trackPts.set(k, a);
  }
  return a;
}
// Místo na cestě podle cílení: první = nejblíž bráně, poslední = u jeskyně, nejbližší = u věže
function trackSpot(t, mode) {
  const pts = trackPts(t.x, t.y, effRange(t));
  if (!pts.length) return null;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  if (mode === 'first' || mode === 'last') {
    const s = pts.slice().sort((a, b) => b.prog - a.prog), part = s.slice(mode === 'first' ? 0 : Math.floor(s.length * 0.75), mode === 'first' ? Math.max(1, Math.ceil(s.length * 0.25)) : s.length);
    return pick(part);
  }
  if (mode === 'close') return pick(pts.slice().sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y)).slice(0, Math.max(1, Math.ceil(pts.length * 0.25))));
  return pick(pts);
}
// Zlaťáky, které by dal slizák i se všemi vrstvami (klec ho spolkne celého)
const _popGold = {};
function popGold(id) {
  if (_popGold[id] != null) return _popGold[id];
  const e = EDEF[id];
  return (_popGold[id] = e.gold + e.kids.reduce((s, k) => s + k.n * popGold(k.id), 0));
}
function trapCount(src, kinds) { let n = 0; for (const x of G.traps) if (x.src === src && (!kinds || kinds.includes(x.kind))) n++; return n; }
function addTrap(tr) {
  tr.hits = new Set(); tr.t0 = G.time;
  if (G.traps.length >= 450) G.traps.shift();
  G.traps.push(tr);
  return tr;
}
function throwTo(t, x, y, kind = 'potion') { addFx({ kind, x: t.x, y: t.y, tx: x, ty: y, dur: 0.3 }); t.ang = Math.atan2(y - t.y, x - t.x); }
function fireProj(t, e, o) {   // přímá střela věže na cíl
  t.firedAt = G.time;
  return shoot({ x: o.x ?? t.x, y: o.y ?? t.y, ang: o.ang ?? Math.atan2(e.y - (o.y ?? t.y), e.x - (o.x ?? t.x)), spd: projSpeed(t, o.spd || 520), dist: o.dist || effRange(t) * 1.3,
    dmg: o.dmg ?? effDamage(t), type: o.type || t.st.type, pierce: o.pierce ?? effPierce(t), src: t, kind: o.kind, r: o.r || 7, homing: o.homing, tgt: e, onHit: o.onHit, hit: o.hit });
}

/* ── Kladeč pastí ──────────────────────────────────────────────── */
function trapKind(t) {
  if (t.up[2] >= 3) return 'crystal';
  if (t.up[0] >= 4) return 'mine';
  if (t.up[0] >= 3) return 'jaw';
  return 'spike';
}
function layTrap(t, q) {
  const fx = t.fx, j = 7;
  addTrap({ kind: trapKind(t), x: q.x + (Math.random() - 0.5) * j, y: q.y + (Math.random() - 0.5) * j, r: fx.trap_hitbox_radius || 14,
    hp: effPierce(t), dmg: effDamage(t), type: t.st.type, until: G.time + (fx.trap_lifetime || 50), src: t, persist: !!fx.persist_between_waves });
}
function carpetOfTraps(t, n) {   // pasti rovnoměrně po celé cestě
  for (let i = 0; i < n; i++) {
    const pi = i % G.paths.length, p = G.paths[pi], q = posAt(p, p.len * (0.08 + 0.86 * ((i + 0.5) / n)));
    layTrap(t, q);
  }
  addFx({ kind: 'carpet', dur: 0.5 });
}

/* ── Útoky a pasivní schopnosti nových věží ────────────────────── */
const XT = {
  kladec_pasti(t, dt, every) {
    const fx = t.fx;
    if (fx.passive_carpet_interval) every('carpet', fx.passive_carpet_interval, () => { if (G.waveActive) carpetOfTraps(t, fx.passive_carpet_traps_count || 15); });
    if (!G.waveActive) return;
    let iv = t.st.interval;
    if (fx.start_of_wave_burst_mult && G.waveT < (fx.start_of_wave_burst_duration || 3)) iv /= fx.start_of_wave_burst_mult;
    if (!cool(t, dt, iv)) return;
    if (trapCount(t) >= (fx.max_traps_on_track || 18)) return;
    const q = trackSpot(t, fx.allow_target_priority ? t.target : 'random'); if (!q) return;
    throwTo(t, q.x, q.y); t.firedAt = G.time;
    layTrap(t, q);
  },

  lesni_druid(t, dt, every) {
    const fx = t.fx, range = effRange(t);
    if (fx.full_track_thorns_dps) every('thorns', 0.25, () => {
      for (const e of G.enemies) if (!e.dead && e.d > 0) {
        hitEnemy(e, (fx.full_track_thorns_dps + (isBoss(e) ? fx.full_track_thorns_bonus_moab_dps || 0 : 0)) * 0.25, 'normal', hitOpts(t));
        slow(e, pctv(fx.full_track_thorns_slow_pct || 25), G.time + 0.35);
      }
    });
    if (fx.secondary_zap_interval) every('zap', fx.secondary_zap_interval / speedMul(t), () => {
      const e = pickTarget(t, range); if (!e) return;
      addFx({ kind: 'zap', x: t.x, y: t.y, tx: e.x, ty: e.y, dur: 0.15, col: '#93c5fd' });
      const hit = new Set([e]);
      hitEnemy(e, fx.zap_damage || 2, fx.zap_damage_type || 'energy', hitOpts(t));
      bounceFrom(t, e.x, e.y, e, (fx.zap_bounce_targets || 8) - 1, fx.zap_damage || 2, fx.zap_damage_type || 'energy', hit, 110);
    });
    if (fx.secondary_tornado_interval) every('tornado', fx.secondary_tornado_interval / speedMul(t), () => {
      const e = pickTarget(t, range); const q = e ? { pi: e.path, d: e.d } : trackSpot(t, 'first'); if (!q) return;
      G.movers.push({ kind: 'tornado', pi: q.pi, d: q.d + 30, spd: 260, until: G.time + 1.3, pierce: fx.tornado_pierce || 18, src: t, hits: new Set() });
    });
    if (fx.secondary_ball_lightning_interval) every('ball', fx.secondary_ball_lightning_interval / speedMul(t), () => {
      const e = pickTarget(t, range); if (!e) return;
      G.movers.push({ kind: 'ball', x: t.x, y: t.y, ang: Math.atan2(e.y - t.y, e.x - t.x), spd: 70, until: G.time + 4, r: fx.ball_lightning_radius || 65, src: t, acc: 0 });
    });
    if (fx.global_vine_grab_interval) every('vine', fx.global_vine_grab_interval, () => {
      let best = null, bv = -1;
      for (const e of G.enemies) if (!e.dead && !isBoss(e) && e.d > 0 && !e.vined) { const v = rbeOf(e.t) * 10 + progressOf(e); if (v > bv) { bv = v; best = e; } }
      if (!best) return;
      best.vined = true; stun(best, 2);
      G.movers.push({ kind: 'vine', e: best, until: G.time + 2, dps: fx.vine_grab_damage_per || 8, src: t, acc: 0, x: best.x, y: best.y });
    });
    if (!cool(t, dt, t.st.interval)) return;
    const e = pickTarget(t, range); if (!e) { t.cd = 0; return; }
    aimAt(t, e);
    if (fx.consecutive_hit_speed_stack_pct) {   // Medvědí zuřivost: palba do stejného cíle zrychluje
      t.fury = t.lastTgt === e.id ? Math.min(pctv(fx.max_consecutive_speed_bonus_pct || 75), (t.fury || 0) + pctv(fx.consecutive_hit_speed_stack_pct)) : 0;
      t.lastTgt = e.id;
    }
    const n = Math.max(1, Math.round(t.st.projectiles)), spread = (fx.spread_deg || 28) * Math.PI / 180;
    const dmg = x => effDamage(t) + (x.regrow && fx.bonus_regrow_damage ? fx.bonus_regrow_damage : 0)
      + (fx.bonus_damage_per_100_enemy_max_hp ? Math.min(fx.max_hp_scaling_damage_bonus || 35, Math.floor(x.maxHp / 100) * fx.bonus_damage_per_100_enemy_max_hp) : 0);
    for (let i = 0; i < n; i++) {
      const ang = t.ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      fireProj(t, e, { ang, spd: fx.projectile_speed || 460, dmg, kind: 'thorn', onHit: (p, x) => { if (fx.strip_regrow) x.regrow = false; } });
    }
  },

  stinovy_zved(t, dt, every) {
    const fx = t.fx, range = effRange(t);
    if (fx.secondary_caltrops_interval) every('caltrop', fx.secondary_caltrops_interval / speedMul(t), () => {
      if (!G.waveActive || trapCount(t, ['caltrop']) >= 12) return;
      const q = trackSpot(t, 'close'); if (!q) return;
      throwTo(t, q.x, q.y);
      addTrap({ kind: 'caltrop', x: q.x, y: q.y, r: 12, hp: fx.caltrops_pierce || 4, dmg: fx.caltrops_damage || 1, type: 'sharp', until: G.time + 25, src: t });
    });
    if (fx.secondary_sticky_bomb_interval) every('sticky', fx.secondary_sticky_bomb_interval / speedMul(t), () => {
      const list = (fx.sticky_bomb_global_range ? G.enemies : enemiesNear(t.x, t.y, range)).filter(e => !e.dead && isBoss(e) && !G.movers.some(m => m.kind === 'sticky' && m.e === e));
      const e = list.sort((a, b) => b.hp - a.hp)[0]; if (!e) return;
      throwTo(t, e.x, e.y);
      G.movers.push({ kind: 'sticky', e, at: G.time + (fx.sticky_bomb_fuse || 2), src: t, x: e.x, y: e.y });
    });
    if (!cool(t, dt, t.st.interval)) return;
    const e = pickTarget(t, range); if (!e) { t.cd = 0; return; }
    aimAt(t, e); t.shots++;
    if (fx.every_nth_shot_flash_bomb && t.shots % fx.every_nth_shot_flash_bomb === 0) {   // oslepující bomba
      shoot({ x: t.x, y: t.y, ang: t.ang, spd: 420, dist: Math.min(range, Math.hypot(e.x - t.x, e.y - t.y) + 4), lob: true, r: 8, kind: 'flashBomb', src: t,
        onBurst: p => explode(p.x, p.y, fx.flash_bomb_radius || 60, fx.flash_bomb_damage || 4, fx.flash_bomb_damage_type || 'normal', 40, t, { kind: 'boomGold', each: x => {
          if (!isBoss(x)) stun(x, fx.flash_bomb_stun_duration || 1.3);
          else if (fx.can_stun_moab) stun(x, fx.stun_moab_duration || 1);
        } }) });
      return;
    }
    const n = Math.max(1, Math.round(t.st.projectiles)), spread = (fx.spread_deg || 12) * Math.PI / 180;
    const onHit = (p, x) => {
      if (fx.strip_camo_on_hit) { x.revealed = true; if (fx.decamo_radius) for (const y of enemiesNear(x.x, x.y, fx.decamo_radius)) y.revealed = true; }
      if (x.immuneFlash === G.time) return;   // nezraněného slizáka nezdržuj (jinak by ho držel věčně)
      if (fx.slow_after_hit_pct) slow(x, pctv(fx.slow_after_hit_pct), G.time + (fx.slow_duration || 1.5));
      if (fx.knockback_chance && canKnock(x) && Math.random() < fx.knockback_chance) x.d = Math.max(0, x.d - (fx.knockback || 28));
    };
    for (let i = 0; i < n; i++) {
      const ang = t.ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      fireProj(t, e, { ang, spd: fx.projectile_speed || 580, kind: 'shuriken', homing: !!fx.homing_projectiles, onHit });
    }
    if (fx.shadow_clone_homing_dagger_damage) fireProj(t, e, { spd: 620, dmg: fx.shadow_clone_homing_dagger_damage, type: 'normal', pierce: 1, kind: 'dagger', homing: true, dist: range * 2 });
  },

  gryfi_jezdec(t, dt, every) {
    const fx = t.fx, gr = t.gryf || (t.gryf = { x: t.x, y: t.y - (fx.orbit_radius || 95), ph: 0, ang: 0, mode: 'circle', pt: null });
    // let: kroužení, osmička, hlídka kolem bodu, sledování kurzoru
    const spd = fx.flight_speed || 135, R = fx.orbit_radius || 95;
    let cx = t.x, cy = t.y, tx, ty;
    if (gr.mode === 'patrol' && gr.pt) { cx = gr.pt.x; cy = gr.pt.y; }
    if (gr.mode === 'follow' && G.cursor) { tx = G.cursor.x; ty = G.cursor.y; }
    else if (gr.mode === 'eight') { gr.ph += spd / (R * 1.4) * dt; tx = cx + Math.sin(gr.ph) * R * 1.6; ty = cy + Math.sin(gr.ph * 2) * R * 0.8; }
    else { gr.ph += spd / R * dt; tx = cx + Math.cos(gr.ph) * R; ty = cy + Math.sin(gr.ph) * R; }
    const dx = tx - gr.x, dy = ty - gr.y, dd = Math.hypot(dx, dy), step = Math.min(dd, spd * 1.8 * dt);
    if (dd > 0.5) { gr.x += dx / dd * step; gr.y += dy / dd * step; gr.ang = Math.atan2(dy, dx); }
    gr.x = Math.max(10, Math.min(TW - 10, gr.x)); gr.y = Math.max(10, Math.min(TH - 10, gr.y));
    t.ang = Math.atan2(gr.y - t.y, gr.x - t.x);
    const from = { x: gr.x, y: gr.y, target: t.target, st: t.st, aura: t.aura };
    // rakety na slizové krále kdekoli na mapě
    const mi = fx.moab_missile_interval || fx.secondary_moab_missile_interval;
    if (mi) every('missile', mi / speedMul(t), () => {
      const bosses = G.enemies.filter(e => !e.dead && isBoss(e)).sort((a, b) => b.hp - a.hp); if (!bosses.length) return;
      for (let i = 0; i < (fx.moab_missile_count || 2); i++) {
        const e = bosses[i % bosses.length];
        shoot({ x: gr.x, y: gr.y, ang: Math.atan2(e.y - gr.y, e.x - gr.x) + (i - 0.5) * 0.4, spd: 420, dist: 2200, dmg: 0.001, type: 'normal', pierce: 1, src: t, kind: 'rocket', r: 9, homing: true, tgt: e,
          onHit: (p, x) => explode(x.x, x.y, 30, fx.moab_missile_damage || 16, fx.moab_missile_damage_type || 'explosion', fx.moab_missile_pierce || 3, t, { kind: 'boomSmall' }) });
      }
    });
    // pumy, když letí nad cestou
    if (fx.drop_bomb_on_track_interval) {
      t.timers.bomb = (t.timers.bomb || 0) + dt;
      if (t.timers.bomb >= fx.drop_bomb_on_track_interval && distToTrack(gr.x, gr.y) < TRACK_HALF + 16 && G.enemies.length) {
        t.timers.bomb = 0;
        const n = fx.track_bomb_cluster_count || 1;
        for (let i = 0; i < n; i++) {
          const bx = gr.x - Math.cos(gr.ang) * i * 24, by = gr.y - Math.sin(gr.ang) * i * 24;
          addFx({ kind: 'drop', x: bx, y: by, dur: 0.35 });
          G.later.push({ at: G.time + 0.35 + i * 0.08, fn: () => explode(bx, by, fx.track_bomb_radius || 45, fx.track_bomb_damage || 3, fx.track_bomb_damage_type || 'explosion', fx.track_bomb_pierce || 15, t, { kind: 'boomFire' }) });
        }
      }
    }
    if (!cool(t, dt, t.st.interval)) return;
    if (t.st.mode === 'targeted_homing_stream') {   // míří na slizáky (Naváděné šipky a výš)
      t.shots++;
      const turrets = fx.independent_turrets_count || 1, used = new Set();
      let fired = false;
      for (let k = 0; k < turrets; k++) {
        const e = pickTarget({ ...from, target: k ? 'strong' : t.target }, 9999, { skip: used }) || pickTarget(from, 9999); if (!e) break;
        used.add(e); fired = true;
        const n = Math.max(1, Math.round(t.st.projectiles));
        for (let i = 0; i < n; i++) fireProj(t, e, { x: gr.x, y: gr.y, ang: Math.atan2(e.y - gr.y, e.x - gr.x) + (i - (n - 1) / 2) * 0.12, spd: fx.projectile_speed || 500, kind: 'gryfDart', homing: true, dist: 900 });
        if (fx.secondary_explosive_shell_every_n_shots && t.shots % fx.secondary_explosive_shell_every_n_shots === 0)
          shoot({ x: gr.x, y: gr.y, ang: Math.atan2(e.y - gr.y, e.x - gr.x), spd: 460, dist: Math.hypot(e.x - gr.x, e.y - gr.y) + 4, lob: true, r: 8, kind: 'shell', src: t,
            onBurst: p => explode(p.x, p.y, fx.shell_radius || 45, fx.shell_damage || 12, 'normal', 25, t, { kind: 'boom' }) });
      }
      if (!fired) t.cd = 0;
      return;
    }
    // kruhová salva kolem gryfa
    if (!enemiesNear(gr.x, gr.y, 170).some(e => visibleTo(e, t))) { t.cd = 0; return; }
    const n = Math.max(1, Math.round(t.st.projectiles));
    for (let i = 0; i < n; i++) shoot({ x: gr.x, y: gr.y, ang: gr.ang + i / n * Math.PI * 2, spd: projSpeed(t, fx.projectile_speed || 500), dist: 200, dmg: effDamage(t), type: t.st.type, pierce: effPierce(t), src: t, kind: 'gryfDart', r: 7 });
  },

  oblehaci_mozdir(t, dt, every) {
    const fx = t.fx;
    if (!t.aim) { const p = G.paths[0], q = posAt(p, p.len * 0.45); t.aim = { x: q.x, y: q.y }; }
    if (!cool(t, dt, t.st.interval)) return;
    let tx = t.aim.x, ty = t.aim.y;
    const R = t.st.expl || fx.explosion_radius || 52;
    if (t.follow && fx.allow_auto_follow_target) {
      const e = pickTarget(t, 9999); if (!e) { t.cd = 0; return; }
      tx = e.x; ty = e.y;
    } else if (!enemiesNear(tx, ty, R + 30).some(e => visibleTo(e, t))) { t.cd = 0; return; }
    const sc = fx.scatter_radius ?? 14, a = Math.random() * 6.283, rr = Math.random() * sc;
    tx += Math.cos(a) * rr; ty += Math.sin(a) * rr;
    const dist = Math.hypot(tx - t.x, ty - t.y);
    t.ang = Math.atan2(ty - t.y, tx - t.x); t.firedAt = G.time;
    shoot({ x: t.x, y: t.y, ang: t.ang, spd: Math.max(200, dist / (fx.shell_flight_time || 0.55)), dist, lob: true, arc: true, r: 9, kind: 'mortarShell', src: t, sx: t.x, sy: t.y, onBurst: p => mortarBurst(t, p.x, p.y) });
  },

  trpaslici_inzenyr(t, dt, every) {
    const fx = t.fx, range = effRange(t);
    if (fx.spawn_sentry_interval) every('sentry', fx.spawn_sentry_interval, () => {
      const mine = G.sentries.filter(s => s.src === t);
      if (mine.length >= (fx.max_active_sentries || 3)) return;
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * 6.283, d = 28 + Math.random() * (range - 28), x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d;
        if (x < 12 || y < 12 || x > TW - 12 || y > TH - 12 || distToTrack(x, y) < TRACK_HALF + 8 || inWater(x, y, 8)) continue;
        const types = Array.isArray(fx.sentry_types_set) ? fx.sentry_types_set : null;
        const kind = t.up[0] >= 5 ? 'plasma' : types ? types[(t.sentryN = (t.sentryN || 0) + 1) % types.length] : 'basic';
        throwTo(t, x, y);
        G.sentries.push({ x, y, kind, src: t, until: G.time + (fx.sentry_duration || 25), cd: 0.4, ang: 0, t0: G.time });
        return;
      }
    });
    if (fx.spawn_foam_on_track_interval) every('foam', fx.spawn_foam_on_track_interval / speedMul(t), () => {
      if (!G.waveActive || trapCount(t, ['foam']) >= 8) return;
      const e = pickTarget(t, range), q = e ? { x: e.x, y: e.y } : trackSpot(t, 'first'); if (!q) return;
      throwTo(t, q.x, q.y);
      addTrap({ kind: 'foam', x: q.x, y: q.y, r: 22, hp: fx.foam_pierce || 12, dmg: 0, until: G.time + (fx.foam_duration || 8), src: t });
    });
    if (fx.deploy_bloon_trap_interval) every('cage', fx.deploy_bloon_trap_interval, () => {
      if (!G.waveActive || trapCount(t, ['cage'])) return;
      const q = trackSpot(t, 'first'); if (!q) return;
      throwTo(t, q.x, q.y);
      addTrap({ kind: 'cage', x: q.x, y: q.y, r: 20, hp: fx.trap_capacity_rbe || 120, cap: fx.trap_capacity_rbe || 120, dmg: 0, until: G.time + 60, src: t });
    });
    if (!cool(t, dt, t.st.interval)) return;
    const e = pickTarget(t, range); if (!e) { t.cd = 0; return; }
    aimAt(t, e);
    const n = Math.max(1, Math.round(t.st.projectiles)), spread = (fx.spread_deg || 8) * Math.PI / 180;
    for (let i = 0; i < n; i++) fireProj(t, e, { ang: t.ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), spd: fx.projectile_speed || 540, kind: 'nail', onHit: (p, x) => nailHit(t, x) });
  },
};
function nailHit(t, x) {
  if (t.fx.strip_lead && !isBoss(x)) { x.armored = false; x.stripLeadKids = true; }
  // přišpendlí jen slizáka, kterého hřeb opravdu zranil (jinak by třeba helmu držel na místě navždy)
  if (t.fx.pin_stun_duration && !isBoss(x) && x.immuneFlash !== G.time) stun(x, t.fx.pin_stun_duration);
}
function mortarBurst(t, x, y) {
  const fx = t.fx, R = t.st.expl || fx.explosion_radius || 52;
  explode(x, y, R, effDamage(t), t.st.type, effPierce(t), t, { kind: fx.burn_dps ? 'boomFire' : 'boom', each: e => {
    const wasStunned = stunned(e);
    if (!isBoss(e)) { if (fx.stun_duration) stun(e, fx.stun_duration); }
    else if (fx.can_stun_moab && fx.stun_moab_duration) stun(e, fx.stun_moab_duration);
    if (fx.bonus_stunned_damage && wasStunned) hitEnemy(e, fx.bonus_stunned_damage, 'normal', hitOpts(t));
    if (fx.burn_dps && !e.dead) e.burn = { dps: fx.burn_dps + (isBoss(e) ? fx.burn_bonus_boss_dps || 0 : 0), until: G.time + (fx.burn_duration || 3.5), src: t };
    if (!isBoss(e)) {
      if (fx.strip_fortified_from_non_moab) e.fort = false;
      if (fx.strip_regrow) e.regrow = false;
      if (fx.strip_lead) { e.armored = false; e.stripLeadKids = true; }
    }
  } });
  if (fx.shockwave_outer_radius) explode(x, y, fx.shockwave_outer_radius, fx.shockwave_damage || 1, t.st.type, 60, t, { kind: 'ring' });
  if (fx.strip_camo_on_hit) for (const e of enemiesNear(x, y, fx.decamo_radius || 85)) e.revealed = true;
  if (fx.leave_fire_patch_duration) G.zones.push({ kind: 'fire', x, y, r: fx.fire_patch_radius || 40, dps: fx.fire_patch_dps || 4, pierce: 40, until: G.time + fx.leave_fire_patch_duration + (fx.burn_duration > 5 ? 2 : 0), type: 'energy', src: t });
}

/* ── Pasti, střílny a pohyblivé věci (každý krok simulace) ──────── */
function trapHit(tr, e) {
  const s = tr.src, fx = s?.fx || {};
  if (tr.kind === 'foam') {
    slow(e, pctv(fx.foam_slow_pct || 25), G.time + 1.5);
    if (fx.foam_strips_camo) e.revealed = true;
    if (fx.foam_strips_regrow) e.regrow = false;
    if (fx.foam_strips_lead && !isBoss(e)) { e.armored = false; e.stripLeadKids = true; }
    tr.hp--;
    return;
  }
  hitEnemy(e, tr.dmg + (G.xTrapAdd || 0), tr.type || 'sharp', s ? hitOpts(s, { trap: true }) : { trap: true });
  if (s?.type === 'kladec_pasti') {
    if (fx.burn_dps && !e.dead) e.burn = { dps: fx.burn_dps, until: G.time + (fx.burn_duration || 3), src: s };
    if (fx.stun_duration && !isBoss(e)) stun(e, fx.stun_duration);
    if (fx.slow_moab_pct && isBoss(e)) slow(e, pctv(fx.slow_moab_pct), G.time + (fx.slow_duration || 2.5));
    if (fx.strip_camo_on_hit) e.revealed = true;
    if (fx.strip_regrow) e.regrow = false;
  }
  tr.hp--;
}
function cageTake(tr, e) {   // klec spolkne slizáka i s vrstvami a promění ho ve zlaťáky
  const fx = tr.src?.fx || {};
  let need = Math.max(1, Math.ceil(e.hp + rbeOf(e.t) - e.def.hp));
  if (isBoss(e)) {
    const cut = fx.trap_can_capture_boss_below_hp_pct;
    if (!cut || e.hp / e.maxHp > cut || (e.seal && e.seal.s > 0)) return;
    need = 0;   // král pod hranicí životů jde do klece celý
  } else if (need > tr.hp) return;
  e.dead = true; e.shrunk = true; G.stats.pops++;
  tr.hp -= need;
  const g = popGold(e.t) * cashScale() * (fx.trap_cash_bonus_mult || 2);
  addGold(g, true); floatText(e.x, e.y - 10, '+' + Math.round(g), '#facc15');
  addFx({ kind: 'shrink', x: e.x, y: e.y, r: e.def.r, dur: 0.4 });
}
function sentryFire(s, dt) {
  const t = s.src, fx = t.fx;
  s.cd -= dt * speedMul(t);
  if (s.cd > 0) return;
  const range = (fx.sentry_range || 115) * (1 + (t.aura?.rng || 0));
  const e = pickTarget({ x: s.x, y: s.y, target: 'first', st: t.st, aura: t.aura }, range);
  if (!e) { s.cd = 0.1; return; }
  const iv = fx.sentry_attack_interval || 0.9, dmg = (fx.sentry_damage || 1) + (G.xTrapAdd || 0), type = fx.sentry_damage_type_set || 'sharp', prc = fx.sentry_pierce || 2;
  s.ang = Math.atan2(e.y - s.y, e.x - s.x); s.firedAt = G.time; s.cd = iv;
  if (s.kind === 'explosion_bomb') {
    shoot({ x: s.x, y: s.y, ang: s.ang, spd: 380, dist: Math.hypot(e.x - s.x, e.y - s.y) + 4, lob: true, r: 7, kind: 'cannon', src: t, onBurst: p => explode(p.x, p.y, 38, dmg, 'explosion', 12, t, { kind: 'boomSmall' }) });
    s.cd = iv * 1.6;
  } else if (s.kind === 'laser_beam') {
    addFx({ kind: 'beam', x: s.x, y: s.y, tx: e.x, ty: e.y, dur: 0.1, col: '#fb923c' });
    let n = 0; for (const x of [e, ...enemiesNear(e.x, e.y, 34)]) { if (n++ >= prc + 4) break; hitEnemy(x, dmg, 'energy', hitOpts(t)); }
  } else if (s.kind === 'frost_pulse') {
    addFx({ kind: 'frostRing', x: s.x, y: s.y, r: 60, dur: 0.4 });
    for (const x of enemiesNear(s.x, s.y, 60)) { hitEnemy(x, dmg, 'freeze', hitOpts(t)); if (!x.dead && !isBoss(x)) freeze(x, 0.8, t); }
    s.cd = iv * 2;
  } else {
    const heavy = s.kind === 'crushing_mace';
    shoot({ x: s.x, y: s.y, ang: s.ang, spd: 560, dist: range * 1.2, dmg: heavy ? dmg * 2 : dmg, type, pierce: prc, src: t, kind: s.kind === 'plasma' ? 'plasma' : 'nail', r: 6,
      hit: heavy ? { heavy: 5 } : undefined, onHit: (p, x) => nailHit(t, x) });
  }
}
function updateExtras(dt) {
  G.xTrapAdd = 0;
  for (const t of G.towers) if (t.fx.global_sentry_and_trap_damage_add) G.xTrapAdd = Math.max(G.xTrapAdd, t.fx.global_sentry_and_trap_damage_add);
  // pasti, ježci, pěna, klece
  if (G.traps.length) {
    for (const tr of G.traps) {
      if (tr.dead) continue;
      if (G.time > tr.until) { tr.dead = true; continue; }
      for (const e of enemiesNear(tr.x, tr.y, tr.r)) {
        if (tr.hp <= 0) break;
        if (e.dead || e.flying || tr.hits.has(e)) continue;   // létající pasti přeletí
        tr.hits.add(e);
        if (tr.kind === 'cage') cageTake(tr, e); else trapHit(tr, e);
      }
      if (tr.hp <= 0) {
        tr.dead = true;
        const fx = tr.src?.fx || {};
        if (tr.kind !== 'foam' && tr.kind !== 'cage' && tr.src?.type === 'kladec_pasti' && fx.explode_on_trap_deplete)
          explode(tr.x, tr.y, tr.src.st.expl || 60, fx.explosion_damage || 18, 'explosion', fx.explosion_pierce || 25, tr.src, { kind: 'boomFire', each: e => { if (isBoss(e) && fx.stun_moab_duration) stun(e, fx.stun_moab_duration); } });
        if (tr.kind === 'cage') addFx({ kind: 'gold', x: tr.x, y: tr.y, dur: 0.6 });
      }
    }
    G.traps = G.traps.filter(x => !x.dead);
  }
  // automatické střílny inženýra
  if (G.sentries.length) {
    for (const s of G.sentries) {
      if (G.time > s.until || !G.towers.includes(s.src)) {
        s.dead = true;
        const fx = s.src.fx;
        if (fx.sentry_explode_on_expire_damage && G.towers.includes(s.src)) explode(s.x, s.y, fx.sentry_explode_radius || 75, fx.sentry_explode_on_expire_damage, 'normal', 40, s.src, { kind: 'boomFire' });
        continue;
      }
      sentryFire(s, dt);
    }
    G.sentries = G.sentries.filter(s => !s.dead);
  }
  // tornáda, kulové blesky, šlahouny, přísavné nálože
  if (G.movers.length) {
    for (const m of G.movers) {
      if (m.dead) continue;
      const fx = m.src.fx;
      if (m.kind === 'tornado') {
        if (G.time > m.until) { m.dead = true; continue; }
        m.d = Math.max(0, m.d - m.spd * dt);
        const q = posAt(G.paths[m.pi], m.d); m.x = q.x; m.y = q.y;
        for (const e of enemiesNear(m.x, m.y, 26)) {
          if (m.pierce <= 0) break;
          if (m.hits.has(e)) continue;
          m.hits.add(e);
          const kb = isBoss(e) ? (fx.tornado_affects_moab ? fx.tornado_moab_knockback || 55 : 0) : fx.tornado_knockback || 95;
          if (isBoss(e) && !kb) continue;
          m.pierce--;
          if (!slowImmune(e) && (isBoss(e) || canKnock(e))) e.d = Math.max(0, e.d - kb);
          if (fx.strip_camo_on_hit) e.revealed = true;
        }
      } else if (m.kind === 'ball') {
        if (G.time > m.until) { m.dead = true; continue; }
        m.x += Math.cos(m.ang) * m.spd * dt; m.y += Math.sin(m.ang) * m.spd * dt;
        m.acc += dt;
        if (m.acc >= 0.25) {
          const k = m.acc; m.acc = 0;
          for (const e of enemiesNear(m.x, m.y, m.r)) {
            hitEnemy(e, (fx.ball_lightning_dps || 8) * k, 'energy', hitOpts(m.src));
            if (!e.dead && fx.ball_lightning_freeze_chance && Math.random() < fx.ball_lightning_freeze_chance * k) freeze(e, 1, m.src);
          }
        }
      } else if (m.kind === 'vine') {
        const e = m.e;
        m.x = e.x; m.y = e.y;
        m.acc += dt;
        if (m.acc >= 0.25 && !e.dead) { hitEnemy(e, m.dps * m.acc, 'normal', hitOpts(m.src)); m.acc = 0; }
        if (G.time > m.until || e.dead) {
          m.dead = true; e.vined = false;
          G.zones.push({ kind: 'acid', x: m.x, y: m.y, r: 30, dps: fx.vine_patch_dps || 2, slow: pctv(fx.vine_patch_slow_pct || 35), pierce: 30, until: G.time + (fx.vine_after_pop_patch_duration || 4), type: 'normal', src: m.src });
        }
      } else if (m.kind === 'sticky') {
        if (!m.e.dead) { m.x = m.e.x; m.y = m.e.y; }
        if (G.time < m.at) continue;
        m.dead = true;
        if (!m.e.dead) hitEnemy(m.e, fx.sticky_bomb_boss_damage || 160, 'normal', hitOpts(m.src));
        explode(m.x, m.y, fx.sticky_bomb_splash_radius || 55, fx.sticky_bomb_splash_damage || 35, 'normal', 30, m.src, { kind: 'boomFire' });
      }
    }
    G.movers = G.movers.filter(m => !m.dead && G.towers.includes(m.src));
  }
}
// Bonusy k rychlosti útoku, které se mění za běhu
function xSpeed(t) {
  let m = 0;
  const fx = t.fx || {};
  if (t.ocUntil > G.time) m += (t.ocMul || 1.65) - 1;
  if (t.ocPerm) m += t.ocPerm;
  if (t.barrageUntil > G.time) m += (fx.ability_fire_rate_mult || 3) - 1;
  if (t.type === 'lesni_druid') {
    if (fx.base_attack_speed_bonus_pct) m += pctv(fx.base_attack_speed_bonus_pct) + Math.min(pctv(fx.max_leak_speed_boost_pct || 80), G.stats.leaks * pctv(fx.speed_boost_per_leak_pct || 5));
    if (t.fury) m += t.fury;
  }
  return m;
}
// Aury mezi věžemi stejného druhu (škola stínů, smečka druidů)
function xAuras() {
  const zv = G.towers.filter(t => t.type === 'stinovy_zved'), dr = G.towers.filter(t => t.type === 'lesni_druid');
  for (const t of zv) {
    let n = 0, spd = 0, rng = 0, dmg = 0, boss = 0;
    for (const h of zv) if (h !== t && h.fx.aura_other_ninjas_attack_speed_pct && Math.hypot(h.x - t.x, h.y - t.y) <= h.st.range) {
      if (n++ >= (h.fx.max_shinobi_stacks || 10)) break;
      spd += pctv(h.fx.aura_other_ninjas_attack_speed_pct); rng += pctv(h.fx.aura_other_ninjas_range_pct || 0);
      dmg = Math.max(dmg, h.fx.aura_other_ninjas_damage_add || 0); boss = Math.max(boss, h.fx.aura_other_ninjas_bonus_boss_damage_add || 0);
    }
    t.aura.spd += spd; t.aura.rng += rng; t.aura.dmg += dmg; t.aura.boss = (t.aura.boss || 0) + boss;
  }
  for (const t of dr) {
    const others = dr.filter(h => h !== t && Math.hypot(h.x - t.x, h.y - t.y) <= Math.max(t.st.range, h.st.range));
    const leader = t.fx.aura_other_druids_attack_speed_pct ? t : others.find(h => h.fx.aura_other_druids_attack_speed_pct);
    if (!leader || !others.length) continue;
    t.aura.spd += pctv(leader.fx.aura_other_druids_attack_speed_pct) * Math.min(leader.fx.max_pack_stacks || 5, others.length);
  }
}
// Konec vlny: zlaťáky za nespotřebované pasti, běžné pasti se rozpadnou
function xWaveEnd() {
  for (const t of G.towers) if (t.fx.end_of_wave_cash_per_active_trap) {
    const n = trapCount(t);
    if (n) { const g = n * t.fx.end_of_wave_cash_per_active_trap; addGold(g); floatText(t.x, t.y - 26, '+' + g, '#facc15'); }
  }
  if (!G.vs) G.traps = G.traps.filter(x => x.persist || x.kind === 'cage');
}

/* ── Schopnosti ────────────────────────────────────────────────── */
Object.assign(ABILITY, {
  'kladec_pasti:2'(t) { carpetOfTraps(t, t.fx.ability_traps_count || 20); },
  'lesni_druid:2'(t) {
    const mines = G.towers.filter(o => o.type === 'zlaty_dul' && Math.hypot(o.x - t.x, o.y - t.y) <= effRange(t)).length;
    const g = (t.fx.ability_base_cash || 320) + mines * (t.fx.ability_cash_per_farm_in_range || 130);
    addGold(g); floatText(t.x, t.y - 30, '+' + g + ' zl', '#facc15'); addFx({ kind: 'gold', x: t.x, y: t.y, dur: 0.8 });
  },
  'stinovy_zved:2'(t) {
    G.sabotage = { until: G.time + (t.fx.ability_duration || 15), pct: pctv(t.fx.ability_global_slow_pct || 50), bossCut: pctv(t.fx.ability_spawn_moab_hp_reduction_pct || 0) };
    addFx({ kind: 'reveal', x: t.x, y: t.y, r: 900, dur: 0.8 });
  },
  'gryfi_jezdec:2'(t) {
    const fx = t.fx;
    addFx({ kind: 'carpet', dur: 0.8 });
    for (const e of G.enemies) {
      if (e.dead || e.d < 0) continue;
      hitEnemy(e, fx.ability_global_damage || 220, 'normal', hitOpts(t));
      if (e.dead) continue;
      if (!isBoss(e)) stun(e, fx.ability_stun_duration || 2);
      else if (fx.ability_stun_moab_duration) stun(e, fx.ability_stun_moab_duration);
    }
  },
  'oblehaci_mozdir:2'(t) {
    const fx = t.fx;
    t.barrageUntil = G.time + (fx.ability_duration || 8);
    if (fx.ability_global_bombardment_waves) for (let i = 0; i < fx.ability_global_bombardment_waves; i++) G.later.push({ at: G.time + 0.5 * i, fn: () => {
      addFx({ kind: 'carpet', dur: 0.4 });
      for (const e of G.enemies) {
        if (e.dead || e.d < 0) continue;
        hitEnemy(e, fx.ability_wave_damage || 60, 'normal', hitOpts(t));
        if (!e.dead && (!isBoss(e) || fx.can_stun_moab)) stun(e, fx.ability_wave_stun || 1);
      }
    } });
  },
  'trpaslici_inzenyr:2'(t) {
    const fx = t.fx;
    const cand = G.towers.filter(o => o !== t && o.type !== 'trpaslici_inzenyr');
    const near = cand.filter(o => Math.hypot(o.x - t.x, o.y - t.y) <= effRange(t) * 1.5);
    const o = (near.length ? near : cand).sort((a, b) => b.spent - a.spent)[0];
    if (!o) return false;
    o.ocUntil = G.time + (fx.ability_duration || 25); o.ocMul = fx.ability_attack_speed_mult || 1.65;
    if (fx.ability_permanent_stack_speed_pct) o.ocPerm = Math.min(pctv(fx.ability_permanent_stack_speed_pct) * (fx.ability_max_permanent_stacks || 10), (o.ocPerm || 0) + pctv(fx.ability_permanent_stack_speed_pct));
    addFx({ kind: 'zap', x: t.x, y: t.y, tx: o.x, ty: o.y, dur: 0.4, col: '#60a5fa' });
    floatText(o.x, o.y - 26, '⚡ přetaktováno', '#93c5fd');
  },
});

/* ── Kreslení bez textur (emoji a jednoduché tvary) ────────────── */
// Textury od Gemini přijdou přes TDS.<id>Extra(ctx, kind, x, y, ang, ts, s) — dokud nejsou, kreslí se tohle.
const XR = (() => {
  const TAU = Math.PI * 2;
  const has = id => typeof TDS !== 'undefined' && TDS[id + 'Extra'] && localStorage.getItem('td_gfx') !== '0';
  const TRAP_SRC = { spike: 'kladec_pasti', jaw: 'kladec_pasti', mine: 'kladec_pasti', crystal: 'kladec_pasti', caltrop: 'stinovy_zved', foam: 'trpaslici_inzenyr', cage: 'trpaslici_inzenyr' };
  function emoji(g, ch, x, y, size) { g.fillStyle = '#111'; g.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y); g.textBaseline = 'alphabetic'; }
  function trap(g, tr, ts) {
    const id = TRAP_SRC[tr.kind];
    if (has(id)) { TDS[id + 'Extra'](g, tr.kind, tr.x, tr.y, 0, ts, { hp: tr.hp, fill: tr.cap ? 1 - tr.hp / tr.cap : 0 }); return; }
    const fade = Math.min(1, (tr.until - G.time) / 2);
    g.save(); g.globalAlpha = Math.max(0.3, fade); g.translate(tr.x, tr.y);
    if (tr.kind === 'foam') { g.fillStyle = 'rgba(248,250,252,.8)'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(Math.cos(a) * 9, Math.sin(a) * 6, 7, 0, TAU); g.fill(); } }
    else if (tr.kind === 'cage') { g.fillStyle = '#78716c'; g.fillRect(-13, -13, 26, 26); g.strokeStyle = '#fde047'; g.lineWidth = 2; g.strokeRect(-13, -13, 26, 26); for (let i = -6; i <= 6; i += 6) { g.beginPath(); g.moveTo(i, -13); g.lineTo(i, 13); g.stroke(); } g.fillStyle = '#facc15'; g.fillRect(-13, 11, 26 * (tr.cap ? 1 - tr.hp / tr.cap : 0), 3); }
    else {
      const col = { spike: '#a8a29e', caltrop: '#78716c', jaw: '#57534e', mine: '#b91c1c', crystal: '#38bdf8' }[tr.kind];
      g.fillStyle = col; g.strokeStyle = '#1c1917'; g.lineWidth = 1.2;
      const n = tr.kind === 'mine' ? 0 : 4, s = tr.kind === 'jaw' ? 9 : 7;
      if (tr.kind === 'mine') { g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fde047'; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill(); }
      for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.4; g.beginPath(); g.moveTo(Math.cos(a) * s, Math.sin(a) * s); g.lineTo(Math.cos(a + 1.2) * 2.5, Math.sin(a + 1.2) * 2.5); g.lineTo(Math.cos(a - 1.2) * 2.5, Math.sin(a - 1.2) * 2.5); g.closePath(); g.fill(); g.stroke(); }
    }
    g.restore();
  }
  function ground(g, ts, view) {
    for (const t of G.towers) if (t.type === 'lesni_druid' && t.fx.full_track_thorns_dps) {   // trny po celé cestě
      g.save(); g.strokeStyle = 'rgba(21,128,61,.35)'; g.lineWidth = 30; g.lineJoin = 'round'; g.setLineDash([4, 10]);
      for (const p of G.paths) { g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke(); }
      g.restore(); break;
    }
    for (const tr of G.traps) trap(g, tr, ts);
    for (const t of G.towers) if (t.type === 'oblehaci_mozdir' && t.aim && !(t.follow && t.fx.allow_auto_follow_target)) {   // terč moždíře
      const sel = view?.sel === t, R = t.st.expl || 52;
      if (has('oblehaci_mozdir')) { TDS.oblehaci_mozdirExtra(g, 'target', t.aim.x, t.aim.y, 0, ts, { r: R, sel }); continue; }
      g.save(); g.strokeStyle = sel ? 'rgba(239,68,68,.95)' : 'rgba(239,68,68,.5)'; g.lineWidth = sel ? 2.5 : 1.5; g.setLineDash([6, 5]);
      g.beginPath(); g.arc(t.aim.x, t.aim.y, R, 0, TAU); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(t.aim.x - 9, t.aim.y); g.lineTo(t.aim.x + 9, t.aim.y); g.moveTo(t.aim.x, t.aim.y - 9); g.lineTo(t.aim.x, t.aim.y + 9); g.stroke(); g.restore();
    }
    for (const m of G.movers) {
      if (m.kind === 'tornado') {
        if (has('lesni_druid')) { TDS.lesni_druidExtra(g, 'tornado', m.x, m.y, 0, ts, {}); continue; }
        g.save(); g.translate(m.x, m.y); g.strokeStyle = 'rgba(226,232,240,.8)'; g.lineWidth = 3;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, -i * 6, 14 - i * 3, ts / 120 + i, ts / 120 + i + 4.2); g.stroke(); }
        g.restore();
      } else if (m.kind === 'ball') {
        if (has('lesni_druid')) { TDS.lesni_druidExtra(g, 'ball', m.x, m.y, 0, ts, { r: m.r }); continue; }
        g.save(); g.fillStyle = 'rgba(96,165,250,.18)'; g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
        g.fillStyle = '#bfdbfe'; g.beginPath(); g.arc(m.x, m.y, 9 + Math.sin(ts / 60) * 2, 0, TAU); g.fill(); g.restore();
      } else if (m.kind === 'vine') {
        if (has('lesni_druid')) { TDS.lesni_druidExtra(g, 'vine', m.x, m.y, 0, ts, {}); continue; }
        g.save(); g.strokeStyle = '#166534'; g.lineWidth = 3; g.beginPath(); g.arc(m.x, m.y, 13, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(m.x - 12, m.y + 10); g.quadraticCurveTo(m.x, m.y - 14, m.x + 12, m.y + 10); g.stroke(); g.restore();
      } else if (m.kind === 'sticky') {
        if (has('stinovy_zved')) { TDS.stinovy_zvedExtra(g, 'sticky', m.x, m.y, 0, ts, { left: m.at - G.time }); continue; }
        g.save(); g.fillStyle = (Math.floor(ts / 120) % 2) ? '#ef4444' : '#7f1d1d'; g.beginPath(); g.arc(m.x + 8, m.y - 8, 5, 0, TAU); g.fill(); g.restore();
      }
    }
  }
  function air(g, ts) {
    for (const s of G.sentries) {
      if (has('trpaslici_inzenyr')) { TDS.trpaslici_inzenyrExtra(g, 'sentry_' + s.kind, s.x, s.y, s.ang, ts, { firing: s.firedAt ? Math.max(0, 1 - (G.time - s.firedAt) / 0.1) : 0 }); continue; }
      g.save(); g.translate(s.x, s.y);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(2, 5, 10, 5, 0, 0, TAU); g.fill();
      g.fillStyle = { basic: '#a16207', crushing_mace: '#57534e', explosion_bomb: '#b91c1c', laser_beam: '#ea580c', frost_pulse: '#0ea5e9', plasma: '#a855f7' }[s.kind] || '#a16207';
      g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.strokeStyle = '#1c1917'; g.lineWidth = 1.5; g.stroke();
      g.rotate(s.ang); g.fillStyle = '#292524'; g.fillRect(0, -2, 11, 4);
      g.restore();
    }
    for (const t of G.towers) if (t.gryf) {
      const gr = t.gryf;
      if (has('gryfi_jezdec')) { TDS.gryfi_jezdecExtra(g, 'gryf', gr.x, gr.y, gr.ang, ts, { up: t.up }); continue; }
      gryf(g, gr, t, ts);
    }
  }
  // Gryf v kresleném stylu: tělo, mávající křídla, bílá hlava se zobákem a jezdec (zbroj podle úrovní)
  function gryf(g, gr, t, ts) {
    const tier = Math.max(...t.up), s = 1 + tier * 0.06, flap = Math.sin(ts / 90) * 0.35;
    const armor = tier >= 5 ? '#facc15' : tier >= 4 ? '#60a5fa' : null;
    g.save();
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(gr.x + 10, gr.y + 18, 16 * s, 7 * s, 0, 0, TAU); g.fill();
    g.translate(gr.x, gr.y); g.rotate(gr.ang); g.scale(s, s);
    for (const sd of [-1, 1]) {   // křídla
      g.save(); g.rotate(sd * (0.25 + flap));
      g.fillStyle = tier >= 5 ? '#fde68a' : '#d6a35c'; g.strokeStyle = '#5b3a1e'; g.lineWidth = 1.4;
      // široké křídlo: náběžná hrana dopředu, zadní hrana z vroubkovaných letek
      g.beginPath(); g.moveTo(3, sd * 3); g.quadraticCurveTo(8, sd * 18, -1, sd * 30);
      const fe = [[-7, 27], [-11, 20], [-13, 13], [-9, 5]];
      let px = -1, py = 30;
      for (const [fx, fy] of fe) { g.quadraticCurveTo((px + fx) / 2 - 4, sd * ((py + fy) / 2), fx, sd * fy); px = fx; py = fy; }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = tier >= 5 ? '#fef3c7' : '#e9c48a';   // světlejší krovky u ramene
      g.beginPath(); g.moveTo(3, sd * 3); g.quadraticCurveTo(6, sd * 12, 1, sd * 17); g.quadraticCurveTo(-4, sd * 12, -6, sd * 5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(91,58,30,.45)'; g.lineWidth = 1; for (const [fx, fy] of fe.slice(0, 3)) { g.beginPath(); g.moveTo(fx + 1, sd * fy); g.lineTo(2, sd * (fy * 0.55)); g.stroke(); }
      g.restore();
    }
    g.fillStyle = '#b07d3e'; g.strokeStyle = '#5b3a1e'; g.lineWidth = 1.5;   // tělo lva
    g.beginPath(); g.ellipse(-3, 0, 11, 6.5, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-20, 4 + flap * 6, -23, 1); g.stroke();   // ocas
    if (armor) { g.fillStyle = armor; g.fillRect(-8, -4, 7, 8); }
    g.fillStyle = '#f8fafc'; g.beginPath(); g.arc(8, 0, 5, 0, TAU); g.fill(); g.stroke();   // orlí hlava
    g.fillStyle = '#f59e0b'; g.beginPath(); g.moveTo(12, -2); g.lineTo(17, 0); g.lineTo(12, 2.2); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(9.5, -2.2, 0.9, 0, TAU); g.arc(9.5, 2.2, 0.9, 0, TAU); g.fill();
    g.fillStyle = t.up[1] >= 3 ? '#b91c1c' : '#2563eb'; g.beginPath(); g.arc(-3, 0, 3.6, 0, TAU); g.fill();   // jezdec
    g.fillStyle = armor || '#cbd5e1'; g.beginPath(); g.arc(-2.4, 0, 2.2, 0, TAU); g.fill();
    g.restore();
  }
  return { ground, air, emoji };
})();

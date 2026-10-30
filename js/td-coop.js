// ═══ td-coop.js — Obrana království spolu (co-op 2–4 hráčů na jedné mapě)
// Každý hráč počítá CELOU stejnou simulaci (td-engine.js je deterministický: DM.* místo Math.sin/cos/…,
// náhoda ze společného semínka). Neposílá se stav mapy, jen akce: hostitel ~10× za sekundu zapíše „snímek“
// do live/td_{id}/world/f/{n} = { t: krok simulace, a: [akce], p: pauza, s: rychlost, c: [krok, kontrolní součet] }
// a všichni (i hostitel) dojedou simulaci do kroku t a provedou akce v tom pořadí. Hráči posílají žádosti
// o akce do live/td_{id}/players/{uid}/rq (každý zapisuje jen do svého, viz database.rules.json).
// Ekonomika podle TD.econ.coop: každý má svoje zlaťáky, krystaly, hrdinu a svitky, odměny za slizáky a vlny
// se dělí, výnos věží (doly, příjmy) jde majiteli, zlato jde poslat spoluhráči, životy jsou společné.

let COOP = null;
const CO = TD.coop;
const SPLIT = '*';   // kontext „všichni“ (simulace mimo akce hráče)
const P_FIELDS = ['gold', 'km', 'hero', 'heroId', 'cardsOk', 'cardsBad', 'cardsThisWave', 'streak', 'cardCdUntil', 'nextCardKmBonus', 'cardQuotaBonus', 'debt'];
const FRAME_MS = 100;
const fkey = n => 'f' + String(n).padStart(8, '0');

/* ── Peněženka, krystaly, hrdina a svitky po hráčích ───────────── */
function coopWallets(order, heroOf, gold, km) {
  const c = G.coop = { order, cur: ME.uid, inAct: false, tick: 0, p: {} };
  order.forEach(u => { c.p[u] = { gold, km, hero: null, heroId: heroOf[u], cardsOk: 0, cardsBad: 0, cardsThisWave: 0, streak: 0, cardCdUntil: 0, nextCardKmBonus: 0, cardQuotaBonus: 0, debt: 0 }; });
  const who = () => (c.cur === SPLIT || !c.p[c.cur] ? c.order[0] : c.cur);
  P_FIELDS.forEach(f => Object.defineProperty(G, f, { configurable: true, enumerable: true, get: () => c.p[who()][f], set: v => { c.p[who()][f] = v; } }));
}
function withCtx(uid, fn) { const c = G.coop, prev = c.cur; c.cur = uid; try { return fn(); } finally { c.cur = prev; } }
const coopSplit = () => CO.scaling_by_player_count[`${Math.min(4, Math.max(2, G.coop.order.length))}_players`];

// ── úpravy enginu (platí jen v co-opu, jinak se volá původní funkce) ──
allHeroes = function () { return G.coop ? G.coop.order.map(u => G.coop.p[u].hero).filter(Boolean) : G.hero ? [G.hero] : []; };
heroTick = function (dt) {
  if (!G.coop) { if (G.hero) updateHero(dt); return; }
  for (const u of G.coop.order) if (G.coop.p[u].hero) withCtx(u, () => updateHero(dt));
};
const _co = { addGold, addHeroXp, step, updateTower, placeTower, payMines, waveRewards, startWave };
addGold = function (n, fromPop) {
  if (!G.coop) return _co.addGold(n, fromPop);
  if (!(n > 0)) return;
  if (fromPop || G.coop.cur === SPLIT) {   // odměny za slizáky a vlny se dělí mezi všechny
    const k = coopSplit().pop_and_wave_reward_split_per_player;
    G.coop.order.forEach(u => { G.coop.p[u].gold += n * k; });
    G.stats.earned += n; if (fromPop) G.stats.popGold += n;
    return;
  }
  _co.addGold(n, fromPop);
};
addHeroXp = function (n) {
  if (!G.coop || G.coop.cur !== SPLIT) return _co.addHeroXp(n);
  for (const u of G.coop.order) if (G.coop.p[u].hero) withCtx(u, () => _co.addHeroXp(n));
};
step = function (dt) {
  if (!G.coop) return _co.step(dt);
  withCtx(SPLIT, () => _co.step(dt));
  G.coop.tick++;
};
updateTower = function (t, dt) {   // co věž vydělá (dopad olova, schopnosti), dostane její majitel
  if (!G.coop || !t.owner) return _co.updateTower(t, dt);
  return withCtx(t.owner, () => _co.updateTower(t, dt));
};
placeTower = function (type, x, y) {
  const why = _co.placeTower(type, x, y);
  if (!why && G.coop) G.towers[G.towers.length - 1].owner = G.coop.cur;
  return why;
};
payMines = function (frac) {   // doly vydělávají majiteli
  if (!G.coop) return _co.payMines(frac);
  for (const t of G.towers) {
    if (t.type !== 'zlaty_dul' || t.fx.bank_mode) continue;
    withCtx(t.owner || SPLIT, () => {
      const total = mineIncome(t), due = total * frac - (t.paid || 0);
      if (due >= 1) {
        let g = due;
        if (G.debt > 0) { const r = Math.min(G.debt, g * 0.5); G.debt -= r; g -= r; }
        t.paid = (t.paid || 0) + due; _co.addGold(g);
        floatText(t.x, t.y - 22, '+' + Math.round(g), '#facc15');
      }
    });
  }
};
waveRewards = function (w) {
  if (!G.coop) return _co.waveRewards(w);
  if (typeof xWaveEnd === 'function') xWaveEnd();
  for (const t of G.towers) {
    if (t.type === 'zlaty_dul' && t.fx.bank_mode) withCtx(t.owner || SPLIT, () => { t.bank = Math.min(t.fx.bank_capacity || 7500, ((t.bank || 0) + mineIncome(t)) * (1 + (t.fx.compound_interest_per_wave_pct || 0.15))); });
    if (t.fx.lives_generated_per_wave) G.lives = Math.min(livesCap(), G.lives + t.fx.lives_generated_per_wave);
    withCtx(t.owner || SPLIT, () => {
      if (t.fx.base_income_per_wave) { addGold(t.fx.base_income_per_wave); floatText(t.x, t.y - 22, '+' + t.fx.base_income_per_wave, '#facc15'); }
      if (t.fx.buff_water_towers_income) { const n = G.towers.filter(o => o.type === 'ricni_galera').length; if (n) addGold(n * t.fx.buff_water_towers_income); }
    });
  }
  for (const u of G.coop.order) withCtx(u, () => {
    const h = G.hero;
    if (h) {
      _co.addHeroXp(40 + 15 * w);
      if (h.id === 'kronikar_oskar') {
        const L = h.level, g = L >= 18 ? 300 : L >= 12 ? 150 : L >= 6 ? 80 : L >= 2 ? 40 : 0;
        if (g) addGold(g);
        if (L >= 6) G.lives = Math.min(livesCap(), G.lives + (L >= 18 ? 5 : 2));
      }
    }
    G.cardsThisWave = 0; G.cardQuotaBonus = 0;
  });
  G.stats.wavesDone = w;
};
startWave = function () {   // víc hráčů = víc slizáků (enemy_count_multiplier)
  const before = G.wave;
  _co.startWave();
  if (!G.coop || G.wave === before) return;
  const mul = coopSplit().enemy_count_multiplier, base = G.schedule.slice(), extra = Math.round(base.length * (mul - 1));
  for (let i = 0; i < extra; i++) { const s = base[Math.floor(i * base.length / Math.max(1, extra))]; G.schedule.push({ ...s, at: s.at + 0.18, path: (s.path + 1) % G.paths.length }); }
  G.schedule.sort((a, b) => a.at - b.at || a.path - b.path);
  G.waveLen = Math.max(8, (G.schedule[G.schedule.length - 1]?.at || 0) + 6);
};

/* ── Kontrolní součet (pozná, kdyby se mapy rozešly) ───────────── */
function coopChecksum() {
  let h = Math.round(G.lives * 10) + G.enemies.length * 31 + G.towers.length * 977 + G.wave * 7919;
  for (const e of G.enemies) h = (h * 31 + Math.round(e.hp * 10) + Math.round(e.d) * 7 + e.id) % 2147483647;
  for (const u of G.coop.order) h = (h * 31 + Math.round(G.coop.p[u].gold) + G.coop.p[u].km * 13) % 2147483647;
  return h;
}

/* ── Rychlá cesta přes vlastní server ─────────────────────────────
   sb-relay na Oracle serveru (vedle GameHubu, zdrojáky v relay/): snímky a žádosti jdou po WebSocketu
   (desítky ms místo stovek přes Firebase). Firebase se zapisuje dál — kdyby server neběžel nebo spadl,
   hra jede přes něj jako dřív; co dojde dvakrát, se pozná podle čísla snímku / id žádosti. */
const RELAY_URL = 'wss://vgamehub.duckdns.org/sb/ws';
function coopRelay() {
  const C = COOP; let ws = null, ok = false, tries = 0, closed = false;
  const open = async () => {
    if (closed || C.done) return;
    let token; try { token = await firebase.auth().currentUser.getIdToken(); } catch (e) { return; }
    try { ws = new WebSocket(RELAY_URL); } catch (e) { retry(); return; }
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', kind: 'td', gid: GID, token, since: C.nextN }));
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.t === 'ok') { ok = true; tries = 0; console.info('[co-op] rychlé spojení přes server'); }
      else if (m.t === 'f') { const f = m.f; if (f && f.n >= C.nextN && !C.frames.has(f.n)) C.frames.set(f.n, f); }
      else if (m.t === 'rq' && C.host) coopQueueRq(m.a, m.u);
      else if (m.t === 'err') { console.warn('[co-op] server:', m.m); closed = true; try { ws.close(); } catch (_) {} }
    };
    ws.onclose = () => { ok = false; retry(); };
    ws.onerror = () => {};
  };
  const retry = () => { if (closed || C.done) return; tries++; setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(tries, 5))); };
  open();
  return {
    send: m => { if (ok && ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
    close: () => { closed = true; try { ws && ws.close(); } catch (_) {} },
    get ok() { return ok; },
  };
}
// Ukazatel spojení v liště. Firebase jede pořád souběžně, bez serveru je hra jen pomalejší.
function coopNetChip() {
  const el = $('hudNet'); if (!el) return;
  const C = COOP; let last = '';
  const iv = setInterval(() => {
    if (C.done || COOP !== C) { clearInterval(iv); el.hidden = true; return; }
    const st = !C.host && Date.now() - C.lastFrameAt > 3000 ? 'silent' : C.relay?.ok ? 'ok' : 'backup';
    if (st === last) return;
    const was = last; last = st;
    const [txt, col, tip] = {
      ok: ['Spojení v pořádku', '#22c55e', 'Hra běží přes rychlý server.'],
      backup: ['Záložní spojení', '#f59e0b', 'Server není dostupný, hra běží přes Firebase a může být pomalejší.'],
      silent: ['Čekám na hostitele', '#ef4444', 'Několik sekund nedorazila data od hostitele.'],
    }[st];
    el.hidden = false; el.textContent = txt; el.title = tip; el.style.setProperty('--net', col);
    if (st === 'backup' && was === 'ok') toast('Server není dostupný, hra jede přes záložní spojení.');
    else if (st === 'ok' && was && was !== 'ok') toast('Spojení obnoveno.');
  }, 500);
}
// hostitel: žádost o akci (z Firebase i ze serveru — každá jen jednou)
function coopQueueRq(a, u) {
  const C = COOP; if (!a || !u) return;
  const k = u + ':' + a.id; if (C.seenRq.has(k)) return;
  C.seenRq.add(k); C.pending.push({ ...a, u });
}

/* ── Start ─────────────────────────────────────────────────────── */
function startCoop(d) {
  const order = [d.hostUid, ...d.playerIds.filter(u => u !== d.hostUid)], n = order.length;
  const sc = CO.scaling_by_player_count[`${Math.min(4, Math.max(2, n))}_players`];
  if (d.cards?.length) { POOL = unpackCards(d.cards); POOL.all = POOL; CARDQ = shuffle(POOL); }
  const heroOf = Object.fromEntries(order.map(u => [u, d.players[u]?.hero || TD.heroes[0].id]));
  newGame(d.map, heroOf[ME.uid], 'medium');
  G.rng = tdRng(d.seed || 1);
  G.lives = CO.shared_lives; G.bossHpMul = sc.boss_hp_multiplier;
  coopWallets(order, heroOf, sc.starting_gold_per_player, G.km);
  const root = rtdb().ref('live/td_' + GID);
  COOP = { d, host: d.hostUid === ME.uid, order, root, frames: new Map(), nextN: 1, pending: [], seq: 0, emitN: 0, lastT: 0,
    simT: 0, playT: 0, lastEmit: 0, lastFrameAt: Date.now(), speed: 1, paused: false, cs: new Map(), csBad: false, startAt: d.startAt, done: false, mineRq: new Set(), seenRq: new Set() };
  root.child('players/' + ME.uid + '/rq').remove().catch(() => {});
  root.child('world/f').on('child_added', s => { const f = s.val(); if (f && f.n >= COOP.nextN && !COOP.frames.has(f.n)) COOP.frames.set(f.n, f); });   // vlastní (už přehrané) snímky hostitele ignorovat
  if (COOP.host) {
    root.child('world/f').remove().catch(() => {});
    order.filter(u => u !== ME.uid).forEach(u => root.child('players/' + u + '/rq').on('child_added', s => coopQueueRq(s.val(), u)));
  }
  COOP.relay = coopRelay();
  coopNetChip();
  G.onLose = () => coopFinish(false);
  G.onWin = () => { $('tdWinDesc').textContent = `Společně jste ubránili všech ${winWave()} vln. Hra jede dál jako volná hra — slizáci budou čím dál silnější.`; $('tdWin').hidden = false; window.sfx?.('win'); };
  G.onWaveEnd = w => { if (w % CO.team_quiz_every_n_waves === 0) setTimeout(() => coopTeamQuiz(), 800); else if (w === 1) toast('🤝 Odměny za slizáky a vlny se dělí. Zlato můžeš poslat spoluhráči v záložce Tým.'); };
  view.tab = 'def';
  beginPlay();
  toast(`🤝 Hrajete spolu na jedné mapě (${n} hráči). Každý má svoje zlaťáky a hrdinu — ▶ Start spustí první vlnu.`);
}

/* ── Smyčka: simulace jede plynule, snímky jen určují, kdy se provedou akce ─── */
// Dřív se svět posunul jen při každém snímku (10× za sekundu) — i u hostitele, takže se to sekalo jako 10–20 FPS.
// Teď hostitel simuluje každý obrázek podle hodin a snímek s akcemi vydá v kroku, kde právě je. Klient jede
// plynule ~230 ms za posledním došlým snímkem (vyrovná nepravidelné doručování); dál než ten snímek nesmí,
// protože by nevěděl o akcích v něm. Když zaostává, mírně zrychlí, když dojíždí na snímek, zpomalí.
const BUF_T = 14;   // o kolik kroků (60/s, ~230 ms) se klient drží za posledním snímkem
function coopFrame(real, budget = 240) {
  const C = COOP; if (!C || C.done) return;
  const now = serverNow();
  let goal;
  if (C.host) {
    if (now >= C.startAt && !C.paused) C.simT += real * C.speed;
    goal = Math.floor(C.simT / STEP);
  } else {
    let k = C.nextN, maxT = G.coop.tick;
    while (C.frames.has(k)) { maxT = Math.max(maxT, C.frames.get(k).t); k++; }
    if (!C.paused) {
      const lag = maxT - BUF_T - C.playT, rate = 1 + Math.max(-0.1, Math.min(0.25, lag / 200));
      C.playT += real * C.speed / STEP * rate;
    }
    if (maxT - C.playT > 90) C.playT = maxT - BUF_T;   // hodně pozadu (záložka byla na pozadí) → dohnat
    C.playT = Math.max(G.coop.tick, Math.min(maxT, C.playT));
    goal = Math.floor(C.playT);
  }
  // krokovat k cíli; akce ze snímku se provedou přesně v jeho kroku
  let n = 0;
  for (;;) {
    const f = C.frames.get(C.nextN);
    if (f && G.coop.tick >= f.t) { coopPlayFrame(f); continue; }
    if (G.coop.tick >= goal || n >= budget || G.over) break;
    if (!C.host && !f) break;
    step(STEP); n++;
  }
  // hostitel: snímek s akcemi v kroku, kde právě je
  if (C.host && now >= C.startAt && Date.now() - C.lastEmit >= FRAME_MS && (G.coop.tick > C.lastT || C.pending.length || C.paused !== C.sentP || C.speed !== C.sentS)) {   // i změna pauzy/rychlosti
    C.lastEmit = Date.now();
    const f = { n: ++C.emitN, t: G.coop.tick, a: C.pending.splice(0, 40), p: C.paused ? 1 : 0, s: C.speed };
    if (C.emitN % 10 === 0) f.c = [G.coop.tick, coopChecksum()];
    C.lastT = G.coop.tick; C.sentP = C.paused; C.sentS = C.speed;
    C.frames.set(f.n, f);
    const upd = { [fkey(f.n)]: f };
    if (f.n > 400 && f.n % 50 === 0) for (let k = f.n - 400; k < f.n - 350; k++) upd[fkey(k)] = null;   // staré snímky pryč
    C.root.child('world/f').update(upd).catch(() => {});
    C.relay?.send({ t: 'f', f });
    coopPlayFrame(f);
  }
  // banner: start / pauza / hostitel neodpovídá
  const ban = $('tdBanner');
  let msg = '';
  if (now < C.startAt) msg = `🤝 Hra začíná za <b>${Math.ceil((C.startAt - now) / 1000)}</b> s`;
  else if (C.paused) msg = '⏸ Hostitel hru pozastavil';
  else if (!C.host && Date.now() - C.lastFrameAt > 6000) msg = '⏳ Čekám na hostitele…';
  if (msg) { ban.hidden = false; const h = TDI.html(msg); if (ban._h !== h) { ban._h = h; ban.innerHTML = h; } }
}
function coopPlayFrame(f) {
  const C = COOP;
  // kontrolní součet hostitele platí pro stav PŘED akcemi tohoto snímku
  if (f.c && !C.host && !C.csBad && G.coop.tick === f.c[0] && coopChecksum() !== f.c[1]) {
    C.csBad = true; console.warn('[co-op] rozdílný kontrolní součet', f.c, coopChecksum());
    toast('⚠️ Mapa se rozešla s hostitelem — co vidíš, může se trochu lišit.');
  }
  (f.a || []).forEach(coopApply);
  C.frames.delete(C.nextN); C.nextN++;
  C.lastFrameAt = Date.now(); C.paused = !!f.p; if (!C.host) C.speed = f.s || 1;
}
// Záloha, když neběží requestAnimationFrame (záložka na pozadí, skryté okno, úsporný režim telefonu):
// hra jede dál podle hodin, jinak by hostitel přestal vydávat snímky a ostatním by se zastavila.
let _coopPump = 0;
setInterval(() => {
  if (!COOP || !running || performance.now() - lastFrame < 400) { _coopPump = performance.now(); return; }
  const now = performance.now(), real = Math.min(1, (now - (_coopPump || now)) / 1000); _coopPump = now;
  try { coopFrame(real, 900); } catch (e) { console.error(e); }
}, 250);

/* ── Akce: odeslat → provést u všech ve stejném kroku ──────────── */
function coopSend(a) {
  const C = COOP; if (!C) return;
  a.id = ++C.seq;
  if (C.host) { C.pending.push({ ...a, u: ME.uid }); return; }
  C.mineRq.add(a.id);
  C.relay?.send({ t: 'rq', a });
  C.root.child(`players/${ME.uid}/rq/${a.id}`).set(a).catch(e => toast('Nepovedlo se poslat: ' + e.message));
}
const coopRef = s => !s ? null : s.boss ? { k: 'b', id: s.boss.id } : s.obst ? { k: 'o', i: (G.map.obstacles || []).indexOf(s.obst) } : s.hero ? { k: 'h' } : { k: 't', id: s.id };
function coopResolve(r, u) {
  if (!r) return null;
  if (r.k === 't') return G.towers.find(t => t.id === r.id) || null;
  if (r.k === 'h') return G.coop.p[u]?.hero || null;
  if (r.k === 'b') { const boss = G.enemies.find(e => e.id === r.id && !e.dead); return boss ? { boss } : null; }
  if (r.k === 'o') { const obst = (G.map.obstacles || [])[r.i]; return obst ? { obst } : null; }
  return null;
}
const coopName = u => COOP?.d.players[u]?.name || 'Hráč';
const coopMine = t => !COOP || !t || t.hero || !t.owner || t.owner === ME.uid;
// UI: vrací true, když akci převzal co-op (pošle se a provede až ve snímku)
const OWN_ACTS = new Set(['target', 'mode', 'bank', 'ability', 'up', 'sell', 'follow', 'fly']);
function coopIntercept(a, d, sel) {
  if (!COOP) return false;
  if (['tab', 'buy', 'tree', 'close', 'pick', 'movehero'].includes(a)) return false;   // jen rozhraní
  if (a === 'fly' && d.m === 'patrol') return false;   // nejdřív výběr místa na mapě
  if (OWN_ACTS.has(a) && !coopMine(sel)) { toast(`Tohle je věž hráče ${coopName(sel.owner)} — upravovat ji může jen on(a).`); return true; }
  if (a === 'give') { coopSend({ k: 'give', to: d.to, n: +d.n }); return true; }
  coopSend({ k: 'act', a, d: { ...d }, r: coopRef(sel) });
  return true;
}
function coopApply(x) {
  const u = x.u, C = COOP, me = u === ME.uid;
  if (!G.coop.p[u]) return;
  if (me && C.mineRq.has(x.id)) { C.mineRq.delete(x.id); C.root.child(`players/${ME.uid}/rq/${x.id}`).remove().catch(() => {}); }
  const say = (m, bad) => { if (me) { toast(m); if (bad) window.sfx?.('bad'); } };
  G.coop.inAct = true;
  try {
    withCtx(u, () => {
      switch (x.k) {
        case 'place': {
          let why;
          if (x.type === 'moveHero') why = G.hero ? moveHero(x.x, x.y) : 'Nemáš hrdinu';
          else if (HDEF[x.type]) why = G.hero ? 'Hrdinu už máš' : placeHero(x.type, x.x, x.y);
          else why = placeTower(x.type, x.x, x.y);
          if (why) say(why, true);
          else if (me) { const placed = x.type === 'moveHero' || HDEF[x.type] ? G.hero : G.towers[G.towers.length - 1]; if (!x.keep) { cancelPlacing(); view.sel = placed; } renderSide(true); }
          break;
        }
        case 'act': coopAct(x.a, x.d || {}, coopResolve(x.r, u), u, say); break;
        case 'hab': if (useHeroAbility(x.i) === false) say('Teď není na co to použít.'); break;
        case 'card': coopCardEffect(!!x.ok); break;
        case 'tq': if (x.ok) { G.gold += CO.team_quiz_reward_per_player.gold; G.km += CO.team_quiz_reward_per_player.knowledge_points; } break;
        case 'go': if (!G.waveActive && !G.over) startWave(); break;
        case 'give': {
          const n = Math.floor(x.n), to = G.coop.p[x.to];
          if (!to || x.to === u || !(n > 0)) break;
          if (G.gold + 1e-6 < n) { say('Tolik zlaťáků nemáš.', true); break; }
          G.gold -= n * (1 + (CO.transfer_tax_pct || 0) / 100); to.gold += n;
          if (me) { toast(`🤝 Posláno ${fmt(n)} zl hráči ${coopName(x.to)}.`); window.sfx?.('coin'); }
          else if (x.to === ME.uid) { toast(`🤝 ${coopName(u)} ti poslal(a) ${fmt(n)} zl.`); window.sfx?.('coin'); }
          break;
        }
      }
    });
  } catch (e) { console.error('[co-op] akce', x, e); }
  G.coop.inAct = false;
  if (me || x.k === 'give') renderSide(true);
}
// Stejné změny jako act() v td.js, jen pro konkrétního hráče (bez rozhraní)
function coopAct(a, d, sel, u, say) {
  if (OWN_ACTS.has(a) && sel && !sel.hero && sel.owner && sel.owner !== u) return;
  const tw = sel && !sel.boss && !sel.obst ? sel : null;
  switch (a) {
    case 'target': if (tw) tw.target = d.t; break;
    case 'mode': if (tw) tw.mode = tw.mode === 'lighthouse' ? null : 'lighthouse'; break;
    case 'bank': if (tw) { addGold(tw.bank || 0); floatText(tw.x, tw.y - 26, '+' + fmt(tw.bank || 0), '#facc15'); tw.bank = 0; if (u === ME.uid) window.sfx?.('coin'); } break;
    case 'ability': if (tw && useTowerAbility(tw) === false) say('Teď není na co to použít.'); break;
    case 'up': if (tw) { const why = buyUpgrade(tw, +d.p); if (why) say(why, true); } break;
    case 'sell': if (tw) { sellTower(tw); if (u === ME.uid && view.sel === tw) view.sel = null; } break;
    case 'flare': if (G.km >= 1) { G.km--; G.revealUntil = G.time + ECON.flashcards.emergency_flare_reveal_duration_s; } break;
    case 'sellkm': if (G.km >= 1) { G.km--; addGold(ECON.currencies.km_to_gold_conversion_rate); } break;
    case 'heroxp': if (G.km >= 1) { G.km--; addHeroXp(ECON.flashcards.direct_hero_xp_per_1_km); } break;
    case 'follow': if (tw) tw.follow = !tw.follow; break;
    case 'fly': if (tw?.gryf) tw.gryf.mode = d.m; break;
    case 'aim': if (tw) { tw.aim = { x: d.x, y: d.y }; tw.follow = false; } break;
    case 'patrol': if (tw?.gryf) { tw.gryf.pt = { x: d.x, y: d.y }; tw.gryf.mode = 'patrol'; } break;
    case 'seal': if (sel?.boss) { const km = sel.boss.def.seal?.km || 3; if (G.km >= km) { G.km -= km; sel.boss.seal.s = 0; addFx({ kind: 'sealbreak', x: sel.boss.x, y: sel.boss.y, r: sel.boss.def.r, dur: 0.6 }); } else say(`Potřebuješ ${km} 💎`, true); } break;
    case 'clear': if (sel?.obst && !sel.obst.removed) { if (spend(sel.obst.remove_cost_gold)) { sel.obst.removed = true; if (u === ME.uid) view.sel = null; } else say('Málo zlaťáků', true); } break;
  }
}

/* ── Svitky: odpověď se vyhodnotí u hráče, odměna se provede ve snímku ── */
function coopCardEffect(ok) {
  const F = ECON.flashcards, h = G.hero;
  if (!ok) { G.cardsBad++; G.streak = 0; G.cardCdUntil = G.time + (h?.id === 'kronikar_oskar' && h.level >= 13 ? F.wrong_answer_cooldown_s / 2 : F.wrong_answer_cooldown_s); return; }
  G.cardsOk++; G.cardsThisWave++; G.streak++;
  const gold = cardGold();
  let km = F.reward_knowledge_points + (h?.id === 'kronikar_oskar' && h.level >= 20 ? 1 : 0) + (G.nextCardKmBonus || 0);
  G.nextCardKmBonus = 0;
  if (h?.id === 'kronikar_oskar' && h.level >= 15 && G.cardsOk % 5 === 0) km++;
  if (G.streak % F.streak_required_count === 0) { km += F.streak_bonus_knowledge_points; G.streakUntil = G.time + (h?.id === 'kronikar_oskar' ? 15 : F.streak_buff_duration_s); }
  addGold(gold); G.km += km;
  addHeroXp(F.hero_xp_per_correct_answer);
  breakSeals(1);
  if (h?.id === 'lovec_bedrich') { h.critShots = h.level >= 7 ? 5 : 3; const a = h.abilities[0]; if (a) a.until -= 6; }
  if (h?.id === 'kronikar_oskar' && h.level >= 7) { for (const e of enemiesNear(h.x, h.y, h.st.range)) if (!e.def.boss) e.d = Math.max(0, e.d - 40); addFx({ kind: 'ring', x: h.x, y: h.y, r: h.st.range, dur: 0.4, col: '#fde68a' }); }
  G.cardCdUntil = G.time + (G.waveActive ? F.correct_cooldown_during_wave_s : F.correct_cooldown_between_waves_s);
}
// Týmový kvíz každých 5 vln: každý dostane jeden svitek navíc (10 s), za správnou odpověď +150 zl a +2 💎
function coopTeamQuiz() {
  if (!COOP || G.over || cardOpen) return;
  const q = nextCard();
  cardOpen = { ...q, slowUntil: 0, done: false, team: true };
  $('tdCardQ').innerHTML = mcQuestionHtml(q.card);
  $('tdCardOpts').innerHTML = q.opts.map((t, i) => `<button type="button" class="td-ans" data-i="${i}"><em>${i + 1}</em><span>${mcOptionHtml(q.card, t)}</span></button>`).join('');
  $('tdCardReward').textContent = `+${CO.team_quiz_reward_per_player.gold} zl · +${CO.team_quiz_reward_per_player.knowledge_points} 💎`;
  $('tdCardNote').textContent = `🤝 Týmový kvíz — odpovídá každý sám, máš ${CO.team_quiz_time_limit_s} s.`;
  $('tdCard').hidden = false;
  $('tdCardOpts').querySelectorAll('.td-ans').forEach(b => b.onclick = () => answerCard(+b.dataset.i));
  if (typeof enhanceCode === 'function') enhanceCode($('tdCard'));
  const me = cardOpen;
  setTimeout(() => { if (cardOpen === me && !me.done) answerCard(-1); }, CO.team_quiz_time_limit_s * 1000);
  window.sfx?.('flip');
}

/* ── Panel Tým ─────────────────────────────────────────────────── */
function coopTeamSig() { return COOP ? COOP.order.map(u => Math.floor(G.coop.p[u].gold / 10) + ':' + G.coop.p[u].km + ':' + (G.coop.p[u].hero?.level || 0)).join('|') : ''; }
function coopTeamPanel() {
  const rows = COOP.order.map(u => {
    const p = G.coop.p[u], h = p.hero, hd = HDEF[p.heroId], towers = G.towers.filter(t => t.owner === u).length, me = u === ME.uid;
    const gifts = me ? '' : `<div class="td-km-acts">${[100, 500, 1000].map(n => `<button type="button" class="btn btn-secondary btn-sm" data-act="give" data-to="${u}" data-n="${n}" ${G.gold < n ? 'disabled' : ''}>Poslat ${n} zl</button>`).join('')}</div>`;
    return `<div class="td-coop-p${me ? ' me' : ''}"><div class="td-coop-h"><span class="td-shop-ico" style="--hc:${hd?.col || '#888'}">${hd ? heroIco(hd) : '🛡️'}</span>
      <div><b>${esc(coopName(u))}${me ? ' (ty)' : ''}${u === COOP.d.hostUid ? ' 👑' : ''}</b><small>${esc(hd?.name || '')}${h ? ` · úroveň ${h.level}` : ' · zatím nepostavený'}</small></div></div>
      <div class="td-stats"><span>Zlaťáky<b>${fmt(p.gold)}</b></span><span>Krystaly<b>${p.km} 💎</b></span><span>Věže<b>${towers}</b></span></div>${gifts}</div>`;
  }).join('');
  return `<div class="td-coop"><p class="td-coop-note">Životy jsou společné (<b>${Math.ceil(G.lives)}</b>). Za slizáky a vlny dostává každý ${Math.round(coopSplit().pop_and_wave_reward_split_per_player * 100)} % odměny, doly a příjmy věží jdou majiteli. Každých ${CO.team_quiz_every_n_waves} vln týmový kvíz.</p>${rows}</div>`;
}

/* ── Konec ─────────────────────────────────────────────────────── */
function coopFinish(won) {
  if (!COOP || COOP.done) return;
  COOP.done = true;
  COOP.relay?.close();
  if (COOP.host) tdRef().update({ status: 'end' }).catch(() => {});
  setTimeout(() => endGame(won), 900);
}

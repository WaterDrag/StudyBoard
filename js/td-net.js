// ═══ td-net.js — Obrana království s přáteli: versus 2–4 hráčů (každý sám, nebo 2 na 2)
// Čekárna je dokument tdGames/{id} ve Firestore:
//   { hostUid, hostName, status lobby|play|end, map, teams, allowedUids, playerIds,
//     players{uid:{name, hero, color, team}}, startAt, winner }
// Hraje se přes RTDB live/td_{id}/players/{uid} (každý zapisuje jen do svého):
//   s   — stav pro ostatní ~1×/s (životy, příjem, vlna, …)
//   v   — náhled mapy ~1×/2 s (věže a slizáci) pro okénka soupeřů
//   out — události: poslaní slizáci, kletba, dar spoluhráči
// Každý simuluje jen svou mapu. Hodiny jsou společné (startAt podle času serveru),
// takže vlny jdou všem naráz a hra běží dál i v záložce na pozadí.

const TD_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b'];
const VS_FFA = VS.ffa_3_to_4_players, VS_2V2 = VS.teams_2v2, VS_GRACE_MS = VS.disconnect_handling.grace_period_s * 1000;
let NET = null, LOBBY = null, LOBBY_UNSUB = null, SRV_OFF = 0, GID = null;
const tdRef = id => db.collection('tdGames').doc(id || GID);
const serverNow = () => Date.now() + SRV_OFF;
// RTDB vrací pole jako pole, ale prázdná vynechá a řídká umí vrátit jako objekt
const rtArr = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);
const myName = () => ME.displayName || ME.email?.split('@')[0] || 'Hráč';
let _rtdb = null;
function rtdb() { if (!_rtdb) { _rtdb = firebase.database(); _rtdb.ref('.info/serverTimeOffset').on('value', s => { SRV_OFF = s.val() || 0; }); } return _rtdb; }

/* ── Čekárna ───────────────────────────────────────────────────── */
async function vsCreate() {
  if (ME.isAnonymous) { toast('Hra s přáteli jen pro přihlášené.'); return; }
  rtdb();
  const friends = await mcFriends().catch(() => []);
  const ref = await db.collection('tdGames').add({
    hostUid: ME.uid, hostName: myName(), status: 'lobby', map: pref.map, teams: false,
    allowedUids: [ME.uid, ...friends], playerIds: [ME.uid],
    players: { [ME.uid]: { name: myName(), hero: pref.hero, color: TD_COLORS[0], team: 0 } },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  history.replaceState(null, '', '?g=' + ref.id);
  vsOpen(ref.id);
}
async function vsJoin() {
  rtdb();
  const snap = await tdRef().get();
  if (!snap.exists) { toast('Hra už neexistuje.'); return false; }
  const d = snap.data();
  if (d.status !== 'lobby' && !d.playerIds.includes(ME.uid)) { toast('Hra už začala bez tebe.'); return false; }
  if (!d.playerIds.includes(ME.uid) && d.playerIds.length >= 4) { toast('Hra je plná (4 hráči).'); return false; }
  const used = Object.values(d.players).map(p => p.color);
  const color = d.players[ME.uid]?.color || TD_COLORS.find(c => !used.includes(c)) || TD_COLORS[0];
  const inTeam = t => d.playerIds.filter(u => u !== ME.uid && d.players[u]?.team === t).length;
  const team = d.players[ME.uid]?.team ?? (inTeam(1) < inTeam(0) ? 1 : 0);
  if (d.status === 'lobby') await tdRef().update({
    playerIds: firebase.firestore.FieldValue.arrayUnion(ME.uid),
    [`players.${ME.uid}`]: { name: myName(), hero: pref.hero, color, team },
  });
  vsOpen(GID);
  return true;
}
function vsOpen(gid) {
  GID = gid;
  LOBBY_UNSUB?.();
  LOBBY_UNSUB = tdRef(gid).onSnapshot(snap => {
    if (!snap.exists) { if (!NET) { toast('Hostitel hru zrušil.'); location.href = 'obrana.html'; } return; }
    LOBBY = snap.data();
    if (LOBBY.status === 'lobby') { if (LOBBY.playerIds.includes(ME.uid)) renderLobby(); return; }
    if (LOBBY.status === 'play' && !NET && LOBBY.playerIds.includes(ME.uid)) {
      if (!POOL.length) { toast('Hra už běží — rozehranou mapu po obnovení stránky nejde vrátit.'); return; }
      startVersus(LOBBY);
    }
  }, e => toast('Hru se nepodařilo načíst: ' + e.message));
}
const teamsValid = d => d.playerIds.length === 4 && [0, 1].every(t => d.playerIds.filter(u => d.players[u]?.team === t).length === 2);
function renderLobby() {
  const d = LOBBY, host = d.hostUid === ME.uid;
  ['tdSetup', 'tdGame', 'tdEnd'].forEach(id => { $(id).hidden = true; });
  $('tdLobby').hidden = false;
  const map = TD.maps.find(m => m.id === d.map);
  $('tdLobbyInfo').textContent = `${d.hostName} zakládá bitvu na mapě ${map?.name || ''}. Přátelé ji uvidí v záložce Hry, nebo jim pošli odkaz. Hrají 2–4 hráči.`;
  const teams = d.teams && d.playerIds.length === 4;
  $('tdLobbyPlayers').innerHTML = d.playerIds.map(uid => {
    const p = d.players[uid] || {}, h = HDEF[p.hero];
    return `<button type="button" class="td-lp${teams ? ' t' + p.team : ''}" data-uid="${uid}" style="--c:${p.color}" ${host && teams ? '' : 'disabled'}>
      <span class="td-lp-ico" style="--hc:${h?.col || '#888'}">${h ? heroIco(h) : '🛡️'}</span><b>${esc(p.name || 'Hráč')}${uid === d.hostUid ? ' 👑' : ''}</b>
      <small>${esc(h?.name || '')}${teams ? ` · tým ${p.team === 0 ? 'A' : 'B'}` : ''}</small></button>`;
  }).join('');
  $('tdTeamsWrap').hidden = !host || d.playerIds.length !== 4;
  $('tdTeams').checked = !!d.teams;
  $('tdTeams').onchange = () => tdRef().update({ teams: $('tdTeams').checked }).catch(e => toast(e.message));
  $('tdLobbyPlayers').onclick = e => {
    const b = e.target.closest('[data-uid]'); if (!b || !host || !teams) return;
    tdRef().update({ [`players.${b.dataset.uid}.team`]: 1 - (d.players[b.dataset.uid].team || 0) }).catch(er => toast(er.message));
  };
  const n = d.playerIds.length;
  $('tdGoVs').hidden = !host;
  $('tdGoVs').disabled = n < 2 || (teams && !teamsValid(d));
  $('tdLobbyHint').textContent = n < 2 ? 'Čeká se aspoň na jednoho dalšího hráče.'
    : teams && !teamsValid(d) ? 'V každém týmu musí být dva hráči.'
    : host ? `Všichni tu? Spusť hru (${teams ? '2 na 2' : n === 2 ? '1 na 1' : 'každý sám za sebe'}).` : 'Čeká se, až hostitel spustí hru.';
  $('tdGoVs').onclick = () => tdRef().update({ status: 'play', teams, startAt: serverNow() + 6000 }).catch(e => toast('Nepovedlo se: ' + e.message));
  $('tdCopy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Odkaz zkopírován.'); } catch (_) { prompt('Zkopíruj odkaz:', location.href); } };
  $('tdLeave').onclick = async () => {
    try {
      if (host) await tdRef().delete();
      else await tdRef().update({ playerIds: firebase.firestore.FieldValue.arrayRemove(ME.uid), [`players.${ME.uid}`]: firebase.firestore.FieldValue.delete() });
    } catch (_) { /* nic */ }
    location.href = 'dashboard.html?tab=games';
  };
}

/* ── Start bitvy ───────────────────────────────────────────────── */
function startVersus(d) {
  const me = d.players[ME.uid], teams = !!d.teams;
  const others = d.playerIds.filter(u => u !== ME.uid);
  const mates = teams ? others.filter(u => d.players[u].team === me.team) : [];
  NET = {
    d, startAt: d.startAt, teams, team: teams ? 't' + me.team : ME.uid, others, mates, opps: others.filter(u => !mates.includes(u)),
    root: rtdb().ref('live/td_' + GID), st: {}, view: {}, queue: {}, paid: {}, cd: {}, recv: [], lockUntil: 0,
    tgt: 'leader', manual: null, rr: 0, petrify: false, gone: new Set(), lastS: 0, lastV: 0, lastOpps: 0,
    myDelta: 0, lastSet: 0, sentGold: 0, sentN: 0, feed: [], done: false,
  };
  NET.mine = NET.root.child('players/' + ME.uid);
  NET.mine.remove().catch(() => {});
  NET.mine.child('s/gone').onDisconnect().set(true);
  others.forEach(u => {
    const r = NET.root.child('players/' + u);
    r.child('s').on('value', s => { NET.st[u] = s.val(); });
    r.child('v').on('value', s => { NET.view[u] = s.val(); drawOppMini(u); });
    r.child('out').on('child_added', s => onVsEvent(u, s.val()));
  });
  newGame(d.map, me.hero, 'medium', { lives: teams ? VS_2V2.shared_team_lives : VS.starting_lives });
  NET.start = NET.lastSet = G.lives;
  G.onLose = () => vsFinish(false);
  G.onWaveEnd = w => { if (w === 1) feed('💡 Posílej slizáky soupeřům v záložce ⚔️ Útok — každé poslání zvedne tvůj příjem.'); };
  G.onSuddenDeath = () => { feed('☠️ Náhlá smrt! Od teď jsou slizáci v každé vlně o 50 % odolnější.'); window.sfx?.('bad'); };
  view.tab = 'def';
  beginPlay();
  renderOpps(true);
  toast('Stav věže a vylepšuj. Bitva začne odpočtem — vlny pak jdou všem naráz.');
}

/* ── Soupeři: stav, kdo je ve hře ─────────────────────────────── */
const vsName = u => NET.d.players[u]?.name || 'Hráč';
function vsAlive(u) {
  if (NET.gone.has(u)) return false;
  const s = NET.st[u];
  if (!s) return serverNow() < NET.startAt + VS_GRACE_MS;
  return !s.dead && serverNow() - (s.ts || 0) < VS_GRACE_MS;
}
const vsTeamOf = u => NET.teams ? 't' + NET.d.players[u].team : u;
function vsLeader(list) { return list.slice().sort((a, b) => (NET.st[b]?.eco || 0) - (NET.st[a]?.eco || 0))[0] || null; }
// Na koho právě jde útok (podle zvoleného cílení)
function vsTargets(peek) {
  const ffa = !NET.teams && NET.opps.length > 1;
  let list = NET.opps.filter(u => vsAlive(u) && !(ffa && NET.st[u]?.fs === 2));
  if (!list.length) return [];
  if (!ffa) return list;
  if (NET.tgt === 'manual' && list.includes(NET.manual)) return [NET.manual];
  if (NET.tgt === 'rr') { const u = list[NET.rr % list.length]; if (!peek) NET.rr++; return [u]; }
  return [vsLeader(list)];
}
function vsSendCost(sd) {
  const t = vsTargets(true)[0];
  return Math.round(sd.cost_gold * (t && NET.st[t]?.fs === 1 && NET.opps.length > 1 && !NET.teams ? 1 + VS_FFA.stage_1_mild_focus.attacker_send_cost_increase_pct : 1));
}

/* ── Posílání slizáků (fronta + odpočet pro každý druh) ────────── */
function vsQueueSend(id) {
  const sd = VS.sends.find(x => x.id === id);
  if (!sd || G.over) return;
  if (G.wave < sd.unlock_wave) { toast(`Odemkne se ve vlně ${sd.unlock_wave}.`); return; }
  if (!vsTargets(true).length) { toast('Teď není na koho poslat.'); return; }
  if ((NET.queue[id] || 0) >= sd.queue_cap) { toast('Fronta tohohle útoku je plná.'); return; }
  const cost = vsSendCost(sd);
  if (!spend(cost)) { toast('Málo zlaťáků.'); window.sfx?.('bad'); return; }
  NET.queue[id] = (NET.queue[id] || 0) + 1;
  (NET.paid[id] = NET.paid[id] || []).push(cost);
  window.sfx?.('click');
  vsRelease();
  renderSide(true);
}
function vsRelease() {
  for (const sd of VS.sends) {
    if (!(NET.queue[sd.id] > 0) || (NET.cd[sd.id] || 0) > G.time) continue;
    const cost = NET.paid[sd.id].shift(); NET.queue[sd.id]--;
    const leader = vsLeader(NET.opps.filter(vsAlive));
    const to = vsTargets(false);
    if (!to.length) { addGold(cost * VS_FFA.elimination_queued_sends_refund_pct); continue; }
    const mods = [...sd.modifiers];
    if (NET.petrify && !mods.includes('kamenny')) { mods.push('kamenny'); NET.petrify = false; }
    const n = NET.teams && to.length > 1 ? Math.max(1, Math.ceil(sd.count * VS_2V2.sent_enemies_split_per_opponent_pct)) : sd.count;
    vsEmit({ k: 'send', id: sd.id, n, m: mods, to });
    let eco = sd.eco_change;
    if (eco > 0 && NET.tgt === 'manual' && to[0] !== leader && NET.opps.length > 1 && !NET.teams) eco *= 1 - VS_FFA.manual_non_leader_eco_penalty_pct;
    vsEco(eco);
    NET.cd[sd.id] = G.time + sd.cooldown_s;
    NET.sentGold += cost; NET.sentN++;
    floatText(TW - 90, 30, `⚔️ ${sd.name} → ${to.map(vsName).join(', ')}`, '#fca5a5');
  }
}
function vsEmit(ev) { NET.mine.child('out').push({ ...ev, t: firebase.database.ServerValue.TIMESTAMP }).catch(() => {}); }

/* ── Události od ostatních ─────────────────────────────────────── */
function onVsEvent(from, ev) {
  if (!ev || !NET || G.over || !rtArr(ev.to).includes(ME.uid)) return;
  ev.m = rtArr(ev.m);
  if (ev.k === 'send') {
    const sd = VS.sends.find(x => x.id === ev.id); if (!sd) return;
    vsIncoming(ev.id, ev.n, ev.m);
    NET.recv.push({ t: G.time, v: sd.cost_gold * ev.n / sd.count });
    feed(`⚔️ ${vsName(from)} posílá: ${sd.name} ×${ev.n}${ev.m.includes('kamenny') ? ' 🪨' : ''}`, true);
  } else if (ev.k === 'curse') {
    const t = G.towers.filter(x => towerHasAttack(x)).sort((a, b) => (b.spent || 0) - (a.spent || 0) || maxTier(b) - maxTier(a))[0];
    if (!t) return;
    G.vs.curse = { id: t.id, until: G.time + 10 };
    addFx({ kind: 'ring', x: t.x, y: t.y, r: 40, dur: 0.8, col: '#a855f7' });
    feed(`🕯️ ${vsName(from)} proklel tvou věž ${TDEF[t.type].short} — 10 s střílí o polovinu pomaleji. Správný svitek kletbu zlomí.`, true);
    window.sfx?.('bad');
  } else if (ev.k === 'gift') {
    if (ev.g) addGold(ev.g);
    if (ev.km) G.km += ev.km;
    feed(`🎁 ${vsName(from)} ti poslal ${ev.g ? fmt(ev.g) + ' zl' : ''}${ev.km ? ev.km + ' 💎' : ''}.`);
    window.sfx?.('coin');
  }
}

/* ── Každý snímek: fronta, společné životy týmu, ochrana proti focusu, zveřejnění stavu ── */
function vsTick() {
  if (!NET || NET.done) return;
  vsRelease();
  if (NET.teams) {   // společné životy: každý hlásí svůj součet úniků a přírůstků
    NET.myDelta += G.lives - NET.lastSet;
    G.lives = NET.start + NET.myDelta + NET.mates.reduce((s, u) => s + (NET.st[u]?.ld || 0), 0);
    NET.lastSet = G.lives;
    if (G.lives <= 0 && !G.over) { G.lives = 0; G.over = true; G.onLose(); return; }
  }
  // focus: kdo za 15 s dostal víc než 1,5× (3×) svého příjmu, brání se rychleji (je chvíli nedotknutelný)
  const win = VS_FFA.anti_focus_window_s;
  NET.recv = NET.recv.filter(r => r.t > G.time - win);
  const got = NET.recv.reduce((s, r) => s + r.v, 0), inc = G.vs.eco * win / VS.eco_payout_interval_s;
  if (NET.opps.length > 1 && !NET.teams) {
    if (got >= inc * VS_FFA.stage_2_hard_throttle.threshold_eco_multiple && NET.lockUntil <= G.time) { NET.lockUntil = G.time + VS_FFA.stage_2_hard_throttle.lockout_duration_s; feed('🛡️ Jsi pod velkým tlakem — 8 s ti nikdo nemůže nic poslat.'); }
    NET.fs = NET.lockUntil > G.time ? 2 : got >= inc * VS_FFA.stage_1_mild_focus.threshold_eco_multiple ? 1 : 0;
    if (NET.fs) G.vs.focusUntil = G.time + 0.5;
  } else NET.fs = 0;
  // spoluhráč vypadl → zdědíš 75 % jeho příjmu
  NET.others.forEach(u => {
    if (vsAlive(u) || NET.gone.has(u)) return;
    NET.gone.add(u);
    const st = NET.st[u];
    if (NET.mates.includes(u) && !G.over) {
      G.vs.eco = Math.min(VS.eco_hard_cap, G.vs.eco + (st?.eco || 0) * VS.disconnect_handling['2v2_remaining_player_eco_inheritance_pct']);
      feed(`🤝 ${vsName(u)} ${st?.dead ? 'padl' : 'se odpojil'} — přebíráš část jeho příjmu.`);
    } else feed(`${st?.dead ? '💥' : '🔌'} ${vsName(u)} ${st?.dead ? 'padl' : 'se odpojil'}.`);
    renderOpps(true);
  });
  vsPublish();
  if (!G.over && G.time > 5) {
    const teams = new Set([NET.team, ...NET.others.filter(vsAlive).map(vsTeamOf)]);
    if (teams.size === 1) vsFinish(true);
  }
  if (performance.now() - NET.lastOpps > 1000) { NET.lastOpps = performance.now(); renderOpps(); }
}
function vsPublish(force) {
  const now = performance.now();
  if (force || now - NET.lastS > 1000) {
    NET.lastS = now;
    NET.mine.child('s').set({
      n: myName(), h: G.heroId, l: Math.max(0, Math.ceil(G.lives)), eco: Math.round(G.vs.eco), w: G.wave, g: Math.floor(G.gold), km: G.km,
      ld: NET.myDelta, dead: !!G.over, tw: G.towers.length, fs: NET.fs || 0, sent: NET.sentGold, pops: G.stats.pops,
      ts: firebase.database.ServerValue.TIMESTAMP,
    }).catch(() => {});
  }
  if (!force && now - NET.lastV > 2000) {
    NET.lastV = now;
    const T = TD.towers.map(t => t.id);
    NET.mine.child('v').set({
      t: G.towers.map(t => [T.indexOf(t.type), Math.round(t.x), Math.round(t.y), t.up[0] + t.up[1] + t.up[2]]),
      h: G.hero ? [Math.round(G.hero.x), Math.round(G.hero.y)] : null,
      e: G.enemies.slice(0, 150).map(e => [Math.round(e.x), Math.round(e.y), e.def.boss ? 1 : 0]),
    }).catch(() => {});
  }
}

/* ── Okénka soupeřů nad mapou ──────────────────────────────────── */
const _oppBg = {};
function renderOpps(force) {
  const el = $('tdOpps');
  if (!NET) { el.hidden = true; return; }
  el.hidden = false;
  const ffa = !NET.teams && NET.opps.length > 1, tgt = vsTargets(true)[0];
  if (force || el.children.length !== NET.others.length) {
    el.innerHTML = NET.others.map(u => `<button type="button" class="td-opp${NET.mates.includes(u) ? ' mate' : ''}" data-uid="${u}" style="--c:${NET.d.players[u].color}" title="${ffa ? 'Klikni a útoky půjdou na tohoto hráče' : ''}">
      <canvas width="156" height="108"></canvas><span class="td-opp-h"><b>${NET.mates.includes(u) ? '🤝 ' : ''}${esc(vsName(u))}</b><i class="td-opp-tg">🎯</i></span><span class="td-opp-s"></span></button>`).join('');
    el.onclick = e => {
      const b = e.target.closest('[data-uid]'); if (!b || !ffa || NET.mates.includes(b.dataset.uid)) return;
      NET.tgt = 'manual'; NET.manual = b.dataset.uid; renderOpps(); renderSide(true);
    };
    NET.others.forEach(drawOppMini);
  }
  [...el.children].forEach(b => {
    const u = b.dataset.uid, s = NET.st[u], alive = vsAlive(u);
    b.classList.toggle('out', !alive);
    b.classList.toggle('tg', u === tgt && !NET.mates.includes(u) && NET.opps.length > 1);
    b.querySelector('.td-opp-s').innerHTML = !alive ? (s?.dead ? '💥 padl' : '🔌 odpojen')
      : s ? `❤️ ${s.l} · 💰 ${fmt(s.eco)} · 🌊 ${s.w}${s.fs === 2 ? ' · 🛡️' : ''}` : 'připojuje se…';
  });
}
function drawOppMini(u) {
  const b = document.querySelector(`.td-opp[data-uid="${u}"] canvas`); if (!b || !G) return;
  const c = b.getContext('2d'), v = NET.view[u], sx = b.width / TW, sy = b.height / TH;
  _oppBg[G.map.id] = _oppBg[G.map.id] || TR.mapPreview(G.map, b.width, b.height);
  c.drawImage(_oppBg[G.map.id], 0, 0, b.width, b.height);
  if (!v) return;
  rtArr(v.t).forEach(([i, x, y, tier]) => {
    const def = TD.towers[i]; c.fillStyle = def?.col || '#fff';
    c.beginPath(); c.arc(x * sx, y * sy, 2.6 + Math.min(3, tier * 0.35), 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.8; c.stroke();
  });
  if (v.h) { c.fillStyle = '#fde047'; c.beginPath(); c.arc(v.h[0] * sx, v.h[1] * sy, 3.2, 0, 7); c.fill(); }
  rtArr(v.e).forEach(([x, y, boss]) => { c.fillStyle = boss ? '#a855f7' : '#ef4444'; c.beginPath(); c.arc(x * sx, y * sy, boss ? 4 : 1.6, 0, 7); c.fill(); });
}

/* ── Záložka Útok ve straně ────────────────────────────────────── */
function attackPanel() {
  const ffa = !NET.teams && NET.opps.length > 1, left = Math.max(0, G.vs.ecoAt - G.time);
  let h = `<div class="td-sec">Příjem</div><div class="td-eco"><b>💰 ${fmt(G.vs.eco)} zl</b> každých ${VS.eco_payout_interval_s} s <span class="td-ecobar"><i style="width:${(1 - left / VS.eco_payout_interval_s) * 100}%"></i></span></div>
    <p class="td-tip">Každé poslání slizáků zvedne příjem (nad ${fmt(VS.eco_soft_cap_threshold)} zl už jen napůl, strop ${fmt(VS.eco_hard_cap)}). Největší útoky ho naopak sníží. Za každého ubráněného poslaného slizáka dostaneš ${Math.round(VS.defense_bounty_cashback_pct * 100)} % jeho ceny.</p>`;
  if (ffa) {
    const alive = NET.opps.filter(vsAlive);
    h += `<div class="td-sec">Na koho útočit</div><div class="td-targets td-tg">
      <button type="button" class="${NET.tgt === 'leader' ? 'on' : ''}" data-act="tgt" data-t="leader" title="Na hráče s největším příjmem">👑 Vůdce</button>
      <button type="button" class="${NET.tgt === 'rr' ? 'on' : ''}" data-act="tgt" data-t="rr" title="Postupně na všechny">🔄 Postupně</button>
      ${alive.map(u => `<button type="button" class="${NET.tgt === 'manual' && NET.manual === u ? 'on' : ''}" data-act="tgt" data-t="manual" data-u="${u}">${esc(vsName(u))}${NET.st[u]?.fs === 2 ? ' 🛡️' : ''}</button>`).join('')}</div>
      <p class="td-tip">Útok na někoho jiného než vůdce zvedne příjem o ${Math.round(VS_FFA.manual_non_leader_eco_penalty_pct * 100)} % méně.</p>`;
  }
  h += `<div class="td-sec">Poslat slizáky${NET.petrify ? ' · 🪨 další budou kamenní' : ''}</div><div class="td-sends">`;
  VS.sends.forEach(sd => {
    const lock = G.wave < sd.unlock_wave, q = NET.queue[sd.id] || 0, cd = Math.max(0, (NET.cd[sd.id] || 0) - G.time), cost = vsSendCost(sd);
    const eco = sd.eco_change, mods = sd.modifiers;
    h += `<button type="button" class="td-send${lock ? ' lock' : ''}" data-act="send" data-id="${sd.id}" ${!lock && G.gold < cost ? 'data-poor' : ''} title="${esc(sd.name)}: ${sd.count}× ${esc(EDEF[sd.enemy_id].name)}${sd.escort ? ` + ${sd.escort.count}× ${esc(EDEF[sd.escort.enemy_id].name)}` : ''}">
      <img src="${miniSlime(sd.enemy_id, mods)}" alt=""><span><b>${esc(sd.name)}</b><small>${lock ? `🔒 od vlny ${sd.unlock_wave}` : `×${sd.count}${sd.escort ? ' +' + sd.escort.count : ''} · <span class="${eco >= 0 ? 'td-good' : 'td-bad'}">${eco >= 0 ? '+' : ''}${eco} příjem</span>`}</small></span>
      <em>${fmt(cost)}</em>${q ? `<i class="td-q">${q}</i>` : ''}${cd > 0 ? `<i class="td-cd" style="--p:${Math.min(1, cd / sd.cooldown_s)}"></i>` : ''}</button>`;
  });
  h += '</div>';
  const [pet, cur] = VS.sabotages;
  h += `<div class="td-sec">Sabotáže 💎</div><div class="td-km-acts">
    <button type="button" class="btn btn-secondary btn-sm" data-act="petrify" ${G.km < pet.knowledge_points_cost || NET.petrify ? 'disabled' : ''} title="${esc(pet.effect)}">🪨 ${esc(pet.name)} (${pet.knowledge_points_cost} 💎)</button>
    <button type="button" class="btn btn-secondary btn-sm" data-act="curse" ${G.km < cur.knowledge_points_cost ? 'disabled' : ''} title="${esc(cur.effect)}">🕯️ ${esc(cur.name)} (${cur.knowledge_points_cost} 💎)</button></div>`;
  if (NET.mates.length) {
    const mate = NET.mates.find(vsAlive);
    h += `<div class="td-sec">Spoluhráč${mate ? ': ' + esc(vsName(mate)) : ''}</div>${mate ? `<div class="td-km-acts">
      <button type="button" class="btn btn-secondary btn-sm" data-act="gift" data-g="100" ${G.gold < 100 ? 'disabled' : ''}>🎁 100 zl</button>
      <button type="button" class="btn btn-secondary btn-sm" data-act="gift" data-g="500" ${G.gold < 500 ? 'disabled' : ''}>🎁 500 zl</button>
      <button type="button" class="btn btn-secondary btn-sm" data-act="gift" data-km="1" ${G.km < 1 ? 'disabled' : ''}>🎁 1 💎</button></div>
      <p class="td-tip">Ze zlaťáků se strhne daň ${Math.round(VS_2V2.gold_and_km_transfer_tax_pct * 100)} %. Životy máte společné.</p>` : '<p class="td-tip">Spoluhráč už nehraje.</p>'}`;
  }
  return h;
}
function attackSig() {
  return [G.vs.eco, NET.tgt, NET.manual, NET.petrify, G.wave, NET.mates.map(vsAlive).join(), NET.opps.map(u => vsAlive(u) + ':' + (NET.st[u]?.fs || 0)).join(),
    ...VS.sends.map(sd => (NET.queue[sd.id] || 0) + ':' + Math.ceil(Math.max(0, (NET.cd[sd.id] || 0) - G.time) * 2)), Math.floor((G.vs.ecoAt - G.time) * 2)].join('|');
}
function vsAct(a, d) {
  const [pet, cur] = VS.sabotages;
  switch (a) {
    case 'send': vsQueueSend(d.id); return true;
    case 'tgt': NET.tgt = d.t; if (d.u) NET.manual = d.u; renderOpps(); return true;
    case 'petrify': if (G.km >= pet.knowledge_points_cost && !NET.petrify) { G.km -= pet.knowledge_points_cost; NET.petrify = true; window.sfx?.('hint'); } return true;
    case 'curse': {
      const to = vsTargets(false);
      if (!to.length) { toast('Teď není koho proklít.'); return true; }
      if (G.km < cur.knowledge_points_cost) return true;
      G.km -= cur.knowledge_points_cost;
      vsEmit({ k: 'curse', to: [to[0]] });
      feed(`🕯️ Proklel jsi věž hráče ${vsName(to[0])}.`); window.sfx?.('hint');
      return true;
    }
    case 'gift': {
      const mate = NET.mates.find(vsAlive); if (!mate) return true;
      if (d.km) { if (G.km < 1) return true; G.km--; vsEmit({ k: 'gift', km: 1, to: [mate] }); }
      else { const g = +d.g; if (!spend(g)) return true; vsEmit({ k: 'gift', g: Math.round(g * (1 - VS_2V2.gold_and_km_transfer_tax_pct)), to: [mate] }); }
      window.sfx?.('coin'); return true;
    }
  }
  return false;
}

/* ── Zprávy přes mapu ──────────────────────────────────────────── */
function feed(txt, warn) {
  const el = $('tdFeed'); if (!el) return;
  const row = document.createElement('div');
  row.className = 'td-feed-row' + (warn ? ' warn' : '');
  row.textContent = txt;
  el.appendChild(row);
  while (el.children.length > 4) el.firstChild.remove();
  setTimeout(() => row.classList.add('fade'), 6000);
  setTimeout(() => row.remove(), 7000);
}

/* ── Konec bitvy ───────────────────────────────────────────────── */
function vsFinish(won) {
  if (NET.done) return;
  const aliveTeams = new Set([NET.team, ...NET.others.filter(vsAlive).map(vsTeamOf)]);
  NET.done = true; NET.place = won ? 1 : aliveTeams.size;
  G.over = true;
  vsPublish(true);
  if (won) tdRef().update({ status: 'end', winner: ME.uid, [`players.${ME.uid}.place`]: 1 }).catch(() => {});
  else tdRef().update({ [`players.${ME.uid}.place`]: NET.place }).catch(() => {});
  setTimeout(() => endGame(won), won ? 600 : 900);
}
function vsStop() {
  if (!NET) return;
  NET.others.forEach(u => NET.root.child('players/' + u).off());
  NET.others.forEach(u => ['s', 'v', 'out'].forEach(k => NET.root.child(`players/${u}/${k}`).off()));
}
function vsEndRows() {
  const all = [ME.uid, ...NET.others];
  const rows = all.map(u => {
    const s = u === ME.uid ? { l: Math.ceil(G.lives), w: G.wave, sent: NET.sentGold, dead: !NET.place || NET.place > 1 } : NET.st[u] || {};
    return { u, name: u === ME.uid ? myName() : vsName(u), alive: u === ME.uid ? NET.place === 1 : vsAlive(u), w: s.w || 0, sent: s.sent || 0, color: NET.d.players[u].color, team: NET.d.players[u].team };
  }).sort((a, b) => (b.alive - a.alive) || b.w - a.w);
  return rows.map((r, i) => `<div class="lb-row${r.u === ME.uid ? ' me' : ''}"><span class="lb-medal">${r.alive ? '👑' : ['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span><span class="lb-av" style="background:${r.color}">${esc((r.name || '?')[0].toUpperCase())}</span>
    <span class="lb-name"><b>${esc(r.name)}</b><small>${NET.teams ? `tým ${r.team === 0 ? 'A' : 'B'} · ` : ''}vlna ${r.w} · poslal za ${fmt(r.sent)} zl</small></span><span class="lb-points">${r.alive ? (rows.filter(x => x.alive).length === 1 ? 'vítěz' : 've hře') : 'padl'}</span></div>`).join('');
}

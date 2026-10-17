'use strict';
// ═══ dobyvatel.js — Dobyvatel: mapa, tipovačky, bitvy z kartiček ═══
// Jeden dokument conquest/{id} drží lobby i celý stav hry. Hru ŘÍDÍ hostitel:
// jen jeho prohlížeč vybírá otázky, hodnotí odpovědi, hraje za boty a posouvá
// fáze. Ostatní hráči zapisují jen svoje odpovědi (answers.{uid}) a volby
// území (req.{uid}); pravidla Firestore jim nic jiného nedovolí.
// Správná odpověď aktuální otázky je u hostitele (a v conquest/{id}/secret,
// kam vidí jen on), do sdíleného dokumentu se dostane až při vyhodnocení.

const MAP_LIST = [
  { id: 'cesko',   name: 'Česko',   emoji: '🦁', desc: '14 krajů' },
  { id: 'nemecko', name: 'Německo', emoji: '🦅', desc: '16 spolkových zemí' },
  { id: 'evropa',  name: 'Evropa',  emoji: '🏰', desc: '42 zemí' },
  { id: 'usa',     name: 'USA',     emoji: '🗽', desc: '50 států' },
  { id: 'svet',    name: 'Svět',    emoji: '🌍', desc: '173 zemí' },
];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const BOT_NAMES = ['Bot Karel', 'Bot Eva', 'Bot Ondra', 'Bot Jana', 'Bot Petr'];
const MAX_PLAYERS = 6;
const VAL_LAND = 200, VAL_CASTLE = 1000, VAL_DEFEND = 100;
const REVEAL_MS = 4500;
const POOL_MAX_CARDS = 400;

let ME = null, MY_NAME = '';
let GAME_ID = null, GAME = null, UNSUB = null;
const MAPS = {};          // id → map json
let MAP = null, MAP_KEY = '', REGION = null;   // REGION: { ids:Set, adj:Map }
let NEW_MAP = 'cesko', NEW_VIS = 'friends';

const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ref = () => db.collection('conquest').doc(GAME_ID);
const isHost = () => GAME && ME && GAME.hostUid === ME.uid;
function toast(msg) {
  const w = $('toastWrap'); if (!w) return;
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; w.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}
function show(screen) {
  ['screenHome', 'screenLobby', 'screenGame'].forEach(s => { $(s).hidden = s !== screen; });
  document.body.classList.toggle('dob-in-game', screen === 'screenGame');
}

/* ═══ Mapy ═══ */
async function loadMap(id) {
  if (MAPS[id]) return MAPS[id];
  const res = await fetch(`data/dobyvatel/${id}.json?v=${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}`);
  if (!res.ok) throw new Error('Mapu se nepodařilo načíst');
  MAPS[id] = await res.json();
  return MAPS[id];
}
// Území ve výřezu + sousedství jen mezi nimi. Když výřez rozpadne graf
// (ostrovy, výběžky), spojí se nejbližší dvojice — deterministicky, takže
// u všech hráčů vyjde stejně.
function regionGraph(map, region) {
  const ts = map.t.filter(t => region === 'all' || t.g === region);
  const ids = new Set(ts.map(t => t.id));
  const by = new Map(map.t.map(t => [t.id, t]));
  const adj = new Map(ts.map(t => [t.id, new Set(t.n.filter(n => ids.has(n)))]));
  const dist = (a, b) => Math.hypot(by.get(a).c[0] - by.get(b).c[0], by.get(a).c[1] - by.get(b).c[1]);
  const sorted = [...ids].sort();
  for (;;) {
    const comp = new Map(); let k = 0;
    for (const s of sorted) if (!comp.has(s)) { const q = [s]; comp.set(s, k); while (q.length) { const x = q.pop(); adj.get(x).forEach(n => { if (!comp.has(n)) { comp.set(n, k); q.push(n); } }); } k++; }
    if (k <= 1) break;
    let best = null;
    for (const a of sorted) if (comp.get(a) === 0) for (const b of sorted) if (comp.get(b) !== 0) { const d = dist(a, b); if (!best || d < best.d) best = { a, b, d }; }
    adj.get(best.a).add(best.b); adj.get(best.b).add(best.a);
  }
  return { ids, adj };
}
// Hrad smí stát jen na OKRAJI mapy (pobřeží / hranice mapy — příznak e z dat —
// nebo na kraji zvoleného výřezu) a nikdy hned vedle jiného hradu: mezi hrady
// musí být aspoň jedno území.
function isEdge(id) {
  const t = MAP && MAP.t.find(x => x.id === id);
  return !!t && (t.e === 1 || t.n.some(n => !REGION.ids.has(n)));
}
function castleOptions(st) {
  const castles = Object.values(st.castles || {});
  const blocked = new Set(castles.flatMap(c => [c, ...REGION.adj.get(c)]));
  const free = [...REGION.ids].filter(t => !st.own[t]);
  const strict = free.filter(t => isEdge(t) && !blocked.has(t));
  if (strict.length) return strict;
  const apart = free.filter(t => !blocked.has(t));   // okraj už nezbyl → aspoň ne vedle hradu
  return apart.length ? apart : free;
}
// Kolik hradů se do výřezu vejde podle pravidel (hladově, nejdřív okrajová
// území s nejmenším počtem sousedů) → kolik hráčů tu může hrát.
function maxCastles() {
  if (!REGION) return 0;
  const edge = [...REGION.ids].filter(isEdge).sort((a, b) => REGION.adj.get(a).size - REGION.adj.get(b).size || a.localeCompare(b));
  const picked = new Set(), blocked = new Set();
  edge.forEach(t => { if (!blocked.has(t)) { picked.add(t); blocked.add(t); REGION.adj.get(t).forEach(n => blocked.add(n)); } });
  if (picked.size >= MAX_PLAYERS) return picked.size;
  // hladový odhad bývá o kus pod skutečností → zkusit najít víc (omezené hledání)
  let best = picked.size, steps = 0;
  const dfs = (i, chosen, block) => {
    if (++steps > 40000 || best >= MAX_PLAYERS) return;
    if (chosen > best) best = chosen;
    if (chosen + (edge.length - i) <= best) return;
    for (let j = i; j < edge.length; j++) {
      const t = edge[j];
      if (block.has(t)) continue;
      const nb = new Set(block); nb.add(t); REGION.adj.get(t).forEach(n => nb.add(n));
      dfs(j + 1, chosen + 1, nb);
    }
  };
  dfs(0, 0, new Set());
  return best;
}

async function ensureRegion() {
  const s = GAME.settings || {};
  const key = s.map + '|' + (s.region || 'all');
  if (MAP_KEY === key && MAP) return;
  MAP = await loadMap(s.map);
  REGION = regionGraph(MAP, s.region || 'all');
  MAP_KEY = key;
  buildSvg();
}

/* ═══ Start ═══ */
auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  MY_NAME = user.isAnonymous ? 'Host' : (user.displayName || (user.email || '').split('@')[0] || 'Hráč');
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (room) $('backBtn').href = `flashcards.html?room=${encodeURIComponent(room)}`;
  wireHome(); wireLobby(); wireGame();
  GAME_ID = params.get('g');
  if (GAME_ID) openGame(GAME_ID);
  else showHome();
});

/* ═══ Úvod ═══ */
function mapButtons(el, current, onPick, disabled) {
  el.innerHTML = MAP_LIST.map(m => `<button type="button" class="dob-map-btn${m.id === current ? ' on' : ''}" data-m="${m.id}"${disabled ? ' disabled' : ''}>
    <span class="dob-map-emoji">${m.emoji}</span><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></button>`).join('');
  el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.m)));
}
function wireHome() {
  $('newVis').querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
    NEW_VIS = b.dataset.v;
    $('newVis').querySelectorAll('[data-v]').forEach(x => x.classList.toggle('active', x === b));
  }));
  $('createBtn').addEventListener('click', createGame);
  $('joinBtn').addEventListener('click', () => {
    const v = $('joinCode').value.trim();
    const m = v.match(/[?&]g=([A-Za-z0-9]+)/);
    const id = m ? m[1] : v.replace(/[^A-Za-z0-9]/g, '');
    if (!id) { toast('Vlož odkaz nebo kód hry.'); return; }
    location.href = `dobyvatel.html?g=${id}`;
  });
}
function showHome() {
  show('screenHome');
  $('navTitle').textContent = '🗺️ Dobyvatel';
  const pick = id => { NEW_MAP = id; mapButtons($('newMap'), NEW_MAP, pick, false); };
  mapButtons($('newMap'), NEW_MAP, pick, false);
  if (ME.isAnonymous) { $('createBtn').disabled = true; $('createBtn').textContent = 'Hosté nemůžou zakládat hry'; }
  db.collection('conquest').where('allowedUids', 'array-contains', ME.uid).onSnapshot(snap => {
    const games = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(g => (g.status === 'lobby' && g.hostUid !== ME.uid) || (g.status !== 'end' && (g.playerIds || []).includes(ME.uid)))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 12);
    $('openGames').innerHTML = games.length ? games.map(g => {
      const n = Object.keys(g.players || {}).length;
      const mine = (g.playerIds || []).includes(ME.uid);
      const m = MAP_LIST.find(x => x.id === g.settings?.map) || MAP_LIST[0];
      return `<a class="dob-open-row" href="dobyvatel.html?g=${g.id}"><span>${m.emoji}</span><span class="dob-open-name"><b>${esc(g.hostName || 'Hra')}</b><small>${esc(m.name)} · ${n}/${MAX_PLAYERS} · ${g.status === 'play' ? 'hraje se' : 'čeká na hráče'}</small></span><span class="btn btn-secondary btn-sm">${mine ? 'Vrátit se' : 'Připojit'}</span></a>`;
    }).join('') : '<div class="dob-muted">Žádný přítel teď nemá otevřenou hru. Založ si vlastní a pošli pozvánku.</div>';
  }, () => { $('openGames').innerHTML = '<div class="dob-muted">Hry se nepodařilo načíst.</div>'; });
}

async function loadFriends() {
  if (ME.isAnonymous) return [];
  const [a, b] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', ME.uid).get(),
    db.collection('friendRequests').where('toUid', '==', ME.uid).get(),
  ]);
  const out = new Set();
  a.docs.forEach(d => { const r = d.data(); if (r.status === 'accepted') out.add(r.toUid); });
  b.docs.forEach(d => { const r = d.data(); if (r.status === 'accepted') out.add(r.fromUid); });
  return [...out];
}

async function createGame() {
  const btn = $('createBtn'); btn.disabled = true;
  try {
    const friends = NEW_VIS === 'friends' ? await loadFriends() : [];
    const d = db.collection('conquest').doc();
    await d.set({
      hostUid: ME.uid, hostName: MY_NAME, status: 'lobby', visibility: NEW_VIS,
      allowedUids: [ME.uid, ...friends], playerIds: [ME.uid],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      settings: { map: NEW_MAP, region: 'all', rounds: 4, timer: 20, ai: false, botLevel: 0.65 },
      players: { [ME.uid]: { name: MY_NAME, color: COLORS[0] } },
      deckPerm: {}, decks: [], answers: {}, req: {},
    });
    location.href = `dobyvatel.html?g=${d.id}`;
  } catch (e) { toast('Hru se nepodařilo založit: ' + e.message); btn.disabled = false; }
}

/* ═══ Otevření hry ═══ */
function openGame(id) {
  GAME_ID = id;
  UNSUB = ref().onSnapshot(async snap => {
    if (!snap.exists) { toast('Hra už neexistuje.'); setTimeout(() => (location.href = 'dobyvatel.html'), 1200); return; }
    GAME = { id: snap.id, ...snap.data() };
    const iAmIn = (GAME.playerIds || []).includes(ME.uid);
    if (GAME.status === 'lobby' && !iAmIn) { await tryJoin(); return; }
    try { await ensureRegion(); } catch (e) { toast(e.message); }
    if (GAME.status === 'lobby') renderLobby(); else renderGame();
    if (isHost()) hostOnSnapshot();
  }, e => { toast('Hru se nepodařilo otevřít: ' + e.message); });
}

async function tryJoin() {
  const n = Object.keys(GAME.players || {}).length;
  if (n >= MAX_PLAYERS) { toast('Hra je plná.'); setTimeout(() => (location.href = 'dobyvatel.html'), 1500); return; }
  if (GAME.visibility === 'friends' && !(GAME.allowedUids || []).includes(ME.uid)) {
    toast('Do téhle hry můžou jen přátelé hostitele.'); setTimeout(() => (location.href = 'dobyvatel.html'), 1600); return;
  }
  const used = new Set(Object.values(GAME.players || {}).map(p => p.color));
  const color = COLORS.find(c => !used.has(c)) || COLORS[n % COLORS.length];
  try {
    await ref().update({
      playerIds: firebase.firestore.FieldValue.arrayUnion(ME.uid),
      [`players.${ME.uid}`]: { name: MY_NAME, color },
    });
  } catch (e) { toast('Připojení se nepovedlo: ' + e.message); }
}

/* ═══ Lobby ═══ */
let MY_DECKS = null;
function wireLobby() {
  $('copyInvite').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('inviteLink').value); toast('Odkaz zkopírován ✓'); }
    catch (_) { $('inviteLink').select(); document.execCommand('copy'); toast('Odkaz zkopírován ✓'); }
  });
  $('addBotBtn').addEventListener('click', () => {
    if (!isHost()) return;
    const n = Object.keys(GAME.players).length;
    if (n >= MAX_PLAYERS) { toast(`Víc než ${MAX_PLAYERS} hráčů to nejde.`); return; }
    const used = new Set(Object.values(GAME.players).map(p => p.color));
    const usedNames = new Set(Object.values(GAME.players).map(p => p.name));
    const id = 'bot' + Date.now().toString(36);
    ref().update({ [`players.${id}`]: { name: BOT_NAMES.find(x => !usedNames.has(x)) || 'Bot', color: COLORS.find(c => !used.has(c)), bot: true, level: +$('botLevel').value } });
  });
  $('lobbyRegion').addEventListener('change', () => isHost() && ref().update({ 'settings.region': $('lobbyRegion').value }));
  $('lobbyRounds').addEventListener('change', () => isHost() && ref().update({ 'settings.rounds': +$('lobbyRounds').value }));
  $('lobbyTimer').addEventListener('change', () => isHost() && ref().update({ 'settings.timer': +$('lobbyTimer').value }));
  $('lobbyAi').addEventListener('change', () => isHost() && ref().update({ 'settings.ai': $('lobbyAi').checked }));
  $('leaveBtn').addEventListener('click', leaveGame);
  $('startBtn').addEventListener('click', hostStart);
}
async function leaveGame() {
  if (!GAME) { location.href = 'dobyvatel.html'; return; }
  try {
    if (isHost()) await ref().delete();
    else await ref().update({ playerIds: firebase.firestore.FieldValue.arrayRemove(ME.uid), [`players.${ME.uid}`]: firebase.firestore.FieldValue.delete() });
  } catch (_) {}
  location.href = 'dobyvatel.html';
}
const canEditDecks = () => isHost() || !!(GAME.deckPerm || {})[ME.uid];

function renderLobby() {
  show('screenLobby');
  const host = isHost();
  $('navTitle').textContent = '🗺️ Dobyvatel — lobby';
  const players = Object.entries(GAME.players || {});
  $('lobbyCount').textContent = `${players.length}/${MAX_PLAYERS}`;
  $('lobbyPlayers').innerHTML = players.map(([id, p]) => `
    <div class="dob-player">
      <span class="dob-dot" style="background:${p.color}"></span>
      <span class="dob-pname">${esc(p.name)}${p.bot ? ` <small>· ${p.level >= 0.8 ? 'těžký' : p.level >= 0.6 ? 'střední' : 'lehký'}</small>` : ''}${id === GAME.hostUid ? ' <small>· hostitel</small>' : ''}${id === ME.uid ? ' <small>(ty)</small>' : ''}</span>
      ${host && !p.bot && id !== GAME.hostUid ? `<label class="dob-perm" title="Smí přidávat a odebírat kartičky"><input type="checkbox" data-perm="${id}" ${(GAME.deckPerm || {})[id] ? 'checked' : ''}> 🃏</label>` : ''}
      ${host && id !== GAME.hostUid ? `<button type="button" class="icon-btn dob-kick" data-kick="${id}" title="Odebrat">✕</button>` : ''}
    </div>`).join('');
  $('lobbyPlayers').querySelectorAll('[data-perm]').forEach(c => c.addEventListener('change', () => ref().update({ [`deckPerm.${c.dataset.perm}`]: c.checked })));
  $('lobbyPlayers').querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.kick;
    const upd = { [`players.${id}`]: firebase.firestore.FieldValue.delete() };
    if (!GAME.players[id]?.bot) upd.playerIds = firebase.firestore.FieldValue.arrayRemove(id);
    ref().update(upd);
  }));
  $('botRow').hidden = !host;
  $('inviteLink').value = `${location.origin}${location.pathname}?g=${GAME_ID}`;

  // settings
  const s = GAME.settings || {};
  mapButtons($('lobbyMap'), s.map, id => ref().update({ 'settings.map': id, 'settings.region': 'all' }), !host);
  const groups = MAP?.groups || {};
  $('lobbyRegion').innerHTML = `<option value="all">Celá mapa</option>` + Object.entries(groups).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('lobbyRegion').value = s.region || 'all';
  $('lobbyRegion').disabled = !host || !Object.keys(groups).length;
  const n = REGION ? REGION.ids.size : 0;
  const sc = expandScale(n, Math.max(2, players.length));
  const maxP = Math.min(MAX_PLAYERS, maxCastles());
  $('regionInfo').textContent = n ? `${n} území · za tipovačku ${sc.k1} + ${sc.k2} území · hráči: nejvýš ${maxP}` : '';
  $('lobbyRounds').value = String(s.rounds || 4); $('lobbyRounds').disabled = !host;
  $('lobbyTimer').value = String(s.timer || 20); $('lobbyTimer').disabled = !host;
  $('lobbyAi').checked = !!s.ai; $('lobbyAi').disabled = !host;
  const hasKey = !!(localStorage.getItem('sb_gemini_key') || localStorage.getItem('sb_groq_key'));
  $('aiNote').textContent = host && !hasKey ? '(potřebuješ AI klíč v nastavení)' : '';

  // decks
  const decks = GAME.decks || [];
  const total = decks.reduce((a, d) => a + (d.count || 0), 0);
  $('poolCount').textContent = `${total} kartiček`;
  const edit = canEditDecks();
  $('poolList').innerHTML = decks.length ? decks.map(d => `<div class="dob-pool-row"><span>🃏 <b>${esc(d.name)}</b> <small>${d.count} · přidal ${esc(d.byName || '')}</small></span>${edit ? `<button type="button" class="icon-btn" data-rm="${d.id}" title="Odebrat">✕</button>` : ''}</div>`).join('')
    : '<div class="dob-muted">Zatím žádné kartičky — bez nich nejsou bitvy.</div>';
  $('poolList').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => removeDeck(b.dataset.rm)));
  $('myDecksWrap').hidden = !edit;
  if (edit) renderMyDecks();

  const parts = players.length;
  const okDecks = total >= 6;
  $('startBtn').hidden = !host;
  $('startBtn').disabled = !(parts >= 2 && okDecks && n >= parts * 2 && parts <= maxP);
  $('startHint').textContent = !host ? 'Čeká se, až hostitel spustí hru…'
    : parts < 2 ? 'Potřebuješ aspoň 2 hráče (klidně bota).'
    : !okDecks ? 'Přidej kartičky (aspoň 6).'
    : parts > maxP ? `Na tuhle mapu se vejdou jen ${maxP} ${maxP === 1 ? 'hrad' : maxP < 5 ? 'hrady' : 'hradů'} (okraj mapy, ne vedle sebe) — uber hráče nebo zvol větší mapu.`
    : n < parts * 2 ? 'Výřez je na tolik hráčů moc malý.' : '';
}

async function renderMyDecks() {
  const el = $('myDecks');
  if (!MY_DECKS) {
    try {
      const [rooms, personal] = await Promise.all([
        db.collection('rooms').where('memberIds', 'array-contains', ME.uid).get(),
        db.collection('decks').where('ownerUid', '==', ME.uid).get(),
      ]);
      const all = new Map();
      personal.docs.forEach(d => all.set(d.id, { id: d.id, ...d.data() }));
      const roomDecks = await Promise.all(rooms.docs.map(r => db.collection('decks').where('roomId', '==', r.id).get().then(s => s.docs.map(d => ({ id: d.id, ...d.data(), roomName: r.data().name })))));
      roomDecks.flat().forEach(d => all.set(d.id, d));
      MY_DECKS = [...all.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'cs'));
    } catch (e) { el.innerHTML = `<div class="dob-muted">Balíčky se nepodařilo načíst.</div>`; return; }
  }
  const inPool = new Set((GAME.decks || []).map(d => d.id));
  el.innerHTML = MY_DECKS.length ? MY_DECKS.map(d => `<button type="button" class="dob-mydeck${inPool.has(d.id) ? ' on' : ''}" data-add="${d.id}" ${inPool.has(d.id) ? 'disabled' : ''}>
      <span>${esc(d.name)}</span><small>${d.cardCount || 0}${d.roomName ? ' · ' + esc(d.roomName) : ''}</small></button>`).join('')
    : '<div class="dob-muted">Nemáš žádné balíčky.</div>';
  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addDeck(MY_DECKS.find(d => d.id === b.dataset.add), b)));
}

// Kartičky se do hry ZKOPÍRUJÍ (conquest/{id}/pool) — hostitel by k cizímu
// soukromému balíčku jinak neměl přístup.
async function addDeck(deck, btn) {
  if (!deck) return;
  btn.disabled = true;
  try {
    const snap = await db.collection('decks').doc(deck.id).collection('cards').get();
    const cards = snap.docs.map(d => d.data()).filter(c => c.front && c.back).slice(0, POOL_MAX_CARDS).map(c => ({
      f: String(c.front).slice(0, 1500), b: String(c.back).slice(0, 600),
      w: (c.distractors || []).filter(Boolean).slice(0, 5).map(x => String(x).slice(0, 300)),
      ...(c.frontLang ? { fl: c.frontLang } : {}), ...(c.codeLang ? { cl: c.codeLang } : {}),
    }));
    if (cards.length < 1) { toast('Balíček je prázdný.'); btn.disabled = false; return; }
    await ref().collection('pool').doc(deck.id).set({ name: deck.name, by: ME.uid, cards });
    await ref().update({ decks: firebase.firestore.FieldValue.arrayUnion({ id: deck.id, name: deck.name, count: cards.length, by: ME.uid, byName: MY_NAME }) });
    toast(`Přidáno: ${deck.name} (${cards.length})`);
  } catch (e) { toast('Nepovedlo se: ' + e.message); btn.disabled = false; }
}
async function removeDeck(id) {
  const d = (GAME.decks || []).find(x => x.id === id);
  if (!d) return;
  try {
    await ref().update({ decks: firebase.firestore.FieldValue.arrayRemove(d) });
    await ref().collection('pool').doc(id).delete();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
}

/* ═══ Pravidla rozdělování ═══ */
// Za každou tipovačku se rozdá ~3 × S území (vítěz 2S, druhý S), aby expanze
// měla na každé mapě zhruba 6–8 otázek.
function expandScale(free, players) {
  const S = Math.max(1, Math.ceil(Math.max(0, free - players) / 21));
  return { k1: 2 * S, k2: S };
}

/* ═══ HOSTITEL — řízení hry ═══ */
const H = { busy: false, timer: null, correct: null, qStep: -1, bots: {}, pool: [], usedCards: new Set(), guess: [], aiGuess: [] };

async function hostStart() {
  if (!isHost()) return;
  $('startBtn').disabled = true;
  H.actedStep = null; H.bots = {}; H.usedCards = new Set(); H.correct = null; H.qStep = -1;
  await hostLoadPool();
  const players = Object.keys(GAME.players);
  const order = shuffle(players);
  H.guess = shuffle(DOB_GUESS.map((q, i) => ({ t: q[0], a: q[1], id: 'b' + i })));
  if (GAME.settings.ai) hostAiGuesses();
  const st = {
    phase: 'q', step: 1, order, castleQueue: [], turn: null, deadline: 0,
    own: {}, val: {}, castles: {}, towers: {}, out: {}, round: 0, rounds: GAME.settings.rounds || 4,
    log: ['🎯 První tipovačka rozhodne, kdo si vybírá hrad první.'], q: null, reveal: null, ctx: null,
  };
  await ref().update({ status: 'play', st, answers: {}, req: {} });
}

async function hostLoadPool() {
  const snap = await ref().collection('pool').get();
  H.pool = snap.docs.flatMap(d => d.data().cards || []);
}

async function hostAiGuesses() {
  try {
    const topics = shuffle(H.pool).slice(0, 25).map(c => '- ' + String(c.f).slice(0, 120)).join('\n');
    const prompt = `Vymysli 15 tipovacích otázek pro kvízovou hru v češtině. Odpověď na každou musí být JEDNO celé číslo (rok, počet, výška, vzdálenost…), které je ověřitelný a neměnný fakt — žádné odhady, žádná čísla, která se v čase mění. Téma ber z těchto kartiček studenta (když z nich nejde udělat číselnou otázku, použij příbuzné téma):\n${topics}\n\nVrať POUZE JSON pole: [{"q":"Otázka?","a":1234}]`;
    const arr = await aiGenerate(prompt, { temperature: 0.4, maxOutputTokens: 2000, statusElementId: null, parse: raw => {
      const m = raw.match(/\[[\s\S]*\]/); const a = JSON.parse(m[0]);
      return a.filter(x => x && typeof x.q === 'string' && Number.isFinite(+x.a)).map((x, i) => ({ t: x.q, a: Math.round(+x.a), id: 'ai' + i }));
    } });
    H.aiGuess = arr;
    // AI otázky se zamíchají mezi vestavěné (vždy ob jednu)
    const mixed = []; const a = shuffle(arr), b = H.guess.slice();
    while (a.length || b.length) { if (a.length) mixed.push(a.shift()); if (b.length) mixed.push(b.shift()); }
    H.guess = mixed;
  } catch (_) { /* bez AI — zůstanou vestavěné */ }
}

function hostOnSnapshot() {
  if (GAME.status !== 'play') { clearInterval(H.timer); H.timer = null; return; }
  if (!H.timer) H.timer = setInterval(hostTick, 400);
  if (!H.pool.length) hostLoadPool().catch(() => {});
}

// advance=true: zápis posouvá hru dál → stejný krok (st.step) už se nesmí
// zpracovat podruhé, i kdyby nový stav ze serveru ještě nedorazil.
async function hostWrite(upd, advance = true) {
  if (advance && GAME && GAME.st) {
    if (H.actedStep === GAME.st.step) return;   // tenhle krok už je zpracovaný
    H.actedStep = GAME.st.step;
  }
  H.busy = true;
  try { await ref().update(upd); }
  catch (e) { toast('Chyba hry: ' + e.message); if (advance) H.actedStep = null; }   // zkusí se znovu
  finally { H.busy = false; }
}
function stCopy() { return JSON.parse(JSON.stringify(GAME.st)); }
function nextStep(st) { st.step = (st.step || 0) + 1; return st; }
function addLog(st, line) { st.log = [...(st.log || []), line].slice(-14); }
const pname = id => GAME.players?.[id]?.name || '?';
const alive = st => st.order.filter(p => !st.out[p] && GAME.players[p]);
const freeIds = st => [...REGION.ids].filter(t => !st.own[t]);
const ownedBy = (st, p) => [...REGION.ids].filter(t => st.own[t] === p);

function hostTick() {
  if (!isHost() || H.busy || !GAME || GAME.status !== 'play' || !REGION) return;
  const st = GAME.st; if (!st) return;
  if (H.actedStep === st.step) return;   // na tenhle krok už je zápis na cestě
  const now = Date.now();
  // úplně první otázka (pořadí výběru hradů) se položí hned po startu
  if (st.phase === 'q' && !st.q) return hostAsk(stCopy(), 'guess', st.order.slice(), { type: 'order' });
  if (st.phase === 'castle') return hostCastle(st, now);
  if (st.phase === 'q') return hostQuestion(st, now);
  if (st.phase === 'reveal') { if (now >= st.revealUntil) return hostAfterReveal(st); return; }
  if (st.phase === 'pick') return hostPick(st, now);
  if (st.phase === 'attack') return hostAttack(st, now);
}

function reqFor(st, p) {
  const r = (GAME.req || {})[p];
  return r && r.step === st.step ? r : null;
}
// Bot "přemýšlí" — rozhodne se až po chvilce, ať to nevypadá strojově.
function botReady(st, p, minMs = 900, maxMs = 2200) {
  const key = st.step + ':' + p;
  if (!H.bots[key]) H.bots[key] = Date.now() + minMs + Math.random() * (maxMs - minMs);
  return Date.now() >= H.bots[key];
}

/* — hrady — */
function graphDist(from, targets) {
  // BFS vzdálenost z `from` k nejbližšímu z targets
  if (!targets.length) return 99;
  const tset = new Set(targets), seen = new Set([from]); let q = [from], d = 0;
  while (q.length) { if (q.some(x => tset.has(x))) return d; const nq = []; q.forEach(x => REGION.adj.get(x).forEach(n => { if (!seen.has(n)) { seen.add(n); nq.push(n); } })); q = nq; d++; }
  return 99;
}
// Bot / vypršený čas: vybrat hrad tak, aby po něm zbylo ostatním co nejvíc
// míst na okraji (jinak by poslední hráč nemusel mít kam), a teprve pak co
// nejdál od ostatních hradů.
// Kolik dalších hradů se ještě dá postavit na okraji (max. `need`), když už
// stojí hrady `castles` — omezené hledání, stačí zjistit, jestli se vejdou.
function edgeCapacity(castles, own, need) {
  const blocked = new Set(castles.flatMap(c => [c, ...REGION.adj.get(c)]));
  const cand = [...REGION.ids].filter(t => !own[t] && isEdge(t) && !blocked.has(t))
    .sort((a, b) => REGION.adj.get(a).size - REGION.adj.get(b).size || a.localeCompare(b));
  let best = 0, steps = 0;
  const dfs = (i, chosen, block) => {
    if (++steps > 4000 || best >= need) return;
    if (chosen > best) best = chosen;
    if (chosen + (cand.length - i) <= best) return;
    for (let j = i; j < cand.length; j++) {
      const t = cand[j]; if (block.has(t)) continue;
      const nb = new Set(block); nb.add(t); REGION.adj.get(t).forEach(n => nb.add(n));
      dfs(j + 1, chosen + 1, nb);
    }
  };
  dfs(0, 0, new Set());
  return best;
}
// Co může hráč na tahu vybrat: okrajová místa, po kterých se hrad ještě
// vejde všem, kdo jsou ve frontě za ním. Když to nejde, aspoň okraj / ne vedle.
function castleChoices(st) {
  const base = castleOptions(st);
  const need = Math.max(0, (st.castleQueue ? st.castleQueue.length : 1) - 1);
  if (!need || !base.every(isEdge)) return base;
  const taken = Object.values(st.castles || {});
  const ok = base.filter(t => edgeCapacity([...taken, t], { ...st.own, [t]: '_' }, need) >= need);
  return ok.length ? ok : base;
}
function autoCastle(st) {
  const taken = Object.values(st.castles);
  const free = castleChoices(st);
  const need = Math.max(0, (st.castleQueue ? st.castleQueue.length : MAX_PLAYERS) - 1);
  const left = t => edgeCapacity([...taken, t], { ...st.own, [t]: '_' }, need);
  let best = [], bk = null;
  free.forEach(t => {
    const k = [left(t), graphDist(t, taken)];
    if (!bk || k[0] > bk[0] || (k[0] === bk[0] && k[1] > bk[1])) { bk = k; best = [t]; }
    else if (k[0] === bk[0] && k[1] === bk[1]) best.push(t);
  });
  return best[Math.floor(Math.random() * best.length)];
}
function hostCastle(st, now) {
  const p = st.castleQueue[0];
  if (!p) return hostStartExpand(stCopy());
  let tid = null;
  const r = reqFor(st, p);
  if (r && castleChoices(st).includes(r.tid)) tid = r.tid;
  else if (GAME.players[p]?.bot && botReady(st, p)) tid = autoCastle(st);
  else if (now > st.deadline) tid = autoCastle(st);
  if (!tid) return;
  const s = nextStep(stCopy());
  s.own[tid] = p; s.val[tid] = VAL_CASTLE; s.castles[p] = tid; s.towers[p] = 3;
  addLog(s, `🏰 ${pname(p)} si postavil hrad: ${terrName(tid)}`);
  s.castleQueue.shift();
  if (s.castleQueue.length) { s.turn = s.castleQueue[0]; s.deadline = Date.now() + 25000; hostWrite({ st: s }); }
  else hostStartExpand(s);
}

/* — otázky — */
function nextGuess() {
  if (!H.guess.length) H.guess = shuffle(DOB_GUESS.map((q, i) => ({ t: q[0], a: q[1], id: 'b' + i })));
  return H.guess.shift();
}
function nextCard() {
  if (!H.pool.length) return null;
  let avail = H.pool.filter((c, i) => !H.usedCards.has(i));
  if (!avail.length) { H.usedCards.clear(); avail = H.pool; }
  const card = avail[Math.floor(Math.random() * avail.length)];
  H.usedCards.add(H.pool.indexOf(card));
  return card;
}
function hostAsk(s, kind, parts, ctx) {
  const timer = (GAME.settings.timer || 20) * 1000;
  s.phase = 'q'; s.ctx = ctx; s.reveal = null;
  if (kind === 'guess') {
    const g = nextGuess();
    s.q = { kind: 'guess', text: g.t, parts, deadline: Date.now() + timer };
    H.correct = g.a;
  } else {
    const c = nextCard();
    const wrongPool = shuffle([...(c.w || []), ...shuffle(H.pool.filter(x => x !== c && x.b !== c.b)).slice(0, 6).map(x => x.b)])
      .filter((v, i, a) => v && v !== c.b && a.indexOf(v) === i).slice(0, 3);
    const opts = shuffle([c.b, ...wrongPool]);
    s.q = { kind: 'mc', text: c.f, opts, parts, deadline: Date.now() + timer, ...(c.fl ? { fl: c.fl } : {}), ...(c.cl ? { cl: c.cl } : {}) };
    H.correct = opts.indexOf(c.b);
  }
  nextStep(s);
  H.qStep = s.step;
  ref().collection('secret').doc('q').set({ step: s.step, correct: H.correct }).catch(() => {});
  hostWrite({ st: s, answers: {} });
}
function hostStartExpand(s) {
  if (!freeIds(s).length) return hostStartBattle(s);
  addLog(s, '🎯 Tipovačka — nejbližší tip zabírá území.');
  hostAsk(s, 'guess', alive(s), { type: 'expand' });
}
async function ensureCorrect(st) {
  if (H.qStep === st.step && H.correct !== null) return true;
  try { const d = await ref().collection('secret').doc('q').get(); if (d.exists && d.data().step === st.step) { H.correct = d.data().correct; H.qStep = st.step; return true; } } catch (_) {}
  return false;
}
function botAnswer(st, p) {
  const lvl = GAME.players[p]?.level ?? 0.65;
  const q = st.q;
  if (q.kind === 'mc') {
    if (Math.random() < lvl) return H.correct;
    const wrong = q.opts.map((_, i) => i).filter(i => i !== H.correct);
    return wrong[Math.floor(Math.random() * wrong.length)];
  }
  const a = H.correct;
  const year = Number.isInteger(a) && a > 800 && a < 2100;
  const sigma = year ? (1 - lvl) * 70 + 2 : Math.max(1, Math.abs(a) * ((1 - lvl) * 0.45 + 0.03));
  const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return Math.round(a + g() * sigma);
}
async function hostQuestion(st, now) {
  if (!(await ensureCorrect(st))) { if (now > st.q.deadline + 3000) { const s = stCopy(); hostAsk(s, st.q.kind, st.q.parts, st.ctx); } return; }
  const ans = { ...(GAME.answers || {}) };
  const botWrites = {};
  st.q.parts.forEach(p => {
    if (GAME.players[p]?.bot && !(ans[p] && ans[p].step === st.step)) {
      const t = Math.min(st.q.deadline - 1500, (H.bots[st.step + ':' + p] ||= now + 2500 + Math.random() * Math.min(9000, (st.q.deadline - now) * 0.6)));
      if (now >= t) { const v = botAnswer(st, p); botWrites[`answers.${p}`] = { v, step: st.step, t: now }; ans[p] = { v, step: st.step, t: now }; }
    }
  });
  const done = st.q.parts.every(p => ans[p] && ans[p].step === st.step);
  if (!done && now <= st.q.deadline) { if (Object.keys(botWrites).length) hostWrite(botWrites, false); return; }
  // vyhodnotit
  const s = nextStep(stCopy());
  const res = {};
  st.q.parts.forEach(p => {
    const a = ans[p] && ans[p].step === st.step ? ans[p] : null;
    if (st.q.kind === 'guess') {
      const v = a && Number.isFinite(+a.v) ? +a.v : null;
      res[p] = { v, d: v === null ? null : Math.abs(v - H.correct), t: a ? a.t : null };
    } else {
      const v = a ? a.v : null;
      res[p] = { v, ok: v === H.correct };
    }
  });
  let rank = st.q.parts.slice();
  if (st.q.kind === 'guess') rank.sort((a, b) => (res[a].d ?? Infinity) - (res[b].d ?? Infinity) || (res[a].t ?? Infinity) - (res[b].t ?? Infinity));
  s.phase = 'reveal';
  s.reveal = { correct: H.correct, res, rank };
  s.revealUntil = Date.now() + REVEAL_MS;
  hostWrite({ st: s, ...botWrites });
}

function hostAfterReveal(st) {
  const s = nextStep(stCopy());
  const { res, rank } = st.reveal;
  const ctx = st.ctx || {};
  if (ctx.type === 'order') {
    // pořadí: nejblíž první, při shodě rychlejší; kdo netipoval, jde na konec
    const answered = rank.filter(p => res[p].d !== null);
    const rest = shuffle(rank.filter(p => res[p].d === null));
    s.order = [...answered, ...rest];
    s.castleQueue = s.order.slice();
    s.turn = s.castleQueue[0]; s.deadline = Date.now() + 25000; s.phase = 'castle';
    addLog(s, `🎯 Správně ${st.reveal.correct}. Pořadí výběru hradů: ${s.order.map(pname).join(', ')}.`);
    addLog(s, '🏰 Hrad jen na okraji mapy a ne hned vedle jiného hradu.');
    return hostWrite({ st: s, req: {} });
  }
  if (ctx.type === 'expand') {
    const answered = rank.filter(p => res[p].d !== null);
    if (!answered.length) { addLog(s, '😶 Nikdo netipoval — další otázka.'); return hostAsk(s, 'guess', alive(s), { type: 'expand' }); }
    const free = freeIds(s).length;
    const sc = expandScale(free + Object.keys(s.castles).length, alive(s).length);
    const q = [];
    q.push({ p: answered[0], n: Math.min(sc.k1, free) });
    if (answered[1] && free - q[0].n > 0) q.push({ p: answered[1], n: Math.min(sc.k2, free - q[0].n) });
    addLog(s, `🎯 Správně ${st.reveal.correct}. ${pname(answered[0])} bere ${q[0].n}${q[1] ? `, ${pname(answered[1])} ${q[1].n}` : ''}.`);
    s.pickQueue = q; s.phase = 'pick'; s.turn = q[0].p; s.deadline = Date.now() + (7 + q[0].n * 2.5) * 1000;
    return hostWrite({ st: s, req: {} });
  }
  if (ctx.type === 'battle') {
    const b = s.battle;
    const aOk = res[b.att]?.ok, dOk = res[b.def]?.ok;
    if (aOk && !dOk) return hostBattleWin(s, true);
    if (dOk && !aOk) return hostBattleWin(s, false);
    addLog(s, aOk ? '⚖️ Oba správně — rozhodne tipovačka.' : '⚖️ Oba špatně — rozhodne tipovačka.');
    return hostAsk(s, 'guess', [b.att, b.def], { type: 'tie' });
  }
  if (ctx.type === 'tie') {
    const b = s.battle;
    const da = res[b.att]?.d, dd = res[b.def]?.d;
    const attWins = da !== null && (dd === null || da < dd);
    return hostBattleWin(s, attWins);
  }
}

/* — vybírání území — */
function pickable(st, p) {
  const free = freeIds(st);
  const mine = ownedBy(st, p);
  const adj = free.filter(t => mine.some(m => REGION.adj.get(m).has(t)));
  return adj.length ? adj : free;
}
function autoPick(st, p) {
  const opts = pickable(st, p);
  return opts[Math.floor(Math.random() * opts.length)];
}
function hostPick(st, now) {
  const cur = st.pickQueue[0];
  if (!cur || !freeIds(st).length) { const s = nextStep(stCopy()); s.pickQueue = []; return hostStartExpand(s); }
  const p = cur.p;
  let tids = [];
  const r = reqFor(st, p);
  if (r && pickable(st, p).includes(r.tid)) tids = [r.tid];
  else if (GAME.players[p]?.bot && botReady(st, p, 450, 900)) tids = [autoPick(st, p)];
  else if (now > st.deadline) {
    // čas vypršel → zbytek se doplní automaticky (navazuje na vlastní území)
    const s0 = stCopy(); let n = cur.n;
    while (n-- > 0 && freeIds(s0).length) { const t = autoPick(s0, p); s0.own[t] = p; s0.val[t] = VAL_LAND; tids.push(t); }
  }
  if (!tids.length) return;
  const s = nextStep(stCopy());
  tids.forEach(t => { s.own[t] = p; s.val[t] = VAL_LAND; });
  s.pickQueue[0].n -= tids.length;
  if (s.pickQueue[0].n <= 0 || !freeIds(s).length) {
    s.pickQueue.shift();
    if (s.pickQueue.length && freeIds(s).length) { s.turn = s.pickQueue[0].p; s.deadline = Date.now() + (7 + s.pickQueue[0].n * 2.5) * 1000; }
    else { s.pickQueue = []; return hostStartExpand(s); }
  }
  hostWrite({ st: s });
}

/* — bitvy — */
function hostStartBattle(s) {
  s.round = 1; s.attackOrder = alive(s); s.attackIdx = 0;
  addLog(s, `⚔️ Všechno je rozebráno — začínají bitvy (${s.rounds} kol).`);
  hostNextAttack(s, true);
}
function attackTargets(st, p) {
  const mine = ownedBy(st, p);
  const out = new Set();
  mine.forEach(m => REGION.adj.get(m).forEach(n => { if (st.own[n] && st.own[n] !== p && !st.out[st.own[n]]) out.add(n); }));
  return [...out];
}
function hostNextAttack(s, first) {
  if (!first) s.attackIdx++;
  for (let guard = 0; guard < 20; guard++) {
    if (alive(s).length <= 1) return hostEnd(s);
    if (s.attackIdx >= s.attackOrder.length) {
      s.round++; s.attackIdx = 0; s.attackOrder = alive(s);
      if (s.round > s.rounds) return hostEnd(s);
      addLog(s, `🔔 ${s.round}. kolo bitev`);
    }
    const p = s.attackOrder[s.attackIdx];
    if (!s.out[p] && attackTargets(s, p).length) {
      s.phase = 'attack'; s.turn = p; s.deadline = Date.now() + 25000; s.battle = null; s.q = null; s.reveal = null;
      nextStep(s);
      return hostWrite({ st: s, req: {} });
    }
    s.attackIdx++;
  }
  hostEnd(s);
}
function botTarget(st, p) {
  const ts = attackTargets(st, p);
  const lvl = GAME.players[p]?.level ?? 0.65;
  // Silnější bot jde po hradech s poškozenými věžemi a po cenných územích.
  const score = t => {
    const def = st.own[t];
    const castle = st.castles[def] === t;
    if (castle) return st.towers[def] <= 1 ? 3 * lvl : 0.2;
    return (st.val[t] || VAL_LAND) / 200 + Math.random();
  };
  return ts.sort((a, b) => score(b) - score(a))[Math.random() < lvl ? 0 : Math.floor(Math.random() * ts.length)];
}
function hostAttack(st, now) {
  const p = st.turn;
  let tid = null;
  const r = reqFor(st, p);
  const targets = attackTargets(st, p);
  if (r && targets.includes(r.tid)) tid = r.tid;
  else if (GAME.players[p]?.bot && botReady(st, p, 1200, 2600)) tid = botTarget(st, p);
  else if (now > st.deadline) tid = targets[Math.floor(Math.random() * targets.length)];
  if (!tid) return;
  const s = nextStep(stCopy());
  const def = s.own[tid];
  s.battle = { att: p, def, tid, castle: s.castles[def] === tid, wins: 0 };
  addLog(s, `⚔️ ${pname(p)} útočí na ${terrName(tid)} (${pname(def)})${s.battle.castle ? ' — HRAD!' : ''}`);
  hostAsk(s, 'mc', [p, def], { type: 'battle' });
}
function hostBattleWin(s, attackerWon) {
  const b = s.battle;
  if (attackerWon) {
    if (b.castle) {
      s.towers[b.def] = Math.max(0, (s.towers[b.def] || 3) - 1); b.wins++;
      if (s.towers[b.def] <= 0) {
        addLog(s, `💥 ${pname(b.att)} dobyl hrad! ${pname(b.def)} vypadává a ${pname(b.att)} bere všechna jeho území.`);
        s.out[b.def] = true; delete s.castles[b.def];
        Object.keys(s.own).forEach(t => { if (s.own[t] === b.def) s.own[t] = b.att; });
        return hostNextAttack(s);
      }
      addLog(s, `🏰 Věž padla — ${s.towers[b.def] === 1 ? 'zbývá poslední' : 'zbývají ' + s.towers[b.def]}, útok pokračuje.`);
      return hostAsk(s, 'mc', [b.att, b.def], { type: 'battle' });
    }
    s.own[b.tid] = b.att;
    addLog(s, `✅ ${pname(b.att)} dobyl ${terrName(b.tid)}.`);
  } else {
    if (b.castle) { s.towers[b.def] = 3; addLog(s, `🛡️ ${pname(b.def)} ubránil hrad — věže opraveny.`); }
    else { s.val[b.tid] = (s.val[b.tid] || VAL_LAND) + VAL_DEFEND; addLog(s, `🛡️ ${pname(b.def)} ubránil ${terrName(b.tid)} (+${VAL_DEFEND}).`); }
  }
  hostNextAttack(s);
}
function hostEnd(s) {
  s.phase = 'end'; s.q = null; s.reveal = null; s.battle = null;
  const sc = scores(s);
  const win = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
  addLog(s, `🏆 Konec hry — vítězí ${pname(win)}!`);
  nextStep(s);
  hostWrite({ st: s, status: 'end' });
}
function scores(st) {
  const out = {};
  (st.order || []).forEach(p => { out[p] = 0; });
  Object.entries(st.own || {}).forEach(([t, p]) => { out[p] = (out[p] || 0) + (st.val[t] || VAL_LAND); });
  return out;
}

// Body do žebříčku týdne (dashboard → Přátelé): users/{uid}.play.{den}.p
function recordPlayPoints(n) {
  try {
    const u = auth.currentUser; if (!u || u.isAnonymous || !(n > 0)) return;
    const day = new Date().toISOString().slice(0, 10);
    db.collection('users').doc(u.uid).set({ play: { [day]: { p: firebase.firestore.FieldValue.increment(Math.round(n)) } } }, { merge: true }).catch(() => {});
  } catch (_) {}
}
// Každý hráč si zapíše svůj výsledek sám (do cizího profilu zapisovat nesmí).
function recordGameResult(st) {
  if (!st || !(st.order || []).includes(ME.uid)) return;
  const key = 'dob_rec_' + GAME_ID + '_' + st.step;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (_) {}
  const sc = scores(st);
  const winner = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
  recordPlayPoints(10 + (winner === ME.uid ? 30 : 0));
}

/* ═══ Vykreslení hry (všichni) ═══ */
let VB = null, VB0 = null;
const terrName = id => (MAP && MAP.t.find(t => t.id === id)?.name) || id;

// Popisek na mapu: bez slov, která jsou u všech stejná
const shortName = n => String(n).replace(/^Hlavní město /, '').replace(/ kraj$/, '').replace(/^Kraj /, '');
function buildSvg() {
  const svg = $('mapSvg');
  VB0 = [0, 0, MAP.w, MAP.h];
  // výřez: přiblížit na území regionu
  const inR = MAP.t.filter(t => REGION.ids.has(t.id));
  if (inR.length && inR.length < MAP.t.length) {
    const xs = inR.map(t => t.c[0]), ys = inR.map(t => t.c[1]);
    const pad = 60, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    VB0 = [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
  }
  VB = VB0.slice();
  svg.setAttribute('viewBox', VB.join(' '));
  const labels = REGION.ids.size <= 20; // na malé mapě (kraje, spolkové země) jsou vidět názvy
  svg.innerHTML = `<g class="dob-terrs">${MAP.t.map(t => `<path d="${t.d}" data-t="${t.id}" class="dob-t${REGION.ids.has(t.id) ? '' : ' off'}"/>`).join('')}</g>
    <g class="dob-marks">${MAP.t.filter(t => REGION.ids.has(t.id)).map(t => `<g class="dob-mark" data-m="${t.id}" transform="translate(${t.c[0]},${t.c[1]})">${t.small ? `<circle r="5" class="dob-small" data-t="${t.id}"/>` : ''}<text class="dob-castle" y="4"></text>${labels ? `<text class="dob-label" y="17">${esc(shortName(t.name))}</text>` : ''}</g>`).join('')}</g>`;
}

function wireGame() {
  const svg = $('mapSvg'), wrap = $('mapWrap');
  const apply = () => svg.setAttribute('viewBox', VB.join(' '));
  const zoomAt = (f, cx, cy) => {
    const r = svg.getBoundingClientRect();
    const px = VB[0] + (cx - r.left) / r.width * VB[2], py = VB[1] + (cy - r.top) / r.height * VB[3];
    const nw = Math.min(VB0[2] * 1.5, Math.max(VB0[2] / 12, VB[2] * f)), nh = nw * VB[3] / VB[2];
    VB = [px - (px - VB[0]) * nw / VB[2], py - (py - VB[1]) * nh / VB[3], nw, nh];
    apply();
  };
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.15 : 0.87, e.clientX, e.clientY); }, { passive: false });
  $('zoomIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(0.75, r.left + r.width / 2, r.top + r.height / 2); });
  $('zoomOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(1.33, r.left + r.width / 2, r.top + r.height / 2); });
  $('zoomFit').addEventListener('click', () => { VB = VB0.slice(); apply(); });
  // posun tažením (myš i jeden prst), přiblížení dvěma prsty
  const pts = new Map(); let drag = null, pinch = null, moved = false;
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, vb: VB.slice() };
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), vb: VB.slice() }; drag = null; } });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = svg.getBoundingClientRect();
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      VB = pinch.vb.slice(); zoomAt(pinch.d / Math.max(1, d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true; return;
    }
    if (drag) {
      const dx = (e.clientX - drag.x) / r.width * drag.vb[2], dy = (e.clientY - drag.y) / r.height * drag.vb[3];
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) moved = true;
      if (moved) { VB = [drag.vb[0] - dx, drag.vb[1] - dy, drag.vb[2], drag.vb[3]]; apply(); }
    }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  svg.addEventListener('pointerup', e => {
    const wasMoved = moved; up(e);
    if (wasMoved) return;
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t) onTerritoryClick(t);
  });
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    const tip = $('mapTip');
    if (!t || !GAME?.st || !REGION?.ids.has(t)) { tip.hidden = true; return; }
    const st = GAME.st, p = st.own?.[t];
    tip.innerHTML = `<b>${esc(terrName(t))}</b>${p ? `<br><span style="color:${GAME.players[p]?.color}">● ${esc(pname(p))}</span> · ${st.val[t] || VAL_LAND} b.` : '<br>volné'}`;
    tip.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { $('mapTip').hidden = true; });
  setInterval(updateTimer, 250);
}

function myOptions(st) {
  if (!st || st.turn !== ME.uid) return [];
  if (st.phase === 'castle') return castleChoices(st);
  if (st.phase === 'pick' && st.pickQueue?.[0]?.p === ME.uid) return pickable(st, ME.uid);
  if (st.phase === 'attack') return attackTargets(st, ME.uid);
  return [];
}
function onTerritoryClick(t) {
  const st = GAME?.st;
  if (!st || !myOptions(st).includes(t)) return;
  ref().update({ [`req.${ME.uid}`]: { step: st.step, tid: t } }).catch(e => toast(e.message));
  document.querySelector(`[data-t="${t}"]`)?.classList.add('picked');
}

function renderGame() {
  show('screenGame');
  const st = GAME.st;
  if (!st) return;
  const m = MAP_LIST.find(x => x.id === GAME.settings.map);
  $('navTitle').textContent = `🗺️ Dobyvatel · ${m ? m.name : ''}`;
  // území
  const opts = new Set(myOptions(st));
  document.querySelectorAll('#mapSvg .dob-t').forEach(el => {
    const id = el.dataset.t; const p = st.own?.[id];
    el.style.fill = p ? GAME.players[p]?.color || '#888' : '';
    el.classList.toggle('owned', !!p);
    el.classList.toggle('sel', opts.has(id));
    el.classList.toggle('battle', !!(st.battle && st.battle.tid === id && (st.phase === 'q' || st.phase === 'reveal')));
    el.classList.remove('picked');
  });
  document.querySelectorAll('#mapSvg .dob-small').forEach(el => {
    const p = st.own?.[el.dataset.t]; el.style.fill = p ? GAME.players[p]?.color : ''; el.classList.toggle('sel', opts.has(el.dataset.t));
  });
  const castleOf = {}; Object.entries(st.castles || {}).forEach(([p, t]) => { castleOf[t] = p; });
  document.querySelectorAll('#mapSvg .dob-mark').forEach(g => {
    const t = g.dataset.m, p = castleOf[t];
    g.querySelector('.dob-castle').textContent = p ? '🏰' + '●'.repeat(st.towers[p] || 0) : '';
  });
  // skóre
  const sc = scores(st);
  $('scores').innerHTML = (st.order || []).filter(p => GAME.players[p]).sort((a, b) => sc[b] - sc[a]).map(p => {
    const pl = GAME.players[p];
    return `<div class="dob-score${st.turn === p && st.phase !== 'q' && st.phase !== 'reveal' && st.phase !== 'end' ? ' turn' : ''}${st.out[p] ? ' out' : ''}">
      <span class="dob-dot" style="background:${pl.color}"></span>
      <span class="dob-pname">${esc(pl.name)}${p === ME.uid ? ' <small>(ty)</small>' : ''}</span>
      <span class="dob-towers">${st.castles[p] ? '🏰' + (st.towers[p] || 0) : st.out[p] ? '☠️' : ''}</span>
      <b>${sc[p] || 0}</b></div>`;
  }).join('');
  renderPhase(st);
  renderQuestion(st);
  $('logBox').innerHTML = (st.log || []).slice().reverse().map(l => `<div>${esc(l)}</div>`).join('');
}

function renderPhase(st) {
  const box = $('phaseBox');
  const me = st.turn === ME.uid;
  let txt = '';
  if (st.phase === 'castle') txt = me ? '🏰 <b>Vyber si hrad</b> — svítí území na okraji mapy, která nejsou vedle jiného hradu.' : `🏰 ${esc(pname(st.turn))} vybírá hrad…`;
  else if (st.phase === 'pick') { const c = st.pickQueue?.[0]; txt = c && c.p === ME.uid ? `🗺️ <b>Zaber ${c.n} ${c.n === 1 ? 'území' : 'území'}</b> — svítí ta, která můžeš.` : `🗺️ ${esc(pname(c?.p))} zabírá území (${c?.n || 0})…`; }
  else if (st.phase === 'attack') txt = me ? '⚔️ <b>Tvůj útok</b> — vyber cizí území u svých hranic.' : `⚔️ ${esc(pname(st.turn))} vybírá, kam zaútočí…`;
  else if (st.phase === 'q' || st.phase === 'reveal') {
    const b = st.battle;
    txt = st.ctx?.type === 'order' ? '🎯 Kdo bude blíž (a rychlejší), vybírá hrad první'
      : st.ctx?.type === 'expand' ? '🎯 Expanze — tipovačka pro všechny'
      : b ? `⚔️ ${esc(pname(b.att))} → ${esc(terrName(b.tid))} (${esc(pname(b.def))})${b.castle ? ` · hrad, věží ${st.towers[b.def]}` : ''}${st.ctx?.type === 'tie' ? ' · rozstřel' : ''}` : '';
  } else if (st.phase === 'end') txt = '🏆 Hra skončila';
  const roundTxt = st.round ? `<span class="dob-round">Kolo ${Math.min(st.round, st.rounds)}/${st.rounds}</span>` : '<span class="dob-round">Rozdělování</span>';
  box.innerHTML = `<div class="dob-phase-row">${roundTxt}<span class="dob-timer" id="dobTimer"></span></div><div class="dob-phase-txt">${txt}</div><div class="dob-bar"><i id="dobBar"></i></div>`;
  if (!isHost() && st.phase !== 'end') box.insertAdjacentHTML('beforeend', '');
}

function updateTimer() {
  const st = GAME?.st; const el = $('dobTimer'), bar = $('dobBar');
  if (!st || !el) return;
  const dl = st.phase === 'q' ? st.q?.deadline : st.phase === 'reveal' ? st.revealUntil : st.deadline;
  const total = st.phase === 'q' ? (GAME.settings.timer || 20) * 1000 : st.phase === 'reveal' ? REVEAL_MS : 25000;
  if (!dl || st.phase === 'end') { el.textContent = ''; if (bar) bar.style.width = '0'; return; }
  const left = Math.max(0, dl - Date.now());
  el.textContent = Math.ceil(left / 1000) + ' s';
  if (bar) bar.style.width = Math.min(100, left / total * 100) + '%';
}

function codeOrText(text, lang) {
  return lang ? `<pre class="code-block" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>` : esc(text);
}
let LAST_Q_RENDER = '';
function renderQuestion(st) {
  const box = $('qBox');
  if (st.phase === 'end') {
    recordGameResult(st);
    const sc = scores(st);
    const order = (st.order || []).filter(p => GAME.players[p]).sort((a, b) => sc[b] - sc[a]);
    box.innerHTML = `<div class="dob-end"><div class="dob-trophy">🏆</div><h3>${esc(pname(order[0]))} vyhrává!</h3>
      ${order.map((p, i) => `<div class="dob-end-row"><span>${i + 1}.</span><span class="dob-dot" style="background:${GAME.players[p].color}"></span><span>${esc(pname(p))}</span><b>${sc[p]}</b></div>`).join('')}
      ${isHost() ? '<button type="button" class="btn btn-primary" id="againBtn">Hrát znovu (lobby)</button>' : ''}
      <a class="btn btn-secondary" href="dobyvatel.html">Zpět na hry</a></div>`;
    $('againBtn')?.addEventListener('click', () => ref().update({ status: 'lobby', st: firebase.firestore.FieldValue.delete(), answers: {}, req: {} }));
    LAST_Q_RENDER = '';
    return;
  }
  if (!st.q || (st.phase !== 'q' && st.phase !== 'reveal')) {
    box.innerHTML = st.phase === 'pick' || st.phase === 'castle' || st.phase === 'attack' ? '<div class="dob-muted dob-wait">Mapa vlevo — vybírá se území.</div>' : '';
    LAST_Q_RENDER = '';
    return;
  }
  const q = st.q, part = q.parts.includes(ME.uid);
  const myAns = (GAME.answers || {})[ME.uid];
  const answered = myAns && myAns.step === st.step;
  const key = st.step + '|' + st.phase + '|' + (answered ? 1 : 0);
  if (key === LAST_Q_RENDER && st.phase === 'q') { renderAnsweredDots(st); return; }
  LAST_Q_RENDER = key;
  const who = q.parts.map(p => `<span class="dob-chip" style="--c:${GAME.players[p]?.color}" data-chip="${p}">${esc(pname(p))}</span>`).join('');
  let body = '';
  if (st.phase === 'q') {
    if (q.kind === 'guess') {
      body = part ? (answered ? `<div class="dob-sent">Tvůj tip: <b>${esc(myAns.v)}</b> · čeká se na ostatní</div>`
        : `<form class="dob-guess" id="guessForm"><input type="number" inputmode="numeric" id="guessIn" class="input" placeholder="Tvůj tip (celé číslo)" required autocomplete="off"><button class="btn btn-primary">Tipnout</button></form>`)
        : '<div class="dob-muted">Odpovídají jen hráči v bitvě.</div>';
    } else {
      body = `<div class="dob-opts">${q.opts.map((o, i) => `<button type="button" class="dob-opt${q.cl ? ' is-code' : ''}${answered && myAns.v === i ? ' chosen' : ''}" data-o="${i}" ${!part || answered ? 'disabled' : ''}>${q.cl ? `<pre><code>${esc(o)}</code></pre>` : esc(o)}</button>`).join('')}</div>
        ${!part ? '<div class="dob-muted">Sleduješ — odpovídají útočník a obránce.</div>' : answered ? '<div class="dob-sent">Odpověď odeslána · čeká se na soupeře</div>' : ''}`;
    }
  } else {
    const r = st.reveal;
    if (q.kind === 'guess') {
      body = `<div class="dob-correct">Správně: <b>${r.correct}</b></div>` + r.rank.map((p, i) => {
        const x = r.res[p];
        return `<div class="dob-res"><span>${i + 1}.</span><span class="dob-dot" style="background:${GAME.players[p]?.color}"></span><span>${esc(pname(p))}</span><b>${x.v === null ? '—' : x.v}</b><small>${x.d === null ? 'netipoval' : 'o ' + x.d}</small></div>`;
      }).join('');
    } else {
      body = `<div class="dob-opts">${q.opts.map((o, i) => `<div class="dob-opt ${i === r.correct ? 'ok' : ''}${Object.values(r.res).some(x => x.v === i) && i !== r.correct ? ' bad' : ''}${q.cl ? ' is-code' : ''}">${q.cl ? `<pre><code>${esc(o)}</code></pre>` : esc(o)}<span class="dob-who">${q.parts.filter(p => r.res[p].v === i).map(p => `<i style="background:${GAME.players[p]?.color}" title="${esc(pname(p))}"></i>`).join('')}</span></div>`).join('')}</div>`;
    }
  }
  box.innerHTML = `<div class="dob-qhead">${q.kind === 'guess' ? '🎯 Tipovačka' : '❓ Otázka'} <span class="dob-chips">${who}</span></div>
    <div class="dob-qtext">${codeOrText(q.text, q.fl)}</div>${body}`;
  renderAnsweredDots(st);
  const f = $('guessForm');
  if (f) {
    const inp = $('guessIn'); setTimeout(() => inp.focus(), 50);
    f.addEventListener('submit', e => {
      e.preventDefault();
      const v = Math.round(+inp.value);
      if (!Number.isFinite(v)) return;
      ref().update({ [`answers.${ME.uid}`]: { v, step: st.step, t: Date.now() } }).catch(er => toast(er.message));
    });
  }
  box.querySelectorAll('button[data-o]').forEach(b => b.addEventListener('click', () => {
    ref().update({ [`answers.${ME.uid}`]: { v: +b.dataset.o, step: st.step, t: Date.now() } }).catch(er => toast(er.message));
    box.querySelectorAll('button[data-o]').forEach(x => { x.disabled = true; });
    b.classList.add('chosen');
  }));
}
function renderAnsweredDots(st) {
  document.querySelectorAll('[data-chip]').forEach(c => {
    const a = (GAME.answers || {})[c.dataset.chip];
    c.classList.toggle('done', !!(a && a.step === st.step));
  });
}

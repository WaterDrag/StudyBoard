// ═══ pexeso.js — Pexeso: pojem ↔ odpověď, sám nebo s přáteli
// Sám: vše lokálně, počítají se tahy a čas.
// S přáteli: jeden dokument pexeso/{id} (stejná myšlenka jako Dobyvatel):
//   { hostUid, status lobby|play|end, allowedUids, playerIds, players{uid:{name,score,color}},
//     order[], turn, tiles[{t,p,s}], open[], matched{idx:uid}, moves, turnAt }
// Tah zapisuje hráč, který je na řadě (transakce). Nepovedenou dvojici po
// chvilce otočí zpátky on — a když mezitím odpadne, kdokoli jiný.
const PX_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const PX_BEST = 'px_best', PX_FLIP_MS = 1300, PX_STUCK_MS = 4500, PX_IDLE_MS = 45e3;
let DECKS = [], pickDecks = () => [], P = null, GID = null, UNSUB = null, MY_NAME = '', MULTI_CLOCK = null;

const gref = () => db.collection('pexeso').doc(GID);
const params = new URLSearchParams(location.search);

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  MY_NAME = user.displayName || user.email?.split('@')[0] || 'Hráč';
  showBest();
  if (params.get('g')) { GID = params.get('g'); openGame(); return; }
  try { DECKS = await mcLoadDecks(); } catch (_) { $('pxDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'pxDecks', all: 'pxAll', start: 'pxStart', hint: 'pxHint', key: 'px_decks', decks: DECKS });
  $('pxStart').onclick = start;
});
function showBest() {
  let best = null;
  try { best = JSON.parse(localStorage.getItem(PX_BEST) || 'null'); } catch (_) { /* nic */ }
  $('pxBest').innerHTML = best ? `🏆 Nejlepší sólo: <b>${best.moves} tahů</b> (${best.pairs} dvojic)` : '';
}
const show = id => ['pxSetup', 'pxLobby', 'pxGame', 'pxEnd'].forEach(s => { $(s).hidden = s !== id; });

// Dlaždice: pojem a odpověď každé karty, zamíchané. Krátké karty bez kódu.
async function buildTiles(n) {
  const all = await mcLoadCards(pickDecks());
  const seen = new Set();
  const cards = shuffle(all.filter(c => !c.fl && !c.cl && c.f.length <= 80 && c.b.length <= 110)).filter(c => {
    const k = c.f.toLowerCase() + '|' + c.b.toLowerCase();
    if (seen.has(c.f.toLowerCase()) || seen.has(c.b.toLowerCase()) || seen.has(k)) return false;
    seen.add(c.f.toLowerCase()); seen.add(c.b.toLowerCase()); return true;
  }).slice(0, n);
  return shuffle(cards.flatMap((c, p) => [{ t: c.f, p, s: 'f' }, { t: c.b, p, s: 'b' }]));
}

async function start() {
  const btn = $('pxStart');
  btn.disabled = true; btn.textContent = 'Míchám karty…';
  try {
    const n = +$('pxPairs').value;
    const tiles = await buildTiles(n);
    if (tiles.length < 6) { toast('Vybrané balíčky nemají dost krátkých kartiček na pexeso.'); return; }
    const multi = document.querySelector('input[name="pxMode"]:checked').value === 'multi';
    if (!multi) {
      P = { solo: true, tiles, open: [], matched: {}, moves: 0, t0: Date.now(), turn: ME.uid, players: { [ME.uid]: { name: MY_NAME, score: 0, color: '#22c55e' } }, order: [ME.uid], status: 'play' };
      show('pxGame'); renderGame();
      clearInterval(P.clock);
      P.clock = setInterval(clockTick, 500);
      return;
    }
    if (ME.isAnonymous) { toast('Hra s přáteli jen pro přihlášené.'); return; }
    const friends = await mcFriends().catch(() => []);
    const ref = await db.collection('pexeso').add({
      hostUid: ME.uid, hostName: MY_NAME, status: 'lobby', tiles, pairs: tiles.length / 2, decks: sbLobbyDecks(pickDecks()),
      allowedUids: [ME.uid, ...friends], playerIds: [ME.uid],
      players: { [ME.uid]: { name: MY_NAME, score: 0, color: PX_COLORS[0] } },
      open: [], matched: {}, moves: 0, order: [], turn: null, turnAt: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    history.replaceState(null, '', '?g=' + ref.id);
    GID = ref.id;
    openGame();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

// ── Hra s přáteli ────────────────────────────────────────────────
function openGame() {
  UNSUB?.();
  let joined = false;
  UNSUB = gref().onSnapshot(async snap => {
    if (!snap.exists) { toast('Hra už neexistuje.'); location.href = 'pexeso.html'; return; }
    const d = snap.data();
    P = { ...d, solo: false };
    if (d.status === 'lobby') {
      if (!d.playerIds.includes(ME.uid) && !joined) {
        joined = true;
        if (d.playerIds.length >= 6) { toast('Hra je plná.'); return; }
        const used = Object.values(d.players).map(p => p.color);
        gref().update({
          playerIds: firebase.firestore.FieldValue.arrayUnion(ME.uid),
          [`players.${ME.uid}`]: { name: MY_NAME, score: 0, color: PX_COLORS.find(c => !used.includes(c)) || PX_COLORS[0] },
        }).catch(e => toast('Nepodařilo se připojit: ' + e.message));
      }
      return renderLobby();
    }
    if (!d.playerIds.includes(ME.uid)) { show('pxSetup'); toast('Hra už běží bez tebe.'); return; }
    if (d.status === 'end') { afkStop(); return renderEnd(); }
    show('pxGame');
    afkStart(gref(), ME.uid);
    afkRender({ data: d, players: pxPeople(), startedAt: d.startedAt });
    pxKickedTurn();
    if (!MULTI_CLOCK) MULTI_CLOCK = setInterval(clockTick, 500);   // hlídá zaseknuté tahy
    renderGame();
    maybeResolve();
  }, e => toast('Hru se nepodařilo načíst: ' + e.message));
}

function renderLobby() {
  show('pxLobby');
  const host = P.hostUid === ME.uid;
  $('pxLobbyInfo').textContent = `${P.hostName} zakládá pexeso: ${P.pairs} dvojic. Přátelé ho uvidí v záložce Hry, nebo jim pošli odkaz.`;
  $('pxLobbyDecks').innerHTML = sbLobbyDecksHTML(P.decks);
  $('pxLobbyPlayers').innerHTML = P.playerIds.map(uid => { const p = P.players[uid] || {}; return `<span class="px-chip" style="--c:${p.color}">${esc(p.name || 'Hráč')}${uid === P.hostUid ? ' 👑' : ''}</span>`; }).join('');
  $('pxGo').hidden = !host;
  $('pxGo').disabled = P.playerIds.length < 2;
  $('pxLobbyHint').textContent = host ? (P.playerIds.length < 2 ? 'Čeká se aspoň na jednoho dalšího hráče.' : 'Všichni tu? Spusť hru.') : 'Čeká se, až hostitel spustí hru.';
  $('pxGo').onclick = () => {
    const order = shuffle(P.playerIds);
    gref().update({ status: 'play', order, turn: order[0], turnAt: Date.now(), startedAt: Date.now(), open: [], matched: {}, moves: 0 }).catch(e => toast('Nepovedlo se: ' + e.message));
  };
  $('pxCopy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Odkaz zkopírován.'); } catch (_) { sbPrompt('Zkopíruj odkaz', location.href, { ok: 'Hotovo', noCancel: true }); } };
  $('pxLeave').onclick = async () => {
    try {
      if (host) await gref().delete();
      else await gref().update({ playerIds: firebase.firestore.FieldValue.arrayRemove(ME.uid), [`players.${ME.uid}`]: firebase.firestore.FieldValue.delete() });
    } catch (_) { /* nic */ }
    location.href = 'dashboard.html?tab=games';
  };
}

// ── Vykreslení hry (sólo i společně) ─────────────────────────────
function renderGame() {
  const board = $('pxBoard');
  const n = P.tiles.length;
  board.style.setProperty('--cols', n <= 12 ? 4 : n <= 16 ? 4 : n <= 20 ? 5 : 6);
  if (board.children.length !== n) {
    board.innerHTML = P.tiles.map((t, i) => `<button type="button" class="px-tile" data-i="${i}"><span class="px-back">?</span><span class="px-face"><small>${t.s === 'f' ? 'pojem' : 'odpověď'}</small>${esc(t.t)}</span></button>`).join('');
    board.querySelectorAll('.px-tile').forEach(b => b.addEventListener('click', () => flip(+b.dataset.i)));
  }

  const nOpen = (P.open || []).length, nMatch = Object.keys(P.matched || {}).length;
  if (PX_SND.init) {
    if (nMatch > PX_SND.m) window.sfx?.('ok');
    else if (nOpen > PX_SND.o) window.sfx?.('flip');
    else if (nOpen < PX_SND.o && nMatch === PX_SND.m) window.sfx?.('bad');
  }
  Object.assign(PX_SND, { o: nOpen, m: nMatch, init: true });  const open = new Set(P.open || []);
  [...board.children].forEach((b, i) => {
    const by = (P.matched || {})[i];
    b.classList.toggle('up', open.has(i) || !!by);
    b.classList.toggle('done', !!by);
    b.style.setProperty('--c', by ? P.players[by]?.color || '#22c55e' : '');
    b.disabled = !!by;
  });
  const myTurn = P.turn === ME.uid;
  $('pxTurn').textContent = P.solo ? `${Object.keys(P.matched).length / 2} / ${n / 2} dvojic` : myTurn ? '👉 Jsi na tahu' : `Hraje ${P.players[P.turn]?.name || '…'}`;
  $('pxTurn').classList.toggle('mine', !P.solo && myTurn);
  $('pxMoves').textContent = `${P.moves || 0} tahů`;
  $('pxScores').hidden = P.solo;
  const out = P.solo ? [] : pxKicked();
  if (!P.solo) $('pxScores').innerHTML = (P.order || []).map(uid => { const p = P.players[uid] || {}; return `<span class="px-chip${uid === P.turn ? ' turn' : ''}${out.includes(uid) ? ' out' : ''}" style="--c:${p.color}">${esc(p.name)} <b>${p.score || 0}</b></span>`; }).join('');
  $('pxSkip').hidden = true;   // nahradilo hlasování o vyhození (afk.js)
}
function clockTick() {
  if (!P) return;
  if (P.solo) { const s = Math.floor((Date.now() - P.t0) / 1000); $('pxClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  else { $('pxClock').textContent = ''; renderGame(); maybeResolve(); }
}

// ── Tahy ─────────────────────────────────────────────────────────
function flip(i) {
  if (!P || P.status !== 'play' || P.turn !== ME.uid) return;
  if ((P.open || []).includes(i) || (P.matched || {})[i] || (P.open || []).length >= 2 || P.busy) return;
  if (P.solo) { applyFlip(P, i, ME.uid); renderGame(); return afterFlip(); }
  P.busy = true;
  db.runTransaction(async tx => {
    const s = await tx.get(gref()), d = s.data();
    if (d.turn !== ME.uid || d.open.length >= 2 || d.open.includes(i) || d.matched[i]) return;
    applyFlip(d, i, ME.uid);
    tx.update(gref(), { open: d.open, matched: d.matched, players: d.players, moves: d.moves, status: d.status, turnAt: Date.now() });
  }).catch(e => toast('Tah se nepovedl: ' + e.message)).finally(() => { P.busy = false; });
}
// Otočí kartu; dvojice = body a hraje se dál.
function applyFlip(d, i, uid) {
  d.open = [...(d.open || []), i];
  if (d.open.length === 2) {
    d.moves = (d.moves || 0) + 1;
    const [a, b] = d.open;
    if (d.tiles[a].p === d.tiles[b].p) {
      d.matched = { ...d.matched, [a]: uid, [b]: uid };
      d.players = { ...d.players, [uid]: { ...d.players[uid], score: (d.players[uid].score || 0) + 1 } };
      d.open = [];
      if (Object.keys(d.matched).length === d.tiles.length) d.status = 'end';
    }
  }
}
function afterFlip() {
  if (P.solo) {
    if (P.status === 'end') return setTimeout(renderEnd, 500);
    if (P.open.length === 2) { P.busy = true; setTimeout(() => { P.open = []; P.busy = false; renderGame(); }, PX_FLIP_MS); }
  }
}
// Nepovedená dvojice: hráč na tahu ji po chvilce otočí a předá tah dalšímu.
// Kdyby odpadl, udělá to kdokoli po PX_STUCK_MS.
let resolving = false;
function maybeResolve() {
  if (P.solo || P.status !== 'play' || (P.open || []).length !== 2 || resolving) return;
  const age = Date.now() - (P.turnAt || 0);
  if (!(P.turn === ME.uid ? age > PX_FLIP_MS : age > PX_STUCK_MS)) return;
  resolving = true;
  db.runTransaction(async tx => {
    const s = await tx.get(gref()), d = s.data();
    if (d.open.length !== 2) return;
    tx.update(gref(), { open: [], turn: pxNext(d, d.turn), turnAt: Date.now() });
  }).catch(() => {}).finally(() => { resolving = false; });
}
// Lidé ve hře / vyhození (hlasováním, afk.js) — vyhozený se v tazích přeskakuje.
const pxPeople = () => (P.order || []).map(uid => ({ uid, name: P.players[uid]?.name || 'Hráč' }));
const pxKicked = () => afkKickedList(P, pxPeople(), P.startedAt);
function pxNext(d, from) {
  const order = d.order, out = afkKickedList(d, order.map(uid => ({ uid })), d.startedAt);
  for (let i = 1; i <= order.length; i++) { const u = order[(order.indexOf(from) + i) % order.length]; if (!out.includes(u)) return u; }
  return from;
}
// Je na tahu vyhozený? Kdokoli tah předá dalšímu.
let kickTurning = false;
function pxKickedTurn() {
  if (P.solo || P.status !== 'play' || kickTurning || !pxKicked().includes(P.turn)) return;
  kickTurning = true;
  db.runTransaction(async tx => {
    const s = await tx.get(gref()), d = s.data();
    if (!afkKickedList(d, d.order.map(uid => ({ uid })), d.startedAt).includes(d.turn)) return;
    tx.update(gref(), { open: [], turn: pxNext(d, d.turn), turnAt: Date.now() });
  }).catch(() => {}).finally(() => { kickTurning = false; });
}
$('pxSkip').onclick = () => db.runTransaction(async tx => {
  const s = await tx.get(gref()), d = s.data();
  if (Date.now() - d.turnAt < PX_IDLE_MS) return;
  tx.update(gref(), { open: [], turn: pxNext(d, d.turn), turnAt: Date.now() });
}).catch(e => toast('Nepovedlo se: ' + e.message));

// ── Konec ────────────────────────────────────────────────────────
const PX_SND = { o: 0, m: 0, init: false };
function renderEnd() {
  if (!renderEnd.played) { renderEnd.played = true; window.sfx?.(P.solo || (P.order || []).map(u => P.players[u]).sort((a, b) => (b?.score || 0) - (a?.score || 0))[0] === P.players[ME.uid] ? 'win' : 'lose'); }
  clearInterval(P.clock); clearInterval(MULTI_CLOCK); MULTI_CLOCK = null;
  show('pxEnd');
  const pairs = P.tiles.length / 2;
  const key = 'px_rec_' + (GID || 'solo' + P.t0);
  let fresh = true;
  try { fresh = !localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (_) { /* nic */ }
  if (P.solo) {
    const sec = Math.floor((Date.now() - P.t0) / 1000);
    let best = null;
    try { best = JSON.parse(localStorage.getItem(PX_BEST) || 'null'); } catch (_) { /* nic */ }
    const better = !best || pairs > best.pairs || (pairs === best.pairs && P.moves < best.moves);
    if (better) try { localStorage.setItem(PX_BEST, JSON.stringify({ moves: P.moves, pairs })); } catch (_) { /* nic */ }
    if (fresh) recordPlayPoints(pairs);
    $('pxEndIco').textContent = P.moves <= pairs * 1.5 ? '🧠' : '🏆';
    $('pxEndTitle').textContent = 'Všechny dvojice nalezeny!';
    $('pxResult').innerHTML = `<b>${P.moves} tahů</b><span>${pairs} dvojic za ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} · +${pairs} b do žebříčku týdne</span>` + (better ? '<span class="sp-record">🎉 Nový rekord!</span>' : '');
    $('pxRank').innerHTML = '';
  } else {
    const rows = P.order.map(uid => ({ uid, ...P.players[uid] })).sort((a, b) => (b.score || 0) - (a.score || 0));
    const mine = P.players[ME.uid]?.score || 0, win = rows[0]?.uid === ME.uid;
    if (fresh) recordPlayPoints(mine * 2 + (win ? 10 : 0));
    $('pxEndIco').textContent = win ? '🏆' : '🃏';
    $('pxEndTitle').textContent = win ? 'Vyhrál(a) jsi!' : `Vyhrává ${rows[0]?.name}`;
    $('pxResult').innerHTML = `<span>Tvoje dvojice: <b>${mine}</b> z ${pairs} · +${mine * 2 + (win ? 10 : 0)} b do žebříčku týdne</span>`;
    $('pxRank').innerHTML = rows.map((r, i) => `<div class="lb-row${r.uid === ME.uid ? ' me' : ''}"><span class="lb-medal">${['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span><span class="lb-av" style="background:${r.color}">${esc((r.name || '?')[0].toUpperCase())}</span><span class="lb-name"><b>${esc(r.name)}</b></span><span class="lb-points">${r.score || 0}<small> dvojic</small></span></div>`).join('');
  }
  $('pxAgain').onclick = () => { UNSUB?.(); location.href = 'pexeso.html'; };
}

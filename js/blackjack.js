// ═══ blackjack.js — blackjack s minimální sázkou, která se mění každou ruku, sám i s přáteli
// Hraje se normálně a výhry se vyplácí rovnou. Otázka přijde, až na minimální sázku nestačí účet:
// správná odpověď vždy dorovná účet přesně na minimum (i z velkého dluhu), špatná strhne jen minimum.
// Minimum se odvíjí od účtu a občas ho přesáhne (rollMin), takže na otázky dojde i tomu, kdo vyhrává.
// Peníze jsou ve společné peněžence her (wallet.js, users/{uid}.wallet), minimum a stav kola v users/{uid}.bj.
// Pravidla stolu: 6 balíčků, krupiér stojí na 17, blackjack platí 3:2, zdvojit jde na prvních dvou kartách,
// dvě karty stejné hodnoty jde jednou rozdělit (split): z es jde jen po jedné kartě a 21 po rozdělení není blackjack.
//
// Stůl má pět míst. Sólo běží ve stavu S v paměti, s přáteli je S dokument blackjack/{id}:
//   { hostUid, hostName, tid, allowedUids, playerIds, seats[uid], players{uid:{name,photo,seen}},
//     round, phase bet|play|done, shoe[], pos, dealer[], hidden, hands{uid:{bet,cards,done,parts?,cur?}}, turn, turnAt, betAt, doneAt }
// Rozdělená ruka má parts[{bet,cards,done,sp}] a cur (která se hraje); bet je pak součet sázek, cards prázdné.
// Obě varianty mění stůl stejnými funkcemi přes act(): s přáteli v transakci, takže je jedno, kdo akci spustí.
// Peníze si každý připisuje sám, když ruku uvidí dohranou (settle); A.lastR hlídá, aby to bylo jen jednou.
const SEL_KEY = 'bj_decks', STATE_KEY = 'bj_state';
const CHIPS = [50, 100, 500, 1000, 5000, 25000], SEATS = 5;
const START_BAL = 1000, FORCE_CHANCE = 0.15;   // jak často je minimum vyšší než celý účet
const BET_MS = 15000, TURN_MS = 30000, DONE_MS = 3200, CARD_MS = 450, BEAT_MS = 30000, GONE_MS = 90000;
// Krupiér dohrává pomalu, ať je to napínavé: chvíli počká, otočí skrytou kartu a pak bere po jedné.
// Odvíjí se od času konce kola (turnAt), takže všichni u stolu vidí totéž a obnovení stránky nic nepřehraje.
const HOLE_MS = 1100, DRAW_MS = 1400;
const revealMs = n => HOLE_MS + Math.max(0, n - 2) * DRAW_MS;
const SEAT_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899'];
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const money = n => n.toLocaleString('cs-CZ') + ' Kč';
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const params = new URLSearchParams(location.search);

let DECKS = [], POOL = [], POOL_ALL = [], QUEUE = [], pickDecks = () => [];
const newAccount = () => ({ bal: START_BAL, min: 50, best: START_BAL, low: 0, right: 0, wrong: 0, hands: 0, lastR: '' });
let A = newAccount();
let S = null, GID = params.get('g'), UNSUB = null, MY_NAME = '', MSG = { html: '', kind: '' }, Q = null, BET = 0;
let busy = false, settling = '', TICK = null, lastBeat = 0;
let BET_LOG = [], LAST_BET = 0;   // sázka se skládá po žetonech: co přidal který klik, a kolik bylo vsazeno minule

const tref = () => db.collection('blackjack').doc(GID);
const me = () => ME.uid;
const mine = () => S?.hands?.[me()] || null;
const seated = () => !!S?.seats?.includes(me());
const show = id => ['bjSetup', 'bjGame'].forEach(s => { $(s).hidden = s !== id; });

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  MY_NAME = user.displayName || user.email?.split('@')[0] || 'Hráč';
  await loadAccount();
  showAccount();
  if (GID) await describeTable();
  try { DECKS = await mcLoadDecks(); } catch (e) { $('bjDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'bjDecks', all: 'bjAll', start: 'bjStart', hint: 'bjHint', key: SEL_KEY, decks: DECKS });
  if (DECKS.length) $('bjStart').onclick = enter;
  // Návrat ke stolu, u kterého už sedím: balíčky si pamatuju, výběr se znovu neukazuje
  if (GID && seated() && pickDecks().length) enter();
});

// Přišel odkaz nebo řádek z nástěnky: na úvodní obrazovce je, ke komu si přisedám.
async function describeTable() {
  try {
    const snap = await tref().get();
    if (!snap.exists) { toast('Stůl už neexistuje.'); GID = null; history.replaceState(null, '', location.pathname); return; }
    S = snap.data();
    const full = !seated() && S.seats.length >= SEATS;
    if (full) { toast('U stolu už není volné místo.'); GID = null; S = null; history.replaceState(null, '', location.pathname); return; }
    $('bjStart').textContent = 'Přisednout';
    $('bjTableInfo').textContent = `Stůl hráče ${S.hostName || 'přítele'}: ${S.seats.length} z ${SEATS} míst obsazeno. Otázky si vybíráš z vlastních balíčků.`;
    $('bjTableInfo').hidden = false;
  } catch (e) { toast('Stůl se nepodařilo načíst: ' + e.message); GID = null; S = null; }
}

// ── Účet ───────────────────────────────────────────────────────
async function loadAccount() {
  let local = {};
  try { local = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch (_) { /* nic */ }
  const { w, g } = await walletLoad(me(), 'bj', local);
  A = { ...newAccount(), ...local, ...g, ...w };   // peníze vždy z peněženky, zbytek z uloženého stavu hry
}
function saveAccount() {
  A.best = Math.max(A.best, A.bal);
  A.low = Math.min(A.low, A.bal);
  try { localStorage.setItem(STATE_KEY, JSON.stringify(A)); } catch (_) { /* nic */ }
  walletSave(me(), A, { bj: { min: A.min, lastR: A.lastR, hands: A.hands } });
}
function showAccount() {
  const debt = A.bal < 0;
  $('bjAccount').innerHTML = `${debt ? 'Dlužíš' : 'Na účtu máš'} <b>${money(Math.abs(A.bal))}</b>`;
  $('bjReset').hidden = !A.hands && !A.right && !A.wrong;
  $('bjReset').onclick = async () => {
    if (!await sbConfirm('Vynulovat účet, rekord i statistiky? Peněženka je společná pro všechny hry o peníze.', { ok: 'Vynulovat', danger: true })) return;
    A = newAccount();
    saveAccount();
    showAccount();
  };
}

// Nové minimum po každé ruce: obvykle zlomek účtu, občas víc, než kolik na účtu je
const up50 = n => Math.max(50, Math.ceil(n / 50) * 50);
function rollMin() {
  if (A.bal <= 0) A.min = [50, 100, 250][Math.floor(Math.random() * 3)];
  else if (Math.random() < FORCE_CHANCE) A.min = up50(A.bal * (1.1 + Math.random() * 0.9));
  else A.min = up50(A.bal * (0.02 + Math.random() * 0.33));
}

// ── Vstup ke stolu ─────────────────────────────────────────────
async function enter() {
  const btn = $('bjStart'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Připravuji otázky…';
  try {
    const cards = await mcLoadCards(pickDecks());
    POOL = cards.filter(c => mcOptions(c, cards));
    POOL_ALL = cards;
    if (POOL.length < 3) { toast('Z vybraných balíčků nejde sestavit otázky s možnostmi. Přidej balíček s víc kartami.'); return; }
    QUEUE = shuffle(POOL);
    buildSeats();
    show('bjGame');
    if (GID) await joinTable();
    else { S = newTable(true); render(); }
    clearInterval(TICK);
    TICK = setInterval(tick, 500);
  } catch (e) {
    toast('Nepovedlo se: ' + e.message);
  } finally { btn.disabled = false; btn.textContent = label; }
}
const myPlayer = () => ({ name: MY_NAME, photo: ME.photoURL || '', seen: Date.now() });
function newTable(solo) {
  return {
    solo, tid: String(Date.now()), hostUid: me(), hostName: MY_NAME, seats: [me()], playerIds: [me()], players: { [me()]: myPlayer() },
    round: 1, phase: 'bet', shoe: newShoe(), pos: 0, dealer: [], hidden: true, hands: {}, turn: null, turnAt: 0, betAt: 0, doneAt: 0,
  };
}
async function joinTable() {
  const ref = tref();
  await db.runTransaction(async tx => {
    const d = (await tx.get(ref)).data();
    if (!d) throw new Error('Stůl už neexistuje.');
    if (d.seats.includes(me())) return;
    if (d.seats.length >= SEATS) throw new Error('U stolu už není volné místo.');
    d.seats.push(me());
    tx.update(ref, { seats: d.seats, playerIds: firebase.firestore.FieldValue.arrayUnion(me()), [`players.${me()}`]: myPlayer() });
  });
  subscribe();
}
function subscribe() {
  UNSUB?.();
  UNSUB = tref().onSnapshot(snap => {
    if (!snap.exists) { toast('Stůl byl zavřený.'); leaveToSetup(); return; }
    S = snap.data();
    if (!seated()) { toast('Odpojil tě stůl, protože ses dlouho neozval.'); leaveToSetup(); return; }
    render();
  }, e => toast('Stůl se nepodařilo načíst: ' + e.message));
}
function leaveToSetup() {
  UNSUB?.(); UNSUB = null; clearInterval(TICK);
  location.href = 'dashboard.html?tab=games';
}
// Sólo stůl se otevře přátelům: rozehraná ruka pokračuje v dokumentu
async function openToFriends() {
  if (ME.isAnonymous) { toast('Hra s přáteli jen pro přihlášené.'); return; }
  const btn = $('bjInvite');
  btn.disabled = true;
  try {
    const friends = await mcFriends().catch(() => []);
    const { solo, ...data } = S;
    const ref = await db.collection('blackjack').add({ ...data, allowedUids: [me(), ...friends], turnAt: S.turnAt || Date.now(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    GID = ref.id;
    history.replaceState(null, '', '?g=' + GID);
    subscribe();
    copyLink();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; }
}
async function copyLink() {
  try { await navigator.clipboard.writeText(location.href); toast('Odkaz ke stolu je zkopírovaný. Přátelé stůl uvidí i v záložce Hry.'); }
  catch (_) { sbPrompt('Zkopíruj odkaz', location.href, { ok: 'Hotovo', noCancel: true }); }
}
async function leaveTable() {
  const h = mine();
  if (h && S.phase !== 'bet' && !await sbConfirm('Máš rozehranou ruku. Když odejdeš, o sázku přijdeš.', { ok: 'Odejít', danger: true })) return;
  if (S.solo || !GID) { leaveToSetup(); return; }
  if (h && S.phase === 'bet') { A.bal += h.bet; saveAccount(); }   // ještě se nerozdávalo
  UNSUB?.(); UNSUB = null;
  try {
    const ref = tref();
    await db.runTransaction(async tx => {
      const d = (await tx.get(ref)).data();
      if (!d) return;
      d.seats = d.seats.filter(u => u !== me());
      if (!d.seats.length) { tx.delete(ref); return; }
      const hand = d.hands[me()];
      if (hand) { if (d.phase === 'bet') delete d.hands[me()]; else hand.done = true; }
      if (d.turn === me()) advance(d);
      if (d.phase === 'bet') maybeDeal(d);
      delete d.players[me()];
      if (d.hostUid === me()) { d.hostUid = d.seats[0]; d.hostName = d.players[d.seats[0]]?.name || d.hostName; }
      d.playerIds = d.playerIds.filter(u => u !== me());
      tx.update(ref, stateOf(d));
    });
  } catch (_) { /* nic */ }
  leaveToSetup();
}

// ── Pravidla: mění stav stolu d, sdílené sólem i hrou s přáteli ─
function newShoe() {
  const out = [];
  for (let n = 0; n < 6; n++) SUITS.forEach(s => RANKS.forEach(r => out.push(r + s)));
  return shuffle(out);
}
const rankOf = c => c.slice(0, -1), suitOf = c => c.slice(-1);
function handValue(cards) {
  let t = 0, aces = 0;
  cards.forEach(c => { const r = rankOf(c); if (r === 'A') { aces++; t += 11; } else t += /^(J|Q|K|10)$/.test(r) ? 10 : +r; });
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
const isBJ = cards => cards.length === 2 && handValue(cards).t === 21;
// Rozdělená ruka: části se hrají postupně, nerozdělená ruka je sama sobě jedinou částí
const partsOf = h => h?.parts || (h ? [h] : []);
const curPart = h => h.parts ? h.parts[h.cur] : h;
const played = h => partsOf(h).some(p => p.cards?.length);
const cardVal = c => { const r = rankOf(c); return r === 'A' ? 11 : /^(J|Q|K|10)$/.test(r) ? 10 : +r; };
const canSplit = h => !!h && !h.parts && h.cards.length === 2 && cardVal(h.cards[0]) === cardVal(h.cards[1]);
// Aktuální část je dohraná: hraje se další část, nebo je na řadě další hráč
function finishPart(d, h) {
  if (h.parts) {
    h.parts[h.cur].done = true;
    const next = h.parts.findIndex(p => !p.done);
    if (next >= 0) { h.cur = next; d.turnAt = Date.now(); return; }
  }
  h.done = true;
  advance(d);
}
const draw = d => d.shoe[d.pos++];
const stateOf = d => {
  const out = { seats: d.seats, playerIds: d.playerIds, players: d.players, hostUid: d.hostUid, hostName: d.hostName, round: d.round, phase: d.phase, pos: d.pos, dealer: d.dealer, hidden: d.hidden, hands: d.hands, turn: d.turn, turnAt: d.turnAt, betAt: d.betAt, doneAt: d.doneAt };
  if (d.pos === 0) out.shoe = d.shoe;   // nová bota: jinak se ten velký seznam neposílá
  return out;
};
function maybeDeal(d) {
  const bets = d.seats.filter(u => d.hands[u]);
  if (bets.length && bets.length === d.seats.length) deal(d);
}
function deal(d) {
  if (d.phase !== 'bet') return false;
  const who = d.seats.filter(u => d.hands[u]);
  if (!who.length) return false;
  who.forEach(u => { d.hands[u].cards = [draw(d), draw(d)]; d.hands[u].done = isBJ(d.hands[u].cards); });
  d.dealer = [draw(d), draw(d)];
  d.hidden = true;
  d.phase = 'play';
  d.turn = null;
  const up = handValue(d.dealer.slice(0, 1)).t;
  if ((up === 10 || up === 11) && isBJ(d.dealer)) { who.forEach(u => { d.hands[u].done = true; }); finishRound(d); return true; }   // krupiér se podívá pod kartu
  advance(d);
  return true;
}
function advance(d) {
  const next = d.seats.find(u => d.hands[u] && !d.hands[u].done);
  d.turn = next || null;
  d.turnAt = Date.now();
  if (!next) finishRound(d);
}
function finishRound(d) {
  d.hidden = false;
  d.turn = null;
  const live = Object.values(d.hands).some(h => partsOf(h).some(p => handValue(p.cards).t <= 21 && (p.sp || !isBJ(p.cards))));
  if (live && !isBJ(d.dealer)) while (handValue(d.dealer).t < 17) d.dealer.push(draw(d));
  d.phase = 'done';
  d.doneAt = Date.now() + revealMs(d.dealer.length) + DONE_MS;
  d.turnAt = Date.now();
}
function nextRound(d) {
  if (d.phase !== 'done' || Date.now() < d.doneAt) return false;
  const now = Date.now();
  if (!d.solo) {   // kdo se dlouho neozval, uvolní místo
    d.seats = d.seats.filter(u => now - (d.players[u]?.seen || 0) < GONE_MS);
    if (!d.seats.length) return false;
    d.playerIds = d.playerIds.filter(u => d.seats.includes(u));
    Object.keys(d.players).forEach(u => { if (!d.seats.includes(u)) delete d.players[u]; });
    if (!d.seats.includes(d.hostUid)) { d.hostUid = d.seats[0]; d.hostName = d.players[d.seats[0]]?.name || d.hostName; }
  }
  d.round++;
  d.phase = 'bet';
  d.hands = {};
  d.dealer = [];
  d.hidden = true;
  d.betAt = 0;
  d.turnAt = now;
  if (d.pos > d.shoe.length - 80) { d.shoe = newShoe(); d.pos = 0; }
  return true;
}
// Jak ruka dopadla: vrácená částka včetně sázky, změna účtu a kolik to dělá.
function outcome(h, dealer) {
  const p = handValue(h.cards).t, v = handValue(dealer).t, bet = h.bet;
  const pBJ = !h.sp && isBJ(h.cards), dBJ = isBJ(dealer);
  if (p > 21) return { back: 0, delta: -bet, kind: 'bad', why: `Máš ${p}, to je přes 21.` };
  if (pBJ && dBJ) return { back: bet, delta: 0, kind: '', why: 'Oba máte blackjack.' };
  if (dBJ) return { back: 0, delta: -bet, kind: 'bad', why: 'Krupiér má blackjack.' };
  if (pBJ) { const pay = Math.round(bet * 1.5); return { back: bet + pay, delta: pay, kind: 'good', why: 'Blackjack!' }; }
  if (v > 21) return { back: bet * 2, delta: bet, kind: 'good', why: `Krupiér přetáhl na ${v}.` };
  if (p > v) return { back: bet * 2, delta: bet, kind: 'good', why: `${p} proti ${v}.` };
  if (p < v) return { back: 0, delta: -bet, kind: 'bad', why: `${p} proti ${v}.` };
  return { back: bet, delta: 0, kind: '', why: `Oba máte ${p}.` };
}
// Celá ruka hráče, u rozdělené součet obou částí
function outcomeAll(h, dealer) {
  const rs = partsOf(h).map(p => outcome(p, dealer));
  if (rs.length === 1) return rs[0];
  const back = rs.reduce((s, r) => s + r.back, 0), delta = rs.reduce((s, r) => s + r.delta, 0);
  return { back, delta, kind: delta > 0 ? 'good' : delta < 0 ? 'bad' : '', why: rs.every(r => r.why === rs[0].why) ? `Obě ruce: ${rs[0].why}` : rs.map((r, i) => `${i + 1}. ruka: ${r.why}`).join(' ') };
}

// Změna stolu. fn vrátí false, když už se akce nehodí (někdo byl rychlejší).
async function act(fn) {
  if (S.solo) { if (fn(S) !== false) render(); return true; }
  if (busy) return false;
  busy = true;
  const ref = tref();
  try {
    return await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const d = snap.data();
      if (fn(d) === false) return false;
      tx.update(ref, stateOf(d));
      return true;
    });
  } catch (e) { toast('Nepovedlo se: ' + e.message); return false; }
  finally { busy = false; }
}
function tick() {
  if (!S || busy) return;
  const now = Date.now();
  if (S.solo) { if (S.phase === 'done' && now >= S.doneAt) act(nextRound); return; }
  if (now - lastBeat > BEAT_MS) { lastBeat = now; tref().update({ [`players.${me()}.seen`]: now }).catch(() => {}); }
  renderStatus();
  // Termíny hlídají všichni: transakce pustí jen prvního
  if (S.phase === 'bet' && S.betAt && now > S.betAt + BET_MS) act(d => (d.phase === 'bet' && d.betAt && Date.now() > d.betAt + BET_MS ? deal(d) : false));
  else if (S.phase === 'play' && S.turn && now > S.turnAt + TURN_MS) act(d => {
    if (d.phase !== 'play' || !d.turn || Date.now() <= d.turnAt + TURN_MS) return false;
    d.hands[d.turn].done = true;
    advance(d);
  });
  else if (S.phase === 'done' && now >= S.doneAt) act(nextRound);
}

// ── Tahy hráče ─────────────────────────────────────────────────
async function placeBet() {
  if (S.phase !== 'bet' || mine() || Q || BET < A.min || BET > A.bal) return;
  const bet = BET;
  LAST_BET = bet;
  clearBet();
  const ok = await act(d => {
    if (d.phase !== 'bet' || d.hands[me()]) return false;
    d.hands[me()] = { bet, cards: [], done: false };
    d.betAt = d.betAt || Date.now();
    maybeDeal(d);
  });
  if (!ok) return;
  A.bal -= bet;   // sázka je pryč hned, obnovení stránky z prohrané ruky nevyvede
  A.hands++;
  MSG = { html: '', kind: '' };
  saveAccount();
  window.sfx?.('flip');
  render();
}
function hit() {
  if (S.turn !== me()) return;
  act(d => {
    if (d.turn !== me()) return false;
    const h = d.hands[me()], p = curPart(h);
    p.cards.push(draw(d));
    d.turnAt = Date.now();
    if (handValue(p.cards).t >= 21) finishPart(d, h);
  });
  window.sfx?.('flip');
}
function stand() {
  if (S.turn !== me()) return;
  act(d => {
    if (d.turn !== me()) return false;
    finishPart(d, d.hands[me()]);
  });
}
async function doubleDown() {
  const h0 = mine(), p0 = h0 && curPart(h0);
  if (S.turn !== me() || !p0 || p0.cards.length !== 2 || A.bal < p0.bet) return;
  const extra = p0.bet;
  const ok = await act(d => {
    const h = d.hands[me()], p = curPart(h);
    if (d.turn !== me() || p.cards.length !== 2) return false;
    p.bet += extra;
    if (h.parts) h.bet += extra;
    p.cards.push(draw(d));
    finishPart(d, h);
  });
  if (!ok) return;
  A.bal -= extra;
  saveAccount();
  window.sfx?.('flip');
  render();
}
// Split: dvě karty stejné hodnoty se rozdělí na dvě ruce, druhá dostane stejnou sázku.
// Každá část dobere druhou kartu; rozdělená esa dostanou jen tu jednu a hned stojí.
async function splitHand() {
  const h0 = mine();
  if (S.turn !== me() || !canSplit(h0) || A.bal < h0.bet) return;
  const extra = h0.bet;
  const ok = await act(d => {
    const h = d.hands[me()];
    if (d.turn !== me() || !canSplit(h)) return false;
    const aces = rankOf(h.cards[0]) === 'A';
    h.parts = h.cards.map(c => {
      const cards = [c, draw(d)];
      return { bet: extra, cards, done: aces || handValue(cards).t >= 21, sp: true };
    });
    h.cards = [];
    h.bet = extra * 2;
    h.cur = 0;
    d.turnAt = Date.now();
    if (h.parts[0].done) finishPart(d, h);
  });
  if (!ok) return;
  A.bal -= extra;
  saveAccount();
  window.sfx?.('flip');
  render();
}

// Ruku dohranou krupiérem si každý vyúčtuje sám, až dojede animace karet
function settle() {
  const h = mine();
  if (S.phase !== 'done' || !played(h)) return;
  const key = `${S.tid}:${S.round}`;
  if (A.lastR === key || settling === key) return;
  settling = key;
  const dealer = S.dealer.slice(), res = outcomeAll(h, dealer);
  setTimeout(() => {
    if (A.lastR === key) return;
    A.lastR = key;
    A.bal += res.back;
    rollMin();
    saveAccount();
    window.sfx?.(res.kind === 'good' ? 'coin' : res.kind === 'bad' ? 'bad' : 'click');
    MSG = {
      html: res.delta > 0 ? `${res.why} Výhra <b>${money(res.delta)}</b>.` : res.delta < 0 ? `${res.why} Prohra <b>${money(-res.delta)}</b>.` : `${res.why} Remíza, sázka se vrací.`,
      kind: res.kind,
    };
    render();
  }, Math.max(0, S.turnAt + revealMs(dealer.length) + 350 - Date.now()));
}

// ── Vykreslení ─────────────────────────────────────────────────
function cardHtml(c, hidden, delay, flip) {
  const style = delay ? ` style="animation-delay:${delay}ms"` : '';
  if (hidden) return `<div class="bj-card back"${style}></div>`;
  const s = suitOf(c), r = rankOf(c), red = s === '♥' || s === '♦';
  const suit = s + '︎';   // bez toho z nich telefon udělá barevné emoji
  return `<div class="bj-card${red ? ' red' : ''}${flip ? ' flip' : ''}"${style}><span class="bj-c-tl">${r}<i>${suit}</i></span><span class="bj-c-m">${suit}</span><span class="bj-c-br">${r}<i>${suit}</i></span></div>`;
}
function valText(cards) { const v = handValue(cards); return v.soft && v.t < 21 ? `${v.t - 10} / ${v.t}` : String(v.t); }
// Jen nové karty dostanou animaci, stávající se nepřekreslují
function syncCards(el, cards, hideFrom, stepMs = 0) {
  if (!cards.length) { el.innerHTML = ''; return; }
  const hidden = i => hideFrom != null && i >= hideFrom;
  [...el.children].forEach((node, i) => { if (node.classList.contains('back') && !hidden(i)) node.outerHTML = cardHtml(cards[i], false, 0, true); });
  const have = el.children.length;
  cards.slice(have).forEach((c, i) => el.insertAdjacentHTML('beforeend', cardHtml(c, hidden(have + i), i * stepMs)));
  el.dataset.n = cards.length;
}
// Karty hráče; rozdělená ruka má každou část ve vlastní skupině a ta, která se hraje, svítí
function syncHand(el, h, active) {
  const parts = partsOf(h);
  if (parts.length < 2) {
    if (el.querySelector('.bj-part')) el.innerHTML = '';
    el.classList.remove('split');
    syncCards(el, parts[0]?.cards || []);
    return;
  }
  if (!el.classList.contains('split') || el.children.length !== parts.length) {
    el.classList.add('split');
    el.innerHTML = parts.map(() => '<div class="bj-part"></div>').join('');
  }
  parts.forEach((p, i) => { const pe = el.children[i]; syncCards(pe, p.cards); pe.classList.toggle('cur', i === active); });
}
function buildSeats() {
  $('bjSeats').innerHTML = Array.from({ length: SEATS }, (_, i) => `<div class="bj-seat" data-i="${i}" style="--c:${SEAT_COLORS[i]}">
      <div class="bj-seat-cards"></div>
      <div class="bj-seat-val"></div>
      <div class="bj-stack" title=""></div>
      <div class="bj-ava"></div>
      <div class="bj-seat-name"></div>
      <div class="bj-seat-bet"></div>
    </div>`).join('');
}
// Fotku zapisuje každý sám o sobě: do stránky jde jen https adresa, jinak zůstane písmeno
function avatarHtml(p) {
  const url = String(p?.photo || '');
  const letter = esc((p?.name || '?').trim().charAt(0).toUpperCase() || '?');
  return /^https:\/\//.test(url) ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : letter;
}
function renderSeats() {
  [...$('bjSeats').children].forEach((el, i) => {
    const uid = S.seats[i], p = uid && S.players[uid], h = uid && S.hands[uid];
    el.classList.toggle('empty', !uid);
    el.classList.toggle('me', uid === me());
    el.classList.toggle('turn', !!uid && S.turn === uid);
    const cards = el.querySelector('.bj-seat-cards');
    if (el.dataset.uid !== (uid || '')) {
      el.dataset.uid = uid || '';
      el.querySelector('.bj-ava').innerHTML = uid ? avatarHtml(p) : '';
      el.querySelector('.bj-seat-name').textContent = uid ? (uid === me() ? 'Ty' : p?.name || 'Hráč') : 'Volno';
      cards.innerHTML = '';
    }
    syncHand(cards, h, S.turn === uid ? h?.cur : -1);
    el.querySelector('.bj-seat-val').textContent = played(h) ? partsOf(h).map(p => valText(p.cards)).join(' · ') : '';
    const bet = el.querySelector('.bj-seat-bet');
    // Vlastní rozestavěnou sázku vidí jen hráč, ostatním se ukáže až po vsazení
    const pending = uid === me() && !h && S.phase === 'bet' ? BET : 0;
    renderStack(el.querySelector('.bj-stack'), h ? h.bet : pending, !!pending);
    if (!h) { bet.textContent = pending ? money(pending) : uid && S.phase !== 'bet' ? 'nehraje' : ''; bet.dataset.kind = ''; return; }
    if (S.phase === 'done' && played(h)) {
      const r = outcomeAll(h, S.dealer);
      bet.textContent = r.delta ? signed(r.delta) : 'remíza';
      bet.dataset.kind = r.kind;
    } else { bet.textContent = money(h.bet); bet.dataset.kind = ''; }
  });
  $('bjSeats').dataset.n = S.seats.length;
}
// Částka jako sloupec žetonů, od největších. Dlouhý sloupec se zkrátí, přesná částka je pod ním.
function stackOf(n) {
  const out = [];
  [...CHIPS].reverse().forEach(c => { while (n >= c) { out.push(c); n -= c; } });
  if (!out.length && n > 0) out.push(CHIPS[0]);
  return out.slice(0, 9);
}
function renderStack(el, amount, undoable) {
  el.classList.toggle('undo', undoable);
  el.title = undoable ? 'Kliknutím vrátíš poslední žeton' : '';
  if (+el.dataset.v === amount) return;
  el.dataset.v = amount;
  el.innerHTML = stackOf(amount).map((c, i) => `<i style="--chip:var(--chip-${c});--k:${i}"></i>`).join('');
}
function renderMoney() {
  const b = $('bjBal');
  b.textContent = money(A.bal);
  b.classList.toggle('debt', A.bal < 0);
  $('bjStats').innerHTML = `Správně <b>${A.right}</b> · špatně <b>${A.wrong}</b> · rekord <b>${money(A.best)}</b>${A.low < 0 ? ` · největší dluh <b>${money(-A.low)}</b>` : ''}`;
}
function renderBet() {
  if (BET > A.bal) clearBet();
  $('bjBet').textContent = money(BET);
  $('bjMin').textContent = money(A.min);
  $('bjDeal').disabled = BET < A.min;
  $('bjClear').disabled = !BET;
  const again = !BET && LAST_BET >= A.min && LAST_BET <= A.bal;
  $('bjRepeat').hidden = !again;
  if (again) $('bjRepeat').textContent = `Znovu ${money(LAST_BET)}`;
  const shown = CHIPS.filter(c => c <= Math.max(A.bal, 1000));
  $('bjChips').innerHTML = shown.map(c => `<button type="button" class="bj-chip" data-chip="${c}" style="--chip:var(--chip-${c})"${c > A.bal - BET ? ' disabled' : ''} aria-label="Přidat ${money(c)}">${c >= 1000 ? c / 1000 + 'k' : c}</button>`).join('') +
    `<button type="button" class="bj-chip all" data-chip="all"${A.bal <= BET ? ' disabled' : ''}>Vše</button>`;
  if (A.bal >= A.min) return;
  // Jedna otázka vždy stačí: správně dorovná účet přesně na minimum, špatně stojí jen minimum (nikdy víc, než by přidala)
  const { gain, loss } = earnStake(), earn = `${gain},${loss}`;
  $('bjEarnH').innerHTML = `Minimální sázka je <b>${money(A.min)}</b> a ${A.bal < 0 ? `dlužíš <b>${money(-A.bal)}</b>` : `máš <b>${money(A.bal)}</b>`}. ` +
    `Správná odpověď ti přidá <b>${money(gain)}</b>${A.bal < 0 ? ', splatí celý dluh' : ''} a budeš mít přesně na minimum. Špatná tě stojí <b>${money(loss)}</b>.`;
  if ($('bjEarn').dataset.v !== earn) {
    $('bjEarn').dataset.v = earn;
    $('bjEarn').innerHTML = `<button type="button" class="btn btn-primary" data-earn="1">Odpovědět na otázku</button>`;
  }
}
const earnStake = () => { const gain = A.min - A.bal; return { gain, loss: Math.min(A.min, gain) }; };
// Co krupiér říká a co je zrovna vidět
function renderStatus() {
  const m = $('bjMsg'), now = Date.now();
  let html = MSG.html, kind = MSG.kind;
  if (S.phase === 'play' && S.turn) {
    const left = S.solo ? '' : ` (${Math.max(0, Math.ceil((S.turnAt + TURN_MS - now) / 1000))} s)`;
    const part = S.hands[S.turn]?.parts ? `, ${S.hands[S.turn].cur + 1}. ruka` : '';
    html = S.turn === me() ? `Jsi na řadě${part}${left}.` : `Hraje ${esc(S.players[S.turn]?.name || 'hráč')}${part}${left}.`;
    kind = '';
  } else if (S.phase === 'bet' && mine()) {
    html = S.betAt ? `Čekám na ostatní, rozdávám za ${Math.max(0, Math.ceil((S.betAt + BET_MS - now) / 1000))} s.` : 'Čekám na ostatní.';
    kind = '';
  } else if (S.phase === 'bet' && !html) {
    html = A.bal >= A.min ? 'Sázky, prosím.' : 'Na minimální sázku nemáš, pomůže jen otázka.';
  } else if (dealerRevealing()) {
    const shown = dealerShown();
    html = shown < 2 ? 'Tak se podíváme…' : `Mám ${valText(S.dealer.slice(0, shown))}. Beru další kartu…`;
    kind = '';
  } else if (S.phase === 'done' && played(mine()) && A.lastR !== `${S.tid}:${S.round}`) {
    html = `Mám ${valText(S.dealer)}.`;   // chvilka před vyúčtováním, ať neprobleskne zpráva z minulého kola
    kind = '';
  }
  if (m.innerHTML !== html) m.innerHTML = html;
  m.dataset.kind = kind;
  $('bjDealerFig').dataset.mood = kind;
}
function renderPanels() {
  const h = mine(), myTurn = S.turn === me();
  const canEarn = !Q && A.bal < A.min && (!h || S.phase === 'done');
  $('bjBetPanel').hidden = Q || h || S.phase !== 'bet' || A.bal < A.min;
  $('bjEarnPanel').hidden = !canEarn;
  $('bjPlayPanel').hidden = !myTurn;
  $('bjQ').hidden = !Q;
  document.querySelector('.bj-game').classList.toggle('asking', !!Q);
  if (myTurn) {
    const p = curPart(h);
    $('bjDouble').disabled = p.cards.length !== 2 || A.bal < p.bet;
    $('bjSplit').hidden = !canSplit(h);
    $('bjSplit').disabled = A.bal < h.bet;
    $('bjSplit').title = A.bal < h.bet ? `Na rozdělení potřebuješ ${money(h.bet)} na účtu` : 'Rozdělit na dvě ruce (P)';
  }
  $('bjInvite').hidden = !S.solo;
  $('bjCopy').hidden = !!S.solo;
}
// Kolik karet krupiéra je lícem nahoru. Při dohrávání přibývají po krocích podle času.
function dealerShown() {
  if (!S.dealer.length) return 0;
  if (S.hidden) return 1;
  if (S.phase !== 'done') return S.dealer.length;
  const t = Date.now() - (S.turnAt || 0);
  return t < HOLE_MS ? 1 : Math.min(S.dealer.length, 2 + Math.floor((t - HOLE_MS) / DRAW_MS));
}
const dealerRevealing = () => !!S && S.phase === 'done' && S.dealer.length > 0 && dealerShown() < S.dealer.length;
let REVEAL_T = 0, REVEAL_SEEN = '';
function renderDealer() {
  const shown = dealerShown(), cards = S.dealer.slice(0, Math.max(shown, Math.min(2, S.dealer.length)));
  syncCards($('bjDealer'), cards, shown < cards.length ? shown : null, S.phase === 'done' ? 0 : CARD_MS);
  $('bjDealerVal').textContent = shown ? valText(S.dealer.slice(0, shown)) : '';
  // Každá nově odkrytá karta cvakne; další krok se naplánuje přesně na svůj čas
  const seen = `${S.tid}:${S.round}:${shown}`;
  if (S.phase === 'done' && REVEAL_SEEN && REVEAL_SEEN !== seen && REVEAL_SEEN.startsWith(`${S.tid}:${S.round}:`)) window.sfx?.('flip');
  REVEAL_SEEN = seen;
  clearTimeout(REVEAL_T);
  if (dealerRevealing()) {
    const t = Date.now() - S.turnAt, next = shown < 2 ? HOLE_MS : HOLE_MS + (shown - 1) * DRAW_MS;
    REVEAL_T = setTimeout(render, Math.max(30, next - t + 10));
  }
}
function render() {
  if (!S) return;
  renderDealer();
  renderSeats();
  settle();
  renderMoney();
  renderBet();
  renderPanels();
  renderStatus();
}

// ── Ovládání ───────────────────────────────────────────────────
$('bjChips').addEventListener('click', e => {
  const c = e.target.closest('[data-chip]');
  if (!c || c.disabled) return;
  const add = c.dataset.chip === 'all' ? A.bal - BET : +c.dataset.chip;
  BET += add;
  BET_LOG.push(add);
  window.sfx?.('coin');
  betChanged();
});
function clearBet() { BET = 0; BET_LOG = []; }
function betChanged() { renderBet(); renderSeats(); }
$('bjClear').onclick = () => { clearBet(); betChanged(); };
$('bjRepeat').onclick = () => { BET = LAST_BET; BET_LOG = [LAST_BET]; window.sfx?.('coin'); betChanged(); };
$('bjSeats').addEventListener('click', e => {
  if (!e.target.closest('.bj-stack.undo') || !BET_LOG.length) return;
  BET -= BET_LOG.pop();
  window.sfx?.('click');
  betChanged();
});
$('bjDeal').onclick = placeBet;
$('bjHit').onclick = hit;
$('bjStand').onclick = stand;
$('bjDouble').onclick = doubleDown;
$('bjSplit').onclick = splitHand;
$('bjInvite').onclick = openToFriends;
$('bjCopy').onclick = copyLink;
$('bjLeave').onclick = leaveTable;
$('bjEarn').addEventListener('click', e => {
  const b = e.target.closest('[data-earn]');
  if (b && !Q && A.bal < A.min) ask(earnStake());
});

// ── Otázka ─────────────────────────────────────────────────────
function nextCard() {
  if (!QUEUE.length) QUEUE = shuffle(POOL);
  return QUEUE.shift();
}
function ask({ gain, loss }) {
  const card = nextCard(), opt = mcOptions(card, POOL_ALL);
  Q = { gain, loss, card, ...opt, done: false };
  $('bjQStake').innerHTML = `Otázka o <b>${money(gain)}</b><small>Špatná odpověď: ${signed(-loss)}</small>`;
  $('bjQuestion').innerHTML = mcQuestionHtml(card) + `<div class="mil-deck">${esc(card.deckName)}</div>`;
  $('bjAnswers').innerHTML = opt.opts.map((t, k) => `<button type="button" class="mil-ans${card.cl ? ' is-code' : ''}" data-k="${k}"><i>${'ABCD'[k]}</i><span>${mcOptionHtml(card, t)}</span></button>`).join('');
  $('bjNext').hidden = true;
  renderPanels();
  $('bjQ').scrollIntoView({ block: 'nearest' });
}
$('bjAnswers').addEventListener('click', e => {
  const b = e.target.closest('[data-k]');
  if (b) answer(+b.dataset.k);
});
function answer(k) {
  if (!Q || Q.done) return;
  Q.done = true;
  const btns = [...$('bjAnswers').children], right = k === Q.correct;
  btns[Q.correct].classList.add('right');
  if (!right) btns[k].classList.add('wrong');
  btns.forEach(b => { b.disabled = true; });
  A.bal += right ? Q.gain : -Q.loss;
  if (right) { A.right++; recordPlayPoints(1); } else {
    A.wrong++;
    // Špatně zodpovězená karta se brzy vrátí
    QUEUE.splice(Math.min(4, QUEUE.length), 0, Q.card);
  }
  saveAccount();
  renderMoney();
  window.sfx?.(right ? 'ok' : 'bad');
  const text = right ? `Správně! <b>${signed(Q.gain)}</b>` : `Špatně, <b>${signed(-Q.loss)}</b>${A.bal < 0 ? ` · dlužíš ${money(-A.bal)}` : ''}`;
  MSG = { html: text, kind: right ? 'good' : 'bad' };
  renderStatus();
  $('bjQStake').innerHTML = text;
  $('bjNext').hidden = false;
  $('bjNext').focus();
}
$('bjNext').onclick = () => {
  if (!Q?.done) return;
  Q = null;
  if (A.bal >= A.min) MSG = { html: '', kind: '' };
  render();
};

// ── Klávesnice ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ($('bjGame').hidden || !S || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea')) return;
  const key = e.key.toLowerCase();
  if (Q && !Q.done && /^[1-4]$/.test(key)) answer(+key - 1);
  else if (S.turn === me()) {
    if (key === 'h') hit(); else if (key === 's') stand(); else if (key === 'd') doubleDown(); else if (key === 'p' && !$('bjSplit').hidden) splitHand();
  } else if (S.phase === 'bet' && !Q && key === 'enter' && e.target.tagName !== 'BUTTON') placeBet();
});

// ═══ milionar.js — Chcete být milionářem? z vlastních kartiček
// 15 otázek, obtížnost roste: nejdřív karty, které už umíš (vysoká krabička
// z učení), na konec ty, které ti nejdou nebo jsi je ještě neviděl.
// Jistoty na 5. a 10. otázce, nápovědy 50:50 / publikum / přítel.
const LADDER = [1000, 2000, 3000, 5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 1250000, 2500000, 5000000, 10000000];
const SAFE = new Set([4, 9]);          // index otázky, po které je částka jistá
const money = n => n.toLocaleString('cs-CZ') + ' Kč';
const SEL_KEY = 'mil_decks', BEST_KEY = 'mil_best';

let DECKS = [], G = null;   // G = { qs:[{card, opts, correct}], i, used:{}, locked, removed:Set }

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (e) { $('milDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  renderDecks();
});

function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (_) { /* nic */ }
  $('milBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${money(best)}</b>` : '';
}

function savedSel() { try { return new Set(JSON.parse(localStorage.getItem(SEL_KEY) || '[]')); } catch (_) { return new Set(); } }
function renderDecks() {
  const el = $('milDecks');
  if (!DECKS.length) { el.innerHTML = '<div class="mc-muted">Nemáš žádné balíčky s kartičkami. Vytvoř si nějaký ve Flash Cards.</div>'; return; }
  const sel = savedSel();
  el.innerHTML = mcDeckListHTML(DECKS, sel);
  el.addEventListener('change', updateStart);
  mcWireDeckAll(el, $('milAll'), updateStart, DECKS);
  $('milStart').onclick = startGame;
  updateStart();
}
function chosenDecks() { return [...document.querySelectorAll('#milDecks input:checked')].map(i => DECKS.find(d => d.id === i.value)).filter(Boolean); }
function updateStart() {
  const ds = chosenDecks(), n = ds.reduce((s, d) => s + (d.cardCount || 0), 0);
  $('milStart').disabled = !ds.length;
  $('milHint').textContent = ds.length ? (n < 15 ? `Vybrané balíčky mají jen ${n} karet — hra bude mít méně otázek.` : `${n} karet k dispozici.`) : 'Vyber aspoň jeden balíček.';
}

async function startGame() {
  const ds = chosenDecks();
  try { localStorage.setItem(SEL_KEY, JSON.stringify(ds.map(d => d.id))); } catch (_) { /* nic */ }
  const btn = $('milStart');
  btn.disabled = true; btn.textContent = 'Připravuji otázky…';
  try {
    const [pool, boxes] = await Promise.all([mcLoadCards(ds), mcLearnBoxes()]);
    FRIENDS_P = loadFriendLearn();   // pro „Zavolat příteli“ — načítá se na pozadí
    // obtížnost: neznámá karta ~ krabička 2, umím (5) = lehká
    const scored = pool.map(c => ({ c, d: (5 - (boxes[c.id] ?? 2.5)) + Math.random() * 1.6 }))
      .map(x => ({ ...x, o: mcOptions(x.c, pool) })).filter(x => x.o)
      .sort((a, b) => a.d - b.d);
    if (scored.length < 3) { toast('Z vybraných balíčků nejde sestavit otázky s možnostmi — přidej balíček s víc kartami.'); return; }
    const n = Math.min(15, scored.length);
    const picks = Array.from({ length: n }, (_, i) => scored[Math.round(i * (scored.length - 1) / Math.max(1, n - 1))]);
    const ladder = LADDER.slice(LADDER.length - n);   // kratší hra = nižší start, milion zůstává nahoře
    G = { qs: picks.map(x => ({ card: x.c, ...x.o })), ladder, i: 0, used: {}, locked: false, removed: new Set() };
    $('milSetup').hidden = true; $('milEnd').hidden = true; $('milGame').hidden = false;
    renderLadder(); renderQ();
  } catch (e) {
    toast('Nepovedlo se: ' + e.message);
  } finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

const safeIdx = i => { const n = G.qs.length, off = 15 - n; return SAFE.has(i + off); };
function guaranteed(i) {   // co mám jisté, když spletu otázku i
  for (let k = i - 1; k >= 0; k--) if (safeIdx(k)) return G.ladder[k];
  return 0;
}
function renderLadder() {
  $('milLadder').innerHTML = G.ladder.map((v, k) => `<li class="${k === G.i ? 'cur' : k < G.i ? 'done' : ''}${safeIdx(k) ? ' safe' : ''}"><span>${k + 1}</span>${money(v)}</li>`).reverse().join('');
}
function renderQ() {
  const q = G.qs[G.i];
  G.locked = false; G.removed = new Set();
  $('milQn').textContent = `Otázka ${G.i + 1} z ${G.qs.length}`;
  $('milFor').innerHTML = `za <b>${money(G.ladder[G.i])}</b>${safeIdx(G.i) ? ' · 🔒 jistota' : ''}`;
  $('milQuestion').innerHTML = mcQuestionHtml(q.card) + `<div class="mil-deck">${esc(q.card.deckName)}</div>`;
  $('milAnswers').innerHTML = q.opts.map((o, k) => `<button type="button" class="mil-ans${q.card.cl ? ' is-code' : ''}" data-k="${k}"><i>${'ABCD'[k]}</i><span>${mcOptionHtml(q.card, o)}</span></button>`).join('');
  $('milAnswers').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
  $('milHelp').innerHTML = '';
  $('life50').disabled = !!G.used.f; $('lifeAud').disabled = !!G.used.a; $('lifePhone').disabled = !!G.used.p;
  $('life50').onclick = use5050; $('lifeAud').onclick = useAudience; $('lifePhone').onclick = usePhone;
  const have = G.i ? G.ladder[G.i - 1] : 0;
  $('milQuit').textContent = have ? `Odstoupit s ${money(have)}` : 'Odstoupit';
  $('milQuit').onclick = () => { if (!G.locked && confirm(have ? `Opravdu odstoupit a odejít s ${money(have)}?` : 'Opravdu skončit?')) endGame('quit', have); };
  renderLadder();
}

function answer(k) {
  if (G.locked || G.removed.has(k)) return;
  G.locked = true;
  const q = G.qs[G.i];
  const btns = [...$('milAnswers').children];
  btns[k].classList.add('picked');
  window.sfx?.('click');
  setTimeout(() => {
    btns[q.correct].classList.add('right');
    window.sfx?.(k === q.correct ? 'coin' : 'bad');
    if (k !== q.correct) btns[k].classList.add('wrong');
    setTimeout(() => {
      if (k !== q.correct) return endGame('wrong', guaranteed(G.i), q);
      if (G.i === G.qs.length - 1) return endGame('win', G.ladder[G.i]);
      G.i++;
      renderQ();
    }, k === q.correct ? 1300 : 2600);
  }, 1100);
}

// ── Nápovědy ───────────────────────────────────────────────────
// Publikum a přítel nevědí víc než ty: čím těžší otázka, tím méně jistě.
const knowP = () => Math.max(0.35, 0.92 - G.i * 0.04);
function use5050() {
  if (G.used.f || G.locked) return;
  G.used.f = true;
  window.sfx?.('hint');
  const q = G.qs[G.i];
  const wrong = shuffle(q.opts.map((_, k) => k).filter(k => k !== q.correct && !G.removed.has(k))).slice(0, 2);
  wrong.forEach(k => { G.removed.add(k); const b = $('milAnswers').children[k]; b.classList.add('gone'); b.disabled = true; });
  $('life50').disabled = true;
}
function useAudience() {
  if (G.used.a || G.locked) return;
  G.used.a = true;
  window.sfx?.('hint');
  const q = G.qs[G.i];
  const live = q.opts.map((_, k) => k).filter(k => !G.removed.has(k));
  const w = {};
  live.forEach(k => { w[k] = Math.random() * (1 - knowP()) + 0.05; });
  w[q.correct] += knowP() * (0.8 + Math.random() * 0.5);
  const sum = live.reduce((s, k) => s + w[k], 0);
  const pct = {}; let left = 100;
  live.forEach((k, i) => { pct[k] = i === live.length - 1 ? left : Math.round(w[k] / sum * 100); left -= pct[k]; });
  $('milHelp').innerHTML = `<div class="mil-aud">${q.opts.map((_, k) => `<div class="mil-bar"><i style="height:${pct[k] || 0}%"></i><b>${pct[k] ?? 0} %</b><span>${'ABCD'[k]}</span></div>`).join('')}</div>`;
  $('lifeAud').disabled = true;
}
// Zavolat příteli: přátelé a jejich učení (krabičky kartiček) se načtou na pozadí při startu hry.
let FRIENDS_P = null;
async function loadFriendLearn() {
  try {
    const uids = (await mcFriends()).slice(0, 40);
    const docs = await Promise.all(uids.map(u => db.collection('users').doc(u).get().catch(() => null)));
    return docs.filter(d => d?.exists).map(d => ({ name: d.data().displayName || 'Přítel', learn: d.data().learn || {} }));
  } catch (_) { return []; }
}
const BOX_P = [0.3, 0.45, 0.65, 0.8, 0.9, 0.97];   // jak pravděpodobně přítel trefí správnou podle krabičky 0–5
// Jako v show: nejdřív si vybereš, komu zavoláš (jen jména — kdo co umí, se dozvíš až z hovoru).
async function usePhone() {
  if (G.used.p || G.locked) return;
  G.used.p = true;
  window.sfx?.('hint');
  $('lifePhone').disabled = true;
  const q = G.qs[G.i];
  const live = q.opts.map((_, k) => k).filter(k => !G.removed.has(k));
  $('milHelp').innerHTML = '<div class="mil-phone">📞 <span>Načítám kontakty…</span></div>';
  const friends = [...await (FRIENDS_P || [])].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  if (G.locked || G.qs[G.i] !== q) return;   // mezitím už odpovězeno
  $('milHelp').innerHTML = `<div class="mil-phone mil-call"><div class="mil-call-h">📞 Komu zavoláš?</div><div class="mil-call-list">
    ${friends.map((f, i) => `<button type="button" class="btn btn-secondary" data-call="${i}">${esc(f.name)}</button>`).join('')}
    <button type="button" class="btn btn-ghost" data-call="rnd">🎲 Náhodný kamarád</button></div>
    ${friends.length ? '' : '<small class="mil-phone-why">Zatím nemáš přátele — přidáš je na hlavní stránce v záložce Přátelé.</small>'}</div>`;
  $('milHelp').querySelectorAll('[data-call]').forEach(btn => btn.onclick = () => {
    if (G.locked || G.qs[G.i] !== q) return;
    window.sfx?.('click');
    if (btn.dataset.call === 'rnd') return phoneRandom(q, live, '');
    phoneFriend(q, live, friends[+btn.dataset.call]);
  });
}
// Odpověď vybraného přítele podle jeho učení: krabička té kartičky → jak moc si je jistý
function phoneFriend(q, live, who) {
  const box = who.learn[q.card.deckId]?.cards?.[q.card.id]?.box || 0;
  const known = Object.values(who.learn[q.card.deckId]?.cards || {}).filter(e => (e.box || 0) >= 4).length;
  const p = box ? BOX_P[box] : known ? 0.5 : 0.3;
  const right = Math.random() < p;
  const pick = right ? q.correct : shuffle(live.filter(k => k !== q.correct))[0];
  const L = '<b>' + 'ABCD'[pick] + '</b>';
  const say = p >= 0.9 ? `Tohle vím jistě. Je to ${L}.` : p >= 0.75 ? `Myslím, že ${L}. Tohle jsem se učil(a).` : p >= 0.5 ? `Možná ${L}… ale nejsem si jistý/á.` : `Tohle jsem nikdy neučil(a). Tipnul(a) bych ${L}, ale neber mě za slovo.`;
  // proč si je přítel jistý, se neprozrazuje — jako v show: věříš mu, nebo ne
  $('milHelp').innerHTML = `<div class="mil-phone">📞 <span><b>${esc(who.name)}</b>: ${say}</span></div>`;
}
function phoneRandom(q, live, note) {
  const right = Math.random() < knowP();
  const pick = right ? q.correct : shuffle(live.filter(k => k !== q.correct))[0];
  const sure = right ? Math.round(55 + Math.random() * 40 - G.i * 2) : Math.round(30 + Math.random() * 35);
  const say = sure > 80 ? `Tohle vím. Je to <b>${'ABCD'[pick]}</b>.` : sure > 55 ? `Myslím, že <b>${'ABCD'[pick]}</b>… tak na ${sure} %.` : `Hele, nevím jistě. Tipnul bych <b>${'ABCD'[pick]}</b>, ale neber mě za slovo.`;
  $('milHelp').innerHTML = `<div class="mil-phone">📞 <span>${say}${note ? `<small class="mil-phone-why">${note}</small>` : ''}</span></div>`;
}

// ── Konec hry ──────────────────────────────────────────────────
function endGame(how, won, q) {
  $('milGame').hidden = true; $('milEnd').hidden = false;
  window.sfx?.(how === 'wrong' ? 'lose' : 'win');
  const reached = how === 'win' ? G.qs.length : G.i;
  let best = 0;
  try { best = +localStorage.getItem(BEST_KEY) || 0; if (won > best) localStorage.setItem(BEST_KEY, String(won)); } catch (_) { /* nic */ }
  const pts = reached * 2 + (how === 'win' && G.qs.length === 15 ? 20 : 0);
  recordPlayPoints(pts);
  $('milEndIco').textContent = how === 'win' ? '🏆' : how === 'quit' ? '💼' : '💸';
  $('milEndTitle').textContent = how === 'win' ? (G.qs.length === 15 ? 'Jsi milionář!' : 'Všechno správně!') : how === 'quit' ? 'Rozumné rozhodnutí' : 'Bohužel špatně';
  $('milEndDesc').innerHTML = how === 'wrong' && q
    ? `Správně bylo: <b>${esc(q.opts[q.correct])}</b>.<br>Otázek správně: ${reached} z ${G.qs.length}.`
    : `Otázek správně: ${reached} z ${G.qs.length}.`;
  $('milEndWin').innerHTML = `Odcházíš s <b>${money(won)}</b>${won > best ? '<em>🎉 nový rekord</em>' : ''}<small>+${pts} b do žebříčku týdne</small>`;
  $('milAgain').onclick = () => { $('milEnd').hidden = true; $('milSetup').hidden = false; showBest(); };
}

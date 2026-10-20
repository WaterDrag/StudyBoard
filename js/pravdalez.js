// ═══ pravdalez.js — Pravda, nebo lež? (60 s, švihání / šipky)
// Polovina tvrzení má správnou odpověď (nebo jinou správnou z „také správně“),
// polovina podstrčenou — nejdřív špatné odpovědi z kvízu u té karty, jinak
// podobná odpověď jiné karty. Série 3 správných = násobič o stupeň výš (max ×4).
const TF_TIME = 60e3, TF_BEST = 'tf_best';
let DECKS = [], pickDecks = () => [], T = null;

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (_) { $('tfDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'tfDecks', all: 'tfAll', start: 'tfStart', hint: 'tfHint', key: 'tf_decks', decks: DECKS });
  $('tfStart').onclick = startGame;
});
function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(TF_BEST) || 0; } catch (_) { /* nic */ }
  $('tfBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best.toLocaleString('cs-CZ')} b</b>` : '';
}

async function startGame() {
  const ds = pickDecks();
  const btn = $('tfStart');
  btn.disabled = true; btn.textContent = 'Míchám…';
  try {
    const pool = await mcLoadCards(ds);
    if (pool.length < 4) { toast('Na hru je potřeba aspoň pár kartiček.'); return; }
    T = { pool, deck: shuffle(pool), next: 0, endAt: Date.now() + TF_TIME, score: 0, ok: 0, n: 0, streak: 0, bestStreak: 0, mult: 1, misses: [], busy: false, over: false };
    $('tfSetup').hidden = true; $('tfEnd').hidden = true; $('tfGame').hidden = false;
    nextStatement();
    clearInterval(T.timer);
    T.timer = setInterval(tick, 100);
    tick();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function lieFor(card) {
  const w = shuffle(card.w.filter(x => !card.ok.has(x)));
  if (w.length) return w[0];
  const o = mcOptions(card, T.pool);
  return o ? o.opts.find((x, i) => i !== o.correct) : null;
}
function nextStatement() {
  if (T.next >= T.deck.length) { T.deck = shuffle(T.pool); T.next = 0; }
  const card = T.deck[T.next++];
  let truth = Math.random() < 0.5, shown;
  if (!truth) { shown = lieFor(card); if (!shown) truth = true; }
  if (truth) { const oks = [...card.ok]; shown = Math.random() < 0.75 ? card.b : oks[Math.floor(Math.random() * oks.length)]; }
  T.cur = { card, shown, truth };
  const el = $('tfCard');
  el.className = 'tf-card in';
  el.style.transform = '';
  $('tfQ').innerHTML = mcQuestionHtml(card);
  $('tfA').innerHTML = mcOptionHtml(card, shown);
  $('tfDeck').textContent = card.deckName;
  $('tfStamp').textContent = '';
}

function answer(saysTrue) {
  if (!T || T.over || T.busy) return;
  const c = T.cur, right = saysTrue === c.truth;
  T.n++;
  const el = $('tfCard'), stamp = $('tfStamp');
  el.classList.remove('in');
  if (right) {
    T.ok++; T.streak++;
    T.bestStreak = Math.max(T.bestStreak, T.streak);
    T.mult = Math.min(4, 1 + Math.floor(T.streak / 3));
    T.score += 100 * T.mult;
    window.sfx?.(T.mult > 1 ? 'combo' : 'ok', { n: T.mult });
    el.classList.add(saysTrue ? 'fly-r' : 'fly-l');
    setTimeout(() => { if (!T.over) nextStatement(); }, 230);
  } else {
    T.streak = 0; T.mult = 1;
    T.misses.push(c);
    window.sfx?.('bad');
    // Chyba: ukázat, jak to je, a na tu chvíli zastavit čas.
    T.busy = true;
    const pausedAt = T.pausedAt = Date.now();
    el.classList.add('wrong');
    stamp.innerHTML = c.truth ? 'Byla to <b>pravda</b>' : `Lež — správně je: <b>${esc(c.card.b)}</b>`;
    setTimeout(() => {
      T.endAt += Date.now() - pausedAt;
      T.busy = false;
      if (!T.over) nextStatement();
    }, c.truth ? 1100 : 1900);
  }
  hud();
}

function hud() {
  $('tfScore').textContent = T.score.toLocaleString('cs-CZ') + ' b';
  const c = $('tfCombo');
  c.textContent = T.mult > 1 ? `×${T.mult} · série ${T.streak}` : (T.streak ? `série ${T.streak}` : '');
  c.className = 'sp-combo m' + Math.min(5, T.mult + (T.mult > 1 ? 1 : 0));
}
function tick() {
  if (!T || T.over) return;
  const left = Math.max(0, T.endAt - (T.busy ? T.pausedAt : Date.now()));   // při chybě čas stojí
  $('tfTime').textContent = Math.ceil(left / 1000) + ' s';
  const bar = $('tfBar');
  bar.style.width = (left / TF_TIME * 100) + '%';
  bar.classList.toggle('low', left < 10e3);
  const sec = Math.ceil(left / 1000);
  if (!T.busy && left && left < 5000 && sec !== T.lastTick) { T.lastTick = sec; window.sfx?.('tick'); }
  if (!left && !T.busy) endGame();
}

// Ovládání: tlačítka, šipky, švihnutí
$('tfTruth').onclick = () => answer(true);
$('tfLie').onclick = () => answer(false);
document.addEventListener('keydown', e => {
  if (!T || $('tfGame').hidden) return;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); answer(true); }
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); answer(false); }
});
(function swipe() {
  const el = $('tfCard');
  let x0 = null, dx = 0;
  el.addEventListener('pointerdown', e => { if (T?.busy || T?.over) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
  el.addEventListener('pointermove', e => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    el.classList.toggle('lean-r', dx > 40); el.classList.toggle('lean-l', dx < -40);
  });
  const up = () => {
    if (x0 === null) return;
    x0 = null;
    el.classList.remove('drag', 'lean-r', 'lean-l');
    if (Math.abs(dx) > 80) answer(dx > 0);
    else el.style.transform = '';
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
})();

function endGame() {
  if (T.over) return;
  T.over = true;
  window.sfx?.('win');
  clearInterval(T.timer);
  let best = 0;
  try { best = +localStorage.getItem(TF_BEST) || 0; if (T.score > best) localStorage.setItem(TF_BEST, String(T.score)); } catch (_) { /* nic */ }
  recordPlayPoints(T.ok);
  $('tfGame').hidden = true; $('tfEnd').hidden = false;
  $('tfEndIco').textContent = T.score > best ? '🎉' : '⏱️';
  const acc = T.n ? Math.round(T.ok / T.n * 100) : 0;
  $('tfResult').innerHTML = `<b>${T.score.toLocaleString('cs-CZ')} b</b><span>${T.ok} z ${T.n} správně (${acc} %) · nejdelší série ${T.bestStreak}</span>`
    + (T.score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '') + `<span>+${T.ok} b do žebříčku týdne</span>`;
  const seen = new Set();
  const miss = T.misses.filter(m => { const k = m.card.deckId + m.card.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  $('tfReview').innerHTML = miss.length ? '<div class="day-rank-h">Tady ses spletl(a)</div>' + miss.map(m => `<div class="sp-rev"><b>${esc(m.card.f)}</b><span>✓ ${esc(m.card.b)}${m.truth ? '' : ` <s>${esc(m.shown)}</s>`}</span></div>`).join('') : '';
  $('tfAgain').onclick = () => { $('tfEnd').hidden = true; $('tfSetup').hidden = false; showBest(); };
}

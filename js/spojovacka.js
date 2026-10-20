// ═══ spojovacka.js — Spojovačka na čas: pojem ↔ odpověď
// Na ploše je 6 dvojic (vlevo pojmy, vpravo odpovědi, každá strana zamíchaná).
// Vyčištěná plocha = +5 s a nová várka. Správná spojení rychle za sebou
// zvedají násobič (×1 → ×5), chyba ho shodí a vezme 3 s.
const SP_TIME = 60e3, SP_PAIRS = 6, SP_BONUS = 5e3, SP_PENALTY = 3e3, SP_COMBO_MS = 4000;
const SP_BEST = 'spoj_best';
let DECKS = [], pickDecks = () => [], S = null;

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (_) { $('spDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'spDecks', all: 'spAll', start: 'spStart', hint: 'spHint', key: 'spoj_decks', decks: DECKS });
  $('spStart').onclick = startGame;
});

function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(SP_BEST) || 0; } catch (_) { /* nic */ }
  $('spBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best.toLocaleString('cs-CZ')} b</b>` : '';
}

const normKey = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim();
async function startGame() {
  const ds = pickDecks();
  const btn = $('spStart');
  btn.disabled = true; btn.textContent = 'Míchám kartičky…';
  try {
    const all = await mcLoadCards(ds);
    // Na dlaždičku se vejde krátký pojem a krátká odpověď; kód sem nepatří.
    const seenF = new Set(), seenB = new Set();
    const pool = shuffle(all.filter(c => !c.fl && !c.cl && c.f.length <= 90 && c.b.length <= 140)).filter(c => {
      const f = normKey(c.f), b = normKey(c.b);
      if (seenF.has(f) || seenB.has(b)) return false;
      seenF.add(f); seenB.add(b); return true;
    });
    if (pool.length < 3) { toast('Vybrané balíčky nemají dost krátkých kartiček na spojovačku.'); return; }
    S = { pool, next: 0, endAt: Date.now() + SP_TIME, score: 0, pairs: 0, mult: 1, maxMult: 1, lastOk: 0, wrong: 0, miss: new Map(), sel: null, left: 0, over: false };
    $('spSetup').hidden = true; $('spEnd').hidden = true; $('spGame').hidden = false;
    deal();
    clearInterval(S.timer);
    S.timer = setInterval(tick, 100);
    tick();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function deal() {
  if (S.next >= S.pool.length) return endGame(true);
  const cards = S.pool.slice(S.next, S.next + SP_PAIRS);
  S.next += cards.length;
  S.left = cards.length;
  S.sel = null;
  const tile = (c, side) => `<button type="button" class="sp-tile" data-id="${c.deckId}/${c.id}" data-side="${side}"><span>${esc(side === 'f' ? c.f : c.b)}</span></button>`;
  const left = shuffle(cards);
  // pravá strana tak, aby odpověď nestála na stejném řádku jako její pojem
  let right = shuffle(cards);
  for (let t = 0; t < 30 && cards.length > 1 && right.some((c, i) => c === left[i]); t++) right = shuffle(cards);
  $('spLeft').innerHTML = left.map(c => tile(c, 'f')).join('');
  $('spRight').innerHTML = right.map(c => tile(c, 'b')).join('');
  S.byId = new Map(cards.map(c => [c.deckId + '/' + c.id, c]));
  $('spBoard').querySelectorAll('.sp-tile').forEach(b => b.addEventListener('click', () => pick(b)));
}

function pick(b) {
  if (S.over || b.classList.contains('ok')) return;
  const prev = S.sel;
  if (!prev || prev === b || prev.dataset.side === b.dataset.side) {
    prev?.classList.remove('sel');
    S.sel = prev === b ? null : b;
    S.sel?.classList.add('sel');
    if (S.sel) window.sfx?.('click');
    return;
  }
  prev.classList.remove('sel');
  S.sel = null;
  if (prev.dataset.id === b.dataset.id) {
    const now = Date.now();
    S.mult = S.lastOk && now - S.lastOk < SP_COMBO_MS ? Math.min(5, S.mult + 1) : 1;
    S.maxMult = Math.max(S.maxMult, S.mult);
    S.lastOk = now;
    S.score += 100 * S.mult;
    window.sfx?.(S.mult > 1 ? 'combo' : 'ok', { n: S.mult });
    S.pairs++;
    [prev, b].forEach(x => { x.classList.add('ok'); x.disabled = true; });
    pop(b, `+${100 * S.mult}`);
    if (--S.left === 0) {
      S.endAt += SP_BONUS;
      window.sfx?.('coin');
      pop($('spTime'), '+5 s');
      setTimeout(() => { if (!S.over) deal(); }, 450);
    }
  } else {
    S.mult = 1; S.lastOk = 0; S.wrong++;
    window.sfx?.('bad');
    S.endAt -= SP_PENALTY;
    // „spletl jsem si“ se počítá oběma kartám, ať je vidíš v opakování
    [prev, b].forEach(x => {
      const id = x.dataset.id; S.miss.set(id, (S.miss.get(id) || 0) + 1);
      x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad');
    });
    pop($('spTime'), '−3 s', true);
  }
  hud();
}

// Vyskakovací „+200“ u dlaždice
function pop(el, text, bad) {
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'sp-pop' + (bad ? ' bad' : '');
  p.textContent = text;
  p.style.left = (r.left + r.width / 2) + 'px';
  p.style.top = (r.top + window.scrollY) + 'px';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

function hud() {
  $('spScore').textContent = S.score.toLocaleString('cs-CZ') + ' b';
  const c = $('spCombo');
  c.textContent = S.mult > 1 ? `×${S.mult} kombo` : '';
  c.className = 'sp-combo m' + S.mult;
}
function tick() {
  if (!S || S.over) return;
  const left = Math.max(0, S.endAt - Date.now());
  $('spTime').textContent = Math.ceil(left / 1000) + ' s';
  const bar = $('spBar');
  bar.style.width = Math.min(100, left / SP_TIME * 100) + '%';
  bar.classList.toggle('low', left < 10e3);
  const sec = Math.ceil(left / 1000);
  if (left && left < 5000 && sec !== S.lastTick) { S.lastTick = sec; window.sfx?.('tick'); }
  // násobič vyprchá, když dlouho nic nespojíš
  if (S.mult > 1 && Date.now() - S.lastOk > SP_COMBO_MS) { S.mult = 1; hud(); }
  if (!left) endGame(false);
}

function endGame(allDone) {
  if (S.over) return;
  S.over = true;
  window.sfx?.('win');
  clearInterval(S.timer);
  // Všechno spojeno před koncem: zbylý čas = bonus
  const leftS = allDone ? Math.ceil(Math.max(0, S.endAt - Date.now()) / 1000) : 0;
  S.score += leftS * 20;
  let best = 0;
  try { best = +localStorage.getItem(SP_BEST) || 0; if (S.score > best) localStorage.setItem(SP_BEST, String(S.score)); } catch (_) { /* nic */ }
  recordPlayPoints(S.pairs);
  $('spGame').hidden = true; $('spEnd').hidden = false;
  $('spEndIco').textContent = allDone ? '🏆' : S.score > best ? '🎉' : '⏱️';
  $('spEndTitle').textContent = allDone ? 'Všechno spojeno!' : 'Čas vypršel';
  const acc = S.pairs + S.wrong ? Math.round(S.pairs / (S.pairs + S.wrong) * 100) : 0;
  $('spResult').innerHTML = `<b>${S.score.toLocaleString('cs-CZ')} b</b><span>${S.pairs} dvojic · ${acc} % bez chyby · nejvyšší kombo ×${S.maxMult}${leftS ? ` · +${leftS * 20} b za zbylý čas` : ''}</span>`
    + (S.score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '') + `<span>+${S.pairs} b do žebříčku týdne</span>`;
  const byKey = new Map(S.pool.map(c => [c.deckId + '/' + c.id, c]));
  const missed = [...S.miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => byKey.get(k)).filter(Boolean);
  $('spReview').innerHTML = missed.length ? `<div class="day-rank-h">Tyhle tě potrápily</div>` + missed.map(c => `<div class="sp-rev"><b>${esc(c.f)}</b><span>${esc(c.b)}</span></div>`).join('') : '';
  $('spAgain').onclick = () => { $('spEnd').hidden = true; $('spSetup').hidden = false; showBest(); };
}

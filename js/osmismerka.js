// ═══ osmismerka.js — Osmisměrka z pojmů kartiček
// Mřížka 12×12, pojmy (bez háčků, VELKÝMI, víceslovné slité) v 8 směrech.
// Hledá se podle otázky / definice, ne podle vypsaného slova.
const WS_N = 12, WS_WORDS = 10, WS_BEST = 'ws_best';
const WS_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];
const WS_FILL = 'AAAAAEEEEEIIIIOOOOOUUNNNNTTTTSSSSRRRLLLKKKVVVMMMPPPDDDJJCCHHBBZZYYG';
const WS_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16', '#f97316', '#14b8a6'];
let DECKS = [], pickDecks = () => [], W = null;

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (_) { $('wsDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'wsDecks', all: 'wsAll', start: 'wsStart', hint: 'wsHint', key: 'ws_decks', decks: DECKS });
  $('wsStart').onclick = startGame;
});
function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(WS_BEST) || 0; } catch (_) { /* nic */ }
  $('wsBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best} b</b>` : '';
}

// Rozmístění: nejdelší slova první, pro každé zkusí náhodné pozice a směry,
// křížit se smí jen na stejném písmenu.
function buildGrid(terms) {
  const g = Array.from({ length: WS_N }, () => Array(WS_N).fill(''));
  const placed = [];
  for (const t of terms.slice().sort((a, b) => b.grid.length - a.grid.length)) {
    if (placed.length >= WS_WORDS) break;
    const w = t.grid;
    for (let tries = 0; tries < 300; tries++) {
      const [dx, dy] = WS_DIRS[Math.floor(Math.random() * WS_DIRS.length)];
      const x0 = Math.floor(Math.random() * WS_N), y0 = Math.floor(Math.random() * WS_N);
      const x1 = x0 + dx * (w.length - 1), y1 = y0 + dy * (w.length - 1);
      if (x1 < 0 || x1 >= WS_N || y1 < 0 || y1 >= WS_N) continue;
      let ok = true;
      for (let i = 0; i < w.length && ok; i++) { const c = g[y0 + dy * i][x0 + dx * i]; if (c && c !== w[i]) ok = false; }
      if (!ok) continue;
      const cells = [];
      for (let i = 0; i < w.length; i++) { g[y0 + dy * i][x0 + dx * i] = w[i]; cells.push((y0 + dy * i) * WS_N + x0 + dx * i); }
      placed.push({ ...t, cells, found: false });
      break;
    }
  }
  for (let y = 0; y < WS_N; y++) for (let x = 0; x < WS_N; x++) if (!g[y][x]) g[y][x] = WS_FILL[Math.floor(Math.random() * WS_FILL.length)];
  return { g, placed: shuffle(placed) };
}

async function startGame() {
  const ds = pickDecks();
  const btn = $('wsStart');
  btn.disabled = true; btn.textContent = 'Skládám mřížku…';
  try {
    const terms = shuffle(mcGridTerms(await mcLoadCards(ds), 3, WS_N));
    if (terms.length < 3) { toast('Vybrané balíčky nemají dost krátkých pojmů na osmisměrku.'); return; }
    const { g, placed } = buildGrid(terms.slice(0, 30));
    W = { g, words: placed, t0: Date.now(), hints: 0, sel: null, over: false };
    $('wsSetup').hidden = true; $('wsEnd').hidden = true; $('wsGame').hidden = false;
    render();
    clearInterval(W.timer);
    W.timer = setInterval(() => { const s = Math.floor((Date.now() - W.t0) / 1000); $('wsClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function render() {
  const grid = $('wsGrid');
  grid.style.setProperty('--n', WS_N);
  grid.innerHTML = W.g.flat().map((ch, i) => `<div class="ws-cell" data-i="${i}">${ch}</div>`).join('');
  $('wsClues').innerHTML = W.words.map((w, k) => `<li data-k="${k}"><span class="ws-dot" style="--c:${WS_COLORS[k % WS_COLORS.length]}"></span><span class="ws-clue">${esc(w.clue.length > 140 ? w.clue.slice(0, 137) + '…' : w.clue)}</span><span class="ws-len">${w.grid.length} písmen</span></li>`).join('');
  updateCount();
  wireSelect(grid);
}
function updateCount() { $('wsCount').textContent = `${W.words.filter(w => w.found).length} / ${W.words.length}`; }

// Výběr: tažení od-do, nebo dvě klepnutí. Platí jen rovné čáry (8 směrů).
function lineCells(a, b) {
  const ax = a % WS_N, ay = Math.floor(a / WS_N), bx = b % WS_N, by = Math.floor(b / WS_N);
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay), len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  if (!(ax === bx || ay === by || Math.abs(bx - ax) === Math.abs(by - ay))) return null;
  return Array.from({ length: len + 1 }, (_, i) => (ay + dy * i) * WS_N + ax + dx * i);
}
function wireSelect(grid) {
  let start = null, dragging = false, moved = false;
  const cellAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el?.classList?.contains('ws-cell') ? +el.dataset.i : null; };
  const paint = cells => {
    grid.querySelectorAll('.ws-cell.sel').forEach(c => c.classList.remove('sel'));
    (cells || []).forEach(i => grid.children[i].classList.add('sel'));
  };
  grid.onpointerdown = e => {
    const i = cellAt(e); if (i === null || W.over) return;
    e.preventDefault();
    grid.setPointerCapture(e.pointerId);
    if (start !== null && !dragging) { finish(start, i); start = null; paint(null); return; }   // druhé klepnutí
    start = i; dragging = true; moved = false;
    paint([i]);
  };
  grid.onpointermove = e => {
    if (!dragging || start === null) return;
    const i = cellAt(e); if (i === null) return;
    if (i !== start) moved = true;
    paint(lineCells(start, i) || [start]);
  };
  grid.onpointerup = e => {
    if (!dragging) return;
    dragging = false;
    const i = cellAt(e);
    if (moved && i !== null && i !== start) { finish(start, i); start = null; paint(null); }
    // bez tažení: první klepnutí zůstane označené a čeká na druhé
  };
}
function finish(a, b) {
  const cells = lineCells(a, b);
  if (!cells || cells.length < 2) return;
  const key = cells.join(','), rev = cells.slice().reverse().join(',');
  const k = W.words.findIndex(w => !w.found && (w.cells.join(',') === key || w.cells.join(',') === rev));
  if (k < 0) { $('wsGrid').classList.remove('nope'); void $('wsGrid').offsetWidth; $('wsGrid').classList.add('nope'); return; }
  const w = W.words[k];
  w.found = true;
  w.cells.forEach(i => { const c = $('wsGrid').children[i]; c.classList.add('found'); c.style.setProperty('--c', WS_COLORS[k % WS_COLORS.length]); });
  const li = $('wsClues').querySelector(`[data-k="${k}"]`);
  li.classList.add('done');
  li.querySelector('.ws-len').textContent = w.word;
  updateCount();
  if (W.words.every(x => x.found)) setTimeout(endGame, 500);
}
$('wsHintBtn').onclick = () => {
  if (!W || W.over) return;
  const left = W.words.filter(w => !w.found);
  if (!left.length) return;
  const w = left[Math.floor(Math.random() * left.length)];
  W.hints++;
  const c = $('wsGrid').children[w.cells[0]];
  c.classList.remove('hint'); void c.offsetWidth; c.classList.add('hint');
  const li = $('wsClues').querySelector(`[data-k="${W.words.indexOf(w)}"]`);
  li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
};

function endGame() {
  W.over = true;
  clearInterval(W.timer);
  const sec = Math.floor((Date.now() - W.t0) / 1000);
  const score = Math.max(0, W.words.length * 100 + Math.max(0, 600 - sec) - W.hints * 40);
  let best = 0;
  try { best = +localStorage.getItem(WS_BEST) || 0; if (score > best) localStorage.setItem(WS_BEST, String(score)); } catch (_) { /* nic */ }
  const pts = W.words.length + 5;
  recordPlayPoints(pts);
  $('wsGame').hidden = true; $('wsEnd').hidden = false;
  $('wsResult').innerHTML = `<b>${score} b</b><span>${W.words.length} pojmů za ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}${W.hints ? ` · ${W.hints}× nápověda` : ''} · +${pts} b do žebříčku týdne</span>` + (score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '');
  $('wsAgain').onclick = () => { $('wsEnd').hidden = true; $('wsSetup').hidden = false; showBest(); };
}

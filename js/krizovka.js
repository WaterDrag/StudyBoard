// ═══ krizovka.js — Křížovka poskládaná z pojmů kartiček
// Generátor: nejdelší slovo doprostřed, každé další se zkusí napojit křížením
// na už položené písmeno (slova se nesmí dotýkat bokem ani navazovat), vybere
// se poloha s nejvíc kříženími a nejmenší plochou. Celé se to zkusí víckrát
// s jiným pořadím a vezme se křížovka s nejvíc slovy.
const CW_MAX = 14, CW_TRIES = 40, CW_BEST = 'cw_best';
let DECKS = [], pickDecks = () => [], C = null;

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (_) { $('cwDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'cwDecks', all: 'cwAll', start: 'cwStart', hint: 'cwHint', key: 'cw_decks', decks: DECKS });
  $('cwStart').onclick = startGame;
});
function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(CW_BEST) || 0; } catch (_) { /* nic */ }
  $('cwBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best} b</b>` : '';
}

// ── Generátor ────────────────────────────────────────────────────
function layout(terms) {
  const cells = new Map();          // "x,y" → { ch, h, v }
  const out = [];
  const get = (x, y) => cells.get(x + ',' + y);
  const canPlace = (w, x, y, dir) => {
    const dx = dir === 'h' ? 1 : 0, dy = dir === 'v' ? 1 : 0;
    if (get(x - dx, y - dy) || get(x + dx * w.length, y + dy * w.length)) return -1;   // nesmí navazovat
    let cross = 0;
    for (let i = 0; i < w.length; i++) {
      const cx = x + dx * i, cy = y + dy * i, c = get(cx, cy);
      if (c) {
        if (c.ch !== w[i] || c[dir]) return -1;
        cross++;
      } else if (get(cx + dy, cy + dx) || get(cx - dy, cy - dx)) return -1;              // nesmí se dotýkat bokem
    }
    return cross;
  };
  const put = (t, x, y, dir) => {
    const w = t.grid, dx = dir === 'h' ? 1 : 0, dy = dir === 'v' ? 1 : 0;
    for (let i = 0; i < w.length; i++) {
      const k = (x + dx * i) + ',' + (y + dy * i);
      const c = cells.get(k) || { ch: w[i] };
      c[dir] = true; cells.set(k, c);
    }
    out.push({ ...t, x, y, dir });
  };
  const [first, ...rest] = terms;
  put(first, 0, 0, 'h');
  let pending = rest;
  for (let pass = 0; pass < 2; pass++) {
    const skipped = [];
    for (const t of pending) {
      if (out.length >= CW_MAX) break;
      let best = null;
      for (const [key, c] of cells) {
        const [cx, cy] = key.split(',').map(Number);
        for (let i = 0; i < t.grid.length; i++) {
          if (t.grid[i] !== c.ch) continue;
          for (const dir of ['h', 'v']) {
            if (c[dir]) continue;
            const x = dir === 'h' ? cx - i : cx, y = dir === 'v' ? cy - i : cy;
            const cross = canPlace(t.grid, x, y, dir);
            if (cross < 1) continue;
            const score = cross * 10 - spread(cells, x, y, dir, t.grid.length) + Math.random();
            if (!best || score > best.score) best = { x, y, dir, score };
          }
        }
      }
      if (best) put(t, best.x, best.y, best.dir); else skipped.push(t);
    }
    pending = skipped;
  }
  return out;
}
// O kolik by slovo zvětšilo ohraničující obdélník (menší = kompaktnější).
function spread(cells, x, y, dir, len) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of cells.keys()) { const [a, b] = k.split(',').map(Number); x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  const ex = dir === 'h' ? x + len - 1 : x, ey = dir === 'v' ? y + len - 1 : y;
  const area0 = (x1 - x0 + 1) * (y1 - y0 + 1);
  const area1 = (Math.max(x1, ex) - Math.min(x0, x) + 1) * (Math.max(y1, ey) - Math.min(y0, y) + 1);
  return (area1 - area0) / 6;
}
function generate(terms) {
  let best = null;
  for (let t = 0; t < CW_TRIES; t++) {
    const sorted = shuffle(terms).sort((a, b) => b.grid.length - a.grid.length + (Math.random() - 0.5) * 4);
    const l = layout(sorted.slice(0, 40));
    const xs = l.flatMap(p => [p.x, p.dir === 'h' ? p.x + p.grid.length - 1 : p.x]), ys = l.flatMap(p => [p.y, p.dir === 'v' ? p.y + p.grid.length - 1 : p.y]);
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
    const score = l.length * 100 - w * h * 0.6 - Math.abs(w - h) * 3;
    if (!best || score > best.score) best = { l, score, x0: Math.min(...xs), y0: Math.min(...ys), w, h };
  }
  // posunout do kladných souřadnic a očíslovat (shora dolů, zleva doprava)
  const words = best.l.map(p => ({ ...p, x: p.x - best.x0, y: p.y - best.y0 }));
  const starts = [...new Set(words.map(p => p.y * 1000 + p.x))].sort((a, b) => a - b);
  words.forEach(p => { p.num = starts.indexOf(p.y * 1000 + p.x) + 1; });
  return { words, w: best.w, h: best.h };
}

// ── Hra ──────────────────────────────────────────────────────────
async function startGame() {
  const ds = pickDecks();
  const btn = $('cwStart');
  btn.disabled = true; btn.textContent = 'Skládám křížovku…';
  try {
    const terms = mcGridTerms(await mcLoadCards(ds), 3, 12);
    if (terms.length < 4) { toast('Vybrané balíčky nemají dost krátkých pojmů na křížovku.'); return; }
    const g = generate(terms);
    if (g.words.length < 3) { toast('Z těchhle pojmů se nepovedlo nic zkřížit — zkus přidat další balíček.'); return; }
    // políčka: x,y → { ch, words:[k…] }
    const cell = new Map();
    g.words.forEach((p, k) => [...p.grid].forEach((ch, i) => {
      const key = (p.dir === 'h' ? p.x + i : p.x) + ',' + (p.dir === 'v' ? p.y + i : p.y);
      const c = cell.get(key) || { ch, words: [], val: '' };
      c.words.push(k); cell.set(key, c);
    }));
    C = { ...g, cell, t0: Date.now(), hints: 0, checks: 0, cur: null, dir: 'h', over: false };
    $('cwSetup').hidden = true; $('cwEnd').hidden = true; $('cwGame').hidden = false;
    render();
    clearInterval(C.timer);
    C.timer = setInterval(() => { const s = Math.floor((Date.now() - C.t0) / 1000); $('cwClock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function render() {
  const grid = $('cwGrid');
  grid.style.setProperty('--w', C.w);
  grid.style.setProperty('--h', C.h);
  const nums = new Map(C.words.map(p => [p.x + ',' + p.y, p.num]));
  let html = '';
  for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) {
    const key = x + ',' + y, c = C.cell.get(key);
    html += c ? `<div class="cw-cell" data-key="${key}">${nums.has(key) ? `<i>${nums.get(key)}</i>` : ''}<input maxlength="2" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Políčko"></div>` : '<div class="cw-empty"></div>';
  }
  grid.innerHTML = html;
  const clue = (p, k) => `<li data-k="${k}" value="${p.num}"><span>${esc(p.clue.length > 150 ? p.clue.slice(0, 147) + '…' : p.clue)}</span> <small>(${p.grid.length})</small></li>`;
  const order = d => C.words.map((p, k) => [p, k]).filter(([p]) => p.dir === d).sort((a, b) => a[0].num - b[0].num);
  $('cwAcross').innerHTML = order('h').map(([p, k]) => clue(p, k)).join('');
  $('cwDown').innerHTML = order('v').map(([p, k]) => clue(p, k)).join('');
  wire();
}

const keyOf = (x, y) => x + ',' + y;
function wordAt(key, dir) {
  const ks = C.cell.get(key)?.words || [];
  return ks.find(k => C.words[k].dir === dir) ?? ks[0];
}
function wordKeys(k) { const p = C.words[k]; return [...p.grid].map((_, i) => keyOf(p.dir === 'h' ? p.x + i : p.x, p.dir === 'v' ? p.y + i : p.y)); }
function inputAt(key) { return $('cwGrid').querySelector(`[data-key="${key}"] input`); }

function select(key, toggle) {
  const c = C.cell.get(key);
  if (!c) return;
  if (toggle && C.cur === key && c.words.length > 1) C.dir = C.dir === 'h' ? 'v' : 'h';
  else if (!c.words.some(k => C.words[k].dir === C.dir)) C.dir = C.words[c.words[0]].dir;
  C.cur = key;
  C.word = wordAt(key, C.dir);
  const keys = new Set(wordKeys(C.word));
  $('cwGrid').querySelectorAll('.cw-cell').forEach(el => { el.classList.toggle('in-word', keys.has(el.dataset.key)); el.classList.toggle('cur', el.dataset.key === key); });
  document.querySelectorAll('.cw-clues li').forEach(li => li.classList.toggle('on', +li.dataset.k === C.word));
  const p = C.words[C.word];
  $('cwActive').innerHTML = `<b>${p.num}. ${p.dir === 'h' ? 'vodorovně' : 'svisle'}</b> ${esc(p.clue)} <small>(${p.grid.length})</small>`;
  const inp = inputAt(key);
  if (document.activeElement !== inp) inp.focus({ preventScroll: true });
}
function step(d) {
  const keys = wordKeys(C.word), i = keys.indexOf(C.cur);
  const next = keys[i + d];
  if (next) select(next);
}
function setVal(key, ch) {
  const c = C.cell.get(key);
  c.val = ch;
  const inp = inputAt(key);
  inp.value = ch;
  inp.parentElement.classList.remove('bad');
}

function wire() {
  const grid = $('cwGrid');
  grid.querySelectorAll('.cw-cell').forEach(el => {
    const key = el.dataset.key, inp = el.querySelector('input');
    el.addEventListener('pointerdown', e => { e.preventDefault(); select(key, true); });
    inp.addEventListener('focus', () => { if (C.cur !== key) select(key); });
    inp.addEventListener('input', () => {
      const ch = [...inp.value].reverse().find(isLetterCh);
      if (!ch) { setVal(key, ''); return; }
      setVal(key, baseCh(ch));
      window.sfx?.('tick');
      step(1);
      checkDone();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (C.cell.get(key).val) setVal(key, ''); else { step(-1); setVal(C.cur, ''); }
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const [x, y] = key.split(',').map(Number);
        const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        C.dir = dx ? 'h' : 'v';
        for (let i = 1; i < 14; i++) { const k = keyOf(x + dx * i, y + dy * i); if (C.cell.has(k)) { select(k); break; } }
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const n = (C.word + (e.shiftKey ? -1 : 1) + C.words.length) % C.words.length;
        selectWord(n);
      }
    });
  });
  document.querySelectorAll('.cw-clues li').forEach(li => li.addEventListener('click', () => selectWord(+li.dataset.k)));
  selectWord(C.words.findIndex(p => p.num === 1));
}
function selectWord(k) {
  const p = C.words[k];
  C.dir = p.dir;
  const keys = wordKeys(k);
  select(keys.find(key => !C.cell.get(key).val) || keys[0]);
}

$('cwReveal').onclick = () => {
  if (!C?.cur || C.over) return;
  const c = C.cell.get(C.cur);
  if (c.val === c.ch) return step(1);
  C.hints++;
  window.sfx?.('hint');
  setVal(C.cur, c.ch);
  inputAt(C.cur).parentElement.classList.add('revealed');
  step(1);
  checkDone();
};
$('cwCheck').onclick = () => {
  if (!C || C.over) return;
  C.checks++;
  window.sfx?.('click');
  let wrong = 0, empty = 0;
  for (const [key, c] of C.cell) {
    const el = inputAt(key).parentElement;
    if (!c.val) { empty++; continue; }
    if (c.val !== c.ch) { wrong++; el.classList.add('bad'); }
  }
  toast(wrong ? `${wrong} ${wrong === 1 ? 'písmeno je' : wrong < 5 ? 'písmena jsou' : 'písmen je'} špatně (červeně).` : empty ? `Zatím bez chyby, zbývá doplnit ${empty} políček.` : 'Všechno sedí!');
  inputAt(C.cur)?.focus({ preventScroll: true });
};
function checkDone() {
  for (const c of C.cell.values()) if (c.val !== c.ch) return;
  endGame();
}

function endGame() {
  if (C.over) return;
  C.over = true;
  window.sfx?.('win');
  clearInterval(C.timer);
  const sec = Math.floor((Date.now() - C.t0) / 1000);
  const score = Math.max(0, C.words.length * 60 + Math.max(0, 900 - sec) - C.hints * 25);
  let best = 0;
  try { best = +localStorage.getItem(CW_BEST) || 0; if (score > best) localStorage.setItem(CW_BEST, String(score)); } catch (_) { /* nic */ }
  const pts = C.words.length + 5;
  recordPlayPoints(pts);
  setTimeout(() => {
    $('cwGame').hidden = true; $('cwEnd').hidden = false;
    $('cwResult').innerHTML = `<b>${score} b</b><span>${C.words.length} pojmů za ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}${C.hints ? ` · ${C.hints}× nápověda` : ''} · +${pts} b do žebříčku týdne</span>` + (score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '');
    $('cwAgain').onclick = () => { $('cwEnd').hidden = true; $('cwSetup').hidden = false; showBest(); };
  }, 700);
}

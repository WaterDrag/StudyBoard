// ═══ sibenice.js — Šibenice z kartiček
// Hádá se krátký pojem (max 3 slova, do 24 znaků, aspoň 2 písmena): odpověď
// karty, nebo pojem na přední straně, když je vzadu jeho definice
// („XAML“ ⟷ „značkovací jazyk…“) — pak je nápovědou ta definice.
// Písmena bez ohledu na diakritiku, čísla a znaky se odkryjí samy.
const HG_WORDS = 10, HG_LIVES = 8, HG_BEST = 'sib_best';
const HG_KEYS = 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ';
let DECKS = [], pickDecks = () => [], H = null;

const base = ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const isLetter = ch => /\p{L}/u.test(ch);
const shortTerm = t => { t = t.trim(); const letters = [...t].filter(isLetter).length; return t.length >= 2 && t.length <= 24 && t.split(/\s+/).length <= 3 && letters >= 2 && !/[?\n]/.test(t); };

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  showBest();
  try { DECKS = await mcLoadDecks(); } catch (_) { $('hgDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'hgDecks', all: 'hgAll', start: 'hgStart', hint: 'hgHint', key: 'sib_decks', decks: DECKS });
  $('hgStart').onclick = startGame;
});

function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(HG_BEST) || 0; } catch (_) { /* nic */ }
  $('hgBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best} b</b>` : '';
}

async function startGame() {
  const ds = pickDecks();
  const btn = $('hgStart');
  btn.disabled = true; btn.textContent = 'Hledám pojmy…';
  try {
    const cards = await mcLoadCards(ds);
    const seen = new Set();
    const words = shuffle(cards.filter(c => !c.fl && !c.cl).map(c => {
      if (shortTerm(c.b) && !shortTerm(c.f)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
      if (shortTerm(c.f) && c.b.length > c.f.length) return { word: c.f.trim(), clue: c.b, lbl: 'Co je to?', card: c };
      if (shortTerm(c.b)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
      return null;
    }).filter(Boolean)).filter(w => { const k = base(w.word); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, HG_WORDS);
    if (words.length < 2) { toast('Ve vybraných balíčcích skoro nejsou karty s krátkým pojmem. Zkus jiný balíček.'); return; }
    H = { words, i: 0, score: 0, solved: 0, failed: [] };
    $('hgSetup').hidden = true; $('hgEnd').hidden = true; $('hgGame').hidden = false;
    nextWord();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function nextWord() {
  if (H.i >= H.words.length) return endGame();
  const w = H.words[H.i];
  H.cur = { ...w, guessed: new Set(), lives: HG_LIVES, done: false };
  $('hgRound').textContent = `Slovo ${H.i + 1} / ${H.words.length}`;
  $('hgHintLbl').textContent = w.lbl;
  $('hgClue').textContent = w.clue.length > 260 ? w.clue.slice(0, 257) + '…' : w.clue;
  $('hgNext').hidden = true;
  $('hgReveal').hidden = false;
  $('hgKeys').innerHTML = [...HG_KEYS].filter(k => k === base(k)).map(k => `<button type="button" class="hg-key" data-k="${k}">${k}</button>`).join('');
  $('hgKeys').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => guess(b.dataset.k)));
  render();
}

function render() {
  const c = H.cur;
  $('hgScore').textContent = `${H.score} b`;
  $('hgWord').innerHTML = [...c.word].map(ch => {
    if (ch === ' ') return '<span class="hg-gap"></span>';
    if (!isLetter(ch)) return `<span class="hg-ch fixed">${esc(ch)}</span>`;
    const shown = c.guessed.has(base(ch)) || c.done;
    return `<span class="hg-ch${shown ? ' on' : ''}${c.done && !c.guessed.has(base(ch)) ? ' miss' : ''}">${shown ? esc(ch.toUpperCase()) : ''}</span>`;
  }).join('');
  $('hgLives').innerHTML = '❤️'.repeat(c.lives) + '<span class="hg-lost">' + '🖤'.repeat(HG_LIVES - c.lives) + '</span>';
  [...$('hgGallows').querySelectorAll('.hg-p')].forEach((p, i) => p.classList.toggle('on', i < HG_LIVES - c.lives));
  $('hgKeys').querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k, used = c.guessed.has(k);
    b.disabled = used || c.done;
    b.classList.toggle('hit', used && [...c.word].some(ch => base(ch) === k));
    b.classList.toggle('miss', used && ![...c.word].some(ch => base(ch) === k));
  });
}

function solved() { return [...H.cur.word].filter(isLetter).every(ch => H.cur.guessed.has(base(ch))); }
function guess(k) {
  const c = H.cur;
  if (!c || c.done || c.guessed.has(k)) return;
  c.guessed.add(k);
  if (![...c.word].some(ch => base(ch) === k)) c.lives--;
  finishCheck();
}
function finishCheck() {
  const c = H.cur;
  if (solved()) {
    c.done = true;
    const gain = 10 + c.lives * 2;
    H.score += gain; H.solved++;
    toast(`✓ Správně! +${gain} b`);
  } else if (c.lives <= 0) {
    c.done = true;
    H.failed.push(c);
  }
  render();
  if (c.done) {
    $('hgWord').classList.toggle('won', c.lives > 0);
    $('hgReveal').hidden = true;
    $('hgNext').hidden = false;
    $('hgNext').textContent = H.i === H.words.length - 1 ? 'Výsledky →' : 'Další slovo →';
    $('hgNext').onclick = () => { $('hgWord').classList.remove('won'); H.i++; nextWord(); };
    $('hgNext').focus();
  }
}
$('hgReveal').onclick = () => {
  const c = H?.cur;
  if (!c || c.done || c.lives <= 1) { if (c && c.lives <= 1) toast('Na poslední chybu už nápověda nejde.'); return; }
  const hidden = [...new Set([...c.word].filter(isLetter).map(base))].filter(k => !c.guessed.has(k));
  if (!hidden.length) return;
  c.guessed.add(hidden[Math.floor(Math.random() * hidden.length)]);
  c.lives--;
  finishCheck();
};

// Fyzická klávesnice: písmena (i s háčky), Enter = další slovo
document.addEventListener('keydown', e => {
  if (!H || $('hgGame').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' && H.cur?.done) { e.preventDefault(); $('hgNext').click(); return; }
  if (e.key.length === 1 && isLetter(e.key)) { e.preventDefault(); guess(base(e.key)); }
});

function endGame() {
  let best = 0;
  try { best = +localStorage.getItem(HG_BEST) || 0; if (H.score > best) localStorage.setItem(HG_BEST, String(H.score)); } catch (_) { /* nic */ }
  recordPlayPoints(H.solved * 2);
  $('hgGame').hidden = true; $('hgEnd').hidden = false;
  const all = H.solved === H.words.length;
  $('hgEndIco').textContent = all ? '🏆' : H.solved >= H.words.length / 2 ? '🎉' : '🔤';
  $('hgEndTitle').textContent = all ? 'Všechno uhádnuto!' : 'Konec hry';
  $('hgResult').innerHTML = `<b>${H.score} b</b><span>${H.solved} z ${H.words.length} pojmů uhádnuto · +${H.solved * 2} b do žebříčku týdne</span>` + (H.score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '');
  $('hgReview').innerHTML = H.failed.length ? '<div class="day-rank-h">Tyhle ti utekly</div>' + H.failed.map(c => `<div class="sp-rev"><b>${esc(c.word)}</b><span>${esc(c.clue)}</span></div>`).join('') : '';
  $('hgAgain').onclick = () => { $('hgEnd').hidden = true; $('hgSetup').hidden = false; showBest(); };
}

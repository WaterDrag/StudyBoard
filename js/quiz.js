const params  = new URLSearchParams(window.location.search);
const DECK_ID = params.get('deck');
const ROOM_ID = params.get('room');
const SMART   = params.get('smart') === '1';   // spaced-repetition practice mode
const KIND    = params.get('kind');            // jen karty jednoho druhu (krok z celého setu)


let ME       = null;
let ALL_CARDS = [];
let QUIZ_QUEUE = [];
let QUIZ_IDX   = 0;
let SCORE      = 0;
let STREAK     = 0;
let MAX_STREAK = 0;
let WRONG_IDS  = new Set();
let CURRENT_OPTS = [];      // options shown for the current question

// ── Spaced repetition (Leitner boxes) ─────────────────────────
// Per-user, per-deck progress in users/{uid}.learn[deckId]:
//   cards: { cardId: { box: 1..5, due: ms } }   — correct → box+1, wrong → 1
//   stats: { answered, correct, days: { 'YYYY-MM-DD': { a, c } } }
// EVERY quiz answer feeds it (smart or classic mode); the smart mode then
// only asks what's due, lowest box first.
const LEARN_INTERVALS = { 1: 10 * 60e3, 2: 24 * 3600e3, 3: 3 * 24 * 3600e3, 4: 7 * 24 * 3600e3, 5: 16 * 24 * 3600e3 };
let LEARN = { cards: {}, stats: { answered: 0, correct: 0, days: {} } };
let _learnSaveTimer = null;

async function loadLearn() {
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    const l = snap.exists ? (snap.data().learn || {})[DECK_ID] : null;
    if (l) LEARN = {
      cards: l.cards || {},
      stats: { answered: l.stats?.answered || 0, correct: l.stats?.correct || 0, days: l.stats?.days || {} },
    };
  } catch (_) { /* fresh start */ }
}

function persistLearn() {
  clearTimeout(_learnSaveTimer);
  _learnSaveTimer = setTimeout(async () => {
    // Keep only the last 30 day buckets so the doc doesn't grow forever.
    const keys = Object.keys(LEARN.stats.days).sort();
    while (keys.length > 30) delete LEARN.stats.days[keys.shift()];
    try {
      // Field-path update REPLACES the per-deck object (so pruning sticks).
      await db.collection('users').doc(ME.uid).update({ [`learn.${DECK_ID}`]: LEARN });
    } catch {
      try { await db.collection('users').doc(ME.uid).set({ learn: { [DECK_ID]: LEARN } }, { merge: true }); } catch {}
    }
  }, 800);
}

function recordAnswer(cardId, correct) {
  const e = LEARN.cards[cardId] || { box: 0, due: 0 };
  e.box = correct ? Math.min(5, (e.box || 0) + 1) : 1;
  e.due = Date.now() + LEARN_INTERVALS[e.box];
  LEARN.cards[cardId] = e;
  LEARN.stats.answered++;
  if (correct) LEARN.stats.correct++;
  const day = new Date().toISOString().slice(0, 10);
  const d = LEARN.stats.days[day] || { a: 0, c: 0 };
  d.a++; if (correct) d.c++;
  LEARN.stats.days[day] = d;
  persistLearn();
}

// Cards worth asking right now: never-seen first (box 0), then lowest box.
function dueCards() {
  const now = Date.now();
  return ALL_CARDS
    .filter(c => { const e = LEARN.cards[c.id]; return !e || e.due <= now; })
    .sort((a, b) => ((LEARN.cards[a.id]?.box) || 0) - ((LEARN.cards[b.id]?.box) || 0));
}

// Code cards often carry the actual question as a comment under the code
// ("// Co vypíše …?"). Pull it out so it can be shown as the question itself.
function splitCodeQuestion(code) {
  const lines = String(code || '').replace(/\s+$/, '').split('\n');
  const q = [];
  const take = i => { const m = lines[i].trim().match(/^(?:\/\/+|#|--)\s*(.*)$/); return m && m[1] ? m[1] : null; };
  while (lines.length && take(lines.length - 1) !== null) { q.unshift(take(lines.length - 1)); lines.pop(); }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const question = q.join(' ').trim();
  // Only a real question counts — a trailing "// konec třídy" stays in the code.
  if (!question.includes('?') || !lines.length) return { code: String(code || ''), question: '' };
  return { code: lines.join('\n'), question };
}

// ── Auth guard ────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
  ME = user;
  if (!DECK_ID) { window.location.href = 'dashboard.html'; return; }
  loadDeck();
});

// ── Load deck & cards ─────────────────────────────────────────
async function loadDeck() {
  try {
    const deckDoc = await db.collection('decks').doc(DECK_ID).get();
    if (!deckDoc.exists) { toast('Balíček nenalezen.'); window.history.back(); return; }

    const deck    = deckDoc.data();
    const isOwner = deck.ownerUid === ME.uid;

    if (!isOwner && deck.roomId) {
      const roomDoc = await db.collection('rooms').doc(deck.roomId).get();
      if (!roomDoc.exists || !(roomDoc.data().memberIds || []).includes(ME.uid)) {
        toast('Nemáš přístup.'); window.location.href = 'dashboard.html'; return;
      }
    } else if (!isOwner) {
      toast('Nemáš přístup.'); window.location.href = 'dashboard.html'; return;
    }

    document.getElementById('navTitle').textContent  = `Kvíz – ${esc(deck.name)}`;
    const backHref = `flashcards.html?deck=${DECK_ID}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    document.getElementById('backBtn').href       = backHref;
    document.getElementById('quizBackLink').href  = backHref;

    const cardsSnap = await db.collection('decks').doc(DECK_ID)
      .collection('cards').orderBy('createdAt', 'asc').get();
    ALL_CARDS = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Výkladové karty nic nezkouší — do kvízu jdou, jen když balíček nic jiného nemá.
    const testable = ALL_CARDS.filter(c => c.kind !== 'info');
    if (KIND && ALL_CARDS.some(c => c.kind === KIND)) ALL_CARDS = ALL_CARDS.filter(c => c.kind === KIND);
    else if (testable.length >= 2) ALL_CARDS = testable;

    if (ALL_CARDS.length < 2) {
      document.getElementById('quizLoading').innerHTML =
        '<p style="color:var(--text-muted);text-align:center;padding:40px 20px;">Balíček musí mít alespoň 2 karty pro kvíz.</p>';
      return;
    }

    await loadLearn();

    if (SMART) {
      document.getElementById('navTitle').textContent = `🧠 Chytré procvičování – ${deck.name}`;
      const due = dueCards();
      if (!due.length) {
        const dues = Object.values(LEARN.cards).map(e => e.due);
        const next = dues.length ? Math.min(...dues) : 0;
        const when = next ? new Date(next).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        document.getElementById('quizLoading').innerHTML = `
          <div style="text-align:center;padding:40px 20px;">
            <div style="font-size:2.2rem;margin-bottom:10px;">🎉</div>
            <p style="font-weight:600;margin-bottom:6px;">Vše zopakováno!</p>
            <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px;">${when ? 'Další opakování: ' + when + '.' : 'Zatím tu nejsou žádné karty k opakování.'}</p>
            <button class="btn btn-secondary" id="practiceAnywayBtn">Procvičovat i tak</button>
          </div>`;
        document.getElementById('practiceAnywayBtn').addEventListener('click', () => {
          document.getElementById('quizLoading').style.display = 'none';
          startQuiz(ALL_CARDS);
        });
        return;
      }
      document.getElementById('quizLoading').style.display = 'none';
      startQuiz(due);
      return;
    }

    document.getElementById('quizLoading').style.display = 'none';
    startQuiz(ALL_CARDS);

  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

// ── Start / restart ───────────────────────────────────────────
function startQuiz(cards) {
  QUIZ_QUEUE = shuffle([...cards]).slice(0, Math.min(20, cards.length));
  QUIZ_IDX   = 0;
  SCORE      = 0;
  STREAK     = 0;
  MAX_STREAK = 0;
  WRONG_IDS  = new Set();
  document.getElementById('quizLoading').style.display  = 'none';
  document.getElementById('quizQuestion').style.display = 'block';
  document.getElementById('quizResults').style.display  = 'none';
  document.getElementById('quizStreak').style.display   = 'none';

  updateScoreNav();
  showQuestion();
}

// ── Show one question ─────────────────────────────────────────
function showQuestion() {
  if (QUIZ_IDX >= QUIZ_QUEUE.length) { showResults(); return; }

  const card  = QUIZ_QUEUE[QUIZ_IDX];
  const total = QUIZ_QUEUE.length;

  // Progress
  document.getElementById('quizProgressBar').style.width = (QUIZ_IDX / total * 100) + '%';
  document.getElementById('quizProgressTxt').textContent = `${QUIZ_IDX + 1} / ${total}`;

  // Question text
  const qEl = document.getElementById('quizQText');
  let codeQ = '';
  if (card.frontLang) {
    const sp = splitCodeQuestion(card.front);
    codeQ = sp.question;
    qEl.innerHTML = (codeQ ? `<div class="code-q">${esc(codeQ)}</div>` : '') +
      `<pre class="code-block" data-lang="${esc(card.frontLang)}"><code>${esc(sp.code)}</code></pre>`;
  } else qEl.textContent = card.front;
  // Otázka z komentáře v kódu nahradí nápis „Otázka“.
  const qLbl = document.querySelector('#quizCard .quiz-q-label');
  if (qLbl) qLbl.hidden = !!codeQ;

  // Reset card visuals
  const cardEl = document.getElementById('quizCard');
  cardEl.classList.remove('quiz-card-correct', 'quiz-card-wrong', 'quiz-card-enter');
  const cb = document.getElementById('quizConfirmBtn');
  if (cb) cb.disabled = true;
  void cardEl.offsetWidth; // force reflow to retrigger animation
  cardEl.classList.add('quiz-card-enter');

  document.getElementById('quizGenLoading').style.display = 'none';
  renderAnswers(card, buildQuizOptions(card));
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// The AI only supplies POOLS — several correct answers and several wrong
// ones. How many of each actually show up is decided here, per question, at
// random, so the same card never looks the same twice and the option count
// itself carries no hint.
function buildQuizOptions(card) {
  const correctPool = [card.back, ...(card.corrects || [])].map(x => String(x || '').trim()).filter(Boolean);
  const uniqCorrect = [...new Set(correctPool)];

  let wrongPool = [...new Set((card.distractors || []).map(x => String(x || '').trim()).filter(Boolean))]
    .filter(w => !uniqCorrect.includes(w));
  // Top up from other cards when the pool is thin (old cards, no AI wrongs).
  if (wrongPool.length < 3) {
    const extra = shuffle(ALL_CARDS.filter(c => c.id !== card.id && c.back))
      .map(c => String(c.back).trim())
      .filter(b => b && !uniqCorrect.includes(b) && !wrongPool.includes(b));
    wrongPool = wrongPool.concat(extra);
  }

  // When the card has multiple independently correct choices, show at least
  // two so this question really uses the multi-select interaction.
  const nCorrect = uniqCorrect.length > 1 ? randInt(2, Math.min(uniqCorrect.length, 3)) : 1;
  // How many wrong ones: varies too, so the total option count moves around.
  // A single-answer card only gets to vary once its pool is big enough —
  // older cards with just three stored distractors keep their fixed layout.
  const wantWrong = uniqCorrect.length > 1
    ? randInt(2, 5)
    : (wrongPool.length >= 4 ? randInt(3, Math.min(5, wrongPool.length)) : (card.answerCount || 4) - 1);
  const nWrong = Math.max(1, Math.min(wantWrong, wrongPool.length));

  const chosenCorrect = shuffle(uniqCorrect).slice(0, nCorrect);
  const chosenWrong   = shuffle(wrongPool).slice(0, nWrong);
  return shuffle([
    ...chosenCorrect.map(text => ({ text, correct: true })),
    ...chosenWrong.map(text => ({ text, correct: false })),
  ]);
}

function renderAnswers(card, opts) {
  document.getElementById('quizGenLoading').style.display = 'none';
  CURRENT_OPTS = opts;

  const wrap = document.getElementById('quizAnswers');
  wrap.innerHTML    = '';
  wrap.style.display = 'grid';

  const hint = document.getElementById('quizMultiHint');
  const confirmBtn = document.getElementById('quizConfirmBtn');
  const multi = opts.filter(opt => opt.correct).length > 1;
  if (hint)       hint.style.display = multi ? 'block' : 'none';
  if (confirmBtn) {
    confirmBtn.textContent = 'Potvrdit odpověď';
    confirmBtn.style.display = multi ? 'inline-flex' : 'none';
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => submitMulti(card);
  }

  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-answer-btn' + (card.codeLang ? ' is-code' : '') + (multi ? ' is-multi' : '');
    btn.textContent = opt.text;   // textContent — options are never trusted HTML
    btn.style.animationDelay = `${i * 55}ms`;
    btn.dataset.i = String(i);
    if (i < 9) btn.dataset.key = String(i + 1);   // keyboard hint, see keydown below
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (!multi) { pick(btn, opt.correct, card); return; }
      btn.classList.toggle('selected');
      confirmBtn.disabled = !wrap.querySelector('.quiz-answer-btn.selected');
    });
    wrap.appendChild(btn);
  });
}

// Keyboard: 1–9 picks (or ticks) that answer, Enter confirms a multi-answer.
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea'))) return;
  const wrap = document.getElementById('quizAnswers');
  if (!wrap || wrap.style.display === 'none') return;
  if (/^[1-9]$/.test(e.key)) {
    const btn = wrap.querySelector(`.quiz-answer-btn[data-key="${e.key}"]`);
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  } else if (e.key === 'Enter' || (e.key === ' ' && document.getElementById('quizConfirmBtn')?.textContent === 'Další →')) {
    const confirmBtn = document.getElementById('quizConfirmBtn');
    if (confirmBtn && confirmBtn.style.display !== 'none' && !confirmBtn.disabled) { e.preventDefault(); confirmBtn.click(); }
  }
});

// Tick-and-confirm scoring: the answer counts only when the ticked set is
// EXACTLY the correct set — no partial credit, since guessing everything
// would otherwise always win.
function submitMulti(card) {
  const btns = [...document.querySelectorAll('.quiz-answer-btn')];
  const picked  = new Set(btns.filter(b => b.classList.contains('selected')).map(b => +b.dataset.i));
  const correct = new Set(CURRENT_OPTS.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0));
  const ok = picked.size === correct.size && [...picked].every(i => correct.has(i));

  btns.forEach(b => {
    b.disabled = true;
    const i = +b.dataset.i;
    if (correct.has(i)) b.classList.add('quiz-answer-correct');
    else if (picked.has(i)) b.classList.add('quiz-answer-wrong');
  });
  const confirmBtn = document.getElementById('quizConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;

  finishAnswer(ok, card);
}

// Shared tail of both modes: card flash, score, streak, Leitner, next.
function finishAnswer(ok, card) {
  const cardEl = document.getElementById('quizCard');
  cardEl.classList.add(ok ? 'quiz-card-correct' : 'quiz-card-wrong');
  if (ok) {
    SCORE++;
    STREAK++;
    if (STREAK > MAX_STREAK) MAX_STREAK = STREAK;
  } else {
    WRONG_IDS.add(card.id);
    STREAK = 0;
  }
  recordAnswer(card.id, ok);   // feed the Leitner boxes + stats
  updateStreak();
  updateScoreNav();
  QUIZ_IDX++;
  if (ok) { setTimeout(showQuestion, 1200); return; }
  // Spatne: nech cas si v klidu precist spravnou odpoved — dal az na klik / Enter.
  const next = document.getElementById('quizConfirmBtn');
  if (!next) { setTimeout(showQuestion, 1900); return; }
  document.getElementById('quizMultiHint').style.display = 'none';
  next.textContent = 'Další →';
  next.style.display = 'inline-flex';
  next.disabled = false;
  next.onclick = () => showQuestion();
  setTimeout(() => next.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
}

// ── Handle answer pick ────────────────────────────────────────
function pick(btn, correct, card) {
  document.querySelectorAll('.quiz-answer-btn').forEach(b => (b.disabled = true));
  if (correct) {
    btn.classList.add('quiz-answer-correct');
  } else {
    btn.classList.add('quiz-answer-wrong');
    // Reveal whichever option was the right one
    document.querySelectorAll('.quiz-answer-btn').forEach(b => {
      if (CURRENT_OPTS[+b.dataset.i]?.correct) b.classList.add('quiz-answer-correct');
    });
  }
  finishAnswer(correct, card);
}

// ── Results ───────────────────────────────────────────────────
function showResults() {
  document.getElementById('quizQuestion').style.display = 'none';
  document.getElementById('quizResults').style.display  = 'block';

  const total = QUIZ_QUEUE.length;
  const pct   = Math.round((SCORE / total) * 100);
  if (KIND) try {   // fajfka u kroku setu (flashcards.js → setProgress)
    const p = JSON.parse(localStorage.getItem('sb_set_' + DECK_ID) || '{}') || {};
    p[KIND] = Date.now(); localStorage.setItem('sb_set_' + DECK_ID, JSON.stringify(p));
  } catch (_) { /* jen fajfka */ }

  let stars, title;
  if      (pct >= 90) { stars = '⭐⭐⭐'; title = 'Perfektní!'; }
  else if (pct >= 70) { stars = '⭐⭐';   title = 'Dobrá práce!'; }
  else if (pct >= 50) { stars = '⭐';     title = 'Slušný výkon.'; }
  else                { stars = '💪';     title = 'Nevzdávej se!'; }

  document.getElementById('quizStars').textContent       = stars;
  document.getElementById('quizResultTitle').textContent = title;
  document.getElementById('quizResultSub').textContent   =
    `${SCORE} z ${total} správně${MAX_STREAK >= 3 ? ` · 🔥 max. série ${MAX_STREAK}` : ''}`;
  document.getElementById('quizResultPct').textContent   = pct + '%';

  const bar = document.getElementById('quizResultBar');
  bar.style.width      = '0%';
  bar.style.background = pct >= 70 ? 'var(--accent)' : pct >= 50 ? '#f59e0b' : '#ef4444';
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));

  // Re-wire buttons (clone to remove old listeners)
  const retryBtn      = document.getElementById('quizRetryBtn');
  const retryWrongBtn = document.getElementById('quizRetryWrongBtn');
  const freshRetry    = retryBtn.cloneNode(true);
  const freshWrong    = retryWrongBtn.cloneNode(true);
  retryBtn.replaceWith(freshRetry);
  retryWrongBtn.replaceWith(freshWrong);

  freshRetry.addEventListener('click', () => startQuiz(ALL_CARDS));

  const wrongCards = ALL_CARDS.filter(c => WRONG_IDS.has(c.id));
  if (wrongCards.length > 0) {
    freshWrong.textContent = `🎯 Jen špatné (${wrongCards.length})`;
    freshWrong.addEventListener('click', () => startQuiz(wrongCards));
  } else {
    freshWrong.textContent = '🎯 Vše správně!';
    freshWrong.disabled    = true;
  }
}

// ── UI helpers ────────────────────────────────────────────────
function updateScoreNav() {
  // Right / wrong so far ("1 / 0" used to read as a score out of zero).
  document.getElementById('quizScoreNav').innerHTML =
    `<span class="qs-good">✓ ${SCORE}</span><span class="qs-bad">✗ ${WRONG_IDS.size}</span>`;
}

function updateStreak() {
  const el = document.getElementById('quizStreak');
  if (STREAK >= 2) {
    document.getElementById('quizStreakNum').textContent = STREAK;
    el.style.display   = 'flex';
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  } else {
    el.style.display = 'none';
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  const w = document.getElementById('toastWrap');
  if (!w) return;
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}

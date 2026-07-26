const params  = new URLSearchParams(window.location.search);
const DECK_ID = params.get('deck');
const ROOM_ID = params.get('room');
const SMART   = params.get('smart') === '1';   // spaced-repetition practice mode


let ME       = null;
let ALL_CARDS = [];
let QUIZ_QUEUE = [];
let QUIZ_IDX   = 0;
let SCORE      = 0;
let STREAK     = 0;
let MAX_STREAK = 0;
let WRONG_IDS  = new Set();

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
  document.getElementById('quizQText').textContent = card.front;

  // Reset card visuals
  const cardEl = document.getElementById('quizCard');
  cardEl.classList.remove('quiz-card-correct', 'quiz-card-wrong', 'quiz-card-enter');
  void cardEl.offsetWidth; // force reflow to retrigger animation
  cardEl.classList.add('quiz-card-enter');

  document.getElementById('quizGenLoading').style.display = 'none';
  renderAnswers(card, getLocalDistractors(card));
}

function getLocalDistractors(card) {
  const n = (card.answerCount || 4) - 1;
  if (card.distractors && card.distractors.length >= n) return shuffle(card.distractors).slice(0, n);
  const extra = shuffle(ALL_CARDS.filter(c => c.id !== card.id && c.back)).slice(0, n).map(c => c.back);
  return shuffle([...(card.distractors || []), ...extra]).slice(0, n);
}

function renderAnswers(card, distractors) {
  document.getElementById('quizGenLoading').style.display = 'none';

  const wrap = document.getElementById('quizAnswers');
  wrap.innerHTML    = '';
  wrap.style.display = 'grid';

  const opts = shuffle([card.back, ...distractors]);
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-answer-btn';
    btn.textContent = opt;
    btn.style.animationDelay = `${i * 55}ms`;
    btn.addEventListener('click', () => pick(btn, opt === card.back, card));
    wrap.appendChild(btn);
  });
}

// ── Handle answer pick ────────────────────────────────────────
function pick(btn, correct, card) {
  document.querySelectorAll('.quiz-answer-btn').forEach(b => (b.disabled = true));

  const cardEl = document.getElementById('quizCard');

  if (correct) {
    btn.classList.add('quiz-answer-correct');
    cardEl.classList.add('quiz-card-correct');
    SCORE++;
    STREAK++;
    if (STREAK > MAX_STREAK) MAX_STREAK = STREAK;
  } else {
    btn.classList.add('quiz-answer-wrong');
    cardEl.classList.add('quiz-card-wrong');
    WRONG_IDS.add(card.id);
    STREAK = 0;
    // Reveal the correct answer
    document.querySelectorAll('.quiz-answer-btn').forEach(b => {
      if (b.textContent === card.back) b.classList.add('quiz-answer-correct');
    });
  }

  recordAnswer(card.id, correct);   // feed the Leitner boxes + stats

  updateStreak();
  updateScoreNav();
  QUIZ_IDX++;
  setTimeout(showQuestion, 1500);
}

// ── Results ───────────────────────────────────────────────────
function showResults() {
  document.getElementById('quizQuestion').style.display = 'none';
  document.getElementById('quizResults').style.display  = 'block';

  const total = QUIZ_QUEUE.length;
  const pct   = Math.round((SCORE / total) * 100);

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
  document.getElementById('quizScoreNav').textContent = `${SCORE} / ${QUIZ_IDX}`;
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

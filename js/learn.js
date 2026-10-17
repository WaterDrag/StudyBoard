// ═══ learn.js — rozložené opakování (Leitnerovy krabičky)
// ── Spaced repetition (Leitner boxes) ─────────────────────────
// Per-user, per-deck progress in users/{uid}.learn[deckId]:
//   cards: { cardId: { box: 1..5, due: ms } }   — correct → box+1, wrong → 1
//   stats: { answered, correct, days: { 'YYYY-MM-DD': { a, c } } }
// EVERY quiz answer feeds it (smart or classic mode), and so does grading in
// Studovat / Psaní (flashcards.js); the smart mode then only asks what's
// due, lowest box first. Sdílí quiz.html i flashcards.html (globály ME,
// DECK_ID, ALL_CARDS má každá stránka svoje).
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

// correct: true = umím (o krabičku výš), false = nevím (zpět do 1),
// 'almost' = skoro (zůstává, kde byla). noBox: jen statistika, krabičky nechá.
function recordAnswer(cardId, correct, noBox = false) {
  if (!noBox) {
    const e = LEARN.cards[cardId] || { box: 0, due: 0 };
    e.box = correct === 'almost' ? Math.max(1, e.box || 0) : correct ? Math.min(5, (e.box || 0) + 1) : 1;
    e.due = Date.now() + LEARN_INTERVALS[e.box];
    LEARN.cards[cardId] = e;
  }
  correct = correct === true;
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

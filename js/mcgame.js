// ═══ mcgame.js — společný základ Milionáře a Denní výzvy
// Otázky s možnostmi A–D z kartiček: balíčky, ze kterých se hraje, sestavení
// možností (špatné odpovědi z karty, doplněné odpověďmi jiných karet),
// krabičky z učení (podle nich se řídí obtížnost) a body do žebříčku.
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const shuffle = (a, rnd = Math.random) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const $ = id => document.getElementById(id);
let ME = null;

function toast(msg) {
  const w = $('toastWrap'); if (!w) return;
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}

// Stejná čísla při stejném „semínku“ (Denní výzva: uživatel + den).
function seededRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const localDay = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');   // YYYY-MM-DD podle místního času

// Osobní balíčky + balíčky ze všech místností, kde jsem členem.
async function mcLoadDecks() {
  const [rooms, personal] = await Promise.all([
    db.collection('rooms').where('memberIds', 'array-contains', ME.uid).get(),
    db.collection('decks').where('ownerUid', '==', ME.uid).get(),
  ]);
  const all = new Map();
  personal.docs.forEach(d => all.set(d.id, { id: d.id, ...d.data() }));
  const roomDecks = await Promise.all(rooms.docs.map(r => db.collection('decks').where('roomId', '==', r.id).get()
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data(), roomName: r.data().name }))).catch(() => [])));
  roomDecks.flat().forEach(d => all.set(d.id, d));
  return [...all.values()].filter(d => (d.cardCount || 0) > 0 && d.kind !== 'info')
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'cs'));
}

// Karty vybraných balíčků. Výkladové karty se nezkouší (nemají otázku).
async function mcLoadCards(decks, perDeck = 300) {
  const lists = await Promise.all(decks.map(d => db.collection('decks').doc(d.id).collection('cards').get()
    .then(s => s.docs.slice(0, perDeck).map(c => ({ ...c.data(), id: c.id, deckId: d.id, deckName: d.name }))).catch(() => [])));
  return lists.flat().filter(c => c.front && c.back && c.kind !== 'info').map(c => ({
    id: c.id, deckId: c.deckId, deckName: c.deckName,
    f: String(c.front), b: String(c.back), fl: c.frontLang || null, cl: c.codeLang || null,
    w: (c.distractors || []).filter(Boolean).map(String),
    ok: new Set([String(c.back), ...(c.corrects || []).map(String)]),
  }));
}

// Krabičky z učení (users/{uid}.learn) → kartaId → 0..5
async function mcLearnBoxes() {
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    const learn = (snap.exists && snap.data().learn) || {};
    const out = {};
    Object.values(learn).forEach(l => Object.entries(l?.cards || {}).forEach(([id, e]) => { out[id] = e.box || 0; }));
    return out;
  } catch (_) { return {}; }
}

// Čtyři možnosti: správná + špatné z karty, doplněné odpověďmi jiných karet
// (nejdřív ze stejného balíčku, ať jsou podobného druhu). null = nejde.
function mcOptions(card, pool, rnd = Math.random) {
  const used = new Set(card.ok);
  const wrong = [];
  const take = v => { v = String(v || '').trim(); if (v && !used.has(v) && wrong.length < 3) { used.add(v); wrong.push(v); } };
  shuffle(card.w, rnd).forEach(take);
  // Náhradní špatné odpovědi z jiných karet: k číslu čísla, ke krátké odpovědi
  // krátké — jinak by „UDP“ mezi „32 / 128 / 80“ prozradilo samo sebe.
  const num = t => /^[\d\s.,:/×x%+-]+$/.test(t.trim());
  const like = c => (num(c.b) === num(card.b) ? 0 : 3) + Math.abs(Math.log((c.b.length + 4) / (card.b.length + 4))) + (c.deckId === card.deckId ? 0 : 0.6) + rnd() * 0.8;
  if (wrong.length < 3) pool.filter(c => c !== card && !!c.cl === !!card.cl).map(c => [like(c), c]).sort((a, b) => a[0] - b[0]).forEach(([, c]) => take(c.b));
  if (wrong.length < 3) return null;
  const opts = shuffle([card.b, ...wrong], rnd);
  return { opts, correct: opts.indexOf(card.b) };
}

// Otázka / odpověď: kód jako blok kódu (codehl.js ho obarví), jinak text.
function mcCode(text, lang) { return `<pre class="code-block" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>`; }
function mcQuestionHtml(card) {
  if (!card.fl) return `<div class="mc-q-text">${esc(card.f).replace(/\n/g, '<br>')}</div>`;
  // „// Co vypíše …?“ pod kódem je samotná otázka
  const lines = card.f.replace(/\s+$/, '').split('\n'), q = [];
  while (lines.length && /^\s*(\/\/+|#|--)\s*\S/.test(lines[lines.length - 1])) q.unshift(lines.pop().replace(/^\s*(\/\/+|#|--)\s*/, ''));
  const question = q.join(' ');
  return (question.includes('?') ? `<div class="mc-q-text">${esc(question)}</div>` + mcCode(lines.join('\n'), card.fl) : mcCode(card.f, card.fl));
}
function mcOptionHtml(card, text) { return card.cl ? mcCode(text, card.cl) : esc(text); }

function recordPlayPoints(n) {
  try {
    const u = auth.currentUser; if (!u || u.isAnonymous || !(n > 0)) return;
    const day = new Date().toISOString().slice(0, 10);
    db.collection('users').doc(u.uid).set({ play: { [day]: { p: firebase.firestore.FieldValue.increment(Math.round(n)) } } }, { merge: true }).catch(() => {});
  } catch (_) { /* nic */ }
}

async function mcFriends() {
  const [a, b] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', ME.uid).get(),
    db.collection('friendRequests').where('toUid', '==', ME.uid).get(),
  ]);
  const out = new Set();
  a.docs.forEach(d => { const r = d.data(); if (r.status === 'accepted') out.add(r.toUid); });
  b.docs.forEach(d => { const r = d.data(); if (r.status === 'accepted') out.add(r.fromUid); });
  return [...out];
}

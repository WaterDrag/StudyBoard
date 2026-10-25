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
  const mine = [...all.values()].filter(d => (d.cardCount || 0) > 0 && d.kind !== 'info')
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'cs'));
  return mine.concat(typeof sbDeckList === 'function' ? sbDeckList() : []);   // + vestavěné balíčky pro všechny
}

// Karty vybraných balíčků. Výkladové karty se nezkouší (nemají otázku).
async function mcLoadCards(decks, perDeck = 300) {
  const lists = await Promise.all(decks.map(d => (typeof sbIsBuiltin === 'function' && sbIsBuiltin(d.id)
    ? sbDeckCards(d.id).then(list => list.slice(0, perDeck).map(c => ({ ...c, deckId: d.id, deckName: d.name })))
    : db.collection('decks').doc(d.id).collection('cards').get()
      .then(s => s.docs.slice(0, perDeck).map(c => ({ ...c.data(), id: c.id, deckId: d.id, deckName: d.name })))).catch(() => [])));
  return lists.flat().filter(c => c.front && c.back && c.kind !== 'info').map(c => ({
    id: c.id, deckId: c.deckId, deckName: c.deckName,
    f: String(c.front), b: String(c.back), fl: c.frontLang || null, cl: c.codeLang || null, fi: c.frontImg || null,
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
  // Správná je jen jedna z A–D: když má karta víc správných odpovědí (alsoCorrect), střídá se, která z nich to je.
  // Ostatní správné se mezi špatné nedostanou (jsou v `used`).
  const ok = [...card.ok].filter(v => String(v).trim());
  const right = ok.length > 1 ? ok[Math.floor(rnd() * ok.length)] : card.b;
  const opts = shuffle([right, ...wrong], rnd);
  return { opts, correct: opts.indexOf(right) };
}

// Otázka / odpověď: kód jako blok kódu (codehl.js ho obarví), jinak text.
function mcCode(text, lang) { return `<pre class="code-block" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>`; }
function mcQuestionHtml(card) {
  // Obrázek z přední strany karty (cardImgHtml je v codehl.js)
  const img = card.fi && typeof cardImgHtml === 'function' ? cardImgHtml(card.fi, 'mc-q-img') : '';
  return img + mcQuestionBody(card);
}
function mcQuestionBody(card) {
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

// Výběr balíčků na úvodní obrazovce hry (zaškrtávátka, „Vybrat vše“,
// zapamatovaný výběr). opts: { list, all, start, hint, key, decks, hintFor(n, ds) }
// Výběr balíčků ve dvou sbalovacích kategoriích: Moje karty (vlastní + z místností) a Všeobecné karty (vestavěné).
const mcIsSb = d => typeof sbIsBuiltin === 'function' && sbIsBuiltin(d.id);
// MC_GRP, mcGrpHTML, mcWireGroups … jsou v js/sbdecks.js (sdílí je i Zombie Survival, který mcgame.js nenačítá)
function mcDeckListHTML(decks, sel) {
  const row = d => `<label class="mc-deck" data-deck-id="${d.id}"><input type="checkbox" value="${d.id}"${sel.has(d.id) ? ' checked' : ''}>
    <span><b>${esc(d.name)}</b><small>${d.cardCount || 0} karet${d.roomName && !mcIsSb(d) ? ' · ' + esc(d.roomName) : ''}</small><small class="dkf-st" data-dkst></small></span></label>`;
  const by = { own: decks.filter(d => !mcIsSb(d)), sb: decks.filter(mcIsSb) };
  return MC_GRP.filter(([g]) => by[g].length).map(([g, t]) => mcGrpHTML(g, t, by[g].map(row).join(''), by[g].length)).join('');
}
// Počty „vybráno/celkem“ v hlavičkách skupin
function mcGrpCounts(el) {
  el.querySelectorAll('.mc-dgrp').forEach(grp => { const bx = grp.querySelectorAll('input'), c = grp.querySelectorAll('input:checked').length; grp.querySelector('[data-grpn]').textContent = c ? `${c}/${bx.length}` : bx.length; });
}
// „Vybrat vše“ nahoře přepíná všechny balíčky, tlačítka ve skupinách jen svou skupinu
function mcWireDeckAll(el, allBtn, update, decks) {
  const upd = () => { mcGrpCounts(el); update(); };
  // jen balíčky, které filtr ukazuje (js/deckfilter.js)
  const toggle = boxes => { boxes = boxes.filter(b => !b.closest('[hidden]')); if (!boxes.length) return; const all = boxes.every(b => b.checked); boxes.forEach(b => { b.checked = !all; }); upd(); };
  if (allBtn) allBtn.onclick = () => toggle([...el.querySelectorAll('input[type=checkbox]')]);
  mcWireGroups(el, g => toggle([...el.querySelectorAll(`[data-grp="${g}"] input`)]));
  el.addEventListener('change', () => mcGrpCounts(el));
  mcGrpCounts(el);
  if (decks && window.SBDeckFilter) SBDeckFilter.mount(el, decks, ME?.uid, update);
}
function mcDeckPicker(o) {
  const el = $(o.list);
  if (!o.decks.length) { el.innerHTML = '<div class="mc-muted">Nemáš žádné balíčky s kartičkami. Vytvoř si nějaký ve Flash Cards.</div>'; return () => []; }
  let sel;
  try { sel = new Set(JSON.parse(localStorage.getItem(o.key) || '[]')); } catch (_) { sel = new Set(); }
  el.innerHTML = mcDeckListHTML(o.decks, sel);
  const chosen = () => [...el.querySelectorAll('input:checked')].map(i => o.decks.find(d => d.id === i.value)).filter(Boolean);
  const update = () => {
    const ds = chosen(), n = ds.reduce((s, d) => s + (d.cardCount || 0), 0);
    $(o.start).disabled = !ds.length;
    $(o.hint).textContent = ds.length ? (o.hintFor ? o.hintFor(n, ds) : `${n} karet k dispozici.`) : 'Vyber aspoň jeden balíček.';
  };
  el.addEventListener('change', update);
  mcWireDeckAll(el, $(o.all), update, o.decks);
  update();
  return () => { const ds = chosen(); try { localStorage.setItem(o.key, JSON.stringify(ds.map(d => d.id))); } catch (_) { /* nic */ } return ds; };
}

// ── Krátké pojmy (šibenice, osmisměrka, křížovka) ─────────────────
const baseCh = ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const isLetterCh = ch => /\p{L}/u.test(ch);
function mcShortTerm(t, maxLen = 24, maxWords = 3) {
  t = t.trim();
  const letters = [...t].filter(isLetterCh).length;
  return t.length >= 2 && t.length <= maxLen && t.split(/\s+/).length <= maxWords && letters >= 2 && !/[?\n]/.test(t);
}
// Z karty udělá { word, clue, lbl }: hádá se krátká odpověď (nápověda = otázka),
// nebo krátký pojem vpředu, když je vzadu jeho definice (nápověda = definice).
function mcTermOf(c, maxLen, maxWords) {
  if (c.fl || c.cl) return null;
  if (mcShortTerm(c.b, maxLen, maxWords) && !mcShortTerm(c.f, maxLen, maxWords)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
  if (mcShortTerm(c.f, maxLen, maxWords) && c.b.length > c.f.length) return { word: c.f.trim(), clue: c.b, lbl: 'Co je to?', card: c };
  if (mcShortTerm(c.b, maxLen, maxWords)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
  return null;
}
// Pro mřížku (osmisměrka, křížovka): jedno slovo jen z písmen, bez háčků, VELKÝMI.
// Víceslovné pojmy se slijí („Rozlehlá síť“ → ROZLEHLASIT).
function mcGridTerms(cards, minLen = 3, maxLen = 12) {
  const seen = new Set();
  return cards.map(c => mcTermOf(c, 24, 2)).filter(Boolean).map(t => {
    const grid = [...t.word].filter(isLetterCh).map(baseCh).join('');
    return { ...t, grid };
  }).filter(t => t.grid.length >= minLen && t.grid.length <= maxLen && /^[A-Z]+$/.test(t.grid))
    .filter(t => { if (seen.has(t.grid)) return false; seen.add(t.grid); return true; });
}

const params  = new URLSearchParams(window.location.search);
const DECK_ID = params.get('deck');
const ROOM_ID = params.get('room');
// Gemini/Groq calling logic lives in js/ai.js (shared with room.js's AI
// flashcards feature) — see aiGenerate()/aiErrorMessage() below.

let ME         = null;
let DECK       = null;
let ALL_CARDS  = [];
let STUDY_QUEUE = [];
let STUDY_IDX  = 0;
let KNOWN      = 0;
let IS_FLIPPED = false;
let STUDY_KIND = null;   // u setu: který krok se právě dělá (info / learn)

// ── Auth guard ─────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
  ME = user;
  if (DECK_ID) loadDeck();
  else         loadDeckList();
});

// ── Views ──────────────────────────────────────────────────────
const views = {
  decks:   document.getElementById('viewDecks'),
  cards:   document.getElementById('viewCards'),
  study:   document.getElementById('viewStudy'),
  results: document.getElementById('viewResults'),
};

function showView(name) {
  Object.values(views).forEach(v => (v.style.display = 'none'));
  views[name].style.display = 'block';
}

// ── Deck list ──────────────────────────────────────────────────
async function loadDeckList() {
  showView('decks');

  if (ROOM_ID) {
    // Ověř přístup k místnosti
    try {
      const roomDoc = await db.collection('rooms').doc(ROOM_ID).get();
      if (!roomDoc.exists || !(roomDoc.data().memberIds || []).includes(ME.uid)) {
        window.location.href = 'dashboard.html'; return;
      }
      const room = roomDoc.data();
      document.getElementById('navTitle').textContent       = room.name + ' – Flash Cards';
      document.getElementById('deckListTitle').textContent  = 'Flash Cards';
      document.getElementById('deckListSub').textContent    = 'Balíčky v místnosti ' + room.name;
      document.getElementById('backBtn').href               = `room.html?id=${ROOM_ID}`;

      // Jen vlastník/editor může vytvářet balíčky pro místnost
      const role = (room.roles || {})[ME.uid];
      if (role === 'owner' || role === 'editor') {
        const btn = document.createElement('button');
        btn.className   = 'btn btn-primary';
        btn.textContent = '+ Nový balíček';
        btn.onclick = () => openModal('newDeckModal');
        document.getElementById('deckListActions').appendChild(btn);
      }
    } catch (e) { toast('Chyba: ' + e.message); return; }

    // Načti balíčky místnosti
    db.collection('decks').where('roomId', '==', ROOM_ID)
      .onSnapshot(snap => {
        const sorted = [...snap.docs].sort((a, b) =>
          (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
        renderDeckGrid(sorted);
      });
  } else {
    // Osobní balíčky
    db.collection('decks').where('ownerUid', '==', ME.uid)
      .onSnapshot(snap => {
        const personal = [...snap.docs]
          .filter(d => !d.data().roomId)
          .sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
        renderDeckGrid(personal);
      });
  }

  setupNewDeckModal();
  setupEditDeckModal();
  setupModalClose();
}

// Oblíbené balíčky (users/{uid}.favDecks) — stejné jako na hlavní stránce,
// srdíčko vedle tužky jde zaškrtnout i tady v místnosti.
let FC_FAV_DECKS = null;
const FC_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>';
async function loadFcFavDecks() {
  if (FC_FAV_DECKS) return FC_FAV_DECKS;
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    FC_FAV_DECKS = new Set((snap.exists && snap.data().favDecks) || []);
  } catch (_) { FC_FAV_DECKS = new Set(); }
  return FC_FAV_DECKS;
}
async function toggleFcFavDeck(id, btn) {
  const favs = await loadFcFavDecks();
  const on = !favs.has(id);
  if (on) favs.add(id); else favs.delete(id);
  btn.classList.toggle('on', on);
  btn.title = on ? 'Odebrat z oblíbených' : 'Přidat do oblíbených';
  try {
    await db.collection('users').doc(ME.uid).set({
      favDecks: on ? firebase.firestore.FieldValue.arrayUnion(id) : firebase.firestore.FieldValue.arrayRemove(id),
    }, { merge: true });
    toast(on ? 'Balíček přidán do oblíbených ♥' : 'Balíček odebrán z oblíbených.');
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
}

// ── Druhy balíčků ─────────────────────────────────────────────
// deck.kind: info = výkladové (jen čtení), learn = klasické, quiz = kvíz,
// set = celý set od AI (výklad + kartičky + kvíz v jednom balíčku).
// Starší balíčky druh nemají — dopočítá se z karet a vlastník ho uloží.
const DECK_KINDS = {
  info:  { ico: '📘', name: 'Výkladové' },
  learn: { ico: '🧠', name: 'Klasické' },
  quiz:  { ico: '🎯', name: 'Kvíz' },
  set:   { ico: '🧩', name: 'Celý set' },
};
const cardKind = c => (c.kind === 'info' || c.kind === 'quiz') ? c.kind : 'learn';
function kindCounts(cards) {
  const out = { info: 0, learn: 0, quiz: 0 };
  cards.forEach(c => { out[cardKind(c)]++; });
  return out;
}
function kindFromCounts(k) {
  const used = Object.keys(k).filter(x => k[x] > 0);
  return used.length > 1 ? 'set' : (used[0] || 'learn');
}
const DECK_KIND_CACHE = new Map();   // deckId → { kind, kinds }
async function inferDeckKind(doc) {
  try {
    const snap = await db.collection('decks').doc(doc.id).collection('cards').get();
    const kinds = kindCounts(snap.docs.map(d => d.data()));
    const kind = kindFromCounts(kinds);
    DECK_KIND_CACHE.set(doc.id, { kind, kinds });
    if (doc.data().ownerUid === ME.uid) db.collection('decks').doc(doc.id).update({ kind, kinds }).catch(() => {});
  } catch (_) { DECK_KIND_CACHE.set(doc.id, { kind: 'learn' }); }
}
function deckKindOf(doc) {
  const d = doc.data();
  return d.kind || DECK_KIND_CACHE.get(doc.id)?.kind || null;
}
const fold = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

let DECK_DOCS = [];
let DECK_FILTER = 'all';
let DECK_QUERY = '';
function renderDeckGrid(docs) {
  DECK_DOCS = docs;
  // Druh chybí → dopočítat (jednou na balíček) a pak překreslit.
  const missing = docs.filter(d => !d.data().kind && !DECK_KIND_CACHE.has(d.id));
  missing.forEach(d => DECK_KIND_CACHE.set(d.id, { kind: null }));
  if (missing.length) Promise.all(missing.map(inferDeckKind)).then(() => drawDeckGrid());
  drawDeckGrid();
}

function setupDeckTools() {
  if (document.getElementById('deckTools')) return;
  const bar = document.createElement('div');
  bar.id = 'deckTools';
  bar.className = 'deck-tools';
  bar.innerHTML = `
    <label class="deck-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" id="deckSearch" placeholder="Hledat balíček…" autocomplete="off" aria-label="Hledat balíček"></label>
    <div class="deck-filters" id="deckFilters" role="group" aria-label="Druh balíčku"></div>`;
  document.getElementById('decksGrid').before(bar);
  document.getElementById('deckSearch').addEventListener('input', e => { DECK_QUERY = e.target.value; drawDeckGrid(); });
  document.getElementById('deckFilters').addEventListener('click', e => {
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    DECK_FILTER = b.dataset.kind;
    drawDeckGrid();
  });
}

function drawDeckGrid() {
  setupDeckTools();
  const all = DECK_DOCS;
  const counts = { all: all.length, info: 0, learn: 0, quiz: 0, set: 0 };
  all.forEach(d => { const k = deckKindOf(d); if (k) counts[k]++; });
  if (DECK_FILTER !== 'all' && !counts[DECK_FILTER]) DECK_FILTER = 'all';
  document.getElementById('deckFilters').innerHTML =
    [['all', 'Vše'], ...Object.entries(DECK_KINDS).map(([k, v]) => [k, v.ico + ' ' + v.name])]
      .filter(([k]) => k === 'all' || counts[k])
      .map(([k, label]) => `<button type="button" class="deck-filter${DECK_FILTER === k ? ' on' : ''}" data-kind="${k}">${label} <span>${counts[k]}</span></button>`).join('');
  document.getElementById('deckTools').hidden = all.length < 2;
  const q = fold(DECK_QUERY.trim());
  const docs = all.filter(d => (DECK_FILTER === 'all' || deckKindOf(d) === DECK_FILTER) &&
    (!q || fold(d.data().name + ' ' + (d.data().description || '')).includes(q)));
  const grid = document.getElementById('decksGrid');
  if (all.length && !docs.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>Nic nenalezeno</h3><p>Zkus jiné slovo nebo jiný filtr.</p></div>';
    return;
  }
  if (!docs.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <h3>Žádné balíčky</h3>
        <p>Vytvoř první balíček flash cards.</p>
      </div>`;
    return;
  }
  grid.innerHTML = '';
  docs.forEach(doc => {
    const d = doc.data();
    const kind = deckKindOf(doc), K = kind && DECK_KINDS[kind];
    const kinds = d.kinds || DECK_KIND_CACHE.get(doc.id)?.kinds;
    const parts = kind === 'set' && kinds ? ['info', 'learn', 'quiz'].filter(k => kinds[k]).map(k => `${DECK_KINDS[k].ico} ${kinds[k]}`).join(' · ') : '';
    const isOwner = d.ownerUid === ME.uid;
    const a = document.createElement('a');
    a.href      = `flashcards.html?deck=${doc.id}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    a.className = 'deck-card';
    a.style.setProperty('--card-color', d.color || '#6366f1');
    a.innerHTML = `
      ${isOwner ? `<button class="card-edit-btn" data-edit-deck="${doc.id}" title="Upravit balíček">✏️</button>` : ''}
      ${ME.isAnonymous ? '' : `<button class="card-fav-btn" data-fav-deck="${doc.id}" title="Přidat do oblíbených" aria-label="Oblíbený balíček">${FC_HEART}</button>`}
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p class="card-desc">${esc(d.description)}</p>` : ''}
      <p class="deck-meta">${K ? `<span class="deck-kind k-${kind}">${K.ico} ${K.name}</span>` : ''}<span>${parts || (d.cardCount || 0) + ' karet'}</span></p>`;
    const editBtn = a.querySelector('[data-edit-deck]');
    if (editBtn) {
      editBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openEditDeckModal(doc.id, d);
      });
    }
    const favBtn = a.querySelector('[data-fav-deck]');
    if (favBtn) favBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      toggleFcFavDeck(doc.id, favBtn);
    });
    grid.appendChild(a);
  });
  // Srdíčka rozsvítit, až dorazí seznam oblíbených.
  loadFcFavDecks().then(favs => grid.querySelectorAll('[data-fav-deck]').forEach(b => {
    const on = favs.has(b.dataset.favDeck);
    b.classList.toggle('on', on);
    b.title = on ? 'Odebrat z oblíbených' : 'Přidat do oblíbených';
  }));
}

function setupEditDeckModal() {
  const colorInput  = document.getElementById('editDeckColorInput');
  const colorSwatch = document.getElementById('editDeckColorSwatch');
  const colorHex    = document.getElementById('editDeckColorHex');
  colorInput.addEventListener('input', () => {
    colorSwatch.style.background = colorInput.value;
    colorHex.textContent = colorInput.value;
  });
  document.getElementById('editDeckSubmit').addEventListener('click', async () => {
    const id    = document.getElementById('editDeckSubmit').dataset.deckId;
    const name  = document.getElementById('editDeckName').value.trim();
    const color = colorInput.value;
    if (!name) { toast('Zadej název balíčku.'); return; }
    try {
      await db.collection('decks').doc(id).update({ name, color });
      if (DECK && DECK.id === id) {
        DECK.name = name; DECK.color = color;
        const deckTitle = document.getElementById('deckTitle');
        const navTitle  = document.getElementById('navTitle');
        if (deckTitle) deckTitle.textContent = name;
        if (navTitle)  navTitle.textContent  = name;
      }
      closeModal('editDeckModal');
      toast('Balíček uložen!');
    } catch (e) { toast('Chyba: ' + e.message); }
  });
}

function openEditDeckModal(id, deck) {
  document.getElementById('editDeckSubmit').dataset.deckId = id;
  document.getElementById('editDeckName').value = deck.name || '';
  const color = deck.color || '#6366f1';
  document.getElementById('editDeckColorInput').value = color;
  document.getElementById('editDeckColorSwatch').style.background = color;
  document.getElementById('editDeckColorHex').textContent = color;
  openModal('editDeckModal');
}

function setupNewDeckModal() {
  const colorInput  = document.getElementById('newDeckColorInput');
  const colorSwatch = document.getElementById('newDeckColorSwatch');
  const colorHex    = document.getElementById('newDeckColorHex');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      colorSwatch.style.background = colorInput.value;
      colorHex.textContent = colorInput.value;
    });
  }

  document.getElementById('newDeckSubmit').addEventListener('click', async () => {
    const name  = document.getElementById('newDeckName').value.trim();
    const desc  = document.getElementById('newDeckDesc').value.trim();
    const color = colorInput ? colorInput.value : '#6366f1';
    if (!name) { toast('Zadej název balíčku.'); return; }
    const btn = document.getElementById('newDeckSubmit');
    btn.disabled = true; btn.textContent = 'Vytváření...';
    try {
      const ref = await db.collection('decks').add({
        name, color,
        description: desc || null,
        ownerUid:  ME.uid,
        roomId:    ROOM_ID || null,
        cardCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeModal('newDeckModal');
      document.getElementById('newDeckName').value = '';
      document.getElementById('newDeckDesc').value = '';
      window.location.href = `flashcards.html?deck=${ref.id}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    } catch (e) {
      toast('Chyba: ' + e.message);
      btn.disabled = false; btn.textContent = 'Vytvořit';
    }
  });
}

// ── Load deck + cards ──────────────────────────────────────────
let IS_DECK_OWNER = false;
let ROOM_ROLE     = null; // role of ME in the room that owns this deck (if any)

// Deck owner (Firestore ownerUid) can always manage every card and the deck
// itself. A room editor/owner may add cards and edit/delete only the ones
// they personally authored — they can never delete the whole deck.
function canManageCard(card) {
  return IS_DECK_OWNER || ((ROOM_ROLE === 'editor' || ROOM_ROLE === 'owner') && card.authorId === ME.uid);
}
function canAddCards() {
  return IS_DECK_OWNER || ROOM_ROLE === 'editor' || ROOM_ROLE === 'owner';
}

async function loadDeck() {
  try {
    const deckDoc = await db.collection('decks').doc(DECK_ID).get();
    if (!deckDoc.exists) { toast('Balíček nenalezen.'); window.history.back(); return; }

    DECK = { id: deckDoc.id, ...deckDoc.data() };
    IS_DECK_OWNER = DECK.ownerUid === ME.uid;
    ROOM_ROLE     = null;
    const isOwner = IS_DECK_OWNER;

    // Ověř přístup: owner nebo člen místnosti; zjisti i roli v místnosti
    if (DECK.roomId) {
      const roomDoc  = await db.collection('rooms').doc(DECK.roomId).get();
      const isMember = roomDoc.exists && (roomDoc.data().memberIds || []).includes(ME.uid);
      if (!isOwner && !isMember) {
        toast('Nemáš přístup.'); window.location.href = 'dashboard.html'; return;
      }
      if (isMember) ROOM_ROLE = (roomDoc.data().roles || {})[ME.uid] || null;
    } else if (!isOwner) {
      toast('Nemáš přístup.'); window.location.href = 'dashboard.html'; return;
    }

    const backHref = ROOM_ID
      ? `flashcards.html?room=${ROOM_ID}`
      : (DECK.roomId ? `flashcards.html?room=${DECK.roomId}` : 'dashboard.html');
    document.getElementById('backBtn').href     = backHref;
    document.getElementById('navTitle').textContent = esc(DECK.name);

    showView('cards');
    document.getElementById('deckTitle').textContent = esc(DECK.name);
    LEARN_LOADING = loadLearn();

    if (canAddCards()) {
      document.getElementById('addCardForm').style.display = 'block';
      setupAddCard();
      setupEditCardModal();
    }

    // Deck toolbar (v10): the three ways to learn stay visible; rarely used
    // things (stats, rename, delete) sit in the ⋯ menu.
    const ICO = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const actions = document.getElementById('deckActions');
    const quizHref  = `quiz.html?deck=${DECK_ID}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    const smartHref = `quiz.html?deck=${DECK_ID}&smart=1${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    actions.classList.add('deck-actions');
    actions.innerHTML = `
      <button class="btn btn-primary" id="studyBtn">${ICO('<path d="M7 4v16l13-8z"/>')}Studovat</button>
      <button class="btn btn-secondary" id="typeBtn" title="Napíšeš odpověď a aplikace ji zkontroluje">${ICO('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>')}Psaní</button>
      <button class="btn btn-secondary" id="clozeBtn" style="display:none;" title="Z výkladových karet se vynechají slova a ty je doplníš">${ICO('<rect x="3" y="10" width="7" height="4" rx="1"/><path d="M13 12h8M3 6h18M3 18h12"/>')}Doplňovačka</button>
      <a class="btn btn-secondary" id="quizBtn" href="${quizHref}">${ICO('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}Kvíz</a>
      <a class="btn btn-secondary" id="smartBtn" href="${smartHref}" title="Chytré procvičování — opakuje hlavně to, co ti nejde">${ICO('<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/>')}Chytře</a>
      ${canAddCards() ? `<button class="btn btn-ghost" id="bulkDistractorsBtn" title="Vygeneruje špatné odpovědi (možnosti do kvízu) ke všem kartám, které je ještě nemají">🤖 AI odpovědi ke všem</button>` : ''}
      <div class="nav-menu-wrap">
        <button class="icon-btn" id="deckMoreBtn" aria-label="Další možnosti" aria-haspopup="true" aria-expanded="false" title="Další možnosti">${ICO('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>')}</button>
        <div class="nav-menu" id="deckMoreMenu" role="menu">
          <button type="button" class="nav-menu-item" id="statsBtn" role="menuitem">${ICO('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>')}<span>Statistiky</span></button>
          ${isOwner ? `<button type="button" class="nav-menu-item" id="renameDeckBtn" role="menuitem">${ICO('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>')}<span>Přejmenovat</span></button>
          <button type="button" class="nav-menu-item danger" id="deleteDeckBtn" role="menuitem">🗑️<span>Smazat balíček</span></button>` : ''}
        </div>
      </div>`;
    document.getElementById('studyBtn').addEventListener('click', () => {
      if (isSetDeck()) runSetStep(nextSetStep(['info', 'learn']) || 'learn');
      else startStudy(false, null, 'flip');
    });
    document.getElementById('typeBtn').addEventListener('click', () => startStudy(false, isSetDeck() ? 'learn' : null, 'type'));
    document.getElementById('clozeBtn').addEventListener('click', () => startStudy(false, isSetDeck() ? 'info' : null, 'cloze'));
    document.getElementById('statsBtn').addEventListener('click', openLearnStats);
    document.getElementById('bulkDistractorsBtn')?.addEventListener('click', bulkGenerateDistractors);
    const moreBtn = document.getElementById('deckMoreBtn'), moreMenu = document.getElementById('deckMoreMenu');
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !moreMenu.classList.contains('open');
      moreMenu.classList.toggle('open', open);
      moreBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => { moreMenu.classList.remove('open'); moreBtn.setAttribute('aria-expanded', 'false'); });
    if (isOwner) {
      document.getElementById('renameDeckBtn').addEventListener('click', () => openEditDeckModal(DECK_ID, DECK));
      document.getElementById('deleteDeckBtn').addEventListener('click', () => openModal('deleteDeckModal'));
      setupDeleteModal();
      setupEditDeckModal();
    }

    // Real-time karty
    db.collection('decks').doc(DECK_ID).collection('cards')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        // Karty uložené jednou dávkou (AI) mají stejný čas — pořadí drží „order“.
        ALL_CARDS = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
        renderCardsList();
        renderSetPath();
        document.getElementById('deckCardCount').textContent = `${ALL_CARDS.length} karet`;
        const qb = document.getElementById('quizBtn');
        if (qb) qb.href = quizHref + (isSetDeck() ? '&kind=quiz' : '');
        // Aktualizuj počet a druh v deck doc
        // (jen když se opravdu změnil — zbytečný zápis při každé změně karet)
        const kinds = kindCounts(ALL_CARDS), kind = kindFromCounts(kinds);
        if (isOwner && (DECK.cardCount !== ALL_CARDS.length || DECK.kind !== kind || JSON.stringify(DECK.kinds || {}) !== JSON.stringify(kinds))) {
          Object.assign(DECK, { cardCount: ALL_CARDS.length, kinds, kind });
          db.collection('decks').doc(DECK_ID).update({ cardCount: ALL_CARDS.length, kinds, kind }).catch(() => {});
        }
        // Disable study if no cards
        const sb = document.getElementById('studyBtn');
        if (sb) sb.disabled = ALL_CARDS.length === 0;
        const tb = document.getElementById('typeBtn'), cb = document.getElementById('clozeBtn');
        if (tb) tb.style.display = ALL_CARDS.some(c => !isInfo(c)) ? '' : 'none';
        if (cb) cb.style.display = ALL_CARDS.some(c => isInfo(c) && clozeCandidates(c.back).length) ? '' : 'none';
      });

  } catch (e) {
    toast('Chyba: ' + e.message);
  }

  setupModalClose();
}

// Models routinely put REAL newlines/tabs inside JSON string values when the
// value is source code — which is invalid JSON, so JSON.parse would throw and
// lose the whole batch. Re-escape control characters that sit inside a string
// literal before parsing. (Escapes already written as \n are left alone.)
function repairAiJson(txt) {
  let out = '', inStr = false, esc = false;
  for (const ch of txt) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && (ch === '\n' || ch === '\r' || ch === '\t')) {
      out += ch === '\n' ? '\\n' : (ch === '\r' ? '\\r' : '\\t');
      continue;
    }
    out += ch;
  }
  return out;
}

// Monospace block with the indentation kept — the whole point of a code card.
function codeBlockHtml(code, lang) {
  return `<pre class="code-block"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(code || '')}</code></pre>`;
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
function codeQuestionHtml(code, lang) {
  const { code: c, question } = splitCodeQuestion(code);
  return (question ? `<div class="code-q">${esc(question)}</div>` : '') + codeBlockHtml(c, lang);
}

function renderCardContent(card) {
  if (card.codeLang) return codeBlockHtml(card.back, card.codeLang);
  if (card.tableData) {
    const { headers = [], rows = [] } = card.tableData;
    let html = '<div class="card-table-wrap"><table class="card-table"><thead><tr>';
    headers.forEach(h => { html += `<th>${esc(h)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => { html += `<td>${esc(cell)}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }
  return `<div class="card-side-txt">${esc(card.back)}</div>`;
}

function renderCardsList() {
  const list = document.getElementById('cardsList');
  if (!ALL_CARDS.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Žádné karty. ${canAddCards() ? 'Přidej první výše!' : ''}</div>`;
    return;
  }
  list.innerHTML = '';
  const setDeck = isSetDeck();
  const order = { info: 0, learn: 1, quiz: 2 };
  (setDeck ? ALL_CARDS.slice().sort((a, b) => order[cardKind(a)] - order[cardKind(b)]) : ALL_CARDS).forEach(card => {
    const row = document.createElement('div');
    row.className = 'card-row';
    const editable = canManageCard(card);
    const K = DECK_KINDS[cardKind(card)];
    const tag = setDeck ? ` · ${K.ico} ${K.name}` : '';
    const distractorBadge = (card.distractors && card.distractors.length)
      ? `<div class="card-distractors-row">❌ ${card.distractors.map(d=>`<span class="distractor-badge">${esc(d)}</span>`).join(' ')}</div>` : '';
    row.innerHTML = `
      <div class="card-sides">
        <div>
          <div class="card-side-lbl">Přední${tag}</div>
          ${card.frontLang ? codeQuestionHtml(card.front, card.frontLang) : `<div class="card-side-txt">${esc(card.front)}</div>`}
        </div>
        <div>
          <div class="card-side-lbl">Zadní</div>
          ${renderCardContent(card)}
          ${distractorBadge}
        </div>
      </div>
      ${editable ? `
        <div class="card-row-actions">
          <button class="btn btn-ghost card-act-btn" data-edit="${card.id}" title="Upravit kartu" aria-label="Upravit kartu">✏️</button>
          <button class="btn btn-ghost card-act-btn" data-del="${card.id}" title="Smazat kartu" aria-label="Smazat kartu">🗑️</button>
        </div>` : ''}`;
    list.appendChild(row);
  });

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDialog('Smazat tuto kartu?', async () => {
        try {
          await db.collection('decks').doc(DECK_ID).collection('cards').doc(btn.dataset.del).delete();
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    });
  });
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = ALL_CARDS.find(c => c.id === btn.dataset.edit);
      if (card) openEditCard(card);
    });
  });
}

// ── Edit card ──────────────────────────────────────────────────
let EDIT_CARD_ID     = null;
let editDistractors  = [];

function openEditCard(card) {
  EDIT_CARD_ID    = card.id;
  editDistractors = [...(card.distractors || [])];
  document.getElementById('editCardFront').value   = card.front || '';
  document.getElementById('editCardBack').value    = card.back  || '';
  document.getElementById('editAnswerCount').value = String(card.answerCount || 4);
  editCorrects = [...(card.corrects || [])];
  renderEditCorrects();
  document.getElementById('editFrontLang').value   = card.frontLang || '';
  document.getElementById('editCodeLang').value    = card.codeLang  || '';
  document.getElementById('editAISuggestions').style.display = 'none';
  renderEditDistractors();
  openModal('editCardModal');
}

function renderEditDistractors() {
  const list = document.getElementById('editDistractorsList');
  list.innerHTML = '';
  editDistractors.forEach((d, i) => {
    const tag = document.createElement('span');
    tag.className = 'distractor-tag';
    tag.innerHTML = `<span class="distractor-text" contenteditable="true" spellcheck="false">${esc(d)}</span><button class="distractor-rm" data-i="${i}">×</button>`;

    const textEl = tag.querySelector('.distractor-text');
    const commit = () => {
      const val = textEl.textContent.trim();
      if (val) editDistractors[i] = val;
      else renderEditDistractors(); // emptied out — drop it and re-render
    };
    textEl.addEventListener('blur', commit);
    textEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); }
    });

    tag.querySelector('.distractor-rm').addEventListener('click', () => {
      editDistractors.splice(i, 1);
      renderEditDistractors();
    });
    list.appendChild(tag);
  });
}


async function geminiSuggestDistractors(front, back, count = 3) {
  const prompt = `Generate exactly ${count} wrong but plausible multiple-choice distractors for this flashcard.
Question: "${front}"
Correct answer: "${back}"
Rules: same format/length/language as the correct answer, plausible but clearly wrong to an expert, not variations of each other.
Return ONLY a JSON array of ${count} strings: ["d1","d2",...]`;

  return aiGenerate(prompt, {
    parse(text) {
      // Strip ```json fences first — without this, a bracket-match that
      // fails (e.g. an item contains a literal "]") fell through to the
      // line-based fallback on the RAW text, leaking "```json [ ..." fence
      // artifacts into a "suggestion" chip.
      const cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('[');
      const end   = cleaned.lastIndexOf(']');
      if (start !== -1 && end > start) {
        try {
          const arr = JSON.parse(repairAiJson(cleaned.slice(start, end + 1)));
          if (Array.isArray(arr) && arr.length >= count) return arr.slice(0, count).map(String);
        } catch (_) { /* malformed — fall through to line-based parsing below */ }
      }
      const lines = cleaned.split('\n')
        .map(l => l.replace(/^[\s\d.\-•*"'[\]]+|["',[\]]+$/g, '').trim())
        .filter(Boolean);
      if (lines.length >= count) return lines.slice(0, count);
      throw new Error('parse');
    },
  });
}

// ── Bulk AI answer pools ──────────────────────────────────────
// One request per card, so every set of options is tailored to its own
// question. The point is a POOL, not a fixed set: the quiz picks a random
// subset each time, so a card with six wrong answers stops looking the same
// on the second run. Saves as it goes, so a mid-way failure keeps whatever
// already succeeded.
const POOL_WRONG = 6;   // wrong answers to aim for per card
const POOL_ALSO  = 3;   // extra genuinely-correct answers, when they exist

// Asks for both pools at once. Returns { wrong: [...], alsoCorrect: [...] }.
async function geminiSuggestPool(front, back, existing) {
  const already = (existing || []).length
    ? `\nAlready used, do NOT repeat these: ${JSON.stringify(existing)}`
    : '';
  const prompt = `You are building multiple-choice options for one flashcard.
Question: ${JSON.stringify(front)}
Correct answer: ${JSON.stringify(back)}${already}

Return JSON with two arrays, in the SAME language as the card:
- "wrong": ${POOL_WRONG} plausible but clearly WRONG answers. Same format, length and style as the correct answer. They must NOT be variations of each other, and none of them may actually be correct.
- "alsoCorrect": up to ${POOL_ALSO} OTHER independently correct choices that should be selected together with the saved answer when shown. Add them only if the existing question clearly asks for multiple items (for example, "Which ...?" about a set). Do NOT add synonyms, paraphrases, mutually exclusive alternatives, or several possible answers to a question asking for just one. Use an EMPTY array for a genuinely single-answer question — never pad it with half-truths.

Return ONLY this JSON, nothing else: {"wrong":["..."],"alsoCorrect":["..."]}`;

  return aiGenerate(prompt, {
    maxOutputTokens: 900,
    parse(text) {
      const cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('parse');
      const o = JSON.parse(repairAiJson(cleaned.slice(start, end + 1)));
      const arr = v => (Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(Boolean);
      const wrong = arr(o.wrong), also = arr(o.alsoCorrect);
      if (!wrong.length) throw new Error('empty');
      return { wrong, alsoCorrect: also };
    },
  });
}

async function bulkGenerateDistractors() {
  const btn = document.getElementById('bulkDistractorsBtn');
  const mine = ALL_CARDS.filter(c => canManageCard(c) && c.front && c.back && !c.tableData);
  if (!mine.length) { toast('Žádné karty, které bys mohl upravit.'); return; }

  // A card is "thin" when its pool is too small for the quiz to vary options.
  let targets = mine.filter(c => (c.distractors || []).length < POOL_WRONG);
  let topUp = true;
  if (!targets.length) {
    if (!confirm(`Všechny karty už mají plnou zásobu (${POOL_WRONG} špatných odpovědí).
Vygenerovat je znovu a ty staré přepsat?`)) return;
    targets = mine;
    topUp = false;
  } else if (!confirm(
      `Doplnit AI odpovědi u ${targets.length} z ${mine.length} karet?

` +
      `Ke každé kartě vznikne až ${POOL_WRONG} špatných odpovědí — kvíz z nich pak pokaždé
` +
      `vybere jinou sadu, takže se otázky neokoukají. Kde to dává smysl, přidá i další
` +
      `správné odpovědi (pak se zaškrtává víc možností).`)) {
    return;
  }

  btn.disabled = true;
  let done = 0, failed = 0, added = 0, multi = 0;
  for (const card of targets) {
    btn.textContent = `⏳ ${done + failed + 1}/${targets.length}`;
    const keep = topUp ? (card.distractors || []) : [];
    try {
      const res = await geminiSuggestPool(card.front, card.back, keep);
      const lower = new Set([String(card.back).toLowerCase()]);

      // Extra correct answers first — they define what a distractor may NOT be.
      const corrects = [...new Set([...(topUp ? (card.corrects || []) : []), ...res.alsoCorrect])]
        .filter(x => x && !lower.has(x.toLowerCase()))
        .slice(0, POOL_ALSO);
      corrects.forEach(c => lower.add(c.toLowerCase()));

      // Anything "wrong" that is actually a correct answer would punish the
      // right choice, so it never makes it into the pool.
      const wrong = [...new Set([...keep, ...res.wrong])]
        .filter(x => x && !lower.has(x.toLowerCase()))
        .slice(0, POOL_WRONG);
      if (!wrong.length) throw new Error('empty');

      const patch = { distractors: wrong };
      if (corrects.length) patch.corrects = corrects;
      await db.collection('decks').doc(DECK_ID).collection('cards').doc(card.id).update(patch);

      added += wrong.length - keep.length;
      if (corrects.length) multi++;
      done++;
    } catch (_) {
      failed++;
    }
    // Small gap between calls — free AI tiers rate-limit bursts.
    if (done + failed < targets.length) await new Promise(r => setTimeout(r, 700));
  }

  btn.disabled = false;
  btn.textContent = '🤖 AI odpovědi ke všem';
  const bits = [`${done} karet ✓`];
  if (added > 0) bits.push(`+${added} špatných odpovědí`);
  if (multi) bits.push(`${multi}× víc správných`);
  if (failed) bits.push(`${failed} se nepovedlo`);
  toast('Hotovo: ' + bits.join(' · '));
}

// Extra correct answers for a card — same chip UI as the distractors.
let editCorrects = [];

function renderEditCorrects() {
  const list = document.getElementById('editCorrectsList');
  if (!list) return;
  list.innerHTML = '';
  editCorrects.forEach((d, i) => {
    const tag = document.createElement('span');
    tag.className = 'distractor-tag is-correct';
    tag.innerHTML = `<span class="distractor-text">${esc(d)}</span><button class="distractor-rm">×</button>`;
    tag.querySelector('.distractor-rm').addEventListener('click', () => { editCorrects.splice(i, 1); renderEditCorrects(); });
    list.appendChild(tag);
  });
}

function setupEditCardModal() {
  const addCorrect = () => {
    const inp = document.getElementById('editCorrectInput');
    const val = inp.value.trim();
    if (!val || editCorrects.includes(val)) { inp.value = ''; return; }
    editCorrects.push(val);
    inp.value = '';
    renderEditCorrects();
  };
  document.getElementById('editCorrectAdd').addEventListener('click', addCorrect);
  document.getElementById('editCorrectInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addCorrect(); }
  });

  document.getElementById('editDistractorAdd').addEventListener('click', () => {
    const inp = document.getElementById('editDistractorInput');
    const val = inp.value.trim();
    if (!val || editDistractors.includes(val)) { inp.value=''; return; }
    editDistractors.push(val);
    inp.value = '';
    renderEditDistractors();
  });
  document.getElementById('editDistractorInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('editDistractorAdd').click(); }
  });
  document.getElementById('editDistractorAI').addEventListener('click', async () => {
    const btn = document.getElementById('editDistractorAI');
    const front = document.getElementById('editCardFront').value.trim();
    const back  = document.getElementById('editCardBack').value.trim();
    if (!front || !back) { toast('Nejdřív vyplň obě strany karty.'); return; }
    btn.disabled = true; btn.textContent = '⏳';
    const suggestEl = document.getElementById('editAISuggestions');
    suggestEl.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted);" id="aiStatusMsg">Generuji…</span>';
    suggestEl.style.display = 'block';
    try {
      // Offer a whole pool to pick from, not just enough for one layout —
      // the quiz draws a random subset, so more stored options = more variety.
      const suggestions = await geminiSuggestDistractors(front, back, POOL_WRONG);
      suggestEl.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted);display:block;margin-bottom:4px;">Klikni pro přidání:</span>';
      suggestions.forEach(s => {
        const chip = document.createElement('button');
        chip.className = 'btn btn-ghost distractor-suggestion';
        chip.textContent = s;
        chip.style.cssText = 'font-size:0.8rem;padding:3px 10px;margin:2px;border:1px dashed var(--border);';
        chip.addEventListener('click', () => {
          if (!editDistractors.includes(s)) { editDistractors.push(s); renderEditDistractors(); }
          chip.remove();
          if (!suggestEl.querySelectorAll('button').length) suggestEl.style.display = 'none';
        });
        suggestEl.appendChild(chip);
      });
    } catch(e) {
      const msg = aiErrorMessage(e);
      suggestEl.innerHTML = `<span style="color:#fca5a5;font-size:0.8rem;">${msg}</span>`;
    }
    btn.disabled = false; btn.textContent = '🤖';
  });
  document.getElementById('saveEditCardBtn').addEventListener('click', async () => {
    if (!EDIT_CARD_ID) return;
    const front = document.getElementById('editCardFront').value.trim();
    const back  = document.getElementById('editCardBack').value.trim();
    if (!front || !back) { toast('Vyplň obě strany.'); return; }
    const btn = document.getElementById('saveEditCardBtn');
    btn.disabled = true;
    try {
      const answerCount = parseInt(document.getElementById('editAnswerCount').value) || 4;
      await db.collection('decks').doc(DECK_ID).collection('cards').doc(EDIT_CARD_ID).update({
        front, back,
        corrects: editCorrects,
        frontLang: document.getElementById('editFrontLang').value || null,
        codeLang:  document.getElementById('editCodeLang').value  || null,
        distractors: editDistractors,
        answerCount,
      });
      closeModal('editCardModal');
      toast('Karta uložena!');
    } catch(e) { toast('Chyba: '+e.message); }
    btn.disabled = false;
  });
}

// ── 3-phase delete modal ───────────────────────────────────────
function setupDeleteModal() {
  const showPhase = ph => {
    document.getElementById('delPhase1').style.display = ph===1 ? 'block' : 'none';
    document.getElementById('delPhase2').style.display = ph===2 ? 'block' : 'none';
    document.getElementById('delPhase3').style.display = ph===3 ? 'block' : 'none';
  };
  document.getElementById('delDeckNameHint').textContent = DECK.name;
  const ov = document.getElementById('deleteDeckModal');
  new MutationObserver(() => {
    if (ov.classList.contains('open')) {
      showPhase(1);
      document.getElementById('delConfirmInput').value = '';
      document.getElementById('delConfirmErr').textContent = '';
    }
  }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  document.getElementById('delNext1').addEventListener('click', () => showPhase(2));
  document.getElementById('delBack2').addEventListener('click', () => showPhase(1));
  document.getElementById('delNext2').addEventListener('click', () => showPhase(3));
  document.getElementById('delBack3').addEventListener('click', () => showPhase(2));
  document.getElementById('confirmDeleteDeck').addEventListener('click', async () => {
    const val = document.getElementById('delConfirmInput').value.trim();
    if (val !== DECK.name) {
      document.getElementById('delConfirmErr').textContent = 'Název se neshoduje. Zkus to znovu.';
      return;
    }
    await deleteDeck();
  });
}

function setupAddCard() {
  document.getElementById('addCardSubmit').addEventListener('click', async () => {
    const front = document.getElementById('cardFront').value.trim();
    const back  = document.getElementById('cardBack').value.trim();
    if (!front || !back) { toast('Vyplň obě strany karty.'); return; }
    const btn = document.getElementById('addCardSubmit');
    btn.disabled = true;
    try {
      await db.collection('decks').doc(DECK_ID).collection('cards').add({
        front, back,
        authorId:   ME.uid,
        authorName: ME.displayName || ME.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      document.getElementById('cardFront').value = '';
      document.getElementById('cardBack').value  = '';
      toast('Karta přidána!');
    } catch (e) { toast('Chyba: ' + e.message); }
    btn.disabled = false;
  });
}

async function deleteDeck() {
  try {
    const cardSnap = await db.collection('decks').doc(DECK_ID).collection('cards').get();
    const batch    = db.batch();
    cardSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('decks').doc(DECK_ID));
    await batch.commit();
    const dest = ROOM_ID ? `flashcards.html?room=${ROOM_ID}` : 'dashboard.html';
    window.location.href = dest;
  } catch (e) { toast('Chyba: ' + e.message); }
}

// ── Celý set: výklad → kartičky → kvíz ─────────────────────────
// Doporučené pořadí, ale vybrat si jde cokoli. Hotové kroky si pamatuje
// prohlížeč (jen pro fajfku, nic důležitého).
const SET_STEPS = [
  { kind: 'info',  ico: '📘', name: 'Přečti si výklad', desc: 'Krátké informace na první seznámení — jen čteš, nic se nezkouší.' },
  { kind: 'learn', ico: '🧠', name: 'Procvič kartičky', desc: 'Otázka → odpovíš v duchu → otočíš a ohodnotíš se.' },
  { kind: 'quiz',  ico: '🎯', name: 'Otestuj se kvízem', desc: 'Na konec možnosti A/B/C/D — ukáže, co opravdu umíš.' },
];
const quizHrefBase = () => `quiz.html?deck=${DECK_ID}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
function setProgress() {
  try { return JSON.parse(localStorage.getItem('sb_set_' + DECK_ID) || '{}') || {}; } catch (_) { return {}; }
}
function markSetStep(kind) {
  const p = setProgress(); p[kind] = Date.now();
  try { localStorage.setItem('sb_set_' + DECK_ID, JSON.stringify(p)); } catch (_) { /* jen fajfka */ }
}
function isSetDeck() {
  return DECK?.kind === 'set' || kindFromCounts(kindCounts(ALL_CARDS)) === 'set';
}
function setSteps() {
  const counts = kindCounts(ALL_CARDS);
  return SET_STEPS.filter(st => counts[st.kind]).map(st => ({ ...st, count: counts[st.kind] }));
}
function nextSetStep(only) {
  const done = setProgress();
  return setSteps().find(st => !done[st.kind] && (!only || only.includes(st.kind)))?.kind || null;
}
function runSetStep(kind) {
  if (kind === 'quiz') { window.location.href = quizHrefBase() + '&kind=quiz'; return; }
  startStudy(false, kind, 'flip');
}
function renderSetPath() {
  const el = document.getElementById('setPath');
  if (!el) return;
  const steps = setSteps();
  if (!isSetDeck() || steps.length < 2) { el.style.display = 'none'; return; }
  const done = setProgress(), next = nextSetStep();
  const canCloze = ALL_CARDS.some(c => isInfo(c) && clozeCandidates(c.back).length);
  const canType = ALL_CARDS.some(c => !isInfo(c));
  el.style.display = '';
  el.innerHTML = `<div class="set-path-h">🧩 Celý set <span>vyber, co chceš dělat — doporučené pořadí je zleva doprava</span></div>
    <div class="set-steps">` + steps.map((st, i) => `
      <button type="button" class="set-step${done[st.kind] ? ' done' : ''}${st.kind === next ? ' next' : ''}" data-step="${st.kind}">
        <span class="set-step-top"><span class="set-step-n">${done[st.kind] ? '✓' : i + 1}</span><span class="set-step-ico">${st.ico}</span>${st.kind === next ? '<i>Na řadě</i>' : ''}</span>
        <b>${st.name}</b>
        <small>${st.desc}</small>
        <em>${st.count} karet</em>
      </button>`).join('') + '</div>' +
    (canCloze || canType ? `<div class="set-alt"><span>Nebo jinak:</span>
      ${canCloze ? '<button type="button" class="btn btn-ghost" data-alt="cloze" title="Z výkladu se vynechají slova a ty je doplníš">🧩 Doplňovačka z výkladu</button>' : ''}
      ${canType ? '<button type="button" class="btn btn-ghost" data-alt="type" title="Odpověď napíšeš a aplikace ji zkontroluje">✍️ Psát odpovědi</button>' : ''}</div>` : '');
  el.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => runSetStep(b.dataset.step)));
  el.querySelector('[data-alt="cloze"]')?.addEventListener('click', () => startStudy(false, 'info', 'cloze'));
  el.querySelector('[data-alt="type"]')?.addEventListener('click', () => startStudy(false, 'learn', 'type'));
}

// ── Kontrola napsané odpovědi ──────────────────────────────────
// Velikost písmen, háčky a interpunkce se nepočítají a drobný překlep se
// odpustí. Dlouhou odpověď (věta, definice) přesně netrefí nikdo — tam
// aplikace jen ukáže obě a ohodnotíš se sám.
const normAns = t => fold(t).replace(/[.,;:!?„“”"'()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 8) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
function answerMatches(val, card) {
  const v = normAns(val);
  if (!v) return false;
  return [card.back, ...(card.corrects || [])].some(t => {
    const n = normAns(t);
    if (!n) return false;
    if (v === n) return true;
    return n.length <= 60 && levenshtein(v, n) <= Math.max(1, Math.floor(n.length * 0.15));
  });
}

// ── Doplňovačka z výkladových karet ────────────────────────────
// Žádné pevné karty: pokaždé se z textu výkladu vynechají jiná slova
// (hlavně zkratky, čísla, názvy a delší odborná slova) a ta jsou odpověď.
const CLOZE_STOP = new Set(('a i o u v ve z ze k ke s se na do od po pro při za je jsou být byl byla bylo byly který která které '
  + 'kterou kterým kteří že aby nebo ale jako tak to ten ta ty tím tento tato toto této tyto jeho její jejich si sebe jen už ještě '
  + 'také když pokud než mezi podle pod nad před bez přes jak co kde kdy tedy proto může mohou musí lze není nejsou jsme jste '
  + 'další dalších jiné jiný jejím jehož každý každá každé svůj své svým the of and or is are to in on for with by an as at be it this that').split(' '));
const clozeTokens = text => String(text || '').split(/(\s+)/);
function clozeCore(tok) {
  const m = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}+#]*)$/u);
  return m ? [m[1], m[2], m[3]] : ['', tok, ''];
}
function clozeCandidates(text) {
  const toks = clozeTokens(text), out = [];
  toks.forEach((t, i) => {
    if (!t.trim()) return;
    const core = clozeCore(t)[1];
    if (!core || core.length > 24 || CLOZE_STOP.has(core.toLowerCase())) return;
    const digit = /\d/.test(core);
    const caps  = /^[\p{Lu}\d]{2,}$/u.test(core) && /\p{Lu}/u.test(core);
    const sentenceStart = i === 0 || /[.!?:]$/.test((toks[i - 2] || '').trim());
    const cap   = /^\p{Lu}/u.test(core) && !sentenceStart;
    if (!(digit || caps || core.length >= 5 || (cap && core.length >= 3))) return;
    out.push({ i, w: (digit ? 3 : 0) + (caps ? 3 : 0) + (cap ? 2 : 0) + (core.length >= 8 ? 2 : 1) });
  });
  return out;
}
function pickCloze(text) {
  const toks = clozeTokens(text), pool = clozeCandidates(text);
  const words = toks.filter(t => t.trim()).length;
  const n = Math.max(1, Math.min(3, Math.round(words / 12), pool.length));
  const picked = [];
  while (picked.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, c) => s + c.w, 0);
    const k = Math.max(0, pool.findIndex(c => (r -= c.w) <= 0));
    const c = pool.splice(k, 1)[0];
    if (picked.some(p => Math.abs(p - c.i) < 4)) continue;   // ne dvě díry hned vedle sebe
    picked.push(c.i);
  }
  return { toks, picked: new Set(picked) };
}
function clozeMatch(val, ans) {
  const v = normAns(val), a = normAns(ans);
  return !!v && (v === a || (a.length >= 5 && levenshtein(v, a) <= 1));
}

// ── Study mode ─────────────────────────────────────────────────
// Režimy: flip = klasické otáčení (výkladová karta se jen čte),
// type = napíšeš odpověď, cloze = doplňuješ slova do výkladu.
// Výkladové karty (kind „info“) jsou jednostranné: pojem i informace na
// jedné straně, žádné otáčení ani hodnocení — jen se čte dál.
const isInfo = c => !!c && cardKind(c) === 'info';
let STUDY_MODE = 'flip';
let CHECKED = false;          // type / cloze: odpověď už je zkontrolovaná
let LEARN_LOADING = null;     // krabičky se musí načíst dřív, než se do nich zapíše

async function startStudy(wrongOnly = false, kind, mode) {
  if (kind !== undefined) STUDY_KIND = kind;
  if (mode !== undefined) STUDY_MODE = mode;
  let source;
  if (wrongOnly) source = STUDY_QUEUE.filter(c => !c._known && (STUDY_MODE === 'cloze' || !isInfo(c)));
  else if (STUDY_MODE === 'cloze') source = ALL_CARDS.filter(c => isInfo(c) && clozeCandidates(c.back).length);
  else if (STUDY_MODE === 'type') {
    source = ALL_CARDS.filter(c => !isInfo(c) && (!STUDY_KIND || cardKind(c) === STUDY_KIND));
    if (!source.length) source = ALL_CARDS.filter(c => !isInfo(c));
  } else {
    source = ALL_CARDS.filter(c => !STUDY_KIND || cardKind(c) === STUDY_KIND);
    // Set bez klasických kartiček: procvičuje se na kartách z kvízu.
    if (STUDY_KIND === 'learn' && !source.length) source = ALL_CARDS.filter(c => !isInfo(c));
  }

  if (!source.length) {
    toast(wrongOnly ? '🎉 Žádné neznámé karty, vše znáš!'
      : STUDY_MODE === 'cloze' ? 'Tady nejsou výkladové karty, ze kterých by šla doplňovačka.'
      : 'Balíček nemá žádné karty.');
    return;
  }
  if (LEARN_LOADING) await LEARN_LOADING;
  source.forEach(c => { delete c._known; });

  // Výklad se čte popořadě, zkoušení se míchá.
  STUDY_QUEUE = STUDY_MODE === 'flip' && source.every(isInfo) ? source.slice() : shuffle(source);
  STUDY_IDX   = 0;
  KNOWN       = 0;
  showView('study');
  showStudyCard();
  setupStudyControls();
}

function showStudyCard() {
  IS_FLIPPED = false;
  CHECKED = false;
  const inner = document.getElementById('flashcardInner');
  // Snap back to the front WITHOUT the flip animation — otherwise the next
  // card's answer is visible on the turning back face for half a second.
  inner.classList.add('no-anim');
  inner.classList.remove('flipped');
  void inner.offsetWidth;
  inner.classList.remove('no-anim');

  const card = STUDY_QUEUE[STUDY_IDX];
  const reading = STUDY_MODE === 'flip' && isInfo(card);
  const cloze = STUDY_MODE === 'cloze', typing = STUDY_MODE === 'type';
  const fEl = document.getElementById('studyFront'), bEl = document.getElementById('studyBack');
  const [fLbl, bLbl] = [fEl, bEl].map(e => e.parentElement.querySelector('.fc-face-lbl'));
  document.getElementById('flashcardWrap').classList.toggle('fc-reading', reading || cloze);
  document.getElementById('flashcardWrap').classList.toggle('fc-typing', typing || cloze);
  if (reading) {
    fEl.innerHTML = `<div class="fc-info-term">${esc(card.front)}</div>` +
      (card.codeLang ? codeBlockHtml(card.back, card.codeLang) : `<div class="fc-info-body">${esc(card.back)}</div>`);
    bEl.textContent = '';
    if (fLbl) { fLbl.textContent = 'Výklad'; fLbl.hidden = false; }
  } else if (cloze) {
    const { toks, picked } = pickCloze(card.back);
    const body = toks.map((t, i) => {
      if (!picked.has(i)) return esc(t);
      const [pre, core, post] = clozeCore(t);
      return `${esc(pre)}<input type="text" class="cloze-in" data-answer="${esc(core)}" style="width:${Math.max(3, core.length + 1)}ch" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Chybějící slovo">${esc(post)}`;
    }).join('');
    fEl.innerHTML = `<div class="fc-info-term">${esc(card.front)}</div><div class="fc-info-body">${body}</div>`;
    bEl.textContent = '';
    if (fLbl) { fLbl.textContent = 'Doplň chybějící slova'; fLbl.hidden = false; }
  } else {
    if (card.frontLang) fEl.innerHTML = codeQuestionHtml(card.front, card.frontLang);
    else fEl.textContent = card.front;
    if (card.codeLang)  bEl.innerHTML = codeBlockHtml(card.back, card.codeLang);
    else bEl.textContent = card.back;
    if (fLbl) fLbl.textContent = 'Otázka';
    // Otázka vytažená z komentáře v kódu nahradí nápis „Otázka“.
    if (fLbl) fLbl.hidden = !!fEl.querySelector('.code-q');
    if (bLbl) bLbl.textContent = 'Odpověď';
  }
  document.getElementById('studyIdx').textContent   = STUDY_IDX + 1;
  document.getElementById('studyTotal').textContent = STUDY_QUEUE.length;
  document.getElementById('studyProgFill').style.width = (STUDY_IDX / STUDY_QUEUE.length * 100) + '%';

  const show = (id, on, disp = 'flex') => { document.getElementById(id).style.display = on ? disp : 'none'; };
  show('studyBtns', false);
  show('studyHint', !reading && !typing && !cloze, 'block');
  show('readBtns', reading);
  show('skipBtn', !reading, '');
  show('typeBox', typing || cloze);
  show('typeVerdict', false, 'block');
  show('nextBtns', false);
  document.getElementById('readPrevBtn').disabled = STUDY_IDX === 0;
  document.getElementById('readNextBtn').firstChild.textContent = STUDY_IDX === STUDY_QUEUE.length - 1 ? 'Hotovo' : 'Další';
  const ti = document.getElementById('typeInput');
  ti.style.display = typing ? '' : 'none';
  ti.value = '';
  ti.placeholder = card.codeLang ? 'Napiš kód…' : 'Napiš odpověď…';
  document.getElementById('clozeHintBtn').style.display = cloze ? '' : 'none';
  // Na telefonu by klávesnice hned zakryla půl karty — tam se ťukne sám.
  if (matchMedia('(hover: hover)').matches) (typing ? ti : fEl.querySelector('.cloze-in'))?.focus();
}

function readStep(d) {
  if (d < 0) { if (STUDY_IDX > 0) { STUDY_IDX--; showStudyCard(); } return; }
  gradeCard('read');
}

function nextCard() {
  STUDY_IDX++;
  if (STUDY_IDX >= STUDY_QUEUE.length) showResults();
  else showStudyCard();
}

// Psaní: přesná (nebo skoro přesná) odpověď se uzná sama, jinak se ukážou
// obě a hodnotí se jako u otáčení. Doplňovačka se vyhodnotí vždy sama.
function checkTyped() {
  if (CHECKED) return;
  const card = STUDY_QUEUE[STUDY_IDX];
  const verdict = document.getElementById('typeVerdict');
  CHECKED = true;
  document.getElementById('typeBox').style.display = 'none';
  document.getElementById('skipBtn').style.display = 'none';
  document.activeElement?.blur?.();
  if (STUDY_MODE === 'cloze') {
    const inputs = [...document.querySelectorAll('#studyFront .cloze-in')];
    let good = 0;
    inputs.forEach(inp => {
      const ans = inp.dataset.answer, ok = clozeMatch(inp.value, ans);
      if (ok) good++;
      const span = document.createElement('span');
      span.className = 'cloze-res ' + (ok ? 'ok' : 'bad');
      span.innerHTML = ok ? esc(ans) : (inp.value.trim() ? `<s>${esc(inp.value.trim())}</s> ` : '') + esc(ans);
      inp.replaceWith(span);
    });
    const all = good === inputs.length;
    card._known = all;
    if (all) KNOWN++;
    recordAnswer(card.id, all, true);   // výklad nemá krabičku, jen statistika
    verdict.className = 'type-verdict ' + (all ? 'ok' : 'bad');
    verdict.textContent = all ? '✓ Všechno správně' : `Správně ${good} z ${inputs.length}`;
    verdict.style.display = 'block';
    document.getElementById('nextBtns').style.display = 'flex';
    return;
  }
  const val = document.getElementById('typeInput').value.trim();
  const ok = answerMatches(val, card);
  IS_FLIPPED = true;
  document.getElementById('flashcardInner').classList.add('flipped');
  verdict.style.display = 'block';
  if (ok) {
    card._known = true;
    KNOWN++;
    recordAnswer(card.id, true);
    const exact = normAns(val) === normAns(card.back);
    verdict.className = 'type-verdict ok';
    verdict.innerHTML = '✓ Správně' + (exact ? '' : ` <span>— tvoje odpověď: ${esc(val)}</span>`);
    document.getElementById('nextBtns').style.display = 'flex';
  } else {
    verdict.className = 'type-verdict bad';
    verdict.innerHTML = (val ? `Tvoje odpověď: <b>${esc(val)}</b>` : 'Bez odpovědi.') + ' <span>Porovnej se správnou a ohodnoť se:</span>';
    document.getElementById('studyBtns').style.display = 'flex';
  }
}

function clozeHint() {
  const inputs = [...document.querySelectorAll('#studyFront .cloze-in')];
  const t = inputs.includes(document.activeElement) ? document.activeElement : inputs.find(i => !i.value.trim()) || inputs[0];
  if (!t) return;
  t.value = t.dataset.answer.slice(0, Math.min(t.dataset.answer.length - 1, (t.value.length || 0) + 1)) || t.dataset.answer[0];
  t.focus();
}

function setupStudyControls() {
  // Flip on card click (výkladová karta se neotáčí, psaní se otočí samo)
  document.getElementById('flashcardWrap').onclick = () => {
    if (IS_FLIPPED || STUDY_MODE !== 'flip' || isInfo(STUDY_QUEUE[STUDY_IDX])) return;
    IS_FLIPPED = true;
    document.getElementById('flashcardInner').classList.add('flipped');
    document.getElementById('studyBtns').style.display = 'flex';
    document.getElementById('studyHint').style.display  = 'none';
  };

  document.getElementById('knowBtn').onclick     = () => gradeCard(true);
  document.getElementById('dontKnowBtn').onclick = () => gradeCard(false);
  document.getElementById('almostBtn').onclick   = () => gradeCard('almost');
  document.getElementById('skipBtn').onclick     = () => gradeCard(null);
  document.getElementById('readPrevBtn').onclick = () => readStep(-1);
  document.getElementById('readNextBtn').onclick = () => readStep(1);
  document.getElementById('typeCheckBtn').onclick = checkTyped;
  document.getElementById('clozeHintBtn').onclick = clozeHint;
  document.getElementById('nextCardBtn').onclick  = nextCard;
  document.getElementById('typeInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkTyped(); } };
  document.getElementById('studyFront').onkeydown = e => {
    if (e.key === 'Enter' && e.target.matches('.cloze-in')) { e.preventDefault(); checkTyped(); }
  };

  document.getElementById('restartBtn').onclick    = () => startStudy(false);
  document.getElementById('onlyWrongBtn').onclick  = () => startStudy(true);
  document.getElementById('backToCardsBtn').onclick = () => { showView('cards'); renderSetPath(); };
}

// Keyboard while studying: Space/Enter flips, 1–3 grade, → skips.
// Výklad: mezerník / Enter / → dál, ← zpět. Psaní a doplňovačka: Enter
// zkontroluje (v políčku), po kontrole Enter dál.
document.addEventListener('keydown', e => {
  if (document.getElementById('viewStudy')?.style.display === 'none') return;
  if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
  const shown = id => document.getElementById(id).style.display !== 'none';
  if (STUDY_MODE === 'flip' && isInfo(STUDY_QUEUE[STUDY_IDX])) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); readStep(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); readStep(-1); }
    return;
  }
  if (STUDY_MODE !== 'flip') {
    if (!CHECKED) { if (e.key === 'ArrowRight') gradeCard(null); return; }
    if (shown('nextBtns') && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) { e.preventDefault(); nextCard(); }
    else if (shown('studyBtns') && ['1', '2', '3'].includes(e.key)) gradeCard(e.key === '3' ? true : e.key === '2' ? 'almost' : false);
    return;
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!IS_FLIPPED) document.getElementById('flashcardWrap').click();
  } else if (IS_FLIPPED && e.key === '1') gradeCard(false);
  else if (IS_FLIPPED && e.key === '2') gradeCard('almost');
  else if (IS_FLIPPED && e.key === '3') gradeCard(true);
  else if (e.key === 'ArrowRight') gradeCard(null);
});

// Umím / Skoro / Nevím jde do krabiček stejně jako odpověď v kvízu, takže
// Chytré procvičování a „K opakování dnes“ vědí i o tom, co se učíš tady.
function gradeCard(known) {
  const card = STUDY_QUEUE[STUDY_IDX];
  if (known === true) {
    card._known = true;
    KNOWN++;
  } else if (known === false || known === 'almost') {
    card._known = false;
  }
  if ((known === true || known === false || known === 'almost') && !isInfo(card)) recordAnswer(card.id, known);
  nextCard();
}

function showResults() {
  showView('results');
  const read  = STUDY_MODE === 'flip' ? STUDY_QUEUE.filter(isInfo).length : 0;
  const total = STUDY_QUEUE.length - read;            // výklad se nehodnotí
  const pct   = total > 0 ? Math.round(KNOWN / total * 100) : 0;
  const sub   = document.querySelector('#viewResults .results-sub');
  document.getElementById('resPct').textContent  = total ? pct + '%' : '✓';
  if (sub) sub.textContent = total ? 'znáš' : 'přečteno';
  document.getElementById('studyProgFill').style.width = '100%';

  const what = STUDY_MODE === 'cloze' ? 'výkladů bez chyby' : 'karet';
  let title, desc;
  if (!total)           { title = '📘 Výklad přečtený'; desc = `Prošel jsi ${read} karet výkladu.`; }
  else if (pct === 100) { title = '🎉 Perfektní!';      desc = `Všech ${total} ${what}. Skvělá práce!`; }
  else if (pct >= 75)   { title = '💪 Skoro tam!';      desc = `${KNOWN} z ${total} ${what}. Ještě trochu procvičit.`; }
  else if (pct >= 50)   { title = '📚 Pokrok!';         desc = `${KNOWN} z ${total} ${what}. Zaměř se na ty červené.`; }
  else                  { title = '💡 Učit se dál!';    desc = `${KNOWN} z ${total} ${what}. Nevzdávej to, opakování je klíč.`; }

  document.getElementById('resTitle').textContent = title;
  document.getElementById('resDesc').textContent  = desc;
  document.getElementById('restartBtn').textContent = total ? 'Opakovat znova' : 'Přečíst znovu';

  const wrongCount = STUDY_QUEUE.filter(c => !c._known && (STUDY_MODE === 'cloze' || !isInfo(c))).length;
  const ow = document.getElementById('onlyWrongBtn');
  ow.style.display = total ? '' : 'none';
  ow.disabled = wrongCount === 0;
  ow.textContent = `Opakovat neznámé (${wrongCount})`;

  // Set: krok splněn → nabídni další.
  const nb = document.getElementById('nextStepBtn');
  nb.style.display = 'none';
  if (isSetDeck() && STUDY_KIND) {
    markSetStep(STUDY_KIND);
    const steps = setSteps();
    const nxt = steps[steps.findIndex(st => st.kind === STUDY_KIND) + 1];
    if (nxt) {
      nb.textContent = `Další krok: ${nxt.ico} ${nxt.name}`;
      nb.href = nxt.kind === 'quiz' ? quizHrefBase() + '&kind=quiz' : '#';
      nb.onclick = nxt.kind === 'quiz' ? null : e => { e.preventDefault(); startStudy(false, nxt.kind, 'flip'); };
      nb.style.display = '';
    }
  }
}

// ── Learning stats (spaced repetition) ─────────────────────────
// Reads users/{uid}.learn[deckId] written by quiz.js and shows: totals,
// due-now count, Leitner box distribution, last-7-days activity and the
// cards that need the most work.
async function openLearnStats() {
  let ov = document.getElementById('learnStatsOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'learnStatsOv';
    ov.className = 'modal-overlay';
    ov.innerHTML = `<div class="modal" style="max-width:480px;">
      <div class="modal-header"><h3>📊 Statistiky učení</h3><button class="modal-close" id="learnStatsClose">✕</button></div>
      <div id="learnStatsBody"></div>
    </div>`;
    document.body.appendChild(ov);
    document.getElementById('learnStatsClose').addEventListener('click', () => ov.classList.remove('open'));
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  }
  const body = document.getElementById('learnStatsBody');
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Načítám…</div>';
  ov.classList.add('open');

  let l = null;
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    l = snap.exists ? (snap.data().learn || {})[DECK_ID] : null;
  } catch (_) {}

  const cards = (l && l.cards) || {};
  const stats = (l && l.stats) || { answered: 0, correct: 0, days: {} };
  if (!stats.answered) {
    body.innerHTML = `<p style="color:var(--text-muted);font-size:0.88rem;padding:6px 0;">
      Zatím žádná data — spusť 🎮 Kvíz nebo 🧠 Chytré procvičování a statistiky se začnou sbírat.</p>`;
    return;
  }

  const now = Date.now();
  const pct = Math.round(stats.correct / stats.answered * 100);
  const dueNow = ALL_CARDS.filter(c => { const e = cards[c.id]; return !e || e.due <= now; }).length;

  // Box distribution 1–5 over cards that have an entry
  const boxes = [0, 0, 0, 0, 0];
  ALL_CARDS.forEach(c => { const e = cards[c.id]; if (e && e.box >= 1) boxes[Math.min(5, e.box) - 1]++; });
  const boxMax = Math.max(1, ...boxes);
  const boxHtml = boxes.map((n, i) => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:100%;height:56px;display:flex;align-items:flex-end;">
        <div style="width:100%;height:${Math.round(n / boxMax * 100)}%;min-height:${n ? 4 : 0}px;background:${['#ef4444','#f59e0b','#eab308','#84cc16','#22c55e'][i]};border-radius:4px 4px 0 0;"></div>
      </div>
      <span style="font-size:0.66rem;color:var(--text-muted);">${i + 1}</span>
      <span style="font-size:0.72rem;font-weight:600;">${n}</span>
    </div>`).join('');

  // Last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400e3);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: d.toLocaleDateString('cs-CZ', { weekday: 'short' }), ...(stats.days[key] || { a: 0, c: 0 }) });
  }
  const dayMax = Math.max(1, ...days.map(d => d.a));
  const daysHtml = days.map(d => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;" title="${d.c}/${d.a} správně">
      <div style="width:100%;height:48px;display:flex;align-items:flex-end;">
        <div style="width:100%;height:${Math.round(d.a / dayMax * 100)}%;min-height:${d.a ? 4 : 0}px;background:var(--accent);opacity:${d.a ? 1 : 0.15};border-radius:4px 4px 0 0;"></div>
      </div>
      <span style="font-size:0.64rem;color:var(--text-muted);">${d.label}</span>
    </div>`).join('');

  // Worst cards: lowest box among attempted
  const worst = ALL_CARDS
    .filter(c => cards[c.id])
    .sort((a, b) => (cards[a.id].box || 0) - (cards[b.id].box || 0))
    .slice(0, 5);
  const worstHtml = worst.length ? worst.map(c => `
    <div style="display:flex;justify-content:space-between;gap:10px;font-size:0.8rem;padding:5px 0;border-bottom:1px solid var(--border);">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.front)}</span>
      <span style="flex-shrink:0;color:${(cards[c.id].box || 1) <= 2 ? '#ef4444' : 'var(--text-muted)'};">box ${cards[c.id].box || 1}/5</span>
    </div>`).join('') : '';

  body.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <div style="flex:1;background:var(--bg-3);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:1.25rem;font-weight:700;">${stats.answered}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">odpovědí</div>
      </div>
      <div style="flex:1;background:var(--bg-3);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:1.25rem;font-weight:700;color:${pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'};">${pct}%</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">úspěšnost</div>
      </div>
      <div style="flex:1;background:var(--bg-3);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-size:1.25rem;font-weight:700;">${dueNow}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);">k opakování</div>
      </div>
    </div>
    <div class="stats-head">
      <label class="label">Krabičky (1 = neumím · 5 = umím)</label>
      <span class="info-tip" tabindex="0" role="button" aria-label="Jak fungují krabičky">i
        <span class="info-tip-box" role="tooltip">
          <b>Jak to funguje</b>
          Každá kartička leží v jedné krabičce.<br>
          ✓ Správná odpověď ji posune o krabičku výš.<br>
          ✗ Špatná ji vrátí do krabičky 1.<br><br>
          Čím vyšší krabička, tím později se zase zeptá:<br>
          1 → za 10 minut · 2 → zítra · 3 → za 3 dny · 4 → za týden · 5 → za 16 dní<br><br>
          <b>Tip:</b> pouštěj „Chytře“ — ptá se jen na to, co je zrovna na řadě, nejdřív na to, co ti nejde.
        </span>
      </span>
    </div>
    <div style="display:flex;gap:6px;margin:6px 0 16px;">${boxHtml}</div>
    <label class="label">Posledních 7 dní</label>
    <div style="display:flex;gap:6px;margin:6px 0 16px;">${daysHtml}</div>
    ${worst.length ? `<label class="label">Nejvíc potřebují procvičit</label><div style="margin-top:6px;">${worstHtml}</div>` : ''}`;
}

// ── Modal helpers ──────────────────────────────────────────────
function setupModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Generic confirm popup (replaces native confirm()) ───────────
function confirmDialog(message, onConfirm) {
  const overlay = document.getElementById('confirmModal');
  document.getElementById('confirmModalText').textContent = message;
  overlay.classList.add('open');

  const oldYes = document.getElementById('confirmModalYes');
  const oldNo  = document.getElementById('confirmModalNo');
  const yesBtn = oldYes.cloneNode(true);
  const noBtn  = oldNo.cloneNode(true);
  oldYes.replaceWith(yesBtn);
  oldNo.replaceWith(noBtn);

  yesBtn.addEventListener('click', () => { overlay.classList.remove('open'); onConfirm(); });
  noBtn.addEventListener('click',  () => overlay.classList.remove('open'));
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg) {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Helpers ────────────────────────────────────────────────────
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  loadSurvivalLobbies();
}

function renderDeckGrid(docs) {
  const grid = document.getElementById('decksGrid');
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
    const isOwner = d.ownerUid === ME.uid;
    const a = document.createElement('a');
    a.href      = `flashcards.html?deck=${doc.id}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    a.className = 'deck-card';
    a.style.setProperty('--card-color', d.color || '#6366f1');
    a.innerHTML = `
      ${isOwner ? `<button class="card-edit-btn" data-edit-deck="${doc.id}" title="Upravit balíček">✏️</button>` : ''}
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p class="card-desc">${esc(d.description)}</p>` : ''}
      <p>${d.cardCount || 0} karet</p>`;
    const editBtn = a.querySelector('[data-edit-deck]');
    if (editBtn) {
      editBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openEditDeckModal(doc.id, d);
      });
    }
    grid.appendChild(a);
  });
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

    if (canAddCards()) {
      document.getElementById('addCardForm').style.display = 'block';
      setupAddCard();
      setupEditCardModal();
    }

    // Přejmenovat/smazat celý balíček – jen vlastník balíčku
    if (isOwner) {
      const actions = document.getElementById('deckActions');
      actions.innerHTML = `
        <button class="btn btn-ghost" style="font-size:0.82rem;padding:7px 13px;" id="renameDeckBtn">✏️ Přejmenovat</button>
        <button class="btn btn-ghost" style="font-size:0.82rem;padding:7px 13px;" id="deleteDeckBtn">🗑 Smazat balíček</button>`;
      document.getElementById('renameDeckBtn').addEventListener('click', () => openEditDeckModal(DECK_ID, DECK));
      document.getElementById('deleteDeckBtn').addEventListener('click', () => openModal('deleteDeckModal'));
      setupDeleteModal();
      setupEditDeckModal();
    }

    // Tlačítko Studovat (vždy viditelné)
    const studyBtn = document.createElement('button');
    studyBtn.className   = 'btn btn-primary';
    studyBtn.textContent = '▶ Studovat';
    studyBtn.id          = 'studyBtn';
    studyBtn.addEventListener('click', () => startStudy(false));
    document.getElementById('deckActions').prepend(studyBtn);

    const quizBtn   = document.createElement('a');
    quizBtn.className   = 'btn btn-secondary';
    quizBtn.style.cssText = 'padding:7px 14px;font-size:0.82rem;';
    quizBtn.textContent = '🎮 Kvíz';
    quizBtn.href        = `quiz.html?deck=${DECK_ID}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    studyBtn.insertAdjacentElement('afterend', quizBtn);

    // Survival is started from the room's lobby list (loadSurvivalLobbies
    // below), whose deck picker already covers any deck — personal or
    // room-linked, one or several at once — so a per-deck shortcut here is
    // redundant no matter which kind of deck this is.

    // Real-time karty
    db.collection('decks').doc(DECK_ID).collection('cards')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        ALL_CARDS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsList();
        document.getElementById('deckCardCount').textContent = `${ALL_CARDS.length} karet`;
        // Aktualizuj počet v deck doc
        if (isOwner) db.collection('decks').doc(DECK_ID).update({ cardCount: ALL_CARDS.length }).catch(() => {});
        // Disable study if no cards
        const sb = document.getElementById('studyBtn');
        if (sb) sb.disabled = ALL_CARDS.length === 0;
      });

  } catch (e) {
    toast('Chyba: ' + e.message);
  }

  setupModalClose();
}

function renderCardContent(card) {
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
  ALL_CARDS.forEach(card => {
    const row = document.createElement('div');
    row.className = 'card-row';
    const editable = canManageCard(card);
    const distractorBadge = (card.distractors && card.distractors.length)
      ? `<div class="card-distractors-row">❌ ${card.distractors.map(d=>`<span class="distractor-badge">${esc(d)}</span>`).join(' ')}</div>` : '';
    row.innerHTML = `
      <div class="card-sides">
        <div>
          <div class="card-side-lbl">Přední</div>
          <div class="card-side-txt">${esc(card.front)}</div>
        </div>
        <div>
          <div class="card-side-lbl">Zadní</div>
          ${renderCardContent(card)}
          ${distractorBadge}
        </div>
      </div>
      ${editable ? `
        <div class="card-row-actions">
          <button class="btn btn-ghost" style="padding:5px 9px;font-size:0.8rem;" data-edit="${card.id}">✏️</button>
          <button class="btn btn-ghost" style="padding:5px 9px;color:#fca5a5;font-size:0.8rem;" data-del="${card.id}">🗑</button>
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
          const arr = JSON.parse(cleaned.slice(start, end + 1));
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

function setupEditCardModal() {
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
      const need = (parseInt(document.getElementById('editAnswerCount').value) || 4) - 1;
      const suggestions = await geminiSuggestDistractors(front, back, need);
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

// ── Study mode ─────────────────────────────────────────────────
function startStudy(wrongOnly = false) {
  const source = wrongOnly
    ? STUDY_QUEUE.filter(c => !c._known)
    : [...ALL_CARDS];

  if (!source.length) {
    toast(wrongOnly ? '🎉 Žádné neznámé karty, vše znáš!' : 'Balíček nemá žádné karty.');
    return;
  }

  STUDY_QUEUE = shuffle(source);
  STUDY_IDX   = 0;
  KNOWN       = 0;
  showView('study');
  showStudyCard();
  setupStudyControls();
}

function showStudyCard() {
  IS_FLIPPED = false;
  const inner = document.getElementById('flashcardInner');
  inner.classList.remove('flipped');

  const card = STUDY_QUEUE[STUDY_IDX];
  document.getElementById('studyFront').textContent = card.front;
  document.getElementById('studyBack').textContent  = card.back;
  document.getElementById('studyIdx').textContent   = STUDY_IDX + 1;
  document.getElementById('studyTotal').textContent = STUDY_QUEUE.length;
  document.getElementById('studyProgFill').style.width = (STUDY_IDX / STUDY_QUEUE.length * 100) + '%';

  document.getElementById('studyBtns').style.display = 'none';
  document.getElementById('studyHint').style.display  = 'block';
}

function setupStudyControls() {
  // Flip on card click
  document.getElementById('flashcardWrap').onclick = () => {
    if (IS_FLIPPED) return;
    IS_FLIPPED = true;
    document.getElementById('flashcardInner').classList.add('flipped');
    document.getElementById('studyBtns').style.display = 'flex';
    document.getElementById('studyHint').style.display  = 'none';
  };

  document.getElementById('knowBtn').onclick     = () => gradeCard(true);
  document.getElementById('dontKnowBtn').onclick = () => gradeCard(false);
  document.getElementById('skipBtn').onclick     = () => gradeCard(null);

  document.getElementById('restartBtn').onclick    = () => startStudy(false);
  document.getElementById('onlyWrongBtn').onclick  = () => startStudy(true);
  document.getElementById('backToCardsBtn').onclick = () => showView('cards');
}

function gradeCard(known) {
  if (known === true) {
    STUDY_QUEUE[STUDY_IDX]._known = true;
    KNOWN++;
  } else if (known === false) {
    STUDY_QUEUE[STUDY_IDX]._known = false;
  }
  STUDY_IDX++;
  if (STUDY_IDX >= STUDY_QUEUE.length) {
    showResults();
  } else {
    showStudyCard();
  }
}

function showResults() {
  showView('results');
  const total = STUDY_QUEUE.length;
  const pct   = total > 0 ? Math.round(KNOWN / total * 100) : 0;
  document.getElementById('resPct').textContent  = pct + '%';
  document.getElementById('studyProgFill').style.width = '100%';

  let title, desc;
  if (pct === 100) { title = '🎉 Perfektní!';      desc = `Znáš všech ${total} karet. Skvělá práce!`; }
  else if (pct >= 75) { title = '💪 Skoro tam!';   desc = `${KNOWN} z ${total} karet. Ještě trochu procvičit.`; }
  else if (pct >= 50) { title = '📚 Pokrok!';      desc = `${KNOWN} z ${total} karet. Zaměř se na ty červené.`; }
  else                { title = '💡 Učit se dál!'; desc = `${KNOWN} z ${total} karet. Nevzdávej to, opakování je klíč.`; }

  document.getElementById('resTitle').textContent = title;
  document.getElementById('resDesc').textContent  = desc;

  const wrongCount = STUDY_QUEUE.filter(c => !c._known).length;
  document.getElementById('onlyWrongBtn').disabled = wrongCount === 0;
  document.getElementById('onlyWrongBtn').textContent = `Opakovat neznámé (${wrongCount})`;
}

// ── Survival lobbies ───────────────────────────────────────────
function loadSurvivalLobbies() {
  const section  = document.getElementById('survivalSection');
  const lobbyDiv = document.getElementById('survivalLobbies');
  const createBtn = document.getElementById('createLobbyBtn');
  if (!section) return;

  // Listen for open lobbies
  db.collection('survival_lobbies')
    .where('status', '==', 'waiting')
    .limit(8)
    .onSnapshot(snap => {
      section.style.display = 'block';
      lobbyDiv.innerHTML = '';

      if (snap.empty) {
        lobbyDiv.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem;">Žádné aktivní hry — vytvoř novou!</span>';
      } else {
        const STALE_MS = 3 * 60 * 60 * 1000; // 3h — auto-clear abandoned lobbies you hosted
        snap.forEach(doc => {
          const d = doc.data();
          const isMine = d.hostId === ME.uid;
          // Silent best-effort cleanup: an old lobby you host that never
          // started is just clutter (e.g. from testing). Removing it here
          // means the fix applies retroactively — no manual Firestore work.
          const ageMs = d.createdAt?.toMillis ? Date.now() - d.createdAt.toMillis() : 0;
          if (isMine && ageMs > STALE_MS) { doc.ref.delete().catch(() => {}); return; }

          const playerCount = Object.keys(d.players || {}).length;
          const card = document.createElement('div');
          card.style.cssText = 'background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;min-width:180px;max-width:220px;position:relative;';
          card.innerHTML = `
            ${isMine ? `<button class="btn btn-ghost lobby-cancel-btn" title="Zrušit hru" data-lid="${doc.id}" style="position:absolute;top:6px;right:6px;padding:2px 7px;font-size:.75rem;line-height:1;">✕</button>` : ''}
            <div style="font-weight:700;font-size:.85rem;margin-bottom:4px;">🧟 Vlna ${d.wave || 0}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px;">Hostitel: ${esc(d.hostName || 'Hráč')}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px;">👥 ${playerCount}/4 hráčů</div>
            <button class="btn btn-primary" style="font-size:.75rem;padding:5px 12px;width:100%;" data-lid="${doc.id}">Připojit se</button>`;
          card.querySelector('.lobby-cancel-btn')?.addEventListener('click', e => {
            e.stopPropagation();
            doc.ref.delete().catch(err => toast('Nepodařilo se zrušit hru: ' + err.message));
          });
          card.querySelector('.btn-primary').addEventListener('click', () => joinSurvivalLobby(doc.id));
          lobbyDiv.appendChild(card);
        });
      }
    }, () => { section.style.display = 'none'; });

  createBtn.addEventListener('click', createSurvivalLobby);
}

async function createSurvivalLobby() {
  const btn = document.getElementById('createLobbyBtn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const ref = await db.collection('survival_lobbies').add({
      hostId:   ME.uid,
      hostName: ME.displayName || ME.email?.split('@')[0] || 'Hráč',
      status:   'waiting',
      wave:     0,
      mapId:    0,
      players:  { [ME.uid]: { uid: ME.uid, name: ME.displayName || 'Hráč', ready: false } },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.location.href = `game.html?lobby=${ref.id}`;
  } catch (e) {
    toast('Chyba: ' + e.message);
    btn.disabled = false; btn.textContent = '+ Nová hra';
  }
}

function joinSurvivalLobby(lobbyId) {
  window.location.href = `game.html?lobby=${lobbyId}`;
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

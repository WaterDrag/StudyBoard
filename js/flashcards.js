const params  = new URLSearchParams(window.location.search);
const DECK_ID = params.get('deck');
const ROOM_ID = params.get('room');
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_MODELS   = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
const getGeminiKey    = () => localStorage.getItem('sb_gemini_key');

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
  setupModalClose();
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
    const a = document.createElement('a');
    a.href      = `flashcards.html?deck=${doc.id}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    a.className = 'deck-card';
    a.innerHTML = `
      <div class="deck-dot" style="background:${d.color || '#6366f1'};"></div>
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p class="card-desc">${esc(d.description)}</p>` : ''}
      <p>${d.cardCount || 0} karet</p>`;
    grid.appendChild(a);
  });
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
async function loadDeck() {
  try {
    const deckDoc = await db.collection('decks').doc(DECK_ID).get();
    if (!deckDoc.exists) { toast('Balíček nenalezen.'); window.history.back(); return; }

    DECK = { id: deckDoc.id, ...deckDoc.data() };
    const isOwner = DECK.ownerUid === ME.uid;

    // Ověř přístup: owner nebo člen místnosti
    if (!isOwner && DECK.roomId) {
      const roomDoc = await db.collection('rooms').doc(DECK.roomId).get();
      if (!roomDoc.exists || !(roomDoc.data().memberIds || []).includes(ME.uid)) {
        toast('Nemáš přístup.'); window.location.href = 'dashboard.html'; return;
      }
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

    // Akce pro vlastníka
    if (isOwner) {
      document.getElementById('addCardForm').style.display = 'block';
      const actions = document.getElementById('deckActions');
      actions.innerHTML = `
        <button class="btn btn-ghost" style="font-size:0.82rem;padding:7px 13px;" id="deleteDeckBtn">🗑 Smazat balíček</button>`;
      document.getElementById('deleteDeckBtn').addEventListener('click', () => openModal('deleteDeckModal'));
      setupDeleteModal();
      setupAddCard();
      setupEditCardModal();
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

    const survivalBtn = document.createElement('a');
    survivalBtn.className   = 'btn btn-ghost';
    survivalBtn.style.cssText = 'padding:7px 14px;font-size:0.82rem;';
    survivalBtn.textContent = '🧟 Survival';
    survivalBtn.href        = `game.html?deck=${DECK_ID}${ROOM_ID ? '&room=' + ROOM_ID : ''}`;
    quizBtn.insertAdjacentElement('afterend', survivalBtn);

    // Real-time karty
    db.collection('decks').doc(DECK_ID).collection('cards')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        ALL_CARDS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsList(isOwner);
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

function renderCardsList(isOwner) {
  const list = document.getElementById('cardsList');
  if (!ALL_CARDS.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Žádné karty. ${isOwner ? 'Přidej první výše!' : ''}</div>`;
    return;
  }
  list.innerHTML = '';
  ALL_CARDS.forEach(card => {
    const row = document.createElement('div');
    row.className = 'card-row';
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
      ${isOwner ? `
        <div class="card-row-actions">
          <button class="btn btn-ghost" style="padding:5px 9px;font-size:0.8rem;" data-edit="${card.id}">✏️</button>
          <button class="btn btn-ghost" style="padding:5px 9px;color:#fca5a5;font-size:0.8rem;" data-del="${card.id}">🗑</button>
        </div>` : ''}`;
    list.appendChild(row);
  });

  if (isOwner) {
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Smazat tuto kartu?')) return;
        try {
          await db.collection('decks').doc(DECK_ID).collection('cards').doc(btn.dataset.del).delete();
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    });
    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = ALL_CARDS.find(c => c.id === btn.dataset.edit);
        if (card) openEditCard(card);
      });
    });
  }
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
    tag.innerHTML = `${esc(d)} <button class="distractor-rm" data-i="${i}">×</button>`;
    tag.querySelector('.distractor-rm').addEventListener('click', () => {
      editDistractors.splice(i, 1);
      renderEditDistractors();
    });
    list.appendChild(tag);
  });
}


async function geminiSuggestDistractors(front, back, count = 3) {
  const key = getGeminiKey();
  if (!key) throw new Error('no-key');

  const prompt = `Generate exactly ${count} wrong but plausible multiple-choice distractors for this flashcard.
Question: "${front}"
Correct answer: "${back}"
Rules: same format/length/language as the correct answer, plausible but clearly wrong to an expert, not variations of each other.
Return ONLY a JSON array of ${count} strings: ["d1","d2",...]`;

  const statusEl = () => document.getElementById('aiStatusMsg');
  const countdown = async (seconds, label) => {
    for (let s = seconds; s > 0; s--) {
      const el = statusEl();
      if (el) el.textContent = `${label} ${s} s…`;
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  for (const model of GEMINI_MODELS) {
    let attempts = 2;
    let rateLimited = false;
    while (attempts-- > 0) {
      try {
        if (statusEl()) statusEl().textContent = `Zkouším ${model}…`;
        const res = await fetch(`${GEMINI_ENDPOINT}${model}:generateContent?key=${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 1600 } }),
        });
        if (res.status === 429) {
          if (attempts > 0) { await countdown(30, `${model}: rate limit —`); continue; }
          rateLimited = true; break;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const m = text.match(/\[[\s\S]*?\]/);
        if (m) { const arr = JSON.parse(m[0]); if (Array.isArray(arr) && arr.length >= count) return arr.slice(0, count).map(String); }
        const lines = text.split('\n').map(l => l.replace(/^[\s\d.\-•*"']+|["']+$/g, '').trim()).filter(Boolean);
        if (lines.length >= count) return lines.slice(0, count);
        throw new Error('parse');
      } catch(e) { console.warn('[Gemini]', model, e); break; }
    }
    if (!rateLimited) break;
  }
  throw new Error('rate-limit');
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
      const msg = e.message === 'no-key'
        ? '🔑 Nastav Gemini API klíč v <b>⚙️ Nastavení</b> na dashboardu.'
        : e.message === 'rate-limit'
          ? '⏱ Limit AI překročen — počkej ~30 s a zkus znovu.'
          : `Chyba: ${esc(e.message)}`;
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

// ═══ room-ai.js — AI karty a AI zkoušení z poznámek
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

let AI_GENERATED_CARDS = [];

// Flatten a note's content to plain text for the AI prompt. Tables are
// converted to "cell | cell" rows (not just mashed together) since notes can
// contain them; images/formatting are irrelevant for text-based extraction.
function noteToPlainText(note) {
  if (note.contentType !== 'html') return (note.content || '').trim();
  const d = document.createElement('div');
  d.innerHTML = note.content || '';
  d.querySelectorAll('table').forEach(table => {
    const rows = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => c.textContent.trim()).join(' | ')
    );
    table.replaceWith(document.createTextNode('\n' + rows.join('\n') + '\n'));
  });
  return d.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function setupAiCards() {
  const btn = document.getElementById('aiCardsBtn');
  if (!btn) return;
  // Anonymous guests can't create AI decks — they'd outlive the guest.
  if (ME.isAnonymous) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', openAiCardsModal);
  document.getElementById('aiGenerateBtn').addEventListener('click', generateAiCards);
  document.getElementById('aiSaveBtn').addEventListener('click', saveAiCards);
  document.getElementById('aiExamBtn').addEventListener('click', runAiExam);
}

// ── AI exam ("Vyzkoušej mě") ──────────────────────────────────
// Generates multiple-choice questions straight from the selected notes and
// runs them inline in the modal — nothing is saved anywhere.
async function runAiExam() {
  const checkedIds = [...document.querySelectorAll('.ai-note-check:checked')].map(c => c.dataset.id);
  if (!checkedIds.length) { toast('Vyber alespoň jednu poznámku.'); return; }
  const count = Math.max(2, Math.min(15, parseInt(document.getElementById('aiCardCount').value) || 8));

  const btn = document.getElementById('aiExamBtn');
  const area = document.getElementById('aiExamArea');
  btn.disabled = true; btn.textContent = '⏳ Připravuji…';
  document.getElementById('aiCardsPreview').innerHTML = '';
  document.getElementById('aiSaveBtn').style.display = 'none';
  area.style.display = 'block';
  area.innerHTML = '<div style="font-size:.85rem;color:var(--text-muted);padding:12px 0;">🎓 Generuji otázky…</div>';

  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').get();
    const byId = new Map(snap.docs.map(d => [d.id, d.data()]));
    const combinedText = checkedIds
      .map(id => (byId.has(id) ? noteToPlainText(byId.get(id)) : ''))
      .filter(Boolean).join('\n\n---\n\n');
    if (!combinedText.trim()) { area.innerHTML = ''; toast('Vybrané poznámky jsou prázdné.'); return; }

    const prompt = `You are examining a student on the notes below. Keep the SAME language as the notes (they may be in Czech).
Create exactly ${count} multiple-choice questions covering the key facts and concepts.
Each question: "q" is the question, "correct" is the right answer, "wrong" is an array of exactly 3 plausible but clearly wrong answers (same format/length as the correct one).
Return ONLY a JSON array like this, nothing else: [{"q":"...","correct":"...","wrong":["...","...","..."]}, ...]

NOTES:
"""
${combinedText.slice(0, 8000)}
"""`;

    const questions = await aiGenerate(prompt, {
      maxOutputTokens: 3000,
      parse(text) {
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('no-json');
        const arr = JSON.parse(m[0]);
        const clean = arr
          .filter(x => x && x.q && x.correct && Array.isArray(x.wrong) && x.wrong.length)
          .map(x => ({ q: String(x.q).trim(), correct: String(x.correct).trim(), wrong: x.wrong.map(w => String(w).trim()).slice(0, 3) }));
        if (!clean.length) throw new Error('empty');
        return clean;
      },
    });

    startAiExam(questions);
  } catch (e) {
    area.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;padding:10px 0;">${aiErrorMessage(e)}</div>`;
  }
  btn.disabled = false; btn.textContent = '🎓 Vyzkoušej mě';
}

function startAiExam(questions) {
  const area = document.getElementById('aiExamArea');
  const order = shuffleArr(questions.map((_, i) => i));
  let idx = -1, score = 0;

  const next = () => {
    idx++;
    if (idx >= order.length) {
      const pct = Math.round(score / order.length * 100);
      area.innerHTML = `
        <div style="text-align:center;padding:14px 0;">
          <div style="font-size:1.8rem;">${pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📖'}</div>
          <div style="font-weight:700;margin:6px 0;">${score} / ${order.length} (${pct} %)</div>
          <button class="btn btn-secondary" id="aiExamAgain" style="font-size:0.82rem;">↻ Znovu stejné otázky</button>
        </div>`;
      document.getElementById('aiExamAgain').addEventListener('click', () => startAiExam(questions));
      return;
    }
    const q = questions[order[idx]];
    const opts = shuffleArr([q.correct, ...q.wrong]);
    area.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-muted);margin-bottom:8px;">
          <span>Otázka ${idx + 1} / ${order.length}</span><span>Skóre ${score}</span>
        </div>
        <div style="font-weight:600;margin-bottom:10px;">${esc(q.q)}</div>
        <div id="aiExamOpts"></div>
      </div>`;
    const box = document.getElementById('aiExamOpts');
    let answered = false;
    opts.forEach(o => {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:5px 0;font-size:0.86rem;';
      b.textContent = o;
      b.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        if (o === q.correct) { b.style.background = 'rgba(34,197,94,0.25)'; score++; }
        else {
          b.style.background = 'rgba(239,68,68,0.25)';
          [...box.children].forEach(x => { if (x.textContent === q.correct) x.style.background = 'rgba(34,197,94,0.25)'; });
        }
        setTimeout(next, 1100);
      });
      box.appendChild(b);
    });
  };
  next();
}

// Local shuffle (game/quiz pages have their own; room.js didn't need one yet).
function shuffleArr(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function openAiCardsModal() {
  const listEl = document.getElementById('aiNotesList');
  listEl.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:.85rem;">Načítám poznámky…</div>';
  document.getElementById('aiCardsPreview').innerHTML = '';
  document.getElementById('aiSaveBtn').style.display = 'none';
  document.getElementById('aiGenerateBtn').style.display = 'inline-flex';
  document.getElementById('aiGenerateBtn').disabled = false;
  document.getElementById('aiGenerateBtn').textContent = '✨ Vygenerovat';
  const examArea = document.getElementById('aiExamArea');
  if (examArea) { examArea.style.display = 'none'; examArea.innerHTML = ''; }
  document.getElementById('aiDeckName').value = 'AI karty ze zápisků';
  openModal('aiCardsModal');

  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').orderBy('createdAt', 'asc').get();
    if (snap.empty) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:6px 2px;">Místnost ještě nemá žádné poznámky.</div>';
      return;
    }
    // Nothing pre-checked — the user picks which notes to draw from. The
    // "vybrat vše" master checkbox toggles the whole list at once.
    listEl.innerHTML = `<label class="ai-note-row" style="border-bottom:1px solid var(--border);margin-bottom:4px;padding-bottom:6px;">
        <input type="checkbox" id="aiNotesAll">
        <span style="font-weight:600;">Vybrat vše</span>
      </label>` +
      snap.docs.map(d => {
        const note = d.data();
        const preview = noteToPlainText(note).slice(0, 90) || '(prázdná poznámka)';
        return `<label class="ai-note-row">
          <input type="checkbox" class="ai-note-check" data-id="${d.id}" data-color="${note.color || '#fef9c3'}">
          <span>${esc(preview)}</span>
        </label>`;
      }).join('');

    const allChk = document.getElementById('aiNotesAll');
    allChk.addEventListener('change', () => {
      listEl.querySelectorAll('.ai-note-check').forEach(c => { c.checked = allChk.checked; });
    });
    // Un-ticking any single note un-ticks the master checkbox too.
    listEl.querySelectorAll('.ai-note-check').forEach(c => c.addEventListener('change', () => {
      const boxes = [...listEl.querySelectorAll('.ai-note-check')];
      allChk.checked = boxes.every(b => b.checked);
    }));
  } catch (e) {
    listEl.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;">Chyba při načítání poznámek: ${esc(e.message)}</div>`;
  }
}

async function generateAiCards() {
  const checkedIds = [...document.querySelectorAll('.ai-note-check:checked')].map(c => c.dataset.id);
  if (!checkedIds.length) { toast('Vyber alespoň jednu poznámku.'); return; }
  const count = Math.max(2, Math.min(20, parseInt(document.getElementById('aiCardCount').value) || 8));

  const btn = document.getElementById('aiGenerateBtn');
  btn.disabled = true; btn.textContent = '⏳ Připravuji…';
  const previewEl = document.getElementById('aiCardsPreview');
  previewEl.innerHTML = '<div id="aiStatusMsg" style="font-size:.82rem;color:var(--text-muted);margin-top:10px;">Generuji…</div>';

  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').get();
    const byId = new Map(snap.docs.map(d => [d.id, d.data()]));
    const combinedText = checkedIds
      .map(id => (byId.has(id) ? noteToPlainText(byId.get(id)) : ''))
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (!combinedText.trim()) { toast('Vybrané poznámky jsou prázdné.'); btn.disabled = false; btn.textContent = '✨ Vygenerovat'; return; }

    const prompt = `You are creating study flashcards from the notes below. Keep the SAME language as the notes (they may be in Czech).
Create exactly ${count} flashcards covering the key facts, terms, and concepts.
Each flashcard:
- "front": a short question or term
- "back": the concise, correct answer or definition
- "wrong": an array of plausible but clearly wrong answers (same format/length/language as "back", not variations of each other)
YOU decide how many answer options each question deserves: binary facts (yes/no, either/or) get 1 wrong answer, typical questions get 3, questions with many confusable alternatives (dates, names, terms) may get 4. So "wrong" has 1–4 items depending on the question.
Return ONLY a JSON array like this, nothing else: [{"front":"...","back":"...","wrong":["..."]}, ...]

NOTES:
"""
${combinedText.slice(0, 8000)}
"""`;

    const cards = await aiGenerate(prompt, {
      maxOutputTokens: 3500,
      parse(text) {
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('no-json');
        const arr = JSON.parse(m[0]);
        const clean = arr
          .filter(c => c && c.front && c.back)
          .map(c => {
            const distractors = (Array.isArray(c.wrong) ? c.wrong : [])
              .map(w => String(w).trim()).filter(Boolean).slice(0, 4);
            return {
              front: String(c.front).trim(),
              back: String(c.back).trim(),
              distractors,
              // The AI's chosen option count = its distractors + the answer.
              // No distractors sent → classic 4 options (the quiz pads with
              // other cards' backs).
              answerCount: distractors.length ? Math.min(5, distractors.length + 1) : 4,
            };
          });
        if (!clean.length) throw new Error('empty');
        return clean;
      },
    });

    AI_GENERATED_CARDS = cards;
    renderAiCardsPreview(cards);
    document.getElementById('aiSaveBtn').style.display = 'inline-flex';
    btn.style.display = 'none';
  } catch (e) {
    previewEl.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;margin-top:10px;">${aiErrorMessage(e)}</div>`;
    btn.disabled = false; btn.textContent = '✨ Vygenerovat';
  }
}

function renderAiCardsPreview(cards) {
  const el = document.getElementById('aiCardsPreview');
  el.innerHTML = `<label class="label" style="margin-top:12px;display:block;">Náhled — odškrtni, co nechceš uložit:</label>
    <div class="ai-cards-preview-list">` +
    cards.map((c, i) => `
      <label class="ai-card-row">
        <input type="checkbox" class="ai-card-check" data-i="${i}" checked>
        <span><b>${esc(c.front)}</b><br><span style="color:var(--text-muted);">${esc(c.back)}</span>
          ${(c.distractors && c.distractors.length)
            ? `<br><span style="font-size:0.74rem;color:var(--text-muted);">❌ ${c.distractors.map(esc).join(' · ')} <span style="opacity:0.7;">(${c.answerCount} možností)</span></span>`
            : ''}
        </span>
      </label>`).join('') +
    `</div>`;
}

async function saveAiCards() {
  const checkedIdx = [...document.querySelectorAll('.ai-card-check:checked')].map(c => parseInt(c.dataset.i, 10));
  const toSave = checkedIdx.map(i => AI_GENERATED_CARDS[i]).filter(Boolean);
  if (!toSave.length) { toast('Nic není vybráno k uložení.'); return; }

  const btn = document.getElementById('aiSaveBtn');
  btn.disabled = true; btn.textContent = 'Ukládám…';
  try {
    // Always create a fresh deck owned by the current user — Firestore rules
    // only let a deck's owner write cards into it, so reusing someone else's
    // room deck here would just fail silently otherwise.
    const name = document.getElementById('aiDeckName').value.trim() || 'AI karty ze zápisků';
    // Match the color of the note(s) these cards were generated from,
    // instead of always defaulting to the same indigo.
    const sourceColor = document.querySelector('.ai-note-check:checked')?.dataset.color || '#6366f1';
    const deckRef = await db.collection('decks').add({
      name, color: sourceColor, description: null,
      ownerUid: ME.uid, roomId: ROOM_ID, cardCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const batch = db.batch();
    const cardsCol = deckRef.collection('cards');
    toSave.forEach(c => {
      batch.set(cardsCol.doc(), {
        front: c.front,
        back: c.back,
        distractors: c.distractors || [],
        answerCount: c.answerCount || 4,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    batch.update(deckRef, { cardCount: toSave.length });
    await batch.commit();
    toast(`Uloženo ${toSave.length} karet do balíčku „${name}" ✓`);
    closeModal('aiCardsModal');
  } catch (e) {
    toast('Chyba při ukládání: ' + e.message);
  }
  btn.disabled = false; btn.textContent = '💾 Uložit vybrané';
}


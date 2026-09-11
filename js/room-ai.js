// ═══ room-ai.js — AI karty a AI zkoušení z poznámek
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

let AI_GENERATED_CARDS = [];

// Flatten a note's content to plain text for the AI prompt. Tables are
// converted to "cell | cell" rows (not just mashed together) since notes can
// contain them; images/formatting are irrelevant for text-based extraction.
function noteToPlainText(note) {
  const pages = Array.isArray(note.pages) ? note.pages : [];
  if (note.contentType !== 'html' && !pages.length) return (note.content || '').trim();
  const d = document.createElement('div');
  d.innerHTML = note.content || '';
  // A guide keeps its text in chapters — fold them in, so search, AI cards
  // and fact-checking see the whole thing and not the (often empty) body.
  pages.forEach(pg => {
    const sec = document.createElement('div');
    sec.innerHTML = `<p>${pg.title || ''}</p>` + (pg.content || '');
    d.appendChild(sec);
  });
  d.querySelectorAll('table').forEach(table => {
    const rows = [...table.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => c.textContent.trim()).join(' | ')
    );
    table.replaceWith(document.createTextNode('\n' + rows.join('\n') + '\n'));
  });
  // textContent alone glues block elements together ("}public class...") and
  // the old blanket [ \t]+ squeeze flattened indentation. Both are fatal once
  // notes contain source code, so line breaks are materialised first and
  // only runs of spaces INSIDE a line get collapsed.
  d.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  d.querySelectorAll('div, p, li, h1, h2, h3, h4, pre, blockquote').forEach(b => b.append('\n'));
  return (d.textContent || '')
    .replace(/\u00a0/g, ' ')            // &nbsp; — how contenteditable stores indents
    .replace(/(\S)[^\S\n]{2,}/g, '$1 ') // squeeze mid-line runs, keep indentation
    .replace(/[^\S\n]+$/gm, '')         // trailing spaces
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

// Render a snippet as a real code block: monospace, indentation preserved,
// horizontally scrollable. Shared by the AI preview, the exam and (via the
// same markup/CSS) the flash-card pages.
function codeBlockHtml(code, lang) {
  return `<pre class="code-block"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(code || '')}</code></pre>`;
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
Each question: "q" is the question, "correct" is the best right answer, "alsoCorrect" is an array of 0-4 OTHER answers that are ALSO fully correct (leave it empty when the question truly has one answer), and "wrong" is an array of 4-6 plausible but clearly wrong answers (same format/length as the correct one, never accidentally correct). Treat these as POOLS — a random subset of each is shown per attempt.
If the notes contain programming code, also ask real code questions ("what does this print?", "find the bug", "complete the loop"). Put the properly indented code straight into "q" (no markdown fences) and add "lang" with the language id (java, python, sql...). If the ANSWERS are code, add "answersAreCode": true.
Return ONLY a JSON array like this, nothing else: [{"q":"...","correct":"...","alsoCorrect":["..."],"wrong":["...","...","...","..."],"lang":"java"}, ...]

NOTES:
"""
${combinedText.slice(0, 8000)}
"""`;

    const questions = await aiGenerate(prompt, {
      maxOutputTokens: 3000,
      parse(text) {
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('no-json');
        const arr = JSON.parse(repairAiJson(m[0]));
        const clean = arr
          .filter(x => x && x.q && x.correct && Array.isArray(x.wrong) && x.wrong.length)
          .map(x => ({ q: String(x.q).trim(), correct: String(x.correct).trim(),
                       alsoCorrect: examCorrects(x),
                       wrong: examWrongs(x),
                       lang: String(x.lang || '').trim().toLowerCase().replace(/[^a-z+#]/g, '').slice(0, 12) || null,
                       answersAreCode: !!x.answersAreCode }));
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

// Shared sanitisation for exam questions: strip duplicates, and drop any
// answer the model listed as both correct and wrong.
function examConflict(x) {
  const also = (Array.isArray(x.alsoCorrect) ? x.alsoCorrect : []).map(w => String(w).trim()).filter(Boolean);
  const wrong = (Array.isArray(x.wrong) ? x.wrong : []).map(w => String(w).trim()).filter(Boolean);
  return { also, wrong, conflict: new Set(also.filter(w => wrong.includes(w))) };
}
function examCorrects(x) {
  const { also, conflict } = examConflict(x);
  const correct = String(x.correct).trim();
  return [...new Set(also.filter(w => w !== correct && !conflict.has(w)))].slice(0, 4);
}
function examWrongs(x) {
  const { wrong, conflict } = examConflict(x);
  const ok = new Set([String(x.correct).trim(), ...examCorrects(x)]);
  return [...new Set(wrong.filter(w => !ok.has(w) && !conflict.has(w)))].slice(0, 6);
}

// Same idea as the quiz page: the model supplies pools, we pick a random
// subset of each so no two attempts look alike.
function examOptions(q) {
  const correctPool = [q.correct, ...(q.alsoCorrect || [])].filter(Boolean);
  const uniqCorrect = [...new Set(correctPool)];
  const wrongPool = [...new Set((q.wrong || []).filter(w => w && !uniqCorrect.includes(w)))];
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const nCorrect = uniqCorrect.length > 1 ? rnd(1, Math.min(uniqCorrect.length, 3)) : 1;
  const nWrong = Math.max(1, Math.min(uniqCorrect.length > 1 ? rnd(2, 5) : 3, wrongPool.length));
  return shuffleArr([
    ...shuffleArr(uniqCorrect).slice(0, nCorrect).map(text => ({ text, correct: true })),
    ...shuffleArr(wrongPool).slice(0, nWrong).map(text => ({ text, correct: false })),
  ]);
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
    const opts = examOptions(q);
    const multi = questions.some(x => (x.alsoCorrect || []).length > 0);
    area.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-muted);margin-bottom:8px;">
          <span>Otázka ${idx + 1} / ${order.length}</span><span>Skóre ${score}</span>
        </div>
        <div style="font-weight:600;margin-bottom:10px;">${q.lang ? codeBlockHtml(q.q, q.lang) : esc(q.q)}</div>
        ${multi ? '<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:8px;">☑️ Zaškrtni <b>všechny</b> správné — může jich být i víc.</div>' : ''}
        <div id="aiExamOpts"></div>
        ${multi ? '<button class="btn btn-primary" id="aiExamConfirm" style="margin-top:8px;font-size:0.82rem;" disabled>Potvrdit</button>' : ''}
      </div>`;
    const box = document.getElementById('aiExamOpts');
    const confirmBtn = document.getElementById('aiExamConfirm');
    let answered = false;
    const reveal = ok => {
      answered = true;
      [...box.children].forEach((x, i) => {
        x.disabled = true;
        if (opts[i].correct) x.style.background = 'rgba(34,197,94,0.25)';
        else if (x.dataset.sel) x.style.background = 'rgba(239,68,68,0.25)';
      });
      if (ok) score++;
      if (confirmBtn) confirmBtn.disabled = true;
      setTimeout(next, ok ? 1100 : 1700);
    };
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:5px 0;font-size:0.86rem;'
        + (q.answersAreCode ? "font-family:'SF Mono',Consolas,monospace;white-space:pre-wrap;" : '');
      b.textContent = (multi ? '☐  ' : '') + o.text;
      b.addEventListener('click', () => {
        if (answered) return;
        if (!multi) { reveal(o.correct); return; }
        b.dataset.sel = b.dataset.sel ? '' : '1';
        b.textContent = (b.dataset.sel ? '☑  ' : '☐  ') + o.text;
        confirmBtn.disabled = ![...box.children].some(x => x.dataset.sel);
      });
      box.appendChild(b);
    });
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (answered) return;
      const ok = opts.every((o, i) => !!box.children[i].dataset.sel === !!o.correct);
      reveal(ok);
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
      snap.docs.filter(d => d.data().kind !== 'heading').map(d => {
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
- "back": the single best correct answer or definition
- "alsoCorrect": an array of OTHER answers that are ALSO fully correct for this question — different true facts, valid alternatives, other members of the same set (e.g. for "Which are OSI layers?" list several real layers; for "Which keywords declare a variable in JS?" list let, const, var). Give 0-4 of them: 0 when the question genuinely has one single answer, more when it honestly has several. Never pad it with half-truths.
- "wrong": an array of 4-6 plausible but clearly WRONG answers, in the same format/length/language as "back", not variations of each other and not accidentally correct.
Write these as POOLS — the app picks a random subset of each for every attempt, so more is better as long as every entry is honestly right (or honestly wrong).

SOURCE CODE: if the notes contain programming code, make proper code cards too, and mark them so they render as code:
- "frontLang": language id (java, python, c, cpp, csharp, js, php, sql, html, css, bash...) when the QUESTION itself is code — e.g. "What does this print?", "Find the bug", "What is the complexity?". Put the real, correctly indented code in "front".
- "codeLang": same idea when the ANSWER is code — e.g. "Write a for-each loop over a List". Put the code in "back", and make "wrong" plausible but genuinely broken/incorrect code in the same language.
Keep code short (max ~12 lines), keep the original indentation using real newlines, and never wrap it in markdown fences. Use the language actually used in the notes. Mix code cards with normal ones when the notes mix theory and code.
Return ONLY a JSON array like this, nothing else: [{"front":"...","back":"...","alsoCorrect":["..."],"wrong":["...","...","...","..."],"codeLang":"java"}, ...]

NOTES:
"""
${combinedText.slice(0, 8000)}
"""`;

    const cards = await aiGenerate(prompt, {
      maxOutputTokens: 3500,
      parse(text) {
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('no-json');
        const arr = JSON.parse(repairAiJson(m[0]));
        const clean = arr
          .filter(c => c && c.front && c.back)
          .map(c => {
            const back = String(c.back).trim();
            const rawWrong = (Array.isArray(c.wrong) ? c.wrong : []).map(w => String(w).trim()).filter(Boolean);
            // Extra correct answers — the quiz shows a random subset of them.
            // Anything the model listed as correct AND wrong is contradictory,
            // so it is dropped from both rather than trusted either way.
            const rawAlso = (Array.isArray(c.alsoCorrect) ? c.alsoCorrect : []).map(w => String(w).trim()).filter(Boolean);
            // Listed as correct AND wrong = the model contradicted itself.
            // Drop it from both: being marked wrong for picking a genuinely
            // correct answer is the worse failure, so never risk it.
            const conflict = new Set(rawAlso.filter(w => rawWrong.includes(w)));
            const corrects = [...new Set(rawAlso.filter(w => w !== back && !conflict.has(w)))].slice(0, 4);
            const correctSet = new Set([back, ...corrects]);
            const distractors = [...new Set(rawWrong.filter(w => !correctSet.has(w) && !conflict.has(w)))].slice(0, 6);
            // Only accept a language we can plausibly render as code.
            const lang = v => {
              const t = String(v || '').trim().toLowerCase().replace(/[^a-z+#]/g, '');
              return t && t.length <= 12 ? t : null;
            };
            return {
              front: String(c.front).trim(),
              back,
              corrects,
              frontLang: lang(c.frontLang),
              codeLang: lang(c.codeLang),
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
        <span>${c.frontLang ? `<b>Kód (${esc(c.frontLang)}):</b>${codeBlockHtml(c.front, c.frontLang)}` : `<b>${esc(c.front)}</b>`}<br><span style="color:var(--text-muted);">${c.codeLang ? codeBlockHtml(c.back, c.codeLang) : esc(c.back)}</span>
          ${(c.corrects && c.corrects.length)
            ? `<br><span style="font-size:0.74rem;color:#86efac;">✔ také správně: ${c.corrects.map(esc).join(' · ')}</span>`
            : ''}
          ${(c.distractors && c.distractors.length)
            ? `<br><span style="font-size:0.74rem;color:var(--text-muted);">❌ ${c.distractors.map(esc).join(' · ')} <span style="opacity:0.7;">(kvíz vybere náhodně)</span></span>`
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
        corrects: c.corrects || [],       // further answers that are also right
        frontLang: c.frontLang || null,   // question is code, in this language
        codeLang: c.codeLang || null,     // answer is code, in this language
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


// ── Fact check (Google Search grounded) ───────────────────────
// Pulls the claims out of one note and checks each against the live web,
// then shows the verdicts with clickable sources. It NEVER edits the note —
// it flags, you decide. Expect false alarms on wording, on subjects taught a
// particular way, and on anything specific to your class; the source links
// are there so you can settle it yourself.
function factVerdictMeta(v) {
  return ({
    ok:           { icon: '✅', label: 'Sedí',          cls: 'fc-ok' },
    suspicious:   { icon: '⚠️', label: 'Podezřelé',     cls: 'fc-warn' },
    wrong:        { icon: '❌', label: 'Nesedí',        cls: 'fc-bad' },
    unverifiable: { icon: '❓', label: 'Nešlo ověřit',  cls: 'fc-unk' },
  })[v] || { icon: '❓', label: 'Nešlo ověřit', cls: 'fc-unk' };
}

// Last result, kept so it can be turned into a note without re-asking.
let FACT_RESULT = null;

async function factCheckNote(noteId) {
  const note = NOTES_MAP.get(noteId);
  if (!note) return;
  FACT_RESULT = null;
  const text = noteToPlainText(note).trim();
  if (text.length < 15) { toast('Poznámka je moc krátká na kontrolu.'); return; }

  openModal('factCheckModal');
  const body = document.getElementById('factCheckBody');
  document.getElementById('factCheckTitle').textContent = exportNoteTitle(note);
  body.innerHTML = '<div class="fc-loading"><div class="spinner"></div>' +
    '<div>Ověřuji tvrzení na webu…<br><span style="font-size:0.78rem;color:var(--text-muted);">' +
    'Prohledávám zdroje, chvilku to trvá.</span></div></div>';

  const prompt = `You are checking a student's study notes for factual errors, using web search.
Keep the SAME language as the notes (they are likely Czech).

Pull out the individual factual CLAIMS from the notes below and verify each one.
Skip anything that is not a checkable fact (headings, personal reminders, to-dos, opinions, task lists).
Check at most 12 claims — pick the ones where being wrong would matter most.

For each claim return:
- "claim": the claim, quoted or closely paraphrased from the notes (short)
- "verdict": "ok" (matches reliable sources), "wrong" (clearly contradicted), "suspicious" (imprecise, outdated, misleading or only partly true), or "unverifiable" (no reliable source found)
- "note": one short sentence saying WHY — for anything other than "ok", say what the sources actually state
- "fix": the corrected wording, ONLY for "wrong" or "suspicious"; otherwise an empty string

Be conservative: if the notes are a simplification that a teacher would accept, that is "ok", not "wrong".
Do not invent errors to seem useful. It is fine for every claim to be "ok".

Return ONLY a JSON array, nothing else:
[{"claim":"...","verdict":"ok","note":"...","fix":""}]

NOTES:
"""
${text.slice(0, 6000)}
"""`;

  try {
    const { text: out, sources, queries } = await aiGenerateGrounded(prompt);
    const m = out.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('parse');
    const items = JSON.parse(repairAiJson(m[0]))
      .filter(x => x && x.claim)
      .map(x => ({
        claim: String(x.claim).trim(),
        verdict: String(x.verdict || 'unverifiable').toLowerCase(),
        note: String(x.note || '').trim(),
        fix: String(x.fix || '').trim(),
      }));
    if (!items.length) throw new Error('empty');
    FACT_RESULT = { noteId, items, sources, queries };
    renderFactCheck(items, sources, queries);
  } catch (e) {
    const msg = e.message === 'no-gemini-key'
      ? 'Kontrola faktů potřebuje Gemini klíč — nastav ho v AI kartách.'
      : e.message === 'rate-limit'
        ? 'Vyčerpaný denní limit vyhledávání (1500/den). Zkus to zítra.'
        : e.message === 'invalid-key'
          ? 'Gemini klíč neplatí.'
          : 'Nepovedlo se ověřit: ' + e.message;
    body.innerHTML = `<div style="color:#fca5a5;font-size:0.88rem;padding:14px 0;">${esc(msg)}</div>`;
  }
}

function renderFactCheck(items, sources, queries) {
  const body = document.getElementById('factCheckBody');
  const bad = items.filter(i => i.verdict === 'wrong').length;
  const warn = items.filter(i => i.verdict === 'suspicious').length;

  const summary = bad || warn
    ? `Našel jsem ${bad ? `<b>${bad}× nesedí</b>` : ''}${bad && warn ? ' a ' : ''}${warn ? `<b>${warn}× podezřelé</b>` : ''}.`
    : 'Nic podezřelého jsem nenašel.';

  body.innerHTML = `
    <div class="fc-summary">${summary}
      <span style="display:block;margin-top:4px;font-size:0.76rem;color:var(--text-muted);">
        Ber to jako upozornění, ne rozsudek — u formulací a školních zjednodušení se AI plete.
        Klikni na zdroj a rozhodni sám. Poznámku ti nic nepřepsalo.
      </span>
    </div>
    <div class="fc-list">
      ${items.map(i => {
        const m = factVerdictMeta(i.verdict);
        return `<div class="fc-item ${m.cls}">
          <div class="fc-head"><span class="fc-icon">${m.icon}</span><span class="fc-claim">${esc(i.claim)}</span>
            <span class="fc-badge">${m.label}</span></div>
          ${i.note ? `<div class="fc-note">${esc(i.note)}</div>` : ''}
          ${i.fix ? `<div class="fc-fix"><b>Správně:</b> ${esc(i.fix)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
    ${sources.length ? `
      <div class="fc-sources">
        <div class="fc-sources-h">📚 Zdroje, ze kterých se ověřovalo</div>
        ${sources.map(s => `<a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.uri)}</a>`).join('')}
      </div>` : ''}
    ${queries.length ? `<div class="fc-queries">Hledalo se: ${queries.map(esc).join(' · ')}</div>` : ''}
    ${canWriteNotes() ? `
      <div class="fc-actions">
        <button class="btn btn-primary" id="factSaveBtn" style="font-size:0.84rem;">📝 Uložit jako novou poznámku</button>
        <span style="font-size:0.74rem;color:var(--text-muted);">Původní poznámka zůstane nedotčená.</span>
      </div>` : ''}`;

  document.getElementById('factSaveBtn')?.addEventListener('click', saveFactCheckAsNote);
}

function canWriteNotes() {
  return MY_ROLE !== 'viewer' && !(ME.isAnonymous && MY_ROLE !== 'owner');
}

// Turn the verdicts into a NEW note pinned beside the original. Nothing is
// ever written back into the source note — that is the whole point: you keep
// the original wording and get the findings, with their sources, next to it.
async function saveFactCheckAsNote() {
  if (!FACT_RESULT) return;
  const btn = document.getElementById('factSaveBtn');
  const src = NOTES_MAP.get(FACT_RESULT.noteId);
  if (!src) { toast('Původní poznámka už neexistuje.'); return; }
  btn.disabled = true; btn.textContent = '⏳ Ukládám…';

  const { items, sources, queries } = FACT_RESULT;
  const rows = items.map(i => {
    const m = factVerdictMeta(i.verdict);
    return `<li><b>${m.icon} ${esc(i.claim)}</b>` +
      (i.note ? `<br><span style="color:#64748b;">${esc(i.note)}</span>` : '') +
      (i.fix ? `<br>✔️ <b>Správně:</b> ${esc(i.fix)}` : '') +
      `</li>`;
  }).join('');

  const srcList = sources.length
    ? `<p><b>📚 Zdroje</b></p><ul>` +
      sources.map(s => `<li><a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.uri)}</a></li>`).join('') +
      `</ul>`
    : '';

  const when = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const content =
    `<p><i>Ověření poznámky „${esc(exportNoteTitle(src))}" ze dne ${esc(when)}. ` +
    `Původní poznámka je beze změny — tohle je jen nález, rozhodni sám.</i></p>` +
    `<ul>${rows}</ul>` + srcList +
    (queries.length ? `<p style="color:#64748b;font-size:0.85em;">Hledalo se: ${queries.map(esc).join(' · ')}</p>` : '');

  try {
    await db.collection('rooms').doc(ROOM_ID).collection('notes').add({
      title: 'Ověření: ' + exportNoteTitle(src).slice(0, 60),
      content,
      contentType: 'html',
      color: '#e0f2fe',                       // distinct from a normal note
      x: (src.x || 60) + 260, y: (src.y || 60), // beside the original
      authorId: ME.uid,
      authorName: ME.displayName || ME.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    logActivity('note', `uložil ověření faktů k „${exportNoteTitle(src)}"`);
    toast('Poznámka s ověřením vytvořena ✓');
    closeModal('factCheckModal');
  } catch (e) {
    toast('Chyba: ' + e.message);
    btn.disabled = false; btn.textContent = '📝 Uložit jako novou poznámku';
  }
}

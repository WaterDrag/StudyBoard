// ═══ room-ai.js — AI karty a AI zkoušení z poznámek
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

let AI_GENERATED_CARDS = [];
const AI_CARD_MAX = 100;
const AI_CARD_BATCH_SIZE = 8;
const AI_CARD_PARALLELISM = 3;
let AI_SOURCE_COLOR = null;
let AI_JOB = { status: 'idle', done: 0, total: 0, cards: [], message: '' };

// Flatten a note's content to plain text for the AI prompt. Tables are
// converted to "cell | cell" rows (not just mashed together) since notes can
// contain them; images/formatting are irrelevant for text-based extraction.
function noteToPlainText(note) {
  const pages = Array.isArray(note.pages) ? note.pages : [];
  if (note.contentType !== 'html' && !pages.length) return (note.content || '').trim();
  const d = document.createElement('div');
  d.innerHTML = sbSafeHtml(note.content);
  // A guide keeps its text in chapters — fold them in, so search, AI cards
  // and fact-checking see the whole thing and not the (often empty) body.
  pages.forEach(pg => {
    const sec = document.createElement('div');
    sec.innerHTML = `<p>${esc(pg.title || '')}</p>` + sbSafeHtml(pg.content);
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

// A reply copied out of a chat app often isn't valid JSON any more: the app
// (or autocorrect) turns the quotes into “typographic” ones, and people copy
// just the objects without the surrounding [ ]. The same characters also
// appear INSIDE the text (Czech „quotes“, Click="Save" in code), so a quote
// only counts as the end of a string when JSON structure follows it.
const CHAT_QUOTES = '"“”„‟″';
function closesChatString(txt, i) {
  while (i < txt.length && /\s/.test(txt[i])) i++;
  if (i >= txt.length || '}]:'.includes(txt[i])) return true;
  if (txt[i] !== ',') return false;
  i++;
  while (i < txt.length && /\s/.test(txt[i])) i++;
  return i >= txt.length || CHAT_QUOTES.includes(txt[i]) || '{[]}'.includes(txt[i]);
}
function looseChatJsonArray(txt) {
  let out = '', inStr = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (!inStr) {
      if (CHAT_QUOTES.includes(ch)) { out += '"'; inStr = true; } else out += ch;
      continue;
    }
    if (ch === '\\') { out += ch + (txt[i + 1] ?? ''); i++; continue; }
    if (CHAT_QUOTES.includes(ch) && closesChatString(txt, i + 1)) { out += '"'; inStr = false; continue; }
    if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else out += ch;
  }
  const arrAt = out.indexOf('['), objAt = out.indexOf('{');
  if (objAt < 0 && arrAt < 0) return null;
  const json = objAt >= 0 && (arrAt < 0 || objAt < arrAt)
    ? '[' + out.slice(objAt, out.lastIndexOf('}') + 1) + ']'
    : out.slice(arrAt, out.lastIndexOf(']') + 1);
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : null;
  } catch (_) { return null; }
}

// Cards and exam questions are answered by someone who sees ONLY the card —
// not the notes. Without this, the model happily asks "what does Withdraw()
// return?" about a class that exists only in the notes, which nobody can
// answer from the card alone.
const AI_SELF_CONTAINED_RULE = `SELF-CONTAINED QUESTIONS (most important rule): the student sees ONLY the question and the answer choices, never the notes. Every question must be answerable from that alone plus general knowledge of the topic.
- Never refer to "the code above", "the example", "the program from the notes", "this class" etc.
- If a question is about specific code (what a method returns, what it prints, which member is static, where the bug is...), put that code — or the relevant excerpt of it — into the question itself, marked as code. Include every line needed to answer; a method body that is not shown cannot be asked about.
- Only use names of classes, methods, variables or examples defined in the notes (e.g. Withdraw(), BankAccount, TbName) if the question also shows their code or fully describes what they are.
- If the needed code is missing from the notes or too long to show, ask about the general concept instead (e.g. "What does a method with return type bool tell the caller?").`;

// Render a snippet as a real code block: monospace, indentation preserved,
// horizontally scrollable. Shared by the AI preview, the exam and (via the
// same markup/CSS) the flash-card pages.
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

// ── Typ kartiček ──────────────────────────────────────────────
// quiz  = otázka + možnosti (správné i špatné) — kvíz
// learn = klasické flash cards: pojem/otázka ⟷ krátká odpověď
// info  = výkladové: „XAML je …“ + celá informace na jedné straně; nic se nezkouší
// set   = všechny tři naráz (každé téma jako výklad, kartička i kvíz)
const AI_SET_KINDS = ['info', 'learn', 'quiz'];
function aiCardKind() {
  return document.querySelector('input[name="aiKind"]:checked')?.value || 'set';
}

// Podle stavby vybraných poznámek doporučí typ: slovníček pojmů → učební,
// souvislý výklad → výkladové, kód / výčty faktů → kvíz.
function recommendAiKind(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const defs = lines.filter(l => /^[-•*\d.)\s]*[^\s].{0,48}?\s[–—:=-]\s+\S/.test(l)).length;
  const code = lines.filter(l => /[{};]$|^(public|private|class|def|function|for|if|while|<\w+[\s>])/.test(l)).length;
  const prose = lines.filter(l => l.length > 110).length;
  if (code >= 4 && code / lines.length > 0.12)
    return { kind: 'quiz', why: 'V poznámkách je hodně kódu — kvíz prověří, jestli mu rozumíš (co vypíše, kde je chyba…).' };
  if (defs >= 4 && defs / lines.length > 0.25)
    return { kind: 'learn', why: `Poznámky jsou hlavně pojmy s definicí (${defs}×) — na ty jsou nejlepší klasické učební kartičky.` };
  if (prose >= 3 && prose / lines.length > 0.3)
    return { kind: 'info', why: 'Poznámky jsou souvislý výklad — výkladové karty z něj udělají krátké informace na první čtení.' };
  return { kind: 'quiz', why: 'Poznámky jsou výčty faktů — kvíz z nich udělá otázky s možnostmi.' };
}

function updateAiKindRecommendation() {
  const ids = [...document.querySelectorAll('.ai-note-check:checked')].map(c => c.dataset.id);
  const text = ids.map(id => NOTES_MAP.get(id)).filter(Boolean).map(noteToPlainText).join('\n');
  const rec = recommendAiKind(text);
  document.querySelectorAll('.ai-kind').forEach(k => {
    if (k.querySelector('input').value === 'set') return;
    k.querySelector('.ai-kind-rec').hidden = !rec || k.querySelector('input').value !== rec.kind;
  });
  const why = document.getElementById('aiKindWhy');
  if (why) why.textContent = rec ? '💡 Kdybys chtěl jen jeden typ: ' + rec.why : '';
}
let AI_KIND_TOUCHED = false;

function setupAiCards() {
  const btn = document.getElementById('aiCardsBtn');
  if (!btn) return;
  document.querySelectorAll('input[name="aiKind"]').forEach(r => r.addEventListener('change', () => { AI_KIND_TOUCHED = true; }));
  document.getElementById('aiNotesList')?.addEventListener('change', e => {
    if (e.target.matches('.ai-note-check, #aiNotesAll')) setTimeout(updateAiKindRecommendation, 0);
  });
  // Anonymous guests can't create AI decks — they'd outlive the guest.
  if (ME.isAnonymous) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', openAiCardsModal);
  document.getElementById('aiGenerateBtn').addEventListener('click', generateAiCards);
  document.getElementById('aiSaveBtn').addEventListener('click', saveAiCards);
  document.getElementById('aiJobNotice')?.addEventListener('click', () => openModal('aiCardsModal'));
  const autoCount = document.getElementById('aiAutoCount');
  const manualCount = document.getElementById('aiManualCountMode');
  const countInput = document.getElementById('aiCardCount');
  const updateCountInput = () => { countInput.disabled = !manualCount.checked; };
  autoCount.addEventListener('change', updateCountInput);
  manualCount.addEventListener('change', updateCountInput);
  updateCountInput();
  document.getElementById('aiExamBtn').addEventListener('click', runAiExam);
  document.getElementById('aiCopyPrompt')?.addEventListener('click', copyAiCardsPrompt);
  document.getElementById('aiParsePaste')?.addEventListener('click', useAiCardsPaste);
}

// ── Režim bez API klíče: zadání do schránky, odpověď zpátky ───
// Pro toho, kdo si klíč udělat nechce: StudyBoard sestaví stejné zadání, jaké
// jinak posílá do API, a odpověď z libovolného chatu si rozebere sám.
function aiManualMsg(text, kind) {
  const el = document.getElementById('aiManualMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'ai-manual-msg' + (kind ? ' ' + kind : '');
}

async function copyAiCardsPrompt() {
  const ids = [...document.querySelectorAll('.ai-note-check:checked')].map(c => c.dataset.id);
  if (!ids.length) { aiManualMsg('Nejdřív vyber aspoň jednu poznámku.', 'err'); return; }
  const automatic = document.getElementById('aiAutoCount').checked;
  const count = automatic ? null : Math.max(2, Math.min(AI_CARD_MAX, parseInt(document.getElementById('aiCardCount').value) || 8));
  const btn = document.getElementById('aiCopyPrompt');
  btn.disabled = true;
  try {
    const text = await selectedNotesText(ids);
    if (!text.trim()) { aiManualMsg('Vybrané poznámky jsou prázdné.', 'err'); return; }
    const prompt = buildAiCardsPrompt(text, count, automatic, aiCardKind());
    const box = document.getElementById('aiPromptBox');
    try {
      await copyToClipboard(prompt);
      if (box) box.style.display = 'none';
      aiManualMsg('Zkopírováno (' + Math.round(prompt.length / 1000) + ' tis. znaků) — vlož to do chatu.', 'ok');
    } catch (e) {
      // Schránku může odmítnout oprávnění i prohlížeč. Není důvod skončit —
      // ukaž zadání rovnou tady a nech ho označené, ať staví jen Ctrl+C.
      if (box) {
        box.value = prompt;
        box.style.display = 'block';
        box.focus(); box.select();
      }
      aiManualMsg('Schránku prohlížeč nepustil — zadání je níž, zkopíruj ho přes Ctrl+C.', 'err');
    }
  } catch (e) {
    aiManualMsg('Nepovedlo se: ' + (e?.message || e), 'err');
  } finally { btn.disabled = false; }
}

// navigator.clipboard vyžaduje https nebo localhost — na http by tiše selhalo,
// proto záloha přes skrytý textarea + execCommand.
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (_) { /* spadneme do zálohy níž */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('prohlížeč kopírování odmítl');
}

// Odpověď může mít víc bloků kódu (chat ji rozdělil) — každý se přečte zvlášť.
function parseAiCardsMulti(raw) {
  const blocks = [...raw.matchAll(/\x60{3}(?:json)?\s*([\s\S]*?)\x60{3}/gi)].map(m => m[1]).filter(b => /[[{]/.test(b));
  if (blocks.length > 1) {
    const all = [];
    blocks.forEach(b => { try { all.push(...parseAiCards(b)); } catch (_) { /* rozbitý blok přeskočit */ } });
    if (all.length) return all;
  }
  return parseAiCards(raw);
}
// Další vložená část se PŘIDÁ k už načteným kartičkám (bez opakování).
function useAiCardsPaste() {
  const box = document.getElementById('aiPasteBox');
  const raw = (box?.value || '').trim();
  if (!raw) { aiManualMsg('Vlož nejdřív odpověď z chatu.', 'err'); return; }
  let cards;
  try {
    cards = parseAiCardsMulti(raw);
  } catch (e) {
    aiManualMsg(e?.message === 'no-json'
      ? 'V té odpovědi není JSON se seznamem kartiček. Zkopíruj ji celou, i s hranatými závorkami.'
      : 'Odpověď se nepodařilo přečíst — chatu řekni, ať vrátí JEN ten JSON.', 'err');
    return;
  }
  const prev = AI_JOB.pasted && AI_JOB.status === 'ready' ? AI_GENERATED_CARDS : [];
  const key = c => (c.kind || '') + '|' + String(c.front).toLowerCase().replace(/\s+/g, ' ').trim();
  const seen = new Set(prev.map(key));
  const added = cards.filter(c => { const k = key(c); if (seen.has(k)) return false; seen.add(k); return true; });
  const all = [...prev, ...added];
  AI_GENERATED_CARDS = all;
  AI_JOB = { ...AI_JOB, status: 'ready', cards: all, kind: aiCardKind(), pasted: true };
  renderAiCardsPreview(all);
  document.getElementById('aiSaveBtn').style.display = 'inline-flex';
  document.getElementById('aiGenerateBtn').style.display = 'none';
  box.value = '';
  const more = /POKRAČOVÁNÍ/i.test(raw) && !/HOTOVO/i.test(raw);
  aiManualMsg((prev.length ? `Přidáno ${added.length} (celkem ${all.length}).` : `Načteno ${all.length} kartiček.`)
    + (more ? ' Chat má pokračování — napiš mu „pokračuj“ a další část vlož sem, přidá se.' : /HOTOVO/i.test(raw) ? ' Chat má hotovo ✓' : ' Další část z chatu sem můžeš vložit taky, přidá se.'), 'ok');
  updateAiJobNotice();
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
Each question: "q" is the question, "correct" is one correct choice, "alsoCorrect" is an array of 0-4 OTHER independently correct choices that should be selected together with it when shown. Use these only when the notes support a question with several answers (for example, "Which of these...?"); phrase "q" clearly as a plural/multiple-answer question. Do NOT put synonyms, paraphrases, mutually exclusive alternatives, or "name any one" answers in "alsoCorrect". Leave it empty for a genuinely single-answer question. Include multiple correct choices whenever the notes clearly support them; do not force them when they do not. "wrong" is an array of 4-6 plausible but clearly wrong answers (same format/length as the correct one, never accidentally correct). Treat these as POOLS — a random subset of each is shown per attempt.
If the notes contain programming code, also ask real code questions ("what does this print?", "find the bug", "complete the loop"). Put the properly indented code straight into "q" (no markdown fences) and add "lang" with the language id (java, python, sql...). If the ANSWERS are code, add "answersAreCode": true.
${AI_SELF_CONTAINED_RULE}
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
  const nCorrect = uniqCorrect.length > 1 ? rnd(2, Math.min(uniqCorrect.length, 3)) : 1;
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
    // Decide from the options shown on this question, not from the full exam.
    const multi = opts.filter(x => x.correct).length > 1;
    area.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-muted);margin-bottom:8px;">
          <span>Otázka ${idx + 1} / ${order.length}</span><span>Skóre ${score}</span>
        </div>
        <div style="font-weight:600;margin-bottom:10px;">${q.lang ? codeQuestionHtml(q.q, q.lang) : esc(q.q)}</div>
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
      if (ok) { setTimeout(next, 1100); return; }
      // Spatne: cekej, az si clovek prectet spravnou odpoved.
      const v = document.createElement('div');
      v.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:8px;font-size:0.82rem;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.5);';
      v.textContent = '✕ Špatně — správná odpověď je zeleně.';
      const go = document.createElement('button');
      go.className = 'btn btn-primary';
      go.style.cssText = 'margin-top:8px;font-size:0.82rem;';
      go.textContent = 'Další →';
      go.addEventListener('click', next);
      confirmBtn?.remove();
      box.after(v, go);
      go.focus({ preventScroll: true });
      go.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:5px 0;font-size:0.86rem;'
        + (q.answersAreCode ? "font-family:'SF Mono',Consolas,monospace;white-space:pre-wrap;" : '');
      b.textContent = (multi ? '☐  ' : '') + o.text;
      b.addEventListener('click', () => {
        if (answered) return;
        if (!multi) { b.dataset.sel = '1'; reveal(o.correct); return; }
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
  // Keep a running job and its finished preview when the modal is dismissed.
  // Reopening the AI tool brings the user back to the same progress/review.
  if (AI_JOB.status !== 'idle') {
    openModal('aiCardsModal');
    return;
  }
  const listEl = document.getElementById('aiNotesList');
  listEl.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:.85rem;">Načítám poznámky…</div>';
  document.getElementById('aiCardsPreview').innerHTML = '';
  document.getElementById('aiSaveBtn').style.display = 'none';
  document.getElementById('aiGenerateBtn').style.display = 'inline-flex';
  document.getElementById('aiGenerateBtn').disabled = false;
  document.getElementById('aiGenerateBtn').textContent = '✨ Vygenerovat';
  document.getElementById('aiPasteBox').value = '';
  document.getElementById('aiPromptBox').value = '';
  AI_GENERATED_CARDS = [];
  AI_SOURCE_COLOR = null;
  const examArea = document.getElementById('aiExamArea');
  if (examArea) { examArea.style.display = 'none'; examArea.innerHTML = ''; }
  document.getElementById('aiDeckName').value = 'AI karty ze zápisků';
  AI_KIND_TOUCHED = false;
  updateAiKindRecommendation();
  openModal('aiCardsModal');

  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').orderBy('createdAt', 'asc').get();
    if (snap.empty) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:6px 2px;">Místnost ještě nemá žádné poznámky.</div>';
      return;
    }
    // Notes marked on the board (Shift+drag) come pre-checked; with no
    // selection nothing is, and the user picks. The "vybrat vše" master
    // checkbox toggles the whole list at once.
    listEl.innerHTML = `<label class="ai-note-row" style="border-bottom:1px solid var(--border);margin-bottom:4px;padding-bottom:6px;">
        <input type="checkbox" id="aiNotesAll">
        <span style="font-weight:600;">Vybrat vše</span>
      </label>` +
      snap.docs.filter(d => d.data().kind !== 'heading').map(d => {
        const note = d.data();
        const preview = noteToPlainText(note).slice(0, 90) || '(prázdná poznámka)';
        const title = String(note.title || '').trim();
        return `<label class="ai-note-row">
          <input type="checkbox" class="ai-note-check" data-id="${d.id}" data-color="${note.color || '#fef9c3'}"${SELECTED.has(d.id) ? ' checked' : ''}>
          <span class="ai-note-copy">${title ? `<strong class="ai-note-title">${esc(title)}</strong>` : ''}<span class="ai-note-preview">${esc(preview)}</span></span>
        </label>`;
      }).join('');

    const allChk = document.getElementById('aiNotesAll');
    const preChecked = [...listEl.querySelectorAll('.ai-note-check:checked')];
    if (preChecked.length) {
      allChk.checked = preChecked.length === listEl.querySelectorAll('.ai-note-check').length;
      preChecked[0].closest('.ai-note-row').scrollIntoView({ block: 'nearest' });
      toast(`Předvybráno ${preChecked.length} označených poznámek.`);
    }
    allChk.addEventListener('change', () => {
      listEl.querySelectorAll('.ai-note-check').forEach(c => { c.checked = allChk.checked; });
    });
    // Un-ticking any single note un-ticks the master checkbox too.
    listEl.querySelectorAll('.ai-note-check').forEach(c => c.addEventListener('change', () => {
      const boxes = [...listEl.querySelectorAll('.ai-note-check')];
      allChk.checked = boxes.every(b => b.checked);
    }));
    updateAiKindRecommendation();
  } catch (e) {
    listEl.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;">Chyba při načítání poznámek: ${esc(e.message)}</div>`;
  }
}

// What each card must contain, per kind. Both the API path and the
// copy-paste path use it, so a chat gives the same cards as the API.
function aiKindFieldRules(kind) {
  if (kind === 'set') return `CARD TYPE: a complete study SET. For EVERY concept write THREE cards right after each other, one of each type, and give each card a "kind" field:
${AI_SET_KINDS.map((k, i) => `${i + 1}) "kind": "${k}" —\n${aiKindFieldRules(k).replace(/^/gm, '   ')}`).join('\n')}
The three cards of one concept must not be copies of each other: the info card explains, the learn card asks for recall, the quiz card tests with options.`;
  if (kind === 'info') return `CARD TYPE: explanatory "info cards" — the student READS them to learn, nothing is being tested.
- "front": the start of a statement that names the concept and ends with " …", e.g. "XAML je …", "Metoda Add() v kolekci List …", "OSI model má …". Never a question.
- "back": the full information completing it — 1 to 3 clear sentences that would make sense on their own, with the key facts, numbers and examples from the notes.
- "alsoCorrect": []
- "wrong": []`;
  if (kind === 'learn') return `CARD TYPE: classic recall flash cards — the student sees the front, recalls, flips.
- "front": a term, or a short direct question (e.g. "XAML", "Co dělá x:Name?")
- "back": the short precise answer or definition (max ~2 sentences) — exactly what the student should recall
- "alsoCorrect": 0-2 other genuinely correct short answers, usually empty
- "wrong": 3-4 plausible but clearly WRONG answers in the same format (used if the deck is later played as a quiz)`;
  return `CARD TYPE: quiz cards — multiple choice, the app shows "back" (+ "alsoCorrect") mixed with "wrong".
- "front": a short question or term
- "back": the single best correct answer or definition
- "alsoCorrect": 0-4 OTHER independently correct choices that should be selected together with "back" when they appear in the quiz (for example, members of a set when "front" asks which items belong to it). If the notes clearly support several, make "front" explicitly ask for all / which items and put one choice in "back" plus the others here. Do NOT list synonyms, paraphrases, mutually exclusive alternatives, or choices when the question asks for just one. Leave empty for a genuinely single-answer question; never pad with half-truths.
- "wrong": an array of 4-6 plausible but clearly WRONG answers, in the same format/length/language as "back", not variations of each other and not accidentally correct.`;
}

// Zadani i rozebrani odpovedi jsou zvlast, protoze je pouzivaji DVE cesty:
// primo pres API s klicem, a rezim bez klice (zkopiruj zadani -> vloz odpoved).
function buildAiCardsPrompt(text, count, automatic = false, kind = 'quiz') {
  return `You are creating study flashcards from the notes below. Keep the SAME language as the notes (they may be in Czech).${kind === 'set' ? '\nThe numbers below count CONCEPTS — every concept becomes 3 cards (info, learn, quiz).' : ''}
${automatic
    ? `Choose the suitable number of flashcards yourself (2 to ${AI_CARD_MAX}). Cover every separately defined term and important concept; do not stop at an arbitrary small number. Prefer one clear card per distinct term, and merge only genuinely inseparable concepts.\n${aiEstimateRule(text)}`
    : kind === 'set' ? `Cover exactly ${count} concepts (= ${count * 3} cards) — the key facts, terms, and concepts.`
    : `Create exactly ${count} flashcards covering the key facts, terms, and concepts.`}
Each flashcard:
${aiKindFieldRules(kind)}
Write "alsoCorrect" and "wrong" as POOLS — the app picks a random subset of each for every attempt, so more is better as long as every entry is honestly right (or honestly wrong).

SOURCE CODE: if the notes contain programming code, make proper code cards too, and mark them so they render as code:
- "frontLang": language id (java, python, c, cpp, csharp, js, php, sql, html, css, bash...) when the QUESTION itself is code — e.g. "What does this print?", "Find the bug", "What is the complexity?". Put the real, correctly indented code in "front".
- "codeLang": same idea when the ANSWER is code — e.g. "Write a for-each loop over a List". Put the code in "back", and make "wrong" plausible but genuinely broken/incorrect code in the same language.
Keep code short (max ~12 lines), keep the original line breaks and indentation (as \n inside the JSON string), and never wrap the code itself in markdown fences. Use the language actually used in the notes. Mix code cards with normal ones when the notes mix theory and code.
${AI_SELF_CONTAINED_RULE}
LONG OUTPUT — SPLIT INTO PARTS: never leave out cards or shorten them to fit one reply. If everything does not fit into one message, write as many COMPLETE cards as fit${kind === 'set' ? ' (always all three cards of a concept together)' : ''}, close the JSON array and the code block, and end the message with a line exactly: POKRAČOVÁNÍ — napiš „pokračuj“. When the user writes "pokračuj", continue with the NEXT cards in a new json code block, without repeating any card. After the very last part write: HOTOVO.
OUTPUT FORMAT: reply with ONE markdown code block tagged json (per part) (start it with \`\`\`json and end it with \`\`\`) that contains ONLY the JSON array, so the user can copy it with the code block's copy button. No text before or after the code block. Use straight ASCII double quotes for all JSON keys and strings. Inside the JSON, code goes in plain strings with escaped newlines (\\n) — never put another \`\`\` fence inside it.
The array looks like this: [{${kind === 'set' ? '"kind":"learn",' : ''}"front":"...","back":"...","alsoCorrect":["..."],"wrong":["...","...","...","..."],"codeLang":"java"}, ...]

NOTES:
"""
${text}
"""`;
}

// Kolik témat poznámky zhruba mají — bez toho AI (hlavně v chatu, kde je
// odpověď omezená délkou) ráda skončí u 20–30 i u dlouhých zápisků.
function aiConceptEstimate(text) {
  const words = (text.match(/\S+/g) || []).length;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const defs = lines.filter(l => /^[-•*\d.)\s]*[^\s].{0,48}?\s[–—:=-]\s+\S/.test(l)).length;
  const target = Math.max(5, Math.min(AI_CARD_MAX, Math.max(defs, Math.round(words / 70))));
  return { words, defs, target };
}
function aiEstimateRule(text) {
  const e = aiConceptEstimate(text);
  return `For scale: the notes have about ${e.words} words${e.defs ? ` and roughly ${e.defs} lines that define a term` : ''}. A thorough result for notes this long usually needs about ${e.target} or more concepts — do not stop at 20–30 just to keep the reply short.`;
}

function buildAiCardPlanPrompt(text, automatic, count) {
  const countRule = automatic
    ? `Choose a suitable number of distinct study targets (2 to ${AI_CARD_MAX}). If the notes contain a glossary or a list of terminology with definitions, include EVERY separately defined term. Usually use one target per term; combine only concepts that cannot be tested separately.`
    : `Choose exactly ${count} distinct study targets, distributed across the important terms and concepts. Do not omit a clearly defined term when the requested count allows it.`;
  return `You are planning a comprehensive set of study flashcards from the notes below. Keep the same language as the notes.
${countRule}${automatic ? '\n' + aiEstimateRule(text) : ''}
First identify the concepts that deserve their own card. Do not write the cards yet. For each target, include a short topic and a concise evidence excerpt or faithful summary from the notes, so a second step can write a grounded card for it. Avoid duplicate targets and do not invent topics absent from the notes.
The second step will NOT see the notes — only your topic and evidence — and the finished card must make sense to a student who never saw the notes either. So when a target is about specific code (a class, method, example program), copy the relevant code VERBATIM into "evidence", with real newlines and indentation, not just a description of it. If a target only makes sense with code the notes do not contain, phrase the topic as the general concept instead.
Return ONLY valid JSON in this shape:
{"targets":[{"topic":"term or concept","evidence":"supporting definition or facts from the notes"}]}

NOTES:
<<<
${text}
>>>`;
}

function parseAiCardPlan(raw) {
  const match = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) throw new Error('no-json');
  const parsed = JSON.parse(repairAiJson(match[0]));
  const source = Array.isArray(parsed) ? parsed : (parsed.targets || parsed.items || []);
  if (!Array.isArray(source)) throw new Error('empty');
  const seen = new Set();
  const targets = source.map(item => ({
    topic: String(item?.topic || item?.term || item?.front || '').trim(),
    evidence: String(item?.evidence || item?.context || item?.definition || '').trim(),
  })).filter(item => {
    if (!item.topic) return false;
    const key = item.topic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, AI_CARD_MAX);
  if (!targets.length) throw new Error('empty');
  return targets;
}

function buildAiCardBatchPrompt(targets, kind = 'quiz') {
  return `Create exactly one study flashcard for EACH target below, in the same order. Keep the same language as the notes. Cover the named target directly, use its evidence, and do not add facts that the evidence does not support. Do not repeat a card for another target.
For each card return:
${aiKindFieldRules(kind)}
- "frontLang" when the front itself contains code; "codeLang" when the back contains code
For code, keep real indentation and do not use markdown fences.
${AI_SELF_CONTAINED_RULE}
The code you may show is the code given in the evidence; if a target's evidence has none, do not ask about the exact behaviour of a specific named method or class.
Return ONLY a JSON array, nothing else:
[{"front":"...","back":"...","alsoCorrect":[],"wrong":[]}]

TARGETS:
${JSON.stringify(targets.map(t => ({ topic: t.topic, evidence: t.evidence })))} `;
}

function setAiCardsStatus(message) {
  AI_JOB.message = message;
  const status = document.getElementById('aiStatusMsg');
  if (status) status.textContent = message;
  updateAiJobNotice();
}

function updateAiJobNotice() {
  const notice = document.getElementById('aiJobNotice');
  if (!notice) return;
  if (AI_JOB.status === 'idle') { notice.style.display = 'none'; return; }
  notice.style.display = 'block';
  if (AI_JOB.status === 'running') {
    const progress = AI_JOB.total ? ` · ${AI_JOB.done}/${AI_JOB.total} dávek` : '';
    notice.textContent = `⏳ AI připravuje kartičky${progress} · otevřít`;
  } else if (AI_JOB.status === 'ready') {
    notice.textContent = `✅ ${AI_JOB.cards.length} kartiček je hotových · zkontrolovat`;
  } else {
    notice.textContent = '⚠️ Generování se nepodařilo · zobrazit';
  }
}

function parseAiCardBatch(raw, expectedCount) {
  const cards = parseAiCards(raw);
  if (cards.length !== expectedCount) throw new Error('batch-count');
  return cards;
}

async function generateAiCardBatches(targets) {
  const chunks = [];
  for (let i = 0; i < targets.length; i += AI_CARD_BATCH_SIZE) {
    chunks.push(targets.slice(i, i + AI_CARD_BATCH_SIZE));
  }
  // Celý set: každá dávka témat třikrát (výklad, kartičky, kvíz). Pořadí
  // výsledků = všechen výklad, pak kartičky, pak kvíz.
  const kinds = AI_JOB.kind === 'set' ? AI_SET_KINDS : [AI_JOB.kind || 'quiz'];
  const batches = kinds.flatMap(kind => chunks.map(targets => ({ kind, targets })));
  AI_JOB.done = 0;
  AI_JOB.total = batches.length;
  setAiCardsStatus(`Připraven plán ${targets.length} kartiček. Generuji ${batches.length} dávek souběžně…`);

  const results = new Array(batches.length);
  let nextBatch = 0;
  let failure = null;
  async function worker() {
    while (!failure) {
      const index = nextBatch++;
      if (index >= batches.length) return;
      const { kind, targets: batch } = batches[index];
      try {
        results[index] = (await aiGenerate(buildAiCardBatchPrompt(batch, kind), {
          temperature: 0.45,
          maxOutputTokens: 5000,
          statusElementId: null,
          parse: raw => parseAiCardBatch(raw, batch.length),
        })).map(c => ({ ...c, kind }));
        AI_JOB.done++;
        setAiCardsStatus(`Generuji kartičky… hotovo ${AI_JOB.done} z ${AI_JOB.total} dávek.`);
      } catch (e) {
        failure = e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AI_CARD_PARALLELISM, batches.length) }, worker));
  if (failure) throw failure;
  return results.flat();
}

function parseAiCards(text) {
      let arr = null;
      try {
        const m = text.match(/\[[\s\S]*\]/);
        if (m) arr = JSON.parse(repairAiJson(m[0]));
      } catch (_) { /* zkusíme volnější čtení níž */ }
      if (!Array.isArray(arr) || !arr.some(c => c && c.front && c.back)) {
        arr = looseChatJsonArray(text) || arr;
      }
      if (!Array.isArray(arr)) throw new Error(/[[{]/.test(text) ? 'bad-json' : 'no-json');
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
          // Code copied through a chat app comes back with “typographic”
          // quotes, which no compiler accepts — straighten them in code parts.
          const frontLang = lang(c.frontLang), codeLang = lang(c.codeLang);
          const code = (on, s) => on ? s.replace(/[“”„‟″]/g, '"').replace(/[‘’‚]/g, "'") : s;
          return {
            kind: AI_SET_KINDS.includes(c.kind) ? c.kind : null,   // jen u celého setu
            front: code(frontLang, String(c.front).trim()),
            back: code(codeLang, back),
            corrects: corrects.map(s => code(codeLang, s)),
            frontLang,
            codeLang,
            distractors: distractors.map(s => code(codeLang, s)),
            // The AI's chosen option count = its distractors + the answer.
            // No distractors sent → classic 4 options (the quiz pads with
            // other cards' backs).
            answerCount: distractors.length ? Math.min(5, distractors.length + 1) : 4,
          };
        });
      if (!clean.length) throw new Error('empty');
      return clean;
    
}

async function generateAiCards() {
  const checkedIds = [...document.querySelectorAll('.ai-note-check:checked')].map(c => c.dataset.id);
  if (!checkedIds.length) { toast('Vyber alespoň jednu poznámku.'); return; }
  const automatic = document.getElementById('aiAutoCount').checked;
  const count = automatic ? null : Math.max(2, Math.min(AI_CARD_MAX, parseInt(document.getElementById('aiCardCount').value) || 8));

  const btn = document.getElementById('aiGenerateBtn');
  btn.disabled = true; btn.textContent = '⏳ Připravuji…';
  const previewEl = document.getElementById('aiCardsPreview');
  AI_SOURCE_COLOR = document.querySelector('.ai-note-check:checked')?.dataset.color || '#6366f1';
  AI_JOB = { status: 'running', done: 0, total: 0, cards: [], message: 'Načítám vybrané poznámky…', noteIds: checkedIds, kind: aiCardKind() };
  previewEl.innerHTML = '<div id="aiStatusMsg" style="font-size:.82rem;color:var(--text-muted);margin-top:10px;"></div>';
  setAiCardsStatus('Načítám vybrané poznámky…');

  try {
    const combinedText = await selectedNotesText(checkedIds);
    if (!combinedText.trim()) throw new Error('Vybrané poznámky jsou prázdné.');

    setAiCardsStatus('AI vybírá vhodný počet a sestavuje seznam témat…');
    const targets = await aiGenerate(buildAiCardPlanPrompt(combinedText, automatic, count), {
      temperature: 0.2,
      maxOutputTokens: 12000,
      statusElementId: null,
      parse: raw => {
        const plan = parseAiCardPlan(raw);
        if (!automatic && plan.length !== count) throw new Error('plan-count');
        return plan;
      },
    });
    const cards = await generateAiCardBatches(targets);

    AI_GENERATED_CARDS = cards;
    AI_JOB.status = 'ready';
    AI_JOB.cards = cards;
    renderAiCardsPreview(cards);
    document.getElementById('aiSaveBtn').style.display = 'inline-flex';
    btn.style.display = 'none';
    updateAiJobNotice();
    toastAction(`AI připravila ${cards.length} kartiček.`, 'Zkontrolovat', () => openModal('aiCardsModal'));
  } catch (e) {
    AI_JOB.status = 'error';
    AI_JOB.error = e;
    const message = e.message === 'Vybrané poznámky jsou prázdné.' ? e.message : aiErrorMessage(e);
    previewEl.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;margin-top:10px;">${message}</div>`;
    btn.disabled = false; btn.textContent = '✨ Vygenerovat';
    updateAiJobNotice();
    toast('Generování AI kartiček se nepodařilo. Stav a možnost opakování najdeš v AI kartách.');
  }
}

// Text vybranych poznamek slozeny dohromady (sdili generovani i rezim bez klice).
async function selectedNotesText(ids) {
  const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').get();
  const byId = new Map(snap.docs.map(d => [d.id, d.data()]));
  return ids.map(id => (byId.has(id) ? noteToPlainText(byId.get(id)) : ''))
    .filter(Boolean).join('\n\n---\n\n');
}

const AI_KIND_LABEL = { info: '📘 Výkladové', learn: '🧠 Kartičky', quiz: '🎯 Kvíz' };
function renderAiCardsPreview(cards) {
  // U celého setu po skupinách: výklad, kartičky, kvíz.
  if (cards.some(c => c.kind)) {
    const ord = k => AI_SET_KINDS.indexOf(k || 'quiz');
    const sorted = cards.map((c, i) => [c, i]).sort((a, b) => ord(a[0].kind) - ord(b[0].kind) || a[1] - b[1]).map(x => x[0]);
    if (sorted.some((c, i) => c !== cards[i])) { cards.splice(0, cards.length, ...sorted); }
  }
  const el = document.getElementById('aiCardsPreview');
  el.innerHTML = `<label class="label" style="margin-top:12px;display:block;">Náhled (${cards.length}) — odškrtni, co nechceš uložit:</label>
    <div class="ai-cards-preview-list">` +
    cards.map((c, i) => (c.kind && c.kind !== cards[i - 1]?.kind ? `<div class="ai-kind-group">${AI_KIND_LABEL[c.kind]} (${cards.filter(x => x.kind === c.kind).length})</div>` : '') + `
      <label class="ai-card-row">
        <input type="checkbox" class="ai-card-check" data-i="${i}" checked>
        <span>${c.frontLang ? `<b>Kód (${esc(c.frontLang)}):</b>${codeQuestionHtml(c.front, c.frontLang)}` : `<b>${esc(c.front)}</b>`}<br><span style="color:var(--text-muted);">${c.codeLang ? codeBlockHtml(c.back, c.codeLang) : esc(c.back)}</span>
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
    const sourceColor = AI_SOURCE_COLOR || document.querySelector('.ai-note-check:checked')?.dataset.color || '#6366f1';
    const kindOf = c => c.kind || (AI_JOB.kind === 'set' ? 'quiz' : AI_JOB.kind) || aiCardKind();
    const kinds = { info: 0, learn: 0, quiz: 0 };
    toSave.forEach(c => { kinds[kindOf(c)] = (kinds[kindOf(c)] || 0) + 1; });
    const used = Object.keys(kinds).filter(k => kinds[k]);
    const deckRef = await db.collection('decks').add({
      name, color: sourceColor, description: null,
      ownerUid: ME.uid, roomId: ROOM_ID, cardCount: 0,
      kind: used.length > 1 ? 'set' : used[0], kinds,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const batch = db.batch();
    const cardsCol = deckRef.collection('cards');
    toSave.forEach((c, i) => {
      batch.set(cardsCol.doc(), {
        order: i,                         // stejný createdAt pro celou dávku
        front: c.front,
        back: c.back,
        corrects: c.corrects || [],       // further answers that are also right
        frontLang: c.frontLang || null,   // question is code, in this language
        codeLang: c.codeLang || null,     // answer is code, in this language
        distractors: c.distractors || [],
        answerCount: c.answerCount || 4,
        kind: kindOf(c),                  // quiz / learn / info
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    batch.update(deckRef, { cardCount: toSave.length });
    await batch.commit();
    toast(`Uloženo ${toSave.length} karet do balíčku „${name}" ✓`);
    closeModal('aiCardsModal');
    AI_GENERATED_CARDS = [];
    AI_SOURCE_COLOR = null;
    AI_JOB = { status: 'idle', done: 0, total: 0, cards: [], message: '' };
    updateAiJobNotice();
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
      ? 'Kontrola faktů potřebuje klíč Gemini — vyber ho v Nastavení.'
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

// ═══ room-export.js — „Ultimátní" offline studijní stránka
// Jeden soubor, který funguje bez internetu: poznámky ve stromu složek,
// vykreslené tabule, kartičky se čtyřmi režimy učení, zkouškový režim
// a statistiky s opakováním (Leitner) uloženými v prohlížeči.
//
// POZOR: vložený <script> v buildExportHtml nesmí obsahovat zpětný apostrof
// ani ${} — žije uvnitř vnějšího template literálu.

function exportNoteTitle(n) { return n.title || noteToPlainText(n).slice(0, 60) || '(bez názvu)'; }
function exportNoteConns(noteId) {
  const names = [];
  CONNS_MAP.forEach(c => {
    let other = null;
    if (c.fromId === noteId) other = NOTES_MAP.get(c.toId);
    else if (c.toId === noteId) other = NOTES_MAP.get(c.fromId);
    if (other) names.push(exportNoteTitle(other));
  });
  return names;
}

function setupExport() {
  document.getElementById('exportBtn').addEventListener('click', () => {
    document.getElementById('exportHint').textContent = '';
    openModal('exportModal');
  });
  document.getElementById('exportRunBtn').addEventListener('click', runExport);
}

// ── Embedding images ──────────────────────────────────────────
// A page is only really offline once its pictures travel with it. imgBB
// serves without CORS headers, so a direct fetch fails; images.weserv.nl is
// a public image proxy that does send them, and is used as the fallback.
// If both fail the original URL stays, so the export never breaks — it just
// needs a connection for that one picture.
const IMG_CACHE = new Map();

async function toDataUri(url) {
  if (!url || url.startsWith('data:')) return url;
  if (IMG_CACHE.has(url)) return IMG_CACHE.get(url);
  const proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, ''));
  for (const candidate of [url, proxied]) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) continue;
      const data = await new Promise((ok, no) => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result);
        fr.onerror = no;
        fr.readAsDataURL(blob);
      });
      IMG_CACHE.set(url, data);
      return data;
    } catch (_) { /* try the next candidate */ }
  }
  IMG_CACHE.set(url, url);
  return url;
}

// Rewrite every <img src> in a note's HTML to an embedded copy.
async function inlineNoteImages(html, onProgress) {
  if (!html || !html.includes('<img')) return html;
  const box = document.createElement('div');
  box.innerHTML = html;
  const imgs = [...box.querySelectorAll('img')];
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', await toDataUri(src));
    if (onProgress) onProgress();
  }
  return box.innerHTML;
}

// ── Whiteboards ───────────────────────────────────────────────
// Strokes are replayed onto an offscreen canvas with the SAME drawing code
// the board uses, then flattened to a PNG. Text boxes stay real HTML in the
// export, so they remain selectable and searchable.
async function renderWhiteboardExport(wb, onProgress) {
  const w = Math.max(1, Math.round(wb.w || 460));
  const h = Math.max(1, Math.round(wb.h || 320));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Pictures sit behind the strokes on the board — same order here.
  const images = [];
  for (const im of (wb.images || [])) {
    const data = await toDataUri(im.url);
    images.push({ ...im, url: data });
    if (onProgress) onProgress();
  }
  for (const im of images) {
    try {
      const el = await new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i); i.onerror = no;
        i.src = im.url;
      });
      ctx.drawImage(el, im.x, im.y, im.w, im.h);
    } catch (_) { /* unreachable picture — skip it */ }
  }
  (wb.strokes || []).forEach(s => { try { drawOneStroke(ctx, s); } catch (_) {} });

  let png = '';
  try { png = canvas.toDataURL('image/png'); } catch (_) { png = ''; }
  return {
    id: wb.id, x: wb.x || 0, y: wb.y || 0, w, h,
    png,
    texts: (wb.texts || []).map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, txt: t.txt || '', fs: t.fs || 18, c: t.c || '#111827' })),
    author: wb.authorName || '',
  };
}

// ── Gather everything ─────────────────────────────────────────
// Flatten the folder TREE into an ordered list of sections carrying their
// depth, so the export can render real nesting. Depth-first, siblings sorted
// by name, so a parent always precedes its children.
function buildFolderSections() {
  const byParent = new Map();
  FOLDERS_MAP.forEach(f => {
    const p = (f.parentId && FOLDERS_MAP.has(f.parentId)) ? f.parentId : null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(f);
  });
  byParent.forEach(arr => arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'cs')));

  const sections = [];
  const seen = new Set();               // guards a malformed parent cycle
  const walk = (parentId, depth) => {
    (byParent.get(parentId) || []).forEach(f => {
      if (seen.has(f.id)) return;
      seen.add(f.id);
      const notes = (f.noteIds || []).map(id => NOTES_MAP.get(id)).filter(Boolean);
      const before = sections.length;
      sections.push({ id: f.id, title: f.name || 'Složka', color: f.color || '#6366f1', depth, notes });
      walk(f.id, depth + 1);
      // A branch with no notes anywhere beneath it isn't worth a heading.
      if (!notes.length && sections.length === before + 1) sections.pop();
    });
  };
  walk(null, 0);
  return sections;
}

async function gatherExportData(opts, onStep) {
  const step = onStep || (() => {});
  const filedIds = new Set();
  FOLDERS_MAP.forEach(f => (f.noteIds || []).forEach(id => filedIds.add(id)));
  const sections = buildFolderSections();
  const unfiled = [...NOTES_MAP.values()].filter(n => !filedIds.has(n.id)).sort((a, b) => noteRecency(b) - noteRecency(a));
  if (unfiled.length) sections.push({ id: '_unfiled', title: 'Nezařazené poznámky', color: '#94a3b8', depth: 0, notes: unfiled });

  // Bake every picture into the file (notes first, whiteboards below).
  if (opts.embed) {
    for (const sec of sections) {
      sec.notes = await Promise.all(sec.notes.map(async n => (
        n.contentType === 'html' ? { ...n, content: await inlineNoteImages(n.content, step) } : n
      )));
      step();
    }
  }

  // Whiteboards — flattened to a picture plus their (still searchable) text.
  let whiteboards = [];
  if (opts.boards) {
    for (const wb of WHITEBOARDS_MAP.values()) {
      try { whiteboards.push(await renderWhiteboardExport(wb, step)); } catch (_) {}
      step();
    }
    whiteboards.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  // Comments (optional; one read per note in parallel).
  const commentsByNote = {};
  if (opts.comments) {
    await Promise.all([...NOTES_MAP.values()].map(async n => {
      try {
        const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(n.id).collection('comments').orderBy('at', 'asc').get();
        if (!snap.empty) commentsByNote[n.id] = snap.docs.map(d => d.data());
      } catch (_) {}
    }));
    step();
  }

  // Room flash-card decks + their cards.
  let decks = [];
  if (opts.cards) {
    try {
      const deckSnap = await db.collection('decks').where('roomId', '==', ROOM_ID).get();
      decks = (await Promise.all(deckSnap.docs.map(async d => {
        const cardsSnap = await db.collection('decks').doc(d.id).collection('cards').get();
        return {
          id: d.id,
          name: d.data().name || 'Balíček',
          color: d.data().color || '#6366f1',
          cards: cardsSnap.docs.map(c => ({ id: c.id, ...c.data() })).filter(c => c.front || c.back)
            .map(c => ({
              id: c.id,
              front: c.front || '', back: c.back || '',
              corrects: c.corrects || [],
              distractors: c.distractors || [],
              frontLang: c.frontLang || null, codeLang: c.codeLang || null,
            })),
        };
      }))).filter(dk => dk.cards.length);
      step();
    } catch (_) {}
  }
  return { sections, commentsByNote, decks, whiteboards };
}

async function runExport() {
  const btn  = document.getElementById('exportRunBtn');
  const hint = document.getElementById('exportHint');
  const opts = {
    conns:    document.getElementById('exportConns').checked,
    comments: document.getElementById('exportComments').checked,
    cards:    document.getElementById('exportCards').checked,
    boards:   (document.getElementById('exportBoards') || {}).checked !== false,
    embed:    (document.getElementById('exportEmbed')  || {}).checked !== false,
  };
  btn.disabled = true;
  let done = 0;
  const step = () => { done++; hint.textContent = 'Připravuji… (' + done + ' hotovo)'; };
  hint.textContent = 'Připravuji…';
  try {
    const data = await gatherExportData(opts, step);
    hint.textContent = 'Sestavuji stránku…';
    const html = buildExportHtml(data, opts);
    const safe = (ROOM.name || 'mistnost').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'export';
    downloadFile(safe + '.html', html, 'text/html;charset=utf-8');
    hint.textContent = 'Hotovo ✓ (' + Math.round(html.length / 1024) + ' kB)';
    setTimeout(() => closeModal('exportModal'), 1400);
  } catch (e) { hint.textContent = 'Chyba: ' + e.message; }
  btn.disabled = false;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── The page itself ───────────────────────────────────────────
// Self-contained study tool: notes in a folder tree, whiteboards, four study
// modes over the flash cards, an exam that mixes every deck, and progress
// (Leitner boxes + accuracy + streak) kept in the browser's localStorage.
function buildExportHtml(data, opts) {
  const noteCount  = data.sections.reduce((s, sec) => s + sec.notes.length, 0);
  const cardCount  = data.decks.reduce((s, dk) => s + dk.cards.length, 0);
  const boardCount = data.whiteboards.length;
  const when = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const roomName = ROOM.name || 'Místnost';

  const tocHtml =
    data.sections.map((sec, si) =>
      `<a href="#sec-${si}" class="toc-d${Math.min(sec.depth, 4)}" style="--fc:${esc(sec.color || '#6366f1')}">📁 ${esc(sec.title)} <span>${sec.notes.length || ''}</span></a>`).join('') +
    (boardCount ? `<div class="toc-sep"></div><a href="#boards">🎨 Tabule <span>${boardCount}</span></a>` : '') +
    (data.decks.length ? `<div class="toc-sep"></div>` + data.decks.map((dk, di) => `<a href="#deck-${di}">🃏 ${esc(dk.name)} <span>${dk.cards.length}</span></a>`).join('') : '');

  const notesHtml = data.sections.map((sec, si) => `
    <section class="folder" id="sec-${si}" data-depth="${sec.depth}" style="--d:${sec.depth};--fc:${esc(sec.color || '#6366f1')}">
      <h2 class="fh" onclick="toggleFolder(this)"><span class="tw">▾</span> 📁 ${esc(sec.title)}<span class="fcount">${sec.notes.length || ''}</span></h2>
      <div class="fbody">
      ${sec.notes.map(n => {
        const title = esc(n.title || exportNoteTitle(n));
        const content = n.contentType === 'html' ? (n.content || '') : `<p>${esc(n.content || '')}</p>`;
        const conns = opts.conns ? exportNoteConns(n.id) : [];
        const connsHtml = conns.length ? `<div class="meta">🔗 ${conns.map(esc).join(' · ')}</div>` : '';
        const cmts = data.commentsByNote[n.id] || [];
        const cmtsHtml = (opts.comments && cmts.length)
          ? `<div class="cmts"><div class="cmts-h">💬 Komentáře (${cmts.length})</div>${cmts.map(c => `<div class="cmt"><b>${esc(c.authorName || 'Anon')}</b> ${esc(c.text || '')}</div>`).join('')}</div>` : '';
        return `<article class="note" id="note-${esc(n.id)}" data-nid="${esc(n.id)}" style="--nc:${esc(n.color || '#94a3b8')}">
            <div class="nhead">
              <h3>${title}</h3>
              <div class="ntools">
                <button class="ntool star" data-star="${esc(n.id)}" title="Označit hvězdičkou (opakovat)">☆</button>
                <button class="ntool done" data-done="${esc(n.id)}" title="Označit jako naučené">✓</button>
              </div>
            </div>
            <div class="nmeta">${esc(n.authorName || '')}</div>
            <div class="ncontent">${content}</div>${connsHtml}${cmtsHtml}
          </article>`;
      }).join('') || '<p class="hint sub-only">Poznámky jsou v podsložkách ↓</p>'}
      </div>
    </section>`).join('');

  const boardsHtml = boardCount ? `
    <section class="folder" id="boards" data-depth="0" style="--d:0;--fc:#f59e0b">
      <h2 class="fh" onclick="toggleFolder(this)"><span class="tw">▾</span> 🎨 Tabule<span class="fcount">${boardCount}</span></h2>
      <div class="fbody">
        ${data.whiteboards.map(wb => `
          <article class="note board-note" style="--nc:#f59e0b">
            <div class="wbwrap" style="width:${wb.w}px;height:${wb.h}px;">
              ${wb.png ? `<img class="wbimg" src="${wb.png}" alt="Tabule" width="${wb.w}" height="${wb.h}">` : ''}
              ${wb.texts.map(t => `<div class="wbtext" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;font-size:${t.fs}px;color:${esc(t.c)}">${esc(t.txt)}</div>`).join('')}
            </div>
            ${wb.author ? `<div class="nmeta">${esc(wb.author)}</div>` : ''}
          </article>`).join('')}
      </div>
    </section>` : '';

  const decksHtml = data.decks.length ? `
    <section class="decks" id="decks">
      <h2>🃏 Kartičky</h2>
      <p class="hint">Klikni na kartičku pro otočení, nebo si vyber režim učení.</p>
      ${data.decks.map((dk, di) => `
        <div class="deck" id="deck-${di}">
          <div class="deck-hd">
            <h3 style="--dk:${esc(dk.color)}">${esc(dk.name)} <span class="dc">${dk.cards.length} kartiček</span></h3>
            <div class="deck-btns">
              <button class="ghostbtn" onclick="flipAll(this)">↻ Otočit vše</button>
              <button class="quizbtn" onclick="startMode('learn',${di})">🧠 Učit se</button>
              <button class="quizbtn" onclick="startMode('quiz',${di})">▶ Kvíz</button>
              <button class="quizbtn" onclick="startMode('write',${di})">⌨️ Psaní</button>
              <button class="quizbtn" onclick="startMode('match',${di})">🔗 Párování</button>
            </div>
          </div>
          <div class="deck-bar"><div class="deck-bar-fill" id="dbar-${di}"></div><span class="deck-bar-txt" id="dtxt-${di}"></span></div>
          <div class="cards">
            ${dk.cards.map(c => {
              const face = (t, l) => l ? `<pre class="code-block"><code>${esc(t)}</code></pre>` : esc(t);
              return `<div class="fc${c.frontLang || c.codeLang ? ' fc-code' : ''}" onclick="this.classList.toggle('flip')"><div class="fc-in"><div class="fc-face fc-front">${face(c.front, c.frontLang)}</div><div class="fc-face fc-back">${face(c.back, c.codeLang)}</div></div></div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </section>` : '';

  const decksJson = JSON.stringify(data.decks).replace(/</g, '\u003c');
  const roomKey = 'sbx_' + (ROOM_ID || 'x');

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(roomName)}</title>
<style>
  :root {
    --bg:#f4f6fb; --panel:#ffffff; --card:#ffffff; --text:#1e293b; --muted:#64748b;
    --bd:#dbe2ee; --ac:#6366f1; --ok:#16a34a; --okbg:#dcfce7; --bad:#dc2626; --badbg:#fee2e2;
    --warn:#f59e0b;
    --shadow:0 1px 3px rgba(15,23,42,.07), 0 6px 20px rgba(15,23,42,.05);
  }
  [data-theme="dark"] {
    --bg:#0f1420; --panel:#171e2e; --card:#1c2437; --text:#e2e8f0; --muted:#8b98ad;
    --bd:#2b3650; --ac:#818cf8; --ok:#4ade80; --okbg:#14351f; --bad:#f87171; --badbg:#3b1515;
    --shadow:0 1px 3px rgba(0,0,0,.4);
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; scroll-padding-top:76px; }
  body { margin:0; font-family:-apple-system,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); line-height:1.55; }
  button { font-family:inherit; }
  /* ── Top bar ── */
  .topbar { position:sticky; top:0; z-index:50; background:var(--panel); border-bottom:1px solid var(--bd); box-shadow:var(--shadow); }
  .tb-in { max-width:1180px; margin:0 auto; padding:10px 18px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .tb-title { font-weight:700; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #q { flex:1; min-width:120px; padding:8px 13px; border:1px solid var(--bd); border-radius:10px; background:var(--bg); color:var(--text); font-size:.9rem; }
  #q:focus { outline:none; border-color:var(--ac); }
  .tb-btn { background:none; border:1px solid var(--bd); border-radius:10px; padding:7px 11px; cursor:pointer; font-size:.82rem; color:var(--text); }
  .tb-btn:hover { border-color:var(--ac); }
  .ring { --p:0; width:34px; height:34px; border-radius:50%; flex-shrink:0;
          background:conic-gradient(var(--ok) calc(var(--p)*1%), var(--bd) 0);
          display:flex; align-items:center; justify-content:center; }
  .ring i { width:26px; height:26px; border-radius:50%; background:var(--panel);
            display:flex; align-items:center; justify-content:center; font-style:normal; font-size:.6rem; font-weight:700; }
  /* ── Layout ── */
  .wrap { max-width:1180px; margin:0 auto; padding:26px 18px 90px; display:grid; grid-template-columns:240px 1fr; gap:28px; align-items:start; }
  .toc { position:sticky; top:76px; background:var(--panel); border:1px solid var(--bd); border-radius:14px; padding:12px; max-height:calc(100vh - 100px); overflow-y:auto; }
  .toc-h { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin:2px 6px 8px; }
  .toc a { display:flex; justify-content:space-between; gap:8px; padding:6px 9px; border-radius:8px; color:var(--text); text-decoration:none; font-size:.84rem; }
  .toc a span { color:var(--muted); font-size:.74rem; }
  .toc a:hover { background:var(--bg); }
  .toc-sep { height:1px; background:var(--bd); margin:8px 4px; }
  .toc a.toc-d1 { padding-left:18px; } .toc a.toc-d2 { padding-left:30px; }
  .toc a.toc-d3 { padding-left:42px; } .toc a.toc-d4 { padding-left:54px; }
  .toc-tools { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
  .toc-tools button { width:100%; text-align:left; background:var(--bg); border:1px solid var(--bd); border-radius:9px;
                      padding:8px 10px; cursor:pointer; font-size:.83rem; color:var(--text); }
  .toc-tools button:hover { border-color:var(--ac); }
  @media (max-width:860px){ .wrap { grid-template-columns:1fr; } .toc { position:static; max-height:none; } }
  /* ── Content ── */
  h1 { font-size:1.85rem; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:.86rem; margin-bottom:22px; }
  h2 { font-size:1.25rem; margin:36px 0 6px; padding-bottom:8px; border-bottom:2px solid var(--bd); }
  .hint { color:var(--muted); font-size:.83rem; }
  /* Folder tree: depth drives indent, size and the guide line */
  section.folder { margin-left:calc(var(--d,0) * 22px); position:relative; }
  section.folder[data-depth="0"] { margin-top:30px; }
  section.folder:not([data-depth="0"]) { border-left:2px solid var(--bd); padding-left:14px; margin-top:14px; }
  .fh { cursor:pointer; user-select:none; display:flex; align-items:center; gap:7px;
        font-size:calc(1.25rem - var(--d,0) * 0.11rem); margin:0 0 6px; padding-bottom:7px;
        border-bottom:2px solid var(--bd); }
  section.folder:not([data-depth="0"]) .fh { border-bottom:1px solid var(--bd); font-weight:600; }
  .fh::before { content:''; width:4px; align-self:stretch; border-radius:2px; background:var(--fc,#6366f1); }
  .tw { color:var(--muted); font-size:.75rem; transition:transform .18s; }
  .folder.collapsed .tw { transform:rotate(-90deg); }
  .folder.collapsed .fbody { display:none; }
  .fcount { margin-left:auto; font-size:.72rem; font-weight:400; color:var(--muted);
            background:var(--bg); border:1px solid var(--bd); border-radius:9px; padding:1px 8px; }
  .fcount:empty { display:none; }
  .sub-only { font-size:.8rem; margin:6px 0 0; opacity:.75; }
  .note { background:var(--card); border:1px solid var(--bd); border-left:4px solid var(--nc,#94a3b8); border-radius:12px; padding:14px 18px; margin:14px 0; box-shadow:var(--shadow); page-break-inside:avoid; }
  .note.is-done { opacity:.55; }
  .note.is-done .ntool.done { background:var(--ok); border-color:var(--ok); color:#fff; }
  .note.is-star { border-left-color:var(--warn); }
  .note.is-star .ntool.star { background:var(--warn); border-color:var(--warn); color:#fff; }
  .nhead { display:flex; align-items:flex-start; gap:10px; }
  .nhead h3 { margin:0 0 2px; font-size:1.06rem; flex:1; }
  .ntools { display:flex; gap:5px; flex-shrink:0; }
  .ntool { width:26px; height:26px; border-radius:7px; border:1px solid var(--bd); background:var(--bg);
           color:var(--muted); cursor:pointer; font-size:.8rem; line-height:1; }
  .ntool:hover { border-color:var(--ac); }
  .nmeta { font-size:.74rem; color:var(--muted); margin-bottom:8px; }
  .ncontent { font-size:.94rem; overflow-wrap:break-word; }
  .ncontent::after { content:''; display:table; clear:both; }
  .ncontent img { max-width:100%; height:auto; border-radius:8px; }
  .ncontent table { border-collapse:collapse; max-width:100%; }
  .ncontent td, .ncontent th { border:1px solid var(--bd); padding:4px 8px; }
  .meta { font-size:.8rem; color:var(--muted); margin-top:10px; }
  .cmts { margin-top:10px; padding-top:9px; border-top:1px dashed var(--bd); }
  .cmts-h { font-size:.76rem; font-weight:600; color:var(--muted); margin-bottom:5px; }
  .cmt { font-size:.85rem; margin:3px 0; } .cmt b { margin-right:5px; }
  .nosearch { text-align:center; color:var(--muted); padding:30px 0; display:none; }
  /* Whiteboards */
  .board-note { overflow-x:auto; }
  .wbwrap { position:relative; background:#fff; border:1px solid var(--bd); border-radius:8px; overflow:hidden; }
  .wbimg { display:block; }
  .wbtext { position:absolute; white-space:pre-wrap; overflow:hidden; line-height:1.3; }
  /* Code blocks */
  .code-block { margin:0; width:100%; overflow-x:auto; background:var(--bg); border:1px solid var(--bd);
                border-radius:8px; padding:9px 11px; text-align:left; }
  .code-block code { font-family:'SF Mono',Consolas,'Courier New',monospace; font-size:.8rem;
                     line-height:1.45; white-space:pre; color:var(--text); }
  .fc-back .code-block code { color:var(--ok); font-weight:500; }
  /* ── Decks / flip cards ── */
  .deck { margin:20px 0 30px; }
  .deck-hd { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .deck-hd h3 { margin:0; font-size:1.05rem; border-left:4px solid var(--dk,#6366f1); padding-left:10px; }
  .dc { font-size:.8rem; color:var(--muted); font-weight:400; margin-left:6px; }
  .deck-btns { display:flex; gap:8px; flex-wrap:wrap; }
  .quizbtn { background:var(--ac); color:#fff; border:none; padding:8px 14px; border-radius:9px; cursor:pointer; font-size:.84rem; font-weight:600; }
  .quizbtn:hover { filter:brightness(1.08); }
  .ghostbtn { background:none; color:var(--muted); border:1px solid var(--bd); padding:8px 12px; border-radius:9px; cursor:pointer; font-size:.82rem; }
  .deck-bar { position:relative; height:8px; background:var(--bd); border-radius:4px; margin-bottom:12px; }
  .deck-bar-fill { height:100%; width:0%; background:linear-gradient(90deg,var(--ac),var(--ok)); border-radius:4px; transition:width .4s; }
  .deck-bar-txt { position:absolute; right:0; top:10px; font-size:.7rem; color:var(--muted); }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }
  .fc { height:130px; perspective:900px; cursor:pointer; }
  .fc-code { height:190px; }
  .fc-in { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .45s cubic-bezier(.2,.7,.3,1.1); }
  .fc.flip .fc-in { transform:rotateY(180deg); }
  .fc-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; display:flex; align-items:center; justify-content:center; text-align:center; padding:12px; overflow:auto; background:var(--card); border:1px solid var(--bd); border-radius:12px; box-shadow:var(--shadow); font-size:.9rem; }
  .fc-code .fc-face { align-items:flex-start; text-align:left; }
  .fc-back { transform:rotateY(180deg); color:var(--ok); font-weight:600; border-color:var(--ok); }
  /* ── Overlay (all study modes live here) ── */
  #ov { position:fixed; inset:0; background:rgba(10,14,25,.78); backdrop-filter:blur(3px); display:none; align-items:center; justify-content:center; padding:16px; z-index:99; overflow-y:auto; }
  #ovBox { background:var(--panel); color:var(--text); border-radius:16px; padding:22px; max-width:640px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.45); margin:auto; }
  #ovTop { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
  #ovTitle { font-weight:700; font-size:.95rem; }
  #ovClose { background:none; border:1px solid var(--bd); border-radius:8px; color:var(--muted); cursor:pointer; padding:4px 10px; font-size:.8rem; }
  #barWrap { height:6px; background:var(--bd); border-radius:3px; overflow:hidden; margin-bottom:14px; }
  #bar { height:100%; width:0%; background:var(--ac); transition:width .25s; }
  #qText { font-size:1.1rem; font-weight:600; margin-bottom:14px; min-height:40px; }
  .qopt { display:block; width:100%; text-align:left; padding:11px 15px; margin:7px 0; border:1px solid var(--bd); border-radius:10px; background:var(--bg); color:var(--text); cursor:pointer; font-size:.92rem; }
  .qopt:hover:not(:disabled) { border-color:var(--ac); }
  .qopt.sel { border-color:var(--ac); background:color-mix(in srgb, var(--ac) 12%, var(--bg)); }
  .qopt.ok { background:var(--okbg); border-color:var(--ok); }
  .qopt.bad { background:var(--badbg); border-color:var(--bad); }
  .qopt.is-code { font-family:'SF Mono',Consolas,monospace; font-size:.84rem; white-space:pre-wrap; }
  #ovFoot { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:14px; flex-wrap:wrap; }
  #ovScore { color:var(--muted); font-size:.84rem; }
  .mainbtn { background:var(--ac); color:#fff; border:none; padding:9px 18px; border-radius:9px; cursor:pointer; font-weight:600; font-size:.86rem; }
  .mainbtn:disabled { opacity:.45; cursor:not-allowed; }
  .subbtn { background:var(--bg); color:var(--text); border:1px solid var(--bd); padding:9px 14px; border-radius:9px; cursor:pointer; font-size:.86rem; }
  .hintline { font-size:.78rem; color:var(--muted); margin-bottom:10px; }
  /* Learn mode */
  .learn-card { background:var(--bg); border:1px solid var(--bd); border-radius:12px; padding:26px 18px; text-align:center; font-size:1.05rem; min-height:120px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .learn-card.rev { border-color:var(--ok); }
  .learn-btns { display:flex; gap:10px; justify-content:center; margin-top:14px; }
  .learn-btns button { flex:1; max-width:180px; }
  .btn-bad { background:var(--bad); color:#fff; border:none; padding:11px; border-radius:9px; cursor:pointer; font-weight:600; }
  .btn-ok  { background:var(--ok);  color:#fff; border:none; padding:11px; border-radius:9px; cursor:pointer; font-weight:600; }
  /* Write mode */
  #wIn { width:100%; padding:11px 14px; border:1px solid var(--bd); border-radius:10px; background:var(--bg); color:var(--text); font-size:.95rem; }
  #wIn:focus { outline:none; border-color:var(--ac); }
  .verdict { margin-top:12px; padding:10px 14px; border-radius:10px; font-size:.9rem; }
  .verdict.ok { background:var(--okbg); border:1px solid var(--ok); }
  .verdict.bad { background:var(--badbg); border:1px solid var(--bad); }
  /* Match mode */
  .match-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .mitem { padding:10px 12px; border:1px solid var(--bd); border-radius:10px; background:var(--bg); cursor:pointer; font-size:.86rem; text-align:left; color:var(--text); }
  .mitem.sel { border-color:var(--ac); background:color-mix(in srgb, var(--ac) 14%, var(--bg)); }
  .mitem.gone { opacity:.25; pointer-events:none; }
  .mitem.wrong { border-color:var(--bad); animation:shake .3s; }
  @keyframes shake { 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  /* Stats */
  .stat-row { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
  .stat { flex:1; min-width:110px; background:var(--bg); border:1px solid var(--bd); border-radius:11px; padding:12px; text-align:center; }
  .stat b { display:block; font-size:1.35rem; }
  .stat span { font-size:.68rem; color:var(--muted); }
  .boxes { display:flex; gap:6px; align-items:flex-end; height:70px; margin:8px 0 16px; }
  .boxes div { flex:1; border-radius:4px 4px 0 0; position:relative; }
  .boxes small { position:absolute; bottom:-16px; left:0; right:0; text-align:center; font-size:.62rem; color:var(--muted); }
  footer { margin-top:50px; color:var(--muted); font-size:.78rem; text-align:center; }
  kbd { background:var(--bg); border:1px solid var(--bd); border-bottom-width:2px; border-radius:5px; padding:1px 6px; font-size:.72rem; font-family:inherit; }
  /* ── Print ── */
  @media print {
    .topbar, .toc, .deck-btns, #ov, .tw, .fcount, .ntools, .deck-bar { display:none !important; }
    .folder.collapsed .fbody { display:block !important; }
    .wrap { grid-template-columns:1fr; max-width:none; padding:0; }
    body { background:#fff; color:#000; }
    .note, .fc-face { box-shadow:none; }
    .note.is-done { opacity:1; }
    .fc { height:auto; perspective:none; break-inside:avoid; }
    .fc-in { transform:none !important; }
    .fc-face { position:static; }
    .fc-back { transform:none; }
  }
</style></head><body>
<div class="topbar"><div class="tb-in">
  <div class="tb-title">📋 ${esc(roomName)}</div>
  <input id="q" placeholder="🔍 Hledat v poznámkách i kartičkách…" autocomplete="off">
  <div class="ring" id="ring" title="Naučeno"><i id="ringTxt">0%</i></div>
  <button class="tb-btn" onclick="openStats()">📊 Statistiky</button>
  <button class="tb-btn" onclick="openExam()">🎓 Zkouška</button>
  <button class="tb-btn" id="themeBtn" title="Přepnout vzhled">🌙</button>
</div></div>
<div class="wrap">
  <nav class="toc">
    <div class="toc-h">Obsah</div>
    ${tocHtml || '<div class="hint" style="padding:4px 6px;">Prázdné</div>'}
    <div class="toc-tools">
      <button onclick="openExam()">🎓 Zkouškový režim</button>
      <button onclick="openStats()">📊 Můj pokrok</button>
      <button onclick="toggleUnlearned()" id="filtBtn">🎯 Jen nenaučené</button>
      <button onclick="window.print()">🖨️ Tisk / PDF</button>
    </div>
  </nav>
  <main>
    <h1>${esc(roomName)}</h1>
    <div class="sub">Exportováno ${esc(when)} · ${noteCount} poznámek${boardCount ? ` · ${boardCount} tabulí` : ''}${cardCount ? ` · ${cardCount} kartiček` : ''} · funguje offline</div>
    ${notesHtml || '<p class="hint">Žádné poznámky.</p>'}
    ${boardsHtml}
    <div class="nosearch" id="noHits">Nic nenalezeno.</div>
    ${decksHtml}
    <footer>Vytvořeno ve StudyBoard · <kbd>/</kbd> hledat · <kbd>Esc</kbd> zavřít</footer>
  </main>
</div>
<div id="ov"><div id="ovBox">
  <div id="ovTop"><span id="ovTitle"></span><button id="ovClose" onclick="closeOv()">Zavřít ✕</button></div>
  <div id="barWrap"><div id="bar"></div></div>
  <div id="ovBody"></div>
  <div id="ovFoot"><span id="ovScore"></span><span id="ovActions"></span></div>
</div></div>
<script>
var DECKS = ${decksJson};
var STORE_KEY = '${roomKey}';

/* ── Persistence: Leitner boxes + note flags + daily activity ── */
var DB = { cards:{}, notes:{}, days:{}, answered:0, correct:0 };
try { var raw = localStorage.getItem(STORE_KEY); if (raw) DB = Object.assign(DB, JSON.parse(raw)); } catch(e){}
function save(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch(e){} }
var BOX_MS = { 1: 600000, 2: 86400000, 3: 259200000, 4: 604800000, 5: 1382400000 };
function cardKey(di, ci){ return di + ':' + ci; }
function grade(di, ci, ok){
  var k = cardKey(di, ci), e = DB.cards[k] || { box:0, due:0 };
  e.box = ok ? Math.min(5, (e.box||0) + 1) : 1;
  e.due = Date.now() + BOX_MS[e.box];
  DB.cards[k] = e;
  DB.answered++; if (ok) DB.correct++;
  var day = new Date().toISOString().slice(0,10);
  var d = DB.days[day] || { a:0, c:0 };
  d.a++; if (ok) d.c++;
  DB.days[day] = d;
  save(); refreshProgress();
}
function boxOf(di, ci){ var e = DB.cards[cardKey(di,ci)]; return e ? e.box : 0; }
function isDue(di, ci){ var e = DB.cards[cardKey(di,ci)]; return !e || e.due <= Date.now(); }

/* Mastery = share of cards sitting in box 4 or 5 */
function deckMastery(di){
  var dk = DECKS[di]; if (!dk || !dk.cards.length) return 0;
  var good = 0;
  for (var i = 0; i < dk.cards.length; i++) if (boxOf(di, i) >= 4) good++;
  return Math.round(good / dk.cards.length * 100);
}
function overallProgress(){
  var tot = 0, good = 0;
  for (var di = 0; di < DECKS.length; di++){
    for (var ci = 0; ci < DECKS[di].cards.length; ci++){ tot++; if (boxOf(di,ci) >= 4) good++; }
  }
  var notes = document.querySelectorAll('article.note[data-nid]');
  var doneN = 0;
  notes.forEach(function(n){ if (DB.notes[n.dataset.nid] && DB.notes[n.dataset.nid].done) doneN++; });
  tot += notes.length; good += doneN;
  return tot ? Math.round(good / tot * 100) : 0;
}
function refreshProgress(){
  var p = overallProgress();
  var r = document.getElementById('ring');
  r.style.setProperty('--p', p);
  document.getElementById('ringTxt').textContent = p + '%';
  for (var di = 0; di < DECKS.length; di++){
    var m = deckMastery(di);
    var bar = document.getElementById('dbar-' + di), txt = document.getElementById('dtxt-' + di);
    if (bar) bar.style.width = m + '%';
    if (txt) txt.textContent = 'zvládnuto ' + m + '%';
  }
}

/* ── Theme ── */
var themeBtn = document.getElementById('themeBtn');
function setTheme(t){ document.documentElement.dataset.theme = t; themeBtn.textContent = t === 'dark' ? '☀️' : '🌙'; try { localStorage.setItem('sbx_theme', t); } catch(e){} }
setTheme((function(){ try { return localStorage.getItem('sbx_theme') || 'light'; } catch(e){ return 'light'; } })());
themeBtn.onclick = function(){ setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };

/* ── Note flags: learned / starred ── */
function applyNoteFlags(){
  document.querySelectorAll('article.note[data-nid]').forEach(function(n){
    var f = DB.notes[n.dataset.nid] || {};
    n.classList.toggle('is-done', !!f.done);
    n.classList.toggle('is-star', !!f.star);
  });
  refreshProgress();
}
document.addEventListener('click', function(e){
  var d = e.target.closest ? e.target.closest('[data-done]') : null;
  var s = e.target.closest ? e.target.closest('[data-star]') : null;
  if (d){ var id = d.getAttribute('data-done'); DB.notes[id] = DB.notes[id] || {}; DB.notes[id].done = !DB.notes[id].done; save(); applyNoteFlags(); }
  if (s){ var i2 = s.getAttribute('data-star'); DB.notes[i2] = DB.notes[i2] || {}; DB.notes[i2].star = !DB.notes[i2].star; save(); applyNoteFlags(); }
});
var ONLY_UNLEARNED = false;
function toggleUnlearned(){
  ONLY_UNLEARNED = !ONLY_UNLEARNED;
  document.getElementById('filtBtn').textContent = ONLY_UNLEARNED ? '👁️ Zobrazit vše' : '🎯 Jen nenaučené';
  runSearch();
}

/* ── Fold a folder — subfolders are following siblings with a bigger depth ── */
function folderDepth(sec){ return parseInt(sec.getAttribute('data-depth'), 10) || 0; }
function toggleFolder(h){
  var sec = h.parentNode, close = !sec.classList.contains('collapsed');
  sec.classList.toggle('collapsed', close);
  var d = folderDepth(sec), n = sec.nextElementSibling;
  while (n && n.classList.contains('folder') && folderDepth(n) > d){
    n.style.display = close ? 'none' : '';
    n.classList.remove('collapsed');
    n = n.nextElementSibling;
  }
}

/* ── Search over notes (and, when it matches, jump-to-card hints) ── */
function norm(s){ return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function runSearch(){
  var v = norm((document.getElementById('q').value || '').trim()), any = false;
  document.querySelectorAll('article.note').forEach(function(n){
    var hit = !v || norm(n.textContent).indexOf(v) !== -1;
    if (hit && ONLY_UNLEARNED && n.dataset.nid){
      var f = DB.notes[n.dataset.nid] || {};
      if (f.done) hit = false;
    }
    n.style.display = hit ? '' : 'none';
    if (hit) any = true;
  });
  var secs = [].slice.call(document.querySelectorAll('section.folder'));
  var keep = secs.map(function(s){
    var vis = false;
    s.querySelectorAll('article.note').forEach(function(n){ if (n.style.display !== 'none') vis = true; });
    return vis;
  });
  /* walk backwards so a parent inherits visibility from its descendants */
  for (var i = secs.length - 1; i >= 0; i--){
    if (!keep[i]) continue;
    var d = folderDepth(secs[i]);
    for (var j = i - 1; j >= 0 && d > 0; j--){
      if (folderDepth(secs[j]) < d){ keep[j] = true; d = folderDepth(secs[j]); }
    }
  }
  secs.forEach(function(s, i){
    s.style.display = keep[i] ? '' : 'none';
    if (v) s.classList.remove('collapsed');
  });
  /* cards matching the query */
  var shownCards = 0;
  document.querySelectorAll('.fc').forEach(function(c){
    var hit = !v || norm(c.textContent).indexOf(v) !== -1;
    c.style.display = hit ? '' : 'none';
    if (hit) shownCards++;
  });
  document.querySelectorAll('.deck').forEach(function(d){
    var vis = false;
    d.querySelectorAll('.fc').forEach(function(c){ if (c.style.display !== 'none') vis = true; });
    d.style.display = (!v || vis) ? '' : 'none';
  });
  document.getElementById('noHits').style.display = (any || shownCards) ? 'none' : 'block';
}
document.getElementById('q').addEventListener('input', runSearch);

/* ── Flip all cards in a deck ── */
function flipAll(btn){
  var deck = btn.closest('.deck'), cards = deck.querySelectorAll('.fc');
  var anyUnflipped = false;
  cards.forEach(function(c){ if (!c.classList.contains('flip')) anyUnflipped = true; });
  cards.forEach(function(c){ c.classList.toggle('flip', anyUnflipped); });
}

/* ── Shared overlay plumbing ── */
var S = null;   /* current session */
function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function rnd(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
function openOv(title){
  document.getElementById('ovTitle').textContent = title;
  document.getElementById('ov').style.display = 'flex';
}
function closeOv(){ document.getElementById('ov').style.display = 'none'; S = null; }
function setBar(p){ document.getElementById('bar').style.width = Math.max(0, Math.min(100, p)) + '%'; }
function ovBody(html){ document.getElementById('ovBody').innerHTML = html; }
function ovActions(html){ document.getElementById('ovActions').innerHTML = html; }
function ovScore(txt){ document.getElementById('ovScore').textContent = txt; }
function pre(txt){ var p = document.createElement('pre'); p.className = 'code-block'; var c = document.createElement('code'); c.textContent = txt; p.appendChild(c); return p; }
function setQ(card){
  var box = document.createElement('div');
  box.id = 'qText';
  if (card.frontLang) box.appendChild(pre(card.front));
  else box.textContent = card.front;
  var body = document.getElementById('ovBody');
  body.innerHTML = '';
  body.appendChild(box);
  return body;
}

/* Pools in, random subset out — option count moves per attempt */
function optionsFor(card, allCards){
  var corr = [card.back].concat(card.corrects || []).filter(function(v,i,a){ return v && a.indexOf(v) === i; });
  var pool = (card.distractors || []).slice();
  if (pool.length < 3 && allCards){
    pool = pool.concat(allCards.filter(function(c){ return c !== card && c.back; }).map(function(c){ return c.back; }));
  }
  pool = pool.filter(function(v,i,a){ return v && a.indexOf(v) === i && corr.indexOf(v) === -1; });
  var nC = corr.length > 1 ? rnd(1, Math.min(corr.length, 3)) : 1;
  var nW = Math.max(1, Math.min(corr.length > 1 ? rnd(2, 5) : 3, pool.length));
  return shuffle(
    shuffle(corr).slice(0, nC).map(function(t){ return { text:t, correct:true }; })
      .concat(shuffle(pool).slice(0, nW).map(function(t){ return { text:t, correct:false }; })));
}

/* ── Mode launcher ── */
function startMode(mode, di, pool){
  var dk = DECKS[di];
  var cards = pool || (dk ? dk.cards.map(function(c, i){ return { c:c, di:di, ci:i }; }) : []);
  if (!cards.length){ alert('Žádné kartičky.'); return; }
  if (mode === 'learn'){
    /* Spaced repetition: what is due, weakest first — everything if none is */
    var due = cards.filter(function(x){ return isDue(x.di, x.ci); });
    if (!due.length) due = cards;
    due.sort(function(a,b){ return boxOf(a.di,a.ci) - boxOf(b.di,b.ci); });
    S = { mode:mode, list:due, i:-1, score:0, di:di };
  } else {
    S = { mode:mode, list:shuffle(cards).slice(0, 20), i:-1, score:0, di:di };
  }
  var names = { learn:'🧠 Učení', quiz:'▶ Kvíz', write:'⌨️ Psaní', match:'🔗 Párování', exam:'🎓 Zkouška' };
  openOv((dk ? dk.name + ' — ' : '') + names[mode]);
  if (mode === 'match') return renderMatch();
  next();
}

function next(){
  if (!S) return;
  S.i++;
  setBar(S.i / S.list.length * 100);
  ovScore(S.i > 0 ? ('Skóre ' + S.score + ' / ' + S.i) : '');
  if (S.i >= S.list.length) return finish();
  if (S.mode === 'learn') return renderLearn();
  if (S.mode === 'write') return renderWrite();
  return renderQuiz();
}

function finish(){
  var pct = S.list.length ? Math.round(S.score / S.list.length * 100) : 0;
  var mode = S.mode, di = S.di;
  setBar(100);
  ovBody('<div style="text-align:center;padding:18px 0;">' +
    '<div style="font-size:2.2rem;">' + (pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📖') + '</div>' +
    '<div style="font-weight:700;font-size:1.15rem;margin:8px 0;">' + S.score + ' / ' + S.list.length + ' (' + pct + ' %)</div>' +
    '<div class="hintline">' + (pct >= 80 ? 'Skvělé, tohle už umíš.' : pct >= 50 ? 'Slušné — projdi si, co nesedělo.' : 'Zkus to znovu, ještě to potřebuje čas.') + '</div>' +
    '</div>');
  ovScore('');
  var again = document.createElement('button');
  again.className = 'mainbtn';
  again.textContent = '↻ Znovu';
  again.onclick = function(){ if (mode === 'exam') openExam(); else startMode(mode, di); };
  var close = document.createElement('button');
  close.className = 'subbtn';
  close.textContent = 'Hotovo';
  close.style.marginRight = '8px';
  close.onclick = closeOv;
  var host = document.getElementById('ovActions');
  host.innerHTML = '';
  host.appendChild(close);
  host.appendChild(again);
}

/* ── 1) Learn: flip, then say whether you knew it → Leitner ── */
function renderLearn(){
  var x = S.list[S.i], card = x.c;
  var body = setQ(card);
  var b = document.createElement('div');
  b.className = 'learn-card';
  b.textContent = 'Klikni pro odpověď';
  b.onclick = function(){
    if (b.classList.contains('rev')) return;
    b.innerHTML = '';
    b.classList.add('rev');
    if (card.codeLang) b.appendChild(pre(card.back)); else b.textContent = card.back;
    document.getElementById('learnBtns').style.display = 'flex';
  };
  body.appendChild(b);
  var btns = document.createElement('div');
  btns.className = 'learn-btns';
  btns.id = 'learnBtns';
  btns.style.display = 'none';
  var no = document.createElement('button'); no.className = 'btn-bad'; no.textContent = '✕ Ještě ne';
  var yes = document.createElement('button'); yes.className = 'btn-ok'; yes.textContent = '✓ Umím';
  no.onclick = function(){ grade(x.di, x.ci, false); next(); };
  yes.onclick = function(){ grade(x.di, x.ci, true); S.score++; next(); };
  btns.appendChild(no); btns.appendChild(yes);
  body.appendChild(btns);
  S.flip = function(){ b.onclick(); };
  S.no = no; S.yes = yes;
  ovActions('<span class="hintline"><kbd>Mezerník</kbd> otočit · <kbd>1</kbd> neumím · <kbd>2</kbd> umím</span>');
}

/* ── 2) Quiz: multiple choice, several correct answers possible ── */
function renderQuiz(){
  var x = S.list[S.i], card = x.c;
  var all = DECKS[x.di] ? DECKS[x.di].cards : [];
  var opts = optionsFor(card, all);
  var multi = (card.corrects || []).length > 0;
  var body = setQ(card);
  if (multi){
    var h = document.createElement('div');
    h.className = 'hintline';
    h.innerHTML = '☑️ Zaškrtni <b>všechny</b> správné — může jich být i víc.';
    body.appendChild(h);
  }
  var box = document.createElement('div');
  body.appendChild(box);
  var done = false;
  function reveal(ok){
    done = true;
    [].forEach.call(box.children, function(el, i){
      el.disabled = true;
      if (opts[i].correct) el.classList.add('ok');
      else if (el.dataset.sel) el.classList.add('bad');
    });
    if (ok) S.score++;
    grade(x.di, x.ci, ok);
    setTimeout(next, ok ? 900 : 1700);
  }
  opts.forEach(function(o, i){
    var b = document.createElement('button');
    b.className = 'qopt' + (card.codeLang ? ' is-code' : '');
    b.textContent = (multi ? '☐  ' : '') + o.text;
    b.onclick = function(){
      if (done) return;
      if (!multi) return reveal(o.correct);
      b.dataset.sel = b.dataset.sel ? '' : '1';
      b.classList.toggle('sel', !!b.dataset.sel);
      b.textContent = (b.dataset.sel ? '☑  ' : '☐  ') + o.text;
      document.getElementById('cfm').disabled = ![].some.call(box.children, function(e){ return e.dataset.sel; });
    };
    box.appendChild(b);
  });
  S.pickN = function(n){ if (!done && box.children[n]) box.children[n].onclick(); };
  if (multi){
    ovActions('<button class="mainbtn" id="cfm" disabled>Potvrdit</button>');
    document.getElementById('cfm').onclick = function(){
      if (done) return;
      reveal(opts.every(function(o, i){ return !!box.children[i].dataset.sel === !!o.correct; }));
    };
  } else ovActions('');
}

/* ── 3) Write: type the answer (diacritics/case/spacing forgiven) ── */
function wnorm(s){ return norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
function renderWrite(){
  var x = S.list[S.i], card = x.c;
  var body = setQ(card);
  var inp = document.createElement('input');
  inp.id = 'wIn'; inp.placeholder = 'Napiš odpověď…'; inp.autocomplete = 'off';
  body.appendChild(inp);
  var v = document.createElement('div');
  body.appendChild(v);
  var done = false;
  function check(){
    if (done) return;
    done = true;
    var accept = [card.back].concat(card.corrects || []);
    var mine = wnorm(inp.value);
    var ok = mine.length > 0 && accept.some(function(a){ return wnorm(a) === mine; });
    v.className = 'verdict ' + (ok ? 'ok' : 'bad');
    if (ok) v.textContent = '✓ Správně!';
    else {
      v.textContent = '✕ Správná odpověď: ';
      var strong = document.createElement('b');
      strong.textContent = card.back;
      v.appendChild(strong);
    }
    inp.disabled = true;
    if (ok) S.score++;
    grade(x.di, x.ci, ok);
    ovActions('<button class="mainbtn" id="cfm">Další →</button>');
    document.getElementById('cfm').onclick = next;
  }
  inp.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){ e.preventDefault(); if (done) next(); else check(); }
  });
  ovActions('<button class="mainbtn" id="cfm">Zkontrolovat</button>');
  document.getElementById('cfm').onclick = check;
  setTimeout(function(){ inp.focus(); }, 30);
}

/* ── 4) Match: pair questions with answers ── */
function renderMatch(){
  var pairs = shuffle(S.list).slice(0, 6);
  S.pairs = pairs; S.left = null; S.matched = 0;
  setBar(0);
  var L = shuffle(pairs.map(function(p){ return { t:p.c.front, i:pairs.indexOf(p) }; }));
  var R = shuffle(pairs.map(function(p){ return { t:p.c.back,  i:pairs.indexOf(p) }; }));
  ovBody('<div class="hintline">Spoj otázku se správnou odpovědí.</div>' +
         '<div class="match-grid"><div id="mL"></div><div id="mR"></div></div>');
  function fill(id, arr, side){
    var host = document.getElementById(id);
    arr.forEach(function(o){
      var b = document.createElement('button');
      b.className = 'mitem';
      b.textContent = o.t;
      b.dataset.i = o.i;
      b.dataset.side = side;
      b.style.marginBottom = '8px';
      b.style.width = '100%';
      b.onclick = function(){ pickMatch(b); };
      host.appendChild(b);
    });
  }
  fill('mL', L, 'l'); fill('mR', R, 'r');
  ovActions('');
  ovScore('0 / ' + pairs.length + ' spojeno');
}
function pickMatch(b){
  if (b.classList.contains('gone')) return;
  if (!S.left){ S.left = b; b.classList.add('sel'); return; }
  if (S.left === b){ b.classList.remove('sel'); S.left = null; return; }
  if (S.left.dataset.side === b.dataset.side){ S.left.classList.remove('sel'); S.left = b; b.classList.add('sel'); return; }
  var a = S.left; S.left = null; a.classList.remove('sel');
  if (a.dataset.i === b.dataset.i){
    a.classList.add('gone'); b.classList.add('gone');
    S.matched++; S.score++;
    var p = S.pairs[+a.dataset.i];
    grade(p.di, p.ci, true);
    setBar(S.matched / S.pairs.length * 100);
    ovScore(S.matched + ' / ' + S.pairs.length + ' spojeno');
    if (S.matched === S.pairs.length){ S.list = S.pairs; S.i = S.pairs.length; finish(); }
  } else {
    b.classList.add('wrong'); a.classList.add('wrong');
    setTimeout(function(){ b.classList.remove('wrong'); a.classList.remove('wrong'); }, 320);
  }
}

/* ── Exam: mixed questions from every deck ── */
function openExam(){
  var all = [];
  DECKS.forEach(function(dk, di){ dk.cards.forEach(function(c, ci){ all.push({ c:c, di:di, ci:ci }); }); });
  if (!all.length){ alert('Nejsou žádné kartičky ke zkoušení.'); return; }
  var n = Math.min(20, all.length);
  /* Weakest cards first, then fill up randomly — an exam should hurt where it should */
  var weak = all.slice().sort(function(a,b){ return boxOf(a.di,a.ci) - boxOf(b.di,b.ci); }).slice(0, n);
  S = { mode:'exam', list:shuffle(weak), i:-1, score:0, di:0 };
  openOv('🎓 Zkouška — ' + n + ' otázek ze všech balíčků');
  next();
}

/* ── Stats ── */
function openStats(){
  var boxes = [0,0,0,0,0], total = 0;
  DECKS.forEach(function(dk, di){
    dk.cards.forEach(function(c, ci){
      total++;
      var b = boxOf(di, ci);
      if (b >= 1) boxes[Math.min(5,b) - 1]++;
    });
  });
  var acc = DB.answered ? Math.round(DB.correct / DB.answered * 100) : 0;
  var dueNow = 0;
  DECKS.forEach(function(dk, di){ dk.cards.forEach(function(c, ci){ if (isDue(di, ci)) dueNow++; }); });

  /* day streak, counting back from today */
  var streak = 0;
  for (var i = 0; i < 400; i++){
    var d = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
    if (DB.days[d] && DB.days[d].a) streak++;
    else if (i > 0) break;
  }
  var maxBox = Math.max(1, Math.max.apply(null, boxes));
  var colors = ['#ef4444','#f59e0b','#eab308','#84cc16','#22c55e'];
  var boxHtml = '<div class="boxes">';
  for (var b2 = 0; b2 < 5; b2++){
    boxHtml += '<div style="height:' + Math.round(boxes[b2] / maxBox * 100) + '%;min-height:' + (boxes[b2] ? 5 : 0) + 'px;background:' + colors[b2] + ';">' +
               '<small>' + (b2+1) + ' · ' + boxes[b2] + '</small></div>';
  }
  boxHtml += '</div>';

  var days = '';
  var maxA = 1;
  for (var k = 6; k >= 0; k--){
    var key = new Date(Date.now() - k * 86400000).toISOString().slice(0,10);
    maxA = Math.max(maxA, (DB.days[key] || {a:0}).a);
  }
  days += '<div class="boxes">';
  for (var k2 = 6; k2 >= 0; k2--){
    var dt = new Date(Date.now() - k2 * 86400000);
    var key2 = dt.toISOString().slice(0,10);
    var a = (DB.days[key2] || {a:0}).a;
    days += '<div style="height:' + Math.round(a / maxA * 100) + '%;min-height:' + (a ? 5 : 2) + 'px;background:var(--ac);opacity:' + (a ? 1 : .2) + ';">' +
            '<small>' + ['ne','po','út','st','čt','pá','so'][dt.getDay()] + '</small></div>';
  }
  days += '</div>';

  var deckRows = DECKS.map(function(dk, di){
    var m = deckMastery(di);
    return '<div style="margin:8px 0;"><div style="display:flex;justify-content:space-between;font-size:.82rem;">' +
      '<span>' + dk.name.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span><span style="color:var(--muted)">' + m + ' %</span></div>' +
      '<div class="deck-bar" style="margin:4px 0 0;"><div class="deck-bar-fill" style="width:' + m + '%"></div></div></div>';
  }).join('');

  openOv('📊 Můj pokrok');
  setBar(overallProgress());
  ovBody(
    '<div class="stat-row">' +
      '<div class="stat"><b>' + overallProgress() + ' %</b><span>celkem zvládnuto</span></div>' +
      '<div class="stat"><b>' + acc + ' %</b><span>úspěšnost</span></div>' +
      '<div class="stat"><b>' + dueNow + '</b><span>k opakování</span></div>' +
      '<div class="stat"><b>' + streak + '</b><span>dní v řadě</span></div>' +
    '</div>' +
    '<div class="hintline">Krabičky opakování (1 = neumím · 5 = umím jistě)</div>' + boxHtml +
    '<div class="hintline" style="margin-top:22px;">Posledních 7 dní</div>' + days +
    (deckRows ? '<div class="hintline" style="margin-top:22px;">Balíčky</div>' + deckRows : '') +
    '<div class="hintline" style="margin-top:18px;">Pokrok se ukládá v tomto prohlížeči.</div>'
  );
  ovScore(DB.answered + ' odpovědí celkem');
  ovActions('<button class="subbtn" id="rst">Vynulovat pokrok</button>');
  document.getElementById('rst').onclick = function(){
    if (!confirm('Opravdu smazat veškerý postup učení?')) return;
    DB = { cards:{}, notes:{}, days:{}, answered:0, correct:0 };
    save(); applyNoteFlags(); closeOv();
  };
}

/* ── Keyboard ── */
document.addEventListener('keydown', function(e){
  var ovOpen = document.getElementById('ov').style.display === 'flex';
  if (e.key === 'Escape'){ if (ovOpen) closeOv(); return; }
  if (!ovOpen){
    if (e.key === '/' && document.activeElement !== document.getElementById('q')){
      e.preventDefault(); document.getElementById('q').focus();
    }
    return;
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (!S) return;
  if (S.mode === 'learn'){
    if (e.key === ' '){ e.preventDefault(); if (S.flip) S.flip(); }
    if (e.key === '1' && S.no  && S.no.offsetParent)  S.no.click();
    if (e.key === '2' && S.yes && S.yes.offsetParent) S.yes.click();
    return;
  }
  if ((S.mode === 'quiz' || S.mode === 'exam') && S.pickN){
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) S.pickN(n - 1);
  }
});

applyNoteFlags();
refreshProgress();
runSearch();
</script></body></html>`;
}

// ═══ room-export.js — Export místnosti do samostatné HTML stránky
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

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

async function gatherExportData(opts) {
  // Notes grouped by folder (nested folders → path label), then unfiled.
  const filedIds = new Set();
  FOLDERS_MAP.forEach(f => (f.noteIds || []).forEach(id => filedIds.add(id)));
  const sections = [...FOLDERS_MAP.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    .map(f => ({ title: folderPathLabel(f), notes: (f.noteIds || []).map(id => NOTES_MAP.get(id)).filter(Boolean) }))
    .filter(s => s.notes.length);
  const unfiled = [...NOTES_MAP.values()].filter(n => !filedIds.has(n.id)).sort((a, b) => noteRecency(b) - noteRecency(a));
  if (unfiled.length) sections.push({ title: 'Nezařazené poznámky', notes: unfiled });

  // Comments (optional; one read per note in parallel).
  const commentsByNote = {};
  if (opts.comments) {
    await Promise.all([...NOTES_MAP.values()].map(async n => {
      try {
        const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(n.id).collection('comments').orderBy('at', 'asc').get();
        if (!snap.empty) commentsByNote[n.id] = snap.docs.map(d => d.data());
      } catch (_) {}
    }));
  }

  // Room flash-card decks + their cards.
  let decks = [];
  if (opts.cards) {
    try {
      const deckSnap = await db.collection('decks').where('roomId', '==', ROOM_ID).get();
      decks = (await Promise.all(deckSnap.docs.map(async d => {
        const cardsSnap = await db.collection('decks').doc(d.id).collection('cards').get();
        return { name: d.data().name || 'Balíček', color: d.data().color || '#6366f1',
                 cards: cardsSnap.docs.map(c => c.data()).filter(c => c.front || c.back)
                        .map(c => ({ front: c.front || '', back: c.back || '', distractors: c.distractors || [] })) };
      }))).filter(dk => dk.cards.length);
    } catch (_) {}
  }
  return { sections, commentsByNote, decks };
}

async function runExport() {
  const btn = document.getElementById('exportRunBtn');
  const hint = document.getElementById('exportHint');
  const opts = {
    conns: document.getElementById('exportConns').checked,
    comments: document.getElementById('exportComments').checked,
    cards: document.getElementById('exportCards').checked,
  };
  btn.disabled = true; hint.textContent = 'Připravuji…';
  try {
    const data = await gatherExportData(opts);
    const safe = (ROOM.name || 'mistnost').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'export';
    downloadFile(safe + '.html', buildExportHtml(data, opts), 'text/html;charset=utf-8');
    hint.textContent = 'Hotovo ✓';
    setTimeout(() => closeModal('exportModal'), 800);
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

// Self-contained study page: sticky header with live search + dark-mode
// toggle, a table-of-contents sidebar, full note content grouped by folder,
// and per-deck flash cards (3D flip) with a quiz mode incl. progress bar.
// Everything is inlined so the single file works offline. Printing (Ctrl+P)
// is styled too, so PDF is still one keystroke away.
// NOTE: the embedded <script> must stay free of backticks and ${} — it lives
// inside this outer template literal.
function buildExportHtml(data, opts) {
  const noteCount = data.sections.reduce((s, sec) => s + sec.notes.length, 0);
  const cardCount = data.decks.reduce((s, dk) => s + dk.cards.length, 0);
  const when = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

  const tocHtml =
    data.sections.map((sec, si) => `<a href="#sec-${si}">📁 ${esc(sec.title)} <span>${sec.notes.length}</span></a>`).join('') +
    (data.decks.length ? `<div class="toc-sep"></div>` + data.decks.map((dk, di) => `<a href="#deck-${di}">🃏 ${esc(dk.name)} <span>${dk.cards.length}</span></a>`).join('') : '');

  const notesHtml = data.sections.map((sec, si) => `
    <section class="folder" id="sec-${si}">
      <h2>📁 ${esc(sec.title)}</h2>
      ${sec.notes.map(n => {
        const title = esc(n.title || exportNoteTitle(n));
        const content = n.contentType === 'html' ? (n.content || '') : `<p>${esc(n.content || '')}</p>`;
        const conns = opts.conns ? exportNoteConns(n.id) : [];
        const connsHtml = conns.length ? `<div class="meta">🔗 ${conns.map(esc).join(' · ')}</div>` : '';
        const cmts = data.commentsByNote[n.id] || [];
        const cmtsHtml = (opts.comments && cmts.length)
          ? `<div class="cmts"><div class="cmts-h">💬 Komentáře (${cmts.length})</div>${cmts.map(c => `<div class="cmt"><b>${esc(c.authorName || 'Anon')}</b> ${esc(c.text || '')}</div>`).join('')}</div>` : '';
        const meta = `<div class="nmeta">${esc(n.authorName || '')}</div>`;
        return `<article class="note" style="--nc:${esc(n.color || '#94a3b8')}"><h3>${title}</h3>${meta}<div class="ncontent">${content}</div>${connsHtml}${cmtsHtml}</article>`;
      }).join('')}
    </section>`).join('');

  const decksHtml = data.decks.length ? `
    <section class="decks" id="decks">
      <h2>🃏 Kartičky</h2>
      <p class="hint">Klikni na kartičku pro otočení, nebo spusť kvíz.</p>
      ${data.decks.map((dk, di) => `
        <div class="deck" id="deck-${di}">
          <div class="deck-hd">
            <h3 style="--dk:${esc(dk.color)}">${esc(dk.name)} <span class="dc">${dk.cards.length} kartiček</span></h3>
            <div class="deck-btns">
              <button class="ghostbtn" onclick="flipAll(this)">↻ Otočit vše</button>
              <button class="quizbtn" onclick="startQuiz(${di})">▶ Kvíz</button>
            </div>
          </div>
          <div class="cards">
            ${dk.cards.map(c => `<div class="fc" onclick="this.classList.toggle('flip')"><div class="fc-in"><div class="fc-face fc-front">${esc(c.front)}</div><div class="fc-face fc-back">${esc(c.back)}</div></div></div>`).join('')}
          </div>
        </div>`).join('')}
    </section>` : '';

  const decksJson = JSON.stringify(data.decks).replace(/</g, '\\u003c');

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ROOM.name || 'Export')}</title>
<style>
  :root {
    --bg:#f4f6fb; --panel:#ffffff; --card:#ffffff; --text:#1e293b; --muted:#64748b;
    --bd:#dbe2ee; --ac:#6366f1; --ok:#16a34a; --okbg:#dcfce7; --bad:#dc2626; --badbg:#fee2e2;
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
  /* ── Top bar ── */
  .topbar { position:sticky; top:0; z-index:50; background:var(--panel); border-bottom:1px solid var(--bd); box-shadow:var(--shadow); }
  .tb-in { max-width:1100px; margin:0 auto; padding:10px 18px; display:flex; align-items:center; gap:14px; }
  .tb-title { font-weight:700; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #q { flex:1; min-width:80px; padding:8px 13px; border:1px solid var(--bd); border-radius:10px; background:var(--bg); color:var(--text); font-size:.9rem; }
  #q:focus { outline:none; border-color:var(--ac); }
  #themeBtn { background:none; border:1px solid var(--bd); border-radius:10px; padding:7px 10px; cursor:pointer; font-size:.95rem; }
  /* ── Layout ── */
  .wrap { max-width:1100px; margin:0 auto; padding:26px 18px 90px; display:grid; grid-template-columns:230px 1fr; gap:28px; align-items:start; }
  .toc { position:sticky; top:76px; background:var(--panel); border:1px solid var(--bd); border-radius:14px; padding:12px; max-height:calc(100vh - 100px); overflow-y:auto; }
  .toc-h { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin:2px 6px 8px; }
  .toc a { display:flex; justify-content:space-between; gap:8px; padding:6px 9px; border-radius:8px; color:var(--text); text-decoration:none; font-size:.84rem; }
  .toc a span { color:var(--muted); font-size:.74rem; }
  .toc a:hover { background:var(--bg); }
  .toc-sep { height:1px; background:var(--bd); margin:8px 4px; }
  @media (max-width:820px){ .wrap { grid-template-columns:1fr; } .toc { position:static; max-height:none; } }
  /* ── Content ── */
  h1 { font-size:1.85rem; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:.86rem; margin-bottom:26px; }
  h2 { font-size:1.25rem; margin:36px 0 6px; padding-bottom:8px; border-bottom:2px solid var(--bd); }
  .hint { color:var(--muted); font-size:.83rem; }
  .note { background:var(--card); border:1px solid var(--bd); border-left:4px solid var(--nc,#94a3b8); border-radius:12px; padding:14px 18px; margin:14px 0; box-shadow:var(--shadow); page-break-inside:avoid; }
  .note h3 { margin:0 0 2px; font-size:1.06rem; }
  .nmeta { font-size:.74rem; color:var(--muted); margin-bottom:8px; }
  .ncontent { font-size:.94rem; overflow-wrap:break-word; }
  .ncontent img { max-width:100%; border-radius:8px; }
  .ncontent table { border-collapse:collapse; max-width:100%; }
  .ncontent td, .ncontent th { border:1px solid var(--bd); padding:4px 8px; }
  .meta { font-size:.8rem; color:var(--muted); margin-top:10px; }
  .cmts { margin-top:10px; padding-top:9px; border-top:1px dashed var(--bd); }
  .cmts-h { font-size:.76rem; font-weight:600; color:var(--muted); margin-bottom:5px; }
  .cmt { font-size:.85rem; margin:3px 0; } .cmt b { margin-right:5px; }
  .nosearch { text-align:center; color:var(--muted); padding:30px 0; display:none; }
  /* ── Decks / flip cards ── */
  .deck { margin:20px 0 30px; }
  .deck-hd { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
  .deck-hd h3 { margin:0; font-size:1.05rem; border-left:4px solid var(--dk,#6366f1); padding-left:10px; }
  .dc { font-size:.8rem; color:var(--muted); font-weight:400; margin-left:6px; }
  .deck-btns { display:flex; gap:8px; }
  .quizbtn { background:var(--ac); color:#fff; border:none; padding:8px 16px; border-radius:9px; cursor:pointer; font-size:.86rem; font-weight:600; }
  .ghostbtn { background:none; color:var(--muted); border:1px solid var(--bd); padding:8px 12px; border-radius:9px; cursor:pointer; font-size:.82rem; }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:12px; }
  .fc { height:130px; perspective:900px; cursor:pointer; }
  .fc-in { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .45s cubic-bezier(.2,.7,.3,1.1); }
  .fc.flip .fc-in { transform:rotateY(180deg); }
  .fc-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; display:flex; align-items:center; justify-content:center; text-align:center; padding:12px; overflow:auto; background:var(--card); border:1px solid var(--bd); border-radius:12px; box-shadow:var(--shadow); font-size:.9rem; }
  .fc-back { transform:rotateY(180deg); color:var(--ok); font-weight:600; border-color:var(--ok); }
  /* ── Quiz ── */
  #quizOv { position:fixed; inset:0; background:rgba(10,14,25,.72); backdrop-filter:blur(3px); display:none; align-items:center; justify-content:center; padding:20px; z-index:99; }
  #quizBox { background:var(--panel); color:var(--text); border-radius:16px; padding:24px; max-width:480px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,.4); }
  #quizBarWrap { height:6px; background:var(--bd); border-radius:3px; overflow:hidden; margin-bottom:16px; }
  #quizBar { height:100%; width:0%; background:var(--ac); transition:width .25s; }
  #quizQ { font-size:1.12rem; font-weight:600; margin-bottom:16px; min-height:44px; }
  .qopt { display:block; width:100%; text-align:left; padding:11px 15px; margin:7px 0; border:1px solid var(--bd); border-radius:10px; background:var(--bg); color:var(--text); cursor:pointer; font-size:.92rem; }
  .qopt:hover { border-color:var(--ac); }
  .qopt.ok { background:var(--okbg); border-color:var(--ok); }
  .qopt.bad { background:var(--badbg); border-color:var(--bad); }
  #quizFoot { display:flex; justify-content:space-between; align-items:center; margin-top:16px; }
  #quizScore { color:var(--muted); font-size:.86rem; }
  #quizNext { background:var(--ac); color:#fff; border:none; padding:9px 18px; border-radius:9px; cursor:pointer; font-weight:600; }
  #quizClose { background:none; border:none; color:var(--muted); cursor:pointer; font-size:.8rem; }
  footer { margin-top:50px; color:var(--muted); font-size:.78rem; text-align:center; }
  /* ── Print ── */
  @media print {
    .topbar, .toc, .deck-btns, #quizOv { display:none !important; }
    .wrap { grid-template-columns:1fr; max-width:none; padding:0; }
    body { background:#fff; color:#000; }
    .note, .fc-face { box-shadow:none; }
    .fc { height:auto; perspective:none; }
    .fc-in { transform:none !important; }
    .fc-face { position:static; }
    .fc-back { transform:none; }
    .fc { break-inside:avoid; }
  }
</style></head><body>
<div class="topbar"><div class="tb-in">
  <div class="tb-title">📋 ${esc(ROOM.name || 'Místnost')}</div>
  <input id="q" placeholder="🔍 Hledat v poznámkách…" autocomplete="off">
  <button id="themeBtn" title="Přepnout vzhled">🌙</button>
</div></div>
<div class="wrap">
  <nav class="toc"><div class="toc-h">Obsah</div>${tocHtml || '<div class="hint" style="padding:4px 6px;">Prázdné</div>'}</nav>
  <main>
    <h1>${esc(ROOM.name || 'Místnost')}</h1>
    <div class="sub">Exportováno ${esc(when)} · ${noteCount} poznámek${cardCount ? ` · ${cardCount} kartiček` : ''}</div>
    ${notesHtml || '<p class="hint">Žádné poznámky.</p>'}
    <div class="nosearch" id="noHits">Nic nenalezeno.</div>
    ${decksHtml}
    <footer>Vytvořeno ve StudyBoard</footer>
  </main>
</div>
<div id="quizOv"><div id="quizBox">
  <div id="quizBarWrap"><div id="quizBar"></div></div>
  <div id="quizQ"></div><div id="quizOpts"></div>
  <div id="quizFoot"><span id="quizScore"></span><button id="quizNext" onclick="quizNext()">Další →</button></div>
  <div style="text-align:center;margin-top:10px;"><button id="quizClose" onclick="document.getElementById('quizOv').style.display='none'">Zavřít</button></div>
</div></div>
<script>
var DECKS = ${decksJson};
/* theme */
var themeBtn = document.getElementById('themeBtn');
function setTheme(t){ document.documentElement.dataset.theme = t; themeBtn.textContent = t === 'dark' ? '☀️' : '🌙'; try { localStorage.setItem('sbx_theme', t); } catch(e){} }
setTheme((function(){ try { return localStorage.getItem('sbx_theme') || 'light'; } catch(e){ return 'light'; } })());
themeBtn.onclick = function(){ setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };
/* live search over notes (diacritics-insensitive) */
function norm(s){ return (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); }
document.getElementById('q').addEventListener('input', function(){
  var v = norm(this.value.trim()), any = false;
  document.querySelectorAll('article.note').forEach(function(n){
    var hit = !v || norm(n.textContent).indexOf(v) !== -1;
    n.style.display = hit ? '' : 'none';
    if (hit) any = true;
  });
  document.querySelectorAll('section.folder').forEach(function(s){
    var vis = false;
    s.querySelectorAll('article.note').forEach(function(n){ if (n.style.display !== 'none') vis = true; });
    s.style.display = vis ? '' : 'none';
  });
  document.getElementById('noHits').style.display = any ? 'none' : 'block';
});
/* flip all cards in a deck */
function flipAll(btn){
  var deck = btn.closest('.deck'), cards = deck.querySelectorAll('.fc');
  var anyUnflipped = false;
  cards.forEach(function(c){ if (!c.classList.contains('flip')) anyUnflipped = true; });
  cards.forEach(function(c){ c.classList.toggle('flip', anyUnflipped); });
}
/* quiz with progress bar */
var Q = null;
function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function startQuiz(di){
  var dk = DECKS[di]; if (!dk || !dk.cards.length) return;
  Q = { di: di, order: shuffle(dk.cards.map(function(_, i){ return i; })), i: -1, score: 0 };
  document.getElementById('quizOv').style.display = 'flex';
  quizNext();
}
function quizNext(){
  var dk = DECKS[Q.di]; Q.i++;
  document.getElementById('quizBar').style.width = Math.round(Q.i / Q.order.length * 100) + '%';
  if (Q.i >= Q.order.length){
    var pct = Math.round(Q.score / Q.order.length * 100);
    document.getElementById('quizQ').textContent = (pct >= 80 ? '🎉 ' : pct >= 50 ? '👍 ' : '📖 ') + 'Hotovo! ' + Q.score + ' / ' + Q.order.length + ' (' + pct + ' %)';
    document.getElementById('quizOpts').innerHTML = '';
    document.getElementById('quizScore').textContent = '';
    var nb = document.getElementById('quizNext'); nb.textContent = '↻ Znovu'; nb.onclick = function(){ startQuiz(Q.di); };
    return;
  }
  var nb2 = document.getElementById('quizNext'); nb2.textContent = 'Další →'; nb2.onclick = quizNext;
  var card = dk.cards[Q.order[Q.i]];
  var others = dk.cards.filter(function(c){ return c !== card; }).map(function(c){ return c.back; });
  var pool = (card.distractors && card.distractors.length) ? card.distractors : others;
  var opts = shuffle([card.back].concat(shuffle(pool).slice(0, 3)).filter(function(v, i, a){ return a.indexOf(v) === i; }));
  document.getElementById('quizQ').textContent = card.front;
  document.getElementById('quizScore').textContent = 'Otázka ' + (Q.i + 1) + ' / ' + Q.order.length + ' · skóre ' + Q.score;
  var box = document.getElementById('quizOpts'); box.innerHTML = '';
  opts.forEach(function(o){
    var b = document.createElement('button'); b.className = 'qopt'; b.textContent = o;
    b.onclick = function(){
      if (b.dataset.done) return;
      box.querySelectorAll('.qopt').forEach(function(x){ x.dataset.done = '1'; });
      if (o === card.back){ b.classList.add('ok'); Q.score++; }
      else { b.classList.add('bad'); box.querySelectorAll('.qopt').forEach(function(x){ if (x.textContent === card.back) x.classList.add('ok'); }); }
      document.getElementById('quizScore').textContent = 'Otázka ' + (Q.i + 1) + ' / ' + Q.order.length + ' · skóre ' + Q.score;
    };
    box.appendChild(b);
  });
}
</script></body></html>`;
}

// ── Lightbox ──────────────────────────────────────────────────

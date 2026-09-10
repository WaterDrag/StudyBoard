// ═══ room-notes.js — Poznámky: render, drag, add/edit, detail, komentáře, undo/redo, lightbox
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).


// ── Real-time notes ───────────────────────────────────────────
function setupNotes() {
  db.collection('rooms').doc(ROOM_ID).collection('notes')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added')    { renderNote(ch.doc.id, ch.doc.data()); NOTES_MAP.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() }); }
        if (ch.type === 'modified') { patchNote(ch.doc.id, ch.doc.data());  NOTES_MAP.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() }); }
        if (ch.type === 'removed')  { document.getElementById('n-' + ch.doc.id)?.remove(); NOTES_MAP.delete(ch.doc.id); }
      });
      if (VIEW_MODE === 'list') renderNotesListView();
      loadCommentCounts();      // first snapshot only (guarded inside)
      applyCommentBadges();     // re-decorate re-rendered cards
      updateMinimap();
    });
}
function canEdit(note) {
  if (MY_ROLE === 'owner')  return true;
  if (MY_ROLE === 'editor' && note.authorId === ME.uid) return true;
  return false;
}

function setNoteContent(contentEl, note) {
  if (note.contentType === 'html') {
    contentEl.innerHTML = note.content || '';
  } else {
    contentEl.textContent = note.content || '';
  }
  addImageClickHandlers(contentEl);
}

// Compact board card: show ONLY the manually-entered title when set (long
// note bodies — e.g. reading-journal writeups — would otherwise dominate the
// board). Falls back to the full content when no title was given, same as
// before titles existed.
function setNoteCardContent(contentEl, note) {
  const n = pagesOf(note).length;
  if (n) {
    const kids = pagesOf(note).filter(p => p.parentId).length;
    contentEl.innerHTML =
      `<div class="note-guide-kind">📖 Návod</div>` +
      `<div class="note-card-title">${esc(note.title || pagesOf(note)[0].title || 'Návod')}</div>` +
      `<div class="note-guide-badge">${n} ${n === 1 ? 'kapitola' : n < 5 ? 'kapitoly' : 'kapitol'}` +
      `${kids ? ` · ${kids} vnořených` : ''}</div>`;
    contentEl.closest('.note')?.classList.add('is-guide');
    return;
  }
  contentEl.closest('.note')?.classList.remove('is-guide');
  if (note.title) {
    contentEl.innerHTML = `<div class="note-card-title">${esc(note.title)}</div>`;
  } else {
    setNoteContent(contentEl, note);
  }
}

function addImageClickHandlers(contentEl) {
  contentEl.querySelectorAll('img').forEach(img => {
    // An image wrapped in a chapter link is a BUTTON, not a picture to zoom —
    // leave the click to the link handler.
    if (img.closest('[data-page]') || img.hasAttribute('data-spots')) { img.style.cursor = 'pointer'; return; }
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', e => {
      e.stopPropagation();
      openLightbox(img.src);
    });
  });
}

function renderNote(id, note) {
  if (document.getElementById('n-' + id)) return;

  const el = document.createElement('div');
  el.className = 'note';
  el.id        = 'n-' + id;
  el.style.left       = toRenderX(note.x) + 'px';
  el.style.top        = toRenderY(note.y) + 'px';
  el.style.background = note.color || '#fef9c3';
  el.dataset.authorId = note.authorId;
  el.dataset.dragged  = 'false';

  el.innerHTML = `
    <div class="note-pin"><div class="pin-head"></div><div class="pin-needle"></div></div>
    <div class="note-header">
      <span class="note-author">${esc(note.authorName || 'Anon')}</span>
      <div class="note-btns">${editBtnsHTML(canEdit(note))}</div>
    </div>
    <div class="note-content"></div>
    <div class="note-time">${fmtTs(note.updatedAt || note.createdAt)}</div>`;

  setNoteCardContent(el.querySelector('.note-content'), note);
  wireNoteButtons(el, id, note);

  if (canEdit(note)) makeDraggable(el, id);
  else el.style.cursor = 'pointer';

  el.addEventListener('click', e => {
    if (e.target.closest('[data-action]')) return;
    if (e.target.tagName === 'IMG') return;
    if (el.dataset.dragged === 'true') return;
    if (CONNECT_MODE) { handleNoteConnectClick(id, el); return; }
    openNoteDetail(el, note);
  });

  // Right-CLICK opens the note's context menu; a right-DRAG still pans the
  // board (setupBoardPan owns that), so only a stationary click counts.
  el.addEventListener('mousedown', e => { if (e.button === 2) { el._rcx = e.clientX; el._rcy = e.clientY; } });
  el.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    if (Math.hypot(e.clientX - (el._rcx ?? e.clientX), e.clientY - (el._rcy ?? e.clientY)) > 6) return;
    openNoteMenu(e.clientX, e.clientY, id);
  });

  document.getElementById('board').appendChild(el);
  expandBoardIfNeeded(el);
}

// ── Note context menu (right-click on a note) ─────────────────
function closeNoteMenu() { document.getElementById('noteCtxMenu')?.remove(); }
function openNoteMenu(x, y, noteId) {
  closeNoteMenu(); closeBoardMenu();
  const note = NOTES_MAP.get(noteId);
  if (!note) return;
  const canWrite = MY_ROLE !== 'viewer' && !(ME.isAnonymous && MY_ROLE !== 'owner');
  const items = [];
  items.push(`<button class="context-menu-item" data-act="open">👁 Otevřít</button>`);
  if (canEdit(note))  items.push(`<button class="context-menu-item" data-act="edit">✏️ Upravit</button>`);
  if (canWrite)       items.push(`<button class="context-menu-item" data-act="dup">📄 Duplikovat</button>`);
  if (canWrite)       items.push(`<button class="context-menu-item" data-act="move">📁 Přesunout do složky</button>`);
  items.push(`<button class="context-menu-item" data-act="fact">🔎 Ověřit fakta</button>`);
  items.push(`<button class="context-menu-item" data-act="export">⬇️ Exportovat tuhle poznámku</button>`);
  if (canEdit(note))  items.push(`<button class="context-menu-item" data-act="del" style="color:#fca5a5;">🗑️ Smazat</button>`);

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'noteCtxMenu';
  menu.innerHTML = items.join('');
  document.body.appendChild(menu);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth)   menu.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';

  menu.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    closeNoteMenu();
    if (act === 'open') openNoteDetail(document.getElementById('n-' + noteId), note);
    else if (act === 'edit') openEdit(noteId, note);
    else if (act === 'dup')  duplicateNote(noteId);
    else if (act === 'move') openMoveToFolderModal(noteId);
    else if (act === 'fact') factCheckNote(noteId);
    else if (act === 'export') openExportModal(new Set([noteId]));
    else if (act === 'del')  deleteNote(noteId);
  });
  setTimeout(() => document.addEventListener('click', closeNoteMenu, { once: true }), 0);
}

// Copy of a note placed slightly offset, authored by me (rules require
// authorId == me for non-owner creates anyway).
async function duplicateNote(noteId) {
  const note = NOTES_MAP.get(noteId);
  if (!note) return;
  try {
    const { id: _omit, ...data } = note;
    await db.collection('rooms').doc(ROOM_ID).collection('notes').add({
      ...data,
      x: (note.x || 60) + 26, y: (note.y || 60) + 26,
      authorId: ME.uid,
      authorName: ME.displayName || ME.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Poznámka zduplikována.');
  } catch (e) { toast('Chyba: ' + e.message); }
}

function patchNote(id, note) {
  const el = document.getElementById('n-' + id);
  if (!el) { renderNote(id, note); return; }

  if (!el.classList.contains('dragging')) {
    el.style.left = toRenderX(note.x) + 'px';
    el.style.top  = toRenderY(note.y) + 'px';
    expandBoardIfNeeded(el);
  }
  el.style.background = note.color || '#fef9c3';
  setNoteCardContent(el.querySelector('.note-content'), note);
  el.querySelector('.note-time').textContent = fmtTs(note.updatedAt || note.createdAt);

  const btns = el.querySelector('.note-btns');
  if (btns) {
    btns.innerHTML = editBtnsHTML(canEdit(note));
    wireNoteButtons(el, id, note);
  }
}

function editBtnsHTML(editable) {
  if (!editable) return '';
  return `
    <button class="note-btn" data-action="edit"   title="Upravit">✏️</button>
    <button class="note-btn" data-action="delete" title="Smazat">🗑️</button>`;
}

function wireNoteButtons(el, id, note) {
  el.querySelectorAll('[data-action]').forEach(btn => {
    // Remove old listeners by cloning
    const fresh = btn.cloneNode(true);
    btn.replaceWith(fresh);
    fresh.addEventListener('mousedown', e => e.stopPropagation());
    fresh.addEventListener('click', e => {
      e.stopPropagation();
      if (fresh.dataset.action === 'edit')   openEdit(id, note);
      if (fresh.dataset.action === 'delete') deleteNote(id);
    });
  });
}

// ── Board auto-expand ─────────────────────────────────────────
function expandBoardIfNeeded(noteEl) {
  const board = document.getElementById('board');
  // offsetWidth/offsetHeight (on the note AND the board) read 0 whenever an
  // ancestor is display:none — which #boardWrap is while the list view is
  // active. Adding a note from there silently under-grew the board, so
  // switching back to the board later showed that note sitting past the
  // grid-textured background in plain unstyled space. Fall back to the
  // note's known fixed CSS width/a reasonable height guess, and read the
  // board's own inline style (set here, always readable regardless of
  // visibility) instead of its live layout box.
  const noteW = noteEl.offsetWidth  || 220;
  const noteH = noteEl.offsetHeight || 160;
  const right  = parseInt(noteEl.style.left) + noteW + 400;
  const bottom = parseInt(noteEl.style.top)  + noteH + 400;
  const curW = parseInt(board.style.width)  || board.offsetWidth  || 3200;
  const curH = parseInt(board.style.height) || board.offsetHeight || 2200;
  if (right  > curW) board.style.width  = right  + 'px';
  if (bottom > curH) board.style.height = bottom + 'px';
}

// ── Drag & drop ───────────────────────────────────────────────
function makeDraggable(el, noteId) {
  el.addEventListener('mousedown', e => {
    if (e.target.closest('[data-action]')) return;
    if (e.button !== 0) return;

    const wrap     = document.getElementById('boardWrap');
    const startX   = e.clientX;
    const startY   = e.clientY;
    const startL   = parseInt(el.style.left)  || 0;
    const startT   = parseInt(el.style.top)   || 0;
    const startSL  = wrap.scrollLeft;
    const startST  = wrap.scrollTop;
    let moved      = false;
    el.dataset.dragged = 'false';

    // Group drag: when this note is part of a multi-selection, all selected
    // notes move together by the same delta.
    const group = (SELECTED.has(noteId) && SELECTED.size > 1)
      ? [...SELECTED]
          .map(gid => ({ gid, gel: document.getElementById('n-' + gid) }))
          .filter(g => g.gel)
          .map(g => ({ ...g, gl: parseInt(g.gel.style.left) || 0, gt: parseInt(g.gel.style.top) || 0 }))
      : null;

    el.classList.add('dragging');
    el.style.zIndex = 100;

    const onMove = mv => {
      moved = true;
      el.dataset.dragged = 'true';
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      if (group) {
        group.forEach(g => {
          g.gel.style.left = Math.max(0, g.gl + dx) + 'px';
          g.gel.style.top  = Math.max(0, g.gt + dy) + 'px';
          expandBoardIfNeeded(g.gel);
        });
      } else {
        el.style.left = Math.max(0, startL + dx) + 'px';
        el.style.top  = Math.max(0, startT + dy) + 'px';
        expandBoardIfNeeded(el);
      }
      redrawConnections();
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      el.classList.remove('dragging');
      el.style.zIndex = '';

      if (!moved) return;

      if (group) {
        // Persist every member; ones we can't edit just revert on snapshot.
        await Promise.all(group.map(g =>
          db.collection('rooms').doc(ROOM_ID).collection('notes').doc(g.gid).update({
            x: toStoreX(parseInt(g.gel.style.left)),
            y: toStoreY(parseInt(g.gel.style.top)),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {})));
        return;
      }

      const x = toStoreX(parseInt(el.style.left));
      const y = toStoreY(parseInt(el.style.top));
      try {
        await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId).update({
          x, y,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_) { /* silent – position reverts on next snapshot */ }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    e.preventDefault();
  });

  // Touch drag: same as the mouse path, but with an 8px movement threshold
  // so a plain tap still opens the note detail (the synthesized click after
  // touchend is suppressed via dataset.dragged only when a real drag ran).
  el.addEventListener('touchstart', e => {
    if (e.target.closest('[data-action]')) return;
    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    const startX = t0.clientX, startY = t0.clientY;
    const startL = parseInt(el.style.left) || 0;
    const startT = parseInt(el.style.top)  || 0;
    let moved = false;
    el.dataset.dragged = 'false';

    const onMove = mv => {
      const t = mv.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 8) return; // still a tap
      if (!moved) { moved = true; el.classList.add('dragging'); el.style.zIndex = 100; el.dataset.dragged = 'true'; }
      mv.preventDefault(); // dragging — don't let the board pan/scroll under it
      el.style.left = Math.max(0, startL + dx) + 'px';
      el.style.top  = Math.max(0, startT + dy) + 'px';
      expandBoardIfNeeded(el);
      redrawConnections();
    };

    const onEnd = async () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      if (!moved) return;
      el.classList.remove('dragging');
      el.style.zIndex = '';
      setTimeout(() => { el.dataset.dragged = 'false'; }, 150); // outlive the ghost click
      const x = toStoreX(parseInt(el.style.left));
      const y = toStoreY(parseInt(el.style.top));
      try {
        await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId).update({
          x, y,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (_) { /* silent – position reverts on next snapshot */ }
    };

    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
  }, { passive: true });
}

// ── ImgBB upload ──────────────────────────────────────────────
async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res  = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: formData });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Upload selhal');
  return json.data.url;
}

// ── Rich toolbar setup ────────────────────────────────────────
// ── Images inside the note editor ─────────────────────────────
// Defaults to a modest inline width instead of a full-width block, so a
// pasted screenshot doesn't swallow the note. Clicking one opens a small
// toolbar: size, how the text flows around it, and delete.
const IMG_SIZES = { s: '150px', m: '240px', l: '380px', full: '100%' };

function imgHtml(url, width) {
  return `<img src="${url}" alt="" style="width:${width || IMG_SIZES.m};max-width:100%;border-radius:6px;` +
         `float:left;margin:4px 12px 6px 0;">`;
}

function setupEditorImages(editor) {
  if (!editor || editor._imgWired) return;
  editor._imgWired = true;

  // Ctrl+V of an image: the browser would otherwise inline a multi-megabyte
  // base64 data URL straight into the note — too big for a Firestore document
  // and impossible to resize sensibly. Upload it and insert a real <img>.
  editor.addEventListener('paste', async e => {
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find(i => i.type && i.type.startsWith('image/'));
    if (!imgItem) {
      // Pasted rich text can still carry oversized images — normalise them
      // after the browser has done its insertion.
      setTimeout(() => normalizeEditorImages(editor), 0);
      return;
    }
    e.preventDefault();
    const file = imgItem.getAsFile();
    if (!file) return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    toast('Nahrávám obrázek…');
    try {
      const url = await uploadToImgBB(file);
      editor.focus();
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
      document.execCommand('insertHTML', false, imgHtml(url));
      toast('Obrázek vložen ✓');
    } catch (err) { toast('Chyba uploadu: ' + err.message); }
  });

  // Drag & drop from the file system / another tab
  editor.addEventListener('drop', async e => {
    const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    toast('Nahrávám obrázek…');
    try {
      const url = await uploadToImgBB(file);
      editor.focus();
      document.execCommand('insertHTML', false, imgHtml(url));
    } catch (err) { toast('Chyba uploadu: ' + err.message); }
  });

  editor.addEventListener('click', e => {
    if (e.target.tagName === 'IMG') { e.stopPropagation(); openImgToolbar(e.target, editor); }
    else closeImgToolbar();
  });
}

// Anything that arrived by other means (old notes, pasted HTML) still gets a
// sane width so it can't blow the layout apart.
function normalizeEditorImages(editor) {
  editor.querySelectorAll('img').forEach(img => {
    if (/^data:/i.test(img.src) && img.src.length > 200000) { img.remove(); return; }
    if (!img.style.width) { img.style.width = IMG_SIZES.m; img.style.maxWidth = '100%'; }
  });
}

function closeImgToolbar() { document.getElementById('imgToolbar')?.remove(); }

function openImgToolbar(img, editor) {
  closeImgToolbar();
  const bar = document.createElement('div');
  bar.id = 'imgToolbar';
  bar.className = 'img-toolbar';
  bar.innerHTML = `
    <span class="it-lbl">Velikost</span>
    <button data-size="s" title="Malý">S</button>
    <button data-size="m" title="Střední">M</button>
    <button data-size="l" title="Velký">L</button>
    <button data-size="full" title="Přes celou šířku">⤢</button>
    <span class="it-sep"></span>
    <span class="it-lbl">Obtékání</span>
    <button data-align="left"   title="Vlevo — text teče vpravo vedle">⬅️</button>
    <button data-align="center" title="Na střed — samostatně na řádku">⬛</button>
    <button data-align="right"  title="Vpravo — text teče vlevo vedle">➡️</button>
    <span class="it-sep"></span>
    <button data-spots="1" title="Klikací oblasti — víc odkazů na jednom obrázku">🎯 Oblasti</button>
    <span class="it-sep"></span>
    <button data-del="1" class="it-del" title="Odstranit obrázek">🗑</button>`;
  document.body.appendChild(bar);

  const place = () => {
    const r = img.getBoundingClientRect();
    bar.style.left = Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, r.left)) + 'px';
    bar.style.top  = Math.max(8, r.top - bar.offsetHeight - 8) + 'px';
  };
  place();

  const mark = () => {
    const w = img.style.width || '';
    bar.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', IMG_SIZES[b.dataset.size] === w));
    const f = img.style.float || 'none';
    const cur = f === 'left' ? 'left' : f === 'right' ? 'right' : 'center';
    bar.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('on', b.dataset.align === cur));
  };
  mark();

  bar.addEventListener('mousedown', e => e.preventDefault()); // keep the caret
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.del) { img.remove(); closeImgToolbar(); editor.focus(); return; }
    if (b.dataset.spots) { closeImgToolbar(); openHotspotEditor(img); return; }
    if (b.dataset.size) { img.style.width = IMG_SIZES[b.dataset.size]; img.style.maxWidth = '100%'; }
    if (b.dataset.align === 'left')  { img.style.cssFloat = 'left';  img.style.display = ''; img.style.margin = '4px 12px 6px 0'; }
    if (b.dataset.align === 'right') { img.style.cssFloat = 'right'; img.style.display = ''; img.style.margin = '4px 0 6px 12px'; }
    if (b.dataset.align === 'center'){ img.style.cssFloat = 'none';  img.style.display = 'block'; img.style.margin = '8px auto'; }
    mark(); place();
  });

  // Close when clicking elsewhere / scrolling away
  setTimeout(() => document.addEventListener('click', function once(ev) {
    if (ev.target.closest('#imgToolbar') || ev.target === img) { document.addEventListener('click', once, { once: true }); return; }
    closeImgToolbar();
  }, { once: true }), 0);
}




// ── Image hotspots: several clickable areas on ONE picture ────
// The areas live on the <img> itself as data-spots JSON, so they travel with
// the image through copy/paste, saving and export. Coordinates are PERCENT of
// the image box, which keeps them correct at any rendered size.
//   [{ x, y, w, h, page, label }]
let HS = null;   // { img, spots } while the editor modal is open

function hotspotsOf(img) {
  try {
    const raw = img.getAttribute('data-spots');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => s && s.page) : [];
  } catch (_) { return []; }
}

// ── Viewing: lay the areas over the picture ───────────────────
// The wrapper is built at render time, so the stored HTML stays a plain <img>.
function renderHotspots(root, note, onGo) {
  root.querySelectorAll('img[data-spots]').forEach(img => {
    if (img.parentElement?.classList.contains('hs-wrap')) return;   // already done
    const spots = hotspotsOf(img);
    if (!spots.length) return;

    const wrap = document.createElement('span');
    wrap.className = 'hs-wrap';
    img.replaceWith(wrap);
    wrap.appendChild(img);

    spots.forEach(sp => {
      const target = note ? pageById(note, sp.page) : null;
      const a = document.createElement('button');
      a.className = 'hs-area';
      a.style.cssText = `left:${sp.x}%;top:${sp.y}%;width:${sp.w}%;height:${sp.h}%;`;
      a.title = (sp.label || target?.title || 'Kapitola');
      a.innerHTML = `<span class="hs-tip">${esc(sp.label || target?.title || 'Kapitola')}</span>`;
      a.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        onGo(sp.page);
      });
      wrap.appendChild(a);
    });
  });
}

// ── Editing ───────────────────────────────────────────────────
function openHotspotEditor(img) {
  const note = NOTES_MAP.get(EDIT_ID || GUIDE?.noteId);
  if (!note || !pagesOf(note).length) {
    toast('Nejdřív z poznámky udělej návod (📖 v detailu) — oblasti vedou na kapitoly.');
    return;
  }
  HS = { img, spots: hotspotsOf(img) };

  const stage = document.getElementById('hsStage');
  stage.innerHTML = `<img id="hsImg" src="${esc(img.getAttribute('src'))}" alt="" draggable="false">`;
  openModal('hotspotModal');
  drawHotspotBoxes();

  const stageImg = document.getElementById('hsImg');
  let box = null, start = null;

  stage.onmousedown = e => {
    if (e.target.closest('.hs-edit-del')) return;
    const r = stageImg.getBoundingClientRect();
    if (!r.width) return;
    start = { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
    box = document.createElement('div');
    box.className = 'hs-draw';
    stage.appendChild(box);
    e.preventDefault();
  };
  stage.onmousemove = e => {
    if (!box) return;
    const r = stageImg.getBoundingClientRect();
    const cur = { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
    const x = Math.max(0, Math.min(start.x, cur.x)), y = Math.max(0, Math.min(start.y, cur.y));
    const w = Math.min(100 - x, Math.abs(cur.x - start.x)), h = Math.min(100 - y, Math.abs(cur.y - start.y));
    box.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;
    box._rect = { x, y, w, h };
  };
  stage.onmouseup = () => {
    if (!box) return;
    const rect = box._rect;
    box.remove(); box = null;
    // A stray click shouldn't create an invisible area.
    if (!rect || rect.w < 2 || rect.h < 2) return;
    pickHotspotTarget(note, rect);
  };
  stage.onmouseleave = () => { if (box) { box.remove(); box = null; } };

  document.getElementById('hsSave').onclick = saveHotspots;
}

// Chapter picker shown right after an area is drawn.
function pickHotspotTarget(note, rect) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'hsPick';
  const build = (parentId, depth) => childPages(note, parentId).map(p =>
    `<button class="context-menu-item" data-p="${esc(p.id)}" style="padding-left:${10 + depth * 14}px;">
       <span class="crumb-no">${esc(pageLabel(note, p.id))}</span> ${esc(p.title || 'Kapitola')}
     </button>` + build(p.id, depth + 1)).join('');
  menu.innerHTML = `<div class="hs-pick-h">Kam má oblast vést?</div>` + build(null, 0);
  document.body.appendChild(menu);

  const stage = document.getElementById('hsStage').getBoundingClientRect();
  menu.style.left = Math.min(window.innerWidth - menu.offsetWidth - 8, stage.left + 20) + 'px';
  menu.style.top  = Math.min(window.innerHeight - menu.offsetHeight - 8, stage.top + 40) + 'px';

  const close = () => menu.remove();
  menu.addEventListener('click', e => {
    const id = e.target.closest('[data-p]')?.dataset.p;
    if (!id) return;
    const page = pageById(note, id);
    HS.spots.push({ ...rect, page: id, label: page?.title || 'Kapitola' });
    close();
    drawHotspotBoxes();
  });
  setTimeout(() => document.addEventListener('click', function once(ev) {
    if (ev.target.closest('#hsPick')) { document.addEventListener('click', once, { once: true }); return; }
    close();
  }, { once: true }), 0);
}

function drawHotspotBoxes() {
  const stage = document.getElementById('hsStage');
  stage.querySelectorAll('.hs-edit').forEach(n => n.remove());
  HS.spots.forEach((sp, i) => {
    const b = document.createElement('div');
    b.className = 'hs-edit';
    b.style.cssText = `left:${sp.x}%;top:${sp.y}%;width:${sp.w}%;height:${sp.h}%;`;
    b.innerHTML = `<span class="hs-edit-label">${esc(sp.label || '')}</span>` +
                  `<button class="hs-edit-del" data-i="${i}" title="Odebrat oblast">✕</button>`;
    b.querySelector('.hs-edit-del').addEventListener('click', e => {
      e.stopPropagation();
      HS.spots.splice(i, 1);
      drawHotspotBoxes();
    });
    stage.appendChild(b);
  });

  const list = document.getElementById('hsList');
  list.innerHTML = HS.spots.length
    ? `<div class="hs-list-h">${HS.spots.length} ${HS.spots.length === 1 ? 'oblast' : HS.spots.length < 5 ? 'oblasti' : 'oblastí'}</div>` +
      HS.spots.map((s, i) => `<div class="hs-row"><span>${esc(s.label || 'Kapitola')}</span>
        <button class="hs-row-del" data-i="${i}">Odebrat</button></div>`).join('')
    : '<div class="hs-list-h">Zatím žádná oblast — nakresli ji tažením přes obrázek.</div>';
  list.querySelectorAll('.hs-row-del').forEach(b => b.addEventListener('click', () => {
    HS.spots.splice(+b.dataset.i, 1);
    drawHotspotBoxes();
  }));
}

function saveHotspots() {
  if (!HS) return;
  if (HS.spots.length) {
    HS.img.setAttribute('data-spots', JSON.stringify(HS.spots.map(s => ({
      x: +s.x.toFixed(2), y: +s.y.toFixed(2), w: +s.w.toFixed(2), h: +s.h.toFixed(2),
      page: s.page, label: s.label || '',
    }))));
  } else {
    HS.img.removeAttribute('data-spots');
  }
  closeModal('hotspotModal');
  toast(HS.spots.length ? `Uloženo ${HS.spots.length} oblastí — nezapomeň uložit kapitolu.` : 'Oblasti odebrány.');
  HS = null;
}

// ── Guides: a tree of chapters inside ONE note ────────────────
// A note may carry `pages: [{id, title, parentId, content}]`. Without that
// field it is an ordinary note and behaves exactly as before — nothing to
// migrate. Chapters nest to any depth and link to each other from the text
// (or from an image), which is what makes a click-through guide possible:
//   1  Role serveru
//     1.a  Web Server (IIS)   <- reached by clicking "IIS" in chapter 1
//     1.b  DNS
//       1.b.a  Zóny
let GUIDE = null;   // { noteId, pageId, history: [] } while a guide is open

const pagesOf = note => (Array.isArray(note?.pages) ? note.pages : []);
const pageById = (note, id) => pagesOf(note).find(p => p.id === id) || null;
const childPages = (note, parentId) => pagesOf(note).filter(p => (p.parentId || null) === (parentId || null));
const rootPages = note => childPages(note, null);

function newPageId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// "1.b.a" style label, built from the chapter's position in the tree.
function pageLabel(note, pageId) {
  const path = pagePath(note, pageId);
  return path.map((p, depth) => {
    const sibs = childPages(note, p.parentId || null);
    const i = sibs.findIndex(x => x.id === p.id);
    return depth === 0 ? String(i + 1) : String.fromCharCode(97 + (i % 26));
  }).join('.');
}

// Chain from the root chapter down to this one (guards a broken parent link).
function pagePath(note, pageId) {
  const out = [];
  const seen = new Set();
  let p = pageById(note, pageId);
  while (p && !seen.has(p.id)) {
    seen.add(p.id);
    out.unshift(p);
    p = p.parentId ? pageById(note, p.parentId) : null;
  }
  return out;
}

async function savePages(noteId, pages) {
  await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId).update({
    pages,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  // Update the local copy straight away. Without this every caller renders
  // BEFORE the Firestore snapshot lands, finds no chapters and bails out —
  // which is exactly why "make this a guide" and "add a subchapter" looked
  // like they did nothing at all.
  const n = NOTES_MAP.get(noteId);
  if (n) n.pages = pages;
}

// Create a guide straight away — the board's own "add a guide" action, so
// you don't have to make a note first and convert it. It IS still a note
// document underneath (that's what keeps permissions, search, export, AI and
// comments working without a second implementation), it just starts life
// with chapters and shows up on the board as a guide.
async function createGuide(storeX, storeY) {
  const canWrite = MY_ROLE !== 'viewer' && !(ME.isAnonymous && MY_ROLE !== 'owner');
  if (!canWrite) { toast('Návod může přidat jen editor.'); return; }
  const title = prompt('Název návodu:', 'Nový návod');
  if (title === null) return;
  const first = { id: newPageId(), title: 'Úvod', parentId: null, content: '', links: [] };
  const data = {
    title: (title || 'Nový návod').trim(),
    content: '', contentType: 'html',
    color: '#ede9fe',                         // guides get their own colour
    pages: [first],
    x: Math.round(storeX), y: Math.round(storeY),
    authorId: ME.uid, authorName: ME.displayName || ME.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    const ref = await db.collection('rooms').doc(ROOM_ID).collection('notes').add(data);
    logActivity('note', `vytvořil návod „${data.title}"`);
    // Seed the local map with what we just wrote instead of waiting on the
    // snapshot — otherwise opening it here races the round-trip and silently
    // does nothing (the same trap that broke "make this a guide").
    // serverTimestamp() is a sentinel with no value yet — swap in a local
    // date for the seeded copy, or the detail shows "Invalid Date" until the
    // snapshot arrives.
    const now = new Date();
    const note = { id: ref.id, ...data, createdAt: now, updatedAt: now };
    NOTES_MAP.set(ref.id, note);
    GUIDE = { noteId: ref.id, pageId: first.id, history: [] };
    openNoteDetail(document.getElementById('n-' + ref.id), note);
    openGuideMap();
  } catch (e) { toast('Chyba: ' + e.message); }
}

// Turn a plain note into a guide: its current content becomes chapter 1.
async function convertToGuide(noteId) {
  const note = NOTES_MAP.get(noteId);
  if (!note || pagesOf(note).length) return;
  const first = { id: newPageId(), title: note.title || 'Úvod', parentId: null, content: note.content || '' };
  try {
    await savePages(noteId, [first]);
    toast('Z poznámky je návod — přidej podkapitoly ＋');
    GUIDE = { noteId, pageId: first.id, history: [] };
    renderGuide();
  } catch (e) { toast('Chyba: ' + e.message); }
}

// ── Rendering ─────────────────────────────────────────────────
function renderGuide() {
  const note = NOTES_MAP.get(GUIDE.noteId);
  const pages = pagesOf(note);
  if (!pages.length) return;
  if (!pageById(note, GUIDE.pageId)) GUIDE.pageId = pages[0].id;
  const page = pageById(note, GUIDE.pageId);

  document.getElementById('guideBar').style.display = 'flex';
  document.getElementById('guideBack').style.visibility = GUIDE.history.length ? 'visible' : 'hidden';

  // Breadcrumbs: 1 > 1.b > 1.b.a — every step clickable
  const crumbs = document.getElementById('guideCrumbs');
  crumbs.innerHTML = pagePath(note, page.id).map(p =>
    `<button class="crumb" data-go="${esc(p.id)}"><span class="crumb-no">${esc(pageLabel(note, p.id))}</span> ${esc(p.title || 'Kapitola')}</button>`
  ).join('<span class="crumb-sep">›</span>');

  renderGuideTree(note);

  const contentEl = document.getElementById('detailContent');
  contentEl.innerHTML = page.content || '<p style="color:var(--text-muted);">Zatím prázdná kapitola.</p>';
  const h = document.createElement('h4');
  h.className = 'note-detail-title';
  h.textContent = (pageLabel(note, page.id) + '  ' + (page.title || 'Kapitola')).trim();
  contentEl.prepend(h);
  addImageClickHandlers(contentEl);
  wirePageLinks(contentEl);
  renderHotspots(contentEl, note, goToPage);

  // Named links first — these are the ones drawn in the map editor.
  const named = linksOf(page);
  if (named.length) {
    const box = document.createElement('div');
    box.className = 'guide-kids';
    box.innerHTML = '<div class="guide-kids-h">Odkazy</div>' + named.map(l => {
      const t = pageById(note, l.to);
      return t ? `<button class="guide-kid" data-go="${esc(l.to)}">
          <span class="crumb-no">${esc(pageLabel(note, l.to))}</span>
          <span>🔗 ${esc(l.label || t.title || 'Odkaz')}</span><span class="guide-kid-arrow">›</span>
        </button>` : '';
    }).join('');
    contentEl.appendChild(box);
  }

  // Chapters directly below this one, as ready-made buttons — so a guide is
  // click-through even before any links are written into the text.
  const kids = childPages(note, page.id);
  if (kids.length) {
    const box = document.createElement('div');
    box.className = 'guide-kids';
    box.innerHTML = '<div class="guide-kids-h">Podkapitoly</div>' + kids.map(k =>
      `<button class="guide-kid" data-go="${esc(k.id)}">
         <span class="crumb-no">${esc(pageLabel(note, k.id))}</span>
         <span>${esc(k.title || 'Kapitola')}</span><span class="guide-kid-arrow">›</span>
       </button>`).join('');
    contentEl.appendChild(box);
  }
  contentEl.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => goToPage(b.dataset.go)));
  crumbs.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => goToPage(b.dataset.go, true)));
}

function renderGuideTree(note) {
  const tree = document.getElementById('guideTree');
  const build = (parentId, depth) => childPages(note, parentId).map(p => {
    const kids = build(p.id, depth + 1);
    return `<button class="gt-item${p.id === GUIDE.pageId ? ' on' : ''}" data-go="${esc(p.id)}" style="--d:${depth}">
        <span class="crumb-no">${esc(pageLabel(note, p.id))}</span> ${esc(p.title || 'Kapitola')}
      </button>` + kids;
  }).join('');
  tree.innerHTML = build(null, 0);
  tree.querySelectorAll('[data-go]').forEach(b =>
    b.addEventListener('click', () => goToPage(b.dataset.go)));
}

function goToPage(pageId, viaCrumb) {
  if (!GUIDE || pageId === GUIDE.pageId) return;
  if (viaCrumb) {
    // stepping back up the path — trim the trail instead of growing it
    const i = GUIDE.history.indexOf(pageId);
    GUIDE.history = i >= 0 ? GUIDE.history.slice(0, i) : [];
  } else {
    GUIDE.history.push(GUIDE.pageId);
  }
  GUIDE.pageId = pageId;
  renderGuide();
  document.getElementById('detailContent').scrollTop = 0;
}

// Links written into the text: <a data-page="ID">…</a>
function wirePageLinks(root) {
  root.querySelectorAll('[data-page]').forEach(a => {
    a.classList.add('page-link');
    a.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      goToPage(a.dataset.page);
    });
  });
}

// ── Editing ───────────────────────────────────────────────────
// Add a chapter under `parentId` (null = a new top-level chapter).
async function addChapter(parentId, title) {
  if (!GUIDE) return null;
  const note = NOTES_MAP.get(GUIDE.noteId);
  if (!canEdit(note)) { toast('Upravit může jen autor nebo vlastník.'); return null; }
  const page = { id: newPageId(), title: (title || 'Nová kapitola').trim(),
                 parentId: parentId || null, content: '', links: [] };
  try {
    await savePages(GUIDE.noteId, [...pagesOf(note), page]);
    return page;
  } catch (e) { toast('Chyba: ' + e.message); return null; }
}

async function addSubChapter() {
  if (!GUIDE) return;
  const title = prompt('Název podkapitoly:');
  if (title === null) return;
  const page = await addChapter(GUIDE.pageId, title);
  if (page) goToPage(page.id);
}

function editCurrentChapter() {
  if (!GUIDE) return;
  const note = NOTES_MAP.get(GUIDE.noteId);
  if (!canEdit(note)) { toast('Upravit může jen autor nebo vlastník.'); return; }
  const page = pageById(note, GUIDE.pageId);
  if (!page) return;
  EDIT_ID = note.id;
  EDIT_PAGE_ID = page.id;                       // edit modal saves into this chapter
  document.getElementById('noteTitleInputEdit').value = page.title || '';
  document.getElementById('noteEditorEdit').innerHTML = page.content || '';
  document.getElementById('editModalTitle').textContent = 'Upravit kapitolu';
  openModal('editModal');
}


// ── Guide map: the visual editor ──────────────────────────────
// The chapter tree drawn as cards with arrows, the way you'd sketch a manual
// on a whiteboard. Structure (parent → child) is drawn as a plain arrow;
// a NAMED cross-link gets its own labelled arrow, so "click this role → its
// setup steps" is visible at a glance instead of being buried in the text.
//
// Named links live on the page as `links: [{to, label}]`, which keeps them
// editable here without touching the chapter's HTML. Inline <a data-page>
// links written into the text keep working alongside them.
const GMAP_W = 210, GMAP_H = 76;          // card size
const GMAP_GAP_X = 110, GMAP_GAP_Y = 26;  // spacing between columns / rows
let GMAP_LINK_FROM = null;                // id of the card a new link starts at

function linksOf(page) { return Array.isArray(page?.links) ? page.links : []; }

// Auto-layout: one column per depth, children stacked beside their parent.
// A page may override with its own x/y (dragged by hand).
function gmapLayout(note) {
  const pos = new Map();
  let cursorY = 0;
  const place = (parentId, depth) => {
    childPages(note, parentId).forEach(p => {
      const top = cursorY;
      place(p.id, depth + 1);
      // centre a parent against the block of its children
      const kids = childPages(note, p.id);
      const y = kids.length
        ? (pos.get(kids[0].id).y + pos.get(kids[kids.length - 1].id).y) / 2
        : (cursorY = Math.max(cursorY, top) , top);
      pos.set(p.id, {
        x: p.mx != null ? p.mx : depth * (GMAP_W + GMAP_GAP_X),
        y: p.my != null ? p.my : y,
        auto: p.mx == null,
      });
      if (!kids.length) cursorY = top + GMAP_H + GMAP_GAP_Y;
    });
  };
  place(null, 0);
  return pos;
}

function openGuideMap() {
  if (!GUIDE) return;
  const note = NOTES_MAP.get(GUIDE.noteId);
  if (!note) return;
  GMAP_LINK_FROM = null;
  openModal('guideMapModal');
  renderGuideMap();
}

function renderGuideMap() {
  const note = NOTES_MAP.get(GUIDE.noteId);
  if (!note) return;
  const stage = document.getElementById('gmapStage');
  const pages = pagesOf(note);
  const pos = gmapLayout(note);
  const editable = canEdit(note);

  let maxX = 0, maxY = 0;
  pos.forEach(p => { maxX = Math.max(maxX, p.x + GMAP_W); maxY = Math.max(maxY, p.y + GMAP_H); });

  // Arrows first, so cards sit on top of them.
  const arrows = [];
  pages.forEach(p => {
    const a = pos.get(p.id);
    if (!a) return;
    if (p.parentId && pos.get(p.parentId)) {
      arrows.push(gmapArrow(pos.get(p.parentId), a, '', 'struct'));
    }
    linksOf(p).forEach(l => {
      const b = pos.get(l.to);
      if (b) arrows.push(gmapArrow(a, b, l.label || 'odkaz', 'link'));
    });
  });

  stage.style.width  = (maxX + 40) + 'px';
  stage.style.height = (maxY + 40) + 'px';
  stage.innerHTML =
    `<svg class="gmap-svg" width="${maxX + 40}" height="${maxY + 40}">
       <defs>
         <marker id="gmapHead" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
           <polygon points="0 0, 9 3.5, 0 7" fill="var(--accent)"></polygon>
         </marker>
       </defs>${arrows.join('')}</svg>` +
    pages.map(p => {
      const a = pos.get(p.id);
      if (!a) return '';
      const kids = childPages(note, p.id).length;
      return `<div class="gmap-card${p.id === GUIDE.pageId ? ' on' : ''}${GMAP_LINK_FROM === p.id ? ' linking' : ''}"
            data-id="${esc(p.id)}" style="left:${a.x}px;top:${a.y}px;width:${GMAP_W}px;height:${GMAP_H}px;">
          <div class="gmap-no">${esc(pageLabel(note, p.id))}</div>
          <div class="gmap-title">${esc(p.title || 'Kapitola')}</div>
          <div class="gmap-meta">${kids ? `${kids} podkapitol` : 'kapitola'}${linksOf(p).length ? ` · ${linksOf(p).length} odkazů` : ''}</div>
          ${editable ? `<div class="gmap-tools">
            <button data-act="sub"  title="Přidat podkapitolu">＋</button>
            <button data-act="link" title="Vytvořit pojmenovaný odkaz na jinou kapitolu">🔗</button>
            <button data-act="ren"  title="Přejmenovat">✏️</button>
            <button data-act="del"  title="Smazat kapitolu">🗑</button>
          </div>` : ''}
        </div>`;
    }).join('');

  wireGuideMap(note, editable);
  document.getElementById('gmapHint').textContent = GMAP_LINK_FROM
    ? 'Klikni na kapitolu, kam má odkaz vést (Esc zruší).'
    : (pages.length ? 'Klikni na kartu = otevřít kapitolu. 🔗 = pojmenovaný odkaz jinam.' : 'Zatím žádná kapitola.');
}

// One arrow between two cards, with an optional label in the middle.
function gmapArrow(from, to, label, kind) {
  const x1 = from.x + GMAP_W, y1 = from.y + GMAP_H / 2;
  const x2 = to.x, y2 = to.y + GMAP_H / 2;
  // Route backwards links around instead of through the cards.
  const back = x2 < x1;
  const mx = back ? (x1 + 40) : (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${back ? x2 - 40 : mx} ${y2}, ${x2} ${y2}`;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - 8;
  return `<path d="${d}" class="gmap-path ${kind}" marker-end="url(#gmapHead)"></path>` +
    (label ? `<text x="${cx}" y="${cy}" class="gmap-label">${esc(label)}</text>` : '');
}

function wireGuideMap(note, editable) {
  const stage = document.getElementById('gmapStage');

  stage.querySelectorAll('.gmap-card').forEach(card => {
    const id = card.dataset.id;

    card.addEventListener('click', e => {
      if (e.target.closest('[data-act]')) return;
      // A drag ends with mouseup AND a click on the same card; without this
      // the click opened the chapter and closed the map every time you moved
      // a card. (The flag was being set below but never read.)
      if (card._dragged) { card._dragged = false; return; }
      if (GMAP_LINK_FROM) { finishGuideLink(id); return; }
      goToPage(id);
      closeModal('guideMapModal');
    });

    card.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === 'sub') {
        const t = prompt('Název podkapitoly:');
        if (t === null) return;
        await addChapter(id, t);
        renderGuideMap();
      } else if (act === 'link') {
        GMAP_LINK_FROM = id;
        renderGuideMap();
      } else if (act === 'ren') {
        const page = pageById(note, id);
        const t = prompt('Název kapitoly:', page?.title || '');
        if (t === null) return;
        await savePages(GUIDE.noteId, pagesOf(note).map(p => p.id === id ? { ...p, title: t.trim() || p.title } : p));
        renderGuideMap();
      } else if (act === 'del') {
        await deleteChapter(id);
        renderGuideMap();
      }
    }));

    // Dragging a card fixes its position; the rest stays auto-arranged.
    if (!editable) return;
    card.addEventListener('mousedown', e => {
      if (e.target.closest('[data-act]') || GMAP_LINK_FROM) return;
      const sx = e.clientX, sy = e.clientY;
      const x0 = parseInt(card.style.left), y0 = parseInt(card.style.top);
      let moved = false;
      const mv = ev => {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        card.style.left = Math.max(0, x0 + ev.clientX - sx) + 'px';
        card.style.top  = Math.max(0, y0 + ev.clientY - sy) + 'px';
      };
      const up = async () => {
        window.removeEventListener('mousemove', mv);
        window.removeEventListener('mouseup', up);
        if (!moved) return;
        card._dragged = true;   // cleared by the click handler that follows
        const mx = parseInt(card.style.left), my = parseInt(card.style.top);
        await savePages(GUIDE.noteId, pagesOf(note).map(p => p.id === id ? { ...p, mx, my } : p));
        renderGuideMap();
      };
      window.addEventListener('mousemove', mv);
      window.addEventListener('mouseup', up);
      e.preventDefault();
    });
  });
}

// Second half of "make a link": pick the target, then name it.
async function finishGuideLink(toId) {
  const from = GMAP_LINK_FROM;
  GMAP_LINK_FROM = null;
  if (!from || from === toId) { renderGuideMap(); return; }
  const note = NOTES_MAP.get(GUIDE.noteId);
  const target = pageById(note, toId);
  const label = prompt('Jak se má odkaz jmenovat?', target?.title || 'Odkaz');
  if (label === null) { renderGuideMap(); return; }
  const pages = pagesOf(note).map(p => p.id === from
    ? { ...p, links: [...linksOf(p).filter(l => l.to !== toId), { to: toId, label: label.trim() || 'Odkaz' }] }
    : p);
  await savePages(GUIDE.noteId, pages);
  renderGuideMap();
}

// Removing a chapter re-parents its children, so nothing is orphaned, and
// clears any links that pointed at it.
async function deleteChapter(id) {
  const note = NOTES_MAP.get(GUIDE.noteId);
  const page = pageById(note, id);
  if (!page) return;
  if (!confirm(`Smazat kapitolu „${page.title || 'Kapitola'}"?\n\nPodkapitoly se přesunou o úroveň výš, text kapitoly se ztratí.`)) return;
  const pages = pagesOf(note)
    .filter(p => p.id !== id)
    .map(p => ({
      ...p,
      parentId: p.parentId === id ? (page.parentId || null) : p.parentId,
      links: linksOf(p).filter(l => l.to !== id),
    }));
  await savePages(GUIDE.noteId, pages);
  if (GUIDE.pageId === id) GUIDE.pageId = pages[0]?.id || null;
  if (!pages.length) closeModal('guideMapModal');
  renderGuide();
}

function setupGuideMap() {
  document.getElementById('gmapAddRoot')?.addEventListener('click', async () => {
    const t = prompt('Název nové hlavní kapitoly:');
    if (t === null) return;
    await addChapter(null, t);
    renderGuideMap();
  });
  document.getElementById('gmapCancelLink')?.addEventListener('click', () => {
    GMAP_LINK_FROM = null;
    renderGuideMap();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && GMAP_LINK_FROM) { GMAP_LINK_FROM = null; renderGuideMap(); }
  });
}

// ── Chapter link picker (🔗📖 in the editor toolbar) ──────────
function setupPageLinkButton(editor, toolbar) {
  const btn = toolbar.querySelector('.rt-pagelink');
  if (!btn || btn._wired) return;
  btn._wired = true;
  let saved = null;
  btn.addEventListener('mousedown', () => {
    const sel = window.getSelection();
    saved = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
  });
  btn.addEventListener('click', e => {
    e.preventDefault();
    const note = NOTES_MAP.get(EDIT_ID || GUIDE?.noteId);
    const pages = pagesOf(note);
    if (!pages.length) { toast('Nejdřív z poznámky udělej návod (📖 v detailu).'); return; }
    openPageLinkPicker(btn, note, editor, saved);
  });
}

function closePageLinkPicker() { document.getElementById('pageLinkMenu')?.remove(); }

function openPageLinkPicker(anchor, note, editor, savedRange) {
  closePageLinkPicker();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'pageLinkMenu';
  const build = (parentId, depth) => childPages(note, parentId).map(p =>
    `<button class="context-menu-item" data-p="${esc(p.id)}" style="padding-left:${10 + depth * 14}px;">
       <span class="crumb-no">${esc(pageLabel(note, p.id))}</span> ${esc(p.title || 'Kapitola')}
     </button>` + build(p.id, depth + 1)).join('');
  menu.innerHTML = build(null, 0);
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = r.left + 'px';
  menu.style.top  = (r.bottom + 4) + 'px';
  const m = menu.getBoundingClientRect();
  if (m.right > window.innerWidth)  menu.style.left = (window.innerWidth - m.width - 8) + 'px';
  if (m.bottom > window.innerHeight) menu.style.top = (r.top - m.height - 4) + 'px';

  menu.addEventListener('mousedown', e => e.preventDefault());
  menu.addEventListener('click', e => {
    const id = e.target.closest('[data-p]')?.dataset.p;
    if (!id) return;
    const page = pageById(note, id);
    closePageLinkPicker();
    editor.focus();
    if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
    const sel = window.getSelection();
    // Take the selection's CONTENTS, not its text: sel.toString() is empty for
    // an image, which would have replaced the picture with a text link instead
    // of wrapping it. cloneContents keeps the <img> (and any formatting).
    let inner = '';
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const tmp = document.createElement('div');
      tmp.appendChild(sel.getRangeAt(0).cloneContents());
      inner = tmp.innerHTML;
    }
    if (!inner) inner = '📖 ' + esc(page.title || 'Kapitola');
    document.execCommand('insertHTML', false,
      `<a href="#" data-page="${esc(id)}" class="page-link">${inner}</a>`);
  });
  setTimeout(() => document.addEventListener('click', closePageLinkPicker, { once: true }), 0);
}

// ── Wiring ────────────────────────────────────────────────────
function setupGuide() {
  document.getElementById('guideToggle').addEventListener('click', () => {
    const t = document.getElementById('guideTree');
    t.style.display = t.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('guideBack').addEventListener('click', () => {
    if (!GUIDE?.history.length) return;
    GUIDE.pageId = GUIDE.history.pop();
    renderGuide();
  });
  document.getElementById('guideAddSub').addEventListener('click', addSubChapter);
  document.getElementById('guideMapBtn')?.addEventListener('click', openGuideMap);
  setupGuideMap();
  document.getElementById('guideEdit').addEventListener('click', editCurrentChapter);
}

// ── Rich-text: lists, nesting, checklists ─────────────────────
// execCommand is deprecated but it is what this editor is built on, so the
// additions below stay in the same idiom rather than half-migrating.

// Bullet/number styles offered by the ▾ picker. The value goes straight into
// list-style-type on the nearest <ul>/<ol>, so it survives in the saved HTML.
const LIST_STYLES = [
  { v: 'disc',                 label: '• Kolečko',      ol: false },
  { v: 'circle',               label: '◦ Kroužek',      ol: false },
  { v: 'square',               label: '▪ Čtvereček',    ol: false },
  { v: '"–  "',                label: '– Pomlčka',      ol: false },
  { v: '"✓  "',                label: '✓ Fajfka',       ol: false },
  { v: '"→  "',                label: '→ Šipka',        ol: false },
  { v: 'decimal',              label: '1. Čísla',       ol: true  },
  { v: 'lower-alpha',          label: 'a. Písmena',     ol: true  },
  { v: 'upper-alpha',          label: 'A. Velká písm.', ol: true  },
  { v: 'lower-roman',          label: 'i. Římské',      ol: true  },
];

// The <li> the caret currently sits in (if any).
function currentListItem(editor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let n = sel.getRangeAt(0).startContainer;
  if (n.nodeType === 3) n = n.parentNode;
  const li = n.closest ? n.closest('li') : null;
  return (li && editor.contains(li)) ? li : null;
}

function currentList(editor) {
  const li = currentListItem(editor);
  return li ? li.parentElement : null;
}

function setupListTools(editor, toolbar) {
  if (!editor || editor._listWired) return;
  editor._listWired = true;

  // ── Tab / Shift+Tab ──
  // Inside a list this nests and un-nests, which is the whole point. Outside
  // one, Tab used to jump out of the editor entirely — now it indents.
  editor.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const li = currentListItem(editor);
    if (li) {
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      // A freshly nested level inherits its parent's style otherwise.
      applyNestedDefaults(editor);
    } else if (e.shiftKey) {
      document.execCommand('outdent');
    } else {
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });

  // Nested lists get the level-appropriate marker unless one was chosen by
  // hand (data-fixed marks a list the user styled deliberately).
  const applyNestedDefaults = () => {
    editor.querySelectorAll('ul').forEach(ul => {
      if (ul.dataset.fixed) return;
      const depth = depthOf(ul, editor);
      ul.style.listStyleType = ['disc', 'circle', 'square'][Math.min(depth, 2)];
    });
    editor.querySelectorAll('ol').forEach(ol => {
      if (ol.dataset.fixed) return;
      const depth = depthOf(ol, editor);
      ol.style.listStyleType = ['decimal', 'lower-alpha', 'lower-roman'][Math.min(depth, 2)];
    });
  };
  const depthOf = (el, root) => {
    let d = 0, p = el.parentElement;
    while (p && p !== root) { if (p.tagName === 'UL' || p.tagName === 'OL') d++; p = p.parentElement; }
    return d;
  };

  // ── ▾ bullet style picker ──
  const styleBtn = toolbar.querySelector('.rt-liststyle');
  if (styleBtn) {
    styleBtn.addEventListener('mousedown', e => e.preventDefault()); // keep the caret
    styleBtn.addEventListener('click', e => {
      e.preventDefault();
      const list = currentList(editor);
      if (!list) { toast('Nejdřív klikni do seznamu.'); return; }
      openListStylePicker(styleBtn, list, list.tagName === 'OL');
    });
  }

  // ── ☑ checklist ──
  const checkBtn = toolbar.querySelector('.rt-checklist');
  if (checkBtn) {
    checkBtn.addEventListener('mousedown', e => e.preventDefault());
    checkBtn.addEventListener('click', e => {
      e.preventDefault();
      editor.focus();
      const li = currentListItem(editor);
      if (li && li.parentElement.classList.contains('checklist')) {
        // already a checklist — turn it back into a plain one
        li.parentElement.classList.remove('checklist');
        li.parentElement.querySelectorAll('li').forEach(x => { delete x.dataset.done; });
        return;
      }
      if (!li) document.execCommand('insertUnorderedList');
      const list = currentList(editor);
      if (list) { list.classList.add('checklist'); list.dataset.fixed = '1'; list.style.listStyleType = 'none'; }
    });
  }

  // Clicking a checklist box toggles it while editing.
  editor.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li || !li.parentElement.classList.contains('checklist')) return;
    // only the marker area on the left, so text stays selectable
    if (e.clientX - li.getBoundingClientRect().left > 22) return;
    li.dataset.done = li.dataset.done ? '' : '1';
  });

  applyNestedDefaults();
}

function closeListStylePicker() { document.getElementById('listStyleMenu')?.remove(); }

function openListStylePicker(anchor, list, isOl) {
  closeListStylePicker();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'listStyleMenu';
  menu.innerHTML = LIST_STYLES.filter(s => s.ol === isOl)
    .map(s => `<button class="context-menu-item" data-v='${esc(s.v)}'>${esc(s.label)}</button>`).join('');
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = r.left + 'px';
  menu.style.top  = (r.bottom + 4) + 'px';
  const m = menu.getBoundingClientRect();
  if (m.right > window.innerWidth) menu.style.left = (window.innerWidth - m.width - 8) + 'px';
  if (m.bottom > window.innerHeight) menu.style.top = (r.top - m.height - 4) + 'px';

  menu.addEventListener('mousedown', e => e.preventDefault());
  menu.addEventListener('click', e => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v) return;
    list.style.listStyleType = v;
    list.dataset.fixed = '1';        // hand-picked — nesting must not override
    list.classList.remove('checklist');
    closeListStylePicker();
  });
  setTimeout(() => document.addEventListener('click', closeListStylePicker, { once: true }), 0);
}

// ── Highlight pen ─────────────────────────────────────────────
function setupHighlighter(editor, toolbar) {
  const input = toolbar.querySelector('.rt-hilite');
  if (!input || input._wired) return;
  input._wired = true;
  let saved = null;
  const wrap = input.closest('.rt-hi-wrap');
  wrap?.addEventListener('mousedown', () => {
    const sel = window.getSelection();
    saved = (sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;
  });
  input.addEventListener('input', () => {
    editor.focus();
    if (saved) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(saved); }
    // hiliteColor is the standard name; some engines only know backColor.
    if (!document.execCommand('hiliteColor', false, input.value)) {
      document.execCommand('backColor', false, input.value);
    }
    const a = wrap?.querySelector('.rt-hi-a');
    if (a) a.style.borderBottomColor = input.value;
  });
}

// ── Cleanup ───────────────────────────────────────────────────
// execCommand leaves <font> tags, empty spans and stray attributes behind.
// Left alone they pile up, bloat the stored HTML and look wrong in the
// export, so the content is tidied on the way OUT of the editor.
function cleanEditorHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';

  // <font color/size> -> inline styles on a span
  d.querySelectorAll('font').forEach(f => {
    const span = document.createElement('span');
    if (f.getAttribute('color')) span.style.color = f.getAttribute('color');
    const sz = f.getAttribute('size');
    if (sz) span.style.fontSize = ({ 1: '.75em', 2: '.85em', 3: '1em', 4: '1.1em', 5: '1.3em', 6: '1.5em', 7: '1.8em' })[sz] || '';
    span.innerHTML = f.innerHTML;
    f.replaceWith(span.getAttribute('style') ? span : document.createRange().createContextualFragment(f.innerHTML));
  });

  // spans that carry nothing
  d.querySelectorAll('span').forEach(sp => {
    if (!sp.getAttribute('style') && !sp.className) sp.replaceWith(...sp.childNodes);
  });

  // editing-only leftovers
  d.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  d.querySelectorAll('li').forEach(li => { if (li.dataset.done === '') delete li.dataset.done; });

  // empty paragraphs at the very end
  while (d.lastElementChild && /^(P|DIV)$/.test(d.lastElementChild.tagName) &&
         !d.lastElementChild.textContent.trim() && !d.lastElementChild.querySelector('img,hr,table')) {
    d.lastElementChild.remove();
  }
  return d.innerHTML;
}

let EDIT_PAGE_ID = null;   // when set, the edit modal writes into this chapter

function setupRichToolbar(editorId, toolbarId, colorInputId, colorAId) {
  const editor      = document.getElementById(editorId);
  const toolbar     = document.getElementById(toolbarId);
  const colorInput  = document.getElementById(colorInputId);
  const colorA      = document.getElementById(colorAId);
  let savedRange    = null;

  function saveRange() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreRange() {
    if (!savedRange) return;
    editor.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  // Format buttons: prevent blur, apply command
  toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => {
      restoreRange();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      editor.focus();
    });
  });

  // Table insert button — opens the shared #tableInsertModal instead of two
  // sequential native prompt()s (which forced a double-cancel: canceling the
  // rows prompt still popped up the cols prompt right after).
  const tableBtn = toolbar.querySelector('.rt-table-btn');
  if (tableBtn) {
    tableBtn.addEventListener('mousedown', e => e.preventDefault());
    tableBtn.addEventListener('click', () => {
      saveRange();
      openTableInsertModal(() => { restoreRange(); editor.focus(); });
    });
  }

  // Color: save range on mousedown, apply after picker closes
  if (colorInput) {
    colorInput.parentElement.addEventListener('mousedown', saveRange);
    colorInput.addEventListener('change', () => {
      restoreRange();
      document.execCommand('foreColor', false, colorInput.value);
      if (colorA) colorA.style.borderBottomColor = colorInput.value;
      editor.focus();
    });
  }

  setupEditorImages(editor);
  setupListTools(editor, toolbar);
  setupPageLinkButton(editor, toolbar);
  setupHighlighter(editor, toolbar);

  // Image upload
  const imgLabel = toolbar.querySelector('.rt-img-label');
  const fileInput = toolbar.querySelector('.rt-img-input');
  if (imgLabel && fileInput) {
    imgLabel.addEventListener('mousedown', saveRange);
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      toast('Nahrávám obrázek…');
      try {
        const url = await uploadToImgBB(file);
        restoreRange();
        document.execCommand('insertHTML', false, imgHtml(url));
        editor.focus();
        toast('Obrázek vložen!');
      } catch (e) {
        toast('Chyba uploadu: ' + e.message);
      }
    });
  }
}

// Open the "add note" modal (shared by the toolbar + the board right-click
// menu; the caller sets PENDING_ADD_POS beforehand if it wants a pinned spot).
function openAddNote() {
  document.getElementById('noteEditor').innerHTML = '';
  document.getElementById('noteTitleInput').value = '';
  openModal('addModal');
  setTimeout(() => document.getElementById('noteEditor').focus(), 80);
}

// ── Add note ──────────────────────────────────────────────────
function setupAdd() {
  let color = '#fef9c3';
  const editor = document.getElementById('noteEditor');

  // Toolbar "+" = add with no pinned position (lands in the viewport).
  document.getElementById('addBtn').addEventListener('click', () => { PENDING_ADD_POS = null; openAddNote(); });

  const noteColorCustom      = document.getElementById('noteColorCustom');
  const noteColorCustomInput = document.getElementById('noteColorCustomInput');
  noteColorCustom.dataset.color = noteColorCustomInput.value;

  document.querySelectorAll('#noteColorPicker .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#noteColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      color = sw.dataset.color;
    });
  });
  noteColorCustomInput.addEventListener('input', () => {
    noteColorCustom.dataset.color = noteColorCustomInput.value;
    noteColorCustom.style.background = noteColorCustomInput.value;
    document.querySelectorAll('#noteColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
    noteColorCustom.classList.add('selected');
    color = noteColorCustomInput.value;
  });

  setupRichToolbar('noteEditor', 'addToolbar', 'addTextColor', 'addColorA');

  document.getElementById('addSubmit').addEventListener('click', async () => {
    const content = cleanEditorHtml(editor.innerHTML);
    const title   = document.getElementById('noteTitleInput').value.trim();
    if (!editor.textContent.trim()) { toast('Poznámka nesmí být prázdná.'); return; }

    const btn = document.getElementById('addSubmit');
    btn.disabled = true;

    try {
      const wrap = document.getElementById('boardWrap');
      // A right-click "Přidat poznámku zde" pins an exact spot; otherwise the
      // note lands somewhere in the current viewport. scrollLeft/Top are in
      // rendered coords; convert to stored coords (BOARD_PAD offset).
      let x, y;
      if (PENDING_ADD_POS) {
        x = Math.round(PENDING_ADD_POS.x); y = Math.round(PENDING_ADD_POS.y);
        PENDING_ADD_POS = null;
      } else {
        x = Math.round(toStoreX(wrap.scrollLeft + 60 + Math.random() * 240));
        y = Math.round(toStoreY(wrap.scrollTop  + 60 + Math.random() * 160));
      }

      await db.collection('rooms').doc(ROOM_ID).collection('notes').add({
        content,
        contentType: 'html',
        title: title || null,
        color,
        x, y,
        authorId:   ME.uid,
        authorName: ME.displayName || ME.email,
        createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      });

      closeModal('addModal');
      editor.innerHTML = '';
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
    btn.disabled = false;
  });
}

// ── Edit note ─────────────────────────────────────────────────
function setupEdit() {
  const editColorCustom      = document.getElementById('editColorCustom');
  const editColorCustomInput = document.getElementById('editColorCustomInput');
  editColorCustom.dataset.color = editColorCustomInput.value;

  document.querySelectorAll('#editColorPicker .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });
  editColorCustomInput.addEventListener('input', () => {
    editColorCustom.dataset.color = editColorCustomInput.value;
    editColorCustom.style.background = editColorCustomInput.value;
    document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
    editColorCustom.classList.add('selected');
  });

  setupRichToolbar('noteEditorEdit', 'editToolbar', 'editTextColor', 'editColorA');

  document.getElementById('editSubmit').addEventListener('click', async () => {
    if (!EDIT_ID) return;
    const editor  = document.getElementById('noteEditorEdit');
    const content = cleanEditorHtml(editor.innerHTML);
    const title   = document.getElementById('noteTitleInputEdit').value.trim();
    const colorSw = document.querySelector('#editColorPicker .color-swatch.selected');
    const color   = colorSw ? colorSw.dataset.color : '#fef9c3';
    if (!editor.textContent.trim()) { toast('Poznámka nesmí být prázdná.'); return; }

    const btn = document.getElementById('editSubmit');
    btn.disabled = true;

    try {
      if (EDIT_PAGE_ID) {
        // Editing one chapter of a guide — the note's own content is left alone.
        const note = NOTES_MAP.get(EDIT_ID);
        const pages = pagesOf(note).map(p =>
          p.id === EDIT_PAGE_ID ? { ...p, title: title || p.title, content } : p);
        await savePages(EDIT_ID, pages);
        if (GUIDE && GUIDE.noteId === EDIT_ID) { NOTES_MAP.get(EDIT_ID).pages = pages; renderGuide(); }
      } else {
        await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(EDIT_ID).update({
          content,
          contentType: 'html',
          title: title || null,
          color,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      closeModal('editModal');
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
    btn.disabled = false;
  });
}

function openEdit(id, note) {
  EDIT_ID = id;
  EDIT_PAGE_ID = null;          // plain note edit, not a chapter
  document.getElementById('editModalTitle').textContent = 'Upravit poznámku';
  document.getElementById('noteTitleInputEdit').value = note.title || '';
  const editor = document.getElementById('noteEditorEdit');
  if (note.contentType === 'html') {
    editor.innerHTML = note.content || '';
  } else {
    editor.textContent = note.content || '';
  }

  const presetSwatches = [...document.querySelectorAll('#editColorPicker .color-swatch:not(.color-swatch-custom)')];
  const matchedPreset  = presetSwatches.find(sw => sw.dataset.color === note.color);
  presetSwatches.forEach(sw => sw.classList.remove('selected'));

  const editColorCustom      = document.getElementById('editColorCustom');
  const editColorCustomInput = document.getElementById('editColorCustomInput');
  if (matchedPreset) {
    matchedPreset.classList.add('selected');
    editColorCustom.classList.remove('selected');
  } else {
    // Note's color doesn't match any preset (e.g. picked via the custom
    // swatch before) — reflect its actual color there instead of silently
    // falling back to the first preset.
    const noteColor = note.color || '#fef9c3';
    editColorCustomInput.value = noteColor;
    editColorCustom.dataset.color = noteColor;
    editColorCustom.style.background = noteColor;
    editColorCustom.classList.add('selected');
  }

  openModal('editModal');
  setTimeout(() => editor.focus(), 80);
}

// ── Note detail ───────────────────────────────────────────────
function openNoteDetail(el, note) {
  const box = document.getElementById('noteDetailBox');
  box.style.setProperty('--note-accent', note.color || '#fef9c3');

  document.getElementById('detailAuthor').textContent = note.authorName || 'Anon';
  document.getElementById('detailTime').textContent   = fmtTs(note.updatedAt || note.createdAt);

  const contentEl = document.getElementById('detailContent');

  if (pagesOf(note).length) {
    // A guide — chapters, breadcrumbs and the tree take over the body.
    GUIDE = { noteId: note.id, pageId: pagesOf(note)[0].id, history: [] };
    renderGuide();
  } else {
    GUIDE = null;
    document.getElementById('guideBar').style.display = 'none';
    document.getElementById('guideTree').style.display = 'none';
    setNoteContent(contentEl, note);
    if (note.title) {
      const h = document.createElement('h4');
      h.className = 'note-detail-title';
      h.textContent = note.title;
      contentEl.prepend(h);
    }
    // Offer turning it into a guide — chapters with click-through links.
    if (canEdit(note)) {
      const b = document.createElement('button');
      b.className = 'make-guide-btn';
      b.textContent = '📖 Udělat z toho návod (kapitoly)';
      b.addEventListener('click', () => convertToGuide(note.id));
      contentEl.appendChild(b);
    }
  }

  loadComments(note.id);
  openModal('noteDetailModal');
}

// ── Comments on notes ─────────────────────────────────────────
// A discussion thread per note, live via a subcollection. Anyone in the room
// (viewers included) can comment without touching the note's content. Only
// the comment's author or the room owner can delete a comment.
let COMMENTS_UNSUB = null;
let DETAIL_NOTE_ID = null;

// Comment counts per note → 💬 badges on board cards and list rows, marked
// "unread" when there are more comments than the user last saw (seen counts
// live in LIST_PREFS.commentSeen). Counts load once per room open; opening a
// note refreshes its count live.
const COMMENT_COUNTS = new Map();
let _commentBackfillDone = false;

// The count is denormalised onto the note itself (`commentCount`), so it
// arrives with the notes snapshot we already pay for — no extra reads. It's
// kept accurate by increment()/decrement() when commenting and reconciled
// exactly whenever someone opens the thread.
//
// Notes created before 9.10 have no counter yet. Backfilling costs one read
// per note, so it only runs in small rooms and only once; bigger rooms just
// light their badges up as threads get opened.
const COMMENT_BACKFILL_MAX_NOTES = 25;

function syncCommentCountsFromNotes() {
  NOTES_MAP.forEach((n, id) => {
    if (typeof n.commentCount === 'number') COMMENT_COUNTS.set(id, n.commentCount);
  });
}

async function loadCommentCounts() {
  syncCommentCountsFromNotes();
  applyCommentBadges();
  if (_commentBackfillDone) return;
  _commentBackfillDone = true;

  const missing = [...NOTES_MAP.values()].filter(n => typeof n.commentCount !== 'number');
  if (!missing.length || NOTES_MAP.size > COMMENT_BACKFILL_MAX_NOTES) return;
  await Promise.all(missing.map(async n => {
    try {
      const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(n.id).collection('comments').get();
      COMMENT_COUNTS.set(n.id, snap.size);
      if (snap.size) await setNoteCommentCount(n.id, snap.size);
    } catch (_) { /* rules not published yet → no badges, no harm */ }
  }));
  applyCommentBadges();
  if (VIEW_MODE === 'list') renderNotesListView();
}

// Write the authoritative count back onto the note. Any member may do this
// (the rules allow a commentCount-only update), so viewers keep it honest too.
async function setNoteCommentCount(noteId, count) {
  try { await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId).update({ commentCount: count }); }
  catch (_) { /* not permitted / offline — badge just stays stale */ }
}

async function bumpNoteCommentCount(noteId, delta) {
  COMMENT_COUNTS.set(noteId, Math.max(0, (COMMENT_COUNTS.get(noteId) || 0) + delta));
  try {
    await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId)
      .update({ commentCount: firebase.firestore.FieldValue.increment(delta) });
  } catch (_) {}
}

// Escape, then highlight @mentions. A mention of MY name (diacritics- and
// case-insensitive prefix of my display name / email local part) gets an
// extra "to me" emphasis.
function formatCommentText(text) {
  const myNames = [ME.displayName, (ME.email || '').split('@')[0]]
    .filter(Boolean)
    .flatMap(n => n.split(/\s+/))
    .map(searchNormalize);
  return esc(text).replace(/@([\p{L}\p{N}_.-]+)/gu, (m, name) => {
    const me = myNames.some(n => n && searchNormalize(name).startsWith(n));
    return `<span class="mention${me ? ' mention-me' : ''}">${m}</span>`;
  });
}

function commentBadgeInfo(noteId) {
  const count = COMMENT_COUNTS.get(noteId) || 0;
  const seen = (LIST_PREFS.commentSeen || {})[noteId] || 0;
  return { count, unread: Math.max(0, count - seen) };
}

// Decorate the BOARD note cards (list rows bake the badge in at render time).
function applyCommentBadges() {
  NOTES_MAP.forEach((_, id) => {
    const el = document.getElementById('n-' + id);
    if (!el) return;
    const { count, unread } = commentBadgeInfo(id);
    let b = el.querySelector('.note-cbadge');
    if (!count) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'note-cbadge'; el.appendChild(b); }
    b.textContent = '💬 ' + count;
    b.classList.toggle('unread', unread > 0);
    b.title = unread ? `${unread} nových komentářů` : `${count} komentářů`;
  });
}

function setupComments() {
  const input = document.getElementById('commentInput');
  const send = document.getElementById('commentSendBtn');
  const submit = async () => {
    const text = input.value.trim();
    if (!text || !DETAIL_NOTE_ID) return;
    send.disabled = true;
    try {
      await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(DETAIL_NOTE_ID)
        .collection('comments').add({
          text,
          authorId: ME.uid,
          authorName: ME.isAnonymous ? 'Host' : (ME.displayName || ME.email || 'Uživatel'),
          authorPhoto: ME.photoURL || null,
          at: firebase.firestore.FieldValue.serverTimestamp(),
        });
      bumpNoteCommentCount(DETAIL_NOTE_ID, 1);
      input.value = '';
    } catch (e) { toast('Chyba: ' + e.message); }
    send.disabled = false;
    input.focus();
  };
  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });

  // Stop listening when the detail modal closes (close button or backdrop).
  document.querySelector('[data-close="noteDetailModal"]')?.addEventListener('click', stopComments);
  document.getElementById('noteDetailModal')?.addEventListener('click', e => {
    if (e.target.id === 'noteDetailModal') stopComments();
  });
}

function stopComments() {
  if (COMMENTS_UNSUB) { COMMENTS_UNSUB(); COMMENTS_UNSUB = null; }
  DETAIL_NOTE_ID = null;
}

function loadComments(noteId) {
  stopComments();
  DETAIL_NOTE_ID = noteId;
  const listEl = document.getElementById('commentsList');
  listEl.innerHTML = '<div class="comments-empty">Načítám…</div>';
  COMMENTS_UNSUB = db.collection('rooms').doc(ROOM_ID).collection('notes').doc(noteId)
    .collection('comments').orderBy('at', 'asc')
    .onSnapshot(snap => renderComments(snap.docs),
      () => { listEl.innerHTML = '<div class="comments-empty">Komentáře se nepodařilo načíst.</div>'; });
}

function renderComments(docs) {
  const listEl = document.getElementById('commentsList');
  if (!listEl) return;
  if (!docs.length) { listEl.innerHTML = '<div class="comments-empty">Zatím žádné komentáře. Buď první!</div>'; return; }
  listEl.innerHTML = docs.map(d => {
    const c = d.data();
    const canDel = c.authorId === ME.uid || MY_ROLE === 'owner';
    const when = c.at?.toDate ? c.at.toDate().toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="comment-row">
      <div class="comment-av">${c.authorPhoto ? `<img src="${esc(c.authorPhoto)}" alt="">` : esc(initial(c.authorName || '?'))}</div>
      <div class="comment-body">
        <div class="comment-meta"><strong>${esc(c.authorName || 'Anon')}</strong><span>${esc(when)}</span></div>
        <div class="comment-text">${formatCommentText(c.text || '')}</div>
      </div>
      ${canDel ? `<button class="comment-del" data-cid="${d.id}" title="Smazat">✕</button>` : ''}
    </div>`;
  }).join('');
  listEl.querySelectorAll('.comment-del').forEach(b => b.addEventListener('click', async () => {
    if (!DETAIL_NOTE_ID) return;
    try { await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(DETAIL_NOTE_ID).collection('comments').doc(b.dataset.cid).delete(); }
    catch (e) { toast('Chyba: ' + e.message); }
  }));
  listEl.scrollTop = listEl.scrollHeight;

  // Viewing the thread marks it read, and is our chance to reconcile the
  // denormalised counter against the real number of comments.
  if (DETAIL_NOTE_ID) {
    const nid = DETAIL_NOTE_ID;
    COMMENT_COUNTS.set(nid, docs.length);
    if (NOTES_MAP.get(nid)?.commentCount !== docs.length) setNoteCommentCount(nid, docs.length);
    if ((LIST_PREFS.commentSeen || {})[nid] !== docs.length) {
      LIST_PREFS.commentSeen[nid] = docs.length;
      persistListPrefs();
    }
    applyCommentBadges();
  }
}

// ── Export (document with functional flash cards) ─────────────
let LB_SCALE = 1;
let LB_X = 0, LB_Y = 0;
let LB_DRAGGING = false, LB_DRAG_MOVED = false;
let LB_OX = 0, LB_OY = 0; // drag origin

function applyLbTransform(img) {
  img.style.transform = `translate(${LB_X}px, ${LB_Y}px) scale(${LB_SCALE})`;
}

function updateLbCursor(img) {
  img.style.cursor = LB_DRAGGING ? 'grabbing' : (LB_SCALE > 1 ? 'grab' : 'default');
}

function openLightbox(src) {
  LB_SCALE = 1; LB_X = 0; LB_Y = 0;
  const img = document.getElementById('lightboxImg');
  img.style.transform = '';
  img.style.cursor = 'default';
  img.src = src;
  document.getElementById('lightbox').classList.add('open');
}

function setupLightbox() {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');

  function closeLb() {
    lb.classList.remove('open');
    LB_SCALE = 1; LB_X = 0; LB_Y = 0;
    img.style.transform = '';
  }

  // Background click closes (unless it was a drag)
  lb.addEventListener('click', e => {
    if (LB_DRAG_MOVED) { LB_DRAG_MOVED = false; return; }
    if (e.target !== img) closeLb();
  });
  document.getElementById('lightboxClose').addEventListener('click', closeLb);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  // Wheel zoom (centred on image)
  lb.addEventListener('wheel', e => {
    if (!lb.classList.contains('open')) return;
    e.preventDefault();
    LB_SCALE *= e.deltaY < 0 ? 1.12 : 0.9;
    LB_SCALE = Math.min(8, Math.max(0.25, LB_SCALE));
    applyLbTransform(img);
    updateLbCursor(img);
  }, { passive: false });

  // Pan drag
  img.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    LB_DRAGGING = true;
    LB_DRAG_MOVED = false;
    LB_OX = e.clientX - LB_X;
    LB_OY = e.clientY - LB_Y;
    updateLbCursor(img);
  });

  document.addEventListener('mousemove', e => {
    if (!LB_DRAGGING) return;
    LB_DRAG_MOVED = true;
    LB_X = e.clientX - LB_OX;
    LB_Y = e.clientY - LB_OY;
    applyLbTransform(img);
  });

  document.addEventListener('mouseup', () => {
    if (!LB_DRAGGING) return;
    LB_DRAGGING = false;
    updateLbCursor(img);
  });
}

// ── Delete note ───────────────────────────────────────────────
// Undo/redo for note deletion. A deletion is reversible: we snapshot the note
// doc, its connections, and which folders it was filed in, then can recreate
// all of it (same ids). Stacks are in-memory per session; the restore itself
// writes to Firestore so everyone sees it.
const NOTE_UNDO = []; // records of deleted notes (newest last)
const NOTE_REDO = []; // note ids that were undone and can be re-deleted

async function deleteNote(id) {
  if (!confirm('Opravdu chceš smazat tuto poznámku?')) return;
  await doDeleteNote(id, false);
}

async function doDeleteNote(id, fromRedo, quiet) {
  const note = NOTES_MAP.get(id);
  if (!note) return;
  const label = note.title || noteToPlainText(note).slice(0, 40) || 'poznámku';
  const roomRef = db.collection('rooms').doc(ROOM_ID);
  try {
    // Snapshot everything the delete touches, so it can be rebuilt.
    const [s1, s2] = await Promise.all([
      roomRef.collection('connections').where('fromId', '==', id).get(),
      roomRef.collection('connections').where('toId', '==', id).get(),
    ]);
    const conns = [...s1.docs, ...s2.docs].map(d => ({ id: d.id, data: d.data() }));
    const folderIds = [];
    FOLDERS_MAP.forEach(f => { if ((f.noteIds || []).includes(id)) folderIds.push(f.id); });
    const { id: _omit, ...noteData } = note;
    const record = { id, noteData, conns, folderIds, label };

    const batch = db.batch();
    batch.delete(roomRef.collection('notes').doc(id));
    conns.forEach(c => batch.delete(roomRef.collection('connections').doc(c.id)));
    folderIds.forEach(fid => batch.update(roomRef.collection('folders').doc(fid),
      { noteIds: firebase.firestore.FieldValue.arrayRemove(id) }));
    await batch.commit();

    NOTE_UNDO.push(record);
    if (!fromRedo) NOTE_REDO.length = 0; // a fresh delete invalidates redo
    logActivity('note', `smazal poznámku „${label}"`);
    if (!fromRedo && !quiet) toastAction('Poznámka smazána.', '↶ Vrátit', undoNoteDelete);
  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

async function undoNoteDelete() {
  const rec = NOTE_UNDO.pop();
  if (!rec) { toast('Není co vrátit.'); return; }
  const roomRef = db.collection('rooms').doc(ROOM_ID);
  try {
    const batch = db.batch();
    batch.set(roomRef.collection('notes').doc(rec.id), rec.noteData);
    rec.conns.forEach(c => batch.set(roomRef.collection('connections').doc(c.id), c.data));
    rec.folderIds.forEach(fid => {
      if (FOLDERS_MAP.has(fid)) batch.update(roomRef.collection('folders').doc(fid),
        { noteIds: firebase.firestore.FieldValue.arrayUnion(rec.id) });
    });
    await batch.commit();
    NOTE_REDO.push(rec.id);
    logActivity('note', `obnovil poznámku „${rec.label}"`);
    toast('Poznámka obnovena.');
  } catch (e) { toast('Chyba: ' + e.message); NOTE_UNDO.push(rec); }
}

async function redoNoteDelete() {
  const id = NOTE_REDO.pop();
  if (!id) { toast('Není co zopakovat.'); return; }
  await doDeleteNote(id, true);
  toast('Poznámka opět smazána.');
}

// ── Connections ───────────────────────────────────────────────

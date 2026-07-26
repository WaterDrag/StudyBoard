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
  if (note.title) {
    contentEl.innerHTML = `<div class="note-card-title">${esc(note.title)}</div>`;
  } else {
    setNoteContent(contentEl, note);
  }
}

function addImageClickHandlers(contentEl) {
  contentEl.querySelectorAll('img').forEach(img => {
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
        document.execCommand('insertHTML', false,
          `<img src="${url}" style="max-width:100%;border-radius:6px;margin:4px 0;display:block;" alt="">`
        );
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
    const content = editor.innerHTML;
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
    const content = editor.innerHTML;
    const title   = document.getElementById('noteTitleInputEdit').value.trim();
    const colorSw = document.querySelector('#editColorPicker .color-swatch.selected');
    const color   = colorSw ? colorSw.dataset.color : '#fef9c3';
    if (!editor.textContent.trim()) { toast('Poznámka nesmí být prázdná.'); return; }

    const btn = document.getElementById('editSubmit');
    btn.disabled = true;

    try {
      await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(EDIT_ID).update({
        content,
        contentType: 'html',
        title: title || null,
        color,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeModal('editModal');
    } catch (e) {
      toast('Chyba: ' + e.message);
    }
    btn.disabled = false;
  });
}

function openEdit(id, note) {
  EDIT_ID = id;
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
  setNoteContent(contentEl, note);
  if (note.title) {
    const h = document.createElement('h4');
    h.className = 'note-detail-title';
    h.textContent = note.title;
    contentEl.prepend(h);
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
let _commentCountsLoaded = false;

async function loadCommentCounts() {
  if (_commentCountsLoaded) return;
  _commentCountsLoaded = true;
  await Promise.all([...NOTES_MAP.keys()].map(async id => {
    try {
      const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(id).collection('comments').get();
      if (snap.size) COMMENT_COUNTS.set(id, snap.size);
    } catch (_) { /* rules not published yet → no badges, no harm */ }
  }));
  applyCommentBadges();
  if (VIEW_MODE === 'list') renderNotesListView();
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

  // Viewing the thread marks it read (and keeps the live count fresh).
  if (DETAIL_NOTE_ID) {
    COMMENT_COUNTS.set(DETAIL_NOTE_ID, docs.length);
    if ((LIST_PREFS.commentSeen || {})[DETAIL_NOTE_ID] !== docs.length) {
      LIST_PREFS.commentSeen[DETAIL_NOTE_ID] = docs.length;
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

let ME        = null;
let ROOM      = null;
let MY_ROLE   = null;
let ROOM_ID   = null;
let EDIT_ID   = null;

// Empty "breathing room" around the content: notes are STORED in their own
// coordinates (small numbers, starting near 0) but RENDERED shifted right &
// down by this much. That leaves BOARD_PAD px of empty, scrollable space to
// the left and above the content, so the board can be panned past it in
// every direction and any note centered — instead of the content being
// pinned to the top-left origin with nothing to scroll into. Only the
// store↔render boundary converts; everything reading a note's live
// el.style.left works in rendered coordinates and needs no change.
const BOARD_PAD = 1500;
const toRenderX = x => (x || 60) + BOARD_PAD;
const toRenderY = y => (y || 60) + BOARD_PAD;
const toStoreX  = renderedLeft => renderedLeft - BOARD_PAD;
const toStoreY  = renderedTop  => renderedTop  - BOARD_PAD;

// Connection state
let CONNECT_MODE  = false;
let CONNECT_FROM  = null;
let CONNECT_COLOR = '#c0392b';
let CONNECT_NAME  = '';
const CONNS_MAP   = new Map(); // connId → conn data

// View mode (board vs list)
let VIEW_MODE     = 'board';
const NOTES_MAP   = new Map(); // noteId → note data, kept in sync for the list view
const FOLDERS_MAP = new Map(); // folderId → { name, parentId, color, noteIds[], authorId }

// ── Auth guard ────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) {
    // Preserve the invite link (?id=..&code=..&role=..) through the login
    // round-trip — otherwise clicking a link while logged out would land on
    // the dashboard after signing in instead of joining the room.
    localStorage.setItem('sb_pending_redirect', window.location.href);
    window.location.href = 'index.html';
    return;
  }
  ME = user;

  ROOM_ID = new URLSearchParams(window.location.search).get('id');
  if (!ROOM_ID) { window.location.href = 'dashboard.html'; return; }

  try {
    const doc = await db.collection('rooms').doc(ROOM_ID).get();
    if (!doc.exists) throw new Error('Místnost neexistuje.');

    ROOM    = { id: doc.id, ...doc.data() };
    MY_ROLE = (ROOM.roles || {})[ME.uid];

    if (!MY_ROLE) {
      // Invite link (room.html?id=..&code=..&role=..) — join automatically
      // with the role the link-creator picked, mirroring dashboard.js's
      // code-only join flow but with an embedded role instead of always
      // defaulting to viewer.
      const params   = new URLSearchParams(window.location.search);
      const linkCode = params.get('code');
      const linkRole = params.get('role');
      const validRole = linkRole === 'editor' || linkRole === 'viewer' ? linkRole : 'viewer';

      if (linkCode && ROOM.inviteCode && linkCode === ROOM.inviteCode) {
        await doc.ref.update({
          memberIds:               firebase.firestore.FieldValue.arrayUnion(ME.uid),
          [`roles.${ME.uid}`]:     validRole,
          [`members.${ME.uid}`]:   { displayName: ME.displayName || ME.email, email: ME.email, photoURL: ME.photoURL || null },
        });
        ROOM.memberIds = [...(ROOM.memberIds || []), ME.uid];
        ROOM.roles     = { ...(ROOM.roles || {}), [ME.uid]: validRole };
        MY_ROLE = validRole;
        toast(`Připojeno jako ${roleLabel(validRole)}! 🎉`);
      } else {
        toast('Nemáš přístup k této místnosti.');
        setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
        return;
      }
    }

    document.getElementById('roomTitle').textContent = ROOM.name;
    document.title = ROOM.name + ' – StudyBoard';

    if (MY_ROLE === 'viewer') {
      document.getElementById('addBtn').style.display = 'none';
      const notice = document.createElement('div');
      notice.className   = 'viewer-notice';
      notice.textContent = '👁 Jen prohlížíš – nemůžeš přidávat poznámky';
      document.body.appendChild(notice);
    }

    setupNotes();
    setupFolders();
    setupAdd();
    setupEdit();
    setupViewToggle();
    setupTableInsertModal();
    setupConnColorModal();
    setupShare();
    setupFlashCards();
    setupAiCards();
    setupBoardPan();
    setupBoardZoom();
    setupMembers();
    setupConnections();
    setupLightbox();
    setupModalClose();
    updateMemberCount();

    // Start the view just inside the padded origin — content sits with a
    // comfortable empty margin to its left/top that can be panned into.
    const wrap = document.getElementById('boardWrap');
    wrap.scrollLeft = BOARD_PAD - 280;
    wrap.scrollTop  = BOARD_PAD - 220;

  } catch (e) {
    toast('Chyba: ' + e.message);
    setTimeout(() => (window.location.href = 'dashboard.html'), 1800);
  }
});

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
    });
}

// ── List view (a standalone "page" reachable/leavable via browser history)
// The list is driven through the History API so the mouse "back" button and
// the browser back arrow both return to the board, just like a real page —
// opening the list pushes a history entry (with ?view=list in the URL), and
// leaving it (back button, nav toggle, or browser/mouse back) pops it.
function applyView(mode) {
  VIEW_MODE = mode;
  document.getElementById('boardWrap').style.display     = mode === 'board' ? '' : 'none';
  document.getElementById('notesListView').style.display = mode === 'list'  ? '' : 'none';
  // Viewers never get connectBtn/newFolderBtn shown at all — don't undo that.
  if (MY_ROLE !== 'viewer') {
    document.getElementById('connectBtn').style.display   = mode === 'board' ? '' : 'none';
    document.getElementById('newFolderBtn').style.display = mode === 'list'  ? '' : 'none';
  }
  document.getElementById('viewToggleBtn').innerHTML = mode === 'board' ? '📋 Seznam' : '🗺️ Nástěnka';
  if (mode === 'list') { exitConnectMode(); renderNotesListView(); }
}

function goToList() {
  if (VIEW_MODE === 'list') return;
  const url = new URL(location.href);
  url.searchParams.set('view', 'list');
  history.pushState({ sbView: 'list' }, '', url);
  applyView('list');
}

function goToBoard() {
  if (VIEW_MODE === 'board') return;
  // Pop the list entry so browser/mouse "back" and this button behave
  // identically; popstate below then applies the board view.
  history.back();
}

function setupViewToggle() {
  document.getElementById('viewToggleBtn').addEventListener('click', () => {
    VIEW_MODE === 'board' ? goToList() : goToBoard();
  });
  // Top-left nav "Zpět": on the board it's the normal dashboard link; in the
  // list view it returns to the board instead (same label, context-aware).
  document.getElementById('navBackBtn').addEventListener('click', e => {
    if (VIEW_MODE === 'list') { e.preventDefault(); goToBoard(); }
  });
  window.addEventListener('popstate', e => {
    applyView(e.state && e.state.sbView === 'list' ? 'list' : 'board');
  });
  // Deep-link / refresh support: landing directly on ?view=list opens the
  // list, with a board entry seeded beneath it so back still reaches the board.
  if (new URLSearchParams(location.search).get('view') === 'list') {
    const boardUrl = new URL(location.href); boardUrl.searchParams.delete('view');
    history.replaceState({ sbView: 'board' }, '', boardUrl);
    const listUrl = new URL(location.href); listUrl.searchParams.set('view', 'list');
    history.pushState({ sbView: 'list' }, '', listUrl);
    applyView('list');
  }
}

const noteRecency = n => n.updatedAt?.toMillis?.() || n.createdAt?.toMillis?.() || 0;

// ── Folders ──────────────────────────────────────────────────
// A standalone, manual Windows-Explorer-style organization system for the
// list view — deliberately independent of board connections (propojení).
// Folder membership lives on the folder doc's noteIds[], not on the note,
// so any editor can file/move any note without needing edit rights over
// its content.
function setupFolders() {
  db.collection('rooms').doc(ROOM_ID).collection('folders')
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added' || ch.type === 'modified') FOLDERS_MAP.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
        if (ch.type === 'removed') FOLDERS_MAP.delete(ch.doc.id);
      });
      if (VIEW_MODE === 'list') renderNotesListView();
    });

  if (MY_ROLE !== 'viewer') {
    document.getElementById('newFolderBtn').addEventListener('click', () => openFolderModal(null));
  }
  setupFolderModal();
}

function folderPathLabel(folder) {
  const parts = [folder.name];
  let p = folder.parentId ? FOLDERS_MAP.get(folder.parentId) : null;
  while (p) { parts.unshift(p.name); p = p.parentId ? FOLDERS_MAP.get(p.parentId) : null; }
  return parts.join(' / ');
}

let PENDING_FOLDER_ID = null;

function openFolderModal(folderId) {
  PENDING_FOLDER_ID = folderId;
  const folder = folderId ? FOLDERS_MAP.get(folderId) : null;
  document.getElementById('folderModalTitle').textContent = folder ? 'Upravit složku' : 'Nová složka';
  document.getElementById('folderSubmit').textContent = folder ? 'Uložit' : 'Vytvořit';
  document.getElementById('folderNameInput').value = folder ? folder.name : '';
  const color = folder?.color || '#6366f1';
  document.getElementById('folderColorInput').value = color;
  document.getElementById('folderColorSwatch').style.background = color;
  document.getElementById('folderColorHex').textContent = color;
  document.getElementById('folderDeleteBtn').style.display = folder ? 'block' : 'none';

  openModal('folderModal');
}

function setupFolderModal() {
  const colorInput = document.getElementById('folderColorInput');
  colorInput.addEventListener('input', () => {
    document.getElementById('folderColorSwatch').style.background = colorInput.value;
    document.getElementById('folderColorHex').textContent = colorInput.value;
  });

  document.getElementById('folderSubmit').addEventListener('click', async () => {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) { toast('Zadej název složky.'); return; }
    const color = colorInput.value;
    const foldersCol = db.collection('rooms').doc(ROOM_ID).collection('folders');
    try {
      if (PENDING_FOLDER_ID) {
        // Only name/color here — the folder's nesting (parentId) is changed
        // by dragging it in the list, not from this dialog.
        await foldersCol.doc(PENDING_FOLDER_ID).update({ name, color });
      } else {
        // New folders start at the top level; drag them into a parent after.
        await foldersCol.add({
          name, parentId: null, color, noteIds: [],
          authorId: ME.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      closeModal('folderModal');
      toast('Uloženo!');
    } catch (e) { toast('Chyba: ' + e.message); }
  });

  document.getElementById('folderDeleteBtn').addEventListener('click', () => {
    const folderId = PENDING_FOLDER_ID;
    if (!folderId) return;
    closeModal('folderModal');
    confirmModal('Smazat složku? Poznámky uvnitř zůstanou, jen se z ní vyjmou.', async () => {
      try {
        const folder = FOLDERS_MAP.get(folderId);
        const foldersCol = db.collection('rooms').doc(ROOM_ID).collection('folders');
        const batch = db.batch();
        // Reparent any child folders to this one's own parent instead of
        // orphaning them.
        FOLDERS_MAP.forEach(f => {
          if (f.parentId === folderId) batch.update(foldersCol.doc(f.id), { parentId: folder?.parentId || null });
        });
        batch.delete(foldersCol.doc(folderId));
        await batch.commit();
      } catch (e) { toast('Chyba: ' + e.message); }
    });
  });
}

// Shared by the click-through modal and drag-and-drop — moves a note into
// targetFolderId (or unfiles it if null), removing it from wherever it
// currently sits first.
async function moveNoteToFolder(noteId, targetFolderId) {
  try {
    const foldersCol = db.collection('rooms').doc(ROOM_ID).collection('folders');
    const batch = db.batch();
    FOLDERS_MAP.forEach(f => {
      if ((f.noteIds || []).includes(noteId)) batch.update(foldersCol.doc(f.id), { noteIds: firebase.firestore.FieldValue.arrayRemove(noteId) });
    });
    if (targetFolderId) batch.update(foldersCol.doc(targetFolderId), { noteIds: firebase.firestore.FieldValue.arrayUnion(noteId) });
    await batch.commit();
    toast(targetFolderId ? 'Přesunuto!' : 'Vyjmuto ze složky.');
  } catch (e) { toast('Chyba: ' + e.message); }
}

function openMoveToFolderModal(noteId) {
  const listEl = document.getElementById('moveToFolderList');
  const currentFolder = [...FOLDERS_MAP.values()].find(f => (f.noteIds || []).includes(noteId));
  const folders = [...FOLDERS_MAP.values()].sort((a, b) => folderPathLabel(a).localeCompare(folderPathLabel(b), 'cs'));

  if (!folders.length) {
    listEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;text-align:center;">Zatím žádné složky — vytvoř je tlačítkem "📁+ Složka" v horní liště.</div>`;
  } else {
    listEl.innerHTML = `
      <div class="move-to-folder-row${!currentFolder ? ' current' : ''}" data-folder="">🚫 Bez složky</div>
      ${folders.map(f => `
        <div class="move-to-folder-row${currentFolder?.id === f.id ? ' current' : ''}" data-folder="${f.id}" style="--row-color:${f.color || '#6366f1'}">
          📁 ${esc(folderPathLabel(f))}
        </div>`).join('')}`;
  }

  listEl.querySelectorAll('.move-to-folder-row').forEach(row => {
    row.addEventListener('click', () => {
      const targetFolderId = row.dataset.folder || null;
      closeModal('moveToFolderModal');
      moveNoteToFolder(noteId, targetFolderId);
    });
  });

  openModal('moveToFolderModal');
}

function renderNotesListView() {
  const el = document.getElementById('notesListBody');
  const notes = [...NOTES_MAP.values()];

  if (!notes.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">Zatím žádné poznámky.</div>`;
    return;
  }

  const filedIds = new Set();
  FOLDERS_MAP.forEach(f => (f.noteIds || []).forEach(id => filedIds.add(id)));

  const folderSubtreeCount = folder => {
    const children = [...FOLDERS_MAP.values()].filter(f => f.parentId === folder.id);
    return (folder.noteIds || []).length + children.reduce((sum, c) => sum + folderSubtreeCount(c), 0);
  };

  function renderFolderNode(folder) {
    const children = [...FOLDERS_MAP.values()].filter(f => f.parentId === folder.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    const ownNotes = (folder.noteIds || []).map(id => NOTES_MAP.get(id)).filter(Boolean)
      .sort((a, b) => noteRecency(b) - noteRecency(a));
    const canManage = MY_ROLE !== 'viewer';
    const body = ownNotes.map(renderNoteListRow).join('') + children.map(renderFolderNode).join('');
    return `
      <details class="notes-folder" open data-folder-id="${folder.id}" style="--folder-color:${folder.color || '#6366f1'}">
        <summary class="notes-folder-summary">
          <span class="notes-folder-icon">📁</span>
          <span class="notes-folder-title">${esc(folder.name)}</span>
          <span class="notes-folder-count">${folderSubtreeCount(folder)}</span>
          ${canManage ? `<button class="notes-folder-edit" data-edit-folder="${folder.id}" title="Upravit složku">✏️</button>` : ''}
        </summary>
        <div class="notes-folder-body">${body}</div>
      </details>`;
  }

  const topFolders = [...FOLDERS_MAP.values()].filter(f => !f.parentId || !FOLDERS_MAP.has(f.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const unfiled = notes.filter(n => !filedIds.has(n.id)).sort((a, b) => noteRecency(b) - noteRecency(a));

  el.innerHTML = topFolders.map(renderFolderNode).join('') + unfiled.map(renderNoteListRow).join('');
  if (!topFolders.length && !unfiled.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">Zatím žádné poznámky.</div>`;
  }

  el.querySelectorAll('.notes-list-row').forEach(row => {
    row.addEventListener('click', () => {
      const note = NOTES_MAP.get(row.dataset.id);
      if (note) openNoteDetail(null, note);
    });
  });
  el.querySelectorAll('.notes-move-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openMoveToFolderModal(btn.dataset.moveNote);
    });
  });
  el.querySelectorAll('.notes-folder-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openFolderModal(btn.dataset.editFolder);
    });
  });

  if (MY_ROLE !== 'viewer') setupListDragDrop(el);
}

// Is `folderId` the same as, or nested somewhere under, `ancestorId`?
// Used to forbid dropping a folder into itself or one of its own children
// (which would orphan a whole subtree into an unreachable cycle).
function isFolderInside(folderId, ancestorId) {
  let f = FOLDERS_MAP.get(folderId);
  while (f) {
    if (f.id === ancestorId) return true;
    f = f.parentId ? FOLDERS_MAP.get(f.parentId) : null;
  }
  return false;
}

async function moveFolderToParent(folderId, parentId) {
  if (parentId && isFolderInside(parentId, folderId)) { toast('Nelze vložit složku do sebe.'); return; }
  const cur = FOLDERS_MAP.get(folderId);
  if (!cur || (cur.parentId || null) === (parentId || null)) return; // no change
  try {
    await db.collection('rooms').doc(ROOM_ID).collection('folders').doc(folderId).update({ parentId: parentId || null });
    toast('Složka přesunuta!');
  } catch (e) { toast('Chyba: ' + e.message); }
}

// What's currently being dragged — set on dragstart so dragover (where
// dataTransfer contents aren't readable in most browsers) can validate drop
// targets, e.g. reject a folder dropped onto its own descendant.
let DRAGGING = null; // { type: 'note' | 'folder', id }

// Drag a note row OR a whole folder onto a folder to file/nest it — a
// faster alternative to the 📁 button / the parent-folder dropdown.
// Per-render this just (re)marks rows/folder headers as draggable; the
// container-level dragover/drop listeners are attached ONCE (see
// LIST_DND_WIRED) on the full-height #notesListView, NOT on #notesListBody:
//   - once, because renderNotesListView re-runs on every snapshot and would
//     otherwise stack a new set of listeners each time;
//   - on the full-height container, because dropping in the empty area BELOW
//     the content (the natural place to drop when pulling something OUT of a
//     folder to the top level) is outside #notesListBody's short box and was
//     silently ignored.
let LIST_DND_WIRED = false;
function setupListDragDrop(body) {
  body.querySelectorAll('.notes-list-row').forEach(row => {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', e => {
      e.stopPropagation();
      DRAGGING = { type: 'note', id: row.dataset.id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'note:' + row.dataset.id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); DRAGGING = null; });
  });

  body.querySelectorAll('.notes-folder-summary').forEach(sum => {
    sum.setAttribute('draggable', 'true');
    const folderEl = sum.closest('.notes-folder');
    sum.addEventListener('dragstart', e => {
      e.stopPropagation();
      DRAGGING = { type: 'folder', id: folderEl.dataset.folderId };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'folder:' + folderEl.dataset.folderId);
      folderEl.classList.add('dragging');
    });
    sum.addEventListener('dragend', () => { folderEl.classList.remove('dragging'); DRAGGING = null; });
  });

  if (LIST_DND_WIRED) return;
  LIST_DND_WIRED = true;
  const container = document.getElementById('notesListView');

  // A folder target is invalid for a folder-drag if it IS the dragged folder
  // or one of its descendants.
  const targetValid = targetFolderEl => {
    if (!DRAGGING || DRAGGING.type !== 'folder' || !targetFolderEl) return true;
    return !isFolderInside(targetFolderEl.dataset.folderId, DRAGGING.id);
  };

  let lastDragOverFolder = null;
  const clearHighlight = () => { lastDragOverFolder?.classList.remove('drag-over'); lastDragOverFolder = null; };

  container.addEventListener('dragover', e => {
    if (!DRAGGING) return; // ignore drags that didn't start in the list
    const folderEl = e.target.closest('.notes-folder');
    if (!targetValid(folderEl)) { e.dataTransfer.dropEffect = 'none'; clearHighlight(); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (folderEl !== lastDragOverFolder) {
      clearHighlight();
      folderEl?.classList.add('drag-over');
      lastDragOverFolder = folderEl;
    }
  });
  container.addEventListener('dragleave', e => { if (!container.contains(e.relatedTarget)) clearHighlight(); });
  container.addEventListener('drop', e => {
    e.preventDefault();
    clearHighlight();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const folderEl = e.target.closest('.notes-folder');
    const targetId = folderEl ? folderEl.dataset.folderId : null;
    if (data.startsWith('note:')) {
      moveNoteToFolder(data.slice(5), targetId);
    } else if (data.startsWith('folder:')) {
      const draggedId = data.slice(7);
      if (targetId && isFolderInside(targetId, draggedId)) return; // invalid, ignore
      moveFolderToParent(draggedId, targetId);
    }
  });
}

function renderNoteListRow(note) {
  const title = note.title || noteToPlainText(note).slice(0, 90) || '(prázdná poznámka)';
  const moveBtn = MY_ROLE !== 'viewer'
    ? `<button class="notes-move-btn" data-move-note="${note.id}" title="Přesunout do složky">📁</button>`
    : '';
  return `
    <div class="notes-list-row" data-id="${note.id}" style="--row-color:${note.color || '#fef9c3'}">
      <div class="notes-list-dot"></div>
      <div class="notes-list-main">
        <div class="notes-list-title">${esc(title)}</div>
        <div class="notes-list-meta">${esc(note.authorName || 'Anon')} · ${fmtTs(note.updatedAt || note.createdAt)}</div>
      </div>
      ${moveBtn}
    </div>`;
}

// ── Render note ───────────────────────────────────────────────
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

  document.getElementById('board').appendChild(el);
  expandBoardIfNeeded(el);
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

    el.classList.add('dragging');
    el.style.zIndex = 100;

    const onMove = mv => {
      moved = true;
      el.dataset.dragged = 'true';
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      el.style.left = Math.max(0, startL + dx) + 'px';
      el.style.top  = Math.max(0, startT + dy) + 'px';
      expandBoardIfNeeded(el);
      redrawConnections();
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      el.classList.remove('dragging');
      el.style.zIndex = '';

      if (!moved) return;

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

// ── Add note ──────────────────────────────────────────────────
function setupAdd() {
  let color = '#fef9c3';
  const editor = document.getElementById('noteEditor');

  document.getElementById('addBtn').addEventListener('click', () => {
    editor.innerHTML = '';
    document.getElementById('noteTitleInput').value = '';
    openModal('addModal');
    setTimeout(() => editor.focus(), 80);
  });

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
      // scrollLeft/Top are in rendered board coords; convert to stored coords
      // so the note lands in the current viewport regardless of BOARD_PAD.
      const x    = Math.round(toStoreX(wrap.scrollLeft + 60  + Math.random() * 240));
      const y    = Math.round(toStoreY(wrap.scrollTop  + 60  + Math.random() * 160));

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

  openModal('noteDetailModal');
}

// ── Lightbox ──────────────────────────────────────────────────
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
async function deleteNote(id) {
  if (!confirm('Opravdu chceš smazat tuto poznámku?')) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection('rooms').doc(ROOM_ID).collection('notes').doc(id));
    // Smaž i propojení napojená na tuto poznámku
    const [s1, s2] = await Promise.all([
      db.collection('rooms').doc(ROOM_ID).collection('connections').where('fromId', '==', id).get(),
      db.collection('rooms').doc(ROOM_ID).collection('connections').where('toId',   '==', id).get(),
    ]);
    [...s1.docs, ...s2.docs].forEach(d => batch.delete(d.ref));
    // Vyjmi ji i z případné složky
    FOLDERS_MAP.forEach(f => {
      if ((f.noteIds || []).includes(id)) {
        batch.update(db.collection('rooms').doc(ROOM_ID).collection('folders').doc(f.id),
          { noteIds: firebase.firestore.FieldValue.arrayRemove(id) });
      }
    });
    await batch.commit();
  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

// ── Connections ───────────────────────────────────────────────
function setupConnections() {
  // SVG overlay inside the board
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'connSvg';
  svg.setAttribute('class', 'conn-svg');
  document.getElementById('board').prepend(svg);

  const btn = document.getElementById('connectBtn');
  if (MY_ROLE === 'viewer') {
    btn.style.display = 'none';
  } else {
    btn.addEventListener('click', () => CONNECT_MODE ? exitConnectMode() : enterConnectMode());
  }

  document.getElementById('connectCancel').addEventListener('click', exitConnectMode);
  document.getElementById('connectColorPicker').addEventListener('input', e => { CONNECT_COLOR = e.target.value; });
  document.getElementById('connectNameInput').addEventListener('input', e => { CONNECT_NAME = e.target.value; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && CONNECT_MODE) exitConnectMode(); });

  db.collection('rooms').doc(ROOM_ID).collection('connections')
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added' || ch.type === 'modified') CONNS_MAP.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
        if (ch.type === 'removed') CONNS_MAP.delete(ch.doc.id);
      });
      redrawConnections();
      if (VIEW_MODE === 'list') renderNotesListView();
    });
}

function enterConnectMode() {
  CONNECT_MODE = true; CONNECT_FROM = null;
  document.getElementById('connectBtn').classList.add('btn-active');
  document.getElementById('board').classList.add('connect-mode');
  document.getElementById('connectHint').classList.add('visible');
  document.getElementById('connectHintText').textContent = 'Klikni na první poznámku…';
}

function exitConnectMode() {
  CONNECT_MODE = false; CONNECT_FROM = null;
  document.getElementById('connectBtn').classList.remove('btn-active');
  document.getElementById('board').classList.remove('connect-mode');
  document.getElementById('connectHint').classList.remove('visible');
  document.querySelectorAll('.note.connect-from').forEach(el => el.classList.remove('connect-from'));
  CONNECT_NAME = '';
  document.getElementById('connectNameInput').value = '';
}

async function handleNoteConnectClick(noteId, noteEl) {
  if (!CONNECT_FROM) {
    CONNECT_FROM = noteId;
    noteEl.classList.add('connect-from');
    document.getElementById('connectHintText').textContent = 'Teď klikni na druhou poznámku…';
    return;
  }
  if (CONNECT_FROM === noteId) {
    document.getElementById('n-' + CONNECT_FROM)?.classList.remove('connect-from');
    CONNECT_FROM = null;
    document.getElementById('connectHintText').textContent = 'Klikni na první poznámku…';
    return;
  }
  const already = [...CONNS_MAP.values()].some(c =>
    (c.fromId === CONNECT_FROM && c.toId === noteId) ||
    (c.fromId === noteId      && c.toId === CONNECT_FROM)
  );
  if (already) { toast('Tyto poznámky jsou již propojeny.'); exitConnectMode(); return; }
  try {
    await db.collection('rooms').doc(ROOM_ID).collection('connections').add({
      fromId: CONNECT_FROM, toId: noteId, color: CONNECT_COLOR, name: CONNECT_NAME.trim() || null,
      authorId: ME.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Propojeno! 🔗');
  } catch (e) { toast('Chyba: ' + e.message); }
  exitConnectMode();
}

function getNotePinPos(noteId) {
  const el = document.getElementById('n-' + noteId);
  if (!el) return null;
  return { x: parseInt(el.style.left) + el.offsetWidth / 2, y: parseInt(el.style.top) + 6 };
}

function makeStringPath(x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag  = Math.min(dist * 0.15 + 18, 95);
  return `M ${x1} ${y1} Q ${(x1+x2)/2} ${(y1+y2)/2 + sag} ${x2} ${y2}`;
}

function redrawConnections() {
  const svg = document.getElementById('connSvg');
  if (!svg) return;
  svg.innerHTML = '';
  const canDel = MY_ROLE === 'owner' || MY_ROLE === 'editor';

  CONNS_MAP.forEach((conn, connId) => {
    const from = getNotePinPos(conn.fromId);
    const to   = getNotePinPos(conn.toId);
    if (!from || !to) return;

    const ns = 'http://www.w3.org/2000/svg';
    const g  = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'conn-group');

    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', makeStringPath(from.x, from.y, to.x, to.y));
    path.setAttribute('class', 'conn-path');
    path.setAttribute('stroke', conn.color || '#c0392b');
    g.appendChild(path);

    [from, to].forEach(pt => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '4'); dot.setAttribute('fill', conn.color || '#c0392b');
      g.appendChild(dot);
    });

    if (canDel) {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const sag  = Math.min(dist * 0.15 + 18, 95);
      const mx = (from.x + to.x) / 2;
      // A quadratic bezier's point at t=0.5 is halfway between the straight
      // line's midpoint and the control point — the control point itself
      // (used by makeStringPath) sags by the full `sag`, so the point that
      // actually sits ON the drawn curve only sags by sag/2. Using the full
      // sag here (as before) placed the button well below the visible line.
      const my = (from.y + to.y) / 2 + sag / 2;

      // Single button, right on the curve — opens one popup with both
      // "change color" and "delete" (previously two separate tiny buttons
      // were error-prone to hit on a thin curved line).
      const pg = document.createElementNS(ns, 'g');
      pg.setAttribute('class', 'conn-color');
      pg.setAttribute('transform', `translate(${mx},${my})`);
      const pbg = document.createElementNS(ns, 'circle');
      pbg.setAttribute('r', '11'); pbg.setAttribute('class', 'conn-del-bg');
      const ptx = document.createElementNS(ns, 'text');
      ptx.setAttribute('text-anchor', 'middle');
      ptx.setAttribute('dominant-baseline', 'central');
      ptx.setAttribute('class', 'conn-del-x');
      ptx.textContent = '🎨';
      ptx.setAttribute('font-size', '11');
      pg.appendChild(pbg); pg.appendChild(ptx);
      pg.addEventListener('click', e => {
        e.stopPropagation();
        openConnColorModal(connId, conn.color || '#c0392b', conn.name);
      });
      g.appendChild(pg);
    }
    svg.appendChild(g);
  });
}

// ── Flash Cards link ──────────────────────────────────────────
function setupFlashCards() {
  document.getElementById('flashcardsBtn').href = `flashcards.html?room=${ROOM_ID}`;
}

// ── Board panning: drag empty canvas (left button) or drag ANYWHERE
//    (right button, including over notes) to pan ───────────────
function setupBoardPan() {
  const wrap = document.getElementById('boardWrap');
  let panning = false, startX = 0, startY = 0, startSL = 0, startST = 0;

  // Right-click pans instead of opening the browser's context menu.
  wrap.addEventListener('contextmenu', e => e.preventDefault());

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 && e.button !== 2) return; // only left or right — ignore middle/other buttons
    // Left button: only pan when the empty canvas is grabbed. A note's own
    // mousedown handler (bound directly on the note) owns left-click-drag on
    // itself; without this check both would fire on every note click and
    // fight each other (note tries to move itself, board tries to scroll).
    if (e.button === 0 && e.target.closest('.note')) return;
    panning = true;
    startX = e.clientX; startY = e.clientY;
    startSL = wrap.scrollLeft; startST = wrap.scrollTop;
    wrap.classList.add('panning');
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!panning) return;
    wrap.scrollLeft = startSL - (e.clientX - startX);
    wrap.scrollTop  = startST - (e.clientY - startY);
  });

  const stopPan = () => { panning = false; wrap.classList.remove('panning'); };
  window.addEventListener('mouseup', stopPan);
  window.addEventListener('blur', stopPan);
}

// ── Board zoom: mouse wheel zooms the board instead of scrolling the
//    page/wrapper — panning still works via left/right-click drag above.
let BOARD_ZOOM = 1;
function setupBoardZoom() {
  const wrap  = document.getElementById('boardWrap');
  const board = document.getElementById('board');
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    BOARD_ZOOM = Math.min(2.2, Math.max(0.15, BOARD_ZOOM * factor));
    board.style.zoom = BOARD_ZOOM;
  }, { passive: false });
}

// ── AI Flash Cards from notes ───────────────────────────────────
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
  btn.addEventListener('click', openAiCardsModal);
  document.getElementById('aiGenerateBtn').addEventListener('click', generateAiCards);
  document.getElementById('aiSaveBtn').addEventListener('click', saveAiCards);
}

async function openAiCardsModal() {
  const listEl = document.getElementById('aiNotesList');
  listEl.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:.85rem;">Načítám poznámky…</div>';
  document.getElementById('aiCardsPreview').innerHTML = '';
  document.getElementById('aiSaveBtn').style.display = 'none';
  document.getElementById('aiGenerateBtn').style.display = 'inline-flex';
  document.getElementById('aiGenerateBtn').disabled = false;
  document.getElementById('aiGenerateBtn').textContent = '✨ Vygenerovat';
  document.getElementById('aiDeckName').value = 'AI karty ze zápisků';
  openModal('aiCardsModal');

  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('notes').orderBy('createdAt', 'asc').get();
    if (snap.empty) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:6px 2px;">Místnost ještě nemá žádné poznámky.</div>';
      return;
    }
    listEl.innerHTML = snap.docs.map(d => {
      const note = d.data();
      const preview = noteToPlainText(note).slice(0, 90) || '(prázdná poznámka)';
      return `<label class="ai-note-row">
        <input type="checkbox" class="ai-note-check" data-id="${d.id}" data-color="${note.color || '#fef9c3'}" checked>
        <span>${esc(preview)}</span>
      </label>`;
    }).join('');
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
Each flashcard: "front" is a short question or term, "back" is a concise, correct answer or definition.
Return ONLY a JSON array like this, nothing else: [{"front":"...","back":"..."}, ...]

NOTES:
"""
${combinedText.slice(0, 8000)}
"""`;

    const cards = await aiGenerate(prompt, {
      maxOutputTokens: 2500,
      parse(text) {
        const m = text.match(/\[[\s\S]*\]/);
        if (!m) throw new Error('no-json');
        const arr = JSON.parse(m[0]);
        const clean = arr
          .filter(c => c && c.front && c.back)
          .map(c => ({ front: String(c.front).trim(), back: String(c.back).trim() }));
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
        <span><b>${esc(c.front)}</b><br><span style="color:var(--text-muted);">${esc(c.back)}</span></span>
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
      batch.set(cardsCol.doc(), { front: c.front, back: c.back, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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

// ── Share ─────────────────────────────────────────────────────
function setupShare() {
  const roleSelect = document.getElementById('inviteRoleSelect');
  const linkText    = document.getElementById('inviteLinkText');

  function buildInviteLink() {
    const url = new URL('room.html', window.location.href);
    url.searchParams.set('id', ROOM_ID);
    url.searchParams.set('code', ROOM.inviteCode || '');
    url.searchParams.set('role', roleSelect.value);
    return url.href;
  }

  function refreshLink() { linkText.textContent = buildInviteLink(); }

  document.getElementById('shareBtn').addEventListener('click', () => {
    document.getElementById('inviteCode').textContent = ROOM.inviteCode || '------';
    refreshLink();
    openModal('shareModal');
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(ROOM.inviteCode || '').then(() => toast('Kód zkopírován!'));
  });

  roleSelect.addEventListener('change', refreshLink);

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(buildInviteLink()).then(() => toast('Odkaz zkopírován!'));
  });
}

// ── Members ───────────────────────────────────────────────────
function setupMembers() {
  document.getElementById('membersBtn').addEventListener('click', () => {
    renderMembers();
    document.getElementById('panelBack').classList.add('open');
  });

  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('panelBack').addEventListener('click', e => {
    if (e.target === document.getElementById('panelBack')) closePanel();
  });

  // Delete room (owner only)
  if (MY_ROLE === 'owner') {
    const wrap = document.getElementById('deleteRoomWrap');
    wrap.style.display = 'block';
    document.getElementById('deleteRoomBtn').addEventListener('click', async () => {
      if (!confirm('Opravdu chceš smazat celou místnost? Tato akce je nevratná.')) return;
      try {
        // Delete all notes first
        const notes = await db.collection('rooms').doc(ROOM_ID).collection('notes').get();
        const batch = db.batch();
        notes.docs.forEach(d => batch.delete(d.ref));
        batch.delete(db.collection('rooms').doc(ROOM_ID));
        await batch.commit();
        window.location.href = 'dashboard.html';
      } catch (e) {
        toast('Chyba: ' + e.message);
      }
    });
  }
}

function closePanel() {
  document.getElementById('panelBack').classList.remove('open');
}

function updateMemberCount() {
  const ids = ROOM.memberIds || [];
  document.getElementById('memberCount').textContent = ids.length;
}

function renderMembers() {
  const list    = document.getElementById('membersList');
  const members = ROOM.members || {};
  const roles   = ROOM.roles   || {};
  const ids     = ROOM.memberIds || [];

  if (!ids.length) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Žádní členové.</p>';
    return;
  }

  list.innerHTML = '';
  ids.forEach(uid => {
    const m      = members[uid] || {};
    const role   = roles[uid] || 'viewer';
    const isMe   = uid === ME.uid;
    const canMng = MY_ROLE === 'owner' && !isMe;

    const row = document.createElement('div');
    row.className = 'member-row';

    const av = m.photoURL
      ? `<img src="${m.photoURL}" alt="">`
      : initial(m.displayName || m.email || '?');

    row.innerHTML = `
      <div class="m-avatar">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
      <div class="m-info">
        <div class="m-name">${esc(m.displayName || m.email || uid)}${isMe ? ' <span style="color:var(--text-muted);font-weight:400;">(ty)</span>' : ''}</div>
        <div class="m-email">${esc(m.email || '')}</div>
      </div>
      ${canMng
        ? `<select class="role-select" data-uid="${uid}">
             <option value="editor" ${role === 'editor' ? 'selected' : ''}>Editor</option>
             <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Prohlížeč</option>
           </select>
           <button class="btn btn-danger" style="padding:4px 8px;font-size:0.72rem;" data-rm="${uid}">✕</button>`
        : `<span class="role-badge role-${role}">${roleLabel(role)}</span>`
      }`;

    // Role change
    const sel = row.querySelector('.role-select');
    if (sel) {
      sel.addEventListener('change', async () => {
        try {
          await db.collection('rooms').doc(ROOM_ID).update({ [`roles.${uid}`]: sel.value });
          ROOM.roles[uid] = sel.value;
          toast('Oprávnění změněno.');
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    }

    // Remove member
    const rmBtn = row.querySelector('[data-rm]');
    if (rmBtn) {
      rmBtn.addEventListener('click', async () => {
        if (!confirm('Odebrat tohoto člena?')) return;
        try {
          await db.collection('rooms').doc(ROOM_ID).update({
            memberIds:                        firebase.firestore.FieldValue.arrayRemove(uid),
            [`roles.${uid}`]:                 firebase.firestore.FieldValue.delete(),
            [`members.${uid}`]:               firebase.firestore.FieldValue.delete(),
          });
          // Refresh local state
          ROOM.memberIds = (ROOM.memberIds || []).filter(i => i !== uid);
          delete ROOM.roles[uid];
          delete ROOM.members[uid];
          updateMemberCount();
          renderMembers();
          toast('Člen odebrán.');
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    }

    list.appendChild(row);
  });
}

// ── Modal helpers ─────────────────────────────────────────────
function setupModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    if (ov.hasAttribute('data-persist')) return;
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Table insert modal (shared by add + edit rich toolbars) ────
let PENDING_TABLE_RESTORE = null;

function openTableInsertModal(restoreFocusAndRange) {
  PENDING_TABLE_RESTORE = restoreFocusAndRange;
  document.getElementById('tableRowsInput').value = 3;
  document.getElementById('tableColsInput').value = 3;
  openModal('tableInsertModal');
}

function setupTableInsertModal() {
  document.getElementById('tableInsertSubmit').addEventListener('click', () => {
    const rows = parseInt(document.getElementById('tableRowsInput').value) || 0;
    const cols = parseInt(document.getElementById('tableColsInput').value) || 0;
    if (rows < 1 || cols < 1) { toast('Zadej platný počet řádků a sloupců.'); return; }

    let html = '<table class="note-table" style="border-collapse:collapse;width:100%;margin:6px 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        html += `<${tag} contenteditable="true" style="border:1px solid #555;padding:5px 8px;min-width:60px;">${r === 0 ? 'Záhlaví ' + (c + 1) : ''}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table><br>';

    closeModal('tableInsertModal');
    if (PENDING_TABLE_RESTORE) PENDING_TABLE_RESTORE();
    document.execCommand('insertHTML', false, html);
  });
}

// ── Connection color modal ──────────────────────────────────────
// Replaces the old "invisible native <input type=color>, call .click()"
// trick — that relied on the browser opening its OS color chooser from a
// programmatic click on a hidden element, which isn't reliable everywhere.
// A real modal with a visible color input is the "pop up okno" that was
// asked for, and always works the same way regardless of browser.
let PENDING_CONN_COLOR_ID = null;

function openConnColorModal(connId, color, name) {
  PENDING_CONN_COLOR_ID = connId;
  document.getElementById('connColorInput').value = color;
  document.getElementById('connColorSwatch').style.background = color;
  document.getElementById('connColorHex').textContent = color;
  document.getElementById('connNameInput').value = name || '';
  openModal('connColorModal');
}

function setupConnColorModal() {
  const input  = document.getElementById('connColorInput');
  const swatch = document.getElementById('connColorSwatch');
  const hex    = document.getElementById('connColorHex');
  const nameInput = document.getElementById('connNameInput');
  input.addEventListener('input', () => {
    swatch.style.background = input.value;
    hex.textContent = input.value;
  });
  document.getElementById('connColorSubmit').addEventListener('click', async () => {
    if (!PENDING_CONN_COLOR_ID) return;
    try {
      await db.collection('rooms').doc(ROOM_ID).collection('connections').doc(PENDING_CONN_COLOR_ID)
        .update({ color: input.value, name: nameInput.value.trim() || null });
      closeModal('connColorModal');
      toast('Uloženo!');
    } catch (err) { toast('Chyba: ' + err.message); }
  });

  document.getElementById('connDeleteBtn').addEventListener('click', () => {
    const connId = PENDING_CONN_COLOR_ID;
    if (!connId) return;
    closeModal('connColorModal');
    confirmModal('Smazat propojení?', async () => {
      try { await db.collection('rooms').doc(ROOM_ID).collection('connections').doc(connId).delete(); }
      catch (err) { toast('Chyba: ' + err.message); }
    });
  });
}

// ── Generic confirm popup (replaces native confirm()) ───────────
function confirmModal(message, onConfirm) {
  const overlay = document.getElementById('confirmModal');
  document.getElementById('confirmModalText').textContent = message;
  overlay.classList.add('open');

  // Clone-replace so stale listeners from a previous (possibly
  // backdrop-dismissed, never-cleaned-up) call can't stack and fire twice.
  const oldYes = document.getElementById('confirmModalYes');
  const oldNo  = document.getElementById('confirmModalNo');
  const yesBtn = oldYes.cloneNode(true);
  const noBtn  = oldNo.cloneNode(true);
  oldYes.replaceWith(yesBtn);
  oldNo.replaceWith(noBtn);

  yesBtn.addEventListener('click', () => { overlay.classList.remove('open'); onConfirm(); });
  noBtn.addEventListener('click',  () => overlay.classList.remove('open'));
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg) {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className   = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function initial(str) { return (str || '?')[0].toUpperCase(); }
function roleLabel(r) { return { owner: 'Vlastník', editor: 'Editor', viewer: 'Prohlížeč' }[r] || r; }
function fmtTs(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

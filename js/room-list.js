// ═══ room-list.js — Seznamové zobrazení: složky, marky, piny, drag&drop, hledání
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).


// ── List view (a standalone "page" reachable/leavable via browser history)
// The list is driven through the History API so the mouse "back" button and
// the browser back arrow both return to the board, just like a real page —
// opening the list pushes a history entry (with ?view=list in the URL), and
// leaving it (back button, nav toggle, or browser/mouse back) pops it.
function applyView(mode) {
  VIEW_MODE = mode;
  document.body.classList.toggle('view-list', mode === 'list');
  document.getElementById('boardWrap').style.display     = mode === 'board' ? '' : 'none';
  document.getElementById('notesListView').style.display = mode === 'list'  ? '' : 'none';
  const mm = document.getElementById('boardMinimap');
  if (mm) { mm.style.display = mode === 'board' ? '' : 'none'; if (mode === 'board') updateMinimap(); }
  // Viewers never get connectBtn/newFolderBtn shown at all — don't undo that.
  if (MY_ROLE !== 'viewer') {
    document.getElementById('connectBtn').style.display   = mode === 'board' ? '' : 'none';
    document.getElementById('newFolderBtn').style.display = mode === 'list'  ? '' : 'none';
  }
  document.querySelectorAll('.room-view-seg [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
  // Board-only chrome: tool rail, zoom pill
  ['toolRail', 'zoomCtl'].forEach(id => document.getElementById(id)?.classList.toggle('hidden-in-list', mode !== 'board'));
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
  document.querySelectorAll('.room-view-seg [data-view]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.view === 'list') goToList(); else goToBoard();
  }));
  document.querySelectorAll('.list-layout-seg [data-layout]').forEach(b => b.addEventListener('click', () => {
    LIST_LAYOUT = b.dataset.layout;
    try { localStorage.setItem('sb_list_layout', LIST_LAYOUT); } catch (_) {}
    renderNotesListView();
  }));
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
  // Phones open in the list (the board is hard to use on a small screen) —
  // same history setup as a ?view=list deep link, so "Nástěnka" and back
  // still land on the board. ?view=board forces the board.
  const viewParam = new URLSearchParams(location.search).get('view');
  const phone = window.matchMedia('(max-width: 700px)').matches;
  if (viewParam === 'list' || (phone && viewParam !== 'board')) {
    const boardUrl = new URL(location.href); boardUrl.searchParams.delete('view');
    history.replaceState({ sbView: 'board' }, '', boardUrl);
    const listUrl = new URL(location.href); listUrl.searchParams.set('view', 'list');
    history.pushState({ sbView: 'list' }, '', listUrl);
    applyView('list');
  }
}

const noteRecency = n => n.updatedAt?.toMillis?.() || n.createdAt?.toMillis?.() || 0;

// ── Per-user, per-room list preferences (Firebase) ─────────────
// Folder open/closed state, the colored "puntíky" marks, and pins are
// personal — stored under the user's own profile so they sync across
// devices and survive cache clears, instead of living in localStorage.
// Shape: users/{uid}.roomPrefs[roomId] = { marks:{id:color}, pins:[id],
// collapsed:[folderId] }. Loaded once on room open into LIST_PREFS; writes
// are debounced and replace the whole per-room object (so deletions stick).
const MARK_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
let LIST_PREFS = { marks: {}, pins: new Set(), collapsed: new Set(), commentSeen: {} };

async function loadListPrefs() {
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    const p = snap.exists ? (snap.data().roomPrefs || {})[ROOM_ID] : null;
    LIST_PREFS = {
      marks: (p && p.marks) || {},
      pins: new Set((p && p.pins) || []),
      collapsed: new Set((p && p.collapsed) || []),
      commentSeen: (p && p.commentSeen) || {},   // noteId → comment count already viewed
    };
  } catch { LIST_PREFS = { marks: {}, pins: new Set(), collapsed: new Set(), commentSeen: {} }; }
}

let _prefsSaveTimer = null;
function persistListPrefs() {
  clearTimeout(_prefsSaveTimer);
  _prefsSaveTimer = setTimeout(async () => {
    const obj = { marks: LIST_PREFS.marks, pins: [...LIST_PREFS.pins], collapsed: [...LIST_PREFS.collapsed], commentSeen: LIST_PREFS.commentSeen };
    try {
      // Field-path update REPLACES the whole per-room object (deletions too).
      await db.collection('users').doc(ME.uid).update({ [`roomPrefs.${ROOM_ID}`]: obj });
    } catch {
      // Doc/field doesn't exist yet — create it.
      try { await db.collection('users').doc(ME.uid).set({ roomPrefs: { [ROOM_ID]: obj } }, { merge: true }); } catch {}
    }
  }, 400);
}

// These return the LIVE in-memory objects; callers mutate them and then call
// the matching save* to trigger a debounced Firestore write.
function getCollapsedFolders() { return LIST_PREFS.collapsed; }
function saveCollapsedFolders() { persistListPrefs(); }
function getMarks() { return LIST_PREFS.marks; }
function saveMarks() { persistListPrefs(); }
function markHtml(id, marks) {
  const c = marks[id] || '';
  return `<button class="list-mark" data-mark-id="${id}"${c ? ` data-marked="1" style="--mark-color:${c}"` : ''} title="Puntík — klik = červená/nic, pravý klik = výběr barvy"></button>`;
}

// Set/clear a mark's color (persist + update the button in place).
function applyMark(markId, color, btnEl) {
  const m = getMarks();
  if (color) m[markId] = color; else delete m[markId];
  saveMarks(m);
  if (btnEl) {
    if (color) { btnEl.dataset.marked = '1'; btnEl.style.setProperty('--mark-color', color); }
    else { delete btnEl.dataset.marked; btnEl.style.removeProperty('--mark-color'); }
  }
}

// Right-click color chooser for a mark — a small floating swatch popup at the
// cursor, plus a clear (×) option.
function closeMarkColorPopup() { document.getElementById('markColorPopup')?.remove(); }
function openMarkColorPopup(x, y, markId, btnEl) {
  closeMarkColorPopup();
  const pop = document.createElement('div');
  pop.className = 'mark-color-popup';
  pop.id = 'markColorPopup';
  pop.innerHTML = MARK_COLORS.map(c => `<button class="mark-color-swatch" data-c="${c}" style="background:${c}"></button>`).join('')
    + `<button class="mark-color-swatch mark-color-clear" data-c="" title="Zrušit">×</button>`;
  document.body.appendChild(pop);

  // Position at the cursor, clamped into the viewport.
  pop.style.left = x + 'px';
  pop.style.top  = y + 'px';
  const r = pop.getBoundingClientRect();
  if (r.right  > window.innerWidth)  pop.style.left = (window.innerWidth  - r.width  - 8) + 'px';
  if (r.bottom > window.innerHeight) pop.style.top  = (y - r.height) + 'px';

  pop.querySelectorAll('.mark-color-swatch').forEach(sw => {
    sw.addEventListener('click', e => {
      e.stopPropagation();
      applyMark(markId, sw.dataset.c, btnEl);
      closeMarkColorPopup();
    });
  });
  // Close on the next outside click / Escape.
  setTimeout(() => {
    document.addEventListener('click', closeMarkColorPopup, { once: true });
    document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { closeMarkColorPopup(); document.removeEventListener('keydown', esc); } });
  }, 0);
}

// Pins: personal "keep at the top" flags. A pinned note/folder gets a COPY
// in the top "Připnuté" section while still appearing in its normal place.
// There's no visible pin button — pinning is offered via a right-click /
// long-press context menu on the row itself (see wirePinTrigger).
function getPins() { return LIST_PREFS.pins; }
function savePins() { persistListPrefs(); }

function togglePin(id) {
  const set = getPins();
  if (set.has(id)) set.delete(id); else set.add(id);
  savePins(set);
  renderNotesListView();
}

// Small "Připnout / Odepnout" menu at the cursor.
function closePinMenu() { document.getElementById('pinMenu')?.remove(); }
function openPinMenu(x, y, id) {
  closePinMenu();
  const on = getPins().has(id);
  const pop = document.createElement('div');
  pop.className = 'context-menu';
  pop.id = 'pinMenu';
  const isFolder = FOLDERS_MAP.has(id);
  const canMove = MY_ROLE !== 'viewer';
  pop.innerHTML = `<button class="context-menu-item" data-pm="pin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 2-2V3H6v1a2 2 0 0 0 2 2 1 1 0 0 1 1 1z"/></svg>${on ? 'Odepnout' : 'Připnout nahoru'}</button>` +
    (canMove ? `<button class="context-menu-item" data-pm="move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Přesunout do složky…</button>` : '') +
    (isFolder ? `<button class="context-menu-item" data-pm="present"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>Prezentovat složku</button>` : '');
  document.body.appendChild(pop);
  pop.style.left = x + 'px';
  pop.style.top  = y + 'px';
  const r = pop.getBoundingClientRect();
  if (r.right  > window.innerWidth)  pop.style.left = (window.innerWidth  - r.width  - 8) + 'px';
  if (r.bottom > window.innerHeight) pop.style.top  = (y - r.height) + 'px';
  pop.addEventListener('click', e => {
    const act = e.target.closest('[data-pm]')?.dataset.pm;
    if (!act) return;
    e.stopPropagation();
    closePinMenu();
    if (act === 'pin') togglePin(id);
    if (act === 'move') { if (isFolder) openMoveFolderPicker(id); else openMoveToFolderModal(id); }
    if (act === 'present') presentFolder(id);
  });
  setTimeout(() => {
    document.addEventListener('click', closePinMenu, { once: true });
    document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { closePinMenu(); document.removeEventListener('keydown', esc); } });
  }, 0);
}

// Offer the pin menu on right-click, and on touch via long-press. The
// long-press swallows the click that would otherwise open the note / toggle
// the folder (capture-phase, so it beats those handlers on the same element).
function wirePinTrigger(elem, id) {
  if (!id) return;
  let lpTimer = null, lpFired = false;
  elem.addEventListener('contextmenu', e => {
    if (e.target.closest('button')) return; // let mark / edit / move buttons keep their own menus
    e.preventDefault(); e.stopPropagation();
    if (lpFired) return; // Android fires contextmenu on long-press too
    openPinMenu(e.clientX, e.clientY, id);
  });
  elem.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('button')) { clearTimeout(lpTimer); return; }
    const t = e.touches[0];
    lpFired = false;
    lpTimer = setTimeout(() => { lpFired = true; openPinMenu(t.clientX, t.clientY, id); }, 500);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
    elem.addEventListener(ev, () => clearTimeout(lpTimer), { passive: true }));
  elem.addEventListener('click', e => {
    if (lpFired) { lpFired = false; e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}

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
        // In the icon grid a new folder lands in the folder you are in;
        // in the tree list it starts at the top level.
        const parentId = LIST_LAYOUT === 'grid' && GRID_FOLDER && FOLDERS_MAP.has(GRID_FOLDER) ? GRID_FOLDER : null;
        await foldersCol.add({
          name, parentId, color, noteIds: [],
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
async function moveNoteToFolder(noteId, targetFolderId, quiet) {
  try {
    const foldersCol = db.collection('rooms').doc(ROOM_ID).collection('folders');
    const batch = db.batch();
    FOLDERS_MAP.forEach(f => {
      if ((f.noteIds || []).includes(noteId)) batch.update(foldersCol.doc(f.id), { noteIds: firebase.firestore.FieldValue.arrayRemove(noteId) });
    });
    if (targetFolderId) batch.update(foldersCol.doc(targetFolderId), { noteIds: firebase.firestore.FieldValue.arrayUnion(noteId) });
    await batch.commit();
    if (!quiet) toast(targetFolderId ? 'Přesunuto!' : 'Vyjmuto ze složky.');
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

// Same picker, but for moving a FOLDER — the touch-friendly counterpart to
// dragging one (HTML5 drag & drop doesn't exist on touch screens). Excludes
// the folder itself and its descendants to keep the cycle protection.
function openMoveFolderPicker(folderId) {
  const listEl = document.getElementById('moveToFolderList');
  const cur = FOLDERS_MAP.get(folderId);
  const targets = [...FOLDERS_MAP.values()]
    .filter(f => !isFolderInside(f.id, folderId))
    .sort((a, b) => folderPathLabel(a).localeCompare(folderPathLabel(b), 'cs'));

  listEl.innerHTML = `
    <div class="move-to-folder-row${!cur?.parentId ? ' current' : ''}" data-folder="">⬆️ Nejvyšší úroveň</div>
    ${targets.map(f => `
      <div class="move-to-folder-row${cur?.parentId === f.id ? ' current' : ''}" data-folder="${f.id}" style="--row-color:${f.color || '#6366f1'}">
        📁 ${esc(folderPathLabel(f))}
      </div>`).join('')}`;

  listEl.querySelectorAll('.move-to-folder-row').forEach(row => {
    row.addEventListener('click', () => {
      closeModal('moveToFolderModal');
      moveFolderToParent(folderId, row.dataset.folder || null);
    });
  });

  openModal('moveToFolderModal');
}

function renderNotesListView() {
  const el = document.getElementById('notesListBody');
  document.querySelectorAll('.list-layout-seg [data-layout]').forEach(b => b.classList.toggle('active', b.dataset.layout === LIST_LAYOUT));
  document.getElementById('notesListView').classList.toggle('layout-grid', LIST_LAYOUT === 'grid');
  if (LIST_LAYOUT === 'grid') { renderNotesGrid(el); return; }
  // Nadpisy jsou popisky nastenky, ne poznamky — v seznamu nemaji co delat.
  const notes = [...NOTES_MAP.values()].filter(n => !isHeading(n));

  if (!notes.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">Zatím žádné poznámky.</div>`;
    return;
  }

  const filedIds = new Set();
  FOLDERS_MAP.forEach(f => (f.noteIds || []).forEach(id => filedIds.add(id)));

  const collapsed = getCollapsedFolders();
  const marks = getMarks();
  const pins  = getPins();

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
    const body = ownNotes.map(n => renderNoteListRow(n, marks, pins)).join('') + children.map(renderFolderNode).join('');
    return `
      <details class="notes-folder"${collapsed.has(folder.id) ? '' : ' open'} data-folder-id="${folder.id}" style="--folder-color:${folder.color || '#6366f1'}">
        <summary class="notes-folder-summary"${pins.has(folder.id) ? ' data-pinned="1"' : ''}>
          <span class="notes-folder-icon">📁</span>
          <span class="notes-folder-title">${esc(folder.name)}</span>
          <span class="notes-folder-count">${folderSubtreeCount(folder)}</span>
          ${canManage ? `<button class="notes-folder-move" data-move-folder="${folder.id}" title="Přesunout složku">📂</button>` : ''}
          ${canManage ? `<button class="notes-folder-edit" data-edit-folder="${folder.id}" title="Upravit složku">✏️</button>` : ''}
          ${markHtml(folder.id, marks)}
        </summary>
        <div class="notes-folder-body">${body}</div>
      </details>`;
  }

  const topFolders = [...FOLDERS_MAP.values()].filter(f => !f.parentId || !FOLDERS_MAP.has(f.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const unfiled = notes.filter(n => !filedIds.has(n.id)).sort((a, b) => noteRecency(b) - noteRecency(a));

  // Pinned section: a full, interactive copy of each pinned note/folder at the
  // very top. A pinned folder renders as a real openable folder (click expands
  // its contents in place — not a jump link); a pinned note as a normal row
  // that opens its detail. The originals still render normally below.
  const pinnedIds = [...pins].filter(id => NOTES_MAP.has(id) || FOLDERS_MAP.has(id));
  let pinnedHtml = '';
  if (pinnedIds.length) {
    pinnedHtml = `<div class="pinned-section"><div class="pinned-title">📌 Připnuté</div>` +
      pinnedIds.map(id =>
        NOTES_MAP.has(id)
          ? renderNoteListRow(NOTES_MAP.get(id), marks, pins)
          : renderFolderNode(FOLDERS_MAP.get(id))
      ).join('') + `</div>`;
  }

  el.innerHTML = pinnedHtml + topFolders.map(renderFolderNode).join('') + unfiled.map(n => renderNoteListRow(n, marks, pins)).join('');
  if (!topFolders.length && !unfiled.length && !pinnedIds.length) {
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
  el.querySelectorAll('.notes-folder-move').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      openMoveFolderPicker(btn.dataset.moveFolder);
    });
  });

  // Puntíky: LEFT click (or tap) toggles red/none; RIGHT click — or a
  // long-press on touch, where right-click doesn't exist — opens the color
  // picker. Saved per-user. preventDefault stops a folder summary from
  // toggling / a note from opening.
  wireListMarks(el);

  // Připínáčky: no visible button — pinning is offered on RIGHT-click (or a
  // long-press on touch, where right-click doesn't exist) on any note row or
  // folder header. A pinned item gets a full interactive copy in the top
  // "Připnuté" section.
  el.querySelectorAll('.notes-list-row').forEach(row => wirePinTrigger(row, row.dataset.id));
  el.querySelectorAll('.notes-folder-summary').forEach(sum =>
    wirePinTrigger(sum, sum.closest('.notes-folder').dataset.folderId));

  // Remember which folders each user leaves open/closed.
  el.querySelectorAll('.notes-folder').forEach(d => {
    d.addEventListener('toggle', () => {
      const set = getCollapsedFolders();
      if (d.open) set.delete(d.dataset.folderId); else set.add(d.dataset.folderId);
      saveCollapsedFolders(set);
    });
  });

  if (MY_ROLE !== 'viewer') setupListDragDrop(el);
}

function wireListMarks(el) {
  el.querySelectorAll('.list-mark').forEach(btn => {
    let lpTimer = null, lpFired = false;
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (lpFired) { lpFired = false; return; } // long-press already handled this touch
      const has = !!(getMarks()[btn.dataset.markId]);
      applyMark(btn.dataset.markId, has ? '' : '#ef4444', btn);
    });
    btn.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      if (lpFired) return; // Android fires contextmenu on long-press too
      openMarkColorPopup(e.clientX, e.clientY, btn.dataset.markId, btn);
    });
    btn.addEventListener('touchstart', e => {
      const t = e.touches[0];
      lpFired = false;
      lpTimer = setTimeout(() => {
        lpFired = true;
        openMarkColorPopup(t.clientX, t.clientY, btn.dataset.markId, btn);
      }, 450);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(ev =>
      btn.addEventListener(ev, () => clearTimeout(lpTimer), { passive: true }));
  });
}

// ── Ikony (jako plocha ve Windows) ────────────────────────────
// Jedna složka na obrazovce: nahoře cesta (Místnost › Složka › Podsložka),
// pod ní dlaždice — nejdřív složky, pak poznámky. Klik na složku = vejít
// dovnitř, přetáhnout dlaždici na složku (nebo na kus cesty) = přesunout.
// Složky jdou takhle i do složek.
// Na dotykovém displeji žádné HTML5 tažení: Android z podržení udělá tažení
// a přestane jít posouvat seznam. Přesun jde přes podržení → menu.
const TOUCH_ONLY = window.matchMedia('(hover: none)').matches;
let LIST_LAYOUT = (() => { try { return localStorage.getItem('sb_list_layout') || 'grid'; } catch (_) { return 'grid'; } })();
let GRID_FOLDER = null;
let DRAGGING_FROM_GRID = false;

const FOLDER_SVG = '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 8a4 4 0 0 1 4-4h11l4 4h19a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="var(--fc)" opacity=".55"/><path d="M3 14a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" fill="var(--fc)"/></svg>';

function gridFolderPath(id) {
  const out = [];
  let f = id ? FOLDERS_MAP.get(id) : null;
  while (f) { out.unshift(f); f = f.parentId ? FOLDERS_MAP.get(f.parentId) : null; }
  return out;
}

function renderNotesGrid(el) {
  if (GRID_FOLDER && !FOLDERS_MAP.has(GRID_FOLDER)) GRID_FOLDER = null;
  const marks = getMarks();
  const pins = getPins();
  const notes = [...NOTES_MAP.values()].filter(n => !isHeading(n));
  const filedIds = new Set();
  FOLDERS_MAP.forEach(f => (f.noteIds || []).forEach(id => filedIds.add(id)));
  const count = f => (f.noteIds || []).filter(id => NOTES_MAP.has(id)).length +
    [...FOLDERS_MAP.values()].filter(c => c.parentId === f.id).length;

  const isTop = f => !f.parentId || !FOLDERS_MAP.has(f.parentId);
  const folders = [...FOLDERS_MAP.values()]
    .filter(f => GRID_FOLDER ? f.parentId === GRID_FOLDER : isTop(f))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  const here = GRID_FOLDER
    ? (FOLDERS_MAP.get(GRID_FOLDER).noteIds || []).map(id => NOTES_MAP.get(id)).filter(n => n && !isHeading(n))
    : notes.filter(n => !filedIds.has(n.id));
  here.sort((a, b) => noteRecency(b) - noteRecency(a));

  const path = gridFolderPath(GRID_FOLDER);
  const crumbs = `<nav class="grid-crumbs">
      <button type="button" class="grid-crumb${GRID_FOLDER ? '' : ' on'}" data-go="" data-drop-folder data-folder-id="">🏠 ${esc(ROOM?.name || 'Místnost')}</button>` +
    path.map(f => `<span class="grid-crumb-sep">›</span><button type="button" class="grid-crumb${f.id === GRID_FOLDER ? ' on' : ''}" data-go="${f.id}" data-drop-folder data-folder-id="${f.id}">${esc(f.name)}</button>`).join('') +
    `</nav>`;

  const folderTile = f => `
    <div class="grid-tile grid-folder" data-open-folder="${f.id}" data-drop-folder data-folder-id="${f.id}" draggable="${MY_ROLE !== 'viewer' && !TOUCH_ONLY}" style="--fc:${f.color || '#6366f1'}" title="${esc(f.name)}">
      <div class="gt-icon">${FOLDER_SVG}<span class="gt-count">${count(f)}</span></div>
      <div class="gt-name">${esc(f.name)}</div>
      ${markHtml(f.id, marks)}
    </div>`;
  const noteTile = n => {
    const chapters = Array.isArray(n.pages) ? n.pages.length : 0;
    const title = n.title || (chapters ? n.pages[0].title : '') || noteToPlainText(n).slice(0, 70) || noteBlankLabel(n) || '(prázdná poznámka)';
    const cb = commentBadgeInfo(n.id);
    return `
    <div class="grid-tile grid-note" data-note="${n.id}" draggable="${MY_ROLE !== 'viewer' && !TOUCH_ONLY}" style="--nc:${n.color || '#fef9c3'}" title="${esc(title)}">
      <div class="gt-paper"><span class="gt-paper-lines"></span>${chapters ? `<span class="gt-chip">📖 ${chapters}</span>` : ''}${cb.count ? `<span class="gt-chip gt-cchip${cb.unread ? ' unread' : ''}">💬 ${cb.count}</span>` : ''}</div>
      <div class="gt-name">${esc(title)}</div>
      ${markHtml(n.id, marks)}
    </div>`;
  };

  const pinnedIds = GRID_FOLDER ? [] : [...pins].filter(id => NOTES_MAP.has(id) || FOLDERS_MAP.has(id));
  const pinned = pinnedIds.length ? `<div class="grid-section-title">📌 Připnuté</div><div class="grid-tiles">` +
    pinnedIds.map(id => NOTES_MAP.has(id) ? noteTile(NOTES_MAP.get(id)) : folderTile(FOLDERS_MAP.get(id))).join('') + `</div><div class="grid-section-title">Vše</div>` : '';

  const tiles = folders.map(folderTile).join('') + here.map(noteTile).join('');
  el.innerHTML = crumbs + pinned + (tiles
    ? `<div class="grid-tiles">${tiles}</div>`
    : `<div class="grid-empty">${GRID_FOLDER ? 'Složka je prázdná — přetáhni sem poznámky nebo jiné složky.' : 'Zatím žádné poznámky.'}</div>`) +
    (MY_ROLE !== 'viewer' ? `<div class="grid-hint">${TOUCH_ONLY ? 'Tip: podrž dlaždici → „Přesunout do složky…“ (i složku do složky).' : 'Tip: přetáhni dlaždici na složku (nebo na kus cesty nahoře) a přesune se tam — i složka do složky.'}</div>` : '');

  el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { GRID_FOLDER = b.dataset.go || null; renderNotesListView(); }));
  el.querySelectorAll('[data-open-folder]').forEach(t => t.addEventListener('click', e => {
    if (e.target.closest('.list-mark')) return;
    GRID_FOLDER = t.dataset.openFolder; renderNotesListView();
    document.getElementById('notesListView').scrollTop = 0;
  }));
  el.querySelectorAll('[data-note]').forEach(t => t.addEventListener('click', e => {
    if (e.target.closest('.list-mark')) return;
    const note = NOTES_MAP.get(t.dataset.note);
    if (note) openNoteDetail(null, note);
  }));
  el.querySelectorAll('.grid-note').forEach(t => wirePinTrigger(t, t.dataset.note));
  el.querySelectorAll('.grid-folder').forEach(t => wirePinTrigger(t, t.dataset.folderId));
  wireListMarks(el);

  if (MY_ROLE === 'viewer') return;
  const listView = document.getElementById('notesListView');
  el.querySelectorAll('.grid-tile[draggable="true"]').forEach(t => {
    t.addEventListener('dragstart', e => {
      const isFolder = t.classList.contains('grid-folder');
      DRAGGING = { type: isFolder ? 'folder' : 'note', id: isFolder ? t.dataset.folderId : t.dataset.note };
      DRAGGING_FROM_GRID = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', DRAGGING.type + ':' + DRAGGING.id);
      t.classList.add('dragging');
      listView.classList.add('dnd-active');
    });
    t.addEventListener('dragend', () => {
      t.classList.remove('dragging');
      listView.classList.remove('dnd-active');
      DRAGGING = null; DRAGGING_FROM_GRID = false;
    });
  });
  setupListDragDrop(el);
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
  const listView = document.getElementById('notesListView');
  const startDrag = () => listView.classList.add('dnd-active');   // reveals the top-level drop zone
  const endDrag   = () => { listView.classList.remove('dnd-active'); DRAGGING = null; };

  if (TOUCH_ONLY) return;      // dotyk: přesun přes podržení → „Přesunout do složky…“
  body.querySelectorAll('.notes-list-row').forEach(row => {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', e => {
      e.stopPropagation();
      DRAGGING = { type: 'note', id: row.dataset.id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'note:' + row.dataset.id);
      row.classList.add('dragging');
      startDrag();
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); endDrag(); });
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
      startDrag();
    });
    sum.addEventListener('dragend', () => { folderEl.classList.remove('dragging'); endDrag(); });
  });

  if (LIST_DND_WIRED) return;
  LIST_DND_WIRED = true;
  const container = document.getElementById('notesListView');

  // A folder target is invalid for a folder-drag if it IS the dragged folder
  // or one of its descendants.
  const targetValid = targetFolderEl => {
    if (!DRAGGING || DRAGGING.type !== 'folder' || !targetFolderEl || !targetFolderEl.dataset.folderId) return true;
    return !isFolderInside(targetFolderEl.dataset.folderId, DRAGGING.id);
  };

  const topZone = document.getElementById('listTopDropZone');
  let lastDragOverFolder = null;
  const clearHighlight = () => {
    lastDragOverFolder?.classList.remove('drag-over'); lastDragOverFolder = null;
    topZone.classList.remove('drag-over');
  };

  container.addEventListener('dragover', e => {
    if (!DRAGGING) return; // ignore drags that didn't start in the list
    const folderEl = e.target.closest('.notes-folder, [data-drop-folder]');
    if (!targetValid(folderEl)) { e.dataTransfer.dropEffect = 'none'; clearHighlight(); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Auto-scroll near the edges so a distant folder (or the empty bottom)
    // is reachable while dragging — HTML5 DnD doesn't scroll on its own.
    const r = container.getBoundingClientRect();
    if (e.clientY < r.top + 70) container.scrollTop -= 16;
    else if (e.clientY > r.bottom - 70) container.scrollTop += 16;

    const overTop = !!e.target.closest('#listTopDropZone');
    topZone.classList.toggle('drag-over', overTop);
    const highlightFolder = overTop ? null : folderEl;
    if (highlightFolder !== lastDragOverFolder) {
      lastDragOverFolder?.classList.remove('drag-over');
      highlightFolder?.classList.add('drag-over');
      lastDragOverFolder = highlightFolder;
    }
  });
  container.addEventListener('dragleave', e => { if (!container.contains(e.relatedTarget)) clearHighlight(); });
  container.addEventListener('drop', e => {
    e.preventDefault();
    clearHighlight();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const folderEl = e.target.closest('.notes-folder, [data-drop-folder]');
    if (!folderEl && LIST_LAYOUT === 'grid') return;             // mřížka: pustit vedle = nic
    const targetId = folderEl ? (folderEl.dataset.folderId || null) : null;
    if (DRAGGING_FROM_GRID && targetId === (GRID_FOLDER || null) && data.startsWith('note:')) return;
    if (data.startsWith('note:')) {
      moveNoteToFolder(data.slice(5), targetId);
    } else if (data.startsWith('folder:')) {
      const draggedId = data.slice(7);
      if (targetId && isFolderInside(targetId, draggedId)) return; // invalid, ignore
      moveFolderToParent(draggedId, targetId);
    }
  });
}

function renderNoteListRow(note, marks, pins) {
  const chapters = Array.isArray(note.pages) ? note.pages.length : 0;
  const title = note.title || (chapters ? note.pages[0].title : '')
    || noteToPlainText(note).slice(0, 90) || noteBlankLabel(note) || '(prázdná poznámka)';
  const moveBtn = MY_ROLE !== 'viewer'
    ? `<button class="notes-move-btn" data-move-note="${note.id}" title="Přesunout do složky">📁</button>`
    : '';
  const cb = commentBadgeInfo(note.id);
  const gBadge = chapters
    ? `<span class="row-guide" title="Návod – ${chapters} kapitol">📖 ${chapters}</span>` : '';
  const cBadge = cb.count
    ? `<span class="row-cbadge${cb.unread ? ' unread' : ''}" title="${cb.unread ? cb.unread + ' nových komentářů' : cb.count + ' komentářů'}">💬 ${cb.count}</span>`
    : '';
  return `
    <div class="notes-list-row" data-id="${note.id}"${(pins && pins.has(note.id)) ? ' data-pinned="1"' : ''} style="--row-color:${note.color || '#fef9c3'}">
      <div class="notes-list-dot"></div>
      <div class="notes-list-main">
        <div class="notes-list-title">${esc(title)}</div>
        <div class="notes-list-meta">${esc(note.authorName || 'Anon')} · ${fmtTs(note.updatedAt || note.createdAt)}</div>
      </div>
      ${gBadge}${cBadge}
      ${moveBtn}
      ${markHtml(note.id, marks || {})}
    </div>`;
}

// ── Render note ───────────────────────────────────────────────
function searchNormalize(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Scroll the board so a note sits in the middle of the viewport.
function centerOnNote(note) {
  const wrap = document.getElementById('boardWrap');
  wrap.scrollLeft = toRenderX(note.x) * BOARD_ZOOM - wrap.clientWidth / 2;
  wrap.scrollTop  = toRenderY(note.y) * BOARD_ZOOM - wrap.clientHeight / 2;
}

function setupSearch() {
  const btn = document.getElementById('searchBtn');
  const input = document.getElementById('searchInput');
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    openModal('searchModal');
    input.value = '';
    renderSearchResults('');
    setTimeout(() => input.focus(), 60);
  });
  input.addEventListener('input', () => renderSearchResults(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = document.querySelector('#searchResults [data-note-id]'); if (first) first.click(); }
  });
  setupFindInNote();
}

// All notes matching q, with a snippet around the first hit. Shared by the
// search window and the result list kept beside an opened note.
function searchHits(q) {
  const nq = searchNormalize(q.trim());
  if (!nq) return [];
  const hits = [];
  NOTES_MAP.forEach(note => {
    if (isHeading(note)) return;
    const title = note.title || '';
    const combined = (title ? title + ' — ' : '') + noteToPlainText(note);
    const nCombined = searchNormalize(combined);
    const pos = nCombined.indexOf(nq);
    if (pos === -1) return;
    let count = 0;
    for (let i = pos; i !== -1; i = nCombined.indexOf(nq, i + nq.length)) count++;
    // Fixed window around the START of the match, so the snippet doesn't
    // grow letter by letter while typing.
    const start = Math.max(0, pos - 32);
    const end = Math.min(combined.length, pos + 80);
    const snippet = (start > 0 ? '…' : '') + esc(combined.slice(start, pos)) +
      '<mark>' + esc(combined.slice(pos, pos + nq.length)) + '</mark>' +
      esc(combined.slice(pos + nq.length, end)) + (end < combined.length ? '…' : '');
    hits.push({ note, title: title || '(bez názvu)', snippet: snippet.replace(/\s+/g, ' '), count });
  });
  return hits;
}

function renderSearchResults(q) {
  const el = document.getElementById('searchResults');
  if (!q.trim()) { el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:10px 2px;">Napiš, co hledáš — prohledají se názvy i obsah poznámek.</div>`; return; }
  const hits = searchHits(q);

  if (!hits.length) { el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:10px 2px;">Nic nenalezeno.</div>`; return; }

  el.innerHTML = hits.slice(0, 40).map(h => `
    <div class="search-hit" data-note-id="${h.note.id}" style="padding:9px 10px;border-radius:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:6px;--row-color:${h.note.color || '#fef9c3'};border-left:3px solid var(--row-color);">
      <div style="font-weight:600;font-size:0.88rem;display:flex;gap:8px;"><span style="flex:1;min-width:0;">${esc(h.title)}</span>${h.count > 1 ? `<span class="search-count">${h.count}×</span>` : ''}</div>
      <div class="search-snip">${h.snippet}</div>
    </div>`).join('') + (hits.length > 40 ? `<div style="color:var(--text-muted);font-size:.75rem;padding:6px 2px;">…a další (${hits.length - 40})</div>` : '');

  el.querySelectorAll('[data-note-id]').forEach(row => {
    row.addEventListener('click', () => {
      const note = NOTES_MAP.get(row.dataset.noteId);
      if (!note) return;
      closeModal('searchModal');
      if (VIEW_MODE === 'board') centerOnNote(note);
      FIND = { q: document.getElementById('searchInput').value.trim(), side: true, idx: 0, fresh: true };
      openNoteDetail(document.getElementById('n-' + note.id), note);
    });
  });
}


// ── Hledání v otevřené poznámce (jako Ctrl+F) ─────────────────
// Otevřeno z hledání: vlevo zůstane seznam všech nalezených poznámek, nahoře
// lišta "2 / 5 ▲▼" a výskyty jsou v textu zvýrazněné. Ctrl+F v otevřené
// poznámce otevře jen lištu.
let FIND = null;   // { q, side, idx }

function setupFindInNote() {
  const input = document.getElementById('findInput');
  if (!input) return;
  input.addEventListener('input', () => {
    if (!FIND) FIND = { q: '', side: false, idx: 0 };
    FIND.q = input.value; FIND.idx = 0;
    refreshFind();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  document.getElementById('findNext').addEventListener('click', () => stepFind(1));
  document.getElementById('findPrev').addEventListener('click', () => stepFind(-1));
  document.getElementById('findClose').addEventListener('click', closeFind);
  document.addEventListener('keydown', e => {
    const open = document.getElementById('noteDetailModal')?.classList.contains('open');
    if (!open || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return;
    e.preventDefault();
    if (!FIND) FIND = { q: '', side: false, idx: 0 };
    refreshFind();
    input.focus(); input.select();
  });
  // Detail se zavírá křížkem nebo klikem vedle — hledání s ním končí.
  document.querySelector('[data-close="noteDetailModal"]')?.addEventListener('click', () => { FIND = null; });
  document.getElementById('noteDetailModal')?.addEventListener('click', e => {
    if (e.target.id === 'noteDetailModal') FIND = null;
  });
}

function closeFind() {
  FIND = null;
  refreshFind();
}

// Called after the detail content is (re)rendered: opening a note, switching
// chapters, typing into the bar.
function refreshFind() {
  const bar = document.getElementById('findBar');
  const side = document.getElementById('findSide');
  const contentEl = document.getElementById('detailContent');
  if (!bar || !contentEl) return;
  unmarkFind(contentEl);
  if (!FIND) { bar.hidden = true; side.hidden = true; return; }
  bar.hidden = false;
  const input = document.getElementById('findInput');
  if (input.value !== FIND.q) input.value = FIND.q;
  const marks = markFind(contentEl, FIND.q);
  const cnt = document.getElementById('findCount');
  if (!FIND.q.trim()) cnt.textContent = '';
  else if (!marks.length) cnt.textContent = 'nic';
  else {
    FIND.idx = ((FIND.idx % marks.length) + marks.length) % marks.length;
    cnt.textContent = (FIND.idx + 1) + ' / ' + marks.length;
    marks[FIND.idx].classList.add('find-cur');
    marks[FIND.idx].scrollIntoView({ block: 'center' });
  }
  renderFindSide(side);
}

function stepFind(d) {
  if (!FIND) return;
  FIND.idx += d;
  refreshFind();
}

function unmarkFind(root) {
  root.querySelectorAll('mark.find-hit').forEach(m => m.replaceWith(...m.childNodes));
  root.normalize();
}

// Wrap every occurrence (diacritics- and case-insensitive) in <mark>. Only
// the shown copy of the note is touched — nothing is saved.
function markFind(root, q) {
  const nq = searchNormalize(q.trim());
  if (!nq) return [];
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const out = [];
  nodes.forEach(node => {
    const norm = searchNormalize(node.data);
    if (norm.length !== node.data.length) return;          // exotic text — offsets would not line up
    let at = norm.indexOf(nq), cur = node;
    let base = 0;
    while (at !== -1) {
      const hit = cur.splitText(at - base);
      const rest = hit.splitText(nq.length);
      const m = document.createElement('mark');
      m.className = 'find-hit';
      hit.replaceWith(m); m.appendChild(hit);
      out.push(m);
      base = at + nq.length;
      cur = rest;
      at = norm.indexOf(nq, base);
    }
  });
  return out;
}

function renderFindSide(side) {
  if (!FIND || !FIND.side || !FIND.q.trim()) { side.hidden = true; return; }
  const hits = searchHits(FIND.q);
  side.hidden = !hits.length;
  side.innerHTML = `<div class="find-side-head">Nalezeno v ${hits.length} ${hits.length === 1 ? 'poznámce' : 'poznámkách'}</div>` +
    hits.slice(0, 60).map(h => `
    <button type="button" class="find-side-item${h.note.id === DETAIL_NOTE_ID ? ' on' : ''}" data-id="${h.note.id}" style="--row-color:${h.note.color || '#fef9c3'}">
      <span class="fsi-title">${esc(h.title)}${h.count > 1 ? ` <span class="search-count">${h.count}×</span>` : ''}</span>
      <span class="fsi-snip">${h.snippet}</span>
    </button>`).join('');
  side.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
    const note = NOTES_MAP.get(b.dataset.id);
    if (!note || note.id === DETAIL_NOTE_ID) return;
    FIND.idx = 0;
    openNoteDetail(document.getElementById('n-' + note.id), note);
  }));
  side.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
}

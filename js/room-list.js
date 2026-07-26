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
  document.getElementById('boardWrap').style.display     = mode === 'board' ? '' : 'none';
  document.getElementById('notesListView').style.display = mode === 'list'  ? '' : 'none';
  const mm = document.getElementById('boardMinimap');
  if (mm) { mm.style.display = mode === 'board' ? '' : 'none'; if (mode === 'board') updateMinimap(); }
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
  pop.innerHTML = `<button class="context-menu-item">📌 ${on ? 'Odepnout' : 'Připnout nahoru'}</button>`;
  document.body.appendChild(pop);
  pop.style.left = x + 'px';
  pop.style.top  = y + 'px';
  const r = pop.getBoundingClientRect();
  if (r.right  > window.innerWidth)  pop.style.left = (window.innerWidth  - r.width  - 8) + 'px';
  if (r.bottom > window.innerHeight) pop.style.top  = (y - r.height) + 'px';
  pop.querySelector('button').addEventListener('click', e => {
    e.stopPropagation();
    closePinMenu();
    togglePin(id);
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
  const notes = [...NOTES_MAP.values()];

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
    if (!DRAGGING || DRAGGING.type !== 'folder' || !targetFolderEl) return true;
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
    const folderEl = e.target.closest('.notes-folder');
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

function renderNoteListRow(note, marks, pins) {
  const title = note.title || noteToPlainText(note).slice(0, 90) || '(prázdná poznámka)';
  const moveBtn = MY_ROLE !== 'viewer'
    ? `<button class="notes-move-btn" data-move-note="${note.id}" title="Přesunout do složky">📁</button>`
    : '';
  const cb = commentBadgeInfo(note.id);
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
      ${cBadge}
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
}

function renderSearchResults(q) {
  const el = document.getElementById('searchResults');
  const nq = searchNormalize(q.trim());
  if (!nq) { el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:10px 2px;">Napiš, co hledáš — prohledají se názvy i obsah poznámek.</div>`; return; }

  const hits = [];
  NOTES_MAP.forEach(note => {
    const title = note.title || '';
    const text = noteToPlainText(note);
    const hay = searchNormalize(title + ' ' + text);
    const at = hay.indexOf(nq);
    if (at === -1) return;
    // Snippet around the first match (from the ORIGINAL text so accents show).
    const combined = (title ? title + ' — ' : '') + text;
    const nCombined = searchNormalize(combined);
    const pos = nCombined.indexOf(nq);
    const start = Math.max(0, pos - 30);
    const snippet = (start > 0 ? '…' : '') + combined.slice(start, pos + nq.length + 40).trim() + '…';
    hits.push({ note, title: title || '(bez názvu)', snippet });
  });

  if (!hits.length) { el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:10px 2px;">Nic nenalezeno.</div>`; return; }

  el.innerHTML = hits.slice(0, 40).map(h => `
    <div class="search-hit" data-note-id="${h.note.id}" style="padding:9px 10px;border-radius:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:6px;--row-color:${h.note.color || '#fef9c3'};border-left:3px solid var(--row-color);">
      <div style="font-weight:600;font-size:0.88rem;">${esc(h.title)}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${esc(h.snippet)}</div>
    </div>`).join('') + (hits.length > 40 ? `<div style="color:var(--text-muted);font-size:.75rem;padding:6px 2px;">…a další (${hits.length - 40})</div>` : '');

  el.querySelectorAll('[data-note-id]').forEach(row => {
    row.addEventListener('click', () => {
      const note = NOTES_MAP.get(row.dataset.noteId);
      if (!note) return;
      closeModal('searchModal');
      if (VIEW_MODE === 'board') centerOnNote(note);
      openNoteDetail(document.getElementById('n-' + note.id), note);
    });
  });
}


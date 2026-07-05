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
      // Invite link — either the permanent one (?code=..&role=..) or a
      // temporary one (?tcode=..) whose role+expiry live server-side in
      // ROOM.tempInvites, so the link itself can't be tampered with.
      const params   = new URLSearchParams(window.location.search);
      const linkCode = params.get('code');
      const tempCode = params.get('tcode');
      let   linkRole = params.get('role');
      let   inviteExp = null; // membership expiry carried by a temp invite

      let allowed = false;
      if (tempCode) {
        const t = (ROOM.tempInvites || {})[tempCode];
        // exp:null = permanent single-use link — never expires, only gets
        // consumed (on join) or revoked.
        if (t && (t.exp == null || t.exp > Date.now())) { allowed = true; linkRole = t.role; inviteExp = t.exp; }
        else if (t) {
          toast('Tato pozvánka už vypršela.');
          setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
          return;
        }
      } else if (linkCode && ROOM.inviteCode && linkCode === ROOM.inviteCode) {
        allowed = true;
      }

      if (!allowed) {
        toast('Nemáš přístup k této místnosti.');
        setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
        return;
      }

      // Editor via invite is reserved for the OWNER's friends. A forged or
      // leaked role=editor link therefore grants nothing — anyone who isn't
      // the owner's friend silently joins as viewer instead. Anonymous
      // guests are ALWAYS viewers: their membership is temporary, so letting
      // them create permanent content makes no sense.
      let joinRole = linkRole === 'editor' ? 'editor' : 'viewer';
      if (ME.isAnonymous) {
        joinRole = 'viewer';
      } else if (joinRole === 'editor') {
        const friends = await loadFriendState();
        if (!friends.accepted.has(ROOM.ownerId)) {
          joinRole = 'viewer';
          toast('Editora může získat jen přítel vlastníka — připojeno jako prohlížeč.');
        }
      }


      // Membership expiry: a temp invite carries its own; anonymous guests
      // are capped at 1 hour no matter which invite they used.
      let expiry = inviteExp;
      if (ME.isAnonymous) expiry = Math.min(expiry ?? Infinity, Date.now() + 3600000);

      const joinUpdate = {
        memberIds:             firebase.firestore.FieldValue.arrayUnion(ME.uid),
        [`roles.${ME.uid}`]:   joinRole,
        [`members.${ME.uid}`]: {
          displayName: ME.isAnonymous ? 'Host' : (ME.displayName || ME.email),
          email: ME.email || null, photoURL: ME.photoURL || null,
          isAnon: !!ME.isAnonymous,
        },
      };
      if (expiry) joinUpdate[`memberExpiry.${ME.uid}`] = expiry;
      // Single-use invite: consume it atomically with the join itself, so a
      // shared one-shot link can't let a second person in.
      if (tempCode && (ROOM.tempInvites || {})[tempCode]?.once) {
        joinUpdate[`tempInvites.${tempCode}`] = firebase.firestore.FieldValue.delete();
      }

      await doc.ref.update(joinUpdate);
      ROOM.memberIds = [...(ROOM.memberIds || []), ME.uid];
      ROOM.roles     = { ...(ROOM.roles || {}), [ME.uid]: joinRole };
      if (expiry) ROOM.memberExpiry = { ...(ROOM.memberExpiry || {}), [ME.uid]: expiry };
      MY_ROLE = joinRole;
      toast(`Připojeno jako ${roleLabel(joinRole)}! 🎉`);
    }

    // Expired / expiring membership (anonymous guests, temp invites):
    // kick on load if already past, otherwise schedule the kick and show
    // a countdown notice.
    const myExpiry = (ROOM.memberExpiry || {})[ME.uid];
    if (myExpiry && Date.now() >= myExpiry) {
      await performLeave().catch(() => {});
      toast('Tvůj dočasný přístup vypršel.');
      setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
      return;
    }
    if (myExpiry) scheduleExpiryKick(myExpiry);

    // Owner housekeeping: expired members only remove THEMSELVES when they
    // happen to reload the room — if they just closed the tab, they'd linger
    // forever. The owner sweeps them out on load instead.
    if (MY_ROLE === 'owner') purgeExpiredMembers();

    document.getElementById('roomTitle').textContent = ROOM.name;
    document.title = ROOM.name + ' – StudyBoard';

    // Anonymous guests are strictly view-only in shared rooms, no matter what
    // role a legacy/edge path may have left them — their membership is
    // temporary, permanent content from them makes no sense.
    if (ME.isAnonymous && MY_ROLE !== 'owner') MY_ROLE = 'viewer';

    if (MY_ROLE === 'viewer') {
      document.getElementById('addBtn').style.display = 'none';
      const notice = document.createElement('div');
      notice.className   = 'viewer-notice';
      notice.textContent = '👁 Jen prohlížíš – nemůžeš přidávat poznámky';
      document.body.appendChild(notice);
    }

    await loadListPrefs(); // personal marks/pins/folder state before first list render
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
    setupBackups();
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

// ── Per-user, per-room list preferences (Firebase) ─────────────
// Folder open/closed state, the colored "puntíky" marks, and pins are
// personal — stored under the user's own profile so they sync across
// devices and survive cache clears, instead of living in localStorage.
// Shape: users/{uid}.roomPrefs[roomId] = { marks:{id:color}, pins:[id],
// collapsed:[folderId] }. Loaded once on room open into LIST_PREFS; writes
// are debounced and replace the whole per-room object (so deletions stick).
const MARK_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
let LIST_PREFS = { marks: {}, pins: new Set(), collapsed: new Set() };

async function loadListPrefs() {
  try {
    const snap = await db.collection('users').doc(ME.uid).get();
    const p = snap.exists ? (snap.data().roomPrefs || {})[ROOM_ID] : null;
    LIST_PREFS = {
      marks: (p && p.marks) || {},
      pins: new Set((p && p.pins) || []),
      collapsed: new Set((p && p.collapsed) || []),
    };
  } catch { LIST_PREFS = { marks: {}, pins: new Set(), collapsed: new Set() }; }
}

let _prefsSaveTimer = null;
function persistListPrefs() {
  clearTimeout(_prefsSaveTimer);
  _prefsSaveTimer = setTimeout(async () => {
    const obj = { marks: LIST_PREFS.marks, pins: [...LIST_PREFS.pins], collapsed: [...LIST_PREFS.collapsed] };
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
  return `
    <div class="notes-list-row" data-id="${note.id}"${(pins && pins.has(note.id)) ? ' data-pinned="1"' : ''} style="--row-color:${note.color || '#fef9c3'}">
      <div class="notes-list-dot"></div>
      <div class="notes-list-main">
        <div class="notes-list-title">${esc(title)}</div>
        <div class="notes-list-meta">${esc(note.authorName || 'Anon')} · ${fmtTs(note.updatedAt || note.createdAt)}</div>
      </div>
      ${moveBtn}
      ${markHtml(note.id, marks || {})}
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

  // ── Touch: one finger on empty canvas pans, two fingers pinch-zoom.
  // Notes handle their own touch drag in makeDraggable; the .note check
  // below keeps the board from panning underneath while a note is dragged.
  let touchPan = null;   // { x, y, sl, st }
  let pinch    = null;   // { dist, zoom }
  const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinch = { dist: touchDist(e.touches), zoom: BOARD_ZOOM };
      touchPan = null;
      e.preventDefault();
    } else if (e.touches.length === 1 && !e.target.closest('.note')) {
      const t = e.touches[0];
      touchPan = { x: t.clientX, y: t.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      setBoardZoom(pinch.zoom * (touchDist(e.touches) / pinch.dist));
    } else if (touchPan && e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      wrap.scrollLeft = touchPan.sl - (t.clientX - touchPan.x);
      wrap.scrollTop  = touchPan.st - (t.clientY - touchPan.y);
    }
  }, { passive: false });

  const endTouch = e => { if (e.touches.length < 2) pinch = null; if (e.touches.length === 0) touchPan = null; };
  wrap.addEventListener('touchend', endTouch);
  wrap.addEventListener('touchcancel', endTouch);
}

// ── Board zoom: mouse wheel (desktop) or pinch (touch, above) zooms the
//    board instead of scrolling the page/wrapper.
let BOARD_ZOOM = 1;
function setBoardZoom(z) {
  BOARD_ZOOM = Math.min(2.2, Math.max(0.15, z));
  document.getElementById('board').style.zoom = BOARD_ZOOM;
}
function setupBoardZoom() {
  const wrap = document.getElementById('boardWrap');
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    setBoardZoom(BOARD_ZOOM * (e.deltaY < 0 ? 1.08 : 0.92));
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
  // Anonymous guests can't create AI decks — they'd outlive the guest.
  if (ME.isAnonymous) { btn.style.display = 'none'; return; }
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
// One unified link builder: Trvalý/Dočasný type switch, role, and a "jen 1
// použití" flag. A plain permanent link reuses the room's inviteCode (no
// server write); anything temporary or single-use becomes a server-side
// entry in ROOM.tempInvites so it can expire, be consumed, or be revoked.
function setupShare() {
  const roleSelect = document.getElementById('inviteRoleSelect');
  const typeSelect = document.getElementById('inviteTypeSelect');
  const linkText   = document.getElementById('inviteLinkText');

  // Only the OWNER can create invites with editor rights — everyone else
  // (including viewers, who used to be able to self-escalate this way) gets
  // a viewer-only picker. The join flow enforces the friend rule on top.
  if (MY_ROLE !== 'owner') {
    roleSelect.querySelector('option[value="editor"]')?.remove();
    const hint = document.getElementById('editorInviteHint');
    if (hint) hint.style.display = 'block';
  }

  // Owner housekeeping: prune EXPIRED invites (exp:null = permanent one-shot
  // links — those never expire, only get consumed or revoked).
  if (MY_ROLE === 'owner' && ROOM.tempInvites) {
    const dead = Object.entries(ROOM.tempInvites).filter(([, t]) => t.exp != null && t.exp < Date.now());
    if (dead.length) {
      const update = {};
      dead.forEach(([c]) => { update[`tempInvites.${c}`] = firebase.firestore.FieldValue.delete(); delete ROOM.tempInvites[c]; });
      db.collection('rooms').doc(ROOM_ID).update(update).catch(() => {});
    }
  }

  // Duration inputs only make sense for the temporary type
  typeSelect.addEventListener('change', () => {
    document.getElementById('inviteDurWrap').style.display =
      typeSelect.value === 'temp' ? 'inline-flex' : 'none';
  });

  document.getElementById('shareBtn').addEventListener('click', () => {
    document.getElementById('inviteCode').textContent = ROOM.inviteCode || '------';
    renderTempInvites();
    openModal('shareModal');
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(ROOM.inviteCode || '').then(() => toast('Kód zkopírován!'));
  });

  document.getElementById('inviteGenBtn').addEventListener('click', async () => {
    const role = roleSelect.value;
    const once = document.getElementById('tempOnceChk').checked;
    const temp = typeSelect.value === 'temp';

    // Plain permanent link → just the classic inviteCode URL, nothing stored.
    if (!temp && !once) {
      const url = new URL('room.html', window.location.href);
      url.searchParams.set('id', ROOM_ID);
      url.searchParams.set('code', ROOM.inviteCode || '');
      url.searchParams.set('role', role);
      linkText.textContent = url.href;
      document.getElementById('inviteLinkBox').style.display = 'flex';
      return;
    }

    // Temporary and/or single-use → server-side invite entry.
    let exp = null;
    if (temp) {
      const val  = parseInt(document.getElementById('tempDurVal').value, 10);
      const unit = parseInt(document.getElementById('tempDurUnit').value, 10);
      if (!val || val < 1 || val > 999) { toast('Zadej platnou dobu (1–999).'); return; }
      exp = Date.now() + val * unit;
    }
    const code  = Array.from({ length: 10 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    const entry = { role, exp, by: ME.uid, once };
    try {
      await db.collection('rooms').doc(ROOM_ID).update({ [`tempInvites.${code}`]: entry });
      ROOM.tempInvites = { ...(ROOM.tempInvites || {}), [code]: entry };
      linkText.textContent = tempInviteUrl(code);
      document.getElementById('inviteLinkBox').style.display = 'flex';
      renderTempInvites();
      toast('Pozvánka vytvořena ✓');
    } catch (e) { toast('Chyba: ' + e.message); }
  });

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const t = linkText.textContent;
    if (t && t !== '–') navigator.clipboard.writeText(t).then(() => toast('Odkaz zkopírován!'));
  });
}

function tempInviteUrl(code) {
  const url = new URL('room.html', window.location.href);
  url.searchParams.set('id', ROOM_ID);
  url.searchParams.set('tcode', code);
  return url.href;
}

// Active temp invites with copy + revoke. The owner sees (and can revoke)
// all of them; other members only the ones they created.
function renderTempInvites() {
  const el = document.getElementById('tempInvitesList');
  if (!el) return;
  const mine = Object.entries(ROOM.tempInvites || {})
    .filter(([, t]) => t.exp == null || t.exp > Date.now())
    .filter(([, t]) => MY_ROLE === 'owner' || t.by === ME.uid)
    .sort((a, b) => (a[1].exp ?? Infinity) - (b[1].exp ?? Infinity));
  if (!mine.length) { el.innerHTML = ''; return; }

  el.innerHTML = `<label class="label" style="margin-bottom:6px;">Aktivní pozvánky</label>` +
    mine.map(([code, t]) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-muted);padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;">${roleLabel(t.role)} · ${t.exp == null ? 'trvalá' : 'do ' + new Date(t.exp).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${t.once ? ' · 1 použití' : ''}</span>
        <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.72rem;" data-copy-temp="${code}" title="Kopírovat odkaz">📋</button>
        <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.72rem;color:#fca5a5;" data-revoke-temp="${code}" title="Zrušit pozvánku">✕</button>
      </div>`).join('');

  el.querySelectorAll('[data-copy-temp]').forEach(b => b.addEventListener('click', () => {
    navigator.clipboard.writeText(tempInviteUrl(b.dataset.copyTemp)).then(() => toast('Odkaz zkopírován!'));
  }));
  el.querySelectorAll('[data-revoke-temp]').forEach(b => b.addEventListener('click', async () => {
    try {
      await db.collection('rooms').doc(ROOM_ID).update({
        [`tempInvites.${b.dataset.revokeTemp}`]: firebase.firestore.FieldValue.delete(),
      });
      delete ROOM.tempInvites[b.dataset.revokeTemp];
      renderTempInvites();
      toast('Pozvánka zrušena.');
    } catch (e) { toast('Chyba: ' + e.message); }
  }));
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

  // Backups (owner only)
  if (MY_ROLE === 'owner') {
    document.getElementById('backupsWrap').style.display = 'block';
  }

  // Leave room (everyone). Rooms are never deleted — instead, when the OWNER
  // leaves, ownership is handed to another member so the room lives on.
  const hint = document.getElementById('leaveRoomHint');
  if (MY_ROLE === 'owner') {
    hint.textContent = 'Místnost nelze smazat. Když ji opustíš, vlastnictví převezme jiný člen.';
  }
  document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
}

// Pick the member who inherits the room when the owner leaves: prefer an
// existing editor (most trusted), otherwise any remaining member.
function pickSuccessor() {
  const roles = ROOM.roles || {};
  const others = (ROOM.memberIds || []).filter(id => id !== ME.uid);
  if (!others.length) return null;
  return others.find(id => roles[id] === 'editor') || others[0];
}

function memberName(uid) {
  const m = (ROOM.members || {})[uid] || {};
  return m.displayName || m.email || 'další člen';
}

// The actual leave write, shared by the button and the expiry auto-kick.
// Returns false when leaving is impossible (sole-member owner).
async function performLeave() {
  const amOwner = MY_ROLE === 'owner';
  const successor = amOwner ? pickSuccessor() : null;
  if (amOwner && !successor) return false;

  const update = {
    memberIds:                  firebase.firestore.FieldValue.arrayRemove(ME.uid),
    [`roles.${ME.uid}`]:        firebase.firestore.FieldValue.delete(),
    [`members.${ME.uid}`]:      firebase.firestore.FieldValue.delete(),
    [`memberExpiry.${ME.uid}`]: firebase.firestore.FieldValue.delete(),
  };
  if (amOwner) {
    update.ownerId = successor;
    update[`roles.${successor}`] = 'owner';
  }
  await db.collection('rooms').doc(ROOM_ID).update(update);
  return true;
}

async function leaveRoom() {
  if (MY_ROLE === 'owner') {
    const successor = pickSuccessor();
    if (!successor) {
      toast('Jsi jediný člen — nejdřív někoho pozvi, komu se místnost předá.');
      return;
    }
    if (!confirm(`Opustit místnost? Vlastnictví převezme ${memberName(successor)}.`)) return;
  } else {
    if (!confirm('Opustit místnost? Ztratíš k ní přístup.')) return;
  }

  try {
    await performLeave();
    window.location.href = 'dashboard.html';
  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

// Is this member's temporary access already over? (No expiry = permanent.)
function memberExpired(uid) {
  const e = (ROOM.memberExpiry || {})[uid];
  return !!e && e < Date.now();
}

// Owner-side sweep of expired members (they can't be trusted to come back
// and remove themselves). One batched update for all of them.
async function purgeExpiredMembers() {
  const dead = (ROOM.memberIds || []).filter(uid => uid !== ME.uid && memberExpired(uid));
  if (!dead.length) return;
  const update = { memberIds: firebase.firestore.FieldValue.arrayRemove(...dead) };
  dead.forEach(uid => {
    update[`roles.${uid}`]        = firebase.firestore.FieldValue.delete();
    update[`members.${uid}`]      = firebase.firestore.FieldValue.delete();
    update[`memberExpiry.${uid}`] = firebase.firestore.FieldValue.delete();
  });
  try {
    await db.collection('rooms').doc(ROOM_ID).update(update);
    ROOM.memberIds = ROOM.memberIds.filter(id => !dead.includes(id));
    dead.forEach(uid => { delete ROOM.roles?.[uid]; delete ROOM.members?.[uid]; delete ROOM.memberExpiry?.[uid]; });
    updateMemberCount();
  } catch (_) { /* best effort */ }
}

// ── Temporary membership (anonymous guests, temp invites) ─────
// Client-side enforcement: when the expiry hits while the room is open, the
// member removes themselves and is sent back to the dashboard. A banner shows
// when the access ends.
function scheduleExpiryKick(expiry) {
  const notice = document.createElement('div');
  notice.className = 'viewer-notice';
  // Don't overlap the viewer notice if both are shown
  if (MY_ROLE === 'viewer') notice.style.top = '104px';
  notice.textContent = `⏳ Tvůj přístup vyprší v ${new Date(expiry).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`;
  document.body.appendChild(notice);

  const remaining = Math.min(expiry - Date.now(), 2147483647);
  setTimeout(async () => {
    await performLeave().catch(() => {});
    alert('Tvůj dočasný přístup do místnosti vypršel.');
    window.location.href = 'dashboard.html';
  }, remaining);
}

// ── Friends (shared with dashboard's friendRequests collection) ──
// Friendship = an *accepted* friendRequest in either direction. Loaded once
// and cached; `pending` covers both sent and received requests so the member
// list can show the right button state.
let FRIEND_STATE = null;
async function loadFriendState(force) {
  if (FRIEND_STATE && !force) return FRIEND_STATE;
  const [sent, received] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', ME.uid).get(),
    db.collection('friendRequests').where('toUid', '==', ME.uid).get(),
  ]);
  const accepted = new Set(), pending = new Set();
  const eat = (docSnap, otherField) => {
    const r = docSnap.data();
    if (r.status === 'accepted')     accepted.add(r[otherField]);
    else if (r.status === 'pending') pending.add(r[otherField]);
  };
  sent.docs.forEach(d => eat(d, 'toUid'));
  received.docs.forEach(d => eat(d, 'fromUid'));
  FRIEND_STATE = { accepted, pending };
  return FRIEND_STATE;
}

async function sendFriendRequestTo(uid, member) {
  try {
    await db.collection('friendRequests').add({
      fromUid:   ME.uid,
      fromName:  ME.displayName || ME.email,
      fromEmail: (ME.email || '').toLowerCase(),
      fromPhoto: ME.photoURL || null,
      toUid:     uid,
      toEmail:   (member.email || '').toLowerCase(),
      status:    'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    FRIEND_STATE?.pending.add(uid);
    toast('Žádost o přátelství odeslána!');
    renderMembers();
  } catch (e) { toast('Chyba: ' + e.message); }
}

function closePanel() {
  document.getElementById('panelBack').classList.remove('open');
}

// ── Backups (owner-only, durable snapshots in Firestore) ──────
const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // auto-backup at most every 12h
const BACKUP_KEEP        = 24;                   // keep the newest N (≈12 days)

function backupsCol() { return db.collection('rooms').doc(ROOM_ID).collection('backups'); }

// Snapshot the whole room into ONE backup doc: notes + connections + folders
// as arrays (with their original ids preserved so restore can recreate them
// exactly, keeping connection endpoints and folder membership valid).
async function createBackup(auto) {
  const [notesSnap, connsSnap, foldersSnap] = await Promise.all([
    db.collection('rooms').doc(ROOM_ID).collection('notes').get(),
    db.collection('rooms').doc(ROOM_ID).collection('connections').get(),
    db.collection('rooms').doc(ROOM_ID).collection('folders').get(),
  ]);
  const dump = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const notes = dump(notesSnap), connections = dump(connsSnap), folders = dump(foldersSnap);

  await backupsCol().add({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: ME.uid,
    auto: !!auto,
    counts: { notes: notes.length, connections: connections.length, folders: folders.length },
    notes, connections, folders,
  });

  // Prune old backups beyond the keep limit so storage doesn't grow forever.
  const all = await backupsCol().orderBy('createdAt', 'desc').get();
  if (all.size > BACKUP_KEEP) {
    const batch = db.batch();
    all.docs.slice(BACKUP_KEEP).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// Called once on owner room-load: if the newest backup is older than 12h (or
// none exists), make a fresh automatic one. This is the serverless stand-in
// for a scheduled job — it can only fire while the owner has the room open.
async function maybeAutoBackup() {
  try {
    const latest = await backupsCol().orderBy('createdAt', 'desc').limit(1).get();
    const lastMs = latest.empty ? 0 : (latest.docs[0].data().createdAt?.toMillis?.() || 0);
    if (Date.now() - lastMs >= BACKUP_INTERVAL_MS) await createBackup(true);
  } catch (_) { /* backups are best-effort; never block the room */ }
}

function setupBackups() {
  if (MY_ROLE !== 'owner') return;
  maybeAutoBackup();

  document.getElementById('backupsBtn').addEventListener('click', () => {
    openModal('backupsModal');
    renderBackupsList();
  });

  document.getElementById('backupNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('backupNowBtn');
    btn.disabled = true; btn.textContent = 'Zálohuji…';
    try { await createBackup(false); toast('Záloha vytvořena ✓'); renderBackupsList(); }
    catch (e) { toast('Chyba: ' + e.message); }
    btn.disabled = false; btn.textContent = '💾 Zálohovat teď';
  });
}

async function renderBackupsList() {
  const el = document.getElementById('backupsList');
  el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Načítám…</div>';
  try {
    const snap = await backupsCol().orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Zatím žádné zálohy.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const b = d.data();
      const when = b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString('cs-CZ', { day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
      const c = b.counts || {};
      return `
        <div class="backup-row">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.86rem;font-weight:600;">${b.auto ? '🕛' : '💾'} ${esc(when)}</div>
            <div style="font-size:0.74rem;color:var(--text-muted);">${c.notes||0} poznámek · ${c.connections||0} propojení · ${c.folders||0} složek</div>
          </div>
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:0.78rem;" data-restore="${d.id}">Obnovit</button>
        </div>`;
    }).join('');

    el.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmModal('Obnovit tuto zálohu? Současný obsah místnosti (poznámky, propojení, složky) se nahradí stavem ze zálohy.', () => restoreBackup(btn.dataset.restore));
      });
    });
  } catch (e) {
    el.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;padding:10px;">Chyba: ${esc(e.message)}</div>`;
  }
}

// Wipe the current notes/connections/folders and recreate them from the
// backup, reusing the original doc ids. Firestore batches cap at 500 writes,
// so everything is chunked.
async function restoreBackup(backupId) {
  const btn = document.querySelector(`[data-restore="${backupId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Obnovuji…'; }
  try {
    const doc = await backupsCol().doc(backupId).get();
    if (!doc.exists) { toast('Záloha nenalezena.'); return; }
    const b = doc.data();
    const roomRef = db.collection('rooms').doc(ROOM_ID);

    // 1) Safety backup of the CURRENT state first, so a restore is itself
    //    undoable if it wasn't what the owner wanted.
    await createBackup(true);

    // 2) Gather every current doc to delete, then all recreations, and run
    //    them as ordered chunks of ≤450 writes.
    const [curNotes, curConns, curFolders] = await Promise.all([
      roomRef.collection('notes').get(),
      roomRef.collection('connections').get(),
      roomRef.collection('folders').get(),
    ]);

    const ops = [];
    curNotes.docs.forEach(d => ops.push(['del', d.ref]));
    curConns.docs.forEach(d => ops.push(['del', d.ref]));
    curFolders.docs.forEach(d => ops.push(['del', d.ref]));
    (b.notes || []).forEach(n => { const { id, ...data } = n; ops.push(['set', roomRef.collection('notes').doc(id), data]); });
    (b.connections || []).forEach(c => { const { id, ...data } = c; ops.push(['set', roomRef.collection('connections').doc(id), data]); });
    (b.folders || []).forEach(f => { const { id, ...data } = f; ops.push(['set', roomRef.collection('folders').doc(id), data]); });

    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(([kind, ref, data]) => kind === 'del' ? batch.delete(ref) : batch.set(ref, data));
      await batch.commit();
    }

    closeModal('backupsModal');
    toast('Záloha obnovena ✓');
  } catch (e) {
    toast('Chyba při obnově: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Obnovit'; }
  }
}

function updateMemberCount() {
  const ids = (ROOM.memberIds || []).filter(uid => !memberExpired(uid));
  document.getElementById('memberCount').textContent = ids.length;
}

async function renderMembers() {
  const list    = document.getElementById('membersList');
  const members = ROOM.members || {};
  const roles   = ROOM.roles   || {};
  // Hide members whose temporary access already ran out — the owner's sweep
  // removes them from the doc, but the list shouldn't show them even before
  // that happens.
  const ids = (ROOM.memberIds || []).filter(uid => !memberExpired(uid));
  if (MY_ROLE === 'owner') purgeExpiredMembers();

  if (!ids.length) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Žádní členové.</p>';
    return;
  }

  // Friend states drive both the "add friend" buttons and the
  // editor-only-for-friends guard on the role select.
  let friends = { accepted: new Set(), pending: new Set() };
  try { friends = await loadFriendState(); } catch (_) { /* best effort */ }

  list.innerHTML = '';
  ids.forEach(uid => {
    const m      = members[uid] || {};
    const role   = roles[uid] || 'viewer';
    const isMe   = uid === ME.uid;
    const canMng = MY_ROLE === 'owner' && !isMe;

    const row = document.createElement('div');
    row.className = 'member-row';

    // Expiring membership (guests, temp invites) — show until when
    const exp = (ROOM.memberExpiry || {})[uid];
    const expLabel = exp
      ? `<div class="m-email">⏳ do ${new Date(exp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>`
      : '';

    // Friend button: not for myself, not for anonymous guests as TARGETS,
    // and not at all when I'M the anonymous guest (guests have no friends).
    let friendHtml = '';
    if (!isMe && !m.isAnon && !ME.isAnonymous) {
      if (friends.accepted.has(uid))     friendHtml = `<span style="font-size:0.68rem;color:var(--text-muted);">👥 Přítel</span>`;
      else if (friends.pending.has(uid)) friendHtml = `<span style="font-size:0.68rem;color:var(--text-muted);">⏳ Žádost čeká</span>`;
      else friendHtml = `<button class="btn btn-ghost" style="padding:3px 8px;font-size:0.7rem;" data-add-friend="${uid}">➕ Přítel</button>`;
    }

    row.innerHTML = `
      <div class="m-avatar">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
      <div class="m-info">
        <div class="m-name">${esc(m.displayName || m.email || uid)}${isMe ? ' <span style="color:var(--text-muted);font-weight:400;">(ty)</span>' : ''}</div>
        <div class="m-email">${esc(m.email || '')}</div>
        ${expLabel}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
        ${canMng
          ? `<div style="display:flex;gap:6px;align-items:center;">
               <select class="role-select" data-uid="${uid}">
                 <option value="editor" ${role === 'editor' ? 'selected' : ''}>Editor</option>
                 <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Prohlížeč</option>
               </select>
               <button class="btn btn-danger" style="padding:4px 8px;font-size:0.72rem;" data-rm="${uid}">✕</button>
             </div>`
          : `<span class="role-badge role-${role}">${roleLabel(role)}</span>`
        }
        ${friendHtml}
      </div>`;

    // Role change — editor is reserved for the owner's friends.
    const sel = row.querySelector('.role-select');
    if (sel) {
      sel.addEventListener('change', async () => {
        if (sel.value === 'editor' && !friends.accepted.has(uid)) {
          sel.value = role; // revert
          toast('Editora může mít jen tvůj přítel. Nejdřív si ho přidej do přátel.');
          return;
        }
        try {
          await db.collection('rooms').doc(ROOM_ID).update({ [`roles.${uid}`]: sel.value });
          ROOM.roles[uid] = sel.value;
          toast('Oprávnění změněno.');
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    }

    // Send friend request straight from the member list
    const addBtn = row.querySelector('[data-add-friend]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addBtn.disabled = true;
        sendFriendRequestTo(uid, m);
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

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
const WHITEBOARDS_MAP = new Map(); // wbId → whiteboard data (drawable "tabule", behind notes)

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
    setupActivityLog();
    setupSearch();
    setupPresence();
    setupConnections();
    setupWhiteboards();
    setupBoardContextMenu();
    setupLightbox();
    setupModalClose();
    updateMemberCount();
    refreshMembersBadge(); // pending friend-request badge on the members button

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
  const deleted = NOTES_MAP.get(id);
  const label = deleted ? (deleted.title || noteToPlainText(deleted).slice(0, 40) || 'poznámku') : 'poznámku';
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
    logActivity('note', `smazal poznámku „${label}"`);
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

// ══ Whiteboards ("tabule") ════════════════════════════════════
// Bounded, growable freehand drawing surfaces that live BEHIND the notes
// (z-index 0). Created from the board's right-click menu. Strokes are stored
// as an array on the whiteboard doc (polylines in board-local coords),
// appended with arrayUnion so concurrent drawing merges and removed with
// arrayRemove for undo. A tabule can be grown but never shrunk below the
// bounding box of what's already drawn on it.
// Global drawing tool state (shared across all tabule):
//  type: pen | pencil | marker | spray | line | rect | ellipse | text
//  mode: draw | erase | pick | fill
const WB_TOOL = { color: '#111827', width: 3, type: 'pen', mode: 'draw' };
let WB_NEW_TEXT_FOCUS = null; // id of a just-created text box to focus after render
let WB_EDITING_TEXT = null;   // id of the text box currently being edited (don't clobber it)
const WB_REDO = new Map();    // wbId → [strokes removed by undo, newest last] for redo

function wbCol() { return db.collection('rooms').doc(ROOM_ID).collection('whiteboards'); }

// Bounding box of everything drawn (whiteboard-local coords). Fill strokes are
// skipped — their points are the seed + a clip rectangle, not visible extent,
// so counting them would wrongly force the min resize size to the full canvas.
function wbBBox(wb) {
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0, has = false;
  (wb.strokes || []).forEach(s => {
    if (s.t === 'fill') return;
    for (let i = 0; i + 1 < s.pts.length; i += 2) {
      has = true;
      const x = s.pts[i], y = s.pts[i + 1];
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  });
  return { has, minX, minY, maxX, maxY };
}

function hexToRgb(hex) {
  const h = (hex || '#000000').replace('#', '');
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
}

// Scanline flood fill (paint bucket) on the canvas pixels, starting at (sx,sy).
// Replaces the contiguous same-coloured region with `hex`. Runs during redraw
// at the fill stroke's position in the sequence, so it's deterministic.
// The fill is clipped to the rectangle [cx0,cy0)–[cx1,cy1) — that's the tabule
// size at the moment of filling, so growing the tabule later never lets the
// fill bleed into the freshly-added empty space.
function floodFill(ctx, w, h, sx, sy, hex, cx0, cy0, cx1, cy1) {
  sx = Math.round(sx); sy = Math.round(sy);
  const x0 = Math.max(0, Math.round(cx0 ?? 0)), y0c = Math.max(0, Math.round(cy0 ?? 0));
  const x1 = Math.min(w, Math.round(cx1 ?? w)), y1 = Math.min(h, Math.round(cy1 ?? h));
  if (sx < x0 || sy < y0c || sx >= x1 || sy >= y1) return;
  if (w * h > 4_000_000) { toast('Tabule je příliš velká na vylití.'); return; }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const idx = (x, y) => (y * w + x) * 4;
  const si = idx(sx, sy);
  const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
  const [fr, fg, fb] = hexToRgb(hex), fa = 255;
  if (tr === fr && tg === fg && tb === fb && ta === fa) return; // already that colour
  const match = i => d[i] === tr && d[i + 1] === tg && d[i + 2] === tb && d[i + 3] === ta;
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, ys] = stack.pop();
    let y = ys;
    while (y >= y0c && match(idx(x, y))) y--;
    y++;
    let reachL = false, reachR = false;
    while (y < y1 && match(idx(x, y))) {
      const ci = idx(x, y);
      d[ci] = fr; d[ci + 1] = fg; d[ci + 2] = fb; d[ci + 3] = fa;
      if (x > x0)     { if (match(idx(x - 1, y))) { if (!reachL) { stack.push([x - 1, y]); reachL = true; } } else reachL = false; }
      if (x < x1 - 1) { if (match(idx(x + 1, y))) { if (!reachR) { stack.push([x + 1, y]); reachR = true; } } else reachR = false; }
      y++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const WB_SHAPES = ['line', 'rect', 'ellipse'];

// Deterministic PRNG so spray strokes redraw with the same speckle pattern
// every time (seeded from the stroke id).
function wbSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function canDrawWb() { return MY_ROLE === 'owner' || MY_ROLE === 'editor'; }
function wbId() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); }

function setupWhiteboards() {
  wbCol().onSnapshot(snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') {
        WHITEBOARDS_MAP.delete(ch.doc.id);
        document.getElementById('wb-' + ch.doc.id)?.remove();
        return;
      }
      const data = { id: ch.doc.id, ...ch.doc.data() };
      WHITEBOARDS_MAP.set(ch.doc.id, data);
      renderWhiteboard(data);
    });
  }, () => {});
}

async function createWhiteboard(storeX, storeY) {
  if (!canDrawWb()) { toast('Tabuli může přidat jen editor.'); return; }
  try {
    await wbCol().add({
      x: Math.round(storeX), y: Math.round(storeY),
      w: 460, h: 320,
      authorId: ME.uid, authorName: ME.displayName || ME.email,
      strokes: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    logActivity('board', 'přidal tabuli');
  } catch (e) { toast('Chyba: ' + e.message); }
}

function drawOneStroke(ctx, s) {
  if (!s.pts || s.pts.length < 2) return;
  const col = s.c || '#111827', w = s.w || 3, pts = s.pts;

  // Paint bucket: flood fill from the seed point, clipped to the tabule size
  // recorded at fill time (pts[2..5], if present).
  if (s.t === 'fill') { floodFill(ctx, ctx.canvas.width, ctx.canvas.height, pts[0], pts[1], col, pts[2], pts[3], pts[4], pts[5]); return; }

  ctx.save();
  // Eraser: clear pixels (reveals the tabule background behind).
  if (s.e) { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle = 'rgba(0,0,0,1)'; }
  else     { ctx.strokeStyle = col; ctx.fillStyle = col; }

  // Geometric shapes (line / rectangle / ellipse) — drawn from start→end.
  if (WB_SHAPES.includes(s.t) && pts.length >= 4) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.e ? w * 2 : w;
    const x0 = pts[0], y0 = pts[1], x1 = pts[2], y1 = pts[3];
    ctx.beginPath();
    if (s.t === 'line') { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    else if (s.t === 'rect') { ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
    else { ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2); }
    ctx.stroke();
    ctx.restore(); return;
  }

  if (s.t === 'spray' && !s.e) {
    const rng = wbSeed(s.id || 'x');
    const R = w * 1.6, dots = Math.max(3, Math.round(w * 1.2));
    for (let i = 0; i + 1 < pts.length; i += 2) {
      for (let k = 0; k < dots; k++) {
        const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R;
        ctx.beginPath(); ctx.arc(pts[i] + Math.cos(a) * rr, pts[i + 1] + Math.sin(a) * rr, 0.7, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore(); return;
  }

  // Line-based tools
  ctx.lineJoin = 'round';
  if (s.t === 'marker' && !s.e) { ctx.globalAlpha = 0.35; ctx.lineCap = 'butt'; ctx.lineWidth = w * 2.4; }
  else if (s.t === 'pencil' && !s.e) { ctx.globalAlpha = 0.85; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, w * 0.8); }
  else { ctx.lineCap = 'round'; ctx.lineWidth = s.e ? w * 2 : w; } // pen / eraser

  if (pts.length === 2) { // single tap → dot
    ctx.beginPath(); ctx.arc(pts[0], pts[1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return;
  }
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.restore();
}

function redrawWbCanvas(canvas, wb) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  (wb.strokes || []).forEach(s => drawOneStroke(ctx, s));
}

function renderWhiteboard(wb) {
  let el = document.getElementById('wb-' + wb.id);
  const creating = !el;
  if (creating) {
    el = document.createElement('div');
    el.className = 'whiteboard';
    el.id = 'wb-' + wb.id;
    const editable = canDrawWb();
    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
      .map(d => `<div class="wb-h wb-h-${d}" data-dir="${d}"></div>`).join('');
    el.innerHTML = `
      <canvas class="wb-canvas"></canvas>
      ${editable ? '<div class="wb-brush"></div>' : ''}
      ${editable ? `
      <div class="wb-bar">
        <button class="wb-btn wb-draw" title="Zapnout/vypnout kreslení">✏️</button>
        <select class="wb-type" title="Nástroj">
          <option value="pen">🖊️ Pero</option>
          <option value="pencil">✏️ Tužka</option>
          <option value="marker">🖍️ Zvýrazňovač</option>
          <option value="spray">💨 Sprej</option>
          <option value="line">／ Čára</option>
          <option value="rect">▭ Obdélník</option>
          <option value="ellipse">◯ Elipsa</option>
          <option value="text">🔤 Text</option>
        </select>
        <button class="wb-btn wb-erase" title="Guma">🧽</button>
        <button class="wb-btn wb-fill" title="Kýbl – vylít plochu barvou">🪣</button>
        <button class="wb-btn wb-pick" title="Kapátko – vybrat barvu z kresby">💧</button>
        <input type="color" class="wb-color" value="${WB_TOOL.color}" title="Barva">
        <input type="range"  class="wb-wrange" min="1" max="40" value="${WB_TOOL.width}" title="Tloušťka">
        <input type="number" class="wb-wnum"   min="1" max="40" value="${WB_TOOL.width}" title="Tloušťka">
        <button class="wb-btn wb-undo" title="Zpět (můj tah)">↶</button>
        <button class="wb-btn wb-redo" title="Znovu">↷</button>
        <span class="wb-spacer"></span>
        <button class="wb-btn wb-del" title="Smazat tabuli">🗑️</button>
      </div>` : `<div class="wb-bar wb-bar-ro"><span style="font-size:.7rem;opacity:.7;">🖊️ Tabule</span></div>`}
      ${editable ? handles : ''}`;
    // Behind notes: z-index 0 via CSS. Board grid shows through transparent bits.
    document.getElementById('board').appendChild(el);
    el.classList.toggle('text-mode', WB_TOOL.type === 'text' && WB_TOOL.mode === 'draw');
    if (canDrawWb()) wireWhiteboard(el, wb.id);
  }

  // Position + size (rendered coords)
  el.style.left   = toRenderX(wb.x) + 'px';
  el.style.top    = toRenderY(wb.y) + 'px';
  el.style.width  = wb.w + 'px';
  el.style.height = wb.h + 'px';
  const canvas = el.querySelector('.wb-canvas');
  if (canvas.width !== wb.w || canvas.height !== wb.h) { canvas.width = wb.w; canvas.height = wb.h; }
  redrawWbCanvas(canvas, wb);
  renderWhiteboardTexts(el, wb);
  expandBoardIfNeeded(el);
}

// Reconcile the editable DOM text boxes to match wb.texts. A box that's being
// edited right now is left untouched (so typing/caret aren't clobbered by an
// echoing snapshot).
function renderWhiteboardTexts(el, wb) {
  const texts = wb.texts || [];
  const ids = new Set(texts.map(t => t.id));
  const editable = canDrawWb();
  // Remove stale boxes
  el.querySelectorAll('.wb-text').forEach(node => { if (!ids.has(node.dataset.tid)) node.remove(); });
  texts.forEach(t => {
    let node = el.querySelector(`.wb-text[data-tid="${t.id}"]`);
    if (t.id === WB_EDITING_TEXT && node) { // only reposition, don't touch content/caret
      node.style.left = t.x + 'px'; node.style.top = t.y + 'px';
      node.style.width = t.w + 'px'; node.style.height = t.h + 'px';
      return;
    }
    if (!node) {
      node = document.createElement('div');
      node.className = 'wb-text'; node.dataset.tid = t.id;
      node.innerHTML = `<div class="wb-text-body"${editable ? ' contenteditable="true"' : ''}></div>` +
        (editable ? '<div class="wb-text-move" title="Přesunout">✥</div><div class="wb-text-rz" title="Změnit velikost"></div><button class="wb-text-del" title="Smazat">✕</button>' : '');
      el.appendChild(node);
      if (editable) wireTextBox(el, node, wb.id);
    }
    node.style.left = t.x + 'px'; node.style.top = t.y + 'px';
    node.style.width = t.w + 'px'; node.style.height = t.h + 'px';
    node.style.color = t.c || '#111827';
    node.style.fontSize = (t.fs || 18) + 'px';
    const body = node.querySelector('.wb-text-body');
    if (body.textContent !== (t.txt || '')) body.textContent = t.txt || '';
  });

  // A freshly created box: focus it for immediate typing.
  if (WB_NEW_TEXT_FOCUS && ids.has(WB_NEW_TEXT_FOCUS)) {
    const node = el.querySelector(`.wb-text[data-tid="${WB_NEW_TEXT_FOCUS}"] .wb-text-body`);
    WB_NEW_TEXT_FOCUS = null;
    if (node) setTimeout(() => node.focus(), 0);
  }
}

// Save the whole texts array (small; rewritten wholesale on any change).
async function saveWbTexts(wbId, texts) {
  try { await wbCol().doc(wbId).update({ texts }); } catch (e) { toast('Chyba: ' + e.message); }
}

function wireTextBox(el, node, wbId) {
  const tid = node.dataset.tid;
  const body = node.querySelector('.wb-text-body');
  const getT = () => (WHITEBOARDS_MAP.get(wbId).texts || []).find(t => t.id === tid);
  const writeT = patch => {
    const texts = (WHITEBOARDS_MAP.get(wbId).texts || []).map(t => t.id === tid ? { ...t, ...patch } : t);
    return saveWbTexts(wbId, texts);
  };

  // ── Editing (debounced save) ──
  let saveTimer = null;
  body.addEventListener('focus', () => { WB_EDITING_TEXT = tid; });
  body.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => writeT({ txt: body.textContent }), 500); });
  body.addEventListener('keydown', e => e.stopPropagation()); // don't trigger board shortcuts
  body.addEventListener('blur', async () => {
    WB_EDITING_TEXT = null; clearTimeout(saveTimer);
    const txt = body.textContent;
    if (!txt.trim()) { // empty box → delete it
      const texts = (WHITEBOARDS_MAP.get(wbId).texts || []).filter(t => t.id !== tid);
      await saveWbTexts(wbId, texts);
    } else await writeT({ txt });
  });
  body.addEventListener('mousedown', e => e.stopPropagation()); // click to edit, don't draw/pan

  // ── Delete ──
  node.querySelector('.wb-text-del').addEventListener('click', async e => {
    e.stopPropagation();
    const texts = (WHITEBOARDS_MAP.get(wbId).texts || []).filter(t => t.id !== tid);
    await saveWbTexts(wbId, texts);
  });

  // ── Move (drag the ✥ grip) ──
  node.querySelector('.wb-text-move').addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault();
    const t0 = getT(); if (!t0) return;
    const sx = e.clientX, sy = e.clientY, ox = t0.x, oy = t0.y;
    let nx = ox, ny = oy;
    const mv = ev => { nx = Math.round(ox + (ev.clientX - sx) / BOARD_ZOOM); ny = Math.round(oy + (ev.clientY - sy) / BOARD_ZOOM); node.style.left = nx + 'px'; node.style.top = ny + 'px'; };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); writeT({ x: nx, y: ny }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });

  // ── Resize FREELY (grow AND shrink — so a raised height can be brought
  //    back down again) ──
  node.querySelector('.wb-text-rz').addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault();
    const t0 = getT(); if (!t0) return;
    const sx = e.clientX, sy = e.clientY, ow = t0.w, oh = t0.h;
    let nw = ow, nh = oh;
    const mv = ev => { nw = Math.max(40, Math.round(ow + (ev.clientX - sx) / BOARD_ZOOM)); nh = Math.max(24, Math.round(oh + (ev.clientY - sy) / BOARD_ZOOM)); node.style.width = nw + 'px'; node.style.height = nh + 'px'; };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); writeT({ w: nw, h: nh }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
}

// Map a pointer event to whiteboard-local canvas coords, undoing board zoom.
// Clamped to the canvas so a stroke that runs off the edge can't store
// out-of-bounds points (which would blow up the resize bounding box and make
// the tabule grow / refuse to shrink).
function wbLocalPoint(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = Math.round((clientX - r.left) * (canvas.width / r.width));
  const y = Math.round((clientY - r.top) * (canvas.height / r.height));
  return [Math.max(0, Math.min(canvas.width, x)), Math.max(0, Math.min(canvas.height, y))];
}

function wireWhiteboard(el, id) {
  const canvas = el.querySelector('.wb-canvas');
  const drawBtn = el.querySelector('.wb-draw');
  const colorInp = el.querySelector('.wb-color');
  const typeSel = el.querySelector('.wb-type');
  const eraseBtn = el.querySelector('.wb-erase');
  const fillBtn = el.querySelector('.wb-fill');
  const pickBtn = el.querySelector('.wb-pick');
  const wrange = el.querySelector('.wb-wrange');
  const wnum = el.querySelector('.wb-wnum');

  const syncToolButtons = () => {
    eraseBtn.classList.toggle('active', WB_TOOL.mode === 'erase');
    fillBtn.classList.toggle('active', WB_TOOL.mode === 'fill');
    pickBtn.classList.toggle('active', WB_TOOL.mode === 'pick');
    typeSel.value = WB_TOOL.type;
    // Text boxes are only interactive (edit/move/resize) with the Text tool
    // active — otherwise a drawing tool passes through them.
    document.querySelectorAll('.whiteboard').forEach(w =>
      w.classList.toggle('text-mode', WB_TOOL.type === 'text' && WB_TOOL.mode === 'draw'));
  };

  drawBtn.addEventListener('click', () => {
    const on = el.classList.toggle('drawing');
    drawBtn.classList.toggle('active', on);
  });
  typeSel.addEventListener('change', () => { WB_TOOL.type = typeSel.value; WB_TOOL.mode = 'draw'; syncToolButtons(); });
  eraseBtn.addEventListener('click', () => { WB_TOOL.mode = WB_TOOL.mode === 'erase' ? 'draw' : 'erase'; syncToolButtons(); });
  fillBtn.addEventListener('click', () => { WB_TOOL.mode = WB_TOOL.mode === 'fill' ? 'draw' : 'fill'; syncToolButtons(); });
  pickBtn.addEventListener('click', () => { WB_TOOL.mode = WB_TOOL.mode === 'pick' ? 'draw' : 'pick'; syncToolButtons(); });
  colorInp.addEventListener('input', () => { WB_TOOL.color = colorInp.value; if (WB_TOOL.mode === 'pick') { WB_TOOL.mode = 'draw'; syncToolButtons(); } });

  // Thickness: slider + number field kept in lock-step.
  const setWidth = v => {
    v = Math.max(1, Math.min(40, parseInt(v, 10) || 1));
    WB_TOOL.width = v; wrange.value = v; wnum.value = v;
  };
  wrange.addEventListener('input', () => setWidth(wrange.value));
  wnum.addEventListener('input', () => setWidth(wnum.value));

  // Eyedropper: sample the pixel colour under the cursor into the palette.
  const pickColorAt = (cx, cy) => {
    let [x, y] = wbLocalPoint(canvas, cx, cy);
    x = Math.max(0, Math.min(canvas.width - 1, x));
    y = Math.max(0, Math.min(canvas.height - 1, y));
    const d = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
    if (d[3] < 12) { toast('Tady nic není — klikni na kresbu.'); return; }
    const hex = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('');
    WB_TOOL.color = hex; colorInp.value = hex;
    WB_TOOL.mode = 'draw'; syncToolButtons();
  };

  // Commit a one-shot stroke (fill bucket, text) that needs no drag.
  const commitStroke = async s => {
    WB_REDO.delete(id); // a genuinely new stroke invalidates the redo stack
    try { await wbCol().doc(id).update({ strokes: firebase.firestore.FieldValue.arrayUnion(s) }); }
    catch (e) { toast('Chyba: ' + e.message); }
  };

  // ── Drawing / erasing / shapes / fill / text-box ──
  // Text is NOT baked into the canvas: dragging a rectangle with the text tool
  // creates a real, editable DOM text box (see createTextBox); `textDrag`
  // holds the rubber-band rectangle while you size it.
  let stroke = null, shapeMode = false, textDrag = null;
  const startDraw = (cx, cy) => {
    if (!el.classList.contains('drawing')) return false;
    if (WB_TOOL.mode === 'pick') { pickColorAt(cx, cy); return false; }
    const p = wbLocalPoint(canvas, cx, cy);
    if (WB_TOOL.mode === 'draw' && WB_TOOL.type === 'text') { textDrag = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }; return true; }
    if (WB_TOOL.mode === 'fill') { commitStroke({ id: wbId(), by: ME.uid, c: WB_TOOL.color, t: 'fill', pts: [p[0], p[1], 0, 0, canvas.width, canvas.height] }); return false; }
    shapeMode = WB_TOOL.mode === 'draw' && WB_SHAPES.includes(WB_TOOL.type);
    stroke = { id: wbId(), by: ME.uid, c: WB_TOOL.color, w: WB_TOOL.width, t: WB_TOOL.type, pts: p };
    if (WB_TOOL.mode === 'erase') { stroke.e = true; stroke.t = 'pen'; shapeMode = false; }
    return true;
  };
  const drawTextDragPreview = () => {
    const wb = WHITEBOARDS_MAP.get(id);
    redrawWbCanvas(canvas, wb || { strokes: [] });
    const ctx = canvas.getContext('2d');
    const x = Math.min(textDrag.x0, textDrag.x1), y = Math.min(textDrag.y0, textDrag.y1);
    const w = Math.abs(textDrag.x1 - textDrag.x0), h = Math.abs(textDrag.y1 - textDrag.y0);
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(99,102,241,0.9)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h); ctx.restore();
  };
  const moveDraw = (cx, cy) => {
    const [x, y] = wbLocalPoint(canvas, cx, cy);
    if (textDrag) { textDrag.x1 = x; textDrag.y1 = y; drawTextDragPreview(); return; }
    if (!stroke) return;
    if (shapeMode) {
      stroke.pts = [stroke.pts[0], stroke.pts[1], x, y];
    } else {
      const n = stroke.pts.length;
      if (n >= 2 && Math.abs(x - stroke.pts[n - 2]) < 2 && Math.abs(y - stroke.pts[n - 1]) < 2) return;
      stroke.pts.push(x, y);
    }
    const wb = WHITEBOARDS_MAP.get(id);
    redrawWbCanvas(canvas, { strokes: [...(wb.strokes || []), stroke] });
  };
  const endDraw = async () => {
    if (textDrag) { const td = textDrag; textDrag = null; redrawWbCanvas(canvas, WHITEBOARDS_MAP.get(id) || { strokes: [] }); await createTextBox(td); return; }
    if (!stroke) return;
    const s = stroke; stroke = null; const wasShape = shapeMode; shapeMode = false;
    // A shape needs an actual drag (start≠end) — a plain click makes nothing.
    if (wasShape && s.pts.length < 4) { redrawWbCanvas(canvas, WHITEBOARDS_MAP.get(id) || { strokes: [] }); return; }
    await commitStroke(s);
  };

  // Create a text box from the dragged rectangle (a tiny drag → default size),
  // then focus it for immediate typing.
  const createTextBox = async td => {
    let x = Math.min(td.x0, td.x1), y = Math.min(td.y0, td.y1);
    let w = Math.abs(td.x1 - td.x0), h = Math.abs(td.y1 - td.y0);
    if (w < 12 && h < 12) { w = 180; h = 46; }
    w = Math.max(40, Math.round(w)); h = Math.max(24, Math.round(h));
    const t = { id: wbId(), by: ME.uid, x: Math.round(x), y: Math.round(y), w, h,
      c: WB_TOOL.color, fs: Math.max(12, Math.round(WB_TOOL.width * 4)), txt: '' };
    const wb = WHITEBOARDS_MAP.get(id);
    const texts = [...(wb.texts || []), t];
    WB_NEW_TEXT_FOCUS = t.id;
    try { await wbCol().doc(id).update({ texts }); } catch (e) { toast('Chyba: ' + e.message); }
  };

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!startDraw(e.clientX, e.clientY)) { if (el.classList.contains('drawing')) { e.stopPropagation(); e.preventDefault(); } return; }
    e.stopPropagation(); e.preventDefault();
  });
  window.addEventListener('mousemove', e => { if (stroke || textDrag) moveDraw(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (stroke || textDrag) endDraw(); });

  // ── Brush-size preview: a circle following the cursor that shows how thick
  //    the next mark will be (before you even draw). Hidden for tools where a
  //    round footprint makes no sense (text / fill / eyedropper). ──
  const brush = el.querySelector('.wb-brush');
  const brushDiameter = () => {
    const w = WB_TOOL.width;
    if (WB_TOOL.mode === 'erase') return w * 2;
    if (WB_TOOL.mode !== 'draw') return 0;              // pick / fill
    if (WB_TOOL.type === 'text') return 0;
    if (WB_TOOL.type === 'marker') return w * 2.4;
    if (WB_TOOL.type === 'pencil') return Math.max(1, w * 0.8);
    if (WB_TOOL.type === 'spray') return w * 3.2;
    return w;                                            // pen / line / rect / ellipse
  };
  canvas.addEventListener('mousemove', e => {
    const d = brushDiameter();
    if (!d) { brush.style.display = 'none'; return; }
    const [x, y] = wbLocalPoint(canvas, e.clientX, e.clientY);
    const [r, g, b] = hexToRgb(WB_TOOL.color);
    brush.style.display = 'block';
    brush.style.width = brush.style.height = d + 'px';
    brush.style.left = (x - d / 2) + 'px';
    brush.style.top = (y - d / 2) + 'px';
    brush.style.background = WB_TOOL.mode === 'erase' ? 'rgba(255,255,255,0.35)' : `rgba(${r},${g},${b},0.35)`;
  });
  canvas.addEventListener('mouseleave', () => { brush.style.display = 'none'; });

  canvas.addEventListener('touchstart', e => {
    if (!el.classList.contains('drawing') || e.touches.length !== 1) return;
    startDraw(e.touches[0].clientX, e.touches[0].clientY);
    e.stopPropagation(); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if ((!stroke && !textDrag) || e.touches.length !== 1) return;
    moveDraw(e.touches[0].clientX, e.touches[0].clientY);
    e.stopPropagation(); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', e => { if (stroke || textDrag) { endDraw(); e.stopPropagation(); } });

  // ── Undo (my last stroke; owner may undo anyone's) — pushes the removed
  //    stroke onto a redo stack. ──
  el.querySelector('.wb-undo').addEventListener('click', async () => {
    const wb = WHITEBOARDS_MAP.get(id);
    const strokes = wb.strokes || [];
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (MY_ROLE === 'owner' || strokes[i].by === ME.uid) {
        const removed = strokes[i];
        try {
          await wbCol().doc(id).update({ strokes: firebase.firestore.FieldValue.arrayRemove(removed) });
          const stack = WB_REDO.get(id) || []; stack.push(removed); WB_REDO.set(id, stack);
        } catch (e) { toast('Chyba: ' + e.message); }
        return;
      }
    }
    toast('Žádný tvůj tah k vrácení.');
  });

  // ── Redo (re-add the last undone stroke) ──
  el.querySelector('.wb-redo').addEventListener('click', async () => {
    const stack = WB_REDO.get(id) || [];
    if (!stack.length) { toast('Není co opakovat.'); return; }
    const s = stack.pop(); WB_REDO.set(id, stack);
    try { await wbCol().doc(id).update({ strokes: firebase.firestore.FieldValue.arrayUnion(s) }); }
    catch (e) { toast('Chyba: ' + e.message); stack.push(s); }
  });

  // ── Delete tabule (author or owner) ──
  el.querySelector('.wb-del').addEventListener('click', async () => {
    const wb = WHITEBOARDS_MAP.get(id);
    if (!(MY_ROLE === 'owner' || wb.authorId === ME.uid)) { toast('Smazat může jen autor nebo vlastník.'); return; }
    if (!confirm('Smazat celou tabuli i s kresbou?')) return;
    try { await wbCol().doc(id).delete(); logActivity('board', 'smazal tabuli'); }
    catch (e) { toast('Chyba: ' + e.message); }
  });

  // ── Move by dragging the bar (author or owner) ──
  const bar = el.querySelector('.wb-bar');
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.wb-btn, .wb-color, .wb-type, .wb-wrange, .wb-wnum')) return;
    const wb = WHITEBOARDS_MAP.get(id);
    if (!(MY_ROLE === 'owner' || wb.authorId === ME.uid)) return;
    e.stopPropagation(); e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = parseInt(el.style.left), oy = parseInt(el.style.top);
    const mv = ev => { el.style.left = (ox + (ev.clientX - sx) / BOARD_ZOOM) + 'px'; el.style.top = (oy + (ev.clientY - sy) / BOARD_ZOOM) + 'px'; };
    const up = async () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      try { await wbCol().doc(id).update({ x: Math.round(toStoreX(parseInt(el.style.left))), y: Math.round(toStoreY(parseInt(el.style.top))) }); }
      catch (_) {}
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });

  // ── Resize from any corner / edge. Growing is free; the N/W sides move the
  //    origin (so strokes shift to stay put) and can't shrink past the drawn
  //    bounding box. ──
  el.querySelectorAll('.wb-h').forEach(h => {
    h.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      const dir = h.dataset.dir;
      const wb = WHITEBOARDS_MAP.get(id);
      const bb = wbBBox(wb);
      const ow = wb.w, oh = wb.h;
      // Content extent = strokes + text boxes. The min size must contain it,
      // but is CAPPED at the current size so grabbing a handle can never make
      // the tabule jump larger (the old "+4" pushed the min past the width when
      // a drawing reached the edge, which grew it on every shrink attempt).
      const texts = wb.texts || [];
      let cMaxX = bb.has ? bb.maxX : 0, cMaxY = bb.has ? bb.maxY : 0;
      let cMinX = bb.has ? bb.minX : Infinity, cMinY = bb.has ? bb.minY : Infinity;
      texts.forEach(t => {
        cMaxX = Math.max(cMaxX, t.x + t.w); cMaxY = Math.max(cMaxY, t.y + t.h);
        cMinX = Math.min(cMinX, t.x); cMinY = Math.min(cMinY, t.y);
      });
      // Ignore any content that already lies outside the tabule (e.g. an old
      // stroke drawn off the edge) — clamp the extent into [0, size] so it
      // can never force the tabule to grow.
      cMaxX = Math.min(ow, cMaxX); cMaxY = Math.min(oh, cMaxY);
      cMinX = Math.max(0, Math.min(cMinX, ow)); cMinY = Math.max(0, Math.min(cMinY, oh));
      const hasContent = bb.has || texts.length > 0;
      const minW = hasContent ? Math.max(120, Math.min(ow, Math.ceil(cMaxX))) : Math.min(120, ow);
      const minH = hasContent ? Math.max(120, Math.min(oh, Math.ceil(cMaxY))) : Math.min(120, oh);
      const sx = e.clientX, sy = e.clientY;
      const ox = parseInt(el.style.left), oy = parseInt(el.style.top);
      const cv = el.querySelector('.wb-canvas');
      let shiftX = 0, shiftY = 0, newLeft = ox, newTop = oy, newW = ow, newH = oh;

      const mv = ev => {
        const dx = (ev.clientX - sx) / BOARD_ZOOM, dy = (ev.clientY - sy) / BOARD_ZOOM;
        shiftX = 0; shiftY = 0; newLeft = ox; newTop = oy; newW = ow; newH = oh;
        if (dir.includes('e')) newW = Math.max(minW, Math.round(ow + dx));
        if (dir.includes('s')) newH = Math.max(minH, Math.round(oh + dy));
        if (dir.includes('w')) { shiftX = Math.round(Math.min(dx, hasContent ? cMinX : Infinity, ow - minW)); newLeft = ox + shiftX; newW = ow - shiftX; }
        if (dir.includes('n')) { shiftY = Math.round(Math.min(dy, hasContent ? cMinY : Infinity, oh - minH)); newTop = oy + shiftY; newH = oh - shiftY; }
        el.style.left = newLeft + 'px'; el.style.top = newTop + 'px';
        el.style.width = newW + 'px'; el.style.height = newH + 'px';
        cv.width = newW; cv.height = newH;
        const shown = (shiftX || shiftY)
          ? { strokes: (wb.strokes || []).map(s => ({ ...s, pts: s.pts.map((v, i) => i % 2 === 0 ? v - shiftX : v - shiftY) })) }
          : wb;
        redrawWbCanvas(cv, shown);
        // Keep text boxes visually pinned while the N/W edge shifts the origin.
        el.querySelectorAll('.wb-text').forEach(tb => {
          const t = (wb.texts || []).find(x => x.id === tb.dataset.tid);
          if (t) { tb.style.left = (t.x - shiftX) + 'px'; tb.style.top = (t.y - shiftY) + 'px'; }
        });
      };
      const up = async () => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        const upd = { x: Math.round(toStoreX(newLeft)), y: Math.round(toStoreY(newTop)), w: newW, h: newH };
        if (shiftX || shiftY) {
          upd.strokes = (wb.strokes || []).map(s => ({ ...s, pts: s.pts.map((v, i) => i % 2 === 0 ? v - shiftX : v - shiftY) }));
          if ((wb.texts || []).length) upd.texts = wb.texts.map(t => ({ ...t, x: t.x - shiftX, y: t.y - shiftY }));
        }
        try { await wbCol().doc(id).update(upd); } catch (_) {}
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
  });
}

// ── Board right-click menu: add a note or a tabule at the cursor ──
function setupBoardContextMenu() {
  const wrap = document.getElementById('boardWrap');
  let downX = 0, downY = 0;
  wrap.addEventListener('mousedown', e => { if (e.button === 2) { downX = e.clientX; downY = e.clientY; } });
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    // A right-DRAG pans (handled in setupBoardPan); only a right-CLICK (no
    // real movement) opens the menu. Viewers get nothing to add.
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (MY_ROLE === 'viewer' || (ME.isAnonymous && MY_ROLE !== 'owner')) return;
    if (e.target.closest('.note, .whiteboard')) return; // let those keep their own menus
    openBoardMenu(e.clientX, e.clientY);
  });
}

function closeBoardMenu() { document.getElementById('boardCtxMenu')?.remove(); }
function openBoardMenu(clientX, clientY) {
  closeBoardMenu();
  // Board-store coords at the cursor, so new content lands exactly here.
  const wrap = document.getElementById('boardWrap');
  const bx = (wrap.scrollLeft + clientX - wrap.getBoundingClientRect().left) / BOARD_ZOOM;
  const by = (wrap.scrollTop  + clientY - wrap.getBoundingClientRect().top)  / BOARD_ZOOM;
  const sx = toStoreX(bx), sy = toStoreY(by);

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'boardCtxMenu';
  menu.innerHTML = `
    <button class="context-menu-item" data-act="note">➕ Přidat poznámku</button>
    <button class="context-menu-item" data-act="board">🖊️ Přidat tabuli</button>`;
  document.body.appendChild(menu);
  menu.style.left = clientX + 'px'; menu.style.top = clientY + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth)  menu.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (clientY - r.height) + 'px';

  menu.querySelector('[data-act="note"]').addEventListener('click', () => { closeBoardMenu(); PENDING_ADD_POS = { x: sx, y: sy }; openAddNote(); });
  menu.querySelector('[data-act="board"]').addEventListener('click', () => { closeBoardMenu(); createWhiteboard(sx, sy); });
  setTimeout(() => document.addEventListener('click', closeBoardMenu, { once: true }), 0);
}

// When set, the next note created uses this board-store position instead of
// the default "somewhere in the current viewport".
let PENDING_ADD_POS = null;

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
    // mousedown handler owns left-drag on itself, and a whiteboard's toolbar/
    // resize own their controls — panning here would preventDefault() the
    // mousedown and stop a <select>/color picker from ever opening (and start
    // an unwanted scroll). The tabule's empty canvas (pointer-events:none when
    // idle) isn't matched, so panning over a tabule still works.
    if (e.button === 0 && e.target.closest('.note, .wb-bar, .wb-h')) return;
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
    } else if (e.touches.length === 1 && !e.target.closest('.note, .wb-bar, .wb-h')) {
      const t = e.touches[0];
      touchPan = { x: t.clientX, y: t.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
    }
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setBoardZoom(pinch.zoom * (touchDist(e.touches) / pinch.dist), mx, my);
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
// Zoom toward a focal screen point (the cursor / pinch midpoint) instead of
// the board's top-left: keep whatever board coordinate is under the focal
// point pinned there by re-scrolling after the zoom changes. Focal point
// defaults to the viewport centre.
function setBoardZoom(z, focalClientX, focalClientY) {
  const wrap = document.getElementById('boardWrap');
  const rect = wrap.getBoundingClientRect();
  const fx = focalClientX == null ? rect.left + wrap.clientWidth / 2 : focalClientX;
  const fy = focalClientY == null ? rect.top + wrap.clientHeight / 2 : focalClientY;
  // Board coord under the focal point BEFORE the zoom change.
  const bx = (wrap.scrollLeft + fx - rect.left) / BOARD_ZOOM;
  const by = (wrap.scrollTop  + fy - rect.top)  / BOARD_ZOOM;

  BOARD_ZOOM = Math.min(2.2, Math.max(0.15, z));
  document.getElementById('board').style.zoom = BOARD_ZOOM;

  // Re-scroll so that same board coord stays under the focal point.
  wrap.scrollLeft = bx * BOARD_ZOOM - (fx - rect.left);
  wrap.scrollTop  = by * BOARD_ZOOM - (fy - rect.top);
}
function setupBoardZoom() {
  const wrap = document.getElementById('boardWrap');
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    setBoardZoom(BOARD_ZOOM * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX, e.clientY);
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
    document.getElementById('backupsBtn').style.display = 'inline-flex';
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
// `successorOverride` lets the owner hand ownership to a specific member;
// without it, pickSuccessor() chooses automatically. Returns false when
// leaving is impossible (sole-member owner).
async function performLeave(successorOverride) {
  const amOwner = MY_ROLE === 'owner';
  const successor = amOwner ? (successorOverride || pickSuccessor()) : null;
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
    logActivity('owner', `předal vlastnictví na ${memberName(successor)} a opustil místnost`);
  }
  await db.collection('rooms').doc(ROOM_ID).update(update);
  return true;
}

async function leaveRoom() {
  let successor = null;
  if (MY_ROLE === 'owner') {
    // Eligible = every other CURRENT member (skip already-expired guests).
    const others = (ROOM.memberIds || []).filter(id => id !== ME.uid && !memberExpired(id));
    if (!others.length) {
      toast('Jsi jediný člen — nejdřív někoho pozvi, komu se místnost předá.');
      return;
    }
    // One other member → straight confirm; several → let the owner choose.
    if (others.length === 1) {
      successor = others[0];
      if (!confirm(`Opustit místnost? Vlastnictví převezme ${memberName(successor)}.`)) return;
    } else {
      successor = await openSuccessorPicker(others);
      if (!successor) return; // cancelled
    }
  } else {
    if (!confirm('Opustit místnost? Ztratíš k ní přístup.')) return;
  }

  try {
    await performLeave(successor);
    window.location.href = 'dashboard.html';
  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

// Modal: owner chooses which member inherits the room. Resolves to the chosen
// uid, or null if cancelled.
function openSuccessorPicker(candidateIds) {
  return new Promise(resolve => {
    const list = document.getElementById('successorList');
    list.innerHTML = candidateIds.map(uid => {
      const m = (ROOM.members || {})[uid] || {};
      const role = (ROOM.roles || {})[uid] || 'viewer';
      return `<button class="successor-opt" data-uid="${uid}" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-2);color:var(--text);cursor:pointer;margin-bottom:8px;">
        <div class="m-avatar">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;">${esc(m.displayName || m.email || uid)}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">${roleLabel(role)}</div>
        </div>
      </button>`;
    }).join('');

    let done = false;
    const finish = val => { if (done) return; done = true; closeModal('successorModal'); resolve(val); };
    list.querySelectorAll('.successor-opt').forEach(btn =>
      btn.addEventListener('click', () => {
        if (!confirm(`Předat vlastnictví uživateli ${memberName(btn.dataset.uid)} a opustit místnost?`)) return;
        finish(btn.dataset.uid);
      }));
    document.getElementById('successorCancel').onclick = () => finish(null);
    openModal('successorModal');
  });
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

// ── Search across notes ───────────────────────────────────────
// Diacritics-insensitive match over each note's title + plain-text content.
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

// ── Presence (who's in the room right now) ────────────────────
// Live via RTDB: each open tab writes presence/{roomId}/{uid} and clears it on
// disconnect (tab close / navigation), so the list is instantly accurate.
let ONLINE_UIDS = new Set();
function setupPresence() {
  let rtdb;
  try { rtdb = firebase.database(); } catch (e) { return; } // RTDB unavailable → skip silently
  const base = rtdb.ref(`presence/${ROOM_ID}`);
  const meRef = base.child(ME.uid);
  meRef.set({
    name: ME.isAnonymous ? 'Host' : (ME.displayName || ME.email || 'Uživatel'),
    photo: ME.photoURL || null,
    at: firebase.database.ServerValue.TIMESTAMP,
  }).catch(() => {});
  meRef.onDisconnect().remove();
  base.on('value', snap => renderPresence(snap.val() || {}), () => {});
}

function renderPresence(map) {
  ONLINE_UIDS = new Set(Object.keys(map));
  const bar = document.getElementById('presenceBar');
  if (bar) {
    const entries = Object.entries(map);
    const shown = entries.slice(0, 6);
    bar.innerHTML = shown.map(([uid, p]) => `
      <div class="presence-av${uid === ME.uid ? ' me' : ''}" title="${esc(p.name || '')}${uid === ME.uid ? ' (ty)' : ''}">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc(initial(p.name || '?'))}</span>`}
      </div>`).join('') +
      (entries.length > 6 ? `<div class="presence-more">+${entries.length - 6}</div>` : '');
    bar.title = entries.length + ' online';
  }
  // Refresh the members panel's online dots if it's open.
  if (document.getElementById('panelBack')?.classList.contains('open')) renderMembers();
}

// ── Activity log ──────────────────────────────────────────────
// Append-only trail of who did what (deletes, role changes, ownership
// hand-offs). Best-effort — a failed log never blocks the actual action.
function logActivity(type, text) {
  if (!ROOM_ID || !ME || ME.isAnonymous) return;
  db.collection('rooms').doc(ROOM_ID).collection('activity').add({
    type, text,
    byUid:  ME.uid,
    byName: ME.displayName || ME.email || 'Někdo',
    at:     firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}

function setupActivityLog() {
  const btn = document.getElementById('activityBtn');
  if (btn) btn.addEventListener('click', () => { openModal('activityModal'); renderActivityLog(); });
}

async function renderActivityLog() {
  const el = document.getElementById('activityList');
  el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Načítám…</div>';
  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('activity')
      .orderBy('at', 'desc').limit(100).get();
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Zatím žádná aktivita.</div>';
      return;
    }
    const icon = { note: '🗑️', member: '👤', role: '🛡️', owner: '👑', restore: '↩️', board: '🖊️' };
    el.innerHTML = snap.docs.map(d => {
      const a = d.data();
      const when = a.at?.toDate ? a.at.toDate().toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.82rem;">
        <span>${icon[a.type] || '•'}</span>
        <div style="flex:1;min-width:0;">
          <div><strong>${esc(a.byName || 'Někdo')}</strong> ${esc(a.text || '')}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${esc(when)}</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:#fca5a5;font-size:.85rem;">Chyba: ${esc(e.message)}</div>`;
  }
}

// ── Friends (shared with dashboard's friendRequests collection) ──
// Friendship = an *accepted* friendRequest in either direction. Loaded once
// and cached; `pending` covers both sent and received requests so the member
// list can show the right button state.
let FRIEND_STATE = null;
async function loadFriendState(force) {
  if (FRIEND_STATE && !force) return FRIEND_STATE;
  if (ME.isAnonymous) { FRIEND_STATE = { accepted: new Set(), pending: new Set(), incoming: [] }; return FRIEND_STATE; }
  const [sent, received] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', ME.uid).get(),
    db.collection('friendRequests').where('toUid', '==', ME.uid).get(),
  ]);
  const accepted = new Set(), pending = new Set(), incoming = [];
  sent.docs.forEach(d => {
    const r = d.data();
    if (r.status === 'accepted')     accepted.add(r.toUid);
    else if (r.status === 'pending') pending.add(r.toUid);
  });
  received.docs.forEach(d => {
    const r = d.data();
    if (r.status === 'accepted')     accepted.add(r.fromUid);
    else if (r.status === 'pending') { pending.add(r.fromUid); incoming.push({ id: d.id, ...r }); }
  });
  FRIEND_STATE = { accepted, pending, incoming };
  return FRIEND_STATE;
}

// Badge on the "Členové" button: number of pending friend requests I've
// received. Refreshed on room load and whenever the panel re-renders.
async function refreshMembersBadge() {
  const badge = document.getElementById('membersReqBadge');
  if (!badge || ME.isAnonymous) return;
  try {
    const fs = await loadFriendState(true);
    const n = (fs.incoming || []).length;
    badge.textContent = n;
    badge.style.display = n ? 'inline-block' : 'none';
  } catch (_) { /* ignore */ }
}

async function sendFriendRequestTo(uid, member) {
  try {
    // Deterministic pair id (sorted) — matches dashboard + the rules gate.
    const pairId = [ME.uid, uid].sort().join('_');
    const existing = await db.collection('friendRequests').doc(pairId).get();
    if (existing.exists && existing.data().status === 'declined') {
      await existing.ref.delete().catch(() => {});
    }
    await db.collection('friendRequests').doc(pairId).set({
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
    logActivity('restore', 'obnovil místnost ze zálohy');
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

  // Friend states drive the "add friend" buttons, the editor-only-for-friends
  // guard on the role select, and the incoming-requests section.
  let friends = { accepted: new Set(), pending: new Set(), incoming: [] };
  try { friends = await loadFriendState(); } catch (_) { /* best effort */ }
  const badge = document.getElementById('membersReqBadge');
  if (badge) {
    const n = (friends.incoming || []).length;
    badge.textContent = n;
    badge.style.display = n ? 'inline-block' : 'none';
  }

  list.innerHTML = renderIncomingRequests(friends.incoming || []);
  if (!ids.length) {
    list.innerHTML += '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Žádní členové.</p>';
    wireIncomingRequestButtons(list);
    return;
  }

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

    const online = ONLINE_UIDS.has(uid);
    row.innerHTML = `
      <div class="m-avatar${online ? ' online' : ''}">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
      <div class="m-info">
        <div class="m-name">${esc(m.displayName || m.email || uid)}${isMe ? ' <span style="color:var(--text-muted);font-weight:400;">(ty)</span>' : ''}${online ? ' <span style="color:#22c55e;font-size:0.7rem;">● online</span>' : ''}</div>
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
        const prev = role;
        try {
          await db.collection('rooms').doc(ROOM_ID).update({ [`roles.${uid}`]: sel.value });
          ROOM.roles[uid] = sel.value;
          logActivity('role', `změnil roli ${memberName(uid)} na ${roleLabel(sel.value)}`);
          toast('Oprávnění změněno.');
        } catch (e) { sel.value = prev; toast('Chyba: ' + e.message); }
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
          logActivity('member', `odebral člena ${memberName(uid) || esc(m.displayName || m.email || uid)}`);
          updateMemberCount();
          renderMembers();
          toast('Člen odebrán.');
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    }

    list.appendChild(row);
  });

  wireIncomingRequestButtons(list);
}

// ── Incoming friend requests (shown at the top of the members panel) ──
function renderIncomingRequests(incoming) {
  if (!incoming.length) return '';
  return `<div style="padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid var(--border);">
    <div class="label" style="margin-bottom:8px;">Žádosti o přátelství (${incoming.length})</div>` +
    incoming.map(r => `
      <div class="member-row" style="padding:6px 0;">
        <div class="m-avatar">${r.fromPhoto ? `<img src="${r.fromPhoto}" alt="">` : initial(r.fromName || r.fromEmail || '?')}</div>
        <div class="m-info">
          <div class="m-name">${esc(r.fromName || r.fromEmail || r.fromUid)}</div>
          <div class="m-email">${esc(r.fromEmail || '')}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary"   style="padding:4px 10px;font-size:0.75rem;" data-accept-req="${r.id}">✓</button>
          <button class="btn btn-secondary" style="padding:4px 9px;font-size:0.75rem;"  data-decline-req="${r.id}">✕</button>
        </div>
      </div>`).join('') + `</div>`;
}

function wireIncomingRequestButtons(scope) {
  scope.querySelectorAll('[data-accept-req]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await db.collection('friendRequests').doc(btn.dataset.acceptReq).update({ status: 'accepted' });
      FRIEND_STATE = null; // force reload
      toast('Žádost přijata! 🎉');
      renderMembers();
    } catch (e) { toast('Chyba: ' + e.message); btn.disabled = false; }
  }));
  scope.querySelectorAll('[data-decline-req]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await db.collection('friendRequests').doc(btn.dataset.declineReq).update({ status: 'declined' });
      FRIEND_STATE = null;
      toast('Žádost odmítnuta.');
      renderMembers();
    } catch (e) { toast('Chyba: ' + e.message); btn.disabled = false; }
  }));
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

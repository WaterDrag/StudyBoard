// ═══ room-core.js — Sdílené globály, pomocné funkce, modaly, toasty
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

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

// A toast with a clickable action (e.g. "Vrátit" after a delete). Stays a bit
// longer so there's time to act.
function toastAction(msg, label, fn) {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = 'toast toast-with-action';
  const span = document.createElement('span'); span.textContent = msg;
  const btn  = document.createElement('button'); btn.className = 'toast-action'; btn.textContent = label;
  btn.addEventListener('click', () => { el.remove(); fn(); });
  el.append(span, btn);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

// Ctrl/Cmd+Z undoes the last note deletion, Ctrl+Shift+Z / Ctrl+Y redoes it.
// Ignored while typing (so the browser's own text-undo still works there).
function setupNoteHistoryKeys() {
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.target.isContentEditable || (e.target.matches && e.target.matches('input, textarea, select'))) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoNoteDelete(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoNoteDelete(); }
  });
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

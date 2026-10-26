// ═══ room-board.js — Nástěnka: propojení, kontextové menu, minimapa, multi-select, pan, zoom
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

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

// ── Travel agent: rozcestník po celé aplikaci ─────────────────
// Not just panning around one board — this is the way to get ANYWHERE:
// the dashboard, a note on this board, a different room, a deck of cards.
// Left half lists destinations, right half previews whatever is highlighted,
// so you can tell two similarly-named notes apart before jumping.
// Right-click the board → 🧭 Travel agent, or Ctrl+K.
const TRAVEL_RECENT = [];   // {kind,id} of recent jumps, newest first
let TRAVEL_RETURN = null;   // scroll position before the last in-board jump
let TRAVEL_CACHE = null;    // rooms + decks, fetched once per session

function travelScroll(wrap, left, top) {
  // Deliberately instant: scrollTo({behavior:'smooth'}) and rAF tweens both
  // silently do nothing when the page isn't painting (hidden pane, background
  // tab, reduced-motion), which would leave the agent not travelling at all.
  wrap.scrollLeft = Math.max(0, Math.min(left, wrap.scrollWidth - wrap.clientWidth));
  wrap.scrollTop  = Math.max(0, Math.min(top,  wrap.scrollHeight - wrap.clientHeight));
}

// Rooms and decks live outside this board, so they cost a read — fetched once
// when the palette is first opened and kept for the rest of the session.
async function travelLoadRemote() {
  if (TRAVEL_CACHE) return TRAVEL_CACHE;
  const rooms = [], decks = [];
  try {
    const rs = await db.collection('rooms').where('memberIds', 'array-contains', ME.uid).get();
    rs.docs.forEach(d => {
      const r = d.data();
      rooms.push({ id: d.id, name: r.name || 'Místnost', color: r.color,
                   members: (r.memberIds || []).length, role: (r.roles || {})[ME.uid] || 'viewer' });
    });
  } catch (_) {}
  try {
    const [roomDecks, myDecks] = await Promise.all([
      db.collection('decks').where('roomId', '==', ROOM_ID).get().catch(() => ({ docs: [] })),
      db.collection('decks').where('ownerUid', '==', ME.uid).get().catch(() => ({ docs: [] })),
    ]);
    const seen = new Set();
    [...roomDecks.docs, ...myDecks.docs].forEach(d => {
      if (seen.has(d.id)) return;
      seen.add(d.id);
      const k = d.data();
      decks.push({ id: d.id, name: k.name || 'Balíček', color: k.color,
                   count: k.cardCount || 0, roomId: k.roomId || null });
    });
  } catch (_) {}
  TRAVEL_CACHE = { rooms, decks };
  return TRAVEL_CACHE;
}

// Every destination, flat. Used for searching — typing a deck or room name
// finds it directly, without going through its category first.
function travelDestinations(remote) {
  const out = [];
  const folderOf = id => {
    const f = [...FOLDERS_MAP.values()].find(x => (x.noteIds || []).includes(id));
    return f ? f.name : '';
  };

  out.push({ kind: 'action', id: 'dash', icon: '🏠', group: 'Kam jinam',
             title: 'Hlavní obrazovka', sub: 'místnosti, kartičky, přátelé' });
  out.push({ kind: 'action', id: 'fit', icon: '🔭', group: 'Na této nástěnce',
             title: 'Zobrazit celou nástěnku', sub: 'oddálí tak, aby bylo vidět vše' });
  out.push({ kind: 'action', id: 'back', icon: '↩︎', group: 'Na této nástěnce',
             title: 'Zpět, kde jsem byl', sub: 'vrátí předchozí výřez' });

  NOTES_MAP.forEach((n, id) => { if (isHeading(n)) return; out.push({
    kind: 'note', id, icon: '📝', group: 'Poznámky',
    title: n.title || noteToPlainText(n).slice(0, 50) || noteBlankLabel(n) || '(bez názvu)',
    sub: folderOf(id) || (pagesOf(n).length ? 'návod' : ''),
    x: n.x, y: n.y, color: n.color, note: n,
  }); });

  WHITEBOARDS_MAP.forEach((wb, id) => out.push({
    kind: 'board', id, icon: '🎨', group: 'Tabule',
    title: 'Tabule' + (wb.authorName ? ' — ' + wb.authorName : ''),
    sub: `${Math.round(wb.w)}×${Math.round(wb.h)} px`,
    x: wb.x, y: wb.y, w: wb.w, h: wb.h, wb,
  }));

  FOLDERS_MAP.forEach(f => {
    const first = (f.noteIds || []).map(i => NOTES_MAP.get(i)).find(Boolean);
    if (first) out.push({
      kind: 'folder', id: f.id, icon: '📁', group: 'Složky',
      title: f.name || 'Složka', sub: `${(f.noteIds || []).length} poznámek`,
      x: first.x, y: first.y, color: f.color, folder: f,
    });
  });

  (remote?.rooms || []).forEach(r => {
    if (r.id === ROOM_ID) return;                 // already here
    out.push({ kind: 'room', id: r.id, icon: '🚪', group: 'Jiné místnosti',
               title: r.name, sub: `${r.members} členů · ${roleLabel(r.role)}`, color: r.color, room: r });
  });

  (remote?.decks || []).forEach(k => out.push({
    kind: 'deck', id: k.id, icon: '🃏', group: 'Balíčky kartiček',
    title: k.name, sub: `${k.count} karet${k.roomId === ROOM_ID ? ' · tato místnost' : ''}`,
    color: k.color, deck: k,
  }));

  return out;
}


function contentBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y, w, h) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  };
  NOTES_MAP.forEach(n => add(toRenderX(n.x), toRenderY(n.y), 240, 170));
  WHITEBOARDS_MAP.forEach(wb => add(toRenderX(wb.x), toRenderY(wb.y), wb.w || 460, wb.h || 320));
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

function travelFitAll() {
  const b = contentBounds();
  if (!b) { toast('Na nástěnce zatím nic není.'); return; }
  const wrap = document.getElementById('boardWrap');
  const pad = 80;
  const z = Math.min(
    wrap.clientWidth  / (b.maxX - b.minX + pad * 2),
    wrap.clientHeight / (b.maxY - b.minY + pad * 2), 1.2);
  rememberReturn();
  setBoardZoom(Math.max(0.15, z));
  travelScroll(wrap, (b.minX - pad) * BOARD_ZOOM, (b.minY - pad) * BOARD_ZOOM);
  updateMinimap();
}

function rememberReturn() {
  const wrap = document.getElementById('boardWrap');
  TRAVEL_RETURN = { left: wrap.scrollLeft, top: wrap.scrollTop, zoom: BOARD_ZOOM };
}

function travelBack() {
  if (!TRAVEL_RETURN) { toast('Není kam se vracet.'); return; }
  const wrap = document.getElementById('boardWrap');
  const t = TRAVEL_RETURN;
  rememberReturn();                        // Back toggles between two spots
  setBoardZoom(t.zoom);
  travelScroll(wrap, t.left, t.top);
  updateMinimap();
}

// Notes of ANOTHER room, fetched the moment you step into that room in the
// palette, then cached. Lets you pick the note before leaving this page.
const TRAVEL_ROOM_NOTES = new Map();   // roomId → [{id,title,pages}] | 'loading'
async function travelRoomNotes(roomId, onLoaded) {
  if (TRAVEL_ROOM_NOTES.has(roomId)) return TRAVEL_ROOM_NOTES.get(roomId);
  TRAVEL_ROOM_NOTES.set(roomId, 'loading');
  try {
    const snap = await db.collection('rooms').doc(roomId).collection('notes')
      .orderBy('createdAt', 'desc').limit(30).get();
    TRAVEL_ROOM_NOTES.set(roomId, snap.docs.map(d => {
      const n = d.data();
      const plain = (n.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return { id: d.id, title: n.title || plain.slice(0, 44) || '(bez názvu)',
               pages: Array.isArray(n.pages) ? n.pages.length : 0 };
    }));
  } catch (_) {
    TRAVEL_ROOM_NOTES.set(roomId, []);
  }
  if (onLoaded) onLoaded();
  return TRAVEL_ROOM_NOTES.get(roomId);
}

// One dispatcher for every kind of destination — in-board jump or page change.
function travelGo(dest) {
  if (!dest) return;
  if (dest.kind === 'action') {
    if (dest.id === 'dash')  { window.location.href = 'dashboard.html'; return; }
    if (dest.id === 'cards') { window.location.href = `flashcards.html?room=${ROOM_ID}`; return; }
    if (dest.id === 'fit')   { travelFitAll(); return; }
    if (dest.id === 'back')  { travelBack(); return; }
    return;
  }
  if (dest.kind === 'room') { window.location.href = `room.html?id=${dest.id}`; return; }
  // A note inside ANOTHER room — open that room with the note already showing.
  if (dest.kind === 'roomnote') { window.location.href = `room.html?id=${dest.roomId}&note=${dest.id}`; return; }
  if (dest.kind === 'deck') {
    window.location.href = `flashcards.html?deck=${dest.id}` + (dest.deck?.roomId ? `&room=${dest.deck.roomId}` : '');
    return;
  }
  if (dest.kind === 'cat') return;          // a category is opened, not travelled to

  // Everything else lives on this board.
  const wrap = document.getElementById('boardWrap');
  rememberReturn();
  if (VIEW_MODE !== 'board') goToBoard();
  const w = dest.w || 240, h = dest.h || 170;
  travelScroll(wrap,
    (toRenderX(dest.x) + w / 2) * BOARD_ZOOM - wrap.clientWidth / 2,
    (toRenderY(dest.y) + h / 2) * BOARD_ZOOM - wrap.clientHeight / 2);
  updateMinimap();

  const el = document.getElementById((dest.kind === 'board' ? 'wb-' : 'n-') + dest.id);
  if (el) {
    el.classList.remove('travel-flash');
    void el.offsetWidth;                    // restart the animation
    el.classList.add('travel-flash');
    setTimeout(() => el.classList.remove('travel-flash'), 1600);
  }

  const i = TRAVEL_RECENT.findIndex(r => r.id === dest.id && r.kind === dest.kind);
  if (i >= 0) TRAVEL_RECENT.splice(i, 1);
  TRAVEL_RECENT.unshift({ id: dest.id, kind: dest.kind });
  TRAVEL_RECENT.length = Math.min(TRAVEL_RECENT.length, 6);
}

// ── The palette: cascading columns ────────────────────────────
// Like a Finder column view: pick something on the left, its contents open in
// a NEW column beside it. Nothing shifts around, and you can see the whole
// path at once — Jiné místnosti › Čtenářské Deníky › Malý princ.
function closeTravelAgent() { document.getElementById('travelAgent')?.remove(); }

// Column 1. Families collapse into a row with a › when there are many, so the
// first column stays short; small ones stay listed inline.
const TRAVEL_INLINE_MAX = 8;
function travelRoot(all) {
  const of = k => all.filter(d => d.kind === k);
  const out = [];

  out.push({ ...all.find(d => d.id === 'dash'), group: 'Kam jinam' });

  const decks = of('deck').filter(d => d.deck?.roomId === ROOM_ID);
  out.push({ kind: 'cat', id: 'decks', icon: '🃏', group: 'Kam jinam',
             title: 'Flash Cards',
             sub: decks.length ? `${decks.length} balíčků v místnosti` : 'zatím žádné balíčky',
             children: [{ kind: 'action', id: 'cards', icon: '🃏',
                          title: 'Otevřít přehled balíčků', sub: 'Flash Cards této místnosti' }, ...decks],
             empty: 'V této místnosti zatím nejsou balíčky.' });

  const rooms = of('room');
  out.push({ kind: 'cat', id: 'rooms', icon: '🚪', group: 'Kam jinam',
             title: 'Jiné místnosti', sub: rooms.length ? `${rooms.length} místností` : 'jsi jen tady',
             children: rooms, empty: 'Nejsi v žádné další místnosti.' });

  out.push({ ...all.find(d => d.id === 'fit'),  group: 'Na této nástěnce' });
  out.push({ ...all.find(d => d.id === 'back'), group: 'Na této nástěnce' });

  [['note', '📝', 'Poznámky'], ['board', '🎨', 'Tabule'], ['folder', '📁', 'Složky']]
    .forEach(([kind, icon, label]) => {
      const items = of(kind);
      if (!items.length) return;
      if (items.length <= TRAVEL_INLINE_MAX) out.push(...items.map(i => ({ ...i, group: 'Na této nástěnce' })));
      else out.push({ kind: 'cat', id: kind + 's', icon, group: 'Na této nástěnce',
                      title: label, sub: `${items.length}`, children: items, empty: '' });
    });

  return out.filter(Boolean);
}

// A room's notes are its children — loaded the moment you step into it.
function childrenOf(item) {
  if (item.children) return item.children;
  if (item.kind === 'room') {
    const n = TRAVEL_ROOM_NOTES.get(item.id);
    if (Array.isArray(n)) return n.map(x => ({
      kind: 'roomnote', id: x.id, roomId: item.id,
      icon: x.pages ? '📖' : '📝', title: x.title, sub: '',
    }));
    return n === 'loading' ? 'loading' : null;   // null → needs fetching
  }
  return null;
}

async function openTravelAgent() {
  closeTravelAgent();
  const box = document.createElement('div');
  box.id = 'travelAgent';
  box.innerHTML = `
    <div class="ta-head">
      <span class="ta-icon">🧭</span>
      <input id="taInput" placeholder="Kam chceš? Poznámka, tabule, místnost, kartičky…" autocomplete="off">
      <kbd>Esc</kbd>
    </div>
    <div id="taCols" class="ta-cols"></div>`;
  document.body.appendChild(box);

  const input = document.getElementById('taInput');
  const cols  = document.getElementById('taCols');
  setTimeout(() => input.focus(), 20);

  let all = travelDestinations(null);
  let root = travelRoot(all);
  let path = [0];          // selected index per column
  let searching = false;
  let flat = [];           // results while searching

  // Items of every column, derived from the current path.
  const columns = () => {
    if (searching) return [flat];
    const out = [root];
    for (let i = 0; i < path.length; i++) {
      const item = out[i]?.[path[i]];
      if (!item) break;
      const kids = childrenOf(item);
      if (Array.isArray(kids) && kids.length) out.push(kids);
      else if (kids === 'loading') { out.push('loading'); break; }
      else break;
    }
    return out;
  };

  const paint = () => {
    const colsData = columns();
    cols.innerHTML = colsData.map((items, ci) => {
      if (items === 'loading') return '<div class="ta-col"><div class="ta-loading">Načítám…</div></div>';
      let html = '', lastGroup = null;
      items.forEach((d, i) => {
        if (d.group && d.group !== lastGroup) { html += `<div class="ta-group">${esc(d.group)}</div>`; lastGroup = d.group; }
        const kids = childrenOf(d);
        const hasKids = d.kind === 'cat' || d.kind === 'room';
        html += `<button class="ta-item${i === path[ci] ? ' on' : ''}" data-c="${ci}" data-i="${i}"
              style="--c:${esc(d.color || '#94a3b8')}">
            <span class="ta-kind">${d.icon}</span>
            <span class="ta-txt"><b>${esc(d.title)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ''}</span>
            ${hasKids ? '<span class="ta-more">›</span>' : ''}
          </button>`;
      });
      return `<div class="ta-col">${html || '<div class="ta-empty">Nic tu není.</div>'}</div>`;
    }).join('');

    cols.querySelectorAll('.ta-item').forEach(b => {
      const ci = +b.dataset.c, i = +b.dataset.i;
      b.addEventListener('mouseenter', () => { select(ci, i); });
      b.addEventListener('click', () => {
        select(ci, i);
        const d = columns()[ci]?.[i];
        if (d && !['cat', 'room'].includes(d.kind)) { closeTravelAgent(); travelGo(d); }
      });
    });
    cols.scrollLeft = cols.scrollWidth;                 // keep the newest column in view
    cols.querySelector('.ta-item.on')?.scrollIntoView({ block: 'nearest' });
  };

  // Selecting in column ci drops every column to its right.
  const select = (ci, i) => {
    path = path.slice(0, ci);
    path[ci] = i;
    const d = columns()[ci]?.[i];
    if (d && d.kind === 'room' && !TRAVEL_ROOM_NOTES.has(d.id)) {
      travelRoomNotes(d.id, () => { if (document.getElementById('travelAgent')) paint(); });
    }
    paint();
  };

  const render = q => {
    const n = searchNormalize(q.trim());
    searching = !!n;
    if (searching) {
      flat = all.filter(d => searchNormalize(d.title + ' ' + d.sub + ' ' + (d.group || '')).includes(n)).slice(0, 60);
      path = [0];
    } else {
      root = travelRoot(all);
      path = [0];
    }
    paint();
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => {
    const colsData = columns();
    const ci = path.length - 1;
    const items = colsData[ci];
    if (!Array.isArray(items)) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      select(ci, ((path[ci] ?? 0) + step + items.length) % items.length);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = colsData[ci + 1];
      if (Array.isArray(next) && next.length) { path[ci + 1] = 0; paint(); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (path.length > 1) { path = path.slice(0, -1); paint(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const d = items[path[ci]];
      if (!d) return;
      if (['cat', 'room'].includes(d.kind)) {
        const next = colsData[ci + 1];
        if (Array.isArray(next) && next.length) { path[ci + 1] = 0; paint(); }
        return;
      }
      closeTravelAgent();
      travelGo(d);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!searching && path.length > 1) { path = path.slice(0, -1); paint(); return; }
      closeTravelAgent();
    }
  });

  render('');

  travelLoadRemote().then(remote => {
    if (!document.getElementById('travelAgent')) return;
    all = travelDestinations(remote);
    render(input.value);
  });

  setTimeout(() => document.addEventListener('click', function once(ev) {
    if (ev.target.closest('#travelAgent')) { document.addEventListener('click', once, { once: true }); return; }
    closeTravelAgent();
  }, { once: true }), 0);
}

function setupTravelAgent() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.defaultPrevented) {
      e.preventDefault();
      document.getElementById('travelAgent') ? closeTravelAgent() : openTravelAgent();
    }
  });
}

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
    <button class="context-menu-item" data-act="travel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/></svg>Přejít na… <span class="ctx-kbd">Ctrl+K</span></button>
    <div class="context-menu-sep"></div>
    <button class="context-menu-item" data-act="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/><path d="M15 21v-6h6"/></svg>Přidat poznámku</button>
    <button class="context-menu-item" data-act="guide"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>Přidat návod</button>
    <button class="context-menu-item" data-act="board"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>Přidat tabuli</button>
    <button class="context-menu-item" data-act="heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14M12 5v14"/></svg>Přidat nadpis</button>`;
  document.body.appendChild(menu);
  menu.style.left = clientX + 'px'; menu.style.top = clientY + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth)  menu.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (clientY - r.height) + 'px';

  menu.querySelector('[data-act="travel"]').addEventListener('click', () => { closeBoardMenu(); openTravelAgent(); });
  menu.querySelector('[data-act="note"]').addEventListener('click', () => { closeBoardMenu(); PENDING_ADD_POS = { x: sx, y: sy }; openAddNote(); });
  menu.querySelector('[data-act="guide"]').addEventListener('click', () => { closeBoardMenu(); createGuide(sx, sy); });
  menu.querySelector('[data-act="board"]').addEventListener('click', () => { closeBoardMenu(); createWhiteboard(sx, sy); });
  menu.querySelector('[data-act="heading"]').addEventListener('click', () => { closeBoardMenu(); createHeading(sx, sy); });
  setTimeout(() => document.addEventListener('click', closeBoardMenu, { once: true }), 0);
}

// When set, the next note created uses this board-store position instead of
// the default "somewhere in the current viewport".
let PENDING_ADD_POS = null;

// ── Board minimap ─────────────────────────────────────────────
// Small overview in the corner: note/whiteboard rectangles + the current
// viewport box. Click or drag on it to jump. Redrawn on snapshots, scroll
// and zoom (throttled via rAF).
let _mmRaf = 0;
function updateMinimap() {
  if (_mmRaf) return;
  _mmRaf = requestAnimationFrame(() => { _mmRaf = 0; drawMinimapNow(); });
}

// The minimap shows the CONTENT (plus a margin), not the whole endless board:
// wander off and the map stays put, with the viewport box sliding out of it.
function minimapWorld(mm) {
  const b = contentBounds() || { minX: BOARD_PAD_X, minY: BOARD_PAD_Y, maxX: BOARD_PAD_X + 1600, maxY: BOARD_PAD_Y + 1000 };
  const m = 500;
  const x0 = b.minX - m, y0 = b.minY - m, w = b.maxX - b.minX + 2 * m, h = b.maxY - b.minY + 2 * m;
  const s = Math.min(mm.width / w, mm.height / h);
  // centre the world in the canvas
  return { s, ox: (mm.width - w * s) / 2 - x0 * s, oy: (mm.height - h * s) / 2 - y0 * s, x0, y0, w, h };
}

function drawMinimapNow() {
  const mm = document.getElementById('boardMinimap');
  if (!mm || VIEW_MODE !== 'board') return;
  const wrap = document.getElementById('boardWrap');
  const W = minimapWorld(mm), s = W.s;
  const X = x => W.ox + x * s;
  const Y = y => W.oy + y * s;
  const ctx = mm.getContext('2d');
  ctx.clearRect(0, 0, mm.width, mm.height);
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.fillRect(X(W.x0), Y(W.y0), W.w * s, W.h * s);

  // Whiteboards (muted slabs)
  ctx.fillStyle = 'rgba(226,232,240,0.35)';
  WHITEBOARDS_MAP.forEach(wb => {
    ctx.fillRect(X(toRenderX(wb.x)), Y(toRenderY(wb.y)), Math.max(2, wb.w * s), Math.max(2, wb.h * s));
  });

  // Notes (their colors)
  NOTES_MAP.forEach(n => {
    if (isHeading(n)) return;
    ctx.fillStyle = n.color || '#fef9c3';
    ctx.fillRect(X(toRenderX(n.x)), Y(toRenderY(n.y)), Math.max(3, 220 * s), Math.max(2, 150 * s));
  });

  // Viewport box (scroll offsets are in zoomed px → back to rendered coords)
  const z = BOARD_ZOOM;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(X(wrap.scrollLeft / z), Y(wrap.scrollTop / z), wrap.clientWidth / z * s, wrap.clientHeight / z * s);
  updateBackToContent();
}

// ── Pohled při otevření místnosti ──────────────────────────────
// Pohled se nastaví až po prvním načtení poznámek (dřív hned na začátek souřadnic — když byl obsah jinde,
// člověk skončil v prázdnu). Obnoví se poslední pohled v téhle místnosti, pokud je v něm něco vidět,
// jinak se ukáže začátek obsahu (levý horní roh) v měřítku 1:1. Pohled se ukládá v uložených
// souřadnicích (bez BOARD_PAD), takže sedí i po rozšíření plochy.
const BOARD_VIEW_KEY = () => 'board_view_' + ROOM_ID;
let _boardViewReady = false, _boardViewSaveT = 0;
function viewShowsContent() {
  const b = contentBounds(), wrap = document.getElementById('boardWrap'), z = BOARD_ZOOM;
  if (!b) return true;
  const vx0 = wrap.scrollLeft / z, vy0 = wrap.scrollTop / z, vx1 = vx0 + wrap.clientWidth / z, vy1 = vy0 + wrap.clientHeight / z;
  return !(b.maxX < vx0 || b.minX > vx1 || b.maxY < vy0 || b.minY > vy1);
}
function initialBoardView() {
  if (_boardViewReady) return;
  _boardViewReady = true;
  if (new URLSearchParams(window.location.search).get('note')) return;   // odkaz na poznámku si pohled nastaví sám
  const wrap = document.getElementById('boardWrap'), b = contentBounds();
  let v = null; try { v = JSON.parse(localStorage.getItem(BOARD_VIEW_KEY()) || 'null'); } catch (_) { v = null; }
  if (v && v.z > 0) {
    setBoardZoom(v.z);
    travelScroll(wrap, (v.x + BOARD_PAD_X) * BOARD_ZOOM, (v.y + BOARD_PAD_Y) * BOARD_ZOOM);
    if (viewShowsContent()) { updateMinimap(); updateBackToContent(); return; }
  }
  if (!b) return;
  if (BOARD_ZOOM !== 1) setBoardZoom(1);
  travelScroll(wrap, (b.minX - 60) * BOARD_ZOOM, (b.minY - 60) * BOARD_ZOOM);
  updateMinimap(); updateBackToContent();
}
function saveBoardView() {
  if (!_boardViewReady || VIEW_MODE !== 'board') return;
  clearTimeout(_boardViewSaveT);
  _boardViewSaveT = setTimeout(() => {
    const wrap = document.getElementById('boardWrap'), z = BOARD_ZOOM;
    try { localStorage.setItem(BOARD_VIEW_KEY(), JSON.stringify({ x: Math.round(wrap.scrollLeft / z - BOARD_PAD_X), y: Math.round(wrap.scrollTop / z - BOARD_PAD_Y), z: +z.toFixed(3) })); } catch (_) { /* nic */ }
  }, 500);
}

// "Zpět na plochu": appears in the middle of the screen only once nothing
// of the content is in view.
function updateBackToContent() {
  const btn = document.getElementById('backToContent');
  if (!btn) return;
  const b = contentBounds();
  const wrap = document.getElementById('boardWrap');
  const z = BOARD_ZOOM;
  const vx0 = wrap.scrollLeft / z, vy0 = wrap.scrollTop / z;
  const vx1 = vx0 + wrap.clientWidth / z, vy1 = vy0 + wrap.clientHeight / z;
  const away = !!b && VIEW_MODE === 'board' && (b.maxX < vx0 || b.minX > vx1 || b.maxY < vy0 || b.minY > vy1);
  btn.hidden = !away;
}

// ── Nekonečná plocha ──────────────────────────────────────────
// The board is a big scrollable box. Pan close to an edge and it grows by a
// screen in that direction; on the left/top that means a bigger pad, so
// every element moves right/down by the same amount and the scroll position
// follows — nothing visibly jumps. Stored coordinates never change.
let _growT = 0;
let _pointerDown = false;
function growBoard() {
  if (VIEW_MODE !== 'board' || _pointerDown) return;
  const wrap = document.getElementById('boardWrap');
  const board = document.getElementById('board');
  const z = BOARD_ZOOM;
  const vw = wrap.clientWidth / z, vh = wrap.clientHeight / z;
  let bw = parseInt(board.style.width) || board.offsetWidth;
  let bh = parseInt(board.style.height) || board.offsetHeight;
  const vx = wrap.scrollLeft / z, vy = wrap.scrollTop / z;
  const dx = vx < vw * 0.6 ? Math.ceil(vw) : 0;
  const dy = vy < vh * 0.6 ? Math.ceil(vh) : 0;
  if (dx || dy) {
    [...board.children].forEach(ch => {
      if (ch.id === 'connSvg') return;
      if (dx && ch.style.left) ch.style.left = (parseFloat(ch.style.left) + dx) + 'px';
      if (dy && ch.style.top)  ch.style.top  = (parseFloat(ch.style.top)  + dy) + 'px';
    });
    BOARD_PAD_X += dx; BOARD_PAD_Y += dy;
    bw += dx; bh += dy;
    board.style.width = bw + 'px'; board.style.height = bh + 'px';
    wrap.scrollLeft += dx * z; wrap.scrollTop += dy * z;
    redrawConnections();
  }
  const right = (wrap.scrollLeft + wrap.clientWidth) / z, bottom = (wrap.scrollTop + wrap.clientHeight) / z;
  if (bw - right < vw * 0.6) board.style.width  = Math.ceil(bw + vw) + 'px';
  if (bh - bottom < vh * 0.6) board.style.height = Math.ceil(bh + vh) + 'px';
  updateMinimap();
  updateBackToContent();
}

function setupInfiniteBoard() {
  const wrap = document.getElementById('boardWrap');
  const later = () => { clearTimeout(_growT); _growT = setTimeout(growBoard, 120); };
  wrap.addEventListener('scroll', later, { passive: true });
  wrap.addEventListener('scroll', saveBoardView, { passive: true });   // zapamatovat pohled pro příští otevření
  window.addEventListener('resize', later);
  document.addEventListener('mousedown', () => { _pointerDown = true; }, true);
  document.addEventListener('mouseup', () => { _pointerDown = false; later(); }, true);
  document.addEventListener('touchstart', () => { _pointerDown = true; }, { capture: true, passive: true });
  document.addEventListener('touchend', () => { _pointerDown = false; later(); }, { capture: true, passive: true });
  document.getElementById('backToContent')?.addEventListener('click', () => { travelFitAll(); updateZoomLabel(); });
  setTimeout(growBoard, 400);
}

function setupBoardMinimap() {
  const mm = document.getElementById('boardMinimap');
  const wrap = document.getElementById('boardWrap');
  if (!mm) return;
  wrap.addEventListener('scroll', updateMinimap, { passive: true });

  // Click / drag → center the viewport on that spot
  const jump = e => {
    const W = minimapWorld(mm);
    const r = mm.getBoundingClientRect();
    const rx = ((e.clientX - r.left) * (mm.width / r.width) - W.ox) / W.s;   // rendered board coords
    const ry = ((e.clientY - r.top) * (mm.height / r.height) - W.oy) / W.s;
    wrap.scrollLeft = rx * BOARD_ZOOM - wrap.clientWidth / 2;
    wrap.scrollTop  = ry * BOARD_ZOOM - wrap.clientHeight / 2;
    updateMinimap();
  };
  mm.addEventListener('mousedown', e => {
    e.preventDefault();
    jump(e);
    const mv = ev => jump(ev);
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
  updateMinimap();
}

// ── Multi-select (Shift + drag) ───────────────────────────────
// Rubber-band selection of notes; the group can then be dragged together
// (see makeDraggable) or acted on via the floating toolbar: color, folder,
// delete, clear. Ctrl+shift-drag ADDS to the current selection.
const SELECTED = new Set();
const NOTE_COLORS = ['#fef9c3', '#fce7f3', '#dbeafe', '#dcfce7', '#f3e8ff', '#ffedd5', '#e0f2fe', '#fee2e2'];

function clearSelection() {
  SELECTED.forEach(id => document.getElementById('n-' + id)?.classList.remove('msel'));
  SELECTED.clear();
  updateMselBar();
}

function updateMselBar() {
  const bar = document.getElementById('mselBar');
  if (!bar) return;
  bar.style.display = SELECTED.size ? 'flex' : 'none';
  const c = document.getElementById('mselCount');
  if (c) c.textContent = `${SELECTED.size} vybráno`;
}

function setupMultiSelect() {
  if (MY_ROLE === 'viewer') return; // nothing a viewer could do with a selection
  const wrap = document.getElementById('boardWrap');
  let selDiv = null;

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0 || !e.shiftKey) return;
    if (e.target.closest('.note, .wb-bar, .wb-h, .wb-text, .wb-img-move, .wb-img-rz')) return;
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    selDiv = document.createElement('div');
    selDiv.id = 'selRect';
    document.body.appendChild(selDiv);
    const mv = ev => {
      Object.assign(selDiv.style, {
        left: Math.min(sx, ev.clientX) + 'px', top: Math.min(sy, ev.clientY) + 'px',
        width: Math.abs(ev.clientX - sx) + 'px', height: Math.abs(ev.clientY - sy) + 'px',
      });
    };
    const up = ev => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      const r = selDiv.getBoundingClientRect();
      selDiv.remove(); selDiv = null;
      applySelectionRect(r, ev.ctrlKey || ev.metaKey);
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') clearSelection(); });

  document.getElementById('mselClear')?.addEventListener('click', clearSelection);
  document.getElementById('mselDelete')?.addEventListener('click', deleteSelection);
  document.getElementById('mselFolder')?.addEventListener('click', openMoveSelectionToFolder);
  document.getElementById('mselColor')?.addEventListener('click', e => openSelectionColorPopup(e.clientX, e.clientY));
  document.getElementById('mselExport')?.addEventListener('click', () => {
    if (!SELECTED.size) return;
    openExportModal(new Set(SELECTED));
  });
  // Same rule as the toolbar's AI button: guests can't create AI decks.
  const aiBtn = document.getElementById('mselAi');
  if (aiBtn && ME.isAnonymous) aiBtn.style.display = 'none';
  aiBtn?.addEventListener('click', () => { if (SELECTED.size) openAiCardsModal(); });
}

function applySelectionRect(r, additive) {
  if (!additive) clearSelection();
  NOTES_MAP.forEach((n, id) => {
    const el = document.getElementById('n-' + id);
    if (!el) return;
    const nr = el.getBoundingClientRect();
    if (nr.left < r.right && nr.right > r.left && nr.top < r.bottom && nr.bottom > r.top) {
      SELECTED.add(id);
      el.classList.add('msel');
    }
  });
  updateMselBar();
}

async function deleteSelection() {
  const ids = [...SELECTED];
  if (!ids.length) return;
  if (!confirm(`Smazat ${ids.length} vybraných poznámek?`)) return;
  let ok = 0, skipped = 0;
  for (const id of ids) {
    const n = NOTES_MAP.get(id);
    if (n && canManageNote(n)) { await doDeleteNote(id, false, true); ok++; }
    else skipped++;
  }
  clearSelection();
  if (ok) toastAction(`Smazáno ${ok} poznámek.`, '↶ Vrátit vše', async () => { for (let i = 0; i < ok; i++) await undoNoteDelete(); });
  if (skipped) toast(`${skipped} přeskočeno (nemáš oprávnění).`);
}

function openMoveSelectionToFolder() {
  const ids = [...SELECTED];
  if (!ids.length) return;
  const listEl = document.getElementById('moveToFolderList');
  const folders = [...FOLDERS_MAP.values()].sort((a, b) => folderPathLabel(a).localeCompare(folderPathLabel(b), 'cs'));
  listEl.innerHTML = `<div class="move-to-folder-row" data-folder="">🚫 Bez složky</div>` +
    folders.map(f => `
      <div class="move-to-folder-row" data-folder="${f.id}" style="--row-color:${f.color || '#6366f1'}">
        📁 ${esc(folderPathLabel(f))}
      </div>`).join('');
  listEl.querySelectorAll('.move-to-folder-row').forEach(row => {
    row.addEventListener('click', async () => {
      closeModal('moveToFolderModal');
      for (const id of ids) await moveNoteToFolder(id, row.dataset.folder || null, true);
      toast(`Přesunuto ${ids.length} poznámek.`);
      clearSelection();
    });
  });
  openModal('moveToFolderModal');
}

function openSelectionColorPopup(x, y) {
  closeMarkColorPopup();
  const pop = document.createElement('div');
  pop.className = 'mark-color-popup';
  pop.id = 'markColorPopup';
  pop.innerHTML = NOTE_COLORS.map(c => `<button class="mark-color-swatch" data-c="${c}" style="background:${c}"></button>`).join('');
  document.body.appendChild(pop);
  pop.style.left = x + 'px';
  pop.style.top  = (y - 50) + 'px';
  const r = pop.getBoundingClientRect();
  if (r.right > window.innerWidth) pop.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.top < 0) pop.style.top = (y + 10) + 'px';
  pop.querySelectorAll('.mark-color-swatch').forEach(sw => sw.addEventListener('click', async e => {
    e.stopPropagation();
    closeMarkColorPopup();
    const ids = [...SELECTED];
    let ok = 0, skipped = 0;
    for (const id of ids) {
      const n = NOTES_MAP.get(id);
      if (n && canEdit(n)) {
        try { await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(id).update({ color: sw.dataset.c }); ok++; }
        catch (_) { skipped++; }
      } else skipped++;
    }
    toast(`Barva změněna u ${ok} poznámek${skipped ? `, ${skipped} přeskočeno` : ''}.`);
  }));
  setTimeout(() => document.addEventListener('click', closeMarkColorPopup, { once: true }), 0);
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
    // mousedown handler owns left-drag on itself, and a whiteboard's toolbar/
    // resize own their controls — panning here would preventDefault() the
    // mousedown and stop a <select>/color picker from ever opening (and start
    // an unwanted scroll). The tabule's empty canvas (pointer-events:none when
    // idle) isn't matched, so panning over a tabule still works.
    if (e.button === 0 && e.target.closest('.note, .wb-bar, .wb-h')) return;
    if (e.button === 0 && e.shiftKey) return; // shift+drag = multi-select rubber band
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

  // ── Touch: one finger on empty canvas pans; two fingers pan and pinch-zoom.
  // Notes handle their own one-finger drag in makeDraggable.
  let touchPan = null;   // { x, y, sl, st }
  let pinch    = null;   // { dist, zoom, x, y, sl, st }
  let suppressTouchClick = false, suppressTouchClickTimer = null;
  const suppressGestureClick = () => {
    suppressTouchClick = true;
    clearTimeout(suppressTouchClickTimer);
    suppressTouchClickTimer = setTimeout(() => { suppressTouchClick = false; }, 350);
  };
  // Some mobile browsers synthesize a click on the note after a swipe/pinch.
  // Eat that one click so a board gesture doesn't accidentally open the note.
  wrap.addEventListener('click', e => {
    if (!suppressTouchClick) return;
    suppressTouchClick = false;
    clearTimeout(suppressTouchClickTimer);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const touchMid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

  // Pinch: while the fingers move, the whole viewport is only SCALED with a
  // GPU transform (cheap, smooth). The real CSS zoom — which re-lays-out the
  // entire board and made it flicker, tear and drop whiteboards — is applied
  // once, when the fingers lift.
  const pinchScale = () => Math.min(2.2, Math.max(0.15, pinch.zoom * pinch.k)) / pinch.zoom;
  const commitPinch = () => {
    if (!pinch) return;
    const rect = { left: pinch.rl, top: pinch.rt };   // ne getBoundingClientRect — ten je teď posunutý transformem
    const k = pinchScale();
    // Board point that was under the fingers at the start …
    const bx = (pinch.sl + pinch.x - rect.left) / pinch.zoom;
    const by = (pinch.st + pinch.y - rect.top) / pinch.zoom;
    wrap.style.transform = '';
    wrap.style.willChange = '';
    BOARD_ZOOM = pinch.zoom * k;
    document.getElementById('board').style.zoom = BOARD_ZOOM;
    // … stays under where the fingers are now.
    wrap.scrollLeft = bx * BOARD_ZOOM - (pinch.mx - rect.left);
    wrap.scrollTop  = by * BOARD_ZOOM - (pinch.my - rect.top);
    updateZoomLabel();
    updateMinimap();
  };

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const mid = touchMid(e.touches);
      pinch = {
        dist: Math.max(1, touchDist(e.touches)), zoom: BOARD_ZOOM,
        x: mid.x, y: mid.y, sl: wrap.scrollLeft, st: wrap.scrollTop,
        mx: mid.x, my: mid.y, k: 1,
        rl: wrap.getBoundingClientRect().left, rt: wrap.getBoundingClientRect().top,
        moved: !!touchPan?.moved,
      };
      wrap.style.transformOrigin = '0 0';
      wrap.style.willChange = 'transform';
      touchPan = null;
      e.preventDefault();
    }
    // Jeden prst: posouvá nativně prohlížeč (touch-action: pan-x pan-y),
    // JS do toho nesahá — dřív to dělal ručně a na Androidu to trhalo.
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      const mid = touchMid(e.touches);
      if (Math.hypot(mid.x - pinch.x, mid.y - pinch.y) > 8 ||
          Math.abs(touchDist(e.touches) - pinch.dist) > 8) {
        pinch.moved = true;
        suppressGestureClick();
      }
      const rectP = { left: pinch.rl, top: pinch.rt };
      pinch.k = touchDist(e.touches) / pinch.dist;
      pinch.mx = mid.x; pinch.my = mid.y;
      const k = pinchScale();
      // Keep the start point under the moving finger midpoint: this pans with
      // two fingers too, and combines translation + zoom without jumping.
      const p0x = pinch.x - rectP.left, p0y = pinch.y - rectP.top;
      const tx = (mid.x - rectP.left) - p0x * k, ty = (mid.y - rectP.top) - p0y * k;
      wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
      const pct = document.getElementById('zoomPct');
      if (pct) pct.textContent = Math.round(pinch.zoom * k * 100) + ' %';
    } else if (touchPan && e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      if (Math.hypot(t.clientX - touchPan.x, t.clientY - touchPan.y) > 8) {
        touchPan.moved = true;
        suppressGestureClick();
      }
      wrap.scrollLeft = touchPan.sl - (t.clientX - touchPan.x);
      wrap.scrollTop  = touchPan.st - (t.clientY - touchPan.y);
    }
  }, { passive: false });

  const endTouch = e => {
    if (e.touches.length < 2 && pinch) {
      if (pinch.moved) suppressGestureClick();
      commitPinch();
      pinch = null;
    }
    if (e.touches.length === 0 && touchPan) {
      if (touchPan.moved) suppressGestureClick();
      touchPan = null;
    }
  };
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
  updateMinimap();
  updateZoomLabel();
}
function setupBoardZoom() {
  const wrap = document.getElementById('boardWrap');
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    setBoardZoom(BOARD_ZOOM * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX, e.clientY);
  }, { passive: false });
}

// ── AI Flash Cards from notes ───────────────────────────────────

// ── Pozadí místnosti ──────────────────────────────────────────
// The owner picks a background per room (rooms/{id}.bg); everyone in the
// room sees it, live. Three kinds of value:
//   ''/'dots'/…    — pure-CSS patterns ([data-bg] rules in style.css)
//   'gen1:…'       — a generated image: only the recipe is stored and every
//                    browser draws it itself (js/bggen.js), so it costs ~30 B
//   (later) image files: { id: 'img:les', name: 'Les', file: 'img/bg/les.webp', dark: true }
// "Dark" backgrounds keep their own colours, so headings switch to light.
const ROOM_BACKGROUNDS = [
  { id: '',          name: 'Mřížka' },
  { id: 'dots',      name: 'Tečky' },
  { id: 'plain',     name: 'Bez vzoru' },
  { id: 'aurora',    name: 'Polární záře' },
  { id: 'blueprint', name: 'Modrotisk',        dark: true },
  { id: 'chalk',     name: 'Školní tabule',    dark: true },
  { id: 'cork',      name: 'Korková nástěnka', dark: true },
];
// Images get a light dimming layer so notes and headings stay readable.
const ROOM_BG_IMAGE_DIM = 'linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25))';
let ROOM_BG_VARIANTS = [];

function roomBgDef(id) { return ROOM_BACKGROUNDS.find(b => b.id === id) || ROOM_BACKGROUNDS[0]; }

// scale < 1 only for the small previews in the picker.
function paintRoomBg(el, id, scale = 1) {
  if (BgGen.isRecipe(id)) {
    el.dataset.bg = 'img:gen';
    el.dataset.bgTone = 'dark';
    el.dataset.bgWant = id;
    BgGen.toUrl(id, 'pozadi', scale).then(url => {
      if (url && el.dataset.bgWant === id) el.style.backgroundImage = `${ROOM_BG_IMAGE_DIM}, url("${url}")`;
    });
    return;
  }
  delete el.dataset.bgWant;
  const def = roomBgDef(id);
  if (def.id) el.dataset.bg = def.id; else delete el.dataset.bg;
  if (def.dark) el.dataset.bgTone = 'dark'; else delete el.dataset.bgTone;
  el.style.backgroundImage = def.file ? `${ROOM_BG_IMAGE_DIM}, url("${def.file}")` : '';
}

function applyRoomBackground(id) {
  const wrap = document.getElementById('boardWrap');
  if (wrap) paintRoomBg(wrap, id);
}

function setupRoomBackground() {
  applyRoomBackground(ROOM.bg || '');
  db.collection('rooms').doc(ROOM_ID).onSnapshot(snap => {
    const d = snap.data() || {};
    const bg = d.bg || '';
    if (bg !== (ROOM.bg || '')) { ROOM.bg = bg; applyRoomBackground(bg); }
    syncRoomMembership(d);
  }, () => { /* bez živých změn — pozadí zůstane, jak se načetlo */ });
  // Everyone may open the picker: non-owners to save a background they
  // like into their favourites, the owner also to change it.
  const btn = document.getElementById('roomBgBtn');
  if (!btn || ME.isAnonymous) return;
  btn.style.display = '';
  btn.addEventListener('click', openRoomBgPicker);
}

function roomBgTile(id, name, { fav = false, selected = false } = {}) {
  return `
    <div class="room-bg-opt${selected ? ' selected' : ''}" data-bg-id="${esc(id)}" role="button" tabindex="0">
      <span class="board-wrap"></span>
      <span class="room-bg-name">${esc(name)}</span>
      ${fav ? `<button type="button" class="room-bg-fav${BgFav.has('pozadi', id) ? ' on' : ''}" title="Oblíbené">${BgFav.has('pozadi', id) ? '♥' : '♡'}</button>` : ''}
    </div>`;
}

function genName(recipe) {
  const p = BgGen.parse(recipe);
  return p ? `${p.style.name.replace(/ \(.*\)| –.*/, '')} · ${p.palette.name}` : '';
}

async function openRoomBgPicker() {
  const isOwner = MY_ROLE === 'owner';
  const cur = ROOM.bg || '';
  await BgFav.load();
  if (!ROOM_BG_VARIANTS.length) ROOM_BG_VARIANTS = Array.from({ length: 6 }, () => BgGen.random());
  const favs = BgFav.items.filter(it => it.k === 'pozadi').map(it => it.r);
  const grid = document.getElementById('roomBgGrid');
  const section = (title, html, extra = '') =>
    `<div class="room-bg-section"><div class="room-bg-head"><span>${title}</span>${extra}</div><div class="room-bg-tiles">${html}</div></div>`;

  let html = '';
  if (BgGen.isRecipe(cur)) {
    html += section('Aktuální pozadí', roomBgTile(cur, genName(cur), { fav: true, selected: true }));
  }
  if (isOwner) {
    html += section('Vzory', ROOM_BACKGROUNDS.map(b => roomBgTile(b.id, b.name, { selected: cur === b.id })).join(''));
    html += section('Vygenerovat', ROOM_BG_VARIANTS.map(r => roomBgTile(r, genName(r), { fav: true, selected: cur === r })).join(''),
      '<button type="button" class="btn btn-ghost" id="roomBgReroll" style="padding:3px 10px;font-size:0.78rem;">🎲 Další</button>');
  }
  html += section(`Oblíbené (${favs.length}/${BG_FAV_MAX})`, favs.length
    ? favs.map(r => roomBgTile(r, genName(r), { fav: true, selected: cur === r })).join('')
    : '<p class="room-bg-empty">Zatím nic. Srdíčkem ♡ si ulož pozadí, které se ti líbí — i z cizí místnosti.</p>');
  grid.innerHTML = html;
  document.getElementById('roomBgHint').textContent = isOwner
    ? 'Pozadí uvidí všichni v místnosti. Vygenerované obrázky si ukládáš srdíčkem do oblíbených (max. 10).'
    : 'Pozadí místnosti může měnit jen vlastník. Líbí-li se ti, ulož si ho srdíčkem a použij ve své místnosti.';

  grid.querySelectorAll('.room-bg-opt').forEach(opt => {
    paintRoomBg(opt.querySelector('.board-wrap'), opt.dataset.bgId, 0.25);
    opt.querySelector('.room-bg-fav')?.addEventListener('click', async e => {
      e.stopPropagation();
      const msg = await BgFav.toggle('pozadi', opt.dataset.bgId);
      if (msg) { toast(msg); return; }
      openRoomBgPicker(); // re-render counts and hearts
    });
    if (!isOwner) return;
    opt.addEventListener('click', () => setRoomBackground(opt.dataset.bgId));
  });
  document.getElementById('roomBgReroll')?.addEventListener('click', () => {
    ROOM_BG_VARIANTS = Array.from({ length: 6 }, () => BgGen.random());
    openRoomBgPicker();
  });
  openModal('roomBgModal');
}

async function setRoomBackground(id) {
  const prev = ROOM.bg || '';
  if (id === prev) return;
  ROOM.bg = id;
  applyRoomBackground(id);
  document.querySelectorAll('#roomBgGrid .room-bg-opt').forEach(o => o.classList.toggle('selected', o.dataset.bgId === id));
  try {
    await db.collection('rooms').doc(ROOM_ID).update({ bg: id || firebase.firestore.FieldValue.delete() });
  } catch (e) {
    ROOM.bg = prev;
    applyRoomBackground(prev);
    document.querySelectorAll('#roomBgGrid .room-bg-opt').forEach(o => o.classList.toggle('selected', o.dataset.bgId === prev));
    toast('Pozadí se nepodařilo uložit: ' + e.message);
  }
}

// ── Ovládání místnosti: horní lišta, panel nástrojů, zoom (design v10) ──
// The buttons keep their old ids (exportBtn, connectBtn, roomBgBtn…), so the
// existing handlers in the other modules keep working wherever they now sit.
function boardViewCenter() {
  const wrap = document.getElementById('boardWrap');
  return {
    x: Math.round(toStoreX((wrap.scrollLeft + wrap.clientWidth / 2) / BOARD_ZOOM) - 110),
    y: Math.round(toStoreY((wrap.scrollTop + wrap.clientHeight / 2) / BOARD_ZOOM) - 60),
  };
}

function updateZoomLabel() {
  const el = document.getElementById('zoomPct');
  if (el) el.textContent = Math.round(BOARD_ZOOM * 100) + ' %';
}

function closeRoomMoreMenu() {
  document.getElementById('roomMoreMenu')?.classList.remove('open');
  document.getElementById('roomMoreBtn')?.setAttribute('aria-expanded', 'false');
}

function setupRoomChrome() {
  document.getElementById('roomColorDot').style.background = ROOM.color || 'var(--accent)';

  // ⋯ menu: every item closes it; the items' own handlers do the work.
  const moreBtn = document.getElementById('roomMoreBtn');
  const menu = document.getElementById('roomMoreMenu');
  moreBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    moreBtn.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', () => closeRoomMoreMenu());
  document.addEventListener('click', e => { if (!e.target.closest('.nav-menu-wrap')) closeRoomMoreMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRoomMoreMenu(); });
  document.getElementById('travelMenuBtn').addEventListener('click', () => openTravelAgent());
  // Mobile: buttons that don't fit the bar are reachable from the menu.
  menu.querySelectorAll('[data-proxy]').forEach(item => item.addEventListener('click', () =>
    document.getElementById(item.dataset.proxy)?.click()));

  // "Sdílet" in the bar opens the same dialog as the button in the members panel.
  const shareTop = document.getElementById('shareTopBtn');
  if (ME.isAnonymous) shareTop.style.display = 'none';
  else shareTop.addEventListener('click', () => document.getElementById('shareBtn').click());

  // Tool rail — creating things is for owners/editors only.
  const rail = document.getElementById('toolRail');
  const canWrite = MY_ROLE !== 'viewer' && !(ME.isAnonymous && MY_ROLE !== 'owner');
  if (!canWrite) rail.style.display = 'none';
  document.body.classList.toggle('can-write', canWrite);
  document.getElementById('toolNote').addEventListener('click', () => {
    PENDING_ADD_POS = boardViewCenter();
    openAddNote();
  });
  document.getElementById('toolHeading').addEventListener('click', () => { const p = boardViewCenter(); createHeading(p.x, p.y); });
  document.getElementById('toolGuide').addEventListener('click', () => { const p = boardViewCenter(); createGuide(p.x, p.y); });
  document.getElementById('toolBoard').addEventListener('click', () => { const p = boardViewCenter(); createWhiteboard(p.x, p.y); });

  // Zoom pill: − / 100 % / + / fit everything
  document.getElementById('zoomOutBtn').addEventListener('click', () => { setBoardZoom(BOARD_ZOOM / 1.2); updateZoomLabel(); });
  document.getElementById('zoomInBtn').addEventListener('click', () => { setBoardZoom(BOARD_ZOOM * 1.2); updateZoomLabel(); });
  document.getElementById('zoomPct').addEventListener('click', () => { setBoardZoom(1); updateZoomLabel(); });
  document.getElementById('zoomFitBtn').addEventListener('click', () => { travelFitAll(); updateZoomLabel(); });
  updateZoomLabel();
  setupMobileOrb();
  setupInfiniteBoard();
}

// ── Mobil: orb ────────────────────────────────────────────────
// Na telefonu se horní lišta ani nástroje nevejdou. Orb (jako v Opeře GX)
// je jedno kulaté tlačítko dole; ťuknutí otevře panel se VŠÍM, co je na
// počítači v liště a v nástrojích vlevo. Položky jen klikají na původní
// tlačítka, takže se chovají přesně stejně. Orb jde přetáhnout jinam.
const ORB_GROUPS = [
  ['Vytvořit', [
    ['toolNote', 'Poznámka'], ['toolHeading', 'Nadpis'], ['toolGuide', 'Návod'],
    ['toolBoard', 'Tabule'], ['connectBtn', 'Propojit'], ['newFolderBtn', 'Složka'],
  ]],
  ['Místnost', [
    ['searchBtn', 'Hledat'], ['travelMenuBtn', 'Přejít na…'], ['filesBtn', 'Soubory'],
    ['aiCardsBtn', 'AI'], ['flashcardsBtn', 'Kartičky'], ['membersBtn', 'Členové'],
    ['shareTopBtn', 'Sdílet'], ['importBtn', 'Import'], ['presentBtn', 'Prezentace'], ['pomoBtn', 'Pomodoro'], ['sndBtn', 'Zvuk'], ['exportBtn', 'Export'], ['roomBgBtn', 'Pozadí'],
  ]],
  ['Zobrazení', [
    ['@board', 'Nástěnka'], ['@list', 'Seznam'], ['zoomOutBtn', 'Oddálit'],
    ['zoomInBtn', 'Přiblížit'], ['zoomFitBtn', 'Celá plocha'], ['navBackBtn', 'Místnosti'],
  ]],
];
const ORB_ICON = {
  '@board': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  '@list': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  zoomOutBtn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>',
  zoomInBtn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/></svg>',
};

function orbTargetUsable(id) {
  if (id.startsWith('@')) return true;
  const el = document.getElementById(id);
  if (!el) return false;
  // Inline display:none = schované kódem (práva, režim seznamu) — to platí i tady.
  // Schované jen kvůli úzkému displeji (CSS) naopak do orbu patří.
  if (el.style.display === 'none' && id !== 'newFolderBtn') return false;
  if (id === 'newFolderBtn') return document.body.classList.contains('view-list') && document.body.classList.contains('can-write');
  if (id.startsWith('tool') || id === 'connectBtn') return document.body.classList.contains('can-write') && !document.body.classList.contains('view-list');
  if (id.startsWith('zoom')) return !document.body.classList.contains('view-list');
  return true;
}

function renderOrbSheet() {
  const sheet = document.getElementById('orbSheet');
  const view = document.body.classList.contains('view-list') ? 'list' : 'board';
  sheet.innerHTML = '<div class="orb-grip"></div>' + ORB_GROUPS.map(([title, items]) => {
    const btns = items.filter(([id]) => orbTargetUsable(id)).map(([id, label]) => {
      const src = id.startsWith('@') ? null : document.getElementById(id);
      const icon = ORB_ICON[id] || src?.querySelector('svg')?.outerHTML || '';
      const on = id === '@' + view ? ' on' : '';
      const badge = id === 'membersBtn' ? (document.getElementById('memberCount')?.textContent || '') : '';
      return `<button type="button" class="orb-item${on}" data-orb="${id}">${icon}<span>${esc(label)}</span>${badge ? `<i class="orb-badge">${esc(badge)}</i>` : ''}</button>`;
    }).join('');
    return btns ? `<div class="orb-group"><div class="orb-gtitle">${title}</div><div class="orb-grid">${btns}</div></div>` : '';
  }).join('');
}

function setOrbOpen(open) {
  const orb = document.getElementById('mobileOrb');
  const sheet = document.getElementById('orbSheet');
  const back = document.getElementById('orbBackdrop');
  if (open) renderOrbSheet();
  sheet.hidden = !open; back.hidden = !open;
  orb.classList.toggle('open', open);
  orb.setAttribute('aria-expanded', String(open));
}

function setupMobileOrb() {
  const orb = document.getElementById('mobileOrb');
  const sheet = document.getElementById('orbSheet');
  if (!orb || !sheet) return;
  // Uložená pozice (přetažení prstem); jinak vpravo dole.
  try {
    const p = JSON.parse(localStorage.getItem('sb_orb_pos') || 'null');
    if (p) { orb.style.left = p.x + 'px'; orb.style.top = p.y + 'px'; orb.style.right = 'auto'; orb.style.bottom = 'auto'; }
  } catch (_) {}
  // Po otočení telefonu / jiném displeji nesmí zůstat mimo obrazovku.
  const keepOnScreen = () => {
    if (!orb.style.left) return;
    const x = Math.min(Math.max(6, parseInt(orb.style.left)), window.innerWidth - 64);
    const y = Math.min(Math.max(60, parseInt(orb.style.top)), window.innerHeight - 64);
    orb.style.left = x + 'px'; orb.style.top = y + 'px';
  };
  keepOnScreen();
  window.addEventListener('resize', keepOnScreen);
  let drag = null, moved = false;
  orb.addEventListener('touchstart', e => {
    const t = e.touches[0], r = orb.getBoundingClientRect();
    drag = { dx: t.clientX - r.left, dy: t.clientY - r.top, x0: t.clientX, y0: t.clientY };
    moved = false;
  }, { passive: true });
  orb.addEventListener('touchmove', e => {
    if (!drag) return;
    const t = e.touches[0];
    if (!moved && Math.hypot(t.clientX - drag.x0, t.clientY - drag.y0) < 10) return;
    moved = true;
    e.preventDefault();
    const x = Math.min(Math.max(6, t.clientX - drag.dx), window.innerWidth - orb.offsetWidth - 6);
    const y = Math.min(Math.max(60, t.clientY - drag.dy), window.innerHeight - orb.offsetHeight - 6);
    Object.assign(orb.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
  }, { passive: false });
  orb.addEventListener('touchend', () => {
    if (moved) {
      try { localStorage.setItem('sb_orb_pos', JSON.stringify({ x: parseInt(orb.style.left), y: parseInt(orb.style.top) })); } catch (_) {}
    }
    drag = null;
  });
  orb.addEventListener('click', e => {
    if (moved) { moved = false; e.preventDefault(); return; }
    setOrbOpen(sheet.hidden);
  });
  document.getElementById('orbBackdrop').addEventListener('click', () => setOrbOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) setOrbOpen(false); });
  sheet.addEventListener('click', e => {
    const id = e.target.closest('[data-orb]')?.dataset.orb;
    if (!id) return;
    setOrbOpen(false);
    if (id.startsWith('@')) { document.querySelector(`.room-view-seg [data-view="${id.slice(1)}"]`)?.click(); return; }
    document.getElementById(id)?.click();
  });
}

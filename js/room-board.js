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

  NOTES_MAP.forEach((n, id) => out.push({
    kind: 'note', id, icon: '📝', group: 'Poznámky',
    title: n.title || noteToPlainText(n).slice(0, 50) || '(bez názvu)',
    sub: folderOf(id) || (pagesOf(n).length ? 'návod' : ''),
    x: n.x, y: n.y, color: n.color, note: n,
  }));

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

// What the palette shows with an EMPTY search box. Long families (rooms,
// decks — and notes once there are many) collapse into a single row whose
// contents open in the right-hand pane, instead of one endless column.
const TRAVEL_INLINE_MAX = 8;
function travelBrowse(all, remote) {
  const of = kind => all.filter(d => d.kind === kind);
  const out = [];

  out.push(all.find(d => d.id === 'dash'));

  // Only the decks belonging to THIS room — personal ones live on the
  // dashboard and would just be noise here (typing still finds them).
  const decks = of('deck').filter(d => d.deck?.roomId === ROOM_ID);
  out.push({ kind: 'cat', id: 'decks', icon: '🃏', group: 'Kam jinam',
             title: 'Flash Cards', sub: decks.length ? `${decks.length} balíčků v místnosti` : 'zatím žádné balíčky',
             items: decks, empty: 'V této místnosti zatím nejsou žádné balíčky.',
             extra: { kind: 'action', id: 'cards', icon: '🃏',
                      title: 'Otevřít Flash Cards této místnosti', sub: 'přehled všech balíčků' } });

  const rooms = of('room');
  out.push({ kind: 'cat', id: 'rooms', icon: '🚪', group: 'Kam jinam',
             title: 'Jiné místnosti', sub: rooms.length ? `${rooms.length} místností` : 'jsi jen tady',
             items: rooms, empty: 'Nejsi v žádné další místnosti.' });

  out.push(all.find(d => d.id === 'fit'));
  out.push(all.find(d => d.id === 'back'));

  // Things on THIS board stay listed one by one while there aren't too many —
  // that's what you usually came for.
  const groups = [
    ['note',   'Poznámky', '📝', 'Poznámky na této nástěnce'],
    ['board',  'Tabule',   '🎨', 'Tabule na této nástěnce'],
    ['folder', 'Složky',   '📁', 'Složky'],
  ];
  groups.forEach(([kind, group, icon, catTitle]) => {
    const items = of(kind);
    if (!items.length) return;
    if (items.length <= TRAVEL_INLINE_MAX) out.push(...items);
    else out.push({ kind: 'cat', id: kind + 's', icon, group,
                    title: catTitle, sub: `${items.length}`, items, empty: '' });
  });

  return out.filter(Boolean);
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
  if (dest.kind === 'deck') {
    window.location.href = `flashcards.html?deck=${dest.id}` + (dest.deck?.roomId ? `&room=${dest.deck.roomId}` : '');
    return;
  }
  if (dest.kind === 'cat') return;         // a category is opened, not travelled to

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
    void el.offsetWidth;                   // restart the animation
    el.classList.add('travel-flash');
    setTimeout(() => el.classList.remove('travel-flash'), 1600);
  }

  const i = TRAVEL_RECENT.findIndex(r => r.id === dest.id && r.kind === dest.kind);
  if (i >= 0) TRAVEL_RECENT.splice(i, 1);
  TRAVEL_RECENT.unshift({ id: dest.id, kind: dest.kind });
  TRAVEL_RECENT.length = Math.min(TRAVEL_RECENT.length, 6);
}

// Notes of ANOTHER room, fetched only when you actually look at that room in
// the palette, then cached. Lets you pick the note before leaving this page —
// room.html?id=…&note=… opens it straight away.
const TRAVEL_ROOM_NOTES = new Map();   // roomId → [{id,title}] | 'loading'
async function travelRoomNotes(roomId, onLoaded) {
  if (TRAVEL_ROOM_NOTES.has(roomId)) return TRAVEL_ROOM_NOTES.get(roomId);
  TRAVEL_ROOM_NOTES.set(roomId, 'loading');
  try {
    const snap = await db.collection('rooms').doc(roomId).collection('notes')
      .orderBy('createdAt', 'desc').limit(30).get();
    const notes = snap.docs.map(d => {
      const n = d.data();
      const plain = (n.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return { id: d.id, title: n.title || plain.slice(0, 44) || '(bez názvu)',
               pages: Array.isArray(n.pages) ? n.pages.length : 0 };
    });
    TRAVEL_ROOM_NOTES.set(roomId, notes);
  } catch (_) {
    TRAVEL_ROOM_NOTES.set(roomId, []);
  }
  if (onLoaded) onLoaded();
  return TRAVEL_ROOM_NOTES.get(roomId);
}

// Notes of the room currently highlighted in the right pane. Clicking one
// opens that room WITH the note already open.
function roomNotesHtml(it) {
  if (it.kind !== 'room') return '';
  const notes = TRAVEL_ROOM_NOTES.get(it.id);
  if (notes === 'loading' || notes === undefined) return '<div class="tp-sub-load">Načítám poznámky…</div>';
  if (!notes.length) return '<div class="tp-sub-load">V této místnosti zatím nejsou poznámky.</div>';
  const shown = notes.slice(0, 8);
  return `<div class="tp-sub">
      ${shown.map(n => `<button class="tp-note" data-room="${esc(it.id)}" data-note="${esc(n.id)}">
          ${n.pages ? '📖' : '📝'} ${esc(n.title)}</button>`).join('')}
      ${notes.length > shown.length ? `<div class="tp-sub-more">a další ${notes.length - shown.length}…</div>` : ''}
    </div>`;
}

function travelPreview(d) {
  if (!d) return '<div class="tp-empty">Vyber cíl vlevo</div>';

  // A category shows its contents right here — click one, or step in with →
  if (d.kind === 'cat') {
    const rows = [];
    if (d.extra) rows.push(d.extra);
    rows.push(...d.items);
    return `<div class="tp-head"><span class="tp-icon">${d.icon}</span>
        <div><b>${esc(d.title)}</b><span>${esc(d.sub)}</span></div></div>` +
      (rows.length
        ? `<div class="tp-grid">${rows.map((it, i) => `
            <button class="tp-card${i === d._sub ? ' on' : ''}" data-sub="${i}" style="--c:${esc(it.color || '#94a3b8')}">
              <span class="tp-card-ico">${it.icon}</span>
              <span class="tp-card-txt"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span></span>
            </button>
            ${i === d._sub ? roomNotesHtml(it) : ''}`).join('')}</div>`
        : `<div class="tp-body"><i>${esc(d.empty || 'Nic tu není.')}</i></div>`) +
      '<div class="tp-go">→ vstoupit · Enter přejít</div>';
  }

  const head = `<div class="tp-head"><span class="tp-icon" style="--c:${esc(d.color || '#94a3b8')}">${d.icon}</span>
    <div><b>${esc(d.title)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ''}</div></div>`;

  let body = '';
  if (d.kind === 'note') {
    const n = d.note;
    const pages = pagesOf(n);
    const text = noteToPlainText(n).slice(0, 400);
    body = `
      ${pages.length ? `<div class="tp-tag">📖 Návod · ${pages.length} kapitol</div>` : ''}
      <div class="tp-body">${text ? esc(text) : '<i>Prázdná poznámka</i>'}</div>
      <div class="tp-meta">Autor: ${esc(n.authorName || '—')}${n.commentCount ? ` · 💬 ${n.commentCount}` : ''}</div>`;
  } else if (d.kind === 'board') {
    const wb = d.wb;
    body = `<div class="tp-meta">Tahů: ${(wb.strokes || []).length} · textů: ${(wb.texts || []).length} · obrázků: ${(wb.images || []).length}</div>`;
  } else if (d.kind === 'folder') {
    const notes = (d.folder.noteIds || []).map(i => NOTES_MAP.get(i)).filter(Boolean).slice(0, 8);
    body = `<div class="tp-list">${notes.map(n =>
      `<div>📝 ${esc(n.title || noteToPlainText(n).slice(0, 40) || '(bez názvu)')}</div>`).join('') || '<i>Prázdná složka</i>'}</div>`;
  } else if (d.kind === 'room') {
    body = `<div class="tp-body">Přejde do jiné místnosti.</div>
            <div class="tp-meta">Tvoje role: ${esc(roleLabel(d.room.role))}</div>`;
  } else if (d.kind === 'deck') {
    body = `<div class="tp-body">Otevře balíček kartiček — učení, kvíz, psaní i párování.</div>
            <div class="tp-meta">${d.deck.count} karet</div>`;
  } else {
    body = `<div class="tp-body">${esc(d.sub || '')}</div>`;
  }
  return head + body + '<div class="tp-go">Enter — přejít</div>';
}

// ── The palette ───────────────────────────────────────────────
function closeTravelAgent() { document.getElementById('travelAgent')?.remove(); }

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
    <div class="ta-cols">
      <div id="taList" class="ta-list"></div>
      <div id="taPrev" class="ta-prev"></div>
    </div>`;
  document.body.appendChild(box);

  const input = document.getElementById('taInput');
  const list  = document.getElementById('taList');
  const prev  = document.getElementById('taPrev');
  setTimeout(() => input.focus(), 20);

  let all = travelDestinations(null);
  let shown = [], sel = 0, sub = -1;    // sub >= 0 → selection is in the right pane

  const subRows = d => (d && d.kind === 'cat') ? [...(d.extra ? [d.extra] : []), ...d.items] : [];

  const paint = () => {
    const d = shown[sel];
    if (d) d._sub = sub;                    // the preview draws the open card's notes
    prev.innerHTML = travelPreview(d);
    list.querySelectorAll('.ta-item').forEach((b, i) => b.classList.toggle('on', i === sel && sub < 0));
    list.querySelector('.ta-item.on')?.scrollIntoView({ block: 'nearest' });

    const rows = subRows(d);
    prev.querySelectorAll('.tp-card').forEach((c, i) => {
      c.addEventListener('mouseenter', () => { sub = i; paint(); });
      c.addEventListener('click', () => { closeTravelAgent(); travelGo(rows[i]); });
    });
    // Jump straight to a specific note in another room.
    prev.querySelectorAll('.tp-note').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      closeTravelAgent();
      window.location.href = `room.html?id=${b.dataset.room}&note=${b.dataset.note}`;
    }));
    if (sub >= 0) prev.querySelector('.tp-card.on')?.scrollIntoView({ block: 'nearest' });

    // A highlighted room loads its notes, then repaints once they're in.
    const cur = rows[sub];
    if (cur && cur.kind === 'room' && !TRAVEL_ROOM_NOTES.has(cur.id)) {
      travelRoomNotes(cur.id, () => {
        if (document.getElementById('travelAgent') && shown[sel] === d && sub >= 0) paint();
      });
    }
  };

  const render = q => {
    const n = searchNormalize(q.trim());
    if (!n) {
      const recent = TRAVEL_RECENT
        .map(r => all.find(d => d.id === r.id && d.kind === r.kind))
        .filter(Boolean).map(d => ({ ...d, group: 'Nedávno' }));
      const browse = travelBrowse(all).filter(d =>
        !recent.some(r => r.id === d.id && r.kind === d.kind));
      shown = [...recent, ...browse];
    } else {
      shown = all.filter(d => searchNormalize(d.title + ' ' + d.sub + ' ' + d.group).includes(n)).slice(0, 60);
    }
    sel = 0; sub = -1;

    let html = '', lastGroup = null;
    shown.forEach((d, i) => {
      if (d.group !== lastGroup) { html += `<div class="ta-group">${esc(d.group)}</div>`; lastGroup = d.group; }
      html += `<button class="ta-item" data-i="${i}">
          <span class="ta-kind" style="--c:${esc(d.color || '#94a3b8')}">${d.icon}</span>
          <span class="ta-txt"><b>${esc(d.title)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ''}</span>
          ${d.kind === 'cat' ? '<span class="ta-more">›</span>' : ''}
        </button>`;
    });
    list.innerHTML = html || '<div class="ta-empty">Nic takového tu není.</div>';
    list.querySelectorAll('.ta-item').forEach(b => {
      b.addEventListener('mouseenter', () => { sel = +b.dataset.i; sub = -1; paint(); });
      b.addEventListener('click', () => {
        const d = shown[+b.dataset.i];
        if (d.kind === 'cat') { sel = +b.dataset.i; sub = 0; paint(); return; }
        closeTravelAgent(); travelGo(d);
      });
    });
    paint();
  };

  const move = step => {
    if (sub >= 0) {
      const rows = subRows(shown[sel]);
      if (!rows.length) return;
      sub = (sub + step + rows.length) % rows.length;
    } else {
      if (!shown.length) return;
      sel = (sel + step + shown.length) % shown.length;
    }
    paint();
  };

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => {
    const d = shown[sel];
    if (e.key === 'ArrowDown')      { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight' && d?.kind === 'cat' && sub < 0 && subRows(d).length) {
      e.preventDefault(); sub = 0; paint();
    }
    else if (e.key === 'ArrowLeft' && sub >= 0) { e.preventDefault(); sub = -1; paint(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (sub >= 0) { const t = subRows(d)[sub]; if (t) { closeTravelAgent(); travelGo(t); } return; }
      if (d?.kind === 'cat') { if (subRows(d).length) { sub = 0; paint(); } return; }
      if (d) { closeTravelAgent(); travelGo(d); }
    }
    else if (e.key === 'Escape') {
      e.preventDefault();
      if (sub >= 0) { sub = -1; paint(); return; }   // step out of the pane first
      closeTravelAgent();
    }
  });

  render('');

  // Rooms and decks arrive a moment later — merge them in without disturbing
  // whatever the user has already typed.
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
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
    <button class="context-menu-item" data-act="travel">🧭 Travel agent <span style="opacity:.55;font-size:.72rem;margin-left:6px;">Ctrl+K</span></button>
    <div class="context-menu-sep"></div>
    <button class="context-menu-item" data-act="note">➕ Přidat poznámku</button>
    <button class="context-menu-item" data-act="board">🖊️ Přidat tabuli</button>`;
  document.body.appendChild(menu);
  menu.style.left = clientX + 'px'; menu.style.top = clientY + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth)  menu.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (clientY - r.height) + 'px';

  menu.querySelector('[data-act="travel"]').addEventListener('click', () => { closeBoardMenu(); openTravelAgent(); });
  menu.querySelector('[data-act="note"]').addEventListener('click', () => { closeBoardMenu(); PENDING_ADD_POS = { x: sx, y: sy }; openAddNote(); });
  menu.querySelector('[data-act="board"]').addEventListener('click', () => { closeBoardMenu(); createWhiteboard(sx, sy); });
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

function drawMinimapNow() {
  const mm = document.getElementById('boardMinimap');
  if (!mm || VIEW_MODE !== 'board') return;
  const wrap = document.getElementById('boardWrap');
  const board = document.getElementById('board');
  const bw = parseInt(board.style.width)  || board.offsetWidth  || 3200;
  const bh = parseInt(board.style.height) || board.offsetHeight || 2200;
  const s = Math.min(mm.width / bw, mm.height / bh);
  const ctx = mm.getContext('2d');
  ctx.clearRect(0, 0, mm.width, mm.height);
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.fillRect(0, 0, bw * s, bh * s);

  // Whiteboards (muted slabs)
  ctx.fillStyle = 'rgba(226,232,240,0.35)';
  WHITEBOARDS_MAP.forEach(wb => {
    ctx.fillRect(toRenderX(wb.x) * s, toRenderY(wb.y) * s, Math.max(2, wb.w * s), Math.max(2, wb.h * s));
  });

  // Notes (their colors)
  NOTES_MAP.forEach(n => {
    ctx.fillStyle = n.color || '#fef9c3';
    ctx.fillRect(toRenderX(n.x) * s, toRenderY(n.y) * s, Math.max(3, 220 * s), Math.max(2, 150 * s));
  });

  // Viewport box (scroll offsets are in zoomed px → back to rendered coords)
  const z = BOARD_ZOOM;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(wrap.scrollLeft / z * s, wrap.scrollTop / z * s,
                 wrap.clientWidth / z * s, wrap.clientHeight / z * s);
}

function setupBoardMinimap() {
  const mm = document.getElementById('boardMinimap');
  const wrap = document.getElementById('boardWrap');
  if (!mm) return;
  wrap.addEventListener('scroll', updateMinimap, { passive: true });

  // Click / drag → center the viewport on that spot
  const jump = e => {
    const board = document.getElementById('board');
    const bw = parseInt(board.style.width)  || board.offsetWidth  || 3200;
    const bh = parseInt(board.style.height) || board.offsetHeight || 2200;
    const s = Math.min(mm.width / bw, mm.height / bh);
    const r = mm.getBoundingClientRect();
    const rx = (e.clientX - r.left) / s;   // rendered board coords
    const ry = (e.clientY - r.top) / s;
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
    if (n && canEdit(n)) { await doDeleteNote(id, false, true); ok++; }
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
  updateMinimap();
}
function setupBoardZoom() {
  const wrap = document.getElementById('boardWrap');
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    setBoardZoom(BOARD_ZOOM * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX, e.clientY);
  }, { passive: false });
}

// ── AI Flash Cards from notes ───────────────────────────────────

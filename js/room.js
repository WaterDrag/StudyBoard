let ME        = null;
let ROOM      = null;
let MY_ROLE   = null;
let ROOM_ID   = null;
let EDIT_ID   = null;

// Connection state
let CONNECT_MODE  = false;
let CONNECT_FROM  = null;
let CONNECT_COLOR = '#c0392b';
const CONNS_MAP   = new Map(); // connId → conn data

// ── Auth guard ────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  ME = user;

  ROOM_ID = new URLSearchParams(window.location.search).get('id');
  if (!ROOM_ID) { window.location.href = 'dashboard.html'; return; }

  try {
    const doc = await db.collection('rooms').doc(ROOM_ID).get();
    if (!doc.exists) throw new Error('Místnost neexistuje.');

    ROOM    = { id: doc.id, ...doc.data() };
    MY_ROLE = (ROOM.roles || {})[ME.uid];

    if (!MY_ROLE) {
      toast('Nemáš přístup k této místnosti.');
      setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
      return;
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
    setupAdd();
    setupEdit();
    setupShare();
    setupFlashCards();
    setupMembers();
    setupConnections();
    setupLightbox();
    setupModalClose();
    updateMemberCount();

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
        if (ch.type === 'added')    renderNote(ch.doc.id, ch.doc.data());
        if (ch.type === 'modified') patchNote(ch.doc.id, ch.doc.data());
        if (ch.type === 'removed')  document.getElementById('n-' + ch.doc.id)?.remove();
      });
    });
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
  el.style.left       = (note.x || 60) + 'px';
  el.style.top        = (note.y || 60) + 'px';
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

  setNoteContent(el.querySelector('.note-content'), note);
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
    el.style.left = (note.x || 60) + 'px';
    el.style.top  = (note.y || 60) + 'px';
    expandBoardIfNeeded(el);
  }
  el.style.background = note.color || '#fef9c3';
  setNoteContent(el.querySelector('.note-content'), note);
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
  const board  = document.getElementById('board');
  const right  = parseInt(noteEl.style.left) + noteEl.offsetWidth  + 400;
  const bottom = parseInt(noteEl.style.top)  + noteEl.offsetHeight + 400;
  if (right  > board.offsetWidth)  board.style.width  = right  + 'px';
  if (bottom > board.offsetHeight) board.style.height = bottom + 'px';
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

      const x = parseInt(el.style.left);
      const y = parseInt(el.style.top);
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

  // Table insert button
  const tableBtn = toolbar.querySelector('.rt-table-btn');
  if (tableBtn) {
    tableBtn.addEventListener('mousedown', e => e.preventDefault());
    tableBtn.addEventListener('click', () => {
      const rows = parseInt(prompt('Počet řádků:', '3') || '0');
      const cols = parseInt(prompt('Počet sloupců:', '3') || '0');
      if (!rows || !cols || rows < 1 || cols < 1) return;
      let html = '<table class="note-table" style="border-collapse:collapse;width:100%;margin:6px 0;">';
      for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
          const tag = r === 0 ? 'th' : 'td';
          html += `<${tag} contenteditable="true" style="border:1px solid #555;padding:5px 8px;min-width:60px;">${r===0 ? 'Záhlaví '+(c+1) : ''}</${tag}>`;
        }
        html += '</tr>';
      }
      html += '</table><br>';
      restoreRange();
      document.execCommand('insertHTML', false, html);
      editor.focus();
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
    openModal('addModal');
    setTimeout(() => editor.focus(), 80);
  });

  document.querySelectorAll('#noteColorPicker .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#noteColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      color = sw.dataset.color;
    });
  });

  setupRichToolbar('noteEditor', 'addToolbar', 'addTextColor', 'addColorA');

  document.getElementById('addSubmit').addEventListener('click', async () => {
    const content = editor.innerHTML;
    if (!editor.textContent.trim()) { toast('Poznámka nesmí být prázdná.'); return; }

    const btn = document.getElementById('addSubmit');
    btn.disabled = true;

    try {
      const wrap = document.getElementById('boardWrap');
      const x    = Math.round(wrap.scrollLeft + 60  + Math.random() * 240);
      const y    = Math.round(wrap.scrollTop  + 60  + Math.random() * 160);

      await db.collection('rooms').doc(ROOM_ID).collection('notes').add({
        content,
        contentType: 'html',
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
  document.querySelectorAll('#editColorPicker .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#editColorPicker .color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  setupRichToolbar('noteEditorEdit', 'editToolbar', 'editTextColor', 'editColorA');

  document.getElementById('editSubmit').addEventListener('click', async () => {
    if (!EDIT_ID) return;
    const editor  = document.getElementById('noteEditorEdit');
    const content = editor.innerHTML;
    const colorSw = document.querySelector('#editColorPicker .color-swatch.selected');
    const color   = colorSw ? colorSw.dataset.color : '#fef9c3';
    if (!editor.textContent.trim()) { toast('Poznámka nesmí být prázdná.'); return; }

    const btn = document.getElementById('editSubmit');
    btn.disabled = true;

    try {
      await db.collection('rooms').doc(ROOM_ID).collection('notes').doc(EDIT_ID).update({
        content,
        contentType: 'html',
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
  const editor = document.getElementById('noteEditorEdit');
  if (note.contentType === 'html') {
    editor.innerHTML = note.content || '';
  } else {
    editor.textContent = note.content || '';
  }

  document.querySelectorAll('#editColorPicker .color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.dataset.color === note.color);
  });
  if (!document.querySelector('#editColorPicker .color-swatch.selected')) {
    document.querySelector('#editColorPicker .color-swatch').classList.add('selected');
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && CONNECT_MODE) exitConnectMode(); });

  db.collection('rooms').doc(ROOM_ID).collection('connections')
    .onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added' || ch.type === 'modified') CONNS_MAP.set(ch.doc.id, { id: ch.doc.id, ...ch.doc.data() });
        if (ch.type === 'removed') CONNS_MAP.delete(ch.doc.id);
      });
      redrawConnections();
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
      fromId: CONNECT_FROM, toId: noteId, color: CONNECT_COLOR,
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
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2 + Math.min(dist * 0.15 + 18, 95);

      // Delete button
      const dg = document.createElementNS(ns, 'g');
      dg.setAttribute('class', 'conn-del');
      dg.setAttribute('transform', `translate(${mx},${my})`);
      const bg = document.createElementNS(ns, 'circle');
      bg.setAttribute('r', '10'); bg.setAttribute('class', 'conn-del-bg');
      const tx = document.createElementNS(ns, 'text');
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('dominant-baseline', 'central');
      tx.setAttribute('class', 'conn-del-x');
      tx.textContent = '×';
      dg.appendChild(bg); dg.appendChild(tx);
      dg.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Smazat propojení?')) return;
        try { await db.collection('rooms').doc(ROOM_ID).collection('connections').doc(connId).delete(); }
        catch (err) { toast('Chyba: ' + err.message); }
      });
      g.appendChild(dg);

      // Color picker button (palette icon, offset from delete)
      const pg = document.createElementNS(ns, 'g');
      pg.setAttribute('class', 'conn-color');
      pg.setAttribute('transform', `translate(${mx + 22},${my})`);
      const pbg = document.createElementNS(ns, 'circle');
      pbg.setAttribute('r', '10'); pbg.setAttribute('class', 'conn-del-bg');
      const ptx = document.createElementNS(ns, 'text');
      ptx.setAttribute('text-anchor', 'middle');
      ptx.setAttribute('dominant-baseline', 'central');
      ptx.setAttribute('class', 'conn-del-x');
      ptx.textContent = '🎨';
      ptx.setAttribute('font-size', '10');
      pg.appendChild(pbg); pg.appendChild(ptx);
      pg.addEventListener('click', e => {
        e.stopPropagation();
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = conn.color || '#c0392b';
        inp.style.position = 'fixed';
        inp.style.opacity  = '0';
        inp.style.pointerEvents = 'none';
        document.body.appendChild(inp);
        inp.click();
        inp.addEventListener('change', async () => {
          try { await db.collection('rooms').doc(ROOM_ID).collection('connections').doc(connId).update({ color: inp.value }); }
          catch (err) { toast('Chyba: ' + err.message); }
          inp.remove();
        });
        inp.addEventListener('blur', () => setTimeout(() => inp.remove(), 300));
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

// ── Share ─────────────────────────────────────────────────────
function setupShare() {
  document.getElementById('shareBtn').addEventListener('click', () => {
    document.getElementById('inviteCode').textContent = ROOM.inviteCode || '------';
    openModal('shareModal');
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(ROOM.inviteCode || '').then(() => toast('Kód zkopírován!'));
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

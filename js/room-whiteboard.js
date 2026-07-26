// ═══ room-whiteboard.js — Tabule: kreslení, tvary, kýbl, text, obrázky, resize
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

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
    updateMinimap();
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
        <button class="wb-btn wb-imgbtn" title="Vložit obrázek">🖼️</button>
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
  renderWhiteboardImages(el, wb);
  expandBoardIfNeeded(el);
}

// Reconcile the image layer (wb.images) — pictures sit BEHIND the strokes
// (canvas has z-index above them), so you can draw over an image. Their
// move/resize/delete grips float above the canvas and only show in drawing
// mode on hover.
function renderWhiteboardImages(el, wb) {
  const images = wb.images || [];
  const ids = new Set(images.map(i => i.id));
  const editable = canDrawWb();
  el.querySelectorAll('.wb-img').forEach(node => { if (!ids.has(node.dataset.iid)) node.remove(); });
  images.forEach(im => {
    let node = el.querySelector(`.wb-img[data-iid="${im.id}"]`);
    if (!node) {
      node = document.createElement('div');
      node.className = 'wb-img'; node.dataset.iid = im.id;
      node.innerHTML = `<img src="${esc(im.url)}" alt="" draggable="false">` +
        (editable ? `<div class="wb-img-move" title="Přesunout">✥</div><div class="wb-img-rz" title="Změnit velikost"></div><button class="wb-img-del" title="Odstranit obrázek">✕</button>` : '');
      el.appendChild(node);
      if (editable) wireWbImage(el, node, wb.id);
    }
    node.style.left = im.x + 'px'; node.style.top = im.y + 'px';
    node.style.width = im.w + 'px'; node.style.height = im.h + 'px';
  });
}

async function saveWbImages(wbId, images) {
  try { await wbCol().doc(wbId).update({ images }); } catch (e) { toast('Chyba: ' + e.message); }
}

function wireWbImage(el, node, wbId) {
  const iid = node.dataset.iid;
  const getI = () => (WHITEBOARDS_MAP.get(wbId).images || []).find(i => i.id === iid);
  const writeI = patch => saveWbImages(wbId, (WHITEBOARDS_MAP.get(wbId).images || []).map(i => i.id === iid ? { ...i, ...patch } : i));

  node.querySelector('.wb-img-del').addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('Odstranit obrázek z tabule?')) return;
    await saveWbImages(wbId, (WHITEBOARDS_MAP.get(wbId).images || []).filter(i => i.id !== iid));
  });

  node.querySelector('.wb-img-move').addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault();
    const i0 = getI(); if (!i0) return;
    const sx = e.clientX, sy = e.clientY; let nx = i0.x, ny = i0.y;
    const mv = ev => { nx = Math.round(i0.x + (ev.clientX - sx) / BOARD_ZOOM); ny = Math.round(i0.y + (ev.clientY - sy) / BOARD_ZOOM); node.style.left = nx + 'px'; node.style.top = ny + 'px'; };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); writeI({ x: nx, y: ny }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });

  node.querySelector('.wb-img-rz').addEventListener('mousedown', e => {
    e.stopPropagation(); e.preventDefault();
    const i0 = getI(); if (!i0) return;
    const sx = e.clientX, sy = e.clientY, ratio = i0.w / Math.max(1, i0.h);
    let nw = i0.w, nh = i0.h;
    const mv = ev => {
      nw = Math.max(40, Math.round(i0.w + (ev.clientX - sx) / BOARD_ZOOM));
      nh = Math.max(30, Math.round(nw / ratio));   // keep aspect ratio
      node.style.width = nw + 'px'; node.style.height = nh + 'px';
    };
    const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); writeI({ w: nw, h: nh }); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  });
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

  // 🖼️ Insert an image: upload to imgBB, measure it, drop it below the bar
  // scaled to a sane size. It lands in wb.images (rendered behind strokes).
  el.querySelector('.wb-imgbtn').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      toast('Nahrávám obrázek…');
      try {
        const url = await uploadToImgBB(file);
        const dims = await new Promise((res, rej) => {
          const probe = new Image();
          probe.onload = () => res({ w: probe.naturalWidth || 300, h: probe.naturalHeight || 200 });
          probe.onerror = () => rej(new Error('Obrázek nejde načíst'));
          probe.src = url;
        });
        const scale = Math.min(1, 300 / dims.w);
        const img = { id: wbId(), by: ME.uid, url,
          x: 24, y: 44, w: Math.round(dims.w * scale), h: Math.round(dims.h * scale) };
        const wb = WHITEBOARDS_MAP.get(id);
        await saveWbImages(id, [...(wb.images || []), img]);
        toast('Obrázek vložen ✓');
      } catch (e) { toast('Chyba: ' + e.message); }
    });
    inp.click();
  });

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
      const imgs = wb.images || [];
      let cMaxX = bb.has ? bb.maxX : 0, cMaxY = bb.has ? bb.maxY : 0;
      let cMinX = bb.has ? bb.minX : Infinity, cMinY = bb.has ? bb.minY : Infinity;
      [...texts, ...imgs].forEach(t => {
        cMaxX = Math.max(cMaxX, t.x + t.w); cMaxY = Math.max(cMaxY, t.y + t.h);
        cMinX = Math.min(cMinX, t.x); cMinY = Math.min(cMinY, t.y);
      });
      // Ignore any content that already lies outside the tabule (e.g. an old
      // stroke drawn off the edge) — clamp the extent into [0, size] so it
      // can never force the tabule to grow.
      cMaxX = Math.min(ow, cMaxX); cMaxY = Math.min(oh, cMaxY);
      cMinX = Math.max(0, Math.min(cMinX, ow)); cMinY = Math.max(0, Math.min(cMinY, oh));
      const hasContent = bb.has || texts.length > 0 || imgs.length > 0;
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
        // Keep text boxes and images visually pinned while the N/W edge
        // shifts the origin.
        el.querySelectorAll('.wb-text').forEach(tb => {
          const t = (wb.texts || []).find(x => x.id === tb.dataset.tid);
          if (t) { tb.style.left = (t.x - shiftX) + 'px'; tb.style.top = (t.y - shiftY) + 'px'; }
        });
        el.querySelectorAll('.wb-img').forEach(ib => {
          const im = (wb.images || []).find(x => x.id === ib.dataset.iid);
          if (im) { ib.style.left = (im.x - shiftX) + 'px'; ib.style.top = (im.y - shiftY) + 'px'; }
        });
      };
      const up = async () => {
        window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
        const upd = { x: Math.round(toStoreX(newLeft)), y: Math.round(toStoreY(newTop)), w: newW, h: newH };
        if (shiftX || shiftY) {
          upd.strokes = (wb.strokes || []).map(s => ({ ...s, pts: s.pts.map((v, i) => i % 2 === 0 ? v - shiftX : v - shiftY) }));
          if ((wb.texts || []).length) upd.texts = wb.texts.map(t => ({ ...t, x: t.x - shiftX, y: t.y - shiftY }));
          if ((wb.images || []).length) upd.images = wb.images.map(im => ({ ...im, x: im.x - shiftX, y: im.y - shiftY }));
        }
        try { await wbCol().doc(id).update(upd); } catch (_) {}
      };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
  });
}

// ── Board right-click menu: add a note or a tabule at the cursor ──

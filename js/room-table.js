// ═══ room-table.js — tabulky v poznámkách jako v Excelu (jen to základní a důležité)
// Když je kurzor v buňce tabulky v editoru poznámky (.rich-editor), ukáže se nad tabulkou lišta:
// řádek nad/pod, sloupec vlevo/vpravo, smazat řádek/sloupec, sloučit/rozdělit buňky, záhlaví, barva
// a zarovnání buněk, šířka tabulky, smazat tabulku. Víc buněk se vybere tažením myší nebo Shift+klik.
// Šířka sloupce a výška řádku se mění tažením za okraj buňky. Tab = další buňka (v poslední přidá řádek).
// Všechno pracuje s mřížkou tabulky (tGrid) — sloučené buňky (colspan/rowspan) se počítají správně.
// Ukládá se obyčejné HTML (colgroup, colspan, rowspan, styly buněk); třídu výběru .tsel maže cleanEditorHtml.

(function () {
  const EDGE = 5;   // jak blízko okraje buňky začíná tažení velikosti (px)
  const editorOf = el => el?.closest?.('.rich-editor');
  const isEditing = ed => ed && ed.isContentEditable;
  const cellOf = n => (n?.nodeType === 3 ? n.parentElement : n)?.closest?.('td,th') || null;

  // ── mřížka: kde která buňka leží i se sloučením ──
  function tGrid(table) {
    const rows = [...table.rows], grid = [], pos = new Map();
    rows.forEach((tr, r) => {
      grid[r] = grid[r] || [];
      let c = 0;
      for (const cell of tr.cells) {
        while (grid[r][c]) c++;
        const cs = Math.max(1, cell.colSpan || 1), rs = Math.max(1, cell.rowSpan || 1);
        pos.set(cell, { r, c, cs, rs });
        for (let i = 0; i < rs && r + i < rows.length; i++) { grid[r + i] = grid[r + i] || []; for (let j = 0; j < cs; j++) grid[r + i][c + j] = cell; }
        c += cs;
      }
    });
    return { rows, grid, pos, nr: rows.length, nc: Math.max(0, ...grid.map(g => g.length)) };
  }
  // nová buňka se stejným vzhledem (rámeček, odsazení) jako vzorová, bez obsahu a sloučení
  function newCell(tmpl, tag) {
    const n = document.createElement(tag || (tmpl?.tagName === 'TH' ? 'th' : 'td'));
    if (tmpl) [...tmpl.attributes].forEach(a => { if (!/^(colspan|rowspan|class|id)$/i.test(a.name)) n.setAttribute(a.name, a.value); });
    else n.setAttribute('style', 'border:1px solid #555;padding:5px 8px;min-width:60px;');
    n.innerHTML = '<br>';
    return n;
  }
  const colgroup = table => table.querySelector(':scope > colgroup');
  function insertRow(table, R) {
    const { rows, grid, pos, nc } = tGrid(table);
    const tr = document.createElement('tr');
    for (let c = 0; c < nc;) {
      const above = R > 0 ? grid[R - 1]?.[c] : null, at = grid[R]?.[c];
      if (above && at && above === at) { const p = pos.get(at); if (p.c === c) at.rowSpan = p.rs + 1; c += p.cs; continue; }   // sloučená buňka přes hranici → jen ji prodloužit
      const tmpl = at || above;
      tr.appendChild(newCell(tmpl, R === 0 && tmpl?.tagName === 'TH' ? 'th' : tmpl?.tagName === 'TH' && R > 0 && above?.tagName === 'TH' && at?.tagName === 'TH' ? 'th' : 'td'));
      c++;
    }
    const ref = rows[R];
    if (ref) ref.parentNode.insertBefore(tr, ref); else rows[rows.length - 1].parentNode.appendChild(tr);
    return tr;
  }
  function insertCol(table, C) {
    const { rows, grid, pos } = tGrid(table);
    rows.forEach((tr, r) => {
      const left = C > 0 ? grid[r]?.[C - 1] : null, at = grid[r]?.[C];
      if (left && at && left === at) { const p = pos.get(at); if (p.r === r) at.colSpan = p.cs + 1; return; }
      const n = newCell(at || left);
      const next = [...tr.cells].find(x => pos.get(x).c >= C);
      tr.insertBefore(n, next || null);
    });
    const cg = colgroup(table);
    if (cg) { const col = document.createElement('col'); col.style.width = '90px'; cg.insertBefore(col, cg.children[C] || null); fixWidth(table); }
  }
  function deleteRow(table, R) {
    const { rows, grid, pos, nc } = tGrid(table);
    if (rows.length <= 1) { table.remove(); return; }
    for (let c = 0; c < nc;) {
      const cell = grid[R]?.[c]; if (!cell) { c++; continue; }
      const p = pos.get(cell);
      if (p.rs > 1) {
        cell.rowSpan = p.rs - 1;
        if (p.r === R && rows[R + 1]) { const tr2 = rows[R + 1], next = [...tr2.cells].find(x => pos.get(x).c > p.c); tr2.insertBefore(cell, next || null); }
      }
      c += p.cs;
    }
    rows[R].remove();
  }
  function deleteCol(table, C) {
    const { rows, grid, pos, nc } = tGrid(table);
    if (nc <= 1) { table.remove(); return; }
    const seen = new Set();
    rows.forEach((_, r) => { const cell = grid[r]?.[C]; if (!cell || seen.has(cell)) return; seen.add(cell); const p = pos.get(cell); if (p.cs > 1) cell.colSpan = p.cs - 1; else cell.remove(); });
    const cg = colgroup(table); if (cg?.children[C]) { cg.children[C].remove(); fixWidth(table); }
  }
  // výběr obdélníku rozšířit, aby obsahoval sloučené buňky celé
  function expandRange(g, s) {
    let { r0, c0, r1, c1 } = s, changed = true;
    while (changed) {
      changed = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const cell = g.grid[r]?.[c]; if (!cell) continue;
        const p = g.pos.get(cell);
        if (p.r < r0) { r0 = p.r; changed = true; } if (p.c < c0) { c0 = p.c; changed = true; }
        if (p.r + p.rs - 1 > r1) { r1 = p.r + p.rs - 1; changed = true; } if (p.c + p.cs - 1 > c1) { c1 = p.c + p.cs - 1; changed = true; }
      }
    }
    return { r0, c0, r1, c1 };
  }
  function cellsIn(g, s) {
    const set = new Set();
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) { const cell = g.grid[r]?.[c]; if (cell) set.add(cell); }
    return [...set];
  }
  function merge(table, s) {
    const g = tGrid(table), R = expandRange(g, s), cells = cellsIn(g, R);
    if (cells.length < 2) return null;
    const keep = g.grid[R.r0][R.c0];
    const extra = cells.filter(c => c !== keep && c.textContent.trim()).map(c => c.innerHTML);
    if (extra.length) keep.innerHTML = [keep.textContent.trim() ? keep.innerHTML : '', ...extra].filter(Boolean).join('<br>');
    cells.forEach(c => { if (c !== keep) c.remove(); });
    keep.colSpan = R.c1 - R.c0 + 1; keep.rowSpan = R.r1 - R.r0 + 1;
    if (keep.colSpan === 1) keep.removeAttribute('colspan');
    if (keep.rowSpan === 1) keep.removeAttribute('rowspan');
    return keep;
  }
  function split(table, cell) {
    const g = tGrid(table), p = g.pos.get(cell);
    if (!p || (p.cs === 1 && p.rs === 1)) return;
    for (let i = 0; i < p.rs; i++) {
      const tr = g.rows[p.r + i]; if (!tr) break;
      let ref = i === 0 ? cell.nextSibling : [...tr.cells].find(x => g.pos.get(x).c > p.c) || null;
      for (let j = 0; j < p.cs; j++) { if (i === 0 && j === 0) continue; tr.insertBefore(newCell(cell), ref); }
    }
    cell.removeAttribute('colspan'); cell.removeAttribute('rowspan');
  }
  // šířky sloupců v px (colgroup) — při prvním tažení se zafixuje, jak tabulka právě vypadá
  function ensureCols(table) {
    let cg = colgroup(table);
    const g = tGrid(table);
    if (cg && cg.children.length === g.nc) return cg;
    const widths = Array(g.nc).fill(0);
    g.grid.forEach(row => row.forEach((cell, c) => { const p = g.pos.get(cell); if (p.cs === 1 && !widths[c]) widths[c] = cell.getBoundingClientRect().width / (zoomOf(table)); }));
    const tw = table.getBoundingClientRect().width / zoomOf(table);
    const known = widths.filter(Boolean), avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : tw / Math.max(1, g.nc);
    cg?.remove();
    cg = document.createElement('colgroup');
    widths.forEach(w => { const col = document.createElement('col'); col.style.width = Math.round(w || avg) + 'px'; cg.appendChild(col); });
    table.insertBefore(cg, table.firstChild);
    fixWidth(table);
    return cg;
  }
  function fixWidth(table) {   // pevné šířky: tabulka je široká jako součet sloupců
    const cg = colgroup(table); if (!cg) return;
    const sum = [...cg.children].reduce((a, c) => a + (parseFloat(c.style.width) || 90), 0);
    table.style.tableLayout = 'fixed'; table.style.width = Math.round(sum) + 'px';
  }
  const zoomOf = el => { let z = 1, n = el; while (n) { const v = parseFloat(getComputedStyle(n).zoom); if (v && v !== 1) z *= v; n = n.parentElement; } return z; };

  // ── výběr buněk ──
  let SEL = null;   // { table, r0, c0, r1, c1 }
  function paintSel() {
    document.querySelectorAll('.tsel').forEach(c => c.classList.remove('tsel'));
    if (!SEL || !SEL.table.isConnected) { SEL = null; return; }
    const g = tGrid(SEL.table), cells = cellsIn(g, SEL);
    if (cells.length > 1) cells.forEach(c => c.classList.add('tsel'));
  }
  function selFromCells(a, b) {
    const table = a.closest('table'); if (!table || b.closest('table') !== table) return null;
    const g = tGrid(table), pa = g.pos.get(a), pb = g.pos.get(b);
    if (!pa || !pb) return null;
    const s = expandRange(g, { r0: Math.min(pa.r, pb.r), c0: Math.min(pa.c, pb.c), r1: Math.max(pa.r + pa.rs - 1, pb.r + pb.rs - 1), c1: Math.max(pa.c + pa.cs - 1, pb.c + pb.cs - 1) });
    return { table, ...s };
  }
  const selCells = () => SEL && SEL.table.isConnected ? cellsIn(tGrid(SEL.table), SEL) : [];

  // ── lišta ──
  let bar = null, CUR = null;   // CUR = buňka s kurzorem
  const I = p => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const BTNS = [
    ['rowUp', 'Vložit řádek nad', I('<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>')],
    ['rowDown', 'Vložit řádek pod', I('<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>')],
    ['colLeft', 'Vložit sloupec vlevo', I('<rect x="12" y="3" width="8" height="18" rx="1"/><path d="M3 12h6M6 9v6"/>')],
    ['colRight', 'Vložit sloupec vpravo', I('<rect x="4" y="3" width="8" height="18" rx="1"/><path d="M15 12h6M18 9v6"/>')],
    ['|'],
    ['rowDel', 'Smazat řádek', I('<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M9 12h6"/>')],
    ['colDel', 'Smazat sloupec', I('<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M12 9v6"/>')],
    ['|'],
    ['merge', 'Sloučit vybrané buňky (vyber tažením nebo Shift+klik)', I('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/>')],
    ['split', 'Rozdělit sloučenou buňku', I('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M7 12h2M15 12h2"/>')],
    ['|'],
    ['head', 'Záhlaví (první řádek tučně)', I('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18"/><path d="M3 4h18v5H3z" fill="currentColor" opacity=".35"/>')],
    ['left', 'Zarovnat vlevo', I('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>')],
    ['center', 'Zarovnat na střed', I('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>')],
    ['right', 'Zarovnat vpravo', I('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>')],
    ['color', 'Barva buňky', I('<path d="M5 15l7-11 7 11a7 7 0 0 1-14 0z"/>'), true],
    ['nocolor', 'Bez barvy', I('<path d="M5 15l7-11 7 11a7 7 0 0 1-14 0z"/><path d="M4 4l16 16"/>')],
    ['|'],
    ['fit', 'Šířka: přes celou šířku / podle sloupců', I('<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>')],
    ['del', 'Smazat celou tabulku', I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')],
  ];
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'tbl-bar';
    bar.innerHTML = BTNS.map(([k, t, ico, isColor]) => k === '|' ? '<i class="tbl-sep"></i>'
      : isColor ? `<label class="tbl-b" title="${t}">${ico}<input type="color" data-tk="color" value="#fde68a"></label>`
      : `<button type="button" class="tbl-b" data-tk="${k}" title="${t}" aria-label="${t}">${ico}</button>`).join('');
    bar.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });   // výběr v editoru zůstane
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-tk]'); if (b) run(b.dataset.tk); });
    bar.querySelector('input[type=color]').addEventListener('input', e => run('color', e.target.value));
    document.body.appendChild(bar);
    return bar;
  }
  function showBar(cell) {
    const ed = editorOf(cell), table = cell?.closest('table');
    if (!cell || !table || !isEditing(ed)) { hideBar(); return; }
    CUR = cell;
    const b = ensureBar(), r = table.getBoundingClientRect(), er = ed.getBoundingClientRect();
    b.hidden = false; b.style.left = '0px';   // změřit šířku lišty bez zalomení od minulé pozice
    const h = b.offsetHeight || 36, w = b.offsetWidth || 400;
    let top = r.top - h - 6; if (top < Math.max(8, er.top - h - 4)) top = Math.min(window.innerHeight - h - 8, r.bottom + 6);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    b.style.top = Math.round(top) + 'px'; b.style.left = Math.round(left) + 'px';
    const g = tGrid(table), p = g.pos.get(cell);
    b.querySelector('[data-tk="split"]').disabled = !p || (p.cs === 1 && p.rs === 1);
    b.querySelector('[data-tk="merge"]').disabled = selCells().length < 2;
  }
  function hideBar() { if (bar) bar.hidden = true; CUR = null; }
  function changed(ed) { ed?.dispatchEvent(new Event('input', { bubbles: true })); }
  function focusCell(cell) {
    if (!cell) return;
    const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    showBar(cell);
  }
  function run(k, val) {
    const cell = CUR && CUR.isConnected ? CUR : null; if (!cell) return;
    const table = cell.closest('table'), ed = editorOf(table);
    const g = tGrid(table), p = g.pos.get(cell);
    const targets = selCells().length > 1 ? selCells() : [cell];
    let focus = cell;
    switch (k) {
      case 'rowUp': { const tr = insertRow(table, p.r); focus = tr.cells[0] || cell; break; }
      case 'rowDown': { const tr = insertRow(table, p.r + p.rs); focus = tr.cells[0] || cell; break; }
      case 'colLeft': insertCol(table, p.c); break;
      case 'colRight': insertCol(table, p.c + p.cs); break;
      case 'rowDel': { const rr = SEL ? [SEL.r0, SEL.r1] : [p.r, p.r]; for (let r = rr[1]; r >= rr[0]; r--) if (table.isConnected) deleteRow(table, r); SEL = null; focus = table.isConnected ? table.rows[Math.min(rr[0], table.rows.length - 1)]?.cells[0] : null; break; }
      case 'colDel': { const cc = SEL ? [SEL.c0, SEL.c1] : [p.c, p.c]; for (let c = cc[1]; c >= cc[0]; c--) if (table.isConnected) deleteCol(table, c); SEL = null; focus = table.isConnected ? table.rows[0]?.cells[0] : null; break; }
      case 'merge': { if (!SEL) { toast('Nejdřív vyber víc buněk — tažením myší nebo Shift+klik.'); return; } focus = merge(table, SEL) || cell; SEL = null; break; }
      case 'split': split(table, cell); break;
      case 'head': {
        const first = table.rows[0]; if (!first) break;
        const toTh = [...first.cells].some(c => c.tagName !== 'TH');
        [...first.cells].forEach(c => { const n = document.createElement(toTh ? 'th' : 'td'); [...c.attributes].forEach(a => n.setAttribute(a.name, a.value)); n.innerHTML = c.innerHTML; c.replaceWith(n); if (c === cell) focus = n; });
        break;
      }
      case 'left': case 'center': case 'right': targets.forEach(c => { c.style.textAlign = k === 'left' ? '' : k; }); break;
      case 'color': targets.forEach(c => { c.style.backgroundColor = val; }); break;
      case 'nocolor': targets.forEach(c => { c.style.backgroundColor = ''; }); break;
      case 'fit': {
        const cg = colgroup(table);
        if (cg || table.style.tableLayout === 'fixed') { cg?.remove(); table.style.tableLayout = ''; table.style.width = '100%'; }
        else { table.style.width = table.style.width === 'auto' ? '100%' : 'auto'; }
        break;
      }
      case 'del': table.remove(); SEL = null; focus = null; break;
    }
    paintSel();
    changed(ed);
    if (focus && focus.isConnected) focusCell(focus); else hideBar();
  }

  // ── myš: tažení velikosti a výběr buněk ──
  let drag = null;
  // okraj pod myší: pravý/dolní okraj buňky, nebo levý/horní (= okraj sousední buňky) → { kind, i } index sloupce/řádku
  function edgeAt(e, cell) {
    const r = cell.getBoundingClientRect(), p = tGrid(cell.closest('table')).pos.get(cell);
    if (!p) return null;
    if (Math.abs(e.clientX - r.right) <= EDGE) return { kind: 'col', i: p.c + p.cs - 1 };
    if (p.c > 0 && Math.abs(e.clientX - r.left) <= EDGE) return { kind: 'col', i: p.c - 1 };
    if (Math.abs(e.clientY - r.bottom) <= EDGE) return { kind: 'row', i: p.r + p.rs - 1 };
    if (p.r > 0 && Math.abs(e.clientY - r.top) <= EDGE) return { kind: 'row', i: p.r - 1 };
    return null;
  }
  document.addEventListener('pointermove', e => {
    if (drag?.kind === 'col') {
      const z = drag.z, w = Math.max(30, drag.w0 + (e.clientX - drag.x0) / z);
      drag.col.style.width = Math.round(w) + 'px'; fixWidth(drag.table); return;
    }
    if (drag?.kind === 'row') { drag.tr.style.height = Math.round(Math.max(22, drag.h0 + (e.clientY - drag.y0) / drag.z)) + 'px'; return; }
    if (drag?.kind === 'sel') {
      const c = cellOf(document.elementFromPoint(e.clientX, e.clientY));
      if (c && c !== drag.last && c.closest('table') === drag.table) { drag.last = c; SEL = selFromCells(drag.start, c); paintSel(); if (CUR) showBar(CUR); }
      if (SEL && selCells().length > 1) { e.preventDefault(); getSelection().removeAllRanges(); }
      return;
    }
    const cell = cellOf(e.target), ed = editorOf(cell), root = document.documentElement;
    const edge = cell && isEditing(ed) ? edgeAt(e, cell) : null;   // kurzor přes třídu na <html>, ať se neukládá do stylu buňky
    root.classList.toggle('tbl-rcol', edge?.kind === 'col'); root.classList.toggle('tbl-rrow', edge?.kind === 'row');
  });
  document.addEventListener('pointerdown', e => {
    const cell = cellOf(e.target), ed = editorOf(cell);
    if (!cell || !isEditing(ed) || e.button !== 0) { if (!e.target.closest?.('.tbl-bar')) { SEL = null; paintSel(); } return; }
    const table = cell.closest('table'), edge = edgeAt(e, cell);
    if (edge?.kind === 'col') {
      e.preventDefault();
      const cg = ensureCols(table), ci = edge.i;
      drag = { kind: 'col', table, col: cg.children[ci], w0: parseFloat(cg.children[ci].style.width) || 90, x0: e.clientX, z: zoomOf(table), ed };
      return;
    }
    if (edge?.kind === 'row') {
      e.preventDefault();
      const tr = table.rows[edge.i];
      drag = { kind: 'row', tr, h0: tr.getBoundingClientRect().height / zoomOf(table), y0: e.clientY, z: zoomOf(table), ed };
      return;
    }
    if (e.shiftKey && CUR && CUR.closest('table') === table) { e.preventDefault(); SEL = selFromCells(CUR, cell); paintSel(); showBar(CUR); return; }
    SEL = null; paintSel();
    drag = { kind: 'sel', table, start: cell, last: cell, ed };
  });
  document.addEventListener('pointerup', () => {
    if (drag && (drag.kind === 'col' || drag.kind === 'row')) changed(drag.ed);
    drag = null;
    if (CUR) showBar(CUR);
  });
  document.addEventListener('selectionchange', () => {
    const s = getSelection(); if (!s || !s.rangeCount) return;
    const cell = cellOf(s.anchorNode);
    if (cell && isEditing(editorOf(cell))) showBar(cell);
    else if (!drag && !document.activeElement?.closest?.('.tbl-bar')) hideBar();
  });
  window.addEventListener('scroll', () => { if (CUR) showBar(CUR); }, true);
  window.addEventListener('resize', () => { if (CUR) showBar(CUR); });

  // ── Tab: další buňka, v poslední přidat řádek ──
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
    const s = getSelection(), cell = cellOf(s?.anchorNode), ed = editorOf(cell);
    if (!cell || !isEditing(ed)) return;
    e.preventDefault(); e.stopImmediatePropagation();   // editor by jinak vložil mezery
    const table = cell.closest('table'), all = [...table.querySelectorAll('td,th')].filter(c => c.closest('table') === table);
    const i = all.indexOf(cell);
    let next = all[i + (e.shiftKey ? -1 : 1)];
    if (!next && !e.shiftKey) { const g = tGrid(table), p = g.pos.get(cell); const tr = insertRow(table, p.r + p.rs); next = tr.cells[0]; changed(ed); }
    if (next) { SEL = null; paintSel(); focusCell(next); }
  }, true);

  window.TBL = { tGrid, insertRow, insertCol, deleteRow, deleteCol, merge, split };   // pro ladění
})();

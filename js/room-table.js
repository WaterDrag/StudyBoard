// ═══ room-table.js — tabulky v poznámkách jako v Excelu (jen to základní a důležité)
// Pravé tlačítko na buňce (na telefonu dlouhé podržení) otevře nabídku: řádky, sloupce, sloučení, záhlaví, barvy
// a formátování. Víc buněk se vybere tažením, Shift+klikem (obdélník) nebo Ctrl+klikem (i nesousedící); formátuje se
// pak všechno najednou, i tlačítky z lišty editoru. Šířka sloupce a výška řádku se mění tažením za okraj buňky.
// Tab = další buňka (v poslední přidá řádek). Všechny změny jdou vrátit přes Ctrl+Z.
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
  // Obdélník { table, r0, c0, r1, c1 } (tažení, Shift+klik), nebo libovolné buňky { table, set } (Ctrl+klik)
  let SEL = null, ANCHOR = null;   // ANCHOR = buňka, kde se naposledy klikalo (odtud jde Shift+klik)
  const selCells = () => {
    if (!SEL || !SEL.table.isConnected) return [];
    return SEL.set ? [...SEL.set].filter(c => c.isConnected) : cellsIn(tGrid(SEL.table), SEL);
  };
  function paintSel() {
    document.querySelectorAll('.tsel').forEach(c => c.classList.remove('tsel'));
    if (!SEL || !SEL.table.isConnected) { SEL = null; return; }
    const cells = selCells();
    if (SEL.set || cells.length > 1) cells.forEach(c => c.classList.add('tsel'));
  }
  function selFromCells(a, b) {
    const table = a.closest('table'); if (!table || b.closest('table') !== table) return null;
    const g = tGrid(table), pa = g.pos.get(a), pb = g.pos.get(b);
    if (!pa || !pb) return null;
    const s = expandRange(g, { r0: Math.min(pa.r, pb.r), c0: Math.min(pa.c, pb.c), r1: Math.max(pa.r + pa.rs - 1, pb.r + pb.rs - 1), c1: Math.max(pa.c + pa.cs - 1, pb.c + pb.cs - 1) });
    return { table, ...s };
  }
  // Ctrl+klik přidá nebo ubere jednu buňku (nemusí sousedit)
  function togglePick(table, cell) {
    const set = new Set(SEL?.table === table ? selCells() : ANCHOR && ANCHOR.isConnected && ANCHOR.closest('table') === table ? [ANCHOR] : []);
    if (set.has(cell)) set.delete(cell); else set.add(cell);
    SEL = set.size ? { table, set } : null;
  }
  // Sloučit jde jen obdélník: vybrané buňky musí přesně vyplnit obdélník kolem sebe
  function selAsRect() {
    if (!SEL) return null;
    if (!SEL.set) return SEL;
    const g = tGrid(SEL.table), ps = selCells().map(c => g.pos.get(c)).filter(Boolean);
    if (!ps.length) return null;
    const r = expandRange(g, { r0: Math.min(...ps.map(p => p.r)), c0: Math.min(...ps.map(p => p.c)), r1: Math.max(...ps.map(p => p.r + p.rs - 1)), c1: Math.max(...ps.map(p => p.c + p.cs - 1)) });
    return cellsIn(g, r).length === ps.length ? r : null;
  }

  // ── změny tak, aby na ně fungovalo Ctrl+Z ──
  // Prohlížeč si do historie editoru zapisuje jen změny přes execCommand; úpravy přímo v DOM by Ctrl+Z neviděl
  // a navíc by mu rozbily historii psaní. Změna se proto provede na živé tabulce, pak se vrátí původní stav
  // a výsledek se vloží přes insertHTML — jeden krok v historii, který Ctrl+Z i Ctrl+Y normálně vrátí.
  const htmlOf = t => { const c = t.cloneNode(true); c.classList.remove('tsel'); c.querySelectorAll('.tsel').forEach(x => { x.classList.remove('tsel'); if (!x.className) x.removeAttribute('class'); }); return c.outerHTML; };
  const coordsOf = cells => cells.map(c => [c.parentElement.rowIndex, c.cellIndex]);
  const cellAt = (t, [r, c]) => t?.rows[r]?.cells[c] || null;
  function snapshot(table) { const ed = editorOf(table); return { ed, html: htmlOf(table), idx: [...ed.querySelectorAll('table')].indexOf(table), parent: table.parentNode, next: table.nextSibling }; }
  // vrátí novou tabulku (DOM se vyměnil), nebo null, když je tabulka pryč
  function commit(snap, live) {
    const after = live && live.isConnected ? htmlOf(live) : '';
    if (after === snap.html) return live;
    const tpl = document.createElement('template'); tpl.innerHTML = snap.html;
    const old = tpl.content.firstChild;
    if (live && live.isConnected) live.replaceWith(old); else snap.parent.insertBefore(old, snap.next && snap.next.isConnected ? snap.next : null);
    snap.ed.focus();
    const r = document.createRange(); r.selectNode(old);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand(after ? 'insertHTML' : 'delete', false, after || null);
    return after ? snap.ed.querySelectorAll('table')[snap.idx] || null : null;
  }

  // ── hromadné formátování buněk ──
  function plainCell(c) {   // formátování z vnitřních značek pryč, aby platilo to na buňce
    c.querySelectorAll('b,strong,i,em,u,s,strike,font,span').forEach(x => x.replaceWith(...x.childNodes));
  }
  const clearInner = (c, prop) => c.querySelectorAll('[style]').forEach(x => { x.style[prop] = ''; if (!x.getAttribute('style')) x.removeAttribute('style'); });
  function formatCells(cells, cmd, val) {
    const all = test => cells.every(test);
    const deco = v => { const on = all(c => getComputedStyle(c).textDecorationLine.includes(v) || !!c.querySelector(v === 'underline' ? 'u' : 's,strike')); cells.forEach(c => { c.querySelectorAll(v === 'underline' ? 'u' : 's,strike').forEach(x => x.replaceWith(...x.childNodes)); const list = new Set(c.style.textDecorationLine.split(' ').filter(Boolean)); if (on) list.delete(v); else list.add(v); c.style.textDecorationLine = [...list].join(' '); }); };
    switch (cmd) {
      case 'bold': { const on = all(c => +getComputedStyle(c).fontWeight >= 600); cells.forEach(c => { c.querySelectorAll('b,strong').forEach(x => x.replaceWith(...x.childNodes)); clearInner(c, 'fontWeight'); c.style.fontWeight = on ? 'normal' : 'bold'; }); return true; }
      case 'italic': { const on = all(c => getComputedStyle(c).fontStyle === 'italic'); cells.forEach(c => { c.querySelectorAll('i,em').forEach(x => x.replaceWith(...x.childNodes)); clearInner(c, 'fontStyle'); c.style.fontStyle = on ? 'normal' : 'italic'; }); return true; }
      case 'underline': deco('underline'); return true;
      case 'strikeThrough': deco('line-through'); return true;
      case 'foreColor': cells.forEach(c => { clearInner(c, 'color'); c.querySelectorAll('font[color]').forEach(f => f.removeAttribute('color')); c.style.color = val || ''; }); return true;
      case 'hiliteColor': cells.forEach(c => { clearInner(c, 'backgroundColor'); c.style.backgroundColor = val && val !== 'transparent' ? val : ''; }); return true;
      case 'fontSize': cells.forEach(c => { clearInner(c, 'fontSize'); c.querySelectorAll('font[size]').forEach(f => f.removeAttribute('size')); c.style.fontSize = val; }); return true;
      case 'justifyLeft': cells.forEach(c => { c.style.textAlign = 'left'; }); return true;
      case 'justifyCenter': cells.forEach(c => { c.style.textAlign = 'center'; }); return true;
      case 'justifyRight': cells.forEach(c => { c.style.textAlign = 'right'; }); return true;
      case 'justifyFull': cells.forEach(c => { c.style.textAlign = 'justify'; }); return true;
      case 'removeFormat': cells.forEach(c => { plainCell(c); ['color', 'backgroundColor', 'fontWeight', 'fontStyle', 'fontSize', 'textDecorationLine', 'textAlign'].forEach(p => { c.style[p] = ''; }); }); return true;
    }
    return false;
  }
  // Hromadná úprava z lišty editoru: true = provedeno na vybraných buňkách (execCommand se už nevolá)
  function massFormat(cmd, val) {
    const cells = selCells();
    if (!SEL || (!SEL.set && cells.length < 2) || !cells.length) return false;
    return applyFormat(SEL.table, cells, cmd, val);
  }
  function applyFormat(table, cells, cmd, val) {
    const coords = coordsOf(cells), snap = snapshot(table);
    if (!formatCells(cells, cmd, val)) return false;
    const t = commit(snap, table), keep = !!SEL;
    if (t && keep) { const set = new Set(coords.map(x => cellAt(t, x)).filter(Boolean)); SEL = { table: t, set }; paintSel(); }
    if (t && CUR && !CUR.isConnected) CUR = cellAt(t, coords[0]);
    return true;
  }

  // ── nabídka tabulky (pravé tlačítko) ──
  let bar = null, CUR = null;   // CUR = buňka, na které se nabídka otevřela
  const I = p => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const T = (ch, st = '') => `<span style="font:700 14px/1 Georgia,serif;${st}">${ch}</span>`;
  const BTNS = [
    ['rowUp', 'Vložit řádek nad', I('<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>')],
    ['rowDown', 'Vložit řádek pod', I('<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>')],
    ['colLeft', 'Vložit sloupec vlevo', I('<rect x="12" y="3" width="8" height="18" rx="1"/><path d="M3 12h6M6 9v6"/>')],
    ['colRight', 'Vložit sloupec vpravo', I('<rect x="4" y="3" width="8" height="18" rx="1"/><path d="M15 12h6M18 9v6"/>')],
    ['|'],
    ['rowDel', 'Smazat řádek', I('<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M9 12h6"/>')],
    ['colDel', 'Smazat sloupec', I('<rect x="8" y="3" width="8" height="18" rx="1"/><path d="M12 9v6"/>')],
    ['|'],
    ['merge', 'Sloučit vybrané buňky (vyber tažením, Shift+klik nebo Ctrl+klik)', I('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/>')],
    ['split', 'Rozdělit sloučenou buňku', I('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M7 12h2M15 12h2"/>')],
    ['|'],
    ['bold', 'Tučně', T('B')],
    ['italic', 'Kurzíva', T('I', 'font-style:italic;font-weight:400;')],
    ['underline', 'Podtržení', T('U', 'text-decoration:underline;font-weight:400;')],
    ['fcolor', 'Barva písma', T('A', 'border-bottom:3px solid #ef4444;padding-bottom:1px;'), '#ef4444'],
    ['color', 'Barva buňky', I('<path d="M5 15l7-11 7 11a7 7 0 0 1-14 0z"/>'), '#fde68a'],
    ['nocolor', 'Vymazat formátování', I('<path d="M5 15l7-11 7 11a7 7 0 0 1-14 0z"/><path d="M4 4l16 16"/>')],
    ['|'],
    ['left', 'Zarovnat vlevo', I('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>')],
    ['center', 'Zarovnat na střed', I('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>')],
    ['right', 'Zarovnat vpravo', I('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>')],
    ['|'],
    ['head', 'Záhlaví (první řádek tučně)', I('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18"/><path d="M3 4h18v5H3z" fill="currentColor" opacity=".35"/>')],
    ['fit', 'Šířka: přes celou šířku / podle sloupců', I('<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/>')],
    ['del', 'Smazat celou tabulku', I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>')],
  ];
  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'tbl-bar';
    bar.hidden = true;
    bar.innerHTML = BTNS.map(([k, t, ico, col]) => k === '|' ? '<i class="tbl-sep"></i>'
      : col ? `<label class="tbl-b" title="${t}">${ico}<input type="color" data-tk="${k}" value="${col}"></label>`
      : `<button type="button" class="tbl-b" data-tk="${k}" title="${t}" aria-label="${t}">${ico}</button>`).join('');
    bar.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });   // výběr v editoru zůstane
    bar.addEventListener('click', e => { const b = e.target.closest('button[data-tk]'); if (b) run(b.dataset.tk); });
    bar.querySelectorAll('input[type=color]').forEach(i => i.addEventListener('change', e => run(e.target.dataset.tk, e.target.value)));
    document.body.appendChild(bar);
    return bar;
  }
  function showBar(cell, x, y) {
    const table = cell?.closest('table');
    if (!cell || !table || !isEditing(editorOf(cell))) { hideBar(); return; }
    CUR = cell;
    const b = ensureBar();
    b.hidden = false; b.style.left = '0px';   // změřit šířku lišty bez zalomení od minulé pozice
    const h = b.offsetHeight || 36, w = b.offsetWidth || 400;
    let top = y + 8; if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 8);
    b.style.top = Math.round(top) + 'px'; b.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - w - 8, x))) + 'px';
    const p = tGrid(table).pos.get(cell);
    b.querySelector('[data-tk="split"]').disabled = !p || (p.cs === 1 && p.rs === 1);
    b.querySelector('[data-tk="merge"]').disabled = selCells().length < 2;
  }
  function hideBar() { if (bar) bar.hidden = true; CUR = null; }
  function focusCell(cell) {
    if (!cell) return;
    const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    ANCHOR = cell;
  }
  const FORMATS = { bold: 'bold', italic: 'italic', underline: 'underline', left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', nocolor: 'removeFormat' };
  function run(k, val) {
    const cell = CUR && CUR.isConnected ? CUR : null; if (!cell) return;
    const table = cell.closest('table');
    const picked = selCells(), targets = picked.includes(cell) && picked.length ? picked : [cell];
    // formátování: nabídka zůstane otevřená, dá se pokračovat další úpravou
    if (FORMATS[k] || k === 'fcolor' || k === 'color') {
      const cmd = FORMATS[k] || (k === 'fcolor' ? 'foreColor' : 'hiliteColor');
      applyFormat(table, targets, cmd, val);
      return;
    }
    if (k === 'merge' && !selAsRect()) { toast(SEL ? 'Sloučit jde jen souvislý obdélník buněk.' : 'Nejdřív vyber víc buněk — tažením myší, Shift+klik nebo Ctrl+klik.'); return; }
    const g = tGrid(table), p = g.pos.get(cell), snap = snapshot(table);
    const ps = targets.map(c => g.pos.get(c)).filter(Boolean);
    let focus = [p.r, 0];
    switch (k) {
      case 'rowUp': insertRow(table, p.r); break;
      case 'rowDown': insertRow(table, p.r + p.rs); focus = [p.r + p.rs, 0]; break;
      case 'colLeft': insertCol(table, p.c); break;
      case 'colRight': insertCol(table, p.c + p.cs); break;
      case 'rowDel': {
        const rows = [...new Set(ps.flatMap(q => Array.from({ length: q.rs }, (_, i) => q.r + i)))].sort((a, b) => b - a);
        rows.forEach(r => { if (table.isConnected) deleteRow(table, r); });
        focus = [Math.max(0, Math.min(...rows) - 1), 0];
        break;
      }
      case 'colDel': {
        const cols = [...new Set(ps.flatMap(q => Array.from({ length: q.cs }, (_, i) => q.c + i)))].sort((a, b) => b - a);
        cols.forEach(c => { if (table.isConnected) deleteCol(table, c); });
        break;
      }
      case 'merge': { const c = merge(table, selAsRect()); if (c) focus = [c.parentElement.rowIndex, c.cellIndex]; break; }
      case 'split': split(table, cell); focus = [p.r, 0]; break;
      case 'head': {
        const first = table.rows[0]; if (!first) break;
        const toTh = [...first.cells].some(c => c.tagName !== 'TH');
        [...first.cells].forEach(c => { const n = document.createElement(toTh ? 'th' : 'td'); [...c.attributes].forEach(a => n.setAttribute(a.name, a.value)); n.innerHTML = c.innerHTML; c.replaceWith(n); });
        break;
      }
      case 'fit': {
        const cg = colgroup(table);
        if (cg || table.style.tableLayout === 'fixed') { cg?.remove(); table.style.tableLayout = ''; table.style.width = '100%'; }
        else { table.style.width = table.style.width === 'auto' ? '100%' : 'auto'; }
        break;
      }
      case 'del': table.remove(); break;
    }
    SEL = null; paintSel();
    const t = commit(snap, table.isConnected ? table : null);
    hideBar();
    if (t) focusCell(cellAt(t, focus) || t.rows[0]?.cells[0]);
  }

  // ── myš: tažení velikosti a výběr buněk ──
  let drag = null, longPress = 0;
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
    if (longPress && Math.hypot(e.clientX - longPress.x, e.clientY - longPress.y) > 10) { clearTimeout(longPress.t); longPress = 0; }
    if (drag?.kind === 'col') {
      const z = drag.z, w = Math.max(30, drag.w0 + (e.clientX - drag.x0) / z);
      drag.col.style.width = Math.round(w) + 'px'; fixWidth(drag.table); return;
    }
    if (drag?.kind === 'row') { drag.tr.style.height = Math.round(Math.max(22, drag.h0 + (e.clientY - drag.y0) / drag.z)) + 'px'; return; }
    if (drag?.kind === 'sel') {
      const c = cellOf(document.elementFromPoint(e.clientX, e.clientY));
      if (c && c !== drag.last && c.closest('table') === drag.table) { drag.last = c; SEL = selFromCells(drag.start, c); paintSel(); }
      if (SEL && selCells().length > 1) { e.preventDefault(); getSelection().removeAllRanges(); }
      return;
    }
    const cell = cellOf(e.target), ed = editorOf(cell), root = document.documentElement;
    const edge = cell && isEditing(ed) ? edgeAt(e, cell) : null;   // kurzor přes třídu na <html>, ať se neukládá do stylu buňky
    root.classList.toggle('tbl-rcol', edge?.kind === 'col'); root.classList.toggle('tbl-rrow', edge?.kind === 'row');
  });
  // Výběr buněk přežije klik do nabídky i do lišty editoru a jejích palet (tam se hromadně formátuje)
  const KEEP_SEL = '.tbl-bar, .rich-toolbar, .rt-cmenu';
  document.addEventListener('pointerdown', e => {
    const cell = cellOf(e.target), ed = editorOf(cell);
    if (!e.target.closest?.('.tbl-bar')) hideBar();
    if (!cell || !isEditing(ed)) { if (!e.target.closest?.(KEEP_SEL)) { SEL = null; paintSel(); } return; }
    if (e.button === 2) return;   // pravé tlačítko řeší contextmenu
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') {   // iPhone contextmenu nezná: dlouhé podržení otevře nabídku
      const x = e.clientX, y = e.clientY;
      longPress = { x, y, t: setTimeout(() => { longPress = 0; drag = null; showBar(cell, x, y); }, 550) };
    }
    const table = cell.closest('table'), edge = e.pointerType === 'touch' ? null : edgeAt(e, cell);
    if (edge?.kind === 'col') {
      e.preventDefault();
      const snap = snapshot(table), cg = ensureCols(table), ci = edge.i;
      drag = { kind: 'col', table, col: cg.children[ci], w0: parseFloat(cg.children[ci].style.width) || 90, x0: e.clientX, z: zoomOf(table), ed, snap };
      return;
    }
    if (edge?.kind === 'row') {
      e.preventDefault();
      const snap = snapshot(table), tr = table.rows[edge.i];
      drag = { kind: 'row', table, tr, h0: tr.getBoundingClientRect().height / zoomOf(table), y0: e.clientY, z: zoomOf(table), ed, snap };
      return;
    }
    if (e.shiftKey && ANCHOR && ANCHOR.isConnected && ANCHOR.closest('table') === table) { SEL = selFromCells(ANCHOR, cell); paintSel(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.target.closest('a')) { togglePick(table, cell); ANCHOR = cell; paintSel(); return; }
    SEL = null; paintSel();
    ANCHOR = cell;
    drag = { kind: 'sel', table, start: cell, last: cell, ed };
  });
  // Shift/Ctrl+klik nesmí přesunout kurzor ani označit text
  document.addEventListener('mousedown', e => {
    const cell = cellOf(e.target);
    if (cell && isEditing(editorOf(cell)) && e.button === 0 && (e.shiftKey || ((e.ctrlKey || e.metaKey) && !e.target.closest('a')))) e.preventDefault();
  });
  document.addEventListener('pointerup', () => {
    if (longPress) { clearTimeout(longPress.t); longPress = 0; }
    if (drag && (drag.kind === 'col' || drag.kind === 'row')) commit(drag.snap, drag.table);
    drag = null;
  });
  document.addEventListener('pointercancel', () => { if (longPress) { clearTimeout(longPress.t); longPress = 0; } drag = null; });
  document.addEventListener('contextmenu', e => {
    const cell = cellOf(e.target);
    if (!cell || !isEditing(editorOf(cell))) return;
    e.preventDefault();
    if (!selCells().includes(cell)) { SEL = null; paintSel(); }
    ANCHOR = cell;
    showBar(cell, e.clientX, e.clientY);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && bar && !bar.hidden) { e.stopPropagation(); hideBar(); } }, true);
  window.addEventListener('scroll', e => { if (bar && !bar.hidden && !bar.contains(e.target)) hideBar(); }, true);
  window.addEventListener('resize', hideBar);

  // ── Tab: další buňka, v poslední přidat řádek ──
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
    const s = getSelection(), cell = cellOf(s?.anchorNode), ed = editorOf(cell);
    if (!cell || !isEditing(ed)) return;
    e.preventDefault(); e.stopImmediatePropagation();   // editor by jinak vložil mezery
    const table = cell.closest('table'), all = [...table.querySelectorAll('td,th')].filter(c => c.closest('table') === table);
    const i = all.indexOf(cell);
    let next = all[i + (e.shiftKey ? -1 : 1)];
    if (!next && !e.shiftKey) {
      const p = tGrid(table).pos.get(cell), snap = snapshot(table);
      insertRow(table, p.r + p.rs);
      const t = commit(snap, table);
      next = t?.rows[p.r + p.rs]?.cells[0];
    }
    if (next) { SEL = null; paintSel(); focusCell(next); }
  }, true);

  window.TBL = { tGrid, insertRow, insertCol, deleteRow, deleteCol, merge, split, massFormat };
})();

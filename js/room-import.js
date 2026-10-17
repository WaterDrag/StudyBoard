// ═══ room-import.js — Import Wordu / PDF / textu do poznámek
// Soubor se rozdělí podle nadpisů (PDF podle stránek) na samostatné
// poznámky, ty se položí do mřížky pod nadpis s názvem souboru a dají se do
// složky. Knihovny (mammoth pro .docx, pdf.js pro PDF) se stahují až ve
// chvíli, kdy je někdo opravdu použije.

const IMPORT_LIBS = {
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
  pdf:     'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  jszip:   'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
};
const IMPORT_MAX_CHARS = 90000;   // jedna poznámka (Firestore dokument má strop 1 MB)
const IMPORT_MAX_NOTES = 80;
let IMPORT = null;                // { name, kind, sections:[{title, html}] }

function importLoadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Knihovnu se nepodařilo načíst'));
    document.head.appendChild(s);
  });
}

function setupImport() {
  const canWrite = MY_ROLE !== 'viewer' && !(ME.isAnonymous && MY_ROLE !== 'owner');
  const btn = document.getElementById('importBtn');
  if (!canWrite) { if (btn) btn.style.display = 'none'; return; }
  btn?.addEventListener('click', () => openImportModal());
  // přetáhnout soubor na nástěnku nebo do seznamu
  ['boardWrap', 'notesListView'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', e => {
      if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); el.classList.add('import-drop'); }
    });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('import-drop'); });
    el.addEventListener('drop', e => {
      el.classList.remove('import-drop');
      const f = [...(e.dataTransfer?.files || [])].find(x => /\.(docx|pptx|pdf|txt|md)$/i.test(x.name));
      if (!f) return;
      e.preventDefault();
      openImportModal(f);
    });
  });
}

function openImportModal(file) {
  document.getElementById('importModal')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'modal-overlay open';
  wrap.id = 'importModal';
  wrap.style.zIndex = '700';
  wrap.innerHTML = `
    <div class="modal modal-wide">
      <div class="modal-header"><h3>📥 Import do poznámek</h3><button class="modal-close" data-x>✕</button></div>
      <label class="import-drop-zone" id="importZone">
        <input type="file" id="importFile" accept=".docx,.pptx,.pdf,.txt,.md" hidden>
        <span class="import-ico">📄</span>
        <b>Vyber soubor nebo ho sem přetáhni</b>
        <small>Word (.docx), PowerPoint (.pptx), PDF, text (.txt, .md)</small>
      </label>
      <div id="importBody"></div>
      <div class="modal-footer"><button class="btn btn-secondary" data-x>Zrušit</button><button class="btn btn-primary" id="importGo" disabled>Importovat</button></div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); IMPORT = null; };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
  const zone = wrap.querySelector('#importZone'), input = wrap.querySelector('#importFile');
  input.addEventListener('change', () => input.files[0] && importRead(input.files[0]));
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) importRead(f); });
  wrap.querySelector('#importGo').addEventListener('click', importRun);
  if (file) importRead(file);
}

async function importRead(file) {
  const body = document.getElementById('importBody');
  body.innerHTML = '<div class="import-status">Čtu soubor…</div>';
  document.getElementById('importGo').disabled = true;
  try {
    const name = file.name.replace(/\.[^.]+$/, '');
    let kind, raw;
    if (/\.docx$/i.test(file.name)) {
      await importLoadScript(IMPORT_LIBS.mammoth);
      const res = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      kind = 'docx'; raw = res.value;
    } else if (/\.pptx$/i.test(file.name)) {
      await importLoadScript(IMPORT_LIBS.jszip);
      kind = 'pptx'; raw = await pptxSlides(await file.arrayBuffer(), name, n => { body.innerHTML = `<div class="import-status">Čtu prezentaci… slajd ${n}</div>`; });
    } else if (/\.pdf$/i.test(file.name)) {
      await importLoadScript(IMPORT_LIBS.pdf);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = IMPORT_LIBS.pdfWorker;
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 300); i++) {
        body.innerHTML = `<div class="import-status">Čtu PDF… stránka ${i} / ${pdf.numPages}</div>`;
        const tc = await (await pdf.getPage(i)).getTextContent();
        pages.push(pdfPageToHtml(tc.items));
      }
      kind = 'pdf'; raw = pages;
    } else {
      kind = /\.md$/i.test(file.name) ? 'md' : 'txt';
      raw = await file.text();
    }
    IMPORT = { name, kind, raw };
    importRenderOptions();
  } catch (e) {
    body.innerHTML = `<div class="import-status err">Soubor se nepodařilo přečíst: ${esc(e.message)}</div>`;
  }
}

// ── PowerPoint: .pptx je zip s XML. Pořadí slajdů je v presentation.xml,
// text v p:sp, obrázky v p:pic (odkaz přes .rels), tabulky v a:tbl.
async function pptxSlides(buf, name, onSlide) {
  const zip = await window.JSZip.loadAsync(buf);
  const xml = async p => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const rels = async p => {
    const d = await xml(p); const out = {};
    if (d) [...d.getElementsByTagName('Relationship')].forEach(r => { out[r.getAttribute('Id')] = { target: r.getAttribute('Target'), type: r.getAttribute('Type') || '' }; });
    return out;
  };
  const resolve = (base, target) => { const parts = (base + '/' + target).split('/'); const out = []; parts.forEach(x => { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }); return out.join('/'); };
  const pres = await xml('ppt/presentation.xml');
  const presRels = await rels('ppt/_rels/presentation.xml.rels');
  const ids = pres ? [...pres.getElementsByTagName('p:sldId')].map(x => x.getAttribute('r:id')) : [];
  const slidePaths = ids.map(id => presRels[id] && resolve('ppt', presRels[id].target)).filter(Boolean);
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };
  const out = [];
  for (let i = 0; i < slidePaths.length; i++) {
    onSlide?.(i + 1);
    const path = slidePaths[i], dir = path.replace(/\/[^/]+$/, '');
    const doc = await xml(path); if (!doc) continue;
    const srels = await rels(dir + '/_rels/' + path.split('/').pop() + '.rels');
    let title = '', html = '', pics = 0;
    const runsHtml = p => [...p.childNodes].map(n => {
      if (n.nodeName !== 'a:r' && n.nodeName !== 'a:fld') return n.nodeName === 'a:br' ? '<br>' : '';
      const t = esc([...n.getElementsByTagName('a:t')].map(x => x.textContent).join(''));
      const rpr = n.getElementsByTagName('a:rPr')[0];
      return rpr && rpr.getAttribute('b') === '1' && t.trim() ? `<b>${t}</b>` : t;
    }).join('');
    const walk = async node => {
      for (const el of [...node.childNodes]) {
        if (el.nodeName === 'p:grpSp') { await walk(el); continue; }
        if (el.nodeName === 'p:sp') {
          const ph = el.getElementsByTagName('p:ph')[0];
          const phType = ph ? (ph.getAttribute('type') || 'body') : '';
          if (['sldNum', 'dt', 'ftr'].includes(phType)) continue;
          const paras = [...el.getElementsByTagName('a:p')].map(p => ({ lvl: +(p.getElementsByTagName('a:pPr')[0]?.getAttribute('lvl') || 0), h: runsHtml(p) })).filter(p => p.h.replace(/<[^>]+>/g, '').trim());
          if (!paras.length) continue;
          if (!title && (phType === 'title' || phType === 'ctrTitle')) { title = paras.map(p => p.h.replace(/<[^>]+>/g, '')).join(' ').trim(); continue; }
          if (paras.length === 1 && phType !== 'body') html += `<p>${paras[0].h}</p>`;
          else html += '<ul>' + paras.map(p => `<li${p.lvl ? ` style="margin-left:${p.lvl * 1.4}em"` : ''}>${p.h}</li>`).join('') + '</ul>';
        } else if (el.nodeName === 'p:pic' && pics < 4) {
          const blip = el.getElementsByTagName('a:blip')[0];
          const rel = blip && srels[blip.getAttribute('r:embed')];
          if (!rel) continue;
          const mpath = resolve(dir, rel.target), ext = mpath.split('.').pop().toLowerCase();
          if (!MIME[ext] || !zip.file(mpath)) continue;          // emf/wmf apod. prohlížeč neumí
          html += `<p><img src="data:${MIME[ext]};base64,${await zip.file(mpath).async('base64')}"></p>`;
          pics++;
        } else if (el.nodeName === 'p:graphicFrame') {
          const tbl = el.getElementsByTagName('a:tbl')[0];
          if (!tbl) continue;
          html += '<table>' + [...tbl.getElementsByTagName('a:tr')].map(tr => '<tr>' + [...tr.getElementsByTagName('a:tc')].map(tc =>
            `<td>${[...tc.getElementsByTagName('a:p')].map(runsHtml).filter(Boolean).join('<br>')}</td>`).join('') + '</tr>').join('') + '</table>';
        }
      }
    };
    const tree = doc.getElementsByTagName('p:spTree')[0];
    if (tree) await walk(tree);
    // poznámky přednášejícího
    const notesRel = Object.values(srels).find(r => /notesSlide$/.test(r.type));
    if (notesRel) {
      const nd = await xml(resolve(dir, notesRel.target));
      const txt = nd ? [...nd.getElementsByTagName('p:sp')].filter(sp => (sp.getElementsByTagName('p:ph')[0]?.getAttribute('type') || '') === 'body')
        .flatMap(sp => [...sp.getElementsByTagName('a:p')].map(runsHtml)).filter(t => t.replace(/<[^>]+>/g, '').trim()) : [];
      if (txt.length) html += `<blockquote><b>Poznámky přednášejícího:</b><br>${txt.join('<br>')}</blockquote>`;
    }
    if (title || html) out.push({ title: title || `${name} — slajd ${i + 1}`, html });
  }
  return out;
}

// PDF nemá odstavce — skládají se z řádků podle svislých mezer.
function pdfPageToHtml(items) {
  const lines = [];
  let cur = null;
  items.forEach(it => {
    const y = Math.round(it.transform[5]), size = Math.abs(it.transform[0]) || 10;
    if (!cur || Math.abs(cur.y - y) > size * 0.5) { cur = { y, size, text: '' }; lines.push(cur); }
    cur.text += it.str;
    cur.size = Math.max(cur.size, size);
  });
  const body = lines.filter(l => l.text.trim());
  if (!body.length) return '';
  const sizes = body.map(l => l.size).sort((a, b) => a - b);
  const normal = sizes[Math.floor(sizes.length / 2)];
  let html = '', para = [], prevY = null;
  const flush = () => { if (para.length) { html += `<p>${esc(para.join(' ').replace(/\s+/g, ' ').trim())}</p>`; para = []; } };
  body.forEach(l => {
    const t = l.text.trim();
    if (l.size > normal * 1.25 && t.length < 120) { flush(); html += `<h2>${esc(t)}</h2>`; prevY = l.y; return; }
    if (/^([•\-–*]|\d+[.)])\s/.test(t)) { flush(); html += `<p>${esc(t)}</p>`; prevY = l.y; return; }
    if (prevY !== null && prevY - l.y > l.size * 1.8) flush();
    para.push(t); prevY = l.y;
  });
  flush();
  return html;
}

function mdToHtml(text) {
  const out = []; let list = null;
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  text.split(/\r?\n/).forEach(line => {
    const h = line.match(/^(#{1,4})\s+(.*)/), li = line.match(/^\s*[-*+]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (!li && !ol && list) { out.push(`</${list}>`); list = null; }
    if (h) out.push(`<h${Math.min(4, h[1].length + 1)}>${inline(h[2])}</h${Math.min(4, h[1].length + 1)}>`);
    else if (li || ol) { const tag = li ? 'ul' : 'ol'; if (list !== tag) { if (list) out.push(`</${list}>`); out.push(`<${tag}>`); list = tag; } out.push(`<li>${inline((li || ol)[1])}</li>`); }
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  });
  if (list) out.push(`</${list}>`);
  return out.join('');
}

// Rozdělit HTML podle nejvyšší úrovně nadpisů, která se v souboru opakuje.
function splitByHeadings(html, fallbackTitle) {
  const d = document.createElement('div'); d.innerHTML = html;
  const levels = ['H1', 'H2', 'H3'];
  const lvl = levels.find(L => d.querySelectorAll(L.toLowerCase()).length >= 2) || null;
  if (!lvl) return [{ title: fallbackTitle, html: d.innerHTML }];
  const out = []; let cur = { title: fallbackTitle, nodes: [] };
  [...d.childNodes].forEach(n => {
    if (n.nodeName === lvl) { out.push(cur); cur = { title: n.textContent.trim().slice(0, 120) || fallbackTitle, nodes: [] }; }
    else cur.nodes.push(n);
  });
  out.push(cur);
  return out.filter(s => s.nodes.some(n => (n.textContent || '').trim() || n.querySelector?.('img,table')))
    .map(s => { const w = document.createElement('div'); s.nodes.forEach(n => w.appendChild(n)); return { title: s.title, html: w.innerHTML }; });
}

function importSections(split) {
  const { name, kind, raw } = IMPORT;
  let sections;
  if (kind === 'pptx') {
    sections = split ? raw.map(s => ({ title: s.title, html: s.html || '<p></p>' }))
      : [{ title: name, html: raw.map(s => `<h2>${esc(s.title)}</h2>${s.html}`).join('') }];
  } else if (kind === 'pdf') {
    sections = split ? raw.map((h, i) => ({ title: `${name} — str. ${i + 1}`, html: h })).filter(s => s.html)
      : [{ title: name, html: raw.join('') }];
    if (split) {
      // stránka, která začíná nadpisem, dostane jeho jméno
      sections.forEach(s => { const m = s.html.match(/^<h2>(.*?)<\/h2>/); if (m) { s.title = m[1].replace(/&amp;/g, '&').slice(0, 120); s.html = s.html.slice(m[0].length); } });
    }
  } else {
    const html = kind === 'docx' ? raw : kind === 'md' ? mdToHtml(raw) : raw.split(/\r?\n\s*\r?\n/).map(p => `<p>${esc(p.trim()).replace(/\r?\n/g, '<br>')}</p>`).join('');
    const clean = cleanPastedHtml(html, false) || html;
    sections = split ? splitByHeadings(clean, name) : [{ title: name, html: clean }];
  }
  // příliš dlouhé kusy rozpůlit, ať se vejdou do jedné poznámky. Obrázky se
  // nepočítají — nahrají se zvlášť a v poznámce z nich zbude krátký odkaz.
  const size = h => h.replace(/data:[^"']+/g, '').length;
  const out = [];
  sections.forEach(s => {
    if (size(s.html) <= IMPORT_MAX_CHARS) { out.push(s); return; }
    const d = document.createElement('div'); d.innerHTML = s.html;
    let part = '', n = 1;
    [...d.childNodes].forEach(node => {
      const h = node.outerHTML || esc(node.textContent || '');
      if (size(part) + size(h) > IMPORT_MAX_CHARS && part) { out.push({ title: `${s.title} (${n++})`, html: part }); part = ''; }
      part += h;
    });
    if (part) out.push({ title: n > 1 ? `${s.title} (${n})` : s.title, html: part });
  });
  return out.slice(0, IMPORT_MAX_NOTES);
}

function importRenderOptions() {
  const body = document.getElementById('importBody');
  const pdf = IMPORT.kind === 'pdf';
  body.innerHTML = `
    <div class="import-file">📄 <b>${esc(IMPORT.name)}</b> <small>${{ docx: 'Word', pptx: 'PowerPoint', pdf: 'PDF', md: 'Markdown', txt: 'Text' }[IMPORT.kind]}</small></div>
    <label class="import-opt"><input type="checkbox" id="impSplit" checked> ${IMPORT.kind === 'pptx' ? 'Každý slajd jako samostatná poznámka' : pdf ? 'Každá stránka zvlášť' : 'Rozdělit podle nadpisů na víc poznámek'}</label>
    <label class="import-opt"><input type="checkbox" id="impFolder" checked> Dát poznámky do složky „${esc(IMPORT.name)}“ (seznam)</label>
    <label class="import-opt"><input type="checkbox" id="impHeading" checked> Nad poznámky na nástěnce nadpis s názvem souboru</label>
    <div class="import-colors" id="impColors">${['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe', '#ffedd5'].map((c, i) => `<button type="button" class="color-swatch${i === 0 ? ' selected' : ''}" data-c="${c}" style="background:${c}" aria-label="Barva"></button>`).join('')}</div>
    <div class="import-preview" id="impPreview"></div>`;
  const preview = () => {
    const secs = importSections(document.getElementById('impSplit').checked);
    IMPORT.sections = secs;
    document.getElementById('impPreview').innerHTML = `<div class="import-count">Vznikne ${secs.length} ${secs.length === 1 ? 'poznámka' : secs.length < 5 ? 'poznámky' : 'poznámek'}</div>` +
      secs.map(s => `<div class="import-row"><b>${esc(s.title)}</b><small>${Math.round((s.html.replace(/<[^>]+>/g, '').length) / 100) / 10} tis. znaků${/<img/i.test(s.html) ? ' · obrázky' : ''}</small></div>`).join('');
    document.getElementById('importGo').disabled = !secs.length;
  };
  // PDF z prezentace má na stránce pár řádků → po stránkách by vzniklo moc
  // drobných poznámek; rozdělovat jen když jsou stránky vydatné.
  if (pdf) {
    const avg = IMPORT.raw.reduce((a, h) => a + h.replace(/<[^>]+>/g, '').length, 0) / Math.max(1, IMPORT.raw.length);
    document.getElementById('impSplit').checked = avg > 700 || IMPORT.raw.length <= 3;
  }
  document.getElementById('impSplit').addEventListener('change', preview);
  document.getElementById('impColors').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    document.querySelectorAll('#impColors .color-swatch').forEach(x => x.classList.toggle('selected', x === b));
  });
  preview();
}

// Obrázky z Wordu přijdou jako data: URL — do poznámky by se nevešly, tak se
// nahrají na ImgBB (stejně jako vložený screenshot v editoru).
async function importUploadImages(html, onStep) {
  const d = document.createElement('div'); d.innerHTML = html;
  const imgs = [...d.querySelectorAll('img')].filter(i => /^data:/.test(i.getAttribute('src') || ''));
  for (const img of imgs) {
    onStep?.();
    try {
      const blob = await (await fetch(img.src)).blob();
      img.src = await uploadToImgBB(new File([blob], 'import.png', { type: blob.type || 'image/png' }));
      img.style.width = IMG_SIZES.m; img.style.maxWidth = '100%';
    } catch (_) { img.remove(); }
  }
  return d.innerHTML;
}

async function importRun() {
  if (!IMPORT?.sections?.length) return;
  const go = document.getElementById('importGo');
  go.disabled = true;
  const color = document.querySelector('#impColors .selected')?.dataset.c || '#fef9c3';
  const useFolder = document.getElementById('impFolder').checked;
  const useHeading = document.getElementById('impHeading').checked;
  const status = document.createElement('div'); status.className = 'import-status';
  document.getElementById('impPreview').before(status);
  const notesCol = db.collection('rooms').doc(ROOM_ID).collection('notes');
  // Na volné místo vpravo vedle všeho, co na nástěnce už je (ne přes to).
  const COLS = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(IMPORT.sections.length))));
  const CELL_W = 260, CELL_H = 190;
  const b = contentBounds();
  const origin = boardViewCenter();
  const x0 = b ? Math.round(toStoreX(b.maxX) + 160) : origin.x - Math.floor(COLS / 2) * CELL_W;
  let y0 = b ? Math.round(toStoreY(b.minY)) : origin.y - 120;
  const startX = x0, startY = y0;
  const ids = [];
  try {
    if (useHeading) {
      await notesCol.add({ kind: 'heading', title: IMPORT.name.slice(0, 80), content: '', contentType: 'html', hsize: 30,
        x: x0, y: y0, color: null, authorId: ME.uid, authorName: ME.displayName || ME.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      y0 += 70;
    }
    for (let i = 0; i < IMPORT.sections.length; i++) {
      const s = IMPORT.sections[i];
      status.textContent = `Ukládám ${i + 1} / ${IMPORT.sections.length}…`;
      const html = await importUploadImages(s.html, () => { status.textContent = `Nahrávám obrázky (poznámka ${i + 1})…`; });
      const ref = await notesCol.add({
        title: s.title.slice(0, 80), content: html, contentType: 'html', color,
        x: x0 + (i % COLS) * CELL_W, y: y0 + Math.floor(i / COLS) * CELL_H,
        authorId: ME.uid, authorName: ME.displayName || ME.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      ids.push(ref.id);
    }
    if (useFolder && ids.length) {
      await db.collection('rooms').doc(ROOM_ID).collection('folders').add({
        name: IMPORT.name.slice(0, 60), parentId: null, color: '#6366f1', noteIds: ids,
        authorId: ME.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    toast(`Importováno: ${ids.length} ${ids.length === 1 ? 'poznámka' : ids.length < 5 ? 'poznámky' : 'poznámek'} ✓`);
    logActivity('note', `importoval „${IMPORT.name}“ (${ids.length} poznámek)`);
    document.getElementById('importModal')?.remove();
    IMPORT = null;
    // ukázat, kam se import položil
    if (VIEW_MODE === 'board') {
      const wrap = document.getElementById('boardWrap');
      wrap.scrollTo({ left: toRenderX(startX) * BOARD_ZOOM - 60, top: toRenderY(startY) * BOARD_ZOOM - 60, behavior: 'smooth' });
    }
  } catch (e) {
    status.textContent = 'Import se nepovedl: ' + e.message + (ids.length ? ` (uloženo ${ids.length})` : '');
    status.classList.add('err');
    go.disabled = false;
  }
}

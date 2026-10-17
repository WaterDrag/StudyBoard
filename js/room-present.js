// ═══ room-present.js — Prezentační režim: poznámky jako slajdy přes celou obrazovku
// Zdroj: označené poznámky, složka (i se podsložkami), kapitoly návodu, nebo
// celá nástěnka v pořadí čtení (shora dolů, zleva doprava). Poznámka s
// kapitolami se rozvine na jednotlivé kapitoly.

const PRES_W = 800;              // = --doc-w, aby volné obrázky seděly jako v editoru
let PRES = null;                 // { slides:[{title, html}], i, title }

function presSlidesFromNotes(notes) {
  return notes.flatMap(n => {
    const pages = pagesOf(n);
    if (pages.length) return pages.map(p => ({ title: p.title || n.title || 'Kapitola', html: p.content || '' }));
    const html = n.contentType === 'html' ? (n.content || '') : `<p>${esc(n.content || '').replace(/\n/g, '<br>')}</p>`;
    return [{ title: n.title || '', html }];
  });
}
// Pořadí čtení na nástěnce: pásy po ~160 px shora dolů, v pásu zleva doprava.
function presReadingOrder(notes) {
  return notes.slice().sort((a, b) => Math.round((a.y || 0) / 160) - Math.round((b.y || 0) / 160) || (a.x || 0) - (b.x || 0));
}
function presFolderNotes(folderId) {
  const f = FOLDERS_MAP.get(folderId);
  if (!f) return [];
  const own = (f.noteIds || []).map(id => NOTES_MAP.get(id)).filter(n => n && !isHeading(n));
  const subs = [...FOLDERS_MAP.values()].filter(x => x.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  return [...own, ...subs.flatMap(s => presFolderNotes(s.id))];
}

// ⋯ menu / orb: označené → aktuální složka v ikonách → celá nástěnka
function presentDefault() {
  if (SELECTED && SELECTED.size) {
    const notes = presReadingOrder([...SELECTED].map(id => NOTES_MAP.get(id)).filter(n => n && !isHeading(n)));
    return startPresentation(presSlidesFromNotes(notes), `${notes.length} označených poznámek`);
  }
  if (VIEW_MODE === 'list' && typeof GRID_FOLDER !== 'undefined' && GRID_FOLDER && FOLDERS_MAP.has(GRID_FOLDER)) {
    return presentFolder(GRID_FOLDER);
  }
  const notes = presReadingOrder([...NOTES_MAP.values()].filter(n => !isHeading(n)));
  startPresentation(presSlidesFromNotes(notes), ROOM?.name || 'Nástěnka');
}
function presentFolder(folderId) {
  const f = FOLDERS_MAP.get(folderId);
  startPresentation(presSlidesFromNotes(presFolderNotes(folderId)), f?.name || 'Složka');
}
function presentGuide() {
  const note = GUIDE && NOTES_MAP.get(GUIDE.noteId);
  if (!note) return;
  const slides = presSlidesFromNotes([note]);
  const start = Math.max(0, pagesOf(note).findIndex(p => p.id === GUIDE.pageId));
  startPresentation(slides, note.title || 'Návod', start);
}

function startPresentation(slides, title, start = 0) {
  slides = slides.filter(s => s.title || (s.html || '').replace(/<[^>]+>/g, '').trim() || /<img/i.test(s.html || ''));
  if (!slides.length) { toast('Není co prezentovat — žádné poznámky.'); return; }
  closePresentation();
  PRES = { slides, i: Math.min(start, slides.length - 1), title };
  const ov = document.createElement('div');
  ov.id = 'presOv';
  ov.className = 'pres-ov';
  ov.innerHTML = `
    <div class="pres-top"><span class="pres-name">${esc(title)}</span>
      <button type="button" class="icon-btn" data-p="full" title="Celá obrazovka (F)">⛶</button>
      <button type="button" class="icon-btn" data-p="close" title="Zavřít (Esc)">✕</button></div>
    <div class="pres-stage" id="presStage"><div class="pres-doc" id="presDoc"></div></div>
    <div class="pres-bar">
      <button type="button" class="pres-nav" data-p="prev" aria-label="Předchozí">‹</button>
      <span class="pres-count" id="presCount"></span>
      <button type="button" class="pres-nav" data-p="next" aria-label="Další">›</button>
    </div>
    <div class="pres-progress"><i id="presProg"></i></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('pres-open');
  ov.addEventListener('click', e => {
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (a === 'prev') return presGo(-1);
    if (a === 'next') return presGo(1);
    if (a === 'close') return closePresentation();
    if (a === 'full') return presFullscreen();
    // klik do slajdu: pravá část dál, levá zpět (odkazy fungují normálně)
    if (e.target.closest('a, button, input, .pres-top, .pres-bar')) return;
    if (e.target.closest('#presStage')) presGo(e.clientX > window.innerWidth * 0.35 ? 1 : -1);
  });
  let tx = null, ty = null;
  ov.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  ov.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) presGo(dx < 0 ? 1 : -1);
    tx = null;
  }, { passive: true });
  document.addEventListener('keydown', presKeys, true);
  window.addEventListener('resize', presFit);
  presRender();
}

function presKeys(e) {
  if (!PRES) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); e.stopPropagation(); presGo(1); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); e.stopPropagation(); presGo(-1); }
  else if (k === 'Home') { e.preventDefault(); PRES.i = 0; presRender(); }
  else if (k === 'End') { e.preventDefault(); PRES.i = PRES.slides.length - 1; presRender(); }
  else if (k === 'Escape' && !document.fullscreenElement) { e.preventDefault(); e.stopPropagation(); closePresentation(); }
  else if (k === 'f' || k === 'F') { e.preventDefault(); presFullscreen(); }
}

function presGo(d) {
  if (!PRES) return;
  const n = PRES.i + d;
  if (n < 0 || n >= PRES.slides.length) return;
  PRES.i = n; PRES.dir = d;
  presRender();
}

function presRender() {
  const s = PRES.slides[PRES.i];
  const doc = document.getElementById('presDoc');
  doc.classList.remove('in-l', 'in-r'); void doc.offsetWidth;
  doc.classList.add(PRES.dir < 0 ? 'in-l' : 'in-r');
  doc.innerHTML = (s.title ? `<h1 class="pres-title">${esc(s.title)}</h1>` : '') + `<div class="note-doc note-detail-content pres-content">${s.html}</div>`;
  wireWebLinks(doc);
  wirePageLinks?.(doc);
  document.getElementById('presStage').scrollTop = 0;
  document.getElementById('presCount').textContent = `${PRES.i + 1} / ${PRES.slides.length}`;
  document.getElementById('presProg').style.width = ((PRES.i + 1) / PRES.slides.length * 100) + '%';
  document.querySelector('#presOv [data-p="prev"]').disabled = PRES.i === 0;
  document.querySelector('#presOv [data-p="next"]').disabled = PRES.i === PRES.slides.length - 1;
  presFit();
}

// Slajd má pevnou šířku (volně umístěné obrázky sedí jako v editoru) a na
// velké obrazovce se celý zvětší. Na telefonu se text naopak přelije na šířku.
function presFit() {
  const doc = document.getElementById('presDoc');
  if (!doc) return;
  const narrow = window.innerWidth < 700;
  doc.style.width = narrow ? '100%' : PRES_W + 'px';
  doc.style.zoom = narrow ? 1 : Math.max(1, Math.min(1.8, (window.innerWidth - 120) / PRES_W, (window.innerHeight - 140) / 520));
}

function presFullscreen() {
  const ov = document.getElementById('presOv');
  if (!ov) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else ov.requestFullscreen?.().catch(() => {});
}

function closePresentation() {
  document.getElementById('presOv')?.remove();
  document.body.classList.remove('pres-open');
  document.removeEventListener('keydown', presKeys, true);
  window.removeEventListener('resize', presFit);
  if (document.fullscreenElement) document.exitFullscreen?.();
  PRES = null;
}

function setupPresentation() {
  document.getElementById('presentBtn')?.addEventListener('click', presentDefault);
  document.getElementById('mselPresent')?.addEventListener('click', presentDefault);
  document.getElementById('guidePresent')?.addEventListener('click', presentGuide);
}

// ═══ room-files.js — Soubory místnosti na Google Disku
// Soubor leží na Disku toho, kdo ho nahrál; ve Firestoru je jen ODKAZ, aby ho
// viděli všichni v místnosti. Seznam je POLE NA DOKUMENTU MÍSTNOSTI, ne vlastní
// subkolekce — publikovaná pravidla novou subkolekci odmítají (stejně jako
// `activity`), kdežto update dokumentu projde. Položka má pár set bajtů,
// takže se jich do 1MB limitu vejdou stovky.

const FILE_ICONS = [
  [/pdf/, '📕'], [/image|png|jpe?g|gif|webp|svg/, '🖼️'], [/zip|rar|7z|tar/, '🗜️'],
  [/word|document|[.]docx?$/, '📘'], [/sheet|excel|[.]xlsx?$/, '📗'],
  [/presentation|powerpoint|[.]pptx?$/, '📙'], [/audio|mp3|wav/, '🎵'],
  [/video|mp4|mkv|avi/, '🎬'], [/text|plain|[.]md$|[.]txt$/, '📄'],
];

function fileIcon(name, mime) {
  const hay = ((mime || '') + ' ' + (name || '')).toLowerCase();
  for (const [re, ico] of FILE_ICONS) if (re.test(hay)) return ico;
  return '📎';
}

function roomFiles() {
  return Array.isArray(ROOM?.files) ? ROOM.files : [];
}

// Nahraná složka má v seznamu navíc položku `kind: 'folder'` s odkazem na
// složku na Disku nasdílenou odkazem — přes ni jde stáhnout celá (Disk ji
// zabalí do ZIPu). Do počtu ani výpisu souborů se nepočítá.
const isFolderEntry = f => f?.kind === 'folder';
const roomFileEntries = () => roomFiles().filter(f => !isFolderEntry(f));
const underPath = (name, path) => String(name || '').startsWith(path + '/');
function roomFolderEntry(path) {
  const all = roomFiles().filter(f => isFolderEntry(f) && f.name === path);
  return all.find(f => f.by === ME.uid) || all[0] || null;
}

// Složky, které vznikají při sestavení projektu nebo je dělá editor — spolužákům
// k ničemu (a u projektu v C# jsou to desítky souborů), proto se nenahrávají.
const SKIP_DIRS = /^(bin|obj|\.vs|\.vscode|\.idea|\.git|node_modules|__pycache__|\.gradle|build|dist|target)$/i;
const skippedPath = path => String(path || '').split(/[\\/]/).slice(0, -1).some(p => SKIP_DIRS.test(p));

const filesPlural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

// Rozbalené složky v seznamu (pamatují se přes překreslení)
const OPEN_DIRS = new Set();

function filesMsg(text, kind) {
  const el = document.getElementById('filesMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'files-msg' + (kind ? ' ' + kind : '');
}

function renderRoomFiles() {
  const el = document.getElementById('filesList');
  if (!el) return;
  const list = roomFileEntries();
  const path = document.getElementById('filesPath');
  if (path) path.textContent = DRIVE_FOLDER_NAME + '/' + driveSafeName(ROOM?.name);
  if (!list.length) {
    el.innerHTML = '<div class="files-empty">Zatím tu nic není. Nahraj první soubor ↑</div>';
    return;
  }
  // Smazat smí ten, kdo nahrál, nebo vlastník místnosti.
  const canDel = f => f.by === ME.uid || ROOM?.ownerId === ME.uid;
  // „Složka/Podsložka/soubor.pdf" → strom; složky napřed, pak soubory od nejnovějších
  const root = { dirs: {}, files: [] };
  list.forEach(f => {
    const parts = String(f.name || 'soubor').split('/').filter(Boolean);
    const leaf = parts.pop() || 'soubor';
    let node = root, p = '';
    parts.forEach(part => { p = p ? p + '/' + part : part; node = node.dirs[part] ||= { path: p, dirs: {}, files: [] }; });
    node.files.push({ ...f, leaf });
  });
  const all = node => node.files.concat(...Object.values(node.dirs).map(all));
  const fileRow = f => `<div class="files-row" data-id="${esc(f.id)}">
      <span class="files-ico">${fileIcon(f.leaf, f.mime)}</span>
      <span class="files-name" title="${esc(f.name)}">${esc(f.leaf)}</span>
      <span class="files-meta">${esc(f.byName || '')}${f.size ? ' · ' + esc(driveFileSize(f.size)) : ''}</span>
      <a class="files-open" href="${esc(/^https:\/\//i.test(String(f.link || '')) ? f.link : '#')}" target="_blank" rel="noopener">otevřít ↗</a>
      ${canDel(f) ? `<button class="files-del" data-del="${esc(f.id)}" title="Odebrat ze seznamu">🗑️</button>` : ''}
    </div>`;
  const renderNode = node =>
    Object.keys(node.dirs).sort(nameCmp).map(name => {
      const d = node.dirs[name], files = all(d);
      const size = files.reduce((n, f) => n + (+f.size || 0), 0);
      const by = [...new Set(files.map(f => f.byName).filter(Boolean))].join(', ');
      return `<details class="files-dir" data-path="${esc(d.path)}" ${OPEN_DIRS.has(d.path) ? 'open' : ''}>
        <summary class="files-row">
          <span class="allfiles-caret"></span><span class="files-ico">📁</span>
          <span class="files-name" title="${esc(d.path)}">${esc(name)}</span>
          <span class="files-meta">${esc(by)} · ${files.length} ${filesPlural(files.length, 'soubor', 'soubory', 'souborů')}${size ? ' · ' + esc(driveFileSize(size)) : ''}</span>
          <button class="files-open" data-dl="${esc(d.path)}" title="Otevře složku na Google Disku, odkud se stáhne celá jako ZIP">stáhnout ⬇</button>
          ${files.every(canDel) ? `<button class="files-del" data-deldir="${esc(d.path)}" title="Odebrat celou složku ze seznamu">🗑️</button>` : ''}
        </summary>
        <div class="files-children">${renderNode(d)}</div>
      </details>`;
    }).join('') +
    node.files.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map(fileRow).join('');
  el.innerHTML = renderNode(root);
}

// Složka na Disku nahrávajícího, nasdílená odkazem (podsložky i soubory to zdědí).
// Najít ji umí jen ten, kdo ji nahrál — `drive.file` vidí jen svoje soubory.
async function shareRoomFolder(path) {
  let folder = await driveSubfolder(ROOM?.name);
  for (const part of roomFilePathParts(path)) folder = await driveSubfolder(part, folder);
  await driveShareByLink(folder);
  const entry = {
    id: folder, kind: 'folder', name: path,
    link: 'https://drive.google.com/drive/folders/' + folder,
    by: ME.uid, byName: ME.displayName || ME.email || 'Anon', at: Date.now(),
  };
  await saveRoomFiles(list => [...list.filter(x => !(isFolderEntry(x) && x.name === path && x.by === ME.uid)), entry]);
  return entry;
}

async function downloadRoomFolder(path) {
  let entry = roomFolderEntry(path);
  const files = roomFileEntries().filter(f => underPath(f.name, path));
  if (!entry && !files.some(f => f.by === ME.uid)) {
    const who = [...new Set(files.map(f => f.byName).filter(Boolean))].join(', ') || 'ten, kdo ji nahrál';
    filesMsg(`Složku ke stažení musí jednou zpřístupnit ${who} — stačí, když tu u ní klikne na „stáhnout".`, 'err');
    return;
  }
  // Okno otevřít hned (v reakci na klik), jinak by ho prohlížeč po čekání na Disk zablokoval
  const win = window.open('about:blank', '_blank');
  try {
    if (!entry) { filesMsg('Zpřístupňuji složku na Disku…'); entry = await shareRoomFolder(path); }
    if (win) { win.opener = null; win.location.href = entry.link; } else window.open(entry.link, '_blank', 'noopener');
    filesMsg('Složka se otevřela na Google Disku — celou ji stáhneš tlačítkem Stáhnout (přijde jako ZIP).', 'ok');
  } catch (e) {
    win?.close();
    filesMsg('Složku se nepodařilo zpřístupnit: ' + (e?.message || e), 'err');
  }
}

async function removeRoomFolder(path) {
  const files = roomFileEntries().filter(f => underPath(f.name, path));
  if (!await sbConfirm('Odebrat složku „' + path + '" (' + files.length + ' ' + filesPlural(files.length, 'soubor', 'soubory', 'souborů') + ') ze seznamu?\n\n' +
               'Z Google Disku se NESMAŽE, tam ji případně smaž sám.', { ok: 'Odebrat', danger: true })) return;
  const ids = new Set(files.map(f => f.id));
  const mine = roomFiles().filter(f => f.by === ME.uid && (ids.has(f.id) || (isFolderEntry(f) && (f.name === path || underPath(f.name, path)))));
  try {
    await saveRoomFiles(list => list.filter(x => !ids.has(x.id) && !(isFolderEntry(x) && (x.name === path || underPath(x.name, path)))));
    OPEN_DIRS.delete(path);
    filesMsg('Odebráno.', 'ok');
    // Sdílení odkazem zrušíme jen u vlastních souborů (cizí Disk ovlivnit nejde) — potichu na pozadí
    for (const f of mine) { try { await driveUnshare(f.id); } catch (_) {} }
  } catch (e) { filesMsg('Nepovedlo se: ' + (e?.message || e), 'err'); }
}

// Zápis seznamu. Čte se aktuální stav z Firestoru, ne z lokální kopie —
// jinak by dva lidé nahrávající naráz o sebe přepsali položky.
//
// NEČEKÁ se na potvrzení ze serveru: Firestore má zapnutý offline režim a
// `update()` se splní až když zápis potvrdí server. Na špatném připojení by
// tak nahrávání viselo na „Nahrávám…" donekonečna, přestože je soubor dávno
// na Disku a zápis bezpečně čeká ve frontě. Lokálně se projeví hned, chybu
// oznámíme, až kdyby nějaká přišla.
async function saveRoomFiles(mutate) {
  const ref = db.collection('rooms').doc(ROOM_ID);
  const snap = await ref.get();
  const cur = Array.isArray(snap.data()?.files) ? snap.data().files : [];
  const next = mutate(cur.slice());
  ref.update({ files: next }).catch(e => filesMsg('Seznam se nepodařilo uložit: ' + e.message, 'err'));
  if (ROOM) ROOM.files = next;
  renderRoomFiles();
}

function roomFileItems(fileList) {
  return [...(fileList || [])].map(item => {
    const file = item?.file || item;
    if (!file || typeof file.size !== 'number') return null;
    return {
      file,
      relativePath: item?.relativePath || file.webkitRelativePath || file.name,
    };
  }).filter(Boolean);
}

function roomFilePathParts(path, fallback) {
  return String(path || fallback || '')
    .split(/[\\/]/)
    .filter(part => part && part !== '.' && part !== '..')
    .map(driveSafeName)
    .filter(Boolean);
}

async function driveRoomFileTarget(relativePath, fallbackName) {
  const parts = roomFilePathParts(relativePath, fallbackName);
  if (!parts.length) throw new Error('Soubor nemá platný název.');
  const fileName = parts.pop();
  let folder = await driveSubfolder(ROOM?.name);
  for (const part of parts) folder = await driveSubfolder(part, folder);
  return { folder, fileName, displayName: [...parts, fileName].join('/') };
}

function fileFromEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryBatch(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function directoryEntries(entry) {
  const reader = entry.createReader();
  const entries = [];
  while (true) {
    const batch = await readDirectoryBatch(reader);
    if (!batch.length) return entries;
    entries.push(...batch);
  }
}

async function collectDroppedEntry(entry, parentPath = '') {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    return [{ file, relativePath: path }];
  }
  if (entry.isDirectory) {
    const children = await directoryEntries(entry);
    const nested = await Promise.all(children.map(child => collectDroppedEntry(child, path)));
    return nested.flat();
  }
  return [];
}

async function filesFromDrop(dataTransfer) {
  const items = [...(dataTransfer?.items || [])];
  // Read DataTransferItem handles synchronously while the drop event is active.
  const sources = items.map(item => {
    const entry = item.webkitGetAsEntry?.();
    if (entry) return { entry };
    const file = item.getAsFile?.();
    return file ? { file } : null;
  }).filter(Boolean);
  const containsDirectory = sources.some(source => source.entry?.isDirectory);
  const files = [];
  for (const source of sources) {
    if (source.entry) files.push(...await collectDroppedEntry(source.entry));
    else files.push({ file: source.file, relativePath: source.file.webkitRelativePath || source.file.name });
  }
  if (files.length) return files;
  if (containsDirectory) return [];
  return [...(dataTransfer?.files || [])].map(file => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

async function uploadRoomFiles(fileList) {
  const picked = roomFileItems(fileList);
  const files = picked.filter(item => !skippedPath(item.relativePath));
  const skipped = picked.length - files.length;
  if (!files.length) {
    if (skipped) filesMsg('Ve složce jsou jen soubory ze sestavení (bin, obj…), ty se nenahrávají.', 'err');
    return;
  }
  if (!driveConfigured()) { filesMsg(driveSetupHint(), 'err'); return; }
  if (MY_ROLE === 'viewer') { filesMsg('Nahrávat můžou jen editoři.', 'err'); return; }

  const tops = new Set();
  let done = 0;
  for (const item of files) {
    const { file, relativePath } = item;
    let displayName = relativePath || file.name;
    try {
      filesMsg('Nahrávám ' + displayName + '… (' + (done + 1) + '/' + files.length + ')');
      const target = await driveRoomFileTarget(relativePath, file.name);
      displayName = target.displayName;
      const up = await driveUpload(target.fileName, file, file.type || 'application/octet-stream', target.folder);
      // Bez tohohle by spolužákům Disk nabídl jen „požádat o přístup".
      await driveShareByLink(up.id);
      await saveRoomFiles(list => [...list, {
        id: up.id,
        name: displayName || up.name || file.name,
        mime: up.mimeType || file.type || '',
        size: up.size || String(file.size || ''),
        link: up.webViewLink || ('https://drive.google.com/file/d/' + up.id + '/view'),
        by: ME.uid,
        byName: ME.displayName || ME.email || 'Anon',
        at: Date.now(),
      }]);
      done++;
      if (displayName.includes('/')) tops.add(displayName.split('/')[0]);
    } catch (e) {
      filesMsg(file.name + ': ' + (e?.message || e), 'err');
      return;
    }
  }
  // Nahraná složka se rovnou nasdílí odkazem, ať si ji ostatní můžou stáhnout celou
  for (const top of tops) {
    try { await shareRoomFolder(top); } catch (_) { /* stáhnout půjde i později — zkusí se znovu při kliknutí */ }
  }
  filesMsg((done === 1 ? 'Nahráno ✓' : 'Nahráno ' + done + ' souborů ✓') +
    (skipped ? ' Přeskočeno ' + skipped + ' ze sestavení (bin, obj…).' : ''), 'ok');
}

async function removeRoomFile(id) {
  const f = roomFiles().find(x => x.id === id);
  if (!f) return;
  if (!await sbConfirm('Odebrat „' + f.name + '" ze seznamu?\n\n' +
               'Ze tvého Google Disku se NESMAŽE, tam ho případně smaž sám.', { ok: 'Odebrat', danger: true })) return;
  try {
    await saveRoomFiles(list => list.filter(x => x.id !== id));
    // Sdílení odkazem zrušíme, ale jen když je to MŮJ soubor — cizí Disk
    // nemáme jak ovlivnit a volání by stejně skončilo chybou.
    if (f.by === ME.uid) { try { await driveUnshare(id); } catch (_) {} }
    filesMsg('Odebráno.', 'ok');
  } catch (e) { filesMsg('Nepovedlo se: ' + (e?.message || e), 'err'); }
}

function setupRoomFiles() {
  const btn = document.getElementById('filesBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    filesMsg('');
    renderRoomFiles();
    openModal('filesModal');
  });

  const input = document.getElementById('filesInput');
  document.getElementById('filesPickBtn')?.addEventListener('click', () => input.click());
  input?.addEventListener('change', () => {
    uploadRoomFiles(input.files);
    input.value = '';
  });
  const folderInput = document.getElementById('filesFolderInput');
  document.getElementById('filesFolderPickBtn')?.addEventListener('click', () => folderInput?.click());
  folderInput?.addEventListener('change', () => {
    uploadRoomFiles(folderInput.files);
    folderInput.value = '';
  });

  const drop = document.getElementById('filesDrop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', async e => {
      try {
        const files = await filesFromDrop(e.dataTransfer);
        if (!files.length) {
          filesMsg('Složka neobsahuje žádné soubory.', 'err');
          return;
        }
        await uploadRoomFiles(files);
      } catch (err) {
        filesMsg('Složku se nepodařilo načíst: ' + (err?.message || err), 'err');
      }
    });
  }

  const listEl = document.getElementById('filesList');
  listEl?.addEventListener('click', e => {
    const dl = e.target.closest('[data-dl]'), dd = e.target.closest('[data-deldir]');
    // tlačítka ve <summary> nemají složku rozbalit/sbalit
    if (dl || dd) e.preventDefault();
    if (dl) { downloadRoomFolder(dl.dataset.dl); return; }
    if (dd) { removeRoomFolder(dd.dataset.deldir); return; }
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (id) removeRoomFile(id);
  });
  // toggle nebublá, ale zachytávací fáze ho na předkovi chytí
  listEl?.addEventListener('toggle', e => {
    const d = e.target.closest?.('.files-dir');
    if (d) d.open ? OPEN_DIRS.add(d.dataset.path) : OPEN_DIRS.delete(d.dataset.path);
  }, true);
}

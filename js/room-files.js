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

function filesMsg(text, kind) {
  const el = document.getElementById('filesMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'files-msg' + (kind ? ' ' + kind : '');
}

function renderRoomFiles() {
  const el = document.getElementById('filesList');
  if (!el) return;
  const list = roomFiles();
  const path = document.getElementById('filesPath');
  if (path) path.textContent = DRIVE_FOLDER_NAME + '/' + driveSafeName(ROOM?.name);
  if (!list.length) {
    el.innerHTML = '<div class="files-empty">Zatím tu nic není. Nahraj první soubor ↑</div>';
    return;
  }
  el.innerHTML = list.slice().reverse().map(f => {
    // Smazat smí ten, kdo nahrál, nebo vlastník místnosti.
    const canDel = f.by === ME.uid || ROOM?.ownerId === ME.uid;
    return `<div class="files-row" data-id="${esc(f.id)}">
        <span class="files-ico">${fileIcon(f.name, f.mime)}</span>
        <span class="files-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <span class="files-meta">${esc(f.byName || '')}${f.size ? ' · ' + esc(driveFileSize(f.size)) : ''}</span>
        <a class="files-open" href="${esc(/^https:\/\//i.test(String(f.link || '')) ? f.link : '#')}" target="_blank" rel="noopener">otevřít ↗</a>
        ${canDel ? `<button class="files-del" data-del="${esc(f.id)}" title="Odebrat ze seznamu">🗑</button>` : ''}
      </div>`;
  }).join('');
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
  const files = roomFileItems(fileList);
  if (!files.length) return;
  if (!driveConfigured()) { filesMsg(driveSetupHint(), 'err'); return; }
  if (MY_ROLE === 'viewer') { filesMsg('Nahrávat můžou jen editoři.', 'err'); return; }

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
    } catch (e) {
      filesMsg(file.name + ': ' + (e?.message || e), 'err');
      return;
    }
  }
  filesMsg(done === 1 ? 'Nahráno ✓' : 'Nahráno ' + done + ' souborů ✓', 'ok');
}

async function removeRoomFile(id) {
  const f = roomFiles().find(x => x.id === id);
  if (!f) return;
  if (!confirm('Odebrat „' + f.name + '" ze seznamu?\n\n' +
               'Ze tvého Google Disku se NESMAŽE — tam ho případně smaž sám.')) return;
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

  document.getElementById('filesList')?.addEventListener('click', e => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (id) removeRoomFile(id);
  });
}

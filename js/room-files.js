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
        <a class="files-open" href="${esc(f.link)}" target="_blank" rel="noopener">otevřít ↗</a>
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

async function uploadRoomFiles(fileList) {
  const files = [...fileList].filter(Boolean);
  if (!files.length) return;
  if (!driveConfigured()) { filesMsg(driveSetupHint(), 'err'); return; }
  if (MY_ROLE === 'viewer') { filesMsg('Nahrávat můžou jen editoři.', 'err'); return; }

  let done = 0;
  for (const file of files) {
    try {
      filesMsg('Nahrávám ' + file.name + '… (' + (done + 1) + '/' + files.length + ')');
      const folder = await driveSubfolder(ROOM?.name);
      const up = await driveUpload(file.name, file, file.type || 'application/octet-stream', folder);
      // Bez tohohle by spolužákům Disk nabídl jen „požádat o přístup".
      await driveShareByLink(up.id);
      await saveRoomFiles(list => [...list, {
        id: up.id,
        name: up.name || file.name,
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
  input?.addEventListener('change', () => { uploadRoomFiles(input.files); input.value = ''; });

  const drop = document.getElementById('filesDrop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => uploadRoomFiles(e.dataTransfer?.files || []));
  }

  document.getElementById('filesList')?.addEventListener('click', e => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (id) removeRoomFile(id);
  });
}

// ── Auth guard ─────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) {
    // Preserve a friend-invite link (?addFriend=CODE) through the login
    // round-trip, same mechanism as room.js's invite-link redirect.
    if (window.location.search) localStorage.setItem('sb_pending_redirect', window.location.href);
    window.location.href = 'index.html';
    return;
  }
  init(user);
});

// ── Init ────────────────────────────────────────────────────────
async function init(user) {
  const avatar = document.getElementById('userAvatar');
  document.getElementById('userName').textContent = user.displayName || user.email;
  if (user.photoURL) avatar.innerHTML = `<img src="${user.photoURL}" alt="">`;
  else avatar.textContent = initial(user.displayName || user.email);

  document.getElementById('logoutBtn').addEventListener('click', () =>
    auth.signOut().then(() => (window.location.href = 'index.html'))
  );

  setupDashHero(user);

  // Aktualizuj profil – vygeneruj friendCode pokud ještě nemá
  db.collection('users').doc(user.uid).get().then(async snap => {
    const existing = snap.exists ? snap.data().friendCode : null;
    // Spaced-repetition progress (quiz.js) feeds "K opakování dnes".
    USER_LEARN = (snap.exists && snap.data().learn) || {};
    renderReview();
    // AI klíče: users/{uid} je čitelný pro KAŽDÉHO přihlášeného (kvůli
    // profilům přátel a členů), takže klíče tam nesmí ležet — čtou se
    // a ukládají do soukromé podkolekce, kam smí jen vlastník účtu.
    await migrateAiKeys(user, snap);
    await loadAiKeys(user);
    // Téma uložené na účtu (localStorage je jen rychlá cache pro version.js)
    const savedTheme = snap.exists ? snap.data().theme : null;
    if (savedTheme != null && savedTheme !== (localStorage.getItem('sb_theme') || '')) {
      applyTheme(savedTheme);
    }
    db.collection('users').doc(user.uid).set({
      displayName: user.displayName || user.email,
      email:       (user.email || '').toLowerCase(),
      photoURL:    user.photoURL || null,
      friendCode:  existing || genCode(),
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  setupSettings(user);

  setupTabs(user);
  initGarden(user);
  setupAllFiles();
  loadRooms(user);
  loadDecks(user);
  loadFriends(user);
  setupCreate(user);
  setupJoin(user);
  setupNewDeck(user);
  setupAddFriend(user);
  setupEditRoom();
  setupEditDeck();
  setupModalClose();
}

// ── Tabs ────────────────────────────────────────────────────────
function setupTabs(user) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'flash') loadDecks(user);
      if (btn.dataset.tab === 'games') loadGames(user);
    });
  });
}

// ── Hry ─────────────────────────────────────────────────────────
// Dobyvatel: hry přátel (lobby nebo rozehraná, kde hraju). Zombie Survival:
// otevřené čekárny. Načítá se až při otevření záložky.
let _gamesLoaded = false;
function loadGames(user) {
  if (_gamesLoaded) return;
  _gamesLoaded = true;
  setupGameFilters();
  loadDailyCard(user);
  // Pexeso s přáteli: čekárny a rozehrané hry, kam mě někdo pozval
  const pxl = document.getElementById('pxLobbies');
  db.collection('pexeso').where('allowedUids', 'array-contains', user.uid).onSnapshot(snap => {
    const games = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.status === 'lobby' || (g.status === 'play' && (g.playerIds || []).includes(user.uid)))
      .filter(g => Date.now() - (g.createdAt?.toMillis?.() || Date.now()) < 6 * 3600e3)
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 5);
    pxl.innerHTML = games.length ? games.map(g => `<a class="game-lobby" href="pexeso.html?g=${g.id}"><span><b>${esc(g.hostName || 'Hra')}</b><small>${g.pairs || ''} dvojic · ${(g.playerIds || []).length} hráčů · ${g.status === 'play' ? 'hraje se' : 'čeká'}</small></span><span class="btn btn-secondary btn-sm">${(g.playerIds || []).includes(user.uid) ? 'Vrátit se' : 'Připojit'}</span></a>`).join('')
      : '<div class="game-empty">Nikdo z přátel teď pexeso nezaložil.</div>';
  }, () => { pxl.innerHTML = '<div class="game-empty">Hry se nepodařilo načíst.</div>'; });
  const dob = document.getElementById('dobLobbies');
  db.collection('conquest').where('allowedUids', 'array-contains', user.uid).onSnapshot(snap => {
    const games = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(g => (g.status === 'lobby' && g.hostUid !== user.uid) || (g.status !== 'end' && (g.playerIds || []).includes(user.uid)))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 6);
    const maps = { cesko: 'Česko', nemecko: 'Německo', evropa: 'Evropa', usa: 'USA', svet: 'Svět' };
    dob.innerHTML = games.length ? games.map(g => {
      const mine = (g.playerIds || []).includes(user.uid);
      return `<a class="game-lobby" href="dobyvatel.html?g=${g.id}"><span><b>${esc(g.hostName || 'Hra')}</b><small>${esc(maps[g.settings?.map] || '')} · ${Object.keys(g.players || {}).length} hráčů · ${g.status === 'play' ? 'hraje se' : 'čeká'}</small></span><span class="btn btn-secondary btn-sm">${mine ? 'Vrátit se' : 'Připojit'}</span></a>`;
    }).join('') : '<div class="game-empty">Teď nikdo z přátel nemá otevřenou hru.</div>';
    updateGamesBadge();
  }, () => { dob.innerHTML = '<div class="game-empty">Hry se nepodařilo načíst.</div>'; });

  const surv = document.getElementById('survivalLobbies');
  const STALE_MS = 3 * 60 * 60 * 1000;
  db.collection('survival_lobbies').where('status', '==', 'waiting').limit(8).onSnapshot(snap => {
    const rows = [];
    snap.forEach(doc => {
      const d = doc.data();
      const ageMs = d.createdAt?.toMillis ? Date.now() - d.createdAt.toMillis() : 0;
      if (d.hostId === user.uid && ageMs > STALE_MS) { doc.ref.delete().catch(() => {}); return; }
      const n = Object.keys(d.players || {}).length;
      rows.push(`<div class="game-lobby"><span><b>🧟 ${esc(d.hostName || 'Hráč')}</b><small>vlna ${d.wave || 0} · ${n}/4 hráčů</small></span>
        ${d.hostId === user.uid ? `<button type="button" class="btn btn-ghost btn-sm" data-cancel="${doc.id}" title="Zrušit">✕</button>` : ''}
        <a class="btn btn-secondary btn-sm" href="game.html?lobby=${doc.id}">Připojit</a></div>`);
    });
    surv.innerHTML = rows.length ? rows.join('') : '<div class="game-empty">Žádná otevřená hra — založ novou.</div>';
    surv.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () =>
      db.collection('survival_lobbies').doc(b.dataset.cancel).delete().catch(e => toast('Nepodařilo se zrušit: ' + e.message))));
  }, () => { surv.innerHTML = '<div class="game-empty">Hry se nepodařilo načíst.</div>'; });

  document.getElementById('newSurvivalBtn').addEventListener('click', async e => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const name = user.displayName || user.email?.split('@')[0] || 'Hráč';
      const ref = await db.collection('survival_lobbies').add({
        hostId: user.uid, hostName: name, status: 'waiting', wave: 0, mapId: 0,
        players: { [user.uid]: { uid: user.uid, name, ready: false } },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      location.href = `game.html?lobby=${ref.id}`;
    } catch (err) { toast('Chyba: ' + err.message); btn.disabled = false; }
  });
}
// Denní výzva + rekord Milionáře na kartách v záložce Hry
async function loadDailyCard(user) {
  const day = new Date().toLocaleDateString('en-CA');
  try {
    const best = +localStorage.getItem('mil_best') || 0;
    document.getElementById('milStatus').innerHTML = best ? `🏆 Rekord: <b>${best.toLocaleString('cs-CZ')} Kč</b>` : '';
    const bestOf = (k, unit) => { const v = +localStorage.getItem(k) || 0; return v ? `🏆 Rekord: <b>${v.toLocaleString('cs-CZ')} ${unit}</b>` : ''; };
    document.getElementById('tfStatus').innerHTML = bestOf('tf_best', 'b');
    document.getElementById('wsStatus').innerHTML = bestOf('ws_best', 'b');
    document.getElementById('cwStatus').innerHTML = bestOf('cw_best', 'b');
    try { const px = JSON.parse(localStorage.getItem('px_best') || 'null'); document.getElementById('pxStatus').innerHTML = px ? `🏆 Sólo: <b>${px.moves} tahů</b> (${px.pairs} dvojic)` : ''; } catch (_) { /* nic */ }
    const hg = +localStorage.getItem('sib_best') || 0;
    document.getElementById('hgStatus').innerHTML = hg ? `🏆 Rekord: <b>${hg} b</b>` : '';
    const sp = +localStorage.getItem('spoj_best') || 0;
    document.getElementById('spStatus').innerHTML = sp ? `🏆 Rekord: <b>${sp.toLocaleString('cs-CZ')} b</b>` : '';
  } catch (_) { /* nic */ }
  const st = document.getElementById('dailyStatus'), fr = document.getElementById('dailyFriends');
  if (user.isAnonymous) { st.textContent = 'Jen pro přihlášené.'; fr.innerHTML = ''; return; }
  try {
    const me = (await db.collection('users').doc(user.uid).get()).data() || {};
    const daily = me.daily || {}, t = daily[day];
    let streak = 0;
    for (let i = t?.done ? 0 : 1; i < 400; i++) { if (!daily[new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA')]?.done) break; streak++; }
    st.innerHTML = (t?.done ? `✅ Dnes splněno: <b>${t.s} b</b> (${t.c}/${t.of || 10})` : t?.q ? `⏳ Rozehráno ${t.n || 0}/10` : '🔔 Dnešní výzva na tebe čeká')
      + (streak ? ` · 🔥 ${streak}` : '');
    document.getElementById('dailyBtn').textContent = t?.done ? 'Zobrazit výsledky' : t?.q ? 'Pokračovat' : 'Hrát dnešní výzvu';
    const b = document.getElementById('gamesCountBadge');
    if (b && !t?.done && !b.textContent) b.textContent = '1';
    // Přátelé se načítají souběžně — při otevření přes ?tab=games ještě nemusí být.
    if (!Object.keys(FRIEND_MAP).length) await new Promise(r => setTimeout(r, 1500));
    const ids = Object.keys(FRIEND_MAP);
    const docs = await Promise.all(ids.map(uid => db.collection('users').doc(uid).get().catch(() => null)));
    const rows = docs.filter(d => d?.exists && d.data().daily?.[day]?.done)
      .map(d => ({ name: (FRIEND_NICKNAMES[d.id] || {}).nickname || d.data().displayName || 'Přítel', t: d.data().daily[day] }))
      .sort((a, b) => b.t.s - a.t.s).slice(0, 5);
    fr.innerHTML = rows.length ? rows.map(r => `<div class="game-lobby"><span><b>${esc(r.name)}</b><small>${r.t.c}/${r.t.of || 10} správně</small></span><b>${r.t.s} b</b></div>`).join('')
      : '<div class="game-empty">Dnes ještě nikdo z přátel nehrál.</div>';
  } catch (_) { st.textContent = ''; fr.innerHTML = '<div class="game-empty">Nepodařilo se načíst.</div>'; }
}

// Filtr her: pro jednoho / s přáteli (hra může patřit do obou). Volba se pamatuje.
function setupGameFilters() {
  const bar = document.getElementById('gameFilters');
  if (!bar || bar._wired) return;
  bar._wired = true;
  const cards = [...document.querySelectorAll('#tab-games .game-card')];
  bar.querySelectorAll('[data-gmode]').forEach(b => {
    const m = b.dataset.gmode;
    b.querySelector('span').textContent = m === 'all' ? cards.length : cards.filter(c => c.dataset.modes.split(' ').includes(m)).length;
  });
  const apply = mode => {
    bar.querySelectorAll('[data-gmode]').forEach(b => b.classList.toggle('on', b.dataset.gmode === mode));
    cards.forEach(c => { c.hidden = mode !== 'all' && !c.dataset.modes.split(' ').includes(mode); });
    try { localStorage.setItem('games_filter', mode); } catch (_) { /* nic */ }
  };
  bar.addEventListener('click', e => { const b = e.target.closest('[data-gmode]'); if (b) apply(b.dataset.gmode); });
  let saved = 'all';
  try { saved = localStorage.getItem('games_filter') || 'all'; } catch (_) { /* nic */ }
  apply(['all', 'solo', 'multi'].includes(saved) ? saved : 'all');
}

function updateGamesBadge() {
  const n = document.querySelectorAll('#dobLobbies a.game-lobby').length;
  const b = document.getElementById('gamesCountBadge');
  if (b) b.textContent = n || '';
}

// ── Soubory ze všech místností ──────────────────────────────────
// Files live as a list on each room document (see room-files.js), and the
// room snapshot below already brings those documents — so this tab costs
// no extra reads. Read-only: uploading and removing stay inside the room.
let ALL_FILES_ROOMS = [];

const DASH_FILE_ICONS = [
  [/pdf/, '📕'], [/image|png|jpe?g|gif|webp|svg/, '🖼️'], [/zip|rar|7z|tar/, '🗜️'],
  [/word|document|[.]docx?$/, '📘'], [/sheet|excel|[.]xlsx?$/, '📗'],
  [/presentation|powerpoint|[.]pptx?$/, '📙'], [/audio|mp3|wav/, '🎵'],
  [/video|mp4|mkv|avi/, '🎬'], [/text|plain|[.]md$|[.]txt$/, '📄'],
];
function dashFileIcon(name, mime) {
  const hay = ((mime || '') + ' ' + (name || '')).toLowerCase();
  for (const [re, ico] of DASH_FILE_ICONS) if (re.test(hay)) return ico;
  return '📎';
}
function dashFileSize(bytes) {
  const n = +bytes;
  if (!n) return '';
  return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' kB' : (n / 1048576).toFixed(1) + ' MB';
}
// Links come from other members' writes — only ever render real web links.
function safeFileLink(url) { return /^https:\/\//i.test(String(url || '')) ? url : '#'; }

function setupAllFiles() {
  ['allFilesSearch', 'allFilesRoom', 'allFilesMine'].forEach(id =>
    document.getElementById(id)?.addEventListener(id === 'allFilesSearch' ? 'input' : 'change', renderAllFiles));
}

function renderAllFiles() {
  const list = document.getElementById('allFilesList');
  if (!list) return;
  const total = ALL_FILES_ROOMS.reduce((n, r) => n + r.files.length, 0);
  const badge = document.getElementById('filesCountBadge');
  if (badge) badge.textContent = total || '';

  // Room filter options (keep the current choice across re-renders)
  const sel = document.getElementById('allFilesRoom');
  const chosen = sel.value;
  sel.innerHTML = '<option value="">Všechny místnosti</option>' + ALL_FILES_ROOMS
    .filter(r => r.files.length)
    .map(r => `<option value="${esc(r.id)}">${esc(r.name)} (${r.files.length})</option>`).join('');
  sel.value = ALL_FILES_ROOMS.some(r => r.id === chosen) ? chosen : '';

  const q = (document.getElementById('allFilesSearch').value || '').trim().toLowerCase();
  const mine = document.getElementById('allFilesMine').checked;
  const uid = auth.currentUser?.uid;
  const rooms = ALL_FILES_ROOMS
    .filter(r => !sel.value || r.id === sel.value)
    .map(r => ({ ...r, files: r.files.filter(f =>
      (!mine || f.by === uid) && (!q || String(f.name || '').toLowerCase().includes(q))) }))
    .filter(r => r.files.length);

  if (!total) {
    list.innerHTML = '<div class="files-empty">V tvých místnostech zatím nikdo nic nenahrál. Soubory se nahrávají v místnosti přes 📎 Soubory.</div>';
    return;
  }
  if (!rooms.length) {
    list.innerHTML = '<div class="files-empty">Nic neodpovídá filtru.</div>';
    return;
  }

  // "Složka/Podsložka/soubor.pdf" → nested tree, folders before files, A–Z
  const tree = files => {
    const root = { dirs: {}, files: [] };
    files.forEach(f => {
      const parts = String(f.name || 'soubor').split('/').filter(Boolean);
      const leaf = parts.pop() || 'soubor';
      let node = root;
      parts.forEach(p => { node = node.dirs[p] ||= { dirs: {}, files: [] }; });
      node.files.push({ ...f, leaf });
    });
    return root;
  };
  const count = node => node.files.length + Object.values(node.dirs).reduce((n, d) => n + count(d), 0);
  const fileRow = f => `
    <div class="files-row">
      <span class="files-ico">${dashFileIcon(f.leaf, f.mime)}</span>
      <span class="files-name" title="${esc(f.name)}">${esc(f.leaf)}</span>
      <span class="files-meta">${esc(f.byName || '')}${f.size ? ' · ' + esc(dashFileSize(f.size)) : ''}${f.at ? ' · ' + esc(new Date(f.at).toLocaleDateString('cs-CZ')) : ''}</span>
      <a class="files-open" href="${esc(safeFileLink(f.link))}" target="_blank" rel="noopener">otevřít ↗</a>
    </div>`;
  const renderNode = (node, depth) =>
    Object.keys(node.dirs).sort((a, b) => a.localeCompare(b, 'cs')).map(name => `
      <details class="allfiles-dir" ${q || depth < 1 ? 'open' : ''}>
        <summary><span class="allfiles-caret"></span>📁 ${esc(name)} <span class="allfiles-count">${count(node.dirs[name])}</span></summary>
        <div class="allfiles-children">${renderNode(node.dirs[name], depth + 1)}</div>
      </details>`).join('') +
    node.files.slice().sort((a, b) => a.leaf.localeCompare(b.leaf, 'cs')).map(fileRow).join('');

  list.innerHTML = rooms.map(r => `
    <details class="allfiles-room" open style="--room-color:${esc(r.color || '#6366f1')}">
      <summary>
        <span class="allfiles-caret"></span>
        <span class="allfiles-dot"></span>
        <span class="allfiles-room-name">${esc(r.name)}</span>
        <span class="allfiles-count">${r.files.length}</span>
        <a class="allfiles-goto" href="room.html?id=${encodeURIComponent(r.id)}">otevřít místnost →</a>
      </summary>
      <div class="allfiles-children">${renderNode(tree(r.files), 0)}</div>
    </details>`).join('');
}

// ── Místnosti ───────────────────────────────────────────────────
function loadRooms(user) {
  const grid = document.getElementById('roomsGrid');
  // Favourites are needed by the card menu (right click); pinned rooms come
  // from the user's own profile and re-sort the grid when they arrive.
  if (!user.isAnonymous) BgFav.load();
  db.collection('users').doc(user.uid).get().then(snap => {
    PINNED_ROOMS = new Set((snap.exists && snap.data().pinnedRooms) || []);
    FAV_DECKS = new Set((snap.exists && snap.data().favDecks) || []);
    renderRoomGrid();
    renderFavDecks();
    DASH_DECKS.forEach(d => syncDeckHearts(d.id));
  }).catch(() => {});
  db.collection('rooms')
    .where('memberIds', 'array-contains', user.uid)
    .onSnapshot(snap => {
      if (snap.empty) {
        grid.innerHTML = `
          <div class="empty-state">
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Zatím žádné místnosti</h3>
            <p>Vytvoř novou nebo se připoj pomocí kódu.</p>
          </div>`;
        DASH_ROOMS = [];
        renderContinue();
        updateDashSummary();
        return;
      }
      const sorted = [...snap.docs].sort((a, b) => {
        const at = a.data().createdAt?.toMillis?.() || 0;
        const bt = b.data().createdAt?.toMillis?.() || 0;
        return bt - at;
      });
      DASH_ROOMS = sorted.map(doc => ({ id: doc.id, room: doc.data(), role: (doc.data().roles || {})[user.uid] || 'viewer' }));
      renderRoomGrid();
      renderContinue();
      ALL_FILES_ROOMS = sorted.map(d => ({ id: d.id, name: d.data().name || 'Místnost', color: d.data().color,
                                            files: Array.isArray(d.data().files) ? d.data().files : [] }));
      renderAllFiles();
      loadInbox(user, sorted.map(d => ({ id: d.id, name: d.data().name, color: d.data().color })));
    }, err => {
      if (err.code === 'permission-denied') {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">⏳ Firestore pravidla se aktivují… Obnovte stránku za chvíli.</div>`;
      } else {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">Chyba: ${err.message}</div>`;
      }
    });
}

// ── Inbox: unread comments across all rooms ───────────────────
// Cheap by design: notes carry a denormalised `commentCount`, and how many
// the user has already seen lives in their own roomPrefs. So "is there
// anything new" costs one filtered query per room (only notes that actually
// have comments come back) — no reading of comment threads. Only the few
// unread notes then fetch their newest comment, for the preview and to spot
// an @mention of you.
const INBOX_MAX_ROWS = 12;
let _inboxRan = false;

async function loadInbox(user, rooms) {
  if (_inboxRan || !rooms.length) return;
  _inboxRan = true;
  const wrap = document.getElementById('inboxWrap');
  if (!wrap) return;

  try {
    const prefsSnap = await db.collection('users').doc(user.uid).get();
    const roomPrefs = (prefsSnap.exists && prefsSnap.data().roomPrefs) || {};

    const perRoom = await Promise.all(rooms.map(async room => {
      const seen = (roomPrefs[room.id] || {}).commentSeen || {};
      try {
        const snap = await db.collection('rooms').doc(room.id).collection('notes')
          .where('commentCount', '>', 0).get();
        return snap.docs
          .map(d => ({ room, noteId: d.id, note: d.data() }))
          .filter(x => x.note.commentCount > (seen[x.noteId] || 0));
      } catch (_) { return []; }   // rules not published yet / no index
    }));

    const unread = perRoom.flat().slice(0, INBOX_MAX_ROWS);
    if (!unread.length) { wrap.style.display = 'none'; return; }

    // Newest comment of each unread note → preview + mention detection.
    const myNames = [user.displayName, (user.email || '').split('@')[0]]
      .filter(Boolean).flatMap(n => n.split(/\s+/)).map(inboxNorm).filter(Boolean);
    await Promise.all(unread.map(async x => {
      try {
        const c = await db.collection('rooms').doc(x.room.id).collection('notes').doc(x.noteId)
          .collection('comments').orderBy('at', 'desc').limit(1).get();
        if (!c.empty) {
          const d = c.docs[0].data();
          x.preview = d.text || '';
          x.author = d.authorName || 'Někdo';
          x.mentioned = /@([\p{L}\p{N}_.-]+)/gu.test(x.preview) &&
            (x.preview.match(/@([\p{L}\p{N}_.-]+)/gu) || [])
              .some(m => myNames.some(n => inboxNorm(m.slice(1)).startsWith(n)));
        }
      } catch (_) {}
    }));

    renderInbox(unread, user);
  } catch (_) { wrap.style.display = 'none'; }
}

function inboxNorm(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function renderInbox(items, user) {
  const wrap = document.getElementById('inboxWrap');
  const list = document.getElementById('inboxList');
  const count = document.getElementById('inboxCount');
  wrap.style.display = 'block';
  count.textContent = items.length;

  list.innerHTML = items.map(x => {
    const n = x.note;
    const title = n.title || stripHtml(n.content || '').slice(0, 60) || '(bez názvu)';
    const unread = n.commentCount - 0;
    return `<a class="inbox-row${x.mentioned ? ' mentioned' : ''}" href="room.html?id=${x.room.id}&note=${x.noteId}"
              style="--row-color:${esc(n.color || '#6366f1')}">
        <div class="inbox-main">
          <div class="inbox-title">${x.mentioned ? '<span class="inbox-at">@</span> ' : ''}${esc(title)}</div>
          <div class="inbox-sub">${esc(x.room.name || 'Místnost')}${x.preview ? ' · ' + esc(x.author) + ': ' + esc(x.preview.slice(0, 70)) : ''}</div>
        </div>
        <span class="inbox-badge">💬 ${unread}</span>
      </a>`;
  }).join('');

  document.getElementById('inboxMarkAll').onclick = async () => {
    // Mark everything shown as seen, in the user's own prefs.
    const updates = {};
    items.forEach(x => { updates[`roomPrefs.${x.room.id}.commentSeen.${x.noteId}`] = x.note.commentCount; });
    try { await db.collection('users').doc(user.uid).update(updates); } catch (_) {}
    wrap.style.display = 'none';
  };
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

// ── Hlavička nástěnky: pozdrav, hledání, řazení ─────────────────
let USER_LEARN = null;        // users/{uid}.learn — progress written by quiz.js
let DASH_ROOMS = [];          // [{ id, room, role }] in the current sort order
let ROOM_SORT = 'recent';
try { ROOM_SORT = localStorage.getItem('sb_room_sort') === 'az' ? 'az' : 'recent'; } catch (_) {}

const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';

// Czech plural: 1 místnost · 2–4 místnosti · 5+ místností
function plural(n, one, few, many) { return n === 1 ? one : (n >= 2 && n <= 4 ? few : many); }

// Rooms opened from this browser: { roomId: ms }, written by room-init.js.
function roomOpenedMap() {
  try { return JSON.parse(localStorage.getItem('sb_room_opened') || '{}') || {}; } catch (_) { return {}; }
}

function setupDashHero(user) {
  const h = new Date().getHours();
  const hello = h < 5 ? 'Dobrou noc' : h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer';
  const name = String(user.displayName || '').trim().split(/\s+/)[0];
  document.getElementById('dashGreeting').textContent = name ? `${hello}, ${name}` : hello;

  // Search filters the cards already on screen; Ctrl+K jumps into it.
  const search = document.getElementById('dashSearch');
  search.addEventListener('input', applyDashSearch);
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; applyDashSearch(); search.blur(); } });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); search.select(); }
  });

  document.querySelectorAll('[data-sort]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === ROOM_SORT);
    btn.addEventListener('click', () => {
      ROOM_SORT = btn.dataset.sort;
      try { localStorage.setItem('sb_room_sort', ROOM_SORT); } catch (_) {}
      document.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('active', b === btn));
      renderRoomGrid();
    });
  });
}

function applyDashSearch() {
  const q = document.getElementById('dashSearch').value.trim().toLowerCase();
  document.querySelectorAll('#roomsGrid .room-card, #favRoomsGrid .room-card, #decksGrid .deck-card, #favDecksGrid .deck-card').forEach(card => {
    card.style.display = !q || card.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  const cont = document.getElementById('dashContinue');
  if (cont) cont.style.display = q ? 'none' : '';
}

// Oblíbené místnosti (pravé kliknutí na kartu) mají vlastní sekci nad
// „Všemi místnostmi“. Uložené jsou v users/{uid}.pinnedRooms.
let PINNED_ROOMS = new Set();

function sortDashRooms() {
  const opened = roomOpenedMap();
  const created = r => r.room.createdAt?.toMillis?.() || 0;
  DASH_ROOMS.sort(ROOM_SORT === 'az'
    ? (a, b) => String(a.room.name || '').localeCompare(String(b.room.name || ''), 'cs')
    : (a, b) => (opened[b.id] || 0) - (opened[a.id] || 0) || created(b) - created(a));
}

async function toggleRoomPin(id) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const on = !PINNED_ROOMS.has(id);
  if (on) PINNED_ROOMS.add(id); else PINNED_ROOMS.delete(id);
  renderRoomGrid();
  try {
    await db.collection('users').doc(uid).set({
      pinnedRooms: on ? firebase.firestore.FieldValue.arrayUnion(id) : firebase.firestore.FieldValue.arrayRemove(id),
    }, { merge: true });
    toast(on ? 'Přidáno do oblíbených.' : 'Odebráno z oblíbených.');
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
}

// Right click (long press on a phone) on a room card.
function openRoomCardMenu(x, y, id, room, role) {
  document.getElementById('roomCardMenu')?.remove();
  const art = BgGen.isRecipe(room.cardArt) ? room.cardArt : '';
  const anon = auth.currentUser?.isAnonymous;
  const fav = art && BgFav.has('karta', art);
  const items = [
    ['open', 'Otevřít'],
    ['tab', 'Otevřít v nové kartě'],
    ['pin', PINNED_ROOMS.has(id) ? '♥ Odebrat z oblíbených' : '♡ Přidat do oblíbených'],
    ...(art && !anon ? [['fav', fav ? '🖼 Odebrat obrázek pozadí z uložených' : '🖼 Uložit obrázek pozadí']] : []),
    ...(role === 'owner' ? [['edit', '✏️ Upravit kartu']] : []),
  ];
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'roomCardMenu';
  menu.innerHTML = items.map(([a, t]) => `<button type="button" class="context-menu-item" data-a="${a}">${esc(t)}</button>`).join('');
  document.body.appendChild(menu);
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top  = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    menu.remove();
    const href = 'room.html?id=' + encodeURIComponent(id);
    if (a === 'open') location.href = href;
    if (a === 'tab') window.open(href, '_blank', 'noopener');
    if (a === 'pin') toggleRoomPin(id);
    if (a === 'edit') openEditRoomModal(id, room);
    if (a === 'fav') {
      const msg = await BgFav.toggle('karta', art);
      if (msg) { toast(msg); return; }
      toast(BgFav.has('karta', art) ? 'Obrázek pozadí uložen — najdeš ho při úpravě karty.' : 'Obrázek pozadí odebrán z uložených.');
    }
  });
  setTimeout(() => {
    const away = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', away, true); } };
    document.addEventListener('pointerdown', away, true);
  }, 0);
}

function renderRoomGrid() {
  const grid = document.getElementById('roomsGrid');
  if (!DASH_ROOMS.length) return;
  sortDashRooms();
  grid.innerHTML = '';
  const favWrap = document.getElementById('favRoomsWrap');
  const favGrid = document.getElementById('favRoomsGrid');
  const favs = DASH_ROOMS.filter(r => PINNED_ROOMS.has(r.id));
  if (favWrap && favGrid) {
    favWrap.hidden = !favs.length;
    favGrid.innerHTML = '';
    favs.forEach(r => favGrid.appendChild(buildRoomCard(r.id, r.room, r.role)));
  }
  // Oblíbené jsou jen zástupci — ve „Všech“ zůstávají taky.
  DASH_ROOMS.forEach(r => grid.appendChild(buildRoomCard(r.id, r.room, r.role)));
  applyDashSearch();
}

function updateDashSummary() {
  const n = DASH_ROOMS.length;
  const due = Object.values(dueByDeck()).reduce((a, b) => a + b, 0);
  const parts = [`${n} ${plural(n, 'místnost', 'místnosti', 'místností')}`];
  if (due) parts.push(`${due} ${plural(due, 'karta', 'karty', 'karet')} k opakování`);
  document.getElementById('dashSummary').textContent = parts.join(' · ');
  const badge = document.getElementById('roomsCountBadge');
  if (badge) badge.textContent = n || '';
}

// "Pokračovat": the room last opened from this browser, else the newest one.
function renderContinue() {
  const box = document.getElementById('dashContinue');
  if (!box) return;
  if (!DASH_ROOMS.length) { box.innerHTML = ''; return; }
  const opened = roomOpenedMap();
  const last = DASH_ROOMS.filter(r => opened[r.id]).sort((a, b) => opened[b.id] - opened[a.id])[0];
  const pick = last || DASH_ROOMS.slice().sort((a, b) => (b.room.createdAt?.toMillis?.() || 0) - (a.room.createdAt?.toMillis?.() || 0))[0];
  const room = pick.room;
  const members = (room.memberIds || []).length;
  const fileCount = Array.isArray(room.files) ? room.files.length : 0;
  const meta = [`${members} ${plural(members, 'člen', 'členové', 'členů')}`];
  if (fileCount) meta.push(`${fileCount} ${plural(fileCount, 'soubor', 'soubory', 'souborů')}`);
  box.innerHTML = `
    <a class="continue-card" href="room.html?id=${encodeURIComponent(pick.id)}" style="--card-color:${esc(room.color || '#6366f1')}">
      <div class="continue-art"></div>
      <div class="continue-body">
        <span class="eyebrow">${last ? 'Naposledy otevřené' : 'Nejnovější místnost'}</span>
        <span class="continue-name">${esc(room.name)}</span>
        <span class="continue-meta">${meta.join(' · ')}</span>
        <span class="continue-go">Pokračovat
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
    </a>
    <div class="review-panel" id="reviewPanel"></div>`;
  if (BgGen.isRecipe(room.cardArt)) {
    BgGen.toUrl(room.cardArt, 'karta').then(url => {
      if (url) box.querySelector('.continue-art')?.style.setProperty('--card-art', `url("${url}")`);
    });
  }
  renderReview();
}

// deckId → number of cards due now (only cards already studied have a due date)
function dueByDeck() {
  const now = Date.now(), out = {};
  Object.entries(USER_LEARN || {}).forEach(([deckId, d]) => {
    const n = Object.values(d?.cards || {}).filter(c => c && c.due && c.due <= now).length;
    if (n) out[deckId] = n;
  });
  return out;
}

const DECK_NAME_CACHE = {};
// "K opakování dnes" — na kartě Místnosti (vedle „Naposledy otevřené“) i
// nahoře na kartě Flash Cards. V Místnostech jen 4 nejvíc zralé balíčky a
// tlačítko na všechny; ve Flash Cards celý seznam.
async function renderReview() {
  updateDashSummary();
  const panels = [
    { el: document.getElementById('reviewPanel'), max: 4, link: true },
    { el: document.getElementById('reviewPanelFlash'), max: 12, link: false },
  ].filter(p => p.el);
  if (!panels.length) return;
  const head = '<span class="eyebrow">K opakování dnes</span>';
  if (USER_LEARN === null) { panels.forEach(p => { p.el.innerHTML = head + '<div class="review-empty">Načítám…</div>'; }); return; }
  const allDue = Object.entries(dueByDeck()).sort((a, b) => b[1] - a[1]);
  await Promise.all(allDue.slice(0, 12).map(async ([id]) => {
    if (DECK_NAME_CACHE[id]) return;
    try {
      const snap = await db.collection('decks').doc(id).get();
      DECK_NAME_CACHE[id] = snap.exists ? { name: snap.data().name, color: snap.data().color } : { gone: true };
    } catch (_) { DECK_NAME_CACHE[id] = { gone: true }; }
  }));
  const live = allDue.filter(([id]) => !DECK_NAME_CACHE[id]?.gone);
  panels.forEach(p => {
    const rows = live.slice(0, p.max);
    p.el.innerHTML = head + (rows.map(([id, n]) => `
        <a class="review-row" href="quiz.html?deck=${encodeURIComponent(id)}&smart=1">
          <span class="review-dot" style="background:${esc(DECK_NAME_CACHE[id]?.color || '#8B93FF')}"></span>
          <span class="review-name">${esc(DECK_NAME_CACHE[id]?.name || 'Balíček')}</span>
          <span class="review-count">${n} ${plural(n, 'karta', 'karty', 'karet')}</span>
        </a>`).join('') || '<div class="review-empty">Dnes nemáš nic k opakování.</div>') +
      (p.link ? `<button type="button" class="btn btn-secondary review-all" data-goto-tab="flash">${rows.length ? 'Všechny balíčky' : 'Otevřít Flash Cards'}</button>` : '');
    p.el.querySelector('[data-goto-tab]')?.addEventListener('click', () =>
      document.querySelector('.tab-btn[data-tab="flash"]')?.click());
  });
}

function buildRoomCard(id, room, role) {
  const labels = { owner: 'Vlastník', editor: 'Editor', viewer: 'Prohlížeč' };
  const a = document.createElement('a');
  a.href = `room.html?id=${id}`;
  a.className = 'room-card';
  a.style.setProperty('--card-color', room.color || '#6366f1');
  const art = BgGen.isRecipe(room.cardArt) ? room.cardArt : '';
  if (art) {
    // Only the recipe is stored on the room; the picture is drawn here.
    a.classList.add('has-art');
    BgGen.toUrl(art, 'karta').then(url => { if (url) a.style.setProperty('--card-art', `url("${url}")`); });
  }
  const members = (room.memberIds || []).length;
  const meta = members > 1 ? `${members} ${plural(members, 'člen', 'členové', 'členů')}` : fmtDate(room.createdAt);
  a.innerHTML = `
    <div class="room-card-art"><span class="room-card-dot"></span></div>
    ${role === 'owner' ? `<button class="card-edit-btn" data-edit-room="${id}" title="Upravit kartu" aria-label="Upravit kartu">${ICON_PENCIL}</button>` : ''}
    <div class="room-card-body">
      <h3>${esc(room.name)}</h3>
      ${room.description ? `<p class="card-desc">${esc(room.description)}</p>` : ''}
      <div class="room-card-meta">
        <span class="role-badge role-${role}">${labels[role] || role}</span>
        <span class="meta-date">${esc(meta)}</span>
      </div>
    </div>`;
  wireCardMenu(a, (x, y) => openRoomCardMenu(x, y, id, room, role));
  const editBtn = a.querySelector('[data-edit-room]');
  if (editBtn) {
    editBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      openEditRoomModal(id, room);
    });
  }
  return a;
}

// ── Obrázek karty místnosti ─────────────────────────────────────
// room.cardArt holds a generator recipe (js/bggen.js), never the image.
let EDIT_ROOM_ART = '';
let EDIT_ROOM_ART_VARIANTS = [];

function setupEditRoom() {
  setupColorInput('editRoomColorInput', 'editRoomColorSwatch', 'editRoomColorHex');
  document.getElementById('editRoomArtReroll').addEventListener('click', () => {
    EDIT_ROOM_ART_VARIANTS = Array.from({ length: 6 }, () => BgGen.random());
    renderEditRoomArt();
  });
  document.getElementById('editRoomSubmit').addEventListener('click', async () => {
    const id    = document.getElementById('editRoomSubmit').dataset.roomId;
    const color = document.getElementById('editRoomColorInput').value;
    try {
      await db.collection('rooms').doc(id).update({
        color,
        cardArt: EDIT_ROOM_ART || firebase.firestore.FieldValue.delete(),
      });
      closeModal('editRoomModal');
      toast('Karta uložena!');
    } catch (e) { toast('Chyba: ' + e.message); }
  });
}

function cardArtTile(recipe, label) {
  const p = BgGen.parse(recipe);
  const name = label || (p ? `${p.style.name.replace(/ \(.*\)| –.*/, '')} · ${p.palette.name}` : '');
  const fav = recipe && BgFav.has('karta', recipe);
  return `
    <div class="card-art-opt${recipe === EDIT_ROOM_ART ? ' selected' : ''}" data-art="${esc(recipe)}" role="button" tabindex="0">
      <span class="card-art-img"></span>
      <span class="card-art-name">${esc(name)}</span>
      ${recipe ? `<button type="button" class="room-bg-fav${fav ? ' on' : ''}" title="Oblíbené">${fav ? '♥' : '♡'}</button>` : ''}
    </div>`;
}

function renderEditRoomArt() {
  const box = document.getElementById('editRoomArt');
  const favs = (BgFav.items || []).filter(it => it.k === 'karta').map(it => it.r);
  const head = t => `<div class="card-art-head">${t}</div>`;
  box.innerHTML =
    head('Vygenerované') + cardArtTile('', 'Bez obrázku') + EDIT_ROOM_ART_VARIANTS.map(r => cardArtTile(r)).join('') +
    (EDIT_ROOM_ART && !EDIT_ROOM_ART_VARIANTS.includes(EDIT_ROOM_ART) && !favs.includes(EDIT_ROOM_ART)
      ? head('Aktuální') + cardArtTile(EDIT_ROOM_ART) : '') +
    head(`Oblíbené (${favs.length}/${BG_FAV_MAX})`) +
    (favs.length ? favs.map(r => cardArtTile(r)).join('')
      : '<p class="room-bg-empty">Srdíčkem ♡ si ulož obrázek, který se ti líbí — i z karty cizí místnosti.</p>');
  box.querySelectorAll('.card-art-opt').forEach(opt => {
    const recipe = opt.dataset.art;
    const img = opt.querySelector('.card-art-img');
    if (recipe) BgGen.toUrl(recipe, 'karta', 0.3).then(url => { if (url) img.style.backgroundImage = `url("${url}")`; });
    opt.addEventListener('click', () => {
      EDIT_ROOM_ART = recipe;
      box.querySelectorAll('.card-art-opt').forEach(o => o.classList.toggle('selected', o.dataset.art === recipe));
    });
    opt.querySelector('.room-bg-fav')?.addEventListener('click', async e => {
      e.stopPropagation();
      const msg = await BgFav.toggle('karta', recipe);
      if (msg) { toast(msg); return; }
      renderEditRoomArt();
    });
  });
}

async function openEditRoomModal(id, room) {
  document.getElementById('editRoomSubmit').dataset.roomId = id;
  const color = room.color || '#6366f1';
  document.getElementById('editRoomColorInput').value = color;
  document.getElementById('editRoomColorSwatch').style.background = color;
  document.getElementById('editRoomColorHex').textContent = color;
  EDIT_ROOM_ART = BgGen.isRecipe(room.cardArt) ? room.cardArt : '';
  if (!EDIT_ROOM_ART_VARIANTS.length) EDIT_ROOM_ART_VARIANTS = Array.from({ length: 6 }, () => BgGen.random());
  await BgFav.load();
  renderEditRoomArt();
  openModal('editRoomModal');
}

// ── Vytvořit místnost ───────────────────────────────────────────
function setupCreate(user) {
  document.getElementById('createBtn').addEventListener('click', () => openModal('createModal'));
  setupColorInput('roomColorInput', 'roomColorSwatch', 'roomColorHex');

  document.getElementById('createSubmit').addEventListener('click', async () => {
    const name  = document.getElementById('roomName').value.trim();
    const desc  = document.getElementById('roomDesc').value.trim();
    const color = document.getElementById('roomColorInput').value;
    if (!name) { toast('Zadej název místnosti.'); return; }
    const btn = document.getElementById('createSubmit');
    btn.disabled = true; btn.textContent = 'Vytváření...';
    try {
      const code = genCode();
      const ref  = await db.collection('rooms').add({
        name, color,
        description: desc || null,
        ownerId:    user.uid,
        inviteCode: code,
        memberIds:  [user.uid],
        roles:      { [user.uid]: 'owner' },
        members:    { [user.uid]: { displayName: user.displayName || user.email, email: user.email, photoURL: user.photoURL || null } },
        createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeModal('createModal');
      document.getElementById('roomName').value = '';
      document.getElementById('roomDesc').value = '';
      window.location.href = `room.html?id=${ref.id}`;
    } catch (e) {
      toast('Chyba: ' + e.message);
      btn.disabled = false; btn.textContent = 'Vytvořit';
    }
  });
}

// ── Připojit se ─────────────────────────────────────────────────
function setupJoin(user) {
  document.getElementById('joinBtn').addEventListener('click', () => openModal('joinModal'));

  document.getElementById('joinSubmit').addEventListener('click', async () => {
    const code  = document.getElementById('joinCode').value.trim().toUpperCase();
    const errEl = document.getElementById('joinError');
    errEl.style.display = 'none';
    if (code.length !== 6) { errEl.textContent = 'Kód musí mít 6 znaků.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('joinSubmit');
    btn.disabled = true; btn.textContent = 'Hledám...';
    try {
      const snap = await db.collection('rooms').where('inviteCode', '==', code).limit(1).get();
      if (snap.empty) {
        errEl.textContent = 'Místnost nenalezena.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Připojit se'; return;
      }
      const roomDoc = snap.docs[0];
      const data    = roomDoc.data();
      if ((data.memberIds || []).includes(user.uid)) {
        closeModal('joinModal');
        window.location.href = `room.html?id=${roomDoc.id}`; return;
      }
      const joinUpdate = {
        memberIds:              firebase.firestore.FieldValue.arrayUnion(user.uid),
        [`roles.${user.uid}`]:  'viewer',
        [`members.${user.uid}`]: {
          displayName: user.isAnonymous ? 'Host' : (user.displayName || user.email),
          email: user.email || null, photoURL: user.photoURL || null,
          isAnon: !!user.isAnonymous,
        },
      };
      // Anonymous guests get at most 1 hour of membership (enforced on room load)
      if (user.isAnonymous) joinUpdate[`memberExpiry.${user.uid}`] = Date.now() + 3600000;
      await roomDoc.ref.update(joinUpdate);
      closeModal('joinModal');
      window.location.href = `room.html?id=${roomDoc.id}`;
    } catch (e) {
      errEl.textContent = 'Chyba: ' + e.message;
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Připojit se';
    }
  });
}

// ── Flash Cards – balíčky ───────────────────────────────────────
async function loadDecks(user) {
  const grid = document.getElementById('decksGrid');
  grid.innerHTML = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:12px;padding:60px;color:var(--text-muted);"><div class="spinner"></div> Načítám...</div>`;

  try {
    // Načti místnosti uživatele a osobní balíčky paralelně
    const [roomsSnap, personalSnap] = await Promise.all([
      db.collection('rooms').where('memberIds', 'array-contains', user.uid).get(),
      db.collection('decks').where('ownerUid', '==', user.uid).get(),
    ]);

    const roomMap = {};
    roomsSnap.docs.forEach(d => { roomMap[d.id] = d.data(); });
    const roomIds = Object.keys(roomMap);

    // Balíčky z místností (kde uživatel není vlastník balíčku)
    const roomDeckSnaps = await Promise.all(
      roomIds.map(rid => db.collection('decks').where('roomId', '==', rid).get())
    );

    // Slouč a odstraň duplikáty
    const allDocs = new Map();
    personalSnap.docs.forEach(d => allDocs.set(d.id, d));
    roomDeckSnaps.forEach(snap => snap.docs.forEach(d => allDocs.set(d.id, d)));

    const sorted = [...allDocs.values()].sort((a, b) =>
      (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
    );

    if (!sorted.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3>Žádné balíčky</h3>
          <p>Vytvoř si první balíček flash cards nebo ho najdeš v místnosti.</p>
        </div>`;
      return;
    }

    grid.innerHTML = '';
    DASH_DECKS = [];
    sorted.forEach(doc => {
      const deck      = doc.data();
      const room      = deck.roomId ? roomMap[deck.roomId] : null;
      const ownerName = room ? (room.members?.[deck.ownerUid]?.displayName || null) : null;
      DASH_DECKS.push({ id: doc.id, deck, roomName: room?.name || null, ownerName });
      grid.appendChild(buildDeckCard(doc.id, deck, room?.name || null, ownerName, user.uid));
    });
    renderFavDecks();
  } catch (e) {
    if (e.code !== 'permission-denied') {
      grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">Chyba: ${e.message}</div>`;
    }
  }
}

// ── Oblíbené balíčky ──────────────────────────────────────────
// Pravé kliknutí (na telefonu podržení) na balíček → „Přidat do oblíbených“.
// Zástupce nahoře v sekci Oblíbené; balíček zůstává i ve Všech.
let FAV_DECKS = new Set();
let DASH_DECKS = [];

function renderFavDecks() {
  const wrap = document.getElementById('favDecksWrap');
  const grid = document.getElementById('favDecksGrid');
  if (!wrap || !grid) return;
  const favs = DASH_DECKS.filter(d => FAV_DECKS.has(d.id));
  wrap.hidden = !favs.length;
  grid.innerHTML = '';
  const uid = auth.currentUser?.uid;
  favs.forEach(d => grid.appendChild(buildDeckCard(d.id, d.deck, d.roomName, d.ownerName, uid)));
}

async function toggleDeckFav(id) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const on = !FAV_DECKS.has(id);
  if (on) FAV_DECKS.add(id); else FAV_DECKS.delete(id);
  renderFavDecks();
  syncDeckHearts(id);
  try {
    await db.collection('users').doc(uid).set({
      favDecks: on ? firebase.firestore.FieldValue.arrayUnion(id) : firebase.firestore.FieldValue.arrayRemove(id),
    }, { merge: true });
    toast(on ? 'Balíček přidán do oblíbených.' : 'Balíček odebrán z oblíbených.');
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
}

function openDeckCardMenu(x, y, id, deck, isOwner) {
  document.getElementById('roomCardMenu')?.remove();
  const items = [
    ['open', 'Otevřít'],
    ['tab', 'Otevřít v nové kartě'],
    ['fav', FAV_DECKS.has(id) ? '♥ Odebrat z oblíbených' : '♡ Přidat do oblíbených'],
    ...(isOwner ? [['edit', '✏️ Upravit balíček']] : []),
  ];
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'roomCardMenu';
  menu.innerHTML = items.map(([a, t]) => `<button type="button" class="context-menu-item" data-a="${a}">${esc(t)}</button>`).join('');
  document.body.appendChild(menu);
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top  = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    menu.remove();
    const href = 'flashcards.html?deck=' + encodeURIComponent(id);
    if (a === 'open') location.href = href;
    if (a === 'tab') window.open(href, '_blank', 'noopener');
    if (a === 'fav') toggleDeckFav(id);
    if (a === 'edit') openEditDeckModal(id, deck);
  });
  setTimeout(() => {
    const away = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', away, true); } };
    document.addEventListener('pointerdown', away, true);
  }, 0);
}

// Pravé kliknutí + podržení prstem na kartě (místnost i balíček).
function wireCardMenu(el, open) {
  el.addEventListener('contextmenu', e => { e.preventDefault(); open(e.clientX, e.clientY); });
  let pressT = null, pressed = false;
  el.addEventListener('touchstart', e => {
    pressed = false;
    const t = e.touches[0];
    pressT = setTimeout(() => { pressed = true; open(t.clientX, t.clientY); }, 550);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev => el.addEventListener(ev, () => clearTimeout(pressT), { passive: true }));
  el.addEventListener('click', e => { if (pressed) { e.preventDefault(); pressed = false; } });
}

const ICON_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>';

function syncDeckHearts(id) {
  document.querySelectorAll(`[data-fav-deck="${id}"]`).forEach(b => {
    const on = FAV_DECKS.has(id);
    b.classList.toggle('on', on);
    b.title = on ? 'Odebrat z oblíbených' : 'Přidat do oblíbených';
  });
}

function buildDeckCard(id, deck, roomName, ownerName, myUid) {
  const a = document.createElement('a');
  a.href      = `flashcards.html?deck=${id}`;
  a.className = 'deck-card';
  a.style.setProperty('--card-color', deck.color || '#6366f1');

  const contextTag = roomName
    ? `<span class="deck-tag deck-tag-room">📂 ${esc(roomName)}</span>`
    : `<span class="deck-tag deck-tag-personal">Osobní</span>`;

  const ownerTag = ownerName && deck.ownerUid !== myUid
    ? `<span class="deck-tag deck-tag-owner">👤 ${esc(ownerName)}</span>`
    : '';

  const isOwner = deck.ownerUid === myUid;
  a.innerHTML = `
    ${isOwner ? `<button class="card-edit-btn" data-edit-deck="${id}" title="Upravit balíček" aria-label="Upravit balíček">${ICON_PENCIL}</button>` : ''}
    <button class="card-fav-btn${FAV_DECKS.has(id) ? ' on' : ''}" data-fav-deck="${id}" title="${FAV_DECKS.has(id) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}" aria-label="Oblíbený balíček">${ICON_HEART}</button>
    <h3>${esc(deck.name)}</h3>
    ${deck.description ? `<p class="card-desc">${esc(deck.description)}</p>` : ''}
    <p style="margin-bottom:8px;">${deck.cardCount || 0} karet</p>
    <div class="deck-tags">${contextTag}${ownerTag}</div>`;
  wireCardMenu(a, (x, y) => openDeckCardMenu(x, y, id, deck, isOwner));
  a.querySelector('[data-fav-deck]').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    toggleDeckFav(id);
  });
  const editBtn = a.querySelector('[data-edit-deck]');
  if (editBtn) {
    editBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      openEditDeckModal(id, deck);
    });
  }
  return a;
}

function setupEditDeck() {
  setupColorInput('editDeckColorInput', 'editDeckColorSwatch', 'editDeckColorHex');
  document.getElementById('editDeckSubmit').addEventListener('click', async () => {
    const id    = document.getElementById('editDeckSubmit').dataset.deckId;
    const name  = document.getElementById('editDeckName').value.trim();
    const color = document.getElementById('editDeckColorInput').value;
    if (!name) { toast('Zadej název balíčku.'); return; }
    try {
      await db.collection('decks').doc(id).update({ name, color });
      closeModal('editDeckModal');
      toast('Balíček uložen!');
    } catch (e) { toast('Chyba: ' + e.message); }
  });
}

function openEditDeckModal(id, deck) {
  document.getElementById('editDeckSubmit').dataset.deckId = id;
  document.getElementById('editDeckName').value = deck.name || '';
  const color = deck.color || '#6366f1';
  document.getElementById('editDeckColorInput').value = color;
  document.getElementById('editDeckColorSwatch').style.background = color;
  document.getElementById('editDeckColorHex').textContent = color;
  openModal('editDeckModal');
}

function setupNewDeck(user) {
  document.getElementById('newDeckBtn').addEventListener('click', () => openModal('newDeckModal'));
  setupColorInput('deckColorInput', 'deckColorSwatch', 'deckColorHex');

  document.getElementById('deckSubmit').addEventListener('click', async () => {
    const name  = document.getElementById('deckName').value.trim();
    const desc  = document.getElementById('deckDesc').value.trim();
    const color = document.getElementById('deckColorInput').value;
    if (!name) { toast('Zadej název balíčku.'); return; }
    const btn = document.getElementById('deckSubmit');
    btn.disabled = true; btn.textContent = 'Vytváření...';
    try {
      const ref = await db.collection('decks').add({
        name, color,
        description: desc || null,
        ownerUid:  user.uid,
        roomId:    null,
        cardCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      closeModal('newDeckModal');
      document.getElementById('deckName').value = '';
      document.getElementById('deckDesc').value = '';
      window.location.href = `flashcards.html?deck=${ref.id}`;
    } catch (e) {
      toast('Chyba: ' + e.message);
      btn.disabled = false; btn.textContent = 'Vytvořit balíček';
    }
  });
}

// ── Přátelé ─────────────────────────────────────────────────────
// Friendship membership is derived purely from *accepted* friendRequests
// docs (uid -> reqId), never mirrored onto the other user's doc — Firestore
// rules only allow a user to write their own /users/{uid} doc, so a batch
// that tried to also write `friends.*` onto the OTHER party's doc always
// failed the whole batch atomically ("Missing or insufficient permissions"),
// silently blocking every accept/remove. Nicknames still live on your own
// doc (that's a self-write, always fine).
let FRIEND_NICKNAMES = {};
let FRIEND_MAP = {}; // uid -> friendRequest doc id (the relation to delete on "remove")

function loadFriends(user) {
  let _lbT = null;
  const render = () => {
    renderFriendsList(user.uid, FRIEND_MAP, FRIEND_NICKNAMES);
    clearTimeout(_lbT); _lbT = setTimeout(() => renderLeaderboard(user.uid, Object.keys(FRIEND_MAP), FRIEND_NICKNAMES), 400);
  };

  db.collection('users').doc(user.uid).onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    FRIEND_NICKNAMES = data.friends || {};

    const codeEl = document.getElementById('myFriendCode');
    if (codeEl && data.friendCode) codeEl.textContent = data.friendCode;

    render();
  });

  const watchAccepted = (field, otherField) =>
    db.collection('friendRequests')
      .where(field, '==', user.uid).where('status', '==', 'accepted')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          const otherUid = ch.doc.data()[otherField];
          if (ch.type === 'removed') delete FRIEND_MAP[otherUid];
          else FRIEND_MAP[otherUid] = ch.doc.id;
        });
        render();
      }, () => {});
  watchAccepted('fromUid', 'toUid');
  watchAccepted('toUid', 'fromUid');

  document.getElementById('copyFriendCode').addEventListener('click', () => {
    const code = document.getElementById('myFriendCode').textContent;
    if (code && code !== '------') {
      navigator.clipboard.writeText(code).then(() => toast('Kód zkopírován!'));
    }
  });

  document.getElementById('copyFriendLink').addEventListener('click', () => {
    const code = document.getElementById('myFriendCode').textContent;
    if (!code || code === '------') return;
    const url = new URL('dashboard.html', window.location.href);
    url.searchParams.set('addFriend', code);
    navigator.clipboard.writeText(url.href).then(() => toast('Odkaz zkopírován!'));
  });

  // Otevřený přes pozvánkový odkaz (?addFriend=CODE) — přepni na záložku
  // Přátelé a předvyplň kód, ať jen kliknou na "Odeslat žádost".
  const wantTab = new URLSearchParams(window.location.search).get('tab');
  if (wantTab) document.querySelector(`.tab-btn[data-tab="${wantTab}"]`)?.click();
  const addFriendCode = new URLSearchParams(window.location.search).get('addFriend');
  if (addFriendCode) {
    document.querySelector('.tab-btn[data-tab="friends"]')?.click();
    document.getElementById('friendCodeInput').value = addFriendCode.toUpperCase();
  }

  // Sleduj příchozí žádosti
  db.collection('friendRequests')
    .where('toUid', '==', user.uid)
    .onSnapshot(snap => {
      const pending = snap.docs.filter(d => d.data().status === 'pending');
      const badge   = document.getElementById('reqBadge');
      badge.textContent = pending.length;
      badge.classList.toggle('show', pending.length > 0);
      renderRequests(user, snap.docs);
    }, () => { /* pravidla ještě nejsou plně propagována – tiše ignoruj */ });
}

// ── Žebříček týdne ──────────────────────────────────────────────
// Ze sdílených profilů (users/{uid}): learn.{deck}.stats.days (kvízy) a
// play.{den}.p (body ze her). Dny jsou v UTC, stejně jako je zapisují hry.
function weekKeys(n = 7) {
  const out = []; for (let i = 0; i < n; i++) out.push(new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10)); return out;
}
function weeklyScore(profile) {
  const days = weekKeys(), allDays = weekKeys(60);
  let answers = 0, correct = 0, games = 0;
  const active = new Set();
  Object.values(profile.learn || {}).forEach(d => {
    const st = (d && d.stats && d.stats.days) || {};
    Object.entries(st).forEach(([k, v]) => {
      if ((v.a || 0) > 0) active.add(k);
      if (days.includes(k)) { answers += v.a || 0; correct += v.c || 0; }
    });
  });
  Object.entries(profile.play || {}).forEach(([k, v]) => {
    if ((v.p || 0) > 0) active.add(k);
    if (days.includes(k)) games += v.p || 0;
  });
  // 🍅 pomodoro: sekundy učení za den (pomodoro.js)
  let focus = 0;
  Object.entries(profile.focus || {}).forEach(([k, v]) => {
    if ((v || 0) >= 300) active.add(k);
    if (days.includes(k)) focus += v || 0;
  });
  const focusMin = Math.floor(focus / 60);
  // dní v řadě (dnes, nebo když dnes ještě nic, tak od včerejška)
  let streak = 0, i = active.has(allDays[0]) ? 0 : 1;
  for (; i < allDays.length && active.has(allDays[i]); i++) streak++;
  return { points: answers + 2 * correct + games + Math.floor(focusMin / 5), answers, correct, games, focusMin, streak };
}
async function renderLeaderboard(myUid, friendIds, nicknames) {
  const el = document.getElementById('lbList');
  if (!el) return;
  try {
    const ids = [myUid, ...friendIds.filter(x => x !== myUid)];
    const docs = await Promise.all(ids.map(uid => db.collection('users').doc(uid).get()));
    const rows = docs.filter(d => d.exists).map(d => {
      const p = d.data();
      const name = (nicknames[d.id] || {}).nickname || p.displayName || 'Přítel';
      return { uid: d.id, name, photo: p.photoURL, tree: typeof gardenEmoji === 'function' ? gardenEmoji(p.garden) : '', ...weeklyScore(p) };
    }).sort((a, b) => b.points - a.points || b.streak - a.streak);
    if (rows.length < 2) {
      el.innerHTML = rows.map(r => lbRow(r, 0, myUid)).join('') + '<div class="lb-empty">Přidej si přátele a soutěžte, kdo se tento týden naučí víc.</div>';
      return;
    }
    el.innerHTML = rows.map((r, i) => lbRow(r, i, myUid)).join('');
  } catch (e) { el.innerHTML = '<div class="lb-empty">Žebříček se nepodařilo načíst.</div>'; }
}
function lbRow(r, i, myUid) {
  const medal = (r.points > 0 && ['🥇', '🥈', '🥉'][i]) || `<span class="lb-n">${i + 1}.</span>`;
  const acc = r.answers ? Math.round(r.correct / r.answers * 100) : null;
  return `<div class="lb-row${r.uid === myUid ? ' me' : ''}">
    <span class="lb-medal">${medal}</span>
    <span class="lb-av">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : esc((r.name || '?')[0].toUpperCase())}</span>
    <span class="lb-name"><b>${esc(r.name)}${r.uid === myUid ? ' <small>(ty)</small>' : ''}${r.tree ? ` <span class="lb-tree" title="Zahrada">${r.tree}</span>` : ''}</b>
      <small>${r.answers} odpovědí${acc !== null ? ` · ${acc} % správně` : ''}${r.games ? ` · ${r.games} b ze her` : ''}${r.focusMin ? ` · 🍅 ${r.focusMin >= 60 ? Math.floor(r.focusMin / 60) + ' h ' + (r.focusMin % 60) : r.focusMin} min` : ''}</small></span>
    ${r.streak ? `<span class="lb-streak" title="${r.streak} dní v řadě">🔥 ${r.streak}</span>` : ''}
    <span class="lb-points">${r.points}<small> b</small></span>
  </div>`;
}

function renderFriendsList(myUid, friendMap, nicknames) {
  const el  = document.getElementById('friendsList');
  const ids = Object.keys(friendMap);
  if (!ids.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.875rem;padding:8px 0;">Žádní přátelé zatím.</div>`;
    return;
  }
  // Načti profily přátel
  const promises = ids.map(uid => db.collection('users').doc(uid).get());
  Promise.all(promises).then(docs => {
    el.innerHTML = '';
    docs.forEach(doc => {
      if (!doc.exists) return;
      const p     = doc.data();
      const nick  = (nicknames[doc.id] || {}).nickname || '';
      const row   = document.createElement('div');
      row.className = 'friend-row';
      row.innerHTML = `
        <div class="f-av">${p.photoURL ? `<img src="${p.photoURL}" alt="">` : initial(p.displayName || p.email)}</div>
        <div class="f-info">
          <div class="f-name">${esc(p.displayName || p.email)}</div>
          ${nick ? `<div class="f-nick">✦ ${esc(nick)}</div>` : ''}
          <div class="f-email">${esc(p.email || '')}</div>
          <div class="nick-row" id="nickRow-${doc.id}" style="display:none;">
            <input class="nick-input" id="nickInput-${doc.id}" type="text" placeholder="Přezdívka..." value="${esc(nick)}" maxlength="30">
            <button class="btn btn-primary" style="padding:3px 10px;font-size:0.75rem;" data-save-nick="${doc.id}">Uložit</button>
            <button class="btn btn-ghost"   style="padding:3px 8px;font-size:0.75rem;"  data-hide-nick="${doc.id}">✕</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:0.72rem;" data-edit-nick="${doc.id}">✏️ Přezdívka</button>
          <button class="btn btn-ghost" style="padding:3px 8px;font-size:0.72rem;color:#fca5a5;" data-remove-friend="${doc.id}">Odebrat</button>
        </div>`;
      el.appendChild(row);
    });

    // Edit nickname
    el.querySelectorAll('[data-edit-nick]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('nickRow-' + btn.dataset.editNick).style.display = 'flex';
      });
    });
    el.querySelectorAll('[data-hide-nick]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('nickRow-' + btn.dataset.hideNick).style.display = 'none';
      });
    });
    el.querySelectorAll('[data-save-nick]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid  = btn.dataset.saveNick;
        const nick = document.getElementById('nickInput-' + uid).value.trim();
        try {
          await db.collection('users').doc(myUid).update({
            [`friends.${uid}.nickname`]: nick,
          });
          toast('Přezdívka uložena!');
          document.getElementById('nickRow-' + uid).style.display = 'none';
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    });

    // Remove friend — delete the shared friendRequest doc. Either party is
    // allowed to delete it per firestore.rules, so this is a single legal
    // write (unlike the old batch that tried to touch both user docs).
    el.querySelectorAll('[data-remove-friend]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.removeFriend;
        confirmDialog('Odebrat přítele?', async () => {
          try {
            await db.collection('friendRequests').doc(friendMap[uid]).delete();
            delete FRIEND_MAP[uid];
            renderFriendsList(myUid, FRIEND_MAP, FRIEND_NICKNAMES);
            toast('Přítel odebrán.');
          } catch (e) { toast('Chyba: ' + e.message); }
        });
      });
    });
  });
}

function renderRequests(user, docs) {
  const el      = document.getElementById('requestsList');
  const pending = docs.filter(d => d.data().status === 'pending');
  if (!pending.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.875rem;padding:4px 0;">Žádné nové žádosti.</div>`;
    return;
  }
  el.innerHTML = '';
  pending.forEach(doc => {
    const r   = doc.data();
    const row = document.createElement('div');
    row.className = 'req-row';
    row.innerHTML = `
      <div class="f-av">${r.fromPhoto ? `<img src="${r.fromPhoto}" alt="">` : initial(r.fromName || r.fromEmail)}</div>
      <div class="req-info">
        <div class="f-name">${esc(r.fromName || r.fromEmail)}</div>
        <div class="f-email">${esc(r.fromEmail || '')}</div>
      </div>
      <div class="req-actions">
        <button class="btn btn-primary"   style="padding:5px 12px;font-size:0.78rem;" data-accept="${doc.id}">✓</button>
        <button class="btn btn-secondary" style="padding:5px 10px;font-size:0.78rem;" data-decline="${doc.id}">✕</button>
      </div>`;
    el.appendChild(row);
  });

  el.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.accept;
      try {
        // Just flip the shared request's status — both parties are allowed
        // to update it. loadFriends()'s accepted-status listeners pick this
        // up and derive the friendship from it; no cross-user doc write.
        await db.collection('friendRequests').doc(reqId).update({ status: 'accepted' });
        toast('Žádost přijata! 🎉');
      } catch (e) { toast('Chyba: ' + e.message); }
    });
  });

  el.querySelectorAll('[data-decline]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await db.collection('friendRequests').doc(btn.dataset.decline).update({ status: 'declined' });
        toast('Žádost odmítnuta.');
      } catch (e) { toast('Chyba: ' + e.message); }
    });
  });
}

function setupAddFriend(user) {
  document.getElementById('sendReqBtn').addEventListener('click', async () => {
    const code  = document.getElementById('friendCodeInput').value.trim().toUpperCase();
    const errEl = document.getElementById('addFriendError');
    errEl.style.display = 'none';

    if (code.length !== 6) {
      errEl.textContent = 'Kód musí mít 6 znaků.'; errEl.style.display = 'block'; return;
    }

    const btn = document.getElementById('sendReqBtn');
    btn.disabled = true; btn.textContent = 'Hledám...';

    try {
      // Najdi uživatele podle friendCode
      const userSnap = await db.collection('users').where('friendCode', '==', code).limit(1).get();
      if (userSnap.empty) {
        errEl.textContent = 'Uživatel s tímto kódem nenalezen.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }

      const targetDoc  = userSnap.docs[0];
      const targetUid  = targetDoc.id;
      const targetData = targetDoc.data();

      if (targetUid === user.uid) {
        errEl.textContent = 'Nemůžeš přidat sám sebe.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }

      // Deterministic doc per pair (sorted "uidA_uidB") for the rules gate.
      // Don't .doc(pairId).get() to check existence — reading a NON-existent
      // doc is denied by the rules (resource is null) → "Missing or
      // insufficient permissions". Query both directions instead (the where
      // clauses guarantee only readable docs, so it works even with 0 hits).
      const pairId = [user.uid, targetUid].sort().join('_');
      const [sentSnap, recvSnap] = await Promise.all([
        db.collection('friendRequests').where('fromUid', '==', user.uid).where('toUid', '==', targetUid).get(),
        db.collection('friendRequests').where('fromUid', '==', targetUid).where('toUid', '==', user.uid).get(),
      ]);
      const existingDocs = [...sentSnap.docs, ...recvSnap.docs];
      if (existingDocs.some(d => d.data().status === 'accepted')) {
        errEl.textContent = 'Tento uživatel je již tvůj přítel.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }
      if (existingDocs.some(d => d.data().status === 'pending')) {
        errEl.textContent = 'Žádost už byla odeslána.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }
      // Clear any leftover declined request(s) before re-sending.
      await Promise.all(existingDocs.map(d => d.ref.delete().catch(() => {})));

      await db.collection('friendRequests').doc(pairId).set({
        fromUid:   user.uid,
        fromName:  user.displayName || user.email,
        fromEmail: (user.email || '').toLowerCase(),
        fromPhoto: user.photoURL || null,
        toUid:     targetUid,
        toEmail:   (targetData.email || '').toLowerCase(),
        status:    'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      document.getElementById('friendCodeInput').value = '';
      toast(`Žádost odeslána uživateli ${targetData.displayName || code}!`);
    } catch (e) {
      errEl.textContent = 'Chyba: ' + e.message;
      errEl.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Odeslat žádost';
  });
}

// ── Modal helpers ───────────────────────────────────────────────
// ── Téma / vzhled ────────────────────────────────────────────────
// Applies instantly and caches to localStorage — version.js reads that
// cache in <head> on every page, so the choice sticks across the whole app
// without a flash of the default theme.
function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
  if (theme) localStorage.setItem('sb_theme', theme);
  else localStorage.removeItem('sb_theme');
  markSelectedTheme(theme);
}

function markSelectedTheme(theme) {
  document.querySelectorAll('#themePicker .theme-opt').forEach(opt => {
    opt.classList.toggle('selected', (opt.dataset.theme || '') === (theme || ''));
  });
}

// ── Settings (vzhled + Gemini/Groq klíče) ───────────────────────
// ── AI keys live in a PRIVATE subcollection ───────────────────
// users/{uid} has `allow read: if isAuth()` so that friend and member
// profiles can be shown — which means anything stored there is visible to
// every signed-in user, guests included. API keys therefore live in
// users/{uid}/private/ai, readable only by their owner.
function aiKeyDoc(uid) { return db.collection('users').doc(uid).collection('private').doc('ai'); }

async function loadAiKeys(user) {
  try {
    const snap = await aiKeyDoc(user.uid).get();
    const d = snap.exists ? snap.data() : {};
    if (d.geminiKey) localStorage.setItem('sb_gemini_key', d.geminiKey);
    if (d.groqKey)   localStorage.setItem('sb_groq_key', d.groqKey);
  } catch (_) { /* offline or rules not published — localStorage still works */ }
}

// One-time move of keys that were stored on the public profile document,
// plus deletion of the exposed copies.
async function migrateAiKeys(user, snap) {
  if (!snap.exists) return;
  const d = snap.data();
  if (!d.geminiKey && !d.groqKey) return;
  try {
    await aiKeyDoc(user.uid).set({
      geminiKey: d.geminiKey || null,
      groqKey:   d.groqKey || null,
    }, { merge: true });
    await db.collection('users').doc(user.uid).update({
      geminiKey: firebase.firestore.FieldValue.delete(),
      groqKey:   firebase.firestore.FieldValue.delete(),
    });
  } catch (_) { /* retried on the next load */ }
}

function setupSettings(user) {
  const btn      = document.getElementById('settingsBtn');
  const saveBtn  = document.getElementById('settingsSave');
  const gInput   = document.getElementById('settingsGeminiKey');
  const gStatus  = document.getElementById('geminiKeyStatus');
  const qInput   = document.getElementById('settingsGroqKey');
  const qStatus  = document.getElementById('groqKeyStatus');

  const updateStatus = (el, key) => {
    if (key) { el.textContent = '✓ nastaven'; el.style.color = '#4ade80'; }
    else      { el.textContent = 'nenastaveno'; el.style.color = 'var(--text-muted)'; }
  };

  // Výběr tématu — aplikuje se okamžitě, uloží se i na účet
  document.querySelectorAll('#themePicker .theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme || '';
      applyTheme(theme);
      db.collection('users').doc(user.uid)
        .update({ theme })
        .catch(() => { /* offline — localStorage stačí, doc se srovná příště */ });
    });
  });

  // Předvyplň aktuálně uloženými klíči
  btn.addEventListener('click', () => {
    gInput.value = localStorage.getItem('sb_gemini_key') || '';
    qInput.value = localStorage.getItem('sb_groq_key') || '';
    updateStatus(gStatus, gInput.value);
    updateStatus(qStatus, qInput.value);
    markSelectedTheme(localStorage.getItem('sb_theme') || '');
    openModal('settingsModal');
  });

  gInput.addEventListener('input', () => updateStatus(gStatus, gInput.value.trim()));
  qInput.addEventListener('input', () => updateStatus(qStatus, qInput.value.trim()));

  saveBtn.addEventListener('click', async () => {
    const gKey = gInput.value.trim();
    const qKey = qInput.value.trim();
    saveBtn.disabled = true;
    try {
      if (gKey) localStorage.setItem('sb_gemini_key', gKey); else localStorage.removeItem('sb_gemini_key');
      if (qKey) localStorage.setItem('sb_groq_key', qKey);   else localStorage.removeItem('sb_groq_key');
      await aiKeyDoc(user.uid).set({
        geminiKey: gKey || null,
        groqKey:   qKey || null,
      }, { merge: true });
      closeModal('settingsModal');
      toast('Klíče uloženy ✓');
    } catch(e) { toast('Chyba: ' + e.message); }
    saveBtn.disabled = false;
  });
}

function setupModalClose() {
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Generic confirm popup (replaces native confirm()) ───────────
function confirmDialog(message, onConfirm) {
  const overlay = document.getElementById('confirmModal');
  document.getElementById('confirmModalText').textContent = message;
  overlay.classList.add('open');

  // Clone-replace so stale listeners from a previous (possibly
  // backdrop-dismissed) call can't stack and fire more than once.
  const oldYes = document.getElementById('confirmModalYes');
  const oldNo  = document.getElementById('confirmModalNo');
  const yesBtn = oldYes.cloneNode(true);
  const noBtn  = oldNo.cloneNode(true);
  oldYes.replaceWith(yesBtn);
  oldNo.replaceWith(noBtn);

  yesBtn.addEventListener('click', () => { overlay.classList.remove('open'); onConfirm(); });
  noBtn.addEventListener('click',  () => overlay.classList.remove('open'));
}

function setupColorInput(inputId, swatchId, hexId) {
  const input  = document.getElementById(inputId);
  const swatch = document.getElementById(swatchId);
  const hex    = document.getElementById(hexId);
  if (!input) return;
  input.addEventListener('input', () => {
    swatch.style.background = input.value;
    hex.textContent = input.value;
  });
}

// ── Toast ───────────────────────────────────────────────────────
function toast(msg) {
  const wrap = document.getElementById('toastWrap');
  const el   = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Helpers ─────────────────────────────────────────────────────
function genCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
function initial(s) { return (s || '?')[0].toUpperCase(); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

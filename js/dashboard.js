// ── Auth guard ─────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'index.html'; return; }
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

  // Aktualizuj profil – vygeneruj friendCode pokud ještě nemá
  db.collection('users').doc(user.uid).get().then(snap => {
    const existing = snap.exists ? snap.data().friendCode : null;
    // Načti uložený Gemini klíč do localStorage
    const savedKey = snap.exists ? snap.data().geminiKey : null;
    if (savedKey) localStorage.setItem('sb_gemini_key', savedKey);
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
  loadRooms(user);
  loadDecks(user);
  loadFriends(user);
  setupCreate(user);
  setupJoin(user);
  setupNewDeck(user);
  setupAddFriend(user);
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
    });
  });
}

// ── Místnosti ───────────────────────────────────────────────────
function loadRooms(user) {
  const grid = document.getElementById('roomsGrid');
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
        return;
      }
      grid.innerHTML = '';
      const sorted = [...snap.docs].sort((a, b) => {
        const at = a.data().createdAt?.toMillis?.() || 0;
        const bt = b.data().createdAt?.toMillis?.() || 0;
        return bt - at;
      });
      sorted.forEach(doc => {
        const r    = doc.data();
        const role = (r.roles || {})[user.uid] || 'viewer';
        grid.appendChild(buildRoomCard(doc.id, r, role));
      });
    }, err => {
      if (err.code === 'permission-denied') {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">⏳ Firestore pravidla se aktivují… Obnovte stránku za chvíli.</div>`;
      } else {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">Chyba: ${err.message}</div>`;
      }
    });
}

function buildRoomCard(id, room, role) {
  const labels = { owner: 'Vlastník', editor: 'Editor', viewer: 'Prohlížeč' };
  const a = document.createElement('a');
  a.href = `room.html?id=${id}`;
  a.className = 'room-card';
  a.innerHTML = `
    <div class="room-card-dot" style="background:${room.color || '#6366f1'};"></div>
    <h3>${esc(room.name)}</h3>
    ${room.description ? `<p class="card-desc">${esc(room.description)}</p>` : ''}
    <div class="room-card-meta">
      <span class="role-badge role-${role}">${labels[role] || role}</span>
      <span class="meta-date">${fmtDate(room.createdAt)}</span>
    </div>`;
  return a;
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
      await roomDoc.ref.update({
        memberIds:              firebase.firestore.FieldValue.arrayUnion(user.uid),
        [`roles.${user.uid}`]:  'viewer',
        [`members.${user.uid}`]: { displayName: user.displayName || user.email, email: user.email, photoURL: user.photoURL || null },
      });
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
    sorted.forEach(doc => {
      const deck      = doc.data();
      const room      = deck.roomId ? roomMap[deck.roomId] : null;
      const ownerName = room ? (room.members?.[deck.ownerUid]?.displayName || null) : null;
      grid.appendChild(buildDeckCard(doc.id, deck, room?.name || null, ownerName, user.uid));
    });
  } catch (e) {
    if (e.code !== 'permission-denied') {
      grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);padding:40px;text-align:center;">Chyba: ${e.message}</div>`;
    }
  }
}

function buildDeckCard(id, deck, roomName, ownerName, myUid) {
  const a = document.createElement('a');
  a.href      = `flashcards.html?deck=${id}`;
  a.className = 'deck-card';

  const contextTag = roomName
    ? `<span class="deck-tag deck-tag-room">📂 ${esc(roomName)}</span>`
    : `<span class="deck-tag deck-tag-personal">Osobní</span>`;

  const ownerTag = ownerName && deck.ownerUid !== myUid
    ? `<span class="deck-tag deck-tag-owner">👤 ${esc(ownerName)}</span>`
    : '';

  a.innerHTML = `
    <div class="deck-dot" style="background:${deck.color || '#6366f1'};"></div>
    <h3>${esc(deck.name)}</h3>
    ${deck.description ? `<p class="card-desc">${esc(deck.description)}</p>` : ''}
    <p style="margin-bottom:8px;">${deck.cardCount || 0} karet</p>
    <div class="deck-tags">${contextTag}${ownerTag}</div>`;
  return a;
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
function loadFriends(user) {
  // Sleduj vlastní user doc pro přátele + zobraz vlastní kód
  db.collection('users').doc(user.uid).onSnapshot(snap => {
    if (!snap.exists) return;
    const data    = snap.data();
    const friends = data.friends || {};

    const codeEl = document.getElementById('myFriendCode');
    if (codeEl && data.friendCode) codeEl.textContent = data.friendCode;

    renderFriendsList(user.uid, friends);
  });

  document.getElementById('copyFriendCode').addEventListener('click', () => {
    const code = document.getElementById('myFriendCode').textContent;
    if (code && code !== '------') {
      navigator.clipboard.writeText(code).then(() => toast('Kód zkopírován!'));
    }
  });

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

function renderFriendsList(myUid, friends) {
  const el  = document.getElementById('friendsList');
  const ids = Object.keys(friends);
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
      const nick  = (friends[doc.id] || {}).nickname || '';
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

    // Remove friend
    el.querySelectorAll('[data-remove-friend]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Odebrat přítele?')) return;
        const uid = btn.dataset.removeFriend;
        try {
          const batch = db.batch();
          batch.update(db.collection('users').doc(myUid), { [`friends.${uid}`]: firebase.firestore.FieldValue.delete() });
          batch.update(db.collection('users').doc(uid),   { [`friends.${myUid}`]: firebase.firestore.FieldValue.delete() });
          await batch.commit();
          toast('Přítel odebrán.');
        } catch (e) { toast('Chyba: ' + e.message); }
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
        <button class="btn btn-primary"   style="padding:5px 12px;font-size:0.78rem;" data-accept="${doc.id}" data-from="${r.fromUid}">✓</button>
        <button class="btn btn-secondary" style="padding:5px 10px;font-size:0.78rem;" data-decline="${doc.id}">✕</button>
      </div>`;
    el.appendChild(row);
  });

  el.querySelectorAll('[data-accept]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId   = btn.dataset.accept;
      const fromUid = btn.dataset.from;
      try {
        const [reqDoc, fromDoc] = await Promise.all([
          db.collection('friendRequests').doc(reqId).get(),
          db.collection('users').doc(fromUid).get(),
        ]);
        const fromData = fromDoc.data() || {};
        const myData   = (await db.collection('users').doc(user.uid).get()).data() || {};
        const now      = firebase.firestore.FieldValue.serverTimestamp();
        const batch    = db.batch();
        batch.update(db.collection('friendRequests').doc(reqId), { status: 'accepted' });
        // Přidej oba ke svým přátelům
        batch.update(db.collection('users').doc(user.uid), {
          [`friends.${fromUid}`]: { nickname: '', addedAt: now },
        });
        batch.update(db.collection('users').doc(fromUid), {
          [`friends.${user.uid}`]: { nickname: '', addedAt: now },
        });
        await batch.commit();
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

      // Zkontroluj jestli už jsou přátelé
      const myDoc = await db.collection('users').doc(user.uid).get();
      if (myDoc.exists && (myDoc.data().friends || {})[targetUid]) {
        errEl.textContent = 'Tento uživatel je již tvůj přítel.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }

      // Zkontroluj existující pending žádost (filtrujeme status client-side, ne třetí where)
      const existingSnap = await db.collection('friendRequests')
        .where('fromUid', '==', user.uid)
        .where('toUid',   '==', targetUid)
        .get();
      if (existingSnap.docs.some(d => d.data().status === 'pending')) {
        errEl.textContent = 'Žádost už byla odeslána.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Odeslat žádost'; return;
      }

      await db.collection('friendRequests').add({
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
// ── Settings (Gemini klíč) ──────────────────────────────────────
function setupSettings(user) {
  const btn    = document.getElementById('settingsBtn');
  const saveBtn = document.getElementById('settingsSave');
  const input  = document.getElementById('settingsGeminiKey');
  const status = document.getElementById('geminiKeyStatus');

  const updateStatus = key => {
    if (key) { status.textContent = '✓ nastaven'; status.style.color = '#4ade80'; }
    else      { status.textContent = 'nenastaveno'; status.style.color = 'var(--text-muted)'; }
  };

  // Předvyplň aktuálně uloženým klíčem
  btn.addEventListener('click', () => {
    input.value = localStorage.getItem('sb_gemini_key') || '';
    updateStatus(input.value);
    openModal('settingsModal');
  });

  input.addEventListener('input', () => updateStatus(input.value.trim()));

  saveBtn.addEventListener('click', async () => {
    const key = input.value.trim();
    saveBtn.disabled = true;
    try {
      if (key) localStorage.setItem('sb_gemini_key', key);
      else     localStorage.removeItem('sb_gemini_key');
      await db.collection('users').doc(user.uid).update({ geminiKey: key || firebase.firestore.FieldValue.delete() });
      closeModal('settingsModal');
      toast(key ? 'Gemini klíč uložen ✓' : 'Gemini klíč odstraněn');
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

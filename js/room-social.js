// ═══ room-social.js — Sdílení/pozvánky, členové, přátelé, presence, aktivita, zálohy
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).

// ── Share ─────────────────────────────────────────────────────
// One unified link builder: Trvalý/Dočasný type switch, role, and a "jen 1
// použití" flag. A plain permanent link reuses the room's inviteCode (no
// server write); anything temporary or single-use becomes a server-side
// entry in ROOM.tempInvites so it can expire, be consumed, or be revoked.
function setupShare() {
  const roleSelect = document.getElementById('inviteRoleSelect');
  const typeSelect = document.getElementById('inviteTypeSelect');
  const linkText   = document.getElementById('inviteLinkText');

  // Only the OWNER can create invites with editor rights — everyone else
  // (including viewers, who used to be able to self-escalate this way) gets
  // a viewer-only picker. The join flow enforces the friend rule on top.
  if (MY_ROLE !== 'owner') {
    roleSelect.querySelector('option[value="editor"]')?.remove();
    const hint = document.getElementById('editorInviteHint');
    if (hint) hint.style.display = 'block';
  }

  // Owner housekeeping: prune EXPIRED invites (exp:null = permanent one-shot
  // links — those never expire, only get consumed or revoked).
  if (MY_ROLE === 'owner' && ROOM.tempInvites) {
    const dead = Object.entries(ROOM.tempInvites).filter(([, t]) => t.exp != null && t.exp < Date.now());
    if (dead.length) {
      const update = {};
      dead.forEach(([c]) => { update[`tempInvites.${c}`] = firebase.firestore.FieldValue.delete(); delete ROOM.tempInvites[c]; });
      db.collection('rooms').doc(ROOM_ID).update(update).catch(() => {});
    }
  }

  // Duration inputs only make sense for the temporary type
  typeSelect.addEventListener('change', () => {
    document.getElementById('inviteDurWrap').style.display =
      typeSelect.value === 'temp' ? 'inline-flex' : 'none';
  });

  document.getElementById('shareBtn').addEventListener('click', () => {
    document.getElementById('inviteCode').textContent = ROOM.inviteCode || '------';
    renderTempInvites();
    openModal('shareModal');
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(ROOM.inviteCode || '').then(() => toast('Kód zkopírován!'));
  });

  document.getElementById('inviteGenBtn').addEventListener('click', async () => {
    const role = roleSelect.value;
    const once = document.getElementById('tempOnceChk').checked;
    const temp = typeSelect.value === 'temp';

    // Plain permanent link → just the classic inviteCode URL, nothing stored.
    if (!temp && !once) {
      const url = new URL('room.html', window.location.href);
      url.searchParams.set('id', ROOM_ID);
      url.searchParams.set('code', ROOM.inviteCode || '');
      url.searchParams.set('role', role);
      linkText.textContent = url.href;
      document.getElementById('inviteLinkBox').style.display = 'flex';
      return;
    }

    // Temporary and/or single-use → server-side invite entry.
    let exp = null;
    if (temp) {
      const val  = parseInt(document.getElementById('tempDurVal').value, 10);
      const unit = parseInt(document.getElementById('tempDurUnit').value, 10);
      if (!val || val < 1 || val > 999) { toast('Zadej platnou dobu (1–999).'); return; }
      exp = Date.now() + val * unit;
    }
    const code  = Array.from({ length: 10 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
    const entry = { role, exp, by: ME.uid, once };
    try {
      await db.collection('rooms').doc(ROOM_ID).update({ [`tempInvites.${code}`]: entry });
      ROOM.tempInvites = { ...(ROOM.tempInvites || {}), [code]: entry };
      linkText.textContent = tempInviteUrl(code);
      document.getElementById('inviteLinkBox').style.display = 'flex';
      renderTempInvites();
      toast('Pozvánka vytvořena ✓');
    } catch (e) { toast('Chyba: ' + e.message); }
  });

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const t = linkText.textContent;
    if (t && t !== '–') navigator.clipboard.writeText(t).then(() => toast('Odkaz zkopírován!'));
  });
}

function tempInviteUrl(code) {
  const url = new URL('room.html', window.location.href);
  url.searchParams.set('id', ROOM_ID);
  url.searchParams.set('tcode', code);
  return url.href;
}

// Active temp invites with copy + revoke. The owner sees (and can revoke)
// all of them; other members only the ones they created.
function renderTempInvites() {
  const el = document.getElementById('tempInvitesList');
  if (!el) return;
  const mine = Object.entries(ROOM.tempInvites || {})
    .filter(([, t]) => t.exp == null || t.exp > Date.now())
    .filter(([, t]) => MY_ROLE === 'owner' || t.by === ME.uid)
    .sort((a, b) => (a[1].exp ?? Infinity) - (b[1].exp ?? Infinity));
  if (!mine.length) { el.innerHTML = ''; return; }

  el.innerHTML = `<label class="label" style="margin-bottom:6px;">Aktivní pozvánky</label>` +
    mine.map(([code, t]) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--text-muted);padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;">${roleLabel(t.role)} · ${t.exp == null ? 'trvalá' : 'do ' + new Date(t.exp).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}${t.once ? ' · 1 použití' : ''}</span>
        <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.72rem;" data-copy-temp="${code}" title="Kopírovat odkaz">📋</button>
        <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.72rem;color:#fca5a5;" data-revoke-temp="${code}" title="Zrušit pozvánku">✕</button>
      </div>`).join('');

  el.querySelectorAll('[data-copy-temp]').forEach(b => b.addEventListener('click', () => {
    navigator.clipboard.writeText(tempInviteUrl(b.dataset.copyTemp)).then(() => toast('Odkaz zkopírován!'));
  }));
  el.querySelectorAll('[data-revoke-temp]').forEach(b => b.addEventListener('click', async () => {
    try {
      await db.collection('rooms').doc(ROOM_ID).update({
        [`tempInvites.${b.dataset.revokeTemp}`]: firebase.firestore.FieldValue.delete(),
      });
      delete ROOM.tempInvites[b.dataset.revokeTemp];
      renderTempInvites();
      toast('Pozvánka zrušena.');
    } catch (e) { toast('Chyba: ' + e.message); }
  }));
}

// ── Members ───────────────────────────────────────────────────
function setupMembers() {
  document.getElementById('membersBtn').addEventListener('click', () => {
    renderMembers();
    document.getElementById('panelBack').classList.add('open');
  });

  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('panelBack').addEventListener('click', e => {
    if (e.target === document.getElementById('panelBack')) closePanel();
  });

  // Backups (owner only)
  if (MY_ROLE === 'owner') {
    document.getElementById('backupsBtn').style.display = 'inline-flex';
  }

  // Leave room (everyone). Rooms are never deleted — instead, when the OWNER
  // leaves, ownership is handed to another member so the room lives on.
  const hint = document.getElementById('leaveRoomHint');
  if (MY_ROLE === 'owner') {
    hint.textContent = 'Místnost nelze smazat. Když ji opustíš, vlastnictví převezme jiný člen.';
  }
  document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
}

// Pick the member who inherits the room when the owner leaves: prefer an
// existing editor (most trusted), otherwise any remaining member.
function pickSuccessor() {
  const roles = ROOM.roles || {};
  const others = (ROOM.memberIds || []).filter(id => id !== ME.uid);
  if (!others.length) return null;
  return others.find(id => roles[id] === 'editor') || others[0];
}

function memberName(uid) {
  const m = (ROOM.members || {})[uid] || {};
  return m.displayName || m.email || 'další člen';
}

// The actual leave write, shared by the button and the expiry auto-kick.
// `successorOverride` lets the owner hand ownership to a specific member;
// without it, pickSuccessor() chooses automatically. Returns false when
// leaving is impossible (sole-member owner).
async function performLeave(successorOverride) {
  const amOwner = MY_ROLE === 'owner';
  const successor = amOwner ? (successorOverride || pickSuccessor()) : null;
  if (amOwner && !successor) return false;

  const update = {
    memberIds:                  firebase.firestore.FieldValue.arrayRemove(ME.uid),
    [`roles.${ME.uid}`]:        firebase.firestore.FieldValue.delete(),
    [`members.${ME.uid}`]:      firebase.firestore.FieldValue.delete(),
    [`memberExpiry.${ME.uid}`]: firebase.firestore.FieldValue.delete(),
  };
  if (amOwner) {
    update.ownerId = successor;
    update[`roles.${successor}`] = 'owner';
    logActivity('owner', `předal vlastnictví na ${memberName(successor)} a opustil místnost`);
  }
  await db.collection('rooms').doc(ROOM_ID).update(update);
  return true;
}

async function leaveRoom() {
  let successor = null;
  if (MY_ROLE === 'owner') {
    // Eligible = every other CURRENT member (skip already-expired guests).
    const others = (ROOM.memberIds || []).filter(id => id !== ME.uid && !memberExpired(id));
    if (!others.length) {
      toast('Jsi jediný člen — nejdřív někoho pozvi, komu se místnost předá.');
      return;
    }
    // One other member → straight confirm; several → let the owner choose.
    if (others.length === 1) {
      successor = others[0];
      if (!confirm(`Opustit místnost? Vlastnictví převezme ${memberName(successor)}.`)) return;
    } else {
      successor = await openSuccessorPicker(others);
      if (!successor) return; // cancelled
    }
  } else {
    if (!confirm('Opustit místnost? Ztratíš k ní přístup.')) return;
  }

  try {
    await performLeave(successor);
    window.location.href = 'dashboard.html';
  } catch (e) {
    toast('Chyba: ' + e.message);
  }
}

// Modal: owner chooses which member inherits the room. Resolves to the chosen
// uid, or null if cancelled.
function openSuccessorPicker(candidateIds) {
  return new Promise(resolve => {
    const list = document.getElementById('successorList');
    list.innerHTML = candidateIds.map(uid => {
      const m = (ROOM.members || {})[uid] || {};
      const role = (ROOM.roles || {})[uid] || 'viewer';
      return `<button class="successor-opt" data-uid="${uid}" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg-2);color:var(--text);cursor:pointer;margin-bottom:8px;">
        <div class="m-avatar">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;">${esc(m.displayName || m.email || uid)}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">${roleLabel(role)}</div>
        </div>
      </button>`;
    }).join('');

    let done = false;
    const finish = val => { if (done) return; done = true; closeModal('successorModal'); resolve(val); };
    list.querySelectorAll('.successor-opt').forEach(btn =>
      btn.addEventListener('click', () => {
        if (!confirm(`Předat vlastnictví uživateli ${memberName(btn.dataset.uid)} a opustit místnost?`)) return;
        finish(btn.dataset.uid);
      }));
    document.getElementById('successorCancel').onclick = () => finish(null);
    openModal('successorModal');
  });
}

// Is this member's temporary access already over? (No expiry = permanent.)
function memberExpired(uid) {
  const e = (ROOM.memberExpiry || {})[uid];
  return !!e && e < Date.now();
}

// Owner-side sweep of expired members (they can't be trusted to come back
// and remove themselves). One batched update for all of them.
async function purgeExpiredMembers() {
  const dead = (ROOM.memberIds || []).filter(uid => uid !== ME.uid && memberExpired(uid));
  if (!dead.length) return;
  const update = { memberIds: firebase.firestore.FieldValue.arrayRemove(...dead) };
  dead.forEach(uid => {
    update[`roles.${uid}`]        = firebase.firestore.FieldValue.delete();
    update[`members.${uid}`]      = firebase.firestore.FieldValue.delete();
    update[`memberExpiry.${uid}`] = firebase.firestore.FieldValue.delete();
  });
  try {
    await db.collection('rooms').doc(ROOM_ID).update(update);
    ROOM.memberIds = ROOM.memberIds.filter(id => !dead.includes(id));
    dead.forEach(uid => { delete ROOM.roles?.[uid]; delete ROOM.members?.[uid]; delete ROOM.memberExpiry?.[uid]; });
    updateMemberCount();
  } catch (_) { /* best effort */ }
}

// ── Temporary membership (anonymous guests, temp invites) ─────
// Client-side enforcement: when the expiry hits while the room is open, the
// member removes themselves and is sent back to the dashboard. A banner shows
// when the access ends.
function scheduleExpiryKick(expiry) {
  const notice = document.createElement('div');
  notice.className = 'viewer-notice';
  // Don't overlap the viewer notice if both are shown
  if (MY_ROLE === 'viewer') notice.style.top = '104px';
  notice.textContent = `⏳ Tvůj přístup vyprší v ${new Date(expiry).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`;
  document.body.appendChild(notice);

  const remaining = Math.min(expiry - Date.now(), 2147483647);
  setTimeout(async () => {
    await performLeave().catch(() => {});
    alert('Tvůj dočasný přístup do místnosti vypršel.');
    window.location.href = 'dashboard.html';
  }, remaining);
}

// ── Search across notes ───────────────────────────────────────
// Diacritics-insensitive match over each note's title + plain-text content.
// ── Presence (who's in the room right now) ────────────────────
// Live via RTDB: each open tab writes presence/{roomId}/{uid} and clears it on
// disconnect (tab close / navigation), so the list is instantly accurate.
let ONLINE_UIDS = new Set();
function setupPresence() {
  let rtdb;
  try { rtdb = firebase.database(); } catch (e) { return; } // RTDB unavailable → skip silently
  const base = rtdb.ref(`presence/${ROOM_ID}`);
  const meRef = base.child(ME.uid);
  meRef.set({
    name: ME.isAnonymous ? 'Host' : (ME.displayName || ME.email || 'Uživatel'),
    photo: ME.photoURL || null,
    at: firebase.database.ServerValue.TIMESTAMP,
  }).catch(() => {});
  meRef.onDisconnect().remove();
  base.on('value', snap => renderPresence(snap.val() || {}), () => {});

  // Live cursor: throttled board-space position under presence/{room}/{me}/cur
  // (cleared on mouseleave; the whole node dies with onDisconnect anyway).
  const wrap = document.getElementById('boardWrap');
  let lastCurSend = 0;
  wrap.addEventListener('mousemove', e => {
    if (VIEW_MODE !== 'board') return;
    const now = performance.now();
    if (now - lastCurSend < 90) return;
    lastCurSend = now;
    const r = wrap.getBoundingClientRect();
    const x = Math.round((wrap.scrollLeft + e.clientX - r.left) / BOARD_ZOOM);
    const y = Math.round((wrap.scrollTop  + e.clientY - r.top)  / BOARD_ZOOM);
    meRef.child('cur').set({ x, y }).catch(() => {});
  }, { passive: true });
  wrap.addEventListener('mouseleave', () => { meRef.child('cur').remove().catch(() => {}); });
}

// Colored cursors of everyone else, positioned in board coordinates so they
// pan/zoom together with the content.
function uidHue(uid) { let h = 0; for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; }
function renderLiveCursors(map) {
  const board = document.getElementById('board');
  if (!board) return;
  const shown = new Set();
  Object.entries(map).forEach(([uid, p]) => {
    if (uid === ME.uid || !p || !p.cur) return;
    shown.add('cur-' + uid);
    let c = document.getElementById('cur-' + uid);
    if (!c) {
      c = document.createElement('div');
      c.id = 'cur-' + uid;
      c.className = 'live-cursor';
      c.innerHTML = '<div class="lc-dot"></div><div class="lc-name"></div>';
      board.appendChild(c);
    }
    c.style.left = p.cur.x + 'px';
    c.style.top  = p.cur.y + 'px';
    c.style.setProperty('--lc', `hsl(${uidHue(uid)} 80% 60%)`);
    c.querySelector('.lc-name').textContent = p.name || '';
  });
  document.querySelectorAll('.live-cursor').forEach(c => { if (!shown.has(c.id)) c.remove(); });
}

function renderPresence(map) {
  ONLINE_UIDS = new Set(Object.keys(map));
  renderLiveCursors(map);
  const bar = document.getElementById('presenceBar');
  if (bar) {
    const entries = Object.entries(map);
    const shown = entries.slice(0, 6);
    bar.innerHTML = shown.map(([uid, p]) => `
      <div class="presence-av${uid === ME.uid ? ' me' : ''}" title="${esc(p.name || '')}${uid === ME.uid ? ' (ty)' : ''}">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc(initial(p.name || '?'))}</span>`}
      </div>`).join('') +
      (entries.length > 6 ? `<div class="presence-more">+${entries.length - 6}</div>` : '');
    bar.title = entries.length + ' online';
  }
  // Refresh the members panel's online dots if it's open.
  if (document.getElementById('panelBack')?.classList.contains('open')) renderMembers();
}

// ── Activity log ──────────────────────────────────────────────
// Append-only trail of who did what (deletes, role changes, ownership
// hand-offs). Best-effort — a failed log never blocks the actual action.
function logActivity(type, text) {
  if (!ROOM_ID || !ME || ME.isAnonymous) return;
  db.collection('rooms').doc(ROOM_ID).collection('activity').add({
    type, text,
    byUid:  ME.uid,
    byName: ME.displayName || ME.email || 'Někdo',
    at:     firebase.firestore.FieldValue.serverTimestamp(),
  }).catch(() => {});
}

function setupActivityLog() {
  const btn = document.getElementById('activityBtn');
  if (btn) btn.addEventListener('click', () => { openModal('activityModal'); renderActivityLog(); });
}

async function renderActivityLog() {
  const el = document.getElementById('activityList');
  el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Načítám…</div>';
  try {
    const snap = await db.collection('rooms').doc(ROOM_ID).collection('activity')
      .orderBy('at', 'desc').limit(100).get();
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Zatím žádná aktivita.</div>';
      return;
    }
    const icon = { note: '🗑️', member: '👤', role: '🛡️', owner: '👑', restore: '↩️', board: '🖊️' };
    el.innerHTML = snap.docs.map(d => {
      const a = d.data();
      const when = a.at?.toDate ? a.at.toDate().toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.82rem;">
        <span>${icon[a.type] || '•'}</span>
        <div style="flex:1;min-width:0;">
          <div><strong>${esc(a.byName || 'Někdo')}</strong> ${esc(a.text || '')}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${esc(when)}</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:#fca5a5;font-size:.85rem;">Chyba: ${esc(e.message)}</div>`;
  }
}

// ── Friends (shared with dashboard's friendRequests collection) ──
// Friendship = an *accepted* friendRequest in either direction. Loaded once
// and cached; `pending` covers both sent and received requests so the member
// list can show the right button state.
let FRIEND_STATE = null;
async function loadFriendState(force) {
  if (FRIEND_STATE && !force) return FRIEND_STATE;
  if (ME.isAnonymous) { FRIEND_STATE = { accepted: new Set(), pending: new Set(), incoming: [] }; return FRIEND_STATE; }
  const [sent, received] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', ME.uid).get(),
    db.collection('friendRequests').where('toUid', '==', ME.uid).get(),
  ]);
  const accepted = new Set(), pending = new Set(), incoming = [];
  sent.docs.forEach(d => {
    const r = d.data();
    if (r.status === 'accepted')     accepted.add(r.toUid);
    else if (r.status === 'pending') pending.add(r.toUid);
  });
  received.docs.forEach(d => {
    const r = d.data();
    if (r.status === 'accepted')     accepted.add(r.fromUid);
    else if (r.status === 'pending') { pending.add(r.fromUid); incoming.push({ id: d.id, ...r }); }
  });
  FRIEND_STATE = { accepted, pending, incoming };
  return FRIEND_STATE;
}

// Badge on the "Členové" button: number of pending friend requests I've
// received. Refreshed on room load and whenever the panel re-renders.
async function refreshMembersBadge() {
  const badge = document.getElementById('membersReqBadge');
  if (!badge || ME.isAnonymous) return;
  try {
    const fs = await loadFriendState(true);
    const n = (fs.incoming || []).length;
    badge.textContent = n;
    badge.style.display = n ? 'inline-block' : 'none';
  } catch (_) { /* ignore */ }
}

async function sendFriendRequestTo(uid, member) {
  try {
    // Deterministic pair id (sorted) — matches dashboard + the rules gate. We
    // set() straight onto it: reading a non-existent doc by id is denied by
    // the rules, and the "➕ Přítel" button only shows when you're not already
    // friends / pending anyway, so a plain set is safe here.
    const pairId = [ME.uid, uid].sort().join('_');
    await db.collection('friendRequests').doc(pairId).set({
      fromUid:   ME.uid,
      fromName:  ME.displayName || ME.email,
      fromEmail: (ME.email || '').toLowerCase(),
      fromPhoto: ME.photoURL || null,
      toUid:     uid,
      toEmail:   (member.email || '').toLowerCase(),
      status:    'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    FRIEND_STATE?.pending.add(uid);
    toast('Žádost o přátelství odeslána!');
    renderMembers();
  } catch (e) { toast('Chyba: ' + e.message); }
}

function closePanel() {
  document.getElementById('panelBack').classList.remove('open');
}

// ── Backups (owner-only, durable snapshots in Firestore) ──────
const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // auto-backup at most every 12h
const BACKUP_KEEP        = 24;                   // keep the newest N (≈12 days)

function backupsCol() { return db.collection('rooms').doc(ROOM_ID).collection('backups'); }

// Snapshot the whole room into ONE backup doc: notes + connections + folders
// as arrays (with their original ids preserved so restore can recreate them
// exactly, keeping connection endpoints and folder membership valid).
async function createBackup(auto) {
  const [notesSnap, connsSnap, foldersSnap] = await Promise.all([
    db.collection('rooms').doc(ROOM_ID).collection('notes').get(),
    db.collection('rooms').doc(ROOM_ID).collection('connections').get(),
    db.collection('rooms').doc(ROOM_ID).collection('folders').get(),
  ]);
  const dump = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const notes = dump(notesSnap), connections = dump(connsSnap), folders = dump(foldersSnap);

  await backupsCol().add({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: ME.uid,
    auto: !!auto,
    counts: { notes: notes.length, connections: connections.length, folders: folders.length },
    notes, connections, folders,
  });

  // Prune old backups beyond the keep limit so storage doesn't grow forever.
  const all = await backupsCol().orderBy('createdAt', 'desc').get();
  if (all.size > BACKUP_KEEP) {
    const batch = db.batch();
    all.docs.slice(BACKUP_KEEP).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

// Called once on owner room-load: if the newest backup is older than 12h (or
// none exists), make a fresh automatic one. This is the serverless stand-in
// for a scheduled job — it can only fire while the owner has the room open.
async function maybeAutoBackup() {
  try {
    const latest = await backupsCol().orderBy('createdAt', 'desc').limit(1).get();
    const lastMs = latest.empty ? 0 : (latest.docs[0].data().createdAt?.toMillis?.() || 0);
    if (Date.now() - lastMs >= BACKUP_INTERVAL_MS) await createBackup(true);
  } catch (_) { /* backups are best-effort; never block the room */ }
}

function setupBackups() {
  if (MY_ROLE !== 'owner') return;
  maybeAutoBackup();

  document.getElementById('backupsBtn').addEventListener('click', () => {
    openModal('backupsModal');
    renderBackupsList();
  });

  document.getElementById('backupNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('backupNowBtn');
    btn.disabled = true; btn.textContent = 'Zálohuji…';
    try { await createBackup(false); toast('Záloha vytvořena ✓'); renderBackupsList(); }
    catch (e) { toast('Chyba: ' + e.message); }
    btn.disabled = false; btn.textContent = '💾 Zálohovat teď';
  });
}

async function renderBackupsList() {
  const el = document.getElementById('backupsList');
  el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Načítám…</div>';
  try {
    const snap = await backupsCol().orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:.85rem;">Zatím žádné zálohy.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const b = d.data();
      const when = b.createdAt?.toDate ? b.createdAt.toDate().toLocaleString('cs-CZ', { day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
      const c = b.counts || {};
      return `
        <div class="backup-row">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.86rem;font-weight:600;">${b.auto ? '🕛' : '💾'} ${esc(when)}</div>
            <div style="font-size:0.74rem;color:var(--text-muted);">${c.notes||0} poznámek · ${c.connections||0} propojení · ${c.folders||0} složek</div>
          </div>
          <button class="btn btn-secondary" style="padding:5px 12px;font-size:0.78rem;" data-restore="${d.id}">Obnovit</button>
        </div>`;
    }).join('');

    el.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', () => {
        confirmModal('Obnovit tuto zálohu? Současný obsah místnosti (poznámky, propojení, složky) se nahradí stavem ze zálohy.', () => restoreBackup(btn.dataset.restore));
      });
    });
  } catch (e) {
    el.innerHTML = `<div style="color:#fca5a5;font-size:.85rem;padding:10px;">Chyba: ${esc(e.message)}</div>`;
  }
}

// Wipe the current notes/connections/folders and recreate them from the
// backup, reusing the original doc ids. Firestore batches cap at 500 writes,
// so everything is chunked.
async function restoreBackup(backupId) {
  const btn = document.querySelector(`[data-restore="${backupId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Obnovuji…'; }
  try {
    const doc = await backupsCol().doc(backupId).get();
    if (!doc.exists) { toast('Záloha nenalezena.'); return; }
    const b = doc.data();
    const roomRef = db.collection('rooms').doc(ROOM_ID);

    // 1) Safety backup of the CURRENT state first, so a restore is itself
    //    undoable if it wasn't what the owner wanted.
    await createBackup(true);

    // 2) Gather every current doc to delete, then all recreations, and run
    //    them as ordered chunks of ≤450 writes.
    const [curNotes, curConns, curFolders] = await Promise.all([
      roomRef.collection('notes').get(),
      roomRef.collection('connections').get(),
      roomRef.collection('folders').get(),
    ]);

    const ops = [];
    curNotes.docs.forEach(d => ops.push(['del', d.ref]));
    curConns.docs.forEach(d => ops.push(['del', d.ref]));
    curFolders.docs.forEach(d => ops.push(['del', d.ref]));
    (b.notes || []).forEach(n => { const { id, ...data } = n; ops.push(['set', roomRef.collection('notes').doc(id), data]); });
    (b.connections || []).forEach(c => { const { id, ...data } = c; ops.push(['set', roomRef.collection('connections').doc(id), data]); });
    (b.folders || []).forEach(f => { const { id, ...data } = f; ops.push(['set', roomRef.collection('folders').doc(id), data]); });

    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(([kind, ref, data]) => kind === 'del' ? batch.delete(ref) : batch.set(ref, data));
      await batch.commit();
    }

    closeModal('backupsModal');
    logActivity('restore', 'obnovil místnost ze zálohy');
    toast('Záloha obnovena ✓');
  } catch (e) {
    toast('Chyba při obnově: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Obnovit'; }
  }
}

function updateMemberCount() {
  const ids = (ROOM.memberIds || []).filter(uid => !memberExpired(uid));
  document.getElementById('memberCount').textContent = ids.length;
}

async function renderMembers() {
  const list    = document.getElementById('membersList');
  const members = ROOM.members || {};
  const roles   = ROOM.roles   || {};
  // Hide members whose temporary access already ran out — the owner's sweep
  // removes them from the doc, but the list shouldn't show them even before
  // that happens.
  const ids = (ROOM.memberIds || []).filter(uid => !memberExpired(uid));
  if (MY_ROLE === 'owner') purgeExpiredMembers();

  // Friend states drive the "add friend" buttons, the editor-only-for-friends
  // guard on the role select, and the incoming-requests section.
  let friends = { accepted: new Set(), pending: new Set(), incoming: [] };
  try { friends = await loadFriendState(); } catch (_) { /* best effort */ }
  const badge = document.getElementById('membersReqBadge');
  if (badge) {
    const n = (friends.incoming || []).length;
    badge.textContent = n;
    badge.style.display = n ? 'inline-block' : 'none';
  }

  list.innerHTML = renderIncomingRequests(friends.incoming || []);
  if (!ids.length) {
    list.innerHTML += '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Žádní členové.</p>';
    wireIncomingRequestButtons(list);
    return;
  }

  ids.forEach(uid => {
    const m      = members[uid] || {};
    const role   = roles[uid] || 'viewer';
    const isMe   = uid === ME.uid;
    const canMng = MY_ROLE === 'owner' && !isMe;

    const row = document.createElement('div');
    row.className = 'member-row';

    // Expiring membership (guests, temp invites) — show until when
    const exp = (ROOM.memberExpiry || {})[uid];
    const expLabel = exp
      ? `<div class="m-email">⏳ do ${new Date(exp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>`
      : '';

    // Friend button: not for myself, not for anonymous guests as TARGETS,
    // and not at all when I'M the anonymous guest (guests have no friends).
    let friendHtml = '';
    if (!isMe && !m.isAnon && !ME.isAnonymous) {
      if (friends.accepted.has(uid))     friendHtml = `<span style="font-size:0.68rem;color:var(--text-muted);">👥 Přítel</span>`;
      else if (friends.pending.has(uid)) friendHtml = `<span style="font-size:0.68rem;color:var(--text-muted);">⏳ Žádost čeká</span>`;
      else friendHtml = `<button class="btn btn-ghost" style="padding:3px 8px;font-size:0.7rem;" data-add-friend="${uid}">➕ Přítel</button>`;
    }

    const online = ONLINE_UIDS.has(uid);
    row.innerHTML = `
      <div class="m-avatar${online ? ' online' : ''}">${m.photoURL ? `<img src="${m.photoURL}" alt="">` : initial(m.displayName || m.email || '?')}</div>
      <div class="m-info">
        <div class="m-name">${esc(m.displayName || m.email || uid)}${isMe ? ' <span style="color:var(--text-muted);font-weight:400;">(ty)</span>' : ''}${online ? ' <span style="color:#22c55e;font-size:0.7rem;">● online</span>' : ''}</div>
        <div class="m-email">${esc(m.email || '')}</div>
        ${expLabel}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
        ${canMng
          ? `<div style="display:flex;gap:6px;align-items:center;">
               <select class="role-select" data-uid="${uid}">
                 <option value="editor" ${role === 'editor' ? 'selected' : ''}>Editor</option>
                 <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Prohlížeč</option>
               </select>
               <button class="btn btn-danger" style="padding:4px 8px;font-size:0.72rem;" data-rm="${uid}">✕</button>
             </div>`
          : `<span class="role-badge role-${role}">${roleLabel(role)}</span>`
        }
        ${friendHtml}
      </div>`;

    // Role change — editor is reserved for the owner's friends.
    const sel = row.querySelector('.role-select');
    if (sel) {
      sel.addEventListener('change', async () => {
        if (sel.value === 'editor' && !friends.accepted.has(uid)) {
          sel.value = role; // revert
          toast('Editora může mít jen tvůj přítel. Nejdřív si ho přidej do přátel.');
          return;
        }
        const prev = role;
        try {
          await db.collection('rooms').doc(ROOM_ID).update({ [`roles.${uid}`]: sel.value });
          ROOM.roles[uid] = sel.value;
          logActivity('role', `změnil roli ${memberName(uid)} na ${roleLabel(sel.value)}`);
          toast('Oprávnění změněno.');
        } catch (e) { sel.value = prev; toast('Chyba: ' + e.message); }
      });
    }

    // Send friend request straight from the member list
    const addBtn = row.querySelector('[data-add-friend]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addBtn.disabled = true;
        sendFriendRequestTo(uid, m);
      });
    }

    // Remove member
    const rmBtn = row.querySelector('[data-rm]');
    if (rmBtn) {
      rmBtn.addEventListener('click', async () => {
        if (!confirm('Odebrat tohoto člena?')) return;
        try {
          await db.collection('rooms').doc(ROOM_ID).update({
            memberIds:                        firebase.firestore.FieldValue.arrayRemove(uid),
            [`roles.${uid}`]:                 firebase.firestore.FieldValue.delete(),
            [`members.${uid}`]:               firebase.firestore.FieldValue.delete(),
          });
          // Refresh local state
          ROOM.memberIds = (ROOM.memberIds || []).filter(i => i !== uid);
          delete ROOM.roles[uid];
          delete ROOM.members[uid];
          logActivity('member', `odebral člena ${memberName(uid) || esc(m.displayName || m.email || uid)}`);
          updateMemberCount();
          renderMembers();
          toast('Člen odebrán.');
        } catch (e) { toast('Chyba: ' + e.message); }
      });
    }

    list.appendChild(row);
  });

  wireIncomingRequestButtons(list);
}

// ── Incoming friend requests (shown at the top of the members panel) ──
function renderIncomingRequests(incoming) {
  if (!incoming.length) return '';
  return `<div style="padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid var(--border);">
    <div class="label" style="margin-bottom:8px;">Žádosti o přátelství (${incoming.length})</div>` +
    incoming.map(r => `
      <div class="member-row" style="padding:6px 0;">
        <div class="m-avatar">${r.fromPhoto ? `<img src="${r.fromPhoto}" alt="">` : initial(r.fromName || r.fromEmail || '?')}</div>
        <div class="m-info">
          <div class="m-name">${esc(r.fromName || r.fromEmail || r.fromUid)}</div>
          <div class="m-email">${esc(r.fromEmail || '')}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-primary"   style="padding:4px 10px;font-size:0.75rem;" data-accept-req="${r.id}">✓</button>
          <button class="btn btn-secondary" style="padding:4px 9px;font-size:0.75rem;"  data-decline-req="${r.id}">✕</button>
        </div>
      </div>`).join('') + `</div>`;
}

function wireIncomingRequestButtons(scope) {
  scope.querySelectorAll('[data-accept-req]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await db.collection('friendRequests').doc(btn.dataset.acceptReq).update({ status: 'accepted' });
      FRIEND_STATE = null; // force reload
      toast('Žádost přijata! 🎉');
      renderMembers();
    } catch (e) { toast('Chyba: ' + e.message); btn.disabled = false; }
  }));
  scope.querySelectorAll('[data-decline-req]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await db.collection('friendRequests').doc(btn.dataset.declineReq).update({ status: 'declined' });
      FRIEND_STATE = null;
      toast('Žádost odmítnuta.');
      renderMembers();
    } catch (e) { toast('Chyba: ' + e.message); btn.disabled = false; }
  }));
}

// ── Modal helpers ─────────────────────────────────────────────

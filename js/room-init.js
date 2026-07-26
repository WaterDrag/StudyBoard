// ═══ room-init.js — Auth guard + inicializace místnosti (MUSÍ se načítat POSLEDNÍ)
// Rozděleno z room.js (v9.8). Klasické skripty sdílející globály;
// pořadí načítání určuje room.html (room-init.js jde poslední).


// ── Auth guard ────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) {
    // Preserve the invite link (?id=..&code=..&role=..) through the login
    // round-trip — otherwise clicking a link while logged out would land on
    // the dashboard after signing in instead of joining the room.
    localStorage.setItem('sb_pending_redirect', window.location.href);
    window.location.href = 'index.html';
    return;
  }
  ME = user;

  ROOM_ID = new URLSearchParams(window.location.search).get('id');
  if (!ROOM_ID) { window.location.href = 'dashboard.html'; return; }

  try {
    const doc = await db.collection('rooms').doc(ROOM_ID).get();
    if (!doc.exists) throw new Error('Místnost neexistuje.');

    ROOM    = { id: doc.id, ...doc.data() };
    MY_ROLE = (ROOM.roles || {})[ME.uid];

    if (!MY_ROLE) {
      // Invite link — either the permanent one (?code=..&role=..) or a
      // temporary one (?tcode=..) whose role+expiry live server-side in
      // ROOM.tempInvites, so the link itself can't be tampered with.
      const params   = new URLSearchParams(window.location.search);
      const linkCode = params.get('code');
      const tempCode = params.get('tcode');
      let   linkRole = params.get('role');
      let   inviteExp = null; // membership expiry carried by a temp invite

      let allowed = false;
      if (tempCode) {
        const t = (ROOM.tempInvites || {})[tempCode];
        // exp:null = permanent single-use link — never expires, only gets
        // consumed (on join) or revoked.
        if (t && (t.exp == null || t.exp > Date.now())) { allowed = true; linkRole = t.role; inviteExp = t.exp; }
        else if (t) {
          toast('Tato pozvánka už vypršela.');
          setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
          return;
        }
      } else if (linkCode && ROOM.inviteCode && linkCode === ROOM.inviteCode) {
        allowed = true;
      }

      if (!allowed) {
        toast('Nemáš přístup k této místnosti.');
        setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
        return;
      }

      // Editor via invite is reserved for the OWNER's friends. A forged or
      // leaked role=editor link therefore grants nothing — anyone who isn't
      // the owner's friend silently joins as viewer instead. Anonymous
      // guests are ALWAYS viewers: their membership is temporary, so letting
      // them create permanent content makes no sense.
      let joinRole = linkRole === 'editor' ? 'editor' : 'viewer';
      if (ME.isAnonymous) {
        joinRole = 'viewer';
      } else if (joinRole === 'editor') {
        const friends = await loadFriendState();
        if (!friends.accepted.has(ROOM.ownerId)) {
          joinRole = 'viewer';
          toast('Editora může získat jen přítel vlastníka — připojeno jako prohlížeč.');
        }
      }


      // Membership expiry: a temp invite carries its own; anonymous guests
      // are capped at 1 hour no matter which invite they used.
      let expiry = inviteExp;
      if (ME.isAnonymous) expiry = Math.min(expiry ?? Infinity, Date.now() + 3600000);

      const joinUpdate = {
        memberIds:             firebase.firestore.FieldValue.arrayUnion(ME.uid),
        [`roles.${ME.uid}`]:   joinRole,
        [`members.${ME.uid}`]: {
          displayName: ME.isAnonymous ? 'Host' : (ME.displayName || ME.email),
          email: ME.email || null, photoURL: ME.photoURL || null,
          isAnon: !!ME.isAnonymous,
        },
      };
      if (expiry) joinUpdate[`memberExpiry.${ME.uid}`] = expiry;
      // Single-use invite: consume it atomically with the join itself, so a
      // shared one-shot link can't let a second person in.
      if (tempCode && (ROOM.tempInvites || {})[tempCode]?.once) {
        joinUpdate[`tempInvites.${tempCode}`] = firebase.firestore.FieldValue.delete();
      }

      await doc.ref.update(joinUpdate);
      ROOM.memberIds = [...(ROOM.memberIds || []), ME.uid];
      ROOM.roles     = { ...(ROOM.roles || {}), [ME.uid]: joinRole };
      if (expiry) ROOM.memberExpiry = { ...(ROOM.memberExpiry || {}), [ME.uid]: expiry };
      MY_ROLE = joinRole;
      toast(`Připojeno jako ${roleLabel(joinRole)}! 🎉`);
    }

    // Expired / expiring membership (anonymous guests, temp invites):
    // kick on load if already past, otherwise schedule the kick and show
    // a countdown notice.
    const myExpiry = (ROOM.memberExpiry || {})[ME.uid];
    if (myExpiry && Date.now() >= myExpiry) {
      await performLeave().catch(() => {});
      toast('Tvůj dočasný přístup vypršel.');
      setTimeout(() => (window.location.href = 'dashboard.html'), 1600);
      return;
    }
    if (myExpiry) scheduleExpiryKick(myExpiry);

    // Owner housekeeping: expired members only remove THEMSELVES when they
    // happen to reload the room — if they just closed the tab, they'd linger
    // forever. The owner sweeps them out on load instead.
    if (MY_ROLE === 'owner') purgeExpiredMembers();

    document.getElementById('roomTitle').textContent = ROOM.name;
    document.title = ROOM.name + ' – StudyBoard';

    // Anonymous guests are strictly view-only in shared rooms, no matter what
    // role a legacy/edge path may have left them — their membership is
    // temporary, permanent content from them makes no sense.
    if (ME.isAnonymous && MY_ROLE !== 'owner') MY_ROLE = 'viewer';

    if (MY_ROLE === 'viewer') {
      document.getElementById('addBtn').style.display = 'none';
      const notice = document.createElement('div');
      notice.className   = 'viewer-notice';
      notice.textContent = '👁 Jen prohlížíš – nemůžeš přidávat poznámky';
      document.body.appendChild(notice);
    }

    await loadListPrefs(); // personal marks/pins/folder state before first list render
    setupNotes();
    setupFolders();
    setupAdd();
    setupEdit();
    setupViewToggle();
    setupTableInsertModal();
    setupConnColorModal();
    setupShare();
    setupFlashCards();
    setupAiCards();
    setupBoardPan();
    setupBoardZoom();
    setupMembers();
    setupBackups();
    setupActivityLog();
    setupSearch();
    setupPresence();
    setupComments();
    setupExport();
    setupNoteHistoryKeys();
    setupConnections();
    setupWhiteboards();
    setupBoardContextMenu();
    setupBoardMinimap();
    setupMultiSelect();
    setupLightbox();
    setupModalClose();
    updateMemberCount();
    refreshMembersBadge(); // pending friend-request badge on the members button

    // Start the view just inside the padded origin — content sits with a
    // comfortable empty margin to its left/top that can be panned into.
    const wrap = document.getElementById('boardWrap');
    wrap.scrollLeft = BOARD_PAD - 280;
    wrap.scrollTop  = BOARD_PAD - 220;

  } catch (e) {
    toast('Chyba: ' + e.message);
    setTimeout(() => (window.location.href = 'dashboard.html'), 1800);
  }
});

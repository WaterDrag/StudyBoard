// ═══ room-drafts.js — rozepsané poznámky přežijí zavření okna, pád prohlížeče i výpadek internetu
// Dokud je otevřené okno Nová poznámka nebo Upravit, ukládá se změněný text průběžně do tohoto prohlížeče.
// Po úspěšném uložení poznámky (room-notes.js volá SBDraft.saved) se koncept smaže. Když při otevření nějaký
// koncept čeká, ukáže se nad editorem lišta s volbou Obnovit / Zahodit, sám se nic nepřepíše.

(function () {
  const PREFIX = 'sb_draft:';
  const MAX_AGE = 14 * 86400000, MAX_DRAFTS = 20, MAX_SIZE = 2000000;   // localStorage má jen kolem 5 MB
  const TARGETS = {
    addModal: { editor: 'noteEditor', title: 'noteTitleInput' },
    editModal: { editor: 'noteEditorEdit', title: 'noteTitleInputEdit' },
  };
  let cur = null;   // { key, editor, title, base, timer, obs, modal }

  const uid = () => (typeof ME !== 'undefined' && ME ? ME.uid : '');
  function keyFor(modalId) {
    const target = modalId === 'addModal' ? 'new' : EDIT_ID + (EDIT_PAGE_ID ? '#' + EDIT_PAGE_ID : '');
    return `${PREFIX}${uid()}:${ROOM_ID}:${target}`;
  }
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
  const drop = key => { try { localStorage.removeItem(key); } catch (_) {} };
  // contenteditable na vzorcích přidává až room-math.js, nesmí to vypadat jako změna textu
  const htmlOf = editor => editor.innerHTML.replace(/ contenteditable="false"/g, '');
  const snapshot = () => htmlOf(cur.editor) + '\u0000' + cur.title.value;

  function allDrafts() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(PREFIX)) out.push([k, read(k)?.t || 0]);
      }
    } catch (_) {}
    return out;
  }
  function prune() {
    const now = Date.now();
    const list = allDrafts().filter(([k, t]) => (now - t > MAX_AGE ? (drop(k), false) : true)).sort((a, b) => b[1] - a[1]);
    list.slice(MAX_DRAFTS).forEach(([k]) => drop(k));
  }

  function write() {
    if (!cur) return;
    clearTimeout(cur.timer);
    if (!cur.dirty) return;   // nic se nezměnilo: čekající koncept zůstává, dokud si uživatel nevybere
    if (snapshot() === cur.base) { drop(cur.key); return; }   // vráceno na původní text
    // Prázdný editor není koncept: buď ho po uložení vyčistila aplikace, nebo text smazal sám uživatel
    if (!cur.editor.textContent.trim() && !cur.editor.querySelector('img, table, hr, .sb-math')) { drop(cur.key); return; }
    const html = htmlOf(cur.editor), title = cur.title.value;
    if (html.length > MAX_SIZE) return;    // velké vložené obrázky by se do prohlížeče nevešly
    const set = () => localStorage.setItem(cur.key, JSON.stringify({ t: Date.now(), html, title }));
    try { set(); }
    catch (_) {   // plno: uvolni nejstarší koncepty a zkus to znovu
      try { allDrafts().sort((a, b) => a[1] - b[1]).slice(0, 5).forEach(([k]) => { if (k !== cur.key) drop(k); }); set(); } catch (_) {}
    }
  }
  const later = () => { if (cur) { cur.dirty = true; clearTimeout(cur.timer); cur.timer = setTimeout(write, 1200); } };

  function hideBar(modal) { modal.querySelector('.draft-bar')?.remove(); }
  function showBar(modal, c, d) {
    hideBar(modal);
    const when = new Date(d.t), today = when.toDateString() === new Date().toDateString();
    const bar = document.createElement('div');
    bar.className = 'draft-bar';
    bar.setAttribute('role', 'status');
    const txt = document.createElement('span');
    txt.textContent = `Máš tu rozepsanou verzi z ${today ? '' : when.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) + ' '}${when.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}.`;
    const yes = document.createElement('button'), no = document.createElement('button');
    yes.type = no.type = 'button';
    yes.className = 'btn btn-primary btn-sm'; yes.textContent = 'Obnovit';
    no.className = 'btn btn-ghost btn-sm'; no.textContent = 'Zahodit';
    yes.addEventListener('click', () => {
      c.editor.innerHTML = d.html;
      c.title.value = d.title || '';
      hideBar(modal);
      c.editor.focus();
    });
    no.addEventListener('click', () => { drop(c.key); hideBar(modal); });
    bar.append(txt, yes, no);
    c.editor.closest('.rich-editor-wrap').before(bar);
  }

  function begin(modal) {
    const t = TARGETS[modal.id];
    const c = { key: keyFor(modal.id), editor: document.getElementById(t.editor), title: document.getElementById(t.title), modal, timer: 0, dirty: false };
    cur = c;
    c.base = snapshot();
    c.obs = new MutationObserver(later);
    c.obs.observe(c.editor, { childList: true, subtree: true, characterData: true, attributes: true });
    c.title.addEventListener('input', later);
    const d = read(c.key);
    if (d && d.html + '\u0000' + (d.title || '') !== c.base) showBar(modal, c, d);
    else { hideBar(modal); if (d) drop(c.key); }
  }
  function end(modal) {
    if (!cur || cur.modal !== modal) return;
    write();   // zavřením okna (Zrušit, křížek) se rozepsaný text neztratí
    cur.obs.disconnect();
    cur.title.removeEventListener('input', later);
    hideBar(modal);
    cur = null;
  }

  function watch(modal) {
    let open = modal.classList.contains('open');
    new MutationObserver(() => {
      const now = modal.classList.contains('open');
      if (now === open) return;
      open = now;
      if (now) begin(modal); else end(modal);
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
  Object.keys(TARGETS).forEach(id => { const m = document.getElementById(id); if (m) watch(m); });
  window.addEventListener('pagehide', write);
  document.addEventListener('visibilitychange', () => { if (document.hidden) write(); });
  prune();

  window.SBDraft = {
    // Poznámka je uložená: koncept už není potřeba a dál se hlídají jen nové změny
    saved() {
      if (!cur) return;
      clearTimeout(cur.timer);
      drop(cur.key);
      cur.base = snapshot();
      cur.dirty = false;
      hideBar(cur.modal);
    },
  };
})();

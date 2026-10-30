// ═══ room-cardify.js — kartička z označeného textu v poznámce
// Pravé tlačítko na označeném textu (v editoru i při čtení poznámky) nabídne „Udělat kartičku“. Na dotykovém displeji
// pravé tlačítko není, tam se u označeného textu ukáže malé tlačítko. Text se předvyplní jako odpověď.
// Host kartičky nedělá, v balíčku místnosti smí přidávat jen vlastník a editor (stejně jako ve firestore.rules).

(function () {
  const AREAS = '.rich-editor, .note-detail-content';
  const LAST_DECK = 'sb_cardify_deck';
  const NEW_DECK = '__new';
  const touch = matchMedia('(pointer: coarse)').matches;
  let menu = null, chip = null, modal = null;

  function selectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const node = sel.anchorNode, el = node?.nodeType === 1 ? node : node?.parentElement;
    if (!el?.closest(AREAS)) return null;
    const text = sel.toString().replace(/\n{3,}/g, '\n\n').trim();
    return text.length >= 2 ? { text, range: sel.getRangeAt(0), el } : null;
  }
  const canUse = () => typeof ME !== 'undefined' && ME && !ME.isAnonymous;

  function closeMenu() { menu?.remove(); menu = null; }
  function hideChip() { chip?.remove(); chip = null; }
  function place(el, x, y) {
    el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, x)) + 'px';
    el.style.top = Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, y)) + 'px';
  }

  function openMenu(x, y, s) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'context-menu cardify-menu';
    const editable = !!s.el.closest('.rich-editor');
    menu.innerHTML = `<button type="button" class="context-menu-item" data-a="card">Udělat kartičku</button>
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-a="copy">Kopírovat</button>
      ${editable ? '<button type="button" class="context-menu-item" data-a="cut">Vyjmout</button>' : ''}`;
    document.body.appendChild(menu);
    place(menu, x, y);
    menu.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });   // označení textu musí zůstat
    menu.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      closeMenu();
      if (a === 'card') openModal_(s.text);
      else document.execCommand(a);
    });
  }

  // ── Okno ──
  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'cardifyModal';
    modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
        <div class="modal-header"><h3 id="cfTitle">Nová kartička</h3><button type="button" class="modal-close" data-cf="close" aria-label="Zavřít">✕</button></div>
        <div class="form-group"><label class="label" for="cfFront">Otázka</label><textarea id="cfFront" class="input" rows="2" placeholder="Na co je označený text odpovědí?"></textarea></div>
        <div class="form-group"><label class="label" for="cfBack">Odpověď</label><textarea id="cfBack" class="input" rows="4"></textarea></div>
        <div class="form-group"><label class="label" for="cfDeck">Balíček</label><select id="cfDeck" class="input"></select>
          <input id="cfNewName" class="input" style="margin-top:8px;" placeholder="Název nového balíčku" maxlength="80" aria-label="Název nového balíčku" hidden></div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-cf="close">Zrušit</button><button type="button" class="btn btn-primary" id="cfSave">Přidat kartičku</button></div>
      </div>`;
    document.body.appendChild(modal);
    const deck = modal.querySelector('#cfDeck'), name = modal.querySelector('#cfNewName');
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-cf="close"]')) closeModal('cardifyModal'); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal('cardifyModal'); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    });
    deck.addEventListener('change', () => { name.hidden = deck.value !== NEW_DECK; if (!name.hidden) name.focus(); });
    modal.querySelector('#cfSave').addEventListener('click', save);
  }

  // Do balíčku místnosti smí vlastník a editor, do svého každý; vestavěné balíčky (sb-…) ne
  async function loadDecks() {
    const [room, mine] = await Promise.all([
      db.collection('decks').where('roomId', '==', ROOM_ID).get().catch(() => ({ docs: [] })),
      db.collection('decks').where('ownerUid', '==', ME.uid).get().catch(() => ({ docs: [] })),
    ]);
    const seen = new Map();
    [...room.docs, ...mine.docs].forEach(d => {
      const k = d.data();
      if (seen.has(d.id) || /^sb-/.test(d.id)) return;
      if (k.ownerUid !== ME.uid && MY_ROLE === 'viewer') return;
      seen.set(d.id, { id: d.id, name: k.name || 'Balíček', inRoom: k.roomId === ROOM_ID, mine: k.ownerUid === ME.uid, count: k.cardCount || 0 });
    });
    return [...seen.values()].sort((a, b) => b.inRoom - a.inRoom || a.name.localeCompare(b.name, 'cs'));
  }
  let DECKS = [];
  async function fillDecks() {
    const sel = modal.querySelector('#cfDeck'), name = modal.querySelector('#cfNewName');
    sel.innerHTML = '<option>Načítám…</option>';
    sel.disabled = true;
    DECKS = await loadDecks();
    const room = DECKS.filter(d => d.inRoom), other = DECKS.filter(d => !d.inRoom);
    const group = (label, list) => list.length ? `<optgroup label="${esc(label)}">${list.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</optgroup>` : '';
    sel.innerHTML = group('Tato místnost', room) + group('Moje balíčky', other) + `<option value="${NEW_DECK}">+ Nový balíček…</option>`;
    let last = '';
    try { last = localStorage.getItem(LAST_DECK) || ''; } catch (_) {}
    sel.value = DECKS.some(d => d.id === last) ? last : (room[0] || other[0])?.id || NEW_DECK;
    sel.disabled = false;
    name.hidden = sel.value !== NEW_DECK;
    if (!name.value) name.value = ROOM?.name || '';
  }

  function openModal_(text) {
    hideChip();
    if (!modal) buildModal();
    modal.querySelector('#cfFront').value = '';
    modal.querySelector('#cfBack').value = text;
    openModal('cardifyModal');
    setTimeout(() => modal.querySelector('#cfFront').focus(), 60);
    fillDecks().catch(e => toast('Chyba: ' + e.message));
  }

  async function save() {
    const front = modal.querySelector('#cfFront').value.trim(), back = modal.querySelector('#cfBack').value.trim();
    const sel = modal.querySelector('#cfDeck'), btn = modal.querySelector('#cfSave');
    if (!front) { toast('Napiš otázku.'); modal.querySelector('#cfFront').focus(); return; }
    if (!back) { toast('Odpověď nemůže být prázdná.'); modal.querySelector('#cfBack').focus(); return; }
    if (sel.disabled) return;
    btn.disabled = true;
    const FV = firebase.firestore.FieldValue;
    try {
      let deckId = sel.value, deckName = DECKS.find(d => d.id === deckId)?.name, mine = DECKS.find(d => d.id === deckId)?.mine;
      if (deckId === NEW_DECK) {
        deckName = modal.querySelector('#cfNewName').value.trim();
        if (!deckName) { toast('Zadej název balíčku.'); btn.disabled = false; return; }
        const ref = await db.collection('decks').add({
          name: deckName, color: ROOM?.color || '#6366f1', description: null, ownerUid: ME.uid,
          roomId: MY_ROLE === 'viewer' ? null : ROOM_ID,   // prohlížeč do místnosti přidávat nesmí, balíček je jeho
          cardCount: 0, createdAt: FV.serverTimestamp(),
        });
        deckId = ref.id; mine = true;
      }
      const deckRef = db.collection('decks').doc(deckId);
      await deckRef.collection('cards').add({
        front, back, authorId: ME.uid, authorName: ME.displayName || ME.email, createdAt: FV.serverTimestamp(),
      });
      if (mine) deckRef.update({ cardCount: FV.increment(1) }).catch(() => {});   // počet smí měnit jen majitel balíčku, jinak ho dorovná otevření balíčku
      try { localStorage.setItem(LAST_DECK, deckId); } catch (_) {}
      closeModal('cardifyModal');
      toast(`Kartička přidána do balíčku ${deckName}`);
    } catch (e) { toast('Chyba: ' + e.message); }
    btn.disabled = false;
  }

  // ── Spouštění ──
  document.addEventListener('contextmenu', e => {
    closeMenu();
    if (!canUse() || !e.target.closest?.(AREAS)) return;
    if (e.target.closest('.rich-editor') && e.target.closest('td, th')) return;   // tabulka v editoru má vlastní nabídku
    const s = selectedText(); if (!s) return;
    const onSelection = [...s.range.getClientRects()].some(r => e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2);
    if (!onSelection) return;   // mimo označení zůstává běžná nabídka prohlížeče
    e.preventDefault();
    openMenu(e.clientX, e.clientY, s);
  });
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', e => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);

  if (touch) {
    let t = 0;
    document.addEventListener('selectionchange', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = canUse() ? selectedText() : null;
        if (!s) { hideChip(); return; }
        if (!chip) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'cardify-chip';
          chip.textContent = 'Udělat kartičku';
          chip.addEventListener('click', () => { const cur = selectedText(); if (cur) openModal_(cur.text); });
          document.body.appendChild(chip);
        }
        const r = s.range.getBoundingClientRect();
        // nativní nabídka prohlížeče bývá nad označením, proto pod ním
        place(chip, r.left, r.bottom + 34);
      }, 250);
    });
  }
})();

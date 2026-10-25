// ═══ deckfilter.js — hledání, filtry a statistiky ve výběru balíčků (všechny hry)
// SBDeckFilter.mount(el, decks, uid, onChange) přidá nahoru do seznamu (el) lištu s hledáním a tlačítkem
// Filtry: místnosti, počet kartiček, stav učení a řazení. Položky seznamu musí mít data-deck-id a uvnitř
// prázdné [data-dkst], kam se vypíše statistika balíčku. Filtr položky jen skrývá — vybrané zůstávají vybrané.
// Statistiky jsou z učení (users/{uid}.learn[deckId]: cards {box, due}, stats {answered, correct, days}).
// Nastavení filtru se pamatuje (localStorage sb_deckfilter, sdílené všemi hrami).
(function () {
  'use strict';
  const LS_KEY = 'sb_deckfilter';
  const DEF = { q: '', off: [], min: 0, learn: '', sort: '' };
  const SORTS = [['', 'Výchozí'], ['name', 'Podle názvu'], ['cards', 'Nejvíc kartiček'], ['due', 'Nejvíc k opakování'], ['weak', 'Nejmíň naučené'], ['last', 'Naposledy učené']];
  const LEARN_F = [['', 'Vše'], ['due', 'Je co opakovat'], ['todo', 'Nedoučené (< 80 %)'], ['new', 'Ještě nezačaté']];
  const MINS = [0, 10, 30, 100];
  let state = read(), open = false, learnP = null, learnUid = null, learnNow = null;   // learnNow = už načtené (pro okamžité překreslení)

  function read() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch (_) { return { ...DEF }; } }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) { /* nic */ } }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const isSb = d => typeof sbIsBuiltin === 'function' && sbIsBuiltin(d.id);
  const rName = d => d.roomName || d._roomName || '';
  const roomKey = d => isSb(d) ? 'sb' : d.roomId || (rName(d) ? 'r:' + rName(d) : 'me');
  const roomLabel = d => isSb(d) ? '📚 Všeobecné' : roomKey(d) === 'me' ? '🗂️ Osobní' : '👥 ' + (rName(d) || 'Místnost');
  const balicku = n => n === 1 ? 'balíček' : n >= 2 && n <= 4 ? 'balíčky' : 'balíčků';

  function loadLearn(uid) {
    if (!uid) return Promise.resolve({});
    if (learnP && learnUid === uid) return learnP;
    learnUid = uid;
    learnNow = null;
    learnP = firebase.firestore().collection('users').doc(uid).get().then(s => (s.exists && s.data().learn) || {}).catch(() => ({})).then(l => { learnNow = l; return l; });
    return learnP;
  }
  function stats(d, learn) {
    const l = learn[d.id] || {}, cards = Object.values(l.cards || {}), now = Date.now(), n = d.cardCount || 0;
    const studied = Math.min(n || Infinity, cards.filter(c => (c.box || 0) >= 1).length);
    const mastered = Math.min(n || Infinity, cards.filter(c => (c.box || 0) >= 4).length);
    const due = cards.filter(c => (c.box || 0) >= 1 && (c.due || 0) <= now).length;
    const st = l.stats || {}, days = Object.entries(st.days || {}).filter(([, v]) => (v.a || 0) > 0).map(([k]) => k).sort();
    return { n, studied, mastered, due, pct: n ? Math.round(mastered / n * 100) : 0, acc: st.answered ? Math.round((st.correct || 0) / st.answered * 100) : null, last: days[days.length - 1] || '' };
  }
  const ago = day => { if (!day) return ''; const d = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(day)) / 864e5); return d <= 0 ? 'dnes' : d === 1 ? 'včera' : `před ${d} dny`; };
  const stText = s => !s.studied ? 'nezačaté' : [s.due ? `🔁 ${s.due} k opakování` : '', `✓ ${s.pct} % naučeno`, s.acc != null ? `🎯 ${s.acc} %` : ''].filter(Boolean).join(' · ');

  function passes(d, s) {
    if (state.q && !String(d.name || '').toLowerCase().includes(state.q.toLowerCase())) return false;
    if (state.off.includes(roomKey(d))) return false;
    if ((d.cardCount || 0) < state.min) return false;
    if (state.learn === 'due' && !s.due) return false;
    if (state.learn === 'todo' && s.pct >= 80) return false;
    if (state.learn === 'new' && s.studied) return false;
    return true;
  }
  function cmp(a, b, sa, sb) {
    switch (state.sort) {
      case 'name': return String(a.name).localeCompare(String(b.name), 'cs');
      case 'cards': return (b.cardCount || 0) - (a.cardCount || 0);
      case 'due': return sb.due - sa.due;
      case 'weak': return sa.pct - sb.pct;
      case 'last': return (sb.last || '').localeCompare(sa.last || '');
      default: return 0;
    }
  }
  const active = () => (state.off.length ? 1 : 0) + (state.min ? 1 : 0) + (state.learn ? 1 : 0) + (state.sort ? 1 : 0);

  function mount(el, decks, uid, onChange) {
    if (!el || !decks?.length) return;
    const byId = new Map(decks.map(d => [String(d.id), d]));
    let learn = (learnUid === uid && learnNow) || {};
    const rooms = [...new Map(decks.map(d => [roomKey(d), roomLabel(d)])).entries()]
      .sort((a, b) => (a[0] === 'me' ? -1 : b[0] === 'me' ? 1 : a[0] === 'sb' ? 1 : b[0] === 'sb' ? -1 : a[1].localeCompare(b[1], 'cs')));
    el.querySelector(':scope > .dkf')?.remove();
    const bar = document.createElement('div'); bar.className = 'dkf';
    el.prepend(bar);

    const draw = () => {
      const n = active();
      bar.innerHTML = `<div class="dkf-top"><input type="search" class="dkf-q" placeholder="🔍 Hledat balíček…" value="${esc(state.q)}" autocomplete="off">
        <button type="button" class="dkf-btn${open ? ' on' : ''}" data-dkf-open aria-expanded="${open}">⚙️ Filtry${n ? ` <span class="dkf-n">${n}</span>` : ''}</button></div>
        ${open ? `<div class="dkf-panel">
          <div class="dkf-row"><span class="dkf-l">Místnosti</span><span class="dkf-chips">${rooms.map(([k, l]) => `<button type="button" class="dkf-chip${state.off.includes(k) ? '' : ' on'}" data-room="${esc(k)}">${esc(l)}</button>`).join('')}</span></div>
          <div class="dkf-row"><span class="dkf-l">Kartiček</span><span class="dkf-chips">${MINS.map(m => `<button type="button" class="dkf-chip${state.min === m ? ' on' : ''}" data-min="${m}">${m ? m + '+' : 'Libovolně'}</button>`).join('')}</span></div>
          <div class="dkf-row"><span class="dkf-l">Učení</span><span class="dkf-chips">${LEARN_F.map(([k, l]) => `<button type="button" class="dkf-chip${state.learn === k ? ' on' : ''}" data-learn="${k}">${l}</button>`).join('')}</span></div>
          <div class="dkf-row"><span class="dkf-l">Seřadit</span><select class="dkf-sort">${SORTS.map(([k, l]) => `<option value="${k}"${state.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
            ${n || state.q ? '<button type="button" class="dkf-reset" data-dkf-reset>Zrušit filtry</button>' : ''}</div>
          <div class="dkf-sum" data-dkf-sum></div></div>` : ''}`;
      const q = bar.querySelector('.dkf-q');
      q.oninput = () => { state.q = q.value; save(); apply(); };
      bar.querySelector('[data-dkf-open]').onclick = () => { open = !open; draw(); apply(); };
      bar.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { const k = b.dataset.room; state.off = state.off.includes(k) ? state.off.filter(x => x !== k) : [...state.off, k]; save(); draw(); apply(); });
      bar.querySelectorAll('[data-min]').forEach(b => b.onclick = () => { state.min = +b.dataset.min; save(); draw(); apply(); });
      bar.querySelectorAll('[data-learn]').forEach(b => b.onclick = () => { state.learn = b.dataset.learn; save(); draw(); apply(); });
      const so = bar.querySelector('.dkf-sort'); if (so) so.onchange = () => { state.sort = so.value; save(); draw(); apply(); };
      const rs = bar.querySelector('[data-dkf-reset]'); if (rs) rs.onclick = () => { state = { ...DEF }; save(); draw(); apply(); };
    };

    // skrýt / seřadit položky, vypsat statistiky a souhrn vybraných
    const apply = () => {
      const items = [...el.querySelectorAll('[data-deck-id]')];
      const meta = new Map(items.map(it => { const d = byId.get(it.dataset.deckId); return [it, d ? { d, s: stats(d, learn) } : null]; }));
      items.forEach(it => {
        const m = meta.get(it); if (!m) return;
        it.hidden = !passes(m.d, m.s);
        const st = it.querySelector('[data-dkst]'); if (st) st.textContent = stText(m.s);
      });
      // řazení v rámci každé skupiny (rodič položek)
      new Set(items.map(it => it.parentElement)).forEach(par => {
        const kids = items.filter(it => it.parentElement === par && meta.get(it));
        const order = state.sort ? [...kids].sort((x, y) => cmp(meta.get(x).d, meta.get(y).d, meta.get(x).s, meta.get(y).s)) : kids.sort((x, y) => (+x.dataset.dkIdx || 0) - (+y.dataset.dkIdx || 0));
        order.forEach(it => par.appendChild(it));
      });
      el.querySelectorAll('.mc-dgrp').forEach(g => { g.hidden = !g.querySelector('[data-deck-id]:not([hidden])'); });
      let empty = el.querySelector(':scope > .dkf-empty');
      const none = items.length && !items.some(it => !it.hidden);
      if (none && !empty) { empty = document.createElement('div'); empty.className = 'dkf-empty'; empty.textContent = 'Filtru neodpovídá žádný balíček.'; el.appendChild(empty); }
      if (!none) empty?.remove();
      summary(items, meta);
      onChange?.();
    };
    const summary = (items, meta) => {
      const box = bar.querySelector('[data-dkf-sum]'); if (!box) return;
      const sel = items.filter(it => it.querySelector('input:checked') || it.classList.contains('selected')).map(it => meta.get(it)).filter(Boolean);
      const shown = items.filter(it => !it.hidden).length, hiddenSel = sel.filter(m => !passes(m.d, m.s)).length;
      if (!sel.length) { box.innerHTML = `Zobrazeno <b>${shown}</b> z ${items.length} balíčků. Vyber balíčky a uvidíš jejich souhrn.`; return; }
      const n = sel.reduce((a, m) => a + m.s.n, 0), due = sel.reduce((a, m) => a + m.s.due, 0), mast = sel.reduce((a, m) => a + m.s.mastered, 0);
      box.innerHTML = `${sel.length >= 2 && sel.length <= 4 ? 'Vybrány' : 'Vybráno'} <b>${sel.length}</b> ${balicku(sel.length)} · <b>${n}</b> kartiček · 🔁 <b>${due}</b> k opakování · ✓ <b>${n ? Math.round(mast / n * 100) : 0} %</b> naučeno${hiddenSel ? ` · <span class="dkf-warn">${hiddenSel} z vybraných skrývá filtr</span>` : ''}`;
    };

    el.querySelectorAll('[data-deck-id]').forEach((it, i) => { if (it.dataset.dkIdx == null) it.dataset.dkIdx = i; });
    if (!el._dkfWired) { el._dkfWired = true; el.addEventListener('change', () => el._dkfSum?.()); el.addEventListener('click', e => { if (e.target.closest('[data-deck-id]')) setTimeout(() => el._dkfSum?.(), 0); }); }
    el._dkfSum = () => { const items = [...el.querySelectorAll('[data-deck-id]')]; summary(items, new Map(items.map(it => { const d = byId.get(it.dataset.deckId); return [it, d ? { d, s: stats(d, learn) } : null]; }))); };
    draw(); apply();
    loadLearn(uid).then(l => { learn = l; if (bar.isConnected) apply(); });
  }
  // jen viditelné položky (pro „Vybrat vše“ ve skupinách)
  const visible = item => !item.closest('[hidden]');
  window.SBDeckFilter = { mount, visible, stats, loadLearn };
})();

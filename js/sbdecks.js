// ═══ sbdecks.js — vestavěné balíčky „Pro všechny" (matematika, dějepis, čeština…)
// Nejsou ve Firestoru: kartičky leží v data/decks/<okruh>.json a vidí je každý.
// Jsou jen ke čtení (nikdo je nesmaže ani nepřepíše); pokrok v učení se ukládá
// stejně jako u ostatních balíčků (users/{uid}.learn[id]).
// Karta v souboru: [otázka, odpověď, [špatné odpovědi], [další správné odpovědi]?]
const SB_DECKS = [
  { id: 'sb-matematika', name: 'Matematika', color: '#2563eb', count: 89 },
  { id: 'sb-fyzika', name: 'Fyzika', color: '#7c3aed', count: 88 },
  { id: 'sb-chemie', name: 'Chemie', color: '#059669', count: 88 },
  { id: 'sb-biologie', name: 'Biologie', color: '#16a34a', count: 90 },
  { id: 'sb-dejepis', name: 'Dějepis', color: '#b45309', count: 87 },
  { id: 'sb-zemepis', name: 'Zeměpis', color: '#0891b2', count: 90 },
  { id: 'sb-obcanka', name: 'Občanka a společnost', color: '#9333ea', count: 89 },
  { id: 'sb-cestina', name: 'Čeština – mluvnice', color: '#dc2626', count: 87 },
  { id: 'sb-literatura', name: 'Literatura', color: '#c2410c', count: 88 },
  { id: 'sb-anglictina', name: 'Angličtina', color: '#1d4ed8', count: 90 },
  { id: 'sb-informatika', name: 'Informatika', color: '#0f766e', count: 89 },
  { id: 'sb-vseobecne', name: 'Všeobecné znalosti', color: '#db2777', count: 90 },
];
const SB_OWNER = 'studyboard', SB_LABEL = 'Pro všechny';

function sbIsBuiltin(id) { return /^sb-/.test(String(id || '')); }
// Data balíčku ve tvaru jako dokument z Firestoru (pro seznamy a stránku balíčku)
function sbDeckData(id) {
  const d = SB_DECKS.find(x => x.id === id);
  if (!d) return null;
  return { name: d.name, color: d.color, cardCount: d.count, kind: 'learn', kinds: { info: 0, learn: d.count, quiz: 0 },
           ownerUid: SB_OWNER, builtin: true, roomName: SB_LABEL };
}
// Balíčky jako objekty { id, ...data } (výběr balíčků ve hrách)
function sbDeckList() { return SB_DECKS.map(d => ({ id: d.id, ...sbDeckData(d.id) })); }
// Jako dokumenty Firestoru: { id, exists, data() } (nástěnka)
function sbDeckDocs() { return SB_DECKS.map(d => ({ id: d.id, exists: true, data: () => sbDeckData(d.id) })); }

const SB_CACHE = new Map();
// Kartičky balíčku ve tvaru jako z Firestoru: { id, front, back, distractors, corrects, order }
function sbDeckCards(id) {
  if (!sbIsBuiltin(id)) return Promise.resolve([]);
  if (!SB_CACHE.has(id)) {
    const v = typeof APP_VERSION === 'string' ? APP_VERSION : '';
    SB_CACHE.set(id, fetch('data/decks/' + id.slice(3) + '.json?v=' + v)
      .then(r => { if (!r.ok) throw new Error('Balíček se nepodařilo načíst (' + r.status + ')'); return r.json(); })
      .then(list => list.map(([front, back, wrong, also], i) => ({
        id: id + '-' + i, front: String(front), back: String(back),
        distractors: (wrong || []).map(String), corrects: (also || []).map(String), order: i,
      })))
      .catch(e => { SB_CACHE.delete(id); throw e; }));
  }
  return SB_CACHE.get(id);
}

// ── Výběr balíčků ve hrách: dvě sbalovací kategorie, každá s vlastním „Vybrat vše“.
// Sbalení se pamatuje (localStorage sb_deckgrp, sdílené všemi hrami). Používá mcgame.js i Zombie Survival (game.js).
const MC_GRP = [['own', '🗂️ Moje karty'], ['sb', '📚 Všeobecné karty']];
function mcGrpFolded() { try { return JSON.parse(localStorage.getItem('sb_deckgrp') || '{}'); } catch (_) { return {}; } }
function mcGrpFold(g, v) { const f = mcGrpFolded(); f[g] = v; try { localStorage.setItem('sb_deckgrp', JSON.stringify(f)); } catch (_) { /* nic */ } }
// Obal skupiny (sdílí ho i Zombie Survival): items = hotové HTML položek, n = počet balíčků
function mcGrpHTML(g, title, items, n, allLabel = 'Vybrat vše') {
  return `<div class="mc-dgrp${mcGrpFolded()[g] ? ' folded' : ''}" data-grp="${g}"><div class="mc-dgrp-h">
    <button type="button" class="mc-dgrp-t" data-fold aria-expanded="${!mcGrpFolded()[g]}"><span class="mc-dgrp-arr" aria-hidden="true"></span><b>${title}</b><span class="mc-dgrp-n" data-grpn>${n}</span></button>
    <button type="button" class="btn btn-ghost btn-sm" data-grpall>${allLabel}</button></div><div class="mc-dgrp-list">${items}</div></div>`;
}
function mcWireGroups(el, onAll) {
  el.querySelectorAll('.mc-dgrp').forEach(grp => {
    grp.querySelector('[data-fold]').onclick = e => { const f = grp.classList.toggle('folded'); e.currentTarget.setAttribute('aria-expanded', !f); mcGrpFold(grp.dataset.grp, f); };
    grp.querySelector('[data-grpall]').onclick = () => onAll(grp.dataset.grp);
  });
}

// ── Balíčky v čekárně: uloží se do dokumentu hry (pole decks), aby ostatní hráči viděli, z čeho se hraje
function sbLobbyDecks(ds) { return (ds || []).filter(Boolean).slice(0, 40).map(d => ({ n: String(d.name || 'Balíček').slice(0, 80), c: d.cardCount || 0 })); }
function sbLobbyDecksHTML(list, label = '🃏 Balíčky') {
  if (!list || !list.length) return '';
  const e = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  return `<div class="sb-ldecks"><span class="sb-ldecks-l">${label}</span>${list.map(d => `<span class="sb-ldeck">${e(d.n)}<small>${d.c}</small></span>`).join('')}</div>`;
}

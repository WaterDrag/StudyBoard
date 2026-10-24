// ═══ td.js — rozhraní hry Obrana království (úvod, HUD, panel staveb a
// vylepšení, svitky z kartiček, hlavní smyčka). Simulace je v td-engine.js,
// kreslení v td-render.js, data v td-data.js.

const SEL_KEY = 'td_decks', PREF_KEY = 'td_pref', BEST_KEY = 'td_best';
const DMG_LABEL = { sharp: 'ostré', explosion: 'výbušné', freeze: 'mráz', energy: 'oheň', magic: 'magie', normal: 'pravé', true: 'pravé', none: '—' };
const CAT_LABEL = { basic: 'Základní', military: 'Vojenské', magic: 'Magické', support: 'Podpora' };
const TARGETS = [['first', 'První'], ['last', 'Poslední'], ['strong', 'Nejsilnější'], ['close', 'Nejbližší']];
let DECKS = [], getDecks = () => [], POOL = [], CARDQ = [];
let pref = { map: TD.maps[0].id, hero: TD.heroes[0].id, diff: 'medium', mode: 'solo' };
try { pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch (_) { /* nic */ }
const view = { sel: null, ghost: null, placing: null, pointer: null, tab: 'def' };

/* ── Vlastní obtížnosti: 5 slotů v prohlížeči ───────────────────── */
const CUSTOM_KEY = 'td_custom';
const CUST_OPTS = [   // [klíč, popisek, nabídka hodnot, výchozí, formát]
  ['lives', '❤️ Životy hradu', [1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000], 150, v => v],
  ['gold', '🪙 Zlaťáky na začátku', [0, 100, 250, 400, 650, 1000, 1500, 2500, 5000, 10000, 25000], ECON.singleplayer.starting_gold, v => v],
  ['income', '💰 Násobek příjmů', [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5], 1, v => '×' + v],
  ['cost', '🏗️ Ceny věží', [0.25, 0.5, 0.75, 0.85, 1, 1.25, 1.5, 2], 1, v => '×' + v],
  ['count', '🟢 Počet slizáků', [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3], 1, v => '×' + v],
  ['hp', '💪 Životy slizáků', [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10], 1, v => '×' + v],
  ['speed', '💨 Rychlost slizáků', [0.5, 0.75, 1, 1.25, 1.5, 2], 1, v => '×' + v],
  ['km', '💎 Krystaly ze svitků', [0.5, 1, 1.5, 2, 3, 5], 1, v => '×' + v],
  ['waves', '🏁 Vítězství po vlně', [10, 15, 20, 25, 30, 40], 40, v => v],
];
function custDefaults(i) { const o = { name: 'Vlastní ' + (i + 1) }; for (const [k, , , d] of CUST_OPTS) o[k] = d; return o; }
function custSlots() {
  let a = [];
  try { a = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (_) { /* nic */ }
  return [0, 1, 2, 3, 4].map(i => a[i] ? { ...custDefaults(i), ...a[i] } : null);
}
function saveSlots(sl) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(sl)); } catch (_) { toast('Prohlížeč nedovolil uložit nastavení.'); } }
// Vybraná obtížnost jako cfg pro newGame (null = některá ze tří základních)
function curCfg() { const m = /^c([1-5])$/.exec(pref.diff); return m ? custSlots()[m[1] - 1] : null; }
function custSummary(c) {
  const parts = [`${c.lives} ❤️`, `${c.gold} zl`];
  for (const [k, label, , d, f] of CUST_OPTS.slice(2)) if (c[k] !== d) parts.push(`${label.split(' ')[0]} ${f(c[k])}`);
  return parts.join(' · ');
}
function openCustom(i) {
  const slots = custSlots(), had = !!slots[i], c = { ...(slots[i] || custDefaults(i)) };
  let ov = $('tdCustom');
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'td-modal'; ov.id = 'tdCustom';
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-cust-close]')) ov.hidden = true; });
    document.body.appendChild(ov);
  }
  const row = ([k, label, vals, , f]) => { const idx = Math.max(0, vals.indexOf(c[k])); return `<label class="td-cust-row"><span>${label}</span>
    <input type="range" min="0" max="${vals.length - 1}" step="1" value="${idx}" data-ck="${k}"><output data-co="${k}">${f(vals[idx])}</output></label>`; };
  ov.innerHTML = `<div class="td-tree-box td-cust-box" role="dialog" aria-label="Vlastní obtížnost">
    <div class="td-tree-head"><div><b>⚙️ Vlastní obtížnost · slot ${i + 1}</b><small>Nastavení se uloží v tomhle prohlížeči. Rekord se počítá zvlášť pro každý slot.</small></div>
      <button type="button" class="icon-btn" data-cust-close aria-label="Zavřít">✕</button></div>
    <label class="td-cust-name"><span>Název</span><input type="text" maxlength="24" id="tdCustName" value="${esc(c.name)}"></label>
    <div class="td-cust-grid">${CUST_OPTS.map(row).join('')}</div>
    <div class="td-cust-presets"><span>Začít z:</span>${[['easy', 'Lehká'], ['medium', 'Střední'], ['hard', 'Těžká']].map(([k, n]) => `<button type="button" class="btn btn-ghost btn-sm" data-cpre="${k}">${n}</button>`).join('')}</div>
    <div class="mc-end-actions">
      <button type="button" class="btn btn-primary" id="tdCustSave">Uložit a vybrat</button>
      ${had ? '<button type="button" class="btn btn-ghost" id="tdCustDel">🗑️ Smazat slot</button>' : ''}
      <button type="button" class="btn btn-secondary" data-cust-close>Zrušit</button>
    </div></div>`;
  const opt = k => CUST_OPTS.find(x => x[0] === k);
  const show = k => { ov.querySelector(`[data-co="${k}"]`).textContent = opt(k)[4](c[k]); };
  ov.querySelectorAll('[data-ck]').forEach(inp => inp.addEventListener('input', () => { const k = inp.dataset.ck; c[k] = opt(k)[2][+inp.value]; show(k); }));
  ov.querySelectorAll('[data-cpre]').forEach(b => b.addEventListener('click', () => {   // základ podle Lehké / Střední / Těžké
    const [lives, cost] = { easy: [200, 0.85], medium: [150, 1], hard: [100, 1.08] }[b.dataset.cpre];
    Object.assign(c, custDefaults(i), { name: c.name, lives, cost });
    ov.querySelectorAll('[data-ck]').forEach(inp => { const k = inp.dataset.ck, vals = opt(k)[2]; let j = vals.indexOf(c[k]);
      if (j < 0) { j = vals.reduce((bi, v, vi) => Math.abs(v - c[k]) < Math.abs(vals[bi] - c[k]) ? vi : bi, 0); }
      inp.value = j; show(k); });
  }));
  $('tdCustSave').onclick = () => {
    c.name = $('tdCustName').value.trim().slice(0, 24) || custDefaults(i).name;
    const sl = custSlots(); sl[i] = c; saveSlots(sl);
    pref.diff = 'c' + (i + 1); savePref(); ov.hidden = true; renderSetup();
  };
  if (had) $('tdCustDel').onclick = () => {
    if (!confirm(`Smazat „${c.name}“?`)) return;
    const sl = custSlots(); sl[i] = null; saveSlots(sl);
    try { const b = JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); for (const k of Object.keys(b)) if (k.endsWith(':c' + (i + 1))) delete b[k]; localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (_) { /* nic */ }
    if (pref.diff === 'c' + (i + 1)) { pref.diff = 'medium'; savePref(); }
    ov.hidden = true; renderSetup();
  };
  ov.hidden = false;
  $('tdCustName').focus();
}
const JOIN_GID = new URLSearchParams(location.search).get('g');
let speed = 1, paused = false, running = false, lastFrame = 0, acc = 0, cardOpen = null, panelSig = '', hudSig = '';
const fmt = n => Math.floor(n).toLocaleString('cs-CZ');
(window.SB_EXTRA_SETTINGS = window.SB_EXTRA_SETTINGS || []).push({
  label: '🎨 Nová grafika', get: () => gfxNow() !== '0',
  set: on => {   // vypnutí = Kreslená; zapnutí vrátí poslední texturový styl (Super nebo Detailní)
    try { const cur = gfxNow(); if (!on && cur !== '0') localStorage.setItem('td_gfx_tex', cur); localStorage.setItem('td_gfx', on ? (localStorage.getItem('td_gfx_tex') || '1') : '0'); } catch (_) { /* nic */ }
    _towerIcoReset(); if (G) renderSide(true);
  },
});

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  if (JOIN_GID) {
    GID = JOIN_GID;
    try { const snap = await tdRef().get(); LOBBY = snap.exists ? snap.data() : null; } catch (_) { LOBBY = null; }
    if (!LOBBY) { toast('Hra už neexistuje.'); history.replaceState(null, '', 'obrana.html'); GID = null; }
    else if (LOBBY.status !== 'lobby' && !LOBBY.playerIds.includes(ME.uid)) { toast('Tahle bitva už začala bez tebe.'); history.replaceState(null, '', 'obrana.html'); GID = null; LOBBY = null; }
    else if (LOBBY.status === 'play') { toast('Bitva už běží — rozehranou mapu po obnovení stránky nejde vrátit.'); history.replaceState(null, '', 'obrana.html'); GID = null; LOBBY = null; }
  }
  renderSetup();
  // Do bitvy s otázkami od hostitele: balíčky se nevybírají, všichni mají stejné svitky
  if (GID && LOBBY?.cards?.length) { $('tdDeckStep').hidden = true; $('tdStart').disabled = false; $('tdStart').onclick = startGame; return; }
  try { DECKS = await mcLoadDecks(); } catch (e) { $('tdDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  getDecks = mcDeckPicker({ list: 'tdDecks', all: 'tdAll', start: 'tdStart', hint: 'tdHint', key: SEL_KEY, decks: DECKS,
    hintFor: n => `${n} kartiček připraveno na svitky.` });
  $('tdStart').onclick = startGame;
});

/* ── Úvodní obrazovka ──────────────────────────────────────────── */
function bestOf(map, diff) { try { return (JSON.parse(localStorage.getItem(BEST_KEY) || '{}'))[map + ':' + diff] || 0; } catch (_) { return 0; } }
function renderSetup() {
  const joining = !!(GID && LOBBY), vs = joining || pref.mode === 'vs';
  $('tdModes').innerHTML = [['solo', '🧑 Sám', '40 vln proti počítači'], ['vs', '⚔️ S přáteli', 'Versus 2–4 hráčů: posílej soupeřům slizáky']]
    .map(([k, n, d]) => `<button type="button" class="td-opt${pref.mode === k ? ' on' : ''}" data-mode="${k}"><b>${n}</b><small>${d}</small></button>`).join('');
  $('tdModes').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; pref.mode = b.dataset.mode; savePref(); renderSetup(); };
  $('tdModeStep').hidden = joining;
  renderGfxPicker();
  $('tdMapStep').hidden = joining;
  $('tdDiffStep').hidden = vs;
  $('tdJoinInfo').hidden = !joining;
  if (joining) $('tdJoinInfo').innerHTML = `⚔️ <b>${esc(LOBBY.hostName)}</b> tě zve do bitvy na mapě <b>${esc(TD.maps.find(m => m.id === LOBBY.map)?.name || '')}</b>. Vyber si hrdinu${LOBBY.cards?.length ? ` — svitky jsou ze stejných balíčků jako u hostitele (${LOBBY.cards.length} kartiček)` : ' a balíčky na svitky'}.`;
  if (!$('tdStart').dataset.busy) $('tdStart').textContent = joining ? 'Připojit se' : vs ? 'Založit bitvu' : 'Hrát';
  const maps = $('tdMaps');
  maps.innerHTML = TD.maps.map(m => `<button type="button" class="td-opt td-map${pref.map === m.id ? ' on' : ''}" data-map="${m.id}">
      <span class="td-map-img" data-prev="${m.id}"></span><b>${esc(m.name)}</b><small>${m.difficulty === 'easy' ? 'Snadná · jedna cesta' : 'Střední · dvě cesty'}</small></button>`).join('');
  maps.querySelectorAll('[data-prev]').forEach(el => {
    const c = TR.mapPreview(TD.maps.find(m => m.id === el.dataset.prev), 260, 180); c.className = 'td-prev'; el.appendChild(c);
  });
  maps.onclick = e => { const b = e.target.closest('[data-map]'); if (!b) return; pref.map = b.dataset.map; savePref(); renderSetup(); };
  $('tdHeroes').innerHTML = TD.heroes.map(h => `<button type="button" class="td-opt td-hero${pref.hero === h.id ? ' on' : ''}" data-hero="${h.id}">
      <span class="td-hero-ico" style="--hc:${h.col}">${heroIco(h)}</span><b>${esc(h.name)}</b><small>${esc(h.role)}</small>
      <small class="td-hero-pass">📜 ${esc(h.passive.name)}: ${esc(h.passive.description)}</small><small class="td-hero-cost">${h.base.cost} zl</small></button>`).join('');
  $('tdHeroes').onclick = e => { const b = e.target.closest('[data-hero]'); if (!b) return; pref.hero = b.dataset.hero; savePref(); renderSetup(); };
  const D = { easy: ['Lehká', '200 životů, věže o 15 % levnější'], medium: ['Střední', '150 životů, běžné ceny'], hard: ['Těžká', '100 životů, věže o 8 % dražší'] };
  $('tdDiffs').innerHTML = Object.entries(D).map(([k, [n, d]]) => { const b = bestOf(pref.map, k);
    return `<button type="button" class="td-opt${pref.diff === k ? ' on' : ''}" data-diff="${k}"><b>${n}</b><small>${d}</small>${b ? `<small class="td-best">🏆 vlna ${b}</small>` : ''}</button>`; }).join('');
  const slots = custSlots();
  if (/^c[1-5]$/.test(pref.diff) && !slots[pref.diff[1] - 1]) pref.diff = 'medium';
  $('tdDiffs').innerHTML += `<div class="td-cust-h">⚙️ Vlastní obtížnosti</div>` + slots.map((c, i) => {
    if (!c) return `<button type="button" class="td-opt td-cust-empty" data-cedit="${i}"><b>+ Volný slot ${i + 1}</b><small>Nastav si životy, peníze, slizáky…</small></button>`;
    const k = 'c' + (i + 1), b = bestOf(pref.map, k);
    return `<div class="td-cust-slot"><button type="button" class="td-opt${pref.diff === k ? ' on' : ''}" data-diff="${k}"><b>${esc(c.name)}</b><small>${esc(custSummary(c))}</small>${b ? `<small class="td-best">🏆 vlna ${b}</small>` : ''}</button>
      <button type="button" class="td-cust-edit" data-cedit="${i}" title="Upravit" aria-label="Upravit ${esc(c.name)}">✏️</button></div>`;
  }).join('');
  $('tdDiffs').onclick = e => {
    const ed = e.target.closest('[data-cedit]'); if (ed) { openCustom(+ed.dataset.cedit); return; }
    const b = e.target.closest('[data-diff]'); if (!b) return; pref.diff = b.dataset.diff; savePref(); renderSetup();
  };
}
function savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (_) { /* nic */ } }

async function startGame() {
  const ds = getDecks();
  const btn = $('tdStart'), label = btn.textContent; btn.disabled = true; btn.dataset.busy = '1'; btn.textContent = 'Připravuji svitky…';
  if (GID && LOBBY?.cards?.length) { POOL = unpackCards(LOBBY.cards); POOL.all = POOL; }
  else try { const all = await mcLoadCards(ds); POOL = all.filter(c => mcOptions(c, all)); POOL.all = all; } catch (_) { POOL = []; }
  if (!POOL.length) { btn.disabled = false; delete btn.dataset.busy; btn.textContent = label; toast('Z vybraných balíčků nejde sestavit otázky s možnostmi — přidej balíček s víc kartičkami.'); return; }
  if (POOL.length < 8) toast(`Ve vybraných balíčcích je jen ${POOL.length} otázek — budou se často opakovat.`);
  CARDQ = shuffle(POOL);
  if (GID || pref.mode === 'vs') {
    try { if (GID) await vsJoin(); else await vsCreate(); } catch (e) { toast('Nepovedlo se: ' + e.message); }
    btn.disabled = false; delete btn.dataset.busy; btn.textContent = label;
    return;
  }
  btn.disabled = false; delete btn.dataset.busy; btn.textContent = label;
  newGame(pref.map, pref.hero, pref.diff, null, curCfg());
  G.onLose = () => setTimeout(() => endGame(false), 900);
  G.onWin = () => { paused = true; $('tdWinDesc').textContent = `Ubránil jsi všech ${winWave()} vln. Můžeš pokračovat ve volné hře — slizáci budou čím dál silnější.`; $('tdWin').hidden = false; window.sfx?.('win'); };
  G.onWaveEnd = w => { saveBest(); if (w === 1) toast('Mezi vlnami je 15 s pauza. Další vlna se spustí sama, nebo dřív tlačítkem ⏭ (bonus zlaťáky).'); };
  beginPlay();
  toast('Vyber věž vpravo a polož ji vedle cesty. Až budeš připravený, dej ▶ Start.');
}
// Společné pro sólo i versus: přepnout na hru a rozjet smyčku
function beginPlay() {
  tipSeen = new Set(); tipQueue = []; hideTip(true);
  ['tdSetup', 'tdEnd', 'tdLobby'].forEach(id => { $(id).hidden = true; });
  $('tdGame').hidden = false;
  $('tdGame').classList.toggle('td-vs', !!NET);
  ['hudSpeed', 'hudPause'].forEach(id => { $(id).hidden = !!NET; });
  $('hudEcoWrap').hidden = !NET;
  $('tdOpps').hidden = !NET;
  view.sel = null; view.placing = null; view.ghost = null; speed = 1; paused = false; panelSig = '';
  setupCanvas();
  running = true; lastFrame = performance.now(); acc = 0;
  requestAnimationFrame(frame);
  renderSide(true);
}
function saveBest() {
  if (NET) return;
  try { const b = JSON.parse(localStorage.getItem(BEST_KEY) || '{}'), k = G.map.id + ':' + G.diff; if ((b[k] || 0) < G.stats.wavesDone) { b[k] = G.stats.wavesDone; localStorage.setItem(BEST_KEY, JSON.stringify(b)); } } catch (_) { /* nic */ }
}
function endGame(won) {
  running = false; saveBest();
  recordPlayPoints(G.stats.wavesDone * 4 + G.cardsOk * 3 + (NET && won ? 30 : 0));
  if (NET) {
    $('tdGame').hidden = true; $('tdEnd').hidden = false; closeCard(true);
    $('tdEndIco').textContent = won ? '🏆' : '💥';
    $('tdEndTitle').textContent = won ? (NET.teams ? 'Váš tým vyhrál!' : 'Vyhrál(a) jsi bitvu!') : `Hrad padl — ${NET.place}. místo`;
    $('tdEndDesc').textContent = won ? `Ubránil(a) ses až do vlny ${G.wave}. Za ubráněné poslané slizáky jsi dostal(a) ${fmt(G.stats.bounty || 0)} zl.` : `Slizáci prolomili bránu ve vlně ${G.wave}.`;
    $('tdEndStats').innerHTML = [
      ['🌊', 'Vlna', G.wave], ['⚔️', 'Posláno slizáků', `za ${fmt(NET.sentGold)} zl`], ['💰', 'Konečný příjem', fmt(G.vs.eco) + ' zl'],
      ['📜', 'Svitky správně', `${G.cardsOk} / ${G.cardsOk + G.cardsBad}`], ['🏰', 'Postavené věže', G.towers.length],
    ].map(([i, l, v]) => `<div><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('');
    $('tdEndRank').innerHTML = vsEndRows();
    window.sfx?.(won ? 'win' : 'lose');
    return;
  }
  $('tdGame').hidden = true; $('tdEnd').hidden = false; $('tdWin').hidden = true; closeCard(true);
  $('tdEndRank').innerHTML = '';
  $('tdEndIco').textContent = won ? '👑' : '💥';
  $('tdEndTitle').textContent = won ? 'Království ubráněno!' : 'Hrad padl';
  $('tdEndDesc').textContent = won ? `Vydržel jsi až do vlny ${G.wave}.` : `Slizáci prolomili bránu ve vlně ${G.wave}.`;
  $('tdEndStats').innerHTML = [
    ['🌊', 'Ubráněné vlny', G.stats.wavesDone], ['🫧', 'Prasknutí slizáci', fmt(G.stats.pops)], ['🪙', 'Vydělané zlaťáky', fmt(G.stats.earned)],
    ['📜', 'Svitky správně', `${G.cardsOk} / ${G.cardsOk + G.cardsBad}`], ['🏰', 'Postavené věže', G.towers.length],
  ].map(([i, l, v]) => `<div><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('');
  window.sfx?.(won ? 'win' : 'lose');
}
$('tdAgain').onclick = () => { if (NET) { vsStop(); location.href = 'obrana.html'; return; } $('tdEnd').hidden = true; $('tdSetup').hidden = false; renderSetup(); };
$('tdWinGo').onclick = () => { $('tdWin').hidden = true; paused = false; };
$('tdWinEnd').onclick = () => endGame(true);

/* ── Canvas, souřadnice, ovládání myší a dotykem ──────────────── */
let cv, g2, dpr = 1;
function setupCanvas() {
  cv = $('tdCanvas'); g2 = cv.getContext('2d');
  const fit = () => {
    const w = $('tdStage').clientWidth || 800;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = w + 'px'; cv.style.height = (w * TH / TW) + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * TH / TW * dpr);
  };
  fit(); window.onresize = fit;
  // ztráta grafického kontextu (málo paměti, přepnutí karty…) — po obnovení vše překreslit
  cv.addEventListener('contextlost', e => e.preventDefault());
  cv.addEventListener('contextrestored', () => { g2 = cv.getContext('2d'); TR.clearCaches(); _towerIcoReset(); });
  cv.onpointermove = e => { view.pointer = worldPos(e); if (G) G.cursor = view.pointer; updateGhost(); };
  cv.onpointerleave = () => { view.pointer = null; if (view.ghost && !view.touchGhost) view.ghost = null; };
  cv.onpointerdown = e => {
    const p = worldPos(e); view.pointer = p;
    if (e.button === 2) { view.pick = null; cancelPlacing(); return; }
    if (view.pick) {   // volba místa pro věž (terč moždíře, hlídka gryfa)
      const { kind, t } = view.pick; view.pick = null;
      if (kind === 'aim') { t.aim = { x: p.x, y: p.y }; t.follow = false; }
      else if (t.gryf) { t.gryf.pt = { x: p.x, y: p.y }; t.gryf.mode = 'patrol'; }
      window.sfx?.('click'); view.sel = t; renderSide(true); return;
    }
    if (view.placing) {
      if (e.pointerType === 'touch' && !view.touchGhost) { view.touchGhost = true; updateGhost(); return; }   // první klepnutí jen ukáže, kam to padne
      tryPlace(p); return;
    }
    clickWorld(p);
  };
  cv.oncontextmenu = e => e.preventDefault();
}
function worldPos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * TW, y: (e.clientY - r.top) / r.height * TH }; }
function updateGhost() {
  if (!view.placing || !view.pointer) { view.ghost = null; return; }
  const { x, y } = view.pointer, type = view.placing;
  let bad = view.placing === 'moveHero' ? placeProblem(G.hero.id, x, y, G.hero) : placeProblem(type, x, y);
  const cost = type === 'moveHero' ? 250 : HDEF[type] ? heroCost(type) : towerCost(type, x, y);
  if (!bad && G.gold < cost) bad = 'Málo zlaťáků';
  view.ghost = { type: type === 'moveHero' ? G.hero.id : type, x, y, bad };
}
function tryPlace(p) {
  const type = view.placing;
  let why;
  if (type === 'moveHero') why = moveHero(p.x, p.y);
  else if (HDEF[type]) why = placeHero(type, p.x, p.y);
  else why = placeTower(type, p.x, p.y);
  if (why) { toast(why); window.sfx?.('bad'); return; }
  const placed = type === 'moveHero' || HDEF[type] ? G.hero : G.towers[G.towers.length - 1];
  const keep = !HDEF[type] && type !== 'moveHero' && keyShift && G.gold >= towerCost(type, p.x, p.y);
  if (!keep) { cancelPlacing(); view.sel = placed; }
  renderSide(true);
}
let keyShift = false;
function cancelPlacing() { view.placing = null; view.ghost = null; view.touchGhost = false; renderSide(true); }
function clickWorld(p) {
  // nejbližší věž v okruhu, který odpovídá kresbě (ta je větší než poloměr věže) — na telefonu se jinak netrefí
  let hit = null, hd = Infinity;
  for (const t of [G.hero, ...G.towers].filter(Boolean)) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d <= Math.max(t.r * 1.45, t.r + 10) && d < hd) { hd = d; hit = t; } }
  if (hit) { view.sel = hit; view.tab = 'def'; window.sfx?.('click'); renderSide(true); return; }
  const boss = G.enemies.find(e => e.def.boss && Math.hypot(e.x - p.x, e.y - p.y) <= e.def.r + 6);
  if (boss) { view.sel = { boss }; renderSide(true); return; }
  const obst = (G.map.obstacles || []).find(o => !o.removed && o.removable && p.x > o.x && p.x < o.x + o.width && p.y > o.y && p.y < o.y + o.height);
  if (obst) { view.sel = { obst }; renderSide(true); return; }
  if (view.sel) { view.sel = null; renderSide(true); }
}

/* ── Klávesy ───────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('tdTree') && !$('tdTree').hidden) { $('tdTree').hidden = true; return; }
  keyShift = e.shiftKey;
  if (!running || e.target.closest?.('input,textarea')) return;
  if (cardOpen) { const n = +e.key; if (n >= 1 && n <= 4) { const b = $('tdCardOpts').children[n - 1]; b?.click(); } if (e.key === 'Escape') closeCard(); return; }
  if (e.code === 'Space' || e.key === 'q' || e.key === 'Q') { e.preventDefault(); openCard(); return; }
  if (e.key === 'Escape') { if (view.placing) cancelPlacing(); else { view.sel = null; renderSide(true); } return; }
  if (!NET && (e.key === 'p' || e.key === 'P')) { togglePause(); return; }
  if (!NET && (e.key === 'f' || e.key === 'F')) { cycleSpeed(); return; }
  const n = +e.key; if (n >= 1 && n <= 9) { const btn = $('tdAbil').children[n - 1]; btn?.click(); }
});
document.addEventListener('keyup', e => { keyShift = e.shiftKey; });
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !NET) togglePause(true); });
// Versus běží podle společných hodin i v záložce na pozadí (tam nejde requestAnimationFrame)
setInterval(() => { if (NET && running && document.hidden) { try { vsCatchUp(600); vsTick(); } catch (e) { console.error(e); } } }, 500);
function vsCatchUp(max) {
  const target = (serverNow() - NET.startAt) / 1000;
  let n = 0;
  while (G.time + STEP <= target && n++ < max && !G.over) step(STEP);
  return target;
}
window.addEventListener('beforeunload', e => { if (running && G && G.wave > 0 && !G.over) { e.preventDefault(); e.returnValue = ''; } });

function togglePause(force) { paused = force === true ? true : !paused; $('tdPaused').hidden = !paused; $('hudPause').textContent = paused ? '▶' : '⏸'; }
function cycleSpeed() { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; $('hudSpeed').textContent = speed + '×'; }
$('hudPause').onclick = () => togglePause();
$('tdResume').onclick = () => togglePause();
$('hudSpeed').onclick = cycleSpeed;
$('hudCard').onclick = () => openCard();
$('hudGo').onclick = () => { if (!NET && !G.waveActive && !G.over) { startWave(); renderSide(true); } };

/* ── Hlavní smyčka ─────────────────────────────────────────────── */
let lastErrAt = 0, frameNo = 0;
function frame(now) {
  if (!running) return;
  try { frameBody(now); } catch (e) {
    // smyčka nesmí umřít — chybu ukážeme a hrajeme dál
    console.error('Obrana království:', e);
    if (now - lastErrAt > 10000) { lastErrAt = now; toast('Chyba vykreslení: ' + (e && e.message || e)); }
  }
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const real = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (++frameNo % 60 === 0 && (g2.isContextLost?.() || TR.cachesLost())) { TR.clearCaches(); _towerIcoReset(); return; }
  if (NET) {
    const target = vsCatchUp(240);
    vsTick();
    const ban = $('tdBanner');
    if (target < 0) { ban.hidden = false; const h = TDI.html(`⚔️ Bitva začíná za <b>${Math.ceil(-target)}</b> s — stav první věže!`); if (ban._h !== h) { ban._h = h; ban.innerHTML = h; } }
  } else if (!paused && !G.over) {
    let k = speed;
    if (cardOpen && cardOpen.slowUntil > now) { k = ECON.flashcards.singleplayer_slow_motion_factor; G.slowmo = true; } else G.slowmo = false;
    acc += real * k;
    let n = 0;
    while (acc >= STEP && n++ < 12) { step(STEP); acc -= STEP; }
    if (n >= 12) acc = 0;
  }
  const s = cv.width / TW;
  g2.setTransform(s, 0, 0, s, 0, 0);
  TR.render(g2, view);
  updateHud();
  if (Math.floor(now / 250) !== Math.floor((now - real * 1000) / 250)) renderSide();
  if (NET && view.tab === 'atk') vsLiveBars();
  if (frameNo % 30 === 0) scanTips();
}

/* ── HUD a lišta schopností ────────────────────────────────────── */
function cardQuota() { return ECON.flashcards.max_per_wave + G.cardQuotaBonus; }
function updateHud() {
  $('hudLives').textContent = Math.ceil(G.lives);
  $('hudGold').textContent = fmt(G.gold);
  $('hudKm').textContent = G.km;
  $('hudWave').textContent = G.wave > winWave() ? `${G.wave} (volná hra)` : `${G.wave} / ${winWave()}`;
  const left = cardQuota() - G.cardsThisWave, cd = Math.max(0, G.cardCdUntil - G.time);
  $('hudCardQ').textContent = cd > 0 ? Math.ceil(cd) + ' s' : `${left}/${cardQuota()}`;
  $('hudCard').disabled = left <= 0 || cd > 0 || !!cardOpen;
  const go = $('hudGo');
  if (NET) {
    $('hudEco').textContent = fmt(G.vs.eco);
    go.disabled = true;
    TDI.set(go, G.time < 0.01 ? '⚔️ Za chvíli' : `🌊 Vlna ${G.wave + 1} za ${Math.max(0, Math.ceil(G.vs.nextWaveAt - G.time))} s`);   // TDI.set: emoji → kreslené ikony, jen při změně
  } else if (G.waveActive) { TDI.set(go, '🌊 Vlna běží'); go.disabled = true; }
  else if (G.wave === 0) { TDI.set(go, '▶ Start'); go.disabled = false; }
  else { TDI.set(go, `⏭ Další vlna (${Math.max(0, Math.ceil(G.pauseUntil - G.time))} s)`); go.disabled = false; }
  // pečeť bosse
  const bosses = G.enemies.filter(e => e.seal && e.seal.s > 0);
  const ban = $('tdBanner');
  if (NET && G.time < 0.01) { /* odpočet ukazuje smyčka */ }
  else ban.hidden = true;
  // schopnosti
  const abil = [];
  if (G.hero) G.hero.abilities.forEach((a, i) => abil.push({ k: 'h' + i, name: a.name, ico: heroIco(HDEF[G.hero.id]), until: a.until, cd: a.cd, use: () => useHeroAbility(i) }));
  const seen = new Map();
  G.towers.forEach(t => { if (!t.ability) return; const k = t.ability.key; const prev = seen.get(k); if (!prev || t.cdUntil < prev.cdUntil) seen.set(k, t); });
  seen.forEach((t, k) => abil.push({ k, name: t.ability.name, ico: towerIco(TDEF[t.type]), until: t.cdUntil, cd: (t.ability.cooldown_s || 30) * abilityCdMul(t), use: () => useTowerAbility(t) }));
  const sig = abil.map(a => a.k).join('|');
  const bar = $('tdAbil');
  if (sig !== hudSig) {
    hudSig = sig;
    bar.innerHTML = abil.map((a, i) => `<button type="button" class="td-ab" data-i="${i}" title="${esc(a.name)} (${i + 1})"><span>${a.ico}</span><small>${esc(a.name)}</small><i></i><em>${i + 1}</em></button>`).join('');
    [...bar.children].forEach((b, i) => { b.onclick = () => { const x = curAbil[i]; if (x && x.until <= G.time) { if (x.use() === false) toast('Teď není na co to použít.'); } }; });
  }
  curAbil = abil;
  [...bar.children].forEach((b, i) => { const a = abil[i]; if (!a) return; const left = Math.max(0, a.until - G.time); b.classList.toggle('cd', left > 0); b.querySelector('i').style.setProperty('--p', left > 0 ? Math.min(1, left / a.cd) : 0); b.querySelector('i').textContent = left > 0 ? Math.ceil(left) : ''; });
}
let curAbil = [];

/* ── Postranní panel: obchod / vybraná věž / hrdina / boss ────── */
function renderSide(force) {
  if (!G) return;
  const sel = view.sel;
  if (sel && !sel.boss && !sel.obst && !sel.hero && !G.towers.includes(sel)) view.sel = null;
  if (sel?.boss && sel.boss.dead) view.sel = null;
  const sig = JSON.stringify([view.sel ? (view.sel.id || view.sel.boss?.id || 'o') : 0, view.placing, affordSig(), G.km, G.waveActive, G.wave,
    view.sel?.up, view.sel?.level, view.sel?.target, view.sel?.mode, view.sel?.follow, view.sel?.gryf?.mode, Math.floor((view.sel?.bank || 0) / 50), view.sel?.boss ? Math.ceil(view.sel.boss.seal?.s * 10) : 0, Math.floor(G.time / 2) * (view.sel?.hero ? 1 : 0)]);
  const atk = NET && view.tab === 'atk' && !view.sel && !view.placing;
  const fullSig = atk ? 'atk|' + G.km + '|' + attackSig() : sig;
  if (!force && (fullSig === panelSig || sidePressed)) return;   // během stisku tlačítka panel nepřekreslovat (kliknutí by se ztratilo)
  panelSig = fullSig;
  const side = $('tdSide');
  // zachovat rozbalené úrovně hrdiny a posun panelu, když jde jen o obnovení stejného výběru
  const same = side.dataset.sel === String(view.sel ? (view.sel.id || view.sel.boss?.id || 'o') : 0);
  const levelsOpen = same && side.querySelector('.td-levels')?.open, scroll = same ? side.scrollTop : 0;
  side.dataset.sel = String(view.sel ? (view.sel.id || view.sel.boss?.id || 'o') : 0);
  const tabs = NET ? `<div class="td-tabs"><button type="button" class="${atk ? '' : 'on'}" data-act="tab" data-t="def">🏰 Obrana</button><button type="button" class="${atk ? 'on' : ''}" data-act="tab" data-t="atk">⚔️ Útok</button></div>` : '';
  side.innerHTML = tabs + (atk ? attackPanel() : view.sel ? (view.sel.boss ? bossPanel(view.sel.boss) : view.sel.obst ? obstPanel(view.sel.obst) : view.sel.hero ? heroPanel(view.sel) : towerPanel(view.sel)) : shopPanel());
  if (levelsOpen) side.querySelector('.td-levels')?.setAttribute('open', '');
  side.scrollTop = scroll;
  wireSide(side);
}
// Které nákupy si teď hráč může dovolit — panel se překreslí, jen když se to změní
function affordSig() {
  const g = G.gold, sel = view.sel;
  if (sel && !sel.hero && !sel.boss && !sel.obst && TDEF[sel.type]) return [0, 1, 2].map(p => { const c = upgradeCost(sel, p); return c ? +(g >= c.gold) : 2; }).join('') + (g >= 250 ? 'm' : '') + Math.round(sellValue(sel));
  if (sel?.hero) return g >= 250 ? 'm' : '';
  if (sel?.obst) return +(g >= sel.obst.remove_cost_gold);
  return TD.towers.map(t => +(g >= Math.round(t.base.cost * G.costMul))).join('') + (G.hero ? '' : +(g >= heroCost(G.heroId)));
}
// Tlačítka v panelu reagují už na stisk (pointerdown): panel se může překreslit
// mezi stiskem a puštěním a obyčejné kliknutí by pak zmizelo. Klávesnice jde přes click.
let sidePressed = false, sideDownAt = 0;
function wireSide(side) {
  if (side._wired) return;
  side._wired = true;
  side.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const b = e.target.closest('[data-act]');
    sidePressed = true;
    // dotyk: jen klepnutí (click) — při posouvání panelu prstem se nesmí nic koupit; panel se během držení stejně nepřekreslí
    if (!b || b.disabled || e.pointerType === 'touch') return;
    e.preventDefault();
    sideDownAt = performance.now();
    act(b.dataset.act, { ...b.dataset });
  });
  side.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || (e.detail > 0 && performance.now() - sideDownAt < 800)) return;   // myš/dotyk už vyřídil pointerdown
    act(b.dataset.act, { ...b.dataset });
  });
  const up = () => { if (!sidePressed) return; sidePressed = false; renderSide(); };
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
function shopPanel() {
  let h = '';
  if (!G.hero) {
    const hd = HDEF[G.heroId], c = heroCost(G.heroId);
    h += `<div class="td-sec">Hrdina</div><button type="button" class="td-shop td-shop-hero${view.placing === G.heroId ? ' on' : ''}" data-act="buy" data-type="${G.heroId}" ${G.gold < c ? 'data-poor' : ''}>
      <span class="td-shop-ico" style="--hc:${hd.col}">${heroIco(hd)}</span><span><b>${esc(hd.name)}</b><small>${esc(hd.role)}</small></span><em>${c} zl</em></button>`;
  }
  const byCat = {};
  TD.towers.forEach(t => (byCat[t.cat] = byCat[t.cat] || []).push(t));
  Object.entries(byCat).forEach(([cat, list]) => {
    h += `<div class="td-sec">${CAT_LABEL[cat]}</div><div class="td-shop-grid">` + list.map(t => {
      const c = Math.round(t.base.cost * G.costMul);
      return `<button type="button" class="td-shop${view.placing === t.id ? ' on' : ''}" data-act="buy" data-type="${t.id}" title="${esc(t.name)} — ${esc(t.desc)}" ${G.gold < c ? 'data-poor' : ''}>
        <span class="td-shop-ico" style="--hc:${t.col}">${towerIco(t)}</span><b>${esc(t.short)}</b><em>${c}</em></button>`;
    }).join('') + '</div>';
  });
  if (NET) h = `<div class="td-vs-eco">💰 Příjem <b>${fmt(G.vs.eco)} zl</b> / ${VS.eco_payout_interval_s} s — zvedneš ho posíláním slizáků v záložce ⚔️ Útok.</div>` + h;
  if (view.placing) h += `<p class="td-tip">Klikni vedle cesty a věž se postaví. Se Shiftem můžeš stavět víc za sebou. Esc nebo pravé tlačítko zruší.</p>`;
  if (view.placing && TDEF[view.placing]) h += `<button type="button" class="btn btn-ghost btn-sm td-wide" data-act="tree" data-type="${view.placing}">📖 Všechna vylepšení: ${esc(TDEF[view.placing].short)}</button>`;
  // krystaly
  h += `<div class="td-sec">Krystaly moudrosti 💎</div><div class="td-km-acts">
    <button type="button" class="btn btn-secondary btn-sm" data-act="flare" ${G.km < 1 ? 'disabled' : ''} title="Na 15 s odhalí všechny průhledné Duchslizy">🔦 Světlice (1 💎)</button>
    <button type="button" class="btn btn-secondary btn-sm" data-act="sellkm" ${G.km < 1 ? 'disabled' : ''}>Prodat krystal (+100 zl)</button></div>
    <p class="td-tip">Krystaly dávají jen svitky (kartičky). Potřebuješ je na vylepšení úrovně 4 (2 💎) a 5 (5 💎).</p>`;
  if (!NET) h += nextWavePanel();
  return h;
}
const _miniCache = new Map();
// Ikony věží a hrdinů do obchodu podle stylu: Super (TDSS), Detailní (TDS.towerIcon), jinak moje kresba z mapy (TR.towerIcon)
let _towerIco = {};
function _towerIcoReset() { _towerIco = {}; panelSig = ''; }
function icoImg(key, make) { _towerIco[key] = _towerIco[key] || make().toDataURL(); return `<img src="${_towerIco[key]}" alt="">`; }
function towerIco(t) {
  const m = gfxNow();
  if (m === '2' && TR.hasSup(t.id)) return icoImg('s:' + t.id, () => TR.supTowerIcon(t.id, 80));
  if (m !== '0' && window.TDS?.drawers?.[t.id] && TDS.towerIcon) return icoImg('d:' + t.id, () => TDS.towerIcon(t.id, 80));
  return icoImg('k:' + t.id, () => TR.towerIcon(t.id, 80));
}
function heroIco(h) {
  if (gfxNow() === '2' && window.TDSS?.heroDrawers?.[h.id] && TDSS.heroIcon) return icoImg('s:h' + h.id, () => TDSS.heroIcon(h.id, 80));
  if (gfxNow() !== '0' && window.TDS?.heroDrawers?.[h.id] && TDS.heroIcon) return icoImg('d:h' + h.id, () => TDS.heroIcon(h.id, 80));
  return icoImg('k:h' + h.id, () => TR.heroIcon(h.id, 80));
}
function miniSlime(id, mods) {
  if (gfxNow() === '2' && window.TDSS?.slimeIcon) {   // Super grafika
    const k = 'S' + id;
    if (!_miniCache.has(k)) _miniCache.set(k, TDSS.slimeIcon(id, 30).toDataURL());
    return _miniCache.get(k);
  }
  const nova = gfxNow() !== '0', tex = EDEF[id]?.isNew ? window.TDS?.slimeDrawers?.[id] : window.TDS?.slimeIcon;
  const key = id + (mods || []).join() + (tex && nova ? (EDEF[id]?.isNew ? 'D' : 'N') : '');
  if (!_miniCache.has(key) && key.endsWith('D')) {   // nový slizák s texturou od Gemini
    const c = document.createElement('canvas'); c.width = c.height = 30; const g = c.getContext('2d'); g.translate(15, 15);
    try { TDS.slimeDrawers[id](g, EDEF[id].boss ? 12 : 10, 0, {}); } catch (_) { /* nic */ }
    const url = c.toDataURL(); _miniCache.set(key, url); return url;
  }
  if (!_miniCache.has(key) && key.endsWith('N')) { const url = TDS.slimeIcon(id, 30).toDataURL(); _miniCache.set(key, url); return url; }
  if (_miniCache.has(key)) return _miniCache.get(key);
  const def = EDEF[id], fake = { t: id, def, fort: (mods || []).includes('kamenny'), armored: def.traits.includes('armored') };
  const url = TR.slimeSprite(fake).toDataURL();
  _miniCache.set(key, url); return url;
}
function nextWavePanel() {
  const n = G.waveActive ? G.wave : G.wave + 1;
  if (n > TD.waves.length + 50) return '';
  const w = waveDef(n);
  const groups = {};
  w.def.groups.forEach(gr => { const k = gr.id + '|' + (gr.mods || []).join(','); groups[k] = (groups[k] || 0) + Math.max(1, Math.round(gr.n * w.cnt * (G.cfg?.count || 1))); });
  const BADGE = { duchsliz: ['👻', 'průhledný — vidí ho jen některé věže'], dorustajici: ['🌱', 'dorůstá'], kamenny: ['🪨', 'kamenný — 2× životy'], zrychleny: ['💨', 'větrný spěch — rychlejší, zpomalení a omráčení kratší'], runovy_stit: ['🔵', 'runová bublina — pohltí první zásah'] };
  const TRAIT = { flying: '🫧', enrage_on_hit: '😡', swarm_split: '✳️', shield_aura: '🛡️', healer_pulse: '💚', burrower: '⛏️', projectile_magnet: '🧲', chilling_presence: '🧊', brood_spawner: '🐝', prismatic_shell: '💎' };
  const chips = Object.entries(groups).map(([k, cnt]) => {
    const [id, m] = k.split('|'), mods = m ? m.split(',') : [], def = EDEF[id];
    const traits = [...mods.map(x => BADGE[x]?.[0]).filter(Boolean), def.armored || def.traits.includes('armored') ? '🪖' : '', def.traits.includes('explosion_immune') ? '💥🚫' : '', def.traits.includes('freeze_immune') ? '❄️🚫' : '', def.traits.includes('magic_immune') ? '🔮🚫' : '', ...def.traits.map(x => TRAIT[x] || '')].join('');
    return `<span class="td-chip" title="${esc(def.name)}${mods.length ? ' · ' + mods.map(x => BADGE[x]?.[1]).join(', ') : ''}"><img src="${miniSlime(id, mods)}" alt=""><b>${cnt}×</b><small>${esc(def.name)} ${traits}</small></span>`;
  }).join('');
  return `<div class="td-sec">${G.waveActive ? 'Právě jde' : 'Další vlna'}: ${n}</div><div class="td-chips">${chips}</div>${w.def.why && n <= TD.waves.length ? `<p class="td-warn">⚠️ ${esc(w.def.why)}</p>` : ''}`;
}
function statRow(t) {
  const st = t.st;
  const rows = [];
  if (st.damage) rows.push(['Poškození', +effDamage(t).toFixed(1) + (t.fx.bonus_boss_damage || t.fx.bonus_moab_damage || t.fx.moab_damage_bonus ? ` (+${t.fx.bonus_boss_damage || t.fx.bonus_moab_damage || t.fx.moab_damage_bonus} králům)` : '')]);
  if (st.damage) rows.push(['Průraz', effPierce(t)]);
  if (st.range) rows.push(['Dosah', st.range >= 1900 ? 'celá mapa' : Math.round(effRange(t)) + ' px']);
  if (st.damage && st.interval) rows.push(['Útoky', (speedMul(t) / st.interval).toFixed(1) + '/s']);
  if (st.type && st.type !== 'none') rows.push(['Typ', DMG_LABEL[t.aura?.trueD ? 'true' : st.type] || st.type]);
  if (st.damage) rows.push(['Vidí 👻', st.camo || t.aura?.camo ? 'ano' : 'ne']);
  if (t.type === 'zlaty_dul') {
    const cart = mineIncome(t) / t.st.carts;
    rows.push([t.up[0] >= 4 ? 'Truhly' : 'Vozíky', `${t.st.carts} × ${fmt(cart)} zl`]);
    rows.push([t.fx.bank_mode ? 'Do banky' : 'Výnos', fmt(mineIncome(t)) + ' zl/vlna']);
  }
  if (t.dmgDone) rows.push(['Zničil', fmt(t.dmgDone)]);
  return `<div class="td-stats">${rows.map(([a, b]) => `<span>${a}<b>${b}</b></span>`).join('')}</div>`;
}
function towerPanel(t) {
  const def = TDEF[t.type];
  let h = `<div class="td-sel-head"><span class="td-shop-ico" style="--hc:${def.col}">${towerIco(def)}</span><div><b>${esc(def.name)}</b><small>${esc(def.desc)}</small></div><button type="button" class="td-x" data-act="close" aria-label="Zavřít">✕</button></div>`;
  h += statRow(t);
  if (t.type === 'oblehaci_mozdir') h += `<div class="td-km-acts"><button type="button" class="btn btn-primary btn-sm" data-act="pick" data-k="aim">🎯 Zvolit cíl na mapě</button>${t.fx.allow_auto_follow_target ? `<button type="button" class="btn btn-secondary btn-sm" data-act="follow">${t.follow ? '📍 Pevný cíl' : '👁️ Sledovat slizáky'}</button>` : ''}</div>`;
  if (t.type === 'gryfi_jezdec' && t.fx.flight_modes_unlocked) {
    const M = [['circle', '⭕ Kroužit'], ['eight', '♾️ Osmička'], ['patrol', '📍 Hlídka'], ['follow', '🖱️ Za kurzorem']], cur = t.gryf?.mode || 'circle';
    h += `<div class="td-targets">${M.map(([k, n]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-act="fly" data-m="${k}">${n}</button>`).join('')}</div>`;
  }
  if (towerHasAttack(t) && !(t.type === 'kladec_pasti' && !t.fx.allow_target_priority) && t.type !== 'oblehaci_mozdir' && !(t.type === 'gryfi_jezdec' && t.st.mode !== 'targeted_homing_stream')) h += `<div class="td-targets">${TARGETS.map(([k, n]) => `<button type="button" class="${t.target === k ? 'on' : ''}" data-act="target" data-t="${k}">${n}</button>`).join('')}</div>`;
  if (t.fx.toggle_submerge_mode) h += `<button type="button" class="btn btn-secondary btn-sm td-wide" data-act="mode">${t.mode === 'lighthouse' ? '⛵ Přepnout na střelbu' : '🗼 Přepnout na maják'}</button>`;
  if (t.fx.bank_mode) h += `<div class="td-bank">🏦 V bance <b>${fmt(t.bank || 0)}</b> / ${fmt(t.fx.bank_capacity || 7500)} zl <button type="button" class="btn btn-primary btn-sm" data-act="bank" ${!(t.bank > 0) ? 'disabled' : ''}>Vybrat</button></div>`;
  if (t.ability) { const left = Math.max(0, t.cdUntil - G.time); h += `<button type="button" class="btn btn-primary btn-sm td-wide" data-act="ability" ${left > 0 ? 'disabled' : ''}>✨ ${esc(t.ability.name)}${left > 0 ? ` (${Math.ceil(left)} s)` : ''}</button><p class="td-tip">${esc(t.ability.effect || '')}</p>`; }
  h += '<div class="td-paths">';
  for (let p = 0; p < 3; p++) {
    const tier = t.up[p], next = def.paths[p][tier], ok = canUpgradePath(t, p), c = next ? upgradeCost(t, p) : null;
    const pips = [0, 1, 2, 3, 4].map(i => `<i class="${i < tier ? 'on' : ''}"></i>`).join('');
    const cur = tier ? def.paths[p][tier - 1].name : '—';
    let btn;
    if (!next) btn = '<span class="td-done">Hotovo ✓</span>';
    else if (!ok.ok) btn = `<span class="td-lock">🔒 ${esc(ok.why)}</span>`;
    else {
      const poor = G.gold < c.gold || G.km < c.km;
      btn = `<button type="button" class="td-buy" data-act="up" data-p="${p}" ${poor ? 'data-poor' : ''}><b>${esc(next.name)}</b><small>${esc(next.desc)}</small><em>${c.gold ? fmt(c.gold) + ' zl' : 'zdarma'}${c.km ? ` + ${c.km} 💎` : ''}</em></button>`;
    }
    h += `<div class="td-path td-p${p}"><div class="td-path-h"><span>Cesta ${p + 1}</span><span class="td-pips">${pips}</span></div><small class="td-cur">${esc(cur)}</small>${btn}</div>`;
  }
  h += '</div>';
  h += `<button type="button" class="btn btn-ghost btn-sm td-wide" data-act="tree" data-type="${t.type}">📖 Všechna vylepšení</button>`;
  h += `<button type="button" class="btn btn-secondary btn-sm td-wide td-sell" data-act="sell">Prodat za ${fmt(sellValue(t))} zl${t.kmSpent ? ` + ${t.kmSpent} 💎` : ''}</button>`;
  return h;
}
function heroPanel(h) {
  const def = HDEF[h.id], L = def.levels, next = L[h.level];
  const base = L[h.level - 1].xp, need = next ? next.xp : base, pct = next ? Math.min(100, (h.xp - base) / (need - base) * 100) : 100;
  let s = `<div class="td-sel-head"><span class="td-shop-ico" style="--hc:${def.col}">${heroIco(def)}</span><div><b>${esc(def.name)}</b><small>${esc(def.role)}</small></div><button type="button" class="td-x" data-act="close" aria-label="Zavřít">✕</button></div>`;
  s += `<div class="td-lvl"><b>Úroveň ${h.level}</b><span class="td-xpbar"><i style="width:${pct}%"></i></span><small>${next ? `${fmt(h.xp)} / ${fmt(need)} XP` : 'Maximální úroveň'}</small></div>`;
  if (h.st.damage) s += `<div class="td-stats"><span>Poškození<b>${h.st.damage}</b></span><span>Dosah<b>${h.st.range} px</b></span><span>Útoky<b>${(speedMul(h) / h.st.interval).toFixed(1)}/s</b></span><span>Vidí 👻<b>${h.st.camo ? 'ano' : 'ne'}</b></span></div>`;
  s += `<p class="td-tip">📜 <b>${esc(def.passive.name)}:</b> ${esc(def.passive.description)}</p>`;
  if (next) s += `<p class="td-tip">Další úroveň: ${esc(next.text)}</p>`;
  if (h.st.damage) s += `<div class="td-targets">${TARGETS.map(([k, n]) => `<button type="button" class="${h.target === k ? 'on' : ''}" data-act="target" data-t="${k}">${n}</button>`).join('')}</div>`;
  s += `<div class="td-km-acts"><button type="button" class="btn btn-secondary btn-sm" data-act="heroxp" ${G.km < 1 || !next ? 'disabled' : ''}>+350 XP za 1 💎</button>
    <button type="button" class="btn btn-secondary btn-sm" data-act="movehero" ${G.gold < 250 ? 'disabled' : ''}>Přesunout (250 zl)</button></div>`;
  s += `<details class="td-levels"><summary>Všechny úrovně</summary>${L.map(l => `<div class="${l.level <= h.level ? 'on' : ''}"><b>${l.level}</b> ${esc(l.text)}</div>`).join('')}</details>`;
  return s;
}
function bossPanel(e) {
  const left = e.seal ? Math.ceil(e.seal.s * e.seal.n - 1e-6) : 0, km = e.def.seal?.km || 3;
  return `<div class="td-sel-head"><span class="td-shop-ico" style="--hc:${e.def.col}">👑</span><div><b>${esc(e.def.name)}</b><small>${esc(e.def.look || '')}</small></div><button type="button" class="td-x" data-act="close" aria-label="Zavřít">✕</button></div>
    <div class="td-stats"><span>Životy<b>${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}</b></span><span>Pečeť<b>${left ? left + ' / ' + e.seal.n : 'prolomena'}</b></span></div>
    ${left ? `<p class="td-tip">Dokud drží Runová pečeť, dostává král o 75 % menší poškození. Každý správný svitek ubere jednu pečeť, sama od sebe pomalu slábne.</p>
    <button type="button" class="btn btn-primary btn-sm td-wide" data-act="seal" ${G.km < km ? 'disabled' : ''}>🔮 Rozbít pečeť za ${km} 💎</button>` : '<p class="td-tip">Pečeť je prolomená — teď dostává plné poškození.</p>'}`;
}
function obstPanel(o) {
  return `<div class="td-sel-head"><span class="td-shop-ico" style="--hc:#78716c">🪨</span><div><b>${esc(o.name)}</b><small>Uvolní místo pro stavbu.</small></div><button type="button" class="td-x" data-act="close" aria-label="Zavřít">✕</button></div>
    <button type="button" class="btn btn-primary btn-sm td-wide" data-act="clear" ${G.gold < o.remove_cost_gold ? 'disabled' : ''}>Odklidit za ${o.remove_cost_gold} zl</button>`;
}
function act(a, d) {
  const sel = view.sel;
  if (a === 'tab') { view.tab = d.t; view.sel = null; if (view.placing) cancelPlacing(); renderSide(true); return; }
  if (NET && vsAct(a, d)) { renderSide(true); return; }
  switch (a) {
    case 'buy': view.tab = 'def'; if (view.placing === d.type) cancelPlacing(); else { view.placing = d.type; view.sel = null; view.touchGhost = false; updateGhost(); renderSide(true); } return;
    case 'tree': openTree(d.type); return;
    case 'close': view.sel = null; break;
    case 'target': sel.target = d.t; break;
    case 'mode': sel.mode = sel.mode === 'lighthouse' ? null : 'lighthouse'; break;
    case 'bank': addGold(sel.bank || 0); floatText(sel.x, sel.y - 26, '+' + fmt(sel.bank || 0), '#facc15'); sel.bank = 0; window.sfx?.('coin'); break;
    case 'ability': if (useTowerAbility(sel) === false) toast('Teď není na co to použít.'); break;
    case 'up': { const why = buyUpgrade(sel, +d.p); if (why) { toast(why); window.sfx?.('bad'); } break; }
    case 'sell': sellTower(sel); view.sel = null; break;
    case 'flare': if (G.km >= 1) { G.km--; G.revealUntil = G.time + ECON.flashcards.emergency_flare_reveal_duration_s; window.sfx?.('hint'); toast('🔦 Světlice: 15 s vidí všechny věže průhledné slizáky.'); } break;
    case 'sellkm': if (G.km >= 1) { G.km--; addGold(ECON.currencies.km_to_gold_conversion_rate); window.sfx?.('coin'); } break;
    case 'heroxp': if (G.km >= 1) { G.km--; addHeroXp(ECON.flashcards.direct_hero_xp_per_1_km); } break;
    case 'pick': view.pick = { kind: d.k, t: sel }; toast(d.k === 'aim' ? 'Klikni na mapu, kam má moždíř střílet.' : 'Klikni, kolem kterého místa má gryf hlídkovat.'); break;
    case 'follow': sel.follow = !sel.follow; break;
    case 'fly': if (sel.gryf) { if (d.m === 'patrol') { view.pick = { kind: 'patrol', t: sel }; toast('Klikni, kolem kterého místa má gryf hlídkovat.'); } else sel.gryf.mode = d.m; } break;
    case 'movehero': view.placing = 'moveHero'; view.sel = null; toast('Klikni, kam hrdinu přesunout.'); break;
    case 'seal': { const km = sel.boss.def.seal?.km || 3; if (G.km >= km) { G.km -= km; sel.boss.seal.s = 0; addFx({ kind: 'sealbreak', x: sel.boss.x, y: sel.boss.y, r: sel.boss.def.r, dur: 0.6 }); window.sfx?.('combo', { n: 3 }); } break; }
    case 'clear': { const o = sel.obst; if (spend(o.remove_cost_gold)) { o.removed = true; window.sfx?.('tower'); view.sel = null; } break; }
  }
  renderSide(true);
}

/* ── Svitky (kartičky) ─────────────────────────────────────────── */
function nextCard() {
  if (!CARDQ.length) CARDQ = shuffle(POOL);
  const c = CARDQ.shift();
  const o = mcOptions(c, POOL.all || POOL);
  return o ? { card: c, ...o } : nextCard();
}
// Kartičky do čekárny versus: hostitel je uloží do hry, ostatní hrají ze stejných balíčků (dokument má limit 1 MB)
function packCards(pool) {
  let budget = 700000;
  const out = [];
  for (const c of pool.slice(0, 400)) {
    const x = { id: c.id, d: c.deckId || '', f: c.f, b: c.b, w: c.w || [], ok: [...c.ok] };
    if (c.fl) x.fl = c.fl;
    if (c.cl) x.cl = c.cl;
    let n = JSON.stringify(x).length;
    const fi = c.fi ? JSON.stringify(c.fi).length : 0;
    if (fi && fi < 60000 && n + fi < budget) { x.fi = c.fi; n += fi; }   // velký obrázek by se nevešel → otázka bez něj
    if (n > budget) break;
    budget -= n; out.push(x);
  }
  return out;
}
function unpackCards(list) {
  return list.map(x => ({ id: x.id, deckId: x.d, deckName: '', f: String(x.f), b: String(x.b), fl: x.fl || null, cl: x.cl || null,
    fi: x.fi || null, w: (x.w || []).map(String), ok: new Set((x.ok && x.ok.length ? x.ok : [x.b]).map(String)) }));
}
function cardGold() {
  let gold = ECON.flashcards.reward_base_gold + ECON.flashcards.reward_per_wave_gold * Math.max(1, G.wave);
  const h = G.hero;
  if (h?.id === 'kronikar_oskar') gold *= 1 + (h.level >= 20 ? 1 : h.level >= 8 ? 0.5 : 0.3);
  if (G.towers.some(t => t.fx.flashcard_cash_bonus_pct)) gold *= 1.25;
  gold += G.towers.filter(t => t.fx.flashcard_bonus_gold_add).length * 15;
  return Math.round(gold);
}
function openCard() {
  if (!G || G.over || cardOpen) return;
  if (G.cardCdUntil > G.time) { toast(`Další svitek za ${Math.ceil(G.cardCdUntil - G.time)} s.`); return; }
  if (G.cardsThisWave >= cardQuota()) { toast('V této vlně už jsi vyčerpal svitky. Další budou po vlně.'); return; }
  const q = nextCard();
  cardOpen = { ...q, slowUntil: NET ? 0 : performance.now() + ECON.flashcards.singleplayer_slow_motion_max_s * 1000, done: false };
  $('tdCardQ').innerHTML = mcQuestionHtml(q.card);
  $('tdCardOpts').innerHTML = q.opts.map((t, i) => `<button type="button" class="td-ans" data-i="${i}"><em>${i + 1}</em><span>${mcOptionHtml(q.card, t)}</span></button>`).join('');
  $('tdCardReward').textContent = `+${cardGold()} zl · +1 💎`;
  $('tdCardNote').textContent = G.enemies.some(e => e.seal && e.seal.s > 0) ? '🔮 Správná odpověď oslabí pečeť krále.' : G.vs?.curse?.until > G.time ? '🕯️ Správná odpověď zlomí kletbu na tvé věži.' : NET ? 'Bitva běží dál — odpovídej rychle.' : 'Hra zatím běží zpomaleně.';
  $('tdCard').hidden = false;
  $('tdCardOpts').querySelectorAll('.td-ans').forEach(b => b.onclick = () => answerCard(+b.dataset.i));
  if (typeof enhanceCode === 'function') enhanceCode($('tdCard'));
  window.sfx?.('flip');
}
function answerCard(i) {
  const c = cardOpen; if (!c || c.done) return;
  c.done = true;
  const ok = i === c.correct, btns = $('tdCardOpts').children;
  btns[c.correct].classList.add('ok'); if (!ok) btns[i].classList.add('bad');
  [...btns].forEach(b => b.disabled = true);
  const F = ECON.flashcards, h = G.hero;
  if (ok) {
    G.cardsOk++; G.cardsThisWave++; G.streak++;
    const gold = cardGold();
    let km = F.reward_knowledge_points + (h?.id === 'kronikar_oskar' && h.level >= 20 ? 1 : 0) + (G.nextCardKmBonus || 0);
    G.nextCardKmBonus = 0;
    if (h?.id === 'kronikar_oskar' && h.level >= 15 && G.cardsOk % 5 === 0) km++;
    let streakMsg = '';
    if (G.streak % F.streak_required_count === 0) { km += F.streak_bonus_knowledge_points; G.streakUntil = G.time + (h?.id === 'kronikar_oskar' ? 15 : F.streak_buff_duration_s); streakMsg = ' · 👑 Královské požehnání!'; }
    km = Math.round(km * (G.cfg?.km || 1));
    addGold(gold); G.km += km;
    addHeroXp(F.hero_xp_per_correct_answer);
    breakSeals(1);
    if (G.vs?.curse?.until > G.time) { G.vs.curse = null; streakMsg += ' · 🕯️ Kletba zlomena'; }
    if (h?.id === 'lovec_bedrich') { h.critShots = h.level >= 7 ? 5 : 3; const a = h.abilities[0]; if (a) a.until -= 6; }
    if (h?.id === 'kronikar_oskar' && h.level >= 7) { for (const e of enemiesNear(h.x, h.y, h.st.range)) if (!e.def.boss) e.d = Math.max(0, e.d - 40); addFx({ kind: 'ring', x: h.x, y: h.y, r: h.st.range, dur: 0.4, col: '#fde68a' }); }
    G.cardCdUntil = G.time + (G.waveActive ? F.correct_cooldown_during_wave_s : F.correct_cooldown_between_waves_s);
    $('tdCardNote').innerHTML = `<b class="td-good">Správně! +${gold} zl, +${km} 💎${streakMsg}</b>`;
    window.sfx?.('ok');
    setTimeout(() => closeCard(true), 900);
  } else {
    G.cardsBad++; G.streak = 0;
    G.cardCdUntil = G.time + (h?.id === 'kronikar_oskar' && h.level >= 13 ? F.wrong_answer_cooldown_s / 2 : F.wrong_answer_cooldown_s);
    $('tdCardNote').innerHTML = `<b class="td-bad">Špatně — správná odpověď je zvýrazněná. Další svitek za ${Math.ceil(G.cardCdUntil - G.time)} s.</b>`;
    window.sfx?.('bad');
    setTimeout(() => closeCard(true), 2200);
  }
}
function closeCard() { cardOpen = null; $('tdCard').hidden = true; if (G) G.slowmo = false; }
$('tdCardClose').onclick = () => closeCard();
$('tdCard').addEventListener('click', e => { if (e.target.id === 'tdCard' && cardOpen?.done) closeCard(); });

/* ── Prohlížeč vylepšení: všechny úrovně všech tří cest s náhledem vzhledu ── */
function openTree(type) {
  const def = TDEF[type]; if (!def) return;
  let ov = $('tdTree');
  if (!ov) {
    ov = document.createElement('div'); ov.className = 'td-modal'; ov.id = 'tdTree';
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-tree-close]')) ov.hidden = true; });
    document.body.appendChild(ov);
  }
  const mul = G ? G.costMul : (curCfg()?.cost || DIFF[pref.diff]?.cost || 1), sel = view.sel && view.sel.type === type ? view.sel : null;
  const b = def.base;
  const stats = [b.damage ? `Poškození ${b.damage}` : '', b.range_px ? `Dosah ${b.range_px >= 1900 ? 'celá mapa' : b.range_px + ' px'}` : '', b.attack_interval_s ? `Útok každých ${b.attack_interval_s} s` : '',
    b.pierce > 1 ? `Průraz ${b.pierce}` : '', b.damage_type && b.damage_type !== 'none' ? `Typ: ${DMG_LABEL[b.damage_type] || b.damage_type}` : '', b.can_see_camo ? 'Vidí 👻' : ''].filter(Boolean);
  ov.innerHTML = `<div class="td-tree-box" role="dialog" aria-label="Vylepšení: ${esc(def.name)}">
    <div class="td-tree-head"><span class="td-shop-ico" style="--hc:${def.col}">${towerIco(def)}</span>
      <div><b>${esc(def.name)}</b><small>${esc(def.desc)}</small><small class="td-tree-stats">${Math.round(b.cost * mul)} zl · ${stats.join(' · ')}</small></div>
      <button type="button" class="td-x" data-tree-close aria-label="Zavřít">✕</button></div>
    <div class="td-tree-grid">${[0, 1, 2].map(p => `<div class="td-tree-col td-p${p}"><div class="td-tree-ph">Cesta ${p + 1}</div>${def.paths[p].map((u, i) => {
      const own = sel && sel.up[p] > i, cost = Math.round(u.cost * mul);
      return `<div class="td-tree-u${own ? ' own' : ''}"><canvas width="128" height="128" data-p="${p}" data-t="${i + 1}"></canvas>
        <div><b>${i + 1}. ${esc(u.name)}${own ? ' ✓' : ''}</b><em>${fmt(cost)} zl${u.km ? ` + ${u.km} 💎` : ''}</em><small>${esc(u.desc)}</small></div></div>`;
    }).join('')}</div>`).join('')}</div>
    <p class="td-tip">Jedna cesta jde až na úroveň 5, druhá nejvýš na 2, třetí zůstane zavřená. Úroveň 5 každé cesty smí na mapě stát jen jednou. Úrovně 4 a 5 potřebují krystaly moudrosti 💎 ze svitků.</p>
  </div>`;
  ov.hidden = false;
  // náhled vzhledu věže na každé úrovni ve zvoleném stylu grafiky
  ov.querySelectorAll('canvas[data-p]').forEach(c => {
    const g = c.getContext('2d'), p = +c.dataset.p, tier = +c.dataset.t, up = [0, 0, 0];
    up[p] = tier;
    TR.towerPreview(g, type, 64, 60, 1.45, up);
    g.fillStyle = ['#f97316', '#38bdf8', '#a3e635'][p];
    for (let k = 0; k < tier; k++) { g.beginPath(); g.arc(64 - (tier - 1) * 8 + k * 16, 120, 5, 0, 6.283); g.fill(); }
  });
}

/* ── Tipy při prvním setkání (jako v BTD): každý nejvýš 2× celkem, pak už nikdy ── */
const TIPS = {
  seal: '🔮 Král má <b>runovou pečeť</b>: dostává o 75 % menší poškození. Každý správný svitek ubere jednu pečeť, nebo klikni na krále a rozbij ji za 💎.',
  duchsliz: '👻 <b>Průhlední slizáci</b>: vidí je jen některé věže (Kladeč pastí, Stínový zvěd, Moždíř, jiné až s vylepšením). Pomůže i 🔦 Světlice za 1 💎.',
  armored: '🪖 <b>Železná helma</b>: ostré střely a magie ji neproniknou. Použij výbuchy, alchymistu, oheň nebo pravé poškození.',
  dorustajici: '🌱 <b>Dorůstající slizák</b> (zelený odznak ↻): když ho 3 s nic nezasáhne, doroste zpátky o vrstvu.',
  kamenny: '🪨 <b>Kamenný krunýř</b>: slizák má dvojnásobek životů.',
  zrychleny: '💨 <b>Větrný spěch</b>: o 35 % rychlejší a zpomalení i omráčení na něj platí kratší dobu.',
  runovy_stit: '🔵 <b>Runová bublina</b>: pohltí celý první zásah.',
  flying: '🫧 <b>Létající slizák</b>: přeletí pasti, pěnu i louže na cestě — potřebuješ věže, které střílí.',
  enrage_on_hit: '😡 <b>Zuřivý sliz</b>: každý zásah ho zrychlí. Zab ho pár silnými ranami.',
  swarm_split: '✳️ <b>Dělivý sliz</b>: rozpadne se na roj, který se rozprskne po cestě. Hodí se plošné poškození.',
  shield_aura: '🛡️ <b>Štítonoš</b>: slizáci v jeho modrém kruhu dostávají poloviční poškození. Zab ho první (cílení Nejsilnější).',
  healer_pulse: '💚 <b>Šamanský sliz</b>: léčí slizáky kolem sebe a smývá z nich hoření i kyselinu.',
  burrower: '⛏️ <b>Krtčí sliz</b>: po zásahu se zahrabe a nejde zaměřit — zasáhnou ho jen pasti a výbuchy.',
  projectile_magnet: '🧲 <b>Magnetický sliz</b>: stahuje na sebe ostré střely a bere jim průraz.',
  chilling_presence: '🧊 <b>Mrazivý plazivec</b>: zpomaluje věže kolem sebe a po smrti je na chvíli zmrazí. Ohnivým věžím mráz nevadí.',
  brood_spawner: '🐝 <b>Královna roje</b>: pořád rodí Dělivé slizy a zrychluje slizáky kolem sebe.',
  prismatic_shell: '💎 <b>Krystalový behemot</b>: každých 8 s se obalí krystalem (−80 % poškození) a omráčí dvě nejbližší věže.',
};
let tipSeen = new Set(), tipQueue = [], tipTimer = null;
function tipCounts() { try { return JSON.parse(localStorage.getItem('td_tips') || '{}') || {}; } catch (_) { return null; } }
function showTip(k) {
  if (tipSeen.has(k) || !TIPS[k]) return;
  tipSeen.add(k);
  const c = tipCounts(); if (!c || (c[k] || 0) >= 2) return;
  tipQueue.push(k); nextTip();
}
function nextTip() {
  if (tipTimer || !tipQueue.length) return;
  const k = tipQueue.shift(), c = tipCounts() || {};
  c[k] = (c[k] || 0) + 1;
  try { localStorage.setItem('td_tips', JSON.stringify(c)); } catch (_) { /* nic */ }
  const el = $('tdTip');
  el.innerHTML = `<span>${TIPS[k]}</span><button type="button" class="td-tip-ok">Rozumím</button>`;
  el.querySelector('button').onclick = () => hideTip();
  el.hidden = false;
  tipTimer = setTimeout(() => hideTip(), 9000);
}
function hideTip(reset) {
  clearTimeout(tipTimer); tipTimer = null;
  const el = $('tdTip'); if (el) el.hidden = true;
  if (!reset) setTimeout(nextTip, 500);
}
// Co nového je teď na mapě (volá se párkrát za sekundu)
function scanTips() {
  if (!G || !running) return;
  for (const e of G.enemies) {
    if (e.dead || e.d < 0) continue;
    if (e.seal && e.seal.s > 0) showTip('seal');
    if (e.camo) showTip('duchsliz');
    if (e.armored && !isBoss(e)) showTip('armored');
    if (e.regrow) showTip('dorustajici');
    if (e.fort) showTip('kamenny');
    if (e.haste) showTip('zrychleny');
    if (e.bubble > 0) showTip('runovy_stit');
    for (const t of e.def.traits) if (TIPS[t]) showTip(t);
  }
}

/* ── Výběr grafiky na úvodní obrazovce: ukázka všech stylů, volba se pamatuje (localStorage td_gfx) ── */
const GFX = [['2', 'Super', 'Nejpropracovanější styl: postavičky, vylepšení vidět na první pohled, živá mapa s mraky a motýly'],
  ['1', 'Detailní', 'Textury od Gemini: hodně detailů, stínů a odlesků'], ['0', 'Kreslená', 'Jednodušší ručně kreslený styl od Clauda, dobře čitelný i na telefonu']];
function gfxNow() { try { const v = localStorage.getItem('td_gfx'); return v === '0' || v === '2' ? v : '1'; } catch (_) { return '1'; } }
let _gfxShots = null;
function renderGfxPicker() {
  const el = $('tdGfx'); if (!el) return;
  const cur = gfxNow();
  if (!_gfxShots) _gfxShots = gfxPreviews();
  el.innerHTML = GFX.map(([k, n, d, wip]) => `<button type="button" class="td-opt td-gfx${cur === k ? ' on' : ''}" data-gfx="${k}">
    <img src="${_gfxShots[k] || ''}" alt="Ukázka: ${esc(n)}" class="td-gfx-img"><b>${n}${wip ? ' <span class="td-wip" title="Work in progress — rozpracované">WIP</span>' : ''}${cur === k ? ' ✓' : ''}</b><small>${d}</small></button>`).join('');
  el.onclick = e => {
    const b = e.target.closest('[data-gfx]'); if (!b) return;
    try { localStorage.setItem('td_gfx', b.dataset.gfx); } catch (_) { /* jen pro tuhle návštěvu */ }
    _towerIcoReset(); window.sfx?.('click'); renderSetup();
  };
}
// Stejná malá scéna (cesta, věže, hrdina, slizáci) vykreslená v obou stylech
function gfxPreviews() {
  const out = {};
  let saved = null;
  try { saved = localStorage.getItem('td_gfx'); } catch (_) { return out; }
  const keep = G, sfx = window.sfx;
  window.sfx = null;   // stavění ukázkových věží nemá cvakat
  try {
    newGame(TD.maps[0].id, TD.heroes[0].id);
    G.gold = 1e6; G.km = 99;
    const P = G.paths[0], at = f => posAt(P, P.len * f), side = (q, d) => ({ x: q.x + Math.cos(q.ang + Math.PI / 2) * d, y: q.y + Math.sin(q.ang + Math.PI / 2) * d });
    [['kralovsky_lucistnik', 0.14, 52, [3, 0, 0]], ['trpaslici_inzenyr', 0.2, -52, [3, 0, 0]], ['oblehaci_katapult', 0.27, 55, [0, 3, 0]], ['gryfi_jezdec', 0.33, -55, [0, 3, 0]], ['oblehaci_mozdir', 0.4, 55, [2, 0, 0]]].forEach(([id, f, d, up]) => {
      const p = side(at(f), d);
      if (placeProblem(id, p.x, p.y)) return;
      placeTower(id, p.x, p.y);
      const t = G.towers[G.towers.length - 1];
      up.forEach((n, i) => { for (let k = 0; k < n; k++) buyUpgrade(t, i); });
      t.ang = 0.4;
    });
    { const p = side(at(0.23), 62); if (!placeProblem(G.heroId, p.x, p.y)) placeHero(G.heroId, p.x, p.y); }
    ['lucni_slizak', 'lesni_slizak', 'prilbosliz', 'stitonos_sliz', 'bublinkovy_sliz', 'zlaty_sliz', 'duhovy_sliz', 'zuivy_sliz'].forEach((id, i) => {
      const e = spawnEnemy(id, 0, P.len * (0.1 + i * 0.03)); if (e) { const q = at(0.1 + i * 0.03); e.x = q.x; e.y = q.y; e.ang = q.ang; }
    });
    const xs = G.towers.map(t => t.x), ys = G.towers.map(t => t.y);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : TW / 3, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : TH / 3;
    const W = 520, H = 300, x0 = Math.max(0, Math.min(TW - W, cx - W / 2)), y0 = Math.max(0, Math.min(TH - H, cy - H / 2));
    const big = document.createElement('canvas'); big.width = TW; big.height = TH;
    for (const [k] of GFX) {
      localStorage.setItem('td_gfx', k);
      const g = big.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, TW, TH);
      TR.render(g, { sel: null, ghost: null });
      const c = document.createElement('canvas'); c.width = W / 2 * 1.5; c.height = H / 2 * 1.5;
      c.getContext('2d').drawImage(big, x0, y0, W, H, 0, 0, c.width, c.height);
      out[k] = c.toDataURL('image/jpeg', 0.85);
    }
  } catch (e) { console.warn('Ukázka grafiky:', e); }
  finally {
    try { if (saved == null) localStorage.removeItem('td_gfx'); else localStorage.setItem('td_gfx', saved); } catch (_) { /* nic */ }
    G = keep; window.sfx = sfx;
  }
  return out;
}

// ═══ phone.js — telefon jako v GTA: rychlý přesun po aplikaci (hlavní stránka, místnost, kartičky, kvíz)
// Ikona vlevo dole nebo klávesa F2 vysune telefon s aplikacemi, šipky a Enter ho ovládají i z klávesnice.
// Do stránek her se nenačítá. Host (anonym) ho nemá, je jen v jedné místnosti.

(function () {
  const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${p}</svg>`;
  const I = {
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18.500h2"/>',
    home: '<path d="M3 11l9-8 9 8M5 9.500V21h14V9.500M10 21v-6h4v6"/>',
    rooms: '<rect x="3" y="3" width="7" height="7" rx="1.500"/><rect x="14" y="3" width="7" height="7" rx="1.500"/><rect x="3" y="14" width="7" height="7" rx="1.500"/><rect x="14" y="14" width="7" height="7" rx="1.500"/>',
    last: '<path d="M3 12a9 9 0 1 0 3-6.700L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 2h12a2 2 0 0 1 2 2v12"/>',
    games: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.500 12.500h3M15.500 12h.01M18 14h.01"/>',
    friends: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800"/>',
    files: '<path d="m21.400 11.100-9.200 9.200a6 6 0 0 1-8.500-8.500l9.200-9.200a4 4 0 0 1 5.700 5.700l-9.200 9.200a2 2 0 0 1-2.800-2.800l8.500-8.500"/>',
    garden: '<path d="M12 22v-6M12 2a6 6 0 0 0-5.700 7.900A5 5 0 0 0 8 19h8a5 5 0 0 0 1.700-9.100A6 6 0 0 0 12 2z"/>',
    pomo: '<circle cx="12" cy="14" r="8"/><path d="M12 6V3M12 6c-2-1-4-1-5 0M12 6c2-1 4-1 5 0M12 10v4l2 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M2 12h3M19 12h3M4.900 19.100 7 17M17 7l2.100-2.100"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
  };
  const GAMES = [
    ['denni', 'Denní výzva', 'denni.html'], ['spojovacka', 'Spojovačka', 'spojovacka.html'], ['pravdalez', 'Pravda / lež', 'pravdalez.html'],
    ['pexeso', 'Pexeso', 'pexeso.html'], ['osmismerka', 'Osmisměrka', 'osmismerka.html'], ['krizovka', 'Křížovka', 'krizovka.html'],
    ['sibenice', 'Šibenice', 'sibenice.html'], ['milionar', 'Milionář', 'milionar.html'], ['dobyvatel', 'Dobyvatel', 'dobyvatel.html'],
    ['obrana', 'Obrana království', 'obrana.html'], ['zombie', 'Zombie Survival', 'dashboard.html?tab=games&play=zombie'],
  ];
  const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const onDashboard = /\/_?dashboard(\.html)?$/.test(location.pathname);
  const thisRoom = /\/_?room(\.html)?$/.test(location.pathname) ? new URLSearchParams(location.search).get('id') : null;

  let UID = null, btn = null, wrap = null, screen = 'home', badge = 0, lastRoom = null, gardenXp = null;

  // ── data pro ikony (načítá se až při otevření, ať stránka nečeká) ──
  function lastRoomId() {
    try {
      const o = JSON.parse(localStorage.getItem('sb_room_opened') || '{}') || {};
      return Object.entries(o).filter(([id]) => id !== thisRoom).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    } catch (_) { return null; }
  }
  async function loadData() {
    const id = lastRoomId();
    const jobs = [];
    if (id && lastRoom?.id !== id) jobs.push(db.collection('rooms').doc(id).get().then(s => { lastRoom = s.exists && (s.data().memberIds || []).includes(UID) ? { id, name: s.data().name, color: s.data().color } : null; }).catch(() => { lastRoom = null; }));
    jobs.push(Promise.all([
      db.collection('roomInvites').where('toUid', '==', UID).where('status', '==', 'pending').get().then(s => s.docs.filter(d => (d.data().exp || 0) > Date.now()).length).catch(() => 0),
      db.collection('friendRequests').where('toUid', '==', UID).get().then(s => s.docs.filter(d => d.data().status === 'pending').length).catch(() => 0),
    ]).then(([a, b]) => { badge = a + b; }));
    if (gardenXp == null) jobs.push(db.collection('users').doc(UID).get().then(s => { gardenXp = s.data()?.garden?.xp ?? 0; }).catch(() => {}));
    if (typeof gardenIcon !== 'function') jobs.push(loadScript('js/garden.js'));
    await Promise.all(jobs);
    if (wrap && !wrap.hidden && screen === 'home') render();
  }
  const scripts = {};
  function loadScript(src) {
    return scripts[src] || (scripts[src] = new Promise(res => {
      const s = document.createElement('script');
      s.src = src + '?v=' + (window.APP_VERSION || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
      s.onload = s.onerror = res;
      document.head.appendChild(s);
    }));
  }
  function pomoTime() {
    try {
      const p = JSON.parse(localStorage.getItem('sb_pomo') || 'null');
      if (!p) return '';
      const sec = Math.round((p.running ? Math.max(0, p.endAt - Date.now()) : p.left > 0 ? p.left : 0) / 1000);   // left i endAt jsou v ms
      return sec ? `${p.running ? '' : '⏸ '}${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '';
    } catch (_) { return ''; }
  }

  // ── obrazovky ──
  const tile = (o) => `<${o.href ? `a href="${esc2(o.href)}"` : 'button type="button"'} class="ph-app" ${o.act ? `data-act="${o.act}"` : ''} title="${esc2(o.title || o.label)}">
      <span class="ph-ico" style="--c:${o.color}">${o.html || svg(o.ico)}${o.badge ? `<i class="ph-badge">${o.badge}</i>` : ''}</span>
      <span class="ph-label">${esc2(o.label)}</span></${o.href ? 'a' : 'button'}>`;
  function homeApps() {
    const dash = t => (onDashboard ? null : `dashboard.html?tab=${t}`);
    const stage = gardenXp != null && typeof gardenIcon === 'function' && typeof gardenStage === 'function' ? gardenIcon(gardenStage(gardenXp)) : null;
    return [
      { label: 'Domů', ico: I.home, color: '#6366f1', href: 'dashboard.html' },
      { label: 'Místnosti', ico: I.rooms, color: '#0ea5e9', act: 'rooms' },
      lastRoom && { label: lastRoom.name || 'Místnost', title: 'Poslední místnost: ' + lastRoom.name, ico: I.last, color: lastRoom.color || '#a855f7', href: `room.html?id=${encodeURIComponent(lastRoom.id)}` },
      { label: 'Kartičky', ico: I.cards, color: '#f59e0b', href: dash('flash'), act: 'tab:flash' },
      { label: 'Hry', ico: I.games, color: '#ef4444', act: 'games' },
      { label: 'Přátelé', ico: I.friends, color: '#10b981', href: dash('friends'), act: 'tab:friends', badge },
      { label: 'Soubory', ico: I.files, color: '#64748b', href: dash('files'), act: 'tab:files' },
      { label: 'Zahrada', ico: I.garden, html: stage, color: '#166534', href: onDashboard ? null : 'dashboard.html?open=garden', act: 'garden' },
      { label: pomoTime() || 'Pomodoro', title: 'Pomodoro', ico: I.pomo, color: '#e11d48', act: 'pomo' },
      { label: 'Nastavení', ico: I.gear, color: '#475569', act: 'settings' },
    ].filter(Boolean);
  }
  function render() {
    const body = wrap.querySelector('.ph-screen');
    if (screen === 'games') {
      const bn = id => (window.SBB && SBB.svg ? uniqIds(SBB.svg(id)).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ') : '');
      body.innerHTML = `<div class="ph-head"><button type="button" class="ph-back" data-act="home" aria-label="Zpět">${svg(I.back)}</button><b>Hry</b></div>
        <div class="ph-games">${GAMES.map(([id, name, href]) => `<a class="ph-game" href="${esc2(href)}"${id === 'zombie' && onDashboard ? ' data-act="zombie"' : ''}><span class="ph-thumb">${bn(id)}</span><span class="ph-game-n">${esc2(name)}</span></a>`).join('')}</div>`;
    } else if (screen === 'rooms') {
      body.innerHTML = head('Místnosti') + roomsHtml();
      paintRoomArt(body);
    } else if (screen === 'settings') {
      body.innerHTML = head('Nastavení') + settingsHtml();
    } else {
      body.innerHTML = `<div class="ph-grid">${homeApps().map(tile).join('')}</div>`;
    }
  }
  const head = t => `<div class="ph-head"><button type="button" class="ph-back" data-act="home" aria-label="Zpět">${svg(I.back)}</button><b>${t}</b></div>`;
  // Stejný banner je na hlavní stránce i ve skryté záložce: se stejnými ID by si prohlížeč bral přechody a filtry
  // odtud a kresba by přišla o barvy. Každá kresba v telefonu proto dostane vlastní ID.
  let idSeq = 0;
  function uniqIds(s) {
    const n = '-ph' + (++idSeq);
    return s.replace(/\bid="([^"]+)"/g, (_, i) => `id="${i}${n}"`).replace(/url\(#([^)]+)\)/g, (_, i) => `url(#${i}${n})`).replace(/href="#([^"]+)"/g, (_, i) => `href="#${i}${n}"`);
  }

  // ── Místnosti ──
  let ROOMS = null;
  async function loadRooms() {
    let opened = {};
    try { opened = JSON.parse(localStorage.getItem('sb_room_opened') || '{}') || {}; } catch (_) {}
    try {
      const s = await db.collection('rooms').where('memberIds', 'array-contains', UID).get();
      ROOMS = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (opened[b.id] || 0) - (opened[a.id] || 0) || String(a.name).localeCompare(String(b.name), 'cs'));
    } catch (e) { ROOMS = []; }
    if (ROOMS.some(r => r.cardArt)) await Promise.all([loadScript('js/bggen.js'), loadScript('js/aibanner.js')]);
    if (wrap && !wrap.hidden && screen === 'rooms') render();
  }
  function roomsHtml() {
    if (!ROOMS) return '<p class="ph-empty">Načítám…</p>';
    if (!ROOMS.length) return '<p class="ph-empty">Zatím nejsi v žádné místnosti.</p>';
    return `<div class="ph-games">${ROOMS.map(r => `<a class="ph-game" href="room.html?id=${encodeURIComponent(r.id)}">
      <span class="ph-thumb ph-room-art" data-room="${esc2(r.id)}" style="--c:${esc2(r.color || '#6366f1')}">${r.id === thisRoom ? '<i class="ph-here">Tady jsi</i>' : ''}</span>
      <span class="ph-game-n">${esc2(r.name || 'Místnost')}</span></a>`).join('')}</div>`;
  }
  function paintRoomArt(body) {
    body.querySelectorAll('[data-room]').forEach(el => {
      const r = ROOMS.find(x => x.id === el.dataset.room); if (!r) return;
      let u = null;
      if (r.cardArt === 'ai' && r.cardSvg && window.SBAiBanner) u = Promise.resolve(SBAiBanner.toUrl(r.cardSvg));
      else if (window.BgGen && BgGen.isRecipe(r.cardArt)) u = BgGen.toUrl(r.cardArt, 'karta', 0.5);
      u?.then?.(url => { if (url) el.style.backgroundImage = `url("${url}")`; });
    });
  }

  // ── Nastavení přímo v telefonu ──
  const THEMES = [['', 'Půlnoc', '#0D0E12', '#8B93FF'], ['ocean', 'Oceán', '#071a26', '#06b6d4'], ['les', 'Les', '#0c1a12', '#22c55e'], ['zapad', 'Západ', '#1c1210', '#f97316'], ['kocka', 'Kočičí', '#17121a', '#f4a6c6'],
    ['svetly', 'Světlý', '#eef2f7', '#6366f1'], ['breidlice', 'Břidlice', '#14181d', '#78909c'], ['kava', 'Káva', '#1a1613', '#b08d6a'], ['salvej', 'Šalvěj', '#141a16', '#8aa891'], ['serik', 'Šeřík', '#191519', '#a48ca8'],
    ['malina', 'Malina', '#1a0f16', '#ec4899'], ['jantar', 'Jantar', '#1a1508', '#f59e0b'], ['fialka', 'Fialka', '#130f24', '#a855f7'], ['cerna', 'Černá', '#000000', '#38bdf8'], ['papir', 'Papír', '#f4eee4', '#b45309']];
  const ls = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  let GFX = null;
  function settingsHtml() {
    const cur = ls('sb_theme'), cat = ls('sb_cat') === '1' || cur === 'kocka', S = window.SBSound?.get(), paper = ls('sb_note_paper');
    const seg = (name, val, opts) => `<div class="ph-seg">${opts.map(([v, t]) => `<button type="button" data-seg="${name}" data-v="${v}" class="${v === val ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const gfx = window.SBGfx ? Object.entries(SBGfx.GAMES).map(([g, G]) => `<label class="ph-field">${esc2(G.name)}</label>${seg('gfx:' + g, (GFX && GFX[g]) || SBGfx.read(g), G.opts.map(([k, n]) => [k, n]))}`).join('') : '<p class="ph-empty">Načítám…</p>';
    return `<div class="ph-set">
      <div class="ph-sec">Vzhled</div>
      <div class="ph-themes">${THEMES.filter(t => t[0] !== 'kocka' || cat).map(([k, n, bg, ac]) => `<button type="button" class="ph-theme${k === cur ? ' on' : ''}" data-ptheme="${k}" title="${n}"><i style="background:linear-gradient(135deg, ${bg} 50%, ${ac} 50%)"></i>${n}</button>`).join('')}</div>
      ${S ? `<div class="ph-sec">Zvuk</div>
      <label class="ph-row"><span>Hudba</span><input type="checkbox" data-snd="music" ${S.music ? 'checked' : ''}></label>
      <input type="range" class="ph-range" min="0" max="100" value="${Math.round(S.musicVol * 100)}" data-vol="musicVol" aria-label="Hlasitost hudby">
      <label class="ph-row"><span>Efekty</span><input type="checkbox" data-snd="sfx" ${S.sfx ? 'checked' : ''}></label>
      <input type="range" class="ph-range" min="0" max="100" value="${Math.round(S.sfxVol * 100)}" data-vol="sfxVol" aria-label="Hlasitost efektů">` : ''}
      <div class="ph-sec">Pozadí poznámek</div>
      ${seg('paper', paper, [['', 'Podle motivu'], ['light', 'Bílé'], ['dark', 'Černé']])}
      <div class="ph-sec">Grafika her</div>
      ${gfx}
      <div class="ph-sec">AI klíče</div>
      <label class="ph-field" for="phGem">Gemini</label><input id="phGem" type="password" class="ph-input" autocomplete="off" placeholder="AQ.Ab8R…" value="${esc2(ls('sb_gemini_key'))}">
      <label class="ph-field" for="phGroq">Groq (záložní)</label><input id="phGroq" type="password" class="ph-input" autocomplete="off" placeholder="gsk_…" value="${esc2(ls('sb_groq_key'))}">
      <button type="button" class="ph-wide" data-act="savekeys">Uložit klíče</button>
      <div class="ph-sec">Účet</div>
      ${onDashboard ? '<button type="button" class="ph-wide" data-act="account">Účet a přihlášení</button>' : '<a class="ph-wide" href="dashboard.html?open=settings">Účet a přihlášení</a>'}
    </div>`;
  }
  function setTheme(k) {
    if (typeof applyTheme === 'function') applyTheme(k);
    else {
      if (k) document.documentElement.setAttribute('data-theme', k); else document.documentElement.removeAttribute('data-theme');
      try { if (k) localStorage.setItem('sb_theme', k); else localStorage.removeItem('sb_theme'); } catch (_) {}
    }
    db.collection('users').doc(UID).update({ theme: k }).catch(() => {});
  }
  async function saveKeys() {
    const g = wrap.querySelector('#phGem').value.trim(), q = wrap.querySelector('#phGroq').value.trim();
    try {
      if (g) localStorage.setItem('sb_gemini_key', g); else localStorage.removeItem('sb_gemini_key');
      if (q) localStorage.setItem('sb_groq_key', q); else localStorage.removeItem('sb_groq_key');
      await db.collection('users').doc(UID).collection('private').doc('ai').set({ geminiKey: g || null, groqKey: q || null }, { merge: true });
      window.toast?.('Klíče uloženy ✓');
    } catch (e) { window.toast?.('Chyba: ' + e.message); }
  }
  function clock() {
    const c = wrap?.querySelector('.ph-clock');
    if (c) c.textContent = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  }
  function build() {
    wrap = document.createElement('div');
    wrap.className = 'ph-wrap';
    wrap.hidden = true;
    wrap.innerHTML = `<div class="ph-device" role="dialog" aria-label="Telefon">
        <div class="ph-status"><span class="ph-clock"></span><i class="ph-notch"></i><span class="ph-sig"><i></i><i></i><i></i><i></i><b></b></span></div>
        <div class="ph-screen"></div>
        <button type="button" class="ph-home" data-act="home" aria-label="Domovská obrazovka telefonu"></button>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap) { close(); return; }
      const pt = e.target.closest('[data-ptheme]');
      if (pt) { setTheme(pt.dataset.ptheme); render(); return; }
      const sg = e.target.closest('[data-seg]');
      if (sg) {
        const name = sg.dataset.seg, v = sg.dataset.v;
        sg.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === sg));
        if (name === 'paper') { try { if (v) localStorage.setItem('sb_note_paper', v); else localStorage.removeItem('sb_note_paper'); } catch (_) {} window.SBPaper?.apply(); }
        else if (name.startsWith('gfx:')) { window.SBGfx?.save(UID, name.slice(4), v); (GFX || (GFX = {}))[name.slice(4)] = v; }
        return;
      }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'games' || act === 'home' || act === 'rooms' || act === 'settings') { e.preventDefault(); show(act); return; }
      if (act === 'savekeys') { saveKeys(); return; }
      if (act === 'account') { e.stopPropagation(); close(); document.getElementById('settingsBtn')?.click(); return; }
      if (act.startsWith('tab:') && onDashboard) { e.preventDefault(); close(); document.querySelector(`.tab-btn[data-tab="${act.slice(4)}"]`)?.click(); return; }
      if (act === 'zombie') { e.preventDefault(); close(); document.querySelector('.tab-btn[data-tab="games"]')?.click(); document.getElementById('survivalCard')?.dispatchEvent(new CustomEvent('gameplay')); return; }
      if (act === 'pomo') { e.preventDefault(); e.stopPropagation(); close(); document.getElementById('pomoBtn')?.click(); return; }
      if (act === 'garden' && onDashboard) { e.preventDefault(); close(); if (typeof openGarden === 'function' && typeof GARDEN !== 'undefined' && GARDEN) openGarden(); }
    });
    wrap.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.vol) window.SBSound?.set(t.dataset.vol, +t.value / 100);
      if (t.dataset.snd) window.SBSound?.set(t.dataset.snd, t.checked);
    });
    wrap.addEventListener('keydown', e => {
      e.stopPropagation();   // psaní a šipky v telefonu nesmí ovládat stránku pod ním
      if (e.target.matches('input, select, textarea')) return;
      const items = [...wrap.querySelectorAll('.ph-screen a, .ph-screen button')], i = items.indexOf(document.activeElement);
      const cols = screen === 'home' ? 4 : screen === 'settings' ? 1 : 2;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step) { e.preventDefault(); (items[i < 0 ? 0 : Math.max(0, Math.min(items.length - 1, i + step))])?.focus(); }
      else if (e.key === 'Backspace' && screen !== 'home') { e.preventDefault(); show('home'); }
    });
  }
  async function show(name) {
    screen = name;
    if (name === 'games' && !window.SBB) await loadScript('js/banners.js');
    if (name === 'rooms' && !ROOMS) loadRooms();
    if (name === 'settings' && !window.SBGfx) loadScript('js/gfxpref.js').then(() => { if (screen === 'settings') render(); });
    if (name === 'settings' && window.SBGfx && !GFX) SBGfx.load(UID).then(g => { GFX = g || {}; if (screen === 'settings') render(); }).catch(() => {});
    render();
    window.sfx?.('click');
    if (matchMedia('(pointer: fine)').matches) wrap.querySelector('.ph-screen a, .ph-screen button:not(.ph-back)')?.focus();
  }
  function open() {
    if (!wrap) build();
    if (!wrap.hidden) return;
    screen = 'home';
    wrap.hidden = false;
    btn?.classList.add('on');
    clock(); render();
    requestAnimationFrame(() => { wrap.classList.add('open'); document.dispatchEvent(new Event('sb-phone')); });
    window.sfx?.('click');
    if (matchMedia('(pointer: fine)').matches) wrap.querySelector('.ph-screen a, .ph-screen button')?.focus();
    loadData();
    clearInterval(open._t);
    open._t = setInterval(clock, 5000);
  }
  function close() {
    if (!wrap || wrap.hidden) return;
    wrap.classList.remove('open');
    document.dispatchEvent(new Event('sb-phone'));
    btn?.classList.remove('on');
    clearInterval(open._t);
    setTimeout(() => { if (!wrap.classList.contains('open')) wrap.hidden = true; }, 220);
  }
  function mount() {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ph-btn';
    btn.title = 'Telefon (F2)';
    btn.setAttribute('aria-label', 'Telefon');
    btn.innerHTML = svg(I.phone);
    btn.addEventListener('click', () => (wrap && !wrap.hidden ? close() : open()));
    document.body.appendChild(btn);
    document.addEventListener('keydown', e => {
      if (e.key === 'F2') { e.preventDefault(); wrap && !wrap.hidden ? close() : open(); }
      else if (e.key === 'Escape' && wrap && !wrap.hidden) { e.stopPropagation(); close(); }
    }, true);
  }

  firebase.auth().onAuthStateChanged(u => {
    if (!u || u.isAnonymous || btn) return;
    UID = u.uid;
    mount();
  });
})();

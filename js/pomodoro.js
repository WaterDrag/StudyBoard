// ═══ pomodoro.js — minutka na učení (práce / pauza) v horní liště
// Běží přes všechny stránky: stav je v localStorage jako čas konce fáze,
// takže přechod mezi nástěnkou, místností a kartičkami ji nezastaví.
// Odpracovaný čas (jen fáze Práce, opravdu uběhlý) se ukládá do
// users/{uid}.focus.{YYYY-MM-DD} v sekundách — počítá se i do žebříčku týdne.
(function () {
  const KEY = 'sb_pomo';
  const PRESETS = {
    classic: { label: '25 / 5', work: 25, brk: 5, long: 15 },
    long:    { label: '50 / 10', work: 50, brk: 10, long: 20 },
    short:   { label: '15 / 3', work: 15, brk: 3, long: 10 },
  };
  const PHASE_NAME = { work: 'Práce', brk: 'Pauza', long: 'Dlouhá pauza' };
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5M12 2.5V5"/></svg>';

  const fresh = () => ({ preset: 'classic', phase: 'work', running: false, endAt: 0, left: 0, runStart: 0, round: 1, sound: true });
  function load() {
    try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return fresh(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* jen v této záložce */ } }
  let S = load();
  const P = () => PRESETS[S.preset] || PRESETS.classic;
  const phaseMs = ph => P()[ph === 'work' ? 'work' : ph === 'brk' ? 'brk' : 'long'] * 60e3;
  const leftMs = () => S.running ? Math.max(0, S.endAt - Date.now()) : (S.left || phaseMs(S.phase));
  const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

  // ── Ukládání času učení ─────────────────────────────────────
  const me = () => (typeof auth !== 'undefined' && auth.currentUser) || null;
  function recordFocus(sec, at = Date.now()) {
    sec = Math.round(sec);
    if (sec < 5) return;
    const u = me();
    if (!u || u.isAnonymous || typeof db === 'undefined' || !db) return;
    db.collection('users').doc(u.uid).set({ focus: { [dayKey(at)]: firebase.firestore.FieldValue.increment(sec) } }, { merge: true }).catch(() => {});
    STATS = null;   // přenačíst při dalším otevření
  }
  // Uběhlý čas práce od posledního spuštění (nejvýš do konce fáze).
  function workSeconds(until = Date.now()) {
    return S.phase === 'work' && S.runStart ? Math.max(0, (Math.min(until, S.endAt || until) - S.runStart) / 1000) : 0;
  }
  function flushWork(until = Date.now()) {
    recordFocus(workSeconds(until), until);
    S.runStart = 0;
  }

  // ── Ovládání ────────────────────────────────────────────────
  function start() {
    if (S.running) return;
    S.endAt = Date.now() + leftMs();
    S.running = true;
    S.runStart = S.phase === 'work' ? Date.now() : 0;
    S.left = 0;
    save(); askNotify(); unlockAudio(); tick(); render();
  }
  function pause() {
    if (!S.running) return;
    flushWork();
    S.left = leftMs();
    S.running = false;
    save(); render();
  }
  function reset() {
    if (S.running) flushWork();
    S.running = false; S.left = 0; S.phase = 'work'; S.round = 1;
    save(); render();
  }
  function skip() {
    if (S.running) flushWork();
    advance(false, Date.now());
    save(); render();
  }
  // Konec fáze: po práci se pauza spustí sama, po pauze se čeká na Start.
  function advance(natural, at) {
    if (S.phase === 'work') {
      const longNext = S.round >= 4;
      S.phase = longNext ? 'long' : 'brk';
      S.running = natural;
      S.endAt = at + phaseMs(S.phase);
    } else {
      S.round = S.phase === 'long' ? 1 : S.round + 1;
      S.phase = 'work';
      S.running = false;
    }
    S.left = 0;
    S.runStart = 0;
  }
  // Volá se každou sekundu (a po návratu do záložky). Dohání i fáze, které
  // uběhly, když byla stránka zavřená.
  function catchUp() {
    S = load();
    let changed = false, ended = null, work = 0, workAt = 0;
    while (S.running && Date.now() >= S.endAt) {
      const at = S.endAt;
      if (S.phase === 'work') { work += workSeconds(at); workAt = at; }
      ended = S.phase;
      advance(true, at);
      changed = true;
    }
    if (changed) {
      // Jen jedna záložka smí zapsat konec fáze (ostatní pak načtou nový stav).
      const mark = ended + ':' + S.endAt + ':' + S.phase + ':' + S.round;
      let dup = false;
      try { dup = localStorage.getItem(KEY + '_done') === mark; localStorage.setItem(KEY + '_done', mark); } catch (_) { /* nic */ }
      if (!dup) { recordFocus(work, workAt); save(); announce(ended); }
    }
    return changed;
  }

  // ── Upozornění ──────────────────────────────────────────────
  let AC = null;
  function unlockAudio() {
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (_) { AC = null; }
  }
  function beep() {
    if (!S.sound || !AC) return;
    try {
      [0, 0.28, 0.56].forEach((t, i) => {
        const o = AC.createOscillator(), g = AC.createGain();
        o.frequency.value = i === 2 ? 880 : 660;
        g.gain.setValueAtTime(0.0001, AC.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, AC.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t + 0.22);
        o.connect(g).connect(AC.destination);
        o.start(AC.currentTime + t); o.stop(AC.currentTime + t + 0.25);
      });
    } catch (_) { /* bez zvuku */ }
  }
  function askNotify() {
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch?.(() => {}); } catch (_) { /* nic */ }
  }
  function announce(ended) {
    const msg = ended === 'work'
      ? `Hotovo! Dej si ${P()[S.phase === 'long' ? 'long' : 'brk']} minut pauzu.`
      : 'Pauza skončila — zpátky k učení.';
    beep();
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Pomodoro', { body: msg, icon: NOTO_TOMATO }); } catch (_) { /* nic */ }
    if (typeof toast === 'function') toast('🍅 ' + msg);
  }

  // ── Statistiky ──────────────────────────────────────────────
  let STATS = null;
  async function loadStats() {
    const u = me();
    if (!u || u.isAnonymous || !db) return null;
    try {
      const snap = await db.collection('users').doc(u.uid).get();
      STATS = (snap.exists && snap.data().focus) || {};
    } catch (_) { STATS = {}; }
    return STATS;
  }
  const minTxt = sec => { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  function statsHtml() {
    if (!STATS) return '<div class="pomo-stats-h">Načítám statistiky…</div>';
    const days = Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - (6 - i) * 864e5));
    const vals = days.map(d => STATS[d] || 0);
    const max = Math.max(1500, ...vals);
    const week = vals.reduce((a, b) => a + b, 0);
    const names = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    return `<div class="pomo-stats-h"><span>Dnes <b>${minTxt(vals[6])}</b></span><span>7 dní <b>${minTxt(week)}</b></span></div>
      <div class="pomo-bars">${vals.map((v, i) => `<div class="pomo-bar" title="${minTxt(v)}"><i style="height:${Math.round(v / max * 100)}%"></i><span>${names[new Date(days[i]).getUTCDay()]}</span></div>`).join('')}</div>`;
  }

  // ── Vzhled ──────────────────────────────────────────────────
  let btn = null, pop = null, float = null, timer = null;
  function mount() {
    const host = document.querySelector('.user-info, .room-nav-right, .fc-nav');
    if (!host || document.getElementById('pomoBtn')) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pomoBtn';
    btn.className = 'icon-btn pomo-btn';
    btn.title = 'Pomodoro — minutka na učení';
    btn.setAttribute('aria-label', 'Pomodoro');
    btn.innerHTML = ICON + '<span class="pomo-time"></span>';
    if (host.classList.contains('fc-nav')) host.appendChild(btn); else host.prepend(btn);
    btn.addEventListener('click', e => { e.stopPropagation(); pop ? closePop() : openPop(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { catchUp(); render(); tick(); } });
    window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); render(); tick(); } });
    window.addEventListener('resize', render);
    catchUp();
    render();
    tick();
  }
  function tick() {
    clearInterval(timer);
    if (!S.running) return;
    timer = setInterval(() => {
      if (catchUp() && !S.running) clearInterval(timer);
      render();
    }, 1000);
  }
  // Google emoji (Noto) do ikonky záložky — do názvu záložky se obrázek dát nedá
  const NOTO_TOMATO = 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f345/512.png', NOTO_COFFEE = 'https://fonts.gstatic.com/s/e/notoemoji/latest/2615/512.png';
  let iconOrig = null;
  function tabIcon(src) {
    const l = document.querySelector('link[rel="icon"]'); if (!l) return;
    if (iconOrig == null) iconOrig = l.href;
    const want = src || iconOrig;
    if (l.href !== want) l.href = want;
  }
  function render() {
    if (!btn) return;
    const active = S.running || S.left > 0;
    const t = fmt(leftMs());
    btn.classList.toggle('on', active);
    btn.classList.toggle('brk', S.phase !== 'work');
    btn.classList.toggle('paused', !S.running && active);
    btn.querySelector('.pomo-time').textContent = active ? t : '';
    document.title = document.title.replace(/^(?:[🍅☕]|Práce|Pauza) \d\d:\d\d · /u, '');
    if (S.running) document.title = `${S.phase === 'work' ? 'Práce' : 'Pauza'} ${t} · ${document.title}`;
    tabIcon(S.running ? (S.phase === 'work' ? NOTO_TOMATO : NOTO_COFFEE) : null);
    // V místnosti na telefonu je horní lišta schovaná — běžící čas ukáže plovoucí štítek.
    const hidden = btn.offsetParent === null;
    if (active && hidden) {
      if (!float) {
        float = document.createElement('button');
        float.type = 'button';
        float.className = 'pomo-float';
        float.addEventListener('click', e => { e.stopPropagation(); pop ? closePop() : openPop(); });
        document.body.appendChild(float);
      }
      float.classList.toggle('brk', S.phase !== 'work');
      float.textContent = `${S.phase === 'work' ? '🍅' : '☕'} ${t}${S.running ? '' : ' ⏸'}`;
    } else if (float) { float.remove(); float = null; }
    if (pop) renderPop();
  }
  function renderPop() {
    const left = leftMs(), total = phaseMs(S.phase);
    pop.querySelector('.pomo-phase').textContent = PHASE_NAME[S.phase];
    pop.querySelector('.pomo-big').textContent = fmt(left);
    pop.querySelector('.pomo-ring i').style.width = ((1 - left / total) * 100) + '%';
    pop.querySelector('[data-p="toggle"]').textContent = S.running ? '⏸ Zastavit' : (S.left ? '▶ Pokračovat' : '▶ Start');
    pop.querySelector('.pomo-dots').innerHTML = [1, 2, 3, 4].map(i => `<i class="${i < S.round || (i === S.round && S.phase !== 'work') ? 'done' : i === S.round ? 'cur' : ''}"></i>`).join('');
    pop.querySelectorAll('[data-preset]').forEach(b => { b.classList.toggle('on', b.dataset.preset === S.preset); b.disabled = S.running; });
    pop.querySelector('[data-p="sound"]').textContent = S.sound ? '🔔 Zvuk' : '🔕 Bez zvuku';
    pop.classList.toggle('brk', S.phase !== 'work');
  }
  function openPop() {
    closePop();
    pop = document.createElement('div');
    pop.className = 'pomo-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Pomodoro');
    pop.innerHTML = `
      <div class="pomo-head"><b>🍅 Pomodoro</b><span class="pomo-phase"></span></div>
      <div class="pomo-big"></div>
      <div class="pomo-ring"><i></i></div>
      <div class="pomo-dots" title="Kolo 1–4, po čtvrtém dlouhá pauza"></div>
      <div class="pomo-ctrl">
        <button type="button" class="btn btn-primary" data-p="toggle"></button>
        <button type="button" class="btn btn-ghost" data-p="skip" title="Přeskočit na další fázi">⏭</button>
        <button type="button" class="btn btn-ghost" data-p="reset" title="Vynulovat">↺</button>
      </div>
      <div class="pomo-presets">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" data-preset="${k}">${p.label}</button>`).join('')}
        <button type="button" class="pomo-sound" data-p="sound"></button></div>
      <div class="pomo-stats">${statsHtml()}</div>
      <p class="pomo-note">Počítá se jen čas fáze Práce. Každých 5 minut = 1 bod do žebříčku týdne.</p>`;
    document.body.appendChild(pop);
    place();
    pop.addEventListener('click', e => {
      e.stopPropagation();
      const a = e.target.closest('[data-p]')?.dataset.p, pr = e.target.closest('[data-preset]')?.dataset.preset;
      if (a === 'toggle') S.running ? pause() : start();
      else if (a === 'skip') skip();
      else if (a === 'reset') reset();
      else if (a === 'sound') { S.sound = !S.sound; save(); render(); }
      else if (pr && !S.running) { S.preset = pr; S.left = 0; save(); render(); }
    });
    renderPop();
    if (!STATS) loadStats().then(() => { if (pop) pop.querySelector('.pomo-stats').innerHTML = statsHtml(); });
    setTimeout(() => {
      document.addEventListener('click', outside);
      document.addEventListener('keydown', escKey);
    }, 0);
  }
  function place() {
    const r = btn.getBoundingClientRect();
    if (window.innerWidth < 560 || btn.offsetParent === null) { pop.classList.add('sheet'); return; }
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
  }
  const outside = e => { if (pop && !pop.contains(e.target)) closePop(); };
  const escKey = e => { if (e.key === 'Escape') closePop(); };
  function closePop() {
    pop?.remove(); pop = null;
    document.removeEventListener('click', outside);
    document.removeEventListener('keydown', escKey);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();

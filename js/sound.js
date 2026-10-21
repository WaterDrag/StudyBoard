// ═══ sound.js — hudba a zvukové efekty, celé generované v prohlížeči (Web Audio)
// Žádné zvukové soubory: efekty i hudba se skládají z oscilátorů a šumu, takže
// nic nestahujeme, nejsou v tom cizí práva a stránka se nezpomalí.
//   sfx('ok' | 'bad' | 'click' | 'flip' | 'tick' | 'win' | 'lose' | 'combo' | 'pop' |
//       'place' | 'tower' | 'coin' | 'start' | 'hint' | 'notify', opts)
//   soundMood('study' | 'quiz' | 'millionaire' | 'conquest' | 'zombie')
// Prohlížeč pustí zvuk až po prvním kliknutí / klávese — hudba začne s ním.
// Nastavení (localStorage sb_sound): hudba / efekty zapnuto + hlasitost zvlášť.
(function () {
  const KEY = 'sb_sound';
  const DEF = { music: true, sfx: true, musicVol: 0.32, sfxVol: 0.6 };
  let S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) { return { ...DEF }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* jen pro tuhle návštěvu */ } };

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, unlocked = false;
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -14; master.ratio.value = 4;
    master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    applyVol();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function applyVol() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(S.music ? S.musicVol * 0.55 : 0, ctx.currentTime, 0.15);
    sfxBus.gain.setTargetAtTime(S.sfx ? S.sfxVol : 0, ctx.currentTime, 0.02);
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!unlocked) { unlocked = true; if (S.music && MOOD) musicStart(); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  // Na pozadí nic nehraje (šetří baterii, na mobilu se plánování stejně zastaví).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
  });

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ── Stavební kameny ───────────────────────────────────────────
  // Tón s obálkou: typ vlny, výška, začátek, délka, hlasitost, filtr.
  function tone(bus, { type = 'sine', f, f2, t, dur = 0.2, vol = 0.3, a = 0.005, r, lp, q = 0.7, detune = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const rel = r ?? dur * 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel);
    let node = o;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; o.connect(fl); node = fl; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + a + rel + 0.05);
  }
  function noise(bus, { t, dur = 0.1, vol = 0.2, hp, lp, bp, a = 0.002 }) {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = noiseBuf;
    let node = s;
    const filt = (type, f) => { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; node.connect(fl); node = fl; };
    if (hp) filt('highpass', hp); if (lp) filt('lowpass', lp); if (bp) filt('bandpass', bp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ── Efekty ────────────────────────────────────────────────────
  const FX = {
    click: t => tone(sfxBus, { type: 'triangle', f: 1400, f2: 900, t, dur: 0.04, vol: 0.18 }),
    tick: t => tone(sfxBus, { type: 'square', f: 1000, t, dur: 0.03, vol: 0.08, lp: 2500 }),
    pop: t => tone(sfxBus, { type: 'sine', f: 520, f2: 980, t, dur: 0.09, vol: 0.25 }),
    flip: t => noise(sfxBus, { t, dur: 0.12, vol: 0.16, hp: 1800 }),
    ok: (t, o) => { const k = o?.up || 0; [72, 79].forEach((m, i) => tone(sfxBus, { type: 'triangle', f: hz(m + k), t: t + i * 0.08, dur: 0.18, vol: 0.22 })); },
    combo: (t, o) => { const k = Math.min(12, (o?.n || 1) * 2); [72, 76, 79].forEach((m, i) => tone(sfxBus, { type: 'triangle', f: hz(m + k), t: t + i * 0.05, dur: 0.14, vol: 0.2 })); },
    bad: t => { tone(sfxBus, { type: 'square', f: 196, f2: 110, t, dur: 0.28, vol: 0.14, lp: 900 }); tone(sfxBus, { type: 'square', f: 185, f2: 104, t: t + 0.01, dur: 0.28, vol: 0.1, lp: 900 }); },
    coin: t => { tone(sfxBus, { type: 'square', f: hz(83), t, dur: 0.07, vol: 0.12, lp: 5000 }); tone(sfxBus, { type: 'square', f: hz(88), t: t + 0.07, dur: 0.25, vol: 0.12, lp: 5000 }); },
    hint: t => [84, 91].forEach((m, i) => tone(sfxBus, { type: 'sine', f: hz(m), t: t + i * 0.12, dur: 0.6, vol: 0.12 })),
    notify: t => [79, 84, 88].forEach((m, i) => tone(sfxBus, { type: 'sine', f: hz(m), t: t + i * 0.14, dur: 0.5, vol: 0.16 })),
    start: t => { noise(sfxBus, { t, dur: 0.35, vol: 0.08, bp: 1200, a: 0.25 }); [67, 74, 79].forEach((m, i) => tone(sfxBus, { type: 'triangle', f: hz(m), t: t + 0.18 + i * 0.07, dur: 0.3, vol: 0.18 })); },
    place: t => { tone(sfxBus, { type: 'sine', f: 180, f2: 70, t, dur: 0.18, vol: 0.35 }); noise(sfxBus, { t, dur: 0.05, vol: 0.12, hp: 2500 }); },
    tower: t => { noise(sfxBus, { t, dur: 0.6, vol: 0.35, lp: 700 }); tone(sfxBus, { type: 'sine', f: 90, f2: 40, t, dur: 0.6, vol: 0.4 }); },
    win: t => { [72, 76, 79, 84].forEach((m, i) => tone(sfxBus, { type: 'triangle', f: hz(m), t: t + i * 0.11, dur: 0.35, vol: 0.2 })); [88, 91].forEach((m, i) => tone(sfxBus, { type: 'sine', f: hz(m), t: t + 0.5 + i * 0.09, dur: 0.6, vol: 0.12 })); },
    lose: t => [67, 63, 60].forEach((m, i) => tone(sfxBus, { type: 'triangle', f: hz(m), t: t + i * 0.16, dur: 0.4, vol: 0.18, lp: 2200 })),
  };
  let lastFx = {};
  window.sfx = function (name, opts) {
    if (!S.sfx || !FX[name]) return;
    if (!ensure() || ctx.state !== 'running') { if (!unlocked) return; }
    const now = ctx.currentTime;
    if (lastFx[name] && now - lastFx[name] < 0.03) return;   // stejný zvuk 2× naráz = jen jednou
    lastFx[name] = now;
    try { FX[name](now + 0.01, opts); } catch (_) { /* bez zvuku */ }
  };

  // ── Hudba ─────────────────────────────────────────────────────
  // Krokový sekvencer (16 kroků na takt), plánuje se kousek dopředu.
  // Nálady: tempo, akordy (MIDI tóny), vzorce basy / arpeggia / bicích.
  const MOODS = {
    study: { bpm: 76, swing: 0.12, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
      pad: { type: 'triangle', lp: 900, vol: 0.05 }, bass: [0, 10], arp: [2, 6, 10, 14], arpOct: 12, arpType: 'sine', arpVol: 0.05,
      kick: [0, 10], snare: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.025, snareVol: 0.04 },
    quiz: { bpm: 108, prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      pad: { type: 'sawtooth', lp: 700, vol: 0.03 }, bass: [0, 4, 8, 12], arp: [0, 2, 4, 6, 8, 10, 12, 14], arpOct: 12, arpType: 'square', arpVol: 0.03, arpLp: 1800,
      kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatVol: 0.02, snareVol: 0.05 },
    millionaire: { bpm: 68, prog: [[45, 52, 57, 60], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]],
      pad: { type: 'sawtooth', lp: 500, vol: 0.05 }, bass: [0, 3, 6, 8, 11, 14], arp: [0, 8], arpOct: 24, arpType: 'sine', arpVol: 0.03,
      kick: [0, 8], snare: [], hat: [4, 12], hatVol: 0.03 },
    conquest: { bpm: 96, prog: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
      pad: { type: 'sawtooth', lp: 1100, vol: 0.045 }, bass: [0, 6, 8, 14], arp: [0, 4, 8, 12], arpOct: 12, arpType: 'triangle', arpVol: 0.05,
      kick: [0, 4, 8, 12], snare: [12, 14, 15], hat: [], snareVol: 0.06, kickVol: 0.3 },
    zombie: { bpm: 118, prog: [[45, 48, 52], [45, 48, 52], [41, 44, 48], [43, 46, 50]],
      pad: { type: 'sawtooth', lp: 420, vol: 0.05 }, bass: [0, 2, 4, 6, 8, 10, 12, 14], arp: [3, 11], arpOct: 24, arpType: 'square', arpVol: 0.02, arpLp: 1200,
      kick: [0, 8, 10], snare: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.02, snareVol: 0.05 },
  };
  let MOOD = null, timer = null, step = 0, nextT = 0, arpI = 0, variant = 0;
  function musicStart() {
    if (!S.music || !MOOD || !ensure() || timer) return;
    step = 0; nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 40);
  }
  function musicStop() { clearInterval(timer); timer = null; }
  function schedule() {
    const m = MOODS[MOOD];
    if (!m || !ctx) return;
    const sixteenth = 60 / m.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      const s = step % 16, bar = Math.floor(step / 16);
      const chord = m.prog[bar % m.prog.length];
      const t = nextT + (s % 2 && m.swing ? sixteenth * m.swing : 0);
      if (s === 0) {
        if (bar % 8 === 0) variant = Math.floor(Math.random() * 3);
        chord.forEach((n, i) => tone(musicBus, { type: m.pad.type, f: hz(n), t, dur: sixteenth * 16, a: 0.4, r: sixteenth * 15, vol: m.pad.vol, lp: m.pad.lp, detune: i % 2 ? 6 : -6 }));
      }
      if (m.bass.includes(s)) tone(musicBus, { type: 'triangle', f: hz(chord[0] - 12), t, dur: sixteenth * 1.8, vol: 0.16, lp: 600 });
      if (m.arp.includes(s) && !(variant === 2 && s % 4 === 2)) {
        const n = chord[(arpI++ + variant) % chord.length] + m.arpOct;
        tone(musicBus, { type: m.arpType, f: hz(n), t, dur: sixteenth * 2.5, vol: m.arpVol, lp: m.arpLp });
      }
      if (m.kick.includes(s)) tone(musicBus, { type: 'sine', f: 120, f2: 45, t, dur: 0.16, vol: m.kickVol || 0.22 });
      if (m.snare.includes(s)) noise(musicBus, { t, dur: 0.12, vol: m.snareVol || 0.05, bp: 1800 });
      if (m.hat.includes(s)) noise(musicBus, { t, dur: 0.03, vol: m.hatVol || 0.02, hp: 7000 });
      nextT += sixteenth;
      step++;
    }
  }
  window.soundMood = function (mood) {
    if (mood === MOOD) return;
    MOOD = MOODS[mood] ? mood : null;
    musicStop();
    if (MOOD && unlocked && S.music) musicStart();
  };

  // ── Ovládání: 🔊 v horní liště (na stránce bez lišty v rohu) ─────
  const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  let btn = null, pop = null;
  function mount() {
    if (document.getElementById('sndBtn')) return;
    const host = document.querySelector('.user-info, .room-nav-right, .fc-nav');
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'sndBtn';
    btn.className = 'icon-btn snd-btn' + (host ? '' : ' snd-float');
    btn.title = 'Zvuk a hudba'; btn.setAttribute('aria-label', 'Zvuk a hudba');
    if (!host) document.body.appendChild(btn);
    else if (host.classList.contains('fc-nav')) host.appendChild(btn); else host.prepend(btn);
    btn.addEventListener('click', e => { e.stopPropagation(); pop ? closePop() : openPop(); });
    paint();
  }
  function paint() { if (btn) { btn.innerHTML = S.music || S.sfx ? ICON_ON : ICON_OFF; btn.classList.toggle('off', !S.music && !S.sfx); } }
  function openPop() {
    pop = document.createElement('div');
    pop.className = 'snd-pop';
    pop.innerHTML = `<b>🔊 Zvuk</b>
      <label class="snd-row"><input type="checkbox" data-k="music" ${S.music ? 'checked' : ''}> Hudba</label>
      <input type="range" min="0" max="1" step="0.05" value="${S.musicVol}" data-v="musicVol" aria-label="Hlasitost hudby">
      <label class="snd-row"><input type="checkbox" data-k="sfx" ${S.sfx ? 'checked' : ''}> Zvukové efekty</label>
      <input type="range" min="0" max="1" step="0.05" value="${S.sfxVol}" data-v="sfxVol" aria-label="Hlasitost efektů">`
      + (window.SB_EXTRA_SETTINGS || []).map((o, i) => `<label class="snd-row"><input type="checkbox" data-x="${i}" ${o.get() ? 'checked' : ''}> ${o.label}</label>`).join('');
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
    if (r.width === 0) pop.classList.add('sheet');
    pop.addEventListener('click', e => e.stopPropagation());
    pop.addEventListener('input', e => {
      unlock();
      const k = e.target.dataset.k, v = e.target.dataset.v, x = e.target.dataset.x;
      if (x !== undefined) { window.SB_EXTRA_SETTINGS?.[+x]?.set(e.target.checked); return; }
      if (k) { S[k] = e.target.checked; if (k === 'music') { if (S.music) musicStart(); else musicStop(); } }
      if (v) { S[v] = +e.target.value; if (v === 'sfxVol') window.sfx('click'); }
      save(); applyVol(); paint();
    });
    setTimeout(() => document.addEventListener('click', closePop, { once: true }), 0);
  }
  function closePop() { pop?.remove(); pop = null; }
  window.soundOpenSettings = () => { if (!btn) mount(); openPop(); };
  window.soundState = () => ({ ctx: ctx?.state || 'none', mood: MOOD, music: !!timer, settings: { ...S } });   // pro ladění

  // Nálada podle stránky (stránka ji může změnit voláním soundMood).
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/^_/, '').replace(/\.html$/, '') || 'index';
  const PAGE_MOOD = { dashboard: 'study', room: 'study', flashcards: 'study', quiz: 'quiz', denni: 'quiz', spojovacka: 'quiz', pravdalez: 'quiz',
    sibenice: 'quiz', osmismerka: 'study', krizovka: 'study', pexeso: 'quiz', milionar: 'millionaire', dobyvatel: 'conquest', game: 'zombie' };
  MOOD = PAGE_MOOD[page] || null;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();

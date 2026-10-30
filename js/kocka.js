/* kocka.js — kočka z kočičího tématu (easter egg: hlasitost hudby i efektů 9 ze 100). Vykukuje u spodního okraje
 * a dělá to co uživatel: píše → ťuká do klávesnice, brouzdá → drží myš a sleduje kurzor očima, hraje (stránky her)
 * → sluchátka a ovladač, otevřený telefon (phone.js) → má taky telefon a ťuká do něj, nic nedělá → usne. Zobrazí se jen při data-theme="kocka" (sleduje změnu tématu). */
(function () {
  'use strict';
  const GAMES = /^(obrana|game|pexeso|dobyvatel|denni|spojovacka|pravdalez|osmismerka|krizovka|sibenice|milionar)$/;
  const page = (location.pathname.split('/').pop() || 'index').replace(/^_/, '').replace(/\.html$/, '');
  const gaming = GAMES.test(page);
  const CSS = `
  .sb-cat { position: fixed; right: 20px; bottom: 0; width: 132px; height: 88px; pointer-events: none; z-index: 40; }
  .sb-cat svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .sb-cat .prop { display: none; }
  .sb-cat.typing .kb, .sb-cat.browsing .ms, .sb-cat.gaming .hp, .sb-cat.gaming .pad, .sb-cat.sleep .zz { display: inline; }
  .sb-cat.gaming .kb, .sb-cat.gaming .ms { display: none; }
  /* telefon: drží ho oběma tlapkama, kouká do něj, obličej má nasvícený; při kliknutí ťukne pravou */
  .sb-cat.phone .tel { display: inline; }
  .sb-cat.phone .pl { transform: translate(10px, 5px) rotate(14deg); }
  .sb-cat.phone .pr { transform: translate(-13px, 5px) rotate(-14deg); }
  .sb-cat.phone.click .pr { transform: translate(-20px, -6px) rotate(-8deg); transition: transform .05s ease-in; }
  .sb-cat.phone .pupil { transform: translate(0, 1.5px); }
  .sb-cat .tel-app { animation: sbcTel 2.4s infinite steps(1); } .sb-cat .tel-app.b { animation-delay: .8s; } .sb-cat .tel-app.c { animation-delay: 1.6s; }
  @keyframes sbcTel { 0%, 33% { opacity: 1; } 34%, 100% { opacity: .35; } }
  .sb-cat.phone.click .tel-scr { fill: #fff; }
  .sb-cat .eye-open { transition: opacity .15s; }
  .sb-cat.sleep .eye-open { opacity: 0; } .sb-cat .eye-shut { opacity: 0; } .sb-cat.sleep .eye-shut { opacity: 1; }
  .sb-cat .pupil { transform: translate(var(--px, 0px), var(--py, 0px)); transition: transform .12s ease-out; }
  .sb-cat .blink { animation: sbcBlink 5s infinite; transform-origin: center 42px; transform-box: view-box; }
  @keyframes sbcBlink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
  /* Bongo Cat: při psaní/hraní má tlapky nahoře a při každém úhozu jednou praští dolů (hl/hr) – klávesa se promáčkne, odletí čárky */
  .sb-cat .pl, .sb-cat .pr, .sb-cat .ms { transition: transform .16s cubic-bezier(.3, 1.6, .5, 1); transform-box: fill-box; transform-origin: 50% 100%; }
  .sb-cat.typing .pl, .sb-cat.typing .pr, .sb-cat.gaming .pl, .sb-cat.gaming .pr { transform: translateY(-7px) rotate(var(--tilt, 0deg)); }
  .sb-cat.typing .pl, .sb-cat.gaming .pl { --tilt: -10deg; } .sb-cat.typing .pr, .sb-cat.gaming .pr { --tilt: 10deg; }
  .sb-cat.hl .pl, .sb-cat.hr .pr { transform: translateY(6px) !important; transition: transform .045s ease-in; }
  .sb-cat .fx { opacity: 0; transition: opacity .08s; } .sb-cat.hl .fx.l, .sb-cat.hr .fx.r { opacity: 1; transition: none; }
  .sb-cat.typing .pupil { transform: translate(0, 1.2px); }   /* při psaní kouká na klávesnici */
  .sb-cat .key, .sb-cat .btn, .sb-cat .stick { transition: transform .06s, fill .06s; transform-box: fill-box; transform-origin: center; }
  .sb-cat .key.on { fill: #f4a6c6; transform: translateY(.6px) scale(.9); }
  .sb-cat .btn.on { fill: #fff; transform: scale(.75); }
  .sb-cat .stick.on { transform: translate(var(--sx, 0px), var(--sy, 0px)); }
  /* brouzdání: tlapka leží na myši, obě jezdí podle kurzoru, klik = stisk tlačítka */
  .sb-cat.browsing .ms { transform: translate(var(--mx, 0px), var(--my, 0px)); transition: transform .12s ease-out; }
  .sb-cat.browsing .pr { transform: translate(var(--mx, 0px), calc(var(--my, 0px) + var(--mc, 0px) + 4px)); transition: transform .12s ease-out; }
  .sb-cat.click { --mc: 1.4px; } .sb-cat .mb { transition: fill .06s; } .sb-cat.click .mb { fill: #f4a6c6; }
  .sb-cat.sleep svg { animation: sbcBreath 3.2s infinite ease-in-out; transform-origin: 50% 100%; }
  @keyframes sbcBreath { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.02, 1.04); } }
  .sb-cat .zz text { animation: sbcZ 2.6s infinite linear; opacity: 0; } .sb-cat .zz text:nth-child(2) { animation-delay: .9s; } .sb-cat .zz text:nth-child(3) { animation-delay: 1.8s; }
  @keyframes sbcZ { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 20% { opacity: .9; } 100% { opacity: 0; transform: translate(12px, -20px) scale(1.2); } }
  .sb-cat .ear { animation: sbcEar 7s infinite; transform-box: view-box; } .sb-cat .ear.r { animation-delay: 3.5s; }
  @keyframes sbcEar { 0%, 94%, 100% { transform: rotate(0); } 96% { transform: rotate(-9deg); } }
  .sb-cat .ear.l { transform-origin: 43px 28px; } .sb-cat .ear.r { transform-origin: 85px 28px; }
  .sb-cat .ear.r { animation-name: sbcEarR; } @keyframes sbcEarR { 0%, 94%, 100% { transform: rotate(0); } 96% { transform: rotate(9deg); } }
  @media (max-width: 640px) { .sb-cat { width: 102px; height: 68px; right: 8px; } }
  @media (max-width: 640px) { .sb-cat.g { width: 84px; height: 56px; } }   /* ve hře na telefonu menší, ať nezakrývá plochu */`;
  // Minimalistická kočka ve stylu Bongo Cat: bílý obláček s tmavým obrysem vykukující zpoza hrany stolu, tečky oči,
  // pusinka ω, růžové tváře, tlapky s polštářky. Třídy (head, ear, blink, pupil, eye-open/-shut, kb/ms/hp/pad/zz,
  // pl/pr, fx, key/btn/stick/mb) ovládá CSS výše.
  const INK = '#241a2a', LINE = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const PAW = `<path d="M-6.4 60C-6.4 53.6-3.6 50 0 50S6.4 53.6 6.4 60C6.4 63 3.6 65 0 65S-6.4 63-6.4 60Z" fill="#fff" ${LINE}/>`
    + '<ellipse cx="0" cy="59.8" rx="2.4" ry="1.8" fill="#f4a6c6"/><circle cx="-3" cy="55.6" r="1" fill="#f4a6c6"/><circle cx="0" cy="54.2" r="1" fill="#f4a6c6"/><circle cx="3" cy="55.6" r="1" fill="#f4a6c6"/>';
  const FX = x => `<path d="M${x - 9} 67.4l-3.4-1.6M${x - 9.4} 71h-4M${x - 8} 74.4l-3 1.8M${x + 9} 67.4l3.4-1.6M${x + 9.4} 71h4M${x + 8} 74.4l3 1.8" stroke="#f43f5e" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
  const SVG = `<svg viewBox="0 0 120 80" aria-hidden="true">
    <g class="zz prop" fill="#ddd6fe" font-family="Georgia, serif" font-weight="700" opacity=".9"><text x="98" y="18" font-size="8">z</text><text x="98" y="18" font-size="8">z</text><text x="98" y="18" font-size="8">Z</text></g>
    <g class="head">
      <path class="ear l" d="M34.6 30.6 40 12.6 52.4 24.6" fill="#fff" ${LINE}/>
      <path class="ear r" d="M75.6 24 91 13.4 94.2 33" fill="#fff" ${LINE}/>
      <path d="M24 58.6C22 44 27 33 38 28C48 23.4 62 22 74 23.6C88 25.6 98 34 101 46C102 50 102 54 102 58.6" fill="#fff" ${LINE}/>
      <path class="ear l" d="M37.4 31.4 40.4 18.4 49.6 26.6Z" fill="#fff"/><path class="ear l" d="M40.6 21.4 41.6 27.4 46.4 26.2Z" fill="#fbd5e5"/>
      <path class="ear r" d="M78.4 26.4 90.2 18 91.8 32.6Z" fill="#fff"/><path class="ear r" d="M89.4 21 84 26.6 89.6 29Z" fill="#fbd5e5"/>
      <ellipse cx="44.6" cy="47.6" rx="3.6" ry="2" fill="#f9a8d4" opacity=".55"/><ellipse cx="80.6" cy="48.6" rx="3.6" ry="2" fill="#f9a8d4" opacity=".55"/>
      <g class="blink"><g class="eye-open"><g class="pupil"><circle cx="50" cy="42" r="2.4" fill="${INK}"/><circle cx="75" cy="43" r="2.4" fill="${INK}"/>
        <circle cx="50.8" cy="41.2" r=".7" fill="#fff"/><circle cx="75.8" cy="42.2" r=".7" fill="#fff"/></g></g></g>
      <g class="eye-shut" fill="none" ${LINE}><path d="M46.6 42.4q3.4 2.6 6.8 0M71.6 43.4q3.4 2.6 6.8 0"/></g>
      <path d="M57.6 46c.6 2.6 4.2 2.6 4.8 0c.6 2.6 4.2 2.6 4.8 0" fill="none" ${LINE} stroke-width="1.6"/>
      <g class="hp prop">
        <path d="M27.4 40C29 15 96 13 99.4 42" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M27.4 40C29 15 96 13 99.4 42" fill="none" stroke="#f4a6c6" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="20.6" y="35" width="10" height="15" rx="5" fill="#f4a6c6" ${LINE}/><rect x="95.4" y="37" width="10" height="15" rx="5" fill="#f4a6c6" ${LINE}/>
        <path d="M23.6 39v7M98.4 41v7" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
      </g>
    </g>
    <path d="M6 58.6H114" stroke="#e9e1ee" stroke-width="2" stroke-linecap="round"/>
    <g class="kb prop"><path d="M18 80 24 64.4H96L102 80Z" fill="#f3eef6" ${LINE}/>
      ${[0, 1].map(r => Array.from({ length: 9 }, (_, i) => { const y = 66.8 + r * 5.6, x0 = r ? 24.6 + i * 7.9 : 27 + i * 7.4, w = r ? 6.6 : 6; return `<rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="4" rx="1.2" fill="#fff" stroke="${INK}" stroke-width="1" class="key" data-k="${r}-${i}"/>`; }).join('')).join('')}
    </g>
    <g class="ms prop"><g transform="translate(5 0)"><path d="M84 62c4-5 14-6 22-1" fill="none" stroke="#e9e1ee" stroke-width="1.4" stroke-linecap="round"/><path d="M76.4 80V70c0-5.4 3.4-8.6 7.6-8.6s7.6 3.2 7.6 8.6v10" fill="#fff" ${LINE}/><path class="mb" d="M77.4 69.6c0-4.6 2.8-7.2 6.6-7.2v7.2Z" fill="#fff"/><path d="M84 62.4v7.2M77 69.6h14" fill="none" ${LINE} stroke-width="1.2"/></g></g>
    <g class="pad prop"><path d="M40 64h40c7 0 11 6 10.4 12c-.3 3.4-4.4 4.6-7 2.4L78.6 74H41.4l-4.8 4.4c-2.6 2.2-6.7 1-7-2.4C29 70 33 64 40 64Z" fill="#f3eef6" ${LINE}/>
      <g transform="translate(-7.6 0)"><g class="stick"><path d="M38.6 68.4h3.2v-3.2h3.2v3.2h3.2v3.2h-3.2v3.2h-3.2v-3.2h-3.2Z" fill="${INK}"/></g></g>
      <g transform="translate(7 0)"><circle class="btn" data-b="0" cx="81" cy="66.4" r="1.8" fill="#f472b6"/><circle class="btn" data-b="1" cx="84.6" cy="69.6" r="1.8" fill="#4ade80"/><circle class="btn" data-b="2" cx="77.4" cy="69.6" r="1.8" fill="#60a5fa"/><circle class="btn" data-b="3" cx="81" cy="72.8" r="1.8" fill="#facc15"/></g>
    </g>
    <g class="tel prop">
      <ellipse cx="62" cy="49" rx="17" ry="7" fill="#f9a8d4" opacity=".28"/>
      <rect x="49" y="53" width="26" height="30" rx="4" fill="#241a2a" ${LINE}/>
      <rect class="tel-scr" x="51.4" y="55.6" width="21.2" height="24" rx="2" fill="#f4a6c6"/>
      <rect x="58" y="56.8" width="8" height="1.8" rx=".9" fill="#241a2a"/>
      <rect class="tel-app" x="53.6" y="61" width="5" height="5" rx="1.4" fill="#6366f1"/><rect class="tel-app b" x="59.6" y="61" width="5" height="5" rx="1.4" fill="#fff"/><rect class="tel-app c" x="65.6" y="61" width="5" height="5" rx="1.4" fill="#10b981"/>
      <rect class="tel-app b" x="53.6" y="68" width="5" height="5" rx="1.4" fill="#ef4444"/><rect class="tel-app c" x="59.6" y="68" width="5" height="5" rx="1.4" fill="#f59e0b"/><rect class="tel-app" x="65.6" y="68" width="5" height="5" rx="1.4" fill="#fff"/>
    </g>
    <g class="fx l">${FX(35)}</g><g class="fx r">${FX(89)}</g>
    <g class="pl"><g transform="translate(35 0)">${PAW}</g></g>
    <g class="pr"><g transform="translate(89 0)">${PAW}</g></g>
  </svg>`;
  let el = null, lastType = 0, lastMove = 0, lastAct = Date.now(), timer = null;
  function mount() {
    if (el) return;
    if (!document.getElementById('sb-cat-css')) { const st = document.createElement('style'); st.id = 'sb-cat-css'; st.textContent = CSS; document.head.appendChild(st); }
    el = document.createElement('div'); el.className = 'sb-cat' + (gaming ? ' g' : ''); el.innerHTML = SVG;
    document.body.appendChild(el);
    timer = setInterval(update, 400); update();
  }
  // Kočka sedí u spodního okraje tam, kde nic není: nad lištou záložek (telefon), mimo ovládání zoomu, Pomodoro a plovoucí menu
  const AVOID = '#boardMinimap, .zoom-ctl, .pomo-float, .orb, .ai-job-notice';
  let placed = '';
  function place() {
    if (!el) return;
    const bar = document.querySelector('.dash-tabs'), vw = document.documentElement.clientWidth, W = el.offsetWidth, H = el.offsetHeight;
    const b = bar && getComputedStyle(bar).position === 'fixed' ? Math.round(bar.getBoundingClientRect().height) : 0, top = innerHeight - b - H;
    const boxes = [...document.querySelectorAll(AVOID)].map(n => n.getBoundingClientRect()).filter(r => r.width && r.bottom > top && r.top < innerHeight - b);
    // otevřené okno (rozmazává pozadí): když se vedle něj vejde, sedí kočka nad ním, jinak zůstane pod ním
    const modal = document.querySelector('.modal-overlay.open .modal')?.getBoundingClientRect();
    if (modal) boxes.length = 0;   // minimapa, Pomodoro… jsou pod rozmazaným pozadím – vadí jen samo okno
    if (modal && modal.bottom > top) boxes.push(modal);
    const m = vw < 640 ? 8 : 20, free = x => boxes.every(r => x + W <= r.left - 4 || x >= r.right + 4);
    let x = vw - m - W, found = false;
    for (let t = x; t >= m; t -= 8) if (free(t)) { x = t; found = true; break; }
    const over = !!modal && (found || modal.bottom <= top);
    const key = x + '/' + b + '/' + over;
    if (key === placed) return;
    placed = key; el.style.left = x + 'px'; el.style.right = 'auto'; el.style.bottom = b + 'px'; el.style.zIndex = over ? 520 : '';
  }
  addEventListener('resize', place, { passive: true });
  function unmount() { if (!el) return; el.remove(); el = null; placed = ''; clearInterval(timer); }
  function update() {
    if (!el) return;
    const now = Date.now(), typing = now - lastType < 1400, browsing = now - lastMove < 2500, idle = now - lastAct > 25000;
    const tel = !!document.querySelector('.ph-wrap.open');
    if (tel) lastAct = now;   // s telefonem v ruce neusne
    let st = tel ? 'phone' : idle ? 'sleep' : typing && !gaming ? 'typing' : gaming ? 'gaming' : browsing ? 'browsing' : '';
    place();
    // aby byla kočka vidět nad ztmavením telefonu; na úzkém displeji by zakrývala aplikace, tam zůstane pod ním
    if (tel && innerWidth >= 640) el.style.zIndex = '10001';
    else if (el.style.zIndex === '10001') { el.style.zIndex = ''; placed = ''; }
    el.className = 'sb-cat' + (gaming ? ' g' : '') + (st ? ' ' + st : '') + (now < hitL ? ' hl' : '') + (now < hitR ? ' hr' : '') + (now < clickT ? ' click' : '');
  }
  // Bongo Cat: klávesa z levé půlky klávesnice = levá tlapka, z pravé = pravá (ostatní střídavě); pod tlapkou se promáčkne klávesa
  const ROWS = ['qwertzuiopú1234567890', 'asdfghjklů§yxcvbnm,.-'], LEFT = /^[qwertasdfgyxcvb12345ěščřž\x60~<;+]$/i;
  const ARROWS = { ArrowLeft: [-1.4, 0], ArrowRight: [1.4, 0], ArrowUp: [0, -1.4], ArrowDown: [0, 1.4], a: [-1.4, 0], d: [1.4, 0], w: [0, -1.4], s: [0, 1.4] };
  let hitL = 0, hitR = 0, clickT = 0, alt = false, lastHit = 0;
  function flash(n, ms) { if (!n) return; n.classList.add('on'); clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('on'), ms); }
  function hit(key, forceRight) {
    if (!el) return;
    const now = Date.now(); lastHit = now;
    const k = (key || '').length === 1 ? key.toLowerCase() : key || '';
    let left;
    if (gaming) left = !forceRight && k in ARROWS;
    else if (k.length === 1 && /\S/.test(k)) left = LEFT.test(k);
    else left = alt = !alt;
    if (left) hitL = now + 90; else hitR = now + 90;
    if (gaming) {
      if (left) { const [sx, sy] = ARROWS[k]; const st = el.querySelector('.stick'); st.style.setProperty('--sx', sx + 'px'); st.style.setProperty('--sy', sy + 'px'); flash(st, 140); }
      else flash(el.querySelector(`.btn[data-b="${Math.floor(Math.random() * 4)}"]`), 120);
    } else {
      let r = ROWS.findIndex(row => row.includes(k)), i = r < 0 ? -1 : ROWS[r].indexOf(k) % 9;
      if (r < 0) { r = Math.random() < 0.5 ? 0 : 1; i = (left ? 0 : 5) + Math.floor(Math.random() * 4); }
      flash(el.querySelector(`.key[data-k="${r}-${i}"]`), 110);
    }
    update(); setTimeout(update, 100);
  }
  const isField = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  document.addEventListener('keydown', e => {
    lastAct = Date.now();
    if (document.querySelector('.ph-wrap.open')) { clickT = lastAct + 120; update(); setTimeout(update, 130); }   // ovládání telefonu klávesnicí = ťuknutí
    else if (isField(e.target) || gaming) { lastType = lastAct; if (!e.repeat && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) hit(e.key); }
    else if (el) update();
  }, true);
  const moved = e => {
    lastAct = lastMove = Date.now();
    if (!el || e.clientX == null) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.55, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1;
    el.style.setProperty('--px', (dx / d * 1.3).toFixed(2) + 'px'); el.style.setProperty('--py', (dy / d * 1).toFixed(2) + 'px');
    // myš pod tlapkou jezdí stejně jako kurzor po obrazovce
    el.style.setProperty('--mx', ((e.clientX / innerWidth - 0.5) * 7).toFixed(1) + 'px'); el.style.setProperty('--my', ((e.clientY / innerHeight - 0.5) * 3).toFixed(1) + 'px');
  };
  // virtuální klávesnice telefonu nemusí posílat použitelný keydown – úhoz se pak pozná podle změny textu
  document.addEventListener('input', e => { if (isField(e.target)) { lastAct = lastType = Date.now(); if (Date.now() - lastHit > 60) hit(e.data ? e.data.slice(-1) : ''); } }, true);
  document.addEventListener('pointermove', moved, { passive: true });
  document.addEventListener('pointerdown', e => {
    moved(e);
    if (gaming) { lastType = Date.now(); hit('', true); }   // klik ve hře = tlačítko na ovladači
    else if (!isField(e.target)) { clickT = Date.now() + 120; update(); setTimeout(update, 130); }
  }, { passive: true, capture: true });
  ['wheel', 'scroll', 'touchstart', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => { lastAct = lastMove = Date.now(); }, { passive: true, capture: true }));
  document.addEventListener('sb-phone', update);   // phone.js: telefon se otevřel nebo zavřel
  function sync() { (document.documentElement.getAttribute('data-theme') === 'kocka') ? mount() : unmount(); }
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.body) sync(); else document.addEventListener('DOMContentLoaded', sync);
})();

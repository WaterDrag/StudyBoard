// ═══ gfxpref.js — volba grafiky her (Zombie Survival, Obrana království), uložená na účtu
// users/{uid}.gfx = { zs: 'io' | 'gemini' | 'emoji', td: '2' | '1' | '0' }.
// Při prvním otevření hry se zeptá (SBGfx.ensure), pak si ji pamatuje; změnit jde v Nastavení
// na hlavní stránce. Hry samy čtou jen localStorage (zs_gfx/zs_tex, td_gfx) — sem se volba propíše.
(function () {
  'use strict';
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* nic */ } } };
  const GAMES = {
    zs: {
      name: 'Zombie Survival', icon: '🧟',
      opts: [['io', '.io styl', 'Ploché barvy, tlusté obrysy a nejvíc detailů (od Clauda)'],
             ['gemini', 'Detailní', 'Kresba od Gemini, víc stínů a odlesků'],
             ['emoji', 'Jednoduchá', 'Emoji místo kreseb — nejrychlejší i na slabém telefonu']],
      read: () => LS.get('zs_gfx') === '0' ? 'emoji' : LS.get('zs_tex') === '0' ? 'gemini' : 'io',
      apply: v => { LS.set('zs_gfx', v === 'emoji' ? '0' : '1'); LS.set('zs_tex', v === 'io' ? '1' : '0'); },
    },
    td: {
      name: 'Obrana království', icon: '🏰',
      opts: [['2', 'Super', 'Nejpropracovanější: postavičky, vylepšení vidět na první pohled, živá mapa (od Clauda)'],
             ['1', 'Detailní', 'Textury od Gemini: hodně detailů, stínů a odlesků'],
             ['0', 'Kreslená', 'Jednodušší ručně kreslený styl, dobře čitelný i na telefonu']],
      read: () => { const v = LS.get('td_gfx'); return v === '0' || v === '2' ? v : '1'; },
      apply: v => LS.set('td_gfx', v),
    },
  };
  const userDoc = uid => firebase.firestore().collection('users').doc(uid);
  async function load(uid) {
    try { const s = await userDoc(uid).get(); return (s.exists && s.data().gfx) || {}; } catch (_) { return null; }   // null = nevíme (offline)
  }
  async function save(uid, game, v) {
    GAMES[game].apply(v);
    try { await userDoc(uid).set({ gfx: { [game]: v } }, { merge: true }); } catch (_) { /* offline — localStorage stačí */ }
  }
  // Okno s výběrem (vlastní styl, funguje na každé stránce). previews = { volba: dataURL } (nepovinné)
  function ask(game, previews) {
    const G = GAMES[game], cur = G.read();
    if (!document.getElementById('sbgfx-css')) {
      const st = document.createElement('style'); st.id = 'sbgfx-css';
      st.textContent = `.sbgfx-ov{position:fixed;inset:0;z-index:10050;background:rgba(3,4,10,.82);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Geist,system-ui,sans-serif;color:#e5e7eb;overflow-y:auto}
        .sbgfx-box{background:#12141c;border:1px solid #2a2f3d;border-radius:16px;padding:20px;width:min(760px,100%);box-shadow:0 24px 70px rgba(0,0,0,.6)}
        .sbgfx-box h2{margin:0 0 4px;font-size:1.15rem}.sbgfx-box p{margin:0 0 14px;color:#94a3b8;font-size:.82rem}
        .sbgfx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
        .sbgfx-opt{background:#1a1d27;border:2px solid #2a2f3d;border-radius:12px;padding:10px;cursor:pointer;text-align:left;color:inherit;font:inherit;display:flex;flex-direction:column;gap:6px}
        .sbgfx-opt:hover{border-color:#6366f1}.sbgfx-opt.on{border-color:#818cf8;background:#1f2233}
        .sbgfx-opt img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:8px;background:#0b0d12}
        .sbgfx-opt b{font-size:.92rem}.sbgfx-opt small{color:#94a3b8;font-size:.74rem;line-height:1.35}
        .sbgfx-ico{display:flex;align-items:center;justify-content:center;aspect-ratio:16/10;border-radius:8px;background:#0b0d12;font-size:2.4rem}`;
      document.head.appendChild(st);
    }
    return new Promise(resolve => {
      const ov = document.createElement('div'); ov.className = 'sbgfx-ov';
      ov.innerHTML = `<div class="sbgfx-box" role="dialog" aria-modal="true"><h2>${G.icon} Jakou grafiku chceš ve hře ${G.name}?</h2>
        <p>Vybereš jednou a hra si to zapamatuje na tvém účtu. Změnit to můžeš kdykoli v ⚙️ Nastavení na hlavní stránce.</p>
        <div class="sbgfx-grid">${G.opts.map(([k, n, d]) => `<button type="button" class="sbgfx-opt${k === cur ? ' on' : ''}" data-v="${k}">
          ${previews && previews[k] ? `<img src="${previews[k]}" alt="Ukázka: ${n}">` : `<span class="sbgfx-ico">${G.icon}</span>`}<b>${n}</b><small>${d}</small></button>`).join('')}</div></div>`;
      ov.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; ov.remove(); window.sfx?.('click'); resolve(b.dataset.v); });
      document.body.appendChild(ov);
    });
  }
  // Při prvním otevření hry: když volba na účtu není, zeptat se. Vrátí zvolenou hodnotu.
  async function ensure(uid, game, previewsFn) {
    const g = await load(uid);
    if (g && g[game]) { GAMES[game].apply(g[game]); return g[game]; }
    if (g === null) return GAMES[game].read();   // offline: nechat, co je v prohlížeči, a nezdržovat
    let previews = null; try { previews = previewsFn ? previewsFn() : null; } catch (_) { previews = null; }
    const v = await ask(game, previews);
    await save(uid, game, v);
    return v;
  }
  window.SBGfx = { GAMES, load, save, ask, ensure, read: game => GAMES[game].read() };
})();

/* zombie-debug.js — testovací (debug) režim Zombie Survival.
 * Zapíná se ve hře klávesami Ctrl+Shift+D, jen ve hře pro jednoho (v co-opu by se svět hráčům rozešel).
 * Po zapnutí se hra nepočítá do bodů za hraní (recordPlayPoints) a nahoře svítí štítek DEBUG.
 * Panel: nesmrtelnost, nesmrtelná základna, bez cooldownů, bez hladu/žízně, mince, level, body dovedností,
 * celý strom, stavby, skok na vlnu, vyvolání zombie u kurzoru (i Krále hnízda a jeho fáze), zbraň, info.
 * Používá globální proměnné a funkce z game.js (gs, me, mouse, spawnZombie…) — sahá na ně až při použití,
 * takže nezáleží na pořadí načtení. */
(function () {
  'use strict';
  const D = { on: false, god: false, base: false, nocd: false, needs: false, panel: null, orig: {} };
  window.ZSDBG = D;

  const $ = id => document.getElementById(id);
  const toast = (t, c) => { try { gToast(t, c || '#22d3ee'); } catch (_) {} };

  function enable() {
    if (typeof gs === 'undefined' || gs.screen !== 'game') { toast('Debug jde zapnout až ve hře'); return; }
    if (gs.sessionId) { toast('🐞 Debug jde jen ve hře pro jednoho', '#f59e0b'); return; }
    if (!D.on) {
      D.on = true; gs.debugUsed = true;
      // hra s debugem se nepočítá do bodů za hraní
      D.orig.recordPlayPoints = window.recordPlayPoints;
      window.recordPlayPoints = function () {};
      D.orig.takeDmg = window.takeDmg;
      window.takeDmg = function (a, p) { if (D.god) return; return D.orig.takeDmg(a, p); };
      D.orig.getAbilCd = window.getAbilCd;
      window.getAbilCd = function (id) { return D.nocd ? 0 : D.orig.getAbilCd(id); };
      D.orig.gameOver = window.gameOver;
      window.gameOver = function (win) { if (D.base && !win) { gs.baseHp = gs.baseMaxHp; return; } return D.orig.gameOver(win); };
      const tag = document.createElement('span');
      tag.className = 'hud-chip'; tag.id = 'dbgTag'; tag.textContent = '🐞 DEBUG — nepočítá se';
      tag.style.cssText = 'color:#22d3ee;border-color:#22d3ee;';
      $('hudTL')?.appendChild(tag);
      setInterval(tick, 250);
      toast('🐞 Debug režim zapnutý — tahle hra se nepočítá do bodů');
    }
    togglePanel();
  }

  function tick() {
    if (!D.on || typeof gs === 'undefined') return;
    if (D.base) gs.baseHp = gs.baseMaxHp;
    if (D.god && me.alive) me.hp = me.maxHp;
    if (D.needs) { me.hunger = 100; me.thirst = 100; }
    const inf = $('dbgInfo');
    if (inf && D.panel && !D.panel.hidden) {
      let king = null; gs.zombies.forEach(z => { if (z.def && z.def.king) king = z; });
      inf.textContent = `Vlna ${gs.wave} · ${gs.phase === 'build' ? 'příprava ' + Math.ceil(gs.buildTimer) + ' s' : 'boj'} · zombie ${gs.zombies.size} · vyvoláno ${gs.spawnedCount}/${gs.waveTotal}` +
        ` · FPS ${D.fps || '–'} · kurzor ${Math.round(mouse.wx)}, ${Math.round(mouse.wy)}` + (king ? ` · král fáze ${king._kPh}${king._shield ? ' (štít)' : ''} ${Math.ceil(king.hp)}/${king.maxHp}` : '');
    }
  }
  // FPS z vykreslování
  let fc = 0, ft = performance.now();
  (function fpsLoop() { fc++; const n = performance.now(); if (n - ft >= 1000) { D.fps = fc; fc = 0; ft = n; } requestAnimationFrame(fpsLoop); })();

  function buildPanel() {
    const p = document.createElement('div');
    p.id = 'dbgPanel';
    const types = Object.keys(ZTYPES).map(t => `<option value="${t}">${ZTYPES[t].emoji} ${t}</option>`).join('');
    const weps = Object.keys(WEAPONS).map(w => `<option value="${w}">${WEAPONS[w].emoji} ${WEAPONS[w].name}</option>`).join('');
    p.innerHTML = `
      <div class="dbg-head"><b>🐞 Debug</b><span>Ctrl+Shift+D</span><button type="button" data-a="close" title="Skrýt panel">✕</button></div>
      <div class="dbg-sec">
        <label><input type="checkbox" data-t="god"> Nesmrtelnost</label>
        <label><input type="checkbox" data-t="base"> Nesmrtelná základna</label>
        <label><input type="checkbox" data-t="nocd"> Bez cooldownů</label>
        <label><input type="checkbox" data-t="needs"> Bez hladu a žízně</label>
      </div>
      <div class="dbg-sec dbg-btns">
        <button data-a="coins">+1000 💰</button><button data-a="level">+1 level</button><button data-a="sp">+5 SP</button>
        <button data-a="tree">Celý strom</button><button data-a="structs">+10 staveb</button><button data-a="heal">Plné HP</button>
      </div>
      <div class="dbg-sec">
        <div class="dbg-row">Vlna <input type="number" id="dbgWave" min="1" max="200" value="10"><button data-a="wave">Skočit</button></div>
        <div class="dbg-btns"><button data-a="startNow">Spustit vlnu hned</button><button data-a="endWave">Ukončit vlnu</button><button data-a="killAll">Zabít všechny</button></div>
      </div>
      <div class="dbg-sec">
        <div class="dbg-row"><select id="dbgType">${types}</select><input type="number" id="dbgCount" min="1" max="50" value="5"><button data-a="spawn">Vyvolat u kurzoru</button></div>
        <div class="dbg-btns"><button data-a="king">👑 Král u kurzoru</button><button data-a="kph2">Král → fáze 2</button><button data-a="kph3">Král → fáze 3</button></div>
      </div>
      <div class="dbg-sec"><div class="dbg-row">Zbraň <select id="dbgWep">${weps}</select><button data-a="wep">Vzít</button></div></div>
      <div class="dbg-info" id="dbgInfo"></div>`;
    document.body.appendChild(p);
    p.addEventListener('change', e => { const t = e.target.dataset.t; if (t) { D[t] = e.target.checked; toast(`🐞 ${e.target.parentElement.textContent.trim()}: ${e.target.checked ? 'zapnuto' : 'vypnuto'}`); } });
    p.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b) act(b.dataset.a); });
    p.addEventListener('keydown', e => e.stopPropagation());   // psaní do polí nesmí ovládat hru
    p.addEventListener('mousedown', e => e.stopPropagation());
    return p;
  }
  function togglePanel() {
    if (!D.panel) D.panel = buildPanel();
    else D.panel.hidden = !D.panel.hidden;
  }

  function spawnAt(type, n, x, y) {
    const made = [];
    for (let i = 0; i < n; i++) {
      spawnZombie(type); gs.spawnedCount--;   // nepočítá se do vlny
      const z = [...gs.zombies.values()].pop(), a = Math.random() * Math.PI * 2, d = n > 1 ? 20 + Math.random() * 50 : 0;
      z.x = x + Math.cos(a) * d; z.y = y + Math.sin(a) * d; z._sx = z.x; z._sy = z.y;
      made.push(z);
    }
    return made;
  }
  const findKing = () => { let k = null; gs.zombies.forEach(z => { if (z.def && z.def.king) k = z; }); return k; };

  function act(a) {
    if (!D.on) return;
    switch (a) {
      case 'close': D.panel.hidden = true; break;
      case 'coins': me.coins += 1000; break;
      case 'level': me.xp = me.xpNext; checkLevelUp(); break;
      case 'sp': me.sp += 5; break;
      case 'tree': {
        const T = SKILL_TREE[me.kit]; if (!T) break;
        me.level = Math.max(me.level, 10);
        ['A', 'B', 'C'].forEach(k => T[k].skills.forEach(sk => { if (!hasSkill(sk.id)) { me.sp++; buySkill(sk); } }));
        closeOv('skillTreeOv'); break;
      }
      case 'structs': [...Object.keys(STRUCT_DEFS), ...Object.keys(INFRA_DEFS)].forEach(t => { me.inv[t] = (me.inv[t] || 0) + 10; }); updateInvDisplay(); break;
      case 'heal': me.hp = me.maxHp; me.hunger = 100; me.thirst = 100; if (!me.alive) { me.alive = true; closeOv('deathOv'); } break;
      case 'wave': {
        const n = Math.max(1, Math.min(200, parseInt($('dbgWave').value) || 1));
        gs.zombies.clear(); gs.spits = []; gs.wave = n - 1; gs.phase = 'build'; gs.buildTimer = 0.1; gs.spawnedCount = 0; gs.waveTotal = 0;
        toast(`🐞 Skok na vlnu ${n}`); break;
      }
      case 'startNow': if (gs.phase === 'build') gs.buildTimer = 0.05; break;
      case 'endWave': gs.zombies.clear(); gs.spawnedCount = gs.waveTotal; gs.kingCount = 0; gs.bossCount = 0; break;
      case 'killAll': [...gs.zombies.entries()].forEach(([id, z]) => { if (gs.zombies.has(id)) killZombie(id, z, me); }); break;
      case 'spawn': {
        const t = $('dbgType').value, n = Math.max(1, Math.min(50, parseInt($('dbgCount').value) || 1));
        if (t === 'king') { act('king'); break; }
        spawnAt(t, n, mouse.wx, mouse.wy); break;
      }
      case 'king': {
        if (findKing()) { toast('🐞 Král už na mapě je', '#f59e0b'); break; }
        if (gs.phase === 'build') { gs.phase = 'wave'; gs.waveTotal = Math.max(gs.waveTotal, gs.spawnedCount); }
        const [k] = spawnAt('king', 1, mouse.wx, mouse.wy);
        k._kPh = 1; k._sumAt = performance.now() + 3000; k._skAt = performance.now() + 2000; k._tpAt = 0; k._orbDir = 1;
        break;
      }
      case 'kph2': { const k = findKing(); if (!k) { toast('🐞 Žádný král na mapě', '#f59e0b'); break; } if ((k._kPh || 1) === 1) k.hp = Math.round(k.maxHp * 0.6); break; }
      case 'kph3': {
        const k = findKing(); if (!k) { toast('🐞 Žádný král na mapě', '#f59e0b'); break; }
        gs.zombies.forEach((q, id) => { if (q._minion === k.id && q.def.totem) gs.zombies.delete(id); });
        k._kPh = 2; k._shield = false; k.hp = Math.round(k.maxHp * 0.3); break;
      }
      case 'wep': { const w = $('dbgWep').value; if (WEAPONS[w]) { me.weapon = w; toast(`🐞 Zbraň: ${WEAPONS[w].name}`); } break; }
    }
    try { updateHUD(); } catch (_) {}
  }

  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); enable(); }
  }, true);

  const css = document.createElement('style');
  css.textContent = `
#dbgPanel{position:fixed;top:56px;left:14px;z-index:60;width:330px;max-height:calc(100vh - 220px);overflow:auto;background:rgba(6,10,20,.95);border:1px solid #22d3ee;border-radius:12px;padding:8px 10px;color:#e2e8f0;font:12px 'Geist',system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.6);}
#dbgPanel[hidden]{display:none;}
.dbg-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.dbg-head b{color:#22d3ee;font-size:13px;}
.dbg-head span{flex:1;color:#64748b;font-size:11px;}
.dbg-head button{background:none;border:0;color:#94a3b8;cursor:pointer;font-size:14px;}
.dbg-sec{border-top:1px solid rgba(34,211,238,.2);padding:6px 0;display:flex;flex-direction:column;gap:5px;}
.dbg-sec label{display:flex;align-items:center;gap:6px;cursor:pointer;}
.dbg-btns{display:flex;flex-wrap:wrap;gap:5px;flex-direction:row;}
.dbg-row{display:flex;align-items:center;gap:5px;}
#dbgPanel button:not(.dbg-head button){background:#0f2a35;border:1px solid rgba(34,211,238,.45);color:#e2e8f0;border-radius:7px;padding:4px 8px;cursor:pointer;font:inherit;}
#dbgPanel button:hover{border-color:#22d3ee;}
#dbgPanel input[type=number]{width:58px;background:#0b1220;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:3px 5px;font:inherit;}
#dbgPanel select{flex:1;min-width:0;background:#0b1220;border:1px solid #334155;color:#e2e8f0;border-radius:6px;padding:3px 4px;font:inherit;}
.dbg-info{border-top:1px solid rgba(34,211,238,.2);padding-top:6px;color:#94a3b8;font-size:11px;line-height:1.5;}`;
  document.head.appendChild(css);
})();

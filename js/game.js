// ── Zbraně ────────────────────────────────────────────────────
// auto:true → fires while mouse is held (no need to click repeatedly)
// isRocket:true → explodes on impact/max range
const WEAPONS = {
  knife:        { name:'🔪 Nůž',         dmg:2,  range:72,  cooldown:350,  projSpeed:0,  pellets:1, spread:0,    pierce:false, bSize:0,  color:'#e5e7eb', cost:0,   prev:null,        unlocks:['pistol'],                    auto:false, isRocket:false, desc:'Melee – klikni v dosahu' },
  pistol:       { name:'🔫 Pistole',      dmg:3,  range:320, cooldown:580,  projSpeed:7,  pellets:1, spread:0,    pierce:false, bSize:6,  color:'#93c5fd', cost:50,  prev:'knife',     unlocks:['revolver','smg'],             auto:false, isRocket:false, desc:'1 kulka · střední tempo' },
  revolver:     { name:'🔫 Revolver',     dmg:7,  range:440, cooldown:920,  projSpeed:9,  pellets:1, spread:0,    pierce:false, bSize:9,  color:'#fcd34d', cost:110, prev:'pistol',    unlocks:['sniper','shotgun'],            auto:false, isRocket:false, desc:'Velké poškození · pomalý' },
  smg:          { name:'🔫 SMG',          dmg:1,  range:300, cooldown:75,   projSpeed:11, pellets:1, spread:0.06, pierce:false, bSize:4,  color:'#c4b5fd', cost:80,  prev:'pistol',    unlocks:['ar'],                        auto:true,  isRocket:false, desc:'Automatický · vysoké RPM · drž' },
  shotgun:      { name:'🔫 Brokovnice',   dmg:3,  range:240, cooldown:780,  projSpeed:6,  pellets:5, spread:0.4,  pierce:false, bSize:5,  color:'#fb923c', cost:160, prev:'revolver',  unlocks:[],                            auto:false, isRocket:false, desc:'5 broků – ničí na blízko' },
  sniper:       { name:'🎯 Sniper',       dmg:18, range:900, cooldown:1500, projSpeed:15, pellets:1, spread:0,    pierce:true,  bSize:14, color:'#f87171', cost:220, prev:'revolver',  unlocks:['rocket'],                    auto:false, isRocket:false, desc:'Prochází zombie · max dosah' },
  ar:           { name:'🔫 AR',           dmg:3,  range:480, cooldown:130,  projSpeed:10, pellets:1, spread:0.05, pierce:false, bSize:5,  color:'#86efac', cost:160, prev:'smg',       unlocks:['minigun','flamethrower'],    auto:true,  isRocket:false, desc:'Auto · rychlá palba · dobrý dosah' },
  minigun:      { name:'🔫 Minigun',      dmg:1,  range:350, cooldown:38,   projSpeed:13, pellets:1, spread:0.14, pierce:false, bSize:3,  color:'#fde68a', cost:300, prev:'ar',        unlocks:[],                            auto:true,  isRocket:false, desc:'Auto · extrémní RPM · drž' },
  flamethrower: { name:'🔥 Plamenomet',   dmg:3,  range:165, cooldown:55,   projSpeed:4,  pellets:3, spread:0.58, pierce:true,  bSize:8,  color:'#fb923c', cost:280, prev:'ar',        unlocks:[],                            auto:true,  isRocket:false, desc:'Auto · krátký dosah · průraz' },
  rocket:       { name:'🚀 Raketomet',    dmg:70, range:620, cooldown:2100, projSpeed:6,  pellets:1, spread:0,    pierce:false, bSize:14, color:'#f97316', cost:400, prev:'sniper',    unlocks:[],                            auto:false, isRocket:true,  desc:'Exploze při dopadu · obrovský dmg' },
  lmg:          { name:'🔫 LMG',          dmg:2,  range:420, cooldown:65,   projSpeed:12, pellets:1, spread:0.09, pierce:false, bSize:4,  color:'#a3e635', cost:350, prev:'minigun',   unlocks:[],                            auto:true,  isRocket:false, desc:'Auto · stabilní · velký zásobník' },
  grenadeLaunch:{ name:'💥 GL',           dmg:40, range:480, cooldown:1400, projSpeed:5,  pellets:1, spread:0,    pierce:false, bSize:12, color:'#84cc16', cost:320, prev:'shotgun',   unlocks:[],                            auto:false, isRocket:true,  desc:'Malá exploze · pomalé' },
};

// ── Zombie typy ───────────────────────────────────────────────
// behavior: 'base'=moves left + y-drift | 'mixed'=50/50 base+player | 'chase'=100% player | 'none'=stationary
const ZOMBIE_TYPES = {
  normal:  { emoji:'🧟‍♀️', hpMult:1,   speedMult:1.0,  font:28,  rewardMult:1,  css:'',              behavior:'base',  hasShieldArc:false, isBoss:false },
  speeder: { emoji:'🏃',   hpMult:0.7, speedMult:2.5,  font:22,  rewardMult:1,  css:'zombie-speeder', behavior:'mixed', hasShieldArc:false, isBoss:false },
  dog:     { emoji:'🐕',   hpMult:0.5, speedMult:2.9,  font:24,  rewardMult:1,  css:'zombie-dog',     behavior:'chase', hasShieldArc:false, isBoss:false },
  tank:    { emoji:'🧟‍♂️', hpMult:5,   speedMult:0.45, font:36,  rewardMult:3,  css:'zombie-tank',    behavior:'base',  hasShieldArc:true,  isBoss:false },
  boss:    { emoji:'👹',   hpMult:1,   speedMult:0,    font:160, rewardMult:15, css:'zombie-boss',    behavior:'none',      hasShieldArc:false, isBoss:true,  structDmgMult:1,  hitInterval:900 },
  brute:   { emoji:'🦍',  hpMult:3.5, speedMult:0.55, font:38,  rewardMult:4,  css:'zombie-brute',   behavior:'structure', hasShieldArc:false, isBoss:false, structDmgMult:5,  hitInterval:500 },
};

// ── Upgrady ───────────────────────────────────────────────────
const UPGRADES_UTIL = [
  { id:'heal',    icon:'❤️',  label:'Léčení',  desc:'+30 HP',                  cost:25,             max:99 },
  { id:'armor',   icon:'🛡️',  label:'Brnění',  desc:'−5 HP z útoku zombie',   costs:[65,110,175],  max:3  },
  { id:'grenades',icon:'💣',  label:'Granát',  desc:'Hoď na místo – rádius',  cost:90,             max:3  },
];
const GRENADE_RADIUS = 160;

// ── Stavby ────────────────────────────────────────────────────
// blocksZombie: zombie se musí probourat | blocksPlayer: hráč neprojde | spikesDmg: damage per tick
// isPlatform: hráč/turetka na plošině střílí přes zdi
const STRUCTURES = {
  wall:     { name:'🧱 Zeď',     shopCost:60,  hp:60,  w:20,  h:100, icon:'🧱',       css:'struct-wall',     blocksPlayer:true,  blocksZombie:true,  spikesDmg:0, isPlatform:false },
  door:     { name:'🚪 Dveře',   shopCost:40,  hp:25,  w:16,  h:80,  icon:'🚪',       css:'struct-door',     blocksPlayer:false, blocksZombie:true,  spikesDmg:0, isPlatform:false },
  turret:   { name:'⚙️ Turetka', shopCost:120, hp:50,  w:44,  h:44,  icon:'⚙️',       css:'struct-turret',   blocksPlayer:false, blocksZombie:false, spikesDmg:0, isPlatform:false },
  spikes:   { name:'Spiky',      shopCost:50,  hp:999, w:90,  h:18,  icon:'spike',    css:'struct-spikes',   blocksPlayer:false, blocksZombie:false, spikesDmg:3, isPlatform:false },
  platform: { name:'🪵 Plošina', shopCost:80,  hp:999, w:120, h:14,  icon:'',         css:'struct-platform', blocksPlayer:false, blocksZombie:false, spikesDmg:0, isPlatform:true  },
};

const params  = new URLSearchParams(window.location.search);
const DECK_ID = params.get('deck');
const ROOM_ID = params.get('room');

// ── Stav ──────────────────────────────────────────────────────
let ME=null, ALL_CARDS=[], questionQueue=[];
let hp, coins, wave, score;
let phase;
let zombieMap;
let spawnedCount, totalZombies, spawnTimer;
let upgrades;
let weapon, unlockedWeapons;
let projectiles, lastShot, lastHitByZombie;
let animId, player;
let wavePenalty=false, waveRewardMult=1, waveSpeedMult=1;
let isBossWave=false;
let bossSpawnInterval=null;
let grenadeThrowMode=false;
let structureInventory = {wall:0,door:0,turret:0,spikes:0,platform:0};
let placedStructures   = [];
let placementMode      = null; // null | structure type string
let previewEl          = null; // ghost preview while placing
let mouseHeld          = false;
let mousePos           = {x:200, y:200};
const keysDown = new Set();
const PLAYER_SPEED = 3.4;

document.addEventListener('keydown', e => {
  keysDown.add(e.code);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => keysDown.delete(e.code));

// ── Auth ──────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href='index.html'; return; }
  ME = user;
  if (!DECK_ID) { window.location.href='dashboard.html'; return; }
  loadDeck();
});

async function loadDeck() {
  try {
    const deckDoc = await db.collection('decks').doc(DECK_ID).get();
    if (!deckDoc.exists) { toast('Balíček nenalezen.'); window.history.back(); return; }
    const deck = deckDoc.data();
    const isOwner = deck.ownerUid === ME.uid;
    if (!isOwner && deck.roomId) {
      const r = await db.collection('rooms').doc(deck.roomId).get();
      if (!r.exists || !(r.data().memberIds||[]).includes(ME.uid)) { window.location.href='dashboard.html'; return; }
    } else if (!isOwner) { window.location.href='dashboard.html'; return; }

    const back = `flashcards.html?deck=${DECK_ID}${ROOM_ID?'&room='+ROOM_ID:''}`;
    document.getElementById('backBtn').href    = back;
    document.getElementById('goBackLink').href = back;
    document.getElementById('startDeckName').textContent = esc(deck.name);

    const snap = await db.collection('decks').doc(DECK_ID).collection('cards').orderBy('createdAt').get();
    ALL_CARDS = snap.docs.map(d => ({id:d.id,...d.data()}));
    if (ALL_CARDS.length < 2) {
      showScreen('startScreen');
      document.getElementById('startBtn').disabled = true;
      document.getElementById('startDeckName').textContent += ' – nutné alespoň 2 karty!';
      return;
    }
    initGame();
  } catch(e) { toast('Chyba: '+e.message); }
}

// ── Init ──────────────────────────────────────────────────────
function initGame() {
  hp=100; coins=0; wave=0; score=0;
  upgrades        = {armor:0, grenades:0};
  weapon          = 'knife';
  unlockedWeapons = new Set(['knife']);
  zombieMap       = new Map();
  projectiles     = [];
  lastShot=0; lastHitByZombie=0;
  phase           = 'start';
  questionQueue   = [];
  wavePenalty=false; waveRewardMult=1; waveSpeedMult=1;
  isBossWave=false; grenadeThrowMode=false; placementMode=null;
  mouseHeld=false; previewEl?.remove(); previewEl=null;
  structureInventory = {wall:0,door:0,turret:0,spikes:0,platform:0};
  placedStructures.forEach(s=>s.el?.remove()); placedStructures=[];
  clearInterval(bossSpawnInterval); bossSpawnInterval=null;
  cancelAnimationFrame(animId);
  clearTimeout(spawnTimer);
  document.querySelectorAll('.zombie,.float-text,.bullet,.grenade-projectile,.grenade-explosion,#grenadeBtn,.struct-place-bar,#player,#knifeRange').forEach(e=>e.remove());
  updateHUD();
  showScreen('startScreen');
  document.getElementById('startBtn').onclick    = () => startWave();
  document.getElementById('restartBtn').onclick  = () => initGame();
  document.getElementById('nextWaveBtn').onclick = () => startWave();
}

// ── Hráč ─────────────────────────────────────────────────────
function createPlayer() {
  document.getElementById('player')?.remove();
  const ga = document.getElementById('gameArea');
  const el = document.createElement('div');
  el.id='player'; el.className='player';
  el.innerHTML=`<div class="player-body">🧑</div><div class="player-weapon" id="playerWeaponIcon">🔪</div>`;
  ga.appendChild(el);
  player = {x:185, y:ga.clientHeight/2, el};
  syncPlayerPos();
}
function syncPlayerPos() {
  player.el.style.left=(player.x-20)+'px';
  player.el.style.top =(player.y-26)+'px';
}
function updatePlayer() {
  const ga = document.getElementById('gameArea');
  const oldX = player.x, oldY = player.y;
  if (keysDown.has('ArrowLeft') ||keysDown.has('KeyA')) player.x-=PLAYER_SPEED;
  if (keysDown.has('ArrowRight')||keysDown.has('KeyD')) player.x+=PLAYER_SPEED;
  if (keysDown.has('ArrowUp')   ||keysDown.has('KeyW')) player.y-=PLAYER_SPEED;
  if (keysDown.has('ArrowDown') ||keysDown.has('KeyS')) player.y+=PLAYER_SPEED;
  player.x = Math.max(40, Math.min(ga.clientWidth-40,  player.x));
  player.y = Math.max(40, Math.min(ga.clientHeight-40, player.y));
  // Wall collision – revert if overlapping a blocking structure
  const pr = () => ({x:player.x-16, y:player.y-22, w:32, h:44});
  for (const s of placedStructures) {
    if (!s.def.blocksPlayer || s.hp<=0) continue;
    if (!rectsOverlap(pr(), s)) continue;
    player.x = oldX;
    if (rectsOverlap(pr(), s)) player.y = oldY;
  }
  syncPlayerPos();
  const krc = document.getElementById('knifeRange');
  if (krc) { const r=WEAPONS.knife.range; krc.style.left=(player.x-r)+'px'; krc.style.top=(player.y-r)+'px'; }

  // Detect if standing on a platform
  const pr2 = {x:player.x-16, y:player.y-22, w:32, h:44};
  player.onPlatform = placedStructures.some(s => s.def.isPlatform && s.hp>0 && rectsOverlap(pr2, s));
  player.el.classList.toggle('player-elevated', !!player.onPlatform);
}

// ── Helpers ───────────────────────────────────────────────────
// z.x/z.y = top-left corner of element (same as style.left/top)
function zCx(z) { return z.x + z.fontSz*0.5; }
function zCy(z) { return z.y + z.fontSz*0.5 + 10; }
function rectsOverlap(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

// ── Vlna ──────────────────────────────────────────────────────
function startWave() {
  wave++;
  phase='wave';
  zombieMap=new Map();
  projectiles.forEach(p=>p.el.remove()); projectiles=[];
  spawnedCount=0; lastShot=0; lastHitByZombie=0;
  grenadeThrowMode=false; placementMode=null;
  mouseHeld=false; previewEl?.remove(); previewEl=null;
  document.getElementById('structPlaceBar')?.remove();
  document.getElementById('turretMenu')?.remove();
  clearInterval(bossSpawnInterval); bossSpawnInterval=null;

  isBossWave = wave%5===0;
  if (isBossWave) {
    totalZombies   = 1;
    waveSpeedMult  = 1; waveRewardMult = 1; wavePenalty = false;
  } else {
    const base     = Math.min(3+wave*2, 28);
    waveSpeedMult  = wavePenalty ? 1.35 : 1;
    waveRewardMult = wavePenalty ? 0.5  : 1;
    totalZombies   = wavePenalty ? Math.min(Math.round(base*1.5),36) : base;
    wavePenalty    = false;
  }

  hideAllOverlays();
  createPlayer();
  document.getElementById('knifeRange')?.remove();
  if (weapon==='knife') spawnKnifeCircle();
  updateHUD();

  if (isBossWave) {
    setTimeout(()=>spawnBoss(), 1200);
  } else {
    scheduleSpawn(0);
  }
  wireGameClick();
  animId = requestAnimationFrame(gameLoop);
}

function spawnKnifeCircle() {
  const r=WEAPONS.knife.range;
  const krc=document.createElement('div');
  krc.id='knifeRange'; krc.className='knife-range';
  krc.style.cssText=`width:${r*2}px;height:${r*2}px;left:${player.x-r}px;top:${player.y-r}px;`;
  document.getElementById('gameArea').appendChild(krc);
}

let _gameClickListener=null, _gameMoveListener=null, _gameDownListener=null, _gameUpListener=null;
function wireGameClick() {
  const ga=document.getElementById('gameArea');
  if (_gameClickListener) ga.removeEventListener('click',_gameClickListener);
  if (_gameMoveListener)  ga.removeEventListener('mousemove',_gameMoveListener);
  if (_gameDownListener)  ga.removeEventListener('mousedown',_gameDownListener);
  if (_gameUpListener)    ga.removeEventListener('mouseup',_gameUpListener);

  _gameClickListener = e => {
    if (phase!=='wave') return;
    if (e.target.closest('.goverlay')||e.target.id==='grenadeBtn') return;
    const rect=ga.getBoundingClientRect();
    const gx=e.clientX-rect.left, gy=e.clientY-rect.top;
    if (placementMode) {
      const t=placementMode; placementMode=null;
      previewEl?.remove(); previewEl=null;
      placeStructure(t, gx, gy);
      updateStructureBar(); return;
    }
    if (grenadeThrowMode) {
      grenadeThrowMode=false; updateHUD();
      throwGrenade(gx,gy); return;
    }
    // Click on a placed turret → open weapon menu
    const tEl = e.target.closest('.struct-turret');
    if (tEl) {
      const s = placedStructures.find(st=>st.el===tEl);
      if (s) { showTurretWeaponMenu(s); return; }
    }
    if (weapon==='knife') {
      const zombieEl = e.target.classList.contains('zombie') ? e.target : e.target.closest('.zombie');
      if (!zombieEl) return;
      for (const [id,z] of zombieMap) { if (z.el===zombieEl) { handleKnifeClick(id,z); return; } }
    } else {
      fireAtPos(gx,gy);
    }
  };

  _gameMoveListener = e => {
    const rect=ga.getBoundingClientRect();
    mousePos.x=e.clientX-rect.left; mousePos.y=e.clientY-rect.top;
    if (placementMode) updatePlacementPreview(mousePos.x, mousePos.y);
  };

  _gameDownListener = e => {
    if (phase!=='wave'||e.button!==0) return;
    if (e.target.closest('.goverlay,.struct-place-bar,#grenadeBtn')) return;
    if (placementMode||grenadeThrowMode) return;
    mouseHeld=true;
  };
  _gameUpListener = () => { mouseHeld=false; };

  ga.addEventListener('click',_gameClickListener);
  ga.addEventListener('mousemove',_gameMoveListener);
  ga.addEventListener('mousedown',_gameDownListener);
  ga.addEventListener('mouseup',_gameUpListener);
  // Release even if mouse leaves game area
  document.addEventListener('mouseup',()=>{ mouseHeld=false; }, {passive:true});
}

function updatePlacementPreview(gx, gy) {
  const ga=document.getElementById('gameArea');
  if (!placementMode||phase!=='wave') { previewEl?.remove(); previewEl=null; return; }
  const def=STRUCTURES[placementMode];
  if (!previewEl||previewEl.dataset.ptype!==placementMode) {
    previewEl?.remove();
    previewEl=document.createElement('div');
    previewEl.className=`structure ${def.css} struct-preview`;
    previewEl.dataset.ptype=placementMode;
    previewEl.innerHTML=def.icon?`<div class="struct-icon" style="font-size:0.9rem">${def.icon}</div>`:'';
    ga.appendChild(previewEl);
  }
  previewEl.style.cssText=`left:${gx-def.w/2}px;top:${gy-def.h/2}px;width:${def.w}px;height:${def.h}px;pointer-events:none;`;
}

function showTurretWeaponMenu(s) {
  document.getElementById('turretMenu')?.remove();
  const ga=document.getElementById('gameArea');
  const menu=document.createElement('div');
  menu.id='turretMenu'; menu.className='turret-menu';
  // Position above turret, clamped to visible area
  const menuW=160, menuH=240;
  const mx=Math.min(Math.max(menuW/2, s.x+s.w/2), ga.clientWidth-menuW/2);
  const my=Math.max(menuH+4, s.y-4);
  menu.style.cssText=`left:${mx}px;top:${my}px;`;

  const header=document.createElement('div');
  header.style.cssText='font-size:0.7rem;color:var(--text-muted);padding:2px 0 5px;text-align:center;border-bottom:1px solid var(--border);margin-bottom:4px;';
  header.textContent=s.turretWeapon ? `Zbraň: ${WEAPONS[s.turretWeapon].name}` : '⚠️ Bez zbraně';
  menu.appendChild(header);

  // Show every weapon except knife — buy without chain, just pay cost
  Object.entries(WEAPONS).forEach(([wid,w])=>{
    if (wid==='knife') return;
    const equipped=s.turretWeapon===wid;
    const canAfford=coins>=w.cost;
    const btn=document.createElement('button');
    btn.className='btn '+(equipped?'btn-primary':'btn-secondary')+' struct-place-btn';
    btn.style.cssText=`font-size:0.7rem;padding:3px 7px;${!canAfford&&!equipped?'opacity:0.45;':''}`;
    btn.disabled=!canAfford&&!equipped;
    btn.textContent=equipped ? `${w.name} ✓` : `${w.name}  🪙${w.cost}`;
    btn.addEventListener('click',e2=>{
      e2.stopPropagation();
      if (equipped) { menu.remove(); return; }
      if (!canAfford) return;
      coins-=w.cost;
      s.turretWeapon=wid;
      updateTurretIcon(s);
      updateHUD();
      menu.remove();
    });
    menu.appendChild(btn);
  });

  const sep=document.createElement('div'); sep.style.cssText='height:4px;';
  menu.appendChild(sep);
  const close=document.createElement('button');
  close.className='btn btn-secondary struct-place-btn';
  close.style.cssText='font-size:0.7rem;padding:3px 7px;width:100%;justify-content:center;';
  close.textContent='✕ Zavřít';
  close.addEventListener('click',e2=>{e2.stopPropagation();menu.remove();});
  menu.appendChild(close);
  ga.appendChild(menu);
}

function updateTurretIcon(s) {
  const iconEl=s.el.querySelector('.struct-icon');
  if (!iconEl) return;
  iconEl.textContent = s.turretWeapon ? WEAPONS[s.turretWeapon].name.split(' ')[0] : '🗼';
}

// ── Spawn zombie ──────────────────────────────────────────────
function pickZombieType() {
  const r=Math.random();
  if (wave>=7  && r<0.12) return 'brute';
  if (wave>=5  && r<0.22) return 'tank';
  if (wave>=4  && r<0.36) return 'dog';
  if (wave>=3  && r<0.52) return 'speeder';
  return 'normal';
}

function scheduleSpawn(i) {
  if (i>=totalZombies||phase!=='wave') return;
  spawnZombie(pickZombieType(), false);
  const delay=Math.max(250, 1050-wave*55);
  spawnTimer=setTimeout(()=>scheduleSpawn(i+1), delay);
}

function spawnZombie(tname, fromBoss, overrideX, overrideY) {
  const ga   = document.getElementById('gameArea');
  const type = ZOMBIE_TYPES[tname];
  const id   = 'z'+Date.now()+Math.random().toString(36).slice(2,6);
  const yPos = overrideY ?? (55+Math.random()*(ga.clientHeight-120));
  const xPos = overrideX ?? (ga.clientWidth+30);
  const baseSpd = Math.min(0.85+wave*0.1+Math.random()*0.15, 3.5);
  const speed   = baseSpd * type.speedMult * (fromBoss ? 1 : waveSpeedMult);

  // HP scales with wave number
  const baseHp = Math.max(1, Math.round(wave * 1.8));
  const maxHp  = Math.round(baseHp * type.hpMult);

  const el = document.createElement('div');
  el.className = `zombie ${type.css}`;

  const shieldHtml = type.hasShieldArc
    ? `<div class="tank-shield-wrap"><div class="tank-shield-arc"></div></div>` : '';

  el.innerHTML = `
    <div class="zombie-bars">
      <div class="zombie-hp-bar"><div class="zombie-hp-fill"></div></div>
    </div>
    <div class="zombie-body" style="font-size:${type.font}px">${type.emoji}</div>
    ${shieldHtml}`;
  el.style.cssText = `left:${xPos}px;top:${yPos}px;width:${type.font}px;`;
  ga.appendChild(el);

  const z = {
    el, x:xPos, y:yPos, fontSz:type.font, speed,
    hp:maxHp, maxHp,
    tname, rewardMult: fromBoss ? 0 : type.rewardMult,
    giveCoins: !fromBoss, fromBoss,
    behavior: type.behavior, isBoss: type.isBoss||false,
    hasShieldArc: type.hasShieldArc,
    shieldAngle: Math.PI,
    shieldWrap: type.hasShieldArc ? el.querySelector('.tank-shield-wrap') : null,
    structDmgMult: type.structDmgMult || 1,
    hitInterval: type.hitInterval || 900,
  };
  zombieMap.set(id, z);
  updateZombieBars(z);
  if (!fromBoss) spawnedCount++;
  return id;
}

// ── Boss ──────────────────────────────────────────────────────
function spawnBoss() {
  if (phase!=='wave') return;
  const ga   = document.getElementById('gameArea');
  const type = ZOMBIE_TYPES.boss;
  const bossHp = wave * 90;
  const bx = ga.clientWidth  - type.font * 1.1;
  const by = ga.clientHeight / 2 - type.font * 0.6;
  const id = 'boss_'+Date.now();

  const el = document.createElement('div');
  el.className = `zombie ${type.css}`;
  el.innerHTML = `
    <div class="zombie-bars boss-bars">
      <div class="zombie-hp-bar"><div class="zombie-hp-fill"></div></div>
    </div>
    <div class="zombie-body" style="font-size:${type.font}px;line-height:1;">${type.emoji}</div>`;
  el.style.cssText = `left:${bx}px;top:${by}px;`;
  ga.appendChild(el);

  const z = {
    el, x:bx, y:by, fontSz:type.font, speed:0,
    hp:bossHp, maxHp:bossHp,
    tname:'boss', rewardMult:type.rewardMult,
    giveCoins:true, fromBoss:false,
    behavior:'none', isBoss:true, hasShieldArc:false,
    shieldAngle:Math.PI, shieldWrap:null,
  };
  zombieMap.set(id, z);
  updateZombieBars(z);
  spawnedCount = 1;
  startBossMinions(id);
}

function startBossMinions(bossId) {
  clearInterval(bossSpawnInterval);
  const spawnMiniWave = () => {
    if (phase!=='wave'||!zombieMap.has(bossId)) { clearInterval(bossSpawnInterval); return; }
    const bossZ = zombieMap.get(bossId);
    const ga    = document.getElementById('gameArea');
    const count = 3 + Math.floor(wave/4);
    const tpool = ['normal','speeder','dog','normal'];
    for (let i=0; i<count; i++) {
      setTimeout(()=>{
        if (phase!=='wave'||!zombieMap.has(bossId)) return;
        const tname = tpool[Math.floor(Math.random()*tpool.length)];
        // Spawn from right edge at random Y, like a normal wave
        const sy = 60 + Math.random()*(ga.clientHeight-140);
        spawnZombie(tname, true, ga.clientWidth+20, sy);
      }, i*600);
    }
    floatText(document.getElementById('gameArea'), bossZ.x+bossZ.fontSz*0.5, bossZ.y-20, '📢 Přivolávám!', '#f97316');
  };
  // First mini-wave after 3 seconds, then every 15 seconds
  setTimeout(()=>spawnMiniWave(), 3000);
  bossSpawnInterval = setInterval(spawnMiniWave, 15000);
}

// ── Game loop ─────────────────────────────────────────────────
function gameLoop(ts) {
  if (phase!=='wave') return;
  const ga  = document.getElementById('gameArea');
  const gaW = ga.clientWidth, gaH = ga.clientHeight;
  updatePlayer();

  for (const [id,z] of zombieMap) {
    moveZombie(z, gaW, gaH);

    // Tank arc shield: slowly rotate toward player
    if (z.hasShieldArc && z.shieldWrap) {
      const tgt = Math.atan2(player.y - zCy(z), player.x - zCx(z));
      let diff = tgt - z.shieldAngle;
      while (diff >  Math.PI) diff -= 2*Math.PI;
      while (diff < -Math.PI) diff += 2*Math.PI;
      z.shieldAngle += diff * 0.010;
      // Arc naturally faces up at 0°; add π/2 offset so it faces in shieldAngle direction
      const deg = (z.shieldAngle + Math.PI/2) * 180 / Math.PI;
      z.shieldWrap.style.transform = `rotate(${deg}deg)`;
    }

    z.el.style.left = z.x + 'px';
    z.el.style.top  = z.y + 'px';

    // Base hit
    if (!z.isBoss && zCx(z) < 82) {
      const dmg = Math.max(1, 15 - upgrades.armor*5);
      hp = Math.max(0, hp-dmg);
      floatText(ga, 92, zCy(z), `-${dmg}❤️`, '#ef4444');
      z.el.remove(); zombieMap.delete(id);
      updateHUD();
      if (hp<=0) { gameOver(); return; }
      checkWaveEnd(); if (phase!=='wave') return;
      continue;
    }

    // Player proximity damage
    if (Math.hypot(zCx(z)-player.x, zCy(z)-player.y) < 52 && ts-lastHitByZombie > 850) {
      lastHitByZombie = ts;
      hp = Math.max(0, hp-5);
      floatText(ga, player.x, player.y-32, '-5❤️', '#ef4444');
      updateHUD();
      if (hp<=0) { gameOver(); return; }
    }
  }

  // Auto-fire while holding mouse button (cap projectiles to avoid chaos)
  if (mouseHeld && weapon!=='knife' && WEAPONS[weapon].auto && projectiles.length < 60) {
    fireAtPos(mousePos.x, mousePos.y);
  }

  updateProjectiles();
  processStructures();
  animId = requestAnimationFrame(gameLoop);
}

function moveZombie(z, gaW, gaH) {
  if (z.behavior==='none') return;
  const clampY = y => Math.max(0, Math.min(gaH - z.fontSz - 20, y));

  if (z.behavior==='base') {
    z.x -= z.speed;
    const dy = player.y - zCy(z);
    z.y = clampY(z.y + Math.sign(dy) * Math.min(z.speed*0.28, Math.abs(dy)));
  } else if (z.behavior==='chase') {
    const a = Math.atan2(player.y - zCy(z), player.x - zCx(z));
    z.x += Math.cos(a) * z.speed;
    z.y  = clampY(z.y + Math.sin(a) * z.speed);
    // Chase zombies can wander wide — keep within extended bounds
    z.x  = Math.max(-80, Math.min(gaW+80, z.x));
  } else if (z.behavior==='mixed') {
    const pa = Math.atan2(player.y - zCy(z), player.x - zCx(z));
    const mx = -1*0.55 + Math.cos(pa)*0.45;
    const my =  0*0.55 + Math.sin(pa)*0.45;
    const ml = Math.hypot(mx, my) || 1;
    z.x += (mx/ml) * z.speed;
    z.y  = clampY(z.y + (my/ml) * z.speed);
  } else if (z.behavior==='structure') {
    // Find nearest blocking structure; if none fall back to base movement
    let nearStruct=null, nearDist=Infinity;
    for (const s of placedStructures) {
      if (!s.def.blocksZombie||s.hp<=0) continue;
      const d=Math.hypot(s.x+s.w/2-zCx(z), s.y+s.h/2-zCy(z));
      if (d<nearDist) { nearStruct=s; nearDist=d; }
    }
    if (nearStruct) {
      const a=Math.atan2(nearStruct.y+nearStruct.h/2-zCy(z), nearStruct.x+nearStruct.w/2-zCx(z));
      z.x+=Math.cos(a)*z.speed; z.y=clampY(z.y+Math.sin(a)*z.speed);
    } else {
      z.x-=z.speed;
      const dy=player.y-zCy(z);
      z.y=clampY(z.y+Math.sign(dy)*Math.min(z.speed*0.28,Math.abs(dy)));
    }
  }
}

function checkWaveEnd() {
  if (phase!=='wave') return;
  if (spawnedCount >= totalZombies && zombieMap.size === 0) waveComplete();
}

// ── Nůž ───────────────────────────────────────────────────────
function handleKnifeClick(id, z) {
  const now = performance.now();
  if (now - lastShot < WEAPONS.knife.cooldown) return;
  if (Math.hypot(zCx(z)-player.x, zCy(z)-player.y) <= WEAPONS.knife.range) {
    lastShot = now;
    floatText(document.getElementById('gameArea'), zCx(z), z.y-6, '⚔️', '#e5e7eb');
    dealDamage(id, z, WEAPONS.knife.dmg);
  } else {
    floatText(document.getElementById('gameArea'), player.x, player.y-36, '⚔️ příliš daleko!', '#9ca3af');
  }
}

// ── Střelba ───────────────────────────────────────────────────
function fireAtPos(gx, gy) {
  const now = performance.now();
  const w   = WEAPONS[weapon];
  if (now - lastShot < w.cooldown) return;
  lastShot = now;
  const baseAngle = Math.atan2(gy-player.y, gx-player.x);
  const ga = document.getElementById('gameArea');
  for (let i=0; i<w.pellets; i++) {
    const angle = baseAngle + (w.spread>0 ? (Math.random()-0.5)*w.spread*2 : 0);
    const el    = document.createElement('div');
    const extraCls = weapon==='sniper'?' bullet-sniper':weapon==='rocket'?' bullet-rocket':weapon==='flamethrower'?' bullet-flame':'';
    el.className = 'bullet'+extraCls;
    el.style.cssText = `left:${player.x}px;top:${player.y}px;background:${w.color};width:${w.bSize}px;height:${w.bSize}px;`;
    ga.appendChild(el);
    projectiles.push({
      el, x:player.x, y:player.y,
      vx:Math.cos(angle)*w.projSpeed, vy:Math.sin(angle)*w.projSpeed,
      dmg:w.dmg, pierce:!!w.pierce, maxDist:w.range, distTraveled:0, hitIds:new Set(),
      elevated:!!player.onPlatform, isRocket:!!w.isRocket,
    });
  }
}

// ── Projektily ────────────────────────────────────────────────
function updateProjectiles() {
  const ga = document.getElementById('gameArea');
  const W  = ga.clientWidth, H = ga.clientHeight;
  for (let i=projectiles.length-1; i>=0; i--) {
    const p = projectiles[i];
    p.x += p.vx; p.y += p.vy;
    p.distTraveled += Math.hypot(p.vx, p.vy);
    p.el.style.left = p.x+'px'; p.el.style.top = p.y+'px';
    if (p.x<0||p.x>W||p.y<0||p.y>H||p.distTraveled>p.maxDist) {
      if (p.isRocket) rocketExplode(p.x, p.y);
      p.el.remove(); projectiles.splice(i,1); continue;
    }

    // Non-elevated bullets are blocked by walls/doors
    let removed = false;
    if (!p.elevated) {
      for (const s of placedStructures) {
        if (!s.def.blocksZombie||s.hp<=0) continue;
        if (p.x>=s.x&&p.x<=s.x+s.w&&p.y>=s.y&&p.y<=s.y+s.h) {
          if (p.isRocket) rocketExplode(p.x, p.y);
          p.el.remove(); projectiles.splice(i,1); removed=true; break;
        }
      }
    }
    if (removed) continue;

    for (const [id,z] of zombieMap) {
      if (p.hitIds.has(id)) continue;
      if (Math.hypot(zCx(z)-p.x, zCy(z)-p.y) < 28) {
        if (p.isRocket) {
          rocketExplode(p.x, p.y);
          p.el.remove(); projectiles.splice(i,1); removed=true; break;
        } else if (p.pierce) { p.hitIds.add(id); dealDamage(id,z,p.dmg); }
        else { p.el.remove(); projectiles.splice(i,1); dealDamage(id,z,p.dmg); removed=true; break; }
      }
    }
  }
}

function rocketExplode(x, y) {
  const ga=document.getElementById('gameArea');
  const R=110;
  const exp=document.createElement('div');
  exp.className='grenade-explosion';
  exp.style.cssText=`left:${x}px;top:${y}px;width:${R*2}px;height:${R*2}px;`;
  ga.appendChild(exp);
  setTimeout(()=>exp.remove(),600);
  floatText(ga,x,y-30,'💥',  '#f97316');
  for (const [id,z] of [...zombieMap.entries()]) {
    if (Math.hypot(zCx(z)-x,zCy(z)-y)<=R) {
      const dmg=z.isBoss?Math.floor(z.maxHp*0.25):9999;
      dealDamage(id,z,dmg);
    }
  }
}

// ── Poškození ─────────────────────────────────────────────────
function dealDamage(id, z, dmg) {
  const ga = document.getElementById('gameArea');

  // Tank arc shield blocks frontal attacks
  if (z.hasShieldArc) {
    const atkAngle = Math.atan2(player.y - zCy(z), player.x - zCx(z));
    let diff = atkAngle - z.shieldAngle;
    while (diff >  Math.PI) diff -= 2*Math.PI;
    while (diff < -Math.PI) diff += 2*Math.PI;
    if (Math.abs(diff) < Math.PI/2) {
      z.el.classList.add('zombie-shield-hit');
      setTimeout(()=>z.el?.classList.remove('zombie-shield-hit'), 150);
      floatText(ga, zCx(z), z.y-16, '🛡️', '#60a5fa');
      return;
    }
  }

  z.hp -= dmg;
  updateZombieBars(z);

  if (z.hp <= 0) {
    // Boss death: clear all minions first, then check wave end
    if (z.isBoss) {
      clearInterval(bossSpawnInterval); bossSpawnInterval=null;
      for (const [mid,mz] of [...zombieMap.entries()]) {
        if (mz.fromBoss) {
          mz.el.style.transition='opacity .35s,transform .35s';
          mz.el.style.opacity='0'; mz.el.style.transform='scale(0.3)';
          setTimeout(()=>mz.el.remove(), 350);
          zombieMap.delete(mid);
        }
      }
    }

    if (z.giveCoins) {
      const reward = Math.round((4+wave*2) * z.rewardMult * waveRewardMult);
      coins += reward; score += 10+wave*3;
      floatText(ga, zCx(z), z.y-8, `+${reward}🪙`, '#fbbf24');
    }
    z.el.style.transition = 'transform .15s,opacity .15s';
    z.el.style.transform  = 'scale(1.6) rotate(25deg)';
    z.el.style.opacity    = '0';
    setTimeout(()=>z.el.remove(), 160);
    zombieMap.delete(id);
    updateHUD();
    checkWaveEnd();
  } else {
    z.el.classList.add('zombie-hit');
    setTimeout(()=>z.el?.classList.remove('zombie-hit'), 160);
  }
}

function updateZombieBars(z) {
  const hpFill = z.el.querySelector('.zombie-hp-fill');
  if (hpFill) {
    const pct = Math.max(0, z.hp/z.maxHp*100);
    hpFill.style.width      = pct+'%';
    hpFill.style.background = pct>60 ? '#22c55e' : pct>30 ? '#f59e0b' : '#ef4444';
  }
}

// ── Granát (hod na místo) ─────────────────────────────────────
function throwGrenade(tx, ty) {
  if (upgrades.grenades<=0 || phase!=='wave') return;
  upgrades.grenades--;
  updateHUD();
  const ga  = document.getElementById('gameArea');
  const gEl = document.createElement('div');
  gEl.className = 'grenade-projectile'; gEl.textContent = '💣';
  gEl.style.cssText = `left:${player.x}px;top:${player.y}px;`;
  ga.appendChild(gEl);
  const dx=tx-player.x, dy=ty-player.y;
  const STEPS=20; let step=0;
  const iv = setInterval(()=>{
    step++;
    gEl.style.left = (player.x + dx*step/STEPS)+'px';
    gEl.style.top  = (player.y + dy*step/STEPS)+'px';
    gEl.style.transform = `rotate(${step*18}deg) scale(${0.8+step*0.04})`;
    if (step>=STEPS) { clearInterval(iv); gEl.remove(); explodeGrenade(tx,ty); }
  }, 22);
}

function explodeGrenade(x, y) {
  const ga = document.getElementById('gameArea');
  const exp = document.createElement('div');
  exp.className = 'grenade-explosion';
  exp.style.cssText = `left:${x}px;top:${y}px;width:${GRENADE_RADIUS*2}px;height:${GRENADE_RADIUS*2}px;`;
  ga.appendChild(exp);
  setTimeout(()=>exp.remove(), 600);
  floatText(ga, x, y-36, '💥 BOOM!', '#f97316');
  for (const [id,z] of [...zombieMap.entries()]) {
    if (Math.hypot(zCx(z)-x, zCy(z)-y) <= GRENADE_RADIUS) {
      const dmg = z.isBoss ? Math.floor(z.maxHp * 0.25) : 9999;
      dealDamage(id, z, dmg);
    }
  }
  updateHUD();
}

// ── Stavby ────────────────────────────────────────────────────
function placeStructure(type, gx, gy) {
  const def = STRUCTURES[type];
  const ga  = document.getElementById('gameArea');
  const id  = 'st_'+Date.now()+Math.random().toString(36).slice(2,5);

  const el = document.createElement('div');
  el.className = `structure ${def.css}`;
  el.style.cssText = `left:${gx - def.w/2}px;top:${gy - def.h/2}px;width:${def.w}px;height:${def.h}px;`;

  const showIcon  = type!=='spikes' && type!=='platform';
  const showHpBar = type!=='spikes' && type!=='platform';
  if (showIcon || showHpBar) {
    el.innerHTML = `
      ${showIcon?`<div class="struct-icon">${type==='turret'?'🗼':def.icon}</div>`:''}
      ${showHpBar?`<div class="struct-hp-bar"><div class="struct-hp-fill" style="width:100%"></div></div>`:''}`;
  }
  if (type==='turret') { el.style.pointerEvents='auto'; el.style.cursor='pointer'; }

  ga.appendChild(el);
  const s = {
    id, type, def,
    x: gx - def.w/2, y: gy - def.h/2, w: def.w, h: def.h,
    hp: def.hp, maxHp: def.hp,
    el, lastShot: 0,
    turretWeapon: null,
    zombieHitMap: new Map(),
  };
  placedStructures.push(s);

  // Deduct from inventory
  structureInventory[type] = Math.max(0, structureInventory[type]-1);
}

function processStructures() {
  const ga  = document.getElementById('gameArea');
  const now = performance.now();

  for (const s of placedStructures) {
    if (s.hp <= 0) continue;

    // ── Per-zombie interaction ──
    for (const [zid, z] of zombieMap) {
      const zr = {x: z.x, y: z.y, w: z.fontSz*0.8, h: z.fontSz+8};
      const overlapping = rectsOverlap(zr, s);
      if (!overlapping) continue;

      if (s.def.blocksZombie) {
        // Push zombie to right edge of structure
        z.x = s.x + s.w + 2;
        z.el.style.left = z.x+'px';
        // Zombie attacks structure
        const last = s.zombieHitMap.get(zid) || 0;
        if (now - last > (z.hitInterval||900)) {
          s.zombieHitMap.set(zid, now);
          damageStructure(s, Math.round((2+Math.floor(wave/3))*(z.structDmgMult||1)));
          if (s.hp <= 0) break;
        }
      }

      if (s.def.spikesDmg > 0 && !z.isBoss) {
        if (!z.lastSpikeDmg || now - z.lastSpikeDmg > 650) {
          z.lastSpikeDmg = now;
          dealDamage(zid, z, s.def.spikesDmg);
        }
      }
    }

    // ── Turret auto-fire ──
    if (s.type === 'turret' && s.turretWeapon && s.turretWeapon !== 'knife') {
      const w = WEAPONS[s.turretWeapon];
      // Turrets fire at 2× cooldown to avoid screen-filling bullet storms
      if (now - s.lastShot >= w.cooldown * 2) {
        const onPlatform = placedStructures.some(p2 => p2.def.isPlatform && p2.hp>0 && rectsOverlap({x:s.x,y:s.y,w:s.w,h:s.h}, p2));
        let nearest = null, nearestDist = Infinity;
        const tcx = s.x + s.w/2, tcy = s.y + s.h/2;
        for (const [, z] of zombieMap) {
          const d = Math.hypot(zCx(z)-tcx, zCy(z)-tcy);
          if (d < w.range && d < nearestDist) { nearest = z; nearestDist = d; }
        }
        if (nearest) {
          s.lastShot = now;
          fireTurretProjectile(s, nearest, w, onPlatform);
        }
      }
    }
  }

  // Remove dead structures (hp<=0 handled in damageStructure, just prune list)
  placedStructures = placedStructures.filter(s => s.hp > 0);
}

function damageStructure(s, dmg) {
  s.hp = Math.max(0, s.hp - dmg);
  const fill = s.el.querySelector('.struct-hp-fill');
  if (fill) {
    const pct = s.hp / s.maxHp * 100;
    fill.style.width = pct+'%';
    fill.style.background = pct>50?'#22c55e':pct>25?'#f59e0b':'#ef4444';
  }
  if (s.hp <= 0) {
    floatText(document.getElementById('gameArea'), s.x+s.w/2, s.y, '💥', '#f97316');
    s.el.style.transition = 'opacity .2s,transform .2s';
    s.el.style.opacity='0'; s.el.style.transform='scale(0.3)';
    setTimeout(()=>s.el.remove(), 220);
  } else {
    s.el.classList.add('struct-hit');
    setTimeout(()=>s.el.classList.remove('struct-hit'), 130);
  }
}

function fireTurretProjectile(s, z, w, elevated) {
  const ga  = document.getElementById('gameArea');
  const tcx = s.x + s.w/2, tcy = s.y + s.h/2;
  const angle = Math.atan2(zCy(z)-tcy, zCx(z)-tcx);
  for (let i=0; i<w.pellets; i++) {
    const a = angle + (w.spread>0?(Math.random()-0.5)*w.spread*2:0);
    const el = document.createElement('div');
    el.className = 'bullet'+(s.turretWeapon==='sniper'?' bullet-sniper':'');
    el.style.cssText = `left:${tcx}px;top:${tcy}px;background:${w.color};width:${w.bSize}px;height:${w.bSize}px;`;
    ga.appendChild(el);
    projectiles.push({
      el, x:tcx, y:tcy,
      vx:Math.cos(a)*w.projSpeed, vy:Math.sin(a)*w.projSpeed,
      dmg:w.dmg, pierce:!!w.pierce, maxDist:w.range, distTraveled:0, hitIds:new Set(),
      elevated:!!elevated, isRocket:!!w.isRocket,
    });
  }
}

function updateStructureBar() {
  const ga = document.getElementById('gameArea');
  let bar = document.getElementById('structPlaceBar');
  const hasAny = Object.values(structureInventory).some(v=>v>0);
  if (!hasAny || phase!=='wave') { bar?.remove(); previewEl?.remove(); previewEl=null; return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id='structPlaceBar'; bar.className='struct-place-bar';
    ga.appendChild(bar);
  }
  bar.innerHTML = '';
  Object.entries(structureInventory).forEach(([type,cnt])=>{
    if (cnt<=0) return;
    const def=STRUCTURES[type];
    const active = placementMode===type;
    const btn = document.createElement('button');
    btn.className='btn '+(active?'btn-primary':'btn-secondary')+' struct-place-btn';
    btn.innerHTML=`${def.icon} ×${cnt}`;
    btn.title=def.name;
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      placementMode = placementMode===type ? null : type;
      if (!placementMode) { previewEl?.remove(); previewEl=null; }
      updateStructureBar();
    });
    bar.appendChild(btn);
  });
}

// ── Vlna hotova ───────────────────────────────────────────────
function waveComplete() {
  cancelAnimationFrame(animId); clearTimeout(spawnTimer);
  clearInterval(bossSpawnInterval); bossSpawnInterval=null;
  phase = 'question';
  setTimeout(showQuestion, 700);
}

// ── Otázka ────────────────────────────────────────────────────
function showQuestion() {
  if (questionQueue.length===0) questionQueue = shuffle([...ALL_CARDS]);
  const card = questionQueue.shift();
  showScreen('questionScreen');
  document.getElementById('gameQText').textContent       = card.front;
  document.getElementById('gameAnswers').style.display   = 'none';
  document.getElementById('gameGenLoading').style.display= 'none';
  document.getElementById('qFeedback').style.display     = 'none';
  renderAnswers(card, getLocalDistractors(card));
}

function renderAnswers(card, distractors) {
  document.getElementById('gameGenLoading').style.display = 'none';
  const wrap = document.getElementById('gameAnswers');
  wrap.innerHTML=''; wrap.style.display='grid';
  const n = (card.answerCount || 4) - 1;
  let pool = distractors.slice(0,n);
  while (pool.length<n) { const e=ALL_CARDS.find(c=>c.id!==card.id&&!pool.includes(c.back)); if(e) pool.push(e.back); else break; }
  shuffle([card.back,...pool]).forEach((opt,i)=>{
    const btn = document.createElement('button');
    btn.className='quiz-answer-btn'; btn.textContent=opt;
    btn.style.animationDelay=`${i*55}ms`;
    btn.addEventListener('click',()=>pickAnswer(btn, opt===card.back, card));
    wrap.appendChild(btn);
  });
}

function pickAnswer(btn, correct, card) {
  document.querySelectorAll('#gameAnswers .quiz-answer-btn').forEach(b=>(b.disabled=true));
  const fb = document.getElementById('qFeedback');
  if (correct) {
    btn.classList.add('quiz-answer-correct');
    coins+=50; score+=50; wavePenalty=false;
    fb.style.color='#86efac'; fb.textContent='✅ Správně! +50🪙 · Normální vlna';
  } else {
    btn.classList.add('quiz-answer-wrong');
    hp=Math.max(0,hp-10); wavePenalty=true;
    fb.style.color='#fca5a5';
    fb.textContent=`❌ Špatně! „${card.back}" · −10❤️ · Příští vlna těžší, zombie za ½`;
    document.querySelectorAll('#gameAnswers .quiz-answer-btn').forEach(b=>{
      if (b.textContent===card.back) b.classList.add('quiz-answer-correct');
    });
  }
  fb.style.display='block'; updateHUD();
  setTimeout(()=>{ if(hp<=0){gameOver();return;} phase='shop'; showShop(); }, 2400);
}

// ── Obchod ────────────────────────────────────────────────────
function showShop() {
  showScreen('shopScreen');
  document.getElementById('shopCoins').textContent = `🪙 ${coins}`;
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';

  // Left column: upgrades
  const utilSec = document.createElement('div'); utilSec.className='shop-col';
  utilSec.innerHTML = '<div class="shop-section-title">⚙️ Vybavení</div>';
  UPGRADES_UTIL.forEach(def=>{
    const level  = def.id==='heal' ? 0 : (upgrades[def.id]||0);
    const maxed  = level >= def.max;
    const cost   = def.costs ? (def.costs[level]??999) : def.cost;
    const canBuy = !maxed && coins>=cost;
    const item   = document.createElement('div');
    item.className = 'shop-util-item'+(maxed?' shop-maxed':'');
    item.innerHTML = `
      <div class="sui-top">
        <span>${def.icon} ${def.label}</span>
        ${def.max<=3 ? `<span class="sui-level">${level}/${def.max}</span>` : ''}
      </div>
      <div class="sui-desc">${def.desc}</div>
      <button class="btn ${canBuy?'btn-primary':'btn-secondary'} shop-buy-btn"
              data-util="${def.id}" ${canBuy?'':'disabled'}
              style="width:100%;justify-content:center;font-size:0.78rem;padding:4px;">
        ${maxed?'MAX':`🪙 ${cost}`}
      </button>`;
    utilSec.appendChild(item);
  });
  grid.appendChild(utilSec);

  // Right column: weapons
  const wepSec = document.createElement('div'); wepSec.className='shop-col';
  wepSec.innerHTML = '<div class="shop-section-title">🔫 Zbraně</div>';
  const wlist = document.createElement('div'); wlist.className='shop-weapon-list';
  ['knife','pistol','smg','ar','flamethrower','minigun','lmg','revolver','shotgun','grenadeLaunch','sniper','rocket'].forEach(id=>{
    const w       = WEAPONS[id];
    const owned   = unlockedWeapons.has(id);
    const current = weapon===id;
    const canUnlock = !w.prev || unlockedWeapons.has(w.prev);
    const canBuy    = canUnlock && !owned && coins>=w.cost;
    const depth     = getWeaponDepth(id);
    const row = document.createElement('div');
    row.className = 'shop-wep-row'+(current?' swep-current':owned?' swep-owned':!canUnlock?' swep-locked':'');
    row.style.paddingLeft = (depth*10)+'px';
    const btn = current
      ? `<span class="swep-badge">▶</span>`
      : owned
        ? `<button class="btn btn-secondary swep-btn" data-equip="${id}">Vybrat</button>`
        : !canUnlock
          ? `<button class="btn btn-secondary swep-btn" disabled>🔒</button>`
          : `<button class="btn ${canBuy?'btn-primary':'btn-secondary'} swep-btn" data-weapon="${id}" ${canBuy?'':'disabled'}>🪙${w.cost}</button>`;
    row.innerHTML = `<span class="swep-name">${w.name}</span>${btn}`;
    wlist.appendChild(row);
  });
  wepSec.appendChild(wlist);
  grid.appendChild(wepSec);

  // Structures section (below weapons, spans full width)
  const structSec = document.createElement('div');
  structSec.className='shop-struct-sec';
  structSec.innerHTML='<div class="shop-section-title" style="margin-bottom:6px;">🏗️ Stavby <span style="font-size:0.65rem;color:var(--text-muted);font-weight:400;">(kup → postav kliknutím ve vlně)</span></div>';
  const structGrid = document.createElement('div');
  structGrid.className='shop-struct-grid';
  Object.entries(STRUCTURES).forEach(([type,def])=>{
    const inv = structureInventory[type]||0;
    const canBuy = coins>=def.shopCost;
    const iconHtml = def.icon==='spike'
      ? `<span class="shop-spike-icon">▲▲▲▲</span>`
      : `<span style="font-size:1.1rem">${def.icon}</span>`;
    const extra = type==='turret'
      ? `<div class="sui-desc">Klikni na ni ve vlně → kup zbraň (bez požadavků) · ${inv} ks</div>`
      : type==='platform'
        ? `<div class="sui-desc">Stůj na ní → střílíš přes zdi · ${inv} ks</div>`
        : `<div class="sui-desc">${inv} ks v zásobě</div>`;
    const item = document.createElement('div');
    item.className='shop-util-item';
    item.innerHTML=`
      <div class="sui-top">${iconHtml}<span style="font-size:0.8rem;font-weight:600;">${def.name}</span></div>
      ${extra}
      <button class="btn ${canBuy?'btn-primary':'btn-secondary'} shop-buy-btn" data-struct="${type}" ${canBuy?'':'disabled'} style="width:100%;justify-content:center;font-size:0.78rem;padding:4px;">🪙 ${def.shopCost}</button>`;
    structGrid.appendChild(item);
  });
  structSec.appendChild(structGrid);
  grid.appendChild(structSec);

  grid.querySelectorAll('[data-util]').forEach(b=>b.addEventListener('click',()=>{buyUtil(b.dataset.util);showShop();}));
  grid.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{buyWeapon(b.dataset.weapon);showShop();}));
  grid.querySelectorAll('[data-equip]').forEach(b=>b.addEventListener('click',()=>{weapon=b.dataset.equip;updateHUD();showShop();}));
  grid.querySelectorAll('[data-struct]').forEach(b=>b.addEventListener('click',()=>{buyStructure(b.dataset.struct);showShop();}));
}

function buyStructure(type) {
  const def=STRUCTURES[type]; if(!def||coins<def.shopCost) return;
  coins-=def.shopCost;
  structureInventory[type]=(structureInventory[type]||0)+1;
  updateHUD();
}

function getWeaponDepth(id) { let d=0,cur=WEAPONS[id].prev; while(cur){d++;cur=WEAPONS[cur]?.prev;} return d; }
function buyWeapon(id) {
  const w=WEAPONS[id]; if(!w||coins<w.cost||unlockedWeapons.has(id)) return;
  if(w.prev&&!unlockedWeapons.has(w.prev)) return;
  coins-=w.cost; unlockedWeapons.add(id); weapon=id; updateHUD();
}
function buyUtil(id) {
  const def=UPGRADES_UTIL.find(d=>d.id===id); if(!def) return;
  const level=def.id==='heal' ? 0 : (upgrades[def.id]||0);
  const cost =def.costs ? (def.costs[level]??999) : def.cost;
  if(coins<cost) return; if(def.id!=='heal'&&level>=def.max) return;
  coins-=cost;
  if(id==='heal')     hp=Math.min(100,hp+30);
  else if(id==='armor')    upgrades.armor++;
  else if(id==='grenades') upgrades.grenades=Math.min(3,upgrades.grenades+1);
  updateHUD();
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hudHp').textContent   = `❤️ ${hp}`;
  document.getElementById('hudCoins').textContent= `🪙 ${coins}`;
  document.getElementById('hudWave').textContent = wave>0 ? `Vlna ${wave}` : '';
  const pct  = Math.max(0,hp);
  const fill = document.getElementById('gameHpFill');
  fill.style.width      = pct+'%';
  fill.style.background = pct>50 ? '#22c55e' : pct>25 ? '#f59e0b' : '#ef4444';
  const wi = document.getElementById('playerWeaponIcon');
  if (wi) wi.textContent = WEAPONS[weapon].name.split(' ')[0];

  // Knife range circle
  const krc = document.getElementById('knifeRange');
  if (weapon==='knife' && phase==='wave') { if(!krc) spawnKnifeCircle(); }
  else if (krc) krc.remove();

  // Grenade button
  let gb = document.getElementById('grenadeBtn');
  if (upgrades.grenades > 0) {
    if (!gb) {
      gb = document.createElement('button');
      gb.id='grenadeBtn'; gb.className='grenade-btn btn btn-secondary';
      gb.addEventListener('click',()=>{
        if(phase!=='wave') return;
        grenadeThrowMode=!grenadeThrowMode; updateHUD();
      });
      document.getElementById('gameArea').appendChild(gb);
    }
    gb.textContent    = grenadeThrowMode ? '🎯 Klikni kam hodit…' : `💣 ×${upgrades.grenades}`;
    gb.style.display  = phase==='wave' ? 'flex' : 'none';
    gb.style.background = grenadeThrowMode ? 'rgba(249,115,22,0.9)' : '';
  } else if (gb) gb.remove();

  updateStructureBar();
}

// ── Game over ─────────────────────────────────────────────────
function gameOver() {
  cancelAnimationFrame(animId); clearTimeout(spawnTimer);
  clearInterval(bossSpawnInterval); bossSpawnInterval=null;
  phase='over'; grenadeThrowMode=false; placementMode=null; mouseHeld=false;
  previewEl?.remove(); previewEl=null;
  document.getElementById('structPlaceBar')?.remove();
  document.getElementById('turretMenu')?.remove();
  projectiles.forEach(p=>p.el.remove()); projectiles=[];
  if(player?.el){player.el.style.transition='opacity .4s';player.el.style.opacity='0';}
  zombieMap.forEach(z=>{z.el.style.transition='opacity .5s,transform .5s';z.el.style.opacity='0';z.el.style.transform='scale(0.4)';});
  document.getElementById('goWave').textContent  = wave;
  document.getElementById('goScore').textContent = score;
  setTimeout(()=>{
    zombieMap.forEach(z=>z.el.remove()); zombieMap.clear();
    document.querySelectorAll('.float-text').forEach(e=>e.remove());
    showScreen('gameoverScreen');
  }, 700);
}

// ── Util ─────────────────────────────────────────────────────
function showScreen(id) {
  ['startScreen','questionScreen','shopScreen','gameoverScreen'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.style.display=s===id?'flex':'none';
  });
}
function hideAllOverlays() { showScreen('__none__'); }
function floatText(parent, x, y, text, color) {
  const el = document.createElement('div');
  el.className='float-text'; el.textContent=text;
  el.style.cssText=`left:${x}px;top:${y}px;color:${color};`;
  parent.appendChild(el); setTimeout(()=>el.remove(), 950);
}

function getLocalDistractors(card) {
  const n = (card.answerCount || 4) - 1;
  if (card.distractors && card.distractors.length >= n) return shuffle(card.distractors).slice(0,n);
  const extra = shuffle(ALL_CARDS.filter(c=>c.id!==card.id && c.back)).slice(0,n).map(c=>c.back);
  return shuffle([...(card.distractors||[]),...extra]).slice(0,n);
}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg){
  const w=document.getElementById('toastWrap');if(!w)return;
  const t=document.createElement('div');t.className='toast';t.textContent=msg;w.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),350);},3200);
}

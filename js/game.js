'use strict';
// ══════════════════════════════════════════════════════════════
//  ZOMBIE SURVIVAL · Top-Down Canvas · game.js
// ══════════════════════════════════════════════════════════════

/* ── World ───────────────────────────────────────────────── */
const WW=4000,WH=4000,CX=WW/2,CY=WH/2;
const BARRIER_HALF=1250;
const BARRIER={x:CX-BARRIER_HALF,y:CY-BARRIER_HALF,w:BARRIER_HALF*2,h:BARRIER_HALF*2};
const BASE_R=52,PLAYER_R=16,SPAWN_M=120,FOV_DIST=800;
const BUILD_DUR=20; // seconds

/* ── Maps ────────────────────────────────────────────────── */
const MAPS=[
  {id:0,name:'🏭 Průmysl',bg:'#111108',floor:'#1d1d12',walls:[
    {x:1550,y:1550,w:200,h:400},{x:1550,y:2050,w:200,h:400},
    {x:2250,y:1600,w:380,h:180},{x:2250,y:2220,w:380,h:180},
    {x:1800,y:1820,w:280,h:40},{x:2050,y:1720,w:40,h:280},
    {x:2100,y:2100,w:200,h:40},{x:2100,y:2140,w:40,h:200},
    {x:1650,y:2420,w:160,h:160},{x:2200,y:1460,w:160,h:160},
  ]},
  {id:1,name:'🏘️ Předměstí',bg:'#080d08',floor:'#0e170e',walls:[
    {x:1560,y:1560,w:240,h:180},{x:1680,y:1740,w:40,h:200},
    {x:2200,y:1600,w:200,h:180},{x:2280,y:1780,w:40,h:160},
    {x:1620,y:2200,w:180,h:240},{x:1700,y:2440,w:180,h:40},
    {x:2240,y:2180,w:220,h:200},{x:2320,y:2380,w:40,h:140},
    {x:1850,y:1760,w:300,h:28},{x:1850,y:2200,w:28,h:220},
    {x:1878,y:2400,w:272,h:28},
  ]},
  {id:2,name:'⛪ Hřbitov',bg:'#060610',floor:'#0e0e1c',walls:[
    // Kaple (otevřená na east)
    {x:1620,y:1640,w:180,h:20},{x:1620,y:1640,w:20,h:200},{x:1620,y:1820,w:200,h:20},
    // Hrobky – levý cluster
    {x:1760,y:1680,w:40,h:55},{x:1840,y:1720,w:40,h:55},{x:1760,y:1800,w:40,h:55},
    // Hrobky – pravý cluster
    {x:2200,y:1660,w:40,h:55},{x:2280,y:1720,w:40,h:55},{x:2200,y:1800,w:40,h:55},
    // Hrobky – dolní cluster
    {x:1680,y:2180,w:40,h:55},{x:1760,y:2260,w:40,h:55},{x:1640,y:2300,w:40,h:55},
    {x:2260,y:2180,w:40,h:55},{x:2320,y:2250,w:40,h:55},{x:2200,y:2320,w:40,h:55},
    {x:1940,y:2240,w:40,h:55},{x:2060,y:2190,w:40,h:55},
    // Krátké ploty (s mezerami pro průchod)
    {x:1540,y:1960,w:150,h:16},{x:1540,y:2080,w:150,h:16},
    {x:2310,y:1960,w:150,h:16},{x:2310,y:2080,w:150,h:16},
  ]},
];

/* ── Kits ────────────────────────────────────────────────── */
const KITS={
  warrior: {name:'Warrior', emoji:'⚔️',col:'#ef4444',
            desc:'Silný bojovník na blízko. Vysoké HP.',
            passive:'⚔️ Bojový rytmus — každý 5. melee zásah způsobí 2× bonus dmg.',
            stats:{str:4,int:1,agi:2,vit:4,cha:1,luk:0,dex:1,res:2,per:0},weapon:'sword', abil:['slash','rage']},
  archer:  {name:'Archer',  emoji:'🏹',col:'#84cc16',
            desc:'Přesný střelec. Větší FOV.',
            passive:'🏹 Ostré oko — každý výstřel má 10% šanci na bonus dmg ×1.5.',
            stats:{str:2,int:2,agi:4,vit:2,cha:2,luk:2,dex:0,res:0,per:2},weapon:'bow',   abil:['multishot','dodge']},
  mage:    {name:'Mage',    emoji:'🧙',col:'#818cf8',
            desc:'Elementální kouzla. Mocný.',
            passive:'🔮 Mana splurge — zabití kouzlem zkrátí cooldown Ohnivé kule o 1s.',
            stats:{str:1,int:5,agi:2,vit:2,cha:2,luk:0,dex:2,res:0,per:1},weapon:'staff', abil:['fireball','blink','nova']},
  militant:{name:'Militant',emoji:'🪖',col:'#f59e0b',
            desc:'Vojak se střelnými zbraněmi.',
            passive:'💥 Výbušná duše — každé 4. vystřelení granátu nezaplatí cooldown.',
            stats:{str:2,int:2,agi:3,vit:3,cha:2,luk:1,dex:1,res:1,per:2},weapon:'pistol',abil:['grenade','suppression']},
  tank:    {name:'Tank',    emoji:'🛡️',col:'#64748b',
            desc:'Absorbuje zásahy. Pomalý.',
            passive:'🛡️ Pevný postoj — při stání >1s: +15% dmg reduction a 1 HP/s regen.',
            stats:{str:3,int:1,agi:1,vit:6,cha:1,luk:0,dex:0,res:3,per:0},weapon:'hammer',abil:['taunt','fortify']},
  rogue:   {name:'Rogue',   emoji:'🗡️',col:'#a855f7',
            desc:'Rychlý. Kritické zásahy.',
            passive:'🗡️ Skrytý smrtonoš — při stealth +25% rychlost, první útok po stealth vždy krit.',
            stats:{str:3,int:2,agi:5,vit:2,cha:2,luk:3,dex:2,res:0,per:0},weapon:'dagger',abil:['stealth','backstab']},
  engineer:{name:'Engineer',emoji:'🔧',col:'#0ea5e9',
            desc:'Stavitel. Levné věže.',
            passive:'🔧 Nouzová záplata — struktury pod 30% HP se automaticky opravují 3 HP/s.',
            stats:{str:1,int:3,agi:2,vit:3,cha:4,luk:0,dex:3,res:0,per:1},weapon:'wrench',abil:['deploy','repair']},
  priest:  {name:'Priest',  emoji:'✝️',col:'#fde68a',
            desc:'Léčí spoluhráče.',
            passive:'✝️ Léčivá aura — pasivní 1 HP/s regen pro sebe a spoluhráče do 150px.',
            stats:{str:1,int:4,agi:2,vit:3,cha:4,luk:1,dex:2,res:1,per:0},weapon:'mace',  abil:['heal','bless']},
};

/* ── Weapons ─────────────────────────────────────────────── */
const WEAPONS={
  pistol: {name:'Pistole',   emoji:'🔫',dmg:18,cd:400,range:420,spd:14,melee:false,spread:0.05,col:'#fbbf24'},
  shotgun:{name:'Brokovnice',emoji:'💥',dmg:14,cd:900,range:260,spd:12,melee:false,spread:0.22,pellets:5,col:'#f97316'},
  rifle:  {name:'Puška',     emoji:'🎯',dmg:36,cd:700,range:600,spd:18,melee:false,spread:0.01,col:'#06b6d4'},
  bow:    {name:'Luk',       emoji:'🏹',dmg:30,cd:600,range:500,spd:11,melee:false,spread:0.03,col:'#84cc16',arrow:true},
  sword:  {name:'Meč',       emoji:'⚔️',dmg:42,cd:480,range:72, spd:0, melee:true, arc:1.2,   col:'#ef4444'},
  dagger: {name:'Dýka',      emoji:'🗡️',dmg:22,cd:240,range:56, spd:0, melee:true, arc:0.9,   col:'#a855f7'},
  hammer: {name:'Kladivo',   emoji:'🔨',dmg:58,cd:800,range:82, spd:0, melee:true, arc:1.4,   col:'#64748b'},
  staff:  {name:'Hůl',       emoji:'🪄',dmg:28,cd:350,range:68, spd:0, melee:true, arc:1.0,   col:'#818cf8'},
  wrench: {name:'Klíč',      emoji:'🔧',dmg:20,cd:380,range:70, spd:0, melee:true, arc:1.0,   col:'#0ea5e9'},
  mace:   {name:'Palcát',    emoji:'🏏',dmg:32,cd:580,range:74, spd:0, melee:true, arc:1.1,   col:'#fde68a'},
};

/* ── Stat defs ───────────────────────────────────────────── */
const SDEFS_STATS=[
  {k:'str',label:'Síla',       desc:'Melee dmg +5%/bod'},
  {k:'int',label:'Inteligence',desc:'Kouzla dmg +8%/bod'},
  {k:'agi',label:'Obratnost',  desc:'Rychlost +6%/bod'},
  {k:'vit',label:'Vitalita',   desc:'Max HP +20/bod'},
  {k:'cha',label:'Charisma',   desc:'Slevy −3%/bod'},
  {k:'luk',label:'Štěstí',     desc:'Krit +2%/bod (základ 5%)'},
  {k:'dex',label:'Zručnost',   desc:'CD −3%/bod (max 60%)'},
  {k:'res',label:'Odolnost',   desc:'Dmg −2%/bod (max 75%)'},
  {k:'per',label:'Vnímání',    desc:'Dosah +5%/bod · FOV'},
];

/* ── Zombie types ────────────────────────────────────────── */
const ZTYPES={
  normal:  {emoji:'🧟', hp:60,  spd:1.1, r:16,coins:5, xp:10, dmg:4, sdmg:1, boss:false,ignP:false},
  speeder: {emoji:'🏃', hp:30,  spd:2.6, r:13,coins:8, xp:15, dmg:3, sdmg:1, boss:false,ignP:false},
  tank:    {emoji:'🧟‍♂️',hp:260, spd:0.48,r:22,coins:15,xp:30, dmg:9, sdmg:2, boss:false,ignP:false},
  dog:     {emoji:'🐕', hp:22,  spd:3.3, r:12,coins:6, xp:12, dmg:3, sdmg:1, boss:false,ignP:false},
  brute:   {emoji:'🦍', hp:210, spd:0.6, r:21,coins:20,xp:40, dmg:2, sdmg:8, boss:false,ignP:true},
  exploder:{emoji:'💣', hp:40,  spd:1.6, r:15,coins:10,xp:20, dmg:30,sdmg:4, boss:false,ignP:false,explodes:true},
  boss:    {emoji:'👹', hp:1200,spd:0.7, r:36,coins:80,xp:200,dmg:14,sdmg:10,boss:true, ignP:false},
};

/* ── Structure defs ──────────────────────────────────────────
   blocksBullets: false → zdi propouštějí střely (barikáda = kryt pro pohyb, ne střely)
   plat: true → stojíš-li na ní, tvé střely ignorují zdi (výšková výhoda)
*/
const STRUCT_DEFS={
  wall:     {emoji:'🧱',name:'Zeď',      cost:15,hp:200,w:64,h:20,blocks:true, blocksBullets:true, spikes:0, plat:false},
  barricade:{emoji:'🪵',name:'Barikáda', cost:18,hp:140,w:64,h:18,blocks:true, blocksBullets:false,spikes:0, plat:false},
  spikes:   {emoji:'🗡️',name:'Hroty',    cost:30,hp:60, w:48,h:48,blocks:false,blocksBullets:false,spikes:18,plat:false},
  turret:   {emoji:'🔫',name:'Věž',      cost:80,hp:80, w:40,h:40,blocks:false,blocksBullets:false,spikes:0, plat:false,turret:true},
  platform: {emoji:'🟫',name:'Plošina',  cost:20,hp:160,w:72,h:72,blocks:false,blocksBullets:false,spikes:0, plat:true},
};

/* ── Per-kit shops ───────────────────────────────────────── */
const KIT_SHOP={
  warrior:[
    {id:'hp',    emoji:'❤️', name:'HP +60',      cost:35, type:'use',    use:{hp:60}},
    {id:'maxhp', emoji:'💗', name:'Max HP +40',  cost:70, type:'use',    use:{maxhp:40}},
    {id:'str1',  emoji:'💪', name:'Síla +1',     cost:55, type:'stat',   stat:'str',val:1},
    {id:'vit1',  emoji:'❤️‍🔥',name:'Vitalita +1',cost:55, type:'stat',   stat:'vit',val:1},
    {id:'hammer',emoji:'🔨', name:'Kladivo',     cost:80, type:'weapon'},
    {id:'spk3',  emoji:'🗡️',name:'Hroty ×3',    cost:50, type:'struct', stype:'spikes',   qty:3},
    {id:'wall5', emoji:'🧱', name:'Zeď ×5',      cost:50, type:'struct', stype:'wall',     qty:5},
    {id:'barr3', emoji:'🪵', name:'Barikáda ×3', cost:45, type:'struct', stype:'barricade',qty:3},
    {id:'turr1', emoji:'🔫', name:'Věž ×1',      cost:100,type:'struct', stype:'turret',   qty:1},
  ],
  archer:[
    {id:'hp',    emoji:'❤️', name:'HP +50',      cost:30, type:'use',    use:{hp:50}},
    {id:'agi1',  emoji:'💨', name:'Obratnost +1',cost:55, type:'stat',   stat:'agi',val:1},
    {id:'rifle', emoji:'🎯', name:'Puška',        cost:120,type:'weapon'},
    {id:'turr2', emoji:'🔫', name:'Věž ×2',      cost:180,type:'struct', stype:'turret',   qty:2},
    {id:'barr5', emoji:'🪵', name:'Barikáda ×5', cost:65, type:'struct', stype:'barricade',qty:5},
    {id:'plat3', emoji:'🟫', name:'Plošina ×3',  cost:40, type:'struct', stype:'platform', qty:3},
    {id:'spk2',  emoji:'🗡️',name:'Hroty ×2',    cost:35, type:'struct', stype:'spikes',   qty:2},
    {id:'maxhp', emoji:'💗', name:'Max HP +30',  cost:60, type:'use',    use:{maxhp:30}},
    {id:'int1',  emoji:'🧠', name:'Int +1',       cost:55, type:'stat',   stat:'int',val:1},
  ],
  mage:[
    {id:'int1',  emoji:'🧠', name:'Int +1',       cost:60, type:'stat',   stat:'int',val:1},
    {id:'int2',  emoji:'🔮', name:'Int +2',        cost:110,type:'stat',   stat:'int',val:2},
    {id:'hp',    emoji:'❤️', name:'HP +50',       cost:30, type:'use',    use:{hp:50}},
    {id:'maxhp', emoji:'💗', name:'Max HP +40',   cost:65, type:'use',    use:{maxhp:40}},
    {id:'agi1',  emoji:'💨', name:'Obratnost +1', cost:55, type:'stat',   stat:'agi',val:1},
    {id:'plat3', emoji:'🟫', name:'Plošina ×3',  cost:40, type:'struct', stype:'platform', qty:3},
    {id:'turr1', emoji:'🔫', name:'Věž ×1',       cost:100,type:'struct', stype:'turret',   qty:1},
    {id:'barr4', emoji:'🪵', name:'Barikáda ×4', cost:55, type:'struct', stype:'barricade',qty:4},
    {id:'wall3', emoji:'🧱', name:'Zeď ×3',       cost:35, type:'struct', stype:'wall',     qty:3},
  ],
  militant:[
    {id:'shotgun',emoji:'💥',name:'Brokovnice',   cost:80, type:'weapon'},
    {id:'rifle', emoji:'🎯', name:'Puška',         cost:120,type:'weapon'},
    {id:'hp',    emoji:'❤️', name:'HP +50',        cost:30, type:'use',   use:{hp:50}},
    {id:'str1',  emoji:'💪', name:'Síla +1',       cost:55, type:'stat',  stat:'str',val:1},
    {id:'turr2', emoji:'🔫', name:'Věž ×2',       cost:180,type:'struct', stype:'turret',   qty:2},
    {id:'wall5', emoji:'🧱', name:'Zeď ×5',       cost:50, type:'struct', stype:'wall',     qty:5},
    {id:'barr5', emoji:'🪵', name:'Barikáda ×5', cost:65, type:'struct', stype:'barricade',qty:5},
    {id:'spk3',  emoji:'🗡️',name:'Hroty ×3',     cost:50, type:'struct', stype:'spikes',   qty:3},
    {id:'maxhp', emoji:'💗', name:'Max HP +30',   cost:60, type:'use',   use:{maxhp:30}},
  ],
  tank:[
    {id:'vit2',  emoji:'❤️‍🔥',name:'Vitalita +2', cost:100,type:'stat',   stat:'vit',val:2},
    {id:'maxhp2',emoji:'💗', name:'Max HP +60',   cost:90, type:'use',    use:{maxhp:60}},
    {id:'hp',    emoji:'❤️', name:'HP +80',        cost:45, type:'use',    use:{hp:80}},
    {id:'str1',  emoji:'💪', name:'Síla +1',       cost:55, type:'stat',   stat:'str',val:1},
    {id:'wall8', emoji:'🧱', name:'Zeď ×8',        cost:75, type:'struct', stype:'wall',     qty:8},
    {id:'barr5', emoji:'🪵', name:'Barikáda ×5', cost:65, type:'struct', stype:'barricade',qty:5},
    {id:'spk5',  emoji:'🗡️',name:'Hroty ×5',     cost:80, type:'struct', stype:'spikes',   qty:5},
    {id:'turr1', emoji:'🔫', name:'Věž ×1',       cost:100,type:'struct', stype:'turret',   qty:1},
    {id:'plat2', emoji:'🟫', name:'Plošina ×2',  cost:30, type:'struct', stype:'platform', qty:2},
  ],
  rogue:[
    {id:'agi2',  emoji:'💨', name:'Obratnost +2', cost:100,type:'stat',   stat:'agi',val:2},
    {id:'str1',  emoji:'💪', name:'Síla +1',       cost:55, type:'stat',   stat:'str',val:1},
    {id:'hp',    emoji:'❤️', name:'HP +50',        cost:30, type:'use',    use:{hp:50}},
    {id:'maxhp', emoji:'💗', name:'Max HP +30',   cost:60, type:'use',    use:{maxhp:30}},
    {id:'plat4', emoji:'🟫', name:'Plošina ×4',  cost:55, type:'struct', stype:'platform', qty:4},
    {id:'spk4',  emoji:'🗡️',name:'Hroty ×4',     cost:65, type:'struct', stype:'spikes',   qty:4},
    {id:'barr3', emoji:'🪵', name:'Barikáda ×3', cost:45, type:'struct', stype:'barricade',qty:3},
    {id:'turr1', emoji:'🔫', name:'Věž ×1',       cost:100,type:'struct', stype:'turret',   qty:1},
    {id:'wall3', emoji:'🧱', name:'Zeď ×3',       cost:35, type:'struct', stype:'wall',     qty:3},
  ],
  engineer:[
    {id:'turr3', emoji:'🔫', name:'Věž ×3',       cost:260,type:'struct', stype:'turret',   qty:3},
    {id:'wall10',emoji:'🧱', name:'Zeď ×10',      cost:90, type:'struct', stype:'wall',    qty:10},
    {id:'barr8', emoji:'🪵', name:'Barikáda ×8', cost:100,type:'struct', stype:'barricade',qty:8},
    {id:'plat5', emoji:'🟫', name:'Plošina ×5',  cost:65, type:'struct', stype:'platform', qty:5},
    {id:'spk5',  emoji:'🗡️',name:'Hroty ×5',     cost:80, type:'struct', stype:'spikes',   qty:5},
    {id:'cha1',  emoji:'🤝', name:'Charisma +1',  cost:55, type:'stat',   stat:'cha',val:1},
    {id:'int1',  emoji:'🧠', name:'Int +1',        cost:55, type:'stat',   stat:'int',val:1},
    {id:'hp',    emoji:'❤️', name:'HP +50',        cost:30, type:'use',    use:{hp:50}},
    {id:'maxhp', emoji:'💗', name:'Max HP +30',   cost:60, type:'use',    use:{maxhp:30}},
  ],
  priest:[
    {id:'hp2',   emoji:'💊', name:'HP +80',        cost:45, type:'use',    use:{hp:80}},
    {id:'maxhp2',emoji:'💗', name:'Max HP +50',   cost:80, type:'use',    use:{maxhp:50}},
    {id:'int1',  emoji:'🧠', name:'Int +1',        cost:55, type:'stat',   stat:'int',val:1},
    {id:'vit1',  emoji:'❤️‍🔥',name:'Vitalita +1', cost:55, type:'stat',   stat:'vit',val:1},
    {id:'cha2',  emoji:'🤝', name:'Charisma +2',  cost:100,type:'stat',   stat:'cha',val:2},
    {id:'wall5', emoji:'🧱', name:'Zeď ×5',       cost:50, type:'struct', stype:'wall',     qty:5},
    {id:'barr3', emoji:'🪵', name:'Barikáda ×3', cost:45, type:'struct', stype:'barricade',qty:3},
    {id:'turr1', emoji:'🔫', name:'Věž ×1',       cost:100,type:'struct', stype:'turret',   qty:1},
    {id:'plat2', emoji:'🟫', name:'Plošina ×2',  cost:30, type:'struct', stype:'platform', qty:2},
  ],
};

/* ── Skill Tree ──────────────────────────────────────────── */
const SKILL_TREE={
  warrior:{
    A:{name:'Berserk',col:'#ef4444',skills:[
      {id:'war_a1',tier:1,emoji:'🩸',name:'Krvavý záběr',   desc:'Melee: 20% šance na 1.5× dmg'},
      {id:'war_a2',tier:2,emoji:'😡',name:'Vztek bojovníka',desc:'Rage trvá +3s a dává +20% dmg'},
      {id:'war_a3',tier:3,emoji:'💉',name:'Záplava krve',   desc:'Melee kill → obnov 15 HP'},
      {id:'war_a4',tier:4,emoji:'💀',name:'Berserk',        desc:'[R] 8s: +100% dmg a +30% rychlost',abilId:'ult_war_a'},
    ]},
    B:{name:'Štít',col:'#94a3b8',skills:[
      {id:'war_b1',tier:1,emoji:'🛡️',name:'Pevná kůže',    desc:'Každý zásah −2 dmg'},
      {id:'war_b2',tier:2,emoji:'⚡',name:'Odrazová síla',  desc:'Melee zásah po Fortify: +40% dmg'},
      {id:'war_b3',tier:3,emoji:'❤️',name:'Neúnavný',       desc:'Max HP +60'},
      {id:'war_b4',tier:4,emoji:'🗿',name:'Nepřemožitelný', desc:'[R] 3s imunita + stun zombie v okolí',abilId:'ult_war_b'},
    ]},
    C:{name:'Warlord',col:'#fbbf24',skills:[
      {id:'war_c1',tier:1,emoji:'📣',name:'Válečný pokřik', desc:'Spojenci +15% dmg na 5s (aktivní schopnost)'},
      {id:'war_c2',tier:2,emoji:'😰',name:'Zastrašení',     desc:'Zombíci v blízkosti −20% rychlost a útok'},
      {id:'war_c3',tier:3,emoji:'🚩',name:'Prapor naděje',  desc:'Zabodne prapor – spojenci v okolí regen HP'},
      {id:'war_c4',tier:4,emoji:'🌟',name:'Nesmrtelná legie',desc:'[R] Všichni hráči nezranitelní 5s',abilId:'ult_war_c'},
    ]},
  },
  archer:{
    A:{name:'Ostrostřelec',col:'#84cc16',skills:[
      {id:'arc_a1',tier:1,emoji:'🎯',name:'Vražedný záměr',desc:'Každý 3. výstřel = 2× dmg'},
      {id:'arc_a2',tier:2,emoji:'➡️',name:'Průbojná střela',desc:'Střela projde 1 zombie navíc'},
      {id:'arc_a3',tier:3,emoji:'👁️',name:'Přesné oko',    desc:'Dostřel +100, dmg +15%'},
      {id:'arc_a4',tier:4,emoji:'🏹',name:'Salva smrti',   desc:'[R] Vypal 6 šípů najednou',abilId:'ult_arc_a'},
    ]},
    B:{name:'Lapač větru',col:'#22d3ee',skills:[
      {id:'arc_b1',tier:1,emoji:'⚡',name:'Rychlé reflexy',desc:'Dodge CD −2s'},
      {id:'arc_b2',tier:2,emoji:'💨',name:'Vzdušný krok',  desc:'Rychlost pohybu +15%'},
      {id:'arc_b3',tier:3,emoji:'🌪️',name:'Vítr pod nohama',desc:'Dodge vzdálenost ×1.5, invulnerabilita +0.3s'},
      {id:'arc_b4',tier:4,emoji:'🌀',name:'Stínový skok',  desc:'[R] Teleport + okamžitá salva',abilId:'ult_arc_b'},
    ]},
    C:{name:'Lovčí',col:'#a3e635',skills:[
      {id:'arc_c1',tier:1,emoji:'🪤',name:'Medvědí past',   desc:'Polož past: uvězní zombíka 3s + krvácení 5/s'},
      {id:'arc_c2',tier:2,emoji:'🐺',name:'Věrný společník',desc:'Vyvolá bojového vlka s vlastním HP'},
      {id:'arc_c3',tier:3,emoji:'🥩',name:'Otrávené maso',  desc:'Hodí návnadu – přiláká a otráví zombíky'},
      {id:'arc_c4',tier:4,emoji:'🐾',name:'Pán šelem',      desc:'[R] Vyvolá smečku 5 vlků na 15s',abilId:'ult_arc_c'},
    ]},
  },
  mage:{
    A:{name:'Ohnivý',col:'#f97316',skills:[
      {id:'mag_a1',tier:1,emoji:'🔥',name:'Hořlavá krev',      desc:'Fireball dmg +30%'},
      {id:'mag_a2',tier:2,emoji:'🌡️',name:'Zápalné dotky',    desc:'Melee zapálí zombie: 5 dmg/s po 3s'},
      {id:'mag_a3',tier:3,emoji:'🌋',name:'Eruption',          desc:'Nova poloměr +50, dmg +20%'},
      {id:'mag_a4',tier:4,emoji:'☄️',name:'Apokalyptický oheň',desc:'[R] 3 ohnivé koule v rozptylu',abilId:'ult_mag_a'},
    ]},
    B:{name:'Arcanista',col:'#818cf8',skills:[
      {id:'mag_b1',tier:1,emoji:'📚',name:'Mystická inteligence',desc:'Efekt INT o +20% silnější'},
      {id:'mag_b2',tier:2,emoji:'⚗️',name:'Zpětná energie',    desc:'Kill kouzlem: +5 HP'},
      {id:'mag_b3',tier:3,emoji:'🌀',name:'Telekineze',         desc:'Blink CD −3s'},
      {id:'mag_b4',tier:4,emoji:'⏳',name:'Zastavení času',    desc:'[R] Zombie −80% rychlost na 4s',abilId:'ult_mag_b'},
    ]},
    C:{name:'Nekromant',col:'#6b21a8',skills:[
      {id:'mag_c1',tier:1,emoji:'🩸',name:'Vysátí duše',    desc:'Kill kouzlem: obnov 10% HP cíle jako léčení'},
      {id:'mag_c2',tier:2,emoji:'💀',name:'Oživení mrtvých',desc:'Po zabití 5 zombie: vyvolá 3 kostlivce na 20s'},
      {id:'mag_c3',tier:3,emoji:'☠️',name:'Kletba rozkladu', desc:'Vyvrhni kletbu: zombie v oblasti +25% dmg ze všech zdrojů'},
      {id:'mag_c4',tier:4,emoji:'👑',name:'Armáda stínů',   desc:'[R] Oživí ducha bosse na 10s na tvé straně',abilId:'ult_mag_c'},
    ]},
  },
  militant:{
    A:{name:'Těžkozbrojný',col:'#f59e0b',skills:[
      {id:'mil_a1',tier:1,emoji:'🎯',name:'Přesná muška',    desc:'Rozptyl střel −30%'},
      {id:'mil_a2',tier:2,emoji:'💣',name:'Bojový řev',      desc:'Granát dmg +50%'},
      {id:'mil_a3',tier:3,emoji:'💥',name:'Výbušný expert', desc:'Granát radius +40, AoE +20%'},
      {id:'mil_a4',tier:4,emoji:'🚀',name:'Raketomet',       desc:'[R] 3 granáty v rozptylu',abilId:'ult_mil_a'},
    ]},
    B:{name:'Taktik',col:'#78716c',skills:[
      {id:'mil_b1',tier:1,emoji:'📋',name:'Taktická příprava',desc:'Suppression +2s, radius +50'},
      {id:'mil_b2',tier:2,emoji:'🪵',name:'Smrt z úkrytu',  desc:'U barikády: střely +25% dmg'},
      {id:'mil_b3',tier:3,emoji:'🔫',name:'Koordinovaný útok',desc:'Tvé věže střílí 50% rychleji'},
      {id:'mil_b4',tier:4,emoji:'✈️',name:'Letecký úder',    desc:'[R] 5× exploze na kurzoru',abilId:'ult_mil_b'},
    ]},
    C:{name:'Demoexpert',col:'#dc2626',skills:[
      {id:'mil_c1',tier:1,emoji:'💥',name:'Tříštivý granát', desc:'Rychlý granát: krátký CD, velký AoE radius'},
      {id:'mil_c2',tier:2,emoji:'🧨',name:'C4 výbušnina',    desc:'Polož C4 na zem, odpálit stisknutím [F]'},
      {id:'mil_c3',tier:3,emoji:'🚀',name:'Raketomet',       desc:'Každý 5. výstřel = naváděná raketa s AoE'},
      {id:'mil_c4',tier:4,emoji:'✈️',name:'Kobercový nálet', desc:'[R] Bombardér smaže horizontální pruh mapy',abilId:'ult_mil_c'},
    ]},
  },
  tank:{
    A:{name:'Pevnost',col:'#64748b',skills:[
      {id:'tan_a1',tier:1,emoji:'🪖',name:'Pancéřová kůže', desc:'Přijímaný dmg −15%'},
      {id:'tan_a2',tier:2,emoji:'🧱',name:'Silná zeď',      desc:'Tvé stavby mají +50% max HP'},
      {id:'tan_a3',tier:3,emoji:'💢',name:'Poslední odpor', desc:'Pod 30% HP: +40% dmg'},
      {id:'tan_a4',tier:4,emoji:'🗡️',name:'Nezranitelný',  desc:'[R] 5s imunita + taunt všech zombie',abilId:'ult_tan_a'},
    ]},
    B:{name:'Trestání',col:'#dc2626',skills:[
      {id:'tan_b1',tier:1,emoji:'🌵',name:'Trní kůže',      desc:'Útočníci obdrží 5 zpětného dmg'},
      {id:'tan_b2',tier:2,emoji:'🌍',name:'Zemětřesení',    desc:'Taunt zpomalí zombie −40%'},
      {id:'tan_b3',tier:3,emoji:'📣',name:'Bojový výkřik',  desc:'Fortify také uzdraví 30 HP'},
      {id:'tan_b4',tier:4,emoji:'⚡',name:'Šok',            desc:'[R] Výbuch: stun + 100 dmg v okolí',abilId:'ult_tan_b'},
    ]},
    C:{name:'Paladin',col:'#f59e0b',skills:[
      {id:'tan_c1',tier:1,emoji:'💢',name:'Drtivý dopad',     desc:'Pohyb: rázová vlna zraní okolní zombie'},
      {id:'tan_c2',tier:2,emoji:'🧲',name:'Magnetický štít',  desc:'Větší radius přitahování pozornosti (aggro)'},
      {id:'tan_c3',tier:3,emoji:'⚡',name:'Kinetický převodník',desc:'10% blokovaného dmg → +1 HP pro okolní spojence'},
      {id:'tan_c4',tier:4,emoji:'⬛',name:'Vůle titána',     desc:'[R] 5s: dvojnásobná velikost, plné HP, drtí vše',abilId:'ult_tan_c'},
    ]},
  },
  rogue:{
    A:{name:'Stín',col:'#a855f7',skills:[
      {id:'rog_a1',tier:1,emoji:'🗡️',name:'Přesná bodnutí', desc:'Každý 5. úder = 2× dmg'},
      {id:'rog_a2',tier:2,emoji:'👻',name:'Výpad z tmy',    desc:'Backstab dmg 5× (místo 3×)'},
      {id:'rog_a3',tier:3,emoji:'💃',name:'Stínový tanec',  desc:'Po Backstabu: rychlost +30% na 2s'},
      {id:'rog_a4',tier:4,emoji:'🌑',name:'Legie stínů',    desc:'[R] Stealth + 5× backstab na 5s',abilId:'ult_rog_a'},
    ]},
    B:{name:'Jed',col:'#16a34a',skills:[
      {id:'rog_b1',tier:1,emoji:'🐍',name:'Jedovatá čepel', desc:'Zásahy otrávají: 3 dmg/s po 4s'},
      {id:'rog_b2',tier:2,emoji:'💀',name:'Smrtelný jed',   desc:'Jed způsobuje +50% dmg'},
      {id:'rog_b3',tier:3,emoji:'🔽',name:'Průbojný jed',   desc:'Otrávené zombie pohyb −20%'},
      {id:'rog_b4',tier:4,emoji:'🌫️',name:'Jedová mlha',   desc:'[R] Otráví vše v okolí na 6s',abilId:'ult_rog_b'},
    ]},
    C:{name:'Sabotér',col:'#fbbf24',skills:[
      {id:'rog_c1',tier:1,emoji:'💰',name:'Kapsář',          desc:'5% šance získat +5 coinů při každém útoku'},
      {id:'rog_c2',tier:2,emoji:'🛒',name:'Mrštné prsty',    desc:'Otevření obchodu → 2s štít'},
      {id:'rog_c3',tier:3,emoji:'📦',name:'Černý trh',       desc:'Aktivuj pro náhodnou bednu (léčení / buffy)'},
      {id:'rog_c4',tier:4,emoji:'🎰',name:'Jackpot',         desc:'[R] 10s: 100% krit + 5× loot ze zombie',abilId:'ult_rog_c'},
    ]},
  },
  engineer:{
    A:{name:'Architekt',col:'#0ea5e9',skills:[
      {id:'eng_a1',tier:1,emoji:'💡',name:'Efektivní stavba',desc:'Obchod: stavby −20% coinů'},
      {id:'eng_a2',tier:2,emoji:'🔩',name:'Zocelené věže',  desc:'Věže +100% HP a +15 dmg'},
      {id:'eng_a3',tier:3,emoji:'🚀',name:'Super věž',      desc:'Věže střílí 2× rychleji'},
      {id:'eng_a4',tier:4,emoji:'🤖',name:'Automatická obrana',desc:'[R] Postav 2 věže poblíž',abilId:'ult_eng_a'},
    ]},
    B:{name:'Podpůrný',col:'#06b6d4',skills:[
      {id:'eng_b1',tier:1,emoji:'⚡',name:'Rychlé ruce',      desc:'Repair CD −3s, léčí 2× více'},
      {id:'eng_b2',tier:2,emoji:'📦',name:'Munice z vzduchu',desc:'Na začátku vlny: +3 zdi, +2 barikády'},
      {id:'eng_b3',tier:3,emoji:'🔧',name:'Nouzové zásoby',  desc:'Zničené stavby se obnoví na 30% HP'},
      {id:'eng_b4',tier:4,emoji:'📫',name:'Zásobovací drop', desc:'[R] Zásoby: +2 věže, +5 zdí, +3 barikády',abilId:'ult_eng_b'},
    ]},
    C:{name:'Chemik',col:'#22c55e',skills:[
      {id:'eng_c1',tier:1,emoji:'🧪',name:'Kyselinová louže',desc:'Výstřel kanystr – louže leptá zombie 15/s po 3s'},
      {id:'eng_c2',tier:2,emoji:'❄️',name:'Dusíkový mrazák', desc:'Speciální věž: mrazí okolí −40% rychlost (bez dmg)'},
      {id:'eng_c3',tier:3,emoji:'💉',name:'Mutagenní injekce',desc:'Ztrať 10% HP: +50% rychlost a síla na 8s'},
      {id:'eng_c4',tier:4,emoji:'☢️',name:'Zamoření',         desc:'[R] Toxický barel: masivní AoE + DoT na 8s',abilId:'ult_eng_c'},
    ]},
  },
  priest:{
    A:{name:'Světlo',col:'#fde68a',skills:[
      {id:'pri_a1',tier:1,emoji:'✨',name:'Posvátný oheň',  desc:'Melee: +5 splash dmg v okolí'},
      {id:'pri_a2',tier:2,emoji:'💚',name:'Silné léčení',   desc:'Heal +50% HP, léčí i spoluhráče'},
      {id:'pri_a3',tier:3,emoji:'🌟',name:'Vzkříšení',      desc:'Jednorázové auto-vzkříšení na 40% HP'},
      {id:'pri_a4',tier:4,emoji:'⚡',name:'Boží hněv',      desc:'[R] Smite: 80 dmg + stun všem zombie',abilId:'ult_pri_a'},
    ]},
    B:{name:'Požehnání',col:'#fbbf24',skills:[
      {id:'pri_b1',tier:1,emoji:'🙏',name:'Trvalé požehnání',desc:'Bless trvá +3s'},
      {id:'pri_b2',tier:2,emoji:'👥',name:'Masové požehnání',desc:'Bless ovlivní i ostatní hráče'},
      {id:'pri_b3',tier:3,emoji:'🕊️',name:'Nesmrtelný duch', desc:'Mimo boj 3s+: +2 HP/s regenerace'},
      {id:'pri_b4',tier:4,emoji:'🌈',name:'Žehnající aura',  desc:'[R] 8s: požehnání pro všechny + základ regen',abilId:'ult_pri_b'},
    ]},
    C:{name:'Okultista',col:'#7c3aed',skills:[
      {id:'pri_c1',tier:1,emoji:'🩸',name:'Krvavá oběť',     desc:'Schopnosti stojí 10 HP, ale jsou 50% silnější'},
      {id:'pri_c2',tier:2,emoji:'👁️',name:'Vysátí esence',   desc:'+1 max HP za každého zabitého zombie v blízkosti'},
      {id:'pri_c3',tier:3,emoji:'🔁',name:'Sdílené utrpení',  desc:'50% obdrženého dmg → nepřátelé v okolí 100px'},
      {id:'pri_c4',tier:4,emoji:'🌑',name:'Avatar Smrti',     desc:'[R] 8s: dotyk vysává životy, léčí celý tým',abilId:'ult_pri_c'},
    ]},
  },
};

/* ── Abilities ───────────────────────────────────────────── */
const ABIL={
  slash:      {name:'Seknutí',       emoji:'⚔️', cd:3000,  key:'Q', desc:'Silný obloukový švih před tebou — poškodí všechny zombie ve výseči 110px.'},
  rage:       {name:'Vztek',         emoji:'😡', cd:15000, key:'E', desc:'Na 5s získáš +50% dmg a odolnost vůči zpomalení. Strom A2 prodlouží na 8s a +70%.'},
  multishot:  {name:'Salva',         emoji:'🏹', cd:4000,  key:'Q', desc:'Vystřelíš 3 šípy najednou do wachýře 18°. Každý šíp způsobuje plné poškození.'},
  dodge:      {name:'Úskok',         emoji:'💨', cd:6000,  key:'E', desc:'Rychlý dash 200px ve směru míření. Po dashi jsi 0,5s nezasažitelný.'},
  fireball:   {name:'Ohnivá kule',   emoji:'🔥', cd:3500,  key:'Q', desc:'Vystřelí ohnivý projektil, který při zásahu způsobí výbuch a zapálí zombie na 3s.'},
  blink:      {name:'Teleport',      emoji:'✨', cd:8000,  key:'E', desc:'Okamžitě se přesuneš na pozici myši. Na cílové pozici zanecháš magický výbuch.'},
  nova:       {name:'Nova',          emoji:'💫', cd:12000, key:'R', desc:'Uvolníš kruhovou vlnu magické energie (160px). Poškození závisí na Inteligenci.'},
  grenade:    {name:'Granát',        emoji:'💣', cd:5000,  key:'Q', desc:'Hodíš granát ve směru míření — exploduje při zásahu nebo dosažení max. vzdálenosti.'},
  suppression:{name:'Potlačení',     emoji:'🎯', cd:10000, key:'E', desc:'Zpomalíš a zastavíš zombie v oblasti 250px na 3s. Strom B1 zvětší účinek.'},
  taunt:      {name:'Provokace',     emoji:'😤', cd:8000,  key:'Q', desc:'Přitáhneš všechny zombie v 350px k sobě. Zombie na tebe zaútočí místo základny.'},
  fortify:    {name:'Opevnění',      emoji:'🛡️', cd:12000, key:'E', desc:'Na 4s snížíš obdržené poškození o 50%. Strom B2: po uplynutí +40% dmg na 3s.'},
  stealth:    {name:'Neviditelnost', emoji:'👻', cd:10000, key:'Q', desc:'Na 4s tě zombie přestanou vidět a útočit na tebe. Při pohybu jsi o 25% rychlejší. První útok po stealth je vždy kritický.'},
  backstab:   {name:'Bod ze zadu',   emoji:'🗡️', cd:6000,  key:'E', desc:'Příští útok způsobí 3× poškození. Strom A3: po aktivaci dostaneš 2s neviditelnosti.'},
  deploy:     {name:'Věž',           emoji:'🔫', cd:15000, key:'Q', desc:'Postavíš automatickou obrannou věž, která střílí na nejbližší zombie v dosahu 200px.'},
  repair:     {name:'Oprava',        emoji:'🔧', cd:6000,  key:'E', desc:'Opravíš všechny struktury do 120px o 40 HP. Strom B1 zvýší opravu na 80 HP.'},
  heal:       {name:'Léčení',        emoji:'💚', cd:6000,  key:'Q', desc:'Vyléčíš sebe a spoluhráče do 120px o 60 HP. Strom A2 zvýší léčení na 90 HP.'},
  bless:      {name:'Požehnání',     emoji:'✨', cd:14000, key:'E', desc:'Na 14s dostaneš (a okolní hráči) +20% poškození. Strom B2 přidá všechny hráče.'},
  ult_war_a:  {name:'Berserk',       emoji:'💀', cd:30000, key:'R', desc:'8s: +100% poškození, +30% rychlost, nezastavitelný vztek. Resetuje cooldown Vzteku.'},
  ult_war_b:  {name:'Nepřemožitelný',emoji:'🗿', cd:30000, key:'R', desc:'3s plná imunita + ochromíš všechny zombie do 220px na 2s.'},
  ult_arc_a:  {name:'Salva smrti',   emoji:'🏹', cd:20000, key:'R', desc:'Vypálíš 6 šípů najednou do širokého wachýře. Ničivá plošná palba.'},
  ult_arc_b:  {name:'Stínový skok',  emoji:'🌀', cd:20000, key:'R', desc:'Teleportuješ se na kurzor a okamžitě vypálíš 4 šípy ve výseči. Skok+salva.'},
  ult_mag_a:  {name:'Apokal. oheň',  emoji:'☄️', cd:25000, key:'R', desc:'Vypálíš 3 ohnivé kule najednou do wachýře. Každá exploduje a zapaluje zombie.'},
  ult_mag_b:  {name:'Zastavení času',emoji:'⏳', cd:25000, key:'R', desc:'Všechny zombie na mapě jsou na 4s zmraženy na místě. Využij čas k útoku.'},
  ult_mil_a:  {name:'Raketomet',     emoji:'🚀', cd:20000, key:'R', desc:'Odpálíš 3 rakety do výseče. Každá způsobí velký výbuch v místě dopadu.'},
  ult_mil_b:  {name:'Letecký úder',  emoji:'✈️', cd:30000, key:'R', desc:'Na cílovou pozici zavoláš 5 leteckých bomb s malým zpožděním. Masivní poškození.'},
  ult_tan_a:  {name:'Nezranitelný',  emoji:'🗡️', cd:30000, key:'R', desc:'5s plná imunita + provokuješ všechny zombie na mapě k útoku na tebe.'},
  ult_tan_b:  {name:'Šok',           emoji:'⚡', cd:20000, key:'R', desc:'Výbuch 220px: 100 dmg + všechny zombie v oblasti ochromeny na 3s.'},
  ult_rog_a:  {name:'Legie stínů',   emoji:'🌑', cd:25000, key:'R', desc:'5s neviditelnosti + příštích 5 útoků jsou automaticky kritické (Bod ze zadu ×5).'},
  ult_rog_b:  {name:'Jedová mlha',   emoji:'🌫️', cd:20000, key:'R', desc:'Zombie do 200px od tebe otrávíš na 6s (5 dmg/s). Strom B2 zvýší jed na 7,5/s.'},
  ult_eng_a:  {name:'Auto obrana',   emoji:'🤖', cd:25000, key:'R', desc:'Okamžitě postavíš 2 automatické věže kolem sebe. Rychlé vybudování obrany.'},
  ult_eng_b:  {name:'Zásoby',        emoji:'📫', cd:20000, key:'R', desc:'Z nebe dopadnou zásoby: +2 věže, +5 zdí, +3 barikády do inventáře.'},
  ult_pri_a:  {name:'Boží hněv',     emoji:'⚡', cd:30000, key:'R', desc:'Všechny zombie na mapě dostanou 80 dmg a jsou ochromeny na 2,5s.'},
  ult_pri_b:  {name:'Žehnající aura',emoji:'🌈', cd:25000, key:'R', desc:'8s požehnání pro celý tým (+20% dmg) + základna se léčí po dobu trvání.'},
  ult_war_c:  {name:'Nesm. legie',   emoji:'🌟', cd:45000, key:'R', desc:'5s nezranitelnost + všechny zombie kolem jsou ochromeny. Výkřik pohltí nepřátele.'},
  ult_arc_c:  {name:'Pán šelem',     emoji:'🐾', cd:30000, key:'R', desc:'Přivoláš 5 věrných vlků na 15s. Vlci automaticky útočí na nejbližší zombie.'},
  ult_mag_c:  {name:'Armáda stínů',  emoji:'👑', cd:40000, key:'R', desc:'Přivoláš mocného Ducha Bosse na 10s — útočí na zombie za tebe (80 dmg/útok).'},
  ult_mil_c:  {name:'Kobercový nálet',emoji:'✈️',cd:35000, key:'R', desc:'Letecký koberec bomb pokryje horizontální pruh mapy v místě myši.'},
  ult_tan_c:  {name:'Vůle titána',   emoji:'⬛', cd:35000, key:'R', desc:'5s nezranitelnost a plné doplnění HP. Titan se nedá zastavit.'},
  ult_rog_c:  {name:'Jackpot',       emoji:'🎰', cd:30000, key:'R', desc:'10s: každý kill = 5× víc coinů + každý útok kriticky zasáhne.'},
  ult_eng_c:  {name:'Zamoření',      emoji:'☢️', cd:40000, key:'R', desc:'Velký výbuch + toxická zóna 200px na 8s. Zombie uvnitř zóny dostávají DoT.'},
  ult_pri_c:  {name:'Avatar Smrti',  emoji:'🌑', cd:35000, key:'R', desc:'8s: každý dotyk vysává životy z okolních zombie. Čím víc jich je, tím víc léčí.'},
};

/* ── Ability effects ─────────────────────────────────────── */
function useAbility(aId,player){
  const now=performance.now();
  if(player.abilCds[aId]&&now-player.abilCds[aId]<getAbilCd(aId))return;
  // Priest C1: HP cost 10% for any ability
  if(player.uid===me.uid&&hasSkill('pri_c1')&&me.hp>me.maxHp*0.1){
    me.hp=Math.max(1,me.hp-Math.round(me.maxHp*0.10));
  }
  player.abilCds[aId]=now;
  switch(aId){
    case 'slash':    meleeAOE(player,110,2.2,1.5); break;
    case 'rage':     {const rd=hasSkill('war_a2')?8000:5000;player.eff.rage={end:now+rd};gToast(`😡 Vztek! +${hasSkill('war_a2')?70:50}% DMG na ${rd/1000}s`,'#ef4444');} break;
    case 'multishot':shootMulti(player,3,0.18); break;
    case 'dodge':    {const ddist=hasSkill('arc_b3')?300:200;const ddur=hasSkill('arc_b3')?1100:800;player.eff.dodge={end:now+ddur,dx:player.aimDx*ddist,dy:player.aimDy*ddist};} break;
    case 'fireball': spawnProjectile(player,player.aimDx,player.aimDy,'fireball'); break;
    case 'blink':    blinkToMouse(player); break;
    case 'nova':     novaAOE(player,160,getStatMult(player,'int')*60); break;
    case 'grenade':  throwGrenade(player); break;
    case 'suppression':suppressAOE(player,hasSkill('mil_b1')?300:250,hasSkill('mil_b1')?5000:3000); break;
    case 'taunt':    tauntAOE(player,350); break;
    case 'fortify':  player.eff.fortify={end:now+4000};if(hasSkill('war_b2')&&player.uid===me.uid)player.eff.postFortify={end:now+7000};if(hasSkill('tan_b3')&&player.uid===me.uid){player.hp=Math.min(player.maxHp,player.hp+30);gToast('📣 Fortify! +30 HP','#64748b');}else{gToast('🛡️ Opevnění! −50% dmg na 4s','#64748b');} break;
    case 'stealth':  player.eff.stealth={end:now+4000};player.eff.postStealthCrit=false;gToast('👻 Neviditelnost 4s — první útok = krit!','#a855f7'); break;
    case 'backstab': player.eff.backstab={hits:1};gToast('🗡️ Příští útok = 3× dmg!','#a855f7'); break;
    case 'deploy':   deployTurret(player); break;
    case 'repair':   repairNearby(player,120,hasSkill('eng_b1')?80:40); break;
    case 'heal':     healNearby(player,120,Math.round(60*(hasSkill('pri_a2')?1.5:1)),hasSkill('pri_a2')); break;
    case 'bless':    blessNearby(player,200,hasSkill('pri_b1')?17000:14000,hasSkill('pri_b2')); break;
    // ── Ultimates ───────────────────────────────────────
    case 'ult_war_a': player.eff.rage={end:now+8000};player.eff.ultBerserk={end:now+8000};gToast('💀 BERSERK! 8s +100%dmg +30%spd','#ef4444'); break;
    case 'ult_war_b': player.eff.immune={end:now+3000};gs.zombies.forEach(z=>{if(Math.hypot(z.x-player.x,z.y-player.y)<220){z.stunEnd=now+2000;}});gToast('🗿 Nepřemožitelný! 3s imunita','#94a3b8'); break;
    case 'ult_arc_a': shootMulti(player,6,0.28); gToast('🏹 Salva smrti!','#84cc16'); break;
    case 'ult_arc_b': blinkToMouse(player); shootMulti(player,4,0.2); gToast('🌀 Stínový skok!','#22d3ee'); break;
    case 'ult_mag_a': for(let _i=0;_i<3;_i++){const _a=player.angle+(_i-1)*0.4;spawnProjectile(player,Math.cos(_a),Math.sin(_a),'fireball');} gToast('☄️ Apokalyptický oheň!','#f97316'); break;
    case 'ult_mag_b': gs.zombies.forEach(z=>{z.suppressed=now+4000;});gToast('⏳ Čas se zastavil! 4s','#818cf8'); break;
    case 'ult_mil_a': {const _gDmg=hasSkill('mil_a2')?120:80;const _gR=hasSkill('mil_a3')?320:280;const _aoe=hasSkill('mil_a3')?96:80;for(let _i=0;_i<3;_i++){const _a=player.angle+(_i-1)*0.32;gs.bullets.push({x:player.x,y:player.y,dx:Math.cos(_a),dy:Math.sin(_a),spd:7,dmg:_gDmg,range:_gR,dist:0,col:'#f97316',r:6,owner:player.uid,type:'grenade',onHit:(bx,by)=>explosionAOE(bx,by,hasSkill('mil_a3')?140:100,_aoe)});}} gToast('🚀 Raketomet!','#f59e0b'); break;
    case 'ult_mil_b': for(let _i=0;_i<5;_i++) setTimeout(()=>explosionAOE(mouse.wx+(Math.random()*100-50),mouse.wy+(Math.random()*100-50),100,60),_i*180); gToast('✈️ Letecký úder!','#f59e0b'); break;
    case 'ult_tan_a': player.eff.immune={end:now+5000};tauntAOE(player,800);gToast('🗡️ Nezranitelný! 5s imunita','#64748b'); break;
    case 'ult_tan_b': explosionAOE(player.x,player.y,220,100);gs.zombies.forEach(z=>{if(Math.hypot(z.x-player.x,z.y-player.y)<220)z.stunEnd=now+3000;});gToast('⚡ Šok!','#dc2626'); break;
    case 'ult_rog_a': player.eff.stealth={end:now+5000};player.eff.backstab={hits:5};gToast('🌑 Legie stínů! ×5 backstab','#a855f7'); break;
    case 'ult_rog_b': gs.zombies.forEach(z=>{if(Math.hypot(z.x-player.x,z.y-player.y)<200){z.poison={dmg:hasSkill('rog_b2')?7.5:5,end:now+6000,tick:0};}});gToast('🌫️ Jedová mlha!','#16a34a'); break;
    case 'ult_eng_a': {const _tHp=Math.round(STRUCT_DEFS.turret.hp*(hasSkill('eng_a2')?2:1));for(let _i=0;_i<2;_i++){const _sx=me.x+(Math.random()*140-70),_sy=me.y+(Math.random()*140-70);gs.structs.push({id:eid(),type:'turret',def:STRUCT_DEFS.turret,x:_sx-20,y:_sy-20,w:40,h:40,hp:_tHp,maxHp:_tHp,rot:0,lastShot:0,zombieHits:{},owner:me.uid});}updateInvDisplay();gToast('🤖 Automatická obrana!','#0ea5e9');} break;
    case 'ult_eng_b': me.inv.turret=(me.inv.turret||0)+2;me.inv.wall=(me.inv.wall||0)+5;me.inv.barricade=(me.inv.barricade||0)+3;updateInvDisplay();gToast('📫 Zásoby dopadly! +věže +zdi +barikády','#0ea5e9'); break;
    case 'ult_pri_a': gs.zombies.forEach((z,id)=>{dealDmg(id,z,80,player);z.stunEnd=now+2500;});gToast('⚡ Boží hněv!','#fde68a'); break;
    case 'ult_pri_b': {const _bd=hasSkill('pri_b1')?11000:8000;player.eff.bless={end:now+_bd};player.eff.ultBlessing={end:now+8000};gToast('🌈 Žehnající aura! 8s','#fbbf24');} break;
    // ── Branch C ────────────────────────────────────────────
    // Warrior C
    case 'war_c1': player.eff.warCry={end:now+5000};gToast('📣 Válečný pokřik! Tým +15% dmg 5s','#fbbf24'); break;
    case 'war_c3': gs.summons.push({type:'banner',x:player.x,y:player.y,end:now+20000,owner:player.uid}); gToast('🚩 Prapor naděje! Regen HP v okolí','#fbbf24'); break;
    case 'ult_war_c': player.eff.immune={end:now+5000};gToast('🌟 Nesmrtelná legie! 5s nezranitelnost','#fbbf24'); break;
    // Archer C
    case 'arc_c1': gs.summons.push({type:'trap',x:player.x+Math.cos(player.angle)*40,y:player.y+Math.sin(player.angle)*40,end:now+30000,triggered:false}); gToast('🪤 Past nastavena!','#a3e635'); break;
    case 'arc_c3': {const _lx=mouse.wx,_ly=mouse.wy;gs.summons.push({type:'lure',x:_lx,y:_ly,end:now+5000,poisoned:false});gToast('🥩 Návnada hozena!','#a3e635');} break;
    case 'ult_arc_c': for(let _w=0;_w<5;_w++)gs.summons.push({type:'wolf',x:player.x+(Math.random()*80-40),y:player.y+(Math.random()*80-40),hp:80,maxHp:80,end:now+15000,lastAtk:0}); gToast('🐾 Pán šelem! 5 vlků na 15s','#a3e635'); break;
    // Mage C
    case 'mag_c3': gs.summons.push({type:'curse_zone',x:mouse.wx,y:mouse.wy,end:now+8000,r:120}); gToast('☠️ Kletba rozkladu! +25% dmg ze všech zdrojů','#6b21a8'); break;
    case 'ult_mag_c': gs.summons.push({type:'ghost_boss',x:CX,y:CY,hp:500,maxHp:500,end:now+10000,lastAtk:0}); gToast('👑 Armáda stínů! Duch Bosse bojuje za tebe 10s','#6b21a8'); break;
    // Militant C
    case 'mil_c1': throwGrenade(player,true); gToast('💥 Tříštivý granát!','#dc2626'); break;
    case 'mil_c2': gs.summons.push({type:'c4',x:player.x,y:player.y,owner:player.uid}); gToast('🧨 C4 položeno — stiskni [F] pro odpálení','#dc2626'); break;
    case 'ult_mil_c': {const _cy=mouse.wy;for(let _i=0;_i<12;_i++)setTimeout(()=>explosionAOE(BARRIER.x+_i*(BARRIER.w/12),_cy,110,70),_i*80);gToast('✈️ Kobercový nálet!','#dc2626');} break;
    // Tank C
    case 'ult_tan_c': player.eff.titan={end:now+5000};player.hp=player.maxHp;gToast('⬛ Vůle titána! 5s – plné HP, drtíš vše','#f59e0b'); break;
    // Rogue C
    case 'rog_c3': {const _r=Math.random();if(_r<0.4){player.hp=Math.min(player.maxHp,player.hp+40);gToast('📦 Černý trh: +40 HP!','#fbbf24');}else if(_r<0.75){player.coins+=60;gToast('📦 Černý trh: +60 💰!','#fbbf24');}else{player.sp++;gToast('📦 Černý trh: +1 Skill Point!','#a78bfa');}updateHUD();} break;
    case 'ult_rog_c': player.eff.jackpot={end:now+10000};gToast('🎰 JACKPOT! 10s: 100% krit + 5× loot','#fbbf24'); break;
    // Engineer C
    case 'eng_c1': gs.summons.push({type:'acid_pool',x:mouse.wx,y:mouse.wy,end:now+3000,r:60,lastTick:0}); gToast('🧪 Kyselinová louže!','#22c55e'); break;
    case 'eng_c3': {const _hpCost=Math.max(5,Math.round(player.hp*0.10));player.hp=Math.max(1,player.hp-_hpCost);player.eff.mutagen={end:now+8000};gToast(`💉 Mutagen! −${_hpCost}HP → +50% rychlost+síla 8s`,'#22c55e');} break;
    case 'ult_eng_c': explosionAOE(mouse.wx,mouse.wy,200,80);gs.summons.push({type:'toxic_zone',x:mouse.wx,y:mouse.wy,end:now+8000,r:200,lastTick:0}); gToast('☢️ Zamoření! Toxická zóna 8s','#22c55e'); break;
    // Priest C
    case 'ult_pri_c': player.eff.avatarDeath={end:now+8000};gToast('🌑 Avatar Smrti! 8s – vysáváš životy','#7c3aed'); break;
  }
}

/* ── Game state ──────────────────────────────────────────── */
let gs={
  screen:'kit',         // kit|lobby|game|over
  phase:'build',        // build|wave
  wave:0, buildTimer:0,
  baseHp:500,baseMaxHp:500,
  zombies:new Map(),    // id→zombie
  bullets:[],
  structs:[],
  summons:[],           // wolves, traps, banners, acid pools, etc.
  floats:[],            // floating damage texts
  spawnedCount:0,waveTotal:0,
  mapId:0,
  sessionId:null,isHost:false,
  unsubLobby:null,unsubPlayers:null,
  players:{},           // uid→remotePlayerState
  startTime:0,
  difficulty:1,
  bossCount:0,
  wrongAnswers:0,       // stacks per wrong quiz answer, increases wave difficulty
  pendingLevelUp:false, // deferred until after quiz
};

/* ── Local player ────────────────────────────────────────── */
let me={
  uid:'local',name:'Hráč',kit:'warrior',
  x:CX,y:CY,angle:0,
  hp:80,maxHp:80,
  xp:0,xpNext:100,level:1,
  coins:100,
  hunger:100, thirst:100,
  _lastHungerWarn:0, _lastThirstWarn:0,
  stats:{str:0,int:0,agi:0,vit:0,cha:0,luk:0,dex:0,res:0,per:0},
  baseStats:{str:0,int:0,agi:0,vit:0,cha:0,luk:0,dex:0,res:0,per:0},
  weapon:'sword',
  lastShot:0,
  abilCds:{},
  eff:{},               // rage,dodge,stealth,etc
  inv:{wall:5,barricade:3,spikes:2,turret:0,platform:2},
  alive:true,
  respawnCost:50,
  totalKills:0,
  sp:0, skills:{}, unlockedAbils:[],
  _shotCount:0, lastDamageTs:0, usedRevive:false,
};

let cam={x:CX,y:CY};
let fovDeg=360; // always fullbright

/* ── Canvas ──────────────────────────────────────────────── */
let canvas,ctx,mmCanvas,mmCtx;
let W=0,H=0;

/* ── Input ───────────────────────────────────────────────── */
const keys={};
let mouse={x:0,y:0,wx:CX,wy:CY,down:false};

/* ── Placement ───────────────────────────────────────────── */
let placing={active:false,type:'wall',rot:0};

/* ── IDs ─────────────────────────────────────────────────── */
let _eid=1; const eid=()=>(_eid++).toString(36);

/* ── Kit select state ────────────────────────────────────── */
let kitSel={kit:'warrior',mapId:0,bonusStats:{str:0,int:0,agi:0,vit:0,cha:0,luk:0,dex:0,res:0,per:0},free:5};

/* ── RAF ─────────────────────────────────────────────────── */
let running=false,lastTs=0;

/* ── Deck / Quiz ─────────────────────────────────────────── */
let DECK_CARDS=[];
let QUIZ_USED=new Set();
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
auth.onAuthStateChanged(user=>{
  if(!user){window.location.href='index.html';return;}
  me.uid=user.uid;
  me.name=user.displayName||user.email?.split('@')[0]||'Hráč';

  canvas=document.getElementById('gc');
  ctx=canvas.getContext('2d');
  mmCanvas=document.getElementById('mmCanvas');
  mmCtx=mmCanvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize',resizeCanvas);
  buildKitScreen();
  loadDeckCards();

  const params=new URLSearchParams(location.search);
  const lobbyId=params.get('lobby');
  if(lobbyId){
    gs.sessionId=lobbyId;
    showScreen('lobby');
    joinLobby(lobbyId);
  } else {
    showScreen('kit');
  }

  document.getElementById('startBtn').onclick=startSolo;
  document.getElementById('overReplay').onclick=()=>location.reload();
  document.getElementById('overExit').onclick=()=>location.href='flashcards.html';
  document.getElementById('shopClose').onclick=()=>closeOv('shopOv');
  document.getElementById('stClose').onclick=()=>closeOv('skillTreeOv');
  document.getElementById('respawnBtn').onclick=doRespawn;
  document.getElementById('luConfirm').onclick=confirmLevelUp;
  document.getElementById('lobbyLeaveBtn').onclick=()=>{location.href='flashcards.html';};
  document.getElementById('lobbyReadyBtn').onclick=setReady;
  document.getElementById('lobbyStartBtn').onclick=hostStartGame;
  setupInput();
});

function resizeCanvas(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
}

function showScreen(name){
  gs.screen=name;
  ['screenKit','screenLobby','screenGame','screenOver'].forEach(id=>{
    document.getElementById(id).classList.toggle('hidden',id!=='screen'+cap(name));
  });
  ['shopOv','levelUpOv','deathOv','quizOv'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}
const cap=s=>s[0].toUpperCase()+s.slice(1);
function openOv(id){document.getElementById(id).classList.remove('hidden');}
function closeOv(id){document.getElementById(id).classList.add('hidden');}

// ══════════════════════════════════════════════════════════
//  KIT SELECT SCREEN
// ══════════════════════════════════════════════════════════
function buildKitScreen(){
  // Map picker
  const mp=document.getElementById('mapPicker');
  MAPS.forEach(m=>{
    const c=document.createElement('div');
    c.className='map-card'+(m.id===0?' selected':'');
    c.textContent=m.name;
    c.onclick=()=>{
      kitSel.mapId=m.id;
      mp.querySelectorAll('.map-card').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
    };
    mp.appendChild(c);
  });

  // Kit grid
  const kg=document.getElementById('kitGrid');
  Object.entries(KITS).forEach(([id,k])=>{
    const c=document.createElement('div');
    c.className='kit-card'+(id==='warrior'?' selected':'');
    c.style.setProperty('--kc',k.col);
    c.innerHTML=`<div class="kit-emoji">${k.emoji}</div><div class="kit-name">${k.name}</div><div class="kit-desc">${k.desc}</div><div class="kit-passive" style="font-size:.68rem;color:#94a3b8;margin-top:4px;line-height:1.3;">${k.passive||''}</div>`;
    c.onclick=()=>{
      kitSel.kit=id;
      kg.querySelectorAll('.kit-card').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      refreshStatRows();
    };
    kg.appendChild(c);
  });

  refreshStatRows();
  document.getElementById('resetStats').onclick=()=>{
    kitSel.bonusStats={str:0,int:0,agi:0,vit:0,cha:0,luk:0,dex:0,res:0,per:0};
    kitSel.free=5;
    refreshStatRows();
  };
}

function refreshStatRows(){
  const kit=KITS[kitSel.kit];
  const container=document.getElementById('statRows');
  container.innerHTML='';
  SDEFS_STATS.forEach(def=>{
    const base=kit.stats[def.k]||0;
    const bonus=kitSel.bonusStats[def.k]||0;
    const total=base+bonus;
    const MAX=10;
    const row=document.createElement('div');
    row.className='stat-row';
    row.innerHTML=`
      <span class="stat-label">${def.label}</span>
      <div class="stat-val-wrap">${Array.from({length:MAX},(_,i)=>`<div class="stat-dot${i<total?' filled':''}"></div>`).join('')}</div>
      <span style="width:22px;text-align:center;font-size:.78rem;color:#818cf8;">${total}</span>
      <button class="stat-btn" data-k="${def.k}" data-d="-1">−</button>
      <button class="stat-btn" data-k="${def.k}" data-d="1">+</button>
      <span style="font-size:.62rem;color:#555;margin-left:4px;">${def.desc}</span>`;
    container.appendChild(row);
  });
  document.getElementById('freePoints').textContent=kitSel.free;
  container.querySelectorAll('.stat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const k=btn.dataset.k,d=parseInt(btn.dataset.d);
      const cur=kitSel.bonusStats[k]||0;
      if(d>0&&kitSel.free<=0)return;
      if(d<0&&cur<=0)return;
      kitSel.bonusStats[k]=(cur+d);
      kitSel.free-=d;
      refreshStatRows();
    });
  });
}

// ══════════════════════════════════════════════════════════
//  GAME START
// ══════════════════════════════════════════════════════════
function startSolo(){
  applyKitSelection();
  initGame();
  showScreen('game');
  buildBuildBar();
  buildAbilBar();
  running=true;
  requestAnimationFrame(loop);
}

function applyKitSelection(){
  const kit=KITS[kitSel.kit];
  me.kit=kitSel.kit;
  me.weapon=kit.weapon;
  gs.mapId=kitSel.mapId;
  // merge base+bonus stats
  SDEFS_STATS.forEach(d=>{
    me.baseStats[d.k]=kit.stats[d.k]||0;
    me.stats[d.k]=(kit.stats[d.k]||0)+(kitSel.bonusStats[d.k]||0);
  });
  // fov bonus for archer + perception
  if(kitSel.kit==='archer') fovDeg=Math.min(360,fovDeg+20);
  me.maxHp=80+me.stats.vit*20;
  me.hp=me.maxHp;
  me.sp=0; me.skills={}; me.unlockedAbils=[]; me._shotCount=0; me.usedRevive=false;
  document.getElementById('kitLbl').textContent=kit.emoji+' '+kit.name;
}

function initGame(){
  me.x=CX; me.y=CY;
  gs.zombies.clear();
  gs.bullets=[];
  gs.structs=[];
  gs.summons=[];
  gs.floats=[];
  gs.wave=0; gs.phase='build'; gs.buildTimer=BUILD_DUR;
  gs.baseHp=500; gs.baseMaxHp=500;
  gs.spawnedCount=0; gs.waveTotal=0;
  gs.wrongAnswers=0; gs.pendingLevelUp=false;
  gs.farmPlots=[
    {x:CX-170,y:CY-170,state:'empty',growPhases:0},
    {x:CX+110,y:CY-170,state:'empty',growPhases:0},
    {x:CX-170,y:CY+110,state:'empty',growPhases:0},
    {x:CX+110,y:CY+110,state:'empty',growPhases:0},
  ];
  gs.well={x:CX+420,y:CY,charges:3,maxCharges:3};
  gs.startTime=performance.now();
  // Difficulty multiplier based on player count
  const pCount=Object.keys(gs.players).length+1;
  gs.difficulty=1+(pCount-1)*0.5;
  updateHUD();
}

function buildBuildBar(){
  const bar=document.getElementById('buildBar');
  bar.innerHTML='';
  Object.entries(STRUCT_DEFS).forEach(([type,def],i)=>{
    const btn=document.createElement('div');
    btn.className='bb-btn';
    btn.dataset.type=type;
    btn.innerHTML=`<span>${def.emoji}</span><span class="bb-cnt" id="inv_${type}">${me.inv[type]||0}</span><span class="bb-key">${i+1}</span>`;
    btn.title=`${def.name} (${def.cost}💰) — klávesa ${i+1}`;
    btn.onclick=()=>togglePlacing(type);
    bar.appendChild(btn);
  });
}
function updateInvDisplay(){
  Object.keys(STRUCT_DEFS).forEach(type=>{
    const el=document.getElementById('inv_'+type);
    if(el)el.textContent=me.inv[type]||0;
  });
}

function buildAbilBar(){
  const bar=document.getElementById('abilityBar');
  bar.innerHTML='';
  const kit=KITS[me.kit];
  const ph=document.getElementById('passiveHint');
  if(ph)ph.textContent=kit.passive||'';
  const abils=[...kit.abil,...(me.unlockedAbils||[])];
  abils.forEach((aId)=>{
    const a=ABIL[aId];
    if(!a)return;
    const btn=document.createElement('div');
    btn.className='ab-btn';
    btn.id='ab_'+aId;
    btn.innerHTML=`<span>${a.emoji}</span><span class="ab-key">${a.key}</span>`+
      `<div class="ab-tooltip"><strong>${a.emoji} ${a.name}</strong>${a.desc||''}<div class="ab-tip-cd">Cooldown: ${a.cd/1000}s</div></div>`;
    btn.onclick=()=>useAbility(aId,me);
    bar.appendChild(btn);
  });
}

function togglePlacing(type){
  if(placing.active&&placing.type===type){
    placing.active=false;
    document.getElementById('placInfo').style.display='none';
    document.querySelectorAll('.bb-btn').forEach(b=>b.classList.remove('active'));
  } else {
    placing.active=true;
    placing.type=type;
    placing.rot=0;
    document.querySelectorAll('.bb-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
    const d=STRUCT_DEFS[type];
    document.getElementById('placInfo').style.display='block';
    document.getElementById('placInfo').textContent=`Kladeš: ${d.emoji} ${d.name} · R = otoč · klik = položit · Esc = zrušit`;
  }
}

// ══════════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════════
function setupInput(){
  window.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(gs.screen!=='game')return;
    if(e.code==='KeyB'){toggleShop();}
    if(e.code==='KeyT'){toggleSkillTree();}
    if(e.code==='KeyF'){detonateC4();}
    if(e.code==='KeyG'){interactFarm();}
    if(e.code==='Escape'){
      if(placing.active){placing.active=false;document.getElementById('placInfo').style.display='none';document.querySelectorAll('.bb-btn').forEach(b=>b.classList.remove('active'));}
      else if(!document.getElementById('quizOv').classList.contains('hidden'))closeOv('quizOv');
      else if(!document.getElementById('skillTreeOv').classList.contains('hidden'))closeOv('skillTreeOv');
      else closeOv('shopOv');
    }
    if(e.code==='KeyR'&&placing.active){
      placing.rot=(placing.rot+90)%360;
    }
    // Build shortcuts 1-5
    const idx=parseInt(e.key)-1;
    if(idx>=0&&idx<5){
      const type=Object.keys(STRUCT_DEFS)[idx];
      if(type)togglePlacing(type);
    }
    // Abilities
    const kit=KITS[me.kit];
    if(kit){
      const amap={'KeyQ':kit.abil[0],'KeyE':kit.abil[1],'KeyR':kit.abil[2]};
      if(!placing.active&&amap[e.code])useAbility(amap[e.code],me);
    }
  });
  window.addEventListener('keyup',e=>{keys[e.code]=false;});
  canvas.addEventListener('mousemove',e=>{
    mouse.x=e.clientX; mouse.y=e.clientY;
    mouse.wx=cam.x+(e.clientX-W/2);
    mouse.wy=cam.y+(e.clientY-H/2);
    me.angle=Math.atan2(mouse.wy-me.y,mouse.wx-me.x);
    me.aimDx=Math.cos(me.angle); me.aimDy=Math.sin(me.angle);
  });
  canvas.addEventListener('mousedown',e=>{
    if(gs.screen!=='game')return;
    mouse.down=true;
    if(placing.active){placeStructure();return;}
    if(e.button===0&&me.alive)doShoot();
  });
  canvas.addEventListener('mouseup',()=>{mouse.down=false;});
}

// ══════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════
function loop(ts){
  if(!running){return;}
  const dt=Math.min((ts-lastTs)/1000,0.05);
  lastTs=ts;
  update(dt,ts);
  draw(ts);
  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════
//  UPDATE
// ══════════════════════════════════════════════════════════
function update(dt,ts){
  if(gs.phase==='build'){
    gs.buildTimer-=dt;
    if(gs.buildTimer<=0)startWave();
  } else {
    updateZombies(dt,ts);
    if(gs.spawnedCount<gs.waveTotal) spawnTick(ts);
    if(gs.zombies.size===0&&gs.spawnedCount>=gs.waveTotal)endWave();
    checkBaseHit(ts);
  }
  updatePlayer(dt,ts);
  updateBullets(dt);
  updateStructures(ts);
  updateFloats(dt);
  updateAbilityCooldowns(ts);
  updateEffects(dt,ts);
  updateSummons(dt,ts);
  syncState(ts);
  cam.x+=(me.x-cam.x)*0.12;
  cam.y+=(me.y-cam.y)*0.12;
  updateHUD();
  drawMinimap();
}

/* ── Player movement ─────────────────────────────────────── */
function updatePlayer(dt,ts){
  if(!me.alive)return;
  const kit=KITS[me.kit];
  const baseSpd=140+me.stats.agi*8;
  let spd=baseSpd*(me.kit==='tank'?0.72:1);
  if(hasSkill('arc_b2'))spd*=1.15;
  if(me.eff.shadowDance&&performance.now()<me.eff.shadowDance.end)spd*=1.3;
  if(me.eff.ultBerserk&&performance.now()<me.eff.ultBerserk.end)spd*=1.3;
  if(me.eff.mutagen&&ts<me.eff.mutagen.end)spd*=1.5;
  if(me.eff.stealth&&ts<me.eff.stealth.end)spd*=1.25;

  // ── Hunger / Thirst decay ──────────────────────────────────
  const hungerRate=gs.phase==='wave'?0.48:0.18;
  const thirstRate=gs.phase==='wave'?0.72:0.28;
  me.hunger=Math.max(0,me.hunger-hungerRate*dt);
  me.thirst=Math.max(0,me.thirst-thirstRate*dt);
  // Low warnings (throttled)
  if(me.hunger<25&&ts-me._lastHungerWarn>14000){me._lastHungerWarn=ts;gToast('🍖 Hlad! Sklidni políčko [G] nebo kup jídlo [B]','#f59e0b');}
  if(me.thirst<25&&ts-me._lastThirstWarn>10000){me._lastThirstWarn=ts;gToast('💧 Žízeň! Naber ze studny [G] nebo kup vodu [B]','#06b6d4');}
  // Speed penalties
  if(me.hunger<25)spd*=(1-(25-me.hunger)/25*0.18);
  if(me.thirst<25)spd*=(1-(25-me.thirst)/25*0.20);
  // Starvation / dehydration damage (can't kill, floor at 1)
  if(me.hunger===0)me.hp=Math.max(1,me.hp-1*dt);
  if(me.thirst===0)me.hp=Math.max(1,me.hp-2*dt);

  // Priest B3: passive HP regen outside combat
  if(hasSkill('pri_b3')&&me.alive&&performance.now()-me.lastDamageTs>3000){
    me.hp=Math.min(me.maxHp,me.hp+2*(1/60));
  }
  // Ult blessing: base HP regen
  if(me.eff.ultBlessing&&performance.now()<me.eff.ultBlessing.end){
    gs.baseHp=Math.min(gs.baseMaxHp,gs.baseHp+0.3);
  }

  // Dodge dash
  if(me.eff.dodge&&ts<me.eff.dodge.end){
    me.x+=me.eff.dodge.dx*dt;
    me.y+=me.eff.dodge.dy*dt;
    clampToBounds();
    return;
  }

  let dx=0,dy=0;
  if(keys['KeyW']||keys['ArrowUp'])   dy-=1;
  if(keys['KeyS']||keys['ArrowDown']) dy+=1;
  if(keys['KeyA']||keys['ArrowLeft']) dx-=1;
  if(keys['KeyD']||keys['ArrowRight'])dx+=1;
  if(dx||dy){const l=Math.hypot(dx,dy);dx/=l;dy/=l;}
  me.x+=dx*spd*dt;
  me.y+=dy*spd*dt;
  clampToBounds();
  wallCollide(me,PLAYER_R);

  // ── Kit passives ──────────────────────────────────────────
  // Warrior: Bojový rytmus — tracked via me._meleeHits (every 5th hit = ×2 bonus dmg, flag set in meleeHit)
  // Archer: Ostré oko — applied in getBulletDmg
  // Mage: Mana splurge — applied in killZombie
  // Militant: Výbušná duše — tracked via me._grenadeCount in throwGrenade
  // Tank: Pevný postoj — stání >1s gives +15% dmg reduction + 1HP/s
  if(me.kit==='tank'){
    if(!dx&&!dy){
      me._standingFor=(me._standingFor||0)+dt;
      if(me._standingFor>1){
        me.hp=Math.min(me.maxHp,me.hp+1*dt);
        me._tankStance=true;
      }
    } else {
      me._standingFor=0;
      me._tankStance=false;
    }
  }
  // Rogue passive is handled via stealth effect (speed+crit already applied above)
  // Engineer: Nouzová záplata — structs under 30% HP auto-repair 3 HP/s
  if(me.kit==='engineer'){
    gs.structs.forEach(s=>{if(s.hp>0&&s.hp<s.maxHp*0.3)s.hp=Math.min(s.maxHp,s.hp+3*dt);});
  }
  // Priest: Léčivá aura — 1 HP/s for self + nearby players
  if(me.kit==='priest'){
    me.hp=Math.min(me.maxHp,me.hp+1*dt);
    Object.values(gs.players).forEach(p=>{
      if(p.alive&&Math.hypot(p.x-me.x,p.y-me.y)<150)p.hp=Math.min(p.maxHp||100,(p.hp||0)+1*dt);
    });
  }

  // Titan: step damage to zombies within 60px
  if(me.eff.titan&&ts<me.eff.titan.end&&(dx||dy)){
    gs.zombies.forEach((z,id)=>{if(Math.hypot(z.x-me.x,z.y-me.y)<60)dealDmg(id,z,30*dt,me);});
  }
  // Avatar of Death: drain 3 HP/s per nearby zombie within 120px
  if(me.eff.avatarDeath&&ts<me.eff.avatarDeath.end){
    let count=0;
    gs.zombies.forEach(z=>{if(Math.hypot(z.x-me.x,z.y-me.y)<120)count++;});
    if(count>0)me.hp=Math.max(1,me.hp-3*count*dt);
  }
  // War_c2 Zastrašení: slow zombies within 150px by -20%
  if(hasSkill('war_c2')){
    gs.zombies.forEach(z=>{
      z._fearSlow=(Math.hypot(z.x-me.x,z.y-me.y)<150)?0.8:1;
    });
  }

  // Track whether player is elevated on a platform
  me.onPlatform=gs.structs.some(s=>s.hp>0&&STRUCT_DEFS[s.type].plat&&
    me.x>s.x&&me.x<s.x+s.w&&me.y>s.y&&me.y<s.y+s.h);

  // Auto-fire when holding mouse
  if(mouse.down&&me.alive&&!placing.active){doShoot();}
}

function clampToBounds(){
  me.x=Math.max(BARRIER.x+PLAYER_R,Math.min(BARRIER.x+BARRIER.w-PLAYER_R,me.x));
  me.y=Math.max(BARRIER.y+PLAYER_R,Math.min(BARRIER.y+BARRIER.h-PLAYER_R,me.y));
}

function collidesWithAnyWall(entity,r,walls){
  for(const w of walls){
    const nx=Math.max(w.x,Math.min(w.x+w.w,entity.x));
    const ny=Math.max(w.y,Math.min(w.y+w.h,entity.y));
    if(Math.hypot(entity.x-nx,entity.y-ny)<r)return true;
  }
  return false;
}

function zombieMoveSlide(z,vx,vy,walls){
  z.x+=vx;
  if(collidesWithAnyWall(z,z.r,walls))z.x-=vx;
  z.y+=vy;
  if(collidesWithAnyWall(z,z.r,walls))z.y-=vy;
}

function wallCollide(entity,r){
  const walls=getAllWalls();
  for(const w of walls){
    const nx=Math.max(w.x,Math.min(w.x+w.w,entity.x));
    const ny=Math.max(w.y,Math.min(w.y+w.h,entity.y));
    const dist=Math.hypot(entity.x-nx,entity.y-ny);
    if(dist<r){
      const push=r-dist+1;
      const ang=Math.atan2(entity.y-ny,entity.x-nx);
      entity.x+=Math.cos(ang)*push;
      entity.y+=Math.sin(ang)*push;
    }
  }
}

function getAllWalls(){
  const map=MAPS[gs.mapId];
  return [...map.walls,...gs.structs.filter(s=>s.hp>0&&STRUCT_DEFS[s.type].blocks)];
}
// Walls that stop bullets (barricade has blocksBullets:false → bullets pass through)
function getBulletWalls(){
  const map=MAPS[gs.mapId];
  return [...map.walls,...gs.structs.filter(s=>s.hp>0&&STRUCT_DEFS[s.type].blocksBullets)];
}
function getFovWalls(){
  const map=MAPS[gs.mapId];
  return [...map.walls,...gs.structs.filter(s=>s.hp>0&&STRUCT_DEFS[s.type].blocks)];
}

/* ── Shooting ────────────────────────────────────────────── */
function doShoot(){
  const now=performance.now();
  const w=WEAPONS[me.weapon];
  if(now-me.lastShot<w.cd)return;
  me.lastShot=now;
  if(w.melee){doMelee(me);return;}
  me._shotCount=(me._shotCount||0)+1;
  const critShot=hasSkill('arc_a1')&&me._shotCount%3===0;
  const pellets=w.pellets||1;
  const spreadMult=hasSkill('mil_a1')?0.7:1;
  for(let i=0;i<pellets;i++){
    const spread=(Math.random()-0.5)*w.spread*2*spreadMult;
    const ang=me.angle+spread;
    const b=spawnBullet(me.x,me.y,Math.cos(ang),Math.sin(ang),w,me);
    if(critShot)b.dmg=Math.round(b.dmg*2);
  }
}

function spawnBullet(x,y,dx,dy,weapon,owner){
  const elevated=owner.uid===me.uid?!!me.onPlatform:false;
  const isMe=owner.uid===me.uid;
  const extraRange=isMe&&hasSkill('arc_a3')?100:0;
  const perMult=isMe?(1+me.stats.per*0.05):1;
  const pierce=isMe&&hasSkill('arc_a2')&&(weapon.arrow||weapon===WEAPONS.rifle);
  const b={x,y,dx,dy,spd:weapon.spd||14,dmg:getBulletDmg(owner,weapon),
    range:(weapon.range+extraRange)*perMult,dist:0,col:weapon.col,r:weapon.arrow?5:3,
    owner:owner.uid,arrow:!!weapon.arrow,elevated,pierce};
  gs.bullets.push(b);
  return b;
}

function getBulletDmg(p,w){
  let d=w.dmg;
  const isMe=p.uid===me.uid;
  // Stat scaling: physical ranged uses STR, magic uses INT
  if(!w.melee){
    if(p.kit==='mage'||w.id==='staff'){
      const intMult=hasSkill('mag_b1')&&isMe?1.2:1;
      d*=(1+p.stats.int*0.08)*intMult;
    } else {
      d*=(1+p.stats.str*0.05);
    }
  }
  if(hasSkill('arc_a3')&&isMe) d*=1.15;
  // Archer passive: Ostré oko — 10% chance ×1.5 bonus dmg
  if(isMe&&p.kit==='archer'&&!w.melee&&Math.random()<0.10){d*=1.5;gs.floats.push({x:p.x,y:p.y-24,txt:'👁️',col:'#84cc16',life:0.6,dy:-30});}
  if(p.eff.ultBerserk&&performance.now()<p.eff.ultBerserk.end) d*=2.0;
  else if(p.eff.rage) d*=(hasSkill('war_a2')?1.7:1.5);
  if(p.eff.bless) d*=1.2;
  if(isMe&&p.eff.warCry&&performance.now()<p.eff.warCry.end)d*=1.15;
  if(isMe&&p.eff.mutagen&&performance.now()<p.eff.mutagen.end)d*=(1+p.stats.str*0.5*0.05);
  if(hasSkill('tan_a3')&&isMe&&p.hp<p.maxHp*0.3) d*=1.4;
  if(hasSkill('mil_b2')&&isMe){
    const nearB=gs.structs.some(s=>s.hp>0&&s.type==='barricade'&&Math.hypot(s.x+s.w/2-p.x,s.y+s.h/2-p.y)<80);
    if(nearB)d*=1.25;
  }
  // Stealth breaks on attack; first post-stealth attack is always crit
  if(isMe&&p.eff.stealth){delete p.eff.stealth;p.eff.postStealthCrit=true;}
  // Jackpot: 100% crit
  if(isMe&&p.eff.jackpot&&performance.now()<p.eff.jackpot.end){d*=2.0;}
  // Post-stealth guaranteed crit
  else if(isMe&&p.eff.postStealthCrit){d*=2.0;delete p.eff.postStealthCrit;gs.floats.push({x:p.x,y:p.y-30,txt:'STEALTH KRIT!',col:'#a855f7',life:1.0,dy:-45});}
  // Luck-based crit (base 5% + 2%/luk)
  else if(isMe){
    const critChance=0.05+0.02*(p.stats.luk||0);
    if(Math.random()<critChance){d*=2.0;gs.floats.push({x:p.x,y:p.y-30,txt:'KRIT!',col:'#fbbf24',life:0.9,dy:-45});}
  }
  return Math.round(d);
}

function doMelee(p){
  const w=WEAPONS[p.weapon];
  let dmg=w.dmg*(1+p.stats.str*0.05);
  if(p.eff.ultBerserk&&performance.now()<p.eff.ultBerserk.end) dmg*=2.0;
  else if(p.eff.rage) dmg*=(hasSkill('war_a2')?1.7:1.5);
  if(p.eff.bless) dmg*=1.2;
  if(p.uid===me.uid&&p.eff.warCry&&performance.now()<p.eff.warCry.end)dmg*=1.15;
  if(p.uid===me.uid&&p.eff.mutagen&&performance.now()<p.eff.mutagen.end)dmg*=(1+p.stats.str*0.5*0.05);
  // Stealth breaks on melee; post-stealth guaranteed crit
  if(p.uid===me.uid&&p.eff.stealth){delete p.eff.stealth;p.eff.postStealthCrit=true;}
  if(p.uid===me.uid&&p.eff.postStealthCrit){dmg*=2.0;delete p.eff.postStealthCrit;gs.floats.push({x:p.x,y:p.y-30,txt:'STEALTH KRIT!',col:'#a855f7',life:1.0,dy:-45});}
  // Luck crit (base 5% + 2%/luk); war_a1 adds +20% crit chance and boosts mult to ×2
  if(p.uid===me.uid){
    const critChance=(0.05+0.02*(p.stats.luk||0))+(hasSkill('war_a1')?0.20:0);
    if(Math.random()<critChance){
      dmg*=2.0;
      gs.floats.push({x:p.x,y:p.y-30,txt:'KRIT!',col:'#fbbf24',life:0.9,dy:-45});
    }
  }
  // Jackpot: always crit
  if(p.uid===me.uid&&p.eff.jackpot&&performance.now()<p.eff.jackpot.end) dmg*=2.0;
  if(hasSkill('war_b2')&&p.uid===me.uid&&p.eff.postFortify&&performance.now()<p.eff.postFortify.end) dmg*=1.4;
  if(hasSkill('tan_a3')&&p.uid===me.uid&&p.hp<p.maxHp*0.3) dmg*=1.4;
  if(hasSkill('rog_a1')&&p.uid===me.uid){p._meleeCount=(p._meleeCount||0)+1;if(p._meleeCount%5===0)dmg*=2;}
  const backstabMult=hasSkill('rog_a2')?5:3;
  if(p.eff.backstab){
    const hits=p.eff.backstab.hits||1;
    dmg*=backstabMult;
    hits<=1?delete p.eff.backstab:(p.eff.backstab.hits=hits-1);
    gToast(`💥 Kritický zásah! ×${backstabMult}`,'#a855f7');
    if(hasSkill('rog_a3')&&p.uid===me.uid) p.eff.shadowDance={end:performance.now()+2000};
  }
  meleeHit(p.x,p.y,p.angle,w.range,w.arc,Math.round(dmg),p);
  if(p.weapon==='wrench') repairNearby(p,w.range,hasSkill('eng_b1')?80:20);
}

function meleeHit(x,y,ang,range,arc,dmg,owner){
  const isMe=owner.uid===me.uid;
  gs.zombies.forEach((z,id)=>{
    const a=Math.atan2(z.y-y,z.x-x);
    const diff=Math.abs(normalizeAngle(a-ang));
    const dist=Math.hypot(z.x-x,z.y-y);
    if(diff<arc/2&&dist<range){
      // Warrior passive: Bojový rytmus — every 5th melee hit = ×2 dmg
      let finalDmg=dmg;
      if(isMe&&owner.kit==='warrior'){
        owner._warCombo=(owner._warCombo||0)+1;
        if(owner._warCombo>=5){owner._warCombo=0;finalDmg*=2;gs.floats.push({x:z.x,y:z.y-30,txt:'RYTMUS!',col:'#ef4444',life:0.9,dy:-50});}
      }
      dealDmg(id,z,finalDmg,owner);
      gs.floats.push({x:z.x,y:z.y-20,txt:`-${finalDmg}`,col:'#ef4444',life:1.2,dy:-40});
      // Mage A2: burning
      if(isMe&&hasSkill('mag_a2'))z.poison={dmg:5,end:performance.now()+3000,tick:0};
      // Rogue B1: poison
      if(isMe&&hasSkill('rog_b1'))z.poison={dmg:hasSkill('rog_b2')?4.5:3,end:performance.now()+4000,tick:0};
      // Rogue C1: 5% chance +5 coins on hit
      if(isMe&&hasSkill('rog_c1')&&Math.random()<0.05){me.coins+=5;gs.floats.push({x:me.x,y:me.y-30,txt:'+5🪙',col:'#fbbf24',life:0.8,dy:-35});}
      // Priest A1: splash
      if(isMe&&hasSkill('pri_a1')){
        gs.zombies.forEach((z2,id2)=>{
          if(id2!==id&&Math.hypot(z2.x-z.x,z2.y-z.y)<45)dealDmg(id2,z2,5,owner);
        });
      }
    }
  });
}

function meleeAOE(p,range,arc,mult){
  const w=WEAPONS[p.weapon];
  const dmg=Math.round(w.dmg*(1+p.stats.str*0.05)*mult);
  meleeHit(p.x,p.y,p.angle,range,arc,dmg,p);
}

/* ── Bullets ─────────────────────────────────────────────── */
function updateBullets(dt){
  const speed=60;
  gs.bullets=gs.bullets.filter(b=>{
    b.x+=b.dx*b.spd*speed*dt;
    b.y+=b.dy*b.spd*speed*dt;
    b.dist+=b.spd*speed*dt;
    if(b.dist>b.range)return false;
    // Wall collision — elevated bullets (from platform) ignore all walls
    if(!b.elevated){
      const walls=getBulletWalls();
      for(const w of walls){
        if(b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h)return false;
      }
    }
    // Zombie collision
    for(const [id,z] of gs.zombies){
      if(Math.hypot(b.x-z.x,b.y-z.y)<z.r+b.r){
        const owner=b.owner===me.uid?me:gs.players[b.owner];
        if(b.type==='fireball'||b.type==='grenade') z._killedBySpell=true;
        dealDmg(id,z,b.dmg,owner);
        gs.floats.push({x:z.x,y:z.y-20,txt:`-${b.dmg}`,col:'#fbbf24',life:1,dy:-35});
        if(b.pierce&&!b._pierced){b._pierced=true;continue;}
        return b.type==='fireball';
      }
    }
    return true;
  });
}

/* ── Damage ──────────────────────────────────────────────── */
function dealDmg(zid,z,dmg,attacker){
  if(z._cursed)dmg=Math.round(dmg*1.25);
  z.hp-=dmg;
  if(z.hp<=0){
    killZombie(zid,z,attacker);
  }
}

function killZombie(zid,z,attacker){
  gs.zombies.delete(zid);
  gs.spawnedCount>0; // already counted on spawn
  if(attacker&&attacker.uid===me.uid){
    // Luk: bonus coin chance (each luk point adds 5% chance of double coins)
    const coinBonus=(hasSkill('rog_c4_jackpot_active')||me.eff.jackpot&&performance.now()<me.eff.jackpot.end)?5:1;
    const lukBonus=Math.random()<(me.stats.luk||0)*0.05?2:1;
    const wrongPenalty=Math.max(0.30,1-gs.wrongAnswers*0.10);
    me.coins+=Math.round(z.def.coins*coinBonus*lukBonus*wrongPenalty);
    me.xp+=Math.round(z.def.xp*wrongPenalty);
    me.totalKills++;
    checkLevelUp();
    syncPlayerState();
    // Mag C2: summon 3 skeletons (ghost_boss proxies) every 5 kills
    if(hasSkill('mag_c2')&&me.totalKills%5===0){
      for(let _s=0;_s<3;_s++)gs.summons.push({type:'ghost_boss',x:me.x+(Math.random()*80-40),y:me.y+(Math.random()*80-40),hp:120,maxHp:120,end:performance.now()+20000,lastAtk:0});
      gToast('💀 3 kostlivci povolání!','#7c3aed');
    }
    // War A3: melee kill heals
    if(hasSkill('war_a3')&&WEAPONS[me.weapon]?.melee) me.hp=Math.min(me.maxHp,me.hp+15);
    // Mag B2: spell kill heals
    if(hasSkill('mag_b2')&&z._killedBySpell) me.hp=Math.min(me.maxHp,me.hp+5);
    // Priest C2: Vysátí esence — +1 max HP per nearby kill
    if(hasSkill('pri_c2')&&Math.hypot(z.x-me.x,z.y-me.y)<120){me.maxHp++;me.hp=Math.min(me.maxHp,me.hp+1);}
    // Mage C1: Vysátí duše — lifesteal 30% of melee spell damage
    if(hasSkill('mag_c1')&&z._killedBySpell){const heal=Math.round(z.def.hp*0.10);me.hp=Math.min(me.maxHp,me.hp+heal);}
    // Mage passive: Mana splurge — kill by spell reduces fireball cooldown by 1s
    if(me.kit==='mage'&&z._killedBySpell&&me.abilCds['fireball']){me.abilCds['fireball']-=1000;}
  }
  if(z.def.explodes){
    explosionAOE(z.x,z.y,90,40);
  }
  gs.floats.push({x:z.x,y:z.y,txt:'+'+z.def.coins+'💰',col:'#fbbf24',life:1.5,dy:-50});
}

/* ── Wave management ─────────────────────────────────────── */
function startWave(){
  gs.wave++;
  gs.phase='wave';
  gs.spawnedCount=0;
  const baseCount=8+gs.wave*3;
  gs.waveTotal=Math.round(baseCount*gs.difficulty);
  document.getElementById('phaseLabel').textContent='Vlna '+gs.wave;
  document.getElementById('phaseLabel').style.color='#ef4444';
  gToast(`🧟 Vlna ${gs.wave}!`,'#ef4444');
  document.getElementById('waveNum').textContent=gs.wave;

  if(hasSkill('eng_b2')){me.inv.wall=(me.inv.wall||0)+3;me.inv.barricade=(me.inv.barricade||0)+2;updateInvDisplay();gToast('📦 Munice z vzduchu! +3 zdi +2 barikády','#06b6d4');}
  // Boss logic: every 5th wave; count = floor(wave/20)+1; scaled per player
  if(gs.wave%5===0){
    const pCount=Object.keys(gs.players).length+1;
    gs.bossCount=Math.floor(gs.wave/20)+1+(pCount-1);
  } else {
    gs.bossCount=0;
  }
}

function endWave(){
  gs.phase='build';
  gs.buildTimer=BUILD_DUR;
  document.getElementById('phaseLabel').textContent='Příprava';
  document.getElementById('phaseLabel').style.color='#fbbf24';
  gToast(`✅ Vlna ${gs.wave} přežita! Čas na budování…`,'#84cc16');
  // Advance farm plots
  let readyCount=0;
  gs.farmPlots.forEach(p=>{
    if(p.state==='growing'){p.growPhases++;if(p.growPhases>=2){p.state='ready';readyCount++;}}
  });
  if(readyCount>0)setTimeout(()=>gToast(`🌾 ${readyCount} políček připraveno ke sklizni! [G]`,'#84cc16'),800);
  // Refill well
  gs.well.charges=gs.well.maxCharges;
  setTimeout(()=>showGameQuiz(),600);
  if(gs.bossCount>0){
    gToast('👹 Boss zabity! +300💰','#fbbf24');
    me.coins+=300;
  }
}

/* ── Zombie spawning ─────────────────────────────────────── */
let lastSpawn=0;
function spawnTick(ts){
  if(ts-lastSpawn<800)return;
  lastSpawn=ts;
  if(gs.spawnedCount>=gs.waveTotal)return;
  // Spawn bosses first if any remaining
  const remaining=gs.waveTotal-gs.spawnedCount;
  let type=pickZombieType();
  if(gs.bossCount>0&&gs.spawnedCount===0){
    for(let i=0;i<gs.bossCount;i++) spawnZombie('boss');
    gs.bossCount=0;
    return;
  }
  spawnZombie(type);
}

function pickZombieType(){
  const w=gs.wave;
  const r=Math.random();
  const pool=[];
  if(w>=10)pool.push({t:'brute',   p:0.07});
  if(w>=7) pool.push({t:'exploder',p:0.10});
  if(w>=5) pool.push({t:'tank',    p:0.13});
  if(w>=3) pool.push({t:'speeder', p:0.17});
  if(w>=2) pool.push({t:'dog',     p:0.16});
  let cum=0;
  for(const e of pool){cum+=e.p;if(r<cum)return e.t;}
  return 'normal';
}

function spawnZombie(type){
  gs.spawnedCount++;
  const def=ZTYPES[type];
  // Pick random side (0=top,1=right,2=bottom,3=left)
  const side=Math.floor(Math.random()*4);
  let x,y;
  const b=BARRIER;
  if(side===0){x=b.x+Math.random()*b.w;y=b.y-SPAWN_M;}
  else if(side===1){x=b.x+b.w+SPAWN_M;y=b.y+Math.random()*b.h;}
  else if(side===2){x=b.x+Math.random()*b.w;y=b.y+b.h+SPAWN_M;}
  else{x=b.x-SPAWN_M;y=b.y+Math.random()*b.h;}

  const hpMult=(1+(gs.wave-1)*0.12)*(1+gs.wrongAnswers*0.15);
  const spdMult=1+(gs.wave-1)*0.03+gs.wrongAnswers*0.05;
  const id=eid();
  gs.zombies.set(id,{
    id,type,def,x,y,r:def.r,
    hp:Math.round(def.hp*hpMult*gs.difficulty),
    maxHp:Math.round(def.hp*hpMult*gs.difficulty),
    spd:def.spd*spdMult,
    lastHitPlayer:0,lastHitBase:0,lastHitStruct:{},
    suppressed:0,
    nudgeAng:0,nudgeEnd:0,
  });
}

/* ── Zombie AI ───────────────────────────────────────────── */
function updateZombies(dt,ts){
  const _frameWalls=getAllWalls();
  const zombiesToKill=[];
  gs.zombies.forEach((z,id)=>{
    if(z.suppressed>ts){z.spd*=0.3;}
    // Poison/burn tick
    if(z.poison&&ts<z.poison.end){
      if(!z.poison.tick||ts-z.poison.tick>1000){
        z.poison.tick=ts;
        const pdmg=Math.round(z.poison.dmg);
        z.hp-=pdmg;
        gs.floats.push({x:z.x,y:z.y-15,txt:`-${pdmg}🐍`,col:'#4ade80',life:0.7,dy:-22});
        if(z.hp<=0){zombiesToKill.push([id,z]);return;}
      }
    }
    // Stun
    if(z.stunEnd&&ts<z.stunEnd)return;
    const def=ZTYPES[z.type];
    let tx=CX,ty=CY; // default: base

    if(!def.ignP){
      // Default: head toward base; dogs aggro players aggressively, others only if very close
      const aggroRange=z.type==='dog'?600:z.type==='speeder'?200:120;
      const meVisible=!(me.eff.stealth&&ts<me.eff.stealth.end);
      const allP=[...(meVisible?[me]:[]),...Object.values(gs.players).filter(p=>p.alive&&!(p.eff&&p.eff.stealth&&ts<p.eff.stealth.end))];
      let nearDist=aggroRange;
      for(const p of allP){
        const d=Math.hypot(p.x-z.x,p.y-z.y);
        if(d<nearDist){nearDist=d;tx=p.x;ty=p.y;}
      }
    } else {
      // Brute: find nearest blocking structure
      let nearDist=Infinity;
      for(const s of gs.structs){
        if(s.hp<=0||!STRUCT_DEFS[s.type].blocks)continue;
        const d=Math.hypot((s.x+s.w/2)-z.x,(s.y+s.h/2)-z.y);
        if(d<nearDist){nearDist=d;tx=s.x+s.w/2;ty=s.y+s.h/2;}
      }
    }

    const ang=Math.atan2(ty-z.y,tx-z.x);
    // Use side nudge if stuck
    let moveAng=ang;
    if(z.nudgeEnd&&ts<z.nudgeEnd)moveAng=z.nudgeAng;
    // Speed modifiers from skills
    let spdMult=1;
    if(z.taunted&&ts<z.taunted.end)spdMult*=z.taunted.spd;
    if(z.poison&&ts<z.poison.end&&hasSkill('rog_b3'))spdMult*=0.8;
    if(z._fearSlow)spdMult*=z._fearSlow;
    if(z.stunEnd&&ts<z.stunEnd)spdMult=0;
    const vx=Math.cos(moveAng)*z.spd*spdMult*60*dt;
    const vy=Math.sin(moveAng)*z.spd*spdMult*60*dt;
    const ox=z.x,oy=z.y;
    zombieMoveSlide(z,vx,vy,_frameWalls);
    // If barely moved and not already nudging, pick a random side direction
    if((!z.nudgeEnd||ts>z.nudgeEnd)&&Math.hypot(z.x-ox,z.y-oy)<0.8){
      z.nudgeAng=ang+(Math.random()>0.5?1:-1)*(0.6+Math.random()*1.5);
      z.nudgeEnd=ts+400+Math.random()*400;
    }

    // Keep within extended bounds
    z.x=Math.max(BARRIER.x-200,Math.min(BARRIER.x+BARRIER.w+200,z.x));
    z.y=Math.max(BARRIER.y-200,Math.min(BARRIER.y+BARRIER.h+200,z.y));

    // Hit players
    if(!def.ignP){
      const allP=[{p:me},...Object.values(gs.players).map(p=>({p}))];
      for(const {p} of allP){
        if(!p.alive)continue;
        if(Math.hypot(z.x-p.x,z.y-p.y)<z.r+PLAYER_R){
          if(ts-z.lastHitPlayer>1000){
            z.lastHitPlayer=ts;
            if(p.uid===me.uid) takeDmg(def.dmg,p);
          }
        }
      }
    }

    // Hit base
    if(Math.hypot(z.x-CX,z.y-CY)<z.r+BASE_R){
      if(ts-z.lastHitBase>1100){
        z.lastHitBase=ts;
        gs.baseHp=Math.max(0,gs.baseHp-def.sdmg*(1+(gs.wave*0.05)));
        gs.floats.push({x:CX+Math.random()*60-30,y:CY-40,txt:`-${def.sdmg}`,col:'#3b82f6',life:1,dy:-40});
        if(gs.baseHp<=0)gameOver(false);
      }
    }

    // Hit structures
    for(const s of gs.structs){
      if(s.hp<=0)continue;
      const sd=STRUCT_DEFS[s.type];
      const d=Math.hypot(z.x-(s.x+s.w/2),z.y-(s.y+s.h/2));
      if(d<z.r+Math.max(s.w,s.h)/2+5){
        const k=s.id;
        if(!z.lastHitStruct[k]||ts-z.lastHitStruct[k]>900){
          z.lastHitStruct[k]=ts;
          s.hp=Math.max(0,s.hp-def.sdmg*(1+(gs.wave*0.03)));
          // Eng B3: one-time rebuild
          if(s.hp<=0&&hasSkill('eng_b3')&&!s.rebuilt){
            s.rebuilt=true;
            s.hp=Math.round(s.maxHp*0.3);
            gs.floats.push({x:s.x+s.w/2,y:s.y,txt:'🔧 Rebuilt!',col:'#0ea5e9',life:1.2,dy:-30});
          }
          if(sd.spikes) dealDmg(id,z,sd.spikes,me);
        }
      }
    }
  });
  zombiesToKill.forEach(([zid,zz])=>{if(gs.zombies.has(zid))killZombie(zid,zz,me);});
}

function checkBaseHit(){
  if(gs.baseHp<=0){gameOver(false);}
}

/* ── Player damage ───────────────────────────────────────── */
function takeDmg(amount,p){
  if(p.uid!==me.uid)return;
  if(me.eff.dodge||me.eff.immune)return;
  let d=amount;
  if(me.eff.fortify)d=Math.round(d*0.5);
  if(me.kit==='tank')d=Math.round(d*0.7);
  if(me.kit==='tank'&&me._tankStance)d=Math.round(d*0.85);
  if(hasSkill('war_b1'))d=Math.max(0,d-2);
  if(hasSkill('tan_a1'))d=Math.round(d*0.85);
  // Odolnost (Resistance) damage mitigation: -2%/bod, capped at 75%
  if(me.stats.res>0)d=Math.round(d*(1-Math.min(0.02*me.stats.res,0.75)));
  me.hp=Math.max(0,me.hp-d);
  me.lastDamageTs=performance.now();
  gs.floats.push({x:me.x,y:me.y-30,txt:`-${d}`,col:'#ef4444',life:0.9,dy:-45});
  // Thorns
  if(hasSkill('tan_b1')){
    gs.zombies.forEach(z=>{if(Math.hypot(z.x-me.x,z.y-me.y)<PLAYER_R+z.r+8)z.hp=Math.max(1,z.hp-5);});
  }
  // Priest C3: Sdílené utrpení — reflect 50% received dmg to nearby enemies
  if(hasSkill('pri_c3')&&d>0){
    const reflDmg=Math.round(d*0.5);
    gs.zombies.forEach((z,id)=>{if(Math.hypot(z.x-me.x,z.y-me.y)<100){dealDmg(id,z,reflDmg,me);}});
  }
  if(me.hp<=0&&me.alive){
    if(hasSkill('pri_a3')&&!me.usedRevive){
      me.usedRevive=true;
      me.hp=Math.round(me.maxHp*0.4);
      gToast('🌟 Vzkříšení! Auto-vzkříšení na 40% HP','#fde68a');
      return;
    }
    me.alive=false;openOv('deathOv');
  }
}

function doRespawn(){
  const cost=me.respawnCost;
  if(me.coins<cost){
    document.getElementById('respawnErr').textContent='Nemáš dost coinů!';
    return;
  }
  me.coins-=cost;
  me.hp=Math.round(me.maxHp*0.5);
  me.alive=true;
  me.x=CX; me.y=CY;
  me.respawnCost=Math.round(me.respawnCost*1.5);
  document.getElementById('respawnCost').textContent=me.respawnCost;
  closeOv('deathOv');
  gToast('🔄 Obnoven!','#84cc16');
}

/* ── Level/XP ────────────────────────────────────────────── */
function checkLevelUp(){
  if(me.xp<me.xpNext)return;
  me.xp-=me.xpNext;
  me.level++;
  me.xpNext=Math.round(me.xpNext*1.5);
  if([3,6,9,12].includes(me.level)){
    me.sp++;
  }
  // Defer overlay — show after wave-end quiz so it doesn't interrupt combat
  if(gs.phase==='build'){
    _openLevelUpOv();
  } else {
    gs.pendingLevelUp=true;
    gToast(`⭐ Level ${me.level}! (ukáže se po vlně)`,'#a78bfa');
  }
}

function _openLevelUpOv(){
  gs.pendingLevelUp=false;
  const pts=2;
  document.getElementById('luLevel').textContent=me.level;
  document.getElementById('luPoints').textContent=pts;
  buildLevelUpRows(pts);
  openOv('levelUpOv');
  if([3,6,9,12].includes(me.level)){
    gToast(`🌳 +1 Skill Point! Otevři strom [T]`,'#a78bfa');
  }
}

let _luRemaining=0;
function buildLevelUpRows(pts){
  _luRemaining=pts;
  const container=document.getElementById('luRows');
  container.innerHTML='';
  const alloc={};
  SDEFS_STATS.forEach(def=>{
    alloc[def.k]=0;
    const row=document.createElement('div');
    row.className='sr';
    row.innerHTML=`<span class="sr-lbl">${def.label}</span><span class="sr-desc">${def.desc}</span>
      <div class="sr-ctl">
        <button class="stat-btn" data-k="${def.k}" data-d="-1" id="lu_min_${def.k}">−</button>
        <span class="sr-v" id="lu_v_${def.k}">+0</span>
        <button class="stat-btn" data-k="${def.k}" data-d="1" id="lu_pl_${def.k}">+</button>
      </div>`;
    container.appendChild(row);
  });
  container.querySelectorAll('.stat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const k=btn.dataset.k,d=parseInt(btn.dataset.d);
      if(d>0&&_luRemaining<=0)return;
      if(d<0&&(alloc[k]||0)<=0)return;
      alloc[k]=(alloc[k]||0)+d;
      _luRemaining-=d;
      document.getElementById('lu_v_'+k).textContent='+'+(alloc[k]||0);
      document.getElementById('luConfirm').disabled=_luRemaining>0;
    });
  });
  document.getElementById('luConfirm').disabled=true;
  document.getElementById('luConfirm').onclick=()=>{
    SDEFS_STATS.forEach(def=>{me.stats[def.k]+=(alloc[def.k]||0);});
    me.maxHp=80+me.stats.vit*20;
    me.hp=Math.min(me.hp+me.stats.vit*5,me.maxHp);
    closeOv('levelUpOv');
    gToast(`⭐ Level ${me.level}!`,'#a78bfa');
  };
}
function confirmLevelUp(){}// handled inline above

/* ── Skill Tree ──────────────────────────────────────────── */
function hasSkill(id){return !!me.skills[id];}

function getTierUnlocked(){
  // T1 at lvl 3, T2 at lvl 6, T3 at lvl 9, T4 at lvl 12
  return Math.min(4,Math.floor(me.level/3));
}

function toggleSkillTree(){
  const ov=document.getElementById('skillTreeOv');
  if(!ov.classList.contains('hidden')){closeOv('skillTreeOv');return;}
  buildSkillTreeUI();
  openOv('skillTreeOv');
}

function buildSkillTreeUI(){
  document.getElementById('stSP').textContent=me.sp;
  const kitData=SKILL_TREE[me.kit];
  if(!kitData)return;
  const container=document.getElementById('stBranches');
  container.innerHTML='';
  container.style.gridTemplateColumns='1fr 1fr 1fr';
  const tierUnlocked=getTierUnlocked();
  ['A','B','C'].forEach(branchKey=>{
    const branch=kitData[branchKey];
    const div=document.createElement('div');
    div.className='sk-branch';
    div.innerHTML=`<div class="sk-branch-title" style="color:${branch.col||'#818cf8'};">${branch.name}</div>`;
    branch.skills.forEach((sk,idx)=>{
      const owned=hasSkill(sk.id);
      const tierAvail=sk.tier<=tierUnlocked;
      const prevOwned=idx===0||hasSkill(branch.skills[idx-1].id);
      const canBuy=!owned&&tierAvail&&prevOwned&&me.sp>0;
      const locked=!tierAvail||!prevOwned;
      const cell=document.createElement('div');
      cell.className='sk-cell'+(owned?' sk-owned':locked?' sk-locked':'');
      const costLine=owned
        ?`<div class="sk-cost" style="color:#4ade80;">✓ Zakoupeno</div>`
        :locked
          ?`<div class="sk-cost" style="color:#555;">🔒 ${sk.tier<=tierUnlocked?'Odemkni předchozí':'Požaduje Lv.'+(sk.tier*3)}</div>`
          :`<div class="sk-cost">${me.sp>0?'1 SP · klikni':'Nemáš SP'}</div>`;
      cell.innerHTML=`
        <div class="sk-tier">T${sk.tier}</div>
        <div class="sk-emoji">${sk.emoji}</div>
        <div class="sk-info">
          <div class="sk-name">${sk.name}</div>
          <div class="sk-desc">${sk.desc}</div>
          ${costLine}
        </div>`;
      if(canBuy) cell.onclick=()=>buySkill(sk);
      div.appendChild(cell);
    });
    container.appendChild(div);
  });
}

function buySkill(sk){
  if(me.sp<=0){gToast('Nemáš žádný Skill Point!','#ef4444');return;}
  if(hasSkill(sk.id)){gToast('Dovednost již zakoupena!','#f59e0b');return;}
  me.sp--;
  me.skills[sk.id]=true;
  // Immediate stat-based effects on purchase
  if(sk.id==='war_b3'){me.maxHp+=60;me.hp=Math.min(me.hp+60,me.maxHp);}
  // Unlock ultimate ability slot
  if(sk.abilId&&!me.unlockedAbils.includes(sk.abilId)){
    me.unlockedAbils.push(sk.abilId);
    buildAbilBar();
  }
  gToast(`✅ ${sk.emoji} ${sk.name} odemčeno!`,'#a78bfa');
  buildSkillTreeUI();
}

/* ── Deck / Quiz ─────────────────────────────────────────── */
async function loadDeckCards(){
  const params=new URLSearchParams(location.search);
  const deckId=params.get('deck');
  if(!deckId)return;
  try{
    const snap=await db.collection('decks').doc(deckId).collection('cards').get();
    DECK_CARDS=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(e){console.warn('[quiz] loadDeckCards:',e);}
}

function getGameDistractors(card){
  const n=(card.answerCount||4)-1;
  if(card.distractors&&card.distractors.length>=n)return shuffle([...card.distractors]).slice(0,n);
  const extra=DECK_CARDS.filter(c=>c.id!==card.id&&c.back).map(c=>c.back);
  return shuffle([...(card.distractors||[]),...extra]).slice(0,n);
}

function showGameQuiz(){
  if(DECK_CARDS.length<2){_afterQuiz();return;}
  let available=DECK_CARDS.filter(c=>!QUIZ_USED.has(c.id)&&c.front&&c.back);
  if(!available.length){QUIZ_USED.clear();available=DECK_CARDS.filter(c=>c.front&&c.back);}
  if(!available.length){_afterQuiz();return;}

  const card=available[Math.floor(Math.random()*available.length)];
  QUIZ_USED.add(card.id);
  const distractors=getGameDistractors(card);
  const opts=shuffle([card.back,...distractors]);

  document.getElementById('quizOvQ').textContent=card.front;
  const msgEl=document.getElementById('quizOvMsg');
  msgEl.textContent='';
  msgEl.style.color='';

  // Difficulty status line above question
  let statusEl=document.getElementById('quizOvStatus');
  if(!statusEl){
    statusEl=document.createElement('div');
    statusEl.id='quizOvStatus';
    statusEl.style.cssText='font-size:.72rem;margin-bottom:8px;min-height:16px;';
    document.getElementById('quizOvQ').insertAdjacentElement('beforebegin',statusEl);
  }
  if(gs.wrongAnswers>0){
    const penalty=Math.min(70,gs.wrongAnswers*10);
    const hpBoost=Math.round(gs.wrongAnswers*15);
    statusEl.innerHTML=`<span style="color:#f87171">⚠️ ${gs.wrongAnswers}× špatná odpověď — zombie mají +${hpBoost}% HP · odměny −${penalty}%</span>`;
  } else {
    statusEl.textContent='';
  }

  const wrap=document.getElementById('quizOvA');
  wrap.innerHTML='';
  opts.forEach(opt=>{
    const btn=document.createElement('button');
    btn.className='btn-s';
    btn.style.cssText='padding:9px 12px;font-size:.8rem;text-align:left;white-space:normal;line-height:1.3;';
    btn.textContent=opt;
    btn.addEventListener('click',()=>{
      wrap.querySelectorAll('button').forEach(b=>b.disabled=true);
      const ok=opt===card.back;
      btn.style.borderColor=ok?'#4ade80':'#f87171';
      if(ok){
        const reward=30+gs.wave*5;
        me.coins+=reward; updateHUD();
        msgEl.innerHTML=`✅ Správně! <span style="color:#fbbf24">+${reward} 💰</span>`;
        msgEl.style.color='';
      } else {
        gs.wrongAnswers++;
        wrap.querySelectorAll('button').forEach(b=>{if(b.textContent===card.back)b.style.borderColor='#4ade80';});
        const penalty=Math.min(70,gs.wrongAnswers*10);
        const hpBoost=Math.round(gs.wrongAnswers*15);
        msgEl.innerHTML=`❌ Správná: <strong>${card.back}</strong><br><span style="color:#f87171;font-size:.75rem;">Příští vlna: zombie +${hpBoost}% HP · odměny −${penalty}%</span>`;
        msgEl.style.color='#f87171';
      }
      setTimeout(()=>{closeOv('quizOv');_afterQuiz();},2200);
    });
    wrap.appendChild(btn);
  });
  openOv('quizOv');
}

function _afterQuiz(){
  if(gs.pendingLevelUp)_openLevelUpOv();
}

/* ── Shop ────────────────────────────────────────────────── */
function toggleShop(){
  const ov=document.getElementById('shopOv');
  if(!ov.classList.contains('hidden')){closeOv('shopOv');return;}
  buildShop();
  openOv('shopOv');
  // Rogue C2: brief shield when opening shop
  if(hasSkill('rog_c2'))me.eff.fortify={end:performance.now()+2000};
}

function buildShop(){
  document.getElementById('shopCoins').textContent=me.coins;
  const grid=document.getElementById('shopGrid');
  grid.innerHTML='';
  const disc=me.stats.cha*0.03+(hasSkill('eng_a1')?0.20:0);
  const items=KIT_SHOP[me.kit]||KIT_SHOP.warrior;
  const SURVIVAL_ITEMS=[
    {id:'food1', emoji:'🍖',name:'Konzerva +35',   cost:20,type:'food',  hunger:35},
    {id:'water1',emoji:'💧',name:'Lahev vody +35', cost:20,type:'water', thirst:35},
    {id:'ration',emoji:'🥫',name:'Zásoby +50/+40', cost:50,type:'food',  hunger:50,thirst:40},
    {id:'energy',emoji:'🧃',name:'Energetický nápoj',cost:35,type:'water',thirst:50,hunger:10},
  ];
  [...items,...SURVIVAL_ITEMS].forEach(item=>{
    const cost=Math.max(1,Math.round(item.cost*(1-disc)));
    const el=document.createElement('div');
    el.className='si'+(me.coins<cost?' sd':'');
    el.innerHTML=`<div class="si-e">${item.emoji}</div><div class="si-n">${item.name}</div><div class="si-c">${cost}💰</div>`;
    el.onclick=()=>{if(me.coins<cost)return;buyItem(item,cost);buildShop();};
    grid.appendChild(el);
  });
  // Send coins (multiplayer)
  const row=document.getElementById('sendCoinsRow');
  const others=Object.values(gs.players).filter(p=>p.alive);
  document.getElementById('sendCoinsWrap').style.display=others.length?'block':'none';
  row.innerHTML='';
  others.forEach(p=>{
    const btn=document.createElement('button');
    btn.className='btn-s';
    btn.textContent=`${p.name} (20💰)`;
    btn.onclick=()=>sendCoins(p,20);
    row.appendChild(btn);
  });
}

function buyItem(item,cost){
  me.coins-=cost;
  if(item.type==='weapon'){
    if(WEAPONS[item.id])me.weapon=item.id;
  } else if(item.type==='use'){
    if(item.use.hp)me.hp=Math.min(me.maxHp,me.hp+item.use.hp);
    if(item.use.maxhp){me.maxHp+=item.use.maxhp;me.hp=Math.min(me.hp+item.use.maxhp,me.maxHp);}
  } else if(item.type==='struct'){
    me.inv[item.stype]=(me.inv[item.stype]||0)+item.qty;
    updateInvDisplay();
  } else if(item.type==='stat'){
    me.stats[item.stat]=(me.stats[item.stat]||0)+item.val;
    if(item.stat==='vit'){me.maxHp+=item.val*20;me.hp=Math.min(me.hp+item.val*20,me.maxHp);}
  } else if(item.type==='food'){
    if(item.hunger)me.hunger=Math.min(100,me.hunger+item.hunger);
    if(item.thirst)me.thirst=Math.min(100,me.thirst+item.thirst);
  } else if(item.type==='water'){
    if(item.thirst)me.thirst=Math.min(100,me.thirst+item.thirst);
    if(item.hunger)me.hunger=Math.min(100,me.hunger+item.hunger);
  }
  gToast(`Koupeno: ${item.name}`,'#84cc16');
}

/* ── Structure placement ─────────────────────────────────── */
function placeStructure(){
  if(!placing.active)return;
  const type=placing.type;
  if((me.inv[type]||0)<=0){gToast('Nemáš žádné '+STRUCT_DEFS[type].name,'#ef4444');return;}
  const def=STRUCT_DEFS[type];
  const rot=placing.rot;
  let w=def.w,h=def.h;
  if(rot===90||rot===270){w=def.h;h=def.w;}
  const sx=mouse.wx-w/2, sy=mouse.wy-h/2;
  // Don't place on top of base
  if(Math.hypot(mouse.wx-CX,mouse.wy-CY)<BASE_R+30){gToast('Příliš blízko základny','#f59e0b');return;}
  const id=eid();
  let sHp=def.hp;
  if(type==='turret'&&hasSkill('eng_a2')) sHp*=2;
  if(hasSkill('tan_a2')) sHp=Math.round(sHp*1.5);
  gs.structs.push({id,type,def,x:sx,y:sy,w,h,hp:sHp,maxHp:sHp,rot,lastShot:0,zombieHits:{},owner:me.uid});
  me.inv[type]--;
  updateInvDisplay();
  syncStructures();
}

/* ── Structures update (turrets) ─────────────────────────── */
function updateStructures(ts){
  for(const s of gs.structs){
    if(s.hp<=0)continue;
    const def=STRUCT_DEFS[s.type];
    if(!def.turret)continue;
    // Find nearest zombie in range
    let nearest=null,nearDist=250;
    gs.zombies.forEach(z=>{
      const d=Math.hypot(z.x-(s.x+s.w/2),z.y-(s.y+s.h/2));
      if(d<nearDist){nearDist=d;nearest=z;}
    });
    const isMine=s.owner===me.uid;
    const tCD=hasSkill('eng_a3')&&isMine?600:hasSkill('mil_b3')&&isMine?800:1200;
    const tDmg=Math.round((20+(hasSkill('eng_a2')&&isMine?15:0))*(hasSkill('mil_b3')&&isMine?1.5:1));
    if(nearest&&ts-s.lastShot>tCD){
      s.lastShot=ts;
      const dx=nearest.x-(s.x+s.w/2),dy=nearest.y-(s.y+s.h/2);
      const l=Math.hypot(dx,dy)||1;
      gs.bullets.push({x:s.x+s.w/2,y:s.y+s.h/2,dx:dx/l,dy:dy/l,
        spd:13,dmg:tDmg,range:260,dist:0,col:'#fbbf24',r:3,owner:'turret'});
    }
  }
}

function updateFloats(dt){
  gs.floats=gs.floats.filter(f=>{f.y+=f.dy*dt;f.life-=dt;return f.life>0;});
}

/* ── Ability helpers ─────────────────────────────────────── */
function getStatMult(p,stat){return 1+(p.stats[stat]||0)*0.08;}

function shootMulti(p,count,spread){
  const w=WEAPONS[p.weapon];
  for(let i=0;i<count;i++){
    const a=p.angle+(i-(count-1)/2)*spread;
    spawnBullet(p.x,p.y,Math.cos(a),Math.sin(a),w,p);
  }
}

function spawnProjectile(p,dx,dy,type){
  const fbMult=(type==='fireball'&&hasSkill('mag_a1')&&p.uid===me.uid)?1.3:1;
  const dmg=type==='fireball'?Math.round(60*getStatMult(p,'int')*fbMult):30;
  gs.bullets.push({x:p.x,y:p.y,dx,dy,spd:10,dmg,range:500,dist:0,
    col:'#ef4444',r:8,owner:p.uid,type,
    onHit:(bx,by)=>explosionAOE(bx,by,80,dmg)});
}

function blinkToMouse(p){
  // Check walls don't block destination
  p.x=Math.max(BARRIER.x+20,Math.min(BARRIER.x+BARRIER.w-20,mouse.wx));
  p.y=Math.max(BARRIER.y+20,Math.min(BARRIER.y+BARRIER.h-20,mouse.wy));
  gs.floats.push({x:p.x,y:p.y-30,txt:'✨',col:'#818cf8',life:0.8,dy:-30});
}

function novaAOE(p,range,dmg){
  if(hasSkill('mag_a3')&&p.uid===me.uid){range+=50;dmg=Math.round(dmg*1.2);}
  gs.zombies.forEach((z,id)=>{
    if(Math.hypot(z.x-p.x,z.y-p.y)<range){
      z._killedBySpell=true;
      dealDmg(id,z,dmg,p);
      z.suppressed=(performance.now()+2000);
    }
  });
  gs.floats.push({x:p.x,y:p.y-30,txt:'Nova!',col:'#818cf8',life:1.5,dy:-50});
}

function explosionAOE(x,y,range,dmg){
  gs.zombies.forEach((z,id)=>{
    if(Math.hypot(z.x-x,z.y-y)<range) dealDmg(id,z,dmg,me);
  });
  gs.floats.push({x,y:y-20,txt:'💥 Boom!',col:'#f97316',life:1.2,dy:-40});
}

function suppressAOE(p,range,dur){
  const now=performance.now();
  gs.zombies.forEach(z=>{
    if(Math.hypot(z.x-p.x,z.y-p.y)<range) z.suppressed=now+dur;
  });
  gToast('🎯 Potlačení aktivováno!','#f59e0b');
}

function tauntAOE(p,range){
  const now=performance.now();
  gs.zombies.forEach(z=>{
    if(Math.hypot(z.x-p.x,z.y-p.y)<range){
      z._taunt={tx:p.x,ty:p.y,end:now+3000};
      if(hasSkill('tan_b2')) z.taunted={spd:0.6,end:now+3000};
    }
  });
  gToast('😤 Zombies se soustředí na tebe!','#64748b');
}

function deployTurret(p){
  if(me.inv.turret>0){
    placing.active=true;placing.type='turret';placing.rot=0;
    gToast('Klikni pro položení věže','#0ea5e9');
  } else {gToast('Nemáš žádnou věž!','#ef4444');}
}

function repairNearby(p,range,amount=40){
  for(const s of gs.structs){
    if(s.hp<=0)continue;
    if(Math.hypot((s.x+s.w/2)-p.x,(s.y+s.h/2)-p.y)<range){
      s.hp=Math.min(s.maxHp,s.hp+amount);
    }
  }
  gToast('🔧 Opravuji struktury!','#0ea5e9');
}

function healNearby(p,range,amount,healOthers=false){
  me.hp=Math.min(me.maxHp,me.hp+amount);
  gToast(`💚 Uzdravení +${amount} HP!`,'#fde68a');
  if(healOthers) Object.values(gs.players).forEach(op=>{if(op.alive)op.hp=Math.min(op.maxHp,op.hp+amount);});
}

function blessNearby(p,range,dur=14000,allPlayers=false){
  const now=performance.now();
  me.eff.bless={end:now+dur};
  if(allPlayers) Object.values(gs.players).forEach(op=>{if(op.alive)op.eff={...(op.eff||{}),bless:{end:now+dur}};});
  gToast(`✨ Požehnání! +20% DMG na ${dur/1000}s`,'#fde68a');
}

function throwGrenade(p,frag=false){
  // Militant passive: Výbušná duše — every 4th grenade resets its cooldown
  if(p.uid===me.uid&&p.kit==='militant'){
    p._grenadeCount=(p._grenadeCount||0)+1;
    if(p._grenadeCount>=4){p._grenadeCount=0;p.abilCds['grenade']=0;gToast('💥 Výbušná duše! Granát zadarmo!','#f59e0b');}
  }
  const dx=p.aimDx,dy=p.aimDy;
  const isMe=p.uid===me.uid;
  const gDmg=frag?160:(isMe&&hasSkill('mil_a2')?120:80);
  const gRange=frag?240:(isMe&&hasSkill('mil_a3')?320:280);
  const aoeR=frag?180:(isMe&&hasSkill('mil_a3')?140:100);
  const aoeDmg=frag?gDmg:(isMe&&hasSkill('mil_a3')?Math.round(gDmg*1.2):gDmg);
  gs.bullets.push({x:p.x,y:p.y,dx,dy,spd:7,dmg:gDmg,range:gRange,dist:0,
    col:'#f97316',r:6,owner:p.uid,type:'grenade',
    onHit:(bx,by)=>explosionAOE(bx,by,aoeR,aoeDmg)});
}

function detonateC4(){
  const idx=gs.summons.findIndex(s=>s.type==='c4'&&s.owner===me.uid);
  if(idx<0){gToast('Žádné C4 na mapě!','#ef4444');return;}
  const c=gs.summons[idx];
  explosionAOE(c.x,c.y,240,150);
  gToast('🧨 C4 odpáleno!','#dc2626');
  gs.summons.splice(idx,1);
}

/* ── Farm / Well interaction ─────────────────────────────── */
function interactFarm(){
  if(gs.screen!=='game'||gs.phase!=='build')return;
  const REACH=70;
  for(const p of gs.farmPlots){
    if(Math.hypot(me.x-p.x,me.y-p.y)>REACH)continue;
    if(p.state==='empty'){
      p.state='growing';p.growPhases=0;
      gToast('🌱 Zasazeno! Sklizeň za 2 kola.','#84cc16');
      return;
    }
    if(p.state==='ready'){
      p.state='empty';
      me.hunger=Math.min(100,me.hunger+38);
      gs.floats.push({x:p.x,y:p.y-30,txt:'+38🍖',col:'#f59e0b',life:1.4,dy:-50});
      gToast('🌾 Sklizeno! +38 hlad','#f59e0b');
      return;
    }
    if(p.state==='growing'){
      gToast(`🌿 Ještě roste… (${p.growPhases}/2 kola)`,'#6ee7b7');
      return;
    }
  }
  const w=gs.well;
  if(Math.hypot(me.x-w.x,me.y-w.y)<=REACH){
    if(w.charges>0){
      w.charges--;
      me.thirst=Math.min(100,me.thirst+22);
      gs.floats.push({x:w.x,y:w.y-30,txt:'+22💧',col:'#38bdf8',life:1.4,dy:-50});
      gToast('💧 +22 hydratace','#38bdf8');
    } else {
      gToast('🪣 Studna je prázdná — doplní se po vlně.','#64748b');
    }
    return;
  }
  gToast('Nejsi u políčka ani studny.','#64748b');
}

function normalizeAngle(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}

function getAbilCd(aId){
  let cd=ABIL[aId]?.cd||1000;
  if(aId==='dodge'  &&hasSkill('arc_b1'))cd=Math.max(500,cd-2000);
  if(aId==='blink'  &&hasSkill('mag_b3'))cd=Math.max(500,cd-3000);
  if(aId==='repair' &&hasSkill('eng_b1'))cd=Math.max(500,cd-3000);
  // Zručnost (Dexterity): -3%/bod CDR, capped at 60%
  if(me.stats.dex>0)cd=Math.round(cd*(1-Math.min(0.03*me.stats.dex,0.60)));
  return cd;
}

function updateAbilityCooldowns(ts){
  const kit=KITS[me.kit];
  if(!kit)return;
  const abils=[...kit.abil,...(me.unlockedAbils||[])];
  abils.forEach(aId=>{
    const btn=document.getElementById('ab_'+aId);
    if(!btn)return;
    const elapsed=ts-(me.abilCds[aId]||0);
    const rem=Math.max(0,getAbilCd(aId)-elapsed);
    let mask=btn.querySelector('.cd-mask');
    if(rem>0){
      if(!mask){mask=document.createElement('div');mask.className='cd-mask';btn.appendChild(mask);}
      mask.textContent=Math.ceil(rem/1000)+'s';
    } else if(mask){mask.remove();}
  });
}

function updateEffects(dt,ts){
  if(me.eff.dodge&&ts>me.eff.dodge.end)delete me.eff.dodge;
  if(me.eff.rage&&ts>me.eff.rage.end)delete me.eff.rage;
  if(me.eff.fortify&&ts>me.eff.fortify.end)delete me.eff.fortify;
  if(me.eff.stealth&&ts>me.eff.stealth.end)delete me.eff.stealth;
  if(me.eff.bless&&ts>me.eff.bless.end)delete me.eff.bless;
  if(me.eff.ultBerserk&&ts>me.eff.ultBerserk.end)delete me.eff.ultBerserk;
  if(me.eff.immune&&ts>me.eff.immune.end)delete me.eff.immune;
  if(me.eff.shadowDance&&ts>me.eff.shadowDance.end)delete me.eff.shadowDance;
  if(me.eff.ultBlessing&&ts>me.eff.ultBlessing.end)delete me.eff.ultBlessing;
  if(me.eff.warCry&&ts>me.eff.warCry.end)delete me.eff.warCry;
  if(me.eff.titan&&ts>me.eff.titan.end)delete me.eff.titan;
  if(me.eff.jackpot&&ts>me.eff.jackpot.end)delete me.eff.jackpot;
  if(me.eff.avatarDeath&&ts>me.eff.avatarDeath.end)delete me.eff.avatarDeath;
  if(me.eff.mutagen&&ts>me.eff.mutagen.end)delete me.eff.mutagen;
  // Banner regen: 2 HP/s while player within 100px
  gs.summons.forEach(s=>{
    if(s.type==='banner'&&Math.hypot(s.x-me.x,s.y-me.y)<100)me.hp=Math.min(me.maxHp,me.hp+2*dt);
  });
}

/* ── Summons update ──────────────────────────────────────── */
function updateSummons(dt,ts){
  for(let i=gs.summons.length-1;i>=0;i--){
    const s=gs.summons[i];
    // Expire all time-limited summons (c4 has no .end)
    if(s.end&&ts>s.end){gs.summons.splice(i,1);continue;}

    if(s.type==='wolf'){
      // Move toward nearest zombie, attack every 1s for 30 dmg
      let nearest=null,nearDist=Infinity;
      gs.zombies.forEach((z,id)=>{
        const d=Math.hypot(z.x-s.x,z.y-s.y);
        if(d<nearDist){nearDist=d;nearest={z,id};}
      });
      if(nearest){
        const dx=nearest.z.x-s.x,dy=nearest.z.y-s.y;
        const d=Math.hypot(dx,dy)||1;
        if(d>24){s.x+=dx/d*90*dt;s.y+=dy/d*90*dt;}
        if(d<36&&ts-s.lastAtk>1000){
          s.lastAtk=ts;
          dealDmg(nearest.id,nearest.z,30,me);
        }
      }
    }
    else if(s.type==='trap'){
      // Trigger when zombie steps within 20px
      if(!s.triggered){
        gs.zombies.forEach((z,id)=>{
          if(!s.triggered&&Math.hypot(z.x-s.x,z.y-s.y)<20){
            s.triggered=true;
            z.stunEnd=ts+3000;
            z._bleed={dmg:5,tickEnd:ts+10000,lastTick:ts};
          }
        });
      } else {
        // Apply bleed tick to any stunned zombie near
        gs.zombies.forEach((z,id)=>{
          if(z._bleed&&ts>z._bleed.lastTick+1000&&ts<z._bleed.tickEnd){
            z._bleed.lastTick=ts;dealDmg(id,z,z._bleed.dmg,me);
          }
        });
        gs.summons.splice(i,1);continue;
      }
    }
    else if(s.type==='lure'){
      // Attract zombies to lure position
      gs.zombies.forEach(z=>{
        const dx=s.x-z.x,dy=s.y-z.y,d=Math.hypot(dx,dy)||1;
        if(d>24){z.x+=dx/d*60*dt;z.y+=dy/d*60*dt;}
        // After lure expires, poison any zombie that was drawn in (within 80px)
        if(ts>=s.end-100&&Math.hypot(z.x-s.x,z.y-s.y)<80)z._poison={dmg:8,tickEnd:ts+5000,lastTick:ts};
      });
    }
    else if(s.type==='acid_pool'){
      // 15 dmg/s to zombies in pool every 1s
      if(ts-s.lastTick>1000){
        s.lastTick=ts;
        gs.zombies.forEach((z,id)=>{if(Math.hypot(z.x-s.x,z.y-s.y)<s.r)dealDmg(id,z,15,me);});
      }
    }
    else if(s.type==='toxic_zone'){
      if(ts-s.lastTick>1000){
        s.lastTick=ts;
        gs.zombies.forEach((z,id)=>{if(Math.hypot(z.x-s.x,z.y-s.y)<s.r)dealDmg(id,z,10,me);});
      }
    }
    else if(s.type==='curse_zone'){
      gs.zombies.forEach(z=>{
        if(Math.hypot(z.x-s.x,z.y-s.y)<s.r)z._cursed=true;
        else z._cursed=false;
      });
    }
    else if(s.type==='ghost_boss'){
      // Auto-attack nearest zombie every 1.5s for 80 dmg
      let nearest=null,nearDist=Infinity;
      gs.zombies.forEach((z,id)=>{
        const d=Math.hypot(z.x-s.x,z.y-s.y);
        if(d<nearDist){nearDist=d;nearest={z,id};}
      });
      if(nearest&&nearDist<300&&ts-s.lastAtk>1500){
        s.lastAtk=ts;
        dealDmg(nearest.id,nearest.z,80,me);
        gs.floats.push({x:s.x,y:s.y-30,txt:'👻-80',col:'#7c3aed',life:0.7,dy:-40});
      }
    }
  }

  // Poison tick (lure side-effect)
  gs.zombies.forEach((z,id)=>{
    if(z._poison&&ts>z._poison.lastTick+1000&&ts<z._poison.tickEnd){
      z._poison.lastTick=ts;dealDmg(id,z,z._poison.dmg,me);
    }
  });
}

/* ── Draw summons ────────────────────────────────────────── */
function drawSummons(){
  gs.summons.forEach(s=>{
    ctx.font='22px serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    if(s.type==='wolf'){
      ctx.fillText('🐺',s.x,s.y);
      // HP bar
      ctx.fillStyle='#dc2626';ctx.fillRect(s.x-16,s.y-22,32,4);
      ctx.fillStyle='#22c55e';ctx.fillRect(s.x-16,s.y-22,32*(s.hp/s.maxHp),4);
    } else if(s.type==='trap')   ctx.fillText('🪤',s.x,s.y);
    else if(s.type==='banner')   ctx.fillText('🚩',s.x,s.y);
    else if(s.type==='lure')     ctx.fillText('🥩',s.x,s.y);
    else if(s.type==='c4')       ctx.fillText('🧨',s.x,s.y);
    else if(s.type==='ghost_boss'){
      ctx.fillText('👻',s.x,s.y);
      ctx.fillStyle='#7c3aed';ctx.fillRect(s.x-24,s.y-34,48,5);
      ctx.fillStyle='#a855f7';ctx.fillRect(s.x-24,s.y-34,48*(s.hp/s.maxHp),5);
    } else if(s.type==='acid_pool'){
      ctx.globalAlpha=0.45;
      ctx.fillStyle='#84cc16';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    } else if(s.type==='toxic_zone'){
      ctx.globalAlpha=0.35;
      ctx.fillStyle='#22c55e';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    } else if(s.type==='curse_zone'){
      ctx.globalAlpha=0.3;
      ctx.fillStyle='#7c3aed';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    }
  });
  ctx.textAlign='left';
  ctx.textBaseline='alphabetic';
}

/* ── HUD ─────────────────────────────────────────────────── */
function updateHUD(){
  document.getElementById('playerHpFill').style.width=(me.hp/me.maxHp*100)+'%';
  document.getElementById('playerHpVal').textContent=me.hp+'/'+me.maxHp;
  document.getElementById('baseHpFill').style.width=(gs.baseHp/gs.baseMaxHp*100)+'%';
  document.getElementById('baseHpVal').textContent=gs.baseHp+'/'+gs.baseMaxHp;
  document.getElementById('xpFill').style.width=(me.xp/me.xpNext*100)+'%';
  document.getElementById('xpVal').textContent=me.xp+'/'+me.xpNext;
  document.getElementById('coinsVal').textContent=me.coins;
  document.getElementById('levelVal').textContent=me.level;
  document.getElementById('spVal').textContent=me.sp;
  // Hunger / Thirst
  const hPct=me.hunger/100*100;
  const tPct=me.thirst/100*100;
  document.getElementById('hungerFill').style.width=hPct+'%';
  document.getElementById('hungerFill').style.background=me.hunger<25?'#ef4444':'#f59e0b';
  document.getElementById('hungerVal').textContent=Math.ceil(me.hunger);
  document.getElementById('thirstFill').style.width=tPct+'%';
  document.getElementById('thirstFill').style.background=me.thirst<25?'#ef4444':'#06b6d4';
  document.getElementById('thirstVal').textContent=Math.ceil(me.thirst);
  document.getElementById('waveNum').textContent=gs.wave;
  if(gs.phase==='build'){
    document.getElementById('phaseLabel').textContent='Příprava '+Math.ceil(gs.buildTimer)+'s';
    document.getElementById('phaseLabel').style.color='#fbbf24';
  }
  // Players list (multiplayer)
  const others=Object.values(gs.players);
  const pl=document.getElementById('plList');
  if(others.length){
    pl.style.display='block';
    pl.innerHTML=`<div style="font-size:.7rem;color:#666;margin-bottom:4px;">Hráči</div>`+
      `<div class="pl-row"><span>${KITS[me.kit].emoji} ${me.name}</span><span class="pl-hp">${me.hp}/${me.maxHp}</span></div>`+
      others.map(p=>`<div class="pl-row"><span>${KITS[p.kit]?.emoji||'?'} ${p.name}</span><span class="pl-hp">${Math.round(p.hp||0)}</span></div>`).join('');
  } else pl.style.display='none';
}

/* ── Minimap ─────────────────────────────────────────────── */
function drawMinimap(){
  const MM=140;
  const scale=MM/BARRIER.w;
  mmCtx.fillStyle='rgba(0,0,0,.85)';
  mmCtx.fillRect(0,0,MM,MM);
  const tx=x=>(x-BARRIER.x)*scale;
  const ty=y=>(y-BARRIER.y)*scale;

  // Walls
  mmCtx.fillStyle='#333';
  MAPS[gs.mapId].walls.forEach(w=>{
    mmCtx.fillRect(tx(w.x),ty(w.y),w.w*scale,w.h*scale);
  });

  // Base
  mmCtx.fillStyle='#3b82f6';
  mmCtx.beginPath();
  mmCtx.arc(tx(CX),ty(CY),BASE_R*scale,0,Math.PI*2);
  mmCtx.fill();

  // Structures
  gs.structs.forEach(s=>{
    if(s.hp<=0)return;
    mmCtx.fillStyle='#0ea5e9';
    mmCtx.fillRect(tx(s.x),ty(s.y),s.w*scale,s.h*scale);
  });

  // Zombies
  mmCtx.fillStyle='#ef4444';
  gs.zombies.forEach(z=>{
    mmCtx.beginPath();
    mmCtx.arc(tx(z.x),ty(z.y),2,0,Math.PI*2);
    mmCtx.fill();
  });

  // Players
  mmCtx.fillStyle='#84cc16';
  mmCtx.beginPath();
  mmCtx.arc(tx(me.x),ty(me.y),3,0,Math.PI*2);
  mmCtx.fill();
  Object.values(gs.players).forEach(p=>{
    mmCtx.fillStyle='#fbbf24';
    mmCtx.beginPath();
    mmCtx.arc(tx(p.x||CX),ty(p.y||CY),3,0,Math.PI*2);
    mmCtx.fill();
  });

  // Barrier border
  mmCtx.strokeStyle='#444';
  mmCtx.lineWidth=1;
  mmCtx.strokeRect(0,0,MM,MM);
}

// ══════════════════════════════════════════════════════════
//  DRAW
// ══════════════════════════════════════════════════════════
function draw(ts){
  ctx.clearRect(0,0,W,H);
  const map=MAPS[gs.mapId];
  ctx.fillStyle=map.bg;
  ctx.fillRect(0,0,W,H);

  // Save/translate to camera
  ctx.save();
  ctx.translate(W/2-cam.x,H/2-cam.y);

  drawFloor(map);
  drawBarrier();
  drawFarm();
  drawStructures();
  drawBase();
  drawMapWalls(map);
  drawZombies(ts);
  drawSummons();
  drawBullets();
  drawPlayers(ts);
  drawFloats();
  drawPlacingPreview();

  ctx.restore();

  // FOV overlay (screen space)
  drawFOV();
}

function drawFloor(map){
  const tileSize=64;
  const sx=Math.floor((cam.x-W/2)/tileSize)*tileSize;
  const sy=Math.floor((cam.y-H/2)/tileSize)*tileSize;
  ctx.fillStyle=map.floor;
  ctx.fillRect(BARRIER.x,BARRIER.y,BARRIER.w,BARRIER.h);
  ctx.strokeStyle='rgba(255,255,255,.04)';
  ctx.lineWidth=1;
  for(let x=sx;x<cam.x+W/2+tileSize;x+=tileSize){
    if(x<BARRIER.x||x>BARRIER.x+BARRIER.w)continue;
    ctx.beginPath();ctx.moveTo(x,BARRIER.y);ctx.lineTo(x,BARRIER.y+BARRIER.h);ctx.stroke();
  }
  for(let y=sy;y<cam.y+H/2+tileSize;y+=tileSize){
    if(y<BARRIER.y||y>BARRIER.y+BARRIER.h)continue;
    ctx.beginPath();ctx.moveTo(BARRIER.x,y);ctx.lineTo(BARRIER.x+BARRIER.w,y);ctx.stroke();
  }
}

function drawBarrier(){
  ctx.strokeStyle='rgba(255,80,80,.5)';
  ctx.lineWidth=3;
  ctx.setLineDash([12,8]);
  ctx.strokeRect(BARRIER.x,BARRIER.y,BARRIER.w,BARRIER.h);
  ctx.setLineDash([]);
}

function drawFarm(){
  if(!gs.farmPlots)return;
  const PW=54,PH=54,REACH=70;
  ctx.textAlign='center';ctx.textBaseline='middle';
  gs.farmPlots.forEach(p=>{
    const near=gs.phase==='build'&&Math.hypot(me.x-p.x,me.y-p.y)<REACH;
    ctx.fillStyle=p.state==='empty'?'#3b2a1a':p.state==='growing'?'#4a3a1e':'#5c4822';
    ctx.strokeStyle=near?'#fbbf24':'rgba(255,255,255,.18)';
    ctx.lineWidth=near?2.5:1;
    ctx.fillRect(p.x-PW/2,p.y-PH/2,PW,PH);
    ctx.strokeRect(p.x-PW/2,p.y-PH/2,PW,PH);
    ctx.font='26px serif';
    ctx.fillText(p.state==='empty'?'🌱':p.state==='growing'?'🌿':'🌾',p.x,p.y);
    if(near){
      const label=p.state==='ready'?'[G] Sklizeň':p.state==='empty'?'[G] Zasadit':'Roste ('+p.growPhases+'/2)';
      ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-40,p.y-PH/2-20,80,16);
      ctx.fillStyle=p.state==='ready'?'#fbbf24':'#86efac';ctx.font='10px Inter,sans-serif';
      ctx.fillText(label,p.x,p.y-PH/2-11);
    }
  });
  // Well
  const w=gs.well;
  const nearW=gs.phase==='build'&&Math.hypot(me.x-w.x,me.y-w.y)<REACH;
  const grad=ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,30);
  grad.addColorStop(0,'#1e3a5f');grad.addColorStop(1,'#0f172a');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(w.x,w.y,28,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=nearW?'#38bdf8':'rgba(56,189,248,.35)';
  ctx.lineWidth=nearW?2:1;
  ctx.beginPath();ctx.arc(w.x,w.y,28,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<w.maxCharges;i++){
    const ang=-Math.PI/2+(i/w.maxCharges)*Math.PI*2;
    ctx.fillStyle=i<w.charges?'#38bdf8':'#1e293b';
    ctx.beginPath();ctx.arc(w.x+Math.cos(ang)*19,w.y+Math.sin(ang)*19,4.5,0,Math.PI*2);ctx.fill();
  }
  ctx.font='18px serif';ctx.fillText('🪣',w.x,w.y);
  if(nearW){
    const label=w.charges>0?`[G] Nabrat (${w.charges}/${w.maxCharges})`:'Prázdná studna';
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(w.x-46,w.y-42,92,16);
    ctx.fillStyle=w.charges>0?'#38bdf8':'#94a3b8';ctx.font='10px Inter,sans-serif';
    ctx.fillText(label,w.x,w.y-33);
  }
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
}

function drawBase(){
  // Glow
  const grad=ctx.createRadialGradient(CX,CY,0,CX,CY,BASE_R*2.5);
  grad.addColorStop(0,'rgba(59,130,246,.25)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(CX,CY,BASE_R*2.5,0,Math.PI*2);ctx.fill();
  // Base circle
  const pct=gs.baseHp/gs.baseMaxHp;
  ctx.fillStyle=pct>0.5?'#1d4ed8':pct>0.25?'#7c3aed':'#7f1d1d';
  ctx.beginPath();ctx.arc(CX,CY,BASE_R,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(147,197,253,.6)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(CX,CY,BASE_R,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='28px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🏠',CX,CY);
  // HP bar above
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(CX-30,CY-BASE_R-14,60,8);
  ctx.fillStyle=pct>0.5?'#3b82f6':pct>0.25?'#a855f7':'#ef4444';
  ctx.fillRect(CX-30,CY-BASE_R-14,60*pct,8);
}

function drawMapWalls(map){
  ctx.fillStyle='#3a3a3a';
  map.walls.forEach(w=>{
    ctx.fillRect(w.x,w.y,w.w,w.h);
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
    ctx.strokeRect(w.x,w.y,w.w,w.h);
  });
}

function drawStructures(){
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const s of gs.structs){
    if(s.hp<=0)continue;
    const def=STRUCT_DEFS[s.type];
    const pct=s.hp/s.maxHp;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.fillRect(s.x+3,s.y+3,s.w,s.h);
    // Body
    ctx.fillStyle=pct>0.5?'#2a3a2a':pct>0.25?'#3a2a10':'#3a1010';
    ctx.fillRect(s.x,s.y,s.w,s.h);
    ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1;
    ctx.strokeRect(s.x,s.y,s.w,s.h);
    // Emoji
    const fs=Math.min(s.w,s.h)*0.6;
    ctx.font=fs+'px serif';
    ctx.fillText(def.emoji,s.x+s.w/2,s.y+s.h/2);
    // HP bar
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(s.x,s.y-6,s.w,4);
    ctx.fillStyle=pct>0.5?'#4ade80':pct>0.25?'#fbbf24':'#ef4444';
    ctx.fillRect(s.x,s.y-6,s.w*pct,4);
  }
}

function drawZombies(ts){
  ctx.textAlign='center';ctx.textBaseline='middle';
  gs.zombies.forEach(z=>{
    const def=z.def;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,.4)';
    ctx.beginPath();ctx.ellipse(z.x,z.y+z.r*.7,z.r*.8,z.r*.35,0,0,Math.PI*2);ctx.fill();
    // Body glow for boss
    if(def.boss){
      ctx.fillStyle='rgba(239,68,68,.15)';
      ctx.beginPath();ctx.arc(z.x,z.y,z.r*1.5,0,Math.PI*2);ctx.fill();
    }
    ctx.font=z.r*1.4+'px serif';
    ctx.fillText(def.emoji,z.x,z.y);
    // HP bar
    const bw=z.r*2.2,bh=4;
    const pct=z.hp/z.maxHp;
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(z.x-bw/2,z.y-z.r-9,bw,bh);
    ctx.fillStyle=pct>0.5?'#4ade80':pct>0.25?'#fbbf24':'#ef4444';
    ctx.fillRect(z.x-bw/2,z.y-z.r-9,bw*pct,bh);
  });
}

function drawBullets(){
  gs.bullets.forEach(b=>{
    if(b.arrow){
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.dy,b.dx));
      ctx.fillStyle=b.col;
      ctx.fillRect(-8,-2,16,4);
      ctx.restore();
    } else {
      ctx.fillStyle=b.col;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
    }
  });
}

function drawPlayers(ts){
  // Draw remote players first
  Object.values(gs.players).forEach(p=>{
    if(!p.alive)return;
    drawPlayerSprite(p.x||CX,p.y||CY,p.angle||0,p.kit||'militant',false,ts);
  });
  // Local player
  const alpha=me.eff.stealth?0.3:1;
  ctx.globalAlpha=alpha;
  drawPlayerSprite(me.x,me.y,me.angle,me.kit,true,ts);
  ctx.globalAlpha=1;
}

function drawPlayerSprite(x,y,angle,kitId,isLocal,ts){
  const kit=KITS[kitId]||KITS.militant;
  const r=PLAYER_R;
  // Shadow
  ctx.fillStyle='rgba(0,0,0,.4)';
  ctx.beginPath();ctx.ellipse(x,y+r*.7,r*.9,r*.4,0,0,Math.PI*2);ctx.fill();
  // Body
  ctx.fillStyle=isLocal?kit.col:'rgba(200,200,200,.8)';
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  // Border
  ctx.strokeStyle=kit.col;ctx.lineWidth=isLocal?2.5:1.5;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  // Emoji
  ctx.font=r*1.2+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#fff';ctx.fillText(kit.emoji,x,y);
  // Weapon direction indicator
  const wx=x+Math.cos(angle)*(r+10);
  const wy=y+Math.sin(angle)*(r+10);
  ctx.strokeStyle=WEAPONS[KITS[kitId]?.weapon||'pistol']?.col||'#fff';
  ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r);ctx.lineTo(wx,wy);ctx.stroke();
}

function drawFloats(){
  ctx.textAlign='center';
  gs.floats.forEach(f=>{
    ctx.globalAlpha=Math.min(1,f.life*2);
    ctx.fillStyle=f.col;
    ctx.font='bold 14px Inter,sans-serif';
    ctx.fillText(f.txt,f.x,f.y);
  });
  ctx.globalAlpha=1;
}

function drawPlacingPreview(){
  if(!placing.active)return;
  const def=STRUCT_DEFS[placing.type];
  let w=def.w,h=def.h;
  if(placing.rot===90||placing.rot===270){w=def.h;h=def.w;}
  const sx=mouse.wx-w/2,sy=mouse.wy-h/2;
  ctx.fillStyle='rgba(99,102,241,.3)';
  ctx.strokeStyle='rgba(99,102,241,.8)';
  ctx.setLineDash([4,4]);
  ctx.fillRect(sx,sy,w,h);
  ctx.lineWidth=2;ctx.strokeRect(sx,sy,w,h);
  ctx.setLineDash([]);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=(Math.min(w,h)*0.6)+'px serif';
  ctx.fillStyle='rgba(255,255,255,.7)';
  ctx.fillText(def.emoji,mouse.wx,mouse.wy);
}

// ══════════════════════════════════════════════════════════
//  FOV RAYCASTING
// ══════════════════════════════════════════════════════════
function drawFOV(){
  if(fovDeg>=360)return;

  // Reuse offscreen canvas for the darkness mask (re-create only on resize)
  if(!_fovCanvas||_fovCanvas.width!==W||_fovCanvas.height!==H){
    _fovCanvas=document.createElement('canvas');
    _fovCanvas.width=W; _fovCanvas.height=H;
    _fovCtx=_fovCanvas.getContext('2d');
  }
  const fc=_fovCtx;

  const sx=me.x-cam.x+W/2;
  const sy=me.y-cam.y+H/2;
  const aimAng=me.angle;
  const half=fovDeg*Math.PI/360;
  const walls=getFovWalls();
  const poly=computeFOVPoly(me.x,me.y,aimAng,half,walls);
  const sPoly=poly.map(p=>({x:p.x-cam.x+W/2,y:p.y-cam.y+H/2}));

  // Fill offscreen with darkness
  fc.clearRect(0,0,W,H);
  fc.fillStyle='rgba(0,0,0,.91)';
  fc.fillRect(0,0,W,H);

  // Punch out the visible cone — leaves the offscreen transparent there
  fc.globalCompositeOperation='destination-out';
  fc.beginPath();
  fc.moveTo(sx,sy);
  sPoly.forEach(p=>fc.lineTo(p.x,p.y));
  fc.closePath();
  fc.fillStyle='rgba(255,255,255,1)';
  fc.fill();
  fc.globalCompositeOperation='source-over';

  // Composite darkness onto main canvas — game world shows through the hole
  ctx.drawImage(_fovCanvas,0,0);

  // Warm light tint inside the cone (drawn on main canvas, normal blend)
  const grad=ctx.createRadialGradient(sx,sy,0,sx,sy,FOV_DIST);
  grad.addColorStop(0,'rgba(255,220,160,.18)');
  grad.addColorStop(0.55,'rgba(255,200,120,.10)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx,sy);
  sPoly.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.closePath();
  ctx.fillStyle=grad;
  ctx.fill();
  ctx.restore();
}

function computeFOVPoly(px,py,aimAng,halfFov,walls){
  const angles=[];
  const steps=200;
  for(let i=0;i<=steps;i++) angles.push(aimAng-halfFov+i/steps*halfFov*2);
  // Add wall corner angles
  for(const w of walls){
    [[w.x,w.y],[w.x+w.w,w.y],[w.x,w.y+w.h],[w.x+w.w,w.y+w.h]].forEach(([cx,cy])=>{
      const a=Math.atan2(cy-py,cx-px);
      const diff=normalizeAngle(a-aimAng);
      if(Math.abs(diff)<halfFov+0.05){angles.push(a-0.001,a,a+0.001);}
    });
  }
  return angles.sort((a,b)=>a-b).map(a=>castRay(px,py,a,walls,FOV_DIST));
}

function castRay(ox,oy,ang,walls,maxDist){
  const dx=Math.cos(ang),dy=Math.sin(ang);
  let t=maxDist;
  for(const w of walls){
    const edges=[
      [w.x,w.y,w.x+w.w,w.y],[w.x+w.w,w.y,w.x+w.w,w.y+w.h],
      [w.x,w.y+w.h,w.x+w.w,w.y+w.h],[w.x,w.y,w.x,w.y+w.h],
    ];
    for(const [x1,y1,x2,y2] of edges){
      const r=raySegIntersect(ox,oy,dx,dy,x1,y1,x2,y2);
      if(r!==null&&r>1&&r<t)t=r;
    }
  }
  return {x:ox+dx*t,y:oy+dy*t};
}

function raySegIntersect(ox,oy,dx,dy,x1,y1,x2,y2){
  const ex=x2-x1,ey=y2-y1;
  const denom=dx*ey-dy*ex;
  if(Math.abs(denom)<1e-8)return null;
  const t=((x1-ox)*ey-(y1-oy)*ex)/denom;
  const u=((x1-ox)*dy-(y1-oy)*dx)/denom;
  if(t<0||u<0||u>1)return null;
  return t;
}

/* ── Toast ───────────────────────────────────────────────── */
function gToast(msg,col='#fff'){
  const el=document.createElement('div');
  el.className='g-toast';
  el.style.color=col;
  el.textContent=msg;
  document.getElementById('gToasts').appendChild(el);
  setTimeout(()=>el.remove(),2900);
}

/* ── Game over ───────────────────────────────────────────── */
function gameOver(win){
  running=false;
  const survived=Math.round((performance.now()-gs.startTime)/1000);
  document.getElementById('overEmoji').textContent=win?'🏆':'💀';
  document.getElementById('overTitle').textContent=win?'Přežil jsi!':'Game Over';
  document.getElementById('overSub').textContent=win?`Přežil jsi ${gs.wave} vln!`:`Základna zničena ve vlně ${gs.wave}`;
  document.getElementById('overStats').innerHTML=
    `Přežito: ${survived}s &nbsp;·&nbsp; Vlna: ${gs.wave} &nbsp;·&nbsp; Zabito: ${me.totalKills}<br>
     Coins: ${me.coins} &nbsp;·&nbsp; Úroveň: ${me.level}`;
  showScreen('over');
}

// ══════════════════════════════════════════════════════════
//  MULTIPLAYER (Firebase Firestore)
// ══════════════════════════════════════════════════════════
let _lastSync=0;
function syncState(ts){
  if(!gs.sessionId)return;
  if(ts-_lastSync<120)return; // sync at ~8fps
  _lastSync=ts;
  syncPlayerState();
  if(gs.isHost) syncHostState();
}

function syncPlayerState(){
  if(!gs.sessionId||!me.uid)return;
  db.collection('survival_lobbies').doc(gs.sessionId)
    .collection('player_states').doc(me.uid)
    .set({x:me.x,y:me.y,angle:me.angle,hp:me.hp,maxHp:me.maxHp,
          coins:me.coins,xp:me.xp,level:me.level,alive:me.alive,
          kit:me.kit,name:me.name,ts:Date.now()},{merge:true})
    .catch(()=>{});
}

function syncHostState(){
  if(!gs.sessionId)return;
  // Sync game state (wave, base HP, zombies - simplified)
  db.collection('survival_lobbies').doc(gs.sessionId)
    .update({wave:gs.wave,baseHp:gs.baseHp,phase:gs.phase,ts:Date.now()})
    .catch(()=>{});
}

function syncStructures(){
  if(!gs.sessionId)return;
  db.collection('survival_lobbies').doc(gs.sessionId)
    .update({structs:gs.structs.map(s=>({id:s.id,type:s.type,x:s.x,y:s.y,w:s.w,h:s.h,rot:s.rot,hp:s.hp,maxHp:s.maxHp}))})
    .catch(()=>{});
}

function sendCoins(targetPlayer,amount){
  if(me.coins<amount){gToast('Nemáš dost coinů!','#ef4444');return;}
  me.coins-=amount;
  db.collection('survival_lobbies').doc(gs.sessionId)
    .collection('coin_transfers').add({from:me.uid,to:targetPlayer.uid,amount,ts:Date.now()})
    .catch(()=>{});
  gToast(`Posláno ${amount}💰 hráči ${targetPlayer.name}`,'#fbbf24');
}

// ══════════════════════════════════════════════════════════
//  LOBBY
// ══════════════════════════════════════════════════════════
async function joinLobby(lobbyId){
  try{
    const ref=db.collection('survival_lobbies').doc(lobbyId);
    const snap=await ref.get();
    if(!snap.exists){gToast('Lobby nenalezeno','#ef4444');showScreen('kit');return;}
    const data=snap.data();

    // Check if host
    gs.isHost=(data.hostId===me.uid);
    if(gs.isHost) document.getElementById('lobbyStartBtn').style.display='block';
    document.getElementById('lobbyCode').textContent=lobbyId.slice(0,6).toUpperCase();
    document.getElementById('kitLbl').textContent=(KITS[kitSel.kit]?.emoji||'')+' '+(KITS[kitSel.kit]?.name||'');

    // Add self to lobby
    await ref.update({
      [`players.${me.uid}`]:{uid:me.uid,name:me.name,kit:kitSel.kit,ready:false}
    });

    // Set map from lobby (host sets it)
    if(!gs.isHost&&data.mapId!==undefined) kitSel.mapId=data.mapId;

    // Listen for lobby changes
    gs.unsubLobby=ref.onSnapshot(snap2=>{
      const d=snap2.data();
      if(!d)return;
      renderLobbyPlayers(d.players||{});
      if(d.status==='playing'&&gs.screen==='lobby'){
        kitSel.mapId=d.mapId||0;
        applyKitSelection();
        initGame();
        subscribePlayerStates();
        subscribeLobbyGameState();
        showScreen('game');
        buildBuildBar(); buildAbilBar();
        running=true; requestAnimationFrame(loop);
      }
    });
  } catch(e){
    console.error(e);
    gToast('Chyba při připojení','#ef4444');
  }
}

function renderLobbyPlayers(players){
  const container=document.getElementById('lobbyPlayers');
  container.innerHTML='';
  Object.values(players).forEach(p=>{
    const row=document.createElement('div');
    row.className='lobby-row';
    row.innerHTML=`<span>${KITS[p.kit]?.emoji||'?'} ${p.name||'Hráč'}</span>
      <span style="color:${p.ready?'#4ade80':'#666'};font-size:.78rem;">${p.ready?'✓ Připraven':'Čeká…'}</span>`;
    container.appendChild(row);
  });
  const count=Object.keys(players).length;
  const ready=Object.values(players).filter(p=>p.ready).length;
  document.getElementById('lobbyStatus').textContent=`${ready}/${count} hráčů připraveno`;
}

async function setReady(){
  if(!gs.sessionId)return;
  const btn=document.getElementById('lobbyReadyBtn');
  btn.disabled=true;
  await db.collection('survival_lobbies').doc(gs.sessionId)
    .update({[`players.${me.uid}.ready`]:true,[`players.${me.uid}.kit`]:kitSel.kit}).catch(()=>{});
  btn.textContent='✓ Čekám…';
}

async function hostStartGame(){
  if(!gs.sessionId||!gs.isHost)return;
  await db.collection('survival_lobbies').doc(gs.sessionId)
    .update({status:'playing',mapId:kitSel.mapId,startedAt:Date.now()}).catch(()=>{});
}

function subscribePlayerStates(){
  gs.unsubPlayers=db.collection('survival_lobbies').doc(gs.sessionId)
    .collection('player_states').onSnapshot(snap=>{
      snap.forEach(doc=>{
        if(doc.id!==me.uid) gs.players[doc.id]={...doc.data(),uid:doc.id};
      });
    });
}

function subscribeLobbyGameState(){
  db.collection('survival_lobbies').doc(gs.sessionId).onSnapshot(snap=>{
    const d=snap.data();
    if(!d||!gs.isHost)return; // non-hosts sync base HP
    if(!gs.isHost&&d.baseHp!==undefined) gs.baseHp=d.baseHp;
    if(!gs.isHost&&d.wave!==undefined) gs.wave=d.wave;
    // Sync structures from host
    if(!gs.isHost&&d.structs){
      gs.structs=d.structs.map(s=>({...s,def:STRUCT_DEFS[s.type],lastShot:0,zombieHits:{}}));
    }
    // Listen for incoming coin transfers
    db.collection('survival_lobbies').doc(gs.sessionId)
      .collection('coin_transfers').where('to','==',me.uid)
      .where('ts','>',Date.now()-5000)
      .onSnapshot(snap2=>{
        snap2.docChanges().forEach(ch=>{
          if(ch.type==='added'){
            me.coins+=ch.doc.data().amount;
            gToast(`+${ch.doc.data().amount}💰 od spoluhráče!`,'#fbbf24');
          }
        });
      });
  });
}

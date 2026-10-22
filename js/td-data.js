// ═══ td-data.js — data hry Obrana království (vygenerováno z _dev/td/build-data.js)
// Věže, upgrady, hrdinové, slizáci, vlny, mapy a ekonomika. Neupravovat ručně — změny dělej v build-data.js.
window.TD = {
 "towers": [
  {
   "id": "kralovsky_lucistnik",
   "name": "Královský lučištník",
   "cat": "basic",
   "desc": "Rychlý a levný střelec s krátkým lukem, který pálí ostré šípy po jednotlivých slizácích.",
   "col": "#16a34a",
   "ico": "🏹",
   "short": "Lučištník",
   "base": {
    "cost": 220,
    "range_px": 140,
    "damage": 1,
    "attack_interval_s": 0.85,
    "pierce": 1,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 18
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Kované hroty",
      "cost": 120,
      "km": 0,
      "fx": {
       "pierce_add": 1
      },
      "desc": "Šípy proletí o 1 slizáka navíc (celkový průraz 2).",
      "visual": "Šípy v toulci mají lesklé ocelové špičky a lučištník dostane kožený nátepník."
     },
     {
      "tier": 2,
      "name": "Zpětné háčky",
      "cost": 210,
      "km": 0,
      "fx": {
       "pierce_add": 2,
       "damage_add": 1
      },
      "desc": "Zvyšuje průraz o +2 (celkem 4) a poškození o +1 (celkem 2).",
      "visual": "Luk je vyztužen kovovými pláty a šípy mají dvojité zubaté ostří."
     },
     {
      "tier": 3,
      "name": "Trojitá salva",
      "cost": 650,
      "km": 0,
      "fx": {
       "projectiles_set": 3,
       "spread_deg": 18
      },
      "desc": "Lučištník založí a vystřelí 3 šípy najednou v mírném vějíři.",
      "visual": "Střelec má modrou královskou kápi a na tětivě drží tři šípy najednou."
     },
     {
      "tier": 4,
      "name": "Velitel lučištníků",
      "cost": 2200,
      "km": 2,
      "fx": {
       "projectiles_set": 5,
       "damage_add": 2,
       "bonus_boss_damage": 3
      },
      "desc": "Střílí vějíř 5 šípů, zvyšuje poškození o +2 (celkem 4) a dává +3 poškození do slizových králů.",
      "visual": "Postava v lesklé kroužkové zbroji se zlatým lemováním a velkým reflexním lukem."
     },
     {
      "tier": 5,
      "name": "Pán větrného luku",
      "cost": 14500,
      "km": 5,
      "fx": {
       "projectiles_set": 7,
       "damage_add": 6,
       "pierce_add": 6,
       "damage_type_set": "true"
      },
      "desc": "Střílí 7 masivních zářících šípů (poškození 10, průraz 10), které prorazí veškeré imunity i železné helmy.",
      "visual": "Vznešený ostrostřelec ve zlaté zbroji s vlajícím pláštěm a lukem ze zářícího bílého dřeva."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Pružná tětiva",
      "cost": 140,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.8
      },
      "desc": "Zkracuje interval střelby na 80 % (z 0.85 s na 0.68 s).",
      "visual": "Tětiva luku je spletená ze zeleného hedvábí a lučištník má lehčí rukavice."
     },
     {
      "tier": 2,
      "name": "Hbité prsty",
      "cost": 260,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.75
      },
      "desc": "Další zrychlení střelby na 75 % (interval 0.51 s).",
      "visual": "Lučištník má u pasu druhý otevřený toulec pro okamžité nabíjení."
     },
     {
      "tier": 3,
      "name": "Sokolí oko",
      "cost": 820,
      "km": 0,
      "fx": {
       "crit_chance": 0.2,
       "crit_multiplier": 4,
       "damage_add": 1
      },
      "desc": "Zvyšuje poškození o +1 a každý výstřel má 20% šanci udělit 4× kritické poškození.",
      "visual": "Střelec má přes čelo červenou čelenku se sokolím perem."
     },
     {
      "tier": 4,
      "name": "Blesková salva",
      "cost": 2800,
      "km": 2,
      "fx": {
       "attack_interval_mult": 0.7,
       "ability": {
        "name": "Déšť šípů",
        "cooldown_s": 30,
        "duration_s": 8,
        "effect": "Na 8 sekund ztrojnásobí rychlost střelby tohoto lučištníka a dá mu 50% šanci na kritický zásah."
       }
      },
      "desc": "Základní interval klesá na 0.36 s. Odemkne aktivní schopnost Déšť šípů.",
      "visual": "Kolem luku přeskakují oranžové jiskry a toulec je naplněn šípy se zlatými letkami."
     },
     {
      "tier": 5,
      "name": "Mistr tisíce šípů",
      "cost": 16000,
      "km": 5,
      "fx": {
       "attack_interval_set": 0.08,
       "crit_chance": 0.35,
       "crit_multiplier": 5,
       "ability_upgrade": {
        "name": "Královská salva",
        "cooldown_s": 35,
        "duration_s": 10,
        "effect": "Na 10 sekund zvýší rychlost střelby VŠECH Královských lučištníků na mapě o 150 % a umožní jim ničit Přilboslizy."
       }
      },
      "desc": "Neuvěřitelná kadence (12.5 výstřelů za sekundu) s 35% šancí na 5× kritický zásah. Schopnost posiluje všechny lučištníky na mapě.",
      "visual": "Legendární lukostřelec obklopený větrným vírem, jehož ruce se při střelbě pohybují rychleji než oko postřehne."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Dlouhý luk",
      "cost": 100,
      "km": 0,
      "fx": {
       "range_add_px": 35
      },
      "desc": "Zvyšuje dostřel věže o +35 px (na 175 px).",
      "visual": "Výrazně delší tisový luk a lučištník stojí na dřevěném stupínku."
     },
     {
      "tier": 2,
      "name": "Sovy v očích",
      "cost": 220,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "range_add_px": 25,
       "camo_damage_bonus": 1
      },
      "desc": "Odhalí a zasáhne průhledné Duchslizy, kterým dává +1 poškození navíc. Dostřel +25 px (celkem 200 px).",
      "visual": "Lučištník má zelenou hraničářskou kuklu a svítící jantarové oči."
     },
     {
      "tier": 3,
      "name": "Těžká kuše",
      "cost": 900,
      "km": 0,
      "fx": {
       "damage_add": 3,
       "pierce_add": 4,
       "range_add_px": 50
      },
      "desc": "Mění luk za těžkou kuši: +3 poškození, +4 průraz a +50 px dostřel (celkem 250 px).",
      "visual": "Voják třímá masivní dřevěno-ocelovou kuši s napínacím rumpálem."
     },
     {
      "tier": 4,
      "name": "Ostrostřelec s arbalestem",
      "cost": 3100,
      "km": 2,
      "fx": {
       "damage_add": 6,
       "pierce_add": 5,
       "damage_type_set": "energy",
       "bounce_targets": 2
      },
      "desc": "Šipky dělají +6 poškození, prorazí železné helmy a po zásahu se odrazí až na 2 další slizáky v okolí.",
      "visual": "Těžký ocelový arbalest se zářícími runami na lučišti."
     },
     {
      "tier": 5,
      "name": "Lovec slizových králů",
      "cost": 17500,
      "km": 5,
      "fx": {
       "range_add_px": 100,
       "damage_add": 25,
       "pierce_add": 15,
       "damage_type_set": "true",
       "guaranteed_crit_every_n_shots": 3
      },
      "desc": "Obrovský dostřel (350 px), +25 poškození a každý 3. výstřel vyvolá výbuch za 120 pravého poškození.",
      "visual": "Mistr ostrostřelec v temně fialové zbroji s obří opakovací kuší posázenou zářícími krystaly."
     }
    ]
   ]
  },
  {
   "id": "cepova_vez",
   "name": "Čepová věž",
   "cat": "basic",
   "desc": "Mechanická obranná věž s krátkým dosahem, která vystřeluje železné hroty do všech směrů kolem sebe a drtí shluky slizáků.",
   "col": "#78716c",
   "ico": "⚙️",
   "short": "Čepová věž",
   "base": {
    "cost": 300,
    "range_px": 95,
    "damage": 1,
    "attack_interval_s": 1.1,
    "pierce": 2,
    "projectiles": 8,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Namazaná soukolí",
      "cost": 160,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.78
      },
      "desc": "Zkracuje interval výstřelů na 0.86 s.",
      "visual": "Dřevěný sud věže je zpevněn mosaznými obručemi a ozubenými koly."
     },
     {
      "tier": 2,
      "name": "Rozžhavené hřeby",
      "cost": 320,
      "km": 0,
      "fx": {
       "damage_type_set": "energy",
       "damage_add": 1
      },
      "desc": "Vystřeluje rudě žhnoucí hřeby (+1 poškození), které roztaví i železné helmy Přilboslizů.",
      "visual": "Uvnitř věže plane kovářská výheň a ze střílen stoupá dým."
     },
     {
      "tier": 3,
      "name": "Chrlič plamenů",
      "cost": 950,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.7,
       "burn_dps": 3,
       "burn_duration_s": 3
      },
      "desc": "Rychlý útok (0.60 s), který slizáky zapálí – hoří za 3 poškození za sekundu po dobu 3 s.",
      "visual": "Osm měděných dračích hlav po obvodu věže chrlících oheň."
     },
     {
      "tier": 4,
      "name": "Ohnivý prstenec",
      "cost": 3400,
      "km": 2,
      "fx": {
       "continuous_aura": true,
       "attack_interval_set": 0.25,
       "damage_set": 3,
       "pierce_set": 40,
       "range_add_px": 15
      },
      "desc": "Místo jednotlivých střel vytváří neustálé ohnivé vlny kolem sebe (každých 0.25 s dá 3 poškození až 40 slizákům).",
      "visual": "Železná bašta obklopená trvalým rotujícím kruhem oranžového ohně."
     },
     {
      "tier": 5,
      "name": "Sopečná výheň",
      "cost": 18500,
      "km": 5,
      "fx": {
       "damage_set": 12,
       "pierce_set": 100,
       "range_add_px": 30,
       "damage_type_set": "true",
       "meteor_interval_s": 2,
       "meteor_damage": 150
      },
      "desc": "Spaluje vše v okruhu 140 px (48 poškození za sekundu) a každé 2 sekundy vystřelí ohnivý balvan na nejsilnějšího slizáka na mapě za 150 poškození.",
      "visual": "Čedičová věž plná žhnoucí lávy, z jejíhož vrcholu vylétávají ohnivé meteory."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Silnější pružiny",
      "cost": 130,
      "km": 0,
      "fx": {
       "range_add_px": 25
      },
      "desc": "Zvyšuje dosah věže o +25 px (na 120 px).",
      "visual": "Delší kovové hlavně vyčnívající z boků věže."
     },
     {
      "tier": 2,
      "name": "Těžké čepy",
      "cost": 270,
      "km": 0,
      "fx": {
       "pierce_add": 4,
       "range_add_px": 15
      },
      "desc": "Každý hrot projde o +4 slizáky více (průraz 6) a dosah stoupne na 135 px.",
      "visual": "Věž je pobitá silnými ocelovými pláty."
     },
     {
      "tier": 3,
      "name": "Vrhač čepelí",
      "cost": 880,
      "km": 0,
      "fx": {
       "projectiles_set": 12,
       "damage_add": 1,
       "strip_regrow": true
      },
      "desc": "Vystřeluje 12 ostrých rotujících disků (+1 poškození), které zasaženým slizákům trvale seberou schopnost dorůstání.",
      "visual": "Kolem středu věže se točí prstenec ozubených ocelových čepelí."
     },
     {
      "tier": 4,
      "name": "Smršť čepelí",
      "cost": 2900,
      "km": 2,
      "fx": {
       "damage_add": 2,
       "ability": {
        "name": "Kobercový výmet",
        "cooldown_s": 25,
        "effect": "Vystřelí 60 obřích ozubených kol přes celou obrazovku; každé udělí 15 poškození a odhalí Duchslizy na 10 s."
       }
      },
      "desc": "Čepele dělají 4 poškození. Odemkne schopnost Kobercový výmet.",
      "visual": "Vysoká kovová věž se třemi patry lesklých pilových kotoučů."
     },
     {
      "tier": 5,
      "name": "Královský mlýnek",
      "cost": 15500,
      "km": 5,
      "fx": {
       "damage_add": 5,
       "pierce_add": 10,
       "attack_interval_mult": 0.6,
       "ability_upgrade": {
        "name": "Bouře tisíce čepelí",
        "cooldown_s": 20,
        "effect": "Po dobu 6 sekund chrlí nepřetržitý proud čepelí přes celou mapu (každá dá 35 pravého poškození)."
       }
      },
      "desc": "Extrémní plošný drtič. Schopnost po dobu 6 sekund zaplaví celou mapu smrtícími čepelemi.",
      "visual": "Zlatocerná mechanická pevnost s obřími vířícími kosami na vrcholu."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Více střílen",
      "cost": 150,
      "km": 0,
      "fx": {
       "projectiles_add": 4
      },
      "desc": "Přidá +4 hroty do každého výstřelu (celkem 12 střel v kruhu).",
      "visual": "Mezi hlavními střílnami přibudou čtyři další otvory."
     },
     {
      "tier": 2,
      "name": "Ježkova hradba",
      "cost": 300,
      "km": 0,
      "fx": {
       "projectiles_add": 4,
       "damage_add": 1
      },
      "desc": "Celkem 16 hrotů v kruhu a +1 poškození pro každý z nich.",
      "visual": "Věž vypadá jako ocelový ježek plný vyčnívajících hrotů."
     },
     {
      "tier": 3,
      "name": "Drtič obrů",
      "cost": 1100,
      "km": 0,
      "fx": {
       "bonus_moab_damage": 2,
       "attack_interval_mult": 0.8
      },
      "desc": "Zrychluje střelbu o 20 % a každý hrot dává +2 bonusové poškození do velkých cílů a slizových králů.",
      "visual": "Černo-zlaté pruhování na plášti a masivní kovová kopí ve střílnách."
     },
     {
      "tier": 4,
      "name": "Hodinový stroj",
      "cost": 3200,
      "km": 2,
      "fx": {
       "projectiles_set": 24,
       "attack_interval_mult": 0.6,
       "pierce_add": 2
      },
      "desc": "Vystřeluje 24 hrotů současně s o 40 % vyšší kadencí. Pokud stojí přímo u zatáčky, zničí cokoliv.",
      "visual": "Dvojitý prstenec hlavní poháněný viditelným parním strojem na vrcholu."
     },
     {
      "tier": 5,
      "name": "Pevnost tisíce hrotů",
      "cost": 16800,
      "km": 5,
      "fx": {
       "projectiles_set": 32,
       "range_add_px": 45,
       "damage_add": 4,
       "bonus_moab_damage": 5,
       "damage_type_set": "normal"
      },
      "desc": "Vystřeluje 32 hrotů s výrazně větším dosahem a obrovským poškozením do slizových králů. Prorazí všechny typy brnění.",
      "visual": "Mohutná trpasličí bašta s 32 zlatými hlavněmi a rotující královskou korunou nad střechou."
     }
    ]
   ]
  },
  {
   "id": "mrazivy_mag",
   "name": "Mrazivý mág",
   "cat": "basic",
   "desc": "Čaroděj severního větru, který v okruhu kolem sebe zmrazí a znehybní slizáky.",
   "col": "#38bdf8",
   "ico": "❄️",
   "short": "Mrazivý mág",
   "base": {
    "cost": 350,
    "range_px": 105,
    "damage": 1,
    "attack_interval_s": 1.8,
    "pierce": 25,
    "projectiles": 1,
    "damage_type": "freeze",
    "freeze_duration_s": 1.2,
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Křehký led",
      "cost": 180,
      "km": 0,
      "fx": {
       "allow_sharp_on_frozen": true,
       "freeze_duration_add_s": 0.3
      },
      "desc": "Zmrazení trvá 1.5 s a zmrazení slizáci mohou být zasaženi i Ostrými střelami ostatních věží.",
      "visual": "Mág má světle modré roucho a na vrcholu hole se třpytí ostrý ledový krystal."
     },
     {
      "tier": 2,
      "name": "Mrazivé prozření",
      "cost": 310,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "strip_camo_on_hit": true,
       "damage_add": 1
      },
      "desc": "Vidí průhledné Duchslizy, při zásahu je trvale zviditelní a způsobí o +1 poškození více.",
      "visual": "Kolem mága poletují jiskřivé sněhové vločky a jeho oči modře září."
     },
     {
      "tier": 3,
      "name": "Runa křehkosti",
      "cost": 1350,
      "km": 0,
      "fx": {
       "debuff_incoming_damage_add": 1,
       "strip_lead": true
      },
      "desc": "Všichni zasažení slizáci dostávají od JAKÉKOLIV věže o +1 poškození více a rozpadnou se jim železné helmy.",
      "visual": "Mág stojí na ledovém podstavci s vytesanými modrými runami."
     },
     {
      "tier": 4,
      "name": "Pán jinovatky",
      "cost": 3800,
      "km": 2,
      "fx": {
       "debuff_incoming_damage_add": 3,
       "affect_moab": true,
       "attack_interval_mult": 0.75
      },
      "desc": "Zasažení slizáci (včetně slizových králů!) dostávají od všech věží o +4 poškození navíc do každého zásahu.",
      "visual": "Mág v královském plášti z bílého hermelínu obklopený polární září."
     },
     {
      "tier": 5,
      "name": "Král věčné zimy",
      "cost": 21000,
      "km": 5,
      "fx": {
       "debuff_incoming_damage_add": 6,
       "range_add_px": 50,
       "damage_add": 10,
       "slow_moab_pct": 0.35
      },
      "desc": "Všichni zasažení slizáci včetně králů jsou zpomaleni o 35 % a dostávají o +7 poškození navíc z každého zásahu všech věží.",
      "visual": "Vznášející se bytost z čistého ledu s ledovou korunou, kolem které praská země mrazem."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Chladný van",
      "cost": 150,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.8,
       "pierce_add": 10
      },
      "desc": "Zkracuje interval mrazivého kouzla na 1.44 s a zvyšuje průraz na 35.",
      "visual": "Mág třímá v druhé ruce modrý magický vějíř."
     },
     {
      "tier": 2,
      "name": "Severák",
      "cost": 340,
      "km": 0,
      "fx": {
       "slow_after_thaw_pct": 0.3,
       "slow_duration_s": 3
      },
      "desc": "I po rozmrazení zůstávají slizáci zpomaleni o 30 % po dobu 3 sekund.",
      "visual": "Kolem nohou mága se neustále točí malá sněhová vánice."
     },
     {
      "tier": 3,
      "name": "Polární aura",
      "cost": 1200,
      "km": 0,
      "fx": {
       "passive_aura_slow_pct": 0.4,
       "range_add_px": 30,
       "freeze_on_water_allow_land_towers": true
      },
      "desc": "Trvale zpomaluje všechny běžné slizáky v dosahu (135 px) o 40 %. Pokud stojí u vody, zmrazí hladinu a umožní na ni stavět pozemní věže!",
      "visual": "Země pod mágem je pokrytá sněhem a ze středu stoupá mrazivý sloup."
     },
     {
      "tier": 4,
      "name": "Sněhová vánice",
      "cost": 3300,
      "km": 2,
      "fx": {
       "range_add_px": 25,
       "ability": {
        "name": "Velká vánice",
        "cooldown_s": 35,
        "effect": "Okamžitě zmrazí všechny běžné slizáky na celé mapě na 5 sekund a slizové krále zpomalí o 50 % na 5 sekund."
       }
      },
      "desc": "Dosah aury 160 px. Odemkne celomapovou schopnost Velká vánice.",
      "visual": "Nad mágem se vznáší sněhový mrak, ze kterého hustě sněží."
     },
     {
      "tier": 5,
      "name": "Posel doby ledové",
      "cost": 16500,
      "km": 5,
      "fx": {
       "passive_aura_slow_pct": 0.6,
       "ability_upgrade": {
        "name": "Zmrazení času",
        "cooldown_s": 30,
        "effect": "Zmrazí celou mapu včetně slizových králů na 7 sekund, udělí všem 200 poškození a zkrátí přebíjení ostatních věží o 5 sekund."
       }
      },
      "desc": "Aura zpomaluje o 60 %. Schopnost zastaví i slizové krále na celé mapě na 7 sekund.",
      "visual": "Majestátní ledová svatyně s obřím azurovým krystalem uprostřed."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Ledové koule",
      "cost": 200,
      "km": 0,
      "fx": {
       "attack_mode_set": "projectile",
       "range_add_px": 75,
       "pierce_set": 8,
       "explosion_radius_px": 45
      },
      "desc": "Místo kruhového pulzu kolem sebe vrhá mrazivé koule na dálku (dosah 180 px), které vybuchují v poloměru 45 px.",
      "visual": "Mág má dlouhé žezlo, ze kterého vystřeluje sněhové koule."
     },
     {
      "tier": 2,
      "name": "Druhý mráz",
      "cost": 350,
      "km": 0,
      "fx": {
       "can_refreeze": true,
       "damage_add": 1,
       "attack_interval_mult": 0.8
      },
      "desc": "Dokáže znovu zasáhnout a poškodit už zmrazené slizáky (+1 poškození, rychlejší kouzlení).",
      "visual": "Žezlo má dvě zkřížené ledové čepele."
     },
     {
      "tier": 3,
      "name": "Krupobití rampouchů",
      "cost": 1400,
      "km": 0,
      "fx": {
       "damage_add": 3,
       "shatter_spikes_on_hit": 6,
       "spike_damage": 2
      },
      "desc": "Každý zasažený slizák je obalen rampouchy – při zásahu z něj vylétnou 6 ledových střepů, které zraňují okolní slizáky.",
      "visual": "Rukávy mága jsou lemovány ostrými ledovými ostny."
     },
     {
      "tier": 4,
      "name": "Kopí severu",
      "cost": 3600,
      "km": 2,
      "fx": {
       "range_add_px": 60,
       "can_freeze_moab": true,
       "moab_damage_bonus": 12
      },
      "desc": "Dosah 240 px. Ledová kopí dokážou na 0.8 s přimrazit na místě i menší slizové krále a dávají jim +12 poškození.",
      "visual": "Mág v těžké ledové zbroji vrhající obří oštěpy z čistého ledu."
     },
     {
      "tier": 5,
      "name": "Titán ledovce",
      "cost": 19500,
      "km": 5,
      "fx": {
       "damage_add": 20,
       "moab_damage_bonus": 45,
       "attack_interval_set": 0.9,
       "damage_type_set": "true"
      },
      "desc": "Každých 0.9 s vystřelí obří ledovec, který drtí slizové krále (69 poškození do králů) a při výbuchu zanechá na cestě ledovou past.",
      "visual": "Obří ledový golem s runovým dělem na rameni."
     }
    ]
   ]
  },
  {
   "id": "orli_ostrostrelec",
   "name": "Orlí ostrostřelec",
   "cat": "military",
   "desc": "Hraničář na vysoké hlásce s neomezeným dostřelem po celé mapě. Zaměřuje jednotlivé slizáky s dokonalou přesností.",
   "col": "#a16207",
   "ico": "🦅",
   "short": "Ostrostřelec",
   "base": {
    "cost": 380,
    "range_px": 2000,
    "damage": 2,
    "attack_interval_s": 1.5,
    "pierce": 1,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 18
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Těžké střely",
      "cost": 300,
      "km": 0,
      "fx": {
       "damage_add": 2,
       "damage_type_set": "normal"
      },
      "desc": "Zvyšuje poškození na 4 a střely prorazí železné helmy Přilboslizů i zmrazené slizáky.",
      "visual": "Dlouhá puška s mosazným kováním na dřevěné hlásce."
     },
     {
      "tier": 2,
      "name": "Stříbrné kule",
      "cost": 550,
      "km": 0,
      "fx": {
       "damage_add": 3
      },
      "desc": "Zvyšuje poškození o +3 (celkem 7 poškození na ránu – rozbije 7 vrstev slizáka najednou).",
      "visual": "Střelec má přes hruď pás s velkými stříbrnými patronami."
     },
     {
      "tier": 3,
      "name": "Průrazná arkebuza",
      "cost": 1800,
      "km": 0,
      "fx": {
       "damage_add": 13,
       "bonus_ceramic_damage": 10
      },
      "desc": "Uděluje 20 poškození na výstřel (30 do těžkých slizáků), čímž okamžitě maže středně silné nepřátele.",
      "visual": "Mohutná trpasličí puška podepřená ocelovou vidlicí."
     },
     {
      "tier": 4,
      "name": "Ochromující zásah",
      "cost": 4800,
      "km": 2,
      "fx": {
       "damage_add": 20,
       "stun_moab_duration_s": 1.5
      },
      "desc": "Uděluje 40 poškození a každý zásah do slizového krále ho na 1.5 sekundy úplně přišpendlí na místě.",
      "visual": "Hlaveň pušky je obtočena zlatými runami a při výstřelu zanechává rudou stopu."
     },
     {
      "tier": 5,
      "name": "Popravčí králů",
      "cost": 22000,
      "km": 5,
      "fx": {
       "damage_add": 100,
       "stun_moab_duration_s": 3,
       "target_takes_extra_damage_from_all": 5
      },
      "desc": "Uděluje 140 poškození, zastaví slizového krále na 3 s a zasažený král dostává od všech ostatních věží na mapě o +5 poškození více.",
      "visual": "Elitní lovec v černo-rudé dračí zbroji s obří runovou puškou."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Noční kukátko",
      "cost": 250,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "camo_damage_bonus": 2
      },
      "desc": "Odhalí průhledné Duchslizy po celé mapě a dává jim +2 poškození.",
      "visual": "Na pušce je připevněn dalekohled se zelenou alchymistickou čočkou."
     },
     {
      "tier": 2,
      "name": "Tříštivé střely",
      "cost": 450,
      "km": 0,
      "fx": {
       "shrapnel_count": 5,
       "shrapnel_damage": 1,
       "shrapnel_pierce": 3
      },
      "desc": "Po zásahu cíle vylétne v kuželu za něj 5 ostrých úlomků, které zraňují další slizáky.",
      "visual": "Ústí hlavně má rozšířený zubatý tvar."
     },
     {
      "tier": 3,
      "name": "Odrážedlo",
      "cost": 1650,
      "km": 0,
      "fx": {
       "bounce_targets": 3,
       "pierce_add": 2
      },
      "desc": "Kule se po zásahu automaticky odrazí až na 3 další slizáky v okruhu 120 px (z každého odrazu vylétnou i úlomky!).",
      "visual": "Na ochozu hlásky sedí cvičený zlatý orel."
     },
     {
      "tier": 4,
      "name": "Královská zásilka",
      "cost": 4200,
      "km": 2,
      "fx": {
       "bounce_targets": 5,
       "damage_add": 2,
       "ability": {
        "name": "Shoz pokladu",
        "cooldown_s": 45,
        "effect": "Orel shodí na mapu truhlici s 1 100 zlaťáky.",
        "gold": 1100
       }
      },
      "desc": "Střela skáče na 5 cílů. Aktivní schopnost přinese 1 100 zl každých 45 s.",
      "visual": "Hláska s praporem královské pokladnice a bidýlkem pro obřího orla."
     },
     {
      "tier": 5,
      "name": "Velmistr královské stráže",
      "cost": 18000,
      "km": 5,
      "fx": {
       "damage_add": 6,
       "attack_interval_mult": 0.6,
       "buff_all_snipers_speed_pct": 0.35,
       "ability_upgrade": {
        "name": "Královská daň",
        "cooldown_s": 45,
        "effect": "Shodí truhlu s 2 500 zl a opraví 10 životů hradní brány.",
        "gold": 2500,
        "lives": 10
       }
      },
      "desc": "Zrychlí všechny Orlí ostrostřelce na mapě o 35 % a shazuje bohaté královské truhly.",
      "visual": "Zlatem zdobená kamenná věž s královským gryfem na střeše."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Rychlé nabíjení",
      "cost": 260,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.72
      },
      "desc": "Zkracuje interval střelby z 1.5 s na 1.08 s.",
      "visual": "Střelec má u ruky otevřený měšec s připraveným střelným prachem."
     },
     {
      "tier": 2,
      "name": "Dvojhlavňová puška",
      "cost": 420,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.7
      },
      "desc": "Zkracuje interval střelby na 0.75 s.",
      "visual": "Puška má dvě hlavně nad sebou."
     },
     {
      "tier": 3,
      "name": "Opakovací buben",
      "cost": 1500,
      "km": 0,
      "fx": {
       "attack_interval_set": 0.28
      },
      "desc": "Trojnásobné zrychlení střelby (interval 0.28 s – více než 3.5 výstřelu za sekundu po celé mapě).",
      "visual": "Mechanická puška s velkým otočným bubnem na náboje."
     },
     {
      "tier": 4,
      "name": "Hradní varhany",
      "cost": 3900,
      "km": 2,
      "fx": {
       "attack_interval_set": 0.14,
       "bonus_moab_damage": 2
      },
      "desc": "Kulometná střelba přes celou mapu (7.1 výstřelů za sekundu) s +2 poškozením do slizových králů.",
      "visual": "Otočná vícehlavňová puška na kliku, ze které se neustále kouří."
     },
     {
      "tier": 5,
      "name": "Strážce horizontu",
      "cost": 17200,
      "km": 5,
      "fx": {
       "attack_interval_set": 0.07,
       "damage_add": 2,
       "bonus_moab_damage": 4,
       "speed_boost_per_leak_pct": 1
      },
      "desc": "Střílí 14× za sekundu po celé mapě! Čím blíž jsou slizáci k hradní bráně, tím větší poškození jim dává (až +100 %).",
      "visual": "Parní rotační dělo v platinovém krytu chrlící nepřetržitý proud střel."
     }
    ]
   ]
  },
  {
   "id": "oblehaci_katapult",
   "name": "Obléhací katapult",
   "cat": "military",
   "desc": "Těžký dělostřelecký stroj, který vrhá výbušné soudky se střelným prachem. Ničí celé skupiny i Přilboslizy.",
   "col": "#b45309",
   "ico": "💣",
   "short": "Katapult",
   "base": {
    "cost": 450,
    "range_px": 165,
    "damage": 1,
    "attack_interval_s": 1.4,
    "pierce": 18,
    "projectiles": 1,
    "explosion_radius_px": 45,
    "damage_type": "explosion",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 22
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Větší soudky",
      "cost": 220,
      "km": 0,
      "fx": {
       "explosion_radius_add_px": 15,
       "pierce_add": 8
      },
      "desc": "Zvyšuje poloměr výbuchu na 60 px a průraz na 26 slizáků.",
      "visual": "Ve lžíci katapultu leží dvakrát větší soudek s hořícím doutnákem."
     },
     {
      "tier": 2,
      "name": "Těžký prach",
      "cost": 400,
      "km": 0,
      "fx": {
       "damage_add": 1,
       "pierce_add": 10
      },
      "desc": "Výbuch způsobuje 2 poškození všem v okruhu a zasáhne až 36 slizáků.",
      "visual": "Rameno katapultu je zpevněné železnými pláty."
     },
     {
      "tier": 3,
      "name": "Hromový moždíř",
      "cost": 1250,
      "km": 0,
      "fx": {
       "damage_add": 2,
       "pierce_add": 24,
       "explosion_radius_add_px": 15
      },
      "desc": "Masivní exploze (poloměr 75 px), která udělí 4 poškození až 60 slizákům najednou.",
      "visual": "Katapult je přestavěn na obří bronzový moždíř se širokým hrdlem."
     },
     {
      "tier": 4,
      "name": "Otřes země",
      "cost": 3500,
      "km": 2,
      "fx": {
       "stun_duration_s": 1.3,
       "damage_add": 2
      },
      "desc": "Uděluje 6 plošného poškození a na 1.3 sekundy omráčí (zastaví) všechny běžné slizáky v místě výbuchu.",
      "visual": "Kolem moždíře jsou těžké kovové vzpěry, které při výstřelu praskají do země."
     },
     {
      "tier": 5,
      "name": "Hněv titánů",
      "cost": 19000,
      "km": 5,
      "fx": {
       "damage_add": 12,
       "stun_duration_s": 2.5,
       "can_stun_moab": true,
       "knockback_px": 35,
       "damage_type_set": "true"
      },
      "desc": "Každý výbuch udělí 18 pravého poškození, omráčí i slizové krále na 2.5 sekundy a odhodí slizáky o 35 px zpět po cestě!",
      "visual": "Kolosální černo-zlaté obléhací dělo zdobené hlavou lva."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Rychlý rumpál",
      "cost": 180,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.78
      },
      "desc": "Zkracuje interval střelby z 1.4 s na 1.09 s.",
      "visual": "Na boku stroje jsou dvě velká ozubená kola pro rychlé natahování."
     },
     {
      "tier": 2,
      "name": "Ohnivé šipky",
      "cost": 350,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.8,
       "range_add_px": 35,
       "projectile_speed_mult": 1.5
      },
      "desc": "Mění soudky na rychlé rachejtle, zvyšuje dostřel na 200 px a zkracuje interval na 0.87 s.",
      "visual": "Stroj má dřevěnou odpalovací rampu s rudými ohňostrojovými raketami."
     },
     {
      "tier": 3,
      "name": "Drtič králů",
      "cost": 1150,
      "km": 0,
      "fx": {
       "bonus_moab_damage": 15,
       "range_add_px": 25
      },
      "desc": "Specialista na velké cíle: udělí +15 bonusového poškození do všech slizových králů a obrů.",
      "visual": "Těžká balista střílející výbušná kopí s namalovanou tlamou draka."
     },
     {
      "tier": 4,
      "name": "Lovec obrů",
      "cost": 3300,
      "km": 2,
      "fx": {
       "bonus_moab_damage": 30,
       "ability": {
        "name": "Dračí harpuna",
        "cooldown_s": 30,
        "effect": "Vypálí obří výbušnou harpunu na nejsilnějšího slizového krále na mapě, udělí mu 750 poškození a rozbije 1 Runovou pečeť."
       }
      },
      "desc": "Dává 31 poškození do králů každým výstřelem. Aktivní schopnost ubere králi 750 životů a rozbije 1 pečeť štítu.",
      "visual": "Ocelová balista se dvěma lučišti a zlatou harpunou připravenou k výstřelu."
     },
     {
      "tier": 5,
      "name": "Zhouba slizových králů",
      "cost": 18500,
      "km": 5,
      "fx": {
       "bonus_moab_damage": 95,
       "ability_upgrade": {
        "name": "Kopi osudu",
        "cooldown_s": 12,
        "effect": "Každých 12 sekund vypálí megastřelu za 3 500 poškození do krále a okamžitě zruší celou jeho Runovou pečeť!"
       }
      },
      "desc": "Každý běžný výstřel dá králi 96 poškození a schopnost s 12s přebíjením dává 3 500 poškození + maže štít krále.",
      "visual": "Monumentální obléhací věž v černo-rudém pancíři s planoucím oštěpem."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Dlouhé rameno",
      "cost": 150,
      "km": 0,
      "fx": {
       "range_add_px": 40
      },
      "desc": "Zvyšuje dostřel katapultu na 205 px.",
      "visual": "Prodloužené dubové rameno katapultu s těžkým protizávažím."
     },
     {
      "tier": 2,
      "name": "Kamenné střepiny",
      "cost": 300,
      "km": 0,
      "fx": {
       "sub_fragments": 8,
       "fragment_damage": 1,
       "fragment_damage_type": "sharp"
      },
      "desc": "Z každého výbuchu vylétne do kruhu 8 ostrých střepin, které zasáhnou i Černé slizáky (imunní vůči výbuchu).",
      "visual": "Soudky jsou obalené železnými hřeby a ostrými kameny."
     },
     {
      "tier": 3,
      "name": "Hroznová střela",
      "cost": 980,
      "km": 0,
      "fx": {
       "cluster_bombs": 6,
       "cluster_damage": 1,
       "damage_type_set": "normal"
      },
      "desc": "Hlavní soudek vyvrhne 6 menších bomb, které okamžitě explodují kolem cíle a zraní absolutně každý druh slizáka.",
      "visual": "Široký katapult nabíjející svazek šesti spojených soudků."
     },
     {
      "tier": 4,
      "name": "Řetězový výbuch",
      "cost": 2900,
      "km": 2,
      "fx": {
       "recursive_every_2nd_shot": true,
       "cluster_damage_add": 1
      },
      "desc": "Každý druhý výstřel vyvolá po prvním hroznovém výbuchu ještě druhou vlnu 6 výbuchů (celkem 13 explozí z jedné rány!).",
      "visual": "Trojhlavňové trpasličí dělo se zlatými runami hoření."
     },
     {
      "tier": 5,
      "name": "Kobercové bombardování",
      "cost": 17500,
      "km": 5,
      "fx": {
       "recursive_every_shot": true,
       "damage_add": 4,
       "passive_global_bombardment_interval_s": 5,
       "global_bomb_damage": 50
      },
      "desc": "Každý výstřel je řetězový. Navíc každých 5 sekund automaticky vybuchne celá cesta po celé mapě za 50 poškození.",
      "visual": "Pevnostní dělostřelecká baterie obklopená hromadami zlatých soudků s prachem."
     }
    ]
   ]
  },
  {
   "id": "ricni_galera",
   "name": "Říční galéra",
   "cat": "military",
   "desc": "Ozbrojená hlídková loď, kterou lze postavit pouze do vody (hradního příkopu či řeky). Střílí naváděné šipky.",
   "col": "#0e7490",
   "ico": "⛵",
   "short": "Galéra",
   "base": {
    "cost": 325,
    "range_px": 155,
    "damage": 1,
    "attack_interval_s": 0.9,
    "pierce": 2,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "water",
    "radius_px": 19
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Strážní koš",
      "cost": 140,
      "km": 0,
      "fx": {
       "range_add_px": 45
      },
      "desc": "Zvyšuje dostřel lodi na 200 px.",
      "visual": "Vyšší stěžeň s dřevěným strážním košem na vrcholu."
     },
     {
      "tier": 2,
      "name": "Holubí pošta",
      "cost": 500,
      "km": 0,
      "fx": {
       "global_shared_vision": true
      },
      "desc": "Unikátní mechanika: Loď dokáže střílet na JAKÉHOKOLIV slizáka na celé mapě, který je v dosahu libovolné jiné tvé věže!",
      "visual": "Kolem stěžně krouží bílí poštovní holubi a na přídi je velký dalekohled."
     },
     {
      "tier": 3,
      "name": "Maják pravdy",
      "cost": 900,
      "km": 0,
      "fx": {
       "toggle_submerge_mode": true,
       "decamo_pulse_interval_s": 1,
       "can_see_camo": true
      },
      "desc": "Získá přepínatelný režim 'Maják': místo střelby vysílá každou sekundu světelnou vlnu, která trvale odhalí VŠECHNY Duchslizy v okruhu 200 px.",
      "visual": "Loď spustí kotvu a na stěžni se rozsvítí jasná magická lucerna."
     },
     {
      "tier": 4,
      "name": "Sluneční svatyně na vodě",
      "cost": 2800,
      "km": 2,
      "fx": {
       "submerge_damage_aura_dps": 8,
       "submerge_pierce": 60,
       "buff_water_towers_cooldown_pct": 0.15
      },
      "desc": "V režimu Majáku nejen odhaluje, ale zároveň pálí všechny slizáky v dosahu (8 DPS) a zkracuje přebíjení vodních věží o 15 %.",
      "visual": "Voda kolem lodi zlatě světélkuje a z lucerny sálá sluneční žár."
     },
     {
      "tier": 5,
      "name": "Archa vědění",
      "cost": 18000,
      "km": 5,
      "fx": {
       "submerge_damage_aura_dps": 40,
       "global_cooldown_reduction_pct": 0.3,
       "hero_xp_gain_mult": 1.5
      },
      "desc": "Aura dává 40 DPS v obřím okruhu. Zkracuje přebíjení VŠECH schopností na celé mapě o 30 % a Hrdina získává o 50 % více zkušeností!",
      "visual": "Zářící zlatobílá chrámová loď s kopulí ze světelné energie."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Ocelové harpuny",
      "cost": 160,
      "km": 0,
      "fx": {
       "pierce_add": 3
      },
      "desc": "Zvyšuje průraz střel ze 2 na 5.",
      "visual": "Na přídi lodi je namontován vrhač těžkých harpun."
     },
     {
      "tier": 2,
      "name": "Řecký oheň",
      "cost": 350,
      "km": 0,
      "fx": {
       "damage_type_set": "normal",
       "damage_add": 1
      },
      "desc": "Harpuny mají +1 poškození a projdou přes železné helmy i zmrazené slizáky.",
      "visual": "Červeně malovaný trup lodi a hořící špičky harpun."
     },
     {
      "tier": 3,
      "name": "Lodní bombardér",
      "cost": 1350,
      "km": 0,
      "fx": {
       "explosion_radius_px": 50,
       "damage_add": 3,
       "bonus_moab_damage": 6
      },
      "desc": "Každý druhý útok vypálí z paluby těžkou dělovou kouli, která udělí plošné poškození (5 do běžných, 11 do králů).",
      "visual": "Uprostřed paluby stojí masivní lodní moždíř."
     },
     {
      "tier": 4,
      "name": "Královská salva z moří",
      "cost": 4100,
      "km": 2,
      "fx": {
       "bonus_moab_damage": 12,
       "ability": {
        "name": "Drakobijecká střela",
        "cooldown_s": 45,
        "effect": "Vypálí obří výbušnou střelu na nejsilnějšího slizáka: 1 500 poškození do cíle + 300 plošně kolem něj (zničí 2 Runové pečetě krále)."
       }
      },
      "desc": "Silnější děla. Aktivní schopnost udělí 1 500 poškození jedinou ranou.",
      "visual": "Velká válečná galéra v černo-červeném nátěru s obřím dělem na přídi."
     },
     {
      "tier": 5,
      "name": "Pán sedmi moří",
      "cost": 21500,
      "km": 5,
      "fx": {
       "passive_auto_missile_on_moab_spawn_damage": 400,
       "ability_upgrade": {
        "name": "Zkáza leviatana",
        "cooldown_s": 35,
        "effect": "Udělí 4 500 pravého poškození nejsilnějšímu cíli a okamžitě mu zruší celou Runovou pečeť."
       }
      },
      "desc": "Pokaždé, když na mapu vstoupí jakýkoliv slizový král nebo obr, loď na něj automaticky zdarma vypálí salvu za 400 poškození!",
      "visual": "Pancéřovaná vlajková loď se čtyřmi zlatými děly a dračí hlavou na přídi."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Dvojitá vesla",
      "cost": 180,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.75
      },
      "desc": "Zrychluje střelbu o 25 % (interval 0.67 s).",
      "visual": "Po obou bocích lodi přibude řada rychlých vesel."
     },
     {
      "tier": 2,
      "name": "Štěpné šipky",
      "cost": 480,
      "km": 0,
      "fx": {
       "split_on_hit_projectiles": 3,
       "split_pierce": 2
      },
      "desc": "Šipka se při nárazu do prvního slizáka rozpadne na 3 menší šipky, které pokračují dál.",
      "visual": "Dvě rychlé balisty vedle sebe na přední palubě."
     },
     {
      "tier": 3,
      "name": "Trojitá paluba",
      "cost": 1150,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.65
      },
      "desc": "Další výrazné zrychlení střelby (interval 0.44 s se štěpením střel).",
      "visual": "Vysoká nástavba s trojicí střílen nad sebou."
     },
     {
      "tier": 4,
      "name": "Průrazné oštěpy",
      "cost": 3100,
      "km": 2,
      "fx": {
       "damage_add": 1,
       "bonus_moab_damage": 3,
       "split_on_hit_projectiles": 4
      },
      "desc": "Hlavní střela i všechny 4 štěpné střely dávají +1 poškození a +3 extra poškození do slizových králů.",
      "visual": "Zlatě lemovaná galéra s těžkým opakovacím vrhačem oštěpů."
     },
     {
      "tier": 5,
      "name": "Velkoadmirál flotily",
      "cost": 19500,
      "km": 5,
      "fx": {
       "attack_interval_mult": 0.5,
       "buff_all_subs_damage_mult": 2,
       "buff_all_subs_pierce_add": 4
      },
      "desc": "Dvojnásobná kadence. Navíc VŠECHNY Říční galéry na mapě (včetně této) dávají dvojnásobné poškození a mají +4 průraz!",
      "visual": "Královská admirálská loď s modrozlatými plachtami a erbem koruny."
     }
    ]
   ]
  },
  {
   "id": "arkanni_carodej",
   "name": "Arkánní čaroděj",
   "cat": "magic",
   "desc": "Učený mág z královské věže, který vrhá magické blesky a pálí slizáky ohnivými kouzly.",
   "col": "#7c3aed",
   "ico": "🔮",
   "short": "Čaroděj",
   "base": {
    "cost": 400,
    "range_px": 150,
    "damage": 1,
    "attack_interval_s": 1,
    "pierce": 3,
    "projectiles": 1,
    "damage_type": "magic",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Naváděné střely",
      "cost": 160,
      "km": 0,
      "fx": {
       "homing_projectiles": true,
       "ignore_obstacles": true
      },
      "desc": "Magické střely se samy stáčejí za slizáky (nikdy neminou) a létají skrz překážky na mapě.",
      "visual": "Čaroděj má vysoký špičatý klobouk a fialově zářící kouli na holi."
     },
     {
      "tier": 2,
      "name": "Silnější zaklínadlo",
      "cost": 350,
      "km": 0,
      "fx": {
       "damage_add": 1,
       "pierce_add": 2
      },
      "desc": "Zvyšuje poškození na 2 a průraz na 5.",
      "visual": "Kolem čaroděje obíhají dva svítící runové prstence."
     },
     {
      "tier": 3,
      "name": "Arkánní hrot",
      "cost": 1500,
      "km": 0,
      "fx": {
       "damage_add": 4,
       "bonus_moab_damage": 6,
       "damage_type_set": "true",
       "attack_interval_mult": 0.7
      },
      "desc": "Rychlé energetické blesky (interval 0.7 s), které dávají 6 pravého poškození (12 do králů) a projdou i železnou helmou.",
      "visual": "Hůl je zakončena fialovým krystalem šlehajícím čisté blesky."
     },
     {
      "tier": 4,
      "name": "Mistr tajemných věd",
      "cost": 3900,
      "km": 2,
      "fx": {
       "damage_add": 5,
       "bonus_moab_damage": 10,
       "attack_interval_mult": 0.65,
       "range_add_px": 30
      },
      "desc": "Extrémně silný fokusovaný paprsek: 11 poškození (27 do králů) každých 0.45 s.",
      "visual": "Čaroděj se vznáší nad zemí v obklopení tří rotujících zlatých kruhů."
     },
     {
      "tier": 5,
      "name": "Arcimág království",
      "cost": 21000,
      "km": 5,
      "fx": {
       "damage_add": 10,
       "pierce_add": 10,
       "attack_interval_set": 0.22,
       "gains_dragon_breath_and_decamo": true,
       "can_see_camo": true
      },
      "desc": "Vrchol magie: střílí 4.5× za sekundu za 21 poškození (37 do králů), automaticky odhaluje Duchslizy a současně je pálí plamenem!",
      "visual": "Vznešený arcimág ve zlatofialovém rouchu obklopený levitujícími knihami kouzel."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Ohnivá koule",
      "cost": 280,
      "km": 0,
      "fx": {
       "secondary_attack_fireball_interval_s": 2.6,
       "fireball_damage": 3,
       "fireball_radius_px": 45,
       "fireball_damage_type": "explosion"
      },
      "desc": "Každé 2.6 sekundy vystřelí kromě běžných útoků ohnivou kouli, která vybuchne za 3 poškození a ničí Přilboslizy.",
      "visual": "V druhé ruce čaroděje plane koule z oranžového ohně."
     },
     {
      "tier": 2,
      "name": "Ohnivá stěna",
      "cost": 450,
      "km": 0,
      "fx": {
       "spawn_fire_wall_on_track_interval_s": 4.5,
       "fire_wall_duration_s": 4,
       "fire_wall_dps": 8,
       "fire_wall_pierce": 20
      },
      "desc": "Každých 4.5 s vyčaruje na nejbližším úseku cesty Ohnivou stěnu, která pálí všechny procházející slizáky za 8 DPS.",
      "visual": "Roucho čaroděje má červené plamenné lemování."
     },
     {
      "tier": 3,
      "name": "Dračí dech",
      "cost": 1600,
      "km": 0,
      "fx": {
       "continuous_flame_stream": true,
       "flame_interval_s": 0.12,
       "flame_damage": 1,
       "flame_pierce": 6,
       "burn_dps": 2
      },
      "desc": "Chrlí nepřetržitý proud plamenů (8.3 zásahů za sekundu), který taví zástupy slizáků a zapaluje je.",
      "visual": "Čaroděj má masku ve tvaru zlaté dračí hlavy chrlící oheň."
     },
     {
      "tier": 4,
      "name": "Povolání fénixe",
      "cost": 3600,
      "km": 2,
      "fx": {
       "flame_damage_add": 1,
       "ability": {
        "name": "Ohnivý fénix",
        "cooldown_s": 40,
        "duration_s": 18,
        "effect": "Na 18 sekund vyvolá ohnivého fénixe, který krouží nad mapou a střílí po slizácích (4 poškození každých 0.15 s po celé mapě)."
       }
      },
      "desc": "Dvojnásobné poškození plamenů. Schopnost přivolá na 18 s létajícího Fénixe s celomapovým dosahem.",
      "visual": "Z ramen čaroděje vyrůstají plamenná křídla."
     },
     {
      "tier": 5,
      "name": "Pán ohnivého fénixe",
      "cost": 20500,
      "km": 5,
      "fx": {
       "permanent_phoenix": true,
       "ability_upgrade": {
        "name": "Proměna v arcifénixe",
        "cooldown_s": 45,
        "duration_s": 15,
        "effect": "Na 15 sekund promění čaroděje v obřího Lávového Fénixe, který chrlí 8 meteorů za sekundu (každý za 50 pravého poškození)."
       }
      },
      "desc": "Ohnivý Fénix krouží nad mapou TRVALE. Aktivní schopnost promění mága v apokalyptického Arcifénixe.",
      "visual": "Zlatohnědá sluneční svatyně, nad kterou neustále krouží obří plamenný pták."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Jasnozřivost",
      "cost": 170,
      "km": 0,
      "fx": {
       "range_add_px": 35,
       "projectile_speed_mult": 1.4
      },
      "desc": "Zvyšuje dosah čaroděje na 185 px a zrychluje let kouzel.",
      "visual": "Zelený magický kruh pod nohama čaroděje."
     },
     {
      "tier": 2,
      "name": "Pravdivé vidění",
      "cost": 250,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "range_add_px": 20
      },
      "desc": "Čaroděj vidí průhledné Duchslizy a získá +20 px k dosahu (celkem 205 px).",
      "visual": "Zelený drahokam na čele klobouku."
     },
     {
      "tier": 3,
      "name": "Světlo odhalení",
      "cost": 1200,
      "km": 0,
      "fx": {
       "decamo_pulse_interval_s": 1.8,
       "decamo_radius_px": 220
      },
      "desc": "Každých 1.8 sekundy vyšle záblesk, který trvale zviditelní VŠECHNY Duchslizy v okruhu 220 px pro ostatní věže.",
      "visual": "Čaroděj drží lucernu, která periodicky vysílá fialovo-zlatou vlnu světla."
     },
     {
      "tier": 4,
      "name": "Nekromant",
      "cost": 3200,
      "km": 2,
      "fx": {
       "graveyard_max_souls": 50,
       "spawn_zombie_packets": true,
       "zombie_damage": 2,
       "zombie_pierce": 5,
       "bonus_damage_per_10_souls": 1
      },
      "desc": "Každý slizák zničený v okolí plní 'Studnu duší'. Mág z nich neustále vyvolává přátelské Kostlivce, kteří jdou po cestě PROTI směru slizáků!",
      "visual": "Temně zelený plášť a hůl zakončená lebkou se zeleně planoucíma očima."
     },
     {
      "tier": 5,
      "name": "Král nemrtvých",
      "cost": 19000,
      "km": 5,
      "fx": {
       "graveyard_max_souls": 200,
       "spawn_zombie_moabs": true,
       "zombie_moab_damage": 50,
       "zombie_moab_pierce": 25,
       "buff_all_magic_towers_damage_add": 2
      },
      "desc": "Vyvolává celé armády přátelských Kostěných draků (každý rozdá až 1 250 poškození při cestě zpět!) a všem Magickým věžím dává +2 poškození.",
      "visual": "Nekromantský trůn z černého kamene obklopený zelenými přízraky."
     }
    ]
   ]
  },
  {
   "id": "kralovsky_alchymista",
   "name": "Královský alchymista",
   "cat": "magic",
   "desc": "Mistr lektvarů, který hází kyselinové baňky přes překážky, rozpouští zbroj slizáků a posiluje okolní obránce.",
   "col": "#65a30d",
   "ico": "⚗️",
   "short": "Alchymista",
   "base": {
    "cost": 420,
    "range_px": 140,
    "damage": 1,
    "attack_interval_s": 1.6,
    "pierce": 12,
    "projectiles": 1,
    "splash_radius_px": 40,
    "acid_dot_dps": 1,
    "acid_duration_s": 3,
    "damage_type": "normal",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 19
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Velké baňky",
      "cost": 200,
      "km": 0,
      "fx": {
       "splash_radius_add_px": 15,
       "pierce_add": 8
      },
      "desc": "Zvyšuje poloměr louže na 55 px a průraz na 20.",
      "visual": "Alchymista drží podstatně větší skleněné baňky se zelenou tekutinou."
     },
     {
      "tier": 2,
      "name": "Odvar průraznosti",
      "cost": 350,
      "km": 0,
      "fx": {
       "buff_nearest_tower_interval_s": 4,
       "buff_grants_lead_popping": true,
       "buff_bonus_moab_and_ceramic_damage": 1,
       "buff_shots": 12
      },
      "desc": "Každé 4 s hodí na nejbližší věž lektvar: jejích dalších 12 výstřelů prorazí Přilboslizy a dá +1 poškození do králů.",
      "visual": "U pasu alchymisty visí řada červených posilujících lahviček."
     },
     {
      "tier": 3,
      "name": "Elixír zuřivosti",
      "cost": 1350,
      "km": 0,
      "fx": {
       "buff_damage_add": 1,
       "buff_pierce_add": 2,
       "buff_attack_speed_pct": 0.15,
       "buff_range_pct": 0.1,
       "buff_shots": 25,
       "buff_duration_s": 5
      },
      "desc": "Pravidelně posiluje nejbližší útočnou věž: dává jí +1 poškození, +2 průraz, +15 % rychlost útoku a +10 % dosah!",
      "visual": "Alchymistický stůl s bublajícím fialovým kotlem a voňavým dýmem."
     },
     {
      "tier": 4,
      "name": "Královský životabudič",
      "cost": 2900,
      "km": 2,
      "fx": {
       "buff_damage_add": 2,
       "buff_pierce_add": 3,
       "buff_attack_speed_pct": 0.2,
       "buff_range_pct": 0.15,
       "buff_shots": 45,
       "buff_duration_s": 11,
       "can_keep_2_towers_buffed": true
      },
      "desc": "Výrazně silnější lektvar (+2 poškození, +3 průraz, +20 % rychlost), který udrží posílené až 3 věže v okolí současně.",
      "visual": "Zlatý destilační přístroj s jasně růžovou tekutinou."
     },
     {
      "tier": 5,
      "name": "Kámen mudrců",
      "cost": 22000,
      "km": 5,
      "fx": {
       "buff_is_permanent": true,
       "buff_damage_add": 3,
       "buff_pierce_add": 5,
       "buff_attack_speed_pct": 0.25
      },
      "desc": "Jakmile tato věž jednou posílí libovolnou věž v dosahu, tento obří bonus (+3 poškození, +5 průraz, +25 % rychlost) jí zůstane TRVALE do konce hry!",
      "visual": "Křišťálová svatyně s fontánou zlatého elixíru a levitujícím rudým kamenem mudrců."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Žíravý roztok",
      "cost": 220,
      "km": 0,
      "fx": {
       "acid_dot_dps_add": 2,
       "acid_duration_add_s": 1.5
      },
      "desc": "Kyselina na slizácích pálí za 3 DPS po dobu 4.5 sekundy.",
      "visual": "Tekutina v baňkách dostane jedovatě žlutou barvu."
     },
     {
      "tier": 2,
      "name": "Rozpouštědlo kamene",
      "cost": 450,
      "km": 0,
      "fx": {
       "strip_fortified_from_non_moab": true,
       "bonus_fortified_damage": 3
      },
      "desc": "Zásah okamžitě strhne vlastnost Kamenný sliz (Opevněný) ze všech běžných a středních slizáků a králům dává +3 poškození.",
      "visual": "Alchymista má těžkou koženou zástěru a ochranné brýle."
     },
     {
      "tier": 3,
      "name": "Výbušná směs",
      "cost": 1650,
      "km": 0,
      "fx": {
       "coat_moab_in_explosive": true,
       "moab_explosion_pct_of_max_hp": 0.1,
       "moab_explosion_radius_px": 90
      },
      "desc": "Obalí slizové krále a obry výbušným olejem. Když takto obalený král praskne, vybuchne a zraní všechny okolní slizáky za 10 % svého maximálního života!",
      "visual": "Baňky jiskří červenými plamínky a na stole jsou soudky s nitroglycerinem."
     },
     {
      "tier": 4,
      "name": "Lektvar běsnění",
      "cost": 3800,
      "km": 2,
      "fx": {
       "damage_add": 3,
       "ability": {
        "name": "Proměna v běsa",
        "cooldown_s": 40,
        "duration_s": 15,
        "effect": "Na 15 s promění alchymistu v obřího magického běsa, který vrhá paprsky energie (8 poškození každých 0.08 s!)."
       }
      },
      "desc": "Aktivní schopnost promění věž na 15 sekund v běsnící monstrum s obrovským poškozením.",
      "visual": "Alchymista drží v ruce bublající fialovou lahvičku se symbolem drápů."
     },
     {
      "tier": 5,
      "name": "Probuzení smečky",
      "cost": 18500,
      "km": 5,
      "fx": {
       "ability_upgrade": {
        "name": "Armáda běsů",
        "cooldown_s": 40,
        "duration_s": 18,
        "effect": "Promění v magické běsy nejen sebe, ale i 4 nejbližší věže úrovně 1–3! Každá z nich dává po dobu 18 s přes 120 DPS."
       }
      },
      "desc": "Schopnost promění alchymistu a 4 okolní menší věže v nezastavitelnou smečku běsů.",
      "visual": "Tajemná laboratoř s pěti magickými zrcadly proměny."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Rychlé míchání",
      "cost": 180,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.78
      },
      "desc": "Zkracuje interval házení z 1.6 s na 1.25 s.",
      "visual": "Malý dřevěný prak na rameni alchymisty."
     },
     {
      "tier": 2,
      "name": "Kyselinové louže",
      "cost": 320,
      "km": 0,
      "fx": {
       "leave_acid_pool_on_track": true,
       "pool_duration_s": 4,
       "pool_pierce": 10
      },
      "desc": "Pokud nemá na koho házet, hází baňky přímo na cestu, kde zůstávají jako kyselinové pasti pro další slizáky.",
      "visual": "Cesta v dosahu věže je pokrytá zelenými bublajícími skvrnami."
     },
     {
      "tier": 3,
      "name": "Železo ve zlato",
      "cost": 1200,
      "km": 0,
      "fx": {
       "instant_kill_lead": true,
       "cash_per_lead": 50
      },
      "desc": "Okamžitě jedinou ranou zničí jakéhokoliv Přilboslize a za každého ti vyplatí bonus +50 zlaťáků!",
      "visual": "Alchymista má zlatý plášť a hází baňky s tekutým zlatem."
     },
     {
      "tier": 4,
      "name": "Zlatá transmutace",
      "cost": 3100,
      "km": 2,
      "fx": {
       "gold_potion_interval_s": 3,
       "gold_coated_cash_multiplier": 2.5
      },
      "desc": "Každé 3 s hodí zlatý elixír, který obalí skupinu slizáků – za jejich zničení dostaneš 2.5× více zlaťáků (ignoruje krácení v pozdějších vlnách!).",
      "visual": "Zlatá věž s truhlou plnou zlaťáků u paty."
     },
     {
      "tier": 5,
      "name": "Mistr zmenšování",
      "cost": 19500,
      "km": 5,
      "fx": {
       "shrink_potion_interval_s": 6,
       "shrink_turns_moab_into_typo": true
      },
      "desc": "Každých 6 sekund hodí speciální zmenšovací lektvar, který okamžitě promění menšího slizového krále nebo skupinu obrů v obyčejnou neškodnou Kapičku slizu s 1 životem!",
      "visual": "Mistr alchymie v diamantové zbroji držící lahvičku s miniaturním slizákem uvnitř."
     }
    ]
   ]
  },
  {
   "id": "strazni_hlaska",
   "name": "Strážní hláska",
   "cat": "support",
   "desc": "Podpůrná budova s válečným bubnem a praporem, která sama neútočí, ale posiluje všechny věže ve svém okruhu.",
   "col": "#1d4ed8",
   "ico": "🚩",
   "short": "Hláska",
   "base": {
    "cost": 650,
    "range_px": 150,
    "damage": 0,
    "attack_interval_s": 0,
    "pierce": 0,
    "projectiles": 0,
    "aura_range_bonus_pct": 0.15,
    "damage_type": "none",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 26
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Vysoký prapor",
      "cost": 250,
      "km": 0,
      "fx": {
       "range_add_px": 30
      },
      "desc": "Zvyšuje poloměr podpůrné aury hlásky ze 150 px na 180 px.",
      "visual": "Na střeše hlásky vlaje dlouhý modrozlatý královský prapor."
     },
     {
      "tier": 2,
      "name": "Válečné bubny",
      "cost": 800,
      "km": 0,
      "fx": {
       "aura_attack_speed_bonus_pct": 0.18
      },
      "desc": "Všechny věže v dosahu hlásky útočí o 18 % rychleji.",
      "visual": "Na ochozu stojí dva bubeníci s velkými okovanými bubny."
     },
     {
      "tier": 3,
      "name": "Cvičiště základních vojsk",
      "cost": 1200,
      "km": 0,
      "fx": {
       "basic_towers_pierce_add": 2,
       "basic_towers_range_pct": 0.1,
       "basic_towers_projectile_speed_pct": 0.25
      },
      "desc": "Všechny věže kategorie Základní (Lučištník, Čepová věž, Mrazivý mág) v dosahu získají +2 průraz a dalších +10 % k dosahu.",
      "visual": "Kolem hlásky jsou cvičné terče a stojany se zbraněmi."
     },
     {
      "tier": 4,
      "name": "Pevnost mistrů",
      "cost": 2800,
      "km": 2,
      "fx": {
       "free_tier1_upgrades_for_basic_towers": true,
       "aura_cooldown_reduction_pct": 0.2
      },
      "desc": "Všechny Základní věže v dosahu mají upgrady úrovně 1 ZDARMA a všechny věže v dosahu mají o 20 % kratší přebíjení schopností.",
      "visual": "Kamenná tvrz se zlatou střechou a sochami rytířů."
     },
     {
      "tier": 5,
      "name": "Citadela království",
      "cost": 18000,
      "km": 5,
      "fx": {
       "free_tier2_upgrades_for_basic_towers": true,
       "basic_towers_damage_add": 3,
       "turret_ballista_damage": 80,
       "turret_ballista_interval_s": 0.8,
       "turret_pierce": 30
      },
      "desc": "Základní věže v dosahu mají zdarma i úroveň 2 a získají +3 poškození! Citadela navíc sama střílí z obří střešní balisty (80 poškození každých 0.8 s).",
      "visual": "Velkolepý hradní palác s obří zlatou balistou na vrcholu hlavní věže."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Ostražitá hlídka",
      "cost": 300,
      "km": 0,
      "fx": {
       "block_regrow_in_radius": true
      },
      "desc": "Slizáci v dosahu hlásky nemohou dorůstat (zastavuje regeneraci).",
      "visual": "Strážný na věži drží v ruce louč se zeleným plamenem."
     },
     {
      "tier": 2,
      "name": "Světlomet",
      "cost": 1100,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "grant_camo_vision_to_all_in_radius": true
      },
      "desc": "VŠECHNY věže v dosahu hlásky získají schopnost vidět a zasáhnout průhledné Duchslizy!",
      "visual": "Na vrcholu hlásky se otáčí velké zrcadlo se zářícím krystalem."
     },
     {
      "tier": 3,
      "name": "Královská zbrojnice",
      "cost": 3500,
      "km": 0,
      "fx": {
       "grant_true_damage_type_to_all_in_radius": true
      },
      "desc": "VŠECHNY věže v dosahu hlásky mohou zasáhnout a zranit jakýkoliv typ slizáka (jejich střely ignorují železné helmy, výbuchovou i mrazovou imunitu)!",
      "visual": "Kovářská dílna u paty věže se zářící kovadlinou."
     },
     {
      "tier": 4,
      "name": "Volání do zbraně",
      "cost": 4500,
      "km": 2,
      "fx": {
       "ability": {
        "name": "Bojový roh",
        "cooldown_s": 45,
        "duration_s": 12,
        "effect": "Na 12 sekund zvýší všem věžím v dosahu rychlost útoku o +50 % a průraz o +50 %."
       }
      },
      "desc": "Odemkne mocnou aktivní schopnost Bojový roh (+50 % rychlost a průraz pro okolí).",
      "visual": "Z ochozu věže vyčnívají dva obří zlaté válečné rohy."
     },
     {
      "tier": 5,
      "name": "Domobrana celé říše",
      "cost": 21000,
      "km": 5,
      "fx": {
       "ability_upgrade": {
        "name": "Královský rozkaz",
        "cooldown_s": 45,
        "duration_s": 15,
        "effect": "Na 15 sekund zdvojnásobí (+100 %) rychlost útoku i průraz VŠEM věžím po CELÉ MAPĚ!"
       }
      },
      "desc": "Schopnost zdvojnásobí rychlost útoku a průraz všech tvých věží na celé mapě po dobu 15 sekund.",
      "visual": "Monumentální válečná katedrála se zlatými zvony a prapory."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Smlouvání s cechy",
      "cost": 400,
      "km": 0,
      "fx": {
       "discount_upgrades_t1_to_t3_pct": 0.1
      },
      "desc": "Zlevňuje nákup věží a všech upgradů do úrovně 3 v dosahu hlásky o 10 %.",
      "visual": "U vchodu do hlásky je kupecký stánek s váhami."
     },
     {
      "tier": 2,
      "name": "Královské výsady",
      "cost": 500,
      "km": 0,
      "fx": {
       "discount_upgrades_t1_to_t3_pct": 0.15
      },
      "desc": "Zvyšuje slevu v dosahu na 15 % (lze kombinovat až ze 2 hlásek na slevu 25 %).",
      "visual": "Zlatá pečeť nad vchodem do věže."
     },
     {
      "tier": 3,
      "name": "Městská pokladnice",
      "cost": 1600,
      "km": 0,
      "fx": {
       "bonus_cash_per_pop_in_radius_pct": 0.5
      },
      "desc": "Za každého slizáka zničeného věžemi v dosahu této hlásky dostaneš o +50 % více zlaťáků!",
      "visual": "Hláska s měděnou střechou a truhlicemi vyskládanými kolem zdí."
     },
     {
      "tier": 4,
      "name": "Knihovna moudrosti",
      "cost": 3600,
      "km": 2,
      "fx": {
       "bonus_cash_from_farms_in_radius_pct": 0.2,
       "flashcard_cash_bonus_pct": 0.25
      },
      "desc": "Zvyšuje výdělek Zlatých dolů v dosahu o 20 % a zlaťáky z kartiček o 25 %.",
      "visual": "Věž je přestavěna na kamennou knihovnu s vitrážovými okny a svitky."
     },
     {
      "tier": 5,
      "name": "Velká akademie",
      "cost": 15000,
      "km": 5,
      "fx": {
       "absorb_nearby_farms_for_mega_income": true,
       "base_income_per_wave": 2500
      },
      "desc": "Vydělává 2 500 zlaťáků každou vlnu a zvýší výdělek všech Zlatých dolů v dosahu o 50 %.",
      "visual": "Zářící mramorová akademie se zlatou kopulí a obřím levitujícím Krystalem moudrosti."
     }
    ]
   ]
  },
  {
   "id": "zlaty_dul",
   "name": "Zlatý důl",
   "cat": "support",
   "desc": "Ekonomická budova, která sama neútočí, ale během každé vlny těží zlaťáky pro rychlé budování obrany.",
   "col": "#ca8a04",
   "ico": "⛏️",
   "short": "Zlatý důl",
   "base": {
    "cost": 950,
    "range_px": 80,
    "damage": 0,
    "attack_interval_s": 0,
    "pierce": 0,
    "projectiles": 0,
    "income_per_wave": 120,
    "payouts_per_wave": 4,
    "max_instances_in_versus": 2,
    "damage_type": "none",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 32
   },
   "paths": [
    [
     {
      "tier": 1,
      "name": "Hlubší šachty",
      "cost": 400,
      "km": 0,
      "fx": {
       "carts_add": 2
      },
      "desc": "+2 vozíky za vlnu (6 místo 4).",
      "visual": "Vchod do dolu je vyztužen dubovými trámy a ven vedou železné koleje."
     },
     {
      "tier": 2,
      "name": "Bohatá žíla",
      "cost": 550,
      "km": 0,
      "fx": {
       "carts_add": 2
      },
      "desc": "+2 další vozíky za vlnu (8).",
      "visual": "Ve vozících před dolem se třpytí velké hroudy ryzího zlata."
     },
     {
      "tier": 3,
      "name": "Trpasličí kamenolom",
      "cost": 1800,
      "km": 0,
      "fx": {
       "carts_set": 16
      },
      "desc": "Těží 16 vozíků za vlnu.",
      "visual": "Kamenná budova s vodním kolem a parním kladivem drtícím rudu."
     },
     {
      "tier": 4,
      "name": "Královská mincovna",
      "cost": 4500,
      "km": 2,
      "fx": {
       "carts_set": 5,
       "cart_value_set": 230
      },
      "desc": "Místo vozíků razí 5 truhel po 230 zl (1 150 zl za vlnu, hodnotu zvedá i druhá cesta).",
      "visual": "Velká budova se zlatou střechou a komínem, ze kterého stoupají zlaté jiskry."
     },
     {
      "tier": 5,
      "name": "Pokladnice dračí hory",
      "cost": 16000,
      "km": 5,
      "fx": {
       "cart_value_set": 700,
       "buff_all_other_farms_income_pct": 0.25
      },
      "desc": "Truhly mají hodnotu 700 zl (3 500 zl za vlnu) a všechny ostatní Zlaté doly vydělávají o 25 % víc.",
      "visual": "Hora plná zlata a drahokamů s trpasličí korunou na vrcholu."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Dlouhodobý úrok",
      "cost": 300,
      "km": 0,
      "fx": {
       "cart_value_pct_add": 0.1
      },
      "desc": "Vozíky mají o 10 % vyšší hodnotu.",
      "visual": "Vedle dolu stojí dřevěná pokladnice se zámkem."
     },
     {
      "tier": 2,
      "name": "Cechovní úschovna",
      "cost": 600,
      "km": 0,
      "fx": {
       "cart_value_pct_add": 0.25,
       "flashcard_bonus_gold_add": 15
      },
      "desc": "Vozíky mají o dalších 25 % vyšší hodnotu a každý správný svitek dá +15 zl.",
      "visual": "Pokladnice je pobitá ocelovými pásy a hlídá ji strážný."
     },
     {
      "tier": 3,
      "name": "Královská banka",
      "cost": 2200,
      "km": 0,
      "fx": {
       "bank_mode": true,
       "cart_mult_set": 1.8,
       "compound_interest_per_wave_pct": 0.15,
       "bank_capacity": 7500
      },
      "desc": "Výnos jde do banky s 1,8× vyšší hodnotou a na konci vlny se uložená částka zúročí o 15 % (max. 7 500 zl, vybíráš tlačítkem). Víc vozíků z první cesty = víc do banky.",
      "visual": "Mramorová banka s velkými železnými dveřmi trezoru."
     },
     {
      "tier": 4,
      "name": "Půjčka koruny",
      "cost": 4800,
      "km": 2,
      "fx": {
       "bank_mode": true,
       "cart_mult_set": 2.5,
       "compound_interest_per_wave_pct": 0.15,
       "bank_capacity": 12000,
       "ability": {
        "name": "Okamžitá půjčka",
        "cooldown_s": 50,
        "effect": "Okamžitě ti vyplatí 4 000 zlaťáků (2 000 zl se pak splácí z budoucích výdělků)."
       }
      },
      "desc": "Banka ukládá 2,5× hodnotu vozíků, kapacita 12 000 zl. Schopnost: okamžitá půjčka 4 000 zl.",
      "visual": "Velkolepá banka s pozlacenými sloupy a královským znakem."
     },
     {
      "tier": 5,
      "name": "Císařská klenotnice",
      "cost": 18000,
      "km": 5,
      "fx": {
       "bank_capacity": 20000,
       "ability_upgrade": {
        "name": "Dar koruny",
        "cooldown_s": 60,
        "gold": 3000,
        "effect": "Okamžitě ti daruje 3 000 zlaťáků bez splácení."
       }
      },
      "desc": "Kapacita banky 20 000 zl. Schopnost každých 60 sekund daruje 3 000 zlaťáků.",
      "visual": "Pevnost z čistého zlata a rubínů, nad kterou se vznáší královské žezlo."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Samojízdný vozík",
      "cost": 200,
      "km": 0,
      "fx": {
       "cart_value_pct_add": 0.1,
       "sell_value_bonus_pct": 0.05
      },
      "desc": "Vozíky mají o 10 % vyšší hodnotu a důl jde prodat o 5 % dráž.",
      "visual": "Vozík se zlatem má vlastní plachtu a jede sám po kolejích."
     },
     {
      "tier": 2,
      "name": "Cenné drahokamy",
      "cost": 400,
      "km": 0,
      "fx": {
       "cart_value_pct_add": 0.2,
       "sell_value_bonus_pct": 0.1
      },
      "desc": "Vozíky mají o dalších 20 % vyšší hodnotu a důl jde prodat o 10 % dráž.",
      "visual": "Mezi zlatem se třpytí modré safíry a zelené smaragdy."
     },
     {
      "tier": 3,
      "name": "Kupecké tržiště",
      "cost": 1650,
      "km": 0,
      "fx": {
       "cart_mult_set": 2.5,
       "lives_generated_per_wave": 2
      },
      "desc": "Tržiště: vozíky mají 2,5× hodnotu a na konci vlny opraví +2 životy brány.",
      "visual": "Živé tržiště s barevnými stany, sudy a vozy."
     },
     {
      "tier": 4,
      "name": "Velký bazar",
      "cost": 4200,
      "km": 2,
      "fx": {
       "cart_mult_set": 5,
       "lives_generated_per_wave": 5,
       "buff_water_towers_income": 150
      },
      "desc": "Velký bazar: vozíky mají 5× hodnotu, +5 životů za vlnu a každá Říční galéra vydělá +150 zl.",
      "visual": "Rozsáhlý kupecký palác s hedvábnými baldachýny a karavanou."
     },
     {
      "tier": 5,
      "name": "Srdce obchodních cest",
      "cost": 17000,
      "km": 5,
      "fx": {
       "cart_mult_set": 15,
       "lives_generated_per_wave": 15,
       "global_tower_attack_speed_per_market_pct": 0.05
      },
      "desc": "Vozíky mají 15× hodnotu, +15 životů za vlnu (až 200 nad start) a všechny věže střílí o 5 % rychleji za každé tržiště.",
      "visual": "Zlatý kupecký palác s fontánou života a sochou bohyně hojnosti."
     }
    ]
   ]
  }
 ],
 "heroes": [
  {
   "id": "lovec_bedrich",
   "name": "Královský lovec Bedřich",
   "role": "Specialista na jednoho slizáka, průraz brnění a likvidaci slizových králů.",
   "base": {
    "cost": 550,
    "range_px": 240,
    "damage": 4,
    "attack_interval_s": 1.2,
    "pierce": 1,
    "damage_type": "energy",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "passive": {
    "name": "Soustředění mistra",
    "description": "Pokaždé, když hráč odpoví správně na kartičku, další 3 výstřely Bedřicha způsobí trojnásobné poškození (3× kritický zásah) a ignorují veškeré imunity."
   },
   "levels": [
    {
     "level": 1,
     "xp": 0,
     "text": "Základní útok těžkou kuší (4 poškození, dostřel 240 px)."
    },
    {
     "level": 2,
     "xp": 150,
     "text": "Zvyšuje poškození o +1 (celkem 5) a dostřel o +15 px (celkem 255 px)."
    },
    {
     "level": 3,
     "xp": 460,
     "text": "Odemkne Schopnost 1: Železná past (znehybní nejsilnějšího slizáka na 4 s a zvýší poškození, které dostává od všech věží, o +50 %. Cooldown 35 s; správná kartička zkrátí cooldown o 6 s)."
    },
    {
     "level": 4,
     "xp": 890,
     "text": "Zkracuje interval střelby z 1.2 s na 1.0 s."
    },
    {
     "level": 5,
     "xp": 1410,
     "text": "Bedřich trvale vidí průhledné Duchslizy a dává jim +3 poškození navíc."
    },
    {
     "level": 6,
     "xp": 2010,
     "text": "Zvyšuje základní poškození na 8 a bonus do slizových králů o +4."
    },
    {
     "level": 7,
     "xp": 2690,
     "text": "Pasivní bonus z kartičky (Soustředění mistra) nyní platí na 5 výstřelů místo 3."
    },
    {
     "level": 8,
     "xp": 3440,
     "text": "Zkracuje interval střelby na 0.8 s a zvyšuje průraz na 2."
    },
    {
     "level": 9,
     "xp": 4260,
     "text": "Schopnost Železná past nyní trvá 5.5 sekundy a po skončení zanechá cíl zpomalený o 30 %."
    },
    {
     "level": 10,
     "xp": 5140,
     "text": "Odemkne Schopnost 2: Střela drakobijce (vypálí obří runové kopí, které udělí 500 poškození nejsilnějšímu cíli a okamžitě rozbije 2 Runové pečetě štítu krále. Cooldown 60 s)."
    },
    {
     "level": 11,
     "xp": 6090,
     "text": "Zvyšuje základní poškození na 12 (do slizových králů 18)."
    },
    {
     "level": 12,
     "xp": 7090,
     "text": "Zvyšuje dostřel o +45 px (celkem 300 px)."
    },
    {
     "level": 13,
     "xp": 8150,
     "text": "Každý 4. běžný výstřel přibije cíl k zemi na 0.5 sekundy."
    },
    {
     "level": 14,
     "xp": 9260,
     "text": "Bonus do slizových králů stoupá z +6 na +14 (celkem 26 poškození na ránu do krále)."
    },
    {
     "level": 15,
     "xp": 10430,
     "text": "Cooldown Železné pasti klesá ze 35 s na 25 s."
    },
    {
     "level": 16,
     "xp": 11650,
     "text": "Zkracuje interval střelby na 0.6 s."
    },
    {
     "level": 17,
     "xp": 12910,
     "text": "Střela drakobijce nyní uděluje 1 200 poškození."
    },
    {
     "level": 18,
     "xp": 14230,
     "text": "Všichni Orlí ostrostřelci a Královští lučištníci v Bedřichově dosahu získají +15 % k rychlosti útoku."
    },
    {
     "level": 19,
     "xp": 15590,
     "text": "Základní poškození stoupá na 20 (do slizových králů 40 na každou ránu)."
    },
    {
     "level": 20,
     "xp": 17000,
     "text": "Železná past trvá 7 sekund (+80 % přijímaného poškození). Střela drakobijce uděluje 2 500 poškození a rozbije 3 Runové pečetě!"
    }
   ],
   "col": "#b91c1c",
   "ico": "🏹"
  },
  {
   "id": "carodejka_radka",
   "name": "Runová čarodějka Radka",
   "role": "Plošné poškození, řetězové blesky a odstraňování vlastností ze zástupů slizáků.",
   "base": {
    "cost": 650,
    "range_px": 150,
    "damage": 1,
    "attack_interval_s": 0.9,
    "pierce": 5,
    "damage_type": "magic",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 18
   },
   "passive": {
    "name": "Nabití krystaly",
    "description": "Každý aktuálně držený Krystal moudrosti (KM) v inventáři hráče zvyšuje Radčin průraz o +1 a poloměr jejích výbuchů o +5 % (maximálně do bonusu za 10 KM)."
   },
   "levels": [
    {
     "level": 1,
     "xp": 0,
     "text": "Sesílá řetězový blesk, který přeskočí na 5 slizáků za 1 poškození."
    },
    {
     "level": 2,
     "xp": 150,
     "text": "Průraz řetězového blesku se zvyšuje na 7 cílů."
    },
    {
     "level": 3,
     "xp": 460,
     "text": "Odemkne Schopnost 1: Očistná runa (v okruhu 200 px okamžitě zbaví až 30 slizáků vlastností Duchsliz, Dorůstající a Přilbosliz a udělí jim 15 poškození. Cooldown 30 s)."
    },
    {
     "level": 4,
     "xp": 890,
     "text": "Zvyšuje dosah na 175 px a blesk po zásahu zanechá na slizácích elektrický výboj (1 poškození za sekundu po dobu 2 s)."
    },
    {
     "level": 5,
     "xp": 1410,
     "text": "Radka vidí Duchslizy a její útoky procházejí i přes Runové slizáky."
    },
    {
     "level": 6,
     "xp": 2010,
     "text": "Základní poškození blesku se zvyšuje na 2."
    },
    {
     "level": 7,
     "xp": 2690,
     "text": "Zkracuje interval útoku z 0.9 s na 0.7 s."
    },
    {
     "level": 8,
     "xp": 3440,
     "text": "Všechny Magické věže v Radčině dosahu mají o +3 vyšší průraz."
    },
    {
     "level": 9,
     "xp": 4260,
     "text": "Očistná runa nyní uděluje 30 poškození a zpomalí zasažené slizáky o 50 % na 4 s."
    },
    {
     "level": 10,
     "xp": 5140,
     "text": "Odemkne Schopnost 2: Bouře živlů (po dobu 8 s pokryje cestu v dosahu runovým ohněm, který dává 30 poškození za sekundu všem slizákům a zpomaluje je o 40 %. Cooldown 55 s)."
    },
    {
     "level": 11,
     "xp": 6090,
     "text": "Radka vystřeluje 2 řetězové blesky současně."
    },
    {
     "level": 12,
     "xp": 7090,
     "text": "Základní poškození blesku stoupá na 3 a průraz na 10."
    },
    {
     "level": 13,
     "xp": 8150,
     "text": "Pasivní bonus z Krystalů moudrosti nyní přidává za každý držený KM také +2 % k rychlosti útoku (až +20 %)."
    },
    {
     "level": 14,
     "xp": 9260,
     "text": "Blesky dávají +5 bonusové poškození do Kamenných slizáků a slizových králů."
    },
    {
     "level": 15,
     "xp": 10430,
     "text": "Cooldown Očistné runy klesá na 20 sekund."
    },
    {
     "level": 16,
     "xp": 11650,
     "text": "Zkracuje interval útoku na 0.5 s."
    },
    {
     "level": 17,
     "xp": 12910,
     "text": "Bouře živlů trvá 10 sekund a uděluje 55 poškození za sekundu."
    },
    {
     "level": 18,
     "xp": 14230,
     "text": "Základní poškození blesku stoupá na 5."
    },
    {
     "level": 19,
     "xp": 15590,
     "text": "Radka vystřeluje 3 řetězové blesky současně."
    },
    {
     "level": 20,
     "xp": 17000,
     "text": "Očistná runa dává 60 poškození po celé mapě. Bouře živlů uděluje 100 poškození za sekundu po dobu 12 sekund a strhne 2 Runové pečetě z králů!"
    }
   ],
   "col": "#6d28d9",
   "ico": "⚡"
  },
  {
   "id": "kronikar_oskar",
   "name": "Královský kronikář Oskar",
   "role": "Podpora obrany, ekonomický rozvoj a maximalizace zisku ze svitků (kartiček).",
   "base": {
    "cost": 750,
    "range_px": 170,
    "damage": 1,
    "attack_interval_s": 1.4,
    "pierce": 2,
    "damage_type": "normal",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "passive": {
    "name": "Královské stipendium",
    "description": "Každá správně zodpovězená kartička dává o +30 % více zlaťáků a prodlužuje trvání Královského požehnání (Streak bonusu) z 10 na 15 sekund."
   },
   "levels": [
    {
     "level": 1,
     "xp": 0,
     "text": "Metá svitky světla a posiluje výdělky z kartiček o +30 %."
    },
    {
     "level": 2,
     "xp": 150,
     "text": "Na konci každé vlny vygeneruje Oskar bonusových +40 zlaťáků."
    },
    {
     "level": 3,
     "xp": 460,
     "text": "Odemkne Schopnost 1: Studium kronik (okamžitě vynuluje cooldown na otevření kartičky, přidá +1 povolenou kartičku v této vlně a zlevní příští nakoupený upgrade věže v dosahu o 15 %. Cooldown 45 s)."
    },
    {
     "level": 4,
     "xp": 890,
     "text": "Všechny věže v Oskarově dosahu získají +10 % k dostřelu."
    },
    {
     "level": 5,
     "xp": 1410,
     "text": "Zlaté doly na mapě vydělávají o +8 % více zlaťáků."
    },
    {
     "level": 6,
     "xp": 2010,
     "text": "Na konci každé vlny opraví Oskar +2 životy hradní brány a vygeneruje +80 zlaťáků."
    },
    {
     "level": 7,
     "xp": 2690,
     "text": "Pokaždé, když odpovíš správně na kartičku, Oskar vyšle tlakovou vlnu, která odhodí slizáky v jeho dosahu o 40 px zpět."
    },
    {
     "level": 8,
     "xp": 3440,
     "text": "Zvyšuje bonus k zlaťákům z kartiček z +30 % na +50 %!"
    },
    {
     "level": 9,
     "xp": 4260,
     "text": "Sleva ze schopnosti Studium kronik stoupá z 15 % na 20 %."
    },
    {
     "level": 10,
     "xp": 5140,
     "text": "Odemkne Schopnost 2: Královské požehnání (na 12 sekund zvýší VŠEM věžím na mapě rychlost útoku o 35 %, průraz o +3 a za každého zničeného slizáka přidá +1 zlaťák navíc. Cooldown 65 s)."
    },
    {
     "level": 11,
     "xp": 6090,
     "text": "Věže v Oskarově dosahu dávají +1 poškození do všech slizáků."
    },
    {
     "level": 12,
     "xp": 7090,
     "text": "Příjem na konci vlny stoupá na +150 zlaťáků."
    },
    {
     "level": 13,
     "xp": 8150,
     "text": "Pokud odpovíš na kartičku špatně, penalizační cooldown je s Oskarem poloviční (6 sekund místo 12)."
    },
    {
     "level": 14,
     "xp": 9260,
     "text": "Zlaté doly na mapě vydělávají o +15 % více zlaťáků."
    },
    {
     "level": 15,
     "xp": 10430,
     "text": "Za každých 5 správně zodpovězených kartiček dá Oskar +1 Krystal moudrosti navíc."
    },
    {
     "level": 16,
     "xp": 11650,
     "text": "Věže v Oskarově dosahu mají o 15 % rychlejší útok."
    },
    {
     "level": 17,
     "xp": 12910,
     "text": "Studium kronik nyní zlevňuje příští upgrade o 25 % a příští správná kartička dá +1 KM navíc."
    },
    {
     "level": 18,
     "xp": 14230,
     "text": "Příjem na konci vlny stoupá na +300 zlaťáků a +5 životů."
    },
    {
     "level": 19,
     "xp": 15590,
     "text": "Věže v Oskarově dosahu dávají +2 poškození (do slizových králů +5)."
    },
    {
     "level": 20,
     "xp": 17000,
     "text": "Královské požehnání trvá 16 sekund, zvyšuje rychlost útoku všech věží o 60 % a každá správná kartička dává dvojnásobek (+100 %) zlaťáků i +2 KM místo 1!"
    }
   ],
   "col": "#0f766e",
   "ico": "📜"
  }
 ],
 "enemies": {
  "kapicka_slizu": {
   "id": "kapicka_slizu",
   "name": "Kapička slizu",
   "hp": 1,
   "speed": 55,
   "kids": [],
   "gold": 1,
   "leak": 1,
   "traits": [],
   "look": "Malá modrá průsvitná kapička slizu.",
   "boss": false,
   "seal": null,
   "col": "#60a5fa",
   "r": 8
  },
  "lucni_slizak": {
   "id": "lucni_slizak",
   "name": "Luční slizák",
   "hp": 1,
   "speed": 70,
   "kids": [
    {
     "id": "kapicka_slizu",
     "n": 1,
     "mods": null
    }
   ],
   "gold": 1,
   "leak": 2,
   "traits": [],
   "look": "Jasně zelený slizák s drobnými lístky uvnitř rosolu.",
   "boss": false,
   "seal": null,
   "col": "#4ade80",
   "r": 10
  },
  "lesni_slizak": {
   "id": "lesni_slizak",
   "name": "Lesní slizák",
   "hp": 1,
   "speed": 85,
   "kids": [
    {
     "id": "lucni_slizak",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 1,
   "leak": 5,
   "traits": [],
   "look": "Žlutooranžový pružný slizák s větším jádrem.",
   "boss": false,
   "seal": null,
   "col": "#f59e0b",
   "r": 11
  },
  "bleskovy_sliz": {
   "id": "bleskovy_sliz",
   "name": "Bleskový sliz",
   "hp": 1,
   "speed": 145,
   "kids": [
    {
     "id": "lesni_slizak",
     "n": 1,
     "mods": null
    }
   ],
   "gold": 1,
   "leak": 6,
   "traits": [
    "fast"
   ],
   "look": "Růžovo-žlutý protáhlý slizák, za kterým zůstávají jiskry.",
   "boss": false,
   "seal": null,
   "col": "#f472b6",
   "r": 10
  },
  "cerny_sliz": {
   "id": "cerny_sliz",
   "name": "Černý sliz",
   "hp": 1,
   "speed": 75,
   "kids": [
    {
     "id": "lesni_slizak",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 2,
   "leak": 11,
   "traits": [
    "explosion_immune"
   ],
   "look": "Hutný černý dehtový sliz pohlcující otřesy.",
   "boss": false,
   "seal": null,
   "col": "#27272a",
   "r": 9
  },
  "snezny_sliz": {
   "id": "snezny_sliz",
   "name": "Sněžný sliz",
   "hp": 1,
   "speed": 80,
   "kids": [
    {
     "id": "lesni_slizak",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 2,
   "leak": 11,
   "traits": [
    "freeze_immune"
   ],
   "look": "Sněhově bílý slizák obklopený lehkým mrazivým oparem.",
   "boss": false,
   "seal": null,
   "col": "#f1f5f9",
   "r": 9
  },
  "runovy_sliz": {
   "id": "runovy_sliz",
   "name": "Runový sliz",
   "hp": 1,
   "speed": 125,
   "kids": [
    {
     "id": "bleskovy_sliz",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 2,
   "leak": 13,
   "traits": [
    "magic_immune",
    "energy_immune"
   ],
   "look": "Fialový slizák se zářícím antimagickým znakem na povrchu.",
   "boss": false,
   "seal": null,
   "col": "#a855f7",
   "r": 11
  },
  "prilbosliz": {
   "id": "prilbosliz",
   "name": "Přilbosliz",
   "hp": 1,
   "speed": 50,
   "kids": [
    {
     "id": "cerny_sliz",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 3,
   "leak": 23,
   "traits": [
    "armored"
   ],
   "look": "Šedý slizák naražený v těžké železné rytířské helmě.",
   "boss": false,
   "seal": null,
   "col": "#94a3b8",
   "r": 12
  },
  "duhovy_sliz": {
   "id": "duhovy_sliz",
   "name": "Duhový sliz",
   "hp": 1,
   "speed": 95,
   "kids": [
    {
     "id": "cerny_sliz",
     "n": 1,
     "mods": null
    },
    {
     "id": "snezny_sliz",
     "n": 1,
     "mods": null
    }
   ],
   "gold": 3,
   "leak": 23,
   "traits": [],
   "look": "Barevně měňavý slizák spojující oheň a led.",
   "boss": false,
   "seal": null,
   "col": "rainbow",
   "r": 12
  },
  "zlaty_sliz": {
   "id": "zlaty_sliz",
   "name": "Zlatý sliz",
   "hp": 10,
   "speed": 85,
   "kids": [
    {
     "id": "duhovy_sliz",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 12,
   "leak": 56,
   "traits": [],
   "look": "Tuhý slizák pokrytý popraskanou zlatou krustou (vydrží 10 zásahů před rozpadem).",
   "boss": false,
   "seal": null,
   "col": "#eab308",
   "r": 14
  },
  "slizovy_obr": {
   "id": "slizovy_obr",
   "name": "Slizový obr",
   "hp": 200,
   "speed": 40,
   "kids": [
    {
     "id": "zlaty_sliz",
     "n": 4,
     "mods": null
    }
   ],
   "gold": 100,
   "leak": 424,
   "traits": [
    "boss"
   ],
   "look": "Obrovský modrozelený slizák s dřevěným kyjem uvnitř těla a železnou korunou.",
   "boss": true,
   "seal": {
    "n": 2,
    "red": 0.75,
    "km": 3,
    "decay": 0.02
   },
   "col": "#14b8a6",
   "r": 30
  },
  "rudy_arcisliz": {
   "id": "rudy_arcisliz",
   "name": "Rudý arcisliz",
   "hp": 700,
   "speed": 30,
   "kids": [
    {
     "id": "slizovy_obr",
     "n": 4,
     "mods": null
    }
   ],
   "gold": 300,
   "leak": 2396,
   "traits": [
    "boss"
   ],
   "look": "Masivní krvavě rudý slizový kolos se zlatou korunou a planoucím jádrem.",
   "boss": true,
   "seal": {
    "n": 3,
    "red": 0.75,
    "km": 3,
    "decay": 0.02
   },
   "col": "#dc2626",
   "r": 38
  },
  "stinosliz_prizrak": {
   "id": "stinosliz_prizrak",
   "name": "Stínosliz Přízrak",
   "hp": 400,
   "speed": 60,
   "kids": [
    {
     "id": "zlaty_sliz",
     "n": 4,
     "mods": [
      "duchsliz",
      "dorustajici"
     ]
    }
   ],
   "gold": 250,
   "leak": 624,
   "traits": [
    "boss",
    "duchsliz",
    "armored",
    "explosion_immune"
   ],
   "look": "Rychlý temný přízračný král v černé zbroji, který kombinuje průhlednost Duchslizu, železnou helmu a odolnost vůči výbuchům.",
   "boss": true,
   "seal": {
    "n": 2,
    "red": 0.75,
    "km": 3,
    "decay": 0.02
   },
   "col": "#1e1b4b",
   "r": 32
  },
  "prastary_kral_slizu": {
   "id": "prastary_kral_slizu",
   "name": "Prastarý král slizů",
   "hp": 4000,
   "speed": 22,
   "kids": [
    {
     "id": "rudy_arcisliz",
     "n": 2,
     "mods": null
    },
    {
     "id": "stinosliz_prizrak",
     "n": 2,
     "mods": null
    }
   ],
   "gold": 1000,
   "leak": 10040,
   "traits": [
    "boss",
    "unstoppable_slow_immune"
   ],
   "look": "Gigantický fialovo-zlatý vládce všech slizáků s krystalovým trůnem uvnitř svého rosolovitého těla.",
   "boss": true,
   "seal": {
    "n": 4,
    "red": 0.75,
    "km": 4,
    "decay": 0.02
   },
   "col": "#7e22ce",
   "r": 50
  }
 },
 "mods": {
  "duchsliz": {
   "name": "Duchsliz",
   "effect": "Průhledný slizák – mohou na něj útočit pouze věže s viděním neviditelných nebo po osvětlení Světelnou světlicí."
  },
  "dorustajici": {
   "name": "Dorůstající sliz",
   "effect": "Pokud není po dobu 3.0 s zasažen, doroste o 1 vrstvu zpět až do své výchozí podoby."
  },
  "kamenny": {
   "name": "Kamenný sliz",
   "effect": "Ztuhlý v kamenném krunýři – má dvojnásobek (2.0×) životů oproti běžné verzi."
  }
 },
 "waves": [
  {
   "n": 1,
   "gold": 100,
   "why": null,
   "groups": [
    {
     "id": "kapicka_slizu",
     "n": 20,
     "every": 0.9,
     "at": 0,
     "mods": []
    }
   ]
  },
  {
   "n": 2,
   "gold": 105,
   "why": null,
   "groups": [
    {
     "id": "kapicka_slizu",
     "n": 30,
     "every": 0.65,
     "at": 0,
     "mods": []
    }
   ]
  },
  {
   "n": 3,
   "gold": 110,
   "why": null,
   "groups": [
    {
     "id": "kapicka_slizu",
     "n": 15,
     "every": 0.6,
     "at": 0,
     "mods": []
    },
    {
     "id": "lucni_slizak",
     "n": 8,
     "every": 0.9,
     "at": 5,
     "mods": []
    }
   ]
  },
  {
   "n": 4,
   "gold": 115,
   "why": null,
   "groups": [
    {
     "id": "lucni_slizak",
     "n": 22,
     "every": 0.6,
     "at": 0,
     "mods": []
    }
   ]
  },
  {
   "n": 5,
   "gold": 120,
   "why": null,
   "groups": [
    {
     "id": "lucni_slizak",
     "n": 15,
     "every": 0.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "lesni_slizak",
     "n": 8,
     "every": 0.8,
     "at": 6,
     "mods": []
    }
   ]
  },
  {
   "n": 6,
   "gold": 125,
   "why": null,
   "groups": [
    {
     "id": "kapicka_slizu",
     "n": 15,
     "every": 0.3,
     "at": 0,
     "mods": []
    },
    {
     "id": "lesni_slizak",
     "n": 15,
     "every": 0.6,
     "at": 4,
     "mods": []
    }
   ]
  },
  {
   "n": 7,
   "gold": 130,
   "why": null,
   "groups": [
    {
     "id": "lesni_slizak",
     "n": 20,
     "every": 0.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "bleskovy_sliz",
     "n": 6,
     "every": 0.7,
     "at": 8,
     "mods": []
    }
   ]
  },
  {
   "n": 8,
   "gold": 135,
   "why": null,
   "groups": [
    {
     "id": "lesni_slizak",
     "n": 15,
     "every": 0.5,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "bleskovy_sliz",
     "n": 12,
     "every": 0.45,
     "at": 6,
     "mods": []
    }
   ]
  },
  {
   "n": 9,
   "gold": 140,
   "why": null,
   "groups": [
    {
     "id": "lesni_slizak",
     "n": 35,
     "every": 0.25,
     "at": 0,
     "mods": []
    }
   ]
  },
  {
   "n": 10,
   "gold": 145,
   "why": null,
   "groups": [
    {
     "id": "lucni_slizak",
     "n": 50,
     "every": 0.15,
     "at": 0,
     "mods": []
    },
    {
     "id": "bleskovy_sliz",
     "n": 15,
     "every": 0.35,
     "at": 7,
     "mods": [
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 11,
   "gold": 150,
   "why": null,
   "groups": [
    {
     "id": "cerny_sliz",
     "n": 10,
     "every": 0.7,
     "at": 0,
     "mods": []
    },
    {
     "id": "snezny_sliz",
     "n": 10,
     "every": 0.7,
     "at": 5,
     "mods": []
    }
   ]
  },
  {
   "n": 12,
   "gold": 155,
   "why": "První vlna průhledných Duchslizů. Hráč buď musí mít postavený detekční upgrade věže, nebo musí utratit 1 KM z kartiček za Světelnou světlici.",
   "groups": [
    {
     "id": "lesni_slizak",
     "n": 12,
     "every": 0.6,
     "at": 0,
     "mods": [
      "duchsliz"
     ]
    },
    {
     "id": "bleskovy_sliz",
     "n": 15,
     "every": 0.4,
     "at": 6,
     "mods": []
    }
   ]
  },
  {
   "n": 13,
   "gold": 160,
   "why": null,
   "groups": [
    {
     "id": "cerny_sliz",
     "n": 15,
     "every": 0.4,
     "at": 0,
     "mods": []
    },
    {
     "id": "bleskovy_sliz",
     "n": 20,
     "every": 0.3,
     "at": 4,
     "mods": [
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 14,
   "gold": 165,
   "why": null,
   "groups": [
    {
     "id": "runovy_sliz",
     "n": 14,
     "every": 0.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "lesni_slizak",
     "n": 25,
     "every": 0.25,
     "at": 5,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 15,
   "gold": 170,
   "why": null,
   "groups": [
    {
     "id": "prilbosliz",
     "n": 8,
     "every": 1.1,
     "at": 0,
     "mods": []
    },
    {
     "id": "bleskovy_sliz",
     "n": 15,
     "every": 0.35,
     "at": 4,
     "mods": [
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 16,
   "gold": 175,
   "why": null,
   "groups": [
    {
     "id": "duhovy_sliz",
     "n": 12,
     "every": 0.6,
     "at": 0,
     "mods": []
    },
    {
     "id": "runovy_sliz",
     "n": 15,
     "every": 0.4,
     "at": 5,
     "mods": []
    }
   ]
  },
  {
   "n": 17,
   "gold": 180,
   "why": null,
   "groups": [
    {
     "id": "prilbosliz",
     "n": 10,
     "every": 0.8,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "duhovy_sliz",
     "n": 10,
     "every": 0.5,
     "at": 6,
     "mods": [
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 18,
   "gold": 185,
   "why": null,
   "groups": [
    {
     "id": "lesni_slizak",
     "n": 60,
     "every": 0.1,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "zlaty_sliz",
     "n": 4,
     "every": 1.5,
     "at": 5,
     "mods": []
    }
   ]
  },
  {
   "n": 19,
   "gold": 190,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 8,
     "every": 0.9,
     "at": 0,
     "mods": []
    },
    {
     "id": "duhovy_sliz",
     "n": 15,
     "every": 0.4,
     "at": 4,
     "mods": [
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 20,
   "gold": 195,
   "why": "První Boss (Slizový obr) chráněný Runovou pečetí (75% redukce poškození). Pro proražení štítu je nutné správně zodpovědět 2 kartičky během souboje nebo zaplatit 3 KM, a mít aspoň jednu věž úrovně 4 (stojí 2 KM).",
   "groups": [
    {
     "id": "slizovy_obr",
     "n": 1,
     "every": 1,
     "at": 0,
     "mods": []
    },
    {
     "id": "prilbosliz",
     "n": 6,
     "every": 1,
     "at": 4,
     "mods": []
    }
   ]
  },
  {
   "n": 21,
   "gold": 200,
   "why": "Od vlny 21 klesá zlaťáková odměna za ničení slizáků na 40 % – příjem ze svitků (kartiček) a věží úrovně 4 se stává klíčovým.",
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 12,
     "every": 0.6,
     "at": 0,
     "mods": []
    },
    {
     "id": "runovy_sliz",
     "n": 25,
     "every": 0.2,
     "at": 4,
     "mods": []
    }
   ]
  },
  {
   "n": 22,
   "gold": 205,
   "why": null,
   "groups": [
    {
     "id": "duhovy_sliz",
     "n": 30,
     "every": 0.25,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "prilbosliz",
     "n": 12,
     "every": 0.5,
     "at": 3,
     "mods": [
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 23,
   "gold": 210,
   "why": null,
   "groups": [
    {
     "id": "slizovy_obr",
     "n": 2,
     "every": 5,
     "at": 0,
     "mods": []
    },
    {
     "id": "zlaty_sliz",
     "n": 10,
     "every": 0.5,
     "at": 2,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 24,
   "gold": 215,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 15,
     "every": 0.4,
     "at": 0,
     "mods": [
      "duchsliz"
     ]
    },
    {
     "id": "runovy_sliz",
     "n": 30,
     "every": 0.15,
     "at": 5,
     "mods": [
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 25,
   "gold": 220,
   "why": null,
   "groups": [
    {
     "id": "slizovy_obr",
     "n": 3,
     "every": 4,
     "at": 0,
     "mods": []
    },
    {
     "id": "prilbosliz",
     "n": 20,
     "every": 0.3,
     "at": 2,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 26,
   "gold": 225,
   "why": null,
   "groups": [
    {
     "id": "duhovy_sliz",
     "n": 50,
     "every": 0.12,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "slizovy_obr",
     "n": 1,
     "every": 1,
     "at": 5,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 27,
   "gold": 230,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 35,
     "every": 0.15,
     "at": 0,
     "mods": []
    }
   ]
  },
  {
   "n": 28,
   "gold": 235,
   "why": null,
   "groups": [
    {
     "id": "slizovy_obr",
     "n": 4,
     "every": 2.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "zlaty_sliz",
     "n": 15,
     "every": 0.3,
     "at": 3,
     "mods": [
      "kamenny",
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 29,
   "gold": 240,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 25,
     "every": 0.2,
     "at": 0,
     "mods": [
      "kamenny"
     ]
    },
    {
     "id": "slizovy_obr",
     "n": 2,
     "every": 3,
     "at": 4,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 30,
   "gold": 245,
   "why": "Druhý hlavní Boss (Rudý arcisliz) se 3 Runovými pečetěmi a nutnost mít první věž úrovně 5 (vyžaduje 5 KM).",
   "groups": [
    {
     "id": "rudy_arcisliz",
     "n": 1,
     "every": 1,
     "at": 0,
     "mods": []
    },
    {
     "id": "zlaty_sliz",
     "n": 12,
     "every": 0.4,
     "at": 5,
     "mods": [
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 31,
   "gold": 250,
   "why": null,
   "groups": [
    {
     "id": "slizovy_obr",
     "n": 6,
     "every": 1.8,
     "at": 0,
     "mods": []
    },
    {
     "id": "runovy_sliz",
     "n": 40,
     "every": 0.1,
     "at": 2,
     "mods": [
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 32,
   "gold": 255,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 50,
     "every": 0.08,
     "at": 0,
     "mods": [
      "dorustajici"
     ]
    },
    {
     "id": "slizovy_obr",
     "n": 3,
     "every": 2,
     "at": 4,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 33,
   "gold": 260,
   "why": null,
   "groups": [
    {
     "id": "rudy_arcisliz",
     "n": 1,
     "every": 1,
     "at": 0,
     "mods": []
    },
    {
     "id": "slizovy_obr",
     "n": 4,
     "every": 1.5,
     "at": 3,
     "mods": []
    }
   ]
  },
  {
   "n": 34,
   "gold": 265,
   "why": null,
   "groups": [
    {
     "id": "zlaty_sliz",
     "n": 40,
     "every": 0.1,
     "at": 0,
     "mods": [
      "kamenny",
      "duchsliz"
     ]
    }
   ]
  },
  {
   "n": 35,
   "gold": 270,
   "why": "První útok extrémně rychlých Stínoslizů Přízraků (kombinace Boss + Duchsliz + Přilbosliz + Černý sliz) s Runovou pečetí.",
   "groups": [
    {
     "id": "stinosliz_prizrak",
     "n": 3,
     "every": 2.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "zlaty_sliz",
     "n": 20,
     "every": 0.2,
     "at": 1,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 36,
   "gold": 275,
   "why": null,
   "groups": [
    {
     "id": "rudy_arcisliz",
     "n": 2,
     "every": 4,
     "at": 0,
     "mods": []
    },
    {
     "id": "slizovy_obr",
     "n": 5,
     "every": 1.2,
     "at": 2,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 37,
   "gold": 280,
   "why": null,
   "groups": [
    {
     "id": "stinosliz_prizrak",
     "n": 5,
     "every": 1.5,
     "at": 0,
     "mods": []
    },
    {
     "id": "rudy_arcisliz",
     "n": 1,
     "every": 1,
     "at": 4,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 38,
   "gold": 285,
   "why": null,
   "groups": [
    {
     "id": "rudy_arcisliz",
     "n": 3,
     "every": 3,
     "at": 0,
     "mods": []
    },
    {
     "id": "zlaty_sliz",
     "n": 60,
     "every": 0.06,
     "at": 1,
     "mods": [
      "kamenny",
      "dorustajici"
     ]
    }
   ]
  },
  {
   "n": 39,
   "gold": 290,
   "why": null,
   "groups": [
    {
     "id": "stinosliz_prizrak",
     "n": 6,
     "every": 1,
     "at": 0,
     "mods": [
      "kamenny"
     ]
    },
    {
     "id": "rudy_arcisliz",
     "n": 2,
     "every": 3,
     "at": 3,
     "mods": [
      "kamenny"
     ]
    }
   ]
  },
  {
   "n": 40,
   "gold": 295,
   "why": "Finální Boss (Prastarý král slizů) se 4 Runovými pečetěmi a 4 000 životy. Vyžaduje nejméně dvě věže úrovně 5 a aktivní prolomení pečetí přes kartičky.",
   "groups": [
    {
     "id": "prastary_kral_slizu",
     "n": 1,
     "every": 1,
     "at": 0,
     "mods": []
    },
    {
     "id": "stinosliz_prizrak",
     "n": 2,
     "every": 3,
     "at": 8,
     "mods": []
    }
   ]
  }
 ],
 "maps": [
  {
   "id": "kralovske_predhradi",
   "name": "Královské předhradí",
   "difficulty": "easy",
   "canvas_size": {
    "width_px": 1280,
    "height_px": 720
   },
   "playable_area": {
    "width_px": 1040,
    "height_px": 720
   },
   "track_width_px": 44,
   "paths": [
    [
     {
      "x": 0,
      "y": 140
     },
     {
      "x": 300,
      "y": 140
     },
     {
      "x": 300,
      "y": 560
     },
     {
      "x": 560,
      "y": 560
     },
     {
      "x": 560,
      "y": 180
     },
     {
      "x": 840,
      "y": 180
     },
     {
      "x": 840,
      "y": 480
     },
     {
      "x": 1040,
      "y": 480
     }
    ]
   ],
   "water_zones": [
    {
     "name": "Hradní příkop",
     "x": 360,
     "y": 260,
     "width": 140,
     "height": 180
    }
   ],
   "obstacles": [
    {
     "name": "Rozbořená strážní věž",
     "x": 640,
     "y": 300,
     "width": 120,
     "height": 120,
     "removable": true,
     "remove_cost_gold": 500
    },
    {
     "name": "Mechový balvan",
     "x": 100,
     "y": 360,
     "width": 110,
     "height": 90,
     "removable": false
    }
   ]
  },
  {
   "id": "soutok_dvou_rek",
   "name": "Soutok dvou řek",
   "difficulty": "medium",
   "canvas_size": {
    "width_px": 1280,
    "height_px": 720
   },
   "playable_area": {
    "width_px": 1040,
    "height_px": 720
   },
   "track_width_px": 44,
   "paths": [
    [
     {
      "x": 0,
      "y": 100
     },
     {
      "x": 420,
      "y": 100
     },
     {
      "x": 420,
      "y": 360
     },
     {
      "x": 720,
      "y": 360
     },
     {
      "x": 720,
      "y": 160
     },
     {
      "x": 1040,
      "y": 160
     }
    ],
    [
     {
      "x": 0,
      "y": 620
     },
     {
      "x": 420,
      "y": 620
     },
     {
      "x": 420,
      "y": 360
     },
     {
      "x": 720,
      "y": 360
     },
     {
      "x": 720,
      "y": 560
     },
     {
      "x": 1040,
      "y": 560
     }
    ]
   ],
   "water_zones": [
    {
     "name": "Západní tůň",
     "x": 180,
     "y": 270,
     "width": 160,
     "height": 180
    },
    {
     "name": "Východní tůň",
     "x": 800,
     "y": 280,
     "width": 140,
     "height": 160
    }
   ],
   "obstacles": [
    {
     "name": "Severní skalní útes",
     "x": 500,
     "y": 80,
     "width": 160,
     "height": 140,
     "removable": false
    },
    {
     "name": "Jižní skalní útes",
     "x": 500,
     "y": 500,
     "width": 160,
     "height": 140,
     "removable": false
    }
   ]
  }
 ],
 "econ": {
  "currencies": {
   "primary": {
    "id": "gold",
    "name": "Zlaťáky",
    "symbol": "zl"
   },
   "secondary": {
    "id": "knowledge_points",
    "name": "Krystaly moudrosti",
    "symbol": "KM"
   },
   "km_to_gold_conversion_rate": 100,
   "gold_to_km_conversion_allowed": false
  },
  "singleplayer": {
   "starting_gold": 650,
   "starting_lives": 150,
   "starting_knowledge_points": 0,
   "inter_wave_pause_s": 15,
   "early_wave_start_bonus_gold_per_s": 2,
   "end_of_wave_base_gold": 95,
   "end_of_wave_per_wave_gold": 5,
   "pop_reward_scaling_by_wave": [
    {
     "from_wave": 1,
     "to_wave": 10,
     "multiplier": 1
    },
    {
     "from_wave": 11,
     "to_wave": 20,
     "multiplier": 0.7
    },
    {
     "from_wave": 21,
     "to_wave": 30,
     "multiplier": 0.4
    },
    {
     "from_wave": 31,
     "to_wave": 40,
     "multiplier": 0.2
    }
   ],
   "sell_refund_between_waves_pct": 0.8,
   "sell_refund_during_wave_pct": 0.7,
   "sell_refund_knowledge_points_pct": 1
  },
  "flashcards": {
   "max_per_wave": 3,
   "correct_cooldown_during_wave_s": 5,
   "correct_cooldown_between_waves_s": 1.5,
   "wrong_answer_cooldown_s": 12,
   "wrong_answer_consumes_wave_quota": false,
   "singleplayer_slow_motion_factor": 0.25,
   "singleplayer_slow_motion_max_s": 8,
   "reward_knowledge_points": 1,
   "reward_base_gold": 35,
   "reward_per_wave_gold": 5,
   "streak_required_count": 3,
   "streak_bonus_knowledge_points": 1,
   "streak_buff_duration_s": 10,
   "streak_buff_attack_speed_pct": 0.1,
   "emergency_flare_cost_km": 1,
   "emergency_flare_reveal_duration_s": 15,
   "hero_xp_per_correct_answer": 120,
   "direct_hero_xp_per_1_km": 350,
   "versus_bucket_size": 5
  }
 },
 "versus": {
  "starting_lives": 150,
  "starting_gold": 700,
  "base_eco_income_gold": 250,
  "eco_payout_interval_s": 6,
  "eco_soft_cap_threshold": 1500,
  "eco_soft_cap_multiplier": 0.5,
  "eco_hard_cap": 3000,
  "sudden_death_wave": 30,
  "sudden_death_enemy_stat_increase_per_wave_pct": 0.5,
  "defense_bounty_cashback_pct": 0.35,
  "ffa_3_to_4_players": {
   "targeting_modes": [
    "auto_leader",
    "round_robin",
    "manual"
   ],
   "manual_non_leader_eco_penalty_pct": 0.15,
   "anti_focus_window_s": 15,
   "stage_1_mild_focus": {
    "threshold_eco_multiple": 1.5,
    "defender_attack_speed_buff_pct": 0.15,
    "attacker_send_cost_increase_pct": 0.25
   },
   "stage_2_hard_throttle": {
    "threshold_eco_multiple": 3,
    "lockout_duration_s": 8
   },
   "elimination_queued_sends_refund_pct": 0.5
  },
  "teams_2v2": {
   "shared_team_lives": 200,
   "gold_and_km_transfer_tax_pct": 0.1,
   "sent_enemies_split_per_opponent_pct": 0.5
  },
  "disconnect_handling": {
   "grace_period_s": 30,
   "2v2_remaining_player_eco_inheritance_pct": 0.75
  },
  "sends": [
   {
    "id": "houf_kapicek",
    "name": "Houf kapiček",
    "unlock_wave": 1,
    "cost_gold": 50,
    "eco_change": 2.5,
    "enemy_id": "kapicka_slizu",
    "count": 5,
    "spacing_s": 0.2,
    "cooldown_s": 1,
    "queue_cap": 5,
    "modifiers": []
   },
   {
    "id": "lucni_smecka",
    "name": "Luční smečka",
    "unlock_wave": 2,
    "cost_gold": 85,
    "eco_change": 4,
    "enemy_id": "lucni_slizak",
    "count": 5,
    "spacing_s": 0.25,
    "cooldown_s": 1.2,
    "queue_cap": 5,
    "modifiers": []
   },
   {
    "id": "lesni_roj",
    "name": "Lesní roj",
    "unlock_wave": 4,
    "cost_gold": 140,
    "eco_change": 6.5,
    "enemy_id": "lesni_slizak",
    "count": 6,
    "spacing_s": 0.2,
    "cooldown_s": 1.5,
    "queue_cap": 4,
    "modifiers": []
   },
   {
    "id": "bleskovy_vpad",
    "name": "Bleskový vpád",
    "unlock_wave": 6,
    "cost_gold": 210,
    "eco_change": 8.5,
    "enemy_id": "bleskovy_sliz",
    "count": 6,
    "spacing_s": 0.15,
    "cooldown_s": 2,
    "queue_cap": 3,
    "modifiers": []
   },
   {
    "id": "dorustajici_vlna",
    "name": "Dorůstající vlna",
    "unlock_wave": 8,
    "cost_gold": 280,
    "eco_change": 10.5,
    "enemy_id": "lesni_slizak",
    "count": 5,
    "spacing_s": 0.25,
    "cooldown_s": 2.5,
    "queue_cap": 3,
    "modifiers": [
     "dorustajici"
    ]
   },
   {
    "id": "plizivi_duchslizove",
    "name": "Plíživí duchslizové",
    "unlock_wave": 10,
    "cost_gold": 360,
    "eco_change": 12,
    "enemy_id": "duhovy_sliz",
    "count": 5,
    "spacing_s": 0.3,
    "cooldown_s": 3,
    "queue_cap": 3,
    "modifiers": [
     "duchsliz"
    ]
   },
   {
    "id": "zelezny_oddil",
    "name": "Železný oddíl",
    "unlock_wave": 12,
    "cost_gold": 450,
    "eco_change": 15,
    "enemy_id": "prilbosliz",
    "count": 4,
    "spacing_s": 0.4,
    "cooldown_s": 3.5,
    "queue_cap": 3,
    "modifiers": []
   },
   {
    "id": "runova_lavina",
    "name": "Runová lavina",
    "unlock_wave": 14,
    "cost_gold": 900,
    "eco_change": -10,
    "enemy_id": "runovy_sliz",
    "count": 15,
    "spacing_s": 0.1,
    "cooldown_s": 8,
    "queue_cap": 1,
    "modifiers": []
   },
   {
    "id": "vpad_slizoveho_obra",
    "name": "Vpád Slizového obra",
    "unlock_wave": 17,
    "cost_gold": 1400,
    "eco_change": -25,
    "enemy_id": "slizovy_obr",
    "count": 1,
    "escort": {
     "enemy_id": "prilbosliz",
     "count": 4
    },
    "spacing_s": 0.5,
    "cooldown_s": 12,
    "queue_cap": 1,
    "modifiers": []
   },
   {
    "id": "hnev_prastareho_krale",
    "name": "Hněv Prastarého krále",
    "unlock_wave": 22,
    "cost_gold": 3500,
    "eco_change": -80,
    "enemy_id": "prastary_kral_slizu",
    "count": 1,
    "spacing_s": 1,
    "cooldown_s": 20,
    "queue_cap": 1,
    "modifiers": [
     "kamenny"
    ]
   }
  ],
  "sabotages": [
   {
    "id": "zkamenet_slizaky",
    "name": "Zkamenět slizáky",
    "knowledge_points_cost": 2,
    "effect": "Příští poslaná skupina slizáků na soupeře získá vlastnost Kamenný sliz (2× životy) zdarma."
   },
   {
    "id": "kletba_zapomneni",
    "name": "Kletba zapomnění",
    "knowledge_points_cost": 3,
    "effect": "Uvrhne kletbu na soupeřovu nejsilnější věž (útočí o 50 % pomaleji po dobu 10 s, nebo dokud soupeř správně nerozluští 1 svitek)."
   }
  ]
 },
 "coop": {
  "shared_lives": 150,
  "transfer_tax_pct": 0,
  "team_quiz_every_n_waves": 5,
  "team_quiz_time_limit_s": 10,
  "team_quiz_reward_per_player": {
   "gold": 150,
   "knowledge_points": 2
  },
  "scaling_by_player_count": {
   "2_players": {
    "starting_gold_per_player": 450,
    "enemy_count_multiplier": 1.25,
    "boss_hp_multiplier": 1.4,
    "pop_and_wave_reward_split_per_player": 0.5
   },
   "3_players": {
    "starting_gold_per_player": 375,
    "enemy_count_multiplier": 1.5,
    "boss_hp_multiplier": 1.8,
    "pop_and_wave_reward_split_per_player": 0.333
   },
   "4_players": {
    "starting_gold_per_player": 325,
    "enemy_count_multiplier": 1.75,
    "boss_hp_multiplier": 2.2,
    "pop_and_wave_reward_split_per_player": 0.25
   }
  }
 }
};

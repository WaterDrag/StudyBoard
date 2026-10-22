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
  },
  {
   "id": "kladec_pasti",
   "name": "Kladeč pastí",
   "cat": "support",
   "desc": "Obranná dílna, která neútočí přímo na slizáky, ale hází na cestu ve svém dosahu hromádky železných ježků a pastí. Ideální pojistka před hradní bránou.",
   "col": "#64748b",
   "ico": "🪤",
   "short": "Pasti",
   "base": {
    "cost": 325,
    "range_px": 115,
    "damage": 1,
    "attack_interval_s": 1.65,
    "pierce": 5,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": true,
    "placement": "land",
    "radius_px": 20
   },
   "attack": {
    "pattern": "trap_on_track",
    "max_traps_on_track": 18,
    "trap_lifetime_s": 50,
    "trap_hitbox_radius_px": 14,
    "persist_between_waves": false,
    "target_selection": "random_track_point_in_range"
   },
   "projectile_look": "Svazek pěti šedých železných čtyřhrotých ježků (caltrops) s kovovým odleskem, který dopadne na cestu obloukem.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Větší svazky",
      "cost": 150,
      "km": 0,
      "fx": {
       "pierce_add": 4
      },
      "desc": "Každá hromádka pastí na cestě má o +4 hroty více (celkem vydrží 9 zásahů před zničením).",
      "visual": "U paty dílny přibude dřevěná bedna plná čerstvě vykovaných železných hrotů."
     },
     {
      "tier": 2,
      "name": "Rozžhavené ostny",
      "cost": 280,
      "km": 0,
      "fx": {
       "damage_type_set": "normal",
       "burn_dps": 1,
       "burn_duration_s": 3
      },
      "desc": "Rozžhavené hroty prorazí i železné helmy Přilboslizů i zmrzlé slizáky a zapálí je na 3 s (1 poškození/s).",
      "visual": "Uvnitř dílny zaplane kovářská výheň s měchem a hroty v koši žhnou oranžovou barvou."
     },
     {
      "tier": 3,
      "name": "Medvědí čelisti",
      "cost": 850,
      "km": 0,
      "fx": {
       "damage_add": 2,
       "bonus_ceramic_damage": 4,
       "bonus_fortified_damage": 3,
       "stun_duration_s": 0.6
      },
      "desc": "Místo malých ježků klade těžké ocelové čelisti: +2 poškození (celkem 3), +4 do Zlatých slizů, +3 do kamenných a chyceného slizáka na 0,6 s znehybní.",
      "visual": "Kolem dílny visí na řetězech mohutné zubaté ocelové čelisti s napruženými péry."
     },
     {
      "tier": 4,
      "name": "Trpasličí minové pole",
      "cost": 2800,
      "km": 2,
      "fx": {
       "damage_add": 3,
       "explode_on_trap_deplete": true,
       "explosion_damage": 18,
       "explosion_radius_px": 60,
       "explosion_pierce": 25
      },
      "desc": "Zvyšuje poškození čelistí o +3 (celkem 6). Jakmile past spotřebuje poslední výdrž, exploduje za 18 poškození v okruhu 60 px (zasáhne až 25 slizáků).",
      "visual": "Dílna je přestavěna na kamennou zbrojnici s červenými výbušnými soudky a mosaznými rozbuškami."
     },
     {
      "tier": 5,
      "name": "Pevnost věčných min",
      "cost": 16500,
      "km": 5,
      "fx": {
       "damage_add": 6,
       "pierce_add": 6,
       "explosion_damage": 85,
       "explosion_radius_px": 95,
       "explosion_pierce": 60,
       "stun_moab_duration_s": 1.2
      },
      "desc": "Klade kolosální zlaté runové miny (poškození 12 na šlápnutí, výdrž 15). Výbuch po vyčerpání udělí 85 poškození v okruhu 95 px a na 1,2 s omráčí i slizové krále.",
      "visual": "Černo-zlatá trpasličí pevnost s dýmajícím komínem, jeřábem a žhnoucími magickými minami s rubínovým středem."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Dvojitý katapult",
      "cost": 180,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.72
      },
      "desc": "Mechanický podavač zrychluje kladení pastí (interval útoku se násobí 0,72×).",
      "visual": "Na střeše dílny přibude druhé dřevěné házecí rameno s pružinou."
     },
     {
      "tier": 2,
      "name": "Široký rozptyl",
      "cost": 320,
      "km": 0,
      "fx": {
       "range_add_px": 45,
       "max_traps_on_track_add": 10
      },
      "desc": "Zvyšuje dosah kladení o +45 px (na 160 px) a maximální počet současně ležících pastí o +10 (na 28).",
      "visual": "Věžička má otočnou mosaznou hlaveň s dvojitým bubnem a vyšší pozorovací stříškou."
     },
     {
      "tier": 3,
      "name": "Trhač králů",
      "cost": 1150,
      "km": 0,
      "fx": {
       "bonus_boss_damage": 9,
       "bonus_moab_damage": 9,
       "slow_moab_pct": 25,
       "slow_duration_s": 2.5
      },
      "desc": "Pasti mají zpětné harpunové háky: dávají +9 poškození za každý hrot do slizových králů a zpomalují je o 25 % na 2,5 s.",
      "visual": "Věž z tmavého železa ověšená těžkými kotvami, řetězy a rudým praporem lovců obrů."
     },
     {
      "tier": 4,
      "name": "Kobercový výsev",
      "cost": 3300,
      "km": 2,
      "fx": {
       "attack_interval_mult": 0.65,
       "ability": {
        "name": "Kobercový výsev",
        "kind": "carpet_of_spikes",
        "cooldown_s": 30,
        "effect": "Zrychluje kladení (interval ×0,65). Aktivní schopnost (cooldown 30 s): okamžitě pokryje celou cestu od začátku až k bráně 20 pastmi."
       },
       "ability_cooldown_s": 30,
       "ability_traps_count": 20
      },
      "desc": "Zrychluje kladení (interval ×0,65). Aktivní schopnost (cooldown 30 s): okamžitě pokryje celou cestu od začátku až k bráně 20 pastmi.",
      "visual": "Vysoká ocelová věž se čtyřmi výmetnicemi mířícími k nebi a ozubeným hodinovým strojem."
     },
     {
      "tier": 5,
      "name": "Bouře oceli",
      "cost": 17500,
      "km": 5,
      "fx": {
       "attack_interval_mult": 0.5,
       "bonus_boss_damage": 22,
       "passive_carpet_interval_s": 12,
       "passive_carpet_traps_count": 15
      },
      "desc": "Dvojnásobná rychlost kladení a celkem +31 poškození na hrot do bossů. Navíc každých 12 s automaticky vystřelí salvu 15 pastí po celé délce mapy.",
      "visual": "Monumentální parní baterie se zlatými hlavněmi, ze kterých neustále srší jiskry a létají ostny do všech stran."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Kalená ocel",
      "cost": 140,
      "km": 0,
      "fx": {
       "trap_lifetime_add_s": 50,
       "persist_between_waves": true
      },
      "desc": "Pasti na cestě vydrží o +50 s déle (celkem 100 s) a nerozpadnou se na konci vlny — zůstávají do dalších vln.",
      "visual": "Střecha dílny je pobitá modravými ocelovými pláty a vedle stojí sud s kalicím olejem."
     },
     {
      "tier": 2,
      "name": "Chytré zaměření",
      "cost": 240,
      "km": 0,
      "fx": {
       "allow_target_priority": true,
       "start_of_wave_burst_mult": 3,
       "start_of_wave_burst_duration_s": 3
      },
      "desc": "Umožňuje zvolit místo dopadu (blízko věže / nejdále po cestě k bráně) a na první 3 s každé vlny klade pasti 3× rychleji.",
      "visual": "Na střeše sedí trpasličí pozorovatel s mosazným kukátkem a směrovou korouhvičkou."
     },
     {
      "tier": 3,
      "name": "Diamantové hroty",
      "cost": 950,
      "km": 0,
      "fx": {
       "attack_interval_mult": 2.2,
       "pierce_add": 45,
       "trap_lifetime_add_s": 140,
       "max_traps_on_track_set": 12
      },
      "desc": "Klade pomaleji (interval ×2,2), ale každá hromádka má o +45 větší výdrž (celkem 50 zásahů) a vydrží na cestě až 240 sekund (max. 12 hromad).",
      "visual": "Kamenná pevnost s azurově modrou střechou, kde trpaslík brousí obří krystalové ostny."
     },
     {
      "tier": 4,
      "name": "Runová barikáda",
      "cost": 3100,
      "km": 2,
      "fx": {
       "damage_add": 3,
       "pierce_add": 50,
       "strip_camo_on_hit": true,
       "strip_regrow": true
      },
      "desc": "Zvyšuje poškození každého hrotu o +3 (celkem 4) a výdrž o dalších +50 (celkem 100 zásahů). Při dotyku trvale zruší průhlednost i dorůstání.",
      "visual": "Kolem věže levitují čtyři kamenné pilíře se zářícími modrými runami a uprostřed se točí krystalový brus."
     },
     {
      "tier": 5,
      "name": "Neprostupná brána království",
      "cost": 15800,
      "km": 5,
      "fx": {
       "damage_add": 8,
       "pierce_add": 200,
       "trap_lifetime_add_s": 360,
       "end_of_wave_cash_per_active_trap": 20
      },
      "desc": "Každá past má poškození 12, výdrž 300 zásahů a životnost 600 s (10 minut). Každá nespotřebovaná past na cestě navíc na konci vlny vygeneruje 20 zlaťáků.",
      "visual": "Zářící platinovo-zlatá citadela s runovým oltářem, který na cestu pokládá nezničitelné diamantové zátarasy."
     }
    ]
   ]
  },
  {
   "id": "lesni_druid",
   "name": "Lesní druid",
   "cat": "magic",
   "desc": "Strážce prastarého hvozdu, který vystřeluje vějíř ostrých trnů. Dokáže ovládnout blesky bouře, spoutat slizáky kořeny nebo probudit medvědí zuřivost.",
   "col": "#15803d",
   "ico": "🌿",
   "short": "Druid",
   "base": {
    "cost": 390,
    "range_px": 115,
    "damage": 1,
    "attack_interval_s": 1.05,
    "pierce": 1,
    "projectiles": 5,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 20
   },
   "attack": {
    "pattern": "cone_burst",
    "spread_deg": 28,
    "projectile_speed_px_s": 460
   },
   "projectile_look": "Zelenohnědý dřevěný trn se světle zelenou špičkou a drobným lístečkem na konci.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Dubové trny",
      "cost": 160,
      "km": 0,
      "fx": {
       "pierce_add": 1,
       "damage_type_set": "normal"
      },
      "desc": "Tvrdé dubové trny proletí o 1 slizáka navíc (průraz 2) a prorazí železné helmy i zmrzlé slizáky.",
      "visual": "Druid má na ramenou dubovou kůru a jeho hůl je zakončena parožím."
     },
     {
      "tier": 2,
      "name": "Srdce hromu",
      "cost": 330,
      "km": 0,
      "fx": {
       "secondary_zap_interval_s": 2,
       "zap_damage": 2,
       "zap_bounce_targets": 8,
       "zap_damage_type": "energy"
      },
      "desc": "Každé 2,0 s navíc vyšle z hole kulový blesk, který přeskočí až na 8 slizáků a udělí každému 2 poškození.",
      "visual": "Drahokam v parohové holi modře jiskří a přes zelený plášť přebíhají drobné výboje."
     },
     {
      "tier": 3,
      "name": "Druid vichřice",
      "cost": 920,
      "km": 0,
      "fx": {
       "secondary_tornado_interval_s": 2.8,
       "tornado_pierce": 18,
       "tornado_knockback_px": 95,
       "strip_camo_on_hit": true
      },
      "desc": "Každé 2,8 s sešle po cestě větrné tornádo (průraz 18), které odfoukne běžné slizáky o 95 px zpět k jeskyni a strhne z nich průhlednost.",
      "visual": "Druid v bílomodrém rouchu obklopený malým vzdušným vírem a poletujícím listím."
     },
     {
      "tier": 4,
      "name": "Posel bouře",
      "cost": 3100,
      "km": 2,
      "fx": {
       "secondary_ball_lightning_interval_s": 4.2,
       "ball_lightning_dps": 8,
       "ball_lightning_radius_px": 65,
       "ball_lightning_freeze_chance": 0.25,
       "tornado_pierce_add": 22
      },
      "desc": "Tornádo zasáhne o +22 slizáků více (celkem 40). Každých 4,2 s vypustí pomalou kouli blesků (8 DPS v okruhu 65 px, 25% šance na zmrazení).",
      "visual": "Druid se vznáší nad kamenným kruhem, má bíle zářící oči a nad hlavou mu pluje bouřkový mrak."
     },
     {
      "tier": 5,
      "name": "Hněv nebeské bouře",
      "cost": 18500,
      "km": 5,
      "fx": {
       "tornado_affects_moab": true,
       "tornado_moab_knockback_px": 55,
       "ball_lightning_dps_add": 24,
       "zap_damage_add": 8,
       "zap_bounce_targets_add": 12
      },
      "desc": "Obří super-tornádo dokáže zatlačit zpět i slizové krále (o 55 px). Kulové blesky dávají 32 DPS a přímý blesk skáče na 20 cílů po 10 poškození.",
      "visual": "Majestátní bůh bouře ve zlatobílém plášti uprostřed zuřícího hurikánu plného zlatých blesků."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Trnitý houštin",
      "cost": 210,
      "km": 0,
      "fx": {
       "projectiles_add": 3,
       "spread_deg": 38
      },
      "desc": "Druid vystřeluje o +3 trny v každé salvě více (celkem 8 trnů v širším kuželu 38°).",
      "visual": "Kolem kamenného podstavce vyrůstají husté zelené kapradiny a šlahouny."
     },
     {
      "tier": 2,
      "name": "Dubové srdce",
      "cost": 310,
      "km": 0,
      "fx": {
       "strip_regrow": true,
       "bonus_regrow_damage": 2
      },
      "desc": "Všechny útoky druida trvale zbavují slizáky vlastnosti dorůstání (dorustajici) a udělují jim +2 poškození.",
      "visual": "Na hrudi druida svítí zelený smaragd ve tvaru dubového listu a trny mají zlatavé špičky."
     },
     {
      "tier": 3,
      "name": "Šlahouny pralesa",
      "cost": 1050,
      "km": 0,
      "fx": {
       "global_vine_grab_interval_s": 2.4,
       "vine_grab_damage_per_s": 8,
       "vine_after_pop_patch_duration_s": 4,
       "vine_patch_slow_pct": 35,
       "vine_patch_dps": 2
      },
      "desc": "Každé 2,4 s šlahoun kdekoli na mapě popadne nejsilnějšího běžného slizáka, drží ho na místě (8 DPS) a zanechá trnitý keř (4 s, zpomalení 35 %, 2 DPS).",
      "visual": "Podstavec je obtočen silnými živými kořeny s červenými květy, které se samy hýbou."
     },
     {
      "tier": 4,
      "name": "Dar úrody",
      "cost": 2900,
      "km": 2,
      "fx": {
       "range_add_px": 25,
       "ability": {
        "name": "Dar úrody",
        "kind": "jungle_bounty",
        "cooldown_s": 40,
        "effect": "Dosah +25 px a +2 životy brány za vlnu. Schopnost (cooldown 40 s): dá 320 zl + 130 zl za každý Zlatý důl v dosahu druida."
       },
       "ability_cooldown_s": 40,
       "ability_base_cash": 320,
       "ability_cash_per_farm_in_range": 130,
       "lives_generated_per_wave": 2
      },
      "desc": "Dosah +25 px a +2 životy brány za vlnu. Schopnost (cooldown 40 s): dá 320 zl + 130 zl za každý Zlatý důl v dosahu druida.",
      "visual": "Druid má korunu ze zlatého obilí a květů, kolem něj kvetou zlaté jabloně."
     },
     {
      "tier": 5,
      "name": "Duch prastarého hvozdu",
      "cost": 19500,
      "km": 5,
      "fx": {
       "full_track_thorns_dps": 12,
       "full_track_thorns_bonus_moab_dps": 18,
       "full_track_thorns_slow_pct": 25,
       "base_income_per_wave": 1000,
       "lives_generated_per_wave": 10
      },
      "desc": "Celá cesta po celé mapě trvale zaroste prastarými trny (12 DPS všem slizákům, +18 DPS bossům, zpomalení 25 %). Na konci každé vlny přidá 1000 zl a 10 životů.",
      "visual": "Obří živoucí stromový titán (Ent) se zářící smaragdovou korunou, zlatými runami v kůře a kvetoucím oltářem."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Zálesákův dosah",
      "cost": 130,
      "km": 0,
      "fx": {
       "range_add_px": 30,
       "attack_interval_mult": 0.9
      },
      "desc": "Zvyšuje dosah druida o +30 px (na 145 px) a zrychluje útok o 10 % (interval ×0,9).",
      "visual": "Druid stojí na vyvýšeném pařezu a má delší vyřezávanou hůl."
     },
     {
      "tier": 2,
      "name": "Srdce pomsty",
      "cost": 270,
      "km": 0,
      "fx": {
       "speed_boost_per_leak_pct": 5,
       "max_leak_speed_boost_pct": 80,
       "base_attack_speed_bonus_pct": 10
      },
      "desc": "Zvyšuje rychlost útoku o +10 % a za každý ztracený život brány v bitvě získá dalších +5 % rychlosti útoku (až do maxima +80 %).",
      "visual": "Plášť druida má krvavě rudé lemování a kolem hole pulzuje červená aura."
     },
     {
      "tier": 3,
      "name": "Medvědí zuřivost",
      "cost": 880,
      "km": 0,
      "fx": {
       "consecutive_hit_speed_stack_pct": 5,
       "max_consecutive_speed_bonus_pct": 75,
       "damage_add": 1
      },
      "desc": "Zvyšuje poškození trnů o +1. Každý výstřel na stejný cíl zvyšuje rychlost střelby o +5 % (až +75 % při nepřetržité palbě do zástupu či bosse).",
      "visual": "Druid má přes hlavu přehozenou hnědou medvědí kožešinu s tesáky a drápy na rukavicích."
     },
     {
      "tier": 4,
      "name": "Volání smečky",
      "cost": 2650,
      "km": 2,
      "fx": {
       "aura_other_druids_attack_speed_pct": 12,
       "max_pack_stacks": 5,
       "damage_add": 1,
       "pierce_add": 2
      },
      "desc": "Poškození +1, průraz +2. Každý další Lesní druid v dosahu zvyšuje rychlost útoku tohoto druida (a on jim) o +12 % (max. 5 druidů = +60 %).",
      "visual": "Kožešina je černo-stříbrná (vlčí vůdce), u nohou druida sedí duchovní vlk a podstavec zdobí totem."
     },
     {
      "tier": 5,
      "name": "Vtělení prastaré šelmy",
      "cost": 16800,
      "km": 5,
      "fx": {
       "damage_add": 5,
       "attack_interval_mult": 0.45,
       "bonus_damage_per_100_enemy_max_hp": 3,
       "max_hp_scaling_damage_bonus": 35
      },
      "desc": "Poškození +5, rychlost více než dvojnásobná (interval ×0,45). Čím víc má cíl maximálních životů, tím víc trny berou (+3 poškození za každých 100 max HP cíle, až +35 do bossů).",
      "visual": "Obří černo-rudý prastarý medvědodlak ve zlaté runové zbroji, kolem kterého šlehá rudá energie zuřivosti."
     }
    ]
   ]
  },
  {
   "id": "stinovy_zved",
   "name": "Stínový zvěd",
   "cat": "magic",
   "desc": "Hbitý královský špeh v temném plášti, který od základu vidí průhledné Duchslizy a vrhá ostré ocelové hvězdice.",
   "col": "#334155",
   "ico": "🥷",
   "short": "Zvěd",
   "base": {
    "cost": 310,
    "range_px": 125,
    "damage": 1,
    "attack_interval_s": 0.62,
    "pierce": 2,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": true,
    "placement": "land",
    "radius_px": 18
   },
   "attack": {
    "pattern": "direct_throw",
    "spread_deg": 12,
    "projectile_speed_px_s": 580
   },
   "projectile_look": "Rotující čtyřcípá ocelová hvězdice (šuriken) s modrostříbrným odleskem a kruhovým otvorem uprostřed.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Stínová disciplína",
      "cost": 170,
      "km": 0,
      "fx": {
       "range_add_px": 20,
       "attack_interval_mult": 0.82
      },
      "desc": "Zvyšuje dosah o +20 px (na 145 px) a zrychluje vrhání hvězdic (interval útoku ×0,82).",
      "visual": "Zvěd má tmavě modrou kuklu a kolem předloktí ovázané černé hedvábné pásky."
     },
     {
      "tier": 2,
      "name": "Břitké hrany",
      "cost": 260,
      "km": 0,
      "fx": {
       "pierce_add": 2,
       "camo_damage_bonus": 1
      },
      "desc": "Hvězdice proletí o +2 slizáky navíc (celkem 4) a udělují +1 bonusové poškození průhledným Duchslizům.",
      "visual": "Hvězdice v ruce zvěda mají červeně lakované středy a na opasku má pouzdra s náhradními čankami."
     },
     {
      "tier": 3,
      "name": "Dvojitý hod",
      "cost": 720,
      "km": 0,
      "fx": {
       "projectiles_set": 2,
       "spread_deg": 10
      },
      "desc": "Zvěd vrhá oběma rukama 2 hvězdice současně.",
      "visual": "Zvěd stojí v bojovém postoji s hvězdicemi v obou rukou a má přes rameno stříbrný nárameník."
     },
     {
      "tier": 4,
      "name": "Mistr pěti čepelí",
      "cost": 2550,
      "km": 2,
      "fx": {
       "projectiles_set": 5,
       "damage_add": 1,
       "spread_deg": 24,
       "damage_type_set": "normal"
      },
      "desc": "Vrhá vějíř 5 hvězdic najednou, zvyšuje poškození každé o +1 (celkem 2) a hvězdice prorazí i železné helmy.",
      "visual": "Mistr zvědů v bílo-modrém šatu se zlatou maskou a pěti zářícími hvězdicemi připravenými mezi prsty."
     },
     {
      "tier": 5,
      "name": "Velmistr stínů",
      "cost": 16200,
      "km": 5,
      "fx": {
       "projectiles_set": 8,
       "damage_add": 3,
       "attack_interval_mult": 0.55,
       "shadow_clone_homing_dagger_damage": 6
      },
      "desc": "Vrhá 8 hvězdic (poškození 5 každá) obrovskou rychlostí (interval ×0,55) a každý hod navíc vyšle naváděnou stínovou dýku (6 poškození).",
      "visual": "Postava v černo-zlaté zbroji obklopená dvěma poloprůhlednými stínovými klony, které hází zlaté hvězdice spolu s ní."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Omamný prach",
      "cost": 160,
      "km": 0,
      "fx": {
       "knockback_chance": 0.25,
       "knockback_px": 28,
       "slow_after_hit_pct": 15,
       "slow_duration_s": 1.5
      },
      "desc": "Každý zásah zpomalí slizáka o 15 % na 1,5 s a má 25% šanci ho zmást a poslat o 28 px zpět po cestě.",
      "visual": "U pasu zvěda visí fialové váčky s uspávacím pylem."
     },
     {
      "tier": 2,
      "name": "Kouřová clona",
      "cost": 290,
      "km": 0,
      "fx": {
       "strip_camo_on_hit": true,
       "decamo_radius_px": 35
      },
      "desc": "Zásah hvězdicí uvolní v okruhu 35 px obláček prachu, který trvale zviditelní všechny průhledné slizáky (včetně Stínoslizu).",
      "visual": "Zvěd má přes ústa šedou dýmovou masku a kolem nohou se mu převaluje jemný opar."
     },
     {
      "tier": 3,
      "name": "Škola stínů",
      "cost": 820,
      "km": 0,
      "fx": {
       "aura_other_ninjas_attack_speed_pct": 8,
       "aura_other_ninjas_range_pct": 5,
       "max_shinobi_stacks": 10
      },
      "desc": "Zvyšuje rychlost útoku o +8 % a dosah o +5 % všem Stínovým zvědům ve svém dosahu (sčítá se až 10×).",
      "visual": "Za zády zvěda stojí dřevěný stojan s katanou a černým praporem cechu špehů."
     },
     {
      "tier": 4,
      "name": "Velká sabotáž",
      "cost": 2900,
      "km": 2,
      "fx": {
       "ability": {
        "name": "Velká sabotáž",
        "kind": "sabotage_supply_lines",
        "cooldown_s": 45,
        "effect": "Aktivní schopnost (cooldown 45 s): na 15 sekund zpomalí všechny slizáky i slizové krále na mapě (i nově příchozí) o 50 %."
       },
       "ability_cooldown_s": 45,
       "ability_duration_s": 15,
       "ability_global_slow_pct": 50
      },
      "desc": "Aktivní schopnost (cooldown 45 s): na 15 sekund zpomalí všechny slizáky i slizové krále na mapě (i nově příchozí) o 50 %.",
      "visual": "Zvěd v temně rudé zbroji s dvojicí kouřových bomb v rukou a svitkem tajných rozkazů na zádech."
     },
     {
      "tier": 5,
      "name": "Pán noční sabotáže",
      "cost": 17000,
      "km": 5,
      "fx": {
       "ability_duration_s": 22,
       "ability_spawn_moab_hp_reduction_pct": 25,
       "aura_other_ninjas_damage_add": 2,
       "aura_other_ninjas_bonus_boss_damage_add": 5
      },
      "desc": "Sabotáž trvá 22 s a všichni slizoví králové, kteří se během ní objeví, přijdou o 25 % max. životů. Aura navíc dává všem zvědům v dosahu +2 poškození (+5 do bossů).",
      "visual": "Temný velitel na pagodovém podstavci obklopený fialovou mlhou a čtyřmi vznášejícími se nočními lucernami."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Naváděný hod",
      "cost": 150,
      "km": 0,
      "fx": {
       "homing_projectiles": true,
       "projectile_speed_mult": 1.2
      },
      "desc": "Hvězdice jsou o 20 % rychlejší a za letu se samy stáčí za pohybujícími se slizáky.",
      "visual": "Hvězdice mají zakřivené větrné čepele se zelenou runou uprostřed."
     },
     {
      "tier": 2,
      "name": "Železné ježky",
      "cost": 230,
      "km": 0,
      "fx": {
       "secondary_caltrops_interval_s": 2.6,
       "caltrops_damage": 1,
       "caltrops_pierce": 4
      },
      "desc": "Každé 2,6 s navíc hodí na nejbližší cestu železného ježka (1 poškození, výdrž 4 zásahy).",
      "visual": "Vedle zvěda leží kožený váček s vysypanými kovovými ostny."
     },
     {
      "tier": 3,
      "name": "Oslepující bomba",
      "cost": 960,
      "km": 0,
      "fx": {
       "every_nth_shot_flash_bomb": 4,
       "flash_bomb_damage": 4,
       "flash_bomb_radius_px": 60,
       "flash_bomb_stun_duration_s": 1.3,
       "flash_bomb_damage_type": "normal"
      },
      "desc": "Každý 4. útok hodí místo hvězdice oslepující bombu, která v okruhu 60 px udělí 4 pravá poškození a na 1,3 s omráčí slizáky.",
      "visual": "Zvěd drží v levé ruce kulatou černou pumu s jiskřícím doutnákem a přes oči má ochranné stínítko."
     },
     {
      "tier": 4,
      "name": "Přísavné nálože",
      "cost": 3200,
      "km": 2,
      "fx": {
       "secondary_sticky_bomb_interval_s": 3.8,
       "sticky_bomb_fuse_s": 2,
       "sticky_bomb_boss_damage": 160,
       "sticky_bomb_splash_damage": 35,
       "sticky_bomb_splash_radius_px": 55
      },
      "desc": "Každé 3,8 s hodí na nejsilnějšího slizového krále v dosahu přísavnou nálož, která po 2 s vybuchne za 160 poškození (a 35 poškození v okruhu 55 px).",
      "visual": "Zvěd má na zádech dřevěnou bednu s runovými patronami obalenými lepkavou pryskyřicí."
     },
     {
      "tier": 5,
      "name": "Mistr demolice",
      "cost": 18200,
      "km": 5,
      "fx": {
       "sticky_bomb_global_range": true,
       "sticky_bomb_boss_damage_set": 650,
       "sticky_bomb_splash_damage_set": 150,
       "can_stun_moab": true,
       "stun_moab_duration_s": 1
      },
      "desc": "Hází přísavné nálože na slizové krále po celé mapě! Každá nálož udělí 650 poškození hlavnímu cíli (150 okolo) a oslepující bomby omráčí i bosse na 1 s.",
      "visual": "Elitní sabotér v černo-purpurovém plášti s obří zlatou runovou bombou na zádech a planoucíma očima."
     }
    ]
   ]
  },
  {
   "id": "gryfi_jezdec",
   "name": "Gryfí jezdec",
   "cat": "military",
   "desc": "Královský rytíř na okřídleném gryfovi. Jeho hnízdo zabírá místo na zemi, ale samotný gryf krouží vysoko nad mapou, ignoruje překážky a pálí salvy šipek.",
   "col": "#b45309",
   "ico": "🪶",
   "short": "Gryf",
   "base": {
    "cost": 460,
    "range_px": 9999,
    "damage": 1,
    "attack_interval_s": 1.15,
    "pierce": 3,
    "projectiles": 8,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 24
   },
   "attack": {
    "pattern": "orbit_radial_burst",
    "orbit_radius_px": 95,
    "flight_speed_px_s": 135,
    "ignores_obstacles": true,
    "projectile_speed_px_s": 500
   },
   "projectile_look": "Opeřená ocelová šipka se zlatými letkami vystřelená ze vzduchu.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Rychlá křídla",
      "cost": 180,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.78,
       "flight_speed_mult": 1.2
      },
      "desc": "Gryf létá o 20 % rychleji a jezdec vypouští salvy šipek častěji (interval útoku ×0,78).",
      "visual": "Gryf má delší bílé letky na křídlech a jezdec má modrý plášť."
     },
     {
      "tier": 2,
      "name": "Hustá salva",
      "cost": 290,
      "km": 0,
      "fx": {
       "projectiles_add": 4,
       "pierce_add": 1
      },
      "desc": "V každé kruhové salvě vystřelí o +4 šipky více (celkem 12 šipek) a zvyšuje průraz každé o +1 (na 4).",
      "visual": "Po obou stranách sedla gryfa přibudou dva velké bubnové toulce na šipky."
     },
     {
      "tier": 3,
      "name": "Lovec monster",
      "cost": 1100,
      "km": 0,
      "fx": {
       "secondary_moab_missile_interval_s": 2.4,
       "moab_missile_count": 2,
       "moab_missile_damage": 16,
       "moab_missile_pierce": 3,
       "moab_missile_damage_type": "explosion"
      },
      "desc": "Každé 2,4 s vypálí jezdec 2 naváděné dračí rakety přímo na slizové krále kdekoli na mapě (16 výbušného poškození každá).",
      "visual": "Gryf má ocelovou přilbici a pod křídly připevněné mosazné odpalovače raket."
     },
     {
      "tier": 4,
      "name": "Nebeská eskadra",
      "cost": 3600,
      "km": 2,
      "fx": {
       "attack_interval_mult": 0.55,
       "projectiles_add": 4,
       "moab_missile_count_set": 4,
       "moab_missile_damage_add": 10
      },
      "desc": "Střílí téměř dvojnásobnou rychlostí (interval ×0,55), 16 šipek v salvě a 4 naváděné rakety po 26 poškození do slizových králů.",
      "visual": "Zlatomodrá královská zbroj na gryfovi i jezdci, za křídly zůstává světle modrá vzdušná stopa."
     },
     {
      "tier": 5,
      "name": "Pán nebeské pevnosti",
      "cost": 20500,
      "km": 5,
      "fx": {
       "projectiles_set": 24,
       "damage_add": 4,
       "pierce_add": 6,
       "damage_type_set": "normal",
       "moab_missile_interval_s": 1,
       "moab_missile_damage_set": 55
      },
      "desc": "Vypouští kruhy 24 průrazných šipek (poškození 5, průraz 10, typ normal) a každou 1,0 s pálí 4 rakety po 55 poškození do bossů.",
      "visual": "Kolosální nebeský arcigryf ve zlaté plátové zbroji se čtyřmi křídly a zářící svatozáří."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Zápalné pumy",
      "cost": 190,
      "km": 0,
      "fx": {
       "drop_bomb_on_track_interval_s": 1.6,
       "track_bomb_damage": 3,
       "track_bomb_radius_px": 45,
       "track_bomb_pierce": 15,
       "track_bomb_damage_type": "explosion"
      },
      "desc": "Kdykoli gryf přelétá nad cestou (max. každé 1,6 s), shodí dolů zápalnou pumu (3 poškození v okruhu 45 px, průraz 15).",
      "visual": "Pod břichem gryfa visí kožený koš plný kulatých černých pum."
     },
     {
      "tier": 2,
      "name": "Bystrý zrak gryfa",
      "cost": 260,
      "km": 0,
      "fx": {
       "can_see_camo": true,
       "camo_damage_bonus": 1
      },
      "desc": "Gryf vidí průhledné Duchslizy a všechny jeho útoky (šipky i pumy) jim udělují +1 poškození.",
      "visual": "Oči gryfa jasně zlatě svítí a jezdec má na přilbě krystalové hledí."
     },
     {
      "tier": 3,
      "name": "Kobercový nálet",
      "cost": 980,
      "km": 0,
      "fx": {
       "track_bomb_cluster_count": 4,
       "track_bomb_damage_add": 4,
       "track_bomb_radius_add_px": 15
      },
      "desc": "Místo jedné pumy shazuje řadu 4 pum za sebou, každá udělí o +4 poškození více (celkem 7) v okruhu 60 px.",
      "visual": "Hnízdo na zemi má muniční jeřáb a gryf nese těžký dřevěno-ocelový bombardovací závěs."
     },
     {
      "tier": 4,
      "name": "Soudný den z nebes",
      "cost": 3400,
      "km": 2,
      "fx": {
       "track_bomb_damage_add": 8,
       "ability": {
        "name": "Soudný den z nebes",
        "kind": "ground_zero_strike",
        "cooldown_s": 40,
        "effect": "Pumy dávají 15 poškození. Aktivní schopnost (cooldown 40 s): shodí obří sud střelného prachu, který dá 220 poškození všem na mapě a na 2 s je omráčí."
       },
       "ability_cooldown_s": 40,
       "ability_global_damage": 220,
       "ability_stun_duration_s": 2
      },
      "desc": "Pumy dávají 15 poškození. Aktivní schopnost (cooldown 40 s): shodí obří sud střelného prachu, který dá 220 poškození všem na mapě a na 2 s je omráčí.",
      "visual": "Černo-červeně opancéřovaný válečný gryf nesoucí v pařátech obří zlatě okovaný sud."
     },
     {
      "tier": 5,
      "name": "Posel apokalypsy",
      "cost": 19800,
      "km": 5,
      "fx": {
       "track_bomb_damage_set": 40,
       "ability_global_damage_set": 850,
       "ability_cooldown_s": 30,
       "ability_stun_moab_duration_s": 3.5
      },
      "desc": "Kobercové pumy dávají 40 poškození každá. Schopnost (cooldown 30 s) udělí 850 poškození všem nepřátelům na mapě a na 3,5 s omráčí i slizové krále.",
      "visual": "Ohnivý fénix-gryf v dračím pancíři, kolem jehož hnízda stojí čtyři obří runové pumy."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Ostré pařáty",
      "cost": 150,
      "km": 0,
      "fx": {
       "pierce_add": 3,
       "projectile_speed_mult": 1.25
      },
      "desc": "Šipky mají o +3 vyšší průraz (celkem 6) a letí o 25 % rychleji.",
      "visual": "Pařáty gryfa jsou okované ocelovými drápy a šipky mají stříbrné hroty."
     },
     {
      "tier": 2,
      "name": "Cvičený let",
      "cost": 280,
      "km": 0,
      "fx": {
       "flight_modes_unlocked": [
        "circle",
        "figure_eight",
        "patrol_point",
        "follow_cursor"
       ]
      },
      "desc": "Umožňuje přepínat letový režim: Kroužení, Osmička, Hlídka kolem bodu zvoleného hráčem nebo Sledování kurzoru/dotyku.",
      "visual": "Na hnízdě přibude barevný praporek a jezdec drží zdobené zlaté otěže."
     },
     {
      "tier": 3,
      "name": "Naváděné šipky",
      "cost": 1050,
      "km": 0,
      "fx": {
       "attack_mode_set": "targeted_homing_stream",
       "projectiles_set": 3,
       "attack_interval_mult": 0.45,
       "homing_projectiles": true
      },
      "desc": "Místo střílení naslepo do kruhu jezdec míří přímo na slizáky a pálí naváděné trojité salvy více než dvojnásobnou rychlostí.",
      "visual": "Jezdec třímá opakovací trpasličí arbalest na otočném kloubu v sedle."
     },
     {
      "tier": 4,
      "name": "Přízrak oblohy",
      "cost": 3500,
      "km": 2,
      "fx": {
       "secondary_explosive_shell_every_n_shots": 2,
       "shell_damage": 12,
       "shell_radius_px": 45,
       "damage_add": 2,
       "damage_type_set": "normal"
      },
      "desc": "Šipky dávají +2 poškození (typ normal) a každý 2. výstřel doprovází výbušná střela (12 poškození v okruhu 45 px).",
      "visual": "Velký šedozlatý gryf s dvojhlavňovým mechanickým dělem na hřbetě."
     },
     {
      "tier": 5,
      "name": "Létající citadela",
      "cost": 21000,
      "km": 5,
      "fx": {
       "independent_turrets_count": 3,
       "attack_interval_mult": 0.35,
       "damage_add": 6,
       "bonus_boss_damage": 10,
       "shell_damage_set": 38
      },
      "desc": "Tři nezávislé střelecké věžičky v sedle pálí nepřetržitý proud naváděných šipek (poškození 9, +10 do bossů) a výbušných granátů (38 poškození) po celé mapě.",
      "visual": "Gigantický královský gryf nesoucí na zádech pancéřovanou věž se třemi zlatými kanóny a vlajícími prapory."
     }
    ]
   ]
  },
  {
   "id": "oblehaci_mozdir",
   "name": "Obléhací moždíř",
   "cat": "military",
   "desc": "Těžké dělostřelectvo s neomezeným dostřelem, které obloukem přes všechny překážky ostřeluje přesné místo na mapě zvolené hráčem.",
   "col": "#57534e",
   "ico": "🎯",
   "short": "Moždíř",
   "base": {
    "cost": 480,
    "range_px": 9999,
    "damage": 2,
    "attack_interval_s": 2,
    "pierce": 25,
    "projectiles": 1,
    "damage_type": "explosion",
    "can_see_camo": true,
    "placement": "land",
    "radius_px": 24
   },
   "attack": {
    "pattern": "target_ground_point",
    "explosion_radius_px": 52,
    "shell_flight_time_s": 0.55,
    "ignores_obstacles": true,
    "scatter_radius_px": 14
   },
   "projectile_look": "Velká černá litinová puma s kouřovou stopou letící vysokým obloukem a terčem na zemi.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Větší ráže",
      "cost": 190,
      "km": 0,
      "fx": {
       "explosion_radius_add_px": 15,
       "pierce_add": 15
      },
      "desc": "Poloměr výbuchu se zvětšuje o +15 px (na 67 px) a výbuch zasáhne o +15 slizáků více (celkem 40).",
      "visual": "Hlaveň moždíře má širší bronzové hrdlo a vedle leží větší dělové koule."
     },
     {
      "tier": 2,
      "name": "Drtivý dopad",
      "cost": 310,
      "km": 0,
      "fx": {
       "damage_add": 2
      },
      "desc": "Těžší nálož zvyšuje poškození výbuchu o +2 (celkem 4 poškození každému zasaženému slizákovi).",
      "visual": "Podstavec moždíře je zpevněn železnými skobami zaraženými do země."
     },
     {
      "tier": 3,
      "name": "Otřesná vlna",
      "cost": 920,
      "km": 0,
      "fx": {
       "stun_duration_s": 1.1,
       "shockwave_outer_radius_px": 95,
       "shockwave_damage": 1,
       "bonus_ceramic_damage": 3
      },
      "desc": "Výbuch na 1,1 s omráčí zasažené slizáky, dá +3 poškození do Zlatých slizů a vyšle tlakovou vlnu do 95 px (1 poškození).",
      "visual": "Masivní ocelový moždíř s odpruženými písty po stranách a lebkou na hlavni."
     },
     {
      "tier": 4,
      "name": "Drsňák",
      "cost": 3200,
      "km": 2,
      "fx": {
       "damage_add": 7,
       "explosion_radius_add_px": 25,
       "pierce_add": 35,
       "bonus_boss_damage": 10,
       "can_stun_moab": true,
       "stun_moab_duration_s": 0.6
      },
      "desc": "Obří granát udělí o +7 poškození více (celkem 11, +10 do bossů) v okruhu 92 px a na 0,6 s otřese i slizovými králi.",
      "visual": "Černo-žlutě pruhovaná pevnostní baterie s obřím kovovým hmoždířem a navijákem na granáty."
     },
     {
      "tier": 5,
      "name": "Kladivo nebes",
      "cost": 18500,
      "km": 5,
      "fx": {
       "damage_add": 24,
       "explosion_radius_add_px": 45,
       "pierce_add": 80,
       "bonus_boss_damage": 35,
       "stun_duration_s": 2.2,
       "stun_moab_duration_s": 1.4
      },
      "desc": "Kataklyzmatické výbuchy (poškození 35, do bossů 80) v obřím okruhu 137 px omráčí běžné slizáky na 2,2 s a slizové krále na 1,4 s.",
      "visual": "Kolosální černo-zlatý obléhací kolos se žhnoucími runami v hlavni, při jehož výstřelu praská země."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Rychlé nabíjení",
      "cost": 170,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.75
      },
      "desc": "Obsluha nabíjí moždíř o čtvrtinu rychleji (interval útoku ×0,75).",
      "visual": "Vedle hlavně přibude dřevěný skluz na koule a nabiják na tyči."
     },
     {
      "tier": 2,
      "name": "Těžké granáty",
      "cost": 320,
      "km": 0,
      "fx": {
       "damage_type_set": "normal",
       "bonus_moab_damage": 3,
       "bonus_fortified_damage": 2
      },
      "desc": "Granáty zraní i Černé slizy (typ normal) a udělují +3 poškození slizovým králům a +2 kamenným slizákům.",
      "visual": "Dělové koule mají ostré špičaté hlavice a mosazné vodicí kroužky."
     },
     {
      "tier": 3,
      "name": "Dvojhlavňový moždíř",
      "cost": 1050,
      "km": 0,
      "fx": {
       "attack_interval_mult": 0.55,
       "scatter_radius_px": 8
      },
      "desc": "Dvě hlavně pálí střídavě, čímž zkracují interval útoku na téměř polovinu (×0,55) a zpřesňují dopad.",
      "visual": "Dvě spojené ocelové hlavně vedle sebe na otočném ozubeném věnci."
     },
     {
      "tier": 4,
      "name": "Dělostřelecká baterie",
      "cost": 3400,
      "km": 2,
      "fx": {
       "attack_interval_mult": 0.5,
       "bonus_stunned_damage": 6,
       "ability": {
        "name": "Dělostřelecká palba",
        "kind": "artillery_barrage",
        "cooldown_s": 35,
        "effect": "Dvojnásobná kadence a +6 poškození do omráčených cílů. Schopnost (cooldown 35 s): na 8 s ztrojnásobí rychlost střelby."
       },
       "ability_cooldown_s": 35,
       "ability_duration_s": 8,
       "ability_fire_rate_mult": 3
      },
      "desc": "Dvojnásobná kadence a +6 poškození do omráčených cílů. Schopnost (cooldown 35 s): na 8 s ztrojnásobí rychlost střelby.",
      "visual": "Věž se třemi hlavněmi v trojúhelníkové formaci a automatickým pásovým podavačem munice."
     },
     {
      "tier": 5,
      "name": "Pán hromové palby",
      "cost": 19200,
      "km": 5,
      "fx": {
       "damage_add": 6,
       "bonus_moab_damage": 15,
       "ability_global_bombardment_waves": 10,
       "ability_wave_damage": 60,
       "ability_wave_stun_s": 1
      },
      "desc": "Nepřetržitý déšť granátů (+6 poškození, +15 do bossů). Schopnost navíc spustí 10 celomapových salv (60 poškození a 1 s omráčení každá).",
      "visual": "Zlatem a platinou kovaná čtyřhlavňová pevnost s parními písty a modrými blesky kolem ústí."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Přesná muška",
      "cost": 140,
      "km": 0,
      "fx": {
       "scatter_radius_px": 0,
       "allow_auto_follow_target": true
      },
      "desc": "Granáty dopadají s milimetrovou přesností a hráč může zapnout režim automatického sledování prvního/nejsilnějšího slizáka.",
      "visual": "Na boku moždíře je připevněn mosazný kvadrant a olovnice."
     },
     {
      "tier": 2,
      "name": "Řecký oheň",
      "cost": 270,
      "km": 0,
      "fx": {
       "burn_dps": 3,
       "burn_duration_s": 3.5
      },
      "desc": "Zasažení slizáci začnou hořet na 3,5 s za 3 poškození za sekundu.",
      "visual": "Hrdlo moždíře je zbarvené do červena a koule jsou napuštěné hořlavou smůlou."
     },
     {
      "tier": 3,
      "name": "Světlice odhalení",
      "cost": 850,
      "km": 0,
      "fx": {
       "strip_camo_on_hit": true,
       "decamo_radius_px": 85,
       "leave_fire_patch_duration_s": 2.5,
       "fire_patch_dps": 4
      },
      "desc": "Každý výbuch v okruhu 85 px trvale zviditelní všechny průhledné Duchslizy a zanechá na zemi ohnivou louži (2,5 s, 4 DPS).",
      "visual": "Moždíř zdobený zlatým sluncem a bednou s jasně svítícími magickými světlicemi."
     },
     {
      "tier": 4,
      "name": "Rozbíječ pečetí",
      "cost": 3100,
      "km": 2,
      "fx": {
       "strip_fortified_from_non_moab": true,
       "strip_regrow": true,
       "strip_lead": true,
       "burn_dps_add": 8
      },
      "desc": "Výbuch strhne z běžných slizáků železné helmy, kamenný krunýř i dorůstání a zvýší hoření o +8 DPS (celkem 11 DPS).",
      "visual": "Runový moždíř z fialovo-zlatého kovu, jehož ústí plive modrofialové očistné plameny."
     },
     {
      "tier": 5,
      "name": "Popelavý soud",
      "cost": 17800,
      "km": 5,
      "fx": {
       "burn_dps_set": 45,
       "burn_bonus_boss_dps": 75,
       "burn_duration_s": 8,
       "fire_patch_radius_px": 95,
       "fire_patch_dps_set": 25
      },
      "desc": "Promění cílovou oblast v peklo (25 DPS na zemi). Zasažení slizáci hoří za 45 DPS (slizoví králové za 120 DPS!) po dobu 8 sekund.",
      "visual": "Démonická sopečná baterie ve tvaru dračí tlamy chrlící žhnoucí lávové meteory k obloze."
     }
    ]
   ]
  },
  {
   "id": "trpaslici_inzenyr",
   "name": "Trpasličí inženýr",
   "cat": "support",
   "desc": "Vynalézavý trpasličí mistr s hřebíkometem, který kolem sebe staví malé automatické střílny, líčí pasti a přetaktovává okolní věže.",
   "col": "#ca8a04",
   "ico": "🔧",
   "short": "Inženýr",
   "base": {
    "cost": 370,
    "range_px": 130,
    "damage": 1,
    "attack_interval_s": 0.72,
    "pierce": 3,
    "projectiles": 1,
    "damage_type": "sharp",
    "can_see_camo": false,
    "placement": "land",
    "radius_px": 19
   },
   "attack": {
    "pattern": "direct_and_build_sentries",
    "projectile_speed_px_s": 540
   },
   "projectile_look": "Dlouhý kovový hřebík s plochou hlavičkou vystřelený stlačenou párou.",
   "isNew": true,
   "paths": [
    [
     {
      "tier": 1,
      "name": "Automatické střílny",
      "cost": 200,
      "km": 0,
      "fx": {
       "spawn_sentry_interval_s": 9,
       "sentry_duration_s": 25,
       "max_active_sentries": 3,
       "sentry_damage": 1,
       "sentry_attack_interval_s": 0.9,
       "sentry_pierce": 2,
       "sentry_range_px": 115
      },
      "desc": "Inženýr každých 9 s postaví v dosahu malou automatickou střílnu (trvá 25 s, max. 3 současně, útok každých 0,9 s, poškození 1, průraz 2).",
      "visual": "Inženýr má na hlavě žlutou hornickou přilbu, v levé ruce francouzský klíč a u nohou brašnu s nářadím."
     },
     {
      "tier": 2,
      "name": "Rychlá montáž",
      "cost": 260,
      "km": 0,
      "fx": {
       "spawn_sentry_interval_s": 5.5,
       "max_active_sentries": 4
      },
      "desc": "Staví střílny mnohem rychleji (každých 5,5 s) a může mít až 4 aktivní střílny najednou.",
      "visual": "Na zádech inženýra přibude parní kotlík s tlakoměrem a měděnými trubkami."
     },
     {
      "tier": 3,
      "name": "Těžké hřeby",
      "cost": 780,
      "km": 0,
      "fx": {
       "pierce_add": 4,
       "sentry_pierce_add": 2,
       "damage_type_set": "normal",
       "sentry_damage_type_set": "normal",
       "attack_interval_mult": 0.75
      },
      "desc": "Hřebíkomet inženýra i všech střílen prorazí železné helmy (typ normal), mají vyšší průraz (+4 inženýr, +2 střílny) a střílí rychleji.",
      "visual": "Inženýr drží masivní mosazný parní hřebíkomet a střílny mají ocelové štíty."
     },
     {
      "tier": 4,
      "name": "Mistr konstruktér",
      "cost": 2950,
      "km": 2,
      "fx": {
       "sentry_types_set": [
        "crushing_mace",
        "explosion_bomb",
        "laser_beam",
        "frost_pulse"
       ],
       "max_active_sentries": 5,
       "sentry_damage_add": 2
      },
      "desc": "Staví až 5 specializovaných střílen (+2 poškození): Drtící palcát (proti Zlatým), Pumomet (plošný), Ohnivý paprsek (průraz) a Mrazicí věžičku.",
      "visual": "Inženýr v modrozlatém mistrovském plášti s mechanickou rukou a barevnými krystalovými střílnami kolem."
     },
     {
      "tier": 5,
      "name": "Pán parních automatů",
      "cost": 17500,
      "km": 5,
      "fx": {
       "sentry_damage_set": 6,
       "sentry_attack_interval_s": 0.28,
       "sentry_explode_on_expire_damage": 65,
       "sentry_explode_radius_px": 75,
       "max_active_sentries": 6
      },
      "desc": "Udržuje až 6 plazmových střílen, které pálí kulometnou rychlostí (každých 0,28 s za 6 poškození) a při zániku vybuchnou za 65 poškození v okruhu 75 px.",
      "visual": "Vznešený arcikonstruktér na levitující zlaté plošině obklopený fialově zářícími runovými věžičkami."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Delší dosah",
      "cost": 130,
      "km": 0,
      "fx": {
       "range_add_px": 35,
       "sentry_range_add_px": 25
      },
      "desc": "Zvyšuje dosah inženýra o +35 px (na 165 px) a dosah jeho střílen o +25 px.",
      "visual": "Na přilbě inženýra je výsuvná mosazná anténa s čočkou."
     },
     {
      "tier": 2,
      "name": "Demontáž zbroje",
      "cost": 310,
      "km": 0,
      "fx": {
       "bonus_moab_damage": 2,
       "bonus_fortified_damage": 2,
       "strip_lead": true
      },
      "desc": "Útoky inženýra i střílen dávají +2 poškození slizovým králům a kamenným slizákům a trvale strhávají železné helmy.",
      "visual": "Hřebíky mají ozubené závity a u pasu inženýra visí těžké štípací kleště."
     },
     {
      "tier": 3,
      "name": "Čisticí pěna",
      "cost": 820,
      "km": 0,
      "fx": {
       "spawn_foam_on_track_interval_s": 2,
       "foam_duration_s": 8,
       "foam_pierce": 12,
       "foam_strips_camo": true,
       "foam_strips_regrow": true,
       "foam_strips_lead": true,
       "foam_slow_pct": 25
      },
      "desc": "Každé 2,0 s nastříká na cestu bělostnou alchymistickou pěnu (výdrž 12 slizáků), která zpomalí o 25 % a smyje průhlednost, dorůstání i helmu.",
      "visual": "Inženýr drží v druhé ruce mosaznou hadici připojenou k sudu s bublající bílou pěnou."
     },
     {
      "tier": 4,
      "name": "Přetaktování",
      "cost": 3600,
      "km": 2,
      "fx": {
       "foam_pierce_add": 15,
       "ability": {
        "name": "Přetaktování",
        "kind": "overclock_target_tower",
        "cooldown_s": 30,
        "effect": "Pěna vydrží o +15 slizáků více. Schopnost (cooldown 30 s): na 25 s přetaktuje vybranou věž (+65 % rychlost útoku, u Zlatého dolu +65 % zisk)."
       },
       "ability_cooldown_s": 30,
       "ability_duration_s": 25,
       "ability_attack_speed_mult": 1.65,
       "ability_farm_income_mult": 1.65
      },
      "desc": "Pěna vydrží o +15 slizáků více. Schopnost (cooldown 30 s): na 25 s přetaktuje vybranou věž (+65 % rychlost útoku, u Zlatého dolu +65 % zisk).",
      "visual": "Inženýr má na zádech elektrickou cívku sršící modré blesky a v ruce zlatý ovladač."
     },
     {
      "tier": 5,
      "name": "Ultrataktování",
      "cost": 21500,
      "km": 5,
      "fx": {
       "ability_permanent_stack_speed_pct": 6,
       "ability_max_permanent_stacks": 10,
       "global_sentry_and_trap_damage_add": 3
      },
      "desc": "Kromě dočasného +65% zrychlení přidá každé použití schopnosti cílové věži trvalých +6 % rychlosti (až 10× = +60 % navždy!). Všem střílnám a pastem na mapě dává +3 poškození.",
      "visual": "Mistr technomág obklopený třemi rotujícími zlatými elektrickými prstenci a levitujícím jádrem čisté energie."
     }
    ],
    [
     {
      "tier": 1,
      "name": "Velké hřeby",
      "cost": 160,
      "km": 0,
      "fx": {
       "pierce_add": 5,
       "damage_add": 1
      },
      "desc": "Masivní kované hřeby zvyšují průraz o +5 (celkem 8) a poškození o +1 (celkem 2).",
      "visual": "Hřebíkomet má zesílenou ocelovou hlaveň s pásovým zásobníkem velkých hřebů."
     },
     {
      "tier": 2,
      "name": "Přišpendlení",
      "cost": 240,
      "km": 0,
      "fx": {
       "pin_stun_duration_s": 0.85
      },
      "desc": "Zasažení běžní slizáci jsou hřebem přišpendleni k zemi a na 0,85 s se nemohou pohnout.",
      "visual": "Hřeby mají široké zlaté hlavičky se symbolem kotvy."
     },
     {
      "tier": 3,
      "name": "Dvojitý hřebíkomet",
      "cost": 690,
      "km": 0,
      "fx": {
       "projectiles_set": 2,
       "attack_interval_mult": 0.55,
       "spread_deg": 8
      },
      "desc": "Inženýr střílí ze dvou hřebíkometů současně a téměř dvojnásobnou rychlostí (interval ×0,55).",
      "visual": "Trpaslík má v každé ruce jeden těžký hřebíkomet a přes hruď křížový nábojový pás."
     },
     {
      "tier": 4,
      "name": "Klecová past",
      "cost": 2800,
      "km": 2,
      "fx": {
       "deploy_bloon_trap_interval_s": 10,
       "trap_capacity_rbe": 120,
       "trap_cash_bonus_mult": 2
      },
      "desc": "Každých 10 s hodí na cestu mechanickou klec, která pohltí až 120 životů běžných slizáků a po naplnění se promění ve dvojnásobek zlaťáků.",
      "visual": "U nohou inženýra stojí otevřená železno-zlatá mechanická truhla s ozubenými čelistmi."
     },
     {
      "tier": 5,
      "name": "Požírač králů",
      "cost": 18900,
      "km": 5,
      "fx": {
       "deploy_bloon_trap_interval_s": 4.5,
       "trap_capacity_rbe": 1500,
       "trap_can_capture_boss_below_hp_pct": 0.35,
       "trap_cash_bonus_mult": 2.5
      },
      "desc": "Obří runová klec (kapacita 1500 životů, obnova 4,5 s, zisk 2,5× zlata) dokáže okamžitě spolknout i slizového krále pod 35 % životů (pokud má rozbitou pečeť).",
      "visual": "Monumentální zlatá trpasličí slévárna s jeřábem spouštějícím na cestu obří diamantovou klec."
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

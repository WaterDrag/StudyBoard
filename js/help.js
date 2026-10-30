// ═══ help.js — Tutoriál: přehled ovládání a funkcí po sekcích, otevírá se z nastavení (hlavní stránka i telefon)
// Nic neblokuje a sám se neotvírá. Zkratky tu musí odpovídat kódu: když přidáš nebo změníš klávesu, uprav ji i zde.
// Zombie Survival má navíc vlastní podrobný návod přímo ve hře (H), tady je jen přehled.

(function () {
  const k = (...keys) => keys.map(x => `<kbd class="hp-k">${x}</kbd>`).join(' ');
  const rows = list => `<dl class="hp-keys">${list.map(([key, what]) => `<div><dt>${key}</dt><dd>${what}</dd></div>`).join('')}</dl>`;
  const group = (title, list) => `<h4>${title}</h4>${rows(list)}`;
  const item = (title, text) => `<div class="hp-item"><b>${title}</b><p>${text}</p></div>`;

  const SECTIONS = [
    ['start', 'Začínáme', `
      <p class="hp-lead">StudyBoard spojuje poznámky, kartičky a hry. Z poznámek si uděláš kartičky a z kartiček se pak učíš i hraním.</p>
      <ol class="hp-steps">
        <li><b>Vytvoř místnost.</b> Na hlavní stránce v záložce Místnosti. Místnost je společný prostor pro jeden předmět nebo téma.</li>
        <li><b>Napiš poznámku.</b> V místnosti přidej poznámku na nástěnku nebo do seznamu.</li>
        <li><b>Udělej si kartičky.</b> Balíček založíš na hlavní stránce v záložce Flash Cards, v místnosti ti s kartami z poznámek pomůže AI.</li>
        <li><b>Uč se.</b> Procvičuj kartičky, nebo si vyber hru v záložce Hry. Otázky se berou z tvých kartiček.</li>
        <li><b>Pozvi ostatní.</b> V místnosti tlačítko Sdílet, viz sekce Sdílení.</li>
      </ol>
      <p class="hp-note">Hledáš něco konkrétního? Na hlavní stránce i v místnosti stačí ${k('Ctrl', 'K')}.</p>`],

    ['keys', 'Klávesové zkratky', `
      <p class="hp-note">Na Macu používej místo ${k('Ctrl')} klávesu ${k('⌘')}.</p>
      ${group('Všude v aplikaci', [
        [k('F2'), 'Telefon pro rychlý přesun (hlavní stránka, místnost, kartičky, kvíz)'],
        [k('Esc'), 'Zavřít okno nebo zrušit výběr'],
      ])}
      ${group('Hlavní stránka', [[k('Ctrl', 'K'), 'Hledat']])}
      ${group('Místnost', [
        [k('Ctrl', 'K'), 'Rychle přejít na poznámku, tabuli nebo do jiné místnosti'],
        [k('Ctrl', 'S'), 'Uložit otevřenou poznámku, okno zůstane otevřené'],
        [k('Ctrl', 'F'), 'Hledat v otevřené poznámce'],
        [k('Ctrl', 'Z'), 'Vrátit smazání poznámky (když zrovna nepíšeš)'],
        [`${k('Ctrl', 'Y')} nebo ${k('Ctrl', 'Shift', 'Z')}`, 'Znovu smazat'],
      ])}
      ${group('Psaní poznámek', [
        [`${k('Ctrl', 'B')} ${k('Ctrl', 'I')} ${k('Ctrl', 'U')}`, 'Tučné, kurzíva, podtržení'],
        [k('Ctrl', 'K'), 'Vložit odkaz na web'],
        [`${k('Ctrl')} + klik`, 'Otevřít odkaz'],
        [`${k('-')} + mezera`, 'Odrážky'],
        [`${k('1.')} + mezera`, 'Číslovaný seznam'],
        [`${k('[]')} + mezera`, 'Zaškrtávací seznam'],
        [`${k('#')} nebo ${k('##')} + mezera`, 'Nadpis nebo podnadpis'],
        [`${k('&gt;')} + mezera`, 'Citace'],
        [`${k('```')} + mezera`, 'Blok kódu'],
        [k('Tab'), 'Zanořit odrážku'],
      ])}
      ${group('Tabulka v poznámce', [
        ['Pravé tlačítko', 'Nabídka tabulky (na dotykovém displeji podržet prst)'],
        [`${k('Ctrl')} + klik`, 'Vybrat libovolné buňky'],
        [`${k('Shift')} + klik`, 'Vybrat oblast buněk'],
        [k('Tab'), 'Další buňka, v poslední přidá řádek'],
        [k('Ctrl', 'Z'), 'Vrátit i změny tabulky, třeba šířku sloupce'],
      ])}
      ${group('Prezentace', [
        [`${k('→')} ${k('Mezera')} ${k('Enter')}`, 'Další snímek'],
        [`${k('←')} ${k('Backspace')}`, 'Předchozí snímek'],
        [`${k('Home')} ${k('End')}`, 'První a poslední snímek'],
        [k('F'), 'Celá obrazovka'],
      ])}
      ${group('Kartičky', [
        [`${k('Mezera')} ${k('Enter')}`, 'Otočit kartu, po kontrole další karta'],
        [`${k('1')} ${k('2')} ${k('3')}`, 'Nevím, skoro, vím'],
        [k('→'), 'Přeskočit kartu'],
      ])}
      ${group('Kvíz', [
        [`${k('1')} až ${k('9')}`, 'Vybrat odpověď'],
        [k('Enter'), 'Potvrdit, pokračovat'],
      ])}
      ${group('Hry', [
        [`Denní výzva: ${k('1')} až ${k('8')} nebo ${k('A')} až ${k('H')}`, 'Vybrat odpověď'],
        [`Pravda, nebo lež: ${k('→')} ${k('D')} / ${k('←')} ${k('A')}`, 'Pravda / lež'],
        [`Křížovka: ${k('Enter')} ${k('Tab')}`, 'Další slovo'],
        [`Šibenice: písmena a ${k('Enter')}`, 'Hádání a další slovo'],
      ])}
      ${group('Obrana království', [
        [`${k('Mezera')} ${k('Q')}`, 'Otevřít kartu s otázkou'],
        [`${k('1')} až ${k('4')}`, 'Odpověď na otázku'],
        [`${k('1')} až ${k('9')}`, 'Schopnosti (když není otevřená otázka)'],
        [`${k('P')} ${k('F')}`, 'Pauza a rychlost (ne ve hře proti ostatním, v co-opu jen hostitel)'],
        [`${k('Shift')} + položení`, 'Položit víc věží za sebou'],
      ])}
      ${group('Zombie Survival', [
        [`${k('W')} ${k('A')} ${k('S')} ${k('D')} nebo šipky`, 'Pohyb'],
        ['Myš + levé tlačítko', 'Míření a útok'],
        [`${k('Q')} ${k('E')} ${k('R')}`, 'Schopnosti (R je ultimátka)'],
        [`${k('1')} až ${k('5')} a ${k('6')} až ${k('9')}`, 'Stavby a infrastruktura'],
        [k('R'), 'Otočit stavbu při pokládání'],
        [`${k('X')} ${k('V')}`, 'Bourat a opravovat stavby'],
        [`${k('B')} ${k('T')} ${k('C')} ${k('G')}`, 'Obchod, dovednosti, statistiky, zahrada'],
        [`${k('P')} ${k('H')}`, 'Pauza a podrobný návod ve hře'],
      ])}`],

    ['notes', 'Poznámky a místnosti', `
      ${item('Nástěnka a seznam', 'Nahoře v místnosti přepínáš mezi volnou nástěnkou a seznamem se složkami. Pravým tlačítkem na nástěnce otevřeš nabídku.')}
      ${item('Druhy obsahu', 'Kromě poznámek můžeš přidat nadpis, návod s kapitolami a tabuli na kreslení. Poznámky na nástěnce jde propojit provázkem.')}
      ${item('Vzhled poznámky', 'Lišta nad poznámkou má dvě karty jako ve Wordu: na Domů je formátování, na Vložení tabulka, obrázek, odkaz a další. Pozadí poznámky může být podle motivu, bílé nebo černé.')}
      ${item('Tabulky', 'Sloupce a řádky měníš tažením za okraj. Víc buněk vybereš s Ctrl nebo Shift a můžeš jim hromadně změnit formát. Nabídka tabulky je na pravém tlačítku.')}
      ${item('Hledání', 'Tlačítko Hledat v poznámkách prohledá názvy i obsah poznámek. Když zaškrtneš Hledat i v ostatních místnostech, projde všechny tvoje místnosti.')}
      ${item('Prezentace', 'Vybrané poznámky nebo kapitoly návodu pustíš přes celou obrazovku.')}
      ${item('AI', 'Z vybraných poznámek ti AI udělá kartičky nebo tě z nich vyzkouší. V nastavení k tomu potřebuješ bezplatný API klíč Gemini, Groq slouží jako záloha.')}
      ${item('Soubory a export', 'Soubory místnosti se ukládají na Google Disk. Poznámky můžeš vyexportovat a uložit do složky StudyBoard na Disku.')}`],

    ['cards', 'Kartičky', `
      ${item('Balíčky', 'Balíček založíš na hlavní stránce v záložce Flash Cards. Místnost může mít i své vlastní kartičky.')}
      ${item('Způsoby učení', 'Otáčení karet s hodnocením nevím, skoro a vím, psaní odpovědi a doplňovačka z výkladových karet. Po kole můžeš opakovat jen ty, které ti nešly.')}
      ${item('Kvíz', 'Otázky s možnostmi. Špatné odpovědi můžeš ke kartě napsat sám, nebo je nechat navrhnout AI.')}
      ${item('Zahrada', 'Strom roste s každým dnem učení. Den se počítá za 20 odpovědí, 25 minut pomodora nebo Denní výzvu. Když den vynecháš, strom povadne, ale nikdy neuschne.')}`],

    ['games', 'Hry', `
      <p class="hp-note">Otázky ve hrách pocházejí z tvých kartiček. Hry najdeš v záložce Hry nebo v telefonu.</p>
      ${item('Denní výzva', 'Sám. Každý den 10 otázek, hlavně z karet, které ti nejdou. Na otázku máš 20 sekund a rychlost přidává body.')}
      ${item('Spojovačka', 'Sám. Spojuješ pojmy s odpověďmi na čas, série zvedá násobič a chyba stojí 3 sekundy.')}
      ${item('Pravda, nebo lež', 'Sám. Máš 60 sekund a rozhoduješ, jestli je odpověď správná.')}
      ${item('Pexeso', 'Sám i s přáteli. Hledáš pojem a jeho odpověď, kdo najde dvojici, hraje znovu.')}
      ${item('Osmisměrka', 'Sám. V mřížce hledáš odpověď na otázku z kartičky.')}
      ${item('Křížovka', 'Sám. Poskládá se z krátkých pojmů, legendou jsou otázky z kartiček.')}
      ${item('Šibenice', 'Sám i závod s přáteli. Hádáš 10 slov po písmenech, na každé máš 8 chyb. Háčky neřešíš.')}
      ${item('Milionář', 'Sám. 15 otázek, každá těžší, jistoty na 5. a 10. otázce a tři nápovědy.')}
      ${item('Dobyvatel', 'Sám i s přáteli, 2 až 6 hráčů a boti. Zabíráš území a dobýváš sousedy otázkami.')}
      ${item('Obrana království', 'Sám i s přáteli. Tower defense se 40 vlnami. Co-op na jedné mapě nebo souboj 2 až 4 hráčů či 2 na 2. Za správné odpovědi dostáváš zlaťáky a krystaly.')}
      ${item('Zombie Survival', 'Sám nebo až ve 4. Bráníš základnu, staviš a staráš se o zahradu. Mezi vlnami je kvíz a špatné odpovědi posílí další vlnu. Podrobný návod otevřeš ve hře klávesou H.')}`],

    ['share', 'Sdílení', `
      ${item('Rychlá pozvánka', 'V místnosti otevři Sdílet, přepni na Kód a odkaz, nastav odkaz, vytvoř ho a pošli. Pozvaný nepotřebuje účet, může pokračovat jako host.')}
      ${item('Přátelé', 'Přátele přidáš na hlavní stránce v záložce Přátelé. V okně Sdílet je pak pozveš přímo, dočasného člena můžeš pozvat natrvalo.')}
      ${item('Role', 'Vlastník spravuje místnost, editor upravuje a prohlížeč jen čte. Editorem se přes pozvánku může stát jen přítel vlastníka.')}
      ${item('Dočasný přístup', 'Pozvánka může platit jen určitou dobu nebo jen pro jedno použití. Host bez účtu může jen číst a má přístup nejvýš hodinu. Dočasní členové a hosté nemůžou zvát další lidi.')}
      ${item('AI agent', 'Stálí členové si mohou vytvořit přístup pro AI agenta. Agent nikdy nesmí víc než ten, kdo ho vytvořil.')}`],

    ['more', 'Ostatní', `
      ${item('Telefon', 'Ikona vlevo dole nebo F2. Rychle tě přesune do místností, her a kartiček a najdeš v něm i nastavení. Na stránkách her schválně není.')}
      ${item('Pomodoro', 'Minutka na učení v horní liště. Běží dál, i když přecházíš mezi stránkami, a odpracovaný čas se počítá do žebříčku týdne.')}
      ${item('Vzhled a grafika', 'Motivy a grafiku her změníš v nastavení. Hudbu a efekty nastavíš v telefonu.')}
      ${item('Účet', 'V nastavení můžeš k jednomu účtu připojit Google i e-mail s heslem. Host si tam vytvoří trvalý účet a nepřijde o to, co vytvořil.')}`],
  ];

  let wrap = null, back = null;
  const KEY = 'sb_help_sec';
  const saved = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };

  function show(id) {
    const sec = SECTIONS.find(s => s[0] === id) || SECTIONS[0];
    wrap.querySelectorAll('.hp-tab').forEach(b => {
      const on = b.dataset.sec === sec[0];
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const body = wrap.querySelector('.hp-body');
    body.innerHTML = `<h3>${sec[1]}</h3>${sec[2]}`;
    body.scrollTop = 0;
    try { localStorage.setItem(KEY, sec[0]); } catch (_) {}
  }

  function close() {
    if (!wrap || wrap.hidden) return;
    wrap.hidden = true;
    back?.focus?.();
  }

  function build() {
    wrap = document.createElement('div');
    wrap.className = 'hp-wrap';
    wrap.hidden = true;
    wrap.innerHTML = `<div class="hp-box" role="dialog" aria-modal="true" aria-label="Tutoriál">
        <div class="hp-head"><b>Tutoriál</b><button type="button" class="hp-close" aria-label="Zavřít">✕</button></div>
        <div class="hp-main">
          <div class="hp-tabs" role="tablist">${SECTIONS.map(s => `<button type="button" class="hp-tab" role="tab" data-sec="${s[0]}">${s[1]}</button>`).join('')}</div>
          <div class="hp-body" tabindex="0"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.hp-close')) { close(); return; }
      const t = e.target.closest('.hp-tab');
      if (t) show(t.dataset.sec);
    });
    // Zkratky stránky pod oknem nesmí reagovat, Esc zavře jen Tutoriál
    wrap.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  function open(id) {
    if (!wrap) build();
    back = document.activeElement;
    wrap.hidden = false;
    show(id || saved());
    wrap.querySelector('.hp-close').focus();
  }

  window.SBHelp = { open, close };
})();

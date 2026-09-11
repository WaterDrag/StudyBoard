// Selektory, na kterych funkce viditelne stoji. Kdyz nektery z CSS zmizi, nic
// nespadne - prvek se jen vykresli rozbite, takze si toho clovek vsimne az na
// screenshotu od uzivatele. Ve v9.36 se takhle pri mazani sousedniho bloku
// ztratilo .gmap-zones a cipy zon pretekly kartu.
//
// Neni to uplna kontrola CSS (ta by u tolika samostatnych stranek jen hlucela),
// je to seznam mist, kde uz se to jednou stalo.
const fs = require('fs');
const path = require('path');

const REQUIRED = {
  'mapa navodu':       ['.gmap-card', '.gmap-card.main', '.gmap-zones', '.gmap-zone',
                        '.gmap-zone.linked', '.gmap-zone.picking', '.gmap-path', '.gmap-label',
                        '.gmap-path.zone', '.gmap-flash', '.gmap-tools', '.gmap-svg'],
  'klikaci oblasti':   ['.hs-wrap', '.hs-area', '.hs-area.unlinked', '.hs-edit',
                        '.hs-edit.unlinked', '.hs-stage', '.hs-scroll', '.hs-toolbar'],
  'navod v detailu':   ['.guide-bar', '.guide-kids', '.guide-kids-back', '.guide-kid',
                        '.gt-item', '.crumb', '.crumb-no'],
  'velka okna':        ['.modal-editor', '.form-group-grow', '.modal-hotspot', '.modal-detail'],
  'prohlizec obrazku': ['.lb-bar', '.lb-btn', '.lb-val'],
  'zony v editoru':    ['.img-zones', '.img-zone'],
  'nadpis na nastence':['.note.is-heading', '.heading-text'],
};

const css = fs.readdirSync('css').filter(f => f.endsWith('.css'))
  .map(f => fs.readFileSync(path.join('css', f), 'utf8')).join('\n')
  .replace(/[/][*][^]*?[*][/]/g, '');

// Leve strany vsech pravidel, rozsekane na jednotlive selektory.
const heads = css.split('}')
  .map(b => b.split('{')[0])
  .join(',')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean);

const wordish = ch => ch !== undefined && (/[A-Za-z0-9_-]/).test(ch);

// ".gmap-zone" nesmi tise projit dik ".gmap-zones" - za nazvem musi koncit slovo.
const has = sel => heads.some(h => {
  let i = -1;
  while ((i = h.indexOf(sel, i + 1)) !== -1) {
    if (!wordish(h[i + sel.length])) return true;
  }
  return false;
});

// Export si nese vlastni CSS uvnitr sablony — promenna, kterou nikdo
// nedeklaruje, se projevi az v hotovem souboru (cerny prouzek misto pozadi).
var exp = fs.readFileSync(path.join('js', 'room-export.js'), 'utf8');
var si = exp.indexOf('<style>'), sj = exp.indexOf('</style>', si);
var expCss = si >= 0 ? exp.slice(si, sj) : '';
var used = (expCss.match(/var\(--[\w-]+\)/g) || []).map(function (v) { return v.slice(6, -1); });
var decl = (expCss.match(/--[\w-]+\s*:/g) || []).map(function (v) { return v.replace(/[-\s:]+$/, '').slice(2); });
var LOCAL = ['nc', 'd', 'fc'];                 // nastavuji se inline na prvku
var undeclared = used.filter(function (v) { return decl.indexOf(v) === -1 && LOCAL.indexOf(v) === -1; });

let bad = 0, n = 0;
if (undeclared.length) {
  bad += undeclared.length;
  undeclared.forEach(function (v) { console.log('CHYBI v CSS exportu: --' + v); });
}
for (const group of Object.keys(REQUIRED)) {
  for (const sel of REQUIRED[group]) {
    n++;
    if (!has(sel)) { bad++; console.log('CHYBI v CSS: ' + sel + '   (' + group + ')'); }
  }
}
console.log('kontrolovano selektoru: ' + n);
if (bad) { console.log(bad + 'x chybi -> ta cast UI se vykresli rozbite'); process.exit(1); }
console.log('Vsechny nosne selektory jsou v CSS OK');

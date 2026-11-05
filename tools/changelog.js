// Vyrobí js/changelog.js (záložka Novinky v nastavení) z historie gitu.
// Bere commity „Aktualizace YYYY-MM-DD – popis (vX.Y.Z)“ od verze 1.0.0, popis rozdělí na body podle „; “.
// Číslování od 1.0.0: opravy zvednou poslední číslo (1.0.1), nové funkce prostřední (1.1.0).
// Spuštění před commitem nové verze:  node tools/changelog.js "popis nové verze; další bod"
//   → nahoru přidá aktuální APP_VERSION s tímhle popisem (v gitu ještě není).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const ver = (fs.readFileSync(path.join(root, 'js/version.js'), 'utf8').match(/APP_VERSION = '([\d.]+)'/) || [])[1];
const log = execSync('git log --format=%s', { cwd: root, encoding: 'utf8' }).split('\n');
const byVer = new Map();
for (const line of log) {
  const m = line.match(/^Aktualizace (\d{4}-\d{2}-\d{2}) – (.+) \(v([\d.]+)\)\s*$/);
  if (!m) continue;
  const [, d, text, v] = m;
  // Novinky začínají vydáním 1.0.0; starší vývojové verze 10.x a 11.x se nevypisují
  if (+v.split('.')[0] >= 10) continue;
  if (!byVer.has(v)) byVer.set(v, { v, d, t: [] });
  byVer.get(v).t.push(text);
}
// Pořadí podle historie gitu (nejnovější první); čísla verzí se řadit nedají (10.7.2, 10.95 …)
const list = [...byVer.values()];
const next = process.argv[2];
if (next && ver && !byVer.has(ver)) list.unshift({ v: ver, d: new Date().toISOString().slice(0, 10), t: [next] });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const entries = list.map(e => ({ v: e.v, d: e.d, t: e.t.flatMap(x => x.split(/;\s+/)).map(s => cap(s.trim())).filter(Boolean) }));

const out = '// ═══ changelog.js — VYGENEROVANÉ z gitu (node tools/changelog.js), ručně neupravovat\n' +
  '// Záložka Novinky v nastavení; načítá se až při jejím otevření.\n' +
  'window.SB_CHANGELOG = ' + JSON.stringify(entries, null, 0).replace(/\},\{/g, '},\n{') + ';\n';
fs.writeFileSync(path.join(root, 'js/changelog.js'), out);
console.log(`js/changelog.js: ${entries.length} verzí, nejnovější ${entries[0]?.v}`);

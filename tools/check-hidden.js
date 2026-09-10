// Prohlížečové [hidden]{display:none} je jen elementové pravidlo — jakékoli
// #id nebo .trida s vlastním `display:` ho přebije a prvek zůstane vidět
// pořád. Ve v9.33 se takhle #imgViewer { display:flex } roztáhl přes celou
// aplikaci hned po načtení. `el.hidden = false` v JS na tom nic nezmění.
const fs = require('fs');
const path = require('path');

const displayRules = [];
for (const f of fs.readdirSync('css').filter(f => f.endsWith('.css'))) {
  const clean = fs.readFileSync(path.join('css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    if (!/(^|[;\s])display\s*:/.test(m[2])) continue;
    m[1].split(',').forEach(sel => displayRules.push({ file: f, sel: sel.trim() }));
  }
}

// "#ivStage" nesmí odpovídat na klíč "#iv" — za názvem musí končit slovo.
const mentions = (sel, key) => {
  let i = -1;
  while ((i = sel.indexOf(key, i + 1)) !== -1) {
    const after = sel[i + key.length];
    if (after === undefined || !/[\w-]/.test(after)) return true;
  }
  return false;
};

let bad = 0, checked = 0;
for (const file of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const tag of html.match(/<[a-z][a-z0-9]*\s[^>]*>/gi) || []) {
    if (!/\shidden(\s|\/?>|="(|hidden)")/i.test(tag)) continue;
    const id = (tag.match(/id="([^"]+)"/) || [])[1];
    const cls = ((tag.match(/class="([^"]+)"/) || [])[1] || '').split(/\s+/).filter(Boolean);
    const keys = [...(id ? ['#' + id] : []), ...cls.map(c => '.' + c)];
    if (!keys.length) continue;
    checked++;
    for (const key of keys) {
      const reset = displayRules.some(r => mentions(r.sel, key) && r.sel.includes('[hidden]'));
      if (reset) continue;
      const rule = displayRules.find(r =>
        mentions(r.sel, key) && !r.sel.includes('[hidden]') && !r.sel.includes(':'));
      if (!rule) continue;
      bad++;
      console.log('✗ ' + file + ': ' + key + ' má atribut hidden, ale ' + rule.file +
        ' mu nastavuje display (selektor "' + rule.sel + '") — chybí ' + key +
        '[hidden] { display: none; }, prvek bude vidět pořád.');
    }
  }
}
console.log('prvků s hidden: ' + checked);
if (bad) { console.log(bad + ' × přebitý hidden'); process.exit(1); }
console.log('Žádný hidden není přebitý pravidlem display ✓');

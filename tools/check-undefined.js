// Catch calls to functions that don't exist anywhere in the room bundle.
// `node --check` cannot see these — it only validates syntax — which is
// exactly how five functions once vanished in a rewrite and nothing complained.
const fs = require('fs');
const dir = 'C:/Users/zitka/Desktop/StudyBoard/js/';
const files = ['ai.js', 'drive.js', 'room-core.js', 'room-list.js', 'room-notes.js', 'room-export.js',
               'room-board.js', 'room-whiteboard.js', 'room-ai.js', 'room-social.js', 'room-init.js'];

// Odstrani komentare a OBSAH retezcu vcetne template literalu, aby se proza
// a CSS nemohly tvarit jako kod. Puvodni verze to delala regularnimi vyrazy a
// rozesla se na prvnim template literalu s apostrofem uvnitr ("student's") —
// od te chvile hlasila jako chybejici funkci kdejake slovo z ceskych hlasek.
// Tohle je stavovy automat: v templatu se zahazuje text, ale ${...} je zase
// kod, a to i kdyz je v nem dalsi template.
function strip(src) {
  let out = '';
  const mode = ['code'];            // 'code' | 'tpl'
  const braces = [];                // hloubka { } uvnitr aktualniho ${ }
  let i = 0;
  while (i < src.length) {
    const top = mode[mode.length - 1];
    const c = src[i], d = src[i + 1];

    if (top === 'tpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { mode.pop(); out += ' '; i++; continue; }
      if (c === '$' && d === '{') { mode.push('code'); braces.push(0); out += ' '; i += 2; continue; }
      i++; continue;                // text sablony zahazujeme
    }

    // --- kod ---
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; out += ' '; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < src.length && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
      i++; out += ' '; continue;
    }
    if (c === '`') { mode.push('tpl'); out += ' '; i++; continue; }
    if (mode.length > 1) {           // jsme uvnitr ${ } — hlidej jeho konec
      if (c === '{') { braces[braces.length - 1]++; }
      else if (c === '}') {
        if (braces[braces.length - 1] === 0) { mode.pop(); braces.pop(); out += ' '; i++; continue; }
        braces[braces.length - 1]--;
      }
    }
    out += c; i++;
  }
  return out;
}

const raw = files.map(f => fs.readFileSync(dir + f, 'utf8')).join('\n');
const src = strip(raw);
// Definitions are read from the RAW text: nested template literals defeat any
// simple stripper, and an extra 'definition' can only silence a false alarm.

const defined = new Set();
for (const m of raw.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of raw.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
// parameters and locally-bound names (rough, but enough to avoid false alarms)
// sipkova funkce s jednim parametrem bez zavorek:  resolve => ...
for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) defined.add(m[1]);
for (const m of src.matchAll(/\(([^)]*)\)\s*=>/g)) m[1].split(',').forEach(p => {
  const n = p.trim().replace(/[=.].*$/, '').replace(/[{}\[\]\s]/g, '');
  if (/^[A-Za-z_$][\w$]*$/.test(n)) defined.add(n);
});
for (const m of src.matchAll(/function[^(]*\(([^)]*)\)/g)) m[1].split(',').forEach(p => {
  const n = p.trim().replace(/[=.].*$/, '').replace(/[{}\[\]\s]/g, '');
  if (/^[A-Za-z_$][\w$]*$/.test(n)) defined.add(n);
});

const builtins = new Set(['if','for','while','switch','catch','return','typeof','function','await','new','do','else','try',
  'JSON','Math','Object','Array','String','Number','Boolean','Date','Set','Map','Promise','RegExp','Error','console',
  'document','window','localStorage','sessionStorage','navigator','location','history','fetch','setTimeout','setInterval',
  'clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','alert','confirm','prompt','parseInt','parseFloat',
  'isNaN','isFinite','encodeURIComponent','decodeURIComponent','firebase','db','auth','Image','Blob','URL','FileReader','FormData',
  'DataTransfer','KeyboardEvent','Event','CustomEvent','performance','getComputedStyle','structuredClone','queueMicrotask',
  'Intl','Symbol','WeakMap','WeakSet','Proxy','Reflect','btoa','atob','crypto','URLSearchParams','AbortController',
  'ResizeObserver','IntersectionObserver','MutationObserver','Node','Element','HTMLElement','Infinity','NaN','undefined',
  'super','void','delete','in','of','instanceof','yield','class','extends','import','export','const','let','var','this',
  'true','false','null','APP_VERSION','IMGBB_KEY',
  // regex artefacts, not real calls
  'async','stnosti']);

const called = new Set();
// POZOR na lookbehind: puvodni (?:^|[^\w$.]) tu zavorku SNEDL, takze volani
// hned za jinou zavorkou — if (foo(x)), toast(bar()) — se vubec nenaslo.
// Cely tenhle nastroj tak mel slepe misto presne tam, kde se nejcasteji vola.
for (const m of src.matchAll(/(?<![\w$.])([a-zA-Z_$][\w$]*)\s*\(/g)) called.add(m[1]);

const missing = [...called].filter(n => !defined.has(n) && !builtins.has(n));
console.log('definováno:', defined.size, '· voláno:', called.size);
if (missing.length) {
  console.log('NEDEFINOVANÉ FUNKCE:', missing.join(', '));
  process.exit(1);
}
console.log('Každá volaná funkce existuje ✓');

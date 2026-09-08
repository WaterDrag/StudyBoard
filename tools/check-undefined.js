// Catch calls to functions that don't exist anywhere in the room bundle.
// `node --check` cannot see these — it only validates syntax — which is
// exactly how five functions once vanished in a rewrite and nothing complained.
const fs = require('fs');
const dir = 'C:/Users/zitka/Desktop/StudyBoard/js/';
const files = ['ai.js', 'room-core.js', 'room-list.js', 'room-notes.js', 'room-export.js',
               'room-board.js', 'room-whiteboard.js', 'room-ai.js', 'room-social.js', 'room-init.js'];

// Strip comments and string/template contents so prose and CSS can't pose as code.
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

const raw = files.map(f => fs.readFileSync(dir + f, 'utf8')).join('\n');
const src = strip(raw);
// Definitions are read from the RAW text: nested template literals defeat any
// simple stripper, and an extra 'definition' can only silence a false alarm.

const defined = new Set();
for (const m of raw.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
for (const m of raw.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
// parameters and locally-bound names (rough, but enough to avoid false alarms)
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
for (const m of src.matchAll(/(?:^|[^\w$.])([a-zA-Z_$][\w$]*)\s*\(/g)) called.add(m[1]);

const missing = [...called].filter(n => !defined.has(n) && !builtins.has(n));
console.log('definováno:', defined.size, '· voláno:', called.size);
if (missing.length) {
  console.log('NEDEFINOVANÉ FUNKCE:', missing.join(', '));
  process.exit(1);
}
console.log('Každá volaná funkce existuje ✓');

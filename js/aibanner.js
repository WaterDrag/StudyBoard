// ═══ aibanner.js — banner karty místnosti nakreslený přes externí AI (SVG), uložený v rooms/{id}.cardSvg
// Uživatel si zkopíruje prompt (prompt()), vloží ho do libovolné AI (Gemini, ChatGPT…) a vrácený SVG kód
// 400×120 vloží zpátky. Ten se tu pročistí
// (jen kreslicí prvky, žádné skripty, události ani odkazy ven) a zmenší pod MAX znaků. Zobrazuje se
// jako data: URL v CSS pozadí — v obrázku prohlížeč skripty nespouští ani nic nestahuje, takže i
// kdyby čištění něco propustilo, nic se nestane.
(function () {
  'use strict';
  const MAX = 40000;
  const NS = 'http://www.w3.org/2000/svg';
  const TAGS = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
    'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'use', 'symbol', 'filter',
    'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'fecomposite', 'feflood', 'femerge', 'femergenode',
    'feturbulence', 'fedisplacementmap', 'fedropshadow', 'fecomponenttransfer', 'fefunca', 'fefuncr', 'fefuncg', 'fefuncb', 'femorphology']);
  const badUrl = v => /url\(\s*['"]?(?!#)/i.test(v) || /javascript:|data:|@import|expression\(/i.test(v);

  function sanitize(src) {
    const m = String(src || '').match(/<svg[\s\S]*<\/svg>/i);
    if (!m) throw new Error('no-svg');
    const doc = new DOMParser().parseFromString(m[0], 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('bad-svg');
    const walk = el => {
      for (const ch of [...el.children]) {
        if (!TAGS.has(ch.nodeName.toLowerCase())) { ch.remove(); continue; }
        for (const a of [...ch.attributes]) {
          const n = a.name.toLowerCase(), v = a.value;
          if (n.startsWith('on') || ((n === 'href' || n === 'xlink:href') && !v.startsWith('#')) || badUrl(v)) ch.removeAttribute(a.name);
        }
        walk(ch);
      }
    };
    for (const a of [...root.attributes]) if (a.name.toLowerCase().startsWith('on') || badUrl(a.value)) root.removeAttribute(a.name);
    walk(root);
    root.setAttribute('xmlns', NS);
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 400 120');
    root.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    root.removeAttribute('width'); root.removeAttribute('height');
    const out = new XMLSerializer().serializeToString(root).replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ');
    if (out.length > MAX) throw new Error('too-big');
    if (root.querySelectorAll('*').length < 4) throw new Error('too-simple');
    return out;
  }

  const toUrl = svg => svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';

  // Stejný styl jako banery her: ilustrace scény, žádný text, vhodná na široký pruh
  function prompt({ name, desc, idea, color }) {
    return `You are an illustrator. Draw a wide decorative banner as a single SVG for a study room card in a learning app.
Room name: "${name}"${desc ? `\nRoom description: "${desc}"` : ''}${idea ? `\nWhat the user wants in the picture: "${idea}"` : ''}
Main accent colour: ${color || '#6366f1'}.

Requirements:
- Output ONLY the SVG code, starting with <svg and ending with </svg>. No markdown, no explanation.
- viewBox="0 0 400 120", fill the whole area with a background (gradient or scene), no transparent areas.
- A rich, polished illustrated scene or still life that fits the topic (objects, symbols, light, depth), in the style of a modern game or app banner: gradients, soft shadows, highlights, a slight vignette.
- The left bottom corner (x < 60, y > 80) should stay calm (a small dot is drawn there).
- NO text, letters or numbers anywhere. No <script>, no <foreignObject>, no <image>, no external links or fonts.
- Keep it under 25 KB: reuse gradients via <defs>, avoid huge path data.`;
  }

  window.SBAiBanner = { sanitize, toUrl, prompt, MAX };
})();

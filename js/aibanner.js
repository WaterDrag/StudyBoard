// ═══ aibanner.js — banner karty místnosti nakreslený přes externí AI (SVG), uložený v rooms/{id}.cardSvg
// Uživatel si zkopíruje prompt (prompt()), vloží ho do libovolné AI (Gemini, ChatGPT…) a vrácený SVG kód
// vloží zpátky: dva obrázky ve stejném stylu — široký 400×120 (karta) a čtvercový 300×300 (velký box
// „Naposledy otevřené“, rooms/{id}.cardSvgSq). Každý se tu pročistí
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

  // Z vloženého textu vytáhne všechna SVG; široké (poměr ≥ 1,6) je pro kartu, ostatní čtvercové
  function parseBoth(src) {
    const blocks = String(src || '').match(/<svg[\s\S]*?<\/svg>/gi) || [];
    if (!blocks.length) throw new Error('no-svg');
    const ratio = svg => { const v = (svg.match(/viewBox="([^"]+)"/) || [])[1]?.trim().split(/[\s,]+/).map(Number); return v && v[3] ? v[2] / v[3] : 400 / 120; };
    const out = blocks.slice(0, 4).map(b => sanitize(b)).map(svg => ({ svg, wide: ratio(svg) >= 1.6 }));
    const wide = out.find(o => o.wide) || out[0], square = out.find(o => o !== wide && !o.wide);
    return { wide: wide.svg, square: square ? square.svg : '' };
  }

  const toUrl = svg => svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';

  // Stejný styl jako banery her: ilustrace scény, žádný text; jedna scéna ve dvou formátech
  function prompt({ name, desc, idea, color }) {
    return `You are an illustrator. Draw a decorative banner for a study room in a learning app, as TWO SVG files of the same scene in the same style:
1) a WIDE one, viewBox="0 0 400 120", shown on the small room card;
2) a SQUARE one, viewBox="0 0 300 300", shown in a big "last opened" panel — recompose the scene for the square (main subject centred, nothing important cut off), don't just stretch it.
Room name: "${name}"${desc ? `\nRoom description: "${desc}"` : ''}${idea ? `\nWhat the user wants in the picture: "${idea}"` : ''}
Main accent colour: ${color || '#6366f1'}.

Requirements:
- Output ONLY the two SVG codes one after another (wide first), each starting with <svg and ending with </svg>. No markdown, no explanation.
- Fill the whole area of each with a background (gradient or scene), no transparent areas.
- A rich, polished illustrated scene or still life that fits the topic (objects, symbols, light, depth), in the style of a modern game or app banner: gradients, soft shadows, highlights, a slight vignette.
- In the wide one, the left bottom corner (x < 60, y > 80) should stay calm (a small dot is drawn there).
- NO text, letters or numbers anywhere. No <script>, no <foreignObject>, no <image>, no external links or fonts.
- Keep each under 25 KB: reuse gradients via <defs>, avoid huge path data.`;
  }

  window.SBAiBanner = { sanitize, parseBoth, toUrl, prompt, MAX };
})();

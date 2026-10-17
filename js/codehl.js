// ═══ codehl.js — bloky kódu: zvýraznění syntaxe a tlačítko Kopírovat
// Sdílí místnost (poznámky, prezentace), Flash Cards a kvíz. Ukládá se jen
// čistý text v <pre data-lang="java"><code>…</code></pre>; barvy se dopočítají
// až při zobrazení (highlight.js se načte, až když je na stránce nějaký kód),
// takže v uložené poznámce nikdy nejsou.
const HLJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0';
const CODE_LANGS = [
  ['', 'Automaticky'], ['java', 'Java'], ['csharp', 'C#'], ['python', 'Python'], ['c', 'C'], ['cpp', 'C++'],
  ['js', 'JavaScript'], ['ts', 'TypeScript'], ['html', 'HTML'], ['css', 'CSS'], ['php', 'PHP'], ['sql', 'SQL'],
  ['bash', 'Bash'], ['powershell', 'PowerShell'], ['json', 'JSON'], ['xml', 'XML'], ['kotlin', 'Kotlin'],
  ['go', 'Go'], ['rust', 'Rust'], ['asm', 'Assembler'], ['plaintext', 'Prostý text'],
];
const CODE_LANG_NAME = Object.fromEntries(CODE_LANGS.filter(([k]) => k));
// Jazyky mimo základní balík highlight.js — dotáhnou se zvlášť.
const HL_ALIAS = { asm: 'x86asm', ps: 'powershell', ps1: 'powershell', sh: 'bash', 'c#': 'csharp', 'c++': 'cpp' };
const HL_EXTRA = { powershell: 1, x86asm: 1 };
let HLJS_P = null;
const HL_LANG_P = {};

function hlLoadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function loadHljs() {
  if (window.hljs) return Promise.resolve(window.hljs);
  return HLJS_P || (HLJS_P = hlLoadScript(HLJS_BASE + '/highlight.min.js').then(() => window.hljs).catch(e => { HLJS_P = null; throw e; }));
}
function hlEnsureLang(h, lang) {
  if (!lang || h.getLanguage(lang) || !HL_EXTRA[lang]) return Promise.resolve();
  return HL_LANG_P[lang] || (HL_LANG_P[lang] = hlLoadScript(`${HLJS_BASE}/languages/${lang}.min.js`).catch(() => {}));
}

// Text bloku i s řádky, které prohlížeč v editoru udělal jako <br> nebo <div>.
function preText(el) {
  let out = '';
  const walk = n => {
    if (n.nodeType === 3) { out += n.data; return; }
    if (n.nodeName === 'BR') { out += '\n'; return; }
    if (n.nodeType !== 1 || n.classList?.contains('code-copy')) return;
    const block = /^(DIV|P)$/.test(n.nodeName);
    if (block && out && !out.endsWith('\n')) out += '\n';
    n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out;
}

const CODE_COPY_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
function addCodeCopy(pre) {
  // Na malé kartičce na nástěnce kopírovací tlačítko jen překáží.
  if (pre.closest('.note, .ai-card-row, .dob-opt, .quiz-opt, .answer-btn, button')) return;
  const wrap = document.createElement('div');
  wrap.className = 'code-wrap';
  pre.before(wrap);
  wrap.appendChild(pre);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'code-copy';
  b.title = 'Kopírovat kód';
  b.setAttribute('aria-label', 'Kopírovat kód');
  b.innerHTML = CODE_COPY_ICO;
  b.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    const text = preText(pre.querySelector('code') || pre);
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* nic */ }
      ta.remove();
    }
    b.classList.add('done');
    setTimeout(() => b.classList.remove('done'), 1400);
  });
  wrap.appendChild(b);
}

function enhanceCode(root = document) {
  if (!root?.querySelectorAll) return;
  const pres = [...root.querySelectorAll('pre')].filter(p => !p.dataset.hl && !p.closest('[contenteditable="true"], .no-hl'));
  if (!pres.length) return;
  pres.forEach(p => {
    p.dataset.hl = '1';
    p.classList.add('code-block');
    // Starší / vložené bloky bez <code> — obalit, ať mají stejný vzhled.
    if (!p.querySelector(':scope > code')) {
      const c = document.createElement('code');
      c.textContent = preText(p);
      p.textContent = '';
      p.appendChild(c);
    }
    addCodeCopy(p);
  });
  loadHljs().then(async h => {
    for (const p of pres) {
      const code = p.querySelector(':scope > code');
      if (!code || !p.isConnected) continue;
      const text = preText(code);
      let lang = (p.dataset.lang || '').toLowerCase();
      lang = HL_ALIAS[lang] || lang;
      try {
        await hlEnsureLang(h, lang);
        if (lang === 'plaintext') continue;
        if (lang && h.getLanguage(lang)) code.innerHTML = h.highlight(text, { language: lang, ignoreIllegals: true }).value;
        else if (text.length < 20000) code.innerHTML = h.highlightAuto(text).value;
        code.classList.add('hljs');
      } catch (_) { /* zůstane bez barev */ }
    }
  }).catch(() => { /* bez internetu: kód zůstane čitelný, jen bez barev */ });
}

// Nový obsah na stránce (otevřená poznámka, karta, otázka v kvízu…) se
// obarví sám. Sleduje se jen přidávání prvků, ne styly — tažení po nástěnce
// to nebudí.
(function () {
  let queued = false;
  const run = () => { queued = false; enhanceCode(document.body); };
  const start = () => {
    run();
    new MutationObserver(muts => {
      if (queued) return;
      if (!muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.nodeName === 'PRE' || n.querySelector?.('pre'))))) return;
      queued = true;
      setTimeout(run, 30);   // ne rAF: v záložce na pozadí by nedoběhl
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

// ═══ room-math.js — vzorce v poznámkách
// V poznámce je <span class="sb-math" data-tex="…"> s MathML. MathML kreslí sám prohlížeč, takže vzorec funguje na nástěnce,
// v prezentaci i v exportu bez internetu. KaTeX se stahuje jen na převod LaTeXu v okně Vzorec.
// Tlačítko Vzorec je na kartě Vložení, klik na hotový vzorec v editoru ho otevře k úpravě.

(function () {
  const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
  const SNIPPETS = [
    ['a/b', '\\frac{a}{b}', 'Zlomek'], ['x²', 'x^{2}', 'Mocnina'], ['x₁', 'x_{1}', 'Dolní index'], ['√', '\\sqrt{x}', 'Odmocnina'],
    ['Σ', '\\sum_{i=1}^{n}', 'Součet'], ['∫', '\\int_{a}^{b}', 'Integrál'], ['lim', '\\lim_{x \\to \\infty}', 'Limita'],
    ['π', '\\pi', 'Pí'], ['∞', '\\infty', 'Nekonečno'], ['±', '\\pm', 'Plus minus'], ['·', '\\cdot', 'Krát'],
    ['≤', '\\leq', 'Menší nebo rovno'], ['≥', '\\geq', 'Větší nebo rovno'], ['≠', '\\neq', 'Není rovno'], ['→', '\\to', 'Šipka'],
  ];
  let modal = null, loading = null, target = null;   // target: { editor, range, node }

  function loadKatex() {
    if (window.katex) return Promise.resolve();
    return loading || (loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = KATEX;
      s.onload = res;
      s.onerror = () => { loading = null; rej(new Error('load')); };
      document.head.appendChild(s);
    }));
  }
  function render(tex, display) {
    return katex.renderToString(tex, { output: 'mathml', displayMode: display, throwOnError: false, strict: 'ignore' });
  }
  function buildHtml(tex, display) {
    const box = document.createElement('div');
    const span = document.createElement('span');
    span.className = 'sb-math';
    span.dataset.tex = tex;
    if (display) span.dataset.display = '1';
    span.setAttribute('contenteditable', 'false');
    span.innerHTML = render(tex, display);
    span.querySelectorAll('annotation').forEach(a => a.remove());   // text LaTeXu by se jinak objevil v hledání a kartičkách
    box.appendChild(span);
    return box.innerHTML;
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'mathModal';
    modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mathTitle">
        <div class="modal-header"><h3 id="mathTitle">Vzorec</h3><button type="button" class="modal-close" data-m="close" aria-label="Zavřít">✕</button></div>
        <div class="math-snips">${SNIPPETS.map(([l, t, n], i) => `<button type="button" class="math-snip" data-i="${i}" title="${n}" aria-label="${n}">${l}</button>`).join('')}</div>
        <div class="form-group"><label class="label" for="mathInput">Zápis v LaTeXu</label><textarea id="mathInput" class="input" rows="3" spellcheck="false" placeholder="\\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}"></textarea></div>
        <div class="math-preview" id="mathPreview" aria-live="polite"></div>
        <label class="math-display"><input type="checkbox" id="mathDisplay"> Na samostatný řádek</label>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-m="close">Zrušit</button><button type="button" class="btn btn-primary" id="mathOk">Vložit</button></div>
      </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('#mathInput');
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-m="close"]')) { closeModal('mathModal'); return; }
      const s = e.target.closest('.math-snip');
      if (s) {
        const t = SNIPPETS[+s.dataset.i][1], a = input.selectionStart;
        input.setRangeText(t, a, input.selectionEnd, 'end');
        input.focus();
        preview();
      }
    });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); closeModal('mathModal'); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insert(); }
    });
    input.addEventListener('input', preview);
    modal.querySelector('#mathDisplay').addEventListener('change', preview);
    modal.querySelector('#mathOk').addEventListener('click', insert);
  }
  function preview() {
    const tex = modal.querySelector('#mathInput').value.trim(), el = modal.querySelector('#mathPreview');
    if (!tex) { el.innerHTML = '<span class="math-hint">Tady se ukáže náhled.</span>'; return; }
    if (!window.katex) { el.innerHTML = '<span class="math-hint">Načítám…</span>'; return; }
    el.innerHTML = render(tex, modal.querySelector('#mathDisplay').checked);
  }

  async function openDialog(editor, node) {
    const sel = window.getSelection();
    const range = !node && sel.rangeCount && editor.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    target = { editor, range, node };
    if (!modal) buildModal();
    modal.querySelector('#mathInput').value = node?.dataset.tex || '';
    modal.querySelector('#mathDisplay').checked = node?.dataset.display === '1';
    modal.querySelector('#mathOk').textContent = node ? 'Uložit' : 'Vložit';
    preview();
    openModal('mathModal');
    setTimeout(() => modal.querySelector('#mathInput').focus(), 60);
    try { await loadKatex(); preview(); }
    catch (_) { modal.querySelector('#mathPreview').innerHTML = '<span class="math-hint">Nástroj na vzorce se nenačetl. Zkontroluj připojení a zkus to znovu.</span>'; }
  }
  function insert() {
    const tex = modal.querySelector('#mathInput').value.trim();
    if (!tex) { toast('Napiš vzorec.'); return; }
    if (!window.katex) { toast('Nástroj na vzorce se ještě načítá.'); return; }
    const { editor, range, node } = target, display = modal.querySelector('#mathDisplay').checked;
    const html = buildHtml(tex, display);
    closeModal('mathModal');
    editor.focus();
    const sel = window.getSelection();
    const r = document.createRange();
    if (node?.isConnected) r.selectNode(node);
    else if (range) { r.setStart(range.startContainer, range.startOffset); r.setEnd(range.endContainer, range.endOffset); }
    else { r.selectNodeContents(editor); r.collapse(false); }
    sel.removeAllRanges();
    sel.addRange(r);
    document.execCommand('insertHTML', false, html.replace('<span ', '<span data-new="1" ') + (node ? '' : '&nbsp;'));   // přes execCommand, ať jde vrátit přes Ctrl+Z
    // Na konci <p> nebo nadpisu ho prohlížeč vloží až za odstavec: vrátit ho dovnitř, za text
    const added = editor.querySelector('.sb-math[data-new]');
    if (!added) return;
    added.removeAttribute('data-new');
    const prev = added.previousElementSibling;
    if (added.parentElement === editor && prev && /^(P|H[1-6]|BLOCKQUOTE)$/.test(prev.tagName)) {
      const after = added.nextSibling;
      prev.append(added);
      if (after?.nodeType === 3) prev.append(after);
      r.setStart(prev, prev.childNodes.length);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  // Vložení zkopírovaného vzorce: z HTML zůstane jen MathML bez atributů, které by mohly spouštět kód
  function clean(span) {
    const tex = span.getAttribute('data-tex') || '', disp = span.getAttribute('data-display');
    [...span.attributes].forEach(a => span.removeAttribute(a.name));
    span.className = 'sb-math';
    span.setAttribute('data-tex', tex);
    if (disp === '1') span.setAttribute('data-display', '1');
    span.querySelectorAll('*').forEach(el => {
      if (!/^(math|semantics|m[a-z]+)$/i.test(el.localName)) { el.remove(); return; }
      [...el.attributes].forEach(a => { if (!/^(display|mathvariant|stretchy|fence|separator|accent|accentunder|lspace|rspace|linethickness|columnalign|rowspacing|columnspacing|xmlns)$/i.test(a.name)) el.removeAttribute(a.name); });
    });
  }

  // cleanEditorHtml atribut contenteditable při ukládání odstraňuje, v editoru musí vzorec zůstat jako celek
  function lock(root) { root.querySelectorAll('.sb-math:not([contenteditable])').forEach(el => el.setAttribute('contenteditable', 'false')); }

  document.querySelectorAll('.rich-editor').forEach(editor => {
    if (!editor.id) return;
    new MutationObserver(() => lock(editor)).observe(editor, { childList: true, subtree: true });
    editor.addEventListener('click', e => {
      const m = e.target.closest?.('.sb-math');
      if (m && editor.contains(m)) { e.preventDefault(); openDialog(editor, m); }
    });
  });
  document.querySelectorAll('.rich-toolbar').forEach(tb => {
    const btn = tb.querySelector('.rt-math');
    const editor = tb.parentElement.querySelector('.rich-editor');
    if (!btn || !editor) return;
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => openDialog(editor, null));
  });

  window.SBMath = { clean };
})();

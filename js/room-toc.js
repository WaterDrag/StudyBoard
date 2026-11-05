// ═══ room-toc.js — obsah vložený do poznámky (jako ve Wordu)
// Editor: Vložení → Obsah vloží blok <div class="sb-toc"> se seznamem nadpisů (Nadpis = h2, Podnadpis = h3).
// Při psaní se seznam sám přepisuje podle aktuálních nadpisů, takže v uloženém HTML je vždy čerstvý
// (a stejně ho uvidí export i kdokoli bez tohoto skriptu). Při čtení se seznam přestaví znovu
// a položky přeskočí na svůj nadpis. V editoru je blok contenteditable=false: maže se celý, nepíše se do něj.

(function () {
  const HEADS = 'h1, h2, h3';
  const headsOf = root => [...root.querySelectorAll(HEADS)].filter(h => !h.closest('.sb-toc') && h.textContent.trim());

  // Seznam podle nadpisů v root; úroveň se počítá od nejvyššího použitého nadpisu
  function listHtml(root) {
    const hs = headsOf(root);
    if (!hs.length) return '<li class="sb-toc-empty">Zatím tu nejsou žádné nadpisy. Přidej je přes Nadpis a Podnadpis.</li>';
    const top = Math.min(...hs.map(h => +h.tagName[1]));
    return hs.map((h, i) => `<li class="sb-toc-lv${Math.min(3, +h.tagName[1] - top + 1)}" data-i="${i}">${escText(h.textContent.trim())}</li>`).join('');
  }
  const escText = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const blockHtml = root => `<div class="sb-toc"><p class="sb-toc-h">Obsah</p><ol class="sb-toc-list">${listHtml(root)}</ol></div>`;

  function refresh(root) {
    root.querySelectorAll('.sb-toc').forEach(t => {
      let ol = t.querySelector('.sb-toc-list');
      if (!ol) { ol = document.createElement('ol'); ol.className = 'sb-toc-list'; t.appendChild(ol); }
      const html = listHtml(root);
      if (ol.innerHTML !== html) ol.innerHTML = html;
    });
  }

  // Čtení: přestavět seznam a rozkliknout položky
  function render(root) {
    if (!root?.querySelector?.('.sb-toc')) return;
    refresh(root);
    const hs = headsOf(root);
    root.querySelectorAll('.sb-toc li[data-i]').forEach(li => {
      li.tabIndex = 0;
      li.setAttribute('role', 'link');
      const go = e => {
        e.preventDefault(); e.stopPropagation();
        const h = hs[+li.dataset.i];
        if (!h) return;
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        h.classList.remove('sb-toc-flash'); void h.offsetWidth; h.classList.add('sb-toc-flash');
      };
      li.addEventListener('click', go);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
    });
  }

  // Editor: blok se nedá přepisovat, jen celý smazat; seznam drží krok s nadpisy
  const lock = editor => editor.querySelectorAll('.sb-toc').forEach(t => { if (t.getAttribute('contenteditable') !== 'false') t.setAttribute('contenteditable', 'false'); });
  document.querySelectorAll('.rich-editor').forEach(editor => {
    let timer = 0;
    editor.addEventListener('input', () => {
      if (!editor.querySelector('.sb-toc')) return;
      clearTimeout(timer);
      timer = setTimeout(() => refresh(editor), 350);
    });
    new MutationObserver(() => lock(editor)).observe(editor, { childList: true, subtree: true });
  });

  document.querySelectorAll('.rich-toolbar').forEach(tb => {
    const btn = tb.querySelector('.rt-toc');
    const editor = tb.parentElement.querySelector('.rich-editor');
    if (!btn || !editor) return;
    let saved = null;
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const s = getSelection();
      saved = s.rangeCount && editor.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
    });
    btn.addEventListener('click', e => {
      e.preventDefault();
      const have = editor.querySelector('.sb-toc');
      if (have) {   // jeden obsah na poznámku stačí: ukázat ho a obnovit
        refresh(editor);
        have.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (typeof toast === 'function') && toast('Obsah už v poznámce je, aktualizuje se sám. Smažeš ho klávesou Backspace.');
        return;
      }
      editor.focus();
      // Obsah je samostatný blok: vloží se ZA odstavec s kurzorem (prázdný odstavec nahradí).
      // execCommand('insertHTML') by ho na konci odstavce slil s textem („Úvod.Obsah“).
      const tpl = document.createElement('div');
      tpl.innerHTML = blockHtml(editor);
      const toc = tpl.firstElementChild, next = document.createElement('p');
      next.innerHTML = '<br>';
      let block = saved ? saved.startContainer : null;
      while (block && block.parentNode !== editor) block = block.parentNode;
      if (!block) editor.prepend(toc);
      else if (block.nodeType === 1 && block.tagName === 'P' && !block.textContent.trim() && !block.querySelector('img')) block.replaceWith(toc);
      else block.after(toc);
      toc.after(next);
      lock(editor);
      const r = document.createRange(); r.setStart(next, 0); r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  window.SBToc = { render, refresh };
})();

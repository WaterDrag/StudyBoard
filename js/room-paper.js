// ═══ room-paper.js — čitelnost poznámek: bílé / černé pozadí a automatická barva neviditelného písma
// Tlačítko v liště editoru a v detailu poznámky přepíná pozadí (obrázek s průhledným pozadím a černým obrysem
// jde na tmavém vidět až na bílém). Volba platí pro všechny poznámky a pamatuje si ji prohlížeč.
// Písmo, které by na aktuálním pozadí nebylo vidět (černé na tmavém, bílé na bílém), dostane třídu .ink-auto
// a kreslí se výchozí barvou. Uložený obsah se nemění — třídu maže cleanEditorHtml.

(function () {
  const KEY = 'sb_note_paper';
  const BOXES = '.note-detail-content, .rich-editor-wrap';
  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>';
  const pref = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };

  // barva → relativní jas 0..1 (null = neznámá nebo průhledná)
  const cx = document.createElement('canvas').getContext('2d');
  function lum(col) {
    if (!col) return null;
    cx.fillStyle = '#010203'; cx.fillStyle = col;
    const v = cx.fillStyle;
    let r, g, b;
    if (v[0] === '#') { r = parseInt(v.slice(1, 3), 16); g = parseInt(v.slice(3, 5), 16); b = parseInt(v.slice(5, 7), 16); }
    else { const m = v.match(/[\d.]+/g); if (!m || (m[3] !== undefined && +m[3] < 0.5)) return null; [r, g, b] = m.map(Number); }
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  // Text s vlastním pozadím (zvýraznění, barevná buňka) je vidět — ten nechat být
  function hasOwnBg(el, box) {
    for (let n = el; n && n !== box; n = n.parentElement) {
      const b = n.style?.backgroundColor;
      if (b && b !== 'transparent' && lum(b) != null) return true;
    }
    return false;
  }
  function fixInk(box) {
    const paper = lum(getComputedStyle(box).getPropertyValue('--bg').trim());
    if (paper == null) return;
    box.querySelectorAll('[style*="color"], font[color]').forEach(el => {
      const c = el.style.color || el.getAttribute('color');
      if (!c || el.closest('pre, code, .tbl-bar, .rich-toolbar')) return;
      const l = lum(c);
      const bad = l != null && contrast(l, paper) < 2 && !hasOwnBg(el, box);
      el.classList.toggle('ink-auto', bad);
      if (!bad && !el.className) el.removeAttribute('class');
    });
  }
  function fixAll() { document.querySelectorAll(BOXES).forEach(fixInk); }

  function apply() {
    const p = pref();
    document.querySelectorAll(BOXES).forEach(b => { b.classList.toggle('paper-light', p === 'light'); b.classList.toggle('paper-dark', p === 'dark'); });
    document.querySelectorAll('.paper-btn').forEach(b => {
      const light = isLight();
      b.title = light ? 'Přepnout na černé pozadí poznámek' : 'Přepnout na bílé pozadí poznámek';
      b.setAttribute('aria-label', b.title);
    });
    fixAll();
  }
  function isLight() {
    const b = document.querySelector(BOXES);
    const l = b ? lum(getComputedStyle(b).getPropertyValue('--bg').trim()) : 0;
    return l != null && l > 0.4;
  }
  function toggle() {
    const next = isLight() ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch (_) {}
    apply();
  }
  function addButtons() {
    const mk = cls => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls + ' paper-btn'; b.innerHTML = ICON;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', toggle);
      return b;
    };
    document.querySelectorAll('.rich-toolbar').forEach(t => { if (!t.querySelector('.paper-btn')) t.appendChild(mk('rt-btn')); });
    const head = document.querySelector('#noteDetailBox .modal-header'), close = head?.querySelector('.modal-close');
    if (head && close && !head.querySelector('.paper-btn')) { const b = mk('btn btn-ghost btn-sm'); b.style.marginLeft = 'auto'; b.style.marginRight = '6px'; head.insertBefore(b, close); }
  }

  function init() {
    addButtons();
    apply();
    // obsah se mění (otevření poznámky, psaní, barva písma) → znovu přepočítat
    let t = 0;
    const later = box => { clearTimeout(box._ink); box._ink = setTimeout(() => fixInk(box), 80); };
    document.querySelectorAll(BOXES).forEach(box => new MutationObserver(() => later(box)).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'color'] }));
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(apply, 50); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

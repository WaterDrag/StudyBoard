// ═══ safe-html.js — čištění HTML od ostatních uživatelů (DOMPurify v js/vendor/)
// Obsah poznámky může kdokoli s právem úprav zapsat přímo do databáze, klientské čištění při ukládání ho nezastaví.
// Proto se čistí při načtení z databáze (sbSafeNote) a ještě jednou těsně před vložením do stránky (sbSafeHtml).
// Povolit novou značku nebo atribut v poznámkách znamená upravit CONFIG níže.

(function () {
  const CONFIG = {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'option', 'iframe', 'frame', 'object', 'embed', 'video', 'audio', 'source', 'track', 'svg', 'link', 'meta', 'base', 'dialog', 'details', 'summary', 'marquee'],
  };
  // Vlastnosti, kterými by se poznámka dostala mimo svůj prostor (překrytí celé stránky, načítání cizích adres)
  const BAD_STYLE = /^(position|inset|top|left|right|bottom|z-index|background-image|background|mask|mask-image|border-image|cursor|content|filter|backdrop-filter|transform|pointer-events|animation|transition)/i;
  const PURIFY = window.DOMPurify;
  if (PURIFY?.isSupported) {
    PURIFY.addHook('afterSanitizeAttributes', el => {
      // DOMPurify při každém průchodu otočí pořadí atributů. Bez pevného pořadí by se stejný text pokaždé lišil
      // a kontrola souběžných úprav v editoru by hlásila falešný konflikt.
      const attrs = [...(el.attributes || [])];
      if (attrs.length > 1) {
        const kept = attrs.map(a => [a.name, a.value]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
        attrs.forEach(a => el.removeAttribute(a.name));
        kept.forEach(([n, v]) => el.setAttribute(n, v));
      }
      if (!el.hasAttribute?.('style')) return;
      const st = el.style;
      for (let i = st.length - 1; i >= 0; i--) {
        const name = st[i], val = st.getPropertyValue(name);
        // Zvýraznění textu a podklad buněk používají background-color, ten je v pořádku
        // Volně umístěné obrázky stojí na position:absolute, jen fixed by překryl celou stránku
        const freeImg = el.tagName === 'IMG' && /^(position|top|left|right|bottom|z-index|transform)$/i.test(name) && val !== 'fixed' && val !== 'sticky';
        if (((BAD_STYLE.test(name) && name !== 'background-color') && !freeImg) || /url\s*\(|expression\s*\(/i.test(val)) st.removeProperty(name);
      }
      if (!st.length) el.removeAttribute('style');
    });
  }

  const cache = new Map();
  function safeHtml(raw) {
    const html = raw == null ? '' : String(raw);
    if (!html) return '';
    let out = cache.get(html);
    if (out !== undefined) return out;
    // Když by se knihovna nenačetla, zobrazí se jen text: raději bez formátování než s cizím kódem
    if (PURIFY?.isSupported) out = PURIFY.sanitize(html, CONFIG);
    else { const d = document.createElement('div'); d.textContent = new DOMParser().parseFromString(html, 'text/html').body.textContent || ''; out = d.innerHTML; }
    if (cache.size > 2000) cache.clear();
    cache.set(html, out);
    return out;
  }

  const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%deg]+\)|[a-z]+)$/i;
  const safeColor = c => (typeof c === 'string' && COLOR.test(c.trim()) ? c : undefined);

  // Dokument poznámky z databáze → stejný dokument s vyčištěným obsahem. Ostatní pole (název…) se vkládají přes esc().
  function safeNote(data) {
    if (!data) return data;
    const out = { ...data };
    if (out.contentType === 'html' || out.content == null) out.content = safeHtml(out.content);
    if (Array.isArray(out.pages)) out.pages = out.pages.map(p => (p && typeof p === 'object' ? { ...p, content: safeHtml(p.content) } : p));
    if ('color' in out) { const c = safeColor(out.color); if (c === undefined) delete out.color; else out.color = c; }
    if ('hcolor' in out) { const c = safeColor(out.hcolor); if (c === undefined) delete out.hcolor; else out.hcolor = c; }
    return out;
  }

  // Id dokumentu si může zvolit i ten, kdo ho zakládá, a končí v atributech: cizí znaky se nepouštějí vůbec
  window.sbSafeId = id => /^[\w-]{1,128}$/.test(id);
  window.sbSafeHtml = safeHtml;
  window.sbSafeNote = safeNote;
  window.sbSafeColor = safeColor;
})();

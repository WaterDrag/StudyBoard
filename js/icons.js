/* icons.js — emoji v celé aplikaci jako Google emoji (Noto), aby vypadaly všude stejně (i v Edgi na Windows).
 * SBI.html(text) vrátí text s emoji nahrazenými <img class="tdi"> s obrázkem Noto; SBI.set(el, text) to zapíše jen při změně.
 * Hlídač stránky (MutationObserver) převádí texty, které vloží ostatní kód; přeskakuje obsah od uživatelů
 * (editory, poznámky, pole, [data-noicons]) — tam se emoji jen vykreslí písmem Noto Color Emoji (DOM zůstane beze změny).
 * Kreslení emoji do plátna (fillText) se taky nahradí obrázkem Noto. */
(function () {
  'use strict';
  const NOTO = 'https://fonts.gstatic.com/s/e/notoemoji/latest/';
  // Znaky, které mají výchozí podobu textovou, ale aplikace je píše jako emoji i bez U+FE0F
  const TEXT_AS_EMOJI = '❤⚔▶⏸⏭⚙✳🛡⛏🕯🏗🗑✏❄⚠👁♾🖱☠🗡🗺⏱🖼🏘🗄🗜⚖🖊✍✈☄🌫⚗☢🌪🌡🕊';
  const PART = '(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}(?=\\uFE0F)|[' + TEXT_AS_EMOJI + '])(?:\\p{Emoji_Modifier}|\\uFE0F)?';
  const RE = new RegExp('\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|' + PART + '(?:\\u200D(?:\\p{Extended_Pictographic})(?:\\p{Emoji_Modifier}|\\uFE0F)?)*', 'gu');
  // „👨‍💻" → 1f468_200d_1f4bb (Noto bez U+FE0F; jen klávesy chtějí 0031_fe0f_20e3)
  const code = e => {
    const cps = [...e].map(c => c.codePointAt(0)).filter(c => c !== 0xFE0F);
    if (cps[cps.length - 1] === 0x20E3) return cps[0].toString(16).padStart(4, '0') + '_fe0f_20e3';
    return cps.map(c => c.toString(16)).join('_');
  };
  const url = e => NOTO + code(e) + '/emoji.svg';
  const escA = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // alt = samotné emoji: kopírování textu i čtečky dostanou původní znak; když obrázek nejde načíst, ukáže se znak
  const img = e => `<img class="tdi" src="${url(e)}" alt="${escA(e)}" draggable="false" loading="lazy" onerror="this.replaceWith(this.alt)">`;
  const TDI = window.SBI = window.TDI = {
    url, has: s => { RE.lastIndex = 0; return RE.test(s); },
    // text (už escapovaný HTML) → HTML s obrázky emoji
    html: s => String(s).replace(RE, img),
    set: (el, text) => { if (!el || el._tdi === text) return; el._tdi = text; el.innerHTML = TDI.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')); },
  };
  // Hlídač: textové uzly s emoji v rámci stránky převede na obrázky
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SVG: 1, svg: 1, TITLE: 1 };
  // obsah psaný uživatelem nechat beze změny (ukládá se z DOM nebo se s ním porovnává)
  const USER = 'svg, [contenteditable], .rich-editor, .note-content, [data-noicons]';
  function convertText(node) {
    const t = node.nodeValue;
    RE.lastIndex = 0;
    if (!t || !RE.test(t)) return;
    const p = node.parentNode; if (!p || SKIP[p.nodeName] || p.closest?.(USER)) return;
    const span = document.createElement('span');
    RE.lastIndex = 0;
    span.innerHTML = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(RE, img);
    const frag = document.createDocumentFragment();
    while (span.firstChild) frag.appendChild(span.firstChild);
    p.replaceChild(frag, node);
  }
  function walk(root) {
    if (root.nodeType === 3) { convertText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
    while (tw.nextNode()) list.push(tw.currentNode);
    list.forEach(convertText);
  }
  /* ---------- plátno: emoji ve fillText nakreslit obrázkem Noto ---------- */
  const imgs = {};
  const canvasImg = e => {
    const k = code(e);
    let im = imgs[k];
    // crossOrigin: obrázek z jiné domény by jinak „zašpinil" plátno a toDataURL (ikony v obchodě Obrany) by spadlo
    if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'; im.src = url(e); imgs[k] = im; }
    return im;
  };
  // Emoji, které hry kreslí do plátna, načíst předem (jinak by se první snímek, který se ukládá do mezipaměti, nakreslil bez nich)
  const PRELOAD = '❤💚🪙💎🌊💰📜⚔👻🔮💨🏆▶⏸⏭💥🏰👑🫧🔦🪨🚫⚙📖🌱🔵🟢😡✳🛡⛏🧲🧊🐝🪖📍🕯🏗💪🏁🗑🎨🧑✏❄⚠🎯👁♾🖱⛵🗼🏦✨🔒🎁🤝🔌💡☠🔄🥇🥈🥉🔗⚡🧟🧠🔥💀⭐🌟🍀🎲🃏🧩🏹🗡🪓🌲🌳🍄🐉🦅🐺🧙🧪💣🌀☄🌪';
  const preload = () => { RE.lastIndex = 0; (PRELOAD.match(RE) || []).forEach(canvasImg); };
  (window.requestIdleCallback || (f => setTimeout(f, 300)))(preload);
  const HAS = new RegExp(RE.source, 'u');
  if (window.CanvasRenderingContext2D) {
    const P = CanvasRenderingContext2D.prototype, oFill = P.fillText, oMeasure = P.measureText;
    P.fillText = function (text, x, y, maxW) {
      if (typeof text !== 'string' || !HAS.test(text)) return maxW === undefined ? oFill.call(this, text, x, y) : oFill.call(this, text, x, y, maxW);
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font), size = m ? +m[1] : 10, parts = [];
      let last = 0; RE.lastIndex = 0;
      for (let r; (r = RE.exec(text));) { if (r.index > last) parts.push(text.slice(last, r.index)); parts.push({ e: r[0] }); last = RE.lastIndex; }
      if (last < text.length) parts.push(text.slice(last));
      const w = parts.map(p => typeof p === 'string' ? oMeasure.call(this, p).width : size * 1.1), W = w.reduce((a, b) => a + b, 0);
      const al = this.textAlign, bl = this.textBaseline;
      let cx = al === 'center' ? x - W / 2 : (al === 'right' || al === 'end') ? x - W : x;
      const top = bl === 'middle' ? y - size / 2 : (bl === 'top' || bl === 'hanging') ? y : (bl === 'bottom' || bl === 'ideographic') ? y - size : y - size * 0.82;
      this.textAlign = 'left';
      parts.forEach((p, i) => {
        if (typeof p === 'string') oFill.call(this, p, cx, y);
        else {
          const im = canvasImg(p.e);
          if (im.complete && im.naturalWidth) this.drawImage(im, cx + size * 0.05, top, size, size);
          else oFill.call(this, p.e, cx, y);   // ještě se načítá → zatím systémové emoji
        }
        cx += w[i];
      });
      this.textAlign = al;
    };
  }
  function start() {
    if (!document.getElementById('sbi-css')) {   // styl emoji (funguje i na stránkách bez style.css)
      const st = document.createElement('style'); st.id = 'sbi-css';
      st.textContent = 'img.tdi{display:inline-block;width:1.2em;height:1.2em;vertical-align:-.24em;margin:0 .03em;flex-shrink:0;object-fit:contain}';
      document.head.appendChild(st);
    }
    // Obsah od uživatelů (poznámky, editor, pole) se nepřepisuje — emoji v něm vykreslí písmo Noto Color Emoji.
    // Na Applu ne: Safari barevné písmo Noto neumí a jeho vlastní emoji vypadají dobře.
    if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform || '') && !document.getElementById('sbi-font')) {
      const l = document.createElement('link'); l.id = 'sbi-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap';
      document.head.appendChild(l);
    }
    walk(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') convertText(m.target); else m.addedNodes.forEach(walk); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

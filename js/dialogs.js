// ═══ dialogs.js — vlastní okna místo alert / confirm / prompt prohlížeče, vracejí Promise
//   await sbConfirm('Smazat poznámku?', { ok: 'Smazat', danger: true })   → true / false
//   await sbPrompt('Text nadpisu', '', { ok: 'Přidat' })                  → text / null (zrušeno)
//   await sbAlert('Přístup vypršel.')
// Stejně jako okna prohlížeče po zavření vrátí focus i označený text, takže editor poznámky nepřijde o kurzor,
// a dokud jsou otevřená, nedostanou klávesy ani kliknutí zkratky stránky pod nimi.
// První odstavec zprávy je nadpis okna, zbytek (po prázdném řádku nebo novém řádku) menší vysvětlení.
// Exportovaná offline stránka (room-export.js) má svůj kód a tohle nepoužívá.

(function () {
  let queue = Promise.resolve();
  const STOP = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'wheel', 'paste', 'copy', 'cut', 'input', 'touchstart', 'touchend'];

  function open(o) {
    return new Promise(resolve => {
      const prevFocus = document.activeElement, sel = window.getSelection();
      const ranges = sel && sel.rangeCount ? [...Array(sel.rangeCount).keys()].map(i => sel.getRangeAt(i).cloneRange()) : [];

      const wrap = document.createElement('div');
      wrap.className = 'sbd-wrap';
      const box = document.createElement('div');
      box.className = 'sbd-box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      if (o.avatar) {   // { url, letter }: fotka člověka, o kterého jde
        const av = document.createElement('div');
        av.className = 'sbd-av';
        if (o.avatar.url) { const img = document.createElement('img'); img.src = o.avatar.url; img.alt = ''; img.referrerPolicy = 'no-referrer'; av.appendChild(img); }
        else av.textContent = o.avatar.letter || '?';
        box.appendChild(av);
      }
      const [head, ...rest] = String(o.message).split(/\n\s*\n|\n/);
      const title = document.createElement('div');
      title.className = 'sbd-title';
      title.id = 'sbdTitle';
      title.textContent = head;
      box.setAttribute('aria-labelledby', 'sbdTitle');
      box.appendChild(title);
      if (rest.length) {
        const more = document.createElement('p');
        more.className = 'sbd-more';
        more.textContent = rest.join(' ');
        box.appendChild(more);
      }
      let input = null;
      if (o.input) {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'input sbd-input';
        input.value = o.value ?? '';
        input.placeholder = o.placeholder || '';
        input.setAttribute('aria-labelledby', 'sbdTitle');
        box.appendChild(input);
      }
      const btns = document.createElement('div');
      btns.className = 'sbd-btns';
      const mk = (text, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = text; return b; };
      const cancel = o.noCancel ? null : mk(o.cancel || 'Zrušit', 'btn-secondary');
      const ok = mk(o.ok || 'OK', o.danger ? 'btn-danger' : 'btn-primary');
      if (cancel) btns.appendChild(cancel);
      btns.appendChild(ok);
      box.appendChild(btns);
      wrap.appendChild(box);

      let done = false;
      const finish = confirmed => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', onKey, true);
        wrap.remove();
        if (prevFocus && prevFocus.isConnected && prevFocus !== document.body) prevFocus.focus?.({ preventScroll: true });
        if (ranges.length && sel) { try { sel.removeAllRanges(); ranges.forEach(r => sel.addRange(r)); } catch (_) {} }
        resolve(o.input ? (confirmed ? input.value : null) : confirmed);
      };
      // Klávesy se chytají na window ještě před všemi zkratkami stránky. Psaní do políčka tím není dotčené.
      const onKey = e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish(document.activeElement !== cancel); }
        else if (e.key === 'Tab') {
          const list = [input, cancel, ok].filter(Boolean), i = list.indexOf(document.activeElement);
          e.preventDefault();
          list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
        }
      };
      window.addEventListener('keydown', onKey, true);
      STOP.forEach(t => wrap.addEventListener(t, e => e.stopPropagation()));
      let downOnBack = false;
      wrap.addEventListener('mousedown', e => { downOnBack = e.target === wrap; });
      wrap.addEventListener('click', e => {
        if (e.target === ok) finish(true);
        else if (e.target === cancel) finish(false);
        else if (e.target === wrap && downOnBack) finish(false);
      });

      document.body.appendChild(wrap);
      if (input) { input.focus(); input.select(); }
      else (o.danger && cancel ? cancel : ok).focus();
    });
  }
  // Víc oken najednou by se překrývalo: další počká, až se předchozí zavře
  function enqueue(o) {
    const p = queue.then(() => open(o));
    queue = p.catch(() => {});
    return p;
  }

  window.sbConfirm = (message, opts) => enqueue({ message, ok: 'Potvrdit', ...opts });
  window.sbPrompt = (message, value, opts) => enqueue({ message, value, input: true, ok: 'Uložit', ...opts });
  window.sbAlert = (message, opts) => enqueue({ message, noCancel: true, ...opts }).then(() => {});
})();

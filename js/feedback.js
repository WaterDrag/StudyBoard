// ═══ feedback.js — hlášení chyb (brouk na hlavní stránce) a Novinky v nastavení
// Hlášení jdou do kolekce bugReports: zapsat smí každý přihlášený jen za sebe, číst je jde jen
// ve Firebase konzoli (Firestore → bugReports). Klient je nečte, takže si je nikdo nemůže prohlížet.
// K hlášení se dá přiložit verze, stránka, prohlížeč a posledních pár chyb ze všech stránek
// (sbír je version.js do localStorage sb_errlog).
// Novinky: js/changelog.js (vygenerovaný z gitu) se načte až při otevření záložky.

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAX = 4000;

  // ── Nahlásit chybu ──────────────────────────────────────────
  function openReport() {
    const user = auth.currentUser;
    if (!user) return;
    $('bugModal')?.remove();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay open'; ov.id = 'bugModal';
    ov.innerHTML = `<div class="modal bug-modal" role="dialog" aria-labelledby="bugTitle">
        <div class="modal-header"><h3 id="bugTitle">Nahlásit chybu, nebo nápad</h3><button class="modal-close" data-x aria-label="Zavřít">✕</button></div>
        <div class="seg bug-kind" role="group" aria-label="Druh hlášení">
          <button type="button" class="seg-btn on" data-kind="bug">Chyba</button>
          <button type="button" class="seg-btn" data-kind="idea">Nápad na zlepšení</button>
        </div>
        <label class="label" for="bugText" id="bugLabel">Co se stalo?</label>
        <textarea id="bugText" class="input bug-text" maxlength="${MAX}" placeholder="Co jsi dělal(a), co se stalo a co jsi čekal(a). Třeba: V místnosti jsem přetáhl poznámku do složky a zmizela."></textarea>
        <div class="bug-count" id="bugCount">0 / ${MAX}</div>
        <label class="bug-tech"><input type="checkbox" id="bugTech" checked> Přiložit technické údaje (verze, prohlížeč, velikost obrazovky a poslední chyby aplikace)</label>
        <p class="bug-note">Hlášení uvidí jen autor StudyBoardu. Když bude potřebovat víc informací, ozve se ti na e-mail z účtu.</p>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-x>Zrušit</button><button type="button" class="btn btn-primary" id="bugSend">Odeslat</button></div>
      </div>`;
    document.body.appendChild(ov);
    let kind = 'bug';
    const text = $('bugText'), send = $('bugSend');
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('[data-x]')) { close(); return; }
      const k = e.target.closest('[data-kind]');
      if (!k) return;
      kind = k.dataset.kind;
      ov.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('on', b === k));
      $('bugLabel').textContent = kind === 'bug' ? 'Co se stalo?' : 'Co by šlo udělat líp?';
      text.placeholder = kind === 'bug'
        ? 'Co jsi dělal(a), co se stalo a co jsi čekal(a). Třeba: V místnosti jsem přetáhl poznámku do složky a zmizela.'
        : 'Co ti chybí nebo co by šlo udělat jednodušeji.';
    });
    text.addEventListener('input', () => { $('bugCount').textContent = `${text.value.length} / ${MAX}`; });
    send.addEventListener('click', async () => {
      const t = text.value.trim();
      if (t.length < 5) { toast('Napiš prosím aspoň pár slov, co se stalo.'); text.focus(); return; }
      send.disabled = true; send.textContent = 'Odesílám…';
      const tech = $('bugTech').checked;
      let errors = '';
      if (tech) { try { errors = (JSON.parse(localStorage.getItem('sb_errlog') || '[]') || []).slice(-8).map(e => `${e.t} ${e.p}: ${e.m}`).join('\n').slice(0, 3000); } catch (_) {} }
      const doc = {
        uid: user.uid,
        name: (user.displayName || '').slice(0, 100),
        email: (user.email || '').slice(0, 200),
        kind, text: t.slice(0, MAX),
        version: typeof APP_VERSION === 'string' ? APP_VERSION : '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (tech) Object.assign(doc, { ua: navigator.userAgent.slice(0, 400), screen: `${innerWidth}×${innerHeight} @${devicePixelRatio}`, errors });
      try {
        await db.collection('bugReports').add(doc);
        close();
        window.sfx?.('ok');
        toast(kind === 'bug' ? 'Díky! Chyba je nahlášená.' : 'Díky za nápad! Je odeslaný.');
      } catch (e) {
        send.disabled = false; send.textContent = 'Odeslat';
        toast('Hlášení se nepodařilo odeslat: ' + e.message);
      }
    });
    setTimeout(() => text.focus(), 50);
  }

  // ── Novinky ─────────────────────────────────────────────────
  const fmtDate = d => { const [y, m, dd] = d.split('-'); return `${+dd}. ${+m}. ${y}`; };
  let loading = null;
  function loadChangelog() {
    if (window.SB_CHANGELOG) return Promise.resolve();
    return loading || (loading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'js/changelog.js?v=' + (typeof APP_VERSION === 'string' ? APP_VERSION : '');
      s.onload = ok; s.onerror = () => { loading = null; no(new Error('Novinky se nepodařilo načíst.')); };
      document.head.appendChild(s);
    }));
  }
  let shown = 12;
  async function renderNews() {
    const box = $('newsList');
    if (!box) return;
    try { await loadChangelog(); } catch (e) { box.innerHTML = `<p class="set-text">${esc(e.message)}</p>`; return; }
    const all = window.SB_CHANGELOG || [];
    box.innerHTML = all.slice(0, shown).map(e => `<article class="news-item${e.v === APP_VERSION ? ' cur' : ''}">
        <header><b>v${esc(e.v)}</b><span>${fmtDate(e.d)}</span>${e.v === APP_VERSION ? '<i>tvoje verze</i>' : ''}</header>
        <ul>${e.t.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </article>`).join('') +
      (all.length > shown ? `<button type="button" class="btn btn-ghost btn-sm news-more" id="newsMore">Zobrazit starší (${all.length - shown})</button>` : '');
    $('newsMore')?.addEventListener('click', () => { shown += 25; renderNews(); });
  }
  function openNews() {
    $('settingsBtn')?.click();
    setTimeout(() => (typeof showSettingsTab === 'function') && showSettingsTab('news'), 0);
  }

  // Po aktualizaci jednou nabídnout, co je nového (poprvé se jen zapamatuje verze)
  function announceUpdate() {
    let seen = '';
    try { seen = localStorage.getItem('sb_seen_ver') || ''; localStorage.setItem('sb_seen_ver', APP_VERSION); } catch (_) { return; }
    // Jen když má verze v Novinkách záznam: drobné opravy se nasazují bez zápisu a hláška by vedla do prázdna
    if (seen && seen !== APP_VERSION) loadChangelog().then(() => {
      if ((window.SB_CHANGELOG || []).some(e => e.v === APP_VERSION)) toastWithButton(`StudyBoard je aktualizovaný na v${APP_VERSION}.`, 'Co je nového', openNews);
    }, () => {});
  }
  // Hláška s tlačítkem (stejný vzhled jako toastAction v místnosti), drží déle než běžná
  function toastWithButton(msg, label, fn) {
    const wrap = $('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast toast-with-action';
    const span = document.createElement('span'); span.textContent = msg;
    const btn = document.createElement('button'); btn.className = 'toast-action'; btn.textContent = label;
    btn.addEventListener('click', () => { el.remove(); fn(); });
    el.append(span, btn);
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('bugBtn')?.addEventListener('click', openReport);
    $('bugBtn2')?.addEventListener('click', () => { document.querySelector('[data-close="settingsModal"]')?.click(); openReport(); });
    document.querySelector('.hp-tab[data-set="news"]')?.addEventListener('click', renderNews);
    setTimeout(announceUpdate, 1500);
  });
  window.SBFeedback = { openReport, renderNews, openNews };
})();

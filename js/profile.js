// ═══ profile.js — vlastní jméno a profilovka (nastavení → Účet → Profil)
// Jméno a fotka se zapíšou do účtu Firebase (updateProfile), takže je všechny stránky čtou jako dřív
// z ME.displayName / ME.photoURL, a do users/{uid} (displayName, photoURL), odkud je čtou přátelé,
// žebříček a místnosti. Volba se navíc drží v users/{uid}.profile = { name, photo }: kdyby přihlášení
// přes Google vrátilo jeho jméno nebo fotku, při dalším otevření hlavní stránky se obnoví ta vlastní.
// photo: URL vlastní fotky, null = bez fotky (písmeno). Fotka se ořízne na čtverec 256 px a nahraje na imgBB.

(function () {
  const $ = id => document.getElementById(id);
  const NAME_MAX = 40;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const googlePhoto = u => (u?.providerData || []).find(p => p.providerId === 'google.com')?.photoURL || null;
  const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

  function avatarHtml(u) {
    const url = u?.photoURL;
    const letter = esc((u?.displayName || u?.email || '?').trim().charAt(0).toUpperCase() || '?');
    return /^https:\/\//.test(url || '') ? `<img src="${esc(url)}" alt="" referrerpolicy="no-referrer">` : letter;
  }
  // Hlavička hlavní stránky (avatar a jméno vpravo nahoře)
  function paintHeader(u) {
    const av = $('userAvatar'), nm = $('userName');
    if (av) av.innerHTML = avatarHtml(u);
    if (nm) nm.textContent = u.displayName || u.email || '';
    // Pozdrav „Dobrý večer, Jméno“ (dashboard.js ho píše jen při načtení)
    const gr = $('dashGreeting');
    if (gr) { const hello = gr.textContent.split(',')[0], first = String(u.displayName || '').trim().split(/\s+/)[0]; gr.textContent = first ? `${hello}, ${first}` : hello; }
  }
  function paintEditor() {
    const u = auth.currentUser;
    if (!u || !$('profAva')) return;
    $('profAva').innerHTML = avatarHtml(u);
    if (document.activeElement !== $('profName')) $('profName').value = u.displayName || '';
    $('profGoogleBtn').hidden = !googlePhoto(u) || u.photoURL === googlePhoto(u);
    $('profNoPhotoBtn').hidden = !u.photoURL;
  }

  // Uložit do účtu i profilu; fields: { displayName?, photoURL? (null = bez fotky) }
  async function apply(fields) {
    const u = auth.currentUser;
    if (!u) return;
    await u.updateProfile(fields);
    const prof = {};
    if ('displayName' in fields) prof['profile.name'] = fields.displayName;
    if ('photoURL' in fields) prof['profile.photo'] = fields.photoURL;
    await db.collection('users').doc(u.uid).set({
      displayName: u.displayName || u.email || 'Uživatel',
      photoURL: u.photoURL || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('users').doc(u.uid).update(prof).catch(() => {});
    paintHeader(u); paintEditor();
  }

  // Fotka → čtverec 256 px (střed obrázku) → JPEG → imgBB
  function squareBlob(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), out = 256;
        const c = document.createElement('canvas'); c.width = c.height = out;
        const g = c.getContext('2d');
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok(b) : no(new Error('Fotku se nepodařilo zpracovat.')), 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Tenhle soubor není obrázek, který prohlížeč umí otevřít.')); };
      img.src = url;
    });
  }
  async function uploadPhoto(file) {
    if (typeof IMGBB_KEY === 'undefined' || !IMGBB_KEY) throw new Error('Nahrávání obrázků není nastavené.');
    const form = new FormData();
    form.append('image', await squareBlob(file), 'profil.jpg');
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!json.success) throw new Error(json.error?.message || 'Nahrání fotky selhalo.');
    return json.data.url;
  }

  // Vlastní volba má přednost před tím, co vrátí Google při přihlášení
  async function ensure(u) {
    try {
      const p = (await db.collection('users').doc(u.uid).get()).data()?.profile;
      if (!p) return;
      const fix = {};
      if (p.name && p.name !== u.displayName) fix.displayName = p.name;
      if ('photo' in p && (p.photo || null) !== (u.photoURL || null)) fix.photoURL = p.photo || null;
      if (Object.keys(fix).length) await apply(fix);
    } catch (_) { /* profil je jen bonus */ }
  }

  function wire() {
    const btn = $('profPhotoBtn');
    if (!btn) return;
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
    document.body.appendChild(file);
    btn.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = '';
      if (!f) return;
      if (f.size > 15 * 1024 * 1024) { toast('Fotka je moc velká (víc než 15 MB).'); return; }
      btn.disabled = true; btn.textContent = 'Nahrávám…';
      try { await apply({ photoURL: await uploadPhoto(f) }); toast('Profilovka je změněná ✓'); }
      catch (e) { toast('Fotku se nepodařilo nastavit: ' + e.message); }
      btn.disabled = false; btn.textContent = 'Nahrát fotku';
    });
    $('profGoogleBtn').addEventListener('click', async () => {
      try { await apply({ photoURL: googlePhoto(auth.currentUser) }); toast('Profilovka je zase z Googlu.'); } catch (e) { toast('Nepovedlo se: ' + e.message); }
    });
    $('profNoPhotoBtn').addEventListener('click', async () => {
      try { await apply({ photoURL: null }); toast('Místo fotky se ukazuje první písmeno jména.'); } catch (e) { toast('Nepovedlo se: ' + e.message); }
    });
    const saveName = async () => {
      const u = auth.currentUser, name = cleanName($('profName').value);
      if (name.length < 2) { toast('Jméno musí mít aspoň 2 znaky.'); $('profName').focus(); return; }
      if (name === u.displayName) { toast('Jméno je uložené.'); return; }
      $('profSave').disabled = true;
      try { await apply({ displayName: name }); toast('Jméno je změněné ✓'); } catch (e) { toast('Jméno se nepodařilo uložit: ' + e.message); }
      $('profSave').disabled = false;
    };
    $('profSave').addEventListener('click', saveName);
    $('profName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });
    $('profName').maxLength = NAME_MAX;
    // Kliknutí na vlastní jméno v hlavičce otevře rovnou úpravu profilu
    const chip = document.querySelector('.user-chip');
    if (chip) {
      chip.style.cursor = 'pointer'; chip.title = 'Upravit profil'; chip.setAttribute('role', 'button'); chip.tabIndex = 0;
      const open = () => { $('settingsBtn')?.click(); setTimeout(() => window.showSettingsTab?.('account'), 0); };
      chip.addEventListener('click', open);
      chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
    document.querySelector('.hp-tab[data-set="account"]')?.addEventListener('click', paintEditor);
    $('settingsBtn')?.addEventListener('click', () => setTimeout(paintEditor, 0));
  }

  document.addEventListener('DOMContentLoaded', wire);
  auth.onAuthStateChanged(u => { if (u) { ensure(u); setTimeout(paintEditor, 0); } });
  window.SBProfile = { apply, ensure, paintEditor };
})();

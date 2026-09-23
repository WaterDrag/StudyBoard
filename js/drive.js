// ═══ drive.js — Ukládání do vlastní složky na Google Disku
// Rozsah `drive.file`: StudyBoard vidí JEN soubory, které sám vytvořil.
// Do zbytku Disku se nedostane, takže to Google nemusí schvalovat a uživatel
// neriskuje nic nad rámec téhle jedné složky.
//
// Žádná knihovna Googlu se nenačítá dopředu — skript `accounts.google.com`
// se dotáhne až při prvním použití, aby stránka nemusela nic stahovat kvůli
// funkci, kterou většina lidí nepoužije.

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let DRIVE_TOKEN = null;          // { token, exp } — jen v paměti, záměrně
let DRIVE_FOLDER = null;         // id složky StudyBoard
let DRIVE_GIS = null;            // načtený token client

function driveConfigured() {
  return typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.trim().length > 10;
}

// Chybí-li Client ID, nemá smysl nic zkoušet — řekni rovnou, co udělat.
function driveSetupHint() {
  return 'Google Disk zatím není nastavený. V js/config.js chybí GOOGLE_CLIENT_ID — '
       + 'vyrob ho v Google Cloud konzoli (OAuth Client ID typu „Webová aplikace") '
       + 'a povol v něm adresy, odkud StudyBoard běží.';
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (DRIVE_GIS) return DRIVE_GIS;
  DRIVE_GIS = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { DRIVE_GIS = null; reject(new Error('Skript Googlu se nepodařilo načíst.')); };
    document.head.appendChild(s);
  });
  return DRIVE_GIS;
}

// Platný token, nebo vyžádej nový. `interactive: false` zkusí tiché obnovení
// (uživatel uvidí okno jen poprvé nebo když vyprší souhlas).
async function driveToken(interactive = true) {
  if (!driveConfigured()) throw new Error(driveSetupHint());
  if (DRIVE_TOKEN && DRIVE_TOKEN.exp > Date.now() + 60000) return DRIVE_TOKEN.token;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      prompt: interactive ? '' : 'none',
      callback: res => {
        if (res.error) { reject(new Error('Přihlášení k Disku se nepovedlo: ' + res.error)); return; }
        DRIVE_TOKEN = { token: res.access_token, exp: Date.now() + (res.expires_in || 3600) * 1000 };
        resolve(DRIVE_TOKEN.token);
      },
      error_callback: err => reject(new Error(err?.type === 'popup_closed'
        ? 'Okno přihlášení bylo zavřené.' : 'Přihlášení k Disku selhalo.')),
    });
    client.requestAccessToken();
  });
}

function driveSignedIn() { return !!(DRIVE_TOKEN && DRIVE_TOKEN.exp > Date.now()); }

function driveSignOut() {
  const t = DRIVE_TOKEN?.token;
  DRIVE_TOKEN = null; DRIVE_FOLDER = null;
  if (t && window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(t, () => {}); } catch (_) {}
  }
}

async function driveFetch(url, opts = {}) {
  const token = await driveToken();
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    // Token vypršel dřív, než jsme čekali — zahoď ho a zkus jednou znovu.
    DRIVE_TOKEN = null;
    const fresh = await driveToken();
    return fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + fresh, ...(opts.headers || {}) } });
  }
  return res;
}

async function driveJson(url, opts) {
  const res = await driveFetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || ('Disk odpověděl ' + res.status));
  return data;
}

// Najdi složku StudyBoard, nebo ji založ. Hledá se jen mezi soubory, které
// appka vytvořila (víc `drive.file` nevidí), takže cizí stejnojmennou složku
// nepřepíšeme — vznikne vlastní.
async function driveFolder() {
  if (DRIVE_FOLDER) return DRIVE_FOLDER;
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.folder' and name='" + DRIVE_FOLDER_NAME +
    "' and trashed=false");
  const found = await driveJson(
    'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&pageSize=1');
  if (found.files && found.files.length) { DRIVE_FOLDER = found.files[0].id; return DRIVE_FOLDER; }
  const made = await driveJson('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  DRIVE_FOLDER = made.id;
  return DRIVE_FOLDER;
}

// Nahraj soubor do složky. Multipart: metadata + obsah v jednom požadavku.
async function driveUpload(name, content, mime = 'text/plain') {
  const parent = await driveFolder();
  const boundary = 'sbx' + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name, parents: [parent] });
  const body =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta +
    '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n' + content +
    '\r\n--' + boundary + '--';
  return driveJson(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
    { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
}

async function driveList() {
  const parent = await driveFolder();
  const q = encodeURIComponent("'" + parent + "' in parents and trashed=false");
  const data = await driveJson('https://www.googleapis.com/drive/v3/files?q=' + q +
    '&orderBy=modifiedTime desc&pageSize=100' +
    '&fields=files(id,name,size,mimeType,modifiedTime,webViewLink)');
  return data.files || [];
}

async function driveDownload(fileId) {
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media');
  if (!res.ok) throw new Error('Stažení selhalo (' + res.status + ')');
  return res.text();
}

async function driveDelete(fileId) {
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('Smazání selhalo (' + res.status + ')');
}

function driveFileSize(bytes) {
  const n = +bytes;
  if (!n) return '';
  return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' kB' : (n / 1048576).toFixed(1) + ' MB';
}

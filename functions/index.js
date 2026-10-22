const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldPath, FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { onRequest } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();

const API_TOKEN_PREFIX = 'sbai_';
const TOKEN_COLLECTION = 'agentInvites';
const ALLOWED_SCOPES = new Set(['notes:read', 'notes:write', 'comments:write']);
const ALLOWED_EXPIRY_HOURS = new Set([1, 24, 168, 720]);
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;
const NOTE_FIELDS = [
  'title', 'content', 'contentType', 'kind', 'noteIds', 'links', 'main', 'pages',
  'createdAt', 'updatedAt', 'authorName', 'commentCount', 'tableData',
  'x', 'y', 'color', 'hsize', 'hcolor',
];
const MAX_NOTE_CONTENT_LENGTH = 100_000;

// Mřížka pro agenty: plocha je rozdělená na buňky, aby poznámky od agenta
// stály v úhledných sloupcích a nepřekrývaly se. Lísteček je 220 px široký,
// buňka má rezervu na mezery. Řádek 0 je určený pro nadpisy sloupců.
const GRID = { originX: 60, originY: 60, cellW: 260, cellH: 180, cols: 8, maxRows: 400 };
const cellToXY = (col, row) => ({ x: GRID.originX + col * GRID.cellW, y: GRID.originY + row * GRID.cellH });

// Které buňky už něco zabírá. Lísteček bez názvu ukazuje na ploše celý text,
// takže počítáme, že zabere dvě buňky pod sebou.
async function occupiedCells(roomId) {
  const snap = await db.collection('rooms').doc(roomId).collection('notes').select('x', 'y', 'title', 'kind').get();
  const taken = new Set();
  snap.docs.forEach(doc => {
    const n = doc.data();
    const col = Math.round(((n.x || 60) - GRID.originX) / GRID.cellW);
    const row = Math.round(((n.y || 60) - GRID.originY) / GRID.cellH);
    const rows = n.kind === 'heading' || n.title ? 1 : 2;
    for (let r = 0; r < rows; r++) taken.add(col + ':' + (row + r));
  });
  return taken;
}

function freeRowInColumn(taken, col, fromRow) {
  for (let r = fromRow; r < GRID.maxRows; r++) if (!taken.has(col + ':' + r)) return r;
  throw new ApiError(409, 'Ve sloupci už není volné místo.');
}

async function getLayout(req, res, roomId) {
  await requireAgent(req, roomId, 'notes:read');
  const taken = await occupiedCells(roomId);
  const columns = [];
  for (let c = 0; c < GRID.cols; c++) {
    let used = 0;
    for (let r = 0; r < GRID.maxRows; r++) if (taken.has(c + ':' + r)) used = r + 1;
    columns.push({ col: c, nextFreeRow: freeRowInColumn(taken, c, 1), usedRows: used });
  }
  res.json({
    grid: { cellWidth: GRID.cellW, cellHeight: GRID.cellH, columns: GRID.cols, headingRow: 0 },
    howTo: 'POST note with {"col":N} → placed at the next free row of column N. {"col":N,"row":R} → exact cell. ' +
      '{"kind":"heading","title":"...","col":N} → column heading in row 0. Without col/row/x/y → next free cell, left to right.',
    columns,
  });
}
const MAX_NOTE_TITLE_LENGTH = 300;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(res, error) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : 'Interní chyba serveru.';
  if (status === 500) console.error('agentApi request failed:', error?.message || 'unknown error');
  res.status(status).json({ error: message });
}

function bearerToken(req) {
  const header = String(req.get('authorization') || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function requestPath(req) {
  let path = String(req.path || '/');
  // Depending on the Cloud Functions proxy, the function name may or may not
  // remain in the path. Accept both shapes, but only route under /v1.
  const versionAt = path.indexOf('/v1/');
  if (versionAt >= 0) path = path.slice(versionAt);
  else if (path.endsWith('/v1')) path = '/v1';
  return path.replace(/\/+$/, '') || '/';
}

function decodeParts(path) {
  try {
    const parts = path.split('/').filter(Boolean).map(part => decodeURIComponent(part));
    // Firestore document IDs cannot contain `/`. Reject encoded separators
    // before they reach the Admin SDK so they cannot change route semantics.
    if (parts.some(part => part.includes('/'))) throw new ApiError(400, 'Neplatná cesta požadavku.');
    return parts;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Neplatná cesta požadavku.');
  }
}

function toIso(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : null;
}

function safeInvite(doc) {
  const data = doc.data();
  const expiresAt = toIso(data.expiresAt);
  const revokedAt = toIso(data.revokedAt);
  const status = revokedAt ? 'revoked' : (expiresAt && Date.parse(expiresAt) <= Date.now() ? 'expired' : 'active');
  return {
    id: doc.id,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    createdAt: toIso(data.createdAt),
    expiresAt,
    lastUsedAt: toIso(data.lastUsedAt),
    status,
  };
}

function publicNote(id, data) {
  const note = { id };
  NOTE_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(data, field)) note[field] = serialise(data[field]);
  });
  return note;
}

function serialise(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

function validateObjectBody(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Tělo požadavku musí být JSON objekt.');
  }
  const unknownFields = Object.keys(body).filter(field => !allowedFields.has(field));
  if (unknownFields.length) throw new ApiError(400, `Nepodporovaná pole: ${unknownFields.join(', ')}.`);
}

function validateTitle(body, required = false) {
  if (!Object.prototype.hasOwnProperty.call(body, 'title')) {
    if (required) throw new ApiError(400, 'Název poznámky je povinný.');
    return undefined;
  }
  if (body.title === null && !required) return null;
  if (typeof body.title !== 'string' || body.title.length > MAX_NOTE_TITLE_LENGTH) {
    throw new ApiError(400, `Název může mít nejvýše ${MAX_NOTE_TITLE_LENGTH} znaků.`);
  }
  const title = body.title.trim();
  if (!title && required) throw new ApiError(400, 'Název poznámky nesmí být prázdný.');
  return title || null;
}

function validateContent(body, required = false) {
  if (!Object.prototype.hasOwnProperty.call(body, 'content')) {
    if (required) throw new ApiError(400, 'Obsah poznámky je povinný.');
    return undefined;
  }
  if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > MAX_NOTE_CONTENT_LENGTH) {
    throw new ApiError(400, `Obsah musí mít 1 až ${MAX_NOTE_CONTENT_LENGTH} znaků.`);
  }
  return body.content;
}

// Agent content is plain text, escaped before storing so note rendering can
// keep using the app's HTML editor without allowing untrusted markup/scripts.
function plainTextToSafeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

// Obrázky od agenta: z Wikimedia Commons a ImgBB (kam nahrává i aplikace) se
// odkazují přímo, z jakékoliv jiné veřejné https adresy si server obrázek stáhne,
// ověří a uloží kopii na ImgBB — v poznámce pak nezmizí, ani když zdroj zmizí.
// Do HTML jde jen námi sestavený <img> s escapovanou adresou a popiskem.
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'i.ibb.co']);
const IMGBB_KEY = process.env.IMGBB_KEY || '35d2aa02584eaf0848eb0b70a4d78686';   // stejný veřejný klíč jako v js/config.js
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGES = 4;
const MAX_CAPTION_LENGTH = 300;

function validateImages(body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'images')) return undefined;
  const images = body.images;
  if (!Array.isArray(images) || !images.length || images.length > MAX_IMAGES) {
    throw new ApiError(400, `images musí být pole s 1 až ${MAX_IMAGES} obrázky.`);
  }
  return images.map(image => {
    if (!image || typeof image !== 'object' || Array.isArray(image)) throw new ApiError(400, 'Obrázek musí být objekt {url, caption}.');
    const extra = Object.keys(image).filter(k => k !== 'url' && k !== 'caption');
    if (extra.length) throw new ApiError(400, `Nepovolené pole u obrázku: ${extra.join(', ')}.`);
    let url;
    try { url = new URL(image.url); } catch (_) { throw new ApiError(400, 'Adresa obrázku není platná URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
      throw new ApiError(400, 'Obrázek musí mít veřejnou adresu https://… (bez jména, hesla a jiného portu).');
    }
    const caption = image.caption === undefined ? '' : image.caption;
    if (typeof caption !== 'string' || caption.length > MAX_CAPTION_LENGTH) {
      throw new ApiError(400, `Popisek obrázku může mít nejvýše ${MAX_CAPTION_LENGTH} znaků.`);
    }
    return { url: url.href, caption: caption.trim() };
  });
}

// Soukromé, místní a speciální adresy (ochrana před přístupem do vnitřní sítě serveru)
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') ||
    v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}
async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$/i.test(host) || /\.(local|internal|localhost)$/i.test(host)) throw new Error('neveřejná adresa');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('neveřejná adresa');
}
// Typ obrázku podle prvních bajtů (Content-Type se dá zfalšovat). SVG záměrně ne — může obsahovat skripty.
function sniffImage(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 6 && buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
async function downloadImage(href) {
  let url = new URL(href);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' || (url.port && url.port !== '443')) throw new Error('přesměrování mimo https');
    await assertPublicHost(url.hostname);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'StudyBoardImageBot/1.0 (+https://vstudyboard.duckdns.org)', Accept: 'image/*' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location'), url); continue; }
    if (!res.ok) throw new Error(`server vrátil ${res.status}`);
    if (Number(res.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) throw new Error('obrázek je větší než 8 MB');
    const reader = res.body.getReader(), chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_IMAGE_BYTES) { reader.cancel().catch(() => {}); throw new Error('obrázek je větší než 8 MB'); }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    if (!sniffImage(buf)) throw new Error('není to obrázek PNG, JPEG, GIF ani WebP');
    return buf;
  }
  throw new Error('příliš mnoho přesměrování');
}
async function storeOnImgbb(buf) {
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST', body: new URLSearchParams({ image: buf.toString('base64') }), signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  const out = json?.data?.url;
  if (!res.ok || !out || new URL(out).hostname !== 'i.ibb.co') throw new Error('nepodařilo se uložit kopii');
  return out;
}
// Obrázky mimo ověřené hostingy se stáhnou a uloží jako kopie na ImgBB.
async function importImages(images) {
  if (!images) return images;
  return Promise.all(images.map(async (img, i) => {
    if (IMAGE_HOSTS.has(new URL(img.url).hostname)) return img;
    try { return { ...img, url: await storeOnImgbb(await downloadImage(img.url)) }; }
    catch (e) { throw new ApiError(400, `Obrázek ${i + 1} (${img.url}) se nepodařilo převzít: ${e.message || e}.`); }
  }));
}

function imageToSafeHtml({ url, caption }) {
  const alt = plainTextToSafeHtml(caption);
  const img = `<img src="${plainTextToSafeHtml(url)}" alt="${alt}" ` +
    'style="width:100%;max-width:360px;border-radius:6px;display:block;margin:0;">';
  const cap = caption ? `<div style="font-size:12px;opacity:.7;margin-top:3px;">${alt}</div>` : '';
  return `<div style="margin:8px 0 10px;">${img}${cap}</div>`;
}

// Řádek obsahující jen [[img1]], [[img2]] … vloží daný obrázek na to místo
// v textu. Obrázky, na které text neodkazuje, se dají nad text.
const IMAGE_MARKER = /^\s*\[\[img(\d+)\]\]\s*$/;

function agentContentHtml(content, images) {
  const used = new Set();
  const parts = content.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const m = IMAGE_MARKER.exec(line);
    if (!m) return { text: plainTextToSafeHtml(line) };
    const i = Number(m[1]) - 1;
    if (!images || !images[i]) throw new ApiError(400, `Značka [[img${m[1]}]] odkazuje na obrázek, který v poli images není.`);
    used.add(i);
    return { block: imageToSafeHtml(images[i]) };
  });
  const top = (images || []).filter((_, i) => !used.has(i)).map(imageToSafeHtml).join('');
  // <br> jen mezi dvěma řádky textu — obrázek je blok a zalomí si sám.
  return top + parts.map((p, i) => {
    if (p.block) return p.block;
    return (i > 0 && parts[i - 1].text !== undefined ? '<br>' : '') + p.text;
  }).join('');
}

async function requireRoomOwner(req, roomId) {
  const token = bearerToken(req);
  if (!token || token.startsWith(API_TOKEN_PREFIX)) {
    throw new ApiError(401, 'Přihlas se jako vlastník místnosti.');
  }

  let claims;
  try {
    claims = await getAuth().verifyIdToken(token, true);
  } catch (_) {
    throw new ApiError(401, 'Přihlášení vypršelo. Obnov stránku a zkus to znovu.');
  }

  const roomSnap = await db.collection('rooms').doc(roomId).get();
  if (!roomSnap.exists) throw new ApiError(404, 'Místnost nebyla nalezena.');
  const room = roomSnap.data();
  if (room.ownerId !== claims.uid || room.roles?.[claims.uid] !== 'owner') {
    throw new ApiError(403, 'Agentní pozvánky může spravovat jen vlastník místnosti.');
  }
  return claims.uid;
}

async function createAgentInvite(req, res, roomId) {
  const ownerUid = await requireRoomOwner(req, roomId);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const expiresInHours = Number(body.expiresInHours);
  if (!ALLOWED_EXPIRY_HOURS.has(expiresInHours)) {
    throw new ApiError(400, 'Vyber platnost 1 hodina, 1 den, 7 dní nebo 30 dní.');
  }

  const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes)] : [];
  if (!scopes.includes('notes:read') || scopes.some(scope => !ALLOWED_SCOPES.has(scope))) {
    throw new ApiError(400, 'Agent musí mít oprávnění číst poznámky; ostatní oprávnění nejsou platná.');
  }

  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const inviteId = crypto.randomBytes(12).toString('hex');
  const expiresAt = Timestamp.fromMillis(Date.now() + expiresInHours * 3_600_000);
  const ref = db.collection(TOKEN_COLLECTION).doc(inviteId);
  await ref.create({
    roomId,
    createdBy: ownerUid,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    scopes,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    revokedAt: null,
    rateWindowStartedAt: 0,
    rateCount: 0,
  });

  res.status(201).json({
    token,
    invite: {
      id: inviteId,
      scopes,
      expiresAt: expiresAt.toDate().toISOString(),
      status: 'active',
    },
  });
}

async function listAgentInvites(req, res, roomId) {
  await requireRoomOwner(req, roomId);
  const snap = await db.collection(TOKEN_COLLECTION)
    .where('roomId', '==', roomId)
    .limit(100)
    .get();
  const invites = snap.docs.map(safeInvite)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  res.json({ invites });
}

async function revokeAgentInvite(req, res, roomId, inviteId) {
  const ownerUid = await requireRoomOwner(req, roomId);
  const ref = db.collection(TOKEN_COLLECTION).doc(inviteId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().roomId !== roomId) throw new ApiError(404, 'Pozvánka nebyla nalezena.');
  if (!snap.data().revokedAt) {
    await ref.update({
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: ownerUid,
    });
  }
  res.json({ ok: true });
}

async function requireAgent(req, roomId, scope) {
  const token = bearerToken(req);
  if (!token.startsWith(API_TOKEN_PREFIX) || token.length > 100) {
    throw new ApiError(401, 'Chybí platný agentní token v hlavičce Authorization: Bearer.');
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const matches = await db.collection(TOKEN_COLLECTION)
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();
  if (matches.empty) throw new ApiError(401, 'Agentní token není platný.');

  const ref = matches.docs[0].ref;
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw new ApiError(401, 'Agentní token není platný.');
    const data = current.data();
    if (data.revokedAt) throw new ApiError(401, 'Tato agentní pozvánka byla zrušena.');
    if (!data.expiresAt || data.expiresAt.toMillis() <= Date.now()) {
      throw new ApiError(401, 'Platnost agentní pozvánky vypršela.');
    }
    if (data.roomId !== roomId) throw new ApiError(403, 'Tento token nemá přístup do požadované místnosti.');
    if (!Array.isArray(data.scopes) || !data.scopes.includes(scope)) {
      throw new ApiError(403, 'Agent nemá potřebné oprávnění.');
    }

    const now = Date.now();
    const oldStart = Number(data.rateWindowStartedAt) || 0;
    const resetWindow = now - oldStart >= RATE_WINDOW_MS;
    const count = resetWindow ? 0 : (Number(data.rateCount) || 0);
    if (count >= MAX_REQUESTS_PER_MINUTE) {
      throw new ApiError(429, 'Limit je 60 požadavků za minutu. Zkus to prosím za chvíli.');
    }
    tx.update(ref, {
      rateWindowStartedAt: resetWindow ? now : oldStart,
      rateCount: count + 1,
      lastUsedAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id, ...data };
  });
}

async function getNotes(req, res, roomId) {
  await requireAgent(req, roomId, 'notes:read');
  const requestedLimit = Number(req.query.limit) || 100;
  const limit = Math.max(1, Math.min(200, Math.floor(requestedLimit)));
  const notesRef = db.collection('rooms').doc(roomId).collection('notes');
  let query = notesRef.orderBy(FieldPath.documentId()).limit(limit + 1);
  const cursor = String(req.query.cursor || '');
  if (cursor) {
    const cursorSnap = await notesRef.doc(cursor).get();
    if (!cursorSnap.exists) throw new ApiError(400, 'Stránkovací kurzor nebyl nalezen.');
    query = notesRef.orderBy(FieldPath.documentId()).startAfter(cursorSnap).limit(limit + 1);
  }
  const snap = await query.get();
  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;
  res.json({
    notes: docs.map(doc => publicNote(doc.id, doc.data())),
    nextCursor: hasMore ? docs[docs.length - 1].id : null,
  });
}

async function getNote(req, res, roomId, noteId) {
  await requireAgent(req, roomId, 'notes:read');
  const snap = await db.collection('rooms').doc(roomId).collection('notes').doc(noteId).get();
  if (!snap.exists) throw new ApiError(404, 'Poznámka nebyla nalezena.');
  res.json({ note: publicNote(snap.id, snap.data()) });
}

async function createAgentNote(req, res, roomId) {
  const invite = await requireAgent(req, roomId, 'notes:write');
  const body = req.body;
  validateObjectBody(body, new Set(['title', 'content', 'images', 'x', 'y', 'color', 'col', 'row', 'kind']));
  const has = k => Object.prototype.hasOwnProperty.call(body, k);
  const heading = body.kind === 'heading';
  if (has('kind') && !heading) throw new ApiError(400, 'kind může být jen "heading" (nadpis sloupce).');
  const title = validateTitle(body, heading);
  const content = heading ? '' : validateContent(body, true);
  if (heading && validateImages(body)) throw new ApiError(400, 'Nadpis nemůže mít obrázky.');
  const images = await importImages(validateImages(body));
  let x = 60;
  let y = 60;
  const isCell = v => Number.isInteger(v) && v >= 0;
  if (has('col') || has('row')) {
    if (has('x') || has('y')) throw new ApiError(400, 'Pošli buď col/row, nebo x/y — ne obojí.');
    if (has('col') && (!isCell(body.col) || body.col >= GRID.cols)) throw new ApiError(400, `col musí být celé číslo 0–${GRID.cols - 1}.`);
    if (has('row') && (!isCell(body.row) || body.row >= GRID.maxRows)) throw new ApiError(400, `row musí být celé číslo 0–${GRID.maxRows - 1}.`);
    const col = has('col') ? body.col : 0;
    let row = has('row') ? body.row : null;
    if (row === null) row = heading ? 0 : freeRowInColumn(await occupiedCells(roomId), col, 1);
    ({ x, y } = cellToXY(col, row));
  } else if (has('x') || has('y')) {
    if (!Number.isFinite(body.x) || !Number.isFinite(body.y) || Math.abs(body.x) > 100_000 || Math.abs(body.y) > 100_000) {
      throw new ApiError(400, 'Souřadnice x a y musí být čísla v rozsahu −100 000 až 100 000.');
    }
    x = Math.round(body.x);
    y = Math.round(body.y);
  } else {
    // Bez pozice: první volná buňka zleva doprava, shora dolů (řádek 0 nechá nadpisům).
    const taken = await occupiedCells(roomId);
    let found = null;
    for (let r = heading ? 0 : 1; r < GRID.maxRows && !found; r++) {
      for (let c = 0; c < GRID.cols; c++) if (!taken.has(c + ':' + r)) { found = { c, r }; break; }
    }
    if (!found) throw new ApiError(409, 'Na ploše už není volné místo.');
    ({ x, y } = cellToXY(found.c, found.r));
  }
  const color = body.color === undefined ? '#fef9c3' : body.color;
  if (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color)) {
    throw new ApiError(400, 'Barva musí být ve formátu #RRGGBB.');
  }

  const noteRef = db.collection('rooms').doc(roomId).collection('notes').doc();
  await noteRef.create({
    title: title || null,
    content: heading ? '' : agentContentHtml(content, images),
    contentType: 'html',
    ...(heading ? { kind: 'heading', hsize: 30 } : {}),
    color,
    x,
    y,
    authorId: `agent_${invite.id}`,
    authorName: 'AI agent',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ ok: true, noteId: noteRef.id, x, y });
}

async function updateAgentNote(req, res, roomId, noteId) {
  await requireAgent(req, roomId, 'notes:write');
  const body = req.body;
  validateObjectBody(body, new Set(['title', 'content', 'images']));
  const title = validateTitle(body);
  const content = validateContent(body);
  if (validateImages(body) && content === undefined) throw new ApiError(400, 'Obrázky pošli spolu s polem content (obsah se nahrazuje celý).');
  const images = await importImages(validateImages(body));
  if (title === undefined && content === undefined) {
    throw new ApiError(400, 'Zadej alespoň jedno pole: title nebo content.');
  }

  const noteRef = db.collection('rooms').doc(roomId).collection('notes').doc(noteId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(noteRef);
    if (!snap.exists) throw new ApiError(404, 'Poznámka nebyla nalezena.');
    const note = snap.data();
    if (content !== undefined && (Array.isArray(note.pages) || note.tableData)) {
      throw new ApiError(400, 'Agentní API zatím upravuje obsah jen u běžných textových poznámek.');
    }
    const patch = { updatedAt: FieldValue.serverTimestamp() };
    if (title !== undefined) patch.title = title;
    if (content !== undefined) {
      if (note.kind === 'heading') throw new ApiError(400, 'U nadpisu může agent změnit jen pole title.');
      patch.content = agentContentHtml(content, images);
      patch.contentType = 'html';
    }
    tx.update(noteRef, patch);
  });
  res.json({ ok: true, noteId });
}

async function addComment(req, res, roomId, noteId) {
  const invite = await requireAgent(req, roomId, 'comments:write');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 2000) throw new ApiError(400, 'Komentář musí mít 1 až 2 000 znaků.');

  const noteRef = db.collection('rooms').doc(roomId).collection('notes').doc(noteId);
  const commentRef = noteRef.collection('comments').doc();
  await db.runTransaction(async tx => {
    const note = await tx.get(noteRef);
    if (!note.exists) throw new ApiError(404, 'Poznámka nebyla nalezena.');
    if (note.data().kind === 'heading') throw new ApiError(400, 'Ke kapitole bez obsahu nelze přidat komentář.');
    tx.create(commentRef, {
      text,
      authorId: `agent_${invite.id}`,
      authorName: 'AI agent',
      authorPhoto: null,
      at: FieldValue.serverTimestamp(),
    });
    tx.update(noteRef, { commentCount: FieldValue.increment(1) });
  });
  res.status(201).json({ ok: true, commentId: commentRef.id });
}

exports.agentApi = onRequest({
  region: 'europe-west1',
  maxInstances: 3,
  // Agents can call the API from their own runtime/origin. CORS is not the
  // access check: every management request needs Firebase auth and every
  // agent request needs its scoped bearer token.
  cors: true,
}, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const parts = decodeParts(requestPath(req));
    if (parts[0] !== 'v1') throw new ApiError(404, 'Endpoint nebyl nalezen.');

    if (parts[1] === 'rooms' && parts[2] && parts[3] === 'agent-invites') {
      const roomId = parts[2];
      if (parts.length === 4 && req.method === 'POST') return await createAgentInvite(req, res, roomId);
      if (parts.length === 4 && req.method === 'GET') return await listAgentInvites(req, res, roomId);
      if (parts.length === 5 && req.method === 'DELETE') return await revokeAgentInvite(req, res, roomId, parts[4]);
      throw new ApiError(405, 'Tato metoda není pro pozvánky podporována.');
    }

    if (parts[1] === 'rooms' && parts[2] && parts[3] === 'layout' && parts.length === 4) {
      if (req.method === 'GET') return await getLayout(req, res, parts[2]);
      throw new ApiError(405, 'Tato metoda není pro rozložení podporována.');
    }

    if (parts[1] === 'rooms' && parts[2] && parts[3] === 'notes') {
      const roomId = parts[2];
      if (parts.length === 4 && req.method === 'GET') return await getNotes(req, res, roomId);
      if (parts.length === 4 && req.method === 'POST') return await createAgentNote(req, res, roomId);
      if (parts.length === 5 && req.method === 'GET') return await getNote(req, res, roomId, parts[4]);
      if (parts.length === 5 && req.method === 'PATCH') return await updateAgentNote(req, res, roomId, parts[4]);
      if (parts.length === 6 && parts[5] === 'comments' && req.method === 'POST') {
        return await addComment(req, res, roomId, parts[4]);
      }
      throw new ApiError(405, 'Tato metoda není pro poznámky podporována.');
    }

    throw new ApiError(404, 'Endpoint nebyl nalezen.');
  } catch (error) {
    sendError(res, error);
  }
});

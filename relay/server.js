// ═══ sb-relay — rychlá cesta pro online hry StudyBoardu (Obrana království co-op)
// Běží na Oracle serveru vedle GameHubu (port 3100, Caddy: vgamehub.duckdns.org/sb/* → sem).
// Nic nesimuluje: hostitel posílá snímky (krok simulace + akce), server je rozešle ostatním v místnosti;
// hráči posílají žádosti o akce a server je předá hostiteli. Firebase RTDB zůstává jako záloha —
// prohlížeče zapisují i tam, takže když tenhle server neběží, hra jede dál jako dřív.
//
// Kdo smí dovnitř: Firebase ID token (ověřený proti veřejným klíčům Googlu) + uid musí být v tdGames/{id}
// ve Firestore (playerIds / hostUid). Snímky přijímá jen od hostitele. Dokument se čte REST API
// s tokenem hráče, takže server nepotřebuje žádný servisní klíč.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PORT = +process.env.PORT || 3100;
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'studypage-1f2f8';
const DEV = process.env.SB_DEV === '1';   // jen lokální test: token "dev:uid", hra se nekontroluje
const ORIGINS = new Set(['https://vstudyboard.duckdns.org', 'https://waterdrag.github.io', ...(DEV ? ['http://localhost:5500', 'null'] : [])]);
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const KEEP_FRAMES = 600;          // kolik posledních snímků držet pro hráče, kteří se znovu připojí
const ROOM_IDLE_MS = 10 * 60e3;   // prázdná místnost zmizí po 10 minutách
const MSG_PER_SEC = 80;           // ochrana proti zahlcení

const rooms = new Map();   // klíč → { key, host, members:Set, socks:Map<uid, Set<ws>>, frames:Map<n, json>, empty:ts }
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function verifyToken(token) {
  if (DEV && typeof token === 'string' && token.startsWith('dev:')) return token.slice(4);
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT });
  if (!payload.sub) throw new Error('token bez uid');
  return payload.sub;
}
// tdGames/{gid}: kdo hraje a kdo je hostitel (čte se s tokenem hráče — pravidla to dovolují přihlášeným)
async function loadGame(gid, token) {
  if (DEV) return { host: 'host', members: new Set(['host', 'p2', 'p3']) };
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tdGames/${encodeURIComponent(gid)}` +
    '?mask.fieldPaths=hostUid&mask.fieldPaths=playerIds';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('hra nenalezena (' + r.status + ')');
  const d = await r.json(), f = d.fields || {};
  const host = f.hostUid?.stringValue;
  const members = new Set((f.playerIds?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean));
  if (host) members.add(host);
  return { host, members };
}

function send(ws, obj) { if (ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function toOthers(room, uid, data) { room.socks.forEach((set, u) => { if (u !== uid) set.forEach(w => send(w, data)); }); }

async function onJoin(ws, m) {
  if (ws.room) return send(ws, { t: 'err', m: 'už jsi v místnosti' });
  if (m.kind !== 'td' || typeof m.gid !== 'string' || !/^[\w-]{4,64}$/.test(m.gid)) return send(ws, { t: 'err', m: 'špatná místnost' });
  let uid;
  try { uid = await verifyToken(m.token); } catch (e) { return send(ws, { t: 'err', m: 'přihlášení neplatí' }); }
  const key = 'td:' + m.gid;
  let room = rooms.get(key);
  if (!room || !room.members.has(uid)) {   // nová místnost, nebo hráč, kterého ještě neznáme → zeptat se Firestore
    let g;
    try { g = await loadGame(m.gid, m.token); } catch (e) { return send(ws, { t: 'err', m: String(e.message || e) }); }
    if (!g.members.has(uid)) return send(ws, { t: 'err', m: 'v téhle hře nejsi' });
    room = rooms.get(key) || { key, socks: new Map(), frames: new Map(), empty: 0 };
    room.host = g.host; room.members = g.members;
    rooms.set(key, room);
  }
  ws.room = room; ws.uid = uid;
  if (!room.socks.has(uid)) room.socks.set(uid, new Set());
  room.socks.get(uid).add(ws);
  room.empty = 0;
  send(ws, { t: 'ok', host: uid === room.host });
  // dohnat, co hráč zmeškal (znovupřipojení)
  const since = Math.max(0, +m.since || 0);
  [...room.frames.keys()].filter(n => n >= since).sort((a, b) => a - b).forEach(n => send(ws, room.frames.get(n)));
  log('join', key, uid, uid === room.host ? '(host)' : '', 'online', room.socks.size);
}

function onMessage(ws, raw) {
  const now = Date.now();
  if (now - (ws.rateT || 0) > 1000) { ws.rateT = now; ws.rateN = 0; }
  if (++ws.rateN > MSG_PER_SEC) return;
  let m; try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m !== 'object') return;
  if (m.t === 'join') return void onJoin(ws, m);
  if (m.t === 'ping') return send(ws, { t: 'pong', c: m.c });
  const room = ws.room; if (!room) return;
  if (m.t === 'f') {   // snímek — jen od hostitele
    if (ws.uid !== room.host || !m.f || !Number.isInteger(m.f.n)) return;
    const data = JSON.stringify({ t: 'f', f: m.f });
    room.frames.set(m.f.n, data);
    for (const n of room.frames.keys()) { if (n <= m.f.n - KEEP_FRAMES) room.frames.delete(n); else break; }
    toOthers(room, ws.uid, data);
  } else if (m.t === 'rq') {   // žádost o akci → hostiteli
    if (ws.uid === room.host || !m.a || typeof m.a !== 'object') return;
    const hs = room.socks.get(room.host);
    if (hs) { const data = JSON.stringify({ t: 'rq', a: m.a, u: ws.uid }); hs.forEach(w => send(w, data)); }
  }
}

function onClose(ws) {
  const room = ws.room; if (!room) return;
  const set = room.socks.get(ws.uid);
  if (set) { set.delete(ws); if (!set.size) room.socks.delete(ws.uid); }
  if (!room.socks.size) room.empty = Date.now();
  log('leave', room.key, ws.uid, 'online', room.socks.size);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('sb-relay ok ' + rooms.size); return; }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({
  server, maxPayload: 256 * 1024,
  verifyClient: ({ origin }) => ORIGINS.has(origin || 'null'),
});
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', d => onMessage(ws, d.toString()));
  ws.on('close', () => onClose(ws));
  ws.on('error', () => {});
});
setInterval(() => {   // mrtvá spojení pryč, prázdné místnosti pryč
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
  const now = Date.now();
  rooms.forEach((r, k) => { if (r.empty && now - r.empty > ROOM_IDLE_MS) rooms.delete(k); });
}, 20000);
server.listen(PORT, '127.0.0.1', () => log('sb-relay na portu', PORT, DEV ? '(DEV)' : ''));

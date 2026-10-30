// ═══ sb-relay — rychlá cesta pro online hry StudyBoardu (Obrana království co-op, Zombie Survival)
// Běží na Oracle serveru vedle GameHubu (port 3100, Caddy: vgamehub.duckdns.org/sb/* → sem).
// Nic nesimuluje: hostitel posílá snímky (krok simulace + akce), server je rozešle ostatním v místnosti;
// hráči posílají žádosti o akce a server je předá hostiteli. Firebase RTDB zůstává jako záloha —
// prohlížeče zapisují i tam, takže když tenhle server neběží, hra jede dál jako dřív.
//
// Kdo smí dovnitř: Firebase ID token (ověřený proti veřejným klíčům Googlu) + uid musí být v tdGames/{id}
// ve Firestore (playerIds / hostUid). Snímky přijímá jen od hostitele. Dokument se čte REST API
// s tokenem hráče, takže server nepotřebuje žádný servisní klíč.
//
// Zombie Survival (kind 'zs'): server drží malý strom jako Firebase Realtime Database ({ players/{uid}/…, world/… }),
// klienti posílají set/update a server změnu rozešle ostatním. Hráč zapisuje jen do players/{svoje uid}, do world
// kdokoli v místnosti (hostitel se může změnit). Když hráč odpadne, jeho uzel po chvíli zmizí (jako onDisconnect).
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
const MSG_PER_SEC = 150;          // ochrana proti zahlcení (Zombie: stav hráče + svět 15× za sekundu, stavby, infrastruktura)
const PRESENCE_GRACE_MS = 5000;   // Zombie: tak dlouho se čeká na znovupřipojení, než hráč zmizí
const SLOW_CLIENT_BYTES = 1 << 20;   // pomalému klientovi se snímky světa přeskakují, dorazí další

const rooms = new Map();   // klíč → { key, host, members:Set, socks:Map<uid, Set<ws>>, frames:Map<n, json>, empty:ts }
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function verifyToken(token) {
  if (DEV && typeof token === 'string' && token.startsWith('dev:')) return token.slice(4);
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT}`, audience: PROJECT });
  if (!payload.sub) throw new Error('token bez uid');
  return payload.sub;
}
// Kdo hraje a kdo je hostitel (čte se s tokenem hráče — pravidla to dovolují přihlášeným)
async function loadGame(kind, gid, token) {
  if (DEV) return { host: 'host', members: new Set(['host', 'p2', 'p3', ...(process.env.SB_DEV_UIDS || '').split(',').filter(Boolean)]) };
  const zs = kind === 'zs';
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${zs ? 'survival_lobbies' : 'tdGames'}/${encodeURIComponent(gid)}` +
    (zs ? '?mask.fieldPaths=hostId&mask.fieldPaths=players' : '?mask.fieldPaths=hostUid&mask.fieldPaths=playerIds');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('hra nenalezena (' + r.status + ')');
  const d = await r.json(), f = d.fields || {};
  const host = (zs ? f.hostId : f.hostUid)?.stringValue;
  const members = new Set(zs ? Object.keys(f.players?.mapValue?.fields || {}) : (f.playerIds?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean));
  if (host) members.add(host);
  return { host, members };
}

// ── strom Zombie Survival ──
const SEG = /^[\w-]{1,64}$/, BAD = new Set(['__proto__', 'constructor', 'prototype']);
const okSeg = s => SEG.test(s) && !BAD.has(s);
function parsePath(p) { const a = typeof p === 'string' ? p.split('/') : null; return a && a.length && a.length <= 4 && a.every(okSeg) ? a : null; }
function setPath(tree, a, v) {
  let n = tree;
  for (let i = 0; i < a.length - 1; i++) {
    if (n[a[i]] == null || typeof n[a[i]] !== 'object') { if (v == null) return; n[a[i]] = {}; }
    n = n[a[i]];
  }
  if (v == null) delete n[a[a.length - 1]]; else n[a[a.length - 1]] = v;
}
const mayWrite = (uid, a) => a[0] === 'world' || (a[0] === 'players' && a[1] === uid);

function send(ws, obj) { if (ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
function toOthers(room, uid, data) { room.socks.forEach((set, u) => { if (u !== uid) set.forEach(w => send(w, data)); }); }

async function onJoin(ws, m) {
  if (ws.room) return send(ws, { t: 'err', m: 'už jsi v místnosti' });
  if ((m.kind !== 'td' && m.kind !== 'zs') || typeof m.gid !== 'string' || !/^[\w-]{4,64}$/.test(m.gid)) return send(ws, { t: 'err', m: 'špatná místnost' });
  let uid;
  try { uid = await verifyToken(m.token); } catch (e) { return send(ws, { t: 'err', m: 'přihlášení neplatí' }); }
  const key = m.kind + ':' + m.gid;
  let room = rooms.get(key);
  if (!room || !room.members.has(uid)) {   // nová místnost, nebo hráč, kterého ještě neznáme → zeptat se Firestore
    let g;
    try { g = await loadGame(m.kind, m.gid, m.token); } catch (e) { return send(ws, { t: 'err', m: String(e.message || e) }); }
    if (!g.members.has(uid)) return send(ws, { t: 'err', m: 'v téhle hře nejsi' });
    room = rooms.get(key) || { key, kind: m.kind, socks: new Map(), frames: new Map(), tree: {}, gone: new Map(), empty: 0 };
    room.host = g.host; room.members = g.members;
    rooms.set(key, room);
  }
  ws.room = room; ws.uid = uid;
  if (!room.socks.has(uid)) room.socks.set(uid, new Set());
  room.socks.get(uid).add(ws);
  room.empty = 0;
  send(ws, { t: 'ok', host: uid === room.host });
  if (room.kind === 'zs') {
    clearTimeout(room.gone.get(uid)); room.gone.delete(uid);
    send(ws, { t: 'tree', v: room.tree });
    log('join', key, uid, 'online', room.socks.size);
    return;
  }
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
  if (room.kind === 'zs') {
    if (m.t !== 's' && m.t !== 'u') return;
    const a = parsePath(m.p); if (!a || !mayWrite(ws.uid, a)) return;
    if (m.t === 's') setPath(room.tree, a, m.v);
    else {
      if (!m.v || typeof m.v !== 'object' || Array.isArray(m.v)) return;
      const keys = Object.keys(m.v); if (!keys.every(okSeg)) return;
      keys.forEach(k => setPath(room.tree, [...a, k], m.v[k]));
    }
    const isWorld = m.t === 'u' && a[0] === 'world' && a.length === 1;
    room.socks.forEach((set, u) => { if (u !== ws.uid) set.forEach(w => { if (!(isWorld && w.bufferedAmount > SLOW_CLIENT_BYTES)) send(w, raw); }); });
    return;
  }
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
  if (room.kind === 'zs' && !room.socks.has(ws.uid)) {
    const uid = ws.uid;
    clearTimeout(room.gone.get(uid));
    room.gone.set(uid, setTimeout(() => {   // jako onDisconnect ve Firebase: hráč zmizí, ostatní si zvolí nového hostitele
      room.gone.delete(uid);
      if (room.socks.has(uid)) return;
      const a = ['players', uid];
      setPath(room.tree, a, null);
      const data = JSON.stringify({ t: 's', p: a.join('/'), v: null });
      room.socks.forEach(set2 => set2.forEach(w => send(w, data)));
    }, PRESENCE_GRACE_MS));
  }
  if (!room.socks.size) room.empty = Date.now();
  log('leave', room.key, ws.uid, 'online', room.socks.size);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('sb-relay ok ' + rooms.size); return; }
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({
  server, maxPayload: 1024 * 1024,
  // Velké zprávy (snímky světa v Zombie) se zkomprimují, malé se nezdržují. Bez sdíleného kontextu, ať místnosti nežerou paměť.
  perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 }, serverNoContextTakeover: true, clientNoContextTakeover: true },
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

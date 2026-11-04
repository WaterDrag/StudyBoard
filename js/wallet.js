// ═══ wallet.js — společná peněženka her o peníze (Blackjack a další, které přibudou)
// users/{uid}.wallet = { bal, best, low, right, wrong } a kopie v prohlížeči (sb_wallet), ať se dá hrát i bez sítě.
// Zůstatek i dluh tak platí napříč hrami. Svoje věci (třeba minimální sázku) si každá hra ukládá zvlášť
// do users/{uid}.<hra>. Starší účet Blackjacku (bj.bal …) se při prvním načtení přesune sem beze změny.
const WALLET_KEY = 'sb_wallet', WALLET_FIELDS = ['bal', 'best', 'low', 'right', 'wrong'], WALLET_START = 1000;
const walletNew = () => ({ bal: WALLET_START, best: WALLET_START, low: 0, right: 0, wrong: 0 });
function walletPick(o) {
  const w = {};
  WALLET_FIELDS.forEach(k => { if (typeof o?.[k] === 'number' && isFinite(o[k])) w[k] = o[k]; });
  return w;
}
function walletLocal() {
  try { return JSON.parse(localStorage.getItem(WALLET_KEY) || 'null'); } catch (_) { return null; }
}
// Vrátí { w: peněženka, g: uložená data hry `game` }. legacyLocal = starší místní účet hry (bez sítě).
async function walletLoad(uid, game, legacyLocal) {
  const local = walletLocal();
  let w = { ...walletNew(), ...walletPick(local || legacyLocal) }, g = {};
  try {
    const snap = await db.collection('users').doc(uid).get();
    const d = snap.exists ? snap.data() : {};
    g = d[game] || {};
    if (d.wallet) w = { ...walletNew(), ...walletPick(d.wallet) };
    else if (typeof g.bal === 'number') { w = { ...walletNew(), ...walletPick(g) }; walletSave(uid, w); }   // přesun ze staršího účtu hry
  } catch (_) { /* bez sítě zůstane poslední stav z tohoto prohlížeče */ }
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(walletPick(w))); } catch (_) { /* nic */ }
  return { w, g };
}
// Uloží peněženku; extra = data hry, která se zapíšou stejným zápisem (např. { bj: {...} }).
function walletSave(uid, w, extra) {
  const pick = walletPick(w);
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(pick)); } catch (_) { /* nic */ }
  db.collection('users').doc(uid).set({ wallet: pick, ...(extra || {}) }, { merge: true }).catch(() => {});
}

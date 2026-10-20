// ═══ afk.js — kdo odpadl ze hry s přáteli: znamení + hlasování o vyhození
// Sdílí Dobyvatel, Pexeso a Šibenice. Každý hráč během hry zapisuje do
// dokumentu hry seen.{uid} = čas (každých 20 s a při návratu do záložky).
// Kdo se neozval AFK_MS, tomu ostatní uvidí hlasování „Vyhodit ze hry?“.
// Hlasy: kick.{uid} = [kdo hlasoval]. Vyhozený je ten, pro koho hlasuje
// většina aktivních hráčů (bez něj a bez botů) — ve dvou stačí jeden hlas.
const AFK_MS = 60e3, AFK_BEAT_MS = 20e3;
let AFK = null;   // { ref, uid, beat, waitUntil:{uid:ms}, last }

function afkStart(ref, uid) {
  if (AFK?.ref?.path === ref.path) return;
  afkStop();
  const beat = () => ref.update({ ['seen.' + uid]: Date.now() }).catch(() => {});
  AFK = { ref, uid, waitUntil: {}, last: null, beat: setInterval(beat, AFK_BEAT_MS) };
  AFK.onVis = () => { if (!document.hidden) beat(); };
  document.addEventListener('visibilitychange', AFK.onVis);
  AFK.tick = setInterval(() => { if (AFK.last) afkRender(AFK.last); }, 5000);
  beat();
}
function afkStop() {
  if (!AFK) return;
  clearInterval(AFK.beat); clearInterval(AFK.tick);
  document.removeEventListener('visibilitychange', AFK.onVis);
  document.getElementById('afkVote')?.remove();
  AFK = null;
}

// players: [{ uid, name, bot, done }] — lidé i boti ve hře. done = už dohrál / je vyřazený:
// smí hlasovat, ale vyhazovat ho není proč. startedAt: kdy hra začala
// (dokud někdo nedal znamení ani jednou, počítá se od začátku hry).
const afkSeen = (d, uid, startedAt) => (d.seen || {})[uid] || startedAt || 0;
const afkVotes = (d, uid) => ((d.kick || {})[uid] || []);
function afkInactive(d, uid, startedAt) { return Date.now() - afkSeen(d, uid, startedAt) > AFK_MS; }
function afkVoters(d, players, target, startedAt) {
  return players.filter(p => !p.bot && p.uid !== target && !afkIsKicked(d, players, p.uid, startedAt) && !afkInactive(d, p.uid, startedAt)).map(p => p.uid);
}
function afkIsKicked(d, players, uid, startedAt, depth = 0) {
  if (players.find(p => p.uid === uid)?.done) return false;
  const votes = afkVotes(d, uid);
  if (!votes.length || depth > 2) return false;
  // Kdo mezitím zase dal znamení, není vyhozený (hlasy proti němu propadnou).
  if (!afkInactive(d, uid, startedAt)) return false;
  const eligible = players.filter(p => !p.bot && p.uid !== uid && !afkInactive(d, p.uid, startedAt)).map(p => p.uid);
  const need = Math.floor(eligible.length / 2) + 1;
  return votes.filter(v => eligible.includes(v)).length >= Math.min(need, Math.max(1, eligible.length));
}
function afkKickedList(d, players, startedAt) {
  return players.filter(p => !p.bot && afkIsKicked(d, players, p.uid, startedAt)).map(p => p.uid);
}

// Lišta s hlasováním (jen u hráčů, kteří sami hrají a jsou aktivní).
function afkRender(ctx) {
  if (!AFK) return;
  AFK.last = ctx;
  const { data: d, players, startedAt } = ctx;
  const me = AFK.uid;
  const candidates = players.filter(p => !p.bot && !p.done && p.uid !== me && afkInactive(d, p.uid, startedAt)
    && !afkIsKicked(d, players, p.uid, startedAt) && (AFK.waitUntil[p.uid] || 0) < Date.now());
  let el = document.getElementById('afkVote');
  if (!candidates.length || !players.some(p => p.uid === me)) { el?.remove(); return; }
  const t = candidates[0];
  const voters = afkVoters(d, players, t.uid, startedAt);
  const votes = afkVotes(d, t.uid).filter(v => voters.includes(v));
  const need = Math.min(Math.floor(voters.length / 2) + 1, Math.max(1, voters.length));
  const voted = votes.includes(me);
  const mins = Math.floor((Date.now() - afkSeen(d, t.uid, startedAt)) / 60e3);
  if (!el) { el = document.createElement('div'); el.id = 'afkVote'; el.className = 'afk-vote'; document.body.appendChild(el); }
  el.innerHTML = `<span>😴 <b>${afkEsc(t.name)}</b> nereaguje už ${Math.max(1, mins)} min. Vyhodit ze hry?</span>
    <span class="afk-btns"><button type="button" class="btn btn-primary btn-sm" data-afk="kick" ${voted ? 'disabled' : ''}>${voted ? 'Hlasoval(a) jsi' : 'Vyhodit'} (${votes.length}/${need})</button>
    <button type="button" class="btn btn-ghost btn-sm" data-afk="wait">Počkat</button></span>`;
  el.onclick = e => {
    const a = e.target.closest('[data-afk]')?.dataset.afk;
    if (a === 'kick') AFK.ref.update({ ['kick.' + t.uid]: firebase.firestore.FieldValue.arrayUnion(me) }).catch(er => (typeof toast === 'function') && toast('Hlas se nepodařil: ' + er.message));
    if (a === 'wait') { AFK.waitUntil[t.uid] = Date.now() + AFK_MS; el.remove(); }
  };
}
function afkEsc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

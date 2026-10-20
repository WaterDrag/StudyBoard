// ═══ sibenice.js — Šibenice z kartiček
// Hádá se krátký pojem (max 3 slova, do 24 znaků, aspoň 2 písmena): odpověď
// karty, nebo pojem na přední straně, když je vzadu jeho definice
// („XAML“ ⟷ „značkovací jazyk…“) — pak je nápovědou ta definice.
// Písmena bez ohledu na diakritiku, čísla a znaky se odkryjí samy.
const HG_WORDS = 10, HG_LIVES = 8, HG_BEST = 'sib_best';
const HG_KEYS = 'AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ';
let DECKS = [], pickDecks = () => [], H = null;
// Závod proti přátelům: sibenice/{id} = { hostUid, status lobby|play|end, allowedUids, playerIds,
//   words[{word,clue,lbl}], players{uid:{name,color,i,score,solved,done,at{index:ms}}} }.
// Každý hraje svým tempem a zapisuje jen svůj postup; kdo slovo uhodne první, má +5.
const HG_COLORS = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const HG_FIRST = 5;
let GID = null, RACE = null, UNSUB = null, MY_NAME = '';
const rref = () => db.collection('sibenice').doc(GID);

const base = ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const isLetter = ch => /\p{L}/u.test(ch);
const shortTerm = t => { t = t.trim(); const letters = [...t].filter(isLetter).length; return t.length >= 2 && t.length <= 24 && t.split(/\s+/).length <= 3 && letters >= 2 && !/[?\n]/.test(t); };

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  MY_NAME = user.displayName || user.email?.split('@')[0] || 'Hráč';
  showBest();
  const g = new URLSearchParams(location.search).get('g');
  if (g) { GID = g; openRace(); return; }
  try { DECKS = await mcLoadDecks(); } catch (_) { $('hgDecks').innerHTML = '<div class="mc-muted">Balíčky se nepodařilo načíst.</div>'; return; }
  pickDecks = mcDeckPicker({ list: 'hgDecks', all: 'hgAll', start: 'hgStart', hint: 'hgHint', key: 'sib_decks', decks: DECKS });
  $('hgStart').onclick = startGame;
});

function showBest() {
  let best = 0;
  try { best = +localStorage.getItem(HG_BEST) || 0; } catch (_) { /* nic */ }
  $('hgBest').innerHTML = best ? `🏆 Tvůj rekord: <b>${best} b</b>` : '';
}

const hgShow = id => ['hgSetup', 'hgLobby', 'hgGame', 'hgEnd'].forEach(s => { $(s).hidden = s !== id; });
async function startGame() {
  const ds = pickDecks();
  const btn = $('hgStart');
  btn.disabled = true; btn.textContent = 'Hledám pojmy…';
  try {
    const cards = await mcLoadCards(ds);
    const seen = new Set();
    const words = shuffle(cards.filter(c => !c.fl && !c.cl).map(c => {
      if (shortTerm(c.b) && !shortTerm(c.f)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
      if (shortTerm(c.f) && c.b.length > c.f.length) return { word: c.f.trim(), clue: c.b, lbl: 'Co je to?', card: c };
      if (shortTerm(c.b)) return { word: c.b.trim(), clue: c.f, lbl: 'Otázka', card: c };
      return null;
    }).filter(Boolean)).filter(w => { const k = base(w.word); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, HG_WORDS);
    if (words.length < 2) { toast('Ve vybraných balíčcích skoro nejsou karty s krátkým pojmem. Zkus jiný balíček.'); return; }
    if (document.querySelector('input[name="hgMode"]:checked')?.value === 'multi') {
      if (ME.isAnonymous) { toast('Závod jen pro přihlášené.'); return; }
      const friends = await mcFriends().catch(() => []);
      const ref = await db.collection('sibenice').add({
        hostUid: ME.uid, hostName: MY_NAME, status: 'lobby',
        allowedUids: [ME.uid, ...friends], playerIds: [ME.uid],
        words: words.map(w => ({ word: w.word, clue: w.clue.slice(0, 400), lbl: w.lbl })),
        players: { [ME.uid]: { name: MY_NAME, color: HG_COLORS[0], i: 0, score: 0, solved: 0, done: false, at: {} } },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      history.replaceState(null, '', '?g=' + ref.id);
      GID = ref.id;
      openRace();
      return;
    }
    H = { words, i: 0, score: 0, solved: 0, failed: [] };
    $('hgSetup').hidden = true; $('hgEnd').hidden = true; $('hgGame').hidden = false;
    nextWord();
  } catch (e) { toast('Nepovedlo se: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hrát'; }
}

function nextWord() {
  if (H.i >= H.words.length) return endGame();
  const w = H.words[H.i];
  H.cur = { ...w, guessed: new Set(), lives: HG_LIVES, done: false };
  H.wordT0 = Date.now();
  $('hgRound').textContent = `Slovo ${H.i + 1} / ${H.words.length}`;
  $('hgHintLbl').textContent = w.lbl;
  $('hgClue').textContent = w.clue.length > 260 ? w.clue.slice(0, 257) + '…' : w.clue;
  $('hgNext').hidden = true;
  $('hgReveal').hidden = false;
  $('hgKeys').innerHTML = [...HG_KEYS].filter(k => k === base(k)).map(k => `<button type="button" class="hg-key" data-k="${k}">${k}</button>`).join('');
  $('hgKeys').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => guess(b.dataset.k)));
  render();
}

function render() {
  const c = H.cur;
  $('hgScore').textContent = `${H.score} b`;
  $('hgWord').innerHTML = [...c.word].map(ch => {
    if (ch === ' ') return '<span class="hg-gap"></span>';
    if (!isLetter(ch)) return `<span class="hg-ch fixed">${esc(ch)}</span>`;
    const shown = c.guessed.has(base(ch)) || c.done;
    return `<span class="hg-ch${shown ? ' on' : ''}${c.done && !c.guessed.has(base(ch)) ? ' miss' : ''}">${shown ? esc(ch.toUpperCase()) : ''}</span>`;
  }).join('');
  $('hgLives').innerHTML = '❤️'.repeat(c.lives) + '<span class="hg-lost">' + '🖤'.repeat(HG_LIVES - c.lives) + '</span>';
  [...$('hgGallows').querySelectorAll('.hg-p')].forEach((p, i) => p.classList.toggle('on', i < HG_LIVES - c.lives));
  $('hgKeys').querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k, used = c.guessed.has(k);
    b.disabled = used || c.done;
    b.classList.toggle('hit', used && [...c.word].some(ch => base(ch) === k));
    b.classList.toggle('miss', used && ![...c.word].some(ch => base(ch) === k));
  });
}

function solved() { return [...H.cur.word].filter(isLetter).every(ch => H.cur.guessed.has(base(ch))); }
function guess(k) {
  const c = H.cur;
  if (!c || c.done || c.guessed.has(k)) return;
  c.guessed.add(k);
  if (![...c.word].some(ch => base(ch) === k)) c.lives--;
  window.sfx?.([...c.word].some(ch => base(ch) === k) ? 'pop' : 'bad');
  finishCheck();
}
function finishCheck() {
  const c = H.cur;
  if (solved()) {
    c.done = true;
    const gain = 10 + c.lives * 2;
    H.score += gain; H.solved++;
    window.sfx?.('ok');
    toast(`✓ Správně! +${gain} b`);
  } else if (c.lives <= 0) {
    c.done = true;
    H.failed.push(c);
    window.sfx?.('lose');
  }
  render();
  if (c.done && H.multi) {
    const upd = { [`players.${ME.uid}.i`]: H.i + 1, [`players.${ME.uid}.score`]: H.score, [`players.${ME.uid}.solved`]: H.solved };
    if (c.lives > 0) upd[`players.${ME.uid}.at.${H.i}`] = Date.now();
    rref().update(upd).catch(() => {});
  }
  if (c.done) {
    $('hgWord').classList.toggle('won', c.lives > 0);
    $('hgReveal').hidden = true;
    $('hgNext').hidden = false;
    $('hgNext').textContent = H.i === H.words.length - 1 ? 'Výsledky →' : 'Další slovo →';
    $('hgNext').onclick = () => { $('hgWord').classList.remove('won'); H.i++; nextWord(); };
    $('hgNext').focus();
  }
}
$('hgReveal').onclick = () => {
  const c = H?.cur;
  if (!c || c.done || c.lives <= 1) { if (c && c.lives <= 1) toast('Na poslední chybu už nápověda nejde.'); return; }
  const hidden = [...new Set([...c.word].filter(isLetter).map(base))].filter(k => !c.guessed.has(k));
  if (!hidden.length) return;
  c.guessed.add(hidden[Math.floor(Math.random() * hidden.length)]);
  c.lives--;
  finishCheck();
};

// Fyzická klávesnice: písmena (i s háčky), Enter = další slovo
document.addEventListener('keydown', e => {
  if (!H || $('hgGame').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' && H.cur?.done) { e.preventDefault(); $('hgNext').click(); return; }
  if (e.key.length === 1 && isLetter(e.key)) { e.preventDefault(); guess(base(e.key)); }
});

function endGame() {
  if (H.multi) return endRace();
  window.sfx?.('win');
  let best = 0;
  try { best = +localStorage.getItem(HG_BEST) || 0; if (H.score > best) localStorage.setItem(HG_BEST, String(H.score)); } catch (_) { /* nic */ }
  recordPlayPoints(H.solved * 2);
  $('hgGame').hidden = true; $('hgEnd').hidden = false;
  const all = H.solved === H.words.length;
  $('hgEndIco').textContent = all ? '🏆' : H.solved >= H.words.length / 2 ? '🎉' : '🔤';
  $('hgEndTitle').textContent = all ? 'Všechno uhádnuto!' : 'Konec hry';
  $('hgResult').innerHTML = `<b>${H.score} b</b><span>${H.solved} z ${H.words.length} pojmů uhádnuto · +${H.solved * 2} b do žebříčku týdne</span>` + (H.score > best ? '<span class="sp-record">🎉 Nový rekord!</span>' : '');
  $('hgReview').innerHTML = H.failed.length ? '<div class="day-rank-h">Tyhle ti utekly</div>' + H.failed.map(c => `<div class="sp-rev"><b>${esc(c.word)}</b><span>${esc(c.clue)}</span></div>`).join('') : '';
  $('hgAgain').onclick = () => { $('hgEnd').hidden = true; $('hgSetup').hidden = false; showBest(); };
}

// ── Závod proti přátelům ─────────────────────────────────────────
function openRace() {
  UNSUB?.();
  let joined = false;
  UNSUB = rref().onSnapshot(snap => {
    if (!snap.exists) { toast('Závod už neexistuje.'); location.href = 'sibenice.html'; return; }
    RACE = snap.data();
    const me = RACE.players?.[ME.uid];
    if (RACE.status === 'lobby') {
      if (!RACE.playerIds.includes(ME.uid) && !joined) {
        joined = true;
        if (RACE.playerIds.length >= 6) { toast('Závod je plný.'); return; }
        const used = Object.values(RACE.players).map(p => p.color);
        rref().update({
          playerIds: firebase.firestore.FieldValue.arrayUnion(ME.uid),
          [`players.${ME.uid}`]: { name: MY_NAME, color: HG_COLORS.find(c => !used.includes(c)) || HG_COLORS[0], i: 0, score: 0, solved: 0, done: false, at: {} },
        }).catch(e => toast('Nepodařilo se připojit: ' + e.message));
      }
      return renderRaceLobby();
    }
    if (!me) { hgShow('hgSetup'); toast('Závod už běží bez tebe.'); return; }
    if (RACE.status === 'play') {
      afkStart(rref(), ME.uid);
      afkRender({ data: RACE, players: hgPeople(), startedAt: RACE.startAt });
    } else afkStop();
    if (RACE.status === 'play' && !me.done) {
      if (!H) {   // start (nebo návrat po obnovení stránky)
        H = { words: RACE.words, i: me.i || 0, score: me.score || 0, solved: me.solved || 0, failed: [], multi: true };
        hgShow('hgGame');
        nextWord();
      }
      renderRivals();
      return;
    }
    renderRaceEnd();
  }, e => toast('Závod se nepodařilo načíst: ' + e.message));
}

function renderRaceLobby() {
  hgShow('hgLobby');
  const host = RACE.hostUid === ME.uid;
  $('hgLobbyInfo').textContent = `${RACE.hostName} zakládá závod: ${RACE.words.length} slov. Všichni dostanou stejná slova — kdo uhodne slovo první, má +${HG_FIRST} b. Přátelé závod uvidí v záložce Hry, nebo jim pošli odkaz.`;
  $('hgLobbyPlayers').innerHTML = RACE.playerIds.map(uid => { const p = RACE.players[uid] || {}; return `<span class="px-chip" style="--c:${p.color}">${esc(p.name || 'Hráč')}${uid === RACE.hostUid ? ' 👑' : ''}</span>`; }).join('');
  $('hgGo').hidden = !host;
  $('hgGo').disabled = RACE.playerIds.length < 2;
  $('hgLobbyHint').textContent = host ? (RACE.playerIds.length < 2 ? 'Čeká se aspoň na jednoho soupeře.' : 'Všichni tu? Spusť závod.') : 'Čeká se, až hostitel závod spustí.';
  $('hgGo').onclick = () => rref().update({ status: 'play', startAt: Date.now() }).catch(e => toast('Nepovedlo se: ' + e.message));
  $('hgCopy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Odkaz zkopírován.'); } catch (_) { prompt('Zkopíruj odkaz:', location.href); } };
  $('hgLeave').onclick = async () => {
    try {
      if (host) await rref().delete();
      else await rref().update({ playerIds: firebase.firestore.FieldValue.arrayRemove(ME.uid), [`players.${ME.uid}`]: firebase.firestore.FieldValue.delete() });
    } catch (_) { /* nic */ }
    location.href = 'dashboard.html?tab=games';
  };
}

// Body s bonusem za „první uhodl“ (počítá se z časů všech hráčů).
function raceScores() {
  const ps = RACE.players || {}, firsts = {};
  RACE.words.forEach((_, k) => {
    let best = null;
    Object.entries(ps).forEach(([uid, p]) => { const t = p.at?.[k]; if (t && (!best || t < best.t)) best = { uid, t }; });
    if (best) firsts[best.uid] = (firsts[best.uid] || 0) + 1;
  });
  const out = afkKickedList(RACE, hgPeople(), RACE.startAt);
  return RACE.playerIds.filter(uid => ps[uid]).map(uid => ({ uid, ...ps[uid], kicked: out.includes(uid) && !ps[uid].done, firsts: firsts[uid] || 0, total: (ps[uid].score || 0) + (firsts[uid] || 0) * HG_FIRST }))
    .sort((a, b) => b.total - a.total);
}
const hgPeople = () => (RACE.playerIds || []).filter(uid => RACE.players?.[uid]).map(uid => ({ uid, name: RACE.players[uid].name, done: !!RACE.players[uid].done }));
function renderRivals() {
  const el = $('hgRivals');
  el.hidden = false;
  const n = RACE.words.length;
  el.innerHTML = raceScores().map(r => `<span class="px-chip${r.uid === ME.uid ? ' turn' : ''}" style="--c:${r.color}">${esc(r.name)} <small>${r.done ? '🏁' : r.kicked ? '🚪' : (r.i || 0) + '/' + n}</small> <b>${r.total}</b></span>`).join('');
}

function endRace() {
  $('hgGame').hidden = true;
  rref().update({ [`players.${ME.uid}.done`]: true, [`players.${ME.uid}.score`]: H.score, [`players.${ME.uid}.solved`]: H.solved, [`players.${ME.uid}.i`]: H.words.length })
    .catch(() => {});
  renderRaceEnd();
}
function renderRaceEnd() {
  hgShow('hgEnd');
  const rows = raceScores(), n = RACE.words.length;
  const allDone = rows.every(r => r.done || r.kicked);   // na vyhozené se nečeká
  if (allDone && RACE.status === 'play') rref().update({ status: 'end' }).catch(() => {});
  const me = rows.find(r => r.uid === ME.uid), win = allDone && rows[0]?.uid === ME.uid;
  $('hgEndIco').textContent = allDone ? (win ? '🏆' : '🏁') : '⏳';
  $('hgEndTitle').textContent = allDone ? (win ? 'Vyhrál(a) jsi závod!' : `Vítěz: ${rows[0]?.name}`) : 'Dohráno — čeká se na ostatní';
  $('hgResult').innerHTML = me ? `<b>${me.total} b</b><span>${me.solved || 0} z ${n} pojmů${me.firsts ? ` · 🥇 ${me.firsts}× první (+${me.firsts * HG_FIRST})` : ''}</span>` : '';
  $('hgRank').innerHTML = rows.map((r, i) => `<div class="lb-row${r.uid === ME.uid ? ' me' : ''}${r.done ? '' : ' idle'}"><span class="lb-medal">${allDone ? (['🥇', '🥈', '🥉'][i] || i + 1 + '.') : (r.done ? '🏁' : '⏳')}</span><span class="lb-av" style="background:${r.color}">${esc((r.name || '?')[0].toUpperCase())}</span><span class="lb-name"><b>${esc(r.name)}</b><small>${r.done ? `${r.solved || 0}/${n} pojmů` : r.kicked ? 'vyhozen(a) — odpadl(a)' : `hraje… slovo ${(r.i || 0) + 1}/${n}`}${r.firsts ? ` · 🥇 ${r.firsts}×` : ''}</small></span><span class="lb-points">${r.total}<small> b</small></span></div>`).join('');
  $('hgWait').textContent = allDone ? '' : 'Výsledky se doplní, až dohrají všichni.';
  if (allDone) {
    const key = 'hg_rec_' + GID;
    let fresh = true;
    try { fresh = !localStorage.getItem(key); localStorage.setItem(key, '1'); } catch (_) { /* nic */ }
    if (fresh && me) recordPlayPoints((me.solved || 0) * 2 + (win ? 10 : 0));
    if (fresh) window.sfx?.(win ? 'win' : 'lose');
  }
  $('hgAgain').onclick = () => { UNSUB?.(); location.href = 'sibenice.html'; };
}

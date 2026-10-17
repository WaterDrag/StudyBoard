// ═══ denni.js — Denní výzva: 10 otázek denně z vlastních kartiček
// Výběr je pro daný den pevný (semínko = uživatel + datum) a míří na karty,
// které ti nejdou nebo jsi je ještě neviděl. Hraje se jednou denně: postup se
// ukládá po každé odpovědi do users/{uid}.daily.{YYYY-MM-DD}, takže obnovení
// stránky nepomůže — otázka, která byla na obrazovce, se počítá jako špatně.
const DAY_N = 10, DAY_MS = 20000, REVEAL_MS = 1400, KEEP_DAYS = 60;
const TODAY = localDay();
let DAILY = {}, D = null;   // D = { qs:[{card, opts, correct}], i, c, s, shownAt, timer }

const dayRef = () => db.collection('users').doc(ME.uid);
const saveDay = upd => dayRef().set({ daily: { [TODAY]: upd } }, { merge: true }).catch(() => {});

auth.onAuthStateChanged(async user => {
  if (!user) { location.href = 'index.html'; return; }
  ME = user;
  if (user.isAnonymous) { $('dayStart').textContent = 'Jen pro přihlášené'; $('dayHint').textContent = 'Denní výzva si pamatuje výsledky a sérii — host účet to neumí.'; return; }
  $('dayTitle').textContent = 'Denní výzva · ' + new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
  try { const snap = await dayRef().get(); DAILY = (snap.exists && snap.data().daily) || {}; } catch (_) { DAILY = {}; }
  const st = DAILY[TODAY];
  if (st?.done) return showDone(st, false);
  renderStreak('dayStreak');
  const b = $('dayStart');
  b.disabled = false;
  b.textContent = st?.q ? `Pokračovat (${st.n || 0}/${DAY_N})` : 'Začít výzvu';
  b.onclick = start;
});

function streak() {
  const keys = [];
  for (let i = 0; i < 400; i++) keys.push(localDay(Date.now() - i * 864e5));
  let n = 0, i = DAILY[keys[0]]?.done ? 0 : 1;
  for (; i < keys.length && DAILY[keys[i]]?.done; i++) n++;
  return n;
}
function renderStreak(id) {
  const n = streak();
  $(id).innerHTML = n ? `🔥 <b>${n}</b> ${n === 1 ? 'den' : n < 5 ? 'dny' : 'dní'} v řadě` : 'Zahraj si dnes a začni sérii 🔥';
}

async function start() {
  const b = $('dayStart');
  b.disabled = true; b.textContent = 'Připravuji otázky…';
  try {
    const decks = (await mcLoadDecks()).slice(0, 25);
    if (!decks.length) { toast('Nemáš žádné balíčky s kartičkami — vytvoř si nějaký ve Flash Cards.'); b.textContent = 'Začít výzvu'; b.disabled = false; return; }
    const [pool, boxes] = await Promise.all([mcLoadCards(decks), mcLearnBoxes()]);
    const st = DAILY[TODAY] || {};
    const byKey = new Map(pool.map(c => [c.deckId + '/' + c.id, c]));
    let cards;
    if (st.q?.length) {
      cards = st.q.map(k => byKey.get(k)).filter(Boolean);   // stejné otázky jako při prvním spuštění
    } else {
      const rnd = seededRng(ME.uid + TODAY);
      cards = pool.map(c => ({ c, w: (boxes[c.id] ?? 1.5) + rnd() * 2.5 })).sort((a, b) => a.w - b.w).map(x => x.c)
        .filter(c => mcOptions(c, pool, seededRng(ME.uid + TODAY + c.id))).slice(0, DAY_N);
      if (cards.length < 3) { toast('Z tvých balíčků nejde sestavit otázky s možnostmi — přidej víc kartiček.'); b.textContent = 'Začít výzvu'; b.disabled = false; return; }
      await saveDay({ q: cards.map(c => c.deckId + '/' + c.id), n: 0, c: 0, s: 0, done: false });
      Object.assign(st, { q: cards.map(c => c.deckId + '/' + c.id), n: 0, c: 0, s: 0 });
      DAILY[TODAY] = st;
    }
    const qs = cards.map(c => ({ card: c, ...mcOptions(c, pool, seededRng(ME.uid + TODAY + c.id)) })).filter(q => q.opts);
    D = { qs, i: st.n || 0, c: st.c || 0, s: st.s || 0 };
    // Otázka byla na obrazovce a stránka se obnovila → počítá se jako nezodpovězená.
    if (st.cur === D.i && D.i < qs.length) {
      D.i++;
      await saveDay({ n: D.i });
      toast('Otázka z minula se počítá jako nezodpovězená.');
    }
    if (D.i >= qs.length) return finish();
    $('dayIntro').hidden = true; $('dayGame').hidden = false;
    showQ();
  } catch (e) {
    toast('Nepovedlo se: ' + e.message);
    b.disabled = false; b.textContent = 'Začít výzvu';
  }
}

function showQ() {
  const q = D.qs[D.i];
  D.locked = false;
  $('dayQn').textContent = `Otázka ${D.i + 1} / ${D.qs.length}`;
  $('dayScore').textContent = `${D.s} b`;
  $('dayQuestion').innerHTML = mcQuestionHtml(q.card) + `<div class="mil-deck">${esc(q.card.deckName)}</div>`;
  $('dayAnswers').innerHTML = q.opts.map((o, k) => `<button type="button" class="mil-ans${q.card.cl ? ' is-code' : ''}" data-k="${k}"><i>${'ABCD'[k]}</i><span>${mcOptionHtml(q.card, o)}</span></button>`).join('');
  $('dayAnswers').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
  saveDay({ cur: D.i });
  D.shownAt = Date.now();
  clearInterval(D.timer);
  const bar = $('dayTimer');
  D.timer = setInterval(() => {
    const left = Math.max(0, DAY_MS - (Date.now() - D.shownAt));
    bar.style.width = (left / DAY_MS * 100) + '%';
    bar.classList.toggle('low', left < 5000);
    if (!left) answer(-1);
  }, 100);
}

function answer(k) {
  if (D.locked) return;
  D.locked = true;
  clearInterval(D.timer);
  const q = D.qs[D.i];
  const left = Math.max(0, DAY_MS - (Date.now() - D.shownAt));
  const ok = k === q.correct;
  const gain = ok ? 100 + Math.round(50 * left / DAY_MS) : 0;
  D.s += gain; if (ok) D.c++;
  const btns = [...$('dayAnswers').children];
  btns[q.correct].classList.add('right');
  if (k >= 0 && !ok) btns[k].classList.add('wrong');
  if (k < 0) toast('⏰ Čas vypršel');
  $('dayScore').textContent = `${D.s} b${gain ? ` (+${gain})` : ''}`;
  D.i++;
  saveDay({ n: D.i, c: D.c, s: D.s });
  setTimeout(() => { if (D.i >= D.qs.length) finish(); else showQ(); }, ok ? REVEAL_MS : REVEAL_MS + 900);
}

// Klávesy 1–4 / A–D
document.addEventListener('keydown', e => {
  if (!D || D.locked || $('dayGame').hidden) return;
  const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (k >= 0 && k < D.qs[D.i].opts.length) answer(k);
});

async function finish() {
  const st = { ...(DAILY[TODAY] || {}), n: D.i, c: D.c, s: D.s, done: true, of: D.qs.length };
  DAILY[TODAY] = st;
  // staré dny pryč, ať profil neroste donekonečna
  const old = Object.keys(DAILY).filter(k => k < localDay(Date.now() - KEEP_DAYS * 864e5));
  const upd = { n: D.i, c: D.c, s: D.s, done: true, of: D.qs.length, cur: firebase.firestore.FieldValue.delete() };
  await dayRef().set({ daily: { [TODAY]: upd, ...Object.fromEntries(old.map(k => [k, firebase.firestore.FieldValue.delete()])) } }, { merge: true }).catch(() => {});
  old.forEach(k => delete DAILY[k]);
  recordPlayPoints(10 + 3 * D.c);
  showDone(st, true);
}

async function showDone(st, fresh) {
  $('dayIntro').hidden = true; $('dayGame').hidden = true; $('dayDone').hidden = false;
  const of = st.of || DAY_N, c = st.c || 0;
  $('dayDoneIco').textContent = c === of ? '🏆' : c >= of * 0.7 ? '🎉' : c >= of * 0.4 ? '💪' : '📚';
  $('dayDoneTitle').textContent = fresh ? 'Výzva splněna!' : 'Dnešní výzvu už máš za sebou';
  $('dayResult').innerHTML = `<b>${st.s || 0} b</b><span>${c} z ${of} správně${fresh ? ` · +${10 + 3 * c} b do žebříčku týdne` : ''}</span>`;
  renderStreak('dayStreak2');
  const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
  const h = Math.floor((midnight - Date.now()) / 3600e3), m = Math.floor((midnight - Date.now()) / 60e3) % 60;
  $('dayNext').textContent = `Další výzva za ${h} h ${m} min.`;
  try {
    const ids = [ME.uid, ...(await mcFriends()).filter(x => x !== ME.uid)];
    const docs = await Promise.all(ids.map(uid => db.collection('users').doc(uid).get()));
    const rows = docs.filter(d => d.exists).map(d => ({ uid: d.id, p: d.data(), t: (d.data().daily || {})[TODAY] }))
      .sort((a, b) => (b.t?.done ? b.t.s : -1) - (a.t?.done ? a.t.s : -1));
    $('dayRank').innerHTML = rows.map((r, i) => {
      const name = r.p.displayName || 'Přítel', done = r.t?.done;
      const medal = done ? (['🥇', '🥈', '🥉'][i] || `<span class="lb-n">${i + 1}.</span>`) : '<span class="lb-n">–</span>';
      return `<div class="lb-row${r.uid === ME.uid ? ' me' : ''}${done ? '' : ' idle'}">
        <span class="lb-medal">${medal}</span>
        <span class="lb-av">${r.p.photoURL ? `<img src="${esc(r.p.photoURL)}" alt="">` : esc(name[0].toUpperCase())}</span>
        <span class="lb-name"><b>${esc(name)}${r.uid === ME.uid ? ' <small>(ty)</small>' : ''}</b><small>${done ? `${r.t.c} z ${r.t.of || DAY_N} správně` : 'dnes ještě nehrál(a)'}</small></span>
        <span class="lb-points">${done ? r.t.s : '–'}<small> b</small></span></div>`;
    }).join('') + (rows.length < 2 ? '<div class="lb-empty">Přidej si přátele a porovnejte, kdo dnešní výzvu zvládne líp.</div>' : '');
  } catch (_) { $('dayRank').innerHTML = '<div class="lb-empty">Pořadí se nepodařilo načíst.</div>'; }
}

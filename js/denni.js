// ═══ denni.js — Denní výzva: 10 otázek denně z vlastních kartiček
// Výběr je pro daný den pevný (semínko = uživatel + datum) a míří na karty,
// které ti nejdou nebo jsi je ještě neviděl. Hraje se jednou denně: postup se
// ukládá po každé odpovědi do users/{uid}.daily.{YYYY-MM-DD}, takže obnovení
// stránky nepomůže — otázka, která byla na obrazovce, se počítá jako špatně.
const DAY_N = 10, DAY_MS = 20000, REVEAL_MS = 1400, KEEP_DAYS = 60;
// „Vím to bez možností“: u kartiček, které umíš (krabička 4–5), si můžeš vsadit — 8 možností za 2× body,
// nebo napsat odpověď za 3× body (jen u krátkých odpovědí, ty jde spolehlivě zkontrolovat; psaní má +10 s).
const BET_BOX = 4, TYPE_MS = 10000;
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
    const decks = (await mcLoadDecks()).filter(d => !/^sb-/.test(d.id)).slice(0, 25);   // bez vestavěných balíčků „Pro všechny“
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
    const qs = cards.map(c => {
      const q = { card: c, ...mcOptions(c, pool, seededRng(ME.uid + TODAY + c.id)) };
      if (q.opts && (boxes[c.id] || 0) >= BET_BOX) {   // sázka jen u kartiček, které umíš
        q.box = boxes[c.id];
        q.o8 = mcOptions(c, pool, seededRng(ME.uid + TODAY + c.id + '8'), 8);
        q.canType = !c.cl && mcShortTerm(c.b);
      }
      return q;
    }).filter(q => q.opts);
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
  D.locked = false; D.mult = 1; D.limit = DAY_MS; D.mode = null;
  $('dayQn').textContent = `Otázka ${D.i + 1} / ${D.qs.length}`;
  $('dayScore').textContent = `${D.s} b`;
  $('dayQuestion').innerHTML = mcQuestionHtml(q.card) + `<div class="mil-deck">${esc(q.card.deckName)}</div>`;
  if (q.o8 || q.canType) {   // nejdřív jen otázka a volba sázky
    D.mode = 'bet';
    $('dayAnswers').innerHTML = `<div class="day-bet"><div class="day-bet-h">🎯 Tuhle kartičku umíš (krabička ${q.box}). Troufneš si bez nápovědy?</div>
      <div class="day-bet-btns"><button type="button" class="btn btn-secondary" data-bet="4"><span>Ukázat A–D</span><small>běžné body</small></button>
      ${q.o8 ? '<button type="button" class="btn btn-secondary" data-bet="8"><span>8 možností</span><small>2× body</small></button>' : ''}
      ${q.canType ? '<button type="button" class="btn btn-primary" data-bet="type"><span>✍️ Napíšu to</span><small>3× body · +10 s</small></button>' : ''}</div></div>`;
    $('dayAnswers').querySelectorAll('[data-bet]').forEach(b => b.addEventListener('click', () => pickBet(b.dataset.bet)));
  } else renderOpts(q.opts, q.correct);
  saveDay({ cur: D.i });
  D.shownAt = Date.now();
  clearInterval(D.timer);
  const bar = $('dayTimer');
  D.timer = setInterval(() => {
    const left = Math.max(0, D.limit - (Date.now() - D.shownAt));
    bar.style.width = (left / D.limit * 100) + '%';
    bar.classList.toggle('low', left < 5000);
    const sec = Math.ceil(left / 1000);
    if (left && left < 5000 && sec !== D.lastTick) { D.lastTick = sec; window.sfx?.('tick'); }
    if (!left) answer(-1);
  }, 100);
}

const LETTERS = 'ABCDEFGH';
function renderOpts(opts, correct) {
  D.cur = { opts, correct };
  $('dayAnswers').classList.toggle('day-8', opts.length > 4);
  $('dayAnswers').innerHTML = opts.map((o, k) => `<button type="button" class="mil-ans${D.qs[D.i].card.cl ? ' is-code' : ''}" data-k="${k}"><i>${LETTERS[k]}</i><span>${mcOptionHtml(D.qs[D.i].card, o)}</span></button>`).join('');
  $('dayAnswers').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => answer(+b.dataset.k)));
}
function pickBet(kind) {
  if (D.locked || D.mode !== 'bet') return;
  const q = D.qs[D.i];
  window.sfx?.('click');
  if (kind === '8' && q.o8) { D.mode = 'opts'; D.mult = 2; renderOpts(q.o8.opts, q.o8.correct); return; }
  if (kind === 'type' && q.canType) {
    D.mode = 'type'; D.mult = 3; D.limit += TYPE_MS;
    $('dayAnswers').classList.remove('day-8');
    $('dayAnswers').innerHTML = `<form class="day-type" autocomplete="off"><input type="text" class="input" id="dayTyped" placeholder="Napiš odpověď…" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80">
      <button type="submit" class="btn btn-primary">Odpovědět</button><div class="day-type-hint">Háčky, čárky a velká písmena nevadí, drobný překlep projde.</div></form>`;
    const f = $('dayAnswers').querySelector('form');
    f.onsubmit = e => { e.preventDefault(); answerTyped($('dayTyped').value); };
    setTimeout(() => $('dayTyped')?.focus(), 30);
    return;
  }
  D.mode = 'opts'; renderOpts(q.opts, q.correct);
}
// body: 100 + až 50 za rychlost, × sázka (2× za 8 možností, 3× za psaní)
function award(ok) {
  const left = Math.max(0, D.limit - (Date.now() - D.shownAt));
  const gain = ok ? (100 + Math.round(50 * left / D.limit)) * D.mult : 0;
  D.s += gain; if (ok) D.c++;
  $('dayScore').textContent = `${D.s} b${gain ? ` (+${gain}${D.mult > 1 ? ` · ${D.mult}×` : ''})` : ''}`;
  D.i++;
  saveDay({ n: D.i, c: D.c, s: D.s });
  setTimeout(() => { if (D.i >= D.qs.length) finish(); else showQ(); }, ok ? REVEAL_MS : REVEAL_MS + 900);
}
function answer(k) {
  if (D.locked) return;
  if (D.mode === 'bet' || D.mode === 'type') {   // čas vypršel při volbě sázky nebo psaní
    if (k >= 0) return;
    D.locked = true; clearInterval(D.timer);
    window.sfx?.('bad'); toast('⏰ Čas vypršel');
    if (D.mode === 'type') revealTyped(false, '');
    else $('dayAnswers').innerHTML = `<div class="day-type-res bad">Správně je: <b>${esc(D.qs[D.i].card.b)}</b></div>`;
    return award(false);
  }
  D.locked = true;
  clearInterval(D.timer);
  const { correct } = D.cur;
  const ok = k === correct;
  window.sfx?.(ok ? 'ok' : 'bad');
  const btns = [...$('dayAnswers').children];
  btns[correct].classList.add('right');
  if (k >= 0 && !ok) btns[k].classList.add('wrong');
  if (k < 0) toast('⏰ Čas vypršel');
  award(ok);
}
function revealTyped(ok, text) {
  const card = D.qs[D.i].card;
  $('dayAnswers').innerHTML = `<div class="day-type-res ${ok ? 'ok' : 'bad'}">${ok ? '✅ Správně' : '❌ Špatně'}${text ? ` — napsal(a) jsi: <i>${esc(text)}</i>` : ''}<br>Správně je: <b>${esc(card.b)}</b></div>`;
}
function answerTyped(text) {
  if (D.locked || D.mode !== 'type') return;
  if (!text.trim()) return;
  D.locked = true; clearInterval(D.timer);
  const ok = mcTypedOk(D.qs[D.i].card, text);
  window.sfx?.(ok ? 'ok' : 'bad');
  revealTyped(ok, text.trim());
  award(ok);
}

// Klávesy 1–4 / A–D
document.addEventListener('keydown', e => {
  if (!D || D.locked || $('dayGame').hidden || D.mode === 'bet' || D.mode === 'type') return;
  const n = D.cur?.opts.length || 4;
  const k = '12345678'.indexOf(e.key) >= 0 ? '12345678'.indexOf(e.key) : 'abcdefgh'.indexOf(e.key.toLowerCase());
  if (k >= 0 && k < n) answer(k);
});

async function finish() {
  window.sfx?.('win');
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

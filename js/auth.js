// Přesměruj přihlášeného uživatele na dashboard — nebo zpět na odkaz
// (pozvánka do místnosti/přátel), který ho sem přivedl před přihlášením.
auth.onAuthStateChanged(user => {
  if (!user) return;
  const pending = localStorage.getItem('sb_pending_redirect');
  localStorage.removeItem('sb_pending_redirect');
  window.location.href = pending || 'dashboard.html';
});

const errorMsg     = document.getElementById('errorMsg');
const authForm     = document.getElementById('authForm');
const submitBtn    = document.getElementById('submitBtn');
const toggleMode   = document.getElementById('toggleMode');
const googleBtn    = document.getElementById('googleBtn');

let isLogin = true;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}
function hideError() {
  errorMsg.style.display = 'none';
}

toggleMode.addEventListener('click', () => {
  isLogin = !isLogin;
  submitBtn.textContent  = isLogin ? 'Přihlásit se' : 'Registrovat se';
  toggleMode.textContent = isLogin ? 'Nemáš účet? Registruj se' : 'Už máš účet? Přihlas se';
  hideError();
});

googleBtn.addEventListener('click', async () => {
  hideError();
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (e) {
    showError('Přihlášení přes Google se nezdařilo: ' + e.message);
  }
});

// Host režim — anonymní přihlášení (zapnout v Console → Authentication → Anonymous)
const guestBtn = document.getElementById('guestBtn');
const startGuest = guestBtn => async () => {
  const label = guestBtn.textContent;
  hideError();
  guestBtn.disabled = true;
  guestBtn.textContent = 'Spouštím…';
  try {
    await auth.signInAnonymously(); // onAuthStateChanged výše přesměruje dál
  } catch (e) {
    const hint = e.code === 'auth/operation-not-allowed'
      ? 'Zapni Anonymous přihlášení: Firebase Console → Authentication → Sign-in method → Anonymous → Enable.'
      : e.message;
    showError('Host režim selhal: ' + hint);
    guestBtn.disabled = false;
    guestBtn.textContent = label;
  }
};
if (guestBtn) guestBtn.addEventListener('click', startGuest(guestBtn));

// Přišel z pozvánky do místnosti: nejdřív mu to řekni a nabídni cestu bez účtu
try {
  const pendingLink = localStorage.getItem('sb_pending_redirect') || '';
  const inviteBtn = document.getElementById('inviteGuestBtn');
  if (inviteBtn && /room(\.html)?\?(.*&)?t?code=/.test(pendingLink)) {
    document.getElementById('inviteBox').hidden = false;
    if (guestBtn) guestBtn.hidden = true;
    inviteBtn.addEventListener('click', startGuest(inviteBtn));
  } else if (inviteBtn && /[?&](friendInvite|addFriend)=/.test(pendingLink)) {
    // Přátelství má smysl jen s účtem, cestu bez účtu tu nenabízej
    const box = document.getElementById('inviteBox');
    box.hidden = false;
    box.querySelector('h2').textContent = 'Máš pozvánku do přátel';
    box.querySelector('p').textContent = 'Přihlas se, nebo si založ účet. Pak pozvánku jedním kliknutím přijmeš.';
    inviteBtn.hidden = true;
    box.querySelector('.divider').hidden = true;
    if (guestBtn) guestBtn.hidden = true;
  }
} catch (_) { /* localStorage blocked */ }

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  hideError();

  const email    = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  submitBtn.disabled    = true;
  submitBtn.textContent = isLogin ? 'Přihlašuji...' : 'Registruji...';

  try {
    if (isLogin) {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
  } catch (e) {
    const msgs = {
      'auth/user-not-found':     'Účet s tímto emailem neexistuje.',
      'auth/wrong-password':     'Špatné heslo.',
      'auth/invalid-credential': 'Špatný email nebo heslo. Pokud ses registroval(a) přes Google, přihlas se tlačítkem Google — heslo si pak můžeš přidat v Nastavení.',
      'auth/email-already-in-use': 'Tento email je již registrovaný.',
      'auth/invalid-email':      'Neplatná emailová adresa.',
      'auth/weak-password':      'Heslo musí mít alespoň 6 znaků.',
      'auth/too-many-requests':  'Příliš mnoho pokusů. Zkus to za chvíli.',
    };
    showError(msgs[e.code] || e.message);
    submitBtn.disabled    = false;
    submitBtn.textContent = isLogin ? 'Přihlásit se' : 'Registrovat se';
  }
});

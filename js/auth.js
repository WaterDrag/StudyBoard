// Přesměruj přihlášeného uživatele rovnou na dashboard
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'dashboard.html';
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
if (guestBtn) guestBtn.addEventListener('click', async () => {
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
    guestBtn.textContent = '🎮 Hrát jako host (bez účtu)';
  }
});

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
      'auth/invalid-credential': 'Špatný email nebo heslo.',
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

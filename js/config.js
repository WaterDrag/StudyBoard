// ============================================================
//  FIREBASE KONFIGURACE
//  1. Jdi na https://console.firebase.google.com
//  2. Vytvoř projekt (nebo použij existující)
//  3. Přidej Web app  →  zkopíruj config níže
//  4. V Firebase Console zapni:
//       Authentication  →  Sign-in providers: Google + Email/Password
//       Firestore Database  →  Create database (test mode pro začátek)
//  5. Nasaď firestore.rules (viz soubor v root složce)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBn1YyZf4Oia_QZw96wrynNwSe7VNgLBhA",
  authDomain: "studypage-1f2f8.firebaseapp.com",
  projectId: "studypage-1f2f8",
  databaseURL: "https://studypage-1f2f8-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "studypage-1f2f8.firebasestorage.app",
  messagingSenderId: "250590961493",
  appId: "1:250590961493:web:addcdd6a045035678699dc",
  measurementId: "G-543MP3J0BC"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// The login page (index.html) only loads the auth SDK, so firebase.firestore
// isn't there — calling it threw and killed the rest of this file. Guard it
// so everything below (offline support, the service worker, IMGBB_KEY) still
// runs everywhere.
const db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;

// Offline: cache Firestore data locally, so notes/decks stay readable (and
// edits queue up) without a connection. Fails harmlessly when several tabs
// are open (only one may hold the lease) or the browser doesn't support it.
if (db) db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// PWA: register the service worker so the app is installable and its shell
// keeps working offline. Skipped on file:// where SW isn't available.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1')).catch(() => {});
  });
}

// ImgBB – free image hosting (imgbb.com)
const IMGBB_KEY = '35d2aa02584eaf0848eb0b70a4d78686';

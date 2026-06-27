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
  storageBucket: "studypage-1f2f8.firebasestorage.app",
  messagingSenderId: "250590961493",
  appId: "1:250590961493:web:addcdd6a045035678699dc",
  measurementId: "G-543MP3J0BC"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// ImgBB – free image hosting (imgbb.com)
const IMGBB_KEY = '35d2aa02584eaf0848eb0b70a4d78686';

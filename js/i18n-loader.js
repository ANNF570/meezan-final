/* ============================================================
   MEEZAN | js/i18n-loader.js
   FIXED: Applies language to ALL pages from Firebase
   - Applies RTL/LTR direction
   - Handles page title translation
   - Falls back to localStorage if offline
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc }   from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:            "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:        "meezan-app-8a41a.firebaseapp.com",
  projectId:         "meezan-app-8a41a",
  storageBucket:     "meezan-app-8a41a.firebasestorage.app",
  messagingSenderId: "767947145877",
  appId:             "1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── Apply from localStorage immediately (no flash) ── */
(function applyFromLocalStorage() {
  const saved = localStorage.getItem('meezan-lang');
  if (saved && saved !== 'en') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyLang(saved));
    } else {
      applyLang(saved);
    }
  }
})();

/* ══════════════════════════════════════
   On auth ready — sync with Firebase
   ══════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  if (!user) return;

  try {
    const snap  = await getDoc(doc(db, 'users', user.uid, 'settings', 'prefs'));
    if (!snap.exists()) return;
    const prefs = snap.data();

    /* Apply language from Firebase */
    if (prefs.language) {
      const currentLS = localStorage.getItem('meezan-lang') || 'en';
      if (prefs.language !== currentLS) {
        localStorage.setItem('meezan-lang', prefs.language);
      }
      if (prefs.language !== 'en') {
        applyLang(prefs.language);
      }
    }

    /* Apply theme from Firebase */
    if (prefs.theme) {
      localStorage.setItem('meezan-theme', prefs.theme);
      document.documentElement.setAttribute('data-theme', prefs.theme);
      document.querySelectorAll('.theme-pill')
        .forEach(p => p.classList.toggle('active', p.title === prefs.theme));
    }

  } catch (e) {
    console.log('i18n-loader: Firebase unavailable, using localStorage');
  }
});

/* ══════════════════════════════════════
   APPLY LANGUAGE FUNCTION
   ══════════════════════════════════════ */
function applyLang(code) {
  /* Wait for i18n.js translations to load */
  if (typeof window.MEEZAN_TRANSLATIONS === 'undefined') {
    /* Retry after DOM is ready */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyLang(code));
    } else {
      setTimeout(() => applyLang(code), 100);
    }
    return;
  }

  const dict = window.MEEZAN_TRANSLATIONS[code] || window.MEEZAN_TRANSLATIONS['en'];
  if (!dict) return;

  const RTL_LANGS = ['ar', 'ur', 'fa', 'he'];
  const isRTL     = RTL_LANGS.includes(code);

  /* ── 1. Apply to all data-i18n elements ── */
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  /* ── 2. Apply to placeholders ── */
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) el.placeholder = dict[key];
  });

  /* ── 3. RTL / LTR direction ── */
  document.documentElement.setAttribute('dir',  isRTL ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', code);

  /* ── 4. RTL font adjustment ── */
  if (isRTL) {
    document.documentElement.style.setProperty('--body-font', "'Noto Naskh Arabic', serif");
  } else {
    document.documentElement.style.removeProperty('--body-font');
  }

  /* ── 5. Update page title ── */
  const pageKey = document.body.dataset.page;
  if (pageKey && dict[pageKey]) {
    document.title = 'Meezan — ' + dict[pageKey];
  }

  console.log(`Language applied: ${code} (${isRTL ? 'RTL' : 'LTR'})`);
}

/* Make applyLanguage globally available for other scripts */
window.applyLanguage = applyLang;

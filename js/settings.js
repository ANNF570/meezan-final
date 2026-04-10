/* ============================================================
   MEEZAN | js/settings.js
   FIXED: Profile save/load + Language saves to Firebase
   ============================================================ */
import { initializeApp }                        from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc }     from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

/* ── Helpers ── */
const get  = id  => document.getElementById(id);
const val  = id  => get(id)?.value?.trim() || '';
const set  = (id, v) => { const el = get(id); if (el) el.value = v || ''; };
const setText = (id, v) => { const el = get(id); if (el) el.textContent = v || ''; };

let currentUser = null;

/* ── LANGUAGES shown in settings quick-select ── */
const LANG_OPTIONS = [
  { code:'en', native:'English',   english:'English',    rtl:false },
  { code:'ar', native:'العربية',   english:'Arabic',     rtl:true  },
  { code:'ur', native:'اردو',      english:'Urdu',       rtl:true  },
  { code:'hi', native:'हिन्दी',    english:'Hindi',      rtl:false },
  { code:'te', native:'తెలుగు',    english:'Telugu',     rtl:false },
  { code:'ta', native:'தமிழ்',     english:'Tamil',      rtl:false },
  { code:'ml', native:'മലയാളം',    english:'Malayalam',  rtl:false },
  { code:'bn', native:'বাংলা',     english:'Bengali',    rtl:false },
  { code:'kn', native:'ಕನ್ನಡ',     english:'Kannada',    rtl:false },
  { code:'tr', native:'Türkçe',    english:'Turkish',    rtl:false },
  { code:'fr', native:'Français',  english:'French',     rtl:false },
  { code:'id', native:'Bahasa',    english:'Indonesian', rtl:false },
];

/* ══════════════════════════════════════════════
   AUTH GUARD
   ══════════════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = '../index.html'; return; }
  currentUser = user;

  /* Avatar initials */
  const initials = (user.displayName || user.email || 'U').substring(0, 2).toUpperCase();
  ['mob-avatar', 'avatar-initials'].forEach(id => { const el = get(id); if (el) el.textContent = initials; });

  /* Pre-fill email (read-only) */
  set('p-email', user.email);

  /* Build language grid */
  buildLangGrid();

  /* Load profile and prefs from Firestore */
  await loadProfile();
  await loadPrefs();

  /* Load theme */
  loadThemeDisplay();
});

/* ══════════════════════════════════════════════
   LOAD PROFILE FROM FIRESTORE
   ══════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (!snap.exists()) return;
    const d = snap.data();

    set('p-name',    d.name    || d.displayName || '');
    set('p-display', d.displayName || '');
    set('p-phone',   d.phone   || '');
    set('p-city',    d.city    || '');

    if (d.country) {
      const sel = get('p-country');
      if (sel) sel.value = d.country;
    }
    if (d.dob) {
      const el = get('p-dob');
      if (el) el.value = d.dob;
    }

    /* Avatar photo */
    if (d.photoURL) {
      const img = get('avatar-img');
      if (img) { img.src = d.photoURL; img.style.display = 'block'; }
      const ai = get('avatar-initials');
      if (ai) ai.style.display = 'none';
    }

    console.log('Profile loaded ✓');
  } catch (e) {
    console.error('loadProfile error:', e);
  }
}

/* ══════════════════════════════════════════════
   LOAD PREFS FROM FIRESTORE
   ══════════════════════════════════════════════ */
async function loadPrefs() {
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'prefs'));
    if (!snap.exists()) return;
    const d = snap.data();

    /* Currency */
    if (d.currency) {
      const sel = get('pref-currency');
      if (sel) sel.value = d.currency;
    }

    /* Calendar */
    if (d.calendar) {
      const sel = get('pref-calendar');
      if (sel) sel.value = d.calendar;
    }

    /* Salary date */
    if (d.salday) {
      const el = get('pref-salday');
      if (el) el.value = d.salday;
    }

    /* Budget warning */
    if (d.budwarn) {
      const el = get('pref-budwarn');
      if (el) el.value = d.budwarn;
    }

    /* Language — highlight active */
    if (d.language) {
      localStorage.setItem('meezan-lang', d.language);
      highlightActiveLang(d.language);
    }

    /* Theme */
    if (d.theme) {
      localStorage.setItem('meezan-theme', d.theme);
      document.documentElement.setAttribute('data-theme', d.theme);
    }

    /* Notification toggles */
    if (d.notifications) {
      Object.entries(d.notifications).forEach(([key, val]) => {
        const tog = get('nt-' + key);
        if (tog) tog.classList.toggle('on', val);
      });
    }

    console.log('Prefs loaded ✓');
  } catch (e) {
    console.error('loadPrefs error:', e);
  }
}

/* ══════════════════════════════════════════════
   SAVE PROFILE TO FIRESTORE
   ══════════════════════════════════════════════ */
window.saveProfile = async function() {
  if (!currentUser) { alert('Not signed in.'); return; }

  const btn = get('save-profile-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    const data = {
      name:        val('p-name'),
      displayName: val('p-display') || val('p-name'),
      phone:       val('p-phone'),
      country:     get('p-country')?.value || 'IN',
      city:        val('p-city'),
      dob:         get('p-dob')?.value || '',
      updatedAt:   new Date().toISOString()
    };

    await setDoc(doc(db, 'users', currentUser.uid), data, { merge: true });

    showMsg('profile-msg', '✓ Profile saved!', 'teal');
    console.log('Profile saved ✓', data);
  } catch (e) {
    showMsg('profile-msg', '✗ Error: ' + e.message, 'fire');
    console.error('saveProfile error:', e);
  }

  if (btn) { btn.textContent = '✓ Save Profile'; btn.disabled = false; }
};

/* ══════════════════════════════════════════════
   SAVE PREFERENCES TO FIRESTORE
   ══════════════════════════════════════════════ */
window.savePrefs = async function() {
  if (!currentUser) return;

  const btn = get('save-prefs-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    const data = {
      currency: get('pref-currency')?.value || 'INR',
      calendar: get('pref-calendar')?.value || 'both',
      salday:   parseInt(get('pref-salday')?.value) || 1,
      budwarn:  parseInt(get('pref-budwarn')?.value) || 80,
    };

    await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'prefs'), data, { merge: true });

    showMsg('prefs-msg', '✓ Preferences saved!', 'teal');
  } catch (e) {
    showMsg('prefs-msg', '✗ Error: ' + e.message, 'fire');
  }

  if (btn) { btn.textContent = '✓ Save Preferences'; btn.disabled = false; }
};

/* ══════════════════════════════════════════════
   LANGUAGE GRID — build + save to Firebase
   ══════════════════════════════════════════════ */
function buildLangGrid() {
  const el = get('lang-select-grid');
  if (!el) return;
  const saved = localStorage.getItem('meezan-lang') || 'en';
  el.innerHTML = LANG_OPTIONS.map(l => `
    <div class="lang-opt${l.code === saved ? ' selected' : ''}"
         id="lo-${l.code}"
         onclick="selectLang('${l.code}', this)">
      <div class="lang-n">${l.native}</div>
      <div class="lang-v">${l.english}${l.rtl ? ' ←RTL' : ''}</div>
    </div>`).join('');
}

function highlightActiveLang(code) {
  document.querySelectorAll('.lang-opt').forEach(el => el.classList.remove('selected'));
  const el = get('lo-' + code);
  if (el) el.classList.add('selected');
}

window.selectLang = async function(code, el) {
  /* 1. Highlight in grid */
  document.querySelectorAll('.lang-opt').forEach(x => x.classList.remove('selected'));
  el.classList.add('selected');

  /* 2. Apply language immediately on this page */
  if (typeof applyLanguage === 'function') {
    applyLanguage(code);
  }
  localStorage.setItem('meezan-lang', code);

  /* 3. Save to Firebase so it persists across devices */
  if (currentUser) {
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'settings', 'prefs'),
        { language: code },
        { merge: true }
      );
      showMsg('lang-msg', '✓ Language saved!', 'teal');
    } catch (e) {
      console.error('Language save failed:', e);
    }
  }
};

/* ══════════════════════════════════════════════
   THEME — save to Firebase
   ══════════════════════════════════════════════ */
window.selectTheme = async function(th) {
  /* Apply immediately */
  window.setTheme(th);

  /* Highlight selected option */
  document.querySelectorAll('.theme-option').forEach(x =>
    x.classList.toggle('selected', x.id === 'to-' + th)
  );

  /* Save to Firebase */
  if (currentUser) {
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'settings', 'prefs'),
        { theme: th },
        { merge: true }
      );
    } catch (e) {
      console.error('Theme save failed:', e);
    }
  }
};

/* ══════════════════════════════════════════════
   NOTIFICATION TOGGLES — save to Firebase
   ══════════════════════════════════════════════ */
window.saveNotifSettings = async function() {
  if (!currentUser) return;

  const notifs = {};
  document.querySelectorAll('[id^="nt-"]').forEach(el => {
    const key = el.id.replace('nt-', '');
    notifs[key] = el.classList.contains('on');
  });

  try {
    await setDoc(
      doc(db, 'users', currentUser.uid, 'settings', 'prefs'),
      { notifications: notifs },
      { merge: true }
    );
    showMsg('notif-msg', '✓ Notification settings saved!', 'teal');
  } catch (e) {
    showMsg('notif-msg', '✗ Error: ' + e.message, 'fire');
  }
};

/* ══════════════════════════════════════════════
   AVATAR UPLOAD (local preview only — storage needs paid plan)
   ══════════════════════════════════════════════ */
window.handleAvatarChange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = get('avatar-img');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
    const ai = get('avatar-initials');
    if (ai) ai.style.display = 'none';
  };
  reader.readAsDataURL(file);
};

/* ══════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════ */
window.confirmLogout = async function() {
  if (!confirm('Sign out of Meezan?')) return;
  await signOut(auth);
  location.href = '../index.html';
};

window.exportData = function() { location.href = 'export.html'; };

/* ══════════════════════════════════════════════
   THEME HELPERS
   ══════════════════════════════════════════════ */
function loadThemeDisplay() {
  const t = localStorage.getItem('meezan-theme') || 'glass';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title === t));
  document.querySelectorAll('.theme-option').forEach(x => x.classList.toggle('selected', x.id === 'to-' + t));
}

window.setTheme = function(th) {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('meezan-theme', th);
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title === th));
  const tl = get('theme-label'); if (tl) tl.textContent = 'Theme: ' + th.charAt(0).toUpperCase() + th.slice(1);
};

/* ── Show save message ── */
function showMsg(id, msg, type) {
  const el = get(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'teal' ? 'var(--teal-lt)' : 'var(--fire-lt)';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

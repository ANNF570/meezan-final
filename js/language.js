/* ============================================================
   MEEZAN | js/language.js
   FIXED: Saves language to Firebase, applies on ALL pages
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc }
                                       from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:"meezan-app-8a41a.firebaseapp.com",
  projectId:"meezan-app-8a41a",
  storageBucket:"meezan-app-8a41a.firebasestorage.app",
  messagingSenderId:"767947145877",
  appId:"1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app), db = getFirestore(app);

const LANGUAGES = [
  { code:'en', native:'English',    english:'English',        rtl:false, flag:'🇬🇧' },
  { code:'ar', native:'العربية',    english:'Arabic',         rtl:true,  flag:'🇸🇦' },
  { code:'ur', native:'اردو',       english:'Urdu',           rtl:true,  flag:'🇵🇰' },
  { code:'fa', native:'فارسی',      english:'Persian/Farsi',  rtl:true,  flag:'🇮🇷' },
  { code:'hi', native:'हिन्दी',     english:'Hindi',          rtl:false, flag:'🇮🇳' },
  { code:'te', native:'తెలుగు',     english:'Telugu',         rtl:false, flag:'🇮🇳' },
  { code:'ta', native:'தமிழ்',      english:'Tamil',          rtl:false, flag:'🇮🇳' },
  { code:'ml', native:'മലയാളം',     english:'Malayalam',      rtl:false, flag:'🇮🇳' },
  { code:'bn', native:'বাংলা',      english:'Bengali',        rtl:false, flag:'🇧🇩' },
  { code:'ms', native:'Melayu',     english:'Malay',          rtl:false, flag:'🇲🇾' },
  { code:'id', native:'Bahasa',     english:'Indonesian',     rtl:false, flag:'🇮🇩' },
  { code:'tr', native:'Türkçe',     english:'Turkish',        rtl:false, flag:'🇹🇷' },
  { code:'fr', native:'Français',   english:'French',         rtl:false, flag:'🇫🇷' },
  { code:'de', native:'Deutsch',    english:'German',         rtl:false, flag:'🇩🇪' },
  { code:'es', native:'Español',    english:'Spanish',        rtl:false, flag:'🇪🇸' },
  { code:'it', native:'Italiano',   english:'Italian',        rtl:false, flag:'🇮🇹' },
  { code:'pt', native:'Português',  english:'Portuguese',     rtl:false, flag:'🇵🇹' },
  { code:'ru', native:'Русский',    english:'Russian',        rtl:false, flag:'🇷🇺' },
  { code:'ja', native:'日本語',      english:'Japanese',       rtl:false, flag:'🇯🇵' },
  { code:'zh', native:'中文',        english:'Mandarin',       rtl:false, flag:'🇨🇳' },
  { code:'el', native:'Ελληνικά',   english:'Greek',          rtl:false, flag:'🇬🇷' },
];

let selectedLang = localStorage.getItem('meezan-lang') || 'en';
let currentUser  = null;

/* ── AUTH + LOAD saved language from Firebase ── */
onAuthStateChanged(auth, async user => {
  if (!user) { location.href='../index.html'; return; }
  currentUser = user;
  const ma = document.getElementById('mob-avatar');
  if (ma) ma.textContent = (user.displayName||user.email||'M').substring(0,2).toUpperCase();

  // Load saved language from Firebase
  try {
    const snap = await getDoc(doc(db,'users',user.uid,'settings','prefs'));
    if (snap.exists() && snap.data().language) {
      selectedLang = snap.data().language;
      localStorage.setItem('meezan-lang', selectedLang);
    }
  } catch(e) { console.log('Using localStorage lang'); }

  buildGrid();
  updatePreview(selectedLang);
  updateRTLIndicator(selectedLang);
  buildStatus();

  const curL = LANGUAGES.find(l=>l.code===selectedLang);
  const al = document.getElementById('applied-label');
  if (al) al.textContent = (curL?.flag||'')+ ' '+(curL?.native||'English') + ' — ' + (curL?.english||'English');
});

/* ── BUILD LANGUAGE GRID ── */
function buildGrid() {
  const grid = document.getElementById('lang-grid');
  if (!grid) return;
  grid.innerHTML = LANGUAGES.map(l => `
    <div class="lang-card${l.code===selectedLang?' selected':''}"
         id="lc-${l.code}"
         onclick="selectLang('${l.code}')">
      <div class="lang-flag">${l.flag}</div>
      <div class="lc-native">${l.native}</div>
      <div class="lc-english">${l.english}</div>
      ${l.rtl ? '<div class="rtl-badge">RTL</div>' : ''}
    </div>`).join('');
  buildStatus();
}

/* ── SELECT LANGUAGE ── */
window.selectLang = function(code) {
  selectedLang = code;
  document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('selected'));
  const el = document.getElementById('lc-'+code);
  if (el) el.classList.add('selected');
  updatePreview(code);
  updateRTLIndicator(code);
};

/* ── APPLY SELECTED — saves to Firebase + localStorage ── */
window.applySelected = async function() {
  /* 1. Apply immediately to this page */
  if (typeof applyLanguage === 'function') applyLanguage(selectedLang);
  localStorage.setItem('meezan-lang', selectedLang);

  /* 2. Apply RTL/LTR direction */
  const lang = LANGUAGES.find(l=>l.code===selectedLang);
  document.documentElement.setAttribute('dir', lang?.rtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', selectedLang);

  /* 3. Save to Firebase so every page loads it */
  if (currentUser) {
    try {
      await setDoc(
        doc(db,'users',currentUser.uid,'settings','prefs'),
        { language: selectedLang },
        { merge: true }
      );
      const msg = document.getElementById('lang-apply-msg');
      if (msg) {
        msg.textContent = '✓ Language saved! All pages will now use ' + (lang?.english||selectedLang);
        msg.style.color = 'var(--teal-lt)';
        setTimeout(()=>msg.textContent='', 4000);
      }
      // Update the badge
      const al = document.getElementById('applied-label');
      if (al) al.textContent = '✓ ' + (lang?.flag||'') + ' ' + (lang?.native||'English') + ' — ' + (lang?.english||'English');
      const badge = document.getElementById('applied-badge');
      if (badge) {
        badge.style.background = 'rgba(26,188,156,.15)';
        badge.style.borderColor = 'rgba(26,188,156,.4)';
        setTimeout(()=>{ badge.style.background=''; badge.style.borderColor=''; },2000);
      }
    } catch(e) {
      const msg = document.getElementById('lang-apply-msg');
      if (msg) { msg.textContent = '✗ Save failed: ' + e.message; msg.style.color='var(--fire-lt)'; }
    }
  }
};

/* ── LIVE PREVIEW ── */
function updatePreview(code) {
  const dict = window.MEEZAN_TRANSLATIONS?.[code] || window.MEEZAN_TRANSLATIONS?.['en'] || {};
  const s = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  s('prev-name',      dict.appName    || 'Meezan');
  s('prev-bismillah', dict.bismillah  || 'Bismillah');
  s('prev-dashboard', dict.dashboard  || 'Dashboard');
  s('prev-add-income',dict.addIncome  || '+ Add Income');
  s('prev-zakat-note',dict.zakatNote  || 'Only gold and silver count for Zakat.');
  s('prev-save',      dict.save       || 'Save');
  s('prev-cancel',    dict.cancel     || 'Cancel');

  const lang = LANGUAGES.find(l=>l.code===code);
  const prev = document.getElementById('lang-preview-box');
  if (prev) {
    prev.setAttribute('dir', lang?.rtl ? 'rtl' : 'ltr');
    prev.style.fontFamily = lang?.rtl ? "'Noto Naskh Arabic', serif" : '';
    prev.style.textAlign  = lang?.rtl ? 'right' : 'left';
  }
}

/* ── RTL INDICATOR ── */
function updateRTLIndicator(code) {
  const lang = LANGUAGES.find(l=>l.code===code);
  const el   = document.getElementById('rtl-indicator');
  if (!el) return;
  el.style.display='block';
  if (lang?.rtl) {
    el.style.cssText='display:block;background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.25);color:var(--fire-lt);border-radius:8px;padding:8px 12px;font-size:11px;margin-top:.75rem';
    el.textContent='← RTL layout will apply — the entire app mirrors right-to-left.';
  } else {
    el.style.cssText='display:block;background:rgba(26,188,156,.08);border:1px solid rgba(26,188,156,.2);color:var(--teal-lt);border-radius:8px;padding:8px 12px;font-size:11px;margin-top:.75rem';
    el.textContent='→ LTR layout (standard left-to-right).';
  }
}

/* ── TRANSLATION COVERAGE STATUS ── */
function buildStatus() {
  const enDict = window.MEEZAN_TRANSLATIONS?.['en'] || {};
  const total  = Object.keys(enDict).length || 1;
  const el = document.getElementById('translation-status');
  if (!el) return;
  el.innerHTML = LANGUAGES.map(l => {
    const dict = window.MEEZAN_TRANSLATIONS?.[l.code] || {};
    const count = Object.keys(dict).length;
    const pct   = Math.round(count/total*100);
    const color = pct>=95?'var(--teal)':pct>=60?'var(--gold)':'var(--fire)';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <div style="font-size:14px;min-width:22px">${l.flag}</div>
      <div style="font-size:11px;min-width:90px;color:var(--text-mid)">${l.english}</div>
      <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.07);overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
      </div>
      <div style="font-size:10px;color:var(--text-dim);min-width:32px;text-align:right">${pct}%</div>
      ${l.rtl?'<div style="font-size:9px;color:var(--fire-lt);min-width:24px">RTL</div>':'<div style="min-width:24px"></div>'}
    </div>`;
  }).join('') + `<div style="font-size:10px;color:var(--text-dim);margin-top:.5rem">21 languages available ✓</div>`;
}

/* ── THEME ── */
window.setTheme = th => {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('meezan-theme', th);
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th));
  const tl=document.getElementById('theme-label'); if(tl) tl.textContent='Theme: '+th.charAt(0).toUpperCase()+th.slice(1);
};
const _t=localStorage.getItem('meezan-theme')||'glass';
document.documentElement.setAttribute('data-theme',_t);

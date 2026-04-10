/* ============================================================
   MEEZAN | js/sadaqah.js
   Sadaqah Log — full Firebase connection
   Tracks: amount, description, category, date
   Shows: totals, monthly, category breakdown, motivational verse
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc,
         query, orderBy, onSnapshot, serverTimestamp }
                                       from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:"meezan-app-8a41a.firebaseapp.com",
  projectId:"meezan-app-8a41a",
  storageBucket:"meezan-app-8a41a.firebasestorage.app",
  messagingSenderId:"767947145877",
  appId:"1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app);
const db   = getFirestore(app);

const fmt   = n  => '₹' + Math.round(n||0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0,10);
const thisM = () => new Date().toISOString().slice(0,7);
const get   = id => document.getElementById(id);
const set   = (id,v) => { const el=get(id); if(el) el.textContent=v; };

/* ── Category icons + colors ── */
const CAT_ICONS  = { Masjid:'🕌', Poor:'🤲', Education:'📚', Medical:'🏥', Orphan:'👶', Zakat:'⚖️', Food:'🍚', Water:'💧', General:'🤲', Other:'🌿' };
const CAT_COLORS = { Masjid:'#d4a017', Poor:'#1abc9c', Education:'#5dade2', Medical:'#e74c3c', Orphan:'#9b59b6', Zakat:'#48d1b0', Food:'#e67e22', Water:'#3498db', General:'#1abc9c', Other:'#95a5a6' };

/* ── Motivational verses on Sadaqah ── */
const VERSES = [
  { ar:'مَّثَلُ ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُمْ فِى سَبِيلِ ٱللَّهِ كَمَثَلِ حَبَّةٍ أَنۢبَتَتْ سَبْعَ سَنَابِلَ', en:'"The example of those who spend their wealth in the way of Allah is like a grain of corn that sprouts seven ears, and in every ear there are a hundred grains."', ref:'Surah Al-Baqarah 2:261' },
  { ar:'ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُم بِٱلَّيْلِ وَٱلنَّهَارِ سِرًّۭا وَعَلَانِيَةًۭ', en:'"Those who spend their wealth by night and by day, secretly and publicly — they will have their reward with their Lord."', ref:'Surah Al-Baqarah 2:274' },
  { ar:'لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟ مِمَّا تُحِبُّونَ', en:'"You will never attain righteousness until you spend from that which you love."', ref:'Surah Aal-Imran 3:92' },
  { ar:'وَمَآ أَنفَقْتُم مِّن شَىْءٍۢ فَهُوَ يُخْلِفُهُۥ ۖ وَهُوَ خَيْرُ ٱلرَّٰزِقِينَ', en:'"Whatever you spend in His cause will be replaced by Him. He is the Best of Providers."', ref:'Surah Saba 34:39' },
];

let currentUser = null, allSD = [];

/* ══════════════════════════════════════
   AUTH GUARD
   ══════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (!user) { location.href = '../index.html'; return; }
  currentUser = user;
  const ma = get('mob-avatar');
  if (ma) ma.textContent = (user.displayName||user.email||'M').substring(0,2).toUpperCase();

  // Set today's date
  const dateEl = get('sd-date');
  if (dateEl) dateEl.value = today();

  // Show random verse
  showVerse();

  // Start real-time listener
  startListener();
});

/* ══════════════════════════════════════
   REAL-TIME FIRESTORE LISTENER
   ══════════════════════════════════════ */
function startListener() {
  const q = query(
    collection(db, 'users', currentUser.uid, 'sadaqah'),
    orderBy('date', 'desc')
  );

  onSnapshot(q, snap => {
    allSD = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
    updateSummary();
    buildBreakdown();
    buildMonthlyChart();
  }, err => console.error('Sadaqah listener error:', err.message));
}

/* ══════════════════════════════════════
   RENDER SADAQAH LIST
   ══════════════════════════════════════ */
function renderList() {
  const el = get('sadaqah-list');
  if (!el) return;

  if (!allSD.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-dim)">
        <div style="font-size:36px;margin-bottom:.75rem">🤲</div>
        <div style="font-size:14px;margin-bottom:.5rem">No Sadaqah recorded yet.</div>
        <div style="font-size:12px">Record your first act of charity using the form →</div>
      </div>`;
    return;
  }

  el.innerHTML = allSD.map(x => {
    const icon  = CAT_ICONS[x.cat]  || '🤲';
    const color = CAT_COLORS[x.cat] || '#1abc9c';
    return `
      <div class="sd-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;
           border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);margin-bottom:6px">
        <div style="width:36px;height:36px;border-radius:10px;
             background:${color}22;border:1px solid ${color}44;
             display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
          ${icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${escHtml(x.desc||'Sadaqah')}</div>
          <div style="font-size:10px;color:var(--text-dim)">${x.date} · ${x.cat||'General'}${x.fromExpense ? ' · <span style="color:var(--gold-lt);font-size:9px">↙ from expense</span>' : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--teal-lt)">${fmt(x.amt)}</div>
          <div class="del-btn" onclick="delSD('${x.id}')"
               style="font-size:10px;color:var(--fire-lt);cursor:pointer;opacity:.7;margin-top:2px">✕ Remove</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   UPDATE SUMMARY CARDS
   ══════════════════════════════════════ */
function updateSummary() {
  const total  = allSD.reduce((s,x) => s + (x.amt||0), 0);
  const month  = allSD.filter(x => (x.date||'').slice(0,7) === thisM()).reduce((s,x) => s + (x.amt||0), 0);
  const count  = allSD.length;

  set('sd-total', fmt(total));
  set('sd-month', fmt(month));
  set('sd-count', count);

  // Sadaqah impact estimate (₹10 = 1 meal, ₹50 = 1 person's day)
  const meals = Math.floor(total / 50);
  const impEl = get('sd-impact');
  if (impEl && meals > 0) {
    impEl.textContent = `≈ ${meals.toLocaleString()} meals funded`;
  }
}

/* ══════════════════════════════════════
   CATEGORY BREAKDOWN
   ══════════════════════════════════════ */
function buildBreakdown() {
  // Count auto-synced vs manual entries
  const autoCount   = allSD.filter(x => x.fromExpense).length;
  const manualCount = allSD.filter(x => !x.fromExpense).length;
  const autoEl = document.getElementById('sd-auto-count');
  const manEl  = document.getElementById('sd-manual-count');
  if (autoEl)   autoEl.textContent  = autoCount  + ' auto-synced from expenses';
  if (manEl)    manEl.textContent   = manualCount + ' manually recorded';

  const el    = get('sd-breakdown');
  if (!el) return;

  const total = allSD.reduce((s,x) => s + (x.amt||0), 0) || 1;
  const byC   = {};
  allSD.forEach(x => { byC[x.cat||'General'] = (byC[x.cat||'General']||0) + (x.amt||0); });
  const sorted = Object.entries(byC).sort((a,b) => b[1]-a[1]);

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center">No data yet</div>';
    return;
  }

  el.innerHTML = sorted.map(([cat, amt]) => {
    const color = CAT_COLORS[cat] || '#95a5a6';
    const icon  = CAT_ICONS[cat]  || '🤲';
    const pct   = Math.round(amt/total*100);
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:14px;min-width:20px">${icon}</div>
        <div style="font-size:11px;color:var(--text-mid);min-width:70px">${cat}</div>
        <div style="flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div>
        </div>
        <div style="font-size:11px;color:var(--teal-lt);min-width:60px;text-align:right;font-family:'Cinzel',serif">${fmt(amt)}</div>
        <div style="font-size:10px;color:var(--text-dim);min-width:28px;text-align:right">${pct}%</div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   MONTHLY CHART (last 6 months)
   ══════════════════════════════════════ */
function buildMonthlyChart() {
  const el = get('sd-chart');
  if (!el) return;
  el.innerHTML = '';

  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    const lbl = d.toLocaleString('en', { month:'short' });
    const amt = allSD.filter(x => (x.date||'').slice(0,7) === key).reduce((s,x) => s+(x.amt||0), 0);
    months.push({ key, lbl, amt });
  }

  const maxV = Math.max(...months.map(m => m.amt), 1);
  months.forEach(({ lbl, amt }) => {
    const h  = Math.round(amt/maxV*52);
    const bw = document.createElement('div');
    bw.className = 'bar-wrap';
    bw.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;flex:1';
    bw.innerHTML = `
      <div style="font-size:9px;color:var(--teal-lt);font-family:'Cinzel',serif">${amt>0?'₹'+Math.round(amt/1000)+'k':''}</div>
      <div style="display:flex;align-items:flex-end;height:52px">
        <div style="background:linear-gradient(180deg,#1abc9c,#0d7a5f);height:${h||2}px;width:24px;border-radius:4px 4px 0 0;min-height:2px"></div>
      </div>
      <div style="font-size:9px;color:var(--text-dim)">${lbl}</div>`;
    el.appendChild(bw);
  });
}

/* ══════════════════════════════════════
   SHOW RANDOM QURAN VERSE
   ══════════════════════════════════════ */
function showVerse() {
  const v   = VERSES[Math.floor(Math.random() * VERSES.length)];
  const ar  = get('verse-ar');
  const en  = get('verse-en');
  const ref = get('verse-ref');
  if (ar)  ar.textContent  = v.ar;
  if (en)  en.textContent  = v.en;
  if (ref) ref.textContent = '— ' + v.ref;
}

/* ══════════════════════════════════════
   ADD SADAQAH
   ══════════════════════════════════════ */
window.addSadaqah = async function() {
  const amt  = parseFloat(get('sd-amt')?.value);
  const date = get('sd-date')?.value;
  const desc = get('sd-desc')?.value.trim();
  const cat  = get('sd-cat')?.value || 'General';

  if (isNaN(amt) || amt <= 0) { alert('Enter a valid amount.'); return; }
  if (!date)                   { alert('Select a date.'); return; }
  if (!desc)                   { alert('Enter a description.'); return; }

  const btn = get('sd-submit');
  if (btn) { btn.textContent = 'Recording...'; btn.disabled = true; }

  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'sadaqah'), {
      amt, date, desc, cat,
      uid:       currentUser.uid,
      createdAt: serverTimestamp()
    });

    // Clear form
    const a = get('sd-amt');  if(a) a.value = '';
    const d = get('sd-desc'); if(d) d.value = '';
    const dt= get('sd-date'); if(dt) dt.value = today();
    const c = get('sd-cat');  if(c) c.value = 'Masjid';

    // Show success
    showVerse(); // refresh verse on each record

  } catch (e) {
    alert('Error: ' + e.message);
  }

  if (btn) { btn.textContent = '🤲 Record Sadaqah'; btn.disabled = false; }
};

/* ══════════════════════════════════════
   DELETE SADAQAH
   ══════════════════════════════════════ */
window.delSD = async function(id) {
  if (!confirm('Remove this Sadaqah record?')) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'sadaqah', id));
  } catch (e) {
    alert('Error: ' + e.message);
  }
};

/* ── Helper ── */
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── Theme ── */
window.setTheme = function(th) {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('meezan-theme', th);
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title===th));
  const tl = document.getElementById('theme-label');
  if (tl) tl.textContent = 'Theme: ' + th.charAt(0).toUpperCase() + th.slice(1);
};
const _t = localStorage.getItem('meezan-theme') || 'glass';
document.documentElement.setAttribute('data-theme', _t);

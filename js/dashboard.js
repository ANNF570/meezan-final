/* ============================================================
   MEEZAN | js/dashboard.js
   FIXED: Saves user profile on login, loads real data
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot,
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

const GOLD = 6842, SILVER = 82, NISAB = 595;
const fmt   = n   => '₹' + Math.round(n||0).toLocaleString('en-IN');
const set   = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
const thisM = ()  => new Date().toISOString().slice(0, 7);
const IICO  = { Salary:'💼', Freelance:'💻', Rental:'🏠', Business:'🏪', Investment:'📈', Gift:'🎁', Other:'💡' };
const EICO  = { Food:'🍽️', Shopping:'🛍️', Transport:'🚆', Utilities:'💡', Charity:'🤲', Entertainment:'🎬', Education:'📚', Health:'🏥', Other:'💰' };

let income = [], expenses = [], ornaments = [], uid = '';

/* ══════════════════════════════════════
   AUTH GUARD + SAVE USER PROFILE
   ══════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = '../index.html'; return; }
  uid = user.uid;

  const init = (user.displayName || user.email || 'M').substring(0, 2).toUpperCase();
  set('desk-avatar', init);
  set('mob-avatar',  init);
  set('user-name',   user.displayName || user.email);

  /* ── CRITICAL: Save user profile to Firestore on every login ── */
  /* This creates the user document if it doesn't exist yet */
  try {
    await setDoc(doc(db, 'users', uid), {
      name:        user.displayName || '',
      email:       user.email,
      photoURL:    user.photoURL || '',
      lastLogin:   new Date().toISOString(),
      /* Don't overwrite existing fields — merge:true is key */
    }, { merge: true });
    console.log('User profile synced to Firestore ✓');
  } catch (e) {
    console.error('Profile sync failed:', e.message);
    /* If this fails, Firestore rules are likely blocking writes */
    if (e.code === 'permission-denied') {
      console.error('PERMISSION DENIED — Fix Firestore Security Rules!');
      console.error('Go to Firebase Console → Firestore → Rules');
      console.error('See FIRESTORE-RULES.txt for correct rules');
    }
  }

  /* ── Start real-time listeners for all data ── */
  const col = n => collection(db, 'users', uid, n);

  onSnapshot(
    query(col('income'), orderBy('date', 'desc')),
    snap => {
      income = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderIncome();
      updateMetrics();
    },
    err => console.error('Income listener error:', err.message)
  );

  onSnapshot(
    query(col('expenses'), orderBy('date', 'desc')),
    snap => {
      expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderExpenses();
      updateMetrics();
      buildChart();
    },
    err => console.error('Expenses listener error:', err.message)
  );

  onSnapshot(
    query(col('ornaments'), orderBy('date', 'desc')),
    snap => {
      ornaments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateMetals();
      updateMetrics();
    },
    err => console.error('Ornaments listener error:', err.message)
  );

  loadCalendar();
});

/* ══════════════════════════════════════
   RENDER RECENT INCOME (top 4)
   ══════════════════════════════════════ */
function renderIncome() {
  const el = document.getElementById('dash-income-list');
  if (!el) return;
  if (!income.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:.75rem">
      No income yet — <a href="income.html" style="color:var(--teal-lt)">Add →</a></div>`;
    return;
  }
  el.innerHTML = income.slice(0, 4).map(e => `
    <div class="income-row">
      <div class="ii ib-sal">${IICO[e.type] || '💡'}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.date} · ${e.type}</div>
      </div>
      <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--teal-lt)">+${fmt(e.amt)}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   RENDER RECENT EXPENSES (top 5)
   ══════════════════════════════════════ */
function renderExpenses() {
  const el = document.getElementById('dash-expense-list');
  if (!el) return;
  if (!expenses.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text-dim);text-align:center;padding:.75rem">
      No expenses yet — <a href="expenses.html" style="color:var(--fire-lt)">Add →</a></div>`;
    return;
  }
  el.innerHTML = expenses.slice(0, 5).map(e => `
    <div style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;
                background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);margin-bottom:6px">
      <div style="width:28px;height:28px;border-radius:7px;background:rgba(192,57,43,0.2);
                  display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">
        ${EICO[e.cat] || '💰'}
      </div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.date} · ${e.cat}</div>
      </div>
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--fire-lt)">-${fmt(e.amt)}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   UPDATE ALL METRIC CARDS
   ══════════════════════════════════════ */
function updateMetrics() {
  const m  = thisM();
  const mi = income.filter(e => (e.date||'').slice(0,7) === m).reduce((s,e) => s + (e.amt||0), 0);
  const ms = expenses.filter(e => (e.date||'').slice(0,7) === m).reduce((s,e) => s + (e.amt||0), 0);
  const ti = income.reduce((s,e) => s + (e.amt||0), 0);
  const ts = expenses.reduce((s,e) => s + (e.amt||0), 0);

  const kr  = k => k === 22 ? 22/24 : k === 18 ? 18/24 : k === 14 ? 14/24 : 1;
  const av  = ornaments.reduce((s,o) => s + (o.goldG||0)*GOLD*kr(o.goldK) + (o.silvG||0)*SILVER + (o.diamV||0) + (o.stonV||0) + (o.makeV||0), 0);
  const mv  = ornaments.reduce((s,o) => s + (o.goldG||0)*GOLD*kr(o.goldK) + (o.silvG||0)*SILVER, 0);
  const nv  = Math.round(NISAB * SILVER);
  const zd  = mv >= nv ? Math.round(mv * 0.025) : 0;

  set('m-spent',     fmt(ms));
  set('m-income',    fmt(mi));
  set('m-networth',  fmt(ti - ts + av));
  set('m-zakat',     zd > 0 ? fmt(zd) : 'None');
  set('m-zakat-sub', zd > 0 ? '2.5% on precious metals' : 'Nisab not met');

  const lp = ti > 0 ? Math.min(Math.round(ts/ti*100), 100) : 50;
  const sc = document.getElementById('scale-cursor');
  if (sc) sc.style.left = lp + '%';
  set('scale-status',
    lp < 40 ? '✨ Well balanced — spending under control' :
    lp < 65 ? '⚖️ Balanced — keep monitoring' :
              '⚠️ Tipping to fire — spending exceeds income');

  const pct    = mv > 0 ? Math.min(Math.round(mv/nv*100), 100) : 0;
  const offset = 201 - Math.round(pct/100*201);
  const rc = document.getElementById('zakat-ring-circle');
  if (rc) rc.setAttribute('stroke-dashoffset', offset);
  set('zakat-ring-pct',    pct + '%');
  set('zakat-ring-amount', zd > 0 ? fmt(zd) : 'None');
  set('zakat-ring-sub',    zd > 0 ? 'Pay your Zakat' : mv > 0 ? 'Building towards nisab' : 'Add assets to track');

  const zr = document.getElementById('zakat-detail-rows');
  if (zr) zr.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.04)">
      <span style="color:var(--text-mid)">Metal wealth</span>
      <span style="color:var(--gold);font-weight:600">${fmt(mv)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.04)">
      <span style="color:var(--text-mid)">Nisab threshold</span>
      <span style="color:var(--text-mid)">${fmt(nv)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.04)">
      <span style="color:var(--text-mid)">Nisab met?</span>
      <span style="${mv>=nv?'color:var(--teal-lt)':'color:var(--fire-lt)'}">
        ${mv>=nv?'✓ Yes':'✗ Not yet'}
      </span>
    </div>`;

  document.documentElement.classList.toggle('over-budget', ms > mi && mi > 0);
}

/* ══════════════════════════════════════
   METALS WIDGET
   ══════════════════════════════════════ */
function updateMetals() {
  const gg = ornaments.reduce((s,o) => s + (o.goldG||0), 0);
  const sg = ornaments.reduce((s,o) => s + (o.silvG||0), 0);
  set('dash-gold24',       '₹' + GOLD.toLocaleString('en-IN') + '/g');
  set('dash-silver',       '₹' + SILVER + '/g');
  set('dash-goldg',        gg.toFixed(2) + 'g → ' + fmt(gg*GOLD));
  set('dash-silvg',        sg.toFixed(2) + 'g → ' + fmt(sg*SILVER));
  set('dash-metals-total', fmt(gg*GOLD + sg*SILVER));
}

/* ══════════════════════════════════════
   MINI CHART (6 months)
   ══════════════════════════════════════ */
function buildChart() {
  const el = document.getElementById('mini-chart');
  if (!el) return;
  el.innerHTML = '';
  /* Ensure the container has height so bars are visible */
  el.style.cssText = 'display:flex;align-items:flex-end;gap:8px;height:72px;padding:0 4px 0;overflow-x:auto;';
  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0, 7);
    const lbl = d.toLocaleString('en', { month: 'short' });
    const sp  = expenses.filter(e => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    const ic  = income.filter(e  => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    months.push({ lbl, sp, ic });
  }
  const mx = Math.max(...months.map(m => Math.max(m.sp, m.ic)), 1);
  months.forEach(({ lbl, sp, ic }) => {
    const bw = document.createElement('div');
    bw.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;';
    bw.innerHTML = `
      <div style="display:flex;gap:2px;align-items:flex-end;height:52px">
        <div style="background:linear-gradient(180deg,#c0392b,#8b1a00);height:${Math.max(3,Math.round(sp/mx*52))}px;width:9px;border-radius:3px 3px 0 0;min-height:${sp>0?3:0}px"></div>
        <div style="background:linear-gradient(180deg,#1abc9c,#0d7a5f);height:${Math.max(3,Math.round(ic/mx*52))}px;width:9px;border-radius:3px 3px 0 0;min-height:${ic>0?3:0}px"></div>
      </div>
      <div style="font-size:9px;color:var(--text-dim);text-align:center">${lbl}</div>`;
    el.appendChild(bw);
  });
}

/* ══════════════════════════════════════
   HIJRI CALENDAR (Aladhan API — free)
   ══════════════════════════════════════ */
async function loadCalendar() {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2,'0');
  const mm   = String(now.getMonth()+1).padStart(2,'0');
  const yyyy = now.getFullYear();

  set('cal-greg-day',   now.getDate());
  set('cal-greg-month', now.toLocaleString('en', { month:'long' }) + ' ' + yyyy);
  set('cal-greg-wd',    now.toLocaleString('en', { weekday:'long' }));

  const td = document.getElementById('topbar-dates');
  if (td) td.textContent =
    now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) +
    '  ·  Loading Hijri...';

  try {
    const res  = await fetch(`https://api.aladhan.com/v1/gToH/${dd}-${mm}-${yyyy}`);
    const json = await res.json();
    const h    = json.data?.hijri;
    if (h) {
      set('cal-hijri-day',   h.day);
      set('cal-hijri-month', h.month.en + ' ' + h.year + ' AH');
      set('cal-hijri-wd',    h.weekday.ar);
      if (td) td.textContent =
        now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) +
        '  ·  ' + h.day + ' ' + h.month.en + ' ' + h.year + ' AH';
      const evEl = document.getElementById('cal-events');
      if (evEl) {
        const mn    = parseInt(h.month.number);
        const chips = [
          mn===9  ? '🌙 Ramadan — month of blessings' : null,
          mn===10 ? '🎉 Eid ul-Fitr month' : null,
          mn===12 ? '🐑 Eid ul-Adha approaching' : null,
          mn===1  ? '🕌 Muharram — Islamic New Year' : null,
        ].filter(Boolean);
        evEl.innerHTML = chips.slice(0,2).map(c => `<div class="cal-event">${c}</div>`).join('');
      }
    }
  } catch {
    set('cal-hijri-day',   '—');
    set('cal-hijri-month', 'API unavailable');
  }
}

/* ============================================================
   MEEZAN | js/income.js
   FIXED: All fields save correctly to Firebase Firestore
   ============================================================ */
import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, updateDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp
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

/* ── Constants ── */
const ICONS = { Salary:'💼', Freelance:'💻', Rental:'🏠', Business:'🏪', Investment:'📈', Gift:'🎁', Other:'💡' };
const TYPE_COLORS = { Salary:'#1abc9c', Freelance:'#d4a017', Rental:'#5dade2', Business:'#c0392b', Investment:'#9b59b6', Gift:'#e67e22', Other:'#95a5a6' };
const fmt       = n  => '₹' + Math.round(n||0).toLocaleString('en-IN');
const today     = () => new Date().toISOString().slice(0,10);
const thisMonth = () => new Date().toISOString().slice(0,7);
const escHtml   = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── State ── */
let allIncome = [], activeFilter = 'All', editingId = null, currentUser = null;

/* ══════════════════════════════════════
   AUTH GUARD
   ══════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (!user) { location.href = '../index.html'; return; }
  currentUser = user;

  const init = (user.displayName || user.email || 'M').substring(0,2).toUpperCase();
  const ma = document.getElementById('mob-avatar');
  if (ma) ma.textContent = init;

  /* Set today's date as default */
  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = today();

  /* Start real-time listener */
  startListener();
});

/* ══════════════════════════════════════
   REAL-TIME FIRESTORE LISTENER
   ══════════════════════════════════════ */
function startListener() {
  const q = query(
    collection(db, 'users', currentUser.uid, 'income'),
    orderBy('date', 'desc')
  );

  onSnapshot(q, snap => {
    allIncome = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
    updateSummary();
    buildChart();
    buildTypeBreakdown();
  }, err => {
    console.error('Income listener error:', err);
  });
}

/* ══════════════════════════════════════
   RENDER INCOME LIST (5 recent + show all)
   ══════════════════════════════════════ */
let showAllIncome = false;

function render() {
  const list = document.getElementById('income-list');
  if (!list) return;

  const data = activeFilter === 'All'
    ? allIncome
    : allIncome.filter(x => x.type === activeFilter);

  if (!data.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <div>${activeFilter === 'All'
          ? 'No income added yet.<br>Add your first income source using the form.'
          : 'No ' + activeFilter + ' income found.'}</div>
      </div>`;
    return;
  }

  const PREVIEW = 5;
  const visible = showAllIncome ? data : data.slice(0, PREVIEW);
  const hasMore = data.length > PREVIEW;

  const rowsHtml = visible.map(e => `
    <div class="income-row" id="row-${e.id}">
      <div class="income-icon" style="background:${TYPE_COLORS[e.type]||'#95a5a6'}22;border:1px solid ${TYPE_COLORS[e.type]||'#95a5a6'}44">
        ${ICONS[e.type] || '💡'}
      </div>
      <div class="income-info">
        <div class="income-name">${escHtml(e.name)}</div>
        <div class="income-meta">${e.date} · ${e.type || 'Other'} · ${e.currency || 'INR'}</div>
        ${e.recur && e.recur !== 'One-off' ? `<span class="income-recur">${e.recur}</span>` : ''}
        ${e.notes ? `<div class="income-meta" style="color:var(--text-mid);margin-top:2px">${escHtml(e.notes)}</div>` : ''}
      </div>
      <div class="income-right">
        <div class="income-amount">+${fmt(e.amt)}</div>
        <div class="income-actions">
          <div class="act-btn act-edit" onclick="editIncome('${e.id}')" title="Edit">✏️</div>
          <div class="act-btn act-del"  onclick="deleteIncome('${e.id}')" title="Delete">🗑️</div>
        </div>
      </div>
    </div>`).join('');

  const toggleBtn = hasMore ? `
    <div style="text-align:center;margin-top:10px">
      <button onclick="toggleShowAllIncome()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
        color:var(--teal-lt);padding:7px 20px;border-radius:20px;font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.2s"
        onmouseover="this.style.background='rgba(26,188,156,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
        ${showAllIncome ? '▲ Show less' : '▼ Show all ' + data.length + ' records'}
      </button>
    </div>` : '';

  list.innerHTML = rowsHtml + toggleBtn;
}

window.toggleShowAllIncome = function() {
  showAllIncome = !showAllIncome;
  render();
};

/* ══════════════════════════════════════
   SUMMARY BAR
   ══════════════════════════════════════ */
function updateSummary() {
  const total  = allIncome.reduce((s,e) => s + (e.amt||0), 0);
  const month  = allIncome.filter(e => (e.date||'').slice(0,7) === thisMonth()).reduce((s,e) => s + (e.amt||0), 0);
  const salary = allIncome.filter(e => e.type === 'Salary').reduce((s,e) => s + (e.amt||0), 0);
  const other  = total - salary;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('s-total',  fmt(total));
  set('s-month',  fmt(month));
  set('s-salary', fmt(salary));
  set('s-other',  fmt(other));
}

/* ══════════════════════════════════════
   MONTHLY CHART
   ══════════════════════════════════════ */
function buildChart() {
  const el = document.getElementById('income-chart');
  if (!el) return;
  el.innerHTML = '';
  el.style.cssText = 'display:flex;align-items:flex-end;gap:8px;height:72px;padding:0 4px;overflow-x:auto;';

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = d.toLocaleString('en', { month:'short' });
    months.push({ key, lbl });
  }

  const salByM = {}, freeByM = {}, otherByM = {};
  months.forEach(m => { salByM[m.key] = 0; freeByM[m.key] = 0; otherByM[m.key] = 0; });

  allIncome.forEach(e => {
    const k = (e.date||'').slice(0,7);
    if (salByM[k]  !== undefined && e.type === 'Salary')    salByM[k]   += e.amt||0;
    if (freeByM[k] !== undefined && e.type === 'Freelance') freeByM[k]  += e.amt||0;
    if (otherByM[k]!== undefined && !['Salary','Freelance'].includes(e.type)) otherByM[k] += e.amt||0;
  });

  const maxV = Math.max(...months.map(m => salByM[m.key] + freeByM[m.key] + otherByM[m.key]), 1);

  months.forEach(({ key, lbl }) => {
    const sh = Math.max(salByM[key]   > 0 ? 3 : 0, Math.round(salByM[key]   / maxV * 52));
    const fh = Math.max(freeByM[key]  > 0 ? 3 : 0, Math.round(freeByM[key]  / maxV * 52));
    const oh = Math.max(otherByM[key] > 0 ? 3 : 0, Math.round(otherByM[key] / maxV * 52));
    const bw = document.createElement('div');
    bw.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;';
    bw.innerHTML = `
      <div style="display:flex;gap:2px;align-items:flex-end;height:52px">
        <div style="background:#1abc9c;height:${sh}px;width:8px;border-radius:3px 3px 0 0"></div>
        <div style="background:#d4a017;height:${fh}px;width:8px;border-radius:3px 3px 0 0"></div>
        <div style="background:#5dade2;height:${oh}px;width:8px;border-radius:3px 3px 0 0"></div>
      </div>
      <div style="font-size:9px;color:var(--text-dim);text-align:center">${lbl}</div>`;
    el.appendChild(bw);
  });
}

/* ══════════════════════════════════════
   TYPE BREAKDOWN
   ══════════════════════════════════════ */
function buildTypeBreakdown() {
  const el = document.getElementById('type-breakdown');
  if (!el) return;

  const total = allIncome.reduce((s,e) => s + (e.amt||0), 0) || 1;
  const byType = {};
  allIncome.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + (e.amt||0);
  });

  const sorted = Object.entries(byType).sort((a,b) => b[1] - a[1]);

  el.innerHTML = sorted.map(([type, amt]) => `
    <div class="type-row">
      <div class="type-icon">${ICONS[type]||'💡'}</div>
      <div class="type-label">${type}</div>
      <div class="type-bar-wrap">
        <div class="type-bar-track">
          <div class="type-bar-fill" style="width:${Math.round(amt/total*100)}%;background:${TYPE_COLORS[type]||'#95a5a6'}"></div>
        </div>
      </div>
      <div class="type-amount">${fmt(amt)}</div>
    </div>`).join('')
    || '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.5rem">No data yet</div>';
}

/* ══════════════════════════════════════
   FILTER
   ══════════════════════════════════════ */
window.filterType = function(type, el) {
  activeFilter = type;
  document.querySelectorAll('#type-filters .cf').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  render();
};

/* ══════════════════════════════════════
   ADD / EDIT FORM — SUBMIT
   ══════════════════════════════════════ */
window.submitForm = async function() {
  /* Read all form fields */
  const name     = document.getElementById('f-name')?.value.trim();
  const amt      = parseFloat(document.getElementById('f-amt')?.value);
  const type     = document.getElementById('f-type')?.value || 'Other';
  const recur    = document.getElementById('f-recur')?.value || 'One-off';
  const date     = document.getElementById('f-date')?.value;
  const currency = document.getElementById('f-currency')?.value || 'INR';
  const notes    = document.getElementById('f-notes')?.value.trim() || '';

  /* Validate */
  if (!name)           { alert('Please enter a source name.'); return; }
  if (isNaN(amt)||amt<=0) { alert('Please enter a valid amount greater than 0.'); return; }
  if (!date)           { alert('Please select a date.'); return; }

  /* Build data object — every field explicitly set */
  const data = {
    name:     name,
    amt:      amt,
    type:     type,
    recur:    recur,
    date:     date,
    currency: currency,
    notes:    notes,
    uid:      currentUser.uid
  };

  const btn = document.getElementById('add-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    if (editingId) {
      /* UPDATE existing record */
      await updateDoc(doc(db, 'users', currentUser.uid, 'income', editingId), data);
      cancelEdit();
    } else {
      /* ADD new record */
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'users', currentUser.uid, 'income'), data);
    }
    clearForm();
    console.log('Income saved ✓', data);
  } catch (err) {
    alert('Error saving income: ' + err.message);
    console.error(err);
  }

  if (btn) { btn.textContent = '+ Add Income'; btn.disabled = false; }
};

/* ══════════════════════════════════════
   EDIT INCOME
   ══════════════════════════════════════ */
window.editIncome = function(id) {
  const row = allIncome.find(x => x.id === id);
  if (!row) return;

  editingId = id;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('f-name',     row.name);
  set('f-amt',      row.amt);
  set('f-type',     row.type     || 'Other');
  set('f-recur',    row.recur    || 'One-off');
  set('f-date',     row.date);
  set('f-currency', row.currency || 'INR');
  set('f-notes',    row.notes    || '');

  const ft = document.getElementById('form-title');
  const ab = document.getElementById('add-btn');
  const cb = document.getElementById('cancel-btn');
  if (ft) ft.textContent = '✏️ Edit Income';
  if (ab) { ab.textContent = '✓ Save Changes'; ab.classList.remove('btn-teal'); ab.classList.add('btn-gold'); }
  if (cb) cb.style.display = 'block';

  ab?.scrollIntoView({ behavior:'smooth', block:'center' });
};

/* ══════════════════════════════════════
   CANCEL EDIT
   ══════════════════════════════════════ */
window.cancelEdit = function() {
  editingId = null;
  clearForm();

  const ft = document.getElementById('form-title');
  const ab = document.getElementById('add-btn');
  const cb = document.getElementById('cancel-btn');
  if (ft) ft.textContent = '➕ Add Income Source';
  if (ab) { ab.textContent = '+ Add Income'; ab.classList.add('btn-teal'); ab.classList.remove('btn-gold'); }
  if (cb) cb.style.display = 'none';
};

/* ══════════════════════════════════════
   DELETE INCOME
   ══════════════════════════════════════ */
window.deleteIncome = async function(id) {
  if (!confirm('Delete this income record? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'income', id));
  } catch (e) {
    alert('Error deleting: ' + e.message);
  }
};

/* ══════════════════════════════════════
   CLEAR FORM
   ══════════════════════════════════════ */
function clearForm() {
  ['f-name', 'f-amt', 'f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const type = document.getElementById('f-type');     if (type) type.value = 'Salary';
  const recur= document.getElementById('f-recur');    if (recur) recur.value = 'One-off';
  const cur  = document.getElementById('f-currency'); if (cur) cur.value = 'INR';
  const date = document.getElementById('f-date');     if (date) date.value = today();
}

/* ── Theme ── */
window.setTheme = function(th) {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('meezan-theme', th);
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title === th));
};
const _t = localStorage.getItem('meezan-theme') || 'glass';
document.documentElement.setAttribute('data-theme', _t);

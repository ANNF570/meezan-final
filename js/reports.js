/* ============================================================
   MEEZAN — ميزان  |  js/reports.js
   Charts & Reports — income vs expenses, category pie,
   net saved trend, top expenses, weekly view, income breakdown
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot
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

const fmt = n => '₹' + Math.round(n||0).toLocaleString('en-IN');
const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

const EICONS  = { Food:'🍽️',Shopping:'🛍️',Transport:'🚆',Utilities:'💡',Charity:'🤲',Entertainment:'🎬',Education:'📚',Health:'🏥',Zakat:'⚖️',Other:'💰' };
const ECOLORS = { Food:'#e74c3c',Shopping:'#9b59b6',Transport:'#3498db',Utilities:'#e67e22',Charity:'#1abc9c',Entertainment:'#f39c12',Education:'#2ecc71',Health:'#16a085',Zakat:'#48d1b0',Other:'#95a5a6' };
const IICONS  = { Salary:'💼', Freelance:'💻', Rental:'🏠', Business:'🏪', Investment:'📈', Gift:'🎁', Other:'💡' };
const ICOLORS = { Salary:'#1abc9c', Freelance:'#d4a017', Rental:'#5dade2', Business:'#c0392b', Investment:'#9b59b6', Gift:'#e67e22', Other:'#95a5a6' };

let income = [], expenses = [], sadaqah = [], zakatPayments = [], periodMonths = 6, uid = '';

/* ── AUTH ── */
onAuthStateChanged(auth, user => {
  if (!user) { location.href = '../index.html'; return; }
  uid = user.uid;

  const col = n => collection(db, 'users', uid, n);

  onSnapshot(query(col('income'),   orderBy('date','desc')), snap => {
    income = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(col('expenses'), orderBy('date','desc')), snap => {
    expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(col('sadaqah'), orderBy('date','desc')), snap => {
    sadaqah = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  onSnapshot(query(col('zakatPayments'), orderBy('date','desc')), snap => {
    zakatPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
});

/* ── PERIOD FILTER ── */
window.setPeriod = function(months, el) {
  periodMonths = months;
  document.querySelectorAll('.cat-filters .cf').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderAll();
};

function getDateCutoff() {
  if (!periodMonths) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - periodMonths);
  return d.toISOString().slice(0, 10);
}

function filteredIncome() {
  const cut = getDateCutoff();
  return cut ? income.filter(e => (e.date||'') >= cut) : income;
}

function filteredExpenses() {
  const cut = getDateCutoff();
  return cut ? expenses.filter(e => (e.date||'') >= cut) : expenses;
}

function renderAll() {
  updateSummaryCards();
  buildIncExpChart();
  buildCategoryPie();
  buildNetWorthChart();
  buildTopExpenses();
  buildIncomeBreakdown();
  buildWeeklyView();
  buildSpendingDeepDive();
  buildIslamicMonthly();
}

/* ══════════════════════════════════════
   SUMMARY CARDS
   ══════════════════════════════════════ */
function updateSummaryCards() {
  const inc = filteredIncome();
  const exp = filteredExpenses();
  const ti = inc.reduce((s,e) => s + (e.amt||0), 0);
  const te = exp.reduce((s,e) => s + (e.amt||0), 0);
  const net = ti - te;
  const rate = ti > 0 ? Math.round((net / ti) * 100) : 0;

  set('r-income',      fmt(ti));
  set('r-income-sub',  inc.length + ' records');
  set('r-expense',     fmt(te));
  set('r-expense-sub', exp.length + ' records');
  set('r-net',         fmt(net));
  set('r-net-sub',     'Income − expenses');
  set('r-rate',        (rate >= 0 ? rate : 0) + '%');

  const netEl = document.getElementById('r-net');
  if (netEl) netEl.style.color = net >= 0 ? 'var(--teal-lt)' : 'var(--fire-lt)';
}

/* ══════════════════════════════════════
   INCOME VS EXPENSES BAR CHART
   ══════════════════════════════════════ */
function buildIncExpChart() {
  const el = document.getElementById('chart-inc-exp');
  if (!el) return;
  el.innerHTML = '';

  const now = new Date();
  const count = periodMonths || 12;
  const months = [];

  for (let i = count - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = d.toLocaleString('en', { month: 'short' });
    const yr  = d.getFullYear().toString().slice(2);
    const inc = income.filter(e  => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    const exp = expenses.filter(e => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    months.push({ lbl, yr, key, inc, exp });
  }

  const mx = Math.max(...months.map(m => Math.max(m.inc, m.exp)), 1);
  const BAR_H = 120;

  months.forEach(({ lbl, yr, inc, exp }) => {
    const ih = Math.max(inc > 0 ? 3 : 0, Math.round(inc / mx * BAR_H));
    const eh = Math.max(exp > 0 ? 3 : 0, Math.round(exp / mx * BAR_H));
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:28px;';
    col.innerHTML = `
      <div style="display:flex;gap:2px;align-items:flex-end;height:${BAR_H}px">
        <div title="Income: ${fmt(inc)}" style="background:linear-gradient(180deg,#1abc9c,#0d7a5f);height:${ih}px;width:10px;border-radius:3px 3px 0 0;cursor:default"></div>
        <div title="Expenses: ${fmt(exp)}" style="background:linear-gradient(180deg,#e74c3c,#8b1a00);height:${eh}px;width:10px;border-radius:3px 3px 0 0;cursor:default"></div>
      </div>
      <div style="font-size:9px;color:var(--text-dim);text-align:center">${lbl}<br><span style="font-size:8px;opacity:.6">'${yr}</span></div>`;
    el.appendChild(col);
  });
}

/* ══════════════════════════════════════
   CATEGORY PIE CHART (CSS conic-gradient)
   ══════════════════════════════════════ */
function buildCategoryPie() {
  const wrap = document.getElementById('cat-pie-wrap');
  if (!wrap) return;

  const exp = filteredExpenses();
  const total = exp.reduce((s,e) => s + (e.amt||0), 0) || 1;
  const byC = {};
  exp.forEach(e => { byC[e.cat] = (byC[e.cat]||0) + (e.amt||0); });
  const sorted = Object.entries(byC).sort((a,b) => b[1]-a[1]);

  if (!sorted.length) {
    wrap.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">No expense data for this period</div>';
    return;
  }

  // Build conic-gradient segments
  let cum = 0;
  const segments = sorted.map(([cat, amt]) => {
    const pct = amt / total * 100;
    const start = cum;
    cum += pct;
    return { cat, amt, pct, start, end: cum, color: ECOLORS[cat]||'#95a5a6' };
  });

  const gradStops = segments.map(s =>
    `${s.color} ${s.start.toFixed(1)}% ${s.end.toFixed(1)}%`
  ).join(', ');

  wrap.innerHTML = `
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      <div style="position:relative;flex-shrink:0;width:150px;height:150px;margin:8px auto">
        <div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(${gradStops});box-shadow:0 0 20px rgba(0,0,0,0.3)"></div>
        <div style="position:absolute;inset:30px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-direction:column">
          <div style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--fire-lt)">${fmt(total)}</div>
          <div style="font-size:9px;color:var(--text-dim)">total</div>
        </div>
      </div>
      <div style="flex:1;min-width:150px">
        ${segments.map(s => `
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <div style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0"></div>
            <div style="font-size:11px;flex:1;color:var(--text-mid)">${EICONS[s.cat]||'💰'} ${s.cat}</div>
            <div style="font-size:11px;font-weight:600;color:var(--text);min-width:40px;text-align:right">${Math.round(s.pct)}%</div>
            <div style="font-size:10px;color:var(--text-dim);min-width:60px;text-align:right">${fmt(s.amt)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   CUMULATIVE NET SAVED LINE CHART
   ══════════════════════════════════════ */
function buildNetWorthChart() {
  const el = document.getElementById('chart-networth');
  if (!el) return;
  el.innerHTML = '';

  const now = new Date();
  const count = periodMonths || 12;
  const months = [];
  let cumNet = 0;

  for (let i = count - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = d.toLocaleString('en', { month: 'short' });
    const inc = income.filter(e  => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    const exp = expenses.filter(e => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    cumNet += inc - exp;
    months.push({ lbl, key, net: cumNet });
  }

  const maxV = Math.max(...months.map(m => Math.abs(m.net)), 1);
  const BAR_H = 100;

  months.forEach(({ lbl, net }) => {
    const h = Math.max(net !== 0 ? 3 : 0, Math.round(Math.abs(net) / maxV * BAR_H));
    const isPos = net >= 0;
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:24px;';
    col.innerHTML = `
      <div style="display:flex;align-items:flex-end;height:${BAR_H}px">
        <div title="${fmt(net)}" style="background:${isPos ? 'linear-gradient(180deg,#1abc9c,#0d5f49)' : 'linear-gradient(180deg,#e74c3c,#8b1a00)'};height:${h}px;width:14px;border-radius:3px 3px 0 0;cursor:default"></div>
      </div>
      <div style="font-size:9px;color:var(--text-dim);text-align:center">${lbl}</div>`;
    el.appendChild(col);
  });
}

/* ══════════════════════════════════════
   TOP EXPENSES TABLE
   ══════════════════════════════════════ */
function buildTopExpenses() {
  const el = document.getElementById('top-expenses');
  if (!el) return;

  const exp = filteredExpenses();
  const sorted = [...exp].sort((a,b) => (b.amt||0) - (a.amt||0)).slice(0, 8);

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">No expenses for this period</div>';
    return;
  }

  el.innerHTML = sorted.map((e, i) => `
    <div style="display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:9px;
                background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);margin-bottom:5px">
      <div style="width:20px;text-align:center;font-size:11px;color:var(--text-dim);font-family:'Cinzel',serif">${i+1}</div>
      <div style="width:28px;height:28px;border-radius:7px;background:${ECOLORS[e.cat]||'#95a5a6'}22;
                  display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${EICONS[e.cat]||'💰'}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${e.name}</div>
        <div style="font-size:10px;color:var(--text-dim)">${e.date} · ${e.cat}</div>
      </div>
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--fire-lt)">-${fmt(e.amt)}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   INCOME BREAKDOWN BY TYPE
   ══════════════════════════════════════ */
function buildIncomeBreakdown() {
  const el = document.getElementById('income-breakdown');
  if (!el) return;

  const inc = filteredIncome();
  const total = inc.reduce((s,e) => s+(e.amt||0), 0) || 1;
  const byType = {};
  inc.forEach(e => { byType[e.type] = (byType[e.type]||0) + (e.amt||0); });
  const sorted = Object.entries(byType).sort((a,b) => b[1]-a[1]);

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">No income for this period</div>';
    return;
  }

  // Build conic for income too
  let cum2 = 0;
  const segs = sorted.map(([type, amt]) => {
    const pct = amt/total*100;
    const start = cum2;
    cum2 += pct;
    return { type, amt, pct, start, end: cum2, color: ICOLORS[type]||'#95a5a6' };
  });

  const grad2 = segs.map(s => `${s.color} ${s.start.toFixed(1)}% ${s.end.toFixed(1)}%`).join(', ');

  el.innerHTML = `
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      <div style="position:relative;flex-shrink:0;width:120px;height:120px;margin:8px">
        <div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(${grad2})"></div>
        <div style="position:absolute;inset:24px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-direction:column">
          <div style="font-family:'Cinzel',serif;font-size:10px;font-weight:700;color:var(--teal-lt)">${fmt(total)}</div>
          <div style="font-size:8px;color:var(--text-dim)">total income</div>
        </div>
      </div>
      <div style="flex:1;min-width:180px">
        ${segs.map(s => `
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)">
            <div style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0"></div>
            <div style="font-size:12px;flex:1">${IICONS[s.type]||'💡'} ${s.type}</div>
            <div style="font-size:10px;color:var(--text-dim)">${Math.round(s.pct)}%</div>
            <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--teal-lt)">${fmt(s.amt)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   WEEKLY VIEW (navigable)
   ══════════════════════════════════════ */
let weekOffset = 0;

function getWeekRange(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset * 7));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function buildWeeklyView() {
  const el = document.getElementById('weekly-view-content');
  if (!el) return; // element may not exist if not in this version of reports.html

  const { start, end } = getWeekRange(weekOffset);
  const startStr = start.toISOString().slice(0,10);
  const endStr   = end.toISOString().slice(0,10);
  const isCurrentWeek = weekOffset === 0;

  const titleEl = document.getElementById('weekly-title');
  const subtitleEl = document.getElementById('weekly-subtitle');
  if (titleEl) titleEl.textContent =
    start.toLocaleDateString('en-IN', {day:'numeric',month:'short'}) + ' – ' +
    end.toLocaleDateString('en-IN',   {day:'numeric',month:'short'});
  if (subtitleEl) subtitleEl.textContent = isCurrentWeek ? 'Current week' : '';

  const weekInc = income.filter(e  => (e.date||'') >= startStr && (e.date||'') <= endStr);
  const weekExp = expenses.filter(e => (e.date||'') >= startStr && (e.date||'') <= endStr);
  const totalInc = weekInc.reduce((s,e) => s+(e.amt||0),0);
  const totalExp = weekExp.reduce((s,e) => s+(e.amt||0),0);
  const net = totalInc - totalExp;
  const txCount = weekInc.length + weekExp.length;

  const statsEl = document.getElementById('weekly-stats');
  if (statsEl) statsEl.innerHTML = `
    <div style="text-align:center"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Income</div><div style="color:var(--teal-lt);font-family:'Cinzel',serif;font-size:13px">+${fmt(totalInc)}</div></div>
    <div style="text-align:center"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Spent</div><div style="color:var(--fire-lt);font-family:'Cinzel',serif;font-size:13px">-${fmt(totalExp)}</div></div>
    <div style="text-align:center"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Net</div><div style="${net>=0?'color:var(--teal-lt)':'color:var(--fire-lt)'};font-family:'Cinzel',serif;font-size:13px">₹ ${net>=0?'+':''}${Math.round(net).toLocaleString('en-IN')}</div></div>
    <div style="text-align:center"><div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Transactions</div><div style="font-family:'Cinzel',serif;font-size:13px">${txCount}</div></div>`;

  // Group by date descending
  const allTx = [
    ...weekInc.map(e => ({...e, _type:'inc'})),
    ...weekExp.map(e => ({...e, _type:'exp'}))
  ].sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const byDate = {};
  allTx.forEach(e => { if (!byDate[e.date]) byDate[e.date]=[]; byDate[e.date].push(e); });

  el.innerHTML = Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).map(date => {
    const d = new Date(date+'T12:00:00');
    const dayLbl = d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();
    return `
      <div style="font-size:10px;color:var(--text-dim);font-family:'Cinzel',serif;letter-spacing:1px;margin:10px 0 5px">${dayLbl}</div>
      ${byDate[date].map(e => `
        <div style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;
                    background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);margin-bottom:4px">
          <div style="width:28px;height:28px;border-radius:7px;background:${e._type==='inc'?'rgba(26,188,156,0.15)':'rgba(192,57,43,0.15)'};
                      display:flex;align-items:center;justify-content:center;font-size:13px">
            ${e._type==='inc' ? (IICONS[e.type]||'💡') : (EICONS[e.cat]||'💰')}
          </div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600">${e.name}</div>
            <div style="font-size:10px;color:var(--text-dim)">${e._type==='inc' ? e.type : e.cat}</div>
          </div>
          <div style="font-family:'Cinzel',serif;font-size:12px;color:${e._type==='inc'?'var(--teal-lt)':'var(--fire-lt)'}">
            ${e._type==='inc'?'+':'-'}${fmt(e.amt)}
          </div>
        </div>`).join('')}`;
  }).join('') || '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">No transactions this week</div>';
}

window.changeWeek = function(delta) {
  weekOffset += delta;
  buildWeeklyView();
};

/* ══════════════════════════════════════
   SPENDING DEEP DIVE BY CATEGORY
   ══════════════════════════════════════ */
function buildSpendingDeepDive() {
  const el = document.getElementById('spending-deepdive');
  if (!el) return;

  const exp = filteredExpenses();
  const byC = {};
  exp.forEach(e => {
    if (!byC[e.cat]) byC[e.cat] = [];
    byC[e.cat].push(e);
  });
  const sorted = Object.entries(byC).sort((a,b) =>
    b[1].reduce((s,x)=>s+x.amt,0) - a[1].reduce((s,x)=>s+x.amt,0)
  );

  const total = exp.reduce((s,e)=>s+(e.amt||0),0)||1;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
    ${sorted.map(([cat, items]) => {
      const catTotal = items.reduce((s,e)=>s+(e.amt||0),0);
      const pct = Math.round(catTotal/total*100);
      const topItems = items.sort((a,b)=>b.amt-a.amt).slice(0,5);
      return `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:18px">${EICONS[cat]||'💰'}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${cat}</div>
              <div style="font-size:10px;color:var(--text-dim)">${items.length} transactions</div>
            </div>
            <div style="margin-left:auto;text-align:right">
              <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--fire-lt)">${fmt(catTotal)}</div>
              <div style="font-size:10px;color:var(--text-dim)">${pct}% of spend</div>
            </div>
          </div>
          <div style="height:3px;border-radius:2px;background:rgba(255,255,255,0.08);margin-bottom:8px">
            <div style="height:3px;border-radius:2px;background:${ECOLORS[cat]||'#95a5a6'};width:${pct}%"></div>
          </div>
          ${topItems.map(e => `
            <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <span style="color:var(--text-mid)">${e.name}</span>
              <span style="color:var(--text-dim)">${e.date}</span>
              <span style="color:var(--fire-lt)">-${fmt(e.amt)}</span>
            </div>`).join('')}
        </div>`;
    }).join('')}
    </div>`;
}

/* ══════════════════════════════════════
   SADAQAH + ZAKAT MONTHLY TRACKER
   ══════════════════════════════════════ */
const NISAB_VALUE = 595 * 82; // grams silver * price

function buildIslamicMonthly() {
  const el = document.getElementById('islamic-monthly');
  if (!el) return;

  const now = new Date();
  const count = periodMonths || 6;
  const months = [];

  for (let i = count - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = d.toLocaleString('en', { month: 'short', year: '2-digit' });

    const monthInc = income.filter(e => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    const monthExp = expenses.filter(e => (e.date||'').slice(0,7) === key).reduce((s,e) => s+(e.amt||0), 0);
    const monthSavings = Math.max(0, monthInc - monthExp);
    const zakatDue = monthSavings >= NISAB_VALUE ? Math.round(monthSavings * 0.025) : 0;
    const zakatPaid = zakatPayments.filter(p => (p.date||'').slice(0,7) === key).reduce((s,p) => s+(p.amount||0), 0);
    const zakatRemaining = Math.max(0, zakatDue - zakatPaid);
    const zakatComplete = zakatDue > 0 && zakatPaid >= zakatDue;

    const sdqAmt = sadaqah.filter(s => (s.date||'').slice(0,7) === key).reduce((s,x) => s+(x.amt||0), 0);
    const sdqCount = sadaqah.filter(s => (s.date||'').slice(0,7) === key).length;

    months.push({ key, lbl, monthInc, monthSavings, zakatDue, zakatPaid, zakatRemaining, zakatComplete, sdqAmt, sdqCount });
  }

  const totalSadaqah = months.reduce((s,m) => s + m.sdqAmt, 0);
  const totalZakatPaid = months.reduce((s,m) => s + m.zakatPaid, 0);
  const totalZakatDue = months.reduce((s,m) => s + m.zakatDue, 0);
  const fmt2 = n => '₹' + Math.round(n||0).toLocaleString('en-IN');

  el.innerHTML = `
    <!-- Summary strip -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:rgba(26,188,156,0.08);border:1px solid rgba(26,188,156,0.2);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Sadaqah Given</div>
        <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--teal-lt);margin-top:4px">${fmt2(totalSadaqah)}</div>
        <div style="font-size:10px;color:var(--text-dim)">${months.reduce((s,m)=>s+m.sdqCount,0)} acts</div>
      </div>
      <div style="background:rgba(212,160,23,0.08);border:1px solid rgba(212,160,23,0.2);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Zakat Due</div>
        <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--gold-lt);margin-top:4px">${totalZakatDue > 0 ? fmt2(totalZakatDue) : '—'}</div>
        <div style="font-size:10px;color:var(--text-dim)">across period</div>
      </div>
      <div style="background:rgba(72,209,176,0.08);border:1px solid rgba(72,209,176,0.2);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">Zakat Paid</div>
        <div style="font-family:'Cinzel',serif;font-size:16px;color:var(--teal-lt);margin-top:4px">${totalZakatPaid > 0 ? fmt2(totalZakatPaid) : '—'}</div>
        <div style="font-size:10px;color:${totalZakatDue > 0 && totalZakatPaid >= totalZakatDue ? 'var(--teal-lt)' : 'var(--amber, #e67e22)'}">${totalZakatDue > 0 ? (totalZakatPaid >= totalZakatDue ? '✅ Fully paid' : fmt2(Math.max(0,totalZakatDue-totalZakatPaid)) + ' remaining') : 'No zakat due'}</div>
      </div>
    </div>

    <!-- Month-by-month table -->
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
            <th style="text-align:left;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">MONTH</th>
            <th style="text-align:right;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">SAVINGS</th>
            <th style="text-align:right;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">ZAKAT DUE</th>
            <th style="text-align:right;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">ZAKAT PAID</th>
            <th style="text-align:center;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">STATUS</th>
            <th style="text-align:right;padding:8px 10px;color:var(--text-dim);font-family:'Cinzel',serif;font-size:10px;letter-spacing:1px;font-weight:400">SADAQAH</th>
          </tr>
        </thead>
        <tbody>
          ${months.map(m => {
            const isCurrentMonth = m.key === (now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'));
            let statusHtml = '';
            if (m.zakatDue === 0) {
              statusHtml = `<span style="color:var(--text-dim);font-size:10px">Nisab not met</span>`;
            } else if (m.zakatComplete) {
              statusHtml = `<span style="background:rgba(26,188,156,0.15);color:var(--teal-lt);padding:2px 8px;border-radius:20px;font-size:10px">✅ Complete</span>`;
            } else {
              statusHtml = `<span style="background:rgba(231,76,60,0.15);color:var(--fire-lt);padding:2px 8px;border-radius:20px;font-size:10px">⚠️ ${fmt2(m.zakatRemaining)} due</span>`;
            }
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);${isCurrentMonth ? 'background:rgba(255,255,255,0.03);' : ''}">
                <td style="padding:10px 10px;font-weight:${isCurrentMonth ? '700' : '400'};color:${isCurrentMonth ? 'var(--gold-lt)' : 'var(--text)'}">
                  ${m.lbl}${isCurrentMonth ? ' <span style="font-size:9px;color:var(--gold-lt)">(now)</span>' : ''}
                </td>
                <td style="padding:10px 10px;text-align:right;color:var(--text-mid);font-family:'Cinzel',serif">${m.monthSavings > 0 ? fmt2(m.monthSavings) : '—'}</td>
                <td style="padding:10px 10px;text-align:right;font-family:'Cinzel',serif;color:${m.zakatDue > 0 ? 'var(--gold-lt)' : 'var(--text-dim)'}">${m.zakatDue > 0 ? fmt2(m.zakatDue) : '—'}</td>
                <td style="padding:10px 10px;text-align:right;font-family:'Cinzel',serif;color:var(--teal-lt)">${m.zakatPaid > 0 ? fmt2(m.zakatPaid) : '—'}</td>
                <td style="padding:10px 10px;text-align:center">${statusHtml}</td>
                <td style="padding:10px 10px;text-align:right;font-family:'Cinzel',serif;color:var(--teal-lt)">${m.sdqAmt > 0 ? fmt2(m.sdqAmt) : '—'}${m.sdqCount > 0 ? `<span style="display:block;font-size:9px;color:var(--text-dim);font-family:inherit">${m.sdqCount} act${m.sdqCount>1?'s':''}</span>` : ''}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

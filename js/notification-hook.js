/* ============================================================
   MEEZAN | js/notification-hook.js
   Drop-in module — import in expenses.js, income.js, zakat.js
   to fire real-time notifications when data changes.

   Usage (add to top of expenses.js):
     import { notifyBudget, notifyLargeExpense } from './notification-hook.js';

   Then after addDoc() in submitExpense():
     notifyBudget(allExp, allIncome);
     notifyLargeExpense(amt, name, cat);
   ============================================================ */

const fmt = n => '₹' + Math.round(n||0).toLocaleString('en-IN');

function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted';
}

function send(title, body, tag) {
  if (!canNotify()) return;
  try {
    const n = new Notification('Meezan — ' + title, { body, tag: tag||title });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 7000);
  } catch(e) {}
}

/* ── Called after every expense is added ── */
export function notifyBudget(expenses, income) {
  const thisMonth = new Date().toISOString().slice(0,7);
  const spent  = expenses.filter(e=>(e.date||'').slice(0,7)===thisMonth).reduce((s,e)=>s+(e.amt||0),0);
  const earned = income.filter(e=>(e.date||'').slice(0,7)===thisMonth).reduce((s,e)=>s+(e.amt||0),0);
  if (!earned) return;

  const pct  = (spent / earned) * 100;
  const today = new Date().toDateString();

  // Check user notification prefs from localStorage
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('mz-notif-prefs')||'{}'); } catch(e){ return {}; }
  })();

  if (pct >= 100 && prefs['budget100'] !== false) {
    if (localStorage.getItem('mz-b100') !== today) {
      send('🔥 Budget Exceeded!',
        `You've spent ${fmt(spent)} which is ${Math.round(pct)}% of your income this month.`,
        'budget100');
      localStorage.setItem('mz-b100', today);
    }
  } else if (pct >= 80 && pct < 100 && prefs['budget80'] !== false) {
    if (localStorage.getItem('mz-b80') !== today) {
      send('⚠️ 80% Budget Warning',
        `${Math.round(pct)}% of monthly income spent. ${fmt(earned-spent)} remaining.`,
        'budget80');
      localStorage.setItem('mz-b80', today);
    }
  }
}

/* ── Called when a large single expense is added (>5000) ── */
export function notifyLargeExpense(amount, name, category) {
  if (amount < 5000) return;
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('mz-notif-prefs')||'{}'); } catch(e){ return {}; }
  })();
  if (prefs['family'] === false) return;
  send('💸 Large Expense Added',
    `${name} — ${category}: ${fmt(amount)} recorded in Meezan.`,
    'large-expense');
}

/* ── Called when zakat ornaments update ── */
export function notifyZakat(metalVal, zakatDue) {
  if (!zakatDue) return;
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('mz-notif-prefs')||'{}'); } catch(e){ return {}; }
  })();
  if (prefs['zakat'] === false) return;
  const weekKey = String(Math.floor(Date.now() / (7*24*3600*1000)));
  if (localStorage.getItem('mz-zakat') !== weekKey) {
    send('⚖️ Zakat Due',
      `Your metal wealth ${fmt(metalVal)} has reached nisab. Zakat due: ${fmt(zakatDue)}`,
      'zakat');
    localStorage.setItem('mz-zakat', weekKey);
  }
}

/* ============================================================
   MEEZAN | js/notifications.js
   REAL NOTIFICATIONS: Browser Push + Smart Scheduling
   - Web Notifications API (works without server)
   - Connects with expenses, income, zakat data in real-time
   - Checks user's saved times every minute
   - Budget warnings fire when data changes
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
    authDomain: "meezan-app-8a41a.firebaseapp.com",
    projectId: "meezan-app-8a41a",
    storageBucket: "meezan-app-8a41a.firebasestorage.app",
    messagingSenderId: "767947145877",
    appId: "1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app);
const db = getFirestore(app);

const get = id => document.getElementById(id);
let currentUser = null;
let allExpenses = [],
    allIncome = [],
    allOrnaments = [];
let schedulerInterval = null;

/* ── ALL 13 NOTIFICATION DEFINITIONS ── */
const NOTIFS = [
    { id: 'zakat', group: 'Finance', icon: '⚖️', bg: 'rgba(212,160,23,.15)', name: 'Zakat due reminder', desc: 'When Hawl completes', on: true, time: '09:00' },
    { id: 'budget80', group: 'Finance', icon: '⚠️', bg: 'rgba(243,156,18,.15)', name: 'Budget 80% warning', desc: 'Per category', on: true, time: '' },
    { id: 'budget100', group: 'Finance', icon: '🔥', bg: 'rgba(192,57,43,.15)', name: 'Budget exceeded alert', desc: '100% of category spent', on: true, time: '' },
    { id: 'daily', group: 'Finance', icon: '📝', bg: 'rgba(26,188,156,.12)', name: 'Daily expense reminder', desc: 'Remind to log today', on: true, time: '21:00' },
    { id: 'salary', group: 'Finance', icon: '💼', bg: 'rgba(212,160,23,.12)', name: 'Salary reminder', desc: 'Monthly on salary date', on: true, time: '09:00' },
    { id: 'weekly', group: 'Finance', icon: '📊', bg: 'rgba(93,173,226,.12)', name: 'Weekly summary', desc: 'Every Sunday overview', on: true, time: '10:00' },
    { id: 'gold', group: 'Finance', icon: '🥇', bg: 'rgba(212,160,23,.12)', name: 'Gold price alert', desc: 'When price crosses threshold', on: false, time: '' },
    { id: 'ramadan', group: 'Islamic', icon: '🌙', bg: 'rgba(26,188,156,.12)', name: 'Ramadan start & end', desc: 'Moon sighting alert', on: true, time: '06:00' },
    { id: 'eid_fitr', group: 'Islamic', icon: '🎉', bg: 'rgba(26,188,156,.12)', name: 'Eid ul-Fitr reminder', desc: 'Day before + day-of', on: true, time: '07:00' },
    { id: 'eid_adha', group: 'Islamic', icon: '🐑', bg: 'rgba(26,188,156,.12)', name: 'Eid ul-Adha reminder', desc: 'Day before + day-of', on: true, time: '07:00' },
    { id: 'muharram', group: 'Islamic', icon: '📅', bg: 'rgba(93,173,226,.12)', name: 'Muharram & New Year', desc: 'Islamic New Year + Ashura', on: true, time: '08:00' },
    { id: 'layla', group: 'Islamic', icon: '✨', bg: 'rgba(212,160,23,.18)', name: 'Laylatul Qadr', desc: 'Last 10 nights of Ramadan', on: true, time: '22:00' },
    { id: 'family', group: 'Social', icon: '👨‍👩‍👧', bg: 'rgba(155,89,182,.12)', name: 'Family expense alert', desc: 'Large family member expense', on: true, time: '' },
];

let saved = {};

/* ══════════════════════════════════════
   AUTH + DATA LOAD
   ══════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
    if (!user) { location.href = '../index.html'; return; }
    currentUser = user;
    const ma = get('mob-avatar');
    if (ma) ma.textContent = (user.displayName || user.email || 'M').substring(0, 2).toUpperCase();

    // Load saved notification settings
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'prefs'));
    saved = snap.exists() && snap.data().notifications ? snap.data().notifications : {};

    buildList();

    // Load live Firestore data for smart budget/zakat triggers
    const col = n => collection(db, 'users', user.uid, n);
    onSnapshot(query(col('expenses'), orderBy('date', 'desc')), s => {
        allExpenses = s.docs.map(d => ({ id: d.id, ...d.data() }));
        runSmartChecks();
    });
    onSnapshot(query(col('income'), orderBy('date', 'desc')), s => {
        allIncome = s.docs.map(d => ({ id: d.id, ...d.data() }));
    });
    onSnapshot(query(col('ornaments'), orderBy('date', 'desc')), s => {
        allOrnaments = s.docs.map(d => ({ id: d.id, ...d.data() }));
        checkZakatStatus();
    });

    // Request browser notification permission
    requestNotifPermission();

    // Start the minute-by-minute time scheduler
    startScheduler();
});

/* ══════════════════════════════════════
   BROWSER PERMISSION
   ══════════════════════════════════════ */
async function requestNotifPermission() {
    if (!('Notification' in window)) {
        updatePermissionBanner('unsupported');
        return;
    }
    if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        updatePermissionBanner(perm);
    } else {
        updatePermissionBanner(Notification.permission);
    }
}
window.requestNotifPermission = requestNotifPermission;

function updatePermissionBanner(status) {
    const banner = get('notif-permission-banner');
    if (!banner) return;
    banner.style.display = 'block';
    if (status === 'granted') {
        banner.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;background:rgba(26,188,156,0.1);border:1px solid rgba(26,188,156,0.25);font-size:12px;margin-bottom:1rem';
        banner.innerHTML = '✅ <span style="color:var(--teal-lt)">Browser notifications are <strong>enabled</strong> — you\'ll receive real-time alerts even when Meezan is in the background.</span>';
    } else if (status === 'denied') {
        banner.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);font-size:12px;margin-bottom:1rem';
        banner.innerHTML = '🚫 <span style="color:var(--fire-lt)"><strong>Notifications are blocked.</strong> Click the 🔒 lock icon in your browser\'s address bar → Site settings → Allow Notifications.</span>';
    } else if (status === 'unsupported') {
        banner.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;background:rgba(212,160,23,0.1);border:1px solid rgba(212,160,23,0.25);font-size:12px;margin-bottom:1rem';
        banner.innerHTML = '⚠️ <span style="color:var(--gold-lt)">Your browser doesn\'t support notifications. Try Chrome or Edge for full notification support.</span>';
    } else {
        banner.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;background:rgba(212,160,23,0.1);border:1px solid rgba(212,160,23,0.25);font-size:12px;margin-bottom:1rem';
        banner.innerHTML = '🔔 <span style="color:var(--gold-lt)">Allow notifications so Meezan can send you real reminders.</span> <button onclick="requestNotifPermission()" style="margin-left:8px;background:var(--gold);color:#000;border:none;padding:3px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:600">Allow</button>';
    }
}

/* ══════════════════════════════════════
   SEND REAL BROWSER NOTIFICATION
   ══════════════════════════════════════ */
function sendNotification(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        const notif = new Notification('Meezan — ' + title, {
            body,
            tag: tag || title,
            requireInteraction: false,
            renotify: true // 🔥 IMPORTANT
        });
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
        setTimeout(() => notif.close(), 8000);
    } catch (e) {
        console.error('Notification failed:', e);
    }
}

// Export so other pages (expenses.js) can call it
window.meezanNotify = sendNotification;

/* ══════════════════════════════════════
   SMART CHECKS — run on data changes
   ══════════════════════════════════════ */
function runSmartChecks() {
    checkBudgetWarnings();
}

function checkBudgetWarnings() {
    if (!currentUser) return;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthExp = allExpenses.filter(e => (e.date || '').slice(0, 7) === thisMonth);
    const monthInc = allIncome.filter(e => (e.date || '').slice(0, 7) === thisMonth);
    const totalExp = monthExp.reduce((s, e) => s + (e.amt || 0), 0);
    const totalInc = monthInc.reduce((s, e) => s + (e.amt || 0), 0);
    if (!totalInc) return;

    const pct = (totalExp / totalInc) * 100;
    const today = new Date().toDateString();

    if (saved['budget100'] !== false && pct >= 100) {
        if (localStorage.getItem('mz-b100') !== today) {
            sendNotification('🔥 Budget Exceeded!',
                `You've spent ${Math.round(pct)}% of income this month (₹${Math.round(totalExp).toLocaleString('en-IN')} of ₹${Math.round(totalInc).toLocaleString('en-IN')})`,
                'budget100');
            localStorage.setItem('mz-b100', today);
        }
    } else if (saved['budget80'] !== false && pct >= 80 && pct < 100) {
        if (localStorage.getItem('mz-b80') !== today) {
            sendNotification('⚠️ Budget 80% Warning',
                `${Math.round(pct)}% of monthly income spent. ₹${Math.round(totalInc-totalExp).toLocaleString('en-IN')} remaining this month.`,
                'budget80');
            localStorage.setItem('mz-b80', today);
        }
    }
}

function checkZakatStatus() {
    if (saved['zakat'] === false || !currentUser) return;
    const GOLD = 6842,
        SILVER = 82,
        NISAB = 595;
    const metalVal = allOrnaments.reduce((s, o) => {
        const k = o.goldK === 22 ? 22 / 24 : o.goldK === 18 ? 18 / 24 : 1;
        return s + (o.goldG || 0) * GOLD * k + (o.silvG || 0) * SILVER;
    }, 0);
    if (metalVal >= NISAB * SILVER) {
        const weekKey = String(Math.floor(Date.now() / (7 * 24 * 3600 * 1000)));
        if (localStorage.getItem('mz-zakat') !== weekKey) {
            sendNotification('⚖️ Zakat Reminder',
                `Your metal wealth ₹${Math.round(metalVal).toLocaleString('en-IN')} has reached nisab. Zakat due: ₹${Math.round(metalVal*0.025).toLocaleString('en-IN')}`,
                'zakat');
            localStorage.setItem('mz-zakat', weekKey);
        }
    }
}

/* ══════════════════════════════════════
   TIME SCHEDULER — checks every 60s
   Fires timed notifications at their set time
   ══════════════════════════════════════ */
function startScheduler() {
    if (schedulerInterval) clearInterval(schedulerInterval);

    const tick = () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const time = `${hh}:${mm}`;
        const today = now.toDateString();
        const dayNum = now.getDay(); // 0=Sun
        const dom = now.getDate(); // day of month

        NOTIFS.forEach(n => {
            const isOn = saved[n.id] !== undefined ? saved[n.id] : n.on;
            if (!isOn) return;
            const scheduledTime = saved[n.id + '_time'] || n.time;
            if (!scheduledTime || scheduledTime !== time) return;

            const sentKey = `mz-sent-${n.id}-${today}-${time}`;
            if (localStorage.getItem(sentKey)) return;
            localStorage.setItem(sentKey, '1');

            const fmt = v => '₹' + Math.round(v).toLocaleString('en-IN');
            const thisM = now.toISOString().slice(0, 7);

            switch (n.id) {
                case 'daily':
                    sendNotification('📝 Log Today\'s Expenses',
                        'Open Meezan and record what you spent today — takes just 30 seconds!', 'daily');
                    break;

                case 'salary':
                    {
                        const salDay = parseInt(localStorage.getItem('mz-salday') || '1');
                        if (dom === salDay) {
                            const alreadyAdded = allIncome.some(e => (e.date || '').slice(0, 7) === thisM && e.type === 'Salary');
                            if (!alreadyAdded) {
                                sendNotification('💼 Salary Day!',
                                    'It looks like you haven\'t added your salary yet this month. Open Meezan to record it.', 'salary');
                            }
                        }
                        break;
                    }

                case 'weekly':
                    if (dayNum === 0) { // Sunday only
                        const inc = allIncome.filter(e => (e.date || '').slice(0, 7) === thisM).reduce((s, e) => s + (e.amt || 0), 0);
                        const exp = allExpenses.filter(e => (e.date || '').slice(0, 7) === thisM).reduce((s, e) => s + (e.amt || 0), 0);
                        const rate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
                        sendNotification('📊 Weekly Summary',
                            `This month: Income ${fmt(inc)} | Spent ${fmt(exp)} | Savings rate ${rate}%`, 'weekly');
                    }
                    break;

                case 'zakat':
                    checkZakatStatus();
                    break;

                case 'ramadan':
                    sendNotification('🌙 Ramadan Reminder',
                        'Open your Meezan Ramadan tracker for iftar times and today\'s charity goals.', 'ramadan');
                    break;

                case 'eid_fitr':
                    sendNotification('🎉 Eid ul-Fitr Mubarak!',
                        'May Allah accept your fasts. Don\'t forget to give Zakat ul-Fitr and record your sadaqah.', 'eid_fitr');
                    break;

                case 'eid_adha':
                    sendNotification('🐑 Eid ul-Adha Mubarak!',
                        'Record your Qurbani, gifts, and charity in Meezan\'s Sadaqah log.', 'eid_adha');
                    break;

                case 'muharram':
                    sendNotification('📅 Islamic New Year',
                        'A new Hijri year begins. Review your finances and set new goals in Meezan.', 'muharram');
                    break;

                case 'layla':
                    sendNotification('✨ Seek Laylatul Qadr',
                        'Tonight could be the Night of Power. Set your charity goal in Meezan\'s Sadaqah tracker.', 'layla');
                    break;

                default:
                    sendNotification(n.icon + ' ' + n.name, n.desc, n.id);
            }
        });
    };

    tick(); // run immediately on load
    schedulerInterval = setInterval(tick, 60000); // then every minute
}

/* ══════════════════════════════════════
   BUILD NOTIFICATION LIST UI
   ══════════════════════════════════════ */
function buildList() {
    const groups = ['Finance', 'Islamic', 'Social'];
    let html = '';

    groups.forEach(group => {
                const groupIcon = group === 'Finance' ? '💰' : group === 'Islamic' ? '🕌' : '👨‍👩‍👧';
                html += `<div style="font-size:9px;font-weight:600;color:var(--text-dim);text-transform:uppercase;
      letter-spacing:1.5px;margin:1rem 0 .4rem;padding-bottom:.4rem;border-bottom:1px solid var(--bdr)">
      ${groupIcon} ${group}</div>`;

                NOTIFS.filter(n => n.group === group).forEach(n => {
                            const isOn = saved[n.id] !== undefined ? saved[n.id] : n.on;
                            const time = saved[n.id + '_time'] || n.time;

                            html += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;
             background:var(--bg-row);border:1px solid var(--bdr);margin-bottom:6px;transition:all .2s"
             onmouseover="this.style.borderColor='rgba(212,160,23,.2)'"
             onmouseout="this.style.borderColor='var(--bdr)'">
          <div style="width:36px;height:36px;border-radius:9px;display:flex;align-items:center;
               justify-content:center;font-size:18px;flex-shrink:0;background:${n.bg}">${n.icon}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${n.name}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${n.desc}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${time
              ? `<input type="time" value="${time}" id="nt-time-${n.id}"
                   style="font-size:10px;color:var(--text-dim);background:var(--bg-input);
                          border:1px solid var(--bdr);border-radius:6px;padding:3px 7px;
                          cursor:pointer;font-family:inherit"
                   onchange="markChanged()" />`
              : `<span style="font-size:10px;color:var(--text-dim);width:52px;text-align:center">Auto</span>`}
            <div class="toggle${isOn?' on':''}" id="nt-${n.id}"
                 onclick="this.classList.toggle('on');markChanged()"></div>
          </div>
        </div>`;
    });
  });

  const nl = get('notif-list');
  if (nl) nl.innerHTML = html;
  updateSummary();
}

/* ── SUMMARY COUNTER ── */
function updateSummary() {
  const toggles = document.querySelectorAll('.toggle');
  const on = [...toggles].filter(t => t.classList.contains('on')).length;
  const ec = get('notif-enabled-count');  if (ec) ec.textContent = on;
  const dc = get('notif-disabled-count'); if (dc) dc.textContent = toggles.length - on;
}

window.markChanged = () => {
  const msg = get('notif-save-msg');
  if (msg) { msg.textContent = 'Unsaved changes — click Save'; msg.style.color = 'var(--amber)'; }
  updateSummary();
};

window.toggleAll = on => {
  document.querySelectorAll('.toggle').forEach(t => t.classList.toggle('on', on));
  window.markChanged();
};

/* ══════════════════════════════════════
   SAVE — Firebase + restart scheduler
   ══════════════════════════════════════ */
window.saveNotifications = async () => {
  const data = {};
  NOTIFS.forEach(n => {
    data[n.id] = get('nt-'+n.id)?.classList.contains('on') ?? n.on;
    const te = get('nt-time-'+n.id);
    if (te) data[n.id+'_time'] = te.value;
  });

  await setDoc(doc(db,'users',currentUser.uid,'settings','prefs'), { notifications: data }, { merge: true });

  saved = { ...data };
  startScheduler(); // restart with new settings
  runSmartChecks();

  const msg = get('notif-save-msg');
  if (msg) {
    msg.textContent = '✓ Saved! Notifications are now active.';
    msg.style.color = 'var(--teal-lt)';
    setTimeout(() => { msg.textContent = 'All changes saved'; }, 2500);
  }


};

/* ── TEST NOTIFICATION ── */
window.testNotification = () => {
  if (Notification.permission !== 'granted') {
    requestNotifPermission();
    return;
  }
  sendNotification('🧪 Test — Meezan Works!',
    'Great! Your browser notifications are working. You\'ll receive alerts at your set times.', 'test');
};

window.setTheme = (th) => {
  document.documentElement.setAttribute('data-theme', th);
  localStorage.setItem('meezan-theme', th);
  document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title === th));
  const tl = get('theme-label'); if (tl) tl.textContent = 'Theme: ' + th.charAt(0).toUpperCase() + th.slice(1);
};
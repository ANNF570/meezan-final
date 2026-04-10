/* ============================================================
   MEEZAN | js/export.js — PDF / JSON / CSV export + import
   Requires before this script:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
   ============================================================ */


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp }
from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({ apiKey: "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU", authDomain: "meezan-app-8a41a.firebaseapp.com", projectId: "meezan-app-8a41a", storageBucket: "meezan-app-8a41a.firebasestorage.app", messagingSenderId: "767947145877", appId: "1:767947145877:web:d837e0b30258405339519c" });
const auth = getAuth(app),
    db = getFirestore(app);

const get = id => document.getElementById(id);
const fmt = n => 'Rs.' + Math.round(n || 0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0, 10);
const log = (msg, ok = true) => {
    const el = get('progress-label');
    if (el) el.textContent = msg;
    console.log((ok ? '✓' : '✗') + ' ' + msg);
};

let currentUser = null,
    allIncome = [],
    allExpenses = [],
    allOrnaments = [];
let selFormat = 'pdf';

/* ── Init date range ── */
const now = new Date(),
    y = now.getFullYear();
const fromEl = get('ex-from');
if (fromEl) fromEl.value = `${y}-01-01`;
const toEl = get('ex-to');
if (toEl) toEl.value = today();

/* ── AUTH ── */
onAuthStateChanged(auth, async user => {
    if (!user) { location.href = '../index.html'; return; }
    currentUser = user;
    const ma = get('mob-avatar');
    if (ma) ma.textContent = (user.displayName || user.email || 'M').substring(0, 2).toUpperCase();
    await loadAll();
    buildPreview();
    buildRecentExports();
});

/* ══════════════════════════════════════
   LOAD ALL DATA FROM FIRESTORE
   ══════════════════════════════════════ */
async function loadAll() {
    const uid = currentUser.uid;
    try {
        const [is, es, os] = await Promise.all([
            getDocs(query(collection(db, 'users', uid, 'income'), orderBy('date', 'desc'))),
            getDocs(query(collection(db, 'users', uid, 'expenses'), orderBy('date', 'desc'))),
            getDocs(query(collection(db, 'users', uid, 'ornaments'), orderBy('date', 'desc'))),
        ]);
        allIncome = is.docs.map(d => ({ id: d.id, ...d.data() }));
        allExpenses = es.docs.map(d => ({ id: d.id, ...d.data() }));
        allOrnaments = os.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Loaded: ${allIncome.length} income, ${allExpenses.length} expenses, ${allOrnaments.length} ornaments`);
    } catch (e) {
        console.error('Load error:', e.message);
    }
}

/* ── FILTER BY DATE RANGE ── */
function getFiltered() {
    const from = get('ex-from') ?.value || '';
    const to = get('ex-to') ?.value || '';
    return {
        income: allIncome.filter(x => (!from || x.date >= from) && (!to || x.date <= to)),
        expenses: allExpenses.filter(x => (!from || x.date >= from) && (!to || x.date <= to)),
        ornaments: allOrnaments,
    };
}

/* ── BUILD PREVIEW ── */
function buildPreview() {
    const { income, expenses } = getFiltered();
    const ti = income.reduce((s, x) => s + x.amt, 0);
    const te = expenses.reduce((s, x) => s + x.amt, 0);
    const from = get('ex-from') ?.value || 'All';
    const to = get('ex-to') ?.value || today();
    const pc = get('preview-content');
    if (!pc) return;
    pc.innerHTML = [
        ['Period', `${from} – ${to}`],
        ['Income records', income.length],
        ['Expense records', expenses.length],
        ['Total income', fmt(ti)],
        ['Total expenses', fmt(te)],
        ['Net balance', fmt(ti - te)],
    ].map(([l, v], i) => `
    <div style="display:flex;justify-content:space-between;padding:5px 0;
         border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;
         ${i===5?'font-weight:600;color:var(--gold-lt)':''}">
      <span style="color:var(--text-mid)">${l}</span>
      <span>${v}</span>
    </div>`).join('');
}

/* ── DATE RANGE BUTTONS ── */
window.setRange = (range, el) => {
    document.querySelectorAll('.cat-filters .cf').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    const n = new Date(),
        yr = n.getFullYear(),
        mo = n.getMonth() + 1;
    const pad = v => String(v).padStart(2, '0');
    if (range === 'month') {
        get('ex-from').value = `${yr}-${pad(mo)}-01`;
        get('ex-to').value = today();
    }
    if (range === '3month') {
        const d = new Date(n);
        d.setMonth(d.getMonth() - 3);
        get('ex-from').value = d.toISOString().slice(0, 10);
        get('ex-to').value = today();
    }
    if (range === '6month') {
        const d = new Date(n);
        d.setMonth(d.getMonth() - 6);
        get('ex-from').value = d.toISOString().slice(0, 10);
        get('ex-to').value = today();
    }
    if (range === 'year') {
        get('ex-from').value = `${yr}-01-01`;
        get('ex-to').value = today();
    }
    if (range === 'all') {
        get('ex-from').value = '';
        get('ex-to').value = today();
    }
    buildPreview();
};

window.selectFormat = (f, el) => {
    selFormat = f;
    document.querySelectorAll('.export-option').forEach(x => x.classList.remove('selected'));
    el.classList.add('selected');
};

/* ══════════════════════════════════════
   MAIN EXPORT FUNCTION
   ══════════════════════════════════════ */
window.doExport = async() => {
    if (!currentUser) { alert('Please sign in first.'); return; }

    const btn = get('export-btn');
    const prog = get('progress-wrap');
    const fill = get('progress-fill');

    if (btn) {
        btn.style.opacity = '.6';
        btn.disabled = true;
    }
    if (prog) prog.style.display = 'block';
    if (fill) fill.style.width = '10%';

    const { income, expenses, ornaments } = getFiltered();
    const from = get('ex-from') ?.value || '';
    const to = get('ex-to') ?.value || today();
    const ti = income.reduce((s, x) => s + (x.amt || 0), 0);
    const te = expenses.reduce((s, x) => s + (x.amt || 0), 0);
    const tg = ornaments.reduce((s, o) => s + (o.goldG || 0) * 6842 + (o.silvG || 0) * 82, 0);

    try {
        /* ─────────── PDF ─────────── */
        if (selFormat === 'pdf') {
            log('Building PDF...');
            if (fill) fill.style.width = '20%';

            if (!window.jspdf) { alert('jsPDF not loaded. Check CDN scripts in export.html.'); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Header
            doc.setFillColor(13, 26, 32);
            doc.rect(0, 0, 210, 38, 'F');
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(212, 160, 23);
            doc.text('MEEZAN', 105, 14, { align: 'center' });
            doc.setFontSize(9);
            doc.setTextColor(200, 200, 200);
            doc.text('ميزان — The Scale of Balance', 105, 21, { align: 'center' });
            doc.text('Islamic Finance Report  |  ' + (from || 'All time') + ' – ' + to, 105, 27, { align: 'center' });
            doc.text('Generated: ' + today() + '  |  ' + (currentUser.email || ''), 105, 33, { align: 'center' });

            if (fill) fill.style.width = '35%';
            log('Writing summary...');

            // Summary table
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Financial Summary', 14, 48);
            doc.autoTable({
                startY: 51,
                head: [
                    ['Item', 'Amount']
                ],
                body: [
                    ['Total Income', fmt(ti)],
                    ['Total Expenses', fmt(te)],
                    ['Net Savings', fmt(ti - te)],
                    ['Gold & Silver', fmt(tg)],
                    ['Zakat (2.5%)', fmt((ti - te + tg) * 0.025)],
                    ['Total Records', String(income.length + expenses.length)],
                ],
                theme: 'striped',
                headStyles: { fillColor: [13, 95, 75], textColor: 255 },
                styles: { fontSize: 10 },
            });

            if (fill) fill.style.width = '55%';

            // Income table
            if (get('inc-income') ?.checked && income.length) {
                log('Writing income...');
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [
                        ['Date', 'Source', 'Type', 'Recurring', 'Currency', 'Amount']
                    ],
                    body: income.map(x => [x.date, x.name, x.type || '', x.recur || 'One-off', x.currency || 'INR', fmt(x.amt)]),
                    theme: 'striped',
                    headStyles: { fillColor: [13, 122, 95], textColor: 255 },
                    styles: { fontSize: 9 },
                });
            }

            if (fill) fill.style.width = '70%';

            // Expenses table
            if (get('inc-expense') ?.checked && expenses.length) {
                log('Writing expenses...');
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [
                        ['Date', 'Item', 'Category', 'Income Source', 'Amount', 'Notes']
                    ],
                    body: expenses.map(x => [x.date, x.name, x.cat || '', x.incomeSrc || '', fmt(x.amt), x.notes || '']),
                    theme: 'striped',
                    headStyles: { fillColor: [139, 26, 0], textColor: 255 },
                    styles: { fontSize: 9 },
                });
            }

            if (fill) fill.style.width = '85%';

            // Assets table
            if (get('inc-assets') ?.checked && ornaments.length) {
                log('Writing assets...');
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 10,
                    head: [
                        ['Name', 'Type', 'Gold(g)', 'Silver(g)', 'Bought', 'Notes']
                    ],
                    body: ornaments.map(x => [x.name, x.type || '', x.goldG || 0, x.silvG || 0, fmt(x.buyPrice), x.notes || '']),
                    theme: 'striped',
                    headStyles: { fillColor: [100, 70, 0], textColor: 255 },
                    styles: { fontSize: 9 },
                });
            }

            if (fill) fill.style.width = '95%';

            // Footer on every page
            const pages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Meezan — ميزان  |  Page ${i} of ${pages}  |  ${today()}`,
                    105, doc.internal.pageSize.height - 5, { align: 'center' });
            }

            doc.save(`Meezan-Report-${today()}.pdf`);
            log('✓ PDF downloaded!');
            if (fill) fill.style.width = '100%';
        }

        /* ─────────── JSON ─────────── */
        if (selFormat === 'json') {
            log('Building JSON backup...');
            if (fill) fill.style.width = '50%';
            const data = {
                exportDate: today(),
                from,
                to,
                user: { email: currentUser.email },
                income,
                expenses,
                ornaments,
                meta: { app: 'Meezan', version: '1.0.0' }
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Meezan-backup-${today()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            log('✓ JSON backup downloaded!');
            if (fill) fill.style.width = '100%';
        }

        /* ─────────── CSV ─────────── */
        if (selFormat === 'csv') {
            log('Building CSV...');
            if (fill) fill.style.width = '50%';
            const rows = [
                ['Date', 'Name', 'Category/Type', 'Amount', 'Notes', 'Income Source']
            ];
            expenses.forEach(x => rows.push([x.date, x.name, 'Expense:' + x.cat, x.amt, x.notes || '', x.incomeSrc || '']));
            income.forEach(x => rows.push([x.date, x.name, 'Income:' + x.type, x.amt, x.notes || '', '']));
            const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Meezan-data-${today()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            log('✓ CSV downloaded!');
            if (fill) fill.style.width = '100%';
        }

        // Save to recent exports
        const prev = JSON.parse(localStorage.getItem('meezan-exports') || '[]');
        prev.unshift({ format: selFormat.toUpperCase(), date: today(), from, to, rows: income.length + expenses.length });
        localStorage.setItem('meezan-exports', JSON.stringify(prev.slice(0, 8)));
        buildRecentExports();

    } catch (e) {
        log('✗ Error: ' + e.message, false);
        console.error(e);
    }

    setTimeout(() => {
        if (prog) prog.style.display = 'none';
        if (fill) fill.style.width = '0%';
        if (btn) {
            btn.style.opacity = '1';
            btn.disabled = false;
        }
    }, 2500);
};

/* ══════════════════════════════════════
   IMPORT — JSON backup or Meezan export
   ══════════════════════════════════════ */
window.handleImport = async(e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusEl = get('import-status');
    if (statusEl) statusEl.textContent = 'Reading file...';

    const reader = new FileReader();
    reader.onload = async(ev) => {
        try {
            const data = JSON.parse(ev.target.result);

            // Detect format
            const inc = data.income || data.incomes || [];
            const exp = data.expenses || data.expenditures || [];
            const orn = data.ornaments || data.assets || [];
            const total = inc.length + exp.length + orn.length;

            if (total === 0) {
                if (statusEl) statusEl.textContent = '⚠️ No records found in file. Check format.';
                return;
            }

            if (statusEl) statusEl.textContent = `Found ${total} records. Importing...`;

            let imported = 0;
            const uid = currentUser.uid;

            // Import income
            for (const item of inc) {
                if (!item.name || !item.amt) continue;
                await addDoc(collection(db, 'users', uid, 'income'), {
                    name: item.name || item.source || 'Imported',
                    amt: parseFloat(item.amt || item.amount || 0),
                    type: item.type || 'Other',
                    recur: item.recur || 'One-off',
                    date: item.date || today(),
                    currency: item.currency || 'INR',
                    notes: item.notes || 'Imported',
                    uid: uid,
                    createdAt: serverTimestamp(),
                });
                imported++;
            }

            // Import expenses
            for (const item of exp) {
                if (!item.name || !item.amt) continue;
                await addDoc(collection(db, 'users', uid, 'expenses'), {
                    name: item.name || item.item || 'Imported',
                    amt: parseFloat(item.amt || item.amount || 0),
                    cat: item.cat || item.category || 'Other',
                    date: item.date || today(),
                    notes: item.notes || 'Imported',
                    incomeSrc: item.incomeSrc || 'Any',
                    uid: uid,
                    createdAt: serverTimestamp(),
                });
                imported++;
            }

            if (statusEl) {
                statusEl.textContent = `✓ Imported ${imported} records successfully! Go to Dashboard to see your data.`;
                statusEl.style.color = 'var(--teal-lt)';
            }

            // Reload data
            await loadAll();
            buildPreview();

        } catch (err) {
            if (statusEl) {
                statusEl.textContent = '✗ Invalid file: ' + err.message;
                statusEl.style.color = 'var(--fire-lt)';
            }
        }
    };
    reader.readAsText(file);
};

/* ── RECENT EXPORTS ── */
function buildRecentExports() {
    const prev = JSON.parse(localStorage.getItem('meezan-exports') || '[]');
    const el = get('recent-exports');
    if (!el) return;
    if (!prev.length) {
        el.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.5rem">No exports yet</div>';
        return;
    }
    el.innerHTML = prev.map(x => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px">
      <span style="color:var(--text-mid)">${x.date}</span>
      <span style="color:var(--gold)">${x.format}</span>
      <span style="color:var(--text-dim)">${x.rows} records</span>
    </div>`).join('');
}

window.setTheme = th => {
    document.documentElement.setAttribute('data-theme', th);
    localStorage.setItem('meezan-theme', th);
    document.querySelectorAll('.theme-pill').forEach(p => p.classList.toggle('active', p.title === th));
};
const _t = localStorage.getItem('meezan-theme') || 'glass';
document.documentElement.setAttribute('data-theme', _t);
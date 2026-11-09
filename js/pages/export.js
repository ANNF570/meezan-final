/* ============================================================
   MEEZAN — ميزان  |  js/pages/export.js
   Export your data: CSV (opens in Excel/Sheets), JSON backup and a
   printable report (Print → Save as PDF). No third-party libraries —
   everything is built in the browser from your own data.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe } from '../core/store.js';
import { accountBalances, ownIncome, netWorth } from '../core/calc.js';
import { APP_NAME } from '../core/constants.js';
import { esc, fmt, todayStr, ymd, sum, fmtDay } from '../core/utils.js';
import { toast } from '../core/ui.js';

boot({
    page: 'export',
    navKey: 'export',
    title: 'Export',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'ornaments', 'sadaqah']
}, function(ctx) {
    const page = document.getElementById('page');
    const now = new Date();

    page.innerHTML =
        '<div class="card"><div class="card-title">📅 What to export</div>' +
        '<div class="form-grid" style="--fmin:150px">' +
        '<div class="field"><label for="x-from">From</label><input type="date" id="x-from" value="' + now.getFullYear() + '-01-01"></div>' +
        '<div class="field"><label for="x-to">To</label><input type="date" id="x-to" value="' + todayStr() + '"></div></div>' +
        '<div class="chips" id="x-quick"><button type="button" class="chip" data-q="month">This month</button><button type="button" class="chip" data-q="year">This year</button><button type="button" class="chip" data-q="all">All time</button></div>' +
        '<div class="hint" id="x-count" style="margin-top:8px"></div></div>' +
        '<div class="grid" style="--min:260px">' +
        '<div class="card"><div class="card-title">📄 CSV — income</div><p class="hint">Opens in Excel or Google Sheets.</p><button type="button" class="btn btn-teal" data-ex="csv-income">Download income CSV</button></div>' +
        '<div class="card"><div class="card-title">📄 CSV — expenses</div><p class="hint">All expenses in the period, with category and account.</p><button type="button" class="btn btn-teal" data-ex="csv-expenses">Download expenses CSV</button></div>' +
        '<div class="card"><div class="card-title">🖨️ PDF report</div><p class="hint">Opens a clean report. Choose “Save as PDF” in the print window.</p><button type="button" class="btn btn-gold" data-ex="pdf">Open printable report</button></div>' +
        '<div class="card"><div class="card-title">💾 Full backup (JSON)</div><p class="hint">Everything: income, expenses, accounts, transfers, ornaments, Sadaqah, preferences.</p><button type="button" class="btn btn-ghost" data-ex="json">Download backup</button></div>' +
        '</div>' +
        '<div class="card"><div class="card-title">📥 Import</div><p class="hint">Bring data in from Meezan v1, a backup or a CSV.</p><a class="btn btn-ghost" href="import.html">Go to Import</a></div>';

    function bounds() {
        return [document.getElementById('x-from').value || '0000-01-01', document.getElementById('x-to').value || '9999-12-31'];
    }
    function within(list) {
        const b = bounds();
        return list.filter(function(r) { return (r.date || '') >= b[0] && (r.date || '') <= b[1]; });
    }
    function accName(id) {
        const a = store.data.accounts.filter(function(x) { return x.id === id; })[0];
        return a ? a.name : '';
    }

    /* CSV: quote everything; guard against spreadsheet formula injection */
    function cell(v) {
        let s = v === undefined || v === null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(s)) { s = "'" + s; }
        return '"' + s.replace(/"/g, '""') + '"';
    }
    function csv(rows) {
        return '﻿' + rows.map(function(r) { return r.map(cell).join(','); }).join('\r\n');
    }
    function download(name, text, type) {
        const blob = new Blob([text], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
    }
    function sorted(list) {
        return list.slice().sort(function(a, b) { return (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0; });
    }

    function exportCsv(kind) {
        const isInc = kind === 'income';
        const list = sorted(within(store.data[isInc ? 'income' : 'expenses']));
        if (!list.length) { toast('No records in this period.', 'warn'); return; }
        const rows = [['Date', 'Name', isInc ? 'Category' : 'Category', 'Amount', 'Account', 'Notes']];
        list.forEach(function(r) {
            rows.push([r.date, r.name, isInc ? r.type : r.cat, Number(r.amt) || 0, accName(r.accountId), r.notes || r.note || '']);
        });
        download('meezan-' + kind + '-' + todayStr() + '.csv', csv(rows), 'text/csv;charset=utf-8');
        toast(list.length + ' rows exported ✓', 'ok');
    }

    function exportJson() {
        const out = { app: APP_NAME, exportedAt: new Date().toISOString(), version: 2, prefs: store.prefs, data: store.data };
        download('meezan-backup-' + todayStr() + '.json', JSON.stringify(out, function(k, v) {
            return v && typeof v === 'object' && typeof v.toMillis === 'function' ? v.toMillis() : v;
        }, 2), 'application/json');
        toast('Backup downloaded ✓', 'ok');
    }

    function exportPdf() {
        const inc = sorted(within(ownIncome(store.data)));
        const exp = sorted(within(store.data.expenses));
        const b = bounds();
        const bal = accountBalances(store.data);
        const table = function(list, catField) {
            return '<table><thead><tr><th>Date</th><th>Name</th><th>Category</th><th class="r">Amount</th></tr></thead><tbody>' +
                (list.map(function(r) { return '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r[catField]) + '</td><td class="r">' + esc(fmt(r.amt)) + '</td></tr>'; }).join('') || '<tr><td colspan="4">No records</td></tr>') + '</tbody></table>';
        };
        const html = '<!doctype html><html><head><meta charset="utf-8"><title>Meezan report</title>' +
            '<style>body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{margin:0}h2{margin-top:24px;border-bottom:2px solid #d4a017;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}.r{text-align:right}.k{display:flex;gap:16px;flex-wrap:wrap}.k div{border:1px solid #ccc;border-radius:8px;padding:8px 14px}small{color:#666}@media print{button{display:none}}</style></head><body>' +
            '<button onclick="window.print()">Print / Save as PDF</button>' +
            '<h1>Meezan — Financial report</h1><small>' + esc(b[0] === '0000-01-01' ? 'Start' : b[0]) + ' to ' + esc(b[1] === '9999-12-31' ? 'today' : b[1]) + ' · generated ' + esc(todayStr()) + '</small>' +
            '<h2>Summary</h2><div class="k"><div><small>Income</small><br><b>' + esc(fmt(sum(inc, 'amt'))) + '</b></div><div><small>Expenses</small><br><b>' + esc(fmt(sum(exp, 'amt'))) + '</b></div>' +
            '<div><small>Net worth today</small><br><b>' + esc(fmt(netWorth(store.data, store.prefs))) + '</b></div></div>' +
            '<h2>Accounts</h2>' + (store.data.accounts.map(function(a) { return '<div>' + esc(a.name) + ': <b>' + esc(fmt(bal[a.id] || 0)) + '</b></div>'; }).join('') || '<div>No accounts</div>') +
            '<h2>Income</h2>' + table(inc, 'type') + '<h2>Expenses</h2>' + table(exp, 'cat') +
            '<p><small>Built by Akif Nehal · linkedin.com/in/akif-nehal</small></p></body></html>';
        const w = window.open('', '_blank');
        if (!w) { toast('Allow pop-ups for this site to open the report.', 'warn', 4500); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
    }

    page.addEventListener('click', function(e) {
        const q = e.target.closest('[data-q]');
        if (q) {
            const k = q.getAttribute('data-q');
            const f = document.getElementById('x-from');
            const t = document.getElementById('x-to');
            t.value = todayStr();
            if (k === 'month') { f.value = ymd(new Date(now.getFullYear(), now.getMonth(), 1)); }
            if (k === 'year') { f.value = now.getFullYear() + '-01-01'; }
            if (k === 'all') { f.value = ''; t.value = ''; }
            count();
            return;
        }
        const b = e.target.closest('[data-ex]');
        if (!b) { return; }
        const k = b.getAttribute('data-ex');
        if (k === 'csv-income') { exportCsv('income'); }
        if (k === 'csv-expenses') { exportCsv('expenses'); }
        if (k === 'json') { exportJson(); }
        if (k === 'pdf') { exportPdf(); }
    });
    page.addEventListener('change', count);

    function count() {
        document.getElementById('x-count').textContent = within(store.data.income).length + ' income and ' + within(store.data.expenses).length + ' expense records in this period.';
    }
    count();
    subscribe(count);
});

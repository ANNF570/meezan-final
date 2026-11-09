/* ============================================================
   MEEZAN — ميزان  |  js/pages/import.js
   Import data from:
     • Meezan v1 backup / export JSON      ({income:[], expenses:[], ornaments:[]})
     • Meezan v2 backup JSON               (full restore, keeps ids → no duplicates)
     • Spendora-style JSON                 (income / expenses arrays)
     • CSV (income file, expenses file, or the v1 mixed CSV "Expense:Food")
   Shows a preview first, skips duplicates, optional account link.
   Files are read in your browser only.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store } from '../core/store.js';
import { db, doc, collection, writeBatch, serverTimestamp } from '../core/firebase.js';
import { esc, fmt, todayStr, pad } from '../core/utils.js';
import { toast, accountOptions, confirmBox } from '../core/ui.js';
import { INCOME_CATS, EXPENSE_CATS } from '../core/constants.js';

const V2_COLLECTIONS = ['income', 'expenses', 'accounts', 'transfers', 'ornaments', 'sadaqah', 'zakatRecords', 'eidSavings', 'loans'];

boot({
    page: 'import',
    navKey: 'import',
    title: 'Import Data',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'ornaments']
}, function(ctx) {
    const page = document.getElementById('page');
    let parsed = null; /* { fileName, mode:'simple'|'full', income:[], expenses:[], ornaments:[], full:{coll:[docs]}, bad:n } */

    page.innerHTML =
        '<div class="card"><div class="card-title">📥 Import your data</div>' +
        '<p class="hint">Works with a Meezan backup (v1 or v2), a Spendora export, or a CSV file. Nothing is uploaded anywhere except into your own Meezan account. ' +
        'Sample files are in the <b>samples</b> folder of the project.</p>' +
        '<div class="field"><label for="im-file">Choose a .json or .csv file</label><input type="file" id="im-file" accept=".json,.csv,.txt,application/json,text/csv"></div>' +
        '<div class="field" id="im-kind-wrap" hidden><label for="im-kind">This CSV contains</label><select id="im-kind"><option value="auto">Detect (v1 mixed file)</option><option value="income">Income</option><option value="expenses">Expenses</option></select></div>' +
        '</div>' +
        '<div class="card" id="im-preview" hidden></div>';

    const fileEl = document.getElementById('im-file');
    fileEl.addEventListener('change', function() {
        const f = fileEl.files && fileEl.files[0];
        if (!f) { return; }
        const isCsv = /\.(csv|txt)$/i.test(f.name);
        document.getElementById('im-kind-wrap').hidden = !isCsv;
        const reader = new FileReader();
        reader.onload = function() { handleText(f.name, String(reader.result || ''), isCsv); };
        reader.onerror = function() { toast('Could not read that file.', 'err'); };
        reader.readAsText(f);
    });
    document.getElementById('im-kind').addEventListener('change', function() {
        const f = fileEl.files && fileEl.files[0];
        if (f) { fileEl.dispatchEvent(new Event('change')); }
    });

    /* ── parsing helpers ─────────────────────────────────── */
    function num(v) {
        if (typeof v === 'number') { return v; }
        const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[₹,\s]/g, ''));
        return isNaN(n) ? 0 : n;
    }
    function normDate(v) {
        if (!v) { return todayStr(); }
        if (typeof v === 'object' && v.seconds) { const d = new Date(v.seconds * 1000); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
        const s = String(v).trim();
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) { return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]); }
        m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
        if (m) { return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]); } /* dd/mm/yyyy (India) */
        return '';
    }
    function incomeRec(x) {
        const amt = num(x.amt !== undefined ? x.amt : x.amount);
        const name = String(x.name || x.source || x.title || '').trim();
        const date = normDate(x.date);
        if (!(amt > 0) || !name || !date) { return null; }
        return { name: name, amt: amt, type: x.type || x.category || 'Other', recur: x.recur || 'One-off', date: date, currency: x.currency || 'INR', notes: x.notes || x.note || 'Imported' };
    }
    function expenseRec(x) {
        const amt = num(x.amt !== undefined ? x.amt : x.amount);
        const name = String(x.name || x.item || x.title || '').trim();
        const date = normDate(x.date);
        if (!(amt > 0) || !name || !date) { return null; }
        return { name: name, amt: amt, cat: x.cat || x.category || 'Other', date: date, notes: x.notes || x.note || 'Imported', incomeSrc: x.incomeSrc || 'Any' };
    }

    /* tiny CSV parser (quotes, commas, newlines inside quotes) */
    function parseCsv(text) {
        const rows = [];
        let row = [];
        let cur = '';
        let q = false;
        text = text.replace(/^﻿/, '');
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) {
                if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') { q = false; } else { cur += c; }
            } else if (c === '"') { q = true; } else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') { i++; }
                row.push(cur); cur = '';
                if (row.some(function(x) { return x !== ''; })) { rows.push(row); }
                row = [];
            } else { cur += c; }
        }
        row.push(cur);
        if (row.some(function(x) { return x !== ''; })) { rows.push(row); }
        return rows;
    }

    function handleText(fileName, text, isCsv) {
        try {
            parsed = isCsv ? fromCsv(fileName, text) : fromJson(fileName, text);
        } catch (err) {
            parsed = null;
            showError('Could not read this file: ' + err.message);
            return;
        }
        showPreview();
    }

    function fromJson(fileName, text) {
        const data = JSON.parse(text);
        const root = data && data.data && typeof data.data === 'object' && (data.version === 2 || data.app) ? data.data : data;
        const isFull = data && data.version === 2 && data.data;
        const out = { fileName: fileName, mode: isFull ? 'full' : 'simple', income: [], expenses: [], ornaments: [], full: {}, bad: 0, prefs: isFull ? data.prefs : null };
        if (isFull) {
            V2_COLLECTIONS.forEach(function(c) { if (Array.isArray(root[c])) { out.full[c] = root[c]; } });
            return out;
        }
        const inc = root.income || root.incomes || [];
        const exp = root.expenses || root.expenditures || [];
        inc.forEach(function(x) { const r = incomeRec(x); if (r) { out.income.push(r); } else { out.bad++; } });
        exp.forEach(function(x) { const r = expenseRec(x); if (r) { out.expenses.push(r); } else { out.bad++; } });
        (root.ornaments || root.assets || []).forEach(function(o) {
            const c = Object.assign({}, o);
            delete c.id; delete c.uid; delete c.createdAt; delete c.updatedAt;
            if (c.name || c.type) { out.ornaments.push(c); } else { out.bad++; }
        });
        return out;
    }

    function fromCsv(fileName, text) {
        const rows = parseCsv(text);
        if (rows.length < 2) { throw new Error('the file has no data rows'); }
        const head = rows[0].map(function(h) { return h.trim().toLowerCase(); });
        const idx = function(names) { for (let i = 0; i < names.length; i++) { const k = head.indexOf(names[i]); if (k >= 0) { return k; } } return -1; };
        const cDate = idx(['date']);
        const cName = idx(['name', 'title', 'description', 'item']);
        const cCat = idx(['category/type', 'category', 'type', 'cat']);
        const cAmt = idx(['amount', 'amt']);
        const cNote = idx(['notes', 'note']);
        const cSrc = idx(['income source', 'incomesrc']);
        if (cDate < 0 || cName < 0 || cAmt < 0) { throw new Error('needs the columns Date, Name and Amount'); }
        const kind = document.getElementById('im-kind').value;
        const out = { fileName: fileName, mode: 'simple', income: [], expenses: [], ornaments: [], full: {}, bad: 0 };
        rows.slice(1).forEach(function(r) {
            let cat = cCat >= 0 ? (r[cCat] || '').trim() : '';
            let as = kind;
            if (kind === 'auto') {
                if (/^expense:/i.test(cat)) { as = 'expenses'; cat = cat.replace(/^expense:/i, ''); } else if (/^income:/i.test(cat)) { as = 'income'; cat = cat.replace(/^income:/i, ''); } else { as = ''; }
            }
            const base = { date: r[cDate], name: r[cName], amt: r[cAmt], notes: cNote >= 0 ? r[cNote] : '', incomeSrc: cSrc >= 0 ? r[cSrc] : '' };
            if (as === 'income') { base.type = cat || 'Other'; const x = incomeRec(base); if (x) { out.income.push(x); } else { out.bad++; } } else if (as === 'expenses') {
                base.cat = cat || 'Other'; const x = expenseRec(base); if (x) { out.expenses.push(x); } else { out.bad++; }
            } else { out.bad++; }
        });
        return out;
    }

    /* ── duplicates ──────────────────────────────────────── */
    function key(kind, r) { return [kind, r.date, String(r.name).toLowerCase(), Math.round(num(r.amt) * 100), r.type || r.cat || ''].join('|'); }
    function existingKeys() {
        const s = {};
        store.data.income.forEach(function(r) { s[key('i', r)] = true; });
        store.data.expenses.forEach(function(r) { s[key('e', r)] = true; });
        return s;
    }

    /* ── preview ─────────────────────────────────────────── */
    function showError(msg) {
        const box = document.getElementById('im-preview');
        box.hidden = false;
        box.innerHTML = '<div class="banner banner-bad">' + esc(msg) + '</div>';
    }

    function unknownCats(list, field, known) {
        const set = {};
        list.forEach(function(r) { if (known.indexOf(r[field]) < 0) { set[r[field]] = true; } });
        return Object.keys(set);
    }

    function showPreview() {
        const box = document.getElementById('im-preview');
        box.hidden = false;
        const p = parsed;
        if (p.mode === 'full') {
            const lines = Object.keys(p.full).map(function(c) { return '<div class="row-between small"><span>' + esc(c) + '</span><b class="num">' + p.full[c].length + '</b></div>'; }).join('');
            box.innerHTML = '<div class="card-title">🔎 Full Meezan v2 backup: ' + esc(p.fileName) + '</div>' +
                '<div class="banner banner-info">This restores everything with the original ids, so importing the same backup twice never duplicates anything.</div>' + lines +
                '<div class="form-actions"><button type="button" class="btn btn-teal" id="im-go">Restore backup</button></div>';
            document.getElementById('im-go').addEventListener('click', runFull);
            return;
        }
        const seen = existingKeys();
        const inc = p.income.filter(function(r) { return !seen[key('i', r)]; });
        const exp = p.expenses.filter(function(r) { return !seen[key('e', r)]; });
        const dup = (p.income.length - inc.length) + (p.expenses.length - exp.length);
        const total = inc.length + exp.length + p.ornaments.length;
        const unkI = unknownCats(inc, 'type', INCOME_CATS.map(function(c) { return c.label; }));
        const unkE = unknownCats(exp, 'cat', EXPENSE_CATS.map(function(c) { return c.label; }));
        const sample = inc.slice(0, 3).map(function(r) { return ['💰', r.date, r.name, r.type, '+' + fmt(r.amt)]; })
            .concat(exp.slice(0, 3).map(function(r) { return ['💸', r.date, r.name, r.cat, '−' + fmt(r.amt)]; }));

        box.innerHTML =
            '<div class="card-title">🔎 Preview: ' + esc(p.fileName) + '</div>' +
            '<div class="kpis" style="--kpi-min:120px">' +
            '<div class="kpi"><div class="kpi-top"><span class="kpi-label">Income</span></div><div class="kpi-value">' + inc.length + '</div></div>' +
            '<div class="kpi"><div class="kpi-top"><span class="kpi-label">Expenses</span></div><div class="kpi-value">' + exp.length + '</div></div>' +
            '<div class="kpi"><div class="kpi-top"><span class="kpi-label">Ornaments</span></div><div class="kpi-value">' + p.ornaments.length + '</div></div>' +
            '<div class="kpi"><div class="kpi-top"><span class="kpi-label">Skipped</span></div><div class="kpi-value">' + (dup + p.bad) + '</div><div class="kpi-sub">' + dup + ' duplicates · ' + p.bad + ' invalid</div></div></div>' +
            (sample.length ? '<div class="stack" style="margin-top:10px">' + sample.map(function(s) {
                return '<div class="row-between small"><span>' + s[0] + ' ' + esc(s[1]) + ' · ' + esc(s[2]) + ' <span class="tag">' + esc(s[3]) + '</span></span><b class="num">' + esc(s[4]) + '</b></div>';
            }).join('') + (total > 6 ? '<div class="hint">…and ' + (total - 6) + ' more</div>' : '') + '</div>' : '') +
            ((unkI.length || unkE.length) ? '<div class="banner banner-warn">Some categories are new to Meezan (' + esc(unkI.concat(unkE).slice(0, 6).join(', ')) + '). They are kept as they are and shown with a default icon.</div>' : '') +
            '<div class="field" style="margin-top:10px"><label for="im-acc">Attach to an account (optional)</label><select id="im-acc">' + accountOptions(store.data.accounts, null, '', true) + '</select>' +
            '<div class="hint">Leave on “Not linked” to import history only — your balances stay exactly as they are. If you pick an account, its balance will change by these records.</div></div>' +
            '<div class="form-actions"><button type="button" class="btn btn-teal" id="im-go"' + (total ? '' : ' disabled') + '>Import ' + total + ' records</button></div>' +
            '<div class="progress" id="im-prog" hidden><div class="progress-fill" id="im-fill" style="width:0%"></div></div><div class="hint" id="im-status"></div>';
        document.getElementById('im-go').addEventListener('click', function() { runSimple(inc, exp); });
    }

    /* ── writing (batches of 400) ────────────────────────── */
    async function commit(ops, onProgress) {
        for (let i = 0; i < ops.length; i += 400) {
            const b = writeBatch(db);
            ops.slice(i, i + 400).forEach(function(op) { b.set(op.ref, op.data, op.merge ? { merge: true } : undefined); });
            await b.commit();
            onProgress(Math.min(ops.length, i + 400), ops.length);
        }
    }

    function progress(done, total) {
        const pr = document.getElementById('im-prog');
        if (pr) { pr.hidden = false; }
        const f = document.getElementById('im-fill');
        if (f) { f.style.width = Math.round((done / total) * 100) + '%'; }
        const s = document.getElementById('im-status');
        if (s) { s.textContent = done + ' of ' + total + ' written…'; }
    }

    async function runSimple(inc, exp) {
        const acc = (document.getElementById('im-acc') || {}).value || '';
        const uid = store.uid;
        const ops = [];
        const stamp = function(d) { d.uid = uid; d.createdAt = serverTimestamp(); if (acc) { d.accountId = acc; } return d; };
        inc.forEach(function(r) { ops.push({ ref: doc(collection(db, 'users', uid, 'income')), data: stamp(Object.assign({}, r)) }); });
        exp.forEach(function(r) { ops.push({ ref: doc(collection(db, 'users', uid, 'expenses')), data: stamp(Object.assign({}, r)) }); });
        parsed.ornaments.forEach(function(o) { const d = Object.assign({}, o); d.uid = uid; d.createdAt = serverTimestamp(); ops.push({ ref: doc(collection(db, 'users', uid, 'ornaments')), data: d }); });
        if (!ops.length) { return; }
        await finish(ops);
    }

    async function runFull() {
        const ok = await confirmBox('Restore this backup into your account? Existing records with the same ids are replaced; nothing else is deleted.', { okText: 'Restore', danger: false });
        if (!ok) { return; }
        const uid = store.uid;
        const ops = [];
        Object.keys(parsed.full).forEach(function(c) {
            parsed.full[c].forEach(function(r) {
                const d = Object.assign({}, r);
                const id = d.id;
                delete d.id;
                d.uid = uid;
                if (d.createdAt && typeof d.createdAt === 'number') { delete d.createdAt; }
                if (d.updatedAt && typeof d.updatedAt === 'number') { delete d.updatedAt; }
                ops.push({ ref: id ? doc(db, 'users', uid, c, id) : doc(collection(db, 'users', uid, c)), data: d, merge: true });
            });
        });
        if (!ops.length) { toast('Nothing to restore in this file.', 'warn'); return; }
        await finish(ops);
    }

    async function finish(ops) {
        const btn = document.getElementById('im-go');
        btn.disabled = true;
        try {
            await commit(ops, progress);
            document.getElementById('im-status').textContent = '';
            toast(ops.length + ' records imported ✓', 'ok', 4000);
            document.getElementById('im-preview').innerHTML = '<div class="banner banner-ok">✓ Imported <b>' + ops.length + '</b> records. Open the <a href="dashboard.html">Dashboard</a> or <a href="income.html">Income</a> page to see them.</div>';
            fileEl.value = '';
            parsed = null;
        } catch (err) {
            btn.disabled = false;
            toast('Import failed: ' + (err.code || err.message), 'err', 5000);
        }
    }
});

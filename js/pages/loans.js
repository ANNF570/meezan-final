/* ============================================================
   MEEZAN — ميزان  |  js/pages/loans.js
   Friends & Loans — money that is NOT yours:
     • "Holding"  : a friend gave you money to keep      (you owe it back)
     • "Lent"     : you gave money to someone            (they owe you)
   Every give / return is tied to one of your accounts (cash, bank,
   savings…), so balances stay exact. Edit any entry, mark complete,
   reopen. Held money is never counted as income.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe, saveRecord, removeRecord } from '../core/store.js';
import { accountBalances, loanSummary, loanStats } from '../core/calc.js';
import { ACCOUNT_TYPES } from '../core/constants.js';
import { fmt, esc, todayStr, fmtDay, num } from '../core/utils.js';
import { toast, openModal, confirmBox, accountOptions, lastAccount, rememberAccount, emptyState, progressBar } from '../core/ui.js';
import { kpiHtml } from '../core/widgets.js';

const KIND = {
    held: { label: 'Holding for', icon: '🤲', start: 'Friend gave me money', startDir: 'in', moreLabel: 'He gave more', backLabel: 'I returned', backDir: 'out', tone: 'gold' },
    lent: { label: 'Lent to', icon: '💸', start: 'I gave money', startDir: 'out', moreLabel: 'I gave more', backLabel: 'He returned', backDir: 'in', tone: 'sky' }
};

boot({
    page: 'loans',
    navKey: 'loans',
    title: 'Friends & Loans',
    needs: ['income', 'expenses', 'accounts', 'transfers']
}, function(ctx) {
    const page = document.getElementById('page');
    let filter = 'open';
    const openIds = {};

    ctx.setActions(
        '<button type="button" class="btn btn-gold btn-sm" data-new="held">🤲 Friend gave me money</button>' +
        '<button type="button" class="btn btn-teal btn-sm" data-new="lent">💸 I gave money</button>'
    );

    page.innerHTML =
        '<div class="kpis" id="l-kpis"></div>' +
        '<div class="card"><div class="row-between"><div class="chips" id="l-filter">' +
        [['open', 'Open'], ['done', 'Completed'], ['all', 'All']].map(function(f) {
            return '<button type="button" class="chip' + (f[0] === filter ? ' on' : '') + '" data-filter="' + f[0] + '">' + f[1] + '</button>';
        }).join('') + '</div><span class="hint">Friends\' money is never counted as your income.</span></div></div>' +
        '<div class="stack" id="l-list"></div>';

    function accName(id) {
        const a = store.data.accounts.filter(function(x) { return x.id === id; })[0];
        return a ? (ACCOUNT_TYPES[a.type] ? ACCOUNT_TYPES[a.type].icon + ' ' : '') + a.name : 'No account';
    }
    function loanById(id) { return store.data.loans.filter(function(l) { return l.id === id; })[0]; }
    function r2(n) { return Math.round(n * 100) / 100; }
    function fail(err) { toast('Could not save: ' + (err.code || err.message), 'err', 4500); }

    /* ── render ──────────────────────────────────────────── */
    function render() {
        const st = loanStats(store.data);
        const all = store.data.loans.slice();
        const openCount = all.filter(function(l) { return l.status !== 'done'; }).length;
        document.getElementById('l-kpis').innerHTML =
            kpiHtml({ label: 'Holding', icon: '🤲', value: st.held, accent: 'var(--gold-lt)', sub: 'Yours to give back' }) +
            kpiHtml({ label: 'Lent out', icon: '💸', value: st.lent, accent: 'var(--sky-lt)', sub: 'Others owe you' }) +
            kpiHtml({ label: 'Open', icon: '🔓', value: openCount, accent: 'var(--amber)', sub: 'Not yet complete' }) +
            kpiHtml({ label: 'Completed', icon: '✅', value: all.length - openCount, accent: 'var(--teal-lt)', sub: 'All settled' });
        /* the last two are counts, not money */
        const k = document.querySelectorAll('#l-kpis .kpi-value');
        [k[2], k[3]].forEach(function(el, i) {
            const n = i === 0 ? openCount : all.length - openCount;
            el.innerHTML = '<span class="v-full">' + n + '</span><span class="v-short">' + n + '</span>';
        });

        const list = all.filter(function(l) {
            const done = l.status === 'done';
            return filter === 'all' || (filter === 'done' ? done : !done);
        }).sort(function(a, b) {
            const da = (a.entries && a.entries[0] && a.entries[0].date) || '';
            const db2 = (b.entries && b.entries[0] && b.entries[0].date) || '';
            return da < db2 ? 1 : da > db2 ? -1 : 0;
        });

        document.getElementById('l-list').innerHTML = list.length ? list.map(loanCard).join('') :
            emptyState('🤝', filter === 'done' ? 'Nothing completed yet.' : 'Nothing open. Tap “Friend gave me money” or “I gave money”.');
    }

    function loanCard(l) {
        const k = KIND[l.kind] || KIND.lent;
        const s = loanSummary(l);
        const done = l.status === 'done';
        const pct = s.total > 0 ? Math.min(100, (s.back / s.total) * 100) : 0;
        const expanded = !!openIds[l.id];
        const entries = (l.entries || []).slice().sort(function(a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0; });
        const rows = entries.map(function(e) {
            const isBack = e.dir === k.backDir;
            return '<div class="loan-entry"><div><b>' + (isBack ? '↩ ' + k.backLabel : (e === l.entries[0] ? '▶ ' + k.start : '➕ ' + k.moreLabel)) + '</b>' +
                '<small>' + esc(fmtDay(e.date)) + ' · ' + esc(accName(e.accountId)) + (e.note ? ' · ' + esc(e.note) : '') + '</small></div>' +
                '<div class="loan-entry-amt"><b class="num ' + (e.dir === 'in' ? 'up' : 'down') + '">' + (e.dir === 'in' ? '+' : '−') + fmt(e.amt) + '</b>' +
                '<button type="button" class="icon-btn" data-edit-entry="' + esc(l.id) + '|' + esc(e.id) + '" aria-label="Edit entry">✏️</button>' +
                '<button type="button" class="icon-btn" data-del-entry="' + esc(l.id) + '|' + esc(e.id) + '" aria-label="Delete entry">🗑️</button></div></div>';
        }).join('');

        return '<div class="card loan' + (done ? ' loan-done' : '') + '" data-loan="' + esc(l.id) + '">' +
            '<div class="loan-head"><span class="loan-av">' + esc((l.person || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div class="loan-who"><b>' + esc(l.person) + '</b><small>' + k.icon + ' ' + k.label + ' · since ' + esc(fmtDay((l.entries[0] || {}).date)) + (l.note ? ' · ' + esc(l.note) : '') + '</small></div>' +
            '<div class="loan-amt"><small>' + (done ? 'Settled' : 'Still to ' + (l.kind === 'held' ? 'give back' : 'get back')) + '</small>' +
            '<b class="num ' + (done || s.outstanding <= 0 ? 'up' : (l.kind === 'held' ? 'gold' : 'sky')) + '">' + fmt(done ? 0 : Math.max(0, s.outstanding)) + '</b></div></div>' +
            progressBar(pct, pct >= 100 ? '' : 'warn') +
            '<div class="row-between small"><span class="muted">' + (l.kind === 'held' ? 'Received' : 'Given') + ' <b class="num">' + fmt(s.total) + '</b> · ' + (l.kind === 'held' ? 'returned' : 'got back') + ' <b class="num">' + fmt(s.back) + '</b></span>' +
            (done ? '<span class="badge badge-ok">✓ Complete</span>' : '<span class="badge badge-warn">Open</span>') + '</div>' +
            '<div class="loan-actions">' +
            (!done ? '<button type="button" class="btn btn-teal btn-sm" data-act="back" data-id="' + esc(l.id) + '">↩ ' + k.backLabel + '</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-act="more" data-id="' + esc(l.id) + '">➕ ' + k.moreLabel + '</button>' +
                '<button type="button" class="btn btn-gold btn-sm" data-act="complete" data-id="' + esc(l.id) + '">✔ Mark complete</button>' :
                '<button type="button" class="btn btn-ghost btn-sm" data-act="reopen" data-id="' + esc(l.id) + '">↺ Reopen</button>') +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="edit" data-id="' + esc(l.id) + '">✏️ Edit</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="toggle" data-id="' + esc(l.id) + '">' + (expanded ? '▲ Hide' : '▼ History (' + entries.length + ')') + '</button>' +
            '<button type="button" class="btn btn-fire btn-sm" data-act="delete" data-id="' + esc(l.id) + '">🗑️</button></div>' +
            (expanded ? '<div class="loan-entries">' + rows + '</div>' : '') + '</div>';
    }

    /* ── forms ───────────────────────────────────────────── */
    function accountsReady() {
        if (!store.data.accounts.filter(function(a) { return !a.archived; }).length) {
            toast('Add your accounts first (Dashboard → Enter my balances).', 'warn', 5000);
            return false;
        }
        return true;
    }

    /* opts: { title, dir, amount, date, accountId, note, person(for new), askPerson, kind, onSave(data) } */
    function entryModal(opts) {
        const bal = accountBalances(store.data);
        const accounts = store.data.accounts;
        const people = store.data.loans.map(function(l) { return l.person; }).filter(function(p, i, a) { return p && a.indexOf(p) === i; });
        const sel = opts.accountId || lastAccount('loan') || '';
        const m = openModal({
            title: opts.title,
            html:
                (opts.askPerson ? '<div class="field"><label for="lm-person">Friend / person name</label><input type="text" id="lm-person" list="lm-people" maxlength="40" autocomplete="off">' +
                    '<datalist id="lm-people">' + people.map(function(p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist></div>' : '') +
                '<div class="form-grid" style="--fmin:140px">' +
                '<div class="field"><label for="lm-amt">Amount (₹)</label><input type="number" id="lm-amt" inputmode="decimal" min="0" step="any" value="' + (opts.amount !== undefined ? esc(opts.amount) : '') + '"></div>' +
                '<div class="field"><label for="lm-date">Date</label><input type="date" id="lm-date" value="' + esc(opts.date || todayStr()) + '"></div></div>' +
                '<div class="field"><label for="lm-acc">' + (opts.dir === 'in' ? 'Money went into' : 'Money came out of') + ' (cash / bank / savings)</label>' +
                '<select id="lm-acc">' + accountOptions(accounts, bal, sel, false) + '</select></div>' +
                '<div class="field"><label for="lm-note">Note (optional)</label><input type="text" id="lm-note" maxlength="80" value="' + esc(opts.note || '') + '"></div>' +
                '<div class="hint" id="lm-hint">' + esc(opts.hint || '') + '</div>' +
                '<div class="form-actions"><button type="button" class="btn btn-teal" id="lm-save">Save</button></div>'
        });
        m.body.querySelector('#lm-save').addEventListener('click', async function() {
            const amt = r2(parseFloat(m.body.querySelector('#lm-amt').value));
            const person = opts.askPerson ? m.body.querySelector('#lm-person').value.trim() : '';
            const acc = m.body.querySelector('#lm-acc').value;
            if (opts.askPerson && !person) { toast('Enter the person’s name.', 'warn'); return; }
            if (!(amt > 0)) { toast('Enter an amount above zero.', 'warn'); return; }
            if (!acc) { toast('Pick the account (cash or online).', 'warn'); return; }
            if (opts.max !== undefined && amt > opts.max + 0.005) { toast('That is more than the ' + fmt(opts.max) + ' still remaining.', 'warn', 4500); return; }
            if (opts.dir === 'out') {
                const have = (bal[acc] || 0) + (opts.refund && opts.refundAcc === acc ? opts.refund : 0);
                if (amt > have + 0.005) {
                    const ok = await confirmBox('This account only has ' + fmt(have) + '. Continue anyway?', { okText: 'Continue', danger: false });
                    if (!ok) { return; }
                }
            }
            const btn = m.body.querySelector('#lm-save');
            btn.disabled = true;
            try {
                await opts.onSave({ person: person, amt: amt, date: m.body.querySelector('#lm-date').value || todayStr(), accountId: acc, note: m.body.querySelector('#lm-note').value.trim() });
                rememberAccount('loan', acc);
                m.close();
            } catch (err) { btn.disabled = false; fail(err); }
        });
    }

    function newId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    async function afterChange(id, entries) {
        /* auto-complete when everything is returned (uses the entries just written) */
        const l = loanById(id);
        if (!l) { return; }
        const s = loanSummary(Object.assign({}, l, { entries: entries }));
        if (l.status !== 'done' && s.outstanding <= 0.005 && s.total > 0) {
            await saveRecord('loans', { status: 'done', doneOn: todayStr() }, id);
            toast('All returned — marked complete ✓', 'ok', 3500);
        } else { toast('Saved ✓', 'ok'); }
    }

    function newLoan(kind) {
        if (!accountsReady()) { return; }
        const k = KIND[kind];
        entryModal({
            title: k.icon + ' ' + k.start, dir: k.startDir, askPerson: true,
            hint: kind === 'held' ? 'This money goes into the account you pick, but it is not your income.' : 'This money leaves the account you pick. You will see it as “to get back”.',
            onSave: async function(d) {
                const existing = store.data.loans.filter(function(l) { return l.kind === kind && l.status !== 'done' && l.person.toLowerCase() === d.person.toLowerCase(); })[0];
                const entry = { id: newId(), dir: k.startDir, amt: d.amt, date: d.date, accountId: d.accountId, note: d.note };
                if (existing) {
                    await saveRecord('loans', { entries: existing.entries.concat([entry]) }, existing.id);
                    toast('Added to the open record of ' + existing.person + ' ✓', 'ok');
                } else {
                    await saveRecord('loans', { person: d.person, kind: kind, status: 'open', note: '', entries: [entry] });
                    toast('Saved ✓', 'ok');
                }
            }
        });
    }

    function addEntry(id, back) {
        const l = loanById(id);
        if (!l || !accountsReady()) { return; }
        const k = KIND[l.kind];
        const s = loanSummary(l);
        const dir = back ? k.backDir : k.startDir;
        entryModal({
            title: (back ? '↩ ' + k.backLabel : '➕ ' + k.moreLabel) + ' — ' + l.person, dir: dir,
            amount: back && s.outstanding > 0 ? s.outstanding : undefined,
            max: back ? s.outstanding : undefined,
            hint: back ? 'Remaining: ' + fmt(s.outstanding) + '. Part-payments are fine.' : '',
            onSave: async function(d) {
                const entries = l.entries.concat([{ id: newId(), dir: dir, amt: d.amt, date: d.date, accountId: d.accountId, note: d.note }]);
                await saveRecord('loans', { entries: entries }, id);
                await afterChange(id, entries);
            }
        });
    }

    function editEntry(id, eid) {
        const l = loanById(id);
        const e = l && l.entries.filter(function(x) { return x.id === eid; })[0];
        if (!e) { return; }
        const k = KIND[l.kind];
        const s = loanSummary(l);
        const isBack = e.dir === k.backDir;
        entryModal({
            title: '✏️ Edit entry — ' + l.person, dir: e.dir, amount: e.amt, date: e.date, accountId: e.accountId, note: e.note,
            max: isBack ? s.outstanding + e.amt : undefined,
            refund: e.amt, refundAcc: e.accountId,
            onSave: async function(d) {
                const entries = l.entries.map(function(x) { return x.id === eid ? Object.assign({}, x, { amt: d.amt, date: d.date, accountId: d.accountId, note: d.note }) : x; });
                await saveRecord('loans', { entries: entries }, id);
                await afterChange(id, entries);
            }
        });
    }

    function editLoan(id) {
        const l = loanById(id);
        if (!l) { return; }
        const m = openModal({
            title: '✏️ Edit — ' + l.person,
            html: '<div class="field"><label for="le-person">Name</label><input type="text" id="le-person" maxlength="40" value="' + esc(l.person) + '"></div>' +
                '<div class="field"><label for="le-note">Note</label><input type="text" id="le-note" maxlength="80" value="' + esc(l.note || '') + '"></div>' +
                '<div class="form-actions"><button type="button" class="btn btn-teal" id="le-save">Save</button></div>'
        });
        m.body.querySelector('#le-save').addEventListener('click', function() {
            const p = m.body.querySelector('#le-person').value.trim();
            if (!p) { toast('Name cannot be empty.', 'warn'); return; }
            saveRecord('loans', { person: p, note: m.body.querySelector('#le-note').value.trim() }, id).then(function() { m.close(); toast('Saved ✓', 'ok'); }, fail);
        });
    }

    async function setStatus(id, status) {
        const l = loanById(id);
        if (!l) { return; }
        const s = loanSummary(l);
        if (status === 'done' && s.outstanding > 0.005) {
            const ok = await confirmBox(fmt(s.outstanding) + ' is still ' + (l.kind === 'held' ? 'to be given back' : 'to be returned') + '. Mark complete anyway? (It will no longer count in your net worth.)', { okText: 'Mark complete', danger: false });
            if (!ok) { return; }
        }
        saveRecord('loans', { status: status, doneOn: status === 'done' ? todayStr() : '' }, id).then(function() { toast(status === 'done' ? 'Marked complete ✓' : 'Reopened', 'ok'); }, fail);
    }

    async function delLoan(id) {
        const l = loanById(id);
        if (!l) { return; }
        const ok = await confirmBox('Delete the whole record of ' + l.person + '? Their account effects are reversed too.', { okText: 'Delete', danger: true });
        if (ok) { removeRecord('loans', id).then(function() { toast('Deleted', 'ok'); }, fail); }
    }

    async function delEntry(id, eid) {
        const l = loanById(id);
        if (!l) { return; }
        if (l.entries.length <= 1) { toast('This is the only entry — delete the whole record instead.', 'warn', 4000); return; }
        const ok = await confirmBox('Delete this entry? The account balance is corrected.', { okText: 'Delete', danger: true });
        if (!ok) { return; }
        saveRecord('loans', { entries: l.entries.filter(function(x) { return x.id !== eid; }), status: 'open' }, id).then(function() { toast('Deleted', 'ok'); }, fail);
    }

    /* ── events ──────────────────────────────────────────── */
    document.getElementById('main').addEventListener('click', function(e) {
        const n = e.target.closest('[data-new]');
        if (n) { newLoan(n.getAttribute('data-new')); return; }
        const f = e.target.closest('[data-filter]');
        if (f) {
            filter = f.getAttribute('data-filter');
            page.querySelectorAll('[data-filter]').forEach(function(c) { c.classList.toggle('on', c === f); });
            render();
            return;
        }
        const ee = e.target.closest('[data-edit-entry]');
        if (ee) { const p = ee.getAttribute('data-edit-entry').split('|'); editEntry(p[0], p[1]); return; }
        const de = e.target.closest('[data-del-entry]');
        if (de) { const p = de.getAttribute('data-del-entry').split('|'); delEntry(p[0], p[1]); return; }
        const a = e.target.closest('[data-act]');
        if (!a) { return; }
        const id = a.getAttribute('data-id');
        const act = a.getAttribute('data-act');
        if (act === 'back') { addEntry(id, true); }
        if (act === 'more') { addEntry(id, false); }
        if (act === 'complete') { setStatus(id, 'done'); }
        if (act === 'reopen') { setStatus(id, 'open'); }
        if (act === 'edit') { editLoan(id); }
        if (act === 'delete') { delLoan(id); }
        if (act === 'toggle') { openIds[id] = !openIds[id]; render(); }
    });

    render();
    subscribe(render);
});

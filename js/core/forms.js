/* ============================================================
   MEEZAN — ميزان  |  js/core/forms.js
   Add / edit forms (open as a modal on laptop, bottom-sheet on phone):
     openIncomeForm · openExpenseForm · openTransferForm
     openAccountForm · openOrnamentForm · openSetupBalances
     deleteWithConfirm
   ============================================================ */

import { ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER, INCOME_CATS, isTrustIncome, givingKind } from './constants.js';
import { esc, fmt, num, todayStr } from './utils.js';
import { store, saveRecord, removeRecord, setAccountBalance, deleteAccount } from './store.js';
import { accountBalances } from './calc.js';
import { openModal, toast, confirmBox, incomeCatOptions, expenseCatOptions, accountOptions, lastAccount, rememberAccount } from './ui.js';
import { db, writeBatch, doc, collection, serverTimestamp } from './firebase.js';

function val(root, name) {
    const el = root.querySelector('[name="' + name + '"]');
    return el ? el.value : '';
}

function fail(root, message) {
    let box = root.querySelector('.form-error');
    if (!box) {
        box = document.createElement('div');
        box.className = 'banner banner-bad form-error';
        box.setAttribute('role', 'alert');
        root.insertBefore(box, root.firstChild);
    }
    box.textContent = message;
    box.scrollIntoView({ block: 'nearest' });
}

function activeAccounts() {
    return store.data.accounts.filter(function(a) { return !a.archived; })
        .sort(function(a, b) { return num(a.order) - num(b.order); });
}

/* ═══════════════════════════ INCOME ═══════════════════════════ */
export function openIncomeForm(opts) {
    const o = opts || {};
    const rec = o.record || null;
    const balances = accountBalances(store.data);
    const accs = activeAccounts();
    const pickedAcc = rec ? (rec.accountId || '') : (lastAccount('income') || (accs[0] && accs[0].id) || '');
    const m = openModal({
        title: rec ? 'Edit income' : 'Add income',
        html:
            '<div class="form-grid">' +
            '<div class="field full"><label for="f-name">Source / description</label>' +
            '<input type="text" id="f-name" name="name" placeholder="e.g. October salary" maxlength="80" value="' + esc(rec ? rec.name : '') + '"></div>' +
            '<div class="field"><label for="f-amt">Amount (₹)</label>' +
            '<input type="number" id="f-amt" name="amt" inputmode="decimal" min="0" step="any" placeholder="0" value="' + (rec ? esc(rec.amt) : '') + '"></div>' +
            '<div class="field"><label for="f-date">Date</label>' +
            '<input type="date" id="f-date" name="date" value="' + esc(rec ? rec.date : todayStr()) + '"></div>' +
            '<div class="field"><label for="f-type">Category</label>' +
            '<select id="f-type" name="type">' + incomeCatOptions(rec ? rec.type : o.type || 'Salary') + '</select></div>' +
            '<div class="field"><label for="f-acc">Money goes into</label>' +
            '<select id="f-acc" name="accountId">' + accountOptions(accs, balances, pickedAcc, true) + '</select></div>' +
            '<div class="field"><label for="f-recur">Repeats</label>' +
            '<select id="f-recur" name="recur">' +
            ['One-off', 'Weekly', 'Monthly', 'Yearly'].map(function(r) {
                return '<option' + ((rec ? rec.recur : 'One-off') === r ? ' selected' : '') + '>' + r + '</option>';
            }).join('') + '</select></div>' +
            '<div class="field full"><label for="f-notes">Notes (optional)</label>' +
            '<input type="text" id="f-notes" name="notes" maxlength="200" value="' + esc(rec ? rec.notes : '') + '"></div>' +
            '</div>' +
            '<div class="banner banner-info" id="trust-hint" hidden>🤝 <strong>Friends\' money is amanah.</strong> ' +
            'It is added to the account balance, but it is <em>not</em> counted as your income, and it is deducted from your net worth and Zakat until you return it.</div>' +
            (accs.length ? '' : '<div class="banner banner-warn">You have no accounts yet. Add one on the <a href="assets.html">Accounts &amp; Assets</a> page so money can be tracked.</div>') +
            '<div class="form-actions"><button type="button" class="btn btn-teal" data-act="save">' + (rec ? '✓ Save changes' : '+ Add income') + '</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    });
    const body = m.body;
    const typeSel = body.querySelector('[name="type"]');
    function syncHint() { body.querySelector('#trust-hint').hidden = !isTrustIncome(typeSel.value); }
    typeSel.addEventListener('change', syncHint);
    syncHint();

    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        const name = val(body, 'name').trim();
        const amt = parseFloat(val(body, 'amt'));
        const date = val(body, 'date');
        if (!name) { return fail(body, 'Please enter a source or description.'); }
        if (isNaN(amt) || amt <= 0) { return fail(body, 'Please enter an amount greater than 0.'); }
        if (!date) { return fail(body, 'Please choose a date.'); }
        const data = {
            name: name, amt: amt, type: val(body, 'type') || 'Other', recur: val(body, 'recur') || 'One-off',
            date: date, notes: val(body, 'notes').trim(), accountId: val(body, 'accountId') || '', currency: 'INR'
        };
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await saveRecord('income', data, rec ? rec.id : null);
            if (data.accountId) { rememberAccount('income', data.accountId); }
            toast(rec ? 'Income updated ✓' : 'Income added ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = rec ? '✓ Save changes' : '+ Add income';
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    return m;
}

/* ═══════════════════════════ EXPENSE ══════════════════════════ */
export function openExpenseForm(opts) {
    const o = opts || {};
    const rec = o.record || null;
    const preset = o.preset || {};
    const balances = accountBalances(store.data);
    const accs = activeAccounts();
    const pickedAcc = rec ? (rec.accountId || '') : (lastAccount('expense') || (accs[0] && accs[0].id) || '');
    const startCat = rec ? rec.cat : (preset.cat || 'Food');
    const m = openModal({
        title: rec ? 'Edit expense' : (preset.title || 'Add expense'),
        html:
            '<div class="form-grid">' +
            '<div class="field full"><label for="f-name">Item / description</label>' +
            '<input type="text" id="f-name" name="name" placeholder="e.g. Room rent" maxlength="80" value="' + esc(rec ? rec.name : (preset.name || '')) + '"></div>' +
            '<div class="field"><label for="f-amt">Amount (₹)</label>' +
            '<input type="number" id="f-amt" name="amt" inputmode="decimal" min="0" step="any" placeholder="0" value="' + (rec ? esc(rec.amt) : (preset.amt || '')) + '"></div>' +
            '<div class="field"><label for="f-date">Date</label>' +
            '<input type="date" id="f-date" name="date" value="' + esc(rec ? rec.date : todayStr()) + '"></div>' +
            '<div class="field"><label for="f-cat">Category</label>' +
            '<select id="f-cat" name="cat">' + expenseCatOptions(startCat) + '</select></div>' +
            '<div class="field"><label for="f-acc">Paid from</label>' +
            '<select id="f-acc" name="accountId">' + accountOptions(accs, balances, pickedAcc, true) + '</select></div>' +
            '<div class="field full"><label for="f-src">Spending from income (optional)</label>' +
            '<select id="f-src" name="incomeSrc"><option value="Any">Any / general</option>' +
            INCOME_CATS.filter(function(c) { return !c.trust; }).map(function(c) {
                return '<option value="' + esc(c.label) + '"' + (rec && rec.incomeSrc === c.label ? ' selected' : '') + '>' + c.icon + ' ' + esc(c.label) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="field full"><label for="f-notes">Notes (optional)</label>' +
            '<input type="text" id="f-notes" name="notes" maxlength="200" value="' + esc(rec ? rec.notes : '') + '"></div>' +
            '</div>' +
            '<div class="banner banner-warn" id="low-hint" hidden></div>' +
            '<div class="banner banner-info" id="give-hint" hidden>🤲 This will count toward your charity goal on the Zakat &amp; Sadaqah page.</div>' +
            (accs.length ? '' : '<div class="banner banner-warn">You have no accounts yet. Add one on the <a href="assets.html">Accounts &amp; Assets</a> page.</div>') +
            '<div class="form-actions"><button type="button" class="btn btn-fire" data-act="save">' + (rec ? '✓ Save changes' : '− Add expense') + '</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    });
    const body = m.body;
    const catSel = body.querySelector('[name="cat"]');
    const accSel = body.querySelector('[name="accountId"]');
    const amtEl = body.querySelector('[name="amt"]');

    function sync() {
        body.querySelector('#give-hint').hidden = !givingKind(catSel.value);
        const low = body.querySelector('#low-hint');
        const id = accSel.value;
        const amt = parseFloat(amtEl.value);
        if (id && !isNaN(amt)) {
            let available = balances[id] || 0;
            if (rec && rec.accountId === id) { available += num(rec.amt); }
            if (amt > available) {
                low.hidden = false;
                low.textContent = '⚠️ This account only has ' + fmt(available) + '. You can still save — its balance will go negative.';
                return;
            }
        }
        low.hidden = true;
    }
    catSel.addEventListener('change', sync);
    accSel.addEventListener('change', sync);
    amtEl.addEventListener('input', sync);
    sync();

    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        const name = val(body, 'name').trim();
        const amt = parseFloat(val(body, 'amt'));
        const date = val(body, 'date');
        if (!name) { return fail(body, 'Please enter what the expense was for.'); }
        if (isNaN(amt) || amt <= 0) { return fail(body, 'Please enter an amount greater than 0.'); }
        if (!date) { return fail(body, 'Please choose a date.'); }
        const src = val(body, 'incomeSrc') || 'Any';
        const data = {
            name: name, amt: amt, cat: val(body, 'cat') || 'Other', date: date, notes: val(body, 'notes').trim(),
            accountId: val(body, 'accountId') || '', incomeSrc: src, incomeSrcType: src
        };
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await saveRecord('expenses', data, rec ? rec.id : null);
            if (data.accountId) { rememberAccount('expense', data.accountId); }
            toast(rec ? 'Expense updated ✓' : 'Expense added ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = rec ? '✓ Save changes' : '− Add expense';
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    return m;
}

/* ═══════════════════════════ TRANSFER ═════════════════════════ */
export function openTransferForm() {
    const balances = accountBalances(store.data);
    const accs = activeAccounts();
    if (accs.length < 2) {
        toast('Add at least two accounts to move money between them.', 'warn', 4200);
        return null;
    }
    const m = openModal({
        title: 'Move money between accounts',
        html:
            '<div class="form-grid">' +
            '<div class="field"><label for="f-from">From</label><select id="f-from" name="fromId">' + accountOptions(accs, balances, accs[0].id, false) + '</select></div>' +
            '<div class="field"><label for="f-to">To</label><select id="f-to" name="toId">' + accountOptions(accs, balances, accs[1].id, false) + '</select></div>' +
            '<div class="field"><label for="f-amt">Amount (₹)</label><input type="number" id="f-amt" name="amt" inputmode="decimal" min="0" step="any" placeholder="0"></div>' +
            '<div class="field"><label for="f-date">Date</label><input type="date" id="f-date" name="date" value="' + todayStr() + '"></div>' +
            '<div class="field full"><label for="f-note">Note (optional)</label><input type="text" id="f-note" name="note" maxlength="120" placeholder="e.g. moved to savings"></div>' +
            '</div>' +
            '<p class="hint">A transfer only moves money — it is not income or an expense, so your reports stay accurate.</p>' +
            '<div class="form-actions"><button type="button" class="btn btn-gold" data-act="save">⇄ Move money</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    });
    const body = m.body;
    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        const fromId = val(body, 'fromId');
        const toId = val(body, 'toId');
        const amt = parseFloat(val(body, 'amt'));
        if (fromId === toId) { return fail(body, 'Choose two different accounts.'); }
        if (isNaN(amt) || amt <= 0) { return fail(body, 'Please enter an amount greater than 0.'); }
        btn.disabled = true;
        try {
            await saveRecord('transfers', { fromId: fromId, toId: toId, amt: amt, date: val(body, 'date') || todayStr(), note: val(body, 'note').trim() });
            toast('Money moved ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    return m;
}

/* ═══════════════════════════ ACCOUNT ══════════════════════════ */
export function openAccountForm(opts) {
    const o = opts || {};
    const acc = o.account || null;
    const current = acc ? (accountBalances(store.data)[acc.id] || 0) : 0;
    const startType = acc ? acc.type : (o.type || 'bank');
    const m = openModal({
        title: acc ? 'Edit account' : 'Add account',
        html:
            '<div class="form-grid">' +
            '<div class="field full"><label for="f-name">Account name</label>' +
            '<input type="text" id="f-name" name="name" maxlength="50" placeholder="e.g. SBI Savings, Wallet, Gullak" value="' + esc(acc ? acc.name : '') + '"></div>' +
            '<div class="field full"><label for="f-type">Type</label><select id="f-type" name="type">' +
            ACCOUNT_TYPE_ORDER.map(function(t) {
                const a = ACCOUNT_TYPES[t];
                return '<option value="' + t + '"' + (t === startType ? ' selected' : '') + '>' + a.icon + ' ' + esc(a.long) + ' — ' + esc(a.hint) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="field full"><label for="f-bal">' + (acc ? 'Balance right now (₹)' : 'Balance today (₹)') + '</label>' +
            '<input type="number" id="f-bal" name="bal" inputmode="decimal" step="any" placeholder="0" value="' + (acc ? Math.round(current * 100) / 100 : '') + '"></div>' +
            '</div>' +
            (acc ? '<p class="hint">Changing the balance simply corrects it — it does not create an income or expense record.</p>' : '') +
            '<div class="form-actions">' +
            '<button type="button" class="btn btn-teal" data-act="save">' + (acc ? '✓ Save' : '+ Add account') + '</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button>' +
            (acc ? '<button type="button" class="btn btn-fire" data-act="delete">🗑️ Delete</button>' : '') +
            '</div>'
    });
    const body = m.body;
    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        const name = val(body, 'name').trim();
        const balRaw = val(body, 'bal');
        const bal = balRaw === '' ? 0 : parseFloat(balRaw);
        if (!name) { return fail(body, 'Please give the account a name.'); }
        if (isNaN(bal)) { return fail(body, 'Balance must be a number.'); }
        btn.disabled = true;
        try {
            if (acc) {
                await saveRecord('accounts', { name: name, type: val(body, 'type') }, acc.id);
                await setAccountBalance(acc.id, bal);
            } else {
                await saveRecord('accounts', { name: name, type: val(body, 'type'), openingBalance: bal, archived: false, order: store.data.accounts.length });
            }
            toast(acc ? 'Account updated ✓' : 'Account added ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    if (acc) {
        body.querySelector('[data-act="delete"]').addEventListener('click', async function() {
            const ok = await confirmBox('Delete "' + acc.name + '"? Its income and expense records stay, but they will show as "not linked".', { okText: 'Delete account', danger: true });
            if (!ok) { return; }
            try {
                await deleteAccount(acc.id);
                toast('Account deleted', 'ok');
                m.close();
            } catch (err) {
                fail(body, 'Could not delete: ' + (err.code || err.message));
            }
        });
    }
    return m;
}

/* ═══════════════════════ FIRST-RUN BALANCES ═══════════════════ */
export function openSetupBalances() {
    const m = openModal({
        title: 'What do you have today?',
        html:
            '<p class="muted">Enter your current balances. You can add more accounts later (for example a second bank account).</p>' +
            '<div class="form-grid">' +
            ACCOUNT_TYPE_ORDER.map(function(t) {
                const a = ACCOUNT_TYPES[t];
                return '<div class="field"><label for="b-' + t + '">' + a.icon + ' ' + esc(a.long) + ' (₹)</label>' +
                    '<input type="number" id="b-' + t + '" name="' + t + '" inputmode="decimal" step="any" placeholder="0"></div>';
            }).join('') + '</div>' +
            '<div class="form-actions"><button type="button" class="btn btn-teal" data-act="save">✓ Save my balances</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    });
    const body = m.body;
    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            const batch = writeBatch(db);
            ACCOUNT_TYPE_ORDER.forEach(function(t, i) {
                const ref = doc(collection(db, 'users', store.uid, 'accounts'));
                const amount = parseFloat(val(body, t));
                batch.set(ref, {
                    name: t === 'bank' ? 'Bank Account' : ACCOUNT_TYPES[t].label,
                    type: t, openingBalance: isNaN(amount) ? 0 : amount, order: i, archived: false,
                    uid: store.uid, createdAt: serverTimestamp()
                });
            });
            await batch.commit();
            toast('Balances saved ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    return m;
}

/* ═══════════════════════════ ORNAMENT ═════════════════════════ */
const ORNAMENT_TYPES = ['Ring', 'Chain', 'Necklace', 'Bangle', 'Earrings', 'Bracelet', 'Anklet', 'Coin / Bar', 'Utensil', 'Other'];

export function openOrnamentForm(opts) {
    const rec = (opts && opts.record) || null;
    function n(key) { return rec && rec[key] !== undefined ? esc(rec[key]) : ''; }
    function numField(id, name, label) {
        return '<div class="field"><label for="o-' + id + '">' + label + '</label><input type="number" id="o-' + id + '" name="' + name +
            '" inputmode="decimal" step="any" min="0" value="' + n(name) + '"></div>';
    }
    const m = openModal({
        title: rec ? 'Edit ornament' : 'Add gold / silver',
        wide: true,
        html:
            '<div class="form-grid">' +
            '<div class="field"><label for="o-name">Name</label><input type="text" id="o-name" name="name" maxlength="60" placeholder="e.g. Wedding chain" value="' + (rec ? esc(rec.name) : '') + '"></div>' +
            '<div class="field"><label for="o-type">Type</label><select id="o-type" name="type">' +
            ORNAMENT_TYPES.map(function(t) { return '<option' + (rec && rec.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
            numField('goldG', 'goldG', 'Gold weight (g)') +
            '<div class="field"><label for="o-goldK">Gold purity</label><select id="o-goldK" name="goldK">' +
            [24, 22, 18, 14].map(function(k) { return '<option value="' + k + '"' + ((rec ? num(rec.goldK) : 22) === k ? ' selected' : '') + '>' + k + 'K</option>'; }).join('') + '</select></div>' +
            numField('silvG', 'silvG', 'Silver weight (g)') +
            numField('diamV', 'diamV', 'Diamond value (₹)') +
            numField('stonV', 'stonV', 'Stones value (₹)') +
            numField('makeV', 'makeV', 'Making charges (₹)') +
            numField('buy', 'buyPrice', 'Purchase price (₹)') +
            '<div class="field"><label for="o-date">Date bought</label><input type="date" id="o-date" name="date" value="' + esc(rec ? rec.date : todayStr()) + '"></div>' +
            '<div class="field full"><label for="o-notes">Notes (optional)</label><input type="text" id="o-notes" name="notes" maxlength="200" value="' + (rec ? esc(rec.notes) : '') + '"></div>' +
            '</div>' +
            '<p class="hint">Only the gold and silver weight count towards Zakat — not stones or making charges.</p>' +
            '<div class="form-actions"><button type="button" class="btn btn-gold" data-act="save">' + (rec ? '✓ Save changes' : '+ Add') + '</button>' +
            '<button type="button" class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    });
    const body = m.body;
    body.querySelector('[data-act="cancel"]').addEventListener('click', m.close);
    body.querySelector('[data-act="save"]').addEventListener('click', async function(e) {
        const btn = e.currentTarget;
        const name = val(body, 'name').trim();
        if (!name) { return fail(body, 'Please name the ornament.'); }
        const data = {
            name: name, type: val(body, 'type'), goldG: num(val(body, 'goldG')), goldK: parseInt(val(body, 'goldK'), 10) || 22,
            silvG: num(val(body, 'silvG')), diamV: num(val(body, 'diamV')), stonV: num(val(body, 'stonV')), makeV: num(val(body, 'makeV')),
            buyPrice: num(val(body, 'buyPrice')), date: val(body, 'date') || todayStr(), notes: val(body, 'notes').trim()
        };
        if (data.goldG <= 0 && data.silvG <= 0 && data.diamV <= 0 && data.stonV <= 0) {
            return fail(body, 'Enter a gold or silver weight (or a stone value).');
        }
        btn.disabled = true;
        try {
            await saveRecord('ornaments', data, rec ? rec.id : null);
            toast(rec ? 'Ornament updated ✓' : 'Ornament added ✓', 'ok');
            m.close();
        } catch (err) {
            btn.disabled = false;
            fail(body, 'Could not save: ' + (err.code || err.message));
        }
    });
    return m;
}

/* ═══════════════════════════ DELETE ═══════════════════════════ */
export async function deleteWithConfirm(kind, id, label) {
    const ok = await confirmBox('Delete ' + (label || 'this record') + '? This cannot be undone.', { okText: 'Delete', danger: true });
    if (!ok) { return false; }
    try {
        await removeRecord(kind, id);
        toast('Deleted', 'ok');
        return true;
    } catch (err) {
        toast('Could not delete: ' + (err.code || err.message), 'err', 4500);
        return false;
    }
}

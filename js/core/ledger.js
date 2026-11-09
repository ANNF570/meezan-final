/* ============================================================
   MEEZAN — ميزان  |  js/core/ledger.js
   Normalises income + expenses + transfers into ONE list so
   Dashboard, Reports and Export show the same record history.
   ============================================================ */

import { incomeCat, expenseCat, ACCOUNT_TYPES, isTrustIncome } from './constants.js';
import { esc, fmt, fmtDay, weekdayShort, num, byNewest } from './utils.js';
import { recordRow } from './ui.js';

export function buildLedger(data, kinds) {
    const want = kinds || ['income', 'expense', 'transfer'];
    const out = [];
    if (want.indexOf('income') >= 0) {
        (data.income || []).forEach(function(r) {
            out.push({ kind: 'income', id: r.id, date: r.date, amt: num(r.amt), title: r.name, cat: r.type || 'Other',
                accountId: r.accountId || '', notes: r.notes || '', createdAt: r.createdAt, raw: r });
        });
    }
    if (want.indexOf('expense') >= 0) {
        (data.expenses || []).forEach(function(r) {
            out.push({ kind: 'expense', id: r.id, date: r.date, amt: num(r.amt), title: r.name, cat: r.cat || 'Other',
                accountId: r.accountId || '', notes: r.notes || '', createdAt: r.createdAt, raw: r });
        });
    }
    if (want.indexOf('transfer') >= 0) {
        (data.transfers || []).forEach(function(r) {
            out.push({ kind: 'transfer', id: r.id, date: r.date, amt: num(r.amt), title: 'Transfer', cat: 'Transfer',
                accountId: r.fromId || '', toId: r.toId || '', notes: r.note || '', createdAt: r.createdAt, raw: r });
        });
    }
    out.sort(byNewest);
    return out;
}

function accountLabel(accounts, id) {
    const a = accounts.filter(function(x) { return x.id === id; })[0];
    if (!a) { return ''; }
    const t = ACCOUNT_TYPES[a.type] || ACCOUNT_TYPES.cash;
    return t.icon + ' ' + esc(a.name);
}

/* One HTML row for any ledger item. Buttons carry data-action + data-kind. */
export function ledgerRowHtml(item, accounts) {
    const acc = accountLabel(accounts, item.accountId);
    let icon, color, tone, amount, metaCat;
    if (item.kind === 'income') {
        const c = incomeCat(item.cat);
        icon = c.icon; color = c.color; tone = 'in';
        amount = '+' + fmt(item.amt);
        metaCat = esc(item.cat) + (isTrustIncome(item.cat) ? ' <span class="tag">amanah</span>' : '');
    } else if (item.kind === 'expense') {
        const c = expenseCat(item.cat);
        icon = c.icon; color = c.color; tone = 'out';
        amount = '−' + fmt(item.amt);
        metaCat = esc(item.cat);
    } else {
        icon = '⇄'; color = '#5dade2'; tone = 'neutral';
        amount = fmt(item.amt);
        metaCat = 'Transfer';
    }
    const to = item.kind === 'transfer' ? accountLabel(accounts, item.toId) : '';
    const meta =
        '<span>' + weekdayShort(item.date) + ' ' + fmtDay(item.date) + '</span>' +
        '<span>' + metaCat + '</span>' +
        (item.kind === 'transfer' ? '<span>' + (acc || '?') + ' → ' + (to || '?') + '</span>' :
            (acc ? '<span>' + acc + '</span>' : '<span class="tag">not linked</span>')) +
        (item.notes ? '<span>' + esc(item.notes) + '</span>' : '');
    let html = recordRow({ id: item.id, icon: icon, color: color, title: item.title, meta: meta, amount: amount, tone: tone });
    html = html.replace(/data-action="(edit|delete)"/g, 'data-action="$1" data-kind="' + item.kind + '"');
    if (item.kind === 'transfer') {
        html = html.replace(/<button[^>]*data-action="edit"[^>]*>.*?<\/button>/, '');
    }
    return html;
}

export function ledgerWeekSummary(items) {
    let inc = 0;
    let exp = 0;
    items.forEach(function(r) {
        if (r.kind === 'income' && !isTrustIncome(r.cat)) { inc += r.amt; }
        if (r.kind === 'expense') { exp += r.amt; }
    });
    const net = inc - exp;
    return '<div class="wk-pill"><small>In</small><b class="up">' + fmt(inc) + '</b></div>' +
        '<div class="wk-pill"><small>Out</small><b class="down">' + fmt(exp) + '</b></div>' +
        '<div class="wk-pill"><small>Net</small><b class="' + (net >= 0 ? 'up' : 'down') + '">' + fmt(net) + '</b></div>';
}

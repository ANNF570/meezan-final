/* ============================================================
   MEEZAN — ميزان  |  js/core/calc.js
   All money maths in ONE place (pure functions, no DOM, no Firebase).
   Dashboard, Zakat, Reports and Export all use these, so the
   numbers can never disagree between pages.
   ============================================================ */

import {
    ACCOUNT_TYPE_ORDER,
    KARAT_RATIO,
    NISAB_SILVER_G,
    NISAB_GOLD_G,
    isTrustIncome,
    isTrustReturn,
    givingKind
} from './constants.js';
import { num, sum, thisMonthKey, parseYmd, daysBetween, addDays, hijriOf } from './utils.js';

/* ── ACCOUNTS ────────────────────────────────────────────────
   balance = opening + income into it − expenses from it
             − transfers out + transfers in                     */
export function accountBalances(data) {
    const balances = {};
    (data.accounts || []).forEach(function(a) { balances[a.id] = num(a.openingBalance); });
    (data.income || []).forEach(function(r) {
        if (r.accountId && balances[r.accountId] !== undefined) { balances[r.accountId] += num(r.amt); }
    });
    (data.expenses || []).forEach(function(r) {
        if (r.accountId && balances[r.accountId] !== undefined) { balances[r.accountId] -= num(r.amt); }
    });
    (data.transfers || []).forEach(function(t) {
        if (t.fromId && balances[t.fromId] !== undefined) { balances[t.fromId] -= num(t.amt); }
        if (t.toId && balances[t.toId] !== undefined) { balances[t.toId] += num(t.amt); }
    });
    (data.loans || []).forEach(function(l) {
        (l.entries || []).forEach(function(e) {
            if (!e.accountId || balances[e.accountId] === undefined) { return; }
            balances[e.accountId] += e.dir === 'in' ? num(e.amt) : -num(e.amt);
        });
    });
    return balances;
}

/* ── FRIENDS & LOANS ─────────────────────────────────────────
   kind 'held' : a friend gave me money to keep  (in = he gave, out = I returned)
   kind 'lent' : I gave money to someone         (out = I gave, in = he returned)
   outstanding = what is still to be returned. A loan marked "done" counts as 0. */
export function loanSummary(l) {
    let inn = 0;
    let out = 0;
    (l.entries || []).forEach(function(e) {
        if (e.dir === 'in') { inn += num(e.amt); } else { out += num(e.amt); }
    });
    const outstanding = l.kind === 'held' ? inn - out : out - inn;
    const total = l.kind === 'held' ? inn : out;
    const back = l.kind === 'held' ? out : inn;
    return { total: total, back: back, outstanding: outstanding, done: l.status === 'done' };
}

export function loanStats(data) {
    let held = 0;
    let lent = 0;
    (data.loans || []).forEach(function(l) {
        const s = loanSummary(l);
        if (s.done || s.outstanding <= 0) { return; }
        if (l.kind === 'held') { held += s.outstanding; } else { lent += s.outstanding; }
    });
    return { held: held, lent: lent };
}

/* Totals per type: { cash:{total, accounts:[{id,name,balance}]}, ... } */
export function typeTotals(data) {
    const balances = accountBalances(data);
    const out = {};
    ACCOUNT_TYPE_ORDER.forEach(function(t) { out[t] = { total: 0, accounts: [] }; });
    (data.accounts || []).forEach(function(a) {
        if (a.archived) { return; }
        const t = out[a.type] ? a.type : 'cash';
        const bal = balances[a.id] || 0;
        out[t].total += bal;
        out[t].accounts.push({ id: a.id, name: a.name, balance: bal });
    });
    return out;
}

export function accountsTotal(data) {
    const t = typeTotals(data);
    let s = 0;
    ACCOUNT_TYPE_ORDER.forEach(function(k) { s += t[k].total; });
    return s;
}

/* Records saved before accounts existed have no accountId */
export function unlinkedCount(data) {
    let n = 0;
    (data.income || []).forEach(function(r) { if (!r.accountId) { n++; } });
    (data.expenses || []).forEach(function(r) { if (!r.accountId) { n++; } });
    return n;
}

/* ── FRIENDS' MONEY (amanah) ─────────────────────────────── */
export function trustHeld(data) {
    let held = 0;
    (data.income || []).forEach(function(r) { if (isTrustIncome(r.type)) { held += num(r.amt); } });
    (data.expenses || []).forEach(function(r) { if (isTrustReturn(r.cat)) { held -= num(r.amt); } });
    return Math.max(0, held) + loanStats(data).held;
}

/* ── PRECIOUS METALS / ASSETS ────────────────────────────── */
export function goldPerGram(prefs, karat) {
    return num(prefs.goldPrice) * (KARAT_RATIO[karat] || KARAT_RATIO[22]);
}

export function ornamentValue(o, prefs) {
    return num(o.goldG) * goldPerGram(prefs, o.goldK || 22) + num(o.silvG) * num(prefs.silverPrice) +
        num(o.diamV) + num(o.stonV) + num(o.makeV);
}

/* Only gold + silver count for Zakat (not stones / making charges) */
export function ornamentMetalValue(o, prefs) {
    return num(o.goldG) * goldPerGram(prefs, o.goldK || 22) + num(o.silvG) * num(prefs.silverPrice);
}

export function assetsValue(data, prefs) {
    let t = 0;
    (data.ornaments || []).forEach(function(o) { t += ornamentValue(o, prefs); });
    return t;
}

export function metalValue(data, prefs) {
    let t = 0;
    (data.ornaments || []).forEach(function(o) { t += ornamentMetalValue(o, prefs); });
    return t;
}

export function metalGrams(data) {
    let gold = 0;
    let silver = 0;
    (data.ornaments || []).forEach(function(o) { gold += num(o.goldG); silver += num(o.silvG); });
    return { gold: gold, silver: silver };
}

/* ── NET WORTH ───────────────────────────────────────────── */
export function netWorth(data, prefs) {
    let nw = accountsTotal(data) + assetsValue(data, prefs) + loanStats(data).lent;
    if (prefs.deductTrust) { nw -= trustHeld(data); }
    return nw;
}

/* ── INCOME / EXPENSE STATS ──────────────────────────────── */
export function ownIncome(data) {
    return (data.income || []).filter(function(r) { return !isTrustIncome(r.type); });
}

export function inMonth(list, monthKey) {
    return list.filter(function(r) { return (r.date || '').slice(0, 7) === monthKey; });
}

export function flowStats(data) {
    const mk = thisMonthKey();
    const inc = ownIncome(data);
    const exp = data.expenses || [];
    const incMonth = sum(inMonth(inc, mk), 'amt');
    const expMonth = sum(inMonth(exp, mk), 'amt');
    return {
        incomeMonth: incMonth,
        expenseMonth: expMonth,
        incomeTotal: sum(inc, 'amt'),
        expenseTotal: sum(exp, 'amt'),
        savedMonth: incMonth - expMonth
    };
}

/* ── GIVING / CHARITY GOAL ───────────────────────────────────
   Goal = charityRate % of your own income, checked for THIS MONTH
   and for ALL TIME. "Given" = Charity + Zakat expenses, plus old
   stand-alone v1 sadaqah records (v1 mirror copies are skipped).   */
export function givingRecords(data) {
    const out = [];
    (data.expenses || []).forEach(function(r) {
        const kind = givingKind(r.cat);
        if (kind) {
            out.push({ id: r.id, date: r.date, amt: num(r.amt), kind: kind, name: r.name, notes: r.notes, source: 'expense', accountId: r.accountId });
        }
    });
    (data.sadaqah || []).forEach(function(s) {
        if (s.fromExpense || s.expenseId) { return; }
        out.push({
            id: s.id, date: s.date, amt: num(s.amt),
            kind: String(s.cat || '').toLowerCase() === 'zakat' ? 'zakat' : 'sadaqah',
            name: s.desc || 'Sadaqah', notes: '', source: 'legacy'
        });
    });
    return out;
}

export function charityStats(data, prefs) {
    const rate = num(prefs.charityRate) / 100;
    const mk = thisMonthKey();
    const inc = ownIncome(data);
    const give = givingRecords(data);
    const incMonth = sum(inMonth(inc, mk), 'amt');
    const incTotal = sum(inc, 'amt');
    const givenMonth = sum(inMonth(give, mk), 'amt');
    const givenTotal = sum(give, 'amt');
    const targetMonth = incMonth * rate;
    const targetTotal = incTotal * rate;
    return {
        rate: num(prefs.charityRate),
        incomeMonth: incMonth,
        incomeTotal: incTotal,
        givenMonth: givenMonth,
        givenTotal: givenTotal,
        targetMonth: targetMonth,
        targetTotal: targetTotal,
        shortMonth: Math.max(0, targetMonth - givenMonth),
        shortTotal: Math.max(0, targetTotal - givenTotal),
        metMonth: incMonth > 0 ? givenMonth >= targetMonth : null,
        metTotal: incTotal > 0 ? givenTotal >= targetTotal : null,
        pctMonth: targetMonth > 0 ? (givenMonth / targetMonth) * 100 : 0,
        pctTotal: targetTotal > 0 ? (givenTotal / targetTotal) * 100 : 0,
        sadaqahTotal: sum(give.filter(function(g) { return g.kind === 'sadaqah'; }), 'amt'),
        zakatTotal: sum(give.filter(function(g) { return g.kind === 'zakat'; }), 'amt'),
        records: give
    };
}

/* ── ZAKAT ───────────────────────────────────────────────── */
export function nisabValue(prefs) {
    if (prefs.nisabBasis === 'gold') { return NISAB_GOLD_G * num(prefs.goldPrice); }
    return NISAB_SILVER_G * num(prefs.silverPrice);
}

export function zakatPaidByHijriYear(data, prefs) {
    const out = {};
    givingRecords(data).forEach(function(g) {
        if (g.kind !== 'zakat') { return; }
        const d = parseYmd(g.date);
        if (!d) { return; }
        const h = hijriOf(d, prefs.hijriAdjust);
        if (!h) { return; }
        out[h.year] = (out[h.year] || 0) + g.amt;
    });
    return out;
}

/* Zakatable wealth = all four account types + gold/silver
   − friends' money (optional) − short-term debts            */
export function zakatStats(data, prefs, now) {
    const today = now || new Date();
    const cashLike = accountsTotal(data);
    const metals = metalValue(data, prefs);
    const trust = prefs.deductTrust ? trustHeld(data) : 0;
    const debts = num(prefs.zakatDebts);
    const receivable = loanStats(data).lent;
    const wealth = Math.max(0, cashLike + metals + receivable - trust - debts);
    const nisab = nisabValue(prefs);
    const nisabMet = nisab > 0 && wealth >= nisab;
    const due = nisabMet ? wealth * (num(prefs.zakatRate) / 100) : 0;

    let hawl = { set: false, start: '', end: null, daysPassed: 0, daysLeft: 354, complete: false };
    const start = parseYmd(prefs.hawlStart);
    if (start) {
        const passed = daysBetween(start, today);
        hawl = {
            set: true,
            start: prefs.hawlStart,
            end: addDays(start, 354),
            daysPassed: Math.max(0, passed),
            daysLeft: Math.max(0, 354 - passed),
            complete: passed >= 354
        };
    }

    const h = hijriOf(today, prefs.hijriAdjust);
    const paid = zakatPaidByHijriYear(data, prefs);
    const paidThisYear = h ? (paid[h.year] || 0) : 0;

    return {
        cashLike: cashLike, metals: metals, receivable: receivable, trust: trust, debts: debts,
        wealth: wealth, nisab: nisab, nisabMet: nisabMet,
        rate: num(prefs.zakatRate), due: due, hawl: hawl,
        hijriYear: h ? h.year : null,
        paidThisYear: paidThisYear,
        remaining: Math.max(0, due - paidThisYear),
        settled: nisabMet && paidThisYear >= due - 0.5
    };
}

/* ── GROUPING ────────────────────────────────────────────── */
export function totalsBy(list, keyField) {
    const out = {};
    list.forEach(function(r) {
        const k = r[keyField] || 'Other';
        out[k] = (out[k] || 0) + num(r.amt);
    });
    return out;
}

export function sortedEntries(obj) {
    return Object.keys(obj).map(function(k) { return [k, obj[k]]; })
        .sort(function(a, b) { return b[1] - a[1]; });
}

export function spendRatio(incomeAmt, expenseAmt) {
    if (incomeAmt <= 0) { return expenseAmt > 0 ? 100 : 0; }
    return (expenseAmt / incomeAmt) * 100;
}

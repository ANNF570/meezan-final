/* ============================================================
   MEEZAN — ميزان  |  js/pages/dashboard.js
   Dashboard: Net worth + the 4 balance KPIs + Assets, charity
   warnings, 6-month chart, and the full record history
   (10 per page, plus a weekly side-slider).
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe } from '../core/store.js';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER } from '../core/constants.js';
import {
    typeTotals, assetsValue, netWorth, flowStats, charityStats, zakatStats,
    trustHeld, metalGrams, spendRatio
} from '../core/calc.js';
import { fmt, fmtShort, lastMonthKeys, monthLabel, sum } from '../core/utils.js';
import { createHistory } from '../core/ui.js';
import { barsHtml, areaSvg, donutSvg, gaugeSvg, hbarsHtml } from '../core/charts.js';
import { expenseCat } from '../core/constants.js';
import { totalsBy, sortedEntries, accountsTotal } from '../core/calc.js';
import { buildLedger, ledgerRowHtml, ledgerWeekSummary } from '../core/ledger.js';
import { openIncomeForm, openExpenseForm, openTransferForm } from '../core/forms.js';
import { kpiHtml, charityCardHtml, bindRecordActions, setupBannersHtml, bindSetupBanners } from '../core/widgets.js';
import { inMonth, ownIncome } from '../core/calc.js';

boot({
    page: 'dashboard',
    navKey: 'dashboard',
    title: 'Dashboard',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'ornaments', 'sadaqah']
}, function(ctx) {
    const page = document.getElementById('page');
    ctx.setActions(
        '<button type="button" class="btn btn-teal btn-sm" data-quick="income">+ Income</button>' +
        '<button type="button" class="btn btn-fire btn-sm" data-quick="expense">− Expense</button>' +
        '<button type="button" class="btn btn-gold btn-sm" data-quick="transfer">⇄ Move</button>'
    );
    document.getElementById('main').addEventListener('click', function(e) {
        const q = e.target.closest('[data-quick]');
        if (!q) { return; }
        const k = q.getAttribute('data-quick');
        if (k === 'income') { openIncomeForm(); }
        if (k === 'expense') { openExpenseForm(); }
        if (k === 'transfer') { openTransferForm(); }
    });

    page.innerHTML =
        '<div id="d-banners"></div>' +
        '<div class="kpis" id="d-networth"></div>' +
        '<div class="section-title">Where your money is</div>' +
        '<div class="kpis" id="d-accounts"></div>' +
        '<div class="section-title">This month</div>' +
        '<div class="kpis" id="d-flow"></div>' +
        '<div class="grid" style="--min:320px">' +
        '<div class="card"><div class="card-title">🤲 Charity goal <a class="link-btn" href="zakat.html">Zakat &amp; Sadaqah →</a></div><div id="d-charity"></div></div>' +
        '<div class="card"><div class="card-title">📊 Last 6 months</div><div id="d-chart"></div><div id="d-balance"></div></div>' +
        '</div>' +
        '<div class="grid" style="--min:300px">' +
        '<div class="card"><div class="card-title">🧭 Where your money is</div><div id="d-mix"></div></div>' +
        '<div class="card"><div class="card-title">🌱 Savings rate (this month)</div><div id="d-gauge"></div></div>' +
        '<div class="card"><div class="card-title">🔥 Top spending (this month)</div><div id="d-top"></div></div>' +
        '</div>' +
        '<div class="card"><div class="card-title">📈 Cash flow — last 12 months</div><div id="d-flow12"></div></div>' +
        '<div class="card"><div class="card-title">🧾 Records &amp; history</div><div id="d-history"></div></div>';

    bindSetupBanners(page);
    bindRecordActions(page);

    const history = createHistory(document.getElementById('d-history'), {
        getItems: function() { return buildLedger(store.data); },
        renderRow: function(item) { return ledgerRowHtml(item, store.data.accounts); },
        weekSummary: ledgerWeekSummary,
        amountOf: function(r) { return r.amt; },
        weekStart: function() { return store.prefs.weekStart; },
        emptyIcon: '🧾',
        emptyText: 'No records yet. Use “+ Income” or “− Expense” above.'
    });

    function render() {
        const data = store.data;
        const prefs = store.prefs;
        document.getElementById('d-banners').innerHTML = setupBannersHtml();

        /* net worth + assets */
        const types = typeTotals(data);
        const assets = assetsValue(data, prefs);
        const nw = netWorth(data, prefs);
        const trust = trustHeld(data);
        const grams = metalGrams(data);
        document.getElementById('d-networth').innerHTML =
            kpiHtml({
                label: 'Total net worth', icon: '💎', value: nw, big: true, wide: true,
                sub: 'Accounts + gold/silver' + (prefs.deductTrust && trust > 0 ? ' − ' + fmt(trust) + ' friends\' money' : '')
            });

        /* the 4 balance categories + assets */
        const accent = {};
        ACCOUNT_TYPE_ORDER.forEach(function(t) { accent[t] = ACCOUNT_TYPES[t].color; });
        document.getElementById('d-accounts').innerHTML =
            ACCOUNT_TYPE_ORDER.map(function(t) {
                const n = types[t].accounts.length;
                return kpiHtml({
                    label: ACCOUNT_TYPES[t].label, icon: ACCOUNT_TYPES[t].icon, value: types[t].total,
                    accent: accent[t], href: 'assets.html',
                    sub: n === 0 ? 'No account yet' : n === 1 ? types[t].accounts[0].name : n + ' accounts',
                    accounts: types[t].accounts
                });
            }).join('') +
            kpiHtml({
                label: 'Assets', icon: '🏅', value: assets, accent: 'var(--gold-lt)', href: 'assets.html',
                sub: (grams.gold ? grams.gold.toFixed(1) + ' g gold' : '') + (grams.gold && grams.silver ? ' · ' : '') + (grams.silver ? grams.silver.toFixed(0) + ' g silver' : '') || 'Gold & silver'
            });

        /* month flow */
        const flow = flowStats(data);
        const ratio = spendRatio(flow.incomeMonth, flow.expenseMonth);
        document.getElementById('d-flow').innerHTML =
            kpiHtml({ label: 'Income', icon: '💰', value: flow.incomeMonth, accent: 'var(--teal-lt)', href: 'income.html', sub: 'Your own income' }) +
            kpiHtml({ label: 'Spent', icon: '💸', value: flow.expenseMonth, accent: 'var(--fire-lt)', href: 'expenses.html', sub: flow.incomeMonth ? Math.round(ratio) + '% of income' : '' }) +
            kpiHtml({ label: flow.savedMonth >= 0 ? 'Saved' : 'Overspent', icon: flow.savedMonth >= 0 ? '🌱' : '⚠️', value: flow.savedMonth, accent: flow.savedMonth >= 0 ? 'var(--sky-lt)' : 'var(--amber)', sub: 'Income − spending' }) +
            kpiHtml({ label: 'Friends\' money', icon: '🤝', value: trust, accent: '#48d1b0', sub: trust > 0 ? 'Held in trust (amanah)' : 'Nothing held' });

        /* charity */
        document.getElementById('d-charity').innerHTML = charityCardHtml(charityStats(data, prefs), { settingsLink: true });

        /* chart */
        const keys = lastMonthKeys(6);
        const inc = ownIncome(data);
        const incS = keys.map(function(k) { return sum(inMonth(inc, k), 'amt'); });
        const expS = keys.map(function(k) { return sum(inMonth(data.expenses, k), 'amt'); });
        document.getElementById('d-chart').innerHTML = barsHtml(
            keys.map(function(k) { return monthLabel(k).split(' ')[0]; }),
            [{ name: 'Income', color: '#1abc9c', values: incS }, { name: 'Spent', color: '#e74c3c', values: expS }],
            { height: 110 }
        );
        const z = zakatStats(data, prefs);
        document.getElementById('d-balance').innerHTML =
            '<div class="row-between" style="margin-top:12px"><span class="muted small">🕌 Zakat</span>' +
            (z.nisabMet ? '<span class="badge badge-warn">Due ' + fmtShort(z.remaining) + '</span>' : '<span class="badge badge-muted">Nisab not met</span>') + '</div>';

        /* money mix donut (4 account types) */
        const tt = typeTotals(data);
        document.getElementById('d-mix').innerHTML = donutSvg(
            ACCOUNT_TYPE_ORDER.map(function(t) { return { label: ACCOUNT_TYPES[t].label, value: Math.max(0, tt[t].total), color: ACCOUNT_TYPES[t].color }; }),
            { size: 150, maxLegend: 4, center: { value: fmtShort(accountsTotal(data)), label: 'in accounts' } }
        );

        /* savings-rate gauge */
        const rate = flow.incomeMonth > 0 ? (flow.savedMonth / flow.incomeMonth) * 100 : 0;
        document.getElementById('d-gauge').innerHTML = gaugeSvg(rate, 'of income saved') +
            '<div class="hint center" style="margin-top:6px">' + (flow.incomeMonth > 0 ? 'Saved ' + fmt(flow.savedMonth) + ' of ' + fmt(flow.incomeMonth) : 'Add this month\'s income to see your rate') + '</div>';

        /* top spending */
        const mk = lastMonthKeys(1)[0];
        const topE = sortedEntries(totalsBy(inMonth(data.expenses, mk), 'cat')).map(function(e) {
            const c = expenseCat(e[0]);
            return { label: e[0], value: e[1], color: c.color, icon: c.icon };
        });
        document.getElementById('d-top').innerHTML = hbarsHtml(topE, { max: 5 });

        /* 12-month cash-flow area */
        const k12 = lastMonthKeys(12);
        document.getElementById('d-flow12').innerHTML = areaSvg(
            k12.map(function(k) { return monthLabel(k).split(' ')[0]; }),
            [{ name: 'Income', color: '#1abc9c', values: k12.map(function(k) { return sum(inMonth(inc, k), 'amt'); }) },
                { name: 'Spent', color: '#e74c3c', values: k12.map(function(k) { return sum(inMonth(data.expenses, k), 'amt'); }) }],
            { height: 200 }
        );

        history.update();
    }

    render();
    subscribe(render);
});

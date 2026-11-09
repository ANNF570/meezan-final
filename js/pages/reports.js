/* ============================================================
   MEEZAN — ميزان  |  js/pages/reports.js
   Reports: pick a period, see income vs expenses, savings rate,
   category donuts, monthly trend, biggest expenses, giving.
   Friends' money (amanah) is never counted as your income.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe } from '../core/store.js';
import { ownIncome, totalsBy, sortedEntries, spendRatio, givingRecords } from '../core/calc.js';
import { incomeCat, expenseCat, givingKind } from '../core/constants.js';
import { fmt, fmtShort, esc, ymd, todayStr, parseYmd, addDays, sum, fmtDay, monthKeyOf, lastMonthKeys, monthLabel } from '../core/utils.js';
import { barsHtml, donutSvg, areaSvg, gaugeSvg, hbarsHtml } from '../core/charts.js';
import { kpiHtml } from '../core/widgets.js';
import { progressBar, emptyState } from '../core/ui.js';

boot({
    page: 'reports',
    navKey: 'reports',
    title: 'Reports',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'sadaqah']
}, function(ctx) {
    const page = document.getElementById('page');
    let period = 'month';
    let customFrom = '';
    let customTo = '';

    page.innerHTML =
        '<div class="card"><div class="chips" id="r-periods">' +
        [['month', 'This month'], ['last', 'Last month'], ['3m', '3 months'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']].map(function(p) {
            return '<button type="button" class="chip' + (p[0] === period ? ' on' : '') + '" data-period="' + p[0] + '">' + p[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="form-grid" id="r-custom" style="--fmin:140px;margin-top:10px" hidden>' +
        '<div class="field"><label for="r-from">From</label><input type="date" id="r-from"></div>' +
        '<div class="field"><label for="r-to">To</label><input type="date" id="r-to"></div></div>' +
        '<div class="hint" id="r-range"></div></div>' +
        '<div class="kpis" id="r-kpis"></div>' +
        '<div class="grid" style="--min:320px">' +
        '<div class="card"><div class="card-title">💰 Income by category</div><div id="r-inc"></div></div>' +
        '<div class="card"><div class="card-title">💸 Spending by category</div><div id="r-exp"></div></div></div>' +
        '<div class="card"><div class="card-title">📈 Last 6 months</div><div id="r-trend"></div></div>' +
        '<div class="grid" style="--min:300px">' +
        '<div class="card"><div class="card-title">🌱 Savings rate</div><div id="r-gauge"></div></div>' +
        '<div class="card"><div class="card-title">📅 Spending by weekday</div><div id="r-week"></div></div>' +
        '<div class="card"><div class="card-title">🏆 Top categories</div><div id="r-cats"></div></div></div>' +
        '<div class="card"><div class="card-title">💹 Net saved over time (last 12 months)</div><div id="r-cum"></div></div>' +
        '<div class="grid" style="--min:320px">' +
        '<div class="card"><div class="card-title">🔝 Biggest expenses</div><div id="r-top"></div></div>' +
        '<div class="card"><div class="card-title">🤲 Giving in this period</div><div id="r-give"></div></div></div>';

    page.addEventListener('click', function(e) {
        const b = e.target.closest('[data-period]');
        if (!b) { return; }
        period = b.getAttribute('data-period');
        page.querySelectorAll('[data-period]').forEach(function(c) { c.classList.toggle('on', c === b); });
        document.getElementById('r-custom').hidden = period !== 'custom';
        render();
    });
    page.addEventListener('change', function(e) {
        if (e.target.id === 'r-from') { customFrom = e.target.value; render(); }
        if (e.target.id === 'r-to') { customTo = e.target.value; render(); }
    });

    function range() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const pad = function(n) { return String(n).padStart(2, '0'); };
        if (period === 'month') { return [y + '-' + pad(m + 1) + '-01', todayStr(), 'This month']; }
        if (period === 'last') {
            const first = new Date(y, m - 1, 1);
            const last = new Date(y, m, 0);
            return [ymd(first), ymd(last), 'Last month'];
        }
        if (period === '3m') { return [ymd(new Date(y, m - 2, 1)), todayStr(), 'Last 3 months']; }
        if (period === 'year') { return [y + '-01-01', todayStr(), 'This year']; }
        if (period === 'custom') { return [customFrom || '0000-01-01', customTo || '9999-12-31', 'Custom range']; }
        return ['0000-01-01', '9999-12-31', 'All time'];
    }

    function within(list, r) {
        return list.filter(function(x) { return (x.date || '') >= r[0] && (x.date || '') <= r[1]; });
    }

    function pie(entries, infoFn, label) {
        const total = entries.reduce(function(s, e) { return s + e[1]; }, 0);
        if (!total) { return emptyState('📭', 'Nothing in this period.'); }
        return donutSvg(entries.map(function(e) { return { label: e[0], value: e[1], color: infoFn(e[0]).color }; }),
            { size: 150, maxLegend: 8, center: { value: fmtShort(total), label: label } });
    }

    function render() {
        const r = range();
        document.getElementById('r-range').textContent = r[2] + (period === 'all' ? '' : ' · ' + (r[0] === '0000-01-01' ? 'start' : fmtDay(r[0])) + ' → ' + (r[1] === '9999-12-31' ? 'today' : fmtDay(r[1])));

        const inc = within(ownIncome(store.data), r);
        const exp = within(store.data.expenses, r);
        const trustIn = within(store.data.income, r).length - inc.length;
        const incT = sum(inc, 'amt');
        const expT = sum(exp, 'amt');
        const net = incT - expT;
        const ratio = spendRatio(incT, expT);

        document.getElementById('r-kpis').innerHTML =
            kpiHtml({ label: 'Income', icon: '💰', value: incT, accent: 'var(--teal-lt)', sub: inc.length + ' records' + (trustIn ? ' · friends\' money excluded' : '') }) +
            kpiHtml({ label: 'Expenses', icon: '💸', value: expT, accent: 'var(--fire-lt)', sub: exp.length + ' records' }) +
            kpiHtml({ label: net >= 0 ? 'Saved' : 'Overspent', icon: net >= 0 ? '🏦' : '⚠️', value: Math.abs(net), accent: net >= 0 ? 'var(--gold-lt)' : 'var(--amber)', sub: incT ? Math.round((net / incT) * 100) + '% of income' : '—' }) +
            kpiHtml({ label: 'Spent of income', icon: '📊', value: expT, accent: 'var(--sky-lt)', sub: Math.round(ratio) + '%' });

        document.getElementById('r-inc').innerHTML = pie(sortedEntries(totalsBy(inc, 'type')), incomeCat, 'income');
        document.getElementById('r-exp').innerHTML = pie(sortedEntries(totalsBy(exp, 'cat')), expenseCat, 'spent');

        const keys = lastMonthKeys(6);
        const own = ownIncome(store.data);
        document.getElementById('r-trend').innerHTML = barsHtml(
            keys.map(function(m) { return monthLabel(m).split(' ')[0]; }),
            [
                { name: 'Income', color: '#1abc9c', values: keys.map(function(m) { return sum(own.filter(function(x) { return (x.date || '').slice(0, 7) === m; }), 'amt'); }) },
                { name: 'Expenses', color: '#e74c3c', values: keys.map(function(m) { return sum(store.data.expenses.filter(function(x) { return (x.date || '').slice(0, 7) === m; }), 'amt'); }) }
            ], { height: 140 });

        document.getElementById('r-gauge').innerHTML = gaugeSvg(incT > 0 ? (net / incT) * 100 : 0, 'of income saved') +
            '<div class="hint center" style="margin-top:6px">' + (incT > 0 ? fmt(net) + ' of ' + fmt(incT) : 'No income in this period') + '</div>';

        const wd = [0, 0, 0, 0, 0, 0, 0];
        exp.forEach(function(x) { const d = parseYmd(x.date); if (d) { wd[d.getDay()] += Number(x.amt) || 0; } });
        document.getElementById('r-week').innerHTML = barsHtml(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], [{ name: 'Spent', color: '#e74c3c', values: wd }], { height: 110 });

        document.getElementById('r-cats').innerHTML = hbarsHtml(sortedEntries(totalsBy(exp, 'cat')).map(function(e) {
            const c = expenseCat(e[0]);
            return { label: e[0], value: e[1], color: c.color, icon: c.icon };
        }), { max: 6 });

        const k12 = lastMonthKeys(12);
        let run = 0;
        const cum = k12.map(function(m) {
            const i = sum(own.filter(function(x) { return (x.date || '').slice(0, 7) === m; }), 'amt');
            const e = sum(store.data.expenses.filter(function(x) { return (x.date || '').slice(0, 7) === m; }), 'amt');
            run += i - e;
            return run;
        });
        document.getElementById('r-cum').innerHTML = areaSvg(k12.map(function(m) { return monthLabel(m).split(' ')[0]; }), [{ name: 'Net saved (running total)', color: '#f0c040', values: cum }], { height: 200, legend: true });

        const top = exp.slice().sort(function(a, b) { return (b.amt || 0) - (a.amt || 0); }).slice(0, 6);
        document.getElementById('r-top').innerHTML = top.length ? top.map(function(x) {
            return '<div class="row-between small"><span>' + expenseCat(x.cat).icon + ' ' + esc(x.name) + ' <span class="dim">' + fmtDay(x.date) + '</span></span><b class="down num">' + fmt(x.amt) + '</b></div>';
        }).join('') : emptyState('📭', 'No expenses in this period.');

        const give = within(givingRecords(store.data), r);
        const zk = sum(give.filter(function(g) { return g.kind === 'zakat'; }), 'amt');
        const sd = sum(give.filter(function(g) { return g.kind !== 'zakat'; }), 'amt');
        const target = incT * (store.prefs.charityRate / 100);
        const given = zk + sd;
        const pct = target > 0 ? Math.min(100, (given / target) * 100) : 0;
        document.getElementById('r-give').innerHTML =
            '<div class="row-between"><span class="muted">Zakat</span><b class="num gold">' + fmt(zk) + '</b></div>' +
            '<div class="row-between"><span class="muted">Sadaqah / charity</span><b class="num up">' + fmt(sd) + '</b></div>' +
            (incT > 0 ? progressBar(pct, pct >= 100 ? '' : pct >= 50 ? 'warn' : 'bad') +
                '<div class="hint">Goal ' + store.prefs.charityRate + '% of income = ' + fmt(target) + ' · ' + (given >= target ? '✓ met' : '⚠ ' + fmt(target - given) + ' short') + '</div>' : '<div class="hint">No income in this period.</div>');
    }

    render();
    subscribe(render);
});

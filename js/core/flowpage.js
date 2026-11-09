/* ============================================================
   MEEZAN — ميزان  |  js/core/flowpage.js
   One implementation for the Income page and the Expenses page.
   makeFlowPage('income' | 'expense')
   ============================================================ */

import { boot } from './shell.js';
import { store, subscribe } from './store.js';
import { INCOME_CATS, EXPENSE_CATS, incomeCat, expenseCat, isTrustIncome } from './constants.js';
import { inMonth, ownIncome, trustHeld, totalsBy, sortedEntries } from './calc.js';
import { fmt, fmtShort, sum, thisMonthKey, lastMonthKeys, monthLabel, esc } from './utils.js';
import { createHistory } from './ui.js';
import { donutSvg, barsHtml } from './charts.js';
import { buildLedger, ledgerRowHtml } from './ledger.js';
import { openIncomeForm, openExpenseForm } from './forms.js';
import { kpiHtml, bindRecordActions, setupBannersHtml, bindSetupBanners } from './widgets.js';

export function makeFlowPage(kind) {
    const isIncome = kind === 'income';
    const coll = isIncome ? 'income' : 'expenses';
    const catField = isIncome ? 'type' : 'cat';
    const catInfo = isIncome ? incomeCat : expenseCat;
    const catList = isIncome ? INCOME_CATS : EXPENSE_CATS;

    boot({
        page: coll,
        navKey: coll,
        title: isIncome ? 'Income' : 'Expenses',
        needs: ['income', 'expenses', 'accounts', 'transfers']
    }, function(ctx) {
        const page = document.getElementById('page');
        let activeCat = 'All';
        let range = 'month'; /* month | all */
        let query = '';

        ctx.setActions(isIncome ?
            '<button type="button" class="btn btn-teal" data-add>+ Add income</button>' :
            '<button type="button" class="btn btn-fire" data-add>− Add expense</button>');
        document.getElementById('main').addEventListener('click', function(e) {
            if (e.target.closest('[data-add]')) { isIncome ? openIncomeForm() : openExpenseForm(); }
        });

        page.innerHTML =
            '<div id="f-banners"></div>' +
            '<div class="kpis" id="f-kpis"></div>' +
            '<div class="grid" style="--min:300px">' +
            '<div class="card"><div class="card-title"><span>' + (isIncome ? '🧩 Income by category' : '🧩 Spending by category') + '</span>' +
            '<span class="tabbar" style="padding:2px"><button type="button" class="tab on" data-range="month">This month</button><button type="button" class="tab" data-range="all">All time</button></span></div><div id="f-donut"></div></div>' +
            '<div class="card"><div class="card-title">📊 Last 6 months</div><div id="f-bars"></div></div>' +
            '</div>' +
            '<div class="card"><div class="card-title">🧾 ' + (isIncome ? 'Income' : 'Expense') + ' history</div>' +
            '<div class="field" style="margin-bottom:8px"><input type="search" id="f-search" placeholder="Search name or notes…" aria-label="Search"></div>' +
            '<div class="chips" id="f-chips"></div>' +
            '<div id="f-history"></div></div>';

        bindSetupBanners(page);
        bindRecordActions(page);

        page.addEventListener('click', function(e) {
            const chip = e.target.closest('[data-cat]');
            if (chip) { activeCat = chip.getAttribute('data-cat'); renderChips(); history.update(); return; }
            const r = e.target.closest('[data-range]');
            if (r) {
                range = r.getAttribute('data-range');
                page.querySelectorAll('[data-range]').forEach(function(t) { t.classList.toggle('on', t === r); });
                renderDonut();
            }
        });
        document.getElementById('f-search').addEventListener('input', function(e) {
            query = e.target.value.trim().toLowerCase();
            history.update();
        });

        function records() { return store.data[coll] || []; }

        function filtered() {
            return buildLedger(store.data, [kind]).filter(function(it) {
                if (activeCat !== 'All' && it.cat !== activeCat) { return false; }
                if (query && (it.title + ' ' + it.notes).toLowerCase().indexOf(query) < 0) { return false; }
                return true;
            });
        }

        const history = createHistory(document.getElementById('f-history'), {
            getItems: filtered,
            renderRow: function(item) { return ledgerRowHtml(item, store.data.accounts); },
            weekSummary: function(items) {
                const t = sum(items.filter(function(r) { return !(isIncome && isTrustIncome(r.cat)); }), 'amt');
                return '<div class="wk-pill"><small>Total</small><b class="' + (isIncome ? 'up' : 'down') + '">' + fmt(t) + '</b></div>' +
                    '<div class="wk-pill"><small>Records</small><b>' + items.length + '</b></div>';
            },
            amountOf: function(r) { return r.amt; },
            barTone: isIncome ? '' : 'out',
            weekStart: function() { return store.prefs.weekStart; },
            emptyIcon: isIncome ? '💰' : '💸',
            emptyText: isIncome ? 'No income found.' : 'No expenses found.'
        });

        function renderChips() {
            const present = {};
            records().forEach(function(r) { present[r[catField] || 'Other'] = true; });
            const labels = catList.filter(function(c) { return present[c.label]; }).map(function(c) { return c.label; });
            Object.keys(present).forEach(function(l) { if (labels.indexOf(l) < 0) { labels.push(l); } });
            document.getElementById('f-chips').innerHTML =
                '<button type="button" class="chip' + (activeCat === 'All' ? ' on' : '') + '" data-cat="All">All</button>' +
                labels.map(function(l) {
                    return '<button type="button" class="chip' + (activeCat === l ? ' on' : '') + '" data-cat="' + esc(l) + '">' + catInfo(l).icon + ' ' + esc(l) + '</button>';
                }).join('');
        }

        function scopeRecords(all) {
            const base = isIncome ? ownIncome(store.data) : records();
            return all ? base : inMonth(base, thisMonthKey());
        }

        function renderDonut() {
            const totals = sortedEntries(totalsBy(scopeRecords(range === 'all'), catField));
            const total = totals.reduce(function(s, e) { return s + e[1]; }, 0);
            document.getElementById('f-donut').innerHTML = donutSvg(
                totals.map(function(e) { return { label: e[0], value: e[1], color: catInfo(e[0]).color }; }),
                { size: 150, center: { value: fmtShort(total), label: range === 'all' ? 'all time' : 'this month' } }
            );
        }

        function render() {
            document.getElementById('f-banners').innerHTML = setupBannersHtml();
            const base = isIncome ? ownIncome(store.data) : records();
            const month = inMonth(base, thisMonthKey());
            const total = sum(base, 'amt');
            const monthTotal = sum(month, 'amt');
            const avg = month.length ? monthTotal / month.length : 0;
            let k = kpiHtml({ label: 'This month', icon: isIncome ? '💰' : '💸', value: monthTotal, accent: isIncome ? 'var(--teal-lt)' : 'var(--fire-lt)', sub: month.length + ' records' }) +
                kpiHtml({ label: 'All time', icon: '🧮', value: total, accent: 'var(--gold-lt)', sub: base.length + ' records' }) +
                kpiHtml({ label: 'Average entry', icon: '📐', value: avg, accent: 'var(--sky-lt)', sub: 'This month' });
            if (isIncome) {
                k += kpiHtml({ label: 'Friends\' money', icon: '🤝', value: trustHeld(store.data), accent: '#48d1b0', sub: 'Held for others · not income' });
            } else {
                const fixed = month.filter(function(r) { return ['Rent', 'EMI / Loan', 'Bills', 'Mobile & Internet', 'Insurance', 'Subscriptions'].indexOf(r.cat) >= 0; });
                k += kpiHtml({ label: 'Rent · EMI · Bills', icon: '🏠', value: sum(fixed, 'amt'), accent: 'var(--amber)', sub: 'Fixed costs this month' });
            }
            document.getElementById('f-kpis').innerHTML = k;

            const keys = lastMonthKeys(6);
            document.getElementById('f-bars').innerHTML = barsHtml(
                keys.map(function(m) { return monthLabel(m).split(' ')[0]; }),
                [{ name: isIncome ? 'Income' : 'Spent', color: isIncome ? '#1abc9c' : '#e74c3c', values: keys.map(function(m) { return sum(inMonth(base, m), 'amt'); }) }],
                { height: 120 }
            );
            renderChips();
            renderDonut();
            history.update();
        }

        render();
        subscribe(render);
    });
}

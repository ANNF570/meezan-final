/* ============================================================
   MEEZAN — ميزان  |  js/pages/assets.js
   Accounts (cash · bank · cash savings · online savings — as many
   as you like) + Gold & Silver holdings + metal prices.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe, savePrefs } from '../core/store.js';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER } from '../core/constants.js';
import { typeTotals, accountsTotal, assetsValue, netWorth, ornamentValue, ornamentMetalValue, metalGrams, accountBalances } from '../core/calc.js';
import { fmt, fmtG, esc, todayStr, num, fmtDayYear } from '../core/utils.js';
import { toast } from '../core/ui.js';
import { kpiHtml, bindRecordActions, setupBannersHtml, bindSetupBanners } from '../core/widgets.js';
import { openAccountForm, openTransferForm, openOrnamentForm } from '../core/forms.js';

boot({
    page: 'assets',
    navKey: 'assets',
    title: 'Accounts & Assets',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'ornaments']
}, function(ctx) {
    const page = document.getElementById('page');
    ctx.setActions(
        '<button type="button" class="btn btn-teal btn-sm" data-do="account">+ Account</button>' +
        '<button type="button" class="btn btn-gold btn-sm" data-do="transfer">⇄ Move money</button>'
    );

    page.innerHTML =
        '<div id="a-banners"></div>' +
        '<div class="kpis" id="a-kpis"></div>' +
        '<div id="a-groups" class="stack"></div>' +
        '<div class="card"><div class="card-title">🥇 Gold &amp; silver prices <span class="small dim" id="a-pdate"></span></div>' +
        '<div class="form-grid" style="--fmin:160px">' +
        '<div class="field"><label for="p-gold">Gold 24K (₹ / gram)</label><input type="number" id="p-gold" inputmode="decimal" step="any" min="0"></div>' +
        '<div class="field"><label for="p-silver">Silver (₹ / gram)</label><input type="number" id="p-silver" inputmode="decimal" step="any" min="0"></div>' +
        '</div>' +
        '<div class="form-actions"><button type="button" class="btn btn-gold btn-sm" data-do="prices">Save prices</button></div>' +
        '<p class="hint">Enter today\'s price from your jeweller. Zakat and net worth use these numbers.</p></div>' +
        '<div class="card"><div class="card-title">💍 Gold &amp; silver holdings <button type="button" class="btn btn-gold btn-sm" data-do="ornament">+ Add</button></div><div id="a-orn"></div></div>';

    bindSetupBanners(page);
    bindRecordActions(page);

    page.addEventListener('click', function(e) {
        const d = e.target.closest('[data-do]');
        if (d) {
            const k = d.getAttribute('data-do');
            if (k === 'account') { openAccountForm(); }
            if (k === 'transfer') { openTransferForm(); }
            if (k === 'ornament') { openOrnamentForm(); }
            if (k === 'prices') { savePriceInputs(); }
            return;
        }
        const add = e.target.closest('[data-addtype]');
        if (add) { openAccountForm({ type: add.getAttribute('data-addtype') }); return; }
        const ea = e.target.closest('[data-editacc]');
        if (ea) {
            const acc = store.data.accounts.filter(function(a) { return a.id === ea.getAttribute('data-editacc'); })[0];
            if (acc) { openAccountForm({ account: acc }); }
        }
    });
    document.getElementById('main').addEventListener('click', function(e) {
        const d = e.target.closest('[data-do]');
        if (!d || page.contains(d)) { return; }
        if (d.getAttribute('data-do') === 'account') { openAccountForm(); }
        if (d.getAttribute('data-do') === 'transfer') { openTransferForm(); }
    });

    async function savePriceInputs() {
        const g = parseFloat(document.getElementById('p-gold').value);
        const s = parseFloat(document.getElementById('p-silver').value);
        if (isNaN(g) || g <= 0 || isNaN(s) || s <= 0) { toast('Enter both prices (greater than 0).', 'warn'); return; }
        try {
            await savePrefs({ goldPrice: g, silverPrice: s, pricesUpdated: todayStr() });
            toast('Prices saved ✓', 'ok');
        } catch (err) { toast('Could not save: ' + (err.code || err.message), 'err', 4500); }
    }

    let priceFilled = false;

    function render() {
        const data = store.data;
        const prefs = store.prefs;
        document.getElementById('a-banners').innerHTML = setupBannersHtml();
        const types = typeTotals(data);
        const grams = metalGrams(data);

        document.getElementById('a-kpis').innerHTML =
            kpiHtml({ label: 'Net worth', icon: '💎', value: netWorth(data, prefs), big: true, wide: true, sub: 'Accounts ' + fmt(accountsTotal(data)) + ' + assets ' + fmt(assetsValue(data, prefs)) }) +
            ACCOUNT_TYPE_ORDER.map(function(t) {
                return kpiHtml({ label: ACCOUNT_TYPES[t].label, icon: ACCOUNT_TYPES[t].icon, value: types[t].total, accent: ACCOUNT_TYPES[t].color, sub: types[t].accounts.length + (types[t].accounts.length === 1 ? ' account' : ' accounts') });
            }).join('') +
            kpiHtml({ label: 'Assets', icon: '🏅', value: assetsValue(data, prefs), accent: 'var(--gold-lt)', sub: fmtG(grams.gold) + ' gold · ' + fmtG(grams.silver) + ' silver' });

        /* accounts grouped by type */
        const balances = accountBalances(data);
        document.getElementById('a-groups').innerHTML = ACCOUNT_TYPE_ORDER.map(function(t) {
            const list = data.accounts.filter(function(a) { return !a.archived && (ACCOUNT_TYPES[a.type] ? a.type : 'cash') === t; })
                .sort(function(a, b) { return num(a.order) - num(b.order); });
            return '<div class="card"><div class="card-title"><span>' + ACCOUNT_TYPES[t].icon + ' ' + esc(ACCOUNT_TYPES[t].long) + '</span>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-addtype="' + t + '">+ Add</button></div>' +
                (list.length ? list.map(function(a) {
                    return '<div class="rec" style="grid-template-columns:40px minmax(0,1fr) auto">' +
                        '<div class="rec-ico" style="background:' + ACCOUNT_TYPES[t].color + '22;border-color:' + ACCOUNT_TYPES[t].color + '55">' + ACCOUNT_TYPES[t].icon + '</div>' +
                        '<div class="rec-main"><div class="rec-title">' + esc(a.name) + '</div></div>' +
                        '<div class="rec-side"><div class="rec-amt num">' + fmt(balances[a.id] || 0) + '</div>' +
                        '<div class="rec-actions"><button type="button" class="icon-btn" data-editacc="' + esc(a.id) + '" aria-label="Edit account" title="Edit">✏️</button></div></div></div>';
                }).join('') : '<div class="empty small"><div>No ' + esc(ACCOUNT_TYPES[t].long.toLowerCase()) + ' account yet — tap “+ Add”.</div></div>') +
                '</div>';
        }).join('');

        /* prices */
        if (!priceFilled) {
            document.getElementById('p-gold').value = prefs.goldPrice;
            document.getElementById('p-silver').value = prefs.silverPrice;
            priceFilled = true;
        }
        document.getElementById('a-pdate').textContent = prefs.pricesUpdated ? 'updated ' + fmtDayYear(prefs.pricesUpdated) : 'default values — update them';

        /* ornaments */
        const orn = data.ornaments.slice().sort(function(a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
        document.getElementById('a-orn').innerHTML = orn.length ? orn.map(function(o) {
            const parts = [];
            if (num(o.goldG)) { parts.push(fmtG(o.goldG) + ' ' + (o.goldK || 22) + 'K'); }
            if (num(o.silvG)) { parts.push(fmtG(o.silvG) + ' silver'); }
            return '<div class="rec"><div class="rec-ico" style="background:#d4a01722;border-color:#d4a01755">' + (num(o.goldG) ? '🥇' : '🥈') + '</div>' +
                '<div class="rec-main"><div class="rec-title">' + esc(o.name) + '</div><div class="rec-meta"><span>' + esc(o.type || '') + '</span><span>' + parts.join(' · ') + '</span><span>Zakat value ' + fmt(ornamentMetalValue(o, prefs)) + '</span></div></div>' +
                '<div class="rec-side"><div class="rec-amt num gold">' + fmt(ornamentValue(o, prefs)) + '</div>' +
                '<div class="rec-actions"><button type="button" class="icon-btn" data-action="edit" data-kind="ornament" data-id="' + esc(o.id) + '" aria-label="Edit">✏️</button>' +
                '<button type="button" class="icon-btn" data-action="delete" data-kind="ornament" data-id="' + esc(o.id) + '" aria-label="Delete">🗑️</button></div></div></div>';
        }).join('') : '<div class="empty"><div class="empty-ico">💍</div><div>No gold or silver added yet.</div></div>';
    }

    render();
    subscribe(render);
});

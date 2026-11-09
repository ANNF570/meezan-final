/* ============================================================
   MEEZAN — ميزان  |  js/core/widgets.js
   Reusable page pieces: KPI cards, charity warning card,
   record edit/delete routing, balance-setup banners.
   ============================================================ */

import { esc, fmt, fmtShort } from './utils.js';
import { store, linkOldRecords } from './store.js';
import { progressBar, toast, confirmBox } from './ui.js';
import { openIncomeForm, openExpenseForm, openOrnamentForm, deleteWithConfirm, openSetupBalances } from './forms.js';
import { unlinkedCount } from './calc.js';

/* ── KPI CARD ─────────────────────────────────────────────────
   o: { label, icon, value(number), sub, accent, big, href, wide, accounts:[{name,balance}], neg } */
export function kpiHtml(o) {
    const tag = o.href ? 'a' : 'div';
    const attrs = (o.href ? ' href="' + esc(o.href) + '"' : '') + (o.accent ? ' style="--accent:' + o.accent + '"' : '');
    let accs = '';
    if (o.accounts && o.accounts.length > 1) {
        accs = '<div class="kpi-accounts">' + o.accounts.map(function(a) {
            return '<div class="kpi-acc-row"><span>' + esc(a.name) + '</span><span class="num">' + fmtShort(a.balance) + '</span></div>';
        }).join('') + '</div>';
    }
    return '<' + tag + ' class="kpi' + (o.big ? ' big' : '') + (o.wide ? ' kpi-wide' : '') + '"' + attrs + '>' +
        '<div class="kpi-top"><span class="kpi-ico">' + (o.icon || '') + '</span><span class="kpi-label">' + esc(o.label) + '</span></div>' +
        '<div class="kpi-value" title="' + esc(fmt(o.value)) + '"><span class="v-full">' + fmt(o.value) + '</span><span class="v-short">' + fmtShort(o.value) + '</span></div>' +
        '<div class="kpi-sub">' + (o.sub || '') + '</div>' + accs + '</' + tag + '>';
}

/* ── CHARITY GOAL CARD ────────────────────────────────────────
   Shows give-vs-goal for THIS MONTH and for TOTAL income, each with
   its own warning when below the goal (default 2.5%).             */
function goalBlock(title, income, target, given, short, met, pctDone) {
    if (!income) {
        return '<div class="goal"><div class="row-between"><b>' + title + '</b><span class="badge badge-muted">No income yet</span></div>' +
            '<p class="hint">Add income and your ' + 'charity goal appears here.</p></div>';
    }
    const tone = met ? '' : (pctDone >= 50 ? 'warn' : 'bad');
    return '<div class="goal"><div class="row-between"><b>' + title + '</b>' +
        (met ? '<span class="badge badge-ok">✓ Goal met</span>' : '<span class="badge ' + (pctDone >= 50 ? 'badge-warn' : 'badge-bad') + '">⚠ Not met</span>') + '</div>' +
        progressBar(pctDone, tone) +
        '<div class="row-between small"><span class="muted">Given <b class="num">' + fmt(given) + '</b> of <b class="num">' + fmt(target) + '</b></span>' +
        '<span class="dim">of ' + fmt(income) + ' income</span></div>' +
        (met ? '' : '<div class="banner banner-warn goal-warn">⚠️ ' + title.toLowerCase() + ': you are <b>' + fmt(short) + '</b> short of your charity goal. Give sadaqah to complete it.</div>') +
        '</div>';
}

export function charityCardHtml(stats, opts) {
    const o = opts || {};
    return '<div class="stack">' +
        '<div class="row-between"><span class="muted small">Goal: give <b class="gold">' + stats.rate + '%</b> of your income</span>' +
        (o.settingsLink ? '<a class="link-btn" href="settings.html#giving">Change</a>' : '') + '</div>' +
        goalBlock('This month', stats.incomeMonth, stats.targetMonth, stats.givenMonth, stats.shortMonth, stats.metMonth, stats.pctMonth) +
        goalBlock('Total income', stats.incomeTotal, stats.targetTotal, stats.givenTotal, stats.shortTotal, stats.metTotal, stats.pctTotal) +
        '</div>';
}

/* ── RECORD ACTIONS (edit / delete buttons inside any list) ─── */
const KIND_TO_COLLECTION = { income: 'income', expense: 'expenses', transfer: 'transfers', ornament: 'ornaments', sadaqah: 'sadaqah' };

export function bindRecordActions(root) {
    root.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || !root.contains(btn)) { return; }
        const action = btn.getAttribute('data-action');
        if (action !== 'edit' && action !== 'delete') { return; }
        const kind = btn.getAttribute('data-kind') || 'income';
        const id = btn.getAttribute('data-id');
        const coll = KIND_TO_COLLECTION[kind];
        if (!coll) { return; }
        const rec = (store.data[coll] || []).filter(function(r) { return r.id === id; })[0];
        if (!rec) { return; }
        if (action === 'delete') {
            deleteWithConfirm(coll, id, 'this ' + (kind === 'expense' ? 'expense' : kind));
            return;
        }
        if (kind === 'income') { openIncomeForm({ record: rec }); }
        if (kind === 'expense') { openExpenseForm({ record: rec }); }
        if (kind === 'ornament') { openOrnamentForm({ record: rec }); }
    });
}

/* ── SETUP / MIGRATION BANNERS ──────────────────────────────── */
export function setupBannersHtml() {
    let html = '';
    const accs = store.data.accounts.filter(function(a) { return !a.archived; });
    if (!accs.length) {
        html += '<div class="banner banner-info" id="setup-banner">👋 <strong>Welcome to Meezan v2.</strong> Tell us what you have today — cash, bank, cash savings and online savings — so your net worth is correct.' +
            '<div><button type="button" class="btn btn-teal btn-sm" data-setup="balances">Enter my balances</button></div></div>';
    } else if (unlinkedCount(store.data) > 0) {
        html += '<div class="banner banner-info" id="link-banner">🔗 <strong>' + unlinkedCount(store.data) + ' older records</strong> are not linked to an account, so they do not appear in any account. ' +
            'Linking keeps today\'s balances exactly the same — it only attaches the history to one account.' +
            '<div><button type="button" class="btn btn-ghost btn-sm" data-setup="link">Link old records…</button></div></div>';
    }
    return html;
}

export function bindSetupBanners(root) {
    root.addEventListener('click', async function(e) {
        const b = e.target.closest('[data-setup]');
        if (!b) { return; }
        if (b.getAttribute('data-setup') === 'balances') { openSetupBalances(); return; }
        if (b.getAttribute('data-setup') === 'link') {
            const accs = store.data.accounts.filter(function(a) { return !a.archived; });
            if (!accs.length) { return; }
            const target = accs[0];
            const ok = await confirmBox('Link all ' + unlinkedCount(store.data) + ' older records to "' + target.name + '"? Your balances will not change.', { okText: 'Link them', danger: false });
            if (!ok) { return; }
            try {
                const n = await linkOldRecords(target.id);
                toast(n + ' records linked ✓', 'ok');
            } catch (err) {
                toast('Could not link: ' + (err.code || err.message), 'err', 4500);
            }
        }
    });
}

/* ============================================================
   MEEZAN — ميزان  |  js/pages/zakat.js
   Zakat AND Sadaqah on ONE page:
   Nisab met / not met · Zakat due & paid · Hawl · charity goal
   (monthly + total warnings) · full giving history.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe, savePrefs } from '../core/store.js';
import { zakatStats, charityStats, nisabValue, zakatPaidByHijriYear } from '../core/calc.js';
import { fmt, fmtDayYear, fmtDay, weekdayShort, esc, todayStr, sum, parseYmd, hijriOf } from '../core/utils.js';
import { createHistory, recordRow, progressBar, toast } from '../core/ui.js';
import { kpiHtml, charityCardHtml, bindRecordActions } from '../core/widgets.js';
import { openExpenseForm } from '../core/forms.js';

boot({
    page: 'zakat',
    navKey: 'zakat',
    title: 'Zakat & Sadaqah',
    needs: ['income', 'expenses', 'accounts', 'transfers', 'ornaments', 'sadaqah']
}, function(ctx) {
    const page = document.getElementById('page');
    ctx.setActions(
        '<button type="button" class="btn btn-gold btn-sm" data-give="zakat">⚖️ Pay Zakat</button>' +
        '<button type="button" class="btn btn-teal btn-sm" data-give="sadaqah">🤲 Give Sadaqah</button>'
    );

    page.innerHTML =
        '<div class="kpis" id="z-kpis"></div>' +
        '<div class="grid" style="--min:320px">' +
        '<div class="card"><div class="card-title">🕌 Zakat status</div><div id="z-status"></div></div>' +
        '<div class="card"><div class="card-title">🤲 Sadaqah goal</div><div id="z-charity"></div></div>' +
        '</div>' +
        '<div class="grid" style="--min:320px">' +
        '<div class="card"><div class="card-title">🧮 How your Zakat is worked out</div><div id="z-break"></div></div>' +
        '<div class="card"><div class="card-title">⚙️ Zakat details</div>' +
        '<div class="form-grid" style="--fmin:160px">' +
        '<div class="field"><label for="z-hawl">Wealth reached Nisab on</label><input type="date" id="z-hawl"></div>' +
        '<div class="field"><label for="z-debts">Debts due soon (₹)</label><input type="number" id="z-debts" inputmode="decimal" min="0" step="any" placeholder="0"></div>' +
        '</div><div class="form-actions"><button type="button" class="btn btn-gold btn-sm" data-save-zakat>Save</button></div>' +
        '<p class="hint">Zakat becomes due after one lunar year (about 354 days) above Nisab. Debts you must pay soon are deducted. Rate and Nisab basis are in Settings.</p></div>' +
        '</div>' +
        '<div class="card"><div class="card-title">🧾 Zakat &amp; Sadaqah history</div><div id="z-history"></div></div>';

    bindRecordActions(page);

    document.getElementById('main').addEventListener('click', function(e) {
        const g = e.target.closest('[data-give]');
        if (g) { give(g.getAttribute('data-give')); return; }
        if (e.target.closest('[data-save-zakat]')) { saveDetails(); }
    });

    function give(kind) {
        const z = zakatStats(store.data, store.prefs);
        if (kind === 'zakat') {
            openExpenseForm({ preset: { cat: 'Zakat', title: 'Pay Zakat', name: 'Zakat', amt: z.remaining > 0 ? Math.round(z.remaining) : '' } });
        } else {
            const c = charityStats(store.data, store.prefs);
            openExpenseForm({ preset: { cat: 'Charity', title: 'Give Sadaqah', name: 'Sadaqah', amt: c.shortMonth > 0 ? Math.ceil(c.shortMonth) : '' } });
        }
    }

    async function saveDetails() {
        const hawl = document.getElementById('z-hawl').value;
        const debts = parseFloat(document.getElementById('z-debts').value);
        try {
            await savePrefs({ hawlStart: hawl || '', zakatDebts: isNaN(debts) ? 0 : debts });
            toast('Saved ✓', 'ok');
        } catch (err) { toast('Could not save: ' + (err.code || err.message), 'err', 4500); }
    }

    const history = createHistory(document.getElementById('z-history'), {
        getItems: function() {
            return charityStats(store.data, store.prefs).records.slice().sort(function(a, b) {
                return (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : 0;
            });
        },
        renderRow: function(g) {
            const zk = g.kind === 'zakat';
            const h = hijriOf(parseYmd(g.date) || new Date(), store.prefs.hijriAdjust);
            const color = zk ? '#d4a017' : '#1abc9c';
            let html = recordRow({
                id: g.id, icon: zk ? '⚖️' : '🤲', color: color, title: g.name || (zk ? 'Zakat' : 'Sadaqah'),
                meta: '<span>' + weekdayShort(g.date) + ' ' + fmtDay(g.date) + '</span><span class="tag">' + (zk ? 'Zakat' : 'Sadaqah') + '</span>' +
                    (h ? '<span>' + h.year + ' AH</span>' : '') + (g.source === 'legacy' ? '<span class="tag">old record</span>' : ''),
                amount: fmt(g.amt), tone: 'in'
            });
            const kind = g.source === 'legacy' ? 'sadaqah' : 'expense';
            html = html.replace(/data-action="(edit|delete)"/g, 'data-action="$1" data-kind="' + kind + '"');
            if (g.source === 'legacy') { html = html.replace(/<button[^>]*data-action="edit"[^>]*>.*?<\/button>/, ''); }
            return html;
        },
        weekSummary: function(items) {
            return '<div class="wk-pill"><small>Zakat</small><b class="gold">' + fmt(sum(items.filter(function(i) { return i.kind === 'zakat'; }), 'amt')) + '</b></div>' +
                '<div class="wk-pill"><small>Sadaqah</small><b class="up">' + fmt(sum(items.filter(function(i) { return i.kind === 'sadaqah'; }), 'amt')) + '</b></div>';
        },
        amountOf: function(r) { return r.amt; },
        barTone: 'gold',
        weekStart: function() { return store.prefs.weekStart; },
        emptyIcon: '🤲',
        emptyText: 'No giving recorded yet. Tap “Give Sadaqah” or “Pay Zakat”.'
    });

    let filled = false;

    function render() {
        const data = store.data;
        const prefs = store.prefs;
        const z = zakatStats(data, prefs);
        const c = charityStats(data, prefs);

        document.getElementById('z-kpis').innerHTML =
            kpiHtml({ label: 'Zakat due', icon: '⚖️', value: z.due, accent: 'var(--gold-lt)', big: true, sub: z.nisabMet ? z.rate + '% of ' + fmt(z.wealth) : 'Nisab not met' }) +
            kpiHtml({ label: 'Paid (' + (z.hijriYear || '—') + ' AH)', icon: '✅', value: z.paidThisYear, accent: 'var(--teal-lt)', sub: 'Zakat this Hijri year' }) +
            kpiHtml({ label: 'Still to pay', icon: '⏳', value: z.remaining, accent: z.remaining > 0 ? 'var(--amber)' : 'var(--teal-lt)', sub: z.settled ? 'All settled 🎉' : z.nisabMet ? 'Remaining Zakat' : '—' }) +
            kpiHtml({ label: 'Sadaqah given', icon: '🤲', value: c.sadaqahTotal, accent: '#48d1b0', sub: 'All time' });

        /* status */
        const pctNisab = z.nisab > 0 ? Math.min(100, (z.wealth / z.nisab) * 100) : 0;
        let hawlHtml;
        if (!z.hawl.set) {
            hawlHtml = '<div class="banner banner-info">📅 Set the date your wealth first reached Nisab (right) to track the one-year Hawl.</div>';
        } else if (z.hawl.complete) {
            hawlHtml = '<div class="banner banner-ok">✓ Hawl complete since ' + fmtDayYear(z.hawl.start) + ' — Zakat is due.</div>';
        } else {
            hawlHtml = '<div class="muted small">Hawl: ' + z.hawl.daysPassed + ' of 354 days</div>' + progressBar((z.hawl.daysPassed / 354) * 100) +
                '<div class="hint">Zakat due after ' + z.hawl.daysLeft + ' more days (' + fmtDayYear(z.hawl.end) + ')</div>';
        }
        document.getElementById('z-status').innerHTML =
            '<div class="row-between"><b>Nisab</b>' + (z.nisabMet ? '<span class="badge badge-ok">✓ Nisab met</span>' : '<span class="badge badge-muted">Not met</span>') + '</div>' +
            progressBar(pctNisab, z.nisabMet ? '' : 'warn') +
            '<div class="row-between small"><span class="muted">Your zakatable wealth <b class="num">' + fmt(z.wealth) + '</b></span><span class="dim">Nisab ' + fmt(z.nisab) + ' (' + (prefs.nisabBasis === 'gold' ? '85 g gold' : '595 g silver') + ')</span></div>' +
            '<div style="margin-top:12px">' + hawlHtml + '</div>' +
            (z.nisabMet && z.remaining > 0 ? '<div class="banner banner-warn">⚠️ <b>' + fmt(z.remaining) + '</b> Zakat is still to be paid this year.</div>' : '') +
            (z.settled ? '<div class="banner banner-ok">✓ Zakat for ' + z.hijriYear + ' AH is paid in full. Alhamdulillah.</div>' : '');

        document.getElementById('z-charity').innerHTML = charityCardHtml(c, { settingsLink: true });

        document.getElementById('z-break').innerHTML =
            row('Cash, bank & savings (all 4 types)', z.cashLike) +
            row('Gold & silver (metal value only)', z.metals) +
            (z.receivable ? row('Money others owe you (loans given)', z.receivable) : '') +
            (z.trust ? row('− Friends\' money (amanah)', -z.trust) : '') +
            (z.debts ? row('− Debts due soon', -z.debts) : '') +
            '<div class="row-between" style="border-top:1px solid var(--bdr);margin-top:6px;padding-top:8px"><b>Zakatable wealth</b><b class="num gold">' + fmt(z.wealth) + '</b></div>' +
            '<div class="row-between"><span class="muted">× ' + z.rate + '%</span><b class="num">' + fmt(z.nisabMet ? z.wealth * z.rate / 100 : 0) + '</b></div>';

        if (!filled) {
            document.getElementById('z-hawl').value = prefs.hawlStart || '';
            document.getElementById('z-debts').value = prefs.zakatDebts || '';
            filled = true;
        }
        history.update();
    }

    function row(label, amount) {
        return '<div class="row-between" style="padding:4px 0"><span class="muted">' + esc(label) + '</span><span class="num ' + (amount < 0 ? 'down' : '') + '">' + fmt(amount) + '</span></div>';
    }

    render();
    subscribe(render);
});

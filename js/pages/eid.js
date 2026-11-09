/* ============================================================
   MEEZAN — ميزان  |  js/pages/eid.js
   Eid & Ramadan on ONE page (v1 split them in two because of a
   tab bug): countdowns · Eid ul-Fitr goal (+ Fitrah helper) ·
   Eid ul-Adha / Qurbani goal. Savings are earmarked amounts —
   they stay in your net worth, nothing leaves an account.
   ============================================================ */

import { boot } from '../core/shell.js';
import { store, subscribe, savePrefs, saveRecord } from '../core/store.js';
import { db, collection, getDocs } from '../core/firebase.js';
import { fmt, esc, todayStr, parseYmd, daysBetween, nextHijriDate, fmtDayYear, fmtDay, weekdayShort, sum, num } from '../core/utils.js';
import { createHistory, recordRow, progressBar, toast, openModal } from '../core/ui.js';
import { kpiHtml, bindRecordActions } from '../core/widgets.js';

const ANIMALS = {
    goat: { icon: '🐐', name: 'Goat', price: 25000 },
    sheep: { icon: '🐑', name: 'Sheep', price: 22000 },
    cow: { icon: '🐄', name: 'Cow (1/7 share)', price: 14000 },
    camel: { icon: '🐪', name: 'Camel (1/7 share)', price: 20000 }
};

const GOALS = {
    fitr: { title: 'Eid ul-Fitr', icon: '🌙', hMonth: 10, hDay: 1, note: 'New clothes, gifts, Eidi and Fitrah' },
    adha: { title: 'Eid ul-Adha (Qurbani)', icon: '🐑', hMonth: 12, hDay: 10, note: 'Save for your Qurbani animal' }
};

boot({
    page: 'eid',
    navKey: 'eid',
    title: 'Eid & Ramadan',
    needs: ['eidSavings']
}, function(ctx) {
    const page = document.getElementById('page');
    let legacy = [];

    page.innerHTML =
        '<div class="kpis" id="e-kpis"></div>' +
        '<div class="grid" style="--min:340px">' +
        goalShell('fitr') + goalShell('adha') +
        '</div>';

    function goalShell(key) {
        const g = GOALS[key];
        return '<div class="card" data-goal="' + key + '"><div class="card-title">' + g.icon + ' ' + g.title + '</div>' +
            '<div class="hint">' + g.note + '</div>' +
            '<div id="e-' + key + '-body"></div>' +
            '<div class="card-title" style="margin-top:16px">Savings history</div><div id="e-' + key + '-hist"></div></div>';
    }

    bindRecordActions(page);

    /* ── old Bakrid savings from version 1 (read-only, shown with the Adha goal) ── */
    getDocs(collection(db, 'users', ctx.user.uid, 'bakridSavings')).then(function(snap) {
        legacy = snap.docs.map(function(d) {
            const r = d.data();
            return { id: 'legacy-' + d.id, goal: 'adha', amount: num(r.amount), date: r.date || '', note: r.note || 'Qurbani savings', source: r.source || 'Savings', legacy: true };
        });
        render();
    }).catch(function() { /* collection may not exist or rules may not cover it: ignore */ });

    function plans() { return store.prefs.eidPlans || {}; }
    function savingsOf(key) {
        return store.data.eidSavings.filter(function(r) { return r.goal === key; }).concat(key === 'adha' ? legacy : []);
    }

    /* ── countdown tiles ─────────────────────────────────── */
    function countdown(m, d) {
        const t = nextHijriDate(m, d, store.prefs.hijriAdjust);
        if (!t) { return { days: null, text: '—' }; }
        const n = daysBetween(new Date(), t);
        return { days: n, text: fmtDayYear(t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')) };
    }

    function kpiRow() {
        const items = [
            ['Ramadan', '🌙', 9, 1], ['Eid ul-Fitr', '🎉', 10, 1], ['Day of Arafah', '⛰️', 12, 9], ['Eid ul-Adha', '🐑', 12, 10]
        ];
        return items.map(function(i) {
            const c = countdown(i[2], i[3]);
            return '<div class="kpi" style="--accent:var(--gold-lt)"><div class="kpi-top"><span class="kpi-ico">' + i[1] + '</span><span class="kpi-label">' + i[0] + '</span></div>' +
                '<div class="kpi-value"><span class="v-full">' + (c.days === null ? '—' : c.days === 0 ? 'Today!' : c.days + ' days') + '</span><span class="v-short">' + (c.days === null ? '—' : c.days === 0 ? 'Today!' : c.days + 'd') + '</span></div>' +
                '<div class="kpi-sub">' + esc(c.text) + '</div></div>';
        }).join('');
    }

    /* ── goal body ───────────────────────────────────────── */
    function goalBody(key) {
        const p = plans()[key] || {};
        const saved = sum(savingsOf(key), 'amount');
        const target = num(p.target);
        const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        const c = countdown(GOALS[key].hMonth, GOALS[key].hDay);
        const left = Math.max(0, target - saved);
        let plan = '';
        if (target > 0 && left > 0 && c.days !== null && c.days > 0) {
            plan = '<div class="banner banner-info">To reach it by Eid, save about <b>' + fmt(Math.ceil(left / c.days)) + '</b> a day · <b>' +
                fmt(Math.ceil(left / Math.max(1, c.days / 7))) + '</b> a week · <b>' + fmt(Math.ceil(left / Math.max(1, c.days / 30))) + '</b> a month.</div>';
        } else if (target > 0 && left === 0) {
            plan = '<div class="banner banner-ok">✓ Goal reached. Alhamdulillah!</div>';
        } else if (target > 0 && c.days !== null && c.days <= 0 && left > 0) {
            plan = '<div class="banner banner-warn">Eid has come with ' + fmt(left) + ' still to save. It carries forward to next year — update the target when ready.</div>';
        }

        let extra = '';
        if (key === 'adha') {
            extra = '<div class="field"><span class="field-label">Animal</span><div class="chips" id="e-animals">' +
                Object.keys(ANIMALS).map(function(a) {
                    return '<button type="button" class="chip' + (p.animal === a ? ' on' : '') + '" data-animal="' + a + '">' + ANIMALS[a].icon + ' ' + ANIMALS[a].name + '</button>';
                }).join('') + '</div></div>';
        } else {
            extra = '<div class="form-grid" style="--fmin:130px">' +
                '<div class="field"><label for="e-fp">People in family</label><input type="number" id="e-fp" min="0" inputmode="numeric" value="' + esc(p.people || '') + '"></div>' +
                '<div class="field"><label for="e-fr">Fitrah per person (₹)</label><input type="number" id="e-fr" min="0" inputmode="decimal" value="' + esc(p.fitrahRate || '') + '"></div></div>' +
                '<div class="row-between small"><span class="muted">Fitrah to give</span><b class="num gold">' + fmt(num(p.people) * num(p.fitrahRate)) + '</b></div>' +
                '<div class="hint">Check this year’s Fitrah amount with your local scholars or masjid.</div>';
        }

        return extra +
            '<div class="form-grid" style="--fmin:130px;margin-top:8px">' +
            '<div class="field"><label for="e-' + key + '-t">Target (₹)</label><input type="number" id="e-' + key + '-t" data-f="target" min="0" inputmode="decimal" value="' + esc(p.target || '') + '"></div>' +
            '<div class="field"><label for="e-' + key + '-s">Start saving from</label><input type="date" id="e-' + key + '-s" data-f="start" value="' + esc(p.start || '') + '"></div></div>' +
            '<div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-saveplan="' + key + '">Save plan</button>' +
            '<button type="button" class="btn btn-teal btn-sm" data-addsave="' + key + '">+ Add savings</button></div>' +
            '<div style="margin-top:10px"><div class="row-between"><b class="num">' + fmt(saved) + '</b><span class="muted small">of ' + fmt(target) + '</span></div>' +
            progressBar(pct, pct >= 100 ? '' : pct >= 50 ? 'warn' : 'bad') +
            '<div class="hint">' + Math.round(pct) + '% · ' + (c.days === null ? '' : c.days + ' days to ' + GOALS[key].title) + '</div></div>' + plan;
    }

    /* ── histories (10 per page + weekly slider) ─────────── */
    const hist = {};
    ['fitr', 'adha'].forEach(function(key) {
        hist[key] = createHistory(document.getElementById('e-' + key + '-hist'), {
            getItems: function() {
                return savingsOf(key).slice().sort(function(a, b) { return (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : 0; });
            },
            renderRow: function(r) {
                let html = recordRow({
                    id: r.id, icon: GOALS[key].icon, color: '#d4a017', title: r.note || 'Savings',
                    meta: '<span>' + weekdayShort(r.date) + ' ' + fmtDay(r.date) + '</span><span class="tag">' + esc(r.source || 'Savings') + '</span>' + (r.legacy ? '<span class="tag">old record</span>' : ''),
                    amount: fmt(r.amount), tone: 'in'
                });
                if (r.legacy) { html = html.replace(/<button[^>]*data-action[^>]*>.*?<\/button>/g, ''); }
                return html.replace(/data-action="(edit|delete)"/g, 'data-action="$1" data-kind="eid"');
            },
            weekSummary: function(items) {
                return '<div class="wk-pill"><small>Saved</small><b class="up">' + fmt(sum(items, 'amount')) + '</b></div>';
            },
            amountOf: function(r) { return r.amount; },
            barTone: 'gold',
            weekStart: function() { return store.prefs.weekStart; },
            emptyIcon: GOALS[key].icon,
            emptyText: 'No savings yet. Tap “Add savings”.'
        });
    });

    /* ── events ──────────────────────────────────────────── */
    page.addEventListener('click', function(e) {
        const an = e.target.closest('[data-animal]');
        if (an) {
            const a = an.getAttribute('data-animal');
            const patch = { eidPlans: { adha: { animal: a } } };
            const cur = plans().adha || {};
            if (!num(cur.target)) { patch.eidPlans.adha.target = ANIMALS[a].price; }
            savePrefs(patch).catch(fail);
            return;
        }
        const sp = e.target.closest('[data-saveplan]');
        if (sp) { savePlan(sp.getAttribute('data-saveplan')); return; }
        const ad = e.target.closest('[data-addsave]');
        if (ad) { addSaving(ad.getAttribute('data-addsave')); }
    });

    /* edit/delete for eid savings rows (kind "eid" is handled here) */
    page.addEventListener('click', function(e) {
        const b = e.target.closest('[data-action][data-kind="eid"]');
        if (!b) { return; }
        e.stopPropagation();
        const id = b.getAttribute('data-id');
        const rec = store.data.eidSavings.filter(function(r) { return r.id === id; })[0];
        if (!rec) { return; }
        if (b.getAttribute('data-action') === 'delete') {
            import('../core/ui.js').then(function(ui) {
                return ui.confirmBox('Remove this saving entry?', { okText: 'Remove', danger: true });
            }).then(function(ok) {
                if (!ok) { return; }
                import('../core/store.js').then(function(s) { return s.removeRecord('eidSavings', id); }).then(function() { toast('Removed', 'ok'); }, fail);
            });
        } else {
            addSaving(rec.goal, rec);
        }
    }, true);

    function fail(err) { toast('Could not save: ' + (err.code || err.message), 'err', 4500); }

    function savePlan(key) {
        const card = page.querySelector('[data-goal="' + key + '"]');
        const patch = {};
        patch[key] = {
            target: num(card.querySelector('[data-f="target"]').value),
            start: card.querySelector('[data-f="start"]').value || ''
        };
        if (key === 'fitr') {
            patch.fitr.people = num(card.querySelector('#e-fp').value);
            patch.fitr.fitrahRate = num(card.querySelector('#e-fr').value);
        }
        savePrefs({ eidPlans: patch }).then(function() { toast('Plan saved ✓', 'ok'); }, fail);
    }

    function addSaving(key, rec) {
        const m = openModal({
            title: (rec ? 'Edit' : 'Add') + ' savings — ' + GOALS[key].title,
            html:
                '<div class="form-grid" style="--fmin:140px">' +
                '<div class="field"><label for="s-amt">Amount (₹)</label><input type="number" id="s-amt" inputmode="decimal" min="0" step="any" value="' + (rec ? esc(rec.amount) : '') + '"></div>' +
                '<div class="field"><label for="s-date">Date</label><input type="date" id="s-date" value="' + esc(rec ? rec.date : todayStr()) + '"></div>' +
                '<div class="field"><label for="s-src">From</label><select id="s-src">' +
                ['Savings', 'Salary', 'Income', 'Gift', 'Other'].map(function(s) { return '<option' + (rec && rec.source === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
                '<div class="field"><label for="s-note">Note</label><input type="text" id="s-note" maxlength="80" value="' + esc(rec ? rec.note : '') + '"></div>' +
                '<div class="form-actions"><button type="button" class="btn btn-teal" id="s-save">Save</button></div>'
        });
        m.body.querySelector('#s-save').addEventListener('click', function() {
            const amt = parseFloat(m.body.querySelector('#s-amt').value);
            if (!(amt > 0)) { toast('Enter an amount above zero.', 'warn'); return; }
            const data = {
                goal: key, amount: amt,
                date: m.body.querySelector('#s-date').value || todayStr(),
                source: m.body.querySelector('#s-src').value,
                note: m.body.querySelector('#s-note').value.trim() || GOALS[key].title + ' savings'
            };
            saveRecord('eidSavings', data, rec ? rec.id : undefined).then(function() { m.close(); toast('Saved ✓', 'ok'); }, fail);
        });
    }

    /* ── render ──────────────────────────────────────────── */
    function render() {
        document.getElementById('e-kpis').innerHTML = kpiRow();
        /* do not rebuild a goal form while the user is typing in it */
        ['fitr', 'adha'].forEach(function(key) {
            const body = document.getElementById('e-' + key + '-body');
            if (body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') { return; }
            body.innerHTML = goalBody(key);
        });
        hist.fitr.update();
        hist.adha.update();
    }

    render();
    subscribe(render);
});

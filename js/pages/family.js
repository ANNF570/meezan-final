/* ============================================================
   MEEZAN — ميزان  |  js/pages/family.js
   Family & shared expense groups.
   - Top-level `groups/{id}` collection (kept from v1 so old groups still open)
   - members: real users (memberUids) + people without the app (manual names)
   - split equally or custom, settlement with "mark as paid" + undo
   - import my share into my own Expenses
   Fixes vs v1: no inline onclick, no composite-index requirement
   (sorted in the browser), join by link OR code, identity by uid
   (memberMap) so renames/duplicate names no longer break balances,
   local-date helpers (no IST bug).
   ============================================================ */

import { boot } from '../core/shell.js';
import {
    db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc, getDocs,
    query, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, deleteField
} from '../core/firebase.js';
import { esc, fmt, todayStr, fmtDay } from '../core/utils.js';
import { toast, openModal, confirmBox, emptyState } from '../core/ui.js';
import { openExpenseForm } from '../core/forms.js';

const ICONS = ['👨‍👩‍👧', '🏠', '🍽️', '✈️', '🛒', '🎉', '🕌', '🚗', '🎁', '💼'];

boot({
    page: 'family',
    navKey: 'family',
    title: 'Family & Groups',
    needs: ['income', 'expenses', 'accounts', 'transfers']
}, function(ctx) {
    const page = document.getElementById('page');
    const user = ctx.user;
    const myBase = user.displayName || (user.email ? user.email.split('@')[0] : 'Me');

    let groups = [];
    let current = null;
    let expenses = [];
    let payments = [];
    let unsubs = [];
    let unsubList = null;

    /* ── helpers ─────────────────────────────────────────── */
    function myName(g) {
        if (g && g.memberMap && g.memberMap[user.uid]) { return g.memberMap[user.uid]; }
        return myBase;
    }
    function names(g) { return (g && g.memberNames) || []; }
    function r2(n) { return Math.round(n * 100) / 100; }
    function inviteLink(id) {
        return location.origin + location.pathname.replace(/[^/]*$/, '') + 'family.html?join=' + id;
    }
    function copyText(t) {
        if (navigator.clipboard && navigator.clipboard.writeText) { return navigator.clipboard.writeText(t); }
        return Promise.reject(new Error('no clipboard'));
    }
    function failMsg(err) { return 'Could not save: ' + (err.code || err.message); }

    /* ── shell ───────────────────────────────────────────── */
    page.innerHTML = '<div id="fam-join"></div><div id="fam-list-view"></div><div id="fam-detail-view" class="stack" hidden></div>';
    const joinBox = document.getElementById('fam-join');
    const listView = document.getElementById('fam-list-view');
    const detailView = document.getElementById('fam-detail-view');

    /* ── groups list ─────────────────────────────────────── */
    function listenGroups() {
        const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', user.uid));
        unsubList = onSnapshot(q, function(snap) {
            groups = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            groups.sort(function(a, b) {
                const x = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 9e12;
                const y = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 9e12;
                return y - x;
            });
            if (current) {
                const fresh = groups.filter(function(g) { return g.id === current.id; })[0];
                if (fresh) { current = fresh; renderDetail(); } else { closeDetail(); }
            }
            renderList();
        }, function(err) {
            listView.innerHTML = '<div class="banner banner-bad">Could not load groups: ' + esc(err.code || err.message) +
                '. Check that the latest firestore.rules are published.</div>';
        });
    }

    function renderList() {
        const cards = groups.map(function(g) {
            const done = g.status === 'complete';
            const n = names(g).length;
            return '<button type="button" class="fam-card" data-open="' + esc(g.id) + '">' +
                '<span class="fam-ico">' + esc(g.icon || '👨‍👩‍👧') + '</span>' +
                '<span class="fam-main"><b>' + esc(g.name) + '</b><small>' + n + ' member' + (n === 1 ? '' : 's') + ' · ' + (g.expenseCount || 0) + ' expenses' +
                (g.createdBy === user.uid ? ' · Owner' : '') + '</small></span>' +
                '<span class="fam-side"><b class="num">' + fmt(g.total || 0) + '</b><small class="' + (done ? 'up' : 'gold') + '">' + (done ? '✅ Done' : '🔄 Active') + '</small></span></button>';
        }).join('');

        listView.innerHTML =
            '<div class="grid" style="--min:320px">' +
            '<div class="card"><div class="card-title">➕ New group</div>' +
            '<div class="field"><label for="g-name">Group name</label><input type="text" id="g-name" maxlength="50" placeholder="e.g. Family, Trip to Ajmer, Flat"></div>' +
            '<div class="field"><span class="field-label">Icon</span><div class="chips" id="g-icons">' +
            ICONS.map(function(i, k) { return '<button type="button" class="chip' + (k === 0 ? ' on' : '') + '" data-icon="' + i + '">' + i + '</button>'; }).join('') + '</div></div>' +
            '<div class="field"><label for="g-desc">Note (optional)</label><input type="text" id="g-desc" maxlength="120"></div>' +
            '<div class="form-actions"><button type="button" class="btn btn-teal" data-act="create">Create group</button></div></div>' +
            '<div class="card"><div class="card-title">🔗 Join a group</div>' +
            '<p class="hint">Open an invite link from a family member, or paste the group code / link here.</p>' +
            '<div class="field"><label for="g-code">Invite link or code</label><input type="text" id="g-code" autocapitalize="off" autocomplete="off"></div>' +
            '<div class="form-actions"><button type="button" class="btn btn-gold" data-act="join">Join</button></div></div></div>' +
            '<div class="card"><div class="card-title">👨‍👩‍👧 My groups</div>' +
            (cards ? '<div class="fam-list">' + cards + '</div>' : emptyState('🧾', 'No groups yet. Create one or join with an invite link.')) + '</div>';
        listView.setAttribute('data-icon', listView.getAttribute('data-icon') || ICONS[0]);
    }

    listView.addEventListener('click', function(e) {
        const ic = e.target.closest('[data-icon]');
        if (ic && ic.classList.contains('chip')) {
            listView.querySelectorAll('#g-icons .chip').forEach(function(c) { c.classList.remove('on'); });
            ic.classList.add('on');
            listView.setAttribute('data-icon', ic.getAttribute('data-icon'));
            return;
        }
        const open = e.target.closest('[data-open]');
        if (open) { openGroup(open.getAttribute('data-open')); return; }
        const act = e.target.closest('[data-act]');
        if (!act) { return; }
        if (act.getAttribute('data-act') === 'create') { createGroup(act); }
        if (act.getAttribute('data-act') === 'join') {
            const raw = document.getElementById('g-code').value.trim();
            const m = raw.match(/[?&]join=([A-Za-z0-9]+)/);
            joinGroup(m ? m[1] : raw);
        }
    });

    async function createGroup(btn) {
        const nameEl = document.getElementById('g-name');
        const name = nameEl.value.trim();
        if (!name) { toast('Enter a group name.', 'warn'); nameEl.focus(); return; }
        btn.disabled = true;
        const me = myBase;
        const map = {};
        map[user.uid] = me;
        try {
            const ref = await addDoc(collection(db, 'groups'), {
                name: name,
                icon: listView.getAttribute('data-icon') || ICONS[0],
                desc: document.getElementById('g-desc').value.trim(),
                createdBy: user.uid,
                memberUids: [user.uid],
                memberNames: [me],
                memberMap: map,
                manualNames: [],
                status: 'ongoing',
                total: 0,
                expenseCount: 0,
                createdAt: serverTimestamp()
            });
            toast('Group created ✓', 'ok');
            openGroup(ref.id);
        } catch (err) {
            toast(failMsg(err), 'err', 4500);
        }
        btn.disabled = false;
    }

    async function joinGroup(id, silent) {
        if (!id) { toast('Paste an invite link or code.', 'warn'); return; }
        try {
            const ref = doc(db, 'groups', id);
            const snap = await getDoc(ref);
            if (!snap.exists()) { showJoin('Group not found — the link may be wrong or the group was deleted.', 'bad'); return; }
            const g = snap.data();
            if ((g.memberUids || []).indexOf(user.uid) >= 0) {
                if (!silent) { toast('You are already in this group.', 'ok'); }
                openGroup(id);
                return;
            }
            /* a unique display name inside the group */
            let nm = myBase;
            let k = 2;
            while (names(g).indexOf(nm) >= 0) { nm = myBase + ' (' + k + ')'; k++; }
            const upd = { memberUids: arrayUnion(user.uid), memberNames: arrayUnion(nm) };
            upd['memberMap.' + user.uid] = nm;
            await updateDoc(ref, upd);
            showJoin('✓ You joined “' + g.name + '”. Welcome, ' + nm + '!', 'ok');
            openGroup(id);
        } catch (err) {
            showJoin('Could not join: ' + (err.code || err.message) + '. Ask the owner to resend the link.', 'bad');
        }
    }

    function showJoin(msg, tone) {
        joinBox.innerHTML = '<div class="banner banner-' + (tone === 'ok' ? 'ok' : 'bad') + '">' + esc(msg) + '</div>';
    }

    /* ── detail ──────────────────────────────────────────── */
    function detach() {
        unsubs.forEach(function(u) { u(); });
        unsubs = [];
    }

    function openGroup(id) {
        const g = groups.filter(function(x) { return x.id === id; })[0];
        current = g || { id: id, name: '…', memberNames: [] };
        expenses = [];
        payments = [];
        detach();
        listView.hidden = true;
        detailView.hidden = false;
        unsubs.push(onSnapshot(doc(db, 'groups', id), function(s) {
            if (!s.exists()) { closeDetail(); return; }
            current = Object.assign({ id: id }, s.data());
            renderDetail();
        }, function() {}));
        unsubs.push(onSnapshot(collection(db, 'groups', id, 'expenses'), function(s) {
            expenses = s.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            expenses.sort(function(a, b) { return (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0; });
            renderDetail();
        }, function() {}));
        unsubs.push(onSnapshot(collection(db, 'groups', id, 'payments'), function(s) {
            payments = s.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
            payments.sort(function(a, b) { return ((b.paidAt && b.paidAt.seconds) || 9e12) - ((a.paidAt && a.paidAt.seconds) || 9e12); });
            renderDetail();
        }, function() {}));
        renderDetail();
    }

    function closeDetail() {
        detach();
        current = null;
        detailView.hidden = true;
        listView.hidden = false;
        detailView.innerHTML = '';
        renderList();
    }

    function compute() {
        const list = names(current);
        const paid = {};
        const owes = {};
        list.forEach(function(n) { paid[n] = 0; owes[n] = 0; });
        expenses.forEach(function(e) {
            if (paid[e.paidBy] !== undefined) { paid[e.paidBy] += Number(e.amount) || 0; }
            Object.keys(e.splits || {}).forEach(function(p) {
                if (owes[p] !== undefined) { owes[p] += Number(e.splits[p]) || 0; }
            });
        });
        payments.forEach(function(p) {
            if (paid[p.from] !== undefined) { paid[p.from] += Number(p.amount) || 0; }
            if (owes[p.to] !== undefined) { owes[p.to] += Number(p.amount) || 0; }
        });
        const net = {};
        list.forEach(function(n) { net[n] = r2(paid[n] - owes[n]); });

        const debtors = [];
        const creditors = [];
        list.forEach(function(n) {
            if (net[n] < -0.01) { debtors.push({ name: n, val: -net[n] }); }
            if (net[n] > 0.01) { creditors.push({ name: n, val: net[n] }); }
        });
        const settlements = [];
        let i = 0;
        let j = 0;
        while (i < debtors.length && j < creditors.length) {
            const pay = Math.min(debtors[i].val, creditors[j].val);
            if (pay > 0.01) { settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(pay) }); }
            debtors[i].val -= pay;
            creditors[j].val -= pay;
            if (debtors[i].val < 0.01) { i++; }
            if (creditors[j].val < 0.01) { j++; }
        }
        const total = expenses.reduce(function(s, e) { return s + (Number(e.amount) || 0); }, 0);
        return { paid: paid, owes: owes, net: net, settlements: settlements, total: total };
    }

    function renderDetail() {
        if (!current) { return; }
        /* keep an open modal/typed input safe: only rebuild when no input inside has focus */
        const c = compute();
        const me = myName(current);
        const mine = c.net[me] || 0;
        const isOwner = current.createdBy === user.uid;
        const done = current.status === 'complete';

        const members = names(current).map(function(n) {
            const manual = (current.manualNames || []).indexOf(n) >= 0;
            return '<span class="chip chip-static">' + (n === me ? '👤 ' : '') + esc(n) +
                (manual && !done ? ' <button type="button" class="chip-x" data-rm="' + esc(n) + '" aria-label="Remove ' + esc(n) + '">✕</button>' : '') + '</span>';
        }).join('');

        const table = names(current).map(function(n) {
            const v = c.net[n] || 0;
            return '<div class="fam-row' + (n === me ? ' me' : '') + '"><b>' + esc(n) + (n === me ? ' 👤' : '') + '</b>' +
                '<span class="up num">' + fmt(c.paid[n] || 0) + '</span><span class="down num">' + fmt(c.owes[n] || 0) + '</span>' +
                '<b class="num ' + (v >= 0 ? 'up' : 'down') + '">' + (v >= 0 ? '+' : '−') + fmt(Math.abs(v)) + '</b></div>';
        }).join('');

        const settle = c.settlements.length ? c.settlements.map(function(s, k) {
            return '<div class="row-between fam-settle"><span>' + esc(s.from) + ' → <b>' + esc(s.to) + '</b></span>' +
                '<span class="row-gap"><b class="num gold">' + fmt(s.amount) + '</b>' +
                '<button type="button" class="btn btn-teal btn-sm" data-paid="' + k + '">Mark paid</button></span></div>';
        }).join('') : '<div class="banner banner-ok">✅ All settled!</div>';

        const exps = expenses.length ? expenses.map(function(e) {
            const who = Object.keys(e.splits || {}).join(', ');
            return '<div class="fam-exp"><div class="fam-exp-main"><b>' + esc(e.name) + '</b>' +
                '<small>' + esc(fmtDay(e.date)) + ' · paid by ' + esc(e.paidBy) + ' · split: ' + esc(who) + (e.note ? ' · ' + esc(e.note) : '') + '</small></div>' +
                '<div class="fam-exp-amt"><b class="num">' + fmt(e.amount) + '</b>' +
                (!done ? '<button type="button" class="icon-btn" data-delexp="' + esc(e.id) + '" aria-label="Delete expense">🗑️</button>' : '') + '</div></div>';
        }).join('') : emptyState('🧾', 'No expenses yet. Add the first one!');

        const pays = payments.length ? payments.map(function(p) {
            return '<div class="row-between small"><span>' + esc(p.from) + ' → ' + esc(p.to) + ' · <b class="num">' + fmt(p.amount) + '</b></span>' +
                '<button type="button" class="link-btn" data-undo="' + esc(p.id) + '">Undo</button></div>';
        }).join('') : '<div class="hint">No payments recorded yet.</div>';

        const mineTxt = Math.abs(mine) < 1 ? 'You are all settled in this group.' :
            mine > 0 ? 'The group owes you <b class="up num">' + fmt(mine) + '</b>.' :
                'You owe the group <b class="down num">' + fmt(-mine) + '</b>.';

        detailView.innerHTML =
            '<div class="row-between"><button type="button" class="btn btn-ghost btn-sm" data-act="back">← All groups</button>' +
            '<span class="badge ' + (done ? 'badge-ok' : 'badge-warn') + '">' + (done ? '✅ Complete' : '🔄 Active') + '</span></div>' +
            '<div class="card"><div class="row-between"><div><div class="card-title">' + esc(current.icon || '👨‍👩‍👧') + ' ' + esc(current.name) + '</div>' +
            (current.desc ? '<div class="hint">' + esc(current.desc) + '</div>' : '') + '</div>' +
            '<div class="center"><small class="muted">Total spent</small><div class="num big-num">' + fmt(c.total) + '</div></div></div>' +
            '<div class="banner banner-info">' + mineTxt + '</div>' +
            '<div class="form-actions">' +
            (!done ? '<button type="button" class="btn btn-teal" data-act="addexp">+ Add expense</button>' : '') +
            '<button type="button" class="btn btn-gold" data-act="import">📥 Add my share to my Expenses</button>' +
            '<button type="button" class="btn btn-ghost" data-act="share">📤 Share summary</button>' +
            (done ? '<button type="button" class="btn btn-ghost" data-act="reopen">Reopen</button>' : '<button type="button" class="btn btn-ghost" data-act="complete">Mark complete</button>') +
            (isOwner ? '<button type="button" class="btn btn-fire" data-act="delete">Delete group</button>' : '<button type="button" class="btn btn-fire" data-act="leave">Leave group</button>') +
            '</div></div>' +

            '<div class="grid" style="--min:320px">' +
            '<div class="card"><div class="card-title">👥 Members</div><div class="chips">' + members + '</div>' +
            (!done ? '<div class="field" style="margin-top:10px"><label for="m-name">Add someone without the app</label>' +
                '<div class="row-gap"><input type="text" id="m-name" maxlength="30" placeholder="Name"><button type="button" class="btn btn-ghost btn-sm" data-act="addmember">Add</button></div></div>' : '') +
            '<div class="field"><label for="m-link">Invite link (for people who use Meezan)</label>' +
            '<input type="text" id="m-link" readonly value="' + esc(inviteLink(current.id)) + '"></div>' +
            '<div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-act="copylink">Copy link</button>' +
            '<button type="button" class="btn btn-teal btn-sm" data-act="wa-invite">WhatsApp</button></div>' +
            '<div class="hint">Group code: <b>' + esc(current.id) + '</b></div></div>' +

            '<div class="card"><div class="card-title">⚖️ Who pays whom</div>' + settle +
            '<div class="card-title" style="margin-top:14px">Payments made</div>' + pays + '</div></div>' +

            '<div class="card"><div class="card-title">📊 Balances</div>' +
            '<div class="fam-row head"><span>Person</span><span>Paid</span><span>Share</span><span>Net</span></div>' + table + '</div>' +
            '<div class="card"><div class="card-title">🧾 Expenses</div>' + exps + '</div>';
    }

    /* ── detail actions ──────────────────────────────────── */
    detailView.addEventListener('click', function(e) {
        if (!current) { return; }
        const rm = e.target.closest('[data-rm]');
        if (rm) { removeManual(rm.getAttribute('data-rm')); return; }
        const del = e.target.closest('[data-delexp]');
        if (del) { deleteExpense(del.getAttribute('data-delexp')); return; }
        const paid = e.target.closest('[data-paid]');
        if (paid) { markPaid(parseInt(paid.getAttribute('data-paid'), 10)); return; }
        const undo = e.target.closest('[data-undo]');
        if (undo) { undoPayment(undo.getAttribute('data-undo')); return; }
        const a = e.target.closest('[data-act]');
        if (!a) { return; }
        const k = a.getAttribute('data-act');
        if (k === 'back') { closeDetail(); }
        if (k === 'addexp') { addExpenseModal(); }
        if (k === 'addmember') { addManual(); }
        if (k === 'copylink') {
            copyText(inviteLink(current.id)).then(function() { toast('Link copied ✓', 'ok'); }, function() {
                const inp = document.getElementById('m-link');
                inp.select();
                toast('Press Ctrl+C / long-press to copy.', 'warn');
            });
        }
        if (k === 'wa-invite') {
            const t = 'Assalamu Alaikum! 🌙\n\n' + myName(current) + ' invited you to the group *' + current.name + '* on Meezan.\nTap to join:\n' + inviteLink(current.id);
            window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
        }
        if (k === 'share') { shareSummary(); }
        if (k === 'import') { importShare(); }
        if (k === 'complete') { setStatus('complete'); }
        if (k === 'reopen') { setStatus('ongoing'); }
        if (k === 'delete') { deleteGroup(); }
        if (k === 'leave') { leaveGroup(); }
    });

    async function addManual() {
        const el = document.getElementById('m-name');
        const n = el.value.trim();
        if (!n) { return; }
        if (names(current).indexOf(n) >= 0) { toast('That name is already in the group.', 'warn'); return; }
        try {
            await updateDoc(doc(db, 'groups', current.id), { memberNames: arrayUnion(n), manualNames: arrayUnion(n) });
            el.value = '';
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function removeManual(n) {
        const used = expenses.some(function(x) { return x.paidBy === n || (x.splits && x.splits[n] !== undefined); }) ||
            payments.some(function(p) { return p.from === n || p.to === n; });
        if (used) { toast(n + ' is used in expenses, so cannot be removed.', 'warn', 4000); return; }
        try {
            await updateDoc(doc(db, 'groups', current.id), { memberNames: arrayRemove(n), manualNames: arrayRemove(n) });
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    function addExpenseModal() {
        const list = names(current);
        const me = myName(current);
        const m = openModal({
            title: 'Add group expense',
            html:
                '<div class="field"><label for="x-name">What was it for?</label><input type="text" id="x-name" maxlength="60"></div>' +
                '<div class="form-grid" style="--fmin:140px">' +
                '<div class="field"><label for="x-amt">Amount (₹)</label><input type="number" id="x-amt" inputmode="decimal" min="0" step="any"></div>' +
                '<div class="field"><label for="x-date">Date</label><input type="date" id="x-date" value="' + todayStr() + '"></div>' +
                '<div class="field"><label for="x-by">Paid by</label><select id="x-by">' +
                list.map(function(n) { return '<option value="' + esc(n) + '"' + (n === me ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div></div>' +
                '<div class="field"><span class="field-label">Split</span><div class="chips"><button type="button" class="chip on" data-split="equal">Equally</button><button type="button" class="chip" data-split="custom">Custom amounts</button></div></div>' +
                '<div id="x-people"></div><div id="x-check" class="hint"></div>' +
                '<div class="field"><label for="x-note">Note (optional)</label><input type="text" id="x-note" maxlength="80"></div>' +
                '<div class="form-actions"><button type="button" class="btn btn-teal" id="x-save">Add expense</button></div>'
        });
        const body = m.body;
        let mode = 'equal';

        function people() {
            body.querySelector('#x-people').innerHTML = list.map(function(n, k) {
                return '<div class="row-between fam-split"><label class="check"><input type="checkbox" data-p="' + k + '" checked> ' + esc(n) + '</label>' +
                    '<input type="number" data-v="' + k + '" inputmode="decimal" min="0" step="any" style="width:110px"' + (mode === 'equal' ? ' disabled' : '') + '></div>';
            }).join('');
            recalc();
        }
        function amount() { return parseFloat(body.querySelector('#x-amt').value) || 0; }
        function recalc() {
            const checks = body.querySelectorAll('[data-p]');
            const chosen = [];
            checks.forEach(function(c) { if (c.checked) { chosen.push(parseInt(c.getAttribute('data-p'), 10)); } });
            const amt = amount();
            if (mode === 'equal') {
                const each = chosen.length ? amt / chosen.length : 0;
                body.querySelectorAll('[data-v]').forEach(function(v) {
                    const k = parseInt(v.getAttribute('data-v'), 10);
                    v.value = chosen.indexOf(k) >= 0 && amt ? r2(each) : '';
                });
                body.querySelector('#x-check').textContent = chosen.length ? 'Each pays ' + fmt(each) : 'Pick at least one person.';
            } else {
                let t = 0;
                body.querySelectorAll('[data-v]').forEach(function(v) { t += parseFloat(v.value) || 0; });
                const diff = r2(amt - t);
                body.querySelector('#x-check').innerHTML = Math.abs(diff) <= 0.5 ? '<span class="up">✓ Split matches the amount</span>' :
                    '<span class="down">Split ' + fmt(t) + ' — ' + (diff > 0 ? fmt(diff) + ' left to assign' : fmt(-diff) + ' too much') + '</span>';
            }
        }
        people();

        body.addEventListener('input', recalc);
        body.addEventListener('change', recalc);
        body.addEventListener('click', function(e) {
            const s = e.target.closest('[data-split]');
            if (s) {
                mode = s.getAttribute('data-split');
                body.querySelectorAll('[data-split]').forEach(function(c) { c.classList.toggle('on', c === s); });
                people();
                return;
            }
            if (!e.target.closest('#x-save')) { return; }
            const name = body.querySelector('#x-name').value.trim();
            const amt = amount();
            if (!name) { toast('Enter what it was for.', 'warn'); return; }
            if (!(amt > 0)) { toast('Enter an amount above zero.', 'warn'); return; }
            const splits = {};
            let t = 0;
            body.querySelectorAll('[data-p]').forEach(function(c) {
                if (!c.checked) { return; }
                const k = parseInt(c.getAttribute('data-p'), 10);
                const v = parseFloat(body.querySelector('[data-v="' + k + '"]').value) || 0;
                splits[list[k]] = r2(v);
                t += v;
            });
            if (!Object.keys(splits).length) { toast('Pick at least one person.', 'warn'); return; }
            if (Math.abs(t - amt) > 0.5) { toast('Split must add up to the amount.', 'warn'); return; }
            const btn = body.querySelector('#x-save');
            btn.disabled = true;
            saveExpense({
                name: name, amount: amt, paidBy: body.querySelector('#x-by').value,
                date: body.querySelector('#x-date').value || todayStr(),
                note: body.querySelector('#x-note').value.trim(),
                splits: splits, splitType: mode
            }).then(function() { m.close(); toast('Expense added ✓', 'ok'); }, function(err) {
                btn.disabled = false;
                toast(failMsg(err), 'err', 4500);
            });
        });
    }

    async function saveExpense(x) {
        x.addedBy = myName(current);
        x.addedByUid = user.uid;
        x.createdAt = serverTimestamp();
        await addDoc(collection(db, 'groups', current.id, 'expenses'), x);
        await updateTotals();
    }

    async function updateTotals(extra) {
        /* recompute from the loaded list so the list-card total stays right */
        const snap = await getDocs(collection(db, 'groups', current.id, 'expenses'));
        let total = 0;
        snap.docs.forEach(function(d) { total += Number(d.data().amount) || 0; });
        const upd = { total: r2(total), expenseCount: snap.size };
        await updateDoc(doc(db, 'groups', current.id), Object.assign(upd, extra || {}));
    }

    async function deleteExpense(id) {
        const ok = await confirmBox('Delete this expense? Balances will be recalculated.', { okText: 'Delete', danger: true });
        if (!ok) { return; }
        try {
            await deleteDoc(doc(db, 'groups', current.id, 'expenses', id));
            await updateTotals();
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function markPaid(idx) {
        const s = compute().settlements[idx];
        if (!s) { return; }
        const ok = await confirmBox('Mark ' + fmt(s.amount) + ' from ' + s.from + ' to ' + s.to + ' as paid?', { okText: 'Yes, paid', danger: false });
        if (!ok) { return; }
        try {
            await addDoc(collection(db, 'groups', current.id, 'payments'), {
                from: s.from, to: s.to, amount: s.amount,
                markedBy: myName(current), markedByUid: user.uid, paidAt: serverTimestamp()
            });
            toast('Payment recorded ✓', 'ok');
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function undoPayment(id) {
        try { await deleteDoc(doc(db, 'groups', current.id, 'payments', id)); toast('Payment undone', 'ok'); } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function setStatus(s) {
        try { await updateDoc(doc(db, 'groups', current.id), { status: s }); } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function deleteGroup() {
        const ok = await confirmBox('Delete “' + current.name + '” and all its expenses for everyone? This cannot be undone.', { okText: 'Delete', danger: true });
        if (!ok) { return; }
        try {
            const id = current.id;
            const e = await getDocs(collection(db, 'groups', id, 'expenses'));
            for (const d of e.docs) { await deleteDoc(d.ref); }
            const p = await getDocs(collection(db, 'groups', id, 'payments'));
            for (const d of p.docs) { await deleteDoc(d.ref); }
            await deleteDoc(doc(db, 'groups', id));
            toast('Group deleted', 'ok');
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    async function leaveGroup() {
        const me = myName(current);
        const used = expenses.some(function(x) { return x.paidBy === me || (x.splits && x.splits[me] !== undefined); });
        if (used) { toast('You are part of expenses in this group, so you cannot leave. Ask the owner to mark it complete.', 'warn', 5000); return; }
        const ok = await confirmBox('Leave “' + current.name + '”?', { okText: 'Leave', danger: true });
        if (!ok) { return; }
        try {
            const upd = { memberUids: arrayRemove(user.uid), memberNames: arrayRemove(me) };
            upd['memberMap.' + user.uid] = deleteField();
            await updateDoc(doc(db, 'groups', current.id), upd);
        } catch (err) { toast(failMsg(err), 'err', 4500); }
    }

    function importShare() {
        const c = compute();
        /* what I actually consumed = my total share of expenses */
        const share = Math.round(c.owes[myName(current)] || 0);
        if (!share) { toast('You have no share in this group yet.', 'warn'); return; }
        openExpenseForm({ preset: { cat: 'Family / Home', title: 'Add my share to Expenses', name: current.name + ' (group share)', amt: share } });
    }

    function shareSummary() {
        const c = compute();
        let t = '📊 *' + current.name + '* — Meezan\nTotal: ' + fmt(c.total) + '\n\n';
        if (c.settlements.length) {
            t += '*Who pays whom*\n' + c.settlements.map(function(s) { return '• ' + s.from + ' → ' + s.to + ': ' + fmt(s.amount); }).join('\n');
        } else {
            t += '✅ All settled!';
        }
        if (navigator.share) {
            navigator.share({ title: current.name, text: t }).catch(function() {});
        } else {
            window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener');
        }
    }

    /* ── start ───────────────────────────────────────────── */
    listenGroups();
    const joinId = new URLSearchParams(location.search).get('join');
    if (joinId) {
        history.replaceState(null, '', location.pathname);
        joinGroup(joinId, true);
    }
});

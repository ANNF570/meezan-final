/* ============================================================
   MEEZAN — ميزان  |  js/core/ui.js
   Shared UI toolkit (no framework):
   toast · modal · confirm · select builders · progress
   · History component (10-per-page list + weekly side-slider)
   ============================================================ */

import { ACCOUNT_TYPES, ACCOUNT_TYPE_ORDER, INCOME_CATS, EXPENSE_CATS, WEEKDAYS_SHORT } from './constants.js';
import { esc, fmt, fmtDay, num, ymd, parseYmd, addDays, startOfWeek, todayStr } from './utils.js';

export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

export function setText(id, value) {
    const el = document.getElementById(id);
    if (el) { el.textContent = value; }
}

export function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = html; }
}

/* Event delegation with addEventListener (no inline onclick anywhere) */
export function on(root, type, selector, handler) {
    root.addEventListener(type, function(e) {
        const target = e.target.closest ? e.target.closest(selector) : null;
        if (target && root.contains(target)) { handler(e, target); }
    });
}

/* ── TOAST ──────────────────────────────────────────────────── */
function toastHost() {
    let host = document.getElementById('toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.className = 'toast-host';
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
    }
    return host;
}

export function toast(message, kind, ms, action) {
    const host = toastHost();
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'ok');
    const msg = document.createElement('span');
    msg.textContent = message;
    el.appendChild(msg);
    if (action) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'toast-btn';
        b.textContent = action.label;
        b.addEventListener('click', function() { action.onClick(); el.remove(); });
        el.appendChild(b);
    }
    host.appendChild(el);
    const life = ms === undefined ? 3200 : ms;
    if (life > 0) {
        setTimeout(function() {
            el.classList.add('toast-out');
            setTimeout(function() { el.remove(); }, 300);
        }, life);
    }
    return el;
}

/* ── MODAL ──────────────────────────────────────────────────── */
export function openModal(opts) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
        '<div class="modal' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
        '<button type="button" class="modal-x" aria-label="Close">✕</button></div>' +
        '<div class="modal-body">' + (opts.html || '') + '</div></div>';
    document.body.appendChild(back);
    document.body.classList.add('modal-open');
    let closed = false;

    function close() {
        if (closed) { return; }
        closed = true;
        document.removeEventListener('keydown', onKey);
        back.remove();
        if (!document.querySelector('.modal-backdrop')) { document.body.classList.remove('modal-open'); }
        if (opts.onClose) { opts.onClose(); }
    }
    function onKey(e) { if (e.key === 'Escape') { close(); } }

    back.querySelector('.modal-x').addEventListener('click', close);
    back.addEventListener('mousedown', function(e) { if (e.target === back) { close(); } });
    document.addEventListener('keydown', onKey);
    const body = back.querySelector('.modal-body');
    const first = body.querySelector('input,select,textarea');
    if (first) { setTimeout(function() { first.focus({ preventScroll: true }); }, 30); }
    return { el: back, body: body, close: close };
}

/* confirmBox('Delete this?', { okText:'Delete', danger:true }) → Promise<boolean> */
export function confirmBox(message, opts) {
    const o = opts || {};
    return new Promise(function(resolve) {
        let answer = false;
        const m = openModal({
            title: o.title || 'Please confirm',
            html: '<p class="confirm-msg">' + esc(message) + '</p>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-ghost" data-act="no">' + esc(o.cancelText || 'Cancel') + '</button>' +
                '<button type="button" class="btn ' + (o.danger ? 'btn-fire' : 'btn-teal') + '" data-act="yes">' +
                esc(o.okText || 'OK') + '</button></div>',
            onClose: function() { resolve(answer); }
        });
        m.body.querySelector('[data-act="yes"]').addEventListener('click', function() { answer = true; m.close(); });
        m.body.querySelector('[data-act="no"]').addEventListener('click', function() { m.close(); });
    });
}

/* ── <select> OPTION BUILDERS ───────────────────────────────── */
export function incomeCatOptions(selected) {
    return INCOME_CATS.map(function(c) {
        return '<option value="' + esc(c.label) + '"' + (c.label === selected ? ' selected' : '') + '>' +
            c.icon + ' ' + esc(c.label) + '</option>';
    }).join('');
}

export function expenseCatOptions(selected) {
    const groups = {};
    const order = [];
    EXPENSE_CATS.forEach(function(c) {
        if (c.legacy && c.label !== selected) { return; }
        if (!groups[c.group]) { groups[c.group] = []; order.push(c.group); }
        groups[c.group].push(c);
    });
    return order.map(function(g) {
        return '<optgroup label="' + esc(g) + '">' + groups[g].map(function(c) {
            return '<option value="' + esc(c.label) + '"' + (c.label === selected ? ' selected' : '') + '>' +
                c.icon + ' ' + esc(c.label) + '</option>';
        }).join('') + '</optgroup>';
    }).join('');
}

export function accountOptions(accounts, balances, selectedId, includeEmpty) {
    let html = includeEmpty ? '<option value="">— Not linked —</option>' : '';
    ACCOUNT_TYPE_ORDER.forEach(function(t) {
        const list = accounts.filter(function(a) {
            return !a.archived && (ACCOUNT_TYPES[a.type] ? a.type : 'cash') === t;
        });
        if (!list.length) { return; }
        html += '<optgroup label="' + esc(ACCOUNT_TYPES[t].long) + '">';
        list.forEach(function(a) {
            const bal = balances ? ' — ' + fmt(balances[a.id] || 0) : '';
            html += '<option value="' + esc(a.id) + '"' + (a.id === selectedId ? ' selected' : '') + '>' +
                ACCOUNT_TYPES[t].icon + ' ' + esc(a.name) + bal + '</option>';
        });
        html += '</optgroup>';
    });
    return html;
}

export function lastAccount(kind) {
    try { return localStorage.getItem('meezan-last-acc-' + kind) || ''; } catch (e) { return ''; }
}

export function rememberAccount(kind, id) {
    try { localStorage.setItem('meezan-last-acc-' + kind, id || ''); } catch (e) { /* ignore */ }
}

export function emptyState(icon, text) {
    return '<div class="empty"><div class="empty-ico">' + icon + '</div><div>' + text + '</div></div>';
}

export function progressBar(percent, tone) {
    const p = Math.max(0, Math.min(100, percent));
    return '<div class="progress"><div class="progress-fill ' + (tone || '') + '" style="width:' + p.toFixed(1) + '%"></div></div>';
}

/* ═══════════════════════════════════════════════════════════════
   HISTORY COMPONENT  (Income, Expenses, Zakat/Sadaqah, Reports)

   ☰ List   — 10 records per page. ▲ ▼ slide the list up / down
              through pages (newer ↔ older).
   ▤ Weekly — one slide per week. Swipe (or ◀ ▶) side to side.
              Each week has its own totals, 7-day bars and records.

   createHistory(container, {
       getItems, renderRow, weekSummary, amountOf, barTone,
       emptyText, emptyIcon, pageSize, weekStart() })  → { update() }
   ═══════════════════════════════════════════════════════════════ */
export function createHistory(container, opts) {
    const pageSize = opts.pageSize || 10;
    let view = 'list';
    let page = 0;
    let items = [];
    let weeks = [];
    let weekIdx = 0;
    let weeksTodayKey = '';
    let scrollTimer = null;
    let observer = null;
    let built = false;

    container.classList.add('hist');
    container.innerHTML =
        '<div class="hist-tabs" role="tablist">' +
        '<button type="button" class="hist-tab on" data-view="list" role="tab">☰ List</button>' +
        '<button type="button" class="hist-tab" data-view="weekly" role="tab">▤ Weekly</button>' +
        '</div>' +
        '<div class="hist-pane" data-pane="list"></div>' +
        '<div class="hist-pane" data-pane="weekly" hidden></div>';

    const listPane = container.querySelector('[data-pane="list"]');
    const weekPane = container.querySelector('[data-pane="weekly"]');

    container.querySelector('.hist-tabs').addEventListener('click', function(e) {
        const btn = e.target.closest('.hist-tab');
        if (!btn) { return; }
        view = btn.getAttribute('data-view');
        container.querySelectorAll('.hist-tab').forEach(function(t) { t.classList.toggle('on', t === btn); });
        listPane.hidden = view !== 'list';
        weekPane.hidden = view !== 'weekly';
        if (view === 'weekly') { renderWeekly(true); } else { renderList(''); }
    });

    /* ---------- LIST (10 per page, slide up/down) ---------- */
    function totalPages() { return Math.max(1, Math.ceil(items.length / pageSize)); }

    function pageNumbers(cur, total) {
        if (total <= 7) {
            const all = [];
            for (let i = 0; i < total; i++) { all.push(i); }
            return all;
        }
        const out = [0];
        const lo = Math.max(1, cur - 1);
        const hi = Math.min(total - 2, cur + 1);
        if (lo > 1) { out.push('…'); }
        for (let i = lo; i <= hi; i++) { out.push(i); }
        if (hi < total - 2) { out.push('…'); }
        out.push(total - 1);
        return out;
    }

    function renderList(direction) {
        if (!items.length) {
            listPane.innerHTML = emptyState(opts.emptyIcon || '📭', opts.emptyText || 'No records yet');
            return;
        }
        const pages = totalPages();
        page = Math.max(0, Math.min(pages - 1, page));
        const from = page * pageSize;
        const slice = items.slice(from, from + pageSize);
        const dots = pageNumbers(page, pages).map(function(p) {
            if (p === '…') { return '<span class="pg-gap">…</span>'; }
            return '<button type="button" class="pg-num' + (p === page ? ' on' : '') + '" data-page="' + p + '">' + (p + 1) + '</button>';
        }).join('');
        listPane.innerHTML =
            '<div class="hist-rows ' + (direction ? 'slide-' + direction : '') + '" tabindex="0">' +
            slice.map(opts.renderRow).join('') + '</div>' +
            '<div class="pager">' +
            '<button type="button" class="pg-btn" data-pg="up" ' + (page === 0 ? 'disabled' : '') + ' aria-label="Newer records">▲</button>' +
            '<div class="pager-mid"><div class="pager-info">' + (from + 1) + '–' + (from + slice.length) + ' of ' + items.length + '</div>' +
            '<div class="pager-nums">' + dots + '</div></div>' +
            '<button type="button" class="pg-btn" data-pg="down" ' + (page >= pages - 1 ? 'disabled' : '') + ' aria-label="Older records">▼</button>' +
            '</div>';
    }

    function goPage(next) {
        const target = Math.max(0, Math.min(totalPages() - 1, next));
        if (target === page) { return; }
        const dir = target > page ? 'from-below' : 'from-above';
        page = target;
        renderList(dir);
    }

    listPane.addEventListener('click', function(e) {
        const pg = e.target.closest('[data-pg]');
        if (pg && !pg.disabled) {
            goPage(page + (pg.getAttribute('data-pg') === 'down' ? 1 : -1));
            return;
        }
        const n = e.target.closest('[data-page]');
        if (n) { goPage(parseInt(n.getAttribute('data-page'), 10)); }
    });

    listPane.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goPage(page + 1); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goPage(page - 1); }
    });

    /* ---------- WEEKLY (side-to-side slider) ---------- */
    function buildWeeks() {
        const ws = opts.weekStart ? opts.weekStart() : 1;
        const todayWeek = startOfWeek(new Date(), ws);
        let minDate = todayWeek;
        let maxDate = todayWeek;
        const byWeek = {};
        items.forEach(function(r) {
            const d = parseYmd(r.date);
            if (!d) { return; }
            const w = startOfWeek(d, ws);
            const key = ymd(w);
            if (!byWeek[key]) { byWeek[key] = []; }
            byWeek[key].push(r);
            if (w < minDate) { minDate = w; }
            if (w > maxDate) { maxDate = w; }
        });
        const list = [];
        let cursor = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        let guard = 0;
        while (cursor <= maxDate && guard < 600) {
            const key = ymd(cursor);
            list.push({ start: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()), key: key, records: byWeek[key] || [] });
            cursor = addDays(cursor, 7);
            guard++;
        }
        return { list: list, todayKey: ymd(todayWeek) };
    }

    function weekTitle(w) {
        const end = addDays(w.start, 6);
        const range = fmtDay(w.start) + ' – ' + fmtDay(end);
        if (w.key === weeksTodayKey) { return 'This week · ' + range; }
        if (ymd(addDays(w.start, 7)) === weeksTodayKey) { return 'Last week · ' + range; }
        return range + ' ' + end.getFullYear();
    }

    function dayBars(w) {
        const sums = [0, 0, 0, 0, 0, 0, 0];
        w.records.forEach(function(r) {
            const d = parseYmd(r.date);
            if (!d) { return; }
            const idx = Math.round((d - w.start) / 86400000);
            if (idx >= 0 && idx < 7) { sums[idx] += Math.abs(num(opts.amountOf ? opts.amountOf(r) : r.amt)); }
        });
        const mx = Math.max.apply(null, sums.concat([1]));
        let html = '<div class="wk-bars">';
        for (let i = 0; i < 7; i++) {
            const d = addDays(w.start, i);
            const h = sums[i] > 0 ? Math.max(10, Math.round((sums[i] / mx) * 100)) : 4;
            html += '<div class="wk-bar" title="' + esc(WEEKDAYS_SHORT[d.getDay()] + ' ' + fmt(sums[i])) + '">' +
                '<div class="wk-bar-fill ' + (opts.barTone || '') + (sums[i] > 0 ? '' : ' zero') + '" style="height:' + h + '%"></div>' +
                '<span>' + WEEKDAYS_SHORT[d.getDay()].charAt(0) + '</span></div>';
        }
        return html + '</div>';
    }

    function fillSlide(i) {
        const holder = weekPane.querySelector('[data-body="' + i + '"]');
        if (!holder || holder.getAttribute('data-done') === '1' || !weeks[i]) { return; }
        const w = weeks[i];
        const sorted = w.records.slice().sort(function(a, b) {
            return (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : 0;
        });
        holder.innerHTML =
            '<div class="wk-head"><div class="wk-title">' + esc(weekTitle(w)) + '</div>' +
            '<div class="wk-count">' + w.records.length + ' record' + (w.records.length === 1 ? '' : 's') + '</div></div>' +
            '<div class="wk-sum">' + (opts.weekSummary ? opts.weekSummary(w.records) : '') + '</div>' +
            dayBars(w) +
            '<div class="wk-rows">' + (sorted.length ? sorted.map(opts.renderRow).join('') :
                '<div class="empty small"><div>No records this week</div></div>') + '</div>';
        holder.setAttribute('data-done', '1');
    }

    function scrollToWeek(i, smooth) {
        const track = weekPane.querySelector('.week-track');
        if (!track) { return; }
        const dir = getComputedStyle(track).direction === 'rtl' ? -1 : 1;
        track.scrollTo({ left: dir * i * track.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    }

    function updateWeekLabel() {
        const label = weekPane.querySelector('#wk-label');
        if (label && weeks[weekIdx]) { label.textContent = weekTitle(weeks[weekIdx]); }
        const prev = weekPane.querySelector('[data-wk="prev"]');
        const next = weekPane.querySelector('[data-wk="next"]');
        const now = weekPane.querySelector('[data-wk="now"]');
        if (prev) { prev.disabled = weekIdx <= 0; }
        if (next) { next.disabled = weekIdx >= weeks.length - 1; }
        if (now) { now.style.visibility = weeks[weekIdx] && weeks[weekIdx].key === weeksTodayKey ? 'hidden' : 'visible'; }
        fillSlide(weekIdx);
    }

    function goWeek(i) {
        weekIdx = Math.max(0, Math.min(weeks.length - 1, i));
        fillSlide(weekIdx);
        scrollToWeek(weekIdx, true);
        updateWeekLabel();
    }

    function renderWeekly(jumpToEnd) {
        const b = buildWeeks();
        weeks = b.list;
        weeksTodayKey = b.todayKey;
        if (!items.length) {
            weekPane.innerHTML = emptyState(opts.emptyIcon || '📭', opts.emptyText || 'No records yet');
            return;
        }
        if (jumpToEnd || weekIdx > weeks.length - 1) { weekIdx = weeks.length - 1; }
        weekPane.innerHTML =
            '<div class="week-nav">' +
            '<button type="button" class="pg-btn" data-wk="prev" aria-label="Older week">◀</button>' +
            '<div class="week-nav-mid"><div class="week-label" id="wk-label"></div>' +
            '<button type="button" class="link-btn" data-wk="now">Jump to this week</button></div>' +
            '<button type="button" class="pg-btn" data-wk="next" aria-label="Newer week">▶</button></div>' +
            '<div class="week-track" tabindex="0">' +
            weeks.map(function(w, i) {
                return '<section class="week-slide" data-idx="' + i + '" aria-label="' + esc(weekTitle(w)) + '">' +
                    '<div class="week-card"><div class="week-body" data-body="' + i + '"></div></div></section>';
            }).join('') + '</div>' +
            '<div class="week-hint">Swipe left / right to move between weeks</div>';

        const track = weekPane.querySelector('.week-track');
        if (observer) { observer.disconnect(); }
        if ('IntersectionObserver' in window) {
            observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(en) {
                    if (en.isIntersecting) { fillSlide(parseInt(en.target.getAttribute('data-idx'), 10)); }
                });
            }, { root: track, rootMargin: '0px 100% 0px 100%' });
            track.querySelectorAll('.week-slide').forEach(function(s) { observer.observe(s); });
        } else {
            weeks.forEach(function(w, i) { fillSlide(i); });
        }
        fillSlide(weekIdx);
        scrollToWeek(weekIdx, false);
        updateWeekLabel();

        track.addEventListener('scroll', function() {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function() {
                const idx = Math.abs(Math.round(track.scrollLeft / (track.clientWidth || 1)));
                if (idx !== weekIdx && idx < weeks.length) {
                    weekIdx = idx;
                    updateWeekLabel();
                }
            }, 80);
        });
        track.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowRight') { e.preventDefault(); goWeek(weekIdx + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goWeek(weekIdx - 1); }
        });
    }

    weekPane.addEventListener('click', function(e) {
        const b = e.target.closest('[data-wk]');
        if (!b || b.disabled) { return; }
        const k = b.getAttribute('data-wk');
        if (k === 'prev') { goWeek(weekIdx - 1); }
        if (k === 'next') { goWeek(weekIdx + 1); }
        if (k === 'now') {
            let idx = weeks.length - 1;
            for (let i = 0; i < weeks.length; i++) { if (weeks[i].key === weeksTodayKey) { idx = i; } }
            goWeek(idx);
        }
    });

    window.addEventListener('resize', function() {
        if (view === 'weekly' && weeks.length) { scrollToWeek(weekIdx, false); }
    });

    function update() {
        items = (opts.getItems() || []).slice();
        if (view === 'list') { renderList(''); } else { renderWeekly(!built); }
        built = true;
    }

    return { update: update };
}

/* Standard record row. o: { icon, color, title, meta, amount, tone, id } */
export function recordRow(o) {
    return '<div class="rec" data-id="' + esc(o.id) + '">' +
        '<div class="rec-ico" style="background:' + o.color + '22;border-color:' + o.color + '55">' + o.icon + '</div>' +
        '<div class="rec-main"><div class="rec-title">' + esc(o.title) + '</div>' +
        '<div class="rec-meta">' + o.meta + '</div></div>' +
        '<div class="rec-side"><div class="rec-amt ' + (o.tone || '') + '">' + o.amount + '</div>' +
        '<div class="rec-actions">' +
        '<button type="button" class="icon-btn" data-action="edit" data-id="' + esc(o.id) + '" aria-label="Edit" title="Edit">✏️</button>' +
        '<button type="button" class="icon-btn" data-action="delete" data-id="' + esc(o.id) + '" aria-label="Delete" title="Delete">🗑️</button>' +
        '</div></div></div>';
}

export { todayStr };

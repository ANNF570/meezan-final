/* ============================================================
   MEEZAN — ميزان  |  js/core/tools.js
   Calendar (Gregorian + Hijri, with your records) and Calculator
   (with Zakat 2.5% and percent shortcuts). Used in Settings.
   ============================================================ */

import { store } from './store.js';
import { MONTHS_SHORT, WEEKDAYS_SHORT, incomeCat, expenseCat, isTrustIncome } from './constants.js';
import { esc, fmt, ymd, pad, hijriOf, hijriText, addDays, startOfWeek, todayStr, num, sum, parseYmd } from './utils.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* hMonth-hDay → event */
const EVENTS = {
    '1-1': ['🌙', 'Islamic New Year'], '1-10': ['🤲', 'Ashura'], '3-12': ['🕌', 'Mawlid al-Nabi ﷺ'],
    '7-27': ['✨', 'Isra & Mi\'raj'], '8-15': ['🕯️', 'Shab-e-Barat'], '9-1': ['🌙', 'Ramadan begins'],
    '9-27': ['✨', 'Laylatul Qadr (27th night)'], '10-1': ['🎉', 'Eid ul-Fitr'], '12-9': ['⛰️', 'Day of Arafah'],
    '12-10': ['🐑', 'Eid ul-Adha']
};

export function eventOf(hijri) {
    return hijri ? EVENTS[hijri.month + '-' + hijri.day] : null;
}

/* ═══════════════════════════ CALENDAR ═════════════════════════ */
export function mountCalendar(root) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let selected = todayStr();

    root.innerHTML = '<div class="cal"></div>';
    const box = root.firstChild;

    root.addEventListener('click', function(e) {
        const nav = e.target.closest('[data-cal]');
        if (nav) {
            const k = nav.getAttribute('data-cal');
            if (k === 'prev') { month--; if (month < 0) { month = 11; year--; } }
            if (k === 'next') { month++; if (month > 11) { month = 0; year++; } }
            if (k === 'today') { year = now.getFullYear(); month = now.getMonth(); selected = todayStr(); }
            draw();
            return;
        }
        const day = e.target.closest('[data-day]');
        if (day) { selected = day.getAttribute('data-day'); draw(); }
    });

    function dayRecords(dateStr) {
        const inc = store.data.income.filter(function(r) { return r.date === dateStr; });
        const exp = store.data.expenses.filter(function(r) { return r.date === dateStr; });
        return { inc: inc, exp: exp };
    }

    function draw() {
        const adj = store.prefs.hijriAdjust;
        const ws = store.prefs.weekStart;
        const first = new Date(year, month, 1);
        const gridStart = startOfWeek(first, ws);
        const days = [];
        for (let i = 0; i < 42; i++) { days.push(addDays(gridStart, i)); }
        if (days[35].getMonth() !== month) { days.length = 35; }

        /* which dates have records */
        const hasInc = {};
        const hasExp = {};
        store.data.income.forEach(function(r) { hasInc[r.date] = true; });
        store.data.expenses.forEach(function(r) { hasExp[r.date] = true; });

        const mid = hijriOf(new Date(year, month, 15), adj);
        const head = days.slice(0, 7).map(function(d) { return '<div class="cal-wd">' + WEEKDAYS_SHORT[d.getDay()] + '</div>'; }).join('');
        const cells = days.map(function(d) {
            const ds = ymd(d);
            const h = hijriOf(d, adj);
            const ev = eventOf(h);
            const cls = ['cal-day'];
            if (d.getMonth() !== month) { cls.push('other'); }
            if (ds === todayStr()) { cls.push('today'); }
            if (ds === selected) { cls.push('sel'); }
            if (ev) { cls.push('event'); }
            return '<button type="button" class="' + cls.join(' ') + '" data-day="' + ds + '" aria-label="' + esc(ds + (ev ? ' ' + ev[1] : '')) + '">' +
                '<span class="cal-g">' + d.getDate() + '</span><span class="cal-h">' + (h ? h.day : '') + '</span>' +
                '<span class="cal-dots">' + (hasInc[ds] ? '<i class="d-in"></i>' : '') + (hasExp[ds] ? '<i class="d-out"></i>' : '') + (ev ? '<i class="d-ev"></i>' : '') + '</span></button>';
        }).join('');

        const sd = parseYmd(selected);
        const sh = hijriOf(sd, adj);
        const sev = eventOf(sh);
        const recs = dayRecords(selected);
        const rows = recs.inc.map(function(r) {
            return '<div class="row-between small"><span>' + incomeCat(r.type).icon + ' ' + esc(r.name) + (isTrustIncome(r.type) ? ' <span class="tag">amanah</span>' : '') + '</span><b class="up num">+' + fmt(r.amt) + '</b></div>';
        }).concat(recs.exp.map(function(r) {
            return '<div class="row-between small"><span>' + expenseCat(r.cat).icon + ' ' + esc(r.name) + '</span><b class="down num">−' + fmt(r.amt) + '</b></div>';
        })).join('');

        box.innerHTML =
            '<div class="row-between"><button type="button" class="pg-btn" data-cal="prev" aria-label="Previous month">◀</button>' +
            '<div class="center"><div class="cal-title">' + MONTH_NAMES[month] + ' ' + year + '</div>' +
            '<div class="hint">' + (mid ? mid.monthName + ' ' + mid.year + ' AH' : '') + '</div>' +
            '<button type="button" class="link-btn" data-cal="today">Today</button></div>' +
            '<button type="button" class="pg-btn" data-cal="next" aria-label="Next month">▶</button></div>' +
            '<div class="cal-grid">' + head + cells + '</div>' +
            '<div class="legend"><span class="legend-item"><i style="background:#1abc9c"></i>Income</span><span class="legend-item"><i style="background:#e74c3c"></i>Expense</span><span class="legend-item"><i style="background:#f0c040"></i>Islamic day</span></div>' +
            '<div class="card cal-sel"><div class="row-between"><b>' + WEEKDAYS_SHORT[sd.getDay()] + ', ' + pad(sd.getDate()) + ' ' + MONTHS_SHORT[sd.getMonth()] + ' ' + sd.getFullYear() + '</b>' +
            '<span class="muted small">' + esc(hijriText(sd, adj)) + '</span></div>' +
            (sev ? '<div class="banner banner-ok">' + sev[0] + ' <b>' + esc(sev[1]) + '</b></div>' : '') +
            (rows || '<div class="hint" style="margin-top:6px">No records on this day.</div>') + '</div>';
    }

    draw();
    return { redraw: draw };
}

/* ═══════════════════════════ CALCULATOR ═══════════════════════ */
export function mountCalculator(root) {
    let display = '0';
    let acc = null; /* stored left operand */
    let op = null;
    let fresh = true; /* next digit starts a new number */
    let history = '';

    const keys = [
        ['C', 'fn'], ['⌫', 'fn'], ['%', 'fn'], ['÷', 'op'],
        ['7'], ['8'], ['9'], ['×', 'op'],
        ['4'], ['5'], ['6'], ['−', 'op'],
        ['1'], ['2'], ['3'], ['+', 'op'],
        ['±', 'fn'], ['0'], ['.'], ['=', 'eq']
    ];
    root.innerHTML =
        '<div class="calc"><div class="calc-hist" id="calc-hist">&nbsp;</div><div class="calc-out num" id="calc-out">0</div>' +
        '<div class="calc-grid">' + keys.map(function(k) {
            return '<button type="button" class="calc-key ' + (k[1] || '') + '" data-k="' + k[0] + '">' + k[0] + '</button>';
        }).join('') + '</div>' +
        '<div class="calc-extra"><button type="button" class="btn btn-gold btn-sm" data-k="zakat">⚖️ Zakat 2.5%</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-k="rate">% of charity goal</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-k="inr">₹ format</button></div></div>';

    const out = root.querySelector('#calc-out');
    const hist = root.querySelector('#calc-hist');

    function show() {
        out.textContent = display;
        hist.innerHTML = history || '&nbsp;';
    }
    function value() { return parseFloat(display) || 0; }
    function clean(n) {
        const r = Math.round(n * 1e8) / 1e8;
        return String(r);
    }
    function apply(a, b, o) {
        if (o === '+') { return a + b; }
        if (o === '−') { return a - b; }
        if (o === '×') { return a * b; }
        if (o === '÷') { return b === 0 ? NaN : a / b; }
        return b;
    }

    function press(k) {
        if (/^[0-9]$/.test(k)) {
            display = fresh || display === '0' ? k : display + k;
            fresh = false;
        } else if (k === '.') {
            if (fresh) { display = '0.'; fresh = false; } else if (display.indexOf('.') < 0) { display += '.'; }
        } else if (k === 'C') {
            display = '0'; acc = null; op = null; fresh = true; history = '';
        } else if (k === '⌫') {
            if (!fresh) { display = display.length > 1 ? display.slice(0, -1) : '0'; }
        } else if (k === '±') {
            if (display !== '0') { display = display.charAt(0) === '-' ? display.slice(1) : '-' + display; }
        } else if (k === '%') {
            display = clean(acc !== null && (op === '+' || op === '−') ? acc * value() / 100 : value() / 100);
            fresh = true;
        } else if (k === '+' || k === '−' || k === '×' || k === '÷') {
            if (acc !== null && op && !fresh) {
                const r = apply(acc, value(), op);
                acc = r;
                display = isNaN(r) ? 'Error' : clean(r);
            } else {
                acc = value();
            }
            op = k;
            history = fmtNum(acc) + ' ' + k;
            fresh = true;
        } else if (k === '=') {
            if (op !== null && acc !== null) {
                const b = value();
                const r = apply(acc, b, op);
                history = fmtNum(acc) + ' ' + op + ' ' + fmtNum(b) + ' =';
                display = isNaN(r) ? 'Error' : clean(r);
                acc = null; op = null; fresh = true;
            }
        } else if (k === 'zakat') {
            const v = value();
            history = fmtNum(v) + ' × 2.5% (Zakat)';
            display = clean(v * 0.025); acc = null; op = null; fresh = true;
        } else if (k === 'rate') {
            const v = value();
            history = fmtNum(v) + ' × ' + store.prefs.charityRate + '% (charity goal)';
            display = clean(v * num(store.prefs.charityRate) / 100); acc = null; op = null; fresh = true;
        } else if (k === 'inr') {
            history = fmt(value());
        }
        if (display === 'Error') { acc = null; op = null; fresh = true; }
        show();
    }

    function fmtNum(n) { return (Math.round(n * 100) / 100).toLocaleString('en-IN'); }

    root.addEventListener('click', function(e) {
        const b = e.target.closest('[data-k]');
        if (b) { press(b.getAttribute('data-k')); }
    });
    root.addEventListener('keydown', function(e) {
        const map = { '*': '×', '/': '÷', '-': '−', Enter: '=', Backspace: '⌫', Escape: 'C' };
        const k = map[e.key] || e.key;
        if (/^[0-9.+=%]$/.test(k) || ['×', '÷', '−', '⌫', 'C'].indexOf(k) >= 0) {
            e.preventDefault();
            press(k);
        }
    });
    root.querySelector('.calc').setAttribute('tabindex', '0');
    show();
}

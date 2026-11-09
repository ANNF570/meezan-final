/* ============================================================
   MEEZAN — ميزان  |  js/core/utils.js
   Pure helpers: money, dates (LOCAL time — IST safe), Hijri, misc.

   RULE: never use toISOString() to get "today" or "this month".
   It returns UTC and shows the wrong day/month in India
   (UTC+5:30) between midnight and 5:30 AM. Use the helpers here.
   ============================================================ */

import { HIJRI_MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT } from './constants.js';

/* ── MONEY ─────────────────────────────────────────────────── */
export function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

export function fmt(n) {
    const v = Math.round(num(n));
    const sign = v < 0 ? '-' : '';
    return sign + '₹' + Math.abs(v).toLocaleString('en-IN');
}

function trim(x) {
    return (Math.round(x * 100) / 100).toString();
}

/* Short form for tight KPI cards: ₹1.25L, ₹3.4Cr, ₹12.5K */
export function fmtShort(n) {
    const v = num(n);
    const a = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (a >= 10000000) { return sign + '₹' + trim(a / 10000000) + 'Cr'; }
    if (a >= 100000) { return sign + '₹' + trim(a / 100000) + 'L'; }
    if (a >= 10000) { return sign + '₹' + trim(a / 1000) + 'K'; }
    return fmt(v);
}

export function fmtG(n) {
    return (Math.round(num(n) * 100) / 100).toFixed(2) + ' g';
}

export function pct(part, whole) {
    if (!whole) { return 0; }
    return (part / whole) * 100;
}

export function sum(arr, field) {
    let t = 0;
    for (let i = 0; i < arr.length; i++) {
        t += num(field ? arr[i][field] : arr[i]);
    }
    return t;
}

/* ── DATES (all LOCAL) ─────────────────────────────────────── */
export function pad(n) {
    return String(n).padStart(2, '0');
}

export function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function todayStr() {
    return ymd(new Date());
}

export function monthKeyOf(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

export function thisMonthKey() {
    return monthKeyOf(new Date());
}

export function parseYmd(s) {
    if (!s) { return null; }
    const p = String(s).slice(0, 10).split('-');
    if (p.length < 3) { return null; }
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

export function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
}

export function daysBetween(a, b) {
    const ms = 24 * 3600 * 1000;
    const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / ms);
}

/* Start of the week containing d. weekStart: 0 Sun, 1 Mon, 6 Sat */
export function startOfWeek(d, weekStart) {
    const ws = weekStart === undefined ? 1 : weekStart;
    const diff = (d.getDay() - ws + 7) % 7;
    return addDays(d, -diff);
}

export function fmtDay(s) {
    const d = typeof s === 'string' ? parseYmd(s) : s;
    if (!d) { return ''; }
    return pad(d.getDate()) + ' ' + MONTHS_SHORT[d.getMonth()];
}

export function fmtDayYear(s) {
    const d = typeof s === 'string' ? parseYmd(s) : s;
    if (!d) { return ''; }
    return pad(d.getDate()) + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}

export function weekdayShort(s) {
    const d = typeof s === 'string' ? parseYmd(s) : s;
    return d ? WEEKDAYS_SHORT[d.getDay()] : '';
}

export function monthLabel(key) {
    const p = String(key).split('-');
    return MONTHS_SHORT[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/* Last n month keys, oldest → newest, ending with the current month */
export function lastMonthKeys(n) {
    const now = new Date();
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
        keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return keys;
}

/* ── HIJRI (offline, via Intl — no network needed) ─────────── */
let hijriFormatter = null;
function getHijriFormatter() {
    if (hijriFormatter) { return hijriFormatter; }
    try {
        hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
            day: 'numeric', month: 'numeric', year: 'numeric'
        });
    } catch (e) {
        hijriFormatter = null;
    }
    return hijriFormatter;
}

/* adjust = days to add (−2…+2) so it matches your local moon sighting */
export function hijriOf(date, adjust) {
    const f = getHijriFormatter();
    if (!f) { return null; }
    const d = addDays(date, adjust || 0);
    const parts = f.formatToParts(d);
    const out = {};
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].type === 'day') { out.day = parseInt(parts[i].value, 10); }
        if (parts[i].type === 'month') { out.month = parseInt(parts[i].value, 10); }
        if (parts[i].type === 'year') { out.year = parseInt(parts[i].value, 10); }
    }
    if (!out.day || !out.month || !out.year) { return null; }
    out.monthName = HIJRI_MONTHS[out.month - 1];
    return out;
}

export function hijriText(date, adjust) {
    const h = hijriOf(date, adjust);
    if (!h) { return ''; }
    return h.day + ' ' + h.monthName + ' ' + h.year + ' AH';
}

/* Gregorian date of a Hijri day (searches around today) */
export function gregorianOfHijri(hYear, hMonth, hDay, adjust) {
    const start = new Date();
    for (let i = -400; i <= 800; i++) {
        const d = addDays(start, i);
        const h = hijriOf(d, adjust);
        if (h && h.year === hYear && h.month === hMonth && h.day === hDay) { return d; }
    }
    return null;
}

/* Next occurrence (today or later) of a Hijri month/day */
export function nextHijriDate(hMonth, hDay, adjust) {
    const today = new Date();
    const cur = hijriOf(today, adjust);
    if (!cur) { return null; }
    let target = gregorianOfHijri(cur.year, hMonth, hDay, adjust);
    if (!target || daysBetween(today, target) < 0) {
        target = gregorianOfHijri(cur.year + 1, hMonth, hDay, adjust);
    }
    return target;
}

/* ── STRINGS / MISC ────────────────────────────────────────── */
export function esc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function debounce(fn, ms) {
    let t = null;
    return function() {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(function() { fn.apply(null, args); }, ms);
    };
}

export function lsGet(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

export function lsSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) { /* blocked storage — ignore */ }
}

export function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
}

export function createdMs(r) {
    const c = r && r.createdAt;
    if (!c) { return 0; }
    if (typeof c.toMillis === 'function') { return c.toMillis(); }
    if (typeof c.seconds === 'number') { return c.seconds * 1000; }
    return 0;
}

/* Sort newest first: by date, then by creation time */
export function byNewest(a, b) {
    const da = a.date || '';
    const db = b.date || '';
    if (da !== db) { return da < db ? 1 : -1; }
    return createdMs(b) - createdMs(a);
}

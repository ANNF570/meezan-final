/* ============================================================
   MEEZAN — ميزان  |  js/utils.js
   Shared utilities: format, dates, metal prices, Hijri API
   ============================================================ */

// ═══════════════════════════════════════════════════════════════
// NUMBER / DATE FORMATTING
// ═══════════════════════════════════════════════════════════════

/** Format number as ₹ Indian Rupees */
export function fmt(n) {
    if (isNaN(n) || n === undefined) return '₹0';
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** Format grams with 2 decimal places */
export function fmtG(n) { return (+n || 0).toFixed(2) + 'g'; }

/** Today as YYYY-MM-DD */
export function today() { return new Date().toISOString().slice(0, 10); }

/** Current month as YYYY-MM */
export function thisMonth() { return new Date().toISOString().slice(0, 7); }

/** Filter array by current month */
export function filterMonth(arr, key = 'date') {
    const m = thisMonth();
    return arr.filter(x => (x[key] || '').slice(0, 7) === m);
}

/** Sum a numeric field in an array */
export function sumField(arr, field) {
    return arr.reduce((s, x) => s + (parseFloat(x[field]) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════
// THEME MANAGER
// ═══════════════════════════════════════════════════════════════

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meezan-theme', theme);
}

export function loadTheme() {
    const t = localStorage.getItem('meezan-theme') || 'glass';
    applyTheme(t);
    return t;
}

// ═══════════════════════════════════════════════════════════════
// METAL PRICE CONSTANTS & CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/** Gold price per gram by karat (24K base × ratio) */
export const KARAT_RATIO = { 24: 1, 22: 22 / 24, 18: 18 / 24, 14: 14 / 24 };

/** Nisab thresholds */
export const NISAB_SILVER_G = 595; // 595g silver
export const NISAB_GOLD_G = 85; // 85g gold (24K pure)

/** Fallback prices (update if API fails) */
export const FALLBACK_PRICES = { gold24: 6842, silver: 82 };

/** Get gold price for a specific karat */
export function goldPriceByKarat(gold24, karat) {
    return Math.round(gold24 * (KARAT_RATIO[karat] || KARAT_RATIO[22]));
}

/** Present value of one ornament */
export function presentVal(o, gold24, silverPg) {
    const gv = (o.goldG || 0) * goldPriceByKarat(gold24, o.goldK || 22);
    const sv = (o.silvG || 0) * silverPg;
    return Math.round(gv + sv + (o.diamV || 0) + (o.stonV || 0) + (o.makeV || 0));
}

/** Zakat-eligible metal value (gold + silver only, NOT diamonds/stones) */
export function zakatMetalVal(o, gold24, silverPg) {
    const gv = (o.goldG || 0) * goldPriceByKarat(gold24, o.goldK || 22);
    const sv = (o.silvG || 0) * silverPg;
    return Math.round(gv + sv);
}

/** Check if nisab met */
export function nisabMet(totalMetalVal, silverPg) {
    return totalMetalVal >= Math.round(NISAB_SILVER_G * silverPg);
}

/** Calculate Zakat due (2.5% if nisab met) */
export function calcZakat(totalMetalVal, silverPg) {
    return nisabMet(totalMetalVal, silverPg) ? Math.round(totalMetalVal * 0.025) : 0;
}

// ═══════════════════════════════════════════════════════════════
// LIVE GOLD / SILVER PRICES
// Fetches from GoldAPI.io, caches in Firestore (once per day)
// ═══════════════════════════════════════════════════════════════

import { getMetalCache, saveMetalCache } from './firebase-config.js';

/**
 * Get metal prices:
 *  1. Check Firestore cache (refreshed every 23h)
 *  2. If stale, fetch from GoldAPI.io
 *  3. Update cache
 *  4. Fallback to hardcoded values if API fails
 */
export async function getMetalPrices() {
    try {
        // 1. Check cache
        const cache = await getMetalCache();
        if (cache && cache.updatedAt) {
            const updated = cache.updatedAt.toDate ? cache.updatedAt.toDate() : new Date(cache.updatedAt);
            const hoursOld = (Date.now() - updated.getTime()) / 3600000;
            if (hoursOld < 23) return { gold24: cache.gold24, silver: cache.silver, source: 'cache' };
        }

        // 2. Fetch live (GoldAPI.io free tier — ~100 req/month)
        // Sign up at https://goldapi.io/ and replace this key:
        const GOLD_API_KEY = 'demo'; // <-- Replace with your GoldAPI key
        if (GOLD_API_KEY === 'demo') return FALLBACK_PRICES;

        const [gRes, sRes] = await Promise.all([
            fetch('https://www.goldapi.io/api/XAU/INR', { headers: { 'x-access-token': GOLD_API_KEY } }),
            fetch('https://www.goldapi.io/api/XAG/INR', { headers: { 'x-access-token': GOLD_API_KEY } }),
        ]);
        const gData = await gRes.json();
        const sData = await sRes.json();

        // API returns per troy oz → divide by 31.1035 for per gram
        const gold24 = Math.round(gData.price / 31.1035);
        const silver = Math.round(sData.price / 31.1035);
        const prices = { gold24, silver, source: 'api' };

        // 3. Save to cache
        await saveMetalCache(prices);
        return prices;

    } catch (err) {
        console.warn('Metal API failed, using fallback:', err);
        return FALLBACK_PRICES;
    }
}

// ═══════════════════════════════════════════════════════════════
// HIJRI CALENDAR  —  Aladhan API (FREE, no key needed)
// ═══════════════════════════════════════════════════════════════

const ALADHAN = 'https://api.aladhan.com/v1';

/**
 * Get today's date in both Gregorian and Hijri
 * Returns: { gregorian: {...}, hijri: {...} }
 */
export async function getTodayBothCalendars() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const greg = {
        day: now.getDate(),
        month: now.toLocaleString('en', { month: 'long' }),
        year: yyyy,
        weekday: now.toLocaleString('en', { weekday: 'long' }),
        iso: `${yyyy}-${mm}-${dd}`,
    };

    try {
        const res = await fetch(`${ALADHAN}/gToH/${dd}-${mm}-${yyyy}`);
        const json = await res.json();
        const h = json.data ? .hijri;

        return {
            gregorian: greg,
            hijri: h ? {
                day: h.day,
                month: h.month.en,
                monthAr: h.month.ar,
                year: h.year,
                weekday: h.weekday.en,
                weekdayAr: h.weekday.ar,
            } : null,
        };
    } catch {
        return { gregorian: greg, hijri: null };
    }
}

/**
 * Get Islamic events for a Hijri year
 */
export function islamicEvents(hijriYear) {
    return [
        { name: 'Islamic New Year', icon: '🌙', hijriMonth: 1, day: 1 },
        { name: 'Ashura', icon: '🤲', hijriMonth: 1, day: 10 },
        { name: "Mawlid al-Nabi ﷺ", icon: '🕌', hijriMonth: 3, day: 12 },
        { name: 'Ramadan begins', icon: '🌙', hijriMonth: 9, day: 1 },
        { name: "Laylatul Qadr", icon: '✨', hijriMonth: 9, day: 27 },
        { name: 'Eid ul-Fitr', icon: '🎉', hijriMonth: 10, day: 1 },
        { name: 'Eid ul-Adha', icon: '🐑', hijriMonth: 12, day: 10 },
        { name: 'Dhul Hijjah begins', icon: '📅', hijriMonth: 12, day: 1 },
    ];
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY MAPS
// ═══════════════════════════════════════════════════════════════

export const INCOME_ICONS = {
    Salary: '💼',
    Freelance: '💻',
    Rental: '🏠',
    Business: '🏪',
    Investment: '📈',
    Gift: '🎁',
    Other: '💡'
};
export const INCOME_CLS = {
    Salary: 'ib-sal',
    Freelance: 'ib-free',
    Rental: 'ib-rent',
    Business: 'ib-biz',
    Investment: 'ib-inv',
    Gift: 'ib-gift',
    Other: 'ib-misc'
};
export const EXP_ICONS = {
    Food: '🍽️',
    Shopping: '🛍️',
    Transport: '🚆',
    Utilities: '💡',
    Charity: '🤲',
    Entertainment: '🎬',
    Education: '📚',
    Health: '🏥',
    Zakat: '⚖️',
    Other: '💰'
};
export const EXP_CLS = {
    Food: 'ib-food',
    Shopping: 'ib-shop',
    Transport: 'ib-tran',
    Utilities: 'ib-util',
    Charity: 'ib-char',
    Entertainment: 'ib-ent',
    Education: 'ib-edu',
    Health: 'ib-hlth',
    Zakat: 'ib-char',
    Other: 'ib-misc'
};
export const CAT_COLORS = {
    Food: '#e74c3c',
    Shopping: '#9b59b6',
    Transport: '#3498db',
    Utilities: '#e67e22',
    Charity: '#1abc9c',
    Entertainment: '#e74c3c',
    Education: '#2ecc71',
    Health: '#1abc9c',
    Zakat: '#48d1b0',
    Other: '#95a5a6'
};
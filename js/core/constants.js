/* ============================================================
   MEEZAN — ميزان  |  js/core/constants.js
   Shared constants: account types, categories, defaults.

   IMPORTANT: income `type` and expense `cat` are stored in Firestore
   as the LABEL string (e.g. "Salary", "Food") exactly like version 1,
   so all old records keep working. New labels were only ADDED.
   ============================================================ */

export const APP_NAME = 'Meezan';
export const CREDIT_NAME = 'Akif Nehal';
export const CREDIT_URL = 'https://www.linkedin.com/in/akif-nehal/';

/* ── ACCOUNT TYPES ────────────────────────────────────────────
   The four balance categories shown as KPI cards.
   You can add many accounts under each type (e.g. 2 bank accounts). */
export const ACCOUNT_TYPES = {
    cash: { id: 'cash', label: 'Cash', long: 'Cash in hand', icon: '💵', color: '#1abc9c', hint: 'Wallet / money you carry' },
    bank: { id: 'bank', label: 'Bank', long: 'Bank balance', icon: '🏦', color: '#5dade2', hint: 'Savings / current account' },
    cashSaving: { id: 'cashSaving', label: 'Cash Savings', long: 'Cash savings', icon: '🏺', color: '#d4a017', hint: 'Physical cash kept aside (gullak, home safe)' },
    onlineSaving: { id: 'onlineSaving', label: 'Online Savings', long: 'Online savings', icon: '📲', color: '#a569bd', hint: 'FD, RD, wallet, savings apps, mutual funds' }
};
export const ACCOUNT_TYPE_ORDER = ['cash', 'bank', 'cashSaving', 'onlineSaving'];

/* ── INCOME CATEGORIES ────────────────────────────────────────
   trust:true  → money held for someone else (amanah).
   It is NOT counted as your income and is deducted from net worth/Zakat
   (can be switched off in Settings). */
export const INCOME_CATS = [
    { label: 'Salary', icon: '💼', color: '#1abc9c' },
    { label: 'Business', icon: '🏪', color: '#c0392b' },
    { label: 'Freelance', icon: '💻', color: '#d4a017' },
    { label: 'Rental', icon: '🏠', color: '#5dade2' },
    { label: 'Investment', icon: '📈', color: '#9b59b6' },
    { label: 'From Home', icon: '🏡', color: '#e67e22' },
    { label: 'Friends (to save)', icon: '🤝', color: '#48d1b0', trust: true },
    { label: 'Gift', icon: '🎁', color: '#e84393' },
    { label: 'Eidi', icon: '🌙', color: '#f0c040' },
    { label: 'Bonus', icon: '⭐', color: '#ffb142' },
    { label: 'Refund', icon: '↩️', color: '#7f8fa6' },
    { label: 'Other', icon: '💡', color: '#95a5a6' }
];

/* ── EXPENSE CATEGORIES ───────────────────────────────────────
   group = optgroup name in the form.  legacy:true = old label kept
   only so version-1 records still display correctly. */
export const EXPENSE_CATS = [
    { label: 'Rent', icon: '🏠', color: '#e17055', group: 'Fixed & monthly' },
    { label: 'EMI / Loan', icon: '🏧', color: '#d63031', group: 'Fixed & monthly' },
    { label: 'Bills', icon: '💡', color: '#e67e22', group: 'Fixed & monthly' },
    { label: 'Mobile & Internet', icon: '📶', color: '#0984e3', group: 'Fixed & monthly' },
    { label: 'Insurance', icon: '🛡️', color: '#6c5ce7', group: 'Fixed & monthly' },
    { label: 'Subscriptions', icon: '🔁', color: '#a29bfe', group: 'Fixed & monthly' },
    { label: 'Food', icon: '🍽️', color: '#e74c3c', group: 'Daily life' },
    { label: 'Groceries', icon: '🛒', color: '#27ae60', group: 'Daily life' },
    { label: 'Transport', icon: '🚆', color: '#3498db', group: 'Daily life' },
    { label: 'Fuel', icon: '⛽', color: '#636e72', group: 'Daily life' },
    { label: 'Health', icon: '🏥', color: '#00b894', group: 'Daily life' },
    { label: 'Education', icon: '📚', color: '#2ecc71', group: 'Daily life' },
    { label: 'Shopping', icon: '🛍️', color: '#9b59b6', group: 'Lifestyle' },
    { label: 'Entertainment', icon: '🎬', color: '#f39c12', group: 'Lifestyle' },
    { label: 'Travel', icon: '✈️', color: '#00cec9', group: 'Lifestyle' },
    { label: 'Family / Home', icon: '🏡', color: '#fd79a8', group: 'Family & friends' },
    { label: 'Gifts', icon: '🎁', color: '#e84393', group: 'Family & friends' },
    { label: 'Returned to Friend', icon: '🤝', color: '#48d1b0', group: 'Family & friends', trustReturn: true },
    { label: 'Charity', icon: '🤲', color: '#1abc9c', group: 'Giving', giving: 'sadaqah' },
    { label: 'Zakat', icon: '⚖️', color: '#48d1b0', group: 'Giving', giving: 'zakat' },
    { label: 'Other', icon: '💰', color: '#95a5a6', group: 'Other' },
    { label: 'Utilities', icon: '💡', color: '#e67e22', group: 'Other', legacy: true }
];

export const INCOME_BY_LABEL = {};
INCOME_CATS.forEach(function(c) { INCOME_BY_LABEL[c.label] = c; });
export const EXPENSE_BY_LABEL = {};
EXPENSE_CATS.forEach(function(c) { EXPENSE_BY_LABEL[c.label] = c; });

const FALLBACK_INCOME = { label: 'Other', icon: '💡', color: '#95a5a6' };
const FALLBACK_EXPENSE = { label: 'Other', icon: '💰', color: '#95a5a6' };
export function incomeCat(label) { return INCOME_BY_LABEL[label] || FALLBACK_INCOME; }
export function expenseCat(label) { return EXPENSE_BY_LABEL[label] || FALLBACK_EXPENSE; }
export function isTrustIncome(label) { return !!(INCOME_BY_LABEL[label] && INCOME_BY_LABEL[label].trust); }
export function isTrustReturn(label) { return !!(EXPENSE_BY_LABEL[label] && EXPENSE_BY_LABEL[label].trustReturn); }
export function givingKind(label) { return (EXPENSE_BY_LABEL[label] && EXPENSE_BY_LABEL[label].giving) || ''; }

/* ── DEFAULT PREFERENCES (saved at users/{uid}/settings/prefs) ── */
export const DEFAULT_PREFS = {
    theme: 'glass',
    language: 'en',
    currency: 'INR',
    weekStart: 1, /* 0 = Sunday, 1 = Monday, 6 = Saturday */
    charityRate: 2.5, /* % of income you aim to give */
    zakatRate: 2.5,
    nisabBasis: 'silver', /* silver (595 g) or gold (85 g) */
    deductTrust: true, /* subtract friends' money from net worth + Zakat */
    hijriAdjust: 0, /* -2 … +2 days, to match local moon sighting */
    goldPrice: 6842, /* ₹ per gram 24K */
    silverPrice: 82, /* ₹ per gram */
    pricesUpdated: '',
    hawlStart: '',
    zakatDebts: 0,
    pageSize: 10
};

export const NISAB_SILVER_G = 595;
export const NISAB_GOLD_G = 85;
export const KARAT_RATIO = { 24: 1, 22: 22 / 24, 18: 18 / 24, 14: 14 / 24 };

export const HIJRI_MONTHS = [
    'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'
];

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ============================================================
   MEEZAN — ميزان  |  js/core/shell.js
   The app frame shared by EVERY page:
     • always-visible sidebar (full on laptop, icon rail on tablet,
       slim rail on phone — never a hamburger or drawer)
     • top bar with Gregorian + Hijri date and profile avatar
     • credit footer (Akif Nehal · LinkedIn)
     • auth guard — Firestore starts ONLY after onAuthStateChanged
     • theme + language + PWA install + "new version" prompt

   A page does:
       boot({ page:'income', navKey:'income', title:'Income',
              needs:['income','accounts'] }, function(ctx) { … });
   ============================================================ */

import { auth, db, doc, getDoc, onAuthStateChanged } from './firebase.js';
import { store, startStore, subscribe, isReady, saveProfile, savePrefs } from './store.js';
import { CREDIT_NAME, CREDIT_URL } from './constants.js';
import { esc, hijriText, lsGet, lsSet } from './utils.js';
import { toast } from './ui.js';

const NAV = [
    { section: 'Main' },
    { key: 'dashboard', href: 'dashboard.html', icon: '⚖️', label: 'Dashboard', short: 'Home', i18n: 'dashboard' },
    { key: 'income', href: 'income.html', icon: '💰', label: 'Income', short: 'Income', i18n: 'income' },
    { key: 'expenses', href: 'expenses.html', icon: '💸', label: 'Expenses', short: 'Spend', i18n: 'expenses' },
    { key: 'assets', href: 'assets.html', icon: '🏅', label: 'Accounts & Assets', short: 'Assets' },
    { key: 'loans', href: 'loans.html', icon: '🤝', label: 'Friends & Loans', short: 'Friends' },
    { section: 'Islamic' },
    { key: 'zakat', href: 'zakat.html', icon: '🕌', label: 'Zakat & Sadaqah', short: 'Zakat' },
    { key: 'eid', href: 'eid.html', icon: '🌙', label: 'Eid & Ramadan', short: 'Eid' },
    { section: 'Insights' },
    { key: 'reports', href: 'reports.html', icon: '📈', label: 'Reports', short: 'Reports' },
    { key: 'export', href: 'export.html', icon: '📤', label: 'Export', short: 'Export' },
    { key: 'import', href: 'import.html', icon: '📥', label: 'Import', short: 'Import' },
    { section: 'Social' },
    { key: 'family', href: 'family.html', icon: '👨‍👩‍👧', label: 'Family & Groups', short: 'Family' },
    { section: 'You' },
    { key: 'settings', href: 'settings.html', icon: '⚙️', label: 'Settings & Profile', short: 'Settings', i18n: 'settings' }
];

const THEMES = ['glass', 'hell', 'heaven', 'marble'];
let deferredInstall = null;

/* ── THEME ──────────────────────────────────────────────────── */
export function applyTheme(theme) {
    const t = THEMES.indexOf(theme) >= 0 ? theme : 'glass';
    document.documentElement.setAttribute('data-theme', t);
    lsSet('meezan-theme', t);
    document.querySelectorAll('[data-theme-pick]').forEach(function(p) {
        p.classList.toggle('active', p.getAttribute('data-theme-pick') === t);
    });
    const lbl = document.getElementById('theme-label');
    if (lbl) { lbl.textContent = t.charAt(0).toUpperCase() + t.slice(1); }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', t === 'marble' ? '#f0ede8' : '#0b0f18'); }
}
applyTheme(lsGet('meezan-theme', 'glass'));

/* ── PWA INSTALL ────────────────────────────────────────────── */
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstall = e;
    document.querySelectorAll('[data-install]').forEach(function(b) { b.hidden = false; });
});
window.addEventListener('appinstalled', function() {
    deferredInstall = null;
    document.querySelectorAll('[data-install]').forEach(function(b) { b.hidden = true; });
    toast('Meezan installed 🎉', 'ok');
});

export async function installApp() {
    if (!deferredInstall) { return false; }
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
    deferredInstall = null;
    return true;
}
export function canInstall() { return !!deferredInstall; }

/* ── SERVICE WORKER + "NEW VERSION" PROMPT ──────────────────── */
let updateToastShown = false;
function showUpdateToast() {
    if (updateToastShown) { return; }
    updateToastShown = true;
    toast('A new version of Meezan is ready.', 'info', 0, { label: 'Update now', onClick: function() { location.reload(); } });
}

function setupUpdates() {
    if ('serviceWorker' in navigator) {
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
            reg.addEventListener('updatefound', function() {
                const nw = reg.installing;
                if (!nw) { return; }
                nw.addEventListener('statechange', function() {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) { showUpdateToast(); }
                });
            });
            document.addEventListener('visibilitychange', function() {
                if (document.visibilityState === 'visible') {
                    reg.update().catch(function() {});
                    checkVersionFile();
                }
            });
            setInterval(function() { reg.update().catch(function() {}); }, 30 * 60 * 1000);
        }).catch(function(err) { console.warn('Service worker not registered:', err.message); });
        navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (hadController) { showUpdateToast(); }
        });
    }
    checkVersionFile();
}

/* Safety net: /version.json is re-stamped on every Vercel deploy */
async function checkVersionFile() {
    try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) { return; }
        const v = await res.json();
        const seen = lsGet('meezan-version', '');
        lsSet('meezan-version', String(v.version));
        if (seen && seen !== String(v.version)) { showUpdateToast(); }
    } catch (e) { /* offline */ }
}

/* ── CHROME ─────────────────────────────────────────────────── */
const LOGO_SVG =
    '<svg viewBox="0 0 60 60" fill="none" aria-hidden="true">' +
    '<defs><linearGradient id="mzg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f0c040"/>' +
    '<stop offset="100%" stop-color="#a07010"/></linearGradient></defs>' +
    '<rect x="28" y="26" width="4" height="24" rx="2" fill="url(#mzg)"/>' +
    '<ellipse cx="30" cy="52" rx="14" ry="4" fill="url(#mzg)" opacity=".9"/>' +
    '<circle cx="30" cy="10" r="4" fill="url(#mzg)"/>' +
    '<rect x="8" y="18" width="44" height="3" rx="1.5" fill="url(#mzg)"/>' +
    '<line x1="14" y1="21" x2="12" y2="32" stroke="#d4a017" stroke-width="1" stroke-dasharray="2,2"/>' +
    '<ellipse cx="12" cy="34" rx="8" ry="3" fill="url(#mzg)" opacity=".85"/>' +
    '<line x1="46" y1="21" x2="48" y2="28" stroke="#d4a017" stroke-width="1" stroke-dasharray="2,2"/>' +
    '<ellipse cx="48" cy="30" rx="8" ry="3" fill="url(#mzg)" opacity=".85"/></svg>';

function navHtml(activeKey) {
    let html = '';
    NAV.forEach(function(item) {
        if (item.section) { html += '<span class="nav-section">' + esc(item.section) + '</span>'; return; }
        const active = item.key === activeKey;
        html += '<a class="nav-item' + (active ? ' active' : '') + '" href="' + item.href + '" title="' + esc(item.label) + '"' +
            (active ? ' aria-current="page"' : '') + '>' +
            '<span class="nav-icon">' + item.icon + '</span>' +
            '<span class="nav-label"' + (item.i18n ? ' data-i18n="' + item.i18n + '"' : '') + '>' + esc(item.label) + '</span>' +
            '<span class="nav-short">' + esc(item.short) + '</span></a>';
    });
    return html;
}

function buildChrome(config) {
    const app = document.getElementById('app');
    const main = document.getElementById('main');
    const page = document.getElementById('page');
    if (!app || !main || !page) { console.error('Page must contain #app > #main > #page'); return; }

    if (!document.querySelector('.bg-scene')) {
        const bg = document.createElement('div');
        bg.className = 'bg-scene';
        let parts = '<div class="bg-glow bg-glow-a"></div><div class="bg-glow bg-glow-b"></div><div class="particles" aria-hidden="true">';
        for (let i = 0; i < 30; i++) {
            const left = i < 18 ? Math.random() * 45 : Math.random() * 100;
            parts += '<div class="particle ' + (i < 18 ? 'p-fire' : 'p-star') + '" style="left:' + left.toFixed(1) + '%;animation-duration:' + (4 + Math.random() * 8).toFixed(1) + 's;animation-delay:' + (Math.random() * 6).toFixed(1) + 's"></div>';
        }
        bg.innerHTML = parts + '</div>';
        document.body.insertBefore(bg, document.body.firstChild);
    }

    const rail = document.createElement('aside');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'Main navigation');
    rail.innerHTML =
        '<a class="brand" href="dashboard.html" title="Meezan">' +
        '<span class="brand-mark">' + LOGO_SVG + '</span>' +
        '<span class="brand-name">MEEZAN</span><span class="brand-ar">ميزان</span></a>' +
        '<nav class="nav">' + navHtml(config.navKey || config.page) + '</nav>' +
        '<div class="rail-foot">' +
        '<button type="button" class="install-btn" data-install hidden>⬇️ <span>Install app</span></button>' +
        '<div class="theme-pills" role="group" aria-label="Theme">' +
        THEMES.map(function(t) {
            return '<button type="button" class="theme-pill tp-' + t + '" data-theme-pick="' + t + '" title="' + t + '" aria-label="' + t + ' theme"></button>';
        }).join('') + '</div>' +
        '<div class="theme-label" id="theme-label"></div>' +
        '<a class="credit-mini" href="' + CREDIT_URL + '" target="_blank" rel="noopener noreferrer" title="Built by ' + CREDIT_NAME + ' — LinkedIn">' +
        '<span class="credit-in">in</span><span class="credit-txt">by ' + CREDIT_NAME + '</span></a>' +
        '</div>';
    app.insertBefore(rail, main);

    const top = document.createElement('header');
    top.className = 'topbar';
    top.innerHTML =
        '<div class="tb-left"><div class="tb-bismillah">بِسْمِ اللَّهِ</div>' +
        '<h1 class="tb-title" id="page-title">' + esc(config.title || 'Meezan') + '</h1>' +
        '<div class="tb-sub" id="tb-sub"></div></div>' +
        '<div class="tb-right"><div id="tb-actions" class="tb-actions"></div>' +
        '<a class="avatar" id="avatar" href="settings.html#profile" title="Profile & settings" aria-label="Profile">M</a></div>';
    main.insertBefore(top, page);

    const foot = document.createElement('footer');
    foot.className = 'foot';
    foot.innerHTML =
        '<span>Designed &amp; built by <a href="' + CREDIT_URL + '" target="_blank" rel="noopener noreferrer"><strong>' + CREDIT_NAME + '</strong></a></span>' +
        '<span class="foot-dot">·</span>' +
        '<a href="' + CREDIT_URL + '" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>' +
        '<span class="foot-dot">·</span><span>Meezan v2</span>';
    main.appendChild(foot);

    applyTheme(lsGet('meezan-theme', 'glass'));

    rail.addEventListener('click', function(e) {
        const pill = e.target.closest('[data-theme-pick]');
        if (pill) {
            const t = pill.getAttribute('data-theme-pick');
            applyTheme(t);
            if (store.uid) { savePrefs({ theme: t }).catch(function() {}); }
            return;
        }
        if (e.target.closest('[data-install]')) { installApp(); }
    });

    const act = rail.querySelector('.nav-item.active');
    if (act && act.scrollIntoView) { setTimeout(function() { act.scrollIntoView({ block: 'nearest' }); }, 50); }
    if (deferredInstall) { rail.querySelector('[data-install]').hidden = false; }
}

function applyLanguageFromPrefs(prefs) {
    const code = prefs.language || 'en';
    const saved = lsGet('meezan-lang', 'en');
    if (code !== saved) { lsSet('meezan-lang', code); }
    if (typeof window.applyLanguage === 'function' && window.MEEZAN_TRANSLATIONS && (code !== 'en' || saved !== 'en')) {
        window.applyLanguage(code);
    }
}

function paintHeader(prefs, user) {
    const now = new Date();
    const g = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const h = hijriText(now, prefs.hijriAdjust);
    const sub = document.getElementById('tb-sub');
    if (sub) { sub.textContent = g + (h ? '  ·  ' + h : ''); }
    const av = document.getElementById('avatar');
    if (av && user) {
        const photo = (store.profile && store.profile.photoURL) || user.photoURL;
        const name = (store.profile && store.profile.name) || user.displayName || user.email || 'M';
        if (photo) {
            av.innerHTML = '<img src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">';
        } else {
            av.textContent = String(name).substring(0, 2).toUpperCase();
        }
    }
}

function setBanner(html) {
    let b = document.getElementById('shell-banner');
    if (!html) { if (b) { b.remove(); } return; }
    if (!b) {
        b = document.createElement('div');
        b.id = 'shell-banner';
        b.className = 'banner banner-warn';
        const page = document.getElementById('page');
        page.parentNode.insertBefore(b, page);
    }
    b.innerHTML = html;
}

async function syncProfile(user) {
    const patch = { email: user.email || '', lastLogin: new Date().toISOString() };
    const snap = await getDoc(doc(db, 'users', user.uid));
    const existing = snap.exists() ? snap.data() : {};
    if (!existing.name) { patch.name = user.displayName || ''; }
    if (!existing.photoURL) { patch.photoURL = user.photoURL || ''; }
    await saveProfile(patch);
}

/* ── BOOT ───────────────────────────────────────────────────── */
export function boot(config, init) {
    /* friends & loans change account balances, so every page loads them */
    config.needs = (config.needs || []).filter(function(n) { return n !== 'loans'; }).concat(['loans']);
    let started = false;
    let initialised = false;

    function start() {
        buildChrome(config);
        setupUpdates();

        onAuthStateChanged(auth, function(user) {
            if (!user) { location.href = '../index.html'; return; }
            if (started) { return; }
            started = true;

            const ctx = {
                uid: user.uid,
                user: user,
                store: store,
                setActions: function(html) {
                    const el = document.getElementById('tb-actions');
                    if (el) { el.innerHTML = html; }
                }
            };

            startStore(user.uid, config.needs);
            syncProfile(user).catch(function(e) { console.warn('profile sync failed', e.code || e.message); });

            subscribe(function() {
                paintHeader(store.prefs, user);
                applyTheme(store.prefs.theme || lsGet('meezan-theme', 'glass'));
                applyLanguageFromPrefs(store.prefs);

                const denied = Object.keys(store.errors).filter(function(k) {
                    return store.errors[k] && store.errors[k].code === 'permission-denied';
                });
                setBanner(denied.length ?
                    '<strong>Firestore blocked access.</strong> Your security rules need updating — open ' +
                    '<em>Firebase Console → Firestore → Rules</em> and paste the rules from <code>firestore.rules</code>.' : '');

                if (!initialised && isReady(config.needs || [])) {
                    initialised = true;
                    const skel = document.getElementById('page-loading');
                    if (skel) { skel.remove(); }
                    init(ctx);
                }
            });
        });
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
}

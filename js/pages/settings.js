/* ============================================================
   MEEZAN — ميزان  |  js/pages/settings.js
   Settings & Profile: profile · preferences · giving goal ·
   Calendar · Calculator · About (credit to Akif Nehal).
   ============================================================ */

import { boot, applyTheme, installApp, canInstall } from '../core/shell.js';
import { store, subscribe, savePrefs, saveProfile } from '../core/store.js';
import { auth, signOut } from '../core/firebase.js';
import { CREDIT_NAME, CREDIT_URL } from '../core/constants.js';
import { esc, lsSet } from '../core/utils.js';
import { toast } from '../core/ui.js';
import { mountCalendar, mountCalculator } from '../core/tools.js';


boot({
    page: 'settings',
    navKey: 'settings',
    title: 'Settings & Profile',
    needs: ['income', 'expenses']
}, function(ctx) {
    const page = document.getElementById('page');
    const TABS = [['profile', '👤 Profile'], ['prefs', '🎛️ Preferences'], ['lang', '🌐 Language'], ['giving', '🤲 Giving'], ['calendar', '📅 Calendar'], ['calc', '🧮 Calculator'], ['about', 'ℹ️ About']];

    page.innerHTML =
        '<div class="tabbar" id="s-tabs" role="tablist">' + TABS.map(function(t) {
            return '<button type="button" class="tab" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' +

        '<div class="card tab-panel" data-panel="profile"><div class="card-title">👤 Your profile</div>' +
        '<div class="form-grid">' +
        '<div class="field"><label for="p-name">Name</label><input type="text" id="p-name" maxlength="60"></div>' +
        '<div class="field"><label for="p-email">Email</label><input type="email" id="p-email" disabled></div>' +
        '<div class="field"><label for="p-phone">Phone (optional)</label><input type="tel" id="p-phone" maxlength="20"></div>' +
        '<div class="field"><label for="p-city">City (optional)</label><input type="text" id="p-city" maxlength="40"></div>' +
        '</div><div class="form-actions"><button type="button" class="btn btn-teal" data-save="profile">Save profile</button>' +
        '<button type="button" class="btn btn-fire" data-act="signout">Sign out</button></div></div>' +

        '<div class="card tab-panel" data-panel="prefs" hidden><div class="card-title">🎛️ Preferences</div>' +
        '<div class="field"><span class="field-label">Theme</span><div class="chips" id="s-themes">' +
        ['glass', 'hell', 'heaven', 'marble'].map(function(t) { return '<button type="button" class="chip" data-theme="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('') + '</div></div>' +
        '<div class="form-grid" style="margin-top:8px">' +
        '<div class="field"><label for="s-week">Week starts on</label><select id="s-week"><option value="1">Monday</option><option value="0">Sunday</option><option value="6">Saturday</option></select></div>' +
        '<div class="field"><label for="s-hadj">Hijri date adjustment</label><select id="s-hadj"><option value="-2">−2 days</option><option value="-1">−1 day</option><option value="0">0 (default)</option><option value="1">+1 day</option><option value="2">+2 days</option></select></div>' +
        '<div class="field"><label for="s-nisab">Nisab based on</label><select id="s-nisab"><option value="silver">Silver — 595 g (safer)</option><option value="gold">Gold — 85 g</option></select></div>' +
        '<div class="field"><label for="s-zrate">Zakat rate (%)</label><input type="number" id="s-zrate" min="0" step="any" inputmode="decimal"></div>' +
        '<div class="field"><label class="check" for="s-trust"><input type="checkbox" id="s-trust"> Deduct friends\' money from net worth &amp; Zakat</label></div>' +
        '</div><div class="form-actions"><button type="button" class="btn btn-teal" data-save="prefs">Save preferences</button>' +
        '<button type="button" class="btn btn-gold" data-act="install" hidden>⬇️ Install app</button></div></div>' +

        '<div class="card tab-panel" data-panel="lang" hidden><div class="card-title">🌐 Language</div>' +
        '<p class="hint">Pick your language. It is saved to your account, so it is the same on your phone and laptop. Menus, titles and key words change; Arabic, Urdu and Persian switch the page to right-to-left.</p>' +
        '<div class="lang-grid" id="s-langs">' + (window.MEEZAN_LANGS || []).map(function(l) {
            return '<button type="button" class="lang-opt" data-lang="' + l.code + '"><span class="lang-flag">' + l.flag + '</span><span class="lang-n">' + esc(l.native) + '</span><span class="lang-e">' + esc(l.english) + (l.rtl ? ' · RTL' : '') + '</span></button>';
        }).join('') + '</div></div>' +

        '<div class="card tab-panel" data-panel="giving" hidden><div class="card-title">🤲 Charity goal</div>' +
        '<div class="form-grid" style="--fmin:200px"><div class="field"><label for="s-crate">Give this % of your income</label>' +
        '<input type="number" id="s-crate" min="0" max="100" step="any" inputmode="decimal"></div></div>' +
        '<p class="hint">Default is 2.5%. Meezan checks it two ways — for this month, and for your total income — and warns you on the Dashboard and the Zakat &amp; Sadaqah page when you are below it. Friends\' money is never counted as income.</p>' +
        '<div class="form-actions"><button type="button" class="btn btn-teal" data-save="giving">Save goal</button></div></div>' +

        '<div class="card tab-panel" data-panel="calendar" hidden><div class="card-title">📅 Calendar</div><div id="s-cal"></div></div>' +
        '<div class="card tab-panel" data-panel="calc" hidden><div class="card-title">🧮 Calculator</div><div id="s-calc"></div></div>' +

        '<div class="card tab-panel" data-panel="about" hidden><div class="card-title">ℹ️ About Meezan</div>' +
        '<p>Meezan (ميزان — “the balance”) is an Islamic personal-finance app: budgeting, Zakat, Sadaqah, Eid savings and family expenses in one place.</p>' +
        '<p>Designed &amp; built by <a href="' + CREDIT_URL + '" target="_blank" rel="noopener noreferrer"><strong>' + CREDIT_NAME + '</strong></a>.</p>' +
        '<div class="form-actions"><a class="btn btn-ghost" href="' + CREDIT_URL + '" target="_blank" rel="noopener noreferrer">Connect on LinkedIn ↗</a></div>' +
        '<p class="hint">Version 2 · works on laptop, tablet, phone, foldables and flip phones.</p></div>';

    function showTab(name) {
        if (!TABS.some(function(t) { return t[0] === name; })) { name = 'profile'; }
        page.querySelectorAll('.tab-panel').forEach(function(p) { p.hidden = p.getAttribute('data-panel') !== name; });
        page.querySelectorAll('[data-tab]').forEach(function(b) {
            const on = b.getAttribute('data-tab') === name;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (history.replaceState) { history.replaceState(null, '', '#' + name); }
    }

    page.addEventListener('click', function(e) {
        const t = e.target.closest('[data-tab]');
        if (t) { showTab(t.getAttribute('data-tab')); return; }
        const lg = e.target.closest('[data-lang]');
        if (lg) { chooseLang(lg.getAttribute('data-lang')); return; }
        const th = e.target.closest('[data-theme]');
        if (th) {
            const v = th.getAttribute('data-theme');
            applyTheme(v);
            markTheme(v);
            savePrefs({ theme: v }).catch(function() {});
            return;
        }
        const s = e.target.closest('[data-save]');
        if (s) { save(s.getAttribute('data-save')); return; }
        const a = e.target.closest('[data-act]');
        if (a) {
            if (a.getAttribute('data-act') === 'install') { installApp(); }
            if (a.getAttribute('data-act') === 'signout') {
                signOut(auth).catch(function() {}).then(function() { location.href = '../index.html'; });
            }
        }
    });

    function lsGetLang() { try { return localStorage.getItem('meezan-lang') || 'en'; } catch (e) { return 'en'; } }
    function markLang(code) {
        page.querySelectorAll('[data-lang]').forEach(function(c) { c.classList.toggle('on', c.getAttribute('data-lang') === code); });
    }
    async function chooseLang(code) {
        const was = lsGetLang();
        lsSet('meezan-lang', code);
        markLang(code);
        try { await savePrefs({ language: code }); } catch (err) { toast('Saved on this device only: ' + (err.code || err.message), 'warn', 4000); }
        if (code === 'en' || was !== 'en') {
            location.reload(); /* clean redraw: back to English, or from one language straight to another */
        } else if (typeof window.applyLanguage === 'function') {
            window.applyLanguage(code);
            toast('✓', 'ok', 1200);
        }
    }

    function markTheme(v) {
        page.querySelectorAll('[data-theme]').forEach(function(c) { c.classList.toggle('on', c.getAttribute('data-theme') === v); });
    }

    async function save(which) {
        try {
            if (which === 'profile') {
                await saveProfile({
                    name: document.getElementById('p-name').value.trim(),
                    phone: document.getElementById('p-phone').value.trim(),
                    city: document.getElementById('p-city').value.trim()
                });
            } else if (which === 'prefs') {
                await savePrefs({
                    weekStart: parseInt(document.getElementById('s-week').value, 10),
                    hijriAdjust: parseInt(document.getElementById('s-hadj').value, 10),
                    nisabBasis: document.getElementById('s-nisab').value,
                    zakatRate: parseFloat(document.getElementById('s-zrate').value) || 2.5,
                    deductTrust: document.getElementById('s-trust').checked
                });
            } else if (which === 'giving') {
                const r = parseFloat(document.getElementById('s-crate').value);
                if (isNaN(r) || r < 0 || r > 100) { toast('Enter a percentage between 0 and 100.', 'warn'); return; }
                await savePrefs({ charityRate: r });
            }
            toast('Saved ✓', 'ok');
        } catch (err) {
            toast('Could not save: ' + (err.code || err.message), 'err', 4500);
        }
    }

    let filled = false;
    function fill() {
        if (filled) { return; }
        filled = true;
        const p = store.profile || {};
        const pr = store.prefs;
        document.getElementById('p-name').value = p.name || ctx.user.displayName || '';
        document.getElementById('p-email').value = ctx.user.email || p.email || '';
        document.getElementById('p-phone').value = p.phone || '';
        document.getElementById('p-city').value = p.city || '';
        markLang(pr.language || lsGetLang());
        document.getElementById('s-week').value = String(pr.weekStart);
        document.getElementById('s-hadj').value = String(pr.hijriAdjust || 0);
        document.getElementById('s-nisab').value = pr.nisabBasis || 'silver';
        document.getElementById('s-zrate').value = pr.zakatRate;
        document.getElementById('s-trust').checked = !!pr.deductTrust;
        document.getElementById('s-crate').value = pr.charityRate;
        markTheme(pr.theme || 'glass');
    }

    fill();
    const cal = mountCalendar(document.getElementById('s-cal'));
    mountCalculator(document.getElementById('s-calc'));
    subscribe(function() { cal.redraw(); });

    const installBtn = page.querySelector('[data-act="install"]');
    if (canInstall()) { installBtn.hidden = false; }
    window.addEventListener('beforeinstallprompt', function() { installBtn.hidden = false; });

    showTab((location.hash || '#profile').slice(1));
    window.addEventListener('hashchange', function() { showTab((location.hash || '#profile').slice(1)); });
});

/* ============================================================
   MEEZAN — ميزان  |  js/login.js
   Sign in / register (email + Google). Already signed in → go to
   the dashboard. Profile is created ONCE (v1 overwrote theme and
   language on every Google sign-in).
   ============================================================ */

import {
    auth, db, googleProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
    doc, getDoc, setDoc
} from './core/firebase.js';
import { lsGet } from './core/utils.js';

const DASHBOARD = 'pages/dashboard.html';
let mode = 'login';
let busy = false;

const $ = function(id) { return document.getElementById(id); };

const savedTheme = lsGet('meezan-theme', 'glass');
document.documentElement.setAttribute('data-theme', savedTheme);

const MESSAGES = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Email or password is wrong.',
    'auth/user-not-found': 'No account with this email. Use Register.',
    'auth/email-already-in-use': 'This email is already registered. Use Sign in.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'Cannot reach Google/Firebase. Check your internet, turn off any VPN or ad-blocker for this site, then try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/unauthorized-domain': 'This website address is not authorised in Firebase (Authentication → Settings → Authorised domains).'
};

function show(msg, ok) {
    const box = $('auth-msg');
    box.textContent = msg;
    box.className = 'banner ' + (ok ? 'banner-ok' : 'banner-bad');
    box.hidden = !msg;
}

function setBusy(v) {
    busy = v;
    ['submit-btn', 'google-btn'].forEach(function(id) { $(id).disabled = v; });
}

function setMode(m) {
    mode = m;
    document.querySelectorAll('[data-mode]').forEach(function(b) {
        const on = b.getAttribute('data-mode') === m;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('name-field').hidden = m !== 'register';
    $('forgot-row').hidden = m !== 'login';
    $('submit-btn').textContent = m === 'login' ? 'Sign in' : 'Create account';
    $('a-pass').setAttribute('autocomplete', m === 'login' ? 'current-password' : 'new-password');
    show('');
}

async function ensureProfile(user, name) {
    try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) { return; }
        await setDoc(ref, {
            name: name || user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
            email: user.email || '',
            photoURL: user.photoURL || '',
            currency: 'INR',
            createdAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('Profile not created yet:', e.code || e.message);
    }
}

function go() { location.replace(DASHBOARD); }

async function finish(user, name) {
    await ensureProfile(user, name);
    go();
}

async function google() {
    if (busy) { return; }
    setBusy(true);
    show('');
    try {
        const res = await signInWithPopup(auth, googleProvider);
        await finish(res.user);
    } catch (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
            try { await signInWithRedirect(auth, googleProvider); return; } catch (e2) { err = e2; }
        }
        show(MESSAGES[err.code] || 'Google sign-in failed: ' + (err.message || err.code));
        setBusy(false);
    }
}

async function submit(e) {
    e.preventDefault();
    if (busy) { return; }
    const email = $('a-email').value.trim();
    const pass = $('a-pass').value;
    const name = $('a-name').value.trim();
    if (!email || !pass) { show('Enter your email and password.'); return; }
    if (mode === 'register' && !name) { show('Enter your name.'); return; }
    setBusy(true);
    show('');
    try {
        if (mode === 'login') {
            const res = await signInWithEmailAndPassword(auth, email, pass);
            await finish(res.user);
        } else {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(res.user, { displayName: name }).catch(function() {});
            await finish(res.user, name);
        }
    } catch (err) {
        show(MESSAGES[err.code] || 'Something went wrong: ' + (err.message || err.code));
        setBusy(false);
    }
}

async function forgot() {
    const email = $('a-email').value.trim();
    if (!email) { show('Type your email above first, then tap “Forgot password”.'); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        show('Password reset link sent. Check your inbox (and spam).', true);
    } catch (err) {
        show(MESSAGES[err.code] || 'Could not send the email: ' + (err.message || err.code));
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-mode]').forEach(function(b) {
        b.addEventListener('click', function() { setMode(b.getAttribute('data-mode')); });
    });
    $('auth-form').addEventListener('submit', submit);
    $('google-btn').addEventListener('click', google);
    $('forgot-btn').addEventListener('click', forgot);
    $('pw-eye').addEventListener('click', function() {
        const inp = $('a-pass');
        const showing = inp.type === 'text';
        inp.type = showing ? 'password' : 'text';
        this.textContent = showing ? '👁️' : '🙈';
        this.setAttribute('aria-pressed', showing ? 'false' : 'true');
        this.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
    setMode('login');

    /* result of a redirect sign-in (phones that block pop-ups) */
    getRedirectResult(auth).then(function(res) { if (res && res.user) { return finish(res.user); } }).catch(function(err) {
        show(MESSAGES[err.code] || 'Sign-in failed: ' + (err.message || err.code));
    });

    onAuthStateChanged(auth, function(user) {
        if (user && !busy) { go(); }
    });
});

/* ============================================================
   MEEZAN — ميزان  |  js/core/store.js
   Live data store. Listeners start ONLY after the shell has
   confirmed the user is signed in (onAuthStateChanged).
   ============================================================ */

import {
    db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
    onSnapshot, serverTimestamp, writeBatch
} from './firebase.js';
import { DEFAULT_PREFS } from './constants.js';
import { num } from './utils.js';
import { accountBalances } from './calc.js';

export const COLLECTIONS = ['income', 'expenses', 'accounts', 'transfers', 'ornaments', 'sadaqah', 'zakatRecords', 'eidSavings', 'loans'];

export const store = {
    uid: null,
    data: { income: [], expenses: [], accounts: [], transfers: [], ornaments: [], sadaqah: [], zakatRecords: [], eidSavings: [], loans: [] },
    prefs: Object.assign({}, DEFAULT_PREFS),
    profile: {},
    loaded: {},
    errors: {}
};

const listeners = new Set();
const unsubs = [];
let notifyTimer = null;

function notify() {
    if (notifyTimer) { return; }
    notifyTimer = setTimeout(function() {
        notifyTimer = null;
        listeners.forEach(function(fn) {
            try { fn(store); } catch (e) { console.error('store subscriber failed:', e); }
        });
    }, 0);
}

export function subscribe(fn) {
    listeners.add(fn);
    return function() { listeners.delete(fn); };
}

export function isReady(names) {
    const need = names || [];
    for (let i = 0; i < need.length; i++) {
        if (!store.loaded[need[i]]) { return false; }
    }
    return store.loaded.prefs === true;
}

export function startStore(uid, names) {
    store.uid = uid;
    const wanted = names && names.length ? names : COLLECTIONS;

    unsubs.push(onSnapshot(doc(db, 'users', uid, 'settings', 'prefs'), function(snap) {
        store.prefs = Object.assign({}, DEFAULT_PREFS, snap.exists() ? snap.data() : {});
        store.loaded.prefs = true;
        notify();
    }, function(err) {
        store.errors.prefs = err;
        store.loaded.prefs = true;
        console.error('prefs listener:', err.code || err.message);
        notify();
    }));

    unsubs.push(onSnapshot(doc(db, 'users', uid), function(snap) {
        store.profile = snap.exists() ? snap.data() : {};
        store.loaded.profile = true;
        notify();
    }, function(err) {
        store.errors.profile = err;
        store.loaded.profile = true;
        console.error('profile listener:', err.code || err.message);
        notify();
    }));

    wanted.forEach(function(name) {
        unsubs.push(onSnapshot(collection(db, 'users', uid, name), function(snap) {
            store.data[name] = snap.docs.map(function(d) {
                return Object.assign({ id: d.id }, d.data({ serverTimestamps: 'estimate' }));
            });
            store.loaded[name] = true;
            delete store.errors[name];
            notify();
        }, function(err) {
            store.errors[name] = err;
            store.loaded[name] = true;
            console.error(name + ' listener:', err.code || err.message);
            notify();
        }));
    });
}

export function stopStore() {
    unsubs.forEach(function(u) { try { u(); } catch (e) { /* ignore */ } });
    unsubs.length = 0;
    listeners.clear();
}

/* ── WRITES ─────────────────────────────────────────────────── */
function col(name) { return collection(db, 'users', store.uid, name); }

function clean(obj) {
    const out = {};
    Object.keys(obj).forEach(function(k) { if (obj[k] !== undefined) { out[k] = obj[k]; } });
    return out;
}

/* Add (no id) or update (with id) one record */
export async function saveRecord(name, data, id) {
    const payload = clean(data);
    payload.uid = store.uid;
    if (id) {
        payload.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'users', store.uid, name, id), payload);
        return id;
    }
    payload.createdAt = serverTimestamp();
    const ref = await addDoc(col(name), payload);
    return ref.id;
}

export async function removeRecord(name, id) {
    await deleteDoc(doc(db, 'users', store.uid, name, id));
}

export async function savePrefs(partial) {
    await setDoc(doc(db, 'users', store.uid, 'settings', 'prefs'), clean(partial), { merge: true });
}

export async function saveProfile(partial) {
    await setDoc(doc(db, 'users', store.uid), clean(partial), { merge: true });
}

/* Set an account's CURRENT balance by adjusting its opening balance */
export async function setAccountBalance(accountId, desired) {
    const acc = store.data.accounts.find(function(a) { return a.id === accountId; });
    if (!acc) { return; }
    const current = accountBalances(store.data)[accountId] || 0;
    await updateDoc(doc(db, 'users', store.uid, 'accounts', accountId), {
        openingBalance: num(acc.openingBalance) + (num(desired) - current),
        updatedAt: serverTimestamp()
    });
}

/* Link every old (version 1) record that has no account to one account */
export async function linkOldRecords(accountId) {
    const targets = [];
    store.data.income.forEach(function(r) { if (!r.accountId) { targets.push(['income', r.id]); } });
    store.data.expenses.forEach(function(r) { if (!r.accountId) { targets.push(['expenses', r.id]); } });
    /* Linking must NOT change today's balance: shift the opening balance
       by the same amount the old records will now add / remove. */
    let delta = 0;
    store.data.income.forEach(function(r) { if (!r.accountId) { delta += num(r.amt); } });
    store.data.expenses.forEach(function(r) { if (!r.accountId) { delta -= num(r.amt); } });
    const acc = store.data.accounts.find(function(a) { return a.id === accountId; });
    for (let i = 0; i < targets.length; i += 400) {
        const batch = writeBatch(db);
        targets.slice(i, i + 400).forEach(function(t) {
            batch.update(doc(db, 'users', store.uid, t[0], t[1]), { accountId: accountId });
        });
        if (i === 0 && acc) {
            batch.update(doc(db, 'users', store.uid, 'accounts', accountId), { openingBalance: num(acc.openingBalance) - delta });
        }
        await batch.commit();
    }
    return targets.length;
}

export async function deleteAccount(accountId) {
    await deleteDoc(doc(db, 'users', store.uid, 'accounts', accountId));
}

/* ============================================================
   MEEZAN — ميزان  |  js/firebase-config.js
   Firebase initialization + all Firestore helpers
   ============================================================ */

// ── FIREBASE SDK (loaded via CDN in each HTML page) ──────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ── YOUR FIREBASE CONFIG ──────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
    authDomain: "meezan-app-8a41a.firebaseapp.com",
    projectId: "meezan-app-8a41a",
    storageBucket: "meezan-app-8a41a.firebasestorage.app",
    messagingSenderId: "767947145877",
    appId: "1:767947145877:web:d837e0b30258405339519c"
};

// ── INITIALIZE ────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── EXPORT FOR USE IN OTHER FILES ─────────────────────────────
export { auth, db, googleProvider };

// ═══════════════════════════════════════════════════════════════
// AUTH FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/** Google sign-in popup */
export async function signInGoogle() {
    return await signInWithPopup(auth, googleProvider);
}

/** Email sign-in */
export async function signInEmail(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
}

/** Email register */
export async function registerEmail(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
}

/** Sign out */
export async function logout() {
    return await signOut(auth);
}

/** Password reset */
export async function resetPassword(email) {
    return await sendPasswordResetEmail(auth, email);
}

/** Auth state listener — pass a callback(user) */
export function onAuth(callback) {
    return onAuthStateChanged(auth, callback);
}

// ═══════════════════════════════════════════════════════════════
// FIRESTORE HELPERS
// ═══════════════════════════════════════════════════════════════

/** Shortcut: subcollection ref */
const col = (uid, name) => collection(db, "users", uid, name);
const ref = (uid, name, id) => doc(db, "users", uid, name, id);

// ── USER PROFILE ──────────────────────────────────────────────
export async function saveProfile(uid, data) {
    await setDoc(doc(db, "users", uid), {...data }, { merge: true });
}
export async function getProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
}

// ── INCOME ────────────────────────────────────────────────────
export async function addIncome(uid, data) {
    return await addDoc(col(uid, "income"), {...data, createdAt: serverTimestamp() });
}
export async function getIncome(uid) {
    const q = query(col(uid, "income"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenIncome(uid, cb) {
    return onSnapshot(query(col(uid, "income"), orderBy("date", "desc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function deleteIncome(uid, id) {
    await deleteDoc(ref(uid, "income", id));
}

// ── EXPENSES ──────────────────────────────────────────────────
export async function addExpense(uid, data) {
    return await addDoc(col(uid, "expenses"), {...data, createdAt: serverTimestamp() });
}
export async function getExpenses(uid) {
    const q = query(col(uid, "expenses"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenExpenses(uid, cb) {
    return onSnapshot(query(col(uid, "expenses"), orderBy("date", "desc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function deleteExpense(uid, id) {
    await deleteDoc(ref(uid, "expenses", id));
}

// ── ORNAMENTS / ASSETS ────────────────────────────────────────
export async function addOrnament(uid, data) {
    return await addDoc(col(uid, "ornaments"), {...data, createdAt: serverTimestamp() });
}
export async function getOrnaments(uid) {
    const q = query(col(uid, "ornaments"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenOrnaments(uid, cb) {
    return onSnapshot(query(col(uid, "ornaments"), orderBy("date", "desc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function deleteOrnament(uid, id) {
    await deleteDoc(ref(uid, "ornaments", id));
}

// ── ZAKAT RECORD ──────────────────────────────────────────────
export async function saveZakatRecord(uid, data) {
    await setDoc(doc(db, "users", uid, "zakat", "record"), data, { merge: true });
}
export async function getZakatRecord(uid) {
    const snap = await getDoc(doc(db, "users", uid, "zakat", "record"));
    return snap.exists() ? snap.data() : null;
}
export async function addSadaqah(uid, data) {
    return await addDoc(col(uid, "sadaqah"), {...data, createdAt: serverTimestamp() });
}

// ── METAL PRICE CACHE (shared, not per-user) ──────────────────
export async function getMetalCache() {
    const snap = await getDoc(doc(db, "cache", "metals"));
    return snap.exists() ? snap.data() : null;
}
export async function saveMetalCache(data) {
    await setDoc(doc(db, "cache", "metals"), {...data, updatedAt: serverTimestamp() });
}

// ── SETTINGS ──────────────────────────────────────────────────
export async function saveSettings(uid, data) {
    await setDoc(doc(db, "users", uid, "settings", "prefs"), data, { merge: true });
}
export async function getSettings(uid) {
    const snap = await getDoc(doc(db, "users", uid, "settings", "prefs"));
    return snap.exists() ? snap.data() : { theme: "glass", language: "en", currency: "INR" };
}
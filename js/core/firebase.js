/* ============================================================
   MEEZAN — ميزان  |  js/core/firebase.js
   ONE Firebase initialisation for the whole app.
   Every page imports from here — no more duplicate config.
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    collectionGroup,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    arrayUnion,
    deleteField,
    arrayRemove,
    increment
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU',
    authDomain: 'meezan-app-8a41a.firebaseapp.com',
    projectId: 'meezan-app-8a41a',
    storageBucket: 'meezan-app-8a41a.firebasestorage.app',
    messagingSenderId: '767947145877',
    appId: '1:767947145877:web:d837e0b30258405339519c'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* Offline cache: the app opens instantly on phones and keeps working
   with no signal. Falls back to plain Firestore if the browser can't. */
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
} catch (e) {
    db = getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();

export {
    app, auth, db, googleProvider,
    onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
    sendPasswordResetEmail, updateProfile,
    collection, collectionGroup, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch,
    arrayUnion, arrayRemove, deleteField, increment
};

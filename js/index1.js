// ── IMPORTS ────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";


// ── FIREBASE CONFIG ─────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
    authDomain: "meezan-app-8a41a.firebaseapp.com",
    projectId: "meezan-app-8a41a",
    storageBucket: "meezan-app-8a41a.firebasestorage.app",
    messagingSenderId: "767947145877",
    appId: "1:767947145877:web:d837e0b30258405339519c"
};


// ── INITIALIZE ─────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ── GOOGLE PROVIDER ────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");


// ── AUTO REDIRECT ──────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        location.href = "pages/dashboard.html";
    }
});


// ── HELPERS ────────────────────────────────────────────────
function showErr(msg) {
    document.getElementById("err-msg").textContent = msg;
}

function setLoad(isLoading) {
    ["google-btn", "login-btn", "reg-btn"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("loading", isLoading);
    });
}

async function saveProfile(uid, data) {
    await setDoc(doc(db, "users", uid), data, { merge: true });
}


// ── TAB SWITCH ─────────────────────────────────────────────
window.switchTab = function(tab) {
    document.querySelectorAll(".login-tab").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(el => el.classList.remove("active"));

    document.getElementById("tab-" + tab).classList.add("active");
    document.getElementById("panel-" + tab).classList.add("active");

    showErr("");
};


// ── GOOGLE LOGIN ───────────────────────────────────────────
window.doGoogle = async function() {
    setLoad(true);
    showErr("");

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        await saveProfile(user.uid, {
            name: user.displayName || "User",
            email: user.email,
            photoURL: user.photoURL || "",
            currency: "INR",
            language: "en",
            theme: "glass",
            createdAt: new Date().toISOString()
        });

        location.href = "pages/dashboard.html";

    } catch (error) {
        let msg = "";

        if (error.code === "auth/popup-closed-by-user") {
            msg = "Sign-in cancelled.";
        } else if (error.code === "auth/popup-blocked") {
            msg = "Popup blocked. Allow popups.";
        } else if (error.code === "auth/network-request-failed") {
            msg = "Network error.";
        } else if (error.code === "auth/unauthorized-domain") {
            msg = "Add domain in Firebase Console.";
        } else {
            msg = "Google login failed: " + error.message;
        }

        showErr(msg);
    }

    setLoad(false);
};


// ── EMAIL LOGIN ────────────────────────────────────────────
window.doLogin = async function() {
    const email = document.getElementById("li-email").value.trim();
    const pass = document.getElementById("li-pass").value;

    if (!email || !pass) {
        showErr("Enter email & password");
        return;
    }

    setLoad(true);
    showErr("");

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        location.href = "pages/dashboard.html";
    } catch {
        showErr("Invalid credentials");
    }

    setLoad(false);
};


// ── REGISTER ───────────────────────────────────────────────
window.doRegister = async function() {
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-pass").value;

    if (!name || !email || pass.length < 6) {
        showErr("Fill all fields correctly");
        return;
    }

    setLoad(true);
    showErr("");

    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);

        await saveProfile(result.user.uid, {
            name,
            email,
            currency: "INR",
            language: "en",
            theme: "glass",
            createdAt: new Date().toISOString()
        });

        location.href = "pages/dashboard.html";

    } catch (error) {
        showErr(error.message);
    }

    setLoad(false);
};


// ── RESET PASSWORD ─────────────────────────────────────────
window.doReset = async function() {
    const email = document.getElementById("li-email").value.trim();

    if (!email) {
        showErr("Enter email first");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showErr("Reset email sent");
    } catch {
        showErr("Reset failed");
    }
};
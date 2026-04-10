# MEEZAN — ميزان | Complete Project State
## For AI Assistants (ChatGPT / Claude) — April 2026

---

## WHAT IS MEEZAN
Islamic personal finance web app. Tracks income, expenses, gold/silver assets, calculates Zakat.
Stack: Plain HTML + CSS + JavaScript (ES Modules) + Firebase (Auth + Firestore). No React, no npm.
Hosted locally via VS Code Live Server. Will deploy to Vercel (free).

---

## FIREBASE CONFIG (VERIFIED WORKING)
```javascript
{
  apiKey:            "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:        "meezan-app-8a41a.firebaseapp.com",
  projectId:         "meezan-app-8a41a",
  storageBucket:     "meezan-app-8a41a.firebasestorage.app",
  messagingSenderId: "767947145877",
  appId:             "1:767947145877:web:d837e0b30258405339519c"
}
```
Firebase SDK: v10.11.0 (CDN, modular)
User UID: bNESKpM4k2TOEhlT9dg4gJcrjGj2
Email: akifnehal24092004@gmail.com (Google login)

---

## ✅ WORKING FEATURES (as of 5 April 2026)
- Google login + Email/Password login + Register
- Dashboard with live data from Firestore (income, expenses, assets, zakat ring)
- Income page: Add/Edit/Delete income, filter by type, monthly chart ✅
- Expenses page: Add/Edit/Delete expenses, filter by category + date, income source tagging ✅
- Assets page: Add/Edit/Delete ornaments (gold/silver), present value calculation, Zakat on metals ✅
- Reports page: Income vs expenses chart, category breakdown, savings rate ✅
- Export page: PDF export (jsPDF), JSON backup, CSV export ✅
- Hijri calendar on dashboard (Aladhan API — free)
- 4 themes: Glass, Hell-Fire, Heaven-Light, Marble-Clean
- Language system: 21 languages, saves to Firebase

---

## FIRESTORE DATA STRUCTURE
```
users/{uid}
  ├── name, email, photoURL, lastLogin (from Google/Email auth)
  ├── income/{autoId}
  │     name, amt, type, recur, date, currency, notes, uid, createdAt
  ├── expenses/{autoId}
  │     name, amt, cat, date, notes, incomeSrc, incomeSrcType, uid, createdAt
  ├── ornaments/{autoId}
  │     name, type, buyPrice, date, goldG, goldK, silvG, diamV, stonV, makeV, notes
  ├── sadaqah/{autoId}
  │     amt, desc, date, cat, uid, createdAt
  └── settings/prefs
        currency, calendar, salday, budwarn, language, theme, notifications{}

invites/{autoId}: fromUid, fromEmail, toEmail, role, access, message, status, createdAt
cache/metals: gold24, silver, updatedAt
```

---

## FILE STRUCTURE
```
meezan-final/
├── index.html              ← Login page (uses js/index1.js for auth)
├── css/
│   ├── main.css            ← Core layout, components
│   ├── themes.css          ← 4 themes (glass/hell/heaven/marble)
│   ├── phone.css           ← Mobile responsive
│   ├── tablet.css          ← Tablet responsive
│   ├── assets.css, calculator.css, calendar.css, expenses.css
│   ├── export.css, family.css, income.css, language.css
│   ├── notifications.css, reports.css, settings.css, zakat.css
├── js/
│   ├── index1.js           ← Auth module (Google + Email login)
│   ├── firebase-config.js  ← Shared Firebase init
│   ├── i18n.js             ← 21 language translations
│   ├── i18n-loader.js      ← Loads language from Firebase on every page
│   ├── utils.js            ← Shared helpers
│   ├── dashboard.js        ← Live dashboard data
│   ├── income.js           ← Income CRUD + charts
│   ├── expenses.js         ← Expense CRUD + income source filter
│   ├── assets.js           ← Ornament/gold/silver tracking
│   ├── zakat.js            ← Zakat on income + metals
│   ├── calendar.js         ← Hijri + Gregorian calendar
│   ├── calculator.js       ← Islamic finance calculator
│   ├── reports.js          ← Charts and analytics
│   ├── export.js           ← PDF/JSON/CSV export + JSON import
│   ├── language.js         ← Language selection page
│   ├── settings.js         ← Profile + preferences
│   ├── family.js           ← Family hub (invites)
│   ├── notifications.js    ← Notifications
│   ├── sadaqah.html logic embedded in zakat.js
└── pages/
    ├── dashboard.html, income.html, expenses.html, assets.html
    ├── zakat.html, calendar.html, ramadan.html, sadaqah.html
    ├── reports.html, export.html
    ├── family.html, notifications.html
    ├── settings.html, language.html, calculator.html
```

---

## GOLD/SILVER PRICES (hardcoded — update to live API next)
- Gold 24K: ₹6,842/g
- Silver: ₹82/g
- Nisab: 595g silver = ₹48,790

---

## FIRESTORE SECURITY RULES (paste in Firebase Console → Firestore → Rules)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /invites/{inviteId} {
      allow read, write: if request.auth != null;
    }
    match /cache/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## HOW EVERY PAGE IS STRUCTURED
```html
<head>
  <link rel="stylesheet" href="../css/main.css"/>
  <link rel="stylesheet" href="../css/themes.css"/>
  <link rel="stylesheet" href="../css/phone.css"/>
  <link rel="stylesheet" href="../css/tablet.css"/>
  <link rel="stylesheet" href="../css/PAGENAME.css"/>
  <script src="../js/i18n.js"></script>
  <script type="module" src="../js/i18n-loader.js"></script>
</head>
<body>
  <!-- Sidebar nav with data-i18n attributes -->
  <!-- Main content -->
  <script type="module" src="../js/PAGENAME.js"></script>
  <script>/* theme + particles */</script>
</body>
```

---

## LANGUAGE SYSTEM
- i18n.js: 21 language objects with keys matching data-i18n HTML attributes
- i18n-loader.js: Fetches language from Firebase on every page load
- settings.js: selectLang() saves to users/{uid}/settings/prefs.language
- language.js: Full language selection page with flags, RTL support
- RTL languages: Arabic (ar), Urdu (ur), Persian (fa)

---

## ZAKAT CALCULATION RULES
1. INCOME ZAKAT: If (total income - total expenses) >= Nisab → 2.5% due
2. METAL ZAKAT: If gold+silver value >= Nisab → 2.5% due
3. TOTAL ZAKAT: Income Zakat + Metal Zakat
4. Nisab = 595g silver × silver price
5. Hawl (1 lunar year) must pass — user inputs Hawl start date

---

## ❌ KNOWN ISSUES / PENDING
1. Language grid not showing on language.html (empty grid — CSS class mismatch)
2. Daily record view: No day-by-day breakdown yet
3. Live gold/silver prices: Currently hardcoded (need GoldAPI.io or similar)
4. Calendar: Clicking a date doesn't open notes yet
5. Family Hub: Invite system built but email delivery not wired
6. Ramadan Mode: UI built but logic needs completing
7. Push notifications: Not implemented

---

## NEXT CHECKPOINTS (ROADMAP)
### Checkpoint 2 — Real-time prices + daily view
- Live gold/silver prices (GoldAPI.io free tier or scraping)
- Day-by-day income/expense view with totals
- Live currency converter

### Checkpoint 3 — Calendar + Daily notes
- Click date → open modal with day summary
- Income/expense breakdown for that day
- Islamic events + government holidays
- Prayer times (by location)

### Checkpoint 4 — Advanced reports
- Daily/weekly/monthly/yearly graphs
- Spending by income source (bar + line)
- Net worth over time
- Budget vs actual

### Checkpoint 5 — Export/Import polish
- Import from Spendora/Walnut/YNAB JSON
- Import from bank statement CSV
- PDF with chart images embedded
- WhatsApp share summary

### Checkpoint 6 — Family + Subscription
- Family invite flow (Firestore invites collection ready)
- Shared expense view
- Subscription tiers (Razorpay integration)

---

## HOW TO ADD A NEW PAGE (TEMPLATE)
```html
<!DOCTYPE html>
<html lang="en" data-theme="glass">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
  <title>Meezan — Page Name</title>
  <link rel="stylesheet" href="../css/main.css"/>
  <link rel="stylesheet" href="../css/themes.css"/>
  <link rel="stylesheet" href="../css/phone.css"/>
  <link rel="stylesheet" href="../css/tablet.css"/>
  <link rel="stylesheet" href="../css/pagename.css"/>
  <script src="../js/i18n.js"></script>
  <script type="module" src="../js/i18n-loader.js"></script>
</head>
<body>
  <!-- Copy sidebar from any existing page -->
  <!-- Add your main content here -->
  <script type="module" src="../js/pagename.js"></script>
  <script>
    const t = localStorage.getItem('meezan-theme') || 'glass';
    document.documentElement.setAttribute('data-theme', t);
    const pc = document.getElementById('particles');
    for (let i=0;i<22;i++){
      const p=document.createElement('div');
      p.className='particle '+(i<13?'p-fire':'p-star');
      p.style.cssText=`left:${Math.random()*100}%;animation-duration:${4+Math.random()*8}s;animation-delay:${Math.random()*6}s;`;
      pc.appendChild(p);
    }
    window.setTheme = th => {
      document.documentElement.setAttribute('data-theme',th);
      localStorage.setItem('meezan-theme',th);
      document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th));
    };
  </script>
</body>
</html>
```

---

## IMPORTANT NOTES FOR AI ASSISTANTS
1. All JS files use ES Modules (type="module") — functions exposed with window.functionName = ...
2. Firebase is initialized in EVERY JS file separately (no shared module due to module scope)
3. Auth guard: every page has onAuthStateChanged → redirect to ../index.html if not logged in
4. index.html is in ROOT, all pages are in pages/ subfolder → paths differ (js/ vs ../js/)
5. NEVER minify the JS code — broken async/await has been a recurring issue
6. The app uses CSS custom properties (--gold, --teal, --fire, etc.) defined in themes.css
7. data-i18n attributes on HTML elements are required for language system to work

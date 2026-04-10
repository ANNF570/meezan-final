# MEEZAN — ميزان  |  Setup Guide
# Complete step-by-step from zero to live

# ═══════════════════════════════════════════════════
# STEP 1 — INSTALL TOOLS (do this ONCE on your laptop)
# ═══════════════════════════════════════════════════

# 1a. Install VS Code:         https://code.visualstudio.com/
# 1b. Install Node.js (LTS):   https://nodejs.org/
# 1c. Install Git:             https://git-scm.com/

# Verify installation — open terminal and type:
node --version     # should show v18 or higher
npm --version      # should show 9 or higher
git --version      # should show git version 2.x


# ═══════════════════════════════════════════════════
# STEP 2 — CREATE GITHUB REPO
# ═══════════════════════════════════════════════════

# Go to github.com → Sign up (free) → New Repository
# Name it: meezan
# Keep it private
# Copy the repo URL (e.g. https://github.com/yourname/meezan.git)


# ═══════════════════════════════════════════════════
# STEP 3 — COPY THIS PROJECT FOLDER
# ═══════════════════════════════════════════════════

# Your folder structure should look like this:
#
# meezan-final/
# │
# ├── index.html              ← LOGIN page (start here)
# │
# ├── css/
# │   ├── main.css            ← ALL desktop styles
# │   ├── phone.css           ← Phone styles (max 767px)
# │   └── tablet.css          ← Tablet styles (768-1100px)
# │
# ├── js/
# │   ├── firebase-config.js  ← Firebase init + all DB functions
# │   └── utils.js            ← Shared helpers (format, dates, metals)
# │
# ├── pages/
# │   ├── dashboard.html      ← MAIN dashboard (all widgets)
# │   ├── income.html         ← Income tracker
# │   ├── expenses.html       ← Expense tracker
# │   ├── assets.html         ← Gold, silver, ornaments
# │   ├── zakat.html          ← Zakat calculator
# │   ├── calendar.html       ← Dual Hijri + Gregorian calendar
# │   ├── calculator.html     ← Built-in calculator + Zakat shortcuts
# │   ├── reports.html        ← Charts and PDF export
# │   ├── family.html         ← Family hub
# │   ├── notifications.html  ← Notification settings
# │   └── settings.html       ← Profile, theme, language
# │
# └── assets/
#     └── (images, icons if any)


# ═══════════════════════════════════════════════════
# STEP 4 — FIREBASE SETUP (already done — your config is in the code)
# ═══════════════════════════════════════════════════

# Your Firebase config is already added to every HTML file:
# apiKey: "AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU"
# projectId: "meezan-app-8a41a"
# etc.

# In Firebase Console (console.firebase.google.com):
# 1. Go to your project "meezan-app-8a41a"
# 2. Build → Authentication → Sign-in method → Enable:
#    - Google
#    - Email/Password
# 3. Build → Firestore Database → Create database → Start in TEST MODE
# 4. Build → Firestore → Rules → paste this:
#    rules_version = '2';
#    service cloud.firestore {
#      match /databases/{database}/documents {
#        match /users/{userId}/{document=**} {
#          allow read, write: if request.auth != null && request.auth.uid == userId;
#        }
#        match /cache/{document} {
#          allow read: if request.auth != null;
#          allow write: if request.auth != null;
#        }
#      }
#    }
# 5. Authentication → Settings → Authorized domains → Add:
#    - localhost
#    - your-project.vercel.app (after Vercel deploy)


# ═══════════════════════════════════════════════════
# STEP 5 — TEST LOCALLY (no server needed for plain HTML)
# ═══════════════════════════════════════════════════

# Option A: Just open index.html in Chrome (simplest)
# Double-click index.html → opens in browser → works!

# Option B: Use VS Code Live Server extension (better)
# Install extension "Live Server" in VS Code
# Right-click index.html → "Open with Live Server"
# App opens at http://localhost:5500


# ═══════════════════════════════════════════════════
# STEP 6 — PUSH TO GITHUB
# ═══════════════════════════════════════════════════

# Open terminal in your meezan-final folder:
cd meezan-final

git init
git add .
git commit -m "Initial Meezan app"
git remote add origin https://github.com/YOURNAME/meezan.git
git push -u origin main


# ═══════════════════════════════════════════════════
# STEP 7 — DEPLOY TO VERCEL (FREE hosting)
# ═══════════════════════════════════════════════════

# 1. Go to vercel.com → Sign up with GitHub (free)
# 2. Click "Add New Project"
# 3. Import your "meezan" GitHub repo
# 4. Framework: select "Other" (plain HTML, no build needed)
# 5. Root directory: leave as is
# 6. Click "Deploy"
# 7. Your app is live at: meezan.vercel.app (or similar)

# After deploy, add your Vercel URL to Firebase Authorized domains:
# Firebase Console → Authentication → Authorized domains → Add new domain


# ═══════════════════════════════════════════════════
# FREE TOOLS USED (all ₹0/month)
# ═══════════════════════════════════════════════════

# Firebase Free Tier:
#   - Firestore: 1GB storage, 50K reads/day, 20K writes/day
#   - Auth: 10,000 users/month
#   - Storage: 5GB

# Vercel Free:
#   - Unlimited static hosting
#   - Auto HTTPS
#   - Custom domain support
#   - Auto-deploys from GitHub

# Aladhan API (Hijri dates): FREE, no key needed
#   Endpoint: https://api.aladhan.com/v1/gToH/DD-MM-YYYY

# GoldAPI.io: FREE tier (100 req/month — enough with daily caching)
#   Sign up: https://goldapi.io/
#   Replace 'demo' in js/utils.js with your real key

# GitHub: FREE private repos


# ═══════════════════════════════════════════════════
# WHAT EACH FILE DOES (quick reference)
# ═══════════════════════════════════════════════════

# index.html            Login/Register — Google + Email + Password reset
# css/main.css          All styles for desktop (1100px+)
# css/phone.css         Overrides for phone (max 767px) — bottom nav, single column
# css/tablet.css        Overrides for tablet (768-1100px) — icon sidebar, 2-col grids
# js/firebase-config.js Your Firebase keys + all Firestore read/write functions
# js/utils.js           fmt(), today(), metal prices, Aladhan API, category maps
# pages/dashboard.html  Main dashboard — all cards, live calendar, metrics, charts
# pages/calculator.html Calculator + Zakat 2.5% shortcut + Nisab check + Gold/gram
# (other pages)         Each page has same sidebar, same Firebase logic, same CSS


# ═══════════════════════════════════════════════════
# NEXT PAGES TO BUILD (same pattern as dashboard)
# ═══════════════════════════════════════════════════

# pages/income.html      — Full income list with add form + Firestore
# pages/expenses.html    — Full expense tracker with categories + charts
# pages/assets.html      — Full ornament tracker (Gold+Diamond breakdown)
# pages/zakat.html       — Complete Zakat engine with Hawl tracking
# pages/calendar.html    — Full month view Hijri + Gregorian
# pages/reports.html     — Charts + PDF export with jsPDF
# pages/settings.html    — Profile, theme picker, language, account
# pages/family.html      — Invite + permissions + shared view
# pages/notifications.html — Toggle all 13 notification types

# PATTERN for every new page:
# 1. Copy dashboard.html as template
# 2. Change the active nav-item class
# 3. Replace main-content section with your page's widgets
# 4. Use onSnapshot() to listen to Firestore and auto-update UI
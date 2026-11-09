# Meezan v2 — ميزان

Islamic personal finance: accounts (cash · bank · cash savings · online savings), income & expenses,
Zakat & Sadaqah, Eid & Ramadan goals, family groups, reports, export.
Designed & built by **[Akif Nehal](https://www.linkedin.com/in/akif-nehal/)**.

Plain HTML/CSS/JS + Firebase (Auth + Firestore). No build step except a tiny version stamp.

## Deploy (GitHub → Vercel) and automatic updates
1. Replace the files in your GitHub repo with this folder's contents, commit and push.
2. Vercel redeploys by itself. `vercel.json` runs `scripts/stamp-version.js`, which writes
   `version.json` and stamps `sw.js` with the commit id.
3. Phones and laptops that already have Meezan open (or installed) fetch the new service worker the
   next time the app is opened/focused and show **“A new version of Meezan is ready — Update now”**.
   HTML/JS/CSS are served `no-cache`, so a plain refresh always gets the newest files too.

## One-time Firebase steps
- **Firestore → Rules:** paste `firestore.rules` and Publish (needed for Family groups and new collections).
- **Authentication → Settings → Authorised domains:** add your Vercel domain (e.g. `meezan-final.vercel.app`).
- No Firestore index is needed (groups are sorted in the browser).

## Moving from version 1
Nothing is lost: income/expense category names are unchanged, old records still show, old Sadaqah and
Bakrid savings still show. On first open the Dashboard asks for your 4 balances (cash, bank, cash savings,
online savings). Then use **Link old records** so older history attaches to an account — your balances stay exactly the same.
Add more bank accounts any time under *Accounts & Assets*.

## New in this update
Friends & Loans (given / returned, edit, mark complete) · Import (JSON v1/v2/Spendora, CSV) with test files in `samples/` ·
21 languages (Settings → Language) · v1 animated themes · password show/hide · more charts on Dashboard and Reports.

## Folders
`pages/` one HTML shell per page · `js/pages/` page logic · `js/core/` shared code
(firebase, store, calc, ui, forms, charts…) · `css/meezan.css` single responsive stylesheet · `sw.js` offline + updates.

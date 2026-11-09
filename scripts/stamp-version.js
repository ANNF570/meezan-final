/* Runs on every Vercel build (see vercel.json). Writes /version.json and
   stamps the service worker so phones and laptops notice a new deploy. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
const stamp = sha || String(Date.now());
const builtAt = new Date().toISOString();

fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify({ version: stamp, builtAt: builtAt }, null, 2) + '\n');

const swPath = path.join(root, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8').replace(/const BUILD = '[^']*';/, "const BUILD = '" + stamp + "';");
fs.writeFileSync(swPath, sw);

console.log('Meezan build stamped: ' + stamp);

/* ============================================================
   MEEZAN | js/bakrid.js
   Bakrid (Eid al-Adha) Savings Planner
   - Animal selection + target price
   - Savings goal tracker with progress bar
   - Payment entry log (stored in Firestore)
   - Carry-forward if goal not met
   - Smart integration with income data
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, addDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:"meezan-app-8a41a.firebaseapp.com",
  projectId:"meezan-app-8a41a",
  storageBucket:"meezan-app-8a41a.firebasestorage.app",
  messagingSenderId:"767947145877",
  appId:"1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app), db = getFirestore(app);

const fmt   = n => '₹' + Math.round(n||0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0,10);
const get   = id => document.getElementById(id);
const set   = (id,v) => { const el=get(id); if(el) el.textContent=v; };

let currentUser = null;
let plan = {};
let savings = [];
let allIncome = [];

const ANIMALS = {
  goat:  { icon:'🐐', name:'Goat',         min:15000, max:40000,  shares:1  },
  sheep: { icon:'🐑', name:'Sheep',         min:12000, max:35000,  shares:1  },
  cow:   { icon:'🐄', name:'Cow (1/7 share)',min:8000,  max:20000,  shares:7  },
  camel: { icon:'🐪', name:'Camel (1/7)',   min:10000, max:30000,  shares:7  },
};

/* ══════════════════════════════════════
   AUTH
   ══════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (!user) return; // ramadan.html handles redirect
  currentUser = user;
  initBakrid();
});

async function initBakrid() {
  await loadPlan();
  startListeners();
  renderAnimalCards();
  updateUI();
}

/* ══════════════════════════════════════
   LOAD / SAVE PLAN FROM FIRESTORE
   ══════════════════════════════════════ */
async function loadPlan() {
  try {
    const snap = await getDoc(doc(db,'users',currentUser.uid,'bakridPlan','current'));
    if (snap.exists()) {
      plan = snap.data();
      // Restore UI from saved plan
      if (plan.animal && get('bk-animal-'+plan.animal)) {
        selectAnimal(plan.animal, false); // don't save again
      }
      if (plan.targetAmount && get('bk-target'))  get('bk-target').value  = plan.targetAmount;
      if (plan.startDate   && get('bk-start'))    get('bk-start').value   = plan.startDate;
      if (plan.targetDate  && get('bk-eid-date')) get('bk-eid-date').value = plan.targetDate;
      if (plan.shareType   && get('bk-share'))    get('bk-share').value   = plan.shareType;
    }
  } catch(e) { console.error('Bakrid plan load:', e); }
}

async function savePlan() {
  if (!currentUser) return;
  const targetAmount = parseFloat(get('bk-target')?.value) || 0;
  const startDate    = get('bk-start')?.value    || today();
  const targetDate   = get('bk-eid-date')?.value || '';
  const shareType    = get('bk-share')?.value    || 'full';

  plan = { ...plan, targetAmount, startDate, targetDate, shareType, updatedAt: new Date().toISOString() };

  try {
    await setDoc(doc(db,'users',currentUser.uid,'bakridPlan','current'), plan, { merge:true });
  } catch(e) { console.error('Bakrid plan save:', e); }
  updateUI();
}
window.saveBakridPlan = savePlan;

/* ══════════════════════════════════════
   FIRESTORE LISTENERS
   ══════════════════════════════════════ */
function startListeners() {
  // Savings entries
  onSnapshot(
    query(collection(db,'users',currentUser.uid,'bakridSavings'), orderBy('date','desc')),
    snap => {
      savings = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderSavingsList();
      updateUI();
    }
  );
  // Income (for suggestion)
  onSnapshot(
    query(collection(db,'users',currentUser.uid,'income'), orderBy('date','desc')),
    snap => { allIncome = snap.docs.map(d=>({id:d.id,...d.data()})); updateSuggestion(); }
  );
}

/* ══════════════════════════════════════
   ANIMAL CARD SELECTION
   ══════════════════════════════════════ */
function renderAnimalCards() {
  const wrap = get('bk-animal-cards');
  if (!wrap) return;

  wrap.innerHTML = Object.entries(ANIMALS).map(([key, a]) => `
    <div id="bk-animal-${key}" onclick="selectAnimal('${key}')"
         style="padding:12px 10px;border-radius:12px;background:var(--bg-row);
                border:2px solid var(--bdr);cursor:pointer;text-align:center;transition:all .2s"
         onmouseover="this.style.borderColor='rgba(212,160,23,.4)'"
         onmouseout="if(!this.classList.contains('selected'))this.style.borderColor='var(--bdr)'">
      <div style="font-size:28px;margin-bottom:4px">${a.icon}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">${a.name}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:2px">${fmt(a.min)} – ${fmt(a.max)}</div>
    </div>`).join('');
}

window.selectAnimal = function(key, save=true) {
  const a = ANIMALS[key];
  if (!a) return;

  // Update selected UI
  document.querySelectorAll('[id^="bk-animal-"]').forEach(el => {
    el.classList.remove('selected');
    el.style.borderColor = 'var(--bdr)';
    el.style.background  = 'var(--bg-row)';
  });
  const selected = get('bk-animal-'+key);
  if (selected) {
    selected.classList.add('selected');
    selected.style.borderColor = 'var(--gold)';
    selected.style.background  = 'rgba(212,160,23,0.1)';
  }

  plan.animal = key;

  // Suggest a target price
  const sugTarget = get('bk-target');
  if (sugTarget && !sugTarget.value) {
    sugTarget.value = Math.round((a.min + a.max) / 2);
  }

  // Update share type
  const shareEl = get('bk-share');
  if (shareEl) {
    shareEl.innerHTML = a.shares === 1
      ? '<option value="full">Full animal (1 person)</option>'
      : `<option value="full">Full animal (alone)</option>
         <option value="1/7">1/7 share (family/friends)</option>`;
  }

  if (save) savePlan();
  updateUI();
};

/* ══════════════════════════════════════
   UPDATE ALL UI
   ══════════════════════════════════════ */
function updateUI() {
  const target  = parseFloat(get('bk-target')?.value) || (plan.targetAmount||0);
  const saved   = savings.reduce((s,e)=>s+(e.amount||0),0);
  const remaining = Math.max(0, target - saved);
  const pct     = target > 0 ? Math.min(Math.round(saved/target*100),100) : 0;

  // Summary
  set('bk-saved-total',  fmt(saved));
  set('bk-remaining',    fmt(remaining));
  set('bk-target-show',  fmt(target));
  set('bk-pct',          pct+'%');

  const progressBar = get('bk-progress-fill');
  if (progressBar) progressBar.style.width = pct+'%';

  const progressColor = pct >= 100 ? '#1abc9c' : pct >= 50 ? '#d4a017' : '#e74c3c';
  if (progressBar) progressBar.style.background = `linear-gradient(90deg, ${progressColor}, #d4a017)`;

  // Status message
  const statusEl = get('bk-status-msg');
  if (statusEl) {
    if (pct >= 100) {
      statusEl.textContent = '🎉 Goal reached! You are ready for Qurbani, Alhamdulillah!';
      statusEl.style.color = 'var(--teal-lt)';
    } else {
      statusEl.textContent = `You are ${pct}% ready for Qurbani`;
      statusEl.style.color = pct >= 50 ? 'var(--gold-lt)' : 'var(--fire-lt)';
    }
  }

  // Timeline calculations
  const startDate  = get('bk-start')?.value  || plan.startDate  || today();
  const targetDate = get('bk-eid-date')?.value|| plan.targetDate || '';

  if (targetDate && remaining > 0) {
    const daysLeft = Math.max(1, Math.ceil((new Date(targetDate) - new Date()) / 86400000));
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
    set('bk-days-left',   daysLeft + ' days');
    set('bk-daily-need',  fmt(Math.ceil(remaining/daysLeft)) + '/day');
    set('bk-weekly-need', fmt(Math.ceil(remaining/weeksLeft)) + '/week');
  }

  // Carry-forward check
  const carryEl = get('bk-carry-forward');
  if (carryEl) {
    if (remaining > 0 && targetDate && new Date(targetDate) < new Date()) {
      carryEl.style.display = 'block';
      set('bk-carry-amount', fmt(remaining));
    } else {
      carryEl.style.display = 'none';
    }
  }

  updateSuggestion();
}

/* ══════════════════════════════════════
   SMART INCOME SUGGESTION
   ══════════════════════════════════════ */
function updateSuggestion() {
  const target    = parseFloat(get('bk-target')?.value) || plan.targetAmount || 0;
  const saved     = savings.reduce((s,e)=>s+(e.amount||0),0);
  const remaining = Math.max(0, target - saved);
  const targetDate= get('bk-eid-date')?.value || plan.targetDate || '';
  const sugEl     = get('bk-suggestion');
  if (!sugEl || !targetDate || remaining === 0) return;

  const monthsLeft = Math.max(1, Math.ceil((new Date(targetDate) - new Date()) / (30*86400000)));
  const perMonth   = Math.ceil(remaining / monthsLeft);
  const thisMonthIncome = allIncome
    .filter(e=>(e.date||'').slice(0,7)===new Date().toISOString().slice(0,7))
    .reduce((s,e)=>s+(e.amt||0),0);

  const pctOfIncome = thisMonthIncome > 0 ? Math.round(perMonth/thisMonthIncome*100) : 0;

  sugEl.innerHTML = `
    <div style="background:rgba(93,173,226,0.08);border:1px solid rgba(93,173,226,0.2);border-radius:10px;padding:12px;font-size:12px">
      💡 <strong style="color:var(--sky-lt)">Smart suggestion:</strong>
      Save <strong style="color:var(--gold-lt)">${fmt(perMonth)}/month</strong> for
      ${monthsLeft} month${monthsLeft>1?'s':''} to reach your Qurbani goal.
      ${thisMonthIncome>0?`That's <strong style="color:var(--teal-lt)">${pctOfIncome}% of this month's income</strong>.`:''}
    </div>`;
}

/* ══════════════════════════════════════
   ADD SAVINGS ENTRY
   ══════════════════════════════════════ */
window.addBakridSaving = async function() {
  const amount = parseFloat(get('bk-add-amount')?.value);
  const source = get('bk-add-source')?.value || 'Savings';
  const date   = get('bk-add-date')?.value   || today();
  const note   = get('bk-add-note')?.value?.trim() || 'Qurbani savings';

  if (isNaN(amount)||amount<=0) { alert('Enter a valid amount.'); return; }

  const btn = get('bk-save-btn');
  if (btn) { btn.textContent='Saving...'; btn.disabled=true; }

  try {
    await addDoc(collection(db,'users',currentUser.uid,'bakridSavings'), {
      amount, source, date, note,
      uid: currentUser.uid,
      createdAt: serverTimestamp()
    });

    // Clear form
    if(get('bk-add-amount')) get('bk-add-amount').value='';
    if(get('bk-add-note'))   get('bk-add-note').value='';
    if(get('bk-add-date'))   get('bk-add-date').value=today();

    const msg = get('bk-save-msg');
    if(msg){ msg.textContent='✓ Saved!'; msg.style.color='var(--teal-lt)'; setTimeout(()=>msg.textContent='',2000); }
  } catch(e) {
    alert('Error: '+e.message);
  }
  if (btn) { btn.textContent='+ Add Savings'; btn.disabled=false; }
};

/* ══════════════════════════════════════
   DELETE SAVINGS ENTRY
   ══════════════════════════════════════ */
window.deleteBakridSaving = async function(id) {
  if (!confirm('Remove this saving entry?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'bakridSavings',id));
};

/* ══════════════════════════════════════
   RENDER SAVINGS LIST
   ══════════════════════════════════════ */
function renderSavingsList() {
  const el = get('bk-savings-list');
  if (!el) return;

  if (!savings.length) {
    el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.75rem">No savings recorded yet. Start saving for Qurbani!</div>';
    return;
  }

  const total = savings.reduce((s,e)=>s+(e.amount||0),0);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:8px;
         background:rgba(212,160,23,0.1);margin-bottom:8px;font-size:12px">
      <span style="color:var(--gold-lt)">🐑 Total Saved</span>
      <span style="font-family:'Cinzel',serif;color:var(--gold-lt);font-weight:700">${fmt(total)}</span>
    </div>` +
    savings.map(e=>`
      <div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;
           background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);margin-bottom:5px">
        <div style="font-size:16px">🐑</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${e.note||'Savings'}</div>
          <div style="font-size:10px;color:var(--text-dim)">${e.date} · ${e.source||'Savings'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--gold-lt)">${fmt(e.amount)}</div>
          <div onclick="deleteBakridSaving('${e.id}')" style="font-size:10px;color:var(--fire-lt);cursor:pointer;opacity:.7;margin-top:2px">✕</div>
        </div>
      </div>`).join('');
}

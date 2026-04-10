/* ============================================================
   MEEZAN | js/zakat.js  — COMPLETE ZAKAT SYSTEM
   ✅ Monthly income-based zakat tracking
   ✅ Yearly asset-based zakat (gold/silver/investments)
   ✅ Carry-forward due system (unpaid → next month)
   ✅ Zakat payment recording
   ✅ Dashboard integration
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, setDoc, getDoc,
  serverTimestamp, where
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

/* ── Constants ── */
const GP    = { 24:6842, 22:6272, 18:5134, 14:3993 };
const SP    = 82;
const NISAB = 595; // grams silver
const fmt   = n => '₹' + Math.round(n||0).toLocaleString('en-IN');
const today = () => new Date().toISOString().slice(0,10);
const thisM = () => new Date().toISOString().slice(0,7);
const get   = id => document.getElementById(id);
const set   = (id,v) => { const el=get(id); if(el) el.textContent=v; };
const ICONS = { Salary:'💼', Freelance:'💻', Rental:'🏠', Business:'🏪', Investment:'📈', Gift:'🎁', Other:'💡' };

let currentUser=null, allIncome=[], allExpenses=[], allOrnaments=[];
let zakatPayments=[], zakatDueRecords=[];

/* ══════════════════════════════════════
   AUTH
   ══════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (!user) { location.href='../index.html'; return; }
  currentUser = user;
  const ma=get('mob-avatar'); if(ma) ma.textContent=(user.displayName||user.email||'M').substring(0,2).toUpperCase();
  const sd=get('sd-date'); if(sd) sd.value=today();
  set('nisab-gold',   fmt(85*GP[24]));
  set('nisab-silver', fmt(NISAB*SP));
  listenAll();
});

/* ══════════════════════════════════════
   REAL-TIME LISTENERS
   ══════════════════════════════════════ */
function listenAll() {
  const uid = currentUser.uid;
  const col = n => collection(db,'users',uid,n);

  onSnapshot(query(col('income'),   orderBy('date','desc')), s => {
    allIncome = s.docs.map(d=>({id:d.id,...d.data()}));
    recalc();
  });
  onSnapshot(query(col('expenses'), orderBy('date','desc')), s => {
    allExpenses = s.docs.map(d=>({id:d.id,...d.data()}));
    recalc();
  });
  onSnapshot(query(col('ornaments'),orderBy('date','desc')), s => {
    allOrnaments = s.docs.map(d=>({id:d.id,...d.data()}));
    recalc();
  });
  onSnapshot(query(col('zakatPayments'),orderBy('date','desc')), s => {
    zakatPayments = s.docs.map(d=>({id:d.id,...d.data()}));
    recalc();
    renderPaymentHistory();
  });
  onSnapshot(query(col('zakatDue'),orderBy('month','desc')), s => {
    zakatDueRecords = s.docs.map(d=>({id:d.id,...d.data()}));
    renderDueHistory();
  });
}

/* ══════════════════════════════════════
   MAIN RECALCULATION
   ══════════════════════════════════════ */
function recalc() {
  const nisabValue = NISAB * SP;
  const currentMonth = thisM();

  /* ── YEARLY ASSET ZAKAT (metals) ── */
  const kr = k => k===22?22/24:k===18?18/24:k===14?14/24:1;
  const metalValue = allOrnaments.reduce((s,o)=>
    s + (o.goldG||0)*GP[24]*kr(o.goldK||24) + (o.silvG||0)*SP, 0);
  const metalZakat = metalValue >= nisabValue ? Math.round(metalValue*0.025) : 0;

  /* ── MONTHLY INCOME ZAKAT ── */
  const monthIncome  = allIncome.filter(e=>(e.date||'').slice(0,7)===currentMonth).reduce((s,e)=>s+(e.amt||0),0);
  const monthExpense = allExpenses.filter(e=>(e.date||'').slice(0,7)===currentMonth).reduce((s,e)=>s+(e.amt||0),0);
  const monthSavings = Math.max(0, monthIncome - monthExpense);
  const savingsZakat = monthSavings >= nisabValue ? Math.round(monthSavings*0.025) : 0;

  /* ── ALL-TIME TOTALS ── */
  const totalIncome   = allIncome.reduce((s,e)=>s+(e.amt||0),0);
  const totalExpenses = allExpenses.reduce((s,e)=>s+(e.amt||0),0);
  const netSavings    = Math.max(0, totalIncome - totalExpenses);
  const netZakat      = netSavings >= nisabValue ? Math.round(netSavings*0.025) : 0;

  /* ── TOTAL ZAKAT DUE THIS MONTH ── */
  const totalZakatDue = savingsZakat + metalZakat;

  /* ── PAYMENTS THIS MONTH ── */
  const monthPaid = zakatPayments
    .filter(p=>(p.date||'').slice(0,7)===currentMonth)
    .reduce((s,p)=>s+(p.amount||0),0);

  /* ── CARRY-FORWARD FROM PREVIOUS MONTHS ── */
  const prevDue = zakatDueRecords
    .filter(r=>r.month < currentMonth && r.remaining > 0)
    .reduce((s,r)=>s+(r.remaining||0),0);

  const totalOwed  = totalZakatDue + prevDue;
  const stillOwed  = Math.max(0, totalOwed - monthPaid);

  /* ── UPDATE UI ── */
  // Summary cards
  set('z-total-income',   fmt(totalIncome));
  set('z-total-expense',  fmt(totalExpenses));
  set('z-net-savings',    fmt(netSavings));
  set('z-savings-nisab',  fmt(nisabValue));
  set('z-savings-zakat',  netZakat>0 ? fmt(netZakat) : 'None');

  // Monthly section
  set('z-month-income',   fmt(monthIncome));
  set('z-month-expense',  fmt(monthExpense));
  set('z-month-savings',  fmt(monthSavings));
  set('z-month-zakat',    savingsZakat>0 ? fmt(savingsZakat) : 'None');
  set('z-month-paid',     fmt(monthPaid));
  set('z-month-remaining',fmt(Math.max(0, savingsZakat - monthPaid)));

  // Carry-forward
  set('z-prev-due',       prevDue>0 ? fmt(prevDue) : '₹0');
  set('z-total-owed',     fmt(totalOwed));
  set('z-still-owed',     fmt(stillOwed));

  // Metal section
  set('z-metal-value',    fmt(metalValue));
  set('z-metal-nisab',    fmt(nisabValue));
  set('z-metal-zakat',    metalZakat>0 ? fmt(metalZakat) : 'None');

  const mmEl = get('z-metal-met');
  if (mmEl) { mmEl.textContent=metalValue>=nisabValue?'✓ Yes':'✗ Not yet'; mmEl.style.color=metalValue>=nisabValue?'var(--teal-lt)':'var(--fire-lt)'; }
  const smEl = get('z-savings-met');
  if (smEl) { smEl.textContent=netSavings>=nisabValue?'✓ Yes':'✗ Not yet'; smEl.style.color=netSavings>=nisabValue?'var(--teal-lt)':'var(--fire-lt)'; }

  // Big total
  set('z-total-zakat',    totalZakatDue>0 ? fmt(totalZakatDue) : 'None');
  set('z-savings-part',   savingsZakat>0 ? fmt(savingsZakat) : 'None');
  set('z-metal-part',     metalZakat>0   ? fmt(metalZakat)   : 'None');

  const bigEl = get('z-total-big');
  if (bigEl) {
    bigEl.textContent = totalZakatDue>0 ? fmt(totalZakatDue) : 'None';
    bigEl.style.color = totalZakatDue>0 ? 'var(--gold-lt)' : 'var(--text-dim)';
  }

  // Progress bar (nisab)
  const pct = Math.min(Math.round(netSavings/nisabValue*100),100);
  const bf  = get('nisab-bar-fill');  if(bf) bf.style.width=pct+'%';
  const bl  = get('nisab-bar-label'); if(bl) bl.textContent=pct+'% of Nisab (net savings)';

  // Payment progress bar
  const payPct = totalZakatDue>0 ? Math.min(Math.round(monthPaid/totalZakatDue*100),100) : 0;
  const ppf = get('payment-bar-fill'); if(ppf) ppf.style.width=payPct+'%';
  const ppl = get('payment-bar-label'); if(ppl) ppl.textContent=`${payPct}% paid this month`;

  // Top banner
  updateBanner(totalZakatDue, stillOwed, monthPaid);

  // Income type breakdown
  buildIncomeBreakdown();

  // Auto-save this month's due record to Firestore (for carry-forward)
  autoSaveDueRecord(currentMonth, totalZakatDue, monthPaid);
}

/* ══════════════════════════════════════
   AUTO-SAVE DUE RECORD (carry-forward)
   ══════════════════════════════════════ */
async function autoSaveDueRecord(month, totalDue, paid) {
  if (!currentUser || totalDue === 0) return;
  const remaining = Math.max(0, totalDue - paid);

  try {
    await setDoc(
      doc(db,'users',currentUser.uid,'zakatDue',month),
      { month, totalDue, paid, remaining, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch(e) { console.error('zakatDue save:', e); }
}

/* ══════════════════════════════════════
   BANNER
   ══════════════════════════════════════ */
function updateBanner(totalDue, stillOwed, monthPaid) {
  const banner = get('zakat-banner');
  if (!banner) return;
  if (totalDue > 0) {
    if (stillOwed > 0) {
      banner.style.cssText='background:rgba(212,160,23,0.12);border:1px solid rgba(212,160,23,0.3);border-radius:10px;padding:12px;text-align:center;font-size:13px;margin-bottom:1rem';
      banner.innerHTML=`⚖️ <strong>Zakat due: <span style="color:var(--gold-lt)">${fmt(totalDue)}</span></strong>
        ${monthPaid>0?`— Paid: <span style="color:var(--teal-lt)">${fmt(monthPaid)}</span> · Remaining: <span style="color:var(--fire-lt)">${fmt(stillOwed)}</span>`:'— Please pay promptly.'}`;
    } else {
      banner.style.cssText='background:rgba(26,188,156,0.12);border:1px solid rgba(26,188,156,0.3);border-radius:10px;padding:12px;text-align:center;font-size:13px;margin-bottom:1rem';
      banner.innerHTML=`✅ <strong>Zakat fully paid this month!</strong> <span style="color:var(--teal-lt)">JazakAllah Khair 🤲</span>`;
    }
  } else {
    banner.style.cssText='background:rgba(26,188,156,0.08);border:1px solid rgba(26,188,156,0.2);border-radius:10px;padding:12px;text-align:center;font-size:13px;margin-bottom:1rem';
    banner.innerHTML=`✓ Nisab not yet reached — no Zakat due. Keep saving, Insha'Allah.`;
  }
}

/* ══════════════════════════════════════
   INCOME BREAKDOWN BY TYPE
   ══════════════════════════════════════ */
function buildIncomeBreakdown() {
  const byType = {};
  allIncome.forEach(e=>{ byType[e.type]=(byType[e.type]||0)+(e.amt||0); });
  const ibd = get('income-type-breakdown');
  if (!ibd) return;
  ibd.innerHTML = Object.keys(byType).length
    ? Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,a])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;
             padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.04);margin-bottom:5px;font-size:12px">
          <span>${ICONS[t]||'💡'} ${t}</span>
          <div style="text-align:right">
            <span style="color:var(--teal-lt);font-family:'Cinzel',serif">${fmt(a)}</span>
            <span style="color:var(--text-dim);font-size:10px;display:block">Zakat: ${fmt(a*0.025)} (if held 1yr)</span>
          </div>
        </div>`).join('')
    : '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.5rem">No income records</div>';
}

/* ══════════════════════════════════════
   RENDER PAYMENT HISTORY
   ══════════════════════════════════════ */
function renderPaymentHistory() {
  const el = get('zakat-payment-history');
  if (!el) return;
  if (!zakatPayments.length) {
    el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.75rem">No payments recorded yet</div>';
    return;
  }
  const totalPaid = zakatPayments.reduce((s,p)=>s+(p.amount||0),0);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 10px;
         border-radius:8px;background:rgba(26,188,156,0.08);margin-bottom:8px">
      <span style="color:var(--teal-lt)">✅ Total Zakat Paid</span>
      <span style="font-family:'Cinzel',serif;color:var(--teal-lt);font-weight:700">${fmt(totalPaid)}</span>
    </div>` +
    zakatPayments.slice(0,8).map(p=>`
      <div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;
           background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);margin-bottom:5px">
        <div style="font-size:14px">⚖️</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${p.note||'Zakat payment'}</div>
          <div style="font-size:10px;color:var(--text-dim)">${p.date} · ${p.source||'General'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--teal-lt)">${fmt(p.amount)}</div>
          <div onclick="deleteZakatPayment('${p.id}')" style="font-size:10px;color:var(--fire-lt);cursor:pointer;opacity:.7;margin-top:2px">✕</div>
        </div>
      </div>`).join('');
}

/* ══════════════════════════════════════
   RENDER DUE HISTORY (carry-forward)
   ══════════════════════════════════════ */
function renderDueHistory() {
  const el = get('zakat-due-history');
  if (!el) return;
  const unpaid = zakatDueRecords.filter(r=>r.remaining>0);
  if (!unpaid.length) {
    el.innerHTML='<div style="color:var(--teal-lt);font-size:12px;text-align:center;padding:.5rem">✅ No outstanding dues</div>';
    return;
  }
  el.innerHTML = unpaid.map(r=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;
         border-radius:8px;background:rgba(212,160,23,0.08);border:1px solid rgba(212,160,23,0.2);margin-bottom:5px">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${r.month}</div>
        <div style="font-size:10px;color:var(--text-dim)">Due: ${fmt(r.totalDue)} · Paid: ${fmt(r.paid)}</div>
      </div>
      <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--amber)">Remaining: ${fmt(r.remaining)}</div>
    </div>`).join('');
}

/* ══════════════════════════════════════
   RECORD ZAKAT PAYMENT
   ══════════════════════════════════════ */
window.recordZakatPayment = async function() {
  const amount = parseFloat(get('zp-amount')?.value);
  const source = get('zp-source')?.value || 'Savings';
  const note   = get('zp-note')?.value?.trim() || 'Zakat payment';
  const date   = get('zp-date')?.value || today();

  if (isNaN(amount)||amount<=0) { alert('Enter a valid amount.'); return; }

  const btn = get('zp-submit');
  if (btn) { btn.textContent='Recording...'; btn.disabled=true; }

  try {
    await addDoc(collection(db,'users',currentUser.uid,'zakatPayments'), {
      amount, source, note, date,
      month: date.slice(0,7),
      uid: currentUser.uid,
      createdAt: serverTimestamp()
    });

    // Clear form
    if(get('zp-amount')) get('zp-amount').value='';
    if(get('zp-note'))   get('zp-note').value='';
    if(get('zp-date'))   get('zp-date').value=today();

    showMsg('zp-msg','✓ Zakat payment recorded!','teal');
  } catch(e) {
    showMsg('zp-msg','Error: '+e.message,'fire');
  }
  if (btn) { btn.textContent='✓ Record Payment'; btn.disabled=false; }
};

window.deleteZakatPayment = async function(id) {
  if (!confirm('Remove this payment?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'zakatPayments',id));
};

/* ══════════════════════════════════════
   MANUAL CALCULATOR
   ══════════════════════════════════════ */
window.calcZakat = () => {
  const gG=parseFloat(get('z-goldg')?.value)||0, kK=parseInt(get('z-karat')?.value)||22;
  const sG=parseFloat(get('z-silvg')?.value)||0, ca=parseFloat(get('z-cash')?.value)||0;
  const iv=parseFloat(get('z-invest')?.value)||0, dt=parseFloat(get('z-debt')?.value)||0;
  const hD=get('z-hawldate')?.value||'';
  const gV=Math.round(gG*(GP[kK]||GP[22])), sV=Math.round(sG*SP);
  const nV=Math.round(NISAB*SP), tot=Math.max(0,gV+sV+ca+iv-dt);
  const met=tot>=nV, zk=met?Math.round(tot*0.025):0;

  if (hD) {
    const hw=get('hawl-progress-wrap'); if(hw) hw.style.display='block';
    const days=Math.floor((Date.now()-new Date(hD))/86400000), pct=Math.min(Math.round(days/354*100),100);
    const ci=get('hawl-circle'); if(ci) ci.setAttribute('stroke-dashoffset',251-Math.round(pct/100*251));
    const hp=get('hawl-pct'); if(hp) hp.textContent=pct+'%';
    const hl=get('hawl-label'); if(hl) hl.textContent=days>=354?'✓ Hawl complete!':days+'/354 days';
  }

  const res=get('zakat-result');
  if (res) {
    res.style.display='block';
    res.innerHTML=`<div style="text-align:center;padding:.75rem 0">
      <div style="font-size:11px;color:var(--text-dim)">MANUAL CALCULATION</div>
      <div style="font-family:'Cinzel',serif;font-size:28px;color:${met?'var(--gold-lt)':'var(--text-dim)'};margin:4px 0">${fmt(zk)}</div>
      <div style="font-size:12px;color:${met?'var(--teal-lt)':'var(--fire-lt)'}">${met?'✓ Nisab met — Zakat is due at 2.5%':'✗ Nisab not met — no Zakat yet'}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-top:.5rem">
      ${[['Gold',fmt(gV),'var(--gold)'],['Silver',fmt(sV),'var(--gold)'],['Cash+Invest',fmt(ca+iv),'var(--teal-lt)'],['Debts','-'+fmt(dt),'var(--fire-lt)']].map(([l,v,c])=>`
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px">
        <div style="color:var(--text-dim)">${l}</div><div style="color:${c};font-weight:600">${v}</div>
      </div>`).join('')}
      <div style="background:rgba(255,255,255,.04);border-radius:8px;padding:8px;grid-column:1/-1">
        <div style="color:var(--text-dim)">Total Zakatable</div>
        <div style="color:var(--gold-lt);font-weight:700">${fmt(tot)}</div>
      </div>
    </div>`;
  }
};

/* ── Helpers ── */
function showMsg(id, msg, type) {
  const el=get(id); if(!el) return;
  el.textContent=msg; el.style.color=type==='teal'?'var(--teal-lt)':'var(--fire-lt)';
  setTimeout(()=>{el.textContent='';},3000);
}

window.setTheme=th=>{document.documentElement.setAttribute('data-theme',th);localStorage.setItem('meezan-theme',th);document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th));};
const _t=localStorage.getItem('meezan-theme')||'glass';
document.documentElement.setAttribute('data-theme',_t);

/* ============================================================
   MEEZAN — ميزان  |  js/expenses.js
   UPDATED: Added "income source" field — track which income
   you're spending from (Salary, Freelance, Gift, etc.)
   ============================================================ */

import { initializeApp }                      from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged }         from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc,
         deleteDoc, updateDoc, doc,
         query, orderBy, onSnapshot,
         serverTimestamp }                     from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app  = initializeApp({ apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",authDomain:"meezan-app-8a41a.firebaseapp.com",projectId:"meezan-app-8a41a",storageBucket:"meezan-app-8a41a.firebasestorage.app",messagingSenderId:"767947145877",appId:"1:767947145877:web:d837e0b30258405339519c" });
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── MAPS ── */
const EICONS  = { Food:'🍽️',Shopping:'🛍️',Transport:'🚆',Utilities:'💡',Charity:'🤲',Entertainment:'🎬',Education:'📚',Health:'🏥',Zakat:'⚖️',Other:'💰' };
const ECLRS   = { Food:'ib-food',Shopping:'ib-shop',Transport:'ib-tran',Utilities:'ib-util',Charity:'ib-char',Entertainment:'ib-ent',Education:'ib-edu',Health:'ib-hlth',Zakat:'ib-char',Other:'ib-misc' };
const ECOLORS = { Food:'#e74c3c',Shopping:'#9b59b6',Transport:'#3498db',Utilities:'#e67e22',Charity:'#1abc9c',Entertainment:'#f39c12',Education:'#2ecc71',Health:'#1abc9c',Zakat:'#48d1b0',Other:'#95a5a6' };

/* ── Income source icons (for expense tagging) ── */
const ISRC_ICONS = { Salary:'💼', Freelance:'💻', Rental:'🏠', Business:'🏪', Investment:'📈', Gift:'🎁', 'Eid/Gift':'🎁', Other:'💡', Any:'🔀' };
const ISRC_ALL   = ['Any','Salary','Freelance','Rental','Business','Investment','Gift','Eid/Gift','Other'];

/* ── STATE ── */
let allExp=[], allIncome=[], activeCat='All', editingId=null, dateFrom=null, dateTo=null, currentUser=null, showAllExp=false;

const fmt       = n  => '₹'+Math.round(n||0).toLocaleString('en-IN');
const today     = () => new Date().toISOString().slice(0,10);
const thisMonth = () => new Date().toISOString().slice(0,7);
const escHtml   = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── AUTH GUARD ── */
onAuthStateChanged(auth, user => {
  if (!user) { location.href='../index.html'; return; }
  currentUser = user;
  const init = (user.displayName||user.email||'M').substring(0,2).toUpperCase();
  const ma = document.getElementById('mob-avatar'); if(ma) ma.textContent=init;
  document.getElementById('ef-date').value = today();
  const now=new Date(), y=now.getFullYear(), m=String(now.getMonth()+1).padStart(2,'0');
  const fd=document.getElementById('from-date'); if(fd) fd.value=`${y}-${m}-01`;
  const td=document.getElementById('to-date');   if(td) td.value=today();
  buildIncomeSrcOptions();
  startListener();
  listenIncome();
});

/* ── BUILD INCOME SOURCE DROPDOWN ── */
function buildIncomeSrcOptions() {
  const sel = document.getElementById('ef-income-src');
  if (!sel) return;
  sel.innerHTML = ISRC_ALL.map(src =>
    `<option value="${src}">${ISRC_ICONS[src]||'💡'} ${src}</option>`
  ).join('');
}

/* ── LISTEN TO INCOME (to show real named sources) ── */
function listenIncome() {
  const q = query(collection(db,'users',currentUser.uid,'income'), orderBy('date','desc'));
  onSnapshot(q, snap => {
    allIncome = snap.docs.map(d=>({id:d.id,...d.data()}));
    buildIncomeSourceDropdown();
  });
}

/* ── Build dropdown from actual income records ONLY ── */
/* Shows "Any" + your real named income sources - no duplicate generic types */
function buildIncomeSourceDropdown() {
  const sel = document.getElementById('ef-income-src');
  if (!sel) return;

  // Get unique income sources by name from Firestore
  const uniqueSources = [];
  const seen = new Set();
  allIncome.forEach(inc => {
    const key = inc.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSources.push({ name: inc.name, type: inc.type });
    }
  });

  if (uniqueSources.length > 0) {
    // If we have real sources, show: Any + real named sources only
    sel.innerHTML =
      `<option value="Any">${ISRC_ICONS['Any']} Any / General</option>` +
      uniqueSources.map(s =>
        `<option value="${s.name}">${ISRC_ICONS[s.type]||'💡'} ${escHtml(s.name)}</option>`
      ).join('');
  } else {
    // Fallback to generic types if no income records yet
    sel.innerHTML = ISRC_ALL.map(src =>
      `<option value="${src}">${ISRC_ICONS[src]||'💡'} ${src}</option>`
    ).join('');
  }
}

/* ── FIRESTORE LISTENER ── */
function startListener() {
  const q = query(collection(db,'users',currentUser.uid,'expenses'), orderBy('date','desc'));
  onSnapshot(q, snap => {
    allExp = snap.docs.map(d=>({id:d.id,...d.data()}));
    render(); updateSummary(); buildChart(); buildCatBreakdown(); buildSourceBreakdown();
  });
}

/* ── GET FILTERED DATA ── */
function getFiltered() {
  let data = allExp;
  if (activeCat !== 'All') data = data.filter(e=>e.cat===activeCat);
  if (dateFrom) data = data.filter(e=>e.date >= dateFrom);
  if (dateTo)   data = data.filter(e=>e.date <= dateTo);
  return data;
}

/* ── RENDER EXPENSE LIST ── */
function render() {
  const list = document.getElementById('expense-list');
  const data = getFiltered();
  const fc = document.getElementById('filtered-count');
  if (fc) fc.textContent = data.length + ' records';
  if (!data.length) {
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><div>${activeCat!=='All'?'Try selecting "All" category.':'Add your first expense below.'}</div></div>`;
    return;
  }
  const PREVIEW = 6;
  const visible = showAllExp ? data : data.slice(0, PREVIEW);
  const hasMore = data.length > PREVIEW;

  const rowsHtml = visible.map(e=>`
    <div class="exp-row">
      <div class="exp-icon ${ECLRS[e.cat]||'ib-misc'}">${EICONS[e.cat]||'💰'}</div>
      <div class="exp-body">
        <div class="exp-name">${escHtml(e.name)}</div>
        <div class="exp-meta">${e.date} · ${e.cat}${e.incomeSrc&&e.incomeSrc!=='Any'?` · <span style="color:var(--teal-lt);font-size:9px">${ISRC_ICONS[e.incomeSrcType]||ISRC_ICONS['Other']} from ${escHtml(e.incomeSrc)}</span>`:''}</div>
        ${e.notes?`<div class="exp-meta" style="color:var(--text-mid)">${escHtml(e.notes)}</div>`:''}
      </div>
      <div>
        <div class="exp-amount">-${fmt(e.amt)}</div>
        <div class="exp-actions">
          <div class="act-btn act-edit" onclick="editExp('${e.id}')" title="Edit">✏️</div>
          <div class="act-btn act-del"  onclick="deleteExp('${e.id}')" title="Delete">🗑️</div>
        </div>
      </div>
    </div>`).join('');

  const toggleBtn = hasMore ? `
    <div style="text-align:center;margin-top:10px">
      <button onclick="toggleShowAllExp()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
        color:var(--fire-lt);padding:7px 20px;border-radius:20px;font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.2s"
        onmouseover="this.style.background='rgba(192,57,43,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
        ${showAllExp ? '▲ Show less' : '▼ Show all ' + data.length + ' records'}
      </button>
    </div>` : '';

  list.innerHTML = rowsHtml + toggleBtn;
}

window.toggleShowAllExp = function() {
  showAllExp = !showAllExp;
  render();
};

/* ── SUMMARY ── */
function updateSummary() {
  const total   = allExp.reduce((s,e)=>s+e.amt,0);
  const month   = allExp.filter(e=>(e.date||'').slice(0,7)===thisMonth()).reduce((s,e)=>s+e.amt,0);
  const charity = allExp.filter(e=>e.cat==='Charity'||e.cat==='Zakat').reduce((s,e)=>s+e.amt,0);
  const s_t = document.getElementById('s-total');   if(s_t) s_t.textContent=fmt(total);
  const s_m = document.getElementById('s-month');   if(s_m) s_m.textContent=fmt(month);
  const s_c = document.getElementById('s-count');   if(s_c) s_c.textContent=allExp.length;
  const s_ch= document.getElementById('s-charity'); if(s_ch) s_ch.textContent=fmt(charity);
}

/* ── MONTHLY CHART ── */
function buildChart() {
  const el=document.getElementById('exp-chart'); if(!el) return; el.innerHTML='';
  const months=[],byM={};
  const now=new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=d.toISOString().slice(0,7);
    months.push({key,lbl:d.toLocaleString('en',{month:'short'})});
    byM[key]=allExp.filter(e=>(e.date||'').slice(0,7)===key).reduce((s,e)=>s+e.amt,0);
  }
  const maxV=Math.max(...Object.values(byM),1);
  months.forEach(({key,lbl})=>{
    const h=Math.round((byM[key]||0)/maxV*52);
    const bw=document.createElement('div'); bw.className='bar-wrap';
    bw.innerHTML=`<div style="display:flex;align-items:flex-end;height:52px"><div class="bar" style="background:linear-gradient(180deg,#c0392b,#8b1a00);height:${h}px;width:20px"></div></div><div class="bar-month">${lbl}</div>`;
    el.appendChild(bw);
  });
}

/* ── CATEGORY BREAKDOWN ── */
function buildCatBreakdown() {
  const total=allExp.reduce((s,e)=>s+e.amt,0)||1;
  const byC={};
  allExp.forEach(e=>{byC[e.cat]=(byC[e.cat]||0)+e.amt;});
  const sorted=Object.entries(byC).sort((a,b)=>b[1]-a[1]);
  const el=document.getElementById('cat-breakdown'); if(!el) return;
  el.innerHTML=sorted.map(([cat,amt])=>`
    <div class="cb-row">
      <div class="cb-icon">${EICONS[cat]||'💰'}</div>
      <div class="cb-label">${cat}</div>
      <div class="cb-bar-wrap"><div class="cb-bar-track"><div class="cb-bar-fill" style="width:${Math.round(amt/total*100)}%;background:${ECOLORS[cat]||'#95a5a6'}"></div></div></div>
      <div class="cb-amount">-${fmt(amt)}</div>
    </div>`).join('')||'<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.5rem">No data yet</div>';
}

/* ── INCOME SOURCE BREAKDOWN (NEW) ── */
function buildSourceBreakdown() {
  const el = document.getElementById('source-breakdown');
  if (!el) return;
  const withSrc = allExp.filter(e => e.incomeSrc && e.incomeSrc !== 'Any');
  if (!withSrc.length) {
    el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:.5rem">No income source tagged yet</div>';
    return;
  }
  const total = withSrc.reduce((s,e)=>s+e.amt,0)||1;
  const byS = {};
  withSrc.forEach(e=>{ byS[e.incomeSrc]=(byS[e.incomeSrc]||0)+e.amt; });
  const sorted = Object.entries(byS).sort((a,b)=>b[1]-a[1]);
  el.innerHTML = sorted.map(([src,amt])=>`
    <div class="cb-row">
      <div class="cb-icon">${ISRC_ICONS[src]||'💡'}</div>
      <div class="cb-label">${src}</div>
      <div class="cb-bar-wrap"><div class="cb-bar-track"><div class="cb-bar-fill" style="width:${Math.round(amt/total*100)}%;background:var(--teal)"></div></div></div>
      <div class="cb-amount" style="color:var(--fire-lt)">-${fmt(amt)}</div>
    </div>`).join('');
}

/* ── FILTERS ── */
window.filterCat = (cat,el) => {
  activeCat=cat;
  document.querySelectorAll('#cat-filters .cf').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  render();
};

window.setDateRange = (range,el) => {
  document.querySelectorAll('[id^="dr-"]').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  const cd=document.getElementById('custom-dates'); if(cd) cd.style.display='none';
  const now=new Date(),y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
  if(range==='all')  { dateFrom=null; dateTo=null; }
  if(range==='month'){ dateFrom=`${y}-${String(m+1).padStart(2,'0')}-01`; dateTo=today(); }
  if(range==='week') { const s=new Date(now); s.setDate(d-now.getDay()); dateFrom=s.toISOString().slice(0,10); dateTo=today(); }
  render();
};

window.applyCustom = () => {
  dateFrom=document.getElementById('from-date')?.value;
  dateTo  =document.getElementById('to-date')?.value;
  render();
};

window.toggleCustom = () => {
  const el=document.getElementById('custom-dates');
  if(el) el.style.display=el.style.display==='none'||!el.style.display?'flex':'none';
};

/* ── ADD / EDIT ── */
window.submitExpense = async () => {
  const name      = document.getElementById('ef-name').value.trim();
  const amt       = parseFloat(document.getElementById('ef-amt').value);
  const cat       = document.getElementById('ef-cat').value;
  const date      = document.getElementById('ef-date').value;
  const notes     = document.getElementById('ef-notes').value.trim();
  const incomeSrc = document.getElementById('ef-income-src')?.value || 'Any';
  if(!name){ alert('Enter item name.'); return; }
  if(isNaN(amt)||amt<=0){ alert('Enter valid amount.'); return; }
  if(!date){ alert('Select a date.'); return; }

  // Find the type of the selected income source
  const matchedIncome = allIncome.find(i => i.name === incomeSrc);
  const incomeSrcType = matchedIncome ? matchedIncome.type : incomeSrc;

  const data={name,amt,cat,date,notes,incomeSrc,incomeSrcType,uid:currentUser.uid};
  try {
    if(editingId){
      await updateDoc(doc(db,'users',currentUser.uid,'expenses',editingId),data);
      cancelExpEdit();
    } else {
      await addDoc(collection(db,'users',currentUser.uid,'expenses'),{...data,createdAt:serverTimestamp()});

      /* ── AUTO SYNC: Charity + Zakat expenses → sadaqah collection ──
         This means every Charity/Zakat expense AUTOMATICALLY appears
         on the Sadaqah page — no double entry needed            ── */
      if (cat === 'Charity' || cat === 'Zakat') {
        const sdCat = cat === 'Zakat' ? 'Zakat' : 'Sadaqah';
        await addDoc(collection(db,'users',currentUser.uid,'sadaqah'), {
          amt:       amt,
          date:      date,
          desc:      name + (notes ? ' — ' + notes : ''),
          cat:       sdCat,
          fromExpense: true,        // marks it came from expenses (to avoid double-counting)
          uid:       currentUser.uid,
          createdAt: serverTimestamp()
        });
      }
    }
    clearExpForm();
  } catch(e){ alert('Error: '+e.message); }
};

window.editExp = id => {
  const row=allExp.find(x=>x.id===id); if(!row) return;
  editingId=id;
  document.getElementById('ef-name').value  = row.name;
  document.getElementById('ef-amt').value   = row.amt;
  document.getElementById('ef-cat').value   = row.cat;
  document.getElementById('ef-date').value  = row.date;
  document.getElementById('ef-notes').value = row.notes||'';
  const src=document.getElementById('ef-income-src'); if(src) src.value=row.incomeSrc||'Any';
  const ft=document.getElementById('exp-form-title');  if(ft) ft.textContent='✏️ Edit Expense';
  const ab=document.getElementById('exp-add-btn');     if(ab) ab.textContent='✓ Save Changes';
  const cb=document.getElementById('exp-cancel-btn');  if(cb) cb.style.display='block';
  document.getElementById('exp-add-btn')?.scrollIntoView({behavior:'smooth',block:'center'});
};

window.cancelExpEdit = () => {
  editingId=null; clearExpForm();
  const ft=document.getElementById('exp-form-title');  if(ft) ft.textContent='➕ Add Expense';
  const ab=document.getElementById('exp-add-btn');     if(ab) ab.textContent='− Add Expense';
  const cb=document.getElementById('exp-cancel-btn');  if(cb) cb.style.display='none';
};

window.deleteExp = async id => {
  if(!confirm('Delete this expense?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'expenses',id));
};

function clearExpForm() {
  const ids=['ef-name','ef-amt','ef-notes'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const cat=document.getElementById('ef-cat');        if(cat) cat.value='Food';
  const dt=document.getElementById('ef-date');        if(dt)  dt.value=today();
  const src=document.getElementById('ef-income-src'); if(src) src.value='Any';
}

/* ============================================================
   MEEZAN — ميزان  |  js/assets.js
   Assets page — ornaments with component breakdown + Zakat
   ============================================================ */

import { initializeApp }              from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, updateDoc,
         doc, query, orderBy, onSnapshot, serverTimestamp }
                                       from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app = initializeApp({ apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",authDomain:"meezan-app-8a41a.firebaseapp.com",projectId:"meezan-app-8a41a",storageBucket:"meezan-app-8a41a.firebasestorage.app",messagingSenderId:"767947145877",appId:"1:767947145877:web:d837e0b30258405339519c" });
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── METAL PRICES (update daily or via API) ── */
const GP = { 24:6842, 22:6272, 18:5134, 14:3993 };
const SP = 82;
const NISAB_AG = 595;

let ornaments=[], editingId=null, currentUser=null;
const fmt  = n => '₹'+Math.round(n||0).toLocaleString('en-IN');
const fmtG = n => (+n||0).toFixed(2)+'g';
const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const today= () => new Date().toISOString().slice(0,10);

function gVal(g,k){ return Math.round((g||0)*(GP[k]||GP[22])); }
function sVal(g)  { return Math.round((g||0)*SP); }
function presentVal(o){ return gVal(o.goldG,o.goldK)+sVal(o.silvG)+(o.diamV||0)+(o.stonV||0)+(o.makeV||0); }
function zakatMetal(o){ return gVal(o.goldG,o.goldK)+sVal(o.silvG); }

/* ── AUTH GUARD ── */
onAuthStateChanged(auth, user => {
  if(!user){ location.href='../index.html'; return; }
  currentUser=user;
  const ma=document.getElementById('mob-avatar'); if(ma) ma.textContent=(user.displayName||user.email||'M').substring(0,2).toUpperCase();
  document.getElementById('of-date').value=today();
  // Update metal price display
  document.getElementById('mp-24k').textContent  = '₹'+GP[24].toLocaleString('en-IN');
  document.getElementById('mp-22k').textContent  = '₹'+GP[22].toLocaleString('en-IN');
  document.getElementById('mp-si').textContent   = '₹'+SP;
  document.getElementById('mp-nisab').textContent= '₹'+(NISAB_AG*SP).toLocaleString('en-IN');
  startListener();
});

/* ── FIRESTORE LISTENER ── */
function startListener() {
  const q = query(collection(db,'users',currentUser.uid,'ornaments'), orderBy('date','desc'));
  onSnapshot(q, snap => {
    ornaments = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderOrnaments();
    updateSummary();
    updateZakat();
  });
}

/* ── RENDER ORNAMENT CARDS ── */
function renderOrnaments() {
  const list = document.getElementById('orn-list');
  if(!ornaments.length){ list.innerHTML='<div class="empty-state"><div class="empty-icon">💍</div><div>No assets added yet.<br>Add your first ornament using the form.</div></div>'; return; }
  list.innerHTML = ornaments.map(o=>{
    const gv=gVal(o.goldG,o.goldK), sv=sVal(o.silvG), pv=presentVal(o);
    const pnl=pv-(o.buyPrice||0), pnlPct=o.buyPrice?((pnl/o.buyPrice)*100).toFixed(1):0;
    const total=gv+sv+(o.diamV||0)+(o.stonV||0)+(o.makeV||0)||1;
    const gpct=Math.round(gv/total*100), spct=Math.round(sv/total*100);
    const dpct=Math.round((o.diamV||0)/total*100), stpct=Math.round((o.stonV||0)/total*100);
    const mpct=Math.round((o.makeV||0)/total*100);
    const hasZakat=o.goldG>0||o.silvG>0;
    return `
    <div class="orn-card" id="oc-${o.id}">
      <div class="orn-header" onclick="toggleOrn('${o.id}')">
        <div class="orn-ico">💍</div>
        <div class="orn-meta-wrap">
          <div class="orn-name">${esc(o.name)}</div>
          <div class="orn-submeta">${o.type||'Ornament'} · ${o.date}${o.notes?` · ${esc(o.notes)}`:''}</div>
        </div>
        <div class="orn-vals">
          <div class="orn-buy">Bought: ${fmt(o.buyPrice)}</div>
          <div class="orn-now">${fmt(pv)}</div>
          <div class="orn-pnl ${pnl>=0?'pnl-up':'pnl-dn'}">${pnl>=0?'▲':'▼'} ${fmt(Math.abs(pnl))} (${Math.abs(pnlPct)}%)</div>
        </div>
        <div class="orn-chev">▼</div>
        <div class="act-btn act-del" onclick="event.stopPropagation();delOrn('${o.id}')" title="Delete" style="opacity:1;margin-left:4px">🗑️</div>
      </div>
      <div class="orn-detail">
        ${o.goldG>0?`<div class="comp-row"><div class="comp-dot" style="background:var(--gold)"></div><span class="comp-label">Gold ${o.goldK}K</span><span class="comp-qty">${fmtG(o.goldG)}</span><span class="comp-val" style="color:var(--gold-lt)">${fmt(gv)}</span></div>`:''}
        ${o.silvG>0?`<div class="comp-row"><div class="comp-dot" style="background:var(--silver)"></div><span class="comp-label">Silver</span><span class="comp-qty">${fmtG(o.silvG)}</span><span class="comp-val" style="color:var(--silver-lt)">${fmt(sv)}</span></div>`:''}
        ${(o.diamV||0)>0?`<div class="comp-row"><div class="comp-dot" style="background:var(--diamond)"></div><span class="comp-label">Diamond/gems</span><span class="comp-qty">as valued</span><span class="comp-val" style="color:var(--diamond)">${fmt(o.diamV)}</span></div>`:''}
        ${(o.stonV||0)>0?`<div class="comp-row"><div class="comp-dot" style="background:var(--stone)"></div><span class="comp-label">Precious stones</span><span class="comp-qty">as valued</span><span class="comp-val" style="color:var(--stone-lt)">${fmt(o.stonV)}</span></div>`:''}
        ${(o.makeV||0)>0?`<div class="comp-row"><div class="comp-dot" style="background:rgba(255,255,255,.2)"></div><span class="comp-label">Making charges</span><span class="comp-qty">labour</span><span class="comp-val" style="color:var(--text-mid)">${fmt(o.makeV)}</span></div>`:''}
        <div class="comp-bar-track">
          ${gpct>0?`<div class="comp-bar-seg" style="width:${gpct}%;background:var(--gold)"></div>`:''}
          ${spct>0?`<div class="comp-bar-seg" style="width:${spct}%;background:var(--silver)"></div>`:''}
          ${dpct>0?`<div class="comp-bar-seg" style="width:${dpct}%;background:var(--diamond)"></div>`:''}
          ${stpct>0?`<div class="comp-bar-seg" style="width:${stpct}%;background:var(--stone)"></div>`:''}
          ${mpct>0?`<div class="comp-bar-seg" style="width:${mpct}%;background:rgba(255,255,255,.15)"></div>`:''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:5px;font-size:9px;color:var(--text-dim)">
          ${gpct>0?`<span><span style="color:var(--gold)">■</span> Gold ${gpct}%</span>`:''}
          ${spct>0?`<span><span style="color:var(--silver)">■</span> Silver ${spct}%</span>`:''}
          ${dpct>0?`<span><span style="color:var(--diamond)">■</span> Diamond ${dpct}%</span>`:''}
          ${stpct>0?`<span><span style="color:var(--stone)">■</span> Stones ${stpct}%</span>`:''}
        </div>
        ${hasZakat?`<span class="zakat-chip">⚖️ ${fmtG(o.goldG)} gold + ${fmtG(o.silvG)} silver — Zakat eligible</span>`:`<span class="zakat-chip no">No metal — not Zakat-eligible</span>`}
        <div style="margin-top:8px">
          <button class="btn btn-ghost" onclick="editOrn('${o.id}')" style="width:auto;padding:6px 14px;font-size:11px">✏️ Edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

window.toggleOrn = id => { document.getElementById('oc-'+id)?.classList.toggle('open'); };

/* ── SUMMARY ── */
function updateSummary() {
  const totalBuy=ornaments.reduce((s,o)=>s+(o.buyPrice||0),0);
  const totalNow=ornaments.reduce((s,o)=>s+presentVal(o),0);
  const goldG=ornaments.reduce((s,o)=>s+(o.goldG||0),0);
  const silvG=ornaments.reduce((s,o)=>s+(o.silvG||0),0);
  document.getElementById('as-buy').textContent  = fmt(totalBuy);
  document.getElementById('as-now').textContent  = fmt(totalNow);
  document.getElementById('as-goldg').textContent= fmtG(goldG);
  document.getElementById('as-silvg').textContent= fmtG(silvG);
}

/* ── ZAKAT ── */
function updateZakat() {
  const goldG   = ornaments.reduce((s,o)=>s+(o.goldG||0),0);
  const silvG   = ornaments.reduce((s,o)=>s+(o.silvG||0),0);
  const metalVal= ornaments.reduce((s,o)=>s+zakatMetal(o),0);
  const nisabVal= Math.round(NISAB_AG*SP);
  const met     = metalVal>=nisabVal;
  const due     = met?Math.round(metalVal*0.025):0;
  document.getElementById('zk-goldg').textContent = fmtG(goldG);
  document.getElementById('zk-silvg').textContent = fmtG(silvG);
  document.getElementById('zk-metval').textContent= fmt(metalVal);
  document.getElementById('zk-nisab').textContent = fmt(nisabVal);
  const metEl=document.getElementById('zk-met');
  metEl.textContent=met?'✓ Yes':'✗ Not yet'; metEl.className='zp-val '+(met?'zp-met':'zp-no');
  document.getElementById('zk-due').textContent=fmt(due);
  const badge=document.getElementById('zk-badge');
  if(!ornaments.length){ badge.textContent='Add ornaments to calculate Zakat'; badge.className='zp-badge warn'; }
  else if(met){ badge.textContent=`✨ Zakat is due — ${fmt(due)} (2.5% on metals only)`; badge.className='zp-badge'; }
  else{ badge.textContent=`Metal value ${fmt(metalVal)} — Nisab ${fmt(nisabVal)} not met`; badge.className='zp-badge warn'; }
}

/* ── LIVE ESTIMATE ── */
window.liveEstimate = () => {
  const goldG=parseFloat(document.getElementById('of-goldg').value)||0;
  const goldK=parseInt(document.getElementById('of-karat').value)||22;
  const silvG=parseFloat(document.getElementById('of-silvg').value)||0;
  const diamV=parseFloat(document.getElementById('of-diamv').value)||0;
  const stonV=parseFloat(document.getElementById('of-stonv').value)||0;
  const makeV=parseFloat(document.getElementById('of-makev').value)||0;
  const gv=gVal(goldG,goldK),sv=sVal(silvG);
  const total=gv+sv+diamV+stonV+makeV;
  const prev=document.getElementById('live-preview');
  if(!total){ prev.style.display='none'; return; }
  prev.style.display='block';
  prev.innerHTML=[
    `<div style="color:var(--gold);font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Live estimate</div>`,
    gv>0?`<div style="display:flex;justify-content:space-between;color:var(--gold)"><span>Gold ${goldG}g × ₹${GP[goldK]}/g (${goldK}K)</span><span>${fmt(gv)}</span></div>`:'',
    sv>0?`<div style="display:flex;justify-content:space-between;color:var(--silver-lt)"><span>Silver ${silvG}g × ₹${SP}/g</span><span>${fmt(sv)}</span></div>`:'',
    diamV>0?`<div style="display:flex;justify-content:space-between;color:var(--diamond)"><span>Diamond / gems</span><span>${fmt(diamV)}</span></div>`:'',
    stonV>0?`<div style="display:flex;justify-content:space-between;color:var(--stone-lt)"><span>Precious stones</span><span>${fmt(stonV)}</span></div>`:'',
    makeV>0?`<div style="display:flex;justify-content:space-between;color:var(--text-dim)"><span>Making charges</span><span>${fmt(makeV)}</span></div>`:'',
    `<div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.08);margin-top:4px;padding-top:4px;font-weight:600;color:var(--gold-lt)"><span>Present value</span><span>${fmt(total)}</span></div>`,
  ].join('');
};

/* ── SUBMIT ── */
window.submitOrnament = async () => {
  const name  = document.getElementById('of-name').value.trim();
  if(!name){ alert('Enter ornament name.'); return; }
  const data = {
    name, type:document.getElementById('of-type').value,
    buyPrice:parseFloat(document.getElementById('of-buy').value)||0,
    date:document.getElementById('of-date').value||today(),
    goldG:parseFloat(document.getElementById('of-goldg').value)||0,
    goldK:parseInt(document.getElementById('of-karat').value)||22,
    silvG:parseFloat(document.getElementById('of-silvg').value)||0,
    diamV:parseFloat(document.getElementById('of-diamv').value)||0,
    stonV:parseFloat(document.getElementById('of-stonv').value)||0,
    makeV:parseFloat(document.getElementById('of-makev').value)||0,
    notes:document.getElementById('of-notes').value.trim(),
    uid:currentUser.uid,
  };
  try {
    if(editingId){ await updateDoc(doc(db,'users',currentUser.uid,'ornaments',editingId),data); cancelOrnEdit(); }
    else { await addDoc(collection(db,'users',currentUser.uid,'ornaments'),{...data,createdAt:serverTimestamp()}); }
    clearOrnForm();
  } catch(e){ alert('Error: '+e.message); }
};

/* ── EDIT ── */
window.editOrn = id => {
  const o=ornaments.find(x=>x.id===id); if(!o) return;
  editingId=id;
  document.getElementById('of-name').value   = o.name;
  document.getElementById('of-type').value   = o.type||'Necklace';
  document.getElementById('of-buy').value    = o.buyPrice||'';
  document.getElementById('of-date').value   = o.date;
  document.getElementById('of-goldg').value  = o.goldG||'';
  document.getElementById('of-karat').value  = o.goldK||22;
  document.getElementById('of-silvg').value  = o.silvG||'';
  document.getElementById('of-diamv').value  = o.diamV||'';
  document.getElementById('of-stonv').value  = o.stonV||'';
  document.getElementById('of-makev').value  = o.makeV||'';
  document.getElementById('of-notes').value  = o.notes||'';
  document.getElementById('orn-form-title').textContent='✏️ Edit Ornament';
  document.getElementById('orn-add-btn').textContent='✓ Save Changes';
  document.getElementById('orn-cancel-btn').style.display='block';
  liveEstimate();
  document.getElementById('orn-add-btn').scrollIntoView({behavior:'smooth',block:'center'});
};

window.cancelOrnEdit = () => {
  editingId=null; clearOrnForm();
  document.getElementById('orn-form-title').textContent='➕ Add Ornament / Asset';
  document.getElementById('orn-add-btn').textContent='+ Add Ornament';
  document.getElementById('orn-cancel-btn').style.display='none';
};

window.delOrn = async id => {
  if(!confirm('Delete this ornament?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'ornaments',id));
};

function clearOrnForm() {
  ['of-name','of-buy','of-goldg','of-silvg','of-diamv','of-stonv','of-makev','of-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('of-type').value='Necklace';
  document.getElementById('of-karat').value='22';
  document.getElementById('of-date').value=today();
  document.getElementById('live-preview').style.display='none';
}

/* ============================================================
   MEEZAN | js/family.js  — COMPLETE FAMILY HUB v2
   ✅ Personal family members + invites (WhatsApp/email)
   ✅ Expense Groups (trips, events, shared meals)
   ✅ Splitwise-style settlement: exact payment instructions
   ✅ Equal / selected members / custom splits
   ✅ Group status: ongoing → completed
   ✅ "Add all to main expenses" on completion
   ✅ Real-time Firestore sync throughout
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged }  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc,
  collection, addDoc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const app  = initializeApp({
  apiKey:"AIzaSyAL-ACroQvG34urbbsXDzEPiex0grjv8bU",
  authDomain:"meezan-app-8a41a.firebaseapp.com",
  projectId:"meezan-app-8a41a",
  storageBucket:"meezan-app-8a41a.firebasestorage.app",
  messagingSenderId:"767947145877",
  appId:"1:767947145877:web:d837e0b30258405339519c"
});
const auth = getAuth(app), db = getFirestore(app);

const fmt  = n => '₹' + Math.round(n||0).toLocaleString('en-IN');
const escH = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const today= () => new Date().toISOString().slice(0,10);
const get  = id => document.getElementById(id);

let currentUser = null, familyMembers = [], groups = [], activeGroupId = null, groupExpenses = [];

/* ═══ AUTH ═══ */
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = '../index.html'; return; }
  currentUser = user;
  const ma = get('mob-avatar');
  if (ma) ma.textContent = (user.displayName||user.email||'M').substring(0,2).toUpperCase();
  if (get('share-link')) get('share-link').value = `${location.origin}/pages/family.html?join=${user.uid}`;
  await loadFamilyMembers();
  listenGroups();
  showTab('members');
});

/* ═══ TABS ═══ */
window.showTab = function(tab) {
  document.querySelectorAll('.fh-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.fh-panel').forEach(p => p.style.display = 'none');
  const t = get('tab-'+tab); if (t) t.classList.add('active');
  const p = get('panel-'+tab); if (p) p.style.display = 'block';
};

/* ═══ PERSONAL FAMILY MEMBERS ═══ */
async function loadFamilyMembers() {
  const snap = await getDoc(doc(db,'users',currentUser.uid,'family','group'));
  if (!snap.exists()) {
    await setDoc(doc(db,'users',currentUser.uid,'family','group'),{
      owner:currentUser.uid, ownerEmail:currentUser.email,
      ownerName:currentUser.displayName||currentUser.email,
      members:[], createdAt:serverTimestamp()
    });
    familyMembers = [];
  } else { familyMembers = snap.data().members||[]; }
  renderFamilyMembers();
}

function renderFamilyMembers() {
  const el = get('member-list'); if (!el) return;
  const self = { uid:currentUser.uid, name:currentUser.displayName||currentUser.email||'You', email:currentUser.email, role:'owner', spend:0 };
  const all = [self, ...familyMembers];
  if (get('f-count')) get('f-count').textContent = all.length;
  el.innerHTML = all.map(m => {
    const init = (m.name||m.email||'?').substring(0,2).toUpperCase();
    const avc = m.role==='owner'?'av-owner':m.role==='member'?'av-member':'av-view';
    const bdc = m.role==='owner'?'fb-owner':m.role==='member'?'fb-member':'fb-view';
    const bdl = m.role==='owner'?'Owner':m.role==='member'?'Member':'View only';
    return `<div class="family-member-card">
      <div class="fam-avatar ${avc}">${init}</div>
      <div class="fam-info">
        <div class="fam-name">${escH(m.name||m.email)}</div>
        <div class="fam-email">${m.email||'—'}</div>
        <div class="fam-spend">${m.spend?fmt(m.spend)+' this month':'No data yet'}</div>
      </div>
      <div class="fam-badge ${bdc}">${bdl}</div>
      ${m.uid!==currentUser.uid?`<div class="fam-remove" onclick="removeMember('${m.uid||0}')">✕</div>`:''}
    </div>`;
  }).join('');
  const total = all.reduce((s,m)=>s+(m.spend||0),0);
  if(get('f-total')) get('f-total').textContent = fmt(total);
  if(get('f-month')) get('f-month').textContent = fmt(total);
}

window.sendInvite = async () => {
  const email=get('inv-email')?.value.trim(), role=get('inv-role')?.value||'member',
        access=get('inv-access')?.value||'expenses', msg=get('inv-msg')?.value.trim()||'';
  if (!email) { showInvMsg('Enter an email.','fire'); return; }
  if (email===currentUser.email) { showInvMsg('Cannot invite yourself.','fire'); return; }
  const joinLink=`${location.origin}/pages/family.html?join=${currentUser.uid}`;
  const name=currentUser.displayName||currentUser.email;
  try {
    await addDoc(collection(db,'invites'),{fromUid:currentUser.uid,fromName:name,fromEmail:currentUser.email,
      toEmail:email,role,access,message:msg,joinLink,status:'pending',createdAt:serverTimestamp()});
    const subj=encodeURIComponent(`${name} invited you to Meezan Family Hub`);
    const body=encodeURIComponent(`Assalamu Alaikum,\n\n${name} invited you to Meezan — Islamic Finance Manager.\n${msg?'\n"'+msg+'"\n':''}\nYour role: ${role}\nJoin: ${joinLink}\n\nJazakAllah Khair`);
    showInvMsg('✓ Saved! Opening email...','teal');
    setTimeout(()=>window.open(`mailto:${email}?subject=${subj}&body=${body}`,'_blank'),500);
    if(get('inv-email')) get('inv-email').value='';
    if(get('inv-msg'))   get('inv-msg').value='';
  } catch(e) { showInvMsg('Error: '+e.message,'fire'); }
};

function showInvMsg(msg,type){
  const el=get('invite-msg'); if(!el) return;
  el.textContent=msg; el.style.color=type==='teal'?'var(--teal-lt)':'var(--fire-lt)';
  setTimeout(()=>el.textContent='',4000);
}

window.removeMember = async uid => {
  if(!confirm('Remove?')) return;
  familyMembers = familyMembers.filter(m=>m.uid!==uid);
  await setDoc(doc(db,'users',currentUser.uid,'family','group'),{members:familyMembers},{merge:true});
  renderFamilyMembers();
};

window.copyLink = () => {
  const link=get('share-link')?.value||'';
  navigator.clipboard?.writeText(link).then(()=>{if(get('copy-msg')){get('copy-msg').textContent='✓ Copied!';setTimeout(()=>get('copy-msg').textContent='',2000);}}).catch(()=>{const el=get('share-link');if(el){el.select();document.execCommand('copy');}});
};
window.shareWhatsApp = () => {
  const link=get('share-link')?.value||'', name=currentUser?.displayName||currentUser?.email||'Someone';
  window.open(`https://wa.me/?text=${encodeURIComponent(`Assalamu Alaikum! 🌙\n\n${name} invited you to *Meezan* family group.\nJoin: ${link}`)}`,'_blank');
};
window.shareNative = async () => {
  const link=get('share-link')?.value||'', name=currentUser?.displayName||currentUser?.email||'Someone';
  if(navigator.share){try{await navigator.share({title:'Join Meezan Family',text:`${name} invited you`,url:link});}catch(e){if(e.name!=='AbortError')window.copyLink();}}else window.copyLink();
};

/* ═══ EXPENSE GROUPS ═══ */
function listenGroups() {
  onSnapshot(query(collection(db,'users',currentUser.uid,'expenseGroups'),orderBy('createdAt','desc')), snap => {
    groups = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderGroupList();
  });
}

function renderGroupList() {
  const el = get('group-list'); if (!el) return;
  if (!groups.length) { el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1.5rem">No groups yet. Create one to start splitting!</div>'; return; }
  el.innerHTML = groups.map(g=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;
         background:var(--bg-row);border:1px solid ${g.status==='completed'?'rgba(26,188,156,0.25)':'var(--bdr)'};
         margin-bottom:7px;cursor:pointer;transition:all .2s"
         onclick="openGroup('${g.id}')">
      <div style="font-size:22px">${g.icon||'👥'}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${escH(g.name)}</div>
        <div style="font-size:10px;color:var(--text-dim)">${g.members?.length||0} members · ${g.date||''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--fire-lt)">${fmt(g.totalAmount||0)}</div>
        <div style="font-size:9px;padding:2px 7px;border-radius:8px;margin-top:3px;display:inline-block;
             background:${g.status==='completed'?'rgba(26,188,156,0.15)':'rgba(212,160,23,0.1)'};
             color:${g.status==='completed'?'var(--teal-lt)':'var(--gold-lt)'}">${g.status==='completed'?'✓ Done':'🔄 Ongoing'}</div>
      </div>
    </div>`).join('');
}

window.createGroup = async function() {
  const name=get('grp-name')?.value.trim(), icon=get('grp-icon')?.value||'👥',
        date=get('grp-date')?.value||today(), raw=get('grp-members')?.value||'';
  if (!name) { alert('Enter a group name.'); return; }
  const memberList = raw.split(',').map(s=>s.trim()).filter(Boolean);
  const members = [
    { id:currentUser.uid, name:currentUser.displayName||currentUser.email||'You', isMe:true },
    ...memberList.map((nm,i)=>({ id:'m_'+(i+1), name:nm, isMe:false }))
  ];
  const btn=get('grp-create-btn'); if(btn){btn.textContent='Creating...';btn.disabled=true;}
  try {
    await addDoc(collection(db,'users',currentUser.uid,'expenseGroups'),{name,icon,date,members,status:'ongoing',totalAmount:0,createdAt:serverTimestamp()});
    if(get('grp-name'))    get('grp-name').value='';
    if(get('grp-members')) get('grp-members').value='';
    if(get('grp-date'))    get('grp-date').value=today();
    const m=get('grp-msg'); if(m){m.textContent='✓ Group created!';m.style.color='var(--teal-lt)';setTimeout(()=>m.textContent='',3000);}
  } catch(e) { alert(e.message); }
  if(btn){btn.textContent='+ Create Group';btn.disabled=false;}
};

window.openGroup = function(gid) {
  activeGroupId = gid;
  const grp = groups.find(g=>g.id===gid); if (!grp) return;

  const hdr = get('grp-detail-header');
  if (hdr) hdr.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:1rem">
      <button onclick="backToGroupList()" style="background:rgba(255,255,255,.07);border:1px solid var(--bdr);color:var(--text-dim);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit">← Back</button>
      <div style="font-size:22px">${grp.icon||'👥'}</div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700">${escH(grp.name)}</div>
        <div style="font-size:10px;color:var(--text-dim)">${grp.members?.length||0} members · ${grp.date||''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="font-size:10px;padding:3px 9px;border-radius:8px;
             background:${grp.status==='completed'?'rgba(26,188,156,0.15)':'rgba(212,160,23,0.1)'};
             color:${grp.status==='completed'?'var(--teal-lt)':'var(--gold-lt)'}">${grp.status==='completed'?'✓ Completed':'🔄 Ongoing'}</span>
        ${grp.status!=='completed'
          ?`<button onclick="markGroupComplete('${gid}')" style="background:rgba(26,188,156,0.12);border:1px solid rgba(26,188,156,0.25);color:var(--teal-lt);padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit">✓ Mark Complete</button>`
          :`<button onclick="addGroupToExpenses('${gid}')" style="background:rgba(212,160,23,0.12);border:1px solid rgba(212,160,23,0.3);color:var(--gold-lt);padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit">📊 Add to My Expenses</button>`}
        <button onclick="deleteGroup('${gid}')" style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.2);color:var(--fire-lt);padding:4px 10px;border-radius:8px;font-size:11px;cursor:pointer">🗑️</button>
      </div>
    </div>`;

  // Build payer dropdown
  const sel=get('exp-payer');
  if (sel&&grp.members) sel.innerHTML=grp.members.map(m=>`<option value="${m.id}">${escH(m.name)}</option>`).join('');

  listenGroupExpenses(gid);
  if(get('group-list-panel'))   get('group-list-panel').style.display='none';
  if(get('group-detail-panel')) get('group-detail-panel').style.display='block';
};

window.backToGroupList = function() {
  activeGroupId=null;
  if(get('group-list-panel'))   get('group-list-panel').style.display='block';
  if(get('group-detail-panel')) get('group-detail-panel').style.display='none';
};

function listenGroupExpenses(gid) {
  onSnapshot(query(collection(db,'users',currentUser.uid,'expenseGroups',gid,'expenses'),orderBy('date','desc')), snap => {
    groupExpenses = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderGroupExpenses();
    calculateSettlement();
  });
}

window.addGroupExpense = async function() {
  if (!activeGroupId) return;
  const grp=groups.find(g=>g.id===activeGroupId); if (!grp) return;
  const name=get('exp-name')?.value.trim(), amount=parseFloat(get('exp-amount')?.value),
        paidBy=get('exp-payer')?.value, splitType=get('exp-split')?.value||'equal',
        date=get('exp-date')?.value||today(), cat=get('exp-cat')?.value||'General';
  if (!name) { alert('Enter expense name.'); return; }
  if (isNaN(amount)||amount<=0) { alert('Enter valid amount.'); return; }

  let participants = [];
  if (splitType==='equal') {
    const per = amount/grp.members.length;
    participants = grp.members.map(m=>({id:m.id,name:m.name,share:Math.round(per*100)/100}));
  } else if (splitType==='selected') {
    const sel=[...document.querySelectorAll('.split-member-check:checked')];
    if (!sel.length) { alert('Select at least one member.'); return; }
    const per=amount/sel.length;
    participants = sel.map(cb=>({id:cb.dataset.memberId,name:cb.dataset.memberName,share:Math.round(per*100)/100}));
  } else if (splitType==='custom') {
    const rows=document.querySelectorAll('.custom-split-row');
    let tot=0;
    rows.forEach(row=>{const v=parseFloat(row.querySelector('input')?.value||0);if(v>0){participants.push({id:row.dataset.memberId,name:row.dataset.memberName,share:v});tot+=v;}});
    if (Math.abs(tot-amount)>1) { alert(`Custom total ${fmt(tot)} ≠ expense ${fmt(amount)}`); return; }
  }

  const btn=get('exp-add-btn'); if(btn){btn.textContent='Adding...';btn.disabled=true;}
  try {
    await addDoc(collection(db,'users',currentUser.uid,'expenseGroups',activeGroupId,'expenses'),{
      name,amount,paidBy,paidByName:grp.members.find(m=>m.id===paidBy)?.name||paidBy,
      splitType,participants,date,category:cat,createdAt:serverTimestamp()
    });
    const newTotal = groupExpenses.reduce((s,e)=>s+(e.amount||0),0)+amount;
    await updateDoc(doc(db,'users',currentUser.uid,'expenseGroups',activeGroupId),{totalAmount:newTotal});
    if(get('exp-name'))   get('exp-name').value='';
    if(get('exp-amount')) get('exp-amount').value='';
    if(get('exp-date'))   get('exp-date').value=today();
    const m=get('exp-msg'); if(m){m.textContent='✓ Added!';m.style.color='var(--teal-lt)';setTimeout(()=>m.textContent='',2000);}
  } catch(e) { alert(e.message); }
  if(btn){btn.textContent='+ Add Expense';btn.disabled=false;}
};

window.onSplitTypeChange = function() {
  const grp=groups.find(g=>g.id===activeGroupId), type=get('exp-split')?.value, wrap=get('split-options-wrap');
  if (!wrap||!grp) return;
  if (type==='equal') {
    wrap.innerHTML=`<div style="font-size:11px;color:var(--teal-lt);padding:6px;background:rgba(26,188,156,.06);border-radius:8px">Split equally: ${grp.members.map(m=>escH(m.name)).join(', ')}</div>`;
  } else if (type==='selected') {
    wrap.innerHTML='<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">Select members:</div>'+
      grp.members.map(m=>`<label style="display:flex;align-items:center;gap:8px;padding:4px;font-size:12px;cursor:pointer;margin-bottom:2px">
        <input type="checkbox" class="split-member-check" data-member-id="${m.id}" data-member-name="${escH(m.name)}" checked style="accent-color:var(--teal)"/>
        ${escH(m.name)}</label>`).join('');
  } else if (type==='custom') {
    wrap.innerHTML='<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">Enter each share (₹):</div>'+
      grp.members.map(m=>`<div class="custom-split-row" data-member-id="${m.id}" data-member-name="${escH(m.name)}" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px">
        <div style="flex:1;color:var(--text-mid)">${escH(m.name)}</div>
        <input type="number" min="0" placeholder="0" style="width:90px;background:var(--bg-input);border:1px solid var(--bdr);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:inherit" oninput="updateCustomTotal()"/>
      </div>`).join('')+
      `<div style="font-size:11px;margin-top:4px;color:var(--text-dim)">Total: <strong id="custom-total" style="color:var(--gold-lt)">₹0</strong></div>`;
  }
};

window.updateCustomTotal = function() {
  const t=[...document.querySelectorAll('.custom-split-row input')].reduce((s,el)=>s+(parseFloat(el.value)||0),0);
  const ct=get('custom-total'); if(ct) ct.textContent=fmt(t);
};

function renderGroupExpenses() {
  const el=get('group-expenses-list'); if (!el) return;
  const total=groupExpenses.reduce((s,e)=>s+(e.amount||0),0);
  if(get('grp-total')) get('grp-total').textContent=fmt(total);
  if (!groupExpenses.length) { el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">No expenses yet.</div>'; return; }
  el.innerHTML=groupExpenses.map(e=>`
    <div style="display:flex;align-items:flex-start;gap:8px;padding:9px 11px;border-radius:10px;background:var(--bg-row);border:1px solid var(--bdr);margin-bottom:5px">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between">
          <div style="font-size:12px;font-weight:600">${escH(e.name)}</div>
          <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--fire-lt)">${fmt(e.amount)}</div>
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:2px">Paid by <strong style="color:var(--teal-lt)">${escH(e.paidByName||e.paidBy)}</strong> · ${e.date}</div>
        <div style="font-size:10px;color:var(--text-dim)">Split: ${e.participants?.map(p=>`${escH(p.name)} ${fmt(p.share)}`).join(', ')||'—'}</div>
      </div>
      <div onclick="deleteGroupExpense('${e.id}')" style="color:var(--fire-lt);font-size:11px;cursor:pointer;opacity:.6;padding:2px;flex-shrink:0">✕</div>
    </div>`).join('');
}

window.deleteGroupExpense = async function(eid) {
  if(!confirm('Remove?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'expenseGroups',activeGroupId,'expenses',eid));
};

/* ═══ SETTLEMENT CALCULATOR ═══ */
function calculateSettlement() {
  const el=get('settlement-section'); if (!el) return;
  if (!groupExpenses.length) { el.innerHTML='<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:1rem">Add expenses to see settlement</div>'; return; }
  const grp=groups.find(g=>g.id===activeGroupId); if (!grp) return;

  // Build name map
  const nameMap={};
  grp.members.forEach(m=>{ nameMap[m.id]=m.name; });

  // Build per-expense debt records
  const debtMap={}; // debtMap[debtor][creditor] = {amount, reasons[]}
  groupExpenses.forEach(exp=>{
    exp.participants?.forEach(p=>{
      if (p.id===exp.paidBy) return;
      if (!debtMap[p.id]) debtMap[p.id]={};
      if (!debtMap[p.id][exp.paidBy]) debtMap[p.id][exp.paidBy]={amount:0,reasons:[]};
      debtMap[p.id][exp.paidBy].amount += p.share;
      debtMap[p.id][exp.paidBy].reasons.push(`${escH(exp.name)} ${fmt(p.share)}`);
    });
  });

  // Net balance per person
  const netBal={};
  grp.members.forEach(m=>{ netBal[m.id]=0; });
  Object.entries(debtMap).forEach(([d,creds])=>{ Object.entries(creds).forEach(([c,{amount}])=>{ netBal[d]=(netBal[d]||0)-amount; netBal[c]=(netBal[c]||0)+amount; }); });

  // SECTION 1: Expense-by-expense
  let sec1='';
  groupExpenses.forEach(exp=>{
    const pn=nameMap[exp.paidBy]||exp.paidByName||exp.paidBy;
    const debtors=exp.participants?.filter(p=>p.id!==exp.paidBy)||[];
    sec1+=`<div style="margin-bottom:8px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:12px;font-weight:600">${escH(exp.name)}</div>
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--fire-lt)">${fmt(exp.amount)}</div>
      </div>
      <div style="font-size:10px;color:var(--teal-lt);margin-bottom:3px">Paid by ${escH(pn)}</div>
      ${debtors.map(p=>`<div style="font-size:11px;color:var(--text-mid);border-top:1px solid rgba(255,255,255,.04);padding-top:2px;margin-top:2px">
        <span style="color:var(--amber)">${escH(nameMap[p.id]||p.name)}</span> owes
        <span style="color:var(--teal-lt)">${escH(pn)}</span>
        <span style="font-family:'Cinzel',serif;color:var(--fire-lt)"> → ${fmt(p.share)}</span>
      </div>`).join('')}
    </div>`;
  });

  // SECTION 2: Person-wise summary
  let sec2='';
  Object.entries(debtMap).forEach(([did,creds])=>{
    const dn=nameMap[did]||did;
    const totalOwed=Object.values(creds).reduce((s,{amount})=>s+amount,0);
    sec2+=`<div style="padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:7px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <div style="font-size:12px;font-weight:700;color:var(--text)">👤 ${escH(dn)}</div>
        <div style="font-size:11px;color:var(--fire-lt)">Total: <strong style="font-family:'Cinzel',serif">${fmt(totalOwed)}</strong></div>
      </div>
      ${Object.entries(creds).map(([cid,{amount,reasons}])=>`
        <div style="font-size:11px;padding:3px 6px;border-radius:6px;background:rgba(192,57,43,.06);margin-bottom:3px;display:flex;justify-content:space-between;align-items:center">
          <div>Pay <span style="color:var(--teal-lt)">${escH(nameMap[cid]||cid)}</span>
          <span style="color:var(--text-dim);font-size:9px"> (${reasons.join(', ')})</span></div>
          <div style="font-family:'Cinzel',serif;color:var(--gold-lt)">${fmt(amount)}</div>
        </div>`).join('')}
    </div>`;
  });

  // SECTION 3: Minimal transactions (greedy algorithm)
  const creds=[], debts=[];
  Object.entries(netBal).forEach(([id,bal])=>{
    const r=Math.round(bal);
    if (r>0) creds.push({id,name:nameMap[id]||id,amount:r});
    else if (r<0) debts.push({id,name:nameMap[id]||id,amount:-r});
  });
  creds.sort((a,b)=>b.amount-a.amount); debts.sort((a,b)=>b.amount-a.amount);
  const txns=[];
  let ci=0, di=0;
  while (ci<creds.length && di<debts.length) {
    const c=creds[ci], d=debts[di];
    const pay=Math.min(c.amount,d.amount);
    if (pay>0) txns.push({from:d.name,to:c.name,amount:pay});
    c.amount-=pay; d.amount-=pay;
    if(c.amount<=0) ci++; if(d.amount<=0) di++;
  }
  const sec3 = txns.length
    ? txns.map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:rgba(26,188,156,0.07);border:1px solid rgba(26,188,156,0.18);margin-bottom:5px">
        <div style="font-size:16px">💸</div>
        <div style="flex:1">
          <span style="color:var(--amber);font-weight:600">${escH(t.from)}</span>
          <span style="color:var(--text-dim);font-size:11px"> pays </span>
          <span style="color:var(--teal-lt);font-weight:600">${escH(t.to)}</span>
        </div>
        <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--gold-lt)">${fmt(t.amount)}</div>
      </div>`).join('')
    : '<div style="color:var(--teal-lt);font-size:12px;text-align:center;padding:.5rem">✅ All settled — no payments needed!</div>';

  el.innerHTML=`
    <div style="margin-bottom:1rem">
      <div style="font-size:9px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;padding-bottom:4px;border-bottom:1px solid var(--bdr)">📋 Expense-wise Debts</div>
      ${sec1}
    </div>
    <div style="margin-bottom:1rem">
      <div style="font-size:9px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px;padding-bottom:4px;border-bottom:1px solid var(--bdr)">👤 Person-wise Summary</div>
      ${sec2||'<div style="color:var(--teal-lt);font-size:12px">Everyone paid their own share ✅</div>'}
    </div>
    <div style="background:rgba(26,188,156,0.05);border:1px solid rgba(26,188,156,0.2);border-radius:12px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:var(--teal-lt);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">🎯 Final Payment Instructions</div>
      ${sec3}
      <div style="font-size:10px;color:var(--text-dim);margin-top:8px;text-align:center">Minimum transfers needed to settle all debts</div>
    </div>`;
}

window.markGroupComplete = async function(gid) {
  if(!confirm('Mark as completed?')) return;
  await updateDoc(doc(db,'users',currentUser.uid,'expenseGroups',gid),{status:'completed'});
  openGroup(gid);
};

window.addGroupToExpenses = async function(gid) {
  const grp=groups.find(g=>g.id===gid); if (!grp) return;
  if (!confirm(`Add all ${groupExpenses.length} group expenses (${fmt(grp.totalAmount||0)}) to your main tracker?`)) return;
  const btn=event.target; if(btn){btn.textContent='Adding...';btn.disabled=true;}
  try {
    const batch=writeBatch(db);
    groupExpenses.forEach(exp=>{
      const ref=doc(collection(db,'users',currentUser.uid,'expenses'));
      batch.set(ref,{name:`[${grp.name}] ${exp.name}`,amt:exp.amount,cat:'Entertainment',date:exp.date||today(),
        notes:`Group — paid by ${exp.paidByName||exp.paidBy}`,incomeSrc:'Any',uid:currentUser.uid,fromGroup:gid,createdAt:serverTimestamp()});
    });
    await batch.commit();
    alert(`✓ ${groupExpenses.length} expenses added to your main tracker!`);
  } catch(e) { alert(e.message); }
  if(btn){btn.textContent='📊 Add to My Expenses';btn.disabled=false;}
};

window.deleteGroup = async function(gid) {
  if(!confirm('Delete group and all its expenses?')) return;
  await deleteDoc(doc(db,'users',currentUser.uid,'expenseGroups',gid));
  backToGroupList();
};

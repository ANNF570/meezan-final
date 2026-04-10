/* ============================================================
   MEEZAN | js/groups.js  — MULTI-USER GROUP EXPENSE SYSTEM
   
   Architecture: TOP-LEVEL Firestore collection
   ✅ groups/{groupId}           — shared, any member can read/write
   ✅ groups/{groupId}/expenses  — real-time expense log
   ✅ Invite link: groups.html?join={groupId}
   ✅ Any user with link can join (adds themselves to members)
   ✅ Real-time sync via onSnapshot
   ✅ Full settlement: who pays whom
   ============================================================ */
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, getDoc,
  deleteDoc, getDocs, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, where
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

const fmt    = n => '₹' + Math.round(n||0).toLocaleString('en-IN');
const today  = () => new Date().toISOString().slice(0,10);
const get    = id => document.getElementById(id);
const setTxt = (id,v) => { const e=get(id); if(e) e.textContent=v; };
const escH   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escA   = s => String(s||'').replace(/"/g,'&quot;').replace(/\s/g,'_');

let currentUser    = null;
let myDisplayName  = '';
let currentGroupId = null;
let currentGroup   = null;
let groupExpenses  = [];
let allGroups      = [];
let expUnsubscribe = null;

/* ══════════════════════════════════════
   AUTH + URL JOIN CHECK
   ══════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  if (!user) { location.href = '../index.html'; return; }
  currentUser   = user;
  myDisplayName = user.displayName || user.email?.split('@')[0] || 'Me';

  const ma = get('mob-avatar');
  if (ma) ma.textContent = myDisplayName.substring(0,2).toUpperCase();

  // Show current user badge
  const badge = get('current-user-badge');
  if (badge) badge.textContent = '👤 ' + myDisplayName;

  // Check if arriving via invite link
  const params  = new URLSearchParams(location.search);
  const joinId  = params.get('join');
  if (joinId) {
    await handleJoinGroup(joinId);
    // Clean URL
    history.replaceState({}, '', location.pathname);
  }

  listenMyGroups();
});

/* ══════════════════════════════════════
   JOIN GROUP VIA INVITE LINK
   ══════════════════════════════════════ */
async function handleJoinGroup(groupId) {
  try {
    const ref  = doc(db, 'groups', groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      showBanner('Group not found — the link may be expired.', 'fire');
      return;
    }
    const data    = snap.data();
    const members = data.memberUids || [];

    if (members.includes(currentUser.uid)) {
      // Already a member — just open it
      setTimeout(() => openGroup(groupId), 600);
      return;
    }

    // Add this user to the group
    await updateDoc(ref, {
      memberUids: arrayUnion(currentUser.uid),
      memberNames: arrayUnion(myDisplayName)
    });

    showBanner(`✓ You joined "${data.name}"! Welcome, ${myDisplayName}!`, 'teal');
    setTimeout(() => openGroup(groupId), 800);
  } catch(e) {
    console.error('Join error:', e);
    showBanner('Error joining group: ' + e.message, 'fire');
  }
}

/* ══════════════════════════════════════
   LISTEN TO MY GROUPS (real-time)
   Groups where my UID is in memberUids[]
   ══════════════════════════════════════ */
function listenMyGroups() {
  const q = query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', currentUser.uid),
    orderBy('createdAt', 'desc')
  );
  onSnapshot(q, snap => {
    allGroups = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderGroupList();
  }, err => {
    // Index may not exist yet — fallback to getDocs
    console.warn('Query index missing, using fallback:', err.message);
    loadGroupsFallback();
  });
}

async function loadGroupsFallback() {
  // Fallback: fetch all groups where user is a member (no compound index needed)
  const snap = await getDocs(collection(db, 'groups'));
  allGroups = snap.docs
    .map(d => ({id:d.id,...d.data()}))
    .filter(g => (g.memberUids||[]).includes(currentUser.uid))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  renderGroupList();
}

/* ══════════════════════════════════════
   RENDER GROUP LIST
   ══════════════════════════════════════ */
function renderGroupList() {
  const el = get('group-list');
  if (!el) return;

  if (!allGroups.length) {
    el.innerHTML = `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:2rem">
      <div style="font-size:32px;margin-bottom:.5rem">🧾</div>
      No groups yet. Create one or join via an invite link!
    </div>`;
    return;
  }

  el.innerHTML = allGroups.map(g => {
    const memberCount = (g.memberNames||[]).length;
    const isComplete  = g.status === 'complete';
    const isOwner     = g.createdBy === currentUser.uid;
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:12px;
           background:var(--bg-row);border:1px solid var(--bdr);margin-bottom:8px;cursor:pointer;
           transition:all .2s" onclick="openGroup('${g.id}')"
           onmouseover="this.style.borderColor='rgba(212,160,23,.35)'"
           onmouseout="this.style.borderColor='var(--bdr)'">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(212,160,23,0.12);
             border:1px solid rgba(212,160,23,0.2);display:flex;align-items:center;
             justify-content:center;font-size:22px;flex-shrink:0">${g.icon||'🗺️'}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${escH(g.name)}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px">
            ${memberCount} member${memberCount!==1?'s':''} · ${g.expenseCount||0} expenses
            ${isOwner ? ' · <span style="color:var(--gold-lt)">Owner</span>' : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--fire-lt)">${fmt(g.total||0)}</div>
          <div style="font-size:10px;margin-top:3px;color:${isComplete?'var(--teal-lt)':'var(--amber)'}">
            ${isComplete ? '✅ Done' : '🔄 Active'}
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   CREATE GROUP
   ══════════════════════════════════════ */
window.createGroup = async function() {
  const nameEl = get('new-group-name');
  const name   = nameEl?.value.trim();
  const icon   = get('new-group-icon')?.value || '🗺️';
  const desc   = get('new-group-desc')?.value.trim() || '';

  if (!name) {
    showMsg('create-group-msg', 'Please enter a group name.', 'fire');
    if (nameEl) nameEl.focus();
    return;
  }

  const btn = get('create-group-btn');
  if (btn) { btn.textContent = 'Creating...'; btn.disabled = true; }

  try {
    // Store in TOP-LEVEL groups collection — accessible by any member
    const docRef = await addDoc(collection(db, 'groups'), {
      name, icon, desc,
      createdBy:   currentUser.uid,
      memberUids:  [currentUser.uid],
      memberNames: [myDisplayName],
      status:      'ongoing',
      total:       0,
      expenseCount: 0,
      createdAt:   serverTimestamp()
    });

    if (nameEl) nameEl.value = '';
    if (get('new-group-desc')) get('new-group-desc').value = '';
    showMsg('create-group-msg', '✓ Group created!', 'teal');

    setTimeout(() => openGroup(docRef.id), 400);
  } catch(e) {
    showMsg('create-group-msg', 'Error: ' + e.message, 'fire');
  }
  if (btn) { btn.textContent = '+ Create Group'; btn.disabled = false; }
};

/* ══════════════════════════════════════
   OPEN GROUP DETAIL
   ══════════════════════════════════════ */
window.openGroup = async function(groupId) {
  currentGroupId = groupId;

  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) { showBanner('Group not found.', 'fire'); return; }
  currentGroup = { id: snap.id, ...snap.data() };

  get('groups-list-panel').style.display  = 'none';
  get('group-detail-panel').style.display = 'block';

  renderGroupHeader();
  renderGroupMembers();
  buildInviteLink();

  // Stop old listener if any
  if (expUnsubscribe) { expUnsubscribe(); expUnsubscribe = null; }

  // Real-time expenses listener
  expUnsubscribe = onSnapshot(
    query(collection(db, 'groups', groupId, 'expenses'), orderBy('createdAt', 'desc')),
    snap => {
      groupExpenses = snap.docs.map(d => ({id:d.id,...d.data()}));
      renderGroupExpenses();
      recalcSettlement();
      // Update group totals
      const total = groupExpenses.reduce((s,e) => s+(e.amount||0), 0);
      setTxt('grp-total', fmt(total));
      updateDoc(doc(db,'groups',groupId), { total, expenseCount: groupExpenses.length }).catch(()=>{});
    }
  );
};

window.backToGroups = function() {
  if (expUnsubscribe) { expUnsubscribe(); expUnsubscribe = null; }
  currentGroupId = null; currentGroup = null; groupExpenses = [];
  get('groups-list-panel').style.display  = '';
  get('group-detail-panel').style.display = 'none';
};

/* ══════════════════════════════════════
   GROUP HEADER
   ══════════════════════════════════════ */
function renderGroupHeader() {
  const isComplete = currentGroup.status === 'complete';
  const isOwner    = currentGroup.createdBy === currentUser.uid;
  setTxt('grp-title', (currentGroup.icon||'🗺️') + ' ' + currentGroup.name);
  setTxt('grp-desc-line', currentGroup.desc || '');

  const sb = get('grp-status-badge');
  if(sb) { sb.textContent = isComplete ? '✅ Completed' : '🔄 Active'; sb.style.color = isComplete?'var(--teal-lt)':'var(--amber)'; }

  const mc  = get('btn-mark-complete');
  const ro  = get('btn-reopen');
  const imp = get('btn-import-expenses');
  const del = get('btn-delete-group');
  if (mc)  mc.style.display  = isComplete ? 'none' : '';
  if (ro)  ro.style.display  = isComplete ? '' : 'none';
  if (imp) imp.style.display = isComplete ? '' : 'none';
  if (del) del.style.display = isOwner ? '' : 'none'; // only owner can delete
}

/* ══════════════════════════════════════
   GROUP MEMBERS
   ══════════════════════════════════════ */
function renderGroupMembers() {
  const el = get('grp-member-tags');
  if (!el) return;
  const names = currentGroup.memberNames || [];
  el.innerHTML = names.map((m,i) => `
    <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;
         background:rgba(93,173,226,0.1);border:1px solid rgba(93,173,226,0.25);
         font-size:12px;color:var(--sky-lt)">
      ${m === myDisplayName ? '👤 ' : ''}${escH(m)}
    </span>`).join('');
  rebuildPaidBySelect();
  rebuildSplitCheckboxes();
}

window.addGroupMember = async function() {
  const input = get('new-member-name');
  const name  = input?.value.trim();
  if (!name || !currentGroup) return;

  const names = [...(currentGroup.memberNames||[])];
  if (names.some(m => m.toLowerCase() === name.toLowerCase())) { input.value=''; return; }

  names.push(name);
  currentGroup.memberNames = names;
  await updateDoc(doc(db,'groups',currentGroupId), { memberNames: names });
  input.value = '';
  renderGroupMembers();
};

function rebuildPaidBySelect() {
  const sel = get('exp-paid-by');
  if (!sel) return;
  const names = currentGroup.memberNames || [];
  sel.innerHTML = names.map(m => `<option value="${escA(m)}" ${m===myDisplayName?'selected':''}>${escH(m)}</option>`).join('');
}

function rebuildSplitCheckboxes() {
  const wrap    = get('split-checkboxes');
  const isCustom= get('exp-split-type')?.value === 'custom';
  if (!wrap) return;
  const names = currentGroup.memberNames || [];
  wrap.innerHTML = names.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;
         background:rgba(255,255,255,.03);margin-bottom:4px">
      <input type="checkbox" id="chk-${escA(m)}" value="${escA(m)}" checked
             style="width:14px;height:14px;cursor:pointer" onchange="updateCustomSplit()" />
      <label for="chk-${escA(m)}" style="font-size:12px;cursor:pointer;flex:1;color:${m===myDisplayName?'var(--gold-lt)':'var(--text)'}">
        ${m === myDisplayName ? '👤 ' : ''}${escH(m)}
      </label>
      ${isCustom ? `<input type="number" id="camt-${escA(m)}" min="0" placeholder="₹"
                        style="width:75px;background:var(--bg-input);border:1px solid var(--bdr);
                               border-radius:6px;padding:4px 7px;font-size:11px;color:var(--text)" />` : ''}
    </div>`).join('');
}

window.updateCustomSplit = function() { rebuildSplitCheckboxes(); };

/* ══════════════════════════════════════
   INVITE LINK
   ══════════════════════════════════════ */
function buildInviteLink() {
  const link = `${location.origin}/pages/groups.html?join=${currentGroupId}`;
  const el   = get('invite-link');
  if (el) el.value = link;
}

window.copyInviteLink = function() {
  const link = get('invite-link')?.value;
  if (!link) return;
  navigator.clipboard?.writeText(link).then(() => {
    showMsg('invite-copy-msg', '✓ Link copied!', 'teal');
  }).catch(() => {
    get('invite-link')?.select();
    document.execCommand('copy');
    showMsg('invite-copy-msg', '✓ Copied!', 'teal');
  });
};

window.shareInviteWhatsApp = function() {
  const link = get('invite-link')?.value || '';
  const text = encodeURIComponent(
    `Assalamu Alaikum! 🌙\n\n${myDisplayName} invited you to join the group *${currentGroup?.name}* on Meezan.\n\nClick to join and track expenses together:\n${link}`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
};

/* ══════════════════════════════════════
   ADD EXPENSE
   ══════════════════════════════════════ */
window.addGroupExpense = async function() {
  const name      = get('exp-name')?.value.trim();
  const amount    = parseFloat(get('exp-amount')?.value);
  const paidBy    = get('exp-paid-by')?.value;
  const date      = get('exp-date')?.value  || today();
  const note      = get('exp-note')?.value.trim() || '';
  const splitType = get('exp-split-type')?.value || 'equal';

  if (!name)              { showMsg('exp-add-msg','Enter expense name.','fire'); return; }
  if (isNaN(amount)||amount<=0) { showMsg('exp-add-msg','Enter valid amount.','fire'); return; }
  if (!paidBy)            { showMsg('exp-add-msg','Select who paid.','fire'); return; }

  const names   = currentGroup.memberNames || [];
  const checked = names.filter(m => get('chk-'+escA(m))?.checked);
  if (!checked.length) { showMsg('exp-add-msg','Select at least one person.','fire'); return; }

  // Build splits
  let splits = {};
  if (splitType === 'equal') {
    const each = Math.round((amount / checked.length) * 100) / 100;
    checked.forEach(m => splits[m] = each);
  } else {
    // custom
    checked.forEach(m => {
      splits[m] = parseFloat(get('camt-'+escA(m))?.value) || 0;
    });
  }

  const btn = get('add-exp-btn');
  if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }

  try {
    await addDoc(collection(db,'groups',currentGroupId,'expenses'), {
      name, amount, paidBy, date, note, splits, splitType,
      addedBy:   myDisplayName,
      addedByUid: currentUser.uid,
      createdAt: serverTimestamp()
    });
    if(get('exp-name'))   get('exp-name').value   = '';
    if(get('exp-amount')) get('exp-amount').value = '';
    if(get('exp-note'))   get('exp-note').value   = '';
    if(get('exp-date'))   get('exp-date').value   = today();
    rebuildSplitCheckboxes();
    showMsg('exp-add-msg', '✓ Expense added!', 'teal');
  } catch(e) {
    showMsg('exp-add-msg', 'Error: ' + e.message, 'fire');
  }
  if (btn) { btn.textContent = '+ Add Expense'; btn.disabled = false; }
};

/* ══════════════════════════════════════
   RENDER EXPENSES
   ══════════════════════════════════════ */
function renderGroupExpenses() {
  const el = get('grp-expense-list');
  if (!el) return;

  if (!groupExpenses.length) {
    el.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:1.5rem">No expenses yet. Add the first one!</div>';
    return;
  }

  el.innerHTML = groupExpenses.map(e => {
    const splitPpl  = Object.keys(e.splits||{}).join(', ');
    const canDelete = e.addedByUid === currentUser.uid || currentGroup.createdBy === currentUser.uid;
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:10px;
           background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${escH(e.name)}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:3px">
            ${e.date} · Paid by <strong style="color:${e.paidBy===myDisplayName?'var(--gold-lt)':'var(--teal-lt)'}">${escH(e.paidBy)}</strong>
          </div>
          <div style="font-size:10px;color:var(--text-dim)">Split: ${escH(splitPpl)}</div>
          ${e.note?`<div style="font-size:10px;color:var(--text-dim);font-style:italic">${escH(e.note)}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--fire-lt)">${fmt(e.amount)}</div>
          ${canDelete?`<div onclick="deleteGroupExpense('${e.id}')" style="font-size:10px;color:var(--fire-lt);cursor:pointer;opacity:.7;margin-top:3px">✕ Remove</div>`:''}
        </div>
      </div>`;
  }).join('');
}

window.deleteGroupExpense = async function(id) {
  if (!confirm('Remove this expense?')) return;
  await deleteDoc(doc(db,'groups',currentGroupId,'expenses',id));
};

/* ══════════════════════════════════════
   SETTLEMENT ENGINE
   ══════════════════════════════════════ */
function recalcSettlement() {
  const names = currentGroup.memberNames || [];
  const paid  = {}; const owes = {};
  names.forEach(m => { paid[m]=0; owes[m]=0; });

  groupExpenses.forEach(e => {
    if (paid[e.paidBy] !== undefined) paid[e.paidBy] += (e.amount||0);
    Object.entries(e.splits||{}).forEach(([person,share]) => {
      if (owes[person] !== undefined) owes[person] += share;
    });
  });

  const net = {};
  names.forEach(m => { net[m] = Math.round((paid[m] - owes[m]) * 100) / 100; });

  const total = groupExpenses.reduce((s,e)=>s+(e.amount||0),0);
  setTxt('settlement-total', fmt(total));

  // Per-person summary
  const tbl = get('person-summary-table');
  if (tbl) {
    tbl.innerHTML = names.map(m => {
      const n  = net[m];
      const isMe = m === myDisplayName;
      return `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;font-size:11px;
             padding:6px 10px;border-radius:8px;
             background:${isMe?'rgba(212,160,23,0.07)':'rgba(255,255,255,.03)'};
             border:${isMe?'1px solid rgba(212,160,23,0.2)':'none'};margin-bottom:4px">
          <span style="font-weight:700;color:${isMe?'var(--gold-lt)':'var(--text)'}">${escH(m)}${isMe?' 👤':''}</span>
          <span style="text-align:center;color:var(--teal-lt)">${fmt(paid[m])}</span>
          <span style="text-align:center;color:var(--fire-lt)">${fmt(owes[m])}</span>
          <span style="text-align:right;font-weight:700;color:${n>=0?'var(--teal-lt)':'var(--fire-lt)'}">
            ${n>=0?'+':''}${fmt(Math.abs(n))}
          </span>
        </div>`;
    }).join('');
  }

  // Settlement instructions (minimize transactions)
  const settlements = computeSettlements({...net});
  renderSettlement(settlements);

  // My personal summary
  renderMySummary(net, settlements);

  return { net, settlements, total };
}

function computeSettlements(net) {
  const debtors  = Object.entries(net).filter(([,v])=>v<-0.01).map(([k,v])=>({name:k,val:-v}));
  const creditors= Object.entries(net).filter(([,v])=>v>0.01).map(([k,v])=>({name:k,val:v}));
  const results  = [];
  let i=0, j=0;
  while (i<debtors.length && j<creditors.length) {
    const pay = Math.min(debtors[i].val, creditors[j].val);
    if (pay>0.01) results.push({ from:debtors[i].name, to:creditors[j].name, amount:Math.round(pay) });
    debtors[i].val  -= pay;
    creditors[j].val -= pay;
    if (debtors[i].val  <0.01) i++;
    if (creditors[j].val<0.01) j++;
  }
  return results;
}

function renderSettlement(settlements) {
  const sr = get('settlement-results');
  if (!sr) return;
  if (!settlements.length) {
    sr.innerHTML = '<div style="color:var(--teal-lt);font-size:13px;text-align:center;padding:.75rem">✅ All settled!</div>';
    return;
  }
  sr.innerHTML = settlements.map(s => {
    const isMyDebt    = s.from === myDisplayName;
    const isMyIncome  = s.to   === myDisplayName;
    const highlight   = isMyDebt ? 'rgba(192,57,43,0.1)' : isMyIncome ? 'rgba(26,188,156,0.1)' : 'rgba(26,188,156,0.05)';
    const borderColor = isMyDebt ? 'rgba(192,57,43,0.3)'  : isMyIncome ? 'rgba(26,188,156,0.3)'  : 'rgba(26,188,156,0.15)';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;
           background:${highlight};border:1px solid ${borderColor};margin-bottom:6px">
        <div style="font-size:13px;font-weight:700;color:${isMyDebt?'var(--fire-lt)':'var(--text)'}">${escH(s.from)}${isMyDebt?' 👤':''}</div>
        <div style="color:var(--teal-lt);font-size:16px;font-weight:700">→</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:${isMyIncome?'var(--teal-lt)':'var(--text)'}">${escH(s.to)}${isMyIncome?' 👤':''}</div>
          <div style="font-size:10px;color:var(--text-dim)">should pay</div>
        </div>
        <div style="font-family:'Cinzel',serif;font-size:15px;color:var(--gold-lt);font-weight:700">${fmt(s.amount)}</div>
      </div>`;
  }).join('');
}

function renderMySummary(net, settlements) {
  const el = get('my-summary-box');
  if (!el) return;

  const myNet = net[myDisplayName];
  if (myNet === undefined) { el.innerHTML=''; return; }

  const iOwe     = settlements.filter(s => s.from === myDisplayName);
  const iReceive = settlements.filter(s => s.to   === myDisplayName);

  let html = `<div style="font-size:13px;font-weight:700;color:var(--gold-lt);margin-bottom:.75rem">
    👤 ${myDisplayName} — Your Summary
  </div>`;

  if (iOwe.length) {
    html += `<div style="font-size:12px;color:var(--fire-lt);margin-bottom:.5rem;font-weight:600">💸 You owe:</div>`;
    iOwe.forEach(s => {
      html += `<div style="font-size:12px;color:var(--text);padding:5px 8px;border-radius:7px;
           background:rgba(192,57,43,0.08);margin-bottom:4px">
        Pay <strong>${escH(s.to)}</strong> — <strong style="color:var(--fire-lt)">${fmt(s.amount)}</strong>
      </div>`;
    });
  }
  if (iReceive.length) {
    html += `<div style="font-size:12px;color:var(--teal-lt);margin:.5rem 0;font-weight:600">💰 You receive:</div>`;
    iReceive.forEach(s => {
      html += `<div style="font-size:12px;color:var(--text);padding:5px 8px;border-radius:7px;
           background:rgba(26,188,156,0.08);margin-bottom:4px">
        From <strong>${escH(s.from)}</strong> — <strong style="color:var(--teal-lt)">${fmt(s.amount)}</strong>
      </div>`;
    });
  }
  if (!iOwe.length && !iReceive.length) {
    html += `<div style="font-size:12px;color:var(--teal-lt);padding:8px;background:rgba(26,188,156,0.08);border-radius:8px">
      ✅ You're all settled!
    </div>`;
  }
  el.innerHTML = html;
}

/* ══════════════════════════════════════
   GROUP ACTIONS
   ══════════════════════════════════════ */
window.markGroupComplete = async function() {
  if (!currentGroupId) return;
  await updateDoc(doc(db,'groups',currentGroupId), { status:'complete' });
  currentGroup.status = 'complete';
  renderGroupHeader();
};

window.reopenGroup = async function() {
  if (!currentGroupId) return;
  await updateDoc(doc(db,'groups',currentGroupId), { status:'ongoing' });
  currentGroup.status = 'ongoing';
  renderGroupHeader();
};

window.deleteGroup = async function() {
  if (currentGroup.createdBy !== currentUser.uid) {
    alert('Only the group owner can delete it.');
    return;
  }
  if (!confirm(`Delete "${currentGroup.name}" and all expenses? This cannot be undone.`)) return;
  const expSnap = await getDocs(collection(db,'groups',currentGroupId,'expenses'));
  for (const d of expSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db,'groups',currentGroupId));
  window.backToGroups();
};

window.importGroupToExpenses = async function() {
  const { net } = recalcSettlement();
  const myShare = net[myDisplayName];
  if (myShare === undefined || Math.abs(myShare) < 1) {
    showMsg('import-msg', 'Your balance is already settled — nothing to import.', 'teal');
    return;
  }
  const amount = Math.abs(myShare);
  const btn = get('btn-import-expenses');
  if (btn) { btn.textContent='Importing...'; btn.disabled=true; }
  try {
    await addDoc(collection(db,'users',currentUser.uid,'expenses'), {
      name:  currentGroup.name + ' (Group share)',
      amt:   amount,
      cat:   'Entertainment',
      date:  today(),
      notes: `My share from group: ${currentGroup.name}`,
      uid:   currentUser.uid,
      createdAt: serverTimestamp()
    });
    showMsg('import-msg', `✓ ₹${amount.toLocaleString('en-IN')} added to your Expenses!`, 'teal');
  } catch(e) {
    showMsg('import-msg', 'Error: '+e.message, 'fire');
  }
  if (btn) { btn.textContent='📥 Import My Share'; btn.disabled=false; }
};

/* ══════════════════════════════════════
   SHARE GROUP SUMMARY
   ══════════════════════════════════════ */
window.shareGroupWhatsApp = function() {
  const text = buildShareText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.shareGroupNative = async function() {
  const text = buildShareText();
  if (navigator.share) {
    try { await navigator.share({ title: currentGroup?.name, text }); } catch(e) { if(e.name!=='AbortError') copyText(text); }
  } else copyText(text);
};

function buildShareText() {
  const grp = currentGroup;
  const total = groupExpenses.reduce((s,e)=>s+(e.amount||0),0);
  const { settlements } = recalcSettlement();
  let t  = `*${grp.icon||'🗺️'} ${grp.name}* — Expense Summary\n`;
  t += `Total: ₹${Math.round(total).toLocaleString('en-IN')}\n\n`;
  t += `*Expenses:*\n`;
  groupExpenses.slice(0,10).forEach(e => { t += `• ${e.name} — ₹${Math.round(e.amount).toLocaleString('en-IN')} (${e.paidBy})\n`; });
  t += `\n*Settlement:*\n`;
  if (settlements.length) settlements.forEach(s => { t += `• ${s.from} → ${s.to}: ₹${s.amount.toLocaleString('en-IN')}\n`; });
  else t += `✅ All settled!\n`;
  t += `\n_Join this group on Meezan: ${location.origin}/pages/groups.html?join=${currentGroupId}_`;
  return t;
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => showMsg('share-msg','✓ Summary copied!','teal'));
}

/* ── Helpers ── */
function showMsg(id, msg, type) {
  const el = get(id); if(!el) return;
  el.textContent = msg;
  el.style.color = type==='teal'?'var(--teal-lt)':'var(--fire-lt)';
  setTimeout(()=>{ el.textContent=''; },3000);
}
function showBanner(msg, type) {
  const b = get('join-banner');
  if (!b) return;
  b.textContent = msg;
  b.style.cssText = `display:block;padding:12px 16px;border-radius:10px;margin-bottom:1rem;font-size:13px;
    background:${type==='teal'?'rgba(26,188,156,0.12)':'rgba(192,57,43,0.12)'};
    border:1px solid ${type==='teal'?'rgba(26,188,156,0.3)':'rgba(192,57,43,0.3)'};
    color:${type==='teal'?'var(--teal-lt)':'var(--fire-lt)'}`;
  setTimeout(()=>{ b.style.display='none'; },4000);
}

window.setTheme = th => {
  document.documentElement.setAttribute('data-theme',th);
  localStorage.setItem('meezan-theme',th);
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th));
};

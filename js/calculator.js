/* ============================================================
   MEEZAN | js/calculator.js — Calculator + Zakat shortcuts
   HOW TO LINK: <script src="../js/calculator.js"></script>  (NOT module)
   ============================================================ */
const GOLD=6842, SILVER=82, NISAB=595;
const fmt=n=>'Rs.'+Math.round(n).toLocaleString('en-IN');
const get=id=>document.getElementById(id);
let expr='', result='0', memory=0, lastWasOp=false;

function show(){ get('expr').textContent=expr||'0'; get('result').textContent=result; }

window.num=d=>{ if(result!=='0'&&lastWasOp){expr+=result;lastWasOp=false;} result=(result==='0'||lastWasOp)?d:result+d; lastWasOp=false; show(); };
window.dot=()=>{ if(!result.includes('.')) result+='.'; lastWasOp=false; show(); };
window.op=o=>{ expr=(expr||'')+result+' '+o+' '; lastWasOp=true; show(); };
window.equals=()=>{ try{ const v=Function('"use strict";return ('+expr+result+')')(); result=String(Math.round(v*1e7)/1e7); expr=''; lastWasOp=false; show(); }catch{ result='Error'; show(); } };
window.percent=()=>{ try{ result=String(parseFloat(result)/100); show(); }catch{} };
window.clearAll=()=>{ expr=''; result='0'; lastWasOp=false; const zb=get('zakat-box'); if(zb) zb.style.display='none'; show(); };
window.delLast=()=>{ result=result.length>1?result.slice(0,-1):'0'; show(); };
window.memStore=()=>{ memory+=parseFloat(result)||0; const md=get('mem-display'); if(md) md.textContent='M: '+fmt(memory); };
window.memSubtract=()=>{ memory-=parseFloat(result)||0; const md=get('mem-display'); if(md) md.textContent='M: '+fmt(memory); };
window.memRecall=()=>{ result=String(memory); show(); };
window.memClear=()=>{ memory=0; const md=get('mem-display'); if(md) md.textContent=''; };

window.zakatPercent=()=>{
  const val=parseFloat(result)||0; if(!val) return;
  const zakat=Math.round(val*0.025);
  const zb=get('zakat-box'); if(zb) zb.style.display='block';
  const zr=get('zakat-rows');
  if(zr) zr.innerHTML=`<div class="zr-row"><span class="zr-label">Wealth entered</span><span class="zr-val">${fmt(val)}</span></div><div class="zr-row"><span class="zr-label">Zakat rate</span><span class="zr-val" style="color:var(--teal-lt)">2.5%</span></div><div class="zr-row" style="border-top:1px solid rgba(255,255,255,.07);margin-top:4px;padding-top:4px"><span class="zr-label" style="font-size:14px;font-weight:600">Zakat due</span><span class="zr-val" style="color:var(--gold-lt);font-size:16px">${fmt(zakat)}</span></div>`;
  result=String(zakat); show();
};

window.nisabCheck=()=>{
  const val=parseFloat(result)||0;
  const nAg=Math.round(NISAB*SILVER), nAu=Math.round(85*GOLD);
  const mAg=val>=nAg, mAu=val>=nAu;
  const zb=get('zakat-box'); if(zb) zb.style.display='block';
  const zr=get('zakat-rows');
  if(zr) zr.innerHTML=`<div class="zr-row"><span class="zr-label">Your wealth</span><span class="zr-val">${fmt(val)}</span></div><div class="zr-row"><span class="zr-label">Silver nisab (595g)</span><span class="zr-val" style="${mAg?'color:var(--teal-lt)':'color:var(--fire-lt)'}">${fmt(nAg)} ${mAg?'✓ MET':'✗ Not met'}</span></div><div class="zr-row"><span class="zr-label">Gold nisab (85g)</span><span class="zr-val" style="${mAu?'color:var(--teal-lt)':'color:var(--fire-lt)'}">${fmt(nAu)} ${mAu?'✓ MET':'✗ Not met'}</span></div><div class="zr-row" style="border-top:1px solid rgba(255,255,255,.07);margin-top:4px;padding-top:4px"><span class="zr-label" style="font-size:14px">Zakat eligible?</span><span class="zr-val" style="font-size:15px;color:${mAg?'var(--teal-lt)':'var(--fire-lt)'}">${mAg?'✓ Yes':'✗ Not yet'}</span></div>${mAg?`<div class="zr-row"><span class="zr-label">Zakat due (2.5%)</span><span class="zr-val" style="color:var(--gold-lt)">${fmt(Math.round(val*0.025))}</span></div>`:''}`;
};

window.goldGram=()=>{
  const grams=parseFloat(result)||0; if(!grams) return;
  const zb=get('zakat-box'); if(zb) zb.style.display='block';
  const zr=get('zakat-rows');
  if(zr) zr.innerHTML=`<div class="zr-row"><span class="zr-label">Weight</span><span class="zr-val">${grams}g</span></div><div class="zr-row"><span class="zr-label">24K value</span><span class="zr-val" style="color:var(--gold-lt)">${fmt(Math.round(grams*GOLD))}</span></div><div class="zr-row"><span class="zr-label">22K value</span><span class="zr-val" style="color:var(--gold-lt)">${fmt(Math.round(grams*GOLD*22/24))}</span></div><div class="zr-row"><span class="zr-label">18K value</span><span class="zr-val" style="color:var(--gold)">${fmt(Math.round(grams*GOLD*18/24))}</span></div><div class="zr-row" style="border-top:1px solid rgba(255,255,255,.07);margin-top:4px;padding-top:4px"><span class="zr-label">Zakat on 22K</span><span class="zr-val" style="color:var(--teal-lt)">${fmt(Math.round(grams*GOLD*22/24*0.025))}</span></div>`;
  result=String(Math.round(grams*GOLD*22/24)); show();
};

/* Keyboard support */
document.addEventListener('keydown',e=>{
  if('0123456789'.includes(e.key)) num(e.key);
  else if(e.key==='.') dot();
  else if(['+','-','*','/'].includes(e.key)) op(e.key);
  else if(e.key==='Enter'||e.key==='=') equals();
  else if(e.key==='Backspace') delLast();
  else if(e.key==='Escape') clearAll();
  else if(e.key==='%') percent();
});

/* Theme */
window.setTheme=(th)=>{ document.documentElement.setAttribute('data-theme',th); localStorage.setItem('meezan-theme',th); document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th)); };
const t=localStorage.getItem('meezan-theme')||'glass';
document.documentElement.setAttribute('data-theme',t);
document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===t));

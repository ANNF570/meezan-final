/* ============================================================
   MEEZAN | js/calendar.js — Dual Calendar, Prayer Times
   HOW TO LINK: <script src="../js/calendar.js"></script>  (NOT module)
   ============================================================ */
const ALADHAN='https://api.aladhan.com/v1';
const get=id=>document.getElementById(id);
const set=(id,v)=>{ const e=get(id); if(e) e.textContent=v; };
let viewYear=new Date().getFullYear(), viewMonth=new Date().getMonth(), hijriCache={};

async function loadToday(){
  const now=new Date(), dd=String(now.getDate()).padStart(2,'0'), mm=String(now.getMonth()+1).padStart(2,'0'), yyyy=now.getFullYear();
  set('g-day',now.getDate()); set('g-month',now.toLocaleString('en',{month:'long'})); set('g-year',yyyy); set('g-wd',now.toLocaleString('en',{weekday:'long'}));
  try {
    const j=(await (await fetch(`${ALADHAN}/gToH/${dd}-${mm}-${yyyy}`)).json()).data?.hijri;
    if(j){ set('h-day',j.day); set('h-month',j.month.en); set('h-year',j.year+' AH'); set('h-wd',j.weekday.ar); showEvents(parseInt(j.year),parseInt(j.month.number)); }
  } catch { set('h-day','—'); set('h-month','API unavailable'); }
}

function showEvents(hy,hm){
  const EVENTS=[{name:'Islamic New Year',icon:'🌙',month:1,day:1},{name:'Ashura',icon:'🤲',month:1,day:10},{name:"Mawlid al-Nabi ﷺ",icon:'🕌',month:3,day:12},{name:'Ramadan begins',icon:'🌙',month:9,day:1},{name:'Laylatul Qadr',icon:'✨',month:9,day:27},{name:'Eid ul-Fitr',icon:'🎉',month:10,day:1},{name:'Eid ul-Adha',icon:'🐑',month:12,day:10}];
  const up=EVENTS.filter(e=>e.month>=hm), el=get('islamic-events'); if(!el) return;
  el.innerHTML=up.map(e=>`<div style="display:flex;align-items:center;gap:12px;background:var(--bg-row);border-radius:10px;border:1px solid var(--bdr);padding:10px 13px;margin-bottom:7px"><div style="font-size:22px;flex-shrink:0">${e.icon}</div><div><div style="font-size:13px;font-weight:600">${e.name}</div><div style="font-size:10px;color:var(--text-dim)">${e.day} ${['','Muharram','Safar','Rabi ul-Awwal','Rabi ul-Thani','Jumada ul-Awwal','Jumada ul-Thani','Rajab',"Sha'ban",'Ramadan','Shawwal',"Dhul Qa'dah",'Dhul Hijjah'][e.month]} ${hy} AH</div></div><div style="margin-left:auto;font-size:9px;padding:3px 8px;border-radius:10px;background:rgba(26,188,156,.12);color:var(--teal-lt);border:1px solid rgba(26,188,156,.2)">${e.month===hm?'This month':'Upcoming'}</div></div>`).join('')||'<div style="color:var(--text-dim);font-size:12px">No upcoming events</div>';
}

async function buildMonthGrid(){
  const now=new Date(), todayISO=now.toISOString().slice(0,10);
  const firstDay=new Date(viewYear,viewMonth,1), lastDay=new Date(viewYear,viewMonth+1,0);
  set('month-title',firstDay.toLocaleString('en',{month:'long',year:'numeric'}));
  const grid=get('month-grid'); if(!grid) return;
  grid.querySelectorAll('.cal-day-cell').forEach(c=>c.remove());
  for(let i=0;i<firstDay.getDay();i++){ const b=document.createElement('div'); b.className='cal-day-cell other-month'; const pd=new Date(viewYear,viewMonth,i-firstDay.getDay()+1); b.innerHTML=`<div class="greg-d">${pd.getDate()}</div>`; grid.appendChild(b); }
  for(let d=1;d<=lastDay.getDate();d++){
    const cell=document.createElement('div');
    const dISO=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cell.className='cal-day-cell'+(dISO===todayISO?' today':'');
    cell.innerHTML=`<div class="greg-d">${d}</div><div class="hijri-d" id="hd-${dISO}">...</div>`;
    grid.appendChild(cell);
  }
  /* Fetch Hijri for 1st of month */
  const ref=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`;
  if(!hijriCache[ref]){
    try { const j=(await (await fetch(`${ALADHAN}/gToH/01-${String(viewMonth+1).padStart(2,'0')}-${viewYear}`)).json()).data?.hijri; if(j) hijriCache[ref]=parseInt(j.day); } catch{}
  }
  if(hijriCache[ref]){ let hd=hijriCache[ref]; for(let d=1;d<=lastDay.getDate();d++){ const el=get(`hd-${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`); if(el) el.textContent=((hd+d-2)%30)+1; } }
  const hl=get('hijri-month-label'); if(hl) hl.textContent='Hijri dates are approximate ±1 day.';
}

window.changeMonth=dir=>{ viewMonth+=dir; if(viewMonth>11){viewMonth=0;viewYear++;} if(viewMonth<0){viewMonth=11;viewYear--;} buildMonthGrid(); };

async function loadPrayerTimes(){
  try {
    const city=localStorage.getItem('meezan-city')||'Hyderabad', country=localStorage.getItem('meezan-country')||'India';
    const res=await fetch(`${ALADHAN}/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=1`);
    const t=(await res.json()).data?.timings; if(!t) throw new Error();
    const prayers=[{name:'Fajr',time:t.Fajr},{name:'Sunrise',time:t.Sunrise},{name:'Dhuhr',time:t.Dhuhr},{name:'Asr',time:t.Asr},{name:'Maghrib',time:t.Maghrib},{name:'Isha',time:t.Isha}];
    const now=new Date(), nowMin=now.getHours()*60+now.getMinutes();
    let nextIdx=prayers.findIndex(p=>{ const[h,m]=p.time.split(':'); return parseInt(h)*60+parseInt(m)>nowMin; }); if(nextIdx<0) nextIdx=0;
    const ptEl=get('pt-location'); if(ptEl) ptEl.textContent='📍 '+city+', '+country;
    const ptList=get('prayer-times'); if(ptList) ptList.innerHTML=prayers.map((p,i)=>`<div style="display:flex;justify-content:space-between;padding:7px ${i===nextIdx?'10px':'0'};border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;${i===nextIdx?'background:rgba(212,160,23,.08);border-radius:8px;border:1px solid rgba(212,160,23,.2);margin-bottom:3px':''}${i===prayers.length-1?';border-bottom:none':''}"><span style="color:${i===nextIdx?'var(--gold-lt)':'var(--text-mid)'};font-weight:${i===nextIdx?'600':'400'}">${i===nextIdx?'⏰ ':''}${p.name}</span><span style="font-family:'Cinzel',serif;color:var(--gold-lt);font-size:12px">${p.time}</span></div>`).join('');
  } catch { const ptList=get('prayer-times'); if(ptList) ptList.innerHTML='<div style="color:var(--text-dim);font-size:12px">Could not load prayer times.</div>'; }
}

window.convertDate=async()=>{
  const val=get('conv-date')?.value; if(!val){ alert('Select a date.'); return; }
  const [y,m,d]=val.split('-');
  try {
    const j=(await (await fetch(`${ALADHAN}/gToH/${d}-${m}-${y}`)).json()).data;
    const el=get('conv-result'); if(!el) return;
    el.style.display='block';
    el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div style="font-size:9px;color:var(--amber);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Gregorian</div><div style="font-family:'Cinzel',serif;font-size:18px;color:var(--gold-lt)">${j.gregorian.day} ${j.gregorian.month.en} ${j.gregorian.year}</div><div style="font-size:11px;color:var(--text-dim)">${j.gregorian.weekday.en}</div></div><div><div style="font-size:9px;color:var(--teal-lt);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Hijri</div><div style="font-family:'Cinzel',serif;font-size:18px;color:var(--sky-lt)">${j.hijri.day} ${j.hijri.month.en} ${j.hijri.year} AH</div><div style="font-size:11px;color:var(--text-dim);font-family:'Noto Naskh Arabic',serif">${j.hijri.weekday.ar}</div></div></div>`;
  } catch { alert('Could not convert date. Check internet connection.'); }
};

/* Theme */
window.setTheme=(th)=>{ document.documentElement.setAttribute('data-theme',th); localStorage.setItem('meezan-theme',th); document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===th)); };
const t=localStorage.getItem('meezan-theme')||'glass';
document.documentElement.setAttribute('data-theme',t);
document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.title===t));
const cd=document.getElementById('conv-date'); if(cd) cd.value=new Date().toISOString().slice(0,10);

loadToday(); buildMonthGrid(); loadPrayerTimes();

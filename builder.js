// Calendar pattern builder: paint one full cycle on a calendar, then repeat it forward.
const Builder=(()=>{
const MONS=['January','February','March','April','May','June','July','August','September','October','November','December'];
let b=null; // {start,end,marks,brush,tool,months,name,fromY,fromM}
const T=()=>today();
const addD=(d,n)=>Rot.fmt(Rot.parseD(d)+n*Rot.DAY);
const short=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const lbl=m=>!m?'':!m.s?'OFF':(m.t?m.t.replace(/^0/,'').replace(':00',''):m.s)+' '+m.h;
const cls=m=>!m?'':!m.s?'boff':(m.t?'bcus ':'')+m.s;
// Model: marks (painted days) + turns [{s,e}] (each Set start..Set end pair) + cycle end (explicit marker, typed length, or suggested).
function open(cyc,name,sid){const t=T();const start=cyc?cyc.start:null;const marks={};
  if(cyc)cyc.days.forEach((d,i)=>{marks[addD(cyc.start,i)]=d.s?{...d}:{s:null};});
  const base=start||t;b={start,marks,turns:[],cycEnd:null,len:cyc?cyc.days.length:null,brush:{s:'AM',h:12},tool:'paint',sid:sid||null,name:name||'',fromY:+base.slice(0,4),fromM:+base.slice(5,7)-1,months:1,hist:[]};
  if(cyc){const e=addD(cyc.start,cyc.days.length-1);b.months=Math.min(12,(+e.slice(0,4)-b.fromY)*12+(+e.slice(5,7)-1-b.fromM)+1);}
  st.tab='builder';render();window.scrollTo(0,0);}
const snap=()=>{b.hist.push(JSON.stringify([b.marks,b.start,b.turns,b.cycEnd,b.len]));if(b.hist.length>60)b.hist.shift();};
const unsnap=h=>{[b.marks,b.start,b.turns,b.cycEnd,b.len]=JSON.parse(h);};
const days=(a,z)=>Math.round((Rot.parseD(z)-Rot.parseD(a))/Rot.DAY);
const done=()=>b.turns.filter(t=>t.e).sort((x,y)=>x.s<y.s?-1:1);
// Suggested length: through the last painted day, plus trailing off days = the off gap between turns (or, for one turn, N on -> N off)
// Gaps are measured by the day each shift COUNTS for: with the plant rule, a PM turn counts toward start+1.
const nn=()=>Rot.nightNext(st.s&&st.s.settings);
const shiftOf=t=>(b.marks[t.s]&&b.marks[t.s].s)||null;
const cS=t=>shiftOf(t)==='PM'&&nn()?addD(t.s,1):t.s, cE=t=>shiftOf(t)==='PM'&&nn()?addD(t.e,1):t.e;
function gapsInfo(){const T2=done();return T2.slice(1).map((t,i)=>({cal:days(T2[i].e,t.s)-1,cnt:days(cE(T2[i]),cS(t))-1,from:shiftOf(T2[i]),to:shiftOf(t)}));}
function suggest(){if(!b.start)return{len:0,why:''};const ds=Object.keys(b.marks).filter(d=>d>=b.start&&b.marks[d].s).sort();const T2=done();
  if(!T2.length){const last=ds.length?ds[ds.length-1]:b.start;return{len:days(b.start,last)+1,why:''};}
  // counted span from the first counted day to the last counted day, plus trailing counted off days
  const c0=T2.map(cS).sort()[0],c1=T2.map(cE).sort().pop();let trail,why;
  // Trailing counted-off target: equal-length turns (N on) -> N off; otherwise the counted gap between the first two turns.
  // The cycle ends at last counted day + target, so after a PM turn (next-day rule) the calendar shows exactly target+1 days off.
  const lens=T2.map(t=>days(t.s,t.e)+1);
  if(T2.length>=2){if(lens.every(l=>l===lens[0])){trail=lens[0];why=`${trail} on / ${trail} off: ${trail} counted off after the last turn`;}else{const g=gapsInfo();trail=Math.max(0,g[0].cnt);why=`${trail} counted off after the last turn, same as the gap between turns`;}}
  else{trail=days(T2[0].s,T2[0].e)+1;why=`${trail} on / ${trail} off`;}
  // cycle is anchored at the first calendar start; counted span is shift-invariant
  const len=days(c0,c1)+1+trail;return{len,why};}
function cycleEnd(){if(!b.start)return null;if(b.cycEnd&&b.cycEnd>=b.start)return b.cycEnd;return addD(b.start,(b.len||suggest().len)-1);}
const cycle=()=>b.start?Rot.cycleFromMarks(b.marks,b.start,cycleEnd()):[];
function inCycle(d){const e=cycleEnd();return !!(b.start&&d>=b.start&&e&&d<=e);}
function put(d,v){snap();if(v===undefined)delete b.marks[d];else b.marks[d]=v;if(!b.start||d<b.start)b.start=d;}
const bv=()=>b.brush.s?{...b.brush}:{s:null};
// Set start: opens a new turn on d (painted with the brush) and arms Set end.
function setStart(d){snap();b.turns=b.turns.filter(t=>t.e);b.turns.push({s:d,e:null});b.marks[d]=bv();if(!b.start||d<b.start)b.start=d;}
// Set end: closes the most recent open turn and fills ONLY that turn (start..end) with the brush. Days between turns stay Off.
function setEnd(d){snap();let t=b.turns.find(x=>!x.e);if(!t){t={s:d,e:null};b.turns.push(t);}
  if(d<t.s){t.e=t.s;t.s=d;}else t.e=d;for(let x=t.s;x<=t.e;x=addD(x,1))b.marks[x]=bv();if(!b.start||t.s<b.start)b.start=t.s;}
function removeTurn(i){const t=b.turns[i];if(!t)return;snap();for(let x=t.s;x<=(t.e||t.s);x=addD(x,1))delete b.marks[x];b.turns.splice(i,1);
  const ds=Object.keys(b.marks).sort();b.start=ds.length?ds[0]:null;if(!b.start){b.cycEnd=null;b.len=null;}}
function tap(d){
  if(b.tool==='start'){setStart(d);b.tool='end';return draw();}
  if(b.tool==='end'){setEnd(d);b.tool='paint';return draw();}
  if(b.tool==='cend'){snap();if(!b.start)b.start=d;b.cycEnd=d<b.start?b.start:d;b.len=null;b.tool='paint';return draw();}
  if(b.tool==='copy'){const p=b.marks[addD(d,-1)];put(d,p?{...p}:{s:null});return draw();}
  if(b.tool==='erase'){put(d,undefined);return draw();}
  put(d,b.brush.s?{...b.brush}:{s:null});draw();}
function month(y,m){const first=Date.UTC(y,m,1),n=new Date(Date.UTC(y,m+1,0)).getUTCDate(),lead=new Date(first).getUTCDay();let h='';const ce=cycleEnd();
  for(let k=1;k<=n;k++){const d=Rot.fmt(first+(k-1)*Rot.DAY);const mk=b.marks[d];const inC=inCycle(d);const v=mk||(inC?{s:null}:null);
    const ti=b.turns.findIndex(t=>t.s===d),te=b.turns.findIndex(t=>t.e===d);
    const fl=ti>=0?`<span class="flag tflag" data-turn="${ti}" title="Turn ${ti+1} start (tap to remove turn)">▶${ti+1}</span>`:te>=0?`<span class="flag tflag" data-turn="${te}" title="Turn ${te+1} end (tap to remove turn)">■${te+1}</span>`:'';
    const inT=b.turns.some(t=>d>=t.s&&d<=(t.e||t.s));
    h+=`<button class="d bd ${cls(v)} ${inC?'inc':''} ${inT?'inturn':''} ${d===b.start?'cstart':''} ${d===ce?'cend':''} ${mk?'':'unm'}" data-bd="${d}"><span class="n">${k}</span><span class="s">${lbl(v)}</span>${fl}${d===ce?`<span class="flag cflag">${b.cycEnd?'END':'end'}</span>`:''}</button>`;}
  return`<div class="bmonth"><h4>${MONS[m]} ${y}</h4><div class="grid">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(lead)}${h}</div></div>`;}
// Preview: one continuous calendar from the cycle start. Painted cycle first, then repeats right after; each repeat start is flagged.
function preview(){const c=cycle();if(!c.length)return'<p class="muted">Paint some days to see the preview.</p>';
  const L=c.length,t=T(),S=Rot.parseD(b.start);const span=Math.max(90,2*L+14);const endT=S+span*Rot.DAY;
  let y=+b.start.slice(0,4),m=+b.start.slice(5,7)-1,h='';
  while(Date.UTC(y,m,1)<=endT){const first=Date.UTC(y,m,1),n=new Date(Date.UTC(y,m+1,0)).getUTCDate();let cells='',w=0,hrs=0;
    for(let k=0;k<n;k++){const tm=first+k*Rot.DAY,d=Rot.fmt(tm),off=Math.round((tm-S)/Rot.DAY);
      if(off<0||tm>endT){cells+=`<div class="d pv-out"><span class="n">${k+1}</span></div>`;continue;}
      const i=off%L,rep=Math.floor(off/L),x=c[i];if(x.s){w++;hrs+=x.h;}
      cells+=`<div class="d ${x.s||'pv-off'} ${x.s&&x.t?'cus':''} ${rep===0?'orig':''} ${i===0?'rstart':''} ${d===t?'today':''}" data-pd="${d}" data-ci="${i}" data-rep="${rep}" data-v="${x.s?(x.t||'')+'|'+x.s+'|'+x.h:'off'}"><span class="n">${k+1}</span><span class="s">${x.s?lbl(x):''}</span>${i===0?`<span class="flag">${rep===0?'CYCLE':'↻'+(rep+1)}</span>`:''}</div>`;}
    h+=`<div class="pmonth"><h4>${MONS[m]} ${y} <small>${w} shifts · ${hrs} h</small></h4><div class="grid mini">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(new Date(first).getUTCDay())}${cells}</div></div>`;
    if(++m>11){m=0;y++;}}
  return`<p class="muted"><span class="lg orig"></span> your painted ${L}-day cycle · <b>↻</b> marks where each repeat begins</p>`+h;}
function brushBar(){const B=b.brush,tool=b.tool;const on=(c)=>c?'on':'';const pb=tool==='paint'||tool==='start'||tool==='end';
  return`<div class="brushes" role="toolbar" aria-label="Brush">
   <button class="br boff ${on(pb&&!B.s)}" data-br="off">Off</button><button class="br AM ${on(pb&&B.s==='AM'&&!B.t)}" data-br="AM">AM</button>
   <button class="br PM ${on(pb&&B.s==='PM'&&!B.t)}" data-br="PM">PM</button><button class="br bcus ${on(pb&&B.t)}" data-br="custom">${B.t?Rot.ft(B.t):'Time…'}</button></div>
  <div class="hrsbar ${B.s?'':'dim'}" role="group" aria-label="Shift length">${[8,12,16].map(h=>`<button class="hr ${on(pb&&B.s&&B.h===h)}" data-h="${h}">${h}h</button>`).join('')}</div>
  <div class="tools"><button class="tl ${on(tool==='copy')}" data-tl="copy">⧉ Copy prev</button><button class="tl ${on(tool==="erase")}" data-tl="erase">⌫ Erase</button><button class="tl rst" id="bReset">⟲ Reset</button>
   <button class="tl ${on(tool==='start')}" data-tl="start">▶ Set start</button><button class="tl ${on(tool==='end')}" data-tl="end">■ Set end</button><button class="tl ${on(tool==='cend')}" data-tl="cend">⏹ End of cycle</button></div>
  <p class="hint" id="hint">${tool==='start'?`Tap the first day of this turn (brush <b>${B.s?(B.t||B.s)+' '+B.h+'h':'Off'}</b>). Then tap its last day.`:tool==='end'?`Tap the last day of this turn. Only this turn gets the brush (<b>${B.s?(B.t||B.s)+' '+B.h+'h':'Off'}</b>); days between turns stay Off.`:tool==='cend'?'Tap the last day of the whole cycle (include the off days after the last turn).':tool==='copy'?'Tap a day to copy the day before it.':tool==='erase'?'Tap a day to clear it.':`Brush: <b>${B.s?(B.t||B.s)+' '+B.h+'h':'Off'}</b>. Tap days to paint, long-press for details.`}</p>`;}
function draw(){const c=cycle();const work=c.filter(x=>x.s).length;const def=Rot.defaultName(c.length||1);
  const loadOpts=Rot.crewList(st.s.rotation).map(x=>`<option value="c:${esc(x)}">Current: ${esc(Rot.cycleName(st.s.rotation,x))}</option>`).join('')+
    Rot.crewList(Rot.rotationFromTemplate(st.template)).map(x=>`<option value="t:${esc(x)}">Plant: ${esc(x)}</option>`).join('');
  main.innerHTML=`<div class="card bhead"><div class="shead"><button class="back" id="bBack">‹ Setup</button><b>Calendar builder</b><button class="back" id="bUndo" ${b.hist.length?'':'disabled'}>↶ Undo</button></div>
   <p class="muted">Tap each day of <b>one full cycle</b>. Days you skip inside the cycle count as Off.</p>
   <details id="bLoad"><summary>Start from a built-in pattern</summary><select id="bSrc">${loadOpts}</select><button class="btn sec" id="bLoadBtn">Load into builder</button></details></div>
  <div class="card sticky-tools">${brushBar()}</div>
  <div class="card" id="bCal">${Array.from({length:b.months},(_,i)=>{const m0=b.fromM+i;return month(b.fromY+Math.floor(m0/12),m0%12);}).join('')}
   <div class="two"><button class="btn sec" id="bPrevM">‹ Earlier month</button><button class="btn sec" id="bNextM">Next month ›</button></div></div>
  <div class="card" id="bSum"><h3>Cycle</h3><p id="cycInfo">${c.length?`<b>${c.length} days</b> (${short(b.start)} – ${short(addD(b.start,c.length-1))}) · ${work} shifts · ${c.length-work} off`:'Nothing marked yet.'}</p>
   ${b.start?(()=>{const sg=suggest();const src=b.cycEnd?'set by End of cycle marker':b.len?'typed by you':'suggested';return`<div class="lenrow"><label for="bLen">Cycle length (days)</label><input type="number" id="bLen" min="1" max="400" value="${c.length}">
     <small id="lenWhy">${src}${!b.cycEnd&&!b.len&&sg.why?' · '+esc(sg.why):''}${(b.cycEnd||b.len)&&sg.len!==c.length?` · suggested ${sg.len}${sg.why?' ('+esc(sg.why)+')':''} <button class="linkbtn" id="useSug">Use ${sg.len}</button>`:''}</small></div>
     ${gapsInfo().length?`<p class="muted" id="gapInfo">${gapsInfo().map((g,i)=>`Gap ${i+1}: ${g.cal} day${g.cal===1?'':'s'} off on the calendar${g.cnt!==g.cal?` · ${g.cnt} counted`:''}`).join(' · ')}${nn()&&gapsInfo().some(g=>g.cnt!==g.cal)?' · <b>Nights count toward the next day</b>':''}</p>`:''}
     ${(()=>{const c=cycle();if(!c.length)return'';const L=c.length;const last=c.map((x,i)=>x.s?i:-1).filter(i=>i>=0).pop();if(last===undefined)return'';const trailCal=L-1-last;const lastPM=c[last].s==='PM'&&nn();
       return`<p class="muted" id="trailInfo">After the last turn: ${trailCal} day${trailCal===1?'':'s'} off on the calendar before the cycle repeats${lastPM?` (${trailCal-1} counted; the last night counts toward the next day)`:''}.</p>`;})()}
     ${b.turns.length?`<p class="muted" id="turnList">${b.turns.map((t,i)=>`Turn ${i+1}: ${short(t.s)}${t.e?' – '+short(t.e):' (open: tap Set end)'}`).join(' · ')} · tap a ▶/■ flag to remove a turn</p>`:''}`;})():''}
   <h3>Preview</h3><div id="bPrev">${preview()}</div>
   <label for="bName">Name this schedule (optional)</label><input type="text" id="bName" maxlength="60" placeholder="${esc(def)}" value="${esc(b.name)}">
   <button class="btn" id="bSave" ${c.length?'':'disabled'}>Save &amp; repeat this cycle</button><small id="bMsg"></small></div>`;
  wire();}
function details(d){const cur=b.marks[d]||{s:null};const f={s:cur.s,h:cur.h||12,t:cur.t||''};const sb=$('#sheetbox');const close=()=>{$('#sheet').hidden=true;};
  const title=new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
  const dr=()=>{sb.innerHTML=`<div class="shead"><span></span><span class="stepn">Day details</span><button class="x" id="cls" aria-label="Close">✕</button></div><h3>${title}</h3>
    <p class="q">What is this day?</p><div class="choices three">${[['off','Off','clr'],['AM','AM','am'],['PM','PM','pm']].map(([v,t,c])=>`<button class="choice ${c} ${(v==='off'?!f.s:f.s===v)?'sel':''}" data-ds="${v}"><span>${t}</span></button>`).join('')}</div>
    ${f.s?`<label for="dTime">Start time (blank = usual ${Rot.ft(st.s.rotation.shiftTimes[f.s][0])})</label><input type="time" id="dTime" value="${f.t}">
    <p class="q">How many hours?</p><div class="choices three">${[8,12,16].map(h=>`<button class="choice hrs ${f.h===h?'sel':''}" data-dh="${h}"><span>${h}h</span></button>`).join('')}</div>`:''}
    <div class="two" style="margin-top:12px"><button class="btn sec" id="dCopy">⧉ Copy previous day</button><button class="btn sec" id="dClear">Clear</button></div>
    <button class="btn" id="dOk">Done</button><button class="btn sec" id="dBrush">Done &amp; use as brush</button>`;
    $('#cls').onclick=close;sb.querySelectorAll('[data-ds]').forEach(x=>x.onclick=()=>{const v=x.dataset.ds;f.s=v==='off'?null:v;dr();});
    sb.querySelectorAll('[data-dh]').forEach(x=>x.onclick=()=>{f.h=+x.dataset.dh;f.t=$('#dTime').value;dr();});
    const val=()=>{if($('#dTime'))f.t=$('#dTime').value;return f.s?{s:f.s,h:f.h,...(f.t?{t:f.t}:{})}:{s:null};};
    $('#dOk').onclick=()=>{put(d,val());close();draw();};$('#dBrush').onclick=()=>{const v=val();put(d,v);b.brush=v.s?v:{s:null,h:b.brush.h};b.tool='paint';close();draw();};
    $('#dCopy').onclick=()=>{const p=b.marks[addD(d,-1)];put(d,p?{...p}:{s:null});close();draw();};$('#dClear').onclick=()=>{put(d,undefined);close();draw();};};
  dr();$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};}
function customTime(){const sb=$('#sheetbox');const s=b.brush.s||'AM';sb.innerHTML=`<div class="shead"><span></span><span class="stepn">Custom brush</span><button class="x" id="cls" aria-label="Close">✕</button></div>
  <p class="q">Shift</p><div class="choices two"><button class="choice am ${s==='AM'?'sel':''}" data-cs="AM"><span>AM</span></button><button class="choice pm ${s==='PM'?'sel':''}" data-cs="PM"><span>PM</span></button></div>
  <label for="cTime">Start time</label><input type="time" id="cTime" value="${b.brush.t||'07:00'}"><button class="btn" id="cOk">Use this brush</button>`;
  let cs=s;sb.querySelectorAll('[data-cs]').forEach(x=>x.onclick=()=>{cs=x.dataset.cs;sb.querySelectorAll('[data-cs]').forEach(y=>y.classList.toggle('sel',y===x));});
  const close=()=>{$('#sheet').hidden=true;};$('#cls').onclick=close;$('#cOk').onclick=()=>{b.brush={s:cs,h:b.brush.h||12,t:$('#cTime').value||undefined};if(!b.brush.t)delete b.brush.t;if(b.tool!=='start'&&b.tool!=='end')b.tool='paint';close();draw();};
  $('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};}
function wire(){
  $('#bBack').onclick=()=>{st.tab='setup';render();};
  $('#bUndo').onclick=()=>{const h=b.hist.pop();if(h){unsnap(h);draw();}};
  main.querySelectorAll('[data-br]').forEach(x=>x.onclick=()=>{const v=x.dataset.br;if(v==='custom')return customTime();if(b.tool!=='start'&&b.tool!=='end')b.tool='paint';b.brush=v==='off'?{s:null,h:b.brush.h||12}:{s:v,h:b.brush.h||12};draw();});
  main.querySelectorAll('[data-h]').forEach(x=>x.onclick=()=>{b.brush.h=+x.dataset.h;if(!b.brush.s)b.brush.s='AM';if(b.tool!=='start'&&b.tool!=='end')b.tool='paint';draw();});
  $('#bReset').onclick=()=>{if(!Object.keys(b.marks).length&&!b.start&&!b.turns.length)return;if(!confirm('Clear the whole calendar?'))return;
    snap();b.marks={};b.start=null;b.turns=[];b.cycEnd=null;b.len=null;b.tool='paint';draw();};
  if($('#bLen'))$('#bLen').onchange=e=>{const v=Math.round(+e.target.value);if(!(v>=1))return;snap();b.len=v;b.cycEnd=null;draw();};
  if($('#useSug'))$('#useSug').onclick=()=>{snap();b.len=null;b.cycEnd=null;draw();};
  main.querySelectorAll('[data-tl]').forEach(x=>x.onclick=()=>{const v=x.dataset.tl;b.tool=b.tool===v?'paint':v;draw();});
  $('#bNextM').onclick=()=>{b.months++;draw();const ms=main.querySelectorAll('.bmonth');ms[ms.length-1].scrollIntoView({block:'start'});};
  $('#bPrevM').onclick=()=>{b.fromM--;if(b.fromM<0){b.fromM=11;b.fromY--;}b.months++;draw();};
  $('#bName').oninput=e=>{b.name=e.target.value;};
  $('#bLoadBtn').onclick=()=>{const v=$('#bSrc').value;const rot=v[0]==='c'?st.s.rotation:Rot.rotationFromTemplate(st.template);const crew=v.slice(2);
    const cyc=Rot.cycleOf(rot,crew);const nm=rot.custom?rot.label:'';open(cyc,nm||b.name);};
  // tap = paint, long-press (450ms) = details sheet
  main.querySelectorAll('[data-bd]').forEach(el=>{let tm=null,long=false;const d=el.dataset.bd;
    el.addEventListener('pointerdown',()=>{long=false;tm=setTimeout(()=>{long=true;details(d);},450);});
    const cancel=()=>{clearTimeout(tm);};el.addEventListener('pointerup',cancel);el.addEventListener('pointerleave',cancel);el.addEventListener('pointercancel',cancel);
    el.addEventListener('contextmenu',e=>{e.preventDefault();});
    el.onclick=e=>{if(long){long=false;return;}const f=e.target.closest('.tflag');if(f){const i=+f.dataset.turn;if(confirm(`Remove turn ${i+1}?`)){removeTurn(i);draw();}return;}tap(d);};});
  $('#bSave').onclick=async()=>{const c=cycle();if(!c.length)return;const rot=Rot.fromCalendar(b.start,c,b.name,st.s.rotation.shiftTimes);
    await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({rotation:b.sid?{...rot,sid:b.sid}:rot,crew:'My schedule'})});await load();b=null;st.tab='cal';
    const t=today();st.month=[+t.slice(0,4),+t.slice(5,7)-1];render();};}
return{open,render:()=>{if(!b)open();else draw();},_state:()=>b,_tap:tap,_setEnd:setEnd,_setStart:setStart,_suggest:suggest,_gaps:gapsInfo,_cycle:cycle,_removeTurn:removeTurn};})();

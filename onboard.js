// First-run wizard for NEW users only (settings.onboarded===false). Existing users never see it.
// Steps: 1 Crew & position · 2 Shifts & alarms · 3 Appearance · 4 Schedule (+ preview & corrections) · 5 Holidays · 6 Done
const Onboard=(()=>{
const STEPS=['Crew','Shifts','Look','Schedule','Holidays','Done'];
const K='pc_ob_step';const getStep=()=>Math.min(6,Math.max(1,+localStorage.getItem(K)||1));const setStep=n=>localStorage.setItem(K,String(n));
let fix={};let months=12;let pm=null;let note=''; // pending corrections on the preview (date -> 'AM'|'PM'|null)
const S=()=>st.s.settings;const crews=()=>{const t=st.template?Rot.crewList(Rot.rotationFromTemplate(st.template)):[];return t;};
const patch=b=>api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify(b)}).then(load);
const setS=o=>patch({settings:{...S(),...o,onboarded:false}});
function dots(n){return`<div class="obsteps" aria-label="Step ${n} of 6">${STEPS.map((l,i)=>`<span class="${i+1<n?'done':i+1===n?'on':''}"><b>${i+1}</b>${l}</span>`).join('')}</div><p class="obof">Step ${n} of 6</p>`;}
const nav=(n,next='Next')=>`<div class="obnav">${n>1?'<button class="btn sec" id="obBack">‹ Back</button>':'<span></span>'}<button class="btn" id="obNext">${next}</button></div><small class="obmsg" id="obMsg"></small>`;
// plain-words summary of earlier choices (steps 3-5) with big Change buttons: jump there, then come straight back here
const SRC={plant:'Plant rotation (preset)',import:'Printed calendar import',design:'Uploaded / built schedule',build:'Painted on a calendar',skip:'Skipped for now'};
const srcLabel=()=>{const k=localStorage.getItem('pc_ob_sched');return k?SRC[k]||k:'Not chosen yet';};
const shiftLabel=()=>{const s=S(),r=st.s.rotation;if(r.generic)return Object.entries(r.shiftTypes||{}).map(([k,T])=>`${T.name||k} ${Rot.ft(T.start)} · ${T.hours} h`).join(', ');return`${s.shiftHours||12} h, day ${Rot.ft((s.shiftStarts||{}).AM||'06:00')}, night ${Rot.ft((s.shiftStarts||{}).PM||'18:00')}`;};
function recap(n){if(n<3||n>5)return'';const it=[['1','Crew',myCrew()],['2','Shifts',shiftLabel()]];if(n>4)it.push(['4','Schedule',srcLabel()]);
  return`<div class="obrecap" aria-label="Your choices so far">${it.map(([k,l,v])=>`<div class="obrc"><span><small>${l}</small><b>${esc(v)}</b></span><button class="btn sec obchg" data-chg="${k}">Change</button></div>`).join('')}</div>`;}
const shell=(n,h,body,next)=>{$('#tabs').hidden=true;const sel=$('#crew');if(sel)sel.remove();main.innerHTML=`${st.notice?`<div class="card" id="notice">${esc(st.notice)}</div>`:''}<div class="card onb ob" data-step="${n}">${dots(n)}${recap(n)}<h2>${h}</h2>${body}${nav(n,next)}</div>`;
  if($('#obBack'))$('#obBack').onclick=()=>{localStorage.removeItem('pc_ob_ret');go(n-1);};
  main.querySelectorAll('[data-chg]').forEach(b=>b.onclick=()=>change(+b.dataset.chg,n));};
function change(k,from){localStorage.setItem('pc_ob_ret',String(from));if(k===4){localStorage.removeItem('pc_ob_sched');fix={};}go(k);}
const msg=t=>{$('#obMsg').textContent=t;};
function go(n){const r=+localStorage.getItem('pc_ob_ret')||0;if(r&&n>getStep()&&n<=r){n=r;localStorage.removeItem('pc_ob_ret');}else if(r&&n>=r)localStorage.removeItem('pc_ob_ret');if(n!==4)note='';setStep(n);render();window.scrollTo(0,0);}
function render(){const n=getStep();[null,step1,step2,step3,step4,step5,step6][n]();}
// ---- 1. crew & position
function step1(){const s=S();const custom=s.customCrews||[];const cur=localStorage.getItem('pc_ob_crew')||'';
  shell(1,'Welcome to Punch Card',`<img class="oblogo" src="logo.png" alt="Punch Card logo" width="96" height="96"><p class="muted">Tell us your crew and position. You can change all of this later in Setup.</p><p><button class="linkbtn privlink" id="obPriv" type="button">🔒 Privacy, in plain words</button></p>
   <label for="obName">Your first name <small class="muted">(optional)</small></label><input type="text" id="obName" maxlength="30" autocomplete="given-name" placeholder="e.g. Luciano" value="${esc(s.firstName||'')}"><small class="muted">Family on your shared link will see it, e.g. “Luciano’s schedule”. Leave it empty to skip.</small>
   <label for="obCrew">Select crew</label><select id="obCrew"><option value="" ${cur?'':'selected'} disabled>Select crew</option>
   <optgroup label="Plant crews (saved preset)" id="obPlantGrp" ${crews().includes(cur)?'':'hidden'}>${crews().map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join('')}</optgroup>
   ${custom.length?`<optgroup label="My crews">${custom.map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join('')}</optgroup>`:''}</select>
   <div class="addrow"><input type="text" id="obNewCrew" maxlength="30" placeholder="Crew name not listed? e.g. Red, Blue, 1st"><button class="addbtn" id="obAddCrew">＋ Add crew</button></div>
   <button class="linkbtn" id="obPresets" type="button">Use a saved preset (plant rotation)…</button><small class="muted">Your crew name is just a label; your real crews, shifts and cycle come from your upload or build in step 4.</small>
   <label for="obPos">My position</label><input type="text" id="obPos" maxlength="40" placeholder="Type your position" value="${esc(s.jobTitle||'')}">
   <div id="obPosList">${(s.jobs||[]).map(j=>posRow(j)).join('')}</div>
   <button class="btn sec" id="obAddPos">＋ Add position</button><small class="muted">Extra positions you sometimes work (for overtime labels). Optional.</small>`);
  $('#obPresets').onclick=()=>{$('#obPlantGrp').hidden=false;$('#obPresets').hidden=true;$('#obCrew').focus();};
  const wireRm=()=>main.querySelectorAll('.obposrm').forEach(b=>b.onclick=()=>b.parentElement.remove());wireRm();
  $('#obAddPos').onclick=()=>{$('#obPosList').insertAdjacentHTML('beforeend',posRow(''));wireRm();$('#obPosList').lastElementChild.querySelector('input').focus();};
  $('#obPriv').onclick=()=>Beta.showPrivacy();
  $('#obAddCrew').onclick=()=>{const v=$('#obNewCrew').value.trim();if(!v)return;const sel=$('#obCrew');let g=sel.querySelector('optgroup[label="My crews"]');if(!g){g=document.createElement('optgroup');g.label='My crews';sel.appendChild(g);}
    if(![...sel.options].some(o=>o.value===v)){const o=document.createElement('option');o.textContent=v;g.appendChild(o);}sel.value=v;$('#obNewCrew').value='';};
  $('#obNext').onclick=async()=>{const c=$('#obCrew').value;if(!c)return msg('Select your crew (or add your own crew name).');
    const myCrews=[...main.querySelectorAll('optgroup[label="My crews"] option')].map(o=>o.value);
    const jobs=[...main.querySelectorAll('.obpos input')].map(i=>i.value.trim()).filter(Boolean);
    const plant=crews().includes(c);const body={settings:{...S(),customCrews:myCrews,jobTitle:$('#obPos').value.trim(),jobs,firstName:$('#obName').value.trim(),onboarded:false}};
    // last pick wins: a changed crew replaces the crew of whatever schedule is already loaded (plant preset, import, build)
    const prev=localStorage.getItem('pc_ob_crew')||'';const have=Rot.crewList(st.s.rotation);
    if(c!==prev||st.s.crew!==c){if(have.includes(c)&&!st.s.rotation.blank)body.crew=c;else if(plant&&localStorage.getItem('pc_ob_sched')==='plant'){body.activate='plant';body.crew=c;}
      else if(localStorage.getItem('pc_ob_sched')&&!have.includes(c))localStorage.removeItem('pc_ob_sched'); // the loaded schedule has no such crew: choose again in step 4
      dropFixes('you changed your crew');}
    await patch(body);st.obCrew=c;localStorage.setItem('pc_ob_crew',c);go(2);};}
const posRow=v=>`<div class="addrow obpos"><input type="text" maxlength="40" placeholder="Another position" value="${esc(v)}"><button class="addbtn obposrm" aria-label="Remove position">✕</button></div>`;
const myCrew=()=>localStorage.getItem('pc_ob_crew')||st.s.crew;
// ---- 2. shifts & alarms
function step2(){const s=S();const h=+s.shiftHours||12;const ss=s.shiftStarts||{};const am=ss.AM||'06:00',pmT=ss.PM||'18:00';const on=!(st.s.alarm&&st.s.alarm.on===false);
  shell(2,'Your shifts',`<label>Standard shift length</label><div class="seg" id="obLen">${[8,10,12,16].map(x=>`<button data-h="${x}" class="${h===x?'on':''}">${x} h</button>`).join('')}<button data-h="c" class="${[8,10,12,16].includes(h)?'':'on'}">Custom</button></div>
   <div id="obCus" ${[8,12,16].includes(h)?'hidden':''}><label for="obHrs">Hours per shift</label><input type="number" id="obHrs" min="1" max="24" step="0.5" value="${h}"></div>
   <div class="two"><div><label for="obAm">Day shift (AM) starts</label><input type="time" id="obAm" value="${am}"></div><div><label for="obPm">Night shift (PM) starts</label><input type="time" id="obPm" value="${pmT}"></div></div>${clockSeg('obClock')}
   <div class="obconf">Crew: <b>${esc(myCrew())}</b> <button class="linkbtn" id="obChCrew">Change</button></div>
   <label class="chk offtoggle"><input type="checkbox" id="obAlarm" ${on?'checked':''}> <span><b>Alarms</b><br><small class="muted">Wake-up alarm, night-before reminder and calendar alerts.</small></span></label>
   <div id="obLeadBox" class="${on?'':'dim'}"><label for="obLead">Alarm before shift starts (minutes)</label><input type="number" id="obLead" min="0" step="15" value="${st.s.alarm.leadMin}"></div>
   <label>Night shifts count toward</label><div class="seg two-seg" id="obNc">${[['start','The day it starts'],['next','The next day']].map(([k,l])=>`<button data-nc="${k}" class="${(s.nightCounts||'next')===k?'on':''}">${l}</button>`).join('')}</div>`);
  let hh=h;main.querySelectorAll('#obLen button').forEach(b=>b.onclick=()=>{main.querySelectorAll('#obLen button').forEach(x=>x.classList.toggle('on',x===b));$('#obCus').hidden=b.dataset.h!=='c';if(b.dataset.h!=='c')hh=+b.dataset.h;});
  let nc=s.nightCounts||'next';main.querySelectorAll('#obNc button').forEach(b=>b.onclick=()=>{nc=b.dataset.nc;main.querySelectorAll('#obNc button').forEach(x=>x.classList.toggle('on',x===b));});
  $('#obAlarm').onchange=e=>$('#obLeadBox').classList.toggle('dim',!e.target.checked);wireClock();$('#obChCrew').onclick=()=>go(1);
  $('#obNext').onclick=async()=>{if(!$('#obCus').hidden)hh=+$('#obHrs').value;if(!(hh>=1&&hh<=24))return msg('Shift length must be 1–24 hours.');
    await patch({settings:{...S(),clock:Rot.clock(),shiftHours:hh,shiftStarts:{AM:$('#obAm').value||'06:00',PM:$('#obPm').value||'18:00'},nightCounts:nc,onboarded:false},alarm:{on:$('#obAlarm').checked,leadMin:+$('#obLead').value||0}});go(3);};}
// ---- 3. appearance with live preview
function miniCal(from,n,ov,editable,rot){const days=Rot.range(rot||st.s.rotation,rot?'A':st.s.crew,from,n,rot?{}:{...st.s.overrides,...ov},rot?{}:st.s.settings);const lead=new Date(Rot.parseD(from)).getUTCDay();
  return`<div class="grid obgrid">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(lead)}${days.map(d=>{const f=fix[d.date]!==undefined;const sh=f?fix[d.date]:d.shift;
    return`<button class="d ${f?(clsOf(sh)):Rot.cls(d)} ${f?'work fixed':d.kind} ${d.date===today()?'today':''}" data-od="${d.date}" ${editable?'':'tabindex="-1"'}><span class="n">${+d.date.slice(8)}</span><span class="s">${f?(sh||'OFF'):label(d)}</span></button>`;}).join('')}</div>`;}
function step3(){const t=today();const from=t.slice(0,8)+'01';const pref=Theme.get();
  const plant=crews().includes(myCrew());
  shell(3,'Make it yours',`<p class="muted">Pick colors and light/dark. The calendar below updates as you choose.</p>
   <div class="seg" role="group" aria-label="Theme">${['auto','light','dark'].map(k=>`<button data-theme-opt="${k}" class="${pref===k?'on':''}">${Theme.ICON[k]} ${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>
   <div id="obPrev" class="obprev"><h4>${MON[+t.slice(5,7)-1]} preview${plant?'':' (sample)'}</h4>${miniCal(from,new Date(Date.UTC(+t.slice(0,4),+t.slice(5,7),0)).getUTCDate(),{},false,st.s.rotation.blank?sample(from):null)}</div>
   <div class="obcolors">${Colors.panel()}</div>`);
  main.querySelectorAll('[data-theme-opt]').forEach(b=>b.onclick=()=>{Theme.set(b.dataset.themeOpt);main.querySelectorAll('[data-theme-opt]').forEach(x=>x.classList.toggle('on',x===b));});
  Colors.wire(main,()=>{});$('#obNext').onclick=()=>go(4);}
// colors-only sample for the Look step while a new user has no schedule yet (not saved anywhere)
const sample=from=>Rot.makeGeneric({name:'Sample',start:from,L:6,types:{D:{start:'07:00',hours:12,kind:'day'},N:{start:'19:00',hours:12,kind:'night'}},crews:[{name:'A',days:['D','D','N','N',null,null]}]});
const codesOf=r=>r.generic?Object.keys(r.shiftTypes||{}):['AM','PM'];
const clsOf=c=>{const r=st.s.rotation;if(!c)return'';if(!r.generic)return c;const T=(r.shiftTypes||{})[c]||{};return T.kind==='night'?'PM':T.kind==='swing'?'SW':'AM';};
// ---- 4. schedule
const isCustomRot=()=>!!(st.s.rotation.custom||st.s.rotation.imported);
function step4(){const c=myCrew();const plant=crews().includes(c);const chosen=localStorage.getItem('pc_ob_sched');
  if(!chosen){shell(4,'Your schedule',`<p class="muted">How should Punch Card get your days? After this you'll see a preview to check.</p>
     <button class="btn" id="obDetect">🔎 Upload my schedule (any format)</button><small class="muted">CSV/spreadsheet export, text, PDF or photo. Punch Card detects your crews, shift types and times, and the cycle; you check it before it is saved.</small>
     <button class="btn" id="obDesign">🧩 Build my schedule</button><small class="muted">Optional templates (2-2-3, DuPont, 4x10, 24/48…) or custom: any crews, shifts, times and on/off pattern.</small>
     <h4>Other ways</h4><button class="btn sec" id="obImp">📸 Printed AM/PM rotation calendar (screenshots)</button>
     <button class="btn sec" id="obPdf">📄 Printed rotation calendar PDF</button>
     <button class="btn sec" id="obBuild">✏️ Paint days on a calendar</button>
     ${plant?`<button class="btn sec" id="obPlant">🏭 Use the plant rotation for ${esc(c)}</button>`:''}`,'Skip for now');
    const pick=k=>localStorage.setItem('pc_ob_sched',k);
    $('#obImp').onclick=$('#obPdf').onclick=()=>{pick('import');Import.open();};$('#obBuild').onclick=()=>{pick('build');Builder.open();};$('#obDetect').onclick=()=>Design.open('detect');$('#obDesign').onclick=()=>Design.open('build');
    if($('#obPlant'))$('#obPlant').onclick=async()=>{pick('plant');if(st.s.activeSid||isCustomRot()||st.s.rotation.blank)await patch({activate:'plant',crew:c});else await patch({crew:c});render();};
    $('#obNext').onclick=()=>{pick('skip');render();};return;}
  // preview (2 months) with tap-to-correct
  const t=today();const from=t.slice(0,8)+'01';const y=+t.slice(0,4),m=+t.slice(5,7)-1;const n1=new Date(Date.UTC(y,m+1,0)).getUTCDate(),n2=new Date(Date.UTC(y,m+2,0)).getUTCDate();
  const from2=Rot.fmt(Date.UTC(y,m+1,1));const nf=Object.keys(fix).length;const custom=isCustomRot()||nf>0;
  const cl=Rot.crewList(st.s.rotation);const ci=cl.indexOf(st.s.crew);
  shell(4,'Check your schedule',`${note?`<p class="warn" id="obNote">${esc(note)}</p>`:''}${cl.length>1?`<div class="obcrewsw" role="group" aria-label="Crew"><button class="btn sec small" id="obCrewPrev" aria-label="Previous crew">‹</button><select id="obCrewSw" aria-label="Crew">${cl.map(c=>`<option ${c===st.s.crew?'selected':''}>${esc(c)}</option>`).join('')}</select><button class="btn sec small" id="obCrewNext" aria-label="Next crew">›</button></div>`:''}<p class="muted">Using <b id="obUsing">${esc(Rot.cycleName(st.s.rotation,st.s.crew))}</b>. Does this match? If a day is wrong, tap it to change it (${codesOf(st.s.rotation).map(esc).join(' → ')} → Off). Punch Card works out the repeating pattern from your fixes.</p>
   <h4>${MON[m]} ${y}</h4>${miniCal(from,n1,{},true)}<h4>${MON[(m+1)%12]} ${m===11?y+1:y}</h4>${miniCal(from2,n2,{},true)}
   ${nf?`<p class="warn" id="obFixInfo">${nf} day${nf>1?'s':''} corrected.</p>`:''}
   ${custom?`<label for="obLenM">Repeat this schedule for</label><select id="obLenM">${[1,3,6,9,12,15,18,21,24].map(k=>`<option value="${k}" ${k===months?'selected':''}>${k} month${k>1?'s':''}</option>`).join('')}</select>`:''}
   <button class="btn sec" id="obRedo">↺ Choose a different way</button>`,nf?'Save fixes & continue':'Looks right · Next');
  main.querySelectorAll('[data-od]').forEach(b=>b.onclick=()=>{const d=b.dataset.od;const cur=fix[d]!==undefined?fix[d]:Rot.day(st.s.rotation,st.s.crew,d,st.s.overrides,st.s.settings).shift;
    const cs=codesOf(st.s.rotation);const ix=cur?cs.indexOf(cur):-1;const nx=ix<0?(cur?null:cs[0]):(cs[ix+1]||null);const base=Rot.day(st.s.rotation,st.s.crew,d,{},{}).base;if(nx===base&&!st.s.overrides[d])delete fix[d];else fix[d]=nx;const sy=window.scrollY;render();window.scrollTo(0,sy);});
  if($('#obCrewSw')){$('#obCrewSw').onchange=e=>switchCrew(e.target.value);$('#obCrewPrev').onclick=()=>switchCrew(cl[(ci-1+cl.length)%cl.length]);$('#obCrewNext').onclick=()=>switchCrew(cl[(ci+1)%cl.length]);}
  if($('#obLenM'))$('#obLenM').onchange=e=>{months=+e.target.value;};
  $('#obRedo').onclick=()=>{localStorage.removeItem('pc_ob_sched');fix={};render();};
  $('#obNext').onclick=async()=>{months=$('#obLenM')?+$('#obLenM').value:months;
    if(Object.keys(fix).length||custom){const rot=derive(fix,from,n1+n2);if(!Object.keys(fix).length){const r=st.s.rotation;await patch({rotation:{...r,until:rot.until,sid:st.s.activeSid},crew:st.s.crew});}else await patch({rotation:rot,crew:'My schedule'});fix={};}
    go(5);};}
// Repeating cycle from the corrected preview: apply each fix to the current cycle (fix lands on its cycle position); if fixes disagree, find the shortest period in the corrected window.
function derive(fx,from,n){const r=st.s.rotation,c=st.s.crew;if(r.generic)return deriveG(fx,from,n);const cyc=Rot.cycleOf(r,c);const L=cyc.days.length;
  const win=[];for(let k=0,t=Rot.parseD(from);k<n;k++,t+=Rot.DAY){const d=Rot.fmt(t);const b=Rot.day(r,c,d,{},{}).base;win.push({d,s:fx[d]!==undefined?fx[d]:b});}
  let days=null,start=cyc.start;
  if(L&&L<=n){const pat=cyc.days.map(x=>x.s||null);const set={};let ok=true;for(const [d,s] of Object.entries(fx)){const i=((Math.round((Rot.parseD(d)-Rot.parseD(cyc.start))/Rot.DAY)%L)+L)%L;if(i in set&&set[i]!==s)ok=false;set[i]=s;}
    if(ok){for(const i in set)pat[i]=set[i];days=pat.map(s=>({s}));}}
  if(!days){let P=n;for(let p=1;p<=n/2;p++)if(win.every((x,i)=>i+p>=n||x.s===win[i+p].s)){P=p;break;}days=win.slice(0,P).map(x=>({s:x.s}));start=from;}
  const rot=Rot.fromCalendar(start,days,(crews().includes(myCrew())?'':myCrew()+' ')+'schedule (corrected)',r.shiftTimes);const end=new Date(Rot.parseD(from));end.setUTCMonth(end.getUTCMonth()+months);rot.until=Rot.fmt(end.getTime()-Rot.DAY);return rot;}
// generic (detected/built) rotation: apply fixes to my crew's cycle position, keep the other crews and shift types
function deriveG(fx,from,n){const r=st.s.rotation;const cfg=Rot.toConfig(r);const me=cfg.crews.find(x=>x.name===st.s.crew)||cfg.crews[0];const L=cfg.L;
  for(const[d,s]of Object.entries(fx)){const i=((Math.round((Rot.parseD(d)-Rot.parseD(cfg.start))/Rot.DAY)%L)+L)%L;me.days[i]=s;}
  const end=new Date(Rot.parseD(cfg.start>from?cfg.start:from));end.setUTCMonth(end.getUTCMonth()+months);const rot=Rot.makeGeneric({...cfg,name:cfg.name,until:Rot.fmt(end.getTime()-Rot.DAY),months});rot.sid=r.sid;return rot;}
function dropFixes(why){const n=Object.keys(fix).length;if(n){fix={};note=`${n} day fix${n>1?'es were':' was'} cleared because ${why}.`;}}
async function switchCrew(c){if(c===st.s.crew)return;dropFixes('you switched crew');localStorage.setItem('pc_ob_crew',c);await patch({crew:c});const sy=window.scrollY;render();window.scrollTo(0,sy);}
// ---- 5. holidays
// Holidays are chosen ONCE in setup, here, right after the calendar is checked. Dates found on an imported calendar wait here (pc_ob_hol), pre-checked.
const found=()=>{try{return JSON.parse(localStorage.getItem('pc_ob_hol')||'[]');}catch(e){return[];}};
function step5(){const s=S();const sel=new Set(s.holidays||[]);const fd=found();const cus0=new Set((s.customHolidays||[]).map(c=>c.d));const nice=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  const fdRow=d=>{const id=Hol.match(d);const nm=id?Hol.LIST.find(h=>h.id===id).name:'Plant holiday';return`<label class="chk"><input type="checkbox" data-obf="${d}" checked> ${esc(nm)} <small class="muted">${nice(d)}</small></label>`;};const row=h=>`<label class="chk"><input type="checkbox" data-obh="${h.id}" ${sel.has(h.id)?'checked':''}> ${esc(h.name)}</label>`;
  shell(5,'Holidays',`<p class="muted">Your calendar is set. Last thing: pick the holidays your job recognizes. They show on your calendar.</p>
   ${fd.length?`<h4>Found on your calendar</h4><div class="hollist" id="obFound">${fd.filter(d=>!cus0.has(d)).map(fdRow).join('')}</div>`:''}
   <div class="two"><button class="btn sec" id="obHAll">Select all federal</button><button class="btn sec" id="obHNone">None</button></div>
   <h4>Federal holidays</h4><div class="hollist">${Hol.LIST.filter(h=>h.fed).map(row).join('')}</div><h4>Common contract extras</h4><div class="hollist">${Hol.LIST.filter(h=>!h.fed).map(row).join('')}</div>
   <button class="btn sec" id="obHYear">📅 Holidays from my contract (tap dates)</button>${(s.customHolidays||[]).length?`<small class="muted">${s.customHolidays.length} contract date(s) marked.</small>`:''}
   <label>On a holiday I…</label><div class="seg two-seg" id="obHOff">${[['work','Work as scheduled'],['off','Get the day off']].map(([k,l])=>`<button data-ho="${k}" class="${(s.holidaysOff?'off':'work')===k?'on':''}">${l}</button>`).join('')}</div>`);
  const ids=()=>[...main.querySelectorAll('[data-obh]:checked')].map(e=>e.dataset.obh);let off=!!s.holidaysOff;
  $('#obHAll').onclick=()=>main.querySelectorAll('[data-obh]').forEach(e=>{if(Hol.LIST.find(h=>h.id===e.dataset.obh).fed)e.checked=true;});$('#obHNone').onclick=()=>main.querySelectorAll('[data-obh]').forEach(e=>e.checked=false);
  main.querySelectorAll('#obHOff button').forEach(b=>b.onclick=()=>{off=b.dataset.ho==='off';main.querySelectorAll('#obHOff button').forEach(x=>x.classList.toggle('on',x===b));});
  const save=()=>{const h=new Set(ids());const cus=[...(s.customHolidays||[])];main.querySelectorAll('[data-obf]:checked').forEach(e=>{const d=e.dataset.obf;const id=Hol.match(d);if(id)h.add(id);else if(!cus.some(c=>c.d===d))cus.push({d,n:'Plant holiday'});});localStorage.removeItem('pc_ob_hol');return setS({holidays:[...h],holidaysOff:off,customHolidays:cus});};
  $('#obHYear').onclick=async()=>{await save();HolYear.open();};
  $('#obNext').onclick=async()=>{await save();go(6);};}
// ---- 6. done
function step6(){const s=S();const r=st.s.rotation;
  const row=(k,l,v)=>`<li class="obrc"><span><small>${l}</small><b>${v}</b></span><button class="btn sec obchg" data-chg="${k}">Change</button></li>`;
  shell(6,'Check everything, then finish',`<p class="muted">Here is everything you picked. Tap <b>Change</b> to fix anything; you'll come right back here.</p><ul class="obsum obrecap">
   ${row(1,'Your name',s.firstName?esc(s.firstName):'— (skipped)')}${row(1,'Crew',esc(myCrew())+(isCustomRot()&&Rot.cycleName(r,st.s.crew)!==myCrew()?` · ${esc(Rot.cycleName(r,st.s.crew))}`:''))}${row(1,'Position',esc(s.jobTitle||'—')+((s.jobs||[]).length?` + ${s.jobs.length} more`:''))}
   ${row(2,'Shifts',r.generic?esc(shiftLabel()):`${s.shiftHours||12} h, AM ${esc(Rot.ft((s.shiftStarts||{}).AM||'06:00'))}, PM ${esc(Rot.ft((s.shiftStarts||{}).PM||'18:00'))}`)}${row(2,'Clock',Rot.clock()==='24'?'24-hour (19:00)':'12-hour (7:00 PM)')}${row(2,'Alarms',st.s.alarm.on===false?'off':'on, '+st.s.alarm.leadMin+' min before')}
   ${row(3,'Look',esc(Theme.get()))}${row(4,'Schedule',esc(srcLabel())+(r.until?` · repeats until ${r.until}`:''))}${row(5,'Holidays',`${(s.holidays||[]).length+(s.customHolidays||[]).length} · ${s.holidaysOff?'days off':'worked'}`)}</ul>
   <p class="muted">Everything can be changed later in Setup.</p>`,'Open my calendar');
  $('#obNext').onclick=async()=>{await patch({settings:{...S(),onboarded:true}});typeof PCA!=='undefined'&&PCA.track('onboarding_completed');['pc_ob_step','pc_ob_sched','pc_ob_crew','pc_ob_ret','pc_ob_hol'].forEach(k=>localStorage.removeItem(k));localStorage.setItem('pc_name_nudge','1');st.notice=null;$('#tabs').hidden=false;st.tab='cal';const t=today();st.month=[+t.slice(0,4),+t.slice(5,7)-1];window.render();};}
return{render,go,derive,setMonths:m=>{months=m;},_fix:()=>fix};})();

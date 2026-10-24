const $=s=>document.querySelector(s),main=$('#main');
// Feature flags. customPatterns: Setup cards 'N on / N off' + 'Text pattern builder' (hidden since v31; see docs/hidden-features.md). Override: window.PC_FEATURES={customPatterns:true} or localStorage pc_feat_customPatterns='1'.
const FEATURES=Object.assign({customPatterns:false,shareReminder:true},window.PC_FEATURES||{});try{if(localStorage.getItem('pc_feat_customPatterns')==='1')FEATURES.customPatterns=true;if(localStorage.getItem('pc_feat_shareReminder')==='1')FEATURES.shareReminder=true;}catch(e){}
const st={tab:'cal',month:null,s:null,mode:'owner',id:null,token:null,viewId:null,template:null};
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
const API=window.PC_API||'',BASE=window.PC_BASE||'';const APP=location.origin+BASE;// API origin (Render) and the app's own address (may be the static front end)
const PC_TEST=(()=>{try{return localStorage.getItem('pc_test')==='1'||/[?&]pc_test=1/.test(location.search);}catch(e){return false;}})();let pcOpened=false;
const api=(p,o={})=>fetch(API+p,{...o,headers:{'Content-Type':'application/json',...(PC_TEST?{'X-Test':'1'}:{}),...(st.token?{'X-Edit-Token':st.token}:{}),...(o.headers||{})}}).then(async r=>{const j=await r.json();if(!r.ok){const e=new Error(j.error||r.status);e.status=r.status;throw e;}return j;});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// clock format: owner = schedule setting (falls back to this device), viewer = this device only; default 12-hour
Rot.clockFn=()=>{try{if(st&&st.mode!=='view'&&st.s&&st.s.settings&&['12','24'].includes(st.s.settings.clock))return st.s.settings.clock;}catch(e){}return localStorage.getItem('pc_clock')==='24'?'24':'12';};
const clockSeg=id=>`<label>Clock format <small class="muted clkEx">Times show like ${Rot.ft('19:00')}</small></label><div class="seg two-seg" id="${id}" role="group" aria-label="Clock format">${[['12','12-hour (7:00 PM)'],['24','24-hour (19:00)']].map(([k,l])=>`<button type="button" data-clk="${k}" class="${Rot.clock()===k?'on':''}">${l}</button>`).join('')}</div>`;
function wireClock(again){document.querySelectorAll('[data-clk]').forEach(b=>b.onclick=async()=>{document.querySelectorAll('[data-clk]').forEach(x=>x.classList.toggle('on',x===b));await setClock(b.dataset.clk);document.querySelectorAll('.clkEx').forEach(e=>e.textContent='Times show like '+Rot.ft('19:00'));if(again)again();});}
function nextBanner(days){const d=days.find(x=>x.shift&&x.kind!=='vacation'&&x.kind!=='hol-off'&&Rot.times(st.s.rotation,x)&&new Date(Rot.times(st.s.rotation,x).end+':00')>new Date());if(!d)return'';const t=Rot.times(st.s.rotation,d);
  const on=st.mode==='view'?vOn():alarmsOn();const lead=+(st.s.alarm&&st.s.alarm.leadMin)||0;const w=new Date(new Date(t.start+':00').getTime()-lead*60000);const wt=String(w.getHours()).padStart(2,'0')+':'+String(w.getMinutes()).padStart(2,'0');
  return`<div class="card nextb" id="nextBanner"><small class="muted">Next shift</small><b>${new Date(Rot.parseD(d.date)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})} · ${esc(d.shift)} ${Rot.ft(t.start)} – ${Rot.ft(t.end)}</b>${on?`<small>Alarm ${Rot.ft(wt)} (${lead} min before)</small>`:''}</div>`;}
async function setClock(c){localStorage.setItem('pc_clock',c);if(st.mode!=='view'&&st.id&&st.s){st.s.settings={...st.s.settings,clock:c};try{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,clock:c}})});}catch(e){}}}
function label(d){if(d.kind==='vacation')return'VAC';if(d.kind==='hol-off')return'OFF';if(d.kind==='off-ovr')return'OFF';return d.shift?(d.kind==='work'&&d.hours!==12?d.shift+' '+d.hours:d.shift):'';}
async function boot(){
  if('serviceWorker'in navigator)navigator.serviceWorker.register(BASE+'/sw.js',{scope:BASE+'/',updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
  st.template=await fetch('template.json').then(r=>r.json());
  const p=location.pathname.slice(BASE.length)||'/';let m;
  if(m=p.match(/^\/v\/([\w-]+)/)){st.mode='view';st.viewId=m[1];}
  else if(m=p.match(/^\/e\/([\w-]+)/)){const t=new URLSearchParams(location.search).get('t');
    if(t){const prev=getSaved();const frag=fragCfg();
      // keep any existing copy for this schedule (never wipe it); fall back to the copy carried in the link's #fragment
      const keep=prev&&prev.id===m[1]&&prev.cfg?prev:(frag&&frag.id===m[1]?frag:{id:m[1],token:t});localStorage.setItem('sched',JSON.stringify({...keep,id:m[1],token:t}));}}
  else if(!localStorage.getItem('sched')){const f=fragCfg();if(f&&f.id&&f.token)localStorage.setItem('sched',JSON.stringify(f));}
  const t=today();st.month=[+t.slice(0,4),+t.slice(5,7)-1];
  document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;render();});
  if(st.mode==='view'){$('#tabs').querySelector('[data-t=setup]').remove();$('#tabs').querySelector('[data-t=share]').remove();}
  // Returning users: open instantly from this phone's copy, then sync when the server answers (it may be waking up)
  const cached=cachedSched();let shown=false;
  if(cached){st.s=cached;if(st.mode==='owner'){const sv=getSaved();st.id=sv.id;st.token=sv.token;}render();shown=true;syncBadge('Syncing…');}
  const wake=setTimeout(()=>{if(shown)syncBadge('Waking up the server…');else bootMsg('Waking up the schedule server…','Free hosting naps when nobody has used it for a while. This takes up to a minute, only the first time.');},2500);
  try{if(st.mode==='owner')await ownerBoot();else{try{await load();}catch(e){if(e.status===404&&!shown)return friendly('This schedule link isn\'t active right now','Ask the person who shared it to open Punch Card on their phone. That brings the link back.');throw e;}}}
  catch(e){clearTimeout(wake);if(shown){syncBadge('Offline · showing the copy saved on this phone',true);return;}throw e;}
  clearTimeout(wake);syncBadge(null);
  // live updates
  const es=new EventSource(API+'/api/s/'+st.s.viewId+'/events');es.onmessage=()=>load().then(render);
  setInterval(()=>load().then(render),60000); // polling fallback
  render();shareReminder();}
async function load(){const rq=typeof Req!=='undefined'?Req.load():null;st.s=st.mode==='view'?await api('/api/s/'+st.viewId+(pcOpened?'':(pcOpened=true,'?open=1'))):await api('/api/schedules/'+st.id);await rq;if(st.mode==='owner')persist();else try{localStorage.setItem('pc_view_'+st.viewId,JSON.stringify(st.s));}catch(e){}}
// copy to show instantly while the server wakes (owner: the saved setup; viewer: last schedule seen on this device)
function cachedSched(){try{if(st.mode==='view'){const v=JSON.parse(localStorage.getItem('pc_view_'+st.viewId)||'null');return v&&v.viewId===st.viewId?v:null;}
  const sv=getSaved();if(!sv||!sv.cfg||!sv.id||!sv.token||!sv.viewId)return null;const c=sv.cfg;
  return{...c,viewId:sv.viewId,rotation:unpackRot(c.rotation),overrides:c.overrides||{},saved:c.saved||[],settings:{jobTitle:'',jobs:[],onboarded:true,nightCounts:'next',holidays:[],customHolidays:[],holidaysOff:false,holidaysWork:[],...(c.settings||{})},alarm:c.alarm||{leadMin:90,on:true},push:{times:c.pushTimes||{},count:0},_cached:true};}catch(e){return null;}}
function bootMsg(t,sub){const m=$('#bootMsg');if(m){m.textContent=t;$('#bootSub').textContent=sub||'';}}
function syncBadge(t,warn){let b=$('#sync');if(!t){if(b)b.remove();return;}if(!b){b=document.createElement('div');b.id='sync';document.body.appendChild(b);}b.textContent=t;b.className=warn?'warn':'';}
// Local copy of the schedule config so a server data reset never loses the owner's setup.
const getSaved=()=>{try{return JSON.parse(localStorage.getItem('sched')||'null');}catch(e){return null;}};
function persist(){const s=st.s;if(!s)return;const rec={id:st.id,token:st.token,viewId:s.viewId,cfg:{name:s.name,crew:s.crew,rotation:s.rotation,tz:s.tz,settings:s.settings,overrides:s.overrides,saved:s.saved||[],activeSid:s.activeSid||null,plantOverrides:s.plantOverrides,plantCrew:s.plantCrew,alarm:s.alarm,pushTimes:s.push&&s.push.times,updatedAt:s.updatedAt}};
  localStorage.setItem('sched',JSON.stringify(rec));
  // second copy: in the address bar (#c=...), so a bookmark / home-screen icon made from this page carries the setup too
  try{history.replaceState(null,'',BASE+`/e/${st.id}?t=${encodeURIComponent(st.token)}#c=${packCfg(rec)}`);}catch(e){}}
// Compact, URL-safe copy of the setup. Plant-template rotations are stored by variant only.
function packCfg(rec){const c={...rec.cfg};c.saved=(c.saved||[]).map(e=>({sid:e.sid,name:e.name}));// #c= only references saved entries by id; full copies live on the phone + server
  if(st.template&&!c.rotation.custom&&!c.rotation.imported&&(c.rotation.name===st.template.name||c.rotation.variant)&&!c.rotation.extra?.['My schedule'])c.rotation={tpl:c.rotation.variant||st.template.defaultVariant};
  const j=JSON.stringify({id:rec.id,token:rec.token,viewId:rec.viewId,cfg:c});return btoa(unescape(encodeURIComponent(j))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function fragCfg(){const m=location.hash.match(/[#&]c=([\w-]+)/);if(!m)return null;try{const j=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')))));return j&&j.id?j:null;}catch(e){return null;}}
// built-in plant rotations are always re-derived from the current template (a stale phone copy must not bring back old dates)
function unpackRot(r){if(r&&r.tpl)return Rot.rotationFromTemplate(st.template,r.tpl);if(r&&st.template&&!r.custom&&!r.imported&&(r.name===st.template.name||(r.variant&&st.template.variants[r.variant]))&&st.template.variants[r.variant||st.template.defaultVariant])return Rot.rotationFromTemplate(st.template,r.variant||st.template.defaultVariant);return r;}
async function createFresh(){const r=await api('/api/schedules',{method:'POST',body:JSON.stringify({name:'My shifts',crew:'My schedule',rotation:Rot.blank(today()),tz:'America/New_York',settings:{onboarded:false,jobTitle:'',jobs:[]}})});
  st.id=r.id;st.token=r.editToken;localStorage.setItem('sched',JSON.stringify({id:r.id,token:r.editToken}));await load();}
async function ownerBoot(){const saved=getSaved();
  if(!saved||!saved.id||!saved.token){localStorage.removeItem('sched');return createFresh();}
  st.id=saved.id;st.token=saved.token;
  const restore=async()=>{const c={...saved.cfg,rotation:unpackRot(saved.cfg.rotation)};await api('/api/schedules',{method:'POST',body:JSON.stringify({...c,restore:{id:saved.id,editToken:saved.token,viewId:saved.viewId}})});await load();};
  try{await load();
    // server only has the built-in seed copy (data store was wiped): push this phone's newer copy back up
    if(st.s.seeded&&saved.cfg&&saved.viewId===st.s.viewId)try{await restore();}catch(e){}
    return;}catch(e){if(e.status!==404&&e.status!==403)throw e;
    if(e.status===404&&saved.cfg&&saved.viewId){try{await restore();return;}catch(e2){}} // server lost it: quietly recreate with the same links
    if(e.status===404){ // no copy on this phone (fresh phone / home-screen app): never throw the link away
      return new Promise(res=>{$('#tabs').hidden=true;main.innerHTML=`<div class="card onb"><h2>Your schedule is waking up</h2><p class="muted">The server doesn't have this schedule right now. Open Punch Card once on the phone or browser where you set it up, and it comes right back with the same links.</p>
        <button class="btn" id="retry">Try again</button><button class="btn sec" id="fresh">Start a new setup instead</button></div>`;
        $('#retry').onclick=()=>location.reload();$('#fresh').onclick=async()=>{localStorage.removeItem('sched');st.token=null;await createFresh();$('#tabs').hidden=false;res();};});}
    // wrong token for an existing schedule: start fresh
    localStorage.removeItem('sched');st.token=null;await createFresh();
    st.notice='Your saved schedule link has expired, so we started a fresh setup. Pick your settings below, then share your new link.';}}
function colorSheet(){const sb=$('#sheetbox');const close=()=>{$('#sheet').hidden=true;};
  sb.innerHTML=`<div class="shead"><span></span><span class="stepn">Display settings</span><button class="x" id="cls" aria-label="Close">✕</button></div><h3>Shift colors</h3>${Colors.panel()}
   <h3>Theme</h3><div class="seg">${['auto','light','dark'].map(k=>`<button data-theme-opt="${k}">${Theme.ICON[k]} ${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>`;
  Colors.wire(sb);sb.querySelectorAll('[data-theme-opt]').forEach(b=>b.onclick=()=>Theme.set(b.dataset.themeOpt));Theme.apply();
  $('#cls').onclick=close;$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};}
function friendly(t,msg){$('#tabs').hidden=true;main.innerHTML=`<div class="card onb"><h2>${esc(t)}</h2><p class="muted">${esc(msg)}</p></div>`;}
function header(){
  $('#title').textContent=st.mode==='view'?`${(st.s.settings.firstName||'').trim()?holder(true)+' schedule':st.s.name} · ${Rot.cycleName(st.s.rotation,st.s.crew)}`:'Punch Card';
  const tb='<button class="themebtn hbtn hbug" id="bugHdr" aria-label="Report a bug" title="Report a bug">🐞</button><button class="themebtn" id="themeBtn"></button>'+(st.mode==='view'?'<button class="themebtn hbtn" id="colorBtn" aria-label="Colors">🎨</button>':'');
  if(st.mode==='view'){$('#hdrRight').innerHTML='<small style="color:#cbd5e1">read-only · live</small>'+tb;}
  else{const act=st.s.activeSid||null;const sv=st.s.saved||[];const tpl=st.template?Rot.rotationFromTemplate(st.template):null;
    // plant crews (built-in), then every saved imported/built schedule; an imported multi-crew schedule lists its crews under its name
    // the plant rotation is an optional preset: listed only once this user has chosen it (never for new users by default)
    const usedPlant=tpl&&Rot.crewList(tpl).includes(st.s.plantCrew);const plant=act?(usedPlant?Rot.crewList(tpl):[]):Rot.crewList(st.s.rotation);
    let opts=plant.length===0?'':`<optgroup label="${st.s.rotation.blank&&!act?'No schedule yet':'Plant rotation'}">${plant.map(c=>`<option value="p|${esc(c)}" ${!act&&c===st.s.crew?'selected':''}>${esc(c)}${!act&&!Rot.verified(st.s.rotation,c)?' (unverified)':''}</option>`).join('')}</optgroup>`;
    // one line per saved schedule; the ACTIVE imported schedule also lists its crews so you can change crew inside it
    const many=e=>{const cl=e.rotation?Rot.crewList(e.rotation):[e.crew];return cl.length>1&&cl[0]!=='My schedule'?cl:null;};
    if(sv.length)opts+=`<optgroup label="My saved schedules">${sv.map(e=>`<option value="s|${e.sid}|${esc(e.crew)}" ${act===e.sid&&!many(e)?'selected':''}>${esc(e.name)}${many(e)?` (${esc(act===e.sid?st.s.crew:e.crew)})`:''}</option>`).join('')}</optgroup>`;
    const ae=sv.find(e=>e.sid===act);if(ae&&many(ae))opts+=`<optgroup label="${esc(ae.name)}: crew">${many(ae).map(c=>`<option value="s|${ae.sid}|${esc(c)}" ${st.s.crew===c?'selected':''}>${esc(c)}</option>`).join('')}</optgroup>`;
    $('#hdrRight').innerHTML=`<select id="crew" aria-label="Schedule">${opts}</select>`+tb;
    $('#crew').onchange=async e=>{const [k,a,c]=e.target.value.split('|');const body=k==='p'?(act?{activate:'plant',crew:a}:{crew:a}):(act===a?{crew:c}:{activate:a,crew:c});
      await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify(body)});await load();render();};}
  $('#themeBtn').onclick=()=>Theme.cycle();if($('#bugHdr'))$('#bugHdr').onclick=()=>Beta.openBug();Theme.apply();if($('#colorBtn'))$('#colorBtn').onclick=colorSheet;
  const b=$('#banner');if(!Rot.verified(st.s.rotation,st.s.crew)){b.hidden=false;b.textContent=`⚠ ${Rot.cycleName(st.s.rotation,st.s.crew)} is UNVERIFIED (reconstructed). Double-check against the posted calendar.`;}else b.hidden=true;}
function render(){header();if(st.tab==='privacy')return Beta.renderPrivacy();if(st.mode==='owner'&&st.s.settings&&st.s.settings.onboarded===false&&!['builder','import','holyear','design'].includes(st.tab))return renderOnboarding();document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===st.tab));
  if(st.tab==='requests')return Req.renderOwner();if(st.tab==='design')return Design.render();if(st.tab==='builder')return Builder.render();if(st.tab==='import')return Import.render();if(st.tab==='holyear')return HolYear.render();
  ({cal:renderCal,list:renderList,share:renderShare,setup:renderSetup})[st.tab]();}
const tl=k=>{const ss=(st.s.settings.shiftStarts||{})[k]||st.s.rotation.shiftTimes[k][0];const h=+st.s.settings.shiftHours||12;const [a,b]=ss.split(':').map(Number);const f=m=>{m=((m%1440)+1440)%1440;const H=Math.floor(m/60),M=m%60;return Rot.clock()==='24'?String(H).padStart(2,'0')+':'+String(M).padStart(2,'0'):(H%12||12)+(M?':'+String(M).padStart(2,'0'):'')+(H<12?'a':'p');};return f(a*60+b)+'–'+f(a*60+b+h*60);};
function renderCal(){const [y,m]=st.month;const first=Date.UTC(y,m,1),n=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  const days=Rot.range(st.s.rotation,st.s.crew,Rot.fmt(first),n,st.s.overrides,st.s.settings);const lead=new Date(first).getUTCDay();const t=today();
  let work=0,hrs=0;const mk=Rot.fmt(first).slice(0,7);Rot.range(st.s.rotation,st.s.crew,Rot.fmt(first-Rot.DAY),n+1,st.s.overrides,st.s.settings).forEach(d=>{if(d.shift&&Rot.countedDate(d,st.s.settings).slice(0,7)===mk){work++;hrs+=d.hours;}});
  const nameNudge=st.mode==='owner'&&!((st.s.settings.firstName||'').trim())&&!localStorage.getItem('pc_name_nudge');
  main.innerHTML=(nameNudge?`<div class="card" id="nameNudge"><h3>What should family call you?</h3><p class="muted">Add your first name so your shared link says “Luciano’s schedule” instead of a generic title. Optional.</p><div class="addrow"><input type="text" id="nnIn" maxlength="30" autocomplete="given-name" placeholder="Your first name"><button class="addbtn" id="nnSave">Save</button></div><button class="linkbtn" id="nnSkip" type="button">Not now</button></div>`:'')+(Beta.needLinkNudge()?Beta.linkCard(true):'')+(st.mode==='owner'?Req.ownerBar():'')+`<div class="card"><div class="mhead"><button class="nav" id="prev" aria-label="Previous month">‹</button><h2>${MON[m]} ${y}</h2><button class="nav" id="next" aria-label="Next month">›</button></div>
  <div class="grid">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(lead)}
  ${days.map(d=>`<button class="d ${Rot.cls(d)} ${d.swapTo?'swapoff':''} ${d.shift&&d.start&&!d.std&&d.kind==='work'?'cus':''} ${d.kind} ${d.date===t?'today':''}" data-d="${d.date}"><span class="n">${+d.date.slice(8)}</span><span class="s">${label(d)}</span>${d.job?`<span class="j">${esc(Rot.jobLabel(d.job,st.s.settings))}</span>`:''}${hol(d.date)?`<span class="hol" title="${esc(hol(d.date).name)}">${esc(hol(d.date).short)}</span>`:''}${d.swapTo||d.swapFrom?`<span class="swx" title="${d.swapTo?'Swapped to '+d.swapTo:'Swapped from '+d.swapFrom}">⇄</span>`:''}${Req.mark(d.date)}</button>`).join('')}</div>
  <div class="legend"><span><i style="background:var(--am)"></i>AM ${tl("AM")}</span><span><i style="background:var(--pm)"></i>PM ${tl("PM")}</span><span><i style="background:var(--off)"></i>Off</span><span><i style="background:var(--vac)"></i>Vacation</span><span><i style="border:3px solid var(--ot)"></i>Overtime</span><span><i style="border:3px solid var(--swap)"></i>Swap</span>${days.some(d=>hol(d.date))?'<span><i style="background:var(--hol)"></i>Holiday</span>':''}${days.some(d=>d.shift&&d.start&&!d.std&&d.kind==='work')?'<span><i style="background:var(--cus)"></i>Custom time</span>':''}</div>
  <p class="muted">${work} shifts · ${hrs} h this month${st.mode==='owner'?' · tap a day to add vacation / OT / swap':' · tap a day to send a request'}</p></div>`+(st.mode==='view'?Req.viewerCard():'');
  $('#prev').onclick=()=>{st.month=m?[y,m-1]:[y-1,11];renderCal();};$('#next').onclick=()=>{st.month=m<11?[y,m+1]:[y+1,0];renderCal();};Beta.bindLink();
  if($('#nameNudge')){$('#nnSkip').onclick=()=>{localStorage.setItem('pc_name_nudge','1');renderCal();};$('#nnSave').onclick=async()=>{const n=$('#nnIn').value.trim();if(n)await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,firstName:n}})});localStorage.setItem('pc_name_nudge','1');await load();renderCal();};}
  {const g=main.querySelector('.grid');let sx=null,sy=0;if(g){g.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY;},{passive:true});g.addEventListener('touchend',e=>{if(sx===null)return;const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;sx=null;if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy))$(dx<0?'#next':'#prev').click();},{passive:true});}} // simple month swipe
  if(st.mode==='owner'){main.querySelectorAll('.d[data-d]').forEach(b=>b.onclick=()=>{const d=b.dataset.d;if(!Req.block(d,()=>sheet(d)))sheet(d);});$('#rqOpen').onclick=()=>{st.tab='requests';render();};}
  else{main.querySelectorAll('.d[data-d]').forEach(b=>b.onclick=()=>{const d=b.dataset.d;if(!Req.block(d,()=>Req.sheet(d)))Req.sheet(d);});Req.bindViewer();}}
// Wake-up alarm help per phone type: iPhone = Shortcut, Android = Clock app intent + manual steps, other = calendar alerts
const platDetect=()=>{const u=navigator.userAgent||'';return /iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'ios':/Android/i.test(u)?'android':'other';};
const plat=()=>localStorage.getItem('pc_platform')||platDetect();
const androidIntent=(t,msg)=>{const[h,m]=t.split(':').map(Number);return`intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${h};i.android.intent.extra.alarm.MINUTES=${m};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(msg||'Shift')};end`;};
function wakeCard(id,next,ics,dim){const p=plat(),web=ics.replace(/^https?/,'webcal');
  const tab=(k,l)=>`<button type="button" class="${p===k?"on":""}" data-plat="${k}" aria-pressed="${p===k}">${l}</button>`;
  const tech=(inner)=>`<details class="tech"><summary>Show technical details</summary>${inner}</details>`;
  const cal=`<ol class="steps"><li>Tap <b>Add to my calendar</b> below.</li><li>Your phone will alert you before each shift. Make sure calendar notifications are allowed.</li></ol><a class="btn" style="text-align:center;line-height:50px;text-decoration:none" href="${p==='ios'?web:ics}">Add to my calendar</a>${p==='android'?`<button type="button" class="btn sec copyBtn" data-copy="${ics}">Copy calendar link</button><small class="muted">In Google Calendar choose <b>Other calendars → From URL</b> and paste.</small>`:''}${tech(`<div class="url">${ics}</div>`)}`;
  const body=p==='ios'?`<ol class="steps"><li>Tap <b>Copy alarm link</b> below.</li><li>Open the <b>Shortcuts</b> app → <b>Automation</b> → <b>+</b> → <b>Time of Day</b> (e.g. 9 PM, daily, Run Immediately).</li><li>Add the steps listed under "Show technical details" and paste the link. Your alarm is then set each night for your next shift.</li></ol><button type="button" class="btn copyBtn" data-copy="${next}">Copy alarm link</button><small class="muted">Prefer something simpler? Choose <b>Other phone</b> to use calendar alerts.</small>
    ${tech(`<p class="muted">Shortcut steps: "Get contents of URL" (the link) → "Get Dictionary Value" <code>alarmsOff</code> → If it is true, stop. Otherwise "Get Dictionary Value" <code>alarmTime</code> → "Create Alarm" at that time.</p><div class="url">${next}</div>`)}`
   :p==='android'?`<p class="muted">Next alarm: <b class="wakeT">…</b></p><a class="btn wakeBtn" style="text-align:center;line-height:50px;text-decoration:none" href="#" hidden>Set alarm in Clock app</a>
    <p class="muted"><b>If the button does nothing:</b></p><ol class="steps"><li>Open the <b>Clock</b> app.</li><li>Tap <b>Alarm</b>, then <b>+</b>.</li><li>Set the time shown above and tap <b>Save</b>.</li></ol><p class="muted">For automatic alerts every shift, also add your calendar:</p>${cal}`
   :`<p class="muted">Get an alert before every shift through your calendar. Works on any phone.</p>${cal}`;
  return`<div class="card alarmUi${dim}" id="${id}"><h3>Wake-up alarm</h3><div class="seg" role="group" aria-label="Your phone">${tab('ios','iPhone')}${tab('android','Android')}${tab('other','Other phone')}</div>${body}</div>`;}
function wireWake(next,rerender){document.querySelectorAll('[data-plat]').forEach(b=>b.onclick=()=>{localStorage.setItem('pc_platform',b.dataset.plat);rerender();});
  document.querySelectorAll('.copyBtn').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>{b.textContent='Copied ✔';},()=>prompt('Copy this link',b.dataset.copy)));
  const t=document.querySelector('.wakeT');if(!t)return;fetch(next).then(r=>r.json()).then(n=>{if(!n.alarmTime){t.textContent='none (alarms are off or no upcoming shift)';return;}
   const d=n.start?new Date(n.start):null;t.textContent=n.alarmText||n.alarmTime;if(d&&!isNaN(d))t.textContent+=` for your ${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} shift`;
   const a=document.querySelector('.wakeBtn');a.href=androidIntent(n.alarmTime,'Shift');a.hidden=false;}).catch(()=>{t.textContent='could not load, check your connection';});}
// Shared-view devices: alarms are OFF by default; the viewer can opt in for this device only (never changes the owner's setting)
const holder=(pos)=>{const n=((st.s&&st.s.settings&&st.s.settings.firstName)||'').trim();return n?(pos?n+(n.endsWith('s')?'’':'’s'):n):(pos?'the schedule holder’s':'the schedule holder');};window.holder=holder;
const vKey=()=>'pc_viewer_alarms_'+st.viewId;const vOn=()=>localStorage.getItem(vKey())==='1';
function viewerAlarmCard(){const o=API||location.origin,v=st.viewId,on=vOn();const ics=`${o}/ics/${v}.ics?alarms=${on?1:0}`;
  return`<div class="card alarmMaster" id="vAlarmCard"><label class="chk offtoggle"><input type="checkbox" id="vAlarmOn" ${on?'checked':''}> <span><b>Alarms on this device ${on?'on':'off'}</b><br><small class="muted">Off by default on shared links. Turning this on only affects this phone, not ${esc(holder(true))} alarms.</small></span></label>${clockSeg('vClock')}
   <div class="alarmUi${on?'':' dim'}"><div class="url" id="vNext" hidden>${o}/api/s/${v}/next?viewer=1&alarms=${on?1:0}</div>
   <p class="muted">Calendar feed ${on?'with':'without'} alerts:</p><div class="url" id="vIcs">${ics}</div></div></div>`+wakeCard('vWake',`${o}/api/s/${v}/next?viewer=1&alarms=${on?1:0}`,ics,on?'':' dim');}
function renderList(){const days=Rot.range(st.s.rotation,st.s.crew,today(),60,st.s.overrides,st.s.settings).filter(d=>d.shift||d.kind==='vacation'||d.kind==='hol-off'||hol(d.date)).slice(0,25);
  main.innerHTML=nextBanner(days)+(st.mode==='view'?viewerAlarmCard():'')+`<div class="card"><h3>Upcoming</h3>${days.map(d=>{const t=Rot.times(st.s.rotation,d);const dt=new Date(Rot.parseD(d.date));
   return`<div class="row"><span class="pill ${d.kind==='work'?Rot.cls(d)+(d.start?' cus':''):d.kind}">${d.kind==='vacation'?'VAC':d.kind==='ot'?'OT '+d.shift:d.kind==='swap'?'SW '+d.shift:d.shift||'OFF'}</span><div><b>${dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}</b>${hol(d.date)?` <span class="hol inline">🎉 ${esc(hol(d.date).name)}</span>`:''}<br><small>${esc(Rot.dayLabel(d,st.s.settings))}${t?` · ${Rot.ft(t.start)} → ${Rot.ft(t.end)}`:''}${cnote(d)}</small></div></div>`;}).join('')}</div>`;
  if(st.mode==='view'){wireClock(renderList);wireWake(`${API||location.origin}/api/s/${st.viewId}/next?viewer=1&alarms=${vOn()?1:0}`,renderList);}if(st.mode==='view')$('#vAlarmOn').onchange=e=>{localStorage.setItem(vKey(),e.target.checked?'1':'0');renderList();};}
const hol=date=>window.Hol&&st.s?Hol.on(date,st.s.settings.holidays,st.s.settings.customHolidays):null;
const holNote=date=>{const h=hol(date);return h?`<br><span class="hol inline">🎉 ${esc(h.name)}</span>${h.observed?` <small>(observed ${new Date(Rot.parseD(h.observed)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})})</small>`:''}`:'';};
const cnote=d=>d.shift==='PM'&&Rot.nightNext(st.s.settings)?` · <span class="cnote">counts for ${new Date(Rot.parseD(Rot.countedDate(d,st.s.settings))).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}</span>`:'';
const TYPES={vacation:{t:'Vacation',i:'🌴',c:'vac'},ot:{t:'Overtime',i:'⏱',c:'ot'},swap:{t:'Swap',i:'🔁',c:'swp'},off:{t:'Off',i:'🛌',c:'sec'}};
function sheet(date){const d=Rot.day(st.s.rotation,st.s.crew,date,st.s.overrides,st.s.settings);const sb=$('#sheetbox');const has=!!st.s.overrides[date];
  const f={type:null,shift:null,hours:null,job:null};let step=1;const close=()=>{$('#sheet').hidden=true;};
  const title=new Date(Rot.parseD(date)).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
  const save=async o=>{await api(`/api/schedules/${st.id}/overrides/${date}`,{method:'PUT',body:JSON.stringify(o)});await load();close();render();};
  const choice=(val,label,cls='',sub='')=>`<button class="choice ${cls}" data-v="${esc(val)}"><span>${label}</span>${sub?`<small>${esc(sub)}</small>`:''}</button>`;
  function draw(){const crumbs=[f.type&&TYPES[f.type].t,f.shift,f.hours&&f.hours+'h'].filter(Boolean).join(' · ');let body='';
    if(step===1)body=`<p class="q">What's happening this day?</p><div class="choices">${Object.entries(TYPES).map(([k,v])=>choice(k,`${v.i} ${v.t}`,v.c)).join('')}${has?choice('clear','✖ Clear','clr','Back to '+(d.base||'Off')):''}</div>`;
    if(step===2)body=`<p class="q">Which shift?</p><div class="choices two">${choice('AM','AM','am',st.s.rotation.shiftTimes.AM.join('–'))}${choice('PM','PM','pm',st.s.rotation.shiftTimes.PM.join('–'))}</div>`;
    if(step===3)body=`<p class="q">How many hours?</p><div class="choices three">${[8,12,16].map(h=>choice(h,h+'h','hrs')).join('')}</div>`;
    if(step===4)body=`<p class="q">Which job?</p><div class="choices">${Rot.jobOptions(st.s.settings).map((j,i)=>choice(j.id,esc(j.label),'job',i===0?'My job':'')).join('')}</div>`;
    sb.innerHTML=`<div class="shead">${step>1?'<button class="back" id="back" aria-label="Back">‹ Back</button>':'<span></span>'}<span class="stepn">Step ${step} of ${f.type&&f.type!=='vacation'&&f.type!=='off'?4:1}</span><button class="x" id="cls" aria-label="Close">✕</button></div>
      <h3>${title}</h3><p class="muted">Scheduled: <b>${d.base?(()=>{const t=Rot.times(st.s.rotation,{...d,shift:d.base,kind:'work'});return d.base+' '+Rot.ft(t.start)+'–'+Rot.ft(t.end);})():'Off'}</b>${has?` · now: <b>${esc(Rot.dayLabel(d,st.s.settings))}</b>`:''}${d.shift==='PM'?`<br><small>${cnote(d).replace(/^ · /,'')}</small>`:''}${holNote(date)}${crumbs?`<br>Picked: <b>${esc(crumbs)}</b>`:''}</p>${body}`;
    $('#cls').onclick=close;if($('#back'))$('#back').onclick=()=>{step--;draw();};
    sb.querySelectorAll('.choice').forEach(b=>b.onclick=async()=>{const v=b.dataset.v;
      if(step===1){if(v==='clear'){await clearSwapPair(date);await api(`/api/schedules/${st.id}/overrides/${date}`,{method:'DELETE'});await load();close();render();return;}
        if(v==='vacation'||v==='off')return save({type:v});f.type=v;if(v==='swap'){step=9;return drawSwap();}step=2;}
      else if(step===2){f.shift=v;step=3;}else if(step===3){f.hours=+v;step=4;}
      else{f.job=v;return save({type:f.type,shift:f.shift,hours:f.hours,job:f.job});}
      draw();});}
  // "Swap for": work day -> pick the day you'll work instead (this day becomes OFF); off day -> pick the work day you give up (this day becomes WORKING)
  function drawSwap(){const work=!!(d.base&&d.kind!=='vacation');const R=x=>Rot.day(st.s.rotation,st.s.crew,x,st.s.overrides,st.s.settings);
    let def=date;for(let i=1;i<60;i++){const x=Rot.fmt(Rot.parseD(date)+i*Rot.DAY),y=R(x);if(work?!y.base&&!st.s.overrides[x]:(y.base&&!st.s.overrides[x])){def=x;break;}}
    const sh0=work?d.base:(R(def).base||'AM');let warned=null;
    const ttl=k=>{const t=Rot.times(st.s.rotation,{...d,shift:k,kind:'work',start:null});return Rot.ft(t.start)+'–'+Rot.ft(t.end);};
    sb.innerHTML=`<div class="shead"><button class="back" id="back" aria-label="Back">‹ Back</button><span class="stepn">Swap for</span><button class="x" id="cls" aria-label="Close">✕</button></div>
     <h3>${title}</h3><p class="muted">Scheduled: <b>${esc(Rot.dayLabel(d,st.s.settings))}</b></p>
     <p class="q">${work?'Which day will you work instead?':'Which work day are you giving up?'}</p>
     <label for="swDate">${work?'Day you work instead':'Day you give up'}</label><input type="date" id="swDate" value="${def}">
     ${work?`<label>Shift on that day</label><div class="seg two-seg" id="swShift">${['AM','PM'].map(k=>`<button type="button" data-sws="${k}" class="${k===sh0?'on':''}">${k==='AM'?'Day':'Night'} ${k} · ${ttl(k)}</button>`).join('')}</div>`:''}
     <p class="muted" id="swInfo"></p><p class="warnmsg" id="swWarn" role="alert" hidden></p><button class="btn swp" id="swSave">Save swap</button>`;
    let sh=sh0;const info=()=>{const x=$('#swDate').value;const y=x&&R(x);$('#swInfo').textContent=y?`${new Date(Rot.parseD(x)).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}: now ${Rot.dayLabel(y,st.s.settings)}`:'';$('#swWarn').hidden=true;warned=null;};
    info();$('#swDate').oninput=info;$('#cls').onclick=close;$('#back').onclick=()=>{step=1;draw();};
    sb.querySelectorAll('[data-sws]').forEach(b=>b.onclick=()=>{sh=b.dataset.sws;sb.querySelectorAll('[data-sws]').forEach(x=>x.classList.toggle('on',x===b));});
    $('#swSave').onclick=async()=>{const x=$('#swDate').value;const w=$('#swWarn');if(!/^\d{4}-\d\d-\d\d$/.test(x)||x===date){w.hidden=false;w.textContent='Pick a different day.';return;}
      const y=R(x);const bad=work?(y.shift?`${x} is already a work day (${Rot.dayLabel(y,st.s.settings)}).`:''):(!y.shift?`${x} is not a work day.`:'');
      if(st.s.overrides[x]&&warned!==x+'o'){w.hidden=false;w.textContent=`That day already has a change (${Rot.dayLabel(y,st.s.settings)}). Tap Save swap again to replace it.`;warned=x+'o';return;}
      if(bad&&warned!==x&&warned!==x+'o'){w.hidden=false;w.textContent=bad+' Tap Save swap again to swap anyway.';warned=x;return;}
      $('#swSave').disabled=true;await clearSwapPair(date);await clearSwapPair(x);
      const P=(k,o)=>api(`/api/schedules/${st.id}/overrides/${k}`,{method:'PUT',body:JSON.stringify(o)});
      if(work){await P(x,{type:'swap',shift:sh,hours:d.hours||12,job:'@main',swapFrom:date});await P(date,{type:'off',swapTo:x});}
      else{await P(date,{type:'swap',shift:y.shift||'AM',hours:y.hours||12,job:'@main',swapFrom:x});await P(x,{type:'off',swapTo:date});}
      await load();close();render();};}
  draw();$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};}
// undoing a swap on either day removes the partner day's half too
async function clearSwapPair(date){const o=st.s.overrides[date];const p=o&&(o.swapTo||o.swapFrom);if(!p)return;const q=st.s.overrides[p];
  if(q&&(q.swapTo===date||q.swapFrom===date))await api(`/api/schedules/${st.id}/overrides/${p}`,{method:'DELETE'});}
// Reusable job editor: title + add/remove list of OT positions
function jobsEditor(S){return`<label>My current job title</label><input type="text" id="jobTitle" value="${esc(S.jobTitle)}" maxlength="40" placeholder="Type your position">
  <label>Positions I might work OT in</label><div id="jobList">${S.jobs.map(j=>jobRow(j)).join('')}</div>
  <div class="addrow"><input type="text" id="newJob" maxlength="40" placeholder="Add a position"><button class="addbtn" id="addJob" aria-label="Add position">＋ Add</button></div>`;}
const jobRow=j=>`<div class="jobrow"><span>${esc(j)}</span><button class="rm" aria-label="Remove ${esc(j)}">✕</button></div>`;
function wireJobs(){const list=$('#jobList');const bind=()=>list.querySelectorAll('.rm').forEach(b=>b.onclick=()=>{b.parentElement.remove();});
  const add=()=>{const v=$('#newJob').value.trim();if(!v)return;list.insertAdjacentHTML('beforeend',jobRow(v));$('#newJob').value='';bind();};
  $('#addJob').onclick=add;$('#newJob').onkeydown=e=>{if(e.key==='Enter')add();};bind();}
const readJobs=()=>({jobTitle:$('#jobTitle').value.trim(),shiftHours:st.s&&st.s.settings&&st.s.settings.shiftHours,shiftStarts:st.s&&st.s.settings&&st.s.settings.shiftStarts,customCrews:st.s&&st.s.settings&&st.s.settings.customCrews,jobs:[...document.querySelectorAll('#jobList .jobrow span')].map(x=>x.textContent),nightCounts:(st.s&&st.s.settings&&st.s.settings.nightCounts)||'next',holidays:(st.s&&st.s.settings&&st.s.settings.holidays)||[],customHolidays:(st.s&&st.s.settings&&st.s.settings.customHolidays)||[],holidaysOff:!!(st.s&&st.s.settings&&st.s.settings.holidaysOff),holidaysWork:(st.s&&st.s.settings&&st.s.settings.holidaysWork)||[]});
function renderJobs(){return`<div class="card"><h3>My job</h3>${jobsEditor(st.s.settings)}<button class="btn" id="saveJobs">Save jobs</button><small id="jobMsg"></small></div>`;}
function renderOnboarding(){return Onboard.render();}
const alarmsOn=()=>!(st.s.alarm&&st.s.alarm.on===false);
const alarmCard=()=>`<div class="card alarmMaster" id="alarmCard"><label class="chk offtoggle"><input type="checkbox" class="alarmOn" ${alarmsOn()?'checked':''}> <span><b>Alarms ${alarmsOn()?'on':'off'}</b><br><small class="muted">${alarmsOn()?`Wake-up alarm, night-before reminders and calendar alerts (${st.s.alarm.leadMin} min before) are on.`:'Paused: no wake-up alarm, no reminders, calendar events without alerts. Your lead time is kept for when you turn them back on.'}</small></span></label></div>`;
const wireAlarm=()=>document.querySelectorAll('.alarmOn').forEach(x=>x.onchange=async()=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({alarm:{on:x.checked}})});await load();render();});
function renderShare(){const o=API||location.origin,v=st.s.viewId,lead=st.s.alarm.leadMin;const dim=alarmsOn()?'':' dim';
  const ics=`${o}/ics/${v}.ics`,web=ics.replace(/^https?/,'webcal');const pt=st.s.push.times;
  main.innerHTML=alarmCard()+`<div class="card"><h3>Spouse / family link</h3><p class="muted">Read-only. Updates live when you change a day.</p><div class="url" id="vl">${APP}/v/${v}</div>
   <button class="btn" id="shareBtn">Share link</button></div>
  <div class="card"><h3>Calendar feed</h3><p class="muted">Add your shifts to Apple or Google Calendar. Includes an alert before each shift; vacation days get none, OT days get one.</p>
   <div class="alarmUi${dim}"><label>Alert before shift (minutes)</label><input type="number" id="lead" value="${lead}" min="0" step="15"></div>
   <a class="btn" style="text-align:center;line-height:50px;text-decoration:none" href="${plat()==='ios'?web:ics}">Subscribe on this phone</a><button type="button" class="btn sec copyBtn" data-copy="${ics}">Copy calendar link</button>
   <small class="muted">For Google Calendar: copy the link, then <b>Other calendars → From URL</b> and paste.</small><details class="tech"><summary>Show technical details</summary><div class="url">${ics}</div></details></div>
  <div class="card alarmUi${dim}" id="remCard"><h3>Night-before reminder</h3><p class="muted">Get a reminder the evening before you work.</p>${plat()==='ios'&&!(matchMedia('(display-mode: standalone)').matches||navigator.standalone)?'<p class="muted hshint" id="remHint">On iPhone, <b>Add to Home Screen</b> first (Share ⬆︎ → Add to Home Screen), then open it from there.</p>':''}
   <div class="two"><div><label>Before AM shift</label><input type="time" id="pAM" value="${pt.AM}"></div><div><label>Before PM shift</label><input type="time" id="pPM" value="${pt.PM}"></div></div>
   <button class="btn" id="pushBtn">Turn on reminders</button><small id="pushMsg">${st.s.push.count?st.s.push.count+' device(s) subscribed':''}</small></div>
  `+wakeCard('scCard',`${o}/api/s/${v}/next`,ics,dim);
  $('#shareBtn').onclick=()=>navigator.share?navigator.share({title:'My shift schedule',url:`${APP}/v/${v}`}):navigator.clipboard.writeText(`${APP}/v/${v}`).then(()=>alert('Link copied'));
  $('#lead').onchange=async e=>{st.s=await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({alarm:{leadMin:+e.target.value}})});await load();};
  for(const k of['AM','PM'])$('#p'+k).onchange=async e=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({pushTimes:{[k]:e.target.value}})});await load();};
  $('#pushBtn').onclick=enablePush;wireAlarm();wireWake(`${o}/api/s/${v}/next`,renderShare);}
async function enablePush(){const msg=$('#pushMsg');try{
  if(!('PushManager'in window))throw new Error('Push not available here. On iPhone, install to Home Screen first.');
  const{publicKey}=await api('/api/vapid');if(!publicKey)throw new Error('Server has no push keys');
  if(await Notification.requestPermission()!=='granted')throw new Error('Notifications blocked');
  const reg=await navigator.serviceWorker.ready;const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-publicKey.length%4)%4)),c=>c.charCodeAt(0));
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api(`/api/schedules/${st.id}/push?test=1`,{method:'POST',body:JSON.stringify(sub)});msg.textContent='Reminders on ✔';}catch(e){msg.textContent=e.message;}}
const holRow=h=>{const y=+today().slice(0,4);const d=h.f(y);const on=(st.s.settings.holidays||[]).includes(h.id);return`<label class="holrow"><input type="checkbox" data-hol="${h.id}" ${on?'checked':''}><span>${esc(h.name)}</span><small>${new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}</small></label>${on&&st.s.settings.holidaysOff?workRow(h.id):''}`;};
const workRow=k=>`<label class="holwork"><input type="checkbox" data-holwork="${k}" ${(st.s.settings.holidaysWork||[]).includes(k)?'checked':''}> I work this one (keep my shift)</label>`;
function savedCard(){const sv=st.s.saved||[];if(!sv.length)return'';const act=st.s.activeSid;
  return`<div class="card" id="savedCard"><h3>My saved schedules</h3><p class="muted">Every schedule you import or build is kept. Switch any time from the menu at the top; switching never deletes anything.</p>
   <div class="savedlist">${sv.map(e=>`<div class="savedrow ${act===e.sid?'on':''}" data-sid="${e.sid}"><div><b>${esc(e.name)}</b>${act===e.sid?' <span class="pill AM">active</span>':''}<br><small class="muted">${e.rotation?e.rotation.cycleLength+'-day cycle · '+Rot.crewList(e.rotation).length+' option(s)':''}${Object.keys(e.overrides||{}).length?' · '+Object.keys(e.overrides).length+' day edit(s)':''}</small></div>
    <div class="savedbtns">${act===e.sid?'':`<button class="btn sec small" data-use="${e.sid}">Use</button>`}<button class="btn sec small" data-ren="${e.sid}">Rename</button><button class="btn sec small danger" data-del="${e.sid}">Delete</button></div></div>`).join('')}</div>
   ${act?`<button class="btn sec" id="usePlant">Back to the plant rotation</button>`:''}<small id="savedMsg"></small></div>`;}
function wireSaved(){const P=async b=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify(b)});await load();render();};
  document.querySelectorAll('[data-use]').forEach(x=>x.onclick=()=>P({activate:x.dataset.use}));if($('#usePlant'))$('#usePlant').onclick=()=>P({activate:'plant'});
  document.querySelectorAll('[data-ren]').forEach(x=>x.onclick=()=>{const e=st.s.saved.find(y=>y.sid===x.dataset.ren);const n=prompt('New name for this schedule',e.name);if(n&&n.trim())P({renameSaved:{sid:e.sid,name:n.trim()}});});
  document.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{const e=st.s.saved.find(y=>y.sid===x.dataset.del);if(confirm(`Delete “${e.name}”? Its day edits (OT, swaps, vacation) are deleted too. Other schedules are not affected.`))P({deleteSaved:e.sid});});}
function renderSetup(){const t=st.template;const r=st.s.rotation;
  const cur=Rot.cycleName(r,st.s.crew);
  main.innerHTML=`<div class="card" id="nameCard"><h3>Your first name</h3><p class="muted">Optional. People with your family link see it, e.g. “${esc(((st.s.settings.firstName||'').trim()||'Luciano'))}’s schedule”.</p><div class="addrow"><input type="text" id="fnIn" maxlength="30" autocomplete="given-name" placeholder="e.g. Luciano" value="${esc(st.s.settings.firstName||'')}"><button class="addbtn" id="fnSave">Save</button></div><small id="fnMsg" class="muted"></small></div>`+Beta.setupCards()+Req.ownerNotifyCard()+alarmCard()+renderJobs()+`<div class="card" id="themeCard"><h3>Theme</h3><p class="muted">Saved on this phone. Auto follows your phone's light/dark setting.</p>
   <div class="seg" role="group" aria-label="Theme">${['auto','light','dark'].map(k=>`<button data-theme-opt="${k}">${Theme.ICON[k]} ${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div></div><div class="card" id="holCard"><h3>Holidays</h3><p class="muted">Labels only: shifts don't change. Pick the ones your contract pays. Dates are the actual holiday; the observed day off can differ (e.g. July 4 on a Saturday is observed Friday).</p>
   <label class="chk offtoggle"><input type="checkbox" id="holOff" ${st.s.settings.holidaysOff?'checked':''}> <span><b>My job gives holidays off</b><br><small class="muted">When on, a scheduled shift on a selected holiday (its observed day) becomes Off. OT or a swap you add on that day still counts.</small></span></label>
   <div class="two"><button class="btn sec" id="holAll">Select all</button><button class="btn sec" id="holNone">None</button></div>
   <div class="hollist" id="holFed">${Hol.LIST.filter(h=>h.fed).map(h=>holRow(h)).join('')}</div><h4>Common contract extras</h4><div class="hollist">${Hol.LIST.filter(h=>!h.fed).map(h=>holRow(h)).join('')}</div>${(st.s.settings.customHolidays||[]).length?`<h4>Contract dates</h4><div class="hollist">${st.s.settings.customHolidays.map(c=>`<div class="holrow"><span>${esc(c.n)}</span><small>${new Date(Rot.parseD(c.d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</small></div>${st.s.settings.holidaysOff?workRow('c:'+c.d):''}`).join('')}</div>`:''}<button class="btn sec" id="holYear">📅 Holidays from my contract (tap dates)</button><small id="holMsg"></small></div>
  <div class="card" id="shiftCard"><h3>My shifts</h3><label>Standard shift length</label><div class="seg" id="sLen">${[8,12,16].map(x=>`<button data-h="${x}" class="${(+st.s.settings.shiftHours||12)===x?'on':''}">${x} h</button>`).join('')}</div>
   <label for="sHrs">Hours per shift (custom)</label><input type="number" id="sHrs" min="1" max="24" step="0.5" value="${+st.s.settings.shiftHours||12}">
   <div class="two"><div><label for="sAm">AM starts</label><input type="time" id="sAm" value="${(st.s.settings.shiftStarts||{}).AM||r.shiftTimes.AM[0]}"></div><div><label for="sPm">PM starts</label><input type="time" id="sPm" value="${(st.s.settings.shiftStarts||{}).PM||r.shiftTimes.PM[0]}"></div></div>${clockSeg('sClock')}
   <label for="sCrews">My crew names (comma-separated, if your workplace doesn't use A–D)</label><input type="text" id="sCrews" value="${esc((st.s.settings.customCrews||[]).join(', '))}">
   <button class="btn" id="sSave">Save shifts</button><small id="sMsg"></small></div><div class="card" id="nightCard"><h3>Night shifts</h3><p class="muted">Which day does a PM (night) shift count toward? Alarms and calendar entries still use the real start time.</p>
   <div class="seg two-seg" role="group" aria-label="Night shift counts toward">${[['start','The day it starts'],['next','The next day']].map(([k,l])=>`<button data-nc="${k}" class="${(st.s.settings.nightCounts||'next')===k?'on':''}">${l}</button>`).join('')}</div></div><div class="card" id="colorCard"><h3>Shift colors</h3>${Colors.panel()}</div><div class="card" id="curCard"><h3>My schedule type</h3><p class="muted">Now using: <b id="curName">${esc(cur)}</b>${r.custom?` · ${r.cycleLength}-day cycle from ${r.cycleStart}`:''}</p>
   ${r.custom?`<label for="renameIn">Name</label><input type="text" id="renameIn" maxlength="60" value="${esc(r.label)}"><button class="btn sec" id="renameBtn">Rename</button><small id="renameMsg"></small>`:''}</div>
  <div class="card" id="impEntry"><h3>Set up a schedule</h3><p class="muted">Any format: Punch Card detects crews, shift types and times, and the cycle from your file, or you build it (templates optional). You check a preview before it's saved.</p><button class="btn" id="dzOpenDetect">🔎 Upload &amp; detect (CSV, text, PDF, photo)</button><button class="btn sec" id="dzOpenBuild">🧩 Build: templates or custom</button><h4>Printed rotation calendar (AM/PM grid)</h4>
   <button class="btn" id="impScreens">📸 From screenshots / photos <span class="rec">Recommended</span></button><small class="muted">Screenshots work best: straight, zoomed in, with the date row and crew letters showing.</small>
   <button class="btn sec" id="impPdfBtn">📄 From a PDF</button><button class="btn sec" id="impOwn">✏️ Build my own</button></div>
  ${savedCard()}<div class="card"><h3>Calendar pattern builder</h3><p class="muted">None of these fit? Tap each day of one full cycle on a calendar. Punch Card repeats it forward.</p>
   <button class="btn" id="openBuilder">Open calendar builder</button><button class="btn sec" id="editCur">Edit my current pattern in the builder</button></div>
  <details class="card" id="presetBox" ${Rot.crewList(Rot.rotationFromTemplate(t)).includes(st.s.plantCrew)||(!st.s.activeSid&&!r.custom&&!r.blank)?'open':''}><summary><b>Saved preset: plant rotation</b> <small class="muted">(optional)</small></summary><p class="muted">${esc(t.note)}</p>
   <label>Variant</label><select id="var">${Object.keys(t.variants).map(v=>`<option value="${v}" ${r.variant===v?'selected':''}>${v}${v===t.defaultVariant?' (default)':''}</option>`).join('')}</select>
   <button class="btn" id="useT">Use plant rotation</button></details>
  <div class="card"><h3>Import a rotation</h3><p class="muted">CSV (date,A,B,C,D with AM/PM/blank), PDF (text-based), or extracted block text.</p>
   <input type="file" id="file" accept=".pdf,.csv,.txt,image/*"><button class="btn sec" id="imp">Import file</button><small id="impMsg"></small></div>
  ${FEATURES.customPatterns?`  <div class="card"><h3>N on / N off</h3><label>Day 1 of work</label><input type="date" id="oStart" value="${today()}">
   <div class="two"><div><label>Days on</label><input type="number" id="oOn" placeholder="e.g. 5" min="1"></div><div><label>Days off</label><input type="number" id="oOff" placeholder="e.g. 2" min="1"></div></div>
   <label>Shift</label><select id="oShift"><option>AM</option><option>PM</option></select><button class="btn" id="oBuild">Use N on / N off</button></div>
  <div class="card"><h3>Text pattern builder</h3><p class="muted">Advanced: type sequences per crew.</p><label>Cycle start date</label><input type="date" id="bStart" value="${r.cycleStart}">
   <p class="muted">One line per crew: <code>A: AM AM PM PM OFF OFF</code>. Cycle length = number of entries.</p>
   <textarea id="bSeq" rows="5">A: AM AM PM PM OFF OFF OFF OFF\nB: OFF OFF AM AM PM PM OFF OFF\nC: OFF OFF OFF OFF AM AM PM PM\nD: PM PM OFF OFF OFF OFF AM AM</textarea>
   <div class="two"><div><label>AM start</label><input type="time" id="amS" value="${r.shiftTimes.AM[0]}"></div><div><label>PM start</label><input type="time" id="pmS" value="${r.shiftTimes.PM[0]}"></div></div>
   <button class="btn" id="build">Use this pattern</button></div>`:''}`;
  const use=async rot=>{const crews=Rot.crewListRaw(rot);await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({rotation:rot,crew:crews.includes(st.s.crew)?st.s.crew:crews[0]})});await load();st.tab='cal';render();};
  wireAlarm();wireSaved();wireJobs();$('#saveJobs').onclick=async()=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:readJobs()})});await load();$('#jobMsg').textContent='Saved ✔';};
  Colors.wire(main);wireClock();
  main.querySelectorAll('#sLen button').forEach(b=>b.onclick=()=>{$('#sHrs').value=b.dataset.h;main.querySelectorAll('#sLen button').forEach(x=>x.classList.toggle('on',x===b));});
  Beta.bindSetup();Req.bindOwnerSetup();
  $('#fnSave').onclick=async()=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,firstName:$('#fnIn').value.trim()}})});await load();renderSetup();$('#fnMsg').textContent='Saved ✔';};
  $('#sSave').onclick=async()=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,shiftHours:+$('#sHrs').value,shiftStarts:{AM:$('#sAm').value,PM:$('#sPm').value},customCrews:$('#sCrews').value.split(',')}})});await load();renderSetup();$('#sMsg').textContent='Saved ✔';};
  const saveHol=async ids=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,holidays:ids}})});await load();renderSetup();$('#holMsg').textContent='Saved ✔';};
  main.querySelectorAll('[data-hol]').forEach(x=>x.onchange=()=>saveHol([...main.querySelectorAll('[data-hol]:checked')].map(e=>e.dataset.hol)));
  const saveSet=async patch=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,...patch}})});await load();renderSetup();$('#holMsg').textContent='Saved ✔';};
  $('#holOff').onchange=e=>saveSet({holidaysOff:e.target.checked});
  main.querySelectorAll('[data-holwork]').forEach(x=>x.onchange=()=>saveSet({holidaysWork:[...main.querySelectorAll('[data-holwork]:checked')].map(e=>e.dataset.holwork)}));
  $('#holAll').onclick=()=>saveHol(Hol.LIST.filter(h=>h.fed).map(h=>h.id).concat((st.s.settings.holidays||[]).filter(i=>!Hol.LIST.find(h=>h.id===i).fed)));$('#holNone').onclick=()=>saveHol([]);
  main.querySelectorAll('[data-nc]').forEach(x=>x.onclick=async()=>{await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,nightCounts:x.dataset.nc}})});await load();renderSetup();});
  main.querySelectorAll('[data-theme-opt]').forEach(b=>b.onclick=()=>Theme.set(b.dataset.themeOpt));Theme.apply();
  $('#openBuilder').onclick=()=>Builder.open();$('#impScreens').onclick=$('#impPdfBtn').onclick=()=>Import.open();$('#impOwn').onclick=()=>Builder.open();$('#dzOpenDetect').onclick=()=>Design.open('detect');$('#dzOpenBuild').onclick=()=>Design.open('build');$('#holYear').onclick=()=>HolYear.open();$('#editCur').onclick=()=>Builder.open(Rot.cycleOf(r,st.s.crew),r.custom&&!r.imported?r.label:'',r.custom&&!r.imported?st.s.activeSid:null);
  if($('#renameBtn'))$('#renameBtn').onclick=async()=>{$('#renameMsg').textContent='';const n=$('#renameIn').value.trim()||Rot.defaultName(r.cycleLength);await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({rotation:{...r,name:n,label:n,sid:st.s.activeSid}})});await load();renderSetup();$('#renameMsg').textContent='Saved ✔';};
  $('#useT').onclick=()=>use(Rot.rotationFromTemplate(t,$('#var').value));
  $('#imp').onclick=async()=>{const f=$('#file').files[0];if(!f)return;const ty=/pdf/.test(f.type)?'pdf':/csv/.test(f.name)?'csv':/image/.test(f.type)?'image':'text';
    try{const rot=await fetch(API+'/api/import?type='+ty,{method:'POST',body:f}).then(async x=>{const j=await x.json();if(!x.ok)throw new Error(j.error);return j;});
      $('#impMsg').textContent=`Found ${Object.keys(rot.crews).length} crews, ${rot.cycleLength}-day cycle.`;await use(rot);}catch(e){$('#impMsg').textContent=e.message;}};
  if(FEATURES.customPatterns){$('#oBuild').onclick=()=>use(Rot.onOff($('#oStart').value,+$('#oOn').value,+$('#oOff').value,$('#oShift').value,r.shiftTimes));
  $('#build').onclick=()=>{const seqs={};$('#bSeq').value.split('\n').forEach(l=>{const m=l.match(/^\s*([\w]+)\s*:(.*)$/);if(m)seqs[m[1]]=m[2];});
    const am=$('#amS').value,pm=$('#pmS').value;use(Rot.fromBuilder($('#bStart').value,seqs,{AM:[am,pm],PM:[pm,am]}));};}}
boot().catch(e=>{console.error(e);friendly('Couldn\'t load your schedule','Check your connection and reopen Punch Card. Your setup is saved on this phone.');});

// One-time "share your schedule" reminder (flag: FEATURES.shareReminder, off until approved). Main users only; once per device.
function shareReminder(force){try{if(!force&&(!FEATURES.shareReminder||st.mode!=='owner'||localStorage.getItem('pc_share_rem')||!$('#sheet').hidden))return;}catch(e){return;}
  const sb=$('#sheetbox');const n=((st.s.settings.firstName||'').trim());const me=n||'the worker';
  const done=v=>{try{localStorage.setItem('pc_share_rem',v);}catch(e){}$('#sheet').hidden=true;};
  const link=async()=>{if(!st.s.viewId)await load();return `${APP}/v/${st.s.viewId}`;};
  const msg=`Here’s ${n?'my':'the'} work schedule. It updates on its own: `;
  sb.innerHTML=`<div class="shead"><span></span><span class="stepn">New</span><button class="x" id="cls" aria-label="Close">✕</button></div>
   <h3>Share your schedule with family</h3>
   <div class="blkbox pto"><b>${n?esc(n)+', keep':'Keep'} everyone in the loop</b><p>Send your family a link to ${n?esc(n)+'’s':'your'} schedule. They can see the days ${esc(me)} works, get a heads-up the night before, and ask for a day off together, all from their own phone. Any change you make shows up for them right away.</p></div>
   <button class="btn" id="srShare">📤 Share my link</button>
   <div class="two"><a class="btn sec" id="srText" href="#">💬 Text</a><a class="btn sec" id="srMail" href="#">✉️ Email</a></div>
   <button class="btn sec" id="srCopy">🔗 Copy link</button>
   <p class="muted" id="srMsg" role="status"></p>
   <details class="muted"><summary>Show details</summary><p>The link is view-only. People with it can’t change your work days. You can find it any time under the Share tab.</p><p><small id="srLink"></small></p></details>
   <div class="two"><button class="btn sec" id="srLater">Maybe later</button><button class="btn sec" id="srNever">Don’t show again</button></div>`;
  $('#sheet').hidden=false;
  $('#cls').onclick=$('#srLater').onclick=()=>done('later');$('#srNever').onclick=()=>done('never');
  link().then(u=>{$('#srLink').textContent=u;$('#srText').href=`sms:?&body=${encodeURIComponent(msg+u)}`;$('#srMail').href=`mailto:?subject=${encodeURIComponent('My work schedule')}&body=${encodeURIComponent(msg+u)}`;}).catch(()=>{});
  $('#srShare').onclick=async()=>{const u=await link();if(navigator.share){try{await navigator.share({title:'My work schedule',text:msg,url:u});done('shared');}catch(e){}}else $('#srCopy').click();};
  $('#srCopy').onclick=async()=>{const u=await link();navigator.clipboard.writeText(u).then(()=>{$('#srCopy').textContent='Copied ✔';$('#srMsg').textContent='Link copied. Paste it in a text or email.';},()=>prompt('Copy this link',u));};}
window.shareReminder=shareReminder;

// Partners: two main users link with a short code / invite link, see each other's schedule, and send each other requests
// (swap, no overtime, day off together). Either can approve or deny. Optional "Show all schedules" combined calendar.
const Partner=(()=>{
const P={linked:false,showAll:false,code:null,me:'',partner:null,items:[]};let busy=false;const popped=new Set();
const YOU='#E2560A',THEM='#3550D6';
const pn=()=>(P.partner&&P.partner.name)||'the worker';const PN=()=>{const n=pn();return n==='the worker'?'Your partner':n;};
const dl=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const TL={swap:'🔁 Swap',noot:'⛔ No overtime',together:'🏠 Day off together',pto:'🏠 Day off together'};
const SL={pending:'Waiting',approved:'Approved',declined:'Denied',cancelled:'Cancelled'};
const papi=(p='',o={})=>api('/api/schedules/'+st.id+'/partner'+p,o);
const view=()=>{if(!P.linked)return'me';const v=localStorage.getItem('pc_pview')||(P.showAll?'all':'me');return v==='all'&&!P.showAll?'me':v;};
const setView=v=>{localStorage.setItem('pc_pview',v);};
async function load(){if(st.mode!=='owner'||!st.id)return;try{Object.assign(P,await papi());}catch(e){}}
const R=(s,d)=>Rot.day(s.rotation,s.crew,d,s.overrides,s.settings);
const works=d=>!!d.shift&&d.kind!=='vacation'&&d.kind!=='hol-off';
const lab=d=>d.kind==='vacation'?'VAC':d.kind==='hol-off'||d.kind==='off-ovr'?'OFF':d.shift||'Off';
const pendIn=()=>P.items.filter(r=>r.incoming&&r.status==='pending');
function switcher(){if(!P.linked)return'';const v=view(),n=pendIn().length;
  return`<div class="seg ${P.showAll?'':'two-seg'} ptsw" id="ptSw" role="group" aria-label="Whose schedule"><button type="button" data-pv="me" class="${v==='me'?'on':''}">My schedule</button><button type="button" data-pv="p" class="${v==='p'?'on':''}">${esc(PN())}</button>${P.showAll?`<button type="button" data-pv="all" class="${v==='all'?'on':''}">Both</button>`:''}</div>
  ${n?`<button class="btn sec rqbar" id="ptIn">📨 ${esc(PN())} asked you <span class="badge">${n}</span></button>`:''}`;}
function bindSwitch(){document.querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>{setView(b.dataset.pv);render();});if($('#ptIn'))$('#ptIn').onclick=()=>incoming(pendIn()[0]);}
// calendar for partner / both. Returns false when the normal calendar should draw.
function renderCal(){const v=view();if(v==='me')return false;const p=P.partner;const [y,m]=st.month;const first=Date.UTC(y,m,1),n=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  const lead=new Date(first).getUTCDay();const t=today();const ps=Rot.range(p.rotation,p.crew,Rot.fmt(first),n,p.overrides,p.settings);
  const ms=v==='all'?Rot.range(st.s.rotation,st.s.crew,Rot.fmt(first),n,st.s.overrides,st.s.settings):null;
  const pa=d=>(p.approved||[]).filter(r=>d>=r.from&&d<=(r.to||r.from));const pend=d=>P.items.some(r=>r.status==='pending'&&!r.incoming&&(r.from===d||r.swapWith===d));
  const cell=(d,i)=>{const a=pa(d.date);const mk=(a.some(r=>r.type==='pto')?'<span class="rqa pto">Off</span>':a.some(r=>r.type==='noot')?'<span class="rqa noot">no OT</span>':'')+(pend(d.date)?'<span class="rqdot" aria-label="request pending"></span>':'');
    if(v==='p')return`<button class="d ${Rot.cls(d)} ${d.kind} ${d.date===t?'today':''}" data-d="${d.date}"><span class="n">${+d.date.slice(8)}</span><span class="s">${esc(lab(d))}</span>${d.swapTo||d.swapFrom?'<span class="swx">⇄</span>':''}${mk}</button>`;
    const me=works(ms[i]),th=works(d);const bg=me&&th?`linear-gradient(135deg,${YOU} 50%,${THEM} 50%)`:me?YOU:th?THEM:'';
    return`<button class="d both ${d.date===t?'today':''}" data-d="${d.date}" style="${bg?`background:${bg};color:#fff`:''}"><span class="n">${+d.date.slice(8)}</span><span class="s">${me&&th?'Both':me?'You':th?esc(PN()):'Off'}</span>${mk}</button>`;};
  const sw=c=>`<i style="background:${c}"></i>`;
  main.innerHTML=switcher()+`<div class="card"><div class="mhead"><button class="nav" id="prev" aria-label="Previous month">‹</button><h2>${MON[m]} ${y}</h2><button class="nav" id="next" aria-label="Next month">›</button></div>
   <div class="grid">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(lead)}${ps.map(cell).join('')}</div>
   <div class="legend" id="ptLegend">${v==='all'?`<span>${sw(YOU)}You</span><span>${sw(THEM)}${esc(PN())}</span><span>${sw(`linear-gradient(135deg,${YOU} 50%,${THEM} 50%)`)}Both working</span><span><i style="background:var(--off)"></i>Both off</span>`
     :`<span><i style="background:var(--am)"></i>AM</span><span><i style="background:var(--pm)"></i>PM</span><span><i style="background:var(--off)"></i>Off</span><span><i style="background:var(--vac)"></i>Vacation</span>`}</div>
   <p class="muted">Tap a day to ask ${esc(PN())} for a swap, no overtime, or a day off together.</p></div>`+listCard();
  $('#title').textContent=v==='p'?`${PN()}’s schedule`:'All schedules';
  $('#prev').onclick=()=>{st.month=m?[y,m-1]:[y-1,11];render();};$('#next').onclick=()=>{st.month=m<11?[y,m+1]:[y+1,0];render();};bindSwitch();
  main.querySelectorAll('.d[data-d]').forEach(b=>b.onclick=()=>ask(b.dataset.d));bindList();return true;}
function listCard(){const it=P.items.slice(0,15);if(!it.length)return'';
  return`<div class="card" id="ptList"><h3>Requests with ${esc(PN())}</h3>${it.map(r=>`<div class="rqrow"><div><b>${TL[r.type]}</b> · ${esc(dl(r.from))}${r.swapWith?' ⇄ '+esc(dl(r.swapWith)):''}<br><small class="muted">${r.incoming?'From '+esc(PN()):'You asked'}${r.note?' · '+esc(r.note):''}</small></div><div class="rqside"><span class="rqst ${r.status}">${SL[r.status]||r.status}</span>${r.status==='pending'?(r.incoming?`<button class="btn small" data-pans="${r.id}">Answer</button>`:`<button class="btn sec small" data-pcan="${r.id}">Cancel</button>`):''}</div></div>`).join('')}</div>`;}
function bindList(){document.querySelectorAll('[data-pcan]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this request?'))return;try{await papi('/requests/'+b.dataset.pcan,{method:'DELETE'});}catch(e){}await load();render();});
  document.querySelectorAll('[data-pans]').forEach(b=>b.onclick=()=>incoming(P.items.find(r=>r.id===b.dataset.pans)));}
const close=()=>{$('#sheet').hidden=true;};
const open=h=>{$('#sheetbox').innerHTML=h;$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};const x=$('#sheetbox').querySelector('#cls');if(x)x.onclick=close;};
// ---- send a request to the partner
function ask(date){const p=P.partner;const d=R(p,date);const f={type:null};
  const draw=()=>{const isOT=d.kind==='ot';
   open(`<div class="shead"><span></span><span class="stepn">${esc(dl(date))}</span><button class="x" id="cls" aria-label="Close">✕</button></div>
   <h3>Ask ${esc(PN())}</h3><p class="muted">${esc(PN())} ${works(d)?'works <b>'+esc(d.shift)+'</b>':'is <b>off</b>'} this day. You ${works(R(st.s,date))?'work <b>'+esc(R(st.s,date).shift)+'</b>':'are <b>off</b>'}.</p>
   <div class="choices"><button class="choice swp ${f.type==='swap'?'on':''}" data-pt="swap">🔁 Swap a shift</button>
    <button class="choice ${f.type==='together'?'on':''}" data-pt="together">🏠 Day off together</button>
    <button class="choice ${f.type==='noot'?'on':''}" data-pt="noot" ${isOT?'disabled':''}>⛔ No overtime this day${isOT?'<small>Already overtime</small>':''}</button></div>
   ${f.type==='swap'?`<label for="ptWith">${works(d)?`Swap for which day? (a day ${esc(PN())} is off)`:`Swap for which day? (a day ${esc(PN())} works)`}</label><input type="date" id="ptWith" value="${f.w||''}"><p class="muted" id="ptWInfo"></p>
     <label class="chk" id="ptMineW" hidden><input type="checkbox" id="ptMine" checked> <span>Swap the same two days on my schedule too</span></label>`:''}
   <label for="ptNote">Note (optional)</label><input id="ptNote" maxlength="300" placeholder="Anything ${esc(PN())} should know" value="${esc(f.note||'')}">
   <p class="warnmsg" id="ptMsg" role="status"></p><button class="btn" id="ptSend" ${f.type?'':'disabled'}>Send to ${esc(PN())}</button>
   <p class="muted">${esc(PN())} gets a notification and can approve or deny.</p>`);
   const q=s=>$('#sheetbox').querySelector(s);
   $('#sheetbox').querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{f.note=q('#ptNote').value;f.type=b.dataset.pt;draw();});
   const wi=q('#ptWith');if(wi){const upd=()=>{f.w=wi.value;const i=q('#ptWInfo'),mw=q('#ptMineW');if(!wi.value){i.textContent='';mw.hidden=true;return;}
      const c=R(p,wi.value);i.textContent=`${PN()} ${works(c)?'works '+c.shift:'is off'} on ${dl(wi.value)}.`;const a=R(st.s,date),b2=R(st.s,wi.value);mw.hidden=!(works(a)!==works(b2)&&works(a)===!works(d));};wi.onchange=upd;upd();}
   q('#ptSend').onclick=async()=>{const msg=q('#ptMsg');if(f.type==='swap'&&!(wi&&wi.value)){msg.textContent='Pick the other day for the swap.';return;}
     q('#ptSend').disabled=true;msg.textContent='Sending…';
     try{await papi('/requests',{method:'POST',body:JSON.stringify({type:f.type,from:date,swapWith:wi?wi.value:undefined,mine:!!(q('#ptMine')&&!q('#ptMineW').hidden&&q('#ptMine').checked),note:q('#ptNote').value.trim()})});typeof PCA!=='undefined'&&PCA.track('partner_request_sent',{type:f.type});await load();close();render();}
     catch(e){q('#ptSend').disabled=false;msg.textContent=e.status&&e.status<500?e.message:"Couldn't send right now. Check your connection and try again.";}};};
  draw();}
// ---- incoming request: Approve / Deny
function incoming(r){if(!r)return;const p=P.partner;const mine=R(st.s,r.from),theirs=R(p,r.from);
  const what=r.type==='swap'?`Swap your ${esc(dl(r.from))} for ${esc(dl(r.swapWith))}`:r.type==='noot'?`No overtime on ${esc(dl(r.from))}`:`Day off together on ${esc(dl(r.from))}`;
  const expl=r.type==='swap'?`If you approve, your ${esc(dl(r.from))} and ${esc(dl(r.swapWith))} trade places on your schedule${r.mine?`, and ${esc(PN())}'s do too`:''}.`:r.type==='noot'?`If you approve, ${esc(dl(r.from))} is marked no overtime on your schedule.`:`If you approve, ${esc(dl(r.from))} is marked as a day off on both schedules.`;
  open(`<div class="shead"><span></span><span class="stepn">Request</span><button class="x" id="cls" aria-label="Close">✕</button></div>
   <h3>${esc(PN())} sent you a request</h3><div class="blkbox pto"><b>${TL[r.type].split(" ")[0]} ${what}</b>${r.note?`<p>“${esc(r.note)}”</p>`:''}<p class="muted">You ${works(mine)?'work '+esc(mine.shift):'are off'} · ${esc(PN())} ${works(theirs)?'works '+esc(theirs.shift):'is off'}</p></div>
   <p class="muted">${expl}</p><p class="warnmsg" id="ptMsg" role="status"></p>
   <div class="two"><button class="btn" id="ptAp">✓ Approve</button><button class="btn danger" id="ptDe">✕ Deny</button></div>
   <button class="linkbtn" id="ptLater" type="button">Decide later</button>`);
  const q=s=>$('#sheetbox').querySelector(s);q('#ptLater').onclick=close;
  const go=async s=>{q('#ptAp').disabled=q('#ptDe').disabled=true;q('#ptMsg').textContent=s==='approved'?'Approving…':'Sending…';
    try{await papi('/requests/'+r.id,{method:'PATCH',body:JSON.stringify({status:s})});typeof PCA!=='undefined'&&PCA.track(s==='approved'?'partner_request_approved':'partner_request_denied');await window.load();close();render();}
    catch(e){q('#ptAp').disabled=q('#ptDe').disabled=false;q('#ptMsg').textContent=e.status&&e.status<500?e.message:"Couldn't save right now. Check your connection and try again.";}};
  q('#ptAp').onclick=()=>go('approved');q('#ptDe').onclick=()=>go('declined');}
// pop up a new incoming request once per session
function maybePop(){try{if(busy||!$('#sheet').hidden)return;const r=pendIn().find(x=>!popped.has(x.id));if(!r)return;popped.add(r.id);incoming(r);}catch(e){}}
// ---- Share tab card
function shareCard(){if(P.linked)return`<div class="card" id="ptCard"><h3>Sharing with ${esc(PN())}</h3><p class="muted">You can see each other's schedules and send each other requests.</p>
   <label class="chk offtoggle"><input type="checkbox" id="ptAll" ${P.showAll?'checked':''}> <span><b>Show all schedules</b><br><small class="muted">See your days and ${esc(PN())}'s together on your calendar.</small></span></label><p class="muted" id="ptAllMsg" role="status"></p>
   <button class="btn sec" id="ptUnlink">Unlink ${esc(PN())}</button></div>`;
  const link=P.code?`${APP}/?pair=${P.code}`:'';
  return`<div class="card" id="ptCard"><h3>Link with your partner</h3><p class="muted">For couples who both work shifts. Once linked, you'll each see the other's schedule and can ask each other for a swap, no overtime, or a day off together. Either of you can approve or deny.</p>
   ${P.code?`<label>Your link code</label><div class="url ptcode" id="ptCode">${esc(P.code)}</div><button class="btn" id="ptShare">📤 Send invite link</button><div class="two"><a class="btn sec" id="ptText" href="sms:?&body=${encodeURIComponent('Link our work schedules on Punch Card: '+link)}">💬 Text</a><button class="btn sec" id="ptCopy">🔗 Copy link</button></div><small class="muted">Code works for 7 days.</small><details class="tech"><summary>Show details</summary><div class="url">${esc(link)}</div></details>`
     :`<button class="btn" id="ptMake">Get my link code</button>`}
   <p class="muted" style="text-align:center">Got a code from your partner?</p><div class="addrow"><input id="ptJoin" maxlength="9" placeholder="e.g. MAYA-4821" autocapitalize="characters" autocomplete="off"><button class="addbtn" id="ptJoinBtn">Link</button></div><p class="warnmsg" id="ptMsg" role="status"></p></div>`;}
function bindShare(){const q=s=>document.querySelector(s);const link=()=>`${APP}/?pair=${P.code}`;
  if(q('#ptMake'))q('#ptMake').onclick=async()=>{try{const j=await papi('/code',{method:'POST'});P.code=j.code;render();}catch(e){q('#ptMsg').textContent="Couldn't make a code right now. Try again.";}};
  if(q('#ptShare'))q('#ptShare').onclick=()=>navigator.share?navigator.share({title:'Link our schedules',text:'Link our work schedules on Punch Card',url:link()}).catch(()=>{}):navigator.clipboard.writeText(link()).then(()=>alert('Link copied'));
  if(q('#ptCopy'))q('#ptCopy').onclick=()=>navigator.clipboard.writeText(link()).then(()=>{q('#ptCopy').textContent='✔ Copied';});
  if(q('#ptJoinBtn'))q('#ptJoinBtn').onclick=()=>join(q('#ptJoin').value,q('#ptMsg'));
  if(q('#ptAll'))q('#ptAll').onchange=async e=>{try{await papi('/settings',{method:'POST',body:JSON.stringify({showAll:e.target.checked})});P.showAll=e.target.checked;setView(P.showAll?'all':'me');q('#ptAllMsg').textContent=P.showAll?'On ✔ Open Calendar and tap Both.':'Off.';}catch(x){e.target.checked=!e.target.checked;q('#ptAllMsg').textContent="Couldn't save right now.";}};
  if(q('#ptUnlink'))q('#ptUnlink').onclick=async()=>{if(!confirm(`Unlink from ${PN()}? You'll stop seeing each other's schedules. Approved changes stay.`))return;try{await papi('',{method:'DELETE'});}catch(e){}setView('me');await load();render();};}
async function join(code,msg){code=String(code||'').trim();if(!code){msg.textContent='Type the code.';return;}msg.textContent='Linking…';
  try{const j=await papi('/join',{method:'POST',body:JSON.stringify({code})});localStorage.removeItem('pc_pair');await load();msg.textContent='';
    open(`<div class="shead"><span></span><span class="stepn">Linked</span><button class="x" id="cls" aria-label="Close">✕</button></div><h3>You're linked with ${esc(PN())} 🎉</h3><p>You can now see each other's schedules. Tap <b>${esc(PN())}</b> at the top of your calendar, then tap a day to send a request.</p><button class="btn" id="ptGo">See ${esc(PN())}'s schedule</button>`);
    $('#ptGo').onclick=()=>{setView('p');st.tab='cal';close();render();};}
  catch(e){msg.textContent=e.status&&e.status<500?e.message:"Couldn't link right now. Check your connection and try again.";}}
// invite link (?pair=CODE): remember it, then offer to link once the person has a schedule
function fromUrl(){try{const c=new URLSearchParams(location.search).get('pair');if(c){localStorage.setItem('pc_pair',c);history.replaceState(null,'',location.pathname+location.hash);}}catch(e){}}
function offerPair(){const c=localStorage.getItem('pc_pair');if(!c||st.mode!=='owner'||!st.id||!$('#sheet').hidden||(st.s.settings&&st.s.settings.onboarded===false))return;
  if(P.linked){localStorage.removeItem('pc_pair');return;}busy=true;
  open(`<div class="shead"><span></span><span class="stepn">Invite</span><button class="x" id="cls" aria-label="Close">✕</button></div><h3>Link schedules with your partner?</h3><p>You opened an invite to link work schedules. You'll each see the other's schedule and can send each other requests.</p>
   <button class="btn" id="ptYes">Link schedules</button><button class="btn sec" id="ptNo">Not now</button><p class="warnmsg" id="ptMsg" role="status"></p>`);
  $('#cls').onclick=$('#ptNo').onclick=()=>{localStorage.removeItem('pc_pair');busy=false;close();};$('#ptYes').onclick=()=>{busy=false;join(c,$('#ptMsg'));};}
return{P,load,switcher,bindSwitch,renderCal,shareCard,bindShare,maybePop,fromUrl,offerPair,view};})();

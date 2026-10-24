// Requests: shared-link viewers ask for PTO or "no overtime" on a day (or range); the owner approves/declines.
// Approved items show on everyone's calendar. Optional Web Push (owner: new requests; viewer: answers). Plain words, 44px targets, no animation.
const Req=(()=>{
const R={items:[],custom:[],reasons:['Dr appointment','School conference','Birthday','Family event','Other'],notify:false,push:false};
const WRITE='__write';
const devKey=()=>{let k=localStorage.getItem('pc_req_key');if(!k){const a=new Uint8Array(18);crypto.getRandomValues(a);k=btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');localStorage.setItem('pc_req_key',k);}return k;};
const vapi=(p,o={})=>fetch(API+'/api/s/'+st.viewId+p,{...o,headers:{'Content-Type':'application/json','X-Req-Key':devKey(),...(o.headers||{})}}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||r.status);e.status=r.status;throw e;}return j;});
const dl=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
const span=r=>dl(r.from)+(r.to&&r.to!==r.from?' – '+dl(r.to):'');
const TL={pto:'Take PTO',noot:'Block overtime'};const SL={pending:'Pending',approved:'Approved',declined:'Declined',removed:'Removed'};
const when=t=>{const d=new Date(t);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+Rot.ft(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'));};
const inR=(r,d)=>d>=r.from&&d<=(r.to||r.from);
async function load(){try{if(st.mode==='view')Object.assign(R,await vapi('/requests'));else if(st.id){const j=await api('/api/schedules/'+st.id+'/requests');Object.assign(R,j);}}catch(e){}}
const pending=()=>R.items.filter(r=>r.status==='pending');
// calendar marks: approved -> label for everyone; pending -> small dot (owner: all; viewer: own)
function mark(date){const a=(st.s.approved||[]).filter(r=>inR(r,date));let h='';
  if(a.some(r=>r.type==='pto'))h+='<span class="rqa pto">PTO</span>';else if(a.some(r=>r.type==='noot'))h+='<span class="rqa noot">no OT</span>';
  if(pending().some(r=>inR(r,date)))h+='<span class="rqdot" title="Request pending" aria-label="request pending"></span>';return h;}
function ownerBar(){const n=pending().length;return`<button class="btn sec rqbar" id="rqOpen">📨 Requests${n?` <span class="badge" id="rqBadge">${n}</span>`:''}</button>`;}
const reasonOpts=()=>[...R.reasons.filter(x=>x!=='Other'),...R.custom,'Other'];
// ---------- viewer: request sheet
function sheet(date){const sb=$('#sheetbox');const d=Rot.day(st.s.rotation,st.s.crew,date,st.s.overrides,st.s.settings);const isOT=d.kind==='ot';
  const f={type:null};const close=()=>{$('#sheet').hidden=true;};
  const draw=()=>{sb.innerHTML=`<div class="shead"><span></span><span class="stepn">Request</span><button class="x" id="cls" aria-label="Close">✕</button></div>
   <h3>${dl(date)}</h3><p class="muted">Scheduled: <b>${esc(Rot.dayLabel(d,st.s.settings))}</b></p>
   <p class="q">What do you want to ask for?</p><div class="choices two">
    <button class="choice vac ${f.type==='pto'?'on':''}" data-rt="pto"><span>🌴 Take PTO</span></button>
    <button class="choice ot ${f.type==='noot'?'on':''}" data-rt="noot" ${isOT?'disabled aria-disabled="true"':''}><span>🚫 Block overtime</span>${isOT?'<small>Already overtime</small>':''}</button></div>
   <label for="rqReason">Reason</label><select id="rqReason">${reasonOpts().map(x=>`<option>${esc(x)}</option>`).join('')}<option value="${WRITE}">Write in a new reason…</option></select>
   <div id="rqNewWrap" hidden><label for="rqNew">New reason</label><input id="rqNew" maxlength="60" placeholder="e.g. Vet visit"><small class="muted">Saved for next time.</small></div>
   ${R.custom.length?`<details class="rqmanage"><summary>Manage my reasons</summary>${R.custom.map(x=>`<div class="jobrow"><span>${esc(x)}</span><button class="rm" data-rmr="${esc(x)}" aria-label="Remove ${esc(x)}">✕</button></div>`).join('')}</details>`:''}
   <label for="rqBy">Your first name (optional)</label><input id="rqBy" maxlength="30" autocomplete="given-name" placeholder="e.g. Maria" value="${esc(localStorage.getItem('pc_req_by')||'')}">
   <label for="rqNote">Note (optional)</label><input id="rqNote" maxlength="300" placeholder="Anything ${esc(((st.s.settings||{}).firstName||'').trim()||'they')} should know">
   <label for="rqTo">Through (optional, for more than one day)</label><input type="date" id="rqTo" min="${date}" value="">
   <p class="muted" id="rqMsg" role="status"></p><div class="two"><button class="btn sec" id="rqCancel">Cancel</button><button class="btn" id="rqSend" ${f.type?'':'disabled'}>Send request</button></div>`;
   const q=s=>sb.querySelector(s);q('#cls').onclick=close;q('#rqCancel').onclick=close;
   sb.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{if(b.disabled)return;f.type=b.dataset.rt;sb.querySelectorAll('[data-rt]').forEach(x=>x.classList.toggle('on',x===b));q('#rqSend').disabled=false;});
   q('#rqReason').onchange=()=>{q('#rqNewWrap').hidden=q('#rqReason').value!==WRITE;if(!q('#rqNewWrap').hidden)q('#rqNew').focus();};
   sb.querySelectorAll('[data-rmr]').forEach(b=>b.onclick=async()=>{try{const j=await vapi('/reasons',{method:'DELETE',body:JSON.stringify({reason:b.dataset.rmr})});R.custom=j.custom;const t=f.type;draw();if(t)sb.querySelector(`[data-rt=${t}]`).click();}catch(e){q('#rqMsg').textContent="Couldn't remove it right now.";}});
   q('#rqSend').onclick=async()=>{const w=q('#rqReason').value===WRITE;const reason=w?q('#rqNew').value.trim():q('#rqReason').value;
     if(!f.type){q('#rqMsg').textContent='Pick Take PTO or Block overtime.';return;}if(!reason){q('#rqMsg').textContent='Type your reason.';return;}
     q('#rqSend').disabled=true;q('#rqMsg').textContent='Sending…';
     try{await vapi('/requests',{method:'POST',body:JSON.stringify({type:f.type,from:date,to:q('#rqTo').value||date,reason,note:q('#rqNote').value.trim(),by:(localStorage.setItem('pc_req_by',q('#rqBy').value.trim()),q('#rqBy').value.trim()),saveReason:w})});await load();close();render();}
     catch(e){q('#rqSend').disabled=false;q('#rqMsg').textContent=e.status&&e.status<500?e.message:"Couldn't send right now. Check your connection and try again.";}};};
  draw();$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};}
// ---------- approved block: tap a marked day -> explain why + Remove block (confirm). Returns false if no block on that day.
const oName=()=>((st.s.settings||{}).firstName||'').trim()||'the worker';
function block(date,editFn){const a=(st.s.approved||[]).filter(r=>inR(r,date));if(!a.length)return false;
  const r=a.find(x=>x.type==='pto')||a[0];const sb=$('#sheetbox');const close=()=>{$('#sheet').hidden=true;};const view=st.mode==='view';
  const mine=view&&R.items.some(x=>x.id===r.id);const canRemove=!view||mine;
  const who=r.by||(mine?'You':'Someone with the family link');
  const title=new Date(Rot.parseD(date)).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'});
  const what=r.type==='pto'?'PTO':'No overtime';const expl=r.type==='pto'?`${esc(oName())} is taking this day off.`:`No overtime on this day. ${esc(oName())} won't pick up extra shifts.`;
  let confirmStep=false;
  const draw=()=>{sb.innerHTML=`<div class="shead"><span></span><span class="stepn">Approved</span><button class="x" id="cls" aria-label="Close">✕</button></div>
   <h3>${title}</h3><div class="blkbox ${r.type}" id="blkBox"><b>${what}</b><p>${expl}</p></div>
   <dl class="blkdl"><dt>Reason</dt><dd>${esc(r.reason||'—')}${r.note?`<br><small class="muted">${esc(r.note)}</small>`:''}</dd>
   <dt>Asked by</dt><dd>${esc(who)}</dd><dt>Approved</dt><dd>${r.decidedAt?esc(when(r.decidedAt)):'Yes'} by ${esc(oName())}</dd>
   ${r.to&&r.to!==r.from?`<dt>Dates</dt><dd>${esc(span(r))}</dd>`:''}</dl>
   <p class="muted" id="blkMsg" role="status"></p>
   ${confirmStep?`<p class="q" id="blkAsk">Remove this ${what==='PTO'?'PTO':'block'}${r.to&&r.to!==r.from?' for all '+esc(span(r)):''}? Everyone with the link will see it cleared.</p><div class="two"><button class="btn sec" id="blkNo">Keep it</button><button class="btn danger" id="blkYes">Yes, remove</button></div>`
     :canRemove?`<button class="btn sec blkrm" id="blkRm">Remove block</button>`:`<p class="muted">Only the person who asked can remove it.</p>`}
   ${confirmStep?'':`<p class="blkalt"><button class="linkbtn" id="blkEdit">${view?'Ask for something else on this day':'Edit work on this day'}</button></p>`}`;
   const q=s=>sb.querySelector(s);q('#cls').onclick=close;
   if(q('#blkEdit'))q('#blkEdit').onclick=()=>{editFn();};if(q('#blkRm'))q('#blkRm').onclick=()=>{confirmStep=true;draw();};if(q('#blkNo'))q('#blkNo').onclick=()=>{confirmStep=false;draw();};
   if(q('#blkYes'))q('#blkYes').onclick=async()=>{q('#blkYes').disabled=true;q('#blkMsg').textContent='Removing…';
     try{if(view)await vapi('/requests/'+r.id,{method:'DELETE'});else await api(`/api/schedules/${st.id}/requests/${r.id}`,{method:'DELETE'});
       await window.load();await load();close();render();}
     catch(e){q('#blkYes').disabled=false;q('#blkMsg').textContent="Couldn't remove it right now. Check your connection and try again.";}};};
  draw();$('#sheet').hidden=false;$('#sheet').onclick=e=>{if(e.target.id==='sheet')close();};return true;}
// ---------- push (shared by owner + viewer)
const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const iosHint=()=>isIOS()&&!standalone()?`<p class="muted rqhint" id="iosHint">On iPhone, notifications work only after you add Punch Card to your Home Screen: tap Share ⬆︎ → <b>Add to Home Screen</b>, then open it from there.</p>`:'';
async function subscribe(){if(!('serviceWorker'in navigator)||!('PushManager'in window)||!window.Notification)throw new Error(isIOS()?'Add Punch Card to your Home Screen first, then turn this on there.':'This browser can\'t show notifications. You\'ll still see a badge in the app.');
  const{publicKey}=await fetch(API+'/api/vapid').then(r=>r.json());if(!publicKey)return null;// server has no push keys: in-app badge only
  if(await Notification.requestPermission()!=='granted')throw new Error('Notifications are blocked for this site. Allow them in your phone settings.');
  const reg=await navigator.serviceWorker.ready;const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-publicKey.length%4)%4)),c=>c.charCodeAt(0));
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});return sub.toJSON?sub.toJSON():sub;}
const toggle=(id,on,title,sub)=>`<label class="chk offtoggle"><input type="checkbox" id="${id}" ${on?'checked':''}> <span><b>${title}</b><br><small class="muted">${sub}</small></span></label>${iosHint()}<p class="muted" id="${id}Msg" role="status"></p>`;
async function setNotify(on,post,msgEl){try{let sub=null;if(on){sub=await subscribe();if(!sub)msgEl.textContent='On. Push is not set up on the server yet, so you\'ll see a badge in the app.';}
  await post({on,sub});R.notify=on;if(on&&sub)msgEl.textContent='On ✔';if(!on)msgEl.textContent='Off.';return true;}catch(e){msgEl.textContent=e.message;return false;}}
// ---------- viewer: my requests card (below calendar)
const vSL=k=>{const n=((st.s.settings||{}).firstName||'').trim();return k==='removed'?'Removed':k==='pending'?(n?'Sent to '+esc(n):'Pending'):(n?esc(n)+' '+k:SL[k]);};
function viewerCard(){const it=R.items.slice().sort((a,b)=>b.createdAt-a.createdAt);return`<div class="card" id="myReqCard"><h3>My requests</h3><p class="muted">Tap a day above to ask for PTO or no overtime.</p>
  ${it.length?it.map(r=>`<div class="rqrow" data-rq="${r.id}"><div><b>${TL[r.type]}</b> · ${esc(span(r))}<br><small class="muted">${esc(r.reason)}${r.note?' · '+esc(r.note):''}</small></div><div class="rqside"><span class="rqst ${r.status}">${vSL(r.status)}</span>${r.status==='pending'?`<button class="btn sec small" data-cancel="${r.id}">Cancel</button>`:''}</div></div>`).join(''):'<p class="muted">No requests yet.</p>'}
  ${toggle('rqVNotify',R.notify,'Notify me when answered','Off by default. Only this phone.')}</div>`;}
function bindViewer(){document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this request?'))return;try{await vapi('/requests/'+b.dataset.cancel,{method:'DELETE'});}catch(e){}await load();render();});
  const t=$('#rqVNotify');if(t)t.onchange=async()=>{const ok=await setNotify(t.checked,b=>vapi('/requests/notify',{method:'POST',body:JSON.stringify(b)}),$('#rqVNotifyMsg'));if(!ok)t.checked=!t.checked;};}
// ---------- owner: Requests list
function renderOwner(){const it=R.items;const pend=it.filter(r=>r.status==='pending'),done=it.filter(r=>r.status!=='pending');
  const row=r=>`<div class="rqrow" data-rq="${r.id}"><div><b>${TL[r.type]}</b> · ${esc(span(r))}<br><small class="muted">${esc(r.reason)}${r.note?' · '+esc(r.note):''}${r.by?' · from '+esc(r.by):''} · sent ${when(r.createdAt)}</small></div>
   <div class="rqside">${r.status==='pending'?`<button class="btn small" data-ap="${r.id}">Approve</button><button class="btn sec small" data-de="${r.id}">Decline</button>`:`<span class="rqst ${r.status}">${vSL(r.status)}</span>${r.status==='removed'?'':`<button class="btn sec small" data-undo="${r.id}">Undo</button>`}`}</div></div>`;
  main.innerHTML=`<div class="card" id="rqList"><div class="shead"><button class="back" id="rqBack">‹ Calendar</button><span></span><span></span></div><h2>Requests</h2>
   <p class="muted">From people with your family link. Approved PTO / no-OT days show on the calendar for everyone.</p>
   <h4>Waiting (${pend.length})</h4>${pend.length?pend.map(row).join(''):'<p class="muted">Nothing waiting.</p>'}${done.length?`<h4>Answered</h4>${done.map(row).join('')}`:''}</div>`;
  $('#rqBack').onclick=()=>{st.tab='cal';render();};
  const P=async(id,status)=>{await api(`/api/schedules/${st.id}/requests/${id}`,{method:'PATCH',body:JSON.stringify({status})});await window.load();render();};
  document.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>P(b.dataset.ap,'approved'));document.querySelectorAll('[data-de]').forEach(b=>b.onclick=()=>P(b.dataset.de,'declined'));document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>P(b.dataset.undo,'pending'));}
function ownerNotifyCard(){return`<div class="card" id="notifyCard"><h3>Notifications</h3>${toggle('rqONotify',R.notify,'Notify me about new requests','Off until you turn it on. A badge on Requests always shows new ones.')}</div>`;}
function bindOwnerSetup(){const t=$('#rqONotify');if(t)t.onchange=async()=>{const ok=await setNotify(t.checked,b=>api('/api/schedules/'+st.id+'/notify',{method:'POST',body:JSON.stringify(b)}),$('#rqONotifyMsg'));if(!ok)t.checked=!t.checked;};}
return{R,load,block,mark,ownerBar,sheet,viewerCard,bindViewer,renderOwner,ownerNotifyCard,bindOwnerSetup,devKey,iosHint};})();

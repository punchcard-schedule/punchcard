// Beta tester tools: Report a bug, privacy note, Delete my data, Save your private link. Plain words, 44px targets.
const Beta=(()=>{
const VERSION='v36';
const ownerLink=()=>`${APP}/e/${st.id}?t=${encodeURIComponent(st.token)}`;
const page=()=>st.mode==='view'?'spouse view':st.s&&st.s.settings&&st.s.settings.onboarded===false?'onboarding step '+(localStorage.getItem('pc_ob_step')||'1'):(st.tab||'cal');
// ---------- Report a bug (bottom sheet)
function openBug(){let d=document.getElementById('bugSheet');if(d)d.remove();d=document.createElement('div');d.id='bugSheet';d.className='bugsheet';d.setAttribute('role','dialog');d.setAttribute('aria-label','Report a bug');
  d.innerHTML=`<div class="bugpanel"><h3>Report a bug</h3><p class="muted">Tell us what went wrong. We add your app version, the screen you're on and your phone type automatically. Your private link is never sent.</p>
   <label for="bugText">What happened?</label><textarea id="bugText" rows="5" maxlength="5000" placeholder="e.g. I tapped Save and nothing happened"></textarea>
   <div class="two"><div><label for="bugName">Name (optional)</label><input id="bugName" maxlength="80" autocomplete="name"></div><div><label for="bugEmail">Email (optional)</label><input id="bugEmail" type="email" maxlength="120" autocomplete="email" placeholder="so we can reply"></div></div>
   <label for="bugShot">Screenshot (optional)</label><input id="bugShot" type="file" accept="image/*"><small class="muted" id="bugShotInfo"></small>
   <p class="muted" id="bugMsg" role="status"></p><div class="two"><button class="btn sec" id="bugCancel">Cancel</button><button class="btn" id="bugSend">Send report</button></div></div>`;
  document.body.appendChild(d);const q=s=>d.querySelector(s);let shot=null;q('#bugText').focus();
  q('#bugCancel').onclick=()=>d.remove();d.onclick=e=>{if(e.target===d)d.remove();};
  q('#bugShot').onchange=async()=>{const f=q('#bugShot').files[0];shot=null;q('#bugShotInfo').textContent='';if(!f)return;try{shot=await shrink(f);q('#bugShotInfo').textContent='Screenshot attached.';}catch(e){q('#bugShotInfo').textContent="That picture couldn't be attached. You can still send the report.";}};
  q('#bugSend').onclick=async()=>{const text=q('#bugText').value.trim();if(text.length<3){q('#bugMsg').textContent='Please describe the problem first.';return;}
    q('#bugSend').disabled=true;q('#bugMsg').textContent='Sending…';
    const b={text,name:q('#bugName').value.trim(),email:q('#bugEmail').value.trim(),version:VERSION,page:page(),ua:navigator.userAgent,screen:`${screen.width}x${screen.height} @${devicePixelRatio||1} (window ${innerWidth}x${innerHeight})`,scheduleId:st.mode==='owner'?st.id:'',mode:st.mode,shot};
    try{const r=await fetch(API+'/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'error');typeof PCA!=='undefined'&&PCA.track('feedback_submitted',{has_screenshot:!!shot});d.querySelector('.bugpanel').innerHTML=`<h3>Thank you!</h3><p>Your report was sent (#${esc(j.id)}).</p><button class="btn" id="bugDone">Close</button>`;d.querySelector('#bugDone').onclick=()=>d.remove();}
    catch(e){q('#bugSend').disabled=false;q('#bugMsg').textContent=/Too many|large|describe/.test(e.message)?e.message:"Couldn't send right now. Check your connection and try again.";}};}
async function shrink(f){const bm=await createImageBitmap(f);const k=Math.min(1,1400/Math.max(bm.width,bm.height));const c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);
  c.getContext('2d').drawImage(bm,0,0,c.width,c.height);let q=.8,u=c.toDataURL('image/jpeg',q);while(u.length>1_900_000&&q>.3){q-=.15;u=c.toDataURL('image/jpeg',q);}return u;}
// ---------- Privacy note
const PRIVACY=`<div class="card" id="privacyCard"><h2>Privacy, in plain words</h2>
 <p><b>What we store:</b> your schedule (crew, shifts, cycle, the days you change), your position name, holiday choices and settings, and, if you turn them on, alarm/notification settings. Bug reports you send (and anything you type in them) are stored too.</p>
 <p><b>What we don't collect:</b> no account, no password, no contacts, no location. No ads. We never sell your data. The only thing shared is anonymous usage stats, to help improve the app.</p>
 <p><b>Who can see it:</b> anyone who has your <b>private link</b> can see <i>and change</i> your schedule. Anyone with your <b>family link</b> can only view it. Keep the private link to yourself.</p>
 <p><b>Usage stats:</b> the app sends anonymous usage stats (like which features get used) to PostHog in the US. Never names, schedules or notes.</p>
 <details><summary>Show details</summary><p class="muted">Only simple events like "app opened", "onboarding done" or "request sent", plus the app version. No page addresses or links, nothing you type, no session recordings, and no account or profile.</p></details>
 <p><b>On this phone:</b> a copy is kept so the app opens fast and works offline.</p>
 <p><b>Deleting:</b> Setup → <b>Delete my data</b> removes your schedule from our server and this phone. Family links stop working right away.</p>
 <p class="muted">Punch Card is in beta. Questions: punchcard.schedule@gmail.com</p><button class="btn sec" id="privBack">Back</button></div>`;
function renderPrivacy(){main.innerHTML=PRIVACY;window.scrollTo(0,0);$('#privBack').onclick=()=>{st.tab=st.privBack||'setup';render();};}
function showPrivacy(){st.privBack=st.s&&st.s.settings&&st.s.settings.onboarded===false?'cal':st.tab;st.tab='privacy';render();}
// ---------- Save your private link
function linkCard(first){return`<div class="card linkcard" id="linkCard"><h3>🔑 Save your private link</h3>
 <p>This link <b>is</b> your schedule. There's no password: if you lose this phone or clear its browser, the link is the only way back in.</p>
 <div class="url" id="ownerUrl">${esc(ownerLink())}</div>
 <div class="two"><button class="btn" id="lkCopy">Copy link</button><button class="btn sec" id="lkShare">Share…</button></div>
 <a class="btn sec" id="lkMail" href="mailto:?subject=${encodeURIComponent('My Punch Card private link')}&body=${encodeURIComponent('Keep this private. It opens (and can change) my shift schedule:\n\n'+ownerLink())}">✉️ Email it to myself</a>
 <details><summary><b>Add Punch Card to your Home Screen</b></summary><p><b>iPhone (Safari):</b> tap Share <span aria-hidden="true">⬆︎</span> → <b>Add to Home Screen</b>.<br><b>Android (Chrome):</b> tap ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>).</p></details>
 <p class="muted" id="lkMsg" role="status"></p>${first?'<button class="btn sec" id="lkDone">I saved it</button>':''}</div>`;}
function bindLink(){if(!$('#linkCard'))return;const u=ownerLink();
  $('#lkCopy').onclick=async()=>{try{await navigator.clipboard.writeText(u);$('#lkMsg').textContent='Copied. Paste it somewhere safe (notes, email to yourself).';}catch(e){$('#lkMsg').textContent='Press and hold the link above to copy it.';}};
  $('#lkShare').onclick=()=>{if(navigator.share)navigator.share({title:'My Punch Card private link',text:'Keep this private: it opens my schedule.',url:u}).catch(()=>{});else $('#lkCopy').click();};
  if($('#lkDone'))$('#lkDone').onclick=()=>{localStorage.setItem('pc_link_saved','1');$('#linkCard').remove();};}
const needLinkNudge=()=>st.mode==='owner'&&!localStorage.getItem('pc_link_saved');
// ---------- Setup cards
function setupCards(){return linkCard(false)+`<div class="card" id="betaCard"><h3>Beta: help &amp; privacy</h3>
 <button class="btn" id="bugBtn">🐞 Report a bug</button><button class="btn sec" id="privBtn">🔒 Privacy, in plain words</button></div>
 <div class="card dangercard" id="deleteCard"><h3>Delete my data</h3><p class="muted">Removes your schedule, saved schedules and settings from our server and this phone. Family links stop working. This can't be undone.</p>
 <button class="btn danger" id="delBtn">🗑️ Delete my data</button><div id="delConfirm" hidden><p><b>Are you sure?</b> Type <b>DELETE</b> to confirm.</p><input id="delIn" autocomplete="off" autocapitalize="characters" aria-label="Type DELETE to confirm">
 <div class="two"><button class="btn sec" id="delNo">Keep my data</button><button class="btn danger" id="delYes" disabled>Delete forever</button></div><p class="muted" id="delMsg" role="status"></p></div></div>`;}
function bindSetup(){bindLink();$('#bugBtn').onclick=openBug;$('#privBtn').onclick=showPrivacy;
  $('#delBtn').onclick=()=>{$('#delConfirm').hidden=false;$('#delBtn').hidden=true;$('#delIn').focus();};$('#delNo').onclick=()=>{$('#delConfirm').hidden=true;$('#delBtn').hidden=false;$('#delIn').value='';};
  $('#delIn').oninput=()=>{$('#delYes').disabled=$('#delIn').value.trim().toUpperCase()!=='DELETE';};
  $('#delYes').onclick=async()=>{$('#delYes').disabled=true;$('#delMsg').textContent='Deleting…';
    try{const r=await fetch(API+'/api/schedules/'+st.id,{method:'DELETE',headers:{'X-Edit-Token':st.token}});
      if(r.status===409){$('#delMsg').textContent='This is a shared preset schedule and can\'t be deleted here.';return;}if(!r.ok&&r.status!==404)throw new Error(r.status);
      const keep=localStorage.getItem('theme');localStorage.clear();if(keep)localStorage.setItem('theme',keep);try{if(window.caches)for(const k of await caches.keys())await caches.delete(k);}catch(e){}
      location.replace(APP+'/?deleted=1');}
    catch(e){$('#delYes').disabled=false;$('#delMsg').textContent="Couldn't delete right now. Check your connection and try again.";}};}
return{VERSION,openBug,renderPrivacy,showPrivacy,linkCard,bindLink,needLinkNudge,setupCards,bindSetup,ownerLink};})();

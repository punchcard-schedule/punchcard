// Format-agnostic schedule set-up: (1) DETECT from an upload (CSV/TSV/text, PDF text, image text via OCR) or (2) BUILD from an
// optional template or from scratch. Both end in the same editable preview of the detected/defined configuration
// (crews, shift types + times/lengths, cycle length + pattern, start date, replication 1–24 months) before anything is saved.
const Design=(()=>{
let D=null;const KINDS=['day','swing','night'];
const VND=p=>new URL('vendor/'+p,document.baseURI).href;
function open(mode){D={mode:mode||'build',cfg:null,report:null,me:null,msg:'',tpl:null};st.tab='design';render();window.scrollTo(0,0);}
const ob=()=>st.s&&st.s.settings&&st.s.settings.onboarded===false;
const nice=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const loadScript=src=>new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s);});
// ---- reading uploads into text
async function pdfText(f){const pdfjs=await import(VND('pdfjs/pdf.min.mjs'));pdfjs.GlobalWorkerOptions.workerSrc=VND('pdfjs/pdf.worker.min.mjs');const doc=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise;const out=[];
  for(let p=1;p<=doc.numPages;p++){const tc=await (await doc.getPage(p)).getTextContent();const rows={};for(const it of tc.items){if(!it.str.trim())continue;const y=Math.round(it.transform[5]/3);(rows[y]=rows[y]||[]).push({x:it.transform[4],s:it.str.trim()});}
    Object.keys(rows).map(Number).sort((a,b)=>b-a).forEach(y=>out.push(rows[y].sort((a,b)=>a.x-b.x).map(c=>c.s).join('\t')));}return out.join('\n');}
// Printed calendars (PDF month/crew grids, screenshots, photos incl. HEIC) go to the printed-calendar importer, which reads grids
// and AM/PM cells on this phone. Only text-like PDFs that look like a table stay here. Never shows a raw error.
const isPdf=async f=>{try{const b=new Uint8Array(await f.slice(0,5).arrayBuffer());if(String.fromCharCode.apply(null,Array.prototype.slice.call(b))==='%PDF-')return true;}catch(e){}return /pdf/.test(f.type)||/\.pdf$/i.test(f.name||'');};
const isText=f=>/^text\/|csv|tab-separated|json/.test(f.type)||/\.(csv|tsv|txt)$/i.test(f.name||'');
function toPrinted(files,why){localStorage.setItem('pc_ob_sched','import');Import.open();if(why)console.info('routing to printed-calendar importer:',why);Import._run(files);}
async function readFiles(files){let txt=[];const printed=[];for(const f of files){D.msg=`Reading ${f.name||'file'}…`;draw();
    if(await isPdf(f)){let t='';try{t=await pdfText(f);}catch(e){console.warn(e);}let ok=false;try{ok=Detect.parse(t,{year:+today().slice(0,4)}).report.crews>0;}catch(e){}if(ok)txt.push(t);else printed.push(f);}
    else if(isText(f))txt.push(await f.text());else printed.push(f);}return{text:txt.join('\n'),printed};}
const FRIENDLY="We couldn't find a schedule in that. Upload a spreadsheet/CSV (one row per date or per crew), a PDF or screenshots of your printed calendar, or use “Build my schedule”.";
function detect(text){try{const r=Detect.parse(text,{year:+today().slice(0,4)});D.cfg=r.cfg;D.report=r.report;D.me=pickMe();D.msg='';}catch(e){console.warn('detect:',e.message);D.msg=FRIENDLY+(/dates/.test(e.message)?' (No dates were found: put one date per row or per column.)':'');}draw();}
const pickMe=()=>{const w=localStorage.getItem('pc_ob_crew')||st.s.crew;const n=D.cfg.crews.map(c=>c.name);return n.includes(w)?w:(n.find(x=>x.toLowerCase()===String(w).toLowerCase())||n[0]);};
// ---- helpers on the config
const codes=()=>Object.keys(D.cfg.types);
function setL(L){L=Math.max(1,Math.min(400,+L||1));D.cfg.L=L;D.cfg.crews.forEach(c=>{c.days=Array.from({length:L},(_,i)=>c.days[i]??null);});}
const patStr=c=>c.days.slice(0,D.cfg.L).map(x=>x||'.').join(' ');
const parsePat=s=>String(s).trim().split(/[\s,]+/).filter(Boolean).map(x=>/^(\.|-|off|o|x)$/i.test(x)?null:x.toUpperCase());
function rotation(){const c=D.cfg;const end=new Date(Rot.parseD(c.start));end.setUTCMonth(end.getUTCMonth()+(+c.months||12));
  return Rot.makeGeneric({...c,until:Rot.fmt(end.getTime()-Rot.DAY),name:c.name||(D.tpl&&D.tpl!=='custom'?c.name:'')||Rot.defaultName(c.L)});}
function problems(){const c=D.cfg,p=[];if(!/^\d{4}-\d\d-\d\d$/.test(c.start||''))p.push('Pick the date the cycle starts.');if(!codes().length)p.push('Add at least one shift type.');
  for(const[k,T]of Object.entries(c.types)){if(!/^\d\d:\d\d$/.test(T.start||''))p.push(`Shift ${k}: set a start time.`);if(!(+T.hours>0&&+T.hours<=24))p.push(`Shift ${k}: length must be 1–24 hours.`);}
  if(!c.crews.length)p.push('Add at least one crew.');c.crews.forEach((x,i)=>{if(!x.name.trim())p.push(`Crew ${i+1} needs a name.`);x.days.forEach(k=>{if(k&&!c.types[k])p.push(`Crew ${x.name||i+1} uses shift "${k}" which is not defined.`);});});
  if(new Set(c.crews.map(x=>x.name.trim())).size<c.crews.length)p.push('Crew names must be different.');if(!c.crews.some(x=>x.days.some(Boolean)))p.push('No working days yet: enter a pattern.');return[...new Set(p)];}
// ---- screens
function render(){if(!D)return open();$('#tabs').hidden=ob();const sel=$('#crew');if(ob()&&sel)sel.remove();draw();}
function draw(){main.innerHTML=D.cfg?editor():D.mode==='detect'?upload():picker();wire();}
function head(t){return`<div class="card dz"><button class="btn sec small" id="dzBack">‹ Back</button><h2>${t}</h2>`;}
function upload(){return head('Upload your schedule')+`<p class="muted">Any schedule format. Punch Card finds the crews, the shift types and their times, and the repeating cycle, then shows you what it found to check and correct.</p>
  <label for="dzFile">CSV / spreadsheet export, text, PDF or photo</label><input type="file" id="dzFile" multiple accept=".csv,.tsv,.txt,.pdf,.heic,.heif,text/*,image/*,application/pdf">
  <label for="dzText">…or paste the rows</label><textarea id="dzText" rows="7" placeholder="date,Red,Blue,Green&#10;2026-11-02,D,E,N&#10;2026-11-03,D,E,N&#10;…&#10;D = 07:00-15:00"></textarea>
  <button class="btn" id="dzRun">Detect my schedule</button><small class="muted">Tip: include at least two full cycles so the repeat can be confirmed. Shift times can be in the cells (07:00-15:00) or as legend lines (D = 07:00-15:00).</small>
  <p class="warn" id="dzMsg" ${D.msg?'':'hidden'}>${esc(D.msg)}</p></div>`;}
function picker(){return head('Build your schedule')+`<p class="muted">Start from a common schedule or from scratch. Nothing is chosen for you; you can change crews, shift times and the start date next.</p>
  <div class="tpls" role="list">${Templates.LIST.map(t=>`<button class="tpl" role="listitem" data-tpl="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}
  <button class="tpl cus" data-tpl="custom"><b>✏️ Custom</b><small>Any number of crews, any shift types and times, any on/off pattern (e.g. 2-2-3, 5-2, 3-3-4) or cycle length.</small></button></div></div>`;}
function editor(){const c=D.cfg,r=D.report;let rot=null,err='';const pr=problems();if(!pr.length)try{rot=rotation();}catch(e){err=e.message;}
  const me=c.crews.find(x=>x.name===D.me)||c.crews[0];const desc=me?Rot.describe(me.days.slice(0,c.L)):null;
  const sum=r?`<div class="dzsum" id="dzSummary"><b>Detected:</b> ${r.crews} crew${r.crews>1?'s':''} (${r.names.map(esc).join(', ')}) · ${r.shiftTypes.length} shift type${r.shiftTypes.length>1?'s':''} (${r.shiftTypes.map(esc).join(', ')}) · ${r.cycleLength}-day cycle${r.pattern?` · pattern ${esc(r.pattern.short)}`:''} · ${r.verified?`confirmed over ${r.repeats} repeats of ${r.days} days`:'<span class="warnc">repeat not confirmed</span>'}${r.offsets.every(x=>x!==null)&&r.crews>1?` · crews staggered by ${r.offsets.join(', ')} days`:''}
    ${r.guessedTimes?'<br><span class="warnc">Shift times/lengths were not in the file: they are guesses. Please check them.</span>':''}${r.warn.map(w=>`<br><small>${esc(w)}</small>`).join('')}</div>`:'';
  const t=D.tpl&&D.tpl!=='custom'?Templates.LIST.find(x=>x.id===D.tpl):null;
  return head(r?'Check what we found':'Set up your schedule')+`${t?`<p class="muted">Template: <b>${esc(t.name)}</b>. ${esc(t.desc)}</p>`:''}${sum}
  <p class="muted">Correct anything below before it's repeated forward.</p>
  <label for="dzName">Schedule name</label><input type="text" id="dzName" maxlength="60" value="${esc(c.name||'')}" placeholder="${esc(Rot.defaultName(c.L))}">
  <div class="two"><div><label for="dzStart">Cycle starts (day 1)</label><input type="date" id="dzStart" value="${esc(c.start||'')}"></div><div><label for="dzL">Cycle length (days)</label><input type="number" id="dzL" min="1" max="400" value="${c.L}"></div></div>
  <h4>Shift types</h4><div class="dztypes">${codes().map(k=>{const T=c.types[k];return`<div class="dzrow" data-type="${esc(k)}"><label class="dzf dzfc"><span>Code</span><input type="text" class="dzcode" value="${esc(k)}" placeholder="D" maxlength="20"></label><label class="dzf dzfn"><span>Name</span><input type="text" class="dztname" value="${esc(T.name||'')}" placeholder="Day shift"></label><label class="dzf dzfs"><span>Start</span><input type="time" class="dztstart" value="${esc(T.start||'')}" placeholder="07:00"></label><label class="dzf dzfh"><span>Hours</span><input type="number" class="dzthours" min="1" max="24" step="0.5" value="${T.hours||''}" placeholder="8"></label><label class="dzf dzfk"><span>Type</span><select class="dztkind">${KINDS.map(x=>`<option ${T.kind===x?'selected':''}>${x}</option>`).join('')}</select></label><button class="addbtn dztrm" aria-label="Remove shift type ${esc(k)}">✕</button></div>`;}).join('')}</div>
  <button class="btn sec small" id="dzAddType">＋ Add shift type</button>
  <h4>Crews &amp; pattern</h4><small class="muted">One code per cycle day, separated by spaces; <b>.</b> = off.</small>
  <div class="dzcrews">${c.crews.map((x,i)=>`<div class="dzcrew" data-crew="${i}"><div class="addrow"><input class="dzcname" value="${esc(x.name)}" placeholder="Crew name" aria-label="Crew name"><button class="addbtn dzcrm" aria-label="Remove crew">✕</button></div><input class="dzpat" value="${esc(patStr(x))}" aria-label="Pattern for ${esc(x.name)}"><small class="muted">${esc(Rot.describe(x.days.slice(0,c.L)).text||'all off')}</small></div>`).join('')}</div>
  <button class="btn sec small" id="dzAddCrew">＋ Add crew</button>
  <details class="dzgen" ${!c.crews.some(x=>x.days.some(Boolean))?'open':''}><summary>Generate from an on/off pattern</summary>
   <div class="two"><div><label for="dzRuns">On/off days</label><input id="dzRuns" placeholder="e.g. 5-2, 2-2-3, 4-4, 3-3-4"></div><div><label for="dzRunCode">Shift</label><select id="dzRunCode">${codes().map(k=>`<option>${esc(k)}</option>`).join('')}</select></div></div>
   <div class="two"><div><label for="dzStag">Stagger crews by (days)</label><input type="number" id="dzStag" min="0" placeholder="auto"></div><div><label>&nbsp;</label><button class="btn sec" id="dzGen">Fill crews</button></div></div></details>
  <label for="dzMe">My crew</label><select id="dzMe">${c.crews.map(x=>`<option ${x===me?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
  <label for="dzMonths">Repeat for</label><select id="dzMonths">${Array.from({length:24},(_,i)=>i+1).map(k=>`<option value="${k}" ${k===(+c.months||12)?'selected':''}>${k} month${k>1?'s':''}</option>`).join('')}</select>
  <div id="dzPrev">${prev(rot,me)}</div>${pr.length||err?`<ul class="warn" id="dzProb">${pr.concat(err?[err]:[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
  <button class="btn" id="dzSave" ${pr.length||err?'disabled':''}>Use this schedule</button><small id="dzMsg">${esc(D.msg||'')}</small></div>`;}
function prev(rot,me){if(!rot||!me)return'<p class="muted">Preview appears when the setup is complete.</p>';const t=today();const inR=t>=D.cfg.start&&t<=rot.until;
  // start at today's month (today ringed) when the schedule covers today; "Show earlier months" goes back to the cycle start
  const base=inR?t:D.cfg.start;const s0=D.early&&inR?D.cfg.start:base;const y=+s0.slice(0,4),m=+s0.slice(5,7)-1;const span=(+base.slice(0,4)-y)*12+(+base.slice(5,7)-1-m)+2;
  let h=inR&&t.slice(0,7)>D.cfg.start.slice(0,7)?`<button class="btn sec small" id="dzEarlier">${D.early?'Hide earlier months':'Show earlier months'}</button>`:'';
  for(let k=0;k<span;k++){const f=Rot.fmt(Date.UTC(y,m+k,1));const n=new Date(Date.UTC(y,m+k+1,0)).getUTCDate();const days=Rot.range(rot,me.name,f,n,{},{});const lead=new Date(Rot.parseD(f)).getUTCDay();
    h+=`<h4>${MON[(m+k)%12]} ${y+Math.floor((m+k)/12)} · ${esc(me.name)}</h4><div class="grid obgrid">${['S','M','T','W','T','F','S'].map(x=>`<div class="dow">${x}</div>`).join('')}${'<div class="d blank"></div>'.repeat(lead)}${days.map(d=>`<div class="d ${Rot.cls(d)} ${d.kind} ${d.date===t?'today':''}" data-pd="${d.date}"><span class="n">${+d.date.slice(8)}</span><span class="s">${d.shift?esc(d.shift):''}</span></div>`).join('')}</div>`;}
  const tt=Object.entries(D.cfg.types).map(([k,T])=>`${esc(k)} ${esc(Rot.ft(T.start))} · ${T.hours} h`).join(' | ');return h+`<small class="muted">${tt} · repeats until ${nice(rot.until)}</small>`;}
function wire(){const q=s=>main.querySelector(s),qa=s=>[...main.querySelectorAll(s)];
  q('#dzBack').onclick=()=>{if(D.cfg){D.cfg=null;D.report=null;D.tpl=null;D.msg='';draw();}else{st.tab=ob()?'cal':'setup';window.render();}};
  if(!D.cfg&&D.mode==='detect'){q('#dzRun').onclick=async()=>{const f=Array.prototype.slice.call(q('#dzFile').files||[]);let t=q('#dzText').value;try{if(f.length){const r=await readFiles(f);if(r.printed.length&&!r.text.trim()&&!t.trim())return toPrinted(r.printed,'calendar layout');t=r.text+'\n'+t;}}catch(e){console.warn(e);D.msg=FRIENDLY;return draw();}if(!t.trim()){D.msg='Choose a file or paste your schedule.';return draw();}detect(t);};return;}
  if(!D.cfg){qa('[data-tpl]').forEach(b=>b.onclick=()=>{const id=b.dataset.tpl;D.tpl=id;
      D.cfg=id==='custom'?{name:'',start:today(),L:7,types:{},crews:[{name:localStorage.getItem('pc_ob_crew')||'',days:Array(7).fill(null)}],months:12}:Templates.toConfig(id,today());if(D.cfg.types)for(const[k,T]of Object.entries(D.cfg.types))Detect.fillName(k,T);D.me=pickMe();draw();});return;}
  main.onclick=e=>{if(e.target&&e.target.id==='dzEarlier'){D.early=!D.early;const y=window.scrollY;draw();window.scrollTo(0,y);}};
  const c=D.cfg;const re=()=>{const y=window.scrollY;draw();window.scrollTo(0,y);};const soft=()=>{const pr=problems();let rot=null;if(!pr.length)try{rot=rotation();}catch(e){}const me=c.crews.find(x=>x.name===D.me)||c.crews[0];q('#dzPrev').innerHTML=prev(rot,me);};
  q('#dzName').oninput=e=>{c.name=e.target.value;};q('#dzStart').onchange=e=>{c.start=e.target.value;re();};q('#dzL').onchange=e=>{setL(e.target.value);re();};
  qa('.dzrow').forEach(row=>{const k=row.dataset.type;const T=c.types[k];
    row.querySelector('.dzcode').onchange=e=>{const nk=e.target.value.trim().toUpperCase();if(!nk||nk===k||c.types[nk])return re();if(T.autoName||!String(T.name||'').trim())T.name='';c.types[nk]=Detect.fillName(nk,T);delete c.types[k];c.crews.forEach(x=>x.days=x.days.map(d=>d===k?nk:d));re();};
    row.querySelector('.dztname').oninput=e=>{T.name=e.target.value;delete T.autoName;};row.querySelector('.dztname').onchange=e=>{if(!e.target.value.trim()){T.name='';Detect.fillName(k,T);re();}};row.querySelector('.dztstart').onchange=e=>{T.start=e.target.value;delete T.guessed;re();};
    row.querySelector('.dzthours').onchange=e=>{T.hours=+e.target.value;delete T.guessed;re();};row.querySelector('.dztkind').onchange=e=>{T.kind=e.target.value;if(T.autoName){T.name='';Detect.fillName(k,T);}re();};
    row.querySelector('.dztrm').onclick=()=>{delete c.types[k];c.crews.forEach(x=>x.days=x.days.map(d=>d===k?null:d));re();};});
  q('#dzAddType').onclick=()=>{let i=1,k;do k=String.fromCharCode(64+i++);while(c.types[k]&&i<27);if(c.types[k])k='S'+Date.now()%1000;c.types[k]=Detect.fillName(k,{name:'',start:'',hours:'',kind:'day'});re();};
  qa('.dzcrew').forEach(row=>{const i=+row.dataset.crew;const x=c.crews[i];row.querySelector('.dzcname').onchange=e=>{const old=x.name;x.name=e.target.value.trim();if(D.me===old)D.me=x.name;re();};
    row.querySelector('.dzpat').onchange=e=>{const p=parsePat(e.target.value);if(p.length&&p.length!==c.L&&c.crews.length===1)setL(p.length);x.days=Array.from({length:c.L},(_,j)=>p[j]??null);re();};
    row.querySelector('.dzcrm').onclick=()=>{c.crews.splice(i,1);re();};});
  q('#dzAddCrew').onclick=()=>{c.crews.push({name:'',days:Array(c.L).fill(null)});re();};
  q('#dzGen').onclick=()=>{try{const code=q('#dzRunCode').value;if(!code)throw new Error('Add a shift type first');const base=Detect.fromRuns(q('#dzRuns').value,code);setL(base.length);
      const n=c.crews.length;const sv=q('#dzStag').value;const stg=sv===''?(base.length%n===0?base.length/n:0):+sv;c.crews.forEach((x,i)=>{x.days=base.map((_,j)=>base[((j-i*stg)%base.length+base.length)%base.length]);});D.msg='';re();}catch(e){D.msg=e.message;re();}};
  q('#dzMe').onchange=e=>{D.me=e.target.value;soft();};q('#dzMonths').onchange=e=>{c.months=+e.target.value;soft();};
  q('#dzSave').onclick=async()=>{const rot=rotation();if(D.report)rot.imported=false;const me=(c.crews.find(x=>x.name===D.me)||c.crews[0]).name;
    await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({rotation:rot,crew:me})});await load();
    if(ob()){localStorage.setItem('pc_ob_sched','design');localStorage.setItem('pc_ob_crew',me);Onboard.setMonths(+c.months||12);st.tab='cal';}else{st.tab='cal';const t=c.start;st.month=[+t.slice(0,4),+t.slice(5,7)-1];}D=null;window.render();window.scrollTo(0,0);};}
// text read from a screenshot/photo (OCR) that turned out to be a table schedule, not the printed crew calendar
function fromText(t){open('detect');detect(t);return !!D.cfg;}
return{open,render,fromText,_D:()=>D};})();

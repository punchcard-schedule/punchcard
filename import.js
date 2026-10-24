const VND=p=>new URL('vendor/'+p,document.baseURI).href;
// "Import your plant's rotation": screenshots/photos (recommended) or PDF, processed entirely on this phone
// (canvas image processing + Tesseract OCR loaded on demand from this server). Plus "Holidays from my contract" year view.
const Import=(()=>{
let S=null;let worker=null;
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const nice=d=>new Date(Rot.parseD(d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const loadScript=src=>new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s);});
async function getOcr(progress){if(!worker){progress('Loading the text reader (first time only, about 3 MB)…');await loadScript(VND('tesseract/tesseract.min.js'));
    worker=await Tesseract.createWorker('eng',1,{workerPath:VND('tesseract/worker.min.js'),corePath:VND('tesseract-core'),langPath:VND('tessdata'),gzip:true});}
  const cv=document.createElement('canvas');const cx=cv.getContext('2d');let n=0;
  return async(img,o)=>{n++;cv.width=img.width;cv.height=img.height;cx.putImageData(new ImageData(img.data,img.width,img.height),0,0);
    await worker.setParameters({tessedit_pageseg_mode:({char:'10',line:'7',sparse:'11',block:'6'})[o.mode]||'7',tessedit_char_whitelist:o.chars||''});const r=await worker.recognize(cv);return{text:r.data.text,conf:r.data.confidence};};}
function toData(src,w,h){const max=3000;const k=Math.min(1,max/Math.max(w,h));const cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(src,0,0,cv.width,cv.height);return cx.getImageData(0,0,cv.width,cv.height);}
// iPhone/Safari: files may come without a MIME type (or as HEIC); sniff the first bytes instead of trusting f.type
async function kind(f){const n=(f.name||'').toLowerCase();try{const b=new Uint8Array(await f.slice(0,16).arrayBuffer());const t=String.fromCharCode.apply(null,Array.prototype.slice.call(b));
    if(t.startsWith('%PDF'))return'pdf';if(/ftyp(heic|heix|hevc|mif1|msf1|heim|heis)/.test(t))return'heic';if(b[0]===0xFF&&b[1]===0xD8||b[0]===0x89&&t.slice(1,4)==='PNG'||t.startsWith('GIF8')||t.slice(8,12)==='WEBP')return'image';}catch(e){}
  if(/pdf/.test(f.type)||/\.pdf$/.test(n))return'pdf';if(/hei[cf]/.test(f.type)||/\.hei[cf]$/.test(n))return'heic';if(/^image\//.test(f.type)||/\.(png|jpe?g|gif|webp|bmp)$/.test(n))return'image';return'other';}
async function bitmap(f,k){try{return await createImageBitmap(f);}catch(e){
    // fallback: <img> decode (Safari decodes HEIC this way even where createImageBitmap(blob) fails)
    try{const u=URL.createObjectURL(f);const im=new Image();await new Promise((ok,no)=>{im.onload=ok;im.onerror=()=>no(new Error('decode'));im.src=u;});URL.revokeObjectURL(u);return im;}
    catch(e2){const x=new Error(k==='heic'?'HEIC':'DECODE');x.friendly=k==='heic'?`“${f.name}” is an iPhone HEIC photo this browser can't open. Please use screenshots (they are PNG), or set Settings › Camera › Formats › Most Compatible.`:`“${f.name}” couldn't be opened as an image. Please use screenshots (PNG/JPEG) or a PDF.`;throw x;}}}
async function images(files,progress){const out=[];files=Array.prototype.slice.call(files||[]);for(const f of files){const k=await kind(f);if(k==='other'){const x=new Error('type');x.friendly=`“${f.name}” isn't a picture or a PDF. Choose screenshots, photos or a PDF of your printed calendar.`;throw x;}
  if(k==='pdf'){progress('Opening PDF…');const pdfjs=await import(VND('pdfjs/pdf.min.mjs'));pdfjs.GlobalWorkerOptions.workerSrc=VND('pdfjs/pdf.worker.min.mjs');
    const doc=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise;for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);
      // vector first: a text-based PDF has the dates/AM/PM as text and holidays as black filled boxes - exact, no OCR needed
      try{const prev=out.filter(o=>o.vector).slice(-1)[0];const r=RotImport.analyzeVector(await RotImport.pdfVector(pg,pdfjs.OPS),{year:+today().slice(0,4),prevEnd:prev&&prev.res.lastDate});if(r.tables.length){out.push({name:`${f.name} p${p}`,vector:1,res:r});continue;}}catch(e){console.warn('vector read failed, using OCR',e);}const v0=pg.getViewport({scale:1});const v=pg.getViewport({scale:Math.min(4,1800/v0.width)});
      const cv=document.createElement('canvas');cv.width=v.width;cv.height=v.height;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:cx,viewport:v}).promise;out.push({name:`${f.name} p${p}`,data:cx.getImageData(0,0,cv.width,cv.height)});}}
  else{const bm=await bitmap(f,k);out.push({name:f.name,data:toData(bm,bm.width,bm.height)});}}return out;}
function open(){S={step:'start',fixes:{},hol:{},name:'',crew:null,results:[],msg:''};st.tab='import';render();window.scrollTo(0,0);}
async function run(files){S.step='busy';S.msg='Reading images…';draw();const prog=m=>{S.msg=m;const e=$('#impProg');if(e)e.textContent=m;};
  try{const ims=await images(files,prog);const ocr=ims.some(x=>!x.vector)?await getOcr(prog):null;const yr=+today().slice(0,4);
    const vec=ims.filter(x=>x.vector);vec.forEach(x=>{x.res.name=x.name;S.results.push(x.res);});const ras=ims.filter(x=>!x.vector);
    if(vec.length)prog(`Read ${vec.length} PDF page${vec.length>1?'s':''} directly (text + black holiday boxes)…`);
    for(let i=0;i<ras.length;i++){prog(`Reading image ${i+1} of ${ras.length}: finding the grid, dates and AM/PM cells…`);const r=await RotImport.analyze(ras[i].data,ocr,{year:yr});r.name=ras[i].name;S.results.push(r);}
    S.files=(S.files||0)+ims.length;S.vector=vec.length;recompute();if(S.comb.error&&ras.length&&typeof Design!=='undefined'&&window.Detect){ // not the printed crew-calendar layout: read it as a ruled table (date rows, crew columns, legend above)
      let t='';for(let i=0;i<ras.length;i++){prog(`Reading image ${i+1} of ${ras.length} as a table…`);t+=await tableOcr(ras[i].data,ocr,prog)+'\n';}
      let ok=false;try{ok=Detect.parse(t,{year:yr}).report.crews>0;}catch(e){console.info('table read failed:',e.message);}if(ok&&Design.fromText(t))return;}
    if(S.comb.error){S.step='start';S.msg=S.comb.error+'. Try straighter, zoomed-in screenshots that show the date row and the crew letters.';return draw();}
    S.comb.holidays.forEach(d=>{if(!(d in S.hol))S.hol[d]=true;});S.step='review';draw();}
  catch(e){console.error(e);S.step='start';S.msg=e.friendly||(/password|Invalid PDF|InvalidPDF/i.test(e.message)?'This PDF couldn\'t be opened (it may be damaged or password-protected). Try screenshots of the calendar instead.':/memory|allocation|too large/i.test(e.message)?'This file is too large to read on this phone. Try fewer pages or screenshots of a few months.':'Couldn\'t read this file. Try straight, zoomed-in screenshots of your printed calendar (date row and crew letters visible), or a PDF.');draw();}}
// Ruled table screenshot (one row per date, crews as columns): find the rule lines, OCR each cell on its own (whole-page OCR merges
// narrow cells), text above the table = title + legend (D = 06:00-18:00). Returns tab-separated text for Detect.parse.
function ruleLines(img){const W=img.width,H=img.height,d=img.data;const dk=(x,y)=>{const i=(y*W+x)*4;return d[i]+d[i+1]+d[i+2]<384;};const rr=[],cr=[];
  for(let y=0;y<H;y++){let b=0,c=0;for(let x=0;x<W;x++){if(dk(x,y)){if(++c>b)b=c;}else c=0;}rr.push(b);}
  for(let x=0;x<W;x++){let b=0,c=0;for(let y=0;y<H;y++){if(dk(x,y)){if(++c>b)b=c;}else c=0;}cr.push(b);}
  const grp=a=>{const g=[];for(const v of a){const l=g[g.length-1];if(l&&v-l[1]<=3)l[1]=v;else g.push([v,v]);}return g;};const mr=Math.max(...rr),mc=Math.max(...cr);
  return{R:grp(rr.map((b,y)=>b>=Math.max(60,mr*0.6)?y:-1).filter(y=>y>=0)),C:grp(cr.map((b,x)=>b>=Math.max(60,mc*0.6)?x:-1).filter(x=>x>=0))};}
function cropImg(img,x0,y0,x1,y1){const w=Math.max(1,x1-x0),h=Math.max(1,y1-y0),P=10,o=new Uint8ClampedArray((w+2*P)*(h+2*P)*4).fill(255);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const s=((y0+y)*img.width+x0+x)*4,t=((y+P)*(w+2*P)+x+P)*4;o[t]=img.data[s];o[t+1]=img.data[s+1];o[t+2]=img.data[s+2];o[t+3]=255;}return{width:w+2*P,height:h+2*P,data:o};}
async function tableOcr(img,ocr,prog){const {R,C}=ruleLines(img);if(R.length<3||C.length<3)return(await ocr(img,{mode:'block'})).text;
  const head=R[0][0]>8?(await ocr(cropImg(img,0,0,img.width,R[0][0]-2),{mode:'block'})).text:'';const out=[];
  for(let i=0;i+1<R.length;i++){if(i%10===0&&prog)prog(`Reading table row ${i+1} of ${R.length-1}…`);const cells=[];
    for(let j=0;j+1<C.length;j++){const cr=cropImg(img,C[j][1]+2,R[i][1]+2,C[j+1][0]-1,R[i+1][0]-1);let v=(await ocr(cr,{mode:'line'})).text.trim();
      if(i===0&&j>0&&v.length<=3){const c=(await ocr(cr,{mode:'char'})).text.trim();if(/^[A-Z0-9]$/.test(c))v=c;else if(/^[A-Za-z]{2}$/.test(v)&&v[0].toUpperCase()===v[1].toUpperCase())v=v[0].toUpperCase();}
      cells.push(v||'OFF');}out.push(cells.join('\t'));}
  return head+'\n'+out.join('\n');}
const recompute=()=>{S.comb=RotImport.combine(S.results,S.fixes);};
const tips=`<ul class="tips"><li><b>Screenshots work best.</b> Zoom in so one or two weeks fill the screen width, then take several screenshots. You can pick them all at once.</li>
  <li>Keep the page <b>straight</b> (not tilted) and include the <b>date row</b> (e.g. "4-Oct") and the <b>crew letters</b> (A B C D) on the left.</li>
  <li>Avoid thumbnails, blurry photos, and phone controls (page counter, toolbars) covering the grid; scroll so they sit outside the calendar.</li>
  <li>Cover at least <b>two full cycles</b> (about 5 weeks for a 16-day rotation) so Punch Card can find the repeat.</li>
  <li>Black date boxes are read as <b>holidays</b> (your plant prints holidays filled in black).</li></ul>`;
function holName(d){const id=Hol.match(d);return id?Hol.LIST.find(h=>h.id===id).name:'Plant holiday';}
// One crew as month grids (header per month, like Step 4). Starts at today's month when the file covers today; "Show earlier months" reveals the rest.
function firstShown(c){const t=today();return (!S.early&&t>=c.start&&t<=c.end)?t.slice(0,8)+'01':c.start.slice(0,8)+'01';}
function mini(cr){const c=S.comb;const iss=new Set(c.issues.filter(i=>i.crew===cr).map(i=>i.date));const s0=Rot.parseD(c.start);const t0=today();
  let h='<div class="mini">';let y=+firstShown(c).slice(0,4),m=+firstShown(c).slice(5,7)-1;const ey=+c.end.slice(0,4),em=+c.end.slice(5,7)-1;
  for(;y<ey||(y===ey&&m<=em);m===11?(m=0,y++):m++){const f=Rot.fmt(Date.UTC(y,m,1)),nd=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    h+=`<h4 class="mmon">${MON[m]} ${y}</h4><div class="mh">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="mg">`+'<span></span>'.repeat(new Date(Rot.parseD(f)).getUTCDay());
    for(let dd=1;dd<=nd;dd++){const t=Date.UTC(y,m,dd);const d=Rot.fmt(t);if(d<c.start||d>c.end){h+=`<span class="mout">${dd}</span>`;continue;}const i=Math.round((t-s0)/Rot.DAY);const ch=c.patterns[cr][i%c.cycleLength];const k=cr+'|'+d;const cell=c.cells[k];
      const v=cell&&cell.v!=null&&!iss.has(d)?cell.v:(ch==='a'?'AM':ch==='p'?'PM':'.');const cls=v==='AM'?'AM':v==='PM'?'PM':'off';
      h+=`<button class="mc ${cls} ${iss.has(d)?'iss':''} ${cell&&cell.fixed?'fixed':''} ${c.holidays.includes(d)?'mhol':''} ${d===t0?'today':''}" data-k="${k}" title="${cr} ${nice(d)}: ${v==='.'?'Off':v}${iss.has(d)?' (check)':''}">${dd}${iss.has(d)?'<i>?</i>':''}</button>`;}
    h+='</div>';}
  return h+'</div>';}
const earlierBtn=()=>{const c=S.comb;const t=today();return t>=c.start&&t<=c.end&&t.slice(0,7)>c.start.slice(0,7)?`<button class="btn sec small" id="impEarlier">${S.early?'Hide earlier months':'Show earlier months'}</button>`:'';};
function draw(){const main=$('main');if(!S)return open();
  if(S.step==='start'||S.step==='busy'){main.innerHTML=`<div class="card" id="impCard"><div class="shead"><button class="btn sec small" id="impBack">← Setup</button><span></span></div>
    <h3>Import your plant's rotation</h3><p class="muted">Everything runs on this phone. Nothing is uploaded or sent to any AI service.</p>${tips}
    ${S.step==='busy'?`<p class="busy"><span class="spin"></span> <span id="impProg">${esc(S.msg)}</span></p>`:`
    <label class="btn big" for="impImg">📸 Choose screenshots / photos <span class="rec">Recommended</span></label><input type="file" id="impImg" accept="image/*" multiple hidden>
    <label class="btn sec" for="impPdf">📄 Use a PDF instead</label><input type="file" id="impPdf" accept="application/pdf,.pdf" hidden>
    <button class="btn sec" id="impBuild">✏️ Build my own on a calendar</button>${S.msg?`<p class="warn" id="impMsg">${esc(S.msg)}</p>`:''}`}</div>`;
    $('#impBack').onclick=()=>{st.tab='setup';render();};if(S.step==='busy')return;
    $('#impImg').onchange=e=>e.target.files.length&&run([...e.target.files]);$('#impPdf').onchange=e=>e.target.files.length&&run([...e.target.files]);$('#impBuild').onclick=()=>Builder.open();return;}
  const c=S.comb;
  if(S.step==='done'){main.innerHTML=`<div class="card" id="impDone"><h3>✔ Saved “${esc(S.saved.name)}”</h3><p>You're on <b>${esc(S.saved.crew)}</b>, ${c.cycleLength}-day cycle repeating from ${nice(c.start)}.${S.saved.hol?` ${S.saved.hol} holiday${S.saved.hol>1?'s':''} turned on.`:''}</p>
    <button class="btn" id="impCal">See my calendar</button><button class="btn sec" id="impEdit">Fine-tune in the builder</button><button class="btn sec" id="impAgain">Import again</button></div>`;
    $('#impCal').onclick=()=>{st.tab='cal';render();};$('#impEdit').onclick=()=>Builder.open(Rot.cycleOf(st.s.rotation,st.s.crew),'');$('#impAgain').onclick=open;return;}
  const pct=Math.round(c.confidence*100);const rot=RotImport.toRotation(c,S.name);const opts=Rot.crewListRaw(rot);if(!S.crew||!opts.includes(S.crew))S.crew=opts.includes(st.s.crew)?st.s.crew:opts[0];
  const hidden=c.issues.filter(i=>/hidden/.test(i.why)).length,check=c.issues.length-hidden;
  main.innerHTML=`<div class="card" id="impReview"><div class="shead"><button class="btn sec small" id="impBack">← Start over</button><span></span></div><h3>Check what was read</h3>
   <div class="conf ${c.level.toLowerCase()}"><div class="cbar"><span style="width:${pct}%"></span></div><b>${c.level} confidence · ${pct}%</b>
   <small>${c.cycleLength}-day cycle · crews ${c.crews.join(', ')} · ${c.days} days read (${nice(c.start)} – ${nice(c.end)}) from ${S.results.length} image${S.results.length>1?'s':''} · ${(c.agreement*100).toFixed(1)}% of readable cells match the repeating cycle${check?` · ${check} cell${check>1?'s':''} to check`:''}${hidden?` · ${hidden} hidden by phone controls (filled from the cycle)`:''}</small></div>
   <p class="muted">Tap any day to change it (AM → PM → Off). Cells marked <span class="mc iss demo">?</span> couldn't be read or don't match the cycle.</p>
   ${earlierBtn()}${c.crews.map(cr=>`<h4 class="mcrew">Crew ${cr} <small class="muted">${c.patterns[cr].replace(/\./g,'·').replace(/a/g,'A').replace(/p/g,'P')}</small></h4>${mini(cr)}`).join('')}
   ${ob()?(c.holidays.length?`<p class="muted" id="impHolLater">${c.holidays.length} holiday${c.holidays.length>1?'s':''} found. You'll choose holidays in one step after you check your calendar.</p>`:''):`<h4>Holidays found (black date boxes)</h4>${c.holidays.length?`<div class="hollist">${c.holidays.map(d=>`<label class="holrow"><input type="checkbox" data-ih="${d}" ${S.hol[d]?'checked':''}><span>${esc(holName(d))}</span><small>${nice(d)}</small></label>`).join('')}</div>`:'<p class="muted">None detected. You can mark them yourself under Setup → Holidays.</p>'}`}
   <h4>Save</h4><label for="impName">Name this rotation</label><input type="text" id="impName" maxlength="60" placeholder="Imported schedule – ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}" value="${esc(S.name)}">
   <label for="impCrew">My crew</label><select id="impCrew">${opts.map(o=>`<option ${o===S.crew?'selected':''}>${esc(o)}</option>`).join('')}</select>
   ${ob()?'':`<label class="chk"><input type="checkbox" id="impHolOn" ${c.holidays.length?'checked':''} ${c.holidays.length?'':'disabled'}> Turn on the checked holidays</label>`}
   <button class="btn" id="impApply">Apply</button><small class="muted">You can still edit it later in the calendar builder.</small></div>`;
  $('#impBack').onclick=open;$('#impName').oninput=e=>S.name=e.target.value;$('#impCrew').onchange=e=>S.crew=e.target.value;
  main.querySelectorAll('[data-ih]').forEach(x=>x.onchange=()=>S.hol[x.dataset.ih]=x.checked);
  main.querySelectorAll('#impEarlier').forEach(b=>b.onclick=()=>{S.early=!S.early;const y=window.scrollY;draw();window.scrollTo(0,y);});main.querySelectorAll('.mc[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k;const cur=b.classList.contains('AM')?'AM':b.classList.contains('PM')?'PM':'.';S.fixes[k]=cur==='AM'?'PM':cur==='PM'?'.':'AM';const y=window.scrollY;recompute();draw();window.scrollTo(0,y);});
  $('#impApply').onclick=apply;}
// during first-run setup holidays are chosen once, in the Holidays step (after the calendar is checked)
const ob=()=>!!(st.s&&st.s.settings&&st.s.settings.onboarded===false);
async function apply(){const c=S.comb;const rot=RotImport.toRotation(c,S.name);const crew=S.crew;try{localStorage.setItem('pc_ob_crew',crew);}catch(e){}const set={...st.s.settings};let n=0;
  if(ob()){try{localStorage.setItem('pc_ob_hol',JSON.stringify(c.holidays));}catch(e){}}
  else if($('#impHolOn')&&$('#impHolOn').checked){const ids=new Set(set.holidays||[]);const cus=[...(set.customHolidays||[])];for(const d of c.holidays.filter(d=>S.hol[d])){n++;const id=Hol.match(d);if(id)ids.add(id);else cus.push({d,n:'Plant holiday'});}set.holidays=[...ids];set.customHolidays=cus;}
  await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({rotation:rot,crew,settings:set})});await load();S.saved={name:st.s.rotation.label||rot.label,crew,hol:n};S.step='done';draw();window.scrollTo(0,0);}
return{open,render:draw,_state:()=>S,_run:run};})();

// Holidays from my contract: tap dates on a year view
const HolYear=(()=>{let Y=null;
function open(){Y=+today().slice(0,4);st.tab='holyear';render();window.scrollTo(0,0);}
function draw(){const main=$('main');const cus=st.s.settings.customHolidays||[];const set=new Set(cus.map(c=>c.d));const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h=`<div class="card" id="hyCard"><div class="shead"><button class="btn sec small" id="hyBack">← Setup</button><span></span></div><h3>Holidays from my contract</h3><p class="muted">Tap the dates your contract gives as holidays. Labels only: shifts don't change. ${cus.length} marked.</p>
   <div class="yhead"><button class="btn sec small" id="hyPrev">‹ ${Y-1}</button><b>${Y}</b><button class="btn sec small" id="hyNext">${Y+1} ›</button></div><div class="year">`;
  for(let m=0;m<12;m++){const f=new Date(Date.UTC(Y,m,1)).getUTCDay(),n=new Date(Date.UTC(Y,m+1,0)).getUTCDate();h+=`<div class="ym"><b>${names[m]}</b><div class="yg">${'<span></span>'.repeat(f)}`;
    for(let d=1;d<=n;d++){const iso=`${Y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const b=Hol.on(iso,st.s.settings.holidays);h+=`<button class="yd ${set.has(iso)?'on':''} ${b?'bi':''}" data-yd="${iso}" title="${b?esc(b.name):''}">${d}</button>`;}h+='</div></div>';}
  main.innerHTML=h+`</div><small id="hyMsg"></small>${cus.length?`<h4>Marked</h4><ul class="hylist">${cus.map(c=>`<li>${new Date(Rot.parseD(c.d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})} · ${esc(c.n)}</li>`).join('')}</ul>`:''}</div>`;
  $('#hyBack').onclick=()=>{st.tab='setup';render();};$('#hyPrev').onclick=()=>{Y--;draw();};$('#hyNext').onclick=()=>{Y++;draw();};
  main.querySelectorAll('[data-yd]').forEach(b=>b.onclick=async()=>{const d=b.dataset.yd;const now=st.s.settings.customHolidays||[];const nx=now.some(c=>c.d===d)?now.filter(c=>c.d!==d):now.concat([{d,n:'Contract holiday'}]);
    b.classList.toggle('on');await api('/api/schedules/'+st.id,{method:'PATCH',body:JSON.stringify({settings:{...st.s.settings,customHolidays:nx}})});await load();draw();$('#hyMsg').textContent='Saved ✔';});}
return{open,render:draw};})();

// Shared schedule engine (browser + node). Pattern strings: 'a'=AM, 'p'=PM, '.'=off
(function(root){
const DAY=86400000;
function parseD(s){const[y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d);}
function fmt(t){return new Date(t).toISOString().slice(0,10);}
// combined/straight-shift options (e.g. 'A/B Days', 'C/D Nights') are listed after single crews; relative order otherwise kept
const isCombo=c=>/\//.test(c)||/\b(Days|Nights)$/i.test(c);
function crewList(rot){const l=crewListRaw(rot);return l.filter(c=>!isCombo(c)).concat(l.filter(isCombo));}
function crewListRaw(rot){if(rot.extra){const e=Object.keys(rot.extra);return e.concat(Object.keys(rot.crews).filter(c=>!e.includes(c)));}const c=Object.keys(rot.crews);const v=[];
  for(const [x,y] of [['A','B'],['C','D']]) if(rot.crews[x]&&rot.crews[y]){v.push(x+'/'+y+' Days',x+'/'+y+' Nights');}
  return c.concat(v);}
// base shift for crew on date (ISO string) -> 'AM'|'PM'|null
// 'My job gives holidays off': a selected holiday on its OBSERVED date (rule-based: Sat->Fri, Sun->Mon; custom dates exactly) is a day off,
// unless kept as a working day (settings.holidaysWork: ids or 'c:YYYY-MM-DD'). Manual overrides (OT, swap, vacation...) always win.
function holidayOff(date,st){const H=root.Hol;if(!st||!st.holidaysOff||!H)return null;const work=st.holidaysWork||[];
  const c=(st.customHolidays||[]).find(x=>x.d===date);if(c&&!work.includes('c:'+date))return{name:c.n||'Contract holiday',key:'c:'+date};
  const y=+date.slice(0,4);for(const yy of [y,y+1])for(const h of H.forYear(yy,st.holidays||[]))if((h.observed||h.date)===date&&!work.includes(h.id))return{name:h.name+(h.observed?' (observed)':''),key:h.id};return null;}
function idxIn(start,len,date){return((Math.round((parseD(date)-parseD(start))/DAY)%len)+len)%len;}
function verified(rot,crew){if(rot.extra&&rot.extra[crew])return !!rot.extra[crew].verified;return !rot.reconstructed;}
function baseShift(rot,crew,date){
  if(rot.until&&date>rot.until)return null; // custom schedule replicated only for the length the user chose
  if(rot.extra&&rot.extra[crew]){const e=rot.extra[crew];if(rot.generic&&e.days){const x=e.days[idxIn(e.start,e.days.length,date)];return x&&x.s||null;}const ch=e.pattern[idxIn(e.start,e.pattern.length,date)];return ch==='a'?'AM':ch==='p'?'PM':null;}
  const i=((Math.round((parseD(date)-parseD(rot.cycleStart))/DAY)%rot.cycleLength)+rot.cycleLength)%rot.cycleLength;
  const m=crew.match(/^(\w)\/(\w) (Days|Nights)$/);
  if(m){const want=m[3]==='Days'?'a':'p';return (rot.crews[m[1]][i]===want||rot.crews[m[2]][i]===want)?(want==='a'?'AM':'PM'):null;}
  const ch=rot.crews[crew][i];return ch==='a'?'AM':ch==='p'?'PM':null;}
// effective day incl override: {date, base, shift, hours, kind}
function day(rot,crew,date,ov,st){
  const base=baseShift(rot,crew,date);const o=ov&&ov[date];
  const r={date,base,shift:base,kind:base?'work':'off',hours:base?12:0};
  const e=rot.extra&&rot.extra[crew];if(base&&e&&e.days){const x=e.days[idxIn(e.start,e.days.length,date)]||{};r.hours=Number(x.h)||12;if(x.t)r.start=x.t;}
  if(base&&rot.generic){const T=(rot.shiftTypes||{})[base]||{};r.cls=T.kind==='night'?'PM':T.kind==='swing'?'SW':'AM';r.std=1;if(!r.start&&T.start)r.start=T.start;if(!(e&&e.days)&&T.hours)r.hours=+T.hours;}
  if(base&&st&&!rot.generic){if(+st.shiftHours>0&&r.hours===12)r.hours=+st.shiftHours;const ss=st.shiftStarts&&st.shiftStarts[base];if(!r.start&&ss&&/^\d\d:\d\d$/.test(ss)&&!(rot.shiftTimes&&rot.shiftTimes[base]&&rot.shiftTimes[base][0]===ss)){r.start=ss;r.std=1;}}
  if(!o){const h=holidayOff(date,st);if(h&&base){r.shift=null;r.kind='hol-off';r.hours=0;r.holiday=h.name;r.note=h.name;}return r;}
  if(o.type==='vacation'){r.shift=null;r.kind='vacation';r.hours=0;}
  else if(o.type==='off'){r.shift=null;r.kind='off-ovr';r.hours=0;}
  else if(o.type==='swap'){r.shift=o.shift;r.kind='swap';r.hours=Number(o.hours)||12;}
  else if(o.type==='ot'){r.shift=o.shift;r.kind='ot';r.hours=Number(o.hours)||12;}
  r.note=o.note||'';r.job=o.job||'';if(o.swapTo)r.swapTo=o.swapTo;if(o.swapFrom)r.swapFrom=o.swapFrom;return r;}
// Job helpers: '@main' = the user's own job title (relabels with the setting)
function jobOptions(settings){const st=settings||{};return[{id:'@main',label:st.jobTitle||'Crane'}].concat((st.jobs||['Utility','Crane Safety']).map(j=>({id:j,label:j})));}
function jobLabel(job,settings){if(!job)return'';return job==='@main'?((settings&&settings.jobTitle)||'Crane'):job;}
// Human label for a day, e.g. 'OT AM 12h · Utility'
function dayLabel(d,settings){const j=jobLabel(d.job,settings);const base=d.kind==='hol-off'?`Off · ${d.holiday}`:d.kind==='vacation'?'Vacation':d.kind==='off-ovr'?'Off':d.kind==='ot'?`OT ${d.shift} ${d.hours}h`:d.kind==='swap'?`Swap ${d.shift} ${d.hours}h`:d.shift?`${d.shift} ${d.hours}h`:'Off';const sd=x=>new Date(parseD(x)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});const sw=d.swapTo?` · swapped to ${sd(d.swapTo)}`:d.swapFrom?` · swapped from ${sd(d.swapFrom)}`:'';return (j?`${base} · ${j}`:base)+sw;}
function range(rot,crew,from,n,ov,st){const out=[];let t=parseD(from);for(let k=0;k<n;k++,t+=DAY)out.push(day(rot,crew,fmt(t),ov,st));return out;}
// shift start/end as local wall-clock strings
function times(rot,d){if(!d.shift)return null;const T=rot.shiftTypes&&rot.shiftTypes[d.shift];const s=(d.kind==='work'&&d.start)||(T&&T.start)||(rot.shiftTimes[d.shift]||rot.shiftTimes.AM||['06:00'])[0];
  const [h,m]=s.split(':').map(Number);const startMin=h*60+m;const endMin=startMin+d.hours*60;
  const st=parseD(d.date)+startMin*60000, en=parseD(d.date)+endMin*60000;
  const iso=t=>new Date(t).toISOString().slice(0,16);return{start:iso(st),end:iso(en)};}
function rotationFromTemplate(t,variant){return{extra:t.extra,name:t.name,cycleStart:t.cycleStart,cycleLength:t.cycleLength,shiftTimes:t.shiftTimes,crews:t.variants[variant||t.defaultVariant],variant:variant||t.defaultVariant,reconstructed:!!t.reconstructed};}
// Build rotation from simple per-crew sequences: {A:'AM AM OFF ...'} (cycle length = seq length)
function fromBuilder(start,seqs,shiftTimes){const crews={};let L=0;
  for(const[c,s] of Object.entries(seqs)){const t=s.trim().split(/[\s,]+/).map(x=>/^a/i.test(x)?'a':/^p/i.test(x)?'p':'.');crews[c]=t.join('');L=Math.max(L,t.length);}
  for(const c in crews)crews[c]=crews[c].padEnd(L,'.');
  return{name:'Custom rotation',cycleStart:start,cycleLength:L,shiftTimes:shiftTimes||{AM:['06:00','18:00'],PM:['18:00','06:00']},crews};}
// N on / N off from a start date (day 1 of work). Creates 'My schedule' and its complement.
function onOff(start,on,off,shift,shiftTimes){const c=shift==='PM'?'p':'a';const pat=c.repeat(on)+'.'.repeat(off);const comp='.'.repeat(on)+c.repeat(off);
  return{name:`${on} on / ${off} off`,cycleStart:start,cycleLength:on+off,shiftTimes:shiftTimes||{AM:['06:00','18:00'],PM:['18:00','06:00']},crews:{},
    extra:{'My schedule':{start,pattern:pat,verified:true},'Opposite crew':{start,pattern:comp,verified:true}}};}
// ---- Calendar pattern builder helpers. A cycle is a list of {s:'AM'|'PM'|null, h:8|12|16, t:'HH:MM'|undefined}
function cycleName(rot,crew){return rot&&rot.custom&&rot.label&&!rot.imported?rot.label:crew;}
function defaultName(len){return len%7===0&&len>=14?`Custom ${len/7}-week cycle`:`Custom ${len}-day cycle`;}
// marks: {date:{s,h,t}}; start required; end optional (else last marked day). Unmarked days inside the cycle are Off.
function cycleFromMarks(marks,start,end){const ds=Object.keys(marks).filter(d=>d>=start).sort();const last=end||(ds.length?ds[ds.length-1]:start);
  const L=Math.round((parseD(last)-parseD(start))/DAY)+1;if(L<1)return[];const out=[];for(let k=0;k<L;k++){const m=marks[fmt(parseD(start)+k*DAY)];out.push(m&&m.s?{s:m.s,h:Number(m.h)||12,...(m.t?{t:m.t}:{})}:{s:null});}return out;}
function fromCalendar(start,days,name,shiftTimes){if(!days.length)throw new Error('Mark at least one day');const pat=days.map(d=>d.s==='AM'?'a':d.s==='PM'?'p':'.').join('');
  const label=String(name||'').trim().slice(0,60)||defaultName(days.length);
  return{name:label,label,custom:true,cycleStart:start,cycleLength:days.length,shiftTimes:shiftTimes||{AM:['06:00','18:00'],PM:['18:00','06:00']},crews:{},
    extra:{'My schedule':{start,pattern:pat,days:days.map(d=>d.s?{s:d.s,h:Number(d.h)||12,...(d.t?{t:d.t}:{})}:{s:null}),verified:true}}};}
// One cycle of an existing rotation/crew as builder days (so built-in patterns can be edited)
function cycleOf(rot,crew,from){const e=rot.extra&&rot.extra[crew];const L=e?(e.days||e.pattern).length:rot.cycleLength;const start=from||(e?e.start:rot.cycleStart);
  return{start,days:range(rot,crew,start,L).map(d=>d.base?{s:d.base,h:d.hours,...(d.start?{t:d.start}:{})}:{s:null})};}
// Plant rule: a PM (night) shift counts toward the NEXT day by default (settings.nightCounts 'next'|'start').
// ---- Format-agnostic rotations. cfg={name,start,L,types:{CODE:{name,start:'HH:MM',hours,kind:'day'|'swing'|'night'}},crews:[{name,days:[CODE|null,...L]}],until}
// Any number of crews, any shift codes/times/lengths, any cycle length. Stored as rotation.extra[crew].days (one entry per cycle day).
function makeGeneric(cfg){const L=+cfg.L;if(!(L>=1&&L<=400))throw new Error('Cycle length must be 1-400 days');const types=cfg.types||{};const crews=(cfg.crews||[]).filter(c=>c&&String(c.name||'').trim());
  if(!crews.length)throw new Error('Add at least one crew');const extra={};const ch=k=>((types[k]||{}).kind==='night'?'p':'a');
  for(const c of crews){const nm=String(c.name).trim().slice(0,40);const days=[];for(let i=0;i<L;i++){const k=c.days[i]||null;const T=types[k];days.push(k?{s:k,h:Number(T&&T.hours)||8,...(T&&T.start?{t:T.start}:{})}:{s:null});}
    extra[nm]={start:cfg.start,pattern:days.map(d=>d.s?ch(d.s):'.').join(''),days,verified:true};}
  const first=kind=>Object.entries(types).find(([k,v])=>v.kind===kind);const end=(T)=>{const[h,m]=(T.start||'06:00').split(':').map(Number);const e=(h*60+m+(+T.hours||8)*60)%1440;return String(e/60|0).padStart(2,'0')+':'+String(e%60).padStart(2,'0');};
  const shiftTimes={};for(const[k,T]of Object.entries(types))shiftTimes[k]=[T.start||'06:00',end(T)];const d=first('day')||first('swing')||Object.entries(types)[0],n=first('night');
  shiftTimes.AM=shiftTimes.AM||(d?shiftTimes[d[0]]:['06:00','18:00']);shiftTimes.PM=shiftTimes.PM||(n?shiftTimes[n[0]]:['18:00','06:00']);
  const label=String(cfg.name||'').trim().slice(0,60)||defaultName(L);
  const r={generic:true,custom:true,name:label,label,cycleStart:cfg.start,cycleLength:L,shiftTypes:types,shiftTimes,crews:{},extra};if(cfg.until)r.until=cfg.until;if(cfg.months)r.months=+cfg.months;if(cfg.source)r.source=cfg.source;return r;}
// Back to an editable config (for the preview/correction screen)
function toConfig(rot){const ex=rot.extra||{};const crews=Object.keys(ex).map(n=>{const e=ex[n];const L=rot.cycleLength;const out=[];for(let i=0;i<L;i++){const dt=fmt(parseD(rot.cycleStart)+i*DAY);out.push(baseShift({...rot,until:null},n,dt));}return{name:n,days:out};});
  return{name:rot.label||rot.name,start:rot.cycleStart,L:rot.cycleLength,types:rot.shiftTypes||{},crews,months:rot.months||12};}
// '2 on, 2 off, 3 on…' run-length text for one crew's cycle; short form '2-2-3' style
function describe(days){const runs=[];for(const d of days){const on=!!d;const l=runs[runs.length-1];if(l&&l.on===on)l.n++;else runs.push({on,n:1});}
  if(runs.length>1&&runs[0].on===runs[runs.length-1].on){runs[0].n+=runs.pop().n;}if(!runs.some(r=>r.on))return{text:'',short:''};while(!runs[0].on)runs.push(runs.shift());
  let u=runs;for(let k=2;k<runs.length;k+=2)if(runs.length%k===0&&runs.every((r,i)=>r.n===runs[i%k].n&&r.on===runs[i%k].on)){u=runs.slice(0,k);break;}
  return{text:u.map(r=>r.n+(r.on?' on':' off')).join(', ')+(u.length<runs.length?' (repeats)':''),short:u.map(r=>r.n).join('-')};}
// Blank start for new users: nothing scheduled until they import/build/pick (NOT the plant rotation)
function blank(start){return{blank:true,name:'No schedule yet',cycleStart:start,cycleLength:7,shiftTimes:{AM:['06:00','18:00'],PM:['18:00','06:00']},crews:{},extra:{'My schedule':{start,pattern:'.......',verified:true}}};}
const cls=d=>d.cls||d.shift||'';
const nightNext=st=>!st||st.nightCounts!=='start';
function countedDate(d,st){return (d.shift==='PM'||d.cls==='PM')&&nightNext(st)?fmt(parseD(d.date)+DAY):d.date;}
// Clock format: '12' (7:00 PM, default) or '24' (19:00). Accepts 'HH:MM' or an ISO 'YYYY-MM-DDTHH:MM'. Data stays HH:MM; only display text changes.
function clock(){try{return root.Rot&&root.Rot.clockFn?root.Rot.clockFn():'12';}catch(e){return'12';}}
function ft(x,c){const m=String(x||'').match(/(?:T|^)(\d{1,2}):(\d\d)/);if(!m)return String(x||'');const H=+m[1],M=m[2];return (c||clock())==='24'?String(H).padStart(2,'0')+':'+M:(H%12||12)+':'+M+' '+(H<12?'AM':'PM');}
root.Rot={ft,clock,makeGeneric,toConfig,describe,blank,cls,holidayOff,nightNext,countedDate,cycleName,defaultName,cycleFromMarks,fromCalendar,cycleOf,jobOptions,jobLabel,dayLabel,onOff,verified,parseD,fmt,crewList,crewListRaw,isCombo,baseShift,day,range,times,rotationFromTemplate,fromBuilder,DAY};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=globalThis.Rot;

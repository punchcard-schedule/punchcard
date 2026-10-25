// Format-agnostic schedule detection from a grid of text (CSV/TSV, pasted text, PDF text layer, OCR text).
// Finds: crews + names, shift codes + times/lengths, cycle length + pattern. Assumes no particular schedule.
// Accepts either orientation:  date,CrewA,CrewB…  (one row per date)   or   Crew,date1,date2…  (one row per crew).
// Optional legend lines anywhere:  D = 07:00-15:00   |   #shift,N,23:00,8,night   |   Days: 6a-6p
(function(root){
const DAY=864e5;const P=s=>Date.parse(s+'T00:00:00Z');const F=t=>new Date(t).toISOString().slice(0,10);const pad=n=>String(n).padStart(2,'0');
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const OFF=/^(|OFF|O|X|-|–|—|\.|R|RDO|REST|0)$/i;
function parseDate(t,yr){t=String(t||'').trim();let m;
  if(m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))return`${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if(m=t.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)){const y=m[3]?(m[3].length===2?'20'+m[3]:m[3]):yr;return`${y}-${pad(m[1])}-${pad(m[2])}`;}
  if(m=t.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*(?:[-\s](\d{2,4}))?$/)){const mo=MON[m[2].toLowerCase()];if(mo){const y=m[3]?(m[3].length===2?'20'+m[3]:m[3]):yr;return`${y}-${pad(mo)}-${pad(m[1])}`;}}
  if(m=t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/)){const mo=MON[m[1].toLowerCase()];if(mo)return`${m[3]||yr}-${pad(mo)}-${pad(m[2])}`;}
  return null;}
const okDate=d=>d&&!isNaN(P(d));
// "07:00-15:00", "7-3", "6a-6p", "1900-0700" -> {start,hours}
function timeRange(t){const m=String(t).trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap])?m?\s*(?:-|–|to)\s*(\d{1,2})(?::?(\d{2}))?\s*([ap])?m?$/i);if(!m)return null;
  let h1=+m[1],m1=+(m[2]||0),h2=+m[4],m2=+(m[5]||0);if(m[3]){h1=h1%12+(/p/i.test(m[3])?12:0);}if(m[6]){h2=h2%12+(/p/i.test(m[6])?12:0);}
  if(!m[2]&&!m[3]&&!m[5]&&!m[6]&&h1<=12&&h2<=12&&h2<=h1)h2+=12; // "7-3" = 7am-3pm
  if(h1>23||h2>24||m1>59||m2>59)return null;let len=(h2*60+m2)-(h1*60+m1);if(len<=0)len+=1440;return{start:pad(h1)+':'+pad(m1),hours:Math.round(len/30)/2};}
function guessKind(code,start){const c=String(code).toUpperCase();
  if(/^(N|NT|NS|NIGHTS?|PM|G|GY|GRAVE(YARD)?|3RD|THIRD|NIGHT SHIFT)$/.test(c))return'night';if(/^(E|EV|EVE|EVENINGS?|SW|SWING|AFT|AFTERNOONS?|2ND|SECOND|B)$/.test(c))return'swing';
  if(start){const h=+start.slice(0,2);if(h>=19||h<4)return'night';if(h>=12)return'swing';}return'day';}
function splitter(lines){const ds=['\t',',',';','|'];let best=null,bn=0;for(const d of ds){const n=lines.filter(l=>l.includes(d)).length;if(n>bn){bn=n;best=d;}}
  return best&&bn>=lines.length*0.6?l=>l.split(best).map(x=>x.trim()):l=>l.trim().split(/\s{2,}|\s+(?=\S)/).map(x=>x.trim());}
function parse(text,opt={}){const yr=opt.year||new Date().getFullYear();const warn=[];const legend={};
  let lines=String(text||'').replace(/\r/g,'').split('\n').map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim());
  // legend lines
  lines=lines.filter(l=>{let m=l.match(/^\s*#\s*shift\s*[,;\t ]\s*([^,;\t ]+)\s*[,;\t ]\s*(\d{1,2}:\d\d)\s*[,;\t ]\s*([\d.]+)(?:\s*[,;\t ]\s*(day|swing|night))?/i);
    if(m){legend[m[1].toUpperCase()]={start:m[2].padStart(5,'0'),hours:+m[3],kind:m[4]&&m[4].toLowerCase()};return false;}
    m=l.match(/^\s*#?\s*([A-Za-z][\w ]{0,14}?)\s*(?:=|:)\s*([\d:apm\s]+(?:-|–|to)[\d:apm\s]+)\s*(?:\((day|swing|night)\))?\s*$/i);
    if(m){const tr=timeRange(m[2]);if(tr){legend[m[1].trim().toUpperCase()]={...tr,kind:m[3]&&m[3].toLowerCase()};return false;}}
    return !/^\s*#/.test(l);});
  if(!lines.length)throw new Error('No schedule rows found');
  const sp=splitter(lines);const tok=x=>/^\d{1,4}[\/-]\d{1,2}(?:[\/-]\d{2,4})?$/.test(x)||(/^[A-Z0-9:\-]{1,11}$/.test(x)&&!/^\d+$/.test(x));
  // PDF text layers often merge neighbouring table cells ("11/10/2026 D", "OFF E"): split those back into cells
  const rows=lines.map(sp).map(r=>r.flatMap(c=>{const ps=c.split(/\s+/);return ps.length>1&&ps.every(tok)?ps:[c];}));
  // orientation
  const firstColDates=rows.filter(r=>okDate(parseDate(r[0],yr))).length;const fd=rows.findIndex(r=>okDate(parseDate(r[0],yr)));const hdr=fd>0?rows[fd-1]:rows[0]; // header = the row just above the first date row (skips titles/notes above the table)
  const hdrDates=hdr.slice(1).filter(c=>okDate(parseDate(c,yr))).length;
  const grid={};let dates=[];
  if(firstColDates>=Math.max(2,(rows.length-1)*0.6)){const hasHdr=!okDate(parseDate(hdr[0],yr));const names=hasHdr?hdr.slice(1):null;const data=hasHdr?rows.slice(Math.max(1,fd)):rows;
    const w=Math.max(...data.map(r=>r.length))-1;if(names&&w===1&&names.length>1)names.splice(0,names.length,names.join(' ')); // "Day crew" split into two cells by the PDF text layer
    const nm=i=>(names&&names[i]&&names[i].trim())||(w===1?'My schedule':'Crew '+(i+1));
    // skip derived combo columns like "A/B Days"
    const cols=[...Array(w).keys()].filter(i=>!(names&&/\//.test(names[i]||'')));
    for(const r of data){const d=parseDate(r[0],yr);if(!okDate(d))continue;dates.push(d);for(const i of cols){(grid[nm(i)]=grid[nm(i)]||{})[d]=r[i+1]??'';}}}
  else if(hdrDates>=2){const ds=hdr.slice(1).map(c=>parseDate(c,yr));for(const r of rows.slice(1)){const n=(r[0]||'').trim();if(!n)continue;const nm=n.replace(/^crew\s+/i,'');
      ds.forEach((d,i)=>{if(okDate(d)){(grid[nm]=grid[nm]||{})[d]=r[i+1]??'';}});}dates=ds.filter(okDate);}
  else throw new Error('Could not find a row or column of dates. Put one date per row (date, crew1, crew2…) or one per column.');
  dates=[...new Set(dates)].sort();if(dates.length<2)throw new Error('Need at least 2 dates');
  // year rollover for dates without a year (Dec -> Jan)
  const start=dates[0],end=dates[dates.length-1];const n=Math.round((P(end)-P(start))/DAY)+1;if(n>800)throw new Error('Dates span more than 2 years; check the date format');
  const all=[];for(let k=0;k<n;k++)all.push(F(P(start)+k*DAY));if(all.length>dates.length)warn.push(`${all.length-dates.length} date(s) missing in the file; treated as unknown`);
  // tokens -> codes
  const types={};const crewNames=Object.keys(grid);if(!crewNames.length)throw new Error('No crews found');
  const seq={};for(const c of crewNames){seq[c]=all.map(d=>{if(!(d in grid[c]))return undefined;let v=String(grid[c][d]).trim();if(OFF.test(v))return null;
      const tr=timeRange(v);const code=v.toUpperCase().slice(0,20);if(!types[code])types[code]={name:v,...(legend[code]||{}),...(tr&&!legend[code]?tr:{})};return code;});}
  // long codes (e.g. "05:30-15:30") get short letters by kind; the original stays as the shift's name
  {const used=new Set(Object.keys(types).filter(k=>k.length<=4));const ren={};for(const k of Object.keys(types)){if(k.length<=4)continue;const T=types[k];const kd=T.kind||guessKind(k,T.start);
     let b={day:'D',swing:'E',night:'N'}[kd],c=b,i=2;while(used.has(c))c=b+i++;used.add(c);ren[k]=c;types[c]=T;delete types[k];}
   if(Object.keys(ren).length)for(const c in seq)seq[c]=seq[c].map(x=>x&&ren[x]||x);}
  // drop crews with nothing on
  for(const c of crewNames)if(!seq[c].some(Boolean)){delete seq[c];warn.push(`"${c}" has no shifts; ignored`);}
  const crews=Object.keys(seq);if(!crews.length)throw new Error('No shifts found (every cell looks like a day off)');
  // shift times/lengths not given: infer from how many different shifts run on the same day
  let k=1,oneEach=true;for(let i=0;i<n;i++){const on=crews.map(c=>seq[c][i]).filter(Boolean);k=Math.max(k,new Set(on).size);if(on.length!==1)oneEach=false;}
  const weekendWork=crews.some(c=>seq[c].some((x,i)=>x&&[0,6].includes(new Date(P(all[i])).getUTCDay())));
  const nCodes=Object.keys(types).length;const guessH=k>=3?8:k===2?12:nCodes>=3?8:nCodes===2?12:oneEach&&crews.length>=2?24:weekendWork&&crews.length>=2?12:8;
  const defStart={day:guessH===12?'06:00':'07:00',swing:'15:00',night:guessH===12?'18:00':'23:00'};
  for(const [code,T] of Object.entries(types)){T.kind=T.kind||guessKind(code,T.start);fillName(code,T);if(!T.hours){T.hours=guessH;T.guessed=true;}if(!T.start){T.start=guessH===24?'07:00':defStart[T.kind];T.guessed=true;}}
  // cycle: smallest period consistent across ALL crews (unknown cells match anything)
  const same=(a,b)=>a===undefined||b===undefined||a===b;let L=n,verified=false;
  for(let p=1;p<=Math.floor(n/2);p++)if(crews.every(c=>{const s=seq[c];for(let i=p;i<n;i++)if(!same(s[i],s[i-p]))return false;return true;})){L=p;verified=true;break;}
  if(!verified)warn.push('No repeat found in the uploaded dates; the whole range is used as one cycle. Upload at least two full cycles or correct the cycle length below.');
  const cyc=c=>{const out=[];for(let i=0;i<L;i++){let v;for(let j=i;j<n;j+=L)if(seq[c][j]!==undefined){v=seq[c][j];break;}out.push(v===undefined?null:v);}return out;};
  const cfgCrews=crews.map(c=>({name:c,days:cyc(c)}));
  // stagger: is every crew the first crew's pattern shifted?
  const base=cfgCrews[0].days;const offsets=cfgCrews.map(c=>{for(let s=0;s<L;s++)if(c.days.every((x,i)=>x===base[(i-s+L)%L]))return s;return null;});
  const cfg={name:'',start,L,types,crews:cfgCrews,months:12,source:'upload'};
  const pat=root.Rot?root.Rot.describe(base):null;
  return{cfg,report:{crews:crews.length,names:crews,shiftTypes:Object.keys(types),cycleLength:L,verified,repeats:Math.floor(n/L),days:n,offsets,pattern:pat,guessedTimes:Object.values(types).some(t=>t.guessed),warn}};}
// "2-2-3" / "5-2" / "4-3-3-4": alternating on/off starting with on; an odd count repeats so on/off alternate (2-2-3 -> 2 on 2 off 3 on 2 off 2 on 3 off)
function fromRuns(spec,code){const n=String(spec).split(/[^\d]+/).filter(Boolean).map(Number);if(!n.length||n.some(x=>!(x>=1&&x<=60)))throw new Error('Pattern like 5-2, 2-2-3, 4-4');
  const runs=n.length%2?n.concat(n):n;const out=[];runs.forEach((r,i)=>{for(let k=0;k<r;k++)out.push(i%2?null:code);});return out;}
// friendly display name for a shift code when none was given (or the name just repeats the code)
const FRIENDLY={D:'Day',N:'Night',S:'Swing',SW:'Swing',E:'Evening',A:'Morning',AM:'Morning',P:'Afternoon',PM:'Afternoon',M:'Mid',R:'Off',O:'Off',OFF:'Off'};
function friendlyName(code,kind){const c=String(code||'').trim().toUpperCase();return FRIENDLY[c]||({swing:'Swing shift',night:'Night shift'}[kind]||'Day shift');}
function fillName(code,T){const n=String(T.name||'').trim();if(!n||n.toUpperCase()===String(code).toUpperCase()){T.name=+T.hours>=24?T.hours+'-hour':friendlyName(code,T.kind);T.autoName=true;}return T;}
root.Detect={friendlyName,fillName,parse,parseDate,timeRange,guessKind,fromRuns};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=globalThis.Detect;

// On-device import of a printed rotation calendar (screenshots/photos/PDF pages). No AI service:
// grid lines from pixel projections, Tesseract OCR (injected) for dates/crew letters/AM-PM, black header cells = holidays.
(function(root){
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad=n=>String(n).padStart(2,'0');const DAY=864e5;
const P=s=>Date.parse(s+'T00:00:00Z');const F=t=>new Date(t).toISOString().slice(0,10);const addD=(s,k)=>F(P(s)+k*DAY);
function gray(img){const{width:W,height:H,data:d}=img;const g=new Uint8Array(W*H);for(let i=0,j=0;j<W*H;i+=4,j++)g[j]=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;return{W,H,g};}
const DK=150;
// ---- grid geometry ----
function lineRows(G){const{W,H,g}=G;const out=[];for(let y=0;y<H;y++){let run=0,best=0,bs=0,s=0,segs=[];for(let x=0;x<=W;x++){if(x<W&&g[y*W+x]<DK){if(!run)s=x;run++;}else{if(run>=30)segs.push([s,s+run-1]);if(run>best){best=run;bs=s;}run=0;}}
  if(best>=0.2*W)out.push({y,segs});}
  const m=[];for(const r of out){const l=m[m.length-1];if(l&&r.y-l.y1<=2){l.y1=r.y;l.segs=l.segs.concat(r.segs);}else m.push({y0:r.y,y1:r.y,segs:r.segs});}
  return m.map(l=>({y:(l.y0+l.y1)/2,y0:l.y0,y1:l.y1,segs:l.segs}));}
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:0;};
function tables(G){const L=lineRows(G);if(L.length<2)return[];const gaps=[];for(let i=1;i<L.length;i++)gaps.push(L[i].y-L[i-1].y);
  const h=med(gaps.filter(g=>g>8&&g<G.H/20));const T=[];let cur=[L[0]];
  for(let i=1;i<L.length;i++){const gp=L[i].y-L[i-1].y;if(gp<=8){continue;}if(gp>1.6*h){T.push(cur);cur=[L[i]];}else{cur.push(L[i]);}}T.push(cur);
  return T.filter(t=>t.length>=2).map(ls=>{const real=ls.filter(l=>!l.fill);const xs0=Math.min(...real.map(l=>Math.min(...l.segs.map(s=>s[0])))),xs1=med(real.map(l=>Math.max(...l.segs.map(s=>s[1]))));
    const ys=ls.map(l=>l.y);// virtual row below the last line (may be cut off by phone controls)
    ys.push(ys[ys.length-1]+h);ys.unshift(Math.max(0,ys[0]-h));return{x0:xs0,x1:xs1,ys,real:[false].concat(ls.map(l=>!l.fill),[false]),h,cand:vlines(G,xs0,xs1,ls.map(l=>l.y))};});}
// columns: candidates per table, then keep x positions supported by most tables (one page = one grid)
function gridCols(TT){if(TT.length<3){TT.forEach(t=>t.cols=t.cand);return;}const all=TT.flatMap((t,i)=>t.cand.map(x=>({x,i})));all.sort((a,b)=>a.x-b.x);const cl=[];
  for(const c of all){const l=cl[cl.length-1];if(l&&c.x-l.xs[l.xs.length-1]<=4){l.xs.push(c.x);l.t.add(c.i);}else cl.push({xs:[c.x],t:new Set([c.i])});}
  const keep=cl.filter(c=>c.t.size>=Math.max(2,TT.length*0.5)).map(c=>med(c.xs));
  TT.forEach(t=>{const own=keep.filter(x=>x>=t.x0-6&&x<=t.x1+6);t.cols=own.length>=4?own:t.cand;});}
function vlines(G,x0,x1,ys){const{W,g}=G;const c=[];for(let x=Math.max(0,Math.round(x0)-3);x<=Math.min(W-1,Math.round(x1)+3);x++){let ok=0;
  for(let b=1;b<ys.length;b++){const ya=Math.round(ys[b-1])+2,yb=Math.round(ys[b])-2;let n=0;for(let y=ya;y<=yb;y++)if(g[y*W+x]<DK)n++;if(yb>ya&&n>=0.9*(yb-ya+1))ok++;}if(ok>=1)c.push(x);}
  const m=[];for(const x of c){const l=m[m.length-1];if(l&&x-l[1]<=2)l[1]=x;else m.push([x,x]);}let xs=m.map(r=>(r[0]+r[1])/2);
  // fill a missing vertical line where a gap is ~2x the median width
  return xs;}
// fraction of dark pixels along a horizontal / vertical segment (+-1px)
function hseg(G,y,xa,xb){let n=0,t=0;for(let x=Math.round(xa);x<=xb;x++){t++;let d=0;for(let k=-1;k<=1;k++){const yy=Math.round(y)+k;if(yy>=0&&yy<G.H&&G.g[yy*G.W+x]<DK)d=1;}n+=d;}return t?n/t:0;}
function vseg(G,x,ya,yb){let n=0,t=0;for(let y=Math.round(ya);y<=yb;y++){t++;let d=0;for(let k=-1;k<=1;k++){const xx=Math.round(x)+k;if(xx>=0&&xx<G.W&&G.g[y*G.W+xx]<DK)d=1;}n+=d;}return t?n/t:0;}
function cellStats(G,x0,y0,x1,y1){const ins=Math.max(1,Math.round((y1-y0)*0.14));let ink=0,t=0,sum=0;for(let y=Math.round(y0+ins);y<y1-ins;y++)for(let x=Math.round(x0+ins);x<x1-ins;x++){const v=G.g[y*G.W+x];t++;sum+=v;if(v<DK)ink++;}return{ink:t?ink/t:0,mean:t?sum/t:255};}
// crop -> RGBA, upscaled (nearest+box), optional invert, white padding
function crop(G,x0,y0,x1,y1,scale,inv){x0=Math.max(0,Math.round(x0));y0=Math.max(0,Math.round(y0));x1=Math.min(G.W,Math.round(x1));y1=Math.min(G.H,Math.round(y1));const w=x1-x0,h=y1-y0,pd=12;
  const W=w*scale+2*pd,H=h*scale+2*pd;const d=new Uint8ClampedArray(W*H*4).fill(255);
  for(let y=0;y<h*scale;y++)for(let x=0;x<w*scale;x++){const sx=x/scale,sy=y/scale;const ix=Math.min(w-1,Math.floor(sx)),iy=Math.min(h-1,Math.floor(sy));const ix2=Math.min(w-1,ix+1),iy2=Math.min(h-1,iy+1);const fx=sx-ix,fy=sy-iy;
    const v=(G.g[(y0+iy)*G.W+x0+ix]*(1-fx)+G.g[(y0+iy)*G.W+x0+ix2]*fx)*(1-fy)+(G.g[(y0+iy2)*G.W+x0+ix]*(1-fx)+G.g[(y0+iy2)*G.W+x0+ix2]*fx)*fy;let o=inv?255-v:v;o=o<128?0:255;const i=((y+pd)*W+x+pd)*4;d[i]=d[i+1]=d[i+2]=o;}
  return{width:W,height:H,data:d};}
// small binary glyph signature for nearest-neighbour AM/PM fallback
function sig(G,x0,y0,x1,y1){const ins=Math.max(1,Math.round((y1-y0)*0.14));let a=1e9,b=-1,c=1e9,e=-1;for(let y=Math.round(y0+ins);y<y1-ins;y++)for(let x=Math.round(x0+ins);x<x1-ins;x++)if(G.g[y*G.W+x]<DK){a=Math.min(a,x);b=Math.max(b,x);c=Math.min(c,y);e=Math.max(e,y);}
  if(b<0)return null;const S=[];const w=(b-a+1)/2;// left half = first letter
  for(let j=0;j<8;j++)for(let i=0;i<8;i++){let n=0,t=0;for(let y=c+(e-c+1)*j/8;y<c+(e-c+1)*(j+1)/8;y++)for(let x=a+w*i/8;x<a+w*(i+1)/8;x++){t++;if(G.g[Math.floor(y)*G.W+Math.floor(x)]<DK)n++;}S.push(t?n/t:0);}return S;}
const dist=(p,q)=>p.reduce((s,v,i)=>s+(v-q[i])**2,0);
const parseDate=t=>{const m=String(t).replace(/[|]/g,'1').match(/(\d{1,2})\s*[-–—.]\s*([A-Za-z]{3})/);if(!m)return null;const mo=MON[m[2].toLowerCase()];const dd=+m[1];return mo&&dd>=1&&dd<=31?{m:mo,d:dd}:null;};
const shiftOf=t=>{t=String(t).toUpperCase().replace(/[^A-Z]/g,'');if(/^[A4][MN]/.test(t)||t==='AM')return'AM';if(/^[PF][MN]/.test(t)||t==='PM')return'PM';return null;};
// ---- analyze one image. ocr(rgba,{mode:'line'|'char',chars}) -> Promise<{text,conf}>
// small rotations (photos / tilted screenshots): pick the angle that makes row projections sharpest, then rotate
function skew(G){const{W,H,g}=G;let best=0,bs=-1;for(let a=-4;a<=4.001;a+=0.25){const t=Math.tan(a*Math.PI/180);const pr=new Float64Array(H+W);
    for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=3)if(g[y*W+x]<DK){const yy=Math.round(y-x*t)+W;if(yy>=0&&yy<pr.length)pr[yy]++;}let sc=0;for(const v of pr)sc+=v*v;if(sc>bs*1.0001){bs=sc;best=a;}}
  return Math.abs(best)<0.2?0:best;}
function rotate(G,deg){const{W,H,g}=G;const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const o=new Uint8Array(W*H).fill(255);const cx=W/2,cy=H/2;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=c*(x-cx)-s*(y-cy)+cx,sy=s*(x-cx)+c*(y-cy)+cy;const ix=Math.floor(sx),iy=Math.floor(sy);if(ix<0||iy<0||ix>=W-1||iy>=H-1)continue;const fx=sx-ix,fy=sy-iy;
    o[y*W+x]=(g[iy*W+ix]*(1-fx)+g[iy*W+ix+1]*fx)*(1-fy)+(g[(iy+1)*W+ix]*(1-fx)+g[(iy+1)*W+ix+1]*fx)*fy;}return{W,H,g:o};}
async function analyze(img,ocr,opt={}){let G=gray(img);const sk=skew(G);if(sk)G=rotate(G,sk);const TT=tables(G);gridCols(TT);const out=[];let yearHint=null;const log=opt.log||(()=>{});
  for(let ti=0;ti<TT.length;ti++){const T=TT[ti];const xs=T.cols;if(xs.length<4)continue;const nr=T.ys.length-1;const top=T.ys[0];
    // year printed above the table (title "2026 OPERATING..." or a "2027" tab)
    const prevBot=ti?TT[ti-1].ys[TT[ti-1].ys.length-2]+T.h:Math.max(0,top-8*T.h);
    if(top-prevBot>T.h*0.8){const r=await ocr(crop(G,T.x0,prevBot+2,T.x1,top-1,2,false),{mode:'block'});const m=r.text.match(/20[2-4]\d/);if(m)yearHint=+m[0];
      if(!m){const r2=await ocr(crop(G,T.x0,prevBot+2,T.x1,top-1,2,true),{mode:'block'});const m2=r2.text.match(/20[2-4]\d/);if(m2)yearHint=+m2[0];}}
    const SC=Math.max(2,Math.min(8,Math.round(64/T.h)));const cell=(r,c)=>({x0:xs[c],x1:xs[c+1],y0:T.ys[r],y1:T.ys[r+1]});
    // find the date row: first row (of the first 3) where most cells read as d-Mon
    let dateRow=-1,dates=null,hol=[];
    for(let r=0;r<Math.min(3,nr)&&dateRow<0;r++){const got=[];let black=[];
      for(let c=0;c<xs.length-1;c++){const k=cell(r,c);const s=cellStats(G,k.x0,k.y0,k.x1,k.y1);const inv=s.mean<110;black.push(inv);
        const o=await ocr(crop(G,k.x0+2,k.y0+2,k.x1-2,k.y1-1,SC,inv),{mode:'line',chars:'0123456789-ABCDEFGJLMNOPRSTUVYabceglnoprtuvy'});got.push(parseDate(o.text));}
      if(got.filter(Boolean).length>=Math.max(2,(xs.length-1)*0.4)){dateRow=r;dates=got;hol=black;}}
    if(dateRow<0){log(`table ${ti}: no date row`);continue;}
    // first column date by voting (each parsed cell implies a start date)
    const prev=out.length?out[out.length-1].dates.slice(-1)[0]:null;let Y=yearHint||(prev?+prev.slice(0,4):opt.year||new Date().getFullYear());
    const firstM=(dates.find(Boolean)||{}).m;const votes={};
    dates.forEach((p,c)=>{if(!p)return;let y=Y;if(p.m<firstM&&firstM-p.m>6)y=Y+1;const iso=`${y}-${pad(p.m)}-${pad(p.d)}`;if(isNaN(P(iso)))return;const st=addD(iso,-c);votes[st]=(votes[st]||0)+1;});
    let start=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0][0];
    if(prev&&!yearHint){// year carry: pick the year making this block follow the previous one
      const cands=[-1,0,1].map(k=>(+start.slice(0,4)+k)+start.slice(4));start=cands.sort((a,b)=>Math.abs(P(a)-P(prev))-Math.abs(P(b)-P(prev)))[0];}
    const dlist=xs.slice(1).map((_,c)=>addD(start,c));const dateConf=dates.filter((p,c)=>p&&addD(start,c).slice(5)===`${pad(p.m)}-${pad(p.d)}`).length/dates.length;
    const holidays=dlist.filter((d,c)=>hol[c]);
    // crew rows
    const crews={};let auto=0;const read=[];
    for(let r=dateRow+1;r<nr;r++){const k0=cell(r,0);if(!T.real[r]||!T.real[r+1])continue;
      let letter=null;for(const md of ['char','line','sparse']){const lo=await ocr(crop(G,Math.max(0,T.x0-T.h*4),k0.y0+1,T.x0-3,k0.y1-1,SC,false),{mode:md,chars:'ABCDEFGH'});const m=lo.text.match(/[A-H]/);if(m){letter=m[0];break;}}
      read.push(letter);letter='?'+(r-dateRow-1);
      const row=[];for(let c=0;c<xs.length-1;c++){const k=cell(r,c);const bt=T.real[r]?hseg(G,k.y0,k.x0+2,k.x1-2):0,bb=T.real[r+1]?hseg(G,k.y1,k.x0+2,k.x1-2):0,bl=vseg(G,k.x0,k.y0+2,k.y1-2),br=vseg(G,k.x1,k.y0+2,k.y1-2);
        const s=cellStats(G,k.x0,k.y0,k.x1,k.y1);const occl=Math.min(bt,bb,bl,br)<0.8;
        const v={date:dlist[c],occluded:occl,ink:s.ink,box:[k.x0,k.y0,k.x1,k.y1]};
        if(occl){v.v=null;v.why='hidden';}else if(s.ink<0.012)v.v='.';else{const o=await ocr(crop(G,k.x0+2,k.y0+2,k.x1-2,k.y1-1,SC,false),{mode:'line',chars:'AMP'});v.v=shiftOf(o.text);v.ocr=o.text.trim();v.conf=o.conf;v.sig=sig(G,k.x0,k.y0,k.x1,k.y1);if(!v.v)v.why='unclear';}
        row.push(v);}
      crews[letter]=row;}
    // crew letters: printed letters run in order (A,B,C,D); take the alphabet offset most rows agree on, so one misread letter can't scramble crews
    {const keys=Object.keys(crews);const votes={};read.forEach((l,i)=>{if(l){const b=l.charCodeAt(0)-i;votes[b]=(votes[b]||0)+1;}});const vb=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];const base=vb?+vb[0]:65;
      auto=read.filter((l,i)=>!l||l.charCodeAt(0)!==base+i).length;const cr2={};keys.forEach((k,i)=>cr2[String.fromCharCode(Math.max(65,base)+i)]=crews[k]);for(const k of keys)delete crews[k];Object.assign(crews,cr2);var lettersRead=vb?vb[1]:0;}
    out.push({dates:dlist,dateConf,holidays,crews,autoLetters:auto,lettersRead,bbox:[T.x0,T.ys[0],T.x1,T.ys[nr]]});log(`table ${ti}: ${dlist[0]}..${dlist[dlist.length-1]} crews ${Object.keys(crews).join('')} dateConf ${dateConf.toFixed(2)} hol ${holidays}`);}
  // a block whose letters were hidden (e.g. under a phone overlay) takes the crew order used by the well-read blocks
  {const good=out.filter(T=>T.lettersRead>=2).map(T=>Object.keys(T.crews).join(''));const v={};good.forEach(k=>v[k]=(v[k]||0)+1);const top=Object.entries(v).sort((a,b)=>b[1]-a[1])[0];
   if(top)for(const T of out)if(T.lettersRead<2){const ks=Object.keys(T.crews);if(ks.length===top[0].length){const n={};ks.forEach((k,i)=>n[top[0][i]]=T.crews[k]);T.crews=n;T.lettersFromOthers=1;}}}
  shapes(out.flatMap(T=>Object.values(T.crews).flat()).filter(v=>v.sig));out.forEach(T=>Object.values(T.crews).flat().forEach(v=>delete v.sig));
  return{tables:out,skew:sk,size:[img.width,img.height]};}
// AM vs PM by glyph shape: 2-means over the first-letter bitmaps, each group named by its OCR majority.
// The printed letters are identical within a calendar, so shape is more reliable than per-cell OCR on small text.
function shapes(cs){if(cs.length<4)return;let a=cs[0].sig,b=cs.reduce((m,v)=>dist(v.sig,a)>dist(m.sig,a)?v:m).sig;a=cs.reduce((m,v)=>dist(v.sig,b)>dist(m.sig,b)?v:m).sig;
  let as=[];for(let it=0;it<8;it++){as=cs.map(v=>dist(v.sig,a)<=dist(v.sig,b)?0:1);const mean=k=>{const g=cs.filter((_,i)=>as[i]===k);if(!g.length)return k?b:a;return g[0].sig.map((_,j)=>g.reduce((s,v)=>s+v.sig[j],0)/g.length);};a=mean(0);b=mean(1);}
  const sep=dist(a,b);const vote=[{},{}];cs.forEach((v,i)=>{if(v.v)vote[as[i]][v.v]=(vote[as[i]][v.v]||0)+1;});
  const nm=vote.map(o=>Object.entries(o).sort((x,y)=>y[1]-x[1])[0]);let lab=nm.map(x=>x&&x[0]);
  if(lab[0]===lab[1]){// one shape only (e.g. a crew that only works days) or OCR biased: trust OCR per cell
    if(sep<0.5){cs.forEach(v=>{if(!v.v){v.why='unclear';}});return;}const o=lab[0]==='AM'?'PM':'AM';const w=(nm[0][1]/(cs.filter((_,i)=>as[i]===0).length))>=(nm[1][1]/(cs.filter((_,i)=>as[i]===1).length))?1:0;lab[w]=o;}
  if(!lab[0])lab[0]=lab[1]==='AM'?'PM':'AM';if(!lab[1])lab[1]=lab[0]==='AM'?'PM':'AM';
  cs.forEach((v,i)=>{const g=lab[as[i]];const d0=dist(v.sig,as[i]?b:a),d1=dist(v.sig,as[i]?a:b);const amb=d0>0.6*d1;
    if(sep<0.5){if(!v.v)v.why='unclear';return;}
    if(!v.v){v.v=g;if(amb)v.why='unclear';}else if(v.v!==g){v.alt=v.v;v.v=g;v.why=amb?'unclear':null;v.ocrDisagree=1;if(!amb)delete v.why;}else if(v.why==='unclear'&&!amb)delete v.why;});}
// ---- combine images, de-duplicate dates, infer each crew's cycle ----
function combine(results,fixes={}){const cells={};const hol=new Set();
  for(const R of results)for(const T of R.tables){T.holidays.forEach(d=>hol.add(d));for(const[cr,row] of Object.entries(T.crews))for(const v of row){const k=cr+'|'+v.date;const c=cells[k];
    const score=x=>x.v==null?0:x.why?1:2;if(!c||score(v)>score(c))cells[k]={...v,crew:cr};}}
  for(const[k,v] of Object.entries(fixes)){if(cells[k])cells[k]={...cells[k],v,why:null,fixed:1,occluded:false};else{const[cr,date]=k.split('|');cells[k]={crew:cr,date,v,fixed:1};}}
  let crews=[...new Set(Object.values(cells).map(c=>c.crew))].sort();const cnt=cr=>Object.values(cells).filter(c=>c.crew===cr&&c.v!=null).length;const mx=Math.max(0,...crews.map(cnt));
  const dropped=crews.filter(cr=>cnt(cr)<0.25*mx);crews=crews.filter(cr=>!dropped.includes(cr));for(const k in cells)if(dropped.includes(cells[k].crew))delete cells[k];const ds=Object.values(cells).map(c=>c.date).sort();if(!ds.length)return{error:'No calendar grid found'};
  const start=ds[0],end=ds[ds.length-1];const n=Math.round((P(end)-P(start))/DAY)+1;
  const seq={};for(const cr of crews){seq[cr]=[];for(let i=0;i<n;i++){const c=cells[cr+'|'+addD(start,i)];seq[cr].push(c&&c.v&&!c.why?c.v:c&&c.v&&c.why!=='hidden'?c.v.toLowerCase():null);}}// lowercase = low confidence
  // common period: smallest L with best agreement across all crews (uncertain cells weigh less)
  let best=null;for(let L=2;L<=Math.min(112,Math.floor(n/2));L++){let agree=0,dis=0;for(const cr of crews){const s=seq[cr];for(let i=0;i+L<n;i++){const a=s[i],b=s[i+L];if(a==null||b==null)continue;const w=(a===a.toUpperCase()&&b===b.toUpperCase())?1:0.3;if(a.toUpperCase()===b.toUpperCase())agree+=w;else dis+=w;}}
    const tot=agree+dis;if(tot<20)continue;const rate=dis/tot;if(!best||rate<best.rate-0.004)best={L,rate,tot};}
  if(!best)return{error:'Not enough readable days to find a repeating cycle (need at least two full cycles)'};const L=best.L;
  const pat={},issues=[],sup={};let known=0,agreeN=0,low=0;
  for(const cr of crews){const s=seq[cr];let p='';for(let ph=0;ph<L;ph++){const v={};for(let i=ph;i<n;i+=L){const x=s[i];if(x==null)continue;const w=x===x.toUpperCase()?1:0.3;v[x.toUpperCase()]=(v[x.toUpperCase()]||0)+w;}
      const top=Object.entries(v).sort((a,b)=>b[1]-a[1])[0];sup[cr+'|'+ph]=top?top[1]:0;p+=top?(top[0]==='AM'?'a':top[0]==='PM'?'p':'.'):'?';}
    pat[cr]=p;for(let i=0;i<n;i++){const d=addD(start,i);const c=cells[cr+'|'+d];const want=p[i%L];const wv=want==='a'?'AM':want==='p'?'PM':want==='.'?'.':null;
      // unread cell (cut off at the grid edge / hidden): if the repeating cycle is clearly known here (2+ clear readings of this cycle day), fill it silently
      if(!c||c.v==null){issues.push({crew:cr,date:d,why:c&&c.occluded?'hidden by phone controls':'not in screenshots',fill:wv,miss:!c||(wv!=null&&sup[cr+'|'+(i%L)]>=2),auto:!!c});continue;}
      known++;if(c.v===wv)agreeN++;else if(!c.fixed){if(c.why)low++;issues.push({crew:cr,date:d,why:c.why?c.why+'; differs from the repeating cycle':'differs from the repeating cycle',read:c.v,fill:wv});}}}
  const empty=Object.values(pat).some(p=>!/[ap]/.test(p));if(empty&&crews.length)issues.push({why:'a crew has no shifts at all - the screenshot may be too small'});
  const unknownPhase=Object.values(pat).some(p=>p.includes('?'));const cover=n/L;
  const conf=Math.max(0,Math.min(1,(agreeN/Math.max(1,known))*(cover>=3?1:cover>=2?0.85:0.5)*(unknownPhase?0.6:1)*(empty?0.3:1)*(1-0.5*low/Math.max(1,known))));
  const shown=issues.filter(i=>!i.miss&&i.date);
  return{start,end,days:n,cycleLength:L,patterns:pat,crews,cells,holidays:[...hol].sort(),confidence:conf,level:conf>=0.97?'High':conf>=0.85?'Medium':'Low',agreement:agreeN/Math.max(1,known),known,issues:shown,cover};}
function toRotation(c,name){const pat={};for(const k of c.crews)pat[k]=c.patterns[k].replace(/\?/g,'.');const label=String(name||'').trim().slice(0,60)||'Imported plant rotation';
  return{name:label,label,custom:true,imported:true,cycleStart:c.start,cycleLength:c.cycleLength,shiftTimes:{AM:['06:00','18:00'],PM:['18:00','06:00']},crews:pat};}

// ---- PDF vector path: read the text layer (dates, crew letters, AM/PM) and filled rectangles (black header = holiday) directly.
async function pdfVector(page,OPS){const ol=await page.getOperatorList();const tc=await page.getTextContent();const vw=page.view;const H=vw[3]-vw[1];
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  let ctm=[1,0,0,1,0,0];const stack=[];let fill='#000000';const fills=[];let pend=[];
  const pt=(x,y)=>[ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]];
  for(let i=0;i<ol.fnArray.length;i++){const f=ol.fnArray[i],a=ol.argsArray[i];
    if(f===OPS.save)stack.push([ctm,fill]);else if(f===OPS.restore){const t=stack.pop();if(t)[ctm,fill]=t;}else if(f===OPS.transform)ctm=mul(ctm,a);
    else if(f===OPS.setFillRGBColor)fill=typeof a[0]==='string'?a[0]:'#'+[...a].slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    else if(f===OPS.setFillGray)fill=a[0]<0.2?'#000000':'#ffffff';
    else if(f===OPS.constructPath){const op=a[0];const data=a[1]&&a[1][0];const subs=[];let cur=null;
      if(data&&data.length!==undefined&&typeof data!=='number'){const d=Array.from(data);for(let k=0;k<d.length;){const c=d[k];if(c===0){cur=[];subs.push(cur);cur.push(pt(d[k+1],d[k+2]));k+=3;}else if(c===1){if(cur)cur.push(pt(d[k+1],d[k+2]));k+=3;}else if(c===2){if(cur)cur.push(pt(d[k+5],d[k+6]));k+=7;}else if(c===3){if(cur)cur.push(pt(d[k+3],d[k+4]));k+=5;}else k+=1;}}
      else if(a[2]){const m=a[2];subs.push([pt(m[0],m[1]),pt(m[2],m[3])]);}
      if(op===OPS.fill||op===OPS.eoFill||op===OPS.fillStroke||op===OPS.eoFillStroke)for(const sp of subs){if(sp.length<2)continue;const xs=sp.map(p=>p[0]),ys=sp.map(p=>p[1]);fills.push({x0:Math.min(...xs),x1:Math.max(...xs),y0:H-Math.max(...ys),y1:H-Math.min(...ys),c:fill});}}}
  const items=tc.items.filter(t=>t.str&&t.str.trim()).map(t=>({s:t.str.trim(),x:t.transform[4],w:t.width,y:H-t.transform[5]-(t.height||t.transform[3])/2,h:t.height||t.transform[3]}));
  return{items,fills,W:vw[2]-vw[0],H};}
const isBlack=c=>{const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c||'');return m&&parseInt(m[1],16)+parseInt(m[2],16)+parseInt(m[3],16)<120;};
function analyzeVector(v,opt={}){const out=[];const dr=v.items.filter(t=>/^\d{1,2}-[A-Za-z]{3}$/.test(t.s)&&parseDate(t.s));const rows=[];
  for(const t of dr.sort((a,b)=>a.y-b.y)){const r=rows[rows.length-1];if(r&&Math.abs(r.y-t.y)<3)r.it.push(t);else rows.push({y:t.y,it:[t]});}
  const years=v.items.filter(t=>/\b20\d\d\b/.test(t.s)).map(t=>({y:t.y,Y:+t.s.match(/\b(20\d\d)\b/)[1]}));const titleY=(years.sort((a,b)=>a.y-b.y)[0]||{}).Y||opt.year;let prevEnd=opt.prevEnd||null;
  for(let ri=0;ri<rows.length;ri++){const R=rows[ri];if(R.it.length<4)continue;const it=R.it.sort((a,b)=>a.x-b.x);const ps=it.map(t=>parseDate(t.s));
    // year: pick the base that keeps the most days inside the document's year (handles Dec->Jan rows at both ends); after the first row follow on from the previous row
    const mk=base=>{let y=base;return ps.map((p,i)=>{if(i&&p.m<ps[i-1].m)y++;return`${y}-${pad(p.m)}-${pad(p.d)}`;});};
    let ds;if(prevEnd){ds=[-1,0,1].map(k=>mk(+prevEnd.slice(0,4)+k)).sort((a,b)=>Math.abs(P(a[0])-P(prevEnd))-Math.abs(P(b[0])-P(prevEnd)))[0];}
    else ds=[titleY-1,titleY].map(mk).sort((a,b)=>b.filter(d=>+d.slice(0,4)===titleY).length-a.filter(d=>+d.slice(0,4)===titleY).length)[0];
    prevEnd=ds[ds.length-1];const cx=it.map(t=>t.x+t.w/2);const colW=(cx[cx.length-1]-cx[0])/(cx.length-1||1);
    const holidays=ds.filter((d,i)=>v.fills.some(f=>isBlack(f.c)&&f.x0<=cx[i]&&f.x1>=cx[i]&&f.y0<=it[i].y&&f.y1>=it[i].y&&(f.x1-f.x0)<colW*3));
    const nextY=ri+1<rows.length?rows[ri+1].y:1e9;const lab=v.items.filter(t=>/^[A-H]$/.test(t.s)&&t.y>R.y+1&&t.y<nextY-1&&t.x<it[0].x).sort((a,b)=>a.y-b.y);const crews={};
    for(const L of lab){if(crews[L.s])continue;crews[L.s]=ds.map(d=>({date:d,v:'.'}));for(const t of v.items){if(Math.abs(t.y-L.y)>2.5||!/^(AM|PM)$/i.test(t.s))continue;const c=t.x+t.w/2;let bi=0;cx.forEach((x,i)=>{if(Math.abs(x-c)<Math.abs(cx[bi]-c))bi=i;});if(Math.abs(cx[bi]-c)<colW/2)crews[L.s][bi].v=t.s.toUpperCase();}}
    out.push({dates:ds,dateConf:1,holidays,crews,lettersRead:Object.keys(crews).length,vector:1});}
  return{tables:out,vector:true,lastDate:prevEnd};}
root.RotImport={pdfVector,analyzeVector,gridCols,gray,tables,analyze,combine,toRotation,parseDate,shiftOf,crop};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=globalThis.RotImport;

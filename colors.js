// Per-device shift colors (localStorage.colors). Text on colored days auto-switches dark/light for contrast.
(function(){
const KEYS=[['am','AM'],['pm','PM'],['off','Off'],['vac','Vacation'],['ot','Overtime'],['swap','Swap'],['cus','Custom-time shift'],['hol','Holiday label']];
const PAL={classic:{name:'Classic',c:{}},
  pastel:{name:'Pastel',c:{hol:'#f0abfc',am:'#fbcfe8',pm:'#c4b5fd',off:'#f3f4f6',vac:'#a7f3d0',ot:'#f472b6',swap:'#93c5fd',cus:'#f9a8d4'}},
  bold:{name:'Bold',c:{hol:'#c026d3',am:'#facc15',pm:'#7c3aed',off:'#d4d4d8',vac:'#16a34a',ot:'#e11d48',swap:'#0284c7',cus:'#ea580c'}},
  earth:{name:'Earth / Steel',c:{hol:'#9a3412',am:'#d6a756',pm:'#475569',off:'#e7e5e4',vac:'#65a30d',ot:'#b45309',swap:'#0f766e',cus:'#a16207'},
    // dark mode: lighter, more saturated amber / steel blue / sage / rust so cells stand out on the dark page
    dark:{hol:'#fb923c',am:'#f0b44c',pm:'#7fa7d9',off:'#3d4656',vac:'#9ccc8a',ot:'#e8794a',swap:'#4fc1b0',cus:'#e0a85a'}}};
const DEF={hol:'#db2777',am:'#E2560A',pm:'#3550D6',vac:'#1FB57A',ot:'#D42F33',swap:'#22B8E0',cus:'#14b8a6'}; // off: theme default
const get=()=>{try{return JSON.parse(localStorage.getItem('colors')||'{}')||{};}catch(e){return{};}};
const lum=h=>{const n=parseInt(h.slice(1),16);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(n>>16)+.7152*f(n>>8&255)+.0722*f(n&255);};
const cr=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
const ink=h=>{const l=lum(h);if(cr(l,1)>=cr(l,lum('#111827')))return'#ffffff';return cr(l,lum('#111827'))>=4.5?'#111827':'#000000';};
const DEFDARK={...DEF,am:'#FF6A13',pm:'#3A4FB8',off:'#2A2F36'},DEFOFF='#E3E0DA';
const CARD={light:'#ffffff',dark:'#1E2228'}; // cells sit on cards
const hex=n=>'#'+n.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const parts=h=>{const n=parseInt(h.slice(1),16);return[n>>16,n>>8&255,n&255];};
// Nudge a color toward white (dark theme) or black (light theme) until it stands out from the card by >=1.5:1
const PAGE={light:'#f8fafc',dark:'#0b1220'};
function standOut(h,theme){const bgs=[lum(CARD[theme]),lum(PAGE[theme])];let c=parts(h);const to=theme==='dark'?255:0;const ok=x=>bgs.every(b=>cr(lum(x),b)>=1.6);
  // dark theme: lighten; light theme: darken. If the color is on the "wrong" side (e.g. near-black on dark), go the other way.
  let t=c.map(v=>v);for(let i=0;i<30&&!ok(hex(t));i++)t=t.map(v=>v+(to-v)*0.07);if(ok(hex(t)))return hex(t);
  t=c.map(v=>v);const away=255-to;for(let i=0;i<30&&!ok(hex(t));i++)t=t.map(v=>v+(away-v)*0.07);return hex(t);}
function resolved(theme){const c=get(),p=PAL[c.palette],o={};
  for(const[k] of KEYS){let v=(theme==='dark'&&p&&p.dark&&c[k]===p.c[k]&&p.dark[k])||c[k]||(theme==='dark'?DEFDARK:{...DEF,off:DEFOFF})[k];o[k]=standOut(v,theme);}return o;}
function apply(){const th=document.documentElement.dataset.theme==='dark'?'dark':'light',r=document.documentElement.style,o=resolved(th);{const g=get();document.documentElement.dataset.palk=Object.keys(g).some(k=>k!=='palette')||(g.palette&&g.palette!=='classic')?'custom':'classic';}
  for(const[k] of KEYS){r.setProperty('--'+k,o[k]);r.setProperty('--'+k+'ink',ink(o[k]));}}
function set(k,v){const c=get();c[k]=v;localStorage.setItem('colors',JSON.stringify(c));apply();}
function palette(p){const c={...PAL[p].c};c.palette=p;localStorage.setItem('colors',JSON.stringify(c));apply();}
function reset(){localStorage.removeItem('colors');apply();}
const cur=k=>get()[k]||resolved(document.documentElement.dataset.theme==='dark'?'dark':'light')[k];
function panel(){const p=get().palette;return`<div class="colors" id="colorPanel"><p class="muted">Saved on this device only, so everyone can pick their own.</p>
  <div class="pals">${Object.entries(PAL).map(([k,v])=>`<button class="pal ${p===k?'on':''}" data-pal="${k}"><span class="sw">${['am','pm','off','vac','ot'].map(x=>`<i style="background:${v.c[x]||(x==='off'?'var(--chip2)':DEF[x])}"></i>`).join('')}</span>${v.name}</button>`).join('')}</div>
  ${KEYS.map(([k,l])=>`<label class="crow"><span class="cprev c-${k}">${l}</span><input type="color" data-ck="${k}" value="${cur(k)}" aria-label="${l} color"></label>`).join('')}
  <button class="btn sec" id="colorReset">Reset to default</button></div>`;}
function wire(root,onChange){const R=root||document;const redraw=()=>{const el=R.querySelector('#colorPanel');el.outerHTML=panel();wire(root,onChange);onChange&&onChange();};
  R.querySelectorAll('[data-pal]').forEach(b=>b.onclick=()=>{palette(b.dataset.pal);redraw();});
  R.querySelectorAll('[data-ck]').forEach(i=>i.oninput=()=>{set(i.dataset.ck,i.value);const c=get();delete c.palette;localStorage.setItem('colors',JSON.stringify(c));apply();R.querySelectorAll('[data-pal]').forEach(b=>b.classList.remove('on'));onChange&&onChange();});
  R.querySelector('#colorReset').onclick=()=>{reset();redraw();};}
window.Colors={resolved,standOut,KEYS,PAL,get,set,palette,reset,apply,panel,wire,ink};apply();})();

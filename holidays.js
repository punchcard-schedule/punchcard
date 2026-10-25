// Holiday labels (never change shifts). Actual calendar dates; for fixed-date federal holidays the OBSERVED day can differ (Sat -> Fri, Sun -> Mon).
(function(root){
const pad=n=>String(n).padStart(2,'0');const iso=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const nth=(y,m,wd,n)=>{const f=new Date(Date.UTC(y,m-1,1)).getUTCDay();return iso(y,m,1+((wd-f+7)%7)+7*(n-1));};
const last=(y,m,wd)=>{const n=new Date(Date.UTC(y,m,0)).getUTCDate();const l=new Date(Date.UTC(y,m-1,n)).getUTCDay();return iso(y,m,n-((l-wd+7)%7));};
const add=(s,k)=>new Date(Date.parse(s)+k*864e5).toISOString().slice(0,10);
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return iso(y,mo,da);}
const LIST=[
 {id:'newyear',name:"New Year's Day",short:'New Year',fed:1,f:y=>iso(y,1,1),fixed:1},
 {id:'mlk',name:'Martin Luther King Jr. Day',short:'MLK Day',fed:1,f:y=>nth(y,1,1,3)},
 {id:'presidents',name:"Presidents' Day",short:"Presidents'",fed:1,f:y=>nth(y,2,1,3)},
 {id:'memorial',name:'Memorial Day',short:'Memorial',fed:1,f:y=>last(y,5,1)},
 {id:'juneteenth',name:'Juneteenth',short:'Juneteenth',fed:1,f:y=>iso(y,6,19),fixed:1},
 {id:'independence',name:'Independence Day',short:'July 4th',fed:1,f:y=>iso(y,7,4),fixed:1},
 {id:'labor',name:'Labor Day',short:'Labor Day',fed:1,f:y=>nth(y,9,1,1)},
 {id:'columbus',name:'Columbus Day',short:'Columbus',fed:1,f:y=>nth(y,10,1,2)},
 {id:'veterans',name:'Veterans Day',short:'Veterans',fed:1,f:y=>iso(y,11,11),fixed:1},
 {id:'thanksgiving',name:'Thanksgiving Day',short:'Thanksgiving',fed:1,f:y=>nth(y,11,4,4)},
 {id:'christmas',name:'Christmas Day',short:'Christmas',fed:1,f:y=>iso(y,12,25),fixed:1},
 {id:'goodfriday',name:'Good Friday',short:'Good Friday',f:y=>add(easter(y),-2)},
 {id:'easter',name:'Easter Sunday',short:'Easter',f:easter},
 {id:'dayafterthanks',name:'Day after Thanksgiving',short:'Day after TG',f:y=>add(nth(y,11,4,4),1)},
 {id:'christmaseve',name:'Christmas Eve',short:'Xmas Eve',f:y=>iso(y,12,24)},
 {id:'nye',name:"New Year's Eve",short:"NY's Eve",f:y=>iso(y,12,31)}];
const BY=Object.fromEntries(LIST.map(h=>[h.id,h]));
function observed(h,date){if(!h.fixed)return date;const wd=new Date(Date.parse(date)).getUTCDay();return wd===6?add(date,-1):wd===0?add(date,1):date;}
function on(date,ids,custom){const c=(custom||[]).find(x=>x.d===date);if(c)return{id:'custom',name:c.n||'Contract holiday',short:(c.n||'Holiday').slice(0,12),observed:null,custom:1};if(!ids||!ids.length)return null;const y=+date.slice(0,4);for(const id of ids){const h=BY[id];if(h&&h.f(y)===date){const o=observed(h,date);return{id,name:h.name,short:h.short,observed:o!==date?o:null};}}return null;}
function forYear(y,ids){return(ids||[]).filter(i=>BY[i]).map(i=>{const h=BY[i],d=h.f(y),o=observed(h,d);return{id:i,name:h.name,date:d,observed:o!==d?o:null};}).sort((a,b)=>a.date<b.date?-1:1);}
// which built-in holiday falls on a date (used to turn detected dates into yearly holidays)
function match(date){const y=+date.slice(0,4);const h=LIST.find(h=>h.f(y)===date);return h?h.id:null;}
const cleanCustom=a=>Array.isArray(a)?[...new Map(a.filter(x=>x&&/^\d{4}-\d\d-\d\d$/.test(x.d)).map(x=>[x.d,{d:x.d,n:String(x.n||'Contract holiday').slice(0,40)}])).values()].sort((a,b)=>a.d<b.d?-1:1).slice(0,400):[];
const clean=ids=>Array.isArray(ids)?[...new Set(ids.filter(i=>BY[i]))]:[];
root.Hol={match,cleanCustom,LIST,on,forYear,easter,clean,observed:(id,d)=>observed(BY[id],d)};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=globalThis.Hol;

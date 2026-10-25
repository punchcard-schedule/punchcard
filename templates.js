// Common shift-schedule templates: OPTIONAL starting points for the build path. Nothing is preselected.
// Each crew's cycle is a string, one char per day: a shift code from `types`, '.' = off. `mon:true` = cycle day 1 is a Monday.
// `cover` documents (and tests verify) how many crews are on each shift code each cycle day.
(function(root){
const T12={D:{name:'Day',start:'06:00',hours:12,kind:'day'},N:{name:'Night',start:'18:00',hours:12,kind:'night'}};
const D12={D:T12.D};
const rot=(p,k)=>{const L=p.length;k=((k%L)+L)%L;return p.slice(L-k)+p.slice(0,L-k);}; // crew starts k days later
const crews=(names,p,step)=>names.map((n,i)=>({name:n,pat:rot(p,i*step)}));
const tonight=p=>p.replace(/D/g,'N');
const LIST=[
 {id:'4on4off-days',name:'4-on/4-off 12h (days only)',desc:'Work 4 day shifts, then 4 off; 2 crews cover days 7 days a week (8-day cycle).',types:D12,crews:crews(['A','B'],'DDDD....',4),cover:{D:1}},
 {id:'4on4off-rotating',name:'4-on/4-off 12h (rotating days/nights)',desc:'4 days, 4 off, 4 nights, 4 off; 4 crews give 24/7 coverage (16-day cycle).',types:T12,crews:crews(['A','B','C','D'],'DDDD....NNNN....',4),cover:{D:1,N:1}},
 {id:'panama',name:'2-2-3 Panama 12h',desc:'2 on, 2 off, 3 on, 2 off, 2 on, 3 off; every other weekend off; 2 day + 2 night crews (14-day cycle).',types:T12,crews:[...crews(['A','B'],'DD..DDD..DD...',7),...crews(['C','D'],'NN..NNN..NN...',7)],cover:{D:1,N:1}},
 {id:'dupont',name:'DuPont 12h',desc:'4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, 7 off; 4 crews, 24/7 (28-day cycle).',types:T12,crews:crews(['A','B','C','D'],'NNNN...DDD.NNN...DDDD.......',7),cover:{D:1,N:1}},
 {id:'pitman',name:'Pitman 2-3-2 12h',desc:'2 on, 2 off, 3 on, 2 off, 2 on, 3 off; 2 weeks of days then 2 weeks of nights; 4 crews, 24/7 (28-day cycle).',types:T12,crews:crews(['A','B','C','D'],'DD..DDD..DD...NN..NNN..NN...',7),cover:{D:1,N:1}},
 {id:'4334',name:'4-on/3-off/3-on/4-off 12h',desc:'4 on, 3 off, 3 on, 4 off; partner crews work the opposite days; 2 day + 2 night crews, 24/7 (14-day cycle).',types:T12,crews:[{name:'A',pat:'DDDD...DDD....'},{name:'B',pat:'....DDD...DDDD'},{name:'C',pat:'NNNN...NNN....'},{name:'D',pat:'....NNN...NNNN'}],cover:{D:1,N:1}},
 {id:'continental',name:'Continental 8h (rotating)',desc:'7 days, 2 off, 7 evenings, 2 off, 7 nights, 3 off; 4 crews, 3 shifts, 24/7 (28-day cycle).',types:{D:{name:'Day',start:'07:00',hours:8,kind:'day'},E:{name:'Evening',start:'15:00',hours:8,kind:'swing'},N:{name:'Night',start:'23:00',hours:8,kind:'night'}},crews:crews(['A','B','C','D'],'DDDDDDD..EEEEEEE..NNNNNNN...',7),cover:{D:1,E:1,N:1}},
 {id:'southern-swing',name:'Southern Swing 8h (3 crews)',desc:'Mon-Fri: a week of days, a week of evenings, a week of nights; weekends off; 3 crews (21-day cycle).',mon:true,types:{D:{name:'Day',start:'07:00',hours:8,kind:'day'},E:{name:'Evening',start:'15:00',hours:8,kind:'swing'},N:{name:'Night',start:'23:00',hours:8,kind:'night'}},crews:crews(['A','B','C'],'DDDDD..EEEEE..NNNNN..',7),cover:{D:1,E:1,N:1},weekdaysOnly:true},
 {id:'fixed-5-2',name:'Fixed 5-2 8h (Mon-Fri)',desc:'Monday to Friday, 8-hour day shift, weekends off (7-day cycle).',mon:true,types:{D:{name:'Day',start:'08:00',hours:8,kind:'day'}},crews:[{name:'Day crew',pat:'DDDDD..'}],cover:{D:1},weekdaysOnly:true},
 {id:'4x10',name:'4x10 (Mon-Thu)',desc:'Four 10-hour days Monday to Thursday, 3 days off (7-day cycle).',mon:true,types:{D:{name:'Day',start:'07:00',hours:10,kind:'day'}},crews:[{name:'Day crew',pat:'DDDD...'}],hours:40},
 {id:'9-80',name:'9/80',desc:'80 hours in 2 weeks: eight 9-hour days, one 8-hour Friday, every other Friday off (14-day cycle).',mon:true,types:{D:{name:'9-hour day',start:'07:00',hours:9,kind:'day'},F:{name:'8-hour Friday',start:'07:00',hours:8,kind:'day'}},crews:[{name:'Day crew',pat:'DDDDF..DDDD...'}],hours:80},
 {id:'24-48',name:'24/48 firefighter',desc:'24 hours on, 48 hours off; A/B/C shifts (3-day cycle).',types:{S:{name:'24-hour',start:'07:00',hours:24,kind:'day'}},crews:crews(['A','B','C'],'S..',1),cover:{S:1}},
 {id:'48-96',name:'48/96',desc:'48 hours on, 96 hours off; A/B/C shifts (6-day cycle).',types:{S:{name:'24-hour',start:'07:00',hours:24,kind:'day'}},crews:crews(['A','B','C'],'SS....',2),cover:{S:1}},
 {id:'7on7off',name:'7-on/7-off 12h',desc:'7 day shifts, then 7 days off; 2 crews cover days 7 days a week (14-day cycle).',types:D12,crews:crews(['A','B'],'DDDDDDD.......',7),cover:{D:1}},
];
// first Monday on/after a date
function monday(d){const t=Date.parse(d+'T00:00:00Z');const w=new Date(t).getUTCDay();return new Date(t+((8-w)%7)*864e5).toISOString().slice(0,10);}
// template -> editable config (same shape as the detection result)
function toConfig(id,start){const t=LIST.find(x=>x.id===id);if(!t)return null;const s=t.mon?monday(start):start;
  return{name:t.name,start:s,L:t.crews[0].pat.length,types:JSON.parse(JSON.stringify(t.types)),crews:t.crews.map(c=>({name:c.name,days:[...c.pat].map(x=>x==='.'?null:x)})),months:12,template:t.id};}
root.Templates={LIST,toConfig,monday,rot};
})(typeof window!=='undefined'?window:globalThis);
if(typeof module!=='undefined')module.exports=globalThis.Templates;

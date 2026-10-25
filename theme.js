// Theme: 'auto' (follow phone) | 'light' | 'dark'. Stored on this phone in localStorage.theme. Loaded in <head> to avoid a flash.
(function(){const mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
const get=()=>{const v=localStorage.getItem('theme');return v==='light'||v==='dark'?v:'auto';};
const eff=t=>t==='auto'?(mq&&mq.matches?'dark':'light'):t;
function apply(){const t=get(),e=eff(t);document.documentElement.dataset.theme=e;document.documentElement.dataset.themePref=t;
  let m=document.querySelector('meta[name=theme-color]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}m.content=e==='dark'?'#0F1114':'#171A1F';
  document.querySelectorAll('.themebtn:not(.hbtn)').forEach(b=>{b.textContent=ICON[t];b.setAttribute('aria-label','Theme: '+t+' (tap to change)');});
  if(window.Colors)Colors.apply();document.querySelectorAll('[data-theme-opt]').forEach(b=>b.classList.toggle('on',b.dataset.themeOpt===t));}
const ICON={auto:'◐',light:'☀',dark:'☾'};
function set(t){localStorage.setItem('theme',t);apply();}
function cycle(){const o=['auto','light','dark'];set(o[(o.indexOf(get())+1)%3]);}
if(mq)(mq.addEventListener?mq.addEventListener('change',apply):mq.addListener(apply));
window.Theme={get,set,cycle,apply,eff,ICON};apply();})();

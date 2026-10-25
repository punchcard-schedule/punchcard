// Product analytics (PostHog). Flip PC_ANALYTICS to false to turn it off without deleting anything.
// Privacy: no autocapture, no session recording, no input values, anonymous until identified (we never identify). Never send names or schedule contents.
window.PC_ANALYTICS=true;
window.PCA=(function(){var KEY='phc_x33VE7dfwkzAVdESmUmjTuGXz6UJinTZ4CSpePAYD2oQ',HOST='https://us.i.posthog.com',q=[],ph=null;
var test=false;try{test=localStorage.getItem('pc_test')==='1'||/[?&]pc_test=1/.test(location.search)||(navigator.webdriver===true&&localStorage.getItem('pc_analytics_local')!=='1');}catch(e){}
var on=window.PC_ANALYTICS&&!test&&(!/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)||localStorage.getItem('pc_analytics_local')==='1');
function track(ev,props){if(!on)return;try{ph?ph.capture(ev,props||{}):q.push([ev,props||{}]);}catch(e){}}
function load(){if(!on)return;var s=document.createElement('script');s.async=true;s.src='https://us-assets.i.posthog.com/static/array.js';
s.onload=function(){try{var p=window.posthog;if(!p||!p.init)return;p.init(KEY,{api_host:HOST,person_profiles:'identified_only',autocapture:false,capture_pageview:false,capture_pageleave:false,
disable_session_recording:true,session_recording:{maskAllInputs:true,maskTextSelector:'*'},mask_all_text:true,mask_all_element_attributes:true,disable_surveys:true,advanced_disable_feature_flags:true,
property_denylist:['$current_url','$pathname','$referrer','$initial_current_url','$initial_referrer'],persistence:'localStorage'});
p.register({app_version:(typeof Beta!=='undefined'&&Beta.VERSION)||'',standalone:matchMedia('(display-mode: standalone)').matches});ph=p;q.splice(0).forEach(function(a){p.capture(a[0],a[1]);});}catch(e){}};
document.head.appendChild(s);}
if(document.readyState==='complete')load();else addEventListener('load',load);
return{track:track,enabled:function(){return on;}};})();

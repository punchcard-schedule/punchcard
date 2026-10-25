// App shell: served from this phone's cache instantly (stale-while-revalidate), so returning users never wait for the server to wake.
// API calls, live events and calendar feeds always go to the network. Works under any path prefix (GitHub Pages project site).
const C='punchcard-v36',ASSETS=['./','index.html','app.js','builder.js','theme.js','colors.js','app.css','rotation.js','holidays.js','rotimport.js','import.js','onboard.js','beta.js','analytics.js','requests.js','partner.js','templates.js','detect.js','design.js','template.json','manifest.webmanifest','icon-192.png','icon-180.png','icon-512.png','icon-512-maskable.png','logo.png','favicon.png','fonts/Barlow-500.ttf','fonts/Barlow-600.ttf','fonts/Barlow-700.ttf','fonts/Barlow-800.ttf','fonts/BarlowCondensed-700.ttf','fonts/BarlowCondensed-800.ttf'];
const SC=new URL(self.registration.scope).pathname; // e.g. '/' or '/punchcard/'
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const TYPE={js:'javascript',mjs:'javascript',css:'css',json:'json',webmanifest:'json',png:'image',html:'html'};
// never cache a hosting provider's "waking up" page in place of our files
async function good(r,key){if(!r||!r.ok||r.type==='opaque')return false;const ext=(key.split('.').pop()||'html');const ct=r.headers.get('content-type')||'';
  const want=TYPE[ext]||(key.endsWith('/')?'html':null);if(want&&!ct.includes(want))return false;
  if(want==='html'){const t=await r.clone().text();return t.includes('name="pc-api"');}return true;}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  const rel=u.pathname.startsWith(SC)?u.pathname.slice(SC.length):null;if(rel===null)return;
  if(/^(api|ics|vendor)\//.test(rel))return; // network (vendor files are large; the browser caches them)
  const nav=e.request.mode==='navigate'||rel===''||/^(v|e)\//.test(rel);const key=nav?SC+'index.html':u.pathname;
  e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(key);
    const net=fetch(nav?SC+'index.html':e.request,{cache:'no-cache'}).then(async r=>{if(await good(r,key))await c.put(key,r.clone());return r;}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}const r=await net;return r||new Response('Offline',{status:503});}));});
self.addEventListener('push',e=>{const d=e.data?e.data.json():{title:'Shift reminder'};e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'icon-192.png'}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l.length?l[0].focus():clients.openWindow(SC)));});

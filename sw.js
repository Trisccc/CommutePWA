const CACHE="commute-pwa-v6";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icon.svg","./icon-180.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.hostname.includes("etabus.gov.hk")||u.hostname.includes("etagmb.gov.hk")){e.respondWith(fetch(e.request));return}
  // Always prefer fresh app files online; fall back to the PWA cache offline.
  if(u.origin===self.location.origin)e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return r;
  }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))));
});

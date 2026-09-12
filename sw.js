const CACHE="commute-pwa-v7-segments";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icon.svg","./icon-180.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("commute-pwa-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    try{
      const r=await fetch(e.request);
      if(!r.ok)throw new Error("HTTP "+r.status);
      const key=new Request(u.origin+u.pathname);
      await c.put(key,r.clone());
      return r;
    }catch{
      const cached=await c.match(e.request,{ignoreSearch:true});
      if(cached)return cached;
      if(e.request.mode==="navigate")return (await c.match("./index.html"))||Response.error();
      return Response.error();
    }
  })());
});

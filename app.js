
const STORAGE={trips:"commute_trips_v2",settings:"commute_settings_v2",active:"commute_active_trip_v1"};
const ROUTES={
toSchool:[
{id:"diamondHillShuttle",name:"第一城 → 钻石山 → HKUST Shuttle",short:"钻石山校巴",baseline:72,penalty:0,explain:"工作日早上优先。先到钻石山，再走到 Sheung Yuen Street 搭校巴。",segments:[["Home → 第一城站",8],["港铁：第一城 → 钻石山",24],["步行至上元街校巴站",10],["等候 HKUST Shuttle",6],["校巴 → HKUST",24]]},
{id:"diamondHill91",name:"第一城 → 钻石山 → 91",short:"钻石山 → 91",baseline:86,penalty:4,explain:"错过校巴时的稳定备选；会参考 91 实时 ETA。",segments:[["Home → 第一城站",8],["港铁：第一城 → 钻石山",24],["前往钻石山巴士总站",6],["等候 91",6],["91 → HKUST 北站",42]]},
{id:"choiHung11",name:"第一城 → 彩虹 → 11 小巴",short:"彩虹 → 11",baseline:62,penalty:2,explain:"先到彩虹再转 11 小巴，符合你避免钻石山 91M 绕路的习惯。",segments:[["Home → 第一城站",8],["港铁：第一城 → 彩虹",22],["前往龙翔道小巴站",7],["等候 11 小巴",5],["11 小巴 → HKUST 北站",20]]},
{id:"choiHung91M",name:"第一城 → 彩虹 → 91M",short:"彩虹 → 91M",baseline:74,penalty:2,explain:"从彩虹转车站－碧海楼上车，会与 11 小巴比较。",segments:[["Home → 第一城站",8],["港铁：第一城 → 彩虹",22],["步行至碧海楼站",8],["等候 91M",6],["91M → HKUST 北站",30]]},
{id:"diamondHill91M",name:"第一城 → 钻石山 → 91M",short:"钻石山 → 91M",baseline:74,penalty:12,explain:"你明确不喜欢这段 91M，因此除非明显省时，否则不会优先推荐。",segments:[["Home → 第一城站",8],["港铁：第一城 → 钻石山",24],["前往钻石山巴士总站",6],["等候 91M",6],["91M → HKUST 北站",30]]}],
toHome:[
{id:"returnDiamondShuttle",name:"HKUST → 钻石山 Shuttle → MTR → 第一城",short:"校巴 → 钻石山",baseline:76,penalty:0,explain:"有合适校巴时优先，下车后转港铁回第一城。",segments:[["校内步行至校巴站",7],["等候 HKUST Shuttle",7],["校巴 → 钻石山",24],["港铁：钻石山 → 第一城",25],["第一城站 → Home",13]]},
{id:"returnCustom1015",name:"HKUST → 10:15 个人 Shuttle → 九龙塘 → MTR",short:"10:15 → 九龙塘",baseline:72,penalty:0,custom:true,explain:"这是你提供的个人规则；当前官方学生校巴网页未列出，因此默认关闭。",segments:[["校内步行至校巴站",7],["等候 10:15 Shuttle",5],["Shuttle → 九龙塘",25],["港铁：九龙塘 → 第一城",23],["第一城站 → Home",12]]},
{id:"returnBus",name:"HKUST → 91 / 91M → 牛池湾 / 彩虹 → MTR",short:"91/91M → MTR",baseline:86,penalty:3,explain:"没有合适校巴时使用，到牛池湾 / 彩虹后转港铁。",segments:[["校内步行至南站",7],["等候 91 / 91M",7],["巴士 → 牛池湾 / 彩虹",40],["港铁 → 第一城",22],["第一城站 → Home",10]]}]};
const SHUTTLE={
toSchool:["08:15","08:20","08:25","08:30","08:35","08:40","08:45","08:55"],
toHome:["17:50","18:00","18:10","18:20","18:30","18:40","18:50","19:00","22:15"]};
const defaults={home:null,school:null,discomfort91M:12,custom1015:false,homeRadius:800,schoolRadius:1200};
const $=id=>document.getElementById(id);
const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??structuredClone(f)}catch{return structuredClone(f)}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let settings=load(STORAGE.settings,defaults),trips=load(STORAGE.trips,[]),active=load(STORAGE.active,null);
let currentDirection="toSchool",currentLocation=null,expandedRouteId=null,refreshTimer=null,locationWatchdog=null,directionManuallySet=false;
let live={kmb:{},gmb:{},updated:null};

// “彩虹”是位置；91M 去科大的实际候车站是碧海楼 (WT340)。
const KMB_TARGETS={
  toSchool:{
    "91":[{stop:"0B41334D66E94275",bound:"I",name:"鑽石山站巴士總站 (WT963)",lat:22.340865,lon:114.201593},{stop:"5169C5ACEA8B1746",bound:"I",name:"彩虹轉車站－碧海樓 (WT340)",lat:22.335915,lon:114.204677}],
    "91M":[{stop:"5169C5ACEA8B1746",bound:"I",name:"彩虹轉車站－碧海樓 (WT340)",lat:22.335915,lon:114.204677},{stop:"53889000AA9C33E2",bound:"I",name:"鑽石山站巴士總站 (WT964)",lat:22.340879,lon:114.201550}]
  },
  toHome:{
    "91":[{stop:"B002CEF0DBC568F5",bound:"O",name:"香港科技大學（南）(SK950)",lat:22.333360,lon:114.262881}],
    "91M":[{stop:"B002CEF0DBC568F5",bound:"O",name:"香港科技大學（南）(SK950)",lat:22.333360,lon:114.262881}]
  }
};
const GMB_TARGETS={
  toSchool:{routeSeq:2,stopSeq:1,name:"龍翔道，近牛池灣消防局",lat:22.335020,lon:114.208131},
  toHome:{routeSeq:1,stopSeq:7,name:"香港科技大學（南站）",lat:22.333134,lon:114.262874}
};

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function minsNow(d=new Date()){return d.getHours()*60+d.getMinutes()}
function parseHM(s){let [h,m]=s.split(":").map(Number);return h*60+m}
function weekday(d=new Date()){let x=d.getDay();return x>=1&&x<=5}
function fmtTime(d){return new Intl.DateTimeFormat("zh-HK",{hour:"2-digit",minute:"2-digit",hour12:false}).format(d)}
function fmtDate(d){return new Intl.DateTimeFormat("zh-HK",{month:"short",day:"numeric",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(d)}
function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function toast(msg){let t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2200)}
function routeById(id){return [...ROUTES.toSchool,...ROUTES.toHome].find(r=>r.id===id)}
function contextKey(id,dir,d=new Date()){let bucket=Math.floor(minsNow(d)/120);return `${id}|${dir}|${weekday(d)?"wd":"we"}|${bucket}`}
function hav(a,b){const R=6371000,rad=x=>x*Math.PI/180;let dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),la1=rad(a.lat),la2=rad(b.lat);let h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}

function ewma(arr){
  if(!arr.length)return null;
  let mean=null,varr=25,alpha=.24;
  [...arr].sort((a,b)=>a.timestamp-b.timestamp).forEach(t=>{
    let x=Number(t.duration);if(!Number.isFinite(x))return;
    if(mean===null)mean=x;
    else{let diff=x-mean;mean=(1-alpha)*mean+alpha*x;varr=(1-alpha)*varr+alpha*diff*diff}
  });
  return {mean,sd:Math.sqrt(Math.max(9,varr)),n:arr.length};
}
function learned(route,dir,now=new Date()){
  let all=trips.filter(t=>t.routeId===route.id&&t.direction===dir);
  let same=all.filter(t=>t.contextKey===contextKey(route.id,dir,now));
  let g=ewma(all),c=ewma(same);
  if(!g)return {mean:route.baseline,sd:8,n:0};
  let w=clamp(.28+g.n*.055,.28,.88),pm=g.mean,sd=g.sd;
  if(c&&c.n>=2){pm=c.mean*.68+g.mean*.32;sd=c.sd*.7+g.sd*.3}
  return {mean:route.baseline*(1-w)+pm*w,sd:clamp(sd,4,18),n:g.n};
}
function nextShuttle(dir,now=new Date()){
  if(!weekday(now))return null;
  let list=SHUTTLE[dir],buffer=dir==="toSchool"?30:7,nowM=minsNow(now);
  return list.find(t=>parseHM(t)>=nowM+buffer)||null;
}
function adjustment(route,dir,now=new Date()){
  let p=route.id==="diamondHill91M"?Number(settings.discomfort91M):route.penalty||0,reason="";
  if(route.id==="diamondHillShuttle"){
    let s=nextShuttle("toSchool",now);if(!s)p+=80;else{p+=clamp(parseHM(s)-(minsNow(now)+30),0,14);reason=`下一班校巴 ${s}`}
  }
  if(route.id==="returnDiamondShuttle"){
    let s=nextShuttle("toHome",now);if(!s)p+=70;else{p+=clamp(parseHM(s)-minsNow(now),0,18);reason=`下一班去钻石山 ${s}`}
  }
  if(route.id==="returnCustom1015"){
    let nowM=minsNow(now);if(!settings.custom1015||!weekday(now)||nowM>610||615<nowM+5)p+=999;else{p+=615-nowM;reason="个人规则：10:15 → 九龙塘"}
  }
  if(route.id==="diamondHill91"&&Number.isFinite(live.kmb["91"]?.minutes)){p+=clamp(live.kmb["91"].minutes-4,-4,12);reason=`91 约 ${live.kmb["91"].minutes} 分钟`}
  if(route.id==="choiHung91M"&&live.kmb["91M"]?.stop?.includes("碧海樓")&&Number.isFinite(live.kmb["91M"].minutes)){p+=clamp(live.kmb["91M"].minutes-4,-4,12);reason=`91M 约 ${live.kmb["91M"].minutes} 分钟`}
  if(route.id==="diamondHill91M"&&live.kmb["91M"]?.stop?.includes("鑽石山")&&Number.isFinite(live.kmb["91M"].minutes)){p+=clamp(live.kmb["91M"].minutes-4,-4,12);reason=`91M 约 ${live.kmb["91M"].minutes} 分钟`}
  if(route.id==="choiHung11"){
    let w=live.gmb["11"]?.minutes;
    if(Number.isFinite(w)){p+=clamp(w-4,-4,12);reason=`11 小巴约 ${w} 分钟`}
  }
  if(route.id==="returnBus"){
    let waits=[live.kmb["91"]?.minutes,live.kmb["91M"]?.minutes,live.gmb["11"]?.minutes].filter(Number.isFinite);
    if(waits.length){let w=Math.min(...waits);p+=clamp(w-4,-4,12);reason=`当前最快约 ${w} 分钟`}
  }
  return {p,reason};
}
function recs(dir=currentDirection,now=new Date()){
  return ROUTES[dir].map(r=>{
    let l=learned(r,dir,now),a=adjustment(r,dir,now),preference=r.id==="diamondHill91M"?Number(settings.discomfort91M):(r.penalty||0),pred=l.mean+Math.min(a.p-preference,60);
    return {...r,l,pred,score:l.mean+a.p,confidence:clamp(.5+l.n*.045,.5,.93),liveReason:a.reason}
  }).filter(r=>r.score<300).sort((a,b)=>a.score-b.score);
}
function segmentMinutes(route,label,fallback){
  if(!label.startsWith("等候"))return fallback;
  if(label.includes("91 / 91M"))return Math.min(...[live.kmb["91"]?.minutes,live.kmb["91M"]?.minutes,live.gmb["11"]?.minutes].filter(Number.isFinite),fallback);
  if(label.includes("91M")&&Number.isFinite(live.kmb["91M"]?.minutes))return live.kmb["91M"].minutes;
  if(label.includes("91")&&Number.isFinite(live.kmb["91"]?.minutes))return live.kmb["91"].minutes;
  if(label.includes("11")&&Number.isFinite(live.gmb["11"]?.minutes))return live.gmb["11"].minutes;
  return fallback;
}
function renderRecs(){
  let rr=recs();
  $("recommendationList").innerHTML=rr.map((r,i)=>{
    let eta=Math.round(r.pred),lo=Math.max(1,Math.round(eta-r.l.sd*.65)),hi=Math.round(eta+r.l.sd*.65);
    let open=expandedRouteId===r.id;
    return `<article class="route-card ${i===0?"recommended":""} ${open?"expanded":""}">
      <button class="route-toggle" data-route-toggle="${r.id}" aria-expanded="${open}">
      <div class="route-top"><div>${i===0?'<span class="route-badge">推荐</span>':""}<h4>${esc(r.name)}</h4></div><div class="route-eta">${eta} min</div></div>
      <p class="muted">${esc(r.explain)}</p>
      <div class="route-meta"><span class="pill">${r.l.n?`根据 ${r.l.n} 次你的记录`:"目前使用初始估计"}</span><span class="pill">大致 ${lo}–${hi} min</span>${r.liveReason?`<span class="pill">${esc(r.liveReason)}</span>`:""}</div>
      <div class="confidence-bar"><span style="width:${Math.round(r.confidence*100)}%"></span></div>
      <span class="route-more">${open?"收起分段":"查看分段时间"}<span class="chevron">⌄</span></span>
      </button>
      <div class="route-details" ${open?"":"hidden"}>
        ${r.segments.map(([label,minutes],idx)=>`<div class="route-segment"><span class="segment-dot">${idx+1}</span><span class="segment-label">${esc(label)}</span><strong>约 ${segmentMinutes(r,label,minutes)} 分</strong></div>`).join("")}
        <p class="segment-note">分段为当前估计；候车部分会随实时 ETA 更新，总时间也会继续根据你的记录学习。</p>
      </div>
    </article>`;
  }).join("");
  if(rr[0]){
    let r=rr[0],arr=new Date(Date.now()+r.pred*60000),lo=new Date(Date.now()+Math.max(1,r.pred-r.l.sd*.65)*60000),hi=new Date(Date.now()+(r.pred+r.l.sd*.65)*60000);
    $("arrivalTime").textContent=fmtTime(arr);
    $("arrivalRange").textContent=`约 ${fmtTime(lo)}–${fmtTime(hi)} · ${Math.round(r.confidence*100)}% 个性化信心`;
  }
}
function renderLearning(){
  $("tripCount").textContent=trips.length;
  if(!trips.length){$("bestLearnedRoute").textContent="—";$("learningSummary").textContent="完成几次通勤后，网站会逐渐使用你的真实耗时修正 ETA。";return}
  let c={};trips.forEach(t=>c[t.routeId]=(c[t.routeId]||0)+1);
  let best=Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0],recent=trips[0];
  $("bestLearnedRoute").textContent=routeById(best)?.short||best;
  $("learningSummary").textContent=`最近一次：${routeById(recent.routeId)?.short||recent.routeId}，实际 ${Math.round(recent.duration)} 分钟。近期记录权重更高，但一次异常堵车不会完全带偏模型。`;
}
function setDirection(dir,manual=true){
  let changed=currentDirection!==dir;
  currentDirection=dir;
  if(manual)directionManuallySet=true;
  if(changed){live.kmb={};live.gmb={};live.updated=null}
  document.querySelectorAll(".seg-btn").forEach(b=>b.classList.toggle("active",b.dataset.direction===dir));
  $("directionTitle").textContent=dir==="toSchool"?"去 HKUST":"回第一城";
  if(manual)$("locationLabel").textContent="已手动选择方向";
  expandedRouteId=null;renderAll();updateRecordRoutes();
  if(manual||changed)scheduleLiveRefresh();
}
function inferDirection(){
  if(directionManuallySet){$("locationLabel").textContent="已手动选择方向";return}
  if(!currentLocation){setDirection(new Date().getHours()<13?"toSchool":"toHome",false);$("locationLabel").textContent="未取得位置 · 暂按时间判断";return}
  let here={lat:currentLocation.latitude,lon:currentLocation.longitude};
  if(settings.home&&hav(here,settings.home)<=settings.homeRadius){setDirection("toSchool",false);$("locationLabel").textContent="你在 Home 附近";return}
  if(settings.school&&hav(here,settings.school)<=settings.schoolRadius){setDirection("toHome",false);$("locationLabel").textContent="你在 HKUST 附近";return}
  setDirection(new Date().getHours()<13?"toSchool":"toHome",false);$("locationLabel").textContent="你在通勤区域 · 暂结合时间判断";
}
function locationProblem(error){
  clearTimeout(locationWatchdog);inferDirection();
  let denied=error?.code===1,unavailable=error?.code===2;
  $("gpsText").textContent=denied?"已拒绝":unavailable?"不可用":"超时";
  $("locationLabel").textContent=denied?"Safari 未允许定位 · 请点下方重试":unavailable?"系统暂时无法取得位置":"定位请求超时 · 请点下方重试";
  $("locationRetryBtn").hidden=false;$("locationRetryBtn").disabled=false;$("locationRetryBtn").textContent="使用我的位置";
}
function requestLocation(userInitiated=false){
  if(!navigator.geolocation){locationProblem({code:2});return}
  if(!window.isSecureContext){locationProblem({code:2});$("locationLabel").textContent="定位需要 HTTPS 网站";return}
  clearTimeout(locationWatchdog);$("locationRetryBtn").disabled=true;
  if(userInitiated){$("locationRetryBtn").hidden=false;$("locationRetryBtn").textContent="正在请求定位…";$("locationLabel").textContent="请在 Safari 弹窗中选择允许"}
  locationWatchdog=setTimeout(()=>locationProblem({code:3}),10000);
  navigator.geolocation.getCurrentPosition(p=>{
    clearTimeout(locationWatchdog);
    currentLocation={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};
    $("gpsDot").classList.add("on");$("gpsText").textContent=`±${Math.round(p.coords.accuracy)}m`;$("locationRetryBtn").hidden=true;inferDirection();updatePlaceStatus();scheduleLiveRefresh();
  },locationProblem,{enableHighAccuracy:true,timeout:8000,maximumAge:30000});
}
function updateRecordRoutes(){
  let d=$("recordDirection").value||currentDirection;
  $("recordRoute").innerHTML=ROUTES[d].filter(r=>!r.custom||settings.custom1015).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("");
}
function openRecord(useActive=false){
  $("recordDirection").value=currentDirection;updateRecordRoutes();$("recordDuration").value="";$("recordNote").value="";
  if(useActive&&active){
    let m=Math.max(1,Math.round((Date.now()-active.startedAt)/60000));
    $("recordDirection").value=active.direction;updateRecordRoutes();if(active.routeId)$("recordRoute").value=active.routeId;$("recordDuration").value=m;$("recordTitle").textContent="结束并记录这次通勤";
  }else $("recordTitle").textContent="记录这次通勤";
  $("recordDialog").showModal();
}
function saveRecord(){
  let duration=Number($("recordDuration").value);if(!Number.isFinite(duration)||duration<=0){toast("请填写实际耗时");return}
  let dir=$("recordDirection").value,id=$("recordRoute").value,now=new Date();
  trips.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),timestamp:now.getTime(),direction:dir,routeId:id,duration,note:$("recordNote").value.trim(),contextKey:contextKey(id,dir,now)});
  save(STORAGE.trips,trips);active=null;localStorage.removeItem(STORAGE.active);$("recordDialog").close();renderAll();toast("已保存，ETA 模型已更新");
}
function updateActive(){
  $("startCommuteBtn").textContent=active?`结束通勤 · 已 ${Math.max(0,Math.round((Date.now()-active.startedAt)/60000))} 分钟`:"开始这次通勤";
}
function toggleActive(){
  if(!active){let b=recs()[0];active={startedAt:Date.now(),direction:currentDirection,routeId:b?.id||null};save(STORAGE.active,active);updateActive();toast("已开始记录这次通勤")}
  else openRecord(true);
}
function updatePlaceStatus(){$("placeStatus").textContent=`${settings.home?"Home ✓":"Home 未设置"} · ${settings.school?"HKUST ✓":"HKUST 未设置"}`}
function savePlace(which){
  if(!currentLocation){toast("还没有取得 GPS 位置");requestLocation();return}
  settings[which]={lat:currentLocation.latitude,lon:currentLocation.longitude};save(STORAGE.settings,settings);updatePlaceStatus();inferDirection();toast(which==="home"?"已保存 Home":"已保存 HKUST");
}
function openSettings(){
  $("penaltyRange").value=settings.discomfort91M;$("penaltyValue").textContent=settings.discomfort91M;$("custom1015Toggle").checked=!!settings.custom1015;updatePlaceStatus();$("settingsDialog").showModal();
}
function renderHistory(){
  $("historyList").innerHTML=trips.length?trips.map(t=>`<article class="history-item"><div class="history-top"><div class="history-title">${esc(routeById(t.routeId)?.short||t.routeId)}</div><div class="history-duration">${Math.round(t.duration)} min</div></div><p>${t.direction==="toSchool"?"去 HKUST":"回第一城"} · ${fmtDate(new Date(t.timestamp))}</p>${t.note?`<p>${esc(t.note)}</p>`:""}<button class="delete-btn" data-delete="${t.id}">删除这条记录</button></article>`).join(""):'<div class="mini-card"><p class="muted">还没有历史记录。</p></div>';
}
function openHistory(){renderHistory();$("historyDialog").showModal()}

async function fetchJSON(url,timeout=7000){
  let c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);
  try{let r=await fetch(url,{signal:c.signal,cache:"no-store"});if(!r.ok)throw Error(r.status);return await r.json()}finally{clearTimeout(timer)}
}
function locationPoint(){return currentLocation?{lat:currentLocation.latitude,lon:currentLocation.longitude}:null}
function pickTarget(targets){
  let here=locationPoint();if(!here)return {...targets[0],matchReason:"按当前方向"};
  let ranked=targets.map(t=>({...t,distance:hav(here,t)})).sort((a,b)=>a.distance-b.distance);
  if(ranked[0].distance<=2500)return {...ranked[0],matchReason:`距你约 ${ranked[0].distance<1000?Math.round(ranked[0].distance)+" m":(ranked[0].distance/1000).toFixed(1)+" km"}`};
  return {...targets[0],matchReason:"下一转乘点"};
}
async function getKmb(route,dir=currentDirection){
  let target=pickTarget(KMB_TARGETS[dir][route]);
  try{
    let rows=(await fetchJSON(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${target.stop}/${route}/1`))?.data||[];
    let wanted=rows.filter(x=>x.eta&&x.dir===target.bound).map(x=>new Date(x.eta)).filter(d=>!isNaN(d)&&d>new Date()).sort((a,b)=>a-b);
    if(!wanted.length)return null;
    return {minutes:Math.max(0,Math.round((wanted[0]-new Date())/60000)),times:wanted.slice(0,3).map(fmtTime),stop:target.name,matchReason:target.matchReason,direction:dir};
  }catch{return null}
}
async function getGmb(dir=currentDirection){
  let target=GMB_TARGETS[dir];
  try{
    let route=(await fetchJSON("https://data.etagmb.gov.hk/route/NT/11"))?.data?.[0];
    if(!route?.route_id)return null;
    let ep=await fetchJSON(`https://data.etagmb.gov.hk/eta/route-stop/${route.route_id}/${target.routeSeq}/${target.stopSeq}`);
    let rows=ep?.data?.eta||[];
    let times=rows.map(x=>({date:new Date(x.timestamp),diff:Number(x.diff)})).filter(x=>!isNaN(x.date)&&x.date>new Date()).sort((a,b)=>a.date-b.date);
    if(!times.length)return null;
    let here=locationPoint(),distance=here?hav(here,target):null;
    return {minutes:Number.isFinite(times[0].diff)?times[0].diff:Math.max(0,Math.round((times[0].date-new Date())/60000)),times:times.slice(0,3).map(x=>fmtTime(x.date)),stop:target.name,matchReason:distance!==null&&distance<=2500?`距你约 ${distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1)+" km"}`:"按当前方向",direction:dir};
  }catch{return null}
}
function liveCard(title,data,fallback){
  return data?`<div class="mini-card"><div class="mini-title">${title}<span class="direction-chip">${data.direction==="toSchool"?"去科大":"回第一城"}</span></div><div class="live-times">${data.times.map(t=>`<span class="live-time">${t}</span>`).join("")}</div><p class="muted small">${esc(data.stop)} · 约 ${data.minutes} 分钟</p><p class="match-reason">${esc(data.matchReason)}</p></div>`:
  `<div class="mini-card"><div class="mini-title">${title}</div><p class="big-mini">—</p><p class="muted small">${fallback}</p></div>`;
}
function earlier(a,b){if(!a)return b;if(!b)return a;return a.minutes<=b.minutes?a:b}
function renderLive(){
  let matching=data=>data?.direction===currentDirection?data:null;
  $("liveTransit").innerHTML=liveCard("KMB 91",matching(live.kmb["91"]),"当前方向的候车站暂时没有 ETA")+liveCard("KMB 91M",matching(live.kmb["91M"]),"当前方向的候车站暂时没有 ETA")+liveCard("GMB 11",matching(live.gmb["11"]),"当前方向的候车站暂时没有 ETA")+`<div class="mini-card"><div class="mini-title">HKUST Shuttle<span class="direction-chip">${currentDirection==="toSchool"?"去科大":"回第一城"}</span></div><p class="big-mini">${esc(nextShuttle(currentDirection)||"今天无合适班次")}</p><p class="muted small">钻石山方向 · 2026 秋季</p></div>`;
  $("liveUpdated").textContent=live.updated?fmtTime(live.updated)+" 更新":"尚未读取";
}
async function refreshLive(){
  let requestedDirection=currentDirection;
  $("refreshBtn").disabled=true;$("refreshBtn").textContent="读取中…";
  let rs=await Promise.allSettled([getKmb("91",requestedDirection),getKmb("91M",requestedDirection),getGmb(requestedDirection)]);
  if(requestedDirection!==currentDirection){$("refreshBtn").disabled=false;$("refreshBtn").textContent="刷新";return scheduleLiveRefresh()}
  [live.kmb["91"],live.kmb["91M"],live.gmb["11"]]=rs.map(x=>x.status==="fulfilled"?x.value:null);
  live.updated=new Date();renderAll();$("refreshBtn").disabled=false;$("refreshBtn").textContent="刷新";
}
function scheduleLiveRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshLive,250)}
function renderAll(){renderRecs();renderLearning();renderLive();updateActive()}

document.querySelectorAll(".seg-btn").forEach(b=>b.onclick=()=>setDirection(b.dataset.direction,true));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll(".tag").forEach(b=>b.onclick=()=>{$("recordNote").value=[$("recordNote").value.trim(),b.dataset.note].filter(Boolean).join("；")});
$("settingsBtn").onclick=openSettings;$("navSettings").onclick=openSettings;$("historyBtn").onclick=openHistory;$("navHistory").onclick=openHistory;
$("manualRecordBtn").onclick=()=>openRecord(false);$("navRecord").onclick=()=>openRecord(false);$("startCommuteBtn").onclick=toggleActive;$("recordDirection").onchange=updateRecordRoutes;$("saveRecordBtn").onclick=saveRecord;$("refreshBtn").onclick=refreshLive;
$("setHomeBtn").onclick=()=>savePlace("home");$("setSchoolBtn").onclick=()=>savePlace("school");
$("locationRetryBtn").onclick=()=>requestLocation(true);
$("penaltyRange").oninput=e=>{$("penaltyValue").textContent=e.target.value;settings.discomfort91M=Number(e.target.value);save(STORAGE.settings,settings);renderRecs()};
$("custom1015Toggle").onchange=e=>{settings.custom1015=e.target.checked;save(STORAGE.settings,settings);updateRecordRoutes();renderRecs()};
$("historyList").onclick=e=>{let id=e.target.dataset.delete;if(!id)return;trips=trips.filter(t=>t.id!==id);save(STORAGE.trips,trips);renderHistory();renderAll();toast("已删除")};
$("recommendationList").onclick=e=>{let b=e.target.closest("[data-route-toggle]");if(!b)return;expandedRouteId=expandedRouteId===b.dataset.routeToggle?null:b.dataset.routeToggle;renderRecs()};
$("exportBtn").onclick=()=>{let blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),settings,trips},null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`commute-data-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
$("clearDataBtn").onclick=()=>{if(confirm("确定清除所有通勤历史吗？Home / HKUST 设置会保留。")){trips=[];save(STORAGE.trips,trips);renderAll();toast("历史记录已清空")}};

if("serviceWorker"in navigator)window.addEventListener("load",async()=>{try{let r=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});r.update()}catch{}});
renderAll();updateRecordRoutes();requestLocation();setTimeout(scheduleLiveRefresh,700);setInterval(()=>{updateActive();renderRecs()},60000);

// Segment recorder v3. Legacy total-only history is retained without fabricated segments.
(() => {
  const KEY='commute_segment_state_v3';
  const types={walk:'步行',wait:'等车',mtr:'地铁',bus:'巴士',minibus:'小巴',shuttle:'校巴',transfer:'换乘'};
  const S=(type,service,from,to,minutes)=>({id:[type,service,from,to].join('|'),type,service,from,to,label:from+' → '+to,baselineMinutes:minutes});
  const W=(service,at,m)=>S('wait',service,at,'等候 '+service,m);
  const walkOut=S('walk','walking','Home','第一城站',8);
  const railOut=[walkOut,W('屯马线','第一城站',3),S('mtr','屯马线','第一城','钻石山',21)];
  const railChoi=[...railOut.slice(0,2),railOut[2],S('transfer','MTR','钻石山屯马线','观塘线月台',2),W('观塘线','钻石山站',2),S('mtr','观塘线','钻石山','彩虹',3)];
  // Baselines remain provisional estimates; stop-specific observations replace them gradually.
  const plans={
    diamondHillShuttle:[...railOut,S('transfer','walking','钻石山月台','上元街校巴站',10),W('HKUST Shuttle','上元街校巴站',6),S('shuttle','HKUST Shuttle','钻石山','HKUST',24)],
    diamondHill91:[...railOut,S('transfer','walking','钻石山月台','钻石山巴士总站',6),W('91','钻石山巴士总站',6),S('bus','91','钻石山','HKUST 北站',42)],
    diamondHill91M:[...railOut,S('transfer','walking','钻石山月台','钻石山巴士总站',6),W('91M','钻石山巴士总站',6),S('bus','91M','钻石山','HKUST 北站',30)],
    choiHung11:[...railChoi,S('transfer','walking','彩虹月台','龙翔道小巴站',7),W('11','龙翔道小巴站',5),S('minibus','11','彩虹','HKUST 北站',20)],
    choiHung91M:[...railChoi,S('transfer','walking','彩虹月台','碧海楼站',8),W('91M','碧海楼站',6),S('bus','91M','彩虹','HKUST 北站',30)]
  };
  const returnRail=(station)=>station==='钻石山'?[S('transfer','walking','钻石山校巴下车处','钻石山月台',4),W('屯马线','钻石山站',3),S('mtr','屯马线','钻石山','第一城',21)]:station==='九龙塘'?[S('transfer','walking','九龙塘校巴下车处','九龙塘月台',4),W('东铁线','九龙塘站',3),S('mtr','东铁线','九龙塘','大围',6),S('transfer','MTR','大围东铁线','屯马线月台',3),W('屯马线','大围站',3),S('mtr','屯马线','大围','第一城',8)]:[S('transfer','walking','牛池湾 / 彩虹巴士站','彩虹月台',6),W('观塘线','彩虹站',3),S('mtr','观塘线','彩虹','钻石山',3),S('transfer','MTR','钻石山观塘线','屯马线月台',3),W('屯马线','钻石山站',3),S('mtr','屯马线','钻石山','第一城',21)];
  const homeWalk=S('walk','walking','第一城站','Home',10);
  plans.returnDiamondShuttle=[S('walk','walking','HKUST','HKUST 校巴站',7),W('HKUST Shuttle','HKUST 校巴站',7),S('shuttle','HKUST Shuttle','HKUST','钻石山',24),...returnRail('钻石山'),homeWalk];
  plans.returnCustom1015=[S('walk','walking','HKUST','HKUST 个人校巴站',7),W('个人 10:15 Shuttle','HKUST 个人校巴站',5),S('shuttle','个人 10:15 Shuttle','HKUST','九龙塘',25),...returnRail('九龙塘'),homeWalk];
  const oldBus=ROUTES.toHome.find(r=>r.id==='returnBus');
  oldBus.legacyOnly=true;
  ['91','91M'].forEach(service=>{
    const id='returnBus'+service;
    ROUTES.toHome.push({...oldBus,legacyOnly:false,id,name:'HKUST → '+service+' → 彩虹 → 第一城',short:service+' → MTR'});
    plans[id]=[S('walk','walking','HKUST','HKUST 南站',7),W(service,'HKUST 南站',7),S('bus',service,'HKUST 南站','牛池湾 / 彩虹',40),...returnRail('彩虹'),homeWalk];
  });
  let state=load(KEY,null),selected=null,stats={exact:{},service:{},type:{},context:{},pace:null};
  if(!state){state={version:3,revision:0,trips:Array.isArray(trips)?trips:[],active:active||null,distances:{}};try{save(KEY,state)}catch{toast('储存不可用；请先允许浏览器储存')}}
  trips=state.trips; active=state.active;
  function persist(next){
    try{
      const disk=load(KEY,null);
      if(disk&&disk.revision!==state.revision){state=disk;trips=state.trips;active=state.active;rebuild();renderAll();draw();toast('另一页面已更新，请重试');return false}
      next={...next,revision:state.revision+1};save(KEY,next);state=next;trips=state.trips;active=state.active;return true;
    }catch{toast('保存失败，记录仍保留在此页面。请检查储存空间');return false}
  }
  const clock=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
  const bucket=timestamp=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp));return (['Sat','Sun'].includes(p.find(x=>x.type==='weekday').value)?'we':'wd')+'|'+Math.floor(Number(p.find(x=>x.type==='hour').value)/2)};
  function add(map,key,value){const a=map[key];map[key]=a?{n:a.n+1,mean:a.mean*.76+value*.24,min:Math.min(a.min,value),max:Math.max(a.max,value)}:{n:1,mean:value,min:value,max:value}}
  function rebuild(){
    stats={exact:{},service:{},type:{},context:{},pace:null};const pace={};
    [...trips].sort((a,b)=>a.timestamp-b.timestamp).forEach(t=>{
      if(t.schemaVersion!==3||t.status!=='completed'||t.excludeLearning)return;
      (t.segments||[]).forEach(s=>{
        const m=s.durationMs/60000;if(!Number.isFinite(m)||m<0||!Number.isFinite(s.startedAt))return;
        add(stats.exact,s.id,m);add(stats.service,[s.type,s.service,t.direction,s.from,s.to].join('|'),m);add(stats.type,s.type,m);
        add(stats.context,s.id+'|'+bucket(s.startedAt),m);
        if(s.type==='walk'&&s.distanceMeters>0&&m>0){const rate=m/(s.distanceMeters/1000);if(rate>=3&&rate<=60)add(pace,'walking',rate)}
      });
    });stats.pace=pace.walking||null;
  }
  function prediction(s,dir,at){
    let base=s.baselineMinutes;const distance=state.distances[s.id];
    if(s.type==='walk'&&distance>0&&stats.pace){const w=Math.min(.7,stats.pace.n/(stats.pace.n+5));base=base*(1-w)+stats.pace.mean*distance/1000*w}
    const a=stats.exact[s.id]||stats.service[[s.type,s.service,dir,s.from,s.to].join('|')];
    if(!a)return {minutes:base,n:0};
    const c=stats.context[s.id+'|'+bucket(at)],personal=(c && c.n>=3) ? 0.68*c.mean+0.32*a.mean : a.mean,w=Math.min(.9,a.n/(a.n+5));
    return {minutes:base*(1-w)+personal*w,n:a.n};
  }
  function estimate(route,dir,at=Date.now()){
    let elapsed=0;const rows=(plans[route.id]||[]).map(s=>{const p=prediction(s,dir,at+elapsed*60000);elapsed+=p.minutes;return {...s,predictedMinutes:p.minutes,n:p.n,distanceMeters:state.distances[s.id]||null}});
    return {rows,total:elapsed};
  }
  recs=(dir=currentDirection,now=new Date())=>ROUTES[dir].filter(r=>!r.legacyOnly&&(!r.custom||settings.custom1015)).map(r=>{
    const e=estimate(r,dir,now.getTime()),a=adjustment(r,dir,now),penalty=r.id==='diamondHill91M'?Number(settings.discomfort91M):r.penalty||0;
    return {...r,pred:e.total,score:e.total+penalty+(a.p>=70?70:0),rows:e.rows,liveReason:a.reason,l:{n:e.rows.filter(s=>s.n).length}};
  }).sort((a,b)=>a.score-b.score);
  const style=document.createElement('style');style.textContent='.seg-panel{margin:18px 0;padding:20px;border:1px solid #385266;border-radius:20px;background:#10232d;color:#eef6fb}.seg-panel button,.seg-pick{min-height:48px;border-radius:12px;padding:12px 16px;cursor:pointer}.seg-panel select,.seg-panel input,.seg-panel textarea{font:inherit;background:#18313e;color:#fff;border:1px solid #69838f;border-radius:10px;padding:12px;max-width:100%;box-sizing:border-box}.seg-panel select,.seg-panel textarea{width:100%}.seg-panel label{display:block;margin:12px 0}.seg-primary,.seg-pick{background:#9fe8d1;color:#10232d;font-weight:700;border:0}.seg-secondary{background:transparent;color:#eef6fb;border:1px solid #78949f}.seg-clock{font-size:clamp(34px,10vw,56px);font-variant-numeric:tabular-nums;font-weight:750;margin:12px 0}.seg-row{display:flex;gap:12px;justify-content:space-between;padding:12px 0;border-bottom:1px solid #ffffff18;align-items:center}.seg-row strong{white-space:nowrap}.seg-panel progress{width:100%;height:12px;accent-color:#9fe8d1}.seg-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.seg-actions button:first-child{flex:1}.seg-muted{color:#b1c7d2;font-size:14px;line-height:1.6}.seg-now{border-left:3px solid #9fe8d1;padding-left:10px}.seg-panel h2{font-size:22px}.seg-panel input[type=number]{width:110px}.seg-panel input[type=checkbox]{width:20px;height:20px}';document.head.append(style);
  const panel=document.createElement('section');panel.id='segmentRecorder';panel.className='seg-panel';$('recommendationList').before(panel);
  function rowsHTML(rows){return rows.map((s,i)=>'<div class="seg-row"><span>'+ (i+1)+'. '+types[s.type]+' · '+esc(s.label)+'</span><strong>'+ (s.durationMs!==undefined?clock(s.durationMs):s.predictedMinutes.toFixed(1)+' 分')+'</strong></div>').join('')}
  function summaryHTML(t){return '<h2>行程总结</h2><p>'+esc(t.routeName||routeById(t.routeId)?.name||t.routeId)+'</p><div class="seg-clock">'+clock(t.endedAt-t.startedAt)+'</div><p class="seg-muted">出发时预计 '+t.predictedMinutes.toFixed(1)+' 分钟 · 实际 '+((t.endedAt-t.startedAt)/60000).toFixed(1)+' 分钟</p>'+rowsHTML(t.segments)}
  function draw(){
    if(active?.schemaVersion===3){
      if(active.status==='review'){
        panel.innerHTML=summaryHTML(active)+'<label>备注<textarea id="segmentNote" placeholder="例如：等车久、忘记切换分段"></textarea></label><label><input type="checkbox" id="segmentExclude" '+(active.segments.some(s=>s.durationMs<2000)?'checked':'')+'> 测试 / 计时不准：保存但不用于学习</label><button class="seg-primary" id="segmentSave">保存本次行程</button><p class="seg-muted">请检查每段时间。忘记切换时勾选上方选项，避免影响预测。</p>';
        $('segmentSave').onclick=finishSave;return;
      }
      const i=active.segments.length,s=active.plan[i];
      panel.innerHTML='<p class="seg-muted">正在记录 · '+esc(active.routeName)+'</p><progress value="'+i+'" max="'+active.plan.length+'" aria-label="已完成分段"></progress><p>第 '+(i+1)+' / '+active.plan.length+' 段 · '+types[s.type]+'</p><h2 tabindex="-1" id="segmentHeading">'+esc(s.label)+'</h2><div class="seg-clock" id="segmentElapsed"></div><p id="tripElapsed" class="seg-muted"></p><p>下一段：'+(active.plan[i+1]?types[active.plan[i+1].type]+' · '+esc(active.plan[i+1].label):'到达目的地')+'</p><div class="seg-actions"><button class="seg-primary" id="segmentNext">'+(i===active.plan.length-1?'完成行程，查看总结':'下一段 →')+'</button>'+(i?'<button class="seg-secondary" id="segmentUndo">撤销上次切换</button>':'')+'<button class="seg-secondary" id="segmentCancel">中止行程</button></div><p class="seg-muted">到站点一下进入等车，上车再点一下进入乘车。锁屏或刷新后可继续，计时不会暂停。</p><details><summary>已完成 '+i+' 段</summary>'+rowsHTML(active.segments)+'</details>';
      $('segmentNext').onclick=advance;$('segmentCancel').onclick=cancel;if($('segmentUndo'))$('segmentUndo').onclick=undo;tick();return;
    }
    if(active){panel.innerHTML='<h2>有一趟旧版行程正在计时</h2><p>先通过上方结束按钮保存旧行程，之后即可开始分段记录。</p>';return}
    const route=ROUTES[currentDirection].find(r=>r.id===selected&&!r.legacyOnly&&(!r.custom||settings.custom1015));if(!route)selected=null;
    panel.innerHTML='<p class="seg-muted">分段通勤 · 先选路线，再出发</p><h2>今天怎么走？</h2><label for="segmentRoute">选择通勤路线</label><select id="segmentRoute"><option value="">请选择路线</option>'+recs().map(r=>'<option value="'+r.id+'" '+(selected===r.id?'selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select>'+(route?'<p>分段预计合计 <strong>'+estimate(route,currentDirection).total.toFixed(1)+' 分钟</strong></p>'+rowsHTML(estimate(route,currentDirection).rows)+'<details><summary>步行距离（可选，用于学习步速）</summary><p class="seg-muted">填写已知的实际步行距离；留空也能学习该段用时。</p>'+plans[route.id].filter(s=>s.type==='walk').map(s=>'<label>'+esc(s.label)+' <input type="number" min="1" max="20000" step="1" data-distance="'+esc(s.id)+'" value="'+(state.distances[s.id]||'')+'" aria-label="'+esc(s.label)+' 距离"> 米</label>').join('')+'</details><div class="seg-actions"><button id="segmentStart" class="seg-primary">开始所选路线</button></div>':'<p class="seg-muted">每次切换时只需点「下一段」。等车、乘车和换乘会分别学习。</p>')+'<details style="margin-top:18px"><summary>我的分段学习数据</summary>'+statsHTML()+'</details>';
    $('segmentRoute').onchange=e=>{selected=e.target.value;draw()};if($('segmentStart'))$('segmentStart').onclick=start;
  }
  function statsHTML(){const entries=Object.entries(stats.type);return '<p class="seg-muted">'+(stats.pace?'个人步速约 '+(60/stats.pace.mean).toFixed(1)+' km/h，配速 '+stats.pace.mean.toFixed(1)+' 分/公里（'+stats.pace.n+' 段）':'输入步行距离并完成真实记录后显示步速。')+'</p>'+entries.map(([k,a])=>'<p>'+types[k]+'：'+a.n+' 段，近期均值 '+a.mean.toFixed(1)+' 分</p>').join('')+'<p class="seg-muted">分类均值仅供查看。预测按交通线路和起终点分别学习，不把不同长度的巴士行程直接平均。</p>'+Object.entries(stats.exact).map(([id,a])=>'<p class="seg-muted">'+esc(id.split('|').slice(1).join(' · '))+'：'+a.mean.toFixed(1)+' 分 / '+a.n+' 次</p>').join('')}
  function start(){
    if(active||!selected)return;let distances={...state.distances};
    for(const el of panel.querySelectorAll('[data-distance]')){let v=el.value.trim(),n=Number(v);if(v&&(!Number.isFinite(n)||n<1||n>20000)){toast('步行距离请填 1–20000 米，或留空');return}if(v)distances[el.dataset.distance]=n;else delete distances[el.dataset.distance]}
    if(!persist({...state,distances}))return;
    const r=routeById(selected),now=Date.now(),e=estimate(r,currentDirection,now);
    const a={schemaVersion:3,id:crypto.randomUUID(),status:'recording',routeId:r.id,routeName:r.name,direction:currentDirection,startedAt:now,segmentStartedAt:now,plan:e.rows,segments:[],predictedMinutes:e.total};
    if(persist({...state,active:a})){draw();updateActive();$('segmentHeading')?.focus();toast('第 1 段计时已开始')}
  }
  function advance(){
    if(!active||active.status!=='recording')return;
    const now=Date.now();if(now-active.segmentStartedAt<1000){toast('请勿重复点击，当前分段刚开始');return}
    const a=structuredClone(active),s=a.plan[a.segments.length];a.segments.push({...s,startedAt:a.segmentStartedAt,endedAt:now,durationMs:now-a.segmentStartedAt});a.segmentStartedAt=now;
    if(a.segments.length===a.plan.length){a.status='review';a.endedAt=now}
    if(persist({...state,active:a})){draw();updateActive();$('segmentHeading')?.focus()}
  }
  function undo(){if(!active?.segments.length)return;const a=structuredClone(active),last=a.segments.pop();a.segmentStartedAt=last.startedAt;if(persist({...state,active:a}))draw()}
  function cancel(){if(!confirm('中止并保留未完成记录？这趟不会用于学习。'))return;const now=Date.now(),a={...active,status:'cancelled',timestamp:active.startedAt,endedAt:now,duration:(now-active.startedAt)/60000,excludeLearning:true};if(persist({...state,active:null,trips:[a,...trips]})){rebuild();renderAll();draw()}}
  function finishSave(){if(active?.status!=='review')return;const a={...active,status:'completed',timestamp:active.startedAt,duration:(active.endedAt-active.startedAt)/60000,note:$('segmentNote').value.trim(),excludeLearning:$('segmentExclude').checked,contextKey:contextKey(active.routeId,active.direction,new Date(active.startedAt))};delete a.plan;
    if(persist({...state,active:null,trips:[a,...trips.filter(t=>t.id!==a.id)]})){rebuild();renderAll();panel.innerHTML=summaryHTML(a)+'<p>✓ 已保存'+(a.excludeLearning?'，未用于学习':'，下次预测已更新')+'</p><button id="segmentAgain" class="seg-primary">准备下一次行程</button>';$('segmentAgain').onclick=draw;toast('行程已保存')}
  }
  function tick(){if(active?.status==='recording'&&$('segmentElapsed')){$('segmentElapsed').textContent=clock(Date.now()-active.segmentStartedAt);$('tripElapsed').textContent='整趟已用 '+clock(Date.now()-active.startedAt)+' · 本段预计 '+active.plan[active.segments.length].predictedMinutes.toFixed(1)+' 分钟'}}
  updateActive=()=>{$('startCommuteBtn').textContent=active?.schemaVersion===3?(active.status==='review'?'查看行程总结':'查看当前分段'):active?'结束旧版通勤':'选择路线并开始';tick()};
  $('startCommuteBtn').onclick=()=>{if(active&&active.schemaVersion!==3){openRecord(true);return}draw();panel.scrollIntoView({behavior:'smooth',block:'start'})};
  renderRecs=()=>{
    const rr=recs();$('recommendationList').innerHTML=rr.map((r,i)=>'<article class="route-card '+(i===0?'recommended':'')+'"><h4>'+esc(r.name)+'</h4><div class="route-eta">'+r.pred.toFixed(1)+' min</div><p class="muted">'+esc(r.explain)+'</p><p class="muted">'+r.l.n+' / '+r.rows.length+' 段已有个人记录 · 分段预测相加</p><details><summary>查看分段预测</summary>'+rowsHTML(r.rows)+'</details><button class="seg-pick" data-select-route="'+r.id+'" '+(active?'disabled':'')+'>选择此路线</button></article>').join('');
    if(rr[0]){$('arrivalTime').textContent=fmtTime(new Date(Date.now()+rr[0].pred*60000));$('arrivalRange').textContent='分段预测合计 · 初始值仍需实测校准'}
  };
  $('recommendationList').onclick=e=>{const b=e.target.closest('[data-select-route]');if(!b||active)return;selected=b.dataset.selectRoute;draw();panel.scrollIntoView({behavior:'smooth'})};
  const oldSetDirection=setDirection;setDirection=(dir,manual=true)=>{if(active?.schemaVersion===3&&dir!==active.direction){if(manual)toast('记录中保持本次路线方向');return}oldSetDirection(dir,manual);draw()};
  updateRecordRoutes=()=>{const d=$('recordDirection').value||currentDirection;$('recordRoute').innerHTML=ROUTES[d].filter(r=>(!r.legacyOnly||active?.routeId===r.id)&&(!r.custom||settings.custom1015)).map(r=>'<option value="'+r.id+'">'+esc(r.name)+'</option>').join('')};
  let finishingLegacy=false;const oldOpenRecord=openRecord;openRecord=(useActive=false)=>{if(active?.schemaVersion===3){toast('请先完成当前分段行程');return}finishingLegacy=!!(useActive&&active);oldOpenRecord(useActive)};
  $('manualRecordBtn').onclick=()=>openRecord(false);$('navRecord').onclick=()=>openRecord(false);$('recordDirection').onchange=updateRecordRoutes;
  $('saveRecordBtn').onclick=()=>{const m=Number($('recordDuration').value);if(!Number.isFinite(m)||m<=0){toast('请填写实际耗时');return}const now=finishingLegacy?active.startedAt:Date.now(),dir=$('recordDirection').value,id=$('recordRoute').value,t={id:crypto.randomUUID(),timestamp:now,routeId:id,direction:dir,duration:m,note:$('recordNote').value.trim(),contextKey:contextKey(id,dir,new Date(now))};if(persist({...state,trips:[t,...trips],active:finishingLegacy?null:active})){$('recordDialog').close();renderAll();draw()}};
  renderHistory=()=>{$('historyList').innerHTML=trips.length?trips.map(t=>'<article class="history-item"><h3>'+esc(t.routeName||routeById(t.routeId)?.short||t.routeId)+'</h3><p>'+fmtDate(new Date(t.timestamp))+' · '+t.duration.toFixed(1)+' 分</p><p>'+ (t.status==='cancelled'?'已中止 · 不用于学习':t.schemaVersion===3?(t.excludeLearning?'已保存 · 未用于学习':'已用于分段学习'):'旧版 / 手动总时长记录，无分段数据')+'</p>'+(t.segments?'<details><summary>各段实际时间</summary>'+rowsHTML(t.segments)+'</details>':'')+(t.note?'<p>'+esc(t.note)+'</p>':'')+'<button class="delete-btn" data-delete="'+esc(t.id)+'">删除这条记录</button></article>').join(''):'<p>还没有历史记录。</p>'};
  $('historyList').onclick=e=>{const id=e.target.dataset.delete;if(!id)return;if(persist({...state,trips:trips.filter(t=>t.id!==id)})){rebuild();renderHistory();renderAll();if(!active)draw()}};
  $('clearDataBtn').onclick=()=>{if(confirm('清除全部历史？当前行程和位置设置保留。')&&persist({...state,trips:[]})){rebuild();renderAll();if(!active)draw()}};
  $('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({version:3,exportedAt:new Date().toISOString(),settings,...state,stats},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='commute-segments-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
  renderLearning=()=>{const count=trips.filter(t=>t.schemaVersion===3&&t.status==='completed'&&!t.excludeLearning).length;$('tripCount').textContent=trips.length;$('bestLearnedRoute').textContent=Object.keys(stats.exact).length+' 个分段';$('learningSummary').textContent='已有 '+count+' 趟有效分段行程。旧版总时长、测试及中止记录保留在历史中，不用于分段预测。';};
  const oldCustom=$('custom1015Toggle').onchange;$('custom1015Toggle').onchange=e=>{oldCustom(e);draw()};
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;const fresh=load(KEY,null);if(!fresh)return;state=fresh;trips=state.trips;active=state.active;rebuild();renderAll();draw()});
  document.addEventListener('visibilitychange',tick);setInterval(tick,1000);
  rebuild();if(active?.schemaVersion===3){currentDirection=active.direction;directionManuallySet=true}renderAll();updateRecordRoutes();draw();
})();

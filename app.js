
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

(()=>{
"use strict";
const $=id=>document.getElementById(id);
function openWazeCoord(coord){
  if(!coord)return;
  const [lon,lat]=coord.map(Number);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  window.open(`https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,"_blank");
}
function openWazeSearch(q){
  const s=String(q||"").trim();
  if(!s)return;
  window.open(`https://waze.com/ul?q=${encodeURIComponent(s)}&navigate=yes`,"_blank");
}
function coordFromGoogleButton(btn){
  if(!btn)return null;
  let captured=null;
  const oldOpen=window.open;
  try{
    window.open=(u)=>{captured=String(u||"");return null};
    btn.click();
  }catch{}finally{window.open=oldOpen}
  if(!captured)return null;
  try{
    const u=new URL(captured,location.href);
    const d=u.searchParams.get("destination");
    if(!d)return null;
    const [lat,lon]=d.split(",").map(Number);
    return Number.isFinite(lat)&&Number.isFinite(lon)?[lon,lat]:null;
  }catch{return null}
}
function addStationButton(){
  const google=$("googleMapsBtn");
  if(!google||$("wazeMapsBtn"))return;
  const b=document.createElement("button");
  b.id="wazeMapsBtn";b.className="btn";b.textContent="Waze";
  b.onclick=()=>{
    const c=coordFromGoogleButton(google);
    if(c)openWazeCoord(c);else openWazeSearch($("stationAddress")?.textContent||$("stationName")?.textContent);
  };
  google.insertAdjacentElement("afterend",b);
}
function addStopButtons(){
  document.querySelectorAll(".stopCard .stopActions").forEach(actions=>{
    if(actions.querySelector(".cc-waze-stop"))return;
    const google=[...actions.querySelectorAll("button")].find(b=>/google/i.test(b.textContent||""));
    if(!google)return;
    const b=document.createElement("button");
    b.className="btn cc-waze-stop";b.textContent="Waze";
    b.onclick=()=>{
      const c=coordFromGoogleButton(google);
      if(c)openWazeCoord(c);
    };
    actions.appendChild(b);
  });
}
function addRouteButton(){
  const card=$("routeSummaryCard"),save=$("saveRouteBtn");
  if(!card||!save||$("launchWazeRouteBtn"))return;
  const b=document.createElement("button");
  b.id="launchWazeRouteBtn";b.className="btn";b.textContent="Lancer avec Waze";
  b.onclick=()=>{
    const firstGoogle=[...document.querySelectorAll(".stopCard .stopActions button")].find(x=>/google/i.test(x.textContent||""));
    const c=coordFromGoogleButton(firstGoogle);
    if(c)openWazeCoord(c);else openWazeSearch($("routeTo")?.value);
  };
  save.insertAdjacentElement("afterend",b);
}
function patch(){addStationButton();addRouteButton();addStopButtons()}
patch();
const mo=new MutationObserver(patch);mo.observe(document.body,{childList:true,subtree:true});
window.addEventListener("load",patch);
})();
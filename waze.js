(()=>{
"use strict";
const $=id=>document.getElementById(id);
const PROGRESS_KEY="chargecompare-waze-progress";

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
function itinerary(){
  const legs=[];
  document.querySelectorAll(".stopCard").forEach((card,i)=>{
    const google=[...card.querySelectorAll(".stopActions button")].find(b=>/google/i.test(b.textContent||""));
    const coord=coordFromGoogleButton(google);
    const title=(card.querySelector("h3")?.textContent||`Recharge ${i+1}`).replace(/^Arrêt\s*\d+\s*[—-]\s*/i,"").trim();
    if(coord)legs.push({type:"coord",coord,label:`Recharge ${i+1} · ${title}`});
  });
  const destination=String($("routeTo")?.value||"").trim();
  if(destination)legs.push({type:"search",query:destination,label:`Destination · ${destination}`});
  return legs;
}
function signature(legs){return legs.map(x=>x.type==="coord"?x.coord.join(","):x.query).join("|")}
function readProgress(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||"null")}catch{return null}}
function writeProgress(v){localStorage.setItem(PROGRESS_KEY,JSON.stringify(v))}
function clearProgress(){localStorage.removeItem(PROGRESS_KEY)}
function openLeg(leg){if(!leg)return;if(leg.type==="coord")openWazeCoord(leg.coord);else openWazeSearch(leg.query)}
function startFullTrip(){
  const legs=itinerary();
  if(!legs.length)return;
  const sig=signature(legs);
  writeProgress({sig,index:0,total:legs.length,startedAt:Date.now()});
  renderFullTripPanel();
  openLeg(legs[0]);
}
function openNextLeg(){
  const legs=itinerary();
  if(!legs.length)return;
  const sig=signature(legs),p=readProgress();
  let next=0;
  if(p&&p.sig===sig)next=Math.min(p.index+1,legs.length-1);
  writeProgress({sig,index:next,total:legs.length,startedAt:p?.startedAt||Date.now()});
  renderFullTripPanel();
  openLeg(legs[next]);
}
function reopenCurrentLeg(){
  const legs=itinerary();if(!legs.length)return;
  const sig=signature(legs),p=readProgress();
  const i=p&&p.sig===sig?Math.min(p.index,legs.length-1):0;
  writeProgress({sig,index:i,total:legs.length,startedAt:p?.startedAt||Date.now()});
  renderFullTripPanel();openLeg(legs[i]);
}
function renderFullTripPanel(){
  const card=$("routeSummaryCard");if(!card)return;
  let panel=$("wazeFullTripPanel");
  const legs=itinerary();
  if(!legs.length){panel?.remove();return}
  if(!panel){
    panel=document.createElement("div");panel.id="wazeFullTripPanel";
    panel.style.cssText="margin-top:12px;padding:12px;border:1px solid #d0d5dd;border-radius:7px;background:#f8fafc";
    card.appendChild(panel);
  }
  const sig=signature(legs),p=readProgress();
  const active=p&&p.sig===sig?Math.min(p.index,legs.length-1):-1;
  const items=legs.map((x,i)=>`<div style=\"padding:7px 0;border-bottom:${i===legs.length-1?'0':'1px solid #e4e7ec'};font-size:13px\">${i<legs.length-1?'⚡':'🏁'} <b>${i+1}.</b> ${x.label}${i===active?' <span class=\"miniBadge real\">EN COURS</span>':''}</div>`).join("");
  const nextDisabled=active>=legs.length-1;
  panel.innerHTML=`<b>Trajet complet Waze</b><div class=\"note\" style=\"margin:4px 0 8px\">Waze ne reçoit qu’une destination à la fois. ChargeCompare garde donc toutes les étapes dans l’ordre.</div>${items}<div class=\"actionGrid\" style=\"margin-top:10px\"><button id=\"wazeCurrentLegBtn\" class=\"btn\">${active<0?'Démarrer':'Rouvrir étape actuelle'}</button><button id=\"wazeNextLegBtn\" class=\"btn primary\" ${nextDisabled?'disabled':''}>${nextDisabled?'Destination atteinte':'Étape suivante dans Waze'}</button></div>`;
  $("wazeCurrentLegBtn").onclick=active<0?startFullTrip:reopenCurrentLeg;
  $("wazeNextLegBtn").onclick=openNextLeg;
}
function addRouteButton(){
  const card=$("routeSummaryCard"),save=$("saveRouteBtn");
  if(!card||!save)return;
  let b=$("launchWazeRouteBtn");
  if(!b){
    b=document.createElement("button");
    b.id="launchWazeRouteBtn";b.className="btn primary";
    save.insertAdjacentElement("afterend",b);
  }
  b.textContent="Trajet complet Waze";
  b.onclick=startFullTrip;
  renderFullTripPanel();
}
function resetIfRouteChanged(){
  const legs=itinerary(),p=readProgress();
  if(!legs.length)return;
  if(p&&p.sig!==signature(legs))clearProgress();
}
function patch(){
  const v=document.querySelector(".version");if(v)v.textContent="V11.5";
  addStationButton();addStopButtons();resetIfRouteChanged();addRouteButton();
}
patch();
const mo=new MutationObserver(()=>patch());mo.observe(document.body,{childList:true,subtree:true});
window.addEventListener("pageshow",()=>{patch();renderFullTripPanel()});
window.addEventListener("load",patch);
})();
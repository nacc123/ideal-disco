(()=>{
"use strict";
const $=id=>document.getElementById(id);
let markerObservers=[];
let decorateTimer=null;

function numberValue(id){
  const el=$(id);if(!el)return null;
  const raw=String(el.value||"").trim().replace(",",".");
  if(raw==="")return null;
  const n=Number(raw);return Number.isFinite(n)?n:null;
}
function money(v){return Number(v||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}
function text(id){return ($(id)?.textContent||"").trim()}
function activeGarage(){
  try{
    const s=JSON.parse(localStorage.getItem("chargecompare-v113")||"{}");
    if(!Array.isArray(s.profiles))return null;
    return s.profiles.find(p=>p.id===s.activeId)||s.profiles[0]||null;
  }catch{return null}
}

function ensureMapFilters(){
  const card=$("stationMapCard");if(!card||$("ccMapFilters"))return;
  const bar=document.createElement("div");bar.id="ccMapFilters";bar.className="cc-map-filters";
  const items=[["0","Toutes"],["22","22+ kW"],["50","50+ kW"],["100","100+ kW"],["150","150+ kW"]];
  items.forEach(([value,label])=>{
    const b=document.createElement("button");b.type="button";b.className="cc-filter-pill";b.dataset.power=value;b.textContent=label;
    b.onclick=()=>{const s=$("stationPowerFilter");if(!s)return;s.value=value;s.dispatchEvent(new Event("change",{bubbles:true}));syncFilterButtons()};
    bar.appendChild(b);
  });
  card.appendChild(bar);syncFilterButtons();
}
function syncFilterButtons(){
  const v=$("stationPowerFilter")?.value||"0";
  document.querySelectorAll(".cc-filter-pill[data-power]").forEach(b=>b.classList.toggle("active",b.dataset.power===v));
}

function powersFromSelect(){
  const sel=$("stationSelect");if(!sel)return[];
  return [...sel.options].slice(1).map(o=>{
    const m=(o.textContent||"").match(/—\s*([\d,.]+)\s*kW/i);
    return m?Number(m[1].replace(",",".")):null;
  });
}
function powerClass(p){if(!(p>0)||p<=22)return"low";if(p<100)return"mid";if(p<200)return"high";return"ultra"}
function currentStationName(){return text("stationName")}
function selectedMarkerIndex(){
  const name=currentStationName();if(!name)return-1;
  const opts=[...($("stationSelect")?.options||[])].slice(1);
  return opts.findIndex(o=>(o.textContent||"").startsWith(name));
}
function clearMarkerDecorations(){
  markerObservers.forEach(o=>o.disconnect());markerObservers=[];
  document.querySelectorAll("#stationMap .cc-power-anchor").forEach(x=>x.remove());
}
function decoratePowerMarkers(){
  clearMarkerDecorations();
  const pane=document.querySelector("#stationMap .leaflet-marker-pane");if(!pane)return;
  const imgs=[...pane.querySelectorAll("img.leaflet-marker-icon")];
  const powers=powersFromSelect();
  const active=selectedMarkerIndex();
  imgs.forEach((img,i)=>{
    const p=powers[i];
    const anchor=document.createElement("div");anchor.className="cc-power-anchor";
    const pill=document.createElement("div");pill.className=`cc-power-pill ${powerClass(p)}${i===active?" active":""}`;pill.textContent=p?`${Math.round(p)} kW`:"⚡";
    anchor.appendChild(pill);pane.appendChild(anchor);
    const sync=()=>{anchor.style.transform=img.style.transform||"";anchor.style.zIndex=String((Number(img.style.zIndex)||0)+2)};
    sync();
    const mo=new MutationObserver(sync);mo.observe(img,{attributes:true,attributeFilter:["style"]});markerObservers.push(mo);
  });
}
function scheduleDecorate(){clearTimeout(decorateTimer);decorateTimer=setTimeout(decoratePowerMarkers,120)}

function ensureSheet(){
  if($("ccStationSheet"))return;
  const sheet=document.createElement("div");sheet.id="ccStationSheet";sheet.className="cc-station-sheet";sheet.setAttribute("aria-hidden","true");
  sheet.innerHTML=`
    <div class="cc-sheet-handle" id="ccSheetHandle"><div class="cc-sheet-grabber"></div></div>
    <div class="cc-sheet-scroll">
      <div class="cc-sheet-head"><h2 class="cc-sheet-title" id="ccSheetTitle">Borne</h2><button class="cc-sheet-close" id="ccSheetClose" aria-label="Fermer">×</button></div>
      <div class="cc-sheet-address" id="ccSheetAddress"></div>
      <div class="cc-sheet-quick" id="ccSheetQuick"></div>
      <div class="cc-sheet-minirow">
        <div class="cc-sheet-price-main"><small>Meilleur prix affiché</small><strong id="ccSheetBestPrice">—</strong><small id="ccSheetBestLabel">Tarif à vérifier</small></div>
        <button class="cc-sheet-primary" id="ccSheetGo">Y aller</button>
      </div>
      <div class="cc-sheet-expandhint" id="ccSheetExpandHint">Glisse vers le haut pour les détails</div>
      <div class="cc-sheet-expanded">
        <div class="cc-sheet-section"><h3>Prix pour ta recharge</h3><div class="cc-energy-row" id="ccSheetEnergy"></div><div class="cc-price-list" id="ccSheetPrices" style="margin-top:9px"></div></div>
        <div class="cc-sheet-section"><h3>Conseil</h3><div class="cc-sheet-verdict" id="ccSheetVerdict"></div></div>
        <div class="cc-sheet-section"><h3>Ta voiture</h3><div class="cc-sheet-vehicle" id="ccSheetVehicle"></div></div>
        <div class="cc-sheet-section"><h3>Disponibilité</h3><div class="cc-sheet-live" id="ccSheetLive"></div></div>
        <div class="cc-sheet-section"><h3>Navigation</h3><div class="cc-sheet-actions">
          <button class="primary wide" id="ccSheetWaze">Waze</button><button id="ccSheetApple"> Plans</button><button id="ccSheetGoogle">Google Maps</button><button id="ccSheetRefresh">↻ Temps réel</button><button id="ccSheetFav">☆ Favori</button>
        </div></div>
      </div>
    </div>`;
  document.body.appendChild(sheet);
  $("ccSheetClose").onclick=()=>closeSheet();
  $("ccSheetHandle").onclick=()=>sheet.classList.toggle("expanded");
  $("ccSheetGo").onclick=()=>launchWazeOrApple();
  $("ccSheetWaze").onclick=()=>launchWazeOrApple();
  $("ccSheetApple").onclick=()=>$("appleMapsBtn")?.click();
  $("ccSheetGoogle").onclick=()=>$("googleMapsBtn")?.click();
  $("ccSheetRefresh").onclick=()=>$("refreshLiveBtn")?.click();
  $("ccSheetFav").onclick=()=>{$("favoriteStationBtn")?.click();setTimeout(syncSheet,40)};
  let y0=null;
  const h=$("ccSheetHandle");
  h.addEventListener("touchstart",e=>{y0=e.touches[0]?.clientY??null},{passive:true});
  h.addEventListener("touchend",e=>{if(y0===null)return;const y=e.changedTouches[0]?.clientY??y0,d=y-y0;y0=null;if(d<-35)sheet.classList.add("expanded");else if(d>35)sheet.classList.remove("expanded")},{passive:true});
  renderEnergyButtons();
}
function launchWazeOrApple(){
  const w=$("wazeMapsBtn");if(w){w.click();return}$("appleMapsBtn")?.click();
}
function openSheet(){const s=$("ccStationSheet");if(!s)return;s.classList.add("open");s.setAttribute("aria-hidden","false")}
function closeSheet(){const s=$("ccStationSheet");if(!s)return;s.classList.remove("open","expanded");s.setAttribute("aria-hidden","true")}
function renderEnergyButtons(){
  const box=$("ccSheetEnergy");if(!box)return;box.innerHTML="";
  [20,30,40,50].forEach(k=>{const b=document.createElement("button");b.type="button";b.className="cc-energy-btn";b.textContent=`${k} kWh`;b.dataset.kwh=String(k);b.onclick=()=>{if($("compareKwh")){$("compareKwh").value=String(k);$("compareKwh").dispatchEvent(new Event("input",{bubbles:true}))}syncSheet()};box.appendChild(b)});
}
function priceOptions(){
  const k=numberValue("compareKwh")||30;
  const out=[];
  const add=(name,priceId,badgeId,useId)=>{
    const checked=$(useId)?.checked!==false,price=numberValue(priceId);if(!checked||price===null)return;
    out.push({name,price,k,cost:price*k,badge:text(badgeId)||"—"});
  };
  add("Electroverse","evPrice","evBadge","useElectroverse");
  add("Chargemap","cmPrice","cmBadge","useChargemap");
  if($("useOperator")?.checked)add("Opérateur direct","opPrice","opBadge","useOperator");
  return out.sort((a,b)=>a.cost-b.cost);
}
function liveSummary(){
  const t=text("stationLiveInfo")||"Temps réel non vérifié.";
  const m=t.match(/(\d+)\s+libre/i);
  if(m)return{label:`${m[1]} libre(s)`,cls:Number(m[1])>0?"live-ok":"live-bad",full:t};
  if(/hors service|indisponible/i.test(t))return{label:"Indisponible",cls:"live-bad",full:t};
  return{label:"Temps réel ?",cls:"",full:t};
}
function stationChips(){
  const source=[...document.querySelectorAll("#stationMeta .chip")].map(x=>x.textContent.trim()).filter(Boolean);
  const live=liveSummary();
  return [...source.slice(0,4),live.label];
}
function renderPrices(){
  const opts=priceOptions(),box=$("ccSheetPrices");if(!box)return;
  const best=opts[0];
  box.innerHTML=opts.length?opts.map((o,i)=>`<div class="cc-price-line ${i===0?"best":""}"><div><div class="cc-price-name">${o.name}${i===0?" ✓":""}</div><div class="cc-price-tag">${o.badge}</div></div><div class="cc-price-val">${o.price.toFixed(3).replace(".",",")} €/kWh<small>${money(o.cost)} pour ${o.k} kWh</small></div></div>`).join(""):'<div class="cc-price-line"><div class="cc-price-name">Aucun tarif sélectionné</div></div>';
  $("ccSheetBestPrice").textContent=best?`${best.price.toFixed(3).replace(".",",")} €/kWh`:"—";
  $("ccSheetBestLabel").textContent=best?`${best.name} · ${best.badge}`:"Tarif à vérifier";
  $("ccSheetVerdict").innerHTML=best?`<b>Badge conseillé : ${best.name}</b><br>${best.badge==="ESTIMÉ"?"Prix estimé : vérifie le tarif exact avant de badger.":"Meilleur tarif parmi les moyens de paiement activés."}`:"Active au moins un moyen de paiement pour comparer.";
  document.querySelectorAll("#ccSheetEnergy .cc-energy-btn").forEach(b=>b.classList.toggle("active",Number(b.dataset.kwh)===(numberValue("compareKwh")||30)));
}
function syncVehicle(){
  const p=activeGarage(),e=$("ccSheetVehicle");if(!e)return;
  if(!p){e.textContent="Ajoute ta voiture dans Garage pour personnaliser les calculs.";return}
  e.innerHTML=`<b>${p.name||"Ma voiture"}</b><br>${p.battery||"?"} kWh · autoroute ${p.highwayConsumption||p.consumption||"?"} kWh/100 · DC ${p.dc||"?"} kW · limite ${p.maxSoc||80}%<br><span style="color:#687386">Le SOC et le temps de recharge détaillés sont calculés dans Parcours.</span>`;
}
function syncSheet(){
  ensureSheet();ensureMapFilters();syncFilterButtons();
  const detail=$("stationDetail");if(!detail||detail.classList.contains("hidden"))return;
  $("ccSheetTitle").textContent=text("stationName")||"Borne";
  $("ccSheetAddress").textContent=text("stationAddress");
  const live=liveSummary();
  $("ccSheetQuick").innerHTML=stationChips().map((x,i)=>`<span class="cc-sheet-chip ${i===stationChips().length-1?live.cls:""}">${x}</span>`).join("");
  $("ccSheetLive").textContent=live.full;
  $("ccSheetFav").textContent=(text("favoriteStationBtn")==="★")?"★ Favori":"☆ Favori";
  renderPrices();syncVehicle();openSheet();scheduleDecorate();
}

function observeSources(){
  const targets=[$("stationDetail"),$("stationName"),$("stationAddress"),$("stationMeta"),$("stationLiveInfo"),$("compareResult"),$("favoriteStationBtn")].filter(Boolean);
  const mo=new MutationObserver(()=>setTimeout(syncSheet,0));targets.forEach(t=>mo.observe(t,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]}));
  ["evPrice","cmPrice","opPrice","compareKwh","useElectroverse","useChargemap","useOperator"].forEach(id=>$(id)?.addEventListener("input",syncSheet));
  $("stationSelect")?.addEventListener("change",()=>setTimeout(syncSheet,0));
  $("stationPowerFilter")?.addEventListener("change",()=>{syncFilterButtons();scheduleDecorate()});
  const map=$("stationMap");if(map)new MutationObserver(scheduleDecorate).observe(map,{childList:true,subtree:true});
  const sel=$("stationSelect");if(sel)new MutationObserver(scheduleDecorate).observe(sel,{childList:true,subtree:true});
}

ensureMapFilters();ensureSheet();observeSources();scheduleDecorate();
window.addEventListener("load",()=>{ensureMapFilters();syncSheet();scheduleDecorate()});
})();

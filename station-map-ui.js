(()=>{
"use strict";
const $=id=>document.getElementById(id);
const tab=$("stationsTab");
const mapCard=$("stationMapCard");
const mapEl=$("stationMap");
if(!tab||!mapCard||!mapEl)return;

const searchCard=[...tab.children].find(el=>el.classList?.contains("card")&&el!==mapCard&&el.id!=="stationDetail"&&el.id!=="compareCard");
if(!searchCard)return;

function fire(el,type){el&&el.dispatchEvent(new Event(type,{bubbles:true}))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}

/* --- Stage carte plein écran --- */
const stage=document.createElement("div");
stage.id="ccStationStage";
stage.className="cc-map-stage";
tab.insertBefore(stage,searchCard);
stage.appendChild(mapCard);
mapCard.classList.remove("hidden");
mapCard.classList.add("cc-map-card");
searchCard.classList.add("cc-original-search-card");

const overlay=document.createElement("div");
overlay.className="cc-map-overlay";
overlay.innerHTML=`
  <div class="cc-search-bar">
    <span class="cc-search-icon">⌕</span>
    <input id="ccMapSearch" type="search" autocomplete="off" placeholder="Rechercher une ville ou un code postal">
    <button id="ccMapSearchBtn" type="button">Rechercher</button>
  </div>
  <div class="cc-filter-strip" aria-label="Filtres de puissance">
    <button class="cc-filter-chip active" data-cc-power="0">Toutes</button>
    <button class="cc-filter-chip" data-cc-power="22">22+ kW</button>
    <button class="cc-filter-chip" data-cc-power="50">50+ kW</button>
    <button class="cc-filter-chip" data-cc-power="100">100+ kW</button>
    <button class="cc-filter-chip" data-cc-power="150">150+ kW</button>
  </div>
  <div class="cc-map-subrow">
    <select id="ccCityMirror" class="cc-city-mirror" aria-label="Commune" hidden></select>
    <div id="ccMapStatus" class="cc-map-status">Recherche les bornes autour d’une ville.</div>
  </div>`;
stage.appendChild(overlay);

const originalQuery=$("cityQuery"), originalBtn=$("citySearchBtn"), originalCity=$("citySelect"), originalPower=$("stationPowerFilter"), originalStatus=$("cityStatus");
const searchInput=$("ccMapSearch"), searchBtn=$("ccMapSearchBtn"), cityMirror=$("ccCityMirror"), mapStatus=$("ccMapStatus");

function doSearch(){
  const q=searchInput.value.trim();
  if(q.length<2){mapStatus.textContent="Tape au moins 2 caractères.";mapStatus.classList.add("bad");return}
  originalQuery.value=q;
  mapStatus.textContent="Recherche…";mapStatus.classList.remove("bad","good");
  originalBtn.click();
}
searchBtn.onclick=doSearch;
searchInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doSearch()}});

function syncCityChoices(autoPick=false){
  const opts=[...originalCity.options];
  cityMirror.innerHTML="";
  opts.forEach(o=>{const x=document.createElement("option");x.value=o.value;x.textContent=o.textContent;cityMirror.appendChild(x)});
  const usable=opts.filter(o=>o.value!=="");
  cityMirror.hidden=usable.length<=1;
  cityMirror.value=originalCity.value;
  if(autoPick&&usable.length&&(!originalCity.value||originalCity.value==="")){
    originalCity.value=usable[0].value;
    cityMirror.value=usable[0].value;
    fire(originalCity,"change");
  }
}
cityMirror.onchange=()=>{originalCity.value=cityMirror.value;fire(originalCity,"change")};

const cityObs=new MutationObserver(()=>setTimeout(()=>syncCityChoices(true),20));
cityObs.observe(originalCity,{childList:true,subtree:true});
const statusObs=new MutationObserver(()=>{
  mapStatus.textContent=originalStatus.textContent;
  mapStatus.classList.toggle("good",originalStatus.classList.contains("good"));
  mapStatus.classList.toggle("bad",originalStatus.classList.contains("bad"));
});
statusObs.observe(originalStatus,{childList:true,subtree:true,attributes:true,characterData:true});

function setPower(v){
  originalPower.value=String(v);fire(originalPower,"change");
  overlay.querySelectorAll("[data-cc-power]").forEach(b=>b.classList.toggle("active",b.dataset.ccPower===String(v)));
  setTimeout(updatePowerMarkers,80);
}
overlay.querySelectorAll("[data-cc-power]").forEach(b=>b.onclick=()=>setPower(Number(b.dataset.ccPower)));

/* --- Marqueurs kW style app --- */
function markerColor(kw){
  if(kw>=200)return "#6d28d9";
  if(kw>=150)return "#075985";
  if(kw>=100)return "#0b78b8";
  if(kw>=50)return "#1976a8";
  if(kw>=22)return "#64748b";
  return "#94a3b8";
}
function markerSvg(kw){
  const label=Number.isFinite(kw)&&kw>0?`${Math.round(kw)} kW`:"⚡";
  const c=markerColor(kw);
  const width=label.length>6?88:76;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="46" viewBox="0 0 ${width} 46"><rect x="1" y="1" width="${width-2}" height="34" rx="11" fill="white" stroke="rgba(15,23,42,.18)" stroke-width="1.5"/><rect x="4" y="4" width="${width-8}" height="28" rx="9" fill="${c}"/><text x="${width/2}" y="23" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial" font-weight="800" font-size="14" fill="white">${label}</text><path d="M${width/2-6} 35 L${width/2} 43 L${width/2+6} 35 Z" fill="white" stroke="rgba(15,23,42,.18)" stroke-width="1"/></svg>`;
}
function updatePowerMarkers(){
  const icons=[...mapEl.querySelectorAll(".leaflet-marker-pane .leaflet-marker-icon")];
  const opts=[...$("stationSelect").options].filter(o=>o.value);
  if(!icons.length||!opts.length)return;
  icons.slice(0,opts.length).forEach((icon,i)=>{
    const text=opts[i]?.textContent||"";
    const m=text.match(/(?:—|-)\s*([0-9]+(?:[.,][0-9]+)?)\s*kW/i)||text.match(/([0-9]+(?:[.,][0-9]+)?)\s*kW/i);
    const kw=m?Number(m[1].replace(",",".")):NaN;
    if(icon.tagName.toLowerCase()==="img"){
      const svg=markerSvg(kw),w=(Number.isFinite(kw)&&String(Math.round(kw)).length>=3)?88:76;
      icon.src=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
      icon.style.width=`${w}px`;icon.style.height="46px";
      icon.style.marginLeft=`-${Math.round(w/2)}px`;icon.style.marginTop="-43px";
      icon.style.zIndex="500";
      icon.classList.add("cc-power-marker");
    }
  });
}
const mapObs=new MutationObserver(()=>requestAnimationFrame(updatePowerMarkers));
mapObs.observe(mapEl,{childList:true,subtree:true});
const stationSelect=$("stationSelect");
new MutationObserver(()=>setTimeout(updatePowerMarkers,50)).observe(stationSelect,{childList:true,subtree:true});

/* --- Fiche borne / bottom sheet --- */
const sheet=document.createElement("section");
sheet.id="ccStationSheet";
sheet.className="cc-station-sheet";
sheet.setAttribute("aria-label","Détails de la borne");
sheet.innerHTML=`
  <button id="ccSheetHandle" class="cc-sheet-handle" type="button" aria-label="Agrandir ou réduire la fiche"><span></span></button>
  <div class="cc-sheet-toolbar">
    <div>
      <div class="cc-sheet-kicker">Borne sélectionnée</div>
      <div id="ccSheetQuickTitle" class="cc-sheet-title">Borne</div>
      <div id="ccSheetQuickSub" class="cc-sheet-sub"></div>
    </div>
    <button id="ccSheetClose" class="cc-sheet-close" type="button" aria-label="Fermer">×</button>
  </div>
  <div id="ccSheetBody" class="cc-sheet-body"></div>`;
document.body.appendChild(sheet);
const sheetBody=$("ccSheetBody"),detail=$("stationDetail"),compare=$("compareCard");
sheetBody.appendChild(detail);sheetBody.appendChild(compare);

function syncQuick(){
  const title=$("stationName")?.textContent||"Borne";
  const sub=$("stationAddress")?.textContent||"";
  $("ccSheetQuickTitle").textContent=title;
  $("ccSheetQuickSub").textContent=sub;
}
function stationsVisible(){return !tab.classList.contains("hidden")}
function openSheet(){if(!stationsVisible())return;syncQuick();sheet.classList.add("open");sheet.classList.remove("expanded")}
function closeSheet(){sheet.classList.remove("open","expanded")}
function toggleSheet(){sheet.classList.toggle("expanded")}
$("ccSheetHandle").onclick=toggleSheet;
$("ccSheetClose").onclick=closeSheet;

let touchY=null;
sheet.addEventListener("touchstart",e=>{touchY=e.touches?.[0]?.clientY??null},{passive:true});
sheet.addEventListener("touchend",e=>{
  if(touchY==null)return;
  const y=e.changedTouches?.[0]?.clientY??touchY,d=y-touchY;touchY=null;
  if(d<-45)sheet.classList.add("expanded");
  if(d>60){if(sheet.classList.contains("expanded"))sheet.classList.remove("expanded");else closeSheet()}
},{passive:true});

const detailObs=new MutationObserver(()=>{
  if(!detail.classList.contains("hidden"))openSheet();
  syncQuick();
});
detailObs.observe(detail,{attributes:true,childList:true,subtree:true,characterData:true});

/* clic sur les onglets : la fiche n'empiète pas sur Parcours/Garage */
document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{
  setTimeout(()=>{if(!stationsVisible())closeSheet();else {mapEl.dispatchEvent(new Event("resize"));setTimeout(updatePowerMarkers,100)}},30);
}));

/* Bouton liste de bornes : utilise le select existant sans dupliquer la logique */
const listBtn=document.createElement("button");
listBtn.className="cc-map-list-btn";listBtn.type="button";listBtn.innerHTML="☷ <span>Liste</span>";
listBtn.onclick=()=>{
  const sel=$("stationSelect");
  if(!sel||sel.disabled)return;
  sel.focus();
  try{sel.showPicker?.()}catch{}
};
stage.appendChild(listBtn);

/* Synchronisation initiale */
if(originalQuery.value)searchInput.value=originalQuery.value;
syncCityChoices(false);
setPower(Number(originalPower.value)||0);
setTimeout(updatePowerMarkers,300);
})();

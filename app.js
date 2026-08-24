(()=>{
"use strict";

const $=id=>document.getElementById(id);
const STATIC_RESOURCES=[
  "4ca78c71-4ea4-475d-bd3a-d4aef88f7bf8",
  "eb76d20a-8501-400e-b336-d85724de5435"
];
const DYNAMIC_CSV="https://www.data.gouv.fr/api/1/datasets/r/89185b1f-f958-4c5b-9282-399a66ecee97";
const STORE_KEY="chargecompare-v11";

const VEHICLES=[
  {id:"id4-pro",name:"Volkswagen ID.4 Pro 77 kWh",battery:77,consumption:19.5,dc:175,ac:11},
  {id:"id4-pure",name:"Volkswagen ID.4 Pure 52 kWh",battery:52,consumption:18.5,dc:145,ac:11},
  {id:"modely-rwd",name:"Tesla Model Y Propulsion",battery:60,consumption:16.5,dc:175,ac:11},
  {id:"modely-lr",name:"Tesla Model Y Grande Autonomie",battery:75,consumption:17.5,dc:250,ac:11},
  {id:"scenic87",name:"Renault Scenic E-Tech 87 kWh",battery:87,consumption:17.5,dc:150,ac:22},
  {id:"megane60",name:"Renault Megane E-Tech 60 kWh",battery:60,consumption:16.5,dc:130,ac:22},
  {id:"e3008",name:"Peugeot E-3008 73 kWh",battery:73,consumption:17.2,dc:160,ac:11},
  {id:"ec3",name:"Citroën ë-C3 44 kWh",battery:44,consumption:17.0,dc:100,ac:11},
  {id:"custom",name:"Personnalisé",battery:77,consumption:20,dc:150,ac:11}
];

let state=loadState();
let cities=[], cityStations=[], selectedStation=null, gpsStart=null, mode="balanced";
let stationMap=null, stationMarkers=[], routeMap=null, routeLayer=null, routeStopMarkers=[];
let currentRoutePlan=null, dynamicStatusMap=null, dynamicStatusLoadedAt=0;

function loadState(){
  const defaults={
    vehicleId:"id4-pro",
    custom:{battery:77,consumption:20,dc:150,ac:11},
    cards:{electroverse:true,chargemap:true,operator:false},
    places:{home:"",work:""},
    favorites:[],
    history:[],
    savedRoutes:[]
  };
  try{
    const raw=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");
    return {...defaults,...raw,
      custom:{...defaults.custom,...(raw.custom||{})},
      cards:{...defaults.cards,...(raw.cards||{})},
      places:{...defaults.places,...(raw.places||{})},
      favorites:Array.isArray(raw.favorites)?raw.favorites:[],
      history:Array.isArray(raw.history)?raw.history:[],
      savedRoutes:Array.isArray(raw.savedRoutes)?raw.savedRoutes:[]
    };
  }catch{return defaults}
}
function saveState(){localStorage.setItem(STORE_KEY,JSON.stringify(state))}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function num(id){const v=Number(String($(id).value||"").replace(",","."));return Number.isFinite(v)?v:0}
function eur(v){return Number(v||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}
function fmtKm(v){return `${Math.round(v)} km`}
function fmtMin(v){v=Math.max(0,Math.round(v));const h=Math.floor(v/60),m=v%60;return h?`${h} h ${String(m).padStart(2,"0")}`:`${m} min`}
function setStatus(id,text,type=""){const e=$(id);e.textContent=text;e.className=`status${type?" "+type:""}`}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
function parseCoord(v){
  if(Array.isArray(v)&&v.length>=2)return [Number(v[0]),Number(v[1])];
  if(v&&typeof v==="object"&&Array.isArray(v.coordinates))return [Number(v.coordinates[0]),Number(v.coordinates[1])];
  if(typeof v==="string"){
    try{const x=JSON.parse(v);if(Array.isArray(x)&&x.length>=2)return [Number(x[0]),Number(x[1])]}catch{}
    const m=v.match(/-?\d+(?:\.\d+)?/g);if(m&&m.length>=2)return [Number(m[0]),Number(m[1])];
  }
  return null;
}
function hav(a,b){
  const R=6371,dlat=(b[1]-a[1])*Math.PI/180,dlon=(b[0]-a[0])*Math.PI/180;
  const x=Math.sin(dlat/2)**2+Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
}
async function getJSON(url,timeout=14000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{Accept:"application/json"}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}
function vehicle(){
  if(state.vehicleId==="custom")return {id:"custom",name:"Personnalisé",...state.custom};
  return VEHICLES.find(v=>v.id===state.vehicleId)||VEHICLES[0];
}
function fillVehicleSelects(){
  for(const id of ["vehicleSelect","garageVehicleSelect"]){
    const s=$(id);s.innerHTML="";
    VEHICLES.forEach(v=>{const o=document.createElement("option");o.value=v.id;o.textContent=v.name;s.appendChild(o)});
    s.value=state.vehicleId;
  }
  renderVehicleSummary();
  loadGarageFields();
}
function renderVehicleSummary(){
  const v=vehicle();
  $("vehicleSummary").innerHTML=`<b>${esc(v.name)}</b><br>${v.battery} kWh utiles · ${v.consumption} kWh/100 km · DC max ${v.dc} kW · AC ${v.ac} kW`;
}
function loadGarageFields(){
  const v=vehicle();
  $("customBattery").value=String(v.battery).replace(".",",");
  $("customConsumption").value=String(v.consumption).replace(".",",");
  $("customDc").value=String(v.dc).replace(".",",");
  $("customAc").value=String(v.ac).replace(".",",");
  $("garageElectroverse").checked=state.cards.electroverse;
  $("garageChargemap").checked=state.cards.chargemap;
  $("garageOperator").checked=state.cards.operator;
  $("homePlace").value=state.places.home||"";
  $("workPlace").value=state.places.work||"";
  syncCompareCards();
}
function syncCompareCards(){
  $("useElectroverse").checked=state.cards.electroverse;
  $("useChargemap").checked=state.cards.chargemap;
  $("useOperator").checked=state.cards.operator;
}
function renderSavedPlaces(){
  const e=$("savedPlaces");e.innerHTML="";
  if(state.places.home){
    const b=document.createElement("button");b.textContent="🏠 Maison";b.onclick=()=>{$("routeFrom").value=state.places.home};e.appendChild(b);
  }
  if(state.places.work){
    const b=document.createElement("button");b.textContent="💼 Travail";b.onclick=()=>{$("routeTo").value=state.places.work};e.appendChild(b);
  }
  state.savedRoutes.slice(0,3).forEach(r=>{
    const b=document.createElement("button");b.textContent=`↻ ${r.from} → ${r.to}`;b.onclick=()=>{$("routeFrom").value=r.from;$("routeTo").value=r.to};e.appendChild(b);
  });
}
function renderLists(){
  const f=$("favoritesList"),h=$("historyList");
  f.innerHTML="<b>Stations favorites</b>";
  if(!state.favorites.length)f.innerHTML+=`<div class="listItem muted">Aucun favori.</div>`;
  state.favorites.slice(0,8).forEach((x,i)=>{
    f.innerHTML+=`<div class="listItem"><b>${esc(x.name)}</b><small>${esc(x.address||"")} · ${esc(x.operator||"")}</small><button class="btn small" data-fav-remove="${i}">Retirer</button></div>`;
  });
  h.innerHTML="<b>Dernières comparaisons</b>";
  if(!state.history.length)h.innerHTML+=`<div class="listItem muted">Aucun historique.</div>`;
  state.history.slice(0,8).forEach(x=>{
    h.innerHTML+=`<div class="listItem"><b>${esc(x.station)}</b><small>${esc(x.when)} · ${x.kwh} kWh · ${esc(x.winner)} · ${esc(x.cost)}</small></div>`;
  });
  f.querySelectorAll("[data-fav-remove]").forEach(b=>b.onclick=()=>{state.favorites.splice(Number(b.dataset.favRemove),1);saveState();renderLists();updateFavoriteStar()});
}
function tabs(name){
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  ["stations","route","garage"].forEach(x=>$(x+"Tab").classList.toggle("hidden",x!==name));
  setTimeout(()=>{if(name==="stations"&&stationMap)stationMap.invalidateSize();if(name==="route"&&routeMap)routeMap.invalidateSize()},100);
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>tabs(b.dataset.tab));

function initMaps(){
  if(!window.L)return;
  stationMap=L.map("stationMap",{zoomControl:true}).setView([46.6,2.4],5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(stationMap);
  routeMap=L.map("routeMap",{zoomControl:true}).setView([46.6,2.4],5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(routeMap);
}
async function searchCities(){
  const q=$("cityQuery").value.trim();
  if(q.length<2)return setStatus("cityStatus","Tape au moins 2 caractères.","bad");
  $("citySearchBtn").disabled=true;setStatus("cityStatus","Recherche…");
  try{
    const u=/^\d{5}$/.test(q)
      ?`https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,centre&limit=20`
      :`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,centre&boost=population&limit=20`;
    const r=await getJSON(u);
    cities=Array.isArray(r)?r:[];
    const s=$("citySelect");s.innerHTML='<option value="">Choisir une commune</option>';
    cities.forEach((c,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=`${c.nom} — ${(c.codesPostaux||[])[0]||""}`;s.appendChild(o)});
    s.disabled=!cities.length;
    setStatus("cityStatus",`${cities.length} commune(s) trouvée(s).`,cities.length?"good":"bad");
  }catch(e){setStatus("cityStatus",`Recherche impossible : ${e.message}`,"bad")}
  finally{$("citySearchBtn").disabled=false}
}
$("citySearchBtn").onclick=searchCities;
$("cityQuery").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchCities()}});
$("citySelect").onchange=()=>{const c=cities[Number($("citySelect").value)];if(c)loadCityStations(c)};

async function tabularRows(resource,params){
  const qs=new URLSearchParams(params);
  const u=`https://tabular-api.data.gouv.fr/api/resources/${resource}/data/?${qs}`;
  const j=await getJSON(u,16000);
  return j;
}
async function loadStaticRowsByCommune(code){
  let lastErr=null;
  for(const resource of STATIC_RESOURCES){
    try{
      let out=[];
      for(let page=1;page<=5;page++){
        const j=await tabularRows(resource,{code_insee_commune__exact:code,page_size:"100",page:String(page)});
        const d=Array.isArray(j.data)?j.data:[];
        out=out.concat(d);
        if(!d.length||!(j.links&&j.links.next))break;
      }
      if(out.length)return out;
    }catch(e){lastErr=e}
  }
  if(lastErr)throw lastErr;
  return [];
}
function aggregateStations(rows){
  const map=new Map();
  rows.forEach(r=>{
    const id=r.id_station_itinerance||r.id_station_local||`${r.nom_station||""}|${r.adresse_station||""}`;
    if(!id)return;
    let s=map.get(id);
    if(!s){
      s={id,name:r.nom_station||r.nom_enseigne||"Station",address:r.adresse_station||"",operator:r.nom_operateur||r.nom_enseigne||"",brand:r.nom_enseigne||"",coord:parseCoord(r.coordonneesXY),maxPower:0,pdcCount:Number(r.nbre_pdc)||0,tarification:r.tarification||"",access:r.condition_acces||"",hours:r.horaires||"",dateMaj:r.date_maj||"",free:r.gratuit===true||r.gratuit==="true",evseIds:[],connectors:new Set()};
      map.set(id,s);
    }
    s.maxPower=Math.max(s.maxPower,Number(r.puissance_nominale)||0);
    s.pdcCount=Math.max(s.pdcCount,Number(r.nbre_pdc)||0);
    if(r.id_pdc_itinerance)s.evseIds.push(r.id_pdc_itinerance);
    if(r.prise_type_combo_ccs===true||r.prise_type_combo_ccs==="true")s.connectors.add("CCS");
    if(r.prise_type_2===true||r.prise_type_2==="true")s.connectors.add("Type 2");
    if(r.prise_type_chademo===true||r.prise_type_chademo==="true")s.connectors.add("CHAdeMO");
    if(!s.tarification&&r.tarification)s.tarification=r.tarification;
  });
  return [...map.values()].map(s=>({...s,connectors:[...s.connectors]}));
}
async function loadCityStations(c){
  setStatus("cityStatus","Chargement des bornes IRVE…");
  $("stationSelect").disabled=true;
  try{
    cityStations=aggregateStations(await loadStaticRowsByCommune(c.code)).sort((a,b)=>b.maxPower-a.maxPower);
    renderStationOptions();
    renderStationMap(c);
    $("stationMapCard").classList.remove("hidden");
    setStatus("cityStatus",`${cityStations.length} station(s) trouvée(s) à ${c.nom}.`,"good");
  }catch(e){setStatus("cityStatus",`Bornes indisponibles : ${e.message}`,"bad")}
}
function filteredCityStations(){const p=Number($("stationPowerFilter").value)||0;return cityStations.filter(s=>s.maxPower>=p)}
function renderStationOptions(){
  const arr=filteredCityStations(),sel=$("stationSelect");sel.innerHTML='<option value="">Choisir une borne</option>';
  arr.forEach(s=>{const o=document.createElement("option");o.value=s.id;o.textContent=`${s.name}${s.maxPower?` — ${s.maxPower} kW`:""}`;sel.appendChild(o)});
  sel.disabled=!arr.length;
}
$("stationPowerFilter").onchange=()=>{renderStationOptions();renderStationMap()};
$("stationSelect").onchange=()=>{const id=$("stationSelect").value;const s=cityStations.find(x=>x.id===id);if(s)selectStation(s)};

function renderStationMap(c){
  if(!stationMap)return;
  stationMarkers.forEach(m=>m.remove());stationMarkers=[];
  const arr=filteredCityStations().filter(s=>s.coord&&Number.isFinite(s.coord[0])&&Number.isFinite(s.coord[1]));
  arr.forEach(s=>{
    const m=L.marker([s.coord[1],s.coord[0]]).addTo(stationMap).bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.address)}<br>${s.maxPower||"?"} kW`);
    m.on("click",()=>selectStation(s));stationMarkers.push(m);
  });
  if(arr.length){
    stationMap.fitBounds(L.latLngBounds(arr.map(s=>[s.coord[1],s.coord[0]])),{padding:[20,20],maxZoom:14});
  }else if(c&&c.centre&&Array.isArray(c.centre.coordinates)){stationMap.setView([c.centre.coordinates[1],c.centre.coordinates[0]],12)}
  setTimeout(()=>stationMap.invalidateSize(),100);
}
function estimatePrice(power){
  if(power<=22)return .35;if(power<=50)return .45;if(power<150)return .55;return .59;
}
function extractPerKwh(text){
  if(!text)return null;
  const t=String(text).replace(",",".");
  const patterns=[/(\d+(?:\.\d+)?)\s*€?\s*\/\s*kwh/i,/(\d+(?:\.\d+)?)\s*€\s*(?:par)?\s*kwh/i,/(\d+(?:\.\d+)?)\s*eur\s*\/\s*kwh/i];
  for(const p of patterns){const m=t.match(p);if(m){const v=Number(m[1]);if(v>0&&v<5)return v}}
  return null;
}
function operatorPublicPrice(s){
  const h=norm(`${s.name} ${s.operator} ${s.brand}`);
  if(s.free)return {price:0,label:"Gratuit",kind:"real",source:"IRVE"};
  const inIrve=extractPerKwh(s.tarification);
  if(inIrve!==null)return {price:inIrve,label:`${inIrve.toFixed(3).replace(".",",")} €/kWh`,kind:"public",source:"IRVE — champ tarification"};
  if(h.includes("izivia fast")||(h.includes("izivia")&&h.includes("mcdonald")))return {price:.35,label:"à partir de 0,30 €/kWh Happy Hour",kind:"public",source:"IZIVIA FAST"};
  if(h.includes("ionity"))return {price:null,label:"Prix station variable — IONITY Direct à partir de 0,39 €/kWh",kind:"public",source:"IONITY"};
  if(h.includes("electra"))return {price:null,label:"Prix variable selon station et heure",kind:"public",source:"Electra"};
  return {price:null,label:"Pas de tarif station fiable dans la donnée publique",kind:"none",source:""};
}
function selectStation(s){
  selectedStation=s;
  $("stationDetail").classList.remove("hidden");$("compareCard").classList.remove("hidden");
  $("stationName").textContent=s.name;$("stationAddress").textContent=s.address||"Adresse non renseignée";
  $("stationMeta").innerHTML=[
    `<span class="chip">⚡ ${s.maxPower||"?"} kW</span>`,
    `<span class="chip">🔌 ${s.pdcCount||s.evseIds.length||"?"} points</span>`,
    `<span class="chip">${esc(s.operator||"Opérateur inconnu")}</span>`,
    s.connectors.length?`<span class="chip">${esc(s.connectors.join(" · "))}</span>`:"",
    s.hours?`<span class="chip">${esc(s.hours)}</span>`:""
  ].join("");
  const op=operatorPublicPrice(s);
  $("stationTariffInfo").innerHTML=`<b>Tarification publique</b><br>${esc(s.tarification||op.label)}${s.dateMaj?`<br><span class="muted">IRVE mise à jour : ${esc(s.dateMaj)}</span>`:""}`;
  $("stationLiveInfo").innerHTML=`<b>Temps réel</b><br>Non vérifié. Appuie sur “Temps réel” pour interroger la base dynamique nationale.`;
  const base=op.price!==null?op.price:estimatePrice(s.maxPower);
  $("evPrice").value=base.toFixed(3).replace(".",",");
  $("cmPrice").value=(base*1.10).toFixed(3).replace(".",",");
  $("opPrice").value=op.price!==null?op.price.toFixed(3).replace(".",","):"";
  $("opBadge").textContent=op.kind==="real"?"RÉEL":op.kind==="public"?"PUBLIC":"—";
  $("opBadge").className=`miniBadge ${op.kind==="real"?"real":op.kind==="public"?"public":""}`;
  $("evBadge").textContent="ESTIMÉ";$("cmBadge").textContent="ESTIMÉ";
  calcCompare();updateFavoriteStar();
  if(s.coord&&stationMap){stationMap.setView([s.coord[1],s.coord[0]],15)}
}
function updateFavoriteStar(){
  if(!selectedStation)return;
  const yes=state.favorites.some(x=>x.id===selectedStation.id);
  $("favoriteStationBtn").textContent=yes?"★":"☆";
}
$("favoriteStationBtn").onclick=()=>{
  if(!selectedStation)return;
  const i=state.favorites.findIndex(x=>x.id===selectedStation.id);
  if(i>=0)state.favorites.splice(i,1);else state.favorites.unshift({id:selectedStation.id,name:selectedStation.name,address:selectedStation.address,operator:selectedStation.operator,coord:selectedStation.coord});
  state.favorites=state.favorites.slice(0,20);saveState();updateFavoriteStar();renderLists();
};

function calcCompare(){
  const k=num("compareKwh"), options=[];
  if($("useElectroverse").checked&&num("evPrice")>=0)options.push({name:"Electroverse",price:num("evPrice")});
  if($("useChargemap").checked&&num("cmPrice")>=0)options.push({name:"Chargemap",price:num("cmPrice")});
  if($("useOperator").checked&&$("opPrice").value.trim()!==""&&num("opPrice")>=0)options.push({name:"Opérateur direct",price:num("opPrice")});
  if(!(k>0)||!options.length){$("compareResult").innerHTML="Choisis au moins un moyen de paiement.";return}
  options.forEach(o=>o.cost=o.price*k);options.sort((a,b)=>a.cost-b.cost);
  const best=options[0],second=options[1],saving=second?second.cost-best.cost:0;
  $("compareResult").innerHTML=`<strong>${esc(best.name)}</strong><br>${eur(best.cost)} pour ${k} kWh${second?` · économie ${eur(saving)} vs ${esc(second.name)}`:""}<br><span class="note">Tarifs roaming marqués ESTIMÉ : vérifie l’app du fournisseur avant de badger.</span>`;
}
["evPrice","cmPrice","opPrice","compareKwh","useElectroverse","useChargemap","useOperator"].forEach(id=>$(id).addEventListener("input",calcCompare));
document.querySelectorAll("[data-kwh]").forEach(b=>b.onclick=()=>{$("compareKwh").value=b.dataset.kwh;document.querySelectorAll("[data-kwh]").forEach(x=>x.classList.toggle("active",x===b));calcCompare()});
$("saveComparisonBtn").onclick=()=>{
  if(!selectedStation)return;
  const text=$("compareResult").textContent.trim();
  state.history.unshift({station:selectedStation.name,when:new Date().toLocaleString("fr-FR"),kwh:num("compareKwh"),winner:text.split(/\s/).slice(0,2).join(" "),cost:text});
  state.history=state.history.slice(0,30);saveState();renderLists();$("saveComparisonBtn").textContent="✓ Enregistré";setTimeout(()=>$("saveComparisonBtn").textContent="Enregistrer cette comparaison",1200)
};

function navTo(coord,kind){
  if(!coord)return;
  const [lon,lat]=coord;
  const u=kind==="apple"?`https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`:`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  window.open(u,"_blank");
}
$("appleMapsBtn").onclick=()=>selectedStation&&navTo(selectedStation.coord,"apple");
$("googleMapsBtn").onclick=()=>selectedStation&&navTo(selectedStation.coord,"google");

async function loadDynamicFeed(force=false){
  if(dynamicStatusMap&&!force&&Date.now()-dynamicStatusLoadedAt<5*60*1000)return dynamicStatusMap;
  const r=await fetch(DYNAMIC_CSV,{cache:"no-store"});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const text=await r.text();
  const rows=parseCSV(text);
  if(rows.length<2)throw new Error("Flux dynamique vide");
  const head=rows[0],idx={};
  ["id_pdc_itinerance","etat_pdc","occupation_pdc","horodatage"].forEach(k=>idx[k]=head.indexOf(k));
  const m=new Map();
  for(let i=1;i<rows.length;i++){
    const row=rows[i],id=row[idx.id_pdc_itinerance];if(!id)continue;
    const cur={state:row[idx.etat_pdc]||"inconnu",occupation:row[idx.occupation_pdc]||"inconnu",time:row[idx.horodatage]||""};
    const old=m.get(id);if(!old||String(cur.time)>String(old.time))m.set(id,cur);
  }
  dynamicStatusMap=m;dynamicStatusLoadedAt=Date.now();return m;
}
function parseCSV(text){
  const rows=[],row=[];let cell="",q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i++}
      else if(ch==='"')q=false;
      else cell+=ch;
    }else{
      if(ch==='"')q=true;
      else if(ch===","){row.push(cell);cell=""}
      else if(ch==="\n"){row.push(cell);rows.push(row.splice(0));cell=""}
      else if(ch!=="\r")cell+=ch;
    }
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}
function stationLiveSummary(s,map){
  const vals=s.evseIds.map(id=>map.get(id)).filter(Boolean);
  if(!vals.length)return {html:`<b>Temps réel</b><br>Aucune donnée dynamique disponible pour cette station.`,free:null};
  const free=vals.filter(x=>x.state==="en_service"&&x.occupation==="libre").length;
  const occupied=vals.filter(x=>x.occupation==="occupe").length;
  const out=vals.filter(x=>x.state==="hors_service").length;
  const known=vals.length;
  const latest=vals.map(x=>x.time).filter(Boolean).sort().at(-1)||"";
  return {free,html:`<b>Temps réel</b><br><span class="${free?"liveGood":"liveBad"}">${free} libre(s)</span> · ${occupied} occupé(s) · ${out} hors service · ${known} point(s) remonté(s)${latest?`<br><span class="muted">Dernière donnée : ${esc(latest)}</span>`:""}`};
}
$("refreshLiveBtn").onclick=async()=>{
  if(!selectedStation)return;
  $("refreshLiveBtn").disabled=true;$("stationLiveInfo").innerHTML="<b>Temps réel</b><br>Téléchargement du flux national dynamique…";
  try{$("stationLiveInfo").innerHTML=stationLiveSummary(selectedStation,await loadDynamicFeed(true)).html}
  catch(e){$("stationLiveInfo").innerHTML=`<b>Temps réel</b><br>Indisponible : ${esc(e.message)}`}
  finally{$("refreshLiveBtn").disabled=false}
};

async function geocodePlace(q){
  const s=String(q||"").trim();
  if(!s)throw new Error("Lieu manquant");
  const u=/^\d{5}$/.test(s)
    ?`https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(s)}&fields=nom,code,centre&limit=10`
    :`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(s)}&fields=nom,code,centre&boost=population&limit=10`;
  const r=await getJSON(u);
  if(!r[0]||!r[0].centre||!Array.isArray(r[0].centre.coordinates))throw new Error(`Lieu introuvable : ${s}`);
  return {name:r[0].nom,code:r[0].code,coord:r[0].centre.coordinates};
}
async function osrmRoute(a,b){
  const u=`https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson&steps=false`;
  const j=await getJSON(u,24000);if(j.code!=="Ok"||!j.routes||!j.routes[0])throw new Error("Itinéraire introuvable");
  return j.routes[0];
}
function sampleRoute(coords,stepKm=18){
  const out=[{coord:coords[0],p:0}];let total=0,next=stepKm;
  for(let i=1;i<coords.length;i++){
    const d=hav(coords[i-1],coords[i]),before=total;total+=d;
    while(total>=next){
      const frac=d?clamp((next-before)/d,0,1):0;
      out.push({coord:[coords[i-1][0]+(coords[i][0]-coords[i-1][0])*frac,coords[i-1][1]+(coords[i][1]-coords[i-1][1])*frac],p:next});
      next+=stepKm;
    }
  }
  out.push({coord:coords.at(-1),p:total});return out;
}
async function communesForSamples(samples){
  const seen=new Map(),select=samples;
  for(let i=0;i<select.length;i++){
    const p=select[i];
    try{
      const r=await getJSON(`https://geo.api.gouv.fr/communes?lat=${p.coord[1]}&lon=${p.coord[0]}&fields=nom,code&limit=1`,8000);
      if(r[0]&&!seen.has(r[0].code))seen.set(r[0].code,r[0]);
    }catch{}
  }
  return [...seen.values()];
}
async function routeCandidates(samples,detourMax,onProgress){
  const communes=await communesForSamples(samples),all=[];
  for(let i=0;i<communes.length;i++){
    onProgress&&onProgress(i+1,communes.length);
    try{all.push(...aggregateStations(await loadStaticRowsByCommune(communes[i].code)))}catch{}
  }
  const uniq=new Map();all.forEach(s=>uniq.set(s.id,s));
  const out=[];
  for(const s of uniq.values()){
    if(!s.coord||s.maxPower<22)continue;
    let best=Infinity,p=0;
    for(const sm of samples){const d=hav(s.coord,sm.coord);if(d<best){best=d;p=sm.p}}
    if(best<=detourMax)out.push({...s,routeP:p,detour:best,publicPrice:operatorPublicPrice(s),estPrice:estimatePrice(s.maxPower)});
  }
  return out.sort((a,b)=>a.routeP-b.routeP);
}
function chargeMinutes(v,stationPower,fromSoc,toSoc){
  const peak=Math.max(20,Math.min(Number(stationPower)||50,Number(v.dc)||100));
  const battery=Number(v.battery)||60;
  const bands=[[0,50,.90],[50,70,.75],[70,80,.55],[80,90,.35],[90,100,.20]];
  let min=2;
  for(const [a,b,f] of bands){
    const lo=Math.max(fromSoc,a),hi=Math.min(toSoc,b);
    if(hi<=lo)continue;
    const energy=battery*(hi-lo)/100;
    min+=energy/(peak*f)*60;
  }
  return min;
}
function scoreCandidate(s,ctx){
  const progress=(s.routeP-ctx.pos)/Math.max(1,ctx.maxKm);
  const power=Math.min(1,s.maxPower/Math.max(80,ctx.v.dc));
  const price=s.publicPrice.price!==null?s.publicPrice.price:s.estPrice;
  const cheap=clamp(1-(price-.25)/.55,0,1);
  const det=clamp(1-s.detour/Math.max(1,ctx.detourMax),0,1);
  if(mode==="fast")return progress*.45+power*.42+det*.13;
  if(mode==="cheap")return progress*.32+cheap*.47+det*.21;
  return progress*.42+power*.25+cheap*.20+det*.13;
}
function buildMultiStopPlan(routeKm,candidates,v,startSoc,reserveSoc,targetSoc,detourMax){
  const stops=[];let pos=0,soc=startSoc,totalCharge=0,totalChargeMin=0,totalCost=0,guard=0;
  const kwhKm=v.consumption/100;
  while(guard++<10){
    const toDest=routeKm-pos;
    const usableKm=(v.battery*(soc-reserveSoc)/100)/kwhKm;
    if(toDest<=usableKm){
      const arrival=clamp(soc-(toDest*kwhKm/v.battery*100),0,100);
      return {ok:true,stops,totalCharge,totalChargeMin,totalCost,arrivalSoc:arrival};
    }
    const ctx={pos,maxKm:usableKm,v,detourMax};
    const minP=pos+Math.max(8,usableKm*.45),maxP=pos+usableKm*.96;
    let pool=candidates.filter(s=>s.routeP>minP&&s.routeP<=maxP);
    if(!pool.length)pool=candidates.filter(s=>s.routeP>pos+5&&s.routeP<=pos+usableKm*.98);
    if(!pool.length)return {ok:false,stops,totalCharge,totalChargeMin,totalCost,arrivalSoc:soc,reason:"Aucune borne atteignable avec la réserve demandée."};
    pool.sort((a,b)=>scoreCandidate(b,ctx)-scoreCandidate(a,ctx));
    const s=pool[0],leg=s.routeP-pos;
    const arrival=clamp(soc-(leg*kwhKm/v.battery*100),0,100);
    const remaining=routeKm-s.routeP;
    const socNeededDest=reserveSoc+(remaining*kwhKm/v.battery*100);
    let depart=Math.max(targetSoc,Math.min(92,socNeededDest));
    if(socNeededDest<targetSoc)depart=targetSoc;
    depart=clamp(depart,arrival+3,95);
    const kwh=v.battery*(depart-arrival)/100;
    const mins=chargeMinutes(v,s.maxPower,arrival,depart);
    const p=s.publicPrice.price!==null?s.publicPrice.price:s.estPrice;
    const ev=p,cm=p*1.10,op=s.publicPrice.price;
    const choices=[];
    if(state.cards.electroverse)choices.push({name:"Electroverse",price:ev});
    if(state.cards.chargemap)choices.push({name:"Chargemap",price:cm});
    if(state.cards.operator&&op!==null)choices.push({name:"Opérateur",price:op});
    choices.sort((a,b)=>a.price-b.price);
    const best=choices[0]||{name:"Estimation",price:p};
    const cost=kwh*best.price;
    stops.push({...s,arrivalSoc:arrival,departSoc:depart,chargeKwh:kwh,chargeMin:mins,evPrice:ev,cmPrice:cm,opPrice:op,bestCard:best.name,bestPrice:best.price,cost,live:null});
    totalCharge+=kwh;totalChargeMin+=mins;totalCost+=cost;
    pos=s.routeP;soc=depart;
  }
  return {ok:false,stops,totalCharge,totalChargeMin,totalCost,arrivalSoc:soc,reason:"Trop d’arrêts nécessaires."};
}
function renderRouteMap(coords,stops,A,B){
  if(!routeMap)return;
  if(routeLayer)routeLayer.remove();routeStopMarkers.forEach(m=>m.remove());routeStopMarkers=[];
  routeLayer=L.polyline(coords.map(c=>[c[1],c[0]]),{weight:5}).addTo(routeMap);
  const ma=L.marker([A.coord[1],A.coord[0]]).addTo(routeMap).bindPopup(`Départ : ${esc(A.name)}`);
  const mb=L.marker([B.coord[1],B.coord[0]]).addTo(routeMap).bindPopup(`Arrivée : ${esc(B.name)}`);
  routeStopMarkers.push(ma,mb);
  stops.forEach((s,i)=>{
    const m=L.marker([s.coord[1],s.coord[0]]).addTo(routeMap).bindPopup(`<b>Arrêt ${i+1}</b><br>${esc(s.name)}<br>${s.maxPower} kW`);
    routeStopMarkers.push(m);
  });
  routeMap.fitBounds(routeLayer.getBounds(),{padding:[20,20]});setTimeout(()=>routeMap.invalidateSize(),100);
}
function renderStops(plan){
  const e=$("routeStops");e.innerHTML="";
  plan.stops.forEach((s,i)=>{
    const div=document.createElement("div");div.className="stopCard";div.dataset.stopIndex=String(i);
    div.innerHTML=`<div class="stopHead"><h3>Arrêt ${i+1} — ${esc(s.name)}</h3><span class="chip">km ${Math.round(s.routeP)}</span></div>
      <div class="muted">${esc(s.address||"")}<br>${esc(s.operator||"")} · ${s.maxPower||"?"} kW · détour ~${s.detour.toFixed(1)} km</div>
      <div class="chipRow"><span class="chip">🔋 ${s.arrivalSoc.toFixed(0)} → ${s.departSoc.toFixed(0)} %</span><span class="chip">⚡ ${s.chargeKwh.toFixed(1)} kWh</span><span class="chip">⏱ ~${fmtMin(s.chargeMin)}</span><span class="chip">${esc(s.bestCard)}</span></div>
      <div class="stopGrid">
        <div class="stopMini"><span>Electroverse estimé</span><b>${eur(s.evPrice*s.chargeKwh)}</b></div>
        <div class="stopMini"><span>Chargemap estimé</span><b>${eur(s.cmPrice*s.chargeKwh)}</b></div>
      </div>
      <div class="liveBox stopLive">Temps réel non vérifié.</div>
      <div class="stopActions"><button class="btn" data-nav="${i}" data-kind="apple"> Plans</button><button class="btn" data-nav="${i}" data-kind="google">Google Maps</button></div>`;
    e.appendChild(div);
  });
  e.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{const s=currentRoutePlan.plan.stops[Number(b.dataset.nav)];navTo(s.coord,b.dataset.kind)});
}
function routeVerdict(plan){
  if(!plan.stops.length)return "Aucun arrêt recharge nécessaire.";
  const fastest=plan.stops.reduce((a,b)=>a.chargeMin<b.chargeMin?a:b);
  return `${plan.stops.length} arrêt(s) · ${plan.totalCharge.toFixed(1)} kWh repris · environ ${fmtMin(plan.totalChargeMin)} de recharge. Arrêt le plus long : ${esc(fastest.name)}.`;
}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("active",x===b))});
$("swapRouteBtn").onclick=()=>{const a=$("routeFrom").value;$("routeFrom").value=$("routeTo").value;$("routeTo").value=a;gpsStart=null};
$("gpsBtn").onclick=()=>{
  if(!navigator.geolocation)return setStatus("routeStatus","GPS indisponible.","bad");
  setStatus("routeStatus","Récupération de ta position…");
  navigator.geolocation.getCurrentPosition(p=>{gpsStart=[p.coords.longitude,p.coords.latitude];$("routeFrom").value="Ma position GPS";setStatus("routeStatus","Position GPS utilisée.","good")},()=>setStatus("routeStatus","Position GPS refusée ou indisponible.","bad"),{enableHighAccuracy:true,timeout:12000});
};
$("planRouteBtn").onclick=async()=>{
  const btn=$("planRouteBtn");btn.disabled=true;
  try{
    $("routeSummaryCard").classList.add("hidden");$("stopsCard").classList.add("hidden");
    setStatus("routeStatus","Géocodage du départ et de l’arrivée…");
    const A=gpsStart?{name:"Ma position",coord:gpsStart}:await geocodePlace($("routeFrom").value);
    const B=await geocodePlace($("routeTo").value);
    setStatus("routeStatus","Calcul de l’itinéraire routier…");
    const r=await osrmRoute(A.coord,B.coord),routeKm=r.distance/1000,driveMin=r.duration/60,coords=r.geometry.coordinates;
    const v=vehicle(),start=clamp(num("startSoc"),1,100),reserve=clamp(num("reserveSoc"),0,80),target=clamp(num("targetSoc"),20,95),detour=clamp(num("detourKm"),2,50);
    const tripEnergy=routeKm*v.consumption/100;
    const directArrival=start-(tripEnergy/v.battery*100);
    let plan;
    if(directArrival>=reserve){plan={ok:true,stops:[],totalCharge:0,totalChargeMin:0,totalCost:0,arrivalSoc:directArrival}}
    else{
      setStatus("routeStatus","Recherche des bornes le long du trajet…");
      const samples=sampleRoute(coords);
      const cand=await routeCandidates(samples,detour,(i,n)=>setStatus("routeStatus",`Bornes IRVE : ${i}/${n} zones…`));
      plan=buildMultiStopPlan(routeKm,cand,v,start,reserve,target,detour);
      if(!plan.ok)throw new Error(plan.reason||"Impossible de construire le plan");
    }
    currentRoutePlan={A,B,r,routeKm,driveMin,coords,plan,v};
    $("routeMapCard").classList.remove("hidden");$("routeSummaryCard").classList.remove("hidden");
    $("routeTitle").textContent=`${A.name} → ${B.name}`;
    $("sumDistance").textContent=fmtKm(routeKm);$("sumDrive").textContent=fmtMin(driveMin);$("sumChargeTime").textContent=fmtMin(plan.totalChargeMin);$("sumStops").textContent=String(plan.stops.length);$("sumCost").textContent=eur(plan.totalCost);$("sumArrivalSoc").textContent=`${plan.arrivalSoc.toFixed(0)} %`;
    $("routeVerdict").innerHTML=routeVerdict(plan);
    if(plan.stops.length){$("stopsCard").classList.remove("hidden");renderStops(plan)}else{$("stopsCard").classList.add("hidden")}
    renderRouteMap(coords,plan.stops,A,B);
    setStatus("routeStatus","Parcours calculé. Temps de recharge estimé avec une courbe de puissance simplifiée.","good");
  }catch(e){setStatus("routeStatus",`Erreur : ${e.message}`,"bad")}
  finally{btn.disabled=false}
};
$("fitRouteBtn").onclick=()=>{if(routeMap&&routeLayer)routeMap.fitBounds(routeLayer.getBounds(),{padding:[20,20]})};
$("refreshRouteLiveBtn").onclick=async()=>{
  if(!currentRoutePlan||!currentRoutePlan.plan.stops.length)return setStatus("routeStatus","Aucun arrêt à vérifier.","good");
  const b=$("refreshRouteLiveBtn");b.disabled=true;setStatus("routeStatus","Téléchargement du flux dynamique national…");
  try{
    const map=await loadDynamicFeed(true);
    document.querySelectorAll(".stopCard").forEach(card=>{
      const i=Number(card.dataset.stopIndex),s=currentRoutePlan.plan.stops[i],sum=stationLiveSummary(s,map);
      s.live=sum;card.querySelector(".stopLive").innerHTML=sum.html;
    });
    setStatus("routeStatus","Disponibilité temps réel mise à jour lorsque les opérateurs la publient.","good");
  }catch(e){setStatus("routeStatus",`Temps réel indisponible : ${e.message}`,"bad")}
  finally{b.disabled=false}
};
$("saveRouteBtn").onclick=()=>{
  if(!currentRoutePlan)return;
  state.savedRoutes.unshift({from:currentRoutePlan.A.name,to:currentRoutePlan.B.name,when:new Date().toISOString()});
  state.savedRoutes=state.savedRoutes.slice(0,10);saveState();renderSavedPlaces();$("saveRouteBtn").textContent="✓ Trajet enregistré";setTimeout(()=>$("saveRouteBtn").textContent="☆ Enregistrer trajet",1200)
};

$("vehicleSelect").onchange=e=>{state.vehicleId=e.target.value;saveState();$("garageVehicleSelect").value=state.vehicleId;renderVehicleSummary();loadGarageFields()};
$("garageVehicleSelect").onchange=e=>{state.vehicleId=e.target.value;saveState();$("vehicleSelect").value=state.vehicleId;renderVehicleSummary();loadGarageFields()};
$("saveVehicleBtn").onclick=()=>{
  state.vehicleId=$("garageVehicleSelect").value;
  if(state.vehicleId==="custom")state.custom={battery:num("customBattery"),consumption:num("customConsumption"),dc:num("customDc"),ac:num("customAc")};
  saveState();$("vehicleSelect").value=state.vehicleId;renderVehicleSummary();$("saveVehicleBtn").textContent="✓ Enregistré";setTimeout(()=>$("saveVehicleBtn").textContent="Enregistrer",1000)
};
$("saveCardsBtn").onclick=()=>{
  state.cards={electroverse:$("garageElectroverse").checked,chargemap:$("garageChargemap").checked,operator:$("garageOperator").checked};saveState();syncCompareCards();calcCompare();$("saveCardsBtn").textContent="✓ Enregistré";setTimeout(()=>$("saveCardsBtn").textContent="Enregistrer mes cartes",1000)
};
$("savePlacesBtn").onclick=()=>{
  state.places={home:$("homePlace").value.trim(),work:$("workPlace").value.trim()};saveState();renderSavedPlaces();$("savePlacesBtn").textContent="✓ Enregistré";setTimeout(()=>$("savePlacesBtn").textContent="Enregistrer",1000)
};
$("clearHistoryBtn").onclick=()=>{if(confirm("Effacer l’historique ChargeCompare ?")){state.history=[];saveState();renderLists()}};

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
fillVehicleSelects();renderSavedPlaces();renderLists();initMaps();
})();
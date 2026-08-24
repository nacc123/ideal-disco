(()=>{
"use strict";
const $=id=>document.getElementById(id);
const overlay=document.querySelector('.cc-map-overlay');
const searchBar=document.querySelector('.cc-search-bar');
const searchBtn=$('ccMapSearchBtn');
const searchInput=$('ccMapSearch');
const mapStatus=$('ccMapStatus');
const stationSelect=$('stationSelect');
const stationMapEl=$('stationMap');
if(!overlay||!searchBar||!searchBtn||!searchInput||!stationSelect||!stationMapEl)return;

const style=document.createElement('style');
style.textContent=`
.cc-nearby-btn{border:0;background:#fff;color:#0b1020;font-weight:900;padding:10px 11px;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(16,24,40,.12);white-space:nowrap}
.cc-nearby-btn.loading{opacity:.65}
.cc-user-dot{filter:drop-shadow(0 2px 4px rgba(15,23,42,.25))}
.cc-cluster-bubble{position:absolute;width:46px;height:46px;margin-left:-23px;margin-top:-23px;border-radius:50%;display:grid;place-items:center;background:#0b78b8;color:#fff;border:4px solid rgba(255,255,255,.96);box-shadow:0 5px 14px rgba(15,23,42,.28);font-size:13px;font-weight:950;cursor:pointer;z-index:650;user-select:none;-webkit-user-select:none}
@media(max-width:640px){.cc-search-bar #ccMapSearchBtn{display:none}.cc-nearby-btn{grid-column:1/-1;width:100%;padding:9px 10px}}
`;
document.head.appendChild(style);

const nearby=document.createElement('button');
nearby.id='ccNearbyBtn';
nearby.type='button';
nearby.className='cc-nearby-btn';
nearby.textContent='📍 Autour de moi';
searchBar.appendChild(nearby);
searchBar.style.gridTemplateColumns='auto 1fr auto auto';

function status(text,type=''){
  if(!mapStatus)return;
  mapStatus.textContent=text;
  mapStatus.className='cc-map-status'+(type?` ${type}`:'');
}
function activateStationMap(){window.CCLazyTiles?.activate?.('station')}
function activateRouteMap(){window.CCLazyTiles?.activate?.('route')}

searchBtn.addEventListener('click',activateStationMap,{capture:true});
$('citySearchBtn')?.addEventListener('click',activateStationMap,{capture:true});
document.querySelector('[data-tab="route"]')?.addEventListener('click',activateRouteMap,{capture:true});
$('planRouteBtn')?.addEventListener('click',activateRouteMap,{capture:true});

let userLayer=null;
async function aroundMe(){
  if(!navigator.geolocation){status('GPS indisponible sur cet appareil.','bad');return}
  nearby.disabled=true;nearby.classList.add('loading');nearby.textContent='📍 Localisation…';
  status('Récupération de ta position…');
  try{
    const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000}));
    const lat=pos.coords.latitude,lon=pos.coords.longitude;
    activateStationMap();
    const map=window.CCLazyTiles?.map?.('station');
    if(map&&window.L){
      map.setView([lat,lon],13);
      if(userLayer)userLayer.remove();
      userLayer=L.circleMarker([lat,lon],{radius:8,weight:3,opacity:1,fillOpacity:.95}).addTo(map).bindTooltip('Ma position');
      userLayer.getElement?.()?.classList?.add('cc-user-dot');
    }
    status('Recherche des bornes autour de toi…');
    const r=await fetch(`https://geo.api.gouv.fr/communes?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&fields=nom,code,codesPostaux,centre&limit=1`,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const j=await r.json();
    if(!j?.[0]?.nom)throw new Error('Commune introuvable');
    searchInput.value=j[0].nom;
    status(`Autour de moi · ${j[0].nom}`,'good');
    searchBtn.click();
  }catch(e){
    status(e?.code===1?'Autorise la localisation pour utiliser « Autour de moi ».':`GPS indisponible : ${e.message||'erreur'}`,'bad');
  }finally{
    nearby.disabled=false;nearby.classList.remove('loading');nearby.textContent='📍 Autour de moi';
  }
}
nearby.onclick=aroundMe;

let clusterTimer=0;
let clusterEls=[];
function clearClusters(){
  clusterEls.forEach(el=>el.remove());clusterEls=[];
  stationMapEl.querySelectorAll('.cc-power-marker[data-cc-cluster-hidden="1"]').forEach(el=>{el.style.display='';delete el.dataset.ccClusterHidden});
}
function markerPoint(el){
  try{return L.DomUtil.getPosition(el)}catch{return null}
}
function cluster(){
  clearClusters();
  const map=window.CCLazyTiles?.map?.('station');
  if(!map||!window.L||map.getZoom()>14)return;
  const icons=[...stationMapEl.querySelectorAll('.cc-power-marker')].filter(el=>el.style.display!=='none');
  if(icons.length<18)return;
  const items=icons.map(el=>({el,p:markerPoint(el)})).filter(x=>x.p&&Number.isFinite(x.p.x)&&Number.isFinite(x.p.y));
  const used=new Set(),groups=[];
  for(let i=0;i<items.length;i++){
    if(used.has(i))continue;
    const g=[i];used.add(i);
    for(let j=i+1;j<items.length;j++){
      if(used.has(j))continue;
      const dx=items[j].p.x-items[i].p.x,dy=items[j].p.y-items[i].p.y;
      if(Math.hypot(dx,dy)<72){g.push(j);used.add(j)}
    }
    if(g.length>=3)groups.push(g);
  }
  const pane=stationMapEl.querySelector('.leaflet-marker-pane');
  if(!pane)return;
  groups.forEach(g=>{
    const xs=g.map(i=>items[i].p.x),ys=g.map(i=>items[i].p.y);
    const x=xs.reduce((a,b)=>a+b,0)/xs.length,y=ys.reduce((a,b)=>a+b,0)/ys.length;
    g.forEach(i=>{items[i].el.style.display='none';items[i].el.dataset.ccClusterHidden='1'});
    const b=document.createElement('button');
    b.type='button';b.className='cc-cluster-bubble';b.textContent=String(g.length);b.title=`${g.length} bornes`;
    pane.appendChild(b);L.DomUtil.setPosition(b,L.point(x,y));clusterEls.push(b);
    b.onclick=e=>{e.preventDefault();e.stopPropagation();const ll=map.layerPointToLatLng(L.point(x,y));map.setView(ll,Math.min(18,map.getZoom()+2))};
  });
}
function scheduleCluster(){clearTimeout(clusterTimer);clusterTimer=setTimeout(cluster,180)}
function bindMapEvents(){
  const map=window.CCLazyTiles?.map?.('station');
  if(!map||map.__ccClusterBound)return false;
  map.__ccClusterBound=true;
  map.on('zoomend moveend',scheduleCluster);
  return true;
}
const wait=setInterval(()=>{if(bindMapEvents())clearInterval(wait)},100);
new MutationObserver(()=>{setTimeout(scheduleCluster,250);setTimeout(scheduleCluster,800)}).observe(stationSelect,{childList:true});
searchBtn.addEventListener('click',()=>{setTimeout(scheduleCluster,700);setTimeout(scheduleCluster,1400)});
stationMapEl.addEventListener('touchend',scheduleCluster,{passive:true});
stationMapEl.addEventListener('mouseup',scheduleCluster,{passive:true});
window.addEventListener('pageshow',()=>{bindMapEvents();scheduleCluster()});
})();
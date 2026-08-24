(()=>{
"use strict";
if(!window.L)return;

const originalMap=L.map.bind(L);
const originalTileLayer=L.tileLayer.bind(L);
const maps={station:null,route:null};
const layers={station:[],route:[]};
let tileIndex=0;

L.map=function(id,opts){
  const map=originalMap(id,opts);
  const key=String(id)==="stationMap"?"station":String(id)==="routeMap"?"route":null;
  if(key)maps[key]=map;
  return map;
};

L.tileLayer=function(url,opts){
  const layer=originalTileLayer(url,opts);
  const key=tileIndex++===0?"station":"route";
  const originalAddTo=layer.addTo.bind(layer);
  const rec={layer,map:null,active:false};
  rec.activate=()=>{
    if(rec.active)return;
    rec.active=true;
    if(rec.map)originalAddTo(rec.map);
  };
  layer.addTo=function(map){
    rec.map=map;
    if(rec.active)originalAddTo(map);
    return layer;
  };
  layers[key].push(rec);
  return layer;
};

window.CCLazyTiles={
  activate(key){
    (layers[key]||[]).forEach(x=>x.activate());
    setTimeout(()=>maps[key]?.invalidateSize?.(),20);
  },
  map(key){return maps[key]||null},
  active(key){return (layers[key]||[]).some(x=>x.active)}
};
})();
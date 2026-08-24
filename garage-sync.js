(()=>{
"use strict";
const STORE_KEY="chargecompare-v11";
const LABEL_KEY="chargecompare-garage-profile";
const $=id=>document.getElementById(id);
const num=id=>{const v=Number(String($(id)?.value||"").replace(",","."));return Number.isFinite(v)?v:0};
function readState(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")||{}}catch{return {}}}
function readProfile(){try{return JSON.parse(localStorage.getItem(LABEL_KEY)||"null")}catch{return null}}
function patchUI(){
  const state=readState(),p=readProfile();
  const routeSel=$("vehicleSelect"),garageSel=$("garageVehicleSelect"),summary=$("vehicleSummary");
  if(routeSel){routeSel.disabled=true;routeSel.title="Le véhicule du parcours se règle dans Garage"}
  if(!p||state.vehicleId!=="custom")return;
  [routeSel,garageSel].forEach(sel=>{
    if(!sel)return;
    const opt=[...sel.options].find(o=>o.value==="custom");
    if(opt)opt.textContent=`${p.name} (Garage)`;
    sel.value="custom";
  });
  if(summary)summary.innerHTML=`<b>${p.name}</b> <span class="miniBadge real">GARAGE</span><br>${p.battery} kWh utiles · ${p.consumption} kWh/100 km · DC max ${p.dc} kW · AC ${p.ac} kW<br><span class="note">✓ Ces paramètres seront utilisés automatiquement dans Parcours</span>`;
}
const saveBtn=$("saveVehicleBtn");
if(saveBtn){
  const original=saveBtn.onclick;
  saveBtn.onclick=function(e){
    const sel=$("garageVehicleSelect");
    const originalId=sel?.value||"custom";
    const originalName=sel?.selectedOptions?.[0]?.textContent?.replace(/ \(Garage\)$/,'')||"Mon véhicule";
    const profile={id:originalId,name:originalName,battery:num("customBattery"),consumption:num("customConsumption"),dc:num("customDc"),ac:num("customAc")};
    localStorage.setItem(LABEL_KEY,JSON.stringify(profile));
    if(sel)sel.value="custom";
    if(typeof original==="function")original.call(this,e);
    patchUI();
    this.textContent="✓ Enregistré dans Garage et Parcours";
    setTimeout(()=>this.textContent="Enregistrer",1400);
  };
}
const routeTab=document.querySelector('[data-tab="route"]');
if(routeTab)routeTab.addEventListener("click",()=>setTimeout(patchUI,0));
const garageTab=document.querySelector('[data-tab="garage"]');
if(garageTab)garageTab.addEventListener("click",()=>setTimeout(patchUI,0));
patchUI();
window.addEventListener("load",patchUI);
})();
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const select=$('stationSelect'), power=$('stationPowerFilter');
if(!select||!power)return;
const style=document.createElement('style');style.textContent=`.cc-smart{display:flex;gap:7px;overflow:auto;padding:8px 0 2px}.cc-smart button{white-space:nowrap;border:1px solid rgba(127,127,127,.25);background:var(--card,#fff);color:inherit;padding:9px 11px;border-radius:12px;font-weight:800}.cc-smart button.active{outline:2px solid #0b78b8}.cc-best{margin:10px 0;padding:12px;border-radius:14px;background:rgba(11,120,184,.10);font-size:14px}.cc-best b{display:block;font-size:16px;margin-bottom:3px}`;document.head.appendChild(style);
const host=power.closest('.splitTop')||power.parentElement;
const bar=document.createElement('div');bar.className='cc-smart';bar.innerHTML='<button data-smart="best" class="active">✨ Meilleur choix</button><button data-smart="fast">⚡ Plus rapide</button><button data-smart="cheap">💶 Moins chère</button><button data-smart="available">🟢 Disponible</button>';
host.parentElement.insertBefore(bar,host.nextSibling);
const best=document.createElement('div');best.className='cc-best';best.innerHTML='<b>✨ Meilleure borne</b><span>Lance une recherche pour obtenir la recommandation.</span>';bar.after(best);
let mode='best';
function text(o){return (o?.textContent||'').trim()}
function kw(o){const m=text(o).match(/(\d+(?:[.,]\d+)?)\s*kW/i);return m?+m[1].replace(',','.'):0}
function price(o){const m=text(o).match(/(\d+[.,]\d+)\s*€|€\s*(\d+[.,]\d+)/);return m?+(m[1]||m[2]).replace(',','.') : 99}
function avail(o){return /libre|disponible|available|\b[1-9]\s*\/\s*\d/i.test(text(o))?1:/occup|hors service|indisponible/i.test(text(o))?-1:0}
function rank(){const opts=[...select.options].filter(o=>o.value);if(!opts.length)return;const min=+power.value||0;let rows=opts.filter(o=>kw(o)>=min||!kw(o));rows.sort((a,b)=>{if(mode==='fast')return kw(b)-kw(a);if(mode==='cheap')return price(a)-price(b);if(mode==='available')return avail(b)-avail(a)||kw(b)-kw(a);return (avail(b)*100+kw(b)-price(b)*20)-(avail(a)*100+kw(a)-price(a)*20)});const top=rows[0];if(top){best.innerHTML=`<b>✨ ${mode==='fast'?'Plus rapide':mode==='cheap'?'Moins chère':mode==='available'?'Disponible':'Meilleur choix'}</b><span>${text(top)}</span>`;best.onclick=()=>{select.value=top.value;select.dispatchEvent(new Event('change',{bubbles:true}));best.scrollIntoView({behavior:'smooth',block:'center'})}}}
bar.onclick=e=>{const b=e.target.closest('[data-smart]');if(!b)return;mode=b.dataset.smart;bar.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));rank()};
power.addEventListener('change',rank);new MutationObserver(()=>setTimeout(rank,80)).observe(select,{childList:true});setTimeout(rank,500);
})();
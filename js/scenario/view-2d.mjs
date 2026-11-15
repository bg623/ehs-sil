import {worldToScreen} from './coordinates.mjs';
export const escape=x=>String(x??'待确认').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="事故机制定性示意，无工程测量比例"><rect width="640" height="360" fill="#edf2ef"/><path d="M32 292H608" stroke="#c5d1cc"/><text x="584" y="38" fill="#46534f">北 ↑</text>${body}<text x="26" y="338" font-size="14" fill="#46534f">机制示意 · 非工程比例 · 未评估后果距离</text></svg>`;
export function sceneSvg(result,stage=0){
  const id=result?.visualization.sceneId||'pool-fire';
  const tank='<rect x="72" y="90" width="115" height="170" rx="18" fill="#8daaa0" stroke="#0d473f" stroke-width="3"/><ellipse cx="129" cy="90" rx="57" ry="18" fill="#c5d1cc" stroke="#0d473f" stroke-width="3"/><path d="M187 235H285" stroke="#68746f" stroke-width="12"/>';
  let body=tank;
  if(id==='pool-fire')body+=`${stage>=1?'<path d="M285 235L320 264" stroke="#2f6280" stroke-width="8"/>':''}${stage>=2?'<ellipse cx="360" cy="273" rx="110" ry="18" fill="#2f6280" opacity=".65"/>':''}${stage>=3?'<path d="M290 264Q260 220 330 152Q310 209 360 104Q421 187 400 208Q460 204 425 264Z" fill="#d7a23a"/><path d="M324 264Q310 228 360 183Q412 235 392 264Z" fill="#fbf1dc"/>':''}<rect x="245" y="280" width="230" height="9" fill="#0d473f"/>`;
  if(id==='jet-fire')body+='<path d="M285 235Q400 155 545 210L300 245Z" fill="#d7a23a"/><text x="345" y="132">有压喷放 → 定向火焰</text>';
  if(id==='flash-fire')body+='<ellipse cx="410" cy="244" rx="155" ry="35" fill="#d7a23a" opacity=".5"/><path d="M320 249L350 205L370 246L400 200L425 248L455 206L480 246" fill="none" stroke="#805810" stroke-width="5"/><text x="285" y="150">云团内火焰传播；不默认超压</text>';
  if(id==='vce')body+='<ellipse cx="410" cy="228" rx="150" ry="60" fill="#d7a23a" opacity=".3"/><path d="M330 270V180H355V270M390 270V170H415V270M450 270V185H475V270" fill="none" stroke="#68746f" stroke-width="12"/><text x="280" y="130">云团 + 点火 + 火焰加速条件</text>';
  if(id==='bleve')body+='<path d="M95 75L60 35M175 80L220 35M185 180L260 155" stroke="#805810" stroke-width="6"/><circle cx="400" cy="160" r="65" fill="#d7a23a" opacity=".55"/><text x="270" y="280">快速降压与碎片；可燃介质或有火球</text>';
  if(id==='toxic')body+='<path d="M285 235Q340 140 575 120L575 275Q350 290 285 245" fill="#2f6280" opacity=".3"/><text x="300" y="100">空气迁移 → 浓度 × 暴露时间</text><text x="335" y="310" font-size="13">着色仅用于辨识示意区域</text>';
  for(const r of result?.visualization.receptors||[]){const[x,y]=worldToScreen(r,2);body+=`<circle cx="${x}" cy="${y}" r="5" fill="#0d473f"/><text x="${x+8}" y="${y}">${escape(r.id)} · 高度 ${escape(r.z)} m（记录）</text>`;}
  return svg(body);
}
export function render2d(host,result,stage){host.innerHTML=sceneSvg(result,stage);}

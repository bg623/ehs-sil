import {APP_VERSION,SCHEMA_VERSION,CONDITION_LABELS} from './schema.mjs';
import {compare} from './engine.mjs';
import {escape,sceneSvg} from './view-2d.mjs';
export function currentResult(p,r){return r&&r.inputRevision===p.inputRevision&&r.status!=='stale'?r:null;}
export function safeCell(x){const s=String(x??'待确认');return '"'+(/^[\s]*[=+\-@]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';}
export function rows(p,r){
  r=currentResult(p,r);const list=[['类型','字段','值','单位 / 状态'],['版本','应用',APP_VERSION,'教学试用'],['版本','项目结构',SCHEMA_VERSION,''],['结果','当前状态',r?'仅教学演示':'待重算 / 未检查',''],['结果','输入修订号',p.inputRevision,''],['结果','输入哈希',r?.inputHash??'待重算','复现关联'],['场景','标题',p.meta.title,''],['场景','物质',p.inputs.material.name,'仅记录'],['场景','组分',p.inputs.material.composition,'仅记录'],['场景','物态',p.inputs.material.state,'仅记录'],['输入','库存',p.inputs.storage.inventoryKg,'kg'],['输入','指定释放质量',p.inputs.scenario.releaseKg,'kg'],['输入','绝对压力',p.inputs.storage.pressurePa,'Pa'],['输入','温度',p.inputs.material.temperatureK,'K'],['输入','固定池面积',p.inputs.pool.areaM2,'m²'],['输入','固定池直径',p.inputs.pool.diameterM,'m'],['说明','设备',p.inputs.storage.equipment,''],['说明','设备说明',p.inputs.storage.note,''],['说明','液池几何来源',p.inputs.pool.geometrySource,''],['说明','地面',p.inputs.pool.ground,''],['说明','资料来源',p.evidenceNotes,'']];
  const terms={unknown:'待确认 / unknown',yes:'条件存在 / yes',no:'当前不满足 / no',pure:'单一纯物质 / pure',mixture:'混合物 / mixture',liquid:'液体 / liquid',gas:'气体 / gas',solid:'固体 / solid'};
  for(const row of list)if(terms[row[2]])row[2]=terms[row[2]];
  for(const[k,v]of Object.entries(p.inputs.scenario.conditions))list.push(['条件',`${CONDITION_LABELS[k]} / ${k}`,terms[v]||v,'用户记录']);
  list.push(['物质','CAS',p.inputs.material.cas,'仅记录']);
  for(const c of p.controls){list.push(['措施',c.type,`${c.boundary}；${c.evidence}`,'仅记录 / recorded_only']);list.push(['措施作用对象',c.type,c.target,'仅记录']);list.push(['动作时间',c.type,c.actionTimeS,'s；未计入数值']);}
  for(const r of p.inputs.receptors)list.push(['目标点',r.id,`东 x=${r.x}；北 y=${r.y}；上 z=${r.z}`,'m；仅记录']);
  for(const a of p.assumptions)list.push(['假设',a.text,a.source,a.confirmed?'用户已确认':'待确认']);
  for(const [k,v]of Object.entries(r?.outputs||{all:{unit:'',reasonCode:'RECALCULATION_REQUIRED'}}))list.push(['未评估',k,v.reasonCode,v.unit]);
  for(const d of compare(p.comparison,p).differences)list.push(['A/B 差异',d.field,`${d.a} → ${d.b}`,'教学比较']);
  return list;
}
export const csv=(p,r)=>'\uFEFF'+rows(p,r).map(row=>row.map(safeCell).join(',')).join('\r\n');
export function report(p,r){const valid=currentResult(p,r);return `<header><p>EHS-SIL · V${APP_VERSION} 教学试用版</p><h1>事故场景与后果模拟底稿</h1><h2>${escape(p.meta.title)}</h2><p>${valid?'仅教学演示':'待重算：本报告仅包含当前输入记录'} · ${escape(new Date().toISOString())}</p></header>${sceneSvg(valid,3)}<table><thead><tr><th>类型</th><th>字段</th><th>值</th><th>单位 / 状态</th></tr></thead><tbody>${rows(p,valid).slice(1).map(row=>'<tr>'+row.map(c=>`<td>${escape(c)}</td>`).join('')+'</tr>').join('')}</tbody></table><h2>范围与未评估项</h2><p>热辐射、超压、浓度、持续时间、事故频率、个人风险与 F–N 均未评估。示意无工程比例；演示进度不是真实事故时间。措施仅记录，未计入工程数值。</p><h2>版本与来源</h2><p>模型 pool-fire-teaching ${APP_VERSION}；资料 scenario-data-0.1.0。NOAA / EPA ALOHA Technical Documentation (2013)：进一步学习资料，未复制完整求解器。https://response.restoration.noaa.gov/sites/default/files/ALOHA_Tech_Doc.pdf</p><p>缺少：审核后的物性、对应物理验证、近场适用边界与本实现技术评审。报告不构成工程审查、批准或合规结论。</p>`;}
export function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=`EHS-SIL_scenario_${new Date().toISOString().slice(0,10)}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}

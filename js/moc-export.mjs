import {STATUS_LABELS,GATE_LABELS,ITEM_STATUS_LABELS} from './moc-engine.mjs';

/** Every field is quoted; leading invisible/control characters cannot hide a formula. */
export function safeCSVCell(value) {
  let string=String(value??'');
  if (/^[\s\u0000-\u0020\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]*[=+\-@]/u.test(string)) string=`'${string}`;
  return `"${string.replaceAll('"','""')}"`;
}
const csv=rows=>'\uFEFF'+rows.map(row=>row.map(safeCSVCell).join(',')).join('\r\n')+'\r\n';
export function exportJSON(record) {return JSON.stringify(record,null,2);}
export function exportActionsCSV(record) {
  const rows=[['MOC 编号','版本','行动编号','行动／风险措施','关联风险','门禁','安全关键','责任人','期限','证据要求','状态','完成证据','投用后书面依据','投用后批准人','投用后批准日期']];
  for(const risk of record.riskItems)rows.push([record.meta.id,record.meta.version,risk.id,risk.additionalMeasures,risk.scenario,GATE_LABELS[risk.gate],risk.safetyCritical?'是':'否',risk.owner,risk.due,'风险控制完成及验证依据',ITEM_STATUS_LABELS[risk.status],risk.evidence,'','','']);
  for(const action of record.actions)rows.push([record.meta.id,record.meta.version,action.id,action.title,action.riskId,GATE_LABELS[action.gate],action.safetyCritical?'是':'否',action.owner,action.due,action.evidenceRequirement,ITEM_STATUS_LABELS[action.status],action.evidence,action.postStartupBasis,action.postStartupApprovedBy,action.postStartupApprovedAt]);
  return csv(rows);
}
export function exportLedgerCSV(record,evaluation) {
  return csv([['MOC 编号','名称','版本','状态','区域','申请人','负责人','专业类别','建议级别','确认级别','期限类别','到期日','同类替换结论','PSSR 判定','投用授权人','审批阻断数','投用阻断数','关闭阻断数','更新时间','提示'],[record.meta.id,record.meta.title,record.meta.version,STATUS_LABELS[record.meta.status],record.changeSummary.area,record.changeSummary.applicant,record.changeSummary.owner,record.classification.categories.join('、'),evaluation?.level?.label||'',({general:'一般',important:'重要',needs_review:'需人工判断'})[record.classification.confirmedLevel]||'',record.screening.durationType==='temporary'?'临时':'永久',record.screening.temporaryExpiry,evaluation?.replacement?.label||'',record.pssr.required===true?'需要':record.pssr.required===false?'不需要':'待确认',record.implementation.startupAuthorizedBy,evaluation?.approvalBlockers?.length??'',evaluation?.startupBlockers?.length??'',evaluation?.closeBlockers?.length??'',record.meta.updatedAt,'仅为本地辅助草案；批准表示录入线下结果，不是电子签章。']]);
}
export function exportFilename(record,extension='json',now) {
  const clean=value=>String(value??'').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').replace(/[. ]+$/g,'').trim();
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now??Date.now()));
  const date=['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');
  const suffix=/^(json|csv|pdf|html)$/.test(extension)?extension:'json';
  return `MOC_${clean(record.meta.id).slice(0,80)||'记录'}_${clean(record.meta.title).slice(0,28)||'未命名'}_v${Number(record.meta.version)||1}_${date}.${suffix}`;
}

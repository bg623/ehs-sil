import {createRecord,createItem,refreshExpiry,SCHEMA_VERSION,STATUS_LABELS,GATE_LABELS} from './moc-engine.mjs';

export const STORAGE_KEY='ehs-sil-moc-record-v1';
export const MAX_IMPORT_BYTES=1024*1024;
const clone=value=>JSON.parse(JSON.stringify(value));
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const bytes=value=>new TextEncoder().encode(value).length;
const fail=message=>{throw new Error(`无法读取 MOC 记录：${message}`);};
const enumValue=(value,allowed,label)=>{if(!allowed.includes(value))fail(`${label}选项无效。`);};
const requireObject=(value,label)=>{if(!isObject(value))fail(`${label}必须是对象。`);};
const requireArray=(value,label,max=1000)=>{if(!Array.isArray(value)||value.length>max)fail(`${label}必须是有效列表且不能超过 ${max} 项。`);};
const stringValue=(value,label,max=6000)=>{if(typeof value!=='string'||value.length>max)fail(`${label}必须是最多 ${max} 字的文本。`);};
const integer=(value,label,min=0,max=100000)=>{if(!Number.isInteger(value)||value<min||value>max)fail(`${label}数值无效。`);};
const boolean=(value,label)=>{if(typeof value!=='boolean')fail(`${label}必须为是／否。`);};
const dateValue=(value,label)=>{stringValue(value,label);if(value&&!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value))fail(`${label}日期格式无效。`);if(value&&!Number.isFinite(Date.parse(value)))fail(`${label}日期无效。`);if(/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)!==value)fail(`${label}日期无效。`);};
function deepSafety(value,depth=0) {
  if(depth>12)fail('嵌套层数过多。');
  if(typeof value==='string'&&value.length>6000)fail('单个文本字段不能超过 6000 字。');
  if(typeof value==='number'&&!Number.isFinite(value))fail('存在无效数值。');
  if(value===undefined||typeof value==='function')fail('包含不支持的数据类型。');
  if(value&&typeof value==='object')for(const key of Object.keys(value)) {
    if(['__proto__','prototype','constructor'].includes(key))fail('包含不允许的属性。');
    deepSafety(value[key],depth+1);
  }
}
function exactKeys(value,template,label) {
  requireObject(value,label);
  for(const key of Object.keys(value))if(!Object.hasOwn(template,key))fail(`${label}含未知字段。`);
  for(const key of Object.keys(template))if(!Object.hasOwn(value,key))fail(`${label}缺少必需字段。`);
}
function fieldShape(value,template,label) {
  exactKeys(value,template,label);
  for(const [key,expected] of Object.entries(template)) {
    const actual=value[key],name=`${label}.${key}`;
    if(typeof expected==='string')stringValue(actual,name);
    else if(typeof expected==='boolean')boolean(actual,name);
    else if(typeof expected==='number')integer(actual,name);
    else if(Array.isArray(expected))requireArray(actual,name,key==='auditTrail'?5000:1000);
    else if(isObject(expected))fieldShape(actual,expected,name);
  }
}
function checkUnique(rows,label) {
  const ids=rows.map(row=>row.id);
  if(ids.some(id=>typeof id!=='string'||!id.trim()||id.length>128)||new Set(ids).size!==ids.length)fail(`${label}条目编号缺失或重复。`);
}
function checkDateFields(object,keys,label) {for(const key of keys)dateValue(object[key],`${label}.${key}`);}
function rating(value,label) {if(value!==''&&(!['number','string'].includes(typeof value)||!Number.isInteger(Number(value))||Number(value)<1||Number(value)>5))fail(`${label}必须为空或 1–5 的整数。`);}

export function validateRecord(record,config) {
  requireObject(record,'记录');deepSafety(record);
  if(record.schemaVersion!==SCHEMA_VERSION)fail('不支持此 schemaVersion，请使用当前版本导出的备份。');
  const defaults=createRecord(config,'2026-01-01T00:00:00.000Z');
  exactKeys(record,defaults,'记录');
  for(const key of ['meta','changeSummary','screening','classification','pssr','implementation','verification'])fieldShape(record[key],defaults[key],key);
  integer(record.meta.version,'版本',1);integer(record.meta.approvedVersion,'批准版本');
  enumValue(record.meta.status,Object.keys(STATUS_LABELS),'记录状态');
  stringValue(record.meta.id,'MOC 编号',128);if(!record.meta.id.trim())fail('MOC 编号不能为空。');
  checkDateFields(record.meta,['createdAt','updatedAt'],'meta');
  checkDateFields(record.changeSummary,['plannedStart'],'changeSummary');
  const screen=record.screening;
  enumValue(screen.durationType,['permanent','temporary'],'期限类别');
  enumValue(screen.determination,['needs_review','moc','possible_replacement'],'替换判断');
  checkDateFields(screen,['replacementConfirmedAt','temporaryExpiry','emergencyAuthorizationAt','formalizedAt','expiredAt'],'screening');
  checkDateFields(screen.expiryReview,['date','newExpiry'],'expiryReview');
  requireArray(screen.replacementComparisons,'等同性对比');checkUnique(screen.replacementComparisons,'等同性对比');
  const compIds=config.categories.replacementComparisons.map(item=>item.id);
  if(screen.replacementComparisons.length!==compIds.length)fail('等同性对比项目不完整。');
  for(const item of screen.replacementComparisons){fieldShape(item,{id:'',label:'',result:'',evidence:''},'等同性对比');enumValue(item.id,compIds,'对比项目');enumValue(item.result,['same','changed','unknown','na'],'对比结论');}
  const classification=record.classification;
  for(const key of ['categories','triggers','suggestedMethods'])requireArray(classification[key],key);
  for(const item of classification.categories)enumValue(item,config.categories.items.map(row=>row.id),'专业类别');
  for(const item of classification.triggers)enumValue(item,config.criticalTriggers.items.map(row=>row.id),'关键触发器');
  for(const item of classification.suggestedMethods)enumValue(item,config.methodRouting.items.map(row=>row.id),'分析方法');
  enumValue(classification.scope,['',...config.categories.scopes.map(row=>row.id)],'影响范围');
  enumValue(classification.suggestedLevel,['general','important','needs_review'],'建议等级');
  enumValue(classification.confirmedLevel,['','general','important','needs_review'],'确认等级');
  requireArray(record.impactDomains,'影响筛查');checkUnique(record.impactDomains,'影响筛查');
  if(record.impactDomains.length!==config.impactPrompts.items.length)fail('影响筛查域不完整。');
  for(const item of record.impactDomains){fieldShape(item,{id:'',label:'',status:'',explanation:''},'影响筛查');enumValue(item.id,config.impactPrompts.items.map(row=>row.id),'影响域');enumValue(item.status,['none','affected','unknown'],'影响状态');}
  for(const [key,type] of Object.entries({riskItems:'risk',actions:'action',documents:'document',training:'training',approvals:'approval',stakeholders:'stakeholder'})) {
    requireArray(record[key],key);checkUnique(record[key],key);
    for(const item of record[key]) {
      const template=createItem(type);
      if(type==='risk') {
        // Scores intentionally allow the empty placeholder or a numeric 1–5 value.
        const rest={...item,initialLikelihood:'',residualLikelihood:'',residualSeverity:'',initialSeverity:{people:'',environment:'',asset:'',reputation:''}};
        fieldShape(rest,template,key);
        requireObject(item.initialSeverity,'初始严重度');exactKeys(item.initialSeverity,template.initialSeverity,'初始严重度');
        rating(item.initialLikelihood,'初始可能性');rating(item.residualLikelihood,'残余可能性');rating(item.residualSeverity,'残余严重度');
        Object.values(item.initialSeverity).forEach(value=>rating(value,'初始严重度'));
        enumValue(item.hierarchy,['elimination','substitution','engineering','administrative','ppe'],'措施层级');
      } else fieldShape(item,template,key);
      if(['risk','action','document','training'].includes(type))enumValue(item.status,['open','in_progress','done'],'完成状态');
      if(['risk','action'].includes(type)){enumValue(item.gate,Object.keys(GATE_LABELS),'行动门禁');dateValue(item.due,'行动期限');}
      if(type==='action')checkDateFields(item,['postStartupApprovedAt'],'行动批准');
      if(type==='document')dateValue(item.due,'文件期限');
      if(type==='training')dateValue(item.date,'培训日期');
      if(type==='approval'){enumValue(item.conclusion,['pending','approved','rejected'],'审批结论');dateValue(item.date,'审批日期');integer(item.version,'审批绑定版本',1);}
    }
  }
  enumValue(record.pssr.required,[true,false,null],'PSSR 适用性');
  enumValue(record.pssr.status,['not_started','in_progress','passed','not_required'],'PSSR 状态');
  checkDateFields(record.pssr,['confirmedAt','passedAt'],'PSSR');
  checkDateFields(record.implementation,['actualStart','actualEnd','startupAuthorizedAt'],'实施');
  for(const key of ['scopeMatches','effectsAchieved','newRisks'])enumValue(record.verification[key],['yes','no','unknown'],'验证结论');
  enumValue(record.verification.temporaryOutcome,['','restored','permanent','new_review'],'临时变更处置');
  dateValue(record.verification.verifiedAt,'验证日期');
  requireArray(record.auditTrail,'审计轨迹',5000);
  for(const item of record.auditTrail){fieldShape(item,{at:'',action:'',actor:'',note:'',version:1},'审计轨迹');dateValue(item.at,'审计时间');integer(item.version,'审计版本',1);}
  if(bytes(JSON.stringify(record))>MAX_IMPORT_BYTES)fail('记录超过 1 MB，请减少内容或拆分关联记录。');
  return true;
}

function mergeKnown(template,input) {
  if(!isObject(input))return clone(template);
  const output=clone(template);
  for(const key of Object.keys(template))if(Object.hasOwn(input,key)) {
    output[key]=isObject(template[key])&&isObject(input[key])?mergeKnown(template[key],input[key]):clone(input[key]);
  }
  return output;
}
export function migrateRecord(record,config,now) {
  requireObject(record,'记录');deepSafety(record);
  if(record.schemaVersion===SCHEMA_VERSION){validateRecord(record,config);return clone(record);}
  if(record.schemaVersion!==undefined&&record.schemaVersion!==0)fail('版本不受支持，原记录未被覆盖。');
  if(!isObject(record.meta)||!isObject(record.changeSummary)||typeof record.meta.id!=='string')fail('不是可识别的旧版 MOC 记录。');
  const defaults=createRecord(config,now), migrated=mergeKnown(defaults,record);
  migrated.schemaVersion=SCHEMA_VERSION;
  for(const key of ['replacementComparisons'])migrated.screening[key]=defaults.screening[key].map(item=>({...item,...(record.screening?.[key]?.find(row=>row.id===item.id)||{})}));
  migrated.impactDomains=defaults.impactDomains.map(item=>({...item,...(record.impactDomains?.find(row=>row.id===item.id)||{})}));
  for(const [key,type] of Object.entries({riskItems:'risk',actions:'action',documents:'document',training:'training',approvals:'approval',stakeholders:'stakeholder'}))if(Array.isArray(record[key]))migrated[key]=record[key].map(item=>mergeKnown(createItem(type),item));
  // A legacy schema never establishes current approval authority.
  migrated.meta.status='draft';migrated.meta.approvedVersion=0;
  for(const item of migrated.approvals)item.conclusion='pending';
  migrated.implementation.startupAuthorizedBy='';migrated.implementation.startupAuthorizedAt='';migrated.implementation.startupAuthorizationEvidence='';
  migrated.auditTrail.push({at:new Date(now??Date.now()).toISOString(),action:'schema_migrated',actor:'本机规则',note:'旧版数据已补齐当前字段；保留原输入，审批状态需重新确认。',version:migrated.meta.version});
  validateRecord(migrated,config);return migrated;
}

export function importRecord(raw,config,now) {
  if(typeof raw!=='string'||bytes(raw)>MAX_IMPORT_BYTES)fail('备份必须是小于 1 MB 的 JSON 文本，当前记录未被覆盖。');
  let parsed;try{parsed=JSON.parse(raw);}catch{fail('JSON 格式错误，当前记录未被覆盖。');}
  const record=migrateRecord(parsed,config,now);
  record.meta.status='draft';record.meta.approvedVersion=0;
  record.meta.updatedAt=new Date(now??Date.now()).toISOString();
  record.auditTrail.push({at:record.meta.updatedAt,action:'imported',actor:'本机记录人',note:'导入外部备份；保留历史输入，当前批准、PSSR 通过及投用授权须重新确认。',version:record.meta.version});
  for(const item of record.approvals)item.conclusion='pending';
  record.pssr.status=record.pssr.required===false?'not_required':'not_started';record.pssr.passedBy='';record.pssr.passedAt='';
  record.implementation.startupAuthorizedBy='';record.implementation.startupAuthorizedAt='';record.implementation.startupAuthorizationEvidence='';
  // Expiry is not bypassed by importing an older high-state backup.
  const refreshed=refreshExpiry(record,config,now);validateRecord(refreshed,config);return refreshed;
}

function storageFailure(error,operation) {
  const quota=error?.name==='QuotaExceededError'||error?.code===22;
  return {ok:false,error:quota?'本地空间不足，自动保存未完成；请立即导出 JSON 备份，再清理浏览器空间后重试。':`无法${operation}当前浏览器的本地记录；请检查隐私／存储权限，或先导出 JSON 备份。`};
}
function activeStorage(storage){return storage===undefined?globalThis.localStorage:storage;}
export function saveRecord(record,storage) {
  try{const serialized=JSON.stringify(record);if(bytes(serialized)>MAX_IMPORT_BYTES)return{ok:false,error:'记录超过 1 MB，本次未保存；请立即导出备份并减少内容。'};activeStorage(storage).setItem(STORAGE_KEY,serialized);return{ok:true};}
  catch(error){return storageFailure(error,'保存');}
}
export function loadRecord(config,storage,now) {
  try{
    const raw=activeStorage(storage).getItem(STORAGE_KEY);
    if(raw===null||raw===undefined)return{ok:true,record:null,warnings:[]};
    if(typeof raw!=='string'||bytes(raw)>MAX_IMPORT_BYTES)return{ok:false,record:null,warnings:[],error:'已保存记录大小异常，未覆盖原数据；请导出或恢复有效 JSON 备份。'};
    let parsed;try{parsed=JSON.parse(raw);}catch{return{ok:false,record:null,warnings:[],error:'本地记录无法解析，原数据保留；请恢复有效 JSON 备份，或确认后清除。'};}
    const migrated=parsed.schemaVersion!==SCHEMA_VERSION;
    const record=refreshExpiry(migrateRecord(parsed,config,now),config,now);
    return{ok:true,record,warnings:migrated?['旧版记录已迁移，原输入保留；线下批准与新增必填内容需要重新确认。']:[]};
  }catch(error){return{...storageFailure(error,'读取'),record:null,warnings:[],error:error?.message?.startsWith('无法读取 MOC')?`${error.message} 原数据已保留，请恢复有效备份。`:storageFailure(error,'读取').error};}
}
export function clearRecord(storage) {try{activeStorage(storage).removeItem(STORAGE_KEY);return{ok:true};}catch(error){return storageFailure(error,'清除');}}

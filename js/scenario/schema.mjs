export const APP_VERSION='0.1.0', DATA_VERSION='scenario-data-0.1.0', SCHEMA_VERSION='1.0.0';
export const CONDITION_LABELS={liquid:'液态释放',flammable:'可燃介质',pool:'形成液池',ignition:'点火条件',pressurized:'有压持续喷放',release:'释放路径存在',cloud:'可燃云团形成',congestion:'拥塞 / 受限与火焰加速条件',superheated:'过热液体状态',vesselFailure:'容器失效与快速降压',toxic:'有毒介质',airborne:'物料进入空气'};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function newProject(example=false){
  return {meta:{id:crypto.randomUUID(),title:example?'池火教学示例':'我的场景记录',schemaVersion:SCHEMA_VERSION,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
    inputRevision:1,inputs:{material:{id:example?'teaching-a':null,name:example?'教学液体 A':'',cas:null,composition:'unknown',state:example?'liquid':'unknown',temperatureK:null},storage:{equipment:'储罐',inventoryKg:null,pressurePa:null,note:''},scenario:{id:'pool-fire',releaseKg:null,ignition:'unknown',conditions:Object.fromEntries(Object.keys(CONDITION_LABELS).map(k=>[k,example&&['liquid','flammable','pool','ignition'].includes(k)?'yes':'unknown']))},pool:{areaM2:null,diameterM:null,geometrySource:'',ground:''},receptors:[]},controls:[],assumptions:[],evidenceNotes:'',comparison:null,ui:{view:'2d',stage:0}};
}
export function validateInputs(p){
  const errors=[]; const ranges=[['inventoryKg',p.inputs.storage.inventoryKg,0,1e12],['pressurePa',p.inputs.storage.pressurePa,0,1e10],['temperatureK',p.inputs.material.temperatureK,0,2000],['releaseKg',p.inputs.scenario.releaseKg,0,1e12],['areaM2',p.inputs.pool.areaM2,0,1e8],['diameterM',p.inputs.pool.diameterM,0,1e5]];
  for(const [field,n,min,max] of ranges) if(n!==null && (typeof n!=='number'||!Number.isFinite(n)||n<=min||n>max)) errors.push({field,message:'请填写范围内的正数，或留空表示待确认。'});
  if(p.inputs.scenario.releaseKg!==null&&p.inputs.storage.inventoryKg!==null&&p.inputs.scenario.releaseKg>p.inputs.storage.inventoryKg) errors.push({field:'releaseKg',message:'指定释放质量不能超过本记录的可用库存。'});
  return errors;
}
export const kgFromTonnes=n=>n===null?null:n*1000;
export const paFromKpa=n=>n===null?null:n*1000;
export const kelvinFromC=n=>n===null?null:n+273.15;
const forbidden=new Set(['__proto__','constructor','prototype']);
function inspect(x,depth=0){
  if(depth>20)throw Error('对象层级超过 20 层');
  if(typeof x==='number'&&!Number.isFinite(x))throw Error('包含非有限数字');
  if(typeof x==='string'&&x.length>6000)throw Error('文字超过 6000 字符');
  if(Array.isArray(x)&&x.length>100)throw Error('列表超过 100 项');
  if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(forbidden.has(k))throw Error('不允许的对象键');inspect(v,depth+1);}
}
function shape(value,template,path='project'){
  if(value===null){if(template!==null)throw Error(`${path} 不能为空`);return;}
  if(template===null)return;
  if(Array.isArray(template)){if(!Array.isArray(value))throw Error(`${path} 应为数组`);return;}
  if(typeof template==='object'){
    if(typeof value!=='object'||Array.isArray(value))throw Error(`${path} 格式错误`);
    for(const k of Object.keys(value))if(!(k in template))throw Error(`${path}.${k} 不是支持字段`);
    for(const k of Object.keys(template)){if(!(k in value))throw Error(`${path}.${k} 缺失`);shape(value[k],template[k],`${path}.${k}`);}
  }else if(typeof value!==typeof template)throw Error(`${path} 类型错误`);
}
function validateRecord(p,allowComparison=true){
  shape(p,newProject());
  if(p.meta.schemaVersion!==SCHEMA_VERSION)throw Error('项目结构版本不支持');
  if(!Number.isInteger(p.inputRevision)||p.inputRevision<1)throw Error('修订号无效');
  for(const v of Object.values(p.inputs.scenario.conditions))if(!['yes','no','unknown'].includes(v))throw Error('条件状态无效');
  if(!['pure','mixture','unknown'].includes(p.inputs.material.composition)||!['liquid','gas','solid','unknown'].includes(p.inputs.material.state))throw Error('物态或组分无效');
  if(!['pool-fire','jet-fire','flash-fire','vce','bleve','toxic'].includes(p.inputs.scenario.id))throw Error('事故类型不支持');
  if(p.inputs.material.id!==null&&typeof p.inputs.material.id!=='string')throw Error('物质ID无效');
  if(p.inputs.material.cas!==null&&typeof p.inputs.material.cas!=='string')throw Error('CAS无效');
  for(const c of p.controls)shape(c,{type:'',target:'',boundary:'',actionTimeS:null,evidence:'',status:''},'control');
  for(const c of p.controls){if(c.actionTimeS!==null&&(typeof c.actionTimeS!=='number'||!Number.isFinite(c.actionTimeS)||c.actionTimeS<0))throw Error('措施时间无效');}
  for(const a of p.assumptions)shape(a,{text:'',source:'',confirmed:false},'assumption');
  for(const r of p.inputs.receptors){shape(r,{id:'',x:0,y:0,z:0},'receptor');if(![r.x,r.y,r.z].every(Number.isFinite))throw Error('目标坐标无效');}
  const errors=validateInputs(p);if(errors.length)throw Error(errors[0].message);
  if(p.comparison!==null){
    if(!allowComparison)throw Error('不允许嵌套比较');
    if(typeof p.comparison!=='object'||Array.isArray(p.comparison)||Object.keys(p.comparison).sort().join(',')!=='dataVersion,inputRevision,modelVersion,project')throw Error('比较结构无效');
    if(typeof p.comparison.modelVersion!=='string'||typeof p.comparison.dataVersion!=='string'||!Number.isInteger(p.comparison.inputRevision))throw Error('比较版本无效');
    validateRecord(p.comparison.project,false);
  }
  return p;
}
export function parseProject(text){
  if(new TextEncoder().encode(text).length>1048576)throw Error('文件超过 1 MiB');
  const raw=JSON.parse(text.replace(/^\uFEFF/,''));inspect(raw);
  // Imported results and review claims are never trusted, including older summaries.
  delete raw.resultSummary;delete raw.result;delete raw.reviewStatus;
  if(raw.comparison?.project){delete raw.comparison.project.resultSummary;delete raw.comparison.project.result;delete raw.comparison.project.reviewStatus;}
  validateRecord(raw);raw.inputRevision++;return raw;
}
export function canonicalInputs(p){
  const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
  return JSON.stringify(stable({inputs:p.inputs,controls:p.controls,assumptions:p.assumptions,evidenceNotes:p.evidenceNotes}));
}
export async function inputHash(p){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalInputs(p))))).map(x=>x.toString(16).padStart(2,'0')).join('');}

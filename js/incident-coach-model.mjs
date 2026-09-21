export const VERSION='incident-coach-0.2';
export const MAX_BACKUP_BYTES=16000000;
export const BOUNDARY='调查底稿，须由调查组人工核实。不自动认定事故等级、责任、最终根因或措施有效，不替代应急处置、法定报告、技术鉴定与审批。';
export const STEPS=['事件概况','深度与策划','证据','时间线','屏障','原因','措施','验证与学习'];
const f=(key,label,type='text',options)=>({key,label,type,options});
export const CATEGORIES=['人员与能力','设备与设计','物料与工艺','程序与任务','环境与工作条件','检测报警与反馈','管理与组织'];
export const DEFINITIONS={
 event:[f('title','事件简述'),f('type','事件类型','select',['待确认','险肇','人员受伤','泄漏','设备损坏','火灾爆炸','其他']),f('actual','实际后果','area'),f('potential','潜在最严重后果','select',['未知','轻微','严重伤害或重大损失','多人伤亡或灾难性后果']),f('basis','潜在后果判断依据','area'),f('emergency','现场应急状态','select',['未确认','正在处置','已由现场确认受控']),f('repeated','是否重复发生','select',['未知','否','是'])],
 plan:[f('depth','人工选定调查深度','select',['待决定','快速调查','标准调查','深度调查']),f('reason','选定深度的理由'),f('lead','调查负责人角色或代号'),f('team','参与角色与分工','area'),f('scope','调查范围和关键问题','area'),f('records','需要保护的现场与调取记录','area'),f('interviews','拟访谈角色与待核实问题','area'),f('deadline','调查计划日期','date'),f('reporting','法定报告义务人工核对记录','area')],
 evidence:[f('text','客观内容与支持的事实','area'),f('type','证据类型','select',['待确认','物证','文件','电子记录','访谈记录']),f('source','来源代号'),f('acquired','取得时间与条件'),f('status','证据状态（人工填写）','select',['待核实','单一来源','已交叉核实','存在冲突']),f('check','确认依据或待解决冲突','area')],
 timeline:[f('time','日期或相对时间'),f('text','事件或操作','area'),f('conditions','设备状态、报警与当时响应','area'),f('refs','关联证据','refs','evidence')],
 barriers:[f('hazard','危险源'),f('top','失去控制的事件'),f('text','屏障及预期功能','area'),f('kind','屏障作用','select',['待确认','防止事件发生','减轻事件后果']),f('status','事发时状态','select',['状态未知','有效','效果不足','未执行','失效','被旁路','未维护','缺失']),f('refs','关联证据','refs','evidence'),f('reason','状态依据与待核实原因','area')],
 causes:[f('text','原因陈述或待验证假设','area'),f('category','分析维度','select',CATEGORIES),f('status','分析状态','select',['分析假设','待验证','人工确认','已排除']),f('parents','解释哪条上层原因（可多选）','refs','causes'),f('barriers','关联屏障','refs','barriers'),f('refs','关联证据','refs','evidence'),f('check','为什么成立、反证与待核实问题','area')],
 actions:[f('targets','对应屏障或原因','refs','targets'),f('text','具体措施','area'),f('level','控制层级','select',['待选择','消除','替代','工程控制','管理控制','个人防护 PPE','处罚或通报']),f('owner','责任角色或代号'),f('due','计划完成日期','date'),f('expected','预期改善与所需资源','area'),f('criterion','有效性验证方法与判据','area'),f('status','人工记录状态','select',['待实施','实施中','待验证','已验证']),f('completion','完成依据','area'),f('effectiveness','实际效果依据','area'),f('verifier','验证人角色或代号'),f('verifiedAt','验证日期','date')],
 learning:[f('lesson','可分享的核心教训','area'),f('scope','横向检查范围（设备、操作、程序等）','area'),f('checks','各范围的负责人、验证方式与日期','area'),f('audience','学习对象及后续反馈方式','area'),f('review','发布前复核意见与复核人代号','area')]
};
export const COLLECTIONS=['evidence','timeline','barriers','causes','actions'];
export const PREFIX={evidence:'E',timeline:'T',barriers:'B',causes:'C',actions:'A'};
export const TITLES={event:'事件概况',plan:'深度与策划',evidence:'证据矩阵',timeline:'时间线',barriers:'屏障分析',causes:'原因分析',actions:'措施与验证',learning:'组织学习'};
export function emptyRecord(group){return Object.fromEntries(DEFINITIONS[group].map(d=>[d.key,d.type==='refs'?[]:d.type==='select'?d.options[0]:'']));}
export function createCase(){return {version:VERSION,event:emptyRecord('event'),plan:emptyRecord('plan'),learning:emptyRecord('learning'),...Object.fromEntries(COLLECTIONS.map(k=>[k,[]])),next:{evidence:1,timeline:1,barriers:1,causes:1,actions:1}};}
export function addRecord(s,group){if(s[group].length>=40)throw Error('每类最多 40 条，请聚焦当前事件。');const row={id:PREFIX[group]+s.next[group]++,...emptyRecord(group)};s[group].push(row);return row;}
export function removeRecord(s,group,id){s[group]=s[group].filter(x=>x.id!==id);/* Keep references visible as missing; never silently erase investigation links. */}
export function recommend(s){const e=s.event;if(['严重伤害或重大损失','多人伤亡或灾难性后果'].includes(e.potential)||e.type==='火灾爆炸')return {depth:'深度调查',reason:'存在高潜后果或火灾爆炸情景，建议组织跨专业调查组；实际无伤害不降低调查关注。',method:'证据与时间线 → 屏障 → 多因素原因分析'};if(e.potential==='未知'||!e.basis.trim()||e.repeated==='未知'||e.type==='待确认')return {depth:'标准调查',reason:'潜在后果、重复情况或判断依据尚不充分，先保留标准调查资源并核实是否需要升级。',method:'证据与时间线 → 屏障 → 原因链'};if(e.repeated==='是'||e.type!=='险肇')return {depth:'标准调查',reason:'事件后果、重复性或类型需要结构化取证，建议联合生产、设备与 EHS 分析。',method:'证据与时间线 → 屏障 → 原因链'};return {depth:'快速调查',reason:'仅作为轻微险肇且信息清楚时的内部资源建议；现场或企业程序可要求升级。',method:'简化时间线 → 5Why 五问法 → 措施验证'};}
export function causeCycle(s){const map=new Map(s.causes.map(c=>[c.id,c.parents]));const done=new Set(),active=new Set();function visit(id){if(active.has(id))return true;if(done.has(id))return false;active.add(id);for(const p of map.get(id)||[])if(visit(p))return true;active.delete(id);done.add(id);return false;}return s.causes.some(c=>visit(c.id));}
export function checkCase(s){const issues=[];const warn=(step,text)=>issues.push({step,text});
 if(!s.event.title.trim())warn(0,'补充事件简述。');if(s.event.emergency!=='已由现场确认受控')warn(0,'优先核对现场应急状态；不要等待本工具决定响应。');if(s.event.potential==='未知'||!s.event.basis.trim())warn(0,'潜在后果或判断依据待核实。');
 if(s.plan.depth==='待决定'||!s.plan.lead||!s.plan.scope)warn(1,'补充调查深度、负责人及范围。');if(!s.plan.reporting.trim())warn(1,'记录法定报告义务的人工核对情况；本工具不判断是否需要报告。');
 for(const g of COLLECTIONS){if(!s[g].length)warn(COLLECTIONS.indexOf(g)+2,`尚无${TITLES[g]}记录。`);for(const r of s[g]){if(!r.text.trim())warn(COLLECTIONS.indexOf(g)+2,`${r.id} 缺少内容。`);for(const d of DEFINITIONS[g].filter(x=>x.type==='refs')){const pool=d.options==='targets'?[...s.barriers,...s.causes]:s[d.options];for(const id of r[d.key])if(!pool.some(p=>p.id===id))warn(COLLECTIONS.indexOf(g)+2,`${r.id} 引用了已不存在的 ${id}，请重新关联。`);}}}
 for(const e of s.evidence)if(e.status!=='已交叉核实'||!e.source||!e.check)warn(2,`${e.id} 的来源或确认依据仍需核实（${e.status}）。`);
 for(const [g,step] of [['timeline',3],['barriers',4],['causes',5]])for(const r of s[g]){
  if(!r.refs.length)warn(step,`${r.id} 尚未关联证据。`);
  else if(r.refs.some(id=>!s.evidence.some(e=>e.id===id&&e.status==='已交叉核实'&&e.check&&e.source)))warn(step,`${r.id} 关联证据存在待核实、单一来源或冲突，不代表事实已确认。`);
 }
 for(const b of s.barriers){if(b.status==='状态未知'||!b.hazard||!b.top||!b.reason)warn(4,`${b.id} 的危险源、顶事件或屏障状态依据待补充。`);if(b.status!=='有效'&&!s.actions.some(a=>a.targets.includes(b.id)))warn(6,`${b.id} 尚未关联措施或核实行动。`);}
 if(!s.timeline.length||!s.barriers.length)warn(5,'先还原事件与检查屏障，再核实原因；不要直接填写最终根因。');
 if(causeCycle(s))warn(5,'原因关联存在循环，请检查因果方向。');
 for(const c of s.causes){if(c.status==='人工确认'&&!c.check)warn(5,`${c.id} 标记人工确认，但尚无确认/反证说明。`);if(c.status!=='已排除'&&!s.actions.some(a=>a.targets.includes(c.id)))warn(6,`${c.id} 尚未关联改进或验证假设的行动。`);}
 if(s.actions.length&&s.actions.every(a=>['管理控制','个人防护 PPE','处罚或通报','待选择'].includes(a.level)))warn(6,'措施主要依赖人员执行或尚未分类，请进一步考虑消除、替代、工程控制和组织支持；不能据此推断措施无效或风险已降低。');
 for(const a of s.actions){if(!a.targets.length||!a.owner||!a.due||!a.criterion)warn(6,`${a.id} 补充关联对象、负责人、期限及验证判据。`);if(a.level==='处罚或通报')warn(6,`${a.id} 处罚或通报不能单独作为风险控制。`);if(a.status==='已验证'&&(!a.completion||!a.effectiveness||!a.verifier||!a.verifiedAt))warn(7,`${a.id} 标记已验证，但完成依据、效果依据或验证人/日期不完整。`);if(a.status!=='已验证')warn(7,`${a.id} 仍为${a.status}，不要将实施完成等同于有效。`);}
 if(!s.learning.lesson||!s.learning.scope||!s.learning.checks||!s.learning.review)warn(7,'补充学习要点、横向范围、跟进安排及发布前复核。');return issues;
}
export function parseBackup(text){if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw Error('备份超过 16 MB。');const raw=JSON.parse(text);if(raw?.version!==VERSION)throw Error('不是本工具当前版本的备份。');const s=createCase();
 function readRecord(g,r){if(!r||typeof r!=='object'||Array.isArray(r))throw Error('备份记录格式错误。');const row=emptyRecord(g);for(const d of DEFINITIONS[g]){const v=r[d.key];if(d.type==='refs'){if(!Array.isArray(v)||v.length>80||v.some(x=>typeof x!=='string'||!/^([ETBCA])[1-9]\d{0,5}$/.test(x)))throw Error('关联编号格式错误。');row[d.key]=[...new Set(v)];}else {if(typeof v!=='string'||v.length>2400||(d.type==='select'&&!d.options.includes(v))||(d.type==='date'&&v&&!/^\d{4}-\d{2}-\d{2}$/.test(v)))throw Error('字段缺失、过长或选项无效。');row[d.key]=v;}}return row;}
 for(const g of ['event','plan','learning'])s[g]=readRecord(g,raw[g]);
 for(const g of COLLECTIONS){if(!Array.isArray(raw[g])||raw[g].length>40)throw Error('记录数量不合法。');const ids=new Set();s[g]=raw[g].map(r=>{if(typeof r.id!=='string'||!new RegExp('^'+PREFIX[g]+'[1-9]\\d{0,5}$').test(r.id)||ids.has(r.id))throw Error('编号无效或重复。');ids.add(r.id);return {id:r.id,...readRecord(g,r)};});const min=Math.max(0,...s[g].map(r=>Number(r.id.slice(1))))+1;const saved=raw.next?.[g];s.next[g]=Number.isSafeInteger(saved)&&saved>=min&&saved<1000000?saved:min;}
 return s;
}
export function exampleCase(){const s=createCase();Object.assign(s.event,{title:'【虚构教学案例】拆卸软管时残液飞溅',type:'险肇',actual:'少量清洗液进入隔离区，无人员接触。全部内容均为教学虚构。',potential:'严重伤害或重大损失',basis:'若人员位于接口前方，残余压力及介质可能造成严重伤害，需结合真实介质和压力复核。',emergency:'已由现场确认受控',repeated:'未知'});Object.assign(s.plan,{depth:'深度调查',reason:'按虚构高潜情景演练',lead:'调查负责人 M',team:'操作、设备、EHS 共同核实',scope:'软管停泵、隔离、泄压、拆卸全过程',reporting:'教学示例不作真实报告判断。'});
 const e=addRecord(s,'evidence');Object.assign(e,{text:'虚构记录：停泵后接口仍有残液喷出。',type:'访谈记录',source:'访谈代号 E-A',status:'单一来源',check:'待核对工艺状态和设备记录，不能仅凭访谈确认压力来源。'});
 const t=addRecord(s,'timeline');Object.assign(t,{time:'T+0 分钟',text:'停泵后开始松开接口，发现飞溅后停止。',conditions:'隔离区无人；压力与阀位待核实。',refs:[e.id]});
 const b=addRecord(s,'barriers');Object.assign(b,{hazard:'残余压力与清洗介质',top:'介质从拆卸接口失去控制',text:'拆卸前确认零能量与安全排放',kind:'防止事件发生',status:'状态未知',reason:'需确认屏障是否存在及是否执行。',refs:[e.id]});
 const c=addRecord(s,'causes');Object.assign(c,{text:'停泵与零压力确认可能被混同。',category:'程序与任务',status:'分析假设',barriers:[b.id],refs:[e.id],check:'需核对程序、实际做法和不同人员的视角。'});
 const a=addRecord(s,'actions');Object.assign(a,{text:'核实隔离与泄压设计，评估可验证的零能量确认方式。',targets:[b.id,c.id],level:'工程控制',owner:'设备角色 E',expected:'降低拆卸时接触残余压力的可能性；设计适用性待审核。',criterion:'现场测试排放路径与确认方式，核实操作人员能正确辨识状态。'});
 s.learning.lesson='停泵不能作为零能量的唯一依据；本例的具体原因仍待证据核实。';s.learning.scope='同类软管、清洗接口与拆卸程序';return s;}
export function learningCard(s){return [['发生了什么',s.event.title],['实际后果',s.event.actual],['潜在后果',s.event.potential+'；依据：'+s.event.basis],['关键事实与时间线',s.timeline.map(t=>`${t.id} ${t.time} ${t.text}〔证据 ${t.refs.join('、')||'未关联'}〕`).join('\n')],['屏障',s.barriers.map(b=>`${b.id} ${b.text}：${b.status}`).join('\n')],['原因与待核实事项',s.causes.map(c=>`${c.id} ${c.text}〔${c.status}〕`).join('\n')],['核心教训',s.learning.lesson],['行动',s.actions.map(a=>`${a.id} ${a.text}〔${a.status}；${a.owner||'责任待定'}；${a.due||'日期待定'}〕`).join('\n')],['横向检查',s.learning.scope],['验证与跟进',s.learning.checks],['学习对象',s.learning.audience],['发布前复核',s.learning.review],['边界',BOUNDARY]];}
export function exportSheets(s){return Object.entries(DEFINITIONS).map(([g,fields])=>({name:TITLES[g],rows:COLLECTIONS.includes(g)?[['编号',...fields.map(f=>f.label)],...s[g].map(r=>[r.id,...fields.map(d=>Array.isArray(r[d.key])?r[d.key].join('、'):r[d.key])])]:[['项目','内容'],...fields.map(d=>[d.label,s[g][d.key]])]})).concat([{name:'LFI学习卡片',rows:[['项目','内容'],...learningCard(s)]},{name:'待人工复核',rows:[['步骤','提示'],...checkCase(s).map(i=>[STEPS[i.step],i.text]),['使用边界',BOUNDARY],['方法参考','https://www.hse.gov.uk/pubns/books/hsg245.htm'],['控制层级','https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html']]}]);}

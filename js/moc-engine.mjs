/** MOC coaching rules. All decisions are local, deterministic and advisory. */
export const SCHEMA_VERSION = 1;
export const STATUS_LABELS = Object.freeze({draft:'草稿',assessed:'已评估',pending_approval:'待线下审批',approved:'已录入线下批准',implementing:'实施中',ready_for_startup:'具备投用记录条件',in_service:'已投用',verification_due:'待验证',closed:'已关闭',rejected:'退回',cancelled:'已取消',expired:'临时变更已到期',reopened:'已重新开启'});
export const ITEM_STATUS_LABELS = {open:'待完成',in_progress:'进行中',done:'已完成'};
export const GATE_LABELS = {before_approval:'批准前完成',before_implementation:'实施前完成',before_startup:'投用前完成',after_startup:'投用后允许完成'};
const clone = value => JSON.parse(JSON.stringify(value));
const text = value => typeof value === 'string' ? value.trim() : '';
const has = value => text(value).length > 0;
const unique = values => [...new Set(values)];
const dateOf = now => { const d = now === undefined ? new Date() : new Date(now); if (!Number.isFinite(d.getTime())) throw new Error('日期无效，请使用有效日期。'); return d; };
const iso = now => dateOf(now).toISOString();
// Expiry follows the site's documented Asia/Shanghai calendar, including the midnight boundary.
const day = now => { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(dateOf(now)); return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-'); };
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const validDate = value => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const postApproval = status => ['approved','implementing','ready_for_startup','in_service','verification_due','closed'].includes(status);
const list = value => Array.isArray(value) ? value : [];
const configItems = (config,key) => list(config?.[key]?.items);

export async function loadConfig() {
  const paths = {categories:'categories',impactPrompts:'impact-prompts',criticalTriggers:'critical-triggers',documentMap:'document-map',methodRouting:'method-routing',riskMatrix:'risk-matrix.default',demoCase:'demo-case',references:'references'};
  const entries = await Promise.all(Object.entries(paths).map(async ([key,name]) => {
    const response = await fetch(new URL(`../data/moc/${name}.json`, import.meta.url));
    if (!response.ok) throw new Error('MOC 配置加载失败，请刷新重试；已保存记录仍保留在当前浏览器。');
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

export function createItem(type) {
  const id = uid();
  const definitions = {
    risk:{id,scenario:'',cause:'',consequence:'',affected:'',existingControls:'',initialLikelihood:'',initialSeverity:{people:'',environment:'',asset:'',reputation:''},additionalMeasures:'',hierarchy:'engineering',owner:'',due:'',evidence:'',status:'open',residualLikelihood:'',residualSeverity:'',acceptanceBy:'',acceptanceNote:'',professionalReview:'',safetyCritical:true,gate:'before_startup'},
    action:{id,title:'',riskId:'',gate:'before_startup',safetyCritical:true,owner:'',due:'',evidenceRequirement:'',evidence:'',status:'open',postStartupBasis:'',postStartupApprovedBy:'',postStartupApprovedAt:''},
    document:{id,templateId:'',title:'',required:true,owner:'',due:'',status:'open',evidence:'',approvedBy:''},
    training:{id,targetId:'',audience:'',content:'',method:'',date:'',trainer:'',evidence:'',status:'open',required:true},
    approval:{id,roleId:'',role:'',name:'',responsibility:'',opinion:'',conclusion:'pending',date:'',evidence:'',version:1},
    stakeholder:{id,name:'',role:'',impact:''}
  };
  if (!definitions[type]) throw new Error('未知条目类型。');
  return definitions[type];
}

export function createRecord(config, now) {
  const timestamp = iso(now);
  return {
    schemaVersion:SCHEMA_VERSION,
    meta:{id:`MOC-${day(now).replaceAll('-','')}-${uid().slice(0,8)}`,title:'',version:1,status:'draft',createdAt:timestamp,updatedAt:timestamp,approvedVersion:0},
    changeSummary:{area:'',before:'',after:'',reason:'',expectedResult:'',plannedStart:'',applicant:'',owner:'',technicalBasis:''},
    screening:{replacementComparisons:list(config?.categories?.replacementComparisons).map(item => ({...item,result:'unknown',evidence:''})),determination:'needs_review',rationale:'',replacementConfirmedBy:'',replacementConfirmedAt:'',durationType:'permanent',temporaryExpiry:'',restorationPlan:'',emergency:false,emergencyReason:'',minimumControls:'',emergencyAuthorizationBy:'',emergencyAuthorizationEvidence:'',emergencyAuthorizationAt:'',formalizedAt:'',expiredAt:'',expiryReview:{by:'',date:'',evidence:'',newExpiry:''}},
    classification:{categories:[],scope:'',suggestedLevel:'needs_review',confirmedLevel:'',triggers:[],suggestedMethods:[]},
    impactDomains:configItems(config,'impactPrompts').map(item => ({id:item.id,label:item.label,status:'unknown',explanation:''})),
    riskItems:[],actions:[],stakeholders:[],documents:[],training:[],approvals:[],
    pssr:{required:null,rationale:'',confirmedBy:'',confirmedAt:'',status:'not_started',evidence:'',passedBy:'',passedAt:''},
    implementation:{plan:'',actualStart:'',actualEnd:'',result:'',startupAuthorizedBy:'',startupAuthorizedAt:'',startupAuthorizationEvidence:''},
    verification:{scopeMatches:'unknown',effectsAchieved:'unknown',newRisks:'unknown',evidence:'',verifiedBy:'',verifiedAt:'',feedback:'',temporaryOutcome:'',restorationEvidence:'',permanentReviewId:'',permanentReviewEvidence:'',closeReason:''},
    auditTrail:[{at:timestamp,action:'created',actor:'本机记录人',note:'创建 MOC 草稿；演示配置须由所在企业确认。',version:1}]
  };
}

function addAudit(record, action, actor, note, now) {
  record.meta.updatedAt = iso(now);
  record.auditTrail.push({at:iso(now),action,actor:text(actor)||'本机记录人',note:text(note).slice(0,6000),version:record.meta.version});
  // Stop before storage loses meaningful history; do not silently discard audit records.
  if (record.auditTrail.length > 5000) throw new Error('本记录审计轨迹已达容量上限，请先导出备份并建立关联的新记录。');
}
function addBlock(blocks, condition, message) { if (condition) blocks.push(message); }

export function riskScore(likelihood, severity, matrix) {
  const values = severity && typeof severity === 'object' ? Object.values(severity) : [severity];
  if (!values.length || values.some(value => value === '' || value === null || value === undefined)) return null;
  const l = Number(likelihood), nums = values.map(Number);
  if (likelihood === '' || likelihood === null || !Number.isInteger(l) || l<1 || l>5 || nums.some(n=>!Number.isInteger(n)||n<1||n>5)) return null;
  const maximum = Math.max(...nums), score = l * maximum;
  const band = matrix?.bands?.find(item => score >= item.min && score <= item.max);
  return band ? {score,likelihood:l,severity:maximum,level:band.level,label:band.label,color:band.color} : null;
}

function selectedContext(record, config) {
  const selectedTriggers = configItems(config,'criticalTriggers').filter(item => record.classification.triggers.includes(item.id));
  const categories = unique([...record.classification.categories,...selectedTriggers.flatMap(item=>item.categories)]);
  // A new chemical and instrument critical logic are also captured by explicit comparison changes.
  const changed = record.screening.replacementComparisons.filter(item=>item.result==='changed').map(item=>item.id);
  if (changed.includes('logic') && !selectedTriggers.some(item=>item.id==='safety_function')) {
    const trigger = configItems(config,'criticalTriggers').find(item=>item.id==='safety_function');
    if (trigger) selectedTriggers.push(trigger);
    categories.push('instrument','process');
  }
  if (changed.includes('chemical') && !selectedTriggers.some(item=>item.id==='chemical_change')) {
    const trigger = configItems(config,'criticalTriggers').find(item=>item.id==='chemical_change');
    if (trigger) selectedTriggers.push(trigger);
    categories.push('chemical');
  }
  if (changed.includes('seal')) categories.push('equipment');
  if (changed.includes('capacity')) categories.push('equipment','electrical');
  const impacts = unique([...record.impactDomains.filter(item=>item.status==='affected').map(item=>item.id),...selectedTriggers.flatMap(item=>item.impacts)]);
  return {categories:unique(categories),impacts,triggers:selectedTriggers};
}
function matches(item, context) { return item.categories?.some(id=>context.categories.includes(id)) || item.impacts?.some(id=>context.impacts.includes(id)); }

export function evaluate(record, config, now) {
  const context = selectedContext(record,config), today = day(now);
  const approvalBlockers = [], implementationBlockers = [], startupBlockers = [], closeBlockers = [], warnings = [];
  const comparisons = record.screening.replacementComparisons;
  const comparisonIds = list(config.categories?.replacementComparisons).map(item=>item.id);
  const changed = comparisons.filter(item=>item.result==='changed');
  const missingComparison = !comparisonIds.length || comparisonIds.some(id=>!comparisons.some(item=>item.id===id && ['same','na'].includes(item.result) && has(item.evidence)));
  let replacement;
  if (changed.length || context.triggers.length) replacement = {code:'moc',label:'建议进入 MOC',reasons:unique([...changed.map(item=>`${item.label||item.id}发生变化`),...context.triggers.map(item=>item.label)])};
  else if (missingComparison) replacement = {code:'needs_review',label:'信息不足，需要专业人员判断',reasons:['请逐项记录等同性或不适用依据；无法证明完全等同不能判断为同类替换。']};
  else replacement = {code:'possible_replacement',label:'可能属于同类替换，仍需授权人确认',reasons:['对比项目均已填写等同／不适用依据；本结论不会自动关闭记录。']};
  const level = context.triggers.length ? {code:'important',label:'建议重要变更',reasons:context.triggers.map(item=>item.label)} : !context.categories.length || record.impactDomains.some(item=>item.status==='unknown') ? {code:'needs_review',label:'需人工判定',reasons:['专业类别或影响尚未确认，请完成筛查后由企业确定等级。']} : {code:'general',label:'建议一般变更',reasons:['当前未命中已配置的重要触发器；最终等级以企业制度和专业复核为准。']};
  const technical = ['layout','process','equipment','instrument','electrical','utilities','chemical'].some(id=>context.categories.includes(id)) || context.triggers.some(item=>item.pssr);
  const orgUncertain = !technical && (context.categories.includes('organization') || ['organization','emergency','process'].some(id=>context.impacts.includes(id)));
  const pssrRecommendation = technical ? {required:true,label:'默认建议 PSSR',reasons:['技术、设备、设施或安全关键功能变化，投用前应确认启动安全条件。']} : orgUncertain ? {required:null,label:'由专业人员判断 PSSR 适用性',reasons:['组织、能力、应急或操作准备受影响时，应人工判断是否需要 PSSR。']} : {required:false,label:'未自动触发 PSSR，仍须确认',reasons:['纯管理／文控变化不机械触发，仍需记录专业判定及依据。']};
  const suggestedDocuments = configItems(config,'documentMap').filter(item=>matches(item,context));
  const suggestedTraining = list(config.documentMap?.training).filter(item=>matches(item,context));
  const suggestedRoles = list(config.documentMap?.roles).filter(item=>item.always || item.important && level.code==='important' || matches(item,context));
  const suggestedMethods = configItems(config,'methodRouting').filter(item=>item.categories.some(id=>context.categories.includes(id))||item.triggers.some(id=>context.triggers.some(t=>t.id===id)));
  const temporary = record.screening.durationType==='temporary';
  const restored = record.verification.temporaryOutcome==='restored' && has(record.verification.restorationEvidence) && record.verification.scopeMatches==='yes' && has(record.verification.verifiedBy) && validDate(record.verification.verifiedAt);
  const expired = temporary && !restored && (has(record.screening.expiredAt) || validDay(record.screening.temporaryExpiry) && today > record.screening.temporaryExpiry) && !['closed','cancelled'].includes(record.meta.status);
  const required = [['meta.title','变更名称'],['changeSummary.area','所属装置／区域'],['changeSummary.before','变更前描述'],['changeSummary.after','变更后描述'],['changeSummary.reason','变更原因'],['changeSummary.expectedResult','预期效果'],['changeSummary.applicant','申请人'],['changeSummary.owner','变更负责人'],['changeSummary.technicalBasis','技术依据'],['implementation.plan','实施方案']];
  for (const [path,label] of required) addBlock(approvalBlockers,!has(path.split('.').reduce((o,k)=>o?.[k],record)),`请填写${label}。`);
  addBlock(approvalBlockers,!validDay(record.changeSummary.plannedStart),'请填写有效的拟实施日期。');
  addBlock(approvalBlockers,!context.categories.length,'请选择至少一个变更专业类别。');
  addBlock(approvalBlockers,!has(record.classification.scope),'请选择影响范围。');
  addBlock(approvalBlockers,!['general','important'].includes(record.classification.confirmedLevel),'请按企业制度确认变更等级。');
  addBlock(approvalBlockers,level.code==='important' && record.classification.confirmedLevel!=='important','命中重要触发器，请按重要变更准备评审；降级须先调整企业配置并专业复核。');
  addBlock(approvalBlockers,!has(record.screening.rationale),'请记录同类替换／进入 MOC 的判断依据。');
  addBlock(approvalBlockers,replacement.code==='possible_replacement' && (!has(record.screening.replacementConfirmedBy)||!validDate(record.screening.replacementConfirmedAt)),'可能同类替换仍需授权人姓名、确认日期及对比依据。');
  addBlock(approvalBlockers,temporary && (!validDay(record.screening.temporaryExpiry)||!has(record.screening.restorationPlan)),'临时变更必须填写有效到期日和恢复方案。');
  addBlock(approvalBlockers,temporary && validDay(record.screening.temporaryExpiry) && validDay(record.changeSummary.plannedStart) && record.screening.temporaryExpiry < record.changeSummary.plannedStart,'临时到期日不得早于拟实施日期。');
  if (expired) { for (const blocks of [approvalBlockers,implementationBlockers,startupBlockers,closeBlockers]) blocks.push('临时变更已到期：先恢复原状并验证，或记录新的专业评审；修改到期日期不能解除阻断。'); }
  if (temporary && validDay(record.screening.temporaryExpiry) && !expired) {
    const remaining = (Date.parse(record.screening.temporaryExpiry)-Date.parse(today))/86400000;
    if (remaining>=0 && remaining <= (config.riskMatrix.temporaryReminderDays ?? 7)) warnings.push(`临时变更将在 ${remaining} 天后到期，请安排恢复或重新评审。`);
  }
  if (record.screening.emergency) {
    addBlock(approvalBlockers,!has(record.screening.emergencyReason),'应急变更必须记录紧急理由。');
    addBlock(approvalBlockers,!has(record.screening.minimumControls),'应急变更必须记录实施前最低控制。');
    addBlock(approvalBlockers,!has(record.screening.emergencyAuthorizationBy)||!has(record.screening.emergencyAuthorizationEvidence)||!validDate(record.screening.emergencyAuthorizationAt),'应急变更必须记录实施前授权人、日期和依据。');
    addBlock(approvalBlockers,validDate(record.implementation.actualStart)&&validDate(record.screening.emergencyAuthorizationAt)&&Date.parse(record.screening.emergencyAuthorizationAt)>Date.parse(record.implementation.actualStart),'应急授权日期晚于实际实施日期，须核查并说明实施前授权。');
    warnings.push(`应急变更须先落实最低控制、审批和授权后实施，并尽快补办正式记录；AQ/T 3034-2022 提供一般性 ${config.riskMatrix.emergencyReferenceHours??48} 小时补办参考，企业制度和法规要求优先。`);
    if (validDate(record.implementation.actualStart)&&!has(record.screening.formalizedAt)&&(dateOf(now).getTime()-Date.parse(record.implementation.actualStart))/3600000>=(config.riskMatrix.emergencyReferenceHours??48)) warnings.push('应急变更正式记录尚未补齐，已达到一般性补办参考时间，请立即按企业要求处理。');
  }
  for (const domain of configItems(config,'impactPrompts')) {
    const entry = record.impactDomains.find(item=>item.id===domain.id);
    addBlock(approvalBlockers,!entry || !['none','affected'].includes(entry.status),`${domain.label}：影响尚未确认，请完成专业判断。`);
    addBlock(approvalBlockers,entry && entry.status!=='none'&&!has(entry.explanation),`${domain.label}：有影响或不确定时请填写说明。`);
    addBlock(approvalBlockers,context.triggers.some(item=>item.impacts.includes(domain.id)) && entry?.status==='none',`${domain.label}：与关键触发器冲突，请重新核查影响。`);
  }
  const riskResults = [];
  addBlock(approvalBlockers,!record.riskItems.length,'至少记录一项风险情景及残余风险，空白风险清单不能视为评估完成。');
  for (const [index,risk] of record.riskItems.entries()) {
    const label = `风险 ${index+1}（${text(risk.scenario)||'未命名'}）`, initial = riskScore(risk.initialLikelihood,risk.initialSeverity,config.riskMatrix), residual = riskScore(risk.residualLikelihood,risk.residualSeverity,config.riskMatrix);
    riskResults.push({id:risk.id,initial,residual});
    addBlock(approvalBlockers,['scenario','cause','consequence','affected','existingControls','additionalMeasures','owner'].some(key=>!has(risk[key]))||!validDay(risk.due),`${label}：请补齐情景、原因、后果、对象、现有控制、附加措施、责任人及期限。`);
    addBlock(approvalBlockers,!initial,`${label}：请完整填写初始可能性和各后果维度严重度。`);
    addBlock(approvalBlockers,!residual,`${label}：残余风险未完成评估，不能进入审批准备。`);
    addBlock(approvalBlockers,residual?.level==='extreme',`${label}：极高残余风险必须降低后重新评估，不得直接接受。`);
    addBlock(approvalBlockers,!has(risk.acceptanceBy)||!has(risk.acceptanceNote),`${label}：请记录残余风险接受人及依据。`);
    addBlock(approvalBlockers,residual?.level==='high'&&config.riskMatrix.highRequiresProfessionalReview&&!has(risk.professionalReview),`${label}：高残余风险需专业评审记录。`);
    addBlock(approvalBlockers,risk.safetyCritical&&risk.gate==='after_startup',`${label}：安全关键措施不得降为投用后完成。`);
    addBlock(approvalBlockers,risk.gate==='after_startup',`${label}：风险降低措施应在投用前验证；投用后遗留项请单列非安全关键行动并记录书面批准。`);
    const incomplete = risk.status!=='done'||!has(risk.evidence);
    if (risk.gate==='before_approval') addBlock(approvalBlockers,incomplete,`${label}：批准前措施须完成并有证据。`);
    if (['before_approval','before_implementation'].includes(risk.gate)) addBlock(implementationBlockers,incomplete,`${label}：实施前措施须完成并有证据。`);
    addBlock(startupBlockers,incomplete,`${label}：风险控制措施须在投用前完成并有证据。`);
    addBlock(closeBlockers,incomplete,`${label}：风险措施尚未完成或缺少证据。`);
  }
  for (const [index,action] of record.actions.entries()) {
    const label=`行动 ${index+1}（${text(action.title)||'未命名'}）`;
    addBlock(approvalBlockers,!has(action.title)||!has(action.owner)||!validDay(action.due)||!has(action.evidenceRequirement),`${label}：请填写内容、责任人、有效期限和证据要求。`);
    addBlock(approvalBlockers,action.riskId&&!record.riskItems.some(item=>item.id===action.riskId),`${label}：关联风险不存在，请重新关联。`);
    addBlock(approvalBlockers,action.safetyCritical&&action.gate==='after_startup',`${label}：安全关键行动不得标为投用后完成。`);
    addBlock(approvalBlockers,action.gate==='after_startup'&&(!has(action.postStartupBasis)||!has(action.postStartupApprovedBy)||!validDate(action.postStartupApprovedAt)),`${label}：投用后遗留项必须具备书面依据、批准人和批准日期。`);
    const incomplete=action.status!=='done'||!has(action.evidence);
    if (action.gate==='before_approval') addBlock(approvalBlockers,incomplete,`${label}：批准前行动未完成或缺少证据。`);
    if (['before_approval','before_implementation'].includes(action.gate)) addBlock(implementationBlockers,incomplete,`${label}：实施前行动未完成或缺少证据。`);
    if (action.gate!=='after_startup'||action.safetyCritical) addBlock(startupBlockers,incomplete,`${label}：投用前行动未完成或缺少证据。`);
    addBlock(startupBlockers,action.gate==='after_startup'&&incomplete&&validDay(action.due)&&action.due<today,`${label}：遗留项已过期，不能带入投用。`);
    addBlock(closeBlockers,incomplete,`${label}：关闭前所有行动须完成并有证据。`);
  }
  for (const suggestion of suggestedDocuments) {
    addBlock(approvalBlockers,!record.documents.some(item=>item.templateId===suggestion.id&&item.required),`请建立必需文件：${suggestion.title}。`);
  }
  for (const document of record.documents.filter(item=>item.required)) {
    addBlock(approvalBlockers,!has(document.title)||!has(document.owner)||!validDay(document.due),`文件 ${text(document.title)||'未命名'}：请填写名称、责任人和期限。`);
    const incomplete=document.status!=='done'||!has(document.evidence)||!has(document.approvedBy);
    addBlock(startupBlockers,incomplete,`文件 ${text(document.title)||'未命名'}：尚未更新、批准或缺少证据。`);
    addBlock(closeBlockers,incomplete,`文件 ${text(document.title)||'未命名'}：关闭前须完成并记录批准及证据。`);
  }
  for (const suggestion of suggestedTraining) addBlock(approvalBlockers,!record.training.some(item=>item.targetId===suggestion.id&&item.required),`请建立培训／沟通计划：${suggestion.label}。`);
  for (const training of record.training.filter(item=>item.required)) {
    const label=`培训／沟通 ${text(training.audience)||'未命名'}`;
    addBlock(approvalBlockers,!has(training.audience)||!has(training.content)||!has(training.method)||!validDay(training.date)||!has(training.trainer),`${label}：请补齐对象、内容、方式、日期和讲师／沟通人。`);
    const incomplete=training.status!=='done'||!has(training.evidence);
    addBlock(startupBlockers,incomplete,`${label}：尚未完成或缺少证据。`);
    addBlock(closeBlockers,incomplete,`${label}：关闭前须完成并提供证据。`);
  }
  for (const role of suggestedRoles) addBlock(approvalBlockers,!record.approvals.some(item=>item.roleId===role.id&&has(item.name)&&has(item.responsibility)),`请明确评审角色、姓名及职责：${role.label}。`);
  addBlock(approvalBlockers,record.pssr.required===null||!has(record.pssr.rationale)||!has(record.pssr.confirmedBy)||!validDate(record.pssr.confirmedAt),'请记录 PSSR 是否需要、判定依据、专业确认人及日期；豁免同样需要确认。');
  addBlock(approvalBlockers,record.pssr.required===false&&record.pssr.status!=='not_required','PSSR 已判定不需要，请将状态设为“不需要”并保留专业确认依据。');
  if (pssrRecommendation.required===true&&record.pssr.required===false) warnings.push('已豁免默认建议的 PSSR，请由企业授权的专业人员确认完整书面理由；本工具不授予豁免权限。');
  addBlock(implementationBlockers,record.meta.approvedVersion!==record.meta.version,'当前版本尚未记录完整线下批准，不能实施。');
  if (record.meta.approvedVersion===record.meta.version) {
    for (const role of suggestedRoles) addBlock(implementationBlockers,!record.approvals.some(item=>item.roleId===role.id&&item.version===record.meta.version&&item.conclusion==='approved'&&has(item.name)&&has(item.opinion)&&validDate(item.date)&&has(item.evidence)),`${role.label}：当前版本线下批准记录缺失或无效。`);
    addBlock(implementationBlockers,record.approvals.some(item=>item.conclusion==='rejected'),'当前批准含未解决的退回意见。');
  }
  addBlock(implementationBlockers,!has(record.implementation.plan),'请填写实施方案。');
  if (record.screening.emergency) addBlock(implementationBlockers,!has(record.screening.minimumControls)||!has(record.screening.emergencyAuthorizationBy)||!has(record.screening.emergencyAuthorizationEvidence)||!validDate(record.screening.emergencyAuthorizationAt),'应急最低控制与实施前授权记录不完整，不能实施。');
  addBlock(startupBlockers,record.pssr.required===true&&(record.pssr.status!=='passed'||!has(record.pssr.evidence)||!has(record.pssr.passedBy)||!validDate(record.pssr.passedAt)),'要求 PSSR，但尚未通过或缺少通过人、日期及证据。');
  addBlock(startupBlockers,record.pssr.required!==true&&record.pssr.required!==false,'PSSR 适用性尚未确认。');
  addBlock(startupBlockers,!has(record.implementation.startupAuthorizedBy)||!validDate(record.implementation.startupAuthorizedAt)||!has(record.implementation.startupAuthorizationEvidence),'请记录线下投用授权人、日期及依据。');
  addBlock(closeBlockers,record.verification.scopeMatches!=='yes','请确认实施结果与批准范围一致；不一致应重新开启评估。');
  addBlock(closeBlockers,record.verification.effectsAchieved!=='yes','请验证预期效果是否达到。');
  addBlock(closeBlockers,record.verification.newRisks!=='no','请确认是否存在新风险／偏差；有新风险应重新评估。');
  addBlock(closeBlockers,!has(record.verification.evidence)||!has(record.verification.verifiedBy)||!validDate(record.verification.verifiedAt),'请记录运行／检查验证证据、验证人和日期。');
  addBlock(closeBlockers,!has(record.verification.closeReason),'请填写关闭理由。');
  if (temporary) {
    addBlock(closeBlockers,!['restored','permanent'].includes(record.verification.temporaryOutcome),'临时变更须恢复原状并验证，或关联已完成的永久变更评审；到期不会自动关闭。');
    addBlock(closeBlockers,record.verification.temporaryOutcome==='restored'&&!has(record.verification.restorationEvidence),'恢复原状须提供恢复及验证证据。');
    addBlock(closeBlockers,record.verification.temporaryOutcome==='permanent'&&(!has(record.verification.permanentReviewId)||record.verification.permanentReviewId===record.meta.id||!has(record.verification.permanentReviewEvidence)),'转为永久变更须关联另一评审编号和已批准的评审依据。');
  }
  if (record.screening.emergency) addBlock(closeBlockers,!validDate(record.screening.formalizedAt),'应急变更关闭前须记录正式手续补办日期。');
  const approval = unique(approvalBlockers);
  const implementation = unique([...approval,...implementationBlockers]);
  const startup = unique([...implementation,...startupBlockers]);
  // Close requires continued integrity of the approved version and startup controls.
  const close = unique([...startup,...closeBlockers]);
  return {replacement,level,reasons:unique([...replacement.reasons,...level.reasons]),pssrRecommendation,approvalBlockers:approval,implementationBlockers:implementation,startupBlockers:startup,closeBlockers:close,warnings:unique(warnings),suggestedDocuments,suggestedRoles,suggestedTraining,suggestedMethods,expired,riskResults,effectiveCategories:context.categories,effectiveImpacts:context.impacts};
}

function invalidate(record, actor, note, now) {
  record.meta.version += 1;
  record.meta.approvedVersion = 0;
  record.meta.status = 'assessed';
  for (const approval of record.approvals) { approval.conclusion='pending'; approval.version=record.meta.version; approval.date=''; approval.evidence=''; }
  record.implementation.startupAuthorizedBy='';record.implementation.startupAuthorizedAt='';record.implementation.startupAuthorizationEvidence='';
  record.pssr.status=record.pssr.required===false?'not_required':'not_started';record.pssr.evidence='';record.pssr.passedBy='';record.pssr.passedAt='';
  addAudit(record,'approval_invalidated',actor,note,now);
}
function expiryReviewValid(record,now) {
  const review=record.screening.expiryReview;
  return has(review.by)&&validDate(review.date)&&has(review.evidence)&&validDay(review.newExpiry)&&review.newExpiry>=day(now)&&(!record.screening.expiredAt||Date.parse(review.date)>=Date.parse(record.screening.expiredAt.slice(0,10)))&&review.newExpiry>record.screening.temporaryExpiry;
}
export function refreshExpiry(record, config, now) {
  let result=record;
  if (record.screening.expiredAt && expiryReviewValid(record,now)) {
    result=clone(record);result.screening.temporaryExpiry=result.screening.expiryReview.newExpiry;result.screening.expiredAt='';
    invalidate(result,result.screening.expiryReview.by,'临时变更到期后已录入新的专业评审；期限更新并重新进入评估审批。',now);
  } else if (evaluate(record,config,now).expired && record.meta.status!=='expired') {
    result=clone(record);result.meta.status='expired';result.screening.expiredAt=result.screening.expiredAt||iso(now);
    result.meta.approvedVersion=0;
    result.implementation.startupAuthorizedBy='';result.implementation.startupAuthorizedAt='';result.implementation.startupAuthorizationEvidence='';
    addAudit(result,'expired','本机规则','临时变更到期未恢复或未重新评审，标记过期并阻断实施、投用及关闭。',now);
  }
  return result;
}
function scopeSensitive(path) {
  if (/^(changeSummary|classification)\./.test(path)||path==='meta.title'||path==='implementation.plan') return true;
  if (/^screening\.(replacementComparisons|rationale|durationType|temporaryExpiry|restorationPlan|emergency|emergencyReason|minimumControls)/.test(path)) return true;
  if (/^impactDomains(\.|$)/.test(path)) return true;
  if (/^pssr\.(required|rationale|confirmedBy|confirmedAt)/.test(path)) return true;
  if (/^(riskItems|actions|documents|training|approvals)$/.test(path)) return true;
  if (/^approvals\.\d+\./.test(path)) return true;
  if (/^(riskItems|actions|documents|training)\.\d+\./.test(path)) return !/\.(status|evidence|approvedBy|postStartupApprovedBy|postStartupApprovedAt)$/.test(path);
  return false;
}
function setPath(object,path,value) {
  const keys=Array.isArray(path)?path:String(path).split('.');
  if (!keys.length||keys.some(key=>['__proto__','prototype','constructor'].includes(key))) throw new Error('字段路径无效。');
  let target=object;
  for(const key of keys.slice(0,-1)) { if(!Object.hasOwn(target,key)||target[key]===null||typeof target[key]!=='object') throw new Error('字段路径不存在。'); target=target[key]; }
  const key=keys.at(-1);if(!Object.hasOwn(target,key)) throw new Error('字段不存在。');
  target[key]=clone(value);
}
function validateMutation(path,value,record,config) {
  const arrays={riskItems:'risk',actions:'action',documents:'document',training:'training',approvals:'approval',stakeholders:'stakeholder'};
  const scorePath=/\.(initialLikelihood|residualLikelihood|residualSeverity)$|\.initialSeverity\.(people|environment|asset|reputation)$/;
  function shape(actual,expected,name) {
    if (scorePath.test(name)) {if(actual!==''&&(!['number','string'].includes(typeof actual)||!Number.isInteger(Number(actual))||Number(actual)<1||Number(actual)>5))throw new Error('风险评分必须为空或 1–5 的整数。');return;}
    if (typeof expected==='string') {if(typeof actual!=='string'||actual.length>6000)throw new Error('文本字段类型无效或超过 6000 字。');return;}
    if (typeof expected==='boolean') {if(typeof actual!=='boolean')throw new Error('是／否字段类型无效。');return;}
    if (typeof expected==='number') {if(!Number.isInteger(actual)||actual<1||actual>100000)throw new Error('条目版本无效。');return;}
    if (!actual||typeof actual!=='object'||Array.isArray(actual))throw new Error('条目结构无效。');
    if(Object.keys(actual).length!==Object.keys(expected).length||Object.keys(actual).some(key=>!Object.hasOwn(expected,key)||['__proto__','prototype','constructor'].includes(key)))throw new Error('条目存在未知或缺失字段。');
    for(const key of Object.keys(expected))shape(actual[key],expected[key],`${name}.${key}`);
  }
  function checkEnums(item,type) {
    const allowed=(value,options)=>{if(!options.includes(value))throw new Error('条目包含无效选项。');};
    if(['risk','action','document','training'].includes(type))allowed(item.status,['open','in_progress','done']);
    if(['risk','action'].includes(type))allowed(item.gate,Object.keys(GATE_LABELS));
    if(type==='risk')allowed(item.hierarchy,['elimination','substitution','engineering','administrative','ppe']);
    if(type==='approval')allowed(item.conclusion,['pending','approved','rejected']);
  }
  if(Object.hasOwn(arrays,path)) {
    if(!Array.isArray(value)||value.length>1000)throw new Error('条目列表无效或超过 1000 项。');
    const ids=new Set();
    for(const item of value) {
      shape(item,createItem(arrays[path]),`${path}.0`);checkEnums(item,arrays[path]);
      if(!has(item.id)||item.id.length>128||ids.has(item.id))throw new Error('条目编号缺失或重复。');ids.add(item.id);
      const prior=record[path].find(row=>row.id===item.id);
      if(postApproval(record.meta.status)&&prior?.safetyCritical&&(item.safetyCritical===false||item.gate==='after_startup'))throw new Error('已批准的安全关键措施不能通过替换列表降为投用后完成。');
    }
    return;
  }
  const configuredArrays={'classification.categories':config.categories.items.map(item=>item.id),'classification.triggers':config.criticalTriggers.items.map(item=>item.id),'classification.suggestedMethods':config.methodRouting.items.map(item=>item.id)};
  if(Object.hasOwn(configuredArrays,path)) {if(!Array.isArray(value)||value.some(item=>!configuredArrays[path].includes(item))||new Set(value).size!==value.length)throw new Error('分类列表包含无效或重复选项。');return;}
  // UI updates impact/comparison entries individually; wholesale arrays must retain the complete schema.
  if(path==='impactDomains'||path==='screening.replacementComparisons') {
    const existing=path.split('.').reduce((o,k)=>o[k],record);
    if(!Array.isArray(value)||value.length!==existing.length||new Set(value.map(item=>item.id)).size!==existing.length)throw new Error('必须保留完整的筛查项目。');
    for(const item of value){const original=existing.find(row=>row.id===item.id);if(!original)throw new Error('筛查项目无效。');shape(item,original,path);}
    return;
  }
  const old=path.split('.').reduce((o,k)=>o?.[k],record);
  if(path==='pssr.required') {if(![null,true,false].includes(value))throw new Error('PSSR 适用性必须为是、否或待确认。');return;}
  if(old&&typeof old==='object'||value&&typeof value==='object')throw new Error('请逐项更新字段；不允许替换整组系统对象。');
  shape(value,old,path);
  const match=path.match(/^(riskItems|actions|documents|training|approvals)\.(\d+)\.([^.]*)$/);
  if(match){const item={...record[match[1]][Number(match[2])],[match[3]]:value};checkEnums(item,arrays[match[1]]);}
}

export function updateRecord(record,path,value,actor='本机记录人',config,now) {
  path=Array.isArray(path)?path.join('.'):String(path);
  if (/^(meta|changeSummary|screening|classification|pssr|implementation|verification)$|^meta\.(?!title$)|^schemaVersion$|^auditTrail|^screening\.(expiredAt|determination)$/.test(path)) throw new Error('系统状态和审计字段须通过受控操作修改。');
  if (typeof value==='string'&&value.length>6000) throw new Error('单个字段最多 6000 字，请精简后重试。');
  const refreshed=refreshExpiry(record,config,now);
  if (refreshed.meta.status==='closed'||refreshed.meta.status==='cancelled') throw new Error('已关闭／取消记录不能直接修改，请先重新开启或复制为新草稿。');
  if (refreshed.screening.expiredAt&&/^screening\.(temporaryExpiry|durationType)$/.test(path)) throw new Error('临时变更已到期，不能直接改日期或改为永久绕过；请填写新的专业评审或恢复验证。');
  const result=clone(refreshed);
  validateMutation(path,value,result,config);
  const old=path.split('.').reduce((o,k)=>o?.[k],result);
  if (JSON.stringify(old)===JSON.stringify(value)) return refreshed;
  // A safety-critical item cannot be relabelled as a post-startup punch list, even in two edits.
  if (/^(actions|riskItems)\.\d+\.gate$/.test(path)&&value==='after_startup') {
    const parent=path.split('.').slice(0,-1).reduce((o,k)=>o?.[k],result);
    if (parent.safetyCritical||path.startsWith('riskItems')) throw new Error('安全关键或风险降低措施必须在投用前完成。');
  }
  if (/^(actions|riskItems)\.\d+\.safetyCritical$/.test(path)&&old===true&&value===false&&postApproval(result.meta.status)) throw new Error('已批准的安全关键措施不能降为非安全关键；请新增评审后重建措施。');
  if (/^implementation\.startupAuthoriz/.test(path)&&has(String(value))) {
    const evaluation=evaluate(result,config,now);
    const blocks=evaluation.startupBlockers.filter(message=>!message.startsWith('请记录线下投用授权人'));
    if (blocks.length) throw new Error(`当前不能录入投用授权：${blocks[0]}`);
  }
  setPath(result,path,value);
  if (path==='pssr.required') {result.pssr.status=value===false?'not_required':'not_started';result.pssr.evidence='';result.pssr.passedBy='';result.pssr.passedAt='';}
  if (postApproval(result.meta.status)&&scopeSensitive(path)) invalidate(result,actor,`修改 ${path} 后原批准失效，版本递增并重新评估。`,now);
  else addAudit(result,'field_updated',actor,`更新字段 ${path}`,now);
  return refreshExpiry(result,config,now);
}

function approvalResultBlockers(record,config,now) {
  const evaluation=evaluate(record,config,now), blocks=[...evaluation.approvalBlockers];
  for(const role of evaluation.suggestedRoles) {
    const approvals=record.approvals.filter(item=>item.roleId===role.id);
    if (!approvals.some(item=>item.conclusion==='approved'&&item.version===record.meta.version&&has(item.name)&&has(item.opinion)&&validDate(item.date)&&has(item.evidence))) blocks.push(`${role.label}：请录入当前版本线下批准结论、意见、日期和依据。`);
  }
  if (record.approvals.some(item=>item.conclusion==='rejected')) blocks.push('存在未解决的退回意见，请重新评审。');
  return unique(blocks);
}
const TRANSITIONS={draft:['assessed','cancelled'],assessed:['pending_approval','cancelled'],pending_approval:['approved','rejected','cancelled'],approved:['implementing','reopened','cancelled'],implementing:['ready_for_startup','reopened','cancelled'],ready_for_startup:['in_service','reopened','cancelled'],in_service:['verification_due','reopened'],verification_due:['closed','reopened'],rejected:['assessed','cancelled'],cancelled:['reopened'],expired:['reopened'],closed:['reopened'],reopened:['assessed','cancelled']};
export function transition(record,target,actor,note,config,now) {
  if (!has(actor)||!has(note)) throw new Error('状态变更必须填写记录人和操作理由。');
  let result=clone(refreshExpiry(record,config,now));
  if (!Object.hasOwn(STATUS_LABELS,target)||!TRANSITIONS[result.meta.status]?.includes(target)) throw new Error('不允许跳过生命周期步骤，请先完成当前阶段。');
  const evaluation=evaluate(result,config,now);
  if (result.meta.status==='expired'&&target==='reopened'&&evaluation.expired) throw new Error('临时变更仍过期，请先录入恢复验证或新的专业评审。');
  let blockers=[];
  if (target==='assessed'||target==='pending_approval') blockers=evaluation.approvalBlockers;
  if (target==='approved') blockers=approvalResultBlockers(result,config,now);
  if (target==='implementing') blockers=evaluation.implementationBlockers;
  if (target==='ready_for_startup'||target==='in_service') blockers=evaluation.startupBlockers;
  if (target==='closed') blockers=evaluation.closeBlockers;
  if (blockers.length) { const error=new Error(`当前不能进入“${STATUS_LABELS[target]}”：${blockers[0]}`);error.blockers=blockers;throw error; }
  const previous=result.meta.status;
  if (target==='approved') result.meta.approvedVersion=result.meta.version;
  if (target==='reopened') invalidate(result,actor,'重新开启记录，原批准及投用授权失效，需要重新评估。',now);
  result.meta.status=target;
  addAudit(result,`status:${previous}->${target}`,actor,note,now);
  return result;
}

export function applySuggestions(record,config,now) {
  const refreshed=refreshExpiry(record,config,now);
  if (['closed','cancelled'].includes(refreshed.meta.status)) throw new Error('已关闭／取消记录不能直接生成清单，请先重新开启或复制为新草稿。');
  const result=clone(refreshed), evaluation=evaluate(result,config,now);
  for(const item of evaluation.suggestedDocuments) if(!result.documents.some(row=>row.templateId===item.id)) result.documents.push({...createItem('document'),templateId:item.id,title:item.title});
  for(const item of evaluation.suggestedTraining) if(!result.training.some(row=>row.targetId===item.id)) result.training.push({...createItem('training'),targetId:item.id,audience:item.label});
  for(const item of evaluation.suggestedRoles) if(!result.approvals.some(row=>row.roleId===item.id)) result.approvals.push({...createItem('approval'),roleId:item.id,role:item.label,responsibility:`评审本职责范围内的变更影响及控制条件`,version:result.meta.version});
  result.classification.categories=unique([...result.classification.categories,...evaluation.effectiveCategories]);
  if (JSON.stringify(result)===JSON.stringify(refreshed)) return refreshed;
  if (postApproval(result.meta.status)) invalidate(result,'本机记录人','生成／调整建议清单后重新评估和审批。',now);
  addAudit(result,'suggestions_added','本机记录人','根据类别与影响补充文件、培训和评审角色；待专业人员确认。',now);
  return result;
}

export function createDemo(config,now) {
  let result=createRecord(config,now), demo=config.demoCase;
  for(const key of ['meta','changeSummary','classification','pssr']) result[key]={...result[key],...clone(demo[key]||{})};
  result.screening={...result.screening,...clone(demo.screening||{}),replacementComparisons:result.screening.replacementComparisons.map(item=>({...item,...demo.screening.replacementComparisons.find(row=>row.id===item.id)}))};
  result.impactDomains=result.impactDomains.map(item=>({...item,...demo.impactDomains.find(row=>row.id===item.id)}));
  const due=day(new Date(dateOf(now).getTime()+7*86400000));
  result.changeSummary.plannedStart=due;
  result.implementation.plan='检修窗口内实施；施工前落实隔离、专业复核及批准，完成安装测试、文件更新、培训和 PSSR 后再申请投用授权。';
  result.riskItems=demo.riskItems.map(item=>({...createItem('risk'),...clone(item),owner:'待指定专业负责人',due,acceptanceNote:'演示残余风险仅用于填写示范，必须结合实测和专业评审重新确认。'}));
  result.actions=result.riskItems.map(item=>({...createItem('action'),title:item.additionalMeasures,riskId:item.id,owner:'待指定专业负责人',due,evidenceRequirement:'专业复核记录、试验／检查结果及确认依据'}));
  result=applySuggestions(result,config,now);
  addAudit(result,'demo_loaded','本机记录人','加载完全虚构循环泵示例，空白项及风险数值需要专业核查。',now);
  return result;
}

export function copyRecord(record,config,now) {
  const result=clone(record), fresh=createRecord(config,now);
  result.meta={...fresh.meta,title:`${record.meta.title}（副本）`.slice(0,200)};
  result.screening.expiredAt='';result.screening.expiryReview=clone(fresh.screening.expiryReview);
  result.screening.replacementConfirmedBy='';result.screening.replacementConfirmedAt='';
  result.screening.emergencyAuthorizationBy='';result.screening.emergencyAuthorizationAt='';result.screening.emergencyAuthorizationEvidence='';result.screening.formalizedAt='';
  for (const key of ['riskItems','actions','documents','training']) for(const item of result[key]) {item.status='open';item.evidence='';if(Object.hasOwn(item,'approvedBy'))item.approvedBy='';}
  for(const item of result.actions) {item.postStartupApprovedBy='';item.postStartupApprovedAt='';}
  for(const item of result.approvals) {item.conclusion='pending';item.date='';item.evidence='';item.version=1;}
  result.pssr={...fresh.pssr,required:record.pssr.required,rationale:record.pssr.rationale};
  result.implementation={...fresh.implementation,plan:record.implementation.plan};
  result.verification=clone(fresh.verification);result.auditTrail=fresh.auditTrail;
  addAudit(result,'copied','本机记录人',`由 ${record.meta.id} 复制为新草稿；批准、投用及完成证据须重新确认。`,now);
  return refreshExpiry(result,config,now);
}

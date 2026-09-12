import { loadConfig, createRecord, createDemo, createItem, evaluate, updateRecord, transition, refreshExpiry, copyRecord, applySuggestions, riskScore, STATUS_LABELS } from './moc-engine.mjs';
import { saveRecord, loadRecord, clearRecord, importRecord, STORAGE_KEY } from './moc-storage.mjs';
import { exportJSON, exportActionsCSV, exportLedgerCSV, exportFilename } from './moc-export.mjs';

const $ = id => document.getElementById(id);
const STEPS = [
  ['变更边界','先把变更前后说清楚','描述变化和理由，再对照关键属性。暂时不确定的内容可以保留，准备度检查会提示下一步。'],
  ['分类分级','找到需要参与判断的专业','类别可以多选。分级是辅助建议；安全关键变化需要更充分的专业评审。'],
  ['影响筛查','逐个检查可能受影响的环节','每个影响域都需要确认。“有影响”或“不确定”时，请写明需要验证的内容。'],
  ['风险与措施','把风险转成可执行的控制措施','分别记录初始风险与预计残余风险。措施只有完成并留下证据后，才能作为投用依据。'],
  ['审批准备','让线下评审有完整的依据','按影响生成建议评审角色，录入实际评审结果。这里的批准仅是线下结果记录，不构成电子签章。'],
  ['实施与投用','在启动之前逐项确认','跟踪行动、文件和培训，明确启动前安全检查（PSSR）适用性。门禁满足后，才可录入投用授权。'],
  ['验证关闭','用实际结果完成闭环','核对批准范围、运行效果与新风险，完成遗留项并保存关闭证据。临时变更不能因到期自动关闭。']
];
const BOOL = [[null,'待专业确认'],[true,'需要'],[false,'不需要（须说明依据）']];
const YESNO = [['unknown','待确认'],['yes','是'],['no','否']];
const COMPLETION = [['open','待完成'],['in_progress','进行中'],['done','已完成']];
const GATES = [['before_approval','批准前完成'],['before_implementation','实施前完成'],['before_startup','投用前完成'],['after_startup','投用后允许完成']];
const HIERARCHY = [['elimination','消除'],['substitution','替代'],['engineering','工程控制'],['administrative','管理控制'],['ppe','个体防护']];
let config, record, step = 0, actor = '', note = '', timer, lastError = '', storageLocked = false, originalStorage = null;

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (value !== null && value !== undefined && value !== false) el.setAttribute(key,value === true ? '' : String(value));
  }
  children.flat(Infinity).forEach(child => { if(child !== null && child !== undefined) el.append(child instanceof Node ? child : document.createTextNode(String(child))); });
  return el;
}
const pendingEdits=new Map();let saveTimer;
function flushPending(){clearTimeout(saveTimer);const edits=[...pendingEdits];pendingEdits.clear();for(const [path,value] of edits)commit(path,value);}
const get = path => path.split('.').reduce((obj,key) => obj?.[key], record);
const idFor = path => 'field-' + path.replaceAll('.','-');
const button = (label, fn, cls = 'secondary') => h('button',{type:'button',class:'moc-btn '+cls,onclick:fn},label);
const paragraph = text => h('p',{},text);
const notice = (text, type = '') => h('div',{class:'moc-notice '+type},text);
const grid = (...children) => h('div',{class:'moc-grid'},...children);
function section(title, intro, ...children) { return h('section',{class:'moc-subsection'},h('h3',{},title),intro ? paragraph(intro) : null,...children); }
function details(title, ...children) { return h('details',{},h('summary',{},title),...children); }
function persist() {
  if(storageLocked){$('save-status').textContent='原存储已保留 · 当前草稿尚未保存，请先恢复备份或确认新建';return;}
  const result = saveRecord(record);
  $('save-status').textContent = result.ok ? '已保存至此浏览器 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : result.error;
  if (!result.ok) $('save-status').setAttribute('role','alert');
  else $('save-status').setAttribute('role','status');
}
function error(message, field) {
  lastError=message;
  const box=$('validation'); box.hidden=false; box.replaceChildren(h('strong',{},'请先完成以下核对'),paragraph(message));
  if (field) { const node=$(idFor(field)); if(node){node.setAttribute('aria-invalid','true');node.setAttribute('aria-describedby','validation');} }
}
function clearError(){lastError='';$('validation').hidden=true;}
function commit(path,value,rerender=false) {
  try {
    const previous=record.meta.status;
    record=updateRecord(record,path,value,actor.trim()||record.changeSummary.owner||'本机记录人',config);
    record=refreshExpiry(record,config); persist();clearError();renderSummary();
    if(path==='pssr.required'){record=updateRecord(record,'pssr.status',value===false?'not_required':'not_started',actor||'本机记录人',config);persist();}
    if(rerender) {const focused=idFor(path);renderForm();$(focused)?.focus();}
    renderDerived();
    if(path.startsWith('riskItems.')){document.querySelectorAll('[data-score-index]').forEach(el=>el.textContent=scoreText(record.riskItems[Number(el.dataset.scoreIndex)]));}
    if(previous!==record.meta.status) error('记录状态已更新为“'+label(record.meta.status)+'”。范围或关键内容改变后，需要重新评估并录入审批依据。');
  } catch(err) {const input=$(idFor(path));if(input){if(input.type==='checkbox')input.checked=Boolean(get(path));else input.value=get(path)===null?'null':String(get(path)??'');} error(err.message,path); }
}
function field(path,title,options={}) {
  const value=get(path), id=idFor(path);
  const attrs={id,'data-field':path,required:options.required,'aria-required':options.required?'true':null,maxlength:options.long?4000:500};
  let input;
  if(options.choices) {
    input=h('select',attrs,...options.choices.map(([v,text])=>h('option',{value:v===null?'null':String(v)},text)));
    input.value=value===null?'null':String(value??'');
  } else if(options.long) {input=h('textarea',{...attrs,rows:3});input.value=value??'';}
  else {input=h('input',{...attrs,type:options.type||'text'});input.value=value??'';}
  if(!options.choices)input.addEventListener('input',()=>{pendingEdits.set(path,input.value);$('save-status').textContent='正在保存…';clearTimeout(saveTimer);saveTimer=setTimeout(flushPending,200);});
  input.addEventListener('change',()=>{
    pendingEdits.delete(path);
    let v=input.value;
    if(options.boolean) v=v==='null'?null:v==='true';
    if(options.numeric) v=v===''?'':Number(v);
    commit(path,v,Boolean(options.refresh));
  });
  return h('label',{class:'moc-field'+(options.wide?' wide':''),for:id},h('span',{},title,options.required?h('span',{class:'moc-required','aria-label':'必填'},' *'):null),input,options.hint?h('small',{},options.hint):null);
}
function check(path,title,refresh=false) {
  const input=h('input',{type:'checkbox',id:idFor(path),'data-field':path});input.checked=Boolean(get(path));
  input.addEventListener('change',()=>commit(path,input.checked,refresh));
  return h('label',{class:'moc-check',for:idFor(path)},input,title);
}
function multi(path,items) {return h('div',{class:'moc-checks'},...items.map(item=>{
  const input=h('input',{type:'checkbox',value:item.id,id:idFor(path)+item.id});input.checked=get(path).includes(item.id);
  input.addEventListener('change',()=>commit(path,input.checked?[...get(path),item.id]:get(path).filter(id=>id!==item.id),true));
  return h('label',{class:'moc-check',for:input.id},input,item.label);
}));}
function label(value){return STATUS_LABELS[value]||value;}
function refresh(){flushPending();record=refreshExpiry(record,config);persist();renderSummary();}
function renderSummary(){
  const ev=evaluate(record,config), blockers=step<4?ev.approvalBlockers:step===4?ev.approvalBlockers:step===5?ev.startupBlockers:ev.closeBlockers;
  $('status-badge').textContent=label(record.meta.status);
  const row=(key,value)=>h('div',{class:'moc-summary-row'},h('span',{},key),h('b',{},value));
  $('record-summary').replaceChildren(
    h('p',{class:'moc-record-id'},record.meta.id+' / v'+record.meta.version),h('h3',{class:'moc-record-title'},record.meta.title||'尚未命名的变更'),
    row('建议等级',ev.level.label),row('期限类别',record.screening.durationType==='temporary'?'临时变更':'永久变更'),
    ...(record.screening.durationType==='temporary'?[row('临时到期日',record.screening.temporaryExpiry||'待填写')]:[]),
    h('div',{class:'moc-blockers'},h('div',{class:'moc-gate-count'},blockers.length?'! '+blockers.length+' 项待核对':'✓ 当前准备项已满足，仍需线下确认'),
      h('ul',{class:'moc-blocker-list'},...blockers.slice(0,5).map(text=>h('li',{},text))),blockers.length>5?details('查看其余 '+(blockers.length-5)+' 项',h('ul',{class:'moc-blocker-list'},...blockers.slice(5).map(text=>h('li',{},text)))):null,
      ...ev.warnings.map(text=>notice(text)),
      details('同类替换与分级理由',paragraph(ev.replacement.label),...ev.replacement.reasons.map(paragraph),paragraph(ev.level.label),...ev.level.reasons.map(paragraph)))
  );
}
function navigate(index,focus=true){flushPending();step=index;clearError();renderForm();renderSummary();renderSteps();if(focus){$('step-title').focus();$('steps').scrollIntoView({behavior:'auto',block:'start'});}}
function renderSteps(){
  $('steps').replaceChildren(...STEPS.map((item,i)=>h('button',{type:'button',class:'moc-step','aria-current':i===step?'step':null,onclick:()=>navigate(i)},h('span',{'aria-hidden':'true'},String(i+1).padStart(2,'0')),item[0])));
  $('previous-step').disabled=step===0;$('next-step').hidden=step===6;$('step-count').textContent=(step+1)+' / 7';
}
function basic(){
  return [grid(field('meta.title','变更名称',{required:true,wide:true}),field('changeSummary.area','所属装置 / 区域',{required:true}),field('changeSummary.plannedStart','拟实施日期',{type:'date',required:true}),field('changeSummary.before','变更前',{long:true,required:true}),field('changeSummary.after','变更后',{long:true,required:true}),field('changeSummary.reason','变更原因',{long:true,required:true}),field('changeSummary.expectedResult','预期效果',{long:true,required:true}),field('changeSummary.applicant','申请人 / 岗位代称',{required:true}),field('changeSummary.owner','变更负责人 / 岗位代称',{required:true})),
    section('期限与实施情形','临时和应急是两个独立维度。',grid(field('screening.durationType','期限类别',{choices:[['permanent','永久'],['temporary','临时']],refresh:true}),check('screening.emergency','属于应急变更',true)),
      record.screening.durationType==='temporary'?grid(field('screening.temporaryExpiry','临时到期日',{type:'date',required:true}),field('screening.restorationPlan','恢复方案',{long:true,required:true})):null,
      record.screening.emergency?section('应急实施前控制','先控制风险并取得授权，实施后检查效果并尽快补齐正式记录。AQ/T 3034-2022 给出一般不超过 48 小时的补办要求。',grid(field('screening.emergencyReason','紧急理由',{long:true,required:true}),field('screening.minimumControls','实施前最低控制',{long:true,required:true}),field('screening.emergencyAuthorizationBy','实施前授权人',{required:true}),field('screening.emergencyAuthorizationAt','授权时间',{type:'datetime-local',required:true}),field('screening.emergencyAuthorizationEvidence','授权依据',{long:true,required:true}),field('screening.formalizedAt','正式手续补齐时间',{type:'datetime-local'}))):null),
    section('同类替换诊断','逐项对照关键属性；“相同”或“不适用”都需要依据。属性改变或证据不足时不能直接判定同类替换。',notice(evaluate(record,config).replacement.label),
      details('展开逐项对比（'+record.screening.replacementComparisons.length+' 项）',...record.screening.replacementComparisons.map((item,i)=>h('div',{class:'moc-item'},grid(field('screening.replacementComparisons.'+i+'.result',item.label,{choices:[['unknown','信息不足'],['same','完全相同'],['changed','发生改变'],['na','不适用（需依据）']]}),field('screening.replacementComparisons.'+i+'.evidence','对比证据 / 不适用依据',{long:true}))))),
      grid(field('screening.rationale','整体判断依据',{long:true,wide:true}),field('screening.replacementConfirmedBy','同类替换确认人'),field('screening.replacementConfirmedAt','确认日期',{type:'date'})))];
}
function classification(){const ev=evaluate(record,config);return [
  section('涉及哪些专业','可多选；组织和程序变化也可能改变安全边界。',multi('classification.categories',config.categories.items)),
  grid(field('classification.scope','影响范围',{choices:[['','请选择'],...config.categories.scopes.map(x=>[x.id,x.label])],required:true}),field('classification.confirmedLevel','企业确认等级',{choices:[['','待企业确认'],['general','一般'],['important','重要'],['needs_review','需人工判定']]})),
  section('关键触发器','命中后至少建议重要变更。该建议不代替企业的最终分级。',multi('classification.triggers',config.criticalTriggers.items)),
  notice(ev.level.label+'：'+(ev.level.reasons.join('；')||'请完成分类与触发器筛查。')),
  section('建议分析方法','可使用现有工具开展专项分析，再回填结论；会员工具按现有权益开放。',...ev.suggestedMethods.map(x=>h('div',{class:'moc-ref'},h('b',{},x.label),paragraph(x.when),x.url?h('a',{href:x.url},'打开相关方法 / 工具 ↗'):null)),
    field('changeSummary.technicalBasis','技术依据与专项分析结论摘要',{long:true,wide:true,required:true}))];}
function impacts(){return [notice('“不确定”不会被视为无影响。请说明不确定之处，安排相应专业人员核实。'),...record.impactDomains.map((item,i)=>{
  const prompt=config.impactPrompts.items.find(x=>x.id===item.id);return h('section',{class:'moc-item'},h('h3',{},String(i+1).padStart(2,'0')+' / '+item.label),details('辅助追问',h('ul',{class:'moc-question-list'},...(prompt?.questions||[]).map(q=>h('li',{},q)))),grid(field('impactDomains.'+i+'.status','影响判断',{choices:[['unknown','不确定'],['affected','有影响'],['none','无影响']]}),field('impactDomains.'+i+'.explanation','影响说明 / 待核实问题',{long:true,hint:'有影响或不确定时必填。'})));})];}
function addItem(key,type){
  const item=createItem(type); if(type==='approval') item.version=record.meta.version;
  commit(key,[...record[key],item],true);
  const target=document.querySelector('[data-item-id="'+item.id+'"]');if(target){target.open=true;target.scrollIntoView({block:'start'});target.querySelector('input,select,textarea')?.focus();}
}
function removeItem(key,index){if(confirm('移除此条目？已批准记录的关键内容变化会触发重新评估。'))commit(key,record[key].filter((_,i)=>i!==index),true);}
function itemCard(key,i,title,children){const item=record[key][i];return h('details',{class:'moc-item','data-item-id':item.id,open:record[key].length===1},h('summary',{},String(i+1).padStart(2,'0')+' · '+title),...children,button('移除此条目',()=>removeItem(key,i),'quiet danger'));}
function scoreText(item){const initial=riskScore(item.initialLikelihood,item.initialSeverity,config.riskMatrix),residual=riskScore(item.residualLikelihood,item.residualSeverity,config.riskMatrix);return '初始风险：'+(initial?initial.label+' / '+initial.score:'待填写')+'　→　预计残余风险：'+(residual?residual.label+' / '+residual.score:'待填写');}
function matrix(){const m=config.riskMatrix;const likelihood=m.likelihood.map(x=>[x.value,x.label]),severity=m.severity.map(x=>[x.value,x.label]);return details('查看 5×5 演示矩阵与接受规则',paragraph(m.label+'；演示值不代表企业标准。严重度取各后果维度最高值。'),h('table',{class:'moc-matrix'},h('caption',{},'行：可能性；列：严重度。得分 = 可能性 × 严重度。'),h('thead',{},h('tr',{},h('th',{scope:'col'},'L / S'),...severity.map(([n])=>h('th',{scope:'col'},n)))),h('tbody',{},...likelihood.map(([n])=>h('tr',{},h('th',{scope:'row'},n),...severity.map(([v])=>{const s=riskScore(n,v,m);return h('td',{class:s.level},s.score+' '+s.label);}))))),...m.bands.map(x=>paragraph(x.label+'：'+x.min+'–'+x.max)),paragraph('极高风险必须降低后再评估；高风险需要风险接受人及专业评审。矩阵与接受权限须由企业确认。'));}
function risks(){const nums=items=>[['','请选择'],...items.map(x=>[x.value,x.label])];const l=nums(config.riskMatrix.likelihood),s=nums(config.riskMatrix.severity);return [notice('当前使用 5×5 演示配置。未填写残余风险、极高残余风险或缺少必要专业评审时，不能进入审批准备。'),matrix(),...record.riskItems.map((item,i)=>{
  const p='riskItems.'+i+'.';return itemCard('riskItems',i,item.scenario||'未命名风险',[
    grid(field(p+'scenario','偏差 / 危险情景',{long:true,required:true,wide:true}),field(p+'cause','原因',{long:true,required:true}),field(p+'consequence','后果',{long:true,required:true}),field(p+'affected','受影响对象',{required:true}),field(p+'existingControls','现有控制',{long:true,required:true})),
    section('初始风险','先按现有控制评价，严重度取四个维度最高值。',grid(field(p+'initialLikelihood','初始可能性',{choices:l,numeric:true,required:true}),...Object.entries({people:'人员',environment:'环境',asset:'资产',reputation:'声誉'}).map(([k,v])=>field(p+'initialSeverity.'+k,v+'后果严重度',{choices:s,numeric:true,required:true})))),
    section('附加控制与验证','记录控制措施及完成证据，残余风险是预计值，投用时须验证。',grid(field(p+'additionalMeasures','附加措施',{long:true,required:true,wide:true}),field(p+'hierarchy','措施层级',{choices:HIERARCHY}),field(p+'gate','完成门禁',{choices:GATES}),field(p+'owner','措施责任人',{required:true}),field(p+'due','截止日期',{type:'date',required:true}),field(p+'status','措施状态',{choices:COMPLETION}),check(p+'safetyCritical','安全关键措施'),field(p+'evidence','措施完成证据',{long:true,wide:true}),field(p+'residualLikelihood','残余可能性',{choices:l,numeric:true,required:true}),field(p+'residualSeverity','残余最高严重度',{choices:s,numeric:true,required:true}),field(p+'acceptanceBy','风险接受人',{required:true}),field(p+'acceptanceNote','风险接受说明',{long:true}),field(p+'professionalReview','高风险专业评审依据',{long:true,wide:true}))),
    h('p',{class:'moc-score','data-score-index':i},scoreText(item))
  ]);}),button('＋ 添加风险条目',()=>addItem('riskItems','risk')),section('继续准备线下评审','下一步汇总实施计划、评审角色、文件和培训准备项。',button('继续审批准备 →',()=>navigate(4)))];}
function stateOperator(){
  const a=h('input',{id:'record-actor',type:'text',maxlength:100});a.value=actor;a.addEventListener('input',()=>actor=a.value);
  const n=h('textarea',{id:'transition-note',rows:2,maxlength:1000});n.value=note;n.addEventListener('input',()=>note=n.value);
  return grid(h('label',{class:'moc-field',for:'record-actor'},'本次记录人（状态操作必填）',a),h('label',{class:'moc-field',for:'transition-note'},'本次操作备注 / 依据（必填）',n));
}
function stateButtons(items){return h('div',{class:'moc-toolbar moc-state-controls'},...items.map(([target,text])=>button(text,()=>{
  try{record=transition(record,target,actor,note,config);persist();clearError();renderForm();renderSummary();$('save-status').textContent='已记录：'+label(record.meta.status)+' · 线下结果';}
  catch(err){error(err.message);$('validation').focus();}
})));}
function gates(blockers,key){const el=blockers.length?notice(h('div',{},h('strong',{},blockers.length+' 项待核对'),h('ul',{},...blockers.map(x=>h('li',{},x))))):notice('✓ 当前准备项已满足，实际批准与投用由企业授权人员确认。','success');if(key)el.dataset.gatePanel=key;return el;}
function renderDerived(){const ev=evaluate(record,config);document.querySelectorAll('[data-gate-panel]').forEach(el=>el.replaceWith(gates(ev[el.dataset.gatePanel],el.dataset.gatePanel)));}
function suggestions(){try{record=applySuggestions(record,config);persist();renderForm();renderSummary();}catch(err){error(err.message);}}
function approvals(){const ev=evaluate(record,config);return [
  gates(ev.approvalBlockers,'approvalBlockers'),button('生成 / 补充建议评审与准备清单',suggestions),notice('建议角色：'+ev.suggestedRoles.map(x=>x.label).join('、')+'。按实际受影响专业补充，企业最终批准权限另行确认。'),
  ...record.approvals.map((item,i)=>{const p='approvals.'+i+'.';return itemCard('approvals',i,item.role||'新增评审角色',[grid(field(p+'role','评审角色',{required:true}),field(p+'name','姓名 / 岗位代称',{required:true}),field(p+'responsibility','评审职责',{long:true}),field(p+'opinion','评审意见',{long:true,required:true}),field(p+'conclusion','线下结论',{choices:[['pending','待评审'],['approved','同意'],['rejected','不同意']]}),field(p+'date','评审日期',{type:'date',required:true}),field(p+'evidence','线下批准依据 / 文件编号',{long:true,required:true,wide:true})),paragraph('对应记录版本：v'+item.version)]);}),button('＋ 添加评审角色',()=>addItem('approvals','approval')),
  section('实施与投用准备计划','审批前先明确实施方案、文件更新、培训沟通及 PSSR 适用性；完成状态可在实施阶段继续更新。',field('implementation.plan','实施方案',{long:true,wide:true,required:true}),details('文件更新计划',documents()),details('培训与沟通计划',training()),grid(field('pssr.required','专业确认是否需要 PSSR',{choices:BOOL,boolean:true,refresh:true,required:true}),field('pssr.confirmedBy','适用性确认人',{required:true}),field('pssr.confirmedAt','适用性确认日期',{type:'date',required:true}),field('pssr.rationale','判定依据 / 不适用理由',{long:true,required:true}))),
  section('线下审批结果登记','先完成评估，再记录待审批与已批准状态。版本改变后，原批准结果不再有效。',stateOperator(),stateButtons([['assessed','记录评估完成'],['pending_approval','进入待审批'],['approved','录入线下批准结果'],['rejected','记录评审拒绝']]))];}
function actions(){return section('行动清单','安全关键项不得转为投用后完成。普通遗留项也须书面依据、责任人、期限及批准记录。',...record.actions.map((item,i)=>{const p='actions.'+i+'.';return itemCard('actions',i,item.title||'新增行动',[grid(field(p+'title','行动内容',{long:true,required:true,wide:true}),field(p+'riskId','关联风险编号'),field(p+'gate','完成门禁',{choices:GATES,refresh:true}),check(p+'safetyCritical','安全关键行动'),field(p+'owner','责任人',{required:true}),field(p+'due','截止日期',{type:'date',required:true}),field(p+'status','状态',{choices:COMPLETION}),field(p+'evidenceRequirement','要求的完成证据',{long:true,required:true}),field(p+'evidence','实际完成证据',{long:true})),item.gate==='after_startup'?grid(field(p+'postStartupBasis','允许投用后完成的书面依据',{long:true,required:true}),field(p+'postStartupApprovedBy','批准人',{required:true}),field(p+'postStartupApprovedAt','批准日期',{type:'date',required:true})):null]);}),button('＋ 添加行动项',()=>addItem('actions','action')));}
function documents(){return section('文件更新清单','建议从分类与影响生成，再按企业要求确认和补充。',...record.documents.map((item,i)=>{const p='documents.'+i+'.';return itemCard('documents',i,item.title||'新增文件',[grid(field(p+'title','文件名称',{required:true,wide:true}),check(p+'required','必需文件'),field(p+'owner','负责人'),field(p+'due','期限',{type:'date'}),field(p+'status','更新状态',{choices:COMPLETION}),field(p+'approvedBy','文件批准人'),field(p+'evidence','更新 / 批准证据',{long:true,wide:true}))]);}),button('＋ 添加文件',()=>addItem('documents','document')));}
function training(){return section('培训与沟通','覆盖操作、检维修、工程、承包商及其他受影响方。',...record.training.map((item,i)=>{const p='training.'+i+'.';return itemCard('training',i,item.audience||'新增培训沟通',[grid(field(p+'audience','对象',{required:true}),field(p+'content','内容',{long:true,required:true}),field(p+'method','方式'),field(p+'date','日期',{type:'date'}),field(p+'trainer','讲师 / 沟通人'),field(p+'status','完成状态',{choices:COMPLETION}),check(p+'required','必须完成的培训 / 沟通'),field(p+'evidence','完成证据',{long:true,wide:true}))]);}),button('＋ 添加培训 / 沟通',()=>addItem('training','training')));}
function startup(){const ev=evaluate(record,config);return [
  gates(ev.startupBlockers,'startupBlockers'),button('生成 / 补充文件、培训与评审清单',suggestions),
  section('实施计划与实际结果','实施前门禁、启动前门禁分别核对。应急补办提示从实际实施时间计算。',grid(field('implementation.plan','实施方案',{long:true,wide:true,required:true}),field('implementation.actualStart','实际开始时间',{type:'datetime-local'}),field('implementation.actualEnd','实际结束时间',{type:'datetime-local'}),field('implementation.result','实施结果',{long:true,wide:true}))),
  actions(),documents(),training(),
  section('启动前安全检查（PSSR）',ev.pssrRecommendation.label+'；'+ev.pssrRecommendation.reasons.join('；'),
    grid(field('pssr.required','专业确认是否需要 PSSR',{choices:BOOL,boolean:true,refresh:true,required:true}),field('pssr.confirmedBy','适用性确认人',{required:true}),field('pssr.confirmedAt','适用性确认日期',{type:'date',required:true}),field('pssr.rationale','判定依据 / 不适用理由',{long:true,required:true})),
    record.pssr.required!==false?grid(field('pssr.status','PSSR 状态',{choices:[['not_started','未开始'],['in_progress','检查中'],['passed','检查通过']]}),field('pssr.passedBy','检查通过确认人'),field('pssr.passedAt','检查通过日期',{type:'date'}),field('pssr.evidence','PSSR 检查记录与关闭证据',{long:true,wide:true})):null,
    button('生成 PSSR 检查任务',()=>{const item=createItem('action');item.title='完成启动前安全检查（PSSR）并确认遗留项';item.evidenceRequirement='PSSR 签认清单、现场检查与问题关闭记录';commit('actions',[...record.actions,item],true);}),h('p',{},h('a',{href:'../articles/pssr-pre-startup-safety-review-checklist.html'},'阅读 PSSR 检查指南 ↗'))),
  section('线下投用授权','PSSR 未通过或必要准备未完成时，不能记录有效投用授权。',grid(field('implementation.startupAuthorizedBy','投用授权人'),field('implementation.startupAuthorizedAt','投用授权时间',{type:'datetime-local'}),field('implementation.startupAuthorizationEvidence','投用授权依据',{long:true,wide:true}))),
  section('实施与投用状态登记','状态推进时重新检查门禁；不能跳过线下批准。',stateOperator(),stateButtons([['implementing','记录开始实施'],['ready_for_startup','确认投用准备就绪'],['in_service','记录已投用'],['verification_due','进入效果验证']]))];}
function closing(){const ev=evaluate(record,config);return [gates(ev.closeBlockers,'closeBlockers'),grid(field('verification.scopeMatches','实施与批准范围一致？',{choices:YESNO,required:true}),field('verification.effectsAchieved','预期效果达到？',{choices:YESNO,required:true}),field('verification.newRisks','是否出现新风险 / 偏差？',{choices:YESNO,required:true}),field('verification.verifiedBy','独立验证人',{required:true}),field('verification.verifiedAt','验证日期',{type:'date',required:true}),field('verification.evidence','运行数据 / 检查证据',{long:true,required:true}),field('verification.feedback','经验反馈 / 程序修订 / 重新开启理由',{long:true,wide:true}),field('verification.closeReason','关闭理由',{long:true,required:true,wide:true})),
  record.screening.durationType==='temporary'?section('临时变更处置','到期未恢复且未经重新评审会阻断。转永久必须关联新的正式评审；重新申请本身不代表可以关闭。',grid(field('verification.temporaryOutcome','临时变更结果',{choices:[['','待处置'],['restored','已恢复原状'],['permanent','转为永久（须关联评审）'],['new_review','申请新的评审']],refresh:true}),field('verification.restorationEvidence','恢复确认依据',{long:true}),field('verification.permanentReviewId','关联永久变更 / 新评审编号'),field('verification.permanentReviewEvidence','关联评审及批准依据',{long:true})),details('到期后重新评审 / 延期记录',grid(field('screening.expiryReview.by','重新评审批准人'),field('screening.expiryReview.date','重新评审日期',{type:'date'}),field('screening.expiryReview.evidence','评审批准依据',{long:true}),field('screening.expiryReview.newExpiry','重新批准的到期日',{type:'date'})))):null,
  section('关闭与异常状态登记','关闭、取消、重新开启都需备注并写入本地审计轨迹。',stateOperator(),stateButtons([['verification_due','记录待验证'],['closed','记录验证完成并关闭'],['reopened','重新开启 / 进入重评'],['cancelled','取消本次变更']])),
  section('本地审计轨迹','审计记录便于自查，不属于防篡改电子签批证据。',h('ol',{class:'moc-audit'},...record.auditTrail.slice().reverse().map(item=>h('li',{},h('time',{},item.at||item.time||''),' · '+(item.actor||'')+' · '+auditAction(item.action||''),h('div',{},auditNote(item.note||item.reason||''))))))];}
function renderForm(){
  const openDetails=new Set([...$('form-content').querySelectorAll('details[open]')].map(el=>el.dataset.itemId||el.querySelector('summary')?.textContent));
  $('step-number').textContent='STEP '+String(step+1).padStart(2,'0')+' / 07';$('step-title').textContent=STEPS[step][1];$('step-intro').textContent=STEPS[step][2];
  $('form-content').replaceChildren(...(['approved','implementing','ready_for_startup','in_service','verification_due'].includes(record.meta.status)?[notice('当前版本已录入线下批准。修改范围、方案或关键控制会使原批准失效；如需保留完整旧版本，请先导出 JSON 备份。')]:[]),...[basic,classification,impacts,risks,approvals,startup,closing][step]().filter(item=>item!=null));
  $('form-content').querySelectorAll('details').forEach(el=>{if(openDetails.has(el.dataset.itemId||el.querySelector('summary')?.textContent))el.open=true;});
}

const FIELD_LABELS={id:'编号',templateId:'模板类型',targetId:'对象类型',title:'名称',version:'版本',schemaVersion:'数据结构版本',status:'状态',approvedVersion:'批准对应版本',createdAt:'创建时间',updatedAt:'更新时间',area:'装置 / 区域',before:'变更前',after:'变更后',reason:'原因',expectedResult:'预期效果',plannedStart:'拟实施日期',applicant:'申请人',owner:'责任人',technicalBasis:'技术依据与分析结论',result:'判断 / 实施结果',evidence:'证据',rationale:'判定依据',replacementConfirmedBy:'同类替换确认人',replacementConfirmedAt:'同类替换确认日期',durationType:'期限类别',temporaryExpiry:'到期日',restorationPlan:'恢复方案',emergency:'应急变更',emergencyReason:'紧急理由',minimumControls:'实施前最低控制',emergencyAuthorizationBy:'应急授权人',emergencyAuthorizationAt:'应急授权时间',emergencyAuthorizationEvidence:'应急授权依据',formalizedAt:'补办完成时间',expiredAt:'记录到期时间',categories:'专业类别',scope:'影响范围',suggestedLevel:'建议等级',confirmedLevel:'企业确认等级',triggers:'关键触发器',suggestedMethods:'建议方法',label:'项目',explanation:'影响说明',scenario:'危险情景',cause:'原因',consequence:'后果',affected:'受影响对象',existingControls:'现有控制',initialLikelihood:'初始可能性',initialSeverity:'初始严重度',people:'人员',environment:'环境',asset:'资产',reputation:'声誉',additionalMeasures:'附加措施',hierarchy:'措施层级',due:'截止日期',residualLikelihood:'残余可能性',residualSeverity:'残余最高严重度',acceptanceBy:'风险接受人',acceptanceNote:'接受说明',professionalReview:'专业评审依据',safetyCritical:'安全关键项',gate:'完成门禁',riskId:'关联风险',evidenceRequirement:'证据要求',postStartupBasis:'投用后完成依据',postStartupApprovedBy:'遗留项批准人',postStartupApprovedAt:'遗留项批准日期',required:'是否必需',approvedBy:'批准人',audience:'培训 / 沟通对象',content:'培训内容',method:'培训方式',date:'日期',trainer:'讲师 / 沟通人',role:'评审角色',roleId:'角色标识',name:'姓名 / 岗位代称',responsibility:'职责',opinion:'评审意见',conclusion:'评审结论',confirmedBy:'适用性确认人',confirmedAt:'适用性确认日期',passedBy:'PSSR通过确认人',passedAt:'PSSR通过日期',plan:'实施计划',actualStart:'实际开始时间',actualEnd:'实际结束时间',startupAuthorizedBy:'投用授权人',startupAuthorizedAt:'投用授权时间',startupAuthorizationEvidence:'投用授权依据',scopeMatches:'是否与批准范围一致',effectsAchieved:'是否达到预期效果',newRisks:'是否出现新风险',verifiedBy:'验证人',verifiedAt:'验证日期',feedback:'经验反馈',temporaryOutcome:'临时处置结果',restorationEvidence:'恢复证据',permanentReviewId:'关联新评审编号',permanentReviewEvidence:'关联新评审依据',closeReason:'关闭理由',by:'重新评审人',newExpiry:'重新批准到期日',impact:'影响',at:'时间',time:'时间',actor:'记录人',action:'动作',note:'备注',from:'原状态',to:'新状态'};
Object.assign(FIELD_LABELS,{expiryReview:'到期重新评审',determination:'系统判断',replacementComparisons:'同类替换对比',riskItems:'风险条目',actions:'行动清单',documents:'文件清单',training:'培训沟通',approvals:'线下评审',classification:'分类分级',screening:'边界诊断',changeSummary:'变更说明',implementation:'实施投用',verification:'验证关闭',meta:'记录信息',pssr:'PSSR',impactDomains:'影响筛查'});
function auditAction(value){if(value?.startsWith('status:'))return value.slice(7).split('->').map(label).join(' → ');return {created:'创建草稿',field_updated:'更新字段',approval_invalidated:'原批准失效',expired:'临时变更到期',suggestions_added:'补充建议清单',demo_loaded:'加载虚构示例',copied:'复制草稿',imported:'导入并要求复核'}[value]||value;}
function auditNote(value){return String(value||'').replace(/[A-Za-z]+(?:\.[A-Za-z0-9]+)+/g,path=>path.split('.').map(key=>/^\d+$/.test(key)?String(Number(key)+1):(FIELD_LABELS[key]||key)).join(' / '));}
const VALUE_LABELS={...Object.fromEntries([...COMPLETION,...GATES,...HIERARCHY,...YESNO]),same:'完全相同',changed:'发生改变',na:'不适用',none:'无影响',affected:'有影响',temporary:'临时',permanent:'永久',general:'一般',important:'重要',needs_review:'需人工判定',pending:'待评审',restored:'已恢复',new_review:'新的评审',not_started:'未开始',not_required:'不需要',passed:'通过'};
function display(value){if(value===null||value===undefined||value==='')return '未填写';if(typeof value==='boolean')return value?'是':'否';return VALUE_LABELS[value]||STATUS_LABELS[value]||String(value);}
function reportPairs(obj,prefix=''){
  const rows=[];
  for(const [key,value] of Object.entries(obj)){
    if(key==='replacementComparisons'||key==='auditTrail')continue;
    const title=(prefix?prefix+' / ':'')+(FIELD_LABELS[key]||key);
    if(Array.isArray(value))rows.push(h('div',{class:'moc-report-kv'},h('dt',{},title),h('dd',{},value.length?value.map(v=>display(v)).join('、'):'未填写')));
    else if(value&&typeof value==='object')rows.push(...reportPairs(value,title));
    else rows.push(h('div',{class:'moc-report-kv'},h('dt',{},title),h('dd',{},display(value))));
  }return rows;
}
function buildReport(){
  refresh();const ev=evaluate(record,config);const container=$('print-content');
  const allBlockers=[...new Set([...ev.approvalBlockers,...ev.startupBlockers,...ev.closeBlockers])];
  const section=(title,...children)=>h('section',{class:'moc-report-section'},h('h2',{},title),...children);
  const list=(title,items)=>section(title,items.length?items.map((item,i)=>h('article',{class:'moc-report-item'},h('h3',{},(i+1)+'. '+(item.scenario||item.title||item.audience||item.role||item.label||title)),h('dl',{},...reportPairs(item)),item.scenario?paragraph(scoreText(item)):null)):paragraph('未记录条目。请结合实际核对，不代表不适用。'));
  const cover=h('section',{class:'moc-report-cover'},h('p',{class:'moc-eyebrow'},'EHS-SIL · MOC 变更管理记录 · '+new Date().toLocaleDateString('zh-CN')),h('h1',{},record.meta.title||'未命名变更'),h('dl',{},...reportPairs({id:record.meta.id,version:record.meta.version,status:record.meta.status,area:record.changeSummary.area,categories:ev.effectiveCategories.map(id=>config.categories.items.find(x=>x.id===id)?.label||id),confirmedLevel:record.classification.confirmedLevel,before:record.changeSummary.before.length>350?record.changeSummary.before.slice(0,350)+'（完整内容见下一节）':record.changeSummary.before,after:record.changeSummary.after.length>350?record.changeSummary.after.slice(0,350)+'（完整内容见下一节）':record.changeSummary.after})),h('p',{},'建议等级：'+ev.level.label+'；'+ev.level.reasons.join('；')),h('p',{},'同类替换判断：'+ev.replacement.label),h('div',{class:'moc-report-note'},'本报告记录的是线下评审和授权结果，不构成电子签章。'+config.references.disclaimer));
  container.replaceChildren(cover,section('01 / 变更边界与分类',h('dl',{},...reportPairs(record.changeSummary),...reportPairs({...record.classification,categories:record.classification.categories.map(id=>config.categories.items.find(x=>x.id===id)?.label||id),triggers:record.classification.triggers.map(id=>config.criticalTriggers.items.find(x=>x.id===id)?.label||id)}),...reportPairs(record.screening))),section('02 / 准备度与阻断项',paragraph('审批 '+ev.approvalBlockers.length+' 项；投用 '+ev.startupBlockers.length+' 项；关闭 '+ev.closeBlockers.length+' 项。'),h('ul',{class:'moc-report-blockers'},...allBlockers.map(x=>h('li',{},x))),...ev.warnings.map(paragraph)),list('03 / 同类替换逐项对比',record.screening.replacementComparisons),list('04 / 影响筛查',record.impactDomains),list('05 / 风险与控制措施',record.riskItems),list('06 / 行动清单',record.actions),list('07 / 文件更新',record.documents),list('08 / 培训与沟通',record.training),list('09 / 线下审批记录',record.approvals),section('10 / PSSR 与实施投用',paragraph(ev.pssrRecommendation.label),h('dl',{},...reportPairs(record.pssr),...reportPairs(record.implementation))),section('11 / 验证与关闭',h('dl',{},...reportPairs(record.verification))),section('12 / 本地审计轨迹',paragraph('本地记录可被本机操作者修改，不属于防篡改证据。'),h('table',{class:'moc-report-audit'},h('thead',{},h('tr',{},...['时间','记录人','动作','备注'].map(x=>h('th',{scope:'col'},x)))),h('tbody',{},...record.auditTrail.map(item=>h('tr',{},h('td',{},item.at||item.time||''),h('td',{},item.actor||''),h('td',{},auditAction(item.action||'')),h('td',{},auditNote(item.note||item.reason||''))))))),section('13 / 配置与依据',paragraph(config.riskMatrix.label+'；演示矩阵须经企业确认。'),...config.riskMatrix.bands.map(x=>paragraph(x.label+'：'+x.min+'–'+x.max)),paragraph('公开依据复核日期：'+config.references.baseline),...config.references.sources.map(x=>h('div',{class:'moc-report-item'},h('h3',{},x.title),paragraph(x.scope),paragraph(x.note),paragraph(x.url))),h('p',{class:'moc-report-note'},config.references.disclaimer)));
  // The first page must surface blockers even if the detailed list spans later pages.
  cover.insertBefore(h('div',{class:'moc-report-note'},h('b',{},'当前阻断项：'+allBlockers.length+' 项'),h('ul',{},...allBlockers.slice(0,3).map(x=>h('li',{},x))),allBlockers.length>3?'其余见“准备度与阻断项”。':''),cover.lastChild);
}
function download(content,kind,mime){refresh();const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const anchor=h('a',{href:url,download:exportFilename(record,kind.includes('.')?kind.split('.').at(-1):kind).replace(/\.(csv)$/,kind==='actions.csv'?'_行动清单.csv':kind==='ledger.csv'?'_台账.csv':'.csv')});document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function replaceRecord(next,message){flushPending();storageLocked=false;originalStorage=null;$('export-json').textContent='导出 JSON 备份';record=next;actor='';note='';persist();navigate(0);$('save-status').textContent=message;}
function confirmReplacement(message){return (!storageLocked&&!record?.meta.title&&record.auditTrail.length<=1)||confirm(message+'当前浏览器仅保留一条记录，请确认已导出备份。');}
async function boot(){
  try{
    config=await loadConfig();const loaded=loadRecord(config);storageLocked=!loaded.ok;if(storageLocked){try{originalStorage=localStorage.getItem(STORAGE_KEY);}catch{}if(originalStorage!==null)$('export-json').textContent='下载原始存储（恢复用）';}record=loaded.record||createRecord(config);actor=record.changeSummary.owner||'';
    $('reference-list').replaceChildren(...config.references.sources.map(x=>h('div',{class:'moc-ref'},h('a',{href:x.url,target:'_blank',rel:'noopener noreferrer'},x.title+' ↗'),paragraph(x.kind+' · '+x.scope),paragraph((x.effectiveDate?'实施日期：'+x.effectiveDate+'。':'')+x.note))));
    $('boot-status').hidden=true;$('workspace').hidden=false;$('new-record').disabled=false;$('load-demo').disabled=false;
    ['new-record','load-demo','duplicate-record','clear-record'].forEach(id=>$(id).addEventListener('click',flushPending,{capture:true}));
    $('new-record').addEventListener('click',()=>{if(confirmReplacement('新建将替换当前记录。'))replaceRecord(createRecord(config),'新草稿已保存至此浏览器');});
    $('load-demo').addEventListener('click',()=>{if(confirmReplacement('加载虚构循环泵示例将替换当前记录。'))replaceRecord(createDemo(config),'已加载虚构示例 · 仍需完成实际评审');});
    $('previous-step').addEventListener('click',()=>navigate(Math.max(0,step-1)));$('next-step').addEventListener('click',()=>navigate(Math.min(6,step+1)));
    $('print-report').addEventListener('click',()=>{buildReport();window.print();});window.addEventListener('beforeprint',()=>{if(record)buildReport();});
    $('export-json').addEventListener('click',()=>{refresh();download(storageLocked&&originalStorage!==null?originalStorage:exportJSON(record),'json','application/json;charset=utf-8');});
    $('export-actions').addEventListener('click',()=>{refresh();download(exportActionsCSV(record),'actions.csv','text/csv;charset=utf-8');});
    $('export-register').addEventListener('click',()=>{refresh();download(exportLedgerCSV(record,evaluate(record,config)),'ledger.csv','text/csv;charset=utf-8');});
    $('import-json').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async event=>{
      const file=event.target.files[0];if(!file)return;
      try{if(file.size>1024*1024)throw Error('文件超过 1 MB，请选择有效的 MOC JSON 备份。');const next=importRecord(await file.text(),config);if(!confirm('导入会替换当前记录，并将外部批准结果重置为待复核草稿。请确认已备份当前记录。'))return;replaceRecord(next,'导入成功 · 历史批准结果需重新核对');}
      catch(err){error(err.message);$('validation').focus();}finally{event.target.value='';}
    });
    $('duplicate-record').addEventListener('click',()=>{if(confirm('复制会生成新的草稿编号并替换当前记录；原批准和完成状态需重新确认。请先导出原记录。'))replaceRecord(copyRecord(record,config),'已复制为新草稿 · 原审批不沿用');});
    $('clear-record').addEventListener('click',()=>{if(!confirm('确认清除本浏览器的 MOC 记录？此操作不可恢复，请先导出备份。'))return;const result=clearRecord();if(!result.ok){error(result.error);return;}storageLocked=false;originalStorage=null;$('export-json').textContent='导出 JSON 备份';record=createRecord(config);navigate(0);$('save-status').textContent='本地记录已清除，不可恢复；当前为空白未保存草稿。';});
    if(matchMedia('(max-width:800px)').matches)$('summary-card').open=false;
    navigate(0,false);if(loaded.ok){persist();if(loaded.warnings?.length)error(loaded.warnings.join('；'));}else{$('save-status').textContent=loaded.error;error(loaded.error+' 原存储已隔离保留；可下载原始存储交由恢复，或导入有效备份。新建前会再次确认。');}
    window.addEventListener('beforeunload',flushPending);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flushPending();});
    window.addEventListener('focus',()=>{const previous=record.meta.status;record=refreshExpiry(record,config);if(record.meta.status!==previous){persist();renderForm();}renderSummary();});
    timer=setInterval(()=>{const previous=record.meta.status;record=refreshExpiry(record,config);if(record.meta.status!==previous){persist();renderForm();renderSummary();}},60000);
  }catch(err){$('boot-status').classList.add('moc-error-page');$('boot-status').textContent='工具加载失败。请检查网络后刷新；已有本地记录不会因此被清除。';}
}
boot();

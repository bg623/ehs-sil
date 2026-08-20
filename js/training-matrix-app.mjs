import{generateMatrix,statusCode,buildPlan,escapeText,cleanCustomRole}from'./training-matrix-engine.mjs';
import{buildTrainingWorkbook}from'./training-matrix-export.mjs';

const CATALOG='../data/training-matrix/catalog-v0.2.json';
const KEY='ehs_sil_training_matrix_v02',OLD_KEY='ehs_sil_training_matrix_v01';
let data,step=0,result=null,state={industry:'',roles:[],risks:[],customRole:''};
document.querySelector('main')?.setAttribute('id','main-content');
const $=id=>document.getElementById(id);
const track=name=>window.EhsSilAnalytics?.track(name,{toolId:'training_matrix',pageType:'other'});

async function boot(){
  try{
    const response=await fetch(CATALOG);
    if(!response.ok)throw Error(CATALOG);
    const catalog=await response.json();
    data={...catalog,risks:catalog.risk_tags};
    try{
      const saved=localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY);
      if(saved)state={...state,...JSON.parse(saved)};
    }catch{}
    const industryIds=new Set(data.industries.map(x=>x.id)),roleIds=new Set(data.roles.map(x=>x.id)),riskIds=new Set(data.risks.map(x=>x.id));
    if(!industryIds.has(state.industry))state.industry='';
    state.roles=state.roles.filter(id=>roleIds.has(id));
    state.risks=state.risks.filter(id=>riskIds.has(id));
    state.customRole=cleanCustomRole(state.customRole);
    save();
    $('loading').classList.add('tm-hidden');$('wizard').classList.remove('tm-hidden');render();
  }catch{
    $('loading').classList.add('tm-hidden');$('error').classList.remove('tm-hidden');
    $('errorText').textContent='规则数据加载失败，请检查网络后刷新。';
  }
}

function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function inputList(items,name,selected,type='checkbox'){
  const groups=new Map();
  for(const item of items){const group=item.group||'其他';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item);}
  return [...groups].map(([group,groupItems])=>`<section class="tm-input-group"><h3>${escapeText(group)}</h3><div class="tm-grid">${groupItems.map(item=>`<label class="tm-option"><input type="${type}" name="${name}" value="${escapeText(item.id)}" ${selected.includes(item.id)?'checked':''}><span><strong>${escapeText(item.name)}</strong>${item.description?`<br><small>${escapeText(item.description)}</small>`:''}</span></label>`).join('')}</div></section>`).join('');
}

function render(){
  document.querySelectorAll('.tm-progress span').forEach((node,index)=>node.classList.toggle('active',index<=step));
  $('backBtn').style.visibility=step?'visible':'hidden';$('nextBtn').textContent=step===3?'生成培训矩阵':'下一步';$('stepError').textContent='';
  let html='';
  if(step===0)html=`<h2>1/4 选择行业场景</h2><p>选择最接近的模板；行业模板只用于缩小规则范围，不替代许可证、地方规定和企业风险识别。</p>${inputList(data.industries,'industry',[state.industry],'radio')}`;
  if(step===1)html=`<h2>2/4 选择岗位/法定角色</h2><p>按实际职责选择，可多选；不要填写人员姓名。特殊作业人员与管理角色需分别选择。</p>${inputList(data.roles,'roles',state.roles)}<label class="tm-custom-label">自定义岗位（可选，最多30字）<input class="tm-custom" id="customRole" maxlength="30" value="${escapeText(state.customRole)}" placeholder="例如：公用工程操作岗位"></label>`;
  if(step===2)html=`<h2>3/4 选择企业属性、风险与作业活动</h2><p>先确认法定属性，再选择实际存在的风险和作业；未选择的条件不会触发对应专项要求。</p>${inputList(data.risks,'risks',state.risks)}`;
  if(step===3){
    const industry=data.industries.find(x=>x.id===state.industry);
    html=`<h2>4/4 复核并生成</h2><p><strong>行业：</strong>${escapeText(industry?.name)}</p><p><strong>岗位：</strong>${state.roles.map(id=>data.roles.find(x=>x.id===id)?.name).filter(Boolean).map(escapeText).join('、')}${state.customRole?'、'+escapeText(state.customRole):''}</p><p><strong>属性/风险：</strong>${state.risks.map(id=>data.risks.find(x=>x.id===id)?.name).filter(Boolean).map(escapeText).join('、')||'未选择专项条件'}</p><div class="tm-privacy"><strong>规则库 V${escapeText(data.version)}</strong>，法规版本核验日期 ${escapeText(data.verified_at)}。结果是全国通用基线初稿，地方规定、许可条件与企业制度仍需复核。</div>`;
  }
  $('stepContent').innerHTML=html;
}

function collect(){
  if(step===0)state.industry=document.querySelector('[name=industry]:checked')?.value||'';
  if(step===1){state.roles=[...document.querySelectorAll('[name=roles]:checked')].map(x=>x.value);state.customRole=cleanCustomRole($('customRole').value);}
  if(step===2)state.risks=[...document.querySelectorAll('[name=risks]:checked')].map(x=>x.value);
  save();
}

$('nextBtn').onclick=()=>{
  collect();
  if(step===0&&!state.industry)return $('stepError').textContent='请选择一个行业场景。';
  if(step===1&&!state.roles.length&&!state.customRole)return $('stepError').textContent='请至少选择一个岗位。';
  if(step<3){step++;render();if(step===3)track('training_profile_complete');return;}
  makeResult();
};
$('backBtn').onclick=()=>{collect();step=Math.max(0,step-1);render();};

function makeResult(){
  result=generateMatrix(state,data);renderResults();$('wizard').classList.add('tm-hidden');$('results').classList.remove('tm-hidden');track('training_matrix_generated');scrollTo({top:0,behavior:'smooth'});
}

function renderResults(){
  const requirements=result.requirements;
  const count=level=>requirements.filter(x=>x.requirement_level===level).length;
  $('summary').innerHTML=[[result.roles.length,'岗位'],[result.topics.length,'培训主题'],[count('mandatory'),'M 明确最低要求'],[count('conditional'),'C 条件适用'],[count('recommended'),'R 风险/最佳实践'],[requirements.filter(x=>x.priority==='high').length,'高优先级']].map(([value,label])=>`<div class="tm-stat"><strong>${value}</strong>${label}</div>`).join('');
  const upcoming=data.sources.filter(source=>source.status==='upcoming');
  $('basis').innerHTML=`<div><strong>适用基线：</strong>${escapeText(data.jurisdiction)}｜规则库 V${escapeText(data.version)}｜核验日期 ${escapeText(data.verified_at)}</div><p>${escapeText(data.scope_note)}</p><details><summary>查看 ${upcoming.length} 项即将实施标准（不作为当前已生效依据）</summary>${upcoming.map(source=>`<p><a href="${escapeText(source.official_url)}" target="_blank" rel="noopener">${escapeText(source.title)}（${escapeText(source.document_number)}）</a>｜实施日期 ${escapeText(source.effective_date)}</p>`).join('')}</details>`;
  const cell=(role,topic)=>{const item=requirements.find(x=>x.role_id===role.id&&x.topic_id===topic.topic_id),code=item?statusCode(item.requirement_level):'N/A';return `<td class="code-${code}">${code}</td>`;};
  $('matrixDesktop').innerHTML=`<table><thead><tr><th>岗位</th>${result.topics.map(topic=>`<th>${escapeText(topic.title_zh)}</th>`).join('')}</tr></thead><tbody>${result.roles.map(role=>`<tr><th>${escapeText(role.name)}</th>${result.topics.map(topic=>cell(role,topic)).join('')}</tr>`).join('')}</tbody></table>`;
  $('matrixMobile').innerHTML=result.roles.map(role=>`<article class="tm-detail"><h3>${escapeText(role.name)}</h3>${requirements.filter(x=>x.role_id===role.id).map(x=>`<p><span class="tm-code code-${statusCode(x.requirement_level)}">${statusCode(x.requirement_level)}</span> ${escapeText(x.topic.title_zh)}</p>`).join('')||'<p>N/A</p>'}</article>`).join('');
  $('details').innerHTML=requirements.map(detailHtml).join('');
  const plan=buildPlan(result);
  $('plan').innerHTML=table(['频次/时间窗口','培训主题','目标岗位','触发条件','计划方式','责任角色','考核方式','状态'],plan.map(x=>[x.window,x.topic,x.role,x.trigger,x.method,x.owner,x.assessment,x.status]));
  $('gaps').innerHTML=requirements.slice().sort((a,b)=>({high:1,medium:2,low:3})[a.priority]-({high:1,medium:2,low:3})[b.priority]).map((item,index)=>`<div class="tm-detail"><h4>${index+1}. ${item.priority==='high'?'高':item.priority==='medium'?'中':'低'}｜${escapeText(item.role_name)} · ${escapeText(item.topic.title_zh)}</h4><p>核对适用条件、现有证书/培训/实操证据，确认责任人、频次和完成时间。</p><p>当前为需求提示，不代表已认定违法或存在培训缺口。</p></div>`).join('');
}

const sourceStatus={effective:'已生效',upcoming:'即将实施',best_practice:'国际最佳实践',needs_review:'企业复核'};
const competence={awareness:'知晓',knowledge:'知识掌握',practical:'现场实操',authorized:'授权胜任',certified:'法定资格/持证',management:'管理履职',rescue:'救援实操'};
function detailHtml(item){
  const sources=item.sources.map(source=>`<span class="tm-source"><span class="tm-source-badge status-${escapeText(source.status)}">${escapeText(source.source_type)} · ${escapeText(sourceStatus[source.status]||source.status)}</span><a href="${escapeText(source.official_url)}" target="_blank" rel="noopener">${escapeText(source.title)}${source.document_number?`（${escapeText(source.document_number)}）`:''}${source.article?` ${escapeText(source.article)}`:''}</a>${source.effective_date?`<small>实施：${escapeText(source.effective_date)}</small>`:''}</span>`).join('');
  return `<article class="tm-detail"><h4>${escapeText(item.role_name)}｜${escapeText(item.topic.title_zh)} <span class="tm-code code-${statusCode(item.requirement_level)}">${statusCode(item.requirement_level)}</span></h4><p><strong>匹配原因：</strong>${item.reasons.map(escapeText).join('；')}</p><div><strong>法规/依据：</strong><div class="tm-sources">${sources||'企业风险评估/内部制度'}</div></div><p><strong>培训时机：</strong>${item.training_triggers.map(escapeText).join('；')}<br><strong>频次：</strong>${item.frequencies.map(escapeText).join('；')||'由企业基于风险确定'}${item.minimum_durations.length?`<br><strong>最低学时：</strong>${item.minimum_durations.map(escapeText).join('；')}`:''}</p><p><strong>目标能力：</strong>${item.competence_levels.map(level=>escapeText(competence[level]||level)).join('、')}　<strong>培训方式：</strong>${item.topic.delivery_methods.map(escapeText).join('、')}</p><p><strong>效果验证：</strong>${[...new Set([...item.assessment_requirements,...item.topic.assessment_methods])].map(escapeText).join('；')}<br><strong>记录证据：</strong>${[...new Set([...item.record_requirements,...item.topic.evidence_examples])].map(escapeText).join('；')}</p><small>命中规则：${item.rule_ids.map(escapeText).join('、')}｜企业内部复核：需要</small></article>`;
}

function table(headers,rows){return `<table><thead><tr>${headers.map(x=>`<th>${escapeText(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${escapeText(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}

$('editBtn').onclick=()=>{$('results').classList.add('tm-hidden');$('wizard').classList.remove('tm-hidden');step=0;render();};
$('printBtn').onclick=()=>{track('training_pdf_print');print();};
$('restartBtn').onclick=()=>{state={industry:'',roles:[],risks:[],customRole:''};save();step=0;$('results').classList.add('tm-hidden');$('wizard').classList.remove('tm-hidden');render();track('training_reset');};
$('clearBtn').onclick=()=>{localStorage.removeItem(KEY);localStorage.removeItem(OLD_KEY);state={industry:'',roles:[],risks:[],customRole:''};location.reload();};
$('toolboxLink').onclick=()=>track('training_toolbox_click');$('libraryLink').onclick=()=>track('training_library_click');$('excelBtn').onclick=exportExcel;
async function exportExcel(){
  if(!window.ExcelJS)return alert('Excel导出组件未加载，请刷新重试。');
  const built=buildTrainingWorkbook(window.ExcelJS,result,data,state),buffer=await built.workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),anchor=document.createElement('a');
  anchor.href=URL.createObjectURL(blob);anchor.download=`EHS培训矩阵_${built.industryName}_${built.date}.xlsx`;anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),1000);track('training_excel_export');
}

track('training_matrix_start');boot();

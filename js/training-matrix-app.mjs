import { generateMatrix, statusCode, buildPlan, escapeText, cleanCustomRole } from './training-matrix-engine.mjs';
import { buildTrainingWorkbook } from './training-matrix-export.mjs';

const CATALOG = '../data/training-matrix/catalog-v0.3.json';
const KEY = 'ehs_sil_training_matrix_v03';
const OLD_KEYS = ['ehs_sil_training_matrix_v02', 'ehs_sil_training_matrix_v01'];
const TOTAL_STEPS = 3;
const emptyState = () => ({ industry: '', roles: [], personnelStatuses: [], risks: [], applicability: {}, specialWorkModes: {}, customRole: '' });

const COMMON_ROLES = {
  chemical: ['principal', 'ehs', 'supervisor', 'process_engineer', 'operator', 'maintenance', 'contractor_worker', 'emergency_team'],
  pharma: ['ehs', 'occupational_health_manager', 'environmental_manager', 'supervisor', 'operator', 'maintenance', 'laboratory', 'warehouse'],
  manufacturing: ['principal', 'ehs', 'supervisor', 'operator', 'maintenance', 'electrician', 'forklift_driver', 'warehouse'],
  warehouse_logistics: ['ehs', 'supervisor', 'forklift_driver', 'warehouse', 'hazchem_warehouse', 'contractor_worker', 'fire_manager'],
  laboratory_rd: ['ehs', 'occupational_health_manager', 'environmental_manager', 'laboratory', 'first_aider', 'emergency_team']
};

const PRIORITY_ATTRIBUTES = {
  chemical: ['hazchem_high_risk_unit', 'hazchem_use', 'major_hazard', 'regulated_process', 'occupational_hazards'],
  pharma: ['hazchem_use', 'occupational_hazards', 'special_equipment', 'pollutant_permit', 'hazardous_waste'],
  manufacturing: ['occupational_hazards', 'special_equipment', 'fire_key_unit', 'pollutant_permit', 'hazardous_waste'],
  warehouse_logistics: ['hazchem_use', 'fire_key_unit', 'public_gathering_place', 'special_equipment', 'hazardous_waste'],
  laboratory_rd: ['hazchem_use', 'occupational_hazards', 'hazardous_waste', 'fire_key_unit', 'env_emergency']
};

const INDUSTRY_RISKS = {
  chemical: ['process_operation', 'chemicals', 'fire_explosion', 'equipment_maintenance', 'loto', 'emergency', 'spill_response'],
  pharma: ['chemicals', 'equipment_maintenance', 'loto', 'waste_gas_water_facility', 'emergency'],
  manufacturing: ['equipment_maintenance', 'loto', 'vehicles', 'noise', 'manual_handling', 'emergency'],
  warehouse_logistics: ['vehicles', 'manual_handling', 'fire_explosion', 'chemicals', 'emergency'],
  laboratory_rd: ['lab_risk', 'chemicals', 'ppe', 'respiratory_protection', 'emergency', 'spill_response']
};

let data;
let step = 0;
let result = null;
let state = emptyState();

document.querySelector('main')?.setAttribute('id', 'main-content');
const $ = id => document.getElementById(id);
const track = name => window.EhsSilAnalytics?.track(name, { toolId: 'training_matrix', pageType: 'other' });
const applicabilityLabel = { yes: '适用', no: '不适用', unknown: '待确认' };
const basisLabel = { explicit_training_clause: '法规明确培训条款', statutory_qualification: '法定资格/准入', mandatory_standard: '强制标准明确规定', statutory_duty_inference: '由法定职责推导的能力要求', enterprise_risk_control: '企业风险控制建议', international_practice: '国际最佳实践' };

async function boot() {
  try {
    const response = await fetch(CATALOG);
    if (!response.ok) throw Error(CATALOG);
    const catalog = await response.json();
    data = { ...catalog, risks: catalog.risk_tags };
    try {
      const saved = localStorage.getItem(KEY) || OLD_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
      if (saved) state = { ...state, ...JSON.parse(saved) };
    } catch {}
    const industryIds = new Set(data.industries.map(item => item.id));
    const roleIds = new Set(data.roles.map(item => item.id));
    const riskIds = new Set(data.risks.map(item => item.id));
    const statusIds = new Set(data.personnel_statuses.map(item => item.id));
    if (!industryIds.has(state.industry)) state.industry = '';
    state.roles = (state.roles || []).filter(id => roleIds.has(id));
    state.personnelStatuses = (state.personnelStatuses || []).filter(id => statusIds.has(id));
    state.applicability = state.applicability || {};
    state.specialWorkModes = state.specialWorkModes || {};
    for (const item of keyAttributes()) {
      if (!['yes', 'no', 'unknown'].includes(state.applicability[item.id])) state.applicability[item.id] = (state.risks || []).includes(item.id) ? 'yes' : 'unknown';
    }
    state.risks = (state.risks || []).filter(id => riskIds.has(id) && !keyAttributes().some(item => item.id === id));
    state.customRole = cleanCustomRole(state.customRole);
    save();
    $('loading').classList.add('tm-hidden');
    $('wizard').classList.remove('tm-hidden');
    render();
  } catch {
    $('loading').classList.add('tm-hidden');
    $('error').classList.remove('tm-hidden');
    $('errorText').textContent = '规则数据加载失败，请检查网络后刷新。';
  }
}

function keyAttributes() { return data.risks.filter(item => item.applicability_mode === 'tri_state'); }
function operationalRisks() { return data.risks.filter(item => item.applicability_mode !== 'tri_state' && item.group !== '人员与变化'); }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    const group = item.group || '其他';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  return groups;
}

function option(item, name, selected, type = 'checkbox', compact = false) {
  return `<label class="tm-option${compact ? ' compact' : ''}"><input type="${type}" name="${name}" value="${escapeText(item.id)}" ${selected.includes(item.id) ? 'checked' : ''}><span><strong>${escapeText(item.name)}</strong>${item.description && !compact ? `<small>${escapeText(item.description)}</small>` : ''}</span></label>`;
}

function inputList(items, name, selected, type = 'checkbox', compact = false) {
  return [...groupItems(items)].map(([group, groupItemsList]) => `<section class="tm-input-group"><h4>${escapeText(group)}</h4><div class="tm-grid">${groupItemsList.map(item => option(item, name, selected, type, compact)).join('')}</div></section>`).join('');
}

function rolePicker() {
  const commonIds = COMMON_ROLES[state.industry] || [];
  const common = commonIds.map(id => data.roles.find(item => item.id === id)).filter(Boolean);
  const remaining = data.roles.filter(item => !commonIds.includes(item.id));
  const hasSelectedRemaining = remaining.some(item => state.roles.includes(item.id));
  return `<section class="tm-input-group tm-section-block"><div class="tm-section-heading"><div><span class="tm-step-tag">岗位</span><h3>选择实际岗位或法定角色</h3></div><span class="tm-count">可多选</span></div><p>已按行业把常见岗位放在前面；这只是快捷排序，请按实际职责确认。</p><div class="tm-grid tm-recommended-grid">${common.map(item => option(item, 'roles', state.roles, 'checkbox', true)).join('')}</div><details class="tm-disclosure" ${hasSelectedRemaining ? 'open' : ''}><summary>查看其他岗位（${remaining.length}）</summary>${inputList(remaining, 'roles', state.roles, 'checkbox', true)}</details><label class="tm-custom-label">没有合适岗位？可自定义（最多30字）<input class="tm-custom" id="customRole" maxlength="30" value="${escapeText(state.customRole)}" placeholder="例如：公用工程操作岗位"></label></section>`;
}

function triStateFields(items) {
  return items.map(item => `<fieldset class="tm-tristate"><legend>${escapeText(item.name)}</legend><p>${escapeText(item.diagnostic_question)}</p><div>${['yes', 'no', 'unknown'].map(value => `<label><input type="radio" name="attr-${escapeText(item.id)}" value="${value}" ${state.applicability[item.id] === value ? 'checked' : ''}> ${applicabilityLabel[value]}</label>`).join('')}</div></fieldset>`).join('');
}

function triStateList() {
  const priorityIds = PRIORITY_ATTRIBUTES[state.industry] || [];
  const priority = priorityIds.map(id => keyAttributes().find(item => item.id === id)).filter(Boolean);
  const remaining = keyAttributes().filter(item => !priorityIds.includes(item.id));
  const hasAnsweredRemaining = remaining.some(item => state.applicability[item.id] !== 'unknown');
  return `<section class="tm-input-group tm-section-block"><div class="tm-section-heading"><div><span class="tm-step-tag">智能排序</span><h3>优先确认这些企业属性</h3></div><span class="tm-count">${priority.length} 项优先</span></div><p>系统只调整显示顺序，不会替你判断适用性。“待确认”可以继续生成底稿。</p><div class="tm-tristate-list">${triStateFields(priority)}</div><details class="tm-disclosure" ${hasAnsweredRemaining ? 'open' : ''}><summary>确认其他企业属性（${remaining.length}）</summary><div class="tm-tristate-list">${triStateFields(remaining)}</div></details></section>`;
}

function recommendedRiskIds() {
  const operationalIds = new Set(operationalRisks().map(item => item.id));
  const scores = new Map();
  const add = (id, score) => { if (operationalIds.has(id)) scores.set(id, (scores.get(id) || 0) + score); };
  for (const id of INDUSTRY_RISKS[state.industry] || []) add(id, 3);
  for (const rule of data.rules) {
    const roleMatch = (rule.roles_any || []).some(id => state.roles.includes(id));
    const industryMatch = (rule.industries || []).includes(state.industry);
    if (!roleMatch && !industryMatch) continue;
    for (const id of [...(rule.risk_tags_any || []), ...(rule.risk_tags_all || [])]) add(id, roleMatch ? 2 : 1);
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
}

function riskPicker() {
  const recommendedIds = recommendedRiskIds();
  const recommended = recommendedIds.map(id => operationalRisks().find(item => item.id === id)).filter(Boolean);
  const remaining = operationalRisks().filter(item => !recommendedIds.includes(item.id));
  const hasSelectedRemaining = remaining.some(item => state.risks.includes(item.id));
  return `<section class="tm-input-group tm-section-block"><div class="tm-section-heading"><div><span class="tm-step-tag">智能提示</span><h3>确认岗位接触的风险与作业</h3></div><span class="tm-count">建议先看 ${recommended.length} 项</span></div><p>建议来自所选行业和岗位，仅帮助缩小范围；请勾选实际存在的项目。</p><div class="tm-grid tm-recommended-grid">${recommended.map(item => option(item, 'risks', state.risks, 'checkbox', true)).join('')}</div><details class="tm-disclosure" ${hasSelectedRemaining ? 'open' : ''}><summary>查看全部其他风险与作业（${remaining.length}）</summary>${inputList(remaining, 'risks', state.risks, 'checkbox', true)}</details><div id="specialChecks">${specialChecks()}</div></section>`;
}

function personnelPicker() {
  return `<details class="tm-disclosure tm-optional" ${state.personnelStatuses.length ? 'open' : ''}><summary>人员状态（仅新入职、转岗、复岗、派遣或实习时选择）</summary><p>人员状态不是岗位，仍需绑定至少一个实际岗位。</p>${inputList(data.personnel_statuses, 'personnelStatuses', state.personnelStatuses, 'checkbox', true)}</details>`;
}

function specialChecks() {
  const checks = data.special_work_checks.filter(check => state.risks.includes(check.risk_id) && check.trigger_roles.some(id => state.roles.includes(id)));
  if (!checks.length) return '';
  return `<section class="tm-special-checks"><h4>再确认特殊作业身份</h4><p>只有确认“本人实施”，系统才会生成相应取证要求。</p><div class="tm-tristate-list">${checks.map(check => `<fieldset class="tm-tristate"><legend>${escapeText(check.label)}</legend><div>${check.options.map(item => `<label><input type="radio" name="special-${escapeText(check.risk_id)}" value="${escapeText(item.id)}" ${state.specialWorkModes[check.risk_id] === item.id ? 'checked' : ''}> ${escapeText(item.name)}</label>`).join('')}</div></fieldset>`).join('')}</div></section>`;
}

function selectionNames(items, ids) { return ids.map(id => items.find(item => item.id === id)?.name).filter(Boolean).map(escapeText).join('、'); }

function reviewStep() {
  const industry = data.industries.find(item => item.id === state.industry);
  const pending = keyAttributes().filter(item => state.applicability[item.id] === 'unknown');
  const selectedRoles = selectionNames(data.roles, state.roles) + (state.customRole ? `${state.roles.length ? '、' : ''}${escapeText(state.customRole)}` : '');
  return `<h2>3/3 复核后生成</h2><p class="tm-step-intro">确认摘要即可生成；未完成的企业属性会保留为“待确认”，不会被当作“不适用”。</p><div class="tm-review-grid"><article><span>行业</span><strong>${escapeText(industry?.name)}</strong></article><article><span>岗位</span><strong>${selectedRoles}</strong></article><article><span>人员状态</span><strong>${selectionNames(data.personnel_statuses, state.personnelStatuses) || '常规在岗'}</strong></article><article><span>风险与作业</span><strong>${selectionNames(data.risks, state.risks) || '未选择专项风险'}</strong></article></div><div class="tm-notice ${pending.length ? 'warning' : 'success'}"><strong>规则库 V${escapeText(data.version)}</strong> · 法规版本核验日期 ${escapeText(data.verified_at)}<br>${pending.length ? `尚有 ${pending.length} 项企业属性待确认，将生成“待确认底稿”。` : '关键企业属性已逐项判断，仍需结合地方规定、许可条件和企业制度复核。'}</div>`;
}

function render() {
  document.querySelectorAll('.tm-progress-step').forEach((node, index) => {
    node.classList.toggle('active', index <= step);
    node.setAttribute('aria-current', index === step ? 'step' : 'false');
  });
  $('backBtn').style.visibility = step ? 'visible' : 'hidden';
  $('nextBtn').textContent = step === TOTAL_STEPS - 1 ? '生成培训矩阵' : '继续';
  $('stepError').textContent = '';
  let html = '';
  if (step === 0) html = `<h2>1/3 先选场景和岗位</h2><p class="tm-step-intro">只需选择最接近的行业，再勾选实际岗位。系统会把后续相关选项排在前面。</p><section class="tm-input-group tm-section-block"><div class="tm-section-heading"><div><span class="tm-step-tag">场景</span><h3>选择行业场景</h3></div><span class="tm-count">单选</span></div><div class="tm-grid tm-industry-grid">${data.industries.map(item => option(item, 'industry', [state.industry], 'radio', true)).join('')}</div></section>${rolePicker()}`;
  if (step === 1) html = `<h2>2/3 只确认与当前场景相关的内容</h2><p class="tm-step-intro">优先项已根据行业和岗位排序，低频选项收在“查看其他”中。</p>${triStateList()}${riskPicker()}${personnelPicker()}`;
  if (step === 2) html = reviewStep();
  $('stepContent').innerHTML = html;
  bindStepInteractions();
}

function collect() {
  if (step === 0) {
    state.industry = document.querySelector('[name=industry]:checked')?.value || '';
    state.roles = [...document.querySelectorAll('[name=roles]:checked')].map(input => input.value);
    state.customRole = cleanCustomRole($('customRole')?.value || '');
  }
  if (step === 1) {
    for (const item of keyAttributes()) state.applicability[item.id] = document.querySelector(`[name="attr-${item.id}"]:checked`)?.value || 'unknown';
    state.risks = [...document.querySelectorAll('[name=risks]:checked')].map(input => input.value);
    state.personnelStatuses = [...document.querySelectorAll('[name=personnelStatuses]:checked')].map(input => input.value);
    for (const check of data.special_work_checks) {
      if (!state.risks.includes(check.risk_id)) {
        delete state.specialWorkModes[check.risk_id];
        continue;
      }
      const value = document.querySelector(`[name="special-${check.risk_id}"]:checked`)?.value;
      if (value) state.specialWorkModes[check.risk_id] = value;
    }
  }
  save();
}

function bindStepInteractions() {
  if (step === 0) {
    document.querySelectorAll('[name=industry]').forEach(input => input.addEventListener('change', () => {
      state.industry = input.value;
      state.roles = [...document.querySelectorAll('[name=roles]:checked')].map(item => item.value);
      state.customRole = cleanCustomRole($('customRole')?.value || '');
      save();
      render();
    }));
  }
  if (step === 1) {
    document.querySelectorAll('[name=risks]').forEach(input => input.addEventListener('change', () => {
      for (const check of data.special_work_checks) {
        const selectedMode = document.querySelector(`[name="special-${check.risk_id}"]:checked`)?.value;
        if (selectedMode) state.specialWorkModes[check.risk_id] = selectedMode;
      }
      state.risks = [...document.querySelectorAll('[name=risks]:checked')].map(item => item.value);
      for (const check of data.special_work_checks) if (!state.risks.includes(check.risk_id)) delete state.specialWorkModes[check.risk_id];
      save();
      $('specialChecks').innerHTML = specialChecks();
    }));
  }
}

$('nextBtn').onclick = () => {
  collect();
  if (step === 0 && !state.industry) return $('stepError').textContent = '请选择一个行业场景。';
  if (step === 0 && !state.roles.length && !state.customRole) return $('stepError').textContent = '请至少选择一个实际岗位。';
  if (step < TOTAL_STEPS - 1) {
    step += 1;
    render();
    if (step === TOTAL_STEPS - 1) track('training_profile_complete');
    scrollTo({ top: $('wizard').offsetTop - 82, behavior: 'smooth' });
    return;
  }
  makeResult();
};

$('backBtn').onclick = () => { collect(); step = Math.max(0, step - 1); render(); };

function makeResult() {
  result = generateMatrix(state, data);
  renderResults();
  $('wizard').classList.add('tm-hidden');
  $('results').classList.remove('tm-hidden');
  track('training_matrix_generated');
  scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResults() {
  const requirements = result.requirements;
  const count = level => requirements.filter(item => item.requirement_level === level).length;
  $('summary').innerHTML = [[result.roles.length, '岗位'], [result.topics.length, '培训主题'], [count('mandatory'), 'M 法定明确要求'], [count('conditional'), 'C 条件/职责推导'], [count('recommended'), 'R 风险/最佳实践'], [result.pending_applicability.length + result.pending_special_checks.length, '待确认事项']].map(([value, label]) => `<div class="tm-stat"><strong>${value}</strong>${label}</div>`).join('');
  const upcoming = data.sources.filter(source => source.status === 'upcoming');
  const statusText = result.document_status === 'draft_pending_confirmation' ? '待确认底稿：不得作为最终适用性结论' : '已完成关键属性判断的培训需求底稿';
  $('basis').innerHTML = `<div class="tm-document-status"><strong>${statusText}</strong></div><div><strong>适用基线：</strong>${escapeText(data.jurisdiction)}｜规则库 V${escapeText(data.version)}｜核验日期 ${escapeText(data.verified_at)}</div><p>${escapeText(data.scope_note)}</p>${result.pending_applicability.length ? `<p><strong>待确认企业属性：</strong>${result.pending_applicability.map(item => escapeText(item.name)).join('、')}</p>` : ''}${result.pending_special_checks.length ? `<p><strong>待确认特殊作业身份：</strong>${result.pending_special_checks.map(item => escapeText(item.label)).join('、')}</p>` : ''}<details><summary>查看 ${upcoming.length} 项即将实施标准（不作为当前已生效依据）</summary>${upcoming.map(source => `<p><a href="${escapeText(source.official_url)}" target="_blank" rel="noopener">${escapeText(source.title)}（${escapeText(source.document_number)}）</a>｜实施日期 ${escapeText(source.effective_date)}</p>`).join('')}</details>`;
  const cell = (role, topic) => {
    const item = requirements.find(requirement => requirement.role_id === role.id && requirement.topic_id === topic.topic_id);
    const code = item ? statusCode(item.requirement_level) : 'N/A';
    return `<td class="code-${code}">${code}</td>`;
  };
  $('matrixDesktop').innerHTML = `<table><thead><tr><th>岗位</th>${result.topics.map(topic => `<th>${escapeText(topic.title_zh)}</th>`).join('')}</tr></thead><tbody>${result.roles.map(role => `<tr><th>${escapeText(role.name)}</th>${result.topics.map(topic => cell(role, topic)).join('')}</tr>`).join('')}</tbody></table>`;
  $('matrixMobile').innerHTML = result.roles.map(role => `<article class="tm-detail"><h3>${escapeText(role.name)}</h3>${requirements.filter(item => item.role_id === role.id).map(item => `<p><span class="tm-code code-${statusCode(item.requirement_level)}">${statusCode(item.requirement_level)}</span> ${escapeText(item.topic.title_zh)}</p>`).join('') || '<p>未匹配（不等于确认不适用）</p>'}</article>`).join('');
  $('details').innerHTML = requirements.map(detailHtml).join('');
  const plan = buildPlan(result);
  $('plan').innerHTML = table(['频次/时间窗口', '培训主题', '目标岗位', '触发条件', '计划方式', '责任角色', '考核方式', '状态'], plan.map(item => [item.window, item.topic, item.role, item.trigger, item.method, item.owner, item.assessment, item.status]));
  $('gaps').innerHTML = requirements.slice().sort((a, b) => ({ high: 1, medium: 2, low: 3 })[a.priority] - ({ high: 1, medium: 2, low: 3 })[b.priority]).map((item, index) => `<div class="tm-detail"><h4>${index + 1}. ${item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}｜${escapeText(item.role_name)} · ${escapeText(item.topic.title_zh)}</h4><p>核对适用条件、现有证书/培训/实操证据，确认责任人、频次和完成时间。</p><p>当前为待核验要求，不代表已认定违法、已完成培训或存在培训缺口。</p></div>`).join('');
}

const sourceStatus = { effective: '已生效', upcoming: '即将实施', best_practice: '国际最佳实践', needs_review: '企业复核' };
const competence = { awareness: '知晓', knowledge: '知识掌握', practical: '现场实操', authorized: '授权胜任', certified: '法定资格/持证', management: '管理履职', rescue: '救援实操' };

function detailHtml(item) {
  const sources = item.sources.map(source => `<span class="tm-source"><span class="tm-source-badge status-${escapeText(source.status)}">${escapeText(source.source_type)} · ${escapeText(sourceStatus[source.status] || source.status)}</span><a href="${escapeText(source.official_url)}" target="_blank" rel="noopener">${escapeText(source.title)}${source.document_number ? `（${escapeText(source.document_number)}）` : ''}${source.article ? ` ${escapeText(source.article)}` : ''}</a>${source.effective_date ? `<small>实施：${escapeText(source.effective_date)}</small>` : ''}</span>`).join('');
  return `<article class="tm-detail"><h4>${escapeText(item.role_name)}｜${escapeText(item.topic.title_zh)} <span class="tm-code code-${statusCode(item.requirement_level)}">${statusCode(item.requirement_level)}</span></h4><p><strong>依据性质：</strong>${item.basis_kinds.map(kind => escapeText(basisLabel[kind] || kind)).join('；')}</p><p><strong>匹配原因：</strong>${item.reasons.map(escapeText).join('；')}</p><div><strong>法规/依据：</strong><div class="tm-sources">${sources || '企业风险评估/内部制度'}</div></div><p><strong>培训时机：</strong>${item.training_triggers.map(escapeText).join('；')}<br><strong>培训频次：</strong>${item.frequencies.map(escapeText).join('；') || '由企业基于风险确定'}${item.drill_frequencies.length ? `<br><strong>演练频次：</strong>${item.drill_frequencies.map(escapeText).join('；')}` : ''}${item.minimum_durations.length ? `<br><strong>最低学时：</strong>${item.minimum_durations.map(escapeText).join('；')}` : ''}</p><p><strong>目标能力：</strong>${item.competence_levels.map(level => escapeText(competence[level] || level)).join('、')}　<strong>培训方式：</strong>${item.topic.delivery_methods.map(escapeText).join('、')}</p><p><strong>效果验证：</strong>${[...new Set([...item.assessment_requirements, ...item.topic.assessment_methods])].map(escapeText).join('；')}<br><strong>记录证据：</strong>${[...new Set([...item.record_requirements, ...item.topic.evidence_examples])].map(escapeText).join('；')}</p><small>命中规则：${item.rule_ids.map(escapeText).join('、')}｜企业内部复核：需要</small></article>`;
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map(item => `<th>${escapeText(item)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(item => `<td>${escapeText(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

$('editBtn').onclick = () => { $('results').classList.add('tm-hidden'); $('wizard').classList.remove('tm-hidden'); step = 0; render(); };
$('printBtn').onclick = () => { track('training_pdf_print'); print(); };
$('restartBtn').onclick = () => { state = emptyState(); save(); step = 0; $('results').classList.add('tm-hidden'); $('wizard').classList.remove('tm-hidden'); render(); track('training_reset'); };
$('clearBtn').onclick = () => { localStorage.removeItem(KEY); OLD_KEYS.forEach(key => localStorage.removeItem(key)); state = emptyState(); location.reload(); };
$('toolboxLink').onclick = () => track('training_toolbox_click');
$('libraryLink').onclick = () => track('training_library_click');
$('excelBtn').onclick = exportExcel;

async function exportExcel() {
  if (!window.ExcelJS) return alert('Excel导出组件未加载，请刷新重试。');
  const built = buildTrainingWorkbook(window.ExcelJS, result, data, state);
  const buffer = await built.workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `EHS培训矩阵_${built.industryName}_${built.date}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  track('training_excel_export');
}

track('training_matrix_start');
boot();

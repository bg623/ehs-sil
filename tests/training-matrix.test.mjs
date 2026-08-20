import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{createRequire}from'node:module';
import{generateMatrix,cleanCustomRole,statusCode,matchRule}from'../js/training-matrix-engine.mjs';
import{buildTrainingWorkbook}from'../js/training-matrix-export.mjs';

const require=createRequire(import.meta.url),ExcelJS=require('../vendor/exceljs.min.js');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/training-matrix/catalog-v0.2.json'),'utf8'));
const data={...catalog,risks:catalog.risk_tags};
const profile=(overrides={})=>({industry:'manufacturing',roles:['operator'],risks:[],customRole:'',...overrides});

test('V0.2 数据规模、唯一 ID 与交叉引用完整',()=>{
  assert.equal(data.version,'0.2.0');assert.equal(data.verified_at,'2026-08-19');
  assert.ok(data.industries.length>=5);assert.ok(data.roles.length>=30);assert.ok(data.risks.length>=38);
  assert.ok(data.topics.length>=70);assert.ok(data.sources.length>=40);assert.ok(data.rules.length>=80);
  for(const set of [data.industries,data.roles,data.risks,data.topics,data.sources,data.rules]){
    const ids=set.map(item=>item.rule_id||item.source_id||item.topic_id||item.id);
    assert.equal(new Set(ids).size,ids.length);
  }
  const roles=new Set(data.roles.map(x=>x.id)),risks=new Set(data.risks.map(x=>x.id)),topics=new Set(data.topics.map(x=>x.topic_id)),sources=new Map(data.sources.map(x=>[x.source_id,x]));
  for(const rule of data.rules){
    rule.roles_any.forEach(id=>assert.ok(roles.has(id),`${rule.rule_id} role ${id}`));
    [...rule.risk_tags_any,...rule.risk_tags_all,...rule.risk_tags_none].forEach(id=>assert.ok(risks.has(id),`${rule.rule_id} risk ${id}`));
    assert.ok(topics.has(rule.topic_id),`${rule.rule_id} topic`);
    rule.source_ids.forEach(id=>assert.ok(sources.has(id),`${rule.rule_id} source ${id}`));
    if(rule.requirement_level==='mandatory')assert.ok(rule.source_ids.some(id=>sources.get(id).status==='effective'),`${rule.rule_id} must have effective basis`);
  }
});

test('法规版本切换与即将实施状态正确分离',()=>{
  const expected={special_work_19:['应急管理部令第19号','2026-06-01'],gbz188_2025:['GBZ 188—2025','2026-08-01'],gb46768_2025:['GB 46768—2025','2026-05-01'],gb3608_2025:['GB 3608—2025','2026-05-01'],gb9448_2025:['GB 9448—2025','2026-08-01'],gb2894_2025:['GB 2894—2025','2026-03-01'],tsg08_2026:['TSG 08—2026','2026-05-01']};
  for(const [id,[number,date]]of Object.entries(expected)){const source=data.sources.find(x=>x.source_id===id);assert.equal(source.document_number,number);assert.equal(source.effective_date,date);assert.equal(source.status,'effective');}
  const upcoming=data.sources.filter(x=>x.status==='upcoming');
  assert.deepEqual(upcoming.map(x=>x.source_id).sort(),['aq3026_2026','aq3067_2026','aq3072_2026']);
  assert.ok(upcoming.every(x=>x.effective_date==='2026-09-30'));
  assert.ok(data.sources.filter(x=>x.status==='best_practice').every(x=>x.source_type==='国际最佳实践'));
  for(const source of data.sources)assert.match(source.official_url,/^https:\/\//);
});

test('risk_tags_none 排除逻辑生效',()=>{
  const rule={industries:[],risk_tags_all:[],risk_tags_any:[],risk_tags_none:['hazchem_high_risk_unit']};
  assert.equal(matchRule(rule,profile()),true);
  assert.equal(matchRule(rule,profile({risks:['hazchem_high_risk_unit']})),false);
});

test('一般与高危单位负责人学时不会同时误配',()=>{
  const general=generateMatrix(profile({roles:['principal']}),data).requirements.find(x=>x.topic_id==='principal_safety');
  assert.deepEqual(general.minimum_durations,['初次不少于32学时；每年再培训不少于12学时']);
  const highRisk=generateMatrix(profile({roles:['principal'],risks:['hazchem_high_risk_unit']}),data).requirements.find(x=>x.topic_id==='principal_safety');
  assert.deepEqual(highRisk.minimum_durations,['初次不少于48学时；每年再培训不少于16学时']);
});

test('一般与高危单位新员工学时准确区分',()=>{
  const general=generateMatrix(profile({roles:['newcomer']}),data).requirements;
  assert.ok(general.some(x=>x.topic_id==='induction_general'&&x.minimum_durations.includes('岗前安全培训不少于24学时')));
  assert.ok(!general.some(x=>x.topic_id==='induction_high_risk'));
  const highRisk=generateMatrix(profile({roles:['newcomer'],risks:['hazchem_high_risk_unit']}),data).requirements;
  assert.ok(highRisk.some(x=>x.topic_id==='induction_high_risk'&&x.minimum_durations.includes('岗前不少于72学时；每年再培训不少于20学时')));
  assert.ok(!highRisk.some(x=>x.topic_id==='induction_general'));
});

test('有限空间按进入、监护、检测和审批角色精准匹配',()=>{
  const result=generateMatrix(profile({roles:['operator','environmental_manager','confined_space_guardian','gas_tester','permit_approver'],risks:['confined_space']}),data);
  const topics=role=>result.requirements.filter(x=>x.role_id===role).map(x=>x.topic_id);
  assert.ok(topics('operator').includes('confined_entry'));assert.ok(!topics('operator').includes('confined_guardian'));assert.ok(!topics('operator').includes('gas_testing'));
  assert.ok(topics('confined_space_guardian').includes('confined_guardian'));
  assert.ok(topics('gas_tester').includes('gas_testing'));
  assert.ok(topics('permit_approver').includes('confined_approver'));
  assert.ok(!topics('environmental_manager').some(id=>id.startsWith('confined_')));
});

test('LOTO 授权人员与受影响人员不会混淆',()=>{
  const result=generateMatrix(profile({roles:['maintenance','operator'],risks:['loto']}),data);
  const maintenance=result.requirements.filter(x=>x.role_id==='maintenance').map(x=>x.topic_id),operator=result.requirements.filter(x=>x.role_id==='operator').map(x=>x.topic_id);
  assert.ok(maintenance.includes('loto_authorized'));assert.ok(!maintenance.includes('loto_affected'));
  assert.ok(operator.includes('loto_affected'));assert.ok(!operator.includes('loto_authorized'));
});

test('环保、职业健康与特种设备链条可独立生成',()=>{
  const environmental=generateMatrix(profile({industry:'pharma',roles:['environmental_manager','wastewater_operator','hazardous_waste_manager','hazardous_waste_operator'],risks:['pollutant_permit','hazardous_waste','waste_gas_water_facility','env_emergency']}),data);
  for(const topic of ['environment_manager','pollutant_permit','pollution_facility','hazardous_waste_management','hazardous_waste_operation','environmental_emergency'])assert.ok(environmental.requirements.some(x=>x.topic_id===topic),topic);
  const health=generateMatrix(profile({roles:['occupational_health_manager','operator'],risks:['occupational_hazards','noise','ppe']}),data);
  for(const topic of ['oh_manager','occupational_health_worker','health_surveillance','hearing_conservation','ppe'])assert.ok(health.requirements.some(x=>x.topic_id===topic),topic);
  const equipment=generateMatrix(profile({roles:['special_equipment_director','forklift_driver'],risks:['special_equipment','vehicles']}),data);
  assert.ok(equipment.requirements.some(x=>x.topic_id==='special_equipment_governance'));assert.ok(equipment.requirements.some(x=>x.topic_id==='forklift'));
});

test('三个虚构案例确定性生成且无岗位主题重复',()=>{
  const cases=[profile({industry:'chemical',roles:['operator','supervisor'],risks:['chemicals','process_operation','fire_explosion','emergency']}),profile({roles:['maintenance','electrician'],risks:['loto','equipment_maintenance','temporary_power']}),profile({industry:'laboratory_rd',roles:['laboratory'],risks:['lab_risk','chemicals','occupational_hazards','hazardous_waste']})];
  for(const item of cases){const first=generateMatrix(item,data),second=generateMatrix(item,data);assert.deepEqual(first.requirements.map(x=>[x.role_id,x.topic_id,x.requirement_level,x.rule_ids]),second.requirements.map(x=>[x.role_id,x.topic_id,x.requirement_level,x.rule_ids]));assert.ok(first.requirements.length>=3);assert.equal(new Set(first.requirements.map(x=>`${x.role_id}|${x.topic_id}`)).size,first.requirements.length);}
});

test('自定义岗位防注入且页面不采集个人信息',()=>{
  assert.equal(cleanCustomRole('<img onerror=alert(1)> 公用工程'),'img onerror=alert(1) 公用工程');
  const html=fs.readFileSync(path.join(root,'tools/training-matrix.html'),'utf8');
  for(const bad of ['name="身份证"','name="手机号"','name="证件上传"','name="员工姓名"'])assert.ok(!html.includes(bad));
  assert.ok(html.includes('请勿输入真实人员'));assert.ok(html.includes('法规版本与适用边界'));assert.ok(html.includes('即将实施标准与国际实践均单独标注'));
});

test('页面、导出、打印与分析事件契约存在',()=>{
  const exporter=fs.readFileSync(path.join(root,'js/training-matrix-export.mjs'),'utf8'),app=fs.readFileSync(path.join(root,'js/training-matrix-app.mjs'),'utf8'),html=fs.readFileSync(path.join(root,'tools/training-matrix.html'),'utf8'),css=fs.readFileSync(path.join(root,'css/training-matrix.css'),'utf8'),analytics=fs.readFileSync(path.join(root,'js/analytics.js'),'utf8');
  for(const name of ['岗位培训矩阵','培训要求明细','年度培训计划','依据与使用说明'])assert.ok(exporter.includes(name));
  for(const field of ['最低学时','目标能力','依据层级','依据状态','实施日期','记录证据'])assert.ok(exporter.includes(field));
  assert.ok(app.includes('catalog-v0.2.json'));assert.ok(html.includes('vendor/exceljs.min.js'));assert.ok(css.includes('@media print'));assert.ok(css.includes('@media(max-width:720px)'));
  for(const event of ['training_matrix_start','training_profile_complete','training_matrix_generated','training_excel_export','training_pdf_print','training_reset','training_toolbox_click','training_library_click'])assert.ok(analytics.includes(event));
});

test('真实 XLSX 可解析并保留四个指定工作表',async()=>{
  const state=profile({industry:'chemical',roles:['principal','operator'],risks:['hazchem_high_risk_unit','chemicals','process_operation'],customRole:''}),result=generateMatrix(state,data),built=buildTrainingWorkbook(ExcelJS,result,data,state,'2026-08-19'),buffer=await built.workbook.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0,2).toString(),'PK');
  const reread=new ExcelJS.Workbook();await reread.xlsx.load(buffer);
  assert.deepEqual(reread.worksheets.map(x=>x.name),['岗位培训矩阵','培训要求明细','年度培训计划','依据与使用说明']);
  assert.ok(reread.getWorksheet('培训要求明细').getRow(1).values.includes('最低学时'));
  assert.ok(reread.getWorksheet('依据与使用说明').rowCount>40);assert.ok(buffer.length>12000);
});

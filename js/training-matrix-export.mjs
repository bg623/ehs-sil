import{statusCode,buildPlan}from'./training-matrix-engine.mjs';

const statusLabel={effective:'已生效',upcoming:'即将实施（不作为当前生效依据）',best_practice:'国际最佳实践（非法定）',needs_review:'企业复核'};
const levelLabel={mandatory:'明确最低要求',conditional:'条件适用',recommended:'风险/最佳实践建议'};
const basisLabel={explicit_training_clause:'法规明确培训条款',statutory_qualification:'法定资格/准入',mandatory_standard:'强制标准明确规定',statutory_duty_inference:'由法定职责推导的能力要求',enterprise_risk_control:'企业风险控制建议',international_practice:'国际最佳实践'};
const applicabilityLabel={yes:'适用',no:'不适用',unknown:'待确认'};
const competenceLabel={awareness:'知晓',knowledge:'知识掌握',practical:'现场实操',authorized:'授权胜任',certified:'法定资格/持证',management:'管理履职',rescue:'救援实操'};
const join=value=>[...new Set((value||[]).filter(Boolean))].join('；');

export function styleSheet(ws){
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columnCount}};
  ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A4B5C'}};
  ws.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};row.eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FFD5DEDC'}}};});});
  ws.columns.forEach((column,index)=>column.width=index===0?24:Math.min(42,Math.max(14,...column.values.slice(1).map(value=>String(value||'').length+2))));
}

export function buildTrainingWorkbook(ExcelJS,result,data,state,date=new Date().toISOString().slice(0,10)){
  const workbook=new ExcelJS.Workbook(),industry=data.industries.find(x=>x.id===state.industry)?.name||'通用';
  workbook.creator='EHS-SIL';workbook.created=new Date(`${date}T00:00:00Z`);

  const matrix=workbook.addWorksheet('岗位培训矩阵',{views:[{state:'frozen',xSplit:1,ySplit:1}]});
  matrix.addRow(['岗位',...result.topics.map(x=>x.title_zh)]);
  for(const role of result.roles)matrix.addRow([role.name,...result.topics.map(topic=>statusCode(result.requirements.find(item=>item.role_id===role.id&&item.topic_id===topic.topic_id)?.requirement_level))]);
  styleSheet(matrix);

  const detail=workbook.addWorksheet('培训要求明细',{views:[{state:'frozen',ySplit:1}]});
  detail.addRow(['岗位','培训主题','代码','要求分类','依据性质','优先级','匹配原因','依据名称','官方链接','依据层级','依据状态','实施日期','触发条件','培训频次','演练频次','最低学时','目标能力','培训方式','效果验证','记录证据','企业复核','规则ID']);
  for(const item of result.requirements){
    detail.addRow([
      item.role_name,item.topic.title_zh,statusCode(item.requirement_level),levelLabel[item.requirement_level],join(item.basis_kinds.map(kind=>basisLabel[kind]||kind)),item.priority,
      join(item.reasons),join(item.sources.map(source=>`${source.title}${source.document_number?`（${source.document_number}）`:''}${source.article?` ${source.article}`:''}`)),
      join(item.sources.map(source=>source.official_url)),
      join(item.sources.map(source=>source.source_type)),join(item.sources.map(source=>statusLabel[source.status]||source.status)),
      join(item.sources.map(source=>source.effective_date)),join(item.training_triggers),join(item.frequencies),join(item.drill_frequencies),join(item.minimum_durations),
      join(item.competence_levels.map(level=>competenceLabel[level]||level)),join(item.topic.delivery_methods),
      join([...item.assessment_requirements,...item.topic.assessment_methods]),join([...item.record_requirements,...item.topic.evidence_examples]),
      '需要',join(item.rule_ids)
    ]);
  }
  styleSheet(detail);

  const applicability=workbook.addWorksheet('适用性判定',{views:[{state:'frozen',ySplit:1}]});
  applicability.addRow(['企业属性','适用性状态','诊断问题/判断依据','判断人','判断日期','证据或备注']);
  for(const item of result.applicability_records)applicability.addRow([item.name,applicabilityLabel[item.status]||item.status,item.question,'','','']);
  applicability.getColumn(2).dataValidation={type:'list',allowBlank:false,formulae:['"适用,不适用,待确认"']};
  styleSheet(applicability);

  const plan=workbook.addWorksheet('年度培训计划',{views:[{state:'frozen',ySplit:1}]});
  plan.addRow(['频次/时间窗口','培训主题','目标岗位','触发条件','计划方式','责任角色','考核方式','计划状态','备注']);
  for(const item of buildPlan(result))plan.addRow([item.window,item.topic,item.role,item.trigger,item.method,item.owner,item.assessment,item.status,item.note]);
  styleSheet(plan);

  const info=workbook.addWorksheet('依据与使用说明');
  info.addRows([
    ['EHS-SIL 培训矩阵生成器',`V${result.version}`],['文档状态',result.document_status==='draft_pending_confirmation'?'待确认底稿':'已完成关键属性判断的需求底稿'],['生成日期',date],['法规版本核验日期',data.verified_at],['适用基线',data.jurisdiction],['行业',industry],
    ['选择岗位',result.roles.map(x=>x.name).join('、')],['人员状态',(state.personnelStatuses||[]).map(id=>data.personnel_statuses.find(x=>x.id===id)?.name).filter(Boolean).join('、')||'常规在岗'],['选择风险/作业',state.risks.map(id=>data.risks.find(x=>x.id===id)?.name).filter(Boolean).join('、')],
    ['适用边界',data.scope_note],['免责声明','本工具用于建立培训需求初稿，不构成合规结论。企业应结合所在地法规、行业要求、许可条件、岗位风险和内部制度完成复核。'],
    [],['法规/依据','文件号','层级','条款/范围','发布机构','实施日期','状态','官方链接','核验说明'],
    ...data.sources.map(source=>[source.title,source.document_number||'',source.source_type,source.article||'',source.authority,source.effective_date||'',statusLabel[source.status]||source.status,source.official_url,source.verification_note])
  ]);
  styleSheet(info);
  return{workbook,industryName:industry,date};
}

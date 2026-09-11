(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.EHSComplianceExport=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const judgments=["待评价","符合","基本符合","不符合","不适用"],conversionStates=["未开始","制度修订中","已转化","不适用"];
  const profileLabels={enterpriseTypes:"企业类型",industries:"行业",riskTags:"高风险活动",specialOperationTypes:"特殊作业详情",hazardousActivities:"危险化学品活动",hazardousWasteActivities:"危险废物活动",specialEquipmentTypes:"特种设备",industryAttributes:"行业属性",managementCommitments:"自愿采纳的管理标准",environmentalActivities:"环境活动",regulatoryAttributes:"监管与项目属性",workplaceActivities:"工作场所活动"};
  function header(ws,row){row.eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1E3A5F"}};c.alignment={vertical:"middle",wrapText:true};});ws.views=[{state:"frozen",ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:row.cellCount}};ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.25,right:.25,top:.5,bottom:.5,header:.2,footer:.2}};ws.pageSetup.printTitlesRow="1:1";}
  function listValidation(values){return {type:"list",allowBlank:true,formulae:['"'+values.join(",")+'"'],showErrorMessage:true,errorTitle:"请输入有效选项",error:"请从下拉列表中选择。"};}
  function finish(ws,widths){ws.columns.forEach((c,i)=>{c.width=widths[i]||16;c.style={alignment:{vertical:"top",wrapText:true}};});ws.eachRow(r=>r.eachCell(c=>{c.alignment={vertical:"top",wrapText:true};if(c.value instanceof Date)c.numFmt="yyyy-mm-dd";}));}
  function join(values){return [...new Set(values.filter(v=>v!==undefined&&v!==null&&String(v).trim()).map(String))].join("\n");}
  function clauseRequirements(record){return (record.matchedClauses||[]).length?record.matchedClauses.map(c=>c.reference+"："+c.summary).join("\n"):join([record.applicableClauses,record.requirementSummary]);}
  function checkRows(record,evaluation){
    const clauses=new Map((record.matchedClauses||[]).map(c=>[c.id,c])),checks=evaluation.checks||{},ids=[...new Set([...clauses.keys(),...Object.keys(checks)])];
    return ids.map(id=>{
      const item=checks[id]||{},note=String(item.note||""),label=clauses.has(id)?id+" · "+clauses.get(id).reference:"历史/未匹配条款 "+id;
      const state=item.state==="missing"?"已发现缺项":item.state==="provided"?(note.trim()?"已登记证据索引（非合规结论）":"已选择提供，但缺少证据索引"):"尚未提供";
      return {status:label+"："+state,note:note.trim()?label+"："+note:""};
    });
  }
  function versionWarning(e){return e.needsReassessment?"版本已变，需重评；历史记录保留，不作为当前版本已完成评价":"";}
  function buildWorkbook(ExcelJS,payload){
    const {profile:p,selected,evaluations,today,statusFor,reminderFor,distanceFor}=payload,meta=payload.meta||{},wb=new ExcelJS.Workbook();wb.creator="EHS-SIL";wb.created=new Date();
    let ws=wb.addWorksheet("企业画像与使用说明");
    ws.addRow(["字段","内容"]);
    Object.entries({企业名称:p.companyName,省份:p.province,城市:p.city,企业规模:p.scale,所有制:p.ownership}).forEach(x=>ws.addRow(x));
    for(const [key,label] of Object.entries(profileLabels))ws.addRow([label,(p[key]||[]).join("、")]);
    for(const [key,value] of Object.entries(p))if(Array.isArray(value)&&!profileLabels[key])ws.addRow(["补充画像："+key,value.join("、")]);
    for(const [fact,value] of Object.entries(p.answers||{}))ws.addRow(["画像追问："+fact,value==="yes"?"是":value==="no"?"否":"尚不确定"]);
    Object.entries({数据版本:meta.schemaVersion||"未提供",受控法规数:Number.isFinite(meta.verified)?meta.verified:"未提供",候选记录数:Number.isFinite(meta.total)&&Number.isFinite(meta.verified)?Math.max(0,meta.total-meta.verified):"未提供",最近核验日期:meta.latestVerifiedAt||"未记录",导出时间:today+"（中国标准时间）"}).forEach(x=>ws.addRow(x));
    ws.addRow([]);
    ws.addRow(["填写说明","条款摘要、待补充画像和建议动作由规则自动整理；客观证据、企业实际判定与整改完成情况由用户提供。未提供证据不自动判定符合；版本变化后的历史评价须重评。"]);
    ws.addRow(["画像说明","勾选项表示已确认；未勾选不等于不存在。追问中的“否”与“尚不确定”分别保留。法规有效状态、来源核验、画像适用范围和企业履行情况是不同维度。"]);
    ws.addRow(["版权与使用边界","法规及标准基本信息来源于公开官方渠道；EHS-SIL 对本文件中的原创编排、匹配逻辑、摘要说明和模板设计保留相应权利。本文件仅供会员本人或所在企业内部 EHS 管理使用，不得整表转售、公开传播或作为数据库二次发布。"]);
    ws.addRow(["免责声明","识别结果仅供管理参考，不构成法律意见。条款卡不是法规全文，未命中不代表没有要求；地方排放限值、许可证和工艺专属条件仍须结合实际情况确认。"]);
    header(ws,ws.getRow(1));finish(ws,[30,90]);

    ws=wb.addWorksheet("法规识别台账");
    ws.addRow(["序号","类别层级","法规或标准名称","文号/标准号","法规有效状态","发布日期","实施日期","发布机关","适用性结论","匹配原因","适用条款或章节","要求摘要","转化落实情况","主责部门","协同部门","证据要求（建议或用户修订）","下次评审日期","评审提醒","来源核验状态","官方来源","画像范围判断","待补充事实","建议动作（自动生成）","版本重评提示"]);
    selected.forEach((r,i)=>{
      const e=evaluations[r.id]||{};
      ws.addRow([i+1,r.type,r.name,r.documentNo,r.computedStatus,r.publishDate,r.effectiveDate,r.issuingAuthority,r.applicability,(r.reasons||[]).join("；"),r.applicableClauses,r.requirementSummary,e.conversion||"未开始",e.primaryDepartment||(r.suggestedDepartment||[])[0]||"",e.cooperatingDepartments||(r.suggestedDepartment||[]).slice(1).join("、"),e.evidenceRequirement||r.evidenceRequirement||"尚无已核对的证据清单",e.reviewDate||"",reminderFor(e.reviewDate),r.sourceVerification||r.verificationStatus||"未记录",{text:r.sourceName||"官方来源",hyperlink:r.sourceUrl},r.scopeApplicability||r.applicability,(r.missingFacts||[]).join("；"),r.suggestedAction||"",versionWarning(e)]);
    });
    header(ws,ws.getRow(1));
    for(let row=2;row<=ws.rowCount;row++){ws.getCell(row,13).dataValidation=listValidation(conversionStates);ws.getCell(row,17).numFmt="yyyy-mm-dd";}
    if(ws.rowCount>1)ws.addConditionalFormatting({ref:"R2:R"+ws.rowCount,rules:[{type:"containsText",operator:"containsText",text:"逾期",style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFFECACA"}}}},{type:"containsText",operator:"containsText",text:"30日内",style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFFEF3C7"}}}}]});
    finish(ws,[8,14,32,18,14,13,13,20,14,36,24,48,16,18,22,32,15,15,30,26,24,30,40,34]);

    ws=wb.addWorksheet("符合性评价记录");
    ws.addRow(["法规或标准名称","条款号与要求摘要（自动整理）","公司现状与客观证据（用户提供）","判定（用户填写）","差距分析","整改措施","责任部门或责任人","计划完成日期","实际完成日期","验证结果","自动状态","逾期天数","落实建议（自动生成，非履行证据）","条款证据登记状态","条款证据索引或缺项说明（用户提供）"]);
    selected.forEach(r=>{
      const e=evaluations[r.id]||{},status=e.needsReassessment?"版本已变，需重评":statusFor(e),overdue=status.startsWith("已逾期")?Number(status.replace(/\D/g,"")):0,checks=checkRows(r,e);
      ws.addRow([r.name,clauseRequirements(r),e.evidence||"",e.judgment||"待评价",e.gap||"",e.action||"",e.owner||"",e.due||"",e.completedAt||"",e.verification||"",status,overdue,join([r.evaluationDraft,r.suggestedAction,versionWarning(e)]),checks.map(c=>c.status).join("\n"),checks.map(c=>c.note).filter(Boolean).join("\n")]);
    });
    header(ws,ws.getRow(1));
    for(let row=2;row<=ws.rowCount;row++){ws.getCell(row,4).dataValidation=listValidation(judgments);for(const col of [8,9])ws.getCell(row,col).numFmt="yyyy-mm-dd";}
    if(ws.rowCount>1){
      ws.addConditionalFormatting({ref:"D2:D"+ws.rowCount,rules:[{type:"containsText",operator:"containsText",text:"不符合",style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFFECACA"}}}},{type:"containsText",operator:"containsText",text:"基本符合",style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFFEF3C7"}}}}]});
      ws.addConditionalFormatting({ref:"L2:L"+ws.rowCount,rules:[{type:"cellIs",operator:"greaterThan",formulae:[0],style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFFECACA"}},font:{color:{argb:"FF991B1B"}}}}]});
    }
    finish(ws,[32,48,36,16,32,32,20,15,15,26,24,12,48,40,48]);

    ws=wb.addWorksheet("法规动态跟踪及官方来源");
    ws.addRow(["获知日期","信息来源","法规或标准名称","变化类型","原版本","新版本","发布日期","实施日期","实施状态","实施进度","影响等级","影响评估","应对措施","责任人","完成状态","官方来源"]);
    selected.filter(r=>r.changeType&&r.changeType!=="无变化"||r.computedStatus==="即将实施").forEach(r=>{
      const e=evaluations[r.id]||{};
      ws.addRow([r.lastVerifiedAt,r.sourceName,r.name,r.changeType,(r.replaces||[]).join("、"),r.documentNo,r.publishDate,r.effectiveDate,r.computedStatus,distanceFor(r.effectiveDate),"未作影响分级",join([r.evaluationDraft,versionWarning(e)])||"尚无已核对的条款变化分析",r.suggestedAction||"核对适用条款并更新内部文件",e.owner||"待指定",e.conversion||"未开始",{text:"官方原文",hyperlink:r.sourceUrl}]);
    });
    header(ws,ws.getRow(1));for(let row=2;row<=ws.rowCount;row++)ws.getCell(row,15).dataValidation=listValidation(conversionStates);finish(ws,[15,18,32,14,20,20,15,15,14,18,16,40,40,18,16,24]);
    return wb;
  }
  return {buildWorkbook};
});

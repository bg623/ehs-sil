(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.JsaExcelExport=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  var COLORS={teal:'173F4B',dark:'082630',ivory:'F7F4EE',sage:'DCE9E4',amber:'C58A2A',white:'FFFFFF',text:'263238',muted:'5F6F74',border:'D7D1C6',red:'FDE8E7',yellow:'FFF4CE',green:'E4F3E9'};
  var thinBorder={style:'thin',color:{argb:COLORS.border}};

  function safeText(value){return value==null?'':String(value)}
  function sourceText(source){
    if(Array.isArray(source))return source.map(function(item){return typeof item==='string'?item:(item&&item.source_id||item&&item.title||'')}).filter(Boolean).join('；');
    if(source&&typeof source==='object')return source.source_id||source.title||JSON.stringify(source);
    return safeText(source);
  }
  function riskLabel(value){value=Number(value||0);if(value<=4)return'低风险';if(value<=9)return'中风险';if(value<=16)return'高风险';return'极高风险'}
  function findingStatus(rule,confirmed){return confirmed?'已覆盖':(rule.severity==='high'?'需要人工确认':'建议关注')}

  function styleTitle(cell,size){cell.font={name:'Microsoft YaHei',size:size||18,bold:true,color:{argb:COLORS.white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:COLORS.teal}};cell.alignment={vertical:'middle',horizontal:'left'}}
  function styleHeader(row){
    row.height=32;
    row.eachCell(function(cell){cell.font={name:'Microsoft YaHei',size:10,bold:true,color:{argb:COLORS.white}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:COLORS.teal}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:thinBorder,left:thinBorder,bottom:thinBorder,right:thinBorder}});
  }
  function styleBody(row){row.eachCell(function(cell){cell.font={name:'Microsoft YaHei',size:9,color:{argb:COLORS.text}};cell.alignment={vertical:'top',wrapText:true};cell.border={bottom:thinBorder}})}

  function buildWorkbook(ExcelJS,payload){
    if(!ExcelJS||!ExcelJS.Workbook)throw new Error('ExcelJS不可用');
    payload=payload||{};
    var meta=payload.meta||{};
    var steps=payload.steps||[];
    var findings=payload.findings||[];
    var confirmed=payload.confirmedRuleIds||{};
    var wb=new ExcelJS.Workbook();
    wb.creator='EHS-SIL';
    wb.created=new Date();
    wb.calcProperties.fullCalcOnLoad=true;

    var sheet=wb.addWorksheet('JSA工作表',{views:[{state:'frozen',ySplit:10,showGridLines:false}]});
    sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.25,right:.25,top:.5,bottom:.5,header:.2,footer:.2},printTitlesRow:'1:10'};
    sheet.columns=[
      {key:'no',width:7},{key:'step',width:25},{key:'hazard',width:31},{key:'existing',width:34},{key:'additional',width:34},
      {key:'l',width:9},{key:'s',width:9},{key:'r',width:10},{key:'level',width:13},{key:'review',width:20}
    ];
    sheet.mergeCells('A1:J1');sheet.getCell('A1').value='JSA 工作安全分析｜人工确认版';styleTitle(sheet.getCell('A1'),18);sheet.getRow(1).height=34;
    sheet.mergeCells('A2:J2');sheet.getCell('A2').value='系统生成内容仅为建议草稿；不代表作业安全、法规符合、可以批准或风险已经可接受。';sheet.getCell('A2').font={name:'Microsoft YaHei',size:9,color:{argb:'7A4E00'}};sheet.getCell('A2').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4CE'}};sheet.getCell('A2').alignment={vertical:'middle',wrapText:true};sheet.getRow(2).height=28;
    sheet.getCell('A4').value='作业名称';sheet.mergeCells('B4:E4');sheet.getCell('B4').value=safeText(meta.jobName);
    sheet.getCell('F4').value='作业编号';sheet.mergeCells('G4:J4');sheet.getCell('G4').value=safeText(meta.jobRef);
    sheet.getCell('A5').value='部门/区域';sheet.mergeCells('B5:E5');sheet.getCell('B5').value=safeText(meta.department);
    sheet.getCell('F5').value='评估人';sheet.mergeCells('G5:H5');sheet.getCell('G5').value=safeText(meta.assessor);sheet.getCell('I5').value='日期';sheet.getCell('J5').value=safeText(meta.date);
    sheet.getCell('A6').value='作业内容';sheet.mergeCells('B6:J7');sheet.getCell('B6').value=safeText(meta.taskDescription);sheet.getCell('B6').alignment={vertical:'top',wrapText:true};sheet.getRow(6).height=28;sheet.getRow(7).height=28;
    sheet.getCell('A8').value='场景/能量';sheet.mergeCells('B8:J8');sheet.getCell('B8').value=[(payload.scenarioLabels||[]).join('、'),(payload.tagLabels||[]).join('、')].filter(Boolean).join('｜');
    ['A4','F4','A5','F5','I5','A6','A8'].forEach(function(address){var c=sheet.getCell(address);c.font={name:'Microsoft YaHei',size:9,bold:true,color:{argb:COLORS.teal}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:COLORS.sage}};c.alignment={vertical:'middle'}});
    var infoRows=[4,5,6,7,8];
    infoRows.forEach(function(rowNo){sheet.getRow(rowNo).eachCell({includeEmpty:true},function(cell){cell.border={bottom:thinBorder};if(!cell.font)cell.font={name:'Microsoft YaHei',size:9,color:{argb:COLORS.text}};if(!cell.alignment)cell.alignment={vertical:'middle',wrapText:true}})});
    var headerRow=sheet.getRow(10);headerRow.values=['序号','作业步骤','潜在危害','现有控制措施','补充控制措施','可能性 L','严重性 S','RPN','风险等级','人工确认/备注'];styleHeader(headerRow);
    steps.forEach(function(step,index){
      var rowNo=11+index;
      var row=sheet.getRow(rowNo);
      row.values=[index+1,safeText(step.desc),safeText(step.hazard),safeText(step.existingCtrl),safeText(step.addCtrl),Number(step.L||3),Number(step.S||3),null,null,'待人工确认'];
      row.getCell(8).value={formula:'F'+rowNo+'*G'+rowNo,result:Number(step.R||Number(step.L||3)*Number(step.S||3))};
      row.getCell(9).value={formula:'IF(H'+rowNo+'<=4,"低风险",IF(H'+rowNo+'<=9,"中风险",IF(H'+rowNo+'<=16,"高风险","极高风险")))',result:riskLabel(step.R)};
      row.height=54;styleBody(row);
      row.getCell(1).alignment={vertical:'top',horizontal:'center'};row.getCell(6).alignment={vertical:'top',horizontal:'center'};row.getCell(7).alignment={vertical:'top',horizontal:'center'};row.getCell(8).alignment={vertical:'top',horizontal:'center'};row.getCell(9).alignment={vertical:'top',horizontal:'center'};
      row.getCell(6).dataValidation={type:'list',allowBlank:false,formulae:['"1,2,3,4,5"']};
      row.getCell(7).dataValidation={type:'list',allowBlank:false,formulae:['"1,2,3,4,5"']};
      row.getCell(10).dataValidation={type:'list',allowBlank:true,formulae:['"待人工确认,已确认,需修改,不适用"']};
    });
    if(steps.length){
      var endRow=10+steps.length;
      sheet.autoFilter={from:'A10',to:'J'+endRow};
      sheet.addConditionalFormatting({ref:'H11:H'+endRow,rules:[
        {type:'cellIs',operator:'lessThanOrEqual',formulae:[4],style:{fill:{type:'pattern',pattern:'solid',bgColor:{argb:COLORS.green}}}},
        {type:'cellIs',operator:'between',formulae:[5,9],style:{fill:{type:'pattern',pattern:'solid',bgColor:{argb:COLORS.yellow}}}},
        {type:'cellIs',operator:'greaterThanOrEqual',formulae:[10],style:{fill:{type:'pattern',pattern:'solid',bgColor:{argb:COLORS.red}}}}
      ]});
    }
    sheet.headerFooter.oddFooter='EHS-SIL｜第 &P / &N 页｜须经现场人工确认';

    var check=wb.addWorksheet('完整性检查',{views:[{state:'frozen',ySplit:6,showGridLines:false}]});
    check.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,printTitlesRow:'1:6'};
    check.columns=[{width:18},{width:24},{width:16},{width:42},{width:38},{width:44},{width:30}];
    check.mergeCells('A1:G1');check.getCell('A1').value='JSA 完整性与逻辑一致性检查';styleTitle(check.getCell('A1'),17);check.getRow(1).height=34;
    check.mergeCells('A2:G3');check.getCell('A2').value='以下状态仅反映系统提示与使用者人工勾选结果。请逐项核对现场条件、企业程序和适用要求。';check.getCell('A2').alignment={vertical:'middle',wrapText:true};check.getCell('A2').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4CE'}};check.getCell('A2').font={name:'Microsoft YaHei',size:9,color:{argb:'7A4E00'}};
    var checkHeader=check.getRow(6);checkHeader.values=['规则编号','检查项','状态','提示内容','提示原因','建议动作','专业来源/版本'];styleHeader(checkHeader);
    findings.forEach(function(rule,index){
      var row=check.getRow(7+index);row.values=[safeText(rule.rule_id),safeText(rule.rule_name),findingStatus(rule,Boolean(confirmed[rule.rule_id])),safeText(rule.prompt_text),safeText(rule.reason),safeText(rule.recommended_action),[sourceText(rule.source),safeText(rule.version)].filter(Boolean).join('｜')];row.height=58;styleBody(row);row.getCell(3).dataValidation={type:'list',allowBlank:false,formulae:['"已覆盖,建议关注,需要人工确认"']};
    });
    check.headerFooter.oddFooter='EHS-SIL｜完整性检查｜第 &P / &N 页';

    var guide=wb.addWorksheet('使用说明',{views:[{showGridLines:false}]});
    guide.columns=[{width:22},{width:88}];
    guide.mergeCells('A1:B1');guide.getCell('A1').value='EHS-SIL JSA Excel 使用说明';styleTitle(guide.getCell('A1'),17);guide.getRow(1).height=34;
    var guideRows=[
      ['文件定位','这是由JSA专业教练生成的可编辑工作草稿，不是已批准的作业许可证或安全结论。'],
      ['使用顺序','先逐行核对作业步骤、危险和控制措施，再修改L/S、补充现场信息并填写人工确认/备注。'],
      ['风险矩阵','RPN = 可能性（L）× 严重性（S）；风险等级随L/S公式变化。风险可接受标准必须使用企业批准的标准。'],
      ['完整性检查','“已覆盖”仅表示使用者已人工确认；“建议关注”和“需要人工确认”必须在开工前处理。'],
      ['重要边界','文件不代表作业安全、法规符合、可以批准或风险已经可接受，不能替代现场风险评估和企业审批。'],
      ['隐私提示','网站不提供云端保存。请勿在任务描述或导出文件中填写不必要的企业、装置或人员敏感信息。']
    ];
    guideRows.forEach(function(values,index){var row=guide.getRow(3+index);row.values=values;row.height=48;styleBody(row);row.getCell(1).font={name:'Microsoft YaHei',size:10,bold:true,color:{argb:COLORS.teal}};row.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:COLORS.sage}}});
    return wb;
  }

  function fileName(jobName,date){
    var safe=safeText(jobName||'JSA工作安全分析').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim().slice(0,60);
    return 'EHS-SIL_JSA_'+safe+'_'+safeText(date||new Date().toISOString().slice(0,10))+'.xlsx';
  }

  return {buildWorkbook:buildWorkbook,fileName:fileName,riskLabel:riskLabel};
});
